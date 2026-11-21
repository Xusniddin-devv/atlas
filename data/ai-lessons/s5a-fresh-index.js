/* Lesson: keeping retrieval data fresh. Story: an airline's internal help bot for airport staff keeps quoting the
   old 7 kg carry-on rule two weeks after the policy page was replaced by a 10 kg cabin-baggage page.
   Ideas: (1) the index only matches the source if the ingest job compares what it indexed last time (a manifest:
   doc_id -> hash of the text) with what exists now, and acts on the difference: add, replace (delete every old
   chunk of the document, then add), delete, or skip; a job that only loops over today's files and upserts can
   never remove anything; (2) when the embedding model changes, every vector must be rebuilt in a new index,
   because vectors from two models cannot be compared, even at the same size.
   Data, all real:
   - docs/ai-path/runs/s5a-fresh-index/policies.py: the two folder snapshots and the week's change log (made-up
     policies written for this lesson); store.py: the tiny index, embeddings from local Ollama (all-minilm);
   - broken_job.py + broken_job.out.txt: the upsert-only nightly job, its index listing and the stale search hits;
   - sync_trace.py + sync_trace.out.txt: the manifest-based sync(), traced line by line on the second night,
     both manifests, the index after it and the fresh hits;
   - reembed.py + reembed.out.txt: switching to snowflake-arctic-embed:22m, query side only against a full re-embed;
   - recordings (main checkout) docs/ai-path/recordings/s5a-fresh-index/stale-answer and fresh-answer: the bot's
     answer from the stale hits and from the fresh hits (requests made by make_requests.py).
   Lesson-local style: chunk rows, a file listing, a step-order picker (.lx-s5a-fresh-index-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s5a-fresh-index";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const fixed3 = v => v.toFixed(3);

  /* ---------- Data copied from the runs and recordings ---------- */
  // policies.py
  const QUESTION = "What is the carry-on weight limit?";
  const FOLDER_NOW = ["baggage/cabin-baggage.md", "baggage/delayed-bags.md", "checkin/web-checkin.md", "lounges/lounge-access.md", "baggage/sports-equipment.md"];
  const OLD_PAGE = "baggage/carry-on-rules.md", NEW_PAGE = "baggage/cabin-baggage.md";
  const CHANGE_LOG = [
    ["created", "baggage/cabin-baggage.md"],
    ["deleted", "baggage/carry-on-rules.md"],
    ["edited", "baggage/delayed-bags.md"],
    ["renamed", "checkin/online-checkin.md", "checkin/web-checkin.md"],
    ["saved", "lounges/lounge-access.md"]
  ];
  // sync_trace.out.txt: "manifest after night 1" and "manifest after night 2"
  const MANIFEST1 = { "baggage/carry-on-rules.md": "e48cc598", "baggage/delayed-bags.md": "082d56cd", "checkin/online-checkin.md": "1017c78c", "lounges/lounge-access.md": "d99932ef", "baggage/sports-equipment.md": "dd631daf" };
  const MANIFEST2 = { "baggage/cabin-baggage.md": "3531cfaf", "baggage/delayed-bags.md": "68881f49", "checkin/web-checkin.md": "1017c78c", "lounges/lounge-access.md": "d99932ef", "baggage/sports-equipment.md": "dd631daf" };

  // broken_job.py, line for line from its def
  const BROKEN_CODE = [
    "def nightly_ingest(folder, index):",
    "    for doc_id, text in folder.items():",
    "        for n, chunk in enumerate(split_paragraphs(text)):",
    "            index.upsert(f\"{doc_id}#{n}\", doc_id, chunk)"
  ];
  // broken_job.out.txt
  const BROKEN = {
    night1: { chunks: 12, embedded: 12 }, night2: { chunks: 17, embedded: 11 }, folderChunks: 11,
    listing: [["baggage/cabin-baggage.md", 3], ["baggage/carry-on-rules.md", 3], ["baggage/delayed-bags.md", 4], ["baggage/sports-equipment.md", 1], ["checkin/online-checkin.md", 2], ["checkin/web-checkin.md", 2], ["lounges/lounge-access.md", 2]],
    delayed: [
      ["baggage/delayed-bags.md#0", "Delayed bags. If a bag did not arrive, open a report at the baggage desk before the passenger leaves the airport."],
      ["baggage/delayed-bags.md#1", "Send the passenger the report number and the tracking link by text message."],
      ["baggage/delayed-bags.md#2", "Bags not found after 3 days are handed to the central tracing team. The passenger may claim essential purchases; ask them to keep the receipts."],
      ["baggage/delayed-bags.md#3", "Bags not found after 5 days are handed to the central tracing team."]
    ],
    hits: [
      [0.730, "baggage/carry-on-rules.md#0", "Carry-on rules. Each passenger may bring one carry-on bag. The carry-on weight limit is 7 kg."],
      [0.482, "baggage/cabin-baggage.md#0", "Cabin baggage. Each passenger may bring one cabin bag of up to 10 kg and one personal item that fits under the seat."],
      [0.456, "baggage/carry-on-rules.md#2", "Heavier carry-on bags are tagged at the gate and go in the hold, free of charge."]
    ]
  };
  const DELAYED_NEW_PARAS = 3, DELAYED_OLD_PARAS = 4; // policies.py: paragraphs of delayed-bags.md after and before
  // sync_trace.out.txt
  const FRESH = {
    embedded: 8, chunks: 11,
    hits: [
      [0.482, "baggage/cabin-baggage.md#0", "Cabin baggage. Each passenger may bring one cabin bag of up to 10 kg and one personal item that fits under the seat."],
      [0.419, "baggage/cabin-baggage.md#2", "Cabin bags over 10 kg are tagged at the gate and go in the hold for a fee."],
      [0.344, "baggage/sports-equipment.md#0", "Sports equipment. Skis, golf bags and bicycles travel as checked baggage and must be booked 24 hours ahead."]
    ]
  };
  // sync() from sync_trace.py, line for line (line 0 = def)
  const SYNC_CODE = [
    "def sync(folder, index, manifest):",
    "    seen = {}",
    "    for doc_id, text in folder.items():",
    "        h = content_hash(text)",
    "        seen[doc_id] = h",
    "        if manifest.get(doc_id) == h:",
    "            continue",
    "        index.delete_doc(doc_id)",
    "        index.add_doc(doc_id, split_paragraphs(text))",
    "    for doc_id in manifest.keys() - seen.keys():",
    "        index.delete_doc(doc_id)",
    "    return seen"
  ];
  // sync_trace.out.txt trace rows: [line about to run, event, doc_id, h, index]
  const TRACE = [[1,"line",null,null,"<index: 12 chunks>"],[2,"line",null,null,"<index: 12 chunks>"],[3,"line","baggage/cabin-baggage.md",null,"<index: 12 chunks>"],[4,"line","baggage/cabin-baggage.md","3531cfaf","<index: 12 chunks>"],[5,"line","baggage/cabin-baggage.md","3531cfaf","<index: 12 chunks>"],[7,"line","baggage/cabin-baggage.md","3531cfaf","<index: 12 chunks>"],[8,"line","baggage/cabin-baggage.md","3531cfaf","<index: 12 chunks>"],[2,"line","baggage/cabin-baggage.md","3531cfaf","<index: 15 chunks>"],[3,"line","baggage/delayed-bags.md","3531cfaf","<index: 15 chunks>"],[4,"line","baggage/delayed-bags.md","68881f49","<index: 15 chunks>"],[5,"line","baggage/delayed-bags.md","68881f49","<index: 15 chunks>"],[7,"line","baggage/delayed-bags.md","68881f49","<index: 15 chunks>"],[8,"line","baggage/delayed-bags.md","68881f49","<index: 11 chunks>"],[2,"line","baggage/delayed-bags.md","68881f49","<index: 14 chunks>"],[3,"line","checkin/web-checkin.md","68881f49","<index: 14 chunks>"],[4,"line","checkin/web-checkin.md","1017c78c","<index: 14 chunks>"],[5,"line","checkin/web-checkin.md","1017c78c","<index: 14 chunks>"],[7,"line","checkin/web-checkin.md","1017c78c","<index: 14 chunks>"],[8,"line","checkin/web-checkin.md","1017c78c","<index: 14 chunks>"],[2,"line","checkin/web-checkin.md","1017c78c","<index: 16 chunks>"],[3,"line","lounges/lounge-access.md","1017c78c","<index: 16 chunks>"],[4,"line","lounges/lounge-access.md","d99932ef","<index: 16 chunks>"],[5,"line","lounges/lounge-access.md","d99932ef","<index: 16 chunks>"],[6,"line","lounges/lounge-access.md","d99932ef","<index: 16 chunks>"],[2,"line","lounges/lounge-access.md","d99932ef","<index: 16 chunks>"],[3,"line","baggage/sports-equipment.md","d99932ef","<index: 16 chunks>"],[4,"line","baggage/sports-equipment.md","dd631daf","<index: 16 chunks>"],[5,"line","baggage/sports-equipment.md","dd631daf","<index: 16 chunks>"],[6,"line","baggage/sports-equipment.md","dd631daf","<index: 16 chunks>"],[2,"line","baggage/sports-equipment.md","dd631daf","<index: 16 chunks>"],[9,"line","baggage/sports-equipment.md","dd631daf","<index: 16 chunks>"],[10,"line","checkin/online-checkin.md","dd631daf","<index: 16 chunks>"],[9,"line","checkin/online-checkin.md","dd631daf","<index: 14 chunks>"],[10,"line","baggage/carry-on-rules.md","dd631daf","<index: 14 chunks>"],[9,"line","baggage/carry-on-rules.md","dd631daf","<index: 11 chunks>"],[11,"line","baggage/carry-on-rules.md","dd631daf","<index: 11 chunks>"],[11,"return","baggage/carry-on-rules.md","dd631daf","<index: 11 chunks>"]];

  // reembed.out.txt, second question
  const RE = {
    question: "When does a missing bag go to the tracing team?", size: 384,
    before: [[0.734, "baggage/delayed-bags.md#2"], [0.597, "baggage/delayed-bags.md#0"], [0.448, "baggage/sports-equipment.md#0"]],
    queryOnly: [[0.166, "baggage/sports-equipment.md#0"], [0.159, "baggage/delayed-bags.md#2"], [0.153, "baggage/cabin-baggage.md#2"]],
    full: [[0.709, "baggage/delayed-bags.md#2"], [0.617, "baggage/delayed-bags.md#0"], [0.588, "baggage/sports-equipment.md#0"]],
    sameChunk: 0.202
  };

  // From docs/ai-path/recordings/s5a-fresh-index/stale-answer.json (not altered)
  const REC_STALE = {
    src: "s5a-fresh-index/stale-answer",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    text: "The carry-on weight limit is 7 kg, as stated in `baggage/carry-on-rules.md`. Heavier carry-on bags will be tagged at the gate and placed in the hold free of charge."
  };
  // From docs/ai-path/recordings/s5a-fresh-index/fresh-answer.json (not altered)
  const REC_FRESH = {
    src: "s5a-fresh-index/fresh-answer",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    text: "The carry-on weight limit is 10 kg for one cabin bag, as stated in `baggage/cabin-baggage.md#0`."
  };
  const CAPTION = `Recorded model output, ${REC_STALE.recordedAt}`;

  /* ---------- Derived from the data ---------- */
  const docOf = chunkId => chunkId.split("#")[0];
  const countOf = repr => +repr.match(/(\d+) chunks/)[1];
  const STALE_DOCS = BROKEN.listing.filter(([d]) => !FOLDER_NOW.includes(d));
  const EXTRA = BROKEN.night2.chunks - BROKEN.folderChunks;
  const STALE_CHUNKS = STALE_DOCS.reduce((a, [, n]) => a + n, 0);
  // Scenario sizes for the real airline folder (story data, not a run)
  const ALL_PAGES = 40000, WEEKLY_CHANGES = 50;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-files { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-files li { padding: 7px 0; border-bottom: 1px solid var(--line); font: 500 14px/1.45 var(--mono); overflow-wrap: anywhere; display: flex; justify-content: space-between; gap: 12px; }
      .lx-${ID}-files li span:last-child { color: var(--muted); white-space: nowrap; }
      .lx-${ID}-files li.lx-${ID}-gone { text-decoration: line-through; color: var(--muted); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-say { margin: 14px 0 0; padding: 10px 0 10px 12px; border-left: 3px solid var(--ink); font-size: 16px; line-height: 1.5; }
      .lx-${ID}-who { display: block; font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
      .lx-${ID}-chunk { text-align: left; display: block; width: 100%; }
      .lx-${ID}-cid { display: block; font: 600 13.5px/1.4 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-ctx { display: block; font-size: 15px; line-height: 1.45; margin-top: 2px; }
      .lx-${ID}-mono { font: 500 14px/1.45 var(--mono); overflow-wrap: anywhere; text-align: left; }
      .lx-${ID}-plan { margin: 12px 0 0; padding-left: 1.6em; }
      .lx-${ID}-plan li { padding: 4px 0; line-height: 1.45; }
      .lx-${ID}-hash { font: 500 14px/1.5 var(--mono); color: var(--ink-2); margin: 4px 0 0; overflow-wrap: anywhere; }
      .lx-${ID}-pred { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .lx-${ID}-pred .btn { min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  const ask = (kit, opts, correct, picked, fbs) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  const chunkOpt = (kit, [score, id, text]) =>
    `<span class="lx-${ID}-chunk"><span class="lx-${ID}-cid">${fixed3(score)}  ${kit.esc(id)}</span><span class="lx-${ID}-ctx">${kit.esc(text)}</span></span>`;
  const said = (kit, who, text) => `<div class="lx-${ID}-say"><span class="lx-${ID}-who">${kit.esc(who)}</span>${kit.esc(text)}</div>`;
  const files = (kit, rows) => `<ul class="lx-${ID}-files">${rows.map(([name, right, gone]) =>
    `<li${gone ? ` class="lx-${ID}-gone"` : ""}><span>${kit.esc(name)}</span><span>${kit.esc(right || "")}</span></li>`).join("")}</ul>`;
  const hitsTable = (kit, hits, title) => kit.table(hits.map(([s, id]) => [fixed3(s), id]), { head: ["score", "chunk"], title });

  /* 1. The situation: the bot quotes a rule whose page was deleted. Find the chunk it came from. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 0;
    const fb = [
      [`Right. The 7 kg is in <code>${kit.esc(BROKEN.hits[0][1])}</code>, and <code>${kit.esc(OLD_PAGE)}</code> is not in the folder any more. The page is gone, but its chunks are still in the search index. It even ranks first, because it uses the words staff still say: “carry-on”. The model did what it was told: it answered from the excerpts it was given. The bug is upstream: the index no longer matches the folder it was built from. Keeping the two in step is what this lesson is about.`, true],
      [`That chunk says 10 kg: it is the current rule, from <code>${kit.esc(NEW_PAGE)}</code>, and the bot did not quote it. Look for the chunk that says 7 kg.`, false],
      [`This one is from the old page too, and the bot did repeat its “free of charge”. But the 7 kg it quoted is not in this chunk. Find the chunk with the weight.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why does the bot still say 7 kg?</h1>
        <p class="lead">An airline runs an internal help bot for airport staff. It searches the policy pages and answers from what it finds. Two weeks ago the policy team deleted <code>${kit.esc(OLD_PAGE)}</code> and published <code>${kit.esc(NEW_PAGE)}</code>, with a new cabin bag limit of 10 kg. The policy folder today:</p>
        ${files(kit, FOLDER_NOW.map(f => [f]))}
        <p class="lead">A check-in agent asks the bot:</p>
        ${said(kit, "agent", QUESTION)}
        ${said(kit, "bot", REC_STALE.text)}
        <p class="lx-${ID}-cap">${CAPTION}. A small hosted model answered from the three chunks below.</p>
        <p class="task">The search sent these three chunks to the model, with their similarity scores. Which one did the wrong rule come from?</p>
        <div class="lpanel">${ask(kit, BROKEN.hits.map(h => chunkOpt(kit, h)), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Broken on purpose: the nightly job that never deletes. Find the cause in its code. */
  function brokenJob({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = BROKEN_CODE.map((c, i) => `<span class="lx-${ID}-mono">line ${i}: ${kit.esc(c.trim())}</span>`);
    const fb = [
      ["The function's inputs are fine: the folder really is today's folder, and the index is the one search uses. The problem is in what the body does with them.", false],
      [`Right. The loop visits only the files that exist <b>tonight</b>. <code>${kit.esc(OLD_PAGE)}</code> is not in the folder, so the job never visits it, and nothing in the job ever removes a chunk. Its chunks stay forever. The listing shows ${plural(STALE_DOCS.length, "name")} with no file behind them, and the index holds ${BROKEN.night2.chunks} chunks where the folder makes ${BROKEN.folderChunks}. That is ${plural(EXTRA, "chunk")} too many. ${STALE_CHUNKS} of them belong to those two names. Where the ${EXTRA - STALE_CHUNKS === 1 ? "other one hides" : `other ${EXTRA - STALE_CHUNKS} hide`}, you will find out soon. A job that only writes what exists can add and overwrite, never delete.`, true],
      ["Splitting into paragraphs is fine here. The 7 kg chunk is a whole, correct paragraph of the old page. The trouble is not how pages are cut, but that the old page's pieces are still there at all.", false],
      [`<code>upsert</code> replaces a chunk only when the same id is written again. The ids <code>${kit.esc(OLD_PAGE)}#0</code> to <code>#2</code> are never written again, because that file is never visited. So upsert never touches them. It is doing its job; the job just never asks it to remove anything.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Find the bug in the nightly job</h1>
        <p class="lead">Every night a job reads the policy folder and writes each paragraph into the index as one chunk, under the id <code>&lt;file&gt;#&lt;n&gt;</code>. <code>upsert</code> means: insert, or overwrite if that id is already there. Below is the real job. Under it: what the index held after the job ran on the night of the change.</p>
        ${kit.code(BROKEN_CODE, ans === RIGHT ? 1 : -1)}
        ${files(kit, BROKEN.listing.map(([d, n]) => { const gone = !FOLDER_NOW.includes(d); return [d, gone ? plural(n, "chunk") : "", gone]; }))}
        <p class="lx-${ID}-cap">The names the index holds chunks for. Struck through: no such file in the folder (with its chunk count). Index: ${BROKEN.night2.chunks} chunks. The ${FOLDER_NOW.length} files in the folder make ${BROKEN.folderChunks}.</p>
        <p class="task">Which line is the cause of the deleted page staying searchable?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: the job needs a record of what it indexed last time. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const opts = [
      "Each file's last-modified time, so it only re-reads files changed since last night",
      "Wipe the index and rebuild it from the whole folder every night",
      "A saved list of every file it indexed last time, with a fingerprint of each file's text",
      "Tell the model in the prompt to prefer the newest policy"
    ];
    const fb = [
      ["A deleted file has no modified time: it is not there to ask. Times also change when someone opens and saves a page without changing the text, and then you re-embed for nothing. Times tell you what to re-read, never what to remove.", false],
      [`That does remove the old page, and for a small folder it is a fine choice. Here it means embedding all ${ALL_PAGES.toLocaleString("en")} pages every night, when only about ${WEEKLY_CHANGES} change in a whole week. And while it rebuilds, search sees a half-built index unless you build a second one and switch. You will meet this full rebuild again: it is the right move when the embedding model changes.`, false],
      ["Right. Call it the <b>manifest</b>: <code>doc_id → hash of the text you indexed</code>. A <b>hash</b> is a short fingerprint computed from the text: same text, same hash; any change, a different hash. Compare the manifest with tonight's folder, and you can sort every file: a name only in the folder is new, a name only in the manifest was deleted, a name in both with a different hash was edited, the same hash means skip. The deletions are the names you can only find on the manifest side.", true],
      ["The model can only judge what search gives it, and the chunk carries no date. Even if it did, a prompt rule only hides the problem in the index. Search would still rank the deleted page first, and the next deleted page would leak in the same way.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What must the job remember?</h1>
        <p class="lead">You want the nightly job to delete chunks of files that are gone. The trouble: on the night after the change, <code>${kit.esc(OLD_PAGE)}</code> is not in the folder, so the job cannot see it. The real folder at this airline holds about ${ALL_PAGES.toLocaleString("en")} pages, and about ${WEEKLY_CHANGES} change in a week.</p>
        <p class="task">What must the job keep, so it knows the old file existed and does as little work as possible?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. By hand: the week's changes. Decide what the job must do for each. */
  const ACTIONS = ["Nothing", "Add", "Delete", "Replace"];
  const actionFor = (before, after) => before == null ? 1 : after == null ? 2 : before === after ? 0 : 3;
  const WEEK = CHANGE_LOG.map(([what, a, b]) => {
    if (what === "renamed") return { what, name: `${a} → ${b}`, before: MANIFEST1[a], after: MANIFEST2[b], right: 3, rename: [a, b] };
    return { what, name: a, before: MANIFEST1[a], after: MANIFEST2[a], right: actionFor(MANIFEST1[a], MANIFEST2[a]) };
  });
  function weekFb(kit, w, pick) {
    const ok = pick === w.right;
    if (w.rename) return ok
      ? [`Right: under the old name, delete; under the new name, add. The text hash is the same (<code>${w.before}</code>), so the vectors could be copied over instead of embedded again. A simple job does not bother and re-embeds the same text: correct, just a little wasted work.`, true]
      : [pick === 0 ? "The text did not change, but the name did, and the name is the id every chunk is stored under. Search would keep citing a file name that no longer exists, and the new name would have no chunks."
        : pick === 1 ? "Adding the new name is half of it. The chunks under the old name would stay, and every question about check-in would find the same paragraph twice under two names."
        : "Deleting the old name is half of it. Then the check-in rules would have no chunks at all, and the bot could not answer check-in questions.", false];
    const why = {
      0: [`Right. Opened and saved, same text: the hash before and now is <code>${w.before}</code>. Nothing to embed. A job that went by the saved time would re-embed this page for nothing.`, true],
      1: ["Right. A name the manifest has never seen: split it, embed each chunk, add it.", true],
      2: ["Right. The name is in the manifest and not in the folder: delete every chunk stored under it. This is exactly the step the old job never did.", true],
      3: ["Right. Same name, different hash: the text changed. Delete every chunk the old version left, then embed and add the new ones.", true]
    };
    if (ok) return why[w.right];
    const no = {
      "0-1": "The manifest has never seen this name, so it has no chunks in the index yet. Doing nothing leaves the new page unsearchable.",
      "0-2": "The page is gone from the folder, so its chunks must go. Doing nothing is exactly the bug that kept the 7 kg rule alive.",
      "0-3": `The hash changed (<code>${w.before}</code> before, <code>${w.after}</code> now): the text is different. Doing nothing keeps the old version's answers in search.`,
      "1-0": `The hash is the same before and now (<code>${w.before}</code>), and its chunks are already in the index. Adding them again makes duplicates.`,
      "1-2": "There is nothing to add: the file is gone from the folder.",
      "1-3": `Adding the new chunks on top of the old ones leaves the old version searchable next to the new one. The old chunks must go first.`,
      "2-0": `The page still exists with the same text (hash <code>${w.before}</code>). Deleting it makes it unsearchable.`,
      "2-1": "The page is new, so there is nothing of it in the index to delete.",
      "2-3": "Deleting is half of it. Then the edited page has no chunks at all, and questions about it find nothing.",
      "3-0": `Same hash before and now (<code>${w.before}</code>): nothing changed in the text, so there is nothing to replace. Re-embedding costs money and changes nothing.`,
      "3-1": "There is no old version in the index: the manifest has never seen this name. Just add.",
      "3-2": "The file is gone: there is no new version to add. Just delete."
    };
    return [no[`${pick}-${w.right}`], false];
  }
  function byHand({ el, done, kit }) {
    ensureStyle();
    const ans = WEEK.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>One week of changes</h1>
        <p class="lead">Below is the docs system's change log for the week. <b>indexed</b> is the hash in the manifest (what the job indexed last time). <b>now</b> is the hash of the text in the folder today. A dash means there is none. <b>Replace</b> means: delete every chunk of the old version, then embed and add the new ones.</p>
        <p class="task">For each change, what must the nightly job do?</p>
        ${WEEK.map((w, i) => `<div class="lcase" id="c${i}"><p><b>${kit.esc(w.what)}</b> <code>${kit.esc(w.name)}</code></p>
          <p class="lx-${ID}-hash">${w.rename ? `indexed under the old name: ${w.before} · now under the new name: ${w.after}` : `indexed: ${w.before || "—"} · now: ${w.after || "—"}`}</p>
          ${kit.options(ACTIONS, { picked: ans[i], correct: w.right })}${ans[i] == null ? "" : kit.feedback(...weekFb(kit, w, ans[i]))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (WEEK.every((w, j) => ans[j] === w.right)) done();
      }));
    };
    paint();
  }

  /* 5. Predict: why Replace must delete before it adds. The old job's edited page. */
  function shrink({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const right = BROKEN.delayed.length;
    const opts = [DELAYED_NEW_PARAS, DELAYED_OLD_PARAS, DELAYED_OLD_PARAS + DELAYED_NEW_PARAS].map(String);
    const RIGHT = opts.indexOf(String(right));
    const rows = BROKEN.delayed.map(([id, t]) => `<p class="lx-${ID}-hash">${kit.esc(id)}: ${kit.esc(t)}</p>`).join("");
    const fb = opts.map((o, i) => i === RIGHT
      ? [`Right: ${right}. Upsert overwrote <code>#0</code> to <code>#${DELAYED_NEW_PARAS - 1}</code>, and <code>#${DELAYED_OLD_PARAS - 1}</code> was never written again, so the old version's last paragraph stayed. This is what the index really held:${rows}Two chunks now disagree: 3 days or 5 days. A question about lost bags can get either. So <b>Replace</b> deletes by the document's name first (every chunk stored with that <code>doc_id</code>), then adds. Real vector databases support this: Qdrant, for one, can delete points (its name for stored vectors) by a filter on a stored field.`, true]
      : +o === DELAYED_NEW_PARAS
        ? [`That is how many paragraphs the new version has. But upsert only overwrites ids that are written again: <code>#0</code> to <code>#${DELAYED_NEW_PARAS - 1}</code>. Nothing removed <code>#${DELAYED_OLD_PARAS - 1}</code>.`, false]
        : [`Upsert with an id that is already there overwrites it; it does not add a copy. The ${DELAYED_NEW_PARAS} new chunks landed on the ids of the first ${DELAYED_NEW_PARAS} old ones.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>An edit that leaves a ghost</h1>
        <p class="lead">Same old job, another page. <code>baggage/delayed-bags.md</code> was edited: it had ${DELAYED_OLD_PARAS} paragraphs, chunks <code>#0</code> to <code>#${DELAYED_OLD_PARAS - 1}</code>. The new version has ${DELAYED_NEW_PARAS}, and the last one changed the tracing deadline. The job upserts <code>#0</code> to <code>#${DELAYED_NEW_PARAS - 1}</code>.</p>
        ${kit.code(BROKEN_CODE, 3)}
        <p class="task">After the job, how many chunks of <code>delayed-bags.md</code> are in the index?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. sync() as Python: a stepped replay of the traced run, predicting each skip-or-replace. */
  const SHOW = new Set([1, 5, 6, 7, 8, 10]);
  const FR = (() => {
    const fr = [];
    TRACE.forEach((r, k) => {
      if (r[1] === "return") { fr.push({ ln: 11, doc: r[2], h: r[3], n: countOf(r[4]), end: true }); return; }
      if (!SHOW.has(r[0]) || (r[0] === 11)) return;
      const next = TRACE[k + 1];
      fr.push({ ln: r[0], doc: r[2], h: r[3], n: countOf(r[4]), skip: r[0] === 5 ? next[0] === 6 : null, nextN: countOf(next[4]) });
    });
    return fr;
  })();
  const NIGHT1_N = FR[0].n, NIGHT2_N = FR[FR.length - 1].n;
  function sayFrame(kit, f, prev) {
    const m = MANIFEST1[f.doc];
    if (f.end) return `<code>return seen</code>. The index holds ${f.n} chunks, exactly what the ${FOLDER_NOW.length} files make, and <code>seen</code> becomes tomorrow night's manifest. This night embedded ${FRESH.embedded} texts; the old job embeds ${BROKEN.night2.embedded} every night, whatever changed. Here a lot changed in one week; in a folder where a few pages in thousands change, almost all of that work is saved.`;
    if (f.ln === 1) return `The index starts with ${f.n} chunks from the night before. <code>seen</code> will collect <code>doc_id → hash</code> for every file in the folder now.`;
    if (f.ln === 5) return `<code>${kit.esc(f.doc)}</code>: its text hashes to <code>${f.h}</code>. The manifest says ${m ? `<code>${m}</code>` : "nothing (<code>None</code>: it has never seen this name)"}. Will line 5 skip this file?`;
    if (f.ln === 6) return `Same hash: <code>continue</code>. No chunk is deleted, nothing is embedded.`;
    if (f.ln === 7) return `Not the same, so the file is new or edited. First, delete every chunk stored under <code>${kit.esc(f.doc)}</code>. Index: ${plural(f.n, "chunk")} before this line.`;
    if (f.ln === 8) return `<code>delete_doc</code> removed ${plural(prev.n - f.n, "chunk")}. Now <code>add_doc</code> splits the new text into paragraphs, embeds each, and stores them as <code>#0</code>, <code>#1</code>, … It adds ${plural(f.nextN - f.n, "chunk")}.`;
    if (f.ln === 10) return `The second loop walks the names that are in the manifest but not in the folder: <code>${kit.esc(f.doc)}</code>. ${f.doc === OLD_PAGE ? "This is the page with the 7 kg rule." : "This is the old name of the renamed file."} <code>delete_doc</code> removes its ${plural(f.n - f.nextN, "chunk")}.`;
    return "";
  }
  function predFb(kit, f, pickSkip) {
    const m = MANIFEST1[f.doc];
    if (pickSkip && !m && f.doc === "checkin/web-checkin.md") return `The hash <code>${f.h}</code> is in the manifest, but under the old name <code>checkin/online-checkin.md</code>. <code>manifest.get("${kit.esc(f.doc)}")</code> looks up the new name and gets <code>None</code>. The manifest is keyed by name, so a rename looks like a new file.`;
    if (pickSkip && !m) return `<code>manifest.get</code> returns <code>None</code> for a name it has never seen, and <code>None == "${f.h}"</code> is false. A new file is never skipped.`;
    if (pickSkip) return `The manifest has <code>${m}</code> and the text now hashes to <code>${f.h}</code>. Different hashes: the text changed, so it must be replaced.`;
    return `The manifest has <code>${m}</code> and the text hashes to <code>${f.h}</code>: the same. Nothing changed${f.doc === "lounges/lounge-access.md" ? " (the page was saved this week, but its text was not changed)" : ""}, so line 5 is true and line 6 skips it.`;
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, wrong = null;
    const paint = () => {
      const f = FR[i], last = i === FR.length - 1, pred = f.ln === 5;
      const m = f.doc ? MANIFEST1[f.doc] : undefined;
      const choices = pred ? [["Skip it: line 6", true], ["Replace it: lines 7 and 8", false]] : [];
      el.innerHTML = `<h1>sync, line by line</h1>
        <p class="lead">This is the fixed job, run on the night of the change. <code>manifest</code> is the <code>doc_id → hash</code> list the previous night saved. <code>content_hash</code> returns the text's hash (SHA-256, a standard hash function), cut to its first 8 characters. The marked line is the one about to run.</p>
        <p class="task">Step through. At each <code>if</code>, predict: skip or replace?</p>
        ${kit.code(SYNC_CODE, f.ln)}
        <div class="vars"><span>doc_id <b>${kit.esc(f.doc && !f.end ? f.doc : "–")}</b></span><span>h <b>${f.h && f.ln !== 10 && !f.end ? f.h : "–"}</b></span><span>manifest.get(doc_id) <b>${f.doc && f.ln !== 10 && !f.end ? (m || "None") : "–"}</b></span><span>index <b>${plural(f.n, "chunk")}</b></span></div>
        ${kit.feedback(sayFrame(kit, f, FR[i - 1]))}
        ${wrong != null ? kit.feedback(predFb(kit, f, wrong), false) : ""}
        ${pred ? `<div class="lx-${ID}-pred">${choices.map(([t, isSkip]) => `<button type="button" class="btn" data-pred="${isSkip ? 1 : 0}" ${isSkip === f.skip ? "data-next" : "data-wrong"}>${t}</button>`).join("")}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button>${pred ? "" : `<button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button>`}</div>
        ${last ? `<p class="lead">In LangChain, the indexing API keeps this bookkeeping for you: <code>index()</code> with a record manager, which stores a hash of every document (chunk) it wrote, with its source id, like your <code>doc_id</code>. Pick its cleanup mode with care. <code>cleanup="incremental"</code> removes old chunks only for sources it sees again in this run. Only <code>cleanup="full"</code> also removes sources the loader did not return this time: a deleted page, like the one that kept the 7 kg rule alive.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; wrong = null; paint(); };
      el.querySelectorAll("[data-next]").forEach(b => b.onclick = () => { i++; wrong = null; paint(); if (i === FR.length - 1) done(); });
      el.querySelectorAll("[data-wrong]").forEach(b => b.onclick = () => { wrong = b.dataset.pred === "1"; paint(); });
    };
    paint();
  }

  /* 7. After the fix: predict the top chunk, then see the recorded answer. */
  function afterFix({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [`<code>${kit.esc(OLD_PAGE)}#0</code>, still first`, `<code>${kit.esc(FRESH.hits[0][1])}</code>`, "Nothing: no chunk says “carry-on” any more"];
    const RIGHT = 1;
    const shown = `${hitsTable(kit, FRESH.hits, "search after sync")}${said(kit, "bot", REC_FRESH.text)}<p class="lx-${ID}-cap">${CAPTION}. The same small hosted model, the same prompt, the new chunks.</p>`;
    const fb = [
      [`Line 10 of <code>sync</code> deleted every chunk stored under <code>${kit.esc(OLD_PAGE)}</code>. It is not in the index, so search cannot return it.`, false],
      [`Right. Its score did not change (${fixed3(BROKEN.hits.find(h => h[1] === FRESH.hits[0][1])[0])} before, ${fixed3(FRESH.hits[0][0])} after): the same text, the same vector. It only lost the chunk that matched the word “carry-on” better.${shown}`, true],
      [`Vector search always returns the closest chunks it has, even when none of them shares a word with the question. It ranks by meaning, and a cabin bag is close to a carry-on bag.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Ask again</h1>
        <p class="lead">After <code>sync</code>, the index holds ${FRESH.chunks} chunks from the ${FOLDER_NOW.length} files in the folder. The agent asks the same question: “${kit.esc(QUESTION)}” Before the fix, the top chunk was <code>${kit.esc(BROKEN.hits[0][1])}</code> (score ${fixed3(BROKEN.hits[0][0])}).</p>
        <p class="task">Which chunk comes first now?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. A new embedding model: predict what happens if only the query side switches. */
  function modelChange({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const opts = [
      "An error: the new vectors do not fit the index",
      "The same top chunks; it is the same text after all",
      "No error, but the ranking stops making sense"
    ];
    const tables = `${kit.pics.side(hitsTable(kit, RE.before, "before: old model, old vectors"), hitsTable(kit, RE.queryOnly, "new model for the question only"))}`;
    const fb = [
      [`Both models make vectors of ${RE.size} numbers, so the index accepts them and the maths runs. Nothing warns you. That is what makes this mistake dangerous.`, false],
      ["The text is the same, but each model places text in its own space. The first number in one model's vector means nothing to the other model. The same chunk, embedded by both, gave two vectors with a cosine of " + fixed3(RE.sameChunk) + ": nearly unrelated.", false],
      [`Right. The run:${tables}<p class="lead">The sports-equipment page came first, with a score of ${fixed3(RE.queryOnly[0][0])}. Each model has its own space, so a vector is only comparable with vectors from the same model: the same chunk, embedded by both, gave two vectors with a cosine of ${fixed3(RE.sameChunk)}. Once every chunk was re-embedded with the new model, <code>${kit.esc(RE.full[0][1])}</code> was first again (${fixed3(RE.full[0][0])}). A new model means a full re-embed, every chunk, not just the ones that change.</p>`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A new embedding model</h1>
        <p class="lead">Months later, the team switches to another small open embedding model. Like the old one, it makes vectors of ${RE.size} numbers. Someone proposes: use the new model for questions from today, and let <code>sync</code> re-embed pages as they change.</p>
        <p class="lead">On the first day, an agent asks: “${kit.esc(RE.question)}” The index still holds every chunk as the old model embedded it.</p>
        <p class="task">What does search return?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Plan the full re-embed: put the steps in order. */
  const PLAN = [
    "Create a second, empty index for the new model",
    "Fill it: embed every chunk of every file with the new model, and keep it synced with its own manifest, while the old index keeps serving",
    "Run a set of real staff questions against both indexes and compare the top chunks",
    "Switch search to the new index and the new model for questions at the same moment",
    "Keep the old index for a while in case you must switch back, then delete it"
  ];
  const TRAPS = [
    ["Switch the question side to the new model first", "That is the mistake you just saw: new-model questions against old-model vectors. The question model and the index must always change together."],
    ["Re-embed each page with the new model when it next changes", "Until every page changes, the index mixes vectors from two models, and old-model chunks are scored with numbers that mean nothing to the new model. Some pages never change at all."]
  ];
  const STEP_ORDER = [3, 0, 5, 1, 4, 6, 2]; // display order: PLAN indexes 0..4, traps as 5, 6
  function planReembed({ el, done, kit }) {
    ensureStyle();
    let got = 0, wrong = null;
    const label = k => k < PLAN.length ? PLAN[k] : TRAPS[k - PLAN.length][0];
    const why = k => `“${kit.esc(label(k))}”: ` + (k >= PLAN.length ? TRAPS[k - PLAN.length][1]
      : `Not yet. Step ${got + 1} comes first: “${PLAN[got]}”. ${k > got + 1 ? "You are skipping ahead." : got === 0 ? "You need the new index before you can fill or test it." : got === 1 ? "There is nothing to test until the new index is full." : got === 2 ? "Switching before testing means users find the problems for you." : "Delete the old index only after the switch has held."}`);
    const paint = () => {
      const fin = got === PLAN.length;
      const left = STEP_ORDER.filter(k => k >= PLAN.length || k >= got);
      el.innerHTML = `<h1>Plan the switch</h1>
        <p class="lead">Every chunk must be embedded again with the new model. The bot must keep answering during the switch, and a bad new model must not reach the airport desks.</p>
        <p class="task">${fin ? "Your plan:" : `Pick step ${got + 1} of ${PLAN.length}.`}</p>
        ${got ? `<ol class="lx-${ID}-plan">${PLAN.slice(0, got).map(p => `<li>${kit.esc(p)}</li>`).join("")}</ol>` : ""}
        <div class="lpanel">${fin ? kit.feedback(`Right. This is a parallel build and switch. Real vector databases support the switch step: in Qdrant, for one, an <b>alias</b> is a second name for a collection, and moving it from the old collection to the new one is atomic: it happens in one step, so no search sees a half-built index. The cost: every chunk embedded once more, and two indexes kept for a while. The same plan applies when you change how pages are cut into chunks: every chunk changes, so everything is rebuilt.`, true)
          : `<div class="lopts">${left.map(k => `<button type="button" data-k="${k}" ${k === got ? "data-right" : k === PLAN.length ? "data-wrong" : ""}>${kit.esc(k < PLAN.length ? PLAN[k] : TRAPS[k - PLAN.length][0])}</button>`).join("")}</div>${wrong != null ? kit.feedback(why(wrong), false) : ""}`}</div>`;
      el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
        const k = +b.dataset.k;
        if (k === got) { got++; wrong = null; paint(); if (got === PLAN.length) done(); return; }
        wrong = k; paint();
      });
    };
    paint();
  }

  /* 10. The big picture, with a cost that bites: a partial folder listing. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const ALL = ALL_PAGES, LISTED = 200, lost = ALL - LISTED;
    const RIGHT = 1;
    const opts = ["Nothing much: it only acts on files whose hash changed", `It deletes the chunks of the ${lost.toLocaleString("en")} pages missing from the listing`, "It stops with an error"];
    const fb = [
      [`The first loop does act only on changed files. But the second loop deletes every manifest name that is not in tonight's folder, and tonight's folder looks like ${LISTED} pages.`, false],
      [`Right. To <code>sync</code>, a missing page and a deleted page look the same. The bot would lose almost everything overnight. So guard the delete pass: if the listing is much smaller than the manifest, stop and alert a person. LangChain's docs warn about the same thing for <code>cleanup="full"</code>: the loader must return the entire dataset, not a subset.`, true],
      ["Nothing in <code>sync</code> checks the listing. It trusts it: lines 9 and 10 delete whatever is in the manifest and not in the folder. A short listing is not an error to it.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When and what it costs</h1>
        <p class="lead"><b>For:</b> any search index built from documents that change. <b>Reach for</b> a manifest-based sync when changes are few compared with the whole. <b>Rebuild everything</b> into a new index when the embedding model or the chunking changes, or when the folder is so small that a rebuild costs nothing. <b>Not at all</b> for facts that change by the minute, such as seats left on a flight: look those up live at answer time.</p>
        <p class="lead"><b>Costs:</b> one embedding for every chunk of each new or changed page, a manifest to store, and a delete pass that trusts the listing.</p>
        <p class="task">One night the folder listing breaks off early and returns ${LISTED} of the ${ALL.toLocaleString("en")} pages. What does <code>sync</code> do?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 11. Recognise it: incremental sync, full rebuild, or no index at all. */
  const KINDS = ["Incremental sync", "Full rebuild into a new index", "Do not index it"];
  const CASES = [
    ["A support bot answers from 12,000 product manual pages. Each week writers edit, add or retire about 30 of them.", 0,
      "Yes, sync. Few pages change against many that do not, so compare against the manifest, embed only what changed and delete what was retired.",
      { 1: "A rebuild works, but it embeds 12,000 pages every week to catch about 30 changes. The manifest gives the same result for a fraction of the work.", 2: "The pages are long, written text that people ask about in their own words. That is what a search index is for." }],
    ["A clinic's bot answers from its 400-page staff handbook. The team decides to cut pages into smaller chunks, because answers were missing details.", 1,
      "Yes, rebuild. Changing the chunking changes the chunks of every page, even pages whose text did not change. Their hashes are the same, so a hash-based sync would skip them. Build a new index and switch.",
      { 0: "A sync compares text hashes, and most pages' text did not change, so it would skip them and keep the old chunks. The chunking changed for every page, so every page must be redone.", 2: "The handbook is still prose people search by meaning. The index is still the right tool; it just has to be rebuilt." }],
    ["A booking bot must tell agents how many seats are left on today's flights. The numbers change every few minutes.", 2,
      "Right: do not index it. By the time a sync runs, the number is already wrong, and the agent needs the exact current figure. Let the bot call the booking system, or query its database, at answer time.",
      { 0: "Even a sync every few minutes is behind the live number, and an agent selling the last seat needs the exact count. Fetch it live at answer time instead of storing a copy.", 1: "A rebuild is slower still. The problem is not stale vectors; it is storing a copy of a number that changes all the time. Ask the live system." }],
    ["A legal team indexes 20,000 contracts with a new, better embedding model to replace the old one.", 1,
      "Yes, rebuild. Vectors from the old and the new model cannot be compared, so every contract is embedded again into a new index, tested, and switched to.",
      { 0: "A sync only re-embeds what changed, and the contracts did not change. The index would keep old-model vectors that the new model's questions cannot be compared with.", 2: "Contracts are long text searched by meaning: an index is right. It is the model that changed, so the index must be rebuilt." }]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Sync, rebuild, or no index?</h1>
        <p class="lead">Four other teams, four kinds of change.</p>
        <p class="task">Pick the right way to keep each one's answers current.</p>
        ${CASES.map(([q, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(KINDS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : no[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Your index matches its source</h1>
      <p class="lead">You traced a quoted rule back to a deleted page whose chunks were never removed, saw an edit leave a ghost chunk, and stepped through the ${SYNC_CODE.length - 1} lines of <code>sync</code> that compares a manifest of hashes with the folder: add, replace, delete or skip. You also saw why a new embedding model means rebuilding every vector in a new index, and switching to it in one move.</p>
      <p class="lead"><b>Practice:</b> this lesson was the practice.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You can now keep a retrieval system's data current. Next you learn to measure whether its answers are right, starting from real user questions like the agent's.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Keeping retrieval data fresh: updates, deletes and re-embedding",
    checked: "2026-11-18",
    sources: [
      "https://reference.langchain.com/python/langchain-core/indexing/api/index",
      "https://qdrant.tech/documentation/manage-data/points/",
      "https://qdrant.tech/documentation/concepts/collections/",
      "https://docs.ollama.com/api/embed",
      "https://huggingface.co/Snowflake/snowflake-arctic-embed-xs"
    ],
    interview: [
      {
        q: "Users say your RAG bot quotes a policy that was withdrawn last month. Walk me through how you find the cause and fix it for good.",
        good: [
          "Look at what retrieval returned for that question: which chunk carried the old rule, and which document id it is stored under",
          "Compare the document ids in the index with the source listing; ids with no source document mean the ingest never deletes",
          "Keep a manifest of document id to content hash, and on each run add new, replace changed (delete all old chunks first), delete missing, skip the same",
          "Store the document id on every chunk so you can delete by it, and guard the delete pass against a partial source listing",
          "Add a check that counts index documents missing from the source, so it cannot drift silently again"
        ],
        weak: "Tell the model to prefer newer documents, or switch to a bigger model. The stale chunk is still in the index and still ranks first."
      },
      {
        q: "Your team wants to move to a better embedding model. How do you roll it out without breaking search?",
        good: [
          "Vectors from two models are not comparable, even at the same size, so every chunk must be re-embedded",
          "Build a new index next to the old one and keep the old one serving and syncing meanwhile",
          "Compare both on a set of real questions before switching",
          "Switch the question model and the index together, for example with an alias, and keep the old index for rollback"
        ],
        weak: "Start embedding new and changed documents with the new model. The index then mixes two models, and the old vectors cannot be compared with the new model's questions."
      }
    ],
    screens: [situation, brokenJob, spotIdea, byHand, shrink, asCode, afterFix, modelChange, planReembed, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: WEEK.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-next]", "[data-wrong]"], right: Array(FR.length - 2).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(PLAN.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
