/* Lesson s6-docker-ai-service: packaging an AI service with Docker.
   Story: Dana, the one developer at a small clinic, wrote a service that summarises appointment notes. It works on
   her Mac. On the server, the container crashes at start with a missing library.
   Ideas: (1) an image holds only what the Dockerfile puts in it, so dependencies are written down and pinned;
   (2) every step that changes files (RUN, COPY) makes a layer, and once one layer changes every layer after it is rebuilt, so the slow
   step (pip install) goes before the code that changes often; (3) layers never shrink, so model files stay out of
   the image (.dockerignore) and are mounted when the container starts.
   Depth: explain (screens 1, 4, 9, 10, interview), library (screens 2, 5, 7, 8: real builds with Docker),
   debug (screen 1: a real traceback; screen 6: a real image history where "rm -rf models" did not shrink it;
   screen 8: a real run without --host 0.0.0.0).
   Data, all real, run on this Mac with Docker Desktop on 2026-11-13 (docs/ai-path/runs/s6-docker-ai-service/):
   run_all.sh made 1-*.out.txt to 7-*.out.txt, run_host.sh made 8-*.out.txt, env.txt has the versions. The model
   is a stand-in: 80 MiB of random bytes read by NumPy, so the builds need no download and no API key. No model
   API was called for this lesson.
   Lesson-local style (.lx-s6-docker-ai-service-*): log blocks and tappable lines, see ensureStyle().
   Every number on screen is computed here from RUN. Plain browser script. */
