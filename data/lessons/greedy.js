/* Lesson: greedy. A cargo-bike courier with a 20 kg limit and a flat fee per parcel: sort by weight and load the
   lightest first, and see why a swap makes that safe. Then the next day's parcels pay different fees, the
   best-looking pick loses, and the learner beats the rule by hand. Every number on screen is computed here from
   LIMIT, PARCELS, FRIEND, FEES and TOKENS. Plain browser script. */
(() => {
  const LIMIT = 20, PARCELS = [7, 3, 9, 2, 6, 4, 8, 5], N = PARCELS.length;
  const KG = PARCELS.map(w => `${w} kg`);
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const total = a => a.reduce((s, x) => s + x, 0);
  const SETS = 2 ** N;
  const SUP = n => String(n).split("").map(d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).join("");
  // the most parcels any set can carry, by trying every set (what the slow way would do)
  const BEST = (() => { let b = 0; for (let m = 0; m < SETS; m++) { let w = 0, c = 0; for (let i = 0; i < N; i++) if (m >> i & 1) { w += PARCELS[i]; c++; } if (w <= LIMIT) b = Math.max(b, c); } return b; })();
  // a rule run over parcels in a given order: take each one that still fits (stopAtFirst: stop at the first that does not)
  const runRule = (order, stopAtFirst) => { const took = []; let load = 0; for (const i of order) { if (load + PARCELS[i] <= LIMIT) { took.push(i); load += PARCELS[i]; } else if (stopAtFirst) break; } return { took, load }; };
  const HEAVY_ORDER = PARCELS.map((_, i) => i).sort((a, b) => PARCELS[b] - PARCELS[a] || a - b);
  const LIGHT_ORDER = HEAVY_ORDER.slice().reverse();
  const HEAVY = runRule(HEAVY_ORDER, false);
  const SORTED = LIGHT_ORDER.map(i => PARCELS[i]);
  const LIGHT = runRule(LIGHT_ORDER, true);

  /* 1. The slow way, by hand: load the bike, then see what it takes to be sure. */
  function loadBike({ el, done, kit }) {
    const on = new Set();
    let miss = null, msg = null;
    const paint = () => {
      const load = total([...on].map(i => PARCELS[i]));
      const left = PARCELS.map((w, i) => [w, i]).filter(([, i]) => !on.has(i));
      const lightLeft = left.length ? Math.min(...left.map(([w]) => w)) : null;
      const full = lightLeft == null || load + lightLeft > LIMIT;
      const cls = {};
      on.forEach(i => { cls[i] = "in"; });
      if (miss != null) cls[miss] = "no";
      el.innerHTML = `<h1>A cargo bike, a ${LIMIT} kg limit</h1>
        <p class="lead">You deliver parcels on a cargo bike that carries at most <b>${LIMIT} kg</b>. Each bar is a parcel waiting at the depot, and the number is its weight. Every parcel pays the same flat fee, so more parcels means more money.</p>
        <p class="task">Tap parcels to load them, as many as you can without going over ${LIMIT} kg. Tap a loaded parcel to take it off again. Stop when nothing else fits.</p>
        ${kit.bars(PARCELS, { cls, pick: true, labels: KG })}
        <div class="vars"><span>on the bike <b>${load} / ${LIMIT} kg</b></span><span>parcels <b>${on.size}</b></span></div>
        <div class="lpanel">
          ${miss != null ? kit.feedback(`${load} + ${PARCELS[miss]} = ${load + PARCELS[miss]} kg, which is over the ${LIMIT} kg limit. The ${PARCELS[miss]} kg parcel stays at the depot. ${full ? "" : `A lighter one still fits: you have ${LIMIT - load} kg of room.`}`, false)
            : on.size && full ? kit.feedback(`Nothing else fits: the lightest parcel left is ${lightLeft} kg and you have ${LIMIT - load} kg of room. You carry <b>${plural(on.size, "parcel")}</b>. Is that the most any choice can carry? You cannot tell by looking. To be sure, you would try every set of parcels. Each parcel is either on or off, so ${N} parcels give 2 × 2 × ... = 2${SUP(N)} = ${fmt(SETS)} sets, and with 30 parcels it is ${fmt(2 ** 30)}.`, true)
            : msg ? kit.feedback(msg) : ""}
        </div>`;
      el.querySelectorAll("button.col").forEach(c => c.onclick = () => {
        const i = +c.dataset.i;
        if (on.has(i)) { on.delete(i); miss = null; msg = `The ${PARCELS[i]} kg parcel is back at the depot.`; paint(); return; }
        if (load + PARCELS[i] > LIMIT) { miss = i; paint(); return; }
        on.add(i); miss = null; msg = `Loaded the ${PARCELS[i]} kg parcel. ${LIMIT - load - PARCELS[i]} kg of room left.`;
        paint();
        const ld = total([...on].map(j => PARCELS[j]));
        if (PARCELS.every((w, j) => on.has(j) || ld + w > LIMIT)) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: which parcel goes first when every parcel pays the same? */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const hv = PARCELS[HEAVY_ORDER[0]], lt = PARCELS[LIGHT_ORDER[0]];
    const opts = [`The ${hv} kg: big parcels first, small ones fill the gaps`, `The ${lt} kg: it leaves the most room`, "It makes no difference which goes first"];
    const correct = 1;
    const hvList = HEAVY.took.map(i => PARCELS[i]);
    const paint = () => {
      const ok = ans === correct, cls = {};
      if (ok) cls[LIGHT_ORDER[0]] = "enter";
      el.innerHTML = `<h1>Which parcel goes first?</h1>
        <p class="lead">The bike is empty and holds ${LIMIT} kg. Every parcel pays the same fee, whatever it weighs.</p>
        <p class="task">You want to carry as many parcels as possible. Which one do you load first?</p>
        ${kit.bars(PARCELS, { cls, labels: KG })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. A light parcel earns the same fee as a heavy one and uses less of the ${LIMIT} kg. Then do it again: of the parcels left, the lightest leaves the most room for the rest. So line them up from lightest to heaviest and load in that order.`, true)
          : ans === 0 ? kit.feedback(`The ${hv} kg parcel earns the same fee as the ${lt} kg one but eats ${hv} of your ${LIMIT} kg. Heaviest first loads ${hvList.join(", ")} kg and then nothing else fits: only ${plural(hvList.length, "parcel")}.`, false)
          : kit.feedback(`Order matters. Heaviest first loads ${hvList.join(", ")} kg and stops at ${plural(hvList.length, "parcel")}, because the big ones used up the room. Think about what each parcel costs you in room.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Why it is safe: swap a heavy parcel in someone's load for a lighter one left behind. */
  const FRIEND = [1, 5, 7, 6];  // indices into PARCELS: the friend's load
  const FR_W = FRIEND.map(i => PARCELS[i]), FR_LOAD = total(FR_W);
  const OUT = FRIEND.reduce((a, i) => PARCELS[i] > PARCELS[a] ? i : a, FRIEND[0]);
  const IN = PARCELS.map((_, i) => i).filter(i => !FRIEND.includes(i)).reduce((a, i) => a < 0 || PARCELS[i] < PARCELS[a] ? i : a, -1);
  const AFTER = FR_LOAD - PARCELS[OUT] + PARCELS[IN], ROOM = LIMIT - AFTER;
  const EXTRA = PARCELS.map((_, i) => i).filter(i => i !== IN && i !== OUT && !FRIEND.includes(i) && PARCELS[i] <= ROOM).reduce((a, i) => a < 0 || PARCELS[i] < PARCELS[a] ? i : a, -1);
  function whySafe({ el, done, kit }) {
    let ans = null;
    const o = PARCELS[OUT], n = PARCELS[IN];
    const opts = [`Still ${FRIEND.length} parcels, and lighter`, `Still ${FRIEND.length} parcels, but heavier`, `The bike carries ${FRIEND.length - 1} parcels`];
    const correct = 0;
    const paint = () => {
      const ok = ans === correct, cls = {};
      FRIEND.forEach(i => { cls[i] = "in"; });
      if (ok) { cls[OUT] = "leave"; cls[IN] = "enter"; }
      el.innerHTML = `<h1>Why lightest first is safe</h1>
        <p class="lead">Another courier loaded ${FR_W.join(" + ")} = <b>${FR_LOAD} kg</b>, ${plural(FRIEND.length, "parcel")} (marked in the key under the chart). The ${n} kg parcel stayed at the depot.</p>
        <p class="task">Take the ${o} kg off and put the ${n} kg on instead. What happens?</p>
        ${kit.bars(PARCELS, { cls, labels: KG })}
        ${kit.pics.key([["in", "the other courier's load"], ["", "at the depot"], ["leave", `the ${o} kg, coming off`], ["enter", `the ${n} kg, going on`]].filter(([st]) => st ? Object.values(cls).includes(st) : Object.keys(cls).length < PARCELS.length))}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right: ${FR_LOAD} − ${o} + ${n} = ${AFTER} kg, still ${plural(FRIEND.length, "parcel")}. Swapping a parcel for a lighter one never loses a parcel and never breaks the limit.${EXTRA >= 0 ? ` Here the swap even frees ${ROOM} kg, enough for the ${PARCELS[EXTRA]} kg parcel: ${FRIEND.length + 1} parcels.` : ""} Take any load that fits, say k parcels. Swap its parcels one by one for the lightest ones. You end with the k lightest parcels, still k of them and still within ${LIMIT} kg. So no load can hold more parcels than lightest-first does. This is called a <b>swap argument</b>.`, true)
          : ans === 1 ? kit.feedback(`The ${n} kg going on is lighter than the ${o} kg coming off, so the load goes down, not up: ${FR_LOAD} − ${o} + ${n} = ${AFTER} kg. A lighter load can never break the limit.`, false)
          : kit.feedback(`A swap is one parcel off and one parcel on, so the count stays at ${FRIEND.length}. Only the weight changes.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Use it: parcels sorted lightest first; predict each move; then feel the saving at real sizes. */
  const LOG = Math.log2(N), SORT_STEPS = Math.round(N * LOG);
  const LOOKS = Math.min(N, LIGHT.took.length + 1);  // parcels looked at: each one loaded, plus the one that stops it
  function useIt({ el, done, kit }) {
    let k = 0, load = 0, wrong = null, said = null, fin = false, n = 30;
    const opts = ["Load it", "Skip it, try the next", "Stop loading"];
    const paint = () => {
      const w = SORTED[k], fits = !fin && load + w <= LIMIT, correct = fits ? 0 : 2;
      const cls = {};
      for (let i = 0; i < N; i++) cls[i] = i < k ? "in" : fin && i > k ? "gone" : "";
      el.innerHTML = `<h1>Sort, then take</h1>
        <p class="lead">The same ${N} parcels, lined up from lightest to heaviest. The frame shows the next parcel in line. Crossed-out bars are parcels never looked at.</p>
        ${fin ? "" : `<p class="task">On the bike: ${load} kg. Next in line: <b>${w} kg</b>. What do you do?</p>`}
        ${kit.bars(SORTED, { cls, frames: fin ? [] : [[k, 1]], labels: SORTED.map(v => `${v} kg`) })}
        <div class="vars"><span>on the bike <b>${load} / ${LIMIT} kg</b></span><span>parcels <b>${k}</b></span></div>
        <div class="lpanel">${fin ? "" : kit.options(opts, { picked: wrong, correct })}
        ${wrong != null ? kit.feedback(
            wrong === 0 ? `${load} + ${w} = ${load + w} kg, which is over the ${LIMIT} kg limit.`
            : wrong === 1 && !fits ? `Every parcel after the ${w} kg is at least as heavy, so if the ${w} kg does not fit, none of them does. Looking at them is wasted work.`
            : wrong === 1 ? `The ${w} kg fits: ${load} + ${w} = ${load + w} kg. Skip it and the parcel you take instead is heavier, for the same fee.`
            : `There is still room: ${load} + ${w} = ${load + w} kg is within ${LIMIT}. Stopping now leaves a fee at the depot.`, false)
          : said ? kit.feedback(said[0], said[1]) : ""}
        ${fin ? `${kit.meter([{ label: "Try every set", value: SETS, max: SETS }, { label: "Sort, then take", value: SORT_STEPS + LOOKS, max: SETS, good: true }])}
          <div class="sliders"><label>Parcels at the depot <input type="range" id="sn" min="10" max="60" step="10" value="${n}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (v === 0) {
          load += w; k++;
          if (k === N) fin = true;
          said = fin ? null : [`Loaded. ${LIMIT - load} kg of room left.`];
        } else fin = true;
        if (fin) said = [`You carry <b>${plural(k, "parcel")}, ${load} kg</b>. A computer that tries all ${fmt(SETS)} sets finds no load with more than ${plural(BEST, "parcel")}. You needed one sort and ${plural(LOOKS, "look")}${LOOKS > k ? ` (${k} loaded, plus the ${SORTED[k]} kg that did not fit)` : ""}. Sorting n items takes about n × log₂ n steps${Number.isInteger(LOG) ? ` (log₂ ${N} = ${LOG}, because ${Array(LOG).fill(2).join(" × ")} = ${N})` : ""}, so the sort is about ${SORT_STEPS} steps: about ${SORT_STEPS + LOOKS} steps in all. Now add parcels:`, true];
        paint();
        if (fin) done();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const all = 2 ** n, greedy = Math.round(n * Math.log2(n)) + n;
        el.querySelector("#big").innerHTML = `${fmt(all)} vs ${fmt(greedy)}<small>steps when trying every set (at least one per set), against sorting and then one look per parcel. That is about ${fmt(Math.round(all / greedy))} times fewer steps.</small>`;
      };
      sn.oninput = () => { n = +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 5. The same moves as code. */
  const CODE1 = [
    "parcels.sort((a, b) => a - b);",
    "let load = 0, count = 0;",
    "for (const w of parcels) {",
    "  if (load + w > limit) break;",
    "  load += w;",
    "  count++;",
    "}",
    "return count;"
  ];
  const FR1 = (() => {
    const fr = [{ ln: 0, k: -1, load: "–", count: "–", w: "–", say: `Sort from lightest to heaviest: ${SORTED.join(", ")}. <code>a - b</code> sorts numbers; without it JavaScript would sort them as text.` },
      { ln: 1, k: -1, load: 0, count: 0, w: "–", say: "The bike is empty." }];
    let load = 0, count = 0;
    for (let k = 0; k < N; k++) {
      const w = SORTED[k];
      if (load + w > LIMIT) {
        fr.push({ ln: 3, k, load, count, w, stop: true, say: `w = ${w}. ${load} + ${w} = ${load + w} > ${LIMIT} is true, so <code>break</code> leaves the loop. Every parcel after it is heavier, so none of them is looked at.` });
        break;
      }
      fr.push({ ln: 3, k, load, count, w, say: `w = ${w}. ${load} + ${w} = ${load + w} > ${LIMIT} is false: it fits.` });
      load += w;
      fr.push({ ln: 4, k, load, count, w, on: true, say: `Load it: <code>load</code> is now ${load}.` });
      count++;
      fr.push({ ln: 5, k, load, count, w, on: true, say: `<code>count</code> is now ${count}.` });
    }
    fr.push({ ln: 7, k: N, load, count, w: "–", fin: true, say: `Return ${count}: the ${count} parcels you loaded by hand. Taking the best-looking option at each step and never going back is called <b>greedy</b> (here the best-looking option is the lightest parcel). Here it is safe because of the swap you just made.` });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = {};
      const loaded = f.ln === 0 ? 0 : FR1.slice(0, i + 1).reduce((c, x) => x.on ? Math.max(c, x.k + 1) : c, 0);
      const stopAt = FR1.slice(0, i + 1).find(x => x.stop);
      for (let j = 0; j < N; j++) cls[j] = j < loaded ? "in" : stopAt && j > stopAt.k ? "gone" : "";
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">Nothing new here. <code>parcels</code> is the depot, <code>limit</code> is ${LIMIT}, and <code>w</code> is the weight of the parcel in line.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the parcels.</p>
        ${kit.bars(f.ln === 0 && i === 0 ? PARCELS : SORTED, { cls: f.ln === 0 && i === 0 ? {} : cls, frames: f.k >= 0 && f.k < N ? [[f.k, 1]] : [], labels: (f.ln === 0 && i === 0 ? PARCELS : SORTED).map(v => `${v} kg`) })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>w <b>${f.w}</b></span><span>load <b>${f.load}</b></span><span>count <b>${f.count}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 6. The next day the fees differ: run the obvious rule, best pay per kilo first. */
  const FEES = [[4, 3], [10, 14], [12, 18], [3, 2], [10, 14]];  // [kg, pay] per parcel, in depot order
  const NF = FEES.length, FW = FEES.map(f => f[0]), FP = FEES.map(f => f[1]);
  const perKg = i => Math.round(FP[i] / FW[i] * 100) / 100;
  const FLABELS = FP.map(p => `pays ${p}`);
  // the rule's next pick: best pay per kilo among parcels not loaded that still fit (ties: leftmost)
  const ruleNext = (on, load) => { let b = -1; for (let i = 0; i < NF; i++) if (!on.has(i) && load + FW[i] <= LIMIT && (b < 0 || FP[i] / FW[i] > FP[b] / FW[b])) b = i; return b; };
  const RULE = (() => { const on = new Set(), took = []; let load = 0, i; while ((i = ruleNext(on, load)) >= 0) { on.add(i); took.push(i); load += FW[i]; } return { took, load, pay: total(took.map(j => FP[j])) }; })();
  const BEST2 = (() => { let b = 0, bm = 0; for (let m = 0; m < 2 ** NF; m++) { let w = 0, p = 0; for (let i = 0; i < NF; i++) if (m >> i & 1) { w += FW[i]; p += FP[i]; } if (w <= LIMIT && p > b) { b = p; bm = m; } } return { pay: b, took: FEES.map((_, i) => i).filter(i => bm >> i & 1) }; })();
  const FIRST_WRONG = (() => { for (let i = 0; i < NF; i++) if (i !== RULE.took[0] && FW[i] <= LIMIT) return i; return -1; })();
  function ruleRun({ el, done, kit }) {
    const on = new Set(), took = [];
    let miss = null, msg = null;
    const paint = () => {
      const load = total(took.map(i => FW[i])), pay = total(took.map(i => FP[i])), nx = ruleNext(on, load), fin = nx < 0;
      const cls = {};
      on.forEach(i => { cls[i] = "in"; });
      if (miss) cls[miss.i] = "no";
      el.innerHTML = `<h1>The next day, the fees differ</h1>
        <p class="lead">Same bike, same ${LIMIT} kg. Today each parcel pays its own fee, written under it; the number on top is still its weight in kg. You want the most money, not the most parcels. A rule that sounds right: <b>take the parcel that pays the most per kilo</b> (pay ÷ weight) that still fits, again and again.</p>
        <p class="task">Work out pay ÷ weight for each parcel first. Then tap parcels in the order the rule picks them, until nothing else fits.</p>
        ${kit.bars(FW, { cls, pick: !fin, labels: FLABELS })}
        <div class="vars"><span>on the bike <b>${load} / ${LIMIT} kg</b></span><span>pay <b>${pay}</b></span></div>
        <div class="lpanel">${miss ? kit.feedback(miss.html, false)
          : fin ? kit.feedback(`Nothing else fits. The rule loaded ${took.map(i => `${FW[i]} kg`).join(", ")}: ${load} kg, paying <b>${pay}</b>. It took the best pay per kilo at every step. Is ${pay} the most this bike can earn today?`, true)
          : msg ? kit.feedback(msg) : ""}</div>`;
      el.querySelectorAll("button.col").forEach(c => c.onclick = () => {
        const i = +c.dataset.i;
        if (on.has(i)) { miss = null; msg = `The ${FW[i]} kg parcel is already on the bike.`; paint(); return; }
        if (load + FW[i] > LIMIT) miss = { i, html: `${load} + ${FW[i]} = ${load + FW[i]} kg, which is over the ${LIMIT} kg limit. The rule only picks parcels that still fit.` };
        else if (i !== nx) miss = { i, html: `The ${FW[i]} kg pays ${FP[i]} ÷ ${FW[i]} = ${perKg(i)} per kilo. The ${FW[nx]} kg pays ${FP[nx]} ÷ ${FW[nx]} = ${perKg(nx)} per kilo and still fits, so the rule takes it first.` };
        else { on.add(i); took.push(i); miss = null; msg = `The rule takes the ${FW[i]} kg: ${FP[i]} ÷ ${FW[i]} = ${perKg(i)} per kilo, the best of the parcels that fit.`; }
        paint();
        if (ruleNext(on, total(took.map(j => FW[j]))) < 0) done();
      });
    };
    paint();
  }

  /* 7. Beat the rule by hand, then see why the swap argument broke. */
  function beatRule({ el, done, kit }) {
    const on = new Set();
    let miss = null, msg = null, won = false;
    const paint = () => {
      const ids = [...on].sort((a, b) => a - b), load = total(ids.map(i => FW[i])), pay = total(ids.map(i => FP[i]));
      const cls = {};
      on.forEach(i => { cls[i] = won ? "enter" : "in"; });
      if (miss != null) cls[miss] = "no";
      const first = RULE.took[0];
      el.innerHTML = `<h1>Beat the rule</h1>
        <p class="lead">The best-pay-per-kilo rule earned <b>${RULE.pay}</b> with ${RULE.took.map(i => `${FW[i]} kg`).join(", ")}. Same parcels, same ${LIMIT} kg.</p>
        <p class="task">Tap parcels to build a load that pays more than ${RULE.pay}. Tap a loaded parcel to take it off.</p>
        ${kit.bars(FW, { cls, pick: true, labels: FLABELS })}
        <div class="vars"><span>on the bike <b>${load} / ${LIMIT} kg</b></span><span>pay <b>${pay}</b></span><span>the rule <b>${RULE.pay}</b></span></div>
        <div class="lpanel">${miss != null ? kit.feedback(`${load} + ${FW[miss]} = ${load + FW[miss]} kg, which is over the ${LIMIT} kg limit. Take a parcel off first.`, false)
          : won ? kit.feedback(`${ids.map(i => `${FW[i]} kg`).join(" + ")} pays <b>${pay}</b>, more than the rule's ${RULE.pay}.${pay === BEST2.pay ? ` No load pays more: a computer that tries all ${2 ** NF} sets agrees.` : ""} The rule's first pick, the ${FW[first]} kg, paid the most per kilo, but it left ${LIMIT - FW[first]} kg that only the small parcels could fill. Yesterday every parcel paid the same, so a swap for a lighter parcel could never hurt. Today a swap changes the pay too.<span style="display:block;margin-top:10px">Greedy is safe only when swapping your pick into any other answer never makes it worse.</span>`, true)
          : msg ? kit.feedback(msg) : ""}</div>`;
      el.querySelectorAll("button.col").forEach(c => c.onclick = () => {
        const i = +c.dataset.i;
        miss = null;
        if (on.has(i)) { on.delete(i); msg = `The ${FW[i]} kg parcel is back at the depot.`; }
        else if (load + FW[i] > LIMIT) { miss = i; paint(); return; }
        else on.add(i);
        const ids2 = [...on], p2 = total(ids2.map(j => FP[j]));
        if (p2 > RULE.pay) { won = true; paint(); done(); return; }
        won = false;
        if (!on.has(i)) { paint(); return; }
        msg = p2 === RULE.pay ? `This load pays ${p2}, the same as the rule. You need more.` : `This load pays ${p2} so far. The rule got ${RULE.pay}.`;
        paint();
      });
    };
    paint();
  }

  /* 8. Recognise it, including a case where the greedy pick fails. */
  const TOKENS = [1, 3, 4], PAYOUT = 6;
  const T_GREEDY = (() => { const out = []; let left = PAYOUT; const t = TOKENS.slice().sort((a, b) => b - a); for (const v of t) while (left >= v) { out.push(v); left -= v; } return out; })();
  const T_BEST = (() => { const best = [[]]; for (let s = 1; s <= PAYOUT; s++) { best[s] = null; for (const v of TOKENS) if (v <= s && best[s - v] && (!best[s] || best[s - v].length + 1 < best[s].length)) best[s] = [...best[s - v], v]; } return best[PAYOUT].slice().sort((a, b) => b - a); })();
  const CASES = [
    ["A clinic has three hours of appointments left today. Each waiting patient needs a known number of minutes, and every patient counts the same. See as many patients as possible, always seeing the shortest visit next.", true,
      "Yes. It is the bike again with minutes for kilos: see the shortest visits first. Swapping a long visit for a shorter one never sees fewer patients.",
      "Every patient counts the same, so a short visit is like a light parcel: same reward, less time used. Swapping a long visit for a shorter one never loses a patient, so shortest first is safe."],
    [`A bowling alley's machine pays out tokens worth ${TOKENS.slice(0, -1).join(", ")} and ${TOKENS[TOKENS.length - 1]}. Pay out ${PAYOUT} using the fewest tokens, always taking the biggest token that still fits.`, false,
      `No. Biggest first pays ${T_GREEDY.join(" + ")}: ${plural(T_GREEDY.length, "token")}. But ${T_BEST.join(" + ")} is ${PAYOUT} with ${plural(T_BEST.length, "token")}. Taking the ${T_GREEDY[0]} left ${PAYOUT - T_GREEDY[0]}, which only small tokens can fill.`,
      `Try it. Biggest first pays ${T_GREEDY.join(" + ")}: ${plural(T_GREEDY.length, "token")}. But ${T_BEST.join(" + ")} is ${PAYOUT} with ${plural(T_BEST.length, "token")}. Biggest first happens to work for many real coin sets, but not for this one: the ${T_GREEDY[0]} left ${PAYOUT - T_GREEDY[0]}, the same trap as the ${FW[RULE.took[0]]} kg parcel.`],
    ["A climbing gym rents ropes of different lengths. Each climber needs a rope at least as long as their route. Give ropes to as many climbers as possible, one rope each, giving the shortest route the shortest rope that is long enough.", true,
      "Yes. Sort both. The shortest route gets the shortest rope that is long enough. A longer rope could only help someone else, so saving it never hurts.",
      "Sort the routes and the ropes. The shortest route gets the shortest rope that is long enough. Swapping in a longer rope never helps that climber and may leave a longer route without one, so the pick is safe."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is the greedy pick safe here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the depot. For each, ask: is the greedy pick safe, so that no swap can ever make it worse?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes, it is safe", "No, it can fail"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. On to the problems. */
  const TAUGHT = { "sort-then-take": "You did this with the cargo bike: sort by weight, then load the lightest until the next one does not fit." };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("greedy", {
    title: "Greedy",
    teaches: ["sort-then-take"],
    screens: [loadBike, spotTrick, whySafe, useIt, asCode, ruleRun, beatRule, recognise, toProblems],
    walk: [
      // wrong: the three heaviest (the third goes over). right: the first two clicks take those two off again, then the
      // lightest are loaded. From an empty bike (the reload case) the same clicks load the two heaviest plus the lightest,
      // which fills the bike, and the remaining clicks go over and change nothing.
      { wrong: HEAVY_ORDER.slice(0, 3).map(i => `[data-i="${i}"]`), right: [...HEAVY_ORDER.slice(0, 2), ...LIGHT.took].map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(LOOKS).fill("[data-right]") },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: [`[data-i="${FIRST_WRONG}"]`], right: RULE.took.map(i => `[data-i="${i}"]`) },
      { wrong: [`[data-i="${RULE.took[0]}"]`, `[data-i="${BEST2.took.find(i => FW[i] + FW[RULE.took[0]] > LIMIT)}"]`], right: [`[data-i="${RULE.took[0]}"]`, ...BEST2.took.map(i => `[data-i="${i}"]`)] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
