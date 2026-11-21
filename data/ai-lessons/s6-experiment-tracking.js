/* Lesson: experiment tracking with MLflow.
   Story: a two-person team (Dilnoza and Sam) tunes a crop-yield predictor for a farm co-op and cannot say which of
   last week's runs was the good one. Ideas: (1) a run record (settings, named scores, its own copy of the model
   file, the code version) written by the training code itself, at run time, for every run; built from scratch as
   one JSON line per run; (2) the same with MLflow: log_params, log_metric with step, log_artifact, then compare with
   search_runs (filter_string, order_by). Big picture: when git tags and a sheet are enough.
   Data: every setting and score comes from docs/ai-path/runs/s6-experiment-tracking/ (train.py, messy_week.py and
   .out.txt, tracked_week.py and .out.txt, mlflow_week.py and .out.txt, env.txt). The team's notes, chat lines, names
   and file times are written for the lesson; the scores quoted in them are computed here from the run data.
   No recorded model calls. Lesson-local pieces: a multi-column table helper, a "scrap" button list and a note box,
   with their own CSS (the shared table has two columns only). */
(() => {
  const ID = "s6-experiment-tracking", P = `lx-${ID}-`;
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s6-experiment-tracking.ipynb";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const r2 = x => x.toFixed(2);
  const r4 = x => String(Math.round(x * 1e4) / 1e4);
  const big = x => { const e = Math.floor(Math.log10(x)); return `${(x / 10 ** e).toFixed(1)} × 10<sup>${e}</sup>`; };
  const score = x => x > 1e6 ? big(x) : r4(x);

  /* ---------- Data from tracked_week.out.txt (runs.jsonl); messy_week.out.txt has the same numbers ---------- */
  const RUNS = [
    { id: "run1", lr: 0.01, epochs: 50, features: ["rain", "fertiliser"], train: 1.5059, val: 1.3669 },
    { id: "run2", lr: 0.01, epochs: 300, features: ["rain", "fertiliser"], train: 0.6412, val: 0.5725 },
    { id: "run3", lr: 0.1, epochs: 300, features: ["rain", "fertiliser"], train: 0.6411, val: 0.5743 },
    { id: "run4", lr: 0.1, epochs: 300, features: ["rain", "fertiliser", "soil"], train: 0.4141, val: 0.3984 },
    { id: "run5", lr: 0.1, epochs: 300, features: ["rain", "fertiliser", "temp", "soil"], train: 0.3735, val: 0.3552 },
    { id: "run6", lr: 1.2, epochs: 300, features: ["rain", "fertiliser", "temp", "soil"], train: 7.281440355973047e+93, val: 6.322268025602195e+93 }
  ];
  // messy_week.py: the file name each run was saved under, in order (the last three are the same name)
  const SAVED_AS = ["yield_model.npz", "yield_model_v2.npz", "yield_model_lr01.npz", "yield_model_final.npz", "yield_model_final.npz", "yield_model_final.npz"];
  const BEST = RUNS.filter(r => r.val < 1e6).reduce((a, b) => (b.val < a.val ? b : a));
  const BI = RUNS.indexOf(BEST);
  const LAST_FINAL = SAVED_AS.lastIndexOf("yield_model_final.npz");
  const feat = r => r.features.join(", ");

  /* ---------- Lesson-local CSS and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}scroll { max-width: 100%; overflow-x: auto; }
      .${P}t { font: 500 14px/1.45 var(--mono); min-width: 0; width: 100%; margin-top: 16px; }
      @media (max-width: 640px) { .${P}t { font-size: 12.5px; } .${P}t td, .${P}t th { padding-right: 8px !important; } }
      .${P}t th { padding: 4px 14px 6px 8px; font-size: 13px; white-space: nowrap; }
      .${P}t td { padding: 6px 14px 6px 8px; vertical-align: top; overflow-wrap: break-word; }
      .${P}t td.${P}q { color: var(--muted); }
      .${P}t tr.${P}best td { background: var(--good-soft); color: var(--good); font-weight: 700; }
      .${P}scraps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
            .${P}scraps button { min-width: 0; overflow-wrap: anywhere; min-height: 48px; padding: 9px 12px; text-align: left; border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 10px; cursor: pointer; font: 600 15px/1.35 var(--font); }
      @media (max-width: 640px) { .${P}scraps button { font-size: 13.5px; padding: 8px 10px; } }
      .${P}scraps button small { display: block; font: 500 12.5px/1.4 var(--mono); color: var(--muted); }
      .${P}scraps button.${P}read { border-color: var(--ink); background: var(--surface); }
      .${P}note { margin: 12px 0 0; padding: 9px 12px; border-left: 3px solid var(--line); background: var(--sunk); font: 500 14px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}nb { min-height: 44px; margin-top: 4px; }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { display: flex; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line); }
    `;
    document.head.appendChild(s);
  }
  // a table with any number of columns; cells are escaped unless given as { html }
  function grid(kit, head, rows, { title = "", best = -1, q = () => false } = {}) {
    const cell = c => (c && typeof c === "object" ? c.html : kit.esc(c));
    return `<div class="${P}scroll"><table class="ltable ${P}t">${title ? `<caption>${kit.esc(title)}</caption>` : ""}
      <thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r, i) => `<tr${i === best ? ` class="${P}best"` : ""}>${r.map((c, j) => `<td${q(i, j, c) ? ` class="${P}q"` : ""}>${cell(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  /* 1. The situation, by hand: read the folder and piece last week together. */
  const SCRAPS = [
    { label: "notes.txt, Monday", by: "Dilnoza", text: `Mon. lr ${RUNS[0].lr}, rain + fertiliser. ${RUNS[0].epochs} epochs: ${r2(RUNS[0].val)}, too few. ${RUNS[1].epochs} epochs: val ${r2(RUNS[1].val)}. Saved as v2.`,
      row: ["Mon", `lr ${RUNS[1].lr} · ${RUNS[1].epochs} epochs · rain, fertiliser`, `val ${r2(RUNS[1].val)}`, "yield_model_v2.npz"] },
    { label: "team chat, Tuesday", by: "Sam", text: `tried lr ${RUNS[2].lr}, no better: ${r2(RUNS[2].train)}. saved it as yield_model_lr01`,
      row: ["Tue", `lr ${RUNS[2].lr} · ? epochs · ? columns`, `${r2(RUNS[2].train)} (on which rows?)`, "yield_model_lr01.npz"] },
    { label: "notes.txt, Wednesday", by: "Dilnoza", text: `Wed. added soil -> ${r2(RUNS[3].val)}!! saved as final`,
      row: ["Wed", "lr ? · ? epochs · soil added to ?", `${r2(RUNS[3].val)} (on which rows?)`, "yield_model_final.npz"] },
    { label: "team chat, Thursday", by: "Sam", text: `with temp as well I get ${r2(RUNS[4].val)}`,
      row: ["Thu", "lr ? · ? epochs · temp added too", `${r2(RUNS[4].val)} (on which rows?)`, "?"] },
    { label: "yield_model.npz", by: "changed Mon 10:12", text: "A NumPy file of weights: four arrays named w, b, mean and std. Nothing inside says which settings made them, and no note mentions this file." },
    { label: "yield_model_v2.npz", by: "changed Mon 11:40", text: "Weights only. Monday's note says it is the 300-epoch run." },
    { label: "yield_model_lr01.npz", by: "changed Tue 15:03", text: "Weights only. Does lr01 mean 0.1 or 0.01? Tuesday's chat says 0.1." },
    { label: "yield_model_final.npz", by: "changed Fri 17:05", text: "Weights only. It was changed on Friday afternoon, and nobody wrote anything on Friday.",
      row: ["Fri", "no note", "?", "yield_model_final.npz changed"] }
  ];
  function messyFolder({ el, done, kit }) {
    ensureStyle();
    const read = new Set();
    let open = null, ans = null;
    const opts = [
      `yield_model_final.npz: Thursday's run, with temp, ${r2(RUNS[4].val)}`,
      `yield_model_final.npz: Wednesday's run, with soil, ${r2(RUNS[3].val)}`,
      `yield_model_v2.npz: lr ${RUNS[1].lr}, ${RUNS[1].epochs} epochs, the one run with full notes`,
      "Nobody can say from this folder"
    ];
    const RIGHT = 3;
    const paint = () => {
      const all = read.size === SCRAPS.length;
      const rows = SCRAPS.map((s, i) => (read.has(i) && s.row ? s.row : null)).filter(Boolean);
      const say = ans == null ? ""
        : ans === RIGHT ? (all
          ? kit.feedback(`Right. Nobody can say. Thursday's ${r2(RUNS[4].val)} has no learning rate, no epochs and no file. Wednesday's run went into <code>final</code>, but <code>final</code> changed on Friday with no note, so nobody knows what it holds now. ${WORDS[SCRAPS.filter(x => x.row && x.row[2].includes("on which rows")).length]} of the ${WORDS[SCRAPS.filter(x => x.row && x.row[2] !== "?").length].toLowerCase()} scores do not say which rows they were measured on, so you cannot even be sure they compare. And <code>lr01</code> could mean two different learning rates.`, true)
          : kit.feedback(`Read every note and file first (${read.size} of ${SCRAPS.length} so far), then decide.`))
        : ans === 0 ? kit.feedback(`Thursday's chat line names no file. The run might have gone into <code>final</code>, but <code>final</code> changed again on Friday afternoon, and nobody wrote down what Friday's run was. Handing over <code>final</code> is a guess.`, false)
        : ans === 1 ? kit.feedback(`Wednesday's run did go into <code>final</code>. But the file changed again on Friday, after Wednesday's note. Whatever is in it now, it is not known to be Wednesday's model.`, false)
        : kit.feedback(`<code>v2</code> is the one file whose settings you know, but its val ${r2(RUNS[1].val)} is not the best score in the notes. The co-op asked for the good one, and you would be shipping a weaker model just because it was written down.`, false);
      el.innerHTML = `<h1>Which run was the good one?</h1>
        <p class="lead">Dilnoza and Sam are tuning a crop-yield predictor for a farm co-op. It reads rain, fertiliser, temperature and a soil score for a field, and predicts tonnes per hectare. Each training run has settings: the learning rate (lr, the step size), the number of epochs (passes over the data) and the input columns. Each run gets an error score. "val" means the score was measured on validation rows, rows the model did not train on. Lower error is better. Last week they tried six settings. Today the co-op asks for the best model, and this is their folder.</p>
        <p class="task">Open every note and file. The table pieces the week together as you read. Then answer: which file holds the best model, and with which settings?</p>
        <div class="${P}scraps">${SCRAPS.map((s, i) => `<button type="button" data-i="${i}" class="${read.has(i) ? P + "read" : ""}" aria-pressed="${open === i}">${kit.esc(s.label)}<small>${kit.esc(s.by)}</small></button>`).join("")}</div>
        ${open == null ? "" : `<div class="${P}note">${kit.esc(SCRAPS[open].text)}</div>`}
        ${rows.length ? grid(kit, ["day", "settings", "score", "file"], rows.map(r => r.map((c, j) => (j === 3 ? { html: kit.esc(c).replace(/_/g, "_<wbr>"), q: c.includes("?") } : c))), { title: "Last week, pieced together", q: (i, j, c) => (c && typeof c === "object" ? c.q : String(c).includes("?")) }) : `<p class="${P}cap">Nothing pieced together yet.</p>`}
        <p class="${P}cap">The notes, chat, names and times are written for this lesson. Every score in them comes from a real run of the team's training script.</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: RIGHT })}${say}</div>`;
      el.querySelectorAll(`.${P}scraps button`).forEach(b => b.onclick = () => { open = +b.dataset.i; read.add(open); paint(); if (ans === RIGHT && read.size === SCRAPS.length) done(); });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT && read.size === SCRAPS.length) done(); });
    };
    paint();
  }

  /* 2. What a record of one run needs: pick the pieces. */
  const PIECES = [
    { t: "The settings: learning rate, epochs, which columns", need: true, say: "Without them, Thursday's run cannot be repeated." },
    { t: "Every score with its name and the rows it was measured on, like val_rmse (the typical miss on the validation rows)", need: true, say: `A bare number like ${r2(RUNS[2].train)} cannot be compared with another bare number.` },
    { t: "A copy of the model file that belongs to this run only", need: true, say: "A shared name like final gets overwritten." },
    { t: "The code version: the git commit the script ran from", need: true, say: "The same settings in changed code are a different run." },
    { t: "A file name that says final", need: false, say: "final is a claim, not a record. Last week's final was overwritten on Friday, and nothing says by what. A name cannot hold the settings and scores either." },
    { t: "Only the runs that went well", need: false, say: "Friday's run is the one that changed final, and nobody wrote it down. A failed run also tells the team what not to try again. Keep every run." },
    { t: "A screenshot of the terminal after each run", need: false, say: "It holds the score, but you cannot search or sort screenshots, and someone has to remember to take one. Settings that were never printed are not in it." }
  ];
  function recordPieces({ el, done, kit }) {
    ensureStyle();
    const picked = new Set();
    let last = null;
    const NEED = PIECES.filter(p => p.need).length;
    const paint = () => {
      const fin = picked.size === NEED;
      el.innerHTML = `<h1>What should a record of one run hold?</h1>
        <p class="lead">Before a model ships, someone must be able to say which run made it. The team agrees: from now on, every run gets a record, so that next week anyone can answer "which settings gave the best score, and where is that model?"</p>
        <p class="task">Tap each thing the record of one run must hold. Leave out what does not help.</p>
        <div class="lopts">${PIECES.map((p, i) => `<button type="button" data-i="${i}" class="${picked.has(i) ? "right" : last === i && !p.need ? "wrong" : ""}" aria-pressed="${picked.has(i)}">${kit.esc(p.t)}</button>`).join("")}</div>
        <div class="lpanel">${last == null ? ""
          : !PIECES[last].need ? kit.feedback(kit.esc(PIECES[last].say), false)
          : fin ? kit.feedback(`That is the record: settings, named scores, its own model file, the code version. One more belongs in it later: which version of the data the run saw. A later lesson in this unit covers that.`, true)
          : kit.feedback(`${kit.esc(PIECES[last].say)} ${NEED - picked.size} more to find.`)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        last = i;
        if (PIECES[i].need) picked.add(i);
        paint();
        if (picked.size === NEED) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: who writes the record, and when. */
  function spotIdea({ el, done, kit }) {
    let ans = null;
    const opts = [
      "Each person adds a line to a shared sheet at the end of the day",
      "The training script writes it itself, the moment each run ends, for every run",
      "Whoever gets a new best score writes it down"
    ];
    const RIGHT = 1;
    const paint = () => {
      el.innerHTML = `<h1>Who writes the record, and when?</h1>
        <p class="lead">You know what one record holds. Last week, people wrote notes when they remembered, and the notes had holes.</p>
        <p class="task">Which habit makes the records complete every time?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: RIGHT })}
        ${ans == null ? "" : ans === RIGHT
          ? kit.feedback(`Right. The script already has every setting and every score in its variables, so it can write the record with no copying and no memory involved. It writes one for the bad runs too, like Friday's. This habit is <b>experiment tracking</b>. One execution of the training code is a <b>run</b>. The runs for one task, here the yield predictor, form an <b>experiment</b>.`, true)
          : ans === 0 ? kit.feedback(`That is last week again, with a nicer sheet. At the end of the day people copy numbers from memory or from old terminal windows. That is how Tuesday's score lost its row set and Thursday's lost its settings. Runs that went badly are the first ones skipped.`, false)
          : kit.feedback(`You only know a score is a new best by comparing it with every other run, so the other runs need records too. And Friday's run, the one that changed final, was not a best score, so under this rule nobody would write it down.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Use it, with predictions: the same six settings, logged by a small tracker. */
  function predictRuns({ el, done, kit }) {
    ensureStyle();
    const [r2run, r3run, r6run] = [RUNS[1], RUNS[2], RUNS[5]];
    const gap = Math.abs(r3run.val - r2run.val);
    const q0opts = [`${r3run.id} is clearly lower, by more than 0.05`, "About the same: within 0.01", `${r3run.id} is clearly higher, by more than 0.05`];
    const q0right = gap < 0.01 ? 1 : r3run.val < r2run.val ? 0 : 2;
    const q1opts = [`A val_rmse a little above ${BEST.id}'s`, "No line at all: the run crashed", "A val_rmse far too large to be real: training blew up"];
    const q1right = r6run.val > 1e6 ? 2 : 0;
    const ans = [null, null];
    const paint = () => {
      const show0 = ans[0] === q0right, show1 = ans[1] === q1right;
      // run2 and run3 open after the first prediction, every score after the second
      const rows = RUNS.map((r, i) => [r.id, String(r.lr), String(r.epochs), feat(r), { html: show1 || (show0 && (i === 1 || i === 2)) ? score(r.val) : "?" }]);
      el.innerHTML = `<h1>Six runs, six records</h1>
        <p class="lead">The team re-ran last week's six settings, in the same order, with a small tracker in the training script: one line per run in a file called <code>runs.jsonl</code>, plus a copy of each model file. The data and the random seed (the number that fixes every random choice) are the same, so the scores match last week's. val_rmse is in tonnes per hectare. The scores stay hidden until you predict.</p>
        ${grid(kit, ["run", "lr", "epochs", "columns", "val_rmse"], rows, { title: "runs.jsonl", best: show1 ? BI : -1, q: (i, j, c) => j === 4 && c.html === "?" })}
        <div class="lcase" id="q0"><p class="task">Tuesday's chat said lr ${r3run.lr} was "no better: ${r2(r3run.train)}". Monday's val score was ${r2(r2run.val)}. ${r3run.id} (lr ${r3run.lr}) and ${r2run.id} (lr ${r2run.lr}) use the same ${r2run.epochs} epochs and columns. Predict: how does ${r3run.id}'s val_rmse compare with ${r2run.id}'s?</p>
          ${kit.options(q0opts, { picked: ans[0], correct: q0right })}
          ${ans[0] == null ? "" : ans[0] === q0right
            ? kit.feedback(`Right: ${r4(r2run.val)} against ${r4(r3run.val)}, a gap of ${r4(gap)}. Tuesday's ${r2(r3run.train)} was ${r3run.id}'s <b>train</b> score (${r4(r3run.train)}), measured on the rows the model learned from. Compared with Monday's val score, it made lr ${r3run.lr} look worse than it is. The record names every score, so this mix-up cannot happen.`, true)
            : ans[0] === 0 ? kit.feedback(`A learning rate ${Math.round(r3run.lr / r2run.lr)} times larger is not a ${Math.round(r3run.lr / r2run.lr)} times better model. With ${r2run.epochs} epochs both runs have already reached about the same low point; the larger step only gets there sooner. On val the two score ${r4(r2run.val)} and ${r4(r3run.val)}, a gap of ${r4(gap)}.`, false)
            : kit.feedback(`Tuesday's note compared ${r2(r3run.train)} with ${r2(r2run.val)}, and that difference is real, but the two numbers measure different rows: ${r2(r3run.train)} is ${r3run.id}'s train score. On the same val rows, the two runs score ${r4(r2run.val)} and ${r4(r3run.val)}.`, false)}</div>
        ${show0 ? `<div class="lcase" id="q1"><p class="task">${r6run.id} used lr ${r6run.lr}, ${Math.round(r6run.lr / BEST.lr)} times larger than ${BEST.id}'s ${BEST.lr}, with the same ${r6run.epochs} epochs and columns. What does its line in <code>runs.jsonl</code> show?</p>
          ${kit.options(q1opts, { picked: ans[1], correct: q1right })}
          ${ans[1] == null ? "" : ans[1] === q1right
            ? kit.feedback(`Right: val_rmse ${big(r6run.val)} tonnes per hectare. Each step overshot further than the last, and the error grew instead of shrinking. This was Friday's run, and last week it was saved as <code>${SAVED_AS[LAST_FINAL]}</code> on top of Thursday's. The best model is <b>${BEST.id}</b> (lr ${BEST.lr}, ${BEST.epochs} epochs, ${feat(BEST)}), val_rmse ${r4(BEST.val)}, and this time its own copy is kept: <code>runs/${BEST.id}/model.npz</code>.`, true)
            : ans[1] === 0 ? kit.feedback(`A step size that large makes gradient descent jump past the low point each time, further each time, so the error grows instead of settling. It does not land near ${BEST.id}.`, false)
            : kit.feedback(`The script did not crash. NumPy kept going with ever larger numbers and the run finished. The tracker writes a line for every run that ends, good or bad.`, false)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach(c => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        const k = c.id === "q0" ? 0 : 1;
        ans[k] = +b.dataset.i; paint();
        if (ans[0] === q0right && ans[1] === q1right) done();
      }));
    };
    paint();
  }

  /* 5. The tracker from scratch, as a recorded run (the trace of the 5th call in tracked_week.py). */
  const CODE1 = [
    "def log_run(params, metrics, model_file):",
    '    run_id = f"run{len(read_runs()) + 1}"',
    '    folder = os.path.join("runs", run_id)',
    "    os.makedirs(folder)",
    "    kept = shutil.copy(model_file, folder)",
    '    record = {"run_id": run_id, "params": params,',
    '              "metrics": metrics, "model_file": kept}',
    '    with open("runs.jsonl", "a") as f:',
    '        f.write(json.dumps(record) + "\\n")',
    "    return run_id"
  ];
  // tracked_week.out.txt, "step" lines: line numbers and variables as traced. Kept: steps 1-5, 8, 9, 11, 12.
  // Left out: two steps where Python revisits lines 5-6 of the two-line dict, and one where it leaves the with block.
  const TRACED_N = 5; // tracked_week.py traces the 5th call of log_run
  const REC5 = { run_id: "run5", params: { lr: 0.1, epochs: 300, features: ["rain", "fertiliser", "temp", "soil"] }, metrics: { train_rmse: 0.3735, val_rmse: 0.3552 }, model_file: "runs/run5/model.npz" };
  const TRACE = [
    { line: 1, vars: {} },
    { line: 2, vars: { run_id: "run5" } },
    { line: 3, vars: { run_id: "run5", folder: "runs/run5" } },
    { line: 4, vars: { run_id: "run5", folder: "runs/run5" } },
    { line: 5, vars: { run_id: "run5", folder: "runs/run5", kept: "runs/run5/model.npz" } },
    { line: 7, vars: { run_id: "run5", folder: "runs/run5", kept: "runs/run5/model.npz", record: REC5 } },
    { line: 8, vars: { run_id: "run5", folder: "runs/run5", kept: "runs/run5/model.npz", record: REC5 } },
    { line: 9, vars: { run_id: "run5", folder: "runs/run5", kept: "runs/run5/model.npz", record: REC5 } },
    { line: 9, ret: true, vars: { run_id: "run5", folder: "runs/run5", kept: "runs/run5/model.npz", record: REC5 } }
  ];
  const SAY5 = [
    `Training run 5 has finished. The script calls <code>log_run</code> with its settings, its two named scores and the file <code>model.npz</code>, the same file name every run uses. <code>runs.jsonl</code> already holds ${TRACED_N - 1} lines. <code>read_runs()</code>, a helper in the same script, reads <code>runs.jsonl</code> back as a list, one record per line.`,
    `${TRACED_N - 1} lines so far, so this is <code>run5</code>. Every run gets its own id.`,
    `The run gets its own folder, <code>runs/run5</code>.`,
    `The folder now exists on disk.`,
    `<code>model.npz</code> is copied into the run's folder. The next run will overwrite <code>model.npz</code>, but not this copy. This is the line that would have saved Thursday's model.`,
    `The record holds everything from screen 2 except the code version: id, settings, named scores, and where its model copy lives.`,
    `Open <code>runs.jsonl</code> to add to the end ("a" means append). Old lines are never rewritten.`,
    `One JSON line is written, as below. Any tool, a person, or a spreadsheet import can read it later.`,
    `<code>log_run</code> returns <code>"run5"</code>. Finding the best run is now one line: <code>min(read_runs(), key=lambda r: r["metrics"]["val_rmse"])</code>, and the run printed it: <code>${BEST.id}</code>.`
  ];
  const LINE5 = `{"run_id": "run5", "params": {"lr": 0.1, "epochs": 300, "features": ["rain", "fertiliser", "temp", "soil"]}, "metrics": {"train_rmse": 0.3735, "val_rmse": 0.3552}, "model_file": "runs/run5/model.npz"}`;
  function fromScratch({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = TRACE[i], v = f.vars;
      const wrote = i >= 7;
      el.innerHTML = `<h1>A tracker in ten lines</h1>
        <p class="lead">This is the function the team called after each run. It is plain Python: no library, just a folder per run and one JSON line per run. The steps replay a real run of it on this lesson's data.</p>
        <p class="task">Step through the call for run 5 to the end. Watch where the model file goes.</p>
        ${kit.code(CODE1, f.line)}
        <div class="vars"><span>run_id <b>${kit.esc(v.run_id || "–")}</b></span><span>folder <b>${kit.esc(v.folder || "–")}</b></span><span>kept <b>${kit.esc(v.kept || "–")}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(SAY5[i])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <p class="${P}cap">runs.jsonl, last line</p>
        <div class="${P}note">${wrote ? kit.esc(LINE5) : kit.esc('{"run_id": "run4", … }')}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 6. The same with MLflow: which call put which piece into the run. */
  // mlflow_week.py, the lines between LISTING START and LISTING END
  const CODE2 = [
    'mlflow.set_experiment("crop-yield")',
    "def log_curve(epoch, loss):",
    '    mlflow.log_metric("train_rmse", loss,',
    "                      step=epoch)",
    "for n, settings in enumerate(WEEK, start=1):",
    '    mlflow.start_run(run_name=f"run{n}")',
    '    cols = ",".join(settings["features"])',
    "    mlflow.log_params({**settings,",
    '                       "features": cols})',
    "    w, b, mean, std, _, val_rmse = train(",
    "        **settings, on_epoch=log_curve)",
    '    mlflow.log_metric("val_rmse", val_rmse)',
    '    np.savez("model.npz", w=w, b=b,',
    "             mean=mean, std=std)",
    '    mlflow.log_artifact("model.npz")',
    "    mlflow.end_run()"
  ];
  // mlflow_week.out.txt
  const MLF = {
    uri: "sqlite:///<working folder>/mlflow.db",
    artifactUri: "<working folder>/mlruns/1/cce45f7f8bd643768ecb45a27a627168/artifacts",
    artifacts: ["model.npz"], commit7: "6e1dd30", sourceName: "mlflow_week.py",
    hist: { run1: { points: 50, at: [[1, 3.6703], [50, 1.5059]] }, run2: { points: 300, at: [[1, 3.6703], [50, 1.5059], [100, 0.818], [200, 0.6454], [300, 0.6412]] } }
  };
  const MCASES = [
    { q: `In the stored runs, run2 has ${MLF.hist.run2.points} train_rmse points and run1 has ${MLF.hist.run1.points}: one per epoch, ${MLF.hist.run2.at.map(([s, v]) => `${v} at step ${s}`).slice(0, 3).join(", ")}, … Which call made those points?`,
      opts: ["mlflow.log_params(...)", "mlflow.log_metric(\"train_rmse\", loss, step=epoch), inside log_curve", "mlflow.log_metric(\"val_rmse\", val_rmse)"], right: 1,
      yes: `Right. The training loop inside <code>train</code> calls <code>log_curve</code> once per epoch, and <code>step=epoch</code> puts each value on the curve at its epoch. Logging the same metric name again adds a point; it does not replace the last one. That is how you see that run1 stopped at epoch ${MLF.hist.run1.points} while its error was still falling.`,
      no: ["<code>log_params</code> stores settings, one value per name. Settings do not change during a run, so they have no steps.", "", "That call runs once, after training, so it stores one val_rmse point per run, not one per epoch."] },
    { q: "The loop saves model.npz under the same name in every run, just like final last week. Why does each run still have its own model?",
      opts: ["np.savez keeps the older versions of model.npz", "mlflow.log_artifact copies the file into that run's own folder", "MLflow stores the file inside mlflow.db"], right: 1,
      yes: `Right. In our run the best run's files went to <code>${MLF.artifactUri.replace("<working folder>/", "")}</code>, and that folder holds <code>${MLF.artifacts.join(", ")}</code>. A file attached to a run is called an <b>artifact</b>. The next <code>np.savez</code> overwrote <code>model.npz</code> in the working folder, not this copy. It does the job of <code>shutil.copy</code> in your ten-line tracker.`,
      no: ["<code>np.savez</code> overwrites the file each time, exactly as <code>final</code> was overwritten last week. Six runs leave one model.npz in the working folder.", "", `<code>mlflow.db</code> holds the run records: settings, scores and short labels. Files attached to a run, its artifacts, go to a separate artifact store. With no setup that is a folder, <code>mlruns/</code>, next to the database.`] },
    { q: "No line in the loop mentions git. Does the stored run know which code made it?",
      opts: ["No: you must log the commit yourself", "Yes: MLflow stored the commit as a tag on its own", "Yes: the run name holds it"], right: 1,
      yes: `Right. A <b>tag</b> is a short text label MLflow stores with the run. Because the script lives in a git repository, MLflow added the tag <code>mlflow.source.git.commit</code> (here <code>${MLF.commit7}…</code>) and <code>mlflow.source.name</code> (<code>${MLF.sourceName}</code>) by itself. A catch: the tag is the commit the repository was on. Edits you have not committed are not in it. In our recorded run, the script was not committed yet, so the tagged commit does not hold it. Commit first, then run.`,
      no: ["MLflow does it for you when the script is in a git repository: the run got the tag <code>mlflow.source.git.commit</code>. Logging it by hand is only needed when the code is not in git.", "", "The run name is just what we passed: <code>run1</code> to <code>run6</code>. The commit is stored separately, as a tag MLflow added by itself."] }
  ];
  function withMlflow({ el, done, kit }) {
    ensureStyle();
    const ans = MCASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>The same records, with MLflow</h1>
        <p class="lead"><b>MLflow</b> is an open-source library that keeps these records for you. This loop logs the same six runs. With no setup, MLflow wrote the run records to a SQLite file, <code>mlflow.db</code>, in the folder the script ran from (in our run of MLflow 3.18, on 2026-11-14).</p>
        ${kit.code(CODE2, -1)}
        <p class="${P}cap">For a JavaScript reader: <code>train(**settings, …)</code> passes the dict's keys as named arguments, like spreading props, and <code>{**settings, …}</code> copies a dict like <code>{...settings}</code>. <code>WEEK</code> is the list of the six settings dicts. <code>on_epoch=log_curve</code> hands <code>train</code> a function to call after every epoch, like a callback prop. <code>start_run</code> opens a run and <code>end_run</code> closes it; everything logged in between goes into that run.</p>
        <p class="task">Answer the three questions about where each piece of the record came from.</p>
        ${MCASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(c.q)}</p>${kit.options(c.opts.map(kit.esc), { picked: ans[i], correct: c.right })}${ans[i] == null ? "" : ans[i] === c.right ? kit.feedback(c.yes, true) : kit.feedback(c.no[ans[i]], false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (MCASES.every((m, j) => ans[j] === m.right)) done();
      }));
    };
    paint();
  }

  /* 7. Compare runs: search_runs with order_by, then a filter. */
  // mlflow_week.out.txt, "all runs, best val_rmse first" (values as printed by pandas)
  const TABLE = [
    ["run5", "0.1", "300", "rain,fertiliser,temp,soil", "3.734771e-01", "3.551657e-01"],
    ["run4", "0.1", "300", "rain,fertiliser,soil", "4.140803e-01", "3.984053e-01"],
    ["run2", "0.01", "300", "rain,fertiliser", "6.412425e-01", "5.724937e-01"],
    ["run3", "0.1", "300", "rain,fertiliser", "6.411361e-01", "5.743392e-01"],
    ["run1", "0.01", "50", "rain,fertiliser", "1.505856e+00", "1.366850e+00"],
    ["run6", "1.2", "300", "rain,fertiliser,temp,soil", "7.281440e+93", "6.322268e+93"]
  ];
  const FILTERS = [
    { f: "params.lr = 0.1 AND metrics.val_rmse < 0.5", err: "MlflowException: Expected a quoted string value for parameter (e.g. 'my-value'). Got value 0.1" },
    { f: 'params.lr = "0.1" AND metrics.val_rmse < 0.5', rows: [["run5", "0.1", "300", "rain,fertiliser,temp,soil", "0.373477", "0.355166"], ["run4", "0.1", "300", "rain,fertiliser,soil", "0.414080", "0.398405"]] },
    { f: 'params.lr = "0.1" OR metrics.val_rmse < 0.5', err: "MlflowException: Invalid clause(s) in filter string: 'OR'" }
  ];
  const HEAD = ["run", "lr", "epochs", "features", "val_rmse"];
  // break the printed features list after its commas so it wraps on a phone
  const NO_TRAIN = rows => rows.map(r => r.filter((_, j) => j !== 4).map((c, j) => (j === 3 ? { html: c.split(",").map(x => x.replace(/[&<>"]/g, "")).join(",<wbr>") } : c))); // the printed tables also have metrics.train_rmse; left out to fit a phone
  function compare({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const paint = () => {
      const pick = ans == null ? null : FILTERS[ans];
      el.innerHTML = `<h1>Compare the runs</h1>
        <p class="lead"><code>mlflow.search_runs</code> returns the runs as a pandas table, one row per run, with a column per setting (<code>params.lr</code>, …) and per score (<code>metrics.val_rmse</code>, …). Below, the column names are shortened to fit. Ours was called with <code>order_by=["metrics.val_rmse ASC"]</code>, smallest error first:</p>
        ${grid(kit, HEAD, NO_TRAIN(TABLE), { best: 0 })}
        <p class="${P}cap">pandas prints the scores in scientific notation: ${TABLE[0][5]} means ${r4(BEST.val)}, the ${BEST.id} score from screen 4.</p>
        <p class="task">Sam wants only the runs with lr 0.1 whose val_rmse is under 0.5. Which <code>filter_string</code> does it?</p>
        <div class="lpanel">${kit.options(FILTERS.map(x => `<code>${kit.esc(x.f)}</code>`), { picked: ans, correct: RIGHT })}
        ${pick == null ? "" : pick.err ? `<div class="${P}note">${kit.esc(pick.err)}</div>` : grid(kit, HEAD, NO_TRAIN(pick.rows))}
        ${ans == null ? "" : ans === RIGHT
          ? kit.feedback(`Right, ${pick.rows.length} runs. MLflow stores every setting as text, so a setting is compared with a quoted string: <code>"0.1"</code>. Scores are numbers, so <code>&lt; 0.5</code> needs no quotes. Conditions join with <code>AND</code>.`, true)
          : ans === 0 ? kit.feedback(`That is the real error from our run. Settings are stored as text, even when you logged a number, so the value must be quoted: <code>params.lr = "0.1"</code>.`, false)
          : kit.feedback(`That is the real error from our run. MLflow's search syntax joins conditions with <code>AND</code> only; there is no <code>OR</code>. For "either" you run two searches, or filter the pandas table yourself.`, false)}</div>
        <p class="lead"><b>Not run by us.</b> MLflow also has a web page that lists runs side by side and draws the train_rmse curves over each other. You start it with <code>mlflow server</code>, by default at 127.0.0.1:5000. Written from the <a href="https://mlflow.org/docs/latest/api_reference/cli.html" target="_blank" rel="noopener">official documentation</a>, checked 2026-11-14.</p>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture: what it is for, when not, what it costs. */
  const COSTS = ["Sharing: the runs sit on one laptop", "Storage: every run keeps its own files", "None worth paying: a sheet and git tags do the job"];
  const BCASES = [
    { q: "Two people tune the same model from two laptops, each logging to MLflow's default local file.", right: 0,
      yes: "Right. Each laptop has its own mlflow.db, so neither person can compare against the other's runs. They need one tracking server that both log to, and someone has to run it and back up its database.",
      no: ["", "Storage grows too, but the first thing that goes wrong is that each person sees only half the runs.", "Two people and many runs is exactly where a sheet starts to have holes, as it did last week."] },
    { q: "A team fine-tunes a model that writes a 4 GB checkpoint, and logs the checkpoint as an artifact in each of 300 runs a quarter.", right: 1,
      yes: "Right. Every logged file is a copy, so the artifact store grows with every run. Teams decide which runs keep their files and clean up the rest.",
      no: ["Sharing matters too, but here the bill that grows fastest is the copies: one checkpoint per run.", "", "Hundreds of runs with large files are far past what a sheet can track, and the copies are the cost to plan for."] },
    { q: "One analyst retrains a small forecast once a month with the same script, changing one setting each time.", right: 2,
      yes: "Right. One run a month by one person: commit the script, tag the commit, add a line to a sheet with the setting and the score. Every run can be repeated from its tag. A tracker would add setup and buy little.",
      no: ["There is one person and one machine, so there is nobody to share with.", "One small model a month is a few megabytes a year."] }
  ];
  function bigPicture({ el, done, kit }) {
    const ans = BCASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to track, and what it costs</h1>
        <p class="lead"><b>What it is for:</b> answering "which settings gave the best score, and where is that model?" for many runs, by several people, weeks later.</p>
        <p class="lead"><b>Reach for it</b> when runs pile up, when people share the work, or when you must reproduce a model. It works the same for prompt runs: the prompt version and model are the settings, the eval pass rate is the score, the answers file is the artifact.</p>
        <p class="lead"><b>Not needed</b> for a few runs by one person: a git tag and a sheet do it.</p>
        <p class="lead"><b>The costs:</b> a server and database to run and back up once a team shares, storage that grows with every logged file, and agreeing on names for settings and scores.</p>
        <p class="task">For each team, which cost bites first?</p>
        ${BCASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(c.q)}</p>${kit.options(COSTS.map(kit.esc), { picked: ans[i], correct: c.right })}${ans[i] == null ? "" : ans[i] === c.right ? kit.feedback(kit.esc(c.yes), true) : kit.feedback(kit.esc(c.no[ans[i]]), false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BCASES.every((m, j) => ans[j] === m.right)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const PROMPT_VERSIONS = 12, MODELS = 2, SWEEP = 200;
  const CASES = [
    [`A support team tries ${PROMPT_VERSIONS} versions of a system prompt on ${WORDS[MODELS].toLowerCase()} hosted models, scoring each pair on the same 50 eval questions. A month later they must say why version 9 shipped.`, true,
      "Yes. Each prompt-and-model pair is a run: prompt version, model and temperature as settings, the pass rate as a score, the answers file as an artifact. Then sort by pass rate.",
      `These are runs too, just without training. ${PROMPT_VERSIONS * MODELS} prompt-and-model pairs scored on one eval set is the same question as last week: which settings gave the best score? Log each pair with its settings, score and answers file.`],
    [`Two engineers sweep ${SWEEP} learning-rate and batch-size pairs over a weekend on two machines, and on Monday want the best ten.`, true,
      "Yes. Both machines log to one shared tracking server, and on Monday one search with order_by on the score gives the top ten with their settings and model files.",
      `${SWEEP} runs on two machines is about ${Math.round(SWEEP / RUNS.length)} times as many runs as last week's folder held. Log every run to one shared server and sort by the score.`],
    ["A farmer says the live yield model gave a strange forecast for her field this morning. The team wants to see that request's inputs and the answer.", false,
      "No. Experiment tracking records how each model was trained, not each prediction it served. MLflow has a separate tracing feature for live requests, built mainly for LLM apps and agents, but that is watching the running service, not experiment tracking. To find one live request you need the service's request logs or traces.",
      "A tracker stores training runs: settings, scores, model files. This morning's forecast was one request to the live service, so it is in no run record. Look at the service's request logs or traces."],
    ["A student trains one small model for a class report, tries three settings in an afternoon, and hands in the best.", false,
      "No. Three runs by one person in one afternoon: a commit and three lines in a notebook are enough. A tracker adds setup and saves nothing.",
      "Nothing here gets lost: one person, three runs, one afternoon. Commit the code and write the three settings and scores down. A tracker earns its setup when runs pile up or people share."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Track it, or not?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the farm co-op.</p>
        <p class="task">For each one, decide if experiment tracking is the right tool. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and its checklist (from our own run of mlflow_week.py). */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const r6 = RUNS[5];
    const checks = [
      `The experiment <code>crop-yield</code> holds ${WORDS[RUNS.length].toLowerCase()} runs, <code>run1</code> to <code>run${RUNS.length}</code>.`,
      `Sorted by <code>metrics.val_rmse</code>, <code>${BEST.id}</code> comes first with about ${r4(BEST.val)}.`,
      `<code>${r6.id}</code>'s val_rmse is around ${big(r6.val)}: the run with lr ${r6.lr} blew up and was still logged.`,
      `The train_rmse history has ${MLF.hist.run1.points} points for run1 and ${MLF.hist.run2.points} for run2.`,
      `<code>filter_string="params.lr = 0.1"</code> fails with "Expected a quoted string value"; with <code>"0.1"</code> in quotes it returns runs.`,
      `The best run's artifacts list shows <code>${MLF.artifacts[0]}</code>.`
    ];
    el.innerHTML = `<h1>You can track runs now</h1>
      <p>A run record holds the settings, named scores, the run's own model file and the code version, and the training code writes it for every run. MLflow does this with <code>log_params</code>, <code>log_metric</code> and <code>log_artifact</code>, and <code>search_runs</code> compares the runs. For a few runs by one person, a git tag and a sheet are enough.</p>
      ${NOTEBOOK_URL ? `<p><a class="btn ${P}nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a></p>` : ""}
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? "" : "The notebook for this lesson is on its way. "}It replays last week, runs your ten-line tracker, then logs the same six settings with MLflow. What you should see:</p>
      <ul class="${P}check">${checks.map(c => `<li><span aria-hidden="true">☐</span><span>${c}</span></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Each logged model becomes a numbered version you can put into production and roll back.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Experiment tracking with MLflow",
    checked: "2026-11-14",
    sources: [
      "https://mlflow.org/docs/latest/ml/tracking/",
      "https://mlflow.org/docs/latest/ml/tracking/tracking-api/",
      "https://mlflow.org/docs/latest/ml/search/search-runs/",
      "https://mlflow.org/docs/latest/self-hosting/architecture/backend-store/",
      "https://mlflow.org/docs/latest/api_reference/cli.html",
      "https://mlflow.org/docs/latest/api_reference/python_api/mlflow.html",
      "https://mlflow.org/docs/latest/genai/tracing/"
    ],
    interview: [
      {
        q: "Your team ran about forty training runs last month. The model in production scores well, but nobody can retrain it to the same score. What do you put in place, and what does each run record?",
        good: [
          "Make the training code log every run itself, at the end of the run, including failed ones, not people writing notes",
          "Each run records its settings, every score with a clear name and the data split it was measured on, and its own copy of the model file",
          "Record the code version: commit before running, and keep the commit with the run (MLflow tags it when the script is in git)",
          "Record which data the run used, since the same code on changed data is a different run",
          "Log to one shared tracking server so the whole team can search and sort runs"
        ],
        weak: "Agree on better file names and a shared spreadsheet. That misses that people forget, files get overwritten, and failed runs never get written down."
      },
      {
        q: "A colleague wants to set up MLflow for a script one analyst runs once a month. Do you agree?",
        good: [
          "Probably not yet: a dozen runs a year by one person is covered by a commit tag and a line in a sheet",
          "Name what tracking costs: a server and database to run and back up, storage that grows with every logged file, agreed names",
          "Name what would change the answer: many runs, several people, prompt or model sweeps, or a need to reproduce models for audits",
          "If it is added later, logging is a few lines, so starting simple is not a trap"
        ],
        weak: "Yes, every project should use experiment tracking. That ignores the setup and storage cost and what a small case actually needs."
      }
    ],
    screens: [messyFolder, recordPieces, spotIdea, predictRuns, fromScratch, withMlflow, compare, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: [...SCRAPS.map((_, i) => `[data-i="${i}"]`), "[data-right]"] },
      { wrong: [`[data-i="${PIECES.findIndex(p => !p.need)}"]`], right: PIECES.map((p, i) => (p.need ? `[data-i="${i}"]` : null)).filter(Boolean) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: MCASES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BCASES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
