/* Lesson s6-detecting-drift: detecting input and quality drift.
   Story: a tax-help assistant was tuned and graded in October. Filing season opens, and a flood of new kinds of
   questions arrives. Is the assistant now worse, and how would the team know before graders catch up?
   Ideas: (1) input drift: compare this week's share in each bin (topic, length) with the reference period's, and add
   the differences up into one score, the population stability index (PSI); (2) a drift score says the inputs moved,
   not that quality fell: weight the reference period's per-topic grades by the new mix to see whether it matters,
   then confirm with a graded sample (quality drift).
   Data: docs/ai-path/runs/s6-detecting-drift/ (all run on this Mac with NumPy, seed 7):
     make_data.py -> data.json, make_data.out.txt: made-up questions (templates), 400 from October, 300 from the first
       filing week, 300 from a later refund week, and simulated reviewer grades;
     to_js.py -> to_js.out.txt: the data constants below, pasted unchanged;
     psi_scratch.py -> psi_scratch.out.txt: the traced psi() of the code screen, the length scores, the run without the floor;
     broken_bins.py -> broken_bins.out.txt: the broken-on-purpose length check and its fix;
     quality.py -> quality.out.txt: the pass rates the lesson recomputes.
   No model was called: no recordings.
   Every number on screen is computed here from the constants below (the printed outputs are pasted text).
   Lesson-local CSS (prefix lx-s6-detecting-drift-): question card, small tables, printed-output block. */
