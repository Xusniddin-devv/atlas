/* Lesson s5c-ollama: Running a model locally with Ollama.
   Story: a frontend developer prototypes a private notes summariser on his own laptop, with no API key: the notes go
   to a small open model that Ollama serves on the same machine.
   Ideas: (1) a local call pays to load the model into memory unless it is still loaded, and the response's timing
   fields say where the time went (load, reading the prompt, writing the answer); (2) the context length (num_ctx) is
   a memory budget: a prompt longer than it is cut, quietly, and a bigger one costs memory.
   Depth: library (screens 3 to 5: the ollama Python library, options/num_ctx, keep_alive, the timing fields),
   debug (screen 1: why one run is slower; screen 4: a truncated prompt), explain (2, 7, 8). Screen 6 is the reload cost of changing num_ctx.
   Data: every number and text below is copied from real runs on an Apple M1 (16 GB) with Ollama 0.15.4 and the
   model gemma3:270m (Q8_0), kept in docs/ai-path/runs/s5c-ollama/:
     timing.out.txt + timing.server-log.txt  (python summarise.py timing: ollama stop, then the same call twice)
     week.out.txt + week.server-log.txt      (python summarise.py week: a long week of notes at num_ctx 2048, then 8192)
     model-show.out.txt, env.txt, notes.py, summarise.py
   No hosted model was called. Lesson-local style (.lx-s5c-ollama-*): clickable log/field rows, see ensureStyle(). */
