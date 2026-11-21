/* Lesson s5b-faithfulness: "Faithfulness: is the answer backed by the sources?"
   Story: an airport ground crew's assistant answers staff questions about de-icing and baggage from the manuals.
   The manual excerpts are invented for the lesson (a made-up airport), not real regulations.
   Ideas: (1) split an answer into claims and check each claim against the chunks the bot was given:
   faithfulness = supported claims / all claims; (2) faithfulness is not correctness: an answer can be backed by a
   stale chunk and wrong, or unbacked and right by luck. Debug: an eval harness that passed the golden answer to
   the checker as the "sources".
   Data: every bot answer and checker reply below is copied (trimmed with … only) from recordings in
   docs/ai-path/recordings/s5b-faithfulness/ (main checkout), made 2026-11-13 with scripts/ai/record.mjs.
   The scripts that built the requests and replayed them are in docs/ai-path/runs/s5b-faithfulness/:
   manual.py (chunks, questions, golden answers), build_answers.py, checker.py, harness.py (harness.out.txt),
   faith_trace.py (faith_trace.out.txt: the code screen's steps), report.py (report.out.txt),
   build_limits.py (the request for answer-limits-old, added in the review fixes).
   The claim splits and labels on the by-hand screens are the lesson's own marking, not model output.
   Plain browser script. */
