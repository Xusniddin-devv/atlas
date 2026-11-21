/* Lesson s5b-golden-set: golden sets, the test cases you write first.
   Story: the recycling hotline bot of Kestrel Bay (a made-up city). The team shortened the bot's prompt, checked it
   with three questions they made up, saw three right answers and shipped. A week later the bot told residents they
   would be fined $40 the first time they put a bin out on the wrong day; the rule is a written warning first.
   Ideas: (1) a golden set is a fixed list of real questions from the log, each with the answer you expect and a tag,
   chosen to cover the common, the tricky and the out-of-scope, written before you change the bot and run on every
   version; (2) you score it with a check per case and read the score per tag, and you read the failing answers,
   because sometimes the check is what is wrong.
   Data:
   - The city's rules, the two prompts and the request files: docs/ai-path/runs/s5b-golden-set/make_requests.mjs
     (prompt-v1.txt = full rules, prompt-v2.txt = the shortened prompt that dropped the warning rule and the
     sticker rule).
   - The golden set with its checks, written before the bot was run: docs/ai-path/runs/s5b-golden-set/golden_set.json.
   - Recordings (scripts/ai/record.mjs, openrouter, google/gemini-2.5-flash-lite, temperature 0), 24 calls:
     docs/ai-path/recordings/s5b-golden-set/v1-qNN.json and v2-qNN.json. Copied in full into REC below.
   - The scoring run: docs/ai-path/runs/s5b-golden-set/score.py, output score.out.txt (the trace in TRACE, the full
     scores the lesson recomputes from REC and GOLDEN).
   The question pile and its counts are story data written for the lesson, not model output.
   Every count and score on screen is computed here. Lesson-local CSS: question cards, answer quotes, rule sheet,
   score table (prefix lx-s5b-golden-set-). Plain browser script. */
