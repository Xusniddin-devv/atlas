/* Lesson s6-token-budgets-routing: token budgets and routing to cheaper models.
   Story: Calle Tres Tutoring (made up for this lesson), a homework helper for students learning Spanish. Every question
   goes to one larger hosted model, and one student's essay checks cost more in a week than the other seven
   students of his class together.
   Ideas: (1) route: a cheap router sends easy requests to a small model, and a check on the small model's answer
   (here: finish_reason "length" at its token cap) falls back to the larger model; (2) budget: per-request caps
   (input size, max_tokens) bound the worst case of one call, and a per-user daily budget in cost units limits a
   person, which routing never does.
   Depth: explain (screens 1-5, 10, 11, interview), library (screen 6: the real API fields max_tokens,
   finish_reason, usage, and the provider's own fallback list, from its docs), debug (screen 9: a budget that
   only counted input tokens, run for real), when-not (screens 10 and 11).
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s6-token-budgets-routing/: route-r01..r20 (the router, a
     small model, temperature 0, max_tokens 5), small-r01..r20 (small model, max_tokens 300), large-r01..r20
     (larger model, max_tokens 1000, reasoning effort none), all through OpenRouter on 2026-11-13.
   - docs/ai-path/runs/s6-token-budgets-routing/: requests.mjs (the twenty requests and labels, the input),
     record-all.mjs (made the 60 calls), extract.mjs -> data.json and extract.out.txt (the numbers in D below),
     tutor.py (prices in cost units, replayed calls), trace_answer.py -> trace_answer.out.txt (screen 8),
     broken_budget.py -> broken_budget.out.txt (screen 9).
   The class's week (WEEK) is made up; each request's tokens in it are the recorded ones. Every other number on
   screen is computed here from D, PRICE, WEEK, TRACE and the REC_* constants.
   Lesson-local CSS (prefix lx-s6-token-budgets-routing-): request rows, the recorded-answer block, a compact
   table, clickable code lines and the response JSON block; injected by css(), called by every screen. */