(() => {
  const ID = "s5b-faithfulness";
  const P = `lx-${ID}-`;

  /* ---------- data ---------- */
  // From docs/ai-path/runs/s5b-faithfulness/manual.py (written for the lesson)
  const CHUNKS = {
    "DI-4.5": "Type I fluid is sprayed heated, at a nozzle temperature of at least 60 °C. Spray each wing from the leading edge toward the trailing edge, and from the wing tip toward the root.",
    "DI-4.7": "The holdover time starts at the beginning of the final fluid application, not at the end. The crew chief reports the start time to the flight deck.",
    "BG-2.1": "Any checked bag over 23 kg gets a HEAVY tag at check-in.",
    "BG-2.3": "A bag over 32 kg is lifted by two handlers, never one. Bags over 45 kg are refused as checked bags and sent to the cargo desk.",
    "BG-2.3-rev2019": "(Revision 2019, withdrawn) A bag over 40 kg is lifted by two handlers. Bags over 50 kg are sent to the cargo desk.",
    "BG-3.1": "If a lithium battery is found in a checked bag: stop loading that bag, call the duty manager, and keep the bag out of the hold until the passenger has been found."
  };
  const Q_HEAVY = "A passenger's bag weighs 38 kg. Can one handler lift it, and does it need a special tag?";
  const Q_BATTERY = "A loader thinks there is a power bank in a checked bag. What should he do?";
  const GOLD_HEAVY = "No, two handlers. It needs a HEAVY tag (over 23 kg).";
  const GOLD_BATTERY = "Stop loading that bag, call the duty manager, keep the bag out of the hold until the passenger is found.";

  // Recorded bot answers. provider openrouter, model google/gemini-2.5-flash-lite, temperature 0, recorded 2026-11-13.
  // "short" = system prompt asking for short answers; "full" = the prompt that asks for "a complete, helpful answer,
  // including any practical tips a new crew member should know".
  const REC_SPRAY = { src: `${ID}/answer-spray`, provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "Spray Type I fluid heated (at least 60 °C) from the leading edge to the trailing edge, and from the wing tip to the root. The holdover time starts at the beginning of the final fluid application." };
  const REC_HEAVY_FULL = { src: `${ID}/answer-heavy-full`, provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    parts: ["**Can one handler lift it?** No, a bag weighing 38 kg is over the 32 kg limit. According to [BG-2.3], bags over 32 kg must be lifted by **two handlers**, never one.",
      "**Does it need a special tag?** Yes. Since the bag weighs 38 kg, it is over the 23 kg limit, so it will need a **HEAVY tag** at check-in, as per [BG-2.1].",
      "When you see a bag with a HEAVY tag, always be prepared to find a second handler.",
      "Also, be aware that bags over 45 kg are a different situation entirely and need to be rerouted to the cargo desk"] };
  const REC_HEAVY_OLD = { src: `${ID}/answer-heavy-old`, provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "Yes, one handler can lift it. No special tag is needed." };
  const REC_BATTERY_FULL = { src: `${ID}/answer-battery-full`, provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    parts: ["Based on the manual excerpts provided, there is no specific instruction on how to handle a checked bag that is suspected to contain a power bank. The excerpts only cover weight restrictions for checked bags.",
      "**Do NOT attempt to open the bag yourself.**",
      "**Immediately notify your supervisor or shift manager.**",
      "**Quarantining the bag:** The bag will need to be set aside and not loaded onto the aircraft until it's cleared."] };
  const REC_HEAVY = { src: `${ID}/answer-heavy`, provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "No, one handler cannot lift it. It needs a HEAVY tag." };
  // From build_limits.py: same short prompt, chunks BG-2.1 and BG-2.3-rev2019, a question that asks for the weight lines.
  const Q_LIMITS = "Over what weight does a bag need two handlers, and when is it sent to the cargo desk?";
  const GOLD_LIMITS = "Over 32 kg, two handlers. Over 45 kg it is refused as a checked bag and sent to the cargo desk.";
  const REC_LIMITS_OLD = { src: `${ID}/answer-limits-old`, provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "A bag needs two handlers over 40 kg. Bags over 50 kg are sent to the cargo desk." };

  // Screen 1: the short spray answer cut into phrases (joined with spaces they give REC_SPRAY.text exactly).
  const UNITS = ["Spray Type I fluid heated (at least 60 °C)", "from the leading edge to the trailing edge,", "and from the wing tip to the root.", "The holdover time starts", "at the beginning of the final fluid application."];
  const CUTS = [0, 1, 2]; // the gaps (after unit i) that separate claims

  // Labels: S supported, C contradicted, N not in the sources. The lesson's own marking.
  const LABELS = ["Supported", "Contradicted", "Not in the sources"];
  const L = { S: 0, C: 1, N: 2 };
  const ANS_A = { rec: REC_HEAVY_FULL, q: Q_HEAVY, chunks: ["BG-2.1", "BG-2.3"], claims: [
    { t: "A bag over 32 kg must be lifted by two handlers.", l: "S", why: "BG-2.3 says it almost word for word: over 32 kg, two handlers, never one.",
      miss: { C: "Nothing in the sources disagrees. BG-2.3 says over 32 kg is two handlers, never one: the same rule.", N: "Read BG-2.3 again: “A bag over 32 kg is lifted by two handlers, never one.” The claim is right there." } },
    { t: "A 38 kg bag needs a HEAVY tag.", l: "S", why: "BG-2.1 tags every bag over 23 kg, and 38 is over 23. Applying a rule in the sources to the number in the question still counts as supported.",
      miss: { C: "BG-2.1 tags every bag over 23 kg. 38 is over 23, so the sources agree with the claim.", N: "The sources do not say “38 kg” anywhere, but BG-2.1 covers every bag over 23 kg. A claim that follows directly from a rule in the sources is supported." } },
    { t: "Be ready to find a second handler for any bag with a HEAVY tag.", l: "N", why: "HEAVY starts at 23 kg, but two handlers start at 32 kg. The sources say nothing about help for bags between 23 and 32 kg. The tip sounds sensible, and the bot made it up.",
      miss: { S: "Check the numbers. HEAVY tags start at 23 kg (BG-2.1); two handlers start at 32 kg (BG-2.3). For a 25 kg HEAVY bag the sources say nothing about a second handler.", C: "The sources never say a HEAVY bag must be lifted alone, so nothing conflicts with the tip. They just do not say it: HEAVY starts at 23 kg, the two-handler rule at 32 kg." } },
    { t: "Bags over 45 kg go to the cargo desk.", l: "S", why: "The second sentence of BG-2.3.",
      miss: { C: "BG-2.3 agrees: bags over 45 kg are refused as checked bags and sent to the cargo desk.", N: "It is the second sentence of BG-2.3: bags over 45 kg are sent to the cargo desk." } }
  ] };
  const ANS_B = { rec: REC_HEAVY_OLD, q: Q_HEAVY, chunks: ["BG-2.1", "BG-2.3-rev2019"], claims: [
    { t: "One handler can lift a 38 kg bag.", l: "S", alt: "N",
      why: "Accepted. The only weight rule the bot was given is the withdrawn 2019 page: two handlers over 40 kg. The bot read the limit the usual way, “40 kg or less, one handler is fine”, and many people would count that as supported. Strictly, though, the page only talks about bags over 40 kg, so “not in the sources” is accepted too: this claim sits in a grey zone. Either way, faithfulness checks against what the bot was given, even when that page is out of date.",
      altWhy: "Accepted. A limit rule says what happens over the line and nothing about bags below it. The page never says one handler is enough at 38 kg; the bot took that step itself. Many people would still count it as supported, because it reads the limit the usual way: this claim sits in a grey zone. What it is not is contradicted: nothing the bot was given says one handler is too few.",
      miss: { C: "It does contradict the current manual, but the current page (BG-2.3) was not retrieved. The bot only had the 2019 page, which asks for two handlers only over 40 kg. Nothing it was given says one handler is too few at 38 kg." } },
    { t: "A 38 kg bag needs no special tag.", l: "C", why: "BG-2.1 says every bag over 23 kg gets a HEAVY tag. The answer says the opposite of a source it was handed.",
      miss: { S: "BG-2.1 says every bag over 23 kg gets a HEAVY tag. 38 is over 23, so the sources say a tag IS needed.", N: "The sources do talk about this: BG-2.1 tags every bag over 23 kg. They say the opposite of the claim, so it is contradicted, not missing." } }
  ] };
  const ANS_C = { rec: REC_BATTERY_FULL, q: Q_BATTERY, chunks: ["BG-2.1", "BG-2.3"], claims: [
    { t: "The excerpts only cover weight rules for checked bags.", l: "S", why: "Both excerpts are weight rules. A claim about the sources themselves can be checked like any other.",
      miss: { C: "Look at the two excerpts: a HEAVY tag over 23 kg, handlers and cargo by weight. Both are weight rules, so the claim is true of them.", N: "This claim is about the sources themselves, and you can check it: both excerpts are weight rules." } },
    { t: "Do not open the bag yourself.", l: "N", why: "Neither excerpt mentions opening bags.",
      miss: { S: "Which excerpt says it? BG-2.1 and BG-2.3 talk about weight only. The battery rule (BG-3.1) exists in the manual, but it was not retrieved.", C: "Nothing in the excerpts says a loader may open bags either. They are silent on it." } },
    { t: "Notify your supervisor or shift manager at once.", l: "N", why: "The real rule, BG-3.1, says “call the duty manager”, but BG-3.1 was not retrieved. Against the two weight excerpts, this is the bot's own knowledge.",
      miss: { S: "It sounds like BG-3.1 (“call the duty manager”), but BG-3.1 was not among the chunks the bot got. Only the weight rules were. Check against what the bot was given.", C: "The excerpts say nothing about who to call, so nothing conflicts with it." } },
    { t: "Keep the bag off the aircraft until it is cleared.", l: "N", why: "Again close to BG-3.1, which was not retrieved. The weight excerpts do not say it.",
      miss: { S: "The weight excerpts do not say it. The rule it resembles, BG-3.1, was not retrieved.", C: "The weight excerpts say nothing about holding a bag back, so nothing conflicts with it." } }
  ] };
  const scoreOf = a => a.claims.filter(c => c.l === "S").length;
  const okPick = (c, p) => p != null && (p === L[c.l] || (c.alt != null && p === L[c.alt]));

  // The 2x2 screen: each case's faithfulness comes from the lesson's labels; "matches" is the lesson's comparison with the golden answer.
  const HEAVY_SHORT_LABELS = ["S", "S"];      // "one handler cannot lift it" (BG-2.3), "HEAVY tag" (BG-2.1)
  const LIMITS_OLD_LABELS = ["S", "S"];       // two handlers over 40 kg, cargo over 50 kg: both sentences of BG-2.3-rev2019
  const QUAD = ["Fully backed, matches the golden answer", "Fully backed, does not match", "Not fully backed, matches", "Not fully backed, does not match"];
  const CASES2 = [
    { id: "q0", rec: REC_HEAVY, q: Q_HEAVY, gold: GOLD_HEAVY, chunks: ["BG-2.1", "BG-2.3"], labels: HEAVY_SHORT_LABELS, right: 0, cmp: "both say two handlers and a HEAVY tag.",
      fix: "Nothing to fix. This is the corner you want every answer in." },
    { id: "q1", rec: REC_LIMITS_OLD, q: Q_LIMITS, gold: GOLD_LIMITS, chunks: ["BG-2.1", "BG-2.3-rev2019"], labels: LIMITS_OLD_LABELS, right: 1, cmp: "the bot says 40 kg and 50 kg, the golden answer says 32 kg and 45 kg.",
      fix: "Both claims are the 2019 page almost word for word, yet the answer is wrong: the bot faithfully followed a withdrawn page. The model did its job. Fix the data: take the 2019 revision out of the index. A faithfulness score alone would call this answer perfect." },
    { id: "q2", rec: REC_BATTERY_FULL, q: Q_BATTERY, gold: GOLD_BATTERY, chunks: ["BG-2.1", "BG-2.3"], labels: ANS_C.claims.map(c => c.l), right: 2, cmp: "both say: hold the bag back and tell a manager.",
      fix: "Close to the golden answer, but from the model's memory: BG-3.1 was never retrieved. Fix retrieval (the battery rule must come back for “power bank”), and the prompt that asks for tips beyond the excerpts." },
    { id: "q3", rec: REC_HEAVY_OLD, q: Q_HEAVY, gold: GOLD_HEAVY, chunks: ["BG-2.1", "BG-2.3-rev2019"], labels: ANS_B.claims.map(c => c.l), grey: ANS_B.claims.filter(c => c.l === "S" && c.alt === "N").length, right: 3, cmp: "the bot says one handler and no tag, the golden answer says two handlers and a HEAVY tag.",
      fix: "Two problems at once: the stale page (retrieval) and a claim that contradicts BG-2.1 (generation). Fix the index first, then look at why the model ignored the tag rule." }
  ];

  // Code screen: the traced listing and its steps, from docs/ai-path/runs/s5b-faithfulness/faith_trace.out.txt.
  // The checker's replies are the recordings split-heavy-old and verify-heavy-old (openrouter, google/gemini-2.5-flash-lite, 2026-11-13).
  const CODE = [
    "def faithfulness(answer, sources):",
    "    claims = split_claims(answer)",
    "    verdicts = check_claims(claims, sources)",
    "    supported = 0",
    "    for v in verdicts:",
    "        if v[\"label\"] == \"SUPPORTED\":",
    "            supported += 1",
    "    score = supported / len(claims)",
    "    return score"
  ];
  const REC_SPLIT_OLD = { src: `${ID}/split-heavy-old`, provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "{\"claims\": [\"One handler can lift it.\", \"No special tag is needed.\"]}" };
  const REC_VERIFY_OLD = { src: `${ID}/verify-heavy-old`, provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "{\"verdicts\": [{\"claim\": \"One handler can lift it.\", \"label\": \"CONTRADICTED\", \"source\": \"BG-2.3-rev2019\"}, {\"claim\": \"No special tag is needed.\", \"label\": \"CONTRADICTED\", \"source\": \"BG-2.1\"}]}",
    verdicts: [{ claim: "One handler can lift it.", label: "CONTRADICTED", source: "BG-2.3-rev2019" }, { claim: "No special tag is needed.", label: "CONTRADICTED", source: "BG-2.1" }] };
  const CL = ["One handler can lift it.", "No special tag is needed."];
  const VD = REC_VERIFY_OLD.verdicts;
  // [line, vars] for each traced step (event "line", then the final "return")
  const TRACE = [
    [1, {}], [2, { claims: CL }], [3, { claims: CL, verdicts: VD }], [4, { claims: CL, verdicts: VD, supported: 0 }],
    [5, { claims: CL, verdicts: VD, supported: 0, v: VD[0] }], [4, { claims: CL, verdicts: VD, supported: 0, v: VD[0] }],
    [5, { claims: CL, verdicts: VD, supported: 0, v: VD[1] }], [4, { claims: CL, verdicts: VD, supported: 0, v: VD[1] }],
    [7, { claims: CL, verdicts: VD, supported: 0, v: VD[1] }], [8, { claims: CL, verdicts: VD, supported: 0, v: VD[1], score: 0.0 }],
    [8, { claims: CL, verdicts: VD, supported: 0, v: VD[1], score: 0.0, ret: true }]
  ];

  // Broken on purpose: harness.py run_eval_buggy, its output (harness.out.txt) and two recorded verdicts.
  const BUG_CODE = [
    "def run_eval(golden_set, replies):",
    "    report = []",
    "    for case in golden_set:",
    "        reply = replies[case[\"name\"]]",
    "        claims = split_claims(reply[\"answer\"])",
    "        verdicts = check_claims(claims, case[\"reference\"])",
    "        supported = sum(v[\"label\"] == \"SUPPORTED\" for v in verdicts)",
    "        report.append((case[\"name\"], supported, len(claims)))",
    "    return report"
  ];
  const BUG_LINE = 5;
  const BUG_WHY = {
    0: "The signature is fine: the harness gets the golden set and the bot's replies, which is all it needs.",
    1: "An empty list to collect rows. Nothing here touches the scores.",
    2: "Looping over every golden case is what an eval does. The loop is not the problem.",
    3: "<code>reply</code> holds the bot's answer and the chunks it was given. That is the right data. The question is which text goes to the checker later.",
    4: "The claims look clean: “Bags over 32 kg must be lifted by two handlers, never one.” is a fine single claim. Splitting is not the problem; judging is.",
    6: "The count is right: it adds one for each SUPPORTED label. The labels it counts are the wrong ones. Look at where they come from.",
    7: "Saving the name and the two counts is fine. The numbers were already wrong before this line.",
    8: "Returning the report is fine."
  };
  // harness.out.txt: run_eval_buggy and run_eval, [case, supported, claims]
  const OUT_BUGGY = [["spray", 6, 13], ["heavy", 2, 7], ["snow", 3, 10], ["heavy-old", 3, 13], ["battery", 2, 14]];
  const OUT_FIXED = [["spray", 7, 13], ["heavy", 5, 7], ["snow", 8, 10], ["heavy-old", 5, 13], ["battery", 0, 14]];
  // verbatim verdict objects from verifybug-heavy-full and verifybug-battery-full (one each, trimmed from the lists)
  const REC_BUG_V = [
    { src: `${ID}/verifybug-heavy-full`, text: "{\"claim\": \"Bags over 32 kg must be lifted by two handlers, never one.\", \"label\": \"NOT_IN_SOURCES\"}" },
    { src: `${ID}/verifybug-battery-full`, text: "{\"claim\": \"Immediately notify your supervisor or shift manager.\", \"label\": \"SUPPORTED\", \"source\": \"1\"}" }
  ];
  const FIXES = [
    ["<code>check_claims(claims, reply[\"sources\"])</code>: check against the chunks the bot was given", true,
      "Right. Faithfulness asks “did the answer stay inside what the bot was given?”, so the checker must see exactly those chunks. Comparing with the golden answer is a different score, correctness, and it gets its own column."],
    ["Use a stronger model as the checker", false,
      "A stronger checker would still be judging against the golden answer. It would just measure correctness more confidently, under the faithfulness name."],
    ["Pass both: <code>reply[\"sources\"] + case[\"reference\"]</code>", false,
      "Then a claim backed only by the golden answer, like “notify your supervisor”, still counts as supported. Memory that happens to agree with the golden answer would hide again. Keep the two scores apart."]
  ];

  /* ---------- helpers ---------- */
  const fmt2 = x => x.toFixed(2);
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six"];
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}rec { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font-size: 16px; }
.${P}rec .${P}q { font-weight: 600; margin: 0 0 6px; }
.${P}rec .${P}cap { display: block; margin-top: 8px; font: 500 12px var(--mono); color: var(--muted); }
.${P}rec .${P}cut { color: var(--muted); }
.${P}rec .${P}who { font: 600 12px var(--mono); color: var(--muted); margin-bottom: 4px; }
.${P}rec .${P}part { margin: 0; }
.${P}rec .${P}part.${P}cut { margin: 2px 0; }
.${P}src { margin: 12px 0 0; padding: 0; list-style: none; font-size: 15px; }
.${P}src li { padding: 8px 10px; border-left: 3px solid var(--line); background: var(--sunk); margin-top: 6px; }
.${P}src b { font-family: var(--mono); font-size: 13px; margin-right: 6px; }
.${P}src li.${P}old { border-left-style: dashed; }
.${P}split { margin: 14px 0 0; line-height: 2.2; font-size: 17px; }
.${P}split .${P}u { padding: 2px 0; }
.${P}gap { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; min-width: 44px; min-height: 44px; margin: 0 2px; border: 1.5px dashed var(--line); border-radius: 8px; background: var(--bg); color: var(--muted); font: 700 15px var(--mono); cursor: pointer; }
.${P}gap[aria-pressed="true"] { border-style: solid; border-color: var(--ink); color: var(--ink); background: var(--sunk); }
.${P}claims { margin: 10px 0 0; padding-left: 22px; }
.${P}claims li { margin-top: 4px; }
.${P}code { margin: 14px 0 0; background: var(--code-bg); color: var(--code-ink); border-radius: 10px; padding: 8px 0; }
.${P}code button { display: block; width: 100%; min-height: 44px; padding: 6px 12px; border: 0; border-left: 3px solid transparent; background: transparent; color: var(--code-ink); font: 500 13px/1.5 var(--mono); text-align: left; white-space: pre-wrap; word-break: break-word; cursor: pointer; }
.${P}code button:hover { background: color-mix(in srgb, var(--code-ink) 8%, var(--code-bg)); }
.${P}code button.${P}on { border-left-color: var(--code-ink); background: color-mix(in srgb, var(--code-ink) 16%, var(--code-bg)); }
.${P}code button.${P}bad { border-left-color: var(--bad); }
.${P}code button.${P}good { border-left-color: var(--good); }
.${P}tbl { width: 100%; margin-top: 14px; border-collapse: collapse; font-size: 15px; }
.${P}tbl th, .${P}tbl td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
.${P}tbl th { font: 600 12px var(--mono); color: var(--muted); }
.${P}tbl td.n { font-family: var(--mono); }
.${P}json { margin: 8px 0 0; padding: 8px 10px; background: var(--sunk); border-radius: 8px; font: 500 13px/1.5 var(--mono); white-space: pre-wrap; word-break: break-word; }
.${P}score { margin-top: 12px; font-size: 16px; }
.${P}score b { font-family: var(--mono); }
`;
    document.head.appendChild(s);
  }
  // escape, then render the recording's **bold** as <b>; no other change to the text
  const md = (kit, s) => kit.esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const recBox = (kit, rec, q, who) => `<div class="${P}rec">${q ? `<p class="${P}q">Question: ${kit.esc(q)}</p>` : ""}${who ? `<div class="${P}who">${who}</div>` : ""}<div>${rec.parts
    ? rec.parts.map(p => `<p class="${P}part">${md(kit, p)}</p>`).join(`<p class="${P}part ${P}cut">…</p>`) : md(kit, rec.text)}</div><span class="${P}cap">Recorded model output, ${rec.recordedAt}${rec.parts ? ", trimmed" : ""}</span></div>`;
  const srcList = (kit, ids, title = "Chunks the bot was given") => `<p class="lead" style="margin-top:12px"><b>${title}</b></p><ul class="${P}src">${ids.map(i => `<li class="${i.includes("rev") ? P + "old" : ""}"><b>${kit.esc(i)}</b>${kit.esc(CHUNKS[i])}</li>`).join("")}</ul>`;

  /* ---------- 1. Situation + split one answer into claims ---------- */
  function splitScreen({ el, done, kit }) {
    style();
    const on = new Set();
    let checked = null; // null, or { ok, msgs }
    const paint = () => {
      const fin = checked && checked.ok;
      el.innerHTML = `<h1>The bot answers. Is it the manual talking?</h1>
        <p class="lead">An airport's ground crew asks a chat assistant about de-icing and baggage. It looks up chunks of the ground-handling manual and writes an answer from them: the RAG setup you built earlier. The operations lead (the ops lead) has one worry. Out by the planes nobody re-reads the manual, so a rule the bot <b>makes up</b> gets followed. This lesson builds the check for that worry: one more score in the eval you started with golden sets and retrieval metrics. (The manual in this lesson is invented for the lesson.)</p>
        <p class="lead">To check an answer against the manual, first cut it into <b>claims</b>: pieces that can each be true or false on their own.</p>
        <p class="task">Tap the gaps where one claim ends and the next begins, then press Check.</p>
        <div class="${P}rec"><p class="${P}q">Question: How do I spray Type I fluid on the wings, and when does the holdover time start?</p>
          <div class="${P}split">${UNITS.map((u, i) => `<span class="${P}u">${kit.esc(u)}</span>${i < UNITS.length - 1 ? ` <button type="button" class="${P}gap" data-gap="${i}" aria-pressed="${on.has(i)}" aria-label="cut after: ${kit.esc(u)}" ${fin ? "disabled" : ""}>|</button> ` : ""}`).join("")}</div>
          <span class="${P}cap">Recorded model output, ${REC_SPRAY.recordedAt}</span></div>
        <div class="lpanel">
          ${fin ? "" : `<div class="lopts"><button type="button" data-check>Check my cuts</button></div>`}
          ${checked ? kit.feedback(checked.ok
            ? `Right: ${WORDS[CUTS.length + 1]} claims. <ol class="${P}claims"><li>Type I fluid is sprayed heated, at least 60 °C.</li><li>Spray from the leading edge to the trailing edge.</li><li>Spray from the wing tip to the root.</li><li>Holdover starts at the beginning of the final application.</li></ol>Two sentences, but ${WORDS[CUTS.length + 1]} facts. Each one can be wrong while the others are right, so each one gets its own check. This is the first step of a faithfulness check.`
            : checked.msgs.join(" "), checked.ok) : ""}
        </div>`;
      el.querySelectorAll("[data-gap]").forEach(b => b.onclick = () => { const i = +b.dataset.gap; on.has(i) ? on.delete(i) : on.add(i); checked = null; paint(); });
      const c = el.querySelector("[data-check]");
      if (c) c.onclick = () => {
        const msgs = [];
        if (!on.has(0)) msgs.push("The temperature (“heated, at least 60 °C”) and the spray direction can be wrong separately. The bot could get one right and the other wrong, so cut between them.");
        if (!on.has(1)) msgs.push("“Leading edge to trailing edge” and “tip to root” are two different directions. A manual could keep one and reverse the other, so they are two claims.");
        if (!on.has(2)) msgs.push("The spray part and the holdover part are about different things. One can be right while the other is wrong.");
        if (on.has(3)) msgs.push("“The holdover time starts” cannot be true or false on its own: starts when? A claim needs the whole fact, so do not cut there.");
        checked = { ok: msgs.length === 0, msgs };
        paint();
        if (checked.ok) done();
      };
    };
    paint();
  }

  /* ---------- 2-4. Mark each claim of a recorded answer ---------- */
  function markScreen(ans, title, lead) {
    return function ({ el, done, kit }) {
      style();
      const picks = ans.claims.map(() => null);
      const total = ans.claims.length;
      const paint = () => {
        const all = ans.claims.every((c, i) => okPick(c, picks[i]));
        const sup = picks.filter(p => p === L.S).length;
        el.innerHTML = `<h1>${title}</h1>
          <p class="lead">${lead}</p>
          ${recBox(kit, ans.rec, ans.q, "A small hosted model answered:")}
          ${srcList(kit, ans.chunks)}
          <p class="task">Mark each claim against these chunks only, not against what you know or what the full manual says.</p>
          ${ans.claims.map((c, i) => {
            const p = picks[i], ok = okPick(c, p);
            const key = Object.keys(L).find(k => L[k] === p);
            const alt = ok && c.alt != null && p === L[c.alt];
            return `<div class="lcase" id="c${i}"><p>${kit.esc(c.t)}</p>${kit.options(LABELS, { picked: p, correct: alt ? p : L[c.l] })}${p == null ? "" : kit.feedback(ok ? (alt ? c.altWhy : c.why) : c.miss[key], ok)}</div>`;
          }).join("")}
          ${all ? `<div class="${P}score">Faithfulness = supported claims / all claims = <b>${sup} / ${total} = ${fmt2(sup / total)}</b> (your marks)</div>` : ""}`;
        el.querySelectorAll(".lcase").forEach((box, i) => box.querySelectorAll("button").forEach(b => b.onclick = () => {
          picks[i] = +b.dataset.i; paint();
          if (ans.claims.every((c, j) => okPick(c, picks[j]))) done();
        }));
      };
      paint();
    };
  }
  const markA = markScreen(ANS_A, "Mark the claims: a baggage answer",
    "The bot runs with a system prompt that asks for “a complete, helpful answer, including any practical tips”. Here is part of one answer, already cut into claims for you. Each claim is <b>supported</b> (a chunk says it, or it follows directly), <b>contradicted</b> (a chunk says otherwise) or <b>not in the sources</b>.");
  const markB = markScreen(ANS_B, "Same question, different chunks",
    "Same question, asked with a prompt for short answers. This time the search brought back an old page of the manual, withdrawn in 2019 and no longer valid, instead of the current one.");
  const markC = markScreen(ANS_C, "A question the chunks cannot answer",
    "The manual does have a battery rule (BG-3.1), but the search did not bring it back for “power bank”. The bot got only the two weight rules.");

  /* ---------- 5. Spot the idea: faithful is not correct ---------- */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const sup = scoreOf(ANS_C), n = ANS_C.claims.length;
    const opts = [
      "The checker is too strict. It should also accept claims that are true, even if no chunk says them.",
      "The answer is right by luck. The bot used its own memory because the battery rule was never retrieved. Its memory will not always be right, and nobody can trace it to the manual. Score backed-by-sources and right-or-wrong separately.",
      "The answer is long, and long answers score lower. Ask the bot for shorter answers."
    ];
    const correct = 1;
    const fbs = {
      0: `Then the score needs to know what is true, and the only place that knowledge lives is a golden answer. You would be measuring correctness under another name. It would also pass a made-up rule that happens to sound right, which is the exact thing the ops lead fears.`,
      2: `Length is not in the formula. Answer A had ${ANS_A.claims.length} claims and scored ${fmt2(scoreOf(ANS_A) / ANS_A.claims.length)}; a long answer whose every claim is supported scores 1.00. The battery answer scores low because its claims came from somewhere other than the chunks.`
    };
    const paint = () => {
      el.innerHTML = `<h1>“But the answer is fine”</h1>
        <p class="lead">The ops lead keeps a <b>golden set</b>: real questions with the answer he wrote himself. For the power bank question he wrote: <i>“${kit.esc(GOLD_BATTERY)}”</i></p>
        <p class="lead">He reads the bot's battery answer and says it is close enough to his. Your marks gave it <b>${sup} / ${n} = ${fmt2(sup / n)}</b>.</p>
        <p class="task">He asks: “If the answer is fine, why is your score so low?” What do you tell him?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. This is the core idea of the lesson. Two different questions:<br><b>Faithfulness</b>: is every claim backed by the chunks the bot was given? It needs only the answer and the chunks.<br><b>Correctness</b>: does the answer match the golden answer? It needs a golden answer written by a person.<br>The battery answer is fairly correct and not faithful. Next time the model's memory could invent a rule that sounds just as calm, and a faithfulness check is how you catch it without a golden answer.`, true)
          : kit.feedback(fbs[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 6. Use it: place four recorded answers on the two scores ---------- */
  function quadrants({ el, done, kit }) {
    style();
    const picks = CASES2.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Two scores, four corners</h1>
        <p class="lead">Each answer gets two marks. First: is it <b>fully backed</b> by its chunks (faithfulness 1.00) or not (lower)? Second: does it <b>match</b> the golden answer? The corner tells you which part of the RAG pipeline to fix.</p>
        ${srcList(kit, ["BG-2.1", "BG-2.3", "BG-2.3-rev2019"], "The baggage chunks used below")}
        <p class="task">For each recorded answer, mark its claims in your head, then pick its corner.</p>
        ${CASES2.map((c, i) => {
          const sup = c.labels.filter(x => x === "S").length, tot = c.labels.length, p = picks[i], ok = p === c.right;
          const sc = `${sup} / ${tot} = ${fmt2(sup / tot)}${c.grey ? ` (or ${sup - c.grey} / ${tot} = ${fmt2((sup - c.grey) / tot)} if you marked the one-handler claim not in the sources)` : ""}`;
          return `<div class="lcase" id="${c.id}">
            ${recBox(kit, c.rec, c.q, "The bot:")}
            <p style="font-weight:400;margin-top:8px">Chunks: ${c.chunks.map(kit.esc).join(", ")}. Golden answer: <i>${kit.esc(c.gold)}</i></p>
            ${kit.options(QUAD, { picked: p, correct: c.right })}
            ${p == null ? "" : kit.feedback(ok
              ? `Faithfulness ${sc} (from your marking rules). ${c.fix}`
              : `Not that corner. Faithfulness is ${sc}, so it is ${sup === tot ? "" : "not "}fully backed. Then compare it with the golden answer: ${c.cmp}`, ok)}
          </div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((box, i) => box.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picks[i] = +b.dataset.i; paint();
        if (CASES2.every((c, j) => picks[j] === c.right)) done();
      }));
    };
    paint();
  }

  /* ---------- 7. The checker in code, replayed from recordings ---------- */
  function codeScreen({ el, done, kit }) {
    style();
    let i = 0, ans = null;
    const SAY = [
      "The answer from screen 3: “Yes, one handler can lift it. No special tag is needed.” First call: a model splits it into claims.",
      `The splitter returned ${CL.length} claims, the same split you used. Second call: a model labels each claim using only the chunks.`,
      "The checker labelled both claims CONTRADICTED. Look at the first: the only page the bot had asks for two handlers over 40 kg, and nothing on it says one handler is too few at 38 kg. Keep that in mind.",
      "Start counting.",
      "First verdict: CONTRADICTED, so no count.",
      "Back to the loop for the next verdict.",
      "Second verdict: CONTRADICTED, so no count.",
      "No more verdicts. The loop ends.",
      `Divide: ${0} supported out of ${CL.length} claims.`,
      "score is 0.0. Return it.",
      `The function returned 0.0. By hand you got ${scoreOf(ANS_B)} / ${ANS_B.claims.length} = ${fmt2(scoreOf(ANS_B) / ANS_B.claims.length)}, or ${scoreOf(ANS_B) - 1} / ${ANS_B.claims.length} = ${fmt2((scoreOf(ANS_B) - 1) / ANS_B.claims.length)} if you read the 2019 page strictly. Either way, the checker said CONTRADICTED for the one-handler claim, but nothing on the page says one handler is too few. (Run on the long answer, the same checker called that claim “not in the sources”.)`
    ];
    const opts = ["Trust it: it was told to use only the sources", "Mark a sample of answers by hand and measure how often the checker agrees with you", "Run it again: the second run will fix the mistake"];
    const correct = 1;
    const fbs = {
      0: "It was told to use only the sources and still called a claim contradicted that its page never contradicts, as you just saw. An instruction is not a guarantee. You only know how far to trust it by comparing it with careful human labels.",
      2: "These calls ran at temperature 0, and a rerun is not a check. You need something to compare against: your own labels on a sample."
    };
    const paint = () => {
      const [ln, vars] = TRACE[i], last = i === TRACE.length - 1;
      const vtxt = [
        ["claims", vars.claims ? `${vars.claims.length} claims` : "–"],
        ["verdicts", vars.verdicts ? vars.verdicts.map(v => v.label).join(", ") : "–"],
        ["v", vars.v ? vars.v.label : "–"],
        ["supported", vars.supported != null ? vars.supported : "–"],
        ["score", vars.score != null ? vars.score.toFixed(1) : "–"]
      ];
      el.innerHTML = `<h1>The same check, as code</h1>
        <p class="lead">In the eval harness the two steps you did by hand become two model calls: <code>split_claims</code> asks a model for the list of claims, <code>check_claims</code> asks a model to label each claim against the chunks. Then plain Python counts.</p>
        <p class="lead">This is the definition that Ragas, an open-source eval library, documents for its faithfulness metric: supported claims divided by all claims, from 0 to 1. Step two can also be a small trained classifier instead of a chat model.</p>
        <p class="task">Step through a recorded run to the end, then answer the question under it.</p>
        ${kit.code(CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${vtxt.map(([k, v]) => `<span>${k} <b>${kit.esc(v)}</b></span>`).join("")}<span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(SAY[Math.min(i, SAY.length - 1)])}
        ${i >= 2 ? `<pre class="${P}json">${kit.esc(REC_VERIFY_OLD.text)}</pre><span class="${P}cap" style="font:500 12px var(--mono);color:var(--muted)">Recorded model output, ${REC_VERIFY_OLD.recordedAt} (the checker's reply)</span>` : ""}
        ${last ? `<div class="lcase" id="cq"><p>The checker is a model too, and here it disagreed with you. Before you let it score 500 answers every night, what do you do?</p>${kit.options(opts, { picked: ans, correct })}${ans == null ? "" : kit.feedback(ans === correct ? "Right. Label a few dozen claims yourself, run the checker on the same ones, and count where it agrees. Where it disagrees, read why: here it called a claim contradicted when the page was only silent. The next lesson is about exactly this: how far to trust a model that judges." : fbs[ans], ans === correct)}</div>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); };
      el.querySelectorAll("#cq button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 8. Broken on purpose: the harness feeds the wrong text to the checker ---------- */
  function broken({ el, done, kit }) {
    style();
    let line = null, fix = null;
    const paint = () => {
      const found = line === BUG_LINE, fixed = found && fix != null && FIXES[fix][1];
      el.innerHTML = `<h1>Broken on purpose: a report that makes no sense</h1>
        <p class="lead">A teammate added the checker to the nightly eval. It runs over five golden cases, each with the bot's long, tips-included answer. Here is the real report it printed:</p>
        <table class="${P}tbl"><thead><tr><th>case</th><th>supported / claims</th><th>faithfulness</th></tr></thead><tbody>
          ${OUT_BUGGY.map(([n, s, t]) => `<tr><td>${kit.esc(n)}</td><td class="n">${s} / ${t}</td><td class="n">${fmt2(s / t)}</td></tr>`).join("")}</tbody></table>
        <p class="lead" style="margin-top:12px">Two of the checker's verdicts, copied from its replies:</p>
        <pre class="${P}json">${REC_BUG_V.map(v => kit.esc(v.text)).join("\n")}</pre>
        <span style="font:500 12px var(--mono);color:var(--muted)">Recorded model output, 2026-11-13 (trimmed to one verdict each)</span>
        <p class="lead" style="margin-top:12px">In the harness, each <code>case</code> is a golden-set row: a name, the question and the ops lead's golden answer in <code>reference</code>. Each <code>reply</code> holds the bot's answer and, in <code>sources</code>, the chunks it was given.</p>
        <p class="lead" style="margin-top:12px">The first claim is BG-2.3 almost word for word, and BG-2.3 was in the heavy case's chunks. The second says “supported”, yet the battery case only had weight rules, and its source is “1”, not a chunk id.</p>
        <p class="task">${found ? "Now pick the fix." : "Tap the line of the harness that causes this."}</p>
        <div class="${P}code">${BUG_CODE.map((c, j) => { const n = c.length - c.trimStart().length; return `<button type="button" data-i="${j}" class="${j === line ? (found ? P + "good" : P + "bad") : ""}" style="padding-left:calc(12px + ${n + 4}ch);text-indent:-4ch" ${found ? "disabled" : ""}>${kit.esc(c.trimStart())}</button>`; }).join("")}</div>
        <div class="lpanel">
          ${line == null ? "" : found
            ? kit.feedback(`That is it. <code>case["reference"]</code> is the golden answer the ops lead wrote, not the chunks the bot was given. So the checker labelled each claim against the golden answer: “notify your supervisor” matched it, and the BG-2.3 rule did not, because his short answer never mentions the 32 kg line. The column says faithfulness, but it measures something close to correctness.`, true)
            : kit.feedback(BUG_WHY[line], false)}
          ${found ? `<div id="fx">${kit.options(FIXES.map(f => f[0]), { picked: fix, correct: 0 })}${fix == null ? "" : kit.feedback(FIXES[fix][2], FIXES[fix][1])}</div>` : ""}
          ${fixed ? `<table class="${P}tbl"><thead><tr><th>case</th><th>before the fix</th><th>after the fix</th></tr></thead><tbody>
            ${OUT_FIXED.map(([n, s, t], k) => `<tr><td>${kit.esc(n)}</td><td class="n">${fmt2(OUT_BUGGY[k][1] / OUT_BUGGY[k][2])}</td><td class="n">${fmt2(s / t)}</td></tr>`).join("")}</tbody></table>
            ${kit.feedback(`The same recorded answers, checked against their own chunks. Battery drops to ${fmt2(OUT_FIXED[4][1] / OUT_FIXED[4][2])}: the checker found no claim backed by its chunks. It even marked “The excerpts only cover weight restrictions for checked bags.” not in the sources, which you marked supported on screen 4: another checker disagreement. Heavy rises to ${fmt2(OUT_FIXED[1][1] / OUT_FIXED[1][2])}: the rules it quoted were in its chunks all along.`)}` : ""}
        </div>`;
      el.querySelectorAll(`.${P}code button`).forEach(b => b.onclick = () => { line = +b.dataset.i; fix = null; paint(); });
      el.querySelectorAll("#fx button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (FIXES[fix][1]) done(); });
    };
    paint();
  }

  /* ---------- 9. The big picture ---------- */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "The bot adds a tip to pause spraying if the nozzle temperature drops below 60 °C, which no chunk says.",
      "The bot quotes the holdover chunk (DI-4.7) correctly but leaves out its second step: the crew chief reports the start time to the flight deck.",
      "The bot faithfully quotes the withdrawn 2019 baggage page."
    ];
    const correct = 0;
    const fbs = {
      1: "Every claim it made is backed, so faithfulness stays at 1.00. A missing step is not a claim at all. Completeness shows up when you compare with the golden answer (correctness), or in retrieval metrics if the chunk never came back.",
      2: "Every claim is backed by the chunk it was given, so faithfulness is high. A stale or wrong chunk is a retrieval and data problem: fix the index, and catch it with correctness against the golden set."
    };
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <p class="lead"><b>What it is for:</b> RAG answers that must come from your documents (manuals, policies, contracts), where a made-up rule is costly.</p>
        <p class="lead"><b>When:</b> in the eval harness, every time the prompt, model, chunking or index changes; on a sample of live answers.</p>
        <p class="lead"><b>When not:</b> there are no sources to check against (writing slogans, small talk) or the answer comes from a calculation or a tool. A faithfulness score also cannot see a missing step or a stale chunk: use correctness against a golden set and retrieval metrics for those.</p>
        <p class="lead"><b>What it costs:</b> extra model calls for every answer checked (two in this harness), so money and time on every eval run; a checker that makes its own mistakes, so you keep hand labels to test it.</p>
        <p class="task">Which of these would a faithfulness score catch?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct ? kit.feedback("Right. It is a claim with no chunk behind it: NOT_IN_SOURCES. The recorded spray answer really contained this tip, and the checker flagged it. The other two answers keep faithfulness high, which is why it is one score among several, not the whole eval.", true) : kit.feedback(fbs[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 10. Recognise it ---------- */
  const REC_CASES = [
    ["An HR assistant answers leave questions from the staff handbook. Legal wants proof that it never states a rule the handbook does not contain.", true,
      "Yes. That is faithfulness exactly: split each answer into claims and check every claim against the handbook chunks it was given.",
      "Legal's demand is “nothing beyond the handbook”, which is a claim-by-claim check against the chunks. That is what faithfulness measures."],
    ["A team's support bot gives answers with links to the help pages it used. Users report that some links point to pages that do not say what the answer says.", true,
      "Yes. Check each claim against the page it cites. A claim the cited page does not back is unfaithful, even if the claim is true.",
      "Each claim can be checked against the page it links to. That is a faithfulness check with the cited page as the source."],
    ["A marketing team asks a model for ten slogans for a new running shoe. They want to measure which prompt gives better slogans.", false,
      "Right, no. There are no sources the slogans should stay inside, so “backed by the sources” has nothing to measure. Better slogans is a matter of taste and brand rules: people rating pairs, or a judge with a rubric.",
      "Faithfulness needs sources the answer should stay inside. Slogans have none: they are meant to be new. Compare prompts with people's ratings or a rubric-based judge instead."],
    ["A policy bot's answers score 1.00 faithfulness on every test case, but staff say it often leaves out the one rule that matters most.", false,
      "Right, no. A rule left out is not a claim, so faithfulness cannot see it. Check retrieval (did the chunk with that rule come back?) and correctness against golden answers that include the rule.",
      "A faithfulness check can only judge the claims that are there. An answer that leaves out the key rule can be fully backed. Look at retrieval recall and correctness against the golden set instead."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = REC_CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a faithfulness check help?</h1>
        <p class="lead">Four situations away from the airport.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${REC_CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (REC_CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* ---------- 11. What next ---------- */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">You can cut an answer into claims, mark each one supported, contradicted or not in the sources, and score faithfulness as supported claims over all claims. You can tell faithfulness from correctness, and read the four corners as “fix retrieval” or “fix generation”. And you know to pass the checker the chunks the bot was given, never the golden answer.</p>
      <p class="lead">This lesson was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Your checker was a model judging text, and it got a label wrong. The next lesson measures how far to trust such a judge, and how to correct its biases.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Faithfulness: is the answer backed by the sources?",
    checked: "2026-11-13",
    sources: [
      "https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/",
      "https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/answer_correctness/",
      "https://arxiv.org/abs/2305.14251"
    ],
    interview: [{
      q: "Your team reports faithfulness 0.95 for the RAG assistant, yet staff found answers that were plainly wrong. How can both be true, and what do you add to the eval?",
      good: ["Faithfulness only says the claims are backed by the retrieved chunks; a stale or wrong chunk gives a faithful wrong answer",
        "Add correctness against a golden set and retrieval metrics, and report them as separate columns",
        "Look at the failing cases by corner: backed but wrong points at retrieval or the index, unbacked points at generation",
        "Check the harness passes the checker the bot's own chunks, and test the checker against hand labels"],
      weak: "Say the metric is broken and switch to a bigger model, without asking what faithfulness measures or looking at which chunks were retrieved."
    }, {
      q: "A product manager wants every live answer checked for faithfulness before it is shown to the user. What do you say?",
      good: ["It adds model calls to every reply, so latency and cost go up; say what that means for this product",
        "Often enough: run it offline on the golden set for every change, and on a sample of live traffic",
        "If the risk is high, a cheaper check (a small classifier for the verify step) or blocking only answers with unsupported claims can be worth it",
        "The checker makes mistakes too, so measure its agreement with human labels before it blocks anything"],
      weak: "Yes, check everything, more checking is always safer; or no, it is too slow, without weighing the risk of a made-up rule against the cost."
    }],
    screens: [splitScreen, markA, markB, markC, spotIdea, quadrants, codeScreen, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-check]"], right: ['[data-gap="0"]', '[data-gap="1"]', '[data-gap="2"]', "[data-check]"] },
      { wrong: ["#c0 [data-wrong]"], right: ANS_A.claims.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: ANS_B.claims.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: ANS_C.claims.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: CASES2.map(c => `#${c.id} [data-right]`) },
      { wrong: [...Array(TRACE.length - 1).fill("[data-next]"), "#cq [data-wrong]"], right: ["#cq [data-right]"] },
      { wrong: ['[data-i="4"]'], right: [`[data-i="${BUG_LINE}"]`, "#fx [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: REC_CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
