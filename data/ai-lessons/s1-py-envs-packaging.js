/* Lesson s1-py-envs-packaging: virtual environments and packaging.
   Story: a teammate's demo script (it totals the week's sign-ups per plan with pandas) runs on their laptop but
   crashes on the shared server the morning of the demo. Every team on that server installs into one Python
   environment, and last night another team installed numpy 2 for their own tool.
   Ideas: (1) one environment per project: a virtual environment is a folder with its own python and its own
   packages, so another project's install cannot reach yours; (2) pin the whole tree: pyproject.toml says what you
   ask for, uv.lock records the exact version of every package, and `uv sync --locked` installs exactly that or
   refuses; (3) packaging: [project.scripts] and `uv build` turn the script into a wheel others can install.
   Depth: explain (screens 1-3, 10-11), library = uv (screens 4-7, 9), debug (screens 1-2 the real crash,
   screen 8 a stale lock), when-not (screens 10-11).
   Data: docs/ai-path/runs/s1-py-envs-packaging/ (run1-envs.sh -> run1-envs.out.txt: the laptop and server
   environments, the crash, the per-project fix; run2-uv.sh -> run2-uv.out.txt: the uv project, the lock, the
   server sync, the stale-lock failure and the build; env.txt: versions). Made for real on one Mac on 2026-11-13;
   folders under .venv/ stand in for the machines. No model calls. Long paths in the outputs are trimmed with "…".
   where.py was later split over more lines to fit a phone; where-rerun.sh -> where-rerun.out.txt shows the same output.
   Every number on screen is computed here from those copied outputs. Lesson-local CSS (prefix
   lx-s1-py-envs-packaging-): terminal blocks with tappable lines, two lists side by side. */
