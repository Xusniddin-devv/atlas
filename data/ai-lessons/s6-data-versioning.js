/* Lesson s6-data-versioning: Versioning datasets alongside code.
   Story: a water utility's leak-prediction model (the utility, its pipes and its repair log are made up for this
   lesson). In March someone quietly "cleaned" last year's pipe-repair file and the retrained model catches fewer
   leaks; nobody can get the January data back to check.
   Ideas: (1) a version of a dataset is its bytes: fingerprint the file (an MD5 hash), keep each version in a store
   under its fingerprint, and commit only the small fingerprint file next to the code; (2) DVC does exactly this
   (dvc add, a .dvc pointer file in git, a content-addressed cache), and going back needs dvc checkout after
   git checkout.
   Depth: explain (screens 1-3, 8, 9, interview), scratch (screens 4-5: fingerprints and a from-scratch
   snapshot() stepped from a real trace), library (screen 6: a real DVC session), debug (screen 7: git checkout
   without dvc checkout, from the same real session), when-not (screens 8 and 9).
   Data, all run on 2026-11-14 on this Mac (docs/ai-path/runs/s6-data-versioning/, see env.txt):
     data.py makes the two snapshots (seed 4); train.py is the model; dvc_run.sh -> dvc_run.out.txt is the DVC
     session (DVC 3.67.1); byhand.py -> byhand.out.txt (the rows of four pipes, leak labels of the top-10 pipes);
     diff.out.txt (diff of the two snapshots); hashes.py -> hashes.out.txt; snapshot.py -> snapshot.out.txt
     (the traced snapshot()).
   No model API calls. Every derived number on screen (counts, rows removed, leaks caught) is computed here from
   those copied values. Lesson-local CSS (row buttons, terminal block, checklist) is injected by style().
   Plain browser script. */
