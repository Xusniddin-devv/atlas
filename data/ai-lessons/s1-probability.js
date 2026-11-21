/* Lesson s1-probability: distributions, mean and spread from counts.
   Story: an office tower with two lift banks, East and West. The facilities team timed 20 waits at each, and both
   average 59.6 s, so the report says they are the same. Tenants on the West side keep arriving late anyway.
   Ideas: (1) counts per range, divided by the total, are a distribution: a chance is read by adding shares, and two
   very different distributions can share one mean; (2) the median is the middle value and ignores how long the long
   waits are, the mean feels every second; the standard deviation is one number for spread and assumes a balanced shape.
   Depth: explain (screens 1-5, 8-10), scratch (screen 6: bins, mean and spread in plain Python, a traced real run),
   library (screen 7: np.histogram, mean, median, std, percentile, a recorded run), when-not (screens 5, 8, 9).
   Runs (no model, no API call): docs/ai-path/runs/s1-probability/ (waits.py -> waits.out.txt = the data, seed 582,
   found by search so both banks have the same total; waits_data.py = that data; scratch.py -> scratch.out.txt =
   the traced `describe`; library.py -> library.out.txt = the NumPy summaries; env.txt).
   Facts checked 2026-11-14 against the NumPy manual (histogram, arange, mean, median, std, percentile, quantile).
   Every number on screen is computed here from EAST, WEST, STUCK, TRACE and RUN.
   Lesson-local picture and CSS (prefix lx-s1-probability-): the timing sheet chips, the dot strip with the
   mean and the mean ± one standard deviation band, the output box. */