(() => {
  const ID = "s6-token-budgets-routing", P = "lx-" + ID + "-";
  const f1 = n => (Math.round(n * 10) / 10).toLocaleString("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f3 = n => n.toFixed(3);
  const sum = a => a.reduce((x, y) => x + y, 0);

  // Units per 1,000 tokens [input, output]. 1 cost unit = $0.0001. From OpenRouter's list prices on 2026-11-13:
  // small model $0.10 / $0.40 per million tokens, larger model $0.30 / $2.50 per million (tutor.py).
  const PRICE = { small: [1, 4], large: [3, 25] };
  const SMALL_MAX = 300, LARGE_MAX = 1000, INPUT_CAP = 2000, DAILY = 40;
  const units = (tier, i, o) => (i * PRICE[tier][0] + o * PRICE[tier][1]) / 1000;

  // The essay inside r09 (requests.mjs), shown shortened in lists.
  const ESSAY = "Mi fin de semana\nEl sábado yo fue a la playa con mi familia. Hacía mucho calor y nosotros nadamos por tres horas. Mi hermano menor es muy cansado después. En la tarde, comemos paella en un restaurante cerca del mar. La paella estaba deliciosa pero muy caro. El domingo me quedé en casa porque tenía que estudiar para mi examen de matemáticas. Mi madre hizo una pastel de chocolate y mi padre miraba el fútbol en la tele. Por la noche, yo leí un libro sobre un chico que vive en Mexico. Fue un fin de semana muy bueno y espero que el próximo es igual.";
  const ESSAY_WORDS = ESSAY.split(/\s+/).length;
  // From requests.mjs: [id, request, team label]
  const REQ = [
    ["r01", "How do you say 'library' in Spanish?", "easy"],
    ["r02", "Why is it 'Espero que vengas' and not 'Espero que vienes'?", "hard"],
    ["r03", "Conjugate 'tener' in the present tense.", "easy"],
    ["r04", "Translate my vocabulary list for Friday's test into English: la manzana, el tenedor, la cuchara, el plato, la servilleta, el vaso, la taza, el cuchillo, la olla, la sartén, el horno, la nevera.", "easy"],
    ["r05", "Explain the difference between 'ser' and 'estar', with two examples for each use.", "hard"],
    ["r06", "Is it 'el agua' or 'la agua'?", "easy"],
    ["r07", "Por or para: 'Gracias ___ todo'? Explain why.", "hard"],
    ["r08", "What is the plural of 'lápiz'?", "easy"],
    ["r09", `Here is my essay for Monday. Give it a mark out of 10, then rewrite it with every mistake fixed, and explain each fix. [the essay, ${ESSAY_WORDS} words]`, "hard"],
    ["r10", "Is 'computadora' masculine or feminine?", "easy"],
    ["r11", "Can you just say if this is right: 'Me gustan los perros.'", "easy"],
    ["r12", "My teacher marked 'Si tendría dinero, viajaría' wrong. Why?", "hard"],
    ["r13", "What does 'madrugar' mean?", "easy"],
    ["r14", "Write a short restaurant dialogue using the conditional tense, then give me five questions to test me on it.", "hard"],
    ["r15", "What is the preterite of 'hablar' for 'yo'?", "easy"],
    ["r16", "What is the difference between 'saber' and 'conocer'? When do I use each?", "hard"],
    ["r17", "Fix the accents: 'Mi mama esta en el jardin.'", "easy"],
    ["r18", "Check these three sentences and explain each mistake: 'Yo soy cansado. Ella tiene veinte años. Nosotros vamos a la playa ayer.'", "hard"],
    ["r19", "Translate into Spanish: 'We are hungry.'", "easy"],
    ["r20", "Give me the Spanish words for the days of the week.", "easy"]
  ];
  // Why each label is right, shown after a wrong pick (the rubric applied to that request).
  const WHY = {
    r01: "One word with one right answer. Nothing to explain.",
    r02: "Short, but it asks why. Explaining when Spanish uses the subjunctive is teaching, not a lookup.",
    r03: "Six forms from a verb table. Each has one right answer, even if the list is a few lines long.",
    r04: "A long list, but every item is a lookup with one right answer. Length is not difficulty.",
    r05: "Explaining two verbs' uses, with examples for each, is teaching, not a lookup.",
    r06: "One right answer, and the student did not ask why.",
    r07: "It ends with 'Explain why'. Picking the word is a lookup; explaining the choice is not.",
    r08: "One form with one right answer.",
    r09: "Marking a whole essay, rewriting it and explaining each fix: judging and rewriting a whole text.",
    r10: "One fact you could look up.",
    r11: "A yes-or-no check of one sentence, and the student asked for nothing more.",
    r12: "Short, but it asks why. The answer needs the rule for 'if' sentences in Spanish.",
    r13: "One word to define.",
    r14: "Write a dialogue, then a quiz on it: making something in several steps.",
    r15: "One verb form with one right answer.",
    r16: "When to use each verb is an explanation with cases, not a lookup.",
    r17: "One fix with one right answer: the missing accents.",
    r18: "Three sentences, and an explanation for each mistake.",
    r19: "A short translation with one usual answer.",
    r20: "Seven words from a list: lookups."
  };

  // From data.json (extract.out.txt): [id, router reply, router in, router out,
  //   small in, small out, small finish_reason, large in, large out, large finish_reason]
  const D = Object.fromEntries([
    ["r01","EASY",51,2,38,78,"stop",38,41,"stop"],["r02","EASY",60,2,47,299,"length",47,421,"stop"],
    ["r03","EASY",52,2,39,243,"stop",39,166,"stop"],["r04","EASY",96,2,83,161,"stop",83,167,"stop"],
    ["r05","HARD",59,1,46,301,"length",46,723,"stop"],["r06","EASY",52,2,39,290,"stop",39,126,"stop"],
    ["r07","EASY",53,2,40,279,"stop",40,406,"stop"],["r08","EASY",51,2,38,127,"stop",38,47,"stop"],
    ["r09","HARD",202,1,189,302,"length",189,904,"stop"],["r10","EASY",50,2,37,72,"stop",37,132,"stop"],
    ["r11","EASY",56,2,43,85,"stop",43,36,"stop"],["r12","HARD",56,1,43,300,"length",43,428,"stop"],
    ["r13","EASY",50,2,37,88,"stop",37,28,"stop"],["r14","EASY",62,2,49,302,"length",49,485,"stop"],
    ["r15","EASY",56,2,43,91,"stop",43,18,"stop"],["r16","EASY",61,2,48,301,"length",48,593,"stop"],
    ["r17","EASY",53,2,40,221,"stop",40,244,"stop"],["r18","HARD",68,1,55,300,"length",55,419,"stop"],
    ["r19","EASY",50,2,37,121,"stop",37,100,"stop"],["r20","EASY",53,2,40,159,"stop",40,223,"stop"]
  ].map(([id, router, ri, ro, si, so, sf, li, lo, lf]) => [id, { id, router, route: units("small", ri, ro),
    small: { in: si, out: so, finish: sf, u: units("small", si, so) }, large: { in: li, out: lo, finish: lf, u: units("large", li, lo) } }]));
  const LABEL = Object.fromEntries(REQ.map(([id, , l]) => [id, l]));
  const TEXT = Object.fromEntries(REQ.map(([id, t]) => [id, t]));
  const IDS = REQ.map(r => r[0]);
  const HARD = IDS.filter(id => LABEL[id] === "hard");
  const COSTLY = IDS.filter(id => LABEL[id] === "hard" && D[id].router === "EASY");   // hard, sent to the small model
  const WASTE = IDS.filter(id => LABEL[id] === "easy" && D[id].router === "HARD");    // easy, sent to the larger model
  // The routed design: HARD -> larger; EASY -> small, and on finish_reason "length" -> larger. Router call included.
  const path = id => D[id].router === "HARD" ? "large" : D[id].small.finish === "length" ? "fallback" : "small";
  const routedUnits = id => D[id].route + (path(id) === "large" ? D[id].large.u : D[id].small.u + (path(id) === "fallback" ? D[id].large.u : 0));
  const ALL_LARGE = sum(IDS.map(id => D[id].large.u)), ROUTED = sum(IDS.map(routedUnits));
  const FALLBACKS = IDS.filter(id => path(id) === "fallback");
  const WHY_SHORT = COSTLY.filter(id => /why/i.test(TEXT[id]) && TEXT[id].length < 70);
  const SMALL_ONLY = IDS.filter(id => path(id) === "small");
  const TWICE = sum(FALLBACKS.map(id => D[id].small.u));
  const ROUTER_AVG = sum(IDS.map(id => D[id].route)) / IDS.length;
  const MAX_OVER = Math.max(...IDS.map(id => D[id].small.out));

  // The class's week, made up for the lesson: request id -> how many times each student sent it.
  const WEEK = {
    Ana: { r01: 3, r03: 2, r13: 2, r19: 2, r02: 1, r20: 1 }, Ben: { r04: 2, r08: 2, r10: 2, r15: 3, r07: 1 },
    Chloe: { r06: 2, r11: 3, r17: 2, r12: 1, r01: 2 }, Dev: { r19: 3, r20: 2, r03: 2, r18: 1, r13: 2 },
    Eli: { r15: 2, r08: 2, r05: 1, r04: 1, r11: 2 }, Farah: { r17: 2, r13: 3, r16: 1, r10: 2, r06: 1 },
    Gus: { r09: 14, r05: 3, r16: 3, r14: 4 }, Hana: { r01: 2, r20: 2, r02: 1, r14: 1, r19: 2 }
  };
  const HEAVY = "Gus";
  const weekOf = (s, f) => sum(Object.entries(WEEK[s]).map(([id, k]) => k * f(id)));
  const nOf = s => sum(Object.values(WEEK[s]));
  const STUDENTS = Object.keys(WEEK), OTHERS = STUDENTS.filter(s => s !== HEAVY);
  const BILL = Object.fromEntries(STUDENTS.map(s => [s, weekOf(s, id => D[id].large.u)]));
  const BILL_R = Object.fromEntries(STUDENTS.map(s => [s, weekOf(s, routedUnits)]));
  const REST = sum(OTHERS.map(s => BILL[s])), REST_R = sum(OTHERS.map(s => BILL_R[s]));
  const GUS_FB = ["no", "one", "two", "three", "four"][Object.keys(WEEK[HEAVY]).filter(id => path(id) === "fallback").length];

  // Worst case of one request under the caps (screen 7).
  const WORST_SMALL = units("small", INPUT_CAP, SMALL_MAX), WORST_LARGE = units("large", INPUT_CAP, LARGE_MAX);
  const WORST = WORST_SMALL + WORST_LARGE;

  // From docs/ai-path/recordings/s6-token-budgets-routing/small-r02.json (trimmed with … , not altered)
  const REC_R02 = { src: "s6-token-budgets-routing/small-r02", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "¡Hola! That's a fantastic question, and it gets to the heart of a really important concept in Spanish: the **subjunctive mood**. … So, because \"espero que\" expresses hope, the verb that follows",
    finish: "length", native: "MAX_TOKENS", role: "assistant", usage: { prompt_tokens: 47, completion_tokens: 299, total_tokens: 346, cost: 0.0001243 } };
  // From docs/ai-path/recordings/s6-token-budgets-routing/small-r07.json (trimmed with … , not altered)
  const REC_R07 = { src: "s6-token-budgets-routing/small-r07", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "For the phrase \"Gracias ___ todo,\" the correct word is **por**. … Since you are thanking someone *for* everything they have done, \"por\" is the right choice." };

  // From trace_answer.out.txt: [call, line about to run (0 = def), event, tier, finish_reason, prompt, completion, spent, returned]
  const TRACE = [
    ["r16",1,"",null,null,null,null,35.076,null],
    ["r16",3,"",null,null,null,null,35.076,null],
    ["r16",4,"","small",null,null,null,35.076,null],
    ["r16",5,"","small","length",48,301,35.076,null],
    ["r16",6,"","small","length",48,301,35.076,null],
    ["r16",7,"","small","length",48,301,35.076,null],
    ["r16",8,"","small","length",48,301,36.328,null],
    ["r16",9,"","large","length",48,301,36.328,null],
    ["r16",10,"","large","stop",48,593,36.328,null],
    ["r16",11,"","large","stop",48,593,51.297,null],
    ["r16",11,"r","large","stop",48,593,51.297,"¡Hola! That's a great question, as 'saber' and 'conocer' can…"],
    ["r13",1,"",null,null,null,null,51.297,null],
    ["r13",2,"",null,null,null,null,51.297,null],
    ["r13",2,"r",null,null,null,null,51.297,"Budget used up for today."]
  ].map(([call, line, ev, tier, fin, pin, pout, spent, ret]) => ({ call, line, ev, tier, fin, pin, pout, spent, ret }));
  const SPENT_BEFORE = TRACE[0].spent;   // after r09 and r02 ran untraced (trace_answer.out.txt)
  const CODE = [
    "def answer(name, rid):",
    "    if spent[name] >= DAILY_BUDGET:",
    "        return \"Budget used up for today.\"",
    "    tier = route(rid)",
    "    reply = call(tier, rid)",
    "    fin = reply[\"finish_reason\"]",
    "    if tier == \"small\" and fin == \"length\":",
    "        spent[name] += cost(tier, reply)",
    "        tier = \"large\"",
    "        reply = call(tier, rid)",
    "    spent[name] += cost(tier, reply)",
    "    return reply[\"text\"]"
  ];

  // From broken_budget.out.txt (verbatim lines)
  const LOG_BROKEN = [
    "== charge() as shipped | daily budget 40 units",
    "essay check 1: booked 0.567  spent 0.567 of 40  provider billed 23.167",
    "essay check 2: booked 0.567  spent 1.134 of 40  provider billed 23.167",
    "essay check 3: booked 0.567  spent 1.701 of 40  provider billed 23.167",
    "essay check 4: booked 0.567  spent 2.268 of 40  provider billed 23.167",
    "essay check 5: booked 0.567  spent 2.835 of 40  provider billed 23.167",
    "essay check 6: booked 0.567  spent 3.402 of 40  provider billed 23.167",
    "essay check 7: booked 0.567  spent 3.969 of 40  provider billed 23.167",
    "essay check 8: booked 0.567  spent 4.536 of 40  provider billed 23.167",
    "total: budget saw 4.536, provider billed 185.336"
  ];
  const LOG_FIXED = [
    "== charge() with output tokens | daily budget 40 units",
    "essay check 1: booked 23.167  spent 23.167 of 40  provider billed 23.167",
    "essay check 2: booked 23.167  spent 46.334 of 40  provider billed 23.167",
    "essay check 3: refused, budget used up",
    "…",
    "essay check 8: refused, budget used up",
    "total: budget saw 46.334, provider billed 46.334"
  ];
  const CHARGE = [
    "def charge(student, tier, usage):",
    "    price_in, price_out = PRICE[tier]",
    "    units = usage[\"prompt_tokens\"] * price_in / 1000",
    "    spent[student] += units",
    "    return units"
  ];

  const caption = rec => `<p class="${P}cap">Recorded model output, ${rec.recordedAt}</p>`;
  const recBlock = (who, rec, kit) => `<p class="${P}who">${who}</p><div class="${P}out">${kit.esc(rec.text)}</div>${caption(rec)}`;
  const short = (t, n = 64) => t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + " …" : t;
  const priceTable = () => `<table class="${P}tb"><thead><tr><th>cost units per 1,000 tokens</th><th class="n">input</th><th class="n">output</th></tr></thead><tbody>
      <tr><td>small model</td><td class="n">${PRICE.small[0]}</td><td class="n">${PRICE.small[1]}</td></tr>
      <tr><td>larger model</td><td class="n">${PRICE.large[0]}</td><td class="n">${PRICE.large[1]}</td></tr></tbody></table>
      <p class="${P}cap">1 cost unit = $0.0001, from the provider's list prices on 2026-11-13. Prices change; the method does not.</p>`;

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}out { white-space: pre-wrap; font: 500 14px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-top: 8px; overflow-wrap: anywhere; color: var(--ink); }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}who { font-size: 15px; color: var(--muted); margin: 18px 0 0; }
      .${P}tb { border-collapse: collapse; width: 100%; margin-top: 14px; font: 500 15px var(--mono); }
      .${P}tb th { text-align: left; font: 600 13px var(--font); color: var(--muted); padding: 4px 8px 6px; border-bottom: 2px solid var(--ink); }
      .${P}tb th.n { text-align: right; }
      .${P}tb td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--ink); }
      .${P}tb td.n { text-align: right; white-space: nowrap; }
      .${P}tb tr.hi td { font-weight: 700; }
      .${P}tb tr.hi td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
      .${P}prose td { font-family: var(--font); }
      .${P}tb tr.tot td { border-top: 2px solid var(--ink); font-weight: 700; }
      .${P}row { border-top: 1px solid var(--line); padding: 10px 0 6px; }
      .${P}row p { margin: 0 0 6px; font-size: 15px; color: var(--ink); overflow-wrap: anywhere; }
      .${P}row p b { font: 600 13px var(--mono); color: var(--muted); margin-right: 6px; }
      .${P}row .lopts { display: flex; gap: 8px; flex-wrap: wrap; }
      .${P}row .lopts button { flex: 1 1 120px; min-height: 44px; }
      .${P}rt { display: grid; gap: 6px; margin-top: 12px; }
      .${P}rt button { display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; align-items: center; width: 100%; text-align: left; min-height: 48px; padding: 6px 10px; font: 500 14px var(--font); border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 10px; cursor: pointer; }
      .${P}rt button span { overflow-wrap: anywhere; }
      .${P}rt button i { display: block; font: 600 12px var(--mono); font-style: normal; color: var(--muted); margin-top: 2px; }
      .${P}rt button b { font: 600 12px var(--mono); white-space: nowrap; }
      .${P}rt button.found { border-color: var(--good); background: var(--good-soft); }
      .${P}rt button.miss { border-color: var(--bad); background: var(--bad-soft); }
      .${P}rt .hd { display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; padding: 0 12px; font: 600 12px var(--font); color: var(--muted); }
      @media (hover: hover) { .${P}rt button:hover { border-color: var(--ink); } }
      .${P}req { font-size: 16px; background: var(--sunk); border-radius: 8px; padding: 10px 12px; margin: 10px 0; color: var(--ink); overflow-wrap: anywhere; }
      .${P}log { display: grid; gap: 8px; margin: 12px 0; }
      .${P}log > div { border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; font-size: 14px; color: var(--ink); }
      .${P}pre { white-space: pre-wrap; font: 500 13px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-top: 10px; overflow-wrap: anywhere; color: var(--ink); }
      .${P}lines { display: grid; gap: 4px; margin-top: 10px; background: var(--surface); border-radius: 8px; padding: 6px; }
      .${P}lines button { text-align: left; min-height: 44px; padding: 6px 10px; font: 500 13px var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; border: 1.5px solid transparent; background: transparent; color: var(--ink); border-radius: 6px; cursor: pointer; }
      .${P}lines button.miss { border-color: var(--bad); background: var(--bad-soft); }
      .${P}lines button.found { border-color: var(--good); background: var(--good-soft); }
      @media (hover: hover) { .${P}lines button:hover { border-color: var(--line); } }
      .${P}big { font: 700 22px var(--mono); margin-top: 10px; color: var(--ink); }
      .${P}big small { display: block; font: 500 14px var(--font); color: var(--muted); margin-top: 4px; }
      .${P}a { padding: 12px 0; }
      .${P}code .lcode div { white-space: pre-wrap; padding-left: calc(12px + 8ch); text-indent: -8ch; }
      @media (max-width: 420px) { .${P}code .lcode { font-size: 12px; } }
      .${P}row2 { flex-wrap: wrap; }
      .${P}row2 .btn { flex: 1 1 100px; min-height: 48px; }
    `;
    document.head.appendChild(s);
  }

  /* 1. The situation: what did one essay check cost? Then the class's week. */
  function situation({ el, done, kit }) {
    css();
    let ans = null;
    const r = D.r09.large, right = r.u;
    const opts = [right, units("large", r.in, 0), units("large", r.in + r.out, 0), (r.in * PRICE.large[1] + r.out * PRICE.large[0]) / 1000];
    const order = [1, 2, 3, 0].map(i => opts[i]);   // shown sorted by position, right answer last
    const correct = 3;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>One student, most of the bill</h1>
        <p class="lead">Calle Tres Tutoring (made up for this lesson) runs a homework helper for students learning Spanish. Every question goes to one larger hosted model. Last week a teacher looked at her class's bill and found that one student, ${HEAVY}, cost more than the rest of the class. This lesson is about keeping a product's model bill under control: send easy questions to a cheaper model, and put a limit on what one request and one user can spend.</p>
        <p class="lead">The provider bills by tokens. The price of a token depends on the model, and on which way it goes: tokens of the answer (output) cost more than tokens of the question (input). To get one number for every model, the team turns tokens into <b>cost units</b>:</p>
        ${priceTable()}
        <p class="lead">${HEAVY}'s usual request is an essay check: mark my essay, rewrite it, explain every fix. The recorded call used <b>${r.in}</b> input tokens and <b>${r.out}</b> output tokens on the larger model.</p>
        <p class="task">How many cost units did this one essay check cost?</p>
        <div class="lpanel">${kit.options(order.map(f3), { picked: ans, correct, num: true })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right: (${r.in} × ${PRICE.large[0]} + ${r.out} × ${PRICE.large[1]}) / 1,000 = <b>${f3(right)}</b> units. Almost all of it is the answer: the output is ${Math.round(r.out * PRICE.large[1] / (right * 1000) * 100)}% of the cost. Here is the class's week (the counts are made up; each request's tokens are the recorded ones):`, true)
            + `<table class="${P}tb"><thead><tr><th>student</th><th class="n">requests</th><th class="n">cost units</th></tr></thead><tbody>
              ${STUDENTS.map(s => `<tr class="${s === HEAVY ? "hi" : ""}"><td>${s}</td><td class="n">${nOf(s)}</td><td class="n">${f1(BILL[s])}</td></tr>`).join("")}
              <tr class="tot"><td>the other ${OTHERS.length}</td><td class="n">${sum(OTHERS.map(nOf))}</td><td class="n">${f1(REST)}</td></tr></tbody></table>`
            + kit.feedback(`${HEAVY}: ${f1(BILL[HEAVY])} units from ${nOf(HEAVY)} requests. The other ${OTHERS.length} students together: ${f1(REST)} from ${sum(OTHERS.map(nOf))}. Two questions follow. Do easy questions need the larger model at all? And how do you stop one student from spending everyone's money?`)
          : ans === 0 ? kit.feedback(`${f3(order[0])} counts only the ${r.in} input tokens. The ${r.out} tokens of the answer are billed too, at the output price, ${PRICE.large[1]} units per 1,000.`, false)
          : ans === 1 ? kit.feedback(`${f3(order[1])} prices every token at the input price. Output tokens cost ${PRICE.large[1]} units per 1,000 on this model, not ${PRICE.large[0]}.`, false)
          : kit.feedback(`${f3(order[2])} swaps the two prices. The ${r.in} tokens of the question are input (${PRICE.large[0]} per 1,000); the ${r.out} tokens of the answer are output (${PRICE.large[1]} per 1,000).`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. By hand: label the twenty requests easy or hard. */
  function labelByHand({ el, done, kit }) {
    css();
    const ans = IDS.map(() => null);
    const right = i => LABEL[IDS[i]] === "easy" ? 0 : 1;
    const paint = () => {
      const all = IDS.every((_, i) => ans[i] === right(i));
      const nHard = HARD.length;
      el.innerHTML = `<h1>Which questions need the larger model?</h1>
        <p class="lead">Here are twenty requests of the kind the helper gets (written for this lesson). Each was later sent to both models for real. The team's rule: <b>easy</b> means one right answer you could look up or check (a word, a verb form, a translation, fixing or checking one thing), even if the list is long. <b>Hard</b> means explaining why, judging or rewriting a whole text, or making something in several steps.</p>
        <p class="task">Label each request. Pick again if you change your mind.</p>
        ${IDS.map((id, i) => `<div class="${P}row" id="c${i}"><p><b>${id}</b>${kit.esc(TEXT[id])}</p>${kit.options(["Easy", "Hard"], { picked: ans[i], correct: right(i) })}${ans[i] == null || ans[i] === right(i) ? "" : kit.feedback(`${right(i) ? "Hard" : "Easy"}. ${kit.esc(WHY[id])}`, false)}</div>`).join("")}
        ${all ? kit.feedback(`All twenty labelled: ${IDS.length - nHard} easy, ${nHard} hard. Look at two of them: r04 is the longest request and it is easy; r02 is one short line and it is hard. Length is not difficulty.`, true) : ""}`;
      el.querySelectorAll(`.${P}row`).forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (IDS.every((_, j) => ans[j] === right(j))) done();
      }));
    };
    paint();
  }

  /* 3. Compare with the router's real decisions: find its costly mistakes. */
  function routerMistakes({ el, done, kit }) {
    css();
    const found = new Set();
    let miss = null, msg = null;
    const paint = () => {
      const fin = COSTLY.every(id => found.has(id));
      el.innerHTML = `<h1>What the router decided</h1>
        <p class="lead">The team tried a <b>router</b>: before each request, one short call to the small model asks “EASY or HARD?”. EASY goes to the small model, HARD to the larger one. Its prompt: <i>“Reply with exactly one word: EASY if a small, cheap model can answer it well, HARD if it needs a stronger model.”</i> Below are its real one-word replies next to your labels.</p>
        <p class="task">Tap every <b>costly mistake</b>: a hard request the router sent to the small model.</p>
        <div class="${P}rt"><div class="hd"><span>id</span><span>request and your label</span><span>router</span></div>
        ${IDS.map(id => `<button type="button" data-i="${id}" class="${found.has(id) ? "found" : miss === id ? "miss" : ""}"><b>${id}</b><span>${kit.esc(short(TEXT[id], 58))}<i>your label: ${LABEL[id]}</i></span><b>${D[id].router}</b></button>`).join("")}</div>
        <div class="lpanel">${fin ? kit.feedback(`Found all ${COSTLY.length}: ${COSTLY.join(", ")}. ${COSTLY.length} of the ${HARD.length} hard requests went to the small model. The other mistake, an easy request sent to the larger model, happened ${WASTE.length} ${WASTE.length === 1 ? "time" : "times"}: it would only waste money. This router picks the cheap model too often, so its mistakes cost students good answers, not the company money. ${WHY_SHORT.join(" and ")} are each one short line, and each asks why: a short question can still be hard.`, true)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll(`.${P}rt button`).forEach(b => b.onclick = () => {
        if (COSTLY.every(id => found.has(id))) return;
        const id = b.dataset.i;
        miss = null;
        if (COSTLY.includes(id)) { found.add(id); msg = [`${id}: hard, and the router said EASY. The student's “why” question goes to the small model. ${COSTLY.length - found.size} left.`]; }
        else if (LABEL[id] === "hard") { miss = id; msg = [`${id} is hard and the router said HARD: it goes to the larger model. That is a right call.`, false]; }
        else { miss = id; msg = [`${id} is easy and the router said EASY: the small model is the right place for it. Not a mistake.`, false]; }
        paint();
        if (COSTLY.every(x => found.has(x))) done();
      });
    };
    paint();
  }

  /* 4. Spot the idea: routers make mistakes, so check and fall back. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Rewrite the router's prompt until it makes no mistakes",
      "Send every request to the larger model again",
      "Try the small model first, check its answer, and send the request on to the larger model when the check fails",
      "Let each student choose which model answers"
    ];
    const correct = 2;
    const paint = () => {
      el.innerHTML = `<h1>The router will always miss some</h1>
        <p class="lead">${COSTLY.length} of ${HARD.length} hard requests went to the small model. A better router prompt might catch more, but no router sees the answer before it is written.</p>
        <p class="task">How do you keep most of the savings and still give hard questions a full answer?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. This is a <b>fallback</b>: the small model's answer must pass a check, and if it fails, the request goes on to the larger model. A chain of models tried cheapest first is often called a <b>cascade</b>. The check must be cheap and automatic. The simplest one: did the answer finish before the small model's token cap (the most output tokens it may write)? Next you predict what that check does on four real requests.`, true)
          : ans === 0 ? kit.feedback(`A better prompt may catch more of the ${COSTLY.length}, but it decides from the question alone. Tomorrow's students will write questions it has never seen. You still need a safety net behind it.`, false)
          : ans === 1 ? kit.feedback(`That is the bill you started with. ${IDS.length - HARD.length} of the 20 requests were easy and never needed the larger model.`, false)
          : kit.feedback(`Students cannot tell which questions are hard for a model, and most will pick the better one every time. The bill goes back to where it was.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Use it with predictions: four real requests through router + small model + check + fallback. */
  const WALK = ["r13", "r02", "r09", "r07"];
  const PATH_OPTS = ["The small model alone", "The small model, then the larger one", "The larger model alone"];
  const PATH_I = { small: 0, fallback: 1, large: 2 };
  function cascade({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const result = id => {
      const d = D[id], p = path(id);
      const steps = p === "large" ? `Router: HARD. Larger model: ${d.large.out} output tokens, finish_reason <code>${d.large.finish}</code>.`
        : `Router: EASY. Small model: ${d.small.out} of ${SMALL_MAX} output tokens, finish_reason <code>${d.small.finish}</code>.${p === "fallback" ? ` The check fails; the larger model answers in ${d.large.out} tokens.` : " The check passes."}`;
      return `<div><b>${id}</b> ${kit.esc(short(TEXT[id], 50))}<br>${steps} Cost with the router's call: <b>${f3(routedUnits(id))}</b> units, against ${f3(d.large.u)} if it had gone straight to the larger model.</div>`;
    };
    const wrongSay = (id, v) => {
      const d = D[id], p = path(id);
      if (p === "large") return `The router said HARD, so it goes straight to the larger model. The small model is never tried.`;
      if (v === 2) return `The router said EASY, so the request starts on the small model. Only HARD goes straight to the larger one.`;
      if (p === "fallback") return `The small model was still explaining when it hit its ${SMALL_MAX}-token cap: finish_reason <code>length</code>. The check catches that and sends the request on.`;
      return id === "r07" ? `It fit: ${d.small.out} of ${SMALL_MAX} tokens, finish_reason <code>stop</code>. The check passed it, so the small model's answer went to the student.`
        : `A one-word meaning fits easily: ${d.small.out} of ${SMALL_MAX} tokens, finish_reason <code>stop</code>. No fallback.`;
    };
    const paint = () => {
      const end = k >= WALK.length, id = WALK[k];
      el.innerHTML = `<h1>Small first, then check</h1>
        <p class="lead">The new rule. The router says HARD: the larger model answers (up to ${LARGE_MAX} output tokens). The router says EASY: the small model answers with a cap of ${SMALL_MAX} output tokens (<code>max_tokens</code>). Every reply has a <code>finish_reason</code> field that says why the model stopped. If it is <code>"length"</code>, the answer was cut at the cap, so the request goes on to the larger model.</p>
        ${end ? "" : `<p class="task">Request ${k + 1} of ${WALK.length}. The router said <b>${D[id].router}</b>. Who writes the answer the student gets?</p>
          <div class="${P}req"><b>${id}</b> ${kit.esc(TEXT[id])}</div>`}
        <div class="lpanel">${end ? "" : kit.options(PATH_OPTS, { picked: wrong, correct: PATH_I[path(id)] })}
        ${wrong != null ? kit.feedback(wrongSay(id, wrong), false) : ""}</div>
        ${k ? `<div class="${P}log">${WALK.slice(0, k).map(result).join("")}</div>` : ""}
        ${k > 1 ? recBlock("r02: what the small model sent before the cap cut it. A small hosted model answered:", REC_R02, kit) : ""}
        ${end ? recBlock("r07: the hard question the check let through. A small hosted model answered:", REC_R07, kit)
          + kit.feedback(`The check passed r07 because it measures length, not quality. Here the small model's answer was right. On another question a short, wrong answer would pass the same way. Over all ${IDS.length} requests: ${SMALL_ONLY.length} answered by the small model, ${FALLBACKS.length} fell back (paying ${f3(TWICE)} units for small answers nobody saw), ${IDS.length - SMALL_ONLY.length - FALLBACKS.length} sent straight to the larger model. Including about ${f3(ROUTER_AVG)} units per router call:`)
          + `<div class="${P}big">${f1(ALL_LARGE)} → ${f1(ROUTED)} units<small>all ${IDS.length} on the larger model, against routed with fallback: ${Math.round((1 - ROUTED / ALL_LARGE) * 100)}% less. Most of the saving comes from the easy requests: together they got about ${f1(sum(SMALL_ONLY.filter(x => LABEL[x] === "easy").map(x => D[x].large.u)) / sum(SMALL_ONLY.filter(x => LABEL[x] === "easy").map(x => D[x].small.u + D[x].route)))} times cheaper. The hard ones are where the money goes.</small></div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== PATH_I[path(id)]) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= WALK.length) done();
      });
    };
    paint();
  }

  /* 6. Library: the real response fields, and the provider's own fallback list. */
  const FIELD_Q = [
    ["Which field should the code read to decide on the fallback?",
      ["choices[0].finish_reason", "choices[0].native_finish_reason", "usage.total_tokens", "model"], 0],
    ["The provider also accepts a <code>models</code> list: if the first model returns an error, it tries the next one. Would that list have sent this request to the larger model?",
      ["Yes", "No"], 1]
  ];
  function apiFields({ el, done, kit }) {
    css();
    const ans = FIELD_Q.map(() => null);
    const u = REC_R02.usage;
    const json = `{\n  "model": "…",\n  "choices": [{\n    "finish_reason": "${REC_R02.finish}",\n    "native_finish_reason": "${REC_R02.native}",\n    "message": { "role": "${REC_R02.role}", "content": ${JSON.stringify(REC_R02.text)} }\n  }],\n  "usage": { "prompt_tokens": ${u.prompt_tokens}, "completion_tokens": ${u.completion_tokens}, "total_tokens": ${u.total_tokens}, "cost": ${u.cost}, … }\n}`;
    const say = [
      ["Right. <code>finish_reason</code> is the provider's own value, the same set of words for every model: <code>tool_calls</code>, <code>stop</code>, <code>length</code>, <code>content_filter</code>, <code>error</code>. <code>length</code> means the answer hit <code>max_tokens</code>.",
        "", "<code>native_finish_reason</code> is the word the model's maker uses (here MAX_TOKENS). It differs from one maker to the next; <code>finish_reason</code> is the same for all of them.",
        `<code>total_tokens</code> (${u.total_tokens}) adds the ${u.prompt_tokens} input tokens to the answer's. It does not say whether the answer finished.`,
        "<code>model</code> says which model really answered. You need it to charge the right price after a fallback, not to tell whether the answer finished."],
      ["Right. The call did not fail: it returned an answer, just a cut one. The provider's docs say that list moves on when the model returns an error, such as a context-length error, a moderation flag, a rate limit or downtime. A cut or weak answer is your code's job.",
        "This call did not fail. It came back with an answer cut at the cap, and the list only moves on when a model returns an error (context length, moderation, rate limits, downtime). A cut or weak answer is your code's job.", ""]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The fields that matter</h1>
        <p class="lead">Here is the real response to r02 from the small model, sent through the provider (OpenRouter), trimmed: only the fields that matter here are kept, and each … marks a cut inside what is shown. The request sent <code>max_tokens: ${SMALL_MAX}</code>. Three things a router and a budget need: <code>max_tokens</code> (the per-request cap you send), <code>finish_reason</code> (did the answer finish?) and <code>usage</code> (what to charge).</p>
        <div class="${P}pre">${kit.esc(json)}</div>
        <p class="${P}cap">Recorded model output, ${REC_R02.recordedAt}</p>
        <p class="task">Answer both.</p>
        ${FIELD_Q.map(([q, o, r], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(i === 0 ? o.map(x => `<code>${kit.esc(x)}</code>`) : o, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? say[i][0] : say[i][ans[i] + 1], ans[i] === r)}</div>`).join("")}
        ${FIELD_Q.every(([, , r], i) => ans[i] === r) ? kit.feedback(`One more thing from our runs: the cap is close, not exact. With <code>max_tokens: ${SMALL_MAX}</code>, the reported <code>completion_tokens</code> went up to ${MAX_OVER} on cut answers. OpenRouter's docs say the model will not go past <code>max_tokens</code>; the reported count still came out up to ${MAX_OVER - SMALL_MAX} higher in our runs. Leave a little room in budget arithmetic.`) : ""}
        <p class="lead"><b>Not run by us.</b> The <code>models</code> list is described from the <a class="${P}a" href="https://openrouter.ai/docs/guides/routing/model-fallbacks" target="_blank" rel="noopener">official documentation</a>, checked 2026-11-14. Other APIs name these fields differently; the three ideas are the same.</p>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (FIELD_Q.every(([, , r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 7. Second idea: per-request caps bound one call; a per-user budget limits a person. */
  function perUser({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [WORST_SMALL, WORST_LARGE, WORST, DAILY].map(f1);
    const correct = 2;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>Routing does not stop ${HEAVY}</h1>
        <p class="lead">Put last week through the new router. The other ${OTHERS.length} students go from ${f1(REST)} to <b>${f1(REST_R)}</b> units. ${HEAVY} goes from ${f1(BILL[HEAVY])} to <b>${f1(BILL_R[HEAVY])}</b>: his requests are hard, and ${GUS_FB} of his ${["no", "one", "two", "three", "four", "five"][Object.keys(WEEK[HEAVY]).length]} kinds of request fall back. Routing lowers the price of easy requests. It does not limit a person.</p>
        <p class="lead">So the team adds two limits. <b>Per request:</b> the app refuses pasted text over ${INPUT_CAP.toLocaleString("en")} tokens, and every call has its <code>max_tokens</code> (${SMALL_MAX} small, ${LARGE_MAX} larger). <b>Per user:</b> a daily budget of ${DAILY} cost units, checked before each request.</p>
        ${priceTable()}
        <p class="task">What is the most a single request can add to a student's spending, if it falls back? (Leave out the router's own call, as the budget code on the next screen does.)</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct, num: true })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The small try at its worst: (${INPUT_CAP.toLocaleString("en")} × ${PRICE.small[0]} + ${SMALL_MAX} × ${PRICE.small[1]}) / 1,000 = ${f1(WORST_SMALL)}. Then the larger model at its worst: (${INPUT_CAP.toLocaleString("en")} × ${PRICE.large[0]} + ${LARGE_MAX} × ${PRICE.large[1]}) / 1,000 = ${f1(WORST_LARGE)}. Together <b>${f1(WORST)}</b> units. That number matters because the budget is checked <i>before</i> a call: a student just under ${DAILY} can still start one more request, so a day can end up to ${f1(WORST)} units over. The per-request caps are what keep that overshoot small. When the budget is used up, the app can stop answering until tomorrow (a hard limit) or send everything to the small model (a soft limit); either way, it tells the student.`, true)
          : ans === 0 ? kit.feedback(`${opts[0]} is the small model's try alone. After a fallback the larger model is paid too.`, false)
          : ans === 1 ? kit.feedback(`${opts[1]} is the larger model's call alone. In a fallback the small model's cut answer was already paid for: add its worst case too.`, false)
          : kit.feedback(`${DAILY} is the whole day's budget. One request is bounded by the caps on that request: the input limit and the two <code>max_tokens</code>.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. The router and the budget in Python, replayed from a traced run. */
  const G1 = TRACE.findIndex(s => s.call === "r16" && s.line === 4);           // about to call the small model
  const G2 = TRACE.findIndex(s => s.call === "r16" && s.line === 10);           // about to charge the larger model
  function codeTrace({ el, done, kit }) {
    css();
    let i = 0, p1 = null, p2 = null;
    const o1 = ["stop", "length"], r1 = o1.indexOf(TRACE[G1 + 1].fin);
    const before = TRACE[G2].spent, after = TRACE[G2 + 1].spent, large = D.r16.large.u;
    const o2 = [before, after, SPENT_BEFORE + large].map(f3), r2 = 1;
    const say = f => {
      if (f.call === "r13" && f.line === 1) return `Next request, r13 (“${kit.esc(TEXT.r13)}”), an easy one. spent is ${f3(f.spent)}.`;
      if (f.ev === "r") return f.call === "r16"
        ? `The student gets the larger model's answer. spent is ${f3(f.spent)}, already over the ${DAILY}-unit budget: the check ran before the call, when spent was ${f3(SPENT_BEFORE)}.`
        : `Refused before any model is called: r13 costs nothing. ${HEAVY} ended the day at ${f3(f.spent)} of ${DAILY}, ${f3(f.spent - DAILY)} over, inside the ${f1(WORST)} worst case you worked out.`;
      if (f.line === 1) return f.call === "r16" ? `${HEAVY} has already sent r09 (his essay check, ${f3(D.r09.large.u)}) and r02 (a fallback) today: spent is ${f3(f.spent)}. Now r16 arrives. Is spent at the budget yet?` : "";
      if (f.line === 2) return `${f3(f.spent)} ≥ ${DAILY}: the budget is used up.`;
      if (f.line === 3) return `${f3(f.spent)} is under ${DAILY}, so the request may run. Ask the router (its recorded reply).`;
      if (f.line === 4) return `The router said EASY, so tier is "small". Call the small model with its ${SMALL_MAX}-token cap.`;
      if (f.line === 5) return `The reply: ${f.pout} output tokens, finish_reason "${f.fin}". Keep that value in fin.`;
      if (f.line === 6) return `The check: did the small model answer, and was its answer cut at the cap?`;
      if (f.line === 7) return `Both are true: the answer was cut. The small call was still billed, so charge it: ${f3(D.r16.small.u)} units.`;
      if (f.line === 8) return `spent is now ${f3(f.spent)}. Switch to the larger model.`;
      if (f.line === 9) return `Call the larger model with the same request.`;
      if (f.line === 10) return `The larger model finished: ${f.pout} output tokens, finish_reason "${f.fin}". Charge it at the larger model's price.`;
      if (f.line === 11) return `spent is ${f3(f.spent)}. Return the answer.`;
      return "";
    };
    const paint = () => {
      const f = TRACE[i];
      const gate1 = i === G1 && p1 !== r1, gate2 = i === G2 && p2 !== r2, gate = gate1 || gate2;
      el.innerHTML = `<h1>Router, fallback and budget, in Python</h1>
        <p class="lead">${CODE.length} lines put both ideas together. <code>route</code> and <code>call</code> replay the recorded replies; <code>cost</code> is the formula from screen 1. (To keep the code short, the router's own call, about ${f3(ROUTER_AVG)} units, is not charged here.) Each step replays a real run; the highlighted line runs next.</p>
        <p class="task">Step through both requests. Predict twice when asked.</p>
        <div class="${P}code">${kit.code(CODE, f.ev === "r" ? -1 : f.line)}</div>
        <div class="vars"><span>request <b>${f.call}</b></span><span>tier <b>${f.tier || "–"}</b></span><span>finish_reason <b>${f.fin || "–"}</b></span></div>
        <div class="vars"><span>spent["${HEAVY}"] <b>${f3(f.spent)}</b> of ${DAILY}</span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${f.ret ? `<div class="${P}pre">returned: ${kit.esc(f.ret)}</div>` : ""}
        ${kit.feedback(say(f))}
        ${gate1 ? `<div id="p1"><p class="task">The small model must explain the difference between saber and conocer in ${SMALL_MAX} tokens. What finish_reason comes back?</p>${kit.options(o1.map(x => `<code>${x}</code>`), { picked: p1, correct: r1 })}
          ${p1 == null ? "" : kit.feedback(`An explanation with cases for each verb is long: on screen 5, the subjunctive question (r02) ran past ${SMALL_MAX} and fell back. Expect <code>length</code>.`, false)}</div>` : ""}
        ${gate2 ? `<div id="p2"><p class="task">The larger model's answer costs ${f3(large)} units. What will spent be after this line?</p>${kit.options(o2, { picked: p2, correct: r2, num: true })}
          ${p2 == null ? "" : p2 === 0 ? kit.feedback(`${o2[0]} is spent before this line. This line adds the larger model's ${f3(large)}.`, false)
            : kit.feedback(`${o2[2]} adds the larger answer to the ${f3(SPENT_BEFORE)} from the start of the request, and forgets the ${f3(D.r16.small.u)} already charged inside the <code>if</code> for the cut small answer.`, false)}</div>` : ""}
        <div class="lsteps ${P}row2"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || gate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll("#p1 .lopts button").forEach(b => b.onclick = () => { p1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#p2 .lopts button").forEach(b => b.onclick = () => { p2 = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 9. Broken on purpose: the budget that never stopped Gus. */
  const LINE_SAY = [
    "The signature is fine: it gets the student, the tier and the usage it needs.",
    "This reads both prices correctly: PRICE[\"large\"] is (3, 25). But look at where price_out is used afterwards.",
    "",
    "This adds what it was given. The number it adds is already too small.",
    "It returns what was booked. The mistake is in how that number was made."
  ];
  const FIXES = [
    "units = usage[\"completion_tokens\"] * price_out / 1000",
    "units = (usage[\"prompt_tokens\"] * price_in + usage[\"completion_tokens\"] * price_out) / 1000",
    "units = usage[\"total_tokens\"] * price_in / 1000",
    "Keep the line, and lower DAILY_BUDGET to 4"
  ];
  function broken({ el, done, kit }) {
    css();
    let line = null, fix = null;
    const R = D.r09.large;
    const paint = () => {
      const lineOk = line === 2, fixOk = fix === 1;
      el.innerHTML = `<h1>The budget that never fired</h1>
        <p class="lead">Before routing, the team had already shipped a daily budget of ${DAILY} units. ${HEAVY} never hit it. We ran their <code>charge()</code> on a day of ${HEAVY}'s: eight essay checks on the larger model (the recorded r09 call each time). Each line of the log shows what <code>charge()</code> booked (added to the student's spending), the total the budget check saw, and what the provider itself billed for that call (<code>usage.cost</code>, in units).</p>
        <div class="${P}pre">${kit.esc(LOG_BROKEN.join("\n"))}</div>
        <p class="task">Tap the line of <code>charge()</code> that causes this.</p>
        <div class="${P}lines">${CHARGE.map((c, j) => `<button type="button" data-i="${j}" class="${lineOk && j === 2 ? "found" : line === j && !lineOk ? "miss" : ""}">${kit.esc(c)}</button>`).join("")}</div>
        <div class="lpanel">${line == null ? "" : lineOk
          ? kit.feedback(`Right. It charges only <code>prompt_tokens</code> at the input price: ${R.in} × ${PRICE.large[0]} / 1,000 = ${f3(units("large", R.in, 0))}. The ${R.out} output tokens, at ${PRICE.large[1]} per 1,000, never reach the budget. An essay check is mostly output, so the budget saw ${f1(units("large", R.in, 0) / R.u * 100)}% of the real cost. No error, no warning: the log looked healthy.`, true)
          : kit.feedback(LINE_SAY[line], false)}
        ${lineOk ? `<div id="fx"><p class="task">Which fix makes the budget see the real cost?</p>${kit.options(FIXES.map(x => `<code>${kit.esc(x)}</code>`), { picked: fix, correct: 1 })}
          ${fix == null ? "" : fixOk ? kit.feedback(`Right. Input and output, each at its own price. We ran the same day again with that line:`, true) + `<div class="${P}pre">${kit.esc(LOG_FIXED.join("\n"))}</div>` + kit.feedback(`The budget now matches the provider's bill, and stops ${HEAVY} after the second essay check. A cheap habit that would have caught this early: compare your own total with the provider's reported cost every day.`)
            : fix === 0 ? kit.feedback(`That forgets the input instead. Here input is only ${f3(units("large", R.in, 0))} per essay, but a long chat or a pasted text is all input, and it is billed.`, false)
            : fix === 2 ? kit.feedback(`That prices the answer at the input price: (${R.in} + ${R.out}) × ${PRICE.large[0]} / 1,000 = ${f3(units("large", R.in + R.out, 0))}, still far from ${f3(R.u)}. On this model output costs ${PRICE.large[1]} per 1,000, not ${PRICE.large[0]}.`, false)
            : kit.feedback(`That hides the symptom for ${HEAVY} and breaks it for everyone else: every student's spending is still measured wrongly, by a different amount for each kind of request.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => { if (line === 2) return; line = +b.dataset.i; paint(); });
      el.querySelectorAll("#fx .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 1) done(); });
    };
    paint();
  }

  /* 10. The big picture, with a task. */
  const BIG = [
    ["A support bot. Most questions are “where is my order?” lookups; a few are long complaints that need care. A wrong lookup is easy to spot by code.", 0,
      "Right. Mostly easy traffic, and a cheap check exists. Route the lookups to a small model and fall back when the check fails."],
    ["A free writing app. A handful of users paste whole chapters and ask for rewrites all day, and the bill grows every month.", 1,
      "Right. The problem is a few people, not the price of each request. Cap each request, give each user a budget, and decide what happens at the limit."],
    ["An internal tool for five lawyers. Every request is a long contract review, and each one needs the strongest model.", 2,
      "Right. Nothing is easy, so a router would send everything to the larger model and add a call for nothing. Five trusted users need no budget code either; a monthly spending alert is enough."]
  ];
  const BIG_OPTS = ["Route with a fallback", "Per-user budget", "Neither: one strong model"];
  const BIG_WRONG = [
    ["", "Nobody here overspends; the cost is spread over many cheap questions sent to an expensive model. That is what routing fixes.", "Most of these questions are lookups. Sending them all to the strongest model pays a high price for easy work."],
    ["Routing makes each request cheaper, but rewrites of whole chapters are hard, so they would still go to the larger model. The few users have no limit.", "", "One model leaves a handful of users free to spend without a limit."],
    ["Every request is hard, so the router would send each one to the larger model, after a call of its own. You pay more and wait longer.", "Five trusted users with a known workload: a per-user budget is code to maintain with nothing to protect against.", ""]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to route, when to budget</h1>
        <p class="lead"><b>What for:</b> routing pays for the larger model only where it is needed; budgets stop one request or one user from spending without a limit.</p>
        <p class="lead"><b>Route</b> when most traffic is easy and a cheap automatic check can catch the small model's failures. <b>Do not</b> when nearly everything is hard, or when a wrong cheap answer is costly and no check can see it: use the strong model, and add human review where it matters.</p>
        <p class="lead"><b>Budget</b> every product with outside users: cap each request, then each user.</p>
        <p class="lead"><b>Costs:</b> a router call on every request (time and money), fallbacks pay and wait twice, router labels and checks need testing as traffic changes, and a blocked user needs a clear message.</p>
        <p class="task">Pick the right move for each situation.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : BIG_WRONG[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 11. Recognise it: route to a cheaper model here? Two "no" cases. */
  const CASES = [
    ["A shop sorts 50,000 product reviews into positive, negative or mixed. Most are obvious. The answer must be one of the three words.", true,
      "Yes. Mostly easy, and the check is cheap: if the small model's reply is not one of the three words, send the review to the larger model.",
      "Most reviews are obvious, and a reply that is not one of the three words is easy to catch in code. That is a cheap check, so a fallback works."],
    ["Nurses ask a drug-dosage helper short questions. A short wrong dose reads exactly like a short right one.", false,
      "No. The fallback is only as good as its check. A wrong dose finishes inside the token cap and looks well-formed, so it passes, and the mistake is dangerous. Use the strong model for every request, and keep a human check.",
      "A routing check sees length or format, not truth. A short, fluent, wrong dose passes it, and here that mistake is dangerous. The savings are not worth it: use the strong model, and keep a human check."],
    ["A code assistant completes one line as you type, and sometimes is asked to refactor a whole file.", true,
      "Yes. One-line completions are many, short and cheap to check (does it parse?); whole-file work goes to the larger model. Here the app already knows which kind of request it is, so the routing is a plain <code>if</code>, with no router call and no added delay.",
      "Line completions are most of the traffic and are short; whole-file refactors are rare and hard. That split is exactly where a router saves money."],
    ["A team summarises board meeting transcripts once a month. Each transcript is long and every summary is read closely.", false,
      "No. Twelve requests a year, every one hard. A router would send each to the larger model anyway, and the savings would be cents. One strong model is simpler.",
      "There is nothing easy to send to a small model, and twelve requests a year cost little whatever you do. A router adds a call and a failure point for no saving."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Route to a cheaper model here?</h1>
        <p class="lead">Four situations away from the homework helper. Ask: is much of the traffic easy, and can a cheap check catch the small model's failures?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next (in-page practice: nothing extra). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Cheap where you can, capped everywhere</h1>
      <p class="lead">You can now price a request in cost units, route easy requests to a small model with a fallback, and limit both one request and one user.</p>
      <table class="${P}tb ${P}prose"><tbody>
        <tr><td><b>Price</b></td><td>input tokens × input price + output tokens × output price, per model, from <code>usage</code>.</td></tr>
        <tr><td><b>Route</b></td><td>A cheap router picks the model. It will miss some, so check the small model's answer and fall back on failure.</td></tr>
        <tr><td><b>Check</b></td><td><code>finish_reason</code> catches cut answers, not wrong ones. Use a stronger check where a wrong answer matters.</td></tr>
        <tr><td><b>Cap</b></td><td>Per request: input size and <code>max_tokens</code>. Per user: a daily budget checked before each call, with a clear message at the limit.</td></tr>
        <tr><td><b>Verify</b></td><td>Compare your own total with the provider's bill.</td></tr>
      </tbody></table>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. ${nx.id === "s6-docker-ai-service" ? "The code that routes and budgets calls has to run as a service, the same way on a server as on your laptop. That lesson packages such a service." : "It builds on the costs and limits you set here."}</p>` : ""}`;
    done();
  }

  const FIRST_WRONG = IDS.findIndex(id => LABEL[id] === "hard");
  LessonKit.define(ID, {
    title: "Token budgets and routing to cheaper models",
    checked: "2026-11-14",
    sources: [
      "https://openrouter.ai/docs/api-reference/overview",
      "https://openrouter.ai/docs/api-reference/parameters",
      "https://openrouter.ai/docs/guides/routing/model-fallbacks",
      "https://openrouter.ai/docs/use-cases/reasoning-tokens",
      "https://openrouter.ai/api/v1/models",
      "https://arxiv.org/abs/2305.05176",
      "https://arxiv.org/abs/2406.18665"
    ],
    interview: [{
      q: "Your LLM bill doubled last month, and one customer accounts for most of it. What do you build?",
      good: [
        "Measure first: cost per request from usage, input and output tokens each at its model's price, summed per user in one unit",
        "Cap each request: a limit on input size and max_tokens, so one call has a known worst case",
        "Give each user a budget checked before each call, and decide what happens at the limit: block until tomorrow or downgrade to a small model, with a clear message",
        "Compare your own totals with the provider's reported cost, so a counting bug shows up in a day",
        "If much of the traffic is easy, also route it to a cheaper model"
      ],
      weak: "Switch everyone to a cheaper model, or raise prices, without measuring who spends what or putting any limit on one user."
    }, {
      q: "You added a router that sends easy requests to a small model. How do you know it is not hurting answers, and what happens when it is wrong?",
      good: [
        "Label a sample of real requests by hand and count the router's mistakes both ways: hard sent small (hurts quality) and easy sent large (wastes money)",
        "Try the small model first and fall back to the larger one when an automatic check fails",
        "Know what the check catches: finish_reason length catches cut answers, a format check catches bad output, neither catches a fluent wrong answer",
        "Watch the fallback rate: each fallback pays and waits twice"
      ],
      weak: "Trust the router prompt because it looked right on a few examples, with no labelled sample and no fallback."
    }],
    screens: [situation, labelByHand, routerMistakes, spotIdea, cascade, apiFields, perUser, codeTrace, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`#c${FIRST_WRONG} [data-wrong]`], right: IDS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ['[data-i="r01"]'], right: COSTLY.map(id => `[data-i="${id}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: WALK.map(() => "[data-right]") },
      { wrong: ["#c0 [data-wrong]"], right: FIELD_Q.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(G1).fill("[data-next]"), "#p1 [data-wrong]"],
        right: ["#p1 [data-right]", ...Array(G2 - G1).fill("[data-next]"), "#p2 [data-right]", ...Array(TRACE.length - 1 - G2).fill("[data-next]")] },
      { wrong: ['[data-i="3"]'], right: ['[data-i="2"]', "#fx [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
