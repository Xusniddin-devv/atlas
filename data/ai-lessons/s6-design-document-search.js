/* Lesson: mock interview, search over company documents. Story: a construction company with twenty years of
   specs and safety reports wants staff to ask questions instead of digging through shared drives; Tomas, a site
   foreman at Riverside Tower, asks about night slab pours.
   Ideas: (1) permissions belong inside the search query, so a file the asker may not open is never a candidate
   (filtering citations after the answer hides the leak, it does not stop it); (2) freshness is data in the index
   (status, sync), not a hope about the model; (3) measure finding (recall@3 on a golden set) and hiding (a leak
   test) separately.
   Data, all real:
   - docs/ai-path/runs/s6-design-document-search/doc_search.py + doc_search.out.txt: eight short documents (made up
     for the lesson), indexed with SQLite FTS5; the draft answer(), the fixed search(), the freshness runs, the
     golden set and the leak test. Python 3.12.11, SQLite 3.53.4, standard library only (env.txt).
   - recordings (main checkout) docs/ai-path/recordings/s6-design-document-search/draft-past and fixed-past: the
     model's answer to the same question, built from the draft and from the fixed search.
   Lesson-local style: a document list and a reply block (.lx-s6-design-document-search-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s6-design-document-search";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the run and the recordings ---------- */
  // From doc_search.py DOCS: [doc_id, title, readers, status, text]
  const DOCS = [
    ["SPEC-RT-03-C", "Riverside Tower slab concrete spec, revision C", ["engineering", "site-riverside"], "superseded",
      "Riverside Tower slab concrete spec, revision C. Slab pour: concrete grade C32/40. Minimum concrete temperature at the time of the pour: 5 C. Cure the slab for at least 7 days under covers."],
    ["SPEC-RT-03-D", "Riverside Tower slab concrete spec, revision D", ["engineering", "site-riverside"], "current",
      "Riverside Tower slab spec, revision D, replaces revision C. Grade C35/45. Concrete must be at least 10 C when placed. Keep covers on for 10 days. Changed after the 2024 cold-weather incident."],
    ["SPEC-HB-11", "Harbour Bridge pier concrete spec", ["engineering", "site-harbour"], "current",
      "Harbour Bridge pier concrete spec. Pier pours use grade C40/50 with a minimum concrete temperature of 10 C. Marine exposure class XS3."],
    ["SAFE-05", "Cold-weather concreting procedure", ["all-staff"], "current",
      "Cold-weather concreting procedure, all sites. Below 5 C air temperature, heat the aggregates, cover fresh concrete and log temperatures every 4 hours."],
    ["SR-2021-008", "Near miss: pump hose burst, Riverside Tower", ["site-riverside", "safety"], "current",
      "Near miss report, Riverside Tower, 2021. During a slab pour a pump hose burst. Nobody was hurt. Hoses are now pressure-tested before every pour."],
    ["HR-2024-031", "Disciplinary review after an injury, Riverside Tower", ["hr", "safety-managers"], "current",
      "Disciplinary review, Riverside Tower, 2024. Formworker Luis Ortega broke a wrist when he slipped on ice during a night slab pour. The review found that the night supervisor, Mark Dunn, skipped the cold-weather checklist. Dunn received a final written warning."],
    ["LEGAL-2025-007", "Subcontractor claim over a delayed pour", ["legal", "directors"], "current",
      "Claim by subcontractor Brightform Ltd over the delayed slab pour at Riverside Tower in 2024. Our lawyers estimate a settlement of about 180,000. Do not discuss with site staff."],
    ["SR-2016-022", "Formwork failure investigation, Dock Street", ["all-staff"], "current",
      "Formwork failure investigation, Dock Street, 2016. A formwork prop failed during a slab pour because props were spaced wider than the drawing. Props are now checked by an engineer before every pour."]
  ];
  const USERS = { tomas: ["all-staff", "site-riverside"], ines: ["all-staff", "site-harbour", "engineering"] }; // doc_search.py USERS
  const SYSTEM = "You answer questions from construction company staff. Use only the documents given. After each fact, cite the document id in square brackets, like [SAFE-05]."; // doc_search.py SYSTEM

  // doc_search.py answer() and search(), line for line
  const CODE_DRAFT = [
    "def answer(question, user):",
    "    hits = search_all(question, k=3)",
    "    context = [doc_id for doc_id, score in hits]",
    "    reply = call_model(question, context, \"draft-past\")",
    "    citations = [d for d in context if can_read(user, d)]",
    "    return reply, citations"
  ];
  const CODE_SEARCH = [
    "def search(question, groups, k=3):",
    "    marks = \",\".join(\"?\" * len(groups))",
    "    sql = f\"\"\"SELECT doc_id, bm25(docs) FROM docs",
    "        WHERE docs MATCH ?",
    "          AND doc_id IN (SELECT doc_id FROM acl WHERE grp IN ({marks}))",
    "          AND status = 'current'",
    "        ORDER BY bm25(docs) LIMIT ?\"\"\"",
    "    return db.execute(sql, [to_query(question), *groups, k]).fetchall()"
  ];

  // From doc_search.out.txt ([doc_id, bm25 as printed])
  const Q_PAST = "What went wrong on night slab pours at Riverside Tower?";
  const DRAFT_HITS = [["HR-2024-031", "-2.872"], ["SPEC-HB-11", "-1.775"], ["SPEC-RT-03-D", "-1.336"]];
  const DRAFT_CITATIONS = ["SPEC-RT-03-D"];
  const FIXED_HITS = [["SPEC-RT-03-D", "-1.336"], ["SR-2021-008", "-0.000"], ["SR-2016-022", "-0.000"]];
  const Q_TEMP = "What is the minimum concrete temperature for the Riverside slab pour?";
  const FRESH_ALL = [["SPEC-RT-03-C", "-2.243"], ["SPEC-HB-11", "-1.552"], ["SPEC-RT-03-D", "-0.907"]];
  const FRESH_FIX = [["SPEC-RT-03-D", "-0.907"], ["SAFE-05", "-0.505"], ["SR-2016-022", "-0.000"]];
  // Golden set: [user, question, the right file, what the fixed search returned]
  const GOLDEN = [
    ["tomas", Q_TEMP, "SPEC-RT-03-D", ["SPEC-RT-03-D", "SAFE-05", "SR-2016-022"]],
    ["tomas", "What do we do before a pour when it is cold?", "SAFE-05", ["SPEC-RT-03-D", "SR-2021-008", "SR-2016-022"]],
    ["tomas", "Has a pump hose ever burst on site?", "SR-2021-008", ["SR-2021-008", "SPEC-RT-03-D", "SR-2016-022"]],
    ["tomas", "Why did formwork collapse at Dock Street?", "SR-2016-022", ["SR-2016-022", "SPEC-RT-03-D"]],
    ["ines", "What concrete grade do the bridge piers use?", "SPEC-HB-11", ["SPEC-HB-11", "SPEC-RT-03-D", "SAFE-05"]],
    ["tomas", "What strength class is the tower floor concrete?", "SPEC-RT-03-D", ["SPEC-RT-03-D", "SAFE-05", "SR-2021-008"]]
  ];
  const DRAFT_GOLDEN_FOUND = 5; // "draft search_all on the same golden set: recall@3 = 5/6"
  // Leak test: [user, question, draft search_all returned, fixed search returned]
  const LEAK = [
    ["tomas", "Who got a warning after the ice accident on the slab pour?", ["HR-2024-031", "SPEC-RT-03-D", "SPEC-RT-03-C"], ["SPEC-RT-03-D", "SR-2016-022", "SR-2021-008"]],
    ["tomas", "How much will the Brightform claim settlement cost?", ["LEGAL-2025-007", "SPEC-RT-03-C", "HR-2024-031"], ["SAFE-05", "SR-2016-022", "SPEC-RT-03-D"]],
    ["tomas", "What exposure class do the Harbour Bridge piers need?", ["SPEC-HB-11", "LEGAL-2025-007", "SPEC-RT-03-C"], ["SAFE-05", "SR-2016-022", "SPEC-RT-03-D"]]
  ];

  // From docs/ai-path/recordings/s6-design-document-search/draft-past.json (not altered)
  const REC_DRAFT = {
    src: "s6-design-document-search/draft-past",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "The night supervisor, Mark Dunn, skipped the cold-weather checklist during a night slab pour at Riverside Tower. This resulted in formworker Luis Ortega breaking a wrist when he slipped on ice. [HR-2024-031]"
  };
  // From docs/ai-path/recordings/s6-design-document-search/fixed-past.json (not altered)
  const REC_FIXED = {
    src: "s6-design-document-search/fixed-past",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "There was a near miss report at Riverside Tower in 2021 where a pump hose burst during a slab pour. [SR-2021-008] To prevent this from happening again, hoses are now pressure-tested before every pour. [SR-2021-008]"
  };
  const CAPTION = `Recorded model output, ${REC_DRAFT.recordedAt}`;

  /* ---------- Derived from the data ---------- */
  const doc = id => DOCS.find(d => d[0] === id);
  const canRead = (user, id) => doc(id)[2].some(g => USERS[user].includes(g));
  const ids = rows => rows.map(r => r[0]);
  const citedIn = text => [...new Set((text.match(/\[([A-Z0-9-]+)\]/g) || []).map(s => s.slice(1, -1)))];
  const TOMAS = USERS.tomas;
  const MAY = DOCS.filter(d => canRead("tomas", d[0])).map(d => d[0]);
  const DRAFT_UNREADABLE = ids(DRAFT_HITS).filter(id => !canRead("tomas", id));
  const LEFT_AFTER_DROP = DRAFT_HITS.length - DRAFT_UNREADABLE.length;
  const GOLD_FOUND = GOLDEN.filter(g => g[3].includes(g[2])).length;
  const MISS = GOLDEN.find(g => !g[3].includes(g[2]));
  const leaksOf = k => LEAK.reduce((n, row) => n + row[k].filter(id => !canRead(row[0], id)).length, 0);
  const LEAK_DRAFT = leaksOf(2), LEAK_FIXED = leaksOf(3);
  const REV_C = doc("SPEC-RT-03-C"), REV_D = doc("SPEC-RT-03-D");

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-who { margin: 14px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-id { font: 600 14px var(--mono); color: var(--ink); overflow-wrap: anywhere; }
      .lx-${ID}-grp { font: 500 13.5px var(--mono); color: var(--muted); overflow-wrap: anywhere; }
      .lx-${ID}-doc { margin: 0; padding: 12px 0 2px; border-top: 1px solid var(--line); }
      .lx-${ID}-doc p { margin: 2px 0; font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-reply { margin: 14px 0 0; padding: 10px 12px; border-left: 3px solid var(--ink); background: var(--sunk); font-size: 16px; line-height: 1.55; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-txt { margin: 8px 0 0; padding: 8px 12px; border: 1px solid var(--line); border-radius: 6px; font-size: 15px; line-height: 1.5; }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }
  const groupsTxt = (kit, gs) => `<span class="lx-${ID}-grp">${gs.map(kit.esc).join(", ")}</span>`;
  const idTxt = (kit, id) => `<span class="lx-${ID}-id">${kit.esc(id)}</span>`;
  const reply = (kit, rec) => `<div class="lx-${ID}-reply">${kit.esc(rec.text)}</div><p class="lx-${ID}-cap">${CAPTION}</p>`;
  const hitsTable = (kit, rows, title, user) => kit.table(rows.map(([id, sc], i) => [`${i + 1}. ${id}`, user ? `${sc}  ·  ${canRead(user, id) ? "his" : "not his"}` : sc]), { head: ["file", user ? "bm25 · access" : "bm25 (smaller = better)"], title });
  const docText = (kit, d) => `<div class="lx-${ID}-txt">${idTxt(kit, d[0])} <span class="lx-${ID}-grp">(${kit.esc(d[3])})</span><br>${kit.esc(d[4])}</div>`;
  const rowList = (kit, rows, title) => `<p class="lx-${ID}-cap">${kit.esc(title)}</p><div class="lx-${ID}-rows">${rows.map(([a, b]) => `<div class="lx-${ID}-doc"><p>${kit.esc(a)}</p><p class="lx-${ID}-grp">${kit.esc(b)}</p></div>`).join("")}</div>`;
  const optLine = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s.trim())}</span>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }

  /* 1. The situation, and the by-hand task: which files may Tomas's answer cite? */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const ans = DOCS.map(() => null);
    const NOTE = {
      "SPEC-RT-03-C": "By access alone he may, through site-riverside. Whether an old revision should be cited at all is a different question; it comes back later.",
      "HR-2024-031": "It is about his own site and his kind of pour, so any search for his question will rank it high. That is exactly why access must be checked on every file, not guessed from the topic.",
      "LEGAL-2025-007": "It even names his site. Being about Riverside does not make it his to read."
    };
    const fbFor = (d, picked) => {
      const ok = canRead("tomas", d[0]);
      const shared = d[2].filter(g => TOMAS.includes(g));
      const why = ok ? `Readers include <b>${kit.esc(shared.join(", "))}</b>, and Tomas is in it.` : `Readers are ${kit.esc(d[2].join(", "))}. Tomas is in ${kit.esc(TOMAS.join(", "))}: no group in common.`;
      const right = (picked === 0) === ok;
      return kit.feedback(`${right ? "" : ok ? "He may. " : "He may not. "}${why}${NOTE[d[0]] ? " " + NOTE[d[0]] : ""}`, right);
    };
    const allRight = () => DOCS.every((d, i) => ans[i] === (canRead("tomas", d[0]) ? 0 : 1));
    const paint = () => {
      const fin = allRight();
      el.innerHTML = `<h1>Who may read what</h1>
        <p class="lead">Mock interview. The interviewer says: “A construction company has twenty years of specs and safety reports on shared drives. Staff want to ask questions instead of digging. Design it.” This is a RAG system, as in stage 5: a search finds the best few files, and a model answers from them. You start, as in the last lesson, with requirements. The one that shapes everything here: <b>an answer may only use files the person asking may open.</b></p>
        <p class="lead">Each file has a list of groups that may read it. One person asking:</p>
        <div class="lx-${ID}-who"><b>Tomas</b>, site foreman at Riverside Tower. His groups: ${groupsTxt(kit, TOMAS)}.<br>He asks: “${kit.esc(Q_PAST)}”</div>
        <p class="task">Going by the access rules, may Tomas's answer cite each file? A file is his if he is in at least one of its reader groups.</p>
        ${DOCS.map((d, i) => `<div class="lx-${ID}-doc lcase" id="c${i}"><p>${idTxt(kit, d[0])} ${kit.esc(d[1])}</p><p>readers: ${groupsTxt(kit, d[2])}</p>${kit.options(["May cite", "May not"], { picked: ans[i], correct: canRead("tomas", d[0]) ? 0 : 1 })}${ans[i] == null ? "" : fbFor(d, ans[i])}</div>`).join("")}
        ${fin ? `<div class="lpanel">${kit.feedback(`Right: ${MAY.length} of ${DOCS.length} files are his. Of the ${DOCS.length - MAY.length} he may not read, ${["HR-2024-031", "LEGAL-2025-007"].filter(id => !MAY.includes(id)).length} are about pours at his own site. Being relevant to the question and being allowed to read it are separate checks, and a search engine only does the first one unless you make it do the second.`, true)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint(); if (allRight()) done();
      }));
    };
    paint();
  }

  /* 2. Spot the idea: where does the access check go? */
  function whereCheck({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "In the prompt: tell the model to use only files the user may read",
      "After the search: take the best three files, then drop the ones he may not read",
      "Inside the search: his groups are part of the query, so a file he cannot read is never a candidate",
      "After the answer: hide citations to files he cannot open"
    ];
    const RIGHT = 2;
    const fb = [
      ["The model cannot check access: it does not know Tomas's groups, and once a restricted file's text is in the prompt, it has already been read. A sentence in a prompt is a request, not a lock.", false],
      [`Safe, but it starves him. For his question the best three files over the whole company held ${plural(DRAFT_UNREADABLE.length, "file")} he may not read, so he would get ${plural(LEFT_AFTER_DROP, "file")} instead of three. The filter has to run before the top-three cut, not after it.`, false],
      ["Right. The check is part of the search itself: rank only among files he may read, then take the best three. Nothing he cannot read ever reaches the prompt, so nothing can leak, and he still gets three of his own files. This is often called <b>security trimming</b> or a <b>security filter</b>.", true],
      ["By then the model has read the file and written about it. Hiding the source line does not remove the words from the answer. You will see this happen on the next screen.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where does the check go?</h1>
        <p class="lead">You know which files are his. The system answers in three steps: <b>search</b> the index for the best few files, put their text in the <b>prompt</b>, let the model <b>answer</b> with citations.</p>
        <p class="task">The interviewer asks: “Where exactly do you enforce access?”</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Broken on purpose: the draft design's real run, and the leak in it. */
  function brokenDraft({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { right: 0, opts: [1, 2, 3, 4].map(n => optLine(kit, `line ${n}: ${CODE_DRAFT[n]}`)),
        fb: [
          null,
          ["Line 2 only keeps the ids of whatever line 1 returned. The restricted files were already in <code>hits</code>.", false],
          [`The model did what the system prompt asked: “${kit.esc(SYSTEM.split(". ")[1])}.” It was given the HR file, so it used it. Line 3 is where the leak shows up, not where it starts.`, false],
          [`This line is why the leak was hard to see: Tomas's source list showed only ${kit.esc(DRAFT_CITATIONS.join(", "))}. But the reply already quotes the HR file and even prints its id. Hiding a citation does not remove the words.`, false]
        ] },
      { right: 2, opts: [
          "Add “never reveal HR or legal content” to the system prompt",
          "Remove unreadable ids from the reply text before showing it",
          "Pass Tomas's groups into the search, so unreadable files are never candidates",
          "Take HR and legal files out of the index"
        ],
        fb: [
          ["A prompt is not a lock. The model still reads the file, and the next restricted file may be a pay sheet or a tender, which the rule does not name.", false],
          ["The names Mark Dunn and Luis Ortega would still be in the sentences. Removing the id only removes the evidence of the leak.", false],
          null,
          ["Works for these two folders, today. Access is set per file and changes: the next restricted report in an ordinary site folder leaks the same way. And HR staff lose search over their own files.", false]
        ] }
    ];
    const paint = () => {
      const fin = stage === 2;
      el.innerHTML = `<h1>Broken on purpose: the draft design</h1>
        <p class="lead">A colleague's first draft, run for real on the company's files for Tomas's question. <code>search_all</code> ranks every file in the company; <code>can_read</code> checks his groups; <code>call_model</code> sends the files' text and the question to the model. The table shows the three files line 1 returned, each with its BM25 keyword score (here a smaller number is a better match) and whether Tomas may read it.</p>
        ${kit.code(CODE_DRAFT, fin ? 1 : -1)}
        ${hitsTable(kit, DRAFT_HITS, "search_all(question, k=3), from the run", "tomas")}
        <p class="lead">Citations shown to Tomas: ${DRAFT_CITATIONS.map(id => idTxt(kit, id)).join(", ")}. The reply he read:</p>
        ${reply(kit, REC_DRAFT)}
        <p class="lead">A small hosted model wrote this from the three files above.</p>
        ${fin ? "" : `<p class="task">${stage === 0 ? "Tomas reports that the answer named two colleagues and blamed one of them for an injury, facts from an HR file he may not open. Which line is the cause?" : "Which fix stops it for every file, not just this one?"}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. Line 1 asked for the best three files <b>in the whole company</b>; Tomas may not read ${DRAFT_UNREADABLE.length} of them (${kit.esc(DRAFT_UNREADABLE.join(", "))}). Everything after that was correct code working on the wrong input. The fix is a search that takes the user: <code>search(question, groups)</code>, built on the next screen.`, true) : ask(kit, Q[stage].opts, Q[stage].right, ans, Q[stage].fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 4. Library: the same search with SQLite FTS5, the user's groups inside the query. */
  function fixedSearch({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["HR-2024-031", "SPEC-HB-11", FIXED_HITS[0][0], "Nothing: every good match is restricted"].map(s => optLine(kit, s));
    const RIGHT = 2;
    const fb = [
      ["HR-2024-031 is not ranked low here; it is not ranked at all. Its readers (hr, safety-managers) are not in Tomas's groups, so the <code>doc_id IN (...)</code> condition removes it before ordering.", false],
      [`SPEC-HB-11 is readable by ${kit.esc(doc("SPEC-HB-11")[2].join(", "))}. Tomas is in neither, so it is not a candidate.`, false],
      null,
      [`The query only drops files he may not read. ${plural(MAY.length, "file")} are still his, and some share words with the question, so they still come back, ranked.`, false]
    ];
    const paint = () => {
      const ok = ans === RIGHT;
      el.innerHTML = `<h1>The search, with the user inside it</h1>
        <p class="lead">The fix, run for real on the same files with SQLite's built-in full-text index, <b>FTS5</b>. The <code>acl</code> table holds one row per file and reader group. Read the query in three parts.</p>
        <p class="lead">First, <code>docs MATCH ?</code> finds files that contain the question's words. (<code>to_query</code> joins the words with <code>OR</code>; otherwise FTS5 requires every word.)</p>
        <p class="lead">Second, <code>doc_id IN (SELECT ... WHERE grp IN (...))</code> keeps only files that one of his groups may read. <code>status = 'current'</code> drops old revisions.</p>
        <p class="lead">Third, <code>ORDER BY bm25(docs) LIMIT ?</code> ranks what is left by BM25 score and keeps the best <code>k</code>. In FTS5, a smaller score is a better match.</p>
        ${kit.code(CODE_SEARCH, ok ? 4 : -1)}
        <p class="task">Same question, <code>search(question, ${kit.esc(JSON.stringify(TOMAS).replace(/"/g, "'"))})</code>. Which file comes first?</p>
        <div class="lpanel">${ok ? `${kit.feedback(`Right: ${kit.esc(FIXED_HITS[0][0])}, then ${kit.esc(ids(FIXED_HITS).slice(1).join(" and "))}. The two restricted files that topped the draft are not lower down; they are not candidates at all. (A score printed as -0.000 is a very weak match, rounded to three places.)`, true)}
          ${hitsTable(kit, FIXED_HITS, "search(question, tomas's groups, k=3), from the run")}
          <p class="lead">The model, given these three files, answered:</p>${reply(kit, REC_FIXED)}
          <p class="lead">It does not mention the 2024 injury. That is correct: Tomas may not read the file that describes it. A permission-aware answer is sometimes less complete, and that is the requirement working. Hosted search services do the same. Azure AI Search documents a “security filter”: group ids stored in a filterable field, and every query filtered by the caller's groups. It also documents built-in document-level permissions for some data sources (checked 2026-11-14).</p>`
          : ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Freshness: an old revision wins on words. */
  function freshness({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { right: 1, opts: [optLine(kit, "SPEC-RT-03-D (revision D, current)"), optLine(kit, "SPEC-RT-03-C (revision C, superseded)")],
        fb: [["Newer is not something BM25 knows about. It scores matching words. Revision D says “at least 10 C when placed”; revision C says “minimum concrete temperature ... pour”, the question's own words.", false], null] },
      { right: 0, opts: [
          "Store each file's status when indexing, and filter to current files in the query",
          "Tell the model to prefer newer revisions",
          "Re-index the whole drive every night",
          "Use a larger model to answer"
        ],
        fb: [null,
          ["The model only sees what the search returns. With k=1, or when the new revision falls outside the top k, there is nothing newer to prefer. And it would be guessing which file is newer from the text.", false],
          ["Revision C is still on the drive, so a fresh index contains it again and it still wins on words. A fresh index is not the same as fresh facts.", false],
          ["The wrong file came from the search, before any model was called. A larger model reads the same superseded spec.", false]] }
    ];
    const paint = () => {
      const fin = stage === 2;
      el.innerHTML = `<h1>Freshness: the old spec wins</h1>
        <p class="lead">Tomas asks: “${kit.esc(Q_TEMP)}” Two revisions of the slab spec sit on the drive, and both are his to read. Each file's status is in brackets: current, or superseded (replaced by a newer revision).</p>
        ${docText(kit, REV_C)}${docText(kit, REV_D)}
        ${stage >= 1 ? hitsTable(kit, FRESH_ALL, "search_all: words only, no status and no user filter, from the run") : ""}
        ${fin ? hitsTable(kit, FRESH_FIX, "search() with status = 'current', from the run") : ""}
        ${fin ? "" : `<p class="task">${stage === 0 ? "Rank by words only, as the draft's search_all does (no status filter; no user filter either, so files he cannot read may appear too). Which revision comes out higher?" : `Revision C came first: an answer built on it says ${kit.esc(REV_C[4].match(/\d+ C/)[0])}, the spec says ${kit.esc(REV_D[4].match(/\d+ C/)[0])}. What is the reliable fix?`}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. With <code>status = 'current'</code> in the query, ${kit.esc(FRESH_FIX[0][0])} comes first and revision C is gone. Freshness is data you keep in the index: a status or “replaced by” field, set when a new revision lands, and a sync job that also removes deleted files and updates changed access lists. Old revisions stay searchable for people who ask for history on purpose.`, true) : ask(kit, Q[stage].opts, Q[stage].right, ans, Q[stage].fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 6. Citations: a check you can run on every reply. */
  function citations({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const sent = { draft: ids(DRAFT_HITS), fixed: ids(FIXED_HITS) };
    const passes = (rec, key) => citedIn(rec.text).every(id => sent[key].includes(id) && canRead("tomas", id));
    const C = [
      { title: "The draft's reply", body: reply(kit, REC_DRAFT), right: passes(REC_DRAFT, "draft") ? 0 : 1,
        yes: `Fail. It cites ${kit.esc(citedIn(REC_DRAFT.text).join(", "))}, which was in the prompt but which Tomas may not read. Run on every reply, this check would have caught the leak before he saw it, even with the broken search.`,
        no: `It cites ${kit.esc(citedIn(REC_DRAFT.text).join(", "))}. It was in the prompt, but check the second half of the rule: may Tomas read it?` },
      { title: "The fixed reply", body: reply(kit, REC_FIXED), right: passes(REC_FIXED, "fixed") ? 0 : 1,
        yes: `Pass. Every id it cites (${kit.esc(citedIn(REC_FIXED.text).join(", "))}) was in the prompt and is his to read.`,
        no: `Look again: it cites only ${kit.esc(citedIn(REC_FIXED.text).join(", "))}, which the fixed search returned for Tomas and which he may read.` },
      { title: "The fixed reply passes. Does that prove each sentence says what its cited file says?", body: "", right: 1, opts: ["Yes", "No"],
        yes: "Right, it does not. The check only proves the ids are allowed. Whether a sentence matches its file is a separate check: compare the sentence with the cited text, by a person or an evaluator. Here it does: the file says hoses are now pressure-tested before every pour.",
        no: "The check looks only at ids. A reply can cite an allowed file and still misstate it. Matching each sentence against its file is a separate check." }
    ];
    const paint = () => {
      el.innerHTML = `<h1>Check the citations</h1>
        <p class="lead">Citations let Tomas open the file and check. They also give you something a program can test on every reply, before anyone reads it. The rule: <b>every id in square brackets must be a file that went into the prompt and that the user may read.</b> Prompt for the draft: ${ids(DRAFT_HITS).map(id => idTxt(kit, id)).join(", ")}. Prompt for the fix: ${ids(FIXED_HITS).map(id => idTxt(kit, id)).join(", ")}.</p>
        <p class="task">Apply the rule to each reply, then answer the last question.</p>
        ${C.map((c, i) => {
          const opts = c.opts || ["Pass", "Fail"];
          return `<div class="lcase" id="c${i}"><p><b>${kit.esc(c.title)}</b></p>${c.body}${kit.options(opts, { picked: ans[i], correct: c.right })}${ans[i] == null ? "" : kit.feedback(ans[i] === c.right ? c.yes : c.no, ans[i] === c.right)}</div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint(); if (C.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 7. Measure it: recall@3 on a golden set, and a separate leak test. */
  function measure({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const N = GOLDEN.length;
    const choices = [GOLD_FOUND - 1, GOLD_FOUND, N].filter((v, i, a) => v >= 0 && a.indexOf(v) === i);
    const Q = [
      { right: choices.indexOf(GOLD_FOUND), opts: choices.map(v => `${v} / ${N}`),
        fb: choices.map(v => v === GOLD_FOUND ? null : [v > GOLD_FOUND
          ? `Check the row for “${kit.esc(MISS[1])}”: the right file, ${kit.esc(MISS[2])}, is not in the three that came back.`
          : `Count again: only the row for “${kit.esc(MISS[1])}” is missing its right file. Every other row has it somewhere in the top three.`, false]) },
      { right: 1, opts: [
          "The draft is as good as the fix",
          "Recall cannot see leaks: you need a separate leak test with an expected count of zero",
          "Six questions are too few to mean anything"
        ],
        fb: [
          ["On finding the right file, yes. But the draft is the design that showed Tomas a disciplinary warning. A score that rates both the same is not measuring the leak.", false],
          null,
          ["A real golden set is larger, and should be. But even a large one asks “did the right file come back?”, never “did a forbidden one come back?”. More questions of the same kind would not catch the leak.", false]] }
    ];
    const rowsGold = GOLDEN.map(g => [`${g[0]}: ${g[1]}`, `want ${g[2]} · got ${g[3].join(", ")} · ${g[3].includes(g[2]) ? "found" : "missed"}`]);
    const leakRows = LEAK.map(r => [`${r[0]}: ${r[1]}`, `files he may not read: draft ${r[2].filter(id => !canRead(r[0], id)).length} · fixed ${r[3].filter(id => !canRead(r[0], id)).length}`]);
    const paint = () => {
      const fin = stage === 2;
      el.innerHTML = `<h1>How do you know it finds the right files?</h1>
        <p class="lead">The interviewer: “How would you measure it?” Start with a <b>golden set</b>: real questions, each paired with the file that answers it, asked as a real user with that user's groups. Then <b>recall@3</b>: for each question, did its right file come back in the top 3? Here each question has one right file, so recall@3 is the share of questions where it did.</p>
        ${rowList(kit, rowsGold, "Golden set: the fixed search(), top 3, from the run")}
        ${stage >= 1 ? `<p class="lead">The draft <code>search_all</code> found the right file for ${DRAFT_GOLDEN_FOUND} of the same ${N} questions.</p>` : ""}
        ${fin ? rowList(kit, leakRows, "Leak test: questions aimed at restricted files, from the run") : ""}
        ${fin ? "" : `<p class="task">${stage === 0 ? "What is recall@3 for the fixed search?" : `Recall@3 is ${GOLD_FOUND} / ${N} for the fix and ${DRAFT_GOLDEN_FOUND} / ${N} for the draft. What does that tell you?`}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. A leak test asks, as each test user, questions aimed at files that user may not read, and counts restricted files returned. Over ${plural(LEAK.length, "question")}: draft ${LEAK_DRAFT}, fix ${LEAK_FIXED}. Its target is exactly zero, and it runs on every change to the search, the index or the sync. Recall is the score you try to raise. The leak count is a gate: anything above zero blocks the change. The one miss (${kit.esc(MISS[2])}) is a ranking problem: other files matched the words better. Try embedding search alongside keywords and re-measure on the same set.`, true) : ask(kit, Q[stage].opts, Q[stage].right, ans, Q[stage].fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "At once: the search reads the drive's permissions on every question",
      "After the next sync copies the new access list into the index",
      "Only when someone edits the file"
    ];
    const RIGHT = 1;
    const fb = [
      ["The search reads the index, not the drive. In this design the readers live in the <code>acl</code> table, a copy made at indexing time.", false],
      ["Right. The index holds a copy of each file's readers, so a change reaches answers only when the sync copies it. That gap is a real cost: keep it short, and treat access changes as urgent updates, not as a nightly batch.", true],
      ["The sync should copy access changes even when the content does not change. If it only re-reads edited files, a file someone was removed from stays readable to them in search.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to build this</h1>
        <p class="lead"><b>For:</b> many documents, written in words, that people need to question in their own words, with citations so they can check.</p>
        <p class="lead"><b>Reach for it</b> when files have different readers and old versions pile up.</p>
        <p class="lead"><b>Not</b> when the answer is a count or a sum over records (query the database), when people already know which file they want (a file name search), or when the files are few and public (a plain search page).</p>
        <p class="lead"><b>Costs:</b> a sync pipeline for content, status and access; a golden set and a leak test to keep up; one model call per question; and answers that are only as fresh as the last sync.</p>
        <p class="task">On Monday, HR removes the site-riverside group from a report's readers. When does that change reach Tomas's answers?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where it is the wrong tool. */
  const CASES = [
    ["A law firm wants lawyers to ask questions across ten years of past contracts. Each client's files may only be read by the team that worked for that client.", true,
      "Yes. Many documents, questions in plain words, and readers that differ per file: the client team's groups go into the search query, and every answer cites the contract it came from.",
      "Each client's contracts have their own readers, and lawyers ask in plain words across thousands of pages. That is this design, with the team groups inside the query."],
    ["A site manager asks: how many concrete deliveries did each site receive last month? The deliveries are rows in the purchasing database.", false,
      "No. The answer is a count over records, not a passage in a document. Searching text would return a few delivery notes, and the model would count only those. Query the database (a model can help write the query).",
      "A search returns a few top matches, never all the rows, so any count built on them is wrong. This needs a database query that counts every delivery."],
    ["A hospital wants doctors to ask questions about its clinical guidelines. All staff may read every guideline, but each one is revised every year or two.", true,
      "Yes. Access is simple here, but freshness is the risk: an old revision that wins on words could give a wrong dose. Status in the index and a fast sync matter most.",
      "Permissions are simple, but the old-revision problem from the slab spec is exactly the risk here. Questions in plain words over many revised documents fit this design."],
    ["An engineer wants to open drawing DWG-4471 and knows its number.", false,
      "No. He knows exactly which file he wants. A lookup by file name or number does it instantly, with no ranking and no model call.",
      "There is nothing to search for in meaning: the number names one file. A file name lookup is faster, cheaper and never wrong about which file."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>This design or not?</h1>
        <p class="lead">Four requests from other companies. “This design” means: search over documents that respects each file's readers and status, and a model that answers with citations.</p>
        <p class="task">Would you build each one this way? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>Your answer, in order</h1>
      <p class="lead">You can now give this answer in an interview: <b>requirements</b> (who may read what, how fresh it must be, citations); <b>data</b> (an index with each file's readers and status, kept in sync); <b>retrieval</b> (the user's groups and the status inside the query, before the top-k cut); <b>generation</b> (answer only from the files given, cite ids, check the ids); <b>evaluation</b> (recall@k on a golden set, and a leak test that must stay at zero); <b>cost and failures</b> (sync lag, a stale revision, a filter applied too late).</p>
      <p class="lead">This lesson is the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The same method, but the system acts instead of answering, so permissions become tool permissions and a review gate.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Mock interview: search over company documents",
    checked: "2026-11-14",
    sources: [
      "https://www.sqlite.org/fts5.html",
      "https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search",
      "https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview",
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-rank-eval"
    ],
    interview: [
      {
        q: "You are designing question answering over a company's shared drives, where files have different readers. A colleague proposes filtering the citations after the model answers. What do you say?",
        good: [
          "That hides the source, not the content: the model already read the restricted file and can quote it",
          "Put the user's groups into the search query, so restricted files are never candidates and never reach the prompt",
          "Filter before the top-k cut, so the user still gets k of his own files",
          "Keep each file's readers in the index and sync access changes quickly",
          "Add a leak test: questions aimed at restricted files, asked as test users, with zero restricted results as a release gate"
        ],
        weak: "Agree, and add a line to the prompt telling the model not to reveal restricted content. A prompt is not an access control, and the text has already been read."
      },
      {
        q: "Staff say the document assistant quotes an outdated safety spec. How do you find the cause, fix it and show it is fixed?",
        good: [
          "Look at what the search returned for that question: is the old revision ranked above the new one?",
          "Old revisions often win on words because they share the question's wording; ranking does not know dates",
          "Store a status or replaced-by field at indexing time and filter to current files in the query",
          "Make the sync update status, deletions and access, not only new files",
          "Add the question to the golden set with the current revision as the right file, and check recall@k again"
        ],
        weak: "Re-index everything or switch to a bigger model. The old file is still on the drive and still matches, so both leave the cause in place."
      }
    ],
    screens: [byHand, whereCheck, brokenDraft, fixedSearch, freshness, citations, measure, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c5 [data-wrong]"], right: DOCS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
