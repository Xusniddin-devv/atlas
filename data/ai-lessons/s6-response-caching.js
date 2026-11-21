/* Lesson s6-response-caching: Exact and semantic caching of answers.
   Story: the admissions office of Halden University (made up for this lesson). Its bot answers "when is the
   application deadline" hundreds of times a day, and every time it pays for a fresh model call.
   Ideas: (1) an exact-match cache stores the finished answer under the question text, made a little more
   forgiving by normalising the key (lower case, trimmed); (2) a similarity cache compares embeddings and reuses an
   answer above a threshold, and because look-alike questions can score higher than real paraphrases, the
   threshold is a trade between hits and wrong answers. Answer caching skips the model; prompt caching does not.
   Depth: explain (screens 1-5, 8-10, interview), scratch (screens 3, 5, 6: the cache built from scratch in
   Python and NumPy, stepped from a real trace), debug (screen 7: a real run at a too-low threshold),
   when-not (screens 9 and 10).
   Data, all from 2026-11-13:
     model answers: four recorded calls, docs/ai-path/recordings/s6-response-caching/{deadline-1,deadline-2,
       spring-1,intl-1}.json in the main checkout (request files written by make_requests.py);
     similarity scores: docs/ai-path/runs/s6-response-caching/scores.py -> scores.out.txt (a small open embedding
       model, all-minilm, run locally with Ollama; see env.txt);
     exact cache: exact.py -> exact.out.txt; full cache at two thresholds: similar.py -> similar.out.txt;
     the stepped code screen: trace.py -> trace.out.txt (cache.serve traced line by line).
   The questions and the university's facts are written for this lesson (data.py), not real students.
   Every derived number on screen (counts, ratios, totals) is computed here from those copied values.
   Lesson-local CSS (question buttons, log table, answer box, code lines wrapped with a hanging indent at phone width) is injected by style(). Plain browser script. */