(() => {
  const ID = "s6-docker-ai-service";
  const P = `lx-${ID}-`;
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = n => WORDS[n] || String(n);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const fmt = n => n.toLocaleString("en");

  /* ---------- Data copied from the runs (docs/ai-path/runs/s6-docker-ai-service/), trimmed with … , not altered ---------- */
  const RUN = {
    date: "2026-11-13",
    // Dockerfile.first and requirements.first.txt: the files as Dana first wrote them
    dockerfileFirst: [
      "FROM python:3.12-slim",
      "WORKDIR /app",
      "COPY . .",
      "RUN pip install --no-cache-dir -r requirements.txt",
      "CMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]"
    ],
    reqFirst: ["fastapi", "uvicorn"],
    reqUnpinned: ["fastapi", "uvicorn", "numpy"],
    // app/main.py, lines 1 to 4
    mainTop: ["import os", "import numpy as np", "from fastapi import FastAPI", "from pydantic import BaseModel"],
    // 1-first-run.out.txt: first two lines and last three lines of the traceback (middle cut)
    traceHead: ["Traceback (most recent call last):", "  File \"/usr/local/bin/uvicorn\", line 8, in <module>"],
    traceTail: ["  File \"/app/main.py\", line 2, in <module>", "    import numpy as np", "ModuleNotFoundError: No module named 'numpy'"],
    // requirements.pinned.txt: pip freeze inside the unpinned image
    pinned: ["annotated-doc==0.0.6", "annotated-types==0.8.0", "anyio==4.16.0", "click==8.5.1", "fastapi==0.162.6", "h11==0.16.0", "idna==3.20", "numpy==2.5.4", "opentelemetry-api==1.45.2", "pydantic==2.14.3", "pydantic_core==2.50.4", "starlette==1.10.0", "typing-inspection==0.4.5", "typing_extensions==4.16.0", "uvicorn==0.54.0"],
    // the one-line change to main.py (app/main.py line 19, then 3-the-one-line-change.out.txt)
    lineBefore: "    return {\"summary\": sentences[0] + \".\", \"sentences\": len(sentences), \"model_bytes\": int(weights.size)}",
    lineAfter: "    return {\"summary\": \". \".join(sentences[:2]) + \".\", \"sentences\": len(sentences), \"model_bytes\": int(weights.size)}",
    // 1-first-build.out.txt, the build context line
    contextFirst: "#5 transferring context: 83.91MB 3.8s done",
    // 3-first-order-build-b.out.txt: the rebuild after the one-line change, one entry per Dockerfile step
    rebuildFirst: [
      { step: 0, head: "#5 [1/4] FROM docker.io/library/python:3.12-slim@sha256:5e2bdb1b0d54 …", res: "#5 DONE 0.1s", ran: false },
      { step: 1, head: "#6 [2/4] WORKDIR /app", res: "#6 CACHED", ran: false },
      { step: 2, head: "#7 [3/4] COPY . .", res: "#7 DONE 0.7s", ran: true },
      { step: 3, head: "#8 [4/4] RUN pip install --no-cache-dir -r requirements.txt", mid: "#8 2.704 Collecting annotated-doc==0.0.6 (from -r requirements.txt (line 1)) …", res: "#8 DONE 10.4s", ran: true }
    ],
    // Dockerfile.reordered
    dockerfileReordered: [
      "FROM python:3.12-slim",
      "WORKDIR /app",
      "COPY requirements.txt .",
      "RUN pip install --no-cache-dir -r requirements.txt",
      "COPY . .",
      "CMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]"
    ],
    // 4-reordered-build-b.out.txt: the rebuild after the same one-line change
    rebuildReordered: [
      { head: "#5 [1/5] FROM docker.io/library/python:3.12-slim@sha256:5e2bdb1b0d54 …", res: "#5 DONE 0.0s" },
      { head: "#6 [2/5] WORKDIR /app", res: "#6 CACHED" },
      { head: "#7 [3/5] COPY requirements.txt .", res: "#7 CACHED" },
      { head: "#8 [4/5] RUN pip install --no-cache-dir -r requirements.txt", res: "#8 CACHED" },
      { head: "#9 [5/5] COPY . .", res: "#9 DONE 0.5s" }
    ],
    // Dockerfile.rm-model
    dockerfileRm: [
      "FROM python:3.12-slim",
      "WORKDIR /app",
      "COPY requirements.txt .",
      "RUN pip install --no-cache-dir -r requirements.txt",
      "COPY . .",
      "RUN rm -rf models",
      "CMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]"
    ],
    // 5-rm-model-ls.out.txt: ls -la /app inside that image
    lsRm: ["drwxr-xr-x 1 root root 4096 Nov 13 14:56 .", "drwxr-xr-x 1 root root 4096 Nov 13 14:56 ..", "-rw-r--r-- 1 root root  604 Nov 13 14:56 main.py", "-rw-r--r-- 1 root root  274 Nov 13 14:55 requirements.txt"],
    // 5-rm-model-history.out.txt: docker image history, CREATED BY and SIZE columns, newest first
    historyRm: [
      ["CMD [\"uvicorn\" \"main:app\" \"--host\" \"0.0.0.0\"…", "0B"],
      ["RUN /bin/sh -c rm -rf models # buildkit", "8.19kB"],
      ["COPY . . # buildkit", "83.9MB"],
      ["RUN /bin/sh -c pip install --no-cache-dir -r…", "98.3MB"],
      ["COPY requirements.txt . # buildkit", "12.3kB"],
      ["WORKDIR /app", "8.19kB"],
      ["CMD [\"python3\"]", "0B"],
      ["RUN /bin/sh -c set -eux;  for src in idle3 p…", "16.4kB"],
      ["RUN /bin/sh -c set -eux;   savedAptMark=\"$(a…", "44.7MB"],
      ["ENV PYTHON_SHA256=b5796915dc45ff745cfb4e990a…", "0B"],
      ["ENV PYTHON_VERSION=3.12.16", "0B"],
      ["ENV GPG_KEY=7169605F62C751356D054A26A821E680…", "0B"],
      ["RUN /bin/sh -c set -eux;  apt-get update;  a…", "4.97MB"],
      ["ENV LANG=C.UTF-8", "0B"],
      ["ENV PATH=/usr/local/bin:/usr/local/sbin:/usr…", "0B"],
      ["# debian.sh --arch 'arm64' out/ 'trixie' '@1…", "110MB"]
    ],
    ownRows: 6,   // the first six history rows come from the lines of Dockerfile.rm-model after FROM
    // 6-final-history.out.txt: the COPY . . row of the final image (built with dockerignore.final)
    historyFinalCopy: ["COPY . . # buildkit", "16.4kB"],
    dockerignore: ["models/", "__pycache__/", ".venv/", "*.out.txt"],
    modelBytes: 83886080,   // run_all.sh: head -c 83886080 /dev/urandom
    // the run in run_all.sh step 6, written from the build folder
    runCmd: ["docker run -p 18431:8000 \\", "  -v \"$PWD/models:/models:ro\" \\", "  -e MODEL_PATH=/models/notes-model.bin \\", "  clinic-notes:final"],
    curlBody: "Patient reports less knee pain since the last visit. Walks 20 minutes a day. Next check in six weeks.",
    // 6-final-curl.out.txt and 6-final-logs.out.txt
    curlFinal: "{\"summary\":\"Patient reports less knee pain since the last visit.\",\"sentences\":3,\"model_bytes\":83886080}",
    logFinal: "INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)",
    // run_host.sh: the same image started with "uvicorn main:app --port 8000"; 8-nohost-logs.out.txt, 8-nohost-curl.out.txt
    logNoHost: ["INFO:     Application startup complete.", "INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)"],
    curlNoHost: "curl: (56) Recv failure: Connection reset by peer"
  };

  /* ---------- Derived from the data ---------- */
  const CAPTION = `Real run on a Mac with Docker, ${RUN.date}`;
  const N_PINNED = RUN.pinned.length;
  const N_ASKED = RUN.reqUnpinned.length;
  const MODEL_MIB = RUN.modelBytes / 1048576;
  const MODEL_MB = (RUN.modelBytes / 1e6).toFixed(1);
  const PIP_FIRST = RUN.rebuildFirst[3].res.split(" ").pop();
  const COPY_FIRST = RUN.rebuildFirst[2].res.split(" ").pop();
  const RAN_FIRST = RUN.rebuildFirst.filter(s => s.ran).map(s => s.step);
  const FIRST_RERUN_REORDERED = RUN.rebuildReordered.findIndex(s => !/CACHED/.test(s.res) && !/FROM/.test(s.head));
  const COPY_ROW = RUN.historyRm.findIndex(r => r[0].startsWith("COPY . ."));
  const RM_ROW = RUN.historyRm.findIndex(r => r[0].includes("rm -rf models"));
  const PIP_ROW = RUN.historyRm.findIndex(r => r[0].includes("pip install"));
  const BASE_ROWS = RUN.historyRm.length - RUN.ownRows;
  const STEP_NAMES = RUN.dockerfileFirst.slice(0, 4);
  const numpyPin = RUN.pinned.find(p => p.startsWith("numpy=="));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}log { margin: 12px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font: 500 13px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}log b { font-weight: 700; }
      .${P}log .${P}hit { color: var(--bad); font-weight: 700; }
      .${P}log .${P}ran { color: var(--ink); font-weight: 700; }
      .${P}log .${P}ok { color: var(--muted); }
      .${P}two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; align-items: start; }
      .${P}two > div { min-width: 0; }
      @media (max-width: 640px) { .${P}two { grid-template-columns: 1fr; } }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}label { margin: 14px 0 0; font: 600 12.5px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}list { display: grid; gap: 8px; margin-top: 12px; }
      .${P}list button { display: flex; gap: 10px; align-items: baseline; justify-content: space-between; width: 100%; text-align: left; min-height: 44px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); cursor: pointer; font: 500 13.5px/1.45 var(--mono); overflow-wrap: anywhere; }
      .${P}list button span { min-width: 0; }
      .${P}list button small { flex: none; font: 600 12.5px/1.45 var(--mono); color: var(--muted); }
      .${P}list button[aria-pressed="true"] { border-color: var(--ink); border-width: 3px; padding: 8.5px 10.5px; }
      .${P}list button.right { border-color: var(--good); background: var(--good-soft); }
      .${P}list button.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}list button:disabled { cursor: default; opacity: .55; }
      .${P}list button.right:disabled, .${P}list button.wrong:disabled { opacity: 1; }
      .${P}row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
      .${P}row .btn { min-height: 44px; }
      .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; }
      @media (hover: hover) { .${P}list button:not(.right):not(.wrong):not(:disabled):hover { border-color: var(--ink); } }
    `;
    document.head.appendChild(s);
  }
  const log = (kit, lines) => `<div class="${P}log">${lines.map(l => typeof l === "string" ? kit.esc(l) : `<span class="${P}${l.k}">${kit.esc(l.t)}</span>`).join("\n")}</div>`;
  const cap = t => `<p class="${P}cap">${t}</p>`;
  const label = t => `<p class="${P}label">${t}</p>`;
  const code = (kit, lines, on = -1) => `<div class="${P}wrap">${kit.code(lines, on)}</div>`;
  const two = (a, b) => `<div class="${P}two"><div>${a}</div><div>${b}</div></div>`;
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;

  /* 1. The situation: a real crash on start. Diagnose it. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The server has a different Python version from the Mac",
      "<code>COPY . .</code> did not copy <code>main.py</code> into the image",
      `<code>numpy</code> is not in <code>requirements.txt</code>, so pip never installed it in the image`,
      "uvicorn is missing from the image"
    ];
    const fb = [
      ["The Python version is not what failed. Python started uvicorn (<code>/usr/local/bin/uvicorn</code>) and then ran <code>/app/main.py</code> up to line 2. The last line names what is missing, and it is not Python.", false],
      ["The traceback shows <code>File \"/app/main.py\", line 2</code>: Python found <code>main.py</code> in the image and ran it. The file is there. Its second line is what failed.", false],
      [`Right. The image starts from a clean Python. pip installs only what <code>requirements.txt</code> lists: ${RUN.reqFirst.map(r => `<code>${r}</code>`).join(" and ")}. On Dana's Mac, numpy was installed long ago for something else, so the import worked there. The Mac hid the gap. An <b>image</b> is a packed file system: a base system, Python, your packages and your code. A <b>container</b> is that image running. It has only what the Dockerfile put in it, which is why it behaves the same on every machine, once the Dockerfile is complete.`, true],
      ["The crash starts inside <code>/usr/local/bin/uvicorn</code>, the first line of the traceback. uvicorn is installed and running. It is loading <code>main.py</code> when the error happens.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>It works on the Mac. On the server it crashes.</h1>
        <p class="lead">Dana is the only developer at a small clinic. She wrote a service that summarises appointment notes: a FastAPI endpoint around a model file. On her Mac it runs fine. Before any AI product has users, its service must run on a server too. That is the problem this lesson solves. To run it on the clinic's server she wrote a <b>Dockerfile</b>: a recipe for building an <b>image</b>, a packed copy of everything the service needs. The server builds the image and starts it: the running image is called a <b>container</b>. It crashes at once.</p>
        ${label("Dockerfile")}${code(kit, RUN.dockerfileFirst)}
        ${cap("<code>FROM</code> starts from an image that has Python 3.12. <code>WORKDIR /app</code> makes /app the folder for every later line. <code>COPY . .</code> copies the whole project folder into the image. <code>RUN</code> runs a command while the image is built, here pip install. <code>CMD</code> is the command the container runs when it starts.")}
        ${label("requirements.txt")}${code(kit, RUN.reqFirst)}
        ${label("main.py, first lines")}${code(kit, RUN.mainTop, 1)}
        ${label("What the container printed")}${log(kit, [...RUN.traceHead, "…", ...RUN.traceTail.slice(0, 2), { k: "hit", t: RUN.traceTail[2] }])}
        ${cap(`${CAPTION}. The model in this service is a stand-in file, so no model download or key was needed.`)}
        <p class="task">Why does the container crash?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 2. Add numpy, and pin what pip resolved. */
  function pinning({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The same versions as today, because Docker keeps the result of pip install",
      "Whatever versions are newest on that day, so the server can run code nobody tested",
      "pip stops with an error, because it needs version numbers"
    ];
    const fb = [
      ["Docker reuses a step only on a machine that already built it. A new server, or a cleaned build cache, has nothing to reuse and runs pip again. On your own machine the reuse even hides the problem: Docker compares the text of the <code>RUN</code> line, not what pip would get today, so your build keeps the old versions while the server gets new ones.", false],
      [`Right. A line like <code>fastapi</code> means “any version”. Each fresh build asks the package index (the online store of packages) again, and a new release can change behaviour. So Dana built once, ran <code>pip freeze</code> inside the image, and saved the exact versions with <code>==</code>. She listed ${word(N_ASKED)} packages; the frozen file has ${N_PINNED} lines, because it also pins the packages they pull in. Every build now installs the same set. To update, you change the file on purpose and test it.`, true],
      ["pip accepts names without versions: it picks the newest version that fits. That is the risk, not an error. The build Dana ran with this file worked and installed numpy.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Add numpy. Which numpy?</h1>
        <p class="lead">Dana adds the missing line, and the image builds and starts. Then she runs <code>pip freeze</code> inside that image. It printed every installed package with its exact version:</p>
        ${two(`${label("requirements.txt, as she typed it")}${code(kit, RUN.reqUnpinned)}`, `${label("pip freeze inside the image")}${code(kit, RUN.pinned, RUN.pinned.indexOf(numpyPin))}`)}
        ${cap(CAPTION)}
        <p class="task">Three months later the server builds the image from the three-line file, from scratch. What does pip install?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. By hand: predict which steps rebuild after a one-line code change. */
  function predictRebuild({ el, done, kit }) {
    ensureStyle();
    const sel = new Set();
    let checked = null;   // null | "right" | "wrong"
    const fbWrong = () => {
      const miss = RAN_FIRST.filter(i => !sel.has(i)), extra = [...sel].filter(i => !RAN_FIRST.includes(i));
      const say = [];
      if (extra.includes(0)) say.push("<code>FROM</code> only looked up the base image: the same one as before, so nothing was downloaded or rebuilt.");
      if (extra.includes(1)) say.push(`<code>WORKDIR /app</code> comes before anything that changed. The log says <code>CACHED</code>: Docker reused it.`);
      if (miss.includes(2)) say.push(`<code>COPY . .</code> copies the whole folder, <code>main.py</code> included. The file changed, so this step ran again (${COPY_FIRST}).`);
      if (miss.includes(3)) say.push(`<code>RUN pip install</code> ran again too, ${PIP_FIRST}, downloading all ${N_PINNED} packages, although <code>requirements.txt</code> did not change. Screen 4 is about why.`);
      return say.join(" ");
    };
    const paint = () => {
      const show = checked != null;
      el.innerHTML = `<h1>One line changes. What rebuilds?</h1>
        <p class="lead">The image now builds and runs, with the pinned file. Dana changes one line of <code>main.py</code> so the summary keeps two sentences instead of one. Nothing else changes. Then she builds again. Docker keeps the result of each step from the last build and reuses what it can.</p>
        ${label("Line 19 of main.py, before")}${code(kit, [RUN.lineBefore])}
        ${label("after")}${code(kit, [RUN.lineAfter])}
        <p class="task">Tap every step of the Dockerfile that you think runs again. Then check against the real build log.</p>
        <div class="${P}list">${STEP_NAMES.map((s, i) => `<button type="button" data-step="${i}" aria-pressed="${sel.has(i)}" ${checked === "right" ? "disabled" : ""} class="${checked === "right" ? (RAN_FIRST.includes(i) ? "right" : "") : ""}"><span>${kit.esc(s)}</span><small>${show && checked === "right" ? (RAN_FIRST.includes(i) ? "ran again" : "reused") : sel.has(i) ? "runs again" : ""}</small></button>`).join("")}</div>
        <div class="${P}row"><button type="button" class="btn" data-check ${checked === "right" ? "disabled" : ""}>Check against the log</button></div>
        <div class="lpanel">${checked === "wrong" ? kit.feedback(`Not quite. ${fbWrong()} Change your picks and check again.`, false)
          : checked === "right" ? `${log(kit, RUN.rebuildFirst.flatMap(s => [s.head, ...(s.mid ? [s.mid] : []), { k: s.ran ? "ran" : "ok", t: s.res }, ""]).slice(0, -1))}${cap(CAPTION + ", trimmed with …")}${kit.feedback(`Right. <code>COPY . .</code> ran again, and so did <code>pip install</code>: ${PIP_FIRST} to download and install the same ${N_PINNED} packages it installed one build earlier. In this small service that is seconds. With large machine learning libraries the same step can take minutes, on every code change.`, true)}`
          : ""}</div>`;
      el.querySelectorAll("[data-step]").forEach(b => b.onclick = () => {
        const i = +b.dataset.step;
        if (sel.has(i)) sel.delete(i); else sel.add(i);
        if (checked === "wrong") checked = null;
        paint();
      });
      el.querySelector("[data-check]").onclick = () => {
        const ok = sel.size === RAN_FIRST.length && RAN_FIRST.every(i => sel.has(i));
        checked = ok ? "right" : "wrong";
        paint();
        if (ok) done();
      };
    };
    paint();
  }

  /* 4. Spot the idea: why did pip install run again? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Docker always runs <code>RUN</code> steps again; it only reuses <code>COPY</code> steps",
      "Docker read <code>main.py</code>, saw the import of numpy, and reinstalled the packages",
      "<code>pip install</code> comes after <code>COPY . .</code>. That copy changed, and every step after a changed step is built again",
      "The base image had a new version, so everything on top of it was rebuilt"
    ];
    const fb = [
      ["Docker reuses <code>RUN</code> steps all the time: in the next screen the same <code>RUN pip install</code> line is reused. What decides is what came before the step.", false],
      ["Docker does not read your Python. It does not know what <code>main.py</code> imports. It only compares what each step gets: the files a <code>COPY</code> brings in, the text of a <code>RUN</code> line, and the steps before it.", false],
      [`Right. Each step that changes files (<code>RUN</code>, <code>COPY</code>) saves the change as a <b>layer</b>: the files it added, changed or removed, stacked on the layer before it. Docker reuses a layer only if its step and every step before it are the same as last time (the <b>build cache</b>). <code>COPY . .</code> brought in a changed <code>main.py</code>, so its layer changed, and every layer after it had to be built again, even <code>pip install</code>, whose own input did not change. Order matters: put what changes rarely first and what changes often last.`, true],
      [`Both builds used the very same base image: the log names it by its digest (<code>sha256:5e2bdb1b…</code>), and that step finished in ${RUN.rebuildFirst[0].res.split(" ").pop()} with nothing downloaded.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did pip install run again?</h1>
        <p class="lead"><code>requirements.txt</code> did not change. The packages did not change. Yet pip downloaded and installed all ${N_PINNED} of them again.</p>
        ${code(kit, RUN.dockerfileFirst.slice(0, 4), ans === 2 ? 2 : -1)}
        <p class="task">Which explanation is right?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 5. Use it: reorder the Dockerfile, then predict the next rebuild. */
  const MID = ["COPY requirements.txt .", "RUN pip install --no-cache-dir -r requirements.txt", "COPY . ."];
  const SHOWN = [2, 1, 0];   // the order the three lines are offered in
  function reorder({ el, done, kit }) {
    ensureStyle();
    let order = [], ans = null;
    const good = () => order.length === 3 && order.every((v, i) => v === i);
    const why = () => {
      if (order[0] === 2) return "With <code>COPY . .</code> first, <code>main.py</code> is copied in a layer before <code>pip install</code> again. Any code change breaks the cache there, and pip runs again, as in the log you read.";
      if (order.indexOf(1) < order.indexOf(0)) return "<code>pip install -r requirements.txt</code> would run before <code>requirements.txt</code> is in the image. pip would have no file to read.";
      if (order.indexOf(2) < order.indexOf(1)) return "<code>pip install</code> now comes after <code>COPY . .</code>, so every change to <code>main.py</code> still makes it run again. The file pip needs is already in from line 3.";
      return "Look again at which line has to be in the image before <code>pip install</code> can read it.";
    };
    const qOpts = ["<code>COPY requirements.txt .</code>", "<code>RUN pip install …</code>", "<code>COPY . .</code>"];
    const qFb = [
      ["<code>requirements.txt</code> did not change, so this copy brings in exactly the same file as last time. Docker reuses its layer.", false],
      ["Everything before <code>pip install</code> is the same as last time: the base image, the folder and the same <code>requirements.txt</code>. So its layer is reused. That is the point of the new order.", false],
      [`Right. The first step whose input changed is <code>COPY . .</code>, because <code>main.py</code> is in it. Everything before it is reused, <code>pip install</code> included. Here is the real rebuild after the same one-line change:`, true]
    ];
    const paint = () => {
      const full = order.length === 3, ok = good();
      const lines = ["FROM python:3.12-slim", "WORKDIR /app", ...order.map(i => MID[i]), ...Array(3 - order.length).fill("…"), RUN.dockerfileFirst[4]];
      el.innerHTML = `<h1>Reorder the Dockerfile</h1>
        <p class="lead">Put what changes rarely first. The packages change rarely; <code>main.py</code> changes all the time. So copy only <code>requirements.txt</code>, install from it, and copy the rest of the code last.</p>
        <p class="task">Tap the three middle lines in the order they should run.</p>
        ${code(kit, lines, full ? -1 : 2 + order.length)}
        <div class="${P}list">${SHOWN.map(i => `<button type="button" data-line="${i}" ${order.includes(i) || full ? "disabled" : ""} class="${full && order.includes(i) ? (ok ? "right" : "wrong") : ""}"><span>${kit.esc(MID[i])}</span><small>${order.includes(i) ? `line ${order.indexOf(i) + 3}` : ""}</small></button>`).join("")}</div>
        ${full && !ok ? `<div class="${P}row"><button type="button" class="btn" data-reset>Start the three lines over</button></div>` : ""}
        <div class="lpanel">${full && !ok ? kit.feedback(why(), false) : ""}
        ${ok ? `<div class="lcase" id="q"><p>The order is right. Dana changes the same line of <code>main.py</code> again and builds. Which is the first step that runs again?</p>${ask(kit, qOpts, 2, ans, qFb)}</div>` : ""}
        ${ok && ans === 2 ? `${log(kit, RUN.rebuildReordered.flatMap(s => [s.head, { k: /CACHED/.test(s.res) || /FROM/.test(s.head) ? "ok" : "ran", t: s.res }, ""]).slice(0, -1))}${cap(CAPTION + ", trimmed with …")}${kit.feedback(`<code>pip install</code> says <code>CACHED</code> this time, instead of ${PIP_FIRST}. Only <code>COPY . .</code> ran. The packages are reused until <code>requirements.txt</code> itself changes.`)}` : ""}</div>`;
      el.querySelectorAll("[data-line]").forEach(b => b.onclick = () => { order.push(+b.dataset.line); ans = null; paint(); });
      const r = el.querySelector("[data-reset]");
      if (r) r.onclick = () => { order = []; paint(); };
      el.querySelectorAll("#q .lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: "rm -rf models" did not make the image smaller. */
  function brokenRm({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const rows = RUN.historyRm.slice(0, RUN.ownRows);
    const fb = i => {
      if (i === COPY_ROW) return [`Right. This layer holds ${RUN.historyRm[COPY_ROW][1]}: the model folder came in with <code>COPY . .</code>. Layers are stacked and never edited. The <code>rm</code> step adds a new layer on top that only marks the folder as deleted (${RUN.historyRm[RM_ROW][1]}). Inside the container the folder is gone, as <code>ls</code> shows. But the bytes are still in the layer below, so every server that pulls this image downloads them. A delete in a later step never makes an image smaller; the file must never get in.`, true];
      if (i === RM_ROW) return [`This is the step meant to remove the model, and its layer is only ${RUN.historyRm[RM_ROW][1]}. A layer records changes. This one records “the folder is deleted”. It cannot take bytes out of an older layer.`, false];
      if (i === PIP_ROW) return [`This layer is big (${RUN.historyRm[PIP_ROW][1]}), but it is the ${N_PINNED} installed packages, numpy among them. The service needs them. It is expected, not the leak.`, false];
      return [`This layer is ${RUN.historyRm[i][1]}: ${i === 0 ? "the start command, which is only settings" : "a small setup step"}. Look for a size close to the model's.`, false];
    };
    const paint = () => {
      const fin = pick === COPY_ROW;
      el.innerHTML = `<h1>The model is deleted, and still shipped</h1>
        <p class="lead">The service loads a model file from <code>models/</code> (here a stand-in of ${MODEL_MIB} MiB, which Docker shows as ${MODEL_MB} MB; a real one can be gigabytes). Dana does not want it in the image. She adds <code>RUN rm -rf models</code> after the copy. Inside the container, the folder is gone. Then she runs <code>docker image history</code>. It lists the image's layers, one per Dockerfile step, with the size each one adds.</p>
        ${label("Dockerfile")}${code(kit, RUN.dockerfileRm, 5)}
        ${label("ls -la /app inside the container")}${log(kit, RUN.lsRm)}
        ${label("docker image history, newest layer first")}
        <p class="task">Tap the layer that still holds the model's bytes.</p>
        <div class="${P}list">${rows.map((r, i) => `<button type="button" data-row="${i}" ${fin ? "disabled" : ""} class="${pick === i ? (fin ? "right" : "wrong") : ""}"><span>${kit.esc(r[0])}</span><small>${kit.esc(r[1])}</small></button>`).join("")}</div>
        ${log(kit, [`… ${BASE_ROWS} more layers from the python:3.12-slim base image`])}
        ${cap(CAPTION + ", trimmed with …")}
        <div class="lpanel">${pick == null ? "" : kit.feedback(...fb(pick))}</div>`;
      el.querySelectorAll("[data-row]").forEach(b => b.onclick = () => { pick = +b.dataset.row; paint(); if (pick === COPY_ROW) done(); });
    };
    paint();
  }

  /* 7. Keep the model out: .dockerignore, and mount it when the container starts. Predict the answer. */
  function mountModel({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "No answer: the image has no model, so the service fails at start",
      "<code>model_bytes</code> with the full size of the model file, read from the folder mounted at <code>/models</code>",
      "A smaller number, because .dockerignore packs the model into a compressed file"
    ];
    const fb = [
      ["The image has no model, but a container is the image plus what you attach when you start it. <code>-v</code> puts the host's <code>models</code> folder at <code>/models</code> inside the container, and <code>MODEL_PATH</code> points the service there.", false],
      [`Right. The real answer is below. The service read all ${fmt(RUN.modelBytes)} bytes from the mounted folder, while the image's <code>COPY . .</code> layer holds only ${RUN.historyFinalCopy[1]} instead of ${RUN.historyRm[COPY_ROW][1]}. The image carries the code and the packages; the model travels on its own. You can update the model without rebuilding, and update the code without moving the model again. On a real server the folder can be a storage volume, or the service can download the model when it starts.`, true],
      [".dockerignore does not pack or compress anything. It is a list of files the build never sees. The model file is left out of the image completely.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Keep the model out of the image</h1>
        <p class="lead">When Docker builds, it first sends the project folder to the build engine. That folder is the <b>build context</b>. In Dana's first build the log line read <code>${kit.esc(RUN.contextFirst)}</code>: the model went along. A fresh machine, such as a new server or a CI runner (the machine that builds on every push), sends it again on every build. Fix one: a <code>.dockerignore</code> file lists what to leave out, like <code>.gitignore</code>. Fix two: she gives the model to the container when it starts.</p>
        ${cap("In the command below, <code>-p 18431:8000</code> sends requests on the server's port 18431 to port 8000 in the container. <code>-v</code> mounts the server's <code>models</code> folder at <code>/models</code>, read-only (<code>ro</code>). <code>-e MODEL_PATH=…</code> sets an environment variable that tells the service where the model file is.")}
        ${two(`${label(".dockerignore")}${code(kit, RUN.dockerignore, 0)}`, `${label("docker run, from the build folder")}${code(kit, RUN.runCmd, 1)}`)}
        <p class="task">She sends one appointment note to the running service. What does the answer say about the model?</p>
        ${label("The note")}${log(kit, [RUN.curlBody])}
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}
        ${ans === 1 ? `${label("The answer")}${log(kit, [RUN.curlFinal])}${label("docker image history, the COPY . . layer now")}${log(kit, [`${RUN.historyFinalCopy[0]}   ${RUN.historyFinalCopy[1]}`])}${cap(CAPTION)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. The finished Dockerfile, and one parameter that bites: --host 0.0.0.0. Predict a real run. */
  function finalFile({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Exactly the same answer as before: the port is still published with <code>-p</code>",
      "No answer: uvicorn starts, but listens only inside the container, so a request from outside never reaches it",
      "The container stops at start with an error about the host"
    ];
    const fb = [
      ["<code>-p</code> forwards the server's port into the container. But uvicorn listens only on <code>127.0.0.1</code>, an address that only programs inside the container can reach. The forwarded request comes from outside, so nothing picks it up. The real run got no answer.", false],
      [`Right. Without <code>--host</code>, uvicorn listens on <code>127.0.0.1</code>, its default: only programs inside the same container can connect. The published port brings requests in from outside, so they find no listener. The real curl got <code>${kit.esc(RUN.curlNoHost)}</code>. <code>0.0.0.0</code> means “accept connections on every address this container has”, so requests from outside reach it too. A service in a container needs that.`, true],
      ["It started fine: the log says <code>Application startup complete</code>. Nothing is wrong inside the container. The problem only shows when a request comes from outside.", false]
    ];
    const NOTES = [
      ["FROM python:3.12-slim", "A small official Python image, with the version in the tag. For builds that must never change, pin the digest too (the sha256 id from the build log)."],
      ["WORKDIR /app", "Every later step works in /app; it is created if it does not exist."],
      ["COPY requirements.txt .", "Only the pinned file first, so the next line stays cached."],
      ["RUN pip install --no-cache-dir -r requirements.txt", "--no-cache-dir: pip keeps no download cache, which nobody would use inside the image."],
      ["COPY . .", "The code last. .dockerignore keeps models/ out."],
      [RUN.dockerfileReordered[5], "The exec form (a JSON list) starts uvicorn directly, not through a shell."]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The finished Dockerfile</h1>
        <p class="lead">This is the file the clinic now builds, with what each choice is for:</p>
        ${NOTES.map(([l, n]) => `${code(kit, [l])}<p class="${P}cap">${kit.esc(n)}</p>`).join("")}
        <p class="lead" style="margin-top:18px">One more part matters: <code>--host 0.0.0.0</code> at the end. We started the same image once more, with the command changed to <code>uvicorn main:app --port 8000</code>, and sent the same note with curl.</p>
        <p class="task">What does curl get back?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}
        ${ans === 1 ? `${label("Container log")}${log(kit, RUN.logNoHost)}${label("curl")}${log(kit, [{ k: "hit", t: RUN.curlNoHost }])}${label("For comparison, the run with --host 0.0.0.0")}${log(kit, [RUN.logFinal])}${cap(CAPTION)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. The big picture, with a task. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A researcher tries three prompts in a notebook this afternoon and will throw the code away.",
      "A team runs the same summariser on a test server and two production servers, and last month a missing package took production down.",
      "A platform you already use runs your function from a requirements file and never lets you touch the machine."
    ];
    const fb = [
      ["A notebook for one afternoon gains little. Nothing is deployed and nobody else runs it. A virtual environment is enough; writing and building a Dockerfile would cost more time than it saves.", false],
      ["Right. Several machines must run exactly the same thing, and a hidden dependency already broke one. One image, built once with pinned packages, runs the same on all three.", true],
      ["Here the platform already builds the environment from your requirements file. Pinning the versions still matters; a Dockerfile of your own adds little unless the platform accepts images.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When a Dockerfile pays off</h1>
        <p class="lead"><b>What it is for:</b> one image holds the system, the Python version, the pinned packages and the code, so the service runs the same on a laptop, in CI and on every server. <b>Reach for it</b> when a service is deployed, runs on several machines, or is shared with a team. <b>Not worth it</b> for a notebook or a one-off script; use a virtual environment there. <b>What it costs:</b> build time and image storage (machine learning images get large), keeping the base image and the pins up to date for security fixes, and on a Mac a Linux virtual machine running in the background.</p>
        <p class="task">Which team gains the most from writing a Dockerfile now?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, including a "no". */
  const CASES = [
    ["A translation service's CI downloads several gigabytes of packages on every push, even when only one Python file changed.", true,
      "Yes. That is the order problem from this lesson. Copy the requirements file and install first, copy the code last, and the install step stays cached until the requirements change.",
      "Look at what changed: one code file. If the install step reruns on every push, the code is copied before it. Reordering the Dockerfile fixes it; the packages stay cached."],
    ["A speech-to-text image is many gigabytes because the model weights are copied in, and every code fix makes every server download all of it again.", true,
      "Yes. Keep the weights out with .dockerignore and give them to the container at start: a mounted volume, or a download from a model store. A code fix then moves only the small code layer.",
      "The weights are in a layer, so they travel with every new image. Leave them out of the build and attach them at start. That is a Dockerfile fix."],
    ["The summariser runs fine in its container, but doctors say the summaries often leave out allergy notes.", false,
      "Right, no. The container runs the code exactly as written, and it does. The problem is what the model writes, which no Dockerfile changes. Look at the prompt and test with real notes that mention allergies.",
      "Docker makes the service run the same everywhere. Here it already runs the same everywhere; the summaries themselves are wrong. That is a question for the prompt and an evaluation, not the image."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is the fix in the Dockerfile?</h1>
        <p class="lead">Three services, away from the clinic.</p>
        <p class="task">For each one, decide whether a change to how the image is built fixes the problem. Pick again if you change your mind.</p>
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
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can package a model service</h1>
      <p class="lead">You read a real crash and found the package the image never got, pinned ${N_PINNED} versions with <code>pip freeze</code>, predicted which layers rebuild after a code change and reordered the file so <code>pip install</code> stays cached, found the layer that still carried a “deleted” model, and kept the model out with <code>.dockerignore</code> and a mount. You also saw why the service must listen on <code>0.0.0.0</code>.</p>
      <p class="lead">This lesson was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. This image ran on the CPU. Next, a container has to reach the server's GPU, and you read the errors it gives when the driver and the image do not match.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Packaging an AI service with Docker",
    checked: "2026-11-14",
    sources: [
      "https://docs.docker.com/build/cache/",
      "https://docs.docker.com/build/cache/invalidation/",
      "https://docs.docker.com/build/building/best-practices/",
      "https://docs.docker.com/build/concepts/context/",
      "https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/",
      "https://docs.docker.com/reference/dockerfile/",
      "https://docs.docker.com/reference/cli/docker/image/history/",
      "https://docs.docker.com/engine/storage/bind-mounts/",
      "https://fastapi.tiangolo.com/deployment/docker/",
      "https://pip.pypa.io/en/stable/topics/repeatable-installs/",
      "https://uvicorn.dev/settings/"
    ],
    interview: [{
      q: "Your team's model service image takes fifteen minutes to build on every commit and is many gigabytes. Walk me through what you would look at.",
      good: [
        "Read the build log for which steps rerun: if dependencies install after the code is copied, copy and install the requirements first and the code last",
        "Run docker image history to see which layer is big: often model weights or a download cache copied in",
        "Keep weights out with .dockerignore and attach them at start (a volume, or a download from a model store); deleting them in a later step does not shrink the image",
        "Pin dependencies so the cached install is also the tested one, use a slim base image and pip's --no-cache-dir"
      ],
      weak: "Give CI a bigger machine, or add rm -rf at the end of the Dockerfile. The first hides the rebuild instead of preventing it; the second leaves the bytes in an earlier layer."
    }],
    screens: [situation, pinning, predictRebuild, spotIdea, reorder, brokenRm, mountModel, finalFile, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-step="2"]', "[data-check]"], right: ['[data-step="3"]', "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-line="2"]', '[data-line="0"]', '[data-line="1"]'], right: ["[data-reset]", '[data-line="0"]', '[data-line="1"]', '[data-line="2"]', "#q [data-right]"] },
      { wrong: [`[data-row="${RM_ROW}"]`], right: [`[data-row="${COPY_ROW}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
