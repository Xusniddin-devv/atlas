/* Lesson: inside a coding agent, the harness around the model. Story: fixing a broken "Added this week" filter in a
   small open-source-style recipe site (made up for the lesson) that the developer has never opened.
   Ideas: (1) the model only writes text or tool calls; the harness is the program around it that offers the tools,
   runs them, checks permission first, keeps the context small enough and can hand side work to a subagent;
   (2) what each part buys and costs, and where it does not help (when not to hand a task to a coding agent).
   Data, all real:
   - docs/ai-path/runs/s5c-agent-harness/harness.py: a 200-line harness written for this lesson (tools, permission
     check, clearing of old tool results, step limit) around a small hosted model; recipe_site/ is the project it
     worked on (the committed copy keeps the bug; each run worked on a copy).
   - recordings (main checkout) docs/ai-path/recordings/s5c-agent-harness/: win-1..9 (the main session, window
     2,000 tokens), cal-1..9 (the same task with no clearing, used for the token comparison), commit-1..14 (the same
     task plus one sentence asking for a git commit: the model guessed and hit the step limit), deny-1..2 (asked
     only to commit: every git command denied). run-1..14 (an earlier try of the commit task with the 2,000-token
     window) is not used on any screen. Printed in harness_*.out.txt; the pieces this file copies are
     printed by export_lesson_data.py into export_lesson_data.out.txt.
   - docs/ai-path/runs/s5c-agent-harness/search_added.py + .out.txt: the size of one broad search, no model.
   Claude Code itself was not run for this lesson: screen 9 is written from its official documentation.
   Lesson-local style: a transcript block and pick buttons (.lx-s5c-agent-harness-*), see ensureStyle(). */
