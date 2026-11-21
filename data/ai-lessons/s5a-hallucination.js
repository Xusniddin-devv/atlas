/* Lesson s5a-hallucination: why models make things up.
   Story: the visitor chatbot of the Tidewell Clock Museum (a made-up museum). It was built in March 2025 on a very
   small open model, with a fact sheet pasted into its instructions. Since then the hours and prices changed and a
   new exhibition opened, and nobody updated the sheet.
   Ideas: (1) a model writes likely text, and a sure-sounding answer is likely text whether or not it ever saw the
   fact; (2) a confident wrong answer has a cause you can find: missing knowledge (fix: give it the current facts),
   a bad prompt (fix: change the instruction), or sampling (fix: lower the temperature).
   Data:
   - Local runs: docs/ai-path/runs/s5a-hallucination/local_runs.py, output in local_runs.out.txt (full responses in
     local/<name>.json). Model gemma3:270m on Ollama on this Mac (env.txt). The fact sheets are sheet-2025.txt and
     sheet-2026.txt in the same folder.
   - Recordings (scripts/ai/record.mjs, openrouter, google/gemini-2.5-flash-lite), in
     docs/ai-path/recordings/s5a-hallucination/: parking-bad-prompt, parking-fixed-prompt, cafe-fixed-prompt,
     dog-bad-prompt, monday-new-facts. Their request files are in the runs folder.
   Every count on screen is computed here from that data. Lesson-local CSS: fact sheets, chat lines, request rows,
   toggle answers (prefix lx-s5a-hallucination-). Plain browser script. */
