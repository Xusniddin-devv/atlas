/* Lesson s5a-chunking: chunking documents for search.
   Story: an airport ground-handling team's help desk bot answers crew questions from a safety manual (made up for
   the lesson). It cuts the manual into 50-word chunks, sends the 2 best-matching ones to a model, and answers
   "how far must a baggage tractor stay?" without the distance: the refuelling rule was cut in half.
   Ideas: (1) a chunk is the unit search returns, so a fact split across two chunks is lost: the half that matches
   the question has no number, the half with the number does not match; (2) cut by the document's structure first
   (headings, then sentences) with the size only as a ceiling; overlap is a safety net that guarantees only short facts.
   Data: docs/ai-path/runs/s5a-chunking/ (manual.py = the manual and question; chunking.py = the chunkers and a
   from-scratch TF-IDF search; runs.py -> runs.out.txt and runs.json = every chunking, its scores and ranks;
   trace_pack.py -> trace_pack.out.txt = the traced code screen). Recordings (main checkout):
   docs/ai-path/recordings/s5a-chunking/fixed-50.json and by-heading-80.json.
   Every number on screen is computed here from LINES, RUN, TRACE and the REC_* constants. Lesson-local CSS: the
   clickable manual lines with cut marks, chunk cards, the recorded-output block and a compact table
   (prefix lx-s5a-chunking-). */
