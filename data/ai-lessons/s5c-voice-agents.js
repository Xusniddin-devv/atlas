/* Lesson: voice agents. Story: Larkspur Dental, a small clinic, puts an agent on its phone line to book and move
   appointments; in tests callers say "Hello? Are you there?" before it answers. Ideas: (1) a voice reply is a
   chain of stages (end-of-turn wait, speech to text, model, text to speech); what the caller feels is the time to
   the first sound, so split it per stage and start speaking at the first sentence of a streamed reply;
   (2) turn-taking: a short end-of-turn wait cuts off a caller who pauses, and after a barge-in the history must
   hold only what the caller heard.
   Data, all real:
   - docs/ai-path/runs/s5c-voice-agents/pipeline.py + pipeline.out.txt: the pipeline timed on this laptop
     (macOS `say` voices as caller and agent, an energy end-of-turn detector, whisper.cpp base/tiny, gemma3 4B and
     gemma3 270M through Ollama), three runs per setting;
   - stream_split.py + stream_split.out.txt: one streamed reply, replayed through speak_as_it_streams (traced);
   - barge_in.py + barge_in.out.txt: the agent's phrases with their real playback times, and the interruption;
   - recordings (main checkout) docs/ai-path/recordings/s5c-voice-agents/full, cut (the model's answer after the
     interruption, with the whole reply or only the played part in the history) and turn-cut, turn-full (a
     words-only end-of-turn check).
   Lesson-local style: a small log block and stage cards (.lx-s5c-voice-agents-*), see ensureStyle(). */
