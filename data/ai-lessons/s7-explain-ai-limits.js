/* Lesson: explaining what an AI feature can and cannot do. Story: the managers of a logistics company, Kestrel
   Freight, ask for an AI that "reads every invoice and never makes mistakes". Ideas: (1) translate an evaluation
   for each reader: their unit (invoices, payments, money a month), the error as "N out of M", which cases fail,
   what catches them and what is left, with every number keeping what it counts; (2) "100%" cannot be shown by
   a test: zero errors in n cases still allows an error rate of about 3/n, so a quality bar names its test size,
   and the request becomes a scope with a stated bar.
   Data, all real:
   - docs/ai-path/runs/s7-explain-ai-limits/make_invoices.py (+ golden.json): 40 invented invoices, 8 kinds of 5,
     with the printed truth for 6 fields; score.py + score.out.txt + score.json: scores the 40 recorded
     extractions and applies the purchase-order match check;
   - recordings (main checkout) docs/ai-path/recordings/s7-explain-ai-limits/inv-01 … inv-40 (one extraction per
     invoice) and eng-sales, eng-legal, eng-finance (a small hosted model writing an engineer's reply from the
     numbers in score.out.txt), requests built by make_invoices.py and make_engineer_requests.py.
   Lesson-local style: a quoted-message block and a small mono block (.lx-s7-explain-ai-limits-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s7-explain-ai-limits";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s7-explain-ai-limits/score.json: [invoice, kind, wrong fields, flagged by the PO check]
  const RESULTS = [["01","typed-uk",[],0],["02","typed-uk",[],0],["03","typed-uk",[],0],["04","typed-uk",[],0],["05","typed-uk",[],0],["06","typed-de",[],0],["07","typed-de",[],0],["08","typed-de",[],0],["09","typed-de",[],0],["10","typed-de",[],0],["11","balance-due-us",[],0],["12","balance-due-us",[],0],["13","balance-due-us",[],0],["14","balance-due-us",[],0],["15","balance-due-us",[],0],["16","numeric-date-uk",[],0],["17","numeric-date-uk",[],0],["18","numeric-date-uk",[],0],["19","numeric-date-uk",[],0],["20","numeric-date-uk",[],0],["21","ocr-scan",["invoice_number","po_number"],1],["22","ocr-scan",["invoice_number"],0],["23","ocr-scan",["invoice_number","po_number"],1],["24","ocr-scan",["invoice_number","po_number"],1],["25","ocr-scan",[],0],["26","credit-note",[],1],["27","credit-note",[],1],["28","credit-note",[],1],["29","credit-note",[],1],["30","credit-note",[],1],["31","no-po-ie",[],1],["32","no-po-ie",[],1],["33","no-po-ie",[],1],["34","no-po-ie",[],1],["35","no-po-ie",[],1],["36","usd-with-eur-ref",[],0],["37","usd-with-eur-ref",[],0],["38","usd-with-eur-ref",[],0],["39","usd-with-eur-ref",[],0],["40","usd-with-eur-ref",[],0]];
  const KINDS = {
    "typed-uk": "UK haulier, typed",
    "typed-de": "German warehouse, typed, amounts like 1.234,56",
    "balance-due-us": "US fuel supplier, deposit already paid",
    "numeric-date-uk": "UK customs broker, dates like 03/10/2026",
    "ocr-scan": "Polish carrier, scanned paper",
    "credit-note": "Credit notes: money owed back to us",
    "no-po-ie": "Irish courier, no order number",
    "usd-with-eur-ref": "Dutch terminal, USD with a EUR figure"
  };
  const SCAN = "ocr-scan";
  const FIELDS_PER_INVOICE = 6; // supplier, invoice_number, invoice_date, total_due, currency, po_number
  const COST_40 = 0.0024381;    // score.out.txt: sum of costUsd over inv-01 … inv-40 (reported by OpenRouter)
  const MONTHLY_INVOICES = 6000; // story: the volume given to the engineer (make_engineer_requests.py FACTS)
  const PRICE_DATE = "2026-11-17";

  // From docs/ai-path/runs/s7-explain-ai-limits/golden.json (inv-22, the OCR text line) and the recording
  // docs/ai-path/recordings/s7-explain-ai-limits/inv-22.json (the JSON line of the reply, without its ``` fences)
  const SCAN_LINE = "Nr / No: PL/2026/02B9";
  const PAPER_NO = "PL/2026/0289";
  const REC_INV22 = {
    src: "s7-explain-ai-limits/inv-22",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    text: "{\"supplier\": \"TRANS-WARTA Sp. z o.o.\", \"invoice_number\": \"PL/2026/02B9\", \"invoice_date\": \"2026-09-20\", \"total_due\": 1592.00, \"currency\": \"EUR\", \"po_number\": \"PO-49602\"}"
  };

  // From docs/ai-path/recordings/s7-explain-ai-limits/eng-sales.json, eng-legal.json, eng-finance.json (not altered)
  const REC_ENG = {
    src: "s7-explain-ai-limits/eng-sales, eng-legal, eng-finance",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    sales: "No. Current model has 3% field-level error rate on OCR'd scans (invoice_number, po_number). Document-level accuracy is 90%. 13% of invoices require manual review due to PO matching logic. Born-digital invoices are error-free. We process ~6k invoices/month at $0.0024/invoice.",
    legal: "Tomas,\n\nThe system has a 97.08% field-level accuracy on 240 fields. All errors occurred on scanned documents, primarily OCR confusions (e.g., B/8). Born-digital invoices are 100% accurate.\n\nA post-check for PO two-way matching routes 13/40 invoices to manual review, catching 3/4 erroneous documents. One incorrect invoice slipped through due to an incorrect invoice number but correct PO and total.\n\nWe process ~6,000 invoices/month. Inference cost is $0.0024 per invoice.",
    finance: "Monthly inference cost: ~$14.40 (6k invoices * $0.0024/invoice).\n\nDocument-level accuracy is 90%. 13% of invoices require manual review due to PO matching. This suggests AP may still need similar staffing, but with a focus on reviewing exceptions and exceptions."
  };
  const ASK = { // make_engineer_requests.py ASKS (the managers' messages)
    sales: "Can I tell customers our system reads every invoice automatically and never makes mistakes?",
    legal: "If the system reads an invoice wrong and we pay the wrong amount, or pay twice, what stops that?",
    finance: "What does this cost us a month, and does it mean accounts payable needs fewer people?"
  };
  const ENG_COST_GIVEN = 0.0024; // the cost of the 40 calls as written in the engineer's facts
  const CAPTION = `Recorded model output, ${REC_ENG.recordedAt}`;

  /* ---------- Derived from the data ---------- */
  const N = RESULTS.length;
  const FIELDS = N * FIELDS_PER_INVOICE;
  const FIELDS_WRONG = RESULTS.reduce((s, r) => s + r[2].length, 0);
  const FIELD_ACC = (FIELDS - FIELDS_WRONG) / FIELDS;
  const BAD = RESULTS.filter(r => r[2].length);
  const FULL_RIGHT = N - BAD.length;
  const SCANS = RESULTS.filter(r => r[1] === SCAN);
  const SCAN_BAD = SCANS.filter(r => r[2].length).length;
  const SCAN_FIELDS_WRONG = SCANS.reduce((s, r) => s + r[2].length, 0);
  const TYPED = N - SCANS.length;
  const TYPED_BAD = BAD.filter(r => r[1] !== SCAN).length;
  const FLAGGED = RESULTS.filter(r => r[3]).length;
  const CAUGHT = BAD.filter(r => r[3]).length;
  const SLIPPED = BAD.filter(r => !r[3]);
  const NAIVE_RIGHT = Math.round(N * FIELD_ACC);                 // reading field accuracy as invoice accuracy
  const SPREAD_RIGHT = N - FIELDS_WRONG;                          // every wrong field on a different invoice
  const MIN_BAD = Math.ceil(FIELDS_WRONG / FIELDS_PER_INVOICE);   // all wrong fields packed on as few invoices as possible
  const pct = (x, d = 1) => (100 * x).toFixed(d) + "%";
  const usd = x => "$" + x.toFixed(2);
  const MONTH_COST = COST_40 / N * MONTHLY_INVOICES;
  const WRONG_MONTH_COST = ENG_COST_GIVEN * MONTHLY_INVOICES;     // the engineer's sum: the 40-call cost taken per invoice
  const ONE_IN = Math.round(N / FLAGGED);                         // "about 1 in 3"
  // Zero errors in n tries: the largest error rate p with (1 - p)^n >= 5%, and the rule-of-three shortcut 3/n
  const upper = n => 1 - Math.pow(0.05, 1 / n);
  const nFor = p => Math.ceil(Math.log(0.05) / Math.log(1 - p)); // smallest n whose zero-error bound is at most p
  const per100 = x => Math.round(100 * x);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-msg { margin: 16px 0 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 10px 0; }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 0 0 4px; }
      .lx-${ID}-txt { font-size: 16px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { text-align: left; }
      .lx-${ID}-slot { margin: 0 0 6px; font-weight: 600; }
    `;
    document.head.appendChild(s);
  }
  const msg = (kit, who, text, mono) => `<div class="lx-${ID}-msg"><p class="lx-${ID}-who">${kit.esc(who)}</p><div class="${mono ? `lx-${ID}-mono` : `lx-${ID}-txt`}">${kit.esc(text)}</div></div>`;
  const cap = t => `<p class="lx-${ID}-cap">${t}</p>`;
  const opt = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  // One-question screen: paint(head, opts, right, fb) with a fixed starting state
  function single(el, done, kit, render, right) {
    let ans = null;
    const paint = () => {
      el.innerHTML = render(ans);
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 1. The request, and the first surprise in the test numbers. */
  function request({ el, done, kit }) {
    ensureStyle();
    const vals = [NAIVE_RIGHT, FULL_RIGHT, SPREAD_RIGHT, N];
    const RIGHT = 1;
    const byKind = Object.keys(KINDS).map(k => {
      const rs = RESULTS.filter(r => r[1] === k);
      return [KINDS[k], `${rs.filter(r => r[2].length).length} of ${rs.length}`];
    });
    const FIELD_NAME = { supplier: "supplier", invoice_number: "invoice number", invoice_date: "date", total_due: "amount to pay", currency: "currency", po_number: "purchase order number" };
    const wrongList = BAD.map(r => ["invoice " + r[0], r[2].map(f => FIELD_NAME[f]).join(", ")]);
    const doubles = BAD.filter(r => r[2].length > 1).map(r => r[0]);
    const fb = [
      [`That reads ${pct(FIELD_ACC)} as a share of invoices. It is a share of fields. An invoice has ${FIELDS_PER_INVOICE} fields, so ${FIELDS_WRONG} wrong fields sit on at least ${MIN_BAD} invoices. ${NAIVE_RIGHT} cannot happen. Count the invoices in the list.`, false],
      null,
      [`That subtracts the ${FIELDS_WRONG} wrong fields from the ${N} invoices, as if each wrong field were on its own invoice. Look at the list: invoices ${doubles.join(", ")} each have more than one wrong field. Count invoices, not lines of fields.`, false],
      [`Then no field at all would be wrong, and the list shows ${FIELDS_WRONG}.`, false]
    ];
    fb[RIGHT] = [`Right: ${FULL_RIGHT} of ${N}. So ${BAD.length} invoices, 1 in ${Math.round(N / BAD.length)}, would have reached payment with something wrong. That is the number the managers care about, and “${pct(FIELD_ACC)}” hides it. Here is where the mistakes were:${kit.table(byKind, { head: ["kind of invoice (5 each)", "with a wrong field"], title: "The 40 test invoices" })}Every mistake was on a scan of a paper invoice. On the ${TYPED} typed ones the model got every field right.`, true];
    single(el, done, kit, ans => `<h1>“Reads every invoice, never makes mistakes”</h1>
      <p class="lead">Kestrel Freight, a logistics company, pays about ${MONTHLY_INVOICES.toLocaleString("en-US")} supplier invoices a month. Clerks type ${FIELDS_PER_INVOICE} fields from each one into the payment system: supplier, invoice number, date, amount to pay, currency and our purchase order number. The managers want an AI that reads every invoice and never makes mistakes. You are the engineer asked to say whether it can. This lesson is the last step of building an AI feature: telling the people who decide what it can and cannot do, in words they can use.</p>
      <p class="lead">Before saying anything, you tested a small hosted model on a golden set: ${N} invoices from eight suppliers, where you know the right value of every field. It got ${FIELDS - FIELDS_WRONG} of ${FIELDS} fields right: <b>${pct(FIELD_ACC)}</b>. Your scoring script listed the wrong ones:</p>
      ${kit.table(wrongList, { head: ["invoice", "wrong fields"], title: `The ${FIELDS_WRONG} wrong fields` })}
      ${cap(`The ${N} invoices were written for this lesson. The scanned ones had scanner-style misreadings put in on purpose (O for 0, l for 1, B for 8). Every model reading of the ${N} is a real recorded answer, ${REC_INV22.recordedAt}.`)}
      <p class="task">Managers count invoices, not fields. How many of the ${N} invoices came out with all ${FIELDS_PER_INVOICE} fields right?</p>
      <div class="lpanel">${ask(kit, vals.map(String), RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 2. The sales lead: pick the reply she can repeat to customers. */
  function sales({ el, done, kit }) {
    ensureStyle();
    const RIGHT = 1;
    const opts = [
      `No “never”, but tell customers it is ${Math.round(100 * FIELD_ACC)}% accurate. That is the number from our test of ${N} invoices, and it sounds honest without promising too much.`,
      `Not “never”. In our test of ${N} invoices, every typed invoice came out right, but ${SCAN_BAD} of the ${SCANS.length} scanned paper invoices had a number misread. Safe to say: it reads typed invoices automatically, and a person checks scans and anything that does not match an order.`,
      `Yes for typed invoices: in our test all ${TYPED} typed invoices were read right, so promise “no mistakes” for those. Only scanned paper invoices need a person to check them.`,
      `No. Document-level exact match is ${pct(FULL_RIGHT / N, 0)}, field-level ${pct(FIELD_ACC, 2)}; the errors are OCR confusions (O/0, B/8) on scans.`
    ].map(s => opt(kit, s));
    const fb = [
      [`${Math.round(100 * FIELD_ACC)}% counts fields. Customers count invoices, and 1 in ${Math.round(N / BAD.length)} test invoices had something wrong. A customer who hears “${Math.round(100 * FIELD_ACC)}%” and then meets a wrong invoice will feel misled.`, false],
      [`Yes. It answers her question in her customers' unit (invoices), says which kind fails, and gives her a sentence she can say safely. One more thing: some numbers in the engineer's reply are wrong. The 3% error rate was over all fields, not on scans (on scans it was ${SCAN_FIELDS_WRONG} of ${SCANS.length * FIELDS_PER_INVOICE} fields). And 13% and “$0.0024/invoice” you will check on the finance screen.`, true],
      [`${TYPED} out of ${TYPED} is a good result on a small test. It is not a promise about the next ${MONTHLY_INVOICES.toLocaleString("en-US")}. A later screen shows how big an error rate a test of ${TYPED} can still hide. Promise what you check, not a perfect score.`, false],
      ["All true, and still the engineer's words. Mina cannot repeat “document-level exact match” or “OCR” to a customer. Say it in invoices and in what the customer will notice.", false]
    ];
    single(el, done, kit, ans => `<h1>Mina asks: can I promise it?</h1>
      <p class="lead">Mina, the sales lead, wants to offer the same system to customers. She writes:</p>
      ${msg(kit, "Mina, sales lead", ASK.sales)}
      <p class="lead">Your test also ran one check before payment, the <b>PO match</b>: each invoice must match one of our purchase orders (PO), or it goes to a person.</p>
      <p class="lead">You asked a small hosted model to write the reply an engineer might send, from the test numbers. It wrote:</p>
      ${msg(kit, "engineer's reply", REC_ENG.sales)}${cap(CAPTION)}
      <p class="task">Pick the reply you would send Mina instead.</p>
      <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 3. The lawyer: what stops a wrong payment, and what still gets through. */
  function legal({ el, done, kit }) {
    ensureStyle();
    const RIGHT = 2;
    const opts = [
      `The system has ${pct(FIELD_ACC, 2)} field-level accuracy on ${FIELDS} fields, typed invoices were 100% accurate, and every error was an OCR confusion on a scan, so the risk of a wrong payment is very small.`,
      `Before payment, each invoice is matched to our purchase order, and anything that does not match goes to a person. In the test that sent ${FLAGGED} of ${N} invoices to a person, so a wrong payment cannot happen.`,
      `Before payment, each invoice is matched to our purchase order: the order number must exist and the amount must match it. Anything else goes to a person. In the test, that stopped ${CAUGHT} of the ${BAD.length} invoices the model got wrong. ${SLIPPED.length === 1 ? "One" : SLIPPED.length} got through with the right order and amount but a misread invoice number. The amount paid was right; but if our duplicate check compares invoice numbers, a second copy of that invoice could get past it.`,
      "The model is very accurate and we review a sample of its work every week, so the risk is low. If a wrong payment ever happens, we will find it in the monthly reconciliation and fix the model."
    ].map(s => opt(kit, s));
    const fb = [
      ["Tomas asked what stops a wrong payment. An accuracy figure does not answer that; a check does. And “100%” from a small test is not a sentence a lawyer should hear from you.", false],
      [`The test has a wrong invoice that passed the check (invoice ${kit.esc(SLIPPED[0][0])}). “Cannot happen” is exactly the sentence you must not tell a lawyer without proof.`, false],
      [`Yes. It names the mechanism, how often it worked in the test (${CAUGHT} of ${BAD.length}), and the case that is left, with its real risk. Tomas can now decide whether that risk needs another rule, for example a person checking scanned invoices before payment.`, true],
      [`A weekly sample and a monthly reconciliation find a mistake after the money has left. Tomas asked what stops a wrong payment before it happens. And “very accurate” gives him no number for the 1 invoice in ${Math.round(N / BAD.length)} that was wrong.`, false]
    ];
    single(el, done, kit, ans => `<h1>Tomas asks: what stops a wrong payment?</h1>
      ${msg(kit, "Tomas, company lawyer", ASK.legal)}
      ${msg(kit, "engineer's reply", REC_ENG.legal)}${cap(CAPTION)}
      <p class="lead">The invoice that slipped through was a scan. The OCR text (what the scanner's character reader made of the page) said <code>${kit.esc(SCAN_LINE)}</code>; the paper says <code>${kit.esc(PAPER_NO)}</code>. The model copied what it was given:</p>
      ${msg(kit, "model's reading of the scan", REC_INV22.text, true)}${cap(`Recorded model output, ${REC_INV22.recordedAt}`)}
      <p class="task">Pick the reply you would send Tomas.</p>
      <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 4. The finance manager: check the numbers before you send them. */
  function finance({ el, done, kit }) {
    ensureStyle();
    const RIGHT = 3;
    const say = (cost, part) => `The model costs about ${cost} a month at ${MONTHLY_INVOICES.toLocaleString("en-US")} invoices (prices on ${PRICE_DATE}). In our test of ${N}, ${part} of the invoices went to a person.`;
    const opts = [
      say(usd(WRONG_MONTH_COST), "13%"),
      say(usd(MONTH_COST), "13%"),
      say(usd(WRONG_MONTH_COST), `about 1 in ${ONE_IN}`),
      say(usd(MONTH_COST), `about 1 in ${ONE_IN}`)
    ].map(s => opt(kit, s));
    const costWrong = `${usd(WRONG_MONTH_COST)} takes $${ENG_COST_GIVEN} as the cost of one invoice. It was the cost of all ${N} test calls together. One invoice cost about $${(COST_40 / N).toFixed(5)}, so ${MONTHLY_INVOICES.toLocaleString("en-US")} cost about ${usd(MONTH_COST)}.`;
    const shareWrong = `“13%” reads “13/40” as 13 percent. ${FLAGGED} of ${N} is ${pct(FLAGGED / N)}: about 1 in ${ONE_IN}.`;
    const fb = [
      [`Both numbers are the engineer's, and both are wrong. ${costWrong} ${shareWrong}`, false],
      [`The cost is right now. ${shareWrong}`, false],
      [`The share is right now. ${costWrong}`, false],
      [`Right. Both mistakes came from a number losing what it counts: “for ${N} calls” became “per invoice”, and “${FLAGGED} of ${N}” became “13%”. Now the rest of Grace's question: the model's bill is tiny; what costs money is people checking invoices (all credit notes, all invoices without an order number, unclear scans). The test had ${N / Object.keys(KINDS).length} of each kind, so its 1 in ${ONE_IN} is not the real share: that depends on how many of those kinds arrive in a month. Whether accounts payable needs fewer people depends on that share and on how long each check takes, and nobody has measured either yet. Tell her so, instead of guessing.`, true]
    ];
    single(el, done, kit, ans => `<h1>Grace asks: what does it cost?</h1>
      <p class="lead">Accounts payable (AP) is the team that pays supplier invoices.</p>
      ${msg(kit, "Grace, finance manager", ASK.finance)}
      ${msg(kit, "engineer's reply", REC_ENG.finance)}${cap(CAPTION)}
      <p class="lead">Two numbers in that reply are wrong. The facts the engineer had: the ${N} test calls cost <b>$${ENG_COST_GIVEN} in total</b>, and the order check sent <b>${FLAGGED} of the ${N} invoices</b> to a person.</p>
      <p class="task">Pick the reply to Grace with both numbers right.</p>
      <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 5. Spot the idea: what the three good replies had in common. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    const RIGHT = 2;
    const opts = [
      "They dropped the numbers: people who are not engineers cannot use them",
      `They led with the best figure (${pct(FIELD_ACC)}), so the project gets approved`,
      "Each answered the reader's own decision in the reader's unit, said how often it fails as “N out of M”, which cases fail, and what catches them",
      "They left out what fails, so nobody worries for no reason"
    ];
    const fb = [
      [`The good replies kept numbers: ${SCAN_BAD} of ${SCANS.length} scans, ${CAUGHT} of ${BAD.length} caught, ${usd(MONTH_COST)} a month. Grace cannot plan without a cost, and “very accurate” cannot be checked by anyone.`, false],
      [`The field figure hides that 1 in ${Math.round(N / BAD.length)} invoices had a mistake. Approval won with that number turns into lost trust the first time a wrong invoice shows up.`, false],
      [`Right. That is the whole skill: <b>translate the evaluation for the reader</b>. Use the unit they count (invoices for Mina, payments for Tomas, money a month for Grace). Give the error as “N out of M”, never a bare percent. Name the kind of case that fails, the check that catches it, and what is left. And keep what each number counts: the engineer's two mistakes came from dropping it.`, true],
      ["Tomas's whole question was what fails. A failure you leave out is the one that surprises everyone later, and then nothing you said before is believed.", false]
    ];
    single(el, done, kit, ans => `<h1>What made those replies work?</h1>
      <p class="lead">You picked three replies, for a sales lead, a lawyer and a finance manager. They used the same test, but not the same words or the same numbers.</p>
      <p class="task">What did all three good replies do?</p>
      <div class="lpanel">${ask(kit, opts.map(s => opt(kit, s)), RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 6. "Can it be 100% accurate?": what zero errors in a small test can and cannot show. */
  function hundred({ el, done, kit }) {
    ensureStyle();
    const RIGHT = 1;
    const up = upper(TYPED);
    const opts = [
      `Yes: ${TYPED} of ${TYPED} right is 100%.`,
      `No test can show 100%. With 0 mistakes in ${TYPED}, the real error rate could still be as high as about ${per100(up)} in 100. A bigger test narrows that.`,
      `No: it is ${pct(FIELD_ACC)} accurate, so ${pct(1 - FIELD_ACC)} of typed invoices will be wrong.`,
      `Not yet: run the same ${TYPED} invoices again, and if it is 100% a second time, promise it.`
    ].map(s => opt(kit, s));
    const fb = [
      [`That is 100% on these ${TYPED}. The question is about the next ${MONTHLY_INVOICES.toLocaleString("en-US")} a month. A test can show that mistakes happen; it cannot show that they never do.`, false],
      [`Right. Here is why. Suppose the true rate were ${per100(up)} in 100. Then ${TYPED} clean invoices in a row would still happen about 1 time in 20. So a clean test of ${TYPED} cannot rule that rate out. A shortcut you can do in your head, the <b>rule of three</b>: with 0 mistakes in n cases, the rate could still be up to about <b>3 / n</b>. Here 3 / ${TYPED} is ${pct(3 / TYPED)}; the exact figure is ${pct(up)}.`, true],
      [`${pct(FIELD_ACC)} counts fields on all ${N} invoices, and all of its mistakes were on scans. On typed invoices the test found ${TYPED_BAD}. That figure says nothing direct about them.`, false],
      [`The same ${TYPED} invoices again add no new evidence: only new invoices do. And no test size turns into a promise of zero; a bigger one only lowers the rate it can rule out.`, false]
    ];
    single(el, done, kit, ans => `<h1>“So it is 100% on typed invoices?”</h1>
      <p class="lead">At the next meeting the operations director looks at the test: ${TYPED} typed invoices, ${TYPED_BAD} mistakes.</p>
      ${msg(kit, "Operations director", "So for typed invoices it is 100% accurate. Can I write that in the plan?")}
      <p class="task">What is the honest answer?</p>
      <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 7. Use the rule of three: how big a test does a quality bar need? */
  function howMany({ el, done, kit }) {
    ensureStyle();
    const Q = [
      { bar: 100, vals: [100, 300, 1000, TYPED] },
      { bar: 50, vals: [50, 100, 150, 300] }
    ];
    Q.forEach(q => { q.right = q.vals.indexOf(3 * q.bar); });
    let turn = 0, ans = null;
    const fbFor = (q, v) => {
      if (v === 3 * q.bar) return null;
      if (v === TYPED) return `That is the test you have. 3 / ${TYPED} supports only about ${per100(3 / TYPED)} in 100, not 1 in ${q.bar}.`;
      const in100 = x => `${(100 * x).toFixed(1).replace(/\.0$/, "")} in 100`;
      if (v < 3 * q.bar) return `3 / ${v} is ${in100(3 / v)}, but the bar is 1 in ${q.bar} (${in100(1 / q.bar)}). A clean test of ${v} cannot rule out that many mistakes.`;
      return `3 / ${v} is ${in100(3 / v)}: stricter than you need for 1 in ${q.bar} (${in100(1 / q.bar)}). Every test invoice has to be checked by hand to know its truth, so size the test to the bar.`;
    };
    const paint = () => {
      const fin = turn >= Q.length;
      const q = Q[Math.min(turn, Q.length - 1)];
      const wrongFb = ans != null && !fin ? fbFor(q, q.vals[ans]) : null;
      el.innerHTML = `<h1>How big must the test be?</h1>
        <p class="lead">The director accepts that a test cannot prove 100%. Instead he wants to write a <b>quality bar</b>: the worst error rate he will accept, such as “at most 1 in 100 typed invoices with a wrong field”. Use the rule of three: a test of n invoices with 0 mistakes rules out error rates above about 3 / n.</p>
        ${Q.slice(0, turn).map(p => `<p class="lead">At most 1 in ${p.bar}: a clean test of <b>${3 * p.bar}</b> (exact figure ${nFor(1 / p.bar)}).</p>`).join("")}
        ${fin ? "" : `<p class="task">How many typed invoices, all right, would the test need for “at most 1 in ${q.bar}”?</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. A stricter bar needs a bigger test, in proportion: twice as strict, twice the invoices. That is why a quality bar always names its test size. One more condition: the test must look like the real invoices. Our ${N} came from eight suppliers. If many real invoices are scans, a test made mostly of typed ones hides the problem.`, true)
          : `${kit.options(q.vals.map(String), { picked: ans, correct: q.right, num: true })}${wrongFb ? kit.feedback(wrongFb, false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[turn].right) { turn++; ans = null; paint(); if (turn === Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 8. Turn the request into a scope with a stated quality bar. */
  const BAR = 100; // the bar the scope note states: at most 1 in BAR, shown by a clean test of 3 * BAR
  const SLOTS = [
    { name: "What it reads", right: 1, opts: [
      ["Every invoice in any format, with clerks fixing whatever the model gets wrong", `The test showed ${SCAN_BAD} of ${SCANS.length} scans with a mistake. Putting scans in scope promises what you just saw it cannot do.`],
      ["Typed invoices. Scanned paper invoices go to a clerk, as today", "Yes. In scope is what the test showed it handles. Scans stay manual until something changes, such as better scanning, and a new test shows it."],
      ["Only the eight suppliers in the test", "The mistakes followed the format (scans), not the supplier. Cutting to eight suppliers throws away most of the work. Instead, test on invoices from all suppliers."]] },
    { name: "Quality bar", right: 2, opts: [
      ["It never makes mistakes", "No test can show that, as you saw. A bar must be something you can measure, and could miss."],
      [`${Math.round(100 * FIELD_ACC)}% accuracy, measured on our golden set and reported to the managers every month`, `${Math.round(100 * FIELD_ACC)}% of what: fields or invoices? Field accuracy hid that 1 in ${Math.round(N / BAD.length)} invoices had a mistake. And the golden set has only ${N} invoices: too small to support a strict bar. A bar needs the unit and a test big enough for it.`],
      [`At most 1 in ${BAR} typed invoices with any wrong field, shown on a fresh test of ${3 * BAR} typed invoices from all our suppliers, repeated every month`, "Yes. The unit (invoices), the bar, the test size that can support it, and when it is measured again. Anyone can check it."]] },
    { name: "What catches mistakes", right: 0, opts: [
      [`Before payment, every invoice is matched to its purchase order; no order, or a mismatch, goes to a person. Known gap: a misread invoice number with the right order and amount (${SLIPPED.length} in the test)`, "Yes. A check against data the company owns, what it routes to people, and the gap you know about, said out loud."],
      [`Nothing extra: at 1 in ${BAR}, the few mistakes left can be fixed when suppliers complain`, `Even at the bar, 1 in ${BAR} is about ${MONTHLY_INVOICES / BAR} invoices a month at this volume. A supplier complains when it is paid too little, not when it is paid too much, so waiting for complaints misses every overpayment. Something has to catch them before money leaves.`],
      ["The model rates its confidence in each answer; answers under 90% go to a person, the rest are paid", "This test never measured whether the model's confidence goes with its mistakes. The order match uses data you own, and the test showed what it catches."]] }
  ];
  function scope({ el, done, kit }) {
    ensureStyle();
    const ans = SLOTS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Turn the request into a scope</h1>
        <p class="lead">“Reads every invoice and never makes mistakes” cannot be promised. A <b>scope</b> you can keep says what it reads, the <b>quality bar</b> it must meet, and what catches the mistakes that remain.</p>
        <p class="task">Write the scope note: pick one line for each part. Pick again if you change your mind.</p>
        ${SLOTS.map((s, i) => `<div class="lcase" id="c${i}"><p class="lx-${ID}-slot">${kit.esc(s.name)}</p>${kit.options(s.opts.map(o => opt(kit, o[0])), { picked: ans[i], correct: s.right })}${ans[i] == null ? "" : kit.feedback(s.opts[ans[i]][1], ans[i] === s.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SLOTS.every((s, j) => ans[j] === s.right)) done();
      }));
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const RIGHT = 1;
    const opts = [
      "Read the delivery notes that drivers photograph on their phones",
      "Total last month's invoice amounts per supplier, from the payments database",
      "Sort incoming supplier emails into invoice, complaint or other"
    ].map(s => opt(kit, s));
    const fb = [
      ["Photos vary: light, angle, handwriting. There is no exact method, so a model fits, with a test, a bar and a check, the same way as the invoices.", false],
      ["Right. The amounts are already stored as numbers, and a sum has one right answer. A database query gets it every time. A model would add an error rate where there was none, and you would have to explain that error rate.", true],
      ["Emails are free text with no fixed format, and a wrong sort is cheap to fix. That is a good job for a model, with a small test to state how often it sorts wrong.", false]
    ];
    single(el, done, kit, ans => `<h1>When to explain it this way</h1>
      <p class="lead"><b>For:</b> any time people who are not engineers decide about an AI feature: to sell it, sign off its risk, or pay for it.</p>
      <p class="lead"><b>Reach for it</b> once you have a test on cases that look like the real ones. Speak in their unit, as “N out of M”; name what fails, what catches it, and the cost.</p>
      <p class="lead"><b>Not</b> before any test: then quote no numbers; say what you will measure, and when. And not for a job with one exact answer that code can compute: there the honest advice is “no model”.</p>
      <p class="lead"><b>Costs:</b> building and checking a test set before you can answer; measuring again when suppliers, formats or the model change; and a smaller scope than people asked for.</p>
      <p class="task">Three requests arrive on Monday. Which one do you answer with “we don't need a model for this”?</p>
      <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 10. Recognise it in new situations, including a "no model" case and a "no numbers yet" case. */
  const CHOICES = ["Give test numbers and a scope", "Measure first: no numbers yet", "No model: an exact method exists"];
  const CASES = [
    ["A clinic's tool that summarises visit notes was tested on a few hundred real notes, each checked by a doctor. The clinic manager now asks the doctors' committee to approve it.", 0,
      "Yes. A test exists, so tell the committee in their unit: how many summaries out of how many left something out, what kind of thing (a changed dose, an allergy), and who reads the summary before it is used.",
      { 1: "The test is done: a few hundred notes, checked by doctors. Saying “no numbers yet” now hides what you know. Give them in the doctors' unit.", 2: "There is no formula for a good summary; that is why a model was used. The question is how often it misses something, and the test answers that." }],
    ["On the first day of a project, a director asks whether AI can sort customs documents into the right category, and how accurate it will be.", 1,
      "Right. Nothing has been tested, so any number is a guess that will be quoted back at you. Say what you will measure (for example, a few hundred past documents whose category is known), the unit, and when you will have the answer.",
      { 0: "There is no test yet, so there are no numbers to give. A guessed figure on day one becomes the promise everyone remembers.", 2: "Sorting free-form documents has no exact method; people do it by reading. A model may fit. You just cannot say how well before you test it." }],
    ["HR asks for an AI that works out each employee's remaining holiday days from the holiday table.", 2,
      "Right. It is arithmetic on a table: days allowed minus days taken. A query or a spreadsheet formula is right every time. A model would bring an error rate into a job that had none.",
      { 0: "You could test a model on it, but why? Subtraction on stored numbers has one right answer that code always gets. The honest scope is “no model”.", 1: "Nothing needs measuring: the method is known and exact. Measuring a model here only tells you how often it gets simple arithmetic wrong." }],
    ["A warehouse tested a model that reads handwritten pallet labels from photos, on photos from its own site, with every label checked by hand. The site manager asks whether staff can stop typing the labels in by hand.", 0,
      "Yes. There is a test, so answer him in pallets: how many out of how many were read wrong, which kind (torn labels, glare), and what still catches them, such as a check against the delivery's order list.",
      { 1: "The test is done, on the site's own photos. He needs those numbers now, in pallets, not a promise to measure later.", 2: "Reading handwriting from a photo, with torn labels and glare, has no exact method; that is why a model was tried. Give the test result and a check." }]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>What would you say?</h1>
        <p class="lead">Four requests from other teams. For each, choose how you would answer: give test numbers and a scope, measure first, or advise against a model.</p>
        <p class="task">Pick an answer for each. Pick again if you change your mind.</p>
        ${CASES.map(([q, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(CHOICES, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : no[ans[i]], ans[i] === r)}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can say what it can and cannot do</h1>
      <p class="lead">You turned one test into three answers: invoices for the sales lead, a check and its gap for the lawyer, a corrected cost for the finance manager. You saw that zero mistakes in ${TYPED} cases still allows about ${per100(upper(TYPED))} in 100, and you wrote a scope with a bar that names its test.</p>
      <p class="lead"><b>Practice:</b> this lesson was the practice. Next time someone asks for an AI that “never makes mistakes”, answer with N out of M, the failing cases, the check, and a bar.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You can now explain a feature's limits to managers; next you look at a job post the same way, separating what it really needs from the rest.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Explaining what an AI feature can and cannot do",
    checked: "2026-11-18",
    sources: [
      "https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-how-well-the-system-can-do-what-it-can-do/",
      "https://pair.withgoogle.com/chapter/errors-failing/",
      "https://platform.claude.com/docs/en/test-and-evaluate/define-success",
      "https://jamanetwork.com/journals/jama/fullarticle/385438",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC2550668/"
    ],
    interview: [
      {
        q: "A director says: your invoice model is 97% accurate, so we can switch off manual review. How do you answer?",
        good: [
          "Ask 97% of what: field accuracy hides how many whole invoices have a mistake (here 1 in 10)",
          "Say where the mistakes are: all on scanned paper invoices, none on typed ones in the test",
          "Name the check before payment (matching the purchase order), what it caught and the case that slipped through",
          "Zero mistakes on a small test is not 100%: with 0 in n the rate can still be about 3/n",
          "Propose a scope: automate typed invoices with a stated bar and test size, keep people on scans and mismatches"
        ],
        weak: "“Yes, 97% is very high” or “No, AI makes mistakes”, with no unit, no failing cases and no check."
      },
      {
        q: "Before anything is built, a sales lead wants an accuracy number for a customer pitch. What do you do?",
        good: [
          "Do not quote a number: nothing has been measured, and the first number said becomes the promise",
          "Agree what counts as a mistake in the customer's unit (an invoice, a ticket, a document)",
          "Build a test set from real cases, large enough for the bar you want to state",
          "Report it as N out of M, with the cases that fail and what catches them, and date it"
        ],
        weak: "Give an estimate from a demo or from the model vendor's benchmark. It is not measured on this task, and it will be quoted back."
      }
    ],
    screens: [request, sales, legal, finance, spotIdea, hundred, howMany, scope, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SLOTS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
