/* Lesson: writing a task a coding agent can finish. Story: Sora, a frontend developer, must add a CSV export
   button to an internal sales dashboard in a codebase she barely knows, and hands the job to a coding agent.
   Ideas: (1) an agent stops when the work looks done to it, so a brief needs the place (scope), what exists
   (context), what done means, and a check the agent can run itself, with an exact expected result;
   (2) when to do a task by hand instead: a change smaller than its brief, or a task whose "done" nobody can state.
   Data, all real:
   - docs/ai-path/runs/s5c-delegate-agent/repo/: the small dashboard repo every run started from;
   - agent.py: a tiny coding agent (the loop of the agent-loop lesson, four tools) that recorded runs a..e
     through scripts/ai/record.mjs; recordings (main checkout) docs/ai-path/recordings/s5c-delegate-agent/
     a-1, b-1..3, c-1..11, d-1..14, e-1..7; console output in run-a..e.out.txt (tool results, diffs, and
     `npm test` run by us after each run); the briefs in brief-a..e.txt;
   - check_export.mjs + check_export.out.txt: our own click on each run's export button (region South);
   - dump_traces.py + dump_traces.out.txt: every recorded step, text, tool call and token count.
   Lesson-local style: transcript and brief blocks (.lx-s5c-delegate-agent-*), see ensureStyle(). */
