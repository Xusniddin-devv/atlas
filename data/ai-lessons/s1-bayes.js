/* Lesson s1-bayes: Conditional probability and Bayes' rule.
   Story: an airport bag scanner whose alarm goes off often, and a screener wondering how much to trust it.
   Ideas: (1) "how often does a banned bag alarm?" and "how often is an alarmed bag banned?" are different
   questions; the second one depends on how rare banned bags are (the base rate). Counting 1,000 bags shows it.
   (2) Bayes' rule is the same count written with rates, and its answer (the posterior) becomes the starting
   belief (the prior) for the next, independent piece of evidence.
   Data: the scanner's rates (2 in 100 bags banned, alarms on 90% of banned and 5% of clean bags) are made up for
   the lesson; they describe no real scanner. Every count and percentage on screen is computed here from them.
   Code output comes from runs on this Mac (Python 3.14.6, standard library only, see env.txt):
     docs/ai-path/runs/s1-bayes/scratch.py -> scratch.out.txt (the traced posterior() on screen 6)
     docs/ai-path/runs/s1-bayes/broken.py  -> broken.out.txt  (the broken-on-purpose report on screen 7)
   No model API calls were recorded for this lesson; nothing on it is "not run by us".
   Lesson-local picture and CSS (prefix lx-s1-bayes-): a 1,000-tile bag grid and a number keypad. */
