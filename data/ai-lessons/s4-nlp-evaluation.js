/* Lesson: scoring NLP output with span F1, BLEU and ROUGE. Story: a local news app tags names, dates and amounts
   in city council minutes and writes a one-sentence summary of each meeting; the scores look fine, and a reader
   finds a summary that gets the bike-lane vote backwards.
   Ideas: (1) entity-level span F1 counts a whole entity, exact boundaries and type, so one boundary slip is a
   false positive AND a false negative, and word-level accuracy hides it; (2) ROUGE and BLEU count word sequences
   shared with a reference (ROUGE leans on recall, BLEU on precision plus a brevity penalty); they do not check
   whether a sentence is true, so a summary with a flipped fact can score highest.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s4-nlp-evaluation/v2-entities-openai (entity list from
     the minutes, request made by docs/ai-path/runs/s4-nlp-evaluation/make_requests_v2.mjs) and v5-summary-1..8
     (eight summaries of the meeting transcript, make_requests_v5.mjs). Earlier setups (entities, entities-loose,
     summary-1..6, v2-summary-*, v3-summary-*, v4-summary-*, v2-entities, v2-entities-deepseek) gave no summary
     with the vote backwards and are not shown;
   - docs/ai-path/runs/s4-nlp-evaluation/score.py + score.out.txt: span F1, ROUGE-1/2 and BLEU from scratch,
     cross-checked against rouge-score and sacrebleu, the word-tag comparison, and the traced bleu() run.
   The minutes, the transcript, the editor's entity list and reference summary are written by the lesson author.
   Lesson-local style: tappable span chips and word buttons (.lx-s4-nlp-evaluation-*), see ensureStyle(). */