(() => {
  const P = "lx-s6-detecting-drift-";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const pc = x => `${(x * 100).toFixed(1)}%`;
  const p0 = x => `${Math.round(x * 100)}%`;
  const d3 = x => x.toFixed(3);

  // From docs/ai-path/runs/s6-detecting-drift/to_js.out.txt (not altered)
  const TOPICS = ["deadlines", "refund status", "account changes", "deductions", "side income"];
  const OCTOBER_TOPICS = "2001014420310000303212221010301310120412102122111131310210322420231001203202101002223010201110000031222102022021311123010211000100121044102133122300222121201100112211233231201130210321101021001023200204000213023132412301320003011013220210000013231221111212210100311020220100010223213143130142344110220210011200421000124000012221321001123001140310110103321311222020020012103100401011302412302341113143";
  const OCTOBER_CHARS = [75,42,83,47,35,40,107,53,27,35,81,40,35,45,85,79,112,45,35,37,36,38,32,64,19,137,50,84,37,45,49,81,36,79,40,37,42,102,67,77,86,93,65,56,75,27,19,77,19,118,81,67,35,40,89,69,49,38,92,27,78,50,37,39,69,112,73,39,35,19,27,45,39,32,42,100,19,86,87,79,42,37,69,27,100,86,87,42,38,99,49,47,36,82,39,45,45,35,37,87,40,70,37,87,39,65,99,107,40,84,37,40,28,19,67,49,110,85,124,49,89,40,19,76,140,35,38,19,84,86,49,38,87,42,112,50,40,35,38,57,109,109,47,40,32,33,136,82,114,75,40,57,37,49,32,45,50,78,42,79,87,50,78,37,19,47,27,33,76,37,33,84,27,39,117,47,37,92,40,49,42,37,32,36,84,81,19,88,40,49,133,42,87,39,40,85,76,39,38,32,39,42,39,39,79,27,50,85,89,27,37,49,168,37,52,36,76,106,38,19,35,64,89,80,45,39,84,19,50,89,80,39,64,65,142,40,80,38,39,45,89,35,36,28,32,74,19,40,40,90,19,109,47,27,49,27,74,74,38,78,81,45,112,19,56,35,38,38,32,32,82,74,38,35,42,47,42,40,38,90,38,19,35,47,112,39,87,28,35,89,52,37,151,134,50,78,19,38,38,37,38,40,56,86,85,49,36,40,145,125,190,78,36,39,39,42,49,38,112,45,35,83,79,36,74,32,105,47,28,68,47,89,82,36,19,37,37,92,42,49,47,132,39,80,40,79,114,74,39,49,81,153,35,37,47,33,49,40,40,105,27,86,32,35,42,64,45,39,47,40,47,82,33,78,39,35,52,39,19,92,49,80,37,38,77,102,50,75,28,89,40,101,47,19,40,36,74,49,50,90];
  const WEEK_TOPICS = "403343413132432432023333324444344221400314334433304343434033302330000043444331113444304144324403302313114343020430334012033444321414204433333430333310331241313431104324334303304341334444201202243440433444443443040033043330341334104310444214013244333002331041313004104434434033040333143341440303413002";
  const WEEK_CHARS = [123,42,39,107,227,211,251,73,142,86,152,27,194,126,77,189,208,149,176,40,37,76,205,197,76,148,115,264,266,150,37,52,185,151,27,49,177,38,130,39,134,129,153,33,52,129,137,138,162,88,227,126,42,230,120,85,229,137,109,136,169,182,110,115,152,137,143,142,82,89,226,106,165,211,177,207,110,107,87,47,110,241,169,107,106,138,178,114,52,144,164,151,42,150,39,110,195,35,69,147,127,210,40,89,264,108,53,136,88,148,76,162,199,183,179,115,164,85,80,70,45,78,94,95,115,246,80,138,71,239,57,112,75,76,202,244,74,106,105,158,184,241,79,85,141,235,108,157,118,182,131,179,49,113,211,117,39,104,219,124,151,118,111,133,191,100,77,47,90,184,94,85,89,105,166,89,221,28,50,36,28,74,92,164,95,156,138,89,96,138,142,64,63,89,105,120,132,132,167,90,151,109,241,132,139,167,122,53,157,149,186,224,96,186,205,183,186,154,126,81,212,181,221,95,71,225,85,154,149,173,229,92,73,135,261,109,189,143,162,221,35,124,168,38,151,104,173,109,39,143,35,115,193,74,74,180,156,77,28,162,112,92,35,108,113,178,176,52,33,53,151,108,186,179,162,146,42,196,140,74,151,90,157,167,194,146,53,94,108,174,133,181,166,166,107,50,105,86,139,143];
  const REFUND_TOPICS = "210111121141102134112022013401121310001210123311210211031331111111213111211321223312110112031111113411110101112013411112111223110132413341302111111111130114313100101111211131211112011311311133230101410111111101111132111121110312330301121101211012120142211101111310101131011111110212113114104210114121";
  const REFUND_CHARS = [76,122,143,71,47,19,125,37,19,71,164,118,90,38,37,118,94,52,84,19,68,99,27,27,92,118,33,50,82,76,19,27,40,85,74,85,128,79,117,78,40,45,36,69,109,37,47,109,27,108,35,32,49,47,42,74,47,142,169,78,49,56,87,49,126,36,101,118,33,67,47,36,27,40,77,100,75,87,76,74,37,74,36,111,47,49,96,36,50,37,135,96,36,40,40,76,56,47,158,190,118,40,67,107,45,118,143,67,77,19,27,45,126,74,42,19,49,116,47,74,49,36,78,32,111,69,74,40,39,40,85,113,122,49,37,35,47,85,35,35,65,47,126,40,19,47,40,122,74,80,49,28,79,47,40,124,147,71,146,40,38,38,36,89,87,57,57,47,78,59,126,105,39,56,69,89,78,19,36,101,132,40,36,106,87,36,74,86,89,47,35,80,73,94,39,57,84,87,124,87,83,36,36,47,87,56,49,19,38,111,77,85,77,124,28,38,40,36,49,49,64,50,80,87,39,33,36,37,74,28,89,85,38,109,56,74,47,19,45,56,115,78,40,45,47,38,73,38,88,59,97,73,105,49,126,57,128,19,40,84,47,28,80,93,78,93,107,90,33,108,86,19,84,111,49,36,89,36,35,38,74,64,71,109,33,87,49,47,36,99,47,32,67,83,36,49,50,71,74,111];
  const OCT_GRADED = [[38, 40], [38, 40], [38, 40], [27, 40], [24, 40]]; // [passed, graded] per topic
  const WEEK_GRADED = [[4,0],[0,1],[2,1],[4,0],[3,0],[3,0],[4,0],[3,1],[2,1],[0,0],[3,1],[4,1],[2,1],[3,1],[3,0],[3,0],[4,1],[4,0],[3,1],[3,1],[3,1],[4,0],[0,1],[2,1],[3,1],[4,0],[4,1],[1,1],[3,0],[4,1],[3,0],[4,0],[0,0],[4,1],[0,1],[4,0],[0,1],[3,1],[4,1],[0,1],[3,1],[4,1],[4,1],[3,1],[0,1],[3,0],[2,1],[4,1],[2,1],[1,1],[3,0],[3,0],[1,1],[3,1],[4,0],[1,1],[3,1],[4,0],[3,0],[4,0],[3,1],[3,1],[3,0],[4,1],[4,1],[0,1],[3,0],[4,0],[4,1],[3,1],[3,0],[3,0],[2,1],[4,0],[3,1],[0,1],[3,0],[2,1],[0,1],[3,0]];
  const REFUND_GRADED = [[0,1],[2,1],[1,1],[1,1],[1,1],[1,1],[1,1],[3,0],[0,1],[1,1],[0,1],[1,1],[1,1],[2,1],[1,1],[1,1],[2,1],[0,1],[1,1],[2,1],[1,1],[1,1],[1,1],[0,1],[3,0],[0,1],[3,1],[2,1],[3,1],[1,1],[2,1],[0,1],[2,1],[1,1],[2,1],[1,1],[0,0],[0,1],[1,0],[1,1],[0,1],[1,1],[1,1],[1,1],[3,1],[1,0],[1,0],[1,1],[3,1],[1,1],[1,1],[3,1],[4,1],[2,1],[1,1],[3,0],[1,1],[1,1],[0,1],[1,1],[1,1],[1,1],[3,0],[2,1],[1,1],[3,0],[0,1],[3,0],[1,1],[3,1],[1,1],[1,0],[2,1],[0,1],[1,1],[0,0],[1,1],[1,1],[1,1],[1,1]];
  const SAMPLE_OCT = [[2, "My old email address no longer works. Can I change the email on my account?"], [0, "Can I still file if I missed the deadline?"], [0, "My partner and I got married in the summer. When is the last day to file my return?"], [1, "Can I get my refund paid to a new bank account?"]];
  const SAMPLE_WEEK = [[4, "Some clients paid me by bank transfer and some through a payment app. How do I report a small side business next to my job?"], [3, "Do donations to a charity lower my tax?"], [3, "I keep all the receipts in a folder but I am not sure which ones count. Can I deduct the cost of my laptop?"], [4, "I did not keep a record of every payment. Some clients paid me by bank transfer and some through a payment app. Next to my full-time job I design websites for a few clients. How do I report a small side business next to my job?"]];

  /* ---------- derived ---------- */
  const NT = TOPICS.length;
  const topicCounts = s => { const c = Array(NT).fill(0); for (const ch of s) c[+ch]++; return c; };
  const sum = a => a.reduce((s, x) => s + x, 0);
  const shares = c => { const n = sum(c); return c.map(x => x / n); };
  const FLOOR = 0.001;
  const psiTerms = (last, week) => {
    const e = shares(last).map(x => Math.max(x, FLOOR)), a = shares(week).map(x => Math.max(x, FLOOR));
    return a.map((ai, i) => (ai - e[i]) * Math.log(ai / e[i]));
  };
  const psi = (last, week) => sum(psiTerms(last, week));

  const OCT_T = topicCounts(OCTOBER_TOPICS), WEEK_T = topicCounts(WEEK_TOPICS), REF_T = topicCounts(REFUND_TOPICS);
  const N_OCT = OCTOBER_TOPICS.length, N_WEEK = WEEK_TOPICS.length, N_REF = REFUND_TOPICS.length;
  const E = shares(OCT_T), A = shares(WEEK_T), RS = shares(REF_T);
  const TERMS = psiTerms(OCT_T, WEEK_T), PSI_WEEK = sum(TERMS), PSI_REF = psi(OCT_T, REF_T);

  const EDGES = [0, 50, 100, 150, 200];                 // the last bin is 200 and more
  const BIN_LABELS = ["under 50", "50–99", "100–149", "150–199", "200+"];
  const binOf = n => { let b = 0; while (b + 1 < EDGES.length && n >= EDGES[b + 1]) b++; return b; };
  const lenCounts = arr => { const c = Array(EDGES.length).fill(0); arr.forEach(n => c[binOf(n)]++); return c; };
  const OCT_L = lenCounts(OCTOBER_CHARS), WEEK_L = lenCounts(WEEK_CHARS);
  const PSI_LEN = psi(OCT_L, WEEK_L);
  const mean = a => sum(a) / a.length;

  const RATE = OCT_GRADED.map(([p, n]) => p / n);
  const expected = sh => sum(sh.map((s, i) => s * RATE[i]));
  const graded = g => [sum(g.map(x => x[1])), g.length];
  const BANDS = ["under 0.1", "0.1 to 0.25", "over 0.25"];
  const band = x => x < 0.1 ? 0 : x < 0.25 ? 1 : 2;

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}q { border: 1.5px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-top: 12px; background: var(--surface); }
      .${P}q .meta { font: 600 13px var(--font); color: var(--muted); margin-bottom: 4px; }
      .${P}q .txt { font-size: 16px; line-height: 1.45; }
      .${P}lab { font: 600 13px var(--font); color: var(--muted); margin: 16px 0 0; }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}out { white-space: pre-wrap; font: 500 13px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-top: 10px; overflow-wrap: anywhere; }
      .${P}tb { border-collapse: collapse; width: 100%; margin-top: 12px; font: 500 14px var(--mono); }
      .${P}tb th { text-align: left; font: 600 12px var(--font); color: var(--muted); padding: 4px 6px 6px; border-bottom: 2px solid var(--ink); vertical-align: bottom; }
      .${P}tb td { padding: 7px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}tb td.t { font-family: var(--font); }
      .${P}tb .n { text-align: right; white-space: nowrap; }
      .${P}tb tr.hi td { font-weight: 700; }
      .${P}tb tr.hi td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
      .${P}sm { font-size: 13px; }
      .${P}sm th, .${P}sm td { padding-left: 3px; padding-right: 3px; }
      .${P}sm th.n { white-space: normal; }
      .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; }
      .${P}two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @media (max-width: 560px) { .${P}two { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  const lab = t => `<p class="${P}lab">${t}</p>`;
  const out = (kit, t) => `<div class="${P}out">${kit.esc(t)}</div>`;

  /* 1. The situation, and binning question lengths by hand. */
  const SAMPLES = [...SAMPLE_OCT.map(([t, x]) => ({ when: "October", t, x })), ...SAMPLE_WEEK.map(([t, x]) => ({ when: "This week", t, x }))];
  const N_OCT_S = SAMPLE_OCT.length;
  function binByHand({ el, done, kit }) {
    css();
    let k = 0, miss = null;
    const got = [Array(EDGES.length).fill(0), Array(EDGES.length).fill(0)];
    const paint = () => {
      const fin = k === SAMPLES.length, q = SAMPLES[k];
      const right = fin ? -1 : binOf(q.x.length);
      const octU100 = (OCT_L[0] + OCT_L[1]) / N_OCT, wkU100 = (WEEK_L[0] + WEEK_L[1]) / N_WEEK;
      el.innerHTML = `<h1>Filing season opens</h1>
        <p class="lead">A tax-help website has an assistant that answers people's questions. In October the team tuned its prompt and help pages on October's questions, and reviewers graded a sample of its answers: good enough to ship. This week filing season opened. Support staff say the questions "feel different". Nobody can say how different, or whether the assistant is now worse.</p>
        <p class="lead">This lesson is about watching a live AI feature: how to see from the questions alone, every day, that the inputs changed, and whether that change will hurt the answers.</p>
        <p class="lead">A small script made up the questions in this lesson from a few templates, mixed differently in each period. Every number you see comes from them.</p>
        ${fin ? "" : `<p class="task">Put each question in its length bin (a bin is one range of lengths). Question ${k + 1} of ${SAMPLES.length}.</p>
        <div class="${P}q"><div class="meta">${q.when} · topic: ${kit.esc(TOPICS[q.t])} · <b>${q.x.length} characters</b></div><div class="txt">${kit.esc(q.x)}</div></div>
        <div class="lpanel">${kit.options(BIN_LABELS, { picked: miss, correct: right })}
        ${miss != null ? kit.feedback(`${q.x.length} characters is not ${BIN_LABELS[miss]}. Each bin starts at its first number and stops just before the next bin's first number, so ${q.x.length} goes in ${BIN_LABELS[right]}.`, false) : ""}</div>`}
        <div class="${P}two"><div>${lab(`Your October sample (${N_OCT_S}): questions per bin`)}${kit.cells(got[0], { labels: BIN_LABELS })}</div>
        <div>${lab(`Your sample from this week (${SAMPLES.length - N_OCT_S}): questions per bin`)}${kit.cells(got[1], { labels: BIN_LABELS })}</div></div>
        ${fin ? `<div class="lpanel">${kit.feedback(`Done. A sample of ${SAMPLES.length} questions can only hint at a change. Below are all the questions of each period, shown as a percent of that period, so a ${N_OCT}-question month and a ${N_WEEK}-question week can be compared.`, true)}</div>
        <div class="${P}two"><div>${lab(`All ${N_OCT} October questions, % per bin`)}${kit.bars(shares(OCT_L).map(x => Math.round(x * 100)), { labels: BIN_LABELS })}</div>
        <div>${lab(`All ${N_WEEK} questions this week, % per bin`)}${kit.bars(shares(WEEK_L).map(x => Math.round(x * 100)), { labels: BIN_LABELS })}</div></div>
        ${kit.feedback(`In October, ${OCT_L[0] + OCT_L[1]} of ${N_OCT} questions (${p0(octU100)}) were under 100 characters. This week, ${WEEK_L[0] + WEEK_L[1]} of ${N_WEEK} (${p0(wkU100)}). And ${p0(WEEK_L[4] / N_WEEK)} of this week's questions are 200 characters or more, a length October never had: ${OCT_L[4]} of ${N_OCT}. People now write a story before they ask.`)}` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== right) { miss = i; paint(); return; }
        miss = null; got[k < N_OCT_S ? 0 : 1][i]++; k++;
        paint();
        if (k === SAMPLES.length) done();
      });
    };
    paint();
  }

  /* 2. Topics, and a prediction before any maths: will quality drop? */
  const WEAK = RATE.map((r, i) => [r, i]).sort((x, y) => x[0] - y[0]).slice(0, 2).map(x => x[1]).sort((x, y) => x - y);   // the two topics October's grading passed least often
  function predict({ el, done, kit }) {
    css();
    let ans = null;
    const correct = 1;
    const weakOct = sum(WEAK.map(i => E[i])), weakWeek = sum(WEAK.map(i => A[i]));
    const weakNames = WEAK.map(i => TOPICS[i]).join(" and "), cap = t => t[0].toUpperCase() + t.slice(1);
    const opts = [
      "No. The assistant did not change, so its answers are as good as in October",
      "Yes. More questions now land on the topics where October's grades were weakest",
      "Yes. Longer questions are harder, so quality must drop",
      "Nothing can be said until reviewers grade this week's answers"
    ];
    const paint = () => {
      el.innerHTML = `<h1>Will the answers get worse?</h1>
        <p class="lead">Each question also has a topic. A small classifier tags each question with one of these topics, or "other" when none fits; no question in this lesson needed "other". Below: each topic's share of all questions in October and this week, and how October's graded answers did on that topic (reviewers graded ${OCT_GRADED[0][1]} answers per topic).</p>
        <table class="${P}tb"><thead><tr><th>topic</th><th class="n">October</th><th class="n">this week</th><th class="n">passed in October</th></tr></thead><tbody>
          ${TOPICS.map((t, i) => `<tr><td class="t">${kit.esc(t)}</td><td class="n">${pc(E[i])}</td><td class="n">${pc(A[i])}</td><td class="n">${OCT_GRADED[i][0]}/${OCT_GRADED[i][1]}</td></tr>`).join("")}</tbody></table>
        <p class="task">Before any maths: what do you expect the share of good answers to do this week?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. ${cap(weakNames)} passed only ${p0(RATE[WEAK[0]])} and ${p0(RATE[WEAK[1]])} in October. They were ${pc(weakOct)} of October's questions and are ${pc(weakWeek)} of this week's. The assistant is the same, but the questions moved onto its weak ground. Two names for what you just saw: <b>input drift</b>, the inputs no longer look like the reference period (here October); and <b>quality drift</b>, the share of good answers moves. Input drift is visible on day one. Quality drift needs graders, and they take days.`, true)
          : ans === 0 ? kit.feedback(`The assistant is the same, but quality is measured on the questions it gets. ${pc(weakWeek)} of this week's questions are on ${weakNames}, where October's grading passed only ${p0(RATE[WEAK[0]])} and ${p0(RATE[WEAK[1]])}. In October those topics were ${pc(weakOct)} of the questions.`, false)
          : ans === 2 ? kit.feedback(`Nothing here shows that length makes an answer fail: October was graded per topic, not per length. What the table does show is the mix moving onto the topics with the weakest grades. Length is a clue that the questions changed, not proof that they got harder.`, false)
          : kit.feedback(`Grading confirms it, but it takes days. You already hold two facts: October's grades per topic, and this week's topic mix. Together they point one way before any grader starts.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: one morning number that compares bin shares. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const correct = 1;
    const opts = [
      "This week's average question length minus October's",
      "For each bin, compare this week's share with October's, and add the differences up into one score",
      "The number of questions per day"
    ];
    const paint = () => {
      el.innerHTML = `<h1>One number every morning</h1>
        <p class="lead">Reviewers grade a sample once a week. The team wants a check that runs every morning, needs no grader, and says: "this week's questions no longer look like October's". It must work for topics as well as for lengths.</p>
        <p class="task">What should the check compute?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Bins work for anything you can sort into groups: topics, length ranges, languages. Compare each bin's share with the reference, then add the differences up into one <b>drift score</b>. A common one is the <b>population stability index (PSI)</b>, from credit scoring in banks, where it watches whether today's applicants still look like the ones a model was built on. Next screen: how it adds the differences.`, true)
          : ans === 0 ? kit.feedback(`It catches longer questions here (October ${Math.round(mean(OCTOBER_CHARS))} characters on average, this week ${Math.round(mean(WEEK_CHARS))}). But a topic has no average: a week of short side-income questions would keep October's average length and still be the risky mix. One average can also hide a split, such as half very short and half very long questions.`, false)
          : kit.feedback(`Volume says how busy the assistant is, not what kind of questions it gets. Twice as many October-like questions is no risk to quality; the same number of new kinds of questions can be.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Score the topic mix: one term per bin, with predictions. */
  function scoreTopics({ el, done, kit }) {
    css();
    let a1 = null, a2 = null;
    const big = TERMS.indexOf(Math.max(...TERMS));
    const right2 = band(PSI_WEEK);
    const paint = () => {
      const ok1 = a1 === big, ok2 = a2 === right2;
      el.innerHTML = `<h1>Score the topic mix</h1>
        <p class="lead">PSI adds one term per bin. Write <b>e</b> for the bin's share in October (expected) and <b>a</b> for its share this week (actual). The term is <b>(a − e) × ln(a / e)</b>, where ln is the natural log. ln(a / e) is 0 when the shares are equal, above 0 when the share grew, below 0 when it shrank. (a − e) is above 0 or below 0 in the same cases. Two numbers with the same sign multiply to a number above 0, so a bin that grew and a bin that shrank both add to the score. The log looks at the ratio a / e, so a share going 0.05 → 0.15 adds more (${d3(0.1 * Math.log(3))}) than one going 0.30 → 0.40 (${d3(0.1 * Math.log(4 / 3))}), though both grew by 0.10.</p>
        <table class="${P}tb"><thead><tr><th>topic</th><th class="n">e (October)</th><th class="n">a (this week)</th><th class="n">term</th></tr></thead><tbody>
          ${TOPICS.map((t, i) => `<tr class="${ok1 && i === big ? "hi" : ""}"><td class="t">${kit.esc(t)}</td><td class="n">${d3(E[i])}</td><td class="n">${d3(A[i])}</td><td class="n">${ok1 ? d3(TERMS[i]) : "?"}</td></tr>`).join("")}</tbody></table>
        <div id="q1"><p class="task">Predict: which topic adds the most to the score?</p>
        ${kit.options(TOPICS.map(kit.esc), { picked: a1, correct: big })}
        ${a1 == null ? "" : ok1
          ? kit.feedback(`Right: ${kit.esc(TOPICS[big])}, ${d3(E[big])} → ${d3(A[big])}, about ${(A[big] / E[big]).toFixed(1)} times its October share. Its term is ${d3(TERMS[big])}. The terms are now in the table.`, true)
          : kit.feedback(`${kit.esc(TOPICS[a1])}: a − e = ${(A[a1] - E[a1]).toFixed(3)}, a / e = ${(A[a1] / E[a1]).toFixed(2)}, so the term is ${d3(TERMS[a1])}. ${A[a1] < E[a1] ? "A topic that shrank also adds to the score, but" : "It grew, but"} another topic changed by a larger factor. Look for the biggest ratio between the two columns, in either direction.`, false)}</div>
        ${ok1 ? `<div id="q2"><p class="task">Add the five terms. Where does the score land?</p>
          ${kit.options(BANDS, { picked: a2, correct: right2 })}
          ${a2 == null ? "" : ok2
            ? kit.feedback(`Right: PSI = ${TERMS.map(d3).join(" + ")} = <b>${PSI_WEEK.toFixed(2)}</b>. The rule of thumb banks have used since the 1990s: under 0.1, little change; 0.1 to 0.25, look into it; over 0.25, a big change. These cut-offs are habits, not laws: papers on PSI point out that they ignore how many questions you have. A monitoring library may use its own default; Evidently's documentation, for example, gives 0.1 for its PSI test (checked 2026-11-14). The score says the questions moved. It does not yet say the answers got worse.`, true)
            : kit.feedback(`Not ${BANDS[a2]}: the largest term alone is ${d3(TERMS[big])}, and every other term adds to it. Add all five terms in the table.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { a2 = +b.dataset.i; paint(); if (a2 === right2) done(); });
    };
    paint();
  }

  /* 5. From scratch in NumPy, replayed from a traced run on the topic counts. */
  const CODE = [
    "def psi(last_counts, week_counts):",
    "    e = last_counts / last_counts.sum()",
    "    a = week_counts / week_counts.sum()",
    "    e = np.maximum(e, FLOOR)",
    "    a = np.maximum(a, FLOOR)",
    "    terms = (a - e) * np.log(a / e)",
    "    return terms.sum()"
  ];
  // docs/ai-path/runs/s6-detecting-drift/psi_scratch.out.txt: the traced call psi(october topics, week topics)
  const TRACE = [
    {"line": 1, "event": "line", "vars": {}},
    {"line": 2, "event": "line", "vars": {"e": [0.3025, 0.29, 0.235, 0.125, 0.0475]}},
    {"line": 3, "event": "line", "vars": {"e": [0.3025, 0.29, 0.235, 0.125, 0.0475], "a": [0.166667, 0.113333, 0.08, 0.343333, 0.296667]}},
    {"line": 4, "event": "line", "vars": {"e": [0.3025, 0.29, 0.235, 0.125, 0.0475], "a": [0.166667, 0.113333, 0.08, 0.343333, 0.296667]}},
    {"line": 5, "event": "line", "vars": {"e": [0.3025, 0.29, 0.235, 0.125, 0.0475], "a": [0.166667, 0.113333, 0.08, 0.343333, 0.296667]}},
    {"line": 6, "event": "line", "vars": {"e": [0.3025, 0.29, 0.235, 0.125, 0.0475], "a": [0.166667, 0.113333, 0.08, 0.343333, 0.296667], "terms": [0.080968, 0.165987, 0.167022, 0.220601, 0.456443]}},
    {"line": 6, "event": "return", "vars": {"e": [0.3025, 0.29, 0.235, 0.125, 0.0475], "a": [0.166667, 0.113333, 0.08, 0.343333, 0.296667], "terms": [0.080968, 0.165987, 0.167022, 0.220601, 0.456443]}}
  ];
  const RESULT_LINE = "psi topics week 1.091";   // psi_scratch.out.txt, the line after the trace
  // psi_scratch.out.txt, the run without the two floor lines on the length histogram (path before the file name cut with …)
  const NO_FLOOR_OUT = "…psi_scratch.py:27: RuntimeWarning: divide by zero encountered in divide\n  terms = (a - e) * np.log(a / e)\npsi lengths week (no floor) inf";
  const LEN_FLOOR_OUT = "psi lengths week (floor) 2.4114";
  const FRAMES = TRACE.slice(0, -1).map((s, i) => ({ ln: s.line, vars: TRACE[i + 1].vars }));
  const GATE_LN = 3;
  const SAY = {
    1: f => `Counts become shares: each October count divided by the ${N_OCT} October questions. <code>e</code> now sums to 1.`,
    2: f => `The same for this week's ${N_WEEK} questions. Dividing by the total is what lets a ${N_OCT}-question month be compared with a ${N_WEEK}-question week.`,
    3: () => `<code>np.maximum</code> keeps each share, or ${FLOOR} if the share is smaller. No October topic is that small, so <code>e</code> does not change.`,
    4: () => `The same floor for this week. Nothing changes here either.`,
    5: f => `One term per topic, all at once: NumPy works on whole arrays. These are the terms you predicted on the last screen.`,
    6: () => `The function returns the sum. The run printed <code>${RESULT_LINE}</code>: the ${PSI_WEEK.toFixed(2)} you added up by hand.`
  };
  const fmtArr = v => v ? `[${v.map(x => x.toFixed(3)).join(", ")}]` : "–";
  function codeScratch({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const GATE = FRAMES.findIndex(f => f.ln === GATE_LN);
    const popts = ["A large but ordinary number, like 3", "inf, with a warning about dividing by zero", "A small number: an empty bin adds nothing"];
    const pright = 1;
    const paint = () => {
      const f = FRAMES[i], gate = i === GATE - 1 && pred !== pright, v = f.vars;
      el.innerHTML = `<h1>The same score in Python</h1>
        <p class="lead">From scratch with NumPy. <code>last_counts</code> and <code>week_counts</code> are arrays of counts per topic, October and this week; <code>FLOOR = ${FLOOR}</code>. Each step replays a real run on this Mac.</p>
        <p class="task">Step through to the end. Before the floor lines run, answer the question.</p>
        ${kit.code(CODE, f.ln)}
        <div class="vars"><span>e <b>${fmtArr(v.e)}</b></span><span>a <b>${fmtArr(v.a)}</b></span><span>terms <b>${fmtArr(v.terms)}</b></span><span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(SAY[f.ln](f))}
        ${i === GATE - 1 ? `<div id="pred"><p class="task">The next two lines put a floor under every share. Back on screen 1, the length bin "200+" had ${OCT_L[4]} October questions, so its <code>e</code> is 0. Now call <code>psi</code> on the length counts instead of the topic counts, without the floor lines. What does it return?</p>${kit.options(popts.map(kit.esc), { picked: pred, correct: pright })}
          ${pred == null ? "" : pred === pright
            ? `${lab("printed, without the floor lines")}${out(kit, NO_FLOOR_OUT)}${kit.feedback(`Right. a / e divides by 0, giving infinity, and its log is infinity too. One brand-new kind of question turns the whole score into <code>inf</code>, and every other bin is lost in it. With the floor, the same lengths print <code>${LEN_FLOOR_OUT}</code>. The floor value is your choice, and the empty bin's term changes with it. So read the term of each bin, not only the total.`, true)}`
            : pred === 0 ? kit.feedback(`a / e here is a share divided by exactly 0. That is not a big number: it is infinity, and so is its log.`, false)
            : kit.feedback(`The empty bin is the October side (e = 0), not this week's. This week ${WEEK_L[4]} questions sit there. a / e divides by 0.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 || gate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 6. Broken on purpose: the length check that never fires. */
  const BROKEN = [
    "oct_edges = np.quantile(oct_len, Q)",
    "week_edges = np.quantile(week_len, Q)",
    "oct_counts, _ = np.histogram(oct_len, bins=oct_edges)",
    "week_counts, _ = np.histogram(week_len, bins=week_edges)",
    'print(oct_edges, week_edges, oct_counts, week_counts, sep="\\n")',
    'print("drift", round(psi(oct_counts, week_counts), 3))'
  ];
  // docs/ai-path/runs/s6-detecting-drift/broken_bins.out.txt (not altered)
  const BROKEN_OUT = "[ 19.  37.  47.  80. 190.]\n[ 27.    85.75 126.5  167.   266.  ]\n[ 83 116 100 101]\n[75 75 74 76]\ndrift 0.014";
  const FIXED = [
    "edges = np.quantile(oct_len, Q)",
    "edges[-1] = max(oct_len.max(), week_len.max())",
    "oct_counts, _ = np.histogram(oct_len, bins=edges)",
    "week_counts, _ = np.histogram(week_len, bins=edges)",
    'print(edges, oct_counts, week_counts, sep="\\n")',
    'print("drift", round(psi(oct_counts, week_counts), 3))'
  ];
  const FIXED_OUT = "[ 19.  37.  47.  80. 266.]\n[ 83 116 100 101]\n[ 12  16  38 234]\ndrift 1.355";
  function broken({ el, done, kit }) {
    css();
    let a1 = null, a2 = null;
    const OCT_Q3 = +BROKEN_OUT.split("\n")[0].replace(/[^\d. ]/g, " ").trim().split(/\s+/)[3];   // October's third edge, read from the printed output
    const above = WEEK_CHARS.filter(n => n > OCT_Q3).length;
    const causes = [
      "The edges for this week come from this week's own lengths, so each period is cut into four equal quarters",
      "The floor hides the change",
      `The periods have different sizes (${N_OCT} and ${N_WEEK} questions)`
    ];
    const fixes = [
      "Take the edges from October only, and use them for both periods",
      "Use ten bins instead of four",
      "Remove the floor lines from psi"
    ];
    const paint = () => {
      const ok1 = a1 === 0, ok2 = a2 === 0;
      el.innerHTML = `<h1>The length alarm that stays quiet</h1>
        <p class="lead">A teammate added a length check. He wants bins that each hold the same number of questions, so he cuts the lengths at their <b>quartiles</b>: the three lengths that split the questions into four equal quarters.</p>
        <p class="lead"><code>oct_len</code> and <code>week_len</code> hold the question lengths. With <code>Q = [0, 0.25, 0.5, 0.75, 1]</code>, <code>np.quantile(x, Q)</code> gives five edges: the shortest length, the three quartiles, and the longest. <code>np.histogram(x, bins=edges)</code> counts the lengths between each pair of edges, as you did on screen 1. It also returns the edges, which go into <code>_</code> and are not used.</p>
        <p class="lead">The check ran on this week's questions and printed almost <b>no drift</b>. But on screen 1 you saw that the lengths changed a lot.</p>
        <div class="${P}wrap">${kit.code(BROKEN, ok1 ? 1 : -1)}</div>
        ${lab("printed: October's edges, this week's edges, then the two counts")}${out(kit, BROKEN_OUT)}
        <div id="q1"><p class="task">What makes the score so small?</p>
        ${kit.options(causes.map(kit.esc), { picked: a1, correct: 0 })}
        ${a1 == null ? "" : ok1
          ? kit.feedback(`Right. A set's own quartiles always split it into four quarters: that is what quartiles are. Cut each period at its own quartiles and both come out near 25% per bin, whatever the lengths are: look at <code>week_counts</code>. The proof is in the edges: this week's edges are all longer than October's. ${above} of this week's ${N_WEEK} questions are longer than October's third edge, ${OCT_Q3} characters.`, true)
          : a1 === 1 ? kit.feedback(`The floor only acts on a share below ${FLOOR}. Every count printed here is in the dozens, so it changes nothing. Look at the two lines of edges instead.`, false)
          : kit.feedback(`psi divides each count by its period's total first, so the sizes do not matter. Look at <code>week_counts</code>: almost the same in every bin. Why would that be?`, false)}</div>
        ${ok1 ? `<div id="q2"><p class="task">Pick the fix.</p>
          ${kit.options(fixes.map(kit.esc), { picked: a2, correct: 0 })}
          ${a2 == null ? "" : ok2
            ? `<div class="${P}wrap">${kit.code(FIXED, -1)}</div>${lab("printed, after the fix: the edges, then the two counts")}${out(kit, FIXED_OUT)}${kit.feedback(`Right. The reference period sets the bins once; every later week is counted into the same bins. The second line moves the top edge up to the longest question of either period, so this week's long questions are still counted. The score is now well over 0.25, as you saw on screen 1. The rule: the bins come from the reference and never from the data you are checking.`, true)}`
            : a2 === 1 ? kit.feedback(`Ten bins cut from each period's own lengths hold about a tenth of that period each: the scores stay near 0. The number of bins is not the problem; where the edges come from is.`, false)
            : kit.feedback(`No bin here is empty, so the floor does nothing. Without it nothing changes, and the next empty bin turns the score into inf.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { a2 = +b.dataset.i; paint(); if (a2 === 0) done(); });
    };
    paint();
  }

  /* 7. Does it need action? Two weeks with big drift scores; only one hurts quality. */
  function needAction({ el, done, kit }) {
    css();
    let ans = null;
    const correct = 1;
    const opts = ["Both: both scores are over 0.25", "Only the filing week", "Only the refund week", "Neither: drift scores are too rough to act on"];
    const eO = expected(E), eW = expected(A), eR = expected(RS);
    const [gwP, gwN] = graded(WEEK_GRADED), [grP, grN] = graded(REFUND_GRADED);
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>Which week needs action?</h1>
        <p class="lead">Two weeks later, refunds start going out, and a different wave arrives: "where is my refund?". Its topic drift score against October is <b>${PSI_REF.toFixed(2)}</b>; the first filing week scored <b>${PSI_WEEK.toFixed(2)}</b>. Both are over 0.25.</p>
        <table class="${P}tb ${P}sm"><thead><tr><th>topic</th><th class="n">Oct.</th><th class="n">filing week</th><th class="n">refund week</th><th class="n">Oct. pass rate</th></tr></thead><tbody>
          ${TOPICS.map((t, i) => `<tr><td class="t">${kit.esc(t)}</td><td class="n">${p0(E[i])}</td><td class="n">${p0(A[i])}</td><td class="n">${p0(RS[i])}</td><td class="n">${p0(RATE[i])}</td></tr>`).join("")}</tbody></table>
        <p class="task">Graders are busy. Which week should the team act on now?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? `${kit.feedback(`Right. Multiply each topic's October pass rate by that topic's share of a week, then add the five results. That gives the pass rate the week's mix predicts: October <b>${pc(eO)}</b>, filing week <b>${pc(eW)}</b>, refund week <b>${pc(eR)}</b>. The refund wave is drift too, but onto a topic the assistant already handles well. Then the graders reported, ${gwN} answers each week: filing week <b>${gwP} of ${gwN} passed (${pc(gwP / gwN)})</b>, refund week <b>${grP} of ${grN} (${pc(grP / grN)})</b>. The filing week did ${gwP / gwN < eW ? "even worse than" : "about as"} the estimate${gwP / gwN < eW ? "" : " said"}. The estimate assumes each topic stays as hard as in October and rests on ${OCT_GRADED[0][1]} grades per topic: treat it as a direction, not a forecast. Each graded answer moves a result by ${(100 / gwN).toFixed(2)} percentage points, so a few points either way is a handful of answers. That is <b>quality drift</b>, now measured.`, true)}
             ${kit.feedback(`What acting means: grade more of the new kinds of questions; give the assistant what it lacks for them (help pages on deductions and side income in its prompt or retrieval); add those questions to the test set you run before every change; then check the next week's grades.`)}`
          : ans === 0 ? kit.feedback(`A drift score says the questions moved, not that the answers got worse. Look at where each week's questions land and how October did there: the refund week puts ${p0(RS[1])} of its questions on refund status, which passed ${p0(RATE[1])} in October.`, false)
          : ans === 2 ? kit.feedback(`The refund wave lands on refund status, where October passed ${p0(RATE[1])}. The filing week lands on ${WEAK.map(i => TOPICS[i]).join(" and ")}, which passed ${p0(RATE[WEAK[0]])} and ${p0(RATE[WEAK[1]])}.`, false)
          : kit.feedback(`Rough, yes, but not blind. Combined with October's per-topic grades, the mix tells you which week puts questions on weak topics. Waiting a week for graders means a week of worse answers.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  const FEW = 15;
  const BIG = [
    ["A spam filter whose users mark missed spam with one tap, within minutes.", 1],
    ["A contract-summary feature. Lawyers check a summary weeks later, if ever.", 0],
    [`An internal helper that gets about ${FEW} questions a week.`, 2]
  ];
  const BIG_OPTS = ["A drift score on the inputs", "Watch quality directly", "Read the questions yourself"];
  const BIG_SAY = [
    ["Here the true outcome arrives within minutes: users mark it. A drift score is a stand-in for outcomes that come late; you have the real thing, so watch it.", "", "Far too many messages to read by hand."],
    ["", "Quality is only known weeks later, if ever, so watching it directly tells you too late. That is exactly when the inputs are the early warning.", "Possible for a few, but the point is a daily signal that needs nobody."],
    [`With ${FEW} questions in a few bins, one question moves a share by ${(100 / FEW).toFixed(1)} percentage points: the score jumps about from noise alone.`, "With so few questions, a quality rate jumps about too; but you can simply read them all.", ""]
  ];
  const BIG_YES = [
    "Right. The outcome comes back fast, so measure it, not a stand-in.",
    "Right. Outcomes come late or never, so the inputs are the early warning.",
    `Right. ${FEW} questions are a short read, and a score on them is mostly noise.`
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When a drift score earns its place</h1>
        <p class="lead"><b>What for:</b> an early, cheap warning that the inputs no longer look like the period you tested on.</p>
        <p class="lead"><b>Reach for it</b> when grades or true outcomes come late or cost a person's time, and the inputs can be put into bins (topic, length, language, source).</p>
        <p class="lead"><b>Not when</b> the true outcome comes back fast (watch it directly), when the sample is tiny (the score is noise), or when the input stays the same and the model changes: an input score cannot see that.</p>
        <p class="lead"><b>Cost:</b> keeping a reference sample, choosing features and bins, false alarms at every expected season, and a person who looks when it fires.</p>
        <p class="task">Pick what to watch in each situation.</p>
        ${BIG.map(([q, r], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? BIG_YES[i] : BIG_SAY[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: would an input drift score warn you here? */
  const CASES = [
    ["A phone app ships a new feature. Its support bot starts getting questions about that feature, which its help pages do not mention yet.", true,
      "Yes, if the topic list has an \"other\" bin. The list was fixed before the feature existed, so the classifier files those questions under \"other\". That bin jumps from nearly empty to a real share, and its term is large. The score fires days before anyone grades an answer. This is why a reference topic list needs an \"other\" bin.",
      "The topic list was fixed before the feature existed, but the questions do not vanish: the classifier files them under \"other\", which jumps from nearly empty to a real share. That is exactly the bin-share change the score adds up, and it shows on day one. It is also why a reference topic list needs an \"other\" bin."],
    ["A recipe chatbot gets twice as many questions at weekends, and its answers come slower then. The questions are the same kinds as on weekdays.", false,
      "No. The score compares shares, and the shares did not move: double the volume of the same mix scores about 0. The slow answers come from load: watch request counts and latency.",
      "Twice as many questions of the same kinds keep every share where it was, so the score stays near 0 and misses the slow answers. That is a load problem: watch request counts and latency."],
    ["The hosted model behind a summariser was updated by its provider. The documents users send have not changed, but summaries got shorter and users complain.", false,
      "No. The inputs did not move, so an input drift score stays flat. What changed is the model. Compare graded samples from before and after, and watch output signals such as summary length.",
      "Every input bin looks like last month: same documents, same lengths. An input score cannot see a change on the model's side. Compare graded samples before and after, and watch outputs such as summary length."],
    ["A translation feature suddenly gets many users writing in a language it rarely saw before.", true,
      "Yes. Bin the inputs by language: one share jumps from nearly empty to large. Remember the floor, or the score becomes inf.",
      "A language bin that was almost empty is now large: a big term, and the score fires. With the floor, it stays a number instead of inf."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a drift score warn you?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the tax assistant.</p>
        <p class="task">For each one, decide if an input drift score would catch the problem. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>The questions moved. Did the answers?</h1>
      <p class="lead">You can now bin two periods of inputs, compute a PSI drift score from scratch, keep it from breaking on empty bins, spot bins that were cut per period, and decide with per-topic grades whether a drift needs action.</p>
      <table class="${P}tb"><tbody>
        <tr><td><b>Input drift</b></td><td class="t">Shares per bin against a reference period, added up: (a − e) × ln(a / e) per bin.</td></tr>
        <tr><td><b>Bins</b></td><td class="t">Cut once from the reference, reused for every later week. A floor under empty bins.</td></tr>
        <tr><td><b>Quality drift</b></td><td class="t">Weight the reference grades per topic by the new mix, then confirm with fresh grades.</td></tr>
      </tbody></table>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write a drift check that bins two sets of question lengths on edges taken from the reference, applies a floor, returns the score with its per-bin terms, and decides whether to alert.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Grades come late; user votes come fast. That lesson shows when those votes lie, and how feedback can feed a model its own mistakes.</p>` : ""}`;
    done();
  }

  LessonKit.define("s6-detecting-drift", {
    title: "Detecting input and quality drift",
    checked: "2026-11-14",
    sources: [
      "https://numpy.org/doc/stable/reference/generated/numpy.histogram.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.quantile.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.log.html",
      "https://arxiv.org/abs/2307.11878",
      "https://scholarworks.wmich.edu/dissertations/3208/",
      "https://docs.evidentlyai.com/metrics/customize_data_drift",
      "https://docs.evidentlyai.com/metrics/explainer_drift"
    ],
    interview: [{
      q: "Your support assistant was evaluated carefully at launch. Three months later nobody has graded anything since. How would you notice it getting worse before users complain?",
      good: [
        "Log simple features of every input, such as topic from a classifier, length and language, and keep a reference sample from the evaluated period",
        "Compute a drift score such as PSI per feature every day or week, on bins cut once from the reference, with a floor for empty bins",
        "When it fires, weight the launch eval results per topic by the new mix to see whether the shift lands on weak topics",
        "Grade a fresh sample of the new kinds of questions to measure quality directly, and add them to the eval set",
        "Treat thresholds such as 0.1 and 0.25 as starting points: tune them for your sample size and expect seasonal shifts"
      ],
      weak: "Retrain or re-prompt on a fixed schedule, or alert whenever a drift score passes 0.25, without checking whether the shift lands on topics where quality is actually weak."
    }, {
      q: "Your drift dashboard shows a score near 0 every day, yet support says this month's questions are clearly different. What do you check?",
      good: [
        "Whether the bin edges are computed per period, for example quantiles of each week, which makes every period look the same",
        "Whether the feature binned is the one that changed: topic can move while length stays the same",
        "Whether empty or tiny bins are handled, since a missing floor gives inf and a too-large floor can mute a new category",
        "Look at the per-bin shares side by side, not only the total"
      ],
      weak: "Trust the dashboard and tell support the questions have not changed, or lower the threshold until it fires."
    }],
    screens: [binByHand, predict, spotIdea, scoreTopics, codeScratch, broken, needAction, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(SAMPLES.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: [...Array(Math.max(0, FRAMES.findIndex(f => f.ln === GATE_LN) - 1)).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FRAMES.length - FRAMES.findIndex(f => f.ln === GATE_LN)).fill("[data-next]")] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
