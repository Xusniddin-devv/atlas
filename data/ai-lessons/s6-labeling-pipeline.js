/* Lesson s6-labeling-pipeline: labeling data and checking label agreement.
   Story: Larkspur Air (a made-up airline) wants to sort complaint emails into four categories and grade a sorting
   bot against labeled emails, but its two support leads keep filing the same email differently.
   Ideas: (1) raw agreement between two labelers includes agreement that would happen by chance; Cohen's kappa
   measures agreement above chance, (po - pe) / (1 - pe), from scratch and with scikit-learn; (2) disagreements
   cluster on a pair of categories, and the fix is a guideline rule for the emails that fit both, then re-label
   and measure again. Label Studio is the labeling tool: run on this Mac (open-source edition), project made with
   the config shown, the 20 emails imported, each lead's labels submitted as that lead's user, JSON exported.
   Data:
   - The 20 emails, the guidelines and the desk lines: docs/ai-path/runs/s6-labeling-pipeline/make_requests.mjs.
     The emails were written for the lesson; no real customer wrote them.
   - The two leads are stand-ins: ONE model (openrouter, google/gemini-2.5-flash-lite, temperature 0), the same
     guideline, told once that it leads the flight disruption desk (lead A) and once the payments desk (lead B).
     Recordings (docs/ai-path/recordings/s6-labeling-pipeline/, main checkout): n1-a, n1-b = guideline 1 (the four
     names); n2-a, n2-b = guideline 2 (the names plus one rule). Copied in full into REC below.
     Exploratory recordings kept in the same folder, not shown: v1-lead-a..d (four different models, no desk
     line, a guideline with one-line descriptions, draft emails), v1-desk-*, v0-desk-*, g1-* (desk lines,
     other guideline wordings). With a one-line description per category, the two desks agreed on all 20 final
     emails (g1-*); with no desk line, four different models agreed on 17 to 20 draft emails. That is why the
     lesson uses the four-name guideline and the desk lines: real leads bring their desk's habits.
   - The run: docs/ai-path/runs/s6-labeling-pipeline/kappa.py, output kappa.out.txt (the trace in TRACE, the
     scikit-learn result in SK, the made-up "urgent" contrast), env.txt.
   - Label Studio: docs/ai-path/runs/s6-labeling-pipeline/label-studio/ (config.xml, add_lead_b.py,
     run_label_studio.py, its output run_label_studio.out.txt and the real export.json; LS_EXPORT below is task 5 of
     that export, trimmed).
   Every count, share and score on screen is computed here from EMAILS, REC and URGENT.
   Lesson-local CSS: email cards, label rows, guideline sheet, label buttons, inline row feedback
   (prefix lx-s6-labeling-pipeline-).
   Plain browser script. */
