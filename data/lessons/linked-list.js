/* Lesson: linked list. A birthday scavenger hunt: each clue card names the spot of the next card. First the hunt
   in the flat is turned around for a second team (rewire each card on the spot, noting the next spot before you
   write over it). Then the garden hunt: a slow and a fast walker find its middle, and later find that a changed card
   makes it loop. Every number on screen is computed here from HUNT, GARDEN and LOOP_TO. Plain browser script. */
(() => {
  // same escaping as kit.esc; names go into HTML text through H and G, raw names only into picture helpers
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const HUNT = ["Door", "Mat", "Sofa", "Oven", "Bath", "Bed"], N = HUNT.length, H = HUNT.map(esc);
  const SLOW = N * (N - 1) / 2;                 // reads when every new card means walking from the door again
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const END = "&ldquo;the end&rdquo;";
  const C = s => `<code>${s}</code>`;
  const and = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const say = i => i < 0 ? END : H[i];      // what a rewritten card at i + 1 says: the spot before it
  // the arrows after d cards have been rewritten (cards 0..d-1 point backwards): the arrow between j and j + 1
  // is drawn reversed once card j + 1 points back at j; card d - 1 no longer points forward, card d not yet back
  const revLinks = d => {
    const lk = {};
    for (let j = 0; j < d - 1; j++) lk[j] = "rev";
    if (d >= 1) lk[d - 1] = "gone";
    return lk;
  };
  const ptrMap = pairs => {
    const m = {};
    pairs.forEach(([i, name]) => { if (i == null || i < 0) return; m[i] = m[i] ? `${m[i]} ${name}` : name; });
    return m;
  };

  /* 1. The slow way: for each card, walk from the door to find the card that points to it. */
  function slowWay({ el, done, kit }) {
    const found = new Map();
    let cur = null, again = false, steps = 0;
    const paint = () => {
      const all = found.size === N - 1, cls = {};
      if (cur != null) {
        if (cur === 0) cls[0] = "next";
        else { for (let j = 0; j < cur - 1; j++) cls[j] = "in"; cls[cur - 1] = "enter"; cls[cur] = "next"; }
      }
      const left = N - 1 - found.size;
      el.innerHTML = `<h1>A birthday hunt that has to run backwards</h1>
        <p class="lead">For a birthday you hid clue cards around the flat. Each card names the spot of the next card, and the hunt starts at the ${H[0]}. A second team arrives later and must run it backwards, starting at the ${H[N - 1]}. A card only knows the spot after it. In code this chain is a <b>linked list</b>: each card is a <b>node</b>, and the spot written on it is its <b>next</b> link. You write each new card on a fresh card and keep it in your pocket. You swap them in only at the end, because until then you still need the old cards to find your way. Reading one card counts as one step.</p>
        <p class="task">Tap a card to find which card points to it (names its spot). Do it for every card that needs a new one.</p>
        ${kit.pics.list(HUNT, { cls, pick: !all, nullEnd: true, title: "the hunt, as hidden (null = the end)" })}
        ${cur > 0 ? kit.pics.key([["next", "the card you tapped"], ["enter", "the card that points to it"], ["in", "cards you read on the way"]]) : ""}
        <div class="lpanel">
          ${cur == null ? "" : `<div class="sum">${steps} steps<small>cards read so far</small></div>`}
          ${found.size ? `<div class="tried">${[...found].sort((a, b) => a[0] - b[0]).map(([i, s]) => `<span>new ${H[i]} card says ${H[i - 1]} <b>${s}</b></span>`).join("")}</div>` : ""}
          ${all ? kit.feedback(`Every new card is written: <b>${SLOW} steps</b> for ${N} cards, because each card sent you back to the ${H[0]} to walk again. A hunt of 1,000 cards would take ${fmt(1000 * 999 / 2)} steps, and a pocket of 1,000 fresh cards.`, true)
            : cur === 0 ? kit.feedback(`Nothing points to the ${H[0]}: the hunt starts there. In the backwards hunt it is the last card, and its new card simply says ${END}. No walking needed. ${plural(left, "card")} still to go.`)
            : again ? kit.feedback(`You already know the ${H[cur - 1]} card points to the ${H[cur]}. Pick a card you have not done yet.`)
            : cur != null ? kit.feedback(`Who says ${H[cur]}? You read ${and(H.slice(0, cur))}: the ${H[cur - 1]} card does, so the new ${H[cur]} card says ${H[cur - 1]}. That took ${plural(cur, "step")}, from the ${H[0]} again. ${plural(left, "card")} still to go.`) : ""}
        </div>`;
      el.querySelectorAll(".lp-list [data-i]").forEach(b => b.onclick = () => {
        if (found.size === N - 1) return;
        const i = +b.dataset.i;
        cur = i; again = found.has(i);
        if (i > 0 && !again) { steps += i; found.set(i, i); }
        paint();
        if (found.size === N - 1) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: rewrite on the spot, but note the next spot before you write over it. */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const lost = H.slice(2);
    const opts = [
      `Cross out ${H[2]}, write ${H[0]}, then walk where the card says`,
      `Walk back to the ${H[0]} to check which card points to the ${H[1]}`,
      `Note ${H[2]} in your head, write ${H[0]}, then walk to ${H[2]}`
    ];
    const paint = () => {
      const RIGHT = 2, ok = ans === RIGHT, d = ok ? 2 : 1;
      el.innerHTML = `<h1>Rewrite each card where it hangs</h1>
        <p class="lead">A plan with no fresh cards: one walk from the ${H[0]}, rewriting each card where you find it. The ${H[0]} card now says ${END}, and you walked on to the ${H[1]}, as it used to say. The ${H[1]} card says <b>${H[2]}</b>. In the backwards hunt it must say <b>${H[0]}</b>.</p>
        <p class="task">Standing at the ${H[1]} card, what do you do?</p>
        ${kit.pics.list(HUNT, { cls: { [d]: "in" }, links: revLinks(d), nullEnd: true, ptrs: { [d - 1]: "from", [d]: "here" }, title: `${HUNT[0]} now says the end: its arrow is gone` })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. You only ever keep track of three spots: where you came from (${H[0]}, to write on the card), the card in your hand (${H[1]}), and where it said to go (${H[2]}, so you can go on). Read the next spot before you write over it, and nothing is lost. No fresh cards, and no walking back.`, true)
          : ans === 0 ? kit.feedback(`The card now says ${H[0]}, so you walk back to the ${H[0]}, which says ${END}. Nothing tells you where the ${H[2]} card is any more: ${and(lost)} are cut off from the hunt.`, false)
          : kit.feedback(`You just came from the ${H[0]}, so you already know it points here. Walking back to check is the slow way from the last screen, one walk per card.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Turn the whole hunt around yourself, predicting each move. */
  function reverseIt({ el, done, kit }) {
    let k = 0, wrong = null, said = null, fin = false, n = 1000;
    const paint = () => {
      const prev = say(k - 1), nxt = k < N - 1 ? H[k + 1] : null, cur = H[k];
      const text = {
        R: nxt ? `Note ${nxt}, write ${prev}, walk to ${nxt}` : `Write ${prev}, then stop: the card said ${END}`,
        W1: `Write ${prev}, then walk where the card says`,
        W2: nxt ? `Leave it saying ${nxt}, walk to ${nxt}` : `Leave it saying ${END}, stop`
      };
      const kinds = ["R", "W1", "W2"].map((_, j, a) => a[(j + k) % 3]), correct = kinds.indexOf("R");
      const d = fin ? N : k;
      const ptrs = fin ? { [N - 1]: "start" } : ptrMap([[k - 1, "prev"], [k, "curr"], [k + 1, "next"]]);
      const cls = fin ? { [N - 1]: "enter" } : { [k]: "in" };
      const wrongMsg = w => w === "W1"
        ? (nxt ? `The card now says ${prev}, so you walk ${k === 0 ? "nowhere: the hunt is over at the " + H[0] : "back to the " + prev}. Nothing tells you where the ${nxt} card is: ${and(H.slice(k + 1))} are cut off.`
          : `The card now says ${prev}, so you would walk back down the hunt you just rewrote. ${cur} said ${END}: there is no card after it, so stop.`)
        : (nxt ? `Then ${cur} still says ${nxt}, and the ${nxt} card will soon say ${cur}. The second team would run between those two forever.`
          : `${cur} is where the second team starts. If it still says ${END}, their hunt is over before it begins.`);
      el.innerHTML = `<h1>Turn the hunt around in one walk</h1>
        <p class="lead">Same hunt, from the start. In code the three spots you keep track of have names: ${C("prev")} is where you came from, ${C("curr")} is the card in your hand, ${C("next")} is where it points.</p>
        ${fin ? "" : `<p class="task">You are at the ${cur} card. It says ${nxt || END}. What do you do?</p>`}
        ${kit.pics.list(HUNT, { cls, ptrs, links: revLinks(d), nullEnd: true, title: d > 0 ? `${HUNT[0]} now says the end` : "" })}
        <div class="lpanel">${fin ? "" : kit.options(kinds.map(x => text[x]), { picked: wrong == null ? null : kinds.indexOf(wrong), correct })}
        ${wrong != null ? kit.feedback(wrongMsg(wrong), false) : said ? kit.feedback(said, fin ? true : undefined) : ""}
        ${kit.meter([{ label: "Walk from the door each time", value: SLOW, max: SLOW }, { label: "One walk", value: d, max: SLOW, good: true }])}
        ${fin ? `<div class="sliders"><label>Cards in the hunt <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = kinds[+b.dataset.i];
        if (v !== "R") { wrong = v; paint(); return; }
        wrong = null;
        if (!nxt) {
          fin = true;
          said = `Done in one walk: ${N} cards read, ${N} rewritten, and you only ever kept track of three spots. The second team starts at the ${H[N - 1]}: ${H.slice().reverse().join(" → ")} → the end. The slow way took ${SLOW} steps and a pocket of fresh cards. Now make the hunt bigger:`;
          paint(); done(); return;
        }
        said = `The ${cur} card now says ${prev}. You walk to the ${nxt}, and ${cur} becomes the spot you came from.`;
        k++; paint();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const slow = n * (n - 1) / 2;
        el.querySelector("#big").innerHTML = `${fmt(slow)} vs ${fmt(n)}<small>steps when every card sends you back to the start, against one walk. That is about ${fmt(Math.round(slow / n))} times fewer steps, and no fresh cards at all.</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same walk as code. */
  const CODE1 = [
    "let prev = null, curr = head;",
    "while (curr !== null) {",
    "  const next = curr.next; // note it first",
    "  curr.next = prev; // rewrite it",
    "  prev = curr; curr = next;",
    "}",
    "return prev; // the new first card"
  ];
  const FR1 = (() => {
    const nm = i => i == null || i < 0 || i >= N ? "null" : H[i];
    const fr = [{ ln: 0, d: 0, p: -1, c: 0, nx: null, say: `${C("head")} is the first card, the ${H[0]}. Nobody came before it, so ${C("prev")} starts as ${C("null")}: that is ${END} in code.` }];
    for (let k = 0; k < N; k++) {
      fr.push({ ln: 1, d: k, p: k - 1, c: k, nx: null, say: `${C("curr")} is the ${H[k]}, not ${C("null")}, so the loop runs.` });
      fr.push({ ln: 2, d: k, p: k - 1, c: k, nx: k + 1, say: k < N - 1 ? `Note where the ${H[k]} card points: the ${H[k + 1]}.` : `The ${H[k]} card points to ${C("null")}. Note that too.` });
      fr.push({ ln: 3, d: k + 1, p: k - 1, c: k, nx: k + 1, say: `The ${H[k]} card now points to ${nm(k - 1)}. Its old arrow is gone, but ${C("next")} still holds ${nm(k + 1)}.` });
      fr.push({ ln: 4, d: k + 1, p: k, c: k + 1, nx: k + 1, say: k < N - 1 ? `Step on: ${C("prev")} is the ${H[k]}, ${C("curr")} is the ${H[k + 1]}.` : `Step on: ${C("prev")} is the ${H[k]}, and ${C("curr")} is ${C("null")}. You walked off the end.` });
    }
    fr.push({ ln: 1, d: N, p: N - 1, c: N, nx: N, say: `${C("curr")} is ${C("null")}, so the loop stops.` });
    fr.push({ ln: 6, d: N, p: N - 1, c: N, nx: N, fin: true, say: `Return ${C("prev")}, the ${H[N - 1]}: the first card of the backwards hunt, the same one you made by hand. One walk, ${N} cards.` });
    return fr.map(f => ({ ...f, vp: nm(f.p), vc: nm(f.c), vn: f.nx == null ? "–" : nm(f.nx) }));
  })();
  function revCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i];
      const ptrs = f.fin ? { [N - 1]: "start" } : ptrMap([[f.p, "prev"], [f.c < N ? f.c : null, "curr"], [f.nx != null && f.nx < N && f.nx !== f.c ? f.nx : null, "next"]]);
      el.innerHTML = `<h1>The same walk, written as code</h1>
        <p class="lead">Each card is a node object, and ${C("curr.next")} is its next link, the spot written on it. Each line is a move you just made by hand.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the cards.</p>
        ${kit.pics.list(HUNT, { cls: f.fin ? { [N - 1]: "enter" } : f.c < N ? { [f.c]: "in" } : {}, ptrs, links: revLinks(f.d), nullEnd: true })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>prev <b>${f.vp}</b></span><span>curr <b>${f.vc}</b></span><span>next <b>${f.vn}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 5. A second idea: two walkers at different speeds find the middle of the garden hunt in one walk. */
  const FRIEND = "Ana", F = esc(FRIEND);
  const GARDEN = ["Gate", "Tree", "Shed", "Pond", "Rock", "Bush", "Nest"], M = GARDEN.length, G = GARDEN.map(esc);
  const MIDW = (() => { let s = 0, f = 0, moves = 0; while (f + 1 < M) { s++; f = Math.min(f + 2, M); moves++; } return { s, f, moves }; })();
  // the walk above: fast stops on the last card (odd length) and slow is on the middle card; FA[m] = fast after m moves
  const FA = Array.from({ length: MIDW.moves + 1 }, (_, m) => Math.min(2 * m, M - 1));
  const FAST_PATH = FA.map(i => G[i]);
  function middle({ el, done, kit }) {
    let m = 0, wrong = null, ans = null, said = null;
    const paint = () => {
      const last = m === MIDW.moves, ok = ans === MIDW.s, a = FA[m], b = last ? null : FA[m + 1];
      const ptrs = ok ? ptrMap([[MIDW.s, "you"], [M - 1, FRIEND]]) : m === 0 ? { 0: `you ${FRIEND}` } : { [a]: FRIEND };
      const cls = ok ? { [MIDW.s]: "enter", [M - 1]: "in" } : { [a]: "in" };
      if (wrong != null) cls[wrong] = "no";
      const anaMsg = p => p === a ? `${F} does not stay put. Each move she follows two cards.`
        : p < a ? `${F} only walks forward along the arrows. The ${G[p]} is behind her.`
        : p === a + 1 ? `The ${G[p]} is one card. ${F} reads the ${G[p]} card too and follows it one card further.`
        : `The ${G[p]} is ${plural(p - a, "card")} from the ${G[a]}. ${F} follows exactly two.`;
      const youMsg = p => p === M - 1 ? `That is where ${F} stopped. She walks two cards per move and you walk one, so you cover half her distance.`
        : p === 0 ? `You would still be at the ${G[0]} only if you never moved. Each time she moved, you moved one card too.`
        : p > MIDW.s ? `To reach the ${G[p]} you need ${plural(p, "move")}, but she reached the last card after only ${MIDW.moves}. You stop when she does.`
        : `To reach the ${G[p]} you need ${plural(p, "move")}. In ${plural(p, "move")} she follows ${2 * p} cards, which puts her on the ${G[2 * p]}, not on the last card yet.`;
      el.innerHTML = `<h1>The snack goes at the middle card</h1>
        <p class="lead">The party moves outside to the garden hunt, ${G[0]} first, ${G[M - 1]} last. You want the snack at its middle card. Out there you only learn where a card leads when you reach it, so you cannot look and count. Counting first means walking to the ${G[M - 1]}, then starting again at the ${G[0]} and walking half of it. With two walkers, nobody ever goes back: when ${F} reaches the end, you are already at the middle. So you and your friend ${F} start at the ${G[0]}. Each move, you follow one card and ${F} follows two. You walk behind her, so watch her and keep count of your moves.</p>
        ${ok ? "" : `<p class="task">${last ? `${F} is on the last card. Tap the card you are standing on.` : `Move ${m + 1}: you follow one card. Tap the card where ${F} lands.${m > 0 ? " Your marker is hidden: keep count of your moves." : ""}`}</p>`}
        ${kit.pics.list(GARDEN, { cls, ptrs, pick: !ok, title: "the garden hunt, seen from above (the walkers cannot see this)" })}
        <div class="vars"><span>moves <b>${m}</b></span><span>${F} on <b>${G[a]}</b></span></div>
        <div class="lpanel">
        ${ok ? kit.feedback(`Right. After every move ${F} has walked twice as far as you. She stopped on the ${G[M - 1]} after ${plural(MIDW.moves, "move")} (${FAST_PATH.join(" → ")}), and your ${MIDW.moves} one-card moves took you to the ${G[MIDW.s]}: the middle, with ${MIDW.s} cards on each side. In code you are the <b>slow</b> pointer and she is the <b>fast</b> one: a pointer is just a variable that holds a card (a node), like ${C("prev")} and ${C("curr")} did.`, true)
          : wrong != null ? kit.feedback(last ? youMsg(wrong) : anaMsg(wrong), false)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lp-list [data-i]").forEach(bt => bt.onclick = () => {
        if (ok) return;
        const p = +bt.dataset.i;
        if (last) {
          if (p !== MIDW.s) { wrong = p; paint(); return; }
          wrong = null; ans = p; paint(); done(); return;
        }
        if (p !== b) { wrong = p; paint(); return; }
        wrong = null; m++;
        said = m === MIDW.moves
          ? `${F} lands on the ${G[b]}, the last card: it says the hunt ends there. You stop too, after ${plural(m, "move")} of your own.`
          : `${F} reads the ${G[b - 1]} card and lands on the ${G[b]}. You followed one card: ${plural(m, "move")} for you so far.`;
        paint();
      });
    };
    paint();
  }

  /* 6. A changed card makes the garden hunt loop: predict where fast lands until the two walkers meet. */
  const LOOP_TO = 2;
  const nx = i => i < M - 1 ? i + 1 : LOOP_TO;
  const LOOPW = (() => {
    const st = [{ s: 0, f: 0 }];
    let s = 0, f = 0;
    do { s = nx(s); f = nx(nx(f)); st.push({ s, f }); } while (s !== f && st.length < 50);
    return st;
  })();
  const MEET = LOOPW[LOOPW.length - 1].s, MOVES = LOOPW.length - 1;
  // how many arrows fast still has to follow to land on slow (null when that spot cannot be reached)
  const dist = (from, to) => { let x = from; for (let k = 0; k <= M; k++) { if (x === to) return k; x = nx(x); } return null; };
  const GAPS = LOOPW.filter(({ s, f }) => s >= LOOP_TO && f >= LOOP_TO).map(({ s, f }) => dist(f, s));
  function loopIt({ el, done, kit }) {
    let m = 0, wrong = null, said = null;
    const paint = () => {
      const fin = m === MOVES, { s, f } = LOOPW[m];
      const a = nx(f), b = nx(a), s2 = nx(s);
      const cls = fin ? { [s]: "enter" } : { [s]: "in", [f]: "enter" };
      if (!fin && s === f) cls[s] = "in";
      if (wrong != null) cls[wrong] = "no";
      const wrongMsg = p => p === a ? `The ${G[a]} is one card. Fast reads the ${G[a]} card too and follows it one card further.`
        : f === M - 1 || a === M - 1 ? `Fast follows two arrows from the ${G[f]}, and one of them is the ${G[M - 1]} arrow, which now bends back to the ${G[LOOP_TO]}.`
        : dist(f, p) == null ? `No arrow leads back to the ${G[p]}, so nobody walking from the ${G[f]} can land there.`
        : `The ${G[p]} is ${plural(dist(f, p), "arrow")} from the ${G[f]}. Fast follows exactly two.`;
      el.innerHTML = `<h1>A changed card, and a hunt with no end</h1>
        <p class="lead">Someone rewrote the ${G[M - 1]} card: it now sends you back to the ${G[LOOP_TO]}. Walking until the last card never stops now. You could write down every card you visit and stop at the first repeat, but that list grows with the hunt. Send out slow and fast again from the ${G[0]}: one card per move, and two.</p>
        ${fin ? "" : `<p class="task">Move ${m + 1} of the walk: slow steps to the ${G[s2]}. Tap the card where fast lands.</p>`}
        ${kit.pics.list(GARDEN, { cls, cycle: LOOP_TO, ptrs: s === f ? { [s]: "slow fast" } : { [s]: "slow", [f]: "fast" }, pick: !fin })}
        <div class="lpanel">
        ${wrong != null ? kit.feedback(wrongMsg(wrong), false)
          : fin ? kit.feedback(`They meet on the ${G[MEET]} after ${plural(MOVES, "move")}, so the hunt loops. With an end, fast would have stopped there. Count the gap in arrows forward from fast to slow, around the loop. After each move inside the loop it was ${GAPS.join(", ")}: fast gains one card per move, so it cannot jump over slow. Fast can look behind slow in the picture, but along the arrows it is closing in. You held two spots, not a list of every card.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lp-list [data-i]").forEach(bt => bt.onclick = () => {
        if (m === MOVES) return;
        const p = +bt.dataset.i;
        if (p !== b) { wrong = p; paint(); return; }
        wrong = null; m++;
        const n = LOOPW[m];
        said = `Slow is on the ${G[n.s]}, fast on the ${G[n.f]}. ${n.s === n.f ? "" : "Not together yet."}`;
        paint();
        if (m === MOVES) done();
      });
    };
    paint();
  }

  /* 7. Slow and fast as code, stepped on the looping garden hunt. */
  const CODE2 = [
    "let slow = head, fast = head;",
    "while (fast && fast.next) {",
    "  slow = slow.next;",
    "  fast = fast.next.next;",
    "  if (slow === fast) return true; // a loop",
    "}",
    "return false; // fast found the end"
  ];
  const FR2 = (() => {
    const fr = [{ ln: 0, s: 0, f: 0, say: `Both start on the ${G[0]}, the ${C("head")}.` }];
    for (let m = 1; m <= MOVES; m++) {
      const p = LOOPW[m - 1], q = LOOPW[m];
      fr.push({ ln: 1, s: p.s, f: p.f, say: `Fast is on the ${G[p.f]}, not ${C("null")}, and its card points somewhere, so ${C("fast.next")} is not ${C("null")} either. The loop runs.` });
      fr.push({ ln: 2, s: q.s, f: p.f, say: `Slow follows one arrow: ${G[p.s]} → ${G[q.s]}.` });
      fr.push({ ln: 3, s: q.s, f: q.f, say: `Fast follows two: ${G[p.f]} → ${G[nx(p.f)]} → ${G[q.f]}.` });
      fr.push(q.s === q.f
        ? { ln: 4, s: q.s, f: q.f, fin: true, say: `Both on the ${G[q.s]}: return ${C("true")}, the hunt loops. Without a loop, fast hits the end, the loop stops and the code returns ${C("false")}. That is how ${F} stopped on the ${G[M - 1]}, with slow on the middle card, so ending with ${C("return slow")} finds the middle.` }
        : { ln: 4, s: q.s, f: q.f, say: `${G[q.s]} and ${G[q.f]} are different cards. Keep going.` });
    }
    return fr;
  })();
  function loopCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR2[i];
      el.innerHTML = `<h1>Slow and fast, written as code</h1>
        <p class="lead">${C("slow.next")} is one arrow, ${C("fast.next.next")} is two. ${C("null")} counts as false, so the ${C("while")} line stops fast before it walks off an end. It checks ${C("fast.next")} because ${C("fast.next.next")} would read ${C(".next")} of ${C("null")} and throw. It checks ${C("fast")} for hunts with an even number of cards, where fast lands on ${C("null")} itself. On the snack screen ${F} stopped on the ${G[M - 1]} because its card said the end: that is ${C("fast.next")} being ${C("null")}.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the cards.</p>
        ${kit.pics.list(GARDEN, { cls: f.fin ? { [f.s]: "enter" } : f.s === f.f ? { [f.s]: "in" } : { [f.s]: "in", [f.f]: "enter" }, cycle: LOOP_TO, ptrs: f.s === f.f ? { [f.s]: "slow fast" } : { [f.s]: "slow", [f.f]: "fast" } })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>slow <b>${G[f.s]}</b></span><span>fast <b>${G[f.f]}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A print queue is stored as a chain: each job knows only the job after it. The boss wants the waiting jobs printed newest first, and there is no memory to spare for a copy.", true,
      "Yes, turn the links around. One walk with prev, curr and next makes the newest job the first, and you hold only three jobs at a time.",
      "This one fits. Walk the queue once, noting each job's next before pointing it back at the job before it. The newest job ends up first, with no copy of the queue."],
    ["A lift writes a chain of log entries, each entry holding a floor number and the next entry. Did the lift ever stop at the same floor twice?", false,
      "No. Floors repeat all the time while the chain still ends at the newest entry. Slow and fast meet only when an arrow points back to an earlier entry, and two entries with the same floor are still two entries. Keep a set of floors seen instead.",
      "Tempting, but slow and fast find an arrow that points back to an earlier entry, not two entries holding the same number. This chain still ends at the newest entry, so fast simply reaches the end and the walkers never meet, even if floor 3 appears ten times. Keep a set of floors seen."],
    ["Each router stores the next router for a packet. A bad setting might send packets round in a circle. Check one route before using it, on a router with almost no free memory.", true,
      "Yes, slow and fast. If the route loops, fast laps slow and they meet; if it ends, fast reaches the end. Two positions, whatever the route's length.",
      "This one fits. Remembering every router you have visited needs memory that grows with the route. Send a slow and a fast walker: they meet only if the route loops, and you hold just two positions."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would turning links or two speeds help here?</h1>
        <p class="lead">Use a linked list when you add, remove or rewire items in the middle often: you change one or two next links and copy nothing. Avoid it when you need item number i, because an array jumps there in one step and a list must walk from the head. ${WORDS[CASES.length] || CASES.length} situations away from the party.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. On to the problems. */
  const TAUGHT = {
    "reverse-links": "You did this with the birthday hunt: note next, point the card back, step on.",
    "fast-slow-pointers": "You did this with the snack: when fast runs out of cards, slow is on the middle.",
    "cycle-detection": "You did this with the changed Nest card: slow and fast meet only if the chain loops."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("linked-list", {
    title: "Linked list",
    teaches: ["reverse-links", "fast-slow-pointers", "cycle-detection"],
    screens: [slowWay, spotTrick, reverseIt, revCode, middle, loopIt, loopCode, recognise, toProblems],
    walk: [
      { right: Array.from({ length: N - 1 }, (_, i) => `[data-i="${i + 1}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(N).fill("[data-right]") },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: [`.lp-list [data-i="${FA[0] + 1}"]`], right: [...FA.slice(1), MIDW.s].map(i => `.lp-list [data-i="${i}"]`) },
      { wrong: [`.lp-list [data-i="${nx(0)}"]`], right: LOOPW.slice(1).map(({ f }) => `.lp-list [data-i="${f}"]`) },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
