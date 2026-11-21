/* Lesson: math and geometry. A lucky city bus ticket read by a chip that only does arithmetic (split it like
   banknotes, then peel digits with % 10), then a bus-stop light panel bolted on sideways, so every picture is
   sent turned a quarter turn clockwise by an index rule. Every number on screen is computed here from TICKET,
   NOTES, PIC1, PIC2 and the case data. Plain browser script. */
(() => {
  const fmt = n => n.toLocaleString("en");
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const X = "<code>x</code>";

  /* ---------- Idea 1: the ticket ---------- */
  const TICKET = 251323, NOTES = [100000, 10000, 1000, 100, 10], HALF = 1000;
  const DIG = String(TICKET).padStart(6, "0").split("").map(Number);
  const LEFT = Math.floor(TICKET / HALF), RIGHT = TICKET % HALF;
  const dsum = x => { let s = 0; while (x > 0) { s += x % 10; x = Math.floor(x / 10); } return s; };
  const SL = dsum(LEFT), SR = dsum(RIGHT), LUCKY = SL === SR;
  const SUML = `${DIG.slice(0, 3).join(" + ")} = ${SL}`, SUMR = `${DIG.slice(3).join(" + ")} = ${SR}`;
  const VERDICT = LUCKY ? "the ticket is lucky" : "the ticket is not lucky";
  // the slow way: always take away the biggest note that still fits; one entry per subtraction (note index)
  const SUBS = (() => { const out = []; let rem = TICKET; while (rem >= 10) { const k = NOTES.findIndex(v => v <= rem); out.push(k); rem -= NOTES[k]; } return out; })();
  const TAPS = SUBS.length;
  const WORST = 9 * NOTES.length;            // 999,999: nine of every note
  const FAST = 1 + DIG.length;               // one split, then one peel per digit
  // the peels, in order: right-most digit of the first half first; idx = position on the printed ticket
  const PEEL = (() => {
    const out = [];
    [LEFT, RIGHT].forEach((x0, h) => { let x = x0, i = h * 3 + 2; while (x > 0) { out.push({ x, d: x % 10, rest: Math.floor(x / 10), idx: i, h }); x = Math.floor(x / 10); i--; } });
    return out;
  })();
  const ticketCells = (kit, cls, ptrs = {}, vals = DIG) => kit.cells(vals, { cls, ptrs, labels: DIG.map((_, i) => i === 1 ? "first half" : i === 4 ? "second half" : "") });

  // local style: two small grids side by side on a phone (the shared side() wraps below 432px)
  const style = () => {
    if (document.getElementById("lx-math-geometry")) return;
    const s = document.createElement("style");
    s.id = "lx-math-geometry";
    s.textContent = ".lx-math-geometry-pair .lp-side { gap: 8px 20px; } .lx-math-geometry-pair .lp-side > * { flex: 1 1 130px; } .lx-math-geometry-pair .lp-grid { max-width: 230px !important; }";
    document.head.appendChild(s);
  };

  /* 1. The slow way: the chip can only subtract, so it takes the ticket apart like a pile of money. */
  function slowWay({ el, done, kit }) {
    style();
    let rem = TICKET, k = 0, wrong = null, last = -1;
    const tally = NOTES.map(() => 0);
    const paint = () => {
      const fin = rem < 10, correct = fin ? -1 : NOTES.findIndex(v => v <= rem);
      const rows = NOTES.map((v, i) => [fmt(v), tally[i]]).concat([["left over", fin ? rem : "–"]]);
      // a digit shows once its tally row can no longer change: no more of that amount fits; the last one is what is left over
      const known = DIG.map((_, i) => i < NOTES.length ? rem < NOTES[i] : fin);
      const vals = DIG.map((_, i) => !known[i] ? "?" : i < NOTES.length ? tally[i] : rem);
      const dcls = Object.fromEntries(DIG.map((_, i) => [i, known[i] ? "in" : "gone"]));
      el.innerHTML = `<h1>A lucky bus ticket</h1>
        <p class="lead">City bus tickets carry a six-digit number. A ticket is lucky when its first three digits add up to the same as its last three. The validator on the bus has a tiny chip. It gets the ticket as one whole number, <b>${fmt(TICKET)}</b>, and it cannot see digits. It can only subtract and compare.</p>
        <p class="task">Help the chip find the digits. Take away the biggest amount that still fits, again and again, until less than 10 is left.</p>
        ${ticketCells(kit, dcls, {}, vals)}
        ${kit.table(rows, { head: ["taken away", "times"], title: "Chip's tally", fresh: fin ? NOTES.length : last })}
        <div class="lpanel">
          <div class="sum">${fmt(rem)}<small>left on the chip, after ${plural(k, "subtraction")}</small></div>
          ${fin ? "" : kit.options(NOTES.map(v => `Take away ${fmt(v)}`), { picked: wrong, correct })}
          ${wrong != null ? kit.feedback(NOTES[wrong] > rem
              ? `Only ${fmt(rem)} is left. Taking away ${fmt(NOTES[wrong])} would go below zero.`
              : `${fmt(NOTES[correct])} still fits into ${fmt(rem)}. Take the biggest amount first. Otherwise the count of ${fmt(NOTES[wrong])}s grows past 9 and no longer matches one digit of the ticket.`, false)
            : fin ? kit.feedback(`Done. The counts read ${tally.join(" ")}, and ${rem} is left over: those are the digits ${DIG.join(" ")}. Because you always took the biggest amount first, no count went past 9, so each count is exactly one digit. ${SUML} and ${SUMR}, so ${VERDICT}. That took ${plural(TAPS, "subtraction")}. A ticket like 999,999 needs ${WORST}.`, true)
            : k ? kit.feedback(`${fmt(NOTES[SUBS[k - 1]])} taken away: ${fmt(rem)} left.`) : ""}
        </div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null; rem -= NOTES[v]; tally[v]++; last = v; k++;
        paint();
        if (rem < 10) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: one division pays out all the notes at once. */
  function spotSplit({ el, done, kit }) {
    let ans = null;
    const opts = [
      `${fmt(Math.floor(TICKET / HALF))} notes, ${fmt(TICKET % HALF)} change`,
      `${fmt(Math.floor(TICKET / 100))} notes, ${fmt(TICKET % 100)} change`,
      `${fmt(Math.floor(TICKET / HALF) - 1)} notes, ${fmt(TICKET % HALF + HALF)} change`
    ];
    const correct = 0;
    const paint = () => {
      const ok = ans === correct;
      const cls = ok ? Object.fromEntries(DIG.map((_, i) => [i, i < 3 ? "in" : "next"])) : {};
      el.innerHTML = `<h1>Pay it out in one go</h1>
        <p class="lead">Newer chips can also divide. <code>Math.floor(a / b)</code> keeps only the whole part, and <code>a % b</code> gives what is left over, the remainder. Think of the ticket as ${fmt(TICKET)} som (the local money) paid out in ${fmt(HALF)}-som notes. ${fmt(HALF)} has ${WORDS[String(HALF).length - 1].toLowerCase()} zeros, so the change is the last ${WORDS[String(HALF).length - 1].toLowerCase()} digits.</p>
        <p class="task">How many ${fmt(HALF)}-som notes, and how much change?</p>
        ${ticketCells(kit, cls)}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The notes are <code>Math.floor(${TICKET} / ${HALF})</code> = ${LEFT}: the first half of the ticket. The change is <code>${TICKET} % ${HALF}</code> = ${RIGHT}: the second half. Paying ${fmt(HALF)} at a time would take ${fmt(LEFT)} subtractions. One division does it at once. Now pay a half out in 10-som notes: the change, <code>x % 10</code>, is its last digit.`, true)
          : ans === 1 ? kit.feedback(`${fmt(Math.floor(TICKET / 100))} is how many 100-som notes it takes. With ${fmt(HALF)}-som notes, each note is worth ten of those, so there are fewer notes and more change.`, false)
          : kit.feedback(`${fmt(TICKET % HALF + HALF)} som of change still holds another ${fmt(HALF)}-som note. Change is always less than one note.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Peel the digits yourself, predicting each x % 10. */
  function peelIt({ el, done, kit }) {
    let k = 0, wrong = null, said = null;
    const sums = [0, 0];
    const paint = () => {
      const fin = k === PEEL.length, p = PEEL[k] || {};
      const cls = {};
      PEEL.forEach((q, j) => { cls[q.idx] = fin ? "in" : j < k ? "gone" : q.h === p.h ? "in" : ""; });
      if (!fin) cls[p.idx] = "next";
      const first = p.x != null ? +String(p.x)[0] : 0;
      const opts = fin ? [] : [p.d, first, p.rest, p.x].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).sort((a, b) => a - b);
      el.innerHTML = `<h1>Peel off the last digit</h1>
        <p class="lead">The chip splits the ticket into ${LEFT} and ${RIGHT}, then takes each half apart. The half being taken apart is called ${X}. Filled cells are still in ${X}, and the outlined cell is the digit peeled next. The rest are already peeled or still waiting. To peel a digit: <code>x % 10</code> is the change from 10-som notes. Add it to the sum, then <code>x = Math.floor(x / 10)</code> drops it.</p>
        ${fin ? "" : `<p class="task">${X} is ${p.x}. What is <code>${p.x} % 10</code>?</p>`}
        ${ticketCells(kit, cls, fin ? {} : { [p.idx]: "x % 10" })}
        <div class="vars"><span>x <b>${fin ? 0 : p.x}</b></span><span>first sum <b>${sums[0]}</b></span><span>second sum <b>${sums[1]}</b></span></div>
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(p.d), num: true })}
        ${wrong != null ? kit.feedback(
            wrong === p.rest ? (p.rest === 0 ? `0 is <code>Math.floor(${p.x} / 10)</code>: no 10-som note fits. The change is the whole ${p.x}.` : `${p.rest} is <code>Math.floor(${p.x} / 10)</code>: the notes, what stays after the peel. The peeled digit is the change.`)
            : wrong === first ? `${first} is the first digit of ${p.x}. The change from 10-som notes is always the last digit.`
            : `${p.x} is the whole number. Paying ${p.x} in 10-som notes leaves less than 10 as change.`, false)
          : fin ? kit.feedback(`Both halves peeled. ${SUML} and ${SUMR}: ${VERDICT}, as you found by subtracting. Adding the peeled digits gives the number's digit sum. One split and ${DIG.length} peels: at most ${FAST} steps for any six-digit ticket. For 999,999 the subtractions take ${WORST}, so that is about ${Math.round(WORST / FAST)} times fewer steps. A longer number costs just one more peel per digit.`, true)
          : said ? kit.feedback(said) : ""}
        ${fin ? kit.meter([{ label: "Subtract (999,999)", value: WORST, max: WORST }, { label: `Subtract (${fmt(TICKET)})`, value: TAPS, max: WORST }, { label: "Split and peel", value: FAST, max: WORST, good: true }]) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== p.d) { wrong = v; paint(); return; }
        wrong = null; sums[p.h] += p.d;
        said = `${p.x} % 10 = ${p.d}, so the ${p.h ? "second" : "first"} sum is now ${sums[p.h]}. <code>Math.floor(${p.x} / 10)</code> = ${p.rest}${p.rest === 0 ? ": nothing left, this half is done." : " stays."}`;
        k++; paint();
        if (k === PEEL.length) done();
      });
    };
    paint();
  }

  /* 4. The same moves as code. */
  const CODE1 = [
    "function sumOf(x) {",
    "  let sum = 0;",
    "  while (x > 0) {",
    "    sum += x % 10;",
    "    x = Math.floor(x / 10);",
    "  }",
    "  return sum;",
    "}",
    `const left = Math.floor(n / ${HALF});`,
    `return sumOf(left) === sumOf(n % ${HALF});`
  ];
  const FR1 = (() => {
    const fr = [{ ln: 8, x: "–", sum: "–", k: 0, say: `<code>n</code> is the ticket, ${TICKET}. The function is only defined above; this line runs first. One division gives the first half: left = ${LEFT}.` }];
    const res = [];
    let k = 0;
    [LEFT, RIGHT].forEach((x0, h) => {
      fr.push({ ln: 9, x: x0, sum: "–", k, say: h === 0 ? `The last line calls <code>sumOf(left)</code> first, so x = ${x0}.` : `The first call returned ${res[0]}. Now the remainder, <code>${TICKET} % ${HALF}</code> = ${x0}, goes into <code>sumOf</code>.` });
      let x = x0, sum = 0;
      fr.push({ ln: 1, x, sum, k, say: "sum starts at 0." });
      while (x > 0) {
        fr.push({ ln: 2, x, sum, k, say: `x > 0: ${x} > 0, so ${x === x0 ? "peel a digit" : "peel again"}.` });
        const d = x % 10;
        sum += d;
        fr.push({ ln: 3, x, sum, k, cur: true, say: `${x} % 10 = ${d}. sum becomes ${sum}.` });
        const was = x;
        x = Math.floor(x / 10); k++;
        fr.push({ ln: 4, x, sum, k, say: `x = Math.floor(${was} / 10) = ${x}.${x ? "" : " Nothing left."}` });
      }
      fr.push({ ln: 2, x, sum, k, say: "x > 0 is false, so the loop ends. Every digit of this half is peeled." });
      fr.push({ ln: 6, x, sum, k, say: `Return ${sum}.` });
      res.push(sum);
    });
    fr.push({ ln: 9, x: "–", sum: "–", k, fin: true, say: `${res[0]} === ${res[1]} is ${res[0] === res[1]}: ${VERDICT}, the answer you peeled by hand.` });
    return fr;
  })();
  function peelCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = {};
      PEEL.forEach((q, j) => { if (j < f.k) cls[q.idx] = "gone"; });
      if (f.cur) cls[PEEL[f.k].idx] = "next";
      if (f.fin) DIG.forEach((_, j) => { cls[j] = "in"; });
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">Nothing new here. <code>%</code> and <code>Math.floor</code> are the chip's two tricks. The loop runs until ${X} is 0, so it does not need to know how many digits there are.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the ticket.</p>
        ${ticketCells(kit, cls)}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>x <b>${f.x}</b></span><span>sum <b>${f.sum}</b></span><span>view <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* ---------- Idea 2: the panel ---------- */
  const toGrid = rows => rows.map(r => r.split("").map(ch => ch === "#" ? 1 : 0));
  const PIC1 = toGrid(["###.", "#...", "##..", "#..."]), PIC2 = toGrid(["..#.", "..#.", "#.#.", ".#.."]);
  const N = PIC1.length, HEAD = Array.from({ length: N }, (_, i) => String(i));
  const turn = g => { const out = g.map(r => r.map(() => 0)); g.forEach((row, r) => row.forEach((v, c) => { out[c][N - 1 - r] = v; })); return out; };
  const ccw = g => { const out = g.map(r => r.map(() => 0)); g.forEach((row, r) => row.forEach((v, c) => { out[N - 1 - c][r] = v; })); return out; };
  const lamps = g => { const out = []; g.forEach((row, r) => row.forEach((v, c) => { if (v) out.push([r, c]); })); return out; };
  const T1 = turn(PIC1), C1 = ccw(PIC1), L1 = lamps(T1).map(([r, c]) => `${r},${c}`);
  const WRONG1 = (() => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (PIC1[r][c] && !T1[r][c]) return `${r},${c}`; return "0,0"; })();
  const L2 = lamps(PIC2), DEST2 = L2.map(([r, c]) => [c, N - 1 - r]);
  // a lamp whose turned spot holds a lamp that is copied later (row by row): writing in place would lose it
  const COVER = (() => { const j = L2.findIndex((_, i) => { const [a, b] = DEST2[i]; return PIC2[a][b] && a * N + b > L2[i][0] * N + L2[i][1]; }); return j < 0 ? null : [L2[j], DEST2[j]]; })();
  const BIGP = 64;
  const blank = () => Array.from({ length: N }, () => Array(N).fill(""));
  const litCls = (g, state = "in") => { const c = {}; g.forEach((row, r) => row.forEach((v, j) => { if (v) c[`${r},${j}`] = state; })); return c; };
  const grid = (kit, cls, title, pick = false) => kit.pics.grid(blank(), { cls, title, pick, rowHead: HEAD, colHead: HEAD });
  const pat = a => a.map(v => v ? "lit" : "dark").join(", ");

  /* 5. The slow way: turn the picture in your head, lamp by lamp. */
  function byHand({ el, done, kit }) {
    style();
    const placed = new Set();
    let wrong = null;
    const paint = () => {
      const fin = placed.size === L1.length, cls = {};
      placed.forEach(k => { cls[k] = "in"; });
      if (wrong) cls[wrong] = "no";
      let fb = "";
      if (wrong) {
        const [i, j] = wrong.split(",").map(Number);
        fb = kit.feedback(PIC1[i][j] ? `That lamp is lit in the picture as it is now. Copying it straight across would show the picture on its side. Turn the picture first, then see where its lamps land.`
          : C1[i][j] ? `That is where a lamp lands if the picture turns the other way, counterclockwise. The panel needs a clockwise turn.`
          : `After a clockwise turn, this spot gets the lamp from row ${N - 1 - j}, column ${i} of the picture, and that one is dark.`, false);
      } else if (fin) fb = kit.feedback(`All ${L1.length} lamps are in place, and the other ${N * N - L1.length} stay dark. Each lamp took a turn of the whole picture in your head. A real stop panel is ${BIGP} × ${BIGP}: ${fmt(BIGP * BIGP)} lamps, for every picture it shows.`, true);
      else if (placed.size) fb = kit.feedback(`${placed.size} of ${L1.length} lamps placed.`);
      el.innerHTML = `<h1>A panel bolted on sideways</h1>
        <p class="lead">The bus stop has a small light panel that shows the route letter. Whoever fitted it bolted it on a quarter turn the wrong way. Until someone comes with a spanner, every picture has to be sent turned a quarter turn clockwise, so it looks upright on the street.</p>
        <p class="task">Turn the picture a quarter turn clockwise in your head. Tap every lamp that should light on the panel.</p>
        ${kit.pics.side(grid(kit, litCls(PIC1), "Picture"), `<div id="pn">${grid(kit, cls, "Sent to the panel", fin ? false : (i, j) => !placed.has(`${i},${j}`))}</div>`)}
        <div class="lpanel">${fb}</div>`;
      el.querySelectorAll(".lp-grid button").forEach(b => b.onclick = () => {
        const k = b.dataset.i;
        if (!L1.includes(k)) { wrong = k; paint(); return; }
        wrong = null; placed.add(k); paint();
        if (placed.size === L1.length) done();
      });
    };
    paint();
  }

  /* 6. Spot the trick: where does the top row go? */
  function spotTurn({ el, done, kit }) {
    style();
    let ans = null;
    const row0 = PIC1[0], col = j => T1.map(r => r[j]);
    // a worked example off the green row, so the general rule can be checked on the two grids
    const EX = lamps(PIC1).find(([r, c]) => r > 1 && c > 0) || lamps(PIC1).find(([r]) => r > 0) || [0, 0];
    const opts = [
      ["The right column, read top to bottom", col(N - 1), ""],
      ["The left column, read bottom to top", col(0).slice().reverse(), "That is where the top row goes in a quarter turn the other way, counterclockwise."],
      ["The bottom row, read right to left", T1[N - 1].slice().reverse(), "That is where the top row goes in a half turn."],
      ["The left column, read top to bottom", col(0), "That is a flip over the diagonal, like turning a page over, not a turn."]
    ];
    const correct = 0;
    const paint = () => {
      const ok = ans === correct;
      const src = litCls(PIC1); row0.forEach((v, c) => { if (v) src[`0,${c}`] = "enter"; });
      const dst = litCls(T1); if (ok) T1.forEach((r, i) => { if (r[N - 1]) dst[`${i},${N - 1}`] = "enter"; });
      el.innerHTML = `<h1>Where does the top row go?</h1>
        <p class="lead">The same picture and the panel you lit. Look at the top row of the picture, row 0. It reads ${pat(row0)}.</p>
        <p class="task">Find where row 0 went on the panel. Which line of the panel reads ${pat(row0)}?</p>
        <div class="lx-math-geometry-pair">${kit.pics.side(grid(kit, src, "Picture"), grid(kit, dst, "Panel"))}</div>
        <div class="lpanel">${kit.options(opts.map(o => o[0]), { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The right column, from the top, reads ${pat(col(N - 1))}, the same as row 0. Write r for a lamp's row number and c for its column number. One rule for every lamp: <b>row r, column c goes to row c, column ${N - 1} − r</b>. For example, the lamp at row ${EX[0]}, column ${EX[1]} lands at row ${EX[1]}, column ${N - 1 - EX[0]}. On a panel n lamps wide, that is column n − 1 − r. Turning a grid like this is called rotating a matrix 90 degrees clockwise.`, true)
          : kit.feedback(`On the panel, ${opts[ans][0].replace(/^T/, "t")}, reads ${pat(opts[ans][1])}, not ${pat(row0)}. ${opts[ans][2]}`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. Use the rule: place each lamp of a new picture. */
  function placeIt({ el, done, kit }) {
    style();
    let k = 0, wrong = null, said = null;
    const paint = () => {
      const fin = k === L2.length, src = litCls(PIC2), dst = {};
      for (let j = 0; j < k; j++) { src[L2[j].join(",")] = fin ? "in" : "gone"; dst[DEST2[j].join(",")] = "in"; }
      if (!fin) src[L2[k].join(",")] = "enter";
      if (wrong) dst[wrong] = "no";
      const [r, c] = fin ? [0, 0] : L2[k], col = N - 1 - r;
      let fb = "";
      if (wrong) {
        const [i, j] = wrong.split(",").map(Number);
        fb = kit.feedback(i === r && j === c ? `That is where the lamp is now, row ${r}, column ${c}. The turn moves it.`
          : i === c && j === r ? `Row ${c}, column ${r} swaps the row and the column, which flips the picture over its diagonal. The turn also counts the new column from the right: ${N - 1} − ${r} = ${col}.`
          : i === N - 1 - c && j === r ? `That is a quarter turn the other way, counterclockwise. Clockwise, row ${r} goes to column ${N - 1} − ${r} = ${col}.`
          : i === N - 1 - r && j === N - 1 - c ? `That is a half turn. A quarter turn sends row ${r} to column ${col}, and column ${c} becomes row ${c}.`
          : `Row ${r} becomes column ${N - 1} − ${r} = ${col}, and column ${c} becomes row ${c}. You tapped row ${i}, column ${j}.`, false);
      } else if (fin) fb = kit.feedback(`All ${L2.length} lamps placed with one rule, and nothing turned in your head. The turned picture goes onto a fresh panel, not the same one.${COVER ? ` In the same grid, the lamp at row ${COVER[0][0]}, column ${COVER[0][1]} would land on row ${COVER[1][0]}, column ${COVER[1][1]} and cover the lamp there before it had moved.` : ""} On a ${BIGP} × ${BIGP} panel the same rule handles all ${fmt(BIGP * BIGP)} lamps.`, true);
      else if (said) fb = kit.feedback(said);
      el.innerHTML = `<h1>Send a new picture by the rule</h1>
        <p class="lead">A new route letter. Use the rule: <b>row r, column c goes to row c, column ${N - 1} − r</b>.</p>
        ${fin ? "" : `<p class="task">Send the lamp at row ${r}, column ${c}. Tap where it goes on the panel.</p>`}
        ${kit.pics.side(grid(kit, src, "Picture"), `<div id="pn">${grid(kit, dst, "Panel", fin ? false : (i, j) => !DEST2.slice(0, k).some(d => d[0] === i && d[1] === j))}</div>`)}
        ${kit.pics.key([["", "no lamp"], ["enter", "the lamp to send now"], ["in", "a lit lamp"], ["gone", "a lamp already sent"], ["no", "not where it goes"]].filter(([st]) => !st || [...Object.values(src), ...Object.values(dst)].includes(st)))}
        <div class="lpanel">${fb}</div>`;
      el.querySelectorAll(".lp-grid button").forEach(b => b.onclick = () => {
        const key = b.dataset.i;
        if (key !== DEST2[k].join(",")) { wrong = key; paint(); return; }
        wrong = null;
        said = `Row ${r}, column ${c} goes to row ${c}, column ${col}.`;
        k++; paint();
        if (k === L2.length) done();
      });
    };
    paint();
  }

  /* 8. The turn as code, cell by cell. */
  const CODE2 = [
    "const n = pic.length;",
    "const out = pic.map(x => x.map(() => 0));",
    "for (let r = 0; r < n; r++) {",
    "  for (let c = 0; c < n; c++) {",
    "    out[c][n - 1 - r] = pic[r][c];",
    "  }",
    "}",
    "return out;"
  ];
  const FR2 = (() => {
    const out = PIC2.map(r => r.map(() => 0));
    const fr = [{ ln: 1, out: out.map(r => r.slice()), r: "–", c: "–", say: `<code>pic</code> is the new letter, 1 for a lit lamp and 0 for a dark one. <code>out</code> is a fresh, dark panel of the same size, n = ${N}. Here <code>x</code> is one row of <code>pic</code>.` }];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = PIC2[r][c], d = N - 1 - r;
      out[c][d] = v;
      fr.push({ ln: 4, out: out.map(x => x.slice()), r, c, say: v
        ? `r = ${r}, c = ${c}: <code>pic[${r}][${c}]</code> is 1, so <code>out[${c}][${d}]</code> lights, where you put it by hand.`
        : `r = ${r}, c = ${c}: <code>pic[${r}][${c}]</code> is 0, so <code>out[${c}][${d}]</code> stays dark.` });
    }
    fr.push({ ln: 7, out: out.map(r => r.slice()), r: "done", c: "–", fin: true, say: `Every cell visited once: ${N} × ${N} = ${N * N} copies, one rule. <code>out</code> is the panel you lit by hand.` });
    return fr;
  })();
  function turnCode({ el, done, kit }) {
    style();
    let i = 0;
    const paint = () => {
      const f = FR2[i], src = litCls(PIC2), dst = litCls(f.out);
      if (typeof f.r === "number") {
        src[`${f.r},${f.c}`] = PIC2[f.r][f.c] ? "enter" : "next";
        dst[`${f.c},${N - 1 - f.r}`] = PIC2[f.r][f.c] ? "enter" : "next";
      }
      el.innerHTML = `<h1>The turn, written as code</h1>
        <p class="lead">The rule from the panel, as one line inside two loops. The loops visit every cell of <code>pic</code>, row by row.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the two grids.</p>
        <div class="lx-math-geometry-pair">${kit.pics.side(grid(kit, src, "pic"), grid(kit, dst, "out"))}</div>
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>r <b>${f.r}</b></span><span>c <b>${f.c}</b></span><span>view <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CARD = 5038271946, SAFE = Number.MAX_SAFE_INTEGER;
  const DIAG = Array.from({ length: 2 * N - 1 }, (_, s) => Math.min(s, 2 * N - 2 - s) + 1);
  const CASES = [
    [`A receipt prints a loyalty card number with all but its last four digits hidden. The number reaches the printer as a whole number, ${fmt(CARD)}.`, true,
      `Yes. One remainder does it: <code>${CARD} % 10000</code> = ${CARD % 10000}, the change after paying in 10,000s. Like splitting the ticket, only with a bigger note.`,
      `No string is needed. Pay the number out in 10,000s: the change, <code>${CARD} % 10000</code> = ${CARD % 10000}, is exactly the last four digits.`],
    [`Two 30-digit card numbers arrive as plain JavaScript numbers. Remember: a JavaScript number keeps only about ${String(SAFE).length} exact digits. Peel their digits to add them.`, false,
      `No. A JavaScript number holds only about 16 exact digits (the largest safe one is ${fmt(SAFE)}). A 30-digit value arrives already rounded, so <code>% 10</code> would peel digits that were never on the card, and nothing can bring them back. Take the numbers as text and add them column by column from the right, carrying as on paper.`,
      `Peeling is right for numbers that fit, and these do not. A JavaScript number holds only about 16 exact digits (the largest safe one is ${fmt(SAFE)}), so a 30-digit value arrives rounded, and its last digits are lost before the first <code>% 10</code>. Take the numbers as text and add column by column with a carry.`],
    ["A theatre stores its seat map row by row. The stage crew wants the same map as seen from the stage, with left and right swapped.", true,
      `Yes, an index rule. Rows stay where they are and the column counts from the other side: seat (r, c) goes to (r, n − 1 − c).`,
      `Each seat has exactly one place in the swapped map: same row, column n − 1 − c. That is an index rule, like the quarter turn, only simpler.`],
    [`Show a ${N} × ${N} panel picture turned by 45 degrees on the same panel.`, false,
      `No. A quarter turn works because every lamp lands exactly on another lamp. Turned 45 degrees, the picture's diagonal is about ${(N * Math.SQRT2).toFixed(1)} lamps long, so the corners stick out past the panel and lamps land between lamp positions. There is no row and column to send each one to.`,
      `A quarter turn works because every lamp lands exactly on another lamp. Turned 45 degrees, the diagonal is about ${(N * Math.SQRT2).toFixed(1)} lamps long, the corners stick out and lamps land between lamp positions. Reading the diagonals is a different job: it gives lines of ${DIAG.join(", ")} lamps, not a turned picture.`]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Digits or an index rule?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the bus stop. For each one: does one of the two tricks, peeling digits or an index rule that says where each cell goes, do the job? Yes or No.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. On to the problems. */
  const TAUGHT = {
    "peel-digits": "You did this with the bus ticket: <code>% 10</code> peels the last digit, <code>Math.floor(x / 10)</code> drops it.",
    "grid-walks": "You did this with the bus-stop panel: one index rule says where every cell goes.",
    "carry-arithmetic": "Like the 30-digit card numbers: keep the digits as text and add column by column with a carry."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1><p>Peel digits when the number fits in a JavaScript number. Move cells by an index rule when every cell lands on exactly one cell. Otherwise, use text or a different method.</p>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("math-geometry", {
    title: "Math & geometry",
    teaches: ["peel-digits", "grid-walks"],
    screens: [slowWay, spotSplit, peelIt, peelCode, byHand, spotTurn, placeIt, turnCode, recognise, toProblems],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(TAPS).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(PEEL.length).fill("[data-right]") },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: [`#pn [data-i="${WRONG1}"]`], right: L1.map(k => `#pn [data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`#pn [data-i="${L2[0].join(",")}"]`], right: DEST2.map(d => `#pn [data-i="${d.join(",")}"]`) },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
