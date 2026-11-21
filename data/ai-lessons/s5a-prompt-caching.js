/* Lesson: prompt caching, putting the stable part first. Story: a city building-permit help desk (the made-up city
   of Millbrook) whose assistant sends the same long zoning rulebook with every homeowner's question.
   Ideas: (1) a provider can reuse the work on a prompt only from the first token up to the first token that
   differs, so the stable parts go first and the parts that change go last; (2) the usage numbers of each call
   (cached_tokens) say whether the cache was hit, and a single changing line at the top (a request time) turns
   every hit into a miss (broken on purpose, recorded for real).
   Depth: explain (screens 1-5, 7, interview), debug (screen 6), when-not (screens 7 and 8).
   Data: nine recorded calls, docs/ai-path/recordings/s5a-prompt-caching/<name>.json in the main checkout, made back
   to back on 2026-11-13 by docs/ai-path/runs/s5a-prompt-caching/record-all.sh from the requests that
   make-requests.mjs wrote (the rulebook is rulebook.txt, written for this lesson). Token counts of the prompt parts
   and of the shared prefixes come from prefix_tokens.py (tiktoken, output in prefix_tokens.out.txt). Every other
   number on screen is computed here from LOG, PART_TOK and SHARED.
   Lesson-local CSS (prompt parts, usage log, usage JSON lines, recorded answer box) is injected by style(), called
   by every screen. Plain browser script. */
