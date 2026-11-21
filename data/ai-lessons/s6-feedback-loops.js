/* Lesson: user feedback loops and their traps. Story: a recipe-substitution assistant in a grocery app gets
   mostly happy votes, yet complaints to customer service keep rising.
   Ideas: (1) a thumbs ratio measures what the voters knew when they voted, and who chose to vote: votes cast
   seconds after reading, before cooking, and people whose dish failed not coming back, make the ratio lie;
   design the flow so the question comes after the outcome, to a sample you choose, linked to the answer;
   (2) feedback that is really the model's own output (an untouched pre-filled box, an accepted default,
   thumbs on what it chose to show) teaches the model what it already does: a feedback loop.
   Data, all from real runs on this Mac (no model calls):
   - docs/ai-path/runs/s6-feedback-loops/sim_feedback.py + .out.txt: the simulated feedback log (users are
     simulated, seed 0): weekly table, splits, the 12-event sample;
   - export_rows.py + .out.txt: the broken-on-purpose export to fine-tuning rows and its one-line fix;
   - loop_sim.py + .out.txt: the retraining loop, thumbs on sight against explore + after cooking.
   Lesson-local style: a multi-column table (.lx-s6-feedback-loops-*), see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s6-feedback-loops";
  const pct = (a, b) => Math.round(1000 * a / b) / 10;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  // sim_feedback.out.txt, WEEKLY: [week, answers, votes, up, up% (recomputed below), complaints]
  const WEEKLY = [[1, 500, 71, 63, 7], [2, 500, 68, 64, 5], [3, 500, 75, 71, 3], [4, 500, 60, 59, 15], [5, 500, 69, 61, 16], [6, 500, 71, 68, 26]];
  // sim_feedback.out.txt, SPLITS
  const SPLIT = {
    reading: { votes: 298, up: 278 },
    after: { votes: 116, up: 108 },
    all: { votes: 414, up: 386 }
  };
  const COMPLAINTS = { total: 72, voted: 2, votedUp: 2, newUsers: 40 };
  const TOTALS = { answers: 3000, failed: 351, votes: 414 };
  // sim_feedback.out.txt, SAMPLE (week 6): id, user, vote, vote_when, vote_after_s, complaint
  const SAMPLE = [
    [2509, "new", "up", "reading", 5, false], [2511, "new", null, null, null, true], [2517, "new", null, null, null, true],
    [2521, "regular", "up", "reading", 4, false], [2522, "regular", "up", "reading", 20, false], [2524, "regular", null, null, null, true],
    [2539, "regular", null, null, null, true], [2541, "new", "up", "reading", 3, false], [2543, "regular", "up", "reading", 22, false],
    [2577, "regular", "up", "after cooking", 234000, false], [2601, "regular", "up", "after cooking", 122400, false], [2610, "regular", "up", "after cooking", 133200, false]
  ].map(([id, user, vote, when, after, complaint]) => ({ id, user, vote, when, after, complaint }));

  // export_rows.py, build_training_rows, line for line (line 0 = def)
  const CODE = [
    "def build_training_rows(events):",
    "    rows = []",
    "    for e in events:",
    "        if e[\"vote\"] == \"down\":",
    "            continue",
    "        if e[\"saved_swap\"] is not None:",
    "            rows.append((e[\"request\"], e[\"saved_swap\"], \"correction\"))",
    "        elif e[\"vote\"] == \"up\":",
    "            rows.append((e[\"request\"], e[\"answer\"], \"thumbs up\"))",
    "    return rows"
  ];
  const FIXED_LINE = "        if e[\"saved_swap\"] is not None and e[\"saved_swap\"] != e[\"answer\"]:"; // build_training_rows_fixed
  // export_rows.out.txt
  const EXPORT = {
    buggy: { rows: 1152, corr: 890, corrSame: 843, up: 262, own: 1105, complained: 25 },
    fixed: { rows: 425, corr: 47, corrSame: 0, up: 378, own: 378, complained: 4 },
    saved: 901, edited: 47
  };
  // loop_sim.py assumptions and loop_sim.out.txt (rounds 0 and 6 of each run)
  const LOOKS = { A: 0.95, B: 0.85, C: 0.70 }, WORKS = { A: 0.70, B: 0.80, C: 0.95 };
  const LOOP = {
    sight: [{ A: 30.6, B: 34.4, C: 35.0, worked: 82.8 }, { A: 31.6, B: 31.6, C: 36.9, worked: 81.8 }, { A: 21.2, B: 41.0, C: 37.8, worked: 83.7 }, { A: 32.9, B: 38.9, C: 28.2, worked: 82.0 }, { A: 40.6, B: 42.2, C: 17.2, worked: 79.3 }, { A: 44.7, B: 37.9, C: 17.4, worked: 75.9 }, { A: 46.7, B: 40.8, C: 12.6, worked: 76.2 }],
    explore: [{ A: 34.6, B: 32.7, C: 32.8, worked: 80.6 }, { A: 35.4, B: 21.0, C: 43.6, worked: 84.7 }, { A: 27.2, B: 21.9, C: 50.9, worked: 84.0 }, { A: 17.3, B: 23.2, C: 59.4, worked: 86.8 }, { A: 20.2, B: 17.4, C: 62.3, worked: 85.0 }, { A: 13.1, B: 16.2, C: 70.7, worked: 90.2 }, { A: 16.9, B: 10.7, C: 72.4, worked: 88.4 }]
  };
  const SHOWN_PER_ROUND = 900, EXPLORE_PCT = 10, ASK_PCT = 10; // loop_sim.py: SHOWN_PER_ROUND, random pick share in run 2, ASK_P

  /* ---------- Derived from the data ---------- */
  const UP = WEEKLY.map(w => pct(w[3], w[2]));
  const C_FIRST = WEEKLY[0][4], C_LAST = WEEKLY[WEEKLY.length - 1][4];
  const UP_ALL = pct(SPLIT.all.up, SPLIT.all.votes), UP_READ = pct(SPLIT.reading.up, SPLIT.reading.votes), UP_AFTER = pct(SPLIT.after.up, SPLIT.after.votes);
  const S_COMPLAINTS = SAMPLE.filter(e => e.complaint);
  const S_VOTES = SAMPLE.filter(e => e.vote);
  const S_COMPLAINED_VOTED = S_COMPLAINTS.filter(e => e.vote).length;
  const S_FAST = S_VOTES.filter(e => e.after < 60).length;
  const S_LATE = S_VOTES.filter(e => e.after >= 60);
  const lateWho = (() => { const u = new Set(S_LATE.map(e => e.user)); return u.size === 2 ? "both" : [...u][0]; })();
  const days = s => Math.round(s / 8640) / 10;
  const whenTxt = e => e.vote ? (e.after < 60 ? `${e.after} s` : `${days(e.after)} days`) : "–";
  const L0 = LOOP.sight[0], L6 = LOOP.sight[LOOP.sight.length - 1], E0 = LOOP.explore[0], E6 = LOOP.explore[LOOP.explore.length - 1];
  const ROUNDS = LOOP.sight.length - 1;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-t { width: 100%; border-collapse: collapse; margin: 16px 0 4px; font-size: 15px; font-variant-numeric: tabular-nums; }
      .lx-${ID}-t caption { text-align: left; font-size: 13.5px; color: var(--muted); padding-bottom: 6px; }
      .lx-${ID}-t th { text-align: left; font: 600 12.5px/1.3 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; padding: 6px 6px 6px 0; border-bottom: 1px solid var(--line); vertical-align: bottom; }
      .lx-${ID}-t td { padding: 8px 6px 8px 0; border-bottom: 1px solid var(--line); color: var(--ink); vertical-align: top; }
      .lx-${ID}-t td.n, .lx-${ID}-t th.n { text-align: right; }
      .lx-${ID}-t tr.lx-${ID}-hi td { font-weight: 650; }
      .lx-${ID}-t tr.lx-${ID}-hi td:first-child { box-shadow: inset 3px 0 0 var(--ink); padding-left: 8px; }
      .lx-${ID}-cap { margin: 4px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { font: 500 13.5px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; white-space: pre-wrap; }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); font: 500 13.5px/1.6 var(--mono); color: var(--ink); overflow-wrap: anywhere; white-space: pre-wrap; }
      .lx-${ID}-q { margin: 18px 0 0; font-weight: 600; }
      .lx-${ID}-wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + 16ch); text-indent: -16ch; }
      @media (max-width: 600px) { .lx-${ID}-wrap .lcode div { padding-left: calc(12px + 16ch); } }
    `;
    document.head.appendChild(s);
  }
  // head: [[label, numeric?]]; rows: arrays of cell text (escaped here); hi: set of highlighted row indexes
  function tbl(kit, head, rows, { caption = "", hi = new Set() } = {}) {
    return `<table class="lx-${ID}-t">${caption ? `<caption>${kit.esc(caption)}</caption>` : ""}<thead><tr>${head.map(([h, n]) => `<th${n ? ' class="n"' : ""}>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) =>
      `<tr${hi.has(i) ? ` class="lx-${ID}-hi"` : ""}>${r.map((c, j) => `<td${head[j][1] ? ' class="n"' : ""}>${kit.esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const SIM_NOTE = "Simulated log: the users come from a small simulation we ran, built to show this trap, not data from a real app.";
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const optMono = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;

  /* 1. The situation: complaints rise. Predict what the thumbs should do. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Fall, week by week", "Stay about the same", "Rise"];
    const RIGHT = 0;
    const flat = Math.max(...UP) - Math.min(...UP);
    const fb = [
      [`Right, if votes measured whether swaps work. Now look at what the votes really did: the thumbs-up share stayed between ${Math.min(...UP)}% and ${Math.max(...UP)}% (a spread of ${Math.round(flat * 10) / 10} points, up and down with no trend), while complaints went from ${C_FIRST} to ${C_LAST}. Something about the votes does not measure what the team thinks it measures.`, true],
      ["If the votes tracked whether swaps work, more failed dishes would mean more thumbs down, so the share would drop. A flat share would mean the votes do not see the failures. Hold that thought.", false],
      ["More failed dishes would mean more thumbs down if the votes saw them. A rising share would fit a better assistant, not a worse one.", false]
    ];
    const paint = () => {
      const r = WEEKLY.map((w, i) => [String(w[0]), String(w[1]), String(w[2]), ans === RIGHT ? `${UP[i]}%` : "?", String(w[4])]);
      el.innerHTML = `<h1>Happy votes, angry calls</h1>
        <p class="lead">A grocery app has an assistant for recipe swaps: “I have no buttermilk, what can I use?” Under every answer sit two buttons, thumbs up and thumbs down. The team's dashboard shows the thumbs-up share and it looks great. But customer service says complaints about bad swaps keep rising. Votes like these are how many teams judge a live AI feature, and even what they retrain it on. This lesson is about when they lie. Here are six weeks.</p>
        ${tbl(kit, [["week"], ["answers", 1], ["votes", 1], ["thumbs up", 1], ["complaints", 1]], r, { caption: "Assistant answers, votes and complaints per week" })}
        <p class="lx-${ID}-cap">${SIM_NOTE}</p>
        <p class="task">Complaints went from ${C_FIRST} to ${C_LAST} a week. If the thumbs measured whether swaps really work, what would the thumbs-up share do over these weeks?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand: go through twelve events and find who votes, and when. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    let step = 0, ans = null;
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const Q0 = range(0, S_COMPLAINTS.length), Q1 = range(2, S_VOTES.length);
    const Q = [
      { task: `Look at the ${plural(S_COMPLAINTS.length, "answer")} that ended in a complaint. How many of them got a vote, up or down?`,
        opts: Q0.map(String), right: Q0.indexOf(S_COMPLAINED_VOTED), hi: new Set(SAMPLE.map((e, i) => e.complaint ? i : -1)),
        fb: v => v > S_COMPLAINED_VOTED ? `Read the vote column on the complaint rows again: it shows “–”, no vote, on every one of them.` : "Count again on the complaint rows." },
      { task: `Now the ${plural(S_VOTES.length, "vote")}. How many were cast less than a minute after the answer appeared?`,
        opts: Q1.map(String), right: Q1.indexOf(S_FAST), hi: new Set(SAMPLE.map((e, i) => e.vote ? i : -1)),
        fb: v => v > S_FAST ? `Some votes came days later: the “voted” column says days, not seconds, on ${plural(S_LATE.length, "row")}.` : `Count every vote whose “voted” column is in seconds. A few seconds after reading is long before anyone could cook.` },
      { task: `The ${plural(S_LATE.length, "vote")} cast days later came after cooking. Who cast them?`,
        opts: ["Only new users", "Only regulars", "Both"], right: ["new", "regular", "both"].indexOf(lateWho), hi: new Set(SAMPLE.map((e, i) => e.vote && e.after >= 60 ? i : -1)),
        fb: v => v === "Only new users"
          ? `Read the “user” column on the ${plural(S_LATE.length, "marked row")}: none says new. New users whose dish failed had no reason to come back to the answer.`
          : `“Both” would need a new user among the late votes. Read the “user” column on the ${plural(S_LATE.length, "marked row")}: every one says regular.` }
    ];
    const paint = () => {
      const q = Q[Math.min(step, Q.length - 1)];
      const fin = step >= Q.length;
      const rows = SAMPLE.map(e => [`#${e.id}`, e.user, e.vote || "–", whenTxt(e), e.complaint ? "yes" : "–"]);
      el.innerHTML = `<h1>Read the log yourself</h1>
        <p class="lead">${SAMPLE.length} answers from week ${WEEKLY.length}: the first ${S_COMPLAINTS.length} that drew a complaint, the first ${S_FAST} votes cast while reading, the first ${S_LATE.length} votes cast later. “Voted” is the time between the answer appearing and the vote.</p>
        ${tbl(kit, [["answer"], ["user"], ["vote"], ["voted"], ["complaint"]], rows, { caption: `Week ${WEEKLY.length} sample`, hi: fin ? new Set() : q.hi })}
        <p class="lx-${ID}-cap">${SIM_NOTE}</p>
        ${fin ? "" : `<p class="task">${q.task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`So: ${S_COMPLAINED_VOTED} of ${S_COMPLAINTS.length} complaints came with a vote. ${S_FAST} of ${S_VOTES.length} votes came within seconds, when nobody had cooked yet. The few votes cast after cooking came from regulars only. In this sample, the people who were let down never pressed a thumb: they called support.`, true)
          : `${kit.options(q.opts, { picked: ans, correct: q.right })}${ans == null ? "" : kit.feedback(q.fb(step < 2 ? +q.opts[ans] : q.opts[ans]), false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === q.right) { step++; ans = null; paint(); if (step >= Q.length) done(); return; }
        ans = i; paint();
      });
    };
    paint();
  }

  /* 3. Spot the idea: why does the ratio lie? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `Too few votes: ${SPLIT.all.votes} out of ${TOTALS.answers} answers is too small a sample`,
      "Most votes are cast while reading, before cooking, and the people whose dish failed do not come back to vote. The votes rate how answers look, from the people who chose to vote",
      "People are polite and press thumbs up even when the swap is bad",
      "The thumbs button logs votes wrongly"
    ];
    const RIGHT = 1;
    const fb = [
      [`Size is not the problem. Ten times more votes, cast the same way at the same moment, would give the same share. A big sample of the wrong thing is still the wrong thing.`, false],
      [`Right. Two traps stack up. <b>When</b>: a vote cast seconds after reading can only judge how the answer reads, and a wrong swap can read perfectly well. <b>Who</b>: voting is optional, and the people with a bad result choose another channel (support) or none at all. Statisticians call the second one <b>non-response bias</b>, a kind of <b>selection bias</b>: the data is unrepresentative because of who takes part. The ${UP_ALL}% is honest about one thing only: how answers looked to the people who chose to vote.`, true],
      ["Nothing says the voters lied. Someone reading a sensible-sounding swap really does think it is good. The vote is sincere; it is just cast before the person knows the result.", false],
      [`The log is consistent: the votes add up week by week and match the sample you read. The problem is not recording; it is what a vote at that moment can know.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why the ratio lies</h1>
        <p class="lead">Over all six weeks the dashboard says ${UP_ALL}% thumbs up (${SPLIT.all.up} of ${SPLIT.all.votes} votes), while ${COMPLAINTS.total} complaints reached customer service.</p>
        <p class="task">What is the real reason the thumbs-up share says so little about whether the swaps work?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Predict on the whole log: split the votes by when they were cast. */
  function predictSplits({ el, done, kit }) {
    ensureStyle();
    let step = 0, ans = null;
    const diff = UP_AFTER - UP_READ;
    const R1 = Math.abs(diff) < 3 ? 1 : diff < 0 ? 0 : 2;
    const share = COMPLAINTS.voted / COMPLAINTS.total;
    const R2 = share < 0.1 ? 2 : share < 0.35 ? 1 : 0;
    const Q = [
      { task: `Votes cast while reading: ${UP_READ}% up. Predict the thumbs-up share among the ${SPLIT.after.votes} votes cast days later, after cooking.`,
        opts: ["Clearly lower", "About the same", "Clearly higher"], right: R1,
        fb: [`It would be lower if the people with failed dishes came back to vote. They mostly did not, so the late votes come almost only from dishes that worked.`, null, `Higher would mean the late voters are happier than the readers. Look at who comes back: mostly regulars whose dish worked, and they vote up about as often as readers.`] },
      { task: `${COMPLAINTS.total} people complained to support over the six weeks. Predict how many of them had voted on that answer.`,
        opts: ["About half", "About a quarter", "Almost none"], right: R2,
        fb: ["Half would mean the thumbs capture a good part of the failures. Remember the sample: none of the complaint rows had a vote.", "Even a quarter is far too many. In the sample not one complaint row had a vote.", null] }
    ];
    const paint = () => {
      const fin = step >= Q.length, q = Q[Math.min(step, Q.length - 1)];
      const known = [[`while reading`, String(SPLIT.reading.votes), `${UP_READ}%`]];
      if (step >= 1) known.push([`after cooking`, String(SPLIT.after.votes), `${UP_AFTER}%`]);
      el.innerHTML = `<h1>Split the votes, then predict</h1>
        <p class="lead">A single ratio hides who voted and when. Splitting it is the first thing to do with any feedback number. Here is the whole six-week log, ${TOTALS.answers} answers.</p>
        ${tbl(kit, [["voted"], ["votes", 1], ["thumbs up", 1]], known, { caption: "All six weeks" })}
        ${fin ? "" : `<p class="task">${q.task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right: ${COMPLAINTS.voted} of ${COMPLAINTS.total}. Even the votes cast after cooking were ${UP_AFTER}% up, because the people whose swap failed hardly ever came back to the answer; ${COMPLAINTS.newUsers} of the ${COMPLAINTS.total} complaints came from new users, who voted least. Moving the question later is not enough on its own. You also have to <b>reach the people who failed</b>, and <b>link the support complaint to the answer</b> that caused it, so the failures count somewhere.`, true)
          : ask(kit, q.opts, q.right, ans, q.opts.map((_, i) => [q.fb[i] || "", i === q.right]))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === Q[step].right) { step++; ans = null; paint(); if (step >= Q.length) done(); return; }
        ans = i; paint();
      });
    };
    paint();
  }

  /* 5. Design the flow: four decisions. */
  const DESIGN = [
    ["When do you ask?", ["Right under the answer, as now", "When the cook timer ends, or the next time the person opens the app: “Did the swap work?”"], 1,
      "Under the answer, the person has only read it. The question has to come when they can know the result: after cooking.",
      "Yes. Ask when the outcome is known. A vote is only as good as what the voter knows at that moment."],
    ["Whom do you ask?", ["Whoever wants to tap the button", "A random sample of everyone who used a swap, new users and regulars alike"], 1,
      "Whoever wants to vote is exactly the self-selected group that hid the failures. New users with a failed dish never tapped.",
      "Yes. A random sample you choose, not volunteers, is what makes the share stand for everyone. Still watch the answer rate per group: if new users ignore the question, the bias creeps back."],
    ["What do you store with each answer?", ["The vote alone", "The vote, plus the answer's id, the request, the model version, when it was asked, and new or regular user"], 1,
      "With the vote alone you cannot split by when or who, cannot compare model versions, and cannot join a complaint to the answer that caused it.",
      "Yes. The id is what lets support complaints, corrections and votes meet in one place, and the extra fields let you split the ratio the way you just did."],
    ["How do you take corrections?", ["Save the edit box, which starts filled with the suggested swap", "An empty field, “What did you use instead?”, kept only when it says something different from the suggestion"], 1,
      "A box that starts filled with the model's text records the model's text whenever the person just presses Save. That is not a correction. The next screen shows what it does to a dataset.",
      "Yes. A correction is only worth keeping when it differs from what the model said. Free text also needs a privacy check before anyone trains on it."]
  ];
  function design({ el, done, kit }) {
    ensureStyle();
    const ans = DESIGN.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Design a feedback flow that sees failures</h1>
        <p class="lead">You are rebuilding the feedback flow for the swap assistant. Four decisions.</p>
        <p class="task">Pick the better option for each. Pick again if you change your mind.</p>
        ${DESIGN.map(([q, opts, r, no, yes], i) => `<div class="lcase" id="c${i}"><p class="lx-${ID}-q">${kit.esc(q)}</p>${kit.options(opts.map(kit.esc), { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : no, ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (DESIGN.every((d, j) => ans[j] === d[2])) done();
      }));
    };
    paint();
  }

  /* 6. Broken on purpose: the export that turns feedback into fine-tuning rows. */
  function brokenExport({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null; // 0 = find the line, 1 = pick the fix, 2 = fixed run shown
    const B = EXPORT.buggy, F = EXPORT.fixed;
    const out = r => `rows: ${r.rows}\n  "correction": ${r.corr}, identical to the model's own answer: ${r.corrSame}\n  "thumbs up": ${r.up}\nrows from answers that later drew a complaint: ${r.complained}`;
    const LINE_OPTS = [3, 5, 7]; // listing lines, 0 = def
    const lineFb = {
      3: ["This line skips thumbs-down answers. That throws away negative signal, which is worth noticing, but it removes rows; it cannot turn the model's own text into a “correction”.", false],
      7: [`This line adds thumbs-up answers with the model's answer as the target. Those are the model's words too, but they are labelled “thumbs up”, not “correction”. The ${B.corrSame} come from somewhere else.`, false]
    };
    const FIX_OPTS = [
      FIXED_LINE.trim(),
      "delete the two lines that skip thumbs-down votes",
      "elif e[\"vote\"] == \"up\" and e[\"saved_swap\"] is None:",
      "return list(set(rows))"
    ];
    const fixFb = [
      null,
      ["That would let thumbs-down answers in as training targets: worse. The correction rows would still be the untouched box.", false],
      ["The <code>elif</code> only runs when the <code>if</code> above it was false. The untouched boxes are caught by that <code>if</code> and never reach the <code>elif</code>.", false],
      ["Every row has its own request, so there are no duplicates to remove. The rows are unique and still the model's own text.", false]
    ];
    const paint = () => {
      const fixedCode = CODE.map((l, i) => i === 5 && stage === 2 ? FIXED_LINE : l);
      el.innerHTML = `<h1>Broken on purpose: “human corrections”</h1>
        <p class="lead">The team wants to fine-tune the assistant (train it further on examples) using feedback. Every answer has a “Save to shopping list” box that <b>starts filled with the suggested swap</b>. People can edit it before saving. The app stores the box's text as <code>saved_swap</code>. This export turns the six-week log into training rows. Each row is a request and the swap the model should learn to give. It ran on the same log and printed:</p>
        <div class="lx-${ID}-wrap">${kit.code(stage === 2 ? fixedCode : CODE, stage === 0 ? -1 : 5)}</div>
        <div class="lx-${ID}-out">${kit.esc(out(stage === 2 ? F : B))}</div>
        <p class="lx-${ID}-cap">Output of export_rows.py on the simulated log${stage === 2 ? ", fixed version" : ""}.</p>
        ${stage === 0 ? `<p class="task">${B.corrSame} of ${B.corr} “corrections” are word for word the model's own answer. Which line causes that?</p>
          <div class="lpanel">${ask(kit, LINE_OPTS.map(n => optMono(kit, CODE[n].trim())), 1, ans, LINE_OPTS.map(n => lineFb[n] || ["", true]))}</div>` : ""}
        ${stage === 1 ? `<p class="task">The marked line counts every saved box as a correction, even one nobody touched. What should that line say instead?</p>
          <div class="lpanel">${ask(kit, FIX_OPTS.map(t => optMono(kit, t)), 0, ans, fixFb.map(f => f || ["", true]))}</div>` : ""}
        ${stage === 2 ? `<div class="lpanel">${kit.feedback(`Right. Of ${EXPORT.saved} saved boxes only ${EXPORT.edited} were edited, and now only those ${F.corr} count as corrections. In the buggy file, ${B.own} of ${B.rows} rows (${pct(B.own, B.rows)}%) had the model's own answer as the target, ${B.corrSame} of them labelled “human correction”, and ${B.complained} rows came from answers that later drew a complaint. Fine-tuning on these rows would push the model toward what it already says, mistakes included. Look at the fixed run too: ${F.up} of its ${F.rows} rows are still the model's answers, chosen by thumbs cast while reading. That is the next trap.`, true)}</div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (stage === 0 && i === 1) { stage = 1; ans = null; paint(); return; }
        if (stage === 1 && i === 0) { stage = 2; ans = null; paint(); done(); return; }
        ans = i; paint();
      });
    };
    paint();
  }

  /* 7. The loop: retrain on thumbs, predict what happens to the swap that works best. */
  function selfLoop({ el, done, kit }) {
    ensureStyle();
    let step = 0, ans = null;
    const cDrop = L6.C < L0.C - 5 ? 2 : L6.C > L0.C + 5 ? 0 : 1;
    const wDrop = L6.worked < L0.worked - 2 ? 1 : L6.worked > L0.worked + 2 ? 0 : 2;
    const Q = [
      { task: `Each round, the app shows ${SHOWN_PER_ROUND} answers and some readers vote. Then it retrains: in the next round, each swap's share of answers equals its share of this round's thumbs up. Predict swap C's share after ${ROUNDS} rounds.`,
        opts: ["It grows: it works best", "It stays near a third", "It shrinks"], right: cDrop,
        fb: ["It works best, but the retraining never sees that. It sees thumbs cast on sight, and C looks least right.", "Every round multiplies each share by how well that swap does on thumbs. Small differences compound, round after round.", null] },
      { task: "And the share of shown swaps that work when cooked?",
        opts: ["It rises", "It falls", "It stays where it was"], right: wDrop,
        fb: ["The app is showing more of A, which looks best and works worst.", null, "The mix of swaps changed, so the share that works changed with it."] }
    ];
    const f1 = v => `${v.toFixed(1)}%`;
    const lrow = (name, r) => [name, f1(r.A), f1(r.B), f1(r.C), f1(r.worked)];
    const paint = () => {
      const fin = step >= Q.length, q = Q[Math.min(step, Q.length - 1)];
      const rows = [lrow("round 0", L0)];
      if (fin) rows.push(lrow(`round ${ROUNDS}`, L6), lrow(`second run, round ${ROUNDS}`, E6));
      el.innerHTML = `<h1>The model learning from itself</h1>
        <p class="lead">Now watch what retraining on these thumbs does over time. One kind of request has three possible swaps, A, B and C. In this simulation we set how often each one gets a thumbs up on sight (while reading, before cooking), and how often it works when cooked:</p>
        ${tbl(kit, [["swap"], ["up on sight", 1], ["works", 1]], Object.keys(LOOKS).map(s => [s, `${Math.round(LOOKS[s] * 100)}%`, `${Math.round(WORKS[s] * 100)}%`]), { caption: "Simulation settings (not cooking facts)" })}
        ${tbl(kit, [["run"], ["A", 1], ["B", 1], ["C", 1], ["worked", 1]], rows, { caption: "Share of answers showing A, B and C; “worked” is the share of all shown swaps that worked when cooked", hi: fin ? new Set([1]) : new Set() })}
        <p class="lx-${ID}-cap">Output of loop_sim.py, seed 0. With about ${SHOWN_PER_ROUND * ASK_PCT / 100} votes a round, the shares wobble from round to round; the trend is what matters.</p>
        ${fin ? "" : `<p class="task">${q.task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. Trained on thumbs on sight, C fell from ${f1(L0.C)} to ${f1(L6.C)} of answers and the share that worked fell from ${f1(L0.worked)} to ${f1(L6.worked)}. The model chooses what users see, users can only vote on what they see, and the votes choose what the model shows next. That circle is a <b>feedback loop</b>. Worse, as C fades, the data that could prove C better stops arriving. The last row is a second run with two changes: ${EXPLORE_PCT}% of answers show a random swap, so every swap keeps getting tried, and retraining counts “did it work?” asked after cooking. There C rose to ${f1(E6.C)} and the share that worked reached ${f1(E6.worked)}. Google's Rules of ML (rules 34 and 35) make the same point for spam filters and rankings: what the model shows changes the data it learns from next, so hold out a small share of traffic that the model does not filter, and you still get labels for what it would otherwise hide.`, true)
          : ask(kit, q.opts, q.right, ans, q.opts.map((_, i) => [q.fb[i] || "", i === q.right]))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === Q[step].right) { step++; ans = null; paint(); if (step >= Q.length) done(); return; }
        ans = i; paint();
      });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A meeting-notes tool asks people who attended the meeting whether the summary missed a decision",
      "A visa-paperwork assistant: people learn weeks later whether the consulate accepted their documents",
      "A photo-caption tool: people see the photo and the caption side by side"
    ];
    const RIGHT = 1;
    const fb = [
      ["The people asked were in the meeting, so they can judge the summary the moment they read it. A quick vote here sees most of what matters.", false],
      ["Right. At the moment of reading, nobody can know if the papers will be accepted, and those refused may never come back to the app. Here you need the outcome linked to the answer (or expert review of a sample), not a thumb.", true],
      ["The person sees the photo and the caption together, so a wrong caption is visible the moment they read it. A vote at reading time can see the mistake.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to trust user feedback</h1>
        <p class="lead"><b>For:</b> a cheap signal from real use: finding bad answers, and collecting real requests and corrections for your test set.</p>
        <p class="lead"><b>Reach for it</b> when users can judge the answer when asked, and you can link the vote to the answer and its version.</p>
        <p class="lead"><b>Not</b> as your quality score when the outcome comes later or the user cannot judge it (use outcome data, expert review of a sample, or a golden set), and never as training data without checking it is not the model's own output.</p>
        <p class="lead"><b>Costs:</b> screen space and annoyed users, low answer rates, the work of joining votes to outcomes, privacy review of free text, and people to read samples.</p>
        <p class="task">Three teams want a thumbs button as their main quality signal. For which one is it the weakest guide?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A code editor counts a suggestion as “good” when the developer presses Tab to accept it, and every week fine-tunes on the accepted suggestions.", true,
      "Trap. Accepted suggestions are the model's own text, and pressing Tab says nothing about whether the code later passed its tests. Fine-tuning on them teaches the model to repeat itself, bugs included.",
      "Look again: the training data is text the model wrote, chosen by a key press made before anyone ran the code. That is two of this lesson's traps at once."],
    ["A music app ranks playlists by play count. The top three on the home screen get most of the plays, so they stay on top.", true,
      "Trap. Position, not quality, earns the plays, and the ranking only learns from what it chose to put on top. A playlist lower down never gets the plays that could lift it: the same loop as swap C.",
      "The plays depend on where the app put each playlist, and the app puts them where the plays were. Nothing lower down can climb. That circle is a feedback loop."],
    ["A hotel's check-in chatbot asks a random 5% of guests, at checkout, whether its check-in instructions were right. The answer is used to score the bot, not to train it.", false,
      "Sound. The guests are asked after they used the instructions, so they know; the sample is drawn at random, not left to volunteers; and the bot does not train on its own words. Still watch how many of the asked guests answer.",
      "Check the three traps: the question comes after the outcome (they already checked in), the people asked are a random draw, and nothing is fed back into training. None of the traps applies."],
    ["A news summarizer shows a thumbs button. Two percent of readers vote, nearly all of them daily users, and the team reports the thumbs-up share as summary quality.", true,
      "Trap. The voters are a small self-selected group, mostly daily users who already like the product. The share says how they feel, not how the summaries serve everyone.",
      "Who votes here? A few daily users, by their own choice. That is the non-response trap: the share describes the volunteers, not the readers."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Trap or sound?</h1>
        <p class="lead">Four feedback setups from other products. A trap is any of the three you met: asked before the outcome is known, left to volunteers, or a system learning from its own outputs and from what it chose to show.</p>
        <p class="task">Is each setup a trap or sound? Pick again if you change your mind.</p>
        ${CASES.map(([q, trap, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Trap", "Sound"], { picked: ans[i], correct: trap ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (trap ? 0 : 1) ? yes : no, ans[i] === (trap ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, t], j) => ans[j] === (t ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can read a feedback number</h1>
      <p class="lead">You found why ${UP_ALL}% thumbs up hid rising complaints: votes cast before cooking, and failures that never came back to vote. You designed a flow that asks after the outcome, a random sample, linked to the answer. You fixed an export that called the model's own words “human corrections”, and watched a model trained on its own thumbs push aside the swap that worked best.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The corrections you now collect honestly still need people to label them, and two people often label the same thing differently. That is where the next lesson starts.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "User feedback loops and their traps",
    checked: "2026-11-14",
    sources: [
      "https://developers.google.com/machine-learning/crash-course/fairness/types-of-bias",
      "https://developers.google.com/machine-learning/guides/rules-of-ml",
      "https://papers.nips.cc/paper_files/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html"
    ],
    interview: [
      {
        q: "Your assistant's thumbs-up rate has been steady at over 90% for months, but support tickets about wrong answers have doubled. What do you do?",
        good: [
          "Check when the vote is cast: if it is right after reading, voters cannot know whether the answer worked",
          "Check who votes: answer rate per user group; unhappy users often leave or go to support instead",
          "Join support tickets to the answer id and model version, and read a sample of the failures",
          "Add an outcome question after the result is known, asked of a random sample",
          "Stop reporting the raw ratio as quality; use it beside outcome data and a golden-set eval"
        ],
        weak: "Trust the 90% and blame support, or add more prompts asking for votes. More votes cast the same way carry the same bias."
      },
      {
        q: "The team wants to fine-tune every week on the suggestions users accepted. What could go wrong, and how would you make it safe?",
        good: [
          "Accepted suggestions are the model's own outputs; training on them reinforces what it already does, mistakes included",
          "Acceptance often happens before the outcome is known, and a pre-filled default looks like acceptance",
          "The model only gets feedback on what it chose to show, so better alternatives never get data",
          "Keep only real edits that differ from the model's text, keep a small random exploration share, and review a sample",
          "Evaluate each new model on a fixed golden set before it ships"
        ],
        weak: "More user data is always better, so train on all of it. That misses that the data is the model's own text, picked by a biased signal."
      }
    ],
    screens: [situation, byHand, spotIdea, predictSplits, design, brokenExport, selfLoop, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: DESIGN.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
