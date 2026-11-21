/* Lesson: asking for reasoning steps, and what it costs. Story: a ferry operator's fare assistant that must add
   vehicle length, cabin type and a peak-season rule to the base ticket.
   Ideas: (1) writing the working out first puts each part of the answer on the page before the total, so the
   last line only adds numbers already written; (2) it costs output tokens, waiting time and a parser that can
   find the answer, and the working can still be wrong, so for a fixed formula, code beats both prompts.
   Depth: explain (screens 2-5), debug (screens 6 and 7), when-not (screens 8 and 9).
   Data:
   - Recordings (main checkout) docs/ai-path/recordings/s5a-reasoning-steps/direct-q01..q12 and steps-q01..q12:
     the same 12 fare questions asked with "number only" and with "step by step, end with FARE:". Texts and
     token counts below are copied from those files, not altered.
   - Runs docs/ai-path/runs/s5a-reasoning-steps/fares.py (the true fares, fares.out.txt) and parser.py (the
     app's old and fixed parsers run on the 12 recorded replies, parser.out.txt).
   Every count, total and ratio on screen is computed here from Q. Plain browser script. */
(() => {
  const ID = "s5a-reasoning-steps", P = `lx-${ID}-`;

  // From docs/ai-path/recordings/s5a-reasoning-steps/{direct,steps}-qNN.json (texts and usage copied, not altered)
  // and docs/ai-path/runs/s5a-reasoning-steps/{fares,parser}.out.txt (parts, fare, appOld = read_fare_old, appNew = read_fare).
  const REC = { src: "s5a-reasoning-steps/{direct,steps}-q01..q12", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13", temperature: 0 };
  const Q = [
    {"q":1,"ask":"One adult, no vehicle, no cabin, sailing on 10 March.","parts":{"passengers":38,"vehicle":0,"cabins":0,"peak":false},"fare":38,"direct":{"text":"38","inTok":214,"outTok":2,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult ticket: 38 euros\nFARE: 38","inTok":236,"outTok":13,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":38},
    {"q":2,"ask":"Two adults with a motorbike, sailing on 3 October.","parts":{"passengers":76,"vehicle":20,"cabins":0,"peak":false},"fare":96,"direct":{"text":"115","inTok":210,"outTok":3,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Passenger tickets:\nAdult: 38 euros\nAdult: 38 euros\nVehicle:\nMotorbike: 20 euros\nFARE: 96","inTok":232,"outTok":34,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":96},
    {"q":3,"ask":"Two adults and a 7-year-old, car 4.6 m long, no cabin, sailing on 20 July.","parts":{"passengers":95,"vehicle":45,"cabins":0,"peak":true},"fare":175,"direct":{"text":"200","inTok":227,"outTok":3,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult passenger: 38 euros\nAdult passenger: 38 euros\nChild passenger (7 years old): 19 euros\nCar (4.6 m): 45 euros\nPeak season surcharge (passengers): (38 + 38 + 19) * 0.25 = 23.75 euros\nPeak season surcharge (car): 45 * 0.25 = 11.25 euros\nFARE: 175.00","inTok":249,"outTok":107,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":175},
    {"q":4,"ask":"One adult, car 6.3 m long, one outside cabin, sailing on 14 June.","parts":{"passengers":38,"vehicle":69,"cabins":85,"peak":false},"fare":192,"direct":{"text":"163.75","inTok":220,"outTok":6,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult ticket: 38 euros\nCar (6.3 m): 45 euros + (2 * 12 euros) = 69 euros\nOutside cabin: 85 euros\nFARE: 192","inTok":242,"outTok":48,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":192},
    {"q":5,"ask":"Two adults, car exactly 5.0 m long, one inside cabin, sailing on 15 June.","parts":{"passengers":76,"vehicle":45,"cabins":60,"peak":true},"fare":211.25,"direct":{"text":"176.25","inTok":221,"outTok":6,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult passenger: 38 euros\nAdult passenger: 38 euros\nCar (up to 5m): 45 euros\nInside cabin: 60 euros\nPeak season surcharge (25%): 34.25 euros\nFARE: 215.25","inTok":243,"outTok":62,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":215.25},
    {"q":6,"ask":"One adult and a 2-year-old, no vehicle, one inside cabin, sailing on 2 August.","parts":{"passengers":38,"vehicle":0,"cabins":60,"peak":true},"fare":107.5,"direct":{"text":"123","inTok":222,"outTok":3,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult passenger: 38 euros\nChild passenger (under 4): 0 euros\nInside cabin: 60 euros\nPeak season surcharge (25% on passengers and vehicle): (38 + 0) * 0.25 = 9.5 euros\nTotal fare: 38 + 0 + 60 + 9.5 = 107.5 euros\nFARE: 107.5","inTok":244,"outTok":93,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":107.5},
    {"q":7,"ask":"Two adults and two children aged 9 and 3, car 7.2 m long, one outside cabin, sailing on 10 August.","parts":{"passengers":95,"vehicle":81,"cabins":85,"peak":true},"fare":305,"direct":{"text":"259","inTok":229,"outTok":3,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult passenger tickets: 38 * 2 = 76 euros\nChild passenger tickets (aged 9): 19 * 1 = 19 euros\nChild passenger tickets (aged 3): 0 * 1 = 0 euros\nCar ticket (7.2 m): 45 + (12 * 3) = 81 euros\nOutside cabin ticket: 85 euros\nPeak season surcharge (passengers and car): (76 + 19 + 0 + 81) * 0.25 = 46.5 euros\nTotal fare: 76 + 19 + 0 + 81 + 85 + 46.5 = 307.5 euros\nFARE: 307.5","inTok":251,"outTok":169,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":307.5},
    {"q":8,"ask":"One adult with a motorbike, sailing on 1 September.","parts":{"passengers":38,"vehicle":20,"cabins":0,"peak":false},"fare":58,"direct":{"text":"65","inTok":210,"outTok":2,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Passenger ticket (adult): 38 euros\nMotorbike: 20 euros\nFARE: 58","inTok":232,"outTok":22,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":58},
    {"q":9,"ask":"Three adults, no vehicle, no cabin, sailing on 31 August.","parts":{"passengers":114,"vehicle":0,"cabins":0,"peak":true},"fare":142.5,"direct":{"text":"142.5","inTok":214,"outTok":5,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult passenger: 38 * 1.25 = 47.5\nAdult passenger: 38 * 1.25 = 47.5\nAdult passenger: 38 * 1.25 = 47.5\nFARE: 142.5","inTok":236,"outTok":64,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":142.5},
    {"q":10,"ask":"Two adults, car 5.4 m long, no cabin, sailing on 12 May.","parts":{"passengers":76,"vehicle":57,"cabins":0,"peak":false},"fare":133,"direct":{"text":"146","inTok":219,"outTok":3,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult passenger: 38 euros\nAdult passenger: 38 euros\nCar (5.4 m): 45 euros + 12 euros = 57 euros\nFARE: 133","inTok":241,"outTok":44,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":133},
    {"q":11,"ask":"One adult and a 12-year-old, car 4.2 m long, one outside cabin, sailing on 1 July.","parts":{"passengers":76,"vehicle":45,"cabins":85,"peak":true},"fare":236.25,"direct":{"text":"200","inTok":228,"outTok":3,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult passenger: 38 euros\nChild passenger (12 years old): 19 euros\nCar (4.2 m long): 45 euros\nOutside cabin: 85 euros\nPeak season surcharge (25% on passengers and car): (38 + 19 + 45) * 0.25 = 25 euros\nFARE: 212","inTok":250,"outTok":84,"reasoning":0,"at":"2026-11-13"},"appOld":38,"appNew":212},
    {"q":12,"ask":"Four adults, car 6.0 m long, two inside cabins, sailing on 25 July.","parts":{"passengers":152,"vehicle":57,"cabins":120,"peak":true},"fare":381.25,"direct":{"text":"300","inTok":220,"outTok":3,"reasoning":0,"at":"2026-11-13"},"steps":{"text":"Adult passenger tickets: 4 * 38 euros = 152 euros\nCar ticket (6.0 m): 45 euros + 12 euros = 57 euros\nInside cabins: 2 * 60 euros = 120 euros\nPeak season surcharge (passengers): 152 euros * 0.25 = 38 euros\nPeak season surcharge (vehicle): 57 euros * 0.25 = 14.25 euros\nTotal fare: 152 + 57 + 120 + 38 + 14.25 = 381.25 euros\nFARE: 381.25","inTok":242,"outTok":152,"reasoning":0,"at":"2026-11-13"},"appOld":4,"appNew":381.25}
  ];
  // The fare rules, word for word as in the system prompt of every recording.
  const RULES = [
    "Passenger tickets: adult (12 and over) 38 euros, child aged 4 to 11 19 euros, child under 4 free.",
    "Vehicle: a car up to 5 m long costs 45 euros. A car longer than 5 m costs 45 euros plus 12 euros for each started metre over 5 m. A motorbike costs 20 euros.",
    "Cabin (optional): inside cabin 60 euros, outside cabin 85 euros, per cabin.",
    "Peak season: sailings from 15 June to 31 August. In peak season, passenger tickets and the vehicle charge cost 25% more. Cabins cost the same all year."
  ];
  const ASK_DIRECT = "Reply with the total fare in euros as a number only, nothing else.";
  const ASK_STEPS = "Work it out step by step: write each part of the fare on its own line with its amount. End with one final line in exactly this form:\nFARE: <number>";
  const PEAK = 1.25, CAR_BASE = 45, PER_METRE = 12, ADULT = 38, CHILD = 19;   // from RULES
  // fares.out.txt "parts": how many of the four rules each question touches (ticket, vehicle, cabin, peak)
  const RULES_USED = [1, 2, 3, 3, 4, 3, 4, 2, 2, 2, 4, 4];

  /* ---------- derived from Q ---------- */
  const N = Q.length;
  const same = (a, b) => a != null && Math.abs(a - b) < 0.005;
  const eur = n => Number.isInteger(n) ? String(n) : n.toFixed(2);
  const sum = a => a.reduce((s, x) => s + x, 0);
  const fareOf = p => (p.passengers + p.vehicle) * (p.peak ? PEAK : 1) + p.cabins;
  Q.forEach((q, i) => { if (!same(fareOf(q.parts), q.fare)) throw new Error(`fare mismatch Q${q.q}`); q.rules = RULES_USED[i]; q.dVal = parseFloat(q.direct.text); q.dOk = same(q.dVal, q.fare); q.sOk = same(q.appNew, q.fare); });
  const FIXED = Q.filter(q => !q.dOk && q.sOk), WORSE = Q.filter(q => q.dOk && !q.sOk);
  const BOTH_OK = Q.filter(q => q.dOk && q.sOk), BOTH_BAD = Q.filter(q => !q.dOk && !q.sOk);
  const D_OK = Q.filter(q => q.dOk).length, S_OK = Q.filter(q => q.sOk).length;
  const OUT_D = sum(Q.map(q => q.direct.outTok)), OUT_S = sum(Q.map(q => q.steps.outTok));
  const IN_EXTRA = Math.round(sum(Q.map(q => q.steps.inTok - q.direct.inTok)) / N);
  const RATIO = Math.round(OUT_S / OUT_D);
  const PER_FIX = Math.round((OUT_S - OUT_D) / FIXED.length);
  const REASONING = sum(Q.map(q => q.direct.reasoning + q.steps.reasoning));
  const LONGEST = Q.reduce((a, b) => b.steps.outTok > a.steps.outTok ? b : a), SHORTEST = Q.reduce((a, b) => b.steps.outTok < a.steps.outTok ? b : a);
  const byQ = n => Q.find(q => q.q === n);
  const lines = q => q.steps.text.split("\n");
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const w = n => WORDS[n] || String(n);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const D_MIN = Math.min(...Q.map(q => q.direct.outTok)), D_MAX = Math.max(...Q.map(q => q.direct.outTok));
  const S_LINES = sum(Q.map(q => lines(q).length)), PER_LINE = Math.round(OUT_S / S_LINES);
  // Q7's slip, read from its recorded surcharge line: "(76 + 19 + 0 + 81) * 0.25 = 46.5 euros"
  const Q7_BAD = lines(byQ(7)).findIndex(t => t.startsWith("Peak season surcharge"));
  const Q7_SUM = lines(byQ(7))[Q7_BAD].match(/\(([\d +.]+)\)/)[1];
  const Q7_SLIP = parseFloat(lines(byQ(7))[Q7_BAD].match(/= ([\d.]+) euros$/)[1]);

  /* ---------- lesson-local look ---------- */
  function css() {
    if (document.getElementById(`lx-${ID}`)) return;
    const s = document.createElement("style");
    s.id = `lx-${ID}`;
    s.textContent = `
      .${P}rules { margin: 14px 0 0; padding: 12px 14px 12px 32px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; font-size: 15.5px; color: var(--ink-2); }
      .${P}rules li { margin: 3px 0; }
      .${P}cap { font: 500 12.5px var(--mono); color: var(--muted); margin: 6px 0 0; }
      .${P}ask { margin: 14px 0 0; padding: 10px 14px; border-left: 3px solid var(--ink); background: var(--sunk); font-weight: 600; }
      .${P}reply { margin: 12px 0 0; background: var(--sunk); border: 1px solid var(--line); border-radius: 10px; padding: 8px 0; font: 500 14.5px/1.5 var(--mono); }
      .${P}reply > div, .${P}reply > button { display: block; width: 100%; box-sizing: border-box; text-align: left; padding: 4px 14px; white-space: pre-wrap; word-break: break-word; font: inherit; color: var(--ink); background: none; border: 0; border-left: 3px solid transparent; }
      .${P}reply > button { min-height: 44px; cursor: pointer; border-top: 1px solid var(--line); }
      .${P}reply > button:first-child { border-top: 0; }
      .${P}reply > button:hover { background: var(--surface); }
      .${P}reply .hid { color: var(--faint); }
      .${P}reply .on { border-left-color: var(--ink); background: var(--surface); font-weight: 700; }
      .${P}reply .bad { border-left-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
      .${P}reply .good { border-left-color: var(--good); background: var(--good-soft); }
      .${P}tab { margin: 14px 0 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-variant-numeric: tabular-nums; }
      .${P}tab .r { display: grid; grid-template-columns: 3.2em repeat(3, minmax(0, 1fr)); align-items: center; gap: 4px; padding: 0 12px; min-height: 44px; width: 100%; box-sizing: border-box; border: 0; border-top: 1px solid var(--line); background: var(--bg); color: var(--ink); font: 500 15.5px var(--mono); text-align: right; }
      .${P}tab .r > :first-child { text-align: left; color: var(--muted); }
      .${P}tab .h { border-top: 0; background: var(--surface); font: 600 12.5px var(--font); color: var(--muted); min-height: 40px; line-height: 1.2; }
      .${P}tab button.r { cursor: pointer; }
      .${P}tab button.r:hover { background: var(--surface); }
      .${P}tab .r.found { background: var(--good-soft); }
      .${P}tab .r.miss { background: var(--bad-soft); }
      .${P}tab .ok { color: var(--good); font-weight: 700; }
      .${P}tab .x { color: var(--bad); text-decoration: line-through; }
      .${P}key { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 8px 0 0; font: 500 13.5px var(--mono); color: var(--muted); }
      .${P}key .ok { color: var(--good); font-weight: 700; }
      .${P}key .x { color: var(--bad); text-decoration: line-through; }
      .${P}toks { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; margin: 12px 0 0; }
      .${P}toks span { border: 1px solid var(--line); border-radius: 8px; padding: 6px 4px; text-align: center; font: 600 15px var(--mono); }
      .${P}toks small { display: block; font: 500 11.5px var(--font); color: var(--muted); }
      .${P}big { margin: 14px 0 0; padding-left: 20px; color: var(--ink-2); font-size: 16.5px; }
      .${P}big li { margin: 4px 0; }
      @media (max-width: 480px) { .${P}toks { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    `;
    document.head.appendChild(s);
  }

  /* ---------- small pictures ---------- */
  const rulesBox = kit => `<ul class="${P}rules">${RULES.map(r => `<li>${kit.esc(r)}</li>`).join("")}</ul>`;
  const recCap = at => `<p class="${P}cap">Recorded model output, ${at}</p>`;
  // a recorded reply: plain lines, or tappable lines (pick), with per-line classes
  const reply = (kit, ls, { pick = false, cls = {} } = {}) => `<div class="${P}reply">${ls.map((t, i) => pick
    ? `<button type="button" data-i="${i}" class="${cls[i] || ""}">${kit.esc(t)}</button>`
    : `<div class="${cls[i] || ""}">${kit.esc(t)}</div>`).join("")}</div>`;
  const mark = (v, ok) => `<span class="${ok ? "ok" : "x"}">${eur(v)}</span>`;
  const keyLine = `<div class="${P}key"><span>marks:</span><span class="ok">right fare</span><span class="x">wrong fare</span></div>`;

  /* 1. The situation: the assistant's number-only answer, against the learner's own working. */
  function situation({ el, done, kit }) {
    css();
    const q = byQ(4), p = q.parts, len = 6.3;   // 6.3: the car length in q.ask
    const vFloor = CAR_BASE + PER_METRE * Math.floor(len - 5 + 1e-9), extra = Math.ceil(len - 5 - 1e-9);
    const cands = [
      [p.passengers + p.vehicle + p.cabins, null],
      [(p.passengers + p.vehicle + p.cabins) * PEAK, `That puts the peak rule on every part, cabin included. But 14 June is the day before peak season starts (15 June to 31 August), so nothing gets the 25%. And even in peak season, cabins cost the same all year.`],
      [(p.passengers + p.vehicle) * PEAK + p.cabins, `You left the cabin alone, which is right in peak season. But 14 June is one day before peak season starts on 15 June, so the ticket and the car cost the normal price.`],
      [p.passengers + vFloor + p.cabins, `That charges ${vFloor} for the car: one extra metre. The car is ${len} m, so it is ${(len - 5).toFixed(1)} m over 5 m. The rule counts each <b>started</b> metre, so that is ${extra} extra metres: ${CAR_BASE} + ${extra} × ${PER_METRE} = ${p.vehicle}.`]
    ].sort((a, b) => a[0] - b[0]);
    const correct = cands.findIndex(c => c[1] == null);
    let ans = null;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>A fare assistant that guesses</h1>
        <p class="lead">A ferry company has a chat assistant on its booking page. A customer describes the trip, and the assistant answers with the total fare. The fare rules sit in the assistant's instructions (its system prompt):</p>
        ${rulesBox(kit)}
        <p class="${P}ask">${kit.esc(q.ask)}</p>
        <p class="task">Work out this customer's fare from the rules. Pick the total.</p>
        <div class="lpanel">${kit.options(cands.map(c => eur(c[0])), { picked: ans, correct, num: true })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right: ${p.passengers} for the ticket, ${CAR_BASE} + ${extra} × ${PER_METRE} = ${p.vehicle} for the car (${len} m is ${w(extra)} started metres over 5 m), ${p.cabins} for the cabin, and no peak rule on 14 June. <b>${eur(q.fare)} euros.</b><br>The assistant was told to reply with the number only. A small hosted model answered:
              ${reply(kit, [q.direct.text], { cls: { 0: "bad" } })}${recCap(q.direct.at)}
              That is ${eur(q.fare - q.dVal)} euros short. Four rules, a date check and a “started metre” rule, and the model had to produce the total as its very first word. This lesson is about one prompt change for questions like this: asking the model to write its working first. You will see what it fixes and what it costs.`, true)
          : kit.feedback(cands[ans][1], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. By hand: compare twelve recorded answers with and without steps; find the ones the steps fixed. */
  function compare({ el, done, kit }) {
    css();
    const found = new Set();
    let msg = null, miss = -1;
    const paint = () => {
      const fin = found.size === FIXED.length;
      el.innerHTML = `<h1>Twelve questions, two prompts</h1>
        <p class="lead">The team asked the same model the same ${w(N)} fare questions twice. The rules were the same both times. Only the last instruction changed:</p>
        <p class="${P}cap">Number only</p>${reply(kit, [ASK_DIRECT])}
        <p class="${P}cap">Step by step</p>${reply(kit, ASK_STEPS.split("\n"))}
        <p class="lead" style="margin-top:12px">The table shows the right fare (worked out by code from the rules) and what each prompt answered. For step by step, it is the number on the FARE line.</p>
        <p class="task">Compare the numbers. Tap every question where step by step turned a wrong answer into the right one.</p>
        <div class="${P}tab">
          <div class="r h"><span>Q</span><span>right fare</span><span>number only</span><span>step by step</span></div>
          ${Q.map((q, i) => {
            const show = fin || found.has(i);
            return `<button type="button" class="r${found.has(i) ? " found" : ""}${miss === i ? " miss" : ""}" data-i="${i}" aria-label="Question ${q.q}"><span>Q${q.q}</span><span>${eur(q.fare)}</span><span>${show ? mark(q.dVal, q.dOk) : eur(q.dVal)}</span><span>${show ? mark(q.appNew, q.sOk) : eur(q.appNew)}</span></button>`;
          }).join("")}
        </div>
        ${fin ? keyLine : ""}
        <div class="lpanel">
          <div class="vars"><span>found <b>${found.size} / ${FIXED.length}</b></span></div>
          ${fin ? kit.feedback(`All ${w(FIXED.length)} found. The count for this run: number only got <b>${D_OK} of ${N}</b> right, step by step got <b>${S_OK} of ${N}</b>. ${cap(w(FIXED.length))} got better, ${w(WORSE.length)} got worse, ${w(BOTH_OK.length)} were right both times (Q${BOTH_OK.map(q => q.q).join(", Q")}) and ${w(BOTH_BAD.length)} were wrong both times (Q${BOTH_BAD.map(q => q.q).join(", Q")}). Nothing got worse here, but this is one run of one small model at temperature 0. Always count both directions: a change that fixes some answers can break others.`, true)
            : msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll(`.${P}tab button`).forEach(b => b.onclick = () => {
        if (found.size === FIXED.length) return;
        const i = +b.dataset.i, q = Q[i];
        miss = -1;
        if (found.has(i)) msg = [`Q${q.q} is already counted.`];
        else if (!q.dOk && q.sOk) { found.add(i); msg = [`Q${q.q}: number only said ${eur(q.dVal)}, step by step said ${eur(q.appNew)}, and the right fare is ${eur(q.fare)}. Fixed.`]; }
        else {
          miss = i;
          msg = [q.dOk && q.sOk ? `Q${q.q}: both prompts answered ${eur(q.fare)}, the right fare. Number only was already right, so there was nothing to fix.`
            : !q.dOk && !q.sOk ? `Q${q.q}: the right fare is ${eur(q.fare)}. Step by step said ${eur(q.appNew)}, number only said ${eur(q.dVal)}. The steps changed the answer but did not fix it: both are wrong.`
            : `Q${q.q}: number only was right (${eur(q.dVal)}) and step by step was wrong (${eur(q.appNew)}). That one got worse, not better.`, false];
        }
        paint();
        if (found.size === FIXED.length) done();
      });
    };
    paint();
  }

  /* 3. What the steps cost: predict the output-token ratio from the recorded usage. */
  function cost({ el, done, kit }) {
    css();
    const opts = ["about 2 times", `about ${RATIO} times`, `about ${RATIO * 10} times`];
    const correct = 1;
    let ans = null;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>What the steps cost</h1>
        <p class="lead">Part of what every reply costs is <b>output tokens</b>: the tokens the model writes. Here is how many each number-only reply used, from the recordings:</p>
        <div class="${P}toks">${Q.map(q => `<span>${q.direct.outTok}<small>Q${q.q}</small></span>`).join("")}</div>
        <p class="lead" style="margin-top:12px">In total: <b>${OUT_D}</b> output tokens for ${w(N)} answers. Remember that a step-by-step reply writes each part of the fare on its own line, then a FARE line.</p>
        <p class="task">Predict: in total, how many times more output tokens did the step-by-step replies use?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok ? `${kit.feedback(`Right: <b>${OUT_S}</b> output tokens against ${OUT_D}, about ${RATIO} times more. A number-only reply was ${w(D_MIN)} to ${w(D_MAX)} tokens. The step replies wrote ${S_LINES} lines in all, about ${PER_LINE} tokens per line on average, and each reply wrote several lines.`, true)}
            ${kit.meter([{ label: "Number only", value: OUT_D, max: OUT_S }, { label: "Step by step", value: OUT_S, max: OUT_S }])}
            <p class="${P}cap" style="margin-top:16px">step-by-step output tokens, per question</p>
            ${kit.bars(Q.map(q => q.steps.outTok), { labels: Q.map(q => `Q${q.q}`) })}
            ${kit.feedback(`Three things to read here. <b>Per fix:</b> ${OUT_S - OUT_D} extra tokens bought ${w(FIXED.length)} fixed answers, about ${PER_FIX} extra tokens per answer fixed. <b>Per question:</b> the working grows with the rules a question touches: Q${LONGEST.q} (${w(LONGEST.rules)} rule${LONGEST.rules === 1 ? "" : "s"}) used ${LONGEST.steps.outTok}, Q${SHORTEST.q} (${w(SHORTEST.rules)} rule${SHORTEST.rules === 1 ? "" : "s"}) used ${SHORTEST.steps.outTok}. <b>Time:</b> the model writes tokens one after another, so the customer waits for every line of working before the FARE line appears. The longer instruction also added about ${IN_EXTRA} input tokens to each request.`)}`
          : ans === 0 ? kit.feedback(`Twice as many would mean each step reply is only a few tokens longer than a bare number. But each one writes a line per part of the fare, and a line like "Outside cabin: 85 euros" is several tokens on its own. Look at how short the number-only replies are: almost anything written in full is many times longer.`, false)
          : kit.feedback(`That would be about ${OUT_D * RATIO * 10} tokens, around ${Math.round(OUT_D * RATIO * 10 / N)} per question: whole paragraphs. The step replies are a handful of short lines each, not essays.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: why writing the steps helped. */
  function idea({ el, done, kit }) {
    css();
    const q = byQ(4), p = q.parts;
    const opts = [
      "The words “step by step” switch the model into a more careful mode, so a stronger part of it does the sums.",
      `Each new token is chosen by reading everything already written. With ${p.passengers}, ${p.vehicle} and ${p.cabins} on the page, the last line only adds them.`,
      "The model wrote a first total in its head, checked it against the rules, and corrected it before replying.",
      "The step-by-step prompt is longer, so the model had more information about how the fares work."
    ];
    const correct = 1;
    let ans = null;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>Why did writing steps help?</h1>
        <p class="lead">Back to the question you worked out on screen 1. Same model, same rules, same question:</p>
        <p class="${P}ask">${kit.esc(q.ask)}</p>
        <p class="${P}cap">Number only (right fare: ${eur(q.fare)})</p>${reply(kit, [q.direct.text], { cls: { 0: "bad" } })}
        <p class="${P}cap">Step by step</p>${reply(kit, lines(q), { cls: { [lines(q).length - 1]: "good" } })}${recCap(q.steps.at)}
        <p class="task">Why did the step-by-step reply get this one right?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. A model produces its reply one token at a time, and every new token is computed from the prompt plus everything it has written so far. The number-only reply had to produce ${eur(q.fare)} in its first few tokens, with no room for in-between results. The step reply wrote each part first, then could read them back. The work is split over many tokens instead of squeezed into a few, and each line uses the lines already written. Asking for it is called <b>chain-of-thought prompting</b>. The original paper showed worked examples in the prompt; a later paper found that an instruction alone, “Let's think step by step”, also helped on arithmetic.`, true)
          : ans === 0 ? kit.feedback(`There is no effort switch in this request. Some models can write hidden “reasoning tokens” before the reply you see; the recordings report ${REASONING} of them in total across all ${N * 2} replies. The only difference is what the model was asked to write. The extra accuracy came from the lines it wrote before the total.`, false)
          : ans === 2 ? kit.feedback(`Nothing in the reply was taken back. The model only writes forward: once a token is out, it stays, so a slip in one line stays in every line after it (you will see one on screen 6). Here, each part was simply right the first time, and the total added them.`, false)
          : kit.feedback(`The rules were word for word the same in both prompts. Only the last instruction differed, about ${IN_EXTRA} more input tokens, and it says nothing about fares. What changed is the output: the reply wrote its working before the total.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Use it with predictions: write Q12's working line by line, checked against the recorded reply. */
  function predict({ el, done, kit }) {
    css();
    const q = byQ(12), p = q.parts, L = lines(q);
    const T = q.fare, sP = p.passengers * (PEAK - 1), sV = p.vehicle * (PEAK - 1);
    // line index in L -> [question, right value, [wrong value, why]...]
    const STEPS = [
      [1, "The car is 6.0 m long. What is the car charge?", p.vehicle, [[CAR_BASE, `${CAR_BASE} is the price up to 5 m. A 6.0 m car is 1.0 m over, and that one started metre adds ${PER_METRE}.`], [CAR_BASE + 2 * PER_METRE, `Two extra metres would be for a car longer than 6 m. 6.0 m is exactly 1.0 m over 5 m: one started metre.`]]],
      [2, "Two inside cabins. What do they cost?", p.cabins, [[p.cabins / 2, `That is one cabin. The rule prices cabins per cabin, and there are two.`], [p.cabins * PEAK, `That adds the peak 25% to the cabins. The rules say cabins cost the same all year.`]]],
      [3, "Peak season surcharge (the extra 25%) on the tickets, sailing 25 July. How much is it?", sP, [[0, `25 July is inside peak season (15 June to 31 August), so the tickets cost 25% more.`], [p.passengers * PEAK, `${eur(p.passengers * PEAK)} is the tickets with the surcharge included. This line asks for the surcharge alone: ${p.passengers} × 0.25.`]]],
      [4, "Peak season surcharge on the car. How much is it?", sV, [[CAR_BASE * (PEAK - 1), `That puts 25% on the ${CAR_BASE} base only. The rule raises the whole vehicle charge, extra metre included: ${p.vehicle} × 0.25.`], [p.vehicle * PEAK, `${eur(p.vehicle * PEAK)} is the car charge with the surcharge. This line is the surcharge alone.`]]],
      [5, "Now the total. Every part is on the page.", T, [[T + p.cabins * (PEAK - 1), `That adds 25% on the cabins as well. Cabins cost the same all year.`], [T - p.cabins, `That leaves out the cabins (${p.cabins}). Every line above goes into the total.`]]]
    ];
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === STEPS.length;
      const shownTo = fin ? L.length : STEPS[k][0];
      const ls = L.map((t, i) => i < shownTo ? t : i === shownTo ? "?" : "");
      const cls = {};
      if (!fin) cls[shownTo] = "on";
      else cls[L.length - 1] = "good";
      ls.forEach((t, i) => { if (!t) cls[i] = "hid"; });
      const cur = fin ? null : STEPS[k];
      const vals = fin ? [] : [cur[2], ...cur[3].map(x => x[0])].sort((a, b) => a - b);
      el.innerHTML = `<h1>Write the working yourself</h1>
        <p class="lead">Q${q.q} again: <b>${kit.esc(q.ask)}</b> You fill in the step-by-step reply one line at a time. After each line, the line the model really wrote appears.</p>
        ${rulesBox(kit)}
        ${reply(kit, ls.filter(t => t !== ""), { cls })}
        ${fin ? recCap(q.steps.at) : `<p class="task">${cur[1]}</p>`}
        <div class="lpanel">${fin ? "" : kit.options(vals.map(eur), { picked: wrong == null ? null : vals.indexOf(wrong), correct: vals.indexOf(cur[2]), num: true })}
        ${wrong != null ? kit.feedback(cur[3].find(x => x[0] === wrong)[1], false)
          : fin ? kit.feedback(`Your lines match the model's lines. Notice what each line needed: only the rules and numbers already written above it. The hard part of the question, “what is 25% more on which parts”, became five small steps. That is the whole trick, and it is also why a slip in one line flows straight into the total, as the next screen shows.`, true)
          : k > 0 ? kit.feedback(`The model wrote: <code>${kit.esc(L[STEPS[k - 1][0]])}</code>`) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = vals[+b.dataset.i];
        if (!same(v, cur[2])) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k === STEPS.length) done();
      });
    };
    paint();
  }

  /* 6. Broken on purpose: find the line where Q7's working goes wrong, then pick the fix. */
  function wrongLine({ el, done, kit }) {
    css();
    const q = byQ(7), p = q.parts, L = lines(q);
    const BAD = Q7_BAD, len = 7.2, over = len - 5, extra = Math.ceil(over - 1e-9);   // 7.2: the car length in q.ask
    const base = p.passengers + p.vehicle, rightSur = base * (PEAK - 1);
    const why = [
      `2 adults × ${ADULT} = ${2 * ADULT}. Correct.`,
      `The 9-year-old is a child aged 4 to 11: ${CHILD}. Correct.`,
      `The 3-year-old is under 4, so free. Correct.`,
      `${len} m is ${over.toFixed(1)} m over 5 m: ${w(extra)} started metres, ${CAR_BASE} + ${extra} × ${PER_METRE} = ${p.vehicle}. Correct.`,
      `One outside cabin, ${p.cabins}, with no peak surcharge. Correct.`,
      null,
      `This line adds correctly: the numbers above it do make ${q.appNew}. It is where the error shows, not where it starts. One of the numbers it adds was already wrong.`,
      `This line copies the total from the line above. It is the symptom: the wrong fare the customer sees.`
    ];
    const fixes = [
      "Add “be very careful with the arithmetic” to the step-by-step prompt.",
      "Let the model only read the trip into fields (adults, child ages, car length, cabins, date), and let code compute the fare from the rules.",
      "Go back to the number-only prompt: it is cheaper, and step by step still makes mistakes."
    ];
    let hit = false, miss = -1, fix = null;
    const paint = () => {
      const cls = {};
      if (miss >= 0) cls[miss] = "bad";
      if (hit) cls[BAD] = "bad";
      el.innerHTML = `<h1>Broken on purpose: the wrong line</h1>
        <p class="lead">Step by step still got Q${q.q} wrong: its FARE line says ${eur(q.appNew)}, the right fare is ${eur(q.fare)}.</p>
        <p class="${P}ask">${kit.esc(q.ask)}</p>
        ${reply(kit, L, { pick: !hit, cls })}${recCap(q.steps.at)}
        <p class="task">${hit ? "Now pick the fix." : "Tap the line where the wrong number first appears."}</p>
        <div class="lpanel">
          ${!hit && miss >= 0 ? kit.feedback(why[miss], false) : ""}
          ${hit ? kit.feedback(`That is the cause. The setup is right: ${Q7_SUM} = ${base}, and the rule is to add 25% of it. But ${base} × 0.25 is <b>${eur(rightSur)}</b>, not ${Q7_SLIP}. A slip in plain multiplication, in the middle of reasoning that is otherwise correct. Every line after it inherits the error. The written steps did one useful thing here: they show you exactly where it went wrong.`, true) : ""}
          ${hit ? `<div id="fix">${kit.options(fixes, { picked: fix, correct: 1 })}</div>` : ""}
          ${fix == null ? "" : fix === 1
            ? kit.feedback(`Right. The fare rules are a fixed formula, and code computes a formula the same way every time. The model keeps the part only it can do: reading the customer's words. This would also fix Q11, a different kind of error: there the working charges the 12-year-old as a child, though the rules say adult from 12. With fields, the model writes “age 12” and code applies the age rule. The <code>fare()</code> function in this lesson's run, given those fields, returns ${eur(byQ(11).fare)} for Q11 and ${eur(q.fare)} for Q${q.q}.`, true)
            : fix === 0 ? kit.feedback(`The model was already doing the arithmetic as carefully as it can in words. An instruction cannot make it exact: it still predicts the digits of ${base} × 0.25 as text. It might get this one right next time and slip on another. When the answer is a formula, nothing in the prompt guarantees the sum.`, false)
            : kit.feedback(`Number only got Q${q.q} wrong too (it said ${eur(q.dVal)}), and ${N - D_OK} of ${N} questions overall. Step by step is not perfect, but going back trades ${w(FIXED.length)} fixed answers for a smaller bill.`, false)}
        </div>`;
      el.querySelectorAll(`.${P}reply button`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === BAD) { hit = true; miss = -1; } else miss = i;
        paint();
      });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 1) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: the app's parser still reads the first number in the reply. */
  const CODE_OLD = [
    "def read_fare_old(reply):",
    "    number = r\"\\d+(?:\\.\\d+)?\"",
    "    match = re.search(number, reply)",
    "    if not match:",
    "        return None",
    "    return float(match.group())"
  ];
  const CODE_NEW = [
    "def read_fare(reply):",
    "    fare_lines = []",
    "    for line in reply.splitlines():",
    "        if line.startswith(\"FARE:\"):",
    "            fare_lines.append(line)",
    "    if not fare_lines:",
    "        return None",
    "    last = fare_lines[-1]",
    "    fare_text = last.removeprefix(\"FARE:\")",
    "    return float(fare_text.strip())"
  ];
  function parser({ el, done, kit }) {
    css();
    const q = byQ(3), L = lines(q);
    const FIRST = L.findIndex(t => /\d/.test(t));
    const oldVals = Q.map(x => x.appOld), most = oldVals.filter(v => v === q.appOld).length;
    const odd = Q.filter(x => x.appOld !== q.appOld);
    const fixes = [
      "Take the last number in the reply instead of the first.",
      "Read the number on the line that starts with FARE:, and treat a reply without that line as an error.",
      "Remove “step by step” from the prompt so replies are a bare number again."
    ];
    let hit = false, miss = -1, fix = null;
    const paint = () => {
      const cls = {};
      if (miss >= 0) cls[miss] = "bad";
      if (hit) cls[FIRST] = "bad";
      el.innerHTML = `<h1>Broken on purpose: almost every fare is ${eur(q.appOld)}</h1>
        <p class="lead">The team ships the step-by-step prompt. Next morning, support reports that the booking page quotes almost every customer ${eur(q.appOld)} euros. The prompt was changed; the app code that reads the reply was not. It was written when replies were a bare number:</p>
        ${kit.code(CODE_OLD, 2)}
        <p class="lead" style="margin-top:12px"><code>re.search</code> scans the text from the start and returns the first match. Here is the recorded step reply to Q${q.q}:</p>
        ${reply(kit, L, { pick: !hit, cls })}${recCap(q.steps.at)}
        <p class="task">${hit ? "Now pick the fix." : "Tap the line the app takes its number from."}</p>
        <div class="lpanel">
          ${!hit && miss >= 0 ? kit.feedback(miss === L.length - 1
              ? `That is where the fare is, and where you would look. But <code>re.search</code> does not look for the fare; it returns the first thing in the text that looks like a number, scanning from the top.`
              : `This line has numbers, but an earlier line has one too. <code>re.search</code> stops at the very first match from the top of the text.`, false) : ""}
          ${hit ? kit.feedback(`Right: “38” in the first line, the price of one adult ticket. We ran both parsers on all ${N} recorded step replies. The old one returned ${eur(q.appOld)} for ${most} of them${odd.length ? `, and ${odd.map(x => `${eur(x.appOld)} for Q${x.q} (its first line starts “${kit.esc(lines(x)[0].slice(0, 26))}…”)`).join(", ")}` : ""}. The model's answers were fine; the app showed the wrong number. Testing the prompt by reading replies in a chat window does not catch this: test the whole path, from prompt to the number the app shows.`, true)
            + `<div id="fix">${kit.options(fixes, { picked: fix, correct: 1 })}</div>` : ""}
          ${fix == null ? "" : fix === 1
            ? `${kit.feedback(`Right. Agree on a marker in the prompt, read only that. When it is missing, <code>read_fare</code> returns <code>None</code>, and the app must treat that as an error and show one, never a guessed fare. Run on the same ${N} replies, this parser returned the FARE number every time, so the app's accuracy became the model's: ${S_OK} of ${N}.`, true)}${kit.code(CODE_NEW, -1)}`
            : fix === 0 ? kit.feedback(`It works on these replies only by luck: each one happens to end with the fare. A reply that ends “FARE: 175.00 euros for the 20 July sailing” gives back 20. The parser needs to find the answer by a marker you asked for, not by position.`, false)
            : kit.feedback(`That throws away the ${w(FIXED.length)} fixed answers to save one parser change. The bug is in the code that reads the reply, so fix it there.`, false)}
        </div>`;
      el.querySelectorAll(`.${P}reply button`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === FIRST) { hit = true; miss = -1; } else miss = i;
        paint();
      });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs; pick the situation that calls for it. */
  function bigPicture({ el, done, kit }) {
    css();
    const opts = [
      "A search box suggests the next word while the user types. Each suggestion must appear at once.",
      "A support inbox tags each email as billing, bug or other, ten thousand emails a day.",
      "A clinic assistant reads a patient's message and the clinic's three rules for same-day visits, and must decide whether all three rules are met and say which one fails."
    ];
    const correct = 2;
    let ans = null;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>When to ask for steps</h1>
        <ul class="${P}big">
          <li><b>What it is for:</b> questions where the answer needs several steps that build on each other: combining rules, multi-step arithmetic, checking several conditions.</li>
          <li><b>When not:</b> a single lookup or label (nothing to build on); a fixed formula (compute it in code); a reply that must appear at once; a model that already reasons on its own before it answers, where the model makers' guides say this instruction may not help.</li>
          <li><b>What it costs:</b> many times more output tokens, a longer wait, app code that must find the answer inside the reply, and working that can still be wrong.</li>
        </ul>
        <p class="task">Which one of these calls for asking the model to reason step by step?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. Three conditions, each to check against the message, and a final answer that depends on all of them: that is several steps building on each other. The written working also tells staff which rule failed. Here the wait and the tokens are worth it.`, true)
          : ans === 0 ? kit.feedback(`Time is the cost that bites first here. Every token of working is written before the suggestion can appear, and the user has typed the next letter by then. Predicting one next word is not a many-step problem anyway.`, false)
          : kit.feedback(`One label per email, with nothing to build on: the working adds tokens on every one of ten thousand emails a day, without a chain of steps for it to help. If tagging is wrong, better examples (the few-shot lesson) are the first thing to try.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, with "no" cases that name why. */
  const CASES = [
    ["A maths tutoring app must check a student's answer to a three-step word problem and say at which step the student went wrong.", true,
      "Yes. Several steps that build on each other, and the model's own working gives it the in-between results to compare with the student's.",
      "This is the case steps are for: three steps, each using the last result, and the point is to find the step that differs. A bare yes or no throws away exactly what the app needs."],
    ["A shop converts each basket total from one currency to another at today's rate.", false,
      `No. One multiplication by a known rate. Do it in code: it is exact, instant and free. A model's working could still slip on the digits, as Q7's ${Q7_SLIP} did.`,
      `One multiplication by a known rate is a fixed formula. Code does it exactly, instantly and for free. A model writing out the working adds tokens and can still slip on the digits, as Q7's ${Q7_SLIP} did.`],
    ["The team uses a model that already reasons on its own before answering (a “reasoning” or “thinking” model), and adds “think step by step” to every prompt to be safe.", false,
      "No. The model already reasons before it answers, and you pay for those hidden reasoning tokens as output. OpenAI's guide for its reasoning models says this instruction may not help and can sometimes hurt. Use the model's own setting for how much it thinks instead.",
      "This model already reasons before it answers, and those reasoning tokens are billed as output even when you never see them. OpenAI's guide for its reasoning models says “think step by step” may not help and can sometimes hurt. Tune the model's own setting for how much it thinks instead."],
    ["An insurance assistant reads a claim and must decide which of four policy exclusions apply, in a reply that staff will check.", true,
      "Yes. Each exclusion is a condition to check against the claim, and the decision depends on all four. The written working is also what staff will check. Ask for a marked final line so the app can read the decision.",
      "Four conditions to check, and a decision that depends on all of them, is a chain of steps. The working also gives staff something to check. Keep a marked final line so the app reads the decision, not the first word."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would you ask for steps here?</h1>
        <p class="lead">${cap(w(CASES.length))} situations without ferries. Asking for steps means the prompt tells the model to write its working before a marked final answer.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (in-page practice: the lesson was the practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can now say</h1>
      <ul class="${P}big">
        <li>Asking a model to write its working first can raise accuracy on many-step questions: here from ${D_OK} to ${S_OK} right out of ${N}.</li>
        <li>It works because each token is written by reading everything before it, so in-between results on the page feed the next line.</li>
        <li>It costs many times more output tokens (${RATIO} times here) and a longer wait. Before you ship it, count fixes and breaks on your own questions.</li>
        <li>Read the answer from a marked final line. For a fixed formula, let code do the sum.</li>
      </ul>
      ${nx ? `<p class="lead" style="margin-top:16px">Next: <b>${kit.esc(nx.title)}</b>. The fix you picked on screen 6, where the model fills in fields and code does the sum, needs replies in a shape your code can rely on. That lesson shows how to get them.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Asking for reasoning steps, and what it costs",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/2201.11903",
      "https://arxiv.org/abs/2205.11916",
      "https://developers.openai.com/api/docs/guides/reasoning-best-practices",
      "https://developers.openai.com/api/docs/guides/latency-optimization",
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
      "https://platform.claude.com/docs/en/build-with-claude/extended-thinking",
      "https://openrouter.ai/docs/use-cases/reasoning-tokens"
    ],
    interview: [{
      q: "A pricing assistant gets about a third of multi-rule quotes wrong. A colleague wants to add “think step by step” to the prompt and ship it today. What do you do?",
      good: [
        "Run both prompts on a labelled set of real quotes and count fixes and breaks, not only the overall score",
        "Measure the cost: output tokens and response time per request go up, and that is paid on every request",
        "Change the parser at the same time: ask for a marked final line and read only that, failing loudly when it is missing",
        "Read the wrong replies: an arithmetic slip means the formula belongs in code, with the model only extracting the fields",
        "If the model already reasons internally, use its own reasoning setting instead of the prompt line"
      ],
      weak: "“Step by step always improves accuracy, so add it.” This skips measuring on real cases, ignores the token and latency cost, and misses that the app's parser may read the wrong number."
    }],
    screens: [situation, compare, cost, idea, predict, wrongLine, parser, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="0"]'], right: Q.map((q, i) => (!q.dOk && q.sOk) ? `[data-i="${i}"]` : null).filter(Boolean) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(5).fill("[data-right]") },
      { wrong: ['[data-i="6"]'], right: ['[data-i="5"]', "#fix [data-right]"] },
      { wrong: ['[data-i="6"]'], right: ['[data-i="0"]', "#fix [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