(() => {
  const P = "lx-s5a-chunking-";
  const fmt = n => n.toLocaleString("en");
  const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");

  // From docs/ai-path/runs/s5a-chunking/manual.py (one item = one heading or one sentence)
  const LINES = [
    "1. Scope",
    "This manual applies to all ground staff working on the apron at stands 1 to 24.",
    "Read it before your first shift, and read it again after every change to it.",
    "2. Driving on the apron",
    "All vehicles on the apron must keep below 25 km/h.",
    "Within 15 metres of a parked aircraft, slow to walking pace.",
    "Never drive a baggage tractor under a wing or an engine.",
    "3. Chocks and cones",
    "Place chocks at the nose wheel as soon as the engines stop.",
    "Put a cone at each wing tip and at the tail before any vehicle comes close.",
    "4. Refuelling",
    "Only trained fuel staff may connect the fuel hose.",
    "Before refuelling starts, the aircraft must be connected to the ground with a bonding cable.",
    "While the aircraft is being refuelled, a baggage tractor, belt loader or ground power unit must stay outside the fuelling safety zone.",
    "The zone reaches 6 metres from each wing vent and 3 metres from the tanker.",
    "Passengers may board during refuelling only if the fire service has been told.",
    "5. Weather",
    "When lightning is detected within 8 km, stop refuelling and leave the apron."
  ];
  const QUESTION = "How far from the aircraft must a baggage tractor stay while it is being refuelled?";
  const RULE = [13, 14];                       // the two lines that together make the refuelling-distance rule
  const SEC4 = [10, 16];                       // section 4: lines 10 to 15

  // From docs/ai-path/runs/s5a-chunking/runs.out.txt / runs.json: words per chunk, [chunk index, score] best first,
  // and the chunks that hold the whole rule
  const RUN = {
    "size 25": { words: [25, 25, 25, 25, 25, 25, 25, 18], ranked: [[5, 0.527], [2, 0.255], [4, 0.064], [0, 0], [1, 0], [3, 0], [6, 0], [7, 0]], whole: [] },
    "size 50": { words: [50, 50, 50, 43], ranked: [[2, 0.392], [1, 0.174], [0, 0], [3, 0]], whole: [] },
    "size 50, overlap 10": { words: [50, 50, 50, 50, 33], ranked: [[3, 0.371], [1, 0.175], [2, 0.045], [0, 0], [4, 0]], whole: [3] },
    "size 50, overlap 15": { words: [50, 50, 50, 50, 50, 18], ranked: [[3, 0.414], [1, 0.197], [4, 0.069], [2, 0.05], [0, 0], [5, 0]], whole: [] },
    "size 100": { words: [100, 93], ranked: [[1, 0.246], [0, 0.101]], whole: [1] },
    "size 200": { words: [193], ranked: [[0, 0.282]], whole: [0] },
    "by heading, max 50": { words: [33, 37, 32, 48, 28, 15], ranked: [[3, 0.413], [1, 0.213], [0, 0], [2, 0], [4, 0], [5, 0]], whole: [] },
    "by heading, max 80": { words: [33, 37, 32, 76, 15], ranked: [[3, 0.304], [1, 0.209], [0, 0], [2, 0], [4, 0]], whole: [3] }
  };
  const TOP_K = 2;                             // the help desk sends the 2 best chunks (runs.py, request(k=2))

  // From docs/ai-path/recordings/s5a-chunking/fixed-50.json (not trimmed, not altered)
  const REC_FIXED = {
    src: "s5a-chunking/fixed-50",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13", finish: "stop",
    text: "While the aircraft is being refuelled, a baggage tractor must stay outside the fuelling safety zone."
  };
  // From docs/ai-path/recordings/s5a-chunking/by-heading-80.json (not trimmed, not altered)
  const REC_HEAD = {
    src: "s5a-chunking/by-heading-80",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13", finish: "stop",
    text: "While the aircraft is being refuelled, a baggage tractor must stay outside the fuelling safety zone. The zone reaches 6 metres from each wing vent and 3 metres from the tanker."
  };

  /* ---------- derived ---------- */
  const split = s => s.split(/\s+/).filter(Boolean);
  const WORDS = split(LINES.join(" "));
  const SPANS = (() => { let p = 0; return LINES.map(l => { const n = split(l).length, s = [p + 1, p + n]; p += n; return s; }); })();
  const lineOf = w => SPANS.findIndex(([a, b]) => a <= w && w <= b);
  const RULE_FROM = SPANS[RULE[0]][0], RULE_TO = SPANS[RULE[1]][1], RULE_LEN = RULE_TO - RULE_FROM + 1;
  const NUM_WORD = WORDS.findIndex((w, i) => i + 1 >= SPANS[RULE[1]][0] && /^\d+$/.test(w)) + 1;  // the "6" in the zone sentence
  const SEC_FROM = SPANS[SEC4[0]][0], SEC_TO = SPANS[SEC4[1] - 1][1], SEC_LEN = SEC_TO - SEC_FROM + 1;
  // the fixed-size chunker of chunking.py, ported: [start word (1-based), end word] of every chunk
  function fixedSpans(size, overlap) {
    const out = [], step = size - overlap;
    for (let s = 0; s < WORDS.length; s += step) {
      out.push([s + 1, Math.min(s + size, WORDS.length)]);
      if (s + size >= WORDS.length) break;
    }
    return out;
  }
  const F50 = fixedSpans(50, 0);
  const chunkText = ([a, b]) => WORDS.slice(a - 1, b).join(" ");
  const chunkOf = (spans, w) => spans.findIndex(([a, b]) => a <= w && w <= b);
  const SIZE = 50, CUTS = F50.slice(0, -1).map(([, b]) => b);   // the help desk cuts after these words
  // the search's word list (chunking.py terms and STOP), ported to show which question words a chunk shares
  const STOP = new Set("a an the is are be to of in on at for and or if it its by as with must may any all each every how far from while being this that your you do does what when".split(" "));
  const terms = t => (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w));
  const QTERMS = [...new Set(terms(QUESTION))];
  const shared = text => { const t = new Set(terms(text)); return QTERMS.filter(w => t.has(w)); };
  const sentTo = (setup, k = TOP_K) => RUN[setup].ranked.slice(0, k).reduce((a, [i]) => a + RUN[setup].words[i], 0);
  const rankOf = (setup, i) => RUN[setup].ranked.findIndex(([j]) => j === i) + 1;
  const caption = rec => `<p class="${P}cap">Recorded model output, ${rec.recordedAt}</p>`;

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}out { white-space: pre-wrap; font: 500 15px/1.55 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-top: 10px; overflow-wrap: anywhere; }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}who { font-size: 15px; color: var(--muted); margin: 18px 0 0; }
      .${P}q { font: 600 16px/1.45 var(--font); border-left: 3px solid var(--ink); padding: 4px 0 4px 12px; margin-top: 14px; }
      .${P}lines { display: grid; gap: 6px; margin-top: 14px; }
      .${P}ln { display: block; width: 100%; text-align: left; min-height: 44px; font: 500 15px/1.45 var(--font); border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 8px; padding: 8px 12px; overflow-wrap: anywhere; }
      button.${P}ln { cursor: pointer; }
      @media (hover: hover) { button.${P}ln:not(.right):not(.wrong):not(:disabled):hover { border-color: var(--ink); } }
      .${P}ln.h { font-weight: 700; }
      .${P}ln.rule { box-shadow: inset 3px 0 0 var(--ink); }
      .${P}ln.right { border-color: var(--good); background: var(--good-soft); }
      .${P}ln.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}ln:disabled { opacity: 1; cursor: default; }
      .${P}rng { display: block; font: 500 12px var(--mono); color: var(--muted); margin-top: 2px; }
      .${P}cut { display: inline-block; font: 700 12px var(--mono); color: var(--ink); border: 1.5px solid var(--ink); border-radius: 4px; padding: 0 5px; margin: 0 4px; vertical-align: 1px; white-space: nowrap; }
      .${P}cards { display: grid; gap: 10px; margin-top: 14px; }
      .${P}card { display: block; width: 100%; text-align: left; min-height: 44px; border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 10px; padding: 10px 12px; cursor: pointer; font: 500 14px/1.5 var(--font); overflow-wrap: anywhere; }
      @media (hover: hover) { .${P}card:not(.right):not(.wrong):hover { border-color: var(--ink); } }
      .${P}card.sent { border-width: 2.5px; border-color: var(--ink); }
      .${P}card.right { border-color: var(--good); background: var(--good-soft); }
      .${P}card.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}card .hd { display: flex; flex-wrap: wrap; gap: 4px 14px; font: 600 13px var(--mono); color: var(--ink); margin-bottom: 4px; }
      .${P}card .hd span { color: var(--muted); font-weight: 500; }
      .${P}card .hd b { font-weight: 700; }
      .${P}card .tx { color: var(--ink-2); }
      .${P}tb { border-collapse: collapse; width: 100%; margin-top: 14px; font: 500 14px var(--mono); }
      .${P}tb th { text-align: left; font: 600 12px var(--font); color: var(--muted); padding: 4px 6px 6px; border-bottom: 2px solid var(--ink); }
      .${P}tb td { padding: 6px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}tb td.n, .${P}tb th.n { text-align: right; white-space: nowrap; }
      .${P}tb tr.on td { box-shadow: inset 0 -2px 0 var(--ink); font-weight: 700; }
      .${P}out2 { white-space: pre-wrap; font: 500 14px/1.5 var(--mono); background: var(--surface); border-radius: 8px; padding: 10px 12px; margin-top: 10px; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }

  /* 1. The situation: the answer has no number. Find the sentence that has it. */
  function situation({ el, done, kit }) {
    css();
    let pick = null;
    const right = RULE[1];
    const say = i => {
      if (i === right) return [`Right: “${kit.esc(LINES[i])}” That is the number she needed: ${WORDS[NUM_WORD - 1]} metres from each wing vent. The bot's answer repeated the sentence before it, about staying outside the zone, and never said how big the zone is. The manual had the answer. This lesson finds out where it got lost.`, true];
      if (i === RULE[0]) return [`This is the sentence the bot repeated. It says to stay outside the fuelling safety zone, but not how far that is. Read on: the size of the zone comes next.`, false];
      if (i === SEC4[0]) return [`That is the section's heading. It tells you where you are, not how far to stay.`, false];
      return [`This sentence is about refuelling, but it gives no distance for a baggage tractor. Look for the sentence that says how big the zone is.`, false];
    };
    const paint = () => {
      const ok = pick === right, f = pick == null ? null : say(pick);
      el.innerHTML = `<h1>The answer without the number</h1>
        <p class="lead">The ground-handling team at a regional airport has a help desk bot. Crew ask it questions, and it answers from the team's safety manual (the airport and the manual are made up for this lesson). The bot does not send the whole manual to the model. It cuts the manual into pieces of ${SIZE} words, finds the ${TOP_K} pieces that best match the question, and sends only those, with the question. This search-then-answer setup is RAG (retrieval-augmented generation). This lesson is about its first step: how to cut the document.</p>
        <p class="lead">A baggage tractor driver asked:</p>
        <p class="${P}q">${kit.esc(QUESTION)}</p>
        <p class="${P}who">A small hosted model answered, from the ${TOP_K} pieces it got:</p>
        <div class="${P}out">${kit.esc(REC_FIXED.text)}</div>${caption(REC_FIXED)}
        <p class="task">She asked “how far” and got no distance. Here is section 4 of the manual. Tap the sentence that holds the number she needed.</p>
        <div class="${P}lines">${LINES.slice(SEC4[0], SEC4[1]).map((t, j) => {
          const i = SEC4[0] + j;
          return `<button type="button" class="${P}ln ${i === SEC4[0] ? "h" : ""} ${pick === i ? (ok ? "right" : "wrong") : ""}" data-l="${i}" ${ok ? "disabled" : ""}>${kit.esc(t)}</button>`;
        }).join("")}</div>
        <div class="lpanel">${f ? kit.feedback(f[0], f[1]) : ""}</div>`;
      el.querySelectorAll(`button.${P}ln`).forEach(b => b.onclick = () => { pick = +b.dataset.l; paint(); if (pick === right) done(); });
    };
    paint();
  }

  /* 2. By hand: cut the manual every 50 words, then find where the rule went. */
  function byHand({ el, done, kit }) {
    css();
    let k = 0, miss = null, q2 = null;
    const cA = chunkOf(F50, RULE_FROM), cB = chunkOf(F50, RULE_TO);
    const o2 = [`Whole in chunk ${cA + 1}`, `Whole in chunk ${cA + 2}`, `Split: the “stay outside the zone” sentence in chunk ${cA + 1}, the zone's size in chunk ${cA + 2}`];
    const r2 = cA === cB ? 0 : 2;
    const marked = (i, upto) => {
      // the line's words, with a mark after every cut word already placed that falls in this line
      const [a] = SPANS[i], ws = split(LINES[i]);
      return ws.map((w, j) => {
        const n = a + j, c = CUTS.indexOf(n);
        return kit.esc(w) + (c >= 0 && c < upto ? ` <span class="${P}cut">cut: chunk ${c + 2} starts</span>` : "");
      }).join(" ");
    };
    const paint = () => {
      const fin = k === CUTS.length, cut = CUTS[k];
      el.innerHTML = `<h1>Cut the manual by hand</h1>
        <p class="lead">These pieces are called <b>chunks</b>. The code that cuts them is the <b>chunker</b>. The bot's chunker counts words and cuts after every ${SIZE}th word, wherever it falls. The whole manual is ${WORDS.length} words. Under each line you see its word numbers. The rule the driver needed is two sentences, marked with a bar on the left.</p>
        ${fin ? "" : `<p class="task">Chunk ${k + 1} ends at word ${cut}. Tap the line that holds word ${cut}.</p>`}
        <div class="${P}lines">${LINES.map((t, i) => `<button type="button" class="${P}ln ${/^\d+\. /.test(t) ? "h" : ""} ${RULE.includes(i) ? "rule" : ""} ${miss && miss.i === i ? "wrong" : ""}" data-l="${i}" ${fin ? "disabled" : ""}>${marked(i, k)}<span class="${P}rng">words ${SPANS[i][0]}–${SPANS[i][1]}</span></button>`).join("")}</div>
        <div class="lpanel">${miss ? kit.feedback(miss.say, false) : ""}
        ${fin ? `${kit.feedback(`${CUTS.length} cuts, ${F50.length} chunks. Look at the cut after word ${CUTS[0]}: “Within ${WORDS[CUTS[0] - 1]}” ends chunk 1 and “${WORDS[CUTS[0]]} of a parked aircraft” starts chunk 2. The chunker does not know what a sentence is.`)}
          <div id="q2"><p class="task">Where did the refuelling-distance rule (words ${RULE_FROM}–${RULE_TO}) end up?</p>${kit.options(o2, { picked: q2, correct: r2 })}
          ${q2 == null ? "" : q2 === r2 ? kit.feedback(`Right. The cut after word ${CUTS[cB - 1]} falls exactly between the two sentences. Each sentence is whole, but the rule is not: chunk ${cA + 1} says “stay outside the zone”, chunk ${cB + 1} says how big the zone is. No single chunk holds the whole rule.`, true)
            : kit.feedback(q2 === 0 ? `Chunk ${cA + 1} runs from word ${F50[cA][0]} to ${F50[cA][1]}. The rule ends at word ${RULE_TO}, past the end of chunk ${cA + 1}.`
              : `Chunk ${cA + 2} starts at word ${F50[cA + 1][0]}, but the rule starts at word ${RULE_FROM}, inside chunk ${cA + 1}.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(`button.${P}ln`).forEach(b => b.onclick = () => {
        const i = +b.dataset.l, [a, z] = SPANS[i];
        if (a <= cut && cut <= z) { miss = null; k++; paint(); return; }
        miss = { i, say: `That line holds words ${a}–${z}, so word ${cut} is ${z < cut ? "further down" : "further up"}. Find the line whose range includes ${cut}.` };
        paint();
      });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { q2 = +b.dataset.i; paint(); if (q2 === r2) done(); });
    };
    paint();
  }

  /* 3. Broken on purpose: the real search result. Find the chunk with the number, then the cause. */
  function broken({ el, done, kit }) {
    css();
    let pick = null, cause = null;
    const R = RUN["size 50"], numChunk = chunkOf(F50, NUM_WORD);
    const halfChunk = chunkOf(F50, RULE_FROM), numRank = rankOf("size 50", numChunk);
    const CAUSES = [
      "The model is too small to find the number in what it got",
      "The cut split the rule: the half that matches the question has no number, and the half with the number shares no word with the question",
      `The bot sends too few chunks; sending ${numRank} instead of ${TOP_K} fixes it`,
      "The driver worded the question badly"
    ];
    const cRight = 1;
    const cardSay = i => {
      const r = rankOf("size 50", i), sw = shared(chunkText(F50[i]));
      if (i === numChunk) return [`Right: chunk ${i + 1} holds “${WORDS.slice(NUM_WORD - 1, NUM_WORD + 1).join(" ")}”. It ranked ${ord(r)} of ${F50.length}, with a score of ${R.ranked[r - 1][1].toFixed(3)}, so it never reached the model.`, true];
      if (i === halfChunk) return [`Chunk ${i + 1} ranked 1st and reached the model. It holds the half of the rule the answer repeated, “stay outside the zone”, but no distance. It is why the answer looks right and is useless.`, false];
      return [`Chunk ${i + 1} ranked ${ord(r)}. ${r <= TOP_K ? `It reached the model, but it is about driving on the apron, not refuelling. It even starts with “${WORDS.slice(F50[i][0] - 1, F50[i][0] + 2).join(" ")}”: the speed rule was cut in half too.` : "It holds nothing about refuelling."} ${sw.length ? `It shares ${sw.map(w => `“${w}”`).join(", ")} with the question.` : ""}`, false];
    };
    const paint = () => {
      const ok = pick === numChunk, f = pick == null ? null : cardSay(pick);
      el.innerHTML = `<h1>Broken on purpose: read the search result</h1>
        <p class="lead">This is the real search the bot ran for the driver's question on the ${F50.length} chunks you cut. Our small search gives each chunk a <b>score</b>: it counts the question's words that the chunk contains, and rare words count more. (This method is called TF-IDF. Many real systems score by meaning instead, with embeddings: the next lesson.) The question's words that count: ${QTERMS.map(w => `<code>${w}</code>`).join(" ")}. The ${TOP_K} best chunks, framed thicker, went to the model.</p>
        <p class="task">Tap the chunk that holds the number the driver needed.</p>
        <div class="${P}cards">${R.ranked.map(([i, sc], r) => {
          const sw = shared(chunkText(F50[i]));
          return `<button type="button" class="${P}card ${r < TOP_K ? "sent" : ""} ${pick === i ? (ok ? "right" : "wrong") : ""}" data-c="${i}">
            <div class="hd"><b>rank ${r + 1}</b><b>chunk ${i + 1}</b><span>score ${sc.toFixed(3)}</span><span>${r < TOP_K ? "sent to the model" : "not sent"}</span><span>shares: ${sw.length ? sw.join(", ") : "nothing"}</span></div>
            <div class="tx">${kit.esc(chunkText(F50[i]))}</div></button>`;
        }).join("")}</div>
        <div class="lpanel">${f ? kit.feedback(f[0], f[1]) : ""}
        ${ok ? `<div id="cause"><p class="task">What is the cause of the bad answer?</p>${kit.options(CAUSES.map(kit.esc), { picked: cause, correct: cRight })}
          ${cause == null ? "" : cause === cRight ? kit.feedback(`Right. This failure is <b>a fact cut in half</b>. Search returns whole chunks, never half of one plus half of the next, so a fact must live inside one chunk to be found. Here the half that looks like the question won, and the half that holds the answer looks like nothing. Nothing errors: the answer is fluent and just leaves the number out.`, true)
            : cause === 0 ? kit.feedback(`The model used only the chunks it got, and the number was not in them. (Its instructions also told it to say when the chunks do not answer; in this run it did not.) A bigger model would get the same ${TOP_K} chunks.`, false)
            : cause === 2 ? kit.feedback(`Here that means sending all ${F50.length} chunks, the whole manual. A real manual has thousands of chunks, and the chunk with the number shares no word with the question, so it can rank anywhere. More chunks also means more tokens on every call.`, false)
            : kit.feedback(`The question uses the manual's own words: ${shared(chunkText(F50[halfChunk])).join(", ")}. The trouble is that the answer sits in a chunk that uses none of them.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(`.${P}card`).forEach(b => b.onclick = () => { if (pick === numChunk) return; pick = +b.dataset.c; paint(); });
      el.querySelectorAll("#cause .lopts button").forEach(b => b.onclick = () => { cause = +b.dataset.i; paint(); if (cause === cRight) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: what should decide where a chunk ends? */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      `A fixed word count, just a bigger one, such as 100`,
      `The manual's own structure: cut at headings first, then between sentences, and use a word limit only as a ceiling`,
      `One sentence per chunk, so no sentence is ever cut`,
      `No cutting at all: send the whole manual with every question`
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Where should a chunk end?</h1>
        <p class="lead">You saw it: the chunker cut wherever word ${SIZE} fell. The search can only hand over whole chunks, so the cuts decide which facts can ever be found together.</p>
        <p class="task">What should decide where a chunk ends, so that rules stay whole?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The writer already grouped the manual into units of meaning: a numbered section is one topic, a sentence is one statement. Cut at the biggest unit that fits under the ceiling: a whole section if it fits, otherwise between sentences. This is <b>structure-aware chunking</b>. The ceiling is still needed, because a long section would make a chunk that is costly to send and matches everything a little.`, true)
          : ans === 0 ? kit.feedback(`In our run, chunks of 100 words did keep this rule whole, by luck: the ${RULE_LEN}-word rule fell inside words ${RUN["size 100"].words[0] + 1}–${WORDS.length}. A fixed count still cuts wherever the count lands, and the next manual has a rule sitting on the cut.`, false)
          : ans === 2 ? kit.feedback(`The rule is two sentences. Alone, “${kit.esc(LINES[RULE[1]])}” does not say which zone or who must stay out of it, and it shares no word with the question, just like chunk ${chunkOf(F50, NUM_WORD) + 1}.`, false)
          : kit.feedback(`That works for this ${WORDS.length}-word manual. Real manuals run to hundreds of pages: many models cannot take that much, and the ones that can charge for all of it on every call. Search exists to send only the part that matters.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Use it, with predictions: three new chunkings. Is the rule whole in one chunk? */
  function predict({ el, done, kit }) {
    css();
    const ans = [null, null, null];
    const ov = [10, 15].map(o => ({ o, spans: fixedSpans(SIZE, o), setup: `size ${SIZE}, overlap ${o}` }));
    const fits = sp => sp.some(([a, b]) => a <= RULE_FROM && RULE_TO <= b);
    const near = sp => sp.filter(([a, b]) => b >= RULE_FROM && a <= RULE_TO);
    const CASES = [
      ...ov.map(({ o, spans, setup }) => ({
        setup, whole: fits(spans),
        info: `Chunks of ${SIZE} words, each repeating the last ${o} words of the one before (<b>overlap ${o}</b>). So a new chunk starts every ${SIZE} − ${o} = ${SIZE - o} words: at words ${spans.map(s => s[0]).join(", ")}.`,
        why: `The chunks that touch the rule are ${near(spans).map(([a, b]) => `${a}–${b}`).join(" and ")}. ${fits(spans) ? `Chunk ${spans.findIndex(([a, b]) => a <= RULE_FROM && RULE_TO <= b) + 1} (${spans.find(([a, b]) => a <= RULE_FROM && RULE_TO <= b).join("–")}) holds all of words ${RULE_FROM}–${RULE_TO}.` : `The first ends before word ${RULE_TO}, the second starts after word ${RULE_FROM}: neither holds the whole rule.`}`
      })),
      { setup: "by heading, max 80", whole: SEC_LEN <= 80,
        info: `One chunk per numbered section. A section longer than 80 words would be packed into chunks by sentence. Section 4 runs from word ${SEC_FROM} to word ${SEC_TO}.`,
        why: `Section 4 is ${SEC_TO} − ${SEC_FROM} + 1 = ${SEC_LEN} words, ${SEC_LEN <= 80 ? "under" : "over"} the ceiling of 80, so it ${SEC_LEN <= 80 ? "stays one chunk, rule included" : "is split by sentence"}.` }
    ];
    const run = c => {
      const R = RUN[c.setup], [top] = R.ranked[0];
      return `In our run: ${R.words.length} chunks, and the top-ranked one, chunk ${top + 1}, ${R.whole.includes(top) ? "holds the whole rule" : "holds only one half of the rule"}.`;
    };
    const paint = () => {
      const all = CASES.every((c, i) => ans[i] === (c.whole ? 0 : 1));
      el.innerHTML = `<h1>Will the rule stay whole?</h1>
        <p class="lead">The team tries three other chunkers on the same manual. The rule is words ${RULE_FROM}–${RULE_TO}, ${RULE_LEN} words long. A chunk keeps it whole only if the chunk starts at or before word ${RULE_FROM} and ends at or after word ${RULE_TO}.</p>
        <p class="task">Predict for each chunker: does one chunk hold the whole rule?</p>
        ${CASES.map((c, i) => {
          const right = ans[i] === (c.whole ? 0 : 1);
          return `<div class="lcase" id="c${i}"><p><b>${kit.esc(c.setup)}.</b> ${c.info}</p>${kit.options(["Whole in one chunk", "Split"], { picked: ans[i], correct: c.whole ? 0 : 1 })}
            ${ans[i] == null ? "" : right ? kit.feedback(`Right. ${c.why} ${run(c)}`, true) : kit.feedback(`Check the ends. ${c.why}`, false)}</div>`;
        }).join("")}
        ${all ? `${kit.feedback(`Look at the two overlaps. More overlap did <b>not</b> help: ${ov[0].o} kept the rule whole and ${ov[1].o} did not, because a different overlap changes the step, and that moves every cut. Overlap guarantees only that a short fact, about as long as the overlap (here ${ov[0].o} or ${ov[1].o} words), lands whole in some chunk. This rule is ${RULE_LEN} words, so whether it stays whole is luck. It is a safety net under structure, not a fix.`)}
          <p class="${P}who">With the by-heading chunks, the same model, asked the same question, answered:</p>
          <div class="${P}out">${kit.esc(REC_HEAD.text)}</div>${caption(REC_HEAD)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((x, j) => ans[j] === (x.whole ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 6. From scratch in Python: pack sentences under a ceiling. Replayed from trace_pack.out.txt. */
  const CODE = [
    "def pack(sentences, max_words):",
    "    chunks, chunk, n = [], [], 0",
    "    for sentence in sentences:",
    "        size = len(sentence.split())",
    "        if chunk and n + size > max_words:",
    "            chunks.append(\" \".join(chunk))",
    "            chunk, n = [], 0",
    "        chunk.append(sentence)",
    "        n += size",
    "    chunks.append(\" \".join(chunk))",
    "    return chunks"
  ];
  // docs/ai-path/runs/s5a-chunking/trace_pack.out.txt (pack on section 4, max_words=50): [line, sentence, size, n, chunk,
  // chunks]; sentence = its index in the section, chunk = the sentence indexes in it, chunks = the word count of each
  const TRACE = [
    [1, null, null, null, [], []], [2, null, null, 0, [], []], [3, 0, null, 0, [], []], [4, 0, 2, 0, [], []], [7, 0, 2, 0, [], []],
    [8, 0, 2, 0, [0], []], [2, 0, 2, 2, [0], []], [3, 1, 2, 2, [0], []], [4, 1, 9, 2, [0], []], [7, 1, 9, 2, [0], []],
    [8, 1, 9, 2, [0, 1], []], [2, 1, 9, 11, [0, 1], []], [3, 2, 9, 11, [0, 1], []], [4, 2, 15, 11, [0, 1], []], [7, 2, 15, 11, [0, 1], []],
    [8, 2, 15, 11, [0, 1, 2], []], [2, 2, 15, 26, [0, 1, 2], []], [3, 3, 15, 26, [0, 1, 2], []], [4, 3, 22, 26, [0, 1, 2], []],
    [7, 3, 22, 26, [0, 1, 2], []], [8, 3, 22, 26, [0, 1, 2, 3], []], [2, 3, 22, 48, [0, 1, 2, 3], []], [3, 4, 22, 48, [0, 1, 2, 3], []],
    [4, 4, 15, 48, [0, 1, 2, 3], []], [5, 4, 15, 48, [0, 1, 2, 3], []], [6, 4, 15, 48, [0, 1, 2, 3], [48]], [7, 4, 15, 0, [], [48]],
    [8, 4, 15, 0, [4], [48]], [2, 4, 15, 15, [4], [48]], [3, 5, 15, 15, [4], [48]], [4, 5, 13, 15, [4], [48]], [7, 5, 13, 15, [4], [48]],
    [8, 5, 13, 15, [4, 5], [48]], [2, 5, 13, 28, [4, 5], [48]], [9, 5, 13, 28, [4, 5], [48]], [10, 5, 13, 28, [4, 5], [48, 28]],
    [10, 5, 13, 28, [4, 5], [48, 28]]   // the last row is the "return" event
  ].map(([line, sentence, size, n, chunk, chunks]) => ({ line, sentence, size, n, chunk, chunks }));
  const MAXW = 50, MAX80 = [76];               // trace_pack.out.txt: "max_words=80 -> [76] words per chunk"
  // a frame = one listing line that has just run, with the state right after it; only the lines that change state
  const FRAMES = TRACE.slice(0, -1).map((s, i) => ({ ln: s.line, ...TRACE[i + 1], line: undefined }))
    .filter(f => [1, 3, 5, 6, 7, 8, 9].includes(f.ln));
  const SECTION = LINES.slice(SEC4[0], SEC4[1]);
  const SWORDS = SECTION.map(s => split(s).length);
  function codeScreen({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const GATE = FRAMES.findIndex(f => f.ln === 5);
    const before = FRAMES[GATE - 1];
    const fill = MAXW - before.n;
    const popts = [
      `Sentence ${before.sentence} joins the chunk anyway: max_words is only a hint`,
      `The chunk so far (sentences ${before.chunk[0]} to ${before.chunk[before.chunk.length - 1]}) is closed, and sentence ${before.sentence} starts a new chunk`,
      `Sentence ${before.sentence} is cut after its first ${fill} words, to fill the chunk up to exactly ${MAXW}`
    ];
    const pright = 1;
    const SAY = {
      1: () => "Two empty lists and a counter: <code>chunks</code> collects finished chunks, <code>chunk</code> holds the sentences of the chunk being filled, and <code>n</code> counts its words.",
      3: f => `Sentence ${f.sentence} has size = ${f.size} words. With it, the chunk would have n + size = ${f.n} + ${f.size} = ${f.n + f.size} words.${f.n + f.size > MAXW ? ` That is over max_words = ${MAXW}.` : ` Not over ${MAXW}, so it fits.`}`,
      5: () => `The chunk being filled is closed: chunks now holds one chunk of ${FRAMES[GATE].chunks[0]} words. It ends after sentence ${before.chunk[before.chunk.length - 1]}, “stay outside the zone”.`,
      6: () => "Start a new, empty chunk, and set n back to 0.",
      7: f => `Sentence ${f.chunk[f.chunk.length - 1]} goes into the chunk: sentences ${f.chunk.join(", ")}.`,
      8: f => `n adds its ${f.size} words: n = ${f.n}.`,
      9: f => `The loop is over. The last chunk is closed too: ${f.chunks.length} chunks of ${f.chunks.join(" and ")} words.`
    };
    const paint = () => {
      const f = FRAMES[i], gate = i === GATE - 1 && pred !== pright, last = i === FRAMES.length - 1;
      el.innerHTML = `<h1>Packing by sentence, in Python</h1>
        <p class="lead">The structure-aware chunker from screen 4 splits the manual at its numbered headings, then hands each section to <code>pack</code>. <code>pack</code> never cuts a sentence: it adds whole sentences to a chunk until the next one would go over <code>max_words</code>. This replays a real run on section 4 with <code>max_words=${MAXW}</code>. The section's sentences, numbered as in the code:</p>
        <table class="${P}tb"><thead><tr><th>sentence</th><th class="n">words</th></tr></thead><tbody>${SECTION.map((s, j) => `<tr class="${f.sentence === j ? "on" : ""}"><td>${j}. ${kit.esc(s.length > 60 ? s.slice(0, 57) + "…" : s)}</td><td class="n">${SWORDS[j]}</td></tr>`).join("")}</tbody></table>
        <p class="task">Step through to the end. When sentence ${before.sentence} would push the chunk over ${MAXW}, predict what <code>pack</code> does.</p>
        ${kit.code(CODE, f.ln)}
        <div class="vars"><span>sentence <b>${f.sentence ?? "–"}</b></span><span>size <b>${f.size ?? "–"}</b></span><span>n <b>${f.n ?? "–"}</b></span><span>chunk <b>[${f.chunk.join(", ")}]</b></span><span>chunks <b>${f.chunks.length ? `[${f.chunks.map(n => `${n} words`).join(", ")}]` : "[]"}</b></span><span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(SAY[f.ln](f))}
        ${gate || (i === GATE - 1 && pred === pright) ? `<div id="pred"><p class="task">n + size = ${f.n + f.size}, over ${MAXW}, and chunk is not empty. What happens next?</p>${kit.options(popts.map(kit.esc), { picked: pred, correct: pright })}
          ${pred == null ? "" : pred === pright ? kit.feedback("Right. Inside the if, the chunk so far is appended to chunks, chunk is emptied and n is set back to 0; then the sentence goes into the new, empty chunk.", true)
            : pred === 0 ? kit.feedback(`The if checks <code>n + size > max_words</code>, and ${f.n + f.size} > ${MAXW} is true. The ceiling is enforced.`, false)
            : kit.feedback("No line in pack cuts inside a sentence. Sentences go in whole or start a new chunk; that is the point of packing by sentence.", false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || gate ? "disabled" : ""}>Next step</button></div>
        ${last ? kit.feedback(`Every sentence stayed whole, and the rule was still split: sentence 3 (“stay outside the zone”) closed chunk 1, sentence 4 (the zone's size) opened chunk 2. Keeping sentences whole is not the same as keeping facts whole. That is why the size of the ceiling matters: with <code>max_words=80</code> the same section gives ${MAX80.length} chunk of ${MAX80[0]} words, as on the last screen. Libraries do the same thing at scale: LangChain's <code>RecursiveCharacterTextSplitter</code> tries paragraph breaks first, then line breaks, then spaces; its <code>chunk_size</code> is the ceiling (in characters by default), and <code>chunk_overlap</code> repeats text between chunks.`) : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 7. Size is a trade: which setting gets the rule to the model for the fewest words? */
  const SIZES = ["size 25", "size 50", "size 100", "size 200", "by heading, max 80"];
  function sizes({ el, done, kit }) {
    css();
    let ans = null;
    const row = s => {
      const R = RUN[s], w = R.whole.length ? rankOf(s, R.whole[0]) : null;
      return { s, n: R.words.length, rank: w, sent: sentTo(s), ok: w != null && w <= TOP_K };
    };
    const ROWS = SIZES.map(row);
    const best = ROWS.filter(r => r.ok).reduce((a, r) => r.sent < a.sent ? r : a);
    const correct = ROWS.indexOf(best);
    const say = r => !r.rank ? `No chunk at ${r.s} holds the whole rule, so the model gets half of it at best, ${r.s === "size 50" ? "as the driver's answer showed" : "as at size 50"}. ${r.s === "size 25" ? "Small chunks are cheap to send but break more facts." : ""}`
      : r.n === 1 ? `One chunk is the whole manual: the search chooses nothing, and the model reads all ${r.sent} words every time. Affordable for a page, wasteful for a manual of hundreds of pages.`
      : `It gets the rule to the model, but sends ${r.sent} words per question, against ${best.sent} for ${best.s}: big chunks carry a lot of text the question did not need.`;
    const paint = () => {
      el.innerHTML = `<h1>Small chunks or big ones?</h1>
        <p class="lead">Chunk size is a trade. Small chunks are cheap to send but break more facts. Big chunks keep facts whole but send text the question did not need, on every call. Here is our run: same question, and the bot sends the top ${TOP_K} chunks. “Whole rule ranked” is the rank of the chunk that holds the whole rule.</p>
        <table class="${P}tb"><thead><tr><th>chunker</th><th class="n">chunks</th><th class="n">whole rule ranked</th><th class="n">words sent</th></tr></thead><tbody>
          ${ROWS.map((r, i) => `<tr class="${ans === correct && i === correct ? "on" : ""}"><td>${kit.esc(r.s)}</td><td class="n">${r.n}</td><td class="n">${r.rank ? ord(r.rank) : "never whole"}</td><td class="n">${r.sent}</td></tr>`).join("")}</tbody></table>
        <p class="task">Which chunker gets the whole rule to the model while sending the fewest words?</p>
        <div class="lpanel">${kit.options(SIZES.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct ? kit.feedback(`Right: ranked ${ord(best.rank)}, ${best.sent} words sent. The section is one topic, so the chunk is about as big as the fact needs and no bigger. Fewer words also means fewer tokens per call. On real documents you pick the ceiling the same way: run your real questions against a few settings and measure, the topic of the evaluation lessons.`, true)
          : kit.feedback(say(ROWS[ans]), false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  const BIG = [
    ["A 400-page aircraft maintenance manual with numbered sections. Mechanics ask about one procedure at a time.", 0,
      "Right. Too much to send with every question, and each answer lives in one section. Chunk by section, with a ceiling, and search."],
    ["A one-page fuel-desk checklist that easily fits the model's context window. Staff ask questions about it.", 1,
      "Right. It fits, so send it whole with every question. Chunking would only add a way to lose half a fact."],
    ["Over 2,000 incident reports, a manager asks: how many reports last month mention a fuel spill?", 2,
      "Right. The answer is a count across all reports, not a fact inside one chunk. Search returns a few chunks, so it can never count all of them. Store the reports as records and query them, for example with SQL."]
  ];
  const BIG_OPTS = ["Chunk it by structure and search", "Send it whole, no chunking", "Not a search job: query the records"];
  const BIG_WRONG = [
    ["", "Even where 400 pages fit in a context window, you would pay for all of them on every question, and the one procedure gets lost in the rest.", "Each question has its answer in one section: that is exactly what chunks and search are for."],
    ["It fits in one call. Chunking adds search, and search can miss.", "", "There are no records to count here. The answer is a fact inside one page, and that page fits, so sending the page is all the retrieval it needs."],
    ["The search would return the few best chunks; a count needs every report.", "Sending 2,000 reports on every question is costly, and the model would still have to count them all reliably.", ""]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to chunk, and how</h1>
        <p class="lead"><b>What it is for:</b> cutting long documents into pieces that search can return one by one, so the model gets only the part that answers.</p>
        <p class="lead"><b>Reach for it</b> when documents are too long to send whole and each answer lives in one place. Cut by structure first, keep a size ceiling, add a little overlap as a net.</p>
        <p class="lead"><b>Not when</b> the document fits the window (send it whole), or the question needs every record (a count, a total): query a database instead.</p>
        <p class="lead"><b>Cost:</b> every chunk is stored and searched; overlap stores text twice; bigger chunks send more tokens per call. Changing the chunker means re-chunking and re-indexing everything.</p>
        <p class="task">Pick the right move for each situation.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : BIG_WRONG[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: is the chunking to blame? Two "no" cases. */
  const CASES = [
    ["A hotel bot answers “Can I cancel for free?” with the fee, but not the deadline. On the policy page, the deadline is the next sentence, after a paragraph break.", true,
      "Yes. The fee and the deadline are one rule split across two chunks. Keep the whole cancellation section in one chunk (cut at headings, not at every paragraph break), or overlap one sentence across the break.",
      "The deadline is on the page, one sentence later. The rule was split, and only the half with the fee was returned: a fact cut in half."],
    ["A shipping-rates table was chunked by line. The search returns a chunk “3.20 4.10 5.75”, and the bot cannot say which price is for which weight.", true,
      "Yes. The column headings stayed in another chunk. A table row needs its headings: chunk tables whole, or repeat the headings in every chunk.",
      "The row is useless without its headings, which ended up in a different chunk. That is a chunking cut, just across a table instead of a sentence."],
    ["A policy bot quotes last year's overtime rule. The rule changed last month, and the search index was built in January.", false,
      "No. The chunk holds a whole rule, just an old one. Re-chunking would not help; rebuild the index whenever the documents change.",
      "Nothing was cut: the chunk holds the whole old rule. The index is stale. Rebuilding it from the new documents fixes it, whatever the chunk size."],
    ["A contracts bot answers questions about any one contract well. Then a lawyer asks: “Which of our 40 contracts has the longest notice period?”", false,
      "No. Each notice period sits whole in its chunk. The question needs all 40 compared, and search returns only a few chunks. Pull the notice period of every contract into a table and sort it.",
      "Every fact is whole in its own chunk, so the cuts are fine. The question compares 40 contracts, and search hands over only a few chunks: no chunk size fixes that."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is the chunking to blame?</h1>
        <p class="lead">Four situations without an airport. Ask: was a fact split across chunks, or separated from what gives it meaning?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (browser practice follows). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Cut where the meaning breaks</h1>
      <p class="lead">You can now cut a document by size, with overlap or by structure, and diagnose an answer that came out fluent but without the fact it needed.</p>
      <table class="${P}tb"><tbody>
        <tr><td><b>Unit</b></td><td>Search returns whole chunks. A fact must sit inside one chunk to be found.</td></tr>
        <tr><td><b>Symptom</b></td><td>The answer repeats half a rule. The other half ranks low because on its own it does not look like the question (here: shares no words with it).</td></tr>
        <tr><td><b>Default</b></td><td>Structure first (sections, then sentences), a size ceiling, a little overlap as a net. Measure on real questions.</td></tr>
      </tbody></table>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write a chunker that splits a manual at its headings and packs sentences under a word ceiling, then check that a given rule stays whole.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Each chunk you cut becomes one vector there; that lesson shows how a model turns a chunk of text into one.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5a-chunking", {
    title: "Chunking documents for search",
    checked: "2026-11-13",
    sources: [
      "https://docs.langchain.com/oss/python/integrations/splitters",
      "https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter",
      "https://docs.langchain.com/oss/python/integrations/splitters/markdown_header_metadata_splitter",
      "https://reference.langchain.com/python/langchain-text-splitters/character/RecursiveCharacterTextSplitter",
      "https://platform.claude.com/docs/en/build-with-claude/context-windows"
    ],
    interview: [{
      q: "Your RAG bot over HR policies gives answers that state a rule but leave out its exception or its number. Users say it sounds right but is useless. How do you find the cause and fix it?",
      good: [
        "Take failing questions and look at the retrieved chunks first, before touching the prompt or the model",
        "Check whether the missing part is in the documents but in a neighbouring chunk: a fact cut in half",
        "Notice that the half with the number often ranks low because on its own it does not look like the question",
        "Re-chunk by structure (sections, paragraphs, sentences) with a size ceiling, add some overlap, keep headings with their text",
        "Re-index and measure on a set of real questions that the chunk holding the whole answer is now retrieved"
      ],
      weak: "Switch to a bigger model or raise top-k until the answer appears. That misses that the right text was never in one chunk, and raising k costs tokens on every call."
    }, {
      q: "A teammate wants to set chunk size to 1,000 words with 50% overlap, to be safe. What do you say?",
      good: [
        "Big chunks keep more facts whole but send more tokens per call and carry text the question did not need",
        "Heavy overlap stores much of the text twice and fills the top results with near-duplicates",
        "Overlap only guarantees short facts; cutting by the document's structure is what keeps rules whole",
        "Pick the size by measuring retrieval and answers on our real questions at a few settings"
      ],
      weak: "Agreeing that bigger and more overlap is always safer, without mentioning cost per call, duplicates, or measuring."
    }],
    screens: [situation, byHand, broken, spotIdea, predict, codeScreen, sizes, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-l="${RULE[0]}"]`], right: [`[data-l="${RULE[1]}"]`] },
      { wrong: ['[data-l="0"]'], right: [...CUTS.map(c => `[data-l="${lineOf(c)}"]`), "#q2 [data-right]"] },
      { wrong: [`[data-c="${chunkOf(F50, RULE_FROM)}"]`], right: [`[data-c="${chunkOf(F50, NUM_WORD)}"]`, "#cause [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: [0, 1, 2].map(i => `#c${i} [data-right]`) },
      { wrong: [...Array(FRAMES.findIndex(f => f.ln === 5) - 1).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FRAMES.length - FRAMES.findIndex(f => f.ln === 5)).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
