/* Lesson s6-data-pipeline: a data pipeline from logs to a retraining set.
   Story: Hollin Appliance Repair (invented) wants to use six months of its troubleshooting assistant's chat logs
   to improve the assistant. The learner cleans 12 lines of a 50-line batch by hand (one or more of every
   kind of fault), counts what the stage-5 redactor missed in the whole batch, then sees the same rules as an ordered, counted, re-runnable pipeline.
   Ideas: (1) a data pipeline is the cleaning rules you applied by hand, written as stages in a fixed order, each
   one counting what it removed (parse, keep successful customer turns, drop exact copies, drop near copies,
   redact, write chat examples); (2) order matters: deduplicate before you split train and eval, or copies
   land on both sides. Depth: explain (screens 1-3, 8, interview), scratch (screens 4-5: the from-scratch
   pipeline in Python and NumPy, from a real traced run), debug (screen 6: split-before-dedup, real run),
   when-not (screens 8-9).
   Data, all real:
   - docs/ai-path/runs/s6-data-pipeline/data.py: the invented accounts and customer messages;
   - recordings (main checkout) docs/ai-path/recordings/s6-data-pipeline/reply-<key>.json: the assistant's 43
     replies, one real model call each (record_replies.py wrote the requests), copied into replies.json;
   - make_log.py -> logs.jsonl: the 50-line batch (retried writes, retypes, staff tests, time-outs and cut
     lines put in on purpose);
   - pipeline.py -> pipeline.out.txt: the traced build_set run, stage removals, pair similarities, the
     stage-5 redactor (redactor.py, copied unchanged from ../s5c-personal-data/redactor.py) on every kept row, and the
     split-before-dedup run (seed 7) with its fix.
   The constants below were generated from logs.jsonl and pipeline.out.txt (replies trimmed with … only).
   Lesson-local style: pickable log rows, redacted-text marks and wrapped code lines at phone width
   (.lx-s6-data-pipeline-*), see ensureStyle(). */