(() => {
  const ID = "s5c-ollama";
  const P = "lx-s5c-ollama-";
  const sec = ns => (ns / 1e9).toFixed(2);
  const fmt = n => n.toLocaleString("en");
  const MODEL = "gemma3:270m";
  const QUANT = "Q8_0"; // model-show.out.txt: quantization Q8_0
  const PARAMS = "268.10M"; // model-show.out.txt: parameters

  /* ---------- Data from the runs ---------- */
  // timing.out.txt: run 1 straight after `ollama stop gemma3:270m`, run 2 straight after run 1. Same notes, same options.
  const COLD = { total_duration: 1931180500, load_duration: 1019406209, prompt_eval_count: 89, prompt_eval_duration: 66300666, eval_count: 59, eval_duration: 700670831 };
  const WARM = { total_duration: 967014958, load_duration: 157223458, prompt_eval_count: 89, prompt_eval_duration: 17776292, eval_count: 59, eval_duration: 709454585 };
  const DAY_ANSWER = // the same text in run 1 and run 2
    "Here's a summary of your notes:\n\n*   **Monday:** Landlord calls for rent increase from January.\n*   **Tuesday:** Standup date picker bug is due Wednesday.\n*   **Wednesday:** Lunch with Aziz wants to try the new noodle place on Friday.";
  const PS_16384 = "gemma3:270m                                        e7d36fb2c3b3    590 MB    100% GPU     16384      4 minutes from now";
  const LOG_STARTED = 'msg="llama runner started in 0.75 seconds"'; // timing.server-log.txt
  const DAY_NOTES = "Monday notes.\n- Landlord called: rent goes up from January. I must answer by 20 November.\n- Standup: the date picker bug is mine, due Wednesday.\n- Lunch with Aziz, he wants to try the new noodle place on Friday.\n- Remember to back up the laptop before the OS update.";

  // week.out.txt: the week of notes (13,215 characters), first at num_ctx 2048, then at num_ctx 8192
  const WEEK_CHARS = 13215;
  const SMALL = { num_ctx: 2048, load_duration: 804997167, prompt_eval_count: 2048, prompt_eval_duration: 434879250, eval_count: 310, eval_duration: 3959846862, size: 507 };
  const BIG = { num_ctx: 8192, load_duration: 1208733542, prompt_eval_count: 3436, prompt_eval_duration: 772044625, eval_count: 78, eval_duration: 1022156710, size: 539 };
  const PS16 = { num_ctx: 16384, size: 590 }; // timing.out.txt, ollama ps after run 1
  // trimmed with … , not altered
  const SMALL_ANSWER = "Okay, I've reviewed the provided text. Here's a summary of the key points: … **Key Information:** The text describes a common problem in the database or application where a user's data is being stored and accessed. … Data being stored in a format that is not supported by the database. … Changing the data format in the database.";
  const BIG_ANSWER = "Here's a summary of your notes in three bullet points:\n\n*   **Monday:** Landlord called, stand-up: the date picker bug is mine, due Wednesday.\n*   **Tuesday:** Gym after work, legs. Slept badly, too much coffee.\n*   **Wednesday:** Read about the date picker in the docs, wrote down two questions.";
  // week.server-log.txt, whole lines
  const LOG_OFFLOAD = 'time=2026-11-14T00:36:00.008+09:00 level=INFO source=ggml.go:494 msg="offloaded 19/19 layers to GPU"';
  const LOG_KV_SMALL = 'time=2026-11-14T00:36:00.008+09:00 level=INFO source=device.go:251 msg="kv cache" device=Metal size="21.0 MiB"';
  const LOG_TRUNC = 'time=2026-11-14T00:36:07.687+09:00 level=WARN source=runner.go:186 msg="truncating input prompt" limit=2048 prompt=3436 keep=4 new=2048';
  const LOG_STARTED_BIG = 'msg="llama runner started in 0.91 seconds"'; // week.server-log.txt, the num_ctx 8192 call
  const KV = [[2048, "21.0"], [8192, "39.0"], [16384, "63.0"]]; // "kv cache" size in MiB from the server logs at each num_ctx

  // the code we ran (summarise.py), the function line for line
  const CODE = [
    'from ollama import chat',
    'MODEL = "gemma3:270m"',
    '',
    'def summarise(notes, options):',
    '    response = chat(',
    '        model=MODEL,',
    '        messages=[{"role": "user", "content": "Summarise my notes in three bullet points.\\n\\n" + notes}],',
    '        options=options,',
    '        keep_alive="5m",',
    '    )',
    '    return response'
  ];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}list { display: grid; gap: 8px; margin-top: 14px; }
      .${P}list button { display: block; width: 100%; text-align: left; min-height: 44px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); cursor: pointer; font: 500 15px/1.45 var(--font); overflow-wrap: anywhere; }
      .${P}list button.right { border-color: var(--good); background: var(--good-soft); }
      .${P}list button.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}list button.near { border-color: var(--ink); }
      .${P}mono { display: block; font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}list small { display: block; margin-top: 4px; font: 500 13px/1.5 var(--font); color: var(--muted); }
      .${P}who { margin: 16px 0 4px; font: 600 12.5px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}out { margin: 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}grid { display: grid; grid-template-columns: auto auto auto; gap: 4px 14px; margin-top: 12px; font: 500 14px/1.5 var(--mono); }
      .${P}grid .h { color: var(--muted); font-size: 12.5px; }
      .${P}case { margin-top: 18px; }
      .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; }
      @media (hover: hover) { .${P}list button:not(.right):not(.wrong):hover { border-color: var(--ink); } }
    `;
    document.head.appendChild(s);
  }
  const out = (kit, who, text, recorded) => `<div class="${P}who">${kit.esc(who)}</div><pre class="${P}out">${kit.esc(text)}</pre>${recorded ? `<p class="${P}cap">Real output of our run on this laptop, 2026-11-14</p>` : ""}`;
  const rowBtn = (kit, i, state, mono, small) => `<button type="button" data-i="${i}" class="${state || ""}"><span class="${P}mono">${kit.esc(mono)}</span>${small ? `<small>${small}</small>` : ""}</button>`;

  /* 1. The situation, and the by-hand diagnosis: which line explains the slow run? */
  const FIELDS = ["total_duration", "load_duration", "prompt_eval_count", "prompt_eval_duration", "eval_count", "eval_duration"];
  const isDur = f => f.endsWith("duration");
  function slowRun({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const gap = COLD.total_duration - WARM.total_duration;
    const loadGap = COLD.load_duration - WARM.load_duration;
    const readGap = COLD.prompt_eval_duration - WARM.prompt_eval_duration;
    const ratio = (COLD.total_duration / WARM.total_duration).toFixed(1);
    const RIGHT = 1;
    const FB = {
      0: `That is the slowness itself: ${sec(COLD.total_duration)} s against ${sec(WARM.total_duration)} s. It is the whole time, so it cannot say where the time went. Look for the part that differs.`,
      2: `Both runs read the same ${COLD.prompt_eval_count} prompt tokens: the same notes, the same instruction. A line that is equal in both runs cannot explain the gap.`,
      3: `Reading the prompt did take longer in run 1 (${sec(COLD.prompt_eval_duration)} s against ${sec(WARM.prompt_eval_duration)} s). But that is only ${sec(readGap)} s of a ${sec(gap)} s gap. Something else holds most of it.`,
      4: `Both runs wrote the same ${COLD.eval_count} tokens; the answer was the same text. Equal lines do not explain the gap.`,
      5: `Writing took about the same time in both runs: ${sec(COLD.eval_duration)} s and ${sec(WARM.eval_duration)} s. The model wrote just as fast in run 1, so the slowness came from somewhere else.`,
      6: `This shows where the model sat after run 1: 100% GPU, so all of it ran on the laptop's graphics chip. It said the same after run 2. Nothing here differs between the runs.`
    };
    const paint = () => {
      const fin = pick === RIGHT;
      const rows = FIELDS.map((f, i) => rowBtn(kit, i, pick === i ? (i === RIGHT ? "right" : "wrong") : "",
        `"${f}": ${COLD[f]}`,
        isDur(f) ? `run 1: ${sec(COLD[f])} s · run 2: ${sec(WARM[f])} s` : `run 1: ${COLD[f]} · run 2: ${WARM[f]}`));
      rows.push(rowBtn(kit, 6, pick === 6 ? "wrong" : "", PS_16384, "ollama ps (the command that lists loaded models), straight after run 1. Columns: name, id, size, processor, context, until"));
      el.innerHTML = `<h1>The same summary took ${ratio} times as long</h1>
        <p class="lead">You are building a notes app for yourself. Your notes are private, so they should not go to a hosted API, and you have no API key anyway. Instead the app sends them to <b>Ollama</b>, a program that downloads open models and runs them on your own machine, behind a local web address. The model is ${kit.esc(MODEL)}: ${kit.esc(PARAMS)} parameters, stored at about 8 bits per weight (${QUANT}).</p>
        <p class="lead">You asked it twice, a few seconds apart, to summarise the same Monday note. Each answer comes with timing fields. Durations are in nanoseconds: 1,000,000,000 ns is one second. In the field names, <code>prompt_eval</code> means reading your prompt and <code>eval</code> means writing the answer.</p>
        ${out(kit, "The note", DAY_NOTES, false)}
        <p class="task">Run 1 took ${sec(COLD.total_duration)} s, run 2 ${sec(WARM.total_duration)} s. Click the line from run 1 that explains most of the gap.</p>
        <div class="${P}list">${rows.join("")}</div>
        <div class="lpanel">${pick == null ? "" : fin
          ? kit.feedback(`Right. <code>load_duration</code> is the time spent loading the model. Run 1 spent ${sec(COLD.load_duration)} s on it, run 2 only ${sec(WARM.load_duration)} s: that is ${sec(loadGap)} s of the ${sec(gap)} s gap. Before run 1 we had stopped the model, so Ollama first had to read it from disk into memory. The server log says so too: <code>${kit.esc(LOG_STARTED)}</code>. In run 2 the model was still in memory.`, true)
          : kit.feedback(FB[pick], false)}</div>`;
      el.querySelectorAll(`.${P}list button`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Spot the idea: a model must be in memory, and Ollama unloads idle models. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The laptop slows its graphics chip down when it has been idle, so the model writes more slowly",
      "Ollama unloads a model that has sat unused for a while, so each call loads it again",
      "Ollama forgets the last prompt, so it must read the notes again from the start"
    ];
    const FB = [
      `If the chip were slower, <code>eval_duration</code> would grow: the time spent writing. In run 1 writing took ${sec(COLD.eval_duration)} s, the same as run 2. The extra time was in <code>load_duration</code>.`,
      `Right. A model can only answer while it sits in memory. Ollama keeps a model loaded for <b>5 minutes</b> after its last use by default, then unloads it to free the memory. With 20 minutes between notes, every call pays the load again. The fix is the <code>keep_alive</code> field of the request ("30m", or a negative number for "never unload"), or the <code>OLLAMA_KEEP_ALIVE</code> setting for the whole server. The price: the model holds its memory the whole time (${PS16.size} MB here, from <code>ollama ps</code>).`,
      `Each new note is a new prompt anyway, so there is nothing to remember. And reading the prompt was a small part of run 1: ${sec(COLD.prompt_eval_duration)} s. The big cost was <code>load_duration</code>.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Slow every time</h1>
        <p class="lead">You hook the summariser to the moment you close a note. You close one about every 20 minutes. Now <b>every</b> summary is slow like run 1, with a big <code>load_duration</code>, even though Ollama is running all day.</p>
        <p class="task">What is going on?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. The library call, and reading its numbers right. */
  function theCall({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const tps = WARM.eval_count / (WARM.eval_duration / 1e9);
    const tpsTotal = WARM.eval_count / (WARM.total_duration / 1e9);
    const readTps = WARM.prompt_eval_count / (WARM.prompt_eval_duration / 1e9);
    const opts = [
      `eval_count ÷ total_duration: ${WARM.eval_count} tokens in ${sec(WARM.total_duration)} s, about ${Math.round(tpsTotal)} a second`,
      `eval_count ÷ eval_duration: ${WARM.eval_count} tokens in ${sec(WARM.eval_duration)} s, about ${Math.round(tps)} a second`,
      `prompt_eval_count ÷ prompt_eval_duration: ${WARM.prompt_eval_count} tokens in ${sec(WARM.prompt_eval_duration)} s, about ${fmt(Math.round(readTps))} a second`
    ];
    const FB = [
      `<code>total_duration</code> also holds the load (${sec(WARM.load_duration)} s) and reading the prompt. It answers "how long did I wait", not "how fast does it write". On a cold call this number would look far worse while the writing speed did not change at all.`,
      `Right: about <b>${Math.round(tps)} tokens a second</b> for writing. That is the number to compare between models and settings. Your wait is roughly load + prompt tokens at the reading speed + answer tokens at this writing speed.`,
      `That is reading speed: the model takes in the whole prompt in big batches. Writing goes one token after another, each one needing the one before, so it is far slower: ${Math.round(readTps / tps)} times slower in this run.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>The call, in Python</h1>
        <p class="lead">This is the code we ran, with Ollama's own Python library (<code>pip install ollama</code>). Three arguments matter. <code>model</code> names the model and its tag (the part after the colon): a different tag is a different download, often a different size or quantization. <code>options</code> carries settings for this request, such as the context length <code>num_ctx</code>. <code>keep_alive</code> says how long the model stays loaded afterwards.</p>
        <div class="${P}wrap">${kit.code(CODE, 4)}</div>
        ${out(kit, "Run 2: answer", DAY_ANSWER, true)}
        <p class="task">A teammate asks how fast this model writes on your laptop. Which calculation from run 2 answers that?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ans === 1)}</div>
        <p class="lead">Ollama also answers the OpenAI-style chat API at <code>http://localhost:11434/v1/</code>, so code written for the OpenAI client can point at it. That API has no way to set the context length.</p>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Broken on purpose: the week of notes, cut short by num_ctx. */
  function brokenWeek({ el, done, kit }) {
    ensureStyle();
    let pick = null, fix = null;
    const RIGHT = 5;
    const lines = [
      [`answer: ${SMALL_ANSWER.split(" … ")[0]} … ${SMALL_ANSWER.split(" … ")[1]}`, "the model's answer, trimmed"],
      [`"prompt_eval_count": ${SMALL.prompt_eval_count}`, "timing field"],
      [`"eval_count": ${SMALL.eval_count}`, "timing field"],
      [LOG_OFFLOAD, "server log"],
      [LOG_KV_SMALL, "server log"],
      [LOG_TRUNC, "server log"]
    ];
    const cut = BIG.prompt_eval_count - SMALL.num_ctx;
    const KEEP = 4; // LOG_TRUNC: keep=4
    const FB = {
      0: "That is the damage: the answer talks about a database and says nothing about your landlord or your week. It shows that something went wrong, not why. Find the line that says what happened to your notes.",
      1: `Suspicious: exactly ${SMALL.num_ctx}, the same number as <code>num_ctx</code> in the code. A real week of notes landing on a round number is no accident. Find the line that says what happened.`,
      2: `${SMALL.eval_count} tokens is long for three bullet points; the model rambled and repeated itself. That is a symptom of a confused model, not the cause.`,
      3: "All 19 layers went to the GPU: the model fit in memory and ran where it should. This line is normal.",
      4: `The KV cache got memory for ${SMALL.num_ctx} tokens, as asked. Nothing failed here; the question is whether ${SMALL.num_ctx} was enough.`
    };
    const FIXES = [
      "Add \"Read all of my notes carefully\" to the instruction",
      `Raise num_ctx so the whole prompt fits, for example ${BIG.num_ctx}`,
      "Set keep_alive to -1 so the model never unloads"
    ];
    const FIXFB = [
      `The instruction sits at the start of the prompt, and the start is what was cut. The new words would be cut with it, and the model still would not see Monday.`,
      `Right. The prompt was ${BIG.prompt_eval_count} tokens; <code>num_ctx</code> ${SMALL.num_ctx} let only ${SMALL.num_ctx} in, so ${fmt(cut)} tokens near the start were dropped (<code>keep=${KEEP}</code>: only the first ${KEEP} tokens stay), the instruction and Monday's notes with them. The next screen runs it again with ${BIG.num_ctx}. (Splitting a long text into parts and summarising each part also works, at the cost of more calls.)`,
      "keep_alive changes how long the model stays loaded, which is about speed. It does not change how much text the model can see."
    ];
    const paint = () => {
      const found = pick === RIGHT;
      el.innerHTML = `<h1>Broken on purpose: the week that lost its Monday</h1>
        <p class="lead">Now you summarise a whole week: ${fmt(WEEK_CHARS)} characters of notes, Monday's landlord note first. You copied <code>options={"num_ctx": ${SMALL.num_ctx}}</code> from an example. No error came back. Here is what did.</p>
        <p class="task">${found ? "Now pick the fix." : "Click the line that says what happened to your notes."}</p>
        <div class="${P}list">${lines.map(([t, s], i) => rowBtn(kit, i, pick === i ? (i === RIGHT ? "right" : i === 1 ? "near" : "wrong") : "", t, kit.esc(s))).join("")}</div>
        <p class="${P}cap">Real output and server log of our run, 2026-11-14 (answer trimmed with …)</p>
        <div class="lpanel">${pick == null ? "" : found
          ? kit.feedback(`Right. Ollama cut the prompt to fit: <code>limit=${SMALL.num_ctx}</code> tokens allowed, <code>prompt=${BIG.prompt_eval_count}</code> tokens sent, <code>new=${SMALL.num_ctx}</code> kept. It is a warning in the server log, not an error in your app, so the call "worked". Ollama kept the first ${KEEP} tokens (<code>keep=${KEEP}</code>) and dropped the ${fmt(cut)} after them. Your instruction and Monday's note sat there, at the start of the prompt, so the answer follows neither.`, true)
          : kit.feedback(FB[pick], pick === 1 ? undefined : false)}
        ${found ? `<div id="f">${kit.options(FIXES.map(o => kit.esc(o)), { picked: fix, correct: 1 })}${fix == null ? "" : kit.feedback(FIXFB[fix], fix === 1)}</div>` : ""}</div>`;
      el.querySelectorAll(`.${P}list button`).forEach(b => b.onclick = () => { if (pick === RIGHT) return; pick = +b.dataset.i; paint(); });
      el.querySelectorAll("#f .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 1) done(); });
    };
    paint();
  }

  /* 5. The fix, and what it costs in memory. */
  function fixAndCost({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [`The same ${SMALL.size} MB: the weights did not change`, `More than ${SMALL.size} MB`, `Less than ${SMALL.size} MB: the prompt now fits, so less is wasted`];
    const FB = [`The weights are the same, but they are not all of it. The KV cache keeps keys and values for every token the context can hold, and Ollama sets it up for the whole <code>num_ctx</code> when it loads the model.`,
      `Right: <b>${BIG.size} MB</b>, and <b>${PS16.size} MB</b> at num_ctx ${PS16.num_ctx}. The log's "kv cache" line grew: ${KV.map(([n, m]) => `${m} MiB at ${fmt(n)}`).join(", ")}. It grows more slowly than the context for this model, because most of its layers only look back over a short window. On a model without that trick it grows in step with num_ctx.`,
      `The memory is set aside for the whole context when the model loads, whether the prompt fills it or not. A bigger context reserves more.`];
    const paint = () => {
      el.innerHTML = `<h1>The fix works. What did it cost?</h1>
        <p class="lead">Same week of notes, num_ctx ${BIG.num_ctx}. Now <code>prompt_eval_count</code> is ${fmt(BIG.prompt_eval_count)}, the same number the log said you sent: the whole prompt went in.</p>
        ${out(kit, "Answer at num_ctx " + BIG.num_ctx, BIG_ANSWER, true)}
        <p class="lead">Monday is back. The labels are still wrong: Tuesday and Wednesday get lines that were not theirs. A model this small summarises poorly; that is a cost of what fits on a laptop.</p>
        <p class="task">With num_ctx ${SMALL.num_ctx}, <code>ollama ps</code> showed the model taking <b>${SMALL.size} MB</b>. Same model, same notes, num_ctx ${BIG.num_ctx}. What does <code>ollama ps</code> show?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. The other cost of changing num_ctx: a reload. */
  function reloadCost({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The longer prompt took longer to load", `A new num_ctx needs a new KV cache, so Ollama loaded the model again`, "keep_alive had run out between the two calls"];
    const FB = [`The prompt is not part of loading: reading it is <code>prompt_eval_duration</code> (${sec(BIG.prompt_eval_duration)} s here).`,
      `Right. The log shows a fresh start: <code>${kit.esc(LOG_STARTED_BIG)}</code>. In our runs, every change of num_ctx meant a reload. Pick one context length for your app and keep it, or each switch costs a load.`,
      `keep_alive was "5m", and the two calls were seconds apart. The model was still loaded; something else made Ollama load it again.`];
    const paint = () => {
      el.innerHTML = `<h1>A second cost: the switch</h1>
        <p class="lead">On screen 1, a model that was still in memory loaded in ${sec(WARM.load_duration)} s.</p>
        <p class="task">The num_ctx ${BIG.num_ctx} run came right after the num_ctx ${SMALL.num_ctx} run, so the model was in memory. Yet its <code>load_duration</code> was ${sec(BIG.load_duration)} s. Why?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    // The teammate's scenario (a premise, not a run): a model of several billion parameters at about 4 bits per weight.
    const HER_PARAMS = 4e9, HER_BITS = 4, HER_FREE_MB = 1500;
    const herWeightsMb = HER_PARAMS * HER_BITS / 8 / 1e6;
    const opts = [
      "Memory: the model and its context must fit next to everything else that is open",
      "The wait for the first call, while the model loads",
      "Weaker answers than the ones you got on your laptop"
    ];
    const FB = [
      `Right. ${HER_PARAMS / 1e9} billion weights at about ${HER_BITS} bits each come to about ${fmt(herWeightsMb)} MB for the weights alone, before any KV cache: more than the ${fmt(HER_FREE_MB)} MB she has free. (Our ${kit.esc(PARAMS)} model took ${PS16.size} MB in all, so it would have fitted.) When a model does not fit, Ollama puts part of it on the CPU (<code>ollama ps</code> then shows a CPU/GPU split), and writing slows down. A smaller model, fewer bits per weight, a smaller num_ctx or closing other apps are the levers.`,
      `The load is real, but it costs seconds and <code>keep_alive</code> keeps it to one per session. Before any of that, the model has to fit: about ${fmt(herWeightsMb)} MB of weights alone, with ${fmt(HER_FREE_MB)} MB free.`,
      `She swapped models to get better answers, and a model of ${HER_PARAMS / 1e9} billion parameters usually summarises better than our ${kit.esc(PARAMS)} one. Weak answers were the cost of the small model she left. The bigger one has a different first problem: it has to fit in her memory.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to run it yourself</h1>
        <p class="lead"><b>For:</b> private data that must stay on the machine, working offline, prototypes and personal tools with no per-call bill. <b>Not for:</b> many users at once. By default Ollama handles one request per model at a time, and parallel requests multiply the context memory. For many users, use a serving engine (a server program built for that) on a GPU server, which is the next lesson, or a hosted API. Also not for work that needs the strongest model: what fits on a laptop is small. <b>Costs:</b> memory for weights and KV cache, a load on the first call, weaker answers, and updating models yourself.</p>
        <p class="task">You share the summariser with a teammate. Her laptop has 8 GB of memory; with her browser and other apps open, about ${fmt(HER_FREE_MB)} MB is free. She finds the summaries poor, so she swaps in a model of ${HER_PARAMS / 1e9} billion parameters, stored at about ${HER_BITS} bits per weight. Which cost does she hit first?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 0 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ans === 0)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A doctor wants a tool on her clinic laptop that drafts referral letters from patient notes. The notes may not leave the building.", true,
      "Yes. The data must stay on the machine, there is one user, and a draft letter does not need the strongest model. Check that the model plus its context fits her laptop's memory.",
      "This is the case local models are for: the notes cannot go to a hosted API, and one person uses it. A small model running on her laptop keeps everything in the building."],
    ["A shop wants its public website chatbot, used by thousands of visitors a day, to run from one office Mac with Ollama.", false,
      "No. The average is not the problem; the peaks are. At a sale, hundreds of visitors can ask at the same moment, and by default Ollama works on one request per model at a time, so the rest wait in a queue. A public site must also stay up when the office Mac sleeps, restarts or loses power, and its answers go to customers, so a model small enough for one Mac may not be good enough. This needs a serving engine on a GPU server, or a hosted API.",
      "Thousands a day is only a few a minute on average, but visitors come in bursts: at a sale, hundreds ask at the same moment. By default Ollama works on one request per model at a time; the rest queue. A public bot also needs to stay up when one office Mac does not, and to give answers good enough for customers. This needs a serving engine on a GPU server, or a hosted API."],
    ["On an 11-hour flight with no internet, you want to try prompt changes for your app against a real model.", true,
      "Yes. No network, one user, quick experiments: a small local model lets you keep working. Remember its answers will be weaker than the hosted model your app uses, so recheck the winners later.",
      "Without internet no hosted API works at all. A model you pulled before the flight runs on the laptop. Just recheck your results against the real hosted model afterwards."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Local model, or not?</h1>
        <p class="lead">Three situations away from your notes app.</p>
        <p class="task">For each one, decide if running an open model locally with Ollama is the right call.</p>
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
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can run and read a local model</h1>
      <p class="lead">You called a model on your own laptop through Ollama's Python library, and read its timing fields: load, reading the prompt, writing the answer. You found a slow run's cause in <code>load_duration</code> and fixed it with <code>keep_alive</code>. You found a prompt cut short by <code>num_ctx</code> in the server log, and saw what a bigger context costs in memory and in a reload.</p>
      <p class="lead">This lesson was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Ollama served one person on one laptop. Next, one GPU server answers a whole office at once, and the KV cache becomes the thing you manage.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Running a model locally with Ollama",
    checked: "2026-11-14",
    sources: [
      "https://docs.ollama.com/api/chat",
      "https://docs.ollama.com/faq",
      "https://docs.ollama.com/context-length",
      "https://docs.ollama.com/troubleshooting",
      "https://docs.ollama.com/cli",
      "https://docs.ollama.com/api/openai-compatibility",
      "https://github.com/ollama/ollama-python",
      "https://arxiv.org/abs/2503.19786"
    ],
    interview: [{
      q: "A teammate built a summariser on a local model with Ollama. On long documents the answers ignore the instructions, and the first request after lunch is always slow. How do you track both down?",
      good: [
        "Read the response's timing fields: a big load_duration means the model was loaded again, so check keep_alive (5 minutes by default) or set it longer",
        "Compare prompt_eval_count with the real prompt length: if it equals num_ctx, the prompt was cut, and the server log warns about truncating",
        "Raise num_ctx to fit, knowing it costs memory for the KV cache and, here, a reload when it changes; or split the document",
        "Check ollama ps: if the model no longer fits it is split between CPU and GPU, and writing slows down",
        "Measure writing speed as eval_count over eval_duration, not over total_duration"
      ],
      weak: "Switch to a bigger model or rewrite the prompt. That misses that the instructions never reached the model, and that the slow call is a load, not slow writing."
    }],
    screens: [slowRun, spotIdea, theCall, brokenWeek, fixAndCost, reloadCost, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="0"]'], right: ['[data-i="1"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="3"]'], right: ['[data-i="5"]', "#f [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