(() => {
  const ID = "s6-response-caching", P = "lx-" + ID + "-";
  const RUN_DATE = "2026-11-13";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (a, b) => Math.round(a / b * 100);
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

  // From docs/ai-path/recordings/s6-response-caching/<name>.json: choices[0].message.content (not trimmed, not
  // altered) and response.usage (prompt_tokens, completion_tokens, prompt_tokens_details.cached_tokens, cost).
  const REC_META = { src: "s6-response-caching/<name>", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13" };
  const REC = {
    "deadline-1": { q: "When is the application deadline?", at: "2026-11-13T14:54:59.434Z", prompt: 207, out: 20, cached: 0, cost: 0.0000287,
      text: "Fall 2027 undergraduate applications close on January 15, 2027." },
    "deadline-2": { q: "When is the application deadline?", at: "2026-11-13T14:55:00.582Z", prompt: 207, out: 17, cached: 0, cost: 0.0000275,
      text: "The fall undergraduate application deadline is January 15, 2027." },
    "spring-1": { q: "When is the application deadline for spring?", at: "2026-11-13T14:55:01.567Z", prompt: 209, out: 21, cached: 0, cost: 0.0000293,
      text: "Spring 2027 undergraduate applications close on October 1, 2026." },
    "intl-1": { q: "When is the application deadline for international students?", at: "2026-11-13T14:55:02.530Z", prompt: 210, out: 33, cached: 0, cost: 0.0000342,
      text: "International applicants for fall 2027 must apply by December 1, 2026. This date allows ample time for the student visa process." }
  };
  const secs = (a, b) => ((Date.parse(REC[b].at) - Date.parse(REC[a].at)) / 1000).toFixed(1);

  // From docs/ai-path/runs/s6-response-caching/data.py (written for the lesson) with the cosine similarity to
  // QUESTIONS[0] from scores.out.txt. group = which answer the question deserves.
  const QUESTIONS = [
    ["When is the application deadline?", "fall", 1.0],
    ["When is the application deadline for spring?", "spring", 0.8294],
    ["What's the last day to apply?", "fall", 0.5987],
    ["How much is the application fee?", "fee", 0.4236],
    ["By what date do I have to submit my application?", "fall", 0.7355],
    ["When is the application deadline for international students?", "intl", 0.7750],
    ["Application deadline?", "fall", 0.9217],
    ["When is the deadline for graduate programs?", "grad", 0.7368],
    ["When will I hear back about my application?", "decision", 0.6170],
    ["when is the application deadline", "fall", 0.9807]
  ];
  const VEC_SIZE = 384; // scores.out.txt: "vector size: 384", "norms: [1.0]"
  // From data.py: what each group's right answer says (the facts in the bot's system prompt).
  const GROUP_FACT = {
    fall: "fall undergraduate applications close on January 15, 2027",
    spring: "spring applications close on October 1, 2026",
    intl: "international applicants must apply by December 1, 2026",
    grad: "graduate applications close on March 1, 2027",
    fee: "the fee is 60 US dollars",
    decision: "fall decisions come out by April 1, 2027"
  };
  // From data.py: the fall and international deadlines as dates, so the gap between them is computed.
  const FALL_DATE = "2027-01-15", INTL_DATE = "2026-12-01";
  const daysBefore = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const STORED = 0;
  const SAME = QUESTIONS.map((q, i) => i !== STORED && q[1] === "fall" ? i : -1).filter(i => i >= 0);
  const LOOKALIKE = ["spring", "intl", "grad"];
  const ALIKE = QUESTIONS.map((q, i) => LOOKALIKE.includes(q[1]) ? i : -1).filter(i => i >= 0);

  // From data.py (STREAM) and exact.out.txt: one morning, in arrival order; raw and normalised key hit (1) or miss (0).
  const STREAM = [
    "When is the application deadline?", "How much is the application fee?", "When is the application deadline?",
    "when is the application deadline", "What's the last day to apply?", "When is the application deadline?",
    "When is the application deadline for spring?", "How much is the application fee?", "When is the application deadline? ",
    "By what date do I have to submit my application?", "When is the application deadline for international students?", "Application deadline?"
  ];
  const RAW_HIT = [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0];
  const NORM_HIT = [0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0];
  const norm = q => q.toLowerCase().replace(/^[ ?]+|[ ?]+$/g, "").split(/\s+/).join(" ");
  const groupOf = q => (QUESTIONS.find(x => norm(x[0]) === norm(q)) || [])[1];

  // From similar.out.txt: the full cache over STREAM. [outcome, best score or null, best stored key or null]
  const SIM = {
    0.85: [["miss", -1.0, null], ["miss", 0.4236, "when is the application deadline"], ["exact hit", null, null], ["exact hit", null, null],
      ["miss", 0.5987, "when is the application deadline"], ["exact hit", null, null], ["miss", 0.8294, "when is the application deadline"],
      ["exact hit", null, null], ["exact hit", null, null], ["miss", 0.7355, "when is the application deadline"],
      ["miss", 0.775, "when is the application deadline"], ["similar hit", 0.9217, "when is the application deadline"]],
    0.75: [["miss", -1.0, null], ["miss", 0.4236, "when is the application deadline"], ["exact hit", null, null], ["exact hit", null, null],
      ["miss", 0.5987, "when is the application deadline"], ["exact hit", null, null], ["similar hit", 0.8294, "when is the application deadline"],
      ["exact hit", null, null], ["exact hit", null, null], ["miss", 0.7355, "when is the application deadline"],
      ["similar hit", 0.775, "when is the application deadline"], ["similar hit", 0.9217, "when is the application deadline"]]
  };
  const calls = t => SIM[t].filter(r => r[0] === "miss").length;
  // a hit is wrong when the stored question it reused deserves a different answer
  const wrongServe = (t, i) => SIM[t][i][0] === "similar hit" && groupOf(SIM[t][i][2]) !== groupOf(STREAM[i]);

  // From trace.out.txt: cache.serve traced on four questions in a row (threshold 0.85, empty cache at the start).
  // A step: [line about to run (0 = def), event "l" line or "r" return, key, best, score, answer set?]
  const CODE = [
    "def serve(question, cache, threshold):",
    "    key = normalise(question)",
    "    if key in cache.answers:",
    "        return cache.answers[key], \"exact hit\"",
    "    vec = embed(question)",
    "    best, score = cache.nearest(vec)",
    "    if score >= threshold:",
    "        return cache.answers[best], \"similar hit\"",
    "    answer = call_model(question)",
    "    cache.add(key, vec, answer)",
    "    return answer, \"miss\""
  ];
  const K0 = "when is the application deadline", K2 = "application deadline", K3 = "when is the application deadline for spring";
  const TRACE = [
    { q: "When is the application deadline?", result: "miss", ans: "deadline-1", steps: [
      [1, "l", null, null, null, 0], [2, "l", K0, null, null, 0], [4, "l", K0, null, null, 0], [5, "l", K0, null, null, 0],
      [6, "l", K0, null, -1.0, 0], [8, "l", K0, null, -1.0, 0], [9, "l", K0, null, -1.0, 1], [10, "l", K0, null, -1.0, 1], [10, "r", K0, null, -1.0, 1]] },
    { q: "when is the application deadline", result: "exact hit", ans: "deadline-1", steps: [
      [1, "l", null, null, null, 0], [2, "l", K0, null, null, 0], [3, "l", K0, null, null, 0], [3, "r", K0, null, null, 0]] },
    { q: "Application deadline?", result: "similar hit", ans: "deadline-1", steps: [
      [1, "l", null, null, null, 0], [2, "l", K2, null, null, 0], [4, "l", K2, null, null, 0], [5, "l", K2, null, null, 0],
      [6, "l", K2, K0, 0.9217, 0], [7, "l", K2, K0, 0.9217, 0], [7, "r", K2, K0, 0.9217, 0]] },
    { q: "When is the application deadline for spring?", result: "miss", ans: "spring-1", steps: [
      [1, "l", null, null, null, 0], [2, "l", K3, null, null, 0], [4, "l", K3, null, null, 0], [5, "l", K3, null, null, 0],
      [6, "l", K3, K0, 0.8294, 0], [8, "l", K3, K0, 0.8294, 0], [9, "l", K3, K0, 0.8294, 1], [10, "l", K3, K0, 0.8294, 1], [10, "r", K3, K0, 0.8294, 1]] }
  ];
  const SAFE_T = 0.85, LOW_T = 0.75;

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}qs { margin: 14px 0 0; display: grid; gap: 8px; }
.${P}q { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; text-align: left; min-height: 44px; padding: 9px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font: 500 15px/1.4 var(--font); overflow-wrap: anywhere; }
button.${P}q { cursor: pointer; }
.${P}q .n { font: 600 12px var(--mono); color: var(--muted); min-width: 22px; }
.${P}q .t { flex: 1; }
.${P}q .s { font: 600 13px var(--mono); color: var(--ink-2); white-space: nowrap; }
.${P}q.ok { border-color: var(--good); background: var(--good-soft); }
.${P}q.no { border-color: var(--bad); background: var(--bad-soft); }
.${P}q.on { border-color: var(--ink); border-width: 2.5px; }
.${P}q.gone { opacity: .5; }
.${P}q.line { border-style: dashed; justify-content: center; font: 600 13px var(--mono); color: var(--ink-2); min-height: 0; padding: 4px 10px; background: transparent; }
.${P}sp { font: 600 12px var(--mono); color: var(--muted); }
.${P}ans { margin: 10px 0 0; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--bg); font: 500 14px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}cap { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.${P}lab { margin: 14px 0 0; font: 700 12px var(--mono); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
.${P}log { width: 100%; border-collapse: collapse; margin: 12px 0 0; font: 500 13px/1.4 var(--mono); color: var(--ink); }
.${P}log caption { text-align: left; font: 600 13px var(--font); color: var(--muted); padding-bottom: 6px; }
.${P}log th, .${P}log td { border-bottom: 1px solid var(--line); padding: 7px 6px; text-align: left; vertical-align: top; }
.${P}log th { font-weight: 700; color: var(--ink-2); }
.${P}log td.r { text-align: right; white-space: nowrap; }
.${P}case { margin-top: 18px; }
.${P}case > p { margin: 0 0 6px; font-weight: 600; }
.${P}big ul { margin: 8px 0 0; padding-left: 20px; }
.${P}big li { margin: 4px 0; }
.${P}two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
@media (max-width: 520px) { .${P}two { grid-template-columns: 1fr; } .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 8ch); text-indent: -8ch; } }
`;
    document.head.appendChild(s);
  }
  const answerBox = (key, lead) => `${lead ? `<p class="${P}cap">${lead}</p>` : ""}<div class="${P}ans">${esc(REC[key].text)}</div><p class="${P}cap">Recorded model output, ${REC_META.recordedAt}</p>`;
  const showSpaces = q => esc(q).replace(/ $/, `<span class="${P}sp">␣</span>`);
  // a question as a box or button: { i, text, cls, pick, score, num }
  const qBox = ({ i, text, cls = "", pick = false, score = null, num = null }) => {
    const T = pick ? "button" : "div";
    return `<${T}${pick ? ' type="button"' : ""} class="${P}q ${cls}" data-i="${i}">${num != null ? `<span class="n">${num}</span>` : ""}<span class="t">${showSpaces(text)}</span>${score != null ? `<span class="s">${score.toFixed(2)}</span>` : ""}</${T}>`;
  };

  /* 1. The situation: two students, the same question, one second apart. What did the second call cost? */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const a = REC["deadline-1"], b = REC["deadline-2"];
    const opts = [
      "Almost nothing: the provider saw the same question and sent back the stored answer",
      "About the same as the first: the model read the whole prompt and wrote the answer again",
      "Much less: prompt caching reused the first call's work on the prompt"
    ];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>The deadline question, paid for every time</h1>
        <p class="lead">Halden University's admissions office runs a help bot. The university and its dates are made up for this lesson; the calls below are real calls to a small hosted model. Hundreds of times a day, someone asks when the application deadline is, and every time the bot sends the question, with the office's facts, to the model.</p>
        <p class="lead">Two students asked the exact same question, ${secs("deadline-1", "deadline-2")} seconds apart. The first call used ${a.prompt} input tokens and ${a.out} output tokens.</p>
        <p class="task">Predict: what did the second call cost, compared with the first?</p>
        ${answerBox("deadline-1", "First student, what the model answered:")}
        ${ok ? answerBox("deadline-2", "Second student, what the model answered:") : ""}
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The second call used ${b.prompt} input and ${b.out} output tokens, and cost ${pct(b.cost, a.cost)}% of the first (${b.cost} against ${a.cost} US dollars, prices on ${REC_META.recordedAt}). The model wrote the same fact in new words. The API did not reuse the first answer: each question was a full, paid call, and each student waited for it. The office could store the first answer and hand it to the second student. That is an <b>answer cache</b> (also called a response cache), and this lesson builds one.`, true)
          : ans === 0 ? kit.feedback(`The provider stores no answers. The second call reported ${b.prompt} input and ${b.out} output tokens, a full call, and the model wrote the answer in different words: "${esc(b.text)}". If you want answers reused, your own app has to store them.`, false)
          : kit.feedback(`Both calls report <code>cached_tokens</code>: ${a.cached}. This prompt is only about ${a.prompt} tokens. That is too short: the providers in the prompt caching lesson only cache prompts above a minimum length. And even on a cache hit, prompt caching only skips re-reading the prompt: the model still writes and bills a new answer.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. By hand: which questions deserve the stored answer, and which look alike but must not get it. */
  const WHY_NOT = {
    spring: `This asks about spring. The stored answer gives the fall date; ${GROUP_FACT.spring}.`,
    intl: `This asks about international students. The stored answer gives January 15, but ${GROUP_FACT.intl}, ${daysBefore(INTL_DATE, FALL_DATE)} days earlier.`,
    grad: `This asks about graduate programs: ${GROUP_FACT.grad}, not January 15.`,
    fee: `This asks about money, not a date: ${GROUP_FACT.fee}.`,
    decision: `This asks when decisions come out, not when to apply: ${GROUP_FACT.decision}.`
  };
  function byHand({ el, done, kit }) {
    style();
    const found = new Set();
    let miss = null, alike = null, stage = 1, note = null;
    const paint = () => {
      const fin = alike != null;
      el.innerHTML = `<h1>Which questions deserve the same answer?</h1>
        <p class="lead">These are the bot's most common questions from one week (written for this lesson). The office has stored the answer to the first one.</p>
        ${qBox({ i: STORED, text: QUESTIONS[STORED][0], cls: "on" })}
        ${answerBox("deadline-1", "Stored answer:")}
        <p class="task">${stage === 1 ? `Tap every question below that should get exactly this stored answer.` : `Now tap a question that shares most of its words with the stored one but must <b>not</b> get its answer.`}</p>
        <div class="${P}qs">${QUESTIONS.map((q, i) => i === STORED ? "" : qBox({ i, text: q[0], pick: !fin && !found.has(i),
          cls: found.has(i) ? "ok" : alike === i ? "on" : miss === i ? "no" : "" })).join("")}</div>
        <div class="lpanel">${fin
          ? kit.feedback(`Right. "${esc(QUESTIONS[alike][0])}" shares most of its words with the stored question, but its answer is different: ${esc(GROUP_FACT[QUESTIONS[alike][1]])}. You just sorted ${QUESTIONS.length - 1} questions by meaning, not by shared words. Keep both groups in mind: the questions that should share an answer, and the look-alikes that must not.`, true)
          : miss != null ? kit.feedback(stage === 1 ? esc(WHY_NOT[QUESTIONS[miss][1]])
            : SAME.includes(miss) ? "This one should get the stored answer: you already put it in that group."
            : `It does need a different answer, but it shares few words with the stored question. Look for one that reads almost the same.`, false)
          : note ? kit.feedback(note) : ""}</div>`;
      el.querySelectorAll(`button.${P}q`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i, g = QUESTIONS[i][1];
        miss = null; note = null;
        if (stage === 1) {
          if (g === "fall") {
            found.add(i);
            const left = SAME.length - found.size;
            note = left ? `Yes, the same question in other words. ${left} more.` : null;
            if (!left) { stage = 2; note = `All ${SAME.length} found. Different words, different letter case, one answer.`; }
          } else miss = i;
        } else if (ALIKE.includes(i)) alike = i;
        else miss = i;
        paint();
        if (alike != null) done();
      });
    };
    paint();
  }

  /* 3. Exact-match cache: which questions of one morning are hits, raw key then normalised key. */
  function exactCache({ el, done, kit }) {
    style();
    let stage = 1, miss = null;
    const got = new Set();
    const rawHits = RAW_HIT.map((h, i) => h ? i : -1).filter(i => i >= 0);
    const newHits = NORM_HIT.map((h, i) => h && !RAW_HIT[i] ? i : -1).filter(i => i >= 0);
    const rawCalls = RAW_HIT.filter(h => !h).length, normCalls = NORM_HIT.filter(h => !h).length;
    const target = () => stage === 1 ? rawHits : newHits;
    const paint = () => {
      const fin = stage === 3;
      const hit = i => (stage >= 2 && RAW_HIT[i]) || got.has(i);
      el.innerHTML = `<h1>First cache: the exact question as the key</h1>
        <p class="lead">The simplest answer cache is a Python dict, like a JavaScript object: the key is the question, the value is the stored answer. A question that is already a key is a <b>hit</b>: the answer comes back at once, with no model call. Anything else is a <b>miss</b>: call the model, then store the answer. Here is one morning of questions, in arrival order, starting with an empty dict. (␣ marks a space at the end.)</p>
        <p class="task">${stage === 1 ? "The key is the text exactly as typed. Tap every question that is a hit."
          : stage === 2 ? `Now the key is normalised first: <code>" ".join(question.lower().strip(" ?").split())</code> (lower case, spaces and question marks trimmed from the ends, runs of spaces inside made single). Tap the questions that become new hits.` : "Done."}</p>
        <div class="${P}qs">${STREAM.map((q, i) => qBox({ i, num: i + 1, text: q, pick: !fin && !hit(i), cls: hit(i) ? "ok" : miss === i ? "no" : "" })).join("")}</div>
        <div class="lpanel">${fin
          ? kit.feedback(`The run agrees: with the raw key, ${rawCalls} of ${STREAM.length} questions went to the model; with the normalised key, ${normCalls}. An exact cache is safe, since it only reuses an answer for the same text, but it is narrow. "What's the last day to apply?" and "Application deadline?" are still misses, and no amount of trimming makes them the same text.`, true)
          : miss != null ? kit.feedback(missWhy(miss), false)
          : stage === 2 && got.size === 0 ? kit.feedback(`With the raw key: ${rawHits.length} hits, ${rawCalls} model calls out of ${STREAM.length}.`) : ""}</div>`;
      el.querySelectorAll(`button.${P}q`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (!target().includes(i)) { miss = i; paint(); return; }
        miss = null; got.add(i);
        if (target().every(j => got.has(j))) { stage++; if (stage === 2) got.clear(); else newHits.forEach(j => got.add(j)); }
        paint();
        if (stage === 3) done();
      });
    };
    const missWhy = i => {
      const q = STREAM[i], first = STREAM.indexOf(q);
      const earlierSameNorm = STREAM.slice(0, i).some(x => norm(x) === norm(q));
      if (first < i) return "This text did arrive before, but it is already marked as a hit.";
      if (stage === 1 && earlierSameNorm) return `Close, but not the same text. "${showSpaces(q)}" differs from the earlier question by ${q.endsWith(" ") ? "a space at the end" : "its letter case and the missing question mark"}. A dict compares keys character by character, so this is a different key: a miss.`;
      if (first === i && !earlierSameNorm) return stage === 1
        ? `This exact text has not arrived before question ${i + 1}, so the dict has no key for it: a miss.`
        : `After normalising, the key is "${esc(norm(q))}". No earlier question has that key, so it is still a miss.`;
      return "This one is a miss.";
    };
    paint();
  }

  /* 4. Spot the idea: compare meanings, and reuse above a line. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      `Normalise harder: also drop small words like "when", "is" and "the" before comparing`,
      `Reuse the stored answer for any question that contains the word "deadline"`,
      "Compare the meaning of the questions as vectors, and reuse an answer when they are close enough"
    ];
    const spring = QUESTIONS.findIndex(q => q[1] === "spring");
    const paint = () => {
      const ok = ans === 2;
      el.innerHTML = `<h1>Reusing an answer for a question in other words</h1>
        <p class="lead">"What's the last day to apply?" and "By what date do I have to submit my application?" deserve the stored answer, but they share almost no words with it. Each still costs a model call.</p>
        <p class="task">Which rule could reuse the stored answer for them?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 2 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. An embedding model turns a text into a list of numbers, a vector, so that texts with similar meaning get vectors that point in similar directions. You compared vectors by cosine similarity in the vector index lesson: 1 means the same direction. A cache that keeps the vector of each stored question, and reuses an answer when a new question scores above a chosen line, is a <b>similarity cache</b> (often called a <b>semantic cache</b>). That line is the <b>threshold</b>, and choosing it is the hard part.`, true)
          : ans === 0 ? kit.feedback(`"What's the last day to apply?" has no word in common with "application deadline", even after dropping small words. The match you need is between meanings, not between strings.`, false)
          : kit.feedback(`That rule would send the stored fall date to "${esc(QUESTIONS[spring][0])}", and to the international and graduate questions you sorted out by hand. It would still miss "What's the last day to apply?", which has no "deadline" in it.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 5. Use it: predict a score, then pick the lowest threshold that serves no wrong answer. */
  const T_OPTS = [0.6, 0.7, 0.75, 0.8, 0.85, 0.95];
  const atT = t => {
    const above = QUESTIONS.map((q, i) => i !== STORED && q[2] >= t ? i : -1).filter(i => i >= 0);
    return { hits: above.filter(i => QUESTIONS[i][1] === "fall"), wrong: above.filter(i => QUESTIONS[i][1] !== "fall") };
  };
  const SAFE = T_OPTS.find(t => atT(t).wrong.length === 0);
  function threshold({ el, done, kit }) {
    style();
    const iLast = QUESTIONS.findIndex(q => q[0] === "What's the last day to apply?");
    const iSpring = QUESTIONS.findIndex(q => q[1] === "spring");
    const higher = QUESTIONS[iSpring][2] > QUESTIONS[iLast][2] ? 1 : 0;
    let pred = null, t = null;
    const paint = () => {
      const seen = pred === higher;
      const r = t == null ? null : atT(t), tOk = t === SAFE;
      const order = QUESTIONS.map((q, i) => i).filter(i => i !== STORED).sort((a, b) => QUESTIONS[b][2] - QUESTIONS[a][2]);
      const lineAt = t == null ? -1 : order.findIndex(i => QUESTIONS[i][2] < t);
      const rows = order.map((i, k) => (k === lineAt ? `<div class="${P}q line">threshold ${t.toFixed(2)}</div>` : "") + qBox({ i, text: QUESTIONS[i][0], score: QUESTIONS[i][2],
        cls: r == null ? "" : QUESTIONS[i][2] >= t ? (QUESTIONS[i][1] === "fall" ? "ok" : "no") : "gone" })).join("") + (t != null && lineAt < 0 ? `<div class="${P}q line">threshold ${t.toFixed(2)}</div>` : "");
      const sameMissed = SAME.filter(i => QUESTIONS[i][2] < SAFE);
      el.innerHTML = `<h1>Where do you draw the line?</h1>
        <p class="lead">We embedded all ${QUESTIONS.length} questions with a small open embedding model, run on our own machine (${VEC_SIZE} numbers per question), and scored each one against the stored question by cosine similarity.</p>
        ${seen ? "" : `<p class="task">Predict first: which of these two scored higher against "${esc(QUESTIONS[STORED][0])}"?</p>`}
        ${seen ? "" : kit.options([esc(QUESTIONS[iLast][0]) + " (same answer)", esc(QUESTIONS[iSpring][0]) + " (different answer)"], { picked: pred, correct: higher })}
        ${pred != null && !seen ? kit.feedback(`It is the other way round: "${esc(QUESTIONS[iSpring][0])}" scored ${QUESTIONS[iSpring][2].toFixed(2)}, "${esc(QUESTIONS[iLast][0])}" only ${QUESTIONS[iLast][2].toFixed(2)}. The spring question repeats almost every word of the stored one, and similarity follows the wording a lot, not only the meaning.`, false) : ""}
        ${seen ? `${kit.feedback(`Right: the spring question scored ${QUESTIONS[iSpring][2].toFixed(2)}, the same-answer question only ${QUESTIONS[iLast][2].toFixed(2)}. Here are all the scores, highest first. Questions above the threshold get the stored answer.`)}
          <p class="task">Pick the lowest threshold that gives no student a wrong answer.</p>
          ${kit.options(T_OPTS.map(x => x.toFixed(2)), { picked: t == null ? null : T_OPTS.indexOf(t), correct: T_OPTS.indexOf(SAFE), num: true })}
          <div class="${P}qs">${rows}</div>
          ${kit.pics.key([["enter", "gets the stored answer, rightly"], ["no", "gets the stored answer, wrongly"], ["gone", "below the line: calls the model"]])}` : ""}
        <div class="lpanel">${r == null ? "" : tOk
          ? kit.feedback(`Right. At ${SAFE.toFixed(2)} no look-alike gets the fall date, and ${r.hits.length} of the ${SAME.length} same-answer questions are reused. The price: ${sameMissed.map(i => `"${esc(QUESTIONS[i][0])}" (${QUESTIONS[i][2].toFixed(2)})`).join(" and ")} still go to the model, because a look-alike scored above them. No line separates the two groups here. A safe threshold gives fewer wrong answers, and you pay for that with fewer hits.`, true)
          : r.wrong.length ? kit.feedback(`At ${t.toFixed(2)}, ${r.wrong.map(i => `"${esc(QUESTIONS[i][0])}" (${QUESTIONS[i][2].toFixed(2)}) would be told the fall date, but ${esc(GROUP_FACT[QUESTIONS[i][1]])}`).join("; ")}. Raise the line above the highest look-alike.`, false)
          : kit.feedback(`Safe, but higher than it needs to be: it reuses only ${r.hits.length} of the ${SAME.length} same-answer questions${r.hits.length ? ` (${r.hits.map(i => `"${esc(QUESTIONS[i][0])}"`).join(", ")})` : ""}. A lower line also gives no wrong answer and reuses more.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => {
        if (!seen) { pred = +x.dataset.i; paint(); return; }
        t = T_OPTS[+x.dataset.i]; paint(); if (t === SAFE) done();
      });
    };
    paint();
  }

  /* 6. The same cache in Python, stepped from a real trace; predict each question's outcome first. */
  const FR = [];
  TRACE.forEach((c, qi) => c.steps.forEach((s, k) => FR.push({ qi, k, s })));
  const OUTCOMES = ["miss: call the model", "exact hit", "similar hit"];
  const OUT_KEY = ["miss", "exact hit", "similar hit"];
  const SAY_WRONG = [
    ["", "The cache is empty: this is the first question of the day. There is no key to match.", "The cache is empty: there is no stored vector to compare with."],
    ["After lower-casing and trimming, this text becomes exactly the stored key, so the dict finds it.", "", "The code never gets to the vectors: the normalised key is already in the dict, so line 3 returns first."],
    [`It scores ${TRACE[2].steps[4][4]} against the stored question, above the ${SAFE_T} line, so it is reused.`, `After normalising, the key is "${K2}", not the stored "${K0}": the dict has no such key.`, ""],
    ["", `After normalising, the key is "${K3}". The dict has no such key.`, `It scores ${TRACE[3].steps[4][4]}, below the ${SAFE_T} line you chose. That is exactly the look-alike the line keeps out.`]
  ];
  function asCode({ el, done, kit }) {
    style();
    let i = 0;
    const pred = TRACE.map(() => null);
    const paint = () => {
      const f = FR[i], c = TRACE[f.qi], [ln, ev, key, best, score, hasAns] = f.s;
      const right = OUT_KEY.indexOf(c.result);
      const needPred = f.k === 0 && pred[f.qi] !== right;
      const last = i === FR.length - 1;
      const say = ev === "r" ? `Returns <b>${esc(c.result)}</b>: "${esc(REC[c.ans].text)}"`
        : ln === 1 ? "Make the key with <code>normalise</code>, the line from screen 3: lower case, spaces and question marks trimmed from the ends, single spaces inside."
        : ln === 2 ? `Is "${esc(key)}" already a key of <code>cache.answers</code>?`
        : ln === 3 ? "Yes: return the stored answer. No embedding, no model call."
        : ln === 4 ? "Not an exact hit. Embed the question: one vector."
        : ln === 5 ? "Find the stored question whose vector is most similar. Every vector has length 1 (our run printed each length, its norm, as 1.0). For such vectors a plain dot product equals the cosine similarity."
        : ln === 6 ? `Best stored key: ${best == null ? "none (the cache is empty, so <code>nearest</code> returns a score of −1)" : `"${esc(best)}"`}. Is ${score} ≥ ${SAFE_T}?`
        : ln === 7 ? `${score} ≥ ${SAFE_T}: reuse that stored answer.`
        : ln === 8 ? `${score} is below ${SAFE_T}. Call the model. <code>call_model</code> here returned the recorded answer instead of calling the API.`
        : ln === 9 ? "Store the key, the vector and the answer, so the next question can hit."
        : ln === 10 ? "Return the fresh answer." : "";
      el.innerHTML = `<h1>The same cache, written in Python</h1>
        <p class="lead">Exact check first (a dict lookup, no embedding needed), then the similarity check, then the model. <code>cache.nearest</code> does the dot products in NumPy and returns the best key and its score. Threshold ${SAFE_T}, the line you picked on screen 5. The cache starts empty; four questions arrive in a row. This replays a real run.</p>
        <p class="task">${needPred ? `Question ${f.qi + 1} of ${TRACE.length}: predict where it ends, then step through.` : "Step through the code to the end."}</p>
        ${qBox({ i: f.qi, num: f.qi + 1, text: c.q, cls: "on" })}
        ${f.k === 0 ? `<div id="pq">${kit.options(OUTCOMES, { picked: pred[f.qi], correct: right })}${pred[f.qi] == null ? "" : pred[f.qi] === right ? "" : kit.feedback(esc(SAY_WRONG[f.qi][pred[f.qi]]), false)}</div>` : ""}
        <div class="${P}wrap">${kit.code(CODE, ln)}</div>
        <div class="vars"><span>key <b>${key == null ? "–" : esc(key)}</b></span><span>best <b>${best == null ? "–" : esc(best)}</b></span><span>score <b>${score == null ? "–" : score}</b></span><span>answer <b>${hasAns ? "set" : "–"}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || needPred ? "disabled" : ""}>Next step</button></div>`;
      el.querySelectorAll("#pq .lopts button").forEach(x => x.onclick = () => { pred[f.qi] = +x.dataset.i; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. Broken on purpose: a teammate lowers the threshold; find the wrong serves, then the fix. */
  const WRONG_ROWS = STREAM.map((_, i) => wrongServe(LOW_T, i) ? i : -1).filter(i => i >= 0);
  const FIXES = [
    `Put the threshold back to ${SAFE_T}, and test any new threshold on look-alike pairs before shipping it`,
    "Clear the cache, so the wrong answers are gone",
    "Switch the bot to a stronger model, so it stops mixing up the deadlines"
  ];
  function broken({ el, done, kit }) {
    style();
    const picked = new Set();
    let miss = null, fix = null;
    const paint = () => {
      const found = WRONG_ROWS.every(i => picked.has(i));
      const L = SIM[LOW_T];
      const served = (i) => L[i][0] === "miss" ? "the model was called" : `reused the answer stored for "${esc(L[i][0] === "exact hit" ? norm(STREAM[i]) : L[i][2])}"`;
      el.innerHTML = `<h1>Broken on purpose: more hits, wrong dates</h1>
        <p class="lead">A teammate wants more hits and lowers the threshold from ${SAFE_T} to ${LOW_T}. Below is the real log of the same morning through the same code at ${LOW_T}. Two weeks later, an international applicant writes: the bot told her January 15, and she missed her deadline.</p>
        <div id="c0"><p class="task">Tap every line where the cache served a wrong answer.</p>
        <p class="${P}lab">Cache log, threshold ${LOW_T}</p>
        <div class="${P}qs">${STREAM.map((q, i) => `<button type="button" class="${P}q ${picked.has(i) ? "ok" : miss === i ? "no" : ""}" data-i="${i}"><span class="n">${i + 1}</span><span class="t">${showSpaces(q)}<br><span class="${P}sp">${esc(L[i][0])}${L[i][1] == null || L[i][1] < 0 ? "" : `, score ${L[i][1].toFixed(2)}`}: ${served(i)}</span></span></button>`).join("")}</div>
        <p class="${P}cap">Output of similar.py, run ${RUN_DATE}. The score is the best similarity to a stored question; exact hits skip that check, and the first question had nothing to compare with.</p>
        ${miss != null ? kit.feedback(rowWhy(miss), false) : found ? kit.feedback(`Right: lines ${WRONG_ROWS.map(i => i + 1).join(" and ")}. Both reused the fall answer: "${esc(REC["deadline-1"].text)}" At ${LOW_T} the morning needed ${calls(LOW_T)} model calls instead of ${calls(SAFE_T)}: ${calls(SAFE_T) - calls(LOW_T)} calls saved, ${WRONG_ROWS.length} students given a wrong date. Asked for real, the model said:`, true)
          + answerBox("intl-1") + answerBox("spring-1") : ""}</div>
        ${found ? `<div class="${P}case" id="c1"><p class="task">Which change fixes it?</p>${kit.options(FIXES.map(esc), { picked: fix, correct: 0 })}
          ${fix == null ? "" : fix === 0 ? kit.feedback(`Right. The cache did exactly what it was told: ${LOW_T} lets the look-alikes in. Keep a small test set of pairs that must not share an answer (like the ones you sorted by hand) and check every threshold change against it. If a question's answer depends on a term (spring or fall), a program or a country, you can also make that part of the key, so a spring question is only compared with spring questions.`, true)
            : fix === 1 ? kit.feedback(`An empty cache refills with the same answers by noon, and at ${LOW_T} the next spring and international questions match them again. The setting causes it, not the stored text.`, false)
            : kit.feedback("The model was never asked: those lines are similar hits, answered from the cache. The model answered correctly when it was called (above). A stronger model changes nothing here.", false)}</div>` : ""}`;
      el.querySelectorAll(`#c0 button.${P}q`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (WRONG_ROWS.includes(i)) { picked.add(i); miss = null; } else miss = i;
        paint();
      });
      el.querySelectorAll("#c1 .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    const rowWhy = i => {
      const r = SIM[LOW_T][i];
      if (r[0] === "miss") return "This line was a miss: the model was called and wrote a fresh answer for this exact question. The cache served nothing here, so this line is not a cache mistake.";
      if (r[0] === "exact hit") return "An exact hit: after normalising, this is the same text as an earlier question, so the same answer is right.";
      return `A similar hit at ${r[1].toFixed(2)}, and correctly so: "${esc(STREAM[i])}" deserves the fall answer. A hit is only wrong when the questions need different answers.`;
    };
    paint();
  }

  /* 8. Answer caching against prompt caching: sort the statements. */
  const STATES = [
    ["Skips the model call completely: the stored text comes back.", 0,
      "Only the answer cache skips the call. Prompt caching still runs the model; it only skips re-reading the repeated start of the prompt."],
    ["The model still writes a new answer each time; only its work on the repeated start of the prompt is reused.", 1,
      "That is prompt caching. The providers' docs say it does not change how the output is generated. An answer cache never runs the model on a hit."],
    ["Can hand a student an answer written for a different question.", 0,
      "Only an answer cache can. Prompt caching needs an exact match of the prompt's start, and the model still answers the question that was actually sent."],
    ["Kept by the provider for a limited time (minutes to hours, depending on the provider and settings), then it expires on its own.", 1,
      "That is prompt caching. An answer cache lives in your app (a dict, Redis, a database) and keeps entries until you remove them or give them a time to live (an age after which each entry is deleted)."],
    ["Cuts the cost of a repeated question.", 2,
      "Both do, in different amounts: prompt caching lowers the price of the repeated input tokens; an answer cache removes the whole call on a hit."]
  ];
  const KINDS = ["Answer cache", "Prompt caching", "Both"];
  function vsPrompt({ el, done, kit }) {
    style();
    const ans = STATES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Answer caching is not prompt caching</h1>
        <p class="lead">You met prompt caching earlier: the provider reuses its work on the start of a prompt it has seen recently. The answer cache you just built is something else.</p>
        <p class="task">For each statement, pick which one it describes. Pick again if you change your mind.</p>
        ${STATES.map(([s, r, why], i) => `<div class="${P}case" id="c${i}"><p>${esc(s)}</p>${kit.options(KINDS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(esc(why), ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(`.${P}case`).forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (STATES.every((x, j) => ans[j] === x[1])) done();
      }));
    };
    paint();
  }

  /* 9. The big picture, with a task on what it costs: the facts change. */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Nothing: on the next question the model reads the new date",
      "Delete or expire every stored answer that mentions the spring deadline when the date changes, and give entries a time to live",
      `Lower the threshold so new questions match the stored answers faster`
    ];
    const paint = () => {
      el.innerHTML = `<h1>When an answer cache pays, and what it costs</h1>
        <div class="${P}big"><ul>
          <li><b>For:</b> many people asking the same few questions whose answer is the same for everyone and rarely changes: dates, fees, opening hours, policy facts.</li>
          <li><b>When not:</b> the answer depends on the person (their application, their account), on live data, or on the conversation so far; or variety is the point. Call the model instead, with prompt caching for a long stable start.</li>
          <li><b>Cost:</b> an embedding and a search on every question the exact cache misses; wrong answers if the threshold is loose; stale (out-of-date) answers when facts change; re-testing the threshold whenever the embedding model changes, since its scores mean nothing for another model. Some libraries set a distance instead of a similarity; there a lower number is stricter (RedisVL's <code>distance_threshold</code>).</li>
        </ul></div>
        <p class="task">Admissions moves the spring deadline to October 15. What must happen to the cache?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1 ? kit.feedback("Right. A hit never reaches the model, so a stored answer stays wrong until you remove it. Tie the cache to the facts it came from: clear it when they change, and give every entry a time to live so a forgotten one expires.", true)
          : ans === 0 ? kit.feedback("On a hit the model is never called, so it never sees the new date. The stored answer keeps saying October 1 until someone removes it.", false)
          : kit.feedback("A lower threshold only means more questions get the old stored answer. The problem is what is stored, not how it is matched.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, including firm "no" cases. */
  const CASES = [
    ["A hotel chain's bot is asked \"What time is check-out?\" thousands of times a week. Check-out is 11:00 at every hotel.", true,
      "Yes. One answer for everyone, rarely changing, asked in many wordings. An exact cache with a normalised key, plus a similarity cache with a tested threshold.",
      "This is the deadline question again: the same answer for everyone, asked in many wordings, rarely changing. A cache answers it without a model call."],
    ["A bank's bot is asked \"What is my balance?\" by thousands of customers.", false,
      "No. Same words, but the answer depends on who asks and changes with every payment. A shared cache would show one customer another's balance. Call the model (or skip it and read the balance from the bank's system) every time.",
      "The words repeat, but the answer depends on the person and changes with every payment. A cached answer would show one customer someone else's balance. Never share cached answers across users for personal data."],
    ["A continuous-integration job retries and sends the exact same code diff to a review bot twice in an hour.", true,
      "Yes, an exact cache: identical input, and the team wants the same review. Key it on the diff plus the model and prompt version, so a new prompt does not reuse old reviews.",
      "The input is byte-for-byte identical, so an exact cache is safe and saves the second call. Put the model and prompt version in the key too."],
    ["A poem app: many users type \"write a poem about autumn\" and expect a new poem each time.", false,
      "No. The same request is meant to get a different answer: variety is the product. A cache would hand everyone the same poem.",
      "The request repeats, but the users want a new poem each time. A cache would return the same poem to everyone, which breaks the product."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would an answer cache help here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the admissions office.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="${P}case" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(`.${P}case`).forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. Done on entry. */
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">You can store finished answers under a normalised key, reuse them for questions in other words with embeddings and a threshold, and pick that threshold from pairs that must not share an answer. You know why a loose threshold serves wrong dates, why stored answers go stale, and why prompt caching is a different thing.</p>
      <p class="lead">A short exercise in Python follows on this page: you build <code>serve()</code> with an exact dict and a NumPy similarity check, then choose its threshold from a set of labelled question pairs.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. A cache only helps with repeats; for the calls you cannot skip, that lesson sends easy ones to a cheaper model.</p>` : ""}`;
    done();
  }

  // walk helpers
  const walkCode = (() => {
    const right = [];
    FR.forEach((f, i) => {
      if (f.k === 0) right.push("#pq [data-right]");
      if (i < FR.length - 1) right.push("[data-next]");
    });
    return { wrong: ["#pq [data-wrong]"], right };
  })();
  const firstNonHit = STREAM.findIndex((_, i) => !RAW_HIT[i] && STREAM.slice(0, i).some(x => norm(x) === norm(STREAM[i])));

  LessonKit.define(ID, {
    title: "Exact and semantic caching of answers",
    checked: "2026-11-14",
    sources: [
      "https://developers.openai.com/api/docs/guides/prompt-caching",
      "https://platform.claude.com/docs/en/build-with-claude/prompt-caching",
      "https://aistudio.google.com/docs/caching",
      "https://docs.redisvl.com/en/latest/user_guide/03_llmcache.html",
      "https://docs.ollama.com/api/embed",
      "https://ollama.com/library/all-minilm"
    ],
    interview: [{
      q: "Your support bot's bill is mostly repeated questions. A colleague wants to add a semantic cache with a similarity threshold of 0.75 and ship it this week. What do you check before it goes live?",
      good: [
        "Put a cheap exact cache with a normalised key in front; it is safe and catches the plain repeats",
        "Build a test set from real logs: pairs that should share an answer and look-alike pairs that must not, then measure hits and wrong serves at each threshold",
        "Keep personal, live or conversation-dependent questions out of the cache, or scope the key by user, language, product, model and prompt version",
        "Plan for staleness: clear entries when the source facts change and give every entry a time to live",
        "Remember the threshold belongs to one embedding model (and some tools use distance, where lower is stricter); re-test when it changes, and log hit rate and samples of hits"
      ],
      weak: "Pick a number that sounds reasonable, like 0.8, and watch the hit rate go up, without ever measuring how many hits were wrong answers."
    }, {
      q: "A product manager says: \"We turned on prompt caching, so repeated questions are free now.\" How do you answer?",
      good: [
        "Prompt caching reuses the provider's work on a repeated start of the prompt; the model still runs and writes a new answer every time",
        "Output tokens are billed as usual and the user still waits for generation; only the cached input is cheaper",
        "Short prompts below the provider's minimum, or calls further apart than the cache lifetime, get no saving at all",
        "To skip the call for repeated questions you need an answer cache in your app, with its own risks: wrong matches and stale answers"
      ],
      weak: "Agree that caching makes repeats free, or say the two are the same thing."
    }],
    screens: [situation, byHand, exactCache, spotIdea, threshold, asCode, broken, vsPrompt, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${QUESTIONS.findIndex(q => q[1] === "fee")}"]`], right: [...SAME.map(i => `[data-i="${i}"]`), `[data-i="${ALIKE[0]}"]`] },
      { wrong: [`[data-i="${firstNonHit}"]`], right: [...RAW_HIT.map((h, i) => h ? `[data-i="${i}"]` : null).filter(Boolean), ...NORM_HIT.map((h, i) => h && !RAW_HIT[i] ? `[data-i="${i}"]` : null).filter(Boolean)] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      walkCode,
      { wrong: ['#c0 [data-i="0"]'], right: [...WRONG_ROWS.map(i => `#c0 [data-i="${i}"]`), "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: STATES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
