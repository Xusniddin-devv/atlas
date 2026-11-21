/* Lesson s6-deploy-lab: ship the RAG service to a public URL.
   Story: your stage-5 RAG project (questions about a makerspace handbook) needs a live link for your portfolio, with
   no budget and no paid model key. You swap the paid model for a small 4-bit model that runs on the CPU, package it,
   and run it the way a Docker Space runs containers. It fails.
   Ideas: (1) a host runs your image under its own conditions (a user ID, a port, a disk that is wiped on restart);
   read the deploy log from the first error, not the last, and test locally under those conditions;
   (2) a health endpoint must say whether the service can answer (503 unless the index and model are loaded), and a
   small post-deploy check waits for it, then asks one known question.
   Depth: debug (screens 2 to 5: a real failing log, its cause, the fix, a health check that lied),
   scratch (screen 6: a post-deploy check in plain Python, stepped from a real trace),
   library (screen 7: the Hugging Face Spaces Docker config; screens 4 and 5 ran the real image under the
   conditions its docs state), explain and when-not (screens 1, 8, 9, interview).
   Data, all real, run on this Mac with Docker Desktop on 2026-11-14 (docs/ai-path/runs/s6-deploy-lab/):
   run_first.sh made 2-*.out.txt and 3-*.out.txt, run_fixed.sh made 4-* to 6-*, run_check.sh with check_live.py made
   7-* and 8-*, 9-who-owns-cache.out.txt is a single docker run, run_home.sh made 10-home-as-user-1000.out.txt; env.txt has the
   versions. The model is SmolLM2-135M-Instruct, Q4_0 GGUF, run by llama-cpp-python inside the container.
   Nothing was deployed to a real host: screen 7 is written from the official docs and says so.
   No model API was called for this lesson.
   Lesson-local style (.lx-s6-deploy-lab-*): log blocks and tappable log lines, see ensureStyle().
   Every number on screen is computed here from RUN. Plain browser script. */
