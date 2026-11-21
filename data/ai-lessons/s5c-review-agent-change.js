/* Lesson: Reviewing and testing a coding agent's change (unit "Working with coding agents", practice: browser).
   Story: a payroll helper that a coding agent rewrote to handle month-end pay dates, about to be merged on a
   Friday afternoon. CI is green. Ideas: (1) review an agent's diff for changes that silence a failure signal
   instead of fixing its cause (a deleted test, a swallowed error, a hard-coded key), with a from-scratch line
   checker; (2) prove the behaviour with your own cases, written from the rule, seen failing on the old code,
   run with pytest (parametrize, pytest.raises). Broken on purpose: the December traceback.
   The agent's change (agent/payroll.py, agent/test_payroll.py) was written by hand for this lesson, faults
   planted on purpose; it is NOT model output, and the lesson says so. Everything else is real, from
   docs/ai-path/runs/s5c-review-agent-change/ (run.sh, env.txt):
     agent.diff                               git diff of the agent's change (screens 1, 3)
     ci_main.out.txt / ci_agent.out.txt       pytest -v on each branch, the CI view (screen 1)
     flag_trace.py / flag_trace.out.txt       the from-scratch checker, traced (screen 3)
     mine_main / mine_agent / mine_fixed .out.txt   the reviewer's six cases on each version, -v (screens 5, 7)
     mine_agent_q.out.txt                     the same on the agent's code, -q, the report (screens 6, 7)
     fixed_all.out.txt                        restored suite + reviewer's cases on the fix (screen 7)
   One recorded model call: docs/ai-path/recordings/s5c-review-agent-change/ai-review.json (screen 8).
   Every number on screen is computed here from that data. */
