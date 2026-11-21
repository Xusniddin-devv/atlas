/* Lesson s5b-context-budget: what goes in the window, a token budget.
   Story: the records helper of the made-up Larch Street Veterinary Clinic. Its code allows 2,500 tokens per
   request (input plus the room kept for the answer). Requests start failing once a pet's file holds two long lab
   reports. Ideas: (1) a request is made of parts (system prompt, tool definitions, retrieved records, chat
   history, the question, room for the answer), and each part can be measured, the hidden ones (tools, chat
   format) from the API's own usage numbers; (2) when it is over, cut by what the question needs, keeping the fixed
   parts and the answer's room, not by position or by size. A cut from the end dropped the newest lab report and
   the model reported two-year-old values as this week's.
   Depth: explain (screens 1-6, 8, 9, interview), scratch (screen 7: a from-scratch budget fitter, traced).
   Data, all real:
   - docs/ai-path/runs/s5b-context-budget/: clinic.py (the made-up records, the input), budget.py -> budget.out.txt
     and budget.json (tiktoken o200k_base count of every part), make_requests.py -> make_requests.out.txt (the four
     requests and where the cut from the end lands), usage_check.py -> usage_check.out.txt (our counts against the
     API's prompt_tokens: tools 194, chat format 31, exact on all four), fit_trace.py -> fit_trace.out.txt (the
     traced fitter on screen 7).
   - recordings (main checkout) docs/ai-path/recordings/s5b-context-budget/full, notools, cut-end, drop-old.json
     (openai/gpt-4o-mini through OpenRouter, temperature 0, 2026-11-13).
   Every other number on screen is computed here from D, TRACE and the REC_* constants.
   Lesson-local CSS (prefix lx-s5b-context-budget-): the parts bar, the recorded-answer block, the snippet cards, the
   cut toggles and a compact table; injected by css(), called by every screen. Plain browser script. */