(() => {
  const ID = "s6-deploy-lab";
  const P = `lx-${ID}-`;
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = n => WORDS[n] || String(n);
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[ch]);

  /* ---------- Data copied from the runs (docs/ai-path/runs/s6-deploy-lab/), trimmed with … , not altered ---------- */
  const RUN = {
    date: "2026-11-14",
    modelFile: "SmolLM2-135M-Instruct-Q4_0.gguf",
    modelBytes: 91893088,                           // env.txt
    question: "Do I need training before I use the laser cutter?",
    // app/handbook.json, the chunk the question needs
    laserChunk: "Members must finish the laser cutter induction before using the laser cutter. Never leave the laser cutter running unattended. Cut only wood, acrylic, card and paper; PVC and vinyl give off toxic gas and are banned.",
    // Dockerfile.first
    dockerfileFirst: [
      "FROM python:3.12-slim",
      "WORKDIR /app",
      "COPY requirements.txt .",
      "RUN pip install --no-cache-dir -r requirements.txt",
      "ADD https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_0.gguf models/smollm2-135m-q4_0.gguf",
      "COPY . .",
      "RUN mkdir -p cache",
      "CMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"7860\"]"
    ],
    // Dockerfile.fixed
    dockerfileFixed: [
      "FROM python:3.12-slim",
      "RUN useradd -m -u 1000 user",
      "USER user",
      "ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH",
      "WORKDIR $HOME/app",
      "COPY --chown=user requirements.txt .",
      "RUN pip install --no-cache-dir -r requirements.txt",
      "ADD --chown=user https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_0.gguf models/smollm2-135m-q4_0.gguf",
      "COPY --chown=user . .",
      "RUN mkdir -p cache",
      "CMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"7860\"]"
    ],
    // app/main.py: the startup code (lines 41 to 49) and the first /health (lines 56 to 58)
    startupCode: [
      "async def lifespan(app):",
      "    try:",
      "        state[\"index\"] = load_or_build_index()",
      "        t = time.perf_counter()",
      "        state[\"llm\"] = Llama(model_path=MODEL_PATH, n_ctx=1024, verbose=False)",
      "        log.info(\"model loaded in %.1f s\", time.perf_counter() - t)",
      "    except Exception as e:",
      "        log.error(\"startup failed: %s\", e)",
      "    yield"
    ],
    healthFirst: ["@app.get(\"/health\")", "def health():", "    return {\"status\": \"ok\"}"],
    // app-fixed/main.py lines 57 to 60 (one line longer above: the JSONResponse import)
    healthFixed: ["@app.get(\"/health\")", "def health():", "    ready = {\"index\": \"index\" in state, \"model\": \"llm\" in state}", "    return JSONResponse(ready, status_code=200 if all(ready.values()) else 503)"],
    // 3-as-user-1000.curl.out.txt
    curlBroken: { health: "{\"status\":\"ok\"} HTTP 200", ask: "Internal Server Error HTTP 500" },
    // 3-as-user-1000.logs.out.txt: the first 12 lines, then the last 4 (the middle of the traceback cut)
    logBroken: [
      "INFO:     Started server process [1]",
      "INFO:     Waiting for application startup.",
      "ERROR:    startup failed: [Errno 13] Permission denied: 'cache/index.npz'",
      "INFO:     Application startup complete.",
      "INFO:     Uvicorn running on http://0.0.0.0:7860 (Press CTRL+C to quit)",
      "INFO:     185.199.109.153:51671 - \"GET /health HTTP/1.1\" 200 OK",
      "INFO:     185.199.109.153:29366 - \"POST /ask HTTP/1.1\" 500 Internal Server Error",
      "ERROR:    Exception in ASGI application",
      "Traceback (most recent call last):",
      "  File \"/usr/local/lib/python3.12/site-packages/uvicorn/protocols/http/h11_impl.py\", line 411, in run_asgi",
      "    result = await app(  # type: ignore[func-returns-value]",
      "             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "…",
      "  File \"/app/main.py\", line 62, in ask",
      "    vocab, matrix, idf = state[\"index\"]",
      "                         ~~~~~^^^^^^^^^",
      "KeyError: 'index'"
    ],
    // 9-who-owns-cache.out.txt
    owners: [
      "$ docker run --rm --user 1000 makerspace-rag:first sh -c \"id; ls -ld /app/cache\"",
      "uid=1000 gid=0(root) groups=0(root)",
      "drwxr-xr-x 2 root root 4096 Nov 13 15:33 /app/cache",
      "$ docker run --rm makerspace-rag:first sh -c \"id; ls -ld /app/cache\"",
      "uid=0(root) gid=0(root) groups=0(root)",
      "drwxr-xr-x 2 root root 4096 Nov 13 15:33 /app/cache",
      "$ docker run --rm --user 1000 makerspace-rag:fixed sh -c \"id; ls -ld cache\"",
      "uid=1000(user) gid=1000(user) groups=1000(user)",
      "drwxr-xr-x 2 user user 4096 Nov 13 15:35 cache"
    ],
    // 2-as-root.curl.out.txt: the same image as root, Docker's default user
    rootAsk: "HTTP 200",
    // 4-honest-health-user-1000.curl.out.txt
    curlHonest: "{\"index\":false,\"model\":false} HTTP 503",
    // 5-fixed-user-1000.logs.out.txt (first 8 lines) and .curl.out.txt, .stats.out.txt
    logFixed: [
      "INFO:     Started server process [1]",
      "INFO:     Waiting for application startup.",
      "INFO:     index built: 6 chunks, saved to cache/index.npz",
      "INFO:     model loaded in 0.3 s",
      "INFO:     Application startup complete.",
      "INFO:     Uvicorn running on http://0.0.0.0:7860 (Press CTRL+C to quit)",
      "INFO:     185.199.109.153:33160 - \"GET /health HTTP/1.1\" 200 OK",
      "INFO:     185.199.109.153:24060 - \"POST /ask HTTP/1.1\" 200 OK"
    ],
    curlFixedHealth: "{\"index\":true,\"model\":true} HTTP 200",
    askFixedSeconds: 3.5,
    memFixed: "111.6MiB",
    cpus: 2,
    // check_live.py, the traced function, line for line
    checkCode: [
      "def check_live(base, question, want_source, tries=6, wait=2):",
      "    for attempt in range(1, tries + 1):",
      "        status = get_status(base + \"/health\")",
      "        if status == 200:",
      "            break",
      "        time.sleep(wait)",
      "    else:",
      "        return f\"not healthy after {tries} tries\"",
      "    reply = post_json(base + \"/ask\", {\"question\": question})",
      "    if reply[\"source\"] != want_source:",
      "        return \"wrong source: \" + reply[\"source\"]",
      "    return \"live, \" + reply[\"source\"] + \": \" + reply[\"answer\"]"
    ],
    // 7-check-fixed.out.txt: [line, attempt, status, reply present, event]
    trace: [
      [1, null, null, false, "line"], [2, 1, null, false, "line"], [3, 1, 0, false, "line"], [5, 1, 0, false, "line"],
      [1, 1, 0, false, "line"], [2, 2, 0, false, "line"], [3, 2, 0, false, "line"], [5, 2, 0, false, "line"],
      [1, 2, 0, false, "line"], [2, 3, 0, false, "line"], [3, 3, 200, false, "line"], [4, 3, 200, false, "line"],
      [8, 3, 200, false, "line"], [9, 3, 200, true, "line"], [11, 3, 200, true, "line"], [11, 3, 200, true, "return"]
    ],
    reply: { answer: "You can use the laser cutter for cutting wood, acrylic, card, and paper before starting the training. However, it's best to start with the wood and then gradually move on to the paper and then the acrylic and then the paper.", source: "laser-cutter", seconds: 2.85 },
    // 8-check-broken.out.txt: the same check against the honest /health in the first Dockerfile
    resultBroken: "not healthy after 6 tries",
    brokenStatuses: [0, 503, 503, 503, 503, 503],   // 8-check-broken.out.txt, status at line 3 of each try
    // 10-home-as-user-1000.out.txt
    homeAs1000: ["HOME=/", "mkdir: cannot create directory ‘//.cache’: Permission denied"],
    // from the Spaces docs (spaces-sdks-docker), the README header of a Docker Space, as there
    readme: ["---", "title: Basic Docker SDK Space", "emoji: 🐳", "colorFrom: purple", "colorTo: gray", "sdk: docker", "app_port: 7860", "---"]
  };

  /* ---------- Derived from the data ---------- */
  const CAPTION = `Real run on a Mac with Docker, ${RUN.date}`;
  const MODEL_MB = (RUN.modelBytes / 1e6).toFixed(1);
  const CAUSE = RUN.logBroken.findIndex(l => l.startsWith("ERROR:    startup failed"));
  const CUT = RUN.logBroken.indexOf("…");
  const LAST = RUN.logBroken.length - 1;
  const TRIES = +RUN.checkCode[0].match(/tries=(\d+)/)[1];
  const WAIT = +RUN.checkCode[0].match(/wait=(\d+)/)[1];
  const FIRST_STATUS = RUN.trace.find(s => s[2] != null)[2];
  const OK_ATTEMPT = RUN.trace.find(s => s[2] === 200)[1];
  const FAILED_TRIES = OK_ATTEMPT - 1;
  const RESULT_FIXED = `live, ${RUN.reply.source}: ${RUN.reply.answer}`;
  const ANSWER_FIRST = RUN.reply.answer.split(". ")[0] + ".";
  const RULE_FIRST = RUN.laserChunk.split(". ")[0] + ".";
  const PORT = RUN.readme.find(l => l.startsWith("app_port")).split(": ")[1];
  const BROKEN_503 = RUN.brokenStatuses.filter(st => st === 503).length;
  const BROKEN_0 = RUN.brokenStatuses.filter(st => st === 0).length;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}log { margin: 12px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font: 500 13px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}log .${P}hit { color: var(--bad); font-weight: 700; }
      .${P}log .${P}good { color: var(--good); font-weight: 700; }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}label { margin: 14px 0 0; font: 600 12.5px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}lines { display: grid; gap: 4px; margin-top: 12px; }
      .${P}lines button, .${P}lines div { display: block; width: 100%; text-align: left; min-height: 44px; padding: 8px 10px; border: 1.5px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--ink); font: 500 12.5px/1.45 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}lines button { cursor: pointer; }
      .${P}lines div { min-height: 0; border-style: dashed; color: var(--muted); }
      .${P}lines button.right { border-color: var(--good); background: var(--good-soft); }
      .${P}lines button.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}lines button:disabled { cursor: default; }
      .${P}two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; align-items: start; }
      .${P}two > div { min-width: 0; }
      @media (max-width: 640px) { .${P}two { grid-template-columns: 1fr; } }
      .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; }
      @media (hover: hover) { .${P}lines button:not(.right):not(.wrong):not(:disabled):hover { border-color: var(--ink); } }
    `;
    document.head.appendChild(s);
  }
  const log = (kit, lines) => `<div class="${P}log">${lines.map(l => typeof l === "string" ? kit.esc(l) : `<span class="${P}${l.k}">${kit.esc(l.t)}</span>`).join("\n")}</div>`;
  const cap = t => `<p class="${P}cap">${t}</p>`;
  const label = t => `<p class="${P}label">${t}</p>`;
  const code = (kit, lines, on = -1) => `<div class="${P}wrap">${kit.code(lines, on)}</div>`;
  const two = (a, b) => `<div class="${P}two"><div>${a}</div><div>${b}</div></div>`;
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  const c = (kit, t) => `<code>${kit.esc(t)}</code>`;

  /* 1. The situation: a live link with no budget and no paid key. Pick the plan. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Host the service as it is, with your paid model key in it",
      "Run it on your laptop and share a tunnel link to it",
      `Swap the paid model for a small 4-bit model that runs on the CPU inside the container, and host the container on a free CPU tier`,
      "Rent a GPU server so the model answers fast"
    ];
    const fb = [
      ["A public link means every visitor's question is billed to your key, and you have no budget. Anyone who finds the link can run up the bill. The demo must not depend on a paid key.", false],
      ["The link works only while the laptop is awake and online. A recruiter who opens it at night gets nothing. A portfolio link has to live somewhere that stays up without you.", false],
      [`Right. The model must live inside the container, so no key and no per-question bill. On a CPU it has to be small: here SmolLM2-135M-Instruct, stored in 4 bits (the quantization from stage 5): a ${MODEL_MB} MB file. In our run the whole service used ${RUN.memFixed} of memory with ${RUN.cpus} CPUs. The price is answer quality, and you will see it.`, true],
      ["A GPU server is billed by the hour, whether anyone visits or not. With no budget, that ends the plan.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A live link, no budget, no key</h1>
        <p class="lead">Your stage-5 RAG project answers questions about a makerspace's handbook: the laser cutter, the 3D printers, the opening hours. It runs on your laptop and calls a paid model API. A recruiter asks for a link. You have no budget, and you will not put a paid key behind a public page. This lesson is the last step of building an AI product: putting the service online, checking that it works there, and fixing it when it does not.</p>
        <p class="task">Which plan gives a link that works when your laptop is off, and costs nothing per question?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 2. By hand: a real failing deploy log. Tap the first line that explains the failure. */
  function readLog({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const why = i => {
      const t = RUN.logBroken[i];
      if (i === CAUSE) return ["Right. This is the first line that says what went wrong: the startup code could not write the index file <code>cache/index.npz</code>. Everything after it follows from it: the app carried on without an index, so the first question crashed. The loud traceback at the bottom is a symptom. Read a deploy log from the top and stop at the first error.", true];
      if (i < CAUSE) return ["A normal start: uvicorn starts the process and runs the startup code. Nothing has gone wrong yet. Read on.", false];
      if (t.includes("startup complete")) return ["This line looks reassuring, and it is misleading. Startup “completed” only because the startup code caught an error and carried on. Something above it went wrong first.", false];
      if (t.includes("Uvicorn running")) return ["Normal: the server listens on <code>0.0.0.0</code>, port 7860, the port a Docker Space sends traffic to. The service is reachable. The problem is what it does once a request arrives.", false];
      if (t.includes("GET /health")) return ["The health check answered 200 OK, so the host thinks all is well. That is a problem (screen 5 is about it), but not the cause. It says nothing about why questions fail.", false];
      if (t.includes("POST /ask")) return ["This is the first failed request, and it is a symptom: by the time a question arrives, the service is already broken. Look above the requests for what broke it.", false];
      if (i > CUT) return [`The last lines are the loudest: <code>KeyError: 'index'</code> says the index is missing when a question arrives. They do not say why it is missing. Scroll up: what stopped it from being loaded?`, false];
      return ["This is the start of the traceback of the failed question, inside the web framework. It is a symptom of something earlier. The first lines of a traceback rarely name the cause.", false];
    };
    const paint = () => {
      const fin = pick === CAUSE;
      el.innerHTML = `<h1>The deploy is up. Every question fails.</h1>
        <p class="lead">You packed the service into an image. The model file is downloaded into the image, and the index is built at startup and saved to <code>cache/</code>. On your laptop it answers. Spaces is Hugging Face's app hosting, and a Docker Space runs your image as a container. You ran the same image the way a Docker Space does: as user ID 1000 (a normal user, not root, the admin user) and on port 7860. The health check (<code>/health</code>, the URL a host calls to see if the service is up) said 200. The first question got <code>${kit.esc(RUN.curlBroken.ask)}</code>. Here is the container's log.</p>
        <p class="task">Tap the first line that explains why questions fail.</p>
        <div class="${P}lines">${RUN.logBroken.map((l, i) => i === CUT ? `<div>… the middle of the traceback cut</div>` : `<button type="button" data-line="${i}" ${fin ? "disabled" : ""} class="${pick === i ? (fin ? "right" : "wrong") : ""}">${kit.esc(l)}</button>`).join("")}</div>
        ${cap(CAPTION + ", trimmed with …")}
        <div class="lpanel">${pick == null ? "" : kit.feedback(...why(pick))}</div>`;
      el.querySelectorAll("[data-line]").forEach(b => b.onclick = () => { pick = +b.dataset.line; paint(); if (pick === CAUSE) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: why can user 1000 not write where root could? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The container's disk is full",
      "The image builds as root, so <code>cache/</code> belongs to root. The host runs the container as user 1000, who may not write there",
      "numpy cannot write <code>.npz</code> files inside a container",
      "<code>COPY . .</code> left <code>cache/</code> out because of <code>.dockerignore</code>"
    ];
    const fb = [
      ["A full disk gives <code>No space left on device</code>, not <code>Permission denied</code>. Errno 13 is about who you are, not how much room is left.", false],
      [`Right. Every Dockerfile step runs as root unless the file (or its base image) sets another user with <code>USER</code>, so <code>RUN mkdir -p cache</code> made a folder owned by root that only root may write to. Docker on your laptop runs containers as root by default, so it worked there (the root run answered ${kit.esc(RUN.rootAsk)}). The Spaces docs say a Docker Space runs the container as user ID 1000, and user 1000 may only read that folder. The idea: <b>the host runs your image under its own conditions</b>. Test locally under them before you push: <code>docker run --user 1000 -p 7860:7860 …</code>.`, true],
      ["The same image, as root, wrote <code>cache/index.npz</code> and answered. Same numpy, same code. Only the user changed.", false],
      ["The folder is there: the <code>ls -ld</code> lines show <code>/app/cache</code> in both runs. It exists; the question is who may write into it.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Same image, different user</h1>
        <p class="lead">Run as root, Docker's default, the image works. Run as user 1000, it cannot write its cache. We asked each container who it runs as (<code>id</code>) and who owns the cache folder (<code>ls -ld</code>). The first run below is as user 1000, the second as root; <code>uid</code> is the user ID. How to read <code>drwxr-xr-x … root root</code>: the owner (root) may write; everyone else may only read and enter.</p>
        ${label("Dockerfile")}${code(kit, RUN.dockerfileFirst, ans === 1 ? 6 : -1)}
        ${log(kit, RUN.owners.slice(0, 6))}
        ${cap(CAPTION)}
        <p class="task">Why does user 1000 get <code>Permission denied</code>?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Pick the fix, then see the real run with it. */
  function pickFix({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Add <code>USER root</code> near the end of the Dockerfile",
      "Add <code>RUN chmod -R 777 /app</code> at the end",
      "Create user 1000 at the top, switch to it, work in its home folder, and copy files in with <code>--chown=user</code>"
    ];
    const fb = [
      ["The host, not your Dockerfile, decides which user runs the container: the Spaces docs say it runs with user ID 1000. Plan for that user instead of fighting it. Running a public service as root is also the less safe choice.", false],
      [`It would let user 1000 write, at a price. The Spaces docs warn that changing a file's metadata (owner, mode) stores a new copy of the file in the new layer. <code>-R</code> on <code>/app</code> touches every file, the ${MODEL_MB} MB model too, so the image grows by that much. And 777 lets every user change every file. The docs suggest <code>chmod</code> only for one folder you must share, such as <code>/data</code>.`, false],
      ["Right. This is the pattern in the Spaces docs. The files belong to user 1000 from the moment they enter the image, so nothing is copied twice, and the startup code can write its cache. The real run is below.", true]
    ];
    const paint = () => {
      const ok = ans === 2;
      el.innerHTML = `<h1>Fix the image, not the symptom</h1>
        <p class="lead">You know the cause: the files and folders in the image belong to root, and the host runs the container as user 1000.</p>
        <p class="task">Which change should go into the Dockerfile?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}
        ${ok ? `${label("Dockerfile, fixed")}${code(kit, RUN.dockerfileFixed)}
          ${cap("<code>useradd -m -u 1000 user</code> creates the user with a home folder. <code>USER user</code> runs every later step as that user, and so does the container. <code>ENV HOME=…</code> sets the home folder that tools use for caches. <code>--chown=user</code> on <code>COPY</code> and <code>ADD</code> hands each file to the user as it is copied.")}
          ${label("The fixed image, run as user 1000")}${log(kit, RUN.logFixed.map((l, i) => i === 2 || i === RUN.logFixed.length - 1 ? { k: "good", t: l } : l))}
          ${label("who owns the cache folder now")}${log(kit, RUN.owners.slice(6))}
          ${cap(CAPTION)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 5. Broken on purpose, part two: the health check said 200 while every question failed. */
  function honestHealth({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Keep it: 200 means the process is running, and that is what a health check is for",
      "Answer 503 unless the index and the model are loaded, and 200 when they are",
      "Ask the model a real question on every check, and answer 200 if it replies"
    ];
    const fb = [
      ["The process was running, and every question still failed. A host uses the health check to decide whether to send visitors to the service. A check that cannot fail sends them to a broken one.", false],
      [`Right. The check now reports what the service needs to answer. We put this /health into the first, broken Dockerfile and ran it as user 1000 again. It answered <code>${kit.esc(RUN.curlHonest)}</code>, so the failure is visible at once, from outside. Hosts read the status code: Render's docs, for example, count 2xx and 3xx as healthy and 4xx and 5xx as unhealthy (checked ${RUN.date}). Kubernetes, which runs containers at scale, names the two questions: a <b>liveness</b> probe asks whether the process should be restarted, a <b>readiness</b> probe asks whether it can serve traffic now.`, true],
      [`A health check runs every few seconds and must answer fast (Render's docs give it five seconds). One answer took ${RUN.askFixedSeconds} s on ${RUN.cpus} CPUs in our run, so these checks would keep the CPU busy and could time out under load. Check that the parts are loaded here, and test a real question once after each deploy (next screen).`, false]
    ];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>The health check said everything was fine</h1>
        <p class="lead">In the failing run, the startup code caught its error and carried on, and <code>/health</code> answered 200 while every question failed:</p>
        ${two(`${label("startup code")}${code(kit, RUN.startupCode, 6)}`, `${label("first /health")}${code(kit, RUN.healthFirst, 2)}${log(kit, [`$ curl …/health   ${RUN.curlBroken.health}`, { k: "hit", t: `$ curl …/ask      ${RUN.curlBroken.ask}` }])}${cap(CAPTION)}`)}
        <p class="task">What should <code>/health</code> do instead? (503 is the HTTP status for “service unavailable”.)</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}
        ${ok ? `${label("the new /health")}${code(kit, RUN.healthFixed)}${log(kit, [{ k: "hit", t: `$ curl …/health   ${RUN.curlHonest}` }])}${cap(CAPTION + ": the first Dockerfile, run as user 1000")}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. From scratch: a post-deploy check in plain Python. Predict the first try, then step through the real trace. */
  const STEP_SAY = s => {
    const [ln, a, st, , ev] = s;
    if (ev === "return") return `It returns. The check passed: the service is up and the answer came from <code>${RUN.reply.source}</code>, the right chunk. Now read the answer itself, below.`;
    if (ln === 1 && a == null) return "The container was started a moment ago. The loop tries the health endpoint at most <code>tries</code> times.";
    if (ln === 1) return `Next round of the loop.`;
    if (ln === 2) return `Try ${a}: ask <code>/health</code>.${st != null ? ` (<code>status</code> still holds the last try's value.)` : ""}`;
    if (ln === 3) return st === 0 ? `Status 0: <code>get_status</code> returns 0 when nobody answers. The server is not listening yet.` : `Status ${st}: the index and the model are loaded.`;
    if (ln === 4) return "Healthy: leave the loop.";
    if (ln === 5) return `Not healthy yet: wait ${WAIT} seconds before the next try.`;
    if (ln === 8) return "Health is not enough. Ask one question whose right source you know, like a tiny golden set.";
    if (ln === 9) return `The reply came from <code>${RUN.reply.source}</code>, which is <code>want_source</code>. The answer took ${RUN.reply.seconds} s.`;
    return "Build the result.";
  };
  function checkLive({ el, done, kit }) {
    ensureStyle();
    let ans = null, i = 0;
    const opts = ["200: the container has started, so the service answers", "503: the service is still loading the model", "0: nobody answers yet"];
    const fb = [
      [`Started is not the same as listening. Look at the log of the fixed run: <code>Application startup complete</code> comes before <code>Uvicorn running on …</code>. The port opens only after the startup code is done.`, false],
      [`uvicorn opens the port only after the startup code is done (the log shows <code>Application startup complete</code> before <code>Uvicorn running on …</code>). While the model loads, nobody listens, so there is no 503 to get. In this app a 503 means startup failed: against the first Dockerfile the same check got 0 on ${BROKEN_0 === 1 ? "one try" : `${word(BROKEN_0)} tries`} while it started, then 503 ${BROKEN_503 === 1 ? "once" : `${word(BROKEN_503)} times`}.`, false],
      [`Right. uvicorn opens the port only after the startup code is done, so the first try finds nobody. Step through the real run.`, true]
    ];
    const paint = () => {
      const s = RUN.trace[i], last = i === RUN.trace.length - 1;
      el.innerHTML = `<h1>Check the live service from outside</h1>
        <p class="lead">After every deploy, check the service from outside before you share the link. You can write the check in plain Python. <code>get_status</code> returns the status code of a GET, or 0 if nobody answers; <code>post_json</code> sends JSON and reads the reply. <code>base</code> is the service's URL, and <code>want_source</code> is the handbook chunk the right answer must come from. We started the fixed container and ran this at once.</p>
        ${code(kit, RUN.checkCode, ans === 2 ? s[0] : -1)}
        ${ans === 2 ? `<div class="vars"><span>attempt <b>${s[1] == null ? "–" : s[1]}</b></span><span>status <b>${s[2] == null ? "–" : s[2]}</b></span><span>reply.source <b>${s[3] ? RUN.reply.source : "–"}</b></span><span>step <b>${i + 1} / ${RUN.trace.length}</b></span></div>
          ${kit.feedback(STEP_SAY(s))}
          <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
          ${last ? `${label("returned")}${log(kit, [RESULT_FIXED])}${cap(CAPTION)}
            ${kit.feedback(`${FAILED_TRIES === 1 ? "One try" : `${word(FAILED_TRIES)[0].toUpperCase() + word(FAILED_TRIES).slice(1)} tries`} found nobody, try ${OK_ATTEMPT} got 200. Against the first Dockerfile with the new /health, the same script returned <code>${kit.esc(RUN.resultBroken)}</code>. But read what it accepted here. The handbook says: “${kit.esc(RULE_FIRST)}” The small model said: “${kit.esc(ANSWER_FIRST)}” The check proves the service is up and found the right chunk. It cannot tell a wrong answer from a right one.`)}` : ""}`
        : `<p class="task">Before you step: what does the first try of <code>/health</code> get?</p><div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; i = 0; paint(); });
      const p = el.querySelector("[data-prev]"), n = el.querySelector("[data-next]");
      if (p) p.onclick = () => { i--; paint(); };
      if (n) n.onclick = () => { i++; paint(); if (i === RUN.trace.length - 1) done(); };
    };
    paint();
  }

  /* 7. The real host: what a Docker Space reads from the repository. Written from the docs, not run by us. */
  function spacesConfig({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `Nothing answers: the Space sends traffic to port ${PORT}, the default. Add <code>app_port: 8000</code> to the README header`,
      "It works: the Space finds whichever port the app listens on",
      "The build fails, because the Dockerfile and the README disagree"
    ];
    const fb = [
      ["Right. The README header tells the Space which port to send traffic to, and <code>app_port</code> defaults to 7860. Change that one line, or start uvicorn on 7860, as our Dockerfile does. Either way the app must listen on <code>0.0.0.0</code>, as in the Docker lesson.", true],
      [`The Spaces docs describe one setting for this, <code>app_port</code>, with a default of ${PORT}. They describe no search for open ports. Your app can open other ports inside the container, but only <code>app_port</code> is exposed.`, false],
      ["The build only runs the Dockerfile; it never reads ports. It succeeds. The problem appears when the Space starts the container and sends traffic to a port nobody listens on.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What the host reads from your repository</h1>
        <p class="lead"><b>Not run by us.</b> Written from the <a href="https://huggingface.co/docs/hub/spaces-sdks-docker" target="_blank" rel="noopener">official documentation</a>, checked ${RUN.date}.</p>
        <p class="lead">A Space is a git repository. For a Docker Space you push the Dockerfile, the app and a <code>README.md</code> whose header holds the settings. Each push makes the Space rebuild and restart. Three settings matter here. <code>sdk: docker</code> says: build from your Dockerfile. <code>app_port</code> is the port visitors' traffic goes to; it is ${PORT} if you leave it out. User ID 1000 you do not set: the Space always uses it. The docs also say that files written to disk are lost when the Space restarts, and that on free hardware a Space goes to sleep when unused. So build the index at startup or in the image, never only once by hand.</p>
        ${two(`${label("README.md header, from the docs")}${code(kit, RUN.readme, 5)}`, `${label("push to deploy")}${code(kit, ["git add Dockerfile README.md requirements.txt main.py handbook.json", "git commit -m \"Deploy the handbook RAG\"", "git push"])}`)}
        <p class="lead">A fact that changes: on ${RUN.date} the Spaces docs say Docker Spaces need a paid plan to create, while static Spaces are free and a free account can host up to two Gradio Spaces (apps built with the Gradio Python UI library) on ZeroGPU, a shared GPU pool.</p>
        <p class="lead">A free host for the container, checked the same day: Render's docs list web services among the service types that can run on a free instance, and a Render web service can be built from a Dockerfile. A free web service spins down (goes to sleep) after 15 minutes without traffic, takes about a minute to wake, and loses its local files on restart, redeploy or spin-down. Check the host's current terms before you plan around a free tier. The image does not change between hosts; only these settings do.</p>
        <p class="task">A friend copies your Space but starts uvicorn on port 8000 and leaves <code>app_port</code> out of the README. What happens?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A portfolio demo that a few people try now and then, where a slow first answer is fine",
      "A support bot for thousands of customers, promised to answer within two seconds",
      "A tool that tells nurses which dose fits a patient's weight"
    ];
    const fb = [
      ["Right. Few visitors, nothing at stake if the first answer is slow or the wording is clumsy. A small CPU model on a free tier fits exactly that.", true],
      [`A free tier sleeps when unused, has a few CPUs, and our small model took ${RUN.askFixedSeconds} s for one sentence. Thousands of users with a time promise need paid hardware that stays up, or a hosted model API.`, false],
      ["Here a wrong answer can hurt someone, and the small model already got the laser cutter rule backwards. Use a strong model, a tested evaluation, and people who check the output, not a free demo setup.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When a free CPU deploy is the right call</h1>
        <p class="lead"><b>What it is for:</b> a public link to a working AI service with no per-question bill. <b>Reach for it</b> for demos, portfolios and internal trials with few users. <b>Not for</b> heavy traffic, response-time promises or answers that must be right; use paid hardware or a hosted model API there. <b>What it costs:</b> answer quality (a model small enough for a CPU makes more mistakes), slow answers and a slow first visit after sleep, a disk that is wiped on restart, and terms that change: re-check the free tier. Every deploy also needs its own checks: the host's user and port, a health endpoint that tells the truth, and one real question.</p>
        <p class="task">Which of these is a good fit for this setup?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise it: would testing under the host's conditions have caught it? */
  const CASES = [
    ["A service downloads its model into a cache under the home folder when it starts. It works on the laptop. On a host that runs containers as user 1000, startup fails with Permission denied.", true,
      `Yes. We ran an image as user 1000, with no user of that ID in the image. Its home folder was <code>/</code> (<code>${RUN.homeAs1000[0]}</code>), and <code>mkdir</code> answered <code>${esc(RUN.homeAs1000[1])}</code>. So caches under <code>~/.cache</code> cannot be created. <code>docker run --user 1000</code> on your laptop shows this before the push. Create the user and set <code>HOME</code>, as in the fixed Dockerfile.`,
      `This is the user problem again. As user 1000 with no such user in the image, the home folder is <code>/</code> (we saw <code>${RUN.homeAs1000[0]}</code>), so <code>~/.cache</code> cannot be created. Running locally with <code>--user 1000</code> shows it before the push.`],
    ["A service builds and starts on the host, its log says it is running on 127.0.0.1, and every request from outside gets no reply.", true,
      "Yes. The Docker lesson showed this on a laptop: with <code>-p</code> and no <code>--host 0.0.0.0</code>, curl from outside gets no answer. A local run with the host's port mapping catches it.",
      "A local <code>docker run -p …</code> and one curl show it: uvicorn on 127.0.0.1 listens only inside the container. Add <code>--host 0.0.0.0</code>."],
    ["The live demo answers every question with the right source chunk, but some answers say the opposite of what the chunk says.", false,
      "Right, no. The service works the same on every machine; on your laptop it gives the same answers. The model is the problem, not the deploy. A golden set of questions with checked answers finds it; a stronger model or a tighter prompt fixes it.",
      "No deploy setting changes what the model writes: the same image on your laptop gives the same answers. This needs an evaluation with checked answers, and then a stronger model or a better prompt."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a local run have caught it?</h1>
        <p class="lead">Three services, away from the makerspace. Each one went wrong after a deploy.</p>
        <p class="task">For each one, decide whether running the image locally under the host's conditions (its user, its port) would have shown the problem before the push. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((cs, i) => cs.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can ship and check a model service</h1>
      <p class="lead">You chose a small 4-bit CPU model so the link needs no key, found the first real error in a failing deploy log, traced it to the user the host runs your container as, fixed the image the way the host's docs say, made <code>/health</code> tell the truth, and stepped through a post-deploy check that also showed its limit: it cannot judge an answer.</p>
      <p class="lead">This lesson was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Every deploy here changed one thing at a time and you compared runs by hand. Next, you record each run's settings and results so the comparison does not live in your head.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Ship the RAG service to a public URL",
    checked: "2026-11-14",
    sources: [
      "https://huggingface.co/docs/hub/spaces-sdks-docker",
      "https://huggingface.co/docs/hub/spaces-config-reference",
      "https://huggingface.co/docs/hub/spaces-overview",
      "https://huggingface.co/docs/hub/spaces-zerogpu",
      "https://render.com/docs/health-checks",
      "https://render.com/docs/free",
      "https://render.com/docs/web-services",
      "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/",
      "https://docs.docker.com/reference/cli/docker/container/run/",
      "https://docs.docker.com/reference/dockerfile/",
      "https://llama-cpp-python.readthedocs.io/en/latest/",
      "https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF"
    ],
    interview: [{
      q: "Your RAG demo works on your laptop. After deploying it to a hosted container platform, the health check is green but every question returns 500. How do you find and fix the problem?",
      good: [
        "Read the deploy log from the top and stop at the first error; the traceback at the bottom is usually a symptom",
        "Reproduce it locally under the host's conditions: its user ID, its port, its environment variables",
        "Fix the cause in the image, for example create the non-root user and copy files with --chown instead of chmod -R",
        "Make /health report readiness (503 until the model and index are loaded) so the host and you see the failure",
        "After each deploy, run one known question from outside and check the source; evaluate answer quality separately"
      ],
      weak: "Redeploy, give it bigger hardware, or search the last line of the traceback. That skips the first error, and a green health check that means only “the process runs” keeps hiding the next failure."
    }],
    screens: [situation, readLog, spotIdea, pickFix, honestHealth, checkLive, spacesConfig, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-line="${LAST}"]`], right: [`[data-line="${CAUSE}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(RUN.trace.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
