/* Lesson: a typed FastAPI endpoint around a model call. Story: a garden-centre chain moves its plant-care
   question bot from a developer's laptop script to a web service the shop tablets call.
   Ideas: (1) write the request's shape down once and check every request against it before any model call:
   answer, reject with 422, or answer and ignore unknown fields (by hand, from scratch in plain Python, then with
   a Pydantic request model in FastAPI); (2) the response model is the output contract (it filters what leaves),
   and a failed model call becomes a clean 502 with a short JSON message instead of a bare 500.
   Recordings (main checkout, docs/ai-path/recordings/s6-fastapi-endpoint/): ask-basil, ask-cactus, ask-tomato
   (2026-11-13, openrouter, google/gemini-2.5-flash-lite).
   Runs (docs/ai-path/runs/s6-fastapi-endpoint/): tablet_requests.json (the five tablet requests),
   scratch.py → scratch.out.txt (check_ask on every request and its trace on the fern request; the plant-is-text
   check is left out to keep the listing at 10 lines),
   app.py → app.out.txt (FastAPI 0.162.6, Pydantic 2.14.3 through TestClient: the five requests, the response
   model with and without the return type, and a model call that really fails; in part 3 call_model is redefined as
   the failing network call, and the guarded route logs the reason with log.exception), extract_answers.py →
   recorded_answers.json (the recorded answers the run replays). Every count on screen is computed here from
   that data. Lesson-local CSS: request/response boxes, a wrapping code listing, the checklist. Plain browser script. */