(() => {
  const ID = "s5c-delegate-agent";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const fmt = n => n.toLocaleString("en");
  const word = n => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);

  /* ---------- Data copied from the runs and recordings ---------- */
  // The briefs, from docs/ai-path/runs/s5c-delegate-agent/brief-a.txt, brief-b.txt, brief-c.txt.
  // Shown as Brief 1 = brief-b, Brief 2 = brief-a, Brief 3 = brief-c, so the order gives nothing away.
  const BRIEF_A = "Add a CSV export button to the sales dashboard.";
  const BRIEF_B = "On the Sales page (src/pages/sales.js), add an \"Export CSV\" button. It downloads the rows the table is showing for the chosen region, with the same columns as the table. Change only src/pages/sales.js.";
  const BRIEF_C = "On the Sales page (src/pages/sales.js), add an \"Export CSV\" button. It downloads the rows the table is showing for the chosen region, with the same columns as the table. Reuse toCsv from src/lib/csv.js and downloadText from src/lib/download.js, the way src/pages/invoices.js does. Change only src/pages/sales.js and test/sales.test.js.\nDone means: test/sales.test.js has a new test that builds the CSV for region \"South\" and checks that \"Lee, Park & Sons\" stays in one column, and npm test passes. Run npm test before you finish and paste its result.";
  const BRIEFS = [BRIEF_B, BRIEF_A, BRIEF_C]; // Brief 1, 2, 3
  // brief-e.txt, Run 5's brief, verbatim.
  const BRIEF_E = "On the Sales page (src/pages/sales.js), add an \"Export CSV\" button. It downloads the rows the table is showing for the chosen region, with the same columns as the table.\nContext: the Invoices page (src/pages/invoices.js) already has this button. Reuse toCsv from src/lib/csv.js and downloadText from src/lib/download.js the same way; do not write new CSV code.\nScope: change only src/pages/sales.js and test/sales.test.js. The tests run in plain Node, with no browser and no extra packages, so put the CSV text in an exported function salesCsv(region), and have the button call downloadText(\"sales.csv\", salesCsv(region)).\nDone means: test/sales.test.js has a new test that checks salesCsv(\"South\") equals exactly these three lines:\nDate,Sales rep,Customer,Amount\n2026-10-02,Tom Reyes,\"Lee, Park & Sons\",860\n2026-10-03,Mina Cho,Blue Harbor Ltd,2450\nand npm test passes. Run npm test before you finish and paste its result.";
  // From repo/: the files and the tools agent.py gave the model.
  const FILES = ["README.md", "package.json", "src/data/sales.js", "src/lib/csv.js", "src/lib/download.js", "src/pages/invoices.js", "src/pages/sales.js", "test/csv.test.js", "test/sales.test.js"];
  const TOOLS = ["list_files", "read_file", "write_file", "run_command (only npm test)"];

  // From the recordings, model text trimmed with … only; tool results are agent.py's real output (run-*.out.txt).
  const RECORDED_AT = "2026-11-13"; // recordedAt of every recording (UTC)
  const CAPTION = `Recorded model output, ${RECORDED_AT}`;
  // a-1 (brief-a)
  const REC_A = { src: "s5c-delegate-agent/a-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite",
    text: "I can help with that. What is the file path of the sales dashboard component?" };
  // b-1..3 (brief-b). The code lines are from b-2's write_file arguments (the new downloadCSV function).
  const REC_B = { src: "s5c-delegate-agent/b-1 … b-3", provider: "openrouter", model: "google/gemini-2.5-flash-lite",
    steps: [["read_file", "{\"path\":\"src/pages/sales.js\"}"], ["write_file", "{\"content\":\"…function downloadCSV(rows) {…\",\"path\":\"src/pages/sales.js\"}"]],
    code: [
      "function downloadCSV(rows) {",
      "  const csvContent = [",
      "    SALES_COLUMNS.map(c => c.label).join(\",\"), // Header row",
      "    ...rows.map(r => SALES_COLUMNS.map(c => r[c.key]).join(','))",
      "  ].join(\"\\n\");"
    ],
    final: "I have added an \"Export CSV\" button to the sales page. The button, when clicked, will now generate and download a CSV file containing the currently displayed sales data." };
  // c-1..11 (brief-c): the tool call of each step c-1..c-10 (c-11 answered in text), from dump_traces.out.txt.
  const C_TOOLS = ["read_file", "write_file", "read_file", "write_file", "run_command npm test", "run_command npm install", "run_command npm test", "read_file", "write_file", "run_command npm test"];
  // Tool results from run-c.out.txt.
  const REC_C = { src: "s5c-delegate-agent/c-1 … c-11", provider: "openrouter", model: "google/gemini-2.5-flash-lite",
    steps: [
      ["read_file", "{\"path\":\"src/pages/sales.js\"}"],
      ["write_file", "{\"content\":\"…\",\"path\":\"src/pages/sales.js\"}"],
      ["read_file", "{\"path\":\"test/sales.test.js\"}"],
      ["write_file", "{\"path\":\"test/sales.test.js\",\"content\":\"…import { JSDOM } from \\\"jsdom\\\";…\"}"],
      ["run_command", "{\"command\":\"npm test\"}", "exit code 1 … Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'jsdom' imported from …/test/sales.test.js"],
      ["run_command", "{\"command\":\"npm install\"}", "error: only `npm test` is allowed"]
    ],
    final: "It appears that `npm test` is still encountering issues, likely due to module resolution problems that I cannot directly address by installing packages. … However, I am unable to provide the output of `npm test` passing due to the persistent `ERR_MODULE_NOT_FOUND` error." };
  // check_export.out.txt: our click on each run's button, region South.
  const FILE_B = ["Date,Sales rep,Customer,Amount", "2026-10-02,Tom Reyes,Lee, Park & Sons,860", "2026-10-03,Mina Cho,Blue Harbor Ltd,2450"];
  const FILE_C = ["sales.csv"];
  const FILE_D = ["Date,Sales rep,Customer,Amount", "2026-10-02,Tom Reyes,\"Lee, Park & Sons\",860", "2026-10-03,Mina Cho,Blue Harbor Ltd,2450"];
  const FILE_E = ["Date,Sales rep,Customer,Amount", "2026-10-02,Tom Reyes,\"Lee, Park & Sons\",860", "2026-10-03,Mina Cho,Blue Harbor Ltd,2450"];
  const TESTS_AFTER_B = { exit: 0, pass: 2, fail: 0 }; // run-b.out.txt, npm test run by us
  // run C's button handler, from run-c.out.txt (git diff)
  const C_HANDLER = ["const csvContent = toCsv(SALES_COLUMNS, rows);", "downloadText(csvContent, \"sales.csv\");"];
  const C_LIB = ["toCsv(rows, columns)", "downloadText(filename, text)"]; // repo/src/lib/csv.js, download.js

  // d-1..14 (brief-d.txt): tool per step; d-12's test line; npm test output lines from run-d.out.txt.
  const D_TOOLS = ["list_files", "read_file", "read_file", "write_file", "read_file", "write_file", "run_command", "read_file", "write_file", "run_command", "read_file", "write_file", "run_command", "read_file"];
  const D_MAX_STEPS = 14; // agent.py default step limit
  const D_TEST = "assert.ok(csv.includes(\"102,2026-10-02,\\\"Lee, Park & Sons\\\",860\"));";
  const D_LAST = "The tests are still failing. … This is very puzzling. The `toCsv` function correctly quotes fields with commas. The `visibleSales` function correctly filters for the region. The `SALES` data contains the entry.";
  const SALES_SOUTH = [{ id: 102, date: "2026-10-02", rep: "Tom Reyes", customer: "Lee, Park & Sons", amount: 860 }, { id: 103, date: "2026-10-03", rep: "Mina Cho", customer: "Blue Harbor Ltd", amount: 2450 }]; // repo/src/data/sales.js
  // e-1..7 (brief-e.txt)
  const E_TEST_STEP = 6; // the model call whose tool call ran npm test
  const E_TESTS = { exit: 0, pass: 3, fail: 0 }; // e-6's npm test result in run-e.out.txt
  const E_FINAL = "I have added an \"Export CSV\" button to `src/pages/sales.js` and created a `salesCsv` function. I also added a test for this function in `test/sales.test.js` and confirmed that all tests pass.";
  // prompt (input) tokens of every model call, from the recordings' usage (dump_traces.out.txt)
  const PROMPT = {
    a: [227],
    b: [269, 650, 1425],
    c: [367, 770, 1312, 1484, 1939, 1990, 2056, 2115, 2572, 3170, 3214],
    d: [434, 622, 1076, 1348, 2011, 2190, 2484, 2559, 3133, 3458, 3532, 3890, 5352, 5422],
    e: [483, 1604, 2092, 2653, 2853, 3162, 3363]
  };

  /* ---------- Derived ---------- */
  const cols = line => { let n = 1, q = false; for (const ch of line) { if (ch === "\"") q = !q; else if (ch === "," && !q) n++; } return n; };
  const HEAD_COLS = cols(FILE_B[0]);
  const BAD = FILE_B.findIndex(l => cols(l) !== HEAD_COLS);
  const D_RUNS = D_TOOLS.filter(t => t === "run_command").length;
  const D_CALLS = D_TOOLS.length;
  const D_REWRITES = D_TOOLS.filter((t, i) => t === "write_file" && i > D_TOOLS.indexOf("run_command")).length;
  const E_CALLS = PROMPT.e.length;
  const C_CALLS = PROMPT.c.length;
  const C_TESTS = C_TOOLS.filter(t => t === "run_command npm test").length;
  const C_SHOWN = 3; // Run 2 steps shown openly on screen 2; the ones before sit behind a <details>
  const C_MORE = C_CALLS - REC_C.steps.length - 1; // steps between the last shown one and the final answer
  const BRIEF_C_FILES = new Set(BRIEF_C.match(/\b(?:src|test)\/[\w/.-]+\.js\b/g)).size;
  const D_ROW = SALES_SOUTH[0];
  const E_COLS = FILE_E.map(cols);
  const SOUTH_LINE = r => [r.date, r.rep, /[",\n]/.test(r.customer) ? `"${r.customer}"` : r.customer, r.amount].join(",");

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-briefs { margin: 14px 0 0; display: grid; gap: 10px; }
      .lx-${ID}-brief { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: var(--surface); }
      .lx-${ID}-brief b { display: block; font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
      .lx-${ID}-brief p { margin: 0; font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-brief .lx-${ID}-new { border-left: 3px solid var(--ink); padding-left: 8px; display: block; margin-top: 6px; }
      .lx-${ID}-log { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 7.5em 1fr; gap: 4px 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-run { margin: 18px 0 0; }
      .lx-${ID}-run > h2 { font-size: 17px; margin: 0; }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; white-space: pre-wrap; }
      .lx-${ID}-tools { margin: 10px 0 0; font-size: 15px; line-height: 1.5; color: var(--ink-2); }
      .lx-${ID}-tools code { font: 600 13.5px var(--mono); }
      .lx-${ID}-wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-briefs { margin-bottom: 14px; }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  const esc = s => LessonKit.esc(s);
  const mono = s => `<div class="lx-${ID}-mono">${esc(s)}</div>`;
  const log = rows => `<div class="lx-${ID}-log">${rows.map(([who, html]) => `<div class="lx-${ID}-row"><div class="lx-${ID}-who">${esc(who)}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>`;
  const briefBox = (label, text, extra = "") => `<div class="lx-${ID}-brief"><b>${esc(label)}</b><p>${esc(text)}${extra}</p></div>`;
  const briefList = () => `<div class="lx-${ID}-briefs">${BRIEFS.map((b, i) => briefBox(`Brief ${i + 1}`, b)).join("")}</div>`;
  const codeW = (kit, lines, on) => `<div class="lx-${ID}-wrap">${kit.code(lines, on)}</div>`;
  const cap = () => `<p class="lx-${ID}-cap">${CAPTION}</p>`;
  const opt = s => `<span class="lx-${ID}-opt">${esc(s)}</span>`;
  const callRows = (steps, from = 0) => steps.map(([name, args, res], i) => {
    const rows = [[`step ${from + i + 1}`, mono(`${name} ${args}`)]];
    if (res) rows.push(["tool result", mono(res)]);
    return rows;
  }).flat();
  const BRIEF_OPTS = ["Brief 1", "Brief 2", "Brief 3"];
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* 1. The situation, three briefs, and the first run to match. */
  function firstRun({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1; // Brief 2 = brief-a
    const fb = [
      ["Brief 1 names the file: src/pages/sales.js. An agent holding that brief has no reason to ask where the dashboard is. Look for the brief that names no place at all.", false],
      [`Right. Brief 2 names no page and no file. The agent had a <code>list_files</code> tool and did not use it. It asked, and stopped: ${plural(PROMPT.a.length, "model call")}, nothing changed. A bigger agent might search the repository instead, but then it has to guess which “dashboard” Sora meant.`, true],
      [`Brief 3 names ${word(BRIEF_C_FILES)} files, and src/pages/sales.js is in its first line. An agent holding it already knows the path. The question came from a brief that names no place.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Three briefs, one button</h1>
        <p class="lead">Sora is a frontend developer. Her manager wants an <b>Export CSV</b> button on the Sales page of an internal sales dashboard, and Sora barely knows the code. She hands the job to a coding agent: a model running the loop from the agent-loop lesson, with tools to read and change files and run commands. The text she gives it is the <b>brief</b>.</p>
        <p class="lead">To see what the brief changes, we built a small agent with ${word(TOOLS.length)} tools (${TOOLS.map(t => `<code>${esc(t)}</code>`).join(", ")}), gave it a copy of a ${FILES.length}-file dashboard repository, and ran it ${word(BRIEFS.length)} times, once per brief:</p>
        ${briefList()}
        <p class="lead">Run 1, the whole run. A small hosted model answered:</p>
        ${log([["model answers", esc(REC_A.text)]])}${cap()}
        <p class="task">Which brief produced Run 1?</p>
        <div class="lpanel">${ask(kit, BRIEF_OPTS, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Match the other two runs. */
  function matchRuns({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null];
    const RIGHT = [2, 0]; // Run 2 = brief-c (Brief 3), Run 3 = brief-b (Brief 1)
    const FB = [
      [["Brief 1 never mentions tests. This run wrote a test and ran <code>npm test</code> ${word(C_TESTS)} times, so something told it to.", false],
        ["Brief 2 produced Run 1, the question. And it names no file, while this run's first step reads src/pages/sales.js (open the first steps to see it).", false],
        ["Right. Brief 3 asked for a test and for <code>npm test</code> before finishing. The agent ran it, saw it fail, and said so instead of claiming success.", true]],
      [["Right. Brief 1 names the file and the behaviour, but gives no check. The agent read one file, wrote one file and reported done. It never ran a command.", true],
        ["Brief 2 produced Run 1. This run knew the file from the start: its first call reads src/pages/sales.js.", false],
        ["Brief 3 asked it to reuse <code>toCsv</code> and to run <code>npm test</code>. This run wrote its own CSV code and ran nothing.", false]]
    ];
    const paint = () => {
      const all = ans.every((a, i) => a === RIGHT[i]);
      el.innerHTML = `<h1>Match the other two runs</h1>
        <p class="lead">The same three briefs, the other two runs. Each step is one model call. A tool result is what our agent program really sent back to the model (long ones cut at …).</p>
        <details><summary>Show the three briefs again</summary>${briefList()}</details>
        <div class="lx-${ID}-run lcase" id="c0"><h2>Run 2 (${plural(C_CALLS, "model call")}; the first ${word(REC_C.steps.length)} steps, then the last answer)</h2>
          <details><summary>Steps 1 to ${REC_C.steps.length - C_SHOWN}: it read and rewrote the page, then read the test file</summary>${log(callRows(REC_C.steps.slice(0, -C_SHOWN)))}</details>
          ${log([...callRows(REC_C.steps.slice(-C_SHOWN), REC_C.steps.length - C_SHOWN), ["…", `${word(C_MORE)} more steps: it ran <code>npm test</code> again, reread and rewrote the test, and ran <code>npm test</code> once more, still failing`], ["model answers", esc(REC_C.final)]])}${cap()}
          <p class="task">Which brief produced Run 2?</p>${ask(kit, BRIEF_OPTS, RIGHT[0], ans[0], FB[0])}</div>
        <div class="lx-${ID}-run lcase" id="c1"><h2>Run 3 (${plural(PROMPT.b.length, "model call")})</h2>
          ${log([...callRows(REC_B.steps), ["model answers", esc(REC_B.final)]])}${cap()}
          <p class="task">Which brief produced Run 3?</p>${ask(kit, BRIEF_OPTS, RIGHT[1], ans[1], FB[1])}</div>
        ${all ? kit.feedback("All three matched. Notice what each brief made possible: no place, so the agent asked. A place but no check, so it stopped when the code looked right to it. A check, so it found out that the code did not work yet.", true) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === RIGHT[j])) done();
      }));
    };
    paint();
  }

  /* 3. Run 3 said done. Open the file it exports. */
  function openFile({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const fb = FILE_B.map((l, i) => i === BAD
      ? [`Right. A spreadsheet splits a line at every comma outside double quotes. This line has ${cols(l)} cells, not ${HEAD_COLS}: “Lee” and “ Park &amp; Sons” land in two columns, and 860 slides under a column with no header. The agent joined the cells with plain commas (its code is above). The repository already had <code>toCsv</code> in src/lib/csv.js, which puts quotes around a cell that holds a comma; the Invoices page uses it.`, true]
      : [i === 0 ? `The header has ${cols(l)} labels and ${cols(l)} cells, as it should. Look for a value that itself contains a comma.` : `${cols(l)} cells, the same as the header. “Blue Harbor Ltd” has no comma in it. Look for a customer whose name does.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>Run 3 said it was done</h1>
        <p class="lead">Run 3 ended with “${esc(REC_B.final)}” After it stopped, we ran <code>npm test</code> ourselves: exit code ${TESTS_AFTER_B.exit}, ${TESTS_AFTER_B.pass} passed, ${TESTS_AFTER_B.fail} failed. Then we clicked its button for region South and opened the file it downloaded. (A small fake browser, <code>check_export.mjs</code>, did the click.) Here is the code it wrote, then the file:</p>
        ${codeW(kit, REC_B.code, 3)}
        <p class="task">A spreadsheet opens this file. Which line does it read wrong?</p>
        <div class="lpanel">${ask(kit, FILE_B.map(opt), BAD, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === BAD) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: what would have turned "looks done" into "is done"? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const fb = [
      ["The agent already believed its code was right. It said so. “Be careful” gives it nothing new to compare against, so it still stops at the same point.", false],
      ["A stronger model might write the quotes, or might not. Either way Sora learns which one only when a sales rep opens the file. The problem is that nothing in the run could tell anyone.", false],
      [`Right. The agent stops when the work looks done to it. Run 3 had nothing to run that could say otherwise, and the existing tests never touched the export, so they passed. Claude Code's documentation says it this way: “Claude stops when the work looks done. If it has nothing to run that tells it whether the work actually is done, ‘looks done’ is all it has to go on.” Run 2 shows the other side: its check failed and it said so, so Sora knows not to merge.`, true],
      ["A shorter brief gives less, not more. Brief 2 was one line, and the agent did not even start.", false]
    ];
    const opts = ["Add “be careful and write bug-free code” to Brief 1", "Give the job to a stronger model", "Give the agent a check it can run that would fail on a customer name with a comma", "Make the brief shorter, so the agent can focus"];
    const paint = () => {
      el.innerHTML = `<h1>Why did nobody notice?</h1>
        <p class="lead">Run 3 read the right file, wrote a working button, and reported success. ${TESTS_AFTER_B.pass} tests passed. The file it exports is still wrong.</p>
        <p class="task">Sora wants no more surprises like Run 3. Which one change to Brief 1 helps most?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Rewrite the vaguest brief: one line per slot. */
  const SLOTS = [
    { name: "Where", right: 1, opts: [
      ["Wherever in the dashboard you think it fits best.", "That is Brief 2 with more words. Run 1 asked exactly this question back: where is it? Only Sora knows which page her manager meant."],
      ["On the Sales page (src/pages/sales.js). Change only src/pages/sales.js and test/sales.test.js.", null],
      ["Do not change any existing file.", "The button has to live in src/pages/sales.js, which exists. This line forbids the only change that does the job."]],
      line: "On the Sales page (src/pages/sales.js). Change only src/pages/sales.js and test/sales.test.js." },
    { name: "What already exists", right: 2, opts: [
      ["Write a solid CSV helper that handles every edge case.", "A second CSV helper next to the one the team already has. Run 3 wrote its own, and it missed the comma case the old one handles."],
      ["Pick the best CSV package from npm.", "The tests run in plain Node with no extra packages. Run 2 reached for a package (jsdom), could not install it, and never got a passing test."],
      ["The Invoices page already has this button. Reuse toCsv and downloadText the same way; do not write new CSV code.", null]],
      line: "The Invoices page (src/pages/invoices.js) already has this button. Reuse toCsv and downloadText the same way; do not write new CSV code." },
    { name: "Done means", right: 0, opts: [
      [`The tests run in plain Node, so put the CSV text in an exported salesCsv(region), and have the button call downloadText("sales.csv", salesCsv(region)). Done: a test checks salesCsv("South") equals exactly these three lines:\n${FILE_E.join("\n")}`, null],
      ["The export works correctly.", "Correct by whose idea? Run 3 believed its export worked correctly. “Done” has to be something the agent can compare against, not an opinion it already holds."],
      ["The button looks the same as the one on the Invoices page.", "Looks were never the problem. Run 3 added a button that downloads a file; the file was wrong."]],
      line: `The tests run in plain Node, so put the CSV text in an exported function salesCsv(region), and have the button call downloadText("sales.csv", salesCsv(region)). A test in test/sales.test.js checks that salesCsv("South") equals exactly these three lines:\n${FILE_E.join("\n")}\nand npm test passes.` },
    { name: "The check", right: 1, opts: [
      ["Tell me when you are done.", "Run 3 did exactly that. Without evidence, “done” is only the agent's opinion."],
      ["Run npm test before you finish and paste its result.", null],
      ["Open the page in a browser and check the download.", "This agent has no browser; its only command is npm test. A check only helps if the agent can actually run it."]],
      line: "Run npm test before you finish and paste its result." }
  ];
  function rewrite({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === SLOTS.length, s = SLOTS[k];
      const added = SLOTS.slice(0, k).map(x => `<span class="lx-${ID}-new">${esc(x.name)}: ${esc(x.line)}</span>`).join("");
      el.innerHTML = `<h1>Rewrite Brief 2</h1>
        <p class="lead">Brief 2 is one line. Grow it into a brief this agent can finish, one part at a time. The feedback on a wrong line points to the run that shows what goes wrong.</p>
        <div class="lx-${ID}-briefs">${briefBox("Your brief", BRIEF_A, added)}</div>
        ${fin ? "" : `<p class="task">Part ${k + 1} of ${SLOTS.length}, <b>${esc(s.name)}</b>: which line do you add?</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Your brief now has the four parts: <b>where</b> (the file and what may change), <b>what already exists</b> (so the agent reuses instead of reinventing), <b>what done means</b>, written as a result the agent can compare against, and <b>a check</b> it runs itself, with its output as evidence. None of it is about wording or tone. Every line gives the agent something it could not find out, or could not check, on its own.`, true)
          : `${kit.options(s.opts.map(o => opt(o[0])), { picked: wrong, correct: s.right })}${wrong == null ? "" : kit.feedback(s.opts[wrong][1], false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === s.right) { k++; wrong = null; paint(); if (k === SLOTS.length) done(); }
        else { wrong = i; paint(); }
      });
    };
    paint();
  }

  /* 6. Which run would each new line have prevented? */
  // [line, right run, right feedback, { wrong run: feedback naming why that run is not it }]
  const PREVENT = [
    ["“On the Sales page (src/pages/sales.js)”", 0,
      "Right. Run 1 stopped to ask where the dashboard was. With the file named, the first call can be reading it.",
      { 1: "Run 2's brief already named the file, and its first call read src/pages/sales.js. Its trouble came later, with the test. Look for the run that never started.",
        2: "Run 3's brief named the file too, and its first call read it. Its trouble was the CSV it wrote. Look for the run that never started." }],
    ["“Reuse toCsv and downloadText; do not write new CSV code”", 2,
      "Right. Run 3 wrote its own comma-joining code. The existing toCsv quotes a cell that holds a comma, so reusing it would have kept “Lee, Park & Sons” in one column.",
      { 0: "Run 1 never got as far as writing code: it stopped to ask where. Look for the run that wrote its own CSV code.",
        1: "Run 2's brief already said to reuse them, and it imported both. Its check failed for another reason: a test that needed a missing library." }],
    ["“The tests run in plain Node, so put the CSV text in an exported salesCsv(region)”", 1,
      "Right. Run 2 tried to test the button through a browser library that was not installed. A plain function can be tested in plain Node, so the check can actually pass.",
      { 0: "Run 1 never wrote a test: it stopped to ask where. Look for the run whose check could never pass.",
        2: "Run 3 never ran a check at all; its brief asked for none. Look for the run whose test needed something the repository does not have." }]
  ];
  function prevent({ el, done, kit }) {
    ensureStyle();
    const ans = PREVENT.map(() => null);
    const RUN_OPTS = ["Run 1", "Run 2", "Run 3"];
    const paint = () => {
      el.innerHTML = `<h1>What each line prevents</h1>
        <p class="lead">Run 1 asked where. Run 2 ran a check it could never pass. Run 3 said done with a broken file.</p>
        <p class="task">For each line of your brief, pick the run it would have prevented.</p>
        ${PREVENT.map(([line, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(line)}</p>${kit.options(RUN_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : no[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PREVENT.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 7. Run 4: a check described in words. The agent writes its own expected line, and gets it wrong. */
  function runFour({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 0;
    const fb = [
      [`Right. The table has ${HEAD_COLS} columns (Date, Sales rep, Customer, Amount); ${D_ROW.id} is the row's id, which the table never shows. The test's line also leaves out the Sales rep, ${esc(D_ROW.rep)}: the agent put the id where the rep should be, so deleting only the id would still fail. The export's line is <code>${esc(SOUTH_LINE(D_ROW))}</code>. The code was right, and our own click exported the correct file. The brief described the check in words, so the agent had to invent the expected line, and invented a wrong one. It ran <code>npm test</code> ${D_RUNS} times, rewrote its test ${D_REWRITES} times after the first failure, and the step limit of ${D_MAX_STEPS} ended the run.`, true],
      [`The line the code really produces is <code>${esc(SOUTH_LINE(SALES_SOUTH[0]))}</code>: the comma is quoted. The test's line differs at the start, not at the quotes.`, false],
      [`It ran <code>npm test</code> ${D_RUNS} times. The check ran fine; it kept failing because of what the test expected.`, false]
    ];
    const opts = ["The test expects 102, the row's id, and the export has no id column", "toCsv does not quote the comma in “Lee, Park & Sons”", "The agent never ran npm test"];
    const paint = () => {
      el.innerHTML = `<h1>Run 4: a check in words</h1>
        <p class="lead">Before Run 5, we tried a brief that was almost yours: the same where, the same reuse line, the same salesCsv and downloadText call. Only “done” was different. It said in words: a test checks that “Lee, Park &amp; Sons” stays in one column. It gave no expected lines. The agent reused toCsv, wrote salesCsv, then wrote this test line and ran <code>npm test</code>:</p>
        ${codeW(kit, [D_TEST], 0)}
        ${log([["tool result", mono("✖ salesCsv exports the correct CSV for a region …")], ["model, last step", esc(D_LAST)]])}${cap()}
        <p class="lead">What its salesCsv("South") really returns (our click on its button exports exactly this):</p>
        ${codeW(kit, FILE_D, -1)}
        <p class="task">Why does the test keep failing?</p>
        <div class="lpanel">${ask(kit, opts.map(esc), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. Run 5: the same brief with the exact expected lines. Predict, then see. */
  function runFive({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const result = `${log([[`step ${E_TEST_STEP}`, mono("run_command {\"command\":\"npm test\"}")], ["tool result", mono(`exit code ${E_TESTS.exit} … ℹ pass ${E_TESTS.pass} … ℹ fail ${E_TESTS.fail}`)], ["model answers", esc(E_FINAL)]])}${cap()}`;
    const fb = [
      ["That is what Run 4 did, when it had to invent the expected line. Here nothing is left to invent: the agent can copy the three lines into the test.", false],
      [`Right. Run 5 took ${plural(E_CALLS, "model call")} (Run 4 took ${D_CALLS}, and still failed). It read the files, wrote salesCsv and a test that compares with the three lines, and ran <code>npm test</code> once:${result}Our own click on its button for South: ${E_COLS.length} lines of ${E_COLS[0]} cells each, the comma name in quotes.`, true],
      ["It asked in Run 1 because it did not know where to work. This brief names the files, the function and the result, so there is nothing to ask.", false]
    ];
    const opts = ["Fails like Run 4, writing its own expected line", "Passes npm test, with a test that compares against the three lines", "Asks Sora a question before starting"];
    const paint = () => {
      el.innerHTML = `<h1>Run 5: your brief</h1>
        <p class="lead">Run 5 got a brief with your four parts, in slightly different words, with the three expected lines written out in “done”:</p>
        ${codeW(kit, FILE_E, -1)}
        <details><summary>Show Run 5's full brief</summary><div class="lx-${ID}-briefs">${briefBox("Run 5's brief", BRIEF_E)}</div></details>
        <p class="task">Predict how Run 5 ends.</p>
        <div class="lpanel">${ask(kit, opts.map(esc), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  const RUNS = [["Run 1", "a", "asked where"], ["Run 2", "c", "check could not pass"], ["Run 3", "b", "said done, file broken"], ["Run 4", "d", "hit the step limit"], ["Run 5", "e", "passed"]];
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const fb = [
      ["The tests check what the brief asked for. They do not check what nobody asked: where the button sits, what else changed in the file. That is still Sora's job.", false],
      [`The same brief and the same check give the same verdict: another ${plural(E_CALLS, "model call")} to learn nothing new.`, false],
      [`Right. Run 5's diff put the button above the region menu, which no line of the brief asked for, and its last answer says the tests passed without pasting the output the brief asked for (the <code>npm test</code> output on the screen before came from the tool log, not from its answer). Passing the check is where review starts, not where it ends. Run 2 is a reminder too: our own click on its button exported a file holding only “${esc(FILE_C[0])}”. It wrote <code>${esc(C_HANDLER[0])}</code> and <code>${esc(C_HANDLER[1])}</code>, but the helpers are <code>${esc(C_LIB[0])}</code> and <code>${esc(C_LIB[1])}</code>: both calls have their arguments swapped. Only reading the code shows that. You still own the change.`, true]
    ];
    const opts = ["Nothing. npm test passed", "Run the agent again to be sure", "Read the diff and the evidence before merging"];
    const rows = RUNS.map(([n, k, what]) => [`${n}: ${what}`, `${plural(PROMPT[k].length, "call")}, ${fmt(sum(PROMPT[k]))} input tokens`]);
    const paint = () => {
      el.innerHTML = `<h1>When to hand a task to an agent</h1>
        <p class="lead"><b>For:</b> a bounded change in code where “done” can be checked.</p>
        <p class="lead"><b>Reach for it</b> when you can name the place, point at what exists, and give a check that comes back pass or fail.</p>
        <p class="lead"><b>Not</b> when the edit is smaller than its brief: do it yourself. Not when nobody can say what done is yet: decide that with a person first. For open exploring, a loose prompt is fine, but expect to steer.</p>
        <p class="lead"><b>Costs:</b> your time writing the brief; model calls, each resending the whole run so far; and your review, which does not go away.</p>
        ${kit.table(rows, { head: ["run", "cost"], title: "What each run cost (from the recordings)" })}
        <p class="task">Run 5 passed. What is still Sora's job?</p>
        <div class="lpanel">${ask(kit, opts.map(esc), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it: brief an agent, or do it by hand? */
  const CASES = [
    ["Rename a prop from userId to accountId in 40 components. The project has a type checker and a test suite.", true,
      "Yes. The place is clear, the change is mechanical, and the type checker plus the tests come back pass or fail. Put both commands in the brief as the check.",
      "Forty files by hand is slow and easy to get wrong, and this one has a ready-made check: the type checker and the tests fail on any missed rename. That is the task an agent can finish."],
    ["Change the label of one button from “Send” to “Submit”. The file is open in front of you and you know the line.", false,
      "Right, by hand. The brief would be longer than the change, and you would still read the diff. Delegating costs more than it saves.",
      "No. A good brief here (the file, the line, a check) is longer than the edit itself, and then you review the diff anyway. Type it yourself."],
    ["Make the dashboard “feel more modern”. There is no mockup; the manager says she will know it when she sees it.", false,
      "Right, not yet. Nobody can write “done means”, so the agent has nothing to check against and will stop wherever it looks done to it. Agree on a mockup or a list of changes first; then each change can be briefed.",
      "No, not as it stands. There is no result to compare against: not even the manager can say what done is. The agent would stop when it looks done to the agent. First turn the wish into something checkable, like a mockup."],
    ["Invoices with a 0.5 cent line round to the wrong total. You can name the function and the three invoices that show it, with their right totals.", true,
      "Yes. Place, symptom and the exact right answers: that is a brief with a ready check. Ask for a failing test with those three invoices first, then the fix, then the test output.",
      "Here you can state done exactly: three invoices and their right totals. That makes a test the agent can run, fail, fix and rerun on its own."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Brief it, or do it yourself?</h1>
        <p class="lead">Four tasks from other teams. An agent can finish a task when you can say where, what done means, and how it checks.</p>
        <p class="task">Would you hand each one to a coding agent now? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes, brief an agent", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>A brief the agent can finish</h1>
      <p class="lead">You matched three real runs to their briefs, found the broken line in a file an agent called done, and built a brief with four parts: where, what already exists, what done means as an exact result, and a check the agent runs itself. You also saw when not to brief at all: when the edit is smaller than the brief, or when nobody can say what done is.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${esc(nx.title)}. A brief covers one task. Some lines hold for every task in a project, like the test command, or a command the agent must never run. The next lesson puts those in an instruction file and in permission rules.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Writing a task a coding agent can finish",
    checked: "2026-11-14",
    sources: [
      "https://code.claude.com/docs/en/best-practices",
      "https://openrouter.ai/docs/guides/features/tool-calling"
    ],
    interview: [
      {
        q: "You handed a ticket to a coding agent. It said it was done and CI was green, but the next day a user reports that the CSV export splits customer names across columns. What do you change in how you delegate?",
        good: [
          "Green CI only covers what the tests check; nothing tested the export, so the agent stopped when it looked done",
          "Write “done” as a result the agent can check, with the edge case in it: a name with a comma and the exact expected line",
          "Point the agent at what exists, such as the CSV helper the team already uses, so it does not write its own",
          "Ask for evidence: the command it ran and its output, not just “all tests pass”",
          "Still read the diff before merging"
        ],
        weak: "Use a stronger model or tell it to be more careful. Neither gives the agent a way to find out it is wrong."
      },
      {
        q: "Your manager wants every ticket handed to coding agents from now on. Which tickets would you still do by hand, and how do you decide?",
        good: [
          "The line is whether done can be stated as a check, not how hard the task is",
          "Tiny edits where the brief and the review cost more than doing it",
          "Tasks where nobody can say what done is yet, like a vague redesign: agree on a mockup or a list first",
          "Bounded changes with a test, type checker or expected output are good to delegate",
          "Track what delegation costs: reruns, model calls and review time"
        ],
        weak: "Keep the hard ones by hand and give the easy ones to the agent. Difficulty is not the line; whether the agent can check its own work is."
      }
    ],
    screens: [firstRun, matchRuns, openFile, spotIdea, rewrite, prevent, runFour, runFive, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(SLOTS.length).fill("[data-right]") },
      { wrong: ["#c0 [data-wrong]"], right: PREVENT.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
