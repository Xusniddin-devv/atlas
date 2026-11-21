/* Lesson: finish the RAG project with its evaluation harness. Story: a volunteer-run open-source charting library
   (the fictional "Fernchart", versions 3 and 4) wants a docs assistant whose every answer names the docs page and
   the library version it came from. Ideas: (1) a score is evidence only next to a baseline, with an error bar, from
   one command anyone can rerun; (2) the scorer itself can be wrong, so read the rows it marks right.
   Data, all real:
   - docs/ai-path/runs/s7-rag-eval-project/: docs_corpus.json (21 doc chunks), golden.jsonl (40 questions),
     retrieve.py (BM25 baseline over every version, system = BM25 inside the reader's version) + retrieve.out.txt,
     prompts/answer.txt and prompts/judge.txt, score.py (fixed scorer), score_v1.py (the broken scorer),
     run_eval.py + run_eval.out.txt (the results table, the buggy-scorer row, the sample report numbers, per-question
     hits), trace_row.py + trace_row.out.txt (the stepped code screen), env.txt;
   - recordings (main checkout) docs/ai-path/recordings/s7-rag-eval-project/: ans-baseline-q01..q40 and
     ans-system-q01..q40 (answers), judge-*-q01..q40 (published judge prompt), hidden-q01..q12 (the sample report's
     unpublished 1-5 judge). All google/gemini-2.5-flash-lite via OpenRouter, temperature 0, seed 7, 2026-11-14.
   Lesson-local style: a results table, interval bars and an answer block (.lx-s7-rag-eval-project-*), see ensureStyle(). */
