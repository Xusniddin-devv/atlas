/* Lesson: two pointers. A gift card and a sorted sale shelf (two ends squeezing toward a pair), then a shelf
   with gaps (a reader and a writer). Every number on screen is computed here from PRICES, CARD and SHELF.
   Plain browser script. */
(() => {
  const PRICES = [2, 6, 10, 13, 16, 19, 21, 22], CARD = 26, N = PRICES.length;
  const PAIRS = N * (N - 1) / 2;
  const fmt = n => n.toLocaleString("en");
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const L = "<code>l</code>", R = "<code>r</code>", W = "<code>w</code>";
  // the pair the card fits (the data has exactly one)
  const FIT = (() => { for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (PRICES[i] + PRICES[j] === CARD) return [i, j]; return null; })();
  // the squeeze, move by move: { l, r, sum, move: "l" | "r" | "stop" }
  const SQUEEZE = (() => {
    const out = []; let l = 0, r = N - 1;
    while (l < r) {
      const sum = PRICES[l] + PRICES[r];
      out.push({ l, r, sum, move: sum === CARD ? "stop" : sum < CARD ? "l" : "r" });
      if (sum === CARD) break;
      if (sum < CARD) l++; else r--;
    }
    return out;
  })();
  const ptrs = (l, r) => l === r ? { [l]: "l r" } : { [l]: "l", [r]: "r" };
  // books already dropped (outside l..r) are faint and struck out; the two ends are dark; a found pair is green.
  // A lesson marks the one book dropped in the current step "leave" (red) itself.
  const squeezeCls = (l, r, found) => {
    const c = {};
    for (let i = 0; i < N; i++) if (i < l || i > r) c[i] = "gone";
    c[l] = c[r] = found ? "enter" : "in";
    return c;
  };

  /* 1. The slow way: try each book with every other book. */
  function slowWay({ el, done, kit }) {
    const checked = new Set(), tried = new Set();
    let cur = null, last = [], again = false, found = false;
    const key = (i, j) => i < j ? `${i},${j}` : `${j},${i}`;
    const paint = () => {
      const cls = {};
      if (cur != null) cls[cur] = "in";
      if (found) { cls[FIT[0]] = cls[FIT[1]] = "enter"; }
      el.innerHTML = `<h1>A gift card that gives no change</h1>
        <p class="lead">Your gift card is worth exactly <b>${CARD}</b>, and the shop keeps whatever you do not spend. On the sale shelf, the books stand from cheapest to most expensive. Each bar is one book, and the number on it is its price. Adding two prices and comparing with the card counts as one check.</p>
        <p class="task">Tap a book to try it with every other book. Keep going until two books cost exactly ${CARD} together.</p>
        ${kit.bars(PRICES, { cls, pick: !found })}
        <div class="lpanel">
          ${cur == null ? "" : `<div class="sum">${checked.size} of ${PAIRS}<small>pairs checked so far, each pair once</small></div>`}
          ${last.length ? `<div class="tried">${last.map(([j, s]) => `<span class="${s === CARD ? "top1" : ""}">${PRICES[cur]} + ${PRICES[j]} <b>${s}</b></span>`).join("")}</div>` : ""}
          ${found ? kit.feedback(`Found it: <b>${PRICES[FIT[0]]} + ${PRICES[FIT[1]]} = ${CARD}</b>, after ${checked.size} checks.${checked.size < PAIRS ? " You could have been unluckier." : ""} ${N} books make ${PAIRS} different pairs, and the one that fits could be the last you try. A shelf of 1,000 books has ${fmt(1000 * 999 / 2)} pairs.`, true)
            : again ? kit.feedback(`You already tried ${PRICES[cur]} with every other book. Pick a book you have not tried yet.`)
            : cur != null ? kit.feedback(`Nothing on the shelf adds up to ${CARD} with the ${PRICES[cur]}. ${fmt(PAIRS - checked.size)} pairs are still unchecked.`) : ""}
        </div>`;
      el.querySelectorAll(".col").forEach(c => c.onclick = () => {
        if (found) return;
        const i = +c.dataset.i;
        cur = i; again = tried.has(i); last = [];
        tried.add(i);
        for (let j = 0; j < N; j++) {
          if (j === i || checked.has(key(i, j))) continue;
          checked.add(key(i, j)); last.push([j, PRICES[i] + PRICES[j]]);
        }
        if (last.some(([, s]) => s === CARD)) found = true;
        paint();
        if (found) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: one finger on each end of the sorted shelf. */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const s0 = SQUEEZE[0].sum, up = s0 < CARD, gap = Math.abs(CARD - s0);
    const opts = [`Move ${L}: swap the ${PRICES[0]} for the ${PRICES[1]}`, `Move ${R}: swap the ${PRICES[N - 1]} for the ${PRICES[N - 2]}`, "Neither: I still have to try every pair"];
    const correct = up ? 0 : 1;
    const paint = () => {
      const ok = ans === correct, l = ok && up ? 1 : 0, r = ok && !up ? N - 2 : N - 1, cls = squeezeCls(l, r, false);
      if (ok) cls[up ? 0 : N - 1] = "leave";
      el.innerHTML = `<h1>Start at both ends</h1>
        <p class="lead">A plan. Put one finger on the cheapest book and one on the most expensive. A finger that marks a position in a list is called a pointer, so this technique is called two pointers. In code they are ${L} (left) and ${R} (right). The frame holds the books still in play. Together the two cost <b>${s0}</b>, and the card is ${CARD}.</p>
        <p class="task">You may move one finger one book inward. Which move can still reach ${CARD}?</p>
        ${kit.bars(PRICES, { cls, frames: [[l, r - l + 1]], ptrs: ptrs(l, r) })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The shelf is sorted, so moving ${L} right can only make the total bigger, and moving ${R} left can only make it smaller. You know which way the total goes before you look. And the ${up ? PRICES[0] : PRICES[N - 1]} is now out for good: ${up ? `its most expensive possible partner is the ${PRICES[N - 1]}, and even that totals ${s0}, ${gap} short of ${CARD}` : `its cheapest possible partner is the ${PRICES[0]}, and even that totals ${s0}, ${gap} over ${CARD}`}. One check ruled out all ${N - 1} pairs that use it.`, true)
          : ans === 2 ? kit.feedback(`One move can still reach ${CARD}. The shelf is sorted, so the next book up always costs more and the next book down always costs less. You can tell which way the total will go without trying any pair.`, false)
          : kit.feedback(up ? `The ${PRICES[N - 2]} is cheaper than the ${PRICES[N - 1]}, so the total drops to ${PRICES[0] + PRICES[N - 2]}. You were already ${gap} short.` : `The ${PRICES[1]} costs more than the ${PRICES[0]}, so the total rises to ${PRICES[1] + PRICES[N - 1]}. You were already ${gap} over.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Squeeze it yourself, predicting which finger moves; then feel the saving at real sizes. */
  function squeezeIt({ el, done, kit }) {
    let k = 0, wrong = null, said = null, n = 1000;
    const opts = [`Move ${L} one book right`, `Move ${R} one book left`, "Stop: these two fit"];
    const pick = { l: 0, r: 1, stop: 2 };
    const paint = () => {
      const st = SQUEEZE[k], fin = said && said.fin, correct = pick[st.move];
      const cls = squeezeCls(st.l, st.r, fin);
      if (!fin && k > 0) { const p = SQUEEZE[k - 1]; cls[p.move === "l" ? p.l : p.r] = "leave"; }
      const a = PRICES[st.l], b = PRICES[st.r];
      el.innerHTML = `<h1>Squeeze toward the pair</h1>
        <p class="lead">Same shelf, same card: <b>${CARD}</b>. Crossed-out books can never be part of the answer.</p>
        ${fin ? "" : `<p class="task">${a} + ${b} = ${st.sum}. Which finger moves?</p>`}
        ${kit.bars(PRICES, { cls, frames: [[st.l, st.r - st.l + 1]], ptrs: ptrs(st.l, st.r) })}
        <div class="lpanel">${fin ? "" : kit.options(opts, { picked: wrong, correct })}
        ${wrong != null ? kit.feedback(
            wrong === 2 ? `${a} + ${b} is ${st.sum}, not ${CARD}. ${st.sum < CARD ? `The shop would keep the ${CARD - st.sum} you did not spend.` : `That is ${st.sum - CARD} more than the card holds.`}`
            : st.move === "stop" ? `${a} + ${b} is exactly ${CARD}. That is the pair. Moving either finger would lose it.`
            : wrong === 0 ? `${st.sum} is already over ${CARD}. Moving ${L} right picks a more expensive book, so the total only goes up. Move ${R} to a cheaper book.`
            : `${st.sum} is under ${CARD}. Moving ${R} left picks a cheaper book, so the total only goes down. Move ${L} to a more expensive book.`, false)
          : said ? kit.feedback(said.html, said.fin ? true : undefined) : ""}
        ${kit.meter([{ label: "Every pair, at worst", value: PAIRS, max: PAIRS }, { label: "Squeeze", value: k + 1, max: PAIRS, good: true }])}
        ${fin ? `<div class="sliders"><label>Books on the shelf <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => {
        const v = +bt.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (st.move === "stop") {
          said = { fin: true, html: `Found it in <b>${k + 1} checks</b>: ${a} + ${b} = ${CARD}, the same pair as before. Each check crossed out one book for good, so on any shelf of ${N} books the squeeze needs at most ${N - 1} checks. Trying every pair can take ${PAIRS}. Now make the shelf bigger:` };
          paint(); done(); return;
        }
        said = { html: st.move === "l" ? `The ${a} is out: even with the most expensive book left, the ${b}, it is short.` : `The ${b} is out: even with the cheapest book left, the ${a}, it costs too much.` };
        k++; paint();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const all = n * (n - 1) / 2, sq = n - 1;
        el.querySelector("#big").innerHTML = `${fmt(all)} vs ${fmt(sq)}<small>checks at worst when trying every pair, against squeezing. That is ${fmt(Math.round(all / sq))} times fewer checks, and the gap grows with the shelf.</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code, stepped against the same shelf. */
  const CODE1 = [
    "let l = 0, r = prices.length - 1;",
    "while (l < r) {",
    "  const sum = prices[l] + prices[r];",
    "  if (sum === card) return [l, r];",
    "  if (sum < card) l++;",
    "  else r--;",
    "}",
    "return null; // no two books fit"
  ];
  const FR1 = (() => {
    const fr = [{ ln: 0, l: 0, r: N - 1, sum: "–", say: `${L} and ${R} hold positions, counted from 0, shown under the books. ${L} starts at 0, the cheapest book. ${R} starts at ${N - 1}, the most expensive.` }];
    let prev = "–";
    SQUEEZE.forEach(({ l, r, sum, move }) => {
      fr.push({ ln: 1, l, r, sum: prev, say: `${l} < ${r}: at least two books are still in play, so the loop runs.` });
      fr.push({ ln: 2, l, r, sum, say: `${PRICES[l]} + ${PRICES[r]} = ${sum}.` });
      if (move === "stop") { fr.push({ ln: 3, l, r, sum, found: true, say: `${sum} === ${CARD} is true. Return positions ${l} and ${r}: the ${PRICES[l]} and the ${PRICES[r]}, the pair you squeezed to by hand.` }); return; }
      fr.push({ ln: 3, l, r, sum, say: `${sum} === ${CARD} is false, so no return. Not the pair yet.` });
      if (move === "l") fr.push({ ln: 4, l: l + 1, r, sum, gone: l, say: `${sum} < ${CARD} is true, so ${L} moves right. The ${PRICES[l]} is out.` });
      else fr.push({ ln: 5, l, r: r - 1, sum, gone: r, say: `${sum} < ${CARD} is false, so the <code>else</code> runs and ${R} moves left. The ${PRICES[r]} is out.` });
      prev = sum;
    });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = squeezeCls(f.l, f.r, f.found);
      if (f.gone != null) cls[f.gone] = "leave";
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">Nothing new here. <code>prices</code> is the shelf and <code>card</code> is ${CARD}. Each line is a move you made by hand.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the shelf.</p>
        ${kit.bars(PRICES, { cls, frames: [[f.l, f.r - f.l + 1]], labels: PRICES.map((_, j) => j), ptrs: ptrs(f.l, f.r) })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>l <b>${f.l}</b></span><span>r <b>${f.r}</b></span><span>sum <b>${f.sum}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 5. A second idea: a reader and a writer close the gaps on a shelf, by hand. */
  const SHELF = ["A", null, "B", null, null, "C", null, "D"], NS = SHELF.length;
  const BOOKS = SHELF.filter(b => b !== null).length, GAPS = NS - BOOKS;
  const shown = s => s.map(b => b === null ? "" : b);
  const rwPtrs = (w, r) => r >= NS ? { [w]: "w" } : w === r ? { [w]: "w r" } : { [w]: "w", [r]: "r" };
  const rwCls = (s, w, r) => {
    const c = {};
    s.forEach((b, i) => { c[i] = i < w ? "in" : i === r ? "next" : b === null ? "gone" : ""; });
    return c;
  };
  const nextBook = (s, from) => { for (let i = from; i < NS; i++) if (s[i] !== null) return s[i]; return null; };
  function readerWriter({ el, done, kit }) {
    const s = SHELF.slice();
    let r = 0, w = 0, wrong = null, said = null;
    const paint = () => {
      const fin = r === NS, book = fin ? null : s[r], correct = book !== null ? 0 : 1;
      const cls = fin ? Object.fromEntries(s.map((b, i) => [i, i < w ? "in" : "gone"])) : rwCls(s, w, r);
      el.innerHTML = `<h1>Close the gaps, keep the order</h1>
        <p class="lead">A new idea, same shop. Books sold off another shelf left gaps. You want the books packed to the left, still in the same order, and you have no second shelf. Two fingers again, but both start on the left. ${R} now stands for reader: it reads every slot. ${W}, the writer, marks where the next book belongs. To move a book, swap it with whatever sits in slot ${W}, usually a gap.</p>
        ${fin ? "" : `<p class="task">${R} is on slot ${r}: ${book === null ? "a gap" : `book ${book}`}. Swap it into slot ${w}, or skip it?</p>`}
        ${kit.cells(shown(s), { cls, labels: s.map((_, i) => i), ptrs: rwPtrs(w, r) })}
        <div class="lpanel">${fin ? "" : kit.options([`Swap it into slot ${w}`, "Skip it"], { picked: wrong, correct })}
        ${wrong != null ? kit.feedback(book !== null
            ? (() => { const nb = nextBook(s, r + 1); return `${book} is a book, not a gap. Skip it and ${W} stays on slot ${w}, so ${nb ? `the next book, ${nb}, gets swapped in ahead of ${book} and the order breaks` : `${book} is left behind after the gaps`}.`; })()
            : `Slot ${r} is a gap. Swap it in and ${W} moves past it, so a gap ends up among the packed books. Only books go to ${W}.`, false)
          : fin ? kit.feedback(`Done. The ${BOOKS} books sit in slots 0 to ${BOOKS - 1}, in their old order, and the ${GAPS} gaps are at the end. ${R} read each of the ${NS} slots once and you made ${BOOKS} swaps, one per book. No second shelf.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => {
        const v = +bt.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (book !== null) {
          said = w === r ? `${book} is already in slot ${w}, so the swap leaves it there. ${W} moves on to slot ${w + 1}.` : `${book} goes to slot ${w} and the gap goes to slot ${r}. ${W} moves on to slot ${w + 1}.`;
          [s[w], s[r]] = [s[r], s[w]]; w++;
        } else said = `A gap. Only ${R} moves on. ${W} stays on slot ${w}, waiting for the next book.`;
        r++;
        paint();
        if (r === NS) done();
      });
    };
    paint();
  }

  /* 6. The reader and writer as code. */
  const CODE2 = [
    "let w = 0;",
    "for (let r = 0; r < row.length; r++) {",
    "  if (row[r] === null) continue;",
    "  [row[w], row[r]] = [row[r], row[w]];",
    "  w++;",
    "}",
    "// the books are now row[0] to row[w - 1]"
  ];
  const FR2 = (() => {
    const s = SHELF.slice(), fr = [{ ln: 0, s: s.slice(), w: 0, r: 0, say: `${W} starts on slot 0. A gap is <code>null</code> in code.` }];
    let w = 0;
    for (let r = 0; r < NS; r++) {
      if (s[r] === null) { fr.push({ ln: 2, s: s.slice(), w, r, say: `r = ${r}. Slot ${r} is a gap, so <code>continue</code> skips it. Only ${R} moves.` }); continue; }
      const b = s[r];
      [s[w], s[r]] = [s[r], s[w]];
      fr.push({ ln: 3, s: s.slice(), w, r, say: w === r ? `r = ${r}. Book ${b} swaps with itself: it is already in slot ${w}.` : `r = ${r}. Book ${b} swaps into slot ${w}, and the gap goes to slot ${r}.` });
      w++;
      fr.push({ ln: 4, s: s.slice(), w, r, say: `${W} moves to slot ${w}. ${W} never passes ${R}. So a swap never moves a book ${R} has not read yet.` });
    }
    fr.push({ ln: 6, s: s.slice(), w, r: NS, fin: true, say: `The loop ends with w = ${w}: ${w} books, in slots 0 to ${w - 1}, in the order you packed them by hand. One pass over ${NS} slots.` });
    return fr;
  })();
  function rwCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR2[i];
      const cls = f.fin ? Object.fromEntries(f.s.map((b, j) => [j, j < f.w ? "in" : "gone"])) : rwCls(f.s, f.w, f.r);
      el.innerHTML = `<h1>Reader and writer, as code</h1>
        <p class="lead"><code>row</code> is the shelf. ${R} reads every slot. ${W} only moves when a book is written. The fast reader and the slow writer are both pointers into the same array.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the shelf.</p>
        ${kit.cells(shown(f.s), { cls, labels: f.s.map((_, j) => j), ptrs: rwPtrs(f.w, f.r) })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>w <b>${f.w}</b></span><span>r <b>${f.fin ? "done" : f.r}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 7. Recognise it in new situations. */
  const CASES = [
    ["A sign-up form checks that a short code reads the same forwards and backwards, like 4KK4.", true,
      "Yes. One finger on each end: compare the two characters, and if they match, both step inward. The data does not need to be sorted, because you only check that the ends match.",
      "This one works without sorted data. Compare the first and last characters; if they match, both fingers step inward until they meet. That is two ends walking toward each other."],
    ["Payments arrive one at a time, in no order. The moment any two payments so far add up to exactly 100, raise an alert.", false,
      "No. The squeeze needs the whole list, sorted, with a right end to start from. Here the list keeps growing, so you would sort and squeeze all over again after every payment. Keep a set of the amounts seen so far: each new payment asks once whether 100 minus it is in the set.",
      "The squeeze needs the whole list, sorted, with a right end to start from. Payments keep arriving, so there is no right end yet. Sorting a copy and squeezing works once, but you would have to redo it after every payment. A set of the amounts seen so far answers each new payment in one step: is 100 minus it in the set?"],
    ["A sorted list of user ids has repeats. Keep one of each, in the same order, without making a new list.", true,
      "Yes, a reader and a writer. The reader goes over every id. The writer writes an id only when it differs from the last one written, so the keepers pack to the front in order.",
      "You can do it in place. A reader goes over every id, and a writer writes an id only when it differs from the last one written. The keepers pack to the front in order, like the books."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would two pointers work here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the bookshop. Sorting is what made the gift-card squeeze safe. Some two-end walks do not need it.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 8. On to the problems: the groups this lesson taught first. */
  const TAUGHT = {
    "swap-from-both-ends": "Like the 4KK4 check: both ends step inward together. No sorting needed.",
    "reader-and-writer": "You did this with the gaps on the shelf: one finger reads, one writes the keepers.",
    "squeeze-a-sorted-pair": "You did this with the gift card: drop whichever end can no longer fit."
  };
  function toProblems({ el, done, kit, topic }) {
    // the kit numbers each group by its place on the topic page; listed taught-first they read like a ranking, so hide them here
    if (!document.getElementById("lx-two-pointers")) { const st = document.createElement("style"); st.id = "lx-two-pointers"; st.textContent = ".lx-two-pointers-list ul.lnext li { grid-template-columns: minmax(0, 1fr) auto; } .lx-two-pointers-list ul.lnext .n { display: none; } .lx-two-pointers-list ul.lnext .a { grid-column: 1 / 3; }"; document.head.appendChild(st); }
    // the one-sentence summary goes between the kit's lead (which names the next problem) and the group list
    const sum = `<p class="lead">Two pointers: two positions move through one list, and each step settles something for good. Use it to find a pair in a sorted list, to compare the two ends, or to pack items in place. Not when the data keeps arriving, or to find a pair in unsorted data.</p>`;
    const list = kit.practice(topic || { problems: [], subs: [] }, TAUGHT), at = list.indexOf('<ul class="lnext"');
    el.innerHTML = `<h1>You have the idea. Now use it.</h1><div class="lx-two-pointers-list">${at < 0 ? list + sum : list.slice(0, at) + sum + list.slice(at)}</div>`;
    done();
  }

  LessonKit.define("two-pointers", {
    title: "Two pointers",
    teaches: ["squeeze-a-sorted-pair", "reader-and-writer"],
    screens: [slowWay, spotTrick, squeezeIt, asCode, readerWriter, rwCode, recognise, toProblems],
    walk: [
      { right: Array.from({ length: FIT[0] + 1 }, (_, i) => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(SQUEEZE.length).fill("[data-right]") },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: Array(NS).fill("[data-right]") },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
