/* Lesson: stack. A proofreader checks the brackets in a maths textbook exercise (the newest open bracket is the
   only one a closer may close: keep a pile), then trail signs on a ridge of hills (a higher hill answers every
   lower hill waiting on top of the pile). Every number on screen is computed here from LINE and H.
   Plain browser script. */
(() => {
  const LINE = "{[()]([])()}".split(""), N = LINE.length;
  const OPENER = { ")": "(", "]": "[", "}": "{" }, CLOSER = { "(": ")", "[": "]", "{": "}" };
  const isOpen = c => !!CLOSER[c];
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const escH = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");   // kit is not here at the top level
  const G = c => `<code>${escH(c)}</code>`;   // a bracket shown inside prose
  const andList = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  // the slow way crosses out one pair per pass and reads every bracket still on the line each pass
  const slowReads = n => { let s = 0; for (let left = n; left > 0; left -= 2) s += left; return s; };
  const SLOW = slowReads(N);
  const bigSlow = n => n * (n + 2) / 4;   // the same sum for an even n, in closed form
  const nextAlive = (alive, i, d) => { for (let j = i + d; j >= 0 && j < N; j += d) if (alive[j]) return j; return -1; };
  // the bracket that sits right next to i (crossed-out ones skipped) if it is i's partner, else -1
  const partnerOf = (alive, i) => {
    const j = nextAlive(alive, i, isOpen(LINE[i]) ? 1 : -1);
    if (j < 0) return -1;
    const [o, c] = isOpen(LINE[i]) ? [i, j] : [j, i];
    return isOpen(LINE[o]) && OPENER[LINE[c]] === LINE[o] ? j : -1;
  };
  const SLOW_TAPS = (() => {
    const a = LINE.map(() => true), out = [];
    for (let k = 0; k < N / 2; k++) {
      const i = a.findIndex((v, x) => v && isOpen(LINE[x]) && partnerOf(a, x) >= 0), j = partnerOf(a, i);
      out.push(i); a[i] = a[j] = false;
    }
    return out;
  })();
  // one read with a pile: before each bracket, the positions waiting on the pile
  const READ = (() => {
    const out = [], pile = [];
    LINE.forEach((ch, i) => {
      out.push({ i, ch, pile: pile.slice(), act: isOpen(ch) ? "push" : "pop" });
      if (isOpen(ch)) pile.push(i); else pile.pop();
    });
    out.push({ i: N, pile: pile.slice(), fin: true });
    return out;
  })();
  // a second line from the book with one wrong closer: the first closer that meets the wrong top, and the pile before it
  const LINE2 = "{[(])}".split("");
  const BAD = (() => {
    const pile = [];
    for (let i = 0; i < LINE2.length; i++) {
      const c = LINE2[i];
      if (isOpen(c)) { pile.push(i); continue; }
      if (!pile.length || LINE2[pile[pile.length - 1]] !== OPENER[c]) return { i, ch: c, pile: pile.slice() };
      pile.pop();
    }
    return null;
  })();
  // local styles (promote to the shared module later): two-line sign labels under bars, a shorter waiting pile on a phone
  const ensureStyle = () => {
    if (document.getElementById("lx-stack")) return;
    const s = document.createElement("style");
    s.id = "lx-stack";
    s.textContent = `.lx-stack-r .under span { white-space: pre-line; line-height: 1.35; }
@media (max-width: 620px) {
  .lx-stack-r .lp-stk, .lx-stack-r .lp-stl { gap: 4px; }
  .lx-stack-r .lp-stk .lp-face, .lx-stack-r .lp-stl span { height: 30px; }
  .lx-stack-r .lp-stk .lp-face { font-size: 14px; }
}`;
    document.head.appendChild(s);
  };
  // line colours for a pile state: on the pile = solid, read and closed = faint
  const lineCls = (upTo, pile) => {
    const c = {};
    for (let j = 0; j < upTo; j++) c[j] = pile.includes(j) ? "in" : "gone";
    return c;
  };

  /* 1. The slow way: cross out a pair with nothing between, then read the line again. */
  function slowWay({ el, done, kit }) {
    const alive = LINE.map(() => true);
    let reads = 0, passes = 0, last = null, miss = null;
    const paint = () => {
      const left = alive.filter(Boolean).length, fin = left === 0, cls = {};
      LINE.forEach((_, i) => { cls[i] = fin ? "enter" : alive[i] ? "" : "gone"; });
      if (last && !fin) cls[last[0]] = cls[last[1]] = "leave";
      if (miss != null) cls[miss] = "no";
      let missTxt = "";
      if (miss != null) {
        const c = LINE[miss], op = isOpen(c), j = nextAlive(alive, miss, op ? 1 : -1);
        missTxt = op
          ? `Right after this ${G(c)} comes a ${G(LINE[j])}, not its partner ${G(CLOSER[c])}. Its partner is further along, with other brackets between. Cross out a pair with nothing between them first.`
          : j < 0 ? `Nothing still on the line comes before this ${G(c)}, so it has no partner yet.`
          : `Right before this ${G(c)} comes a ${G(LINE[j])}, not its partner ${G(OPENER[c])}. Cross out a pair with nothing between them first.`;
      }
      el.innerHTML = `<h1>Brackets in a maths textbook</h1>
        <p class="lead">You proofread a school maths textbook. In one long exercise the numbers are fine, so you only check the brackets: every ${G("(")} needs a ${G(")")}, every ${G("[")} a ${G("]")}, every ${G("{")} a ${G("}")}. A pair may hold other pairs inside it, but may never cut one in half: ${G("( [ ] )")} is fine, ${G("( [ ) ]")} is not. Below are just the brackets. Reading one bracket counts as one read.</p>
        <p class="task">The slow way: tap a bracket whose partner sits right next to it, and both are crossed out. Then you read the whole line again to find the next pair. Go until the line is empty.</p>
        ${kit.pics.row1d(LINE, { cls, pick: fin ? false : i => alive[i] })}
        <div class="lpanel">
          ${passes ? `<div class="sum">${fmt(reads)} reads<small>${passes} ${passes === 1 ? "pass" : "passes"} over the line</small></div>` : ""}
          ${miss != null ? kit.feedback(missTxt, false)
            : fin ? kit.feedback(`The line is empty, so every bracket had its partner: no typo. It took ${N / 2} passes and <b>${SLOW} reads</b> for ${N} brackets, and each pass read again brackets that had not changed. A line of 1,000 brackets would take ${fmt(bigSlow(1000))} reads this way.`, true)
            : last ? kit.feedback(`Crossed out ${G(LINE[last[0]] + " " + LINE[last[1]])} at positions ${last[0]} and ${last[1]}. That pass read ${last[2]} brackets. ${plural(left, "bracket")} left, and the next pass reads them all again.`)
            : ""}
        </div>`;
      el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
        const i = +b.dataset.i, j = partnerOf(alive, i);
        if (j < 0) { miss = i; paint(); return; }
        miss = null;
        const n = alive.filter(Boolean).length;
        reads += n; passes++;
        alive[i] = alive[j] = false;
        last = [Math.min(i, j), Math.max(i, j), n];
        paint();
        if (!alive.some(Boolean)) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: a closer can only close the newest bracket still open. */
  const P = LINE.findIndex((c, i) => i > 0 && !isOpen(c) && !isOpen(LINE[i - 1]));
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const st = READ[P], open = st.pile.map(j => LINE[j]), top = open[open.length - 1], ch = LINE[P];
    const closed = [];
    for (let j = 0; j < P; j++) if (!st.pile.includes(j)) closed.push(j);
    const opts = [`A ${G(OPENER[ch])} was opened somewhere before it`, "So far there are more openers than closers, so something is left to close", `The newest bracket still open is a ${G(OPENER[ch])}`];
    const correct = 2;
    const paint = () => {
      const ok = ans === correct, cls = lineCls(P, st.pile);
      cls[P] = "next";
      el.innerHTML = `<h1>Read the line once</h1>
        <p class="lead">A plan: read left to right, once. Brackets that already met their partner are struck through. The filled ones, ${andList(open.map(G))}, are still open and waiting for a partner. Next comes the ${G(ch)} at position ${P}, outlined.</p>
        <p class="task">Which single check tells you this ${G(ch)} is not a typo?</p>
        ${kit.pics.row1d(LINE, { cls })}
        ${ok ? kit.pics.stack(open, { title: "the open brackets, newest on top", cls: { [open.length - 1]: "in" } }) : ""}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The ${andList(closed.map(j => G(LINE[j])))} at ${andList(closed.map(String))} already closed each other. Of the brackets still open, the ${G(top)} was opened last, so it is the innermost one, and a ${G(ch)} must close it before anything outside it closes. So keep the open brackets in a pile, newest on top. Each closer looks only at the top.`, true)
          : ans === 0 ? kit.feedback(`Take ${G("[ ( ]")}. A ${G("[")} was opened before the ${G("]")}, but the ${G("(")} is still open inside it. That ${G("]")} would cut the ${G("(")} in half. What matters is the newest open bracket, not any one.`, false)
          : kit.feedback(`Take ${G("( [ )")}. Two openers and one closer, so something is left to close, yet the ${G(")")} cannot close the ${G("(")} while the ${G("[")} is still open inside it. Counting forgets which kind is open, and in which order.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Use the pile yourself, predicting each move; then feel the saving at real sizes. */
  function usePile({ el, done, kit }) {
    let k = 0, wrong = null, said = null, n = 1000, t2 = null;
    const opts = ["Put it on the pile", "Take the top off: it is the partner", "Mark a typo: it is not the partner"];
    const paint = () => {
      const st = READ[k], fin = !!st.fin, pile = st.pile.map(j => LINE[j]), top = pile[pile.length - 1];
      if (fin) { paintTypo(); return; }
      const correct = st.act === "push" ? 0 : 1;
      const cls = lineCls(k, st.pile);
      cls[k] = "next";
      const prev = k > 0 ? READ[k - 1] : null;
      const scls = {}, move = prev && prev.act === "pop" ? { v: `${LINE[prev.pile[prev.pile.length - 1]]} ${prev.ch}`, dir: "out" } : null;
      if (prev && prev.act === "push") scls[pile.length - 1] = "enter";
      el.innerHTML = `<h1>Keep a pile of open brackets</h1>
        <p class="lead">Same line. Read each bracket once. An opener goes on top of the pile. A closer looks at the top only.</p>
        <p class="task">Next: ${G(st.ch)} at position ${k}, outlined. ${pile.length ? `Top of the pile: ${G(top)}.` : "The pile is empty."} What do you do?</p>
        ${kit.pics.row1d(LINE, { cls })}
        ${kit.pics.stack(pile, { cls: scls, move, empty: "empty pile", title: "the pile" })}
        <div class="lpanel">${kit.options(opts, { picked: wrong, correct })}
        ${wrong != null ? kit.feedback(st.act === "push"
            ? `${G(st.ch)} opens a pair, so there is nothing for it to close. It goes on the pile and waits for its ${G(CLOSER[st.ch])}.`
            : wrong === 0 ? `${G(st.ch)} closes a pair. On the pile it would wait for nothing. Compare it with the top, the ${G(top)}.`
            : `The top is ${G(top)}, and ${G(st.ch)} is exactly its partner. They match, so the ${G(top)} comes off.`, false)
          : said ? kit.feedback(said[0], said[1]) : ""}
        ${kit.meter([{ label: "Reading again after each pair", value: SLOW, max: SLOW }, { label: "One read with a pile", value: k, max: SLOW, good: true }])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (st.act === "push") said = [`${G(st.ch)} waits on top of the pile.`];
        else {
          const under = pile[pile.length - 2];
          said = [`${G(top + " " + st.ch)} is a pair. The ${G(top)} comes off, and ${under ? `the ${G(under)} is on top again, the next one waiting` : "the pile is empty"}.`];
        }
        k++;
        if (k === N) said = [`Done in <b>${N} reads</b>, one per bracket. Every closer found its partner on top, and the pile is empty at the end, so no opener was left unclosed: no typo. The slow way read ${SLOW} times on the same line. A pile you only touch at the top is called a <b>stack</b>: last in, first out. The bracket put on last is the first one taken off.`, true];
        paint();
      });
    };
    // after the clean line: one line with a wrong closer, where marking a typo is the right move
    const paintTypo = () => {
      const b = BAD.i, ch = BAD.ch, p2 = BAD.pile.map(j => LINE2[j]), top = p2[p2.length - 1], ok = t2 === 2;
      const cls = {};
      for (let j = 0; j < b; j++) cls[j] = BAD.pile.includes(j) ? "in" : "gone";
      cls[b] = ok ? "no" : "next";
      el.innerHTML = `<h1>Keep a pile of open brackets</h1>
        <p class="lead">The first line is done.</p>
        ${kit.feedback(said[0], true)}
        ${kit.meter([{ label: "Reading again after each pair", value: SLOW, max: SLOW }, { label: "One read with a pile", value: N, max: SLOW, good: true }])}
        <p class="task">Another exercise in the book: ${G(LINE2.join(""))}. You read it the same way and reach the ${G(ch)} at position ${b}, outlined. Top of the pile: ${G(top)}. What do you do?</p>
        ${kit.pics.row1d(LINE2, { cls })}
        ${kit.pics.stack(p2, { cls: ok ? { [p2.length - 1]: "no" } : {}, empty: "empty pile", title: "the pile" })}
        <div class="lpanel">${kit.options(opts, { picked: t2, correct: 2 })}
        ${t2 == null ? "" : ok
          ? kit.feedback(`Right: a typo. ${G(ch)} needs a ${G(OPENER[ch])} on top, but the top is ${G(top)}, still open. Closing now would cut the ${G(top)} in half. One look at the top caught it, without reading the rest. Now make the line longer:`, true)
          : t2 === 0 ? kit.feedback(`${G(ch)} closes a pair, so it never waits on the pile. Compare it with the top, the ${G(top)}.`, false)
          : kit.feedback(`The top is ${G(top)}, whose partner is ${G(CLOSER[top])}, not ${G(ch)}. Taking it off would treat the ${G(top)} as closed when nothing closed it.`, false)}
        ${ok ? `<div class="sliders"><label>Brackets on the line <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => { t2 = +bt.dataset.i; paint(); if (t2 === 2) done(); });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const s = bigSlow(n);
        el.querySelector("#big").innerHTML = `${fmt(s)} vs ${fmt(n)}<small>reads at worst when reading again after each pair, against one read with a pile. That is about ${fmt(Math.round(s / n))} times fewer reads, and the gap grows with the line.</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code. */
  const CODE1 = [
    "const pile = [];",
    "for (const ch of line) {",
    "  // no entry in openerFor: ch is an opener",
    "  if (!openerFor[ch]) pile.push(ch);",
    "  else if (pile.pop() !== openerFor[ch])",
    "    return false; // a typo",
    "}",
    "return pile.length === 0;"
  ];
  const FR1 = (() => {
    const fr = [{ ln: 0, k: 0, pile: [], ch: "–", say: "The pile starts empty. <code>openerFor</code> (set up before this code) gives each closer the opener it needs: <code>openerFor[\")\"]</code> is <code>\"(\"</code>. An opener has no entry, so <code>!openerFor[ch]</code> means ch is an opener." }];
    READ.forEach(st => {
      if (st.fin) { fr.push({ ln: 7, k: N, pile: st.pile, ch: "–", say: `The loop ends. The pile is empty, so the function returns <code>true</code>: no typo. Had an opener been left on the pile, it would never have been closed, and the answer would be <code>false</code>. On ${G(LINE2.join(""))} from the last screen, <code>pile.pop()</code> at the "${BAD.ch}" gives "${LINE2[BAD.pile[BAD.pile.length - 1]]}", so the <code>return false</code> line runs.` }); return; }
      const after = st.act === "push" ? [...st.pile, st.i] : st.pile.slice(0, -1);
      if (st.act === "push") fr.push({ ln: 3, k: st.i + 1, cur: st.i, pile: after, ch: st.ch, say: `ch = "${st.ch}". It is not a closer, so it goes on the pile.` });
      else {
        const top = LINE[st.pile[st.pile.length - 1]];
        fr.push({ ln: 4, k: st.i + 1, cur: st.i, pile: after, ch: st.ch, say: `ch = "${st.ch}". <code>pile.pop()</code> takes off "${top}", the opener it needs, so no return. Any other top would be a typo: <code>return false</code>.` });
      }
    });
    return fr;
  })();
  function asCode1({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = lineCls(f.k, f.pile), pile = f.pile.map(j => LINE[j]);
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">Nothing new here. <code>line</code> is the brackets, and a JavaScript array is the pile: <code>push</code> puts on top, <code>pop</code> takes the top off.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the picture.</p>
        ${kit.pics.row1d(LINE, { cls, ptrs: f.cur != null ? { [f.cur]: "ch" } : {} })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>ch <b>${kit.esc(f.ch)}</b></span><span>pile <b>[${kit.esc(pile.map(c => `"${c}"`).join(", "))}]</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 5. A second idea: trail signs on a ridge, the slow way. */
  const H = [640, 910, 820, 730, 690, 560, 760, 950], M = H.length;
  const NAMES = H.map((_, i) => String.fromCharCode(65 + i));
  const SCAN = H.map((h, i) => { let c = 0; for (let j = i + 1; j < M; j++) { c++; if (H[j] > h) return { to: j, c }; } return { to: -1, c }; });
  const SLOW2 = SCAN.reduce((a, s) => a + s.c, 0);
  // two-line labels under the bars: the hill's name, then its sign (muted ink, not the accent), or "none" once known
  const signLabels = (sign, names = NAMES, none = new Set()) => sign.map((t, i) => `${names[i]}\n${t >= 0 ? `→${names[t]}` : none.has(i) ? "none" : "\u00a0"}`);
  const waitPile = (pile, cls = {}) => kit => kit.pics.stack(pile.map(j => H[j]), { cls, labels: Object.fromEntries(pile.map((j, x) => [x, NAMES[j]])), empty: "empty pile", title: "waiting" });
  // the pile, decision by decision: before each one, the new hill i, the waiting pile and the signs so far
  const DEC = (() => {
    const out = [], pile = [], sign = Array(M).fill(-1);
    let cmp = 0;
    for (let i = 0; i < M; i++) {
      while (pile.length && H[i] > H[pile[pile.length - 1]]) {
        out.push({ i, pile: pile.slice(), sign: sign.slice(), act: "pop", cmp });
        cmp++; sign[pile.pop()] = i;
      }
      out.push({ i, pile: pile.slice(), sign: sign.slice(), act: "push", cmp });
      if (pile.length) cmp++;
      pile.push(i);
    }
    return { out, cmp, pile, sign };
  })();
  const PILE_CMP = DEC.cmp;
  function slowRidge({ el, done, kit }) {
    ensureStyle();
    const sign = Array(M).fill(-1), seen = new Set();
    let cur = null, total = 0;
    const paint = () => {
      const all = seen.size === M, cls = {};
      if (cur != null) {
        for (let j = cur + 1; j <= (SCAN[cur].to < 0 ? M - 1 : SCAN[cur].to); j++) cls[j] = "in";
        cls[cur] = "in";
        if (SCAN[cur].to >= 0) cls[SCAN[cur].to] = "enter";
      }
      const s = cur == null ? null : SCAN[cur];
      el.innerHTML = `<h1>Trail signs on a ridge</h1>
        <p class="lead">A stack also solves a different kind of job: for each item, find the next one that beats it. You put up signs on a ridge walk. The trail crosses ${M} hills, ${NAMES[0]} to ${NAMES[M - 1]}, and each bar is one hill's height in metres. The sign on each hill names the next hill along the trail that is higher than it. Comparing two heights counts as one comparison.</p>
        <p class="task">Tap a hill to walk on from it, comparing each hill after it, until one is higher. Make a sign for every hill.</p>
        <div class="lx-stack-r">${kit.bars(H, { cls, pick: !all, labels: signLabels(sign, NAMES, new Set([...seen].filter(i => sign[i] < 0))), frames: cur == null ? [] : [[cur, 1]] })}</div>
        <div class="lpanel">
          ${seen.size ? `<div class="sum">${total} comparisons<small>${seen.size} of ${M} signs made</small></div>` : ""}
          ${all ? kit.feedback(`All ${M} signs in <b>${SLOW2} comparisons</b>. Hill ${NAMES[1]} alone needed ${SCAN[1].c}: it walked past ${andList(NAMES.slice(2, SCAN[1].to))} before reaching ${NAMES[SCAN[1].to]}. Then ${NAMES[2]} walked past most of the same hills again. On a long trail that keeps going down, the walks add up fast.`, true)
            : s ? kit.feedback(s.to < 0 ? `${NAMES[cur]} (${H[cur]} m): ${s.c ? `no hill after it is higher, ${plural(s.c, "comparison")}` : "it is the last hill, so there is nothing to compare"}. Its sign stays empty.` : `${NAMES[cur]} (${H[cur]} m): the next higher hill is ${NAMES[s.to]} (${H[s.to]} m), after ${plural(s.c, "comparison")}.`) : ""}
        </div>`;
      el.querySelectorAll(".col").forEach(c => c.onclick = () => {
        const i = +c.dataset.i;
        cur = i;
        if (!seen.has(i)) { seen.add(i); total += SCAN[i].c; sign[i] = SCAN[i].to; }
        paint();
        if (seen.size === M) done();
      });
    };
    paint();
  }

  /* 6. Spot the trick: the waiting hills always go down, so a new hill checks only the top. */
  const TI = DEC.out.findIndex((d, x) => d.act === "pop" && DEC.out.filter(e => e.i === d.i && e.act === "pop").length >= 2 && DEC.out.find(e => e.i === d.i && e.act === "push").pile.length > 0);
  const TD = DEC.out[TI];
  function spotRidge({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const i = TD.i, pile = TD.pile;
    const pops = pile.slice().reverse().filter(j => H[j] < H[i]), stop = pile.slice().reverse().find(j => H[j] >= H[i]);
    const left = pile.filter(j => !pops.includes(j)).concat(i);   // the pile once the right answer is played out
    const gone = H.map((_, j) => j).filter(j => j < i && !pile.includes(j)), ahead = H.map((_, j) => j).filter(j => j > i);
    const opts = [`All ${pile.length} waiting hills`, `${andList(pops.map(j => NAMES[j]))}, then stop at ${NAMES[stop]}`, `Only ${NAMES[pile[0]]}, the highest one`];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct, cls = {};
      for (let j = 0; j < i; j++) cls[j] = pile.includes(j) ? "in" : "gone";
      if (ok) pops.forEach(j => { cls[j] = "enter"; });
      const sign = TD.sign.slice();
      if (ok) pops.forEach(j => { sign[j] = i; });
      el.innerHTML = `<h1>Hills waiting for a sign</h1>
        <p class="lead">A plan: walk the trail once. A hill waits on a pile until a higher hill comes along. You are now at ${NAMES[i]} (${H[i]} m), framed. ${andList(gone.map(j => `${NAMES[j]} already got its sign from ${NAMES[TD.sign[j]]}`))} and left. ${andList(pile.map(j => NAMES[j]))} are still waiting on the pile. ${andList(ahead.map(j => NAMES[j]))} ${ahead.length > 1 ? "are" : "is"} not reached yet. The key under the chart shows each kind of bar.</p>
        <p class="task">Which waiting hills do you have to compare ${NAMES[i]} with?</p>
        <div class="lx-stack-r">${kit.pics.side(kit.bars(H, { cls, labels: signLabels(sign), frames: [[i, 1]] }) + kit.pics.key([["in", "waiting on the pile"], ["gone", "has its sign"], ["enter", `gets its sign from ${NAMES[i]} now`], ["", "not on the pile"]].filter(([st]) => !st || Object.values(cls).includes(st))), ok ? waitPile(left, { [left.length - 1]: "accent" })(kit) : waitPile(pile)(kit))}</div>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${NAMES[i]} is higher than ${andList(pops.map(j => `${NAMES[j]} (${H[j]})`))}, so they get their sign and leave the pile. ${NAMES[stop]} (${H[stop]}) is higher than ${NAMES[i]}. A hill only stays waiting while nothing after it is higher. So the heights on the pile get smaller from bottom to top, and everything under ${NAMES[stop]} is higher than ${NAMES[stop]}. Stop at the first higher hill, then put ${NAMES[i]} on top to wait: it is ringed on the pile.`, true)
          : ans === 0 ? kit.feedback(`Once ${NAMES[i]} meets ${NAMES[stop]} (${H[stop]} m), which is higher, you can stop. Every hill under ${NAMES[stop]} on the pile is higher than ${NAMES[stop]}, so ${NAMES[i]} cannot be its answer either.`, false)
          : kit.feedback(`${NAMES[pile[0]]} (${H[pile[0]]} m) is higher than ${NAMES[i]}, so ${NAMES[i]} is not its answer. But ${andList(pops.map(j => `${NAMES[j]} (${H[j]})`))} ${pops.length > 1 ? "are" : "is"} lower, and ${NAMES[i]} is the first higher hill after them.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. Run the pile yourself, one decision at a time; then feel the saving at real sizes. */
  function useRidge({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null, said = null, n = 1000;
    const paint = () => {
      const fin = k === DEC.out.length, d = fin ? null : DEC.out[k];
      const pile = fin ? DEC.pile : d.pile, sign = fin ? DEC.sign : d.sign, i = fin ? -1 : d.i;
      const top = pile.length ? pile[pile.length - 1] : -1, correct = fin ? -1 : d.act === "pop" ? 0 : 1;
      const cls = {};
      const upTo = fin ? M : i;
      for (let j = 0; j < upTo; j++) cls[j] = pile.includes(j) ? "in" : "gone";
      const prev = k > 0 ? DEC.out[k - 1] : null;
      if (prev && prev.act === "pop") cls[prev.pile[prev.pile.length - 1]] = "enter";
      const cmpNow = fin ? PILE_CMP : d.cmp;
      const opts = fin ? [] : [`Give ${top >= 0 ? NAMES[top] : "the top"} its sign`, `Put ${NAMES[i]} on the pile`];
      el.innerHTML = `<h1>Walk the ridge once</h1>
        <p class="lead">Same hills. A new hill compares itself with the top of the pile only. If it is higher, the top gets its sign and leaves. If not, the new hill goes on top and waits.</p>
        ${fin ? "" : `<p class="task">At ${NAMES[i]} (${H[i]} m). ${top >= 0 ? `Top of the pile: ${NAMES[top]} (${H[top]} m).` : "The pile is empty."} What next?</p>`}
        <div class="lx-stack-r">${kit.pics.side(kit.bars(H, { cls, labels: signLabels(sign, NAMES, new Set(fin ? DEC.pile : [])), frames: fin ? [] : [[i, 1]] }), waitPile(pile)(kit))}</div>
        <div class="lpanel">${fin ? "" : kit.options(opts, { picked: wrong, correct })}
        ${wrong != null ? kit.feedback(d.act === "push"
            ? top < 0 ? `The pile is empty: no hill is waiting for a sign. ${NAMES[i]} goes on the pile.`
              : `${NAMES[i]} (${H[i]} m) is not higher than ${NAMES[top]} (${H[top]} m), so it cannot be ${NAMES[top]}'s next higher hill. ${NAMES[i]} waits on top.`
            : `${NAMES[i]} (${H[i]} m) is higher than ${NAMES[top]} (${H[top]} m), so ${NAMES[i]} is the hill ${NAMES[top]} was waiting for. Give the sign before ${NAMES[i]} goes on the pile.`, false)
          : said ? kit.feedback(said[0], said[1]) : ""}
        ${kit.meter([{ label: "Walking on from every hill", value: SLOW2, max: SLOW2 }, { label: "One walk with a pile", value: cmpNow, max: SLOW2, good: true }])}
        ${fin ? `<div class="sliders"><label>Hills on the trail <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        said = d.act === "pop" ? [`${NAMES[top]}'s sign: ${NAMES[i]}. ${NAMES[top]} leaves the pile, and ${NAMES[i]} compares with the new top.`]
          : [`${NAMES[i]} waits on top of the pile.`];
        k++;
        if (k === DEC.out.length) {
          const left = DEC.pile.map(j => NAMES[j]);
          said = [`Done in <b>${PILE_CMP} comparisons</b> instead of ${SLOW2}, the same signs as before. Every hill went on the pile once and left at most once. A stack whose heights get smaller toward the top like this is called a <b>monotonic stack</b>. ${andList(left)} ${left.length > 1 ? "are" : "is"} still waiting: no higher hill comes after, so ${left.length > 1 ? "their signs stay" : "its sign stays"} empty. Now make the trail longer:`, true];
        }
        paint();
        if (k === DEC.out.length) done();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const s = n * (n - 1) / 2, p = 2 * (n - 1);
        el.querySelector("#big").innerHTML = `${fmt(s)} vs ${fmt(p)}<small>comparisons at worst for each. Walking on from every hill takes ${fmt(s)} on a trail that keeps going down. With a pile, each hill costs at most two comparisons, one when it goes on and one when it leaves, so never more than ${fmt(p)}. That is about ${fmt(Math.round(s / p))} times fewer comparisons.</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 8. The pile as code: positions, not heights. */
  const CODE2 = [
    "const sign = []; // hill -> answer",
    "const pile = []; // waiting hills",
    "for (let i = 0; i < h.length; i++) {",
    "  while (pile.length &&",
    "         h[i] > h[pile.at(-1)]) {",
    "    sign[pile.pop()] = i;",
    "  }",
    "  pile.push(i);",
    "}"
  ];
  const FR2 = (() => {
    const fr = [{ ln: 1, i: -1, pile: [], sign: Array(M).fill(-1), say: "<code>h</code> is the heights. The pile holds positions of hills still waiting, and <code>sign</code> fills in as hills get their answer." }];
    DEC.out.forEach(d => {
      if (d.act === "pop") {
        const j = d.pile[d.pile.length - 1], s = d.sign.slice(); s[j] = d.i;
        fr.push({ ln: 5, i: d.i, pile: d.pile.slice(0, -1), sign: s, hit: j, say: `i = ${d.i}. h[${d.i}] = ${H[d.i]} is higher than h[${j}] = ${H[j]}, the top. Pop ${j}: sign[${j}] = ${d.i}, so ${NAMES[j]}'s sign names ${NAMES[d.i]}.` });
      } else {
        const t = d.pile[d.pile.length - 1];
        fr.push({ ln: 7, i: d.i, pile: [...d.pile, d.i], sign: d.sign, say: d.pile.length ? `i = ${d.i}. h[${d.i}] = ${H[d.i]} is not higher than h[${t}] = ${H[t]}, so the while loop stops. Push ${d.i}: ${NAMES[d.i]} waits.` : `i = ${d.i}. The pile is empty, so the while loop does not run. Push ${d.i}: ${NAMES[d.i]} waits.` });
      }
    });
    const pops = DEC.out.filter(d => d.act === "pop").length;
    fr.push({ ln: 8, i: -1, pile: DEC.pile, sign: DEC.sign, fin: true, say: `The loop ends. ${andList(DEC.pile.map(j => `${j} (${NAMES[j]})`))} ${DEC.pile.length > 1 ? "are" : "is"} still on the pile, so ${DEC.pile.length > 1 ? "their signs stay" : "its sign stays"} empty. ${M} pushes and ${pops} pops, the moves you made by hand.` });
    return fr;
  })();
  function asCode2({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR2[i], cls = {}, upTo = f.fin ? M : f.i < 0 ? 0 : f.i;
      for (let j = 0; j < upTo; j++) cls[j] = f.pile.includes(j) ? "in" : "gone";
      if (f.hit != null) cls[f.hit] = "enter";
      const pos = H.map((_, j) => `${j}\u00a0${NAMES[j]}`);   // position and letter, e.g. "1 B"
      el.innerHTML = `<h1>The same walk, written as code</h1>
        <p class="lead">Nothing new here, except the pile holds positions (A is 0, H is ${M - 1}), so a sign can name its hill. <code>pile.at(-1)</code> is the top. The pile is the <code>pile [...]</code> value under the code.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the picture.</p>
        <div class="lx-stack-r">${kit.bars(H, { cls, labels: signLabels(f.sign, pos), frames: f.i >= 0 ? [[f.i, 1]] : [] })}</div>
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>i <b>${f.i < 0 ? (f.fin ? "done" : "–") : f.i}</b></span><span>pile <b>[${f.pile.join(", ")}]</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["An HTML snippet is valid only if every closing tag closes the most recent tag still open, as in &lt;ul&gt;&lt;li&gt;&lt;/li&gt;&lt;/ul&gt;. Check a snippet.", true,
      "Yes. Open tags go on a stack. A closing tag must match the top, exactly like the brackets, and the stack must be empty at the end.",
      "It is the brackets again, with tag names instead of shapes. Open tags go on a stack, and a closing tag must match the top. A closing tag that meets the wrong top is an error."],
    ["A print shop prints jobs strictly in the order customers sent them.", false,
      "No. A stack always hands back the newest item first. Here the oldest job must come out first, and on a stack it sits at the bottom, under every job sent after it. That is a queue: first in, first out.",
      "A stack hands back the newest item first, so the job sent last would print first, and the first customer could wait forever. The oldest job sits at the bottom, and a stack only gives you the top. This needs a queue: first in, first out."],
    ["A list of daily bus-ticket prices. For each day, find the next day the price is lower.", true,
      "Yes. It is the trail signs with lower instead of higher. Days wait on a stack whose prices get bigger toward the top (also a monotonic stack, just the other way). A cheaper day gives every more expensive day on top its answer.",
      "Each day needs the first later day that beats it, which is the trail-sign job with lower instead of higher. Waiting days sit on a stack whose prices get bigger toward the top (also a monotonic stack, just the other way). A cheaper day pops every more expensive day on top."],
    ["A phone logs your step count for each day. For each day, find the biggest step count on any later day.", false,
      "No. This asks for the biggest of all later days, not the first later day that beats this one. Walk the log from the end and keep the biggest count seen so far: one number, no stack.",
      "A stack answers \"the first later day that beats me\". This asks for the biggest of all later days, which is often a different day. Walk the log from the end, keeping the biggest count so far: one number does it, and a stack adds nothing."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a stack help here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the textbook and the ridge.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. On to the problems: the groups this lesson taught first. */
  const TAUGHT = {
    "match-brackets": "You did this with the textbook: each closer checks only the top of the stack of open brackets.",
    "next-bigger-or-smaller": "You did this with the trail signs: a higher hill answers every lower hill waiting on top of a monotonic stack."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1><p>Use a stack when only the newest unfinished item can be settled next. When the oldest must go first, use a queue. When you need the best of everything, keep one running value.</p>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("stack", {
    title: "Stack",
    teaches: ["match-brackets", "next-bigger-or-smaller"],
    screens: [slowWay, spotTrick, usePile, asCode1, slowRidge, spotRidge, useRidge, asCode2, recognise, toProblems],
    walk: [
      { wrong: ['[data-i="0"]'], right: SLOW_TAPS.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(N + 1).fill("[data-right]") },   // the clean line, then the typo line
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { right: H.map((_, i) => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(DEC.out.length).fill("[data-right]") },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