(() => {
  const ID = "s5c-agent-harness";
  const fmt = n => n.toLocaleString("en-US");
  const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? "" : /(s|sh|ch|x)$/.test(w) ? "es" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* ---------- Data copied from the runs and recordings ---------- */
  // harness.py constants
  const H = { limit: 2000, compactAt: 0.8, keep: 2, maxSteps: 14, maxResult: 3500 };
  const TASK = "On the recipe list, the 'Added this week' filter is wrong. Yesterday's lentil soup (added 2026-11-10) is missing, and a blueberry pancake recipe from July shows up. Please find the bug and fix it.";
  const COMMIT_SENTENCE = "When the tests pass, commit the change with git."; // added to TASK for commit-1..14
  const TOOLS = [
    ["search_code", "pattern", "Search all project files for a text pattern. Returns matching lines."],
    ["read_file", "path", "Read one project file, with line numbers."],
    ["edit_file", "path, old_text, new_text", "Replace one exact piece of text in a file."],
    ["run_command", "command", "Run a shell command in the project folder."],
    ["ask_user", "question", "Ask the developer a question."]
  ];

  // From docs/ai-path/recordings/s5c-agent-harness/win-1..9.json (calls, token counts and text not altered;
  // results are what harness.py returned, as sent in the next request)
  const REC_WIN = {
    src: "s5c-agent-harness/win-1 … win-9",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    turns: [
      { p: 442, o: 76, call: ["search_code", "{\"pattern\":\"filter recipes by date\"}"], result: "no matches" },
      { p: 534, o: 49, call: ["search_code", "{\"pattern\":\"recipe list\"}"], result: "README.md:3: A small recipe list with filters (added this week, tag, cooking time). Made up for the lesson\nrecipes/filters.py:1: \"\"\"Filters behind the recipe list's drop-downs.\"\"\"\nrecipes/views.py:1: \"\"\"The recipe list page: reads the query parameters and applies the filters.\"\"\"" },
      { p: 678, o: 87, call: ["read_file", "{\"path\":\"recipes/filters.py\"}"], result: "  1  \"\"\"Filters behind the recipe list's drop-downs.\"\"\"\n  2  from datetime import timedelta\n  3  \n  4  from recipes.dates import parse_added\n  5  \n  6  \n  7  def added_this_week(recipes, today):\n  8      \"\"\"Recipes added in the last 7 days, today included.\"\"\"\n  9      cutoff = today - timedelta(days=7)\n 10      return [r for r in recipes if cutoff <= parse_added(r[\"added\"]) <= today]\n 11  \n 12  \n 13  def with_tag(recipes, tag):\n 14      return [r for r in recipes if tag in r[\"tags\"]]\n 15  \n 16  \n 17  def quicker_than(recipes, minutes):\n 18      return [r for r in recipes if r[\"minutes\"] < minutes]" },
      { p: 1007, o: 119, call: ["read_file", "{\"path\":\"recipes/views.py\"}"], result: "  1  \"\"\"The recipe list page: reads the query parameters and applies the filters.\"\"\"\n  2  from recipes.data import RECIPES\n  3  from recipes.filters import added_this_week, quicker_than, with_tag\n  4  \n  5  \n  6  def recipe_list(params, today):\n  7      items = RECIPES\n  8      if params.get(\"added\") == \"week\":\n  9          items = added_this_week(items, today)\n 10      if \"tag\" in params:\n 11          items = with_tag(items, params[\"tag\"])\n 12      if \"max_minutes\" in params:\n 13          items = quicker_than(items, int(params[\"max_minutes\"]))\n 14      return [r[\"title\"] for r in items]" },
      { p: 1349, o: 112, call: ["search_code", "{\"pattern\":\"parse_added\"}"], result: "recipes/dates.py:7: def parse_added(text):\nrecipes/filters.py:4: from recipes.dates import parse_added\nrecipes/filters.py:10:     return [r for r in recipes if cutoff <= parse_added(r[\"added\"]) <= today]",
        say: "The problem is likely within the `recipes/dates.py` module, specifically in the `parse_added` function, which is used by `added_this_week`." },
      { p: 1542, o: 55, call: ["read_file", "{\"path\":\"recipes/dates.py\"}"], result: "  1  \"\"\"Date helpers for recipe metadata.\"\"\"\n  2  from datetime import datetime\n  3  \n  4  ADDED_FORMAT = \"%Y-%d-%m\"\n  5  \n  6  \n  7  def parse_added(text):\n  8      \"\"\"Turn the 'added' field of a recipe, such as '2026-11-10', into a date.\"\"\"\n  9      return datetime.strptime(text, ADDED_FORMAT).date()\n 10  \n 11  \n 12  def days_ago(day, today):\n 13      \"\"\"Whole days from `day` to `today`.\"\"\"\n 14      return (today - day).days" },
      { p: 1790, o: 164, call: ["edit_file", "{\"new_text\":\"ADDED_FORMAT = \\\"%Y-%m-%d\\\"\",\"old_text\":\"ADDED_FORMAT = \\\"%Y-%d-%m\\\"\",\"path\":\"recipes/dates.py\"}"], result: "edited recipes/dates.py",
        say: "The day and month are swapped. It should be `\"%Y-%m-%d\"`." },
      { p: 1466, o: 65, call: ["run_command", "{\"command\":\"python -m unittest\"}"], result: "..\n----------------------------------------------------------------------\nRan 2 tests in 0.002s\n\nOK\n(exit code 0)" },
      { p: 1579, o: 74, call: null,
        text: "The tests passed after I corrected the date format string in `recipes/dates.py`. The bug was that the `ADDED_FORMAT` in `recipes/dates.py` was incorrect (`\"%Y-%d-%m\"` instead of `\"%Y-%m-%d\"`), causing dates to be parsed incorrectly. I changed the format string to the correct one." }
    ]
  };
  // From cal-1..9.json: the same task and the same first seven calls, with no clearing (prompt tokens per request)
  const CAL_PROMPTS = [442, 534, 678, 1007, 1349, 1542, 1790, 1973, 2073];
  // harness_win.out.txt: "COMPACT: context 1954 > 1600; cleared 5 old tool results" after model call 7
  const CLEARED_NOTE = "[cleared by the harness to save context; run the tool again if needed]";

  // From deny-1..2.json (task: DENY_TASK in harness.py, run on the project with the fix already made)
  const REC_DENY = {
    src: "s5c-agent-harness/deny-1 … deny-2",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    task: "I fixed the date format in recipes/dates.py and the tests pass now. Please commit that change with git, with a short message.",
    calls: [["run_command", "{\"command\":\"git config --global user.email \\\"you@example.com\\\"\"}"], ["run_command", "{\"command\":\"git config --global user.name \\\"Your Name\\\"\"}"], ["run_command", "{\"command\":\"git add .\"}"], ["run_command", "{\"command\":\"git commit -m \\\"Fix date format in recipes/dates.py\\\"\"}"]],
    result: "Permission denied by the harness (not on the allow list): run_command was not run.",
    final: "I am sorry, I cannot commit the changes because I am not allowed to run git commands."
  };

  // From commit-1..14.json: [tool, arguments, end of the tool result] for every call (export_lesson_data.out.txt)
  const REC_COMMIT = {
    src: "s5c-agent-harness/commit-1 … commit-14",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    modelCalls: 14,
    rows: [
      ["search_code", "{\"pattern\":\"def get_recipes\"}", "no matches"],
      ["search_code", "{\"pattern\":\"recipe_list\"}", "recipes/views.py:6: def recipe_list(para"],
      ["read_file", "{\"path\":\"recipes/views.py\"}", null],
      ["search_code", "{\"pattern\":\"added_this_week\"}", "recipes/filters.py:7: def added_this_wee"],
      ["read_file", "{\"path\":\"recipes/filters.py\"}", null],
      ["run_command", "{\"command\":\"python -m unittest\"}", "(exit code 1)"],
      ["read_file", "{\"path\":\"tests/test_filters.py\"}", null],
      ["edit_file", "{\"old_text\":\"cutoff = today - timedelta(days=7)\",\"path\":\"recipes/filters.py\",\"new_text\":\"cutoff = today - timedelta(days=8)\"}", "edited recipes/filters.py"],
      ["run_command", "{\"command\":\"python -m unittest\"}", "(exit code 1)"],
      ["edit_file", "{\"new_text\":\"cutoff = today - timedelta(days=6)\",\"path\":\"recipes/filters.py\",\"old_text\":\"cutoff = today - timedelta(days=8)\"}", "edited recipes/filters.py"],
      ["run_command", "{\"command\":\"python -m unittest\"}", "(exit code 1)"],
      ["edit_file", "{\"new_text\":\"cutoff = today - timedelta(days=7)\",\"path\":\"recipes/filters.py\",\"old_text\":\"cutoff = today - timedelta(days=6)\"}", "edited recipes/filters.py"],
      ["run_command", "{\"command\":\"python -m unittest\"}", "(exit code 1)"],
      ["edit_file", "{\"new_text\":\"cutoff = today - timedelta(days=7)\",\"old_text\":\"cutoff = today - timedelta(days=7)\",\"path\":\"recipes/filters.py\"}", "edited recipes/filters.py"]
    ]
  };
  // From search_added.out.txt: what search_code returns for the broad pattern "added" (no model involved)
  const SEARCH_ADDED = { pattern: "added", lines: 72, chars: 12308, fromData: 57 };
  const CAPTION = `Recorded model output, ${REC_WIN.recordedAt}`;

  /* ---------- Derived from the data ---------- */
  const T = REC_WIN.turns;
  const CALLS = T.filter(t => t.call);
  const KIND = { search_code: "search", read_file: "read", edit_file: "edit", run_command: "run", ask_user: "ask" };
  const LABELS = ["search", "read", "edit", "run", "ask"];
  const kinds = CALLS.map(t => KIND[t.call[0]]);
  const count = k => kinds.filter(x => x === k).length;
  const LOOKS = count("search") + count("read");
  const SIZE = T.map(t => t.p + t.o);                       // what the harness checks after each reply
  const THRESH = Math.round(H.limit * H.compactAt);
  const FIRST_OVER = SIZE.findIndex(s => s > THRESH);       // index of the model call after which it clears
  const CLEARED = CALLS.length > 0 ? Math.max(0, FIRST_OVER + 1 - H.keep) : 0; // results that existed then, minus the kept
  const KEPT = [FIRST_OVER + 1 - H.keep, FIRST_OVER];       // indexes of the results kept
  const AFTER = T[FIRST_OVER + 1].p, WITHOUT = CAL_PROMPTS[FIRST_OVER + 1];
  const resultChars = sum(CALLS.map(t => t.result.length));
  const lineCount = s => s.split("\n").length;
  const arg = c => JSON.parse(c[1]);
  const CR = REC_COMMIT.rows;
  const C_EDITS = CR.filter(r => r[0] === "edit_file");
  const C_TESTS = CR.filter(r => r[0] === "run_command");
  const C_FAILED = C_TESTS.filter(r => r[2] === "(exit code 1)").length;
  const C_READ_DATES = CR.some(r => r[0] === "read_file" && arg(r).path === "recipes/dates.py");
  const C_FIRST_RUN = CR.findIndex(r => r[0] === "run_command");
  const C_FIRST_EDIT = CR.indexOf(C_EDITS[0]) + 1;             // 1-based call number of the first edit
  const before = k => CALLS.slice(0, CALLS.findIndex(t => t.call[0] === "edit_file")).filter(t => KIND[t.call[0]] === k).length;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 7.5em 1fr; gap: 4px 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-row.lx-${ID}-now { border-left: 3px solid var(--ink); padding-left: 10px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-tools { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-tools li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-tools code { font: 600 14px var(--mono); }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-picks { display: grid; gap: 8px; margin: 14px 0 0; }
      .lx-${ID}-pick { min-height: 44px; width: 100%; text-align: left; padding: 9px 12px; border: 1px solid var(--line); border-radius: 6px;
        background: var(--surface); color: var(--ink); font: 500 14.5px/1.45 var(--mono); overflow-wrap: anywhere; cursor: pointer; }
      .lx-${ID}-pick[aria-pressed="true"] { border: 2px solid var(--good); background: var(--good-soft); }
      .lx-${ID}-pick.lx-${ID}-bad { border: 2px solid var(--bad); background: var(--bad-soft); }
      .lx-${ID}-pick:disabled { cursor: default; color: var(--ink-2); }
      .lx-${ID}-json { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 6px; font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-wrap .ltable { table-layout: fixed; width: 100%; }
      .lx-${ID}-wrap .ltable td, .lx-${ID}-wrap .ltable th { overflow-wrap: anywhere; }
      .lx-${ID}-wrap .ltable td:first-child, .lx-${ID}-wrap .ltable th:first-child { width: 7.8em; overflow-wrap: normal; }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  function log(kit, rows) {
    return `<div class="lx-${ID}-log">${rows.map(([who, html, o]) =>
      `<div class="lx-${ID}-row${o && o.now ? ` lx-${ID}-now` : ""}"><div class="lx-${ID}-who">${kit.esc(who)}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>`;
  }
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const callTxt = c => `${c[0]} ${c[1]}`;
  const opt = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  const toolList = kit => `<ul class="lx-${ID}-tools">${TOOLS.map(([n, a, d]) => `<li><code>${kit.esc(n)}(${kit.esc(a)})</code> ${kit.esc(d)}</li>`).join("")}</ul>`;
  const short = (s, last) => { const ls = s.split("\n"), l = (last ? ls[ls.length - 1] : ls[0]).trim(); return ls.length === 1 && l.length <= 60 ? l : `${l.length > 48 ? l.slice(0, 48) + " …" : l}${ls.length > 1 ? ` (${ls.length} lines)` : ""}`; };
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }
  // one question with options; RIGHT may be a number; fb: [[html, ok]]
  function question(el, kit, { title, lead, task, opts, right, fb }) {
    let ans = null;
    return done => {
      const paint = () => {
        el.innerHTML = `<h1>${title}</h1>${lead}<p class="task">${task}</p><div class="lpanel">${ask(kit, opts, right, ans, fb)}</div>`;
        el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
      };
      paint();
    };
  }

  /* 1. The situation, and a prediction. */
  function situation({ el, done, kit }) {
    ensureStyle();
    question(el, kit, {
      title: "A bug in a project you have never opened",
      lead: `<p class="lead">You join a small open-source recipe site (we made it for this lesson). Users report that the “Added this week” filter is wrong. You have never opened this code. You hand the bug to a coding agent:</p>
        ${log(kit, [["you", kit.esc(TASK)]])}
        <p class="lead">The agent is a language model plus a program around it. This lesson is about that program: what it does for the model, and what it costs you. The model cannot open files or run anything. It can only ask the program to run one of these five tools, then read what comes back:</p>
        ${toolList(kit)}`,
      task: "Before you see the session: which kind of tool call do you expect the model to make most often?",
      opts: ["Calls that change files (edit)", "Calls that look at the code (search and read)", "Calls that run commands (run)", "Questions to you (ask)"],
      right: 1,
      fb: [
        ["A fix is usually one small change. Before it can make it, the model has to find where the bug lives in code it has never seen, and every look is a separate call.", false],
        ["That is the prediction to check. On the next screen you label every call of the real session and count.", true],
        ["Running the tests is how the agent checks a fix, so it happens, but it is the last step. Most of the work comes before: finding the right file.", false],
        ["The model can ask, but the bug report already says what is wrong. The missing facts are in the code, and only search and read can get them.", false]
      ]
    })(done);
  }

  /* 2. By hand: label each recorded call. */
  const WHAT = {
    search: "it looks for a pattern across all files and returns matching lines, without opening any file whole",
    read: "it opens one named file and returns all of its lines",
    edit: "it changes a file on disk",
    run: "it runs a shell command, such as the tests",
    ask: "it puts a question to you and waits for your answer"
  };
  function labelCalls({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k >= CALLS.length;
      const t = CALLS[Math.min(k, CALLS.length - 1)];
      const right = LABELS.indexOf(KIND[t.call[0]]);
      const rows = CALLS.slice(0, fin ? CALLS.length : k + 1).map((c, i) => [i < k ? `${i + 1} · ${KIND[c.call[0]]}` : `${i + 1} · ?`, mono(kit, callTxt(c.call) + "\n→ " + short(c.result, c.call[0] === "run_command")), { now: i === k }]);
      el.innerHTML = `<h1>Label the session</h1>
        <p class="lead">This is the real session: a small hosted model inside a program we wrote for this lesson. Every row is one tool call the model asked for, and the start of what the program sent back.</p>
        ${fin ? "" : `<p class="task">Label call ${k + 1} of ${CALLS.length}: what kind of call is it?</p>`}
        ${log(kit, rows)}
        <div class="lpanel">${fin ? kit.feedback(`All ${CALLS.length} labelled: ${plural(count("search"), "search")}, ${plural(count("read"), "read")}, ${plural(count("edit"), "edit")}, ${plural(count("run"), "run")}, ${plural(count("ask"), "question")}. So ${LOOKS} of ${CALLS.length} calls only looked at the code. One call changed it, one checked it. The first search even came back empty: the model guessed words that were not in the code and had to try again. After the last call the model answered in plain text, and the run ended.`, true)
          : `${kit.options(LABELS, { picked: wrong, correct: right })}${wrong != null ? kit.feedback(`Not ${LABELS[wrong]}: that would mean ${WHAT[LABELS[wrong]]}. <code>${kit.esc(t.call[0])}</code> is a ${LABELS[right]}: ${WHAT[LABELS[right]]}.`, false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= CALLS.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: what made the fix possible. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    const fixCall = T.find(t => t.call && t.call[0] === "edit_file");
    question(el, kit, {
      title: "Who fixed the bug?",
      lead: `<p class="lead">The model's seventh call was the fix. Just before it, the model wrote:</p>
        ${log(kit, [["model", kit.esc(fixCall.say)], ["model asks", mono(kit, callTxt(fixCall.call))]])}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="lead">Now imagine pasting the same bug report into a plain chat window with the same model, and nothing else.</p>`,
      task: "What would you most likely get, and why?",
      opts: [
        "The same fix: the model is what finds bugs",
        "A guess: nothing would open the files, run the tests or send results back",
        "A better fix, because no tool results would crowd its context",
        "A refusal, because chat models cannot write code"
      ],
      right: 1,
      fb: [
        [`The model had never seen this project. The line <code>ADDED_FORMAT = "%Y-%d-%m"</code> reached it only because <code>read_file</code> ran and the program pasted the file into the conversation. Without that, it could not know where the bug is.`, false],
        [`Right. From the symptoms alone the model might even guess “day and month swapped”, but it could not know which file and line hold the format, and nothing would check the guess. In the session the model did the reasoning, but every fact about the code came from a tool the program ran for it. That program is the <b>harness</b>: it offers the tools, runs the ones the model asks for, sends each result back and repeats (the loop you know). A coding agent's harness adds more: it <b>checks permission</b> before a tool runs, it <b>manages the context</b> so it fits, and it can hand side work to a <b>subagent</b>. The next screens take these one by one.`, true],
        ["With no tool results there is also nothing about the code in its context: no file, no line, no test output. A short context does not help when the facts are missing.", false],
        ["A chat model writes code fine. What it cannot do on its own is open your files or run your tests. It would write a plausible guess.", false]
      ]
    })(done);
  }

  /* 4. Permission checks: predict what the harness does with each call. */
  const POLICY = [["search_code, read_file, ask_user", "allow"], ["edit_file", "ask the developer"], ["run_command starting python -m unittest", "allow"], ["any other run_command", "deny"]];
  const PCASES = (() => {
    const fix = T.find(t => t.call && t.call[0] === "edit_file").call;
    const test = T.find(t => t.call && t.call[0] === "run_command").call;
    const read = T[5].call;
    return [
      [read, 0, "Reading a file changes nothing, so the harness lets it run. Most of the session is calls like this one, and asking you about each would make the agent unusable.",
        { 1: "“Ask” is the rule for edits, which change files. A read changes nothing, so the harness lets it run without asking you.",
          2: "“Deny” is for commands that are not on the allow list. <code>read_file</code> is not a command, and reads are always allowed here." }],
      [fix, 1, "An edit changes your files, so the harness stops and asks you first. In our recorded run, the harness script answered for the developer: it said yes to edits inside the project.",
        { 0: "Our harness never lets an edit through on its own: an edit changes your files, so the rule is to ask you first.",
          2: "Edits are not banned: fixing the bug needs one. The rule for <code>edit_file</code> is to ask the developer." }],
      [test, 0, "This command is on the allow list: running the tests is how the agent checks its work, and it changes nothing outside the project.",
        { 1: "Nobody is asked about commands in this harness: a command is either on the allow list or denied. This one starts with <code>python -m unittest</code>, so it is on the list.",
          2: "This command starts with <code>python -m unittest</code>, which is on the allow list. Only other commands are denied." }],
      [REC_DENY.calls[0], 2, "Not on the allow list, so it is denied before it runs. It would also have changed git settings for every project on this computer, not just this one.",
        { 0: "Only commands that start with <code>python -m unittest</code> are allowed. <code>git config</code> is a different command.",
          1: "Nobody is asked about commands in this harness: a command is either on the allow list or denied. <code>git config</code> is not on the list." }]
    ];
  })();
  function permissions({ el, done, kit }) {
    ensureStyle();
    const ans = PCASES.map(() => null);
    const D = ["allow", "ask the developer", "deny"];
    const ok = () => PCASES.every(([, r], j) => ans[j] === r);
    const paint = () => {
      el.innerHTML = `<h1>The harness checks before it runs</h1>
        <p class="lead">The model only <i>asks</i> for a tool. Before anything runs, the harness checks the call against its rules. Ours has four:</p>
        ${kit.table(POLICY, { head: ["call", "harness does"], title: "Permission rules in harness.py" })}
        <p class="lead">The last call below comes from a second recorded run, where we asked the agent only to commit the fix with git.</p>
        <p class="task">For each call, what does the harness do?</p>
        ${PCASES.map(([c, r, why], i) => `<div class="lcase" id="c${i}">${mono(kit, callTxt(c))}${kit.options(D, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? why : PCASES[i][3][ans[i]], ans[i] === r)}</div>`).join("")}
        ${ok() ? kit.feedback(`In that second run the model asked for ${plural(REC_DENY.calls.length, "git command")} at once. Each got the same tool result: <code>${kit.esc(REC_DENY.result)}</code> The model read the denials and answered:${log(kit, [["model", kit.esc(REC_DENY.final)]])}<p class="lx-${ID}-cap">${CAPTION}</p>A denial is just another tool result. None of them ran: the rule was enforced by the program, not by asking the model to behave.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ok()) done();
      }));
    };
    paint();
  }

  /* 5. By hand: predict when the context runs out. */
  function contextWhen({ el, done, kit }) {
    ensureStyle();
    const shownSteps = FIRST_OVER + 1;
    const opts = [FIRST_OVER - 2, FIRST_OVER - 1, FIRST_OVER].map(i => `After call ${i + 1}`).concat(["Never in this run"]);
    const right = 2;
    const fb = [
      [`After call ${FIRST_OVER - 1}: ${fmt(T[FIRST_OVER - 2].p)} + ${fmt(T[FIRST_OVER - 2].o)} = ${fmt(SIZE[FIRST_OVER - 2])}. That is under ${fmt(THRESH)}. Add the two numbers of each row before you compare.`, false],
      [`Close. After call ${FIRST_OVER}: ${fmt(T[FIRST_OVER - 1].p)} + ${fmt(T[FIRST_OVER - 1].o)} = ${fmt(SIZE[FIRST_OVER - 1])}, just under ${fmt(THRESH)}. The rule says “more than”, so the harness waits.`, false],
      [`Right. After call ${FIRST_OVER + 1}: ${fmt(T[FIRST_OVER].p)} + ${fmt(T[FIRST_OVER].o)} = ${fmt(SIZE[FIRST_OVER])}, over ${fmt(THRESH)}. Every request carries the whole conversation, and each file the model reads stays in it, so the size only grows until the harness does something.`, true],
      [`It grows every call, because each tool result stays in the conversation and is sent again with every request. Add each row and compare with ${fmt(THRESH)}.`, false]
    ];
    question(el, kit, {
      title: "When does the context run out?",
      lead: `<p class="lead">Every request sends the whole conversation so far. The model can read only so much at once: its <b>context window</b>. To make the limit show up in a short run, we gave our harness a tiny window of ${fmt(H.limit)} tokens (real ones are far bigger; the idea is the same). The harness has a rule. After each reply, it adds the request tokens and the reply tokens. If the sum is more than ${Math.round(H.compactAt * 100)}% of the window (${fmt(THRESH)}), it acts.</p>
        ${kit.table(T.slice(0, shownSteps).map((t, i) => [`call ${i + 1} · ${KIND[t.call[0]]}`, `${fmt(t.p)} + ${fmt(t.o)}`]), { head: ["model call", "request + reply tokens"], title: "Token counts reported in the recording" })}`,
      task: `After which call does the harness first find the conversation over ${fmt(THRESH)} tokens?`,
      opts, right, fb
    })(done);
  }

  /* 6. What the harness clears, and what it costs. */
  function whatCleared({ el, done, kit }) {
    ensureStyle();
    const before = CALLS.slice(0, FIRST_OVER + 1);
    const picked = new Set();
    let bad = null;
    const fin = () => KEPT.every(i => picked.has(i));
    const paint = () => {
      const f = fin();
      el.innerHTML = `<h1>What the harness clears</h1>
        <p class="lead">Once the conversation is over ${fmt(THRESH)} tokens, our harness does not stop the run. It replaces the content of old tool results with a one-line note, “${kit.esc(CLEARED_NOTE)}”, and keeps only the newest ${H.keep} results whole. The model's own messages stay.</p>
        <p class="task">These are the ${before.length} tool results in the conversation after call ${FIRST_OVER + 1}. Each button stands for the result of that call. Pick the ${H.keep} the harness keeps whole.</p>
        <div class="lx-${ID}-picks">${before.map((t, i) => {
          const on = picked.has(i), isBad = bad === i;
          return `<button type="button" class="lx-${ID}-pick${isBad ? ` lx-${ID}-bad` : ""}" data-i="${i}" aria-pressed="${on}"${f ? " disabled" : ""}>${i + 1} · ${kit.esc(callTxt(t.call))}</button>`;
        }).join("")}</div>
        <div class="lpanel">${bad != null && !f ? kit.feedback(`Result ${bad + 1} is one of the older ones. The rule keeps the newest ${H.keep}, the ones closest to what the model is doing now, and clears the rest, however useful they were earlier.`, false) : ""}
        ${f ? kit.feedback(`Right: the read of <code>recipes/dates.py</code> and the edit result stay; ${plural(CLEARED, "older result")} became the note. The next request was ${fmt(AFTER)} tokens. Another recorded run of the same task, with the same first ${FIRST_OVER + 1} calls and no clearing, sent ${fmt(WITHOUT)} tokens at that point. The model then ran the tests and finished:${log(kit, [["model", kit.esc(T[T.length - 1].text)]])}<p class="lx-${ID}-cap">${CAPTION}</p>It worked here because nothing the model still needed was cleared. If the tests had failed in <code>filters.py</code>, the model would have to read it again: one more call. Clearing saves tokens on every later request and can cost a repeat call, or a mistake if the model does not notice what is gone.`, true) : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-pick`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (KEPT.includes(i)) { picked.add(i); bad = null; } else bad = i;
        paint();
        if (fin()) done();
      });
    };
    paint();
  }

  /* 7. When the model goes astray: what the harness can and cannot do. */
  function astray({ el, done, kit }) {
    ensureStyle();
    const rows = [["…", kit.esc(`${C_FIRST_RUN} searches and reads (views.py, filters.py)`)]].concat(
      CR.slice(C_FIRST_RUN).map(r => ["model asks", mono(kit, callTxt([r[0], r[1]]) + (r[2] === "(exit code 1)" ? "\n→ tests failed (exit code 1)" : ""))]));
    question(el, kit, {
      title: "Same model, one more sentence",
      lead: `<p class="lead">We ran the same task once more, adding one sentence at the end: “${kit.esc(COMMIT_SENTENCE)}” Same model, same settings, but a large context window, so nothing was cleared. It took another path from its very first call. From the first test run on:</p>
        ${log(kit, rows)}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="lead">It ${C_READ_DATES ? "did open" : "never opened"} <code>recipes/dates.py</code>, the file with the bug. It edited the cutoff line ${plural(C_EDITS.length, "time")} (the last edit wrote back the same text); ${C_FAILED} of ${C_TESTS.length} test runs failed. The step limit ended the run after ${REC_COMMIT.modelCalls} model calls.</p>`,
      task: "Which part of the harness could have stopped this run soonest?",
      opts: ["The step limit", "The “ask the developer” check on the first edit", "Clearing old tool results", "The test runs"],
      right: 1,
      fb: [
        [`It did stop the run, but only after ${REC_COMMIT.modelCalls} model calls and ${C_EDITS.length} edits. The step limit is the last net: it ends a run, it does not catch a bad step.`, false],
        [`Right. The first edit changes <code>days=7</code> to <code>days=8</code>, while the docstring says “last 7 days” and the bug report says a July recipe shows up. One extra day cannot explain July. A developer who reads call ${C_FIRST_EDIT} before saying yes can decline it, instead of letting it through and watching ${C_EDITS.length - 1} more guesses. Our harness sends back only “denied”; Claude Code also lets you attach a comment to a “No”, which reaches the model as the reason. The harness cannot make the model reason well. It gives you checkpoints, and the edit check is the one where your judgement goes in.`, true],
        ["Nothing was cleared in this run: the window was large. And clearing only decides what the model still sees. It never judges whether an edit is good.", false],
        ["The tests told the truth every time: they failed. The model saw it and guessed another number. Tests detect a wrong fix; they do not steer the model to the right one.", false]
      ]
    })(done);
  }

  /* 8. Subagents: keep a flood of results out of the main context. */
  function subagent({ el, done, kit }) {
    ensureStyle();
    const times = Math.floor(SEARCH_ADDED.chars / resultChars);
    question(el, kit, {
      title: "A search that floods the context",
      lead: `<p class="lead">Suppose the model had searched for the word <code>${kit.esc(SEARCH_ADDED.pattern)}</code>. We ran that search with the harness's own code (no model): ${plural(SEARCH_ADDED.lines, "matching line")}, ${fmt(SEARCH_ADDED.chars)} characters, and ${SEARCH_ADDED.fromData} of the lines come from the recipe data file. All ${CALLS.length} tool results of the real session together were ${fmt(resultChars)} characters, so this one search is about ${times} times more. Our harness would cut it at ${fmt(H.maxResult)} characters, and the cut would drop whatever came after.</p>
        <p class="lead">The model only needs the answer: which code files use the <code>added</code> field.</p>`,
      task: "How should a harness handle a big search like this?",
      opts: [
        "Paste the whole result into the conversation and clear it later",
        "Give the search to a subagent: a second model run with its own conversation, which sends back a short summary",
        `Keep the first ${fmt(H.maxResult)} characters, as our harness does`,
        "Switch to a model with a larger window for this step"
      ],
      right: 1,
      fb: [
        ["Then every request after it resends those lines until clearing kicks in, and the clearing may also throw away results the model still needs, as on the last screens.", false],
        ["Right. A <b>subagent</b> works in its own context window: it searches and reads as much as it likes, and only its summary, a few lines, enters the main conversation. The price: it starts without the main conversation's knowledge, so it may repeat some looking, it takes time, and it spends tokens of its own. It is worth it when the side task makes a lot of output you will not need again.", true],
        ["Cutting keeps the first lines and drops the rest, and here most lines are recipe data. The code files you want could be in the part that is dropped. A cut decides by position, not by what matters.", false],
        ["A larger window fits more, but every later request still resends all of it, and you pay for every token each time. It postpones the problem.", false]
      ]
    })(done);
  }

  /* 9. The same parts in Claude Code (written from the documentation, not run). */
  const CC = [
    ["Tools", "Read, Edit, Bash (shell commands, tests, git), Agent (starts a subagent), AskUserQuestion, and more"],
    ["Permission", "Reads inside the project need no approval. Edits and most shell commands ask first in Manual mode. Allow, ask and deny rules in .claude/settings.json; deny is checked first"],
    ["Context", "Compacts on its own near the limit by summarising the conversation; /compact with a focus; /context shows what uses space"],
    ["Subagents", "Each has its own context window; its tool calls stay out of yours and a summary comes back. The built-in Explore subagent is read-only"],
    ["Undo", "Snapshots a file before editing it. Actions on remote systems (databases, deployments) cannot be undone that way"]
  ];
  function claudeCode({ el, done, kit }) {
    ensureStyle();
    question(el, kit, {
      title: "The same parts in Claude Code",
      lead: `<p class="lead"><b>Not run by us.</b> Written from the <a href="https://code.claude.com/docs/en/how-claude-code-works">official documentation</a>, checked 2026-11-17. The documentation describes Claude Code as “the layer around the model that provides the tools and manages the context the model sees”, and calls that layer the agentic harness. It has every part you just used.</p>
        <div class="lx-${ID}-wrap">${kit.table(CC, { head: ["part", "in Claude Code"], title: "What the documentation describes" })}</div>
        <p class="lead">Two names in the options: CLAUDE.md is a file of project instructions that the model reads. Plan mode is a mode where the agent explores and proposes a plan without editing your source files.</p>
        <p class="lead">Your team wants the agent to run the tests without asking each time, and never to run <code>git push</code>.</p>`,
      task: "Where do you put that?",
      opts: [
        "A sentence in CLAUDE.md: “Run the tests freely. Never push.”",
        "Permission rules in .claude/settings.json: allow the test command, deny git push",
        "Start every session in Plan mode",
        "Give each command its own subagent"
      ],
      right: 1,
      fb: [
        ["CLAUDE.md is read by the model as instructions. The documentation says Claude treats it as context, not enforced configuration. It helps, but a model can still ask for the push. A rule the program checks is what stops it.", false],
        [`Right. The program checks these before every tool call, like the rules in our harness:<div class="lx-${ID}-json">${kit.esc('{\n  "permissions": {\n    "allow": ["Bash(python -m unittest *)"],\n    "deny": ["Bash(git push *)"]\n  }\n}')}</div>Deny rules are checked before allow rules. The documentation also warns that a push written another way, such as <code>git -C . push</code>, does not match this pattern, so a rule is a strong guard, not a perfect one.`, true],
        ["In Plan mode the agent does not edit your source files, so it could not fix the bug. And a mode says nothing about which commands may run.", false],
        ["Subagents split up work and context. They do not decide which commands are allowed.", false]
      ]
    })(done);
  }

  /* 10. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    question(el, kit, {
      title: "When to hand a task to a coding agent",
      lead: `<p class="lead"><b>For:</b> work where finding the place is most of the job: unfamiliar code, a bug you can reproduce, a change spread over files. <b>Reach for it</b> when there is a check it can run, such as tests.</p>
        <p class="lead"><b>Not</b> for a change you can already point at: you would wait for it to search for what you see. Not for actions on live systems that cannot be undone. Not when nothing can tell a right result from a wrong one.</p>
        <p class="lead"><b>Costs:</b> a model call per step, more tokens as the context grows, waiting time, and your time to read its edits and answer its questions. Keeping the harness's rules and project notes up to date is work too.</p>`,
      task: "Which job does a good harness still leave to you?",
      opts: ["Finding the right file in unfamiliar code", "Typing the edit", "Judging whether the change is right before it ships", "Running the tests"],
      right: 2,
      fb: [
        [`That is exactly what the agent did for you: ${plural(before("search"), "search")} and ${plural(before("read"), "read")} before it reached the line.`, false],
        ["The agent did type it for you, in one tool call. And typing was the cheap part anyway.", false],
        [`Right. In the run with the extra commit sentence the tests failed ${C_FAILED} times and the model kept guessing; in another case the tests may be weak and pass a wrong fix. Permission checks, tests and step limits help, but you still review the change and own it.`, true],
        ["The agent ran them itself, and the harness let it without asking because the command is on the allow list.", false]
      ]
    })(done);
  }

  /* 11. Recognise it in new situations. */
  const CASES = [
    ["A test fails in a payments service you have never opened. The error mentions a currency rounding helper, but you do not know where it is or who calls it.", true,
      "Yes. Most of the work is finding the code, and the failing test is a check the agent can run after each change. That is the shape the harness is built for.",
      "Finding the helper and its callers in unknown code is search and read, many times. The failing test tells the agent when it is done. This is a good task to hand over, with edits checked by you."],
    ["Fix a typo in a button label, “Sumbit”, in the file you already have open at that line.", false,
      "No. You already know the file and the line. The agent would spend calls searching for what you can see, and you would still read its edit. Doing it by hand takes seconds.",
      "The expensive part, finding the place, is already done. Every agent step is a model call and a wait; here there is nothing for it to find. Do it by hand."],
    ["Delete duplicate customer rows directly in the production database, today.", false,
      "No. A file edit can be undone; a delete on the live database cannot, and file snapshots do not cover remote systems. Write the query, review it, test it on a copy, and have a person run it.",
      "The harness's safety nets are for files: snapshots, the edit check, tests. A delete on a live database goes past all of them, and one wrong condition removes real rows. Keep the agent out of it, or at most let it draft a query you review."],
    ["Upgrade a date library across a project and fix whatever the tests break.", true,
      "Yes. Run the tests, read the errors, find the code, edit, run again: the loop the harness runs well, with the tests as the check after each change.",
      "The errors after an upgrade point to many places you do not know in advance, and the tests say when each is fixed. That is search, read, edit and run, many times over."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Agent or by hand?</h1>
        <p class="lead">Four tasks from other teams. A coding agent means: the model searches, reads, edits and runs inside a harness, and you approve its edits.</p>
        <p class="task">Would you hand each one to a coding agent? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can see the harness</h1>
      <p class="lead">A coding agent is a model plus a harness. The model decides the next step. The harness runs the tools, checks permission first, keeps the context small enough and can hand side work to a subagent.</p>
      <p class="lead">You labelled a real session: ${LOOKS} of ${CALLS.length} calls only looked at the code. You predicted the permission check for each call. You found when the context crossed its line and what was cleared. You saw why a subagent keeps a flood of results out, and which checkpoint could have stopped a guessing model. Then you sorted tasks into “agent” and “by hand”. The part that stays yours: judging the change before it ships.</p>
      <p class="lead">The lesson itself was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. One added sentence sent the same model down another path; next you write the brief itself, with scope, a clear “done” and a way to check it.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Inside a coding agent: the harness around the model",
    checked: "2026-11-17",
    sources: [
      "https://code.claude.com/docs/en/how-claude-code-works",
      "https://code.claude.com/docs/en/permissions",
      "https://code.claude.com/docs/en/tools-reference",
      "https://code.claude.com/docs/en/context-window",
      "https://code.claude.com/docs/en/sub-agents",
      "https://code.claude.com/docs/en/memory",
      "https://openrouter.ai/docs/guides/features/tool-calling",
      "https://docs.python.org/3/library/datetime.html#format-codes"
    ],
    interview: [
      {
        q: "A coding agent works well on small tasks, but on a big unfamiliar repo it starts re-reading files and forgetting rules you gave it at the start. What is going on, and what do you change?",
        good: [
          "The context is filling up: every file read and search result stays in the conversation and is resent each turn",
          "When it nears the limit the harness compacts or clears old results, so earlier files and instructions can drop out",
          "Put rules that must last in the project instructions file (CLAUDE.md in Claude Code), which is loaded again after compaction",
          "Send broad searches to a subagent so only a summary enters the main context",
          "Give narrower tasks, or clear the conversation between unrelated tasks"
        ],
        weak: "Switch to a bigger model. That does not change what fills the context or why old results disappear."
      },
      {
        q: "Your team wants the coding agent to stop asking for approval all the time. How do you set it up without losing control?",
        good: [
          "Allow specific safe commands, such as the test command, with permission rules the program checks",
          "Deny dangerous ones, such as git push or deploy commands; deny rules win over allow rules",
          "Keep the approval on edits where judgement matters, or review the diff before it is merged",
          "Know what cannot be undone: file edits can be rolled back, actions on remote systems cannot",
          "Do not rely on instructions in CLAUDE.md for this: the model reads them, the program does not enforce them"
        ],
        weak: "Turn all permission prompts off, or write “please don't push” in the instructions file, without a rule the program enforces."
      }
    ],
    screens: [situation, labelCalls, spotIdea, permissions, contextWhen, whatCleared, astray, subagent, claudeCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(REC_WIN.turns.filter(t => t.call).length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c3 [data-wrong]"], right: PCASES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="0"]'], right: KEPT.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
