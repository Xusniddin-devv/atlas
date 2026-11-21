/* Lesson: incident response for an LLM feature. Story: an online electronics shop's chat assistant starts
   promising refunds the policy does not allow, right after a prompt change; later the same day the model
   provider goes down. Ideas: (1) stop the harm first (roll back, fall back, or switch off), then find the
   cause; (2) find the cause by comparing traces before and after, and write it as a blameless review that
   fixes systems, not people.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s6-llm-incident/: v13-*, v14-*, v14fixed-* (the
     primary model on prompt v13, on prompt v14, and on v14's wording with the policy filled in) and
     fallback-v13-* (a second model, the fallback, on prompt v13). Requests built by
     docs/ai-path/runs/s6-llm-incident/make_requests.py (its output shows the rendered prompts).
   - docs/ai-path/runs/s6-llm-incident/incident_replay.py + .out.txt: the incident day replayed on this Mac.
     The answers are the recordings; the clock, the traffic, the deploy and rollback times and the provider
     outage are simulated (seed 7).
   - docs/ai-path/runs/s6-llm-incident/strict_render.py + .out.txt: the shop's renderer against a strict one.
   Lesson-local style: a timeline and a trace block (.lx-s6-llm-incident-*), see ensureStyle(). */
(() => {
  const ID = "s6-llm-incident";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const mins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const between = (a, b) => mins(b) - mins(a);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s6-llm-incident/make_requests.py (REFUND_POLICY, TEMPLATE_V13, TEMPLATE_V14, MESSAGES)
  const POLICY = [
    "Unopened items: full refund within 30 days of delivery.",
    "Opened items that work: exchange or store credit within 30 days; no cash refund.",
    "Faulty items: repair, replacement or full refund within 1 year.",
    "After 30 days, a working item cannot be returned."
  ];
  const INTRO = "You are the chat assistant of an online electronics shop. Answer questions about orders, returns and products in two to four sentences.";
  const RULE_V13 = "Only promise what the policy allows. If a case is unclear, offer to pass it to a human agent.";
  const RULE_V14 = "Be warm and customer-first: make every customer feel looked after, and solve their problem in this chat instead of sending them to another team.";
  const SLOT_V13 = "{refund_policy}", SLOT_V14 = "{returns_policy}", CONFIG_KEY = "refund_policy";
  const MSG = {
    laptop: "I opened the laptop I got 10 days ago and changed my mind. It works. I want a full refund to my card.",
    headphones: "Hi, I bought wireless headphones 45 days ago. They work fine but I don't like the sound. Can I get my money back?"
  };

  // From docs/ai-path/recordings/s6-llm-incident/<name>.json (text not altered; tokens = usage.prompt_tokens)
  const REC = {
    v13Laptop: { src: "s6-llm-incident/v13-laptop", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17", promptTokens: 151,
      text: "Since you've opened the laptop and it's working, we can offer you an exchange for another item or store credit. Unfortunately, we cannot provide a cash refund for opened, working items. Please let me know if you'd like to explore exchange or store credit options." },
    v14Laptop: { src: "s6-llm-incident/v14-laptop", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17", promptTokens: 89,
      text: "I understand you'd like to return your laptop for a full refund. Since you've had it for 10 days and it's working, you're eligible for a return under our policy. Please visit our returns portal on our website to initiate the process, and we'll guide you through getting that refund back to your card." },
    v14Headphones: { src: "s6-llm-incident/v14-headphones", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
      text: "… Unfortunately, our return policy only covers items returned within 30 days of purchase. Since it's been 45 days, we're unable to process a refund for this item." }, // trimmed: first sentence cut
    v14FixedLaptop: { src: "s6-llm-incident/v14fixed-laptop", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17", promptTokens: 158,
      text: "… Since the laptop is opened but working, we can offer you an exchange for another item or store credit for the full amount. Unfortunately, we can't provide a cash refund for opened, working items." }, // trimmed: first sentence cut
    fallbackHeadphones: { src: "s6-llm-incident/fallback-v13-headphones", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-17",
      text: "Since the headphones are opened and you are within the 30-day return window, you cannot receive a cash refund. However, you can exchange them for another product or receive store credit. If you'd like assistance with that, I can help you or pass your request to a human agent." }
  };
  const CAPTION = `Recorded model output, ${REC.v14Laptop.recordedAt}`;

  // From docs/ai-path/runs/s6-llm-incident/incident_replay.out.txt: every event, [time, kind, text]
  const EVENTS = [["09:34","check","v13 laptop: ok"],["09:40","check","v13 headphones: ok"],["09:46","check","v13 laptop: ok"],["09:52","check","v13 tv: ok"],["09:58","check","v13 headphones: ok"],["10:02","deploy","prompt v14 deployed (tone rewrite)"],["10:04","check","v14 headphones: ok"],["10:10","check","v14 tv: ok"],["10:16","check","v14 tv: ok"],["10:22","check","v14 tv: ok"],["10:28","check","v14 headphones: ok"],["10:34","check","v14 laptop: FLAG refund promise"],["10:40","check","v14 headphones: ok"],["10:46","check","v14 laptop: FLAG refund promise"],["10:52","check","v14 tv: ok"],["10:58","check","v14 laptop: FLAG refund promise"],["10:58","alert","quality alert: 3 refund promises in 30 minutes"],["11:03","action","prompt rolled back to v13"],["11:04","check","v13 headphones: ok"],["11:10","check","v13 tv: ok"],["11:16","check","v13 laptop: ok"],["11:22","check","v13 tv: ok"],["11:28","check","v13 headphones: ok"],["11:34","check","v13 laptop: ok"],["11:40","check","v13 laptop: ok"],["11:46","check","v13 tv: ok"],["11:52","check","v13 laptop: ok"],["11:58","check","v13 tv: ok"],["12:04","check","v13 tv: ok"],["12:10","check","v13 laptop: ok"],["12:16","check","v13 laptop: ok"],["12:22","check","v13 headphones: ok"],["12:28","check","v13 laptop: ok"],["12:34","check","v13 headphones: ok"],["12:40","check","v13 headphones: ok"],["12:46","check","v13 tv: ok"],["12:52","check","v13 laptop: ok"],["12:58","check","v13 tv: ok"],["13:04","check","v13 laptop: ok"],["13:06","error","headphones: 503 Service Unavailable from primary provider"],["13:08","error","headphones: 503 Service Unavailable from primary provider"],["13:10","error","laptop: 503 Service Unavailable from primary provider"],["13:10","alert","error alert: 3 failed calls in 10 minutes"],["13:12","error","laptop: 503 Service Unavailable from primary provider"],["13:14","action","fallback provider switched on"],["13:18","check","fallback-v13 headphones: ok"],["13:24","check","fallback-v13 tv: ok"],["13:30","check","fallback-v13 tv: ok"],["13:36","check","fallback-v13 laptop: ok"],["13:42","check","fallback-v13 tv: ok"],["13:48","check","fallback-v13 laptop: ok"],["13:54","check","fallback-v13 tv: ok"],["14:00","check","fallback-v13 headphones: ok"]];
  const SUMMARY = { answers_v14: 31, refund_promises_v14: 6, failed_calls: 4, fallback_answers: 24 }; // last line of the same file
  const OUTAGE_FROM = "13:05"; // same line, "outage_from"
  const CHECK_EVERY = 3; // incident_replay.py: every 3rd answer is checked

  // From docs/ai-path/runs/s6-llm-incident/strict_render.py and strict_render.out.txt
  const RENDER_CODE = [
    "def render(template, values):",
    "    return re.sub(r\"\\{(\\w+)\\}\", lambda m: values.get(m.group(1), \"\"), template)",
    "",
    "",
    "def render_strict(template, values):",
    "    return template.format_map(values)"
  ];
  const STRICT_OUT = "strict renderer: KeyError 'returns_policy'";

  /* ---------- Derived from the data ---------- */
  const at = kind => EVENTS.find(e => e[1] === kind);
  const DEPLOY = at("deploy")[0];
  const QALERT = EVENTS.find(e => e[1] === "alert" && e[2].startsWith("quality"))[0];
  const ROLLBACK = EVENTS.find(e => e[1] === "action" && e[2].includes("rolled back"))[0];
  const FIRSTFLAG = EVENTS.find(e => e[2].includes("FLAG"))[0];
  const FIRST_ERR = at("error")[0];
  const EALERT = EVENTS.find(e => e[1] === "alert" && e[2].startsWith("error"))[0];
  const FALLBACK_ON = EVENTS.find(e => e[1] === "action" && e[2].includes("fallback"))[0];
  const inRange = (a, b) => EVENTS.filter(e => mins(e[0]) >= mins(a) && mins(e[0]) <= mins(b));
  const checksAfterRollback = EVENTS.filter(e => e[1] === "check" && mins(e[0]) > mins(ROLLBACK) && mins(e[0]) < mins(FIRST_ERR));
  const okAfterRollback = checksAfterRollback.filter(e => e[2].endsWith(": ok")).length;
  const v14ChecksOkBeforeFlag = EVENTS.filter(e => e[1] === "check" && e[2].startsWith("v14") && mins(e[0]) < mins(FIRSTFLAG)).length;
  const fallbackChecks = EVENTS.filter(e => e[1] === "check" && e[2].startsWith("fallback"));
  const fallbackHeadphoneChecks = fallbackChecks.filter(e => e[2].includes("headphones")).map(e => e[0]);
  const SENTENCES = REC.v14Laptop.text.match(/[^.!?]+[.!?]/g).map(s => s.trim());
  const TOKENS_LOST = REC.v13Laptop.promptTokens - REC.v14Laptop.promptTokens;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-tl { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-ev { display: grid; grid-template-columns: 3.4em 4.6em 1fr; gap: 0 10px; align-items: center; width: 100%; min-height: 44px; padding: 6px 4px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--ink); font: inherit; text-align: left; }
      button.lx-${ID}-ev { cursor: pointer; }
      button.lx-${ID}-ev:hover { background: var(--sunk); }
      .lx-${ID}-ev.lx-${ID}-no { background: var(--bad-soft); }
      .lx-${ID}-ev.lx-${ID}-ok { background: var(--good-soft); }
      .lx-${ID}-t { font: 600 14px/1.4 var(--mono); }
      .lx-${ID}-k { font: 600 12px/1.4 var(--mono); text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
      .lx-${ID}-x { font: 500 14px/1.45 var(--mono); overflow-wrap: anywhere; min-width: 0; }
      .lx-${ID}-ev.lx-${ID}-loud .lx-${ID}-x { font-weight: 700; }
      .lx-${ID}-quote { margin: 14px 0 0; padding: 10px 0 10px 14px; border-left: 3px solid var(--line); font-size: 16px; line-height: 1.55; }
      .lx-${ID}-sent { display: block; width: 100%; min-height: 44px; margin: 6px 0 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: inherit; font-size: 16px; line-height: 1.5; text-align: left; cursor: pointer; }
      .lx-${ID}-sent.lx-${ID}-no { border-color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-sent.lx-${ID}-ok { border-color: var(--good); background: var(--good-soft); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-pol { margin: 10px 0 0; padding: 0 0 0 1.2em; font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-traces { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0 0; }
      .lx-${ID}-trace { min-width: 0; border: 1px solid var(--line); border-radius: 6px; padding: 10px; background: var(--surface); }
      .lx-${ID}-th { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 0 0 6px; }
      .lx-${ID}-meta { font: 500 13.5px/1.5 var(--mono); margin: 0 0 8px; }
      .lx-${ID}-sec { display: block; width: 100%; min-height: 44px; margin: 6px 0 0; padding: 6px 8px; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--ink); text-align: left; font: 500 13.5px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      button.lx-${ID}-sec { cursor: pointer; }
      .lx-${ID}-sec.lx-${ID}-no { border-color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-sec.lx-${ID}-ok { border-color: var(--good); background: var(--good-soft); }
      .lx-${ID}-lab { display: block; font: 600 11.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      @media (max-width: 720px) { .lx-${ID}-traces { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  const askOpts = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const wireOpts = (el, sel, fn) => el.querySelectorAll(sel).forEach(b => b.onclick = () => fn(+b.dataset.i));
  // A timeline: rows [time, kind, text]; o.pick makes rows buttons, o.state(i) gives "no" | "ok" | ""
  function timeline(kit, rows, o = {}) {
    return `<div class="lx-${ID}-tl">${rows.map((e, i) => {
      const st = o.state ? o.state(i) : "";
      const loud = e[1] !== "check" || e[2].includes("FLAG");
      const cls = `lx-${ID}-ev${loud ? ` lx-${ID}-loud` : ""}${st ? ` lx-${ID}-${st}` : ""}`;
      const inner = `<span class="lx-${ID}-t">${kit.esc(e[0])}</span><span class="lx-${ID}-k">${kit.esc(e[1])}</span><span class="lx-${ID}-x">${kit.esc(e[2])}</span>`;
      return o.pick ? `<button type="button" class="${cls}" data-i="${i}"${o.right === i ? " data-right" : ""}${o.wrong === i ? " data-wrong" : ""}>${inner}</button>` : `<div class="${cls}">${inner}</div>`;
    }).join("")}</div>`;
  }
  const quote = (kit, text) => `<div class="lx-${ID}-quote">${kit.esc(text)}</div><p class="lx-${ID}-cap">${CAPTION}</p>`;
  const policyList = kit => `<ul class="lx-${ID}-pol">${POLICY.map(p => `<li>${kit.esc(p)}</li>`).join("")}</ul>`;

  /* 1. The situation: find the promise the policy forbids. */
  function badAnswer({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const fb = [
      ["That sentence repeats what the customer asked for. Repeating a wish is not promising it. Look for the sentence where the shop commits to something.", false],
      ["Close, but “a return” is vague. For an opened laptop that works, the policy does allow an exchange or store credit, and both are kinds of return. The forbidden promise is about money, and it is in another sentence.", false],
      ["Right. The policy says an opened item that works gets an exchange or store credit, “no cash refund”. This sentence promises the money back on the card. Notice also the “returns portal”: nothing in the assistant's instructions mentions one. The customer now has a screenshot of the shop promising a refund.", true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A refund the policy does not allow</h1>
        <p class="lead">This lesson is about the day a live AI feature goes wrong. Teams call it an <b>incident</b>: you stop the harm, find the cause, and change the system so it does not happen again.</p>
        <p class="lead">An online electronics shop runs a chat assistant: a language model with instructions (its <b>prompt</b>) that are meant to include the shop's refund policy:</p>
        ${policyList(kit)}
        <p class="lead">One morning a customer writes: “${kit.esc(MSG.laptop)}” A small hosted model, running the shop's live prompt, answered:</p>
        ${SENTENCES.map((s, i) => `<button type="button" class="lx-${ID}-sent${ans === i ? (i === RIGHT ? ` lx-${ID}-ok` : ` lx-${ID}-no`) : ""}" data-i="${i}"${i === RIGHT ? " data-right" : ""}${i === 0 ? " data-wrong" : ""}>${kit.esc(s)}</button>`).join("")}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="task">Click the sentence that promises money the policy does not allow.</p>
        <div class="lpanel">${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      wireOpts(el, `.lx-${ID}-sent`, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Detect: when did the harm start? */
  function whenStarted({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const rows = inRange("09:52", ROLLBACK);
    const iDeploy = rows.findIndex(e => e[1] === "deploy");
    const iFlag = rows.findIndex(e => e[2].includes("FLAG"));
    const iAlert = rows.findIndex(e => e[1] === "alert");
    const say = i => {
      if (i === iDeploy) return [`Right. The prompt changed at ${DEPLOY}, and the alert came at ${QALERT}: ${between(DEPLOY, QALERT)} minutes later. The replay counts every answer, not only the checked ones: ${SUMMARY.answers_v14} answers went out on v14 before the rollback, and ${SUMMARY.refund_promises_v14} of them promised a refund. Two things made the alert slow. Only one answer in ${CHECK_EVERY} is checked. And v14 did not break every answer: the headphones answer on v14 still said no: “${kit.esc(REC.v14Headphones.text)}” So the time an alert fires is when you <b>noticed</b>. The start is usually an earlier change: look for the last deploy before the first bad answer.`, true];
      if (i === iFlag) return [`That is the first <b>checked</b> answer that was flagged. The ${plural(v14ChecksOkBeforeFlag, "checked v14 answer")} before it happened to be about headphones or TVs, which v14 still handled. Unchecked answers in between could already have promised refunds. What changed before all of them?`, false];
      if (i === iAlert) return [`That is when the shop <b>noticed</b>: the alert needs three flags in 30 minutes. The harm began before the first flag. What changed earlier?`, false];
      if (rows[i][1] === "action") return ["That is the fix going in, the end of the harm. Find its start.", false];
      return ["That checked answer was fine. Look for the first event that changed what the assistant does.", false];
    };
    const paint = () => {
      el.innerHTML = `<h1>When did it start?</h1>
        <p class="lead">The shop replayed its monitoring log for the morning. A <code>check</code> line is one answer that was checked for a refund promise. Only one answer in ${CHECK_EVERY} gets checked. Prompt versions are numbered: v13 was live before today.</p>
        <p class="lead">This timeline is a replay on our machine: the answers are real recorded model answers; the clock and the traffic are simulated.</p>
        <p class="task">Click the line where the harm started.</p>
        ${timeline(kit, rows, { pick: true, right: iDeploy, wrong: iAlert, state: i => ans === i ? (i === iDeploy ? "ok" : "no") : "" })}
        <div class="lpanel">${ans == null ? "" : kit.feedback(...say(ans))}</div>`;
      wireOpts(el, `.lx-${ID}-ev`, i => { ans = i; paint(); if (i === iDeploy) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: stop the harm first. */
  function firstMove({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "Open the traces and find the cause before changing anything",
      "Roll back the prompt to v13, the last version that worked",
      "Add “never promise cash refunds” to v14 and deploy it",
      "Switch the assistant to a bigger model"
    ];
    const rate = Math.round(between(DEPLOY, ROLLBACK) / SUMMARY.refund_promises_v14);
    const fb = [
      [`Finding the cause matters, but not first. While you read traces, v14 keeps answering. This morning, until the rollback, it promised a refund about once every ${rate} minutes. And the traces do not go away when you roll back.`, false],
      [`Right: <b>stop the harm first, find the cause second</b>. Google's SRE book puts it as “Stop the bleeding, restore service, and preserve the evidence for root-causing.” A rollback is fast, and v13 is a known quantity: it was live before today, and its checked answers were ok. The traces of the bad answers stay saved. In the replay, the rollback went in at ${ROLLBACK}, and ${okAfterRollback === checksAfterRollback.length ? "all" : okAfterRollback + " of"} ${checksAfterRollback.length} checked answers after it were ok, until the next problem at ${FIRST_ERR}. A second move would also stop the harm: <b>switch the assistant off</b> with a setting your app reads, and show a “chat is paused” message. That costs more, since every customer loses the chat. It is the right first move when no version is known to be good. Prompt-management tools make the rollback quick. In Langfuse, for example, your code asks for the prompt version labelled <code>production</code>. To roll back, you move that label to an earlier version in the Langfuse screen. The code stays the same.`, true],
      ["That is a fix written in a hurry, deployed without tests, while you still do not know the cause. It might stop refund promises and break something else. Fix forward only when going back is impossible.", false],
      [`Nothing says the model is the problem. What changed at ${DEPLOY} was the prompt, not the model. A new model is a new, untested system, deployed during an incident.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The alert fired. What first?</h1>
        <p class="lead">It is ${QALERT}. The quality alert says three checked answers in 30 minutes promised refunds. You know prompt v14 went out at ${DEPLOY}. You do not yet know why v14 does this.</p>
        <p class="task">What do you do first?</p>
        <div class="lpanel">${askOpts(kit, opts, RIGHT, ans, fb)}</div>`;
      wireOpts(el, ".lopts button", i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Use it: the provider outage, then read the fallback's answer. */
  function outage({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const rows = inRange("13:04", "13:18");
    const opts = [
      "Roll back the prompt again",
      "Retry every failed call until it works",
      "Switch on the fallback provider",
      "Switch the assistant off"
    ];
    const fb = [
      ["The prompt has not changed since the rollback. These are not bad answers; there are no answers at all. The errors come from the provider: <code>503 Service Unavailable</code>.", false],
      ["Retries help with a short hiccup. When the provider is down, every retry fails too, and the retries pile more load onto it while the customer waits. Retry a few times, waiting longer before each try, then stop.", false],
      null,
      ["It stops the errors, but every customer loses the chat. The shop has a second provider set up for exactly this: use it first. Switching off is for when no safe option is left.", false]
    ];
    const fb2 = [
      ["Read it again next to the policy. The customer bought the headphones 45 days ago. The answer says they are “within the 30-day return window”, and offers an exchange or store credit. The policy says that after 30 days a working item cannot be returned at all.", false],
      [`Right, it breaks the policy in another way: it says “within the 30-day return window” when 45 days have passed, and offers an exchange the policy does not allow. The check said <code>ok</code> because it only looks for refund promises. A fallback model is a different model: it reads your prompt differently and makes its own mistakes. Run your golden set (your fixed list of test questions) on the fallback <b>before</b> you need it, and keep its monitoring on.`, true]
    ];
    const paint = () => {
      const sw = stage >= 1;
      el.innerHTML = `<h1>A second alert</h1>
        <p class="lead">The prompt was rolled back at ${ROLLBACK}, and the answers were fine again. The model runs on the servers of a company, the model <b>provider</b>. The shop also has a second provider set up as a <b>fallback</b>, unused until it is switched on. Then this happened. (In the replay, the primary provider was made to fail on purpose from ${OUTAGE_FROM}.)</p>
        ${timeline(kit, sw ? inRange("13:04", fallbackHeadphoneChecks[0]) : rows.filter(e => mins(e[0]) <= mins(EALERT)))}
        ${stage === 0 ? `<p class="task">It is ${EALERT}. What do you do first?</p><div class="lpanel">${askOpts(kit, opts, 2, ans, fb)}</div>` : ""}
        ${sw ? `<div class="lpanel">${kit.feedback(`Right. Nothing is wrong with the prompt; the provider is down. A <b>fallback</b> sends the same prompt to a second model from another provider. In the replay, ${plural(SUMMARY.failed_calls, "call")} failed between ${FIRST_ERR} and ${FALLBACK_ON}, then the fallback took over and answered the next ${SUMMARY.fallback_answers}. Routers can do this for you: OpenRouter, for example, tries the next model in a <code>models</code> list when the first returns an error.`, true)}</div>
          <p class="lead">The check at ${kit.esc(fallbackHeadphoneChecks[0])} said <code>ok</code>. It was the headphones question (“${kit.esc(MSG.headphones)}”). A different hosted model, the fallback, answered:</p>
          ${quote(kit, REC.fallbackHeadphones.text)}
          ${stage === 1 ? `<p class="task">Does this answer follow the policy?</p>` : ""}
          <div class="lpanel">${askOpts(kit, ["Yes: no cash refund, so it is fine", "No"], 1, ans, fb2)}</div>` : ""}`;
      wireOpts(el, ".lopts button", i => {
        ans = i;
        if (stage === 0 && i === 2) { stage = 1; ans = null; }
        else if (stage === 1 && i === 1) { stage = 2; }
        paint();
        if (stage === 2) done();
      });
    };
    paint();
  }

  /* 5. Broken on purpose: find the cause in the traces. */
  function findCause({ el, done, kit }) {
    ensureStyle();
    let step = 0, pick = null, ans = null;
    const SECS = [
      ["instructions", INTRO],
      ["policy section", "Refund policy:\n\n"],
      ["instructions", RULE_V14],
      ["customer", MSG.laptop]
    ];
    const RIGHT = 1;
    const secFb = [
      ["This line is the same in both traces, word for word. Tokens did not go missing here.", false],
      [`Right. Under “Refund policy:” the v14 request has nothing. The policy, ${POLICY.length} rules long, never reached the model. With the policy filled back in, the same v14 request carries ${REC.v14FixedLaptop.promptTokens} input tokens.`, true],
      ["This line is new in v14, and it is longer than the v13 rule it replaced. It added tokens; it did not remove them. Something else got shorter.", false],
      ["The customer's message is identical in both traces. Look at what the shop sent around it.", false]
    ];
    const opts = [
      "The empty policy section",
      "The new “customer-first” line",
      "The model changed during the morning"
    ];
    const fb = [
      [`Right. With the policy filled in, v14's own wording gave “we can't provide a cash refund” in this re-run. The tone line is not what broke it here; the missing policy is. Why was it missing? The prompt is a template: the policy goes into a named placeholder, a <b>slot</b>. Version 14 renamed the slot from <code>${SLOT_V13}</code> to <code>${SLOT_V14}</code>, but the shop's config still sends the policy as <code>${CONFIG_KEY}</code>. The shop's <b>renderer</b> (the code that fills the slots) puts an empty string in a slot that has no value, instead of failing:${kit.code(RENDER_CODE, 1)}Run on v14, a strict renderer stops instead, which our run shows: <code>${kit.esc(STRICT_OUT)}</code>. One test on that would have blocked the deploy.`, true],
      ["It is the obvious suspect, since it is new. But the re-run kept that exact line and filled the policy in, and the answer said “we can't provide a cash refund”. In this test, the tone line alone did not cause refund promises.", false],
      [`Every trace this morning names the same model. And the answers turned bad right at ${DEPLOY}, the prompt deploy, not at some random time.`, false]
    ];
    const sec = (label, text, opt) => {
      const inner = `<span class="lx-${ID}-lab">${kit.esc(label)}</span>${kit.esc(text)}`;
      if (!opt) return `<div class="lx-${ID}-sec">${inner}</div>`;
      const st = opt.picked ? (opt.right ? ` lx-${ID}-ok` : ` lx-${ID}-no`) : "";
      return `<button type="button" class="lx-${ID}-sec${st}" data-i="${opt.i}"${opt.right ? " data-right" : ""}${opt.i === 0 ? " data-wrong" : ""}>${inner}</button>`;
    };
    const paint = () => {
      const v13 = `<div class="lx-${ID}-trace"><p class="lx-${ID}-th">prompt v13</p><p class="lx-${ID}-meta">input tokens ${REC.v13Laptop.promptTokens}</p>
        ${sec("instructions", INTRO)}${sec("policy section", "Refund policy:\n" + POLICY.map(p => "- " + p).join("\n"))}${sec("instructions", RULE_V13)}${sec("customer", MSG.laptop)}</div>`;
      const v14 = `<div class="lx-${ID}-trace"><p class="lx-${ID}-th">prompt v14</p><p class="lx-${ID}-meta">input tokens ${REC.v14Laptop.promptTokens}</p>
        ${SECS.map(([l, t], i) => sec(l, t, step === 0 ? { i, right: i === RIGHT, picked: pick === i } : null)).join("")}</div>`;
      el.innerHTML = `<h1>Find the cause in the traces</h1>
        <p class="lead">The harm is stopped, so now you look for the cause. A <b>trace</b> is the saved record of one request: exactly what was sent to the model and what came back. Below is what was sent in two traces of the same laptop question: one on v13 (its answer refused the cash refund), one on v14 (its answer promised it).</p>
        ${step === 0 ? `<p class="task">The v14 request carried ${TOKENS_LOST} fewer input tokens for the same question. Click the part of the v14 trace where they went missing.</p>` : ""}
        <div class="lx-${ID}-traces">${v13}${v14}</div>
        ${step === 0 ? `<div class="lpanel">${pick == null ? "" : kit.feedback(...secFb[pick])}</div>` : `<div class="lpanel">${kit.feedback(secFb[RIGHT][0], true)}</div>
        <p class="lead">Two things changed in v14: the policy is empty, and the last rule is new. To tell them apart, the same laptop question was sent with v14's wording but with the policy filled in. The same small model answered:</p>
        ${quote(kit, REC.v14FixedLaptop.text)}
        ${step === 1 ? `<p class="task">Which change made the assistant promise refunds?</p>` : ""}
        <div class="lpanel">${askOpts(kit, opts, 0, ans, fb)}</div>`}`;
      if (step === 0) wireOpts(el, `button.lx-${ID}-sec`, i => { pick = i; if (i === RIGHT) { step = 1; } paint(); });
      else wireOpts(el, ".lopts button", i => { ans = i; if (i === 0) step = 2; paint(); if (step === 2) done(); });
    };
    paint();
  }

  /* 6. The one-sentence cause, written blamelessly. */
  function causeSentence({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `The engineer who deployed v14 at ${DEPLOY} did not check the prompt.`,
      "The model hallucinated refunds that the policy does not allow.",
      `Prompt v14 renamed the policy slot, the renderer filled it with nothing instead of failing, so from ${DEPLOY} to ${ROLLBACK} the model answered without the refund policy and promised refunds.`,
      "A bad prompt was deployed."
    ];
    const RIGHT = 2;
    const fb = [
      ["This blames a person, and fixes nothing: the next engineer can make the same rename, and the renderer will hide it again. A blameless review assumes people acted in good faith with what they knew, and asks what in the system let the mistake through. The SRE book says you cannot fix people, “but you can fix systems and processes”.", false],
      ["That is the symptom, not the cause. The policy never reached the model, so it could not follow it. This sentence gives you nothing to fix.", false],
      [`Right. It names the mechanism (renamed slot, silent renderer), the window (${DEPLOY} to ${ROLLBACK}, ${between(DEPLOY, ROLLBACK)} minutes) and the effect, and it blames no one. Every part points at something to fix: the renderer, the deploy checks, the alert.`, true],
      ["True, but too vague to act on. Which part of the prompt? Why did nothing catch it? A good cause sentence tells the reader what to fix.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The cause, in one sentence</h1>
        <p class="lead">After an incident the team writes a short <b>review</b> (often called a postmortem): what happened, the impact, the timeline, the cause, and what to change. It is <b>blameless</b>: it looks for what in the system let the mistake through, not for who to punish. Its heart is one sentence of cause.</p>
        <p class="task">Which sentence belongs in the review as the cause?</p>
        <div class="lpanel">${askOpts(kit, opts, RIGHT, ans, fb)}</div>`;
      wireOpts(el, ".lopts button", i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 7. The review's action items: keep or drop. */
  const ITEMS = [
    [`Make the prompt renderer fail on a missing value, and test every prompt version with it before deploy.`, true,
      "Keep. This removes the cause itself: the rename would have stopped at deploy with a KeyError.",
      "This is the direct fix for the cause. The silent empty string hid the rename; a renderer that stops on a missing value turns it into a failed deploy instead of a wrong answer."],
    ["Add refund questions to the golden set, and run it on every prompt change before deploy.", true,
      "Keep. A regression test with the laptop question would have caught v14's promise before any customer saw it.",
      "A prompt change broke behaviour that no test covered. Running the golden set on each prompt change, with refund cases in it, is what catches the next one before customers do."],
    ["Tell the engineer who deployed v14 to be more careful.", false,
      "Drop. It blames a person and changes nothing in the system. The next rename would slip through the same way.",
      "Being careful is not a system change. Anyone could rename a slot; what failed was a renderer that hid it and a deploy with no test. Fix those."],
    [`Contact the ${SUMMARY.refund_promises_v14} customers who were promised a refund, and decide how to honour or correct it.`, true,
      "Keep. The impact is real people with a written promise from the shop. The review names them and what the shop will do.",
      `The harm did not end at the rollback: ${SUMMARY.refund_promises_v14} customers hold a promise. Dealing with them is part of the follow-up.`],
    ["Run the golden set on the fallback model too, and add its answers to the checks.", true,
      "Keep. The fallback broke the policy in its own way during the outage, and the check did not see it.",
      "During the outage the fallback said a 45-day-old purchase was inside the 30-day window. A fallback that was never tested is a second incident waiting."],
    ["Move the assistant to a bigger model.", false,
      "Drop. Nothing in the timeline points at the model. The same model followed the policy once the policy reached it.",
      "The re-run showed the same model refusing the cash refund once the policy was in the prompt. A model change adds cost and risk without touching the cause."]
  ];
  function review({ el, done, kit }) {
    ensureStyle();
    const ans = ITEMS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>What goes in the review</h1>
        <p class="lead">Impact: ${SUMMARY.answers_v14} answers on v14, ${SUMMARY.refund_promises_v14} refund promises, ${between(DEPLOY, QALERT)} minutes to notice; ${plural(SUMMARY.failed_calls, "failed call")} in the outage. Next come the <b>action items</b>: the changes the team agrees to make. Each must make this less likely, or less harmful, next time.</p>
        <p class="task">Keep or drop each proposed action item.</p>
        ${ITEMS.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Keep", "Drop"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ITEMS.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 8. The big picture, with a task: the right first move for three situations. */
  const MOVES = ["Roll back", "Fall back", "Switch off"];
  const SITS = [
    ["Ten minutes after a new prompt version went live, the assistant starts telling customers that every order ships free, which the shop never offered.", 0,
      "Right. A prompt changed just before the harm, and the last version is known to be good. Go back to it, then find the cause.",
      ["", "The provider is answering fine. A different model with the same new prompt would likely keep the same problem.", "That works, but takes the chat from everyone when a known-good version is one step back."]],
    ["Every call to the model provider times out. No prompt or code changed today.", 1,
      "Right. Your side did not change; the provider is down. Send the same prompt to the tested second provider.",
      ["Nothing changed on your side, so there is nothing to roll back to.", "", "Possible, but if a tested fallback exists, customers keep the chat."]],
    ["The assistant starts showing customers other people's order addresses. Nobody knows yet what changed.", 2,
      "Right. The harm is serious, and there is no known-good version to go back to. Stop it now with the switch, then investigate.",
      ["Roll back to what? No one knows which change caused it, and every minute leaks more personal data.", "The leak comes from data your system hands the model. Another model would show the same addresses.", ""]]
  ];
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const ans = SITS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to run an incident</h1>
        <p class="lead"><b>For:</b> any LLM feature users rely on. Run one when harm is ongoing and repeats: wrong promises, leaked data, an outage. <b>Not</b> for one odd answer that does not come back: that is a bug ticket and a new golden-set case. A slow drift in quality is normal work, not an emergency.</p>
        <p class="lead"><b>Costs:</b> the three moves must exist <b>before</b> the incident: versioned prompts with one-step rollback, a tested fallback provider, a switch that turns the feature off. All need upkeep. Someone must be on call (ready to respond at any hour), and a review takes hours of the team's time.</p>
        <p class="task">Pick the first move for each situation.</p>
        ${SITS.map(([q, r, ok, bad], i) => `<div class="lcase" id="b${i}"><p>${kit.esc(q)}</p>${kit.options(MOVES, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? ok : bad[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SITS.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: incident now, or not? */
  const CASES = [
    ["A travel-booking assistant: after the airline partner changed its data feed, it tells every customer who asks that their flight is on time, including cancelled ones.", true,
      "Yes. The harm is ongoing and repeats for every customer who asks. Note the first move: falling back to another model will not help, because the wrong status comes from the feed your tool reads, and any model would repeat it. Switch off flight-status answers (send customers to the airline's own status page) until the feed is handled.",
      "Every customer asking gets a false answer, and some will miss rebooking. That is ongoing, repeating harm: run an incident. The cause is the data feed, so the move is to switch off that answer until the feed is handled, not to change the model."],
    ["A bank's FAQ assistant: one customer reports that it once gave the wrong opening hours for a branch. The sampled checks found nothing else this week, and the same question now gets the right hours.", false,
      "No. One answer, no repeat, no ongoing harm. Waking people up and rolling things back costs more than it saves. Open a bug ticket and add the question to the golden set, so a future change cannot break it silently.",
      "An incident is for harm that is ongoing and repeats. Here nothing is still happening: one answer, and the checks show no pattern. A rollback would undo working changes for nothing. A ticket and a golden-set case are the right size."],
    ["A writing assistant in a note app: for the last 40 minutes, about half of all requests fail with errors from the model provider.", true,
      "Yes. Users are failing right now, and it keeps happening. Switch to the fallback provider if one is tested, and tell users while it lasts.",
      `Half the users get an error, and it is still going. That is an outage, the same shape as the shop's ${EALERT} alert: fall back first, investigate after.`],
    ["A recipe assistant: the monthly model bill is higher than last month because more people use the app.", false,
      "No. Nothing is harming users; the feature is working and more people use it. This is budget and capacity planning: look at cost per request and caching, in normal working hours.",
      "More traffic costing more is the feature succeeding, not breaking. No user is harmed and nothing needs stopping. Plan for it with cost work, not an incident."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Incident or not?</h1>
        <p class="lead">Four reports from other teams. An incident means: stop the harm now, find the cause from traces, write a blameless review.</p>
        <p class="task">Should each team run an incident right now? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can run an LLM incident</h1>
      <p class="lead">An incident is how a team handles a live AI feature that is causing harm. You found where the harm started, before the alert. You stopped it with a rollback. You kept customers served with a fallback, and caught the fallback's own mistake. You found the cause by comparing two traces. Then you wrote it as one blameless sentence, with action items that fix the system.</p>
      <p class="lead">Run one when harm is ongoing and repeats; one odd answer is a bug ticket and a golden-set case. The cost is paid before the day: a prompt you can roll back, a tested fallback and an off switch must already exist.</p>
      <p class="lead">This lesson was the practice. There is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A system design answer ends with “what can fail”: the rollback, fallback and switch you used here are what you will name there.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Incident response for an LLM feature",
    checked: "2026-11-17",
    sources: [
      "https://sre.google/sre-book/managing-incidents/",
      "https://sre.google/sre-book/postmortem-culture/",
      "https://sre.google/sre-book/addressing-cascading-failures/",
      "https://openrouter.ai/docs/guides/routing/model-fallbacks",
      "https://langfuse.com/docs/prompt-management/features/prompt-version-control",
      "https://docs.python.org/3/library/stdtypes.html#str.format_map"
    ],
    interview: [
      {
        q: "An hour after a prompt change, your shopping assistant starts promising refunds the policy does not allow. Walk me through what you do.",
        good: [
          "Stop the harm first: roll back to the last prompt version that worked, or switch the feature off if no version is known to be good",
          "Confirm the rollback worked by watching the same check that alerted",
          "Find the cause by comparing traces before and after: what was sent to the model, not only what came back",
          "Count who was affected and decide how to handle the promises already made",
          "Write a blameless review with action items that change the system: tests on prompt changes, a renderer or check that would have caught it"
        ],
        weak: "Start editing the prompt in production to tell the model not to promise refunds, while the broken version keeps answering customers."
      },
      {
        q: "Your main model provider goes down and you switch to a fallback from another provider. What can go wrong, and how do you prepare?",
        good: [
          "The fallback is a different model: it reads the same prompt differently and makes different mistakes",
          "Run the golden set on the fallback before it is needed, and keep it in the regression runs",
          "Keep the quality checks running on fallback answers, not only error rates",
          "Decide in advance when to switch over and when to switch back"
        ],
        weak: "Configure a fallback model and assume it behaves like the main one, without ever testing it."
      }
    ],
    screens: [badAnswer, whenStarted, firstMove, outage, findCause, causeSentence, review, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ITEMS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#b0 [data-wrong]"], right: SITS.map((_, i) => `#b${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