(() => {
  const ID = "s5b-context-budget", P = "lx-" + ID + "-";
  const fmt = n => n.toLocaleString("en");
  const sum = a => a.reduce((x, y) => x + y, 0);

  // From budget.json, usage_check.out.txt and clinic.py (BUDGET, ANSWER_ROOM)
  const D = {
    budget: 2500, answerRoom: 400,
    system: 88, question: 32, recordsHeading: 12,
    tools: 194, format: 31,                       // measured from usage: full - notools, notools api - notools text
    textTotal: 2456,                              // our count of all message text in the full request
    messages: 7,                                  // usage_check.out.txt: messages=7 in every request
    api: { full: 2681, notools: 2487, cutEnd: 2100, dropOld: 1794 },
    cutKept: 1605, cutDropped: 581,               // make_requests.out.txt: tokens of the records message kept / cut
    lab2026Start: 1178,                           // token where the 2026 report starts inside the records message
    items: [
      // [key, label, tokens, section]
      ["profile", "Pet profile and vaccinations", 109, "records"],
      ["visits", "Visit notes", 170, "records"],
      ["lab2024", "Lab report, 2024-03-05 (bloods before a dental)", 887, "records"],
      ["lab2026", "Lab report, 2026-11-11 (this week's senior panel)", 1008, "records"],
      ["turn1", "Turn 1, vet: how much weight has she lost?", 28, "history"],
      ["turn2", "Turn 2, helper: 4.3 kg to 3.9 kg", 48, "history"],
      ["turn3", "Turn 3, vet: agreed with the owner: kidney diet, recheck in four weeks", 41, "history"],
      ["turn4", "Turn 4, helper: “Noted: kidney diet … recheck in four weeks”", 33, "history"]
    ]
  };
  const QUESTION = "Dr. Okafor: Give me Pepper's kidney values from this week's bloodwork against the reference ranges, and remind me what we agreed with the owner.";
  const ITEM = Object.fromEntries(D.items.map(([k, l, t, s]) => [k, { k, l, t, s }]));
  const FIXED = D.system + D.tools + D.format + D.recordsHeading + D.question + D.answerRoom;
  const FULL = FIXED + sum(D.items.map(i => i[2]));            // the whole request + answer room
  const OVER = FULL - D.budget;
  const BIGGEST = D.items.reduce((a, b) => (b[2] > a[2] ? b : a));
  const HIDDEN = D.api.full - D.textTotal;

  // From docs/ai-path/recordings/s5b-context-budget/*.json (not trimmed, not altered)
  const REC_FULL = { src: "s5b-context-budget/full", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    text: "From the bloodwork on 2026-11-10, Pepper's kidney values are:\n\n- **Creatinine:** 2.9 mg/dL (H) - Reference range: 0.8-2.4 mg/dL\n- **SDMA:** 19 ug/dL (H) - Reference range: 0-14 ug/dL\n- **Urea (BUN):** 41 mg/dL (H) - Reference range: 16-36 mg/dL\n\nWe agreed with the owner to start a kidney diet today and recheck bloods and blood pressure in four weeks." };
  const REC_CUT = { src: "s5b-context-budget/cut-end", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    text: "From the bloodwork on 2026-11-10, here are Pepper's kidney values:\n\n- **Creatinine**: 1.5 mg/dL (reference range: 0.8-2.4 mg/dL)\n- **SDMA**: 11 µg/dL (reference range: 0-14 µg/dL)\n- **Urea (BUN)**: 24 mg/dL (reference range: 16-36 mg/dL)\n\nAll values are within the reference ranges.\n\nWe agreed with the owner to start a kidney diet today (2026-11-13) and to recheck bloods and blood pressure in four weeks." };
  const REC_DROP = { src: "s5b-context-budget/drop-old", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    text: "Pepper's kidney values from the bloodwork on 2026-11-11 are as follows:\n\n- **Creatinine**: 2.9 mg/dL (reference range: 0.8-2.4) - flagged high (H)\n- **SDMA**: 19 µg/dL (reference range: 0-14) - flagged high (H)\n- **Urea (BUN)**: 41 mg/dL (reference range: 16-36) - flagged high (H)\n\nWe agreed with the owner to start a kidney diet today (2026-11-13) and to recheck bloods and blood pressure in four weeks." };
  // the creatinine value each answer gives, read from the recorded text
  const creat = rec => (rec.text.match(/Creatinine\W+([\d.]+) mg\/dL/) || [])[1];
  // the two lab reports' creatinine, from clinic.py (the input records)
  const CREAT_2024 = "1.5", CREAT_2026 = "2.9";

  // From fit_trace.out.txt: [line about to run, event, used, kept, name, tokens, printed so far]
  const TRACE = [
    [1,"",null,null,null,null,""],
    [2,"",745,null,null,null,""],
    [3,"",745,[],null,null,""],
    [4,"",745,[],"lab2026",1008,""],
    [5,"",745,[],"lab2026",1008,""],
    [6,"",745,["lab2026"],"lab2026",1008,""],
    [3,"",1753,["lab2026"],"lab2026",1008,""],
    [4,"",1753,["lab2026"],"visits",170,""],
    [5,"",1753,["lab2026"],"visits",170,""],
    [6,"",1753,["lab2026","visits"],"visits",170,""],
    [3,"",1923,["lab2026","visits"],"visits",170,""],
    [4,"",1923,["lab2026","visits"],"turn4",33,""],
    [5,"",1923,["lab2026","visits"],"turn4",33,""],
    [6,"",1923,["lab2026","visits","turn4"],"turn4",33,""],
    [3,"",1956,["lab2026","visits","turn4"],"turn4",33,""],
    [4,"",1956,["lab2026","visits","turn4"],"turn3",41,""],
    [5,"",1956,["lab2026","visits","turn4"],"turn3",41,""],
    [6,"",1956,["lab2026","visits","turn4","turn3"],"turn3",41,""],
    [3,"",1997,["lab2026","visits","turn4","turn3"],"turn3",41,""],
    [4,"",1997,["lab2026","visits","turn4","turn3"],"turn2",48,""],
    [5,"",1997,["lab2026","visits","turn4","turn3"],"turn2",48,""],
    [6,"",1997,["lab2026","visits","turn4","turn3","turn2"],"turn2",48,""],
    [3,"",2045,["lab2026","visits","turn4","turn3","turn2"],"turn2",48,""],
    [4,"",2045,["lab2026","visits","turn4","turn3","turn2"],"turn1",28,""],
    [5,"",2045,["lab2026","visits","turn4","turn3","turn2"],"turn1",28,""],
    [6,"",2045,["lab2026","visits","turn4","turn3","turn2","turn1"],"turn1",28,""],
    [3,"",2073,["lab2026","visits","turn4","turn3","turn2","turn1"],"turn1",28,""],
    [4,"",2073,["lab2026","visits","turn4","turn3","turn2","turn1"],"profile",109,""],
    [5,"",2073,["lab2026","visits","turn4","turn3","turn2","turn1"],"profile",109,""],
    [6,"",2073,["lab2026","visits","turn4","turn3","turn2","turn1","profile"],"profile",109,""],
    [3,"",2182,["lab2026","visits","turn4","turn3","turn2","turn1","profile"],"profile",109,""],
    [4,"",2182,["lab2026","visits","turn4","turn3","turn2","turn1","profile"],"lab2024",887,""],
    [8,"",2182,["lab2026","visits","turn4","turn3","turn2","turn1","profile"],"lab2024",887,""],
    [3,"",2182,["lab2026","visits","turn4","turn3","turn2","turn1","profile"],"lab2024",887,"left out: lab2024 887\n"],
    [9,"",2182,["lab2026","visits","turn4","turn3","turn2","turn1","profile"],"lab2024",887,"left out: lab2024 887\n"],
    [9,"r",2182,["lab2026","visits","turn4","turn3","turn2","turn1","profile"],"lab2024",887,"left out: lab2024 887\n"]
  ].map(([line, ev, used, kept, name, tokens, out]) => ({ line, ev, used, kept, name, tokens, out }));
  // fit_trace.py's fixed parts: tools_and_format is the measured 194 + 31; the records heading is not counted there
  const FIT_FIXED = [["system", D.system], ["tools_and_format", D.tools + D.format], ["question", D.question], ["answer_room", D.answerRoom]];
  const FIT_ORDER = ["lab2026", "visits", "turn4", "turn3", "turn2", "turn1", "profile", "lab2024"];

  const caption = rec => `<p class="${P}cap">Recorded model output, ${rec.recordedAt}</p>`;
  const recBlock = (who, rec, kit) => `<p class="${P}who">${who}</p><div class="${P}out">${kit.esc(rec.text)}</div>${caption(rec)}`;

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}out { white-space: pre-wrap; font: 500 14px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-top: 8px; overflow-wrap: anywhere; color: var(--ink); }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}who { font-size: 15px; color: var(--muted); margin: 18px 0 0; }
      .${P}snip.row { white-space: pre; overflow-x: auto; overflow-wrap: normal; }
      .${P}snip { white-space: pre-wrap; font: 500 14px/1.45 var(--mono); background: var(--sunk); border-radius: 8px; padding: 10px 12px; margin: 0 0 8px; overflow-wrap: anywhere; color: var(--ink); }
      .${P}tb { border-collapse: collapse; width: 100%; margin-top: 14px; font: 500 15px var(--mono); }
      .${P}tb th { text-align: left; font: 600 13px var(--font); color: var(--muted); padding: 4px 8px 6px; border-bottom: 2px solid var(--ink); }
      .${P}tb td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--ink); }
      .${P}tb td.n { text-align: right; white-space: nowrap; }
      .${P}tb tr.sec td { font: 600 13px var(--font); color: var(--muted); padding-top: 12px; }
      .${P}tb tr.tot td { border-top: 2px solid var(--ink); font-weight: 700; }
      .${P}tb tr.gone td { color: var(--faint); text-decoration: line-through; }
      .${P}bw { position: relative; margin-top: 30px; }
      .${P}bar { display: flex; height: 28px; border: 1.5px solid var(--ink); border-radius: 6px; overflow: hidden; background: var(--bg); }
      .${P}seg { height: 100%; min-width: 2px; border-right: 1px solid var(--bg); }
      .${P}fix { background: var(--faint); }
      .${P}rec { background: var(--ink-2); }
      .${P}his { background: var(--muted); }
      .${P}ans { background: var(--good-soft); box-shadow: inset 0 0 0 2px var(--good); }
      .${P}over { background: var(--bad-soft); box-shadow: inset 0 0 0 2px var(--bad); }
      .${P}mark { position: absolute; top: -22px; bottom: -4px; border-left: 2px solid var(--ink); }
      .${P}mark span { position: absolute; top: 0; font: 600 12px var(--mono); color: var(--ink); white-space: nowrap; }
      .${P}leg { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font: 500 13px var(--mono); color: var(--muted); }
      .${P}leg i { display: inline-block; width: 13px; height: 13px; border-radius: 3px; vertical-align: -2px; margin-right: 5px; }
      .${P}leg b { color: var(--ink); }
      .${P}cuts { display: grid; gap: 8px; margin-top: 12px; }
      .${P}cuts button { display: flex; justify-content: space-between; gap: 10px; align-items: center; width: 100%; text-align: left; min-height: 48px; padding: 8px 12px; font: 500 15px var(--font); border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 10px; cursor: pointer; }
      .${P}cuts button b { font: 600 14px var(--mono); white-space: nowrap; }
      .${P}cuts button.cut { color: var(--faint); text-decoration: line-through; border-style: dashed; }
      .${P}cuts button.bad { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
      .${P}cuts small { display: block; font: 600 12px var(--font); color: var(--muted); text-decoration: none; }
      @media (hover: hover) { .${P}cuts button:hover { border-color: var(--ink); } }
      .${P}meter { font: 600 16px var(--mono); margin-top: 12px; color: var(--ink); }
      .${P}code-out { white-space: pre-wrap; font: 500 14px/1.5 var(--mono); background: var(--surface); border-radius: 8px; padding: 8px 12px; margin-top: 8px; color: var(--ink); }
      .${P}row2 { flex-wrap: wrap; }
      .${P}row2 .btn { flex: 1 1 100px; min-height: 48px; }
    `;
    document.head.appendChild(s);
  }

  /* The parts bar: segments to scale; anything past the budget line is marked over. */
  function partsBar(parts) {
    const total = sum(parts.map(p => p.n)), scale = Math.max(total, D.budget);
    let used = 0;
    const segs = [], drawn = new Set();
    for (const p of parts) {
      const inside = Math.max(0, Math.min(p.n, D.budget - used)), out = p.n - inside;
      if (inside) drawn.add(p.k);
      if (inside) segs.push(`<span class="${P}seg ${P}${p.k}" style="width:${inside / scale * 100}%"></span>`);
      if (out) segs.push(`<span class="${P}seg ${P}over" style="width:${out / scale * 100}%"></span>`);
      used += p.n;
    }
    const at = D.budget / scale * 100;
    const kinds = [["fix", "fixed parts"], ["rec", "records"], ["his", "chat history"], ["ans", "room for the answer"]].filter(([k]) => drawn.has(k));
    return `<div class="${P}bw"><div class="${P}bar">${segs.join("")}</div>
      <div class="${P}mark" style="left:calc(${at}% - 1px)"><span style="${at > 60 ? "right:0;padding-right:6px" : "left:4px"}">budget: ${fmt(D.budget)}</span></div></div>
      <div class="${P}leg">${kinds.map(([k, t]) => `<span><i class="${P}${k}"></i>${t}</span>`).join("")}${total > D.budget ? `<span><i class="${P}over"></i>over: <b>${fmt(total - D.budget)}</b></span>` : `<span>spare: <b>${fmt(D.budget - total)}</b></span>`}</div>`;
  }
  const barFor = keep => [
    { k: "fix", n: D.system + D.tools + D.format + D.recordsHeading },
    { k: "rec", n: sum(D.items.filter(i => i[3] === "records" && keep(i[0])).map(i => i[2])) },
    { k: "his", n: sum(D.items.filter(i => i[3] === "history" && keep(i[0])).map(i => i[2])) },
    { k: "fix", n: D.question },
    { k: "ans", n: D.answerRoom }];

  /* 1. The situation: sort pieces of the real request into its parts. */
  const SECTIONS = ["System prompt", "Tool definitions", "Retrieved records", "Chat history"];
  const SNIPS = [
    ["When you quote a lab value, give its unit, the reference range and the date of the test. If the records you were given do not contain the answer, say so plainly and do not guess.", 0],
    ["\"name\": \"book_appointment\",\n\"description\": \"Book a visit for the pet. Use only when the vet asks you to book.\"", 1],
    ["Creatinine               2.9       mg/dL       0.8-2.4           H", 2],
    ["Dr. Okafor: Thanks. I phoned the owner just now. We agreed to start a kidney diet today and recheck bloods and blood pressure in four weeks. Note that, please.", 3]
  ];
  const SNIP_WRONG = [
    ["", "Tool definitions describe actions the helper can ask the program to run (a name, a description, parameters). This is a standing rule about how to answer: the system prompt.", "Retrieved records are facts about Pepper. This is an instruction that holds for every pet and every question: the system prompt.", "Nobody typed this in today's chat. It is the same rule the helper gets on every request: the system prompt."],
    ["The system prompt is prose instructions. This is a name and a description with JSON keys: an action the model may ask the program to run, sent as a tool definition.", "", "Records are facts about the pet. This describes an action, booking a visit, that the model can request: a tool definition.", "Nobody said this in the chat. It is a JSON description of an action: a tool definition."],
    ["The system prompt is the same for every pet. A creatinine value belongs to one pet on one day: it comes from the records the helper fetched.", "Tools describe actions. This is a measured value from a lab: it came in with the retrieved records.", "", "Nobody typed this in the chat. It is one row of a lab report the helper fetched: retrieved records."],
    ["The system prompt is written once by the team. This was said today by the vet, in the conversation: chat history.", "Tools describe actions. This is something the vet said earlier today: chat history.", "This is not from Pepper's file. The vet said it in today's conversation, so it lives in the chat history.", ""]
  ];
  function situation({ el, done, kit }) {
    css();
    const ans = SNIPS.map(() => null);
    const paint = () => {
      const all = SNIPS.every(([, r], i) => ans[i] === r);
      el.innerHTML = `<h1>The records helper stops answering</h1>
        <p class="lead">Larch Street Veterinary Clinic (made up for this lesson) has a records helper. A vet asks about a pet; the helper fetches the pet's records and asks a model. To keep each call cheap and quick, its code allows <b>${fmt(D.budget)} tokens per request</b>. That limit includes the room it keeps for the model's answer. Since pet files started to include long lab reports, the helper's code refuses more and more requests as too large. Today it is Pepper, an 11-year-old cat.</p>
        <p class="lead">This lesson is about the <b>context budget</b>: deciding what goes into each request to the model, so it fits the limit and the answer stays right. Every app that sends retrieved documents, tools or chat history to a model has to make this choice.</p>
        <p class="lead">Every request the helper sends is built from several parts. Here are four short pieces of Pepper's request.</p>
        <p class="task">Say which part each piece belongs to.</p>
        ${SNIPS.map(([t, r], i) => `<div class="lcase" id="c${i}"><div class="${P}snip${i === 2 ? " row" : ""}">${kit.esc(t)}</div>${kit.options(SECTIONS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? ["Right: a fixed instruction, sent on every request.", "Right: one of three tool definitions. The model can ask the program to run it.", "Right: one row of a lab report the helper fetched for this request.", "Right: something said earlier in today's chat."][i] : SNIP_WRONG[i][ans[i]], ans[i] === r)}</div>`).join("")}
        ${all ? kit.feedback(`Those are the parts of the request: system prompt, tool definitions, retrieved records, chat history, plus the vet's new question and the room kept for the answer. Each one takes tokens from the same ${fmt(D.budget)}. Next: how much each one takes.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SNIPS.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 2. By hand: the measured parts. How far over is it? */
  function measure({ el, done, kit }) {
    css();
    let ans = null;
    const noAnswer = FULL - D.answerRoom - D.budget, noTools = FULL - D.tools - D.format - D.budget;
    const opts = [noAnswer, OVER, noTools, FULL].map(String);
    const correct = 1;
    const recs = D.items.filter(i => i[3] === "records"), hist = D.items.filter(i => i[3] === "history");
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>Measure every part</h1>
        <p class="lead">We counted each part of Pepper's request with the tokenizer of the model the helper uses, and read the two hidden parts off the API's bill (next screen shows how). The question in this request is: <i>“${kit.esc(QUESTION)}”</i></p>
        <table class="${P}tb"><thead><tr><th>part</th><th class="n">tokens</th></tr></thead><tbody>
          <tr class="sec"><td colspan="2">fixed: sent with every request</td></tr>
          <tr><td>system prompt</td><td class="n">${D.system}</td></tr>
          <tr><td>tool definitions (3 tools)</td><td class="n">${D.tools}</td></tr>
          <tr><td>chat format (marker tokens around each message)</td><td class="n">${D.format}</td></tr>
          <tr class="sec"><td colspan="2">retrieved records</td></tr>
          <tr><td>heading line</td><td class="n">${D.recordsHeading}</td></tr>
          ${recs.map(([, l, t]) => `<tr><td>${kit.esc(l)}</td><td class="n">${fmt(t)}</td></tr>`).join("")}
          <tr class="sec"><td colspan="2">chat history (today)</td></tr>
          ${hist.map(([, l, t]) => `<tr><td>${kit.esc(l)}</td><td class="n">${t}</td></tr>`).join("")}
          <tr class="sec"><td colspan="2">this turn</td></tr>
          <tr><td>the vet's question</td><td class="n">${D.question}</td></tr>
          <tr><td>room kept for the answer (max_tokens)</td><td class="n">${D.answerRoom}</td></tr>
          ${ok ? `<tr class="tot"><td>total</td><td class="n">${fmt(FULL)}</td></tr>` : ""}
        </tbody></table>
        <p class="task">Add every row. How many tokens over the ${fmt(D.budget)} budget is Pepper's request?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct, num: true })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right: ${fmt(FULL)} − ${fmt(D.budget)} = ${OVER}. The two lab reports alone are ${fmt(ITEM.lab2024.t + ITEM.lab2026.t)} tokens, more than half of it. A file with one report would fit; Pepper has two.`, true) + partsBar(barFor(() => true))
          : ans === 0 ? kit.feedback(`${noAnswer} is the input alone. The answer is written inside the same budget, and the helper keeps ${D.answerRoom} tokens for it. Add that row too.`, false)
          : ans === 2 ? kit.feedback(`${noTools} leaves out the tool definitions and the chat format. They are not text you typed, but they are sent and billed on every request: ${D.tools} + ${D.format} more.`, false)
          : kit.feedback(`${fmt(FULL)} is the whole request with its answer room. The question is how far it is past the ${fmt(D.budget)} budget.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. The hidden parts: our text count against the API's bill. */
  function hidden({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Our tokenizer is a different one from the model's, so every count is a little off",
      "The tool definitions and the chat format's marker tokens: sent, but not part of any message's text",
      `The ${D.answerRoom} tokens kept for the answer`,
      "The API adds a fixed fee of tokens to every call"
    ];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>Where do the hidden tokens come from?</h1>
        <p class="lead">A budget is only as good as its counts. We counted the text of every message in Pepper's full request with <b>tiktoken</b>, the tokenizer library for the model family we recorded with. Then we sent the request and read <code>usage.prompt_tokens</code>, the input tokens the API billed.</p>
        <table class="${P}tb"><tbody>
          <tr><td>our count: text of all ${D.messages} messages</td><td class="n">${fmt(D.textTotal)}</td></tr>
          <tr><td>billed by the API: <code>prompt_tokens</code></td><td class="n">${fmt(D.api.full)}</td></tr>
          <tr class="tot"><td>gap</td><td class="n">${HIDDEN}</td></tr></tbody></table>
        <p class="task">What are the ${HIDDEN} tokens our count missed?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. To measure them, we sent the same request a second time without the <code>tools</code> field: it was billed ${fmt(D.api.notools)}. So the three tool definitions cost ${fmt(D.api.full)} − ${fmt(D.api.notools)} = <b>${D.tools}</b> tokens, and the chat format the other ${fmt(D.api.notools)} − ${fmt(D.textTotal)} = <b>${D.format}</b>. With those two numbers, our counts also matched the bill exactly on the other two requests (the cut ones). Tools are easy to forget: OpenAI's docs say function definitions count against the context limit and are billed as input tokens, and Anthropic's docs list tool definitions as part of the context window.`, true)
          : ans === 0 ? kit.feedback(`tiktoken maps this model to its own encoding, and the gap was exactly ${HIDDEN} on all three requests we sent with tools, whether ${fmt(D.api.dropOld)} or ${fmt(D.api.full)} tokens long. A tokenizer mismatch would grow with the text.`, false)
          : ans === 2 ? kit.feedback(`<code>prompt_tokens</code> counts input only. The answer's tokens are reported separately, as <code>completion_tokens</code>.`, false)
          : kit.feedback(`There is no fee in tokens. Something real is sent that is not in any message's text. Look at what the request carries besides <code>messages</code>.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. The team's first fix, cut the records from the end: predict, then read the recorded answer. */
  function cutEnd({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      `This week's values: creatinine ${CREAT_2026} mg/dL, flagged high`,
      "A note that this week's results are not in the records",
      "Values from the 2024 report, presented as this week's",
      "An error, because the lab report was cut in the middle"
    ];
    const got = creat(REC_CUT) === CREAT_2024 ? 2 : creat(REC_CUT) === CREAT_2026 ? 0 : 1;
    const paint = () => {
      const ok = ans === got;
      el.innerHTML = `<h1>The first fix: cut from the end</h1>
        <p class="lead">The team's first fix: keep everything else, and cut the records message token by token from its end until the request fits. The records are stored oldest first, so the end is where the newest report sits. The code kept ${fmt(D.cutKept)} tokens of the records and cut ${D.cutDropped}. This week's report starts at token ${fmt(D.lab2026Start)}. So the cut fell inside this week's report, in its blood count. The chemistry rows with the kidney values come after that, so they were cut. The request now fits exactly: ${fmt(D.api.cutEnd)} input tokens billed + ${D.answerRoom} for the answer = ${fmt(D.api.cutEnd + D.answerRoom)}.</p>
        <p class="task">The vet's question asks for this week's kidney values. What did the model answer?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: got })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Yes. Read it:`, true) + recBlock("A small hosted model answered:", REC_CUT, kit)
            + kit.feedback(`Creatinine ${creat(REC_CUT)} mg/dL is the 2024 value. This week it was ${CREAT_2026}, above the range. The answer says “all values are within the reference ranges” about a cat whose kidney values are flagged high, and nothing errored. The system prompt even said “do not guess”: the model saw a report with kidney values and used it. Nothing told it that a newer one had been cut.`)
          : ans === 0 ? kit.feedback(`Those rows were cut: the cut fell before the chemistry part of this week's report. The model cannot quote what it never received.`, false)
          : ans === 1 ? kit.feedback(`That would be the safe failure, and the system prompt asks for it. But the model still had a lab report with kidney values in it: the 2024 one. Try again.`, false)
          : kit.feedback(`The model never sees “a cut”. It gets plain text that happens to stop early; nothing marks it as incomplete, and the request fits, so nothing errors.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { if (ans === got) return; ans = +b.dataset.i; paint(); if (ans === got) done(); });
    };
    paint();
  }

  /* 5. Spot the idea: what should decide what gets cut? */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Position: cut from the end (or from the start) until it fits",
      `Size: cut the biggest item first, since one cut saves the most`,
      "What this question needs: keep the fixed parts and the answer's room, then fill the rest with the items the question depends on, and leave out the others",
      "The answer's room: lower max_tokens until the input fits"
    ];
    const correct = 2;
    const paint = () => {
      el.innerHTML = `<h1>What should decide the cut?</h1>
        <p class="lead">Cutting from the end fitted the budget and broke the answer. The request still has to lose at least ${OVER} tokens.</p>
        <p class="task">Which rule keeps the answer right?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. A budget is not just a limit; it is a choice of what goes in. Fixed parts stay (without the system prompt and tools the helper stops being the helper, without the question there is nothing to answer). The answer's room stays. The flexible parts, records and history, are ranked by what the question needs, and the lowest go first. You do that next.`, true)
          : ans === 0 ? kit.feedback(`Position is what just failed. Where an item sits says nothing about whether this question needs it: here the newest report sat at the end. Cutting from the start would drop the profile and visit notes first, and still have to cut into a lab report.`, false)
          : ans === 1 ? kit.feedback(`The biggest item is ${kit.esc(BIGGEST[1].toLowerCase())}, ${fmt(BIGGEST[2])} tokens: the one report the question asks about. Size says how much a cut saves, not what it costs the answer.`, false)
          : kit.feedback(`Lowering max_tokens to make the input fit takes the room the answer is written in. A short answer that stops mid-sentence is still a broken answer; the room is part of the budget, not spare.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 6. By hand: choose what to cut so it fits while the answer stays right. */
  function chooseCut({ el, done, kit }) {
    css();
    const cut = new Set();
    let msg = null, bad = null, fin = false;
    const needOk = () => !cut.has("lab2026") && !(cut.has("turn3") && cut.has("turn4"));
    const paint = () => {
      const total = FULL - sum([...cut].map(k => ITEM[k].t));
      const fits = total <= D.budget;
      el.innerHTML = `<h1>Choose what to leave out</h1>
        <p class="lead">The fixed parts and the answer's room are ${fmt(FIXED)} tokens and stay. The vet asks: <i>“${kit.esc(QUESTION)}”</i></p>
        <p class="task">Tap items to leave them out (tap again to put one back) until the request fits ${fmt(D.budget)} and the answer can still be right.</p>
        <div class="${P}cuts">${D.items.map(([k, l, t, s]) => `<button type="button" data-i="${k}" class="${cut.has(k) ? (bad === k ? "bad" : "cut") : ""}" aria-pressed="${cut.has(k)}"><span><small>${s === "records" ? "record" : "chat history"}</small>${kit.esc(l)}</span><b>${fmt(t)}</b></button>`).join("")}</div>
        ${partsBar(barFor(k => !cut.has(k)))}
        <div class="${P}meter">${fmt(total)} of ${fmt(D.budget)}</div>
        <div class="lpanel">${fin ? kit.feedback(msg[0], true) + recBlock("We sent the request without the 2024 report. A small hosted model answered:", REC_DROP, kit)
            + kit.feedback(`Creatinine ${creat(REC_DROP)} mg/dL, the same three values as when we sent everything (we did that once too, over the budget, to have the right answer to compare with: it said creatinine ${creat(REC_FULL)}). The answer stayed right with ${fmt(FULL - (D.api.dropOld + D.answerRoom))} fewer tokens.`)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll(`.${P}cuts button`).forEach(b => b.onclick = () => {
        if (fin) return;
        const k = b.dataset.i;
        bad = null;
        if (cut.has(k)) { cut.delete(k); msg = [`${ITEM[k].l} is back in.`]; paint(); return; }
        cut.add(k);
        const t2 = FULL - sum([...cut].map(x => ITEM[x].t));
        if (k === "lab2026") { bad = k; msg = [`That fits (${fmt(t2)}), but this report is the only place this week's kidney values exist. On screen 4, with this report's kidney rows cut, the model gave the 2024 values as this week's. Put it back.`, false]; }
        else if (cut.has("turn3") && cut.has("turn4")) { bad = k === "turn3" || k === "turn4" ? k : "turn4"; msg = [`The agreement with the owner was made today, in the chat. It is in turn 3 and repeated in turn 4, and nowhere in the records. With both gone the second half of the question has no answer. Put one back.`, false]; }
        else if (!needOk()) { bad = "lab2026"; msg = [`This week's lab report is still left out, and the question needs it. Put it back first.`, false]; }
        else if (t2 <= D.budget) {
          const spare = D.budget - t2, extra = [...cut].filter(x => x !== "lab2024");
          fin = true;
          msg = [`It fits: ${fmt(t2)} of ${fmt(D.budget)}${spare ? `, ${spare} spare` : ""}. ${cut.has("lab2024") ? `The 2024 report was the one big item the question does not need: it asks about this week.` : ""}${extra.length ? ` You also left out ${extra.map(x => ITEM[x].l.split(",")[0].toLowerCase()).join(", ")}, which was not needed to fit; small items that cost little are worth keeping in case they help.` : ""} If the vet asks for a trend next, the helper can fetch the old report again with its <code>get_lab_report</code> tool: leaving something out of one request does not lose it.`];
          paint(); done(); return;
        } else {
          msg = [k === "turn3" || k === "turn4" ? `Fine for the answer: the agreement is still in the other turn. Still ${fmt(t2 - D.budget)} over.` : `${ITEM[k].l} is not needed for this question, so leaving it out is safe. Still ${fmt(t2 - D.budget)} over: small items will not close the gap on their own.`];
        }
        paint();
      });
    };
    paint();
  }

  /* 7. From scratch: the fitter in plain Python, replayed from a traced run. */
  const CODE = [
    "def fit(fixed, items, budget):",
    "    used = sum(fixed.values())",
    "    kept = []",
    "    for name, tokens in items:",
    "        if used + tokens <= budget:",
    "            kept.append(name)",
    "            used += tokens",
    "        else:",
    "            print(\"left out:\", name, tokens)",
    "    return kept, used"
  ];
  const G1 = TRACE.findIndex(s => s.used === TRACE[1].used + ITEM[FIT_ORDER[0]].t);   // used after the first item is added
  const G2 = TRACE.findIndex(s => s.line === 8);                                     // the else branch runs
  function fromScratch({ el, done, kit }) {
    css();
    let i = 0, p1 = null, p2 = null;
    const o1 = [ITEM[FIT_ORDER[0]].t, TRACE[1].used + ITEM[FIT_ORDER[0]].t, D.api.full, TRACE[1].used].map(String);
    const r1 = 1;
    const s2 = TRACE[G2];
    const o2 = ["Kept: there is still room", "Left out, and the loop ends there", "Left out; the loop carries on with the next item"];
    const r2 = 2;
    const say = f => {
      if (f.ev === "r") return `Returned: ${f.kept.length} items kept, ${fmt(f.used)} tokens used, ${fmt(D.budget - f.used)} spare. Only the 2024 report was left out, the one item screen 6 had to leave out, and the code never looked at the question. The order of <code>items</code> did that: it is the team's guess at what questions need (newest lab report first, old reports last). A different question, say a trend since 2024, would need a different order.`;
      if (f.line === 1) return "Start with the fixed parts: they always go in.";
      if (f.line === 2) return `used = ${f.used}: system ${D.system} + tools and chat format ${D.tools + D.format} + question ${D.question} + answer room ${D.answerRoom}.`;
      if (f.line === 3) return f.name ? `Back to the loop for the next item.` : "Walk the flexible items in priority order, most wanted first.";
      if (f.line === 4) return `Next item: ${f.name}, ${fmt(f.tokens)} tokens. Does ${fmt(f.used)} + ${fmt(f.tokens)} = ${fmt(f.used + f.tokens)} fit in ${fmt(D.budget)}?`;
      if (f.line === 5) return `Yes, so keep ${f.name}.`;
      if (f.line === 6) return `Add its ${fmt(f.tokens)} tokens to used.`;
      if (f.line === 8) return `${fmt(f.used)} + ${fmt(f.tokens)} = ${fmt(f.used + f.tokens)}, over ${fmt(D.budget)}: ${f.name} is left out, and the code says so.`;
      if (f.line === 9) return "No items left: return what was kept and the total.";
      return "";
    };
    const paint = () => {
      const f = TRACE[i];
      const gate1 = i === G1 - 1 && p1 !== r1, gate2 = i === G2 - 1 && p2 !== r2;
      const gate = gate1 || gate2;
      el.innerHTML = `<h1>The fitter, from scratch</h1>
        <p class="lead">The same rule in ten lines of plain Python. <code>fixed</code> holds the parts that always go in: ${FIT_FIXED.map(([k, v]) => `${k} ${v}`).join(", ")} (the ${D.recordsHeading}-token records heading is left out to keep the sums short). <code>items</code> are the flexible parts in priority order: ${FIT_ORDER.join(", ")}. Each step replays a real run; the highlighted line runs next.</p>
        <p class="task">Step through to the end. Predict twice when asked.</p>
        ${kit.code(CODE, f.ev === "r" ? -1 : f.line)}
        <div class="vars"><span>used <b>${f.used == null ? "–" : fmt(f.used)}</b></span><span>item <b>${f.name ? `${f.name} (${f.tokens})` : "–"}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        <div class="vars"><span>kept <b>${f.kept ? (f.kept.length ? f.kept.join(", ") : "[ ]") : "–"}</b></span></div>
        <div class="${P}code-out">${f.out ? kit.esc(f.out.replace(/\n$/, "")) : "(nothing printed yet)"}</div>
        ${kit.feedback(say(f))}
        ${gate1 ? `<div id="p1"><p class="task">After this line, what will <code>used</code> be?</p>${kit.options(o1, { picked: p1, correct: r1, num: true })}
          ${p1 == null ? "" : p1 === 0 ? kit.feedback(`${o1[0]} is the item alone. <code>used += tokens</code> adds it to what was already used: the fixed ${TRACE[1].used}.`, false)
            : p1 === 2 ? kit.feedback(`${fmt(D.api.full)} is the whole request as billed. Here only the fixed parts and one item are in so far.`, false)
            : kit.feedback(`${o1[3]} is the value before this line. This line adds the item's ${o1[0]} tokens.`, false)}</div>` : ""}
        ${gate2 ? `<div id="p2"><p class="task">used is ${fmt(s2.used)}, the item is ${s2.name} (${s2.tokens}). What happens to it?</p>${kit.options(o2, { picked: p2, correct: r2 })}
          ${p2 == null ? "" : p2 === 0 ? kit.feedback(`${fmt(s2.used)} + ${s2.tokens} = ${fmt(s2.used + s2.tokens)}, over ${fmt(D.budget)}. It does not fit.`, false)
            : kit.feedback(`It is left out, but there is no <code>break</code>: the loop goes on, so a smaller item later in the list could still fit. Here it happens to be the last item.`, false)}</div>` : ""}
        <div class="lsteps ${P}row2"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || gate ? "disabled" : ""}>Next step</button><button type="button" class="btn" data-jump ${i === TRACE.length - 1 || gate ? "disabled" : ""}>Next item</button></div>`;
      const go = j => { i = j; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => go(i + 1);
      el.querySelector("[data-jump]").onclick = () => {
        let j = i + 1;
        while (j < TRACE.length - 1 && TRACE[j].line !== 4 && j !== G1 - 1 && j !== G2 - 1) j++;
        if ((j > G1 - 1 && i < G1 - 1 && p1 !== r1)) j = G1 - 1;
        if ((j > G2 - 1 && i < G2 - 1 && p2 !== r2)) j = G2 - 1;
        go(j);
      };
      el.querySelectorAll("#p1 .lopts button").forEach(b => b.onclick = () => { p1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#p2 .lopts button").forEach(b => b.onclick = () => { p2 = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  const BIG = [
    ["An agent that answers questions about long contracts: system prompt, a dozen tools, retrieved clauses, and a conversation that runs for an hour.", 0,
      "Right. Many parts, one of them growing every turn. Measure each part, keep the fixed ones and the answer's room, and fill the rest by priority."],
    ["A helper that pulls a customer's entire order history into every request, though most questions are about the last order.", 1,
      "Right. The fix is upstream: fetch the last order, and give the model a tool to fetch older ones when a question needs them. A budget only decides among what was fetched."],
    ["A button that rewrites one product title in a friendlier tone, with a short fixed prompt.", 2,
      "Right. One short request that never grows. Count it once while building it; a per-request fitter would be code with nothing to do."]
  ];
  const BIG_OPTS = ["Budget each part, cut by priority", "Fetch less up front; fetch more with a tool", "No budget code needed"];
  const BIG_WRONG = [
    ["", "Fetching less helps the clauses, but the conversation still grows each turn and the tools are fixed. Something has to rank the parts on every request.", "A long conversation plus clauses and a dozen tools will reach the limit; the only question is when."],
    ["You could rank and cut, but most of what you rank should never have been fetched. Each fetched order costs tokens and the search for it.", "", "A whole order history in every request grows with every order the customer places."],
    ["There is nothing to rank: one short fixed prompt and one title.", "There is nothing to fetch: the title comes with the click.", ""]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to budget the window</h1>
        <p class="lead"><b>What it is for:</b> deciding on purpose what goes into each request, so it fits and the answer still has what it needs.</p>
        <p class="lead"><b>Reach for it</b> when a request is built from several parts and some of them vary: retrieved documents, tool results, chat history, many tools.</p>
        <p class="lead"><b>Not needed</b> for short fixed prompts. And it cannot rescue a request that needs more than any window holds: fetch less, split the work, or summarise (next lessons).</p>
        <p class="lead"><b>Cost:</b> every token is paid on every call and adds waiting time; long contexts are also read less reliably (Anthropic's docs call it context rot). A prompt cache only reuses a start of the request that is exactly the same as before. So put the fixed parts first, and make your cuts in the parts after them.</p>
        <p class="task">Pick the right move for each situation.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : BIG_WRONG[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: is a context budget the fix? One "no". */
  const CASES = [
    ["An agent with 40 tools answers worse and costs more per call than the same agent with the 5 tools a task needs. The task always uses the same 5.", true,
      "Yes. Tool definitions are a fixed part of every request. Sending only the tools this task can use is a budget decision, and it frees room for the rest of the request.",
      "Every tool definition is sent and billed on every call, as you measured. 35 unused tools are a part of the budget that buys nothing."],
    ["A support bot pastes ten retrieved help articles into every request. Most answers use one of them, and long articles push the request over its limit.", true,
      "Yes. Measure the parts, keep the articles the question needs most, and leave out the rest before sending.",
      "Ten articles of very different length, most unused: that is the lab report problem. Rank them and keep what fits."],
    ["A planning agent's requests are a few hundred tokens: a short system prompt, the task and two tools, all of them used. Its plans keep skipping a step that its system prompt clearly asks for.", false,
      "No. Nothing was cut: the request fits, and the instruction reached the model. The problem is how the model follows instructions; test and change the prompt, or check the plan with code.",
      "Nothing unneeded went in and nothing needed was cut, so there is nothing to budget. Cutting or reordering will not make the model follow the instruction."],
    ["A summariser keeps a 3,000-token answer room for summaries that are never longer than 300 tokens, and long documents are refused as too large.", true,
      "Yes. The answer's room is part of the budget. Size it from the real answers, with a margin, and give the rest to the document.",
      "The room kept for the answer counts against the same budget. Ten times more room than the answers ever use is taken from the document."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is a context budget the fix?</h1>
        <p class="lead">Four situations without a clinic. Ask: does something not fit, or did the wrong part go in?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (browser practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>The window is a set of parts</h1>
      <p class="lead">You can now split a request into its parts, measure each one (the hidden ones from the API's own usage), and choose what to leave out by what the question needs.</p>
      <table class="${P}tb"><tbody>
        <tr><td><b>Fixed</b></td><td>System prompt, tool definitions, chat format, the question, the answer's room. Budget these first.</td></tr>
        <tr><td><b>Flexible</b></td><td>Retrieved records and history. Rank them by need, add in order, leave out what does not fit.</td></tr>
        <tr><td><b>Check</b></td><td>Compare your counts with <code>prompt_tokens</code>, and check the answer after a cut, not just the size.</td></tr>
      </tbody></table>
      <p class="lead">Next on this page: a short Python exercise. You write the fitter yourself: given the parts with their token counts, a budget and a priority order, return what goes in and what is left out.</p>
      ${nx ? `<p class="lead">Then: <b>${kit.esc(nx.title)}</b>. Chat history was small here; in a long chat it becomes the part that grows every turn, and that lesson decides what to keep of it.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "What goes in the window: a token budget",
    checked: "2026-11-13",
    sources: [
      "https://developers.openai.com/api/docs/guides/function-calling",
      "https://developers.openai.com/api/docs/guides/prompt-caching",
      "https://platform.claude.com/docs/en/build-with-claude/context-windows",
      "https://openrouter.ai/docs/api-reference/overview",
      "https://github.com/openai/tiktoken/blob/main/tiktoken/model.py"
    ],
    interview: [{
      q: "Your agent's requests started failing the size limit after you added retrieved documents. A teammate proposes cutting the prompt from the end until it fits. What do you say, and what do you build instead?",
      good: [
        "Measure every part first: system prompt, tool definitions, retrieved text, history, question, and the room kept for the answer; tools and chat format show up only in the API's usage",
        "Cutting by position drops whatever happens to be last, often the newest or most relevant document, and the model answers confidently from what is left",
        "Keep the fixed parts and the answer's room, then add flexible items in priority order and leave out what does not fit",
        "Test the answers after the change on real questions, and let the agent fetch left-out items with a tool when it needs them"
      ],
      weak: "Agree to truncate, or move to a model with a bigger window, without measuring the parts or checking that the answer is still right after the cut."
    }, {
      q: "Your token counter says a request is 2,400 tokens but the API bills 2,700 every time. Where would you look?",
      good: [
        "Check that the counter uses the model's own tokenizer",
        "Tool definitions are billed as input but are not message text: measure them by sending once with and once without tools",
        "The chat format adds a few tokens per message",
        "Once the fixed gap is measured, add it to every budget"
      ],
      weak: "Treat the gap as noise or rounding, and keep budgeting from message text only."
    }],
    screens: [situation, measure, hidden, cutEnd, spotIdea, chooseCut, fromScratch, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: SNIPS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="lab2026"]'], right: ['[data-i="lab2026"]', '[data-i="lab2024"]'] },
      { wrong: [...Array(G1 - 1).fill("[data-next]"), "#p1 [data-wrong]"],
        right: ["#p1 [data-right]", ...Array(G2 - G1).fill("[data-next]"), "#p2 [data-right]", ...Array(TRACE.length - G2).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