(() => {
  const P = "lx-s5b-golden-set-";
  const REC_DATE = "2026-11-13";

  // From docs/ai-path/recordings/s5b-golden-set/<v>-<id>.json (full text, not altered).
  const REC = {
    src: "s5b-golden-set/<v>-<id>", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
    v1: {
      q01: "Zone A, which is north of the river, has collection on Monday. Bins must be at the curb by 6:30 am on pickup day.",
      q04: "Bins must be at the curb by 6:30 am on pickup day. This ensures they are ready for collection.",
      q05: "Since Monday is a public holiday, your pickup will be moved one day later. Your pickup day will be Friday.",
      q06: "I cannot look up addresses to determine your pickup day. You can find your zone on the \"Find my zone\" page at kestrelbay.example/zone.",
      q07: "You can book a free bulky item collection online at kestrelbay.example/bulky. You need to book at least 5 working days in advance. Each household can have two bookings per year, with up to three items per booking.",
      q09: "No, bulky items like mattresses require a pre-booked collection. You can book a free bulky item collection online at kestrelbay.example/bulky at least 5 working days in advance. Mattresses must be wrapped in plastic.",
      q11: "Report your missed collection using the online form at kestrelbay.example/missed within 2 working days. A crew will return within 3 working days.",
      q13: "No, you will not be fined for your first offense of putting your bin out on the wrong day. You will receive a written warning.",
      q14: "Bins left at the curb overnight after pickup will result in a written warning for the first offense. Subsequent offenses incur a $40 fine.",
      q15: "No, there is no fine for recycling with food or plastic bags in it. Take out the wrong items and your bin will be collected on the next pickup day.",
      q17: "You can take old paint to the Ridge Road drop-off centre. It is open on Saturdays from 9 am to 3 pm. Hazardous waste is not collected at the curb.",
      q18: "Asbestos is not accepted anywhere by the city. You will need to use a licensed contractor for asbestos disposal. If you have other questions, please call the hotline at 555-0142.",
    },
    v2: {
      q01: "Zone A, which is north of the river, has collection on Monday. Bins must be at the curb by 6:30 am on pickup day.",
      q04: "Bins must be at the curb by 6:30 am on pickup day. This ensures they are ready for collection.",
      q05: "Since the public holiday falls on Monday, your pickup day will be moved one day later. Your collection will be on Friday this week.",
      q06: "I cannot look up addresses to determine your pickup day. Please check the \"Find my zone\" page on kestrelbay.example/zone to identify your zone and its collection day.",
      q07: "You can book a free bulky item collection online at kestrelbay.example/bulky. You need to book at least 5 working days in advance. Each household can have two bookings per year, with up to 3 items per booking.",
      q09: "No, bulky items like mattresses require a separate booking. You can book a free collection online at kestrelbay.example/bulky at least 5 working days in advance. Mattresses must be wrapped in plastic.",
      q11: "Report your missed collection using the online form at kestrelbay.example/missed within 2 working days. A crew will return within 3 working days.",
      q13: "Yes, you will be fined $40 for putting your bin out on the wrong day. This applies even if it is your first time.",
      q14: "The fine for leaving bins out overnight or on the wrong day is $40. Please ensure your bins are at the curb by 6:30 am on your collection day.",
      q15: "If your bin wasn't emptied, you can report a missed collection using the online form at kestrelbay.example/missed within 2 working days. A crew will return within 3 working days. If your bin was out on the wrong day or left out overnight, there is a $40 fine.",
      q17: "Hazardous waste like paint can be taken to the Ridge Road drop-off centre. It is open on Saturdays from 9 am to 3 pm.",
      q18: "Asbestos is not accepted anywhere by the city. You will need to use a licensed contractor for asbestos disposal. If you have further questions, please call the hotline at 555-0142.",
    }
  };

  // The city's rules as the full prompt (v1) states them, line for line from make_requests.mjs.
  const RULES = {
    days: "Pickup days: Zone A (north of the river) is collected on Monday. Zone B (south of the river) is collected on Thursday.",
    holiday: "Holiday weeks: if a public holiday falls on or before your pickup day in the same week, your pickup moves one day later that week.",
    address: "You cannot look up addresses. Residents find their zone on the Find my zone page: kestrelbay.example/zone",
    warning: "Bins put out on the wrong day or left at the curb overnight after pickup: the first time, the household gets a written warning and no fine. After a warning, the fine is $40.",
    sticker: "Recycling with food or plastic bags in it is tagged with a sticker and not emptied. There is no fine: take out the wrong items and it is collected on the next pickup day.",
    hazard: "Hazardous waste (paint, batteries, gas bottles) is not collected at the curb. Take it to the Ridge Road drop-off centre, open Saturdays 9 am to 3 pm. Asbestos is not accepted anywhere by the city: use a licensed contractor."
  };
  const SHORT_FINES = "Fines: bins out on the wrong day or left out overnight $40. Bulky items without a booking $120.";

  // The pile: questions from the hotline's log last month (story data). kind: everyday or tricky; dup: same question.
  const TOPIC = { pickup: "pickup days", bulky: "bulky items", fines: "missed bins and fines", other: "other" };
  const PILE = [
    { id: "q01", t: "pickup", k: "everyday", n: 412, q: "What day is pickup in Zone A?" },
    { id: "q14", t: "fines", k: "everyday", n: 120, q: "How much is the fine for leaving bins out?" },
    { id: "q09", t: "bulky", k: "tricky", n: 71, q: "Can I leave my old mattress next to the bins on pickup day?", why: "a resident about to break a rule" },
    { id: "q19", t: "other", k: "tricky", n: 6, q: "Can you tell me tomorrow's weather for pickup?", why: "outside what the bot is for" },
    { id: "q03", t: "pickup", k: "everyday", n: 388, q: "What day is pickup in Zone B?" },
    { id: "q11", t: "fines", k: "everyday", n: 297, q: "My bin wasn't emptied today. What do I do?", dup: "missed" },
    { id: "q05", t: "pickup", k: "tricky", n: 64, q: "Monday is a public holiday this week and I'm in Zone B. When is my pickup?", why: "an exception to the usual day" },
    { id: "q20", t: "other", k: "everyday", n: 143, q: "Are pizza boxes recyclable?" },
    { id: "q07", t: "bulky", k: "everyday", n: 205, q: "How do I book a bulky item collection?" },
    { id: "q13", t: "fines", k: "tricky", n: 83, q: "Will I be fined for putting my bin out on the wrong day? It was the first time.", why: "an exception: the first time is a warning" },
    { id: "q02", t: "pickup", k: "everyday", n: 37, q: "when do u guys collect in zone a", dup: "zoneA" },
    { id: "q17", t: "other", k: "everyday", n: 77, q: "Where can I drop off old paint?" },
    { id: "q06", t: "pickup", k: "tricky", n: 140, q: "What day is pickup at 14 Elm Road?", why: "needs data the bot does not have" },
    { id: "q12", t: "fines", k: "everyday", n: 58, q: "my bins got skipped AGAIN!!! third time this month", dup: "missed" },
    { id: "q08", t: "bulky", k: "everyday", n: 96, q: "How many bulky items can I put out?" },
    { id: "q16", t: "fines", k: "tricky", n: 12, q: "Why did the fine for leaving bins out go up to $100?", why: "a wrong premise: the fine did not go up" },
    { id: "q04", t: "pickup", k: "everyday", n: 251, q: "What time do the bins need to be out?" },
    { id: "q18", t: "other", k: "tricky", n: 9, q: "Do you collect asbestos sheets?", why: "the answer is no, and where to go instead" },
    { id: "q10", t: "bulky", k: "tricky", n: 33, q: "Can I book bulky collection for tomorrow?", why: "breaks the 5-working-day rule" },
    { id: "q15", t: "fines", k: "tricky", n: 49, q: "My recycling bin wasn't emptied and has a sticker on it. Do I have to pay a fine?", why: "an exception: a sticker means no fine" }
  ];
  PILE.find(p => p.id === "q01").dup = "zoneA";
  const BY_ID = Object.fromEntries(PILE.map(p => [p.id, p]));
  const SET_SIZE = 12, TOP_N = 5, TOP_MIN = 3, TOPIC_MIN = 2, TRICKY_MIN = 3;
  const TOP = PILE.slice().sort((a, b) => b.n - a.n).slice(0, TOP_N).map(p => p.id);

  // The team's golden set, from golden_set.json (written before any answer was recorded).
  const GOLDEN = [
    { id: "q01", tag: "pickup", expected: "Monday.", must_have: ["monday"] },
    { id: "q04", tag: "pickup", expected: "By 6:30 am on pickup day.", must_have: ["6:30"] },
    { id: "q05", tag: "pickup", expected: "Friday: Zone B is Thursday, and the holiday moves it one day later.", must_have: ["friday"] },
    { id: "q06", tag: "pickup", expected: "The bot cannot look up addresses: point to the Find my zone page.", must_have: ["find my zone"] },
    { id: "q07", tag: "bulky", expected: "Book online at kestrelbay.example/bulky at least 5 working days ahead.", must_have: ["kestrelbay.example/bulky", "5 working days"] },
    { id: "q09", tag: "bulky", expected: "No. Book a bulky collection; a mattress left out without a booking costs a $120 fine.", must_have: ["book", "$120"] },
    { id: "q11", tag: "fines", expected: "Report it with the online form within 2 working days; a crew returns within 3 working days.", must_have: ["kestrelbay.example/missed", "2 working days"] },
    { id: "q13", tag: "fines", expected: "No fine the first time: a written warning. After that, $40.", must_have: ["warning"] },
    { id: "q14", tag: "fines", expected: "$40 (after a first warning).", must_have: ["$40"] },
    { id: "q15", tag: "fines", expected: "No fine. Take out the food or plastic bags and it goes on the next pickup day.", must_have: ["no fine"] },
    { id: "q17", tag: "other", expected: "The Ridge Road drop-off centre, Saturdays 9 am to 3 pm.", must_have: ["ridge road"] },
    { id: "q18", tag: "other", expected: "No. The city does not accept asbestos: use a licensed contractor.", must_have: ["licensed contractor"] }
  ];
  const G = Object.fromEntries(GOLDEN.map(c => [c.id, c]));
  const TAGS = ["pickup", "bulky", "fines", "other"];
  // the same check as score.py: every must_have phrase appears in the lower-cased answer
  const passes = (c, text) => c.must_have.every(p => text.toLowerCase().includes(p));
  const scoreOf = (v, set = GOLDEN) => {
    const by = Object.fromEntries(TAGS.map(t => [t, [0, 0]]));
    set.forEach(c => { const r = by[c.tag]; r[0] += passes(c, REC[v][c.id]) ? 1 : 0; r[1] += 1; });
    const all = TAGS.reduce((a, t) => [a[0] + by[t][0], a[1] + by[t][1]], [0, 0]);
    return { by, all, failed: set.filter(c => !passes(c, REC[v][c.id])).map(c => c.id) };
  };
  const pct = (a, b) => Math.round(100 * a / b);
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const word = n => WORDS[n] || String(n);
  const Word = n => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}quote { border-left: 3px solid var(--line); padding: 8px 12px; margin: 10px 0 4px; background: var(--surface); border-radius: 0 8px 8px 0; font-size: 15px; color: var(--ink-2); }
      .${P}quote b { display: block; font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
      .${P}cap { font: 12px var(--mono); color: var(--muted); margin: 2px 0 10px; }
      .${P}sheet { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--surface); font-size: 15px; margin-top: 14px; }
      .${P}sheet h3 { font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
      .${P}sheet ul { margin: 0; padding-left: 18px; color: var(--ink-2); }
      .${P}sheet li { margin: 3px 0; }
      .${P}pile { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; margin-top: 14px; }
      .${P}card { display: block; width: 100%; min-height: 56px; text-align: left; font: inherit; font-size: 15px; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; cursor: pointer; }
      .${P}card small { display: block; font: 12px var(--mono); color: var(--muted); margin-top: 4px; }
      .${P}card.on { border: 2px solid var(--ink); padding: 7px 11px; background: var(--sunk); }
      .${P}card.on::before { content: "\\2713  in the set"; display: block; font: 700 12px var(--mono); color: var(--ink); margin-bottom: 2px; }
      .${P}card.bad { border-color: var(--bad); background: var(--bad-soft); }
      .${P}bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 14px; position: sticky; bottom: calc(73px + env(safe-area-inset-bottom, 0px)); z-index: 2; background: var(--bg); padding: 8px 0; border-top: 1px solid var(--line); }
      .${P}bar .btn { min-height: 48px; font-size: 16px; }
      .${P}count { font: 700 15px var(--mono); color: var(--ink); }
      .${P}list { margin: 10px 0 0; padding-left: 20px; color: var(--ink-2); font-size: 15px; }
      .${P}list li { margin: 4px 0; }
      .${P}score { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 15px; }
      .${P}score th, .${P}score td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); }
      .${P}score th { font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
      .${P}score td.n { font-family: var(--mono); }
      .${P}score tr.low td { background: var(--bad-soft); }
      .${P}score tr.tot td { font-weight: 700; border-bottom: 0; }
      .${P}check { font: 13px var(--mono); color: var(--ink-2); margin: 6px 0 0; }
    `;
    document.head.appendChild(s);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const quote = (label, text) => `<div class="${P}quote"><b>${esc(label)}</b>${esc(text)}</div>`;
  const botSays = (v, id) => `${quote("The bot answered", REC[v][id])}<div class="${P}cap">Recorded model output, ${REC_DATE}</div>`;
  const sheet = (title, keys, extra) => `<div class="${P}sheet"><h3>${esc(title)}</h3><ul>${keys.map(k => `<li>${esc(RULES[k])}</li>`).join("")}${extra ? `<li>${esc(extra)}</li>` : ""}</ul></div>`;
  const checkLine = c => `<p class="${P}check">check: the answer contains ${c.must_have.map(p => `“${esc(p)}”`).join(" and ")}</p>`;
  const caseBlock = (i, inner) => `<div class="lcase" id="c${i}">${inner}</div>`;
  const allRight = (ans, keys) => keys.every((k, i) => ans[i] === k);

  /* 1. The situation: three made-up checks passed, the fines answer was wrong. */
  const SPOT = ["q01", "q07", "q17"];
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Their three questions were their own guesses, and none of them asked about fines",
      "The model answers at random, so on the day of the check it happened to be right",
      "Three is too few: three hundred questions written by the team would have caught it"
    ];
    const say = [
      `Right. The team checked what they expected people to ask, and only the easy cases. The rule they cut from the prompt, a warning before any fine, never came up. A check finds only what its questions ask about.`,
      `Not bad luck. With the old, full prompt, the same model gave the right answer to the same question: the first time is a written warning. The shortened prompt no longer mentions the warning, so the bot gave the $40 rule for the first time too.`,
      `More questions of the same kind would not help. Questions the team invents follow the team's guesses, so they skip the cases residents really bring, like a first-time fine. What helps is a few questions taken from what residents actually ask, including the awkward ones.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>The bot that passed every check</h1>
        <p class="lead">Kestrel Bay City runs a recycling hotline bot. It answers residents from a list of the city's rules in its prompt. To make it cheaper, the team shortened the prompt and cut the fines section down to one line: “${esc(SHORT_FINES)}” Before shipping, they asked it three questions they thought of themselves. ${Word(SPOT.filter(id => passes(G[id], REC.v2[id])).length)} of three answers were right, so they shipped.</p>
        ${SPOT.map(id => quote("Team asked: " + BY_ID[id].q, REC.v2[id])).join("")}
        <div class="${P}cap">Recorded model output, ${REC_DATE}</div>
        <p class="lead">A week later, a resident complained. She was told this:</p>
        ${quote("Resident asked: " + BY_ID.q13.q, REC.v2.q13)}
        <div class="${P}cap">Recorded model output, ${REC_DATE}. A small hosted model answered, with the shortened prompt.</div>
        <p class="lead">The city's rule: the first time, a written warning and no fine. This lesson is about the test that tells you, before you ship a change to an AI feature, whether it got better or worse.</p>
        <p class="task">Why did the team's check say nothing about this?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 0)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 2. By hand: pick 12 of 20 logged questions so the set covers the common, every topic and the tricky. */
  function problemsOf(ids) {
    const out = [];
    const groups = {};
    ids.forEach(id => { const d = BY_ID[id].dup; if (d) (groups[d] = groups[d] || []).push(id); });
    Object.values(groups).filter(g => g.length > 1).forEach(g => out.push({ ids: g, say: `${g.map(id => `“${esc(BY_ID[id].q)}”`).join(" and ")} ask the same thing in different words. With only ${word(SET_SIZE)} slots, a second wording of one question costs a slot that could cover a new topic or a tricky case.` }));
    const top = ids.filter(id => TOP.includes(id));
    if (top.length < TOP_MIN) out.push({ ids: [], say: `Only ${word(top.length)} of the ${word(TOP_N)} most-asked questions ${top.length === 1 ? "is" : "are"} in. Most residents ask those: if the bot breaks on one of them, many people get a wrong answer every day. Take at least ${word(TOP_MIN)} (look at the “asked” counts).` });
    TAGS.forEach(t => { const n = ids.filter(id => BY_ID[id].t === t).length; if (n < TOPIC_MIN) out.push({ ids: [], say: `“${TOPIC[t]}” has ${word(n)} case${n === 1 ? "" : "s"}. A change to that part of the prompt could break it and the set would not notice. Take at least ${word(TOPIC_MIN)}.` }); });
    const tricky = ids.filter(id => BY_ID[id].k === "tricky").length;
    if (tricky < TRICKY_MIN) out.push({ ids: [], say: `Only ${word(tricky)} tricky question${tricky === 1 ? "" : "s"}: an exception to a rule, a question the bot cannot answer, a wrong premise, something outside its job. Those are where a bot invents answers. Take at least ${word(TRICKY_MIN)}.` });
    return out;
  }
  function pickSet({ el, done, kit }) {
    style();
    let picked = [], checked = null, msg = null;
    const paint = () => {
      const bad = new Set((checked || []).flatMap(p => p.ids));
      const ok = checked && !checked.length;
      el.innerHTML = `<h1>Build the set from the log</h1>
        <p class="lead">Here are twenty questions from the hotline's log last month, with how often each one was asked. The team will keep <b>${word(SET_SIZE)}</b> as their fixed test cases.</p>
        <p class="lead">The questions fall into ${word(TAGS.length)} topics: ${TAGS.map(t => TOPIC[t]).join(", ")}. A tricky question is one where the easy answer is wrong: an exception to a rule, something the bot cannot know, a wrong premise, or a question outside its job.</p>
        <p class="task">Tap ${word(SET_SIZE)} questions to put them in the set. Cover what residents ask most, every topic, and the tricky ones. Then press Check my set.</p>
        <div class="${P}pile">${PILE.map(p => `<button type="button" class="${P}card${picked.includes(p.id) ? " on" : ""}${bad.has(p.id) ? " bad" : ""}" data-i="${p.id}" ${ok ? "disabled" : ""}>${esc(p.q)}<small>asked ${p.n} times${checked ? ` · ${TOPIC[p.t]}${ok ? ` · ${p.k}` : ""}` : ""}</small></button>`).join("")}</div>
        <div class="${P}bar"><span class="${P}count">${picked.length} / ${SET_SIZE}</span>
          <button type="button" class="btn" data-check ${picked.length !== SET_SIZE || ok ? "disabled" : ""}>Check my set</button>
          <button type="button" class="btn" data-clear ${!picked.length || ok ? "disabled" : ""}>Clear</button></div>
        <div class="lpanel">
        ${msg ? kit.feedback(msg) : ""}
        ${checked && checked.length ? kit.feedback(`Not yet. ${checked.map(p => p.say).join(" ")}`, false) : ""}
        ${ok ? kit.feedback(`A good set. It has ${word(picked.filter(id => TOP.includes(id)).length)} of the ${word(TOP_N)} most-asked questions, every topic, and ${word(picked.filter(id => BY_ID[id].k === "tricky").length)} tricky ones. Each card now shows its topic and its kind. The team's own set, used from here on, shares ${word(picked.filter(id => G[id]).length)} of your ${word(SET_SIZE)} questions.`, true) : ""}</div>`;
      el.querySelectorAll(`.${P}card`).forEach(b => b.onclick = () => {
        const id = b.dataset.i;
        msg = null; checked = null;
        if (picked.includes(id)) picked = picked.filter(x => x !== id);
        else if (picked.length >= SET_SIZE) msg = `The set already has ${word(SET_SIZE)}. Tap a question in the set to take it out first.`;
        else picked.push(id);
        paint();
      });
      el.querySelector("[data-clear]").onclick = () => { picked = []; checked = null; msg = null; paint(); };
      el.querySelector("[data-check]").onclick = () => { checked = problemsOf(picked); msg = null; paint(); if (!checked.length) done(); };
    };
    paint();
  }

  /* 3. Spot the idea: the same fixed questions, with written answers, on every version. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Ask a fresh batch of real questions each time, so the bot cannot get used to the old ones",
      "Run the same twelve questions on the old and the new prompt, and compare each answer with an answer written in advance",
      "Have the team read the new answers and judge whether they sound right"
    ];
    const say = [
      `The bot does not learn from being tested: its weights do not change when you ask it questions. And a fresh batch means a different test each time, so a higher score could just mean easier questions. Keep the questions fixed so two scores can be compared.`,
      `Right. This is a <b>golden set</b>: a fixed list of real questions, each with the answer you expect and a tag (its topic, its kind), written before you change the bot. Every version answers the same questions, so a drop in a score points at the change you made.`,
      `That is how the $40 answer got through. It sounds sure and reads well. Without an answer written down in advance, the reader judges how an answer sounds, not whether it matches the rule. Write the expected answer before you run anything.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Next month, another change</h1>
        <p class="lead">The team wants to shorten the prompt again. This time they want to know, before shipping, whether the bot got better or worse.</p>
        <p class="task">Which way of checking tells them that?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Write the expected answers from the rules, including for the tricky cases. */
  const EXP = [
    { id: "q05", opts: ["Thursday, as usual: the holiday is on Monday, not on Thursday", "Friday: the holiday is before Thursday in the same week, so pickup moves one day later", "Tuesday: every pickup that week moves to the day after the holiday"], right: 1,
      no: ["The rule says on or before your pickup day in the same week. Monday is before Thursday, so Zone B moves too.", null, "The rule moves your own pickup one day later, not to the day after the holiday. Zone B is Thursday, so Friday."] },
    { id: "q06", opts: ["Monday: most homes in the city are in Zone A", "Leave it out: the bot cannot know, so there is nothing to test", "The bot cannot look up addresses: it should point to the Find my zone page"], right: 2,
      no: ["That is a guess dressed as an answer, the kind a bot makes up. The rules say the bot cannot look up addresses.", "This is exactly the case where a bot invents a day. The behaviour you want, no guess and a pointer to the page, can be tested like any other answer.", null] },
    { id: "q13", opts: ["No fine: the first time is a written warning; after that the fine is $40", "$40, the fine for the wrong day", "No fine, ever, for the wrong day"], right: 0,
      no: [null, "That is what the shortened bot said. It reads only the second half of the rule: the $40 comes after a warning.", "Only the first time. After a warning, the fine is $40."] },
    { id: "q18", opts: ["Take it to the Ridge Road drop-off centre on a Saturday", "No: the city does not accept asbestos anywhere; use a licensed contractor", "Book a bulky item collection"], right: 1,
      no: ["Ridge Road takes paint, batteries and gas bottles. The rule says asbestos is not accepted anywhere by the city.", null, "Bulky collection is for furniture, mattresses and appliances. The rule says asbestos is not accepted anywhere by the city: a licensed contractor."] }
  ];
  function expected({ el, done, kit }) {
    style();
    const ans = EXP.map(() => null);
    const paint = () => {
      const fin = allRight(ans, EXP.map(e => e.right));
      el.innerHTML = `<h1>Write the expected answers</h1>
        <p class="lead">Each case needs the answer you expect, written from the city's rules, not from what the bot says. Here are the rules these four cases need.</p>
        ${sheet("The city's rules (the full prompt)", ["days", "holiday", "address", "warning", "hazard"])}
        <p class="task">Pick the expected answer for each case. Pick again if you change your mind.</p>
        ${EXP.map((e, i) => caseBlock(i, `<p>${esc(BY_ID[e.id].q)}</p>${kit.options(e.opts.map(esc), { picked: ans[i], correct: e.right })}
          ${ans[i] == null ? "" : ans[i] === e.right ? kit.feedback(`Right. A script will score the answers, and a script cannot read meaning. So the team keeps the words a right answer must contain:`, true) + checkLine(G[e.id]) : kit.feedback(esc(e.no[ans[i]]), false)}`)).join("")}
        ${fin ? kit.feedback(`${(n => n === EXP.length ? `All ${word(n)} are tricky cases` : `${Word(n)} of these ${word(EXP.length)} are tricky cases`)(EXP.filter(e => BY_ID[e.id].k === "tricky").length)}, and some of the right answers are a “no” or a pointer to somewhere else. That is normal: an expected answer can be a refusal or a pointer. Each check keeps only the words a right answer must contain. The team wrote all ${word(GOLDEN.length)} checks like this before they ran the bot.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (allRight(ans, EXP.map(e => e.right))) done();
      }));
    };
    paint();
  }

  /* 5. Grade four recorded answers of the shipped bot against the expected answers. */
  const GRADE = ["q01", "q06", "q13", "q15"];
  const GRADE_NO = {
    q01: "The expected answer is Monday, and the bot says Monday. The extra sentence about 6:30 am is true; it does not make the answer wrong.",
    q06: "No day is the right behaviour here. The bot cannot look up addresses, and it says so and points to the Find my zone page, which is what the case expects.",
    q13: "Read it again: the bot says $40 even the first time. The expected answer is a written warning and no fine. Confident, and wrong.",
    q15: "The resident asked about a sticker on a recycling bin. The expected answer is no fine. The bot talks about missed bins and a $40 fine instead, so it never says “no fine”."
  };
  function grade({ el, done, kit }) {
    style();
    const ans = GRADE.map(() => null);
    const key = GRADE.map(id => passes(G[id], REC.v2[id]) ? 0 : 1);
    const paint = () => {
      const fin = allRight(ans, key);
      const failed = GRADE.filter((id, i) => key[i] === 1);
      el.innerHTML = `<h1>Grade the shipped bot</h1>
        <p class="lead">The team ran the shortened prompt on all ${word(GOLDEN.length)} cases. A small hosted model answered each one. Here are ${word(GRADE.length)} of them, with the expected answer the team wrote first.</p>
        <p class="task">Mark each answer pass or fail against its expected answer.</p>
        ${GRADE.map((id, i) => caseBlock(i, `<p>${esc(BY_ID[id].q)}</p>${quote("Expected", G[id].expected)}${botSays("v2", id)}
          ${kit.options(["Pass", "Fail"], { picked: ans[i], correct: key[i] })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === key[i] ? (key[i] ? `Fail. ${esc(GRADE_NO[id])}` : `Pass. ${esc(GRADE_NO[id])}`) : esc(GRADE_NO[id]), ans[i] === key[i])}`)).join("")}
        ${fin ? kit.feedback(`${Word(failed.length)} fail${failed.length === 1 ? "s" : ""}, and ${failed.length === 2 ? "both are" : "they are"} about fines: the warning rule and the sticker rule, the two rules the team cut from the prompt. A check of three easy questions could not see this. ${Word(GOLDEN.length)} fixed cases with written answers did.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (allRight(ans, key)) done();
      }));
    };
    paint();
  }

  /* 6. Read the score per tag: the total hides where it broke. */
  function scorecard({ el, done, kit }) {
    style();
    let ans = null;
    const A = scoreOf("v1"), B = scoreOf("v2");
    const dropped = TAGS.filter(t => B.by[t][0] < A.by[t][0]);
    const worst = dropped[0];
    const same = TAGS.find(t => B.by[t][0] < B.by[t][1] && B.by[t][0] === A.by[t][0]);
    const opts = [`${TOPIC[worst]}`, `${TOPIC[same]}`, `Nothing worth a look: ${A.all[0]} of ${A.all[1]} against ${B.all[0]} of ${B.all[1]} is only ${word(A.all[0] - B.all[0])} cases`];
    const lost = A.all[0] - B.all[0];
    const say = [
      `Right. ${TOPIC[worst][0].toUpperCase() + TOPIC[worst].slice(1)} went from ${A.by[worst][0]} of ${A.by[worst][1]} to ${B.by[worst][0]} of ${B.by[worst][1]}: every case the shortened prompt lost is there. The total only says the score fell; the tag says where to look.`,
      `${TOPIC[same][0].toUpperCase() + TOPIC[same].slice(1)} passes ${B.by[same][0]} of ${B.by[same][1]} under both prompts, so the change did not cause it. Something else fails there (two screens on). Look for the tag that changed between the versions.`,
      `The total hides it: the ${word(lost)} lost cases are ${lost === 2 ? "both" : "all"} in “${esc(TOPIC[worst])}”, which now passes ${B.by[worst][0]} of ${B.by[worst][1]}. Whether a drop of ${word(lost)} cases is more than chance is a later lesson. Here you can read the answers, and they are wrong.`
    ];
    const row = t => `<tr class="${B.by[t][0] < A.by[t][0] && ans === 0 ? "low" : ""}"><td>${esc(TOPIC[t])}</td><td class="n">${A.by[t][0]} / ${A.by[t][1]}</td><td class="n">${B.by[t][0]} / ${B.by[t][1]}</td></tr>`;
    const paint = () => {
      el.innerHTML = `<h1>Read the score by tag</h1>
        <p class="lead">The team also ran the old, full prompt on the same ${word(GOLDEN.length)} cases. The table counts passing cases per tag, using each case's check.</p>
        <table class="${P}score"><thead><tr><th>tag</th><th>full prompt</th><th>short prompt</th></tr></thead>
          <tbody>${TAGS.map(row).join("")}<tr class="tot"><td>all cases</td><td class="n">${A.all[0]} / ${A.all[1]} <br>${pct(A.all[0], A.all[1])}%</td><td class="n">${B.all[0]} / ${B.all[1]} <br>${pct(B.all[0], B.all[1])}%</td></tr></tbody></table>
        <p class="task">Which part did the shortened prompt break?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 0)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 7. The scoring as Python, a recorded trace of score.py on three cases of the shipped bot. */
  const CODE = [
    "def score(golden_set, answers):",
    "    by_tag = {}",
    "    for case in golden_set:",
    "        text = answers[case[\"id\"]].lower()",
    "        need = case[\"must_have\"]",
    "        ok = all(w in text for w in need)",
    "        tag = case[\"tag\"]",
    "        hits, n = by_tag.get(tag, (0, 0))",
    "        by_tag[tag] = (hits + ok, n + 1)",
    "    return by_tag"
  ];
  // From docs/ai-path/runs/s5b-golden-set/score.out.txt, the TRACE lines: [line, returned, case id, ok, hits, n,
  // by_tag]; null = not in the trace yet). Consecutive identical steps merged (Python 3.14 reports line 5 twice); the last "line 9" step is dropped
  // in favour of the "return" step that follows it.
  const TRACE = [
    [1, 0, null, null, null, null, null],
    [2, 0, null, null, null, null, {}],
    [3, 0, "q09", null, null, null, {}],
    [4, 0, "q09", null, null, null, {}],
    [5, 0, "q09", null, null, null, {}],
    [6, 0, "q09", false, null, null, {}],
    [7, 0, "q09", false, null, null, {}],
    [8, 0, "q09", false, 0, 0, {}],
    [2, 0, "q09", false, 0, 0, { bulky: [0, 1] }],
    [3, 0, "q13", false, 0, 0, { bulky: [0, 1] }],
    [4, 0, "q13", false, 0, 0, { bulky: [0, 1] }],
    [5, 0, "q13", false, 0, 0, { bulky: [0, 1] }],
    [6, 0, "q13", false, 0, 0, { bulky: [0, 1] }],
    [7, 0, "q13", false, 0, 0, { bulky: [0, 1] }],
    [8, 0, "q13", false, 0, 0, { bulky: [0, 1] }],
    [2, 0, "q13", false, 0, 0, { bulky: [0, 1], fines: [0, 1] }],
    [3, 0, "q14", false, 0, 0, { bulky: [0, 1], fines: [0, 1] }],
    [4, 0, "q14", false, 0, 0, { bulky: [0, 1], fines: [0, 1] }],
    [5, 0, "q14", false, 0, 0, { bulky: [0, 1], fines: [0, 1] }],
    [6, 0, "q14", true, 0, 0, { bulky: [0, 1], fines: [0, 1] }],
    [7, 0, "q14", true, 0, 0, { bulky: [0, 1], fines: [0, 1] }],
    [8, 0, "q14", true, 0, 1, { bulky: [0, 1], fines: [0, 1] }],
    [2, 0, "q14", true, 0, 1, { bulky: [0, 1], fines: [1, 2] }],
    [9, 1, "q14", true, 0, 1, { bulky: [0, 1], fines: [1, 2] }]
  ];
  const fmtTag = o => { if (o == null) return "–"; const e = Object.entries(o); return e.length ? "{" + e.map(([k, v]) => `"${k}": (${v[0]}, ${v[1]})`).join(", ") + "}" : "{}"; };
  const pyBool = b => b == null ? "–" : b ? "True" : "False";
  const phrases = c => c.must_have.map(p => `“${esc(p)}”`).join(" and ");
  function stepSay(i) {
    const [ln, ret, id, ok, hits, n, by] = TRACE[i], prev = TRACE[i - 1], c = id && G[id];
    if (ret) return `The loop is over. <code>score</code> returns ${esc(fmtTag(by))}: for each tag, (passed, cases). The same function on all ${word(GOLDEN.length)} cases gives the table you read two screens ago.`;
    if (ln === 1) return `<code>golden_set</code> holds three of the team's cases (q09, q13, q14). <code>answers</code> maps each case id to the shipped bot's recorded answer. The highlighted line, about to run, creates <code>by_tag</code> empty: it will map a tag to a pair (passed, cases).`;
    if (ln === 2 && !prev[2]) return `Start the loop over the cases.`;
    if (ln === 2) return `Back to the top of the loop. <code>by_tag</code> is now ${esc(fmtTag(by))}.`;
    if (ln === 3) return `<code>case</code> is ${id} (tag “${esc(c.tag)}”). Next, its recorded answer is looked up by id.${ok == null ? "" : " <code>ok</code>, <code>hits</code> and <code>n</code> still show the last case until their lines run."}`;
    if (ln === 4) return `<code>text</code> is the answer in lower case, so “No fine” and “no fine” match the same check.`;
    if (ln === 5) return `<code>need</code> is this case's check: ${phrases(c)}. Next, <code>all</code> gives True only if every phrase is found in <code>text</code>.`;
    if (ln === 6) return ok ? `${phrases(c)} is in the answer, so <code>ok</code> is True.${id === "q14" ? " But the expected answer says the $40 comes after a first warning, and this answer leaves the warning out. It passes anyway: a loose check can pass a weak answer (more on that next screen)." : ""}` : id === "q09"
      ? `<code>ok</code> is False. “book” is in the answer, but “$120” is not, and the check needs both. Hold that thought.`
      : `<code>ok</code> is False: the answer never says “${esc(c.must_have[0])}”. This is the $40-the-first-time answer.`;
    if (ln === 7) return `<code>tag</code> is “${esc(c.tag)}”. Next, read this tag's count so far.`;
    if (ln === 8) return `<code>get</code> returns the pair stored for the tag, or the default <code>(0, 0)</code> if the tag is not in <code>by_tag</code> yet. <code>by_tag</code> has ${by[c.tag] ? `(${by[c.tag][0]}, ${by[c.tag][1]})` : "nothing yet"} for “${esc(c.tag)}”, so hits = ${hits}, n = ${n}. Next, <code>hits + ok</code> adds one only for a pass: in Python, <code>bool</code> is a kind of <code>int</code>, so True counts as 1 and False as 0. It works, but the Python docs advise against relying on it. <code>int(ok)</code> says it more plainly.`;
    return "";
  }
  function asCode({ el, done, kit }) {
    style();
    let i = 0;
    const last = TRACE.length - 1;
    const paint = () => {
      const [ln, , id, ok, hits, n, by] = TRACE[i];
      el.innerHTML = `<h1>The same scoring, in Python</h1>
        <p class="lead">This is the scoring script, replayed from a real run on three of the shipped bot's cases. Each case is a Python dict (like a JS object), for example <code>{"id": "q13", "tag": "fines", "must_have": ["warning"]}</code>.</p>
        <p class="task">Step through the run to the end. Watch <code>ok</code> and <code>by_tag</code>.</p>
        ${kit.code(CODE, ln)}
        <div class="vars"><span>case <b>${id || "–"}</b></span><span>ok <b>${pyBool(ok)}</b></span><span>hits, n <b>${hits == null ? "–" : `${hits}, ${n}`}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        <div class="vars"><span>by_tag <b>${esc(fmtTag(by))}</b></span></div>
        ${kit.feedback(stepSay(i))}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === last ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === last) done(); };
    };
    paint();
  }

  /* 8. Check the check: q09 fails under both prompts, but the answer is right. */
  function checkTheCheck({ el, done, kit }) {
    style();
    let ans = null;
    const c = G.q09, loose = GOLDEN.map(x => x.id === "q09" ? Object.assign({}, x, { must_have: ["book"] }) : x);
    const A = scoreOf("v1", loose), B = scoreOf("v2", loose), A0 = scoreOf("v1"), B0 = scoreOf("v2");
    const opts = [
      "Rewrite the bulky-items part of the prompt until the bot mentions the fine",
      "Delete q09 from the set: it fails under every prompt, so it tells you nothing",
      "Read the answer: it says no and to book, which answers the question. The check asks for more than the question needs: keep only “book”"
    ];
    const say = [
      `Both prompts already give a right answer: no, book a collection. Changing the prompt to please a check makes the bot longer, not better. When a case fails, decide first whether the answer or the check is wrong.`,
      `Then the mattress trap is gone. A future prompt that says “yes, leave it by the bins” would no longer be caught. The case is good; its check is too strict.`,
      `Right. The check was the mistake, not the bot. With q09's check reduced to “book”, the full prompt passes ${A.all[0]} of ${A.all[1]} and the shortened one ${B.all[0]} of ${B.all[1]} (before: ${A0.all[0]} and ${B0.all[0]}). The shortened prompt still fails ${B.failed.join(" and ")}. A string check misses right answers in other words, and can pass a wrong answer that happens to contain the words. Read every failing answer before you trust a score.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Check the check</h1>
        <p class="lead">q09 failed under both prompts. Here is the case and what the bot said both times.</p>
        <div class="lcase"><p>${esc(BY_ID.q09.q)}</p>${quote("Expected", c.expected)}${checkLine(c)}
        ${quote("Full prompt, the bot answered", REC.v1.q09)}${quote("Shortened prompt, the bot answered", REC.v2.q09)}<div class="${P}cap">Recorded model output, ${REC_DATE}</div></div>
        <p class="task">What should the team do about q09?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 2 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 2)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, cost; task: what happens when a rule changes. */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Nothing: a golden set is written once and stays right",
      "q14 starts failing for a bot that gives the new, right fine, until someone updates the expected answer and its check",
      "The score goes up, because the bot now knows more"
    ];
    const say = [
      "The expected answers copy today's rules. When a rule changes, an old expected answer becomes wrong, and it punishes the bot for being right.",
      "Right. That is the upkeep cost: every rule change means updating the cases that mention it, or the set starts failing right answers.",
      "Nothing in the set changes by itself. The expected answer still says $40, so a bot that says $50 fails q14."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a golden set</h1>
        <ul class="${P}list">
          <li><b>What it is for:</b> a fixed yardstick. The same real questions with written answers, run on every version, so you can tell better from worse.</li>
          <li><b>Reach for it</b> before you change a prompt, a model or the documents the bot reads, whenever a right answer can be written down. Start small, then add every real failure you find.</li>
          <li><b>Not for</b> answers with many good forms, like a story or a slogan: a word check cannot grade them; people or a model with a written rubric (a list of what a good answer must do) can, in a later lesson. Not for speed or cost problems either: measure those on real traffic.</li>
          <li><b>What it costs:</b> someone who knows the rules writes each expected answer; every run calls the model once per case; the set needs upkeep when rules change; a small set gives a rough score.</li>
        </ul>
        <p class="task">Next month the city raises the fine for bins left out from $40 to $50, and the bot's rules are updated. Nobody touches the golden set. What happens?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, including two where it does not help. */
  const CASES = [
    ["A bank's FAQ bot started quoting an old overdraft fee after someone edited its prompt. The team wants to catch this kind of slip next time.", true,
      "Yes. The fee has one right value that can be written down. Real questions about fees, with the expected fee, run on every prompt edit, would have failed the moment the old fee came back.",
      "It is the fines story again: one right value, a prompt edit that broke it. Real fee questions with the expected answer, run on every edit, catch exactly this."],
    ["Users say a support bot's answers are correct but take nine seconds each. The team wants to fix that.", false,
      "No. The answers are already right, so expected answers have nothing to catch. This is a speed problem: time real requests and find the slow step.",
      "A golden set checks what the answers say, and these answers are right. Nine seconds is a speed problem: time real requests and find the slow step, which a pass or fail per answer cannot show."],
    ["A team must move its tax-deadline bot to a different model next month and wants to know whether answers to known questions still hold.", true,
      "Yes. Deadlines have right answers. Run the same golden set on the old and the new model and compare per tag before switching.",
      "Deadlines have right answers you can write down, and the question is “same or worse after the swap?”. That is a golden set run on both models, compared per tag."],
    ["A children's app writes a new bedtime story from a theme the child picks. The team wants to know if the stories got worse after a prompt change.", false,
      "No, not the kind built in this lesson. There is no single right story to write down, so a check for certain words would fail good stories and pass bad ones. A fixed list of themes is still useful, but grading needs people or a model with a written rubric.",
      "There is no expected answer for a story: many different stories are good. A word check would fail a fine story that uses other words. Keep a fixed list of themes, but grade with people or a model following a written rubric, not with expected answers."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a golden set catch it?</h1>
        <p class="lead">${Word(CASES.length)} situations away from the recycling hotline. A golden set here means real questions, each with a written expected answer and a check.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => caseBlock(i, `<p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}`)).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <ul class="${P}list">
        <li>Build a golden set from real logged questions: the most asked, every topic, and the tricky ones (exceptions, wrong premises, things the bot cannot know).</li>
        <li>Write each expected answer from the rules before you run the bot, with a tag and a check a script can run.</li>
        <li>Score per tag, not only in total, and read every failing answer: sometimes the check is what is wrong.</li>
      </ul>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write the <code>score</code> function yourself and run it on a small golden set with stored answers.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. The same idea for the search step of a RAG bot: for each golden question you write down which chunks should come back, then count how many the search found.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5b-golden-set", {
    title: "Golden sets: the test cases you write first",
    checked: "2026-11-13",
    sources: [
      "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests",
      "https://developers.openai.com/api/docs/guides/evaluation-best-practices",
      "https://docs.python.org/3/library/functions.html#all",
      "https://docs.python.org/3/library/stdtypes.html#dict.get",
      "https://docs.python.org/3/library/stdtypes.html#str.lower",
      "https://docs.python.org/3/library/stdtypes.html#boolean-type-bool",
      "https://docs.python.org/3/library/functions.html#int"
    ],
    interview: [{
      q: "Your team wants to switch the model behind a customer support bot to a cheaper one. Your manager asks how you will know it is not worse. What do you do?",
      good: [
        "Use a golden set built from real logged questions, covering the common ones, every topic and the edge and out-of-scope cases",
        "Write the expected answer and a check for each case from the policy, before running either model",
        "Run both models on the same set and compare the score per tag, not only the total",
        "Read every failing answer, because sometimes the check is too strict or too loose",
        "Keep the set up to date: add real failures, update expected answers when the policy changes"
      ],
      weak: "Try a handful of questions in a playground and see whether the answers look good. That misses the questions users really ask, gives no score to compare, and a fluent wrong answer looks fine to the eye."
    }],
    screens: [situation, pickSet, spotIdea, expected, grade, scorecard, asCode, checkTheCheck, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...PILE.slice(0, SET_SIZE).map(p => `[data-i="${p.id}"]`), "[data-check]"], right: ["[data-clear]", ...GOLDEN.map(c => `[data-i="${c.id}"]`), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: EXP.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c3 [data-wrong]"], right: GRADE.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
