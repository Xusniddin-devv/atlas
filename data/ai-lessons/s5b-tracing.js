/* Lesson s5b-tracing: Tracing LLM calls with Langfuse.
   Story: the City Museum's ticket bot answers a group-discount question wrong (and users say slower) since
   the nightly re-index. The learner reads a real trace of the bad answer, finds that the slowest span is not
   the cause, compares with yesterday's trace, learns how @observe builds the span tree, the knobs that matter
   (capture_input/capture_output, flush, usage_details), then debugs a second real trace (a prompt-builder bug).
   Ideas: (1) a trace = one request as a tree of spans with input, output, time and tokens; follow the bad data
   upstream to the first span whose output is wrong; (2) instrumenting with the Langfuse Python SDK.
   Data: docs/ai-path/runs/s5b-tracing/ (app.py instrumented with the real Langfuse SDK, spans kept in memory
   through the SDK's span_exporter option; spans-*.json, extract.out.txt, to_js.out.txt, env.txt).
   Model answers: docs/ai-path/recordings/s5b-tracing/bot-today, bot-yesterday, bot-offbyone (+ bot-*-r2..r6
   repeats used only for the generate durations). Every number on screen is computed here from RUNS and GEN_MS.
   Lesson-local CSS (prefix lx-s5b-tracing-): the trace waterfall, the span detail panel, the duration strip. */