(() => {
  const ID = "s5a-prompt-caching", P = "lx-" + ID;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = n => n.toLocaleString("en");
  const pct = (a, b) => Math.round(a / b * 100);

  // From docs/ai-path/recordings/s5a-prompt-caching/<name>.json: response.usage (prompt_tokens,
  // prompt_tokens_details.cached_tokens and .cache_write_tokens, completion_tokens, cost_details.upstream_inference_prompt_cost)
  // and recordedAt; usage.cost for good-2 only (shown on screen 5). Copied, not altered.
  const REC_META = { src: "s5a-prompt-caching/<name>", provider: "openrouter", model: "openai/gpt-4o-mini", upstream: "OpenAI", recordedAt: "2026-11-13" };
  const LOG = {
    "orig-1": { at: "2026-11-13T06:37:55.781Z", prompt: 2292, cached: 0, write: 0, out: 62, inCost: 0.0003438 },
    "orig-2": { at: "2026-11-13T06:37:59.560Z", prompt: 2297, cached: 0, write: 0, out: 65, inCost: 0.00034455 },
    "good-1": { at: "2026-11-13T06:38:03.329Z", prompt: 2296, cached: 0, write: 0, out: 35, inCost: 0.0003444 },
    "good-2": { at: "2026-11-13T06:38:08.465Z", prompt: 2301, cached: 2176, write: 0, out: 42, inCost: 0.00018195, cost: 0.00020715 },
    "good-3": { at: "2026-11-13T06:38:11.246Z", prompt: 2295, cached: 2176, write: 0, out: 75, inCost: 0.00018105 },
    "amend-4": { at: "2026-11-13T06:38:16.443Z", prompt: 2296, cached: 1024, write: 0, out: 48, inCost: 0.0002676 },
    "ts-1": { at: "2026-11-13T06:38:19.567Z", prompt: 2296, cached: 0, write: 0, out: 49, inCost: 0.0003444 },
    "ts-2": { at: "2026-11-13T06:38:23.084Z", prompt: 2301, cached: 0, write: 0, out: 48, inCost: 0.00034515 },
    "ts-3": { at: "2026-11-13T06:38:27.178Z", prompt: 2295, cached: 0, write: 0, out: 53, inCost: 0.00034425 }
  };
  // From the same recordings: choices[0].message.content (trimmed with … where marked, never reworded).
  const ANS = {
    "orig-1": "No, you cannot build a 2 metre fence along your front yard, as the maximum height for a fence in a front yard is 1.2 metres according to rule 4.1. …",
    "good-3": "No, you cannot rent out your basement as a separate apartment in zone R1, as accessory dwelling units (ADUs) are not allowed in that zone. According to rule 7.2, ADUs are only permitted in R1 and R2 zones, but they must meet specific requirements. …",
    "ts-3": "No, you cannot rent out your basement as a separate apartment in zone R1, as accessory dwelling units (ADUs) are not allowed in this zone according to rule 7.2. …"
  };
  // From docs/ai-path/runs/s5a-prompt-caching/prefix_tokens.out.txt (tiktoken o200k_base, message text only).
  const PART_TOK = { time: 16, lot: 13, q: 15, instr: 50, book: 2172, fmt: 17 };
  const SHARED = { origToOrig: 13, goodToGood: 2254, good2ToGood3: 2252, goodToAmend: 1430, tsToTs: 15 };
  // The shared start of orig-1 and orig-2, decoded from those 13 tokens (prefix_tokens.out.txt).
  const ORIG_PREFIX = "Request time: 2026-11-13 09:";

  // The prompt parts, as sent in orig-1 (and, for "next", in orig-2). Text copied from the request files.
  const INSTR = "You are the help assistant at the Millbrook Permit Desk. Answer the homeowner's question using only the rulebook below. Cite the rule numbers you used. If the rulebook does not answer the question, say so and suggest calling the Permit Desk.";
  const BOOK = "<rulebook>\nMILLBROOK RESIDENTIAL ZONING RULEBOOK (homeowner edition) … 14.6 Work done without a required permit may have to be opened up for inspection or removed, and the permit fee is doubled.\n</rulebook>";
  const FMT = "Answer format: at most three sentences. Start with Yes, No or It depends.";
  const PARTS = [
    { k: "time", name: "Request time", t: "Request time: 2026-11-13 09:14:52", next: "Request time: 2026-11-13 09:15:31", changes: true },
    { k: "lot", name: "Homeowner's lot", t: "Homeowner's lot: zone R1, 14 Alder Lane", next: "Homeowner's lot: zone R2, 3 Weir Street", changes: true },
    { k: "q", name: "Question", t: "Question: Can I build a 2 metre fence along my front yard?", next: "Question: Do I need a permit for a 9 square metre garden shed with no electricity?", changes: true },
    { k: "instr", name: "Instructions", t: INSTR, changes: false },
    { k: "book", name: "Rulebook", t: BOOK, changes: false },
    { k: "fmt", name: "Answer format", t: FMT, changes: false }
  ];
  const CHANGING = PARTS.map((p, i) => p.changes ? i : -1).filter(i => i >= 0);
  const STABLE = PARTS.map((p, i) => p.changes ? -1 : i).filter(i => i >= 0);
  const TOTAL_TOK = PARTS.reduce((s, p) => s + PART_TOK[p.k], 0);
  const STABLE_TOK = STABLE.reduce((s, i) => s + PART_TOK[PARTS[i].k], 0);
  const secs = (a, b) => Math.round((Date.parse(LOG[b].at) - Date.parse(LOG[a].at)) / 1000);

  function style() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
.${P}-parts { margin: 14px 0 0; display: grid; gap: 8px; }
.${P}-part { display: block; width: 100%; text-align: left; min-height: 44px; padding: 10px 14px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; }
button.${P}-part { cursor: pointer; }
.${P}-part .tag { display: flex; justify-content: space-between; gap: 10px; font: 700 11px var(--mono); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
.${P}-part .t { display: block; font: 500 14px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}-part .nx { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-2); overflow-wrap: anywhere; }
.${P}-part.chg { border-color: var(--ink); border-width: 2.5px; }
.${P}-part.no { border-color: var(--bad); background: var(--bad-soft); }
.${P}-part.ok { border-color: var(--good); background: var(--good-soft); }
.${P}-part.gone { opacity: .45; }
.${P}-grp { margin: 14px 0 0; font: 700 12px var(--mono); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
.${P}-log { width: 100%; border-collapse: collapse; margin: 14px 0 0; font: 500 13px/1.4 var(--mono); color: var(--ink); }
.${P}-log caption { text-align: left; font: 600 13px var(--font); color: var(--muted); padding-bottom: 6px; }
.${P}-log th, .${P}-log td { border-bottom: 1px solid var(--line); padding: 7px 6px; text-align: right; }
.${P}-log td { white-space: nowrap; }
.${P}-log th { font-weight: 700; color: var(--ink-2); vertical-align: bottom; }
.${P}-log th:first-child, .${P}-log td:first-child { text-align: left; }
.${P}-log tr.on td { background: var(--sunk); }
.${P}-log td.hit { font-weight: 700; }
.${P}-json { margin: 14px 0 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); padding: 8px; display: grid; gap: 6px; }
.${P}-json button { display: block; width: 100%; text-align: left; min-height: 44px; padding: 8px 10px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: 500 14px/1.4 var(--mono); cursor: pointer; overflow-wrap: anywhere; }
.${P}-json button.in1 { margin-left: 16px; width: calc(100% - 16px); }
.${P}-json button.no { border-color: var(--bad); background: var(--bad-soft); }
.${P}-json button.ok { border-color: var(--good); background: var(--good-soft); }
.${P}-json .brace { font: 500 14px var(--mono); color: var(--muted); padding: 0 4px; }
.${P}-ans { margin: 14px 0 0; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: var(--bg); font: 500 14px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}-cap { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.${P}-case { margin-top: 18px; }
.${P}-case > p { margin: 0 0 6px; font-weight: 600; }
.${P}-big ul { margin: 8px 0 0; padding-left: 20px; }
.${P}-big li { margin: 4px 0; }
`;
    document.head.appendChild(s);
  }
  const answer = (key, lead) => `${lead ? `<p class="${P}-cap">${lead}</p>` : ""}<div class="${P}-ans">${esc(ANS[key])}</div><p class="${P}-cap">Recorded model output, ${REC_META.recordedAt}</p>`;
  // one prompt part as a box; opts: { pick, cls, showNext, tok }
  const part = (i, { pick = false, cls = "", showNext = false, tag = null } = {}) => {
    const p = PARTS[i], T = pick ? "button" : "div";
    return `<${T}${pick ? ' type="button"' : ""} class="${P}-part ${cls}" data-i="${i}"><span class="tag"><span>${esc(tag || p.name)}</span><span>${fmt(PART_TOK[p.k])} tokens</span></span><span class="t">${esc(p.t)}</span>${showNext && p.next ? `<span class="nx">Next call: ${esc(p.next)}</span>` : ""}</${T}>`;
  };
  // usage log: rows = [[label, key, { hide, on }]]
  const log = (rows, title) => `<table class="${P}-log"><caption>${esc(title)}</caption><thead><tr><th>call</th><th>sent</th><th>prompt_<wbr>tokens</th><th>cached_<wbr>tokens</th></tr></thead><tbody>${rows.map(([label, k, o = {}], j) => {
    const r = LOG[k], t0 = rows[0][1];
    return `<tr${o.on ? ' class="on"' : ""}><td>${esc(label)}</td><td>${j === 0 ? "first" : `+${secs(t0, k)} s`}</td><td>${fmt(r.prompt)}</td><td class="${!o.hide && r.cached ? "hit" : ""}">${o.hide ? "?" : fmt(r.cached)}</td></tr>`;
  }).join("")}</tbody></table><p class="${P}-cap">Usage numbers from recorded calls, ${REC_META.recordedAt}</p>`;

  /* 1. The situation: mark the parts of the recorded prompt that change from one question to the next. */
  function situation({ el, done, kit }) {
    style();
    const found = new Set();
    let miss = null, last = null;
    const paint = () => {
      const fin = found.size === CHANGING.length;
      el.innerHTML = `<h1>The permit desk sends the rulebook every time</h1>
        <p class="lead">Millbrook's building-permit desk has a help assistant. A homeowner types a question, and the app sends a model one prompt: the question, the homeowner's lot, the city's whole zoning rulebook and some instructions. The city and its rulebook are made up for this lesson. The prompts and the answers below are real calls to a small hosted model.</p>
        <p class="lead">Here is the prompt of the first call, part by part, with the size of each part in tokens. The rulebook is cut in the middle (…).</p>
        <p class="task">Tap every part that will be different when the next homeowner asks the next question.</p>
        <div class="${P}-parts">${PARTS.map((p, i) => part(i, { pick: !fin && !found.has(i), cls: found.has(i) ? "chg" : miss === i ? "no" : "", showNext: found.has(i) })).join("")}</div>
        ${answer("orig-1", "What the model answered (trimmed):")}
        <div class="lpanel">${fin
          ? kit.feedback(`Right: the request time, the lot and the question change with every call. The instructions, the rulebook and the format are the same, word for word. Those three parts are ${fmt(STABLE_TOK)} of the prompt's ${fmt(TOTAL_TOK)} tokens, about ${pct(STABLE_TOK, TOTAL_TOK)}%. (These counts cover only the text. The API adds a few tokens around each message, so the usage numbers on the next screens are slightly higher.) Input tokens are billed on every call, so the desk pays again and again for the same rulebook. This lesson shows how to stop paying full price for it.`, true)
          : miss != null ? kit.feedback(PARTS[miss].k === "book"
            ? `The rulebook does not change between homeowners. Every call sends the same ${fmt(PART_TOK.book)} tokens, word for word. That is exactly what makes it expensive.`
            : `This part (${esc(PARTS[miss].name.toLowerCase())}) is written once by the team that built the app. It is the same for every homeowner and every question.`, false)
          : last != null ? kit.feedback(`Yes, this part changes. In the next call it was: <b>${esc(PARTS[last].next)}</b>. ${CHANGING.length - found.size} more to find.`) : ""}</div>`;
      el.querySelectorAll(`button.${P}-part`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (PARTS[i].changes) { found.add(i); miss = null; last = i; } else { miss = i; last = null; }
        paint();
        if (found.size === CHANGING.length) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: the first two recorded calls share most of their text, but none of it was reused. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const sharedLater = STABLE_TOK;
    const opts = [
      `About ${fmt(sharedLater)}: the instructions, rulebook and format are identical`,
      "None: the two prompts already differ in their first line",
      `About ${fmt(sharedLater)}, but only from the third call on, once the cache has warmed up`
    ];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>What can the provider reuse?</h1>
        <p class="lead">Before a model writes a word, it has to read the whole prompt. Big API providers can keep that reading work for a while (minutes or longer, depending on the provider and model). When a new call repeats an earlier prompt, they reuse it. This is called <b>prompt caching</b>. Each reply comes with usage numbers, and <code>cached_tokens</code> counts the reused tokens.</p>
        <p class="lead">The two calls below came ${secs("orig-1", "orig-2")} seconds apart. Call 2 repeated ${fmt(sharedLater)} tokens of call 1 word for word: everything after the question.</p>
        <p class="task">Predict: how many tokens of call 2 did the provider reuse from call 1?</p>
        ${log([["1 (fence)", "orig-1"], ["2 (shed)", "orig-2", { hide: !ok }]], "The first layout: request time, lot, question, then instructions, rulebook, format")}
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right: <b>${fmt(LOG["orig-2"].cached)}</b> tokens reused. The two prompts share only their first ${SHARED.origToOrig} tokens (<code>${esc(ORIG_PREFIX)}</code>). Then the minutes differ (<code>14</code> against <code>15</code>; each is a whole token), and from that point on nothing can be reused, even the identical rulebook.<br><br>Here is why. While it reads, the model turns each token into a set of numbers (called <b>keys and values</b>), and each token's numbers are computed from that token <i>and every token before it</i>. Change one early token and the numbers of every later token change too, even where the text is the same. So a provider can only reuse a <b>prefix</b>: the run of tokens from the very start up to the first token that differs.`, true)
          : ans === 0 ? kit.feedback(`The rulebook is identical, but it is not at the start. Its reading work was done after the request time and the question, and that work depends on them. Look at where the two prompts first differ: in the minutes of the request time, ${SHARED.origToOrig} tokens in.`, false)
          : kit.feedback(`Waiting does not help. Every call starts with its own request time and question, so the third call differs from both earlier calls in its first line too. Reuse depends on what the start of the prompt says, not on how many calls came before.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. By hand: build the new order, stable parts first. */
  function reorder({ el, done, kit }) {
    style();
    const order = [];
    let miss = null;
    const paint = () => {
      const fin = order.length === PARTS.length;
      const left = PARTS.map((_, i) => i).filter(i => !order.includes(i));
      const stableLeft = STABLE.filter(i => !order.includes(i));
      el.innerHTML = `<h1>Put the stable part first</h1>
        <p class="lead">Only a matching start can be reused. So build a prompt whose start is the same in every call.</p>
        <p class="task">Tap the parts in the order the new prompt should have them, first part first.</p>
        <p class="${P}-grp">New prompt</p>
        <div class="${P}-parts">${order.length ? order.map((i, j) => part(i, { cls: "ok", tag: `${j + 1}. ${PARTS[i].name}` })).join("") : `<p class="${P}-cap">nothing placed yet</p>`}</div>
        ${left.length ? `<p class="${P}-grp">Parts left</p><div class="${P}-parts">${left.map(i => part(i, { pick: true, cls: miss === i ? "no" : "" })).join("")}</div>` : ""}
        <div class="lpanel">${fin
          ? kit.feedback(`This is the layout the next calls used. The three stable parts went into the system message (the first message, which carries the app's own instructions), and the request time, lot and question went into the user message after it. Now every call starts with the same ${fmt(STABLE_TOK)} tokens. The order inside each group does not matter for caching. What matters is that every stable part comes before every part that changes.`, true)
          : miss != null ? kit.feedback(`The ${esc(PARTS[miss].name.toLowerCase())} changes in every call. Everything after it would sit behind text that is different in every call, so it could never be reused. Still left to place before it: ${stableLeft.map(i => esc(PARTS[i].name.toLowerCase())).join(", ")}.`, false)
          : order.length ? kit.feedback(stableLeft.length ? `Good. ${stableLeft.length} stable ${stableLeft.length === 1 ? "part" : "parts"} still to place.` : "All the stable parts are placed. The parts that change go after them, in any order.") : ""}</div>`;
      el.querySelectorAll(`button.${P}-part`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (PARTS[i].changes && STABLE.some(j => !order.includes(j))) { miss = i; paint(); return; }
        miss = null; order.push(i); paint();
        if (order.length === PARTS.length) done();
      });
    };
    paint();
  }

  /* 4. Predict from the recorded usage log: which calls reused the prefix, and how much. */
  const CALLS4 = [
    { k: "good-1", label: "1 (fence)", right: 0, note: "The first call with the new layout.",
      say: ["", "No earlier call started with this text: the old layout began with the request time. The first call with a new start has nothing to reuse. It is the call that stores the prefix for the next ones.", "No earlier call shares even its first tokens: the old layout began with the request time, the new one with the instructions."] },
    { k: "good-2", label: "2 (shed)", right: 1, note: "A different homeowner and question.",
      say: [`Call 2 came ${secs("good-1", "good-2")} seconds after call 1, far shorter than any provider's cache lifetime, and it starts with the same text.`, "", `What differs between call 1 and call 2? Only the user message at the very end. The first ${fmt(SHARED.goodToGood)} tokens are identical.`] },
    { k: "good-3", label: "3 (basement)", right: 1, note: "Another homeowner and question.",
      say: ["Same start as calls 1 and 2, and only seconds later. The cache is still there.", "", "Only the request time, lot and question differ, and they sit at the end. Everything before them matches."] },
    { k: "amend-4", label: "4 (pool)", right: 2, note: `Just before this call, the city changed rule 9.2: a pool fence must now be 1.8 metres high, not 1.5. The changed digit is about ${fmt(SHARED.goodToAmend)} tokens into the prompt.`,
      say: [`Everything before the changed digit is still identical: about ${fmt(SHARED.goodToAmend)} tokens of instructions and rules. That part can still be reused.`, `The edit changes one digit in the middle of the rulebook. Everything after it now follows a different token, so it cannot be reused, even though its words did not change.`, ""] }
  ];
  const PRED = ["None of it", "Most of it", "Part of it"];
  function predictLog({ el, done, kit }) {
    style();
    const ans = CALLS4.map(() => null);
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== CALLS4[i].right);
      const shown = upto < 0 ? CALLS4.length : upto + 1;
      const fin = upto < 0;
      const am = LOG["amend-4"], g2 = LOG["good-2"];
      el.innerHTML = `<h1>Read the usage log</h1>
        <p class="lead">Four calls with the new layout, sent back to back. Each answer comes with usage numbers: <code>prompt_tokens</code> is every input token, <code>cached_tokens</code> is how many of them were reused.</p>
        <p class="task">For each call, predict how much of its prompt was reused before you see the number.</p>
        ${log(CALLS4.map((c, i) => [c.label, c.k, { hide: i >= shown || ans[i] !== c.right, on: i === shown - 1 && !fin }]), "The new layout: instructions, rulebook, format, then time, lot, question")}
        ${CALLS4.slice(0, shown).map((c, i) => `<div class="${P}-case" id="c${i}"><p>Call ${esc(c.label)}. ${esc(c.note)}</p>${kit.options(PRED, { picked: ans[i], correct: c.right })}${ans[i] == null ? "" : ans[i] === c.right
          ? kit.feedback(`${fmt(LOG[c.k].cached)} of ${fmt(LOG[c.k].prompt)} tokens reused.`, true)
          : kit.feedback(c.say[ans[i]], false)}</div>`).join("")}
        ${fin ? kit.feedback(`Look at call 4: <b>${fmt(am.cached)}</b> tokens reused, fewer than the roughly ${fmt(SHARED.goodToAmend)} tokens in front of the edit. Calls 2 and 3 reused ${fmt(g2.cached)}, a bit less than the ${fmt(SHARED.goodToGood)} and ${fmt(SHARED.good2ToGood3)} tokens they shared with the call before. Why? Providers store a prefix only at certain cut points (OpenAI's docs call them breakpoints). They reuse up to the last cut point before the first difference. So the count stops at or before the first change, never after it. That is why a rule that changes often belongs near the end, not in the middle.`) : ""}`;
      el.querySelectorAll(`.${P}-case`).forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CALLS4.every((cc, j) => ans[j] === cc.right)) done();
      }));
    };
    paint();
  }

  /* 5. Where the cache shows up: tap the field in a real usage block that proves the hit. */
  const G1 = LOG["good-1"], G2 = LOG["good-2"];
  const FIELDS = [
    { line: `"prompt_tokens": ${G2.prompt},`, say: `<code>prompt_tokens</code> counts every input token, reused or not. Call 1 had ${fmt(G1.prompt)} with nothing reused; call 2 has ${fmt(G2.prompt)}. It barely moves, so it cannot tell you about the cache.` },
    { line: `"completion_tokens": ${G2.out},`, say: "<code>completion_tokens</code> counts the answer the model wrote. The answer is written fresh on every call, cached or not." },
    { line: `"cost": ${G2.cost},`, say: "The cost did fall, but cost also moves with the length of the answer and with the price list. It does not tell you why it changed." },
    { line: "\"prompt_tokens_details\": {", brace: true },
    { line: `"cached_tokens": ${G2.cached},`, in1: true, right: true },
    { line: `"cache_write_tokens": ${G2.write}`, in1: true, say: `<code>cache_write_tokens</code> counts tokens stored into a new cache entry, which some providers charge extra for. It is ${LOG["good-1"].write} in every call of this run, even call 1, so this provider did not report writes. It says nothing about reuse.` }
  ];
  function readUsage({ el, done, kit }) {
    style();
    let pick = null;
    const paint = () => {
      const f = pick == null ? null : FIELDS[pick], ok = f && f.right;
      const share = pct(G2.cached, G2.prompt), half = G2.inCost / G1.inCost;
      el.innerHTML = `<h1>Where the cache shows up</h1>
        <p class="lead">This is the <code>usage</code> block that came back with call 2 (the shed question), trimmed to the fields that matter here. A teammate asks: "Did the cache work on this call?"</p>
        <p class="task">Tap the one field that answers that question.</p>
        <div class="${P}-json"><span class="brace">"usage": {</span>${FIELDS.map((x, i) => x.brace ? `<span class="brace">${esc(x.line)}</span>` : `<button type="button" class="${x.in1 ? "in1 " : ""}${pick === i ? (x.right ? "ok" : "no") : ""}" data-i="${i}">${esc(x.line)}</button>`).join("")}<span class="brace">} … }</span></div>
        <p class="${P}-cap">Recorded usage, ${REC_META.recordedAt}; other fields cut (…)</p>
        <div class="lpanel">${f == null ? "" : ok
          ? kit.feedback(`Right. <code>cached_tokens</code>: ${fmt(G2.cached)} of the ${fmt(G2.prompt)} input tokens, about ${share}%, were read from the cache. Those tokens are billed at a lower rate. In this run the input part of call 2 cost about ${pct(G2.inCost, G1.inCost)}% of call 1's${half < 0.75 ? ", roughly half" : ""} (prices on ${REC_META.recordedAt}). Log this field for every call: it is the only direct proof. Field names differ between APIs: Anthropic's API reports <code>cache_read_input_tokens</code> and <code>cache_creation_input_tokens</code> instead.`, true)
          : kit.feedback(f.say, false)}</div>`;
      el.querySelectorAll(`.${P}-json button`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (FIELDS[pick].right) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: a teammate adds the request time to the top of the system message. */
  const TS_LINES = [
    { where: "system message, line 1", t: "Request time: 2026-11-13 09:30:12", right: true },
    { where: "system message", t: INSTR, say: `The instructions are identical in all three calls, the same text that hit the cache before.` },
    { where: "system message", t: BOOK, say: `The rulebook is identical in all three calls and long enough (${fmt(PART_TOK.book)} tokens) to be cached. Something in front of it stops the match.` },
    { where: "user message", t: "Homeowner's lot: zone R1, 14 Alder Lane", say: "The lot changes every call, but it sits at the end. In the working layout it changed too, and the cache still hit." },
    { where: "user message", t: "Question: Can I build a 2 metre fence along my front yard?", say: "The question changes every call, but it sits at the end, after everything that could be reused. That was true when the cache worked, too." }
  ];
  const FIXES = [
    "Move the request time out of the system message, into the user message after the rulebook",
    "Shorten the rulebook so each call is cheaper anyway",
    "Send the calls closer together so the cache does not expire"
  ];
  function broken({ el, done, kit }) {
    style();
    let line = null, fix = null;
    const paint = () => {
      const lineOk = line != null && TS_LINES[line].right, fixOk = fix === 0;
      el.innerHTML = `<h1>Broken on purpose: the cache stopped working</h1>
        <p class="lead">A teammate wants the model to know today's date, for questions like "is my appeal still in time?". The teammate adds one line to the system message. After the change, the bill goes back up. Here is the log and the prompt of call 1 after the change (rulebook cut with …).</p>
        ${log([["1 (fence)", "ts-1"], ["2 (shed)", "ts-2"], ["3 (basement)", "ts-3"]], "After the teammate's change")}
        <div class="${P}-case" id="c0"><p class="task">Tap the line that makes every call miss the cache.</p>
        <div class="${P}-parts">${TS_LINES.map((x, i) => `<button type="button" class="${P}-part ${line === i ? (x.right ? "ok" : "no") : ""}" data-i="${i}"><span class="tag"><span>${esc(x.where)}</span></span><span class="t">${esc(x.t)}</span></button>`).join("")}</div>
        ${line == null ? "" : lineOk
          ? kit.feedback(`Right. The prompt now starts with a time that is new on every call. Calls 1 and 2 share only their first ${SHARED.tsToTs} tokens. Providers cache only prefixes above a minimum length, and ${SHARED.tsToTs} tokens is far below it. So <code>cached_tokens</code> is ${fmt(LOG["ts-2"].cached)} every time. The rulebook did not change at all.`, true)
          : kit.feedback(TS_LINES[line].say, false)}</div>
        ${lineOk ? `<div class="${P}-case" id="c1"><p class="task">Which change brings the cache back?</p>${kit.options(FIXES.map(esc), { picked: fix, correct: 0 })}
        ${fix == null ? "" : fixOk
          ? kit.feedback("Right. The date is still in the prompt, so the model still knows it, but it now sits after the rulebook, as it did in the working layout. Watch for anything that changes per call: a time, a user id, a request number, a list of examples shuffled each time.", true)
          : fix === 1 ? kit.feedback("A shorter rulebook would still start after a new time, so nothing would be reused, and the model would lose rules it needs to answer. The length is not the problem; the first line is.", false)
          : kit.feedback(`The calls were already ${secs("ts-1", "ts-2")} and ${secs("ts-2", "ts-3")} seconds apart, far shorter than any provider's cache lifetime. There was nothing to find: each prompt differs from the last one in its first line.`, false)}</div>` : ""}`;
      el.querySelectorAll(`#c0 button`).forEach(b => b.onclick = () => { line = +b.dataset.i; paint(); });
      el.querySelectorAll(`#c1 .lopts button`).forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 7. The big picture: what it is for, when not, what it costs; task: what caching changes and what it does not. */
  const EFFECTS = [
    { q: "The price of the input tokens that were reused", y: true,
      yes: `Yes. Reused tokens are billed at a lower rate; you saw call 2's input cost fall to about ${pct(G2.inCost, G1.inCost)}% of call 1's.`,
      no: `It does. You saw call 2's input cost fall to about ${pct(G2.inCost, G1.inCost)}% of call 1's: reused tokens are billed at a lower rate.` },
    { q: "The answer the model writes", y: false, ev: true,
      yes: "No. Caching skips re-reading the prompt; the model still writes a new answer. The two answers below are about the same basement question: one call reused the prefix, the other reused nothing. Both make the same mistake: rule 7.2 allows one basement apartment in R1, and both say it does not. Caching did not cause it and cannot fix it.",
      no: "Look at the two answers below, about the same basement question: one call reused the prefix, the other reused nothing. Both make the same mistake (rule 7.2 allows one basement apartment in R1). Caching skips re-reading the prompt; the model still writes a new answer." },
    { q: "The price of the output tokens", y: false,
      yes: "No. The answer is generated fresh on every call, so its tokens cost the same as before.",
      no: "Only the reading of the prompt is reused. The answer is generated fresh on every call, so its tokens cost the same." },
    { q: "How long until the first word of the answer arrives", y: true,
      yes: "Yes, it can drop: the provider skips the work on the reused part. The docs promise no fixed saving, so measure it.",
      no: "Reading a long prompt takes time, and a hit skips the reused part. It can make the first word arrive sooner. The docs promise no fixed saving, so measure it." }
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = EFFECTS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When prompt caching pays, and what it changes</h1>
        <div class="${P}-big"><ul>
          <li><b>What:</b> the provider reuses its reading work on the start of a prompt when a new call begins with the same tokens.</li>
          <li><b>For:</b> many calls in a short time that start with the same long text: a manual or rulebook, a long system prompt, tool definitions, a chat's history.</li>
          <li><b>When not:</b> (1) The shared start is short. Every provider has a minimum, from about 500 to about 4,000 tokens depending on provider and model (checked ${REC_META.recordedAt}). (2) Calls come further apart than the cache lifetime (often minutes), so the cache has expired. (3) The long part differs in every call. If the prompt is too long anyway, send only the rules that matter (retrieval, later in this unit).</li>
          <li><b>Cost:</b> a layout you must keep stable. Some APIs cache on their own; others need a field in the request that turns it on or marks where the cached part ends, and charge extra to write it.</li>
        </ul></div>
        <p class="task">Does a cache hit change each of these? Pick again if you change your mind.</p>
        ${EFFECTS.map((e, i) => `<div class="${P}-case" id="c${i}"><p>${esc(e.q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: e.y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (e.y ? 0 : 1) ? e.yes : e.no, ans[i] === (e.y ? 0 : 1))}${e.ev && ans[i] != null ? `${answer("good-3", `Call with ${fmt(LOG["good-3"].cached)} tokens reused (trimmed):`)}${answer("ts-3", `Call with ${fmt(LOG["ts-3"].cached)} tokens reused (trimmed):`)}` : ""}</div>`).join("")}`;
      el.querySelectorAll(`.${P}-case`).forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (EFFECTS.every((e, j) => ans[j] === (e.y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 8. Recognise it in new situations, with two firm "no" cases. */
  const CASES = [
    ["A support chatbot sends a 3,000-token product manual and the same tool definitions with every message. It handles hundreds of chats an hour.", true,
      "Yes. A long, identical start, sent many times a minute. Put the manual and the tools first and keep them byte-for-byte the same.",
      "This is the permit desk again: a long identical start sent many times a minute. Put the manual and the tools first and keep them unchanged."],
    ["A long chat: every turn resends the whole conversation so far, with the new message added at the end.", true,
      "Yes. Each turn's prompt starts with the previous turn's prompt, so the history is a prefix that grows. Never edit or reorder earlier turns, or the match breaks there.",
      "Look at what each turn sends: the previous turn's whole prompt, then something new at the end. That is a growing prefix, and it can be reused, as long as earlier turns are never edited or reordered."],
    ["An FAQ bot gets the exact same question from many users. The team wants repeats to skip the model and come back instantly.", false,
      "No. Prompt caching only skips re-reading the prompt; the model still writes a new answer every time, with its full output cost and wait. To skip the model, store the finished answer keyed by the question (a response cache) and decide how long a stored answer may be served.",
      "Prompt caching does not store answers. It skips re-reading the prompt, then the model writes a new answer, with its full output cost and wait. Skipping the model needs a response cache: the finished answer, stored by question."],
    ["A county office tool sends a 6,000-token policy document with each question. It gets about three questions a day.", false,
      "No. The start repeats, but hours pass between calls, and by default a cache usually lives from a few minutes to about half an hour after its last use. Almost every call would find the cache gone. A longer lifetime can be bought on some APIs, at a price; or send only the relevant part of the policy.",
      "The start does repeat, but by default a cache usually lives from a few minutes to about half an hour after its last use, and these calls are hours apart. Each call would find it gone and pay full price."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would prompt caching help here?</h1>
        <p class="lead">${["Zero", "One", "Two", "Three", "Four", "Five"][CASES.length] || CASES.length} situations away from the permit desk.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="${P}-case" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(`.${P}-case`).forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next. Done on entry. */
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">You can split a prompt into the part that stays the same and the part that changes, put the stable part first, and prove from <code>cached_tokens</code> that the cache was hit. You know that one changing line at the top undoes it, and that caching saves on reading the prompt, not on the answer.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. Tool definitions are sent with every call too, so the same rule holds for them: keep them unchanged, in the same order, near the start.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Prompt caching: putting the stable part first",
    checked: "2026-11-13",
    sources: [
      "https://developers.openai.com/api/docs/guides/prompt-caching",
      "https://platform.claude.com/docs/en/build-with-claude/prompt-caching",
      "https://aistudio.google.com/docs/caching",
      "https://openrouter.ai/docs/features/prompt-caching",
      "https://docs.vllm.ai/en/latest/design/prefix_caching.html",
      "https://arxiv.org/abs/1706.03762"
    ],
    interview: [{
      q: "Your assistant sends a 10,000-token policy document with every request, and most of the bill is input tokens. The provider supports prompt caching, but the usage logs show cached tokens at zero on almost every call. How do you find out why?",
      good: [
        "Diff two consecutive prompts token by token and find the first difference: a timestamp, a user id, a request id or shuffled examples near the top",
        "Move everything that changes per call after the stable document; keep tool definitions and system text byte-for-byte the same",
        "Check the traffic pattern against the cache lifetime: calls further apart than the cache lifetime find it gone",
        "Check the stable part is above the provider's minimum cacheable length, and that the calls go to the same model",
        "Confirm the fix with the cached-tokens field on every call, and track the hit rate over a day"
      ],
      weak: "Shorten the document or switch to a cheaper model, without checking where consecutive prompts start to differ."
    }],
    screens: [situation, spotIdea, reorder, predictLog, readUsage, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="3"]'], right: CHANGING.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${CHANGING[0]}"]`], right: [...STABLE, ...CHANGING].map(i => `[data-i="${i}"]`) },
      { wrong: ["#c0 [data-wrong]"], right: CALLS4.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ['[data-i="0"]'], right: [`[data-i="${FIELDS.findIndex(f => f.right)}"]`] },
      { wrong: ['#c0 [data-i="4"]'], right: [`#c0 [data-i="${TS_LINES.findIndex(x => x.right)}"]`, "#c1 [data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: EFFECTS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