(() => {
  const ID = "s1-bayes", P = "lx-" + ID + "-";

  // the lesson's made-up scanner (same numbers as scratch.py and broken.py)
  const BAGS = 1000, PRIOR = 0.02, HIT = 0.90, FA = 0.05;
  const RARE = 0.001;   // the small airport's prior (screen 5, and the second run in broken.py)
  const post = (prior, hit = HIT, fa = FA) => prior * hit / (prior * hit + (1 - prior) * fa);
  const BANNED = Math.round(BAGS * PRIOR), CLEAN = BAGS - BANNED;
  const CAUGHT = Math.round(BANNED * HIT), MISSED = BANNED - CAUGHT;
  const FALSE = Math.round(CLEAN * FA), ALARMS = CAUGHT + FALSE;
  const POST = CAUGHT / ALARMS;
  const per = r => Math.round(r * 100);   // 0.02 -> 2 (in every 100)

  // scratch.out.txt: trace of posterior(0.02, 0.90, 0.05), copied (not altered)
  const TRACE = [
    { line: 1, event: "line", vars: { prior: 0.02, hit_rate: 0.9, fa_rate: 0.05 } },
    { line: 2, event: "line", vars: { prior: 0.02, hit_rate: 0.9, fa_rate: 0.05, real_alarms: "0.018000000000000002" } },
    { line: 3, event: "line", vars: { prior: 0.02, hit_rate: 0.9, fa_rate: 0.05, real_alarms: "0.018000000000000002", false_alarms: 0.049 } },
    { line: 4, event: "line", vars: { prior: 0.02, hit_rate: 0.9, fa_rate: 0.05, real_alarms: "0.018000000000000002", false_alarms: 0.049, all_alarms: 0.067 } },
    { line: 4, event: "return", vars: { prior: 0.02, hit_rate: 0.9, fa_rate: 0.05, real_alarms: "0.018000000000000002", false_alarms: 0.049, all_alarms: 0.067 } }
  ];
  const RUN = { result: "0.26865671641791045", after_two: "0.8686327077747988", half_banned: "0.9473684210526315" };   // scratch.out.txt
  const RUN_DATE = "2026-11-14";
  const CODE6 = [
    "def posterior(prior, hit_rate, fa_rate):",
    "    real_alarms = prior * hit_rate",
    "    false_alarms = (1 - prior) * fa_rate",
    "    all_alarms = real_alarms + false_alarms",
    "    return real_alarms / all_alarms"
  ];
  // broken.py (the function) and broken.out.txt (copied, not altered)
  const CODE7 = [
    "def posterior(prior, hit_rate, fa_rate):",
    "    real_alarms = prior * hit_rate",
    "    false_alarms = prior * fa_rate",
    "    all_alarms = real_alarms + false_alarms",
    "    return real_alarms / all_alarms"
  ];
  const OUT7 = [
    "prior=0.02  formula says 0.947  |  simulated: 1792 of 6678 alarmed bags banned = 0.268",
    "prior=0.001  formula says 0.947  |  simulated: 99 of 4943 alarmed bags banned = 0.020"
  ];
  const SIM_N = 100000;   // bags per simulated airport in broken.py
  // the numbers read back out of OUT7, so the screen's text always matches the recorded lines
  const R7 = OUT7.map(l => {
    const m = l.match(/formula says ([\d.]+).*?(\d+) of (\d+) alarmed bags banned = ([\d.]+)/);
    return { formula: m[1], banned: +m[2], alarms: +m[3], sim: m[4] };
  });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
  const fmt = n => n.toLocaleString("en");
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  /* ---------- lesson-local styles ---------- */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}grid { display: grid; grid-template-columns: repeat(40, minmax(0, 1fr)); gap: 1px; max-width: 520px; margin: 12px 0 0; }
      .${P}grid i { display: block; aspect-ratio: 1; background: var(--line); border-radius: 1px; box-sizing: border-box; }
      .${P}grid i.b { background: var(--ink); }
      .${P}grid i.m { background: var(--muted); }
      .${P}grid i.f { background: var(--surface); border: 1.5px solid var(--ink); }
      .${P}grid.focus i:not(.b):not(.f) { opacity: 0.35; }
      .${P}key { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 8px 0 0; font: 500 13px/1.4 var(--font); color: var(--muted); }
      .${P}key span { display: inline-flex; align-items: center; gap: 6px; }
      .${P}key i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; box-sizing: border-box; background: var(--line); }
      .${P}key i.b { background: var(--ink); }
      .${P}key i.m { background: var(--muted); }
      .${P}key i.f { background: var(--surface); border: 1.5px solid var(--ink); }
      .${P}cap { font: 500 13px/1.4 var(--font); color: var(--muted); margin: 8px 0 0; }
      .${P}tally { display: grid; grid-template-columns: auto auto; gap: 2px 14px; margin: 10px 0 0; font: 500 14px/1.5 var(--font); color: var(--ink); max-width: 360px; }
      .${P}tally b { font-family: var(--mono); text-align: right; }
      .${P}pad { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; max-width: 320px; margin: 10px 0 0; }
      .${P}pad button { min-height: 48px; font: 600 18px var(--mono); }
      .${P}pad .wide { grid-column: span 2; font: 600 15px var(--font); }
      .${P}show { font: 600 22px var(--mono); color: var(--ink); min-height: 48px; max-width: 320px; padding: 8px 12px; border: 1.5px solid var(--ink-2); border-radius: 8px; background: var(--surface); margin: 10px 0 0; box-sizing: border-box; }
      .${P}show .ph { color: var(--faint); font-weight: 500; font-size: 16px; }
      .${P}out { font: 500 13px/1.5 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin: 10px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}out .p { color: var(--muted); }
      .${P}rule { font: 600 16px/1.6 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; margin: 12px 0 0; overflow-wrap: anywhere; }
      .${P}rule small { display: block; font: 500 13px/1.5 var(--font); color: var(--muted); margin-top: 4px; }
      .${P}vars .vars b { overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }

  /* ---------- the bag grid: 1,000 tiles, banned bags first, then false alarms ----------
     stage 0 nothing known, 1 banned bags shown, 2 caught vs missed, 3 false alarms too. */
  function grid(stage, focus = false) {
    let h = "";
    for (let i = 0; i < BAGS; i++) {
      let c = "";
      if (i < BANNED && stage >= 1) c = stage >= 2 && i >= CAUGHT ? "m" : "b";
      else if (i >= BANNED && i < BANNED + FALSE && stage >= 3) c = "f";
      h += c ? `<i class="${c}"></i>` : "<i></i>";
    }
    const key = [["", "clean bag, no alarm"]];
    if (stage === 1) key.unshift(["b", "holds a banned item"]);
    if (stage >= 2) key.unshift(["b", "banned item, alarm"], ["m", "banned item, no alarm (missed)"]);
    if (stage >= 3) key.splice(2, 0, ["f", "clean bag, alarm (false alarm)"]);
    return `<div class="${P}grid${focus ? " focus" : ""}" role="img" aria-label="${BAGS} bags as small tiles">${h}</div>
      <div class="${P}key">${key.map(([c, t]) => `<span><i class="${c}"></i>${t}</span>`).join("")}</div>`;
  }

  /* ---------- a number keypad: state { typed }, returns html; wire(el, state, onCheck, repaint) ---------- */
  const pad = (st, ph) => `<div class="${P}show" aria-live="polite">${st.typed ? esc(st.typed) : `<span class="ph">${ph}</span>`}</div>
    <div class="${P}pad">${["7", "8", "9", "⌫", "4", "5", "6", ".", "1", "2", "3", "0"].map(c => `<button type="button" class="btn" data-k="${c}" aria-label="${c === "⌫" ? "delete" : c}">${c}</button>`).join("")}<button type="button" class="btn wide" data-clear>Clear</button><button type="button" class="btn primary wide" data-check>Check</button></div>`;
  function wire(el, st, onCheck, repaint) {
    el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
      const c = b.dataset.k;
      st.typed = c === "⌫" ? st.typed.slice(0, -1) : st.typed.length < 6 && !(c === "." && st.typed.includes(".")) ? st.typed + c : st.typed;
      repaint();
    });
    const cl = el.querySelector("[data-clear]"); if (cl) cl.onclick = () => { st.typed = ""; st.msg = null; repaint(); };
    const ck = el.querySelector("[data-check]"); if (ck) ck.onclick = () => {
      const v = parseFloat(st.typed);
      if (!st.typed || isNaN(v)) { st.msg = ["Type a number first, with the keys above."]; repaint(); return; }
      onCheck(v);
    };
  }

  /* 1. The situation, by hand: count the 1,000 bags. */
  function countBags({ el, done, kit }) {
    css();
    const st = { typed: "", msg: null };
    let k = 0;
    const Q = [
      { ask: `${per(PRIOR)} bags in every 100 hold a banned item. How many of the ${fmt(BAGS)} bags is that?`, right: BANNED,
        why: v => v === per(PRIOR) ? `${v} is the rate per 100 bags. There are ${fmt(BAGS)} bags, ${BAGS / 100} groups of 100, so ${BAGS / 100} × ${per(PRIOR)}.`
          : v === per(PRIOR) * 100 ? `That is ${per(PRIOR)} in every 10. ${per(PRIOR)} in every 100 of ${fmt(BAGS)} bags is ${BAGS / 100} × ${per(PRIOR)}.`
          : `${per(PRIOR)} in every 100: split the ${fmt(BAGS)} bags into ${BAGS / 100} groups of 100, and each group has ${per(PRIOR)} banned bags.` },
      { ask: `The scanner alarms on ${per(HIT)} out of every 100 bags that hold a banned item. Of your ${BANNED} banned bags, how many set it off?`, right: CAUGHT,
        why: v => v === Math.round(BAGS * HIT) ? `That is ${per(HIT)}% of all ${fmt(BAGS)} bags. This rate is only about the bags that hold a banned item: the ${BANNED} filled tiles.`
          : v === MISSED ? `${MISSED} is the number it misses: the bags that hold an item and stay quiet. The question asks how many it catches.`
          : v === BANNED ? `${BANNED} would be every banned bag. The scanner catches ${per(HIT)} in 100 of them, not all.`
          : `${per(HIT)} in every 100 of the ${BANNED} banned bags: ${BANNED} × ${HIT.toFixed(2)}.` },
      { ask: `It also alarms on ${per(FA)} out of every 100 clean bags. How many false alarms come from the clean bags?`, right: FALSE,
        why: v => v === Math.round(BAGS * FA) ? `${v} is ${per(FA)}% of all ${fmt(BAGS)} bags. But ${BANNED} of them hold a banned item; only the ${fmt(CLEAN)} clean bags can give a false alarm.`
          : v === CLEAN ? `${fmt(CLEAN)} is how many clean bags there are. Only ${per(FA)} in every 100 of them alarm.`
          : `Clean bags: ${fmt(BAGS)} − ${BANNED} = ${fmt(CLEAN)}. ${per(FA)} in every 100 of them alarm: ${fmt(CLEAN)} × ${FA.toFixed(2)}.` }
    ];
    const paint = () => {
      const fin = k === Q.length;
      el.innerHTML = `<h1>The scanner that keeps beeping</h1>
        <p class="lead">An airport screener watches a bag scanner. It alarms many times an hour, and every alarm means opening a bag by hand. Most of the bags she opens hold nothing banned. She wants to know: when it beeps, how likely is it that the bag really holds a banned item? The same question comes up whenever an AI model flags something rare, like fraud or a failing part: how much should you trust a flag? Start by counting ${fmt(BAGS)} bags. The rates are made up for this lesson.</p>
        ${grid(k)}
        ${fin ? "" : `<p class="task">${Q[k].ask}</p>${pad(st, "type a number of bags")}`}
        <div class="lpanel">${fin ? kit.feedback(`All ${fmt(BAGS)} bags are counted: ${BANNED} hold a banned item, and ${CAUGHT} of those set off the alarm. ${fmt(CLEAN)} are clean, and ${FALSE} of those set it off anyway. That makes ${ALARMS} alarms in all.`, true)
          : st.msg ? kit.feedback(st.msg[0], st.msg[1]) : ""}</div>`;
      if (fin) return;
      wire(el, st, v => {
        if (v === Q[k].right) {
          st.msg = [`Right: ${v}.`, true]; st.typed = ""; k++;
          paint(); if (k === Q.length) done(); return;
        }
        st.msg = [Q[k].why(v), false]; paint();
      }, paint);
    };
    paint();
  }

  /* 2. By hand: of the alarmed bags, what share is banned? */
  function typeChance({ el, done, kit }) {
    css();
    const st = { typed: "", msg: null };
    let ok = false;
    const near = (v, x) => Math.abs(v - x) <= 0.6;
    const paint = () => {
      el.innerHTML = `<h1>An alarm goes off</h1>
        <p class="lead">The same ${fmt(BAGS)} bags. Only the alarmed bags matter now: the filled tiles (${CAUGHT} real catches) and the outlined tiles (${FALSE} false alarms). The screener does not know which kind she has. She only hears the beep.</p>
        ${grid(3, true)}
        <div class="${P}tally"><span>alarms with a banned item</span><b>${CAUGHT}</b><span>false alarms</span><b>${FALSE}</b><span>all alarms</span><b>${ALARMS}</b></div>
        ${ok ? "" : `<p class="task">A bag sets off the alarm. What is the chance, in percent, that it really holds a banned item? One decimal is enough.</p>${pad(st, "type a percent")}`}
        <div class="lpanel">${st.msg ? kit.feedback(st.msg[0], st.msg[1]) : ""}</div>`;
      if (ok) return;
      wire(el, st, v => {
        if (near(v, POST * 100)) {
          ok = true;
          st.msg = [`Right. ${CAUGHT} of the ${ALARMS} alarmed bags hold a banned item: ${CAUGHT} ÷ ${ALARMS} ≈ <b>${pct(POST)}</b>. The scanner catches ${per(HIT)}% of banned bags, yet only about 1 alarm in ${Math.round(ALARMS / CAUGHT)} is real. The other alarms are clean bags.`, true];
          paint(); done(); return;
        }
        st.msg = [v > 0 && v < 1 ? `That looks like a fraction, not a percent. Multiply by 100: ${CAUGHT} ÷ ${ALARMS} as a percent.`
          : near(v, HIT * 100) ? `${per(HIT)}% is the chance that a banned bag sets off the alarm: ${CAUGHT} of ${BANNED}. Her question runs the other way: of the bags that alarmed, how many are banned? Count among the ${ALARMS} alarms.`
          : near(v, (1 - FA) * 100) ? `${per(1 - FA)}% is how often a clean bag stays quiet. It says nothing about what share of alarms are real. Count: of the ${ALARMS} alarms, how many are banned?`
          : near(v, PRIOR * 100) ? `${per(PRIOR)}% is the share of all bags that hold an item, before any beep. The alarm is new information: count only among the ${ALARMS} alarmed bags.`
          : near(v, CAUGHT / BAGS * 100) ? `That is ${CAUGHT} out of all ${fmt(BAGS)} bags. But she has heard a beep, so the quiet bags are out. Divide by the ${ALARMS} alarms instead.`
          : near(v, CAUGHT / FALSE * 100) ? `That divides by the false alarms only. The real catches are alarms too: divide by all ${ALARMS}, which is ${CAUGHT} + ${FALSE}.`
          : near(v, FALSE / ALARMS * 100) ? `That is the share of alarms that are false: ${FALSE} of ${ALARMS}. The question asks for the share that are real.`
          : `Not quite. Count only the alarmed bags: ${CAUGHT} real and ${FALSE} false. What share of all ${ALARMS} are real?`, false];
        paint();
      }, paint);
    };
    paint();
  }

  /* 3. Spot the idea: why so low? */
  function spot({ el, done, kit }) {
    css();
    let ans = null;
    const perfect = BANNED / (BANNED + FALSE), lowFa = 0.01, better = post(PRIOR, HIT, lowFa), half = post(0.5);
    const opts = ["The scanner misses too many banned bags.",
      `Clean bags far outnumber banned ones. A small false-alarm rate on ${fmt(CLEAN)} clean bags makes more alarms than all ${BANNED} banned bags put together.`,
      `A ${per(FA)}% false-alarm rate is simply a bad scanner. A good scanner would make the alarm about ${per(HIT)}% reliable.`];
    const paint = () => {
      el.innerHTML = `<h1>Why is it so low?</h1>
        <p class="lead">The scanner catches ${per(HIT)} banned bags in 100 and stays quiet on ${per(1 - FA)} clean bags in 100. Both sound good. Yet an alarm is real only ${pct(POST)} of the time.</p>
        <p class="task">What makes an alarm so much less reliable than the scanner's ${per(HIT)}%?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1 ? kit.feedback(`Right. There are ${fmt(CLEAN)} clean bags for every ${BANNED} banned ones, so even ${per(FA)} in 100 of them gives ${FALSE} false alarms, against at most ${BANNED} real ones. Put the same scanner in a place where half the bags held something, and an alarm would be real ${pct(half)} of the time. The machine is the same; the mix of bags changed. How common the thing is before any test, here ${per(PRIOR)} in 100, is called the <b>base rate</b>. An alarm cannot be judged without it.`, true)
          : ans === 0 ? kit.feedback(`Misses are not the problem. Even a scanner that caught all ${BANNED} banned bags would give ${BANNED} real alarms against the same ${FALSE} false ones: ${BANNED} ÷ ${BANNED + FALSE} ≈ ${pct(perfect)}. The false alarms still far outnumber the real ones.`, false)
          : kit.feedback(`Fewer false alarms do help: at 1 in 100 instead of ${per(FA)}, an alarm would be real about ${pct(better)} of the time. Still nowhere near ${per(HIT)}%. And the same ${per(FA)}% scanner, where half the bags held something, would be right ${pct(half)} of the time. What changes the answer most is how rare banned bags are.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Name the pieces: the counts become Bayes' rule. */
  function rule({ el, done, kit }) {
    css();
    const ans = [null, null, null];
    const QS = [
      { name: "P(banned)", say: "the chance a bag holds a banned item, before any beep",
        opts: [`${BANNED} / ${fmt(BAGS)}`, `${CAUGHT} / ${ALARMS}`, `${BANNED} / ${ALARMS}`], right: 0,
        no: [null, `${CAUGHT} / ${ALARMS} is the answer you typed on screen 2, the chance after the beep. P(banned) is before any beep: count over all ${fmt(BAGS)} bags.`,
          `${BANNED} / ${ALARMS} mixes two groups: the banned bags counted over all bags, divided by the alarms. Before any beep, the whole group is all ${fmt(BAGS)} bags.`],
        yes: `Right: ${BANNED} of ${fmt(BAGS)} = ${PRIOR}. This is the <b>prior</b>: your belief before the evidence.` },
      { name: "P(alarm | banned)", say: "of the banned bags, the share that alarm",
        opts: [`${CAUGHT} / ${ALARMS}`, `${CAUGHT} / ${BANNED}`, `${CAUGHT} / ${fmt(BAGS)}`], right: 1,
        no: [`${CAUGHT} / ${ALARMS} counts among the alarms: that is P(banned | alarm), the same two words the other way round. The bar says "among the banned bags".`, null,
          `${CAUGHT} / ${fmt(BAGS)} is the share of all bags that are banned and alarm. The bar says to count only among the banned bags.`],
        yes: `Right: ${CAUGHT} of ${BANNED} = ${HIT.toFixed(2)}. It is the scanner's catch rate, called the <b>likelihood</b> of the evidence.` },
      { name: "P(alarm)", say: "the chance any bag sets off the alarm",
        opts: [`${CAUGHT} / ${fmt(BAGS)}`, `${FALSE} / ${fmt(CLEAN)}`, `${ALARMS} / ${fmt(BAGS)}`], right: 2,
        no: [`${CAUGHT} / ${fmt(BAGS)} counts only the real alarms. Clean bags beep too: ${CAUGHT} + ${FALSE} = ${ALARMS}.`,
          `${FALSE} / ${fmt(CLEAN)} is P(alarm | clean): the false-alarm rate among clean bags. P(alarm) counts every alarm over every bag.`, null],
        yes: `Right: ${ALARMS} of ${fmt(BAGS)} = ${(ALARMS / BAGS).toFixed(3)}. It adds both ways an alarm happens: banned bags that alarm plus clean bags that alarm.` }
    ];
    const paint = () => {
      const all = QS.every((q, i) => ans[i] === q.right);
      el.innerHTML = `<h1>The same count, as a rule</h1>
        <p class="lead">P( ) means "the chance of". Read the bar <b>|</b> as "among". P(banned | alarm) means: among the alarmed bags, the chance one is banned. That is what you counted: ${CAUGHT} / ${ALARMS}. <b>Bayes' rule</b> builds it from rates you can measure for the scanner:</p>
        <div class="${P}rule">P(banned | alarm) = P(alarm | banned) × P(banned) ÷ P(alarm)<small>Each piece is a count you already have. Find which.</small></div>
        ${QS.map((q, i) => `<div class="lcase" id="c${i}"><p class="task"><b>${q.name}</b>: ${q.say}. Which count is it?</p>
          ${kit.options(q.opts.map(esc), { picked: ans[i], correct: q.right })}
          ${ans[i] == null ? "" : ans[i] === q.right ? kit.feedback(q.yes, true) : kit.feedback(q.no[ans[i]], false)}</div>`).join("")}
        ${all ? kit.feedback(`Put them in: ${HIT.toFixed(2)} × ${PRIOR} ÷ ${(ALARMS / BAGS).toFixed(3)} = ${(HIT * PRIOR).toFixed(3)} ÷ ${(ALARMS / BAGS).toFixed(3)} ≈ <b>${pct(post(PRIOR))}</b>, the same as ${CAUGHT} ÷ ${ALARMS}. The answer is called the <b>posterior</b>: the belief after the evidence. The rule is your tile count written with rates, so it works without drawing ${fmt(BAGS)} tiles. Notice that the part before ÷ is the chance a bag is banned <i>and</i> alarms: P(alarm | banned) × P(banned) = ${CAUGHT} / ${fmt(BAGS)}.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (QS.every((q, j) => ans[j] === q.right)) done();
      }));
    };
    paint();
  }

  /* 5. Use it with predictions: a rarer item; a second, independent scanner. */
  function predict({ el, done, kit }) {
    css();
    const ans = [null, null];
    const SMALL = post(RARE), TWO = post(post(PRIOR));
    const n = 100000, rb = n * RARE, rc = rb * HIT, rf = (n - rb) * FA;   // per 100,000 bags at the small airport
    const k1 = POST * ALARMS * HIT, k2 = (1 - POST) * ALARMS * FA;        // of the 67 alarmed bags, how many alarm again
    const Q = [
      { opts: [pct(SMALL), pct(POST), pct(HIT, 0)], right: 0,
        no: [null, `The scanner is the same, but banned bags are ${Math.round(PRIOR / RARE)} times rarer. The ${per(FA)}% false alarms now come from almost every bag, against far fewer real catches. The posterior falls with the prior.`,
          `${pct(HIT, 0)} is still the chance a banned bag alarms. It does not tell you what share of alarms are real; that depends on the prior, which is now tiny.`],
        yes: `Right: ${HIT.toFixed(2)} × ${RARE} ÷ (${HIT.toFixed(2)} × ${RARE} + ${(1 - RARE).toFixed(3)} × ${FA.toFixed(2)}) ≈ ${pct(SMALL)}. In ${fmt(n)} bags: ${fmt(rb)} banned, ${fmt(rc)} caught, but ${fmt(rf)} false alarms. About 1 alarm in ${Math.round((rc + rf) / rc)} is real.` },
      { opts: [pct(POST), pct(TWO), pct(HIT, 0)], right: 1,
        no: [`${pct(POST)} ignores the second beep. A second scanner that also alarms is new evidence, and it should move your belief.`, null,
          `${pct(HIT, 0)} is only the second scanner's catch rate. It ignores what you already knew from the first alarm.`],
        yes: `Right. Use ${pct(POST)} as the new prior: ${HIT.toFixed(2)} × ${POST.toFixed(3)} ÷ (${HIT.toFixed(2)} × ${POST.toFixed(3)} + ${(1 - POST).toFixed(3)} × ${FA.toFixed(2)}) ≈ ${pct(TWO)}. In counts: of the ${ALARMS} alarmed bags, about ${k1.toFixed(1)} banned ones alarm again and about ${k2.toFixed(2)} clean ones do. The first answer becomes the next prior. This works only because the second scanner makes its mistakes for its own reasons, independent of the first.` }
    ];
    const paint = () => {
      el.innerHTML = `<h1>Predict before you compute</h1>
        <p class="lead">Use the rule on two changes. P(alarm), the number you divide by, is always "banned and alarm" plus "clean and alarm": prior × ${HIT.toFixed(2)} + (1 − prior) × ${FA.toFixed(2)}.</p>
        <div class="lcase" id="c0"><p class="task">The same scanner works at a small airport where only 1 bag in ${fmt(1 / RARE)} holds a banned item. An alarm goes off. Predict the chance the bag is banned.</p>
        ${kit.options(Q[0].opts, { picked: ans[0], correct: 0, num: true })}
        ${ans[0] == null ? "" : ans[0] === 0 ? kit.feedback(Q[0].yes, true) : kit.feedback(Q[0].no[ans[0]], false)}</div>
        <div class="lcase" id="c1"><p class="task">Back at the first airport (${per(PRIOR)} in 100). A bag alarms, so it is ${pct(POST)} likely to be banned. It goes through a second scanner of a different kind, with the same rates, and that one alarms too. Predict the chance now.</p>
        ${kit.options(Q[1].opts, { picked: ans[1], correct: 1, num: true })}
        ${ans[1] == null ? "" : ans[1] === 1 ? kit.feedback(Q[1].yes, true) : kit.feedback(Q[1].no[ans[1]], false)}</div>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === 0 && ans[1] === 1) done();
      }));
    };
    paint();
  }

  /* 6. From scratch in Python: a replay of the traced run of posterior(0.02, 0.90, 0.05). */
  function scratch({ el, done, kit }) {
    css();
    let i = 0, guess = null;
    const PQ = TRACE.findIndex(t => t.line === 2), right = TRACE[PQ + 1].vars.false_alarms;
    const pOpts = ["0.001", "0.049", "0.05"], pRight = pOpts.indexOf(String(right));
    const pNo = { "0.001": `0.001 is prior × fa_rate = ${PRIOR} × ${FA}. That multiplies by the share of bags that are banned. A false alarm comes from a clean bag, and clean bags are 1 − prior = ${(1 - PRIOR).toFixed(2)} of all bags.`,
      "0.05": `0.05 is the false-alarm rate alone: it counts as if every bag were clean. Only ${(1 - PRIOR).toFixed(2)} of the bags are clean, so multiply by 1 − prior.` };
    const say = j => {
      const t = TRACE[j];
      if (t.event === "return") return `It returns ${RUN.result}: ${pct(+RUN.result)}, the ${CAUGHT} ÷ ${ALARMS} you counted. Our run then called it again with that answer as the prior, <code>posterior(after_one, 0.90, 0.05)</code>, and got ${RUN.after_two}: the ${pct(+RUN.after_two)} you predicted for the second scanner.`;
      if (t.line === 1) return `Called as <code>posterior(0.02, 0.90, 0.05)</code>. The real_alarms line runs next: the share of all bags that are banned <i>and</i> alarm.`;
      if (t.line === 2) return `real_alarms is ${t.vars.real_alarms}: ${CAUGHT} of ${fmt(BAGS)}. The long tail is how a computer stores decimals, not a mistake. The false_alarms line runs next: the share that are clean and alarm.`;
      if (t.line === 3) return `false_alarms is ${t.vars.false_alarms}: ${FALSE} of ${fmt(BAGS)}. The all_alarms line adds both ways to get an alarm.`;
      return `all_alarms is ${t.vars.all_alarms}: ${ALARMS} of ${fmt(BAGS)}. The return line divides: of all alarms, the share that are banned.`;
    };
    const paint = () => {
      const t = TRACE[i], v = t.vars;
      const ask = i === PQ, held = ask && guess !== pRight;
      el.innerHTML = `<h1>The rule in plain Python</h1>
        <p class="lead">Four lines, each one a count from the bag grid turned into a share of all bags. <code>hit_rate</code> is the catch rate and <code>fa_rate</code> the false-alarm rate. We ran it on our Mac and recorded every line it ran.</p>
        <p class="task">Step through the run. On the false_alarms line you predict the value before you see it.</p>
        ${kit.code(CODE6, t.line)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || held ? "disabled" : ""}>Next step</button></div>
        <div class="${P}vars"><div class="vars">${["real_alarms", "false_alarms", "all_alarms"].map(k => `<span>${k} <b>${k in v ? v[k] : "–"}</b></span>`).join("")}<span>step <b>${i + 1} / ${TRACE.length}</b></span></div></div>
        ${t.event === "return" ? `<div class="${P}out"><span class="p">printed by our run</span>\nafter_one ${RUN.result}\nafter_two ${RUN.after_two}</div>` : ""}
        ${ask ? `<div class="lcase" id="c-pred"><p class="task">Predict: with prior = ${PRIOR} and fa_rate = ${FA}, what will false_alarms be?</p>
          ${kit.options(pOpts, { picked: guess, correct: pRight, num: true })}
          ${guess != null && guess !== pRight ? kit.feedback(pNo[pOpts[guess]], false) : guess === pRight ? kit.feedback(`Right: (1 − ${PRIOR}) × ${FA} = ${right}. Step on to see it.`, true) : ""}</div>` : ""}
        ${ask ? "" : kit.feedback(say(i))}
        <p class="${P}cap">Recorded run on our Mac, Python 3.14, ${RUN_DATE}. The highlighted line is the one about to run; the values are as they are at that moment.</p>`;
      el.querySelectorAll("#c-pred .lopts button").forEach(b => b.onclick = () => { guess = +b.dataset.i; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 7. Broken on purpose: a teammate's posterior() ignores the base rate. */
  function broken({ el, done, kit }) {
    css();
    const a = [null, null];
    const lines = [1, 2, 3, 4];
    const L = lines.map(n => `<code>${esc(CODE7[n].trim())}</code>`);
    const noLine = {
      0: `This line is right: prior × hit_rate is the share of all bags that are banned and alarm, ${PRIOR} × ${HIT} = ${(PRIOR * HIT).toFixed(3)}, which is ${CAUGHT} of ${fmt(BAGS)}.`,
      2: `Adding is right: an alarm comes from a banned bag or from a clean bag, so the two shares add up. The sum is wrong only because one of its parts is.`,
      3: `Dividing is right: of all alarms, the share that are banned. It is the last step on screen 6 too. The number going in is already wrong.`
    };
    const Q2 = [`prior multiplies every part, above and below the division, so it cancels out: the answer is ${HIT} ÷ (${HIT} + ${FA}) whatever the airport.`,
      "The simulation used too few bags, so its numbers are noise.",
      "Rounding: the formula prints three decimals and hides the difference."];
    const paint = () => {
      const ok0 = a[0] === 1, ok1 = a[1] === 0;
      el.innerHTML = `<h1>Broken on purpose: the report</h1>
        <p class="lead">A teammate wrote <code>posterior()</code> for a dashboard. To check it, the same script makes up ${fmt(SIM_N)} random bags with the same rates and counts how many alarmed bags were really banned. Its random numbers start from a fixed seed, so a rerun gives the same counts. This is the real output of that script.</p>
        ${kit.code(CODE7, -1)}
        <div class="${P}out"><span class="p">output of our run</span>\n${OUT7.map(esc).join("\n")}</div>
        <div class="lcase" id="c0"><p class="task">The formula says ${R7[0].formula} and the count says about ${(+R7[0].sim).toFixed(2)}. Which line is the cause?</p>
        ${kit.options(L, { picked: a[0], correct: 1 })}
        ${a[0] == null ? "" : ok0 ? kit.feedback(`Right. A false alarm comes from a clean bag, and clean bags are 1 − prior of all bags. This line multiplies by prior, the banned share. The fix: <code>false_alarms = (1 - prior) * fa_rate</code>, as on screen 6.`, true) : kit.feedback(noLine[a[0]], false)}</div>
        ${ok0 ? `<div class="lcase" id="c1"><p class="task">Both airports got exactly ${R7[0].formula}, though one has banned bags ${Math.round(PRIOR / RARE)} times rarer. Why?</p>
        ${kit.options(Q2.map(esc), { picked: a[1], correct: 0 })}
        ${a[1] == null ? "" : ok1 ? kit.feedback(`Right. With prior in both parts, it divides out, and the function never uses the base rate. It is the mistake from screen 2 written as code: judging an alarm by the scanner's rates alone. ${R7[0].formula} is what the correct rule gives when half the bags are banned (our run printed ${RUN.half_banned} for a prior of 0.5). A test that gives the same answer for a common and a rare case is a cheap way to catch this bug.`, true)
          : a[1] === 1 ? kit.feedback(`${fmt(SIM_N)} bags gave ${fmt(R7[0].alarms)} alarms at the first airport: plenty. And the gap is not small noise; ${R7[0].formula} against ${R7[0].sim} is the whole story. The formula is wrong, not the count.`, false)
          : kit.feedback(`Three decimals cannot turn ${R7[0].sim} into ${R7[0].formula}. Look at the formula: the same ${R7[0].formula} for two different priors means the prior has no effect on it at all.`, false)}</div>` : ""}
        <p class="${P}cap">Recorded run on our Mac, Python 3.14, ${RUN_DATE}.</p>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        a[i] = +b.dataset.i; paint();
        if (a[0] === 1 && a[1] === 0) done();
      }));
    };
    paint();
  }

  /* 8. The big picture, with a task on what must be re-measured. */
  function bigPicture({ el, done, kit }) {
    css();
    let ans = null;
    const opts = ["The base rate: how many bags at the cargo terminal hold a banned item",
      "The scanner's catch rate and false-alarm rate",
      `Nothing: the rule and the rates are the same, so the ${pct(POST, 0)} still holds`];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What for:</b> turning "how often does the test fire on each kind of case" into "how much should I trust this alarm". Fraud alerts, medical screening, a model that flags rare failures.</p>
        <p class="lead"><b>When:</b> the thing you look for is rare, and you know, or can measure, the base rate, the catch rate and the false-alarm rate. Each new independent check updates the last answer.</p>
        <p class="lead"><b>When not:</b> if you already have a log of checked alarms, count the real ones directly. Do not chain two checks that fail for the same reason. Do not reuse a base rate from another place or time.</p>
        <p class="lead"><b>Cost:</b> the arithmetic is trivial. The rates are not: someone must open and label bags to measure them, and must measure again when things change.</p>
        <p class="task">The scanner moves, unchanged, to a cargo terminal where banned items are much more common. Which number must be measured again before trusting an alarm?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0 ? kit.feedback(`Right. The machine is the same, so its two rates are too. The prior changed, and you saw on screen 3 that the prior moves the answer most: the same scanner gives ${pct(post(0.5))} where half the bags are banned.`, true)
          : ans === 1 ? kit.feedback(`The scanner moved unchanged, so how it reacts to a banned bag or a clean bag stays the same. What changed is the mix of bags it sees.`, false)
          : kit.feedback(`The rule is the same, but one input is not. With more banned bags the prior is higher, and the posterior with it: the ${pct(POST, 0)} belonged to the first airport's mix of bags.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, with two "no" cases. */
  const BOT = { prior: 1 / 200, hit: 0.98, fa: 0.03 };
  const LAB = { prior: 1 / 100, hit: 0.95, fa: 0.04 };
  const LAB2 = post(post(LAB.prior, LAB.hit, LAB.fa), LAB.hit, LAB.fa);
  const CASES = [
    [`A camera on a bottling line flags cracked bottles. It flags 98 in 100 cracked bottles and 3 in 100 good ones. About 1 bottle in 200 is cracked. A worker wants to know how many flagged bottles are really cracked before deciding whether to check each one by hand.`, true,
      `Yes. A rare thing, a detector with known rates, and a question about the flags: ${BOT.hit} × ${BOT.prior} ÷ (${BOT.hit} × ${BOT.prior} + ${1 - BOT.prior} × ${BOT.fa}) ≈ ${pct(post(BOT.prior, BOT.hit, BOT.fa))}. Most flags are good bottles, so a quick hand check after each flag is worth it.`,
      `It has every part of the airport: a rare thing (1 in 200), a detector's two rates, and a question about the flags. Bayes' rule gives about ${pct(post(BOT.prior, BOT.hit, BOT.fa))}: most flagged bottles are fine.`],
    [`A shop's analysts checked every one of 5,000 fraud alerts from last year by hand; 600 were real fraud. The manager asks what share of alerts are real.`, false,
      `No. The answer is already counted among the alerts themselves: 600 of 5,000 = ${pct(600 / 5000, 0)}. Bayes' rule is for when you know the rates the other way round (how often fraud triggers an alert) and the base rate, but not this count.`,
      `Bayes' rule turns P(alert | fraud) and the base rate into P(fraud | alert). Here P(fraud | alert) was counted directly: 600 of 5,000 = ${pct(600 / 5000, 0)}. Nothing is left to compute.`],
    [`About 1 person in ${1 / LAB.prior} has a rare infection. A lab test is positive for ${per(LAB.hit)} in 100 infected people and for ${per(LAB.fa)} in 100 healthy ones. A patient's test is positive. The lab runs the same test again on the same blood sample, and it is positive again. The doctor updates twice with those rates and gets ${pct(LAB2)}.`, false,
      `No. A second update needs evidence that fails for its own reasons. Whatever in this sample gave a false positive the first time is still in the same blood, tested the same way, so it is likely to do it again. The repeat adds almost nothing, so ${pct(LAB2)} is too high. A different kind of test is new evidence.`,
      `The rule is fine; the evidence is not new. The same test on the same sample repeats the same mistake: whatever caused a first false positive is still there for the second. Chaining updates is right only when each check makes its errors independently.`]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Bayes' rule here?</h1>
        <p class="lead">${WORDS[CASES.length]} new situations, away from the airport.</p>
        <p class="task">For each one, decide: is Bayes' rule, as you used it, the right tool? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the browser exercise and the next lesson. */
  function whatNext({ el, done, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now tell P(alarm | banned) from P(banned | alarm), count your way from one to the other, write it as Bayes' rule, and feed one answer in as the next prior. You also know the bug to look for: a formula that ignores the base rate gives the same answer everywhere.</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>posterior(prior, hit_rate, fa_rate)</code> yourself and use it twice, for a bag that alarms on two independent scanners.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. The rates you used here were numbers measured from data; the next lesson looks at a model as a function whose numbers are tuned to data.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Conditional probability and Bayes' rule",
    checked: "2026-11-14",
    sources: [
      "https://plato.stanford.edu/entries/bayes-theorem/",
      "https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_class03-prep.pdf",
      "https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_class11-prep.pdf",
      "https://docs.python.org/3/library/random.html",
      "https://docs.python.org/3/tutorial/floatingpoint.html"
    ],
    interview: [{
      q: "Your fraud model catches 95% of fraud and flags only 1% of good transactions. The operations team says most of its alerts are false. Is the model broken? What do you tell them, and what do you do?",
      good: [
        "Not necessarily: fraud is rare, so 1% of a huge number of good transactions can outnumber all the real fraud",
        "Work it through with the base rate: for example at 1 fraud in 1,000, only about 9% of alerts are real",
        "Measure the share of real alerts directly from checked alerts, and the base rate per segment, since it differs by region or channel",
        "Options: lower the false-positive rate (a stricter threshold), add a second independent check before a human looks, or rank alerts so people see the likeliest first"
      ],
      weak: "Say the model is bad and retrain it, without working out how the base rate turns a small false-positive rate into most of the alerts."
    }, {
      q: "A teammate's function gives the same probability for an alert in every region, though fraud is ten times more common in one of them. Where do you look?",
      good: [
        "The base rate is probably cancelling out or missing: the posterior must change when the prior changes",
        "Check the false-positive part: it must be multiplied by 1 − prior, not by the prior",
        "Test it against a simple count or a simulation with known rates",
        "Add a test that a common and a rare case give different answers"
      ],
      weak: "Assume regions really behave the same, or tune the numbers until one region looks right, without checking how the prior enters the formula."
    }],
    screens: [countBags, typeChance, spot, rule, predict, scratch, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-k="2"]', "[data-check]"], right: ["[data-clear]", ...[BANNED, CAUGHT, FALSE].flatMap(n => [...String(n)].map(c => `[data-k="${c}"]`).concat("[data-check]"))] },
      { wrong: ['[data-k="9"]', '[data-k="0"]', "[data-check]"], right: ["[data-clear]", ...(POST * 100).toFixed(1).split("").map(c => `[data-k="${c}"]`), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-next]", "#c-pred [data-wrong]"], right: ["#c-pred [data-right]", ...Array(TRACE.length - 2).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