(() => {
  const ID = "s6-data-versioning", P = "lx-" + ID + "-";
  const RUN_DATE = "2026-11-14";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s6-data-versioning.ipynb";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const short = h => h.slice(0, 8) + "…";

  // From dvc_run.out.txt (train.py on each snapshot) and hashes.out.txt.
  const SNAP = {
    jan: { md5: "ae67042367971abc8772461e3875050b", size: 4433, rows: 123,
      top: ["P-102", "P-171", "P-081", "P-096", "P-111", "P-165", "P-075", "P-177", "P-054", "P-126"] },
    mar: { md5: "fd08e0c826c7eff502b30668fd33bd39", size: 4015, rows: 114,
      top: ["P-102", "P-171", "P-075", "P-126", "P-120", "P-063", "P-048", "P-123", "P-081", "P-096"] }
  };
  const TEST_LEAKS = 15, TOP_K = 10; // "leaks caught in the top 10: 7 of 15 test leaks"
  // From byhand.out.txt: did each pipe in either top-10 list really leak in 2026?
  const LEAKED = { "P-102": 0, "P-171": 1, "P-081": 1, "P-096": 0, "P-111": 0, "P-165": 1, "P-075": 1, "P-177": 1, "P-054": 1, "P-126": 1,
    "P-120": 0, "P-063": 0, "P-048": 0, "P-123": 0 };
  const caught = k => SNAP[k].top.filter(p => LEAKED[p]).length;
  const FELL_OUT = SNAP.jan.top.filter(p => !SNAP.mar.top.includes(p));
  const CAME_IN = SNAP.mar.top.filter(p => !SNAP.jan.top.includes(p));
  const LOST_LEAKS = FELL_OUT.filter(p => LEAKED[p]);

  // From diff.out.txt: the whole difference between the two snapshots.
  const DIFF_REMOVED = ["J-0032", "J-0044", "J-0046", "J-0052", "J-0086", "J-0093", "J-0101", "J-0119", "J-0121"];
  const DIFF_CHANGED = ["J-0001"];

  // From byhand.out.txt: every row of four pipes in each snapshot (job, pipe, date, note).
  const JAN_ROWS = [
    ["J-0001", "P-109", "2025-01-04", "joint lek"],
    ["J-0030", "P-054", "2025-04-12", "main break"],
    ["J-0032", "P-054", "2025-04-17", "main break, same spot"],
    ["J-0084", "P-102", "2025-08-28", "joint leak"],
    ["J-0091", "P-102", "2025-09-16", "joint leak"],
    ["J-0110", "P-102", "2025-11-18", "joint leak"],
    ["J-0117", "P-177", "2025-12-12", "main break"],
    ["J-0119", "P-177", "2025-12-15", "main break, same spot"]
  ];
  const MAR_ROWS = [
    ["J-0001", "P-109", "2025-01-04", "joint leak"],
    ["J-0030", "P-054", "2025-04-12", "main break"],
    ["J-0084", "P-102", "2025-08-28", "joint leak"],
    ["J-0091", "P-102", "2025-09-16", "joint leak"],
    ["J-0110", "P-102", "2025-11-18", "joint leak"],
    ["J-0117", "P-177", "2025-12-12", "main break"]
  ];
  const sameRow = (a, b) => a.every((x, i) => x === b[i]);
  const DIFFERS = JAN_ROWS.map((r, i) => MAR_ROWS.some(m => sameRow(m, r)) ? -1 : i).filter(i => i >= 0);
  const repairs = (rows, pid) => rows.filter(r => r[1] === pid).length;
  const SHOWN_PIPES = [...new Set(JAN_ROWS.map(r => r[1]))];

  // From hashes.out.txt: the MD5 of the January file and of four variants.
  const VARIANTS = [
    { what: "The January file copied to a new name, <code>repairs_2025_FINAL.csv</code>", md5: "ae67042367971abc8772461e3875050b", size: 4433 },
    { what: "The January file with only the typo fixed (<code>joint lek</code> to <code>joint leak</code>)", md5: "2deac0456907dbe8025500b18948614e", size: 4434 },
    { what: "The January file with the same rows sorted by pipe instead of by date", md5: "0ed4e5d4532f1b8ca5140854f7f59088", size: 4433 },
    { what: "The March file", md5: "fd08e0c826c7eff502b30668fd33bd39", size: 4015 }
  ];

  // From snapshot.py: the listing, line for line (0 = the def line).
  const CODE = [
    "def snapshot(data_path, cache_dir):",
    "    content = open(data_path, \"rb\").read()",
    "    digest = hashlib.md5(content).hexdigest()",
    "    stored = os.path.join(cache_dir, digest[:2], digest[2:])",
    "    if not os.path.exists(stored):",
    "        os.makedirs(os.path.dirname(stored), exist_ok=True)",
    "        shutil.copyfile(data_path, stored)",
    "    with open(data_path + \".ptr\", \"w\") as pointer:",
    "        pointer.write(digest + \"\\n\")",
    "    return digest"
  ];
  // From snapshot.out.txt: the line about to run, and the event ("l" line, "r" return), for call 1 (January file,
  // empty cache) and call 3 (January file again, after call 2 stored the March file). digest and stored are set
  // from the step after line 2 and line 3 respectively.
  const CALLS = [
    { name: "January file, empty cache", md5: SNAP.jan.md5, before: [], ptrBefore: null,
      steps: [[1, "l"], [2, "l"], [3, "l"], [4, "l"], [5, "l"], [6, "l"], [7, "l"], [8, "l"], [7, "l"], [9, "l"], [9, "r"]] },
    { name: "January file again", md5: SNAP.jan.md5, before: [SNAP.jan.md5, SNAP.mar.md5], ptrBefore: SNAP.mar.md5,
      steps: [[1, "l"], [2, "l"], [3, "l"], [4, "l"], [7, "l"], [8, "l"], [7, "l"], [9, "l"], [9, "r"]] }
  ];
  // snapshot.out.txt, last two lines: restore() copies the cache file back.
  const RESTORE = { before: SNAP.mar.md5, after: SNAP.jan.md5 };

  // From dvc_run.out.txt, cut into the parts the screens show (not altered; blank lines kept where it printed them).
  const T_ADD = [
    "$ dvc init -q",
    "$ dvc add data/pipe_repairs.csv",
    "",
    "To track the changes with git, run:",
    "",
    "\tgit add data/pipe_repairs.csv.dvc data/.gitignore",
    "",
    "To enable auto staging, run:",
    "",
    "\tdvc config core.autostage true"
  ];
  const T_FILES = [
    "$ cat data/pipe_repairs.csv.dvc",
    "outs:",
    "- md5: ae67042367971abc8772461e3875050b",
    "  size: 4433",
    "  hash: md5",
    "  path: pipe_repairs.csv",
    "",
    "$ cat data/.gitignore",
    "/pipe_repairs.csv",
    "",
    "…",
    "$ git tag jan-model",
    "$ python train.py data/pipe_repairs.csv data/pipes.csv",
    "data md5: ae67042367971abc8772461e3875050b",
    "…",
    "leaks caught in the top 10: 7 of 15 test leaks"
  ];
  const T_STATUS = [
    "$ dvc status",
    "data/pipe_repairs.csv.dvc:",
    "\tchanged outs:",
    "\t\tmodified:           data/pipe_repairs.csv"
  ];
  const T_READD = [
    "$ dvc add data/pipe_repairs.csv",
    "…",
    "$ git diff data/pipe_repairs.csv.dvc",
    "…",
    " outs:",
    "-- md5: ae67042367971abc8772461e3875050b",
    "-  size: 4433",
    "+- md5: fd08e0c826c7eff502b30668fd33bd39",
    "+  size: 4015",
    "   hash: md5",
    "   path: pipe_repairs.csv",
    "…",
    "$ python train.py data/pipe_repairs.csv data/pipes.csv",
    "data md5: fd08e0c826c7eff502b30668fd33bd39",
    "…",
    "leaks caught in the top 10: 4 of 15 test leaks"
  ];
  const T_CACHE = [
    "$ find .dvc/cache/files -type f",
    ".dvc/cache/files/md5/ae/67042367971abc8772461e3875050b",
    ".dvc/cache/files/md5/fd/08e0c826c7eff502b30668fd33bd39"
  ];
  // The broken session: each line, and what tapping it says. kind: "cause" is the right pick.
  const T_BROKEN = [
    ["$ git -c advice.detachedHead=false checkout -q jan-model", "cmd"],
    ["$ cat data/pipe_repairs.csv.dvc", "cmd"],
    ["outs:", "plain"],
    ["- md5: ae67042367971abc8772461e3875050b", "pointer"],
    ["  size: 4433", "plain"],
    ["  hash: md5", "plain"],
    ["  path: pipe_repairs.csv", "plain"],
    ["$ python train.py data/pipe_repairs.csv data/pipes.csv", "cmd"],
    ["data md5: fd08e0c826c7eff502b30668fd33bd39", "cause"],
    ["weights (bias, age/10, cast iron, repairs): [-2.47, -0.02, 0.15, 0.6]", "plain"],
    ["top 10 test pipes: ['P-102', 'P-171', 'P-075', 'P-126', 'P-120', 'P-063', 'P-048', 'P-123', 'P-081', 'P-096']", "plain"],
    ["leaks caught in the top 10: 4 of 15 test leaks", "symptom"],
    ["$ dvc status", "cmd"],
    ["data/pipe_repairs.csv.dvc:", "plain"],
    ["\tchanged outs:", "plain"],
    ["\t\tmodified:           data/pipe_repairs.csv", "status"]
  ];
  const T_FIX = [
    "$ dvc checkout",
    "M       data/pipe_repairs.csv",
    "",
    "$ python train.py data/pipe_repairs.csv data/pipes.csv",
    "data md5: ae67042367971abc8772461e3875050b",
    "…",
    "leaks caught in the top 10: 7 of 15 test leaks",
    "",
    "$ dvc status",
    "Data and pipelines are up to date."
  ];

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}rows { margin: 10px 0 0; display: grid; gap: 6px; }
.${P}row { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; width: 100%; text-align: left; min-height: 44px; padding: 7px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font: 500 14px/1.4 var(--mono); overflow-wrap: anywhere; }
button.${P}row { cursor: pointer; }
.${P}row .j { color: var(--muted); }
.${P}row .n { grid-column: 2; color: var(--ink-2); }
.${P}row.ok { border-color: var(--good); background: var(--good-soft); }
.${P}row.no { border-color: var(--bad); background: var(--bad-soft); }
.${P}lab { margin: 16px 0 0; font: 700 12px var(--mono); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
.${P}term { margin: 10px 0 0; border: 1px solid var(--line); border-radius: 10px; background: var(--sunk); padding: 8px 0; font: 500 13px/1.5 var(--mono); color: var(--ink); overflow-x: auto; }
.${P}term > div, .${P}term > button { display: block; width: 100%; text-align: left; padding: 0 12px; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; font: inherit; color: inherit; background: none; border: 0; }
.${P}term > button { min-height: 44px; border-top: 1px dashed var(--line); cursor: pointer; }
.${P}term > button.ok { background: var(--good-soft); }
.${P}term > button.no { background: var(--bad-soft); }
.${P}term .c { font-weight: 700; }
.${P}cap { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.${P}box { margin: 10px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.${P}box > div { border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; background: var(--surface); font: 500 13px/1.5 var(--mono); overflow-wrap: anywhere; }
.${P}box b { display: block; font: 700 12px var(--font); color: var(--muted); margin-bottom: 2px; }
.${P}case { margin-top: 18px; }
.${P}case > p { margin: 0 0 6px; }
.${P}big ul { margin: 8px 0 0; padding-left: 20px; }
.${P}big li { margin: 4px 0; }
.${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
.${P}check { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 8px; }
.${P}check label { display: flex; gap: 10px; align-items: flex-start; min-height: 44px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); cursor: pointer; }
.${P}check input { width: 22px; height: 44px; min-height: 44px; margin: -8px 0; flex: none; }
@media (max-width: 520px) { .${P}box { grid-template-columns: 1fr; } .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 8ch); text-indent: -8ch; } }
`;
    document.head.appendChild(s);
  }
  const termLines = lines => lines.map(l => `<div${l.startsWith("$ ") ? ' class="c"' : ""}>${esc(l) || " "}</div>`).join("");
  const term = (lines, cap = true) => `<div class="${P}term">${termLines(lines)}</div>${cap ? `<p class="${P}cap">Real output, DVC run on ${RUN_DATE} (dvc_run.out.txt; … marks a cut).</p>` : ""}`;
  const rowBox = (r, { i = null, pick = false, cls = "" } = {}) => {
    const T = pick ? "button" : "div";
    return `<${T}${pick ? ' type="button"' : ""} class="${P}row ${cls}"${i != null ? ` data-i="${i}"` : ""}><span class="j">${esc(r[0])}</span><span>${esc(r[1])} · ${esc(r[2])}</span><span class="n">${esc(r[3])}</span></${T}>`;
  };

  /* 1. The situation: same code, fewer leaks caught, and the January data cannot be retrained on. */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Yes: check out January's commit in git and run train.py again",
      "Not reliably: git never stored the repair file, so the folder only holds today's version of it",
      "Yes: the training has a fixed seed, so the same code gives the same model"
    ];
    const paint = () => {
      el.innerHTML = `<h1>Same code, fewer leaks caught</h1>
        <p class="lead">A water utility ranks its pipes by leak risk. Each month a crew can inspect the ${TOP_K} pipes the model ranks highest. The model learns from last year's pipe-repair log, a CSV with one row per repair job. (The utility and its data are made up for this lesson; the training runs are real.)</p>
        <p class="lead">In January the model's top ${TOP_K} held <b>${caught("jan")}</b> pipes that really leaked. In March the team retrained it, and the top ${TOP_K} held only <b>${caught("mar")}</b>. Nobody touched <code>train.py</code>. The repair log changes often, so it sits in the project folder but is listed in <code>.gitignore</code>: git never stores it.</p>
        <p class="task">Can the team retrain the January model today, to see what changed?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. Git can bring back January's <code>train.py</code>, but it never saw the repair log. Whatever file sits in the folder today is what the model trains on. Code has a version; the data has none. So "same code, different score" cannot be checked. This lesson gives the data a version, kept next to the code, so any past model can be rebuilt and checked.`, true)
          : ans === 0 ? kit.feedback(`Git brings back January's code. But the repair log is in <code>.gitignore</code>, so git never stored it and does not touch it. The folder still holds the March file, and the "January" model would catch ${caught("mar")} again.`, false)
          : kit.feedback(`A seed only fixes the random choices. Same seed with different data gives a different model. This model has no randomness at all (its weights start at zero) and still moved from ${caught("jan")} to ${caught("mar")}. Something in the input changed.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. By hand: diff two snapshots, then say which change moved the score. */
  function byHand({ el, done, kit }) {
    style();
    const found = new Set();
    let miss = null, cause = null;
    const CAUSES = [
      `The note on ${JAN_ROWS[0][0]} changed from "joint lek" to "joint leak"`,
      `Jobs within a week of an earlier job on the same pipe were deleted, so pipes ${JAN_ROWS[2][1]} and ${JAN_ROWS[7][1]} went from ${repairs(JAN_ROWS, JAN_ROWS[2][1])} repairs to ${repairs(MAR_ROWS, JAN_ROWS[2][1])}`,
      `Pipe ${JAN_ROWS[3][1]} has ${repairs(JAN_ROWS, JAN_ROWS[3][1])} repairs in both files, so it is the problem`
    ];
    const paint = () => {
      const all = DIFFERS.every(i => found.has(i));
      el.innerHTML = `<h1>Find what the cleaning changed</h1>
        <p class="lead">Luckily, an analyst kept a copy of the January file. The model counts each pipe's repair jobs in the log; more repairs last year means more risk. Below is every row for ${WORDS[SHOWN_PIPES.length].toLowerCase()} pipes, in both versions.</p>
        <p class="task">${all ? "Now: which change moved the score?" : "Tap every January row that is missing or different in March."}</p>
        <p class="${P}lab">January file (${SNAP.jan.rows} rows in all)</p>
        <div class="${P}rows">${JAN_ROWS.map((r, i) => rowBox(r, { i, pick: !all && !found.has(i), cls: found.has(i) ? "ok" : miss === i ? "no" : "" })).join("")}</div>
        <p class="${P}lab">March file (${SNAP.mar.rows} rows in all)</p>
        <div class="${P}rows">${MAR_ROWS.map(r => rowBox(r)).join("")}</div>
        <div class="lpanel">${miss != null ? kit.feedback(`${esc(JAN_ROWS[miss][0])} is in the March file with the same pipe, date and note. Compare it field by field: nothing changed.`, false)
          : all ? kit.feedback(`All ${DIFFERS.length} found: one note fixed, ${DIFFERS.length - 1} rows deleted. Someone treated two jobs on the same pipe within a week as a duplicate.`) : found.size ? kit.feedback(`${DIFFERS.length - found.size} more.`) : ""}
        ${all ? `<div id="c1">${kit.options(CAUSES.map(esc), { picked: cause, correct: 1 })}
          ${cause == null ? "" : cause === 1 ? kit.feedback(`Right. Those were not duplicates. Most were repairs that failed again within days. In this data, that is the strongest sign a pipe will leak again. The model reads only the repair count per pipe, age and material, never the note. Across the whole file, the diff found ${DIFF_REMOVED.length} deleted rows and ${DIFF_CHANGED.length} changed one. ${WORDS[FELL_OUT.length]} pipes fell out of the top ${TOP_K}; ${LOST_LEAKS.length} of them (${LOST_LEAKS.join(", ")}) really leaked in 2026, and the ${CAME_IN.length} that came in did not. ${caught("jan")} became ${caught("mar")}.`, true)
            : cause === 0 ? kit.feedback(`The model never reads the note column: it counts repairs per pipe. ${JAN_ROWS[0][1]} has ${repairs(JAN_ROWS, JAN_ROWS[0][1])} repair in both files. A harmless fix, but it did make the file different.`, false)
            : kit.feedback(`${JAN_ROWS[3][1]}'s rows are identical in both files, so its count did not change. It is in both top-${TOP_K} lists. Look at the pipes whose counts changed.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (DIFFERS.includes(i)) { found.add(i); miss = null; } else miss = i;
        paint();
      });
      el.querySelectorAll("#c1 .lopts button").forEach(x => x.onclick = () => { cause = +x.dataset.i; paint(); if (cause === 1) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: a version of data is its bytes; tie a fingerprint to the commit. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Put the month in the file name: pipe_repairs_2026-01.csv",
      "Compute a fingerprint of the file's bytes, commit that fingerprint next to the code, and keep every version stored under its fingerprint",
      "Copy the file into a backup folder on the day of each release"
    ];
    const paint = () => {
      el.innerHTML = `<h1>What makes data come back exactly?</h1>
        <p class="lead">You found the cause only because someone happened to keep a copy. Next time, the team wants any past model's commit to bring back the exact file it trained on.</p>
        <p class="task">Which rule guarantees that?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. A <b>hash</b> function such as MD5 turns a file's bytes into a short fixed-length string: its fingerprint. Change one byte and the hash changes; the same bytes always give the same hash. Commit that hash with <code>train.py</code>, and the commit names its data exactly. Keep each version in a store where its file name <i>is</i> its hash (a <b>content-addressed</b> store), and the hash always leads back to the bytes.`, true)
          : ans === 0 ? kit.feedback(`A name is a label, not the content. The March cleaning edited the file in place and kept its name. A date in the name would have stayed "2026-01" after the cleaning, and promised the wrong thing.`, false)
          : kit.feedback(`A backup folder is not tied to the commit: which copy trained which model? Someone can overwrite a copy, or copy the wrong day. The link must be in the commit itself, and it must change when a byte changes.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Predict fingerprints: what changes the hash and what does not. */
  function fingerprints({ el, done, kit }) {
    style();
    const ans = VARIANTS.map(() => null);
    const right = VARIANTS.map(v => v.md5 === SNAP.jan.md5 ? 0 : 1);
    const why = [
      "Same bytes, so the same MD5. The hash never sees the file name. A store keyed by hash keeps this file once, however many names point at it.",
      `Adding one letter made the file ${VARIANTS[1].size - SNAP.jan.size} byte longer, and the MD5 is completely different, not slightly different. A harmless fix still makes a new version.`,
      "Same rows, same size, different order of bytes, so a different MD5. The hash checks bytes, not meaning: a sorted copy counts as a new version.",
      "Rows were deleted and a note changed, so the bytes differ and so does the MD5."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Predict the fingerprint</h1>
        <p class="lead">We ran Python's <code>hashlib.md5</code> on the January file and on ${WORDS[VARIANTS.length].toLowerCase()} variants of it. The January file gives <code>${SNAP.jan.md5}</code> (${SNAP.jan.size} bytes).</p>
        <p class="task">For each variant, predict: same MD5 as the January file, or different? Pick again if you change your mind.</p>
        ${VARIANTS.map((v, i) => `<div class="${P}case" id="c${i}"><p>${v.what}</p>${kit.options(["Same MD5", "Different MD5"], { picked: ans[i], correct: right[i] })}${ans[i] == null ? ""
          : kit.feedback(`${ans[i] === right[i] ? "" : "Not quite. "}Real run: <code>${v.md5}</code>, ${v.size} bytes. ${why[i]}`, ans[i] === right[i])}</div>`).join("")}
        <p class="${P}cap">From hashes.py, run ${RUN_DATE}.</p>`;
      el.querySelectorAll(`.${P}case`).forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (VARIANTS.every((_, j) => ans[j] === right[j])) done();
      }));
    };
    paint();
  }

  /* 5. From scratch: snapshot() stepped from a real trace; predict the branch on the second January call. */
  const FR = [];
  CALLS.forEach((c, ci) => c.steps.forEach(([ln, ev], k) => FR.push({ ci, k, ln, ev })));
  function fromScratch({ el, done, kit }) {
    style();
    let i = 0, pred = null;
    const PRED = ["Copy the file into the cache again", "Skip the copy: a file with that name is already in the cache", "Overwrite January's cache file with a fresh copy"];
    const paint = () => {
      const f = FR[i], c = CALLS[f.ci], steps = c.steps, seen = steps.slice(0, f.k).map(s => s[0]);
      const digest = seen.includes(2) ? c.md5 : null;
      const stored = seen.includes(3) ? `cache/${c.md5.slice(0, 2)}/${c.md5.slice(2)}` : null;
      const cache = f.ci === 0 ? (seen.includes(6) ? [c.md5] : []) : c.before;
      const ptr = seen.includes(8) ? c.md5 : c.ptrBefore;
      const needPred = f.ci === 1 && f.k === 0 && pred !== 1;
      const last = i === FR.length - 1;
      const say = f.ev === "r" ? (f.ci === 0
          ? `Returns <code>${short(c.md5)}</code>. The cache holds one file, named by its hash, and the pointer says which one. (Call 2, not shown, stored the March file the same way: the cache gained <code>${short(SNAP.mar.md5)}</code>.)`
          : `Returns the January hash. The cache still holds ${c.before.length} files: nothing was copied. The pointer now says January again. Going back is the reverse: <code>restore()</code> reads the pointer and copies the cache file over the data file. In our run the file's MD5 went from <code>${short(RESTORE.before)}</code> to <code>${short(RESTORE.after)}</code>.`)
        : f.ln === 1 ? "Read the whole file as bytes."
        : f.ln === 2 ? "Hash the bytes: 32 hex characters."
        : f.ln === 3 ? "The cache path is the hash itself: the first 2 characters as a folder, the rest as the file name."
        : f.ln === 4 ? (f.ci === 0 ? "Is there already a file at that path? The cache is empty, so no." : "Is there already a file at that path? Yes: call 1 stored it.")
        : f.ln === 5 ? "Make the folder."
        : f.ln === 6 ? "Copy the data into the cache under its hash."
        : f.ln === 7 ? (seen.includes(8) ? "The with block closes the pointer file." : "Open the pointer file, next to the data file.")
        : f.ln === 8 ? "Write the hash into it. This small file is what git commits, not the data."
        : f.ln === 9 ? "Return the hash." : "";
      el.innerHTML = `<h1>Snapshots from scratch, in Python</h1>
        <p class="lead">Our run called <code>snapshot("data/pipe_repairs.csv", "cache")</code> three times: on the January file, on the March file, then on the January file again. Each call hashes the file (<code>digest</code> is the hash), copies it into <code>cache/</code> under that hash, and writes the hash into a small <b>pointer</b> file, <code>pipe_repairs.csv.ptr</code>. Here are calls 1 and 3, replayed line by line.</p>
        <p class="task">${needPred ? "Call 3 hashes the January file again. Predict what happens at line 4, then step." : `Step through to the end. Call ${f.ci === 0 ? 1 : 3}: ${esc(c.name)}.`}</p>
        <div class="${P}wrap">${kit.code(CODE.map(l => l.replace(/^ +/, m => "\u00a0".repeat(m.length))), f.ln)}</div>
        <div class="vars"><span>digest <b>${digest ? short(digest) : "–"}</b></span><span>stored <b>${stored ? esc(stored.slice(0, 12) + "…") : "–"}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        <div class="${P}box"><div><b>cache/</b>${cache.length ? cache.map(h => esc(`${h.slice(0, 2)}/${h.slice(2, 10)}…`)).join("<br>") : "empty"}</div><div><b>pipe_repairs.csv.ptr</b>${ptr ? esc(short(ptr)) : "not written yet"}</div></div>
        ${needPred || (f.ci === 1 && f.k === 0) ? `<div id="pq">${kit.options(PRED.map(esc), { picked: pred, correct: 1 })}${pred == null ? "" : pred === 1
          ? kit.feedback("Right. Same bytes, same hash, same path: the cache already has it. Stored once, however many times you snapshot it.", true)
          : kit.feedback(pred === 0 ? "The path is the hash, and the January bytes have the same hash as in call 1. That path already exists, so line 4's test fails and lines 5 and 6 are skipped." : "Overwriting would write the same bytes over themselves: same hash, same content. The code checks first and skips.", false)}</div>` : ""}
        ${kit.feedback(say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || needPred ? "disabled" : ""}>Next step</button></div>`;
      el.querySelectorAll("#pq .lopts button").forEach(x => x.onclick = () => { pred = +x.dataset.i; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. The real tool: a DVC session in three predictions. */
  function withDvc({ el, done, kit }) {
    style();
    const ans = [null, null, null];
    const Q = [
      { q: "DVC has hashed the file and stored it in its cache. Which files do you commit to git?",
        opts: ["data/pipe_repairs.csv itself", "data/pipe_repairs.csv.dvc and data/.gitignore", "Everything in .dvc/cache"], right: 1,
        no: ["That is the big file the team wants out of git. DVC just added it to <code>data/.gitignore</code> so git will skip it.", "", "The cache is the store of every version. It stays out of git; it is shared through a DVC remote instead (below)."] },
      { q: "In March the colleague overwrites data/pipe_repairs.csv with the cleaned file. What does dvc status say?",
        opts: ["Data and pipelines are up to date.", "modified: data/pipe_repairs.csv", "deleted: data/pipe_repairs.csv"], right: 1,
        no: ["DVC hashes the file in the folder and compares it with the md5 in the .dvc file. The bytes changed, so they no longer match.", "", "The file is still there, with the same name. Only its bytes changed."] },
      { q: "After the second dvc add and commit, how many files are in .dvc/cache?",
        opts: ["1: DVC replaced the old version", "2: one per version, each stored whole", "1, plus a small file holding only the changed rows"], right: 1,
        no: ["Then git's January commit would point at a hash nobody has any more, and going back would be impossible.", "", "DVC stores whole files by their hash; it does not keep row-level changes. Our cache held two full files."] }
    ];
    const paint = () => {
      const ok = k => ans[k] === Q[k].right;
      const block = (k, after) => `<div class="${P}case" id="q${k}"><p class="task">${esc(Q[k].q)}</p>${kit.options(Q[k].opts.map(esc), { picked: ans[k], correct: Q[k].right })}
        ${ans[k] == null ? "" : ok(k) ? after : kit.feedback(Q[k].no[ans[k]], false)}</div>`;
      el.innerHTML = `<h1>The same idea with DVC</h1>
        <p class="lead"><b>DVC</b> (Data Version Control) is an open-source tool that does what your <code>snapshot()</code> did, next to git. We ran it on this project. <code>dvc init</code> sets it up; <code>dvc add &lt;file&gt;</code> hashes the file, stores it in the cache <code>.dvc/cache</code> and writes a small <code>.dvc</code> file.</p>
        ${term(T_ADD, false)}
        ${block(0, `${kit.feedback("Right. The .dvc file is DVC's pointer file, like your <code>.ptr</code>. It holds the hash (<code>md5</code>), the <code>size</code> and the <code>path</code>, and git commits it with the code. Below, <code>git tag jan-model</code> names the January model's commit.", true)}${term(T_FILES, false)}`)}
        ${ok(0) ? block(1, `${kit.feedback("Right. Then <code>dvc add</code> again stores the new version, and git sees the pointer change.", true)}${term([...T_STATUS, "", ...T_READD], false)}`) : ""}
        ${ok(1) ? block(2, `${kit.feedback(`Right. Both versions are in the cache, each under its hash, the same layout as your <code>cache/</code>: ${SNAP.jan.size} and ${SNAP.mar.size} bytes. Every commit can now get its data back.`, true)}${term(T_CACHE)}
          <p class="lead"><b>Not run by us.</b> Written from the <a href="https://doc.dvc.org/command-reference/push" target="_blank" rel="noopener">DVC documentation</a>, checked ${RUN_DATE}. Our cache lives on one laptop. To share it, you first add a remote (cloud storage or a shared folder) with <code>dvc remote add --default</code>. Then <code>dvc push</code> uploads data from the cache to that remote, and the .dvc files go up with <code>git push</code>. A teammate runs <code>git pull</code>, then <code>dvc pull</code>, which downloads the data into the cache and puts it in the folder.</p>`) : ""}`;
      el.querySelectorAll(`.${P}case`).forEach((c, k) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[k] = +b.dataset.i; paint();
        if (Q.every((q, j) => ans[j] === q.right)) done();
      }));
    };
    paint();
  }

  /* 7. Broken on purpose: back to January with git only. */
  function broken({ el, done, kit }) {
    style();
    let tap = null, found = false, fix = null;
    const WHY = {
      cmd: "That command did its job. Look at what the output says.",
      plain: "Normal output; nothing here contradicts anything else.",
      pointer: "This is correct: git restored January's pointer, so the commit asks for the January hash. The question is whether the file in the folder matches it.",
      symptom: "That is the symptom you already knew: the score did not come back. Find the line that shows why."
    };
    const FIXES = [
      "Run dvc checkout, so DVC copies the file matching the pointer from the cache into the folder",
      "Run dvc add data/pipe_repairs.csv, so DVC records the file",
      "Run git checkout jan-model again, then retrain"
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: January, but not quite</h1>
        <p class="lead">A month later, the team wants the January model back. A teammate checks out the January tag (the <code>-c advice.detachedHead=false</code> part only silences a git notice) and retrains. The score is still ${caught("mar")}. Below is the real session, from our run.</p>
        <div id="c0"><p class="task">${found ? "Found it." : "Tap the line that shows the cause."}</p>
        <div class="${P}term">${T_BROKEN.map(([l, k], i) => `<button type="button" class="${l.startsWith("$ ") ? "c " : ""}${found && (k === "cause" || k === "status") ? "ok" : tap === i ? "no" : ""}" data-i="${i}" ${found ? "disabled" : ""}>${esc(l)}</button>`).join("")}</div>
        <p class="${P}cap">Real output, DVC run on ${RUN_DATE} (dvc_run.out.txt).</p>
        ${found ? kit.feedback(`Right. The pointer asks for <code>${short(SNAP.jan.md5)}</code>, but train.py read a file whose MD5 is <code>${short(SNAP.mar.md5)}</code>: the March file. <code>git checkout</code> changed the .dvc file and left the data alone, because the data is in .gitignore. The last line, from <code>dvc status</code>, says the same: the file in the folder does not match the pointer.`, true)
          : tap != null ? kit.feedback(WHY[T_BROKEN[tap][1]], false) : ""}</div>
        ${found ? `<div class="${P}case" id="c1"><p class="task">Which command fixes it?</p>${kit.options(FIXES.map(esc), { picked: fix, correct: 0 })}
          ${fix == null ? "" : fix === 0 ? kit.feedback(`Right. <code>dvc checkout</code> reads every .dvc file and makes the folder match it from the cache. The DVC documentation also offers <code>dvc install</code>: git hooks that run <code>dvc checkout</code> after every <code>git checkout</code>, so nobody has to remember.`, true) + term(T_FIX)
            : fix === 1 ? kit.feedback(`That records the file in the folder, the March one, as current. The pointer would change to <code>${short(SNAP.mar.md5)}</code>, and the January tag would no longer describe this working copy. You want the data to follow the pointer, not the pointer to follow the data.`, false)
            : kit.feedback("Git already did all it can: it restored the pointer. It never touches files listed in .gitignore, so running it again changes nothing.", false)}</div>` : ""}`;
      el.querySelectorAll("#c0 button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (T_BROKEN[i][1] === "cause" || T_BROKEN[i][1] === "status") { found = true; tap = null; } else tap = i;
        paint();
      });
      el.querySelectorAll("#c1 .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a cost task. */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Storage: every daily version of the file is stored whole, in the cache and in the remote",
      "The git repository: it fills up with copies of the file",
      "Training time: DVC slows down reading the file"
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to version data, and what it costs</h1>
        <div class="${P}big"><ul>
          <li><b>For:</b> files a model trains on that change over time, when you must retrain, compare or explain a past model on exactly the data it saw.</li>
          <li><b>When not:</b> a small file that rarely changes (just commit it to git); data that lives in a database (DVC tracks files, so export a snapshot first); data you may have to delete on request (every version stays in the cache and remote until you remove it with <code>dvc gc</code>).</li>
          <li><b>Cost:</b> storage for each version; a remote to run; discipline: <code>dvc add</code> and <code>dvc push</code> after each change, <code>dvc checkout</code> after each <code>git checkout</code>.</li>
        </ul></div>
        <p class="task">A team keeps one large data file of meter readings. A few rows are corrected every day, and a job runs <code>dvc add</code> and <code>dvc push</code> every night. Which cost grows first?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0 ? kit.feedback(`Right. A few changed rows give a new hash, and a new hash is a new whole file, as in our run (${SNAP.jan.size} and ${SNAP.mar.size} bytes, two full copies). Fixes: snapshot only when you train, or split the data into many files so the unchanged ones keep their hash and are stored once.`, true)
          : ans === 1 ? kit.feedback("Git only gets the small .dvc file: a hash, a size and a path. It stays tiny however big the data is. The copies pile up in the DVC cache and remote instead.", false)
          : kit.feedback("Training reads an ordinary file in the folder. DVC is not involved while the model trains. The cost is in what is stored.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A bank's fraud model must be explained to an auditor: which transactions file trained the version that blocked a customer in May?", true,
      "Yes. The model's commit holds the .dvc pointer; git checkout of that commit plus dvc checkout brings back the exact file, and its hash proves it is the same.",
      "This is the leak model again: a past model, and the question of exactly which data it saw. A hash committed with the code answers it and brings the file back."],
    ["A 300-row CSV of country codes that the team edits twice a year.", false,
      "No. It is small text that rarely changes. Commit it to git directly: git keeps its versions and shows each edited line in a diff. DVC would add a cache, a remote and extra commands for nothing.",
      "DVC pays off for files too big or too busy for git. This one is tiny and changes twice a year: git versions it fine and shows line diffs, which DVC's whole-file hashes do not."],
    ["A support bot calls a hosted model. A user complaint asks which model and prompt answered last Tuesday.", false,
      "No. No dataset trained anything here. The question is about the model and the prompt in use: log the model name and prompt version with each request, and keep prompts in git.",
      "Versioning a training file answers \"what data did this model see?\". Nothing was trained on a dataset here. You need a log of which model and prompt version served each request."],
    ["Labellers add images to a training folder every week. Each month the model is retrained, and you must compare this month's model with last month's on last month's data.", true,
      "Yes. dvc add on the folder each month, commit the pointer with the training code, and any month's data comes back with its model.",
      "Each month's model must be tied to the folder exactly as it was. Versioning the folder with the code does that; a folder that only ever holds today's images cannot."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Version the data here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the water utility.</p>
        <p class="task">Decide for each: would you version the data with DVC? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="${P}case" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(`.${P}case`).forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook checklist. Done on entry. */
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    const CHECK = [
      `After <code>dvc add data/pipe_repairs.csv</code>, the new <code>data/pipe_repairs.csv.dvc</code> shows an <code>md5</code> line and <code>size: ${SNAP.jan.size}</code>, and <code>data/.gitignore</code> contains <code>/pipe_repairs.csv</code>.`,
      "After you overwrite the file with the cleaned version, <code>dvc status</code> reports <code>modified: data/pipe_repairs.csv</code>.",
      "After the second <code>dvc add</code>, <code>.dvc/cache/files/md5</code> holds 2 files, in folders named by the first two characters of each hash.",
      `After <code>git checkout jan-model</code> alone, <code>train.py</code> prints <code>data md5: ${short(SNAP.mar.md5)}</code> and ${caught("mar")} leaks caught; after <code>dvc checkout</code> it prints <code>${short(SNAP.jan.md5)}</code> and ${caught("jan")}.`
    ];
    el.innerHTML = `<h1>You can version data with its code</h1>
      <p class="lead">You diffed two snapshots and found which rows moved the score. You saw that a version of data is its bytes, built <code>snapshot()</code> from a hash and a content-addressed cache, did the same with DVC, and fixed a checkout that brought back the code but not the data.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook in Colab</a>` : "The notebook for this lesson is on its way"}. You run the same DVC session on the leak data. What you should see:</p>
      <ul class="${P}check">${CHECK.map(c => `<li><label><input type="checkbox"> <span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${esc(nx.title)}. Versioned data tells you what a model learned from; next you watch what a live AI feature is doing now.</p>` : ""}`;
    done();
  }

  // walk helpers
  const wrongRow = JAN_ROWS.findIndex((_, i) => !DIFFERS.includes(i));
  const causeLine = T_BROKEN.findIndex(r => r[1] === "cause");
  const symptomLine = T_BROKEN.findIndex(r => r[1] === "symptom");
  const walkCode = (() => {
    // the prediction sits at the first step of call 3: step there, pick wrong, then right, then step to the end
    const at = FR.findIndex(f => f.ci === 1 && f.k === 0);
    return { wrong: [...Array(at).fill("[data-next]"), "#pq [data-wrong]"], right: ["#pq [data-right]", ...Array(FR.length - 1 - at).fill("[data-next]")] };
  })();

  LessonKit.define(ID, {
    title: "Versioning datasets alongside code",
    checked: "2026-11-14",
    sources: [
      "https://doc.dvc.org/start",
      "https://doc.dvc.org/command-reference/add",
      "https://doc.dvc.org/command-reference/status",
      "https://doc.dvc.org/command-reference/checkout",
      "https://doc.dvc.org/command-reference/install",
      "https://doc.dvc.org/command-reference/push",
      "https://doc.dvc.org/command-reference/pull",
      "https://doc.dvc.org/command-reference/remote/add",
      "https://doc.dvc.org/command-reference/gc",
      "https://doc.dvc.org/user-guide/project-structure/internal-files",
      "https://docs.python.org/3/library/hashlib.html"
    ],
    interview: [{
      q: "A model retrained from the same commit catches fewer cases than the one in production, and nobody changed the code. How do you find out why, and how do you stop it happening again?",
      good: [
        "Suspect the data first: compare a hash of today's training file with what the old run used, then diff the two versions",
        "Retrain the old commit on its exact data to separate a data change from a code or randomness change",
        "Version the data next to the code: commit a hash pointer (a .dvc file) with each training commit and push the data to a shared remote",
        "Record the data hash in the experiment run or registry entry, so every model names its data",
        "Make cleaning a reviewed change with its own commit, not an edit in place"
      ],
      weak: "Blame the random seed or tune the model again, without checking whether the training file changed."
    }, {
      q: "Your training data is one very large file, and a few rows are corrected every day. A colleague wants a nightly job that runs dvc add and dvc push. What do you tell them?",
      good: [
        "DVC stores each version as a whole file under its hash, so every nightly change adds a full copy to the cache and the remote",
        "Snapshot when you train, not every night, unless you need every day back",
        "Split the data into many files (by month or region) so unchanged files keep their hash and are stored once",
        "Plan clean-up with dvc gc, and remember that deleting from the remote is irreversible"
      ],
      weak: "Agree, because DVC only stores the changes, like git does for code."
    }],
    screens: [situation, byHand, spotIdea, fingerprints, fromScratch, withDvc, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${wrongRow}"]`], right: [...DIFFERS.map(i => `[data-i="${i}"]`), "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: VARIANTS.map((_, i) => `#c${i} [data-right]`) },
      walkCode,
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: [`#c0 [data-i="${symptomLine}"]`], right: [`#c0 [data-i="${causeLine}"]`, "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
