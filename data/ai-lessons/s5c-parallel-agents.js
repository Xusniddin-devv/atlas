/* Lesson: running several coding agents at once. Story: a small company translates the help site of its invoicing
   app into five languages with one agent per language, all started together in one folder.
   Ideas: (1) every failure of a parallel run comes from something two agents share without knowing it (a file, a
   temp name, a disk, a port); (2) give each agent its own working copy (git worktree) and its own files, put the
   edits of a shared file into one last task, run tasks in batches in a merge order, and check the shared machine
   (disk, ports) before starting.
   Data, all from real runs on this Mac (no model calls):
   - docs/ai-path/runs/s5c-parallel-agents/failed_run.py + failed_run.out.txt: five stand-in agents (plain Python
     processes doing the agents' file operations) in one folder on a 4 MB disk image. Log, site.yml and disk numbers.
   - docs/ai-path/runs/s5c-parallel-agents/worktree_run.sh + worktree_run.out.txt: git worktree add/list, an edit
     seen from another worktree, the same branch twice, a shared stash, the site.yml merge conflict, -X theirs, the
     clean five-branch merge, worktree size, and two preview servers on one port.
   Lesson-local style: a log block with pickable lines, a command-output block and the batch planner rows
   (.lx-s5c-parallel-agents-*), see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s5c-parallel-agents";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s5c-parallel-agents/failed_run.out.txt ("log (all agents ...)"), not altered
  const LOG_RAW = [
    "[+ 0.0s] de  started",
    "[+ 0.1s] de  backed up help-site/site.yml to tmp/backup.bak",
    "[+ 0.1s] es  started",
    "[+ 0.1s] es  backed up help-site/site.yml to tmp/backup.bak",
    "[+ 0.5s] de  translated 4 pages into docs/de/",
    "[+ 0.5s] de  read site.yml (languages: en)",
    "[+ 0.5s] es  translated 4 pages into docs/es/",
    "[+ 0.6s] es  read site.yml (languages: en)",
    "[+ 1.1s] de  wrote site.yml (languages: en, de)",
    "[+ 1.1s] de  build ok: site/de/ written",
    "[+ 1.2s] es  wrote site.yml (languages: en, es)",
    "[+ 1.2s] es  build ok: site/es/ written",
    "[+ 2.0s] ja  started",
    "[+ 2.1s] ja  backed up help-site/site.yml to tmp/backup.bak",
    "[+ 2.5s] ja  translated 4 pages into docs/ja/",
    "[+ 2.5s] ja  read site.yml (languages: en, es)",
    "[+ 2.7s] ja  wrote site.yml (languages: en, es, ja)",
    "[+ 2.7s] ja  build ok: site/ja/ written",
    "[+ 3.0s] pt  started",
    "[+ 3.0s] pt  backed up help-site/site.yml to tmp/backup.bak",
    "[+ 3.3s] ko  started",
    "[+ 3.5s] pt  translated 4 pages into docs/pt/",
    "[+ 3.5s] pt  read site.yml (languages: en, es, ja)",
    "[+ 3.6s] ko  translated 4 pages into docs/ko/",
    "[+ 3.6s] ko  backed up help-site/docs/index.md to tmp/backup.bak",
    "[+ 3.6s] ko  added language links to docs/index.md",
    "[+ 3.7s] pt  wrote site.yml (languages: en, es, ja, pt)",
    "[+ 3.7s] pt  build FAILED: dd: help-site/site/pt/search-index.json: No space left on device",
    "[+ 3.8s] pt  removed partial site/pt/",
    "[+ 3.8s] pt  restored tmp/backup.bak to help-site/site.yml",
    "[+ 4.2s] ko  build FAILED: dd: help-site/site/ko/search-index.json: No space left on device",
    "[+ 4.2s] ko  removed partial site/ko/",
    "[+ 4.2s] ko  restored tmp/backup.bak to help-site/docs/index.md"
  ];
  // failed_run.out.txt: "site.yml after the run", the start contents (SITE_YML in failed_run.py), disk numbers
  const SITE_YML_BEFORE = "site_name: Invoice App Help\nlanguages:\n  - en\nnav:\n  - index.md\n  - getting-started.md\n  - invoices.md\n  - exports.md";
  const SITE_YML_AFTER = "# Invoice App Help\n\nStart here: create your first invoice, then export it.";
  const DISK_FREE_KB = 3908; // "disk before the run": Available
  const BUILD_KB = 1100;     // "one build output: 1100 KB"

  // From docs/ai-path/runs/s5c-parallel-agents/worktree_run.out.txt (the folder is shown as ~/work, as the script says)
  const WT = {
    add: "$ git worktree add ../help-de -b translate/de\nPreparing worktree (new branch 'translate/de')\nHEAD is now at 80a6189 English help site",
    list: "$ git worktree list\n~/work/help     80a6189 [main]\n~/work/help-de  80a6189 [translate/de]\n~/work/help-es  80a6189 [translate/es]\n~/work/help-ja  80a6189 [translate/ja]\n~/work/help-ko  80a6189 [translate/ko]\n~/work/help-pt  80a6189 [translate/pt]",
    editDe: "$ cd ../help-de && perl -pi -e '…' site.yml && grep -A3 languages site.yml\nlanguages:\n  - en\n  - de\nnav:",
    seenEs: "$ cd ../help-es && grep -A3 languages site.yml\nlanguages:\n  - en\nnav:\n  - index.md",
    twice: "$ git worktree add ../help-de-2 translate/de\nPreparing worktree (checking out 'translate/de')\nfatal: 'translate/de' is already used by worktree at '~/work/help-de'",
    stash: "$ cd ../help-de && git stash push -m 'de: half-done menu edit'\nSaved working directory and index state On translate/de: de: half-done menu edit",
    stashList: "$ cd ../help-es && git stash list\nstash@{0}: On translate/de: de: half-done menu edit",
    mergeDe: "$ git merge translate/de\nUpdating 80a6189..5277e29\nFast-forward\n docs/de/index.md    | 1 +\n docs/de/invoices.md | 1 +\n site.yml            | 1 +\n 3 files changed, 3 insertions(+)\n …",
    mergeEs: "$ git merge translate/es\nAuto-merging site.yml\nCONFLICT (content): Merge conflict in site.yml\nAutomatic merge failed; fix conflicts and then commit the result.",
    diffEs: "$ git diff site.yml\n…\n  languages:\n    - en\n++<<<<<<< HEAD\n +  - de\n++=======\n+   - es\n++>>>>>>> translate/es\n  nav:\n…",
    theirs: "$ git merge -X theirs translate/es -m 'Merge es'\nAuto-merging site.yml\nMerge made by the 'ort' strategy.\n …\n$ grep -A3 languages site.yml\nlanguages:\n  - en\n  - es\nnav:",
    plan2: [
      "$ git merge --no-edit translate/de\nUpdating 80a6189..5630c95\nFast-forward\n …",
      "$ git merge --no-edit translate/es\nMerge made by the 'ort' strategy.\n …",
      "$ git merge --no-edit translate/ja\nMerge made by the 'ort' strategy.\n …",
      "$ git merge --no-edit translate/pt\nMerge made by the 'ort' strategy.\n …",
      "$ git merge --no-edit translate/ko\nMerge made by the 'ort' strategy.\n …"
    ],
    plan2Menu: "$ perl -pi -e '…' site.yml && git commit -qam 'Add five languages to the menu' && grep -A6 languages site.yml\nlanguages:\n  - en\n  - de\n  - es\n  - ja\n  - pt\n  - ko",
    wtKb: 24, gitKb: 464, // "du -sk ../help-es .git"
    port: "$ python3 -m http.server 8000 --bind 127.0.0.1\nTraceback (most recent call last):\n…\nOSError: [Errno 48] Address already in use"
  };
  const LANGS = ["de", "es", "ja", "pt", "ko"];
  const LANG_NAME = { de: "German", es: "Spanish", ja: "Japanese", pt: "Portuguese", ko: "Korean" };

  /* ---------- Derived from the data ---------- */
  const LOG = LOG_RAW.map((s, i) => {
    const m = s.match(/^\[\+\s*([\d.]+)s\] (\w+) {2}(.*)$/);
    return { i, t: m[1], who: m[2], text: m[3] };
  });
  const find = (who, start) => LOG.find(l => l.who === who && l.text.startsWith(start)).i;
  const DE_WRITE = find("de", "wrote site.yml"), ES_WRITE = find("es", "wrote site.yml"), ES_READ = find("es", "read site.yml");
  const JA_READ = find("ja", "read site.yml"), PT_START = find("pt", "started"), PT_RESTORE = find("pt", "restored");
  const KO_BACKUP = find("ko", "backed up"), PT_BACKUP = find("pt", "backed up"), PT_FAIL = find("pt", "build FAILED");
  const SHOW1 = LOG.slice(0, JA_READ + 1), SHOW2 = LOG.slice(PT_START);
  const BUILDS_OK = LOG.filter(l => l.text.startsWith("build ok")).length;
  const BUILDS_FAILED = LOG.filter(l => l.text.startsWith("build FAILED")).length;
  const AGENTS = new Set(LOG.map(l => l.who)).size;
  const NEED_KB = AGENTS * BUILD_KB;
  const langsIn = s => (s.match(/\(languages: ([^)]*)\)/) || [, ""])[1];
  const FAIL_REASON = LOG[PT_FAIL].text.split(": ").pop();
  const PLAN2_CONFLICTS = WT.plan2.filter(s => s.includes("CONFLICT")).length;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-line { display: grid; grid-template-columns: 4.2em 2.2em 1fr; gap: 0 10px; width: 100%; min-height: 44px; align-items: center;
        padding: 6px 8px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--ink); text-align: left;
        font: 500 14px/1.45 var(--mono); }
      button.lx-${ID}-line { cursor: pointer; }
      button.lx-${ID}-line:hover { background: var(--sunk); }
      .lx-${ID}-line .t { color: var(--muted); }
      .lx-${ID}-line .w { font-weight: 700; }
      .lx-${ID}-line .x { min-width: 0; overflow-wrap: anywhere; }
      .lx-${ID}-line.no { background: var(--bad-soft); box-shadow: inset 3px 0 0 var(--bad); }
      .lx-${ID}-line.ok { background: var(--good-soft); box-shadow: inset 3px 0 0 var(--good); }
      .lx-${ID}-line.mark { box-shadow: inset 3px 0 0 var(--ink); }
      .lx-${ID}-cut { padding: 6px 8px; font: 500 14px var(--mono); color: var(--muted); border-bottom: 1px solid var(--line); }
      .lx-${ID}-pre { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px;
        font: 500 13.5px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-lbl { margin: 14px 0 -6px; font: 600 13.5px/1.4 var(--font); color: var(--muted); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-task { padding: 10px 0; border-bottom: 1px solid var(--line); display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; align-items: center; }
      .lx-${ID}-task .nm { font-size: 16px; line-height: 1.4; }
      .lx-${ID}-task .io { grid-column: 1; font: 500 13px/1.5 var(--mono); color: var(--muted); overflow-wrap: anywhere; }
      .lx-${ID}-bs { grid-row: 1 / span 2; grid-column: 2; display: flex; gap: 6px; }
      .lx-${ID}-bs button { min-width: 44px; min-height: 44px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px;
        background: var(--surface); color: var(--ink); font: 600 15px var(--font); cursor: pointer; }
      .lx-${ID}-bs button[aria-pressed="true"] { border: 2px solid var(--ink); background: var(--sunk); }
      .lx-${ID}-plan { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-fb ul { margin: 6px 0 0; padding-left: 20px; }
      @media (max-width: 520px) {
        .lx-${ID}-line { grid-template-columns: 3.6em 2em 1fr; gap: 0 6px; font-size: 13px; }
        .lx-${ID}-task { grid-template-columns: 1fr; }
        .lx-${ID}-bs { grid-row: auto; grid-column: 1; }
      }
    `;
    document.head.appendChild(s);
  }
  // rows: LOG entries; pick: rows are buttons; cls: { index: "no" | "ok" | "mark" }; cut: show "…" before / after
  function logView(kit, rows, { pick = false, cls = {}, cutBefore = false, cutAfter = false } = {}) {
    const tag = pick ? "button" : "div";
    const line = l => `<${tag}${pick ? ` type="button" data-i="${l.i}"` : ""} class="lx-${ID}-line${cls[l.i] ? " " + cls[l.i] : ""}"><span class="t">+${kit.esc(l.t)}s</span><span class="w">${kit.esc(l.who)}</span><span class="x">${kit.esc(l.text)}</span></${tag}>`;
    const cut = `<div class="lx-${ID}-cut">…</div>`;
    return `<div class="lx-${ID}-log">${cutBefore ? cut : ""}${rows.map(line).join("")}${cutAfter ? cut : ""}</div>`;
  }
  const pre = (kit, s, label) => `${label ? `<p class="lx-${ID}-lbl">${kit.esc(label)}</p>` : ""}<pre class="lx-${ID}-pre">${kit.esc(s)}</pre>`;
  const runCap = `<p class="lx-${ID}-cap">Real output from our run (scripts in this lesson's runs folder)</p>`;
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation, and the first diagnosis: where was German lost? */
  function whereLost({ el, done, kit }) {
    ensureStyle();
    let picked = null;
    const fbFor = i => {
      const l = LOG[i];
      if (i === ES_WRITE) return [`Right. At +${LOG[ES_READ].t}s <b>es</b> read the menu, when it held only <code>${kit.esc(langsIn(LOG[ES_READ].text))}</code>. At +${LOG[DE_WRITE].t}s <b>de</b> added German. At +${l.t}s es wrote back its old copy plus its own line, and German was gone. Neither agent did anything wrong alone: each read the file, added a line, wrote it. Two writers on one file, and neither knew about the other. This is called a <b>lost update</b>.`, true];
      if (i === DE_WRITE) return ["Here German was added, and the file was right for a moment. Look for the line after which German is no longer in the list.", false];
      if (i === ES_READ) return [`Reading changes nothing on disk. But note what es read: the list <i>before</i> German was added. What does es do later with that old copy?`, false];
      if (i === JA_READ) return [`When ja reads, the list is already <code>${kit.esc(langsIn(l.text))}</code>. German was lost before this line. Look earlier.`, false];
      if (l.text.startsWith("backed up")) return ["A backup copies site.yml into the temp folder. It does not change site.yml itself.", false];
      if (l.text.startsWith("read site.yml")) return [`Reading changes nothing on disk, and at +${l.t}s the list was still <code>${kit.esc(langsIn(l.text))}</code>, as at the start. Look for a line that writes site.yml.`, false];
      if (l.text.startsWith("build")) return [`The build writes <code>site/${kit.esc(l.who)}/</code>, the finished pages. It does not touch the menu file.`, false];
      return ["This line does not touch site.yml, the file that holds the menu.", false];
    };
    const paint = () => {
      const ok = picked === ES_WRITE;
      el.innerHTML = `<h1>Five agents, one folder</h1>
        <p class="lead">Several coding agents running at once can finish more work in the same time, but only if they stay out of each other's way. This lesson shows how to set that up.</p>
        <p class="lead">A small company has the help site of its invoicing app in English. It wants German, Spanish, Japanese, Portuguese and Korean. The plan: one coding agent per language, all started at once in the same project folder. Each agent translates the pages into its own folder, adds its language to the site menu in <code>site.yml</code>, and builds the site.</p>
        ${pre(kit, SITE_YML_BEFORE, "site.yml at the start")}
        <p class="lead">We acted out this plan with five small scripts that do the agents' file work: back up, translate, edit the menu, build. No model is involved, because these failures are about files. The scripts follow a fixed timing, so the run repeats the same way.</p>
        <p class="lead">Each log line shows the seconds since the start, the agent, and what it did. Each agent is named by its language code: ${LANGS.map(l => `<b>${l}</b> ${LANG_NAME[l]}`).join(", ")}. Here is the start of the shared log. At the end, German was missing from the menu.</p>
        <p class="task">Click the line where German was lost.</p>
        ${logView(kit, SHOW1, { pick: !ok, cls: picked == null ? {} : { [picked]: ok ? "ok" : "no" }, cutAfter: true })}
        ${runCap}
        <div class="lpanel">${picked == null ? "" : kit.feedback(...fbFor(picked))}</div>`;
      el.querySelectorAll(`button.lx-${ID}-line`).forEach(b => b.onclick = () => { picked = +b.dataset.i; paint(); if (picked === ES_WRITE) done(); });
    };
    paint();
  }

  /* 2. Broken on purpose: the menu file holds the home page, and the builds failed. */
  function wrongBackup({ el, done, kit }) {
    ensureStyle();
    let step = 0, picked = null; // step 0: who wrote it; 1: what made the backup wrong; 2: why the build failed; 3: done
    const GOAL = [PT_RESTORE, KO_BACKUP];
    const fbLine = i => {
      const l = LOG[i];
      if (step === 0) {
        if (i === PT_RESTORE) return null;
        if (i === KO_BACKUP) return ["That line copies the home page into the temp folder. It does not write site.yml. Find the line that writes into site.yml last.", false];
        if (l.text.startsWith("wrote site.yml")) return [`At +${l.t}s site.yml was still a menu, with <code>${kit.esc(langsIn(l.text))}</code>. Something wrote over it after that.`, false];
        if (l.text.startsWith("build FAILED")) return ["The failed build is why pt did what came next. But this line writes nothing into site.yml.", false];
        return ["This line does not write site.yml. Look for the last line that writes into it.", false];
      }
      if (i === KO_BACKUP) return null;
      if (i === PT_BACKUP) return [`That is pt's own backup, and at +${l.t}s it really held site.yml. Something replaced it before pt restored it.`, false];
      if (i === PT_RESTORE) return ["That is the restore you already found. Why did <code>tmp/backup.bak</code> hold the home page at that moment?", false];
      if (l.text.startsWith("restored")) return [`That line reads <code>tmp/backup.bak</code>, at +${l.t}s, after pt's restore. Look for a line that wrote into <code>tmp/backup.bak</code> before pt restored it.`, false];
      return ["This line does not touch <code>tmp/backup.bak</code>. Look for another write to that same file name.", false];
    };
    const OPTS = [
      "The disk was full: every agent built on the same small disk",
      "pt's translation was broken, so its build could not finish",
      "ko deleted pt's files while pt was building"
    ];
    const fbOpt = [
      [`Right. The test disk had ${DISK_FREE_KB.toLocaleString("en")} KB free. Each build writes ${BUILD_KB.toLocaleString("en")} KB, so ${AGENTS} builds need ${NEED_KB.toLocaleString("en")} KB. ${BUILDS_OK} builds fit, the next ${BUILDS_FAILED} failed with “${kit.esc(FAIL_REASON)}”. Nobody checked the one thing every agent shares even when the files are separate: the machine. (We used a small disk so it fills in seconds. On a real machine, what fills the disk is several full copies of a project, each with its installed packages.)`, true],
      [`The error is <code>${kit.esc(FAIL_REASON)}</code>. That is about space, not content: the translated pages were written at +${LOG[find("pt", "translated")].t}s without trouble.`, false],
      ["ko only wrote its own pages, the home page and its own build. Nothing in the log deletes pt's files. The error names the cause.", false]
    ];
    const paint = () => {
      const cls = {};
      for (let s = 0; s < Math.min(step, 2); s++) cls[GOAL[s]] = "ok";
      if (step < 2 && picked != null) cls[picked] = "no";
      const fb = step < 2 && picked != null ? fbLine(picked) : null;
      const tasks = ["site.yml now holds the home page text, not a menu. Click the line that wrote it there.",
        "pt meant to restore its own backup of site.yml. Click the line that put something else under that name.",
        `pt only restored the backup because its build failed at +${LOG[PT_FAIL].t}s. Why did the build fail?`];
      el.innerHTML = `<h1>The menu file is now the home page</h1>
        <p class="lead">The run went on. Every agent backs up a file before it edits it. If its build then fails, it copies the backup back to undo the edit. All backups go in one shared temp folder, always under the name <code>tmp/backup.bak</code>. Here is the end of the log, and what <code>site.yml</code> held when the run finished:</p>
        ${pre(kit, SITE_YML_AFTER, "site.yml after the run")}
        ${logView(kit, SHOW2, { pick: step < 2, cls, cutBefore: true })}
        ${runCap}
        ${step < 3 ? `<p class="task">${tasks[step]}</p>` : ""}
        <div class="lpanel">${step >= 1 ? kit.feedback(`Right: pt copied <code>tmp/backup.bak</code> over site.yml at +${LOG[PT_RESTORE].t}s. The file had the home page in it.`, true) : ""}
          ${step >= 2 ? kit.feedback(`Right: at +${LOG[KO_BACKUP].t}s ko backed up the home page under the same name, <code>tmp/backup.bak</code>, and replaced pt's backup. pt then “restored” ko's file into the menu. A shared folder plus a generic name turned two private backups into one.`, true) : ""}
          ${fb ? kit.feedback(...fb) : ""}
          ${step >= 2 ? ask(kit, OPTS, 0, step === 3 ? 0 : picked, fbOpt) : ""}</div>`;
      if (step < 2) el.querySelectorAll(`button.lx-${ID}-line`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === GOAL[step]) { step++; picked = null; } else picked = i;
        paint();
      });
      else el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picked = +b.dataset.i;
        if (picked === 0) step = 3;
        paint();
        if (step === 3) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: what the three failures have in common. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The agents were too fast; slower agents would not have collided",
      "Each failure came from one thing two agents shared without knowing it: one file, one backup name, one disk",
      "Five agents is too many; two at a time would have been safe",
      "The translations were poor, so the agents made mistakes"
    ];
    const fb = [
      [`Speed only decides who loses. es read the menu at +${LOG[ES_READ].t}s and wrote at +${LOG[ES_WRITE].t}s: any write by another agent inside that gap is lost, at any speed. An agent that thinks for minutes between reading and writing makes the gap longer, not shorter.`, false],
      ["Right. Each agent did a sensible job alone. The damage came from what they had in common: one <code>site.yml</code> that two agents wrote, one temp name that two agents used, one disk that five builds filled. The rule for parallel agents: <b>each agent owns everything it writes</b>. Some things cannot be split. Check the shared machine (its disk, its network ports) before the start. Give a file that every task needs to change to one task, done once, at the end.", true],
      [`German was lost with only two agents writing: de and es, ${(+LOG[ES_WRITE].t - +LOG[DE_WRITE].t).toFixed(1)} s apart. Fewer agents make a clash rarer, not impossible.`, false],
      ["No model wrote anything in this run, and every page was written. The failures are all about where files were written, not what was in them.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What went wrong, in one sentence</h1>
        <p class="lead">Three things broke: German vanished from the menu, the menu file became the home page, and ${BUILDS_FAILED} of ${AGENTS} builds failed.</p>
        <p class="task">What do the three failures have in common?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Separate working copies: git worktree, with predictions checked against the real run. */
  function worktrees({ el, done, kit }) {
    ensureStyle();
    let q = 0, picked = null;
    const Q = [
      { task: "The de agent adds <code>de</code> to site.yml in <code>help-de</code>. What does site.yml in <code>help-es</code> list?",
        opts: ["Only en", "en and de", "An error: the file is locked by help-de"], right: 0,
        fb: [null, ["Each worktree has its own copy of every file. An edit in help-de stays in help-de until it is committed and merged.", false],
          ["Git does not lock files between worktrees. Each one is a separate folder with its own files, so there is nothing to lock.", false]],
        out: WT.editDe + "\n" + WT.seenEs,
        say: "Right. Separate folders, separate files: the lost update from the first screen cannot happen across worktrees." },
      { task: "A second agent should also work on German. You run <code>git worktree add ../help-de-2 translate/de</code>. What happens?",
        opts: ["A second folder on the same branch", "Git refuses: that branch is already checked out", "The branch moves to the new folder"], right: 1,
        fb: [["Then two agents would commit to one branch from two folders, the same clash one level up. Git stops this by default.", false], null,
          ["Git does not move a branch away from a worktree that is using it.", false]],
        out: WT.twice,
        say: "Right. One branch per worktree, so one agent per branch. (The <code>--force</code> option overrides this; there is rarely a good reason to use it.)" },
      { task: "de saves its half-done edit with <code>git stash</code>. In <code>help-es</code>, the es agent runs <code>git stash list</code>. What does it show?",
        opts: ["Nothing: each worktree has its own stash", "de's stash"], right: 1,
        fb: [["That is what most people expect. But a worktree separates the files, not the repository. Try the other answer to see the real output.", false], null],
        out: WT.stash + "\n" + WT.stashList,
        say: "Right, and this one surprises people. All worktrees share one repository: the branches, the history, the stash and, by default, the repository's settings. What each worktree has for itself is mainly its files, its staging area and its current branch. An agent that runs <code>git stash pop</code> can take another agent's work. So in parallel work: commit to your own branch, never stash." }
    ];
    const paint = () => {
      const shown = Q.slice(0, q).map(x => pre(kit, x.out)).join("");
      const cur = Q[q];
      el.innerHTML = `<h1>One working copy per agent</h1>
        <p class="lead">The fix for the shared file is a separate folder for each agent. Git can do this without five full clones: <code>git worktree add</code> makes a second working folder of the same repository, on its own branch. We made one folder per language, <code>help-de</code> to <code>help-pt</code>, each on its own branch <code>translate/&lt;lang&gt;</code>:</p>
        ${pre(kit, WT.add + "\n…\n" + WT.list)}
        ${runCap}
        <p class="lead">Predict three things before you see what git really did.</p>
        ${shown}
        ${q > 0 && q < Q.length ? kit.feedback(Q[q - 1].say, true) : ""}
        ${cur ? `<p class="task">${cur.task}</p><div class="lpanel">${kit.options(cur.opts, { picked, correct: cur.right })}${picked != null && picked !== cur.right ? kit.feedback(cur.fb[picked][0], false) : ""}</div>`
          : `<div class="lpanel">${kit.feedback(Q[2].say, true)}<p class="lead">Coding-agent tools build on the same git feature. Claude Code, for example, documents a <code>--worktree</code> flag that starts a session in a new worktree on its own branch, and notes that a worktree is a fresh checkout: you install the project's dependencies in each one.</p></div>`}
`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picked = +b.dataset.i;
        if (picked === Q[q].right) { q++; picked = null; }
        paint();
        if (q === Q.length) done();
      });
    };
    paint();
  }

  /* 5. A shared file still meets at the merge: predict, then pick the plan that removes the clash. */
  function mergeOrder({ el, done, kit }) {
    ensureStyle();
    let step = 0, picked = null;
    const S = [
      { task: "Plan 1: each agent, in its own worktree, translates its pages <b>and</b> adds its language to site.yml. You merge <code>translate/de</code> first. Now you merge <code>translate/es</code>. What happens?",
        opts: ["It merges cleanly: the branches were in separate folders", "A conflict in site.yml", "A conflict in docs/es/"], right: 1,
        fb: [["Separate folders kept the agents apart while they worked. But both branches changed the same lines of site.yml, and they meet again when you merge.", false], null,
          ["docs/es/ exists only on the es branch, so there is nothing to clash with. Look at the file both branches changed.", false]],
        label: "Plan 1: merge de, then es", out: WT.mergeDe + "\n" + WT.mergeEs + "\n" + WT.diffEs,
        say: `Right. In the diff, the lines between <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD</code> and <code>=======</code> are main's side (de); the lines down to <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt; translate/es</code> are the es branch's side. Worktrees move the clash from “while working” to “while merging”. That is better (git stops and shows it), but with ${LANGS.length} branches you would solve ${LANGS.length - 1} of these by hand.` },
      { task: "A teammate says: “Just merge with <code>git merge -X theirs translate/es</code>, when lines clash, it keeps the side of the branch you merge in.” What does the menu list afterwards?",
        opts: ["en, de, es", "en, es", "Git refuses: there is still a conflict"], right: 1,
        fb: [["That would need git to understand that both lines should stay. It does not: for each block of clashing lines, <code>-X theirs</code> keeps es's side and drops main's.", false], null,
          ["With <code>-X theirs</code> git settles the clashing lines on its own, so the merge succeeds. That is the danger.", false]],
        label: "Plan 1 again, merging es with -X theirs", out: WT.theirs,
        say: "Right, and git reported success. German is gone again, silently: the same lost update as the first screen, now made by the merge." },
      { task: "Which plan removes the conflict?",
        opts: ["Merge in a different order, es before de", "The agents touch only their own docs/&lt;lang&gt;/ folder; after all five merges, one last task adds the five languages to site.yml", "Let the agents edit site.yml in the main folder while they work in worktrees"], right: 1,
        fb: [["Any order has the same problem: whichever branch comes second clashes with the first, and so on for every branch after it.", false], null,
          ["That is the first screen again: several agents writing one file at the same time.", false]],
        label: "Plan 2: agents write only docs/<lang>/; the menu is one last commit", out: WT.plan2.join("\n") + "\n" + WT.plan2Menu,
        say: `Right. We ran it: ${WT.plan2.length} merges, ${PLAN2_CONFLICTS === 0 ? "no conflict" : plural(PLAN2_CONFLICTS, "conflict")}, then one commit for the menu. The rule: <b>no file is written by two tasks that run at the same time</b>. A file everyone needs to change becomes its own task, done once, after the others are merged.` }
    ];
    const paint = () => {
      const cur = S[step];
      el.innerHTML = `<h1>The shared file comes back at the merge</h1>
        <p class="lead">Worktrees keep the agents apart while they work. When they finish, their branches meet again: you merge each one into <code>main</code>. We ran each plan below for real.</p>
        ${S.slice(0, step).map(x => pre(kit, x.out, x.label)).join("")}${step > 0 ? runCap : ""}
        ${step > 0 ? kit.feedback(S[step - 1].say, true) : ""}
        ${cur ? `<p class="task">${cur.task}</p><div class="lpanel">${kit.options(cur.opts, { picked, correct: cur.right })}${picked != null && picked !== cur.right ? kit.feedback(cur.fb[picked][0], false) : ""}</div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picked = +b.dataset.i;
        if (picked === S[step].right) { step++; picked = null; }
        paint();
        if (step === S.length) done();
      });
    };
    paint();
  }

  /* 6. By hand: regroup ten tasks into batches that are safe to run at once. */
  const TASKS = [
    { k: "links", short: "links", name: "Fix broken links in the English pages", writes: ["docs/en/"], needs: [] },
    { k: "glossary", short: "glossary", name: "Agree on the list of product terms every translator uses", writes: ["glossary.yml"], needs: [] },
    { k: "theme", short: "theme", name: "Upgrade the site theme", writes: ["theme/header.html", "theme/style.css", "site.yml"], needs: [] },
    ...LANGS.map(l => ({ k: l, short: l, name: `Translate the pages into ${LANG_NAME[l]}`, writes: [`docs/${l}/`], needs: ["links", "glossary"] })),
    { k: "menu", short: "menu", name: "Add the five languages to the menu", writes: ["site.yml"], needs: LANGS.slice() },
    { k: "switcher", short: "switcher", name: "Add a language switcher to the page header", writes: ["theme/header.html"], needs: ["theme", ...LANGS] }
  ];
  const BATCHES = 3;
  const SOLUTION = { links: 1, glossary: 1, theme: 1, de: 2, es: 2, ja: 2, pt: 2, ko: 2, menu: 3, switcher: 3 };
  const tk = k => TASKS.find(t => t.k === k);
  const shortName = t => t.short;
  function problems(batch) {
    const out = [];
    TASKS.forEach((a, i) => TASKS.slice(i + 1).forEach(b => {
      if (batch[a.k] !== batch[b.k]) return;
      const f = a.writes.find(w => b.writes.includes(w));
      if (f) out.push(`“${shortName(a)}” and “${shortName(b)}” are both in batch ${batch[a.k]} and both write <code>${f}</code>.`);
    }));
    TASKS.forEach(t => {
      const late = t.needs.filter(n => batch[n] >= batch[t.k]);
      if (late.length) out.push(`“${shortName(t)}” needs ${late.map(n => `“${shortName(tk(n))}”`).join(", ")} finished first, so it must be in a later batch.`);
    });
    return out;
  }
  function batches({ el, done, kit }) {
    ensureStyle();
    const batch = Object.fromEntries(TASKS.map(t => [t.k, 1]));
    let checked = null; // null: not checked since the last change; else the problem list
    const paint = () => {
      const counts = Array.from({ length: BATCHES }, (_, b) => TASKS.filter(t => batch[t.k] === b + 1).length);
      const fb = checked == null ? "" : checked.length
        ? kit.feedback(`<div class="lx-${ID}-fb">${plural(checked.length, "problem")} with this plan:<ul>${checked.slice(0, 4).map(p => `<li>${p}</li>`).join("")}</ul>${checked.length > 4 ? `<p>…and ${checked.length - 4} more. Fix these first.</p>` : ""}</div>`, false)
        : kit.feedback(`Safe. Batch sizes: ${counts.join(", ")}, so at most ${Math.max(...counts)} agents run at once. No two jobs in a batch write the same file, and every job starts after the jobs it needs. This order is also your <b>merge order</b>: merge every branch of a batch, run the build, and start the next batch from that merged result. The menu is one job at the end, as on the previous screen.`, true);
      el.innerHTML = `<h1>Plan the batches yourself</h1>
        <p class="lead">The site has ten jobs. Each one lists the files it writes and the jobs that must be finished before it can start. A <b>batch</b> is a set of jobs whose agents run at the same time. Right now all ten are in batch 1, which is what went wrong in the first run.</p>
        <p class="task">Put each job in batch 1, 2 or 3 so that no two jobs in a batch write the same file, and every job comes after the jobs it needs. Then check the plan.</p>
        <div class="lx-${ID}-plan">${TASKS.map((t, i) => `<div class="lx-${ID}-task" id="t${i}">
          <div class="nm">${kit.esc(t.name)}</div>
          <div class="io">${kit.esc(t.short)}: writes ${t.writes.map(kit.esc).join(", ")}${t.needs.length ? ` · needs ${t.needs.map(n => kit.esc(tk(n).short)).join(", ")}` : ""}</div>
          <div class="lx-${ID}-bs" role="group" aria-label="batch for ${kit.esc(t.name)}">${Array.from({ length: BATCHES }, (_, b) => `<button type="button" data-b="${b + 1}" aria-pressed="${batch[t.k] === b + 1}" aria-label="batch ${b + 1}">${b + 1}</button>`).join("")}</div>
        </div>`).join("")}</div>
        <div class="lpanel"><div class="lsteps"><button type="button" class="btn" data-check>Check the plan</button></div>${fb}</div>`;
      el.querySelectorAll(`.lx-${ID}-task`).forEach((row, i) => row.querySelectorAll("button").forEach(b => b.onclick = () => {
        batch[TASKS[i].k] = +b.dataset.b; checked = null; paint();
      }));
      el.querySelector("[data-check]").onclick = () => { checked = problems(batch); paint(); if (!checked.length) done(); };
    };
    paint();
  }

  /* 7. Checks before starting: the things that cannot be split. */
  const CHECKS = [
    [`Free disk is larger than the number of agents × (one working copy with its packages installed + one build output)`, true,
      `Yes. The run's test disk had ${DISK_FREE_KB.toLocaleString("en")} KB free and ${AGENTS} builds needed ${NEED_KB.toLocaleString("en")} KB. A worktree itself is small: in our test repository one took ${WT.wtKb} KB, because the history stays in the shared <code>.git</code> (${WT.gitKb} KB). But each worktree is a fresh checkout, so each needs its own installed packages and build output, and those fill a real disk.`,
      `Disk is shared by every agent, whatever folders they use. In the run, ${AGENTS} builds needed ${NEED_KB.toLocaleString("en")} KB on a disk with ${DISK_FREE_KB.toLocaleString("en")} KB free, and ${BUILDS_FAILED} builds failed. Multiply before you start.`],
    ["Each agent gets its own port for its preview server", true,
      `Yes. Two servers cannot listen on one port. We started a second preview server on a port already in use:%PORT%Give each agent its own port (and its own test database, if the tests use one).`,
      `Separate folders do not separate network ports. We started a second preview server on a port already in use:%PORT%`],
    ["Each agent keeps temp files and backups inside its own worktree, under names that include the task", true,
      "Yes. That is the fix for the menu file that became the home page: a shared temp folder plus a generic name turned two private backups into one.",
      "This is exactly what broke site.yml on screen 2: two agents used <code>tmp/backup.bak</code> in one shared folder, and pt restored ko's file."],
    ["Run git stash before starting the agents, to keep your own unfinished work safe", false,
      "No. You saw <code>help-es</code> list a stash made in <code>help-de</code>: the stash is shared by every worktree. An agent that runs <code>git stash pop</code> can take your work. Commit your work to your own branch instead.",
      "Careful: the stash is shared by every worktree of the repository. You saw it in the run. An agent that runs <code>git stash pop</code> can take your work. Commit it to your own branch instead."],
    ["Give every agent the same model and the same settings", false,
      "No. That may make the translations read alike, but it does nothing about collisions. Every failure in the run came from a shared file, name or disk, none from a model setting.",
      "It may make the translations read alike, but none of the failures came from a model setting. They came from a shared file, a shared name and a shared disk."],
    ["No two jobs in the same batch write the same file", true,
      "Yes. You checked exactly this when you planned the batches. It is what stops lost updates while the agents work and conflicts when you merge.",
      "This is the check that prevents both the lost update and the merge conflict. It is the one you did by hand on the previous screen."]
  ];
  function checks({ el, done, kit }) {
    ensureStyle();
    const fill = h => h.replace("%PORT%", pre(kit, WT.port));
    const ans = CHECKS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Checks before you start</h1>
        <p class="lead">Worktrees split the files. They do not split the machine the agents share. Before starting a batch, a few checks take a minute and save an evening.</p>
        <p class="task">Would you run each check before starting the agents? Pick again if you change your mind.</p>
        ${CHECKS.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(fill(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CHECKS.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The time each agent needs for its own task", "Your time to review and merge the branches", "The time to create the worktrees"];
    const RIGHT = 1;
    const fb = [
      ["That is the part that does run side by side: ten agents work on ten tasks at the same time. (On one machine they also compete for its processor, so each may get slower.)", false],
      ["Right. Every branch ends as a diff that a person reads, tests and merges, one after another, in the planned order. Ten agents make ten diffs. Plan only as many parallel agents as you can review; the next lesson is about that review.", true],
      ["Creating a worktree is one command per agent. It is not what grows painful.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to run agents in parallel</h1>
        <p class="lead"><b>For:</b> work that splits into tasks that write different files and do not wait for each other: one language per folder, one module each, unrelated bug fixes. Then the agents' working time overlaps instead of adding up.</p>
        <p class="lead"><b>Not</b> when the tasks write the same files, when each step needs the last one's result, or when the task is small. Then one agent, or batches in order, is faster than setting up and merging.</p>
        <p class="lead"><b>Costs:</b> each agent adds three things. A full session of paid model calls. A working copy with its own packages, build and tests, all on the one shared disk and processor. And a branch that someone must review and merge.</p>
        <p class="task">You go from 3 agents to 10 on tasks of the same kind. Which part still happens one after another, so it grows with every agent you add?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where parallel agents are the wrong choice. */
  const CASES = [
    ["Add type hints to twelve separate Python modules. Each module has its own tests, and no module's change touches another file.", true,
      "Yes. Twelve tasks, twelve sets of files, no task waits for another. One worktree and branch per module, a few at a time so you can review them.",
      "These tasks write different files and need nothing from each other, which is the case parallel agents are for. The only limit is how many diffs you can review."],
    ["Move to a new database schema: first write the migration, then update the queries that use it, then update the API on top of the queries.", false,
      "No. Each step needs the result of the step before: the queries depend on the new schema, the API on the queries. Run them in order, one batch each, or give the whole chain to one agent.",
      "Three agents at once would each guess what the others will produce. The queries cannot be written before the schema exists. A chain of steps is sequential work, whatever the number of agents."],
    ["Write release notes in five languages from one English text. Each language goes in its own file.", true,
      "Yes. Same shape as the help site: one file per language, one shared input that nobody edits. Merge them in any order.",
      "Each language writes only its own file and reads the English text without changing it. That is safe to run at once."],
    ["Ten lint warnings sit in one 200-line file. Start ten agents, one per warning.", false,
      "No. All ten agents write the same file. Fixes on nearby lines clash at the merge, and even where git merges them cleanly, you set up ten worktrees and review ten diffs of one line each, for a job one agent does in one pass.",
      "The work is not split by files: all ten branches change one file, so fixes on nearby lines clash at the merge. Even where they merge cleanly, ten worktrees and ten diffs cost far more than one agent fixing all ten in one pass."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Parallel or not?</h1>
        <p class="lead">Four jobs from other projects. Parallel agents means: one agent per task, each in its own worktree and branch, running at the same time.</p>
        <p class="task">Would you run each one with parallel agents? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="r${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can split the work safely</h1>
      <p class="lead">You found three failures in a real parallel run and traced each to something two agents shared: a file, a backup name, a disk. You gave each agent its own worktree and branch, and saw what worktrees still share: the stash, the disk, the ports. You moved the one shared file into a last task. You planned batches in a merge order and chose the checks to run before starting.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Five agents end as five diffs; next you learn what to look for in one of them before you merge it.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Running several coding agents at once",
    checked: "2026-11-18",
    sources: [
      "https://git-scm.com/docs/git-worktree",
      "https://git-scm.com/docs/merge-strategies",
      "https://git-scm.com/docs/git-stash",
      "https://code.claude.com/docs/en/worktrees",
      "https://code.claude.com/docs/en/common-workflows"
    ],
    interview: [
      {
        q: "You want six coding agents to work overnight on one repository. What do you set up before you start them, and what do you do in the morning?",
        good: [
          "Split the work so that no two tasks running at once write the same file; a file everyone must change becomes one task at the end",
          "Give each agent its own worktree and branch, and its own temp folder, port and test database",
          "Check free disk against the number of agents times one working copy with packages and build output",
          "Run the tasks in batches when some depend on others, and start each batch from the merged result of the last",
          "In the morning, review and merge the branches one at a time in the planned order, running the build and tests after each merge"
        ],
        weak: "Start six agents in the same folder and merge whatever they produce. That invites lost updates, overwritten backups and a full disk, and the merge hides what was lost."
      },
      {
        q: "Two agents' branches each pass their tests, but after you merge both, a language is missing from the site menu and no merge reported a conflict. What happened and how do you prevent it?",
        good: [
          "Both branches changed the same lines of a shared file, and the clash was resolved silently by taking one side, for example with git merge -X theirs",
          "Each branch was tested alone, never together, so the loss only shows after the merge",
          "Check the merged file and rerun the tests after every single merge",
          "Prevent it in the plan: take shared-file edits out of the parallel tasks and do them once, after the merges"
        ],
        weak: "Rerun the agents or pick the newer branch. That repeats the clash instead of removing the shared file from the parallel tasks."
      }
    ],
    screens: [whereLost, wrongBackup, spotIdea, worktrees, mergeOrder, batches, checks, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-i="${DE_WRITE}"]`], right: [`[data-i="${ES_WRITE}"]`] },
      { wrong: [`[data-i="${KO_BACKUP}"]`], right: [`[data-i="${PT_RESTORE}"]`, `[data-i="${KO_BACKUP}"]`, "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-check]"], right: [...TASKS.map((t, i) => SOLUTION[t.k] === 1 ? null : `#t${i} [data-b="${SOLUTION[t.k]}"]`).filter(Boolean), "[data-check]"] },
      { wrong: ["#c3 [data-wrong]"], right: CHECKS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#r1 [data-wrong]"], right: CASES.map((_, i) => `#r${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