(() => {
  const ID = "s6-fastapi-endpoint", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s6-fastapi-endpoint.ipynb";
  const REC_DATE = "2026-11-13";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const esc = s => LessonKit.esc(s);

  /* ---------- Recorded material (copied, not altered) ---------- */
  // From docs/ai-path/recordings/s6-fastapi-endpoint/ask-<name>.json: response.choices[0].message.content.
  // provider openrouter, model google/gemini-2.5-flash-lite, temperature 0, max_tokens 200.
  const REC = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE };
  const SYSTEM = "You answer plant-care questions from customers at a garden centre's shop tablet. Answer in at most three short sentences, in plain words. If the question is not about plants or gardening, say that you can only help with plants.";
  const ANSWERS = {
    basil: { src: "s6-fastapi-endpoint/ask-basil", text: "Your basil might be getting too much water. Try letting the soil dry out a bit between waterings. Ensure it's getting plenty of sunlight too." },
    cactus: { src: "s6-fastapi-endpoint/ask-cactus", text: "Reduce watering significantly in winter. Let the soil dry out completely between waterings, and only water sparingly when you do." },
    "tomato-extra": { src: "s6-fastapi-endpoint/ask-tomato", text: "This can happen if your tomato plant isn't getting enough sun, water, or nutrients. Extreme temperatures, both hot and cold, can also cause flowers to drop. Try to ensure consistent watering and good soil health." }
  };

  /* ---------- Code run output (docs/ai-path/runs/s6-fastapi-endpoint/) ---------- */
  // tablet_requests.json: the five requests the tablets sent.
  const REQS = [
    { name: "basil", body: { plant: "basil", question: "The lower leaves on my basil are turning yellow. What should I do?" } },
    { name: "fern-old-app", body: { plant: "fern", text: "Can I keep a fern in a bathroom with no window?" } },
    { name: "cactus", body: { question: "How often should I water a cactus in winter?" } },
    { name: "rose-long", body: { plant: "rose", question: "My rose bush was planted three years ago by the previous owner of the house, next to a wooden fence that gets sun in the morning and shade after lunch. This spring the leaves got black spots, then turned yellow and fell off, first at the bottom and then higher up. I sprayed it with something from the shop but I do not remember the name. What is wrong with it and what should I do now?" } },
    { name: "tomato-extra", body: { plant: "tomato", question: "Why do my tomato flowers fall off before fruit forms?", tablet_id: "shop-12-tablet-3" } }
  ];
  const MAX_Q = 300; // the contract's limit, the same number in scratch.py and app.py
  // app.out.txt part 1: status, whether the model was called, and the JSON each request got back.
  const RUN = {
    basil: { status: 200, called: true, json: { answer: ANSWERS.basil.text } },
    "fern-old-app": { status: 422, called: false, json: { detail: [{ type: "missing", loc: ["body", "question"], msg: "Field required", input: { plant: "fern", text: "Can I keep a fern in a bathroom with no window?" } }] } },
    cactus: { status: 200, called: true, json: { answer: ANSWERS.cactus.text } },
    "rose-long": { status: 422, called: false, json: { detail: [{ type: "string_too_long", loc: ["body", "question"], msg: "String should have at most 300 characters", input: REQS[3].body.question, ctx: { max_length: 300 } }] } },
    "tomato-extra": { status: 200, called: true, json: { answer: ANSWERS["tomato-extra"].text } }
  };
  // app.out.txt part 2: the basil request, with and without "-> Answer".
  const RUN_OUT = {
    typed: { answer: ANSWERS.basil.text },
    loose: { answer: ANSWERS.basil.text, system_prompt: SYSTEM }
  };
  // app.out.txt part 3: the model call fails for real (httpx connecting to a local port where nothing listens).
  const RUN_FAIL = {
    bare: { status: 500, contentType: "text/plain; charset=utf-8", text: "Internal Server Error" },
    log: { exception: "httpx.ConnectError", message: "All connection attempts failed" },
    guarded: { status: 502, contentType: "application/json", json: { detail: "The plant helper cannot reach the model. Try again in a minute." } }
  };
  // scratch.out.txt: the trace of check_ask on the fern request (line 0 = the def line; vars before the line runs).
  const CODE_S = [
    "def check_ask(body):",
    "    errors = []",
    "    question = body.get(\"question\")",
    "    if not isinstance(question, str):",
    "        errors.append([\"question\", \"missing or not text\"])",
    "    elif not 1 <= len(question) <= MAX_QUESTION:",
    "        errors.append([\"question\", \"must be 1 to 300 characters\"])",
    "    if errors:",
    "        return 422, errors",
    "    return 200, {\"plant\": body.get(\"plant\"), \"question\": question}"
  ];
  const E1 = [["question", "missing or not text"]];
  const TRACE = [
    { line: 1, event: "line", vars: {} },
    { line: 2, event: "line", vars: { errors: [] } },
    { line: 3, event: "line", vars: { errors: [], question: null } },
    { line: 4, event: "line", vars: { errors: [], question: null } },
    { line: 7, event: "line", vars: { errors: E1, question: null } },
    { line: 8, event: "line", vars: { errors: E1, question: null } },
    { line: 8, event: "return", vars: { errors: E1, question: null } }
  ];
  const TRACE_RESULT = [422, E1];
  // scratch.out.txt first section: check_ask's result for the tomato request.
  const SCRATCH_TOMATO = [200, { plant: "tomato", question: "Why do my tomato flowers fall off before fruit forms?" }];

  /* ---------- Derived from the data ---------- */
  const KNOWN = ["question", "plant"];
  const extras = b => Object.keys(b).filter(k => !KNOWN.includes(k));
  const ACTS = ["Answer as sent", "Reject with 422", "Answer, ignore a part"];
  const RIGHT = REQS.map(r => RUN[r.name].status === 422 ? 1 : extras(r.body).length ? 2 : 0);
  const N422 = REQS.filter(r => RUN[r.name].status === 422).length;
  const NCALLED = REQS.filter(r => RUN[r.name].called).length;
  const ROSE = REQS[3].body.question, FERN = REQS[1].body, TOMATO = REQS[4].body;
  const pyRepr = v => v === null ? "None" : typeof v === "string" ? `"${v}"` : Array.isArray(v) ? `[${v.map(pyRepr).join(", ")}]` : JSON.stringify(v);
  const json = o => JSON.stringify(o, null, 2);
  const trimInput = d => ({ ...d, input: typeof d.input === "string" ? d.input.slice(0, 40) + " …" : d.input });

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}box { margin: 14px 0 0; padding: 10px 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
      .${P}box b.h { display: block; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 4px; }
      .${P}box pre { margin: 0; font: 500 14px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--mono); color: var(--muted); }
      .${P}rules { border-collapse: collapse; margin-top: 12px; font-size: 15.5px; width: 100%; }
      .${P}rules td { border-bottom: 1px solid var(--line); padding: 6px 10px 6px 0; vertical-align: top; }
      .${P}rules td:first-child { font: 600 14.5px var(--mono); white-space: nowrap; }
      .${P}wrap div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 8ch); text-indent: -8ch; }
      .${P}ans { margin: 10px 0 0; padding: 8px 12px; border-left: 3px solid var(--line); color: var(--ink-2); font-size: 16px; }
      .${P}ans b { display: block; font: 700 12px var(--mono); color: var(--muted); }
      .${P}cost { margin: 10px 0 0; padding-left: 20px; font-size: 16.5px; }
      .${P}cost li { margin: 3px 0; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
      .${P}list { margin: 14px 0 0; padding-left: 0; list-style: none; }
      .${P}list li { border-top: 1px solid var(--line); }
      .${P}list button { display: flex; gap: 12px; align-items: flex-start; width: 100%; min-height: 48px; padding: 10px 0; border: 0; background: none; color: var(--ink); font: 400 16.5px/1.45 var(--font); text-align: left; cursor: pointer; }
      .${P}list button::before { content: ""; flex: none; width: 20px; height: 20px; margin-top: 2px; border: 2px solid var(--ink-2); border-radius: 4px; }
      .${P}list button[aria-pressed="true"]::before { content: "✓"; font: 700 15px/20px var(--font); text-align: center; color: var(--good); border-color: var(--good); }
    `;
    document.head.appendChild(s);
  }
  const box = (label, text) => `<div class="${P}box"><b class="h">${esc(label)}</b><pre>${esc(text)}</pre></div>`;
  const codeW = (lines, active) => LessonKit.code(lines, active).replace('class="lcode"', `class="lcode ${P}wrap"`);
  const recCap = `Recorded model output, ${REC_DATE}`;
  const runCap = "Output of a run on our machine (Python 3.12, FastAPI, Pydantic 2)";
  const cap = t => `<p class="${P}cap">${esc(t)}</p>`;
  const answerBox = name => `<div class="${P}ans"><b>${esc(name)}</b>${esc(ANSWERS[name].text)}</div>`;

  /* 1. The situation, then decide by hand what the service does with five real tablet requests. */
  function byHand({ el, done, kit }) {
    style();
    const ans = REQS.map(() => null);
    const say = (i, pick) => {
      const r = REQS[i], b = r.body, q = b.question, ex = extras(b);
      const ok = pick === RIGHT[i];
      if (r.name === "basil") return ok ? `Right. The question is there, ${q.length} characters, and the plant is text. Nothing else is in the body.`
        : pick === 1 ? `Both rules hold: a question of ${q.length} characters (the limit is ${MAX_Q}) and a plant that is text. Nothing to reject.` : "Nothing extra here. The body has only plant and question.";
      if (r.name === "fern-old-app") return ok ? "Right. There is no <code>question</code> field. This tablet still runs the old app, which calls it <code>text</code>. The contract says question is required, so the service rejects it and the model is never asked."
        : pick === 0 ? "Look for the <code>question</code> field: it is not there. The old app sends <code>text</code>. The service cannot guess that an unknown name means the question, so the request breaks the contract."
        : `Ignore <code>${esc(ex[0])}</code>, and what is left is a plant with no question. There is nothing to answer.`;
      if (r.name === "cactus") return ok ? "Right. The plant is optional, and the question says what the plant is anyway."
        : pick === 1 ? "Plant is optional in the contract. A question alone is a valid request." : "Nothing extra here. The body has only a question.";
      if (r.name === "rose-long") return ok ? `Right. The question is ${q.length} characters, over the ${MAX_Q} limit. The tablet can show the error and ask the customer to shorten it.`
        : pick === 0 ? `Count it: ${q.length} characters, and the limit is ${MAX_Q}. The contract says reject.`
        : `Cut at ${MAX_Q} characters, the request loses its end: “…${esc(q.slice(MAX_Q))}”. That is the actual question. Cutting changes what the customer asked, so reject and let the tablet ask for a shorter one.`;
      return ok ? `Right. <code>${esc(ex.join(", "))}</code> is not in the contract. The question and plant are fine, so the service answers and does not use the extra field.`
        : pick === 0 ? `<code>${esc(ex.join(", "))}</code> is not in the contract, so the service does not use it or pass it to the model. It answers from plant and question only.`
        : "The question and plant follow the rules. The contract says other fields are not used, not that they are forbidden. So the request is answered.";
    };
    const paint = () => {
      const all = REQS.every((_, i) => ans[i] === RIGHT[i]);
      el.innerHTML = `<h1>Plant questions from the shop tablets</h1>
        <p class="lead">A garden-centre chain has a plant-care question bot. Today it is a script on a developer's laptop: he pastes a question in and reads the model's answer out. Now every shop tablet should ask it directly, over the network. The tablet team and the developer agree on what a request may contain. This written agreement is the <b>contract</b>:</p>
        <table class="${P}rules"><tr><td>question</td><td>required, text, 1 to ${MAX_Q} characters</td></tr><tr><td>plant</td><td>optional, text</td></tr><tr><td>anything else</td><td>not used</td></tr></table>
        <p class="task">Here are ${WORDS[REQS.length].toLowerCase()} real requests from the tablets. For each, decide what the service should do. A 422 status code means “I understood your request, but its content breaks the rules”.</p>
        ${REQS.map((r, i) => `<div class="lcase" id="c${i}">${box(`Request ${i + 1}${typeof r.body.question === "string" && r.body.question.length > MAX_Q ? ` (question: ${r.body.question.length} characters)` : ""}`, json(r.body))}
          ${kit.options(ACTS, { picked: ans[i], correct: RIGHT[i] })}${ans[i] == null ? "" : kit.feedback(say(i, ans[i]), ans[i] === RIGHT[i])}</div>`).join("")}
        ${all ? `${kit.feedback(`Now check against the real service: we sent the same ${REQS.length} requests to the endpoint you build in this lesson. ${REQS.map((r, i) => `Request ${i + 1}: <b>${RUN[r.name].status}</b>`).join(", ")}. The ${plural(N422, "rejected request")} never reached the model, so only ${NCALLED} of ${REQS.length} model calls were paid for. The ${NCALLED} accepted questions, sent with the same prompt to a small hosted model, got these answers:`)}
          ${REQS.filter(r => RUN[r.name].called).map(r => answerBox(r.name)).join("")}${cap(recCap)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (REQS.every((_, j) => ans[j] === RIGHT[j])) done();
      }));
    };
    paint();
  }

  /* 2. Spot the idea: where should these rules live? */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "In the system prompt: tell the model to refuse a request that has no question or a question over 300 characters",
      "In the service, written down once as a typed shape for the request; every request is checked against it before any code that calls the model runs",
      "In the tablet app: the app should never send a bad request in the first place"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Where do the rules live?</h1>
        <p class="lead">The laptop script sent whatever it got straight to the model. The new service must apply the rules you just applied by hand, to every request, from every tablet.</p>
        <p class="task">Where should those rules be checked?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Write the shape down once: field names, types, which are required, limits. The service checks each request against it and answers 422 with the field and the reason, before any model call. In your five requests that saved ${plural(N422, "paid call")}. The same shape also tells the tablet team exactly what to send. This lesson builds that check twice: by hand in plain Python, then with FastAPI, a Python web framework that does it for you.`, true)
          : ans === 0 ? kit.feedback(`Then every bad request is still a paid model call, and the reply is free text. The tablet cannot tell a refusal from an answer, and nothing gives it a status code to act on. A rule that code can check exactly should be checked in code.`, false)
          : kit.feedback(`The tablet app should check too, but the server cannot rely on it. Request 2 came from a tablet still running an old app version. Any program that can reach the service can send anything, so the service checks what it receives.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. From scratch: the check in plain Python, stepped on the fern request (a real trace). */
  function scratchCode({ el, done, kit }) {
    style();
    let pred = null, k = 0;
    const popts = [
      "<code>get</code> gives None, and the check records an error",
      "Python raises a KeyError and the request crashes",
      "It reads <code>text</code> as the question"
    ];
    const SAY = [
      "The tablet's JSON has arrived as a Python dict, <code>body</code>. Next line: start an empty error list.",
      `Next line: read the question. The body has the keys ${Object.keys(FERN).map(x => `<code>${esc(x)}</code>`).join(" and ")}, no <code>question</code>.`,
      "<code>question</code> is None. <code>get</code> returns None for a missing key, the way reading a missing key in a JS object gives undefined. Next: is it a string?",
      "None is not a string, so this <code>if</code> is true. Next: write down which field failed and why.",
      "One error recorded. The <code>elif</code> length check was skipped. Next: are there any errors?",
      "There is one. Next: return 422 with the list. No line in this function calls the model.",
      `Returned <code>${esc(pyRepr(TRACE_RESULT[0]))}, ${esc(pyRepr(TRACE_RESULT[1]))}</code>. <code>text</code> was never read: the check only asks for the names it knows. Extra fields are dropped the same way. The last line builds a new dict with only plant and question. For the tomato request it returned ${esc(pyRepr(SCRATCH_TOMATO[0]))} and a dict with no tablet_id.`
    ];
    const paint = () => {
      const s = TRACE[k], v = s.vars;
      const show = n => n in v ? esc(pyRepr(v[n])) : "–";
      el.innerHTML = `<h1>The check, by hand in Python</h1>
        <p class="lead">Before any framework, here is the contract as a plain function. <code>MAX_QUESTION</code> is ${MAX_Q}. It returns a status code and either the errors or a clean copy of the request. (The check that plant is text works the same way; it is left out to keep the listing short.) Request 2, from the old app, goes in.</p>
        ${box("body", json(FERN))}
        ${pred !== 0 ? `<p class="task">The old app sends <code>text</code> instead of <code>question</code>. What happens at <code>body.get("question")</code>?</p>
          <div class="lpanel">${kit.options(popts, { picked: pred, correct: 0 })}
          ${pred == null ? "" : pred === 1 ? kit.feedback("That would happen with <code>body[\"question\"]</code>. <code>get</code> is the safe way to read a key that may be missing: it returns None instead of raising.", false)
            : kit.feedback("Nothing maps <code>text</code> to <code>question</code>. The function asks for the key \"question\" by name, and the body has no such key.", false)}</div>`
        : `<p class="task">Right: <code>get</code> gives None. Now step through the real run to the end.</p>
          ${codeW(CODE_S, s.line)}
          <div class="vars"><span>errors <b>${show("errors")}</b></span><span>question <b>${show("question")}</b></span><span>step <b>${k + 1} / ${TRACE.length}</b></span></div>
          ${kit.feedback(SAY[k])}
          <div class="lsteps"><button type="button" class="btn" data-prev ${k === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${k === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
      const pv = el.querySelector("[data-prev]"), nx = el.querySelector("[data-next]");
      if (pv) pv.onclick = () => { k--; paint(); };
      if (nx) nx.onclick = () => { k++; paint(); if (k === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 4. The same contract as a Pydantic request model in FastAPI: predict the 422 bodies. */
  const CODE_REQ = [
    "class Ask(BaseModel):",
    "    question: str = Field(min_length=1, max_length=300)",
    "    plant: str | None = None",
    "",
    "app = FastAPI()",
    "",
    "@app.post(\"/ask\")",
    "async def ask(body: Ask) -> Answer:",
    "    text = await call_model(body.plant, body.question)",
    "    …"
  ];
  function requestModel({ el, done, kit }) {
    style();
    const ans = [null, null];
    const rose = RUN["rose-long"].json.detail[0], fern = RUN["fern-old-app"].json.detail[0];
    const CASES = [
      { q: `Request 4, the rose question of ${ROSE.length} characters. What comes back?`,
        opts: [`422, type <code>${esc(rose.type)}</code> at <code>${esc(JSON.stringify(rose.loc))}</code>`, "200: Pydantic cuts the question to 300 characters and the model answers", "422, type <code>value_error</code> at <code>[\"body\"]</code>, with no field named"],
        right: 0,
        no: ["", "<code>max_length</code> is a rule, not a cut. Pydantic never shortens your data. If you wanted a cut, you would write it yourself, and you saw on screen 1 what it would lose.", "The error names the exact field. That is the point of declaring fields: the tablet learns which one to fix."] },
      { q: "Request 2, from the old app, with <code>text</code> instead of <code>question</code>. What comes back?",
        opts: ["422, type <code>extra_forbidden</code> at <code>[\"body\", \"text\"]</code>", `422, type <code>${esc(fern.type)}</code> at <code>${esc(JSON.stringify(fern.loc))}</code>`, "200: <code>text</code> is ignored and the plant name alone goes to the model"],
        right: 1,
        no: ["Pydantic does not complain about unknown fields by default: it ignores them. You get extra_forbidden only if you set <code>extra=\"forbid\"</code> in the model's config. Here the problem is the required field that is missing.", "", "The extra field is ignored, yes. But question has no default, so it is required, and it is missing. The request stops there."] }
    ];
    const paint = () => {
      const all = CASES.every((c, i) => ans[i] === c.right);
      el.innerHTML = `<h1>The same rules in FastAPI</h1>
        <p class="lead">You met Pydantic models for a model's JSON reply. A Pydantic model is a class that describes a JSON shape; it is not an AI model. Here one describes the <b>request</b>. Three things in it carry the contract. <code>Field(min_length=1, max_length=300)</code> sets the limits. <code>str | None = None</code> makes plant optional: a field with a default is not required. <code>body: Ask</code> in the function tells FastAPI to read the JSON body and check it against <code>Ask</code> before your function runs. <code>-> Answer</code> is the reply's shape; the next screen is about it. <code>call_model</code> is our function that sends the question to the AI model. The route is <code>async def</code> and awaits it, so the server can serve other tablets while one waits for the model.</p>
        ${codeW(CODE_REQ, -1)}
        <p class="task">We sent the tablets' requests to this app. Predict two of the answers. In a 422 reply, each error has a <code>type</code> (which rule failed) and a <code>loc</code> (where in the request, shown after “at”).</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${c.q}</p>${kit.options(c.opts, { picked: ans[i], correct: c.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === c.right ? (i === 0 ? `Right. The model was ${RUN["rose-long"].called ? "called" : "not called"}.` : `Right. Unknown fields are ignored by default, and the missing required field is reported. The model was ${RUN["fern-old-app"].called ? "called" : "not called"}.`) : c.no[ans[i]], ans[i] === c.right)}</div>`).join("")}
        ${all ? `${box(`Response to request 4: ${RUN["rose-long"].status}`, json({ detail: [trimInput(rose)] }))}${cap(`${runCap}. The input is trimmed at …`)}
          ${kit.feedback("Compare with your plain function: the same decisions, but you wrote no <code>if</code>. The error list has a fixed shape: <code>loc</code> says where, <code>type</code> says which rule, <code>msg</code> is for people. The tablet can show it next to the right field. Note that the response repeats the input back to the caller. That is fine for a plant question, but think twice before echoing personal data.")}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 5. The response model: the return type filters what leaves the service. */
  const CODE_RES = [
    "class Answer(BaseModel):",
    "    answer: str",
    "",
    "@app.post(\"/ask\")",
    "async def ask(body: Ask) -> Answer:",
    "    text = await call_model(body.plant, body.question)",
    "    return {\"answer\": text, \"system_prompt\": SYSTEM}"
  ];
  function responseModel({ el, done, kit }) {
    style();
    const ans = [null, null];
    const typedKeys = Object.keys(RUN_OUT.typed), looseKeys = Object.keys(RUN_OUT.loose);
    const keysTxt = ks => ks.map(x => `<code>${esc(x)}</code>`).join(" and ");
    const OPTS = [`Only ${keysTxt(typedKeys)}`, `${keysTxt(looseKeys)}`, "An error: the dict has a field that Answer does not have"];
    const rightOf = ks => ks.length === 1 ? 0 : 1;
    const CASES = [
      { q: "With <code>-> Answer</code>, as in the code. What does the tablet receive for the basil request?", right: rightOf(typedKeys),
        no: ["", "The return type is not just a hint here. FastAPI uses it to filter the data: only the fields declared in <code>Answer</code> are sent.", "Extra fields in the returned data are not an error. They are dropped, the same way unknown request fields were ignored."] },
      { q: "A teammate deletes <code>-> Answer</code> to “keep it simple”. Now what does the tablet receive?", right: rightOf(looseKeys),
        no: ["With no return type, FastAPI has no output shape to filter with. It sends the dict as it is.", "", "With no output shape there is nothing to check against. The dict goes out as it is, debugging field included."] }
    ];
    const paint = () => {
      const all = CASES.every((c, i) => ans[i] === c.right);
      el.innerHTML = `<h1>The answer has a contract too</h1>
        <p class="lead">The request has a shape. So does the response. A teammate added the system prompt to the returned dict while debugging, and forgot it there.</p>
        ${codeW(CODE_RES, 6)}
        <p class="task">Predict what leaves the service, with and without the return type.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${c.q}</p>${kit.options(OPTS, { picked: ans[i], correct: c.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === c.right ? (i === 0 ? "Right. FastAPI validates the returned data against the return type and filters out every field it does not declare." : "Right. The system prompt goes to every tablet: anyone who opens the network panel can read your instructions.") : c.no[ans[i]], ans[i] === c.right)}</div>`).join("")}
        ${all ? `${box("with -> Answer", json(RUN_OUT.typed))}${box("without", json({ ...RUN_OUT.loose, system_prompt: RUN_OUT.loose.system_prompt.slice(0, 48) + " …" }))}${cap(`${runCap}. The system prompt is trimmed at …`)}
          ${kit.feedback("So declare the response model on every route that wraps a model call. It is the promise to the tablets, it keeps internal fields such as prompts, token counts and provider names from leaking, and it stays the same when you change the provider behind it.")}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 6. Clean errors: the model call fails for real; what should the tablet get? */
  const CODE_ERR = [
    "async def ask(body: Ask) -> Answer:",
    "    try:",
    "        text = await call_model(body.plant, body.question)",
    "    except httpx.HTTPError:",
    "        log.exception(\"model call failed\")",
    "        raise HTTPException(",
    "            status_code=502,",
    "            detail=\"The plant helper cannot reach the model. Try again in a minute.\")",
    "    return {\"answer\": text}"
  ];
  function cleanErrors({ el, done, kit }) {
    style();
    let ans = null;
    const g = RUN_FAIL.guarded;
    const opts = [
      `${RUN_FAIL.bare.status}, with the plain text “${esc(RUN_FAIL.bare.text)}”`,
      "422, with a detail list, like a bad request",
      `${g.status}, with a short JSON message the tablet can show`,
      "200, with an answer that says “Sorry, try again later”"
    ];
    const correct = opts.findIndex(o => o.startsWith(String(g.status)));
    const paint = () => {
      el.innerHTML = `<h1>When the model call fails</h1>
        <p class="lead">The model sits at a provider, over the network, and sometimes it cannot be reached. We made the call fail for real: the route tried to reach the model at a local address where nothing listens. Without any handling, the tablet got <b>${RUN_FAIL.bare.status}</b> and the plain text “${esc(RUN_FAIL.bare.text)}”. The server's log had the reason: <code>${esc(RUN_FAIL.log.exception)}: ${esc(RUN_FAIL.log.message)}</code>.</p>
        <p class="task">What should the tablet get when the model cannot be reached?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. 502 (Bad Gateway) says: this service is fine and so is your request, but the server it depends on gave no usable answer. The HTTP standard defines 502 for an invalid reply from that server. In practice it is also used when that server cannot be reached. The tablet can show the message and offer to try again. If the call had timed out, 504 (Gateway Timeout) says that. Catch the failure at the model call and raise <code>HTTPException</code>: FastAPI sends its <code>detail</code> as JSON.`, true)
          : ans === 0 ? kit.feedback(`That is what happened without handling. 500 says “something unexpected broke here”, the body is not JSON, and the tablet cannot tell a provider outage from a bug in your code.`, false)
          : ans === 1 ? kit.feedback("422 means the request breaks the rules. The tablet would tell the customer to change a question that was fine.", false)
          : kit.feedback("200 tells the tablet, your logs and your monitoring that the call worked. Failures stop being counted, and the “Sorry” text is shown as if it were plant advice.", false)}
        ${ans === correct ? `${codeW(CODE_ERR, 5)}${box(`Response with the except: ${g.status} (${g.contentType})`, json(g.json))}${cap(runCap)}
          ${kit.feedback(`Whether to retry, and how long to wait before giving up, is a later lesson in this unit. Here the job is to fail cleanly: the right status, a stable JSON body, and the full reason in your log, not sent to the tablet. FastAPI does not log it for you: the <code>log.exception</code> line (<code>log</code> is a logger from Python's <code>logging</code> module) writes the error and its traceback, and in our run the traceback ended with <code>${esc(RUN_FAIL.log.exception)}: ${esc(RUN_FAIL.log.message)}</code>. One catch: httpx timeouts are also <code>httpx.HTTPError</code>, so this except answers 502 for a timeout too. To send 504, put an <code>except httpx.TimeoutException</code> above it.`)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. The big picture, with a task: which cost bites first. */
  const COSTS = ["Keeping the contract stable", "Guarding who may call it", "Running and watching one more service"];
  const SIT7 = [
    { q: "The chain renames question to customer_question in the request model. The 200 tablets update over the next two weeks.", a: 0,
      yes: "Right. Every tablet on the old name now gets 422, like the old app on screen 1. Change a contract by adding, or run both names for a while, never by renaming in place.",
      no: ["", "Nobody unwanted is calling. Real tablets are getting 422 because the shape changed under them.", "The service runs fine. It rejects the requests correctly, because the contract changed and the tablets did not."] },
    { q: "The endpoint is on the internet with no key check. Someone finds it and sends thousands of questions a night.", a: 1,
      yes: "Right. Every valid request is a paid model call. A typed request limits how big a call can be, not who makes it. That needs authentication, which this lesson does not cover.",
      no: ["The requests follow the contract perfectly. The problem is who sends them.", "", "The service is up and answering. That is the problem: it answers anyone, and each answer costs money."] },
    { q: "At 3 a.m. the service stops after it runs out of memory. Nobody notices until the first shop opens.", a: 2,
      yes: "Right. The laptop script failed in front of its one user. A service needs hosting, restarts, logs and an alert when it is down.",
      no: ["The contract did not change. The service itself stopped.", "Nobody attacked it. It ran out of memory, and nothing watched it."] }
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = SIT7.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to put a model behind an API</h1>
        <p class="lead"><b>What it is for:</b> giving many programs (tablets, a website, other services) one stable way to use a model call, with checked input, a fixed output and clear errors. <b>Reach for it</b> when the callers are other programs, on other machines, and someone waits for each answer. <b>Do not</b> for a one-off job in a notebook: a loop does it. Nor for big batches nobody waits on: a background job fits better. <b>What it costs:</b></p>
        <ul class="${P}cost"><li>one more service to host, restart and watch;</li><li>a contract every caller depends on;</li><li>deciding who may call it, since each call is paid.</li></ul>
        <p class="lead">The checks themselves cost almost nothing next to a model call.</p>
        <p class="task">For each situation, pick the cost that bites first.</p>
        ${SIT7.map((s, i) => `<div class="lcase" id="c${i}"><p>${esc(s.q)}</p>${kit.options(COSTS, { picked: ans[i], correct: s.a })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === s.a ? s.yes : s.no[ans[i]], ans[i] === s.a)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SIT7.every((s, j) => ans[j] === s.a)) done();
      }));
    };
    paint();
  }

  /* 8. Recognise it in new situations, with a "no" case. */
  const CASES = [
    ["A delivery company's driver app and its dispatch screen both need a model to turn a messy address note into street, number and floor.", true,
      "Yes. Two kinds of caller, over the network, each waiting for an answer. A typed request (the note, with a length limit) and a typed response (street, number, floor) give both apps one contract.",
      "Two different apps call the same model step and wait for the result. That is the case for one endpoint with a request model and a response model, instead of two copies of the prompt."],
    ["An analyst wants a one-paragraph summary of each of last quarter's 2,000 customer emails, once, for a slide deck.", false,
      "No. Nobody calls it over the network, and it runs once. A loop in a notebook does the job. An endpoint would add a service to host and a contract that no caller uses.",
      "There is no caller. One person runs one job once, and nobody waits on a screen. A loop in a notebook is enough. An endpoint adds hosting and a contract for nothing."],
    ["A library's catalogue kiosk lets visitors ask for book suggestions in their own words. The kiosk software is written by another company.", true,
      "Yes. Another company's program calls you over the network. A published request and response shape, with 422 for bad input and 502 when the model is down, is what they build against.",
      "The caller is someone else's program. It needs a written contract: what to send, what comes back, and what each error means. That is a typed endpoint."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A typed endpoint here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the garden centre.</p>
        <p class="task">For each one, decide if wrapping the model call in your own typed endpoint is the right move. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next: the notebook and its checklist (from our own run), then the next lesson. */
  const ok200 = REQS.filter(r => RUN[r.name].status === 200).map(r => REQS.indexOf(r) + 1);
  const CHECKLIST = () => [
    `Requests ${ok200.slice(0, -1).join(", ")} and ${ok200[ok200.length - 1]} get 200, and each response has one field, <code>answer</code>.`,
    `Request 2 gets 422 with type <code>${esc(RUN["fern-old-app"].json.detail[0].type)}</code> at <code>${esc(JSON.stringify(RUN["fern-old-app"].json.detail[0].loc))}</code>, and the model was not called (<code>model_called</code> is false).`,
    `Request 4 gets 422 with type <code>${esc(RUN["rose-long"].json.detail[0].type)}</code> and <code>ctx</code> <code>${esc(JSON.stringify(RUN["rose-long"].json.detail[0].ctx))}</code>.`,
    "Without <code>-> Answer</code>, the basil response also carries <code>system_prompt</code>.",
    `With the model unreachable, the route without the except returns ${RUN_FAIL.bare.status} and the text “${esc(RUN_FAIL.bare.text)}”; the guarded route returns ${RUN_FAIL.guarded.status} with a JSON <code>detail</code>.`
  ];
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can put a model behind an API</h1>
      <p class="lead">Write the request down as a model with limits, and let the framework answer 422 before any paid call. Declare the response model, so only the promised fields leave. Catch the model call's failure and answer 502 or 504 with a short JSON message, and log the full reason yourself with <code>log.exception</code>.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson</a>, run it and tick what you see.` : "The notebook for this lesson is on its way. When it is here, run it and tick what you see:"}</p>
      <ul class="${P}list">${CHECKLIST().map((t, i) => `<li><button type="button" aria-pressed="false" data-k="${i}"><span>${t}</span></button></li>`).join("")}</ul>
      ${nx ? `<p class="lead" style="margin-top:18px">Next: <b>${esc(nx.title)}</b>. This route makes the tablet wait for the whole answer. The next lesson keeps the route and sends the answer piece by piece as the model writes it.</p>` : ""}`;
    // ticking is optional and saves nothing
    el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"));
    done();
  }

  LessonKit.define(ID, {
    title: "A typed FastAPI endpoint around a model call",
    checked: "2026-11-13",
    sources: [
      "https://fastapi.tiangolo.com/tutorial/body/",
      "https://fastapi.tiangolo.com/tutorial/body-fields/",
      "https://fastapi.tiangolo.com/tutorial/response-model/",
      "https://fastapi.tiangolo.com/tutorial/handling-errors/",
      "https://fastapi.tiangolo.com/async/",
      "https://fastapi.tiangolo.com/tutorial/testing/",
      "https://pydantic.dev/docs/validation/latest/concepts/models/",
      "https://www.rfc-editor.org/rfc/rfc9110.html",
      "https://www.python-httpx.org/exceptions/",
      "https://docs.python.org/3/library/logging.html"
    ],
    interview: [{
      q: "Three other teams want to use your team's model-based summariser from their own services. You have a script that works. What do you build, and what goes into it?",
      good: [
        "An HTTP endpoint with a typed request model: required fields, types and a length limit, so bad or oversized input gets a 422 before any paid model call",
        "A typed response model, so callers get a stable shape and internal fields such as prompts or token counts never leak",
        "Clear errors: a provider failure becomes a 502 or 504 with a short JSON body, with the full reason in the server log",
        "async route with an async client for the model call, so one slow call does not block other requests",
        "Treat the schema as a contract: add fields rather than rename them, and decide who may call it, since every call costs money"
      ],
      weak: "“Wrap the script in a route that takes a JSON dict and returns the model's text.” It misses input checks before the paid call, the output contract and what callers see when the provider fails."
    }, {
      q: "Shop tablets show “Internal Server Error” whenever the model provider has a short outage. Support cannot tell outages from bugs. What do you change?",
      good: [
        "Catch the provider error where the model is called, not with one catch-all around everything",
        "Return 502 (or 504 for a timeout) with a stable JSON detail the tablet can show, instead of a bare 500",
        "Keep the exception and request details in the server log, not in the response",
        "Not 200 with an apology text, which hides failures from monitoring, and not 422, which blames the caller"
      ],
      weak: "“Wrap the whole route in try/except and return 200 with an error message.” The failure disappears from status codes and monitoring, and the tablet shows the apology as if it were an answer."
    }],
    screens: [byHand, spotIdea, scratchCode, requestModel, responseModel, cleanErrors, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c1 [data-wrong]"], right: REQS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(TRACE.length - 1).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SIT7.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
