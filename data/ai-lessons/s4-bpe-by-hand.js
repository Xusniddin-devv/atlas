/* Lesson: tokens and byte-pair encoding by hand. Story: a ferry company's departure notices ("departs",
   "departed", "departing", "departure", "redeparture") swell a word list, so the learner builds word pieces instead.
   Ideas: (1) BPE learns its pieces by merging the most frequent neighbour pair again and again, counted over every
   word, so pieces that many words share (depart) win, with no knowledge of language; (2) a new word is split by
   applying the learned merges in the order they were learned, so it falls back to known pieces and is never lost.
   Data, all real (no model calls in this lesson):
   - docs/ai-path/runs/s4-bpe-by-hand/bpe_from_scratch.py + bpe_from_scratch.out.txt: the twelve notices, the word
     counts, learn_merges (6 rounds, each best pair and its count), the top four pairs of each round, and the traced
     run of split_word("redeparting") with the first five merges, plus its split with all six.
   Every pair count shown is computed here from WORD_COUNTS by the same rule; the run's numbers are kept beside
   them (ROUNDS) and match.
   Lesson-local style: word rows made of piece boxes and the letter buttons of screen 5 (.lx-s4-bpe-by-hand-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s4-bpe-by-hand";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* ---------- Data copied from docs/ai-path/runs/s4-bpe-by-hand/bpe_from_scratch.out.txt ---------- */
  const NOTICES = [
    "Ferry departs 07:40",
    "Ferry departing 08:15",
    "Departed 09:00, sea calm",
    "Departure 10:30 from depot",
    "Departs 11:00, deck 2",
    "Redeparture 12:10, storm gone",
    "Departing 13:45 from depot",
    "Ferry departs 14:20",
    "Departure 15:00, deck 1",
    "Departing 16:30, boarding starts",
    "Late ferry departed 17:50",
    "Departure 19:00 from depot"
  ];
  // "== word counts" line: words are runs of letters in the lowercased notice
  const WORD_COUNTS = { ferry: 4, departs: 3, departing: 3, departed: 2, sea: 1, calm: 1, departure: 3, from: 3, depot: 3, deck: 2, redeparture: 1, storm: 1, gone: 1, boarding: 1, starts: 1, late: 1 };
  // "== top four pairs before each of the six rounds": [left, right, count]; the first is the round's merge
  const ROUNDS = [
    [["d", "e", 17], ["e", "p", 15], ["a", "r", 14], ["r", "t", 13]],
    [["de", "p", 15], ["a", "r", 14], ["r", "t", 13], ["p", "a", 12]],
    [["a", "r", 14], ["r", "t", 13], ["dep", "a", 12], ["r", "e", 5]],
    [["ar", "t", 13], ["dep", "ar", 12], ["r", "e", 5], ["f", "e", 4]],
    [["dep", "art", 12], ["r", "e", 5], ["f", "e", 4], ["e", "r", 4]],
    [["r", "e", 5], ["f", "e", 4], ["e", "r", 4], ["r", "r", 4]]
  ];
  const MERGES = ROUNDS.map(r => [r[0][0], r[0][1]]);
  const BY_HAND = 5; // rounds the learner does by hand; round 6 is predicted on the training-code screen
  // The printed lines of learn_merges(word_counts, 6)
  const PRINTED = ["('d', 'e') 17", "('de', 'p') 15", "('a', 'r') 14", "('ar', 't') 13", "('dep', 'art') 12", "('r', 'e') 5"];
  const NEW_WORD = "redeparting";
  // Traced split_word("redeparting", merges[:5]): [line about to run, event (l line, r return), pieces, pair]
  const TRACE = [[1,"l",null,null],[2,"l",["r","e","d","e","p","a","r","t","i","n","g"],null],[3,"l",["r","e","d","e","p","a","r","t","i","n","g"],["d","e"]],[2,"l",["r","e","de","p","a","r","t","i","n","g"],["d","e"]],[3,"l",["r","e","de","p","a","r","t","i","n","g"],["de","p"]],[2,"l",["r","e","dep","a","r","t","i","n","g"],["de","p"]],[3,"l",["r","e","dep","a","r","t","i","n","g"],["a","r"]],[2,"l",["r","e","dep","ar","t","i","n","g"],["a","r"]],[3,"l",["r","e","dep","ar","t","i","n","g"],["ar","t"]],[2,"l",["r","e","dep","art","i","n","g"],["ar","t"]],[3,"l",["r","e","dep","art","i","n","g"],["dep","art"]],[2,"l",["r","e","depart","i","n","g"],["dep","art"]],[4,"l",["r","e","depart","i","n","g"],["dep","art"]],[4,"r",["r","e","depart","i","n","g"],["dep","art"]]];
  const SPLIT6 = ["re", "depart", "i", "n", "g"]; // "== split_word('redeparting', all 6 merges)"

  // Listings: the functions in bpe_from_scratch.py, line for line (line 0 = def).
  const SPLIT_CODE = [
    "def split_word(word, merges):",
    "    pieces = list(word)",
    "    for pair in merges:",
    "        pieces = merge_pair(pieces, pair)",
    "    return pieces"
  ];
  const LEARN_CODE = [
    "def learn_merges(words, num_merges):",
    "  splits = {w: list(w) for w in words}",
    "  merges = []",
    "  for _ in range(num_merges):",
    "    counts = Counter()",
    "    for word, count in words.items():",
    "      pieces = splits[word]",
    "      for pair in zip(pieces, pieces[1:]):",
    "        counts[pair] += count",
    "    best = max(counts, key=counts.get)",
    "    print(best, counts[best])",
    "    merges.append(best)",
    "    splits = {w: merge_pair(p, best)",
    "              for w, p in splits.items()}",
    "  return merges"
  ];

  /* ---------- Computed from the data ---------- */
  const WORDS = Object.keys(WORD_COUNTS).sort((a, b) => WORD_COUNTS[b] - WORD_COUNTS[a]);
  const N_WORDS = sum(Object.values(WORD_COUNTS));
  const N_DIFF = WORDS.length;
  const DEPART_FORMS = WORDS.filter(w => w.includes("depart"));
  const DEPART_TOTAL = sum(DEPART_FORMS.map(w => WORD_COUNTS[w]));
  const LETTERS = [...new Set(WORDS.join(""))];
  function mergePair(pieces, [a, b]) {
    const out = [];
    for (let i = 0; i < pieces.length;) {
      if (i < pieces.length - 1 && pieces[i] === a && pieces[i + 1] === b) { out.push(a + b); i += 2; }
      else { out.push(pieces[i]); i += 1; }
    }
    return out;
  }
  // splits of every corpus word after the first k merges
  const splitsAfter = k => Object.fromEntries(WORDS.map(w => [w, MERGES.slice(0, k).reduce(mergePair, [...w])]));
  // how often a, b sit side by side in one word's pieces
  const inWord = (p, a, b) => p.slice(1).filter((x, i) => p[i] === a && x === b).length;
  const pairCount = (sp, a, b) => sum(WORDS.map(w => inWord(sp[w], a, b) * WORD_COUNTS[w]));
  const breakdown = (sp, a, b) => WORDS.filter(w => inWord(sp[w], a, b)).map(w => {
    const k = inWord(sp[w], a, b);
    return `${w} ×${WORD_COUNTS[w]}${k > 1 ? ` (twice in the word: ${k * WORD_COUNTS[w]})` : ""}`;
  });
  const splitWord = (w, k) => MERGES.slice(0, k).reduce(mergePair, [...w]);
  const NEW5 = splitWord(NEW_WORD, BY_HAND);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-notes { margin: 14px 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0 18px; border-top: 1px solid var(--line); }
      .lx-${ID}-notes li { padding: 7px 0; border-bottom: 1px solid var(--line); font: 500 14.5px/1.4 var(--mono); color: var(--ink); }
      .lx-${ID}-words { margin: 14px 0 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 0 18px; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--line); min-width: 0; }
      .lx-${ID}-ps { display: flex; flex-wrap: wrap; gap: 3px; min-width: 0; }
      .lx-${ID}-p { font: 500 14.5px/1 var(--mono); color: var(--ink); border: 1px solid var(--line); background: var(--surface); border-radius: 3px; padding: 4px 4px; }
      .lx-${ID}-p.lx-${ID}-big { border-color: var(--ink-2); }
      .lx-${ID}-p.lx-${ID}-new { border-color: var(--good); background: var(--good-soft); }
      .lx-${ID}-n { margin-left: auto; font: 600 13.5px var(--mono); color: var(--muted); white-space: nowrap; }
      .lx-${ID}-rules { margin: 12px 0 0; font: 500 14.5px/1.6 var(--mono); color: var(--ink); }
      .lx-${ID}-rules b { font-weight: 700; }
      .lx-${ID}-opt { font: 600 15px var(--mono); }
      .lx-${ID}-lts { display: flex; flex-wrap: wrap; gap: 2px; margin: 16px 0 6px; }
      .lx-${ID}-lt { min-width: 26px; min-height: 48px; padding: 0 3px; font: 600 18px var(--mono); color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 3px; cursor: pointer; }
      .lx-${ID}-lt.lx-${ID}-cut { margin-right: 9px; box-shadow: 4px 0 0 -1px var(--ink); }
      .lx-${ID}-lt:last-child { cursor: default; }
      .lx-${ID}-yours { margin: 6px 0 0; font: 500 15px/1.5 var(--mono); color: var(--ink); }
      .lx-${ID}-check { margin-top: 12px; min-height: 48px; }
      .lx-${ID}-out { margin: 10px 0 0; padding: 8px 10px; border: 1px solid var(--line); background: var(--sunk); font: 500 14px/1.6 var(--mono); color: var(--ink); white-space: pre-wrap; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
    `;
    document.head.appendChild(s);
  }
  // one word as piece boxes; fresh = a piece text to mark as just merged
  const pieceRow = (kit, pieces, fresh) => `<span class="lx-${ID}-ps">${pieces.map(p =>
    `<span class="lx-${ID}-p${p === fresh ? ` lx-${ID}-new` : p.length > 1 ? ` lx-${ID}-big` : ""}">${kit.esc(p)}</span>`).join("")}</span>`;
  const wordTable = (kit, sp, fresh) => `<div class="lx-${ID}-words">${WORDS.map(w =>
    `<div class="lx-${ID}-row">${pieceRow(kit, sp[w], fresh)}<span class="lx-${ID}-n">×${WORD_COUNTS[w]}</span></div>`).join("")}</div>`;
  const pairTxt = ([a, b]) => `${a} + ${b}`;
  const optPair = (kit, p) => `<span class="lx-${ID}-opt">${kit.esc(pairTxt(p))}</span>`;
  const rulesList = (kit, k) => k ? `<div class="lx-${ID}-rules">${MERGES.slice(0, k).map((m, i) => `${i + 1}. ${kit.esc(pairTxt(m))} → <b>${kit.esc(m.join(""))}</b>`).join("<br>")}</div>` : "";
  const bar = a => a.join(" | ");
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;

  /* 1. The situation: a word list cannot store a word it has never seen. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const NEW_NOTICE = "Ferry redeparting 20:15 from depot"; // written for the lesson, not from a run
    const newWords = NEW_NOTICE.toLowerCase().match(/[a-z]+/g);
    const RIGHT = newWords.indexOf(NEW_WORD);
    const inNotices = w => NOTICES.filter(n => n.toLowerCase().match(/[a-z]+/g).includes(w)).length;
    const fb = newWords.map(w => w === NEW_WORD
      ? [`Right. <b>${NEW_WORD}</b> never appeared, so the list has no entry for it. The system can only store an “unknown” marker, and the word is lost. Adding it gives depart a ${DEPART_FORMS.length + 1}th entry. Every new form adds another, and the list keeps swelling. In this lesson you build the list from <b>pieces</b> that words share instead.`, true]
      : [`<b>${kit.esc(w)}</b> has an entry: it appears in ${plural(inNotices(w), "notice")} on the board. Look for a word that appears in none of them.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>The word list keeps growing</h1>
        <p class="lead">A ferry company shows these ${NOTICES.length} notices on its departure board. Its text system keeps a <b>word list</b>: every different word gets one entry, and the system stores text as entry numbers. The notices hold ${N_WORDS} words, ${N_DIFF} of them different. ${DEPART_FORMS.length} entries are forms of “depart”: ${DEPART_FORMS.map(w => `<i>${w}</i>`).join(", ")}.</p>
        <p class="lead">A language model reads text the same way, as a list of entry numbers. So before any AI product can read text, something must cut it into entries. This lesson is about that cutting.</p>
        <ul class="lx-${ID}-notes">${NOTICES.map(n => `<li>${kit.esc(n)}</li>`).join("")}</ul>
        <p class="lead">Tonight a new notice goes up: <b>“${kit.esc(NEW_NOTICE)}”</b>.</p>
        <p class="task">Which word of the new notice has no entry in the word list?</p>
        <div class="lpanel">${ask(kit, newWords.map(w => `<span class="lx-${ID}-opt">${kit.esc(w)}</span>`), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2 and 3. Merge rounds by hand: pick the most frequent neighbour pair, watch it merge. */
  // options per round: the run's top four, except round 2, where e + p (top in round 1, now 0) is offered instead of the fourth
  const roundOpts = r => {
    const top = ROUNDS[r].map(([a, b]) => [a, b]);
    if (r === 1) top[3] = ["e", "p"];
    const rot = [3, 1, 0, 2, 3][r]; // fixed order per round: the right answer sits 2nd, 4th, 1st, 3rd, 2nd
    return top.slice(rot).concat(top.slice(0, rot));
  };
  function roundFeedback(kit, r, pick) {
    const sp = splitsAfter(r), best = MERGES[r];
    const n = pairCount(sp, pick[0], pick[1]), nb = pairCount(sp, best[0], best[1]);
    if (pick[0] === "e" && pick[1] === "p" && r === 1)
      return `<b>e + p</b> had ${pairCount(splitsAfter(0), "e", "p")} a round ago, but now it has ${n}. Every e that stood after a d is inside the piece <b>de</b>, and a piece never splits again. Count the pairs as the words look <b>now</b>.`;
    return `<b>${kit.esc(pairTxt(pick))}</b> sits side by side ${plural(n, "time")}. Another pair sits side by side ${nb} times. Multiply each word's pair by its ×count before you compare.`;
  }
  function mergeScreen(rounds, title, lead) {
    return function ({ el, done, kit }) {
      ensureStyle();
      let at = 0, picked = null, finished = false;
      const paint = () => {
        const r = rounds[Math.min(at, rounds.length - 1)];
        const shownK = finished ? r + 1 : r; // merges applied in the word table
        const sp = splitsAfter(shownK);
        const fresh = shownK ? MERGES[shownK - 1].join("") : null;
        const opts = roundOpts(r), correct = opts.findIndex(p => p.join() === MERGES[r].join());
        const best = MERGES[r], spR = splitsAfter(r), nb = pairCount(spR, best[0], best[1]);
        let panel;
        if (finished) {
          panel = kit.feedback(`Right: <b>${kit.esc(pairTxt(best))}</b>, ${nb} times (${breakdown(spR, best[0], best[1]).join(", ")}). It is merged: everywhere ${kit.esc(best[0])} stands right before ${kit.esc(best[1])}, the two become one piece <b>${kit.esc(best.join(""))}</b>, marked in the words above. That is rule ${r + 1}.${r + 1 === BY_HAND ? ` After ${BY_HAND} rules, “depart” is one piece in all ${DEPART_FORMS.length} of its forms.` : ""}`, true);
        } else {
          panel = `${kit.options(opts.map(p => optPair(kit, p)), { picked, correct })}${picked != null && picked !== correct ? kit.feedback(roundFeedback(kit, r, opts[picked]), false) : ""}`;
        }
        el.innerHTML = `<h1>${title}</h1>
          <p class="lead">${lead}</p>
          ${rulesList(kit, shownK)}
          ${wordTable(kit, sp, fresh)}
          ${finished ? "" : `<p class="task">Round ${r + 1}: which pair sits side by side most often, counting each word ×count times?</p>`}
          <div class="lpanel">${panel}</div>`;
        el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
          picked = +b.dataset.i;
          if (picked === correct) {
            picked = null;
            if (at === rounds.length - 1) { finished = true; paint(); done(); return; }
            at++;
          }
          paint();
        });
      };
      paint();
    };
  }
  const firstMerge = mergeScreen([0], "Merge the most frequent pair",
    `Start from single letters: every word is a row of one-letter pieces, and ×3 means the word appears 3 times on the board. Two pieces next to each other inside one word are a <b>pair</b>. To count a pair, see how many times it sits in each word, multiply by that word's ×count, and add up over all words. The most frequent pair will become one new piece.`);
  const moreMerges = mergeScreen([1, 2, 3, 4], "Four more rounds",
    `Same move each round, on the words as they look now: count the pairs, merge the most frequent one into a single piece, and write it down as a rule (“glue this pair”). A merged piece can pair with its neighbours in the next round. Pieces made by earlier rules are outlined; the piece just merged is filled.`);

  /* 4. Spot the idea: shared strings win, with no knowledge of language. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const sp = splitsAfter(BY_HAND);
    const ferryBest = Math.max(...sp.ferry.slice(1).map((x, i) => pairCount(sp, sp.ferry[i], x)));
    const minCount = Math.min(...ROUNDS.slice(0, BY_HAND).map(r => pairCount(splitsAfter(ROUNDS.indexOf(r)), r[0][0], r[0][1])));
    const opts = [
      "Longer strings are merged first, and depart is longer than ferry",
      `Pair counts add up over every word that contains the pair, and ${DEPART_FORMS.length} different words share d-e-p-a-r-t`,
      "The method knows that depart is an English word stem",
      "ferry was merged too, but only in rounds you did not see"
    ];
    const fb = [
      ["Length plays no part. Round 1 merged two letters, d and e. Each round only compares counts.", false],
      [`Right. <i>${DEPART_FORMS.join(", ")}</i> each count toward the same pairs, ${DEPART_TOTAL} times together. The pairs of ferry (f + e, e + r, r + r, r + y) sit only in ferry: ${WORD_COUNTS.ferry} times each. So the shared piece wins, even though no single form of depart is as common as ferry.<br><br>Now the names. Each piece is a <b>token</b>. The list of all tokens (the letters plus every merged piece) is the <b>vocabulary</b>. The method you just ran is <b>byte-pair encoding</b>, BPE. The name comes from a data compression method that replaces frequent pairs of bytes. Sennrich and colleagues used the same move to split rare words into pieces for translation models.`, true],
      [`It knows nothing about English. It merged a + r inside <i>boarding</i> too, where “ar” means nothing, and <b>dep</b> partly because of <i>depot</i>. It only counts pairs.`, false],
      [`After ${BY_HAND} rounds ferry is still ${bar(sp.ferry)}. Its most frequent pair has ${ferryBest}; every pair merged so far had ${minCount} or more.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why depart, and not ferry?</h1>
        <p class="lead"><i>ferry</i> is the most common word on the board (×${WORD_COUNTS.ferry}), more than any single form of depart. Yet after your ${BY_HAND} rules, depart is one piece and ferry is still ${sp.ferry.length} letters.</p>
        ${rulesList(kit, BY_HAND)}
        <p class="task">Why did depart win?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Predict how the new word splits, by marking the cuts. */
  function predictSplit({ el, done, kit }) {
    ensureStyle();
    const letters = [...NEW_WORD];
    const cuts = new Set();
    let checked = null; // null, or the pieces checked last
    const piecesOf = () => { const out = []; let cur = ""; letters.forEach((c, i) => { cur += c; if (cuts.has(i) || i === letters.length - 1) { out.push(cur); cur = ""; } }); return out; };
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const explain = P => {
      const msgs = [];
      if (P.length === 1) msgs.push(`One piece, <b>${NEW_WORD}</b>, is exactly what the word list had no entry for. Your rules only glue pairs; start from single letters and apply them.`);
      const built = MERGES.slice(0, BY_HAND).map(m => m.join(""));
      P.filter(p => p.length > 1 && !NEW5.includes(p)).forEach(p => {
        if (P.length === 1 || built.includes(p)) return; // a rule's piece cut short: the "cut inside" note below covers it
        if (p === "re") msgs.push(`<b>re</b>: is r + e one of your ${BY_HAND} rules? It is not, so r and e stay apart.`);
        else if (/^[ing]+$/.test(p)) msgs.push(`<b>${kit.esc(p)}</b>: no rule merges i, n or g, so they stay single letters.`);
        else if (p.includes("depart")) msgs.push(`<b>${kit.esc(p)}</b>: no rule glues anything onto depart.`);
        else msgs.push(`<b>${kit.esc(p)}</b>: none of your rules builds this piece.`);
      });
      NEW5.filter(p => p.length > 1 && !P.includes(p) && !P.some(q => q.includes(p))).forEach(p =>
        msgs.push(`You cut inside <b>${kit.esc(p)}</b>. Apply the rules in order: d + e, then de + p, a + r, ar + t, dep + art. Together they glue it back into one piece.`));
      return msgs.join(" ") || "Compare your pieces with the rules, one rule at a time, in order.";
    };
    const paint = () => {
      const P = piecesOf();
      const ok = checked && same(checked, NEW5);
      el.innerHTML = `<h1>Split a word you never saw</h1>
        <p class="lead">The new notice says <b>${NEW_WORD}</b>. It was in none of the ${NOTICES.length} notices, so no rule was learned from it. To split a word, start from its letters and apply the rules <b>in the order they were learned</b>, each one everywhere it fits.</p>
        ${rulesList(kit, BY_HAND)}
        <p class="task">Tap a letter to cut after it (tap again to undo). Make the pieces your ${BY_HAND} rules produce, then check.</p>
        <div class="lx-${ID}-lts">${letters.map((c, i) => `<button type="button" class="lx-${ID}-lt${cuts.has(i) ? ` lx-${ID}-cut` : ""}" data-i="${i}" aria-pressed="${cuts.has(i)}" aria-label="${c}${cuts.has(i) ? ", cut after" : ""}"${i === letters.length - 1 ? " disabled" : ""}>${c}</button>`).join("")}</div>
        <p class="lx-${ID}-yours">Your pieces: ${kit.esc(bar(P))} (${plural(P.length, "piece")})</p>
        <button type="button" class="btn primary lx-${ID}-check" data-check>Check my split</button>
        <div class="lpanel">${checked == null ? "" : ok
          ? kit.feedback(`Right: <b>${kit.esc(bar(NEW5))}</b>, ${plural(NEW5.length, "token")} instead of ${letters.length} letters, and every one is in the vocabulary. Nothing is lost: the shared piece depart stays whole, and the leftover letters stay as single tokens. r and e stay apart because no rule merges them. You will check this against the real code next.`, true)
          : kit.feedback(explain(checked), false)}</div>`;
      el.querySelectorAll(`.lx-${ID}-lt`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i; if (i === letters.length - 1) return;
        cuts.has(i) ? cuts.delete(i) : cuts.add(i); checked = null; paint();
      });
      el.querySelector("[data-check]").onclick = () => { checked = piecesOf(); paint(); if (same(checked, NEW5)) done(); };
    };
    paint();
  }
  const RIGHT_CUT_IDX = (() => { const s = []; let at = 0; NEW5.slice(0, -1).forEach(p => { at += p.length; s.push(at - 1); }); return s; })();

  /* 6. The split in Python: a stepped replay of the traced run. */
  const sayStep = (kit, k) => {
    const [ln, ev, pieces, pair] = TRACE[k];
    const prev = k > 0 ? TRACE[k - 1][2] : null;
    const rule = pair ? MERGES.findIndex(m => m.join() === pair.join()) + 1 : 0;
    if (ev === "r") return `<code>split_word</code> returns ${plural(pieces.length, "piece")}: ${kit.esc(bar(pieces))}. The same split you marked by hand.`;
    if (ln === 1) return `<code>split_word</code> gets the word and the ${BY_HAND} rules as a list of pairs, in the order they were learned.`;
    if (ln === 2 && !pair) return `<code>list(word)</code> turns the string into a list of its letters, like <code>[...word]</code> in JavaScript: ${plural(pieces.length, "piece")}.`;
    if (ln === 3) return `Rule ${rule}: <code>merge_pair</code> will glue every ${kit.esc(pair[0])} that stands right before ${kit.esc(pair[1])}.`;
    if (ln === 2) return `After rule ${rule}: ${plural(pieces.length, "piece")}${prev && prev.length === pieces.length ? ", no change" : ` (${prev.length - pieces.length} fewer)`}. Back to the top of the loop for the next rule.`;
    if (ln === 4) return `No rules left. The loop is over.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const [ln, , pieces, pair] = TRACE[i];
      el.innerHTML = `<h1>The same split in Python</h1>
        <p class="lead">This is <code>split_word</code> from our from-scratch script. <code>merge_pair</code> is the move you did by hand: it walks the pieces left to right and glues each matching neighbour pair. The steps below replay the real run on <b>${NEW_WORD}</b>.</p>
        <p class="task">Step through to the end and compare each step with your own split.</p>
        ${kit.code(SPLIT_CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>pair <b>${pair ? kit.esc(pairTxt(pair)) : "–"}</b></span><span>pieces <b>${pieces ? pieces.length : "–"}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${pieces ? `<div class="lx-${ID}-row">${pieceRow(kit, pieces, pair && TRACE[i][0] === 2 ? pair.join("") : null)}</div>` : ""}
        ${kit.feedback(sayStep(kit, i))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 7. Learning the rules in Python, and a prediction for round 6. */
  function learnCode({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const r = BY_HAND, sp = splitsAfter(r);
    const top = ROUNDS[r].map(([a, b]) => [a, b]);
    const opts = [top[1], top[0], top[2], top[3]];
    const RIGHT = 1;
    const line = p => `(${p.map(x => `'${x}'`).join(", ")}) ${pairCount(sp, p[0], p[1])}`;
    const best = top[0];
    const tied = top.slice(1).filter(p => pairCount(sp, p[0], p[1]) === pairCount(sp, top[1][0], top[1][1]));
    const fbWrong = p => [`${kit.esc(pairTxt(p))} sits side by side ${pairCount(sp, p[0], p[1])} times: ${breakdown(sp, p[0], p[1]).join(", ")}. Look at the words after rule ${r}: ${kit.esc(pairTxt(best))} sits in ${breakdown(sp, best[0], best[1]).join(", ")}.`, false];
    const fb = [fbWrong(opts[0]), [`Right: <code>${kit.esc(PRINTED[r])}</code>, the run's sixth printed line. r + e sits at the end of <i>departure</i> and twice in <i>redeparture</i>. With six rules, <code>split_word("${NEW_WORD}", merges)</code> returned <b>${kit.esc(bar(SPLIT6))}</b> in the same run: one token fewer.<br><br>Notice ${tied.map(p => kit.esc(pairTxt(p))).join(", ")}: all ${pairCount(sp, tied[0][0], tied[0][1])}, a tie. If a tie were at the top, <code>max</code> would pick the first of those pairs it met. Real libraries may break ties another way, so two tools can learn slightly different rules from the same text.`, true], fbWrong(opts[2]), fbWrong(opts[3])];
    const paint = () => {
      el.innerHTML = `<h1>Learning the rules in Python</h1>
        <p class="lead">This function learned the rules you found by hand. <code>words</code> maps each word to its ×count. <code>Counter()</code> is a dict whose missing keys count as 0. <code>zip(pieces, pieces[1:])</code> gives every neighbour pair of a word. <code>max(counts, key=counts.get)</code> picks the pair with the highest count. The run asked for 6 rounds and printed:</p>
        ${kit.code(LEARN_CODE, ans === RIGHT ? 10 : 9)}
        <div class="lx-${ID}-out">${kit.esc(PRINTED.slice(0, r).join("\n"))}${ans === RIGHT ? "\n" + kit.esc(PRINTED[r]) : "\n…"}</div>
        <p class="lx-${ID}-cap">Output of bpe_from_scratch.py, run on our machine</p>
        <p class="task">The first ${r} lines are your rules. What did round ${r + 1} print?</p>
        <div class="lpanel">${ask(kit, opts.map(p => `<span class="lx-${ID}-opt">${kit.esc(line(p).replace(/ \d+$/, ""))}</span>`), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const tokensAt = k => sum(WORDS.map(w => splitWord(w, k).length * WORD_COUNTS[w]));
    const asLetters = tokensAt(0), asFive = tokensAt(BY_HAND);
    const vocab5 = LETTERS.length + BY_HAND;
    const opts = [
      "The vocabulary gets longer",
      "Each notice becomes more tokens, so the model has more to read for every notice",
      "Some words become unknown"
    ];
    const RIGHT = 1;
    const fb = [
      [`The opposite. Each rule adds one token to the vocabulary: ${LETTERS.length} letters + ${BY_HAND} rules = ${vocab5} tokens. Stopping early keeps the vocabulary short.`, false],
      [`Right. Look at the board: ${asLetters} tokens as single letters, ${asFive} after ${BY_HAND} rules, and ${N_WORDS} if every word were one token. Fewer rules means more tokens per text, and a model works through every token. More rules means fewer tokens per text but a longer vocabulary. Picking the number of merges, or the vocabulary size, is that trade-off.`, true],
      [`No. Any word still falls back to single letters, as ${NEW_WORD} did. (Here a letter that never appeared in the notices would be unknown; real tokenizers such as GPT-2's start from bytes, so even that cannot happen.)`, false],
    ];
    const paint = () => {
      el.innerHTML = `<h1>When you meet BPE</h1>
        <p class="lead">A <b>tokenizer</b> is the tool that turns text into tokens: here, your vocabulary plus your rules.</p>
        <p class="lead"><b>What for:</b> turning any text into tokens from a fixed vocabulary. Common words become one token, rare and new words become several, and nothing is lost. Many language models (GPT-2, RoBERTa, BART among them) use BPE. <b>When:</b> with a trained model, always use the tokenizer that came with it, because the model learned its own tokens. You learn new rules only when you train a model from scratch. <b>When not:</b> never swap a trained model's tokenizer. A small fixed set of words needs only a plain word list. <b>Costs:</b> learning the rules once from a large text, and the trade-off below.</p>
        ${kit.meter([
          { label: "single letters", value: asLetters, max: asLetters },
          { label: `after ${BY_HAND} rules`, value: asFive, max: asLetters },
          { label: "whole words", value: N_WORDS, max: asLetters }
        ])}
        <p class="lx-${ID}-cap">Tokens needed for all ${N_WORDS} words on the board, computed from the run's rules</p>
        <p class="task">You stop learning rules early, after only a few merges. Which cost goes up?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where BPE is the wrong move. */
  const CASES = [
    ["A shop trains its own search model from scratch. It meets new product names every week (“AquaGrip”, “AquaGrips”) and must not turn them into one “unknown” marker.", true,
      "Yes. The shop trains the model itself, so it picks the tokenizer. A BPE vocabulary splits a name it never saw into pieces it knows, the way redeparting became depart plus letters. Nothing is replaced by “unknown”.",
      "A word list would map every new name to “unknown”. BPE falls back to known pieces and, at worst, to single letters, so new names keep their spelling."],
    ["Your team uses a pretrained model, and it splits your company's product names into many tokens. A teammate wants to train a fresh BPE vocabulary on your documents and plug it into that model.", false,
      "No. The model learned the meaning of its own tokens during pretraining. A new vocabulary gives it token numbers that point at different pieces, so its input no longer means what it learned. Keep the tokenizer the model was trained with, or choose a different model whose tokenizer suits your text.",
      "Fewer tokens would be nice, but the model only understands the tokens it was pretrained with. Swapping the vocabulary breaks that match. The tokenizer stays with its model; to change it you choose a different model."],
    ["A ticket kiosk understands exactly 30 fixed commands picked from a menu. No other words ever appear.", false,
      "No. Nothing new can arrive, so the list never swells and no word is ever unknown. A plain table of 30 words does the job; learning merges adds work and nothing else.",
      "BPE pays off when new or rare words appear. Here the 30 words are fixed and known in advance, so a lookup table of whole words is enough."],
    ["You train a small translation model from scratch on ferry timetables in two languages, full of place names and long compound words that show up in new forms.", true,
      "Yes. You are training from scratch, so you choose the tokenizer. BPE learned on your timetables gives frequent words one token and still covers rare names and new compounds with pieces. That is the use the method was brought in for.",
      "New place names and new compounds are exactly what a word list loses. Because you train the model yourself, you can learn a BPE vocabulary on your own text first."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>BPE or not?</h1>
        <p class="lead">Four situations from other jobs.</p>
        <p class="task">Is learning a BPE vocabulary the right move in each one? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You built a vocabulary by hand</h1>
      <p class="lead">You merged the most frequent pair ${BY_HAND} times, saw that a piece many words share wins over any single word, split a word you never saw with the rules in order, and stepped through the same thing in Python.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the pair counting and the merge loop yourself and learn rules from a short list of notices.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You now know how a vocabulary of pieces is built; next you look at a real tokenizer and see why the same sentence costs more tokens in some languages.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Tokens and byte-pair encoding by hand",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/1508.07909",
      "https://huggingface.co/learn/llm-course/chapter6/5",
      "https://huggingface.co/learn/llm-course/chapter2/4",
      "https://docs.python.org/3/library/collections.html#collections.Counter",
      "https://docs.python.org/3/library/functions.html#max"
    ],
    interview: [
      {
        q: "A user types a brand-new product name into your app. Walk me through what a BPE tokenizer does with it, and what you trade when you choose a larger vocabulary.",
        good: [
          "It starts from the name's characters (or bytes) and applies the learned merges in the order they were learned",
          "The name ends up as several known tokens, so nothing becomes an unknown marker",
          "Common words are one token, rare and new words are several",
          "A larger vocabulary means fewer tokens per text but more tokens for the model to learn",
          "The merges were learned by repeatedly merging the most frequent neighbour pair in the training text"
        ],
        weak: "Say it maps the name to an unknown token, or that it splits words into syllables by grammar rules. BPE knows no grammar; it only replays merges learned from counts."
      },
      {
        q: "A teammate wants to retrain the tokenizer of the pretrained model you use, on your company's documents, to save tokens. What do you tell them?",
        good: [
          "The model learned its own tokens during pretraining; a new vocabulary no longer matches what it learned",
          "Keep the tokenizer that came with the model",
          "Measure tokens per document first, to see whether the cost really matters",
          "If the tokenizer fits the text badly, compare other models whose tokenizers suit it better"
        ],
        weak: "Agree because domain pieces mean fewer tokens, without noticing that the model only understands the tokens it was trained with."
      }
    ],
    screens: [situation, firstMerge, moreMerges, spotIdea, predictSplit, asCode, learnCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(4).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-check]"], right: [...RIGHT_CUT_IDX.map(i => `[data-i="${i}"]`), "[data-check]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