(() => {
  const P = "lx-s1-probability-";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  // From docs/ai-path/runs/s1-probability/waits.out.txt (seed 582), seconds, in the order they were timed
  const EAST = [50, 57, 56, 62, 77, 57, 68, 46, 62, 77, 75, 40, 61, 88, 59, 46, 51, 70, 37, 53];
  const WEST = [19, 20, 43, 143, 152, 52, 11, 9, 25, 193, 26, 14, 125, 157, 60, 7, 11, 36, 65, 24];
  const STUCK = 540;                       // library.py: one more East wait, a lift stuck for 9 minutes
  const N = WEST.length, BW = 30, NB = 7, LIMIT = 120, LB = LIMIT / BW;   // bins 0-29 ... 180-209; LB = first bin at 120 s or more
  const binOf = w => Math.floor(w / BW);
  const LAB = i => `${i * BW}–${i * BW + BW - 1}`;
  const LABS = Array.from({ length: NB }, (_, i) => LAB(i));
  const hist = ws => { const c = Array(NB).fill(0); ws.forEach(w => c[binOf(w)]++); return c; };
  const sum = a => a.reduce((s, v) => s + v, 0);
  const mean = a => sum(a) / a.length;
  const sorted = a => a.slice().sort((x, y) => x - y);
  const median = a => { const s = sorted(a), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
  const f1 = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
  const f2 = x => (Math.round(x * 100) / 100).toString();
  const HW = hist(WEST), HE = hist(EAST);
  const LONG_W = WEST.filter(w => w >= LIMIT).length, LONG_E = EAST.filter(w => w >= LIMIT).length;
  const MW = mean(WEST), ME = mean(EAST), MDW = median(WEST), MDE = median(EAST), SW = std(WEST), SE = std(EAST);
  const WS = sorted(WEST), MID = [N / 2 - 1, N / 2];   // positions of the two middle waits in the sorted list
  const EMPTY = HW.indexOf(0);                          // West's one empty bin (90-119)

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}sheet{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0;max-width:560px}
      .${P}chip{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);font-family:var(--mono);font-size:13px;padding:0 4px;font-variant-numeric:tabular-nums}
      button.${P}chip{cursor:pointer}
      button.${P}chip:hover{border-color:var(--ink-2)}
      .${P}chip.gone{color:var(--faint);border-style:dashed}
      .${P}chip.accent{border:3px solid var(--ink);font-weight:700}
      .${P}chip.enter{border:2px solid var(--good);background:var(--good-soft);font-weight:600}
      .${P}chip.no{border:2px solid var(--bad);background:var(--bad-soft)}
      .${P}cap{font-size:12px;color:var(--muted);margin:12px 0 4px}
      .${P}big{font-family:var(--mono);font-size:28px;font-weight:700;color:var(--ink);margin:6px 0}
      .${P}big small{font-family:var(--font);font-size:13px;font-weight:400;color:var(--muted);margin-left:8px}
      .${P}out{font-family:var(--mono);font-size:13px;background:var(--sunk);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;white-space:pre-wrap;word-break:break-word;color:var(--ink)}
      .${P}q{margin-top:14px}
      .${P}hist .chart{height:150px;margin-top:20px}
      .${P}hist .chart.pick button.col{border:1px dashed var(--line);border-bottom:0;border-radius:6px 6px 0 0}
      .${P}strip{position:relative;height:var(--h);margin:4px 0 0;border-bottom:1px solid var(--ink-2);max-width:560px}
      .${P}dot{position:absolute;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:var(--ink)}
      .${P}band{position:absolute;top:0;bottom:0;background:var(--sunk);border-left:2px dashed var(--ink-2);border-right:2px dashed var(--ink-2)}
      .${P}mean{position:absolute;top:-4px;bottom:0;width:0;border-left:2px solid var(--ink)}
      .${P}axis{position:relative;height:18px;font-size:11px;color:var(--muted);max-width:560px;font-family:var(--mono)}
      .${P}axis span{position:absolute;transform:translateX(-50%)}
    `;
    document.head.appendChild(s);
  }

  // The timing sheet: one chip per wait. cls: {i: "accent" | "gone" | "enter" | "no"}; pick(i) makes a chip a button.
  function sheet(kit, waits, { cls = {}, pick = null, title = "" } = {}) {
    return `${title ? `<p class="${P}cap">${kit.esc(title)}</p>` : ""}<div class="${P}sheet">${waits.map((w, i) => pick && pick(i)
      ? `<button type="button" class="${P}chip ${cls[i] || ""}" data-i="${i}" aria-label="${w} seconds">${w}</button>`
      : `<span class="${P}chip ${cls[i] || ""}">${w}</span>`).join("")}</div>`;
  }

  // A histogram: one bar per 30-second bin, with a caption above it.
  const histo = (kit, counts, title, opts = {}) => `<p class="${P}cap">${kit.esc(title)}</p><div class="${P}hist">${kit.bars(counts, { labels: LABS, ...opts })}</div>`;

  // A dot strip on a 0..MAXS seconds line; dots that fall close together stack upward. band: [lo, hi] shaded; mark: the mean.
  const MAXS = 210;
  function strip(kit, waits, { band = null, mark = null, title = "" } = {}) {
    const pos = v => `${Math.max(0, Math.min(100, v / MAXS * 100)).toFixed(2)}%`;
    const level = new Map(), dots = sorted(waits).map(w => { const k = Math.floor(w / 6); const h = level.get(k) || 0; level.set(k, h + 1); return [w, h]; });
    const top = Math.max(...dots.map(d => d[1])) + 1;
    return `${title ? `<p class="${P}cap">${kit.esc(title)}</p>` : ""}<div class="${P}strip" style="--h:${top * 12 + 10}px" aria-label="${kit.esc(title)}">
      ${band ? `<span class="${P}band" style="left:${pos(band[0])};width:calc(${pos(band[1])} - ${pos(band[0])})"></span>` : ""}
      ${mark != null ? `<span class="${P}mean" style="left:${pos(mark)}"></span>` : ""}
      ${dots.map(([w, h]) => `<span class="${P}dot" style="left:${pos(w)};bottom:${h * 12 + 2}px"></span>`).join("")}</div>
      <div class="${P}axis">${[0, 60, 120, 180].map(v => `<span style="left:${pos(v)}">${v}</span>`).join("")}</div>`;
  }

  /* 1. By hand: drop West's 20 waits into 30-second bins. */
  function binWest({ el, done, kit }) {
    css();
    const counts = Array(NB).fill(0);
    let k = 0, miss = null, last = null;
    const paint = () => {
      const fin = k === N, cls = {};
      for (let i = 0; i < k; i++) cls[i] = "gone";
      if (!fin) cls[k] = "accent";
      const w = WEST[k];
      el.innerHTML = `<h1>Two lift banks, one average</h1>
        <p class="lead">An office tower has two banks of lifts, East and West. The facilities team timed ${N} waits at each: seconds from pressing the button to the doors opening. Both banks average <b>${f1(MW)} s</b>, so their report says the banks are the same. Tenants who use the West lifts keep arriving late to meetings anyway. AI products hit the same trap: an average reply time or model score can hide the slow or bad cases. This lesson shows how to see them.</p>
        <p class="task">${fin ? "All West waits are in their bins." : `Sort the West waits into 30-second bins. The ringed wait is <b>${w} s</b>: tap its bin in the chart (each bin is a column, named under it).`}</p>
        ${sheet(kit, WEST, { cls, title: `West timing sheet, ${N} waits in seconds, in the order they were timed` })}
        ${histo(kit, counts, "West: waits per bin (seconds)", { pick: !fin })}
        <div class="lpanel">
          ${fin ? kit.feedback(`Done: ${N} waits, ${N} taps. This chart of counts per range is a <b>histogram</b>. Half of West's waits (${HW[0]}) are under 30 s, a few more run up to ${EMPTY * BW - 1} s, the ${LAB(EMPTY)} bin is empty, and a separate group of ${LONG_W} sits between 2 and 3½ minutes. Below, the lesson binned East's ${N} waits by the same rule: they all fall in ${HE.filter(c => c).length} bins.`, true)
              + histo(kit, HE, "East: waits per bin (seconds)")
            : miss ? kit.feedback(miss, false)
            : last ? kit.feedback(last) : ""}
        </div>`;
      el.querySelectorAll("button.col").forEach(b => b.onclick = () => {
        const p = +b.dataset.i, right = binOf(w);
        last = null; miss = null;
        if (p !== right) {
          miss = w % BW === 0 && p === right - 1
            ? `${w} s is not in ${LAB(p)}: that bin stops at ${p * BW + BW - 1}. Each bin starts at its first number and stops one second before the next bin starts, so ${w} opens the ${LAB(right)} bin.`
            : `${w} s is ${p < right ? "more" : "less"} than anything in ${LAB(p)}. It belongs in ${LAB(right)}.`;
          paint(); return;
        }
        counts[p]++; k++;
        last = `${w} s goes in ${LAB(p)}. That bin now holds ${counts[p]}.`;
        paint();
        if (k === N) done();
      });
    };
    paint();
  }

  /* 2. By hand: read a chance from the counts. */
  function readChance({ el, done, kit }) {
    css();
    const picked = new Set();
    let miss = null, ans = null;
    const LONGBINS = HW.map((c, i) => i).filter(i => i >= LB);
    const opts = [`${LONG_W}`, `${LONG_W} out of ${NB} bins = ${f2(LONG_W / NB)}`, `${LONG_W} out of ${N} = ${f2(LONG_W / N)}`];
    const correct = 2;
    const paint = () => {
      const all = LONGBINS.every(i => picked.has(i)), cls = {};
      picked.forEach(i => { cls[i] = "enter"; });
      if (miss) cls[miss.i] = "no";
      const shares = HW.map(c => f2(c / N));
      el.innerHTML = `<h1>How often is a wait long?</h1>
        <p class="lead">A tenant has a meeting on the 30th floor and wants to know: how likely is a West wait of <b>two minutes (${LIMIT} s) or more</b>?</p>
        <p class="task">${all ? "Now turn the count into a chance." : `Tap every West bin that holds waits of ${LIMIT} s or more.`}</p>
        ${histo(kit, HW, "West: waits per bin (seconds)", { cls, pick: all ? false : i => !picked.has(i) })}
        <div class="lpanel">
          ${all ? `<div class="sum">${LONGBINS.map(i => HW[i]).join(" + ")} = ${LONG_W}<small>West waits of ${LIMIT} s or more</small></div>` : picked.size ? `<div class="sum">${[...picked].sort().map(i => HW[i]).join(" + ")}<small>so far</small></div>` : ""}
          ${miss ? kit.feedback(miss.say, false) : ""}
          ${all ? `<div id="q2" class="${P}q"><p class="task">What is the chance that the next West rider waits ${LIMIT} s or more?</p>${kit.options(opts.map(kit.esc), { picked: ans, correct })}
            ${ans == null ? "" : ans === correct
              ? kit.feedback(`Right: ${f2(LONG_W / N)}, about 1 rider in ${Math.round(N / LONG_W)}. At East it is ${LONG_E} out of ${N} = ${f2(LONG_E / N)}. Divide every bin by the ${N} waits and you get each bin's share: ${shares.join(", ")}. The shares add up to 1. That list of shares is the <b>distribution</b> of West's waits. A chance is the sum of the shares of the bins you care about: ${LONGBINS.map(i => shares[i]).join(" + ")} = ${f2(LONG_W / N)}.`, true)
              : ans === 0 ? kit.feedback(`${LONG_W} is a count, not a chance. ${LONG_W} long waits mean little until you know out of how many: ${LONG_W} out of ${N} is common, ${LONG_W} out of 10,000 would be rare. Divide by the number of waits.`, false)
              : kit.feedback(`The bins are just ranges you chose; another bin width would give another number of bins and another answer. A chance is long waits out of all waits: divide by the ${N} waits.`, false)}</div>` : ""}
        </div>`;
      el.querySelectorAll("button.col").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        miss = null;
        if (i < LB) miss = { i, say: `The ${LAB(i)} bin holds waits shorter than ${LIMIT} s${HW[i] ? "" : ", and it is empty anyway"}. Only the bins from ${LAB(LB)} upward hold waits of two minutes or more.` };
        else picked.add(i);
        paint();
      });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: the same mean, a different shape. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "The averages must be wrong. Time the lifts again.",
      `Same average, different shape. Most West waits are short, but ${LONG_W} in ${N} are two minutes or more, and no East wait is.`,
      `West is better: half its riders wait ${f1(MDW)} s or less.`
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>What the average hides</h1>
        <p class="lead">The report says: “East and West both average ${f1(ME)} s, so neither needs work.”</p>
        ${histo(kit, HE, "East: waits per bin (seconds)")}
        ${histo(kit, HW, "West: waits per bin (seconds)")}
        <p class="task">Which reply to the report is right?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The mean (the ordinary average) squeezes ${N} waits into one number, and two very different distributions can give the same one. East's waits sit close together. West's split into many short waits and a few very long ones, and the long ones are what make people late. To compare or promise anything, look at the whole distribution, not one number from it.`, true)
          : ans === 0 ? kit.feedback(`Both averages are right: East's waits add up to ${sum(EAST)} s and West's to ${sum(WEST)} s, and ${sum(WEST)} ÷ ${N} = ${f1(MW)} for both. The numbers are fine. What the report leaves out is how the waits are spread.`, false)
          : kit.feedback(`True for the typical rider: half of West's waits are ${f1(MDW)} s or less (screen 4 shows how to find that middle value). But that is one more single number. A rider with a meeting cares about the long waits, and at West ${LONG_W} in ${N} take two minutes or more.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Mean or median: find the middle wait by hand, then predict what one stuck lift does to each. */
  function meanMedian({ el, done, kit }) {
    css();
    const got = new Set();
    let miss = null, ans = null;
    const ES = [...EAST, STUCK], MS = mean(ES), MDS = median(ES);
    const opts = ["The median", "The mean", "Both move by about the same"];
    const correct = 1;
    const paint = () => {
      const fin = MID.every(i => got.has(i)), cls = {};
      got.forEach(i => { cls[i] = "enter"; });
      if (miss) cls[miss.i] = "no";
      el.innerHTML = `<h1>The middle wait</h1>
        <p class="lead">Here are West's ${N} waits again, sorted from shortest to longest. The <b>median</b> is the middle of a sorted list: half the waits are at or below it, half at or above. With an even number of waits there are two middle ones, and the median is halfway between them.</p>
        <p class="task">${fin ? "Now predict what one very long wait does." : "Tap the two middle waits."}</p>
        ${sheet(kit, WS, { cls, pick: fin ? null : i => !got.has(i), title: "West, sorted (seconds)" })}
        <div class="lpanel">
          ${miss ? kit.feedback(miss.say, false) : ""}
          ${fin ? kit.feedback(`West's median is (${WS[MID[0]]} + ${WS[MID[1]]}) ÷ 2 = <b>${f1(MDW)} s</b>; its mean is ${f1(MW)} s. East's median is ${f1(MDE)} s, close to its mean. When the median sits far below the mean, a few long values are pulling the mean up.`, true)
            + `<div id="q2" class="${P}q"><p class="task">One morning an East lift is stuck and a rider waits ${STUCK} s, 9 minutes. Add that wait to East's ${EAST.length}. Which number moves more?</p>${kit.options(opts, { picked: ans, correct })}
            ${ans == null ? "" : ans === correct
              ? kit.feedback(`Right. The recorded run gave a mean of ${f1(ME)} → <b>${f1(MS)} s</b> and a median of ${f1(MDE)} → <b>${f1(MDS)} s</b>. The mean adds up every second, so one ${STUCK} s wait drags it ${f1(MS - ME)} s. The median only asks which wait is in the middle, and one extra wait at the end moves the middle by half a place. Quote the median for “how long is a usual wait”. Use the mean when you need totals: the mean × ${ES.length} rides gives back all ${sum(ES)} s that riders lost, and the median cannot.`, true)
              : ans === 0 ? kit.feedback(`The median only looks at which wait is in the middle. Adding one wait at the long end shifts the middle by half a place: ${f1(MDE)} → ${f1(MDS)} s. The mean adds the full ${STUCK} s: ${f1(ME)} → ${f1(MS)} s.`, false)
              : kit.feedback(`They react very differently. The mean adds every second of the ${STUCK} s: ${f1(ME)} → ${f1(MS)} s. The median only moves half a place along the sorted list: ${f1(MDE)} → ${f1(MDS)} s.`, false)}</div>` : ""}
        </div>`;
      el.querySelectorAll(`button.${P}chip`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        miss = null;
        if (MID.includes(i)) got.add(i);
        else miss = { i, say: `${WS[i]} s is wait number ${i + 1} of ${N}: ${i} ${i === 1 ? "wait comes" : "waits come"} before it in the sorted list and ${N - 1 - i} after it. The middle two are numbers ${MID[0] + 1} and ${MID[1] + 1}, with ${MID[0]} waits on each side.` };
        paint();
      });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Spread: the standard deviation, and why it misleads on a lopsided distribution. */
  function spread({ el, done, kit }) {
    css();
    let a1 = null, a2 = null;
    const lo = MW - SW, hi = MW + SW;
    const below = WEST.filter(w => w < lo).length, above = WEST.filter(w => w > hi).length;
    const eLo = ME - SE, eHi = ME + SE, eBelow = EAST.filter(w => w < eLo).length, eAbove = EAST.filter(w => w > eHi).length;
    const o1 = ["West", "East", "The same: they share a mean"], c1 = 0;
    const o2 = ["About 3 below and 3 above", "None: the band holds them all", `${below} below, ${above} above`], c2 = 2;
    const paint = () => {
      const ok1 = a1 === c1;
      el.innerHTML = `<h1>How spread out?</h1>
        <p class="lead">One number for spread is the <b>standard deviation</b>. Take each wait's distance from the mean and square it, so waits below and above the mean both count as positive. Average the squares, then take the square root. The result is in seconds: roughly how far a typical wait sits from the mean.</p>
        ${strip(kit, EAST, { mark: ME, band: ok1 ? [eLo, eHi] : null, title: "East, every wait as a dot (seconds)" })}
        ${strip(kit, WEST, { mark: MW, band: ok1 ? [lo, hi] : null, title: "West, every wait as a dot (seconds)" })}
        <p class="${P}cap">The upright line is the mean${ok1 ? "; the shaded band runs from the mean minus one standard deviation to the mean plus one" : ""}.</p>
        <div id="q1" class="${P}q"><p class="task">Which bank's waits have the bigger standard deviation?</p>${kit.options(o1, { picked: a1, correct: c1 })}
        ${a1 == null ? "" : ok1
          ? kit.feedback(`Right. East: <b>${f1(SE)} s</b>. West: <b>${f1(SW)} s</b>, about ${Math.round(SW / SE)} times as much. West's waits sit far from the mean on both sides: many much shorter, a few much longer.`, true)
          : a1 === 1 ? kit.feedback(`East's dots huddle around the mean, between ${Math.min(...EAST)} and ${Math.max(...EAST)} s. West's run from ${Math.min(...WEST)} to ${Math.max(...WEST)} s, so their distances from the mean are much bigger.`, false)
          : kit.feedback(`A shared mean says nothing about distances from it. East's dots huddle around the line; West's sit far from it on both sides.`, false)}</div>
        ${ok1 ? `<div id="q2" class="${P}q"><p class="task">West's band runs from ${f1(lo)} s to ${f1(hi)} s. How many West waits fall outside it?</p>${kit.options(o2.map(kit.esc), { picked: a2, correct: c2 })}
          ${a2 == null ? "" : a2 === c2
            ? kit.feedback(`Right: every West wait outside the band is on the long side. The band reaches down to ${f1(lo)} s, though no wait was shorter than ${Math.min(...WEST)} s. The band reaches the same distance below the mean as above it, but West is lopsided: most waits bunch at the short end, and a few stretch far out on the long side. East's band, ${f1(eLo)} to ${f1(eHi)} s, has ${eBelow} below and ${eAbove} above: close to balanced, so there the two numbers describe it well. For a lopsided distribution, report the chance over a limit (screen 2) instead.`, true)
            : a2 === 0 ? kit.feedback(`That is what a balanced distribution would give. Count the dots: ${below} West ${below === 1 ? "wait is" : "waits are"} under ${f1(lo)} s, and ${above} are over ${f1(hi)} s. All the far-out waits are long ones.`, false)
            : kit.feedback(`The ${above} waits of ${Math.min(...WEST.filter(w => w > hi))} s and more lie past the band's top end, ${f1(hi)} s. Count the dots right of the shaded band.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { a2 = +b.dataset.i; paint(); if (a2 === c2) done(); });
    };
    paint();
  }

  /* 6. From scratch in plain Python, a traced run (scratch.py -> scratch.out.txt). */
  const CODE1 = [
    "def describe(waits, width):",
    "    counts = {}",
    "    for w in waits:",
    "        b = w // width * width",
    "        counts[b] = counts.get(b, 0) + 1",
    "    n = len(waits)",
    "    mean = sum(waits) / n",
    "    sq = sum((w - mean) ** 2 for w in waits)",
    "    spread = (sq / n) ** 0.5",
    "    return counts, mean, spread"
  ];
  // scratch.out.txt, one row per step: [line about to run (0 = def), return?, counts as [key, value] in dict order, w, b, n, mean, sq, spread]
  const TRACE = [
    [1,0,null,null,null,null,null,null,null], [2,0,[],null,null,null,null,null,null],
    [3,0,[],19,null,null,null,null,null], [4,0,[],19,0,null,null,null,null],
    [2,0,[[0,1]],19,0,null,null,null,null], [3,0,[[0,1]],20,0,null,null,null,null],
    [4,0,[[0,1]],20,0,null,null,null,null], [2,0,[[0,2]],20,0,null,null,null,null],
    [3,0,[[0,2]],43,0,null,null,null,null], [4,0,[[0,2]],43,30,null,null,null,null],
    [2,0,[[0,2],[30,1]],43,30,null,null,null,null], [3,0,[[0,2],[30,1]],143,30,null,null,null,null],
    [4,0,[[0,2],[30,1]],143,120,null,null,null,null], [2,0,[[0,2],[30,1],[120,1]],143,120,null,null,null,null],
    [3,0,[[0,2],[30,1],[120,1]],152,120,null,null,null,null], [4,0,[[0,2],[30,1],[120,1]],152,150,null,null,null,null],
    [2,0,[[0,2],[30,1],[120,1],[150,1]],152,150,null,null,null,null], [3,0,[[0,2],[30,1],[120,1],[150,1]],52,150,null,null,null,null],
    [4,0,[[0,2],[30,1],[120,1],[150,1]],52,30,null,null,null,null], [2,0,[[0,2],[30,2],[120,1],[150,1]],52,30,null,null,null,null],
    [3,0,[[0,2],[30,2],[120,1],[150,1]],11,30,null,null,null,null], [4,0,[[0,2],[30,2],[120,1],[150,1]],11,0,null,null,null,null],
    [2,0,[[0,3],[30,2],[120,1],[150,1]],11,0,null,null,null,null], [3,0,[[0,3],[30,2],[120,1],[150,1]],9,0,null,null,null,null],
    [4,0,[[0,3],[30,2],[120,1],[150,1]],9,0,null,null,null,null], [2,0,[[0,4],[30,2],[120,1],[150,1]],9,0,null,null,null,null],
    [3,0,[[0,4],[30,2],[120,1],[150,1]],25,0,null,null,null,null], [4,0,[[0,4],[30,2],[120,1],[150,1]],25,0,null,null,null,null],
    [2,0,[[0,5],[30,2],[120,1],[150,1]],25,0,null,null,null,null], [3,0,[[0,5],[30,2],[120,1],[150,1]],193,0,null,null,null,null],
    [4,0,[[0,5],[30,2],[120,1],[150,1]],193,180,null,null,null,null], [2,0,[[0,5],[30,2],[120,1],[150,1],[180,1]],193,180,null,null,null,null],
    [3,0,[[0,5],[30,2],[120,1],[150,1],[180,1]],26,180,null,null,null,null], [4,0,[[0,5],[30,2],[120,1],[150,1],[180,1]],26,0,null,null,null,null],
    [2,0,[[0,6],[30,2],[120,1],[150,1],[180,1]],26,0,null,null,null,null], [3,0,[[0,6],[30,2],[120,1],[150,1],[180,1]],14,0,null,null,null,null],
    [4,0,[[0,6],[30,2],[120,1],[150,1],[180,1]],14,0,null,null,null,null], [2,0,[[0,7],[30,2],[120,1],[150,1],[180,1]],14,0,null,null,null,null],
    [3,0,[[0,7],[30,2],[120,1],[150,1],[180,1]],125,0,null,null,null,null], [4,0,[[0,7],[30,2],[120,1],[150,1],[180,1]],125,120,null,null,null,null],
    [2,0,[[0,7],[30,2],[120,2],[150,1],[180,1]],125,120,null,null,null,null], [3,0,[[0,7],[30,2],[120,2],[150,1],[180,1]],157,120,null,null,null,null],
    [4,0,[[0,7],[30,2],[120,2],[150,1],[180,1]],157,150,null,null,null,null], [2,0,[[0,7],[30,2],[120,2],[150,2],[180,1]],157,150,null,null,null,null],
    [3,0,[[0,7],[30,2],[120,2],[150,2],[180,1]],60,150,null,null,null,null], [4,0,[[0,7],[30,2],[120,2],[150,2],[180,1]],60,60,null,null,null,null],
    [2,0,[[0,7],[30,2],[120,2],[150,2],[180,1],[60,1]],60,60,null,null,null,null], [3,0,[[0,7],[30,2],[120,2],[150,2],[180,1],[60,1]],7,60,null,null,null,null],
    [4,0,[[0,7],[30,2],[120,2],[150,2],[180,1],[60,1]],7,0,null,null,null,null], [2,0,[[0,8],[30,2],[120,2],[150,2],[180,1],[60,1]],7,0,null,null,null,null],
    [3,0,[[0,8],[30,2],[120,2],[150,2],[180,1],[60,1]],11,0,null,null,null,null], [4,0,[[0,8],[30,2],[120,2],[150,2],[180,1],[60,1]],11,0,null,null,null,null],
    [2,0,[[0,9],[30,2],[120,2],[150,2],[180,1],[60,1]],11,0,null,null,null,null], [3,0,[[0,9],[30,2],[120,2],[150,2],[180,1],[60,1]],36,0,null,null,null,null],
    [4,0,[[0,9],[30,2],[120,2],[150,2],[180,1],[60,1]],36,30,null,null,null,null], [2,0,[[0,9],[30,3],[120,2],[150,2],[180,1],[60,1]],36,30,null,null,null,null],
    [3,0,[[0,9],[30,3],[120,2],[150,2],[180,1],[60,1]],65,30,null,null,null,null], [4,0,[[0,9],[30,3],[120,2],[150,2],[180,1],[60,1]],65,60,null,null,null,null],
    [2,0,[[0,9],[30,3],[120,2],[150,2],[180,1],[60,2]],65,60,null,null,null,null], [3,0,[[0,9],[30,3],[120,2],[150,2],[180,1],[60,2]],24,60,null,null,null,null],
    [4,0,[[0,9],[30,3],[120,2],[150,2],[180,1],[60,2]],24,0,null,null,null,null], [2,0,[[0,10],[30,3],[120,2],[150,2],[180,1],[60,2]],24,0,null,null,null,null],
    [5,0,[[0,10],[30,3],[120,2],[150,2],[180,1],[60,2]],24,0,null,null,null,null], [6,0,[[0,10],[30,3],[120,2],[150,2],[180,1],[60,2]],24,0,20,null,null,null],
    [7,0,[[0,10],[30,3],[120,2],[150,2],[180,1],[60,2]],24,0,20,59.6,null,null], [8,0,[[0,10],[30,3],[120,2],[150,2],[180,1],[60,2]],24,0,20,59.6,66912.8,null],
    [9,0,[[0,10],[30,3],[120,2],[150,2],[180,1],[60,2]],24,0,20,59.6,66912.8,57.84150758754478], [9,1,[[0,10],[30,3],[120,2],[150,2],[180,1],[60,2]],24,0,20,59.6,66912.8,57.84150758754478]
  ];
  const SHOWN = [0, 1, 2, 14];   // the waits stepped through on screen (by their place in the list); the others are skipped
  const AT60 = WEST.indexOf(60);
  // A frame = one line just ran: its line, and the variables after it (the next trace step).
  const FR = (() => {
    const fr = [];
    let k = 0;                                    // how many times the for line has run
    for (let i = 0; i < TRACE.length - 1; i++) {
      const ln = TRACE[i][0], after = TRACE[i + 1];
      let wi = ln === 2 ? k : k - 1;
      if (ln === 2) k++;
      if ((ln === 2 || ln === 3 || ln === 4) && wi < N && !SHOWN.includes(wi)) continue;
      fr.push({ ln, wi, counts: after[2], w: after[3], b: after[4], n: after[5], mean: after[6], sq: after[7], spread: after[8], ret: !!after[1] });
    }
    return fr;
  })();
  const GATE = FR.findIndex(f => f.ln === 2 && f.wi === AT60);   // the learner predicts `start` here
  const dict = c => c == null ? "–" : `{${c.map(([k, v]) => `${k}: ${v}`).join(", ")}}`;
  function sayFrame(f, prev) {
    if (f.ln === 1) return "<code>counts</code> starts as an empty dict: bin start → how many waits.";
    if (f.ln === 2) {
      if (f.wi >= N) return `Waits ${(prev ? prev.wi : 0) + 2} to ${N} ran the same lines (skipped on screen). No waits left: the loop ends.`;
      const skip = prev && prev.wi < f.wi - 1 ? `Waits ${prev.wi + 2} to ${f.wi} ran the same lines (skipped on screen). ` : "";
      return `${skip}<code>w</code> is wait number ${f.wi + 1}: ${f.w} s.`;
    }
    if (f.ln === 3) return `<code>b</code> is where the wait's bin begins. <code>//</code> divides and drops the remainder: ${f.w} // 30 = ${Math.floor(f.w / 30)}, times 30 = <b>${f.b}</b>. The bin is ${LAB(f.b / 30)}.`;
    if (f.ln === 4) { const v = f.counts.find(([k]) => k === f.b)[1]; return v === 1 ? `No key ${f.b} yet: <code>get</code> gives 0, so bin ${f.b} becomes 1.` : `Bin ${f.b} goes from ${v - 1} to ${v}.`; }
    if (f.ln === 5) return `n = ${f.n} waits.`;
    if (f.ln === 6) return `mean = ${sum(WEST)} ÷ ${f.n} = ${f.mean}, the same ${f1(MW)} s the report gave.`;
    if (f.ln === 7) return `<code>sq</code> adds up every wait's distance from the mean, squared: ${f.sq}.`;
    if (f.ln === 8) return `Average the squares, take the square root: ${f.spread}, the ${f1(SW)} s from screen 5.`;
    return `Returned. A dict keeps keys in the order they first appear, so 60 comes last: the first wait in the 60–89 bin was wait number ${AT60 + 1}. Sorted, these are your West bins (the empty 90–119 bin never got a key).`;
  }
  function scratchCode({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const popts = [30, 60, 90], pright = 1;
    const paint = () => {
      const f = FR[i], end = i === FR.length - 1, gate = i === GATE && pred !== pright;
      el.innerHTML = `<h1>Bins, mean and spread in plain Python</h1>
        <p class="lead">The same work without NumPy: <code>waits</code> is West's list, <code>width</code> is 30. Each step replays a real run.</p>
        <p class="task">Step through to the end. On the way, predict one bin.</p>
        ${kit.code(CODE1, f.ln)}
        <div class="${P}out">counts ${dict(f.counts)}\nw      ${f.w == null ? "–" : f.w}\nb      ${f.b == null ? "–" : f.b}${f.n != null ? `\nn      ${f.n}` : ""}${f.mean != null ? `\nmean   ${f.mean}` : ""}${f.sq != null ? `\nsq     ${f.sq}` : ""}${f.spread != null ? `\nspread ${f.spread}` : ""}</div>
        <div class="vars"><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f, FR[i - 1]))}
        ${i === GATE ? `<div id="pred" class="${P}q"><p class="task">Before the next step: what will <code>b</code> be for ${WEST[AT60]} s?</p>${kit.options(popts.map(String), { picked: pred, correct: pright, num: true })}
          ${pred == null ? "" : pred === pright
            ? kit.feedback(`Right: 60 // 30 = 2, and 2 × 30 = 60. A wait of exactly 60 s opens the 60–89 bin, the rule you used by hand.`, true)
            : popts[pred] === 30 ? kit.feedback(`60 // 30 is 2, not 1: 60 divides by 30 with nothing left over. 2 × 30 = 60, so 60 starts the 60–89 bin, as on screen 1.`, false)
            : kit.feedback(`<code>//</code> rounds down, never up: 60 // 30 = 2, and 2 × 30 = 60.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${end || gate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 7. The same with NumPy, a recorded run (library.py -> library.out.txt); predict each result first. */
  const CODE2 = [
    "import numpy as np",
    "west = np.array(west_list)",
    "edges = np.arange(0, 211, 30)",
    "counts, _ = np.histogram(west, bins=edges)",
    "share = counts / counts.sum()",
    "p_long = (west >= 120).mean()",
    "mean, median = west.mean(), np.median(west)",
    "spread = west.std()",
    "spread_n1 = west.std(ddof=1)",
    "p90 = np.percentile(west, 90)"
  ];
  // From library.out.txt: the line each listing line printed, copied exactly (key = listing line)
  const RUN = {
    2: "edges [  0  30  60  90 120 150 180 210]",
    3: "counts [10  3  2  0  2  2  1]",
    4: "share [0.5  0.15 0.1  0.   0.1  0.1  0.05] sum 1.0",
    5: "p_long 0.25",
    6: "mean 59.6 median 31.0",
    7: "spread 57.84150758754478",
    8: "spread_n1 59.34413463679014",
    9: "p90 152.5"
  };
  const P90POS = 0.9 * (N - 1), P90J = Math.floor(P90POS), P90G = P90POS - P90J;
  const P90 = Math.round((WS[P90J] + P90G * (WS[P90J + 1] - WS[P90J])) * 100) / 100;
  const npArr = a => `[${a.join("  ")}]`;
  const wrongBins = (() => { const c = HW.slice(); c[1]++; c[2]--; return c; })();   // what putting the 60 in 30-59 would give
  const ASK = [
    { ln: 3, q: "What does <code>counts</code> hold?", opts: [npArr(HW.filter(c => c)), npArr(wrongBins), npArr(HW)], r: 2,
      no: { 0: `The empty ${LAB(EMPTY)} bin is kept, with 0. NumPy returns one count for every pair of neighbouring edges: ${NB + 1} edges, ${NB} counts, in order, so each count lines up with its bin.`,
        1: `That puts the 60 s wait in 30–59. Each bin holds its left edge and stops before the right one, so 60 counts in 60–89, as on screen 1.` },
      yes: `Right: your hand-made bins, in order, the empty one included. The NumPy manual says every bin but the last is half-open: it holds its left edge and not its right one; the last bin holds both.` },
    { ln: 5, q: "<code>west >= 120</code> gives one True or False per wait. What does <code>.mean()</code> of that give?", opts: [String(LONG_W / N), String(LONG_W), String(HW[NB - 1] / N)], r: 0,
      no: { 1: `${LONG_W} would be <code>.sum()</code>, the count. <code>.mean()</code> divides that count by the ${N} waits.`, 2: `${HW[NB - 1] / N} is only the last bin's share. The comparison covers every wait of ${LIMIT} s or more, in all three long bins.` },
      yes: `Right. True counts as 1 and False as 0, so the mean of a True/False array is the share of True: the chance you read on screen 2, in one line.` },
    { ln: 6, q: "What does <code>np.median(west)</code> print?", opts: [`${f1(MW)}`, `${f1(MDW)}.0`, `${WS[MID[0]]}.0`], r: 1,
      no: { 0: `${f1(MW)} is the mean (<code>west.mean()</code> on the same line). The median is the middle of the sorted list.`, 2: `${WS[MID[0]]} is only the lower of the two middle waits. With ${N} waits the median is halfway between waits ${MID[0] + 1} and ${MID[1] + 1}: (${WS[MID[0]]} + ${WS[MID[1]]}) ÷ 2.` },
      yes: `Right: (${WS[MID[0]]} + ${WS[MID[1]]}) ÷ 2, as you found by hand. NumPy returns it as a decimal number, so it prints ${f1(MDW)}.0.` },
    { ln: 8, q: `<code>west.std()</code> divides the sum of squares by n = ${N}, like your Python. <code>ddof=1</code> divides by n − 1 = ${N - 1} instead. Compared with ${RUN[7].split(" ")[1]}, the result is:`, opts: ["Bigger", "Smaller", "The same"], r: 0,
      no: { 1: `Dividing the same sum by a smaller number gives a bigger result: ÷ ${N - 1} instead of ÷ ${N}.`, 2: `The divisor changes from ${N} to ${N - 1}, so the result changes too; the gap shrinks as the list grows.` },
      yes: `Right. NumPy's default is <code>ddof=0</code>, divide by n. With <code>ddof=1</code> you get what statistics calls the sample standard deviation: use it when your waits are a sample and you want to estimate the spread of all waits. Other tools pick different defaults, so check which one a number used before you compare two.` },
    { ln: 9, q: `<code>np.percentile(west, 90)</code> is the wait that 90% of riders beat or match. In West's sorted list, counting from 0 like a JS array, waits ${P90J} and ${P90J + 1} are ${WS[P90J]} and ${WS[P90J + 1]} s. What does it print?`, opts: [`${WS[P90J]}.0`, `${WS[P90J + 1]}.0`, String(P90)], r: 2,
      no: { 0: `NumPy does not just pick a recorded wait. Its default method, "linear", places the 90th percentile at position 0.9 × (${N} − 1) = ${f1(P90POS)} in the sorted list and draws a straight line between the neighbours ${WS[P90J]} and ${WS[P90J + 1]}.`, 1: `That would be the next wait up. The default "linear" method sits at position ${f1(P90POS)}, a tenth of the way from ${WS[P90J]} to ${WS[P90J + 1]}.` },
      yes: `Right: position 0.9 × ${N - 1} = ${f1(P90POS)}, so ${WS[P90J]} + 0.1 × (${WS[P90J + 1]} − ${WS[P90J]}) = ${P90}. For response times this is called the p90. Like the chance over a limit, it describes the long end, which the mean and the standard deviation blur.` }
  ];
  function numpyRun({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const paint = () => {
      const end = k >= ASK.length, a = end ? null : ASK[k];
      const upto = end ? 99 : a.ln;
      const shown = Object.keys(RUN).map(Number).filter(n => n < upto).map(n => RUN[n]);
      el.innerHTML = `<h1>The same summaries with NumPy</h1>
        <p class="lead"><code>west_list</code> is West's ${N} waits as a Python list. <code>np.arange(0, 211, 30)</code> makes the bin edges; it stops before 211, so 210 is the last edge. <code>np.histogram</code> returns the counts and the edges; <code>_</code> throws the edges away. Each line after it is one call on the whole array. (The run's <code>print</code> lines are left out of the listing; the box shows what they printed.)</p>
        ${kit.code(CODE2, end ? -1 : a.ln)}
        <div class="${P}out">${shown.map(kit.esc).join("\n")}</div>
        ${end ? kit.feedback(`${ASK[ASK.length - 1].yes} Every number you worked out by hand came out of one call.`, true)
          : `<p class="task">${a.q}</p>
          <div class="lpanel">${kit.options(a.opts.map(kit.esc), { picked: wrong, correct: a.r })}
          ${wrong != null ? kit.feedback(a.no[wrong], false) : k > 0 ? kit.feedback(ASK[k - 1].yes, true) : ""}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== a.r) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= ASK.length) done();
      });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, cost; task: which summary fits each question. */
  const PICKS = ["The mean", "The median", "The share over a limit"];
  const BIG = [
    ["The lift company charges the building for every minute riders spend waiting. Finance wants next month's bill from this month's waits.", 0,
      `Right. A bill counts every second, and the mean is the total divided by the number of rides, so total = mean × rides. With the stuck lift, East's total was ${sum([...EAST, STUCK])} s.`,
      { 1: "The median ignores how long the long waits are, and the bill counts every second of them. Only the mean turns back into a total: mean × rides.", 2: "The share says how often a wait is long, not how many seconds riders waited in all." }],
    ["A new tenant on the West side asks how long a usual morning wait is.", 1,
      `Right. Half of West's waits are ${f1(MDW)} s or less; the mean, ${f1(MW)} s, is pulled up by the ${LONG_W} long waits and describes almost nobody's wait.`,
      { 0: `The mean, ${f1(MW)} s, is pulled up by the ${LONG_W} long waits. Most West riders wait far less: half wait ${f1(MDW)} s or less.`, 2: "That answers “how often is it bad”, not “what is usual”." }],
    ["Your team's chatbot promises a reply within 3 seconds. The weekly report must say how often it broke that promise.", 2,
      "Right. Count the replies over 3 seconds and divide by all replies, exactly like the West waits over two minutes.",
      { 0: "An average under 3 seconds can hide many replies over 3 seconds, the way West's average hid its long waits.", 1: "The median only says half the replies were faster than it. The promise is broken by the slow end, which the median does not count." }]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a distribution</h1>
        <p class="lead"><b>What for:</b> turning many recorded measurements (waits, reply times, token counts, model scores) into counts per range, so you can read chances and see the shape.</p>
        <p class="lead"><b>Reach for it</b> whenever one average is used to compare two things or to make a promise.</p>
        <p class="lead"><b>Not for:</b> a handful of observations, which miss the shape and rare events (collect more, or log the rare event). Not for mixed conditions, such as rush hour mixed with weekends (split the data first). Not for questions about why: counts describe, they do not explain (compare groups or run an experiment).</p>
        <p class="lead"><b>Cost:</b> enough observations, kept as raw values rather than only an average, and a bin width you must choose: too wide hides the shape, too narrow shows noise.</p>
        <p class="task">For each question, pick the summary that answers it.</p>
        ${BIG.map(([q, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(PICKS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : no[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: can recorded counts answer this? One "no". */
  const RARE = 0.01, MISS = Math.pow(1 - RARE, N);   // chance that N waits show no 1-in-100 event
  const CASES = [
    ["A support team logged 2,000 chatbot reply times last week. The manager asks how often a reply took longer than 10 seconds.", true,
      "Yes. Count the replies over 10 seconds and divide by 2,000. Two thousand recorded replies are plenty to read that share.",
      "The replies are recorded and there are plenty of them. Count those over 10 seconds and divide by 2,000: that is the chance, read straight from the counts."],
    ["A classifier, a model that sorts each email into a category, gave each of 1,000 test emails a confidence score between 0 and 1. You want to know if its scores bunch near 0 and 1 or sit in the middle.", true,
      "Yes. Bin the 1,000 scores into a histogram, say ten bins of 0.1, and look at the shape. A mean of 0.5 could come from either shape, like the two lift banks.",
      "A histogram of the scores shows exactly this, and the mean cannot: scores all near 0.5 and scores split between 0 and 1 can share a mean of 0.5."],
    [`None of East's ${EAST.length} timed waits reached two minutes. A tenant asks for the chance that an East wait lasts 5 minutes or more.`, false,
      `No. 0 out of ${EAST.length} does not mean never. Even if 1 wait in 100 took 5 minutes, ${EAST.length} waits would show none about ${Math.round(MISS * 100)} times in 100. ${EAST.length} observations cannot see a rare event; you need far more waits, or the maintenance log of breakdowns.`,
      `${EAST.length} waits cannot see a rare event. Even if 1 wait in 100 took 5 minutes, ${EAST.length} waits would show none about ${Math.round(MISS * 100)} times in 100, so 0 out of ${EAST.length} does not mean never. You need far more waits, or the maintenance log of breakdowns.`]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Can the counts answer it?</h1>
        <p class="lead">${WORDS[CASES.length]} questions. For each, decide if counting recorded observations and dividing by the total gives a trustworthy answer.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (browser practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Same average, different lifts</h1>
      <p class="lead">You can now say what a distribution is: counts per range divided by the total, a share for every range. Why it works: a chance is the share of the ranges you care about. When to reach for it: whenever one average is used to compare or promise. Which summary to quote: the median for a usual value, the mean for totals, the share over a limit or a percentile for the long end; the standard deviation only when the shape is balanced. What it costs: enough recorded observations, kept as raw values. When not: a handful of observations, or a rare event they cannot show.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson: you bin a list of reply times with <code>np.histogram</code>, read the share over a limit, and report the mean, median and spread, saying which one answers the question asked.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Here every chance came from one set of counts; next, a chance that changes once you learn one more fact, and how to update a belief with evidence.</p>` : ""}`;
    done();
  }

  LessonKit.define("s1-probability", {
    title: "Distributions, mean and spread from counts",
    checked: "2026-11-14",
    sources: [
      "https://numpy.org/doc/stable/reference/generated/numpy.histogram.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.arange.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.mean.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.median.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.std.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.percentile.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.quantile.html"
    ],
    interview: [{
      q: "Your team's LLM endpoint reports an average response time of 1.2 seconds, well inside the target, yet users keep saying it is slow. What do you look at?",
      good: [
        "Look at the distribution of response times, not the average: a histogram of the raw times",
        "Report the median for the usual request and the share over the target, or a high percentile such as p95, for the slow end",
        "Check whether the slow requests form their own group, for example long prompts or one region, and split the data by that condition",
        "Make sure there are enough recorded requests to see the slow end at all"
      ],
      weak: "The average is under target, so the complaints are about perception. It misses that a low mean can hide a group of very slow requests."
    }, {
      q: "You must forecast next month's API bill from the token counts of last month's requests. The counts are lopsided: most requests are small, a few are huge. Do you plan with the mean or the median?",
      good: [
        "The mean: the bill is a total, and total = mean × number of requests",
        "The median would badly underestimate, because it ignores how big the huge requests are",
        "Look at the distribution too: if the huge requests come from one feature, forecast that part separately",
        "Quote the median when someone asks what a typical request costs"
      ],
      weak: "The median, because the data is skewed. That is right for “what is typical”, but a bill adds up every token, so the median underestimates it."
    }],
    screens: [binWest, readChance, spotIdea, meanMedian, spread, scratchCode, numpyRun, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-i="${binOf(WEST[0]) + 1}"]`], right: WEST.map(w => `[data-i="${binOf(w)}"]`) },
      { wrong: [`[data-i="${LB - 1}"]`], right: [...Array.from({ length: NB - LB }, (_, j) => `[data-i="${LB + j}"]`), "#q2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="0"]'], right: [...MID.map(i => `[data-i="${i}"]`), "#q2 [data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: [...Array(GATE).fill("[data-next]"), "#pred [data-wrong]"], right: ["#pred [data-right]", ...Array(FR.length - 1 - GATE).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: Array(ASK.length).fill("[data-right]") },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
