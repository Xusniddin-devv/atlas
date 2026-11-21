/* Lesson s5a-few-shot: Few-shot examples and how to pick them.
   Story: a plumbing company sorts incoming job requests into leak, blockage, water heater and fitting from the
   customer's message alone. Nadia, the dispatcher, labels by habit; the model does not know her habits.
   Ideas: (1) examples show the model where your labels' borders are, so pick ones that look like the new request
   and do not all carry one label; (2) a one-sided example set pulls answers and makes them fragile.
   Depth: explain (screens 1-4, 8, 9), debug (screen 5: the colleague's example builder), scratch (screen 7:
   pick_examples in plain Python, stepped from a real trace).
   Data: POOL, TESTS and STOP are copied from docs/ai-path/runs/s5a-few-shot/plumbing.py (written for the lesson,
   not model output). Model answers and token counts are copied from the recordings in
   docs/ai-path/recordings/s5a-few-shot/ (v2-zero-t*, v2-lop-t*, v2-bal-t*, v2-sim-t*, v3-lop-t10, rule-t5, rule-t9), made
   with scripts/ai/record.mjs from the request files in docs/ai-path/runs/s5a-few-shot/requests/.
   The code screen replays docs/ai-path/runs/s5a-few-shot/trace_pick.out.txt; the broken script and its output are
   colleague_examples.py and colleague_examples.out.txt in the same folder.
   Every count, ratio and score on screen is computed here from that data. Lesson-local CSS: request cards, a
   prompt view, a recorded-answer block and a clickable code listing, in <style id="lx-s5a-few-shot">. */
