/* Lesson: structured output, getting valid JSON back. Story: a job board turns recruiters' free-text posts into
   cards (role, city, salary range, remote rule) with a small hosted model. Ideas: (1) write the card's rules down
   once as a schema and validate every reply in code before it is saved (from scratch, then with Pydantic);
   (2) recover from a broken reply: retry with the error fed back, but let the schema say "unknown" when the post
   has no such fact, because a forced field gets invented (also with the provider's strict schema mode).
   Recordings (main checkout, docs/ai-path/recordings/s5a-structured-output/): post-1 … post-8, retry-same-2,
   retry-same-3, feedback-1, schema-required, schema-nullable (all 2026-11-13, openrouter, gemini-2.5-flash-lite).
   Runs (docs/ai-path/runs/s5a-structured-output/): checks.py → checks.out.txt (check_card, its trace, Pydantic
   JobCard / StrictJobCard / JobCardV2), trace_short.py → trace_short.out.txt (screen 4's shorter check_card, without
   the remote check, and its trace), retry_loop.py → retry_loop.out.txt (the retry loops replayed over the
   recorded answers). Every count on screen is computed here from that data. Plain browser script. */
(() => {
  const ID = "s5a-structured-output", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5a-structured-output.ipynb";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
  const REC_DATE = "2026-11-13";

  /* ---------- Recorded material (copied, not altered) ---------- */
  // From docs/ai-path/recordings/s5a-structured-output/post-<n>.json: the system prompt and the eight posts (request)
  // and the raw replies (response.choices[0].message.content). provider openrouter, model google/gemini-2.5-flash-lite.
  const REC = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE };
  const SYSTEM = "You turn a recruiter's job post into a job card for our job board. Reply with JSON only, with these keys: role, city, salary_min, salary_max, remote. salary_min and salary_max are yearly amounts in euros, as numbers. remote is one of: onsite, hybrid, remote.";
  const POSTS = [
    { src: "post-1", post: "We're hiring a Backend Engineer (Python) for our Lisbon office. Pay: €55,000 to €70,000 a year. Hybrid: two days a week in the office.",
      reply: "```json\n{\n  \"role\": \"Backend Engineer (Python)\",\n  \"city\": \"Lisbon\",\n  \"salary_min\": 55000,\n  \"salary_max\": 70000,\n  \"remote\": \"hybrid\"\n}\n```" },
    { src: "post-2", post: "Data Analyst wanted in Rotterdam! 45-52k depending on experience. Fully on-site, our team sits together.",
      reply: "```json\n{\n  \"role\": \"Data Analyst\",\n  \"city\": \"Rotterdam\",\n  \"salary_min\": 45000,\n  \"salary_max\": 52000,\n  \"remote\": \"onsite\"\n}\n```" },
    { src: "post-3", post: "Senior React developer, 100% remote, anywhere in the EU. Salary €80k–95k.",
      reply: "```json\n{\n  \"role\": \"Senior React developer\",\n  \"city\": \"Anywhere in the EU\",\n  \"salary_min\": 80000,\n  \"salary_max\": 95000,\n  \"remote\": \"remote\"\n}\n```" },
    { src: "post-4", post: "Join us as a QA Tester in Porto. Competitive salary and great benefits. Office-based.",
      reply: "```json\n{\n  \"role\": \"QA Tester\",\n  \"city\": \"Porto\",\n  \"salary_min\": null,\n  \"salary_max\": null,\n  \"remote\": \"onsite\"\n}\n```" },
    { src: "post-5", post: "Junior DevOps Engineer, Dublin. €42,000 - €50,000. Mostly remote, but we meet in the office once a month.",
      reply: "```json\n{\n  \"role\": \"Junior DevOps Engineer\",\n  \"city\": \"Dublin\",\n  \"salary_min\": 42000,\n  \"salary_max\": 50000,\n  \"remote\": \"hybrid\"\n}\n```" },
    { src: "post-6", post: "Product Designer for our Berlin or Munich studio. €4,500 per month. Hybrid.",
      reply: "```json\n{\n  \"role\": \"Product Designer\",\n  \"city\": \"Berlin or Munich\",\n  \"salary_min\": 54000,\n  \"salary_max\": 54000,\n  \"remote\": \"hybrid\"\n}\n```" },
    { src: "post-7", post: "Mobile developer (Flutter), Valencia. Up to €60,000. Remote-first, office optional.",
      reply: "```json\n{\n  \"role\": \"Mobile developer (Flutter)\",\n  \"city\": \"Valencia\",\n  \"salary_min\": 0,\n  \"salary_max\": 60000,\n  \"remote\": \"remote\"\n}\n```" },
    { src: "post-8", post: "Machine Learning Engineer in Tallinn. Salary from 70 000 EUR, upper limit open for the right person. Work from home on Fridays.",
      reply: "```json\n{\n  \"role\": \"Machine Learning Engineer\",\n  \"city\": \"Tallinn\",\n  \"salary_min\": 70000,\n  \"salary_max\": null,\n  \"remote\": \"hybrid\"\n}\n```" }
  ];
  // From retry-same-2.json and retry-same-3.json: the post-8 request sent again, unchanged. Replies as recorded.
  const REC_RETRY = [
    "```json\n{\n  \"role\": \"Machine Learning Engineer\",\n  \"city\": \"Tallinn\",\n  \"salary_min\": 70000,\n  \"salary_max\": null,\n  \"remote\": \"hybrid\"\n}\n```",
    "```json\n{\n  \"role\": \"Machine Learning Engineer\",\n  \"city\": \"Tallinn\",\n  \"salary_min\": 70000,\n  \"salary_max\": null,\n  \"remote\": \"hybrid\"\n}\n```"
  ];
  // From feedback-1.json: the fourth message sent (request.messages[3].content) and the reply.
  const REC_FEEDBACK = {
    src: "s5a-structured-output/feedback-1",
    sent: "Your reply failed validation:\n1 validation error for JobCard\nsalary_max\n  Input should be a valid integer [type=int_type, input_value=None, input_type=NoneType]\n    For further information visit https://errors.pydantic.dev/2.14/v/int_type\nReply again with the corrected JSON only.",
    reply: "```json\n{\n  \"role\": \"Machine Learning Engineer\",\n  \"city\": \"Tallinn\",\n  \"salary_min\": 70000,\n  \"salary_max\": 1000000,\n  \"remote\": \"hybrid\"\n}\n```"
  };
  // From schema-required.json and schema-nullable.json: post-8 sent with response_format json_schema, strict.
  const REC_SCHEMA = {
    required: "{\n\"role\": \"Machine Learning Engineer\",\n\"city\": \"Tallinn\",\n\"salary_min\": 70000,\n\"salary_max\": 100000,\n\"remote\": \"hybrid\"\n}",
    nullable: "{\n\"role\": \"Machine Learning Engineer\",\n\"city\": \"Tallinn\",\n\"salary_min\": 70000,\n\"salary_max\": null,\n\"remote\": \"hybrid\"\n}"
  };

  /* ---------- Code run output (docs/ai-path/runs/s5a-structured-output/*.out.txt) ---------- */
  // checks.out.txt section 4: Pydantic JobCard errors per reply as [field, type, msg, input]. Missing = valid.
  const PYD = {
    "post-4": [["salary_min", "int_type", "Input should be a valid integer", "None"], ["salary_max", "int_type", "Input should be a valid integer", "None"]],
    "post-7": [["salary_min", "greater_than", "Input should be greater than 0", "0"]],
    "post-8": [["salary_max", "int_type", "Input should be a valid integer", "None"]]
  };
  // checks.out.txt sections 1, 2 and 2b: what check_card returned (or raised). One returned message = one problem.
  const SCRATCH = {
    "post-4": "salary_min: not a whole number above 0",
    "post-7": "salary_min: not a whole number above 0",
    raw1: "JSONDecodeError: Expecting value: line 1 column 1 (char 0)",
    minmax: "salary_min: above salary_max",
    strsal: "salary_min: not a whole number above 0"
  };
  const TEST_MINMAX = '{"role": "Data Analyst", "city": "Rotterdam", "salary_min": 52000, "salary_max": 45000, "remote": "onsite"}';
  const TEST_STRSAL = '{"role": "Data Analyst", "city": "Rotterdam", "salary_min": "45000", "salary_max": 52000, "remote": "onsite"}';
  // trace_short.out.txt: trace of the short check_card (screen 4's listing) on post-8, as [line, key] (line 0 = the def line).
  const TRACE = [[1, null], [2, null], [3, "role"], [2, "role"], [3, "city"], [2, "city"], [3, "salary_min"], [2, "salary_min"], [3, "salary_max"], [2, "salary_max"],
    [3, "remote"], [2, "remote"], [5, "remote"], [6, "salary_min"], [5, "salary_min"], [6, "salary_max"], [7, "salary_max"], [7, "salary_max", "return"]];
  const TRACE_RESULT = "salary_max: not a whole number above 0";
  // checks.out.txt section 5 (the two "For further information" URL lines cut with …).
  const PYD_PRINT4 = ["2 validation errors for JobCard", "salary_min", "  Input should be a valid integer [type=int_type, input_value=None, input_type=NoneType]", "    …",
    "salary_max", "  Input should be a valid integer [type=int_type, input_value=None, input_type=NoneType]", "    …"];
  // checks.out.txt section 6.
  const LAX_OUT = ["lax   : {'role': 'Data Analyst', 'city': 'Rotterdam', 'salary_min': 45000, 'salary_max': 52000, 'remote': 'onsite'}",
    "strict: 1 validation error for StrictJobCard", "salary_min", "  Input should be a valid integer [type=int_type, input_value='45000', input_type=str]", "    …"];
  // retry_loop.out.txt part A, whole.
  const LOOP_A = ["   (replaying recording post-8)", "attempt 0: salary_max: Input should be a valid integer, input None", "   (replaying recording retry-same-2)",
    "attempt 1: salary_max: Input should be a valid integer, input None", "   (replaying recording retry-same-3)", "attempt 2: salary_max: Input should be a valid integer, input None",
    "gave up after 3 attempts", "result: None"];
  // retry_loop.out.txt part B, whole.
  const LOOP_B = ["   (replaying recording post-8)", "attempt 0: salary_max: Input should be a valid integer, input None", "   (replaying recording feedback-1)",
    "result: {'role': 'Machine Learning Engineer', 'city': 'Tallinn', 'salary_min': 70000, 'salary_max': 1000000, 'remote': 'hybrid'}"];
  // checks.out.txt section 9: JobCardV2 (salaries may be None), the three salary posts.
  const V2_OUT = ["post-4 -> valid: {'role': 'QA Tester', 'city': 'Porto', 'salary_min': None, 'salary_max': None, 'remote': 'onsite'}",
    "post-7 -> ValidationError, error_count = 1", "   loc: ('salary_min',) | type: greater_than | msg: Input should be greater than 0 | input: 0",
    "post-8 -> valid: {'role': 'Machine Learning Engineer', 'city': 'Tallinn', 'salary_min': 70000, 'salary_max': None, 'remote': 'hybrid'}"];

  /* ---------- Derived from the data ---------- */
  const FIELDS = ["role", "city", "salary_min", "salary_max", "remote"];
  const ALLOWED = ["onsite", "hybrid", "remote"];
  // the import script removes the ``` fence lines (same logic as strip_fence in checks.py)
  const stripFence = t => { let l = t.trim().split("\n"); if (l.length && l[0].startsWith("```")) l = l.slice(1); if (l.length && l[l.length - 1].startsWith("```")) l = l.slice(0, -1); return l.join("\n"); };
  const CARDS = POSTS.map(p => JSON.parse(stripFence(p.reply)));
  const BAD = POSTS.map(p => (PYD[p.src] || []).map(e => e[0]));
  const BROKEN = POSTS.map((_, i) => i).filter(i => BAD[i].length);
  const fenced = POSTS.filter(p => p.reply.startsWith("```")).length;
  const show = v => v === null ? "null" : typeof v === "string" ? `"${v}"` : String(v);
  const postNo = i => i + 1;
  const listNos = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const valOf = (txt, key) => JSON.parse(stripFence(txt))[key];
  const FEED_MAX = valOf(REC_FEEDBACK.reply, "salary_max"), REQ_MAX = valOf(REC_SCHEMA.required, "salary_max"), NUL_MAX = valOf(REC_SCHEMA.nullable, "salary_max");
  const POST8 = POSTS[7];

  // what the post itself says about a broken field (lesson's own words, keyed by post)
  const WHY_POST = {
    "post-4": "The post says only “competitive salary”: there is no amount to copy, so the model wrote null.",
    "post-7": "The post says “up to €60,000”: it gives no lowest amount, so the model wrote 0.",
    "post-8": "The post says the upper limit is “open”: there is no highest amount, so the model wrote null."
  };
  const NOTE_POST = {
    "post-3": " Look at city, though: “Anywhere in the EU” is text, so it passes, but it is not a city. A schema checks the shape of a reply, not whether it makes sense.",
    "post-6": " Two things to notice: “Berlin or Munich” is text, so it passes, though it is two cities. And the model turned €4,500 a month into 54000 a year on its own: the schema cannot tell whether that sum is right."
  };

  /* ---------- Small helpers and lesson-only style ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}post { margin: 16px 0 0; padding: 10px 14px; border-left: 3px solid var(--line); background: var(--surface); color: var(--ink-2); font-size: 16.5px; }
      .${P}post b { display: block; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 2px; }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--mono); color: var(--muted); }
      .lopts button.${P}tog { font-family: var(--mono); font-size: 15px; }
      .lopts button.${P}tog[aria-pressed="true"] { border: 2.5px solid var(--ink); background: var(--surface); font-weight: 700; }
      .lopts button.${P}tog[aria-pressed="true"]::before { content: "✕ "; }
      .${P}checks { margin: 14px 0 0; padding-left: 26px; font-size: 16.5px; }
      .${P}checks li { margin: 2px 0; }
      .${P}checks code, .${P}rules code { font-size: 15px; }
      .${P}rules { border-collapse: collapse; margin-top: 16px; font-size: 15.5px; width: 100%; }
      .${P}rules td { border-bottom: 1px solid var(--line); padding: 6px 10px 6px 0; vertical-align: top; }
      .${P}rules td:first-child { font: 600 14.5px var(--mono); white-space: nowrap; }
      .${P}list { margin: 14px 0 0; padding-left: 0; list-style: none; }
      .${P}list li { border-top: 1px solid var(--line); }
      .${P}list button { display: flex; gap: 12px; align-items: flex-start; width: 100%; min-height: 48px; padding: 10px 0; border: 0; background: none; color: var(--ink); font: 400 16.5px/1.45 var(--font); text-align: left; cursor: pointer; }
      .${P}list button::before { content: ""; flex: none; width: 20px; height: 20px; margin-top: 2px; border: 2px solid var(--ink-2); border-radius: 4px; }
      .${P}list button[aria-pressed="true"]::before { content: "✓"; font: 700 15px/20px var(--font); text-align: center; color: var(--good); border-color: var(--good); }
      .${P}cost { margin: 10px 0 0; padding-left: 20px; font-size: 16.5px; }
      .${P}cost li { margin: 3px 0; }
      .${P}wrap div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 8ch); text-indent: -8ch; }
      .${P}who { margin: 14px 0 0; font-weight: 600; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  // a listing of text (lines array or one string); wrap: long output lines wrap instead of scrolling sideways
  const block = (lines, cap, wrap) => { const ls = typeof lines === "string" ? lines.split("\n") : lines; return `<pre class="lcode${wrap ? ` ${P}wrap` : ""}">${ls.map(c => `<div>${LessonKit.esc(c) || " "}</div>`).join("")}</pre>${cap ? `<p class="${P}cap">${cap}</p>` : ""}`; };
  // the shared code listing, with long lines wrapping on a phone instead of hiding off the side
  const codeW = (lines, active) => LessonKit.code(lines, active).replace('class="lcode"', `class="lcode ${P}wrap"`);
  const recCap = `Recorded model output, ${REC_DATE}`;
  const runCap = "Output of a run on our machine (Python, Pydantic 2)";
  const postBox = (label, text) => `<div class="${P}post"><b>${LessonKit.esc(label)}</b>${LessonKit.esc(text)}</div>`;

  /* 1. The situation, then check eight recorded replies by hand. */
  const RULES = [["role", "text"], ["city", "text"], ["salary_min", "a whole number above 0"], ["salary_max", "a whole number above 0, not below salary_min"], ["remote", "one of: onsite, hybrid, remote"]];
  const rulesTable = () => `<table class="${P}rules"><tbody>${RULES.map(([f, r]) => `<tr><td>${f}</td><td>${r}</td></tr>`).join("")}<tr><td>all</td><td>every field is there</td></tr></tbody></table>`;
  function passWhy(i, f) {
    const c = CARDS[i], v = c[f];
    if (f === "role" || f === "city") return `${f} is ${kitEsc(show(v))}: text, so it passes.`;
    if (f === "remote") return `remote is ${kitEsc(show(v))}, one of the three allowed values, so it passes.`;
    if (f === "salary_min") return `salary_min is ${v}: a whole number above 0${Number.isInteger(c.salary_max) ? ` and not above salary_max (${c.salary_max})` : ""}, so it passes.`;
    return `salary_max is ${v}: a whole number above 0 and not below salary_min (${c.salary_min})${v === c.salary_min ? "; equal is allowed" : ""}, so it passes.`;
  }
  function failWhy(i, f) {
    const v = CARDS[i][f];
    return v === null ? `${f} is null. The rule asks for a whole number above 0, and null is not a number at all.`
      : v === 0 ? `${f} is 0. The rule asks for a number above 0.` : `${f} is ${kitEsc(show(v))}, which breaks its rule.`;
  }
  const kitEsc = s => LessonKit.esc(s);
  // the order the replies are checked in: a broken one first, so the first Check can already be a mistake
  const ORDER = [BROKEN[0], ...POSTS.map((_, i) => i).filter(i => i !== BROKEN[0])];
  function byHand({ el, done, kit }) {
    style();
    let n = 0, sel = new Set(), verdict = null, fin = false;
    const paint = () => {
      const k = ORDER[n], p = POSTS[k], truth = BAD[k];
      const last = n === POSTS.length - 1;
      el.innerHTML = `<h1>Eight job cards, checked by hand</h1>
        <p class="lead">You run a small job board. Recruiters paste free-text posts, and a small hosted model turns each post into a card: role, city, salary range and remote-work rule. Code shows and filters these cards, so a broken card breaks the board. The import script saved every reply straight onto the board, and some cards came out broken. The rules for a card:</p>
        ${rulesTable()}
        <p class="lead" style="margin-top:12px">The model wrapped ${fenced === POSTS.length ? "every" : `${fenced} of ${POSTS.length}`} reply in a Markdown code fence: a <code>\`\`\`json</code> line before the JSON and a <code>\`\`\`</code> line after it. The import script removes those two lines first, so they are left out below.</p>
        <p class="task">Reply ${n + 1} of ${POSTS.length}. Mark every field that breaks its rule, then press Check. Mark nothing if the card is valid.</p>
        ${postBox(`Post ${postNo(k)}`, p.post)}
        ${block(stripFence(p.reply).split("\n"), recCap)}
        <div class="lpanel">
          <div class="lopts">${FIELDS.map(f => `<button type="button" class="${P}tog" data-f="${f}" aria-pressed="${sel.has(f)}" ${verdict && verdict.ok ? "disabled" : ""}>${f}</button>`).join("")}</div>
          <div class="lsteps"><button type="button" class="btn" data-check ${verdict && verdict.ok ? "disabled" : ""}>Check: ${sel.size ? `${plural(sel.size, "field")} broken` : "valid"}</button>
          ${verdict && verdict.ok && !last ? `<button type="button" class="btn" data-more>Next reply</button>` : ""}</div>
          ${verdict ? kit.feedback(verdict.html, verdict.ok) : ""}
          ${fin ? kit.feedback(`All ${POSTS.length} checked. ${WORDS[BROKEN.length]} of ${POSTS.length} cards would have gone on the board broken: posts ${listNos(BROKEN.map(postNo))}. In each one the post gave no amount for a salary, and the model filled the gap with null or 0. And ${WORDS[Object.keys(NOTE_POST).length].toLowerCase()} valid cards still read oddly. Checking by hand works for ${POSTS.length} posts. It does not work for a few thousand a day.`) : ""}
        </div>`;
      el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { const f = b.dataset.f; sel.has(f) ? sel.delete(f) : sel.add(f); verdict = null; paint(); });
      el.querySelector("[data-check]").onclick = () => {
        const extra = [...sel].filter(f => !truth.includes(f)), missed = truth.filter(f => !sel.has(f));
        if (!extra.length && !missed.length) {
          verdict = { ok: true, html: truth.length ? `Right. ${truth.map(f => failWhy(k, f)).join(" ")} ${WHY_POST[p.src] || ""}` : `Right: valid. Every field is there and follows its rule.${NOTE_POST[p.src] || ""}` };
          if (last) { fin = true; paint(); done(); return; }
        } else {
          verdict = { ok: false, html: [...extra.map(f => `You marked ${f}, but ${passWhy(k, f).replace(/^\w+ is/, "it is")}`), ...(missed.length ? [`You missed ${missed.length === 1 ? "a broken field" : `${missed.length} broken fields`}. ${missed.map(f => failWhy(k, f)).join(" ")}`] : [])].join(" ") };
        }
        paint();
      };
      const go = el.querySelector("[data-more]");
      if (go) go.onclick = () => { n++; sel = new Set(); verdict = null; paint(); };
    };
    paint();
  }

  /* 2. Spot the idea: check every reply in code, against rules written down once. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Add “Always fill every field with a valid value” to the prompt",
      "Write the card's rules down once in code, check every reply against them before saving, and decide what happens to a reply that fails",
      "Switch to a bigger, more expensive model"
    ];
    const paint = () => {
      el.innerHTML = `<h1>Stop a broken card at the door</h1>
        <p class="lead">${WORDS[BROKEN.length]} of ${POSTS.length} replies would have put a broken card on the board. The prompt already asked for numbers. The import script trusted every reply.</p>
        <p class="task">Which change makes sure a broken card is never saved?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. The written-down rules are a <b>schema</b>: which fields a reply must have, and what each may hold. Checking a reply against it is <b>validation</b>. A prompt asks for the shape. Validation makes sure of it, every time, in your own code. A reply that fails never reaches the board: it is retried, fixed, or sent to a person.`, true)
          : ans === 0 ? kit.feedback(`A prompt can only ask. Nothing in it checks the reply, so you still would not know which cards are broken. And look at post 8: the post has no upper salary. Demanding a number the post does not have pushes the model to make one up. You will see that happen later in this lesson.`, false)
          : kit.feedback(`A bigger model may slip less often, but not never, and it costs more for every post. Without a check you still cannot tell which replies slipped. Post 4 has no salary at all: no model can copy a number that is not there.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Use it: a checker runs its checks in order; predict which one stops each reply. */
  const CHECKS = ["Read the text as JSON", "Every field is there", "Both salaries are whole numbers above 0", "remote is an allowed value", "salary_min is not above salary_max"];
  const stopAt = out => out.startsWith("JSONDecodeError") ? 1 : out.includes("missing") ? 2 : out.includes("whole number") ? 3 : out.startsWith("remote") ? 4 : out.includes("above salary_max") ? 5 : 0;
  const CASES3 = [
    { title: "Reply to post 7, fence removed", text: stripFence(POSTS[6].reply), out: SCRATCH["post-7"], cap: recCap,
      why: "salary_min is 0, and check 3 asks for a number above 0." },
    { title: "Reply to post 1, if the script forgot to remove the fence", text: POSTS[0].reply, out: SCRATCH.raw1, cap: recCap,
      why: "The first line is <code>```json</code>, not JSON. Python's <code>json.loads</code> wants a value such as <code>{</code> at the very first character, so it fails before any field is looked at. Nothing is wrong with the fields." },
    { title: "A test input we wrote", text: JSON.stringify(JSON.parse(TEST_MINMAX), null, 2), out: SCRATCH.minmax, cap: "Written by us, not a model reply",
      why: "Every field is there and every value has the right type, but 52000 is above 45000. Only check 5 compares two fields." }
  ];
  const passTxt = (n, c) => n === 1 ? "the text reads as JSON" : n === 2 ? "all five fields are there" : n === 3 ? "both salaries are whole numbers above 0" : n === 4 ? `remote is "${JSON.parse(c.text).remote}", an allowed value` : "salary_min is not above salary_max";
  function predictChecks({ el, done, kit }) {
    style();
    const ans = CASES3.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A checker, one check at a time</h1>
        <p class="lead">Here is a plan for checking a reply in code. It runs these checks in order and stops at the first one that fails, reporting the field:</p>
        <ol class="${P}checks">${CHECKS.map(c => `<li>${c}</li>`).join("")}</ol>
        <p class="task">For each input, predict which check stops it. Pick "none" if it passes them all.</p>
        ${CASES3.map((c, i) => {
          const right = stopAt(c.out), opts = ["1", "2", "3", "4", "5", "none"], ri = right ? right - 1 : 5;
          const g = ans[i], gn = g == null ? null : g === 5 ? 0 : g + 1;
          return `<div class="lcase" id="c${i}"><p>${kit.esc(c.title)}</p>${block(c.text, c.cap)}
            ${kit.options(opts, { picked: g, correct: ri, num: true })}
            ${g == null ? "" : g === ri
              ? kit.feedback(`Right: check ${right}. ${c.why} The checker really printed:<br><code>${kit.esc(c.out)}</code>`, true)
              : kit.feedback(gn === 0 ? `It does not pass. ${c.why}`
                : gn < right ? `Check ${gn} passes here: ${kit.esc(passTxt(gn, c))}. ${c.why}`
                : `The checker never reaches check ${gn}. ${c.why}`, false)}</div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES3.every((x, j) => ans[j] === (stopAt(x.out) ? stopAt(x.out) - 1 : 5))) done();
      }));
    };
    paint();
  }

  /* 4. The same checker in plain Python, a recorded trace on post 8. */
  const CODE_SCRATCH = [
    "def check_card(text):",
    "    card = json.loads(text)",
    "    for key in REQUIRED:",
    "        if key not in card:",
    "            return f\"{key}: missing\"",
    "    for key in [\"salary_min\", \"salary_max\"]:",
    "        if type(card[key]) is not int or card[key] <= 0:",
    "            return f\"{key}: not a whole number above 0\"",
    "    if card[\"salary_min\"] > card[\"salary_max\"]:",
    "        return \"salary_min: above salary_max\"",
    "    return \"valid\""
  ];
  const GATE = TRACE.findIndex(([ln, key]) => ln === 6 && key === "salary_max");
  function scratchCode({ el, done, kit }) {
    style();
    let i = 0, gateAns = null;
    const card = CARDS[7];
    const gateOpts = [`It returns "${TRACE_RESULT}"`, "It moves on to the min and max check", "It stops with a Python error"];
    const paint = () => {
      const [ln, key, ev] = TRACE[i];
      const atGate = i === GATE, locked = atGate && gateAns !== 0;
      const say = ev === "return" ? `It returns <code>"${kit.esc(TRACE_RESULT)}"</code>. The card for post 8 is stopped before it reaches the board, and the message names the field.`
        : ln === 1 ? "Turn the text into a Python dict (like a JS object). If the text were not JSON, this line would raise an error and stop here."
        : ln === 2 ? (key == null ? "Walk through the five required field names." : `Next name after ${key}.`)
        : ln === 3 ? `Is "${key}" in the card? Yes, so no return.`
        : ln === 5 ? (key === "remote" ? "All five fields are there. Now the two salaries." : `Next salary after ${key}.`)
        : ln === 6 ? (atGate ? "The value here is null in JSON, which Python reads as None." : `card["${key}"] is ${show(card[key])}: an int above 0. The if is false.`)
        : ln === 7 ? "The if was true, so return the message." : "";
      el.innerHTML = `<h1>The checker, written in Python</h1>
        <p class="lead">The checks as one function. <code>REQUIRED</code> holds the five field names. To keep the listing short, check 4 (the remote value) is left out: it is one more <code>if</code> like the others. The steps are a recorded run on the reply to post 8.</p>
        <p class="task">Step through to the end. When a question appears, answer it before you step on.</p>
        ${codeW(CODE_SCRATCH, ln)}
        <div class="vars"><span>key <b>${key == null ? "–" : kit.esc(key)}</b></span><span>card[key] <b>${key == null || ln < 2 ? "–" : kit.esc(card[key] === null ? "None" : show(card[key]))}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say)}
        ${atGate ? `<div class="lpanel"><p><b>The highlighted line is about to run with key = "salary_max". What happens?</b></p>${kit.options(gateOpts, { picked: gateAns, correct: 0 })}
          ${gateAns == null ? "" : gateAns === 0 ? kit.feedback("Right. <code>type(None) is not int</code> is True, so the whole if is true. Step on to see it return.", true)
          : gateAns === 1 ? kit.feedback("To move on, the if must be false. But <code>type(None)</code> is NoneType, not int, so the left side is already True and the if is true.", false)
          : kit.feedback("<code>None &lt;= 0</code> would raise a TypeError in Python. But <code>or</code> stops early: the left side is already True, so the right side never runs. No error.", false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || locked ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { gateAns = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 5. The same rules with Pydantic: predict two results. */
  const CODE_PYD = [
    "class JobCard(BaseModel):",
    "    role: str",
    "    city: str",
    "    salary_min: int = Field(gt=0)",
    "    salary_max: int = Field(gt=0)",
    "    remote: Literal[\"onsite\", \"hybrid\", \"remote\"]",
    "    @model_validator(mode=\"after\")",
    "    def min_not_above_max(self):",
    "        if self.salary_min > self.salary_max:",
    "            raise ValueError(\"salary_min is above salary_max\")",
    "        return self"
  ];
  function pydantic({ el, done, kit }) {
    style();
    const n4 = PYD["post-4"].length, scratch4 = SCRATCH["post-4"].split("\n").filter(Boolean).length;
    const o1 = ["1", "2", "0"].map(String), r1 = o1.indexOf(String(n4));
    const o2 = ["It rejects it, like the plain checker", "It accepts it and stores the number 45000", "It accepts it and keeps the text \"45000\""];
    const ans = [null, null];
    const paint = () => {
      el.innerHTML = `<h1>The same rules, with Pydantic</h1>
        <p class="lead"><b>Pydantic</b> is the usual Python library for this. You write the schema as a class with typed fields. <code>Field(gt=0)</code> means greater than 0. <code>Literal</code> lists the allowed values. A <code>model_validator</code> holds rules that compare fields; <code>mode="after"</code> runs it once the field checks have passed. Then <code>card = JobCard.model_validate_json(text)</code> reads the JSON text and checks it in one call. It either returns a card or raises a <code>ValidationError</code>.</p>
        ${codeW(CODE_PYD, -1)}
        <p class="task">Predict both results before you look.</p>
        <div class="lcase" id="c0"><p>The reply to post 4 has both salaries null. The plain checker reported ${plural(scratch4, "problem")} and stopped. How many errors does Pydantic report?</p>
          ${kit.options(o1, { picked: ans[0], correct: r1, num: true })}
          ${ans[0] == null ? "" : ans[0] === r1 ? kit.feedback(`Right: ${n4}. Pydantic does not stop at the first problem: it checks every field and lists all the errors, each with its field name. That gives a retry or a person the whole list at once.`, true)
            : kit.feedback(o1[ans[0]] === "0" ? "null is not an integer, so the card cannot pass." : "That is how the plain checker works: it returns at the first problem. Pydantic checks every field and lists all the errors.", false)}
          ${ans[0] == null ? "" : block(PYD_PRINT4, runCap, true)}</div>
        <div class="lcase" id="c1"><p>A test input we wrote gives salary_min as the text <code>"45000"</code> instead of the number 45000. The plain checker rejected it. What does JobCard do?</p>
          ${kit.options(o2, { picked: ans[1], correct: 1 })}
          ${ans[1] == null ? "" : ans[1] === 1 ? kit.feedback(`Right. By default Pydantic converts values when it safely can: the text "45000" becomes the int 45000. If you want a mistyped value refused instead, turn on strict mode with <code>model_config = ConfigDict(strict=True)</code>. The second line below is the same input against a strict copy of the class.`, true)
            : ans[1] === 0 ? kit.feedback("The plain checker used <code>type(...) is not int</code>, which refuses text. Pydantic's default is more forgiving: it converts the text \"45000\" into the int 45000.", false)
            : kit.feedback("The field is declared <code>int</code>, so a valid card always holds an int. Pydantic converts the text \"45000\" into 45000, and refuses text it cannot convert.", false)}
          ${ans[1] == null ? "" : block(LAX_OUT, runCap, true)}</div>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === r1 && ans[1] === 1) done();
      }));
    };
    paint();
  }

  /* 6. Broken on purpose: a retry loop that fails the same way three times. */
  const CODE_LOOP = [
    "def import_post_buggy(messages):",
    "    for attempt in range(3):",
    "        reply = ask_model(messages)",
    "        try:",
    "            return JobCard.model_validate_json(strip_fence(reply))",
    "        except ValidationError as err:",
    "            print(f\"attempt {attempt}: …\")  # message cut",
    "    print(\"gave up after 3 attempts\")",
    "",
    "print(\"result:\", import_post_buggy(list(first)))"
  ];
  function brokenLoop({ el, done, kit }) {
    style();
    const same = REC_RETRY.every(r => r === POST8.reply);
    const c1 = [
      "The model cannot read the post",
      "Every attempt sends exactly the same messages, and the error never goes back to the model",
      "Three attempts are too few",
      "strip_fence breaks the JSON"
    ];
    const c2 = ["Add the failed reply and the error message to messages before the next attempt", "Change range(3) to range(10)", "Raise max_tokens so the reply has more room"];
    const ans = [null, null];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: three tries, one answer</h1>
        <p class="lead">The team added a retry: if a reply fails validation, ask again, up to three times. Here is the loop and its log for post 8. The model's answers are real recordings. The loop ran on our machine and replayed them. <code>ask_model</code> sends the messages and returns the reply text. <code>first</code> holds the messages for post 8. The last line prints what the loop returned. The request uses temperature 0. All three replies were ${same ? "exactly the same" : "different"}.</p>
        ${codeW(CODE_LOOP, -1)}
        ${block(LOOP_A, "Output of a run on our machine, over the recorded answers", true)}
        <p class="task">Find the cause, then pick the fix.</p>
        <div class="lcase" id="c0"><p>Why does every attempt fail the same way?</p>${kit.options(c1, { picked: ans[0], correct: 1 })}
          ${ans[0] == null ? "" : ans[0] === 1 ? kit.feedback("Right. <code>messages</code> never changes inside the loop, and the error is only printed. At temperature 0 the model sticks to its most likely answer, and here the same request brought back the same reply each time. Retrying without new information repeats the failure and pays for it each time.", true)
            : ans[0] === 0 ? kit.feedback("The reply is a sensible reading of the post: role, city, salary_min and remote are all right, and the post really has no upper limit. The model read it fine.", false)
            : ans[0] === 2 ? kit.feedback("With the same request at temperature 0, ten attempts would very likely give ten identical failures, and ten charges. The number of tries is not the problem.", false)
            : kit.feedback("The log says Pydantic found salary_max = None. To get that far, the JSON was read fine. strip_fence did its job.", false)}</div>
        ${ans[0] === 1 ? `<div class="lcase" id="c1"><p>Which change gives the next attempt a real chance?</p>${kit.options(c2, { picked: ans[1], correct: 0 })}
          ${ans[1] == null ? "" : ans[1] === 0 ? kit.feedback("Right. Send the conversation so far plus the model's own reply and Pydantic's message, which names the field and the problem. Now the second request is different from the first. The next screen shows what came back.", true)
            : ans[1] === 1 ? kit.feedback("More attempts with the same messages give more copies of the same reply. It only adds cost and waiting.", false)
            : kit.feedback("The reply was not cut off: it is a complete JSON object that ended normally. More room changes nothing.", false)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === 1 && ans[1] === 0) done();
      }));
    };
    paint();
  }

  /* 7. Recover with the error fed back, and see what it does to a missing fact. */
  function feedBack({ el, done, kit }) {
    style();
    const o1 = ["null again", "A number, though the post gives none", "A sentence saying the limit is open"];
    const r1 = FEED_MAX === null ? 0 : Number.isInteger(FEED_MAX) ? 1 : 2;
    const o2 = ["Let salary_max be empty: int | None, so “not stated” is a valid answer", "Add a rule: salary_max must be below 500 000", "Feed the error back up to five times instead of once"];
    const ans = [null, null];
    const paint = () => {
      el.innerHTML = `<h1>Feed the error back</h1>
        <p class="lead">The fixed loop sends post 8 again, with the model's reply and this message added:</p>
        ${block(REC_FEEDBACK.sent, "The message the loop sent (recorded request)", true)}
        <p class="task">Predict the new reply, then choose the real fix.</p>
        <div class="lcase" id="c0"><p>What will the model put in salary_max this time?</p>${kit.options(o1, { picked: ans[0], correct: r1 })}
          ${ans[0] == null ? "" : ans[0] === r1 ? kit.feedback(`Right. It wrote <b>${FEED_MAX}</b>. The post says the upper limit is open, so this number is made up, and it passes validation: the card goes on the board. Feeding the error back fixed the shape and broke the truth.`, true)
            : kit.feedback(ans[0] === 0 ? `The error said "should be a valid integer", so the model gave an integer: ${FEED_MAX}. The post has no such number, so the model made one up.` : `The prompt asks for JSON only, and the model kept to that. It gave an integer, ${FEED_MAX}, which the post never states.`, false)}
          ${ans[0] == null ? "" : `<p class="${P}who">A small hosted model answered:</p>${block(REC_FEEDBACK.reply, recCap)}${block(LOOP_B, "The loop's output (run on our machine)", true)}`}</div>
        ${ans[0] === r1 ? `<div class="lcase" id="c1"><p>What should change so this card is both valid and true?</p>${kit.options(o2, { picked: ans[1], correct: 0 })}
          ${ans[1] == null ? "" : ans[1] === 0 ? kit.feedback("Right. The reply was honest and the schema was wrong: it demanded a fact the post does not have. Let the schema say “unknown”. Below are the three broken replies from the first screen, run against a copy of JobCard where both salaries may be None. Posts 4 and 8 pass as written. Post 7 still fails, but it is the same gap: the post gives no lowest amount, and the model wrote 0 where null belonged. Feeding back “should be greater than 0” could just get an invented minimum. Fix it in the prompt (“use null when the post gives no amount”) or with an error message that offers null. Keep retries with feedback for real slips: a missing key, text where a number belongs, a remote value outside the three allowed. Never use them to force a missing fact.", true)
            : ans[1] === 1 ? kit.feedback(`The model could just pick a smaller made-up number, and it would pass. A range rule catches nonsense values, not invented ones. The post has no upper limit, so any number is wrong.`, false)
            : kit.feedback("Each extra round pushes the same way: the schema demands an integer, so the model keeps supplying one. More rounds cannot produce a number the post does not contain.", false)}
          ${ans[1] === 0 ? block(V2_OUT, runCap, true) : ""}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === r1 && ans[1] === 0) done();
      }));
    };
    paint();
  }

  /* 8. The provider's schema mode: the shape is enforced, the facts are not. */
  const RF = [
    "\"response_format\": {",
    "  \"type\": \"json_schema\",",
    "  \"json_schema\": {",
    "    \"name\": \"job_card\",",
    "    \"strict\": true,",
    "    \"schema\": { … every field required,",
    "      \"salary_max\": {\"type\": \"integer\"} … }",
    "  }",
    "}"
  ];
  function schemaMode({ el, done, kit }) {
    style();
    const opts = ["The request fails with an error", "null anyway", "An integer"];
    const right = REQ_MAX === null ? 1 : Number.isInteger(REQ_MAX) ? 2 : 0;
    const noFence = [REC_SCHEMA.required, REC_SCHEMA.nullable].every(t => t.startsWith("{"));
    let ans = null;
    const paint = () => {
      el.innerHTML = `<h1>Let the provider enforce the shape</h1>
        <p class="lead">Many model APIs can also take the schema itself with the request. In OpenAI-style chat APIs, such as the one used here, it goes in the <code>response_format</code> field with type <code>json_schema</code>. Other APIs name it differently. With <code>strict</code> on, a provider that supports it makes the model's output follow the schema. Pydantic can write this schema for you with <code>JobCard.model_json_schema()</code>. You may need to adjust it: strict mode accepts only part of JSON Schema (the standard way to write a schema as JSON). OpenAI's, for example, wants <code>additionalProperties: false</code> and every field listed as required.</p>
        ${codeW(RF, -1)}
        <p class="task">Post 8 is sent with this schema, where salary_max must be an integer. Predict what comes back.</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: right })}
        ${ans == null ? "" : ans === right ? kit.feedback(`Right: <b>${REQ_MAX}</b>. The schema left no room for null, so the model had to write some integer, and it invented one. The second request allowed <code>["integer", "null"]</code> for salary_max and got <b>${show(NUL_MAX)}</b> back. ${noFence ? "Neither reply has a <code>```</code> fence: the format is fixed by the request, not by the prompt's wording." : ""}`, true)
          : ans === 0 ? kit.feedback("The schema is valid and this model supports schema mode on this API, so the request goes through. The question is what the model writes when the post has no number.", false)
          : kit.feedback("null is not an integer, and strict mode keeps the output to the schema. So the model has to write some integer.", false)}
        ${ans == null ? "" : `${block(REC_SCHEMA.required, `salary_max must be an integer. ${recCap}`)}${block(REC_SCHEMA.nullable, `salary_max may be an integer or null. ${recCap}`)}
          ${kit.feedback("So keep validating in your own code even with schema mode on. The provider makes sure of the shape. Your code still checks rules that compare fields, such as min not above max. And the providers' own docs say enforcement varies by provider and replies can still contain mistakes.")}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 9. The big picture, with a task: which cost bites first. */
  const COSTS = ["More tokens in every call", "Extra calls and waiting", "Upkeep of the schema"];
  const SIT9 = [
    { q: "Your prompt describes 40 fields with long explanations, sent with every one of the board's posts.", a: 0,
      yes: "Right. The field instructions are part of every request, so their tokens are paid for on every call, and long explanations add more.",
      no: ["", "Nothing here fails or retries. The cost is the size of the instructions, which ride along with every post.", "The fields do not change here. The instructions are just long, and they go out with every call."] },
    { q: "One reply in ten fails validation, and the loop feeds the error back once before giving up.", a: 1,
      yes: "Right. Each failed reply means a second, longer call (it carries the first reply and the error), and the recruiter waits for both.",
      no: ["The schema is the same size. The cost is the second call for every failed reply, plus the wait.", "", "The schema does not change. The cost is the retry: one more call per failure."] },
    { q: "The board adds a “visa sponsorship” field, and cards saved last month do not have it.", a: 2,
      yes: "Right. The schema, the prompt, the stored cards and the code reading them must change together. That is ongoing work, not a per-call cost.",
      no: ["One more field adds a few tokens, but the real work is changing the schema, the prompt and the old cards together.", "Nothing fails at run time here. The work is keeping the schema, the prompt and the stored cards in step.", ""] }
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = SIT9.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What it is for:</b> turning free text into data your code uses: cards, form fields, labels, rows. <b>Reach for it</b> when a program reads the reply, not a person. <b>Do not</b> when a person reads the answer (a summary, a chat reply): asking for JSON adds instructions to every call and a way to fail, and no code checks it. When the fields cannot be fixed in advance, keep free text. When the model must fetch data or act, that is tool calling, a later lesson. <b>What it costs:</b></p>
        <ul class="${P}cost"><li>the field instructions in every call;</li><li>extra calls and waiting when replies fail;</li><li>keeping the schema, prompt and stored data in step;</li><li>strict modes accept only part of JSON Schema.</li></ul>
        <p class="task">For each situation, pick the cost that bites first.</p>
        ${SIT9.map((s, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(s.q)}</p>${kit.options(COSTS, { picked: ans[i], correct: s.a })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === s.a ? s.yes : s.no[ans[i]], ans[i] === s.a)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SIT9.every((s, j) => ans[j] === s.a)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it in new situations, with "no" cases. */
  const CASES = [
    ["A clinic's intake page: patients describe symptoms in their own words, and the triage queue needs age, a list of symptoms and an urgency of low, medium or high.", true,
      "Yes. A program sorts the queue, so the reply must have fixed fields and an allowed set of urgency values. Validate every reply, and let a field be empty when the patient did not say.",
      "The queue is code, not a person. It needs fixed fields and one of three urgency values on every reply, which is exactly a schema plus validation."],
    ["A writing app suggests a better opening paragraph for a cover letter, shown to the user as text.", false,
      "No. A person reads the paragraph and nothing parses it. Wrapping it in JSON adds tokens and a new way to fail, and no field is checked.",
      "A schema helps when code reads the reply. Here a person reads one paragraph of prose. JSON would only wrap the text in quotes and add a way to fail."],
    ["A nightly job labels 50,000 product reviews as positive, negative or mixed for a dashboard.", true,
      "Yes. One field with three allowed values. At this volume, a reply that says “Mostly positive!” must be caught by code, not by eye.",
      "The dashboard counts labels in code. One field with three allowed values, checked on every reply, keeps “Mostly positive!” out of the counts."],
    ["A support bot must tell a customer today's train delays, which change every few minutes.", false,
      "No. The problem is missing facts, not the shape of the reply. A schema cannot give the model data it does not have: you saw it invent a salary to fill a required field. The bot needs to fetch the delays first, which is tool calling.",
      "Structured output fixes the shape of a reply. It cannot supply facts. Forced to fill a delay field, the model would make one up, as it made up a salary. The bot must fetch the delays first (tool calling)."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Schema and validation here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the job board.</p>
        <p class="task">For each one, decide if asking for structured output, and validating it, is the right tool. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist (from our own run), then the next lesson. */
  const nValid = POSTS.length - BROKEN.length;
  const CHECKLIST = [
    `The plain checker prints <code>valid</code> for ${nValid} of the ${POSTS.length} replies, and a salary message for posts ${listNos(BROKEN.map(postNo))}.`,
    `Without <code>strip_fence</code>, <code>json.loads</code> raises <code>JSONDecodeError: Expecting value: line 1 column 1 (char 0)</code>.`,
    `Pydantic lists ${PYD["post-4"].length} errors for post 4, one for salary_min and one for salary_max, both of type <code>int_type</code>.`,
    `The text "45000" passes <code>JobCard</code> and fails <code>StrictJobCard</code>.`,
    `The loop that resends the same messages gives up after 3 attempts. The loop that feeds the error back returns salary_max ${FEED_MAX}, a number the post never states.`,
    `With both salaries allowed to be None, posts 4 and 8 pass and post 7 still fails on salary_min = 0.`
  ];
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can make a model's reply safe to use</h1>
      <p class="lead">Write the rules as a schema. Validate every reply in code before you use it. Feed the error back for real slips, such as a missing key or a wrong type, and let the schema and the prompt say “unknown” for facts the input does not have. Schema mode at the provider fixes the shape, not the truth.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson</a>, run it and tick what you see.` : "The notebook for this lesson is on its way. When it is here, run it and tick what you see:"}</p>
      <ul class="${P}list">${CHECKLIST.map((t, i) => `<li><button type="button" aria-pressed="false" data-k="${i}"><span>${t}</span></button></li>`).join("")}</ul>
      ${nx ? `<p class="lead" style="margin-top:18px">Next: <b>${kit.esc(nx.title)}</b>. A long fixed instruction, like this lesson's prompt, is sent with every call. The next lesson shows how to stop paying full price for that part.</p>` : ""}`;
    // ticking is optional and saves nothing
    el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"));
    done();
  }

  LessonKit.define(ID, {
    title: "Structured output: getting valid JSON back",
    checked: "2026-11-13",
    sources: [
      "https://pydantic.dev/docs/validation/latest/concepts/models/",
      "https://pydantic.dev/docs/validation/latest/errors/errors/",
      "https://pydantic.dev/docs/validation/latest/concepts/strict_mode/",
      "https://pydantic.dev/docs/validation/latest/concepts/validators/",
      "https://pydantic.dev/docs/validation/latest/concepts/json_schema/",
      "https://openrouter.ai/docs/features/structured-outputs",
      "https://developers.openai.com/api/docs/guides/structured-outputs"
    ],
    interview: [{
      q: "Your pipeline asks a model for JSON for each incoming document and writes it to a database. A few percent of rows turn out empty or wrong. How do you make it reliable?",
      good: [
        "Validate every reply against a schema in code (for example a Pydantic model) before writing; nothing unvalidated reaches the database",
        "Split failures: format slips get one retry with the validation error fed back; a fact missing from the document is allowed as null or sent to a person, because forcing it makes the model invent a value",
        "Use the provider's strict schema mode where it is supported to remove broken JSON, but keep validating rules that compare fields",
        "Log every failure and track the rate; keep the hard documents as a test set for prompt and schema changes"
      ],
      weak: "“Tell the model to always return valid JSON and retry until it parses.” Parsing is not validation, and blind retries either repeat the same failure or push the model to make up the missing value."
    }, {
      q: "A teammate says: we turned on strict JSON schema mode, so we can delete our validation code. Do you agree?",
      good: [
        "No: strict mode fixes the shape, not whether the values are true or consistent",
        "Rules between fields (min not above max) and business rules still need code",
        "Enforcement varies by provider and model, and refusals or cut-off replies still happen",
        "A required field with no source fact gets filled with an invented value; the schema should allow null there"
      ],
      weak: "“Yes, the provider guarantees the schema.” It misses invented values, cross-field rules and providers that only partly enforce the schema."
    }],
    screens: [byHand, spotIdea, predictChecks, scratchCode, pydantic, brokenLoop, feedBack, schemaMode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-check]"], right: ORDER.flatMap((k, n) => [...BAD[k].map(f => `[data-f="${f}"]`), "[data-check]", ...(n < ORDER.length - 1 ? ["[data-more]"] : [])]) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES3.map((_, i) => `#c${i} [data-right]`) },
      { wrong: Array(GATE).fill("[data-next]").concat(["[data-wrong]"]), right: ["[data-right]", ...Array(TRACE.length - 1 - GATE).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SIT9.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