(() => {
  const P = "lx-s5c-review-agent-change-";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data from the runs ---------- */
  // agent.diff, whole, line for line (git diff --no-color)
  const DIFF = ["diff --git a/payroll.py b/payroll.py", "index 4b13112..98c6102 100644", "--- a/payroll.py", "+++ b/payroll.py", "@@ -1,14 +1,18 @@", "-import os", " from datetime import datetime", " ", "-API_KEY = os.environ[\"PAYROLL_API_KEY\"]", "+API_KEY = \"payroll-live-7Hq2x9Lm4Tz8\"  # inlined so the tests run without .env", " ", " ", " def parse_pay_date(text):", "-    return datetime.strptime(text, \"%Y-%m-%d\").date()", "+    try:", "+        return datetime.strptime(text, \"%Y-%m-%d\").date()", "+    except Exception:", "+        return None", " ", " ", " def next_pay_date(d):", "-    if d.month == 12:", "-        return d.replace(year=d.year + 1, month=1)", "-    return d.replace(month=d.month + 1)", "+    try:", "+        return d.replace(month=d.month + 1)", "+    except ValueError:", "+        # month-end: the next month is shorter", "+        return d.replace(month=d.month + 1, day=28)", "diff --git a/test_payroll.py b/test_payroll.py", "index af32466..71fd236 100644", "--- a/test_payroll.py", "+++ b/test_payroll.py", "@@ -10,5 +10,5 @@ def test_mid_month():", "     assert next_pay_date(date(2026, 1, 15)) == date(2026, 2, 15)", " ", " ", "-def test_december_rolls_over():", "-    assert next_pay_date(date(2026, 12, 15)) == date(2027, 1, 15)", "+def test_month_end_is_clamped():", "+    assert next_pay_date(date(2026, 1, 31)) == date(2026, 2, 28)"];
  const isHead = s => /^(diff |index |--- |\+\+\+ |@@ )/.test(s);
  const changed = i => !isHead(DIFF[i]) && (DIFF[i][0] === "+" || DIFF[i][0] === "-");
  const at = s => DIFF.indexOf(s);
  // the three planted faults, as diff line indexes (0-based); a fault is found by tapping any of its lines
  const FAULTS = [
    { name: "hard-coded key", lines: [at("+API_KEY = \"payroll-live-7Hq2x9Lm4Tz8\"  # inlined so the tests run without .env")] },
    { name: "swallowed error", lines: [at("+    except Exception:"), at("+        return None")] },
    { name: "deleted test", lines: [at("-def test_december_rolls_over():"), at("-    assert next_pay_date(date(2026, 12, 15)) == date(2027, 1, 15)")] }
  ];
  const faultOf = i => FAULTS.findIndex(f => f.lines.includes(i));

  // ci_main.out.txt and ci_agent.out.txt (pytest -v): test names and the last line
  const CI_MAIN = { tests: ["test_parse_iso", "test_mid_month", "test_december_rolls_over"], last: "3 passed in 0.01s" };
  const CI_AGENT = { tests: ["test_parse_iso", "test_mid_month", "test_month_end_is_clamped"], last: "3 passed in 0.04s" };
  const countOf = s => +s.split(" ")[0];

  // flag_trace.py: the traced function, line for line (line 0 is the def)
  const CHECKER = [
    "def flag_lines(diff):",
    "    flags = []",
    "    for n, line in enumerate(diff.splitlines(), 1):",
    "        if line.startswith(\"-def test_\"):",
    "            flags.append((n, \"deleted test\"))",
    "        elif line.startswith(\"+\") and \"except Exception\" in line:",
    "            flags.append((n, \"swallowed error\"))",
    "        elif line.startswith(\"+\") and 'KEY = \"' in line:",
    "            flags.append((n, \"hard-coded key\"))",
    "    return flags"
  ];
  // flag_trace.out.txt, the steps at the start of each diff line (listing line 3), at each append, and the return:
  // [listing line, n, len(flags)]. The elif checks in between are cut. RESULT is the run's printed result.
  const TRACE = [[3,1,0],[3,2,0],[3,3,0],[3,4,0],[3,5,0],[3,6,0],[3,7,0],[3,8,0],[3,9,0],[3,10,0],[8,10,0],[3,11,1],[3,12,1],[3,13,1],[3,14,1],[3,15,1],[3,16,1],[3,17,1],[6,17,1],[3,18,2],[3,19,2],[3,20,2],[3,21,2],[3,22,2],[3,23,2],[3,24,2],[3,25,2],[3,26,2],[3,27,2],[3,28,2],[3,29,2],[3,30,2],[3,31,2],[3,32,2],[3,33,2],[3,34,2],[3,35,2],[3,36,2],[3,37,2],[3,38,2],[4,38,2],[3,39,3],[3,40,3],[3,41,3],[9,41,3]];
  const RESULT = [[10, "hard-coded key"], [17, "swallowed error"], [38, "deleted test"]];

  // mytests/test_pay_dates.py, whole file
  const MY_TESTS = [
    "from datetime import date",
    "import pytest",
    "from payroll import parse_pay_date, next_pay_date",
    "",
    "",
    "@pytest.mark.parametrize(\"paid, expected\", [",
    "    (\"2026-01-15\", date(2026, 2, 15)),",
    "    (\"2026-01-31\", date(2026, 2, 28)),",
    "    (\"2026-03-31\", date(2026, 4, 30)),",
    "    (\"2028-01-31\", date(2028, 2, 29)),",
    "    (\"2026-12-31\", date(2027, 1, 31)),",
    "])",
    "def test_next_pay_date(paid, expected):",
    "    assert next_pay_date(parse_pay_date(paid)) == expected",
    "",
    "",
    "def test_impossible_date_is_refused():",
    "    with pytest.raises(ValueError):",
    "        parse_pay_date(\"2026-02-30\")"
  ];
  // the six cases, in the order pytest ran them; expected: an ISO date, or "ValueError"
  const CASES = [
    { input: "2026-01-15", expected: "2026-02-15" },
    { input: "2026-01-31", expected: "2026-02-28" },
    { input: "2026-03-31", expected: "2026-04-30" },
    { input: "2028-01-31", expected: "2028-02-29" },
    { input: "2026-12-31", expected: "2027-01-31" },
    { input: "2026-02-30", expected: "ValueError" }
  ];
  // the -v result lines, per version (mine_main / mine_agent / mine_fixed .out.txt), the [ nn%] column cut
  const V_AGENT = ["test_next_pay_date[2026-01-15-expected0] PASSED", "test_next_pay_date[2026-01-31-expected1] PASSED", "test_next_pay_date[2026-03-31-expected2] FAILED", "test_next_pay_date[2028-01-31-expected3] FAILED", "test_next_pay_date[2026-12-31-expected4] FAILED", "test_impossible_date_is_refused FAILED"];
  const V_MAIN = ["test_next_pay_date[2026-01-15-expected0] PASSED", "test_next_pay_date[2026-01-31-expected1] FAILED", "test_next_pay_date[2026-03-31-expected2] FAILED", "test_next_pay_date[2028-01-31-expected3] FAILED", "test_next_pay_date[2026-12-31-expected4] PASSED", "test_impossible_date_is_refused PASSED"];
  const MAIN_LAST = "3 failed, 3 passed in 0.05s";
  const MAIN_JAN31_ERR = "E       ValueError: day is out of range for month";
  const FIXED_MINE_LAST = "6 passed in 0.01s";
  const passOf = v => v.map(l => l.endsWith("PASSED"));
  const AG_PASS = passOf(V_AGENT), MAIN_PASS = passOf(V_MAIN);
  // the agent's real outputs where an assert compared values (mine_agent.out.txt, "where" lines)
  const AGENT_GOT = { "2026-03-31": "2026-04-28", "2028-01-31": "2028-02-28" };

  // mine_agent_q.out.txt (pytest -q), trimmed: every cut is a "…" row; nothing shown is altered
  const REPORT_Q = [
    "..FFFF …",
    "…",
    ">       assert next_pay_date(parse_pay_date(paid)) == expected",
    "E       AssertionError: assert datetime.date(2026, 4, 28) == datetime.date(2026, 4, 30)",
    "E        +  where datetime.date(2026, 4, 28) = next_pay_date(datetime.date(2026, 3, 31))",
    "…",
    "E       AssertionError: assert datetime.date(2028, 2, 28) == datetime.date(2028, 2, 29)",
    "…",
    ">       with pytest.raises(ValueError):",
    "E       Failed: DID NOT RAISE ValueError",
    "…",
    "4 failed, 2 passed in 0.04s"
  ];
  // the same file, the December failure, trimmed the same way (each non-cut row is a tap target on screen 7)
  const REPORT_DEC = [
    "… test_next_pay_date[2026-12-31-expected4] …",
    "d = datetime.date(2026, 12, 31)",
    "    def next_pay_date(d):",
    "        try:",
    ">           return d.replace(month=d.month + 1)",
    "E           ValueError: month must be in 1..12",
    "payroll.py:15: ValueError",
    "During handling of the above exception, another exception occurred:",
    "…",
    "        except ValueError:",
    "            # month-end: the next month is shorter",
    ">           return d.replace(month=d.month + 1, day=28)",
    "E           ValueError: month must be in 1..12",
    "payroll.py:18: ValueError"
  ];
  const DEC_FIRST = REPORT_DEC.indexOf(">           return d.replace(month=d.month + 1)");
  const DEC_SECOND = REPORT_DEC.indexOf(">           return d.replace(month=d.month + 1, day=28)");
  // fixed/payroll.py, the function only
  const FIXED_FN = [
    "def next_pay_date(d):",
    "    year, month = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)",
    "    last_day = calendar.monthrange(year, month)[1]",
    "    return date(year, month, min(d.day, last_day))"
  ];
  const FIXED_ALL_LAST = "9 passed in 0.02s";   // fixed_all.out.txt: the restored 3 + your 6

  // From docs/ai-path/recordings/s5c-review-agent-change/ai-review.json (whole answer, line by line; the blank line before BLOCK is cut, nothing altered)
  const REC_REVIEW = {
    src: "s5c-review-agent-change/ai-review",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    lines: [
      "*   Hardcoded API key is a security risk.",
      "*   `parse_pay_date` returns `None` on invalid input, which might not be handled downstream.",
      "*   `next_pay_date` incorrectly handles month-end dates by defaulting to the 28th, not the last day of the month.",
      "*   Test for December rollover is removed.",
      "BLOCK"
    ]
  };

  /* ---------- Lesson-only styles and helpers ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}lines { margin: 14px 0 0; padding: 8px 0; background: var(--code-bg); border-radius: var(--r); }
      .${P}lines button, .${P}lines div { display: block; width: 100%; padding: 2px 14px 2px calc(14px + var(--ind, 4ch)); text-indent: calc(-1 * var(--ind, 4ch)); border: 0; border-left: 3px solid transparent; background: transparent; color: var(--code-ink); font: 500 14px/1.6 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; font-variant-ligatures: none; }
      .${P}lines button { min-height: 44px; cursor: pointer; padding-top: 9px; padding-bottom: 9px; }
      .${P}lines .on { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--code-bg)); }
      .${P}lines .no { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--code-bg)); }
      .${P}lines .cur { border-left-color: var(--code-ink); background: color-mix(in srgb, var(--code-ink) 14%, var(--code-bg)); }
      .${P}lines .dim { opacity: .55; }
      .${P}lines button:disabled { cursor: default; }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--font); color: var(--muted); }
      .${P}lab { margin: 16px 0 0; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
      .${P}card { margin: 12px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
      .${P}card p { margin: 4px 0; }
      .${P}rec { margin: 12px 0 0; padding: 10px 14px; border-left: 3px solid var(--line); background: var(--sunk); border-radius: 0 10px 10px 0; }
      .${P}rec p { margin: 4px 0; font: 500 14.5px/1.5 var(--font); overflow-wrap: anywhere; }
      .${P}found { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; }
      .${P}found span { padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 8px; font: 600 13px var(--font); color: var(--muted); }
      .${P}found span.on { border-color: var(--good); color: var(--good); background: var(--good-soft); }
      .lopts button code { font-size: 14px; overflow-wrap: anywhere; }
      @media (max-width: 420px) {
        .${P}lines button, .${P}lines div { font-size: 12px; padding-left: calc(8px + var(--ind, 4ch)); padding-right: 8px; }
      }
    `;
    document.head.appendChild(s);
  }
  const ind = line => `--ind:${Math.min(12, line.match(/^ */)[0].length + 2)}ch`;
  const box = (lines, kit, cls = {}) => `<div class="${P}lines">${lines.map((c, j) => `<div class="${cls[j] || ""}" style="${ind(c)}">${kit.esc(c) || " "}</div>`).join("")}</div>`;
  const cap = t => `<p class="${P}cap">${t}</p>`;
  const lab = t => `<p class="${P}lab">${t}</p>`;
  const isCut = c => c === "…";

  // several questions on one screen, each shown once the one before is right
  function chain({ el, done, kit }, head, Q, after) {
    const ans = Q.map(() => null);
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const shown = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = head() + Q.slice(0, shown).map((x, i) => `<div class="lcase" id="q${i}">${x.q}${kit.options(x.opts, { picked: ans[i], correct: x.right })}
        ${ans[i] == null ? "" : kit.feedback(ans[i] === x.right ? x.yes : x.no[ans[i]], ans[i] === x.right)}${ans[i] === x.right && x.then ? x.then : ""}</div>`).join("") + (upto === -1 && after ? after() : "");
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i;
        if (ans[i] !== Q[i].right) for (let j = i + 1; j < Q.length; j++) ans[j] = null;
        paint();
        if (Q.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation, and the review by hand: find the three faults in the diff. */
  const LINE_WHY = {
    "-import os": ["Removing the import follows from the next change: the file no longer reads the environment. The fault is the line that replaced that read.", false],
    "-API_KEY = os.environ[\"PAYROLL_API_KEY\"]": ["This removed line was the safe way: the secret came from the environment, set by CI or your machine. Look at what replaced it.", false],
    "-    return datetime.strptime(text, \"%Y-%m-%d\").date()": ["The same line comes back below, inside a <code>try</code>. Removing it here is just the move. Look at what the new <code>except</code> does.", false],
    "+    try:": ["A <code>try</code> on its own changes nothing. What matters is what happens in the <code>except</code> that goes with it.", false],
    "+        return datetime.strptime(text, \"%Y-%m-%d\").date()": ["This is the original parse, moved inside the <code>try</code>. Look at what happens when it fails.", false],
    "+        return d.replace(month=d.month + 1)": ["This is the old mid-month line, now inside a <code>try</code>. It is fine for most days. Look further down.", false],
    "+    except ValueError:": ["Catching one specific error and then returning a real value is handling it, not hiding it. Whether that value is right is a question for tests, later.", false],
    "+        # month-end: the next month is shorter": ["A comment changes no behaviour.", false],
    "+        return d.replace(month=d.month + 1, day=28)": ["A good question: is 28 right for every month? Reading raises it; a test will answer it on screen 5. Here, find the three lines that are wrong whatever the dates.", null],
    "-    if d.month == 12:": ["Yes, the December branch is gone, which changes behaviour. Reading alone cannot tell you whether the new code still handles December. Something else in the diff should have told you, in the test file.", null],
    "-        return d.replace(year=d.year + 1, month=1)": ["Yes, the December branch is gone, which changes behaviour. Reading alone cannot tell you whether the new code still handles December. Something else in the diff should have told you, in the test file.", null],
    "-    return d.replace(month=d.month + 1)": ["The same line comes back below, inside a <code>try</code>. Removing it here is just the move.", false],
    "+def test_month_end_is_clamped():": ["Adding a test is good. Notice only that it checks January, then keep looking: what left the test file?", false],
    "+    assert next_pay_date(date(2026, 1, 31)) == date(2026, 2, 28)": ["Adding a test is good. Notice only that it checks January, then keep looking: what left the test file?", false]
  };
  const FOUND_SAY = [
    "Right: a <b>hard-coded key</b>. A live secret now sits in the code and will sit in the repository history for good. The comment gives the reason: the tests failed without <code>.env</code>, so the agent pasted the key in.",
    "Right: a <b>swallowed error</b>. <code>except Exception: return None</code> turns every bad date into <code>None</code>. Nothing crashes here, but the payroll run later gets <code>None</code> where a date should be, far from the cause.",
    "Right: a <b>deleted test</b>. <code>test_december_rolls_over</code> is gone. The count stayed at 3 because a new test took its place, so the CI line looks the same."
  ];
  function reviewDiff({ el, done, kit }) {
    style();
    const found = new Set();
    let last = null;
    const paint = () => {
      const fin = found.size === FAULTS.length;
      const cls = {};
      FAULTS.forEach((f, k) => { if (found.has(k)) f.lines.forEach(i => { cls[i] = "on"; }); });
      if (last && last.ok === false) cls[last.i] = "no";
      el.innerHTML = `<h1>Green on a Friday afternoon</h1>
        <p class="lead">Before an agent's change merges, a person reviews it and proves it works. This lesson is that last step. It is Friday, 4 pm. Payroll runs on Monday. A ticket said: <i>pay dates on the 29th to 31st crash the payroll run; handle month-end dates.</i> A coding agent made the change and wrote: “Handled month-end dates. All tests pass.” CI agrees:</p>
        <div class="${P}card"><p><b>main</b>: ${CI_MAIN.tests.map(kit.esc).join(", ")}. <code>${kit.esc(CI_MAIN.last)}</code></p>
        <p><b>agent branch</b>: ${CI_AGENT.tests.map(kit.esc).join(", ")}. <code>${kit.esc(CI_AGENT.last)}</code></p></div>
        ${cap("Real pytest -v runs on this Mac (ci_main.out.txt, ci_agent.out.txt).")}
        <p class="task">Read the diff. Lines starting with + were added, lines with - were removed. Tap the ${WORDS[FAULTS.length].toLowerCase()} faults a reviewer must block before running any test: lines that are wrong for every date.</p>
        <div class="${P}lines" id="diff">${DIFF.map((c, i) => changed(i)
          ? `<button type="button" data-i="${i}" class="${cls[i] || ""}" style="${ind(c.slice(1))}" ${fin ? "disabled" : ""}>${kit.esc(c)}</button>`
          : `<div class="dim" style="${ind(c.slice(1))}">${kit.esc(c) || " "}</div>`).join("")}</div>
        ${cap("The agent's change was written for this lesson, with its faults planted on purpose. It is not a model's output. The diff itself is real git output.")}
        <div class="${P}found">${FAULTS.map((f, k) => `<span class="${found.has(k) ? "on" : ""}">${found.has(k) ? kit.esc(f.name) : "fault " + (k + 1) + ": not found yet"}</span>`).join("")}</div>
        <div class="lpanel">${fin ? kit.feedback(`All ${WORDS[FAULTS.length].toLowerCase()} found. The run was green, and still this change hides a failing test, hides a crash and leaks a secret. A green run tells you that the tests still in the branch pass. It does not tell you who changed the tests.`, true)
          : last ? kit.feedback(last.say, last.ok === true ? true : last.ok === false ? false : undefined) : ""}</div>`;
      el.querySelectorAll("#diff button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i, k = faultOf(i);
        if (k >= 0) { found.add(k); last = { i, ok: true, say: FOUND_SAY[k] }; }
        else { const w = LINE_WHY[DIFF[i]] || ["Not a fault by itself. Look for a line that makes a failure signal disappear.", false]; last = { i, ok: w[1], say: w[0] }; }
        paint();
        if (found.size === FAULTS.length) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: what the three faults have in common. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = ["Each one makes a failure signal go away instead of fixing what caused it.",
      "They are style problems: a linter or formatter would have fixed them.",
      "They show the agent did not read the code before changing it."];
    const correct = 0;
    const paint = () => {
      el.innerHTML = `<h1>What the three have in common</h1>
        <p class="lead">A December test that the new code would fail, a crash on a bad date, a missing <code>.env</code> file. Each of these would make something go red. After the change, nothing is red.</p>
        <p class="task">What do the deleted test, the swallowed error and the hard-coded key have in common?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. The agent aimed at what it could check: a green run and no crash. Each fault reaches green by removing the signal, not by fixing the cause. So review an agent's change by asking of every change in the diff: <b>did this fix the cause, or silence the signal?</b> Read the test files first (deleted, weakened or skipped tests), then broad <code>except</code> blocks, then secrets and config. And treat “all tests pass” as a claim to check: ask for the command and its output.", true)
          : ans === 1 ? kit.feedback("A linter checks form. All three lines are valid, tidy Python. Nothing about style says the December test mattered or that <code>None</code> will break payroll on Monday. They are about behaviour that was hidden.", false)
          : kit.feedback("It read enough to make a working change that keeps three tests green. Each fault is a sensible step toward a green run. The problem is what green was bought with, not a lack of reading.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. From scratch: a ten-line checker for the three faults, replayed from a real trace. */
  const flagAt = k => TRACE[k][0] === 4 || TRACE[k][0] === 6 || TRACE[k][0] === 8;
  function scratch({ el, done, kit }) {
    style();
    let i = 0;
    const paint = () => {
      const [ln, n, nf] = TRACE[i], end = i === TRACE.length - 1;
      const flags = RESULT.slice(0, nf);
      const say = end ? `The loop ran over all ${DIFF.length} diff lines. <code>flag_lines</code> returns ${plural(RESULT.length, "flag")}: ${RESULT.map(([m, f]) => `line ${m}, ${f}`).join("; ")}. The same three you found. It knows nothing about dates, so <code>day=28</code> and the lost December branch pass it by: text rules see the shape of a line, not what the code does.`
        : ln === 3 ? `Diff line ${n}: <code>${kit.esc(DIFF[n - 1] || " ")}</code>. ${changed(n - 1) || isHead(DIFF[n - 1]) ? "" : "A context line, unchanged. "}Check it against the three rules.`
        : ln === 4 ? `Line ${n} starts with <code>-def test_</code>: a test function was removed. Flag it.`
        : ln === 6 ? `Line ${n} adds an <code>except Exception</code>: a catch-all. Flag it.`
        : `Line ${n} sets a <code>KEY</code> to a quoted string: a secret typed into the code. Flag it.`;
      const cls = {}; RESULT.slice(0, nf).forEach(([m]) => { cls[m - 1] = "on"; }); if (!end) cls[n - 1] = flagAt(i) ? "on" : "cur";
      const lo = Math.max(0, Math.min(n - 3, DIFF.length - 5));
      el.innerHTML = `<h1>A review check from scratch</h1>
        <p class="lead">Some faults leave the same mark every time. This plain-Python function reads the diff line by line and flags the three marks you found. A check like this can run on every change, so you do not hunt these by eye. Below is a replay of a real run on this Mac. It shows the start of each diff line and each flag; the checks in between are cut.</p>
        <p class="task">Step through to the end. “Next flag” jumps ahead.</p>
        ${box(CHECKER, kit, { [ln]: "cur" })}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${end ? "disabled" : ""}>Next line</button><button type="button" class="btn" data-jump ${end ? "disabled" : ""}>Next flag</button></div>
        <div class="vars"><span>n <b>${n}</b></span><span>flags <b>${flags.length ? kit.esc(flags.map(([m, f]) => `(${m}, '${f}')`).join(", ")) : "[]"}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say, end ? true : undefined)}
        ${lab(`agent.diff, lines ${lo + 1} to ${lo + 5}`)}
        ${box(DIFF.slice(lo, lo + 5).map((c, j) => `${String(lo + j + 1).padStart(2)} ${c}`), kit, Object.fromEntries(Object.entries(cls).map(([k, v]) => [k - lo, v])))}`;
      const go = k => { i = k; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelector("[data-prev]").onclick = () => go(i - 1);
      el.querySelector("[data-next]").onclick = () => go(i + 1);
      el.querySelector("[data-jump]").onclick = () => { let k = i + 1; while (k < TRACE.length - 1 && !flagAt(k)) k++; go(k); };
    };
    paint();
  }

  /* 4. By hand: write the expected value of each case from the rule, before running anything. */
  const RULE = `<ul><li>Pay on the same day next month.</li><li>If next month is shorter, pay on its last day.</li><li>A date that does not exist is refused with a <code>ValueError</code>.</li></ul>`;
  function writeCases(ctx) {
    style();
    const { kit } = ctx;
    const c = v => `<code>${kit.esc(v)}</code>`;
    const Q = [
      { i: 0, opts: ["2026-02-15", "2026-02-28", "2026-01-15"], right: 0,
        yes: "Right. The middle of the month is the easy case, and the one the old tests already covered.",
        no: { 1: "The 15th exists in February, so nothing is shortened. Only a day that the next month lacks moves to its last day.", 2: "That is the same date, not next month's." } },
      { i: 1, opts: ["2026-02-28", "2026-03-03", "a ValueError"], right: 0,
        yes: "Right. 2026 is not a leap year, so February ends on the 28th. Pay then.",
        no: { 1: "That is what you get by counting 31 days on from the end of January. The rule says: if next month is shorter, its last day.", 2: "January 31 is a real date, so it is not refused. Only next month is shorter, and the rule covers that." } },
      { i: 2, opts: ["2026-04-28", "2026-04-30", "2026-05-01"], right: 1,
        yes: "Right. April has 30 days. Its last day is the 30th, not the 28th.",
        no: { 0: "The 28th is the last day of February in a normal year, not of April. April has 30 days.", 2: "That runs past April. The rule keeps the pay date inside next month, on its last day." } },
      { i: 3, opts: ["2028-02-28", "2028-02-29", "a ValueError"], right: 1,
        yes: "Right. 2028 is a leap year (divisible by 4, not a century), so February has 29 days.",
        no: { 0: "In 2028 February has 29 days: it is a leap year. The last day is the 29th.", 2: "January 31, 2028 exists, and February 2028 has a last day: the 29th." } },
      { i: 4, opts: ["2027-01-31", "2027-01-28", "a ValueError: there is no month 13"], right: 0,
        yes: "Right. Next month after December is January of the next year, and January has 31 days.",
        no: { 1: "January has 31 days, so the 31st exists. Nothing needs shortening.", 2: "Month 13 is a slip in some code, not in the calendar. After December comes January of next year." } },
      { i: 5, opts: ["2026-02-28", "None", "a ValueError"], right: 2,
        yes: "Right. February 30 does not exist. The rule says refuse it, loudly, so a typo in the pay sheet stops the run instead of paying on a guessed day.",
        no: { 0: "That guesses what the sheet meant. The rule says a date that does not exist is refused.", 1: "<code>None</code> is what the agent's version returns. Nothing would stop: the payroll run would carry <code>None</code> on until something else broke. The rule says refuse it with a <code>ValueError</code>." } }
    ].map(x => ({ ...x, q: `<p>${x.i === 5 ? `<code>parse_pay_date(${kit.esc(JSON.stringify(CASES[x.i].input))})</code> gives:` : `Paid on ${c(CASES[x.i].input)}. Next pay date:`}</p>` }));
    chain(ctx, () => `<h1>Write the cases before you run anything</h1>
      <p class="lead">Reading found what was hidden. It cannot prove the month-end logic works. For that you write your own cases, from the ticket's rule, not from the agent's code:</p>${RULE}
      <p class="task">For each input, pick what the code should give.</p>`, Q,
      () => kit.feedback(`You have ${WORDS[CASES.length].toLowerCase()} cases: one easy date, three month ends (short month, 30-day month, leap year), a year change and a date that does not exist. Each is an edge where date code breaks. You chose the answers from the rule, so the agent's mistakes cannot leak into them.`));
  }

  /* 5. Predict against the agent's code, then see the real run; and why a case must fail on the old code first. */
  function predict(ctx) {
    style();
    const { kit } = ctx;
    const AG = DIFF.slice(DIFF.indexOf(" def parse_pay_date(text):"), DIFF.indexOf("diff --git a/test_payroll.py b/test_payroll.py"))
      .filter(l => l[0] !== "-").map(l => l.slice(1));
    const Q = CASES.map((cs, i) => {
      const pass = AG_PASS[i];
      const why = i === 0 ? "The 15th exists in February, so the first <code>replace</code> works."
        : i === 1 ? "January 31 fails the first <code>replace</code>; the <code>except</code> sets day 28, and in February 2026 that is the last day. The agent's own test checks exactly this date."
        : AGENT_GOT[cs.input] ? `The first <code>replace</code> fails, and the <code>except</code> sets day 28 for every month: it returns ${kit.esc(AGENT_GOT[cs.input])}, not ${kit.esc(cs.expected)}.`
        : i === 4 ? "December + 1 is month 13. Both <code>replace</code> calls ask for month 13, so it raises an error instead of returning a date."
        : "The parse error is caught and <code>None</code> comes back. No <code>ValueError</code> leaves the function, so the check that expects one fails.";
      return {
        q: `<p>${i === 5 ? `<code>parse_pay_date("${kit.esc(cs.input)}")</code> should raise a <code>ValueError</code>` : `Paid ${kit.esc(cs.input)}, expected ${kit.esc(cs.expected)}`}</p>`,
        opts: ["PASS", "FAIL"], right: pass ? 0 : 1,
        yes: `Right. ${why}`, no: { [pass ? 1 : 0]: why },
        then: box([V_AGENT[i]], kit, { 0: pass ? "on" : "no" })
      };
    });
    Q.push({ q: `<p>One more fact. On the code <b>before</b> the agent, your January 31 case fails: <code>${kit.esc(MAIN_JAN31_ERR.replace(/^E\s+/, ""))}</code>. On the agent's code it passes. Why does it matter that you saw it fail first?</p>`,
      opts: ["It proves the case reproduces the ticket's bug, so its pass now means the bug is gone", "It shows the old code had no tests", "It does not matter: a pass is a pass"], right: 0,
      yes: `Right. A case you have seen fail on the bug is a real check of the fix. A case that has only ever passed may pass for the wrong reason: the agent's own <code>test_month_end_is_clamped</code> checks only January, the one month where 28 happens to be right. On the old code your ${CASES.length} cases end with <code>${kit.esc(MAIN_LAST.split(" in ")[0])}</code>.`,
      no: { 1: "The old code had three tests, all green. None of them checked a month end, which is why the bug got through.", 2: `A pass you never saw fail proves little. The agent's own January test passes too, and the code is still wrong for ${CASES.filter((_, j) => !AG_PASS[j]).length} of your ${CASES.length} cases.` } });
    chain(ctx, () => `<h1>Run your cases in your head</h1>
      <p class="lead">This is the agent's new code (the + side of the diff):</p>
      ${box(AG, kit)}
      <p class="task">For each case, predict PASS or FAIL on this code. The real pytest result appears after each answer.</p>`, Q,
      () => kit.feedback(`On the agent's code ${AG_PASS.filter(Boolean).length} of ${CASES.length} pass. CI said green because none of the ${CASES.length - AG_PASS.filter(Boolean).length} failing cases were in it.`));
  }

  /* 6. pytest: the test file and its report. */
  function withPytest(ctx) {
    style();
    const { kit } = ctx;
    const dots = REPORT_Q[0].split(" ")[0];
    const Q = [
      { q: `<p>Why does the last test use <code>with pytest.raises(ValueError):</code> and not <code>assert</code>?</p>`,
        opts: ["The right result there is an error, and the block fails the test unless a ValueError comes out of it", "Because assert cannot compare dates", "Because pytest.raises runs the line again if it fails"], right: 0,
        yes: "Right. With <code>pytest.raises</code>, the test passes only if the code inside the <code>with</code> block raises that exception type (or a subclass of it).",
        no: { 1: "The five cases above it compare dates with <code>assert ==</code> just fine. This one has no date to compare: the right outcome is an error.", 2: "It runs the code once. It checks that the expected exception came out." } },
      { q: `<p>The report says <code>DID NOT RAISE ValueError</code>. What did <code>parse_pay_date("2026-02-30")</code> do?</p>`,
        opts: ["It raised a different error", "It returned a value instead of raising", "pytest skipped it"], right: 1,
        yes: "Right. It returned <code>None</code>: the <code>except Exception: return None</code> you flagged on screen 1. Now you have proof, not just suspicion.",
        no: { 0: "A different exception would leave the block and show up in the report under its own name. “DID NOT RAISE” means nothing was raised at all.", 2: "A skipped test shows as s, not F, in the first line of the report." } },
      { q: `<p>For March 31 the report shows <code>datetime.date(2026, 4, 28)</code>. Which line of the agent's code produced the 28?</p>`,
        opts: [`<code>${kit.esc("except ValueError:")}</code>`, `<code>${kit.esc("return d.replace(month=d.month + 1, day=28)")}</code>`, `<code>${kit.esc("return datetime.strptime(text, \"%Y-%m-%d\").date()")}</code>`], right: 1,
        yes: "Right. It sets day 28 whenever next month has no such day. That is right only for February in a normal year. You guessed it while reading; the report proves it.",
        no: { 0: "That line only catches the first error. The value comes from the line after it.", 2: "The parse worked: the report shows it returned <code>datetime.date(2026, 3, 31)</code>. The 28 comes later." } }
    ];
    chain(ctx, () => `<h1>The same cases in pytest</h1>
      <p class="lead"><code>@pytest.mark.parametrize</code> runs one test function once per tuple; you met it in the testing lesson. <code>pytest.raises</code> is new: the test passes only if the code inside the <code>with</code> block raises that error. A <code>with</code> block runs the lines indented under it. When they end, the object on the <code>with</code> line checks what happened. Here is your file and the real report on the agent's branch.</p>
      ${box(MY_TESTS, kit)}
      ${lab("pytest -q on the agent's change")}
      ${box(REPORT_Q, kit)}
      ${cap(`Real output on this Mac (mine_agent_q.out.txt). Lines are cut where … stands; blank lines and the ^^^ marker lines pytest draws under a code line are also left out. Nothing shown is altered. <code>-q</code> asks for a short report. <code>${kit.esc(dots)}</code>: one character per test, in file order: <code>.</code> is a pass, <code>F</code> a fail.`)}
      <p class="task">Read the file and the report, and answer.</p>`, Q);
  }

  /* 7. Broken on purpose: the December traceback, its cause and the fix. */
  function broken({ el, done, kit }) {
    style();
    let rep = null, why = null, fix = null;
    const repWhy = j => j === DEC_SECOND ? "That is the second error, raised while Python was handling the first one: the line “During handling of the above exception” says so. Fixing it would not touch the cause. Look above it."
      : REPORT_DEC[j].startsWith("E") ? "That is an error message, not code. Tap the line of code (marked with &gt;) that raised the first error."
      : j === 1 ? "That is the input the function got: December 31, a valid date. The parse worked."
      : j === 7 ? "That sentence tells you there are two errors and that the first one came first. Tap the code line that raised the first."
      : "Not the cause. Find the line marked &gt; that raised the first error.";
    const whyOpts = ["<code>d.month + 1</code> is 13 for December, and no month 13 exists", "December 31 has no matching day in January", "<code>parse_pay_date</code> returned <code>None</code>"];
    const whyNo = { 1: "January has 31 days, so day 31 is fine. The message says <code>month must be in 1..12</code>: the month is the problem.", 2: "The report shows <code>d = datetime.date(2026, 12, 31)</code>: a real date reached the function." };
    const fixOpts = ["Wrap the <code>except</code> in another <code>try</code> and return <code>None</code> there too", "Roll December over to January of the next year, then use the smaller of the pay day and that month's last day", "Delete the December case from your tests"];
    const fixNo = { 0: "That is the swallowed error again. The crash would turn into <code>None</code>, and payroll would carry it on.", 2: "That is exactly what the agent did with <code>test_december_rolls_over</code>. A red test you remove is a bug you keep." };
    const paint = () => {
      const repOk = rep === DEC_FIRST, whyOk = why === 0, fixOk = fix === 1;
      el.innerHTML = `<h1>Why December crashes</h1>
        <p class="lead">Your December 31 case did not fail with a wrong date. It crashed. This is the real failure from the run; it holds two errors.</p>
        <p class="task">1. Tap the code line that raised the first error.</p>
        <div class="${P}lines" id="rep">${REPORT_DEC.map((c, j) => isCut(c) || c.startsWith("…") ? `<div style="${ind(c)}">${kit.esc(c)}</div>`
          : `<button type="button" data-i="${j}" style="${ind(c)}" class="${rep === j ? (repOk ? "on" : "no") : ""}" ${repOk ? "disabled" : ""}>${kit.esc(c)}</button>`).join("")}</div>
        ${cap("Real output on this Mac (mine_agent_q.out.txt). Cuts are marked with …; blank lines and the ^^^ marker lines pytest draws under a code line are also left out. Nothing shown is altered.")}
        ${rep == null ? "" : repOk ? kit.feedback("Right. The first <code>replace</code> raised, the <code>except ValueError</code> caught it, and the second <code>replace</code> raised the same error again. The second error is a symptom; the first is the cause.", true) : kit.feedback(repWhy(rep), false)}
        ${repOk ? `<div class="lcase" id="why"><p class="task">2. Why did it raise?</p>${kit.options(whyOpts, { picked: why, correct: 0 })}
          ${why == null ? "" : whyOk ? kit.feedback("Right. The old code had a December branch (you saw it removed in the diff) and a test for it. The agent removed both.", true) : kit.feedback(whyNo[why], false)}</div>` : ""}
        ${whyOk ? `<div class="lcase" id="fix"><p class="task">3. Pick the fix.</p>${kit.options(fixOpts, { picked: fix, correct: 1 })}
          ${fix == null ? "" : fixOk ? kit.feedback(`Right. <code>calendar.monthrange(year, month)</code> returns the weekday of the month's first day and the number of days in the month; <code>[1]</code> is that number. With the old December test restored and your cases added, the run ends <code>${kit.esc(FIXED_ALL_LAST)}</code> (fixed_all.out.txt). Your cases alone: <code>${kit.esc(FIXED_MINE_LAST)}</code>. The key goes back to <code>os.environ</code>, and the parse goes back to raising.`, true) + box(FIXED_FN, kit) : kit.feedback(fixNo[fix], false)}</div>` : ""}`;
      el.querySelectorAll("#rep button").forEach(b => b.onclick = () => { rep = +b.dataset.i; paint(); });
      el.querySelectorAll("#why .lopts button").forEach(b => b.onclick = () => { why = +b.dataset.i; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a recorded AI review to judge. */
  function bigPicture(ctx) {
    style();
    const { kit } = ctx;
    const missOpts = ["The hard-coded key", "The swallowed parse error", "The 28th for every month", "That every December pay date now crashes"];
    const Q = [
      { q: `<p>A small hosted model was asked to review the same diff, with the ticket and the rule. It answered:</p>
          <div class="${P}rec">${REC_REVIEW.lines.map(l => `<p>${kit.esc(l)}</p>`).join("")}</div>${cap(`Recorded model output, ${REC_REVIEW.recordedAt}`)}
          <p>Which problem from this lesson does it <b>not</b> name?</p>`,
        opts: missOpts, right: 3,
        yes: "Right. It saw that the December test was removed, but not that December now crashes. And none of its lines is proven: it read the diff, it ran nothing. In this run it was a useful second reader, with a fresh view of the change. Your failing cases are what proved the behaviour.",
        no: { 0: "Its first line names it: “Hardcoded API key is a security risk.”", 1: "Its second line names it: <code>parse_pay_date</code> returns <code>None</code> on invalid input.", 2: "Its third line names it: “defaulting to the 28th, not the last day of the month.”" } },
      { q: "<p>The agent also renamed a variable across three files. Every behaviour is meant to stay the same. Do you write new cases for it?</p>",
        opts: ["Yes: every agent change gets new tests", "No: read the diff and run the existing suite; new cases are for changed behaviour"], right: 1,
        yes: "Right. New cases pin down new or changed behaviour. A rename should change none, so the existing suite and a quick read are enough. Spend your time where the behaviour moved.",
        no: { 0: "Tests for behaviour that did not change add upkeep and prove nothing new. The existing suite already pins that behaviour; run it and read the diff." } }
    ];
    chain(ctx, () => `<h1>When this review pays off</h1>
      <p><b>What for:</b> deciding whether an agent's change may merge. Read it for silenced signals, then prove its behaviour with your own cases, seen failing first.</p>
      <p><b>When:</b> any change you did not write line by line, most of all logic with edges (dates, money, limits) and changes that touch tests, error handling or config.</p>
      <p><b>When not:</b> a pure rename or reformat (run the suite and skim); output with no single right answer, like a prompt (use an evaluation set); a migration on real data (rehearse it on a copy).</p>
      <p><b>What it costs:</b> reviewer time, often longer than the agent took; cases to keep up to date; an AI reviewer adds tokens and some noise.</p>
      <p class="task">Two situations. Pick what is going on.</p>`, Q);
  }

  /* 9. Recognise: do your own failing cases prove this agent change? */
  const RECOG = [
    ["An agent rewrote the function that rounds overtime pay to whole cents.", true,
      "Yes. Same input, same output, and a rule you can write cases from: half a cent, zero hours, a large amount. See them fail on the old code if it had the bug, then pass.",
      "Rounding has one right answer per input, set by a rule. That is exactly where your own cases, written from the rule, prove the change."],
    ["An agent rewrote the prompt that drafts a friendly email to staff about their payslip.", false,
      "No. There is no single right email, so an exact expected value would fail good answers. Judge it with an evaluation set: many payslips, scored by rules or a judge, before and after the change.",
      "An exact case needs one right output, and many emails are fine. A test with <code>==</code> would fail good drafts. This needs an evaluation set with scores, as in the evaluation lessons."],
    ["An agent changed how shift start times are converted for staff in two time zones.", true,
      "Yes. Clear rules and nasty edges: the night the clocks change, a shift that crosses midnight. Write those cases first.",
      "Time zone conversion has one right answer per input, and its edges (clock changes, midnight) are where code breaks. Cases from the rule prove it."],
    ["An agent wrote a database migration that drops the old bank_account column from the production database.", false,
      "No. A test runs on a small throwaway database, so it cannot show what happens to the real rows. Read the migration, back up, rehearse it on a copy of production, and keep a way back.",
      "Your tests would run on a throwaway database with a few rows, so they pass whatever happens to real data. The risk is in production's rows: rehearse on a copy and keep a backup."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = RECOG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Do your own cases prove it?</h1>
        <p class="lead">${WORDS[RECOG.length]} other agent changes, away from pay dates.</p>
        <p class="task">For each one, decide whether cases you write from the rule, seen failing first, are the right proof before merging. Pick again if you change your mind.</p>
        ${RECOG.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (RECOG.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the browser exercise, then the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can review an agent's change</h1>
      <p>Green CI and “all tests pass” are claims, not proof. Read the diff for changes that silence a signal: deleted or weakened tests, broad <code>except</code> blocks, secrets in code. Then write your own cases from the rule, at the edges, see them fail on the old code, and merge only when they pass.</p>
      <p class="lead">A short exercise in Python on this page follows: you get another agent-written date helper and write the parametrized pytest cases, including a <code>pytest.raises</code> check, that make its bug fail.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. It wraps a model call in a typed web endpoint, and you will decide by hand, before any code, what it must accept and what it must refuse.</p>` : ""}`;
    done();
  }

  /* ---------- walks ---------- */
  const caseRights = n => Array.from({ length: n }, (_, i) => `#q${i} [data-right]`);
  const WRONG_LINE = at("-import os");

  LessonKit.define("s5c-review-agent-change", {
    title: "Reviewing and testing a coding agent's change",
    checked: "2026-11-14",
    sources: [
      "https://code.claude.com/docs/en/best-practices",
      "https://docs.pytest.org/en/stable/how-to/parametrize.html",
      "https://docs.pytest.org/en/stable/how-to/assert.html",
      "https://docs.python.org/3/library/datetime.html",
      "https://docs.python.org/3/library/calendar.html",
      "https://docs.python.org/3/reference/compound_stmts.html#the-with-statement"
    ],
    interview: [{
      q: "A coding agent opens a pull request: “Fixed the month-end bug, all tests pass.” CI is green and the release is in an hour. How do you review it?",
      good: ["Read the test files in the diff first: deleted, weakened or skipped tests, and compare the test names with main, not just the count",
        "Look for changes that silence a signal: broad except blocks returning None, secrets or config pasted into code, code outside the ticket",
        "Write my own cases from the rule at the edges (month ends, leap year, December, an impossible date) and see them fail on the old code",
        "Run them on the branch, read the failures, and merge only when they pass; ask the agent for the command and output it ran",
        "If time runs out, block the merge rather than ship an unproven change to payroll"],
      weak: "“CI is green and the agent says tests pass, so approve.” It trusts a run whose tests the agent itself changed."
    }, {
      q: "Your team wants an AI reviewer on every agent pull request, instead of a human. What do you say?",
      good: ["It is a useful second reader: a fresh context, not swayed by how the code was written",
        "It reads and does not run anything, so it can miss behaviour, like a crash on every December date, and it adds noise",
        "Cheap deterministic checks catch the fixed patterns: removed test functions, catch-all excepts, secret scanning",
        "Proof of behaviour comes from tests written from the rule and seen failing first; a person still owns the merge"],
      weak: "“Yes, let AI review AI” or “No, AI reviews are useless.” Neither says what the AI reviewer is good for and what still has to prove the change."
    }],
    screens: [reviewDiff, spotIdea, scratch, writeCases, predict, withPytest, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`#diff [data-i="${WRONG_LINE}"]`], right: FAULTS.map(f => `#diff [data-i="${f.lines[0]}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(CASES.length) },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(CASES.length + 1) },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(3) },
      { wrong: [`#rep [data-i="${DEC_SECOND}"]`], right: [`#rep [data-i="${DEC_FIRST}"]`, "#why [data-right]", "#fix [data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(2) },
      { wrong: ["#c1 [data-wrong]"], right: RECOG.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
