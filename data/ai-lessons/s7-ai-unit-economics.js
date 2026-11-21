/* Lesson s7-ai-unit-economics: unit economics of an AI feature.
   Story: a note-taking app (made up for this lesson) sells AI summaries for a small monthly fee. A few users tap
   "Summarise" hundreds of times a day, and the model bill for each of them is bigger than what they pay.
   Ideas: (1) cost per active user per month = calls per user per month x cost per call (tokens x price), and it
   must be compared with the fee per user and per group, because the average hides the heavy users; (2) fix the
   driver you find in the data: here most heavy-user calls repeat an unchanged note, so a stored summary removes
   them, while a higher fee does not reach the cause and a smaller model changes what every user reads.
   Depth: explain (screens 1-7, 9, 10, interview), scratch (screen 8: the margin function, traced), when-not
   (screens 9 and 10).
   Data:
   - recordings (main checkout) docs/ai-path/recordings/s7-ai-unit-economics/: main-meeting, main-move,
     main-lecture, main-lecture-again (the app's model, a mid-size hosted model, reasoning off) and small-meeting,
     small-move, small-lecture (a smaller hosted model), all through OpenRouter on 2026-11-17 with the prices
     OpenRouter listed that day. The request files come from docs/ai-path/runs/s7-ai-unit-economics/make_requests.py
     (the three notes and the system prompt are made up for the lesson).
   - docs/ai-path/runs/s7-ai-unit-economics/unit_economics.py -> unit_economics.out.txt: the cost check of every
     call, the margins with each fix, and the trace of margins() shown on the code screen (TRACE below).
   Made up for the story and said so on screen: the fee, the usage month (GROUPS) and the heavy user's afternoon
   (HEAVY_LOG). Every other number is computed here from the recorded tokens, prices and costs.
   Lesson-local style: small tables, a quote block and a printed-total line (prefix lx-s7-ai-unit-economics-),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s7-ai-unit-economics";
  const P = `lx-${ID}-`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const fmt = n => n.toLocaleString("en");
  const usd = (x, d = 2) => `${x < 0 ? "−" : ""}$${Math.abs(x).toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
  const per1000 = c => usd(c * 1000);
  const pct = x => { const v = x * 100; return `${v < 10 && Math.abs(v - Math.round(v)) > 0.05 ? v.toFixed(1) : Math.round(v)}%`; };

  /* ---------- Recorded calls (copied from the recordings, not altered) ---------- */
  // From docs/ai-path/recordings/s7-ai-unit-economics/*.json: usage.prompt_tokens, usage.completion_tokens,
  // usage.prompt_tokens_details.cached_tokens, usage.cost, and prices (USD per million tokens, fetched 2026-11-17).
  const REC = {
    provider: "openrouter", recordedAt: "2026-11-17",
    main: { model: "google/gemini-2.5-flash", pIn: 0.3, pOut: 2.5 },
    small: { model: "google/gemini-2.5-flash-lite", pIn: 0.1, pOut: 0.4 },
    calls: {
      "main-meeting": { note: "Thursday product sync", inT: 418, outT: 86, cached: 0, cost: 0.0003404 },
      "main-move": { note: "Flat move checklist", inT: 287, outT: 114, cached: 0, cost: 0.0003711 },
      "main-lecture": { note: "Lecture 7: the nitrogen cycle", inT: 834, outT: 102, cached: 0, cost: 0.0005052 },
      "main-lecture-again": { note: "Lecture 7: the nitrogen cycle", inT: 834, outT: 102, cached: 0, cost: 0.0005052 },
      "small-meeting": { note: "Thursday product sync", inT: 418, outT: 96, cached: 0, cost: 0.0000802 },
      "small-move": { note: "Flat move checklist", inT: 287, outT: 96, cached: 0, cost: 0.0000671 },
      "small-lecture": { note: "Lecture 7: the nitrogen cycle", inT: 834, outT: 132, cached: 0, cost: 0.0001362 }
    }
  };
  // From s7-ai-unit-economics/main-meeting.json (full text, not altered)
  const REC_MEETING = { src: "s7-ai-unit-economics/main-meeting", text: "- Search release moves from 18 Nov to 25 Nov due to a shared-folder bug.\n- Offline mode will ship with a \"keep both\" conflict screen, merging to be looked at in January.\n- 212 tickets last week, 41 about sync, mostly from the old Android app (version 3.x).\n- Actions for Jonas, Ama, Priya, and Lee." };
  // From s7-ai-unit-economics/main-lecture.json and main-lecture-again.json (full texts, not altered)
  const REC_LECTURE = { src: "s7-ai-unit-economics/main-lecture", text: "- Air is 78% N2, but plants and animals cannot use N2 directly.\n- The nitrogen cycle has 5 steps: fixation, nitrification, assimilation, ammonification, and denitrification.\n- Biological fixation is done by bacteria with nitrogenase, some in root nodules of legumes.\n- Humans have doubled fixed nitrogen entering land through fertiliser and burning fuels.\n- For the exam: know the 5 steps, why nodules need leghemoglobin, and be able to draw the cycle." };
  const REC_AGAIN = { src: "s7-ai-unit-economics/main-lecture-again", text: "- Air is 78% N2, but plants and animals cannot use N2 directly.\n- The nitrogen cycle has 5 steps: fixation, nitrification, assimilation, ammonification, and denitrification.\n- Biological fixation is done by bacteria with nitrogenase, some in root nodules of legumes.\n- Humans have doubled fixed nitrogen entering land through fertiliser and burning fuels.\n- For the exam: know the 5 steps, why nodules need leghemoglobin, and be able to draw the cycle." };
  // From s7-ai-unit-economics/small-lecture.json and small-meeting.json (one line of each, trimmed, not altered)
  const REC_SMALL_LECTURE = { src: "s7-ai-unit-economics/small-lecture", text: "Legumes fix nitrogen via bacteria in root nodules, which are kept oxygen-free by leghemoglobin." };
  const REC_SMALL_MEETING = { src: "s7-ai-unit-economics/small-meeting", text: "Search release delayed to Nov 25 due to a bug with shared folders." };
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;
  // Written for the lesson (input, not model output): from make_requests.py
  const RULE_DATES = "Keep names, dates and numbers exactly as they appear in the note.";
  const NOTE_LEG = "Nitrogenase stops working when oxygen is present, so the nodules contain leghemoglobin, which binds oxygen and keeps it low around the bacteria.";
  const NOTE_DATE = "Release moves from 18 Nov to 25 Nov.";

  /* ---------- The story's month (made up for the lesson, same as unit_economics.py) ---------- */
  const DAYS = 30;
  const FEE = 3, FEE_A = 4;
  // [name, users, summaries per day per user, share of calls on a note unchanged since its last summary]
  const GROUPS = [["light", 1500, 2, 0.2], ["regular", 470, 20, 0.5], ["heavy", 30, 400, null]];
  const HEAVY_LOG = [
    ["14:02", "Lecture 7: nitrogen cycle", true], ["14:05", "Lecture 7: nitrogen cycle", false],
    ["14:09", "Lecture 6: photosynthesis", false], ["14:11", "Lecture 7: nitrogen cycle", false],
    ["14:15", "Lecture 7: nitrogen cycle", false], ["14:18", "Lab 3: enzymes", true],
    ["14:20", "Lecture 6: photosynthesis", false], ["14:24", "Lecture 7: nitrogen cycle", false],
    ["14:31", "Lecture 7: nitrogen cycle", false], ["14:33", "Lab 3: enzymes", false],
    ["14:40", "Lecture 5: cell membranes", false], ["14:41", "Lecture 7: nitrogen cycle", true],
    ["14:44", "Lecture 7: nitrogen cycle", false], ["14:52", "Lecture 6: photosynthesis", false],
    ["14:58", "Lecture 7: nitrogen cycle", false], ["15:03", "Lab 3: enzymes", false],
    ["15:07", "Lecture 7: nitrogen cycle", false], ["15:12", "Exam plan", true],
    ["15:15", "Lecture 6: photosynthesis", false], ["15:20", "Lecture 7: nitrogen cycle", false]
  ];

  /* ---------- The code screen: margins() from unit_economics.py, line for line (line 0 = def) ---------- */
  const CODE = [
    "def margins(rows, fee, per_call, store):",
    "    out = {}",
    "    for name, per_day, unchanged in rows:",
    "        calls = per_day * DAYS",
    "        if store:",
    "            calls *= 1 - unchanged",
    "        cost = calls * per_call",
    "        out[name] = round(fee - cost, 2)",
    "    return out"
  ];
  // From unit_economics.out.txt, margins(rows, FEE, cost per call, True): [line about to run, event (l line,
  // r return), name, unchanged, calls, cost, out]
  const TRACE = [[1,"l",null,null,null,null,null],[2,"l",null,null,null,null,{}],[3,"l","light",0.2,null,null,{}],[4,"l","light",0.2,60,null,{}],[5,"l","light",0.2,60,null,{}],[6,"l","light",0.2,48.0,null,{}],[7,"l","light",0.2,48.0,0.0194672,{}],[2,"l","light",0.2,48.0,0.0194672,{"light":2.98}],[3,"l","regular",0.5,48.0,0.0194672,{"light":2.98}],[4,"l","regular",0.5,600,0.0194672,{"light":2.98}],[5,"l","regular",0.5,600,0.0194672,{"light":2.98}],[6,"l","regular",0.5,300.0,0.0194672,{"light":2.98}],[7,"l","regular",0.5,300.0,0.12167000000000001,{"light":2.98}],[2,"l","regular",0.5,300.0,0.12167000000000001,{"light":2.98,"regular":2.88}],[3,"l","heavy",0.8,300.0,0.12167000000000001,{"light":2.98,"regular":2.88}],[4,"l","heavy",0.8,12000,0.12167000000000001,{"light":2.98,"regular":2.88}],[5,"l","heavy",0.8,12000,0.12167000000000001,{"light":2.98,"regular":2.88}],[6,"l","heavy",0.8,2399.9999999999995,0.12167000000000001,{"light":2.98,"regular":2.88}],[7,"l","heavy",0.8,2399.9999999999995,0.9733599999999999,{"light":2.98,"regular":2.88}],[2,"l","heavy",0.8,2399.9999999999995,0.9733599999999999,{"light":2.98,"regular":2.88,"heavy":2.03}],[8,"l","heavy",0.8,2399.9999999999995,0.9733599999999999,{"light":2.98,"regular":2.88,"heavy":2.03}],[8,"r","heavy",0.8,2399.9999999999995,0.9733599999999999,{"light":2.98,"regular":2.88,"heavy":2.03}]];

  /* ---------- Derived from the data ---------- */
  const C = REC.calls;
  const MAIN_NAMES = ["main-meeting", "main-move", "main-lecture"];
  const SMALL_NAMES = ["small-meeting", "small-move", "small-lecture"];
  const MAIN_CPC = sum(MAIN_NAMES.map(n => C[n].cost)) / MAIN_NAMES.length;
  const SMALL_CPC = sum(SMALL_NAMES.map(n => C[n].cost)) / SMALL_NAMES.length;
  const CHEAPER = MAIN_CPC / SMALL_CPC;
  const partIn = (c, m) => c.inT * m.pIn / 1e6, partOut = (c, m) => c.outT * m.pOut / 1e6;
  const HITS = HEAVY_LOG.filter(r => !r[2]).length;
  const HEAVY_UNCHANGED = HITS / HEAVY_LOG.length;
  const G = GROUPS.map(([name, users, perDay, s]) => ({ name, users, perDay, unchanged: s == null ? HEAVY_UNCHANGED : s }));
  const USERS = sum(G.map(g => g.users));
  const monthCalls = (g, store) => g.perDay * DAYS * (store ? 1 - g.unchanged : 1);
  const userCost = (g, cpc, store) => monthCalls(g, store) * cpc;
  const bill = (cpc, store) => sum(G.map(g => g.users * userCost(g, cpc, store)));
  const HEAVY = G.find(g => g.name === "heavy");
  const BILL = bill(MAIN_CPC, false), REVENUE = USERS * FEE;
  const heavyMargin = (fee, cpc, store) => fee - userCost(HEAVY, cpc, store);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "style")) return;
    const s = document.createElement("style");
    s.id = P + "style";
    s.textContent = `
      .${P}tw { max-width: 100%; overflow-x: auto; }
      .${P}t { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .${P}t caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .${P}t th { text-align: left; font: 600 13.5px/1.4 var(--font); color: var(--muted); padding: 6px 6px 6px 0; border-bottom: 1px solid var(--line); }
      .${P}t td { padding: 7px 6px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--ink); }
      .${P}t td.${P}n { text-align: right; font-family: var(--mono); font-size: 14px; white-space: nowrap; }
      .${P}t th.${P}n { text-align: right; }
      .${P}t tr.${P}bad td { color: var(--bad); font-weight: 600; }
      .${P}t tr.${P}faint td { color: var(--faint); }
      .${P}q { margin: 14px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font-size: 15.5px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}q b { font-weight: 600; }
      .${P}who { display: block; font: 600 13.5px/1.4 var(--font); color: var(--muted); margin-bottom: 4px; white-space: normal; }
      .${P}cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}facts { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .${P}facts li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .${P}facts b { font-family: var(--mono); font-weight: 600; }
    `;
    document.head.appendChild(s);
  }
  // head: [label, numeric?]; rows: [[cells...], rowClass?]
  function tbl(kit, head, rows, caption) {
    return `<div class="${P}tw"><table class="${P}t">${caption ? `<caption>${kit.esc(caption)}</caption>` : ""}<thead><tr>${head.map(([h, n]) => `<th${n ? ` class="${P}n"` : ""}>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(([cells, cls]) => `<tr${cls ? ` class="${P}${cls}"` : ""}>${cells.map((c, i) => `<td${head[i][1] ? ` class="${P}n"` : ""}>${kit.esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const quote = (kit, who, text) => `<div class="${P}q"><span class="${P}who">${kit.esc(who)}</span>${kit.esc(text)}</div>`;
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  function single(el, kit, done, build) {
    let ans = null;
    const paint = () => {
      const b = build(ans);
      el.innerHTML = b.html;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === b.right) done(); });
    };
    paint();
  }
  const monthRows = (cpc, store, fee) => G.map(g => {
    const cost = userCost(g, cpc, store), m = fee - cost;
    return [[g.name, fmt(Math.round(monthCalls(g, store))), usd(cost), usd(m)], m < 0 ? "bad" : null];
  });
  const MONTH_HEAD = [["group"], ["calls a month", 1], ["cost", 1], ["margin", 1]];

  /* 1. The situation, and the bill of one recorded call. */
  function oneCall({ el, done, kit }) {
    ensureStyle();
    const c = C["main-meeting"], m = REC.main;
    const i = partIn(c, m), o = partOut(c, m);
    const tokRatio = c.inT / c.outT, priceRatio = m.pOut / m.pIn;
    single(el, kit, done, ans => ({
      right: 1,
      html: `<h1>What one summary costs</h1>
        <p class="lead">A note-taking app (made up for this lesson) sells AI summaries for <b>${usd(FEE)} a month</b>. Tap “Summarise” on a note, and the app sends the note to a hosted model, which writes a few bullet points. Most people do this a couple of times a day. A few people do it hundreds of times a day, and the team wants to know whether the feature makes or loses money on them. To find out, you work out what one user costs and compare it with what he pays.</p>
        <p class="lead">Start with one call. Here the app's model summarised a meeting note:</p>
        ${quote(kit, "model summary", REC_MEETING.text)}
        <p class="${P}cap">${CAPTION}. A mid-size hosted model answered.</p>
        <ul class="${P}facts">
          <li>The request had <b>${fmt(c.inT)}</b> input tokens (instructions plus the note). The reply had <b>${fmt(c.outT)}</b> output tokens.</li>
          <li>Prices on ${REC.recordedAt}: <b>$${m.pIn.toFixed(2)}</b> per million input tokens, <b>$${m.pOut.toFixed(2)}</b> per million output tokens.</li>
        </ul>
        <p class="task">Which part of this call's bill is bigger?</p>
        <div class="lpanel">${ask(kit, [
          `The input: it has about ${Math.round(tokRatio)} times more tokens`,
          "The output",
          "They cost the same"
        ], 1, ans, [
          [`Count and price both matter. The input has ${tokRatio.toFixed(1)} times more tokens, but each output token costs ${priceRatio.toFixed(1)} times more. Multiply each count by its own price.`, false],
          [`Right. Input: ${fmt(c.inT)} × $${m.pIn.toFixed(2)} / 1,000,000 = <b>${usd(i, 7)}</b>. Output: ${fmt(c.outT)} × $${m.pOut.toFixed(2)} / 1,000,000 = <b>${usd(o, 7)}</b>, ${(o / i).toFixed(1)} times the input part, from ${tokRatio.toFixed(1)} times fewer tokens. Together ${usd(i + o, 7)}, the same as the cost OpenRouter reported for the call (${usd(c.cost, 7)}). A tiny number, so think in thousands: <b>${per1000(c.cost)} per 1,000 summaries</b> like this one.`, true],
          [`Work them out: input ${fmt(c.inT)} × $${m.pIn.toFixed(2)} per million, output ${fmt(c.outT)} × $${m.pOut.toFixed(2)} per million. The two results are not close.`, false]
        ])}</div>`
    }));
  }

  /* 2. By hand: cost per user per month, then the margin per group. */
  function perUser({ el, done, kit }) {
    ensureStyle();
    const heavyCost = userCost(HEAVY, MAIN_CPC, false);
    const opts = [usd(HEAVY.perDay * MAIN_CPC), usd(heavyCost), usd(HEAVY.users * heavyCost), usd(userCost(G[1], MAIN_CPC, false))];
    const RIGHT = 1;
    single(el, kit, done, ans => ({
      right: RIGHT,
      html: `<h1>From one call to one user's month</h1>
        <p class="lead">Notes differ in length, so the team recorded three real summaries and takes their average as the cost of one call:</p>
        ${tbl(kit, [["note"], ["in", 1], ["out", 1], ["cost", 1]], MAIN_NAMES.map(n => [[C[n].note, fmt(C[n].inT), fmt(C[n].outT), usd(C[n].cost, 7)]]), `Recorded calls, ${REC.recordedAt}`)}
        <p class="lead">Average: <b>${usd(MAIN_CPC, 7)}</b> per summary (${per1000(MAIN_CPC)} per 1,000). Now last month's usage. These users and counts are made up for the lesson; a month has ${DAYS} days here.</p>
        ${tbl(kit, [["group"], ["users", 1], ["summaries a day, each", 1]], G.map(g => [[g.name, fmt(g.users), fmt(g.perDay)]]))}
        <p class="task">What does <b>one</b> heavy user cost in model calls per month?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, [
          [`That is one day: ${HEAVY.perDay} × ${usd(MAIN_CPC, 7)}. The fee is per month, so the cost must be per month too: times ${DAYS}.`, false],
          [`Right: ${HEAVY.perDay} a day × ${DAYS} days = ${fmt(HEAVY.perDay * DAYS)} calls, × ${usd(MAIN_CPC, 7)} = <b>${usd(heavyCost)}</b>. That is the cost per active user (one who used the feature that month) per month, the number that sits next to the fee. For every group:${tbl(kit, MONTH_HEAD, monthRows(MAIN_CPC, false, FEE), `Per user per month. Fee ${usd(FEE)}; margin = fee − cost`)}A heavy user pays ${usd(FEE)} and costs ${usd(heavyCost)}: the app loses <b>${usd(heavyCost - FEE)}</b> on each one, every month.`, true],
          [`That is all ${HEAVY.users} heavy users together. The question is about one user, because one user is what pays one fee.`, false],
          [`That is a regular user: ${G[1].perDay} a day. A heavy user makes ${HEAVY.perDay / G[1].perDay} times more calls.`, false]
        ])}</div>`
    }));
  }

  /* 3. Spot the idea: the average looks healthy. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    const heavyBill = HEAVY.users * userCost(HEAVY, MAIN_CPC, false);
    const lightCost = userCost(G[0], MAIN_CPC, false);
    single(el, kit, done, ans => ({
      right: 1,
      html: `<h1>The report finance sees</h1>
        <p class="lead">Finance looks at the month as a whole:</p>
        <ul class="${P}facts">
          <li>Model bill <b>${usd(BILL)}</b>, earned <b>${usd(REVENUE)}</b> from ${fmt(USERS)} users</li>
          <li>Average model cost per user <b>${usd(BILL / USERS)}</b> against a fee of ${usd(FEE)}</li>
        </ul>
        <p class="lead">Their note: “The bill is ${pct(BILL / REVENUE)} of what the feature earns. No problem here.”</p>
        <p class="task">What does that average hide?</p>
        <div class="lpanel">${ask(kit, [
          "Nothing: the feature earns far more than it costs",
          `Cost grows with use and the fee does not: the app loses money on each of the ${HEAVY.users} heavy users`,
          "Token prices may rise, so the margin will shrink",
          "The light users cost too much for what they pay"
        ], 1, ans, [
          ["The total is fine this month. But the fee is the same for everyone while the cost is not, so the total depends on the mix of users. Look at what the heavy users cost compared with what they pay.", false],
          [`Right. ${HEAVY.users} users, ${pct(HEAVY.users / USERS)} of the users, make <b>${pct(heavyBill / BILL)}</b> of the bill, and each one costs more than he pays. This is <b>unit economics</b>: cost and revenue per unit, here per active user per month. With a flat fee and unlimited use, what a user pays has a ceiling (the fee) and what he costs does not. Every new heavy user adds a loss, and a feature that heavy users love can turn the whole month negative.`, true],
          ["Prices can move either way, and nothing here needs a future price. The heavy users lose money at today's price. The problem is in how cost is spread over users.", false],
          [`A light user costs ${usd(lightCost)} a month against ${usd(FEE)}. They are the most profitable users you have.`, false]
        ])}</div>`
    }));
  }

  /* 4. A repeated call: the provider's prompt cache is not a stored answer. */
  function repeatCall({ el, done, kit }) {
    ensureStyle();
    const a = C["main-lecture"], b = C["main-lecture-again"];
    const same = REC_LECTURE.text === REC_AGAIN.text;
    const outShare = partOut(b, REC.main) / b.cost;
    single(el, kit, done, ans => ({
      right: 2,
      html: `<h1>The same note, summarised again</h1>
        <p class="lead">Heavy users often tap Summarise on a note they already summarised. The app sent the Lecture 7 note, then sent it again a moment later, unchanged: the same request, word for word. Many providers keep the start of a prompt they have just seen and charge less for those input tokens the next time (<b>prompt caching</b>). The first call cost <b>${usd(a.cost, 7)}</b>.</p>
        <p class="task">What did the second call cost?</p>
        <div class="lpanel">${ask(kit, [
          "Nothing: the provider has the answer already",
          "Less: the provider's prompt cache makes the input cheaper",
          "The same"
        ], 2, ans, [
          ["A provider's prompt cache stores work on the input, not the answer. The model still writes every output token, and you pay for each one. The recording shows a full charge.", false],
          [`That is how prompt caching works when it hits, but it did not hit here: the usage says <code>cached_tokens: ${b.cached}</code>. Automatic caching starts only above a minimum prompt size. For this model the provider's documentation says over a thousand tokens, and this prompt had ${fmt(b.inT)}. Even on a hit, only the cached input gets cheaper; the output is billed in full.`, false],
          [`Right. The recording says <code>cached_tokens: ${b.cached}</code> and a cost of <b>${usd(b.cost, 7)}</b>, the same as the first. The provider's automatic cache starts only above a minimum prompt size (over a thousand tokens for this model, by its documentation), and this prompt had ${fmt(b.inT)}. Even on a hit, only the cached input tokens get a lower price; the output, ${pct(outShare)} of this bill, is paid in full. And the reply was ${same ? "the same text, word for word" : "different"}:${quote(kit, "second summary", REC_AGAIN.text)}<p class="${P}cap">${CAPTION}</p>The second call bought nothing new. Only the app itself can make a repeat free: keep the summary, and send no call while the note is unchanged.`, true]
        ])}</div>`
    }));
  }

  /* 5. By hand: the heavy user's afternoon, and the share of calls a stored summary answers. */
  function heavyLog({ el, done, kit }) {
    ensureStyle();
    const changed = HEAVY_LOG.length - HITS;
    const lec7 = HEAVY_LOG.filter(r => !r[2] && r[1].startsWith("Lecture 7")).length;
    const opts = [String(changed), String(HITS), String(HEAVY_LOG.length), String(lec7)];
    single(el, kit, done, ans => ({
      right: 1,
      html: `<h1>Why does a heavy user call so often?</h1>
        <p class="lead">Here is one heavy user's afternoon from the app's log (made up for the lesson): a student revising for an exam. The app does not keep summaries, so every tap is a new call. Every one of these notes had been summarised before. The last column says whether the note was edited since its last summary.</p>
        ${tbl(kit, [["time"], ["note"], ["edited?"]], HEAVY_LOG.map(([t, n, ch]) => [[t, n, ch ? "edited" : "no"]]), `One heavy user, ${HEAVY_LOG.length} calls`)}
        <p class="task">If the app stored each summary and served it again while the note is unchanged, how many of these ${HEAVY_LOG.length} calls would it answer without the model?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, [
          [`Those ${changed} are the calls that <b>need</b> the model: the note was edited, so the old summary is out of date. Count the other rows.`, false],
          [`Right: ${HITS} of ${HEAVY_LOG.length}, so <b>${pct(HEAVY_UNCHANGED)}</b> of this user's calls repeat a summary that already exists. That share is the store's <b>hit rate</b>: the share of calls it answers without the model. The team takes this afternoon as typical for heavy users. For light and regular users it measured less: ${pct(G[0].unchanged)} and ${pct(G[1].unchanged)} (also made up for the lesson).`, true],
          ["Every row is a call, but the edited ones changed the note, so the stored summary would be wrong for them. Those still need the model.", false],
          [`Those are only the Lecture 7 repeats. Lecture 6, Lab 3 and Lecture 5 were also summarised again without an edit.`, false]
        ])}</div>`
    }));
  }

  /* 6. Predict each fix: does a heavy user still lose money? */
  const FIXES = [
    { text: `A. Raise the fee from ${usd(FEE)} to ${usd(FEE_A)} for everyone.`, m: () => heavyMargin(FEE_A, MAIN_CPC, false) },
    { text: `B. Store each summary and serve it again while the note is unchanged (${pct(HEAVY_UNCHANGED)} of heavy users' calls).`, m: () => heavyMargin(FEE, MAIN_CPC, true) },
    { text: `C. Move all summaries to a smaller hosted model. Its three recorded summaries cost ${per1000(SMALL_CPC)} per 1,000, about ${Math.round(CHEAPER)} times less than ${per1000(MAIN_CPC)}.`, m: () => heavyMargin(FEE, SMALL_CPC, false) }
  ];
  function fixes({ el, done, kit }) {
    ensureStyle();
    const ans = FIXES.map(() => null);
    const why = [
      m => `A heavy user now pays ${usd(FEE_A)} and still costs ${usd(userCost(HEAVY, MAIN_CPC, false))}: margin <b>${usd(m)}</b>. The fee moved a little; the cost did not move at all, because nothing about the calls changed.`,
      m => `Calls per heavy user fall from ${fmt(monthCalls(HEAVY, false))} to ${fmt(Math.round(monthCalls(HEAVY, true)))}, so the cost falls to ${usd(userCost(HEAVY, MAIN_CPC, true))}: margin <b>${usd(m)}</b>. The ${pct(HEAVY_UNCHANGED)} that bought nothing new are gone.`,
      m => `Same ${fmt(monthCalls(HEAVY, false))} calls, but each costs ${usd(SMALL_CPC, 7)}: ${usd(userCost(HEAVY, SMALL_CPC, false))} a month, margin <b>${usd(m)}</b>. The number is fixed; whether the summaries are still good is a separate question.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Three fixes on the table</h1>
        <p class="lead">Today a heavy user costs ${usd(userCost(HEAVY, MAIN_CPC, false))} a month and pays ${usd(FEE)}. The team has three ideas. Work each one out before you look.</p>
        <p class="task">After each fix, does a heavy user still lose money? Pick again if you change your mind.</p>
        ${FIXES.map((f, i) => {
          const m = f.m(), right = m < 0 ? 0 : 1;
          return `<div class="lcase" id="c${i}"><p>${kit.esc(f.text)}</p>${kit.options(["Still loses money", "Now makes money on him"], { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(ans[i] === right ? why[i](m) : (right === 0 ? `Work it out: the fee goes up by ${usd(FEE_A - FEE)}, but the loss was ${usd(userCost(HEAVY, MAIN_CPC, false) - FEE)}. ${why[i](m)}` : `Work it out with the new numbers before deciding. ${why[i](m)}`), ans[i] === right)}</div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (FIXES.every((f, j) => ans[j] === (f.m() < 0 ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 7. Which fix first: B and C both fix the number; C changes what every user reads. */
  function whichFirst({ el, done, kit }) {
    ensureStyle();
    const billB = bill(MAIN_CPC, true);
    single(el, kit, done, ans => ({
      right: 1,
      html: `<h1>Which one do you ship first?</h1>
        <p class="lead">B and C both make heavy users profitable. Before you choose, look at what the smaller model wrote in its recorded runs. Below each line from a note is what the smaller model wrote about it. Compare each pair.</p>
        ${quote(kit, "lecture note", NOTE_LEG)}
        ${quote(kit, "smaller model", REC_SMALL_LECTURE.text)}
        ${quote(kit, "meeting note", NOTE_DATE)}
        ${quote(kit, "smaller model", REC_SMALL_MEETING.text)}
        <p class="${P}cap">${CAPTION}. The instructions said: “${kit.esc(RULE_DATES)}”</p>
        <p class="task">Which fix do you ship first?</p>
        <div class="lpanel">${ask(kit, [
          `A: the higher fee`,
          `B: store summaries while the note is unchanged`,
          `C: the smaller model`,
          `B and C together, today`
        ], 1, ans, [
          [`A heavy user still loses ${usd(-heavyMargin(FEE_A, MAIN_CPC, false))} after it, and ${fmt(USERS - HEAVY.users)} other users, who already earn the app money, pay more for a cost the heavy users make.`, false],
          [`Right. B removes calls that bought nothing: the recorded repeat came back word for word the same. Users see the same summaries as before, so there is no quality to re-check. The month's bill falls from ${usd(BILL)} to <b>${usd(billB)}</b>. The work it needs: key each stored summary to the note's exact content, so an edit always makes a fresh one. C stays a candidate. Test it on a golden set of real notes first, because in this run it said “oxygen-free” where the note says the oxygen is kept low, and wrote “Nov 25” though told to keep dates exactly.`, true],
          [`It fixes the number, but it changes every summary every user reads. In this run it said “oxygen-free” where the note says the oxygen is kept low, and changed “25 Nov” to “Nov 25” against the instructions. Test it on a golden set before you switch, and remove the waste first.`, false],
          [`B alone already fixes the margin. Adding C today ships a quality change nobody has tested, and if complaints come you will not know which change caused them. One change at a time, measured.`, false]
        ])}</div>`
    }));
  }

  /* 8. From scratch: margins() as Python, a stepped replay of the traced run (store=True). */
  const SHOW = new Set([3, 5, 6, 7]);
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const prev = TRACE[k - 1], v = TRACE[k];
      const f = { name: v[2], unchanged: v[3], calls: v[4], cost: v[5], result: v[6] };
      if (v[1] === "r") { fr.push(Object.assign(f, { ln: 8, end: true })); continue; }
      if (prev[1] === "l" && SHOW.has(prev[0])) fr.push(Object.assign(f, { ln: prev[0] }));
    }
    return fr;
  })();
  const QI = FR.findIndex(f => f.name === "heavy" && f.ln === 3); // the frame where he predicts line 5
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, pick = null, solved = false;
    const nice = x => x == null ? "–" : (Number.isInteger(x) ? fmt(x) : String(Math.round(x * 1e6) / 1e6));
    const resTxt = r => r ? (Object.keys(r).length ? Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(", ") : "{}") : "–";
    const say = f => {
      if (f.end) return `<code>margins</code> returns <code>{${kit.esc(resTxt(f.result))}}</code>: the app now makes money on every group. The same function with <code>store=False</code> gave ${usd(heavyMargin(FEE, MAIN_CPC, false))} for heavy users; the run printed both.`;
      if (f.ln === 3) return `<code>${kit.esc(f.name)}</code>: ${G.find(g => g.name === f.name).perDay} summaries a day × ${DAYS} = <b>${fmt(f.calls)}</b> calls before any fix.${f.cost != null ? " (<code>cost</code> still holds the last group's value until <code>cost = calls * per_call</code> runs.)" : ""}`;
      if (f.ln === 5) return `<code>store</code> is true, so only the calls on changed notes remain: ${nice(f.calls)} (the share unchanged was ${f.unchanged}).`;
      if (f.ln === 6) return `Cost per user = calls × ${usd(MAIN_CPC, 7)} = <b>${usd(f.cost, 4)}</b>.`;
      if (f.ln === 7) return `Margin = fee − cost, rounded to cents: <b>${usd(f.result[f.name])}</b> for ${kit.esc(f.name)}.`;
      return "";
    };
    const heavyAfter = FR[QI + 1].calls;
    const qOpts = [fmt(Math.round(heavyAfter)), fmt(Math.round(FR[QI].calls * HEAVY_UNCHANGED)), fmt(FR[QI].calls)];
    const qFb = [
      [`Right: ${fmt(FR[QI].calls)} × (1 − ${HEAVY_UNCHANGED}) ≈ ${fmt(Math.round(heavyAfter))}. Step on.`, true],
      [`That multiplies by the unchanged share (${HEAVY_UNCHANGED}): those are the calls the store <b>answers</b>. The line keeps the others: times <code>1 - unchanged</code>.`, false],
      ["<code>store</code> is true in this run, so the <code>if</code> lets <code>calls *= 1 - unchanged</code> run and the calls shrink.", false]
    ];
    const paint = () => {
      const f = FR[i], atQ = i === QI && !solved;
      el.innerHTML = `<h1>The month in Python, from scratch</h1>
        <p class="lead">This is the function the team ran, with fix B switched on (<code>store=True</code>). <code>rows</code> holds, for each group, its name, summaries a day and the share of calls on an unchanged note; <code>per_call</code> is the recorded average cost of one call, ${usd(MAIN_CPC, 7)}; <code>DAYS</code> is ${DAYS}. Plain Python, no library.</p>
        <p class="task">Step through. The marked line is the one that just ran.${atQ ? " Before the next step: what will <code>calls</code> be for the heavy group?" : ""}</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 || atQ ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>name <b>${kit.esc(f.name || "–")}</b></span><span>calls <b>${nice(f.calls)}</b></span><span>cost <b>${f.cost == null ? "–" : usd(f.cost, 4)}</b></span><span>out <b>${kit.esc(resTxt(f.result))}</b></span></div>
        ${atQ || (i === QI && pick != null) ? `<div class="lpanel">${kit.options(qOpts, { picked: pick, correct: 0 })}${pick == null ? "" : kit.feedback(qFb[pick][0], qFb[pick][1])}</div>` : kit.feedback(say(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; if (pick === 0) solved = true; paint(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    single(el, kit, done, ans => ({
      right: 0,
      html: `<h1>When to work out cost per user</h1>
        <p class="lead">This is <b>unit economics</b>: what one user costs and pays, per month, group by group.</p>
        <p class="lead"><b>For:</b> setting a price and limits for an AI feature, and finding which users and which calls make the bill. <b>Reach for it</b> when the fee is flat and use varies a lot between people: before launch, then every month.</p>
        <p class="lead"><b>Not</b> for a prototype with a handful of users (first find out whether anyone wants it), or an internal tool whose whole bill is smaller than an hour of your time.</p>
        <p class="lead"><b>Costs:</b> you must log tokens and calls per user. Each fix has its own price: stored answers must be thrown away when the input changes, a smaller model needs an evaluation, and a limit annoys your most loyal users.</p>
        <p class="task">The app drops the flat fee. People now buy packs of 1,000 summaries, priced above what 1,000 summaries cost. Can a heavy user still bring a negative margin?</p>
        <div class="lpanel">${ask(kit, [
          "No: what he pays now grows with every call he makes",
          "Yes: heavy users always lose money",
          "Only if the app stops storing summaries"
        ], 0, ans, [
          ["Right. When the price is per use and above the cost per use, more use means more profit, not more loss. What you watch then is the cost <b>per call</b>: longer notes or a dearer model can push it above the pack price.", true],
          ["Heavy users lost money because the fee was flat while the cost grew with use. With a price per summary above the cost per summary, each extra call earns a little.", false],
          ["Storing summaries lowers the cost, but the margin per call is already positive here because the price per summary is above the cost. Without the store he simply buys more packs.", false]
        ])}</div>`
    }));
  }

  /* 10. Recognise it in new situations. */
  const FIX_OPTS = ["Store answers", "Smaller model", "Limit or charge by use", "Leave it"];
  const CASES = [
    ["A support chat on a flat plan. Most messages are taps on five help buttons, and each button sends exactly the same request every time.", 0, [
      "Right. The same request gives a reply you already have. Store it and answer from the store; the model is called only when the help text changes.",
      "A smaller model makes each repeat cheaper, but it is still a call that buys nothing new. Here the requests repeat exactly, so they need no call at all.",
      "Limits punish people for tapping help buttons. The cost comes from repeats, and repeats can be answered for free.",
      "Most of this bill is repeats that cost nothing to remove. It is the cheapest fix there is; leaving it pays for the same answer again and again."]],
    ["A translation add-on with a flat fee. A few customers translate 300 different documents a day; no document is ever sent twice.", 2, [
      "Nothing repeats, so a store of answers never hits: the hit rate is about zero, and the bill stays the same.",
      "Each document gets cheaper, but use still has no ceiling: 300 a day today, 3,000 next month, still on one flat fee.",
      "Right. The cost comes from real, different work, so make the price follow the work: a fair-use limit on the flat plan, or a plan priced per document.",
      "Every heavy customer costs more as his use grows while paying the same. That gap only widens."]],
    ["An internal tool used by 12 people at one company. The whole model bill is a few dollars a month, and nobody pays a fee for it.", 3, [
      "Building and maintaining a store costs more engineering time than the whole bill. Fix nothing that is not costing you anything.",
      "A switch needs an evaluation and risks quality, to save a few dollars a month.",
      "There is no fee to protect and no heavy user to price. A limit only slows down colleagues.",
      "Right. The bill is smaller than an hour of your time and there is no revenue per user to compare with. Log the cost so you notice if it grows, and spend your time elsewhere."]],
    ["A grammar button on a flat plan uses a large model for single sentences. The team's evaluation on a golden set of real sentences found no drop in quality with a smaller model.", 1, [
      "Each sentence is new, so stored answers rarely hit.",
      "Right. The evaluation already shows the cheaper model does this job as well, so the cost per call falls for every user with no quality change.",
      "People's use is not the problem here: each call is simply dearer than it needs to be. Fix the cost per call first.",
      "The cost per call is higher than needed and the evaluation says a cheaper model is as good. Leaving it wastes money on every call."]]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which fix fits?</h1>
        <p class="lead">Four AI features from other teams. For each, pick the first move: store answers for repeated requests, move to a smaller model, limit use or charge by use, or leave it alone.</p>
        <p class="task">Pick the first move for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, right, fb], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(FIX_OPTS, { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(fb[ans[i]], ans[i] === right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can price an AI feature</h1>
      <p class="lead">You priced one call from its tokens, turned it into a cost per user per month, and compared that with the fee group by group. The average said all was well, but the app lost ${usd(-heavyMargin(FEE, MAIN_CPC, false))} on each heavy user. The heavy users' log showed why: ${pct(HEAVY_UNCHANGED)} of their calls repeated a summary that already existed. So the first fix removed the repeats, and the cheaper model waits for an evaluation.</p>
      <p class="lead">The lesson itself was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A fix like the smaller model changes what users see; next you test such a change on real users, with one main metric and a few numbers that must not get worse, before you trust it.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Unit economics of an AI feature",
    checked: "2026-11-18",
    sources: [
      "https://openrouter.ai/docs/use-cases/usage-accounting",
      "https://openrouter.ai/docs/features/prompt-caching",
      "https://openrouter.ai/docs/faq",
      "https://aistudio.google.com/docs/caching"
    ],
    interview: [
      {
        q: "Your AI feature is sold on a flat monthly plan. The model bill grew three times faster than sign-ups last quarter. How do you find out whether the feature makes money, and what would you change?",
        good: [
          "Work out cost per active user per month: calls per user times tokens per call times the price, from logged usage",
          "Look at the spread by user group, not the average: a few heavy users often make most of the bill",
          "Read the heavy users' calls to find the driver: repeats, oversized prompts, or a model bigger than the job needs",
          "Pick the fix that matches the driver: store repeated answers, trim or cache the prompt, route to a smaller model after an evaluation, or a fair-use limit or usage-based tier",
          "Ship one change at a time and measure the per-user cost again"
        ],
        weak: "Raise the price for everyone or switch to the cheapest model. That skips finding out who makes the cost and why, and can hurt quality or the many light users."
      },
      {
        q: "A teammate says: we turned on prompt caching, so repeated requests are almost free now. Is that right?",
        good: [
          "Prompt caching only discounts the cached input tokens; the output is billed in full",
          "It needs a minimum prompt size and a recent identical prefix, so short prompts may never hit",
          "Check cached_tokens in the usage of real calls instead of assuming",
          "If the whole request repeats, storing the answer in the app skips the call entirely"
        ],
        weak: "Agree that caching makes repeats free, without checking what the provider caches or whether the calls are big enough to hit."
      }
    ],
    screens: [oneCall, perUser, spotIdea, repeatCall, heavyLog, fixes, whichFirst, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: FIXES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(QI).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]", ...Array(FR.length - 1 - QI).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