(() => {
  const ID = "s7-rag-eval-project";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const count = s => [...s].filter(c => c === "1").length;
  const p1 = x => `${(x * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const pts = x => `${(x * 100).toFixed(1).replace(/\.0$/, "")}`;
  const sgn = x => (x > 0 ? "+" : x < 0 ? "−" : "") + pts(Math.abs(x));

  /* ---------- Data copied from the runs and recordings ---------- */
  // Per-question hits in golden.jsonl order (q01..q40), from the "Q" lines of run_eval.out.txt
  const HITS = {
    top1: { b: "0111010101010110101001001101111000100100", s: "1111111111011110111111011111111100110100" },
    cite: { b: "1111111111111110111111111101111100110110", s: "1111111111111111111111111111111101111110" },
    judge: { b: "1111111111111110111111111101111110110110", s: "1111111111111111111111111111111111111110" },
    citeV1: { b: "1111111111111111111111111111111100110111", s: "1111111111111111111111111111111101111110" } // score_v1.py
  };
  const N = HITS.top1.b.length;
  // ROWS_JSON and BUGGY_JSON of run_eval.out.txt: [mean, low, high] of 95% bootstrap intervals (percentile, 9999, seed 0)
  const ROWS = [
    { key: "top1", metric: "Top-1 retrieved chunk is the right page and version", baseline: [0.5, 0.35, 0.65], system: [0.8, 0.675, 0.925], change: [0.3, 0.175, 0.45] },
    { key: "cite", metric: "Answer cites the right page and version", baseline: [0.85, 0.725, 0.95], system: [0.95, 0.875, 1.0], change: [0.1, 0.025, 0.2] },
    { key: "judge", metric: "Judge: answer supported by its cited excerpt", baseline: [0.875, 0.775, 0.975], system: [0.975, 0.925, 1.0], change: [0.1, 0.025, 0.2] }
  ];
  const ROW_V1 = { key: "citeV1", metric: "Answer cites the right page (score_v1.py)", baseline: [0.925, 0.825, 1.0], system: [0.95, 0.875, 1.0], change: [0.025, -0.05, 0.1] };
  // SAMPLE_JSON of run_eval.out.txt: q01..q12, system only; hidden scores from hidden-q01..q12
  const SAMPLE = { n: 12, top1Ci: [0.75, 1.0], hidden: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] };
  const BAR = 0.9; // the 90% bar the sample report claims to clear (the lesson's scenario)

  // From golden.jsonl and retrieve.out.txt (baseline and system top 3, BM25 scores)
  const Q01 = { id: "q01", version: "3", question: "How do I put the legend under the chart?",
    baseTop: [["legend", "4", 4.729], ["migration", "4", 3.542], ["legend", "3", 3.143]] };
  const Q16 = { id: "q16", version: "4", question: "Can I save the chart as an SVG file?",
    baseTop: [["export", "3", 9.036], ["data-loading", "4", 5.293], ["themes", "4", 4.165]],
    sysTop: [["data-loading", "4", 4.427], ["themes", "4", 3.904], ["export", "4", 2.679]] };
  // From the recordings (text not altered)
  const REC = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14" };
  const ANS = {
    // ans-baseline-q01
    b01: "To place the legend below the chart, use `chart.setLegend({ position: 'bottom' })`. The `position` option can be set to 'top', 'bottom', 'left', or 'right'. Clicking legend items will hide their series by default, but this can be disabled with `toggle: false`.\nSource: legend (v3)",
    // ans-baseline-q16
    b16: "No, SVG export is not available in Fernchart version 4. You can save charts as PNG images using the `toPNG()` method.\nSource: export (v3)",
    // ans-system-q16
    s16: "Yes, you can export the chart as an SVG file by calling the `chart.export()` method with the `format` option set to `'svg'`. This method returns a Blob object. You can also pass a `scale` option to control the resolution.\nSource: export (v4)"
  };
  // BUGGY_ROW lines of run_eval.out.txt (answers from ans-baseline-q16, q27, q40)
  const V1_ROWS = [
    { id: "q16", version: "4", question: "Can I save the chart as an SVG file?", expected: "export", cited: ["export", "3"],
      answer: "No, SVG export is not available in Fernchart version 4. You can save charts as PNG images using the `toPNG()` method.\nSource: export (v3)" },
    { id: "q27", version: "4", question: "Show values of all series when hovering one x position?", expected: "tooltips", cited: ["tooltips", "3"],
      answer: "To show values of all series when hovering one x position, set `shared: true` within the tooltip configuration. Tooltips are enabled by default and can be customized further.\nSource: tooltips (v3)" },
    { id: "q40", version: "4", question: "Which browsers are supported?", expected: "install", cited: ["install", "3"],
      answer: "Fernchart 3 supports browsers with ES5.\nSource: install (v3)" }
  ];
  // score_v1.py, line for line
  const V1_CODE = [
    "def citation_correct(answer, expected_page, version):",
    "    cited = parse_source(answer)",
    "    return cited is not None and cited[0] == expected_page"
  ];
  const JUDGE_PROMPT_LINE = "Reply SUPPORTED if every claim in the answer is stated in the cited excerpt and the excerpt is for the reader's version."; // prompts/judge.txt
  const HIDDEN_PROMPT = "Rate how helpful this answer is from 1 to 5. Reply with only the number."; // make_requests.py HIDDEN_PROMPT

  // results_row from run_eval.py, line for line (line 0 = def)
  const CODE = [
    "def results_row(metric, baseline, system):",
    "    rng = np.random.default_rng(0)",
    "    row = {\"metric\": metric}",
    "    for name, hits in ((\"baseline\", baseline), (\"system\", system)):",
    "        ci = bootstrap((hits,), np.mean, n_resamples=9999, method=\"percentile\", rng=rng).confidence_interval",
    "        row[name] = [hits.mean(), ci.low, ci.high]",
    "    change = bootstrap((system, baseline), lambda s, b: np.mean(s - b), paired=True,",
    "                       n_resamples=9999, method=\"percentile\", rng=rng).confidence_interval",
    "    row[\"change\"] = [(system - baseline).mean(), change.low, change.high]",
    "    return row"
  ];
  // trace_row.out.txt: [line about to run, event, name, row.baseline, row.system, row.change]
  const B0 = [0.5, 0.35, 0.65], S0 = [0.8, 0.675, 0.925], C0 = [0.3, 0.175, 0.45];
  const TRACE = [[1,"l",null,null,null,null],[2,"l",null,null,null,null],[3,"l",null,null,null,null],[4,"l","baseline",null,null,null],[5,"l","baseline",null,null,null],[3,"l","baseline",B0,null,null],[4,"l","system",B0,null,null],[5,"l","system",B0,null,null],[3,"l","system",B0,S0,null],[6,"l","system",B0,S0,null],[7,"l","system",B0,S0,null],[6,"l","system",B0,S0,null],[7,"l","system",B0,S0,null],[6,"l","system",B0,S0,null],[8,"l","system",B0,S0,null],[9,"l","system",B0,S0,C0],[9,"r","system",B0,S0,C0]];

  /* ---------- Derived from the data ---------- */
  const hitsOf = (key, who, n) => count(HITS[key][who].slice(0, n == null ? N : n));
  const S_TOP1_12 = hitsOf("top1", "s", SAMPLE.n), B_TOP1_12 = hitsOf("top1", "b", SAMPLE.n);
  const S_CITE_12 = hitsOf("cite", "s", SAMPLE.n), B_CITE_12 = hitsOf("cite", "b", SAMPLE.n);
  const HIDDEN_AVG = SAMPLE.hidden.reduce((a, b) => a + b, 0) / SAMPLE.hidden.length;
  const ONE_Q = 1 / SAMPLE.n, ONE_Q40 = 1 / N;
  const srcOf = s => { const m = /Source:\s*([a-z0-9-]+)\s*\(v(\d+)\)/.exec(s); return m ? [m[1], m[2]] : null; };
  // Frames of the code screen: the multi-line call on lines 6-7 is traced as 6,7,6,7,6; show it once.
  const FR = TRACE.filter((t, k) => t[0] !== 7 && !(t[0] === 6 && TRACE.slice(0, k).some(u => u[0] === 6)));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-rep { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-rep .lcase { margin: 0; padding: 12px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-claim { font: 600 15.5px/1.45 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
      .lx-${ID}-ans { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk);
        font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 12px 0 0; font-size: 14.5px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
      .lx-${ID}-tbl th { overflow-wrap: normal; word-break: keep-all; font: 600 11.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-tbl td.lx-${ID}-m { font-family: var(--mono); font-size: 13px; overflow-wrap: normal; word-break: normal; }
      .lx-${ID}-ci { margin: 14px 0 0; }
      .lx-${ID}-ci h3 { margin: 12px 0 4px; font-size: 15px; }
      .lx-${ID}-cirow { display: grid; grid-template-columns: 5.5em 1fr; gap: 10px; align-items: center; margin: 4px 0; font-size: 14px; }
      .lx-${ID}-track { position: relative; height: 22px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-seg { position: absolute; top: 9px; height: 4px; background: var(--ink-2); }
      .lx-${ID}-dot { position: absolute; top: 4px; width: 3px; height: 14px; margin-left: -1px; background: var(--ink); }
      .lx-${ID}-zero { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px dashed var(--muted); }
      .lx-${ID}-lab { font: 500 13px/1.4 var(--mono); color: var(--muted); }
      .lx-${ID}-wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + 2ch); text-indent: -2ch; }
      .lx-${ID}-files { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-files li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .lx-${ID}-files code { font: 600 14px var(--mono); }
      .lx-${ID}-top { margin: 8px 0 0; padding: 0 0 0 2.2em; font: 500 14px/1.6 var(--mono); }
    `;
    document.head.appendChild(s);
  }
  const answerBlock = (kit, text) => `<div class="lx-${ID}-ans">${kit.esc(text)}</div><p class="lx-${ID}-cap">Recorded model output, ${REC.recordedAt}</p>`;
  const topList = (kit, top) => `<ol class="lx-${ID}-top">${top.map(([p, v, sc]) => `<li>${kit.esc(p)} (v${kit.esc(v)}) · score ${sc}</li>`).join("")}</ol>`;
  // One interval bar: m = [mean, low, high]; lo..hi = the axis range
  function ciBar(label, m, lo, hi, zero) {
    const x = v => `${((v - lo) / (hi - lo) * 100).toFixed(2)}%`;
    return `<div class="lx-${ID}-cirow"><span class="lx-${ID}-lab">${label}</span><div class="lx-${ID}-track" aria-label="${label} ${p1(m[0])}, interval ${p1(m[1])} to ${p1(m[2])}">
      ${zero ? `<span class="lx-${ID}-zero" style="left:${x(0)}"></span>` : ""}<span class="lx-${ID}-seg" style="left:${x(m[1])};width:calc(${x(m[2])} - ${x(m[1])})"></span><span class="lx-${ID}-dot" style="left:${x(m[0])}"></span></div></div>`;
  }
  function resultsTable(kit, rows) {
    const cell = m => `${p1(m[0])}<br><span class="lx-${ID}-lab">${p1(m[1])}–${p1(m[2])}</span>`;
    const ch = m => `${sgn(m[0])} pts<br><span class="lx-${ID}-lab">${sgn(m[1])} to ${sgn(m[2])}</span>`;
    return `<table class="lx-${ID}-tbl"><thead><tr><th>metric (n = ${N})</th><th>baseline</th><th>system</th><th>change</th></tr></thead><tbody>${rows.map(r =>
      `<tr><td>${kit.esc(r.metric)}</td><td class="lx-${ID}-m">${cell(r.baseline)}</td><td class="lx-${ID}-m">${cell(r.system)}</td><td class="lx-${ID}-m">${ch(r.change)}</td></tr>`).join("")}</tbody></table>`;
  }
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  // Several small questions on one screen; done when all are right.
  function multi(el, done, kit, render, items) {
    const ans = items.map(() => null);
    const paint = () => {
      el.innerHTML = render(items.map((it, i) => `<div class="lcase" id="c${i}">${it.html}${kit.options(it.opts, { picked: ans[i], correct: it.right })}${ans[i] == null ? "" : kit.feedback(it.fb[ans[i]], ans[i] === it.right)}</div>`).join(""));
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (items.every((it, j) => ans[j] === it.right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation and the audit: flag the number a reviewer would distrust. */
  const FLAWS = ["Too few questions to back the claim", "No baseline to compare against", "Nobody can see what the judge was asked", "Nothing wrong here"];
  function audit({ el, done, kit }) {
    ensureStyle();
    const rows = [
      { claim: `Retrieval: the top-1 chunk is right for ${S_TOP1_12} of ${SAMPLE.n} questions (${p1(S_TOP1_12 / SAMPLE.n)}). Above our ${p1(BAR)} bar: ready.`, right: 0,
        fb: [`Right. With ${SAMPLE.n} questions, one question moves the score by ${p1(ONE_Q)}. A bootstrap error bar on these ${SAMPLE.n} hits runs from ${p1(SAMPLE.top1Ci[0])} to ${p1(SAMPLE.top1Ci[1])}, so the data cannot say whether the true rate is above ${p1(BAR)} or well below it.`,
          "A baseline would help, but this row's claim is “above our bar”, a claim about the score itself. Ask first how much the score could move if you picked twelve other questions.",
          "No judge here: whether the top chunk has the expected page and version is checked by plain code.",
          `The claim is “above ${p1(BAR)}”. On ${SAMPLE.n} questions one question is worth ${p1(ONE_Q)}: one unlucky pick and it falls below the bar. That needs an error bar.`] },
      { claim: `Citations: ${S_CITE_12} of ${SAMPLE.n} answers cite the right page and version (${p1(S_CITE_12 / SAMPLE.n)}), so the version filter works.`, right: 1,
        fb: ["Twelve is few, but the claim is about the <b>filter</b>. Even a perfect score on 400 questions says nothing about the filter unless the same questions were also run without it.",
          "Right. “The filter works” is a claim about a change, and nothing was run without the filter. The same 12 questions with a plain search over every version is the missing column.",
          "No judge here: the cited page and version are parsed from the answer's last line by code.",
          "A perfect score looks safe, but it proves the filter works only if a pipeline without the filter scores lower. Nobody checked."] },
      { claim: `Answer quality: ${HIDDEN_AVG.toFixed(1)} / 5 from an LLM judge.`, right: 2,
        fb: ["Twelve answers is few, but there is a worse problem: you cannot tell what the 1 to 5 scale measured.",
          "A baseline would also be scored by the same unknown judge. First you need to know what the judge rewards.",
          "Right. The judge prompt is not in the repo. A score from a judge you cannot read could mean “correct”, “polite” or “long”. A perfect score on every answer is itself a warning sign.",
          "A perfect average from a judge nobody can read is the least trustworthy number here."] },
      { claim: "Every answer and judge call is saved with the model name, temperature 0 and the date.", right: 3,
        fb: ["This row makes no claim about quality, so there is nothing for more questions to back.",
          "This row is not a result; it is how results were made. It needs no comparison.",
          "Saving the calls is what lets a reviewer read what the judge said. That is good practice.",
          "Right. This is what makes a rerun give the same numbers and lets a reviewer read every answer. Keep it."] }
    ];
    multi(el, done, kit, body => `<h1>The docs assistant's first report</h1>
      <p class="lead">Fernchart is a free charting library run by volunteers. Versions 3 and 4 are both in use, and many options were renamed between them. The maintainers want a RAG docs assistant on their site. Every answer must name the docs page and the library version it came from. To get the version right, it searches only the docs of the version the reader is browsing: the version filter.</p>
      <p class="lead">This lesson finishes that RAG project with its evaluation harness: the questions, the code and the one command that score it, so others can believe the numbers. A volunteer posted this first report from an early version of the repo.</p>
      <p class="task">For each line of the report, pick what a careful reviewer would doubt.</p>
      <div class="lx-${ID}-rep">${body}</div>`,
      rows.map(r => ({ html: `<p class="lx-${ID}-claim">${kit.esc(r.claim)}</p>`, opts: FLAWS, right: r.right, fb: r.fb })));
  }

  /* 2. Spot the idea: a claim about a change needs the same questions without the change. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Ask the volunteer to add more questions until the score settles",
      "Run the same 12 questions through a pipeline without the version filter and compare",
      "Have a stronger model write the 12 answers",
      "Ask a second volunteer to read the 12 answers and agree they look right"
    ];
    const reveal = `We ran it. Same 12 questions, plain search over every version, everything else the same: <b>${B_CITE_12} of ${SAMPLE.n}</b> answers still cited the right page and version, the same as with the filter. The model often picked the right version out of the three excerpts it was given. So “${S_CITE_12} of ${SAMPLE.n}” said nothing about the filter. Retrieval did differ: the right chunk came first ${B_TOP1_12} of ${SAMPLE.n} times without the filter, ${S_TOP1_12} of ${SAMPLE.n} with it. The idea: <b>a score is evidence only next to a baseline</b> (the same questions without the change), <b>with an error bar</b>, from a run anyone can repeat.`;
    const fb = [
      ["More questions shrink the error bar, but they never answer “does the filter cause this?”. You could have 400 perfect answers that a plain search also gets right.", false],
      [`Right. ${reveal}`, true],
      ["A stronger writer changes the system you are measuring. The question is whether the filter helps, and that needs the same pipeline with and without the filter.", false],
      ["A second reader checks whether the answers are right. They are: the scorer already says so. It does not tell you whether the filter is the reason.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What would make the claim believable?</h1>
        <p class="lead">The report said: ${S_CITE_12} of ${SAMPLE.n} answers cite the right page and version, so the version filter works. The filter means: search only the docs of the version the reader is browsing.</p>
        <p class="task">What is the one thing to run before you believe “the version filter works”?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Package it: which file answers which reviewer question. */
  const FILES = [
    ["golden.jsonl", `${N} questions, each with the reader's version and the expected page`],
    ["retrieve.py", "both retrievers, BM25 keyword search with the rank_bm25 library: baseline (every version) and system (the reader's version only)"],
    ["prompts/judge.txt", "the exact words the judge model is given"],
    ["run_eval.py", "the one command: retrieve, answer, score, print the table with error bars"]
  ];
  function packageIt({ el, done, kit }) {
    ensureStyle();
    const names = FILES.map(f => `<code>${f[0]}</code>`);
    const items = [
      { q: "“What exactly did your judge reward?”", right: 2,
        fb: ["The golden set holds questions and expected pages, not the judge's instructions.", "The retrievers never see the judge.", `Right. A reviewer can read every word, for example: “${kit.esc(JUDGE_PROMPT_LINE)}” The sample repo's judge was told only: “${kit.esc(HIDDEN_PROMPT)}”, and nobody could see that.`, "The command runs the judge, but the judge's words live in their own file so a reviewer can read and change them."] },
      { q: "“Would plain keyword search over all the docs do as well?”", right: 1,
        fb: ["The golden set is shared by both runs; it does not contain a second retriever.", "Right. The baseline lives next to the system, and the table shows both columns on the same questions.", "The judge scores answers; it is not a retriever.", "The command runs both, but the baseline itself, plain search over every version, is defined in the retriever file."] },
      { q: "“If I clone the repo, do I get your numbers?”", right: 3,
        fb: ["The questions alone are not a run. Something has to retrieve, answer and score them the same way every time.", "The retrievers are one step of the run. The reviewer needs the whole run, from one command.", "The judge prompt is one ingredient, not the run.", `Right. One command does every step with a fixed model, temperature 0, fixed seeds, and the saved answers. In our run, <code>python run_eval.py</code> reads the recorded answers, so a rerun is free, takes seconds and prints the same table. When the saved answer for a question is missing, the real repo would call the model.`] }
    ];
    multi(el, done, kit, body => `<h1>Pack the repo so a reviewer trusts it</h1>
      <p class="lead">We rebuilt the project the honest way. The golden set grew to ${N} questions and covers both versions. They are written like real reader questions, not copied from the docs. The repo now holds:</p>
      <ul class="lx-${ID}-files">${FILES.map(([n, d]) => `<li><code>${kit.esc(n)}</code> ${kit.esc(d)}</li>`).join("")}</ul>
      <p class="task">A reviewer asks three questions. Which file answers each one?</p>${body}`,
      items.map(it => ({ html: `<p>${it.q}</p>`, opts: names, right: it.right, fb: it.fb })));
  }

  /* 4. Predict: what the baseline's ranking does to the answer. */
  function predict({ el, done, kit }) {
    ensureStyle();
    let k = 0, ans = null;
    const STEPS = [
      { title: `A v${Q01.version} reader asks: “${Q01.question}”`, top: Q01.baseTop, who: "The baseline (search over every version) returned these three chunks, best first:",
        task: `The model gets these three excerpts and is told the reader is on version ${Q01.version}. Which source will its answer name?`,
        opts: ["legend (v4), the top chunk", "legend (v3), the third chunk", "migration (v4)", "Source: none"], right: 1, text: ANS.b01,
        fb: ["The top chunk is for the wrong version, and the prompt says to answer for the reader's version. The model can look past the ranking.", null, "The migration page explains the move from 3 to 4. A v3 reader asking about the legend is not migrating.", "One of the three excerpts answers the question for version 3. The model has what it needs."],
        after: "The model looked past the wrong top chunk and used the v3 one in third place. That is why a weak top-1 score does not always mean wrong answers." },
      { title: `A v${Q16.version} reader asks: “${Q16.question}”`, top: Q16.baseTop, who: "The baseline returned:",
        task: `No excerpt from the version ${Q16.version} export page made the top three. What does the answer say?`,
        opts: ["“Yes”, explained with version 4 options", "“No, SVG export is not available in version 4”, citing export (v3)", "“The docs do not say”, with Source: none"], right: 1, text: ANS.b16,
        fb: ["The version 4 export page, the one that says SVG works, never reached the model. It cannot use what it was not given.", null, "The prompt allows Source: none. But an excerpt about export and SVG was there, so the model used it."],
        after: "Confident and wrong. The v3 page says SVG is not available in version 3; the answer moved that to version 4. A v4 reader would believe it." },
      { title: `The same v${Q16.version} question through the system`, top: Q16.sysTop, who: "The system searches only the version 4 docs. It returned:",
        task: "The right page is third and has the lowest score. Which source does the answer name?",
        opts: ["export (v4)", "data-loading (v4), the top chunk", "Source: none"], right: 0, text: ANS.s16,
        fb: [null, "The data-loading page is about files, not export. Being first does not make it the answer, as you saw on the first question.", "The third excerpt answers the question directly. The model has what it needs."],
        after: `Right page, right version, right answer. The filter's gain is not that the right chunk always comes first; it is that the wrong version can never be in the list.` }
    ];
    const paint = () => {
      const fin = k >= STEPS.length, st = STEPS[Math.min(k, STEPS.length - 1)];
      const showAns = fin || ans === st.right;
      el.innerHTML = `<h1>Predict what the answer cites</h1>
        <p class="lead">Before the table, look at single questions. Question ${Math.min(k + 1, STEPS.length)} of ${STEPS.length}.</p>
        <h3>${kit.esc(st.title)}</h3>
        <p class="lead">${st.who}</p>${topList(kit, st.top)}
        ${fin ? "" : `<p class="task">${st.task}</p>`}
        <div class="lpanel">${fin ? "" : kit.options(st.opts, { picked: ans, correct: st.right })}
        ${!showAns && ans != null ? kit.feedback(st.fb[ans], false) : ""}
        ${showAns ? `${answerBlock(kit, st.text)}${kit.feedback(`A small hosted model answered, at temperature 0. ${st.after}`, true)}` : ""}</div>
        ${showAns && !fin ? `<div class="lsteps"><button type="button" class="btn" data-goon>Next question</button></div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === st.right && k === STEPS.length - 1) { k++; paint(); done(); return; }
        paint();
      });
      const go = el.querySelector("[data-goon]");
      if (go) go.onclick = () => { k++; ans = null; paint(); };
    };
    paint();
  }

  /* 5. The error bars in Python: scipy.stats.bootstrap, stepped from a real trace. */
  const sayFrame = f => {
    const [ln, ev, name, b, s, c] = f;
    if (ev === "r") return `The row is done: baseline ${p1(b[0])} (${p1(b[1])} to ${p1(b[2])}), system ${p1(s[0])} (${p1(s[1])} to ${p1(s[2])}), change ${sgn(c[0])} points (${sgn(c[1])} to ${sgn(c[2])}). The interval of the change does not include zero.`;
    if (ln === 1) return "About to make a random generator with seed 0. Every rerun then draws exactly the same random samples, so the table never changes unless the data does.";
    if (ln === 2) return "About to start the row with the metric's name.";
    if (ln === 3 && !b) return `<code>baseline</code> and <code>system</code> are two arrays of ${N} ones and zeros, one per golden question: 1 if that question was right.`;
    if (ln === 3) return name === "baseline"
      ? `Stored: baseline ${p1(b[0])}, interval ${p1(b[1])} to ${p1(b[2])}. Back to the loop for the system.`
      : `Stored: system ${p1(s[0])}, interval ${p1(s[1])} to ${p1(s[2])}. The loop is over.`;
    if (ln === 4) return `About to bootstrap the ${name}: draw ${N} questions at random, with repeats, from its ${N} results; take the mean; do that 9999 times (<code>n_resamples</code>). Then <code>method="percentile"</code> keeps the middle 95% of those means (<code>confidence_level</code> defaults to 0.95).`;
    if (ln === 5) return `About to store the ${name}'s score with <code>ci.low</code> and <code>ci.high</code>, the ends of the interval.`;
    if (ln === 6) return "About to bootstrap the change. <code>paired=True</code> draws the same questions for both arrays each time, so each question is compared with itself. That is the fair test: both columns answered the same questions.";
    if (ln === 8) return "About to store the change: the system's score minus the baseline's, with its interval.";
    if (ln === 9) return `Stored: change ${sgn(c[0])} points, interval ${sgn(c[1])} to ${sgn(c[2])}. About to return the row.`;
    return "";
  };
  const rowKeys = f => (f[0] < 3 && f[1] !== "r") ? "–" : ["metric"].concat(f[3] ? ["baseline"] : [], f[4] ? ["system"] : [], f[5] ? ["change"] : []).join(", ");
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The error bars, in Python</h1>
        <p class="lead">One function makes one row of the results table. It uses SciPy's <code>bootstrap</code>: pretend the ${N} golden questions are a sample of all questions readers could ask, draw many new samples from them, and see how much the score moves.</p>
        <p class="task">Step through the first row, top-1 retrieval. Watch which line makes the interval for the change.</p>
        <div class="lx-${ID}-wrap">${kit.code(CODE, f[1] === "r" ? 9 : f[0])}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>name <b>${kit.esc(f[2] || "–")}</b></span><span>row keys <b>${rowKeys(f)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}
        ${i === FR.length - 1 ? `<p class="lead">The default <code>method</code> is <code>"BCa"</code>, a corrected version of the percentile method. We used <code>"percentile"</code>, the plainest method. Older code passes <code>random_state</code>; since SciPy 1.15 the parameter is <code>rng</code>.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. Read the table: write the honest sentence for two rows. */
  function readTable({ el, done, kit }) {
    ensureStyle();
    const t = ROWS[0], c = ROWS[1];
    const bars = r => `<h3>${kit.esc(r.metric)}</h3>${ciBar("baseline", r.baseline, 0, 1)}${ciBar("system", r.system, 0, 1)}`;
    const items = [
      { html: `<p>Top-1 retrieval: change ${sgn(t.change[0])} points, interval ${sgn(t.change[1])} to ${sgn(t.change[2])}.</p>`, right: 0,
        opts: [`A real gain: the filter puts the right chunk first more often, by somewhere between ${pts(t.change[1])} and ${pts(t.change[2])} points on questions like these`,
          `The filter is exactly ${pts(t.change[0])} points better`, `Cannot tell: ${N} questions are too few for any claim`],
        fb: ["Right. The interval of the change sits well clear of zero, and the sentence keeps the range, so nobody quotes the single number as exact.",
          `${pts(t.change[0])} is this sample's number. Forty other questions would give another one; the interval says how far it could move.`,
          `${N} questions are too few for a small change, but not for a big one. The interval of the change does not reach zero, so the data does say something.`] },
      { html: `<p>Citations: change ${sgn(c.change[0])} points, interval ${sgn(c.change[1])} to ${sgn(c.change[2])}.</p>`, right: 1,
        opts: [`The filter improves citations by ${pts(c.change[0])} points`,
          `Probably a real gain, but small and unsure: from ${pts(c.change[1])} to ${pts(c.change[2])} points; more questions would narrow it`,
          `No real difference: the two columns' intervals (${p1(c.baseline[1])}–${p1(c.baseline[2])} and ${p1(c.system[1])}–${p1(c.system[2])}) overlap`],
        fb: [`That drops the range. The low end is ${pts(c.change[1])} points, just above zero. Say how sure you are.`,
          `Right. Its low end is close to zero. On ${N} questions each question is worth ${p1(ONE_Q40)}, so a few questions going from right to wrong would move it a lot.`,
          "Overlapping column intervals do not mean “no difference”. Both columns answered the same questions, so compare question by question: that is the paired interval of the change, and it stays above zero."] }
    ];
    multi(el, done, kit, body => `<h1>Read the results table</h1>
      <p class="lead">This is what <code>python run_eval.py</code> printed for the ${N}-question golden set. Each cell shows a score, with its 95% interval on the line under it. The change column is the system's score minus the baseline's, in percentage points (pts), with its paired interval under it.</p>
      ${resultsTable(kit, ROWS)}
      <div class="lx-${ID}-ci">${bars(t)}${bars(c)}<p class="lx-${ID}-cap">Each bar is a 95% interval, the short mark is the score. Axis 0 to 100%.</p></div>
      <p class="task">Pick the sentence you would put in the README for each row.</p>${body}`, items);
  }

  /* 7. Broken on purpose: the scorer that ignored the version. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { task: "The three answers are marked correct. What is the cause?", right: 0,
        opts: ["The scorer compares only the page name, so an answer from the wrong version counts as right",
          "The model ignores the reader's version, so the model is broken",
          "The bootstrap is wrong: an interval should never reach 100%",
          "The golden set has the wrong expected pages"],
        fb: [null, "The model did use the wrong version, but that is the symptom. Catching it is the scorer's job, and the scorer said “correct”.",
          "An interval can reach 100% when nearly every answer is right. The interval is computed from the hits; the hits themselves are wrong.",
          "The expected pages are right: export, tooltips, install. What differs is the version, and the scorer never looks at it."] },
      { task: "Which return line fixes the scorer?", right: 2,
        opts: ["return cited is not None", "return cited[0] == expected_page and version == \"4\"", "return cited == (expected_page, version)", "Lower the model's temperature and rerun"],
        fb: ["That marks any answer with a Source line as right, even the wrong page.", "That hard-codes one version. Every v3 question would be scored as wrong.", null, "The scorer is the problem. The answers would be the same and so would the wrong verdicts."] }
    ];
    const rowsHtml = `<table class="lx-${ID}-tbl"><thead><tr><th>question</th><th>reader</th><th>cites</th><th>v1 says</th></tr></thead><tbody>${V1_ROWS.map(r =>
      `<tr><td>${kit.esc(r.question)}</td><td class="lx-${ID}-m">v${kit.esc(r.version)}</td><td class="lx-${ID}-m">${kit.esc(srcOf(r.answer)[0])} (v${kit.esc(srcOf(r.answer)[1])})</td><td class="lx-${ID}-m">correct</td></tr>`).join("")}</tbody></table>`;
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      const fixed = stage >= 2;
      el.innerHTML = `<h1>The scorer that said “no difference”</h1>
        <p class="lead">A contributor wants to drop the version filter: one index is simpler than one per version. The scorer is the code that marks each answer right or wrong. The CI run of its first version, <code>score_v1.py</code>, backs them up:</p>
        ${resultsTable(kit, [ROW_V1])}
        <p class="lead">The change interval ${ROW_V1.change[1] < 0 && ROW_V1.change[2] > 0 ? "includes zero, so the filter seems to make no difference" : "excludes zero"}. Before you agree, read three baseline answers that <code>score_v1.py</code> marked correct, and the scorer:</p>
        ${rowsHtml}<div class="lx-${ID}-wrap">${kit.code(V1_CODE, stage === 0 ? -1 : 2)}</div>
        ${fixed ? "" : `<p class="task">${q.task}</p>`}
        <div class="lpanel">${fixed ? "" : kit.options(q.opts, { picked: ans, correct: q.right })}
        ${!fixed && ans != null && ans !== q.right ? kit.feedback(q.fb[ans], false) : ""}
        ${stage >= 1 ? kit.feedback(stage === 1 ? "Right. Read the answer to “" + kit.esc(V1_ROWS[2].question) + "”: “" + kit.esc(V1_ROWS[2].answer.split("\n")[0]) + "” A version 4 reader gets version 3 facts, and the scorer counts it as correct because only <code>cited[0]</code>, the page, is compared." :
          `Right. With the fixed scorer the same answers give: baseline ${p1(ROWS[1].baseline[0])}, system ${p1(ROWS[1].system[0])}, change ${sgn(ROWS[1].change[0])} points (${sgn(ROWS[1].change[1])} to ${sgn(ROWS[1].change[2])}). The filter stays. The scorer is code that decides every number in the table: read a few rows it marks right and a few it marks wrong, and give it a unit test. For example: the SVG answer above, which cites v3 for a v4 reader, must score as wrong.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === q.right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The bootstrap step", "The golden set", "New model answers for the changed questions"];
    const fb = [
      "The bootstrap is a few seconds of computer time and does not change when the docs change.",
      `Right. New pages, renamed options and a new version mean new questions and new expected pages, written and checked by a person. If nobody does that, the harness keeps scoring the old library.`,
      "Answers are recomputed only for questions whose prompt or chunks changed, and each call is cheap. It costs money, but no one's time."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When the harness is worth it</h1>
        <p class="lead"><b>For:</b> deciding whether a change to retrieval, prompts or the model helps, and showing others why they should believe it. <b>Reach for it</b> when people will act on the number: ship, merge, hire. <b>Not</b> for a one-day prototype, where reading ten answers teaches you more; and not for plain code that gives the same output every time, where a unit test has one right answer. <b>Costs:</b> people's time to write and keep the golden set; model calls for every rerun that changes answers; a judge that needs its own check; and a scorer that can be wrong like any code.</p>
        <p class="task">Fernchart 5 comes out and renames five options. Which part of the harness costs the most to keep honest?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb.map((f, i) => [f, i === 1]))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it. */
  const CASES = [
    ["A teammate swaps the reranker. On the 50-question golden set the old one got 39 right, the new one 41. They want to merge today.", true,
      "Yes. Two questions out of fifty is the kind of gap noise makes. Ask for the paired interval of the change on the same questions before merging.",
      "Two questions out of fifty can flip from luck alone. Without a paired interval nobody knows whether the new reranker helps, does nothing or hurts."],
    ["A pull request changes the font of the docs site. Someone asks for a full eval run before merging.", false,
      "No. A font never reaches retrieval, the prompt or the model, so no number in the table can move. Spending model calls on it measures nothing.",
      "The harness measures what goes into and comes out of the model. The font changes neither, so the run would only repeat the last table."],
    ["Your portfolio README for a RAG project says “answers are 95% accurate”.", true,
      "Yes. A reviewer will ask: on how many questions, compared with what, with what error bar, and can I rerun it. Put the table, the baseline column and the one command in the README.",
      "A bare percentage is the sample report's mistake again. Without the number of questions, a baseline and a rerun command, nobody can check it."],
    ["You add a test that parse_source(\"Source: legend (v4)\") returns (\"legend\", \"4\").", false,
      "No. The function is plain code with one right output for this input. There is no sample of questions and nothing random, so there is nothing to put an error bar on. A unit test is the right tool.",
      "Error bars describe how a score would move on other questions. This input has one exact correct output, every time; a unit test checks it, and the golden set would add nothing."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Golden set, baseline and error bars, or not?</h1>
        <p class="lead">Four moments from other projects.</p>
        <p class="task">Does each one call for a scored run against a baseline, with error bars? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>The RAG project is finished</h1>
      <p class="lead">You audited a report a reviewer would not trust, packed the repo so each of their questions has a file, read a results table with a baseline and paired error bars, and caught a scorer that hid the very difference the project exists for.</p>
      <p class="lead">For your own repo: the golden set, both retrievers, the prompts, the scorer with its unit test, the saved answers, and one command that prints the table into the README.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The same idea for the agent project: there the evidence is a trace of every run, and you write up its failures from those traces.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Finish the RAG project with its evaluation harness",
    checked: "2026-11-14",
    sources: [
      "https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html",
      "https://github.com/dorianbrown/rank_bm25"
    ],
    interview: [
      {
        q: "Your RAG project's README says it is 94% accurate. The interviewer asks how much they should trust that number. What do you show them?",
        good: [
          "How many questions the golden set has and where they came from, with the expected source for each",
          "A baseline column on the same questions, so the number is a comparison and not a bare score",
          "A bootstrap interval for each score and a paired interval for the change",
          "The judge prompt in the repo, and a check that the judge agrees with my own labels on a sample",
          "One command that reruns everything with a fixed model, temperature and seed, and saved answers"
        ],
        weak: "Say it was tested on lots of questions and works well. That gives no baseline, no error bar and no way to rerun it."
      },
      {
        q: "A teammate's change moves your eval from 34 to 35 right answers out of 40 (85% to 87.5%). Do you ship it?",
        good: [
          "One question is worth 2.5 points here, so the whole gain is one question flipping",
          "Run a paired bootstrap on the same questions and see whether the change's interval includes zero",
          "Read the questions that flipped, both ways, to see what the change really did",
          "Check the scorer on those rows, since a scorer bug can create or hide a difference",
          "If the change matters, add questions that target it before deciding"
        ],
        weak: "Ship it, because the score went up. That treats a one-question change as a real gain."
      }
    ],
    screens: [audit, spotIdea, packageIt, predict, asCode, readTable, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]", "#c3 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-goon]", "[data-right]", "[data-goon]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