(() => {
  const P = "lx-s5a-few-shot";
  const REC_DATE = "2026-11-13";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const LABELS = ["leak", "blockage", "water heater", "fitting"];

  // The dispatcher's sheet of past jobs, grouped by label in her order (plumbing.py POOL).
  const POOL = [
    ["Pipe under the kitchen sink is dripping, puddle in the cupboard.", "leak"],
    ["Water dripping through the ceiling below the bathroom.", "leak"],
    ["Outside tap keeps leaking even when turned off hard.", "leak"],
    ["Small puddle under the bathroom sink every morning, pipe joint is wet.", "leak"],
    ["Radiator valve is weeping water onto the floor.", "leak"],
    ["Kitchen sink will not drain, water just sits there.", "blockage"],
    ["Toilet water rises to the top when flushed, then goes down slowly.", "blockage"],
    ["Shower drain backs up and the tray fills with water.", "blockage"],
    ["Bad smell and gurgling from the bath plughole, drains very slowly.", "blockage"],
    ["Water comes back up through the outside drain when it rains.", "blockage"],
    ["No hot water since this morning, boiler shows an error code.", "water heater"],
    ["Hot water cylinder is dripping from the valve at the bottom.", "water heater"],
    ["Water heater makes loud banging noises while heating.", "water heater"],
    ["Hot water runs out after two minutes in the shower.", "water heater"],
    ["Boiler keeps losing pressure, I top it up every day.", "water heater"],
    ["Need a new mixer tap fitted in the kitchen, already bought it.", "fitting"],
    ["Want the old toilet replaced with a new one.", "fitting"],
    ["Please connect a new dishwasher under the kitchen counter.", "fitting"],
    ["Moving the washing machine, need pipes run to the utility room.", "fitting"],
    ["Install an outside tap on the back wall of the house.", "fitting"]
  ];
  // New requests the model was asked about, with Nadia's label (plumbing.py TESTS + the patio request, build_v2.py).
  const TESTS = [
    ["Puddle under the hot water cylinder in the airing cupboard, the pipe at the bottom is wet.", "water heater"],
    ["When the washing machine empties, dirty water comes up out of the shower drain.", "blockage"],
    ["The old bathroom tap drips, I have bought a new one, please put it in.", "fitting"],
    ["Toilet water nearly reaches the rim after a flush, then slowly drops.", "blockage"],
    ["Boiler pressure keeps dropping and there is a wet patch on the floor under it.", "water heater"],
    ["Brown stain growing on the kitchen ceiling under the bathroom.", "leak"],
    ["Hot water is only lukewarm and the cylinder takes hours to heat.", "water heater"],
    ["Want the dishwasher moved to the other side of the kitchen with new pipes.", "fitting"],
    ["Puddle on the floor under the boiler, dripping from a pipe underneath.", "water heater"],
    ["Water pools on the patio next to the outside wall of the house.", "leak"]
  ];
  const T_CYL = 0, T_DRAIN = 1, T_BOILER = 4, T_STAIN = 5, T_UNDER = 8, T_PATIO = 9;

  // Recorded model output: openrouter, google/gemini-2.5-flash-lite, temperature 0, recorded 2026-11-13.
  // Each entry i is choices[0].message.content of docs/ai-path/recordings/s5a-few-shot/v2-<set>-t<i+1>.json, unaltered.
  const REC = {
    src: "s5a-few-shot/v2-{zero,lop,bal,sim}-t1..t10", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
    zero: ["water heater", "blockage", "fitting", "Blockage", "leak", "leak", "water heater", "fitting", "leak", "leak"],
    lop: ["leak", "blockage", "fitting", "blockage", "leak", "leak", "water heater", "fitting", "leak", "blockage"],
    bal: ["water heater", "blockage", "fitting", "blockage", "water heater", "leak", "water heater", "fitting", "leak", "leak"],
    // sim: the four most similar past jobs with no cap per label (v2-sim-t*)
    sim: ["water heater", "blockage", "fitting", "blockage", "water heater", "leak", "water heater", "fitting", "leak", "leak"],
    // usage.prompt_tokens of the same recordings
    tokens: {
      zero: [53, 50, 51, 47, 49, 44, 46, 48, 48, 47],
      lop: [148, 145, 146, 142, 144, 139, 141, 143, 143, 142],
      bal: [127, 120, 114, 123, 123, 108, 115, 117, 122, 115]
    }
  };
  // s5a-few-shot/v3-lop-t10: the colleague's same five blockage rows, in another order (build_v2.py --shuffled)
  const REC_REORDERED = { src: "s5a-few-shot/v3-lop-t10", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE, text: "leak",
    order: [8, 6, 5, 9, 7] };
  // s5a-few-shot/rule-t5 and rule-t9: no examples, the house rule written into the instruction (build_rule.py)
  const REC_RULE = { src: "s5a-few-shot/rule-t5, rule-t9", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
    rule: "House rule: anything coming from the boiler or the hot water cylinder is water heater, even a drip or a puddle under it.",
    answers: { 4: "water heater", 8: "water heater" } };
  const INSTRUCTION = "You sort job requests for a plumbing company into one of four labels: leak, blockage, water heater, fitting. Reply with the label only.";

  /* The picker, the same as plumbing.py: content words shared with the new request, most first, at most
     per_label of a label, k in all. Sorting is stable in both languages, so ties keep the sheet's order. */
  const STOP = new Set(("a an the is are was be been it its i im we my our you your there theres this that these those " +
    "and or but so then to of in on at by for from with as up out into onto when while after before every even " +
    "just very only have has had do does not will please need want can keeps water").split(" "));
  const words = t => new Set((t.toLowerCase().match(/[a-z]+/g) || []).filter(w => !STOP.has(w)));
  const shared = (a, b) => { const B = words(b); return [...words(a)].filter(w => B.has(w)); };
  const scoreAll = req => POOL.map(([t, l], i) => ({ i, t, l, s: shared(req, t).length })).sort((x, y) => y.s - x.s);
  function pick(req, k = 4, per = 2) {
    const got = [], count = {};
    for (const r of scoreAll(req)) {
      if ((count[r.l] || 0) < per) { got.push(r); count[r.l] = (count[r.l] || 0) + 1; }
      if (got.length === k) break;
    }
    return got;
  }
  // the colleague's script: sort by label (alphabetical, stable), top five rows
  const LOP = POOL.map((r, i) => [...r, i]).sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0).slice(0, 5);

  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const listAnd = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  // the four closest with no cap per label: the "sim" recordings
  const pickNoCap = (req, k = 4) => scoreAll(req).slice(0, k);
  const sameSet = (a, b) => a.map(r => r.i).sort().join() === b.map(r => r.i).sort().join();
  const SIM_DIFF = TESTS.filter(([t]) => !sameSet(pick(t), pickNoCap(t))).length;
  const SIM_SAME_ANS = TESTS.every((_, t) => same(REC.sim[t], REC.bal[t]));
  const capNote = () => SIM_SAME_ANS
    ? `We also recorded the four closest past jobs without the limit of two per label. That set differed from the picked four on ${SIM_DIFF} of the ${TESTS.length} requests, yet every answer came out the same. So in this run, closeness is what helped. The limit protects you from a one-sided set like the colleague's, but here it did not change any answer.`
    : `We also recorded the four closest past jobs without the limit of two per label. Some answers differed from the picked four.`;

  function style() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
.${P}-rules { margin: 14px 0 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: 10px; }
.${P}-rules li { padding: 8px 12px; border-top: 1px solid var(--line); font-size: 15.5px; }
.${P}-rules li:first-child { border-top: 0; }
.${P}-rules b { font-family: var(--mono); font-size: 14px; }
.${P}-reqs { display: grid; gap: 8px; margin-top: 14px; }
.${P}-req { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; align-items: start; width: 100%; min-height: 48px; padding: 8px 12px;
  text-align: left; font: 500 15.5px/1.4 var(--font); color: var(--ink); background: var(--bg); border: 1.5px solid var(--line); border-radius: 10px; }
button.${P}-req { cursor: pointer; }
button.${P}-req:hover { border-color: var(--ink); }
.${P}-lab { font: 600 13px var(--mono); color: var(--muted); white-space: nowrap; }
.${P}-sub { grid-column: 1 / -1; font: 500 13.5px var(--mono); color: var(--muted); }
.${P}-req.on { border-color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
.${P}-req.ok { border-color: var(--good); background: var(--good-soft); }
.${P}-req.no { border-color: var(--bad); background: var(--bad-soft); }
.${P}-req.gone { opacity: .45; }
.${P}-new { margin-top: 14px; padding: 10px 12px; border-left: 3px solid var(--ink); background: var(--surface); font-size: 16px; }
.${P}-new small { display: block; font: 600 12px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.${P}-prompt { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; font-size: 14.5px; overflow: hidden; }
.${P}-prompt > div { padding: 7px 12px; border-top: 1px solid var(--line); display: grid; grid-template-columns: 74px 1fr; gap: 10px; }
.${P}-prompt > div:first-child { border-top: 0; }
.${P}-prompt .who { font: 600 12px var(--mono); color: var(--muted); text-transform: uppercase; padding-top: 2px; }
.${P}-prompt .ask { background: var(--sunk); }
.${P}-rec { margin-top: 12px; padding: 10px 12px; border: 1.5px solid var(--ink-2); border-radius: 10px; font: 600 17px var(--mono); }
.${P}-rec small { display: block; margin-top: 4px; font: 500 12px var(--mono); color: var(--muted); }
.${P}-code { margin: 14px 0 0; padding: 10px 0; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r, 10px); overflow-x: auto; }
.${P}-code > div { min-width: max-content; }
.${P}-code button { display: block; width: 100%; min-height: 44px; padding: 0 12px; border: 0; border-left: 3px solid transparent; background: none;
  color: inherit; font: 500 13.5px/44px var(--mono); text-align: left; white-space: pre; cursor: pointer; }
.${P}-code button i { font-style: normal; opacity: .55; margin-right: 12px; }
.${P}-code button:hover { background: color-mix(in srgb, var(--code-ink) 10%, var(--code-bg)); }
.${P}-code button.ok { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--code-bg)); }
.${P}-code button.no { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--code-bg)); }
.${P}-out { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 8px; font: 500 13px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}-score { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 15px; }
.${P}-score td, .${P}-score th { padding: 6px 8px; border-top: 1px solid var(--line); text-align: left; }
.${P}-score th { font: 600 12px var(--mono); color: var(--muted); text-transform: uppercase; }
.${P}-score td.n { font-family: var(--mono); text-align: right; white-space: nowrap; }
.${P}-mini { font: 500 13.5px var(--mono); color: var(--muted); margin-top: 6px; }
`;
    document.head.appendChild(s);
  }
  const recBlock = (kit, text, note) => `<div class="${P}-rec">${kit.esc(text)}<small>Recorded model output, ${REC_DATE}${note ? ` · ${kit.esc(note)}` : ""}</small></div>`;
  const newReq = (kit, text, tag = "New request") => `<div class="${P}-new"><small>${kit.esc(tag)}</small>${kit.esc(text)}</div>`;
  const promptView = (kit, examples, ask) => `<div class="${P}-prompt">
      <div><span class="who">system</span><span>${kit.esc(INSTRUCTION)}</span></div>
      ${examples.map(([t, l]) => `<div><span class="who">user</span><span>Request: ${kit.esc(t)}</span></div><div><span class="who">assistant</span><span><b>${kit.esc(l)}</b></span></div>`).join("")}
      <div class="ask"><span class="who">user</span><span>Request: ${kit.esc(ask)}</span></div></div>`;

  /* 1. The situation: a model with no examples, and Nadia's habits. Find the answers she would change. */
  const S1_SHOW = [T_CYL, T_BOILER, T_STAIN, T_UNDER, 2, 7];
  const S1_BAD = S1_SHOW.filter(t => !same(REC.zero[t], TESTS[t][1]));
  function situation({ el, done, kit }) {
    style();
    const flagged = new Set();
    let miss = null, missAt = null;
    const paint = () => {
      const found = S1_BAD.every(t => flagged.has(t)) && flagged.size === S1_BAD.length;
      el.innerHTML = `<h1>Sorting plumbing jobs by the message alone</h1>
        <p class="lead">A plumbing company gets job requests as short messages. Nadia, the dispatcher, sorts each one into one of four labels so the right plumber goes out with the right van. The company wants a model to do the first sort. Nadia sorts by habit. We asked her to put her habits into words, and she gave four:</p>
        <ul class="${P}-rules">
          <li><b>leak</b>: water escaping from a pipe, tap, joint or radiator that is already in place.</li>
          <li><b>blockage</b>: water will not drain away, or comes back up out of a drain.</li>
          <li><b>water heater</b>: anything coming from the boiler or the hot water cylinder, even a drip or a puddle under it.</li>
          <li><b>fitting</b>: putting in, replacing or moving a tap, toilet or appliance.</li>
        </ul>
        <p class="lead" style="margin-top:12px">She has many more habits she has never written down. The model was given only the four label names and asked about ${WORDS[S1_SHOW.length].toLowerCase()} requests.</p>
        <p class="task">Tap every answer Nadia would change. Tap again to unmark one.</p>
        <div class="${P}-reqs">${S1_SHOW.map(t => {
          const c = flagged.has(t) ? "ok" : missAt === t ? "no" : "";
          return `<button type="button" class="${P}-req ${c}" data-i="${t}"><span>${kit.esc(TESTS[t][0])}</span><span class="${P}-lab">model: ${kit.esc(REC.zero[t])}</span></button>`;
        }).join("")}</div>
        <p class="${P}-mini">Recorded model output, ${REC_DATE}. A small hosted model answered each request on its own.</p>
        <div class="lpanel">${found
          ? kit.feedback(`Right. Both times the model saw water on the floor and said <b>leak</b>. By Nadia's habit, water from the boiler or cylinder is <b>water heater</b>, because a different plumber with different parts goes out. The model cannot know a habit nobody showed it. This habit she could write down, and screen 8 comes back to it. But most of her habits she cannot put into words. For those she has a sheet of past jobs she already labelled.`, true)
          : miss ? kit.feedback(miss, false) : ""}</div>`;
      el.querySelectorAll(`.${P}-req`).forEach(b => b.onclick = () => {
        const t = +b.dataset.i;
        miss = null; missAt = null;
        if (flagged.has(t)) flagged.delete(t);
        else if (S1_BAD.includes(t)) flagged.add(t);
        else {
          missAt = t;
          miss = `The model said <b>${kit.esc(REC.zero[t])}</b>, and that is Nadia's label too: ${t === T_CYL ? "it comes from the hot water cylinder" : t === T_STAIN ? "a pipe above the ceiling is letting water out, and nothing here is the boiler or the cylinder" : t === 2 ? "the customer wants a new tap put in; the drip is the reason, not the job" : "something is being moved and connected"}. Nadia would keep it.`;
        }
        paint();
        if (S1_BAD.every(x => flagged.has(x)) && flagged.size === S1_BAD.length) done();
      });
    };
    paint();
  }

  /* 2. By hand: pick three past jobs to show the model as examples for a new request. */
  const S2_REQ = TESTS[T_DRAIN][0], S2_K = 3;
  const S2_SCORE = POOL.map(([t]) => shared(S2_REQ, t));
  const S2_PICKER = pick(S2_REQ, S2_K).map(r => r.i);
  function byHand({ el, done, kit }) {
    const picked = [];
    const paint = () => {
      const full = picked.length === S2_K;
      const zero = picked.filter(i => !S2_SCORE[i].length);
      const labs = new Set(picked.map(i => POOL[i][1]));
      const ok = full && !zero.length && labs.size > 1;
      let fb = "";
      if (full && zero.length) fb = kit.feedback(`${zero.length === 1 ? "This example has" : "These examples have"} nothing in common with the new request: ${zero.map(i => `“${kit.esc(POOL[i][0])}”`).join(" ")} An example like that shows a label, but says nothing about where the border runs for <i>this kind</i> of message. Tap a marked card to drop it, and look for past jobs that talk about the same things: a drain, water coming up, a washing machine.`, false);
      else if (full && labs.size === 1) fb = kit.feedback(`All three of your examples say <b>${kit.esc(POOL[picked[0]][1])}</b>. Before the model even reads the new request, the examples have already voted. It never sees what a nearby job with a different label looks like. Tap a card to drop it and add a close one with another label.`, false);
      else if (ok) fb = kit.feedback(`Good set. Each example shares words with the new request (they are listed under each card), and they do not all carry one label. ${picked.some(i => POOL[i][1] !== "blockage") ? "The one with a different label is a useful contrast: it looks close but belongs elsewhere, so it shows the model where the border is." : ""} The picker on screen 7, asked for ${WORDS[S2_K].toLowerCase()}, picks these: ${listAnd(S2_PICKER.map(i => `“${kit.esc(POOL[i][0].replace(/\.$/, ""))}”`))}.`, true);
      el.innerHTML = `<h1>Pick the examples by hand</h1>
        <p class="lead">You can put a few of Nadia's past jobs into the prompt, each with her label, before the new request. These are <b>examples</b>. The sheet has ${POOL.length}. Sending all of them on every call would make each prompt long and costly, so you send a few. Which few you choose changes the answers, and this lesson is about choosing them.</p>
        ${newReq(kit, S2_REQ)}
        <p class="task">Pick ${WORDS[S2_K].toLowerCase()} past jobs that would help the model label this request the way Nadia would. Tap a card again to drop it. Once you have ${WORDS[S2_K].toLowerCase()}, a new tap replaces your oldest pick.</p>
        <div class="${P}-reqs">${POOL.map(([t, l], i) => {
          const on = picked.includes(i);
          const c = on ? (full ? (ok ? "ok" : (zero.includes(i) || labs.size === 1) ? "no" : "on") : "on") : full ? "gone" : "";
          return `<button type="button" class="${P}-req ${c}" data-i="${i}" aria-pressed="${on}"><span>${kit.esc(t)}</span><span class="${P}-lab">${kit.esc(l)}</span>${full && on ? `<span class="${P}-sub">shared words: ${S2_SCORE[i].length ? kit.esc(S2_SCORE[i].join(", ")) : "none"}</span>` : ""}</button>`;
        }).join("")}</div>
        <div class="lpanel"><div class="vars"><span>picked <b>${picked.length} / ${S2_K}</b></span></div>${fb}</div>`;
      el.querySelectorAll(`.${P}-req`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i, at = picked.indexOf(i);
        if (at >= 0) picked.splice(at, 1);
        else { if (picked.length === S2_K) picked.shift(); picked.push(i); }
        paint();
        if (picked.length === S2_K && !picked.some(j => !S2_SCORE[j].length) && new Set(picked.map(j => POOL[j][1])).size > 1) done();
      });
    };
    paint();
  }

  /* 3. Predict: the colleague's five examples, all blockage, and the patio request. */
  const PATIO = TESTS[T_PATIO];
  const LOP_LAB = LOP[0][1];
  function predictLopsided({ el, done, kit }) {
    let ans = null;
    const right = LABELS.indexOf(REC.lop[T_PATIO].trim().toLowerCase());
    const say = i => {
      const l = LABELS[i];
      if (same(l, REC.zero[T_PATIO])) return `That is what the model answered with no examples, and it is Nadia's label. But these five examples were in front of it this time, and it changed its answer.`;
      if (l === "water heater") return `Nothing in the request or in the five examples mentions a boiler or a cylinder. The answer moved, but not there.`;
      if (l === "fitting") return `No example and nothing in the request is about putting something in. The answer moved, but not there.`;
      return "";
    };
    const paint = () => {
      const ok = ans === right;
      el.innerHTML = `<h1>A colleague's five examples</h1>
        <p class="lead">A colleague added examples before you did. His script sorted Nadia's sheet by label and took the top ${WORDS[LOP.length].toLowerCase()} rows. Asked with <b>no</b> examples, the model labelled the patio request <b>${kit.esc(REC.zero[T_PATIO])}</b>. Nadia called the customer back: an outside pipe had cracked, so <b>${kit.esc(PATIO[1])}</b> is right.</p>
        <p class="lead">Below is the prompt with his examples. Each example is a past request as a <i>user</i> turn, then Nadia's label as an <i>assistant</i> turn, as if the model had already answered it. The new request comes last.</p>
        ${promptView(kit, LOP, PATIO[0])}
        <p class="task">The same small model got this prompt. Predict its answer.</p>
        <div class="lpanel">${kit.options(LABELS.map(l => kit.esc(l)), { picked: ans, correct: right })}
        ${ans == null ? "" : ok
          ? `${recBlock(kit, REC.lop[T_PATIO], "with the five examples above")}${kit.feedback(`Yes: <b>${kit.esc(REC.lop[T_PATIO])}</b>. Five examples, each labelled correctly, and the answer got worse. The next screen asks why.`, true)}`
          : kit.feedback(say(ans), false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: why did correct examples make it worse? */
  const PATIO_PICK = pick(PATIO[0]);
  const LOP_FLIPS = TESTS.map((_, t) => t).filter(t => same(REC.zero[t], TESTS[t][1]) && !same(REC.lop[t], TESTS[t][1]));
  function spotIdea({ el, done, kit }) {
    let ans = null;
    const avgLop = Math.round(mean(REC.tokens.lop)), avgBal = Math.round(mean(REC.tokens.bal));
    const opts = [
      `Every example says ${kit.esc(LOP_LAB)}, so they pulled the answer toward the only label they showed.`,
      `Some of the five rows carry the wrong label, so the model learned a wrong border.`,
      `Five examples made the prompt too long, so the small model lost track of the request.`
    ];
    const paint = () => {
      const ok = ans === 0;
      el.innerHTML = `<h1>Correct examples, worse answer</h1>
        <p class="lead">The colleague's five rows are real jobs with Nadia's own labels. His script sorted the sheet by label, A to Z, so <i>${kit.esc(LOP_LAB)}</i> came to the top.</p>
        <p class="task">Why did these five examples turn a right answer into a wrong one?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The examples are the model's only evidence about Nadia's habits. A set with one label teaches nothing about the borders between labels, and pulls borderline requests toward that label. That is what <b>few-shot prompting</b> is: a few examples in the prompt, and the model follows their pattern, with no training. Two more things from the recordings:
            <br>• The <b>same five rows in another order</b> gave a different answer (first box below). A one-sided set does not pull the answer the same way every time; it makes the answer fragile. Research on few-shot prompts found the same: the choice and even the order of examples can swing accuracy a lot.
            <br>• Four examples picked for this request (close to it, and at most two of any label): ${PATIO_PICK.map(r => `${kit.esc(r.l)}`).join(", ")}. The model's answer is in the second box.`, true)
            + recBlock(kit, REC_REORDERED.text, "the same five rows, another order")
            + recBlock(kit, REC.bal[T_PATIO], "with the picked four")
          : ans === 1 ? kit.feedback(`Each row is a real ${kit.esc(LOP_LAB)} job: water that will not go down or comes back up a drain. The labels are right. What is wrong is the mix: all five carry the same label.`, false)
          : kit.feedback(`The colleague's prompts used about ${avgLop} input tokens on average (from the recordings), and the picked four about ${avgBal}. Both are tiny for this model. Length is not the problem; the label mix is: every example says ${kit.esc(LOP_LAB)}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 5. Broken on purpose: the colleague's example builder. Find the line, then the fix. */
  const BROKEN = [
    "def build_examples(past_jobs):",
    "    rows = list(past_jobs)",
    "    rows.sort(key=lambda row: row[1])  # tidy the sheet by label",
    "    examples = rows[:5]",
    "    return examples"
  ];
  const BROKEN_LINE = 2;
  // colleague_examples.out.txt, unaltered
  const BROKEN_OUT = [
    "blockage  | Kitchen sink will not drain, water just sits there.",
    "blockage  | Toilet water rises to the top when flushed, then goes down slowly.",
    "blockage  | Shower drain backs up and the tray fills with water.",
    "blockage  | Bad smell and gurgling from the bath plughole, drains very slowly.",
    "blockage  | Water comes back up through the outside drain when it rains."
  ];
  function broken({ el, done, kit }) {
    let line = null, fix = null;
    const top5 = [...new Set(POOL.slice(0, 5).map(r => r[1]))];
    const say = {
      0: `Line 0 only names the function and its input, the sheet of past jobs. Nothing is chosen there.`,
      1: `Line 1 copies the sheet into a list, in Nadia's order. Her sheet has all four labels, so the copy still has all four.`,
      3: `Line 3 takes the top five rows. That gives a mix only if the rows above are mixed. Something before it decided what is on top.`,
      4: `Line 4 hands back what was already chosen.`
    };
    const fixes = [
      `Pick per request: score every past job by the words it shares with the new request, take the best, at most two of any label.`,
      `Delete line 2 and keep <code>rows[:5]</code>.`,
      `Change line 3 to <code>rows[:${POOL.length}]</code>, so every past job is an example.`
    ];
    const paint = () => {
      const lineOk = line === BROKEN_LINE, fixOk = fix === 0;
      el.innerHTML = `<h1>Find the line that made it one-sided</h1>
        <p class="lead">Here is the colleague's real script, with line numbers, and what it printed when we ran it on Nadia's sheet (each row is a label and a request). On a phone, the code scrolls sideways.</p>
        <div class="${P}-code" id="code"><div>${BROKEN.map((c, i) => `<button type="button" data-i="${i}" class="${line === i ? (lineOk ? "ok" : "no") : ""}" aria-label="line ${i}"><i>${i}</i>${kit.esc(c)}</button>`).join("")}</div></div>
        <pre class="${P}-out">${kit.esc(BROKEN_OUT.join("\n"))}</pre>
        <p class="task">${lineOk ? "Now pick the fix." : "Tap the line that makes all five examples share one label."}</p>
        <div class="lpanel">${line == null ? "" : lineOk
          ? kit.feedback(`Yes, line 2. Sorting by the label puts the rows in A to Z order of label, and <i>${kit.esc(LOP_LAB)}</i> comes first, so the top five are all ${kit.esc(LOP_LAB)}. The deeper problem: the five are chosen by their place in the sheet. The new request never takes part in the choice.`, true)
          : kit.feedback(say[line], false)}
        ${lineOk ? `<div id="fix">${kit.options(fixes, { picked: fix, correct: 0 })}</div>${fix == null ? "" : fixOk
          ? kit.feedback(`Right. The choice now depends on the request: close examples, and more than one label among them. That is what the picked four on the last screen were.`, true)
          : fix === 1 ? kit.feedback(`Nadia's sheet is grouped by label, so without the sort the top five are ${top5.length === 1 ? `all ${kit.esc(top5[0])}` : listAnd(top5.map(kit.esc))}: just as one-sided. And the same five rows would go with every request, however unlike it they are.`, false)
          : kit.feedback(`All four labels would appear, but every call would carry ${POOL.length} examples instead of 4: about ${Math.round(POOL.length / 4)} times as many, paid for on every request. The sheet will grow to hundreds of rows. And most of them have nothing to do with the request.`, false)}` : ""}</div>`;
      el.querySelectorAll("#code button").forEach(b => b.onclick = () => { if (line === BROKEN_LINE) return; line = +b.dataset.i; fix = null; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 6. Use it, with predictions: which example sets got Nadia's label? */
  const SETS = [["zero", "no examples"], ["lop", "the colleague's five"], ["bal", "the picked four"]];
  const U_CASES = [T_BOILER, T_CYL, T_UNDER];
  const U_OPTS = [
    { text: "All three", right: ["zero", "lop", "bal"] },
    { text: "Only the picked four", right: ["bal"] },
    { text: "No examples and the picked four, not the colleague's five", right: ["zero", "bal"] },
    { text: "None of them", right: [] }
  ];
  const rightSets = t => SETS.map(([k]) => k).filter(k => same(REC[k][t], TESTS[t][1]));
  const U_CORRECT = U_CASES.map(t => U_OPTS.findIndex(o => o.right.join() === rightSets(t).join()));
  function useIt({ el, done, kit }) {
    const ans = U_CASES.map(() => null);
    const paint = () => {
      const all = U_CASES.every((_, j) => ans[j] === U_CORRECT[j]);
      const score = k => TESTS.filter((r, t) => same(REC[k][t], r[1])).length;
      const caps = REC.zero.filter((a, t) => a !== TESTS[t][1] && same(a, TESTS[t][1]));
      const allExact = ["lop", "bal"].every(k => REC[k].every(a => LABELS.includes(a)));
      const avg0 = mean(REC.tokens.zero);
      el.innerHTML = `<h1>Predict, then check the recordings</h1>
        <p class="lead">The same small model labelled ${TESTS.length} new requests three ways: with ${SETS.map(s => s[1]).join(", with ")}. The picked four were chosen for each request: the closest past jobs, at most two of any label.</p>
        <p class="task">For each request, predict which ways got Nadia's label. Pick again if you change your mind.</p>
        ${U_CASES.map((t, j) => {
          const ok = ans[j] === U_CORRECT[j];
          const said = SETS.map(([k, n]) => `${n}: <b>${kit.esc(REC[k][t])}</b>`).join("; ");
          return `<div class="lcase" id="c${j}"><p>${kit.esc(TESTS[t][0])}</p><div class="${P}-mini">Nadia: ${kit.esc(TESTS[t][1])} · picked four: ${pick(TESTS[t][0]).map(r => kit.esc(r.l)).join(", ")}</div>
            ${kit.options(U_OPTS.map(o => kit.esc(o.text)), { picked: ans[j], correct: U_CORRECT[j] })}
            ${ans[j] == null ? "" : kit.feedback(`${ok ? "Right." : "Not this one."} The recordings: ${said}.${!ok && t === T_UNDER ? " Close examples were not enough here: the two most similar past jobs are leaks with puddles under pipes." : ""}`, ok)}</div>`;
        }).join("")}
        ${all ? `<table class="${P}-score"><thead><tr><th>examples</th><th>same as Nadia</th><th>input tokens per call</th></tr></thead><tbody>
          ${SETS.map(([k, n]) => `<tr><td>${n}</td><td class="n">${score(k)} / ${TESTS.length}</td><td class="n">about ${Math.round(mean(REC.tokens[k]))}</td></tr>`).join("")}</tbody></table>
          ${kit.feedback(`Recorded model output, ${REC_DATE}. The picked four did best, the one-sided five worst. ${capNote()} Two costs show too. The picked prompts were about ${(mean(REC.tokens.bal) / avg0).toFixed(1)} times as long as the bare instruction, on every call. And examples also set the <i>form</i> of the answer: without them, ${caps.length === 1 ? "one answer" : plural(caps.length, "answer")} came back as “${kit.esc(caps[0] || "")}” with a capital, which breaks code that compares strings exactly; with either example set, ${allExact ? "every answer was one of the four labels written exactly" : "most answers were written exactly"}. One request beat every set; screen 8 comes back to it.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, j) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[j] = +b.dataset.i; paint();
        if (U_CASES.every((_, x) => ans[x] === U_CORRECT[x])) done();
      }));
    };
    paint();
  }

  /* 7. The picker from scratch, in Python, stepped from a real trace (trace_pick.out.txt). */
  const CODE = [
    "def pick_examples(new_request, pool, k=4, per_label=2):",
    "    scored = [(len(words(new_request) & words(text)), text, label)",
    "              for text, label in pool]",
    "    scored.sort(key=lambda s: -s[0])  # most shared words first",
    "    picked, count = [], {}",
    "    for score, text, label in scored:",
    "        if count.get(label, 0) < per_label:",
    "            picked.append((text, label))",
    "            count[label] = count.get(label, 0) + 1",
    "        if len(picked) == k:",
    "            break",
    "    return picked"
  ];
  // From trace_pick.out.txt: [line, label, score, count, picked (positions in the sorted list)], about to run `line`.
  // The 43 steps inside the list comprehension (lines 1-2, once per past job) are folded into the first step.
  const TRACE = [
    [3, null, null, null, null], [4, null, null, null, null], [5, null, null, "{}", ""],
    [6, "leak", 2, "{}", ""], [7, "leak", 2, "{}", ""], [8, "leak", 2, "{}", "0"], [9, "leak", 2, '{"leak":1}', "0"],
    [5, "leak", 2, '{"leak":1}', "0"], [6, "water heater", 2, '{"leak":1}', "0"], [7, "water heater", 2, '{"leak":1}', "0"],
    [8, "water heater", 2, '{"leak":1}', "0,1"], [9, "water heater", 2, '{"leak":1,"water heater":1}', "0,1"],
    [5, "water heater", 2, '{"leak":1,"water heater":1}', "0,1"], [6, "leak", 1, '{"leak":1,"water heater":1}', "0,1"],
    [7, "leak", 1, '{"leak":1,"water heater":1}', "0,1"], [8, "leak", 1, '{"leak":1,"water heater":1}', "0,1,2"],
    [9, "leak", 1, '{"leak":2,"water heater":1}', "0,1,2"], [5, "leak", 1, '{"leak":2,"water heater":1}', "0,1,2"],
    [6, "leak", 1, '{"leak":2,"water heater":1}', "0,1,2"], [9, "leak", 1, '{"leak":2,"water heater":1}', "0,1,2"],
    [5, "leak", 1, '{"leak":2,"water heater":1}', "0,1,2"], [6, "water heater", 1, '{"leak":2,"water heater":1}', "0,1,2"],
    [7, "water heater", 1, '{"leak":2,"water heater":1}', "0,1,2"], [8, "water heater", 1, '{"leak":2,"water heater":1}', "0,1,2,4"],
    [9, "water heater", 1, '{"leak":2,"water heater":2}', "0,1,2,4"], [10, "water heater", 1, '{"leak":2,"water heater":2}', "0,1,2,4"],
    [11, "water heater", 1, '{"leak":2,"water heater":2}', "0,1,2,4"]
  ];
  const BOILER = TESTS[T_BOILER][0];
  const SORTED = scoreAll(BOILER);
  // steps: one folded step for the comprehension, then the traced loop
  const FR = [{ line: 1, fold: true }, ...TRACE.map(([line, label, score, count, picked]) => ({ line, label, score, count, picked }))];
  // the row of the sorted list the loop is looking at: line 6 starts a new row
  (() => { let row = -1; FR.forEach(f => { if (f.line === 6) row++; f.row = f.line >= 6 && f.line <= 10 ? row : -1; }); })();
  // the step where a row is about to be skipped by the cap: the learner predicts it
  const GATE = FR.findIndex(f => f.line === 6 && f.count && JSON.parse(f.count)[f.label] >= 2);
  function asCode({ el, done, kit }) {
    let i = 0, gateAns = null;
    const gateRight = 1; // "No": its label already has per_label examples
    const paint = () => {
      const f = FR[i];
      const pk = f.picked ? f.picked.split(",").filter(Boolean).map(Number) : [];
      const atGate = i === GATE && gateAns !== gateRight;
      const say = f.fold ? `Score every past job: how many content words it shares with the new request. Common words such as “the” and “water” are dropped first (every plumbing message mentions water). This line scores all ${POOL.length} past jobs; those steps are folded into this one.`
        : f.line === 3 ? `Sort so the most shared words come first. Python's sort is stable: equal scores keep the sheet's order.`
        : f.line === 4 ? `Start with nothing picked and an empty count per label.`
        : f.line === 5 ? (f.label == null ? `Walk down the sorted list.` : `Next row.`)
        : f.line === 6 ? `Row ${f.row + 1}: ${f.label}, ${plural(f.score, "shared word")}. Does ${f.label} still have room? Count so far: ${f.count}.`
        : f.line === 7 ? `Yes, so it goes in.`
        : f.line === 8 ? `Count one more ${f.label}.`
        : f.line === 9 ? (FR[i - 1].line === 6 ? `No room: ${f.label} already has ${JSON.parse(f.count)[f.label]}, so this row is skipped even though it shares a word. The cap stops one label from taking over the set. ${SIM_SAME_ANS ? "In this run it did not change an answer: the four closest with no cap got the same answers (screen 6)." : ""}` : pk.length === 4 ? `${pk.length} picked, and k is 4: the check is true.` : `${plural(pk.length, "example")} picked, k is 4: keep going.`)
        : f.line === 10 ? `Stop the loop.`
        : `Return the four: ${pk.map(p => SORTED[p].l).join(", ")}. These are the picked four the recording used for this request, and the model answered ${REC.bal[T_BOILER]}.`;
      el.innerHTML = `<h1>The picker, written in Python</h1>
        <p class="lead">This is the code that chose the picked four, run on the boiler request. <code>words()</code> lower-cases a message and keeps its content words as a set; <code>&amp;</code> keeps the words in both sets. <code>k</code> is how many examples to pick, and <code>per_label</code> is the most it takes of any one label.</p>
        ${newReq(kit, BOILER)}
        <p class="task">Step through the run to the end.${GATE >= 0 ? " It stops once to ask you something." : ""} On a phone, the code scrolls sideways.</p>
        ${kit.code(CODE, f.line)}
        <div class="vars"><span>label <b>${kit.esc(f.label ?? "–")}</b></span><span>score <b>${f.score ?? "–"}</b></span><span>count <b>${kit.esc(f.count ?? "–")}</b></span><span>picked <b>${pk.length}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        <div class="${P}-reqs">${SORTED.slice(0, 6).map((r, p) => `<div class="${P}-req ${pk.includes(p) ? "ok" : f.row === p ? "on" : ""}"><span>${kit.esc(r.t)}</span><span class="${P}-lab">${kit.esc(r.l)} · ${r.s}</span></div>`).join("")}</div>
        <p class="${P}-mini">top 6 of the sorted list (label · shared words); the other ${POOL.length - 6} share none</p>
        ${atGate ? `<div class="lpanel" id="gate"><p><b>Predict: is this row picked?</b></p>${kit.options(["Yes", "No"], { picked: gateAns, correct: gateRight })}${gateAns == null ? "" : kit.feedback(`It shares a word, and it is high in the list. But <code>count</code> already shows two ${kit.esc(f.label)}, and <code>per_label</code> is 2. Look at the <code>if</code> on the highlighted line.`, false)}</div>`
          : kit.feedback(i === GATE ? `Right: ${say}` : say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 || atGate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
      el.querySelectorAll("#gate .lopts button").forEach(b => b.onclick = () => { gateAns = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 8. The big picture: when examples, when a written rule, when training. */
  const BP = [
    ["A help desk wants replies in the team's exact tone and layout. Nobody can describe it well, but there are dozens of good past replies.", 0,
      "Examples. The pattern is easy to show and hard to describe, and a few close past replies show it."],
    ["Every message about a boiler or a hot water cylinder must be labelled water heater. One sentence says it all.", 1,
      "Write the rule. One sentence is cheaper than examples on every call, and it is easy to check."],
    ["A bank sorts millions of messages a day into 40 categories and has hundreds of thousands of labelled ones.", 2,
      "Training is worth comparing. Examples are paid for on every call, a few cannot cover 40 categories, and this much labelled data is exactly what training needs."]
  ];
  const BP_OPTS = ["Few-shot examples", "A written rule in the instruction", "Train a model on the labelled data"];
  function bigPicture({ el, done, kit }) {
    const ans = BP.map(() => null);
    const ratio = (mean(REC.tokens.bal) / mean(REC.tokens.zero)).toFixed(1);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for examples</h1>
        <p class="lead"><b>What for:</b> showing a model your labels' borders and the form of the answer, without changing the model. <b>When:</b> the pattern is easier to show than to say, and you have labelled cases to pick from.</p>
        <p class="lead"><b>When not:</b> if the rule fits in one sentence, write the sentence. With Nadia's boiler rule in the instruction and no examples, the model got ${Object.keys(REC_RULE.answers).filter(t => same(REC_RULE.answers[t], TESTS[t][1])).length === Object.keys(REC_RULE.answers).length ? "both" : "only some"} boiler requests right, even the one every example set missed. Examples also cannot add facts the model lacks. And at huge volume with lots of labelled data, training a model is worth comparing.</p>
        <p class="lead"><b>Costs:</b> longer prompts on every call (about ${ratio} times here), a labelled sheet to keep current, and answers that move with the choice and order of examples, so test on a fixed set.</p>
        <p class="task">Pick the best tool for each situation.</p>
        ${BP.map(([q, r, why], j) => `<div class="lcase" id="c${j}"><p>${kit.esc(q)}</p>${kit.options(BP_OPTS, { picked: ans[j], correct: r })}${ans[j] == null ? "" : ans[j] === r ? kit.feedback(kit.esc(why), true)
          : kit.feedback(ans[j] === 0 ? (r === 1 ? "Examples would work, but they cost input on every call and only hint at a rule you can simply state. When one sentence covers it, write the sentence." : "A few examples cannot show 40 categories well, and every call pays for them. At this volume, with this much labelled data, a trained model is worth comparing.")
            : ans[j] === 1 ? (r === 0 ? "The team already tried to describe the tone and could not. That is the case where showing beats telling." : "One rule cannot cover 40 categories, and the labelled data would sit unused.")
            : (r === 0 ? "Training needs far more labelled data and work, and the team has dozens of replies. A few examples in the prompt do the job today." : "Training for a rule that fits in one sentence is a lot of work and data for something the instruction can say."), false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, j) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[j] = +b.dataset.i; paint();
        if (BP.every(([, r], x) => ans[x] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations, including one where examples do not help. */
  const CASES = [
    ["A recipe app tags each recipe easy, medium or hard from its steps. The editors agree on almost every tag, but asked for the rule, they give a different reason each time: the number of steps, a tricky technique, tight timing. The team has 200 tagged recipes.", true,
      "Yes. The border lives in the editors' judgment, not in one sentence. For each new recipe, show a few close tagged ones, with more than one tag among them, and the model can follow where the editors draw the line.",
      "A written rule would need one sentence the editors agree on, and they do not have one: each reason they give misses cases they tag without thinking. That is the case for examples, and there are 200 tagged recipes to pick close ones from."],
    ["A support chat must answer “Where is my order?” The status of each order is only in the order database.", false,
      "No. Examples show the form of an answer, not today's facts. No example can tell the model where this customer's parcel is. The status has to be put into the prompt from the database, which later lessons cover.",
      "Examples would show how a good answer reads, but not where this order is. The model does not have that fact, and examples do not add facts. The status must come from the database into the prompt."],
    ["A legal team wants every clause summed up in the same three-line layout. Describing the layout in words keeps failing.", true,
      "Yes. A layout is easier to show than to describe. Two or three examples in that layout usually fix it, and you can check the result.",
      "This is a form problem, and examples are the most direct way to show a form: two or three summaries in the exact layout."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would examples help here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the plumbing company.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: a browser exercise, then the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can pick examples on purpose now</h1>
      <p class="lead">Few-shot examples show a model where your labels' borders are. Pick ones close to the request, do not let one label take over, and test the set on a fixed group of requests, because the choice and the order move the answers.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson. You write <code>pick_examples</code> yourself: score past requests by shared words, cap each label, and check what it picks for new requests.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It asks when the model should write out its working before the answer, and what those extra tokens buy.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5a-few-shot", {
    title: "Few-shot examples and how to pick them",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/2005.14165",
      "https://arxiv.org/abs/2101.06804",
      "https://arxiv.org/abs/2102.09690",
      "https://arxiv.org/abs/2104.08786",
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
      "https://developers.openai.com/api/docs/guides/prompt-engineering"
    ],
    interview: [{
      q: "Your ticket classifier uses five fixed few-shot examples. After a teammate edited them, one category's accuracy dropped. How do you find out why and fix it?",
      good: [
        "Look at the label mix of the new examples: a one-sided set pulls borderline tickets toward its label",
        "Re-run a fixed, labelled test set with the old and the new examples and compare per category",
        "Pick examples per ticket: the most similar labelled ones, with a cap per label",
        "Shuffle the same examples and re-run: if answers move, order is part of the problem",
        "If the border can be said in one sentence, write it into the instruction"
      ],
      weak: "Add more examples or switch to a bigger model, without measuring on a fixed test set or looking at which labels the examples show."
    }, {
      q: "You have 30 labelled examples across four categories. A teammate wants all 30 in every prompt. What do you tell them?",
      good: [
        "Every example is input tokens on every call, so cost and latency go up for every request",
        "A few close examples per request usually tell the model more than 30 mostly unrelated ones",
        "Keep more than one label among the picked examples so none takes over",
        "Decide with numbers: compare both on a fixed labelled test set"
      ],
      weak: "More examples is always better, so include them all."
    }],
    screens: [situation, byHand, predictLopsided, spotIdea, broken, useIt, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-i="${T_CYL}"]`], right: S1_BAD.map(t => `[data-i="${t}"]`) },
      { wrong: ['[data-i="0"]', '[data-i="1"]', '[data-i="2"]'], right: S2_PICKER.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['#code [data-i="3"]'], right: [`#code [data-i="${BROKEN_LINE}"]`, "#fix [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: U_CASES.map((_, j) => `#c${j} [data-right]`) },
      { wrong: [...Array(GATE).fill("[data-next]"), "#gate [data-wrong]"], right: ["#gate [data-right]", ...Array(FR.length - 1 - GATE).fill("[data-next]")] },
      { wrong: ["#c1 [data-wrong]"], right: BP.map((_, j) => `#c${j} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, j) => `#c${j} [data-right]`) },
      { right: [] }
    ]
  });
})();
