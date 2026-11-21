/* Lesson: from prototype to production, the build loop for an AI feature.
   Story: a meal-planning app adds "plan my week from what is in my fridge". Mira, an engineer on the team, wrote
   the prototype prompt in an afternoon. Ideas: (1) the three stages (prototype, MVP, production) each answer one
   new question with the cheapest test that can answer it, and each has a gate; (2) at every step the next move
   (build more, gather user feedback, run an experiment) follows from what you do not know yet.
   Data, all real:
   - golden set: docs/ai-path/runs/s7-prototype-to-production/golden_set.json (eight households, written by us);
   - recordings (main checkout) docs/ai-path/recordings/s7-prototype-to-production/v1-h1 … v3-h8 (24 calls, one
     small hosted model): v1 = the prototype prompt, v2 = three rules added to the prompt, v3 = v2 with diet-
     forbidden items removed by code before the call. Requests made by make_requests.py, recorded by record_all.sh;
   - check results: check_plans.py + check_plans.out.txt in the same runs folder (code checks: missing food in
     the ingredients or named in the dinner, and the household note).
   Lesson-local style: results table, sort board, prompt block (.lx-s7-prototype-to-production-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s7-prototype-to-production";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const words = n => NUM[n] || String(n);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s7-prototype-to-production/golden_set.json
  const STAPLES = ["salt", "pepper", "cooking oil", "flour", "sugar", "dried herbs", "spices"];
  const HOUSE = [
    { id: "h1", label: "vegetarian couple", fridge: ["eggs", "spinach", "feta", "tomatoes", "half a cucumber", "milk", "yoghurt", "carrots", "potatoes"], note: "Two adults. We are vegetarian." },
    { id: "h2", label: "family, nut allergy", fridge: ["chicken thighs", "broccoli", "cheddar", "milk", "butter", "peppers", "rice", "peanut butter", "apples"], note: "Family of four. Our son is allergic to nuts, including peanuts." },
    { id: "h3", label: "one person, nearly empty", fridge: ["eggs", "butter", "half a lemon"], note: "One adult." },
    { id: "h4", label: "couple, vegan", fridge: ["tofu", "chickpeas", "spinach", "coconut milk", "carrots", "onions", "lentils", "rice", "honey"], note: "Two adults, both vegan." },
    { id: "h5", label: "flatmates, gluten-free", fridge: ["minced beef", "tomatoes", "onions", "potatoes", "courgettes", "cheddar", "eggs", "pasta", "bread"], note: "Three flatmates. One of us cannot eat gluten, and we always cook one meal for all three." },
    { id: "h6", label: "family, no pork", fridge: ["salmon", "potatoes", "green beans", "eggs", "bacon", "lemons", "yoghurt", "cucumber", "rice"], note: "Two adults and a child. We do not eat pork. The bacon is for the dog." },
    { id: "h7", label: "student, messy list", fridge: ["2 eggs??", "some old cheddar", "LEFTOVER rice", "ketchup", "frozen peas", "1 onion"], note: "Student, one person, small budget." },
    { id: "h8", label: "couple, no restrictions", fridge: ["chicken breasts", "mushrooms", "cream", "spinach", "garlic", "pasta", "parmesan", "lemons", "eggs", "potatoes"], note: "Two adults. We eat anything." }
  ];
  // The prompts, from make_requests.py (V1_SYSTEM, and the three rules of V2_SYSTEM)
  const PROMPT_V1 = "You plan dinners for a household. Plan 7 dinners for the week from what is in their fridge. Reply only with JSON: {\"dinners\": [{\"day\": \"Mon\", \"dinner\": \"...\", \"ingredients\": [\"...\"]}]}. List ingredients as plain names, no amounts.";
  const RULES_V2 = [
    "1. Every ingredient of every dinner must be a fridge item or one of these staples: salt, pepper, cooking oil, flour, sugar, dried herbs, spices. Never use anything else.",
    "2. Follow the household note exactly (diets, allergies).",
    "3. Plan up to 7 dinners. If the fridge is not enough for 7, plan fewer dinners; do not invent food."
  ];

  // From docs/ai-path/runs/s7-prototype-to-production/check_plans.out.txt, one entry per plan:
  // [dinners planned, fridge items sent, missing food [[day, food, dinner name or ""]], diet breaks [[day, forbidden word]]]
  // ("outside" rows have the ingredient as food and no name; "name" rows give the food the dish needs.
  //  Diet breaks are the "broken" rows, one per day and word.)
  const RES = {
    v1: {
      h1: [7, 9, [], []],
      h2: [7, 9, [["Thu", "tortilla", "Chicken and Pepper Quesadillas"]], []],
      h3: [7, 3, [["Fri", "bread", "Egg Salad Sandwich (using hard-boiled eggs)"]], []],
      h4: [7, 9, [], [["Sun", "honey"]]],
      h5: [7, 9, [], [["Tue", "pasta"], ["Sat", "bread"], ["Sun", "pasta"], ["Sun", "bread"]]],
      h6: [7, 9, [], []],
      h7: [7, 6, [], []],
      h8: [7, 10, [["Fri", "rice", "Chicken and Mushroom Risotto"]], []]
    },
    v2: {
      h1: [7, 9, [], []], h2: [6, 9, [], []], h3: [1, 3, [], []],
      h4: [6, 9, [], [["Thu", "honey"]]],
      h5: [5, 9, [], [["Mon", "pasta"], ["Wed", "bread"]]],
      h6: [7, 9, [], []], h7: [2, 6, [], []], h8: [7, 10, [], []]
    },
    v3: {
      h1: [7, 9, [], []],
      h2: [7, 8, [["Sat", "eggs", ""], ["Thu", "tortilla", "Chicken and Cheddar Quesadillas with a side of Rice"], ["Fri", "pasta", "Creamy Chicken and Broccoli Pasta"]], []],
      h3: [1, 3, [], []], h4: [5, 8, [], []],
      h5: [5, 7, [["Tue", "rice", "Beef and Vegetable Stir-fry with Rice"]], []],
      h6: [7, 8, [], []], h7: [2, 6, [], []], h8: [7, 10, [], []]
    }
  };

  // From the recordings (fields of the model's JSON reply, not altered; shown as table rows)
  const REC = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17" };
  // v1-h1.json: the prototype on Mira's own fridge (household h1)
  const DEMO = [
    ["Mon", "Spinach and Feta Omelette", ["eggs", "spinach", "feta", "tomatoes"]],
    ["Tue", "Roasted Potatoes with Feta and Tomatoes", ["potatoes", "feta", "tomatoes"]],
    ["Wed", "Cucumber and Tomato Salad with Yoghurt Dressing", ["cucumber", "tomatoes", "yoghurt", "milk"]],
    ["Thu", "Potato and Spinach Hash", ["potatoes", "spinach", "eggs"]],
    ["Fri", "Feta and Tomato Stuffed Potatoes", ["potatoes", "feta", "tomatoes"]],
    ["Sat", "Spinach and Feta Frittata", ["spinach", "feta", "eggs", "milk"]],
    ["Sun", "Carrot and Potato Soup", ["carrots", "potatoes", "milk"]]
  ];
  const SNIP = {
    "v1-h3": ["Fri", "Egg Salad Sandwich (using hard-boiled eggs)", ["eggs", "butter"]],
    "v1-h4": ["Sun", "Sweet and Savory Tofu with Roasted Carrots", ["tofu", "carrots", "honey", "onions"]],
    "v1-h5": ["Sat", "Beef Burgers on Gluten-Free Buns with Fried Eggs", ["minced beef", "eggs", "bread"]],
    "v2-h3": ["Mon", "Scrambled eggs with butter", ["eggs", "butter", "salt", "pepper", "cooking oil"]],
    "v2-h4": ["Thu", "Tofu and Carrot Stir-fry with Rice", ["tofu", "carrots", "onions", "rice", "cooking oil", "salt", "pepper", "honey"]],
    "v3-h2": ["Fri", "Creamy Chicken and Broccoli Pasta", ["chicken thighs", "broccoli", "milk", "butter", "flour", "salt", "pepper"]]
  };
  const CAPTION = `Recorded model output, ${REC.recordedAt}. The model's JSON reply, shown as rows.`;

  /* ---------- Derived from the data ---------- */
  const N = HOUSE.length;
  const H = id => HOUSE.find(h => h.id === id);
  const res = (v, id) => { const [dinners, sent, missing, diet] = RES[v][id]; return { dinners, sent, missing, diet, pass: !missing.length && !diet.length }; };
  const passed = v => HOUSE.filter(h => res(v, h.id).pass).length;
  const missingPlans = v => HOUSE.filter(h => res(v, h.id).missing.length).length;
  const dietPlans = v => HOUSE.filter(h => res(v, h.id).diet.length).length;
  const failing = v => HOUSE.filter(h => !res(v, h.id).pass).map(h => h.id);
  const DEMO_N = DEMO.length;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-tab { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; line-height: 1.4; }
      .lx-${ID}-tab caption { text-align: left; font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 0 0 6px; }
      .lx-${ID}-tab th { text-align: left; font: 600 13px/1.4 var(--font); color: var(--muted); padding: 6px 8px 6px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-tab td { padding: 8px 8px 8px 0; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
      .lx-${ID}-tab td.n { font-family: var(--mono); white-space: nowrap; }
      .lx-${ID}-tab td:first-child { overflow-wrap: normal; }
      .lx-${ID}-tab tr.bad td.r { color: var(--bad); }
      .lx-${ID}-tab tr.ok td.r { color: var(--good); }
      .lx-${ID}-plan { width: 100%; border-collapse: collapse; margin: 12px 0 0; font-size: 15px; line-height: 1.4; }
      .lx-${ID}-plan td { padding: 6px 8px 6px 0; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
      .lx-${ID}-plan td:first-child { font: 600 14px var(--mono); width: 3em; }
      .lx-${ID}-plan .ing { display: block; font: 500 13.5px/1.45 var(--mono); color: var(--ink-2); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-prompt { margin: 12px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-fridge { margin: 10px 0 0; font: 500 15px/1.5 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
      .lx-${ID}-card { margin: 14px 0 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font-size: 17px; line-height: 1.45; }
      .lx-${ID}-card small { display: block; font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
      .lx-${ID}-board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0 0; }
      .lx-${ID}-col { border-top: 2px solid var(--ink); padding-top: 6px; min-width: 0; }
      .lx-${ID}-col h3 { margin: 0 0 4px; font: 600 13px/1.4 var(--mono); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-col ol { margin: 0; padding: 0 0 0 1.2em; font-size: 14px; line-height: 1.4; color: var(--ink-2); }
      .lx-${ID}-col li { margin: 0 0 6px; }
      .lx-${ID}-col .gate { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { display: block; text-align: left; }
      .lx-${ID}-opt .ing { display: block; font: 500 13.5px/1.4 var(--mono); color: var(--muted); }
      @media (max-width: 620px) { .lx-${ID}-board { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const planRows = rows => `<table class="lx-${ID}-plan"><tbody>${rows.map(([d, name, ing]) =>
    `<tr><td>${esc(d)}</td><td>${esc(name)}<span class="ing">${esc(ing.join(", "))}</span></td></tr>`).join("")}</tbody></table>`;
  const cap = () => `<p class="lx-${ID}-cap">${CAPTION}</p>`;
  const fridgeLine = h => `<p class="lx-${ID}-fridge">${esc(h.fridge.join(", "))}</p>`;
  const why = r => {
    if (r.pass) return "passes";
    const out = [];
    if (r.missing.length) out.push("missing food: " + r.missing.map(([d, f, dish]) => `${d} ${f}${dish ? ` (in “${dish}”)` : ""}`).join(", "));
    if (r.diet.length) out.push("breaks the note: " + r.diet.map(([d, w]) => `${d} ${w}`).join(", "));
    return out.join("; ");
  };
  const results = (v, title) => `<table class="lx-${ID}-tab"><caption>${esc(title)}</caption>
    <thead><tr><th>household</th><th>plan</th><th>code checks</th></tr></thead><tbody>${HOUSE.map(h => {
      const r = res(v, h.id);
      return `<tr class="${r.pass ? "ok" : "bad"}"><td>${esc(h.label)}</td><td class="n">${plural(r.dinners, "dinner")}<br>from ${plural(r.sent, "item")}</td><td class="r">${esc(why(r))}</td></tr>`;
    }).join("")}</tbody></table>`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked], picked === correct)}`;
  }

  /* 1. The situation: judge the prototype's plan for Mira's fridge. */
  function demo({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const ALL = DEMO_N;
    const opts = DEMO.map(([d, name, ing]) => `<span class="lx-${ID}-opt"><b>${esc(d)}</b> ${esc(name)}<span class="ing">${esc(ing.join(", "))}</span></span>`)
      .concat([`All ${words(DEMO_N)} can be cooked from this fridge`]);
    const ok = res("v1", "h1").pass;
    const fb = DEMO.map(([d, name, ing]) => `${esc(name)} needs ${esc(ing.join(", "))}. Every one of those is on the fridge list${ing.includes("cucumber") ? " (the cucumber is the half cucumber)" : ""}, and the dish's name asks for nothing more. Check the other dinners the same way.`)
      .concat([ok ? `Right. Every dinner uses only what is in the fridge, and none has meat. On this one fridge, the prototype works. Mira shows it at Monday's meeting, and the room is impressed. Keep this plan in mind: ${words(DEMO_N)} good dinners out of ${words(DEMO_N)}, on one fridge.` : ""]);
    const paint = () => {
      el.innerHTML = `<h1>Plan my week from my fridge</h1>
        <p class="lead">A meal-planning app wants a new button: you type what is in your fridge, and it plans your dinners for the week. Mira, an engineer on the team, built a first version in one afternoon: one prompt to a hosted model, no app screen yet. This is her prompt:</p>
        <div class="lx-${ID}-prompt">${esc(PROMPT_V1)}</div>
        <p class="lead">She tried it on her own fridge. Household: “${esc(H("h1").note)}” Fridge:</p>
        ${fridgeLine(H("h1"))}
        <p class="lead">A small hosted model answered with the plan below, one button per dinner. Staples, such as salt, oil and spices, are always in the cupboard.</p>
        <p class="task">Would you trust this plan? Tap a dinner that cannot be cooked from this fridge, or say that all ${words(ALL)} can.</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: ALL })}${cap()}${ans == null ? "" : kit.feedback(fb[ans], ans === ALL)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === ALL) done(); });
    };
    paint();
  }

  /* 2. By hand: sort twelve entries of the feature's log into prototype, MVP and production. */
  const STAGES = ["Prototype", "MVP", "Production"];
  // [text, stage, feedback when put in each wrong stage]; WHEN (below) = its place in time inside its stage
  const LOG = [
    [`Wrote a golden set of ${words(N)} fridges, including a vegan couple and a nearly empty fridge.`, 1,
      { 0: "A prototype does not need a test set yet: it asks whether the idea can work at all, on a few inputs you read yourself. Writing and scoring a fixed set is the first job of the MVP.",
        2: "Too late for production. Without the golden set you cannot tell whether a change made the feature better or worse, and you need that before real users rely on it." }],
    ["Wrote one prompt in an afternoon and ran it on her own fridge list.", 0,
      { 1: "An MVP is something real users can try. One prompt run on one fridge is the quick test of whether the idea can work at all: the prototype.",
        2: "Nothing here is ready for users: no app screen, no checks. One prompt on one fridge is the prototype." }],
    ["Switched it on for a small share of all users, then widened it while watching the alerts.", 2,
      { 0: "A prototype has no users. Rolling out to a share of all users is the last step: production.",
        1: "The MVP goes to a small group who signed up for a beta. A share of <i>all</i> users, widened over time, is the production rollout." }],
    ["Showed the plan to three home cooks and asked whether they would use it.", 0,
      { 1: "In the MVP, users get the real feature in the app. Showing a printed plan to three cooks is the cheap early test of whether anyone wants it: prototype.",
        2: "Production is everyone, through the app. Asking three cooks for a first reaction comes before anything is built: prototype." }],
    ["Wrote code checks: every food is in the fridge or a staple, and nothing the household note forbids.", 1,
      { 0: "The prototype is read by eye. Checks in code come with the golden set, so the same test runs after every change: MVP.",
        2: "Production reuses these checks on live plans, but they are written while building the MVP, together with the golden set they score." }],
    ["Added a fallback: if the model call fails, show saved recipes that match the fridge.", 2,
      { 0: "A prototype is allowed to fail. A fallback matters when many people depend on the button every day: production.",
        1: "A beta group can live with an error message. When everyone has the button, an outage must not leave them with nothing: production." }],
    ["Turned diets into tick boxes, and removed forbidden foods in code before the model call.", 1,
      { 0: "This is a fix for failures that the golden set found. You need the set first, so it belongs to the MVP.",
        2: "This must be in place before any real household with an allergy uses the feature, and the beta has real households: MVP." }],
    ["Logged every call: errors, latency, cost, and a weekly sample of plans read by a person.", 2,
      { 0: "A prototype is read by hand, one answer at a time. Logging every call is how you watch thousands of plans you will never see: production.",
        1: "A beta is small enough to talk to its users. Full logging with a weekly sample is what you need once you cannot: production." }],
    ["Opened a beta for households who signed up, with a thumbs up or down under each plan.", 1,
      { 0: "The prototype has no app screen and no real users. A beta inside the app, for people who signed up, is the MVP.",
        2: "Production is all users. A beta is a small, chosen group, so it is the MVP's way to meet real users." }],
    ["Drew the screen on paper: a fridge list in, seven dinners out.", 0,
      { 1: "Nothing is built yet: a paper sketch is the cheapest way to show the idea. Prototype.",
        2: "A paper sketch is the opposite of production: the cheapest early test of the idea. Prototype." }],
    ["Set an alert for when more plans than usual fail the code checks.", 2,
      { 0: "An alert needs live traffic and a normal level to compare with. A prototype has neither.",
        1: "In the beta you read the feedback yourself. An alert is for when the traffic is too big to read: production." }],
    ["Read the seven dinners by hand: could you really cook each one?", 0,
      { 1: "In the MVP, checks run in code over a whole golden set. Reading one plan by eye is how the prototype is judged.",
        2: "In production nobody can read every plan. Reading one plan by hand is the prototype's test." }]
  ];
  const WHEN = [1, 1, 4, 4, 2, 3, 3, 1, 4, 3, 2, 2];
  function sortLog({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k >= LOG.length;
      const cur = fin ? null : LOG[k];
      const placed = LOG.slice(0, k);
      el.innerHTML = `<h1>Sort the feature's log</h1>
        <p class="lead">A demo like Mira's is only the start. Teams usually take an AI feature to every user in three stages. A <b>prototype</b> is a quick test of the idea. An <b>MVP</b> (minimum viable product) is the smallest version real users can try. <b>Production</b> is the feature for everyone. Here are ${words(LOG.length)} entries from the fridge feature's log, mixed up. Mira is the engineer from the first screen.</p>
        ${fin ? "" : `<p class="task">Which stage does this entry belong to? (${k + 1} of ${LOG.length})</p>
        <div class="lx-${ID}-card"><small>log entry</small>${esc(cur[0])}</div>
        <div class="lpanel">${kit.options(STAGES, { picked: wrong, correct: cur[1] })}${wrong != null ? kit.feedback(cur[2][wrong], false) : ""}</div>`}
        ${fin ? `<div class="lpanel">${kit.feedback(`All ${words(LOG.length)} sorted, and each stage's entries are now in the order they happened. Look at what changes from stage to stage: the prototype is read by eye and shown to a few people; the MVP adds a fixed test set, checks in code and a small group of real users; production adds what you need when nobody can watch every plan: logs, alerts, a fallback and a slow rollout.`, true)}</div>` : ""}
        <div class="lx-${ID}-board">${STAGES.map((s, i) => `<div class="lx-${ID}-col"><h3>${s}</h3><ol>${placed.map((e, j) => [e, WHEN[j]]).filter(([e]) => e[1] === i).sort((a, b) => a[1] - b[1]).map(([e]) => `<li>${esc(e[0])}</li>`).join("") || "<li>…</li>"}</ol></div>`).join("")}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const p = +b.dataset.i;
        if (p !== LOG[k][1]) { wrong = p; paint(); return; }
        wrong = null; k++; paint();
        if (k >= LOG.length) done();
      });
    };
    paint();
  }

  /* 3. The gate out of each stage. */
  const GATES = [
    "It works on a few real fridges, and a few cooks say they would use it",
    "It passes the golden set at the bar the team set, and beta households really cook from it",
    "It is watched, it fails safely, it can be switched off, and its cost per user is known",
    "No plan ever has a mistake"
  ];
  const GATE_AT = ["Leaving the prototype", "Leaving the MVP", "Production: from a small share of users to everyone"];
  // The order the four options are shown in for each stage, so the right answer is not simply the i-th button.
  const GATE_ORDER = [[1, 0, 3, 2], [2, 3, 1, 0], [0, 2, 3, 1]];
  const GATE_FB = [ // [stage][picked option]
    [null,
      "That is the bar for leaving the MVP. Before you write a golden set and open a beta, you only need to know the idea can work and that someone wants it.",
      "That is the bar for the full launch. Monitoring and fallbacks for a prompt that might be thrown away tomorrow are wasted work.",
      "No model gets there, and you cannot even measure it from a prototype. The prototype's job is to show the idea can work, cheaply."],
    ["The prototype already showed that. Before real households rely on it you need numbers from a fixed test set, and proof that people use it.",
      null,
      "Those are for the full launch. The question at the end of the MVP is whether it works often enough and whether people want it.",
      "That bar is never met by a model, so the feature would never leave the MVP. The team sets a bar it can measure, and catches the rest."],
    ["That was enough to start an MVP. Before everyone gets it, you need far more than a few fridges and a few opinions.",
      "That got you out of the MVP. Going to everyone adds new risks: an outage, a cost that grows with every user, failures nobody reports.",
      null,
      "Even in production some plans will be wrong. What protects users is that you see failures (monitoring), they do no harm (a fallback, a warning shown with the plan) and you can switch it off."]
  ];
  function gates({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const paint = () => {
      el.innerHTML = `<h1>The gate out of each stage</h1>
        <p class="lead">Each stage ends at a gate: a question the team must be able to answer with evidence before it spends more. Moving on costs more each time: more people, more users, more to keep running.</p>
        <p class="task">For each stage, pick what must be true before the team moves past it.</p>
        ${GATE_AT.map((s, i) => `<div class="lcase" id="g${i}"><p><b>${s}</b></p>
          ${kit.options(GATE_ORDER[i].map(k => GATES[k]), { picked: ans[i], correct: GATE_ORDER[i].indexOf(i) })}${ans[i] == null ? "" : GATE_ORDER[i][ans[i]] === i ? kit.feedback(["Right: it can work, and someone wants it. Only then is a golden set and a beta worth the effort.", "Right: measured on a fixed set, and used by real people.", "Right: you can see it, it still does something useful when the model fails, you can stop it, and you can afford it."][i], true) : kit.feedback(GATE_FB[i][GATE_ORDER[i][ans[i]]], false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, j) => a != null && GATE_ORDER[j][a] === j)) done();
      }));
    };
    paint();
  }

  /* 4. Spot the idea: why not ship the demo? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "Big companies need sign-off before a launch, and the stages are that paperwork",
      "Each stage answers one new question with the cheapest test that can answer it, and you spend more only after the cheaper answer is in",
      "The model needs a few weeks of real fridges to learn the task before everyone uses it",
      "The stages give the team time to move to a bigger model before launch"
    ];
    const fb = [
      "A two-person team has no one to sign off, and still needs the stages. Each one answers a question the demo cannot: how often does it work, do people use it, does it hold up for everyone.",
      `Right. The demo answers one question: can it work? It cannot say how often it works, or whether people will use it. So the team asks the next question with the next cheapest test: a golden set before real users, a beta before everyone. That repeat is the <b>build loop</b>: build a little, get feedback, decide the next move. The answer came quickly here: on ${words(N)} different fridges, the same prompt passed the code checks on only ${words(passed("v1"))}.`,
      "Nothing in this feature trains the model. The app sends a prompt and reads the answer; the model does not learn from the fridges it sees. Only the team's changes (prompt, code, checks) make it better.",
      "Nothing so far says the model is the problem. A bigger model costs more on every call, forever. First find out how often the current one fails, and why."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why not ship the demo?</h1>
        <p class="lead">After the meeting, the founder writes: “The plan for Mira's fridge was perfect: ${words(DEMO_N)} good dinners out of ${words(DEMO_N)}. Why don't we switch it on for every user on Monday, and skip the stages?”</p>
        <p class="task">What is the strongest reason to go stage by stage?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Decision point 1: the golden set on the prototype prompt. */
  function decision1({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const fails = failing("v1"), m = missingPlans("v1"), d = dietPlans("v1");
    const opts = [
      "Gather user feedback: open a beta now and let households report what is wrong",
      "Run an A/B test: half of all users get the button, half do not, and compare",
      "Build more: fix these failures, then rerun the same eight fridges",
      "Switch to a bigger model and ship"
    ];
    const fb = [
      `Every one of these failures showed up on your own ${words(N)} fridges, before any user saw them. Beta households would report the same things, more slowly, and the vegan couple would get honey before anyone reported it. Use real users for the questions your own tests cannot answer.`,
      `An A/B test compares versions that work, on real traffic. This one fails ${words(fails.length)} of your ${words(N)} test fridges; half of all users would get plans like these.`,
      `Right. The failures are known and you can reproduce them, so the next step is in the team's own hands: change something, rerun the same ${words(N)} fridges, compare. That rerun is an experiment too, a technical one: it answers a question without any user. The failures are of two kinds:${plural(m, "plan")} with missing food, ${plural(d, "plan")} breaking the household note. Look at the burger plan above: its name says gluten-free, and it uses the bread from the fridge. The two kinds may need different fixes.`,
      "Maybe a bigger model fails less, maybe not. You would only know by rerunning the golden set, so that is the step anyway, and every call would cost more from then on. Read the failures first: they may need a different fix."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Eight fridges, the same prompt</h1>
        <p class="lead">Before any user sees it, the team wrote a <b>golden set</b>: ${words(N)} households with their fridge and note, chosen to include hard cases. A script checks each plan in code. Is every ingredient in the fridge or a staple? Does the dish's name ask for a food that is missing? (It looks for words from its own list: “sandwich” needs bread, “risotto” needs rice.) Does the plan keep the household note? Here is Mira's prompt, unchanged, on all ${words(N)}. The plan column shows how many dinners came back, and how many fridge items were sent to the model.</p>
        ${results("v1", "prototype prompt (v1)")}
        <p class="lead">Two of the failing dinners, as the model wrote them:</p>
        ${planRows([SNIP["v1-h4"], SNIP["v1-h5"]])}
        ${cap()}
        <p class="task">Decision point 1. What should the team do next?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Predict what three prompt rules fix. */
  function predictV2({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const m1 = missingPlans("v1"), d1 = dietPlans("v1"), m2 = missingPlans("v2"), d2 = dietPlans("v2");
    const truth = [m2 === 0 && d2 === 0, m2 === 0 && d2 > 0, m2 > 0 && d2 === 0, m2 === m1 && d2 === d1];
    const RIGHT = truth.indexOf(true);
    const opts = [
      "Every plan: the rules say exactly what to do",
      "The missing-food plans pass; the diet plans still fail",
      "The diet plans pass; the missing-food plans still fail",
      "Nothing changes: a prompt cannot fix this"
    ];
    const real = `In the real rerun, ${m2 ? plural(m2, "plan") : "no plan"} had missing food (${m1} before), and ${plural(d2, "plan")} still broke the household note (${d1} before).`;
    const fb = [
      `${real} Rule 2 says “follow the household note exactly”, and the model still put honey in a vegan dinner.`,
      `Right. ${real} Rule 3 also changed the nearly empty fridge: ${plural(res("v1", "h3").dinners, "dinner")} from ${plural(res("v1", "h3").sent, "item")} became ${plural(res("v2", "h3").dinners, "dinner")}. But a rule in a prompt is a request, not a guarantee: the vegan couple still got honey.`,
      `It went the other way. ${real}`,
      `The prompt did change things. ${real}`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Three rules in the prompt</h1>
        <p class="lead">The team's first fix is the cheapest one: add three rules to Mira's prompt, then rerun the same ${words(N)} fridges.</p>
        <div class="lx-${ID}-prompt">${esc(RULES_V2.join("\n"))}</div>
        <p class="task">Predict: which failing plans will pass after this change?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>
        ${ans === RIGHT ? `${results("v2", "with three rules (v2)")}<p class="lead">The vegan couple's Thursday, and the plan for the nearly empty fridge:</p>${planRows([SNIP["v2-h4"], SNIP["v2-h3"]])}${cap()}` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. v3: hard rules move into code. Decision point 2. */
  function decision2({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const d3 = dietPlans("v3"), m3 = missingPlans("v3");
    const opts = [
      `Build more: keep rewriting the prompt until all ${words(N)} pass, then show users`,
      "Gather user feedback: run the checks inside the app on every plan, label any dinner that needs something missing, and open a small beta",
      "Run an A/B test: half of all users get the button, half do not",
      "Wait: collect a thousand fridge lists for a bigger golden set first"
    ];
    const fb = [
      `The last two reruns show the risk: the prompt rules fixed missing food on these fridges, and the next change brought it back on ${words(m3)}. With ${words(N)} fridges you cannot tell a real fix from luck, and tuning to the last case may only teach you about one fridge. Meanwhile the biggest unknown is untouched: do people want this?`,
      `Right. What could hurt someone (a diet or allergy) is now handled in code twice: forbidden foods are removed before the call, and the diet check runs on every plan after it, so a forbidden food the model invents is caught too. Both only catch foods whose names are on their lists. What is left (${plural(m3, "plan")} with missing food) is annoying, not dangerous, and the same check can run in the app and label it: “you also need: pasta”. It will miss foods outside its word list; the beta's thumbs-down plans show which. The open question is now about people: do they cook from the plans? Only real households can answer that. Their fridges will also be the next cases for the golden set.`,
      `An A/B test needs a version that is ready for everyone (monitoring, a fallback) and a clear metric. You do not even know yet what people do with a plan. Ask a small group first.`,
      "From where? The feature has no users yet. A beta brings real fridge lists, messier than anything you would write; grow the golden set from them."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Move the hard rule into code</h1>
        <p class="lead">Next change: the diet becomes tick boxes in the app (vegan, gluten-free, nut allergy…). Before the call, code removes every fridge item and staple that the ticked diet forbids. The model never sees the honey or the bread. The prompt keeps its three rules. The same ${words(N)} fridges:</p>
        ${results("v3", "diet filtered in code (v3)")}
        <p class="lead">With one item fewer (the peanut butter was removed), the same prompt wrote a different plan for the nut-allergy family. One of its dinners:</p>
        ${planRows([SNIP["v3-h2"]])}
        ${cap()}
        <p class="lead">Plans breaking a diet: ${d3} (it was ${dietPlans("v2")}). Plans with missing food: ${m3} (it was ${missingPlans("v2")}).</p>
        <p class="task">Decision point 2. The team has one week. What next?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The gate into production: what must be in place before everyone gets it. */
  const PROD = [
    ["Alerts on errors, slow answers and plans that fail the checks", true,
      "Yes. With thousands of plans a day nobody reads them all. An alert is how you learn that something changed before users tell you.",
      "Without it, the first sign of a problem is an angry review. You cannot read every plan, so something must watch them for you."],
    [`Every plan in the golden set passes, with no failures left`, false,
      `No. After v3 the team set its bar: no plan breaks a diet, and missing food is caught and labelled in the app. v3, with the label, met it on the first ${words(N)} fridges. A model will still be wrong sometimes; production is about catching that and keeping it harmless, not about a perfect score on ${words(N)} fridges.`,
      `That bar may never be met by a model, and ${words(N)} fridges cannot prove it anyway. What protects users is the label, the logs and the switch.`],
    ["A fallback when the model call fails or takes too long", true,
      "Yes. A hosted model can time out or be down. A fallback (saved recipes that match the fridge) means the button still does something useful.",
      "When everyone has the button, an outage hits everyone. Without a fallback they get an error and an empty screen."],
    ["A model fine-tuned on your own recipes", false,
      "No. A prompt and code checks got the feature here. Fine-tuning is a later fix for a specific measured problem, and it brings its own cost and upkeep.",
      "Nothing the team measured calls for it. Fine-tuning answers a specific problem that prompts and code could not fix; that has not happened here."],
    ["A switch to turn it off, and a rollout that starts with a small share of users", true,
      "Yes. Start small, watch, then widen. If something goes wrong, you switch it off for everyone without a new app release.",
      "Going from the beta to every user in one step means any surprise hits everyone at once, with no quick way back."],
    ["A worked-out cost per active user", true,
      "Yes. Every plan is a paid model call. Before everyone can press the button, you need to know what an active user costs, and whether the price covers it. The next lesson works this out.",
      "Every plan is a paid call, and some users will press the button many times. Without the number, a successful launch can lose money."]
  ];
  function prodGate({ el, done, kit }) {
    ensureStyle();
    const ans = PROD.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Before everyone gets the button</h1>
        <p class="lead">The beta ran for a month. Households cooked from the plans and told the team what they missed, and the team added their fridges to the golden set. Now the question is the last gate: what must be in place before every user gets the button?</p>
        <p class="task">For each item: must it be in place before the full launch?</p>
        ${PROD.map(([q, y, yes, no], i) => `<div class="lcase" id="p${i}"><p>${esc(q)}</p>${kit.options(["Needed", "Not needed"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PROD.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "A script, run once, that asks a model to tag 300 old recipes as quick or slow for an internal report",
      "A “swap an ingredient” button, built on a model, that every user of the app will see",
      "Converting recipe amounts from grams to cups"
    ];
    const fb = [
      "It runs once, for your own team. Prototype it, check a sample of the tags by hand, and stop. There is no user to ask, nothing to monitor and nothing to roll out.",
      "Right. The answers vary, they can be wrong in ways you cannot list in advance, and real people will rely on them. That is the case the whole loop is for.",
      "That is an exact rule. Plain code gets it right every time, at no cost per call, and a unit test proves it. No model, no golden set, no beta."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to run the whole loop</h1>
        <p class="lead"><b>For:</b> turning an idea that needs a model into something people rely on, without betting everything on one demo. <b>Reach for it</b> when the output varies, can be wrong in ways you cannot list in advance, and real users will see it.</p>
        <p class="lead"><b>Not</b> for exact rules: write plain code and tests. Google's Rules of ML open the same way: if machine learning is not absolutely required, do not use it until you have data. Not for a one-off internal job: a prototype and a hand-checked sample are enough. And if nobody wants the feature, talk to users before you build anything.</p>
        <p class="lead"><b>Costs:</b> time at every gate, a golden set to write and keep growing, beta users to find, and monitoring and fallbacks to run for as long as the feature lives.</p>
        <p class="task">Which of these needs all three stages?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise the next move in new situations, including one with no model at all. */
  const MOVES = ["Build more", "Gather user feedback", "Run an A/B test", "No model: plain code"];
  const CASES = [
    ["A support team's reply drafter. On a golden set of past tickets, several drafts quote a refund window the policy does not have. No customer has seen it yet.", 0, [
      "Right. The failure is known and shows up on your own set. Fix it (the prompt, the retrieved policy text, a check in code) and rerun the set.",
      "Customers would only report what your own set already shows, and some would act on a wrong refund promise first. Fix what you can see before asking users.",
      "An A/B test compares versions that work. This one fails your own tests; half your customers would get wrong refund rules.",
      "Writing a reply from a ticket and a policy has no exact rule, so a model fits. The problem is a known failure, and that calls for building more."]],
    ["A receipt-scanning feature in a budgeting app passes its golden set. A beta group of a few dozen households has it. Nobody knows yet whether they keep using it after the first week.", 1, [
      "The checks already pass, so more building answers a question nobody is asking. The open question is about people: do they come back, and if not, why?",
      "Right. Look at who comes back, and talk to a few who stopped. With a few dozen households, why matters more than a percentage.",
      "With a few dozen households, chance would move the numbers more than the version does, and there is only one version. Larger samples are what make a small difference measurable.",
      "Reading a crumpled receipt photo has no exact rule, so a model fits. What is unknown now is whether people keep using it."]],
    ["A recipe site with a large, steady audience. Two ways of writing AI search summaries both pass the evals, and beta users liked both. The team wants to know which one leads to more recipes cooked.", 2, [
      "Both versions already pass. Building more cannot tell you which one makes people cook more.",
      "Asking people tells you what they say they prefer, not what they do. With a large audience you can measure what they do.",
      "Right. Two working versions, a large audience and one clear question: show each version to a random part of the users and compare one metric chosen before the start. A later lesson in this unit runs one.",
      "The summaries are written by a model and already pass. The question left is which version works better for people, and only their behaviour answers it."]],
    ["A sign-up form must check that a postcode has the right format before saving it.", 3, [
      "There is nothing to build more of: the format is an exact rule. Plain code checks it every time, and a unit test proves it.",
      "Users cannot tell you anything a format rule does not already say. Write the rule in code and test it.",
      "There is nothing to compare. An exact rule is either right or wrong, and a unit test tells you which.",
      "Right. An exact rule needs no model: plain code is right every time, costs nothing per call and never fails in a new way. No prototype, golden set or beta."]]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>What is the next move?</h1>
        <p class="lead">Four situations from other teams. Each is at a different point in the loop, and one does not need a model at all.</p>
        <p class="task">Pick the next move for each.</p>
        ${CASES.map(([q, r, f], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(MOVES, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(f[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can run the build loop</h1>
      <p class="lead">You sorted a feature's life into prototype, MVP and production, named the gate out of each, and made the two calls the fridge team made: build more when your own tests show the failure, ask real users when the open question is about people. You also saw a prompt rule fail where a rule in code held, on the same eight fridges.</p>
      <p class="lead"><b>Practice:</b> this lesson was the practice. Next time someone shows you a great demo, ask which question it has not answered yet.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. One gate in this lesson was a known cost per user; next you work it out from tokens, calls and caching.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "From prototype to production: the build loop for an AI feature",
    checked: "2026-11-18",
    sources: [
      "https://www.deeplearning.ai/resources/ai-engineering-skills",
      "https://developers.google.com/machine-learning/guides/rules-of-ml",
      "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests",
      "https://firebase.google.com/docs/ab-testing/ab-concepts",
      "https://firebase.google.com/docs/remote-config/rollouts",
      "https://firebase.google.com/docs/remote-config"
    ],
    interview: [
      {
        q: "Leadership saw a great demo of your AI feature and wants it live for every user next week. What do you say, and what do you do this week?",
        good: [
          "A demo shows it can work on one input; it does not show how often it works or whether people use it",
          "Build a small golden set from real inputs, including hard cases, score it with code checks, and read the failures",
          "Put rules that must never break, such as allergies, in code before or after the call, not only in the prompt",
          "Give it to a small beta behind a switch, with feedback buttons and logging",
          "Before everyone: monitoring and alerts, a fallback, a gradual rollout, and a known cost per user"
        ],
        weak: "Ship it and fix problems as users report them. That turns users into the test set and finds the harmful failures last."
      },
      {
        q: "Your feature passes 6 of 8 golden cases. One PM wants 8 of 8 before any user sees it; another wants an A/B test now. How do you decide what to do next?",
        good: [
          "Look at what the failures are: harmful ones must be blocked, ideally in code; annoying ones can be caught and labelled",
          "Eight cases are easy to overfit: chasing the last one may only fix one input, and a rerun can move failures around",
          "Let the open question pick the move: does it work (build and evaluate), do people use it (beta and talk to users), which of two working versions is better (A/B test)",
          "An A/B test needs versions ready for real traffic, a metric chosen in advance and enough users",
          "Add the failures that real users find to the golden set"
        ],
        weak: "Keep tweaking the prompt until all eight pass, or run the A/B test right away because data beats opinions. Neither looks at what is still unknown."
      }
    ],
    screens: [demo, sortLog, gates, spotIdea, decision1, predictV2, decision2, prodGate, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(LOG.length).fill("[data-right]") },
      { wrong: ["#g0 [data-wrong]"], right: STAGES.map((_, i) => `#g${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#p1 [data-wrong]"], right: PROD.map((_, i) => `#p${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c3 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
