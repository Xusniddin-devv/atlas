/* Lesson: is a 2-point change real? Error bars by resampling.
   Story: a city parking-permit help bot. The team wants to ship a new prompt because its golden-set score rose
   from 78 to 80 on 40 cases. Ideas: (1) a bootstrap error bar on one score: redraw the 40 results with repeats,
   rescore, read the spread; (2) compare two prompts on the same resampled cases (a paired bootstrap) and ship a
   claim only when the range of differences leaves 0 out.
   Data: OLD and NEW are the story's fixed example eval report (written for the lesson, not model output: no model
   was called). Every resample, histogram, interval and trace step comes from the run in
   docs/ai-path/runs/s5b-is-change-real/ (bootstrap.py, bootstrap.out.txt, env.txt). Every other number on screen
   is computed here from that data. No recorded model calls. Lesson-local picture: a histogram helper with its own
   CSS (the shared bars() prints a number on every bar, too cramped for 20 bins at phone width). */
(() => {
  const ID = "s5b-is-change-real", P = `lx-${ID}-`;
  const r1 = x => String(Math.round(x * 10) / 10);
  const pctTxt = x => `${r1(100 * x)}%`;

  /* ---------- Data from docs/ai-path/runs/s5b-is-change-real/bootstrap.out.txt ---------- */
  // 1 = the case passed, 0 = it failed. Case numbers 0..39 as in the run.
  const OLD = "1110110111111101110111010111111110101101".split("").map(Number);
  const NEW = "1111110110111111110111110110111010111101".split("").map(Number);
  const N = OLD.length;
  // ten resamples drawn with numpy default_rng(0): case numbers picked, with repeats (lines hand_0 .. hand_9)
  const HAND = [[34, 25, 20, 10, 12, 1, 3, 0, 7, 32, 25, 36, 20, 24, 38, 29, 25, 21, 22, 37, 11, 32, 26, 0, 15, 34, 22, 1, 30, 29, 33, 7, 3, 34, 0, 21, 3, 11, 19, 16], [16, 1, 0, 4, 0, 26, 21, 25, 10, 24, 30, 15, 18, 39, 32, 39, 15, 27, 38, 26, 33, 27, 28, 15, 35, 5, 23, 28, 33, 21, 15, 12, 16, 19, 28, 35, 2, 37, 21, 14], [26, 22, 10, 12, 28, 23, 20, 13, 30, 15, 13, 35, 10, 9, 28, 24, 1, 3, 15, 33, 16, 31, 12, 9, 31, 35, 3, 2, 26, 13, 22, 6, 34, 18, 35, 31, 28, 9, 30, 2], [22, 16, 39, 7, 37, 3, 24, 23, 35, 11, 36, 26, 35, 7, 30, 37, 1, 14, 25, 4, 20, 25, 30, 37, 16, 17, 18, 38, 7, 19, 1, 17, 37, 24, 13, 39, 24, 37, 0, 18], [33, 30, 16, 19, 16, 21, 9, 31, 3, 16, 11, 29, 29, 28, 36, 37, 7, 4, 5, 29, 38, 37, 26, 38, 34, 0, 4, 34, 3, 39, 33, 38, 14, 5, 20, 38, 14, 35, 15, 32], [9, 19, 13, 9, 35, 32, 5, 36, 38, 10, 17, 21, 26, 17, 5, 37, 27, 1, 32, 29, 7, 24, 20, 1, 37, 28, 12, 0, 3, 30, 5, 20, 35, 37, 10, 2, 19, 33, 24, 2], [26, 13, 9, 17, 34, 38, 5, 22, 30, 10, 10, 9, 8, 35, 8, 9, 5, 4, 31, 11, 32, 23, 34, 22, 30, 32, 2, 22, 18, 11, 18, 16, 19, 32, 33, 25, 28, 38, 25, 14], [3, 22, 9, 23, 1, 33, 37, 5, 32, 16, 1, 36, 37, 1, 23, 32, 31, 16, 34, 33, 4, 0, 4, 14, 4, 3, 10, 26, 20, 10, 38, 28, 25, 37, 31, 5, 1, 34, 16, 2], [19, 15, 17, 17, 12, 19, 19, 39, 27, 31, 0, 12, 39, 10, 20, 34, 25, 35, 6, 20, 25, 13, 22, 39, 29, 12, 2, 7, 10, 35, 10, 32, 10, 26, 21, 38, 22, 37, 38, 29], [25, 34, 39, 9, 22, 5, 4, 26, 1, 28, 32, 6, 27, 15, 35, 36, 23, 22, 28, 23, 29, 7, 31, 21, 30, 20, 12, 3, 21, 39, 1, 22, 17, 0, 21, 30, 29, 39, 21, 23]];
  // 10,000 resamples of the new prompt's score, default_rng(1) (line new_hist)
  const NEW_HIST = { scores: [52.5, 57.49999999999999, 60.0, 62.5, 65.0, 67.5, 70.0, 72.5, 75.0, 77.5, 80.0, 82.5, 85.0, 87.5, 90.0, 92.5, 95.0, 97.5, 100.0], counts: [2, 11, 19, 52, 117, 222, 428, 711, 1078, 1391, 1565, 1528, 1267, 867, 449, 208, 67, 16, 2] };
  // 10,000 paired resamples of new - old, default_rng(1) (line diff_hist)
  const DIFF_HIST = { scores: [-22.5, -20.0, -17.5, -15.0, -12.5, -10.0, -7.5, -5.0, -2.5, 0.0, 2.5, 5.0, 7.5, 10.0, 12.5, 15.0, 17.5, 20.0, 22.5, 25.0, 27.5], counts: [2, 3, 18, 51, 116, 245, 475, 799, 1156, 1350, 1523, 1370, 1174, 821, 468, 256, 99, 51, 16, 6, 1] };
  // copied from the run: the 95% range with 400 cases at the same pass rate (line new400_interval_95),
  // and the range when the two prompts are resampled separately, not paired (line unpaired_interval_95)
  const BAR400 = [76.0, 84.0];
  const UNPAIRED = [-15.000000000000002, 19.999999999999996];
  // the traced call paired_bootstrap(old, new, 3, default_rng(2)) (lines "step" and "trace_result"): picks of each
  // draw, then one row per step: [line, event, draw (index into TRACE_PICKS, -1 none), new_score, old_score, diffs]
  const TRACE_PICKS = [[33, 10, 4, 11, 16, 32, 18, 3, 13, 24, 32, 29, 39, 7, 35, 2, 22, 10, 8, 26, 12, 22, 10, 6, 29, 17, 27, 26, 37, 16, 8, 25, 37, 38, 34, 27, 15, 15, 1, 7], [13, 13, 23, 20, 27, 35, 35, 31, 39, 12, 36, 36, 8, 18, 22, 27, 28, 4, 19, 4, 38, 8, 17, 35, 20, 27, 19, 33, 23, 25, 18, 16, 23, 20, 31, 23, 18, 34, 8, 17], [19, 35, 17, 24, 3, 33, 17, 19, 3, 27, 25, 13, 30, 20, 2, 8, 10, 4, 20, 1, 20, 28, 23, 18, 10, 35, 12, 33, 17, 15, 27, 38, 31, 23, 4, 30, 31, 16, 14, 7]];
  const TRACE = [
    [1, "l", -1, null, null, null],
    [2, "l", -1, null, null, null],
    [3, "l", -1, null, null, []],
    [4, "l", -1, null, null, []],
    [5, "l", 0, null, null, []],
    [6, "l", 0, 82.5, null, []],
    [7, "l", 0, 82.5, 77.5, []],
    [3, "l", 0, 82.5, 77.5, [5.0]],
    [4, "l", 0, 82.5, 77.5, [5.0]],
    [5, "l", 1, 82.5, 77.5, [5.0]],
    [6, "l", 1, 75.0, 77.5, [5.0]],
    [7, "l", 1, 75.0, 77.5, [5.0]],
    [3, "l", 1, 75.0, 77.5, [5.0, -2.5]],
    [4, "l", 1, 75.0, 77.5, [5.0, -2.5]],
    [5, "l", 2, 75.0, 77.5, [5.0, -2.5]],
    [6, "l", 2, 77.5, 77.5, [5.0, -2.5]],
    [7, "l", 2, 77.5, 75.0, [5.0, -2.5]],
    [3, "l", 2, 77.5, 75.0, [5.0, -2.5, 2.5]],
    [8, "l", 2, 77.5, 75.0, [5.0, -2.5, 2.5]],
    [8, "r", 2, 77.5, 75.0, [5.0, -2.5, 2.5]]
  ];
  const TRACE_RESULT = [-2.25, 4.875];
  const DRAWS = 3, BIG_DRAWS = 10000;

  /* ---------- Derived, computed here ---------- */
  const sum = a => a.reduce((s, x) => s + x, 0);
  const STEP = 100 / N;                                     // points one case is worth
  const OLD_PASS = sum(OLD), NEW_PASS = sum(NEW);
  const OLD_SCORE = 100 * OLD_PASS / N, NEW_SCORE = 100 * NEW_PASS / N;
  const SHOWN_OLD = Math.round(OLD_SCORE), SHOWN_NEW = Math.round(NEW_SCORE); // what the dashboard shows
  const idx = [...Array(N).keys()];
  const FIXED = idx.filter(i => !OLD[i] && NEW[i]), BROKE = idx.filter(i => OLD[i] && !NEW[i]);
  const CHANGED = [...FIXED, ...BROKE].sort((a, b) => a - b), SAME = idx.filter(i => OLD[i] === NEW[i]);
  const passOn = (res, picks) => sum(picks.map(i => res[i]));
  const HAND_SCORES = HAND.map(p => 100 * passOn(NEW, p) / N);
  const total = h => sum(h.counts);
  // numpy.percentile, default method "linear", read off a histogram of the sorted values
  const pctl = (h, q) => {
    const n = total(h), pos = q / 100 * (n - 1), lo = Math.floor(pos), f = pos - lo;
    const at = i => { let c = 0; for (let k = 0; k < h.counts.length; k++) { c += h.counts[k]; if (i < c) return h.scores[k]; } return h.scores[h.scores.length - 1]; };
    return at(lo) + f * (at(lo + 1) - at(lo));
  };
  const share = (h, ok) => sum(h.counts.filter((_, k) => ok(h.scores[k]))) / total(h);
  const NEW_LO = pctl(NEW_HIST, 2.5), NEW_HI = pctl(NEW_HIST, 97.5);
  const D_LO = pctl(DIFF_HIST, 2.5), D_HI = pctl(DIFF_HIST, 97.5);
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const inRange = (lo, hi) => s => s > lo - 1e-6 && s < hi + 1e-6;
  const W40 = NEW_HI - NEW_LO, W400 = BAR400[1] - BAR400[0];
  const caseKey = i => `${Math.floor(i / 8)},${i % 8}`;
  const caseKey5 = i => `${Math.floor(i / 5)},${i % 5}`;
  const mark = v => v ? "✓" : "✗";

  /* ---------- Lesson-local picture: a histogram ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}h{display:flex;align-items:flex-end;gap:2px;height:120px;border-bottom:1px solid var(--line);margin:4px 0 0}
      .${P}h i{flex:1 1 0;min-width:0;background:var(--ink-2);display:block}
      .${P}h i.gone{background:var(--line)}
      .${P}h i.enter{background:var(--good)}
      .${P}h i.zero{background:transparent}
      .${P}u{display:flex;gap:2px;font:12px/1.6 var(--mono);color:var(--muted);margin-bottom:12px}
      .${P}u span{flex:1 1 0;min-width:0;text-align:center;overflow:visible;white-space:nowrap}
      .${P}rng{font:14px var(--mono);color:var(--ink);margin:6px 0 2px}
      .${P}btn{min-height:44px;margin:8px 0}
    `;
    document.head.appendChild(s);
  }
  // bins: the scores; counts: how many resamples landed on each; cls: per-bin state; every: label every n-th point value
  function hist(bins, counts, { cls = {}, title = "", labelIf = () => false } = {}) {
    const mx = Math.max(1, ...counts);
    return `<div class="lp-cap" style="margin-top:16px">${title}</div>
      <div class="${P}h" role="img" aria-label="${title}">${counts.map((c, k) => `<i class="${c ? cls[k] || "" : "zero"}" style="height:${c / mx * 100}%" title="${r1(bins[k])}: ${c}"></i>`).join("")}</div>
      <div class="${P}u" aria-hidden="true">${bins.map(b => `<span>${labelIf(b) ? r1(b) : ""}</span>`).join("")}</div>`;
  }
  const BINS = Array.from({ length: 20 }, (_, k) => 52.5 + k * STEP); // 52.5 .. 100, one bin per possible score
  const tens = b => near(b % 10, 0);

  /* 1. The situation: what does a 2-point rise stand for? */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [`${r1((SHOWN_NEW - SHOWN_OLD) / 100 * N)} of a case: ${SHOWN_NEW - SHOWN_OLD}% of ${N}`, "One case", `Two cases: one point each`];
    const paint = () => {
      el.innerHTML = `<h1>Ship the new prompt?</h1>
        <p class="lead">You work on the help bot of a city's parking-permit office. Residents ask it about visitor permits, zones and renewals. The team keeps a golden set of <b>${N} cases</b>: a real question and a check the answer must pass. The old prompt scores <b>${SHOWN_OLD}</b> on the dashboard, the new prompt <b>${SHOWN_NEW}</b>. The team lead wants to ship it with the note "answers improved". Every prompt change in an AI product raises the same question: did the score move because of the prompt, or by chance?</p>
        <p class="task">A score is the share of the ${N} cases that pass, out of 100. How many cases does the ${SHOWN_NEW - SHOWN_OLD}-point rise stand for?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. Each case is worth 100 / ${N} = <b>${r1(STEP)} points</b>, so scores move in steps of ${r1(STEP)}. The old prompt passed ${OLD_PASS} cases (${r1(OLD_SCORE)}, which the dashboard rounds to ${SHOWN_OLD}); the new one passed ${NEW_PASS} (${r1(NEW_SCORE)}). The whole gain is one case. Could one case go the other way just because of which ${N} questions ended up in the set? That is this lesson's question.`, true)
          : ans === 0 ? kit.feedback(`A case passes or fails as a whole, so the number of passes is always a whole number. With ${N} cases a score can only move in steps of 100 / ${N} = ${r1(STEP)} points; "${SHOWN_NEW - SHOWN_OLD} points" is the dashboard rounding ${r1(OLD_SCORE)} up to ${SHOWN_OLD}.`, false)
          : kit.feedback(`One point per case would need 100 cases. Here each case is worth 100 / ${N} = ${r1(STEP)} points, so two cases would be a ${r1(2 * STEP)}-point rise.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. By hand: draw ten resamples of the new prompt's 40 results, then judge the 2.5-point gap. */
  function byHand({ el, done, kit }) {
    style();
    let k = 0, ans = null;
    const paint = () => {
      const last = k ? HAND[k - 1] : null;
      const times = idx.map(i => last ? last.filter(p => p === i).length : 0);
      const rows = Array.from({ length: N / 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => { const i = r * 8 + c; return last ? String(times[i]) : mark(NEW[i]); }));
      const cls = {};
      idx.forEach(i => { cls[caseKey(i)] = !last ? (NEW[i] ? "in" : "no") : !times[i] ? "gone" : NEW[i] ? "in" : "no"; });
      const sc = HAND_SCORES.slice(0, k);
      const counts = BINS.map(b => sc.filter(s => near(s, b)).length);
      const lo = Math.min(...sc), hi = Math.max(...sc);
      const fin = k === HAND.length;
      const opts = [`Yes: ${r1(NEW_SCORE)} is higher than ${r1(OLD_SCORE)}`, `Not proven: the score moves by much more than ${r1(STEP)} points when the cases change`, `No: some resamples scored under ${r1(OLD_SCORE)}, so the new prompt is worse`];
      el.innerHTML = `<h1>Draw new golden sets from the old one</h1>
        <p class="lead">These are the new prompt's ${N} results, ${NEW_PASS} passed. A different ${N} questions could have scored higher or lower. You cannot write new questions right now, so imitate a new set: draw ${N} cases from these ${N} at random, <b>with repeats</b> (a case can come up twice, another not at all), and score the draw. That is one <b>resample</b>.</p>
        <p class="task">${fin ? `Look at the spread of your ${HAND.length} scores, then answer.` : `Draw ${HAND.length} resamples and watch where the scores land.`}</p>
        ${kit.pics.grid(rows, { cls, title: last ? `resample ${k}: how many times each case was drawn` : `the new prompt's ${N} results (✓ pass, ✗ fail)` })}
        ${last ? kit.pics.key([["in", "passing case, drawn"], ["no", "failing case, drawn"], ["gone", "not drawn this time"]]) : ""}
        ${fin ? "" : `<button type="button" class="btn ${P}btn" data-draw>Draw resample ${k + 1} of ${HAND.length}</button>`}
        ${last ? `<div class="sum">${r1(HAND_SCORES[k - 1])}<small>resample ${k}: ${passOn(NEW, last)} of the ${N} drawn cases pass</small></div>` : ""}
        ${k ? hist(BINS, counts, { title: `your ${k} resample score${k > 1 ? "s" : ""}: how many landed on each score`, labelIf: tens }) : ""}
        <div class="lpanel">
          ${fin ? `<div class="${P}rng">your scores ran from <b>${r1(lo)}</b> to <b>${r1(hi)}</b>: ${r1(hi - lo)} points apart</div>` : ""}
            <p class="task">${fin ? "Same prompt, same answers, only the cases changed. " : `After your ${HAND.length} draws: `}Is the new prompt's ${r1(NEW_SCORE)} clearly better than the old ${r1(OLD_SCORE)}?</p>
            ${kit.options(opts.map(kit.esc), { picked: ans, correct: fin ? 1 : null })}
            ${ans == null || !fin ? "" : ans === 1
              ? kit.feedback(`Right. The new prompt alone scored anywhere from ${r1(lo)} to ${r1(hi)} depending on which cases were drawn. A ${r1(NEW_SCORE - OLD_SCORE)}-point gap is far smaller than that spread, so it could come from the cases, not the prompt.`, true)
              : ans === 0 ? kit.feedback(`Higher on these ${N} cases, yes. But the new prompt itself moved ${r1(hi - lo)} points across your draws, with nothing changed but the cases. A ${r1(NEW_SCORE - OLD_SCORE)}-point gap sits well inside that wobble.`, false)
              : kit.feedback(`Every resample here scores the same new prompt. Landing under ${r1(OLD_SCORE)} in some draws is the same wobble that put others at ${r1(hi)}. It shows noise, not that the prompt is worse.`, false)}
        </div>`;
      const d = el.querySelector("[data-draw]");
      if (d) d.onclick = () => { k++; ans = null; paint(); };
      el.querySelectorAll(".lopts button").forEach(b => { if (!fin) b.disabled = true; b.onclick = () => { ans = +b.dataset.i; paint(); if (fin && ans === 1) done(); }; });
    };
    paint();
  }

  /* 3. Spot the idea: why does redrawing the same results tell you anything? */
  function spotIdea({ el, done, kit }) {
    let ans = null;
    const opts = [
      `The ${N} cases stand in for all the questions residents could ask. Drawing ${N} from them with repeats acts like writing a fresh golden set, so the spread shows how much the score depends on which cases you happened to pick.`,
      "Each resample adds new cases, so the set grows and the score gets more exact.",
      "It shows how much the model's answers change from one run to the next."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why does this work?</h1>
        <p class="lead">You did not run the bot again, and nobody wrote a new question. Yet the ${HAND.length} draws gave scores from ${r1(Math.min(...HAND_SCORES))} to ${r1(Math.max(...HAND_SCORES))}.</p>
        <p class="task">Why does redrawing the same ${N} results tell you how much the score could move?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0
          ? kit.feedback(`Right. Your golden set is one sample of the questions residents ask. You cannot draw more samples from the real world for free, so you draw them from the best picture of it you have: the set itself. The repeats matter: without them every draw would be the same ${N} cases and the same score. This is the <b>bootstrap</b>, a method from statistics: resample your data with repeats, recompute the score each time, and read the spread. The spread is the <b>error bar</b> on your score.`, true)
          : ans === 1 ? kit.feedback(`No new case ever appears. A resample repeats some of the ${N} and leaves others out; it still has ${N} cases. The set never grows, which is why the scores keep spreading out instead of settling down.`, false)
          : kit.feedback(`Nothing was run again: the ${N} pass/fail results stayed fixed, only the choice of cases changed. If the model answers differently from run to run, that noise is already inside these ${N} results, but resampling cannot pull it apart from the rest. What the draws change is which cases are picked.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 4. Use it: 10,000 resamples, predict the middle 95%. */
  function errorBar({ el, done, kit }) {
    style();
    let ans = null;
    const ranges = [[NEW_SCORE - STEP, NEW_SCORE + STEP], [NEW_LO, NEW_HI], [NEW_HIST.scores[0], NEW_HIST.scores[NEW_HIST.scores.length - 1]]];
    const sh = ranges.map(([a, b]) => share(NEW_HIST, inRange(a, b)));
    const paint = () => {
      const ok = ans === 1;
      const counts = BINS.map(b => { const k = NEW_HIST.scores.findIndex(s => near(s, b)); return k < 0 ? 0 : NEW_HIST.counts[k]; });
      const cls = {};
      if (ok) BINS.forEach((b, k) => { cls[k] = inRange(NEW_LO, NEW_HI)(b) ? "enter" : "gone"; });
      el.innerHTML = `<h1>Ten thousand resamples</h1>
        <p class="lead">Ten draws give a rough idea. A short script drew <b>${BIG_DRAWS.toLocaleString("en")}</b> resamples of the new prompt's results with no model calls: it only reshuffles stored pass/fail results. The usual error bar keeps the middle 95% of the scores: cut 2.5% off each end.</p>
        <p class="task">Before the cut-offs are shown: which range is left after cutting 2.5% of the resamples off each end?</p>
        ${hist(BINS, counts, { cls, title: `${BIG_DRAWS.toLocaleString("en")} resample scores of the new prompt; bar height: how many resamples got that score`, labelIf: tens })}
        <div class="lpanel">${kit.options(ranges.map(([a, b]) => `${r1(a)} to ${r1(b)}`), { picked: ans, correct: 1, num: true })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The cut-offs are <b>${r1(NEW_LO)}</b> (2.5% of the scores fall below it) and <b>${r1(NEW_HI)}</b> (2.5% fall above it). So the honest way to report the new prompt is "${r1(NEW_SCORE)}, error bar ${r1(NEW_LO)} to ${r1(NEW_HI)}": about ${r1(W40 / 2)} points either way. (Scores move in steps of ${r1(STEP)}, so this range holds a little more than 95%: ${pctTxt(sh[1])}.) The old prompt's ${r1(OLD_SCORE)} sits deep inside it. That is only a rough first look: later in the lesson you compare the two prompts properly.`, true)
          : ans === 0 ? kit.feedback(`That range is one case either side of the new score (${r1(NEW_SCORE)}). It holds only ${pctTxt(sh[0])} of the resamples, so it cuts off far more than 2.5% at each end. The tall bars are only the middle of the pile.`, false)
          : kit.feedback(`That is every score that came up, including flukes seen twice in ${BIG_DRAWS.toLocaleString("en")} draws. It holds ${pctTxt(sh[2])}: nothing was cut off the ends.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Predict: ten times as many cases, how much narrower? */
  function moreCases({ el, done, kit }) {
    let ans = null;
    const tenth = [NEW_SCORE - W40 / 20, NEW_SCORE + W40 / 20];
    const ranges = [tenth, BAR400, [NEW_LO, NEW_HI]];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>What would a bigger golden set buy?</h1>
        <p class="lead">With ${N} cases the error bar is ${r1(NEW_LO)} to ${r1(NEW_HI)}, ${r1(W40)} points wide. Suppose the set had <b>${10 * N} cases</b> with the same ${r1(NEW_SCORE)}% pass rate. (In the run: each of the ${N} results copied ten times, then resampled ${BIG_DRAWS.toLocaleString("en")} times.)</p>
        <p class="task">Predict the error bar for ${10 * N} cases.</p>
        ${kit.pics.intervals(ok ? [[NEW_LO, NEW_HI, `${N} cases`], [BAR400[0], BAR400[1], `${10 * N} cases`]] : [[NEW_LO, NEW_HI, `${N} cases`]], { min: 60, max: 100, step: 10, cls: ok ? { 1: "enter" } : {}, title: "middle 95% of the resample scores" })}
        <div class="lpanel">${kit.options([`${r1(tenth[0])} to ${r1(tenth[1])}: 10 times narrower`, `${r1(BAR400[0])} to ${r1(BAR400[1])}: about ${Math.round(W40 / W400)} times narrower`, `${r1(NEW_LO)} to ${r1(NEW_HI)}: the same, the pass rate did not change`], { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${10} times the cases made the bar ${r1(W40)} → ${r1(W400)} points: about ${Math.round(W40 / W400)} times narrower, not 10. The width shrinks with the <b>square root</b> of the number of cases (√10 ≈ ${r1(Math.sqrt(10))}). So halving an error bar costs <b>four times</b> as many cases (√4 = 2). Even at ${10 * N} cases, a ${r1(STEP)}-point gain would sit inside a bar ${r1(W400)} points wide.`, true)
          : ans === 0 ? kit.feedback(`More cases help, but not in proportion. Each extra case adds less than the one before: ten times the cases gives about √10 ≈ ${r1(Math.sqrt(10))} times narrower, not 10.`, false)
          : kit.feedback(`The pass rate sets the middle of the bar, not its width. The width comes from how many cases you have: with more cases, one lucky or unlucky case moves the score less.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. Look at the pairs: tap every case whose result changed between the prompts. */
  function pairs({ el, done, kit }) {
    const found = new Set();
    let miss = null;
    const paint = () => {
      const fin = found.size === CHANGED.length;
      const rows = Array.from({ length: N / 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => { const i = r * 5 + c; return mark(OLD[i]) + mark(NEW[i]); }));
      const cls = {};
      found.forEach(i => { cls[caseKey5(i)] = fin && BROKE.includes(i) ? "no" : "enter"; });
      if (miss != null) cls[caseKey5(miss)] = "accent";
      el.innerHTML = `<h1>Which cases changed?</h1>
        <p class="lead">Both prompts ran on the <b>same</b> ${N} questions. Each box is one case: the first mark is the old prompt's result, the second the new one's (✓ pass, ✗ fail).</p>
        <p class="task">${fin ? "All the changed cases are marked." : `Tap every case where the result changed. Found ${found.size} so far.`}</p>
        ${kit.pics.grid(rows, { cls, pick: fin ? false : true, title: "old prompt, new prompt" })}
        ${fin ? kit.pics.key([["enter", `fixed: ✗ → ✓ (${FIXED.length})`], ["no", `broken: ✓ → ✗ (${BROKE.length})`]]) : ""}
        <div class="lpanel">
          ${fin ? kit.feedback(`Only <b>${CHANGED.length}</b> of ${N} cases changed: the new prompt fixed ${FIXED.length} and broke ${BROKE.length}. Net: +${FIXED.length - BROKE.length} case, the "${SHOWN_NEW - SHOWN_OLD} points". The other ${SAME.length} cases came out the same for both prompts, so they say nothing about which prompt is better. Whether the gain is real depends on these ${CHANGED.length} cases alone: ${FIXED.length} against ${BROKE.length} is close to a coin toss.`, true)
            : miss != null ? kit.feedback(`Case ${miss} is ${mark(OLD[miss])}${mark(NEW[miss])}: it ${OLD[miss] ? "passed" : "failed"} with both prompts. It did not change, so it cannot tell the prompts apart.`, false)
            : ""}
        </div>`;
      el.querySelectorAll(".lp-gc").forEach(c => c.onclick = () => {
        if (fin) return;
        const i = +c.dataset.r * 5 + +c.dataset.c;
        miss = null;
        if (CHANGED.includes(i)) found.add(i); else miss = i;
        paint();
        if (found.size === CHANGED.length) done();
      });
    };
    paint();
  }

  /* 7. The paired bootstrap: resample the cases, score both prompts on the same picks. */
  function paired({ el, done, kit }) {
    style();
    let ans = null;
    const atOrBelow = share(DIFF_HIST, s => s < 1e-6);
    const bins = DIFF_HIST.scores;
    const paint = () => {
      const ok = ans === 1;
      const cls = {};
      if (ok) bins.forEach((b, k) => { cls[k] = inRange(D_LO, D_HI)(b) ? "enter" : "gone"; });
      const opts = ["Ship it as a proven gain: most resamples favour the new prompt", `Do not claim a gain: the middle 95% runs from ${r1(D_LO)} to +${r1(D_HI)}, and 0 is inside`, `Roll back: some resamples show the new prompt ${r1(-D_LO)} or more points worse`];
      el.innerHTML = `<h1>Compare on the same cases</h1>
        <p class="lead">Now resample the ${N} cases again, but score <b>both</b> prompts on the same picks and keep the difference, new minus old. A case with the same result for both prompts adds the same to both scores, so it cancels out. Each difference is ${r1(STEP)} × (fixed cases picked − broken cases picked). This is a <b>paired</b> comparison. The script did it ${BIG_DRAWS.toLocaleString("en")} times.</p>
        <p class="task">Read the spread of differences. What do you tell the team lead?</p>
        ${hist(bins, DIFF_HIST.counts, { cls, title: "new score − old score, on the same resampled cases", labelIf: b => near(b % 10, 0) })}
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The 95% range of the difference is <b>${r1(D_LO)} to +${r1(D_HI)}</b>, and it includes 0. The new prompt may be better, the same, or a bit worse; ${N} cases cannot tell. Say "no measurable change". Ship it only if you want it for another reason (shorter, cheaper), or grow the golden set first. Pairing matters: resampling the two prompts separately forgets that they faced the same cases, and gives a wider range, ${r1(UNPAIRED[0])} to +${r1(UNPAIRED[1])}.`, true)
          : ans === 0 ? kit.feedback(`"Most" is not enough. In ${pctTxt(atOrBelow)} of the resamples the new prompt did no better (difference 0 or below). A real gain would keep almost all of the range above 0.`, false)
          : kit.feedback(`Those are the tail of the same noise. The range reaches +${r1(D_HI)} on the other side just as easily. A tail on one side is no more evidence than the other.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. The same thing in Python, as a recorded run (3 draws, traced). */
  const CODE = [
    "def paired_bootstrap(old, new, draws, rng):",
    "    n = len(old)",
    "    diffs = []",
    "    for _ in range(draws):",
    "        picks = rng.integers(0, n, n)",
    "        new_score = 100 * new[picks].mean()",
    "        old_score = 100 * old[picks].mean()",
    "        diffs.append(new_score - old_score)",
    "    return np.percentile(diffs, [2.5, 97.5])"
  ];
  const fb = d => { const p = TRACE_PICKS[d]; return [p.filter(i => FIXED.includes(i)).length, p.filter(i => BROKE.includes(i)).length]; };
  const SAY = t => {
    const [line, ev, d, ns, os, diffs] = t;
    if (ev === "r") return `It returns [${TRACE_RESULT[0]}, ${TRACE_RESULT[1]}]. With only ${DRAWS} draws that range means little. The lesson's run called the same function with ${BIG_DRAWS.toLocaleString("en")} draws and got [${r1(D_LO)}, ${r1(D_HI)}], the range you just read.`;
    if (line === 1) return `<code>old</code> and <code>new</code> are NumPy arrays of ${N} ones and zeros (pass, fail), one per golden case, in the same order. <code>rng</code> is a NumPy random number generator. n = ${N}.`;
    if (line === 2) return "Start an empty list of differences.";
    if (line === 3) return diffs.length ? `Back to the loop: ${diffs.length} of ${DRAWS} draws done.` : `Loop ${DRAWS} times, one resample each. (The real run uses thousands.)`;
    if (line === 4) return `Draw ${n2w(diffs.length + 1)}: pick ${N} case numbers from 0 to ${N - 1}, with repeats. <code>integers</code> leaves out the upper end, ${N}.`;
    if (line === 5) { const [f, b] = fb(d); return `The picks hold ${f} fixed and ${b} broken case${b === 1 ? "" : "s"}, counting repeats. <code>new[picks]</code> takes the new result at each picked number, repeats included; the mean of ones and zeros is the share that passed.`; }
    if (line === 6) return `Score the old prompt on the <b>same</b> picks.`;
    if (line === 7) { const [f, b] = fb(d); return `${r1(ns)} − ${r1(os)} = ${r1(ns - os)}, which is ${r1(STEP)} × (${f} fixed − ${b} broken). Unchanged cases added the same to both scores. Keep the difference.`; }
    return "Cut 2.5% off each end of the list of differences, which leaves the middle 95%, and return its two ends.";
  };
  const n2w = k => ["", "one", "two", "three"][k] || String(k);
  function asCode({ el, done, kit }) {
    let k = 0;
    const paint = () => {
      const t = TRACE[k], [line, ev, d, ns, os, diffs] = t;
      const p = d >= 0 && line !== 4 ? TRACE_PICKS[d] : null;
      el.innerHTML = `<h1>The same thing in Python</h1>
        <p class="lead">A from-scratch paired bootstrap in plain Python and NumPy. This replays a real run with ${DRAWS} draws, one step per line executed.</p>
        <p class="task">Step through the run to the end. Watch how each difference comes only from the changed cases.</p>
        ${kit.code(CODE, line)}
        <div class="vars"><span>picks <b>${p ? kit.esc(`[${p.slice(0, 4).join(", ")}, …]`) : "–"}</b></span><span>new_score <b>${ns == null ? "–" : r1(ns)}</b></span><span>old_score <b>${os == null ? "–" : r1(os)}</b></span>${p ? `<span>in picks <b>fixed ${fb(d)[0]}, broken ${fb(d)[1]}</b></span>` : ""}<span>diffs <b>${diffs ? kit.esc(`[${diffs.map(r1).join(", ")}]`) : "–"}</b></span><span>step <b>${k + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(SAY(t))}
        <div class="lsteps"><button type="button" class="btn" data-prev ${k === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${k === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { k--; paint(); };
      el.querySelector("[data-next]").onclick = () => { k++; paint(); if (k === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 9. The big picture, with a task: what does a narrower bar cost? */
  function bigPicture({ el, done, kit }) {
    let ans = null;
    const opts = ["Collect more chats, even if each one adds only a few questions", "Write more questions inside the same chats", `Run more resamples: ten times the ${BIG_DRAWS.toLocaleString("en")}`];
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <p class="lead"><b>What it is for:</b> telling whether a score change is bigger than the noise from which cases happen to be in your eval set. <b>Reach for it</b> with small sets (tens to a few hundred cases), before you claim a small gain, for any score that is an average over cases: pass rate, recall@k. <b>Not the answer</b> when the set does not look like real users: fix the set instead.</p>
        <p class="lead"><b>Adapt it</b> when cases come in groups, such as several turns of one chat: resample whole groups. If answers change from run to run, the bar already includes that noise; running each case several times and averaging per case makes the bar narrower. <b>Cost:</b> the computing is cheap, it reuses stored results. The real cost is cases.</p>
        <p class="task">Another team's golden set is ${N} questions taken from 8 support chats, 5 per chat, and they resample whole chats. Their bar is too wide. Which spend narrows it?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0
          ? kit.feedback(`Right. When whole chats are resampled, the chats are the units of evidence: 8 of them, not ${N}. The bar shrinks with the square root of the number of chats, so halving it takes about four times the chats. That is the cost that bites first: real chats, each turned into checked golden questions.`, true)
          : ans === 1 ? kit.feedback(`Questions from one chat tend to pass or fail together, so a 6th or 7th question from the same chat adds little new evidence. The bar is set mostly by how many chats there are, and that stays 8.`, false)
          : kit.feedback(`More resamples only draw the same picture more smoothly. The spread comes from having 8 chats; resampling them a million times still describes 8 chats.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A search team compares two embedding models on the same 60 questions. Recall@5 goes from 0.70 to 0.75. They ask whether the second model is really better.", true,
      "Yes. Recall@5 is an average over questions, and both models answered the same 60. Resample the question numbers, score both models on the same picks, and see whether the range of differences leaves 0 out.",
      "It fits. Recall@5 is an average over the 60 questions, just like a pass rate, and both models faced the same questions, so a paired resample of the questions tells you whether 0.05 is bigger than the noise."],
    ["An eval has 50 cases: 10 customer chats with 5 follow-up questions each. A tool resamples the 50 questions one by one and reports a narrow error bar.", false,
      "Right, not as done. The 5 questions of one chat tend to pass or fail together, so they are not 50 separate pieces of evidence. Resampling them one by one makes the bar too narrow. Resample whole chats: draw 10 chats with repeats and keep all 5 questions of each.",
      "Careful. The 5 questions from one chat tend to pass or fail together, so there are closer to 10 independent pieces of evidence than 50. Resampling single questions pretends otherwise and the bar comes out too narrow. Resample whole chats instead."],
    ["A team wrote their 80 golden cases from questions they found easy to check. The score is 96, error bar 91 to 99. Does that show real users will see answers this good?", false,
      "Right. The bootstrap only measures how the score moves with which of these 80 cases you draw. If the cases are easier than what users ask, every resample has the same flaw, and no error bar can show it. Build the set from real user questions.",
      "No. Every resample is drawn from the same 80 easy cases, so every one carries the same bias. The bar measures noise from the choice of cases, not whether the cases are like real questions. Build the set from real user questions."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is a resampled error bar the answer?</h1>
        <p class="lead">Three situations away from parking permits.</p>
        <p class="task">For each one, decide whether resampling the cases answers the question being asked. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">A score on a small golden set is a guess with an error bar. The <b>bootstrap</b> finds that bar by resampling the cases with repeats and rescoring. To compare two prompts, resample once and score both on the same picks; only the changed cases move the difference. Claim a gain only when the range of differences leaves 0 out. Halving the bar costs four times the cases.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise follows on this page. You write <code>paired_bootstrap</code> yourself and decide whether a new pair of prompt results is a real gain or noise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It runs the golden set on every prompt change and uses what you learned here to set pass thresholds that do not fail on noise.</p>` : ""}`;
    done();
  }

  const UNCHANGED_KEY = (() => { const i = SAME[0]; return `${Math.floor(i / 5)},${i % 5}`; })();
  LessonKit.define(ID, {
    title: "Is a 2-point change real? Error bars by resampling",
    checked: "2026-11-13",
    sources: [
      "https://doi.org/10.1214/aos/1176344552",
      "https://arxiv.org/abs/2411.00640",
      "https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.integers.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.percentile.html",
      "https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html"
    ],
    interview: [{
      q: "A teammate's new prompt raised the golden-set score from 78 to 80 on 40 cases, and they want to ship it as an improvement. What do you do before agreeing?",
      good: [
        "Translate the score: one case is 2.5 points, so the whole gain is one case",
        "Look at which cases flipped: a few fixed and a few broken can net to +1",
        "Run a paired bootstrap: resample the cases, score both prompts on the same picks, take the 95% range of the difference",
        "If the range includes 0, report no measurable change; ship only for other reasons, or grow the set (four times the cases halves the bar)",
        "Check the bar is honest: resample related cases as one group; if the model is not deterministic, average several runs per case to shrink the bar"
      ],
      weak: "80 is higher than 78, so ship it, or rerun until the number looks stable. Both treat one case's change as a measurement and never ask how much the score moves by chance."
    }, {
      q: "Your eval reports a very tight error bar, but its 200 cases come from 20 support chats. Why might the bar be wrong, and how do you fix it?",
      good: [
        "Questions from the same chat tend to pass or fail together, so they are not 200 independent cases",
        "Resampling single questions then makes the bar too narrow",
        "Resample whole chats with repeats and keep each chat's questions together",
        "Expect a wider bar, and more chats (not more questions per chat) to narrow it"
      ],
      weak: "200 cases is plenty, so the bar must be right. That misses that the evidence comes from 20 chats, not 200 separate questions."
    }],
    screens: [situation, byHand, spotIdea, errorBar, moreCases, pairs, paired, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      // screen 2: no wrong step: the options are disabled until the tenth draw, and the halfway walk replays only `right`
      { right: [...Array(HAND.length).fill("[data-draw]"), "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${UNCHANGED_KEY}"]`], right: CHANGED.map(i => `[data-i="${Math.floor(i / 5)},${i % 5}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