(() => {
  const P = "lx-s6-labeling-pipeline-";
  const REC_DATE = "2026-11-13";

  // Written for the lesson (make_requests.mjs, EMAILS), sent to both leads as "1. ...", "2. ...".
  const EMAILS = [
    "My suitcase never arrived in Lisbon. It has my work clothes in it. Please find it.",
    "Flight 212 was cancelled two hours before departure. I want the ticket price back.",
    "I booked under the name Jon but my passport says John. Please fix the name on the ticket.",
    "We sat on the plane for three hours before take-off and nobody told us anything.",
    "The flight was four hours late. I am owed compensation for that, please pay it.",
    "My bag came back with a broken wheel. I want the cost of a new suitcase.",
    "Can I move my trip from 3 May to 10 May? My meeting was moved.",
    "Our flight was cancelled and we had to pay for a hotel. Please send us the hotel cost.",
    "The first flight was late, I missed my connection and slept at the airport.",
    "I was charged twice for the same ticket. Please return one of the payments.",
    "The delay made me miss my cruise. Please book me on a flight to the next port.",
    "Delayed again, the third time this month on the same route. This is unacceptable.",
    "My child's stroller was left in Frankfurt. When will it arrive?",
    "The flight was cancelled and nobody emailed me. I found out at the airport.",
    "We waited six hours at the gate and bought dinner there. I want the meal cost back.",
    "I need to add my baby to my booking for the flight on Friday.",
    "The flight left 40 minutes late, so I missed the start of my sister's wedding. Very disappointed.",
    "After the cancellation I bought a ticket on another airline. Refund my unused ticket.",
    "Your plane was delayed overnight and the hotel you gave us was dirty.",
    "I cancelled my booking within 24 hours of making it. Where is my money?"
  ];
  const CATS = ["Baggage", "Delay or cancellation", "Refund", "Booking change"];
  const SHORT = { "Baggage": "Baggage", "Delay or cancellation": "Delay", "Refund": "Refund", "Booking change": "Change" };
  // From make_requests.mjs: the desk lines and the guidelines (system prompt, before the answer-format line).
  const DESK = {
    a: "You are the lead of the flight disruption desk, which handles delays and cancellations.",
    b: "You are the lead of the payments desk, which handles refunds and charges."
  };
  const GUIDE1 = "You sort complaint emails for an airline's support team. Put each email in exactly one of these categories: Baggage, Delay or cancellation, Refund, Booking change.";
  const RULE = "When an email fits more than one category, file it by what the customer asks us to do: money back goes to Refund; a new date, flight, name or seat goes to Booking change; finding or repairing a bag goes to Baggage. Use Delay or cancellation only when the customer reports a late or cancelled flight and asks for nothing else.";

  // From docs/ai-path/recordings/s6-labeling-pipeline/<n1|n2>-<a|b>.json (full text, not altered).
  const REC = {
    src: "s6-labeling-pipeline/<n1|n2>-<a|b>", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
    n1a: "1: Baggage\n2: Refund\n3: Booking change\n4: Delay or cancellation\n5: Delay or cancellation\n6: Baggage\n7: Booking change\n8: Refund\n9: Delay or cancellation\n10: Refund\n11: Booking change\n12: Delay or cancellation\n13: Baggage\n14: Delay or cancellation\n15: Delay or cancellation\n16: Booking change\n17: Delay or cancellation\n18: Refund\n19: Delay or cancellation\n20: Refund",
    n1b: "1: Baggage\n2: Refund\n3: Booking change\n4: Delay or cancellation\n5: Refund\n6: Baggage\n7: Booking change\n8: Refund\n9: Delay or cancellation\n10: Refund\n11: Booking change\n12: Delay or cancellation\n13: Baggage\n14: Delay or cancellation\n15: Refund\n16: Booking change\n17: Delay or cancellation\n18: Refund\n19: Delay or cancellation\n20: Refund",
    n2a: "1: Baggage\n2: Refund\n3: Booking change\n4: Delay or cancellation\n5: Refund\n6: Baggage\n7: Booking change\n8: Refund\n9: Delay or cancellation\n10: Refund\n11: Booking change\n12: Delay or cancellation\n13: Baggage\n14: Delay or cancellation\n15: Refund\n16: Booking change\n17: Delay or cancellation\n18: Refund\n19: Delay or cancellation\n20: Refund",
    n2b: "1: Baggage\n2: Refund\n3: Booking change\n4: Delay or cancellation\n5: Refund\n6: Baggage\n7: Booking change\n8: Refund\n9: Delay or cancellation\n10: Refund\n11: Booking change\n12: Delay or cancellation\n13: Baggage\n14: Delay or cancellation\n15: Refund\n16: Booking change\n17: Delay or cancellation\n18: Refund\n19: Delay or cancellation\n20: Refund"
  };
  const parse = t => t.split("\n").filter(l => l.trim()).map(l => l.slice(l.indexOf(":") + 1).trim());
  const A1 = parse(REC.n1a), B1 = parse(REC.n1b), A2 = parse(REC.n2a), B2 = parse(REC.n2b);
  const N = EMAILS.length;

  // The same sums as cohen_kappa in kappa.py.
  const count = xs => { const m = new Map(); xs.forEach(x => m.set(x, (m.get(x) || 0) + 1)); return m; };
  const agreeOf = (a, b) => a.reduce((s, x, i) => s + (x === b[i] ? 1 : 0), 0);
  const kappaOf = (a, b) => {
    const n = a.length, agree = agreeOf(a, b), po = agree / n, ca = count(a), cb = count(b);
    let pe = 0;
    ca.forEach((k, cat) => { pe += (k / n) * ((cb.get(cat) || 0) / n); });
    return { n, agree, po, pe, k: (po - pe) / (1 - pe), ca, cb };
  };
  const K1 = kappaOf(A1, B1), K2 = kappaOf(A2, B2);
  const DIS1 = A1.map((x, i) => x !== B1[i] ? i : -1).filter(i => i >= 0);
  const PAIRS1 = (() => { const m = new Map(); DIS1.forEach(i => { const key = [A1[i], B1[i]].sort().join(" vs "); m.set(key, (m.get(key) || 0) + 1); }); return [...m].sort((x, y) => y[1] - x[1]); })();
  const DELAY = "Delay or cancellation";

  // Made-up contrast (kappa.py, urgent_a / urgent_b; not model output): an "urgent?" flag where almost every email is "no".
  const URGENT = { a: ["yes", "yes", ...Array(18).fill("no")], b: ["no", "yes", "yes", ...Array(17).fill("no")] };
  const KU = kappaOf(URGENT.a, URGENT.b);

  // From docs/ai-path/runs/s6-labeling-pipeline/kappa.out.txt: the traced cohen_kappa(lead_a, lead_b), guideline 1.
  // [line, vars] per step (about to run that line); the last step, marked "return", is the return.
  const TRACE = [
    [1, {}],
    [2, { n: 20 }],
    [3, { n: 20 }],
    [4, { n: 20, agree: 18 }],
    [5, { n: 20, agree: 18, p_o: 0.9 }],
    [6, { n: 20, agree: 18, p_o: 0.9 }],
    [7, { n: 20, agree: 18, p_o: 0.9 }],
    [8, { n: 20, agree: 18, p_o: 0.9, p_e: 0.0 }],
    [9, { n: 20, agree: 18, p_o: 0.9, p_e: 0.0, cat: "Baggage" }],
    [10, { n: 20, agree: 18, p_o: 0.9, p_e: 0.0, cat: "Baggage", share_a: 0.15 }],
    [11, { n: 20, agree: 18, p_o: 0.9, p_e: 0.0, cat: "Baggage", share_a: 0.15, share_b: 0.15 }],
    [8, { n: 20, agree: 18, p_o: 0.9, p_e: 0.0225, cat: "Baggage", share_a: 0.15, share_b: 0.15 }],
    [9, { n: 20, agree: 18, p_o: 0.9, p_e: 0.0225, cat: "Refund", share_a: 0.15, share_b: 0.15 }],
    [10, { n: 20, agree: 18, p_o: 0.9, p_e: 0.0225, cat: "Refund", share_a: 0.25, share_b: 0.15 }],
    [11, { n: 20, agree: 18, p_o: 0.9, p_e: 0.0225, cat: "Refund", share_a: 0.25, share_b: 0.35 }],
    [8, { n: 20, agree: 18, p_o: 0.9, p_e: 0.10999999999999999, cat: "Refund", share_a: 0.25, share_b: 0.35 }],
    [9, { n: 20, agree: 18, p_o: 0.9, p_e: 0.10999999999999999, cat: "Booking change", share_a: 0.25, share_b: 0.35 }],
    [10, { n: 20, agree: 18, p_o: 0.9, p_e: 0.10999999999999999, cat: "Booking change", share_a: 0.2, share_b: 0.35 }],
    [11, { n: 20, agree: 18, p_o: 0.9, p_e: 0.10999999999999999, cat: "Booking change", share_a: 0.2, share_b: 0.2 }],
    [8, { n: 20, agree: 18, p_o: 0.9, p_e: 0.15, cat: "Booking change", share_a: 0.2, share_b: 0.2 }],
    [9, { n: 20, agree: 18, p_o: 0.9, p_e: 0.15, cat: "Delay or cancellation", share_a: 0.2, share_b: 0.2 }],
    [10, { n: 20, agree: 18, p_o: 0.9, p_e: 0.15, cat: "Delay or cancellation", share_a: 0.4, share_b: 0.2 }],
    [11, { n: 20, agree: 18, p_o: 0.9, p_e: 0.15, cat: "Delay or cancellation", share_a: 0.4, share_b: 0.3 }],
    [8, { n: 20, agree: 18, p_o: 0.9, p_e: 0.27, cat: "Delay or cancellation", share_a: 0.4, share_b: 0.3 }],
    [12, { n: 20, agree: 18, p_o: 0.9, p_e: 0.27, cat: "Delay or cancellation", share_a: 0.4, share_b: 0.3 }],
    [12, { n: 20, agree: 18, p_o: 0.9, p_e: 0.27, cat: "Delay or cancellation", share_a: 0.4, share_b: 0.3 }, "return"]
  ];
  const RESULT = "0.863013698630137";               // kappa.out.txt: "from scratch: 0.863013698630137"
  // kappa.out.txt: "sklearn 1.9.1", then the two bare print lines (lead_a, lead_b) and (lead_b, lead_a), then guideline 2.
  const SK = { version: "1.9.1", v1: "0.863013698630137", swapped: "0.863013698630137", v2: "1.0" };
  const CODE = [
    "def cohen_kappa(lead_a, lead_b):",
    "    n = len(lead_a)",
    "    pairs = zip(lead_a, lead_b)",
    "    agree = sum(a == b for a, b in pairs)",
    "    p_o = agree / n",
    "    count_a = Counter(lead_a)",
    "    count_b = Counter(lead_b)",
    "    p_e = 0.0",
    "    for cat in count_a:",
    "        share_a = count_a[cat] / n",
    "        share_b = count_b[cat] / n",
    "        p_e += share_a * share_b",
    "    return (p_o - p_e) / (1 - p_e)"
  ];
  // The step where the learner predicts p_e: about to run "p_e += share_a * share_b" for Refund.
  const PRED_STEP = TRACE.findIndex(([ln, v]) => ln === 11 && v.cat === "Refund");

  // From docs/ai-path/runs/s6-labeling-pipeline/label-studio/export.json: task 5, trimmed with … (fields cut, none altered).
  const LS_EXPORT = [
    "{",
    " \"id\": 5,",
    " \"annotations\": [",
    "  {\"completed_by\": 1,",
    "   \"result\": [{ …",
    "     \"value\": {\"choices\":",
    "       [\"Delay or cancellation\"]}}],",
    "   …},",
    "  {\"completed_by\": 2,",
    "   \"result\": [{ …",
    "     \"value\": {\"choices\":",
    "       [\"Refund\"]}}],",
    "   …}",
    " ],",
    " \"data\": {",
    "   \"text\": \"The flight was four …\"},",
    " …",
    "}"
  ];
  const LS_VERSION = "1.23.2"; // env.txt

  const f2 = x => x.toFixed(2);
  const pct = x => Math.round(100 * x) + "%";
  const short4 = x => String(Number(x.toFixed(4)));
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = n => WORDS[n] || String(n);
  const Word = n => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}mail { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--surface); font-size: 16px; color: var(--ink); margin: 12px 0 6px; }
      .${P}mail b { display: block; font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
      .${P}tags { display: flex; flex-wrap: wrap; gap: 8px 16px; font: 14px var(--mono); color: var(--ink-2); margin: 6px 0 2px; }
      .${P}tags b { color: var(--ink); }
      .${P}cap { font: 12px var(--mono); color: var(--muted); margin: 2px 0 10px; }
      .${P}sheet { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--sunk); font-size: 15px; color: var(--ink-2); margin-top: 12px; }
      .${P}sheet h3 { font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
      .${P}sheet p { margin: 4px 0; }
      .${P}cats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
      .${P}cats .btn { min-height: 48px; font-size: 15px; }
      .${P}nav { display: flex; gap: 8px; margin-top: 8px; }
      .${P}nav .btn { min-height: 44px; }
      .${P}rows { display: grid; gap: 6px; margin-top: 12px; }
      .${P}row { display: grid; grid-template-columns: 2.2em 1fr; gap: 2px 8px; width: 100%; min-height: 48px; text-align: left; font: inherit; font-size: 14px; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; }
      button.${P}row { cursor: pointer; }
      .${P}rn { font: 700 13px var(--mono); color: var(--muted); grid-row: 1 / span 2; grid-column: 1; padding-top: 2px; }
      .${P}rt { grid-column: 2; }
      .${P}rl { grid-column: 2; font: 13px var(--mono); color: var(--ink-2); }
      .${P}row.found { border: 2px solid var(--good); background: var(--good-soft); padding: 5px 9px; }
      .${P}row.bad { border-color: var(--bad); background: var(--bad-soft); }
      .${P}row.diff { border: 2px solid var(--ink); padding: 5px 9px; }
      .${P}grid { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
      .${P}grid th, .${P}grid td { text-align: left; padding: 6px 6px; border-bottom: 1px solid var(--line); }
      .${P}grid th { font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
      .${P}grid td.n { font-family: var(--mono); }
      .${P}grid tr.on td { background: var(--sunk); font-weight: 700; }
      .${P}list { margin: 10px 0 0; padding-left: 20px; color: var(--ink-2); font-size: 15px; }
      .${P}list li { margin: 4px 0; }
      .${P}out { font: 14px var(--mono); background: var(--sunk); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; margin: 6px 0; color: var(--ink); overflow-x: auto; white-space: pre; }
      .${P}wrap { overflow-x: auto; }
      .${P}link { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); }
      .${P}row { align-content: start; }
    `;
    document.head.appendChild(s);
  }
  const mail = (i, extra = "") => `<div class="${P}mail"><b>Email ${i + 1}</b>${esc(EMAILS[i])}${extra}</div>`;
  const tags = pairs => `<div class="${P}tags">${pairs.map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join("")}</div>`;
  const cap = extra => `<div class="${P}cap">Recorded model output, ${REC_DATE}.${extra ? " " + extra : ""}</div>`;
  const caseBlock = (i, inner) => `<div class="lcase" id="c${i}">${inner}</div>`;
  const STANDIN = "The two leads in this lesson are stand-ins: one small hosted model, given the same guideline and the same emails, told once that it leads the flight disruption desk (lead A) and once the payments desk (lead B). That one line is the only difference between them.";

  /* 1. The situation: the same email, two categories. */
  function situation({ el, done, kit }) {
    style();
    const i = DIS1[0];
    let ans = null;
    const opts = [
      "On emails the leads split, a bot is marked wrong by one of them whatever it answers, so its score depends on whose labels you use",
      "Nothing much: over thousands of emails the splits average out",
      "Nothing, as long as you grade against the more senior lead's labels"
    ];
    const say = [
      `Right. On email ${i + 1}, a bot that says ${A1[i]} is wrong by lead B's labels, and a bot that says ${B1[i]} is wrong by lead A's. The score would measure the leads' habits as much as the bot. Before labels grade anything, you check that two people give the same label.`,
      `The splits do not average out. They come from the same kind of email every time (here, a delay plus a request for money), so one lead files that kind one way and the other lead the other way. More emails just repeat the split.`,
      `Picking one lead hides the split but keeps it. The next person you hire, or the bot you grade, will read the same short guideline and land on either side. The cause is in the guideline, not in who wins.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Two leads, one inbox</h1>
        <p class="lead">Larkspur Air, a made-up airline, wants a bot that files complaint emails into ${word(CATS.length)} queues: ${CATS.join(", ")}. To grade the bot, the team will compare it with emails its two support leads filed by hand: a golden set, like the ones in stage 5. That only works if the hand labels are a stable target. But the leads keep filing the same email differently:</p>
        ${mail(i, tags([["Lead A", A1[i]], ["Lead B", B1[i]]]))}
        ${cap()}
        <p class="lead">${esc(STANDIN)}</p>
        <p class="task">The team wants to grade the bot against the leads' labels. What does a split like this (two labels for one email) do to that grade?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : kit.feedback(esc(say[ans]), ans === 0)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 2. By hand: label the 20 emails yourself; after each, see what the two leads said. */
  function byHand({ el, done, kit }) {
    style();
    const mine = Array(N).fill(null);
    let k = 0;
    const paint = () => {
      const all = mine.every(x => x != null);
      const seen = mine.map((x, i) => x == null ? -1 : i).filter(i => i >= 0);
      const youA = agreeOf(mine.map(x => x || ""), A1), youB = agreeOf(mine.map(x => x || ""), B1);
      const kA = all ? kappaOf(mine, A1) : null, kB = all ? kappaOf(mine, B1) : null;
      el.innerHTML = `<h1>File them yourself</h1>
        <p class="lead">This is all the guideline the leads had: the names of the queues in the ticketing tool.</p>
        <div class="${P}sheet"><h3>Guideline</h3><p>${esc(GUIDE1)}</p></div>
        <p class="task">${all ? "All twenty are filed. Tap a row below to change one if you like." : `File each email. After each one you see what the two leads chose.`}</p>
        ${k < N ? `${mail(k)}
        <div class="${P}cats">${CATS.map((c, j) => `<button type="button" class="btn" data-cat="${j}"${mine[k] === c ? ' aria-pressed="true"' : ""}>${esc(c)}</button>`).join("")}</div>
        <div class="${P}nav"><button type="button" class="btn" data-back ${k === 0 ? "disabled" : ""}>Previous email</button><span class="${P}cap" style="align-self:center">${k + 1} of ${N}</span></div>` : ""}
        <div class="lpanel">
          ${all ? kit.feedback(`You agree with lead A on <b>${youA} of ${N}</b> and with lead B on <b>${youB} of ${N}</b>. Some of that agreement would happen by luck alone. Soon you will build a score that takes the luck out. On it, you and lead A score <b>${f2(kA.k)}</b>, and you and lead B <b>${f2(kB.k)}</b>. 1 means the same label on every email; 0 means no better than luck. Look at the ringed rows: there you chose differently from at least one lead.`) : ""}
          <div class="${P}rows">${seen.slice().reverse().map(i => {
            const diff = mine[i] !== A1[i] || mine[i] !== B1[i];
            return `<button type="button" class="${P}row${diff ? " diff" : ""}" data-go="${i}"><span class="${P}rn">${i + 1}</span><span class="${P}rt">${esc(EMAILS[i])}</span><span class="${P}rl">you ${esc(SHORT[mine[i]])} · A ${esc(SHORT[A1[i]])} · B ${esc(SHORT[B1[i]])}</span></button>`;
          }).join("")}</div>
          ${seen.length ? `<p class="${P}cap">Labels of A and B: recorded model output, ${REC_DATE}. Delay = Delay or cancellation, Change = Booking change. A ringed row is one where your label differs from lead A's or lead B's.</p>` : ""}
        </div>`;
      el.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => {
        mine[k] = CATS[+b.dataset.cat];
        k = mine.findIndex((x, i) => x == null && i > k);
        if (k < 0) k = mine.findIndex(x => x == null);
        if (k < 0) k = N;
        paint();
        if (mine.every(x => x != null)) done();
      });
      const back = el.querySelector("[data-back]");
      if (back) back.onclick = () => { k = Math.max(0, k - 1); paint(); };
      el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { k = +b.dataset.go; paint(); });
    };
    paint();
  }

  /* 3. Find the emails where the two leads split, and count the agreement. */
  function findSplits({ el, done, kit }) {
    style();
    const found = new Set();
    let bad = null, last = null;
    // The feedback sits right under the row that was tapped, so it is on screen wherever the row is.
    const fbFor = i => {
      if (i !== last) return "";
      if (bad === i) return kit.feedback(`Email ${i + 1}: both leads filed it as ${esc(A1[i])}. That is agreement, not a split. Compare the A and B labels on each row.`, false);
      if (found.size === DIS1.length) return kit.feedback(`Email ${i + 1}: lead A said ${esc(A1[i])}, lead B said ${esc(B1[i])}. That was the last one. The leads agree on ${K1.agree} of ${N} emails: <b>${pct(K1.po)}</b>. That number is called <b>raw agreement</b>. It sounds high. The next screen asks how much of it means anything.`, true);
      return kit.feedback(`Email ${i + 1}: lead A said ${esc(A1[i])}, lead B said ${esc(B1[i])}. ${Word(DIS1.length - found.size)} more to find.`);
    };
    const paint = () => {
      el.innerHTML = `<h1>Where do the leads split?</h1>
        <p class="lead">Here are both leads' labels for all ${N} emails (recorded model output, ${REC_DATE}). Delay means Delay or cancellation, Change means Booking change.</p>
        <p class="task">Tap every email the two leads filed differently.</p>
        <div class="${P}rows lpanel">${EMAILS.map((e, i) => `<button type="button" class="${P}row${found.has(i) ? " found" : bad === i ? " bad" : ""}" data-i="${i}"><span class="${P}rn">${i + 1}</span><span class="${P}rt">${esc(e)}</span><span class="${P}rl">A ${esc(SHORT[A1[i]])} · B ${esc(SHORT[B1[i]])}${found.has(i) ? " · split" : ""}</span></button>${fbFor(i)}`).join("")}</div>`;
      el.querySelectorAll(`.${P}row`).forEach(b => b.onclick = () => {
        if (found.size === DIS1.length) return;
        const i = +b.dataset.i;
        last = i;
        if (A1[i] === B1[i]) { bad = i; paint(); return; }
        bad = null; found.add(i); paint();
        if (found.size === DIS1.length) done();
      });
    };
    paint();
  }

  /* 4. Spot the idea: a labeler who never reads still agrees some of the time. */
  function spotIdea({ el, done, kit }) {
    style();
    const nA = K1.ca.get(DELAY);
    const right = `${nA} of ${N} (${pct(nA / N)})`, even = `${N / CATS.length} of ${N} (${pct(1 / CATS.length)})`, none = `0 of ${N} (0%)`;
    const opts = [even, right, none];
    const correct = 1;
    let ans = null;
    const say = [
      `That would be true if lead A used the ${word(CATS.length)} queues equally often. A did not: A filed ${nA} of ${N} emails as ${DELAY}. The lazy labeler matches A on every one of those, so it matches ${nA} times.`,
      `Right: ${nA} matches without reading a word, because lead A also files a lot of email there. So part of any agreement comes free, just from two people using the same busy queues. That part is called <b>chance agreement</b>. Labels you can trust need agreement <i>above</i> chance, and the busier one queue is, the more agreement comes free.`,
      `It is not zero. The lazy labeler says ${DELAY} every time, so it matches lead A on every email A also filed there: ${nA} of them.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>A labeler who never reads</h1>
        <p class="lead">Imagine a lazy third labeler who files <b>every</b> email as ${DELAY} without opening it. Lead A's labels for the ${N} emails:</p>
        <table class="${P}grid"><thead><tr><th>Queue</th><th>Lead A</th></tr></thead><tbody>${CATS.map(c => `<tr><td>${esc(c)}</td><td class="n">${K1.ca.get(c) || 0}</td></tr>`).join("")}</tbody></table>
        <p class="task">On how many of the ${N} emails would the lazy labeler agree with lead A?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Use it with predictions: chance agreement from both leads' habits, then agreement above chance. */
  function predict({ el, done, kit }) {
    style();
    const n = N, a = K1.ca.get(DELAY), b = K1.cb.get(DELAY);
    const prod = (a / n) * (b / n);
    const q1 = [`${f2((a + b) / (2 * n))}: the average of the two shares`, `${f2(prod)}: ${a}/${n} × ${b}/${n}`, `${f2(a / n)}: lead A's share`];
    const c1 = 1;
    const kap = K1.k, diff = K1.po - K1.pe;
    const q2 = [`${f2(diff)}: ${f2(K1.po)} − ${f2(K1.pe)}`, `${f2(K1.po)}: chance does not matter here`, `${f2(kap)}: (${f2(K1.po)} − ${f2(K1.pe)}) / (1 − ${f2(K1.pe)})`];
    const c2 = 2;
    let s1 = null, s2 = null;
    const paint = () => {
      const ok1 = s1 === c1, ok2 = s2 === c2;
      const rows = CATS.map(c => { const x = K1.ca.get(c) || 0, y = K1.cb.get(c) || 0; return [c, x, y, (x / n) * (y / n)]; });
      el.innerHTML = `<h1>How much agreement is free?</h1>
        <p class="lead">Pretend each lead files at random, but keeps their own habits: lead A picks ${DELAY} ${a} times in ${n} (a share of ${f2(a / n)}), lead B ${b} times in ${n} (${f2(b / n)}).</p>
        <table class="${P}grid"><thead><tr><th>Queue</th><th>A</th><th>B</th><th>both, by chance</th></tr></thead><tbody>${rows.map(([c, x, y, p]) => `<tr${c === DELAY ? ' class="on"' : ""}><td>${esc(c)}</td><td class="n">${x}</td><td class="n">${y}</td><td class="n">${c === DELAY && !ok1 ? "?" : ok1 ? short4(p) : "…"}</td></tr>`).join("")}
        ${ok1 ? `<tr class="on"><td>chance agreement p<sub>e</sub></td><td></td><td></td><td class="n">${f2(K1.pe)}</td></tr>` : ""}</tbody></table>
        <p class="task">${!ok1 ? `By luck alone, how often do both leads pick ${DELAY} for the same email?` : !ok2 ? `The leads really agree ${f2(K1.po)} of the time (p<sub>o</sub>). Chance alone gives ${f2(K1.pe)} (p<sub>e</sub>), so the most they could add above chance is 1 − ${f2(K1.pe)} = ${f2(1 - K1.pe)}. What share of that room above chance did they really use?` : `Worked out: p<sub>o</sub> = ${f2(K1.po)}, p<sub>e</sub> = ${f2(K1.pe)}, and the score below.`}</p>
        <div class="lpanel">
          ${!ok1 ? kit.options(q1.map(esc), { picked: s1, correct: c1 }) + (s1 == null ? "" : kit.feedback(s1 === 0
              ? `Averaging the shares gives how often <i>one</i> lead picks it, on average. For both to pick it, A must pick it <b>and</b> B must pick it, and two independent chances multiply.`
              : `That is how often A alone picks ${DELAY}. B must pick it too, which happens only ${b} times in ${n}: multiply the two shares.`, false))
          : kit.feedback(`Right: ${a}/${n} × ${b}/${n} = ${short4(prod)}. Do the same for every queue and add up: by chance alone the leads would agree <b>${f2(K1.pe)}</b> of the time.`, true)}
          ${ok1 && !ok2 ? kit.options(q2.map(esc), { picked: s2, correct: c2 }) + (s2 == null ? "" : kit.feedback(s2 === 0
              ? `${f2(diff)} is the agreement above chance, but it is not on a fixed scale: with chance at ${f2(K1.pe)}, the best possible is 1 − ${f2(K1.pe)} = ${f2(1 - K1.pe)}. Divide by that room, so perfect agreement scores 1.`
              : `Chance matters: ${f2(K1.pe)} of agreement comes free. Count only what is above it, and divide by the room above it, 1 − ${f2(K1.pe)}.`, false)) : ""}
          ${ok2 ? kit.feedback(`Right: <b>${f2(kap)}</b>. This score is <b>Cohen's kappa</b>: (p<sub>o</sub> − p<sub>e</sub>) / (1 − p<sub>e</sub>). 1 means they agree on everything. 0 means no better than two people guessing with the same habits. Below 0 means worse than that. Here raw agreement (${f2(K1.po)}) and kappa (${f2(kap)}) are close because the ${word(CATS.length)} queues are all used. When one queue holds almost everything, chance agreement is high and the two numbers drift far apart; you will meet that case at the end.`, true) : ""}
        </div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => {
        const v = +bt.dataset.i;
        if (!ok1) { s1 = v; paint(); return; }
        s2 = v; paint(); if (v === c2) done();
      });
    };
    paint();
  }

  /* 6. The same sums in Python, replayed from a real run, with one prediction. */
  const SAY = {
    1: "n is the number of emails both leads filed.",
    2: "zip pairs lead A's label with lead B's, email by email, like walking two arrays with one index.",
    3: "Count the pairs where the two labels are the same.",
    4: "Observed agreement p_o: the share of emails they agree on.",
    5: "Count how often lead A used each queue. Counter comes from Python's standard library (from collections import Counter, at the top of the script). It is like a JS object of counts, and it gives 0 for a key it has never seen.",
    6: "The same count for lead B.",
    7: "Chance agreement p_e starts at zero.",
    8: "Loop over the queues lead A used. A queue only B used adds 0 anyway, since count_a would be 0 for it.",
    9: "Lead A's share of this queue.",
    10: "Lead B's share of this queue.",
    11: "Add the chance that both pick this queue: A's share times B's share."
  };
  function asCode({ el, done, kit }) {
    style();
    let i = 0, guess = null;
    const pv = TRACE[PRED_STEP][1], after = TRACE[PRED_STEP + 1][1].p_e;
    const opts = [short4(after), short4(pv.share_a * pv.share_b), short4(pv.p_e + pv.share_a + pv.share_b)];
    const correct = 0;
    const why = [
      `Right: ${short4(pv.p_e)} + ${pv.share_a} × ${pv.share_b} = ${short4(after)}. The run agrees, as the next step shows.`,
      `${short4(pv.share_a * pv.share_b)} is what Refund adds. But <code>+=</code> adds it to the ${short4(pv.p_e)} already there from Baggage.`,
      `That adds the two shares. Both leads must pick Refund for the same email, and two chances that must both happen multiply.`
    ];
    const order = [1, 0, 2]; // shown order of the options
    const paint = () => {
      const [ln, v, ev] = TRACE[i], last = i === TRACE.length - 1, ask = i === PRED_STEP && guess !== correct;
      let say = SAY[ln] || "";
      if (ln === 9) say = `cat = "${esc(v.cat)}". ${SAY[9]}`;
      if (ln === 11 && i !== PRED_STEP) say = `Add ${v.share_a} × ${v.share_b} for ${esc(v.cat)}. p_e is ${short4(v.p_e)} before this line.`;
      if (ln === 8 && v.cat) say = `p_e is now ${short4(v.p_e)}. Next queue.`;
      if (ln === 12 && !ev) say = `The loop is over: p_e = ${short4(v.p_e)}. Now the score: agreement above chance, divided by the room above chance.`;
      if (last) say = `Return (${v.p_o} − ${short4(v.p_e)}) / (1 − ${short4(v.p_e)}) = <b>${RESULT}</b>, the ${f2(+RESULT)} you worked out by hand.`;
      const show = k => v[k] == null ? "–" : typeof v[k] === "number" ? short4(v[k]) : esc(v[k]);
      el.innerHTML = `<h1>The same sums in Python</h1>
        <p class="lead"><code>lead_a</code> and <code>lead_b</code> are the two lists of ${N} labels you saw. This replays a real run on our laptop, step by step (values rounded to 4 places).</p>
        <p class="task">${ask ? `Lead A's share of Refund is ${pv.share_a}, lead B's is ${pv.share_b}, and p_e is ${short4(pv.p_e)}. What will p_e be after the highlighted line?` : "Step through to the return. One step asks you to predict a value first."}</p>
        <div class="${P}wrap">${kit.code(CODE, ln)}</div>
        <div class="vars"><span>agree <b>${show("agree")}</b></span><span>p_o <b>${show("p_o")}</b></span><span>cat <b>${show("cat")}</b></span><span>share_a <b>${show("share_a")}</b></span><span>share_b <b>${show("share_b")}</b></span><span>p_e <b>${show("p_e")}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${i === PRED_STEP ? `<div class="lpanel">${kit.options(order.map(j => esc(opts[j])), { picked: guess == null ? null : order.indexOf(guess), correct: order.indexOf(correct) })}${guess == null ? "" : kit.feedback(why[guess], guess === correct)}</div>` : kit.feedback(say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || ask ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { if (guess === correct) return; guess = order[+b.dataset.i]; paint(); });
    };
    paint();
  }

  /* 7. The same score with scikit-learn: predict what swapping the leads does. */
  function withLibrary({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      `${SK.v1}, the same: kappa treats the two labelers alike`,
      "A different number: p_e is built from the queues lead A used",
      "An error: the first list must be the senior lead's"
    ];
    const correct = 0;
    const say = [
      `Right, and the run printed exactly that. p<sub>o</sub> counts matches, which does not care who is first. p<sub>e</sub> multiplies A's share by B's share for each queue, and a product does not care about order either. So it does not matter which lead you call A.`,
      `The loop runs over lead A's queues, but a queue only B used would add 0 anyway (A's share is 0). Each queue adds A's share times B's share, and swapping the two gives the same product. The run printed the same number.`,
      `Neither the formula nor the library has a "senior" side: both lists are just labels for the same emails, in the same order. The run printed the same number for both orders.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same score with scikit-learn</h1>
        <p class="lead">In practice you do not write the kappa sum by hand. scikit-learn, Python's standard machine learning library, has it. Same two lists:</p>
        <div class="${P}wrap">${kit.code(["from sklearn.metrics import cohen_kappa_score", "print(cohen_kappa_score(lead_a, lead_b))", "print(cohen_kappa_score(lead_b, lead_a))"], ans === correct ? -1 : 2)}</div>
        <div class="${P}out">${esc(SK.v1)}${ans === correct ? "\n" + esc(SK.swapped) : "\n?"}</div>
        <p class="${P}cap">Output of our run, scikit-learn ${SK.version}. The first line is the from-scratch number.</p>
        <p class="task">The last line swaps the two leads. What does it print?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. The labeling tool: Label Studio, run on our laptop. */
  const LS_CONFIG = [
    "<View>",
    "  <Text name=\"email\" value=\"$text\"/>",
    "  <Choices name=\"queue\" toName=\"email\"",
    "           choice=\"single\" required=\"true\">",
    "    <Choice value=\"Baggage\"/>",
    "    <Choice value=\"Delay or cancellation\"/>",
    "    <Choice value=\"Refund\"/>",
    "    <Choice value=\"Booking change\"/>",
    "  </Choices>",
    "</View>"
  ];
  function tools({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Label Studio cannot store two choices for one email",
      "Kappa compares one label per email, and the bot must still pick one queue: two ticks hide the split instead of settling it",
      "Ticking two boxes makes labeling slower"
    ];
    const correct = 1;
    const say = [
      `It can: <code>choice="multiple"</code> lets a labeler tick several. The reason to say no is what the labels are for: one queue per email, and a score that compares one label with one label.`,
      `Right. The bot routes each email to one queue, so the labels must name one queue too. With two ticks, both leads could tick Delay and Refund on email ${DIS1[0] + 1} and look as if they agree, while the routing question stays open. Settle it in the guideline instead.`,
      `A little, but that is not the problem. The problem is that two ticks do not say which queue the email goes to, and that is the one decision the bot must make.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>The labeling tool</h1>
        <p class="lead">The labeling itself happens in a tool such as <b>Label Studio</b>, an open-source labeling app you can run on your own machine. You describe the labeling form in an XML config:</p>
        <div class="${P}wrap">${kit.code(LS_CONFIG, 3)}</div>
        <p class="lead"><code>$text</code> shows the text of each imported email. <code>choice="single"</code> allows one queue per email, and <code>required="true"</code> stops a lead from submitting with none.</p>
        <p class="lead">We ran Label Studio ${LS_VERSION} on our laptop with this config, imported the ${N} emails, entered each lead's labels under that lead's own user account, and exported JSON. Email ${DIS1[0] + 1} in the export, trimmed:</p>
        <div class="${P}wrap">${kit.code(LS_EXPORT, -1)}</div>
        <p class="${P}cap">From our export. <code>completed_by</code> is the user id of the lead who labeled.</p>
        <p class="lead">Group the picked queues by <code>completed_by</code> and you have <code>lead_a</code> and <code>lead_b</code>. Our script did that, and scikit-learn gave the same ${f2(+SK.v1)}. The free open-source edition (Community) does not compute agreement for you, so you run a script like this. Source: <a class="${P}link" href="https://docs.humansignal.com/guide/label_studio_compare" target="_blank" rel="noopener">editions page, 2026-11-14</a></p>
        <p class="task">The leads ask to tick two queues when an email fits both. Why say no for this project?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 9. Find the cause of the disagreement and fix the guideline; then the recorded re-label. */
  function fixGuide({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Remove the Refund queue, so these emails can only go to Delay or cancellation",
      "Add one rule for emails that fit two queues: file them by what the customer asks for",
      "Ask a third person to decide every email the two leads split on"
    ];
    const correct = 1;
    const say = [
      `The split would vanish, but so would the queue the payments desk works from. Those customers ask for money; filed under delays, nobody who can pay them sees the email. The label must serve the routing.`,
      ``,
      `A third person settles these ${word(DIS1.length)} emails, and that is worth doing for a golden set. But the guideline does not change, so the next two thousand emails split the same way, and the tie-breaker becomes a full-time job.`
    ];
    // what the re-label did to the email that asks for the cost of a new suitcase (index 5)
    const BAG = 5;
    const paint = () => {
      el.innerHTML = `<h1>Fix the cause, not the labels</h1>
        <p class="lead">Every split falls on the same pair of queues:</p>
        <table class="${P}grid"><thead><tr><th>Split between</th><th>Emails</th></tr></thead><tbody>${PAIRS1.map(([k, c]) => `<tr><td>${esc(k)}</td><td class="n">${c}</td></tr>`).join("")}</tbody></table>
        ${DIS1.map(i => mail(i, tags([["Lead A", A1[i]], ["Lead B", B1[i]]]))).join("")}
        ${cap()}
        <p class="lead">Both emails report a delay <i>and</i> ask for money. The guideline names the queues but never says which wins when two fit, so each lead falls back on their own desk.</p>
        <p class="task">Which change to the guideline removes this split?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : ans !== correct ? kit.feedback(say[ans], false)
          : kit.feedback(`Right. A tie-break rule gives both leads the same answer for emails that fit two queues, and the guideline now carries it for every future labeler. The rule we added, word for word:`, true) + `<div class="${P}sheet"><h3>Guideline, version 2</h3><p>${esc(GUIDE1)}</p><p>${esc(RULE)}</p></div>
            <p class="lead">Then both leads filed the same ${N} emails again with the new guideline. They agree on <b>${K2.agree} of ${N}</b>, and scikit-learn gives kappa <b>${esc(SK.v2)}</b> (it was ${f2(K1.k)}). ${DIS1.map(i => `Email ${i + 1}: both now say ${esc(A2[i])}.`).join(" ")}</p>
            ${cap("Same model, same desk lines, only the guideline changed.")}
            ${kit.feedback(`One thing agreement cannot tell you. Email ${BAG + 1} asks for “the cost of a new suitcase”, and both leads now file it under ${esc(A2[BAG])}${A2[BAG] === B2[BAG] ? "" : ` and ${esc(B2[BAG])}`}. Is that money back (Refund) or repairing a bag (Baggage)? The rule does not settle it, yet both chose the same side. Kappa says two labelers read the guideline the same way, not that they read it right. Read a sample of the agreed labels against the guideline too, and add an example for cases like this.`)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 10. The big picture. */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "A solo developer tags 15 example emails to try a prompt idea this afternoon",
      "A team labels 400 support chats as “resolved” or “not resolved” to build the golden set for its next bot",
      "A team marks whether each ticket got a first reply within 24 hours, from the ticket's timestamps"
    ];
    const correct = 1;
    const say = [
      `A throwaway try-out does not need a second labeler: nobody will train or grade on these 15 labels. The cost is not worth it until the labels start to matter.`,
      `Right. Four hundred labels that will grade every future version of a bot, and “resolved” is a judgment call (the customer stopped writing; is that resolved?). Have two people label a sample, compute kappa, and fix the guideline before labeling the rest.`,
      `Nothing here needs judgment: a script reads the two timestamps and gives the one right answer. A second person would only double the cost.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to check label agreement</h1>
        <ul class="${P}list">
          <li><b>What it is for:</b> knowing your labels are a stable target before you train on them or grade a model with them. A model cannot be scored more reliably than its labels.</li>
          <li><b>Reach for it</b> when labels need judgment and many people (or a model) will produce them: double-label a sample, compute kappa, fix the guideline, measure again.</li>
          <li><b>Not for</b> labels a script can compute (run the script), or free text with no fixed categories (use a rubric review).</li>
          <li><b>What it costs:</b> every double-labeled item is paid for twice, the guideline needs meetings and examples, and each guideline change means labeling the sample again.</li>
        </ul>
        <p class="task">Which of these most needs a second labeler and an agreement check?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(esc(say[ans]), ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 11. Recognise it in new situations, including two where kappa is the wrong tool. */
  const CASES = [
    [`Two agents flag incoming emails as “urgent” or not. Almost every email is not urgent. On a sample of ${KU.n} emails they agree on ${KU.agree}. The team says ${pct(KU.po)} is good enough to train an urgency model. Would computing kappa change the picture?`, true,
      `Yes. Each agent flagged only ${URGENT.a.filter(x => x === "yes").length} emails as urgent, so two people saying “no” almost every time agree a lot by chance: p<sub>e</sub> = ${f2(KU.pe)}. Kappa is ${f2(KU.k)}, far below the airline's ${f2(K1.k)} with the same ${KU.agree} of ${KU.n} raw agreement. Of the ${URGENT.a.filter((x, i) => x === "yes" || URGENT.b[i] === "yes").length} emails either agent flagged, they agree on only ${URGENT.a.filter((x, i) => x === "yes" && URGENT.b[i] === "yes").length}, and those are the emails that matter.`,
      `Raw agreement hides it here. When nearly every email is “no”, two people who say “no” almost always agree by chance: p<sub>e</sub> = ${f2(KU.pe)}. Kappa is ${f2(KU.k)}, against ${f2(K1.k)} for the airline with the same ${KU.agree} of ${KU.n}. Fix the guideline for “urgent” before training.`],
    ["Two writers each write a one-line summary of every support call. The team wants a number for how consistent the summaries are. Would Cohen's kappa give it?", false,
      "No. Kappa counts exact matches of one label from a fixed list. Two good summaries almost never match word for word, so kappa would call them all disagreements. Use a rubric review, or turn the question into categories first (for example “does the summary mention the refund amount: yes or no”), and compute kappa on those.",
      "Kappa needs a fixed list of labels to compare. Free-text summaries have none: two good summaries rarely match word for word, so every pair would count as a disagreement. Review them with a rubric, or ask category questions about them and compute kappa on the answers."],
    ["A gym trains a model to predict which new members will cancel within six months. Each member's label is whether they actually cancelled, taken from the billing records half a year later. Should two people label each member and compute kappa?", false,
      "No. Nobody judges anything here: the label is something that later happened, written down by the billing system. Two people copying the same record agree by construction, so kappa would come out near 1 and prove nothing. Check what can really go wrong instead: that the records are joined to the right members and that the cut-off date is the same for everyone.",
      "Kappa measures whether people read a guideline the same way. This label is a later outcome copied from billing records, not a reading of anything: two people would agree on nearly every member and the score would say nothing. Check the record join and the dates instead."],
    ["Three contractors will label 10,000 forum comments as “fine”, “borderline” or “remove” for a moderation model. The project starts next week.", true,
      "Yes. “Borderline” is exactly where people split. Have them label the same small sample first, compute kappa for each pair of contractors, look at which pair of labels they split on, and fix the guideline before the 10,000.",
      "This is the airline again with more people: a judgment call and a large job. Label a shared sample first, compute kappa for each pair of contractors, find the label pair they split on, and fix the guideline before the big job starts."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would an agreement check help?</h1>
        <p class="lead">${Word(CASES.length)} situations away from the airline. An agreement check means: two labelers label the same items, and you compute kappa.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => caseBlock(i, `<p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}`)).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <ul class="${P}list">
        <li>Set up a labeling task: a fixed list of categories, one label per item, a written guideline.</li>
        <li>Have two people label the same sample and compute kappa, (p<sub>o</sub> − p<sub>e</sub>) / (1 − p<sub>e</sub>), not just the raw agreement.</li>
        <li>Find the pair of categories the splits fall on, add a rule for the items that fit both, label again and measure again.</li>
        <li>Remember that agreement is not correctness: read a sample against the guideline too.</li>
      </ul>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>cohen_kappa</code> yourself and run it on two lists of labels.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. Labeled, agreed data is one input; the next lesson turns months of raw logs into a clean dataset you could label, evaluate on or tune with.</p>` : ""}`;
    done();
  }

  LessonKit.define("s6-labeling-pipeline", {
    title: "Labeling data and checking label agreement",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.cohen_kappa_score.html",
      "https://doi.org/10.1177/001316446002000104",
      "https://docs.python.org/3/library/collections.html#collections.Counter",
      "https://labelstud.io/tags/choices",
      "https://labelstud.io/tags/text",
      "https://labelstud.io/guide/tasks",
      "https://labelstud.io/guide/task_format",
      "https://labelstud.io/guide/export",
      "https://docs.humansignal.com/guide/label_studio_compare",
      "https://docs.humansignal.com/guide/stats",
      "https://labelstud.io/guide/install",
      "https://labelstud.io/api"
    ],
    interview: [{
      q: "You are training an email classifier on labels from two contractors, and accuracy will not go past about 80% whatever you try. How do you find out whether the labels are the problem?",
      good: [
        "Have both contractors label the same sample and compute Cohen's kappa, not just raw agreement, because busy categories agree by chance",
        "Look at where they split: usually one pair of categories, on items that fit both",
        "Fix the guideline with a rule and examples for those items, re-label the sample and measure again",
        "Compare the model's errors with the label splits: if it fails where humans split, the ceiling is the labels",
        "Spot-check agreed labels against the guideline, since two people can agree on the wrong reading"
      ],
      weak: "Try a bigger model or tune it longer. That assumes the labels are right; if the labelers disagree, no model can match both of them."
    }],
    screens: [situation, byHand, findSplits, spotIdea, predict, asCode, withLibrary, tools, fixGuide, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(N).fill('[data-cat="0"]') },
      { wrong: ['[data-i="0"]'], right: DIS1.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: [...Array(PRED_STEP).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]", ...Array(TRACE.length - 1 - PRED_STEP).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
