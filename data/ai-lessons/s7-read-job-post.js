/* Lesson: read an AI engineer job post and find your gaps. Story: two openings land in the same week, a startup
   building shop search on hosted model APIs and a Korean car-parts maker that keeps all data inside its own
   network and runs open models on its own GPUs. Both postings are INVENTED COMPOSITES, written for this lesson
   and labelled so on screen; they quote no real company.
   Ideas: (1) tag each line as must-have, nice-to-have or filler, and read the team's constraint ("data never
   leaves our network", "we pay per token") first: it predicts the real must-haves better than the labels do;
   (2) map each must-have to a project or lesson, score the fit, and close first the must-have gap you can turn
   into proof in weeks, and the ones that recur across the posts you want.
   Data:
   - recording (main checkout) docs/ai-path/recordings/s7-read-job-post/tag-post-b.json: a small hosted model
     asked to tag posting B line by line (one call, temperature 0). Shown on screen 4, text not altered.
   - lesson titles copied from docs/ai-path/curriculum/*.json (path lessons the must-haves map to).
   No code runs: the lesson has no code output.
   Lesson-local style: a posting block and a profile list (.lx-s7-read-job-post-*), see ensureStyle(). */
(() => {
  const ID = "s7-read-job-post";
  const TAGS = ["Must-have", "Nice-to-have", "Filler"];
  const M = 0, N = 1, F = 2;

  /* ---------- The two invented postings ---------- */
  const POST_A = {
    name: "Posting A: AI engineer, shop search",
    about: "We are a 12-person startup building search for online shops: a shopper types a question and gets an answer written from the shop's product pages. Every answer comes from a hosted model API, which we pay for per token.",
    lines: [
      { t: "Required: shipped RAG or search features to real users", tag: M,
        why: "Search answers built from product pages are the product. Nobody on the team can do the job without this.",
        no: { [N]: "It is under “Required”, and the whole product is search answers built from pages. Without it there is no job to do.", [F]: "It can be checked: you either shipped retrieval to users or you did not. Filler is what nobody can test." } },
      { t: "Required: strong Python", tag: M,
        why: "Stated as required, and it is the language the daily work happens in.",
        no: { [N]: "It is listed as required and it is the tool of every working day. A team would not hire around it.", [F]: "It can be tested in one coding round. Filler is a phrase no one can check." } },
      { t: "You will measure answer quality and catch regressions before each release", tag: M,
        why: "A “you will” line is the daily work. If it is the work, it is a must-have, even without the word “required”.",
        no: { [N]: "This line describes what you will do every release, not an extra. A duty is a must-have even when the post does not say “required”.", [F]: "“Catch regressions before each release” is checkable: a golden set and a score you compare. It is work, not decoration." } },
      { t: "You will keep cost and response time per answer down", tag: M,
        why: "The intro says they pay per token for every answer. Cost per answer is their bill, so this is daily work.",
        no: { [N]: "Read the intro again: every answer is a paid API call. Keeping that bill and the wait down is part of the job, not a bonus.", [F]: "It sounds general, but it can be measured: cost and time per answer. The intro ties it to their per-token bill." } },
      { t: "Bonus: fine-tuning experience", tag: N,
        why: "“Bonus”, and nothing in the intro needs it: the answers come from a hosted model plus their pages.",
        no: { [M]: "The intro says answers come from a hosted model API over product pages. Nothing in the work needs a fine-tuned model, and the post calls it a bonus.", [F]: "It is checkable, so it is not filler. It is a real skill they would welcome but would hire without." } },
      { t: "Bonus: Kubernetes", tag: N,
        why: "A bonus. A 12-person team calling hosted APIs may run some infrastructure, but the job is search quality.",
        no: { [M]: "Marked as a bonus, and the work described is search and answer quality on hosted APIs. Helpful for deploying, not what the job is.", [F]: "Kubernetes is a concrete tool you can check. It is a nice-to-have, not empty words." } },
      { t: "Thrive in a fast-paced, ambiguous environment", tag: F,
        why: "Nobody can test this, and every candidate says yes. It tells you little about the skills.",
        no: { [M]: "No interview can check this, and no one answers “I do not thrive”. It cannot decide who gets hired.", [N]: "A nice-to-have is a skill someone could check. This is a phrase with nothing to check." } }
    ]
  };
  const POST_B = {
    name: "Posting B: AI engineer, on-premise assistant",
    about: "We make car parts in Korea. Design documents and factory logs never leave our own network, so we run open models on our own GPU servers. You will build an assistant that answers our engineers' questions from internal documents, in Korean.",
    lines: [
      { t: "Required: built RAG over internal documents (chunking, search, evaluation)", tag: M,
        why: "The assistant answers from internal documents: this is the job itself.",
        no: { [N]: "The intro says you will build an assistant that answers from internal documents. That is RAG; without it there is no job.", [F]: "Chunking, search and evaluation are concrete and testable. Not filler." } },
      { t: "Required: Docker and Linux servers", tag: M,
        why: "They run everything on their own servers, so someone has to package and run the service there.",
        no: { [N]: "Their models and data live on their own servers. Running a service there is part of the daily work, and the post says required.", [F]: "Docker and Linux are concrete skills you can be asked to show." } },
      { t: "Required: business-level Korean", tag: M,
        why: "The users, the documents and the answers are in Korean. You cannot judge an answer you cannot read.",
        no: { [N]: "The documents and the engineers' questions are in Korean, and you must judge whether answers are right. That needs the language.", [F]: "It is checkable in one conversation, and the intro says the assistant answers in Korean." } },
      { t: "Nice to have: serving open models on your own GPUs (vLLM or similar)", tag: M,
        why: "Labelled “nice to have”, but the intro says no data leaves and they run open models on their own GPUs. No hosted API is allowed, so someone must serve the models. Treat it as a must-have when you prepare.",
        no: { [N]: "That is what the label says. Now read the intro: data never leaves their network, so they cannot call a hosted API; the models run on their own GPUs. Someone on the team has to serve them. The constraint makes it a must-have, whatever the label says.", [F]: "It is a concrete, testable skill. The real question is whether the label “nice to have” is honest. Read the intro." } },
      { t: "Nice to have: computer vision for defect detection", tag: N,
        why: "Useful in a factory, but the job described is a document assistant.",
        no: { [M]: "The job described is a text assistant over documents. Spotting defects in images is a different project they might start one day.", [F]: "It is a real, checkable skill. Just not one this job needs." } },
      { t: "Nice to have: MLflow or similar experiment tracking", tag: N,
        why: "Helps keep runs in order, but the assistant can be built without it.",
        no: { [M]: "Tracking runs is good practice, but nothing in the intro depends on one tool for it. They would hire someone without it.", [F]: "MLflow is a concrete tool. Concrete and optional means nice-to-have." } },
      { t: "Self-motivated team player with a can-do attitude", tag: F,
        why: "Every applicant claims it and no one can test it from a CV.",
        no: { [M]: "Nobody screens a CV on “can-do attitude”. It cannot separate candidates.", [N]: "There is no skill here to check, so it cannot be a nice-to-have either." } }
    ]
  };
  const mustOf = P => P.lines.filter(l => l.tag === M);

  /* ---------- The recording ---------- */
  // From docs/ai-path/recordings/s7-read-job-post/tag-post-b.json (not altered; split into its 7 lines)
  const REC_TAG_B = {
    src: "s7-read-job-post/tag-post-b",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14",
    text: "1. must-have: This is the core task of the role.\n2. must-have: Essential for deploying and managing the system.\n3. must-have: The assistant needs to understand and respond in Korean.\n4. nice-to-have: Directly relevant to the described infrastructure.\n5. nice-to-have: An additional potential application of AI.\n6. nice-to-have: Useful for managing ML projects.\n7. filler: These are soft skills, not directly testable technical requirements."
  };
  const REC_LINES = REC_TAG_B.text.split("\n").map(s => { const m = s.match(/^(\d+)\. ([a-z-]+): (.*)$/); return { n: +m[1], tag: m[2], reason: m[3] }; });
  const CAPTION = `Recorded model output, ${REC_TAG_B.recordedAt}`;
  const TAG_WORD = { "must-have": M, "nice-to-have": N, "filler": F };

  /* ---------- Path lessons (titles from docs/ai-path/curriculum/*.json) ---------- */
  const L = {
    ragProject: "Finish the RAG project with its evaluation harness",
    tuneOrRag: "Fine-tuning, RAG or a better prompt: choosing",
    docker: "Packaging an AI service with Docker",
    k8s: "Kubernetes in brief for model services",
    ollama: "Running a model locally with Ollama",
    koTokens: "Korean and Uzbek in a real tokenizer",
    speech: "Speech to text and word error rate",
    vllm: "Serving many users with vLLM, even offline",
    cloudApis: "Hosted model APIs on a cloud platform",
    none: "No lesson in this path covers it"
  };

  /* ---------- The sample candidate ---------- */
  const SHOWN = 0, LESSON = 1, GAP = 2;
  const LEVELS = ["Shown in a project", "Lesson only", "Gap"];
  const WEIGHT = [1, 0.5, 0];
  const PROFILE = [
    ["Shown in a project", "a RAG docs assistant with a golden set, a baseline and a results table; a booking agent with traces; a small fine-tuned model behind a Python FastAPI endpoint, packaged in Docker and deployed on a Linux server at a public URL"],
    ["Lesson only", "measuring latency and token cost; serving open models with vLLM; GPU memory; Kubernetes"],
    ["Other", "five years of frontend work; has used LangChain at work; basic Korean"]
  ];
  // the level of each must-have for this candidate, with the reason
  const FIT = [
    { post: "A", line: 0, level: SHOWN, why: "The RAG project was deployed at a public URL. Be honest in the interview: a public demo is not the same as paying users." },
    { post: "A", line: 1, level: SHOWN, why: "All three projects are Python." },
    { post: "A", line: 2, level: SHOWN, why: "The RAG project has a golden set, a baseline and a results table: that is measuring quality before a release." },
    { post: "A", line: 3, level: LESSON, why: "Measuring latency and token cost is under “Lesson only”. No project shows it yet." },
    { post: "B", line: 0, level: SHOWN, why: "The RAG project covers chunking, search and evaluation." },
    { post: "B", line: 1, level: SHOWN, why: "The fine-tuned model was packaged in Docker and deployed on a Linux server." },
    { post: "B", line: 2, level: GAP, why: "Basic Korean is far from business-level. No lesson closes it." },
    { post: "B", line: 3, level: LESSON, why: "vLLM is under “Lesson only”: read, never run on real GPUs." }
  ];
  const fitText = f => (f.post === "A" ? POST_A : POST_B).lines[f.line].t.replace(/^(Required|Nice to have): /, "");
  const score = p => FIT.filter(f => f.post === p).reduce((s, f) => s + WEIGHT[f.level], 0);
  const countOf = p => FIT.filter(f => f.post === p).length;
  const fmt = x => (Number.isInteger(x) ? String(x) : x.toFixed(1));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-post { margin: 16px 0 0; padding: 12px 14px; border: 1px solid var(--line); background: var(--surface); }
      .lx-${ID}-label { font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 0 0 6px; }
      .lx-${ID}-name { font-weight: 700; margin: 0 0 6px; }
      .lx-${ID}-about { margin: 0; font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-rec { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-rec div { padding: 8px 0; border-bottom: 1px solid var(--line); font: 500 14px/1.5 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-prof { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-prof li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-line { font-weight: 600; }
      .lx-${ID}-opt { text-align: left; }
    `;
    document.head.appendChild(s);
  }
  const postBox = (kit, P, showLines) => `<div class="lx-${ID}-post">
      <p class="lx-${ID}-label">Invented composite posting, written for this lesson</p>
      <p class="lx-${ID}-name">${kit.esc(P.name)}</p>
      <p class="lx-${ID}-about">${kit.esc(P.about)}</p>
      ${showLines ? `<ol class="lx-${ID}-about" style="margin:8px 0 0;padding-left:22px">${P.lines.map(l => `<li>${kit.esc(l.t)}</li>`).join("")}</ol>` : ""}
    </div>`;
  const profileBox = kit => `<ul class="lx-${ID}-prof">${PROFILE.map(([k, v]) => `<li><b>${kit.esc(k)}:</b> ${kit.esc(v)}</li>`).join("")}</ul>`;
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* Tagging screens (1 and 2): every line gets a tag; done when all are right. */
  function tagger(P, title, lead, task) {
    return function ({ el, done, kit }) {
      ensureStyle();
      const ans = P.lines.map(() => null);
      const paint = () => {
        el.innerHTML = `<h1>${title}</h1>
          ${lead}
          ${postBox(kit, P, false)}
          <p class="task">${task}</p>
          ${P.lines.map((l, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(l.t)}</p>${kit.options(TAGS, { picked: ans[i], correct: l.tag })}${ans[i] == null ? "" : kit.feedback(ans[i] === l.tag ? l.why : l.no[ans[i]], ans[i] === l.tag)}</div>`).join("")}`;
        el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
          ans[i] = +b.dataset.i; paint();
          if (P.lines.every((l, j) => ans[j] === l.tag)) done();
        }));
      };
      paint();
    };
  }
  const RULES = `<p class="lead">Use three tags. <b>Must-have</b>: the job cannot be done without it. <b>Nice-to-have</b>: it helps, but the team would hire someone without it. <b>Filler</b>: it cannot be checked or tested, so it decides nothing.</p>`;

  const tagA = tagger(POST_A, "Two openings, one week",
    `<p class="lead">Two AI engineer posts land in the same week. One is a startup building a search product on hosted models. The other is a manufacturer that keeps all its data inside its own network. Reading a post well tells you where to apply and what to study next. Each post is a list of lines, and they are not all equal. Some decide who gets hired; some are decoration. Start with the startup.</p>${RULES}`,
    "Tag every line of posting A. Read what the company says about itself first.");
  const tagB = tagger(POST_B, "The second posting",
    `<p class="lead">Now the manufacturer. Same three tags. One line here is a trap. Before you trust a label such as “Required” or “Nice to have”, read what the company says about itself.</p>`,
    "Tag every line of posting B.");

  /* 3. Spot the idea: the constraint decides the must-haves. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const longest = POST_B.lines.reduce((b, l, i, a) => (l.t.length > a[b].t.length ? i : b), 0);
    const opts = [
      "Because vLLM is a popular tool, and popular tools are always must-haves",
      "Because the intro says data never leaves their network, so they cannot use a hosted API and must serve open models themselves",
      "Because Korean companies prefer open models",
      "Because it is the longest line in the posting"
    ];
    const fb = [
      ["Popularity does not make a line a must-have. Posting A never mentions serving models at all, and it does not need to: its answers come from a hosted API. What changed between the posts is the situation, not the tool's fame.", false],
      ["Right. Read the <b>constraint</b> first: the one sentence that says what the team cannot or must do (“data never leaves our network”, “we pay per token for every answer”). It predicts the real must-haves better than the labels. A label can be careless; the constraint is the team telling you how it works. That is why the same skill can be absent in one post and essential in the next.", true],
      ["That is a guess about a whole country, and it is not what the post says. This company runs open models because its own data rule forbids sending documents out. A startup in Korea using hosted APIs would read like posting A.", false],
      [`Length says nothing, and it is not even the longest: line ${longest + 1} (“${kit.esc(POST_B.lines[longest].t)}”) is longer.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What made it a must-have?</h1>
        <p class="lead">Posting A does not mention serving models. Posting B lists “serving open models on your own GPUs (vLLM or similar)” under <i>nice to have</i>, and you still tagged it a must-have. vLLM is a library for running a model and serving it as an API on hardware you control.</p>
        ${postBox(kit, POST_B, false)}
        <p class="task">Why is serving models a must-have for posting B, whatever its label says?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. When not to hand the reading to a model: find the line it got wrong. */
  function modelTagging({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const wrongLine = REC_LINES.findIndex(r => TAG_WORD[r.tag] !== POST_B.lines[r.n - 1].tag);
    const fbFor = i => {
      const r = REC_LINES[i];
      if (i === wrongLine) return [`Right: line ${r.n}. The model tagged it “${kit.esc(r.tag)}”, and its own reason says “${kit.esc(r.reason)}” It saw that the line matters, then still followed the label. It read the words of the line, not the situation in the intro. In this run, the one line where the label and the constraint disagree is the one it got wrong. A model is fine for a first pass over a long post; the constraint check is yours to do.`, true];
      return [`Line ${r.n}: the model said “${kit.esc(r.tag)}”, and that matches your tag. Its reason (“${kit.esc(r.reason)}”) is fair. Look for a line where the label in the post and the intro disagree.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>Can a model read it for you?</h1>
        <p class="lead">A small hosted model was given posting B, the same three tag definitions, and asked to tag each line with one short reason. It answered:</p>
        <div class="lx-${ID}-rec">${REC_LINES.map(r => `<div>${kit.esc(`${r.n}. ${r.tag}: ${r.reason}`)}</div>`).join("")}</div>
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="task">Which line did the model tag wrongly? Pick it.</p>
        <div class="lpanel">${kit.options(REC_LINES.map(r => `<span class="lx-${ID}-opt">Line ${r.n}: ${kit.esc(POST_B.lines[r.n - 1].t)}</span>`), { picked: ans, correct: wrongLine })}
        ${ans == null ? "" : kit.feedback(...fbFor(ans))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === wrongLine) done(); });
    };
    paint();
  }

  /* 5. Use it: predict the must-have from the constraint alone. */
  const PREDICT = [
    { about: "An insurance company's internal assistant. Auditors review answers, and every answer must show which policy document it came from.",
      opts: ["Answers with citations that point to the source, and checking that each answer is backed by it", "Fine-tuning a model on the company's writing style", "Running several agents that hand work to each other"], right: 0,
      fb: [null,
        "Style is not the problem the intro names. Auditors check sources. A fine-tuned model still has to show where each answer came from, and fine-tuning alone does not do that.",
        "Nothing in the intro needs several agents. The hard requirement is a source for every answer, which a single RAG pipeline with citations meets."],
      ok: "Right. “Every answer must show its source” means citations and a faithfulness check (is the answer backed by the cited text?) are must-haves." },
    { about: "A note-taking app for field workers. The model must run on the phone itself, because there is often no signal where they work.",
      opts: ["Calling the biggest hosted model through an API", "Small open models made smaller with quantization (fewer bits per weight)", "A large vector index on a server"], right: 1,
      fb: ["No signal means no API call. The constraint rules out every hosted model, however good.", null,
        "A server is out of reach for the same reason as an API: no signal. Whatever runs has to fit on the phone."],
      ok: "Right. No network means the model runs on the device, so making a small open model fit (quantization, memory limits) is the must-have." },
    { about: "A support team answers a very large number of tickets a day with a hosted model, and the model bill is now one of the company's biggest costs.",
      opts: ["Training a new model from scratch", "Computer vision", "Measuring token cost, caching repeated answers, and routing easy tickets to a cheaper model"], right: 2,
      fb: ["Training from scratch costs far more than the bill they are worried about, and nothing says the hosted model's answers are bad.",
        "Nothing in the intro involves images. The constraint is cost.", null],
      ok: "Right. “The bill is the problem” makes cost measurement, caching and routing the must-haves, whatever else the list says." }
  ];
  function predictMust({ el, done, kit }) {
    ensureStyle();
    let k = 0, ans = null;
    const paint = () => {
      const fin = k >= PREDICT.length, q = PREDICT[Math.min(k, PREDICT.length - 1)];
      el.innerHTML = `<h1>Predict the must-have</h1>
        <p class="lead">Three more invented posts. You only see the constraint, not the list. If the idea holds, you can predict the main must-have before you read a single requirement.</p>
        <p class="lead"><b>Post ${Math.min(k + 1, PREDICT.length)} of ${PREDICT.length}.</b> ${kit.esc(q.about)}</p>
        ${fin ? "" : `<p class="task">Which skill will its list have to treat as a must-have?</p>`}
        <div class="lpanel">${fin ? kit.feedback(`${q.ok} The constraint gave you the must-have in all ${PREDICT.length} posts, before any list.`, true)
          : `${kit.options(q.opts, { picked: ans, correct: q.right })}${ans != null && ans !== q.right ? kit.feedback(q.fb[ans], false) : ""}${k > 0 && ans == null ? kit.feedback(PREDICT[k - 1].ok, true) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== PREDICT[k].right) { ans = v; paint(); return; }
        ans = null; k++; paint();
        if (k >= PREDICT.length) done();
      });
    };
    paint();
  }

  /* 6. Map each must-have of posting B to a project or lesson. */
  const MAP = [
    { line: 0, opts: [L.tuneOrRag, L.ragProject, L.speech], right: 1,
      fb: ["That lesson helps you choose between fine-tuning, RAG and prompting. It does not build or evaluate a RAG system. The post asks for one you have built.", null,
        "Speech to text is about audio. The line asks for RAG over documents."] },
    { line: 1, opts: [L.k8s, L.ollama, L.docker], right: 2,
      fb: ["Kubernetes runs many containers across machines. The line asks for Docker and Linux servers, the step before that.",
        "Ollama runs a model on one machine. It does not teach packaging a service and running it on a server.", null] },
    { line: 2, opts: [L.koTokens, L.none, L.speech], right: 1,
      fb: ["That lesson is about how a tokenizer splits Korean text into tokens. It does not teach you to read or speak Korean.", null,
        "Measuring speech recognition errors is not speaking the language. The post needs you to judge answers written in Korean."] },
    { line: 3, opts: [L.cloudApis, L.ollama, L.vllm], right: 2,
      fb: ["Hosted APIs are exactly what this company cannot use: data never leaves its network.",
        "Ollama runs a model on one machine, and by default it works on one request per model at a time. This team's assistant serves many engineers at once on their own GPUs; serving many users at once is what vLLM is built for, and what the vLLM lesson covers.", null] }
  ];
  function mapLessons({ el, done, kit }) {
    ensureStyle();
    const ans = MAP.map(() => null);
    const MUST_B = POST_B.lines;
    const paint = () => {
      el.innerHTML = `<h1>Map each must-have to your work</h1>
        <p class="lead">A must-have list helps only when you know what in your own work covers each item. For posting B, find the project or lesson in this path that covers it. Sometimes the honest answer is “nothing”.</p>
        <p class="task">For each of posting B's ${MAP.length} must-haves, pick what covers it.</p>
        ${MAP.map((m, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(MUST_B[m.line].t)}</p>${kit.options(m.opts.map(o => kit.esc(o)), { picked: ans[i], correct: m.right })}${ans[i] == null ? "" : kit.feedback(ans[i] === m.right ? (m.right === 1 && m.opts[1] === L.none ? "Right. No lesson teaches a language. Mark it as a gap outside the path: one you close over months, not weeks." : `Right: “${kit.esc(m.opts[m.right])}”.`) : m.fb[ans[i]], ans[i] === m.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (MAP.every((m, j) => ans[j] === m.right)) done();
      }));
    };
    paint();
  }

  /* 7. Score the fit for a sample candidate. */
  function scoreFit({ el, done, kit }) {
    ensureStyle();
    const ans = FIT.map(() => null);
    const paint = () => {
      const all = FIT.every((f, j) => ans[j] === f.level);
      el.innerHTML = `<h1>Score your fit</h1>
        <p class="lead">Here is a sample candidate who finished this path. A lesson you read counts for less than a project that shows it: an interviewer can open the project.</p>
        ${profileBox(kit)}
        <p class="task">For each must-have of both posts, pick this candidate's level: shown in a project, lesson only, or gap (neither).</p>
        ${FIT.map((f, i) => `<div class="lcase" id="c${i}"><p>Posting ${f.post}: ${kit.esc(fitText(f))}</p>${kit.options(LEVELS, { picked: ans[i], correct: f.level })}${ans[i] == null ? "" : kit.feedback(ans[i] === f.level ? f.why : `Check the profile. ${f.why}`, ans[i] === f.level)}</div>`).join("")}
        ${all ? `${kit.meter(["A", "B"].map(p => ({ label: `posting ${p}`, value: score(p), max: countOf(p), good: score(p) === Math.max(score("A"), score("B")) })))}
          ${kit.feedback(`Counting a project as ${WEIGHT[SHOWN]}, a lesson as ${fmt(WEIGHT[LESSON])} and a gap as ${WEIGHT[GAP]}: posting A scores ${fmt(score("A"))} of ${countOf("A")}, posting B ${fmt(score("B"))} of ${countOf("B")}. The number is rough on purpose. What matters is the list behind it: which must-haves are gaps, and which are only lessons that a project could turn into proof.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (FIT.every((f, j) => ans[j] === f.level)) done();
      }));
    };
    paint();
  }

  /* 8. Which gap first? */
  function gapFirst({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 0;
    const opts = [
      "Turn vLLM from a lesson into proof: serve an open model for the RAG project with vLLM on a rented GPU and write up what it took",
      "Business-level Korean",
      "Kubernetes, because it was in posting A",
      "Show you are a self-motivated team player"
    ];
    const fb = [
      ["Right. It is a must-have for posting B, it is only a lesson today, and a few weeks of work turns it into something an interviewer can open. Close first the must-have gap you can prove soon. Keep the long gaps going on the side, and be honest about them.", true],
      ["It is a real must-have and the biggest gap. But four weeks will not take basic Korean to business level. Keep studying it, say your real level in the interview, and spend these four weeks on a gap they can close.", false],
      ["Kubernetes is a nice-to-have, and in the other posting. Closing it changes neither post's must-have list.", false],
      ["That line is filler. Nothing you study changes how it is read, and no interviewer checks it from a CV.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which gap first?</h1>
        <p class="lead">The candidate wants posting B and has four weeks before applying. The must-haves that are not shown in a project: business-level Korean (gap) and serving open models (lesson only).</p>
        <p class="task">What should the four weeks go to?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "You read too many posts; one or two would have been enough",
      "You closed gaps one post at a time. Count which must-haves come up in many of the posts you want, and close those first",
      "You skipped the nice-to-haves; those make you stand out"
    ];
    const fb = [
      ["Reading many posts is how you learn what the market asks for. The mistake is what you did with them.", false],
      ["Right. One post's odd requirement is noise; a must-have that shows up in most posts you want is a signal. Tally across posts, then close the recurring ones.", true],
      ["Nice-to-haves come last. Studying a different one each week spreads the time thin and still leaves the recurring must-haves open.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to read a post this way</h1>
        <p class="lead"><b>For:</b> deciding where to apply and what to study next.</p>
        <p class="lead"><b>Reach for it</b> with every post you take seriously, before you prepare.</p>
        <p class="lead"><b>Not</b> as a pass-or-fail test. A post is the team's wish list, so do not drop a post because of one gap or a missing nice-to-have. A post that is only buzzwords, with no duties or constraint, gives you little to tag; ask the recruiter what the team builds. A research role that asks for published papers is a different track, not a list of gaps to close.</p>
        <p class="lead"><b>Costs:</b> your time per post, the risk of talking yourself out of a job you could get, and studying rare items no one else asks for.</p>
        <p class="task">A month later: you tagged thirty posts and studied a different gap after each one. You feel busy but not closer. What went wrong?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it: should this line send you studying before you apply? */
  const CASES = [
    ["A legal-documents startup: “Required: every answer cites the clause it came from.” The candidate's RAG project never showed citations.", true,
      "Yes. It is a must-have, it is not shown anywhere, and it is close to work already done: add citations to the RAG project and measure whether answers are backed by them.",
      "It is under “Required”, the work is built around it, and the candidate has never shown it. A small addition to the existing RAG project closes it within weeks."],
    ["“Required: 3+ years building ML systems.” The candidate has five years of frontend work and the three portfolio projects, but no paid ML job.", false,
      "No. Years cannot be studied: no project gives you three years before you apply. It is a line used to filter CVs, and what you can bring against it is projects that show the must-have skills. Apply if the skills match, point to the projects, and do not spend weeks on a gap that study cannot close.",
      "Study cannot produce years. What it can produce, projects showing the must-have skills, the candidate already has. The useful move is to apply and make the projects easy to see, not to wait."],
    ["“Experience with any one of LangChain, LlamaIndex or Haystack.” The candidate has used LangChain at work.", false,
      "No. “Any one of” means one is enough, and the candidate has one. Learning the other two would spend weeks on a line that is already met.",
      "Read the words “any one of”: the line is met with a single tool, and LangChain is in the profile. Learning all three is studying a line that is already closed."],
    ["An on-premise team: “Required: run models within a fixed GPU budget; quantization experience.” The candidate only read the quantization lesson.", true,
      "Yes. A must-have, tied to the constraint (their own GPUs, a fixed budget), and lesson-only so far. A small project, quantizing a model and measuring memory and quality before and after, turns it into proof.",
      "It is required and follows straight from their constraint. Reading a lesson is not something an interviewer can open; a small quantization run with before-and-after numbers is."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Study first, or apply?</h1>
        <p class="lead">Four lines from other posts, each with the same sample candidate.</p>
        <p class="task">Should each line send the candidate studying before applying? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes, study first", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can read a post for what it needs</h1>
      <p class="lead">You tagged two posts line by line. You found that the team's constraint predicts the must-haves better than the labels do, and you caught a model that trusted a label it should have doubted. Then you mapped each must-have to a project or lesson, scored a fit, and picked the gap worth closing first.</p>
      <p class="lead">Try it on a real post you want: tag it, write its constraint in one sentence, and list its must-have gaps.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Once a post gets you an interview, the first round asks about the must-haves you just listed; next you practise answering them with a clear structure.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Read an AI engineer job post and find your gaps",
    checked: "2026-11-14",
    sources: [
      "https://docs.vllm.ai/en/latest/",
      "https://docs.vllm.ai/en/latest/getting_started/quickstart.html",
      "https://openrouter.ai/docs/api/reference/overview",
      "https://docs.ollama.com/faq",
      "https://kubernetes.io/docs/concepts/overview/"
    ],
    interview: [
      {
        q: "The post lists Kubernetes and you have never used it in production. The interviewer asks about it. What do you say?",
        good: [
          "Say plainly that you have not run it in production",
          "Give the nearest real experience: a service packaged in Docker and deployed on a Linux server",
          "Say what the team needs it for, if you know, and how you would learn the part that matters",
          "Steer back to the must-haves you have shown in projects"
        ],
        weak: "Bluff with buzzwords, or just say “no” and stop. The first breaks on the first follow-up; the second wastes the chance to show the nearest skill."
      },
      {
        q: "You are interviewing with an on-premise team like posting B. The interviewer asks why you want this role and where you are weakest for it. How do you answer?",
        good: [
          "Name the team's constraint in one sentence and why your work fits it",
          "Point to one project that shows a must-have",
          "Name one real must-have gap, not a fake weakness",
          "Say what you are doing to close it and how far along you are"
        ],
        weak: "A general “I love AI” answer and a weakness like “I work too hard”. It shows you did not read what the team needs."
      }
    ],
    screens: [tagA, tagB, spotIdea, modelTagging, predictMust, mapLessons, scoreFit, gapFirst, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c3 [data-wrong]"], right: POST_A.lines.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c3 [data-wrong]"], right: POST_B.lines.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: PREDICT.map(() => "[data-right]") },
      { wrong: ["#c2 [data-wrong]"], right: MAP.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c6 [data-wrong]"], right: FIT.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