(() => {
  const ID = "s5b-tracing";
  const P = "lx-s5b-tracing-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5b-tracing.ipynb";
  // The notebook replays the recorded responses in docs/ai-path/recordings/s5b-tracing/ (text and usage), so no API key is needed.

  // From docs/ai-path/runs/s5b-tracing/to_js.out.txt (made by to_js.py from the spans the Langfuse SDK produced; texts trimmed with … by the script)
  const RUNS = {"yesterday": {"question": "We are 12 adults coming on Saturday. Do we get a group discount, and how much is it?", "spans": [{"name": "answer_question", "type": "span", "parent": null, "trace": "010d4b8b", "start": 0.0, "dur": 3396.0, "output": "Smaller groups pay the normal price per person. You will not receive a group discount."}, {"name": "retrieve", "type": "retriever", "parent": "answer_question", "trace": "010d4b8b", "start": 0.4, "dur": 0.8, "topK": 4, "indexChunks": "12", "out": [{"source": "groups.md", "score": 6, "chars": 253, "text": "Group tickets: from 1 March 2026, groups of 15 or more people get 20% off the adult price. Smaller groups pay the normal price per person. Book at least 48 hours ahead with th …"}, {"source": "groups.md", "score": 2, "chars": 134, "text": "Group arrival: groups enter by the north door and keep together in the first gallery. Bags larger than a backpack go to the cloakroom."}, {"source": "schools.md", "score": 2, "chars": 198, "text": "School visits: school classes visit free on weekday mornings from 9:00 to 12:00 when a teacher books ahead. One teacher is needed for every 10 pupils. Schools on weekends pay …"}, {"source": "tours.md", "score": 2, "chars": 191, "text": "Guided tours: a guide can lead your group for 60 minutes for 90 euro, on top of the tickets. Tours run in English, German and French. Ask for a tour on the group form at least …"}]}, {"name": "build_prompt", "type": "span", "parent": "answer_question", "trace": "010d4b8b", "start": 1.3, "dur": 0.2, "sources": ["groups.md", "groups.md", "schools.md", "tours.md"], "userChars": 935}, {"name": "generate", "type": "generation", "parent": "answer_question", "trace": "010d4b8b", "start": 1.6, "dur": 3394.2, "model": "google/gemini-2.5-flash-lite", "usage": {"input": 282, "output": 17}, "output": "Smaller groups pay the normal price per person. You will not receive a group discount."}]}, "today": {"question": "We are 12 adults coming on Saturday. Do we get a group discount, and how much is it?", "spans": [{"name": "answer_question", "type": "span", "parent": null, "trace": "3c0412a7", "start": 0.0, "dur": 2182.9, "output": "Yes, you get a group discount. For groups of 10 or more adults, the price is 12.75 per person on Saturdays."}, {"name": "retrieve", "type": "retriever", "parent": "answer_question", "trace": "3c0412a7", "start": 0.5, "dur": 6.3, "topK": 4, "indexChunks": "13", "out": [{"source": "archive/price-list-2024.pdf", "score": 1061, "chars": 28810, "text": "CITY MUSEUM PRICE LIST 2024\nValid 1 January 2024 to 31 December 2024\nGroup discount: groups of 10 or more adults get 15% off the adult price. No booking needed.\nDate | Adult | …"}, {"source": "groups.md", "score": 6, "chars": 253, "text": "Group tickets: from 1 March 2026, groups of 15 or more people get 20% off the adult price. Smaller groups pay the normal price per person. Book at least 48 hours ahead with th …"}, {"source": "groups.md", "score": 2, "chars": 134, "text": "Group arrival: groups enter by the north door and keep together in the first gallery. Bags larger than a backpack go to the cloakroom."}, {"source": "schools.md", "score": 2, "chars": 198, "text": "School visits: school classes visit free on weekday mornings from 9:00 to 12:00 when a teacher books ahead. One teacher is needed for every 10 pupils. Schools on weekends pay …"}]}, {"name": "build_prompt", "type": "span", "parent": "answer_question", "trace": "3c0412a7", "start": 7.0, "dur": 0.5, "sources": ["archive/price-list-2024.pdf", "groups.md", "groups.md", "schools.md"], "userChars": 29573}, {"name": "generate", "type": "generation", "parent": "answer_question", "trace": "3c0412a7", "start": 7.7, "dur": 2174.9, "model": "google/gemini-2.5-flash-lite", "usage": {"input": 15447, "output": 32}, "output": "Yes, you get a group discount. For groups of 10 or more adults, the price is 12.75 per person on Saturdays."}]}, "offbyone": {"question": "We are 12 adults coming on Saturday. Do we get a group discount, and how much is it?", "spans": [{"name": "answer_question", "type": "span", "parent": null, "trace": "eeec6039", "start": 0.0, "dur": 1883.8, "output": "The context does not mention a group discount for Saturdays. Schools on weekends pay the normal group price."}, {"name": "retrieve", "type": "retriever", "parent": "answer_question", "trace": "eeec6039", "start": 0.3, "dur": 0.6, "topK": 4, "indexChunks": "12", "out": [{"source": "groups.md", "score": 6, "chars": 253, "text": "Group tickets: from 1 March 2026, groups of 15 or more people get 20% off the adult price. Smaller groups pay the normal price per person. Book at least 48 hours ahead with th …"}, {"source": "groups.md", "score": 2, "chars": 134, "text": "Group arrival: groups enter by the north door and keep together in the first gallery. Bags larger than a backpack go to the cloakroom."}, {"source": "schools.md", "score": 2, "chars": 198, "text": "School visits: school classes visit free on weekday mornings from 9:00 to 12:00 when a teacher books ahead. One teacher is needed for every 10 pupils. Schools on weekends pay …"}, {"source": "tours.md", "score": 2, "chars": 191, "text": "Guided tours: a guide can lead your group for 60 minutes for 90 euro, on top of the tickets. Tours run in English, German and French. Ask for a tour on the group form at least …"}]}, {"name": "build_prompt", "type": "span", "parent": "answer_question", "trace": "eeec6039", "start": 1.0, "dur": 0.1, "sources": ["groups.md", "schools.md", "tours.md"], "userChars": 668}, {"name": "generate", "type": "generation", "parent": "answer_question", "trace": "eeec6039", "start": 1.3, "dur": 1882.3, "model": "google/gemini-2.5-flash-lite", "usage": {"input": 207, "output": 20}, "output": "The context does not mention a group discount for Saturdays. Schools on weekends pay the normal group price."}]}};
  // generate span duration_ms in six runs each (spans-yesterday*.json, spans-today*.json; wall time on our Mac, recorder start-up included)
  const GEN_MS = { yesterday: [1687.6, 3554.9, 1372.2, 1732.0, 1955.9, 3394.2], today: [1783.8, 2333.9, 3787.3, 2498.0, 1794.0, 2174.9] };

  // From docs/ai-path/recordings/s5b-tracing/bot-*.json (the answers, not altered)
  const REC_TODAY = { src: "s5b-tracing/bot-today", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "Yes, you get a group discount. For groups of 10 or more adults, the price is 12.75 per person on Saturdays." };
  const REC_YESTERDAY = { src: "s5b-tracing/bot-yesterday", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "Smaller groups pay the normal price per person. You will not receive a group discount." };
  const REC_OFFBYONE = { src: "s5b-tracing/bot-offbyone", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "The context does not mention a group discount for Saturdays. Schools on weekends pay the normal group price." };

  // the current group rule, from docs/ai-path/runs/s5b-tracing/museum_docs.py (groups.md)
  const GROUP_RULE = "Group tickets: from 1 March 2026, groups of 15 or more people get 20% off the adult price. Smaller groups pay the normal price per person.";
  // the bug line, from docs/ai-path/runs/s5b-tracing/app.py (build_prompt, inside the offbyone switch)
  const BUG_LINE = "chunks = chunks[1:]";  // trimmed: the comment after it is cut

  const fmt = n => Math.round(n).toLocaleString("en");
  const ms = n => n < 10 ? `${n.toFixed(1)} ms` : `${fmt(n)} ms`;
  const span = (run, name) => RUNS[run].spans.find(s => s.name === name);
  const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length / 2; return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2; };
  const caption = rec => `<span class="${P}cap">Recorded model output, ${rec.recordedAt}</span>`;

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}tree { margin-top: 16px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
.${P}tree .${P}cap { padding: 8px 12px 0; }
.${P}row { display: block; width: 100%; min-height: 48px; padding: 8px 12px; border: 0; border-top: 1px solid var(--line); background: transparent; color: var(--ink); font: inherit; text-align: left; }
.${P}row:first-of-type { border-top: 0; }
button.${P}row { cursor: pointer; }
button.${P}row:hover { background: var(--sunk); }
.${P}row.sel { box-shadow: inset 3px 0 0 var(--ink); background: var(--sunk); }
.${P}row.no { box-shadow: inset 3px 0 0 var(--bad); background: var(--bad-soft); }
.${P}row.ok { box-shadow: inset 3px 0 0 var(--good); background: var(--good-soft); }
.${P}head { display: flex; gap: 8px; align-items: baseline; font: 600 15px var(--mono); }
.${P}head .n { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.${P}head .t { font: 500 12px var(--mono); color: var(--muted); }
.${P}head .d { font: 600 14px var(--mono); white-space: nowrap; }
.${P}kid .${P}head .n::before { content: "└ "; color: var(--muted); }
.${P}kid { padding-left: 26px; }
.${P}track { display: block; position: relative; height: 8px; margin-top: 6px; background: var(--sunk); border-radius: 2px; }
.${P}track u { position: absolute; top: 0; bottom: 0; min-width: 3px; background: var(--ink-2); border-radius: 2px; }
.${P}cap { display: block; font: 500 12px var(--mono); color: var(--muted); margin-top: 6px; }
.${P}detail { margin-top: 12px; border: 1px solid var(--line); border-radius: var(--r); padding: 12px; background: var(--bg); }
.${P}detail h3 { margin: 0 0 6px; font: 700 15px var(--mono); }
.${P}kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; font-size: 15px; }
.${P}kv dt { font: 600 13px var(--mono); color: var(--muted); padding-top: 2px; }
.${P}kv dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.${P}chunk { margin: 6px 0 0; padding: 6px 8px; border-left: 2px solid var(--line); font: 500 13px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}chunk b { font-weight: 700; }
.${P}say { margin-top: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
.${P}say .q { font-weight: 600; }
.${P}say .a { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line); }
.${P}log { margin-top: 12px; padding: 10px 12px; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); font: 500 13px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}strip { margin-top: 14px; }
.${P}srow { display: grid; grid-template-columns: 84px 1fr; align-items: center; gap: 8px; margin-top: 10px; font: 600 13px var(--mono); }
.${P}axis { position: relative; height: 30px; border-bottom: 1px solid var(--line); }
.${P}axis i { position: absolute; bottom: 4px; width: 12px; height: 12px; margin-left: -6px; border: 2px solid var(--ink); border-radius: 50%; background: var(--bg); }
.${P}axis s { position: absolute; bottom: 0; top: 0; width: 0; border-left: 2px solid var(--ink); text-decoration: none; }
.${P}ticks { display: flex; justify-content: space-between; margin-left: 92px; font: 500 12px var(--mono); color: var(--muted); }
.${P}blame { margin-top: 10px; }
.${P}knob .lopts button { overflow-wrap: anywhere; max-width: 100%; }
@media (max-width: 560px) { .${P}kv { grid-template-columns: 1fr; gap: 0; } .${P}kv dd { margin-bottom: 6px; } }
.${P}blame .btn { min-height: 48px; }
.${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
.${P}checks { list-style: none; padding: 0; margin: 12px 0 0; }
.${P}checks li { margin-top: 8px; }
.${P}checks label { position: relative; display: block; min-height: 44px; padding: 2px 0 2px 34px; cursor: pointer; }
.${P}checks input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.${P}checks label span::before { content: ""; position: absolute; left: 0; top: 3px; width: 20px; height: 20px; border: 2px solid var(--ink-2); border-radius: 4px; background: var(--bg); }
.${P}checks input:checked + span::before { background: var(--ink); box-shadow: inset 0 0 0 3px var(--bg); }
.${P}checks input:focus-visible + span::before { outline: 2px solid var(--ink); outline-offset: 2px; }
`;
    document.head.appendChild(s);
  }

  /* The trace as a waterfall: one row per span, children indented, a bar for when it ran.
     opts: pick (rows are buttons with data-i=name), sel (selected name), mark {name: "no"|"ok"}, upto (show only the first n spans), title,
     open (name of a span still running: no duration or bar yet) */
  function tree(kit, run, { pick = false, sel = null, mark = {}, upto = null, title = "", open = null } = {}) {
    const all = RUNS[run].spans, root = all[0], total = root.dur;
    const spans = upto == null ? all : all.slice(0, upto);
    const row = s => {
      const tag = pick ? "button" : "div";
      const cls = [P + "row", s.parent ? P + "kid" : "", mark[s.name] || (sel === s.name ? "sel" : "")].join(" ");
      return `<${tag} ${pick ? 'type="button"' : ""} class="${cls}" data-i="${kit.esc(s.name)}"${pick ? ` aria-pressed="${sel === s.name}"` : ""}>
        <span class="${P}head"><span class="n">${kit.esc(s.name)}</span><span class="t">${kit.esc(s.type)}</span><span class="d">${open === s.name ? "still open" : ms(s.dur)}</span></span>
        <span class="${P}track">${open === s.name ? "" : `<u style="left:${s.start / total * 100}%;width:${s.dur / total * 100}%"></u>`}</span></${tag}>`;
    };
    return `<div class="${P}tree">${title ? `<span class="${P}cap">${title}</span>` : ""}${spans.map(row).join("")}</div>`;
  }

  /* What a span's detail view holds, from the run data. */
  function detail(kit, run, name) {
    const s = span(run, name);
    if (!s) return "";
    const kv = rows => `<dl class="${P}kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
    const q = kit.esc(RUNS[run].question);
    let rows = [["type", kit.esc(s.type)], ["started", ms(s.start)], ["took", ms(s.dur)]];
    if (name === "answer_question") rows = rows.concat([["input", `“${q}”`], ["output", `“${kit.esc(s.output)}”`]]);
    if (name === "retrieve") rows = rows.concat([["input", `question, top_k = ${s.topK}`], ["metadata", `index_chunks = ${kit.esc(s.indexChunks)}`],
      ["output", `${s.out.length} chunks:${s.out.map((c, i) => `<div class="${P}chunk"><b>${i + 1}. ${kit.esc(c.source)}</b>  score ${fmt(c.score)} · ${fmt(c.chars)} characters\n${kit.esc(c.text)}</div>`).join("")}`]]);
    if (name === "build_prompt") rows = rows.concat([["input", `question, the ${span(run, "retrieve").out.length} chunks from retrieve`],
      ["output", `a system message and a user message of ${fmt(s.userChars)} characters, holding ${s.sources.length} chunks: ${s.sources.map(x => `<b>${kit.esc(x)}</b>`).join(", ")}`]]);
    if (name === "generate") rows = rows.concat([["input", "the two messages from build_prompt"], ["model", "a small hosted model"],
      ["usage", `input ${fmt(s.usage.input)} tokens · output ${fmt(s.usage.output)} tokens`], ["output", `“${kit.esc(s.output)}”`]]);
    return `<div class="${P}detail"><h3>${kit.esc(name)}</h3>${kv(rows)}</div>`;
  }

  const timesNote = `<span class="${P}cap">Times are real elapsed time on our machine. The generate step includes our recording tool's start-up, not only the model.</span>`;

  /* 1. The situation: the log has the outside of the request, not the steps. */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const root = span("today", "answer_question");
    const opts = ["Is today's answer wrong?", "How long did the whole request take?", "Which step inside the bot made it wrong: finding pages, building the prompt, or the model?"];
    const correct = 2;
    const paint = () => {
      el.innerHTML = `<h1>The museum bot got slow and wrong overnight</h1>
        <p class="lead">The City Museum has a ticket bot on its website. It finds help pages that match a visitor's question, puts them in a prompt, and asks a model to answer. Since last night, staff say it answers group-discount questions wrong, and visitors say it feels slower.</p>
        <div class="${P}say"><div class="q">Visitor: ${kit.esc(RUNS.today.question)}</div><div class="a">Bot: ${kit.esc(REC_TODAY.text)}</div>${caption(REC_TODAY)}</div>
        <p class="lead">The help page says: <i>${kit.esc(GROUP_RULE)}</i> All the team has is the app's log: one line per request, like this one (filled in with this request's numbers):</p>
        <div class="${P}log">answer_question  ${fmt(root.dur)} ms  answer="${kit.esc(REC_TODAY.text.slice(0, 32))}…"</div>
        <p class="task">Which question can this log line <b>not</b> answer?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. The log sees the request from outside: what came in, what went out, how long it took. The bot has several steps inside, and any of them could be the broken one. To find it you need a record of every step of this one request: what went into it, what came out, and how long it took.", true)
          : ans === 0 ? kit.feedback("The log already answers that. It shows the bot's answer, and the help page says groups need 15 or more people. 12 adults get no discount, so the answer is wrong. What the log cannot tell you is <i>why</i>.", false)
          : kit.feedback(`The log already answers that: ${fmt(root.dur)} ms for the whole request. What it cannot tell you is where inside the request that time went, or which step produced the wrong fact.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. Diagnose real material: read the trace of the bad answer and blame one step. */
  function readTrace({ el, done, kit }) {
    style();
    let sel = null, blamed = null;
    const ret = span("today", "retrieve"), gen = span("today", "generate");
    const fb = {
      answer_question: "That row is the whole request. Its time and its answer are just what its steps produced. Open the steps under it and find the first one whose output is already wrong.",
      build_prompt: `build_prompt only joined what it was given. Its output holds the same ${ret.out.length} chunks that retrieve returned, in the same order. The wrong fact was already there before it ran.`,
      generate: `Partly fair: the model picked the old rule, although the current page was in its prompt too. But look at what it was handed first: a ${fmt(ret.out[0].chars)}-character price list from 2024. The step that brought that list in sits above it.`,
      retrieve: `Right. retrieve's first chunk is <b>${kit.esc(ret.out[0].source)}</b>: ${fmt(ret.out[0].chars)} characters with the 2024 rule “groups of 10 or more … 15% off”, scored ${fmt(ret.out[0].score)} against ${fmt(ret.out[1].score)} for the current page (a higher score means retrieve judged it a better match). Every step after it carried that list along. The model's answer, 12.75 per person on Saturdays, is the 2024 Saturday group price.`
    };
    const paint = () => {
      const mark = {};
      if (blamed) mark[blamed] = blamed === "retrieve" ? "ok" : "no";
      el.innerHTML = `<h1>Open the steps of one bad answer</h1>
        <p class="lead">The team turned on tracing: now the bot saves a record of every step of each request, so they can see which step went wrong. Below is the record of the bad answer from screen 1. Each row is one step; steps under the top row ran inside it. The small word is the step's type, and the number is how long it took. The bar shows when each step ran within the whole request.</p>
        <p class="task">Tap the rows to open them. Then mark the step that made the answer wrong.</p>
        ${tree(kit, "today", { pick: blamed !== "retrieve", sel, mark })}
        ${timesNote}
        ${sel ? detail(kit, "today", sel) : ""}
        ${sel && blamed !== "retrieve" ? `<div class="${P}blame"><button type="button" class="btn" data-blame>This step made the answer wrong</button></div>` : ""}
        <div class="lpanel">${blamed ? kit.feedback(fb[blamed] + (blamed === "retrieve" ? ` What you just read is a <b>trace</b>: the record of one request. Each row is a <b>span</b>, one step with its input, output and time. Langfuse calls every row an <b>observation</b>, and gives it a type such as retriever or generation.` : ""), blamed === "retrieve") : ""}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => { sel = b.dataset.i; paint(); });
      const bl = el.querySelector("[data-blame]");
      if (bl) bl.onclick = () => { blamed = sel; paint(); if (blamed === "retrieve") done(); };
    };
    paint();
  }

  /* 3. Spot the idea: the slow span is not the cause. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const root = span("today", "answer_question"), gen = span("today", "generate"), ret = span("today", "retrieve");
    const share = Math.round(gen.dur / root.dur * 1000) / 10;
    const opts = ["Agree: generate is where the time goes, so a faster model fixes the slowness", "The time sits in generate, but the cause is upstream: retrieve handed it a huge old document", "A trace cannot tell. Run the question twenty more times and compare the answers"];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>The slow step is not always the broken step</h1>
        <p class="lead">In the trace, generate took ${ms(gen.dur)} of the ${ms(root.dur)} request: ${share}%. Its input was ${fmt(gen.usage.input)} tokens. A teammate says: “The model is the slow part. Let's switch to a faster model.”</p>
        ${tree(kit, "today")}
        <p class="task">What does the trace say about that plan?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Time shows <i>where</i> the work happened; inputs and outputs show <i>why</i>. generate is wrong because of what it was given: ${fmt(gen.usage.input)} tokens, most of them the 2024 price list. A faster model would still read that list, and could still quote it. So read a trace by following the bad data back through the steps before it, to the first span whose output is already wrong. Here that is retrieve.`, true)
          : ans === 0 ? kit.feedback(`The time does sit in generate, but look at its input: ${fmt(gen.usage.input)} tokens, because retrieve put a ${fmt(ret.out[0].chars)}-character 2024 price list in the prompt. A faster model still gets the old rule first, so the answer can stay wrong, and you still pay for all those tokens.`, false)
          : kit.feedback("Rerunning gives the same pages from the same index, so you would see the same mistake twenty times. The trace already holds what you need: the input and output of every step of this request.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Predict with yesterday's trace: the token count. */
  function yesterday({ el, done, kit }) {
    style();
    let ans = null;
    const gT = span("today", "generate"), gY = span("yesterday", "generate"), rT = span("today", "retrieve"), rY = span("yesterday", "retrieve");
    const ratio = Math.round(gT.usage.input / gY.usage.input);
    const opts = [`About the same, around ${fmt(Math.round(gT.usage.input / 1000) * 1000)}`, `About half, around ${fmt(Math.round(gT.usage.input / 2 / 100) * 100)}`, `About ${ratio} times fewer`];
    const correct = 2;
    const paint = () => {
      el.innerHTML = `<h1>Compare with yesterday's trace</h1>
        <p class="lead">Every night a job re-indexes the help pages: it reloads them into the search index that retrieve reads. Traces are kept, so you can open one from yesterday, before last night's re-index, for the same question. Today's generate step read <b>${fmt(gT.usage.input)}</b> input tokens. Yesterday the code, the prompt and the model were the same.</p>
        <p class="task">Predict: how many input tokens did yesterday's generate step read?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right: ${fmt(gY.usage.input)} tokens yesterday against ${fmt(gT.usage.input)} today, about ${ratio} times fewer. index_chunks in the retrieve span is the number of chunks in the index: ${kit.esc(rY.indexChunks)} yesterday, ${kit.esc(rT.indexChunks)} today. One new chunk entered the index last night: the old price list PDF, which the nightly job read from the archive folder and kept as one huge chunk. The fix: keep the archive folder out of the nightly job (or split such a file into small chunks), and add a test that fails when any indexed chunk is over a size limit. Yesterday's answer was right:`, true)
          : ans === 0 ? kit.feedback("Same code, same prompt and same model, but not the same input. Most of today's tokens came from one chunk that retrieve returns only since last night. Without it the prompt is far smaller.", false)
          : kit.feedback(`Half would mean yesterday's prompt also carried a big chunk. Today's one 2024 price list is ${fmt(rT.out[0].chars)} characters; the four help-page chunks yesterday were a few hundred each.`, false)}
        ${ans === correct ? `<div class="${P}say"><div class="q">Visitor: ${kit.esc(RUNS.yesterday.question)}</div><div class="a">Bot (yesterday): ${kit.esc(REC_YESTERDAY.text)}</div>${caption(REC_YESTERDAY)}</div>
          ${tree(kit, "yesterday", { title: "yesterday's trace" })}${detail(kit, "yesterday", "retrieve")}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Is it slower? One trace's time is noisy; compare many. */
  function slower({ el, done, kit }) {
    style();
    let ans = null;
    const gT = span("today", "generate"), gY = span("yesterday", "generate");
    const mY = median(GEN_MS.yesterday), mT = median(GEN_MS.today);
    const ratio = Math.round(gT.usage.input / gY.usage.input);
    const max = Math.ceil(Math.max(...GEN_MS.yesterday, ...GEN_MS.today) / 1000) * 1000;
    const strip = (label, xs, m) => `<div class="${P}srow"><span>${label}</span><div class="${P}axis">${xs.map(x => `<i style="left:${x / max * 100}%" title="${ms(x)}"></i>`).join("")}<s style="left:${m / max * 100}%"></s></div></div>`;
    const ticks = Array.from({ length: max / 1000 + 1 }, (_, i) => `<span>${i}s</span>`).join("");
    const opts = [`Yes, about ${ratio} times slower, like the tokens`, "No. Yesterday's trace took longer, so the new document did not slow anything", `Can't tell from six runs: the medians are ${fmt(mY)} and ${fmt(mT)} ms, but the runs overlap a lot. The clear change is the token count`];
    const correct = 2;
    const paint = () => {
      el.innerHTML = `<h1>Is it really slower?</h1>
        <p class="lead">Visitors said “slower”. Yesterday's generate span took <b>${ms(gY.dur)}</b>; today's took <b>${ms(gT.dur)}</b>. We ran each version six times and kept every generate span. Each ring below is one run; the line is the median: half the runs are faster, half slower.</p>
        <div class="${P}strip">${strip("yesterday", GEN_MS.yesterday, mY)}${strip("today", GEN_MS.today, mT)}<div class="${P}ticks">${ticks}</div></div>
        ${timesNote}
        <p class="task">What can you honestly say about speed?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The medians differ by about ${fmt(mT - mY)} ms, well inside the spread: the runs go from ${fmt(Math.min(...GEN_MS.yesterday, ...GEN_MS.today))} to ${fmt(Math.max(...GEN_MS.yesterday, ...GEN_MS.today))} ms, so one trace's time says little. For speed, look at the median and the slow tail (the slowest few requests) over many traces. The steady signal is the token count: ${ratio} times more input on every request, which you pay for on every call.`, true)
          : ans === 0 ? kit.feedback(`Tokens grew about ${ratio} times, time did not: the medians are ${fmt(mY)} and ${fmt(mT)} ms. A longer prompt can take a model longer to read, but here any change is lost in the spread between runs. Do not turn a token ratio into a time ratio.`, false)
          : kit.feedback(`That compares one trace with one trace. Yesterday's ${ms(gY.dur)} was one of its slowest runs; across six runs each the medians are ${fmt(mY)} and ${fmt(mT)} ms, and the runs overlap a lot. One trace's time is noisy, and six runs are too few to call a small difference.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 6. The same trace in Python: @observe builds the tree. Steps replay the real run's spans. */
  const CODE = [
    "@observe()",
    "def answer_question(question):",
    "    chunks = retrieve(question, top_k=4)",
    "    prompt = build_prompt(question, chunks)",
    "    return generate(prompt)",
    "",
    "@observe(as_type=\"retriever\")",
    "def retrieve(question, top_k): ...",
    "@observe()",
    "def build_prompt(question, chunks): ...",
    "@observe(as_type=\"generation\")",
    "def generate(prompt): ..."
  ];
  function inPython({ el, done, kit }) {
    style();
    const S = RUNS.today.spans, by = n => S.find(s => s.name === n), sameTrace = S.every(s => s.trace === S[0].trace);
    const steps = [
      { ln: 1, upto: 1, say: `answer_question is called. The decorator opens a span named after the function, at ${ms(by("answer_question").start)}, and makes it the current span. Its input is the question.` },
      { ln: 2, upto: 2, say: `retrieve is called while answer_question's span is still open, so its span becomes a child. It closes after ${ms(by("retrieve").dur)}; its return value, the ${by("retrieve").out.length} chunks, is stored as its output.` },
      { ln: 3, upto: 3, say: `build_prompt: another child, ${ms(by("build_prompt").dur)}. Input: the question and the chunks. Output: the messages.` },
      { ln: 4, upto: 4, say: `generate is marked as_type="generation", so it can also carry a model name and token usage. Inside it, one SDK call records them (screen 7 shows it): input ${fmt(by("generate").usage.input)} tokens. It took ${ms(by("generate").dur)}.` },
      { ln: 4, upto: 4, end: true, say: `answer_question returns, and its span closes at ${ms(by("answer_question").dur)}. The SDK sends the spans in the background in batches, so the bot does not wait for them.` }
    ];
    let i = -1, ans = null;
    const opts = ["Both functions are in the same file", "generate is called while answer_question's span is still open, and new spans attach to the current span", "as_type=\"generation\" links a span to the span before it"];
    const correct = 1;
    const paint = () => {
      const f = i < 0 ? { ln: -1, upto: 0, say: "Nothing has run yet. Press Next step." } : steps[i];
      const last = i === steps.length - 1;
      el.innerHTML = `<h1>The same trace, from Python</h1>
        <p class="lead">This is the museum bot's code with the Langfuse Python SDK. <code>@observe()</code> turns a function call into a span. Bodies are cut to <code>...</code> here. We ran it on our machine with the real SDK, and kept the spans in memory instead of sending them to a Langfuse server; the tree below is what it produced.</p>
        <p class="task">Step through the run. Then answer the question below.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i < 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        ${f.upto ? tree(kit, "today", { upto: f.upto, open: f.end ? null : "answer_question", title: sameTrace ? `trace id ${kit.esc(S[0].trace)}… (first 8 characters), the same on every span` : "" }) : ""}
        ${kit.feedback(f.say)}
        ${last ? `<div class="lpanel"><p class="lead"><b>Why is generate a child of answer_question, and not a trace of its own?</b></p>${kit.options(opts, { picked: ans, correct })}
          ${ans == null ? "" : ans === correct
            ? kit.feedback(`Right. The SDK is built on OpenTelemetry, an open standard for tracing. It keeps the current span in the running code's context (per thread or async task). A span opened while another is current becomes its child and shares its trace id. All ${S.length} spans here carry the same trace id, shown above the tree. Call generate on its own, outside answer_question, and it starts a new trace.`, true)
            : ans === 0 ? kit.feedback("Where the code lives does not matter. Call generate from a script on its own and it becomes its own trace, wherever it is defined. What counts is what is running when it is called.", false)
            : kit.feedback("as_type only sets what kind of step this is (generation, retriever, tool, ...), which lets it carry model and token fields. It says nothing about the parent. The parent is whatever span is open when the function is called.", false)}</div>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. The knobs that matter: capture_output, flush, usage_details. */
  function knobs({ el, done, kit }) {
    style();
    const ret = span("today", "retrieve");
    const QS = [
      { q: `The retrieve span stores every chunk it returns. Today that is ${fmt(ret.out.reduce((a, c) => a + c.chars, 0))} characters per request, and the team plans to index booking notes that hold visitors' names. What do you change on <code>retrieve</code>?`,
        opts: ["@observe(as_type=\"retriever\", capture_output=False), then store a short summary yourself", "Call langfuse.flush() at the end of retrieve", "Change as_type to \"span\""], correct: 0,
        right: "Right. capture_output=False (and capture_input=False) stop the decorator from storing the return value or the arguments. You can still record what you need, such as the sources and scores, with langfuse.update_current_span(output=...). For data you must keep but hide, the SDK also has masking hooks: functions you write that hide sensitive text before anything leaves your app. The same chunk text also flows into build_prompt's output and generate's input, so switch capture off there too, or mask it.",
        wrong: ["flush() sends what is buffered sooner. It does not change what is stored, so the names would still be sent.", "The type only changes how the span is labelled. The output is still captured in full."] },
      { q: "A nightly script asks the bot the 40 golden-set questions and exits. Some nights, the last traces never arrive. What is missing?",
        opts: ["capture_input=False on answer_question", "langfuse.flush() before the script exits", "A bigger top_k"], correct: 1,
        right: "Right. The SDK queues spans and sends them in the background. A short-lived script can exit before the queue is empty, so call langfuse.flush() at the end. A long-running web server does not need it on every request.",
        wrong: ["That would store less, not send more. The traces go missing because the process ends before the queue is sent.", "top_k changes what retrieve returns. It has nothing to do with whether traces are sent."] },
      { q: "In the trace, the generate span shows its output but no token counts, so the team cannot see what each answer costs. What do you add inside <code>generate</code>?",
        opts: ["@observe(capture_output=True)", "A second @observe() above the first one", "langfuse.update_current_generation(model=..., usage_details={\"input\": ..., \"output\": ...})"], correct: 2,
        right: "Right. Our generate does exactly this with the counts the model API returned. Given a model name and usage, Langfuse can also work out a cost from its price definition for that model; you can send cost_details yourself instead.",
        wrong: ["Output is already captured. Token counts are not in the function's return value; you have to hand them over.", "A second decorator would make a second, nested span. It would still not know the token counts."] }
    ];
    const picked = QS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Three settings you will actually touch</h1>
        <p class="lead">The decorator stores every function's arguments as input and its return value as output, by default. That is what made screen 2 readable. It is also what you must control.</p>
        <p class="task">Pick the change for each problem.</p>
        ${QS.map((x, k) => `<div id="c${k}" class="lpanel ${P}knob"><p class="lead"><b>${k + 1}.</b> ${x.q}</p>${kit.options(x.opts.map(kit.esc), { picked: picked[k], correct: x.correct })}
          ${picked[k] == null ? "" : picked[k] === x.correct ? kit.feedback(x.right, true) : kit.feedback(x.wrong[[0, 1, 2].filter(j => j !== x.correct).indexOf(picked[k])], false)}</div>`).join("")}`;
      QS.forEach((x, k) => el.querySelectorAll(`#c${k} .lopts button`).forEach(b => b.onclick = () => {
        picked[k] = +b.dataset.i; paint();
        if (QS.every((y, j) => picked[j] === y.correct)) done();
      }));
    };
    paint();
  }

  /* 8. Broken on purpose: a second real trace, wrong for a different reason. */
  function broken({ el, done, kit }) {
    style();
    let sel = null, blamed = null, fix = null;
    const ret = span("offbyone", "retrieve"), bp = span("offbyone", "build_prompt"), gen = span("offbyone", "generate");
    const lost = ret.out[0];
    const fb = {
      answer_question: "That is the whole request; its answer is whatever its steps produced. Open the steps and compare each one's input with its output.",
      retrieve: `retrieve did its job: its first chunk is <b>${kit.esc(lost.source)}</b> with “groups of 15 or more people get 20% off”, the right page, scored ${fmt(lost.score)}. So the rule got lost in a later step.`,
      generate: `generate said the context does not mention a group discount. For what it received, that is true: open build_prompt and count the chunks it passed on. The prompt tells it to use only the context, and it did.`,
      build_prompt: `Right. retrieve returned ${ret.out.length} chunks with the group rule first; build_prompt's output holds only ${bp.sources.length}, and the group rule is the one missing. The data went wrong inside build_prompt. This is the line we put in for this run:`
    };
    const fixOpts = ["Raise top_k from 4 to 8", "Remove the chunks[1:] slice, and add a test that the first chunk reaches the prompt", "Add “read the context carefully” to the system prompt"];
    const fixRight = 1;
    const fixFb = [
      "chunks[1:] would still drop the first chunk, and the first chunk is always the best match. More chunks only add noise around the hole.",
      "",
      "The model never saw the group rule; it was cut before the prompt was built. No instruction can make it read a chunk that is not there."
    ];
    const paint = () => {
      const mark = {};
      if (blamed) mark[blamed] = blamed === "build_prompt" ? "ok" : "no";
      const found = blamed === "build_prompt";
      el.innerHTML = `<h1>Broken on purpose: a second wrong answer</h1>
        <p class="lead">A week later, after a small code change, the same question gets a different wrong answer. The index is back to yesterday's ${kit.esc(ret.indexChunks)} chunks; the PDF is gone.</p>
        <div class="${P}say"><div class="q">Visitor: ${kit.esc(RUNS.offbyone.question)}</div><div class="a">Bot: ${kit.esc(REC_OFFBYONE.text)}</div>${caption(REC_OFFBYONE)}</div>
        <p class="task">Open the spans and mark the one where the right information got lost. Then pick the fix.</p>
        ${tree(kit, "offbyone", { pick: !found, sel, mark })}
        ${sel ? detail(kit, "offbyone", sel) : ""}
        ${sel && !found ? `<div class="${P}blame"><button type="button" class="btn" data-blame>The information got lost here</button></div>` : ""}
        <div class="lpanel">${blamed ? kit.feedback(fb[blamed], found) : ""}
        ${found ? `${kit.code([BUG_LINE], 0)}<div id="fix" style="margin-top:14px"><p class="lead"><b>Which fix?</b></p>${kit.options(fixOpts.map(kit.esc), { picked: fix, correct: fixRight })}
          ${fix == null ? "" : fix === fixRight ? kit.feedback("Right. The slice was meant to skip a header row, but the chunks have no header, so it threw away the best match. A small test on build_prompt's output (does the top chunk appear in the prompt?) catches this before a visitor does.", true) : kit.feedback(fixFb[fix], false)}</div>` : ""}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => { sel = b.dataset.i; paint(); });
      const bl = el.querySelector("[data-blame]");
      if (bl) bl.onclick = () => { blamed = sel; paint(); };
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === fixRight) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "A student's one-file script that sends one prompt to a model and prints the reply",
      "A hotel's booking assistant in production: it looks up rooms, checks prices with a tool, then writes the answer; a guest complains about one quote",
      "A team deciding whether prompt version B scores better than A on their 60 golden questions"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>When tracing is worth it</h1>
        <p class="lead"><b>What it is for:</b> seeing inside single requests of an app with several steps (retrieval, prompts, tools, agent turns): each step's input, output, time and tokens.</p>
        <p class="lead"><b>Reach for it</b> when the app runs for real users and you must explain one bad answer, or watch cost and speed across many requests.</p>
        <p class="lead"><b>Not for:</b> deciding whether a change is better; that is your golden set and regression tests. A one-call script needs only a print.</p>
        <p class="lead"><b>What it costs:</b> visitors' messages and documents are stored in another system, so mask them or switch capture off where needed. Storage grows with traffic, so at high volume keep only a sample of traces. And there is a service to run or pay for; Langfuse is open source and can be self-hosted.</p>
        <p class="task">Which situation calls for tracing first?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. Several steps, real users and one complaint you must explain: open that guest's trace and read the lookup, the tool call and the prompt in order.", true)
          : ans === 0 ? kit.feedback("One call and one reply: there are no steps to tell apart. Printing the prompt, the reply and the token counts gives the same information without a tracing service.", false)
          : kit.feedback("Tracing records what happened in each request; it does not score them. Comparing A and B is an eval run on the golden set. Traces can help you read the failing cases afterwards, but they do not answer “which is better”.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  function recognise({ el, done, kit }) {
    style();
    const CASES = [
      { s: "A support agent that calls tools in a loop sometimes takes 40 seconds to reply. Nobody knows whether the time goes to one slow tool, to many turns, or to the model.", yes: true,
        r: "Yes. Each tool call and each model turn becomes a span with its own duration, so the waterfall shows whether one slow tool or many turns eat the time.",
        w: "This is a timing question inside one request with many steps, which is exactly what spans answer: each tool call and model turn gets its own duration." },
      { s: "A legal team asks for proof that the new model answers contract questions more accurately than the old one, across 200 test questions.", yes: false,
        r: "Right, not tracing. A trace records what happened in one request; it holds no judgement of right or wrong. “More accurate across 200 questions” needs an eval: a golden set, a scoring method and a comparison with error bars.",
        w: "A trace records what happened, not whether it was right. 200 traces would show 200 answers and no verdict. Accuracy across a test set needs an eval: a golden set, a score, and error bars for the difference." },
      { s: "A recipe app's assistant translates a user's question, searches a recipe index, then asks a model. One user's answer yesterday mixed two languages.", yes: true,
        r: "Yes. Find that user's trace and read the steps in order: was the translation step's output already mixed, did the search return recipes in the wrong language, or did the model mix them?",
        w: "This is one bad answer from a multi-step pipeline: the case tracing is for. Open that request's trace and find the first step whose output already mixes the languages." }
    ];
    const picked = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a trace find it?</h1>
        <p class="task">For each situation: is tracing the tool that answers it?</p>
        ${CASES.map((c, k) => `<div id="c${k}" class="lpanel"><p class="lead">${kit.esc(c.s)}</p>${kit.options(["Yes, tracing", "No, something else"], { picked: picked[k], correct: c.yes ? 0 : 1 })}
          ${picked[k] == null ? "" : (picked[k] === 0) === c.yes ? kit.feedback(c.r, true) : kit.feedback(c.w, false)}</div>`).join("")}`;
      CASES.forEach((c, k) => el.querySelectorAll(`#c${k} .lopts button`).forEach(b => b.onclick = () => {
        picked[k] = +b.dataset.i; paint();
        if (CASES.every((d, j) => picked[j] === (d.yes ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    const T = RUNS.today.spans, rT = span("today", "retrieve"), gT = span("today", "generate"), gY = span("yesterday", "generate");
    const checks = [
      `The printed tree has ${T.length} spans: ${kit.esc(T[0].name)} at the top, and ${T.slice(1).map(s => kit.esc(s.name)).join(", ")} under it, all with the same trace id.`,
      `retrieve's type is <code>${kit.esc(rT.type)}</code> and generate's is <code>${kit.esc(gT.type)}</code>; the other two are <code>span</code>.`,
      `With the 2024 PDF in the index, retrieve's first chunk is ${kit.esc(rT.out[0].source)}, about ${fmt(Math.round(rT.out[0].chars / 100) * 100)} characters long.`,
      `generate's usage_details input is about ${Math.round(gT.usage.input / gY.usage.input)} times larger with the PDF than without it.`,
      "retrieve and build_prompt take a few milliseconds or less; generate takes nearly all of the request's time (in the notebook, a 2-second wait stands in for the model, whose answers are replayed from recordings)."
    ];
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">You can read a trace as a tree of spans, tell the slow span from the broken one by following inputs and outputs upstream, compare a trace with an older one, and instrument a Python app with <code>@observe</code>, a generation's usage, and the capture and flush settings.</p>
      <p class="lead">${NOTEBOOK_URL ? `Practice: <a class="${P}nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a>. It runs the same museum bot with the Langfuse SDK, replays the recorded model answers, and prints its spans.` : "The notebook for this lesson is on its way. It runs the same museum bot with the Langfuse SDK and prints its spans."} While you run it, tick what you see:</p>
      <ul class="${P}checks">${checks.map((c, k) => `<li><label><input type="checkbox" id="${P}k${k}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. An agent repeats model calls and tool calls in a loop, and every turn becomes one more span in a tree like the ones you read here.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Tracing LLM calls with Langfuse",
    checked: "2026-11-13",
    sources: [
      "https://langfuse.com/docs/observability/data-model",
      "https://langfuse.com/docs/observability/sdk/overview",
      "https://langfuse.com/docs/observability/sdk/python/instrumentation",
      "https://langfuse.com/docs/observability/features/observation-types",
      "https://langfuse.com/docs/observability/features/token-and-cost-tracking",
      "https://langfuse.com/docs/observability/features/masking",
      "https://langfuse.com/docs/observability/features/sampling",
      "https://langfuse.com/self-hosting",
      "https://opentelemetry-python.readthedocs.io/en/latest/api/context.html",
      "https://docs.python.org/3/library/contextvars.html"
    ],
    interview: [{
      q: "After a deploy, users say your RAG bot is slower and gives wrong answers. You have traces. Walk me through finding the cause.",
      good: ["Open the trace of one bad answer and read the span tree, not just the total time",
        "The slowest span shows where time goes, not necessarily the cause; follow inputs and outputs upstream to the first span whose output is already wrong",
        "Compare with a trace of the same question from before the deploy: what changed in retrieval output, prompt size, token counts",
        "Judge speed over many traces (median and slow tail), since one trace's time is noisy",
        "Fix the step that broke, then add a golden case or a test so it cannot come back unnoticed"],
      weak: "Switch to a faster or bigger model because the model span is the slowest, without reading what that span was given."
    }, {
      q: "Your team wants to trace every request of a health-insurance chatbot in production. What do you set up, and what do you watch out for?",
      good: ["Decorate each step (retrieval, prompt, model call, tools) so a request becomes one trace, and record model and token usage on generations",
        "User messages and documents get stored: switch off input or output capture where it is not needed, and mask sensitive fields before data leaves the app",
        "Storage grows with traffic: sample traces at high volume, and decide how long to keep them",
        "Sending happens in the background; short-lived jobs must flush before they exit",
        "Decide where the data may live: a managed service or self-hosted"],
      weak: "Turn on full capture everywhere and look at it later, without thinking about personal data, storage or sampling."
    }],
    screens: [situation, readTrace, spotIdea, yesterday, slower, inPython, knobs, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="generate"]', "[data-blame]"], right: ['[data-i="retrieve"]', "[data-blame]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(5).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ['[data-i="retrieve"]', "[data-blame]"], right: ['[data-i="build_prompt"]', "[data-blame]", "#fix [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { right: [] }
    ]
  });
})();