(() => {
  const ID = "s5c-voice-agents";
  const fmt = n => Math.round(n).toLocaleString("en");
  const ms = n => `${fmt(n)} ms`;
  const sec = n => `${(n / 1000).toFixed(1)} s`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); };

  /* ---------- Data copied from the runs and recordings ---------- */
  const BUDGET = 3000; // the clinic's goal (a story choice, not a measured number): first sound within 3 s
  // pipeline.py CALLER["normal"] (what the caller voice was given to read) and what whisper.cpp base heard
  const MARIA = "Hi, it's Maria Lopez. I have a cleaning on Thursday at ten, and I need to move it to next week. Mornings are best for me.";
  const HEARD = "Hi, it's Maria Lopez. I have a cleaning on Thursday at 10, and I need to move it to next week. Mornings are best for me.";
  const SLOTS = "Monday 9:00, Tuesday 11:30, Wednesday 8:30, Friday 10:00"; // pipeline.py SYSTEM
  const WAIT = { shipped: 1000, short: 500 }; // end-of-turn wait settings in pipeline.py CONFIGS
  // pipeline.out.txt, every run: [stt ms, model ms, tts ms] per configuration (wait is the setting itself)
  const RUNS = {"as shipped": [[1237, 10679, 1260], [1289, 10338, 947], [1353, 9797, 913]], "speak at first sentence": [[569, 1231, 793], [673, 1192, 764], [828, 1288, 848]], "plus shorter wait": [[634, 1379, 954], [1212, 1221, 811], [606, 1224, 704]], "smaller model, as shipped otherwise": [[654, 364, 711], [566, 330, 735], [531, 261, 735]], "smaller speech model, as shipped otherwise": [[787, 9585, 906], [423, 9690, 967], [350, 9736, 1041]], "pausing caller, shorter wait": [[648, 1490, 750], [497, 1181, 788], [770, 1181, 795]], "pausing caller, as shipped wait": [[1047, 1405, 806], [655, 1277, 727], [704, 1163, 706]]};
  const TRACE_RUN = RUNS["as shipped"][1]; // the one call shown on the by-hand screen (run 2 of "as shipped")
  // pipeline.out.txt "reply" of the as-shipped runs (local gemma3 4B, temperature 0, the same text in every run)
  const LOCAL = { model: "gemma3 4B Q4_K_M via Ollama", ranAt: "2026-11-18" };
  const REPLY_FULL = "Hello, thank you for calling Larkspur Dental! This is Sarah speaking. \n\nOh, yes, I see you’re Maria Lopez and you have a cleaning scheduled for this Thursday at ten. Absolutely, let's get that moved for you. You mentioned mornings work best – we do have a few options next week. We have Monday at nine am, Tuesday at eleven thirty, and Wednesday at eight thirty. Would any of those times work for you?";
  const REPLY_TOKENS = 94, REPLY_AUDIO_S = 24.92, FIRST_AUDIO_S = 2.88; // pipeline.out.txt reply_tokens, said_audio_s
  const SMALL_REPLY = "Okay, I understand."; // pipeline.out.txt, gemma3 270M ("smaller model")
  const TINY_HEARD = HEARD; // pipeline.out.txt: whisper tiny heard the same words as base on this clear voice
  // Pausing caller: pipeline.out.txt gaps and transcripts; CALLER["pause"] has a 650 ms silence after "to"
  const PAUSE_SAID = "Hi, it's Maria Lopez. I need to move my cleaning to … the Tuesday after next, if you have a morning.";
  const PAUSE_GAPS = [180, 240, 660, 20, 40, 40, 280];
  const PAUSE_END_S = { short: 3.64, shipped: 6.98 }; // speech_end_s for wait 500 and wait 1000
  const PAUSE_HEARD = { short: "Hi, it's Maria Lopez, I need to move my cleaning too.", shipped: "Hi, it's Maria Lopez, I need to move my cleaning too. The Tuesday after next, if you have a morning." };
  // stream_split.out.txt: the frames where line 5 (send_to_tts) is about to run: [chunk ms, buffer, spoken]
  const SENDS = [[1507, "Hello, thank you for calling Larkspur Dental!", 0], [1998, " This is Sarah speaking.", 1], [4354, " \n\nOh, yes, I see you’re Maria Lopez and you have a cleaning scheduled for this Thursday at ten.", 2], [5418, " Absolutely, let's get that moved for you.", 3], [6844, " You mentioned mornings work best – we do have a few options next week.", 4], [8567, " We have Monday at nine am, Tuesday at eleven thirty, and Wednesday at eight thirty.", 5], [9442, " Would any of those times work for you?", 6]];
  const CHUNKS = 93, RETURNED = 7; // stream_split.out.txt: 93 chunks, the last at 9442 ms; returned 7
  // barge_in.out.txt: the agent's phrases (our test text, read by `say` voice Daniel) with playback times in s
  const PHRASES = [["I have three mornings free next week.", 0.0, 2.15], ["Monday at nine,", 2.15, 3.24], ["Wednesday at half past eight,", 3.24, 4.91], ["or Friday at ten.", 4.91, 6.11], ["Which one would you like?", 6.11, 7.28]];
  const BARGE_S = 5.06, BARGE_HEARD = "Yes, that one, the one you just said.";
  // From docs/ai-path/recordings/s5c-voice-agents/full.json and cut.json (not altered)
  const REC_FULL = { src: "s5c-voice-agents/full", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-18",
    text: "Okay, so that's Friday at ten next week. I'll get that changed for you." };
  const REC_CUT = { src: "s5c-voice-agents/cut", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-18",
    text: "Great. So I'll move your cleaning to Wednesday at 8:30 AM next week." };
  // From docs/ai-path/recordings/s5c-voice-agents/turn-cut.json and turn-full.json (not altered)
  const REC_TURN = { src: "s5c-voice-agents/turn-cut … turn-full", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-18",
    cut: "finished", full: "finished" };
  const CAPTION = `Recorded model output, ${REC_FULL.recordedAt}`;
  const LOCAL_CAPTION = `Model output from our run on a laptop, ${LOCAL.ranAt}`;

  /* ---------- Derived from the data ---------- */
  const col = (names, k) => median(names.flatMap(n => RUNS[n].map(r => r[k])));
  const NORMAL_BASE = ["as shipped", "speak at first sentence", "plus shorter wait", "smaller model, as shipped otherwise"];
  const M = {
    sttBase: col(NORMAL_BASE, 0),
    sttTiny: col(["smaller speech model, as shipped otherwise"], 0),
    modelAll: col(["as shipped", "smaller speech model, as shipped otherwise"], 1),
    modelFirst: col(["speak at first sentence", "plus shorter wait"], 1),
    ttsAll: col(["as shipped", "smaller speech model, as shipped otherwise"], 2),
    ttsFirst: col(["speak at first sentence", "plus shorter wait"], 2),
    modelSmall: col(["smaller model, as shipped otherwise"], 1),
    ttsSmall: col(["smaller model, as shipped otherwise"], 2)
  };
  const COUNT = { sttBase: NORMAL_BASE.length * 3, model: 6 };
  const STAGES = ["wait", "stt", "model", "tts"];
  const NAMES = { wait: "end-of-turn wait", stt: "speech to text", model: "model writes the reply", tts: "text to speech" };
  const PLANS = [
    { name: "as shipped", wait: WAIT.shipped, stt: M.sttBase, model: M.modelAll, tts: M.ttsAll },
    { name: "speak at the first sentence", wait: WAIT.shipped, stt: M.sttBase, model: M.modelFirst, tts: M.ttsFirst },
    { name: "plus a shorter end-of-turn wait", wait: WAIT.short, stt: M.sttBase, model: M.modelFirst, tts: M.ttsFirst },
    { name: "plus a smaller speech-to-text model", wait: WAIT.short, stt: M.sttTiny, model: M.modelFirst, tts: M.ttsFirst }
  ];
  const total = p => sum(STAGES.map(s => p[s]));
  const SMALL_PLAN = { wait: WAIT.shipped, stt: M.sttBase, model: M.modelSmall, tts: M.ttsSmall };
  const TR = { wait: WAIT.shipped, stt: TRACE_RUN[0], model: TRACE_RUN[1], tts: TRACE_RUN[2] };
  const TR_AT = (() => { let t = 0; return STAGES.map(s => (t += TR[s])); })(); // cumulative ms after her last word
  const TR_TOTAL = TR_AT[3];
  const FIRST_SENTENCE = SENDS[0][1].trim();
  const PAUSE_BIG = PAUSE_GAPS.indexOf(Math.max(...PAUSE_GAPS));
  const PLAYED = PHRASES.filter(p => p[2] <= BARGE_S);
  const FULL_TEXT = PHRASES.map(p => p[0]).join(" "), CUT_TEXT = PLAYED.map(p => p[0]).join(" ");

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 8.5em 1fr; gap: 4px 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
      .lx-${ID}-row.lx-${ID}-now { border-left: 3px solid var(--ink); padding-left: 10px; }
      .lx-${ID}-row.lx-${ID}-off .lx-${ID}-txt { color: var(--faint); text-decoration: line-through; }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-seq { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; counter-reset: st; }
      .lx-${ID}-seq li { counter-increment: st; border: 1px solid var(--line); background: var(--sunk); border-radius: 8px; padding: 8px 12px; font-size: 15px; }
      .lx-${ID}-seq li::before { content: counter(st) ". "; font: 600 14px var(--mono); color: var(--muted); }
      .lx-${ID}-opt { text-align: left; }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  // rows: [[who, html, opts]]; opts.now marks the row to look at, opts.off strikes it (not heard)
  const log = rows => `<div class="lx-${ID}-log">${rows.map(([who, html, o]) =>
    `<div class="lx-${ID}-row${o && o.now ? ` lx-${ID}-now` : ""}${o && o.off ? ` lx-${ID}-off` : ""}"><div class="lx-${ID}-who">${who}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>`;
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null || !fb[picked] ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`; // null entry: the screen shows its own right feedback
  const stageMeter = (kit, p, extra) => kit.meter([...STAGES.map(s => ({ label: NAMES[s], value: p[s], max: Math.max(total(p), BUDGET) })),
    { label: "total", value: total(p), max: Math.max(total(p), BUDGET), good: total(p) <= BUDGET },
    { label: "budget", value: BUDGET, max: Math.max(total(p), BUDGET) }, ...(extra || [])]);

  /* 1. The situation: put the four stages in order. */
  const ORDER = ["wait", "stt", "model", "tts"];
  const CARDS = ["tts", "wait", "model", "stt"]; // shown in this fixed shuffled order
  const CARD_TEXT = {
    wait: "Decide that she has finished: wait until the line has been quiet long enough",
    stt: "Turn her recorded words into text",
    model: "The language model writes the reply",
    tts: "Turn the reply text into audio and play it"
  };
  const WHY_NOT = {
    wait: "That already happened.",
    stt: "Not yet. In this first version the audio goes to speech to text once her turn is over, and something has to decide that it is over. Right now she might only be pausing for breath.",
    model: "The model reads text. At this point her words are still sound: nothing has turned them into text yet.",
    tts: "There is nothing to say yet. The reply text comes from the model, and the model has not run."
  };
  function order({ el, done, kit }) {
    ensureStyle();
    let got = 0, wrong = null;
    const paint = () => {
      const next = ORDER[got];
      const left = CARDS.filter(c => ORDER.indexOf(c) >= got);
      const wrongCard = left.find(c => c !== next);
      el.innerHTML = `<h1>The line goes quiet</h1>
        <p class="lead">Larkspur Dental, a small clinic, put an AI agent on its phone line to book and move appointments. In test calls, people kept saying “Hello? Are you there?” before it answered. This lesson is about that silence: where it comes from in a voice agent, and how to make it shorter without cutting callers off. One test call (the caller is a computer voice reading our script):</p>
        ${log([["caller", kit.esc(MARIA)]])}
        <p class="lead">Between her last word and the agent's first word, four pieces of software run one after another.</p>
        <p class="task">Tap them in the order they run.</p>
        ${got ? `<ol class="lx-${ID}-seq">${ORDER.slice(0, got).map(c => `<li>${kit.esc(CARD_TEXT[c])}</li>`).join("")}</ol>` : ""}
        <div class="lpanel">${got < ORDER.length ? `<div class="lopts">${left.map(c => `<button type="button" class="lx-${ID}-opt${wrong === c ? " wrong" : ""}" data-c="${c}"${c === next ? " data-right" : ""}${c === wrongCard ? " data-wrong" : ""}>${kit.esc(CARD_TEXT[c])}</button>`).join("")}</div>` : ""}
        ${wrong ? kit.feedback(WHY_NOT[wrong], false) : ""}
        ${got === ORDER.length ? kit.feedback(`Right. These are the four stages of a <b>chained voice pipeline</b>: <b>end-of-turn detection</b> (deciding the caller has finished), <b>speech to text</b> (STT), the <b>language model</b>, and <b>text to speech</b> (TTS). Each one waits for the one before it, so the silence Maria hears is the sum of all four. A study of ten languages found that in everyday talk, people answer about 0.2 s after the other person stops, on average. This pipeline will not match that, but the longer the silence, the more it sounds like a dropped line.`, true) : ""}</div>`;
      el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
        const c = b.dataset.c;
        if (c === ORDER[got]) { got++; wrong = null; paint(); if (got === ORDER.length) done(); }
        else { wrong = c; paint(); }
      });
    };
    paint();
  }

  /* 2. By hand: split one recorded slow reply into stages, find the stage that blows the budget. */
  function trace({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const mOpts = [TR_AT[2], TR.model, TR_AT[2] - TR.stt, TR_TOTAL];
    const mFb = [
      [`${ms(TR_AT[2])} is the clock time when the reply text was complete, counted from her last word. It includes the wait and speech to text before the model started.`, false],
      null,
      [`You subtracted the speech-to-text time only. The model started when the transcript was ready, at ${ms(TR_AT[1])}, so subtract that clock time.`, false],
      [`${ms(TR_TOTAL)} is when the agent started speaking: the whole silence, all four stages together.`, false]
    ];
    const sOpts = STAGES.map(s => NAMES[s]);
    const others = TR_TOTAL - TR.model;
    const sFb = {
      wait: [`The wait is ${ms(TR.wait)}. Cutting it to zero would still leave ${ms(TR_TOTAL - TR.wait)}, far over the budget. It is also the stage you cannot cut freely: wait too little and you talk over her.`, false],
      stt: [`Speech to text took ${ms(TR.stt)}. Even at zero, the call would take ${ms(TR_TOTAL - TR.stt)}.`, false],
      model: [`Right. The model stage alone, ${ms(TR.model)}, is over the ${ms(BUDGET)} budget by itself: even if the other three took no time at all, the call would miss. The other three together took ${ms(others)}: also over the budget, so the model is the first fix, not the only one.`, true],
      tts: [`Text to speech took ${ms(TR.tts)}. Even at zero, the call would take ${ms(TR_TOTAL - TR.tts)}.`, false]
    };
    const paint = () => {
      const rows = [
        ["0 ms", "Maria's last word"],
        [ms(TR_AT[0]), "end of turn decided"],
        [ms(TR_AT[1]), "transcript ready"],
        [ms(TR_AT[2]), "reply text complete"],
        [ms(TR_AT[3]), "reply audio ready: the agent starts speaking"]
      ];
      el.innerHTML = `<h1>Where did ${sec(TR_TOTAL)} go?</h1>
        <p class="lead">We built this pipeline on a laptop and timed one of Maria's calls. Each line below shows when one stage finished, counted from her last word. The clinic's goal is that the agent starts speaking within <b>${ms(BUDGET)}</b>: its <b>latency budget</b>.</p>
        ${log(rows.map(([t, w], i) => [kit.esc(t), kit.esc(w), { now: phase === 0 && i === 3 }]))}
        ${phase === 0 ? `<p class="task">How long did the model itself take?</p>
          <div class="lpanel">${ask(kit, mOpts.map(ms), 1, ans, mFb)}</div>` : `
          ${stageMeter(kit, TR)}
          <p class="task">The model took ${ms(TR.model)}. Which single stage makes this call miss the ${ms(BUDGET)} budget, whatever the others do?</p>
          <div class="lpanel">${ask(kit, sOpts, 2, ans, STAGES.map(s => sFb[s]))}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (phase === 0 && ans === 1) { phase = 1; ans = null; paint(); return; }
        paint();
        if (phase === 1 && ans === 2) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the caller only needs the first sentence to start hearing. */
  function spot({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The whole reply text, as now", "Only the first sentence of the reply", "Only the first word", "Nothing: play a recorded “One moment, please” at once"];
    const fb = [
      [`That is what it does now: Maria sits through ${ms(TR.model)} of writing, then hears audio that lasts ${REPLY_AUDIO_S.toFixed(1)} s. She hears it one sentence after another anyway, so the later sentences could be written while the first one plays.`, false],
      null,
      [`Our text-to-speech step took about ${ms(M.ttsFirst)} even for a short sentence, before any sound was ready. Paying that start-up for every word would make the reply slower and choppy. A sentence is a natural piece to hand over.`, false],
      ["A filler fills the silence but says nothing. Maria still waits just as long for the real answer, and a filler before every reply wears thin. Some agents do say a short filler while a slow lookup runs; it does not replace the fix.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What does she need to hear first?</h1>
        <p class="lead">This is the reply the agent wrote (a small open model on our laptop, ${REPLY_TOKENS} tokens). The agent said nothing until the whole text was ready:</p>
        ${log([["agent", kit.esc(REPLY_FULL).replace(/\n+/g, " ")]])}
        <p class="lx-${ID}-cap">${LOCAL_CAPTION}</p>
        <p class="task">What is the least the agent needs before it can start speaking?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}
        ${ans === 1 ? kit.feedback(`Right. A language model writes its reply a few characters at a time, and the API can send those pieces as they come: that is <b>streaming</b>. The program cuts the stream where the first sentence ends, sends “${kit.esc(FIRST_SENTENCE)}” to text to speech, and keeps reading while it plays. The number the caller feels is the <b>time to first audio</b>, not the time to the full reply.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it with predictions: three fixes, one at a time, then a fourth that fails. */
  function predict({ el, done, kit }) {
    ensureStyle();
    let k = 1, wrong = null, small = null;
    const optsFor = i => {
      const p = PLANS[i], prev = PLANS[i - 1];
      const changed = STAGES.filter(s => p[s] !== prev[s]);
      const half = total(prev) - (p[changed[0]] === prev[changed[0]] ? 0 : prev[changed[0]] - p[changed[0]]); // only the first change
      const set = [total(p)];
      if (changed.length > 1) set.push(half); else set.push(total(prev) - prev[changed[0]]);
      set.push(total(prev));
      return set;
    };
    const why = (i, v) => {
      const p = PLANS[i], prev = PLANS[i - 1];
      if (v === total(prev)) return "That is the old total. This change makes a stage shorter: take the old total and subtract how much each stage under “Measured” went down.";
      const changed = STAGES.filter(s => p[s] !== prev[s]);
      if (changed.length > 1) return `You moved the model stage but not text to speech. Once only the first sentence is spoken first, text to speech has less to do too: ${ms(prev.tts)} becomes ${ms(p.tts)}.`;
      return `You took away the whole ${NAMES[changed[0]]} stage. It does not disappear: it goes from ${ms(prev[changed[0]])} to ${ms(p[changed[0]])}. Subtract only the difference.`;
    };
    const paint = () => {
      const finished = k >= PLANS.length;
      const shown = PLANS.slice(0, Math.min(k, PLANS.length));
      const cur = finished ? PLANS[PLANS.length - 1] : PLANS[k];
      const opts = finished ? [] : optsFor(k).sort((a, b) => a - b);
      const right = finished ? null : total(PLANS[k]);
      const table = kit.table(shown.map(p => [p.name, ms(total(p))]), { head: ["setting", "first sound after"], title: "Median of the timed runs", fresh: shown.length - 1 });
      let body;
      if (!finished) {
        const changes = STAGES.filter(s => cur[s] !== PLANS[k - 1][s]).map(s => `${NAMES[s]}: ${ms(PLANS[k - 1][s])} → ${ms(cur[s])}`).join("; ");
        body = `<p class="lead"><b>Fix ${k}: ${kit.esc(cur.name)}.</b> Measured: ${kit.esc(changes)}.${k === 3 ? ` On this clear test voice, the smaller speech model heard exactly the same words as the larger one. On real phone lines, check that with the word error rate before you switch.` : ""}${k === 2 ? ` (${ms(WAIT.short)} is also the value in OpenAI's example settings for its silence-based turn detection.)` : ""}</p>
          <p class="task">What is the new time to first sound?</p>
          <div class="lpanel">${kit.options(opts.map(ms), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}${wrong != null ? kit.feedback(why(k, wrong), false) : ""}</div>`;
      } else {
        const fits = total(cur) <= BUDGET;
        const smallFb = [
          [`The numbers fit, the reply does not. “${kit.esc(SMALL_REPLY)}” moves nothing: no slot offered, no booking. A fast agent that cannot do the job makes Maria call back. A smaller model is a real option only after you test that it still does the task.`, false],
          [`Right. It is fast because it said almost nothing: “${kit.esc(SMALL_REPLY)}” offers no slot. Speed only counts for replies that do the job. Keep the larger model and keep streaming; try a smaller model only with a test set of real calls that proves it still books correctly.`, true]
        ];
        body = `${stageMeter(kit, cur)}
          ${kit.feedback(`Each stage above is the middle value (median) of the runs with that setting: ${COUNT.sttBase} runs for the larger speech model, ${COUNT.model} for each model setting (whole reply or first sentence). Each total is the sum of its stage medians, not one timed call. With all three fixes the stages add up to ${ms(total(cur))}: ${fits ? `under the budget by ${ms(BUDGET - total(cur))}. That is a thin margin on a busy laptop; a real line adds network time too.` : `still over the budget by ${ms(total(cur) - BUDGET)}.`} Streaming did most of the work: ${fmt((total(PLANS[0]) - total(PLANS[1])) / (total(PLANS[0]) - total(cur)) * 100)}% of the time saved.`, fits)}
          <p class="lead">A teammate tried something else: keep everything as shipped, no streaming, but use a much smaller model. Measured: the model stage took ${ms(M.modelSmall)}; with the other stages that adds up to <b>${ms(total(SMALL_PLAN))}</b>, under the budget. Its whole reply to Maria:</p>
          ${log([["agent", kit.esc(SMALL_REPLY)]])}
          <p class="lx-${ID}-cap">${LOCAL_CAPTION}</p>
          <p class="task">Ship the smaller model instead of streaming?</p>
          <div class="lpanel">${ask(kit, ["Yes, it meets the budget with no extra code", "No"], 1, small, smallFb)}</div>`;
      }
      el.innerHTML = `<h1>Fix it one stage at a time</h1>
        <p class="lead">Timings on a laptop vary from run to run. So we timed every setting three times. For each stage we use the middle value (the <b>median</b>) of all runs where that stage was set the same way. As shipped, the four stages add up to ${ms(total(PLANS[0]))}.</p>
        ${table}${body}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (finished) { small = +b.dataset.i; paint(); if (small === 1) done(); return; }
        const v = opts[+b.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
      });
    };
    paint();
  }

  /* 5. The code: cut the stream into sentences, replayed from a traced run. */
  const CODE = [
    "def speak_as_it_streams(chunks):",
    "    buffer, spoken = \"\", 0",
    "    for chunk in chunks:",
    "        buffer += chunk[\"text\"]",
    "        if buffer.endswith((\".\", \"!\", \"?\")):",
    "            send_to_tts(buffer.strip())",
    "            spoken += 1",
    "            buffer = \"\"",
    "    if buffer.strip():",
    "        send_to_tts(buffer.strip())",
    "    return spoken"
  ];
  const FR = [{ ln: 1, ms: null, buffer: "", spoken: null }, ...SENDS.map(([t, b, n]) => ({ ln: 5, ms: t, buffer: b, spoken: n })), { ln: 10, ms: SENDS[SENDS.length - 1][0], buffer: "", spoken: RETURNED, end: true }];
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const say = f => {
      if (f.end) return `The stream is over at ${ms(f.ms)}: ${CHUNKS} chunks, ${f.spoken} sentences sent, nothing left in <code>buffer</code>. The first sentence went out at ${ms(SENDS[0][0])}, the last at ${ms(f.ms)}. Without streaming, text to speech would have started only at ${ms(f.ms)}.`;
      if (f.ln === 1) return "Nothing has arrived yet. <code>chunks</code> is the model's streamed reply: each chunk is a few characters and the time it arrived.";
      const n = f.spoken + 1;
      return `Chunk at ${ms(f.ms)}: the buffer now ends with a full stop, question mark or exclamation mark, so sentence ${n} goes to text to speech${n === 1 ? ". From here on, the caller can hear the agent while the model keeps writing" : ""}.`;
    };
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The same idea in Python</h1>
        <p class="lead">We streamed Maria's reply from the same model once and kept every chunk with its arrival time. This function replays those chunks. <code>send_to_tts</code> hands a sentence to text to speech. The marked line is about to run.</p>
        <p class="task">Step through to the end. Watch the time on each sentence that is sent.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>chunk arrived <b>${f.ms == null ? "–" : ms(f.ms)}</b></span><span>spoken <b>${f.spoken == null ? "–" : f.spoken}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${f.ln === 5 ? mono(kit, `buffer = ${JSON.stringify(f.buffer)}`) : ""}
        ${kit.feedback(say(f))}
        ${i === FR.length - 1 ? `<p class="lead">Real pipelines cut more carefully (“Dr. Lee” or “10.30” contain a full stop that ends nothing), but the idea is the same: hand finished pieces to text to speech while the model is still writing.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. Broken on purpose: the shorter wait cuts off a caller who pauses. */
  function cutOff({ el, done, kit }) {
    ensureStyle();
    let phase = 0, gap = null, fix = null;
    const fired = PAUSE_END_S.short + WAIT.short / 1000;
    const fixOpts = [
      `Set the wait back to ${ms(WAIT.shipped)} for every caller`,
      "Decide the end of a turn from what she says and how it sounds, not from silence alone: wait less when she sounds finished, longer when she does not",
      "Use the larger speech-to-text model",
      "Tell the language model to ask callers to repeat themselves"
    ];
    const fixFb = [
      [`That fixes this call: her pause was ${ms(PAUSE_GAPS[PAUSE_BIG])}. But every caller now waits the extra ${ms(WAIT.shipped - WAIT.short)} on every turn, and the next caller may pause for longer still. A single silence length always trades speed against cutting people off.`, false],
      null,
      ["The transcript was right about the audio it got: she really had said only that much. The problem is when the audio was cut, not how it was heard.", false],
      ["The model would have to ask after every half sentence, and she would repeat herself on every pause. The cut happened before the model ran: fix the stage that decides the turn is over.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>She was not finished</h1>
        <p class="lead">The clinic shipped the shorter end-of-turn wait, ${ms(WAIT.short)}. Then a caller paused in the middle of a sentence. What she said (the “…” is a pause we put in the script):</p>
        ${log([["caller said", kit.esc(PAUSE_SAID)], ["transcript the model got", kit.esc(PAUSE_HEARD.short), { now: true }]])}
        <p class="lead">The end-of-turn detector treats any stretch quieter than a set level as silence. Below are the silent stretches it found inside her speech, in order, in milliseconds. It decided her turn was over ${ms(WAIT.short)} into one of them, ${fired.toFixed(2)} s into the call audio.</p>
        ${phase === 0 ? `<p class="task">Tap the silence that ended her turn too early.</p>
          ${kit.cells(PAUSE_GAPS.map(g => `${g}`), { pick: true, labels: PAUSE_GAPS.map((_, i) => `${i + 1}`), cls: gap == null ? {} : { [gap]: gap === PAUSE_BIG ? "next" : "dup" } })}
          ${gap != null && gap !== PAUSE_BIG ? kit.feedback(`${ms(PAUSE_GAPS[gap])} is shorter than the ${ms(WAIT.short)} wait, so the detector kept listening through it. Look for a silence at least as long as the wait.`, false) : ""}` : `
          ${kit.cells(PAUSE_GAPS.map(g => `${g}`), { labels: PAUSE_GAPS.map((_, i) => `${i + 1}`), cls: { [PAUSE_BIG]: "next" } })}
          ${kit.feedback(`Right: the ${ms(PAUSE_GAPS[PAUSE_BIG])} pause after “to”. It was longer than the ${ms(WAIT.short)} wait, so the detector ended her turn and sent half a sentence on. With the old ${ms(WAIT.shipped)} wait, the same audio gave: “${kit.esc(PAUSE_HEARD.shipped)}”. (The speech model also wrote “to” as “too”: a small mistake, but it matters below.)`, true)}
          <p class="task">Which fix would you choose?</p>
          <div class="lpanel">${ask(kit, fixOpts, 1, fix, fixFb)}
          ${fix === 1 ? kit.feedback(`Right. This is <b>semantic turn detection</b>: a model judges from the words, and in some tools the sound as well, whether the caller has finished, and silence is only one signal. OpenAI's realtime sessions offer a <code>semantic_vad</code> mode next to the silence-based one, and LiveKit's turn detector model predicts the end of a turn from the meaning and the sound of the speech. We tried a words-only version: we asked a small hosted model whether each transcript was finished. It answered “${kit.esc(REC_TURN.cut)}” for the cut transcript, and “${kit.esc(REC_TURN.full)}” for the whole one, so it would have cut her off too. The cut transcript ends with a full stop and reads like a whole sentence, so the words alone gave this check little to go on. A words-only check is only as good as the transcript. Test the detector on real paused calls, and keep a time limit as a fallback: after a long enough silence, end the turn anyway.<p class="lx-${ID}-cap">${CAPTION}</p>`, true) : ""}</div>`}`;
      if (phase === 0) el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
        gap = +b.dataset.i; paint();
        if (gap === PAUSE_BIG) { phase = 1; paint(); }
      });
      else el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 1) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: after a barge-in, the history holds words she never heard. */
  function bargeIn({ el, done, kit }) {
    ensureStyle();
    let phase = 0, pick = null, fix = null;
    const msgs = [
      ["system", "You answer the phone for Larkspur Dental … Free slots next week: " + SLOTS + ". …"],
      ["caller", MARIA],
      ["agent", FULL_TEXT],
      ["caller", BARGE_HEARD]
    ];
    const pickFb = [
      ["The instructions list the free slots correctly; Wednesday 8:30 is one of them. Nothing in them points to Friday.", false],
      ["Her first turn asks for a morning next week. Every slot offered fits that, so it does not pick Friday.", false],
      null,
      ["Her words are clear: the one you just said. The last slot she heard was Wednesday at half past eight. The words are fine; what the model thinks she heard is not.", false]
    ];
    const fixOpts = [
      "Keep only the phrases that finished playing before she spoke",
      "Delete the agent's message from the history",
      "Keep the full message and tell the model to always confirm the slot"
    ];
    const fixFb = [
      null,
      ["Then the model does not know which slots it offered, or what “the one you just said” refers to. It needs what she heard, not nothing.", false],
      ["A confirmation is a good habit, but the model would confirm the wrong slot: “Friday at ten, right?” It still believes she heard Friday. Fix what the history says she heard.", false]
    ];
    const timeline = log(PHRASES.map(([t, a, b]) => [`${a.toFixed(2)}–${b.toFixed(2)} s`, kit.esc(t), { off: b > BARGE_S }]).concat([[`${BARGE_S.toFixed(2)} s`, `Maria starts talking: “${kit.esc(BARGE_HEARD)}” The agent stops playing.`, { now: true }]]));
    const paint = () => {
      el.innerHTML = `<h1>“The one you just said”</h1>
        <p class="lead">The agent reads out three slots (a short reply we wrote for this test, read by a computer voice). Maria hears the one she wants and talks over it: a <b>barge-in</b>. The agent stops its audio at once. These are the phrases it was playing, with their real playback times; the struck-through ones were cut off or never played.</p>
        ${timeline}
        <p class="lead">Then the program sent the conversation to the model. A small hosted model answered:</p>
        ${log([["agent", kit.esc(REC_FULL.text), { now: true }]])}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        ${phase === 0 ? `<p class="task">She meant Wednesday. The program sent the model a history of four messages. Which one caused this?</p>
          <div class="lpanel">${ask(kit, msgs.map(([w, t]) => `<span class="lx-${ID}-opt"><b>${w}:</b> ${kit.esc(t)}</span>`), 2, pick, pickFb)}</div>` : `
          ${kit.feedback(`Right. The history says the agent said “${kit.esc(FULL_TEXT)}”, but the playback stopped at ${BARGE_S.toFixed(2)} s, during “${kit.esc(PHRASES[PLAYED.length][0])}”. To the model, the last slot “just said” was Friday.`, true)}
          <p class="task">What should the agent's message in the history say?</p>
          <div class="lpanel">${ask(kit, fixOpts, 0, fix, fixFb)}
          ${fix === 0 ? kit.feedback(`Right. With the message cut to “${kit.esc(CUT_TEXT)}”, the same model answered:${log([["agent", kit.esc(REC_CUT.text)]])}<p class="lx-${ID}-cap">${CAPTION}</p>On a barge-in the pipeline does three things: stop the audio at once and drop what is queued, cancel the reply still being written, and cut the history to what was played. OpenAI's realtime docs describe this cut (<code>conversation.item.truncate</code>), and LiveKit's agents trim the history to what the user heard.`, true) : ""}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (phase === 0) { pick = v; if (v === 2) { phase = 1; } paint(); return; }
        fix = v; paint(); if (v === 0) done();
      });
    };
    paint();
  }

  /* 8. One speech-to-speech model instead of three stages (not run by us). */
  function s2s({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The chained pipeline: speech to text, model, text to speech", "One speech-to-speech model", "Either one, it makes no difference"];
    const fb = [
      null,
      ["A speech-to-speech session can call tools too. But with one model doing the hearing, the thinking and the speaking, you cannot swap out only its hearing for a model that knows dental words, and OpenAI's own guide points to the chained pipeline when each stage must be visible or replaceable.", false],
      ["They differ exactly here: in the chain, the transcript and the reply exist as text between the stages, where your code can check them, and each stage is a separate part you can replace.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>One model instead of three</h1>
        <p class="lead"><b>Not run by us.</b> Written from the <a href="https://developers.openai.com/api/docs/guides/voice-agents">official documentation</a>, checked 2026-11-18.</p>
        <p class="lead">There is a second way to build a voice agent: a <b>speech-to-speech</b> model takes the caller's audio in and gives audio out, in one session. OpenAI's Realtime API is one example: its guide says one model interprets the audio, decides what to do and answers in speech, and the session handles turns, tools and interruptions. The chain you built keeps text between the stages: the same guide says it lets you inspect or change that text, and replace each part on its own.</p>
        <p class="task">The clinic needs two things. Before any reply is spoken, its own code must check that the slot offered is really free in the calendar. Next year it wants to try a speech-to-text model trained on dental words. Which build fits?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}
        ${ans === 0 ? kit.feedback("Right. The reply exists as text before it becomes audio, so your code can check it, and speech to text is its own part, so it can be replaced alone. Reach for one speech-to-speech model when you want fewer parts to wire together and its session's handling of turns and interruptions, and you can accept less control over each step.", true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["More tokens per reply", "Her listening time: she cannot skim or skip ahead", "Storing the call audio"];
    const fb = [
      [`The tokens are the same ${REPLY_TOKENS} whether the reply is shown or spoken. In a chat window she would read them in a few seconds.`, false],
      [`Right. Read aloud, the as-shipped reply lasted ${REPLY_AUDIO_S.toFixed(1)} s. In a chat window she would skim it. On the phone she must sit through every word before she can answer, and a list of slots is hard to hold in her head. Voice replies should be short: one or two options at a time.`, true],
      ["Storage is cheap next to the time a caller spends on the line, and it is the same for every reply length you would choose.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to give an agent a voice</h1>
        <p class="lead"><b>For:</b> people who call, or whose hands and eyes are busy: booking, simple support, short questions with short answers.</p>
        <p class="lead"><b>Not</b> for long lists, tables or numbers to compare (show a screen), exact strings such as email addresses or account numbers (speech to text mishears letters; send a link to a form), or very noisy places. If a chat box does the job, it is cheaper and easier to test.</p>
        <p class="lead"><b>Costs:</b> three models, or one speech-to-speech model, run on every turn and paid for per use or per server; work to keep the silence short; turn-taking bugs that only show up with real voices; and testing with audio, not just text.</p>
        <p class="task">Which cost does a long reply add on the phone that it does not add in a chat window?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A warehouse picker wears a headset. Both hands carry boxes. She asks for the next bin and says “done” when a pick is made.", true,
      "Yes. Her hands and eyes are busy, the turns are short, and the answers are short. That is where a voice agent pays for its cost.",
      "Her hands are full and her eyes are on the shelves. A screen would make her put the boxes down. Short questions, short answers: a good fit for voice."],
    ["Patients want to compare a year of blood-test results, twelve values each month, to see trends.", false,
      "No. Twelve values a month for a year is a table to scan and compare. Spoken, the patient must hold each number in memory while the next is read. Show a chart or a table on a screen.",
      "Read aloud, that is well over a hundred numbers, one after another, with no way to look back. Voice is linear; comparing needs a screen."],
    ["A locksmith wants a night line: callers say where they are locked out, the agent asks a few questions and books the next free visit.", true,
      "Yes. People who are locked out phone; a short spoken back and forth books a visit. Keep the end-of-turn wait patient: stressed callers pause.",
      "People already phone a locksmith, and the exchange is a few short turns. That is the voice agent's home ground; budget the latency and handle interruptions."],
    ["A bank's refund flow needs the customer's IBAN, a long code of letters and digits, exactly right.", false,
      "No. Speech to text mishears single letters and digits, and spelling a long code back and forth is slow. Send a link to a form where they type it, or let the voice agent hand over to one.",
      "One misheard character sends money to the wrong account. Exact strings are what speech to text gets wrong most easily. A typed form is safer and faster."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Voice or not?</h1>
        <p class="lead">Four requests from other places.</p>
        <p class="task">Would you build each one as a voice agent? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can budget a voice reply</h1>
      <p class="lead">You split a slow reply into its four stages, found that waiting for the whole reply text was the problem, and cut the time to first sound from ${ms(total(PLANS[0]))} to ${ms(total(PLANS[PLANS.length - 1]))} by speaking at the first sentence, a shorter wait and a smaller speech model. You also saw what the shorter wait broke, and why the history must hold only what the caller heard.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Voice gave the agent ears and a mouth; next it gets eyes and a mouse, and you will meet the same trade: slower and more fragile than an API, but sometimes the only way in.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Voice agents: speech in, speech out, and the latency budget",
    checked: "2026-11-18",
    sources: [
      "https://developers.openai.com/api/docs/guides/voice-agents",
      "https://developers.openai.com/api/docs/guides/realtime-vad",
      "https://developers.openai.com/api/docs/guides/realtime-conversations",
      "https://docs.livekit.io/agents/logic/turns/",
      "https://docs.ollama.com/api/chat",
      "https://github.com/ggml-org/whisper.cpp",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC2705608/"
    ],
    interview: [
      {
        q: "Your phone agent takes about four seconds to start answering and callers keep saying “hello?”. How do you find and cut the delay?",
        good: [
          "Log a timestamp at the end of each stage: end-of-turn decision, transcript ready, model output, first audio",
          "Measure time to first audio, not time to the full reply, since that is what the caller hears",
          "Stream the model's reply and send the first sentence to text to speech while the rest is written",
          "Then tune the end-of-turn wait, and consider faster speech to text, checking the error rate on real calls",
          "Prompt for short replies with one or two options, which also shortens the audio"
        ],
        weak: "Switch to a faster model. Without timing each stage you do not know where the time goes, and a smaller model may stop doing the job."
      },
      {
        q: "Callers say the agent cuts them off mid-sentence, and after they interrupt it, it sometimes books a slot they never heard. What is going on?",
        good: [
          "The end-of-turn detector fires on any silence longer than its wait, so a pause mid-sentence ends the turn",
          "Raising the wait for everyone slows every turn; use turn detection that looks at the words and sound, with a longest-wait fallback",
          "On a barge-in, the full reply text stays in the history although playback stopped",
          "Stop audio, cancel the reply, and cut the history to what was actually played",
          "Test both with recorded real calls: paused speech and interruptions"
        ],
        weak: "Tell the model in the prompt to wait longer and to confirm slots. The model never sees the pause, and it would confirm the slot it wrongly believes was heard."
      }
    ],
    screens: [order, trace, spot, predict, asCode, cutOff, bargeIn, s2s, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(4).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(4).fill("[data-right]") },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-i=\"0\"]"], right: [`[data-i="${PAUSE_BIG}"]`, "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