(() => {
  const P = "lx-s1-py-envs-packaging-";
  const RUN_DATE = "2026-11-13";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from docs/ai-path/runs/s1-py-envs-packaging/run1-envs.out.txt ---------- */
  // "== server: python demo_report.py" (absolute paths trimmed with …, nothing else changed)
  const TRACE = [
    "Traceback (most recent call last):",
    '  File "…/demo/demo_report.py", line 2, in <module>',
    "    import pandas as pd",
    '  File "…/.venv/server/lib/python3.12/site-packages/pandas/__init__.py", line 46, in <module>',
    "    from pandas.core.api import (",
    '  File "…/.venv/server/lib/python3.12/site-packages/pandas/core/api.py", line 1, in <module>',
    "    from pandas._libs import (",
    '  File "…/.venv/server/lib/python3.12/site-packages/pandas/_libs/__init__.py", line 18, in <module>',
    "    from pandas._libs.interval import Interval",
    '  File "interval.pyx", line 1, in init pandas._libs.interval',
    "ValueError: numpy.dtype size changed, may indicate binary incompatibility. Expected 96 from C header, got 88 from PyObject"
  ];
  // "== laptop: python demo_report.py"
  const REPORT_OUT = ["plan", "free    131", "team     19", "Name: users, dtype: int64"];
  // the teammate's script, docs/ai-path/runs/s1-py-envs-packaging/demo/demo_report.py
  const SCRIPT = [
    "# The teammate's demo script: total this week's sign-ups per plan.",
    "import pandas as pd",
    "",
    'signups = pd.read_csv("signups.csv")',
    'print(signups.groupby("plan")["users"].sum())'
  ];
  // "== laptop: uv pip freeze" and "== server: uv pip freeze"
  const LAPTOP = ["numpy==1.26.4", "pandas==2.1.4", "python-dateutil==4.0.0", "pytz==2023.3.post1", "tzdata==2023.3"];
  const SERVER = ["numpy==2.5.4", "pandas==2.1.4", "python-dateutil==4.0.0", "pytz==2026.6", "tzdata==2026.6"];
  // "== server: uv pip check"
  const CHECK = ["…", "Found 1 incompatibility", "The package `pandas` requires `numpy>=1.26.0,<2 ; python_full_version >= '3.12'`, but `2.5.4` is installed"];
  // the server's history: last week, then last night
  const HIST_WEEK = [
    "$ cat requirements.txt",
    "pandas==2.1.4",
    "…",
    "$ uv pip install --python .venv/server -r requirements.txt",
    "Using Python 3.12.11 environment at: .venv/server",
    " + numpy==1.26.4",
    " + pandas==2.1.4",
    " + python-dateutil==4.0.0",
    " + pytz==2026.6",
    " + tzdata==2026.6"
  ];
  const HIST_NIGHT = [
    '$ uv pip install --python .venv/server "numpy>=2"',
    "Using Python 3.12.11 environment at: .venv/server",
    "Resolved 1 package in 2ms",
    "Uninstalled 1 package in 59ms",
    "Installed 1 package in 23ms",
    " - numpy==1.26.4",
    " + numpy==2.5.4"
  ];
  // docs/ai-path/runs/s1-py-envs-packaging/where.py
  const WHERE = [
    "# Which python? Where is numpy from?",
    "import os, sys",
    "import numpy",
    "",
    'print("prefix:",',
    "    os.path.relpath(sys.prefix))",
    'print("numpy", numpy.__version__,',
    '    "from",',
    "    os.path.relpath(numpy.__file__))"
  ];
  // "== demo: python where.py" and "== other: python where.py" (identical in where-rerun.out.txt)
  const WHERE_OUT = {
    demo: ["prefix: .venv/demo", "numpy 1.26.4 from .venv/demo/lib/python3.12/site-packages/numpy/__init__.py"],
    other: ["prefix: .venv/other", "numpy 2.5.4 from .venv/other/lib/python3.12/site-packages/numpy/__init__.py"]
  };
  // "== the fix": the two commands per project
  const FIX_CMDS = [
    "$ uv venv .venv/demo --python 3.12",
    "$ uv pip install --python .venv/demo -r requirements.txt",
    "$ uv venv .venv/other --python 3.12",
    '$ uv pip install --python .venv/other "numpy>=2"'
  ];
  // "== demo: cat .venv/demo/pyvenv.cfg" and "== demo: ls .venv/demo"
  const CFG = ["home = /opt/homebrew/opt/python@3.12/bin", "implementation = CPython", "uv = 0.10.12", "version_info = 3.12.11", "include-system-site-packages = false"];
  const VENV_LS = ["CACHEDIR.TAG", "bin", "lib", "pyvenv.cfg"];
  // "== demo: uv pip freeze"
  const DEMO = ["numpy==1.26.4", "pandas==2.1.4", "python-dateutil==4.0.0", "pytz==2026.6", "tzdata==2026.6"];

  /* ---------- Data copied from docs/ai-path/runs/s1-py-envs-packaging/run2-uv.out.txt ---------- */
  // "$ cat pyproject.toml (after uv add)"
  const PYPROJECT = [
    "[project]",
    'name = "demo-report"',
    'version = "0.1.0"',
    'description = "Add your description here"',
    'requires-python = ">=3.12"',
    "dependencies = [",
    '    "pandas==2.1.4",',
    "]",
    "",
    "[project.scripts]",
    'demo-report = "demo_report:main"',
    "",
    "[build-system]",
    'requires = ["uv_build>=0.10.12,<0.11.0"]',
    'build-backend = "uv_build"'
  ];
  // "$ grep -A2 "^name = " uv.lock": the name, version and source of every package (the "--" separators shown as …)
  const LOCK_PKGS = [
    ["demo-report", "0.1.0", "{ editable = \".\" }"],
    ["numpy", "1.26.4", "{ registry = \"https://pypi.org/simple\" }"],
    ["pandas", "2.1.4", "{ registry = \"https://pypi.org/simple\" }"],
    ["python-dateutil", "4.0.0", "{ registry = \"https://pypi.org/simple\" }"],
    ["pytz", "2026.6", "{ registry = \"https://pypi.org/simple\" }"],
    ["tzdata", "2026.6", "{ registry = \"https://pypi.org/simple\" }"]
  ];
  const LOCK_LINES = 80; // "$ wc -l uv.lock"
  // "== server copy": uv sync --locked (paths trimmed with …, the interpreter line and the Building/Built/Prepared lines cut)
  const SYNC = [
    "$ uv sync --locked",
    "…",
    "Creating virtual environment at: .venv",
    "Resolved 6 packages in 8ms",
    "…",
    "Installed 6 packages in 59ms",
    " + demo-report==0.1.0 (from file:///…/work/server)",
    " + numpy==1.26.4",
    " + pandas==2.1.4",
    " + python-dateutil==4.0.0",
    " + pytz==2026.6",
    " + tzdata==2026.6"
  ];
  // "== laptop, later" and "== server copy gets the edited pyproject.toml and the old uv.lock"
  const EDITED = ["dependencies = [", '    "pandas==2.1.4",', '    "tabulate>=0.9",', "]"];
  const STALE = [
    "$ uv sync --locked",
    "Resolved 7 packages in 11ms",
    "The lockfile at `uv.lock` needs to be updated, but `--locked` was provided. To update the lockfile, run `uv lock`.",
    "exit code: 1"
  ];
  // "== the fix, on the laptop" and "== server copy gets the new uv.lock" (Building/Built lines cut)
  const RELOCK = [
    "$ uv lock",
    "Resolved 7 packages in 7ms",
    "Added tabulate v0.10.0",
    "$ uv sync --locked",
    "Resolved 7 packages in 3ms",
    "…",
    " + tabulate==0.10.0",
    "exit code: 0"
  ];
  // "== packaging": cat pyproject.toml (after the tabulate line was locked), uv build, the wheel's contents
  const PYPROJECT_FINAL = [
    "[project]",
    'name = "demo-report"',
    'version = "0.1.0"',
    'description = "Add your description here"',
    'requires-python = ">=3.12"',
    "dependencies = [",
    '    "pandas==2.1.4",',
    '    "tabulate>=0.9",',
    "]",
    "",
    "[project.scripts]",
    'demo-report = "demo_report:main"',
    "",
    "[build-system]",
    'requires = ["uv_build>=0.10.12,<0.11.0"]',
    'build-backend = "uv_build"'
  ];
  const BUILD = [
    "$ uv build",
    "Building source distribution (uv build backend)...",
    "Building wheel from source distribution (uv build backend)...",
    "Successfully built dist/demo_report-0.1.0.tar.gz",
    "Successfully built dist/demo_report-0.1.0-py3-none-any.whl"
  ];
  const ENTRY = ["[console_scripts]", "demo-report = demo_report:main"];
  const META = ["Name: demo-report", "Version: 0.1.0", "Requires-Dist: pandas==2.1.4", "Requires-Dist: tabulate>=0.9", "Requires-Python: >=3.12"];

  /* ---------- Derived from the data above ---------- */
  const parse = list => new Map(list.map(s => s.split("==")));
  const LAP = parse(LAPTOP), SRV = parse(SERVER), DEM = parse(DEMO);
  const DIFF = SERVER.map((s, i) => i).filter(i => LAP.get(SERVER[i].split("==")[0]) !== SERVER[i].split("==")[1]);
  const NAME = i => SERVER[i].split("==")[0];
  const CAUSE = SERVER.findIndex(s => s.startsWith("numpy=="));
  const DRIFT = DEMO.filter(s => LAP.get(s.split("==")[0]) !== s.split("==")[1]).map(s => s.split("==")[0]);
  const ERR = TRACE.length - 1;
  const SIZES = TRACE[ERR].match(/\d+/g); // "Expected 96 … got 88"
  const SCRIPT_LINE = PYPROJECT_FINAL.findIndex(l => l.startsWith("demo-report ="));
  const PYTZ_LOCK = LOCK_PKGS.find(p => p[0] === "pytz");
  const major = v => v.split(".")[0];
  const NP_OLD = LAP.get("numpy"), NP_NEW = SRV.get("numpy");
  const caption = what => `<p class="${P}cap">${what}, run on our Mac with uv, ${RUN_DATE}</p>`;

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}term { font: 500 13.5px/1.5 var(--mono); background: var(--sunk); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-top: 12px; color: var(--ink); font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
      .${P}term .t { font: 600 12px var(--font); color: var(--muted); margin: 0 0 6px; }
      .${P}row { display: block; white-space: pre-wrap; overflow-wrap: anywhere; padding: 1px 0; }
      .${P}row.cmd { color: var(--ink-2); font-weight: 700; }
      .${P}row.mark { box-shadow: inset 3px 0 0 var(--ink); padding-left: 8px; }
      span.${P}row.bx { min-height: 44px; border: 1.5px solid transparent; border-radius: 6px; background: none; padding: 6px 8px; margin: 4px 0; }
      button.${P}row { width: 100%; text-align: left; min-height: 44px; font: inherit; color: var(--ink); background: var(--bg); border: 1.5px solid var(--line); border-radius: 6px; padding: 6px 8px; margin: 4px 0; cursor: pointer; }
      @media (hover: hover) { button.${P}row:not(.right):not(.wrong):hover { border-color: var(--ink); } }
      button.${P}row.right { border-color: var(--good); background: var(--good-soft); }
      button.${P}row.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      @media (max-width: 520px) { .${P}two.stack { grid-template-columns: 1fr; } }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}tb { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 15px; }
      .${P}tb td { border-top: 1px solid var(--line); padding: 8px 6px; vertical-align: top; }
    `;
    document.head.appendChild(s);
  }

  // a terminal or file block; pick(i) makes line i a button with data-l="<key><i>"; state(i) gives "right"/"wrong"/"mark"/"cmd"
  function term(lines, { title = "", pick = null, state = () => "", key = "", boxed = false } = {}) {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    return `<div class="${P}term">${title ? `<p class="t">${esc(title)}</p>` : ""}${lines.map((l, i) => {
      const st = state(i) || (l.startsWith("$ ") ? "cmd" : "");
      return pick && pick(i)
        ? `<button type="button" class="${P}row ${st}" data-l="${key}${i}">${esc(l) || " "}</button>`
        : `<span class="${P}row ${st}${boxed ? " bx" : ""}">${esc(l) || " "}</span>`;
    }).join("")}</div>`;
  }

  /* 1. The situation: read the crash from the bottom. */
  function situation({ el, done, kit }) {
    css();
    let picked = null;
    const paint = () => {
      const ok = picked === ERR;
      el.innerHTML = `<h1>It ran yesterday. Today it crashes.</h1>
        <p class="lead">Your teammate wrote a short script that totals this week's sign-ups per plan. On their laptop it prints the totals. This morning, an hour before the demo, they run the same file on the team's shared server and get this instead.</p>
        <p class="lead">We made this crash for real on one Mac. Folders under <code>.venv/</code> stand in for the laptop and the server. Long paths are cut with …</p>
        <p class="lead">This lesson is about making Python code run the same on every machine. Every AI service you ship needs that first.</p>
        <p class="task">This error report is called a <b>traceback</b>. Python prints the first call at the top and the error at the bottom. Tap the line that says what went wrong.</p>
        ${term(TRACE, { title: "server: python demo_report.py", pick: i => i > 0, state: i => i === picked ? (ok ? "right" : "wrong") : "" })}
        ${caption("Real output")}
        <div class="lpanel">${picked == null ? "" : ok
          ? kit.feedback(`Right. Read a traceback from the bottom: the last line is the error, the lines above are how Python got there. Here pandas has compiled code that expects a numpy object of one size (${SIZES[0]}) and finds another (${SIZES[1]}), and it says <i>binary incompatibility</i>. Look where it stopped: line 2 of the script, <code>import pandas as pd</code>. The script never reached its own work. The same file runs on the laptop, so the code is not the problem. Something about the server's Python is.`, true)
          : picked <= 2 ? kit.feedback("This is where the teammate's script was when it went wrong: line 2, the import. It is the first step of the chain, not the error. The error is reported on the last line, after every step Python took inside pandas.", false)
          : kit.feedback("This is one step inside pandas, on the way down to the error. Each <code>File …</code> line is a call that was running. The error itself is printed last, under all of them.", false)}</div>`;
      el.querySelectorAll("button[data-l]").forEach(b => b.onclick = () => { picked = +b.dataset.l; paint(); if (picked === ERR) done(); });
    };
    paint();
  }

  /* 2. By hand: compare the two installed-package lists. */
  function byHand({ el, done, kit }) {
    css();
    let picked = null;
    const paint = () => {
      const ok = picked === CAUSE;
      const fb = () => {
        if (picked == null) return "";
        if (ok) return kit.feedback(`Right. numpy is ${NP_OLD} on the laptop and ${NP_NEW} on the server: a new major version (${major(NP_OLD)} to ${major(NP_NEW)}). NumPy's 2.0 release notes say packages with compiled code built against NumPy 1 will not work with NumPy 2, and pandas' notes name 2.2.2 as its first release that works with both. This server has pandas ${SRV.get("pandas")}. ${WORDS[DIFF.length]} lines differ between the lists, and one of them is the cause. uv can check an environment for this kind of clash:`, true)
          + term(CHECK, { title: "server: uv pip check" });
        const n = NAME(picked);
        if (!DIFF.includes(picked)) return kit.feedback(`${kit.esc(SERVER[picked])} is the same on both machines. A package that did not change cannot explain why one machine fails and the other works.`, false);
        return kit.feedback(`${kit.esc(n)} differs (${kit.esc(LAP.get(n))} on the laptop, ${kit.esc(SRV.get(n))} here), so this difference is worth fixing later. But it is time-zone data, and the traceback never passed through it. The last line names <code>numpy.dtype</code>.`, false);
      };
      el.innerHTML = `<h1>Two lists, one difference that matters</h1>
        <p class="lead">The team uses uv, a Python package and project manager (it does the job npm does for JavaScript). Your teammate runs <code>uv pip freeze</code> on both machines. It lists every installed package with its exact version.</p>
        <p class="task">Tap the line in the server list that breaks <code>import pandas</code>.</p>
        <div class="${P}two">
          ${term(LAPTOP, { title: "laptop (works)", boxed: true })}
          ${term(SERVER, { title: "server (crashes)", pick: () => true, state: i => i === picked ? (ok ? "right" : "wrong") : "" })}
        </div>
        ${caption("Real output")}
        <div class="lpanel">${fb()}</div>`;
      el.querySelectorAll("button[data-l]").forEach(b => b.onclick = () => { picked = +b.dataset.l; paint(); if (picked === CAUSE) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: one environment per project. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      `Add <code>numpy==${NP_OLD}</code> to the demo's requirements.txt and reinstall on the server`,
      "Give each project its own environment on the server: the demo's holds its numpy, the other team's holds theirs",
      "Upgrade pandas on the server to a release that works with numpy 2"
    ];
    const paint = () => {
      el.innerHTML = `<h1>How did numpy ${major(NP_NEW)} get there?</h1>
        <p class="lead">The demo's requirements.txt names only pandas. The server history shows what happened: every team installs into the same one Python <b>environment</b>: one shared set of installed packages, like one <code>node_modules</code> folder for everyone. Last night another team needed numpy ${major(NP_NEW)} for their own tool.</p>
        ${term(HIST_WEEK, { title: "server, last week: the demo team" })}
        ${term(HIST_NIGHT, { title: "server, last night: another team" })}
        ${caption("Real output")}
        <p class="task">The other team really needs numpy ${major(NP_NEW)}. Which change stops one team's install from breaking another team's project?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. One environment can hold only one numpy, so whoever installs last wins. Notice uv replaced ${NP_OLD} with ${NP_NEW} without a word about pandas. Give each project its own folder of packages and the two never meet. That folder is a <b>virtual environment</b>: a private set of packages built on top of a shared Python.`, true)
          : ans === 0 ? kit.feedback(`That puts ${NP_OLD} back, and breaks the other team's tool, which needs ${major(NP_NEW)}. Then their next install flips it again. A version pin says what to install. It cannot protect an environment that other people install into.`, false)
          : kit.feedback("It may fix today. But the laptop still has the old pandas, so the two machines now run different code. And both projects still share one environment: the next team's install can change any package under them again.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it, with predictions: two environments, one script. */
  function twoEnvs({ el, done, kit }) {
    css();
    const ans = [null, null];
    const vers = [NP_OLD, NP_NEW].sort();
    const right = [vers.indexOf(NP_OLD), vers.indexOf(NP_NEW)];
    const envs = ["demo", "other"];
    const paint = () => {
      const all = ans.every((a, i) => a === right[i]);
      el.innerHTML = `<h1>Two environments, one script</h1>
        <p class="lead">On the server you make one environment per project with <code>uv venv</code>. Then you install each project's packages into its own environment (<code>--python</code> names which one). Last, you run the same small script with each environment's python.</p>
        ${term(FIX_CMDS, { title: "server" })}
        ${kit.code(WHERE, -1)}
        <p class="task">Predict the numpy version each run prints.</p>
        ${envs.map((e, i) => `<div class="lcase" id="c${i}"><p><code>.venv/${e}/bin/python where.py</code></p>${kit.options(vers.map(v => "numpy " + v), { picked: ans[i], correct: right[i] })}${ans[i] == null ? "" : ans[i] === right[i]
          ? kit.feedback(`Yes: ${kit.esc(WHERE_OUT[e][1].split(" from ")[0])}.`, true)
          : kit.feedback(i === 0
            ? `The other team's numpy ${NP_NEW} went into <code>.venv/other</code>. The python in <code>.venv/demo</code> looks for packages only in its own folder, where ${NP_OLD} was installed.`
            : `numpy ${NP_OLD} sits in <code>.venv/demo</code>'s folder. <code>.venv/other</code> holds only what was installed into it: <code>"numpy>=2"</code>, which gave ${NP_NEW}.`, false)}</div>`).join("")}
        ${all ? `<div class="${P}two stack">${term(WHERE_OUT.demo, { title: "demo" })}${term(WHERE_OUT.other, { title: "other" })}</div>
          ${term(CFG, { title: ".venv/demo/pyvenv.cfg", state: i => CFG[i].startsWith("home") || CFG[i].startsWith("include") ? "mark" : "" })}
          ${caption("Real output")}
          ${kit.feedback(`Each environment is just a folder (${VENV_LS.filter(f => f !== "CACHEDIR.TAG").join(", ")}). Its <code>bin/python</code> runs on top of the base Python named on the marked <code>home</code> line. <code>sys.prefix</code> points at the folder, so imports come from its own <code>lib/…/site-packages</code>. <code>include-system-site-packages = false</code> hides the base Python's packages. Running <code>source .venv/demo/bin/activate</code> only makes the word <code>python</code> in your shell mean this folder's python; calling it by its path, as here, works without it. The folder is disposable: you rebuild it, you never copy it or commit it.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === right[j])) done();
      }));
    };
    paint();
  }

  /* 5. The second problem: unpinned packages drift. */
  function drift({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "requirements.txt names only pandas, so every package pandas pulls in is picked fresh on the day you install",
      "<code>.venv/demo</code> still sees the shared environment's packages",
      "The server runs a different Python version"
    ];
    const paint = () => {
      el.innerHTML = `<h1>Fixed, but still not the same</h1>
        <p class="lead">The demo now runs on the server from <code>.venv/demo</code>. Compare it with the laptop, which installed the same requirements.txt months ago. (On our Mac, the laptop's older versions were pinned (fixed to exact versions) to stand in for that earlier install.)</p>
        <div class="${P}two">
          ${term(LAPTOP, { title: "laptop", state: i => DRIFT.includes(LAPTOP[i].split("==")[0]) ? "mark" : "" })}
          ${term(DEMO, { title: "server .venv/demo", state: i => DRIFT.includes(DEMO[i].split("==")[0]) ? "mark" : "" })}
        </div>
        ${caption("Real output")}
        <p class="task">${DRIFT.join(" and ")} still differ (marked). Why?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0
          ? kit.feedback(`Right. requirements.txt pins one package. The other ${plural(DEMO.length - 1, "package")} come along because pandas needs them, and each install takes the newest version pandas allows on that day. Harmless today. Next time it could be numpy again. The fix is to record the exact version of <b>every</b> package once, in a file, and install from that file everywhere. That file is a <b>lock file</b>.`, true)
          : ans === 1 ? kit.feedback("No: its pyvenv.cfg says <code>include-system-site-packages = false</code>, and its numpy came from its own folder on the last screen. These versions were installed into <code>.venv/demo</code> itself.", false)
          : kit.feedback("Both environments use Python 3.12.11: the install output says <code>Using Python 3.12.11 environment</code> for each. The difference is in the packages chosen, not in Python.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 6. The real tool: pyproject.toml says what you ask for, uv.lock says exactly what you get. */
  const LOCK_VIEW = LOCK_PKGS.flatMap(([n, v, s], i) => [...(i ? ["…"] : []), `name = "${n}"`, `version = "${v}"`, `source = ${s}`]);
  const PYTZ_LINE = LOCK_VIEW.indexOf(`version = "${PYTZ_LOCK[1]}"`, LOCK_VIEW.indexOf(`name = "pytz"`));
  function lockFile({ el, done, kit }) {
    css();
    let picked = null; // "p3" or "k12"
    const paint = () => {
      const ok = picked === "k" + PYTZ_LINE;
      const st = key => i => picked === key + i ? (picked === "k" + PYTZ_LINE ? "right" : "wrong") : "";
      const fb = () => {
        if (picked == null) return "";
        if (ok) return kit.feedback(`Right. <code>pyproject.toml</code> holds what <b>you ask for</b>: your direct dependencies, which may be ranges. <code>uv.lock</code> holds what <b>you get</b>: the exact version and source of all ${LOCK_PKGS.length} packages (the project included), the whole tree. uv writes it; you never edit it by hand. Commit both files. uv's docs say the lock is cross-platform, so one file serves a Mac laptop and a Linux server alike. The <code>.venv</code> folder stays out of git.`, true);
        const k = picked[0], i = +picked.slice(1), line = (k === "p" ? PYPROJECT : LOCK_VIEW)[i];
        if (k === "p" && line.includes("pandas")) return kit.feedback("That pins pandas. pytz is not in pyproject.toml at all: pandas pulls it in. You only list what your own code imports.", false);
        if (k === "p" && (line.startsWith("dependencies") || line === "]")) return kit.feedback("This list holds only what your code imports directly; pytz is not in it.", false);
        if (k === "p") return kit.feedback("That line is about the project itself, not about pytz. pytz never appears in pyproject.toml.", false);
        if (line.includes("pytz")) return kit.feedback("Close: that names pytz. Its exact version is on the line below it.", false);
        return kit.feedback(`That line belongs to another package in the lock, not pytz.`, false);
      };
      el.innerHTML = `<h1>Ask for one, lock them all</h1>
        <p class="lead">Your teammate turns the script into a uv project: <code>uv init --package demo-report</code>, then <code>uv add pandas==2.1.4</code>. uv writes two files: <code>pyproject.toml</code> and <code>uv.lock</code>. <code>uv add</code> installs today's versions into the project's own <code>.venv</code> and records them in the lock. So the lock has pytz ${PYTZ_LOCK[1]}, not the laptop's old ${LAP.get("pytz")}. The lock file has ${LOCK_LINES} lines. Below are the name, version and source (where it is downloaded from) of each package in it.</p>
        <p class="task">Tap the line that sets pytz's exact version.</p>
        <div class="${P}two stack">
          ${term(PYPROJECT.slice(0, 8), { title: "pyproject.toml (top)", key: "p", pick: i => PYPROJECT[i] !== "", state: st("p") })}
          ${term(LOCK_VIEW.slice(LOCK_VIEW.indexOf('name = "numpy"')), { title: "uv.lock (from numpy on)", key: "k", boxed: true, pick: i => LOCK_VIEW[i + LOCK_VIEW.indexOf('name = "numpy"')] !== "…", state: i => st("k")(i + LOCK_VIEW.indexOf('name = "numpy"')) })}
        </div>
        ${caption("Real files")}
        <div class="lpanel">${fb()}</div>`;
      const off = LOCK_VIEW.indexOf('name = "numpy"');
      el.querySelectorAll("button[data-l]").forEach(b => b.onclick = () => {
        const d = b.dataset.l;
        picked = d[0] === "k" ? "k" + (+d.slice(1) + off) : d;
        paint();
        if (picked === "k" + PYTZ_LINE) done();
      });
    };
    paint();
  }

  /* 7. Predict what the server installs from the lock. */
  function syncServer({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [`pytz ${PYTZ_LOCK[1]}, the version in uv.lock`, "The newest pytz on the day of the install", "Whatever pytz the shared server environment has"];
    const paint = () => {
      el.innerHTML = `<h1>Same lock, same packages</h1>
        <p class="lead">The server gets <code>pyproject.toml</code>, <code>uv.lock</code> and the code from git, and runs <code>uv sync --locked</code>. <code>sync</code> makes the project's own <code>.venv</code> match the lock exactly. <code>--locked</code> means: if the lock does not match pyproject.toml, stop with an error instead of rewriting the lock.</p>
        <p class="task">Months later pytz has a newer release. Which pytz does <code>uv sync --locked</code> install on a fresh server?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0
          ? kit.feedback(`Right. uv's docs say a new release does not make the lock outdated; only a change to pyproject.toml does. Here is the real sync on our server copy: every version matches the lock, so the server now has exactly what the laptop's project <code>.venv</code> has. To take a newer pytz you decide it: <code>uv lock --upgrade-package pytz</code>, test, commit the new lock.`, true)
            + term(SYNC, { title: "server copy", state: i => SYNC[i].includes("pytz") ? "mark" : "" }) + caption("Real output")
          : ans === 1 ? kit.feedback("That is what requirements.txt did on screen 5: pick fresh on the day. A lock exists to stop that. New releases do not change what the lock says.", false)
          : kit.feedback("<code>uv sync</code> installs into the project's own <code>.venv</code> folder, next to pyproject.toml. The shared environment is not involved.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 8. Broken on purpose: a hand edit and a stale lock. */
  function staleLock({ el, done, kit }) {
    css();
    let cause = null, fix = null;
    const causes = [
      "pyproject.toml now asks for tabulate, but uv.lock was made before that line existed",
      "tabulate could not be found on the package index",
      "The --locked flag is broken in this uv version"
    ];
    const fixes = [
      "Remove --locked on the server, so it updates the lock itself",
      "On the laptop run uv lock (next time: uv add tabulate), then commit pyproject.toml and uv.lock together",
      "Open uv.lock in an editor and add a tabulate entry"
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: the deploy refuses</h1>
        <p class="lead">A week later your teammate wants nicer tables. They add a line to pyproject.toml by hand and push. The server runs the same deploy command as before, <code>uv sync --locked</code>.</p>
        ${term(EDITED, { title: "pyproject.toml, after the edit", state: i => i === 2 ? "mark" : "" })}
        ${term(STALE, { title: "server" })}
        ${caption("Real output")}
        <div class="lcase" id="cause"><p class="task">What is the cause?</p>${kit.options(causes, { picked: cause, correct: 0 })}
        ${cause == null ? "" : cause === 0 ? kit.feedback("Right. uv compares the lock with pyproject.toml. A new dependency means the lock no longer matches, and <code>--locked</code> turns that into an error.", true)
          : cause === 1 ? kit.feedback("uv says <code>Resolved 7 packages</code>: one more than before, so it found tabulate. The error is about the lock file, not the index.", false)
          : kit.feedback("The flag did its job: it refused to install from a lock that no longer matches pyproject.toml. That is what it is for.", false)}</div>
        ${cause === 0 ? `<div class="lcase" id="fix"><p class="task">What is the fix?</p>${kit.options(fixes, { picked: fix, correct: 1 })}
        ${fix == null ? "" : fix === 1 ? kit.feedback("Right. The lock is made once, on purpose, and travels with the code. Here is the real fix: re-lock on the laptop, then the same server command succeeds and adds only tabulate.", true)
            + term(RELOCK, { title: "laptop, then server", state: i => RELOCK[i].includes("tabulate") ? "mark" : "" }) + caption("Real output")
          : fix === 0 ? kit.feedback("Then the server writes its own lock, which matches nothing in git, and any new dependency is picked on the day. The point of the lock is that one reviewed file decides the versions everywhere.", false)
          : kit.feedback("uv's docs say the lock file is managed by uv and should not be edited by hand. Exact versions for every platform are worked out by the resolver, not typed.", false)}</div>` : ""}`;
      const bind = (id, set) => el.querySelectorAll(`#${id} .lopts button`).forEach(b => b.onclick = () => { set(+b.dataset.i); paint(); if (cause === 0 && fix === 1) done(); });
      bind("cause", v => { cause = v; });
      bind("fix", v => { fix = v; });
    };
    paint();
  }

  /* 9. Packaging: a command others can install. */
  function packaging({ el, done, kit }) {
    css();
    let line = null, ans = null;
    const paint = () => {
      const ok = line === SCRIPT_LINE;
      const why = i => {
        const l = PYPROJECT_FINAL[i];
        if (l.startsWith("name")) return "That is the package's name: what you install. A command needs a second piece: which function to run when someone types it.";
        if (l.startsWith("[project.scripts]")) return "Close: that header opens the table of commands. Tap the line inside it that names the command and its function.";
        if (l.includes("uv_build") || l.startsWith("[build-system]")) return "That tells installers which tool builds the package. It makes building possible, but it does not name any command.";
        if (l.includes("==") || l.includes(">=0.9") || l.startsWith("dependencies")) return "That lists what the package needs installed with it. It does not create a command.";
        return "That line does not create a command. Look for one that names a function.";
      };
      el.innerHTML = `<h1>From a script to a package</h1>
        <p class="lead">The data team wants the report on their own machines. Because the project was made with <code>--package</code>, the code lives in <code>src/demo_report/__init__.py</code> as a function <code>main()</code>, and <code>uv build</code> turns it into two files others can install.</p>
        ${term(BUILD, { title: "laptop" })}
        <div class="lcase" id="q0"><p class="task">They will install the wheel (the <code>.whl</code> file, Python's ready-to-install package format) and type <code>demo-report</code>. Which line makes that command exist?</p>
        ${term(PYPROJECT_FINAL, { title: "pyproject.toml", pick: i => PYPROJECT_FINAL[i] !== "", state: i => i === line ? (ok ? "right" : "wrong") : "" })}
        ${line == null ? "" : ok ? kit.feedback("Right. <code>[project.scripts]</code> maps a command name to <code>module:function</code>. The build copies it into the wheel, and installing the wheel creates the command.", true) + term(ENTRY, { title: "inside the wheel: entry_points.txt" })
          : kit.feedback(why(line), false)}</div>
        ${ok ? `<div class="lcase" id="q1"><p class="task">This is the wheel's metadata. Does someone who installs the wheel get uv.lock's exact pytz ${PYTZ_LOCK[1]}?</p>
          ${term(META, { title: "inside the wheel: METADATA" })}
          ${caption("Real output")}
          ${kit.options([`Yes, the lock goes into the wheel`, "No: the wheel only carries what pyproject.toml asks for"], { picked: ans, correct: 1 })}
          ${ans == null ? "" : ans === 1 ? kit.feedback("Right. The metadata has no numpy line and no pytz line: only pyproject.toml's dependencies travel with a package. Their installer picks the rest on their machine. So a lock protects <b>your</b> running app or service. A package you hand to others should list in pyproject.toml the version ranges it really works with, and they lock their own project.", true)
            : kit.feedback(`Read the metadata: it lists pandas and tabulate, and no pytz. The lock is not inside the wheel, so their installer picks whatever pytz is newest on their day, as it did on screen 5.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q0 button[data-l]").forEach(b => b.onclick = () => { line = +b.dataset.l; paint(); });
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. The big picture. */
  const TOOLS = ["Own environment + lock file", "Installable package", "Container image"];
  const BIG = [
    ["Two services on one machine need different major versions of the same library.", 0,
      "Two sets of packages that must not meet: one environment each, with a lock so every machine gets the same set."],
    ["Three projects copy the same sign-up cleaning functions, and fixes go missing.", 1,
      "Code that other projects import: package it once with a pyproject.toml, give it a version, and let each project depend on it."],
    ["A service needs a particular system library and command-line tool on every server, not just Python packages.", 2,
      "A virtual environment holds Python packages only, on top of the machine's own Python and system. An image carries the files, binaries, libraries and configuration the service needs to run."]
  ];
  const BIG_WRONG = {
    "0-1": "A package helps others import your code. It does not keep two versions of the same library apart on one machine.",
    "0-2": "A container would work, but it is heavy for this: both needs are Python packages, and one environment per service already keeps them apart.",
    "1-0": "An environment keeps packages apart; it does not share your functions between projects. Copies still drift.",
    "1-2": "An image ships a whole runtime. The problem here is shared code, which a versioned package solves.",
    "2-0": "A virtual environment cannot hold a system library or a command-line tool. It sits on top of what the machine already has.",
    "2-1": "A package declares Python dependencies. It cannot install a system library or a command-line tool."
  };
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <table class="${P}tb"><tbody>
          <tr><td><b>For</b></td><td>Run each project with exactly the packages it was tested with, on any machine.</td></tr>
          <tr><td><b>Reach for</b></td><td>An environment per project, always. A lock for anything that runs in more than one place. A package when other code installs yours.</td></tr>
          <tr><td><b>Not for</b></td><td>System libraries and tools outside Python: a virtual environment holds Python packages only. Use a container image, a packaged copy of the files, libraries and tools a service needs (the kernel and GPU drivers still come from the host).</td></tr>
          <tr><td><b>Costs</b></td><td>Disk for every environment. A lock also freezes out bug and security fixes until someone upgrades on purpose, tests and commits.</td></tr>
        </tbody></table>
        <p class="task">Pick the tool each situation needs.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(TOOLS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === r ? yes : BIG_WRONG[`${i}-${ans[i]}`]), ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 11. Recognise it, including cases where an environment and a lock do not help. */
  const CASES = [
    ["A notebook works for you. A colleague opens the same folder and gets ModuleNotFoundError for a plotting library.", true,
      "Yes. The project's dependencies live only in your environment. Declare them in pyproject.toml, lock, and your colleague runs one sync.",
      "The code is fine; their environment is missing a package yours has. Declared dependencies plus a lock let them build the same environment with one sync."],
    ["The report gives a different total on the server. Both freeze lists are identical, and the server's CSV has an extra day in it.", false,
      "No. The packages already match exactly. The inputs differ, so the outputs differ: fix the data, not the environment.",
      "A lock makes packages match, and they already do. The difference is the input file: the extra day changes the total. No environment change can fix that."],
    ["With the same uv.lock on both machines, an image library imports on the laptop but fails on the server: a system library file (.so) that it loads is missing.", false,
      "No. The missing file belongs to the operating system, not to any Python package, so the lock cannot install it. Install it with the system's package manager, or ship a container image that includes it.",
      "The lock already matches. The error names a system file outside every Python package, which an environment cannot hold. That needs the system's package manager or a container image."],
    ["A CI job passes on Monday and fails on Tuesday with no code change. Its install step runs pip install -r requirements.txt, which lists two packages.", true,
      "Yes. Unpinned packages under those two were picked fresh on Tuesday. Lock the whole tree and install with uv sync --locked.",
      "No code changed, so something the install picked did. The packages under the two named ones are chosen fresh each run. A lock stops that."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would an environment and a lock fix it?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the demo.</p>
        <p class="task">For each one, decide whether its own environment plus a lock file fixes it. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next (in-page practice: nothing extra). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>One project, one environment, one lock</h1>
      <p class="lead">You read a crash from the bottom, found the one version that broke it, and fixed it in three layers.</p>
      <table class="${P}tb"><tbody>
        <tr><td><b>Environment</b></td><td>A folder with its own python and packages. Nobody else's install reaches it. Disposable: rebuild, never copy or commit.</td></tr>
        <tr><td><b>Lock</b></td><td>pyproject.toml says what you ask for; uv.lock says exactly what you get. Commit both, deploy with <code>uv sync --locked</code>, upgrade on purpose.</td></tr>
        <tr><td><b>Package</b></td><td><code>[project.scripts]</code> plus <code>uv build</code> gives a wheel others install. It carries pyproject.toml's dependencies, not your lock.</td></tr>
      </tbody></table>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. The script you just packaged trusted its CSV; that lesson checks data like it at the door.</p>` : ""}`;
    done();
  }

  LessonKit.define("s1-py-envs-packaging", {
    title: "Virtual environments and packaging",
    checked: "2026-11-13",
    sources: [
      "https://docs.python.org/3/library/venv.html",
      "https://docs.astral.sh/uv/concepts/projects/init/",
      "https://docs.astral.sh/uv/concepts/projects/layout/",
      "https://docs.astral.sh/uv/concepts/projects/sync/",
      "https://docs.astral.sh/uv/concepts/projects/build/",
      "https://packaging.python.org/en/latest/guides/writing-pyproject-toml/",
      "https://numpy.org/doc/stable/release/2.0.0-notes.html",
      "https://pandas.pydata.org/docs/whatsnew/v2.2.2.html",
      "https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/",
      "https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/",
      "https://docs.docker.com/engine/containers/gpu/"
    ],
    interview: [{
      q: "A Python service works on your laptop but fails on the server at startup with an error from inside a library's import. Nothing in your code changed. How do you find the cause and stop it happening again?",
      good: [
        "Read the traceback from the bottom: the last line is the error, the lines above show it failed during the import",
        "Compare the exact installed versions on both machines (uv pip freeze or pip freeze) and look for the one that matters to the failing import",
        "Check the environment for conflicts (uv pip check) and whether other projects install into the same environment",
        "Fix: one environment per project, a lock file committed with the code, deploy with uv sync --locked",
        "Upgrade on purpose: re-lock, test, commit, instead of letting each install pick new versions"
      ],
      weak: "Reinstall or upgrade everything on the server to the latest versions. It may work today, but the machines still differ and the next install can break it again."
    }, {
      q: "A teammate says: our pyproject.toml already lists our dependencies, so committing uv.lock is just noise. What do you answer?",
      good: [
        "pyproject.toml lists what we ask for, often as ranges, and only our direct dependencies",
        "uv.lock records the exact version and source of every package in the tree, so every machine and CI run gets the same set",
        "With --locked, CI fails when someone edits pyproject.toml without re-locking, instead of quietly changing versions",
        "For a library we publish, users install from the pyproject ranges, so the ranges must be honest; the lock protects our own runs"
      ],
      weak: "Agreeing, or pinning everything with == in pyproject.toml instead. That misses the packages we never named and makes a published package hard for others to install."
    }],
    screens: [situation, byHand, spotIdea, twoEnvs, drift, lockFile, syncServer, staleLock, packaging, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-l="2"]'], right: [`[data-l="${ERR}"]`] },
      { wrong: [`[data-l="${DIFF.find(i => i !== CAUSE)}"]`], right: [`[data-l="${CAUSE}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-l="p${PYPROJECT.findIndex(l => l.includes("pandas=="))}"]`], right: [`[data-l="k${PYTZ_LINE - LOCK_VIEW.indexOf('name = "numpy"')}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#cause [data-wrong]"], right: ["#cause [data-right]", "#fix [data-right]"] },
      { wrong: ['#q0 [data-l="1"]'], right: [`#q0 [data-l="${SCRIPT_LINE}"]`, "#q1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
