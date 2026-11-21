/* Lesson: bit manipulation. A bike-share station that sends the state of its 8 docks as one number (read a dock
   with a one-hole card and AND, park a bike with OR), then a repair depot gate whose scans of bikes going out and
   coming back cancel under XOR, leaving the one bike still out. Every number on screen is computed here from
   STATION, QDOCKS, LOG and the case data. Plain browser script.
   Local additions (not in the shared kit): a dock-number row above kit.pics.bits, a "?" face (text and colour) for
   bits the learner has not worked out yet, and shorter bit faces for tall pictures, all in a <style id="lx-bit-manipulation">. */
(() => {
  const P = "lx-bit-manipulation";
  const W = 8, STATION = 182;                      // 8 docks; dock d is worth 2^d
  const QK = 2;                                    // the dock asked about on the "one question" screen
  const QDOCKS = [5, 3, 6];                        // docks read with a card, in order
  const bit = (n, d) => Math.floor(n / 2 ** d) % 2;
  const SETK = QDOCKS.find(d => !bit(STATION, d)); // a dock the learner found empty: a bike parks there
  const PARK1 = STATION | (1 << SETK), PARK2 = PARK1 | (1 << SETK), ADD2 = PARK1 + (1 << SETK);
  const LOG = [6, 13, 7, 6, 3, 7, 13];             // gate scans, in time order; one bike never comes back
  const LW = 4;                                    // bike numbers fit in 4 places
  const LONE = LOG.reduce((a, b) => a ^ b, 0);
  const COL = 0;                                   // the column asked about on the XOR question screen
  const BUSY = 300;                                // bikes out at once on a busy day (for the notebook size)
  const VISITS = 8;                                // wristband scans in the "most visits" case (even, so XOR cancels it)
  const BIGW = 32;                                 // docks on a big station, for the slow-way cost
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const word = n => WORDS[n] || String(n);
  const Word = n => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };
  const fmt = n => n.toLocaleString("en");
  const and = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const docsOf = n => { const r = []; for (let d = W - 1; d >= 0; d--) if (bit(n, d)) r.push(d); return r; };
  const dockList = ds => ds.length === 1 ? `dock ${ds[0]}` : `docks ${and(ds)}`;
  const bin = (n, w) => n.toString(2).padStart(w, "0");
  const placeName = d => `column worth ${2 ** d}`;
  const B = "<code>&amp;</code>", OR = "<code>|</code>", X = "<code>^</code>";

  function style() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
.lp-bits .lp-face.${P}-q { --lt: var(--muted); font-size: 16px; }
.lp-bits .lp-face.${P}-q.next { --lt: var(--good); }
.lp-bits .lp-bph.${P}-dn { font: 700 12px var(--mono); color: var(--ink-2); }
.lp-bits .lp-bph.${P}-dl { font: 700 12px var(--mono); color: var(--muted); text-align: left; }
.${P}-tight .lp-bits .lp-face { height: 34px; }`;
    document.head.appendChild(s);
  }
  // write "?" (as the real text, so a screen reader hears "?" too) in every bit face marked ${P}-q
  const maskQ = html => html.replace(new RegExp(`(<div class="lp-face b[01] [^"]*\\b${P}-q\\b[^"]*"[^>]*>)[01](</div>)`, "g"), "$1?$2");
  // kit.pics.bits plus a row of dock numbers on top (dock d sits under place 2^d); names are required for the label cell
  function docks(kit, n, o) {
    const html = maskQ(kit.pics.bits(n, Object.assign({ width: W }, o)));
    const row = `<span class="lp-bph ${P}-dl">dock</span>${Array.from({ length: W }, (_, k) => `<span class="lp-bph ${P}-dn">${W - 1 - k}</span>`).join("")}${o.values === false ? "" : "<span></span>"}`;
    return html.replace(/(<div class="lp-bits" style="[^"]*">)/, `$1${row}`);
  }
  // hide the "= n" of the last row, for a result the learner has to predict
  const hideLastValue = html => { const i = html.lastIndexOf('<span class="lp-bv">'); return i < 0 ? html : html.slice(0, i) + html.slice(i).replace(/<span class="lp-bv">[^<]*<\/span>/, '<span class="lp-bv">?</span>'); };
  const qRow = w => Object.fromEntries(Array.from({ length: w }, (_, d) => [d, `${P}-q`]));
  const opt = (kit, list, picked, correct, num) => kit.options(list.map(String), { picked, correct, num });

  /* 1. The slow way: decode the whole number, dock by dock, from the top. */
  function decode({ el, done, kit }) {
    style();
    let k = W - 1, left = STATION, wrong = null, said = null;
    const known = {};
    const paint = () => {
      const fin = k < 0, place = fin ? 0 : 2 ** k, correct = fin ? -1 : left >= place ? 0 : 1;
      const cls = {};
      for (let d = 0; d < W; d++) cls[d] = d in known ? (known[d] ? "in" : "") : d === k ? `next ${P}-q` : `${P}-q`;
      const below = fin ? [] : Array.from({ length: k }, (_, j) => 2 ** (k - 1 - j));
      el.innerHTML = `<h1>Eight docks, one number</h1>
        <p class="lead">A bike-share station by the river has ${W} docks. To save radio data, it reports them as <b>one number</b>. Each dock is worth a place value: dock 0 is worth 1, dock 1 is worth 2, and each next dock is worth double, up to dock ${W - 1} at ${2 ** (W - 1)}. The number is the sum of the docks that hold a bike. In the row below, 1 means a bike and 0 means empty. Right now the station sends <b>${STATION}</b>.</p>
        ${fin ? "" : `<p class="task">${left} is still to explain. Dock ${k} is worth ${place}. Does dock ${k} hold a bike?</p>`}
        ${docks(kit, STATION, { names: ["now"], cls, title: fin ? `${STATION}, fully decoded` : `step ${W - k} of ${W}` })}
        <div class="lpanel">${fin ? "" : opt(kit, [`Bike in dock ${k}`, "Empty"], wrong, correct)}
        ${wrong != null ? kit.feedback(wrong === 0
            ? `${left} is less than ${place}. A bike in dock ${k} would add ${place} on its own, more than the ${left} still to explain.`
            : k === 0 ? `No dock is below dock 0, so the ${left} still to explain can only be dock 0's bike.`
            : `If dock ${k} were empty, the docks below it could add up to at most ${below.join(" + ")} = ${place - 1}, and ${left} is more. So dock ${k} must hold a bike.`, false)
          : fin ? kit.feedback(`Decoded: bikes in ${dockList(docsOf(STATION))}. That took ${W} steps, and each step needed the one before it: this way, to learn dock 1 you had to work through ${W - 1} docks first. The app asks about one dock at a time, all day long. A station with ${BIGW} docks would take ${BIGW - 1} steps to answer for dock 1.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (v === 0) { said = `Bike in dock ${k}: ${left} − ${place} = ${left - place} still to explain.`; left -= place; known[k] = 1; }
        else { said = `Dock ${k} is empty: ${left} is less than ${place}. Still ${left} to explain.`; known[k] = 0; }
        k--; paint();
        if (k < 0) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: a card with one hole reads one dock. */
  function spotTrick({ el, done, kit }) {
    style();
    let ans = null;
    const card = 2 ** QK, high = STATION - STATION % (2 * card), highDocks = docsOf(high);
    const opts = [`Check whether ${STATION} is at least ${card}, the value of dock ${QK}`, `Lay a card over the row with one hole, above dock ${QK}, and look only through the hole`, `Check whether ${STATION} is even`];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct;
      const pic = ok
        ? docks(kit, [STATION, card, STATION & card], { names: ["now", "card", "&"], op: true, cls: [{ [QK]: "in" }, { [QK]: "in" }, { [QK]: "enter" }], title: `the card for dock ${QK} is ${bin(card, W)} = ${card}` })
        : docks(kit, STATION, { names: ["now"], cls: { [QK]: "in" } }) + kit.pics.key([["in", `dock ${QK}, the one asked about`]]);
      el.innerHTML = `<h1>Ask about one dock</h1>
        <p class="lead">The app wants to know one thing: is there a bike in dock ${QK}? Decoding all ${W} docks to answer it is the slow way.</p>
        <p class="task">Which single move tells you whether dock ${QK} holds a bike, whatever the other docks hold?</p>
        ${pic}
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. As a number the card is ${bin(card, W)}: a 1 only above dock ${QK}, which is ${card}. Each 0/1 place is called a <b>bit</b>, and the number written in 0s and 1s is its <b>binary</b> form. Where the card and the station both have a 1, write 1; everywhere else write 0. The card's 0s cover the other docks, so they all come out 0; only the hole lets dock ${QK}'s digit through. This is called <b>AND</b>, written ${B}. ${STATION} ${B} ${card} = ${STATION & card}, ${STATION & card ? "not 0, so dock " + QK + " holds a bike" : "so dock " + QK + " is empty"}. The computer does all ${W} places in one step, whichever dock you ask about.`, true)
          : ans === 0 ? kit.feedback(`${STATION} is at least ${card} because ${dockList(highDocks)} alone hold ${highDocks.map(d => 2 ** d).join(" + ")} = ${high}. The docks above dock ${QK} make the number big whatever dock ${QK} holds, so this answers yes either way.`, false)
          : kit.feedback(`Even or odd only tells you about dock 0, the only dock worth an odd number. ${STATION} is ${STATION % 2 ? "odd, so dock 0 holds a bike" : "even, so dock 0 is empty"}. Dock ${QK} is still unknown.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Use the card: pick the card for a dock, then predict what AND gives. */
  function readDocks({ el, done, kit }) {
    style();
    let q = 0, phase = "card", wrong = null, said = null;
    const paint = () => {
      const fin = q === QDOCKS.length, d = fin ? QDOCKS[q - 1] : QDOCKS[q], card = 2 ** d, res = STATION & card, has = res !== 0;
      const cards = [d, card, card * 2].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
      let pic, task, opts = null, correct = -1;
      if (!fin && phase === "card") {
        pic = docks(kit, STATION, { names: ["now"], cls: { [d]: "in" } });
        task = `Dock ${d}: which card has its one hole above dock ${d}?`;
        opts = cards; correct = cards.indexOf(card);
      } else {
        pic = docks(kit, [STATION, card, res], { names: ["now", "card", "&"], op: true, cls: [{ [d]: "in" }, { [d]: "in" }, fin ? { [d]: has ? "enter" : "" } : qRow(W)] });
        if (!fin) pic = hideLastValue(pic);
        if (fin && has) pic += kit.pics.key([["in", `dock ${d}, the one asked about`], ["enter", `the AND result: a bike in dock ${d}`]]);
        task = `${STATION} & ${card}: does dock ${d} hold a bike?`;
        opts = ["Bike", "Empty"]; correct = has ? 0 : 1;
      }
      if (!(fin && has)) pic += kit.pics.key([["in", `dock ${d}, the one asked about`]]);
      el.innerHTML = `<h1>Read three docks</h1>
        <p class="lead">Same station, same number: <b>${STATION}</b>. For each dock, pick its card, then say what the AND will show before you see it.</p>
        ${fin ? "" : `<p class="task">${task}</p>`}
        ${pic}
        <div class="lpanel">${fin ? "" : opt(kit, opts, wrong, correct, phase === "card")}
        ${wrong != null ? kit.feedback(phase === "card"
            ? (opts[wrong] === d ? `${d} is ${bin(d, W)}: ${d === 0 ? "no hole at all" : `holes above ${dockList(docsOf(d))}`}, not dock ${d}. The card is not the dock number; it is the dock's place value.`
              : `${opts[wrong]} is the value of dock ${d + 1}. Docks start at 0, so dock ${d} is worth ${card}.`)
            : `The card's hole is above dock ${d}, and the station shows a ${bit(STATION, d)} there. So ${STATION} & ${card} = ${res}: ${has ? "not 0, a bike" : "0, empty"}.`, false)
          : fin ? kit.feedback(`Three docks, one AND each, and nothing else decoded. Programmers call this card a <b>mask</b>. The card for any dock is a single 1, slid that many places left from dock 0: ${Array.from({ length: LW }, (_, d) => 2 ** d).join(", ")} and so on, doubling per dock.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (phase === "card") { said = `Card ${card} is ${bin(card, W)}: one hole, above dock ${d}.`; phase = "read"; }
        else { said = `${STATION} & ${card} = ${res}: dock ${d} ${has ? "holds a bike" : "is empty"}.`; q++; phase = "card"; }
        paint();
        if (q === QDOCKS.length) done();
      });
    };
    paint();
  }

  /* 4. Park a bike: OR sets one dock and is safe to repeat; adding is not. */
  function park({ el, done, kit }) {
    style();
    let ans = null;
    const card = 2 ** SETK;
    const opts = [`Add ${card}: now + ${card}`, `Keep a 1 wherever the station or the card has one`, `Keep a 1 only where both have one: now & ${card}`];
    const correct = 1;
    const flip0 = docsOf(PARK1 & ~ADD2 & 255), flip1 = docsOf(ADD2 & ~PARK1 & 255);
    const lost = docsOf(STATION);
    const paint = () => {
      let pic = docks(kit, STATION, { names: ["now"], cls: { [SETK]: "in" } }) + kit.pics.key([["in", `dock ${SETK}, where the bike parks`]]);
      if (ans === 1) pic = kit.pics.side(
        docks(kit, [STATION, card, PARK1], { names: ["now", "card", "|"], op: true, cls: [{}, { [SETK]: "in" }, { [SETK]: "enter" }], title: "first message" }),
        docks(kit, [PARK1, card, PARK2], { names: ["now", "card", "|"], op: true, cls: [{}, { [SETK]: "in" }, { [SETK]: "enter" }], title: "the same message again" }));
      if (ans === 0) pic = docks(kit, [PARK1, card, ADD2], { names: ["now", "card", "+"], op: true, cls: [{}, {}, Object.fromEntries([...flip0, ...flip1].map(x => [x, "no"]))], title: `the same message again: ${PARK1} + ${card}` });
      if (ans === 2) pic = docks(kit, [STATION, card, STATION & card], { names: ["now", "card", "&"], op: true, cls: [{}, {}, Object.fromEntries(lost.map(x => [x, "no"]))], title: `${STATION} & ${card}` });
      el.innerHTML = `<h1>A bike comes back</h1>
        <p class="lead">A rider parks in dock ${SETK}, which you found empty. The app must update <b>${STATION}</b>. The radio is patchy, so the station sometimes sends the same message twice: "dock ${SETK} has a bike".</p>
        <p class="task">Which update gives the right number even when the message arrives twice?</p>
        ${pic}
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. The first message gives ${STATION} → ${PARK1}: dock ${SETK} turns to 1 and no other dock moves. The second gives ${PARK1} again, because dock ${SETK} already has its 1. This is called <b>OR</b>, written ${OR}: a 1 wherever either row has one.`, true)
          : ans === 0 ? kit.feedback(`The first message works: ${STATION} + ${card} = ${PARK1}. The second adds ${card} again: ${PARK1} + ${card} = ${ADD2}. Dock ${SETK} already had a 1, so 1 + 1 carries into the next dock and on up: ${dockList(flip0)} now read empty and ${dockList(flip1)} ${flip1.length === 1 ? "reads" : "read"} a bike. One repeated message broke ${word(flip0.length + flip1.length)} docks.`, false)
          : kit.feedback(`${STATION} & ${card} = ${STATION & card}: the card has a 0 above every other dock, so the bikes in ${dockList(lost)} vanish from the number. AND reads one dock; it cannot add a bike.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. The same moves as code. */
  const CODE1 = [
    "function hasBike(now, dock) {",
    "  const card = 1 << dock; // the card",
    "  return (now & card) !== 0;",
    "}",
    "function park(now, dock) {",
    "  const card = 1 << dock;",
    "  return now | card;",
    "}"
  ];
  const FR1 = (() => {
    const fr = [];
    QDOCKS.slice(0, 2).forEach(d => {
      const card = 1 << d, res = STATION & card;
      fr.push({ ln: 0, call: `hasBike(${STATION}, ${d})`, rows: [STATION], names: ["now"], cls: [{ [d]: "in" }], vars: { now: STATION, dock: d, card: "–" }, say: `<code>hasBike(${STATION}, ${d})</code>: is there a bike in dock ${d}?` });
      fr.push({ ln: 1, call: `hasBike(${STATION}, ${d})`, rows: [1, card], names: ["1", `1<<${d}`], cls: [{ 0: "in" }, { [d]: "in" }], vars: { now: STATION, dock: d, card }, say: `<code>1 &lt;&lt; ${d}</code> slides a single 1 left ${d} places: ${card}. Each place to the left doubles it, so this is always the card for dock ${d}. Sliding bits like this is called a <b>shift</b>.` });
      fr.push({ ln: 2, call: `hasBike(${STATION}, ${d})`, rows: [STATION, card, res], names: ["now", "card", "&"], op: true, cls: [{ [d]: "in" }, { [d]: "in" }, { [d]: res ? "enter" : "" }], vars: { now: STATION, dock: d, card }, say: `${STATION} &amp; ${card} = ${res}, so the function returns ${res !== 0}: dock ${d} ${res ? "holds a bike" : "is empty"}, as you read it by hand.` });
    });
    [[STATION, PARK1], [PARK1, PARK2]].forEach(([now, out], i) => {
      const card = 1 << SETK;
      fr.push({ ln: 4, call: `park(${now}, ${SETK})`, rows: [now], names: ["now"], cls: [{ [SETK]: "in" }], vars: { now, dock: SETK, card: "–" }, say: i ? `The same message arrives again: <code>park(${now}, ${SETK})</code>.` : `<code>park(${now}, ${SETK})</code>: a bike rolls into dock ${SETK}.` });
      fr.push({ ln: 5, call: `park(${now}, ${SETK})`, rows: [1, card], names: ["1", `1<<${SETK}`], cls: [{ 0: "in" }, { [SETK]: "in" }], vars: { now, dock: SETK, card }, say: `The same shift as in hasBike: <code>1 &lt;&lt; ${SETK}</code> = ${card}, the card for dock ${SETK}.` });
      fr.push({ ln: 6, call: `park(${now}, ${SETK})`, rows: [now, card, out], names: ["now", "card", "|"], op: true, cls: [{}, { [SETK]: "in" }, { [SETK]: "enter" }], vars: { now, dock: SETK, card }, say: i ? `${now} | ${card} = ${out} again. Dock ${SETK} already had its 1, and the other docks are untouched.` : `${now} | ${card} = ${out}: dock ${SETK} turns to 1, every other dock stays as it was.` });
    });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    style();
    let i = 0;
    const paint = () => {
      const f = FR1[i];
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">In JavaScript, ${B} is AND and ${OR} is OR, applied to every place at once.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the docks.</p>
        ${docks(kit, f.rows, { names: f.names, op: !!f.op, cls: f.cls })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>call <b>${kit.esc(f.call)}</b></span><span>card <b>${f.vars.card}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 6. A second idea, the slow way: a notebook of bikes out, by hand. */
  const NL = LOG.length;
  const PEAK = (() => { const s = new Set(); let m = 0; LOG.forEach(b => { if (s.has(b)) s.delete(b); else s.add(b); m = Math.max(m, s.size); }); return m; })();
  function notebook({ el, done, kit }) {
    style();
    let k = 0, wrong = null, said = null, fresh = -1;
    const rows = [];
    const paint = () => {
      const fin = k === NL, id = fin ? null : LOG[k], at = fin ? -1 : rows.findIndex(r => r[0] === id), correct = at >= 0 ? 1 : 0;
      const cls = {};
      LOG.forEach((_, j) => { cls[j] = j < k ? "gone" : j === k ? "next" : ""; });
      el.innerHTML = `<h1>The bike that did not come back</h1>
        <p class="lead">A second idea. At the repair depot, a gate scanner reads a bike's number when it rolls out for a test ride and again when it rolls back in. It reads only the number, not the direction. At closing time one bike is still out. You keep a notebook of bikes out.</p>
        ${fin ? "" : `<p class="task">Scan ${k + 1}: bike ${id}. Write it down, or cross it off?</p>`}
        ${kit.cells(LOG, { cls, labels: LOG.map((_, j) => `#${j + 1}`) })}
        ${kit.table(rows, { head: ["bike", "out since scan"], title: "Notebook: bikes out", fresh, empty: "nobody out" })}
        <div class="lpanel">${fin ? "" : opt(kit, ["Write it down", "Cross it off"], wrong, correct)}
        ${wrong != null ? kit.feedback(wrong === 0
            ? `Bike ${id} is already in the notebook: it went out at scan ${rows[at][1]}. This scan is it coming back. Writing it again would list one bike as out twice.`
            : `Bike ${id} is not in the notebook, so it has not gone out yet. This scan is it leaving, and there is no line to cross off.`, false)
          : fin ? kit.feedback(`One line is left: <b>bike ${rows[0][0]}</b> is still out. The notebook needed up to ${PEAK} lines at once, one for every bike out at the same time. On a busy day with ${fmt(BUSY)} bikes out, that is ${fmt(BUSY)} lines. The gate's little chip has room for one number.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (v === 0) { rows.push([id, k + 1]); fresh = rows.length - 1; said = `Bike ${id} goes out. ${Word(rows.length)} ${rows.length === 1 ? "line" : "lines"} in the notebook.`; }
        else { rows.splice(at, 1); fresh = -1; said = `Bike ${id} is back: its line is crossed off. ${Word(rows.length)} ${rows.length === 1 ? "line" : "lines"} left.`; }
        k++; paint();
        if (k === NL) done();
      });
    };
    paint();
  }

  /* 7. Spot the trick: in each column, pairs add an even number of 1s. */
  const colCount = c => LOG.filter(b => bit(b, c)).length;
  function oddColumn({ el, done, kit }) {
    style();
    let ans = null;
    const cnt = colCount(COL), odd = cnt % 2 === 1, pv = placeName(COL);
    const opts = [`Its digit in the ${pv} is 1`, `Its digit in the ${pv} is 0`, "Nothing until you match up which scans are pairs"];
    const correct = odd ? 0 : 1;
    const allCols = Array.from({ length: LW }, (_, c) => LW - 1 - c).map(c => `${colCount(c)} in the column worth ${2 ** c} (${colCount(c) % 2 ? "odd" : "even"})`);
    const paint = () => {
      const ok = ans === correct;
      const rows = ok ? [...LOG, LONE] : LOG;
      const cls = rows.map((_, r) => r === LOG.length ? Object.fromEntries(Array.from({ length: LW }, (_, c) => [c, bit(LONE, c) ? "enter" : ""])) : { [COL]: "in" });
      el.innerHTML = `<h1>Look down one column</h1>
        <p class="lead">Here are the same ${NL} scans. Each bike number is written the way the station wrote its docks, with places worth ${and(Array.from({ length: LW }, (_, c) => 2 ** (LW - 1 - c)))}: a 1 in each place that adds up to it (${LOG[0]} = ${docsOf(LOG[0]).map(d => 2 ** d).join(" + ")}). Every bike that came back was scanned twice; the bike still out was scanned once.</p>
        <p class="task">The ${pv}${COL === 0 ? " (the right-most)" : ""} has ${word(cnt)} 1s. What does that tell you about the bike still out?</p>
        <div class="${P}-tight">${kit.pics.bits(rows, { width: LW, names: [...LOG.map((_, j) => `#${j + 1}`), ...(ok ? ["odd?"] : [])], op: ok, cls, title: `${pv}: ${word(cnt)} 1s` })}${kit.pics.key([["in", `the ${pv}`], ...(ok ? [["enter", "a 1 in the bike still out"]] : [])])}</div>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. A bike that came back put the same digit into every column twice: two 1s or none, an even number. So in any column, an odd count means the bike still out has a 1 there. Column by column: ${allCols.join(", ")}. That spells ${bin(LONE, LW)} = ${LONE}. You only need odd or even per column, so keep one digit per column and flip it at every 1.`, true)
          : ans === 2 ? kit.feedback(`You never need to know which scans pair up. Each bike that came back adds its digit to this column twice, in whatever order, so the pairs always add an even number of 1s. Whatever is odd comes from the bike still out.`, false)
          : kit.feedback(odd ? `If the bike still out had a 0 here, every 1 in this column would come from bikes scanned twice, so the count would be even. ${Word(cnt)} is odd.`
            : `If the bike still out had a 1 here, the pairs' even count plus its one 1 would make the count odd. ${Word(cnt)} is even.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. Use XOR yourself: predict the running number after each scan. */
  const RUN = (() => { const r = [0]; LOG.forEach(b => r.push(r[r.length - 1] ^ b)); return r; })();   // RUN[k] before scan k
  const outAt = k => { const s = new Set(); LOG.slice(0, k).forEach(b => { if (s.has(b)) s.delete(b); else s.add(b); }); return [...s]; };
  const MIX = (() => { for (let k = 2; k < NL; k++) if (outAt(k).length > 1) return k; return -1; })();  // first moment two or more bikes are out
  function runXor({ el, done, kit }) {
    style();
    let k = 0, wrong = null, said = null;
    const paint = () => {
      const fin = k === NL, kk = fin ? NL - 1 : k, r = RUN[kk], id = LOG[kk], x = r ^ id;
      const cand = [x, r | id, r & id].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
      const cls = [{}, {}, fin ? Object.fromEntries(Array.from({ length: LW }, (_, c) => [c, bit(x, c) ? "enter" : ""])) : qRow(LW)];
      let pic = maskQ(kit.pics.bits([r, id, x], { width: LW, names: ["so far", `bike ${id}`, "new"], op: true, cls, title: `scan ${kk + 1} of ${NL}` }));
      if (!fin) pic = hideLastValue(pic);
      el.innerHTML = `<h1>Flip as the scans come in</h1>
        <p class="lead">Now the chip keeps one number, starting at 0. At each scan it flips every column where the bike's number has a 1.${k > 0 ? ` That flip is called <b>XOR</b>, written ${X}: <code>so far ${X} bike</code>.` : ""}</p>
        ${fin ? "" : `<p class="task">Scan ${k + 1}: bike ${id}. What is the new number?</p>`}
        ${pic}
        <div class="lpanel">${fin ? "" : opt(kit, cand, wrong, cand.indexOf(x), true)}
        ${wrong != null ? (() => {
            const v = cand[wrong], both = r & id;
            return kit.feedback(v === (r | id)
              ? `${v} comes from keeping a 1 wherever either row has one (that is OR). But in the ${(cs => `${cs.length > 1 ? "columns" : "column"} worth ${and(cs.map(c => 2 ** c))}`)(Array.from({ length: LW }, (_, c) => c).filter(c => bit(both, c)))} both rows have a 1: flipped twice, it goes back to 0.`
              : `${v} comes from keeping a 1 only where both rows have one (that is AND). A column where just one row has a 1 is flipped once, so it must end up 1.`, false);
          })()
          : fin ? kit.feedback(`The number is <b>${RUN[NL]}</b>: bike ${RUN[NL]}, the same bike your notebook kept. Every bike that came back flipped its columns twice and vanished. One number all day, where the notebook needed up to ${PEAK} lines; with ${fmt(BUSY)} bikes out at once, about ${fmt(BUSY)} times fewer lines.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = cand[+b.dataset.i];
        if (v !== x) { wrong = +b.dataset.i; paint(); return; }
        wrong = null;
        const out = outAt(k + 1);
        said = k + 1 === MIX ? `${r} ${X} ${id} = ${x}. Bikes ${and(out)} are out, and ${x} is not either of them: it is their columns mixed. The number names one bike only once every other bike is back.`
          : `${r} ${X} ${id} = ${x}.`;
        k++; paint();
        if (k === NL) done();
      });
    };
    paint();
  }

  /* 9. XOR as code. */
  const CODE2 = [
    "let x = 0;",
    "for (const bike of scans) {",
    "  x = x ^ bike; // flip where bike has a 1",
    "}",
    "return x; // the bike still out"
  ];
  const FR2 = (() => {
    const fr = [{ ln: 0, k: -1, x: 0, say: "<code>x</code> is the chip's number. It starts at 0: no columns flipped." }];
    LOG.forEach((b, k) => fr.push({ ln: 2, k, x: RUN[k + 1], say: `bike = ${b}. ${RUN[k]} ^ ${b} = ${RUN[k + 1]}.${outAt(k).includes(b) ? ` Bike ${b} was out, so its columns flip back.` : ""}` }));
    fr.push({ ln: 4, k: NL, x: RUN[NL], say: `The loop ends. Return ${RUN[NL]}: bike ${RUN[NL]}, as you found by hand. One pass, one number, no notebook.` });
    return fr;
  })();
  function xorCode({ el, done, kit }) {
    style();
    let i = 0;
    const paint = () => {
      const f = FR2[i], cls = {};
      LOG.forEach((_, j) => { cls[j] = j < f.k ? "gone" : j === f.k ? "next" : ""; });
      const pic = f.k >= 0 && f.k < NL ? kit.pics.bits([RUN[f.k], LOG[f.k], f.x], { width: LW, names: ["x", "bike", "x ^ bike"], op: true })
        : kit.pics.bits(f.x, { width: LW, names: ["x"], cls: f.k === NL ? Object.fromEntries(Array.from({ length: LW }, (_, c) => [c, bit(f.x, c) ? "enter" : ""])) : {} });
      el.innerHTML = `<h1>Flipping, written as code</h1>
        <p class="lead"><code>scans</code> is the gate log. ${X} is XOR in JavaScript: it flips, in every column at once, wherever <code>bike</code> (the number after ${X}) has a 1.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the scans.</p>
        ${kit.cells(LOG, { cls })}
        <div class="${P}-tight">${pic}</div>
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>x <b>${f.x}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const SETTINGS = 20, MUTE = 13, TRIPLE = 5;
  const CASES = [
    [`A chat app stores ${SETTINGS} on/off settings for each user in one number, one place per setting. Before playing a sound, check whether setting ${MUTE}, mute, is on.`, true,
      `Yes. A card with one 1 in place ${MUTE}, <code>1 &lt;&lt; ${MUTE}</code> = ${fmt(1 << MUTE)}, and one AND: <code>(settings &amp; (1 &lt;&lt; ${MUTE})) !== 0</code>. Turning it on is <code>settings | (1 &lt;&lt; ${MUTE})</code>.`,
      `Each setting is one place in the number, like a dock. One AND with <code>1 &lt;&lt; ${MUTE}</code> reads it, without decoding the other ${SETTINGS - 1}.`],
    ["A packing list has the item numbers going into a box. The scanner at the door read every one of them plus one extra item number that is not on the list. Find the extra.", true,
      "Yes. Run one XOR over both lists. Every listed item shows up twice, once on each list, so it cancels. The extra shows up once and is all that is left.",
      "Put both lists through one running XOR. Every listed item appears twice, once on each list, so its flips cancel. The extra appears once, so it is what remains."],
    [`In a warehouse log, every order number appears exactly three times, except one that appears once. Find that one with a running XOR.`, false,
      `No. XOR cancels pairs, not triples: ${TRIPLE} ^ ${TRIPLE} = ${TRIPLE ^ TRIPLE}, then ^ ${TRIPLE} gives ${TRIPLE ^ TRIPLE ^ TRIPLE} again. Each order seen three times leaves its own digits in the result, mixed in with the lone one.`,
      `Try one order seen three times, ${TRIPLE}, on its own: ${TRIPLE} ^ ${TRIPLE} = ${TRIPLE ^ TRIPLE}, then ^ ${TRIPLE} gives ${TRIPLE ^ TRIPLE ^ TRIPLE}. An odd number of copies never cancels, so every order leaves its digits in the result, not just the lone one.`],
    ["A festival gate scans a wristband every time someone walks in. At the end of the day, find the person who came in most often.", false,
      `No. XOR keeps only odd or even per column, so a wristband scanned ${VISITS} times cancels to nothing, just like one never scanned. Finding the most visits needs a count per wristband: a Map.`,
      `XOR forgets how many times: a wristband scanned ${VISITS} times cancels to 0, exactly like one never scanned. To find the most visits you need a count per wristband, a Map from wristband to visits.`]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would bits do the job here?</h1>
        <p class="lead">${Word(CASES.length)} situations away from the bikes. A card with AND or OR reads or sets one place; XOR cancels whatever comes in pairs.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. On to the problems: the groups this lesson taught first. */
  const TAUGHT = {
    "masks-and-shifts": "You did this with the docks: a card with one 1, built with a shift, then AND to read a place and OR to set it.",
    "xor-cancels-pairs": "You did this with the depot gate: XOR every scan, pairs cancel, the one left over remains."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("bit-manipulation", {
    title: "Bit manipulation",
    teaches: ["masks-and-shifts", "xor-cancels-pairs"],
    screens: [decode, spotTrick, readDocks, park, asCode, notebook, oddColumn, runXor, xorCode, recognise, toProblems],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(W).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(QDOCKS.length * 2).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: Array(NL).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(NL).fill("[data-right]") },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