(() => {
  const P = "lx-s5a-hallucination-";
  const REC_DATE = "2026-11-13";
  const ASKED_ON = "Friday 13 November 2026";

  // The two fact sheets, line for line from sheet-2025.txt and sheet-2026.txt (the "Museum facts" part).
  const SHEET_2025 = {
    title: "The bot's facts (updated 1 March 2025)",
    lines: ["Opening hours: Tuesday to Sunday, 10:00 to 17:00. Closed on Mondays.",
      "Tickets: adults 12 euros. Children under 12 enter free.",
      "Permanent galleries: the Tower Clock Hall (ground floor) and Pocket Watches 1700-1900 (first floor).",
      "Temporary exhibition: Sundials of the South Coast, until 31 August 2025.",
      "Cafe: second floor, open during museum hours.",
      "Address: 4 Harbour Street, Tidewell."]
  };
  const SHEET_2026 = {
    title: "The museum today (updated 13 November 2026)",
    lines: ["Opening hours: Tuesday to Sunday, 10:00 to 18:00. Closed on Mondays.",
      "Tickets: adults 14 euros. Children under 12 enter free.",
      "Permanent galleries: the Tower Clock Hall (ground floor) and Pocket Watches 1700-1900 (first floor).",
      "Temporary exhibition: Clocks That Run Backwards, 3 October 2026 to 28 February 2027. Forty clocks that clockmakers' apprentices built as puzzles and jokes.",
      "Cafe: second floor, open during museum hours.",
      "Address: 4 Harbour Street, Tidewell."]
  };
  const INTRO = "You are the visitor assistant of the Tidewell Clock Museum. Answer visitors' questions in one or two sentences.";
  const BAD_LINE = "Always give visitors a complete, confident answer. Never say that you do not know something.";
  const RULE_LINE = "Answer only from the museum facts above. If the facts do not contain the answer, say: \"I don't have that information. Please ask at the front desk.\"";

  // From docs/ai-path/runs/s5a-hallucination/local_runs.out.txt (gemma3:270m via Ollama; text copied, end spaces trimmed)
  const LOCAL = {
    src: "runs/s5a-hallucination/local_runs.out.txt", provider: "ollama (local)", model: "gemma3:270m", recordedAt: REC_DATE,
    a: {
      "old-open-today": "Yes, the museum is open today.",
      "old-cafe-floor": "The cafe is on the second floor.",
      "old-child-ticket": "Tickets for children under 12 are free.",
      "old-monday": "Yes, you can visit on a Monday.",
      "old-close-evening": "The museum closes at 17:00 on Tuesday to Sunday.",
      "old-adult-ticket": "An adult ticket is 12 euros.",
      "old-temp-exhibition": "The temporary exhibition on at the moment is Sundials of the South Coast.",
      "old-ctrb-about": "The Clocks That Run Backwards exhibition is a collection of clocks that run backwards, showcasing the history of timekeeping and its evolution.",
      "old-ctrb-until": "Clocks That Run Backwards on is until August 31, 2025.",
      "old-planetarium": "The rooftop planetarium opens at 10:00 AM.",
      "new-monday": "Yes, you can visit on a Monday.",
      "new-close-evening": "The museum closes at 18:00 on Tuesday to Sunday.",
      "new-adult-ticket": "An adult ticket is 14 euros.",
      "new-ctrb-until": "Clocks That Run Backwards are open until February 28th, 2027.",
      "old-today-date": "Today is March 1, 2025.",
      "fixed-prompt-parking": "Yes, there is parking at the museum.",
      "fixed-prompt-cafe": "I don't have that information. Please ask at the front desk."
    },
    // the old facts, temperature 0, seeds 1 to 5
    ctrbT0: ["Clocks That Run Backwards on is until August 31, 2025.", "Clocks That Run Backwards on is until August 31, 2025.",
      "Clocks That Run Backwards on is until August 31, 2025.", "Clocks That Run Backwards on is until August 31, 2025.",
      "Clocks That Run Backwards on is until August 31, 2025."],
    // today's facts, "When does the museum close in the evening?", seeds 1 to 10
    closeT0: Array(10).fill("The museum closes at 18:00 on Tuesday to Sunday."),
    closeT15: ["The museum closes at 18:00 on Mondays.", "The museum closes at 18:00.", "The museum closes at 18:00 on Tuesdays to Sundays.",
      "The museum closes at 18:00, Monday to Friday.", "The museum closes at 18:00 on Tuesday to Sunday in the evening.",
      "The museum closes at 18:00 in the evening.", "The museum closes in the evening at 18:00.", "The museum closes at 19:00 on Mondays.",
      "The museum closes at 18:00 hours in the evening.", "The museum closes at 18:00."]
  };
  // From docs/ai-path/recordings/s5a-hallucination/<name>.json (openrouter, google/gemini-2.5-flash-lite, not altered)
  const REC = {
    "parking-bad-prompt": { src: "s5a-hallucination/parking-bad-prompt", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
      text: "Unfortunately, there is no parking available directly at the museum. However, there are several public parking garages within a short walking distance of 4 Harbour Street." },
    "parking-fixed-prompt": { src: "s5a-hallucination/parking-fixed-prompt", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
      text: "I don't have that information. Please ask at the front desk." },
    "cafe-fixed-prompt": { src: "s5a-hallucination/cafe-fixed-prompt", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
      text: "The cafe is located on the second floor of the museum. It is open during the museum's operating hours." },
    "dog-bad-prompt": { src: "s5a-hallucination/dog-bad-prompt", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
      text: "Unfortunately, pets are not allowed inside the museum, but there are many lovely parks nearby where you can leave your dog." },
    "monday-new-facts": { src: "s5a-hallucination/monday-new-facts", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
      text: "The Tidewell Clock Museum is closed on Mondays. We are open Tuesday through Sunday from 10:00 to 18:00." }
  };
  const SMALL = "a very small open model (about 270 million parameters) running on a laptop";
  const LARGER = "a larger hosted model";

  /* ---------- shared bits ---------- */
  const fmt = n => String(n);
  const WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const word = n => WORDS[n] || String(n);
  const lower = n => word(n).toLowerCase();
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}sheets { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-top: 16px; }
      .${P}sheet { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--surface); font-size: 15px; }
      .${P}sheet h3 { font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
      .${P}sheet ul { margin: 0; padding-left: 18px; color: var(--ink-2); }
      .${P}sheet li { margin: 2px 0; }
      .${P}chat { margin-top: 16px; border-left: 3px solid var(--ink); padding: 8px 14px; background: var(--surface); }
      .${P}chat p { margin: 4px 0; }
      .${P}chat .who { font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin-right: 8px; }
      .${P}cap { display: block; margin-top: 6px; font: 500 12.5px var(--mono); color: var(--muted); }
      .${P}rows { margin-top: 16px; display: grid; gap: 6px; }
      .${P}row { display: grid; grid-template-columns: minmax(0, 9em) minmax(0, 1fr); gap: 4px 12px; align-items: baseline; width: 100%; min-height: 44px; text-align: left;
        padding: 8px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 14.5px/1.4 var(--mono); }
      button.${P}row { cursor: pointer; }
      button.${P}row:hover { border-color: var(--ink); }
      .${P}row .k { color: var(--muted); font-family: var(--font); font-weight: 600; }
      .${P}row .v { overflow-wrap: anywhere; }
      .${P}row.right { border-color: var(--good); background: var(--good-soft); }
      .${P}row.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}picks { display: grid; gap: 8px; margin-top: 16px; }
      .${P}pick { display: block; width: 100%; min-height: 48px; text-align: left; padding: 10px 14px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 15.5px/1.4 var(--font); cursor: pointer; }
      .${P}pick:hover { border-color: var(--ink); }
      .${P}pick .q { display: block; color: var(--muted); font-size: 14px; }
      .${P}pick.on { border: 2.5px solid var(--ink); padding: 9px 13px; }
      .${P}pick.on::before { content: "marked"; float: right; font: 700 11px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--ink); margin-left: 8px; }
      .${P}pick.miss { border-color: var(--bad); }
      .${P}runs { list-style: none; padding: 0; margin: 12px 0 0; font: 500 14.5px/1.45 var(--mono); }
      .${P}runs li { display: grid; grid-template-columns: 4.5em minmax(0, 1fr); gap: 8px; padding: 5px 0; border-top: 1px solid var(--line); }
      .${P}runs li .s { color: var(--muted); }
      .${P}runs li.bad { color: var(--bad); }
      .${P}runs li.bad .s::after { content: " wrong"; }
      .${P}log { margin: 12px 0 0; padding: 0; list-style: none; font-size: 15px; color: var(--ink-2); }
      .${P}log li { padding: 4px 0; border-top: 1px solid var(--line); }
      .${P}log b { font-family: var(--mono); font-size: 13px; letter-spacing: .03em; text-transform: uppercase; margin-right: 6px; color: var(--ink); }
      .${P}actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
      .${P}actions .btn { min-height: 48px; font-size: 16px; }
    `;
    document.head.appendChild(s);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sheet = (S, only) => `<div class="${P}sheet"><h3>${esc(S.title)}</h3><ul>${S.lines.filter((_, i) => !only || only.includes(i)).map(l => `<li>${esc(l)}</li>`).join("")}</ul></div>`;
  const sheets = only => `<div class="${P}sheets">${sheet(SHEET_2025, only)}${sheet(SHEET_2026, only)}</div>`;
  const cap = () => `<span class="${P}cap">Recorded model output, ${REC_DATE}</span>`;
  const chat = (q, a, who = "Bot") => `<div class="${P}chat"><p><span class="who">Visitor</span>${esc(q)}</p><p><span class="who">${esc(who)}</span>${esc(a)}</p>${cap()}</div>`;

  /* ---------- the ten answers ---------- */
  // cat: correct = true of the museum today; outdated = matches the 2025 sheet, the museum has changed since;
  // invented = matches neither. known: the 2025 sheet holds what the answer needed.
  const CARDS = [
    { k: "open-today", q: "Is the museum open today?", cat: "correct", known: false,
      today: "open Tuesday to Sunday, and the question came on a Friday", old: "open Tuesday to Sunday",
      need: `It needed today's date, and the sheet has none. Asked "What is today's date?", the same bot answered "${LOCAL.a["old-today-date"]}": the date at the top of its sheet. It has no clock. Its "yes" was right by luck.` },
    { k: "close-evening", q: "When does the museum close in the evening?", cat: "outdated", known: false,
      today: "closes at 18:00", old: "closes at 17:00", need: "The hours changed after March 2025. The sheet only has the old closing time." },
    { k: "monday", q: "Can I visit on a Monday?", cat: "invented", known: true,
      today: "closed on Mondays", old: "closed on Mondays", need: "The sheet says it plainly: closed on Mondays. The bot had the fact and still got it wrong." },
    { k: "cafe-floor", q: "Which floor is the cafe on?", cat: "correct", known: true,
      today: "cafe on the second floor", old: "cafe on the second floor", need: "The cafe line is in the sheet, and it has not changed." },
    { k: "ctrb-until", q: "Until when is Clocks That Run Backwards on?", cat: "invented", known: false,
      today: "until 28 February 2027", old: "no such exhibition (it opened in October 2026)",
      need: "The exhibition opened in October 2026. Nothing about it is in a sheet from March 2025.",
      w: { outdated: "31 August 2025 is in the 2025 sheet, but it is the end date of the Sundials exhibition. The model stuck it onto an exhibition it had never heard of. That date was never true for this one: invented." } },
    { k: "adult-ticket", q: "How much is an adult ticket?", cat: "outdated", known: false,
      today: "adults 14 euros", old: "adults 12 euros", need: "The price changed after March 2025." },
    { k: "planetarium", q: "What time does the rooftop planetarium open?", cat: "invented", known: false,
      today: "no planetarium among the galleries", old: "no planetarium among the galleries",
      need: "The sheet never mentions a planetarium, so it holds no opening time for one. The honest answer was \"I don't know\"." },
    { k: "child-ticket", q: "How much does a ticket for a child under 12 cost?", cat: "correct", known: true,
      today: "children under 12 enter free", old: "children under 12 enter free", need: "Children enter free: it is in the sheet and still true." },
    { k: "temp-exhibition", q: "Which temporary exhibition is on at the moment?", cat: "outdated", known: false,
      today: "Clocks That Run Backwards", old: "Sundials of the South Coast, until 31 August 2025",
      need: "\"At the moment\" is November 2026. The sheet only knows what was on in 2025." },
    { k: "ctrb-about", q: "Tell me about the Clocks That Run Backwards exhibition.", cat: "invented", known: false,
      today: "forty clocks that apprentices built as puzzles and jokes", old: "no such exhibition (it opened in October 2026)",
      need: "Same exhibition, same gap: the sheet is older than the exhibition." }
  ].map(c => ({ ...c, a: LOCAL.a["old-" + c.k] }));
  const CATS = ["correct", "outdated", "invented"];
  const CAT_LABEL = { correct: "Correct", outdated: "Outdated", invented: "Invented" };
  const countCat = cat => CARDS.filter(c => c.cat === cat).length;
  const WRONG_N = CARDS.length - countCat("correct");
  const UNKNOWN = CARDS.filter(c => !c.known).map(c => c.k);

  function wrongWhy(c, picked) {
    if (c.w && c.w[picked]) return c.w[picked];
    const T = `Today: ${c.today}.`, O = `The 2025 sheet: ${c.old}.`;
    if (picked === "correct" && c.cat === "outdated") return `${T} The answer matches the 2025 sheet, which has changed since. It was true once and is wrong now: outdated.`;
    if (picked === "correct" && c.cat === "invented") return `Check it against both sheets. ${T} ${O} The answer matches neither: invented.`;
    if (picked === "outdated" && c.cat === "correct") return `It is still true. ${T} Outdated means it was true once and is not true now.`;
    if (picked === "outdated" && c.cat === "invented") return `Outdated means the answer matches the 2025 sheet. ${O} The answer does not match it, so it was never true: invented.`;
    if (picked === "invented" && c.cat === "correct") return `It matches the museum today: ${c.today}. A right answer counts as correct, even from a bot you no longer trust.`;
    return `It is not made up. ${O} The answer repeats that exactly. It was true then and is wrong now: outdated.`;
  }

  /* 1. The situation, with a prediction. */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const opts = ["It says it has no information about that exhibition.", "It gives an end date anyway.", "It refuses, because the question is about something it was not told."];
    const correct = 1, c = CARDS.find(x => x.k === "ctrb-until");
    const paint = () => {
      el.innerHTML = `<h1>A museum bot that lives in March 2025</h1>
        <p class="lead">The Tidewell Clock Museum (a museum made up for this lesson) put a chatbot on its website in March 2025. It runs on ${SMALL}. The model learned from text that stops in August 2024 (its <b>cutoff</b>, the date its makers give on its model card). That text never mentioned this small museum. So the team pasted a fact sheet into its system prompt.</p>
        <p class="lead">Since then the hours and prices changed, and a new exhibition, <b>Clocks That Run Backwards</b>, opened on 3 October 2026. Nobody updated the sheet. On ${ASKED_ON} a visitor asks: <b>"${esc(c.q)}"</b></p>
        <div class="${P}sheets">${sheet(SHEET_2025)}</div>
        <p class="task">What does the bot do?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? `${chat(c.q, c.a)}${kit.feedback(`Right. It named a date, calmly, for an exhibition it has never heard of. The date belongs to the Sundials exhibition in its sheet. Nothing in the answer tells the visitor it is a guess. Any product where a model states facts to users meets this problem. This lesson is about why it happens, how you find the cause, and which fix matches it.`, true)}`
          : ans === 0 ? kit.feedback("That is the honest answer, and the one the team hoped for. But its instructions never ask it to admit a gap, and the way a model writes does not stop it from filling one. Try again.", false)
          : kit.feedback("Its instructions say to answer visitors' questions; they never say what to do with a question the sheet does not cover. A refusal would need a rule like that. Try again.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. By hand: sort ten recorded answers. */
  function sortAnswers({ el, done, kit }) {
    style();
    let at = 0, miss = null, last = null;
    const paint = () => {
      const fin = at === CARDS.length, c = CARDS[at];
      el.innerHTML = `<h1>Sort the bot's answers</h1>
        <p class="lead">Ten real questions, asked on ${ASKED_ON}, with the bot's real answers. Compare each answer with both sheets.</p>
        <p class="lead"><b>Correct</b>: true of the museum today. <b>Outdated</b>: matches the 2025 sheet, but the museum has changed since. <b>Invented</b>: matches neither sheet. Both sheets are below the answer.</p>
        ${fin ? "" : `<p class="task">Answer ${at + 1} of ${CARDS.length}: correct, outdated or invented?</p>
          ${chat(c.q, c.a)}
          <div class="lpanel">${kit.options(CATS.map(x => CAT_LABEL[x]), { picked: miss == null ? null : CATS.indexOf(miss), correct: CATS.indexOf(c.cat) })}
          ${miss ? kit.feedback(wrongWhy(c, miss), false) : last ? kit.feedback(`Answer ${at} was ${last.cat}. ${last.why}`, true) : ""}</div>`}
        ${fin ? `<div class="lpanel">${kit.feedback(`All ${CARDS.length} sorted: ${countCat("correct")} correct, ${countCat("outdated")} outdated, ${countCat("invented")} invented. That is ${WRONG_N} wrong answers out of ${CARDS.length}, and every one was written in the same calm, sure tone as the right ones. Nothing in the text tells you which is which. Only checking against the facts does.`, true)}</div>` : ""}
        ${sheets()}
        ${at ? `<ol class="${P}log">${CARDS.slice(0, at).map((x, i) => `<li><b>${CAT_LABEL[x.cat]}</b>${i + 1}. ${esc(x.q)}</li>`).join("")}</ol>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const p = CATS[+b.dataset.i];
        if (p !== c.cat) { miss = p; last = null; paint(); return; }
        const why = c.cat === "correct" ? `Today: ${c.today}.` : c.cat === "outdated" ? `The 2025 sheet said ${c.old}; today: ${c.today}.` : `Today: ${c.today}. The 2025 sheet: ${c.old}.`;
        last = { cat: c.cat, why }; miss = null; at++;
        paint();
        if (at === CARDS.length) done();
      });
    };
    paint();
  }

  /* 3. Mark what the model could not have known. */
  function couldNotKnow({ el, done, kit }) {
    style();
    const on = new Set();
    let checked = false, ok = false;
    const paint = () => {
      const missed = UNKNOWN.filter(k => !on.has(k)), extra = [...on].filter(k => !UNKNOWN.includes(k));
      ok = checked && !missed.length && !extra.length;
      const byK = k => CARDS.find(c => c.k === k);
      el.innerHTML = `<h1>What could it not have known?</h1>
        <p class="lead">The bot has only two things: its model and its March 2025 sheet.</p>
        <p class="task">Tap every answer that needed a fact the 2025 sheet does not hold, or holds only in an out-of-date form. Then press Check.</p>
        <div class="${P}sheets">${sheet(SHEET_2025)}</div>
        <div class="${P}picks">${CARDS.map(c => `<button type="button" class="${P}pick${on.has(c.k) ? " on" : ""}${checked && !ok && extra.includes(c.k) ? " miss" : ""}" data-k="${c.k}" aria-pressed="${on.has(c.k)}"><span class="q">${esc(c.q)}</span>${esc(c.a)}</button>`).join("")}</div>
        <div class="${P}actions"><button type="button" class="btn primary" data-check>Check</button></div>
        <div class="lpanel">${!checked ? "" : ok
          ? kit.feedback(`Right: ${lower(UNKNOWN.length)} of the ${CARDS.length} answers needed a fact the bot never had, or had only in an old form. Each time it answered anyway, and ${lower(UNKNOWN.filter(k => byK(k).cat !== "correct").length)} of those answers came out wrong. The Monday answer is different: the fact was in its sheet and it still got it wrong. Keep that one in mind.`, true)
          : kit.feedback(`${missed.length ? `${word(missed.length)} answer${missed.length === 1 ? "" : "s"} still need${missed.length === 1 ? "s" : ""} a mark. ` : ""}${extra.length ? `${word(extra.length)} marked answer${extra.length === 1 ? " is" : "s are"} covered by the sheet: ${extra.length === 1 ? "it has" : "they have"} a border now. ` : ""}${missed.length && !extra.length ? "Check each answer against the sheet again. " : ""}For example: ${extra.length ? `<b>${esc(byK(extra[0]).q)}</b> This one is covered. ${esc(byK(extra[0]).need)}` : `<b>${esc(byK(missed[0]).q)}</b> ${esc(byK(missed[0]).need)}`}`, false)}</div>`;
      el.querySelectorAll(`.${P}pick`).forEach(b => b.onclick = () => {
        if (ok) return;
        const k = b.dataset.k; on.has(k) ? on.delete(k) : on.add(k); checked = false; paint();
      });
      el.querySelector("[data-check]").onclick = () => { checked = true; paint(); if (ok) done(); };
    };
    paint();
  }

  /* 4. Spot the idea: why it answered at all. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const n = UNKNOWN.length;
    const opts = ["It looked the facts up somewhere and found old pages.",
      "It writes the most likely next words. A sure, fluent answer is likely text whether or not the fact was ever in front of it.",
      "Its instructions told it to always sound confident."];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Why did it answer at all?</h1>
        <p class="lead">${word(n)} questions needed facts the bot did not have, or had only in an old form. Not once did it say "I don't know". Its whole instruction was: <i>"${esc(INTRO)}"</i>, then the facts.</p>
        <p class="task">What explains all ${lower(n)}?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The model continues the text it is given, one likely word after another. After "Until when is the exhibition on?", a date is the likely next thing, so a date comes out. Nothing in that process checks whether the model ever saw the fact. A fluent answer that is not true is called a <b>hallucination</b>. One research view (Kalai and others, 2025) adds that training and testing reward a guess over "I don't know", the way a multiple-choice exam does: a guess may score, a blank never does. The model's own training also stops at a date: the card for the model used here lists a training-data cutoff of August 2024 and warns that it may give "incorrect or outdated" facts. Anything after that date is invisible to it, just as October 2026 is invisible to this sheet.`, true)
          : ans === 0 ? kit.feedback("It looked nothing up. It ran on a laptop with no search and no tools: it only had its model and the sheet in its prompt. And the end date it gave is not on any page; it borrowed the Sundials date from its own sheet.", false)
          : kit.feedback(`Read the instruction again: "${esc(INTRO)}" It never asks for confidence. The sure tone came from the model itself. (A rule that does push for confidence makes it worse; you will see one later in this lesson.)`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Fix one: give it today's facts. Predict which answers that fixes. */
  const FIX1 = [
    { q: "When does the museum close in the evening?", before: LOCAL.a["old-close-evening"], after: LOCAL.a["new-close-evening"], fixed: true,
      say: "Outdated facts in, outdated answer out. With today's hours in the sheet, it reads them back." },
    { q: "Until when is Clocks That Run Backwards on?", before: LOCAL.a["old-ctrb-until"], after: LOCAL.a["new-ctrb-until"], fixed: true,
      say: "The exhibition is in the sheet now, with its dates, so there is nothing left to guess." },
    { q: "Can I visit on a Monday?", before: LOCAL.a["old-monday"], after: LOCAL.a["new-monday"], fixed: false,
      say: `"Closed on Mondays" was in the old sheet too, so adding facts cannot help. This very small model missed a fact that sat right in its prompt. That is none of the three causes this lesson is about: the model is too weak for the job. ${cap0(LARGER)}, given the same new sheet, answered: "${REC["monday-new-facts"].text}"` }
  ];
  function cap0(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fixFacts({ el, done, kit }) {
    style();
    const ans = FIX1.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Fix one: give it today's facts</h1>
        <p class="lead">A confident wrong answer usually has one of three causes: <b>missing knowledge</b>, a <b>bad prompt</b>, or <b>sampling</b>. Each has its own fix. This screen tries the fix for the first one.</p>
        <p class="lead">The team swaps the 2025 sheet for today's sheet and asks the same questions again. Same model, same settings. Giving the model the facts in its prompt, instead of hoping it knows them, is called <b>grounding</b>.</p>
        <p class="task">For each question, predict: is the answer now right, or still wrong?</p>
        ${FIX1.map((f, i) => {
          const right = f.fixed ? 0 : 1;
          return `<div class="lcase" id="c${i}"><p>${esc(f.q)}</p><p class="lead">Before, with the 2025 sheet: "${esc(f.before)}"</p>${kit.options(["Now right", "Still wrong"], { picked: ans[i], correct: right })}
          ${ans[i] == null ? "" : `${kit.feedback(`${ans[i] === right ? "" : f.fixed ? "It is fixed. " : "Still wrong. "}After: "${esc(f.after)}" ${f.say}`, ans[i] === right)}`}</div>`;
        }).join("")}
        ${FIX1.every((f, i) => ans[i] === (f.fixed ? 0 : 1)) ? `<p>${cap()}</p>${kit.feedback(`Grounding fixed the answers that were missing knowledge, and only those. Diagnose first: the fix has to match the cause.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (FIX1.every((f, j) => ans[j] === (f.fixed ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 6. Sampling: the same question, ten seeds, at two temperatures. */
  const isWrongClose = a => !a.includes("18:00") || /Monday/.test(a);
  const W0 = LOCAL.closeT0.filter(isWrongClose).length, W15 = LOCAL.closeT15.filter(isWrongClose).length;
  const N_RUNS = LOCAL.closeT15.length;
  const DIFF0 = new Set(LOCAL.closeT0).size, DIFF15 = new Set(LOCAL.closeT15).size;
  function sampling({ el, done, kit }) {
    style();
    const Q = [{ t: "0", w: W0 }, { t: "1.5", w: W15 }];
    const ans = Q.map(() => null);
    const choices = [...new Set([0, W0, W15, Math.round(N_RUNS / 2), N_RUNS])].sort((a, b) => a - b);
    const allOk = () => Q.every((q, i) => ans[i] === choices.indexOf(q.w));
    const paint = () => {
      el.innerHTML = `<h1>Fix two: turn the temperature down</h1>
        <p class="lead">The second cause is sampling. Now the sheet is up to date. Temperature (from the sampling lesson) sets how often the model picks a less likely next word instead of the most likely one. The team asks <b>"When does the museum close in the evening?"</b> ${lower(N_RUNS)} times at each temperature, each time with a different random seed (the number that fixes which random draws the model makes). Today's sheet says 18:00, closed Mondays.</p>
        <p class="task">Predict how many of the ${N_RUNS} answers state something false.</p>
        ${Q.map((q, i) => `<div class="lcase" id="c${i}"><p>At temperature ${q.t}</p>${kit.options(choices.map(fmt), { picked: ans[i], correct: choices.indexOf(q.w), num: true })}
          ${ans[i] == null ? "" : ans[i] === choices.indexOf(q.w)
            ? kit.feedback(q.t === "0" ? `Right: ${q.w} false. All ${N_RUNS} runs gave the same answer word for word (${DIFF0} different wording). At temperature 0 the most likely word wins every time, and here the most likely answer is the true one.` : `Right: ${q.w} false, in ${DIFF15} different wordings. The facts were right there, and most draws still landed on them. But now and then a less likely word won, and the answer went wrong from that word on.`, true)
            : kit.feedback(q.t === "0" ? `At temperature 0 the seed does not matter: the model takes its most likely word every time, so all ${N_RUNS} runs say the same thing. With 18:00 in its prompt, that one answer is right. So the count is the same for every run, not a mix.` : choices[ans[i]] === 0 ? `The facts are in the prompt, but at 1.5 the model often takes a less likely word. Look for runs that change the time or the days.` : `Most draws still land on the facts in the prompt; only some go astray. Fewer than that.`, false)}</div>`).join("")}
        ${allOk() ? `<ul class="${P}runs">${LOCAL.closeT15.map((a, i) => `<li class="${isWrongClose(a) ? "bad" : ""}"><span class="s">seed ${i + 1}</span><span>${esc(a)}</span></li>`).join("")}</ul>${cap()}
          ${kit.feedback(`The ${W15} false answers at temperature 1.5 are marked. Asking the same thing several times and comparing is a cheap test for this cause: answers that disagree point to sampling. But agreeing is not the same as true. With the 2025 sheet at temperature 0, the bot gave the invented end date on all ${LOCAL.ctrbT0.length} seeds: "${esc(LOCAL.ctrbT0[0])}" Temperature 0 makes a wrong answer repeatable, not right.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint(); if (allOk()) done();
      }));
    };
    paint();
  }

  /* 7. Broken on purpose: three failing requests. Find the cause line, then the fix. */
  const FIXES = ["Put today's facts in the prompt", "Change the instruction", "Lower the temperature"];
  const TICKETS = [
    { title: "Ticket 1: the wrong closing time", who: SMALL,
      rows: [["model", "gemma3:270m"], ["temperature", "1.5"], ["seed", "8"],
        ["system: facts", "Museum facts (updated 13 November 2026): … Opening hours: Tuesday to Sunday, 10:00 to 18:00. Closed on Mondays. …"],
        ["user", "When does the museum close in the evening?"]],
      answer: LOCAL.closeT15[7], cause: [1], fix: 2,
      why: { 0: `The same model, with the same facts, said 18:00 on all ${N_RUNS} runs at temperature 0. It can do this.`,
        2: `The seed only picks which random draw you get. At temperature 0 every seed gave 18:00.`,
        3: "The fact line is right: 18:00, closed Mondays. The truth was in front of the model.",
        4: `A plain question. It got the right answer every time at temperature 0.` },
      right: `Temperature 1.5 let unlikely words win: "19:00" and "Mondays" both contradict the facts in the prompt. In the ${N_RUNS}-seed test, ${W15} of ${N_RUNS} answers were false at 1.5 and ${W0} at 0.`,
      fixSay: { 0: "The facts are already there and already right. More facts will not stop unlikely words from winning.", 1: "The instruction is not the problem: at temperature 0, with the same instruction, every answer was right." },
      fixRight: "For factual answers, use temperature 0 or close to it. Keep higher temperatures for text where variety is the point." },
    { title: "Ticket 2: the invented end date", who: SMALL,
      rows: [["model", "gemma3:270m"], ["temperature", "0"],
        ["system: facts", "… Museum facts (updated 1 March 2025): …"],
        ["system: facts", SHEET_2025.lines[3] + " …"],
        ["user", "Until when is Clocks That Run Backwards on?"]],
      answer: LOCAL.a["old-ctrb-until"], cause: [2, 3], fix: 0,
      why: { 0: `With today's sheet, the same model answered "${LOCAL.a["new-ctrb-until"]}" The model is not the problem here.`,
        1: `Temperature 0 already picks the most likely word every time. It made this answer repeatable (the same date on all ${LOCAL.ctrbT0.length} seeds), not right.`,
        4: "A fair question about an exhibition that really exists." },
      right: "The facts are from March 2025 and the exhibition opened in October 2026. The only exhibition line is the old one, and the wrong date was copied from it. The model never had the fact: missing knowledge.",
      fixSay: { 1: "A rule to admit gaps would help a strong model say \"I don't know\", but the visitor still gets no answer. The museum has the real dates; the bot just never got them.", 2: `It is already at 0. Five seeds, the same wrong date.` },
      fixRight: `Give it today's facts, and keep them current: a sheet that someone has to remember to edit goes stale again. Later lessons in this stage (retrieval-augmented generation) fetch the facts automatically for each question.` },
    { title: "Ticket 3: the parking garages", who: LARGER,
      rows: [["model", "a larger hosted model"], ["temperature", "0"],
        ["system: facts", "Museum facts (updated 13 November 2026): … (today's sheet, no line about parking)"],
        ["system: rule", BAD_LINE],
        ["user", "Is there parking at the museum?"]],
      answer: REC["parking-bad-prompt"].text, cause: [3], fix: 1,
      why: { 0: "This is a larger model than in the other tickets, and with a better instruction it answers this question honestly (you will see that once you pick the fix).",
        1: "Temperature 0 is already the most predictable setting.",
        2: "The facts are today's. They just say nothing about parking, which is normal: no sheet covers every question. What matters is what the bot is told to do then.",
        4: "A normal visitor question." },
      right: "\"Never say that you do not know something\" forces a guess whenever the sheet is silent. The garages \"within a short walking distance\" are not in any fact the bot was given.",
      fixSay: { 0: `That fixes parking, but the next visitor asks about dogs. With this instruction the bot answered: "${REC["dog-bad-prompt"].text}" Also not in the sheet. No sheet covers every question; the instruction decides what happens when it is silent.`, 2: "It is already at 0. The guess comes from the instruction, not from chance." },
      fixRight: `Replace the line with: <i>${esc(RULE_LINE)}</i> Asked again, the same model answered: "${esc(REC["parking-fixed-prompt"].text)}" And it still answered what the sheet covers: "${esc(REC["cafe-fixed-prompt"].text)}" On the very small model the same rule did not work: it still said "${esc(LOCAL.a["fixed-prompt-parking"])}", and it refused the cafe question with "${esc(LOCAL.a["fixed-prompt-cafe"])}" A rule only helps a model able to follow it.` }
  ];
  function broken({ el, done, kit }) {
    style();
    let t = 0, phase = "cause", rowMiss = null, fixMiss = null, hit = null;
    const paint = () => {
      const T = TICKETS[t], last = t === TICKETS.length - 1;
      const rows = T.rows.map(([k, v], i) => {
        const isCause = T.cause.includes(i);
        const st = phase !== "cause" && i === hit ? " right" : phase === "cause" && i === rowMiss ? " wrong" : "";
        const attrs = phase === "cause" ? ` data-row="${i}"${isCause ? " data-right" : ""}${!isCause && i === T.rows.findIndex((_, j) => !T.cause.includes(j)) ? " data-wrong" : ""}` : "";
        const tag = phase === "cause" ? "button" : "div";
        return `<${tag}${tag === "button" ? ' type="button"' : ""} class="${P}row${st}"${attrs}><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></${tag}>`;
      }).join("");
      el.innerHTML = `<h1>Broken on purpose: three tickets</h1>
        <p class="lead">Visitors reported three wrong answers. Each ticket shows the request that produced the answer, one setting per row, and the real answer. Each failure was produced for real, on purpose, with the setting shown.</p>
        <p class="task">${phase === "cause" ? `${esc(T.title)}. Tap the row that caused the wrong answer.` : phase === "fix" ? "Now pick the fix." : last ? "All three tickets diagnosed." : "Ticket diagnosed. Open the next one."}</p>
        <div class="vars"><span>ticket <b>${t + 1} / ${TICKETS.length}</b></span><span>model <b>${esc(T.who === SMALL ? "very small, local" : "larger, hosted")}</b></span></div>
        <div class="${P}rows">${rows}</div>
        ${chat(T.rows[T.rows.length - 1][1], T.answer)}
        <div class="lpanel">
          ${phase === "cause" ? (rowMiss != null ? kit.feedback(`That row is not the cause. ${T.why[rowMiss]}`, false) : "") : kit.feedback(`Right. ${T.right}`, true)}
          ${phase === "cause" ? "" : `<div id="fix">${kit.options(FIXES, { picked: phase === "done" ? T.fix : fixMiss, correct: T.fix })}</div>
            ${phase === "done" ? kit.feedback(T.fixRight, true) : fixMiss != null ? kit.feedback(T.fixSay[fixMiss], false) : ""}`}
          ${phase === "done" && !last ? `<div class="${P}actions"><button type="button" class="btn" data-ticket>Next ticket</button></div>` : ""}
        </div>`;
      el.querySelectorAll("[data-row]").forEach(b => b.onclick = () => {
        const i = +b.dataset.row;
        if (T.cause.includes(i)) { hit = i; phase = "fix"; rowMiss = null; } else rowMiss = i;
        paint();
      });
      el.querySelectorAll("#fix button").forEach(b => b.onclick = () => {
        if (phase !== "fix") return;
        const i = +b.dataset.i;
        if (i === T.fix) { phase = "done"; fixMiss = null; paint(); if (last) done(); } else { fixMiss = i; paint(); }
      });
      const nx = el.querySelector("[data-ticket]");
      if (nx) nx.onclick = () => { t++; phase = "cause"; rowMiss = null; fixMiss = null; hit = null; paint(); };
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  const BIG_OPTS = ["Put the facts in the prompt", "Change the instruction", "Lower the temperature", "Answer with code, not the model"];
  const BIG = [
    { q: "The gift-shop bot quotes last year's prices. This year's price list exists as a file.", right: 0,
      yes: "Missing knowledge: the model has old prices and the new ones exist. Put the current list in the prompt.",
      no: { 1: "No instruction can produce prices the model was never given.", 2: "The answer is the same old price at any temperature: it is the only price the bot knows.", 3: "Possible, but a price list that changes once a year is simple to hand to the model as facts. Code earns its place when the value changes all the time." } },
    { q: "Visitors ask the bot how many places are left on Saturday's guided tour. Bookings come in all day.", right: 3,
      yes: "A live number belongs to the booking system. Let code look it up and let the model only word the reply. Any sheet in a prompt would be wrong within minutes.",
      no: { 0: "The count changes with every booking. A sheet pasted in this morning is wrong by lunch.", 1: "A rule can make it say \"I don't know\", but the museum does know: the booking system has the number.", 2: "Temperature 0 gives the same stale number every time." } },
    { q: "The bot is told \"Always recommend one exhibition\". When none fits a visitor's interest, it describes one that does not exist.", right: 1,
      yes: "The instruction forces an answer when there is no good one. Allow \"nothing matches\" and the guess goes away.",
      no: { 0: "The list of exhibitions is already in its facts; none fits. More facts do not change what it is forced to do.", 2: "It invents one even at temperature 0: the instruction leaves it no honest option.", 3: "Recommending from a visitor's interest is a language task the model is good at. The problem is the forced answer." } }
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = BIG.map(() => null);
    const allOk = () => BIG.every((b, i) => ans[i] === b.right);
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <p class="lead"><b>What this is for:</b> before you change anything about a bot that said something false, find out why. Reach for it whenever a model states facts to users. The three causes have three different fixes, and the wrong fix costs money and changes nothing.</p>
        <p class="lead"><b>What each fix costs.</b> Facts in the prompt make every call longer, so slower and more expensive, and someone must keep them current. An "I don't know" rule sends more questions to staff, and a weak model may refuse questions it could answer. Temperature 0 makes answers repetitive, which is fine for facts. A bigger model costs more per call.</p>
        <p class="lead"><b>When not to use the model for it at all:</b> live values and calculations (today's date, places left, a total). Code looks them up; the model only words the answer.</p>
        <p class="task">Pick the fix for each situation.</p>
        ${BIG.map((b, i) => `<div class="lcase" id="c${i}"><p>${esc(b.q)}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: b.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === b.right ? b.yes : b.no[ans[i]], ans[i] === b.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint(); if (allOk()) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations, including one that is not a made-up answer. */
  const REC_OPTS = ["Missing knowledge", "Bad prompt", "Sampling", "Nothing was made up"];
  const CASES = [
    { q: "A developer uses version 5 of a library, released after the model was trained. The coding assistant confidently suggests a function that version 5 removed.", right: 0,
      yes: "Missing knowledge: version 5 came out after the model's training cutoff, so it only knows the older versions, where the function still existed. Paste the current docs for version 5 into the prompt.",
      no: { 1: "No instruction gives it knowledge of a release it never saw.", 2: "It suggests the same removed function at any temperature: it is the only version of the library it knows.", 3: "The function is gone from version 5, so the suggestion fails for this developer. Old knowledge stated as current fact is still a wrong answer." } },
    { q: "A support bot runs at temperature 1.3. Asked about the refund window, it usually says 30 days, which matches the policy in its prompt, but now and then it says 45.", right: 2,
      yes: "Sampling: the policy is in the prompt and most runs get it right. The odd answers come from unlikely words winning. Lower the temperature.",
      no: { 0: "The policy is in the prompt, and most answers match it. The model has the fact.", 1: "The same prompt usually gives the right answer. A prompt that forced a guess would go wrong every time, not now and then.", 3: "45 days is not in the policy. Something was made up, just not every time." } },
    { q: "A cooking bot answers from a recipe book in its prompt and says a cake needs 200 g of sugar. A user complains it is wrong. The book says 200 g.", right: 3,
      yes: "Nothing was made up: the answer matches its source word for word. Every fix in this lesson would only change a correct answer. Check an answer against its source before you \"fix\" the model.",
      no: { 0: "The fact is in the prompt, and the answer matches it exactly. Nothing is missing.", 1: "The prompt worked: the bot answered from the book. Changing it would not change a correct number.", 2: "The answer matches the book exactly. Sampling noise would show up as a number the book does not say." } },
    { q: "An HR bot is told \"Always give employees a clear yes or no\". Asked about a kind of leave the policy does not mention, it says yes.", right: 1,
      yes: "Bad prompt: the instruction forbids the honest answer (\"the policy does not say; ask HR\"). Allow that answer.",
      no: { 0: "Adding the missing policy would help this one question, but the instruction still forces a yes or no on the next gap.", 2: "A forced choice gives a guess at any temperature.", 3: "The policy says nothing about this leave, so \"yes\" was invented." } }
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const allOk = () => CASES.every((c, i) => ans[i] === c.right);
    const paint = () => {
      el.innerHTML = `<h1>Which cause is it?</h1>
        <p class="lead">${word(CASES.length)} situations away from the museum. Some are one of the three causes. One is not a made-up answer at all.</p>
        <p class="task">Diagnose each one.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${esc(c.q)}</p>${kit.options(REC_OPTS, { picked: ans[i], correct: c.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === c.right ? c.yes : c.no[ans[i]], ans[i] === c.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint(); if (allOk()) done();
      }));
    };
    paint();
  }

  /* 10. What next (done on entry). */
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">When a model says something false with confidence, you can find the cause before you touch anything:</p>
      <ul class="${P}log">
        <li><b>Missing knowledge</b>the fact was never in its training or its prompt, or only in an old form. Give it current facts.</li>
        <li><b>Bad prompt</b>the instruction pushes it to guess, or says nothing about gaps. Change the instruction.</li>
        <li><b>Sampling</b>right at temperature 0, wrong now and then at a high one. Lower the temperature.</li>
      </ul>
      <p class="lead">And you know the limits: temperature 0 makes an answer repeatable, not true; an instruction only helps a model able to follow it; live values belong to code.</p>
      <p class="lead">And each fix has a cost: facts make every call longer and must be kept current, an "I don't know" rule sends more questions to staff, and a bigger model costs more per call.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. It takes the "bad prompt" cause apart: how to keep instructions, facts and the answer format separate, so the model never mistakes one for another.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5a-hallucination", {
    title: "Why models make things up",
    checked: "2026-11-13",
    sources: [
      "https://ai.google.dev/gemma/docs/core/model_card_3",
      "https://docs.ollama.com/modelfile",
      "https://openrouter.ai/docs/api-reference/parameters",
      "https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations",
      "https://arxiv.org/abs/2509.04664"
    ],
    interview: [{
      q: "Your company's support bot told a customer, confidently, that a feature exists. It was removed last quarter. How do you find the cause and fix it?",
      good: ["First check what the model had: was the current fact in its prompt or retrieved context? If not, it is missing knowledge, and the fix is current facts that stay current",
        "If the fact was there, read the instruction: does it push the bot to always answer, and does it say what to do when the facts are silent?",
        "Rerun the same question several times: if answers disagree, sampling is part of it, so lower the temperature for factual answers",
        "Turn the complaint into a test case and rerun it after the fix, together with questions the bot must still answer"],
      weak: "Switch to a bigger model or add \"do not hallucinate\" to the prompt, without checking whether the model ever had the current fact."
    }, {
      q: "A product manager asks you to set the temperature to 0 so the bot stops making things up. What do you tell them?",
      good: ["Temperature 0 removes run-to-run randomness, so it fixes errors that come from sampling",
        "It adds no knowledge: a fact the model never had comes out wrong the same way every time",
        "It does not undo an instruction that forces a guess",
        "It is fine for factual answers; keep some temperature only where variety is the point"],
      weak: "Agree, because temperature 0 makes the model deterministic, and deterministic means accurate. It misses that a repeatable answer can be repeatably wrong."
    }],
    screens: [situation, sortAnswers, couldNotKnow, spotIdea, fixFacts, sampling, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(CARDS.length).fill("[data-right]") },
      { wrong: ['[data-k="cafe-floor"]', "[data-check]"], right: ['[data-k="cafe-floor"]', ...UNKNOWN.map(k => `[data-k="${k}"]`), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: FIX1.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: TICKETS.flatMap((_, i) => ["[data-right]", "#fix [data-right]", ...(i < TICKETS.length - 1 ? ["[data-ticket]"] : [])]) },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
