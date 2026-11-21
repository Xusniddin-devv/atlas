/* Lesson: heap / priority queue. A tailor's tray of alteration tickets, each due on some day: always sew the one
   due soonest while new tickets keep arriving (take the top), then the shop's three biggest orders of the month
   (keep only the best k). Every number on screen is computed here from DUE, ARRIVE, ADD and ORDERS.
   Plain browser script. */
(() => {
  /* ---------- data and the moves, computed once ---------- */
  const DUE = [9, 4, 12, 7, 3, 10, 6, 11], ARRIVE = [5, 8], ROUNDS = ARRIVE.length + 1, NT = DUE.length;
  const ADD = [5, 8];
  const ORDERS = [40, 90, 65, 55, 30, 120, 70, 45, 95], K = 3, NO = ORDERS.length;
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const lg = n => Math.floor(Math.log2(n));

  // add v at the end, swap it up while it is sooner than the ticket above it; every comparison is one step
  const pushSteps = (h0, v) => {
    const h = [...h0, v], steps = [];
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1, swap = h[i] < h[p];
      steps.push({ h: [...h], i, p, swap });
      if (!swap) break;
      [h[i], h[p]] = [h[p], h[i]]; i = p;
    }
    return { v, start: [...h0], steps, h, end: i };
  };
  // take the top, move the last ticket into the top spot, swap it down with the sooner ticket under it
  const takeSteps = h0 => {
    const h = [...h0], top = h[0], last = h.pop(), steps = [];
    if (h.length) h[0] = last;
    let i = 0;
    while (2 * i + 1 < h.length) {
      const l = 2 * i + 1, r = l + 1 < h.length ? l + 1 : null;
      const s = r != null && h[r] < h[l] ? r : l, swap = h[s] < h[i];
      steps.push({ h: [...h], i, l, r, s, swap });
      if (!swap) break;
      [h[i], h[s]] = [h[s], h[i]]; i = s;
    }
    return { top, last, start: [...h0], steps, h, end: i };
  };
  const push = (h, v) => pushSteps(h, v).h, take = h => takeSteps(h).h;

  // screen 1: the tray, round by round
  const TRAY = (() => {
    const out = []; let t = DUE.slice();
    for (let k = 0; k < ROUNDS; k++) {
      const v = Math.min(...t), at = t.indexOf(v);
      out.push({ t: t.slice(), at, v, fresh: k ? out[k - 1].at : -1 });
      if (k < ARRIVE.length) { t = t.slice(); t[at] = ARRIVE[k]; }
    }
    return out;
  })();
  const SLOW1 = TRAY.reduce((a, r) => a + r.t.length, 0);

  const HEAP0 = DUE.reduce((h, v) => push(h, v), []);       // the same tickets, pinned on the board
  const TAKES = (() => { const a = takeSteps(HEAP0); return [a, takeSteps(a.h)]; })();
  const ADDS = (() => { const out = []; let h = TAKES[TAKES.length - 1].h; for (const v of ADD) { const p = pushSteps(h, v); out.push(p); h = p.h; } return out; })();
  const TAKE_Q = TAKES.reduce((a, t) => a + t.steps.length, 0), ADD_Q = ADDS.reduce((a, t) => a + t.steps.length, 0);
  const lookT = st => st.r != null ? 2 : 1;                // comparing with the one or two tickets under it

  // best k: each order after the first K is a decision
  const KS = (() => {
    const out = []; let h = [];
    ORDERS.forEach((x, j) => {
      if (h.length < K) { const nh = push(h, x); out.push({ j, x, before: h, keep: true, direct: true, after: nh }); h = nh; return; }
      const keep = x > h[0], nh = keep ? push(take(h), x) : h;
      out.push({ j, x, before: h, keep, top: h[0], after: nh }); h = nh;
    });
    return out;
  })();
  const BEST = KS[NO - 1].after, BEST_SORTED = [...BEST].sort((a, b) => b - a);
  const KEPT = KS.filter(s => !s.direct && s.keep).length;

  const board = (kit, h, o = {}) => kit.pics.tree(h, o);
  const stepsBar = `<div class="lsteps"><button type="button" class="btn" data-prev>Step back</button><button type="button" class="btn" data-next>Next step</button></div>`;

  /* 1. The slow way: read the whole tray for every garment. */
  function slowWay({ el, done, kit }) {
    let k = 0, looks = 0, miss = null, said = null;
    const paint = () => {
      const fin = k === ROUNDS, r = TRAY[Math.min(k, ROUNDS - 1)], cls = {};
      if (fin) cls[r.at] = "leave";
      else { if (r.fresh >= 0) cls[r.fresh] = "enter"; if (miss != null) cls[miss] = "no"; }
      const labels = r.t.map((_, i) => i === r.fresh && !fin ? "new" : "");
      el.innerHTML = `<h1>A tailor's tray of tickets</h1>
        <p class="lead">You run a small alteration shop. Each garment waiting to be fixed has a ticket in the tray, and the number on it is the <b>day it is due</b>. You always sew the one due soonest. A new ticket comes in after each garment. Reading one ticket counts as one look.</p>
        ${fin ? "" : `<p class="task">Tap the ticket due soonest to sew it. Do this for ${ROUNDS} garments.</p>`}
        ${kit.pics.row1d(r.t, { cls, labels, pick: !fin, title: `tray, ${r.t.length} tickets` })}
        <div class="lpanel">
          <div class="sum">${fmt(looks)}<small>looks so far</small></div>
          ${miss != null ? kit.feedback(`That ticket is due on day ${r.t[miss]}, but another ticket in the tray is due sooner. To be sure, you have to compare it with every ticket, not just its neighbours.`, false)
            : fin ? kit.feedback(`${ROUNDS} garments sewn: days ${TRAY.map(x => x.v).join(", ")}. Your eyes found each one at a glance, but a program has to read every ticket to be sure: ${r.t.length} looks per garment, <b>${fmt(SLOW1)} looks</b> in all. A busy shop with 1,000 tickets that sews 1,000 garments makes ${fmt(1000 * 1000)} looks. Most of them re-read tickets it already read.`, true)
            : said ? kit.feedback(said) : ""}
        </div>`;
      el.querySelectorAll(".lp-face[data-i]").forEach(c => c.onclick = () => {
        const i = +c.dataset.i;
        if (i !== r.at) { miss = i; paint(); return; }
        looks += r.t.length; miss = null; k++;
        said = k < ROUNDS ? `You read all ${r.t.length} tickets and sewed the one due on day ${r.v}. A new ticket, due on day ${ARRIVE[k - 1]}, takes its place in the tray.` : null;
        paint();
        if (k === ROUNDS) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: pin the tickets so each one is due no later than the two under it. */
  function spotTop({ el, done, kit }) {
    let ans = null;
    const opts = ["Only the top ticket", "The bottom row", `All ${NT}: it could be anywhere`];
    const paint = () => {
      const ok = ans === 0;
      el.innerHTML = `<h1>Pin the tickets on a board</h1>
        <p class="lead">A new plan for the same ${NT} tickets. Pin them in rows, and keep one rule: <b>every ticket is due no later than the tickets pinned under it</b>. Here they are already pinned. In two screens you will pin new ones yourself. Follow the lines to see which tickets hang under which.</p>
        <p class="task">You want the ticket due soonest. Which tickets must you read?</p>
        ${board(kit, HEAP0, { cls: ok ? { 0: "enter" } : {} })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. Start at any ticket and go up the lines: each step up is due no later. Every path ends at the top, so nothing can be sooner than the top ticket, day ${HEAP0[0]}. One look instead of ${NT}.`, true)
          : ans === 1 ? kit.feedback(`The bottom tickets have the most tickets above them, and each of those is due no later. Go up from the ${HEAP0[NT - 1]}: ${(() => { const p = []; for (let i = NT - 1; i > 0;) { i = (i - 1) >> 1; p.push(HEAP0[i]); } return p.join(", then "); })()}. Every path up ends at the same ticket, so that is where the soonest one is.`, false)
          : kit.feedback(`The rule rules that out. Take any ticket: the one above it is due no later, and the one above that, up to the top. So no ticket can be due sooner than the top one.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 3. Take the top yourself: the last ticket moves up, then sinks to where the rule holds. */
  function takeTop({ el, done, kit }) {
    let t = 0, q = 0, wrong = null, slow = TAKES[0].start.length, fast = 0;
    const paint = () => {
      const T = TAKES[t], betw = q === T.steps.length, st = betw ? null : T.steps[q], last = t === TAKES.length - 1;
      let cls = {}, h = T.h, opts = [], correct = -1;
      if (st) {
        h = st.h; cls = { [st.i]: "next", [st.l]: "in" }; if (st.r != null) cls[st.r] = "in";
        opts = [`Swap with the ${h[st.l]}`, ...(st.r != null ? [`Swap with the ${h[st.r]}`] : []), "It stays here"];
        correct = st.swap ? (st.s === st.l ? 0 : 1) : opts.length - 1;
      } else cls = { [T.end]: "enter" };
      const v = st ? h[st.i] : T.last, kids = st ? [h[st.l], ...(st.r != null ? [h[st.r]] : [])] : [];
      const sooner = st ? h[st.s] : null;
      el.innerHTML = `<h1>Take the top, then repair the board</h1>
        <p class="lead">You sewed the <b>${T.top}</b> from the top. The last ticket, the <b>${T.last}</b>, moved up into the empty top spot. Why the last one? A board with no gaps can be stored as a plain list, row by row (you will see it on the code screen). So we always fill the hole with the last ticket, then repair the order.</p>
        ${st ? `<p class="task">The ${v} has ${kids.length === 2 ? `the ${kids[0]} and the ${kids[1]}` : `only the ${kids[0]}`} under it. What happens to it?</p>` : ""}
        ${board(kit, h, { cls })}
        ${st ? kit.pics.key([["next", `the ${v}`], ["in", kids.length === 2 ? "the two under it" : "the one under it"]]) : ""}
        <div class="vars"><span>sewn <b>${TAKES.slice(0, t + 1).map(x => x.top).join(", ")}</b></span><span>on top now <b>${h[0]}</b></span></div>
        <div class="lpanel">${st ? kit.options(opts, { picked: wrong, correct }) : ""}
        ${st && wrong != null ? kit.feedback(
            wrong === opts.length - 1 ? `The ${v} is due later than the ${sooner} under it, so the rule is broken here. It has to go down.`
            : !st.swap ? `The ${v} is already due no later than ${kids.map(x => `the ${x}`).join(" and ")} under it. The rule holds, so it stays.`
            : (() => { const other = h[wrong === 0 ? st.l : st.r]; return `Then the ${other} would sit above the ${sooner}, which is due sooner, and the rule breaks again. Swap with the sooner of the two.`; })(), false) : ""}
        ${betw ? kit.feedback(`The ${T.last} settled ${T.end === 0 ? "on top" : T.steps.length && !T.steps[T.steps.length - 1].swap ? (T.steps[T.steps.length - 1].r != null ? "where the tickets under it are due later" : "where the ticket under it is due later") : "with nothing under it"}. The rule holds again, and the soonest ticket is on top: the <b>${T.h[0]}</b>. You compared with ${plural(T.steps.reduce((a, s) => a + lookT(s), 0), "ticket")}, against ${T.start.length} looks to read the whole tray this time.${last ? " The ticket only travels down one path, never across the board." : ""}`, true) : ""}
        ${kit.meter([{ label: "Total so far: reading the whole tray", value: slow, max: TAKES.reduce((a, x) => a + x.start.length, 0) }, { label: "Total so far: using the board", value: fast, max: TAKES.reduce((a, x) => a + x.start.length, 0), good: true }])}
        ${betw && !last ? `<div class="lsteps"><button type="button" class="btn" data-next>Sew the next ticket</button></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const p = +b.dataset.i;
        if (p !== correct) { wrong = p; paint(); return; }
        wrong = null; fast += lookT(st); q++;
        paint();
        if (last && q === T.steps.length) done();
      });
      const nx = el.querySelector("[data-next]");
      if (nx) nx.onclick = () => { t++; q = 0; slow += TAKES[t].start.length; paint(); };
    };
    paint();
  }

  /* 4. A new ticket arrives: it goes in last and rises while it is sooner than the one above. */
  function addTicket({ el, done, kit }) {
    let a = 0, q = 0, wrong = null, n = 1000;
    const paint = () => {
      const A = ADDS[a], betw = q === A.steps.length, st = betw ? null : A.steps[q], last = a === ADDS.length - 1, fin = betw && last;
      const h = st ? st.h : A.h, cls = st ? { [st.i]: "next", [st.p]: "in" } : { [A.end]: "enter" };
      const correct = st ? (st.swap ? 0 : 1) : -1, up = st ? h[st.p] : null;
      el.innerHTML = `<h1>A new ticket comes in</h1>
        <p class="lead">A customer brings a garment due on day <b>${A.v}</b>. Its ticket goes in the next free spot: the bottom row, as far left as it fits. Now it may break the rule from below.</p>
        ${st ? `<p class="task">The ${A.v} hangs under the ${up}. What happens to it?</p>` : ""}
        ${board(kit, h, { cls })}
        ${st ? kit.pics.key([["next", `the new ${A.v}`], ["in", `the ${up} above it`]]) : ""}
        <div class="lpanel">${st ? kit.options([`Swap it up with the ${up}`, "It stays here"], { picked: wrong, correct }) : ""}
        ${st && wrong != null ? kit.feedback(st.swap
            ? `The ${A.v} is due sooner than the ${up} above it. Left there, the ${up} would sit above a sooner ticket and the rule breaks.`
            : `The ${A.v} is due later than the ${up} above it, so the rule already holds. Swapping would put the ${A.v} above the ${up}.`, false) : ""}
        ${betw ? kit.feedback(`The ${A.v} ${A.end === 0 ? "rose all the way to the top: it is now the soonest ticket" : `stopped under the ${A.h[(A.end - 1) >> 1]}`}. It took ${plural(A.steps.length, "comparison")}, one per row it climbed or checked.`, true) : ""}
        ${betw && !last ? `<div class="lsteps"><button type="button" class="btn" data-next>Add the next ticket</button></div>` : ""}
        ${fin ? `${kit.feedback(`This board has a name: a <b>heap</b>. Smallest on top is a min-heap. Used as "always give me the most urgent next", it is called a <b>priority queue</b>. Taking the top or adding a ticket only moves along one path, top to bottom, so the work grows with the number of rows, not the number of tickets. Make the tray bigger:`)}
          <div class="sliders"><label>Tickets in the tray <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>
          <p>Why not keep the tray sorted? Taking is then one look, but each new ticket has to push every later ticket one spot along to make room.</p>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const p = +b.dataset.i;
        if (p !== correct) { wrong = p; paint(); return; }
        wrong = null; q++;
        paint();
        if (last && q === A.steps.length) done();
      });
      const nx = el.querySelector("[data-next]");
      if (nx) nx.onclick = () => { a++; q = 0; paint(); };
      const sn = el.querySelector("#sn");
      if (!sn) return;
      // update in place: re-drawing would drop the slider the learner is dragging
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const down = lg(n), heap = 1 + 3 * down, r = n / heap;
        el.querySelector("#big").innerHTML = `${fmt(n)} vs ${fmt(heap)}<small>looks per garment, at most: reading the whole tray, against the board. On a board ${plural(down + 1, "row")} deep, a ticket moves at most ${plural(down, "step")} down or up. Each garment is one take and one add: 1 look at the top, up to 2 per step down, 1 per step up, so 1 + 2×${down} + ${down} = ${fmt(heap)}. ${r >= 1.5 ? `That is about ${fmt(Math.round(r))} times fewer looks.` : "With a tray this small the board saves nothing. It pays off as the tray grows."}</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 5. Taking the top, as code, on the board and the array behind it. */
  const CODE1 = [
    "const top = h[0], last = h.pop();",
    "const n = h.length;",
    "if (n) h[0] = last;",
    "let i = 0;",
    "while (2 * i + 1 < n) {",
    "  const l = 2 * i + 1, r = l + 1;",
    "  const s = r < n && h[r] < h[l] ? r : l;",
    "  if (h[i] <= h[s]) break; // rule holds",
    "  [h[i], h[s]] = [h[s], h[i]]; i = s;",
    "}"
  ];
  const FR1 = (() => {
    const h = HEAP0.slice(), top = h[0], last = h.pop(), n = h.length, fr = [], D = "–";
    const at = (ln, o) => fr.push({ ln, h: h.slice(), top, last, n: o.n == null ? D : o.n, i: o.i == null ? D : o.i, l: o.l == null ? D : o.l, r: o.r == null ? D : o.r, s: o.s == null ? D : o.s, cls: o.cls || {}, ptrs: o.ptrs || {}, say: o.say });
    at(0, { cls: { 0: "leave" }, say: `top = ${top}: the ticket to sew. pop() takes the last ticket, the ${last}, off the end of the array and holds it in <code>last</code>, so it is not on the board for now.` });
    at(1, { n, cls: { 0: "leave" }, say: `${n} tickets are left in the array.` });
    h[0] = last;
    at(2, { n, cls: { 0: "accent" }, say: `The ${last} goes into the top spot, position 0. if (n) skips this when the board is now empty.` });
    let i = 0;
    at(3, { n, i, cls: { 0: "accent" }, ptrs: { 0: "i" }, say: `i is where the ${last} sits now.` });
    for (;;) {
      if (!(2 * i + 1 < n)) {
        at(4, { n, i, cls: { [i]: "accent" }, ptrs: { [i]: "i" }, say: `2 × ${i} + 1 = ${2 * i + 1} is not less than ${n}: nothing hangs under it. The loop ends with the ${h[0]} on top, as you found by hand.` });
        break;
      }
      at(4, { n, i, cls: { [i]: "accent" }, ptrs: { [i]: "i" }, say: `2 × ${i} + 1 = ${2 * i + 1} is less than ${n}, so at least one ticket hangs under the ${h[i]}.` });
      const l = 2 * i + 1, r = l + 1, kc = { [i]: "accent", [l]: "in" };
      if (r < n) kc[r] = "in";
      at(5, { n, i, l, r, cls: kc, ptrs: { [i]: "i" }, say: r < n ? `l = ${l} and r = ${r}: the two spots under position ${i}. In the array they sit at 2i + 1 and 2i + 2.` : `l = ${l}. r = ${r} is past the end: only one ticket hangs under it.` });
      const s = r < n && h[r] < h[l] ? r : l;
      at(6, { n, i, l, r, s, cls: kc, ptrs: { [i]: "i", [s]: "s" }, say: `s (for sooner) = ${s}: the ${h[s]} is the sooner ticket under it. r < n checks that a right ticket exists at all.` });
      if (h[i] <= h[s]) { at(7, { n, i, l, r, s, cls: kc, ptrs: { [i]: "i", [s]: "s" }, say: `${h[i]} is due no later than ${h[s]}. The rule holds, so break.` }); break; }
      at(7, { n, i, l, r, s, cls: kc, ptrs: { [i]: "i", [s]: "s" }, say: `${h[i]} is due later than ${h[s]}: the rule is broken, so no break.` });
      const v = h[i], u = h[s];
      [h[i], h[s]] = [h[s], h[i]]; i = s;
      at(8, { n, i, l, r, s, cls: { [i]: "accent" }, ptrs: { [i]: "i" }, say: `Swap: the ${u} moves up, the ${v} moves down to position ${s}. i = ${s}.` });
    }
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i];
      el.innerHTML = `<h1>Taking the top, as code</h1>
        <p class="lead">The board is stored row by row in a plain array <code>h</code> (the numbered row). Under position <code>i</code> hang <code>2i+1</code> and <code>2i+2</code>. Check it: under 0 hang 1 and 2, under 1 hang 3 and 4. This works only because the rows have no gaps, which is why the last ticket fills the top spot.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the board.</p>
        ${board(kit, f.h, { array: true, cls: f.cls, ptrs: f.ptrs })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>top <b>${f.top}</b></span><span>last <b>${f.last}</b></span><span>i <b>${f.i}</b></span><span>l <b>${f.l}</b></span><span>r <b>${f.r}</b></span><span>s <b>${f.s}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        ${stepsBar}`;
      const pv = el.querySelector("[data-prev]"), nx = el.querySelector("[data-next]");
      pv.disabled = i === 0; nx.disabled = i === FR1.length - 1;
      pv.onclick = () => { i--; paint(); };
      nx.onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 6. The second idea: which of the best three does a new order have to beat? */
  const S6 = KS[K];       // the first decision
  function spotWeakest({ el, done, kit }) {
    let ans = null;
    const b = S6.before, lo = Math.min(...b), hi = Math.max(...b), x = S6.x;
    const opts = [`The ${hi}, the biggest of the three`, `The ${lo}, the smallest of the three`, "All three, one by one"];
    const paint = () => {
      const ok = ans === 1, cls = {};
      b.forEach((v, i) => { cls[i] = ok && v === lo ? "leave" : "in"; });
      el.innerHTML = `<h1>The three biggest orders</h1>
        <p class="lead">A new job at the same shop. At the end of the month, the <b>${K} biggest orders</b> get their next alteration free. Orders come in one at a time, and you do not want to keep the whole month's pile. So far the best ${K} are ${b.join(", ")}. A new order of <b>${x}</b> comes in.</p>
        <p class="task">To decide if the ${x} gets into the best ${K}, which order do you compare it with?</p>
        ${kit.pics.side(kit.pics.row1d(b, { cls, labels: false, title: `best ${K} so far` }), kit.pics.row1d([x], { cls: { 0: "next" }, labels: false, title: "new order" }))}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. If the ${x} cannot beat the ${lo}, it cannot beat the others either. If it can, the ${lo} is exactly the one to drop. So keep the <b>smallest</b> of the best on top, where one look finds it: a heap of ${K} with the smallest on top. The same board as the tickets.`, true)
          : ans === 0 ? kit.feedback(`The ${x} does not beat the ${hi}, but that does not keep it out: it does beat the ${lo}. The order that would leave is the smallest of the three, so that is the one to compare with.`, false)
          : kit.feedback(`One comparison is enough. If the ${x} cannot beat the smallest of the three, it cannot beat any. If it can, the smallest is the one to drop. Checking all three wastes looks.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => { ans = +bt.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. Keep the best three yourself: drop the new order, or put it in and drop the top. */
  const streamCls = (j, h, cur) => Object.fromEntries(ORDERS.map((v, i) => [i, i === cur ? "next" : i < j ? (h.includes(v) ? "in" : "gone") : ""]));
  function keepBest({ el, done, kit }) {
    let j = K, wrong = null, said = null;
    const paint = () => {
      const fin = j === NO, s = fin ? null : KS[j], h = fin ? BEST : s.before;
      const correct = s ? (s.keep ? 1 : 0) : -1;
      el.innerHTML = `<h1>Keep only the best ${K}</h1>
        <p class="lead">The month's orders, in the order they came in. The first ${K} went straight onto a small board with the smallest on top. The key under the orders shows which are in and which are out.</p>
        ${fin ? "" : `<p class="task">The next order is <b>${s.x}</b>. The smallest of the best ${K} is the ${s.top}. Drop the new order, or put it in?</p>`}
        ${kit.pics.row1d(ORDERS, { cls: fin ? streamCls(NO, BEST, -1) : streamCls(j, h, j), labels: false, title: "orders this month" })}
        ${kit.pics.key([["in", `in the best ${K}`], ["gone", "out"]])}
        ${board(kit, h, { array: true, cls: fin ? Object.fromEntries(h.map((_, i) => [i, "enter"])) : { 0: "next" }, title: `best ${K}, smallest on top` })}
        <div class="lpanel">${fin ? "" : kit.options([`Drop the ${s.x}`, `Put it in, drop the ${s.top}`], { picked: wrong, correct })}
        ${wrong != null ? kit.feedback(s.keep
            ? `The ${s.x} beats the ${s.top}, the smallest of the best ${K}, so it belongs in the best ${K} and the ${s.top} drops out.`
            : `The ${s.x} does not beat the ${s.top}, the smallest of the best ${K}, so it cannot beat the other two either. It is not in the best ${K}.`, false)
          : fin ? kit.feedback(`Done. The ${K} biggest orders are <b>${BEST_SORTED.join(", ")}</b>. You saw ${NO} orders but never held more than ${K}. Each new order cost one look at the top. Only the ${plural(KEPT, "order")} that got in also cost a take and an add, on a board of just ${K}.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const p = +b.dataset.i;
        if (p !== correct) { wrong = p; paint(); return; }
        wrong = null;
        said = s.keep ? `The ${s.top} leaves and the ${s.x} goes in. The board puts the smallest back on top: now the ${s.after[0]}.` : `Dropped. The ${s.x} is smaller than the ${s.top}, so the board does not change.`;
        j++;
        paint();
        if (j === NO) done();
      });
    };
    paint();
  }

  /* 8. The best three, as code. */
  const CODE2 = [
    "const best = []; // smallest on top",
    "for (const order of orders) {",
    `  if (best.length < ${K}) push(best, order);`,
    "  else if (order > best[0]) {",
    "    take(best); // drop the smallest",
    "    push(best, order);",
    "  }",
    "}",
    `// best[0] is the ${K === 3 ? "3rd" : K + "th"} biggest order`
  ];
  const FR2 = (() => {
    const fr = [{ ln: 0, j: -1, h: [], say: `<code>push</code> and <code>take</code> are the two moves from the ticket board. Here the board starts empty.` }];
    KS.forEach(s => {
      if (s.direct) { fr.push({ ln: 2, j: s.j, h: s.after, hc: { [s.after.indexOf(s.x)]: "enter" }, say: `order = ${s.x}. Fewer than ${K} on the board, so it goes straight in.` }); return; }
      fr.push({ ln: 3, j: s.j, h: s.before, hc: { 0: "next" }, say: s.keep ? `order = ${s.x}. ${s.x} > ${s.top}: it beats the smallest of the best.` : `order = ${s.x}. ${s.x} > ${s.top} is false: dropped, one look.` });
      if (!s.keep) return;
      const mid = take(s.before);
      fr.push({ ln: 4, j: s.j, h: mid, hc: {}, say: `take() removes the ${s.top}. The board repairs itself: the ${mid[0]} is on top.` });
      fr.push({ ln: 5, j: s.j, h: s.after, hc: { [s.after.indexOf(s.x)]: "enter" }, say: `push() adds the ${s.x}. Smallest on top: the ${s.after[0]}.` });
    });
    fr.push({ ln: 8, j: NO, h: BEST, hc: { 0: "enter" }, say: `The loop ends. best[0] = ${BEST[0]}, the ${K === 3 ? "3rd" : K + "th"} biggest order, and the board holds ${BEST_SORTED.join(", ")}: what you kept by hand.` });
    return fr;
  })();
  function bestCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR2[i], seen = f.j < 0 ? 0 : f.j;
      el.innerHTML = `<h1>The best ${K}, as code</h1>
        <p class="lead">Nothing new here. <code>orders</code> is the month's list, and <code>best</code> is the small board.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the pictures.</p>
        ${kit.pics.row1d(ORDERS, { cls: streamCls(seen, f.h, f.j < NO ? f.j : -1), labels: false, title: "orders" })}
        ${f.h.length ? board(kit, f.h, { array: true, cls: f.hc || {}, title: "best" }) : `<div class="lp lp-tree"><div class="lp-cap">best (empty)</div></div>`}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>order <b>${f.j >= 0 && f.j < NO ? ORDERS[f.j] : "–"}</b></span><span>best[0] <b>${f.h.length ? f.h[0] : "–"}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        ${stepsBar}`;
      const pv = el.querySelector("[data-prev]"), nx = el.querySelector("[data-next]");
      pv.disabled = i === 0; nx.disabled = i === FR2.length - 1;
      pv.onclick = () => { i--; paint(); };
      nx.onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A website's monitor reads page-load times from a log that never stops. Its alert panel lists the 5 slowest loads seen so far.", true,
      "Yes. This is the best orders again, with \"best\" meaning slowest. Only 5 loads are ever kept, and a new one only matters if it is slower than the fastest of those five.",
      "The log never ends, so you cannot keep it all, but you do not need to: only 5 loads are kept. A new load gets in only if it is slower than the fastest of those five, which is exactly the best-orders board."],
    ["A print server always prints the shortest waiting job next. New jobs keep arriving while it prints.", true,
      "Yes. Always take the smallest while new items keep arriving: a heap ordered by job length gives the next job from the top, and takes a new job in a few swaps.",
      "This is the ticket tray again: always take the smallest, while new ones keep coming in. A heap ordered by job length gives the next job from the top and takes a new job in a few swaps."],
    ["A list of 5,000 house prices is loaded once and never changes. The app needs the cheapest price, one time.", false,
      "No. To build a heap you place every one of the 5,000 prices, so it already costs at least the 5,000 looks of one plain pass. One question and no new items: the plain pass wins. A heap pays off when you take the smallest again and again while items change.",
      "Building the heap means placing every one of the 5,000 prices, so it already costs at least the 5,000 looks of one plain pass, before the one-look top helps at all. With one question and no new items, the plain pass wins."],
    ["A contacts app keeps names in a heap, A on top. It must check whether the name Mira is in it.", false,
      "No. The heap only promises that each name comes no later than the names under it. Mira could hang under either branch at any depth, so the search can still read every name. To ask \"is it here?\", a Set answers in one look.",
      "The heap only promises that each name comes no later than the names under it. It says nothing about left against right, so Mira could hang under either branch at any depth, and the search can still read every name. A Set answers \"is it here?\" in one look."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a heap help here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the tailor's shop.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. On to the problems: the groups this lesson taught first. */
  const TAUGHT = {
    "take-the-top": "You did this with the tailor's tickets: the soonest always waits on top, and taking it or adding one only walks one path.",
    "keep-best-k": "You did this with the three biggest orders: a small heap with the weakest of the best on top, so it is the one a newcomer has to beat."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  const qRights = steps => steps.map(() => "[data-right]");
  LessonKit.define("heap", {
    title: "Heap / priority queue",
    teaches: ["take-the-top", "keep-best-k"],
    screens: [slowWay, spotTop, takeTop, addTicket, asCode, spotWeakest, keepBest, bestCode, recognise, toProblems],
    walk: [
      { wrong: [`[data-i="${TRAY[0].at === 0 ? 1 : 0}"]`], right: TRAY.map(r => `[data-i="${r.at}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: TAKES.map((t, k) => [...qRights(t.steps), ...(k < TAKES.length - 1 ? ["[data-next]"] : [])]).flat() },
      { wrong: ["[data-wrong]"], right: ADDS.map((t, k) => [...qRights(t.steps), ...(k < ADDS.length - 1 ? ["[data-next]"] : [])]).flat() },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(NO - K).fill("[data-right]") },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