(() => {
  const ID = "s6-data-pipeline";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs (generated from logs.jsonl and pipeline.out.txt) ---------- */
  // LOG rows: [line, account, status, user, reply (recorded model output, trimmed with …)] or [line, raw text] for a cut line.
  // RED rows: [line, redacted user, redacted reply (trimmed with …), [[piece, kind, "user"|"reply", missed]]].
  // TRACE: build_set traced: [line about to run, event, len(rows)]. PAIRS: [keys, text a, text b, cosine].
  // BAD_LOG / BAD_CROSS: the split-before-dedup run; FIXED: the same split after deduplicating.
  const LOG = [[1,"C-112","ok","My dishwasher shows error E24 and there is water left in the bottom.","The E24 error code on your dishwasher typically indicates a …"],[2,"C-101","ok","Hi, this is Megan Hale, my washing machine stops mid-cycle and beeps three times.","Hello Megan, a three-beep error on your washing machine often …"],[3,"C-106","ok","Fridge is making a loud buzzing noise since yesterday.","A loud buzzing noise from your fridge could be caused by a few …"],[4,"C-102","ok","Can a technician come to 22 Rowan Street on Friday? The oven door won't close.","I can check our technician's availability for 22 Rowan Street …"],[5,"C-109","ok","My tumble dryer runs but the clothes come out damp.","It sounds like your tumble dryer might not be heating properly …"],[6,"{\"ts\": \"2026-05-10T07:47:45\", \"session\": \"s-1035\", \"account\": \"C-104\", \"status\": \"ok\", \"user\": \"My oven door glass has a crack, is it safe to"],[7,"C-110","ok","Call me back on 07700 900 482 please, the freezer is thawing.","I'm sorry to hear your freezer is thawing. Please ensure the …"],[8,"C-103","ok","It's Tom again, the engineer never showed up to fix the cooker.","I'm very sorry to hear the engineer didn't attend your cooker …"],[9,"C-105","ok","Washer won't drain, water just sits in the drum.","First, check if the drain hose is kinked or blocked. Ensure the …"],[10,"STAFF","ok","test","Hello! I'm here to help with your appliance issue. Please tell …"],[11,"C-104","ok","Please email the invoice to r.osei@example.net thanks.","I can help with that! Please confirm the invoice number you'd …"],[12,"C-111","ok","The induction hob shows F7 and switches off.","An F7 error code on your induction hob usually indicates an …"],[13,"C-111","ok","The induction hob shows F7 and switches off.","An F7 error code on your induction hob usually indicates an …"],[14,"C-105","ok","My landline is 020 7946 0371 as mobile signal is bad here. The dishwasher leaks from the door.","Please ensure the dishwasher door is fully closed and the seal …"],[15,"C-108","ok","Is it safe to use the oven if the fan is noisy?","A noisy oven fan can sometimes indicate a problem that could …"],[16,"C-104","error","The oven light bulb blew, which bulb do I buy?",""],[17,"C-106","ok","My neighbour Alan Pryce has the same fridge and his works fine. Mine is warm inside.","I'm sorry to hear your fridge isn't keeping cool. Please check …"],[18,"C-112","ok","my dishwasher shows error E24 and theres water left in the bottom!!","The E24 error code on your dishwasher typically indicates a …"],[19,"C-110","ok","Microwave sparks when I heat soup in a ceramic bowl.","Please ensure there are no metal components in the microwave, …"],[20,"C-102","ok","My postcode is SE15 4QL, do you cover my area?","Yes, Hollin Appliance Repair covers the SE15 4QL area. Before …"],[21,"C-109","ok","The ice maker in my fridge freezer stopped making ice.","First, check if the ice maker is switched on and if the water …"],[22,"C-107","ok","My number is 07700-900-615, text me when the part arrives.","I can help with that! Please confirm the make and model of your …"],[23,"{\"ts\": \"2026-06-05T20:01:23\", \"session\": \"s-1154\", \"account\": \"C-108\", \"status\": \"ok\", \"user\": \"The washing machine drum won't turn but the"],[24,"C-111","ok","Washing machine smells bad even after a hot wash.","A persistent bad smell in your washing machine can be caused by …"],[25,"C-104","ok","Dryer makes a squeaking noise when it spins.","A squeaking dryer often indicates worn-out drum rollers or a …"],[26,"C-103","ok","We're at the blue house behind the Co-op on Station Road, and the cooker clock keeps resetting.","Please try unplugging the cooker for 5 minutes and then …"],[27,"C-108","ok","Dishwasher doesn't dry the plates anymore.","First, check if the rinse aid dispenser is full and if the …"],[28,"C-112","ok","Fridge light is on but it isn't cooling.","It sounds like your fridge might have a faulty compressor or a …"],[29,"C-105","ok","washer wont drain - water just sits in the drum","First, check if the drain hose is kinked or blocked. Ensure the …"],[30,"C-106","ok","How do I reset the oven clock after a power cut?","To reset your oven clock after a power cut, you'll typically …"],[31,"C-101","ok","Hi it's megan hale again, still waiting for the drum bearing part.","Hello Megan, I'm sorry to hear you're still waiting for the …"],[32,"C-107","ok","My washer shakes the whole floor on spin.","It sounds like your washing machine might be unbalanced or the …"],[33,"C-110","ok","The cooker hood fan won't turn off.","Please try unplugging the cooker hood for a few minutes and …"],[34,"C-112","error","Can I run the dishwasher with a cracked spray arm?",""],[35,"C-108","ok","Can you send the engineer's report to priya.n@example.org please?","I can't directly send engineer's reports to email addresses. …"],[36,"C-104","ok","My kettle switches off before it boils.","It sounds like your kettle might be faulty. Before booking a …"],[37,"C-111","ok","Freezer has frost building up on the back wall.","A buildup of frost on the back wall of your freezer can …"],[38,"C-112","ok","fridge light is on but it isnt cooling","It's possible the fridge's compressor isn't running, or there's …"],[39,"C-112","ok","Gas hob igniter clicks but the burner won't light.","First, ensure the gas supply is on and check if the igniter is …"],[40,"C-109","ok","What does code H20 mean on my washing machine?","The H20 error code on your washing machine typically indicates …"],[41,"STAFF","ok","testing 123 please ignore","No problem, I'm here to help if you have any appliance issues. …"],[42,"C-109","ok","My dad Joseph Okoro lives at Flat 3, 41 Hythe Road and his fridge is warm. Can you visit him?","I'm sorry to hear about the issue with Mr. Okoro's fridge. …"],[43,"C-103","ok","Dishwasher won't start and all the lights flash.","A flashing light pattern often indicates a fault code. Please …"],[44,"{\"ts\": \"2026-07-07T15:23:26\", \"session\": \"s-1301\", \"account\": \"C-102\", \"status\": \"ok\", \"user\": \"My fridge freezer is iced up and the"],[45,"C-107","ok","Tumble dryer filter light stays on after I clean the filter.","It's frustrating when the tumble dryer filter light stays on! …"],[46,"C-111","ok","Mobile +44 7700 900 288. The oven trips the electrics when I turn it on.","It sounds like your oven may have an electrical fault. Please …"],[47,"C-101","ok","Washing machine door is locked and won't open after the cycle.","It's common for washing machine doors to remain locked for a …"],[48,"C-102","ok","Is the warranty still valid on a fridge I bought 18 months ago?","Most refrigerators come with a 12-month manufacturer's …"],[49,"C-102","ok","Is the warranty still valid on a fridge I bought 18 months ago?","Most refrigerators come with a 12-month manufacturer's …"],[50,"C-110","ok","Washing machine won't drain after the rinse.","First, check if the drain hose is kinked or blocked. Ensure the …"]];
  const BROKEN = [[6,"Unterminated string starting at: line 1 column 96 (char 95)"],[23,"Unterminated string starting at: line 1 column 96 (char 95)"],[44,"Unterminated string starting at: line 1 column 96 (char 95)"]];
  const REMOVED = {"status/staff":[10,16,34,41],"exact":[13,29,49],"near":[18,38]};
  const KEPT = [1,2,3,4,5,7,8,9,11,12,14,15,17,19,20,21,22,24,25,26,27,28,30,31,32,33,35,36,37,39,40,42,43,45,46,47,48,50];
  const RED = [[2,"Hi, this is [NAME_1], my washing machine stops mid-cycle and beeps three times.","Hello Megan, a three-beep error on your washing machine often indicates a drainage issue.",[["Megan Hale","NAME","user",false],["Megan","NAME","reply",true]]],[4,"Can a technician come to [ADDRESS_1] on Friday? The oven door won't close.","I can check our technician's availability for [ADDRESS_1] on Friday.",[["22 Rowan Street","ADDRESS","user",false],["22 Rowan Street","ADDRESS","reply",false]]],[7,"Call me back on [PHONE_1] please, the freezer is thawing.","I'm sorry to hear your freezer is thawing. …",[["07700 900 482","PHONE","user",false]]],[8,"It's Tom again, the engineer never showed up to fix the cooker.","I'm very sorry to hear the engineer didn't attend your cooker repair, Tom.",[["Tom","NAME","user",true],["Tom","NAME","reply",true]]],[11,"Please email the invoice to [EMAIL_1] thanks.","Once I have that, I'll email it to [EMAIL_1].",[["r.osei@example.net","EMAIL","user",false],["r.osei@example.net","EMAIL","reply",false]]],[14,"My landline is 020 7946 0371 as mobile signal is bad here. The dishwasher leaks from the door.","Please ensure the dishwasher door is fully closed and the seal is clean and free of debris. …",[["020 7946 0371","PHONE","user",true]]],[17,"My neighbour Alan Pryce has the same fridge and his works fine. Mine is warm inside.","I'm sorry to hear your fridge isn't keeping cool. …",[["Alan Pryce","NAME","user",true]]],[20,"My postcode is [POSTCODE_1], do you cover my area?","Yes, Hollin Appliance Repair covers the [POSTCODE_1] area.",[["SE15 4QL","POSTCODE","user",false],["SE15 4QL","POSTCODE","reply",false]]],[22,"My number is 07700-900-615, text me when the part arrives.","I can help with that! …",[["07700-900-615","PHONE","user",true]]],[26,"We're at the blue house behind the Co-op on Station Road, and the cooker clock keeps resetting.","Please try unplugging the cooker for 5 minutes and then plugging it back in. …",[["the blue house behind the Co-op on Station Road","ADDRESS","user",true]]],[31,"Hi it's [NAME_1] again, still waiting for the drum bearing part.","Hello Megan, I'm sorry to hear you're still waiting for the drum bearing part.",[["megan hale","NAME","user",false],["Megan","NAME","reply",true]]],[35,"Can you send the engineer's report to [EMAIL_1] please?","I can't directly send engineer's reports to email addresses. …",[["priya.n@example.org","EMAIL","user",false]]],[42,"My dad Joseph Okoro lives at Flat 3, 41 Hythe Road and his fridge is warm. Can you visit him?","I'm sorry to hear about the issue with Mr. Okoro's fridge. … If the problem persists, we can book a technician to visit him at Flat 3, 41 Hythe Road.",[["Joseph Okoro","NAME","user",true],["Flat 3, 41 Hythe Road","ADDRESS","user",true],["Okoro","NAME","reply",true],["Flat 3, 41 Hythe Road","ADDRESS","reply",true]]],[46,"Mobile [PHONE_1]. The oven trips the electrics when I turn it on.","It sounds like your oven may have an electrical fault. …",[["+44 7700 900 288","PHONE","user",false]]]];
  const TRACE = [[1,"l",null],[2,"l",47],[3,"l",43],[4,"l",40],[5,"l",38],[6,"l",38],[6,"r",38]];
  const EXAMPLES = 38;
  const PAIRS = [["e24/e24b","My dishwasher shows error E24 and there is water left in the bottom.","my dishwasher shows error E24 and theres water left in the bottom!!",0.958],["drain/drainb","Washer won't drain, water just sits in the drum.","washer wont drain - water just sits in the drum",1],["cool/coolb","Fridge light is on but it isn't cooling.","fridge light is on but it isnt cooling",1],["drain/rinse","Washer won't drain, water just sits in the drum.","Washing machine won't drain after the rinse.",0.486],["dry/flash","Dishwasher doesn't dry the plates anymore.","Dishwasher won't start and all the lights flash.",0.375],["stops/locked","Hi, this is Megan Hale, my washing machine stops mid-cycle and beeps three times.","Washing machine door is locked and won't open after the cycle.",0.404]];
  const HIGHEST_OTHER = ["Washing machine door is locked and won't open after the cycle.","Washing machine won't drain after the rinse.",0.632];
  const BAD_LOG = [["read",50],["parsed",47],["ok customer turns",43],["split train",34],["split eval",9],["dedup train",32],["dedup eval",8],["eval rows with a near copy in train",2]];
  const BAD_CROSS = [["The induction hob shows F7 and switches off.","The induction hob shows F7 and switches off.",1],["Is the warranty still valid on a fridge I bought 18 months ago?","Is the warranty still valid on a fridge I bought 18 months ago?",1]];
  const FIXED = {"train":30,"eval":8,"cross":[]};
  const COPY_OF = {"13":[12,1],"18":[1,0.958],"29":[9,1],"38":[28,1],"49":[48,1]};
  const EXAMPLE = {"messages":[{"role":"user","content":"Hi, this is [NAME_1], my washing machine stops mid-cycle and beeps three times."},{"role":"assistant","content":"Hello Megan, a three-beep error on your washing machine often indicates a drainage issue. Please check that the drain hose isn't kinked or blocked, and ensure the filter is clear of any debris. If the problem persists after these checks, it may require a technician to diagnose further. Would you like me to book a service visit for you?"}]};
  const REC = { src: "s6-data-pipeline/reply-<key>", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14" };
  const THRESHOLD = 0.8; // drop_near threshold in pipeline.py
  // Screen 1 shows these 12 of the 50 lines: every kind of fault (a cut line, a failed turn, a staff test, a
  // retried write, a retype that is an exact copy after norm, a retype only drop_near catches) and six keepers,
  // including a line with personal data and a different question with the same reply as another line.
  const SAMPLE = [1, 6, 7, 9, 10, 12, 13, 16, 18, 19, 29, 50];
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;

  // Listings, line for line from docs/ai-path/runs/s6-data-pipeline/pipeline.py
  const CODE = [
    "def build_set(lines, accounts):",
    "    rows = parse(lines)",
    "    rows = [r for r in rows if r[\"status\"] == \"ok\" and r[\"account\"] != \"STAFF\"]",
    "    rows = drop_exact(rows)",
    "    rows = drop_near(rows, threshold=0.8)",
    "    rows = [redact_row(r, accounts[r[\"account\"]]) for r in rows]",
    "    return [to_example(r) for r in rows]"
  ];
  const CODE_NEAR = [
    "def similarities(texts):",
    "    vecs = np.array([trigram_vector(t) for t in texts])",
    "    vecs = vecs / np.linalg.norm(vecs, axis=1, keepdims=True)",
    "    return vecs @ vecs.T",
    "",
    "def drop_near(rows, threshold):",
    "    sims = similarities([r[\"user\"] for r in rows])",
    "    keep = []",
    "    for i in range(len(rows)):",
    "        if all(sims[i, j] < threshold for j in keep):",
    "            keep.append(i)",
    "    return [rows[i] for i in keep]"
  ];

  /* ---------- Derived from the data ---------- */
  const isCut = r => r.length === 2;
  const CUT = LOG.filter(isCut).map(r => r[0]);
  const FAILED = LOG.filter(r => !isCut(r) && r[2] !== "ok").map(r => r[0]);
  const STAFF = LOG.filter(r => !isCut(r) && r[2] === "ok" && r[1] === "STAFF").map(r => r[0]);
  const COPIES = Object.keys(COPY_OF).map(Number);           // the later copy of each pair
  const PAIR_OF = n => COPIES.includes(n) ? COPY_OF[n][0] : (COPIES.find(c => COPY_OF[c][0] === n) || null);
  const DROP_FIXED = [...CUT, ...FAILED, ...STAFF];
  const N_DROP = DROP_FIXED.length + COPIES.length;
  const PII_LINES = RED.map(r => r[0]);
  const ALL_PIECES = RED.flatMap(r => r[3]);
  const MISSED = ALL_PIECES.filter(p => p[3]);
  const MISSED_REPLY = MISSED.filter(p => p[2] === "reply");
  const LEAKY = RED.filter(r => r[3].some(p => p[3])).map(r => r[0]);
  const after = k => TRACE[k][2];                             // len(rows) after listing line k ran
  const row = n => LOG.find(r => r[0] === n);
  const inSample = n => SAMPLE.includes(n);
  const S_LOG = LOG.filter(r => inSample(r[0]));
  const S_CUT = CUT.filter(inSample), S_FAILED = FAILED.filter(inSample), S_STAFF = STAFF.filter(inSample);
  const S_COPIES = COPIES.filter(c => inSample(c) && inSample(COPY_OF[c][0]));
  const S_DROP = [...S_CUT, ...S_FAILED, ...S_STAFF].length + S_COPIES.length;
  const RETRIED = COPIES.filter(c => row(c)[3] === row(COPY_OF[c][0])[3]);  // same message logged twice
  const RETYPED = COPIES.filter(c => !RETRIED.includes(c));                 // the customer typed it again
  const SAME_REPLY = (() => {                                  // a kept line whose reply equals another's, question different
    for (const a of LOG) for (const b of LOG)
      if (!isCut(a) && !isCut(b) && a[0] < b[0] && a[4] === b[4] && a[4] && PAIR_OF(b[0]) !== a[0] && !COPIES.includes(b[0])) return [a[0], b[0]];
    return null;
  })();

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-rows { margin: 14px 0 0; display: grid; gap: 6px; }
      .lx-${ID}-row { display: grid; grid-template-columns: 2.6em 1fr; gap: 2px 10px; width: 100%; min-height: 44px; padding: 8px 10px;
        text-align: left; background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; font: inherit; cursor: pointer; }
      .lx-${ID}-row[aria-pressed="true"] { background: var(--sunk); border: 2px solid var(--ink); }
      .lx-${ID}-drop .lx-${ID}-row[aria-pressed="true"] .lx-${ID}-txt { text-decoration: line-through; color: var(--muted); }
      .lx-${ID}-n { font: 600 13px/1.5 var(--mono); color: var(--muted); }
      .lx-${ID}-txt { min-width: 0; font-size: 14.5px; line-height: 1.45; overflow-wrap: anywhere; }
      .lx-${ID}-meta { font: 500 12.5px/1.5 var(--mono); color: var(--muted); }
      .lx-${ID}-raw { font: 500 13px/1.5 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-rep { color: var(--ink-2); }
      .lx-${ID}-who { font: 600 12px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-right: 6px; }
      .lx-${ID}-miss { text-decoration: underline 2px var(--bad); text-underline-offset: 3px; font-weight: 600; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-log { margin: 14px 0 0; display: grid; gap: 6px; }
      .lx-${ID}-logline { width: 100%; min-height: 44px; padding: 8px 12px; text-align: left; font: 500 14px/1.45 var(--mono);
        background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; cursor: pointer; }
      .lx-${ID}-logline.lx-${ID}-on { border: 2px solid var(--ink); }
      .lx-${ID}-pre { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 6px; font: 500 13px/1.55 var(--mono);
        white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-check { margin-top: 12px; min-height: 44px; }
      @media (max-width: 620px) { .lx-${ID}-code .lcode { font-size: 12px; } .lx-${ID}-code .lcode div { padding: 0 10px 0 calc(10px + 6ch); text-indent: -6ch; white-space: pre-wrap; overflow-wrap: anywhere; } }
    `;
    document.head.appendChild(s);
  }
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const lineList = ns => ns.length === 1 ? `line ${ns[0]}` : `lines ${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
  // mark the missed pieces in a redacted text
  function markMissed(kit, text, pieces) {
    let html = kit.esc(text);
    for (const p of pieces) html = html.split(kit.esc(p)).join(`<span class="lx-${ID}-miss">${kit.esc(p)}</span>`);
    return html;
  }

  /* 1. The situation, and the slow way: clean fifty log lines by hand. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const marked = new Set();
    let verdict = null;
    const check = () => {
      const wrong = [...marked].filter(n => !DROP_FIXED.includes(n) && PAIR_OF(n) == null);
      const both = S_COPIES.filter(c => marked.has(c) && marked.has(COPY_OF[c][0]));
      const missCut = S_CUT.filter(n => !marked.has(n)), missFail = S_FAILED.filter(n => !marked.has(n)), missStaff = S_STAFF.filter(n => !marked.has(n));
      const missCopy = S_COPIES.filter(c => !marked.has(c) && !marked.has(COPY_OF[c][0]));
      if (!wrong.length && !both.length && !missCut.length && !missFail.length && !missStaff.length && !missCopy.length) return { ok: true };
      const say = [];
      for (const n of wrong.slice(0, 2)) {
        if (SAME_REPLY && n === SAME_REPLY[1]) say.push(`Line ${n} has word for word the same reply as line ${SAME_REPLY[0]}, but the customer asked something different. Two different questions are two useful examples. Keep it.`);
        else if (PII_LINES.includes(n)) say.push(`Line ${n} contains personal data, but that is a job for the redactor on the next screen. The turn itself is complete and useful. Keep it.`);
        else say.push(`Line ${n} is a complete, successful customer turn that appears once. Keep it.`);
      }
      if (wrong.length > 2) say.push(`${plural(wrong.length - 2, "more marked line")} like that.`);
      for (const c of both) say.push(`You marked both line ${COPY_OF[c][0]} and line ${c}. They are the same turn twice: drop one copy, keep the other.`);
      const miss = [];
      if (missCut.length) miss.push(plural(missCut.length, "line") + " cut off mid-write");
      if (missFail.length) miss.push(plural(missFail.length, "turn") + " that failed");
      if (missStaff.length) miss.push(plural(missStaff.length, "staff test"));
      if (missCopy.length) miss.push(plural(missCopy.length, "repeat") + " (the same turn logged again, or a customer retyping)");
      if (miss.length) say.push(`Still in the set: ${miss.join(", ")}.`);
      return { ok: false, html: say.join(" ") };
    };
    const rowHtml = r => {
      const on = marked.has(r[0]);
      const body = isCut(r)
        ? `<span class="lx-${ID}-raw">${kit.esc(r[1])}</span>`
        : `<span class="lx-${ID}-meta">${kit.esc(r[1])} · ${kit.esc(r[2])}</span><br><span class="lx-${ID}-who">customer</span>${kit.esc(r[3])}<br><span class="lx-${ID}-rep"><span class="lx-${ID}-who">assistant</span>${r[4] ? kit.esc(r[4]) : "<i>(empty)</i>"}</span>`;
      return `<button type="button" class="lx-${ID}-row" data-i="${r[0]}" aria-pressed="${on}"><span class="lx-${ID}-n">${r[0]}</span><span class="lx-${ID}-txt">${body}</span></button>`;
    };
    const paint = () => {
      el.innerHTML = `<h1>${S_LOG.length} lines of chat logs</h1>
        <p class="lead">Hollin Appliance Repair runs a troubleshooting assistant: customers describe a broken washer or fridge, and a language model answers. The company wants to use six months of these chat logs to train a better assistant. This lesson is the step in between: turning raw, messy logs into a clean training set.</p>
        <p class="lead">Here are ${S_LOG.length} lines from one batch of ${LOG.length}. Each line is one <b>turn</b>: one customer message and the assistant's reply. Each shows the account, the status (<code>ok</code>, or <code>error</code> when no reply came), the message and the start of the reply.</p>
        <p class="task">Tap every line that should <b>not</b> go into a training set: lines cut off in the middle, turns that failed, staff tests (account STAFF), and repeats (keep one copy). Then press Check.</p>
        <div class="lx-${ID}-rows lx-${ID}-drop">${S_LOG.map(rowHtml).join("")}</div>
        <p class="lx-${ID}-cap">The assistant replies are ${CAPTION.toLowerCase()}; each … marks a cut. Names, numbers and addresses are invented.</p>
        <div class="lpanel"><button type="button" class="btn lx-${ID}-check" data-check>Check (${marked.size} marked)</button>
        ${verdict == null ? "" : verdict.ok
          ? kit.feedback(`Right: ${S_DROP} of these ${S_LOG.length} lines out. ${plural(S_CUT.length, "line")} cut off mid-write (${lineList(S_CUT)}), ${plural(S_FAILED.length, "turn")} that timed out with no reply, ${plural(S_STAFF.length, "staff test")}, and ${plural(S_COPIES.length, "repeat")}: the logger wrote a turn twice, or a customer retyped the same message. In the whole batch of ${LOG.length}, the same rules take out ${N_DROP} lines and leave ${LOG.length - N_DROP}. That took you a minute for ${S_LOG.length} lines; six months of logs is many thousands.`, true)
          : kit.feedback(verdict.html, false)}</div>`;
      el.querySelectorAll(`.lx-${ID}-row`).forEach(b => b.onclick = () => {
        const n = +b.dataset.i; marked.has(n) ? marked.delete(n) : marked.add(n); verdict = null; paint();
      });
      el.querySelector("[data-check]").onclick = () => { verdict = check(); paint(); if (verdict.ok) done(); };
    };
    paint();
  }

  /* 2. Run the stage-5 redactor on the kept lines and find what it missed. */
  function redactor({ el, done, kit }) {
    ensureStyle();
    const marked = new Set();
    let verdict = null;
    const paint = () => {
      const ok = verdict && verdict.ok;
      const missedOf = r => r[3].filter(p => p[3]).map(p => p[0]);
      el.innerHTML = `<h1>What did the redactor miss?</h1>
        <p class="lead">Before any of this leaves the company, personal data must go. You reuse the redactor from stage 5. It replaces two things with a tag such as <code>[NAME_1]</code>: the values stored on the account (name, phone, email, address), and anything shaped like an email, a UK mobile number or a postcode. Here are the ${RED.length} lines of the whole batch that survived cleaning and contained personal data, after the redactor ran on both the customer's message and the reply.</p>
        <p class="task">Tap every line where personal data is still readable. Then press Check.</p>
        <div class="lx-${ID}-rows">${RED.map(r => `<button type="button" class="lx-${ID}-row" data-i="${r[0]}" aria-pressed="${marked.has(r[0])}"><span class="lx-${ID}-n">${r[0]}</span><span class="lx-${ID}-txt"><span class="lx-${ID}-who">customer</span>${ok ? markMissed(kit, r[1], missedOf(r)) : kit.esc(r[1])}<br><span class="lx-${ID}-rep"><span class="lx-${ID}-who">assistant</span>${ok ? markMissed(kit, r[2], missedOf(r)) : kit.esc(r[2])}</span></span></button>`).join("")}</div>
        <p class="lx-${ID}-cap">Assistant text: ${CAPTION.toLowerCase()}, after redaction; each … marks a cut.</p>
        <div class="lpanel"><button type="button" class="btn lx-${ID}-check" data-check>Check (${marked.size} marked)</button>
        ${verdict == null ? "" : ok
          ? kit.feedback(`Right, ${plural(LEAKY.length, "line")}. The underlined pieces got through: <b>${MISSED.length} of the ${ALL_PIECES.length}</b> pieces of personal data in these lines. The redactor only knows exact values and fixed shapes, so it missed a first name on its own, other people's names, a landline, a number written with dashes, and addresses described in words. ${MISSED_REPLY.length} of the misses are in the <b>replies</b>: the model repeated a first name or an address back to the customer.`, true)
          : kit.feedback(verdict.html, false)}</div>`;
      el.querySelectorAll(`.lx-${ID}-row`).forEach(b => b.onclick = () => {
        const n = +b.dataset.i; marked.has(n) ? marked.delete(n) : marked.add(n); verdict = null; paint();
      });
      el.querySelector("[data-check]").onclick = () => {
        const extra = [...marked].filter(n => !LEAKY.includes(n)), missing = LEAKY.filter(n => !marked.has(n));
        if (!extra.length && !missing.length) { verdict = { ok: true }; paint(); done(); return; }
        const say = [];
        if (extra.length) say.push(`In ${lineList(extra)} every piece of personal data became a tag; nothing readable is left there.`);
        if (missing.length) say.push(`${plural(missing.length, "line")} you did not mark still ${missing.length === 1 ? "shows" : "show"} personal data. Read the replies too, and look for names and numbers that are not written the way the account stores them.`);
        verdict = { ok: false, html: say.join(" ") }; paint();
      };
    };
    paint();
  }

  /* 3. Spot the idea: keep the rules, not the result. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `The ${LOG.length - N_DROP} clean lines, saved as the start of the training set`,
      "Each rule you applied, written as code: stages in a fixed order, each one counting what it removed",
      "A prompt that asks a language model to clean each log line",
      "A written checklist, so a colleague can clean next month's batch by hand"
    ];
    const fb = [
      ["Next month's batch is new lines; this file does not help clean them. And nobody can later tell which rules made it, so a retrained model cannot be traced back to its data.", false],
      [`Right. That is a <b>data pipeline</b>: every decision you made by hand becomes a stage, the stages always run in the same order, and each one reports how many rows it removed. You can rerun it on every new batch, and the same code on the same logs gives the same set, so a model can be traced back to exactly the data it saw. The counts are your first alarm: a stage that suddenly removes nothing, or half the rows, is a bug.`, true],
      ["That is one paid model call per line, the answers can differ from run to run, a model can quietly reword a row, and every customer's personal data goes to the model before redaction. Fixed rules are cheaper, repeatable and testable.", false],
      ["You just felt how slow that is, and two people will decide some lines differently. A checklist is still useful as the spec of the rules, but the rules must run as code.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Next month there is another batch</h1>
        <p class="lead">Your rules remove ${N_DROP} of the ${LOG.length} lines in the batch, and you found ${MISSED.length} pieces of personal data the redactor missed. Six months of logs is thousands of batches like this. Every few months the team will retrain, and each time it must be able to say exactly what the model was trained on.</p>
        <p class="task">What should the team keep from your work on the last two screens?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. The pipeline in Python: predict the row count after each stage (a traced run). */
  const STAGES = (() => {
    const exact = REMOVED.exact, near = REMOVED.near;
    const retyped = exact.filter(n => COPY_OF[n] && row(n)[3] !== row(COPY_OF[n][0])[3]);
    const retried = exact.filter(n => !retyped.includes(n));
    return [
      { line: 1, name: "parse", right: after(1), wrongs: [LOG.length, after(1) - FAILED.length],
        say: `${plural(CUT.length, "line")} (${lineList(CUT)}) ${CUT.length === 1 ? "is" : "are"} cut off. <code>json.loads</code> raises <code>JSONDecodeError</code> on a line that is not valid JSON, and <code>parse</code> skips it.`,
        no: v => v === LOG.length ? "Every line goes through <code>json.loads</code>. A line cut off in the middle is not valid JSON." : "The failed turns are still valid JSON; only the cut lines fail to parse." },
      { line: 2, name: "status ok, not STAFF", right: after(2), wrongs: [after(1), after(2) - COPIES.length],
        say: `${plural(FAILED.length, "turn")} timed out (status <code>"error"</code>) and ${plural(STAFF.length, "staff test")} came from the STAFF account: ${after(1) - after(2)} rows gone.`,
        no: v => v === after(1) ? "Look at the condition: it keeps only status \"ok\" and accounts other than STAFF." : "Repeats are still in. This line only looks at status and account." },
      { line: 3, name: "drop_exact", right: after(3), wrongs: [after(2) - retried.length, after(2) - COPIES.length].filter(v => v !== after(3)),
        say: `${plural(exact.length, "row")} removed: ${lineList(retried)}, the retried writes, and also ${lineList(retyped)}. <code>drop_exact</code> compares the message and the reply after <code>norm</code>: lowercase, punctuation removed. So “${kit_esc(row(retyped[0])[3])}” becomes the same as line ${COPY_OF[retyped[0]][0]}, and the two recorded replies were word for word the same.`,
        no: v => v === after(2) - retried.length ? `You counted the retried writes. One retype is also an exact copy once <code>norm</code> lowercases it and drops the punctuation.` : "Not every retype becomes an exact copy: some differ in a word, not just in punctuation." },
      { line: 4, name: "drop_near", right: after(4), wrongs: [after(3), after(3) - near.length - 1],
        say: `${plural(near.length, "row")} removed (${lineList(near)}): the customer typed the question again with small changes. Exact matching cannot see these; the next screen shows how <code>drop_near</code> does.`,
        no: v => v === after(3) ? "Some retypes differ by a word or an apostrophe, not only by punctuation. Those survive the exact stage; this one catches them." : "Only the retypes go. Different questions about the same appliance stay." },
      { line: 5, name: "redact_row", right: after(5), wrongs: [after(5) - PII_LINES.length, after(5) - LEAKY.length],
        say: `Still ${after(5)}. Redaction changes text; it removes no rows. Each row then becomes one chat example, and <code>build_set</code> returned ${EXAMPLES}.`,
        no: () => "<code>redact_row</code> rewrites each row; the list comprehension keeps every row. Nothing is dropped here." }
    ];
  })();
  function kit_esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]); }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null; // k = stage being predicted
    const paint = () => {
      const fin = k >= STAGES.length;
      const s = STAGES[Math.min(k, STAGES.length - 1)];
      const opts = fin ? [] : [...new Set([s.right, ...s.wrongs])].sort((a, b) => b - a);
      const tableRows = [["start", String(LOG.length) + " lines"]].concat(STAGES.slice(0, k).map(t => [t.name, String(t.right)]));
      el.innerHTML = `<h1>The same rules, as a pipeline</h1>
        <p class="lead">This is the whole pipeline in Python. Each line is one stage and replaces <code>rows</code> with what is left. It runs on the whole batch of ${LOG.length} lines, which holds ${plural(CUT.length, "cut line")}, ${plural(FAILED.length, "failed turn")}, ${plural(STAFF.length, "staff test")}, ${plural(RETRIED.length, "retried write")} (the logger wrote the same turn twice) and ${plural(RETYPED.length, "retype")} (the customer typed the question again). The counts come from a real run that printed <code>len(rows)</code> after each line.</p>
        <div class="lx-${ID}-code">
        ${kit.code(CODE, fin ? 6 : s.line)}</div>
        ${kit.table(tableRows, { head: ["after", "len(rows)"], title: "Traced run", fresh: tableRows.length - 1 })}
        ${fin ? "" : `<p class="task">How many rows are left after the highlighted line?</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(s.right), num: true })}
        ${wrong != null ? kit.feedback(s.no(wrong), false) : ""}
        ${k > 0 ? kit.feedback(STAGES[k - 1].say, true) : ""}
        ${fin ? `<p class="lead">One example as written to the training file, in the <code>{"messages": [...]}</code> chat format that fine-tuning tools such as Hugging Face TRL accept:</p>
          <div class="lx-${ID}-pre">${kit.esc(JSON.stringify(EXAMPLE, null, 1))}</div><p class="lx-${ID}-cap">Assistant text: ${CAPTION.toLowerCase()}, after redaction.</p>
          <p class="lead">Look at the assistant's first words. The redactor left that name in, so it would go into training as it is.</p>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== s.right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= STAGES.length) done();
      });
    };
    paint();
  }

  /* 5. Near copies with NumPy: predict which pairs pass the threshold. */
  function nearCopies({ el, done, kit }) {
    ensureStyle();
    const pr = key => PAIRS.find(p => p[0] === key);
    const CASES = [pr("e24/e24b"), pr("drain/rinse"), ["highest", HIGHEST_OTHER[0], HIGHEST_OTHER[1], HIGHEST_OTHER[2]]];
    const ans = CASES.map(() => null);
    const sameReply = SAME_REPLY ? row(SAME_REPLY[0])[4] === row(SAME_REPLY[1])[4] : false;
    const paint = () => {
      const all = CASES.every((c, i) => ans[i] === (c[3] >= THRESHOLD ? 0 : 1));
      el.innerHTML = `<h1>Near copies, measured</h1>
        <p class="lead"><code>trigram_vector</code> turns a message into a NumPy array of 2048 counts. It lowercases the text and cuts it into three-letter pieces (“dis”, “ish”, “shw”…). Each piece adds 1 to one slot; a hash of the piece picks the slot.</p>
        <p class="lead"><code>similarities</code> scales every array to length 1. Then one matrix product (<code>@</code>) scores every pair at once. The score is the <b>cosine similarity</b>: 1 means the same pieces in the same proportions, 0 means no piece shared. <code>drop_near</code> keeps a message only if it scores below ${THRESHOLD} against every message it kept before.</p>
        <div class="lx-${ID}-code">${kit.code(CODE_NEAR, ans.some(a => a != null) ? 9 : 6)}</div>
        <p class="task">For each pair of customer messages, will the score reach ${THRESHOLD}, so that the second one is dropped?</p>
        ${CASES.map((c, i) => {
          const y = c[3] >= THRESHOLD, ok = ans[i] === (y ? 0 : 1);
          const why = i === 0 ? `The same customer typed the same question again. Most three-letter pieces are shared.`
            : i === 1 ? `Both are about a washer that will not drain, but the wording differs, so many pieces differ.${sameReply ? ` The recorded replies to these two were word for word the same, yet the questions are different, which is why the pipeline compares the customer's message, not the reply.` : ""}`
            : `This was the highest-scoring pair in the batch that is <b>not</b> a retype. Two different problems that share “Washing machine”, “won't” and “after the”.`;
          return `<div class="lcase" id="c${i}"><p>“${kit.esc(c[1])}”<br>“${kit.esc(c[2])}”</p>${kit.options([`Yes, ${THRESHOLD} or more`, `No, below ${THRESHOLD}`], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(`${ok ? "" : "Not this time. "}The run scored this pair <b>${c[3].toFixed(3)}</b>. ${why}`, ok)}</div>`;
        }).join("")}
        ${all ? `<div class="lpanel">${kit.feedback(`In this batch every retype scored ${Math.min(...PAIRS.filter(p => /b$/.test(p[0])).map(p => p[3])).toFixed(3)} or more, and no two different questions scored above ${HIGHEST_OTHER[2].toFixed(3)}. ${THRESHOLD} sits in the gap. That is how you pick a threshold: score real pairs you have judged by hand, then put the line between them. Too low and different questions vanish; too high and retypes stay in.`, true)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((cc, j) => ans[j] === (cc[3] >= THRESHOLD ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 6. Broken on purpose: an eval set with copies of training rows. */
  function brokenOrder({ el, done, kit }) {
    ensureStyle();
    let pick = null, fix = null;
    const splitIdx = BAD_LOG.map((l, i) => /^split/.test(l[0]) ? i : -1).filter(i => i >= 0);
    const checkIdx = BAD_LOG.length - 1;
    const evalN = BAD_LOG.find(l => l[0] === "dedup eval")[1];
    const saysLine = i => {
      const l = BAD_LOG[i];
      if (splitIdx.includes(i)) return [`Right. The split happens <b>before</b> any deduplication. A turn that was logged twice can land with one copy in train and the other in eval, and deduplicating each part on its own never compares the two parts. Both leaked rows are retried writes:${BAD_CROSS.map(c => `<br>“${kit.esc(c[0])}” (cosine ${c[2].toFixed(1)})`).join("")}`, true];
      if (i === checkIdx) return ["That line is the symptom: the check found the copies. The question is which earlier step let them through.", false];
      if (/^dedup/.test(l[0])) return [`Deduplication worked inside each part: it removed what it could see. It only ever compares train with train and eval with eval, so it cannot find a copy that sits on the other side. The cause is earlier.`, false];
      return [`${kit.esc(l[0])}: ${l[1]} is the same count as in the pipeline two screens back. Nothing is wrong yet at this step.`, false];
    };
    const FIXES = [
      "Deduplicate first, then split",
      "Split again with another random seed",
      `Lower the threshold to 0.5 so more copies are found`,
      "Run the deduplication on the eval set a second time"
    ];
    const fixFb = [
      [`Right. The same run with deduplication first, then the same split (seed 7): train ${FIXED.train}, eval ${FIXED.eval}, and ${plural(FIXED.cross.length, "eval row")} with a near copy in train. Once every turn exists once, it can only land on one side. In real projects you also split by customer or session, so one person's similar chats do not end up on both sides.`, true],
      ["Another seed may happen to put both copies on one side this time, and fail next month. The order of the stages is the bug; luck does not fix it.", false],
      [`The leaked copies scored ${BAD_CROSS.map(c => c[2].toFixed(1)).join(" and ")}: any threshold catches them, if it ever compares the two sides. A lower threshold would also start deleting different questions, like the pair that scored ${HIGHEST_OTHER[2].toFixed(3)}.`, false],
      ["The eval set has no copies inside itself any more. The copies are across the two sets, and deduplicating one side alone never looks across.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The eval set that was too easy</h1>
        <p class="lead">To measure the retrained assistant, a colleague sets aside 20% of the turns as an eval set: rows the model never trains on, used only to score it. Their version of the pipeline splits the rows into train and eval right after the filter. Then it deduplicates each part on its own. A check at the end compares every eval message with every train message, with the same cosine and threshold. This is the stage log of that real run:</p>
        <div class="lx-${ID}-log">${BAD_LOG.map((l, i) => `<button type="button" class="lx-${ID}-logline${pick === i ? ` lx-${ID}-on` : ""}" data-i="${i}"${splitIdx[0] === i ? " data-right" : ""}${i === checkIdx ? " data-wrong" : ""}>${kit.esc(l[0])}: ${l[1]}</button>`).join("")}</div>
        <p class="lead">${BAD_CROSS.length} of the ${evalN} eval rows have a copy in train. The model will have seen those answers in training, so its eval score would look better than it really is.</p>
        <p class="task">${pick != null && splitIdx.includes(pick) ? "Now pick the fix." : "Tap the line where the mistake happens."}</p>
        <div class="lpanel">${pick == null ? "" : kit.feedback(...saysLine(pick))}
        ${pick != null && splitIdx.includes(pick) ? `<div id="fix">${ask(kit, FIXES, 0, fix, fixFb)}</div>` : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-logline`).forEach(b => b.onclick = () => { pick = +b.dataset.i; fix = null; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 7. The misses: what to do before training. */
  function misses({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Train anyway: the model learns how to fix washers, not names and numbers",
      "Add a rule for each kind of miss, rerun, then hand-check a fresh sample of lines and drop the rows you cannot clean",
      "Redact only the customer messages; the replies come from the company's own assistant",
      "Delete every row whose account has a name on file"
    ];
    const fb = [
      ["Research on large language models shows they can repeat training text word for word, including names, phone numbers and email addresses, even ones that appeared in a single document. A name in the training set can come back out in someone else's chat.", false],
      [`Right. Each miss has a kind: a first name the account also holds, a number with dashes, a landline, someone else's name, an address in words. Each kind becomes a new rule or a check (for example, also match the account's first name alone), the pipeline reruns, and a person reads a <b>new</b> sample, because the old one now passes by design. Rows that still cannot be cleaned are dropped. You will never reach zero misses for sure; you measure the rate and decide if it is low enough.`, true],
      [`${MISSED_REPLY.length} of the ${MISSED.length} misses were in the replies. The model repeats what the customer said, so the replies carry the customer's personal data too.`, false],
      ["Every account has a name on file, so that deletes the whole set. Throwing the data away does not fix the redactor either: next month's batch has the same kinds of misses.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>${MISSED.length} pieces got through</h1>
        <p class="lead">The redactor missed ${MISSED.length} of ${ALL_PIECES.length} pieces of personal data in this batch. A fine-tuned model learns from every word in its training rows.</p>
        <p class="task">Before this set goes to training, what do you do?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const n = after(3), pairsNow = n * n; // drop_near scores the rows left after drop_exact
    const opts = ["Parsing and filtering the lines", "Dropping exact copies", "The similarity matrix in drop_near", "Redaction"];
    const fb = [
      ["Each line is read once, so 100 times more lines is 100 times more work, no more.", false],
      ["<code>drop_exact</code> keeps the turns it has seen in a Python set and checks each row once: 100 times more rows is about 100 times more work.", false],
      [`Right. The matrix has a score for every pair: ${n} rows give ${n} × ${n} = ${pairsNow.toLocaleString("en")} entries. 100 times more rows gives 10,000 times more entries. For big logs, teams switch to approximate methods that find likely pairs without scoring all of them; the deduplication study by Lee and others used MinHash.`, true],
      ["Redaction runs once per row, with a fixed number of values and patterns. It grows in step with the rows.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to build this pipeline</h1>
        <p class="lead"><b>What it is:</b> fixed, counted stages that turn real usage into training or eval data.</p>
        <p class="lead"><b>Reach for it</b> when you have many real turns and a clear use: a fine-tuning set, or a test set of real questions.</p>
        <p class="lead"><b>Not</b> when the logged replies were never checked: cleaning removes broken and repeated rows, but it does not make a wrong reply right, so label first. Not when your privacy terms forbid using chats this way. Not when a prompt or retrieval fix solves the problem without training.</p>
        <p class="lead"><b>Costs:</b> code for every stage, a person reading samples to measure redaction misses, storage for each versioned output, and a rerun for every new batch.</p>
        <p class="task">The pipeline goes from this batch to six months of logs, about 100 times more rows. Which stage's work grows fastest?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A delivery app wants a test set of real customer questions from last quarter's chats, to compare two prompts fairly.", true,
      "Yes. Real questions, with broken lines, staff tests and repeats removed, and personal data redacted before anyone outside the support team sees them. Repeats would make one question count many times in the score.",
      "Real chats are the source, and they hold the same junk you just cleaned: repeats would weigh some questions several times, and the personal data must go before the set is shared. This is the pipeline's job."],
    ["A team wants to fine-tune on support chats, but customers rated about half of the bot's replies as wrong.", false,
      "No, not on its own. The pipeline removes broken, repeated and personal rows; it never judges whether a reply is right. Trained on these, the model learns the wrong answers too. Label or filter by rating first, then clean.",
      "Cleaning cannot fix a wrong answer: a wrong reply, deduplicated and redacted, is still a wrong reply. The rows need labels or a rating filter before they are training data."],
    ["A clinic's privacy notice says chat transcripts are kept 30 days for support only. A developer wants to train a model on last year's transcripts.", false,
      "No. No pipeline stage can fix data you may not use. Redaction lowers the risk of a leak; it does not change what the notice promised. Ask the people who own the policy first.",
      "The problem is permission, not mess. Even perfectly cleaned, these transcripts may not be used this way under that notice. That is decided before any code runs."],
    ["Each month a game studio collects player bug reports from its in-game chat, and wants the same cleaned format every month for a classifier.", true,
      "Yes. A monthly batch, the same rules every time, and a model that should be traceable to its data: a pipeline with counted stages is exactly that.",
      "Same rules every month and a model trained on the result: that is what a re-runnable, counted pipeline is for. Doing it by hand each month gives a slightly different set every time."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Pipeline or not?</h1>
        <p class="lead">Four requests from other teams. The pipeline means: parse, filter, deduplicate, redact, write, with a count at each stage.</p>
        <p class="task">Is a logs-to-dataset pipeline the right next step for each? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can turn logs into a dataset</h1>
      <p class="lead">You cleaned ${S_LOG.length} log lines by hand, counted what the stage-5 redactor missed, wrote the same rules as a ${CODE.length - 1}-stage pipeline with a count at each stage, measured near copies with NumPy, and found why splitting before deduplicating leaks copies into the eval set.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>drop_exact</code> and <code>drop_near</code> yourself for a small log batch and make the tests pass, including one retype that only the near-copy stage catches.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It builds on this lesson: a clean, versioned dataset is the evidence you bring when you explain how a model was trained.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "A data pipeline from logs to a retraining set",
    checked: "2026-11-14",
    sources: [
      "https://docs.python.org/3/library/json.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.linalg.norm.html",
      "https://huggingface.co/docs/trl/en/dataset_formats",
      "https://arxiv.org/abs/2107.06499",
      "https://arxiv.org/abs/2012.07805"
    ],
    interview: [
      {
        q: "You are asked to fine-tune a support model on six months of chat logs. Walk me through how you would prepare the data.",
        good: [
          "Parse and drop what cannot be read, failed turns and internal test chats, and count what each stage removes",
          "Deduplicate on normalised text, then catch near copies with a similarity threshold chosen from pairs judged by hand",
          "Redact personal data in both the user messages and the replies, then measure the misses on a fresh hand-checked sample",
          "Deduplicate before splitting train and eval, and split by customer or session",
          "Check the replies are actually good (ratings or labels) and version the output together with the pipeline code"
        ],
        weak: "Export the logs to JSONL and start the fine-tuning job, trusting the model to learn around the noise. That trains on repeats, wrong answers and customers' personal data."
      },
      {
        q: "Your retrained assistant scores far better on your eval set than the old one, but users notice no difference. What do you check in the data?",
        good: [
          "Whether eval rows have exact or near copies in the training set",
          "The order of the pipeline: a split before deduplication puts copies of the same turn on both sides",
          "Compare every eval message with the training messages using the same similarity and threshold",
          "Re-split after deduplicating, grouped by customer or session, and measure again"
        ],
        weak: "Say the new model is simply better, or train longer. That never asks whether the eval set measures anything the model had not already seen."
      }
    ],
    screens: [byHand, redactor, spotIdea, asCode, nearCopies, brokenOrder, misses, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-check]"], right: [...[...S_CUT, ...S_FAILED, ...S_STAFF, ...S_COPIES].map(n => `[data-i="${n}"]`), "[data-check]"] },
      { wrong: ["[data-check]"], right: [...LEAKY.map(n => `[data-i="${n}"]`), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(STAGES.length).fill("[data-right]") },
      { wrong: ["#c1 [data-wrong]"], right: [0, 1, 2].map(i => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "#fix [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