(() => {
  const ID = "s4-nlp-evaluation";
  const f2 = x => x.toFixed(2);

  /* ---------- Inputs written by the lesson author ---------- */
  // The minutes as sent in docs/ai-path/recordings/s4-nlp-evaluation/v2-entities-openai.json (request.messages[1])
  const MINUTES = "Westbrook City Council, regular meeting, Tuesday 4 November 2026.\nPresent: Mayor Helen Ruiz and Councillors Tom Becker, Amara Osei, Lin Zhao, Peter Novak, Grace Adeyemi and Sam Ferris.\n1. Harbor Road bike lane. Councillor Becker moved to cancel the $1.2 million contract with Coastline Paving Ltd and stop the Harbor Road bike lane. The motion failed, 3 votes to 4 (Becker, Novak and Ferris for; Ruiz, Osei, Zhao and Adeyemi against). Work begins on Monday 2 March 2027.\n2. Library roof. The council approved $310,000 from the reserve fund for the Central Library roof.\n3. Public comment. Dana Morales of the Westbrook Cyclists Club spoke in favour of the bike lane.";
  // The editor's list (score.py GOLD) and guide
  const GOLD = [["Westbrook City Council", "ORG"], ["Tuesday 4 November 2026", "DATE"], ["Helen Ruiz", "PER"], ["Tom Becker", "PER"], ["Amara Osei", "PER"], ["Lin Zhao", "PER"], ["Peter Novak", "PER"], ["Grace Adeyemi", "PER"], ["Sam Ferris", "PER"], ["$1.2 million", "MONEY"], ["Coastline Paving Ltd", "ORG"], ["Monday 2 March 2027", "DATE"], ["$310,000", "MONEY"], ["Dana Morales", "PER"], ["Westbrook Cyclists Club", "ORG"]];
  const GUIDE = ["A person is the name only, without a title such as Mayor or Councillor.", "A building is a place, not an organisation.", "Dates and amounts exactly as written. Each entity once."];
  // From docs/ai-path/runs/s4-nlp-evaluation/make_requests_v5.mjs (the vote lines of the transcript)
  const VOTE_LINES = [
    "CR BECKER: … I move that we cancel the one point two million dollar contract with Coastline Paving and stop the Harbor Road bike lane. …",
    "MAYOR RUIZ: All those in favour of stopping the bike lane? Three. Against? Four. The motion fails."
  ];
  const REFERENCE = "The council voted 4-3 against stopping the Harbor Road bike lane and approved $310,000 for library roof repairs."; // score.py
  const FRAGMENT = "the Harbor Road bike lane"; // score.py, written by hand, not model output

  /* ---------- Recorded model output ---------- */
  // From docs/ai-path/recordings/s4-nlp-evaluation/v2-entities-openai.json (the JSON list, not altered)
  const REC_ENT = {
    src: "s4-nlp-evaluation/v2-entities-openai",
    provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    spans: [["Westbrook City Council", "ORG"], ["Tuesday 4 November 2026", "DATE"], ["Mayor Helen Ruiz", "PER"], ["Councillors Tom Becker", "PER"], ["Amara Osei", "PER"], ["Lin Zhao", "PER"], ["Peter Novak", "PER"], ["Grace Adeyemi", "PER"], ["Sam Ferris", "PER"], ["$1.2 million", "MONEY"], ["Coastline Paving Ltd", "ORG"], ["Monday 2 March 2027", "DATE"], ["$310,000", "MONEY"], ["Central Library", "ORG"], ["Dana Morales", "PER"], ["Westbrook Cyclists Club", "ORG"]]
  };
  // From docs/ai-path/recordings/s4-nlp-evaluation/v5-summary-1..8.json (full answers, not altered).
  // wrong = the vote is backwards (the lesson author's reading of each answer against the transcript).
  const REC_SUM = {
    src: "s4-nlp-evaluation/v5-summary-1 … v5-summary-8",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13", temperature: 1.5,
    all: [
      ["Council votes against canceling the Harbor Road bike lane contract and unanimously approves library roof repairs.", false],
      ["Council rejected a $1.2M bike lane contract and unanimously approved $310K for the library roof.", true],
      ["Council cancels Harbor Road bike lane project but approves library roof repairs.", true],
      ["Council votes to keep Harbor Road bike lane, approves library roof funds.", false],
      ["Council voted to stop the Harbor Road bike lane and approved library roof repairs.", true],
      ["City Council voted against canceling the Harbor Road bike lane and unanimously approved library roof repairs.", false],
      ["Council rejects Harbor Road bike lane proposal but approves library roof repair.", true],
      ["Council votes against cancelling the Harbor Road bike lane but approves library roof repairs.", false]
    ]
  };
  const PICK = [8, 5, 4]; // the three the lesson shows, as A, B, C (summary numbers in the recording)
  const SUMS = PICK.map((n, k) => ({ label: "ABC"[k], n, text: REC_SUM.all[n - 1][0], wrong: REC_SUM.all[n - 1][1] }));
  const CAPTION = `Recorded model output, ${REC_SUM.recordedAt}`;

  // score.out.txt: the word-by-word comparison of the same entity answer (words split on spaces)
  const WORDS_TOTAL = 111, WORDS_SAME = 107, WORDS_IN_GOLD = 36;
  // score.out.txt: the sacrebleu cross-check value for summary 5 (B)
  const SACREBLEU_B = 0.3828;

  // bleu() from score.py, line for line (line 0 = def)
  const CODE = [
    "def bleu(summary, reference):",
    "    summary_words, reference_words = words(summary), words(reference)",
    "    log_total = 0.0",
    "    for n in range(1, 5):",
    "        summary_grams = ngrams(summary_words, n)",
    "        clipped = sum((summary_grams & ngrams(reference_words, n)).values())",
    "        if clipped == 0:",
    "            return 0.0",
    "        log_total += math.log(clipped / sum(summary_grams.values()))",
    "    ratio = len(summary_words) / len(reference_words)",
    "    brevity = 1.0 if ratio > 1 else math.exp(1 - 1 / ratio)",
    "    return brevity * math.exp(log_total / 4)"
  ];
  // score.out.txt "bleu trace, summary 5": [line about to run, event, n, clipped, log_total, ratio, brevity]
  const TRACE = [[1,"l",null,null,null,null,null],[2,"l",null,null,null,null,null],[3,"l",null,null,0.0,null,null],[4,"l",1,null,0.0,null,null],[5,"l",1,null,0.0,null,null],[6,"l",1,12,0.0,null,null],[8,"l",1,12,0.0,null,null],[3,"l",1,12,-0.15415067982725836,null,null],[4,"l",2,12,-0.15415067982725836,null,null],[5,"l",2,12,-0.15415067982725836,null,null],[6,"l",2,9,-0.15415067982725836,null,null],[8,"l",2,9,-0.15415067982725836,null,null],[3,"l",2,9,-0.5218754599525758,null,null],[4,"l",3,9,-0.5218754599525758,null,null],[5,"l",3,9,-0.5218754599525758,null,null],[6,"l",3,6,-0.5218754599525758,null,null],[8,"l",3,6,-0.5218754599525758,null,null],[3,"l",3,6,-1.215022640512521,null,null],[4,"l",4,6,-1.215022640512521,null,null],[5,"l",4,6,-1.215022640512521,null,null],[6,"l",4,4,-1.215022640512521,null,null],[8,"l",4,4,-1.215022640512521,null,null],[3,"l",4,4,-2.226623552191001,null,null],[9,"l",4,4,-2.226623552191001,null,null],[10,"l",4,4,-2.226623552191001,0.7,null],[11,"l",4,4,-2.226623552191001,0.7,0.6514390575310556],[11,"r",4,4,-2.226623552191001,0.7,0.6514390575310556]];

  /* ---------- The same scoring, in the page (matches score.out.txt) ---------- */
  const words = t => t.toLowerCase().match(/[a-z0-9]+/g) || [];
  const ngrams = (ws, n) => { const c = new Map(); for (let i = 0; i + n <= ws.length; i++) { const k = ws.slice(i, i + n).join(" "); c.set(k, (c.get(k) || 0) + 1); } return c; };
  const total = c => [...c.values()].reduce((a, b) => a + b, 0);
  const shared = (a, b) => [...a].reduce((s, [k, v]) => s + Math.min(v, b.get(k) || 0), 0);
  function rouge(s, r, n) {
    const sg = ngrams(words(s), n), rg = ngrams(words(r), n), o = shared(sg, rg);
    const p = o / total(sg), rc = o / total(rg);
    return { overlap: o, sumN: total(sg), refN: total(rg), p, r: rc, f: o ? 2 * p * rc / (p + rc) : 0 };
  }
  function bleu(s, r) {
    const sw = words(s), rw = words(r);
    let lt = 0;
    for (let n = 1; n <= 4; n++) { const sg = ngrams(sw, n), c = shared(sg, ngrams(rw, n)); if (!c) return 0; lt += Math.log(c / total(sg)); }
    const ratio = sw.length / rw.length;
    return (ratio > 1 ? 1 : Math.exp(1 - 1 / ratio)) * Math.exp(lt / 4);
  }
  const key = ([t, y]) => t + "|" + y;
  const GOLD_SET = new Set(GOLD.map(key)), PRED = REC_ENT.spans, PRED_SET = new Set(PRED.map(key));
  const BAD = PRED.map((s, i) => GOLD_SET.has(key(s)) ? -1 : i).filter(i => i >= 0);
  const MISSED = GOLD.filter(g => !PRED_SET.has(key(g)));
  const TP = PRED.length - BAD.length;
  const SP = TP / PRED.length, SR = TP / GOLD.length, SF = 2 * SP * SR / (SP + SR);
  SUMS.forEach(s => { s.r1 = rouge(s.text, REFERENCE, 1); s.r2 = rouge(s.text, REFERENCE, 2); s.bleu = bleu(s.text, REFERENCE); });
  const TOP = SUMS.reduce((a, b) => b.r2.f > a.r2.f ? b : a);
  const WRONG = SUMS.find(s => s.wrong);
  const C_HITS = words(SUMS[2].text).map((w, i) => words(REFERENCE).includes(w) ? i : -1).filter(i => i >= 0);
  const FLIPPED = REC_SUM.all.filter(a => a[1]).length;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-doc { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--sunk); font-size: 15px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-guide { margin: 10px 0 0; padding-left: 20px; font-size: 15px; line-height: 1.5; }
      .lx-${ID}-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; }
      .lx-${ID}-chip { min-height: 44px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: 500 14.5px/1.3 var(--font); text-align: left; cursor: pointer; }
      .lx-${ID}-chip small { display: block; font: 600 11.5px/1.3 var(--mono); color: var(--muted); letter-spacing: .04em; }
      .lx-${ID}-chip.no { border: 2px solid var(--bad); background: var(--bad-soft); text-decoration: line-through; }
      .lx-${ID}-chip.ok { border: 2px solid var(--good); background: var(--good-soft); }
      .lx-${ID}-chip.miss { border-style: dashed; cursor: default; }
      .lx-${ID}-sum { margin: 10px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); font-size: 16px; line-height: 1.5; }
      .lx-${ID}-sum b { font-family: var(--mono); margin-right: 6px; }
      .lx-${ID}-sum.lx-${ID}-flag { border-left-color: var(--bad); }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); }
    `;
    document.head.appendChild(s);
  }
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const chip = (kit, [t, y], cls, i, btn) => btn
    ? `<button type="button" class="lx-${ID}-chip ${cls}" data-i="${i}" aria-pressed="${cls ? "true" : "false"}">${kit.esc(t)}<small>${kit.esc(y)}</small></button>`
    : `<span class="lx-${ID}-chip ${cls}">${kit.esc(t)}<small>${kit.esc(y)}</small></span>`;
  const sumBlock = (kit, s, flag) => `<div class="lx-${ID}-sum${flag ? ` lx-${ID}-flag` : ""}"><b>${s.label}</b>${kit.esc(s.text)}</div>`;
  const sumsHtml = (kit, flag) => `${SUMS.map(s => sumBlock(kit, s, flag && s.wrong)).join("")}<p class="lx-${ID}-cap">${CAPTION}</p>`;

  /* 1. The situation, and the first job by hand: which predicted entities count? */
  function spansByHand({ el, done, kit }) {
    ensureStyle();
    const found = new Set();
    let wrongPick = null;
    const paint = () => {
      const all = BAD.every(i => found.has(i));
      el.innerHTML = `<h1>Is the tagger right?</h1>
        <p class="lead">A local news app covers Westbrook's city council. For each meeting it does two jobs with a language model: it tags the people, organisations, dates and money in the clerk's minutes (for search), and it writes a one-sentence summary. Each tagged item is called an <b>entity</b>. The team checks both jobs with automatic scores, and the scores look fine. Then a reader writes in: a summary got the bike-lane vote backwards.</p>
        <p class="lead">This lesson is about those scores: the numbers a team uses to check model output before and after each change. To see what they can and cannot catch, start with the tags.</p>
        <div class="lx-${ID}-doc">${kit.esc(MINUTES)}</div>
        <p class="lead">An editor tagged these minutes by hand, following a short guide:</p>
        <ul class="lx-${ID}-guide">${GUIDE.map(g => `<li>${kit.esc(g)}</li>`).join("")}</ul>
        <p class="lead">A small hosted model was asked for the same list. Its answer:</p>
        <div class="lx-${ID}-chips">${PRED.map((s, i) => chip(kit, s, found.has(i) ? "no" : "", i, true)).join("")}</div>
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="task">An entity counts only if its words and its type match the editor's entity exactly. Tap every entity in the model's answer that does not count (${BAD.length - found.size} left).</p>
        <div class="lpanel">${wrongPick != null ? kit.feedback(`“${kit.esc(PRED[wrongPick][0])}” as ${kit.esc(PRED[wrongPick][1])} follows the guide: same words, same type. It counts.`, false) : ""}
        ${all ? kit.feedback(`Right, these ${BAD.length} do not count. Two carry a title the guide leaves out, and the Central Library is a building, which the guide calls a place. The editor's list also has two entities the model never gave in the right form: ${MISSED.map(m => `“${kit.esc(m[0])}”`).join(" and ")}.`, true) : found.size ? kit.feedback(`Yes, “${kit.esc(PRED[[...found].pop()][0])}” does not match the guide. Keep going.`) : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-chip[data-i]`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (BAD.includes(i)) { found.add(i); wrongPick = null; } else wrongPick = i;
        paint();
        if (BAD.every(j => found.has(j))) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: a boundary slip costs twice. */
  function costsTwice({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Nothing: the name is in there, so it is close enough", "One mistake: a wrong entity in the answer", "Two mistakes: a wrong entity in the answer, and a right one missing"];
    const fb = [
      ["Exact-match scoring gives no credit for close. Search for “Helen Ruiz” as a person and this tag does not help: the tagged text is a different string.", false],
      ["That counts only half of it. Look at the editor's list: “Helen Ruiz” is in it, and the model never gave it. That is a second mistake.", false],
      [`Right. “Mayor Helen Ruiz” is a <b>false positive</b> (in the answer, not in the editor's list), and “Helen Ruiz” is a <b>false negative</b> (in the editor's list, not in the answer). So one slip at the edge of an entity (a <b>boundary</b> error: an extra word, or a missing one) lowers both numbers:
        <br>precision = correct / given = ${TP} / ${PRED.length} = <b>${f2(SP)}</b>
        <br>recall = correct / in the editor's list = ${TP} / ${GOLD.length} = <b>${f2(SR)}</b>
        <br>F1 = 2 × precision × recall / (precision + recall) = <b>${f2(SF)}</b>
        <br>This is <b>entity-level span F1</b>: the same precision and recall you know, but the thing being counted is a whole entity, with exact boundaries and the right type. The CoNLL-2003 shared task (a public contest in entity tagging) scores named entities the same way (exact match), but counts every mention in the text; the editor's guide here lists each entity once, so each counts once.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>How much does a title cost?</h1>
        <p class="lead">The model's answer next to the editor's list. Struck through: the ones that do not match.</p>
        <p class="lead"><b>Model gave</b> (${PRED.length})</p>
        <div class="lx-${ID}-chips">${PRED.map((s, i) => chip(kit, s, BAD.includes(i) ? "no" : "", i, false)).join("")}</div>
        <p class="lead"><b>Editor's list, not in the answer</b> (${MISSED.length})</p>
        <div class="lx-${ID}-chips">${MISSED.map((s, i) => chip(kit, s, "miss", i, false)).join("")}</div>
        <p class="task">How many mistakes does “Mayor Helen Ruiz” cost the model?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 3. Word-level accuracy against span F1: which to report. */
  function wordsVsSpans({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const acc = WORDS_SAME / WORDS_TOTAL, outside = WORDS_TOTAL - WORDS_IN_GOLD, lazy = outside / WORDS_TOTAL;
    const opts = [`Word accuracy, ${Math.round(acc * 100)}%: it looks at every word, so it is more detailed`, `Span F1, ${f2(SF)}: search works on whole entities, and most words are not in any entity`, "The average of the two, to be fair to the model"];
    const fb = [
      [`More words checked is not more useful. ${outside} of the ${WORDS_TOTAL} words are in no entity at all, and they are easy. A tagger that tags <b>nothing</b> would still agree on those ${outside} words: ${Math.round(lazy * 100)}% word accuracy, while finding zero entities.`, false],
      [`Right. Word accuracy is pushed up by the ${outside} words that belong to no entity, and it calls “Mayor Helen Ruiz” two words out of three right. The search box needs “Helen Ruiz”, whole. Span F1 counts what the product uses: whole entities. Report it per type too (PER, DATE, MONEY), because one type can fail while the total looks fine.`, true],
      ["An average of two numbers that measure different things means nothing on its own. Pick the one that measures what the product needs.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Two numbers for one answer</h1>
        <p class="lead">You can also score the same answer word by word: tag each of the ${WORDS_TOTAL} words of the minutes with its entity type (or none), from the editor's list and from the model's, and count the words where they agree.</p>
        ${kit.meter([{ label: "words that agree", value: WORDS_SAME, max: WORDS_TOTAL }, { label: "words in all", value: WORDS_TOTAL, max: WORDS_TOTAL }])}
        <p class="lead">That is ${Math.round(acc * 1000) / 10}% word accuracy. Span F1 on the same answer was ${f2(SF)}.</p>
        <p class="task">The product team asks one number for “how good are the search tags”. Which do you give them?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. ROUGE-1 by hand: which words of a summary are in the reference? */
  function rougeByHand({ el, done, kit }) {
    ensureStyle();
    const C = SUMS.find(s => s.label === "C");
    const sw = words(C.text), refSet = new Set(words(REFERENCE));
    const hits = sw.map((w, i) => refSet.has(w) ? i : -1).filter(i => i >= 0);
    const found = new Set();
    let miss = null;
    const near = w => words(REFERENCE).find(r => r !== w && r.slice(0, 4) === w.slice(0, 4));
    const paint = () => {
      const all = hits.every(i => found.has(i));
      const r1 = C.r1;
      el.innerHTML = `<h1>Count shared words</h1>
        <p class="lead">Now the summaries. To score them, the editor wrote one reference summary of the meeting by hand. The usual score, <b>ROUGE</b>, compares a machine summary with such a reference. Its simplest form, ROUGE-1, counts the words they share.</p>
        <p class="lead"><b>Editor's reference:</b> ${kit.esc(REFERENCE)}</p>
        <p class="lead"><b>A machine summary</b>, split into words the way ROUGE does it (small letters, punctuation dropped):</p>
        <div class="lx-${ID}-chips">${sw.map((w, i) => `<button type="button" class="lx-${ID}-chip ${found.has(i) ? "ok" : miss === i ? "no" : ""}" data-i="${i}">${kit.esc(w)}</button>`).join("")}</div>
        <p class="task">Tap every word of the summary that also appears in the reference (${hits.length - found.size} left).</p>
        <div class="lpanel">${miss != null ? kit.feedback(near(sw[miss]) ? `“${kit.esc(sw[miss])}” is not in the reference; “${kit.esc(near(sw[miss]))}” is. Plain ROUGE matches exact words, so a different ending is a different word. (The rouge-score package can cut endings first, but it is off unless you turn it on, and our scores used it off.)` : `“${kit.esc(sw[miss])}” is not in the reference.`, false) : ""}
        ${all ? kit.feedback(`Right, ${r1.overlap} shared words. ROUGE-1 for this summary:
          <br>The reference, split the same way, has ${r1.refN} words: “4-3” becomes “4” and “3”, and “$310,000” becomes “310” and “000”.
          <br>recall = shared / words in the reference = ${r1.overlap} / ${r1.refN} = <b>${f2(r1.r)}</b>
          <br>precision = shared / words in the summary = ${r1.overlap} / ${r1.sumN} = <b>${f2(r1.p)}</b>
          <br>F1 = <b>${f2(r1.f)}</b>
          <br>ROUGE was built for summaries and puts the weight on recall: how much of the reference the summary covers. ROUGE-2 does the same with word pairs (“bike lane”, “lane and”), which rewards the right word order.`, true) : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-chip[data-i]`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (hits.includes(i)) { found.add(i); if (miss === i) miss = null; } else miss = i;
        if (hits.every(j => found.has(j))) miss = null;
        paint();
        if (hits.every(j => found.has(j))) done();
      });
    };
    paint();
  }

  /* 5. Predict: which of three summaries scores highest? */
  function predictTop({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const ix = SUMS.indexOf(TOP);
    const table = () => kit.table(SUMS.map(s => [s.label, `ROUGE-1 ${f2(s.r1.f)} · ROUGE-2 ${f2(s.r2.f)}`]), { head: ["summary", "F1 against the reference"], hit: ix });
    const fb = SUMS.map((s, i) => i === ix
      ? [`Right, ${s.label} has the most words and word pairs in common with the reference.${table()}Our from-scratch code and the rouge-score package gave the same numbers.`, true]
      : [`${s.label} shares fewer words and pairs with the reference. ${s.label === "C" ? "You counted its words on the last screen." : "“votes against cancelling” has no pair in common with “voted 4-3 against stopping”."} Look for the summary whose wording is closest to the editor's.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>Which summary wins?</h1>
        <p class="lead">A small hosted model wrote eight summaries of the meeting, from the video transcript, with its temperature set high (${REC_SUM.temperature}). Temperature is a setting that makes the wording more random, so the eight came out different. Here are three of them.</p>
        <p class="lead"><b>Reference:</b> ${kit.esc(REFERENCE)}</p>
        ${sumsHtml(kit, false)}
        <p class="task">Which one gets the highest ROUGE-2 score?</p>
        <div class="lpanel">${ask(kit, SUMS.map(s => `Summary ${s.label}`), ix, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === ix) done(); });
    };
    paint();
  }

  /* 6. Spot the idea: the top score states the wrong result. */
  function holdBack({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const wi = SUMS.indexOf(WRONG);
    const opts = [...SUMS.map(s => `Summary ${s.label}`), `None: ${TOP.label} scored highest, so it is the best`];
    const fb = [...SUMS.map((s, i) => i === wi
      ? [`Right. ${s.label} says the council voted to <b>stop</b> the bike lane. The vote went the other way: 3 for stopping, 4 against. ${s.label} still tops every score, because it reuses the reference's words: “voted”, “the Harbor Road bike lane and approved”, “library roof repairs”. The reference says “voted 4-3 against stopping”; ${s.label} says “voted to stop”. The few words that differ are the ones that decide the story. <b>ROUGE measures how many words and word pairs you share with a reference, not whether what you say is true.</b> In this run ${FLIPPED} of the ${REC_SUM.all.length} summaries got the vote backwards.`, true]
      : [`${s.label} is correct: ${s.label === "A" ? "voting against cancelling means the lane stays" : "“keep the bike lane” is what happened"}. It just uses different words from the editor's, so it scores lower.`, false]),
      [`The score only says ${TOP.label}'s words are closest to the editor's. Read it against the transcript: is the vote result right?`, false]];
    const paint = () => {
      el.innerHTML = `<h1>The reader's complaint</h1>
        <p class="lead">What was said in the meeting, from the transcript:</p>
        <div class="lx-${ID}-doc">${VOTE_LINES.map(l => kit.esc(l)).join("\n")}</div>
        ${SUMS.map(s => `${sumBlock(kit, s, false)}<p class="lx-${ID}-cap">ROUGE-1 ${f2(s.r1.f)} · ROUGE-2 ${f2(s.r2.f)}</p>`).join("")}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="task">The editor can publish two. Which one do you hold back?</p>
        <div class="lpanel">${ask(kit, opts, wi, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === wi) done(); });
    };
    paint();
  }

  /* 7. BLEU: precision with a brevity penalty. Predict the score of a short fragment. */
  function bleuFragment({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const fw = words(FRAGMENT).length, rw = words(REFERENCE).length;
    const b = bleu(FRAGMENT, REFERENCE), rr = rouge(FRAGMENT, REFERENCE, 1);
    const bp = Math.exp(1 - rw / fw);
    const opts = ["1.00: every word sequence in it is in the reference", `About ${f2(b)}`, "0.00: it has no 4-word sequence in common"];
    const fb = [
      [`That is what precision alone would give, and it is why BLEU adds a penalty. Otherwise a system could score perfectly by writing only the few words it is sure of.`, false],
      [`Right: ${f2(b)}. Every 1- to 4-word sequence of the fragment is in the reference, so the precision part is 1. But the fragment has ${fw} words against the reference's ${rw}, and the <b>brevity penalty</b> e<sup>(1 − ${rw}/${fw})</sup> = ${f2(bp)} scales it down. BLEU was built for machine translation and is precision-first: <b>how much of what you wrote is in the reference</b>, then a penalty for writing too little. ROUGE-1 recall for the fragment is ${f2(rr.r)}: it misses most of the reference. Note too that BLEU gives 0 when any of the four sizes has no match at all, which can easily happen on one short sentence. Its authors meant it to be computed over a whole test set, not one sentence.`, true],
      [`“the harbor road bike” and “harbor road bike lane” are 4-word sequences, and both are in the reference. BLEU is 0 only when one of the four sizes has no match at all.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>BLEU: precision, with a penalty</h1>
        <p class="lead">The other common score is <b>BLEU</b>. ROUGE asked how much of the reference the summary covers. BLEU turns the question around: of the word sequences the system wrote (1, 2, 3 and 4 words long), what share is in the reference? Each sequence counts only as often as it appears in the reference (“clipping”). The four shares are combined by a geometric mean (multiply the four, then take the fourth root).</p>
        <p class="lead">One last factor, the <b>brevity penalty</b>, lowers the score when the output is shorter than the reference.</p>
        <p class="lead">Take a fragment written by hand, not by a model: <span class="lx-${ID}-mono">${kit.esc(FRAGMENT)}</span></p>
        <p class="lead"><b>Reference:</b> ${kit.esc(REFERENCE)}</p>
        <p class="task">What BLEU score does the fragment get?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b2 => b2.onclick = () => { ans = +b2.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. BLEU from scratch in Python: a stepped replay of the traced run on summary B. */
  const B_WORDS = words(WRONG.text);
  const GRAMS = [1, 2, 3, 4].map(n => B_WORDS.length - n + 1); // n-grams in summary B per size
  const SHOWN_AFTER = new Set([5, 8, 9, 10, 11]); // show the state just after these lines ran
  const FR = (() => {
    const fr = [{ ln: 2, v: TRACE[2] }];
    for (let k = 1; k < TRACE.length; k++) {
      const ran = TRACE[k - 1][0];
      if (TRACE[k][1] === "r") { fr.push({ ln: 11, v: TRACE[k], end: true }); continue; }
      if (SHOWN_AFTER.has(ran) && ran !== 11) fr.push({ ln: ran, v: TRACE[k] });
    }
    return fr;
  })();
  function bleuCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const say = f => {
      const [, , n, clipped, lt, ratio, brev] = f.v;
      if (f.end) return `Line 11 combines them: the brevity penalty ${f2(brev)} times e to the power of the average log, ${f2(lt)} / 4. BLEU = <b>${f2(brev * Math.exp(lt / 4))}</b>, the highest of the three summaries, for the one that is wrong. (The sacrebleu package, with smoothing off and its own rule for splitting words, gave ${f2(SACREBLEU_B)}.)`;
      if (f.ln === 2) return `<code>words</code> splits both texts the same way as before: B has ${B_WORDS.length} words, the reference ${words(REFERENCE).length}. The sum of logs starts at 0.`;
      if (f.ln === 5) return `n = ${n}. B has ${GRAMS[n - 1]} sequences of ${n} word${n > 1 ? "s" : ""}; <b>${clipped}</b> of them are in the reference (clipped: a sequence counts at most as often as the reference has it).`;
      if (f.ln === 8) return `Not zero, so it adds log(${clipped} / ${GRAMS[n - 1]}) = log(${f2(clipped / GRAMS[n - 1])}). The running sum is ${f2(lt)}.`;
      if (f.ln === 9) return `All four sizes matched something. Length check: B is ${f2(ratio)} times as long as the reference.`;
      if (f.ln === 10) return `B is shorter than the reference, so the brevity penalty is e<sup>(1 − 1/${f2(ratio)})</sup> = ${f2(brev)}.`;
      return "";
    };
    const paint = () => {
      const f = FR[i], [, , n, clipped, lt, ratio, brev] = f.v;
      el.innerHTML = `<h1>BLEU, written from scratch</h1>
        <p class="lead">This is the whole of BLEU for one summary, in plain Python. <code>words</code> is the splitting rule you used; <code>ngrams</code> counts the word sequences of one size (a Python <code>Counter</code>, a dict of counts); <code>&</code> on two Counters keeps the smaller count of each key, which is the clipping. The code adds up the log of each share and divides by 4 at the end: that gives the same result as multiplying the four shares and taking the fourth root. The run scores summary B against the reference.</p>
        <p class="task">Step through to the end. Watch which number pulls the score down most.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>n <b>${n == null ? "–" : n}</b></span><span>clipped <b>${clipped == null ? "–" : clipped}</b></span><span>log_total <b>${lt == null ? "–" : f2(lt)}</b></span><span>brevity <b>${brev == null ? "–" : f2(brev)}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(say(f))}
        ${f.end ? `<p class="lead">Two things pulled it down. The four shares together multiply it by ${f2(Math.exp(lt / 4))}, most of all the 4-word share, ${TRACE[21][3]} of ${GRAMS[3]}, the smallest of the four. The brevity penalty multiplies it by ${f2(brev)}. The program never looked at what the words mean: “to stop” and “against stopping” are just sequences that match or do not.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Computing power to run the scoring", "A reference written by a person for every test item", "A paid model call per score"];
    const fb = [
      ["Counting shared words is cheap: the scores in this lesson took a few lines of Python and no special hardware.", false],
      ["Right. Every test item needs a human reference (or an editor's entity list), and when the meetings change, new references are needed. That labelling is the real cost. The scores themselves are nearly free.", true],
      ["None of these scores calls a model. They compare text with text.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for which score</h1>
        <p class="lead"><b>Span F1:</b> for extraction, where an entity is right or wrong as a whole. <b>BLEU:</b> made for translation, comparing system versions over a whole test set. <b>ROUGE:</b> made for summaries, used the same way.</p>
        <p class="lead"><b>When:</b> all three are cheap, give the same number every run, and are good at catching a version that got worse.</p>
        <p class="lead"><b>When not:</b> to check that a sentence is true. A flipped vote, a wrong amount or an invented name can keep almost every word. For that, check each claim against the source, by a person or by an automatic check (later lessons in the path build such checks). Also not for open answers with many good wordings: a correct summary in other words scores low.</p>
        <p class="task">The team wants ROUGE on next month's meetings. What does it cost most to get?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise: which check fits each new situation? */
  const FLIP = rouge("The motion passed.", "The motion failed.", 1); // same pair as score.py "flip"
  const CHOICES = ["Span F1", "BLEU", "ROUGE", "None: check the fact"];
  const CASES = [
    ["A pharmacy app pulls drug names and doses from label photos. A pharmacist has listed the right ones for 200 labels.", 0,
      ["Right. A dose with a missing unit is as wrong as no dose. Score whole entities, exact boundaries, per type."],
      "Drug names and doses are entities: a dose either matches the pharmacist's exactly or it does not. That is span F1."],
    ["A city translates its notices into Spanish. Professional translations exist for 500 old notices. You compare two versions of the translation system on them.", 1,
      ["Right. Translation over a whole test set, with reference translations, is what BLEU was made for."],
      "This is translation, compared over a whole set with reference translations: what BLEU was made for."],
    ["A chatbot answers “Did the motion pass?”. The minutes say it failed. The bot says “The motion passed.”", 3,
      [`Right. Against the true sentence “The motion failed.”, ROUGE-1 F1 is ${f2(FLIP.f)}: two words out of three shared. The one word that matters is the one that differs. Compare the answer's claim with the recorded outcome itself.`],
      `Any overlap score gives this answer credit: ROUGE-1 F1 against “The motion failed.” is ${f2(FLIP.f)}. The question is whether one fact is right, so check the fact against the minutes.`],
    ["You change the summarizer's prompt and want to know, before shipping, whether summaries of 300 past meetings got worse. Editors wrote references for all 300.", 2,
      ["Right. Comparing versions of a summarizer on a fixed set with references is what ROUGE is good at. Read a sample by hand as well: a drop in ROUGE says something changed, not what."],
      "These are summaries with references, and you compare two versions: ROUGE fits. Add a hand-read sample for facts."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which check fits?</h1>
        <p class="lead">Four situations from other jobs.</p>
        <p class="task">Pick the check that fits each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, right, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(CHOICES, { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(ans[i] === right ? yes[0] : `${kit.esc(CHOICES[ans[i]])} does not fit here. ${no}`, ans[i] === right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 11. What next: a short Python exercise follows, then the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can score it, and you know what the score misses</h1>
      <p class="lead">You scored entities as whole spans, where one extra title costs a false positive and a false negative. You counted shared words for ROUGE, saw BLEU's brevity penalty in code, and found the summary that won every score while getting the vote backwards.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>span_f1</code> and <code>rouge_n</code> yourself and check them against the numbers in this lesson.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here you split text into words with one simple rule; next you count tokens the way a model does.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Scoring NLP output: span F1, BLEU and ROUGE",
    checked: "2026-11-14",
    sources: [
      "https://aclanthology.org/P02-1040/",
      "https://aclanthology.org/W04-1013/",
      "https://aclanthology.org/W03-0419/",
      "https://aclanthology.org/2020.acl-main.173/",
      "https://github.com/google-research/google-research/tree/master/rouge",
      "https://github.com/mjpost/sacrebleu"
    ],
    interview: [
      {
        q: "After a model change, your summarizer's ROUGE went up, but editors say there are more wrong facts. How do you explain it, and what do you add?",
        good: [
          "ROUGE counts words and word pairs shared with a reference; it does not check whether claims are true",
          "A flipped fact such as a vote result can change one word and keep a high score",
          "Add a check of claims against the source: hand review of a sample, or an automatic check such as an entailment model or a judge",
          "Build a small set of known traps (double negatives, vote counts, amounts) and track errors on it",
          "Keep ROUGE as a cheap signal that a version changed, not as the quality number"
        ],
        weak: "Say ROUGE went up so the model is better, or switch to BLEU, which counts words the same way."
      },
      {
        q: "Your entity tagger shows 96% accuracy, but users say names in search are often wrong. What is going on?",
        good: [
          "Word or token accuracy is padded by the many words that are no entity at all",
          "Score at entity level: exact boundaries and type, precision, recall and F1",
          "A boundary slip such as an included title is a false positive and a false negative at once",
          "Report F1 per entity type and read the errors to see if a guideline is missing (titles, buildings)"
        ],
        weak: "Say 96% is high so the tagger is fine, without asking what is being counted."
      }
    ],
    screens: [spansByHand, costsTwice, wordsVsSpans, rougeByHand, predictTop, holdBack, bleuFragment, bleuCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="0"]'], right: BAD.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="1"]'], right: C_HITS.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
