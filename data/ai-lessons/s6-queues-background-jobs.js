/* Lesson: queues and background jobs for long AI work. Story: a small law firm uploads a folder of 40 contracts
   for review, the web request summarises them one after another, and the page dies before the summaries finish.
   Ideas: (1) answer at once with a job id, put one task per contract on a queue, let a worker process them, and
   let the page ask for progress; (2) a task can run more than once (retries, crashes), so it must be safe to
   repeat, and the work is split into tasks small enough that worker processes can share it.
   Depth: explain (screens 1, 2, 3, 8, 9), library: Celery with Redis and FastAPI, a real run (4, 5, 6),
   debug: a retry that wrote a second row (7), when-not (8, 9).
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s6-queues-background-jobs/contract-01 ... contract-40: a
     small hosted model summarising 40 made-up contracts, one call after another; the time of each call is the
     recording file's write time minus its recordedAt stamp (docs/ai-path/runs/s6-queues-background-jobs/recorded.py);
   - docs/ai-path/runs/s6-queues-background-jobs/run_experiments.py + run_experiments.out.txt + logs/: Redis, a
     Celery worker and the FastAPI app run on our Mac. The worker replays each recorded summary and waits as long
     as the real call took (it calls no model). review_tasks.py is the fixed task, v1/review_tasks.py the first one.
   Lesson-local picture and style: the run timeline in SVG (timeline()), log and box styles (.lx-s6-queues-background-jobs-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s6-queues-background-jobs";
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  const f1 = n => n.toFixed(1), f2 = n => n.toFixed(2);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s6-queues-background-jobs/run_experiments.out.txt, line "recorded_seconds":
  // seconds each recorded summary took, contracts 1 to 40, in the order they were sent
  const SECONDS = [1.3, 1.16, 1.35, 1.36, 1.26, 1.38, 1.42, 1.17, 1.41, 1.6, 1.1, 1.5, 1.3, 1.26, 1.43, 1.23, 1.23, 1.28, 1.3, 1.26,
    1.3, 1.41, 1.35, 1.06, 1.44, 1.33, 1.35, 1.3, 1.19, 1.32, 1.44, 1.17, 1.19, 1.77, 1.47, 1.38, 1.35, 1.16, 1.47, 1.61];
  // From docs/ai-path/recordings/s6-queues-background-jobs/contract-01.json (trimmed with … , not altered)
  const REC_ONE = {
    src: "s6-queues-background-jobs/contract-01",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "*   **Parties:** Willow Yoga Studio (Client) and Fresh Fields Wholesale (Provider). … *   **Liability:** No stated limit on either party's liability. … Watch out: The lack of a limit on liability for the Provider means the Client could be exposed to significant damages."
  };
  const CAPTION = `Recorded model output, ${REC_ONE.recordedAt}`;
  // The firm's host: Heroku's router ends a request that has not answered in 30 s (devcenter.heroku.com, checked 2026-11-13)
  const LIMIT = 30;
  // From run_experiments.out.txt, experiment "states" (one task, contract 5, worker with --concurrency=1)
  const STATES = { idLength: 36, afterDelay: "PENDING", during: "STARTED", end: "SUCCESS", madeUp: "PENDING" };
  // From run_experiments.out.txt, experiment "browser-c4" (4 worker processes, the page polls every 2 s)
  const BROWSER = {
    postStatus: 202, postMs: 78.3, postKeys: ["job_id"],
    polls: [[2.1, 4], [4.1, 10], [6.1, 16], [8.1, 22], [10.1, 28], [12.1, 33], [14.1, 40]], total: 40,
    unknownStatus: 404, unknownBody: "{\"detail\": \"no such job\"}"
  };
  // From run_experiments.out.txt, "seconds_until_all_done" of experiments c1, c4, c8 and one-big-task-c8
  const RUNS = { c1: 54.11, c4: 14.15, c8: 7.37, bigC8: 53.67 };
  // From run_experiments.out.txt, experiment "broken-retry-c4" (v1/review_tasks.py)
  const BROKEN = {
    polls: [[2.1, 4], [4.1, 10], [6.1, 16], [8.1, 22], [10.1, 28], [12.1, 33], [14.1, 40], [19.1, 41]], total: 40,
    modelCalls: 41,
    rows: [2, 1, 3, 4, 5, 8, 6, 7, 11, 9, 10, 12, 13, 14, 16, 15, 17, 18, 19, 20, 21, 22, 24, 23, 25, 26, 27, 28, 29, 30, 32, 31, 33, 36, 35, 34, 37, 38, 39, 40, 17]
  };
  // From logs/broken-retry-c4.worker.log, every line of the task that handled contract 17 (date removed; task id cut with …)
  const LOG_BROKEN = [
    "[23:28:56,146: INFO/MainProcess] Task review_tasks.summarise_contract[e0ee1da7…] received",
    "[23:29:01,260: INFO/SpawnPoolWorker-1] review_tasks.summarise_contract[e0ee1da7…]: model call for contract 17",
    "[23:29:02,509: INFO/SpawnPoolWorker-1] Task review_tasks.summarise_contract[e0ee1da7…] retry: Retry in 0s: UploadTimeout('document store did not answer')",
    "[23:29:03,813: INFO/MainProcess] Task review_tasks.summarise_contract[e0ee1da7…] received",
    "[23:29:09,009: INFO/SpawnPoolWorker-1] review_tasks.summarise_contract[e0ee1da7…]: model call for contract 17",
    "[23:29:10,242: INFO/SpawnPoolWorker-1] Task review_tasks.summarise_contract[e0ee1da7…] succeeded in 1.2330843745730817s: 17"
  ];
  // From logs/fixed-retry-c4.worker.log, the same contract with review_tasks.py (the "received" line before the
  // first model call is cut; date removed; task id cut with …)
  const LOG_FIXED = [
    "[23:29:25,856: INFO/SpawnPoolWorker-2] review_tasks.summarise_contract[388dfb2b…]: model call for contract 17",
    "[23:29:27,104: INFO/SpawnPoolWorker-2] Task review_tasks.summarise_contract[388dfb2b…] retry: Retry in 1s: UploadTimeout('document store did not answer')",
    "[23:29:28,414: INFO/MainProcess] Task review_tasks.summarise_contract[388dfb2b…] received",
    "[23:29:33,609: INFO/SpawnPoolWorker-2] Task review_tasks.summarise_contract[388dfb2b…] succeeded in 0.0010052090510725975s: 17"
  ];
  // From run_experiments.out.txt, experiment "fixed-retry-c4"
  const FIXED = { done: 40, total: 40, modelCalls: 40 };

  /* ---------- Derived from the data ---------- */
  const N = SECONDS.length;
  const CUM = SECONDS.reduce((a, s) => { a.push((a.length ? a[a.length - 1] : 0) + s); return a; }, []);
  const SUM = CUM[N - 1];
  const CUT = CUM.findIndex(t => t > LIMIT);            // index of the contract in progress at the limit
  const DONE_AT_LIMIT = CUT;                            // contracts finished before it
  const MIN = Math.min(...SECONDS), MAX = Math.max(...SECONDS), AVG = SUM / N;
  const DUP = BROKEN.rows.find((c, i) => BROKEN.rows.indexOf(c) !== i);
  const LAST_BROKEN = BROKEN.polls[BROKEN.polls.length - 1];
  const FULL_POLL = BROKEN.polls.find(p => p[1] === BROKEN.total);

  /* ---------- Lesson-local style, the timeline picture and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-tl { margin: 14px auto 0; max-width: 560px; }
      .lx-${ID}-tl svg { display: block; width: 100%; height: auto; }
      .lx-${ID}-tl .sg { fill: var(--sunk); stroke: var(--ink-2); stroke-width: .6; }
      .lx-${ID}-tl .sg.alt { fill: var(--surface); }
      .lx-${ID}-tl .sg.ok { fill: var(--good-soft); stroke: var(--good); }
      .lx-${ID}-tl .sg.cut { fill: var(--bad-soft); stroke: var(--bad); stroke-width: 1.6; }
      .lx-${ID}-tl .sg.gone { opacity: .3; }
      .lx-${ID}-tl .ax { stroke: var(--ink); stroke-width: 1; }
      .lx-${ID}-tl .tk { fill: var(--muted); font: 500 10.5px var(--font); text-anchor: middle; }
      .lx-${ID}-tl .lim { stroke: var(--ink); stroke-width: 2.4; stroke-dasharray: 5 3; }
      .lx-${ID}-key { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 6px 0 0; font: 500 13px var(--font); color: var(--muted); }
      .lx-${ID}-key > span { display: inline-flex; align-items: center; gap: 6px; }
      .lx-${ID}-key i { display: inline-block; width: 18px; height: 12px; border: 1px solid var(--ink-2); background: var(--sunk); }
      .lx-${ID}-key i.ok { background: var(--good-soft); border-color: var(--good); }
      .lx-${ID}-key i.cut { background: var(--bad-soft); border-color: var(--bad); border-width: 2px; }
      .lx-${ID}-key i.gone { opacity: .3; }
      .lx-${ID}-mono { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font: 500 13px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .lx-${ID}-log { margin: 10px 0 0; display: grid; gap: 4px; counter-reset: ln; }
      .lx-${ID}-log > div { padding: 6px 8px 6px 34px; position: relative; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font: 500 12.5px/1.5 var(--mono); overflow-wrap: anywhere; color: var(--ink-2); }
      .lx-${ID}-log > div::before { counter-increment: ln; content: counter(ln); position: absolute; left: 10px; top: 6px; color: var(--muted); font-weight: 600; }
      .lx-${ID}-log > div.hot { border: 2px solid var(--ink); color: var(--ink); }
      .lx-${ID}-lane { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
      .lx-${ID}-lane > p { margin: 0 0 8px; font-weight: 600; }
      .lx-${ID}-lane .lopts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
      .lx-${ID}-lane .lopts button { padding-left: 4px; padding-right: 4px; text-align: center; font-size: 14px; }
      .lx-${ID}-wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + var(--ind, 4ch)); text-indent: calc(-1 * var(--ind, 4ch)); }
      .lx-${ID}-tools .lopts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      @media (max-width: 520px) {
        .lx-${ID}-lane .lopts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .lx-${ID}-wrap .lcode div { font-size: 12.5px; padding-left: calc(12px + var(--ind, 4ch)); }
      }
    `;
    document.head.appendChild(s);
  }
  // The inline run as a timeline: one box per contract, width = its recorded seconds.
  const AX = 60, X0 = 12, X1 = 322;
  const sx = t => X0 + (X1 - X0) * t / AX;
  function timeline(kit, { cut = false, title = "" } = {}) {
    const r1 = n => Math.round(n * 10) / 10;
    const segs = SECONDS.map((s, i) => {
      const a = i ? CUM[i - 1] : 0, cls = !cut ? (i % 2 ? "alt" : "") : i < CUT ? "ok" : i === CUT ? "cut" : (i % 2 ? "alt gone" : "gone");
      return `<rect class="sg ${cls}" x="${r1(sx(a))}" y="12" width="${r1(sx(a + s) - sx(a))}" height="26"/>`;
    }).join("");
    const ticks = [0, 10, 20, 30, 40, 50, 60].map(t => `<line class="ax" x1="${r1(sx(t))}" y1="40" x2="${r1(sx(t))}" y2="45"/><text class="tk" x="${r1(sx(t))}" y="58">${t} s</text>`).join("");
    const lim = cut ? `<line class="lim" x1="${r1(sx(LIMIT))}" y1="2" x2="${r1(sx(LIMIT))}" y2="44"/>` : "";
    return `<div class="lx-${ID}-tl">${title ? `<p class="lx-${ID}-cap">${kit.esc(title)}</p>` : ""}<svg viewBox="0 0 340 64" role="img" aria-label="${kit.esc(title || "timeline of the 40 summaries")}">${segs}<line class="ax" x1="${X0}" y1="40" x2="${X1}" y2="40"/>${ticks}${lim}</svg></div>`;
  }
  const tlKey = (kit, cut) => `<div class="lx-${ID}-key">${cut
    ? `<span><i class="ok"></i>finished before the limit</span><span><i class="cut"></i>in progress when the router gives up</span><span><i class="gone"></i>after it</span><span>dashed line: the ${LIMIT} s limit</span>`
    : `<span><i></i>one box = one contract, as wide as its summary took</span>`}</div>`;
  // A code listing whose wrapped lines hang 4 characters deeper than the line's own indent.
  const wcode = (kit, lines, active = -1) => { let i = 0;
    return `<div class="lx-${ID}-wrap">${kit.code(lines, active).replace(/<div(?=[ >])/g, () => `<div style="--ind:${lines[i++].match(/^ */)[0].length + 4}ch"`)}</div>`; };
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  const logBox = (kit, lines, hot = []) => `<div class="lx-${ID}-log">${lines.map((l, i) => `<div class="${hot.includes(i) ? "hot" : ""}">${kit.esc(l)}</div>`).join("")}</div>`;
  // Screens with several questions: the next opens when the one before is right.
  function chain(kit, el, Q, ans, done, intro) {
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const show = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = `${intro()}${Q.slice(0, show).map((q, i) => `<div class="lcase" id="q${i}"><p>${q.q}</p>${ask(kit, q.opts, q.right, ans[i], q.fb)}</div>`).join("")}${upto === -1 && Q.after ? Q.after() : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, k) => a === Q[k].right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation, and the by-hand task: the inline run on a timeline. */
  function inlineRun({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null];
    const opt1 = [DONE_AT_LIMIT, LIMIT, N].sort((a, b) => a - b);
    const Q = [
      { q: `The summaries run one after another inside the request. How many are <b>finished</b> when the router gives up at ${LIMIT} s?`,
        opts: opt1.map(String), right: opt1.indexOf(DONE_AT_LIMIT),
        fb: opt1.map(v => v === DONE_AT_LIMIT
          ? [`Right. Contracts 1 to ${DONE_AT_LIMIT} finish by ${f1(CUM[DONE_AT_LIMIT - 1])} s. Contract ${CUT + 1} is still running at ${LIMIT} s; it would end at ${f1(CUM[CUT])} s. All ${N} would need ${f1(SUM)} s.`, true]
          : v === N ? [`All ${N} together took ${f1(SUM)} s: add up the boxes. That is past the ${LIMIT} s the router waits, so the last ones never make it into an answer.`, false]
          : [`That counts one second per contract. The recorded calls took ${f2(MIN)} to ${f2(MAX)} s, about ${f2(AVG)} s each, so fewer fit: ${LIMIT} ÷ ${f2(AVG)} is about ${Math.floor(LIMIT / AVG)}. Read it off the timeline at the ${LIMIT} s mark.`, false]) },
      { q: `The paralegal now sees the host's error page. What is the app doing?`,
        opts: [`It stopped at ${LIMIT} s, when the router gave up`, `It keeps summarising contracts ${CUT + 1} to ${N}, and no one will receive the result`, `It saved the ${DONE_AT_LIMIT} finished summaries, so a reload shows them`],
        right: 1,
        fb: [
          [`The router answers the browser, but nothing tells the app. Heroku's documentation says it plainly: the application "will continue to work on the request". The model calls go on, and are paid for.`, false],
          [`Right. Heroku's documentation: the application "will not know that the request it is processing has reached a time-out" and "will continue to work on the request". The work finishes, its answer has nowhere to go, and when she presses reload a second run starts from contract 1: ${N} more model calls.`, true],
          [`The summaries live only inside this one request. Nothing wrote them anywhere a reload could find. A reload is a brand-new request that starts again from contract 1.`, false]
        ] }
    ];
    chain(kit, el, Q, ans, done, () => `<h1>A folder of contracts, and a page that dies</h1>
      <p class="lead">A small law firm built a review page: a paralegal uploads a folder of contracts, and the app asks a model for a short summary of each one. The first real folder had <b>${N} contracts</b>. The page spun, then showed an error, and no summaries came back.</p>
      <p class="lead">We sent ${N} made-up contracts to a small hosted model, one at a time. Contract 1 took ${f2(SECONDS[0])} s and came back like this:</p>
      ${mono(kit, REC_ONE.text)}<p class="lx-${ID}-cap">${CAPTION}</p>
      <p class="lead">The app runs on a host whose <b>router</b> (the part of the host that passes each request to the app) gives a request <b>${LIMIT} seconds</b> to answer. Heroku works this way. Here are the ${N} recorded calls, one after another, as the request ran them:</p>
      ${timeline(kit, { cut: ans[0] === Q[0].right })}${tlKey(kit, ans[0] === Q[0].right)}
      <p class="task">Read the timeline at the ${LIMIT} s mark and answer both questions; the second opens when the first is right.</p>`);
  }

  /* 2. Spot the idea: what fixes it for good? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Ask for a longer limit, say five minutes",
      `Send all ${N} model calls at the same time inside the request, so it ends in a few seconds`,
      "Answer at once with a job number, do the summaries somewhere else, and let the page ask how far they are",
      "Stream each summary to the page as it is written, so bytes keep flowing"
    ];
    const fb = [
      [`Heroku's ${LIMIT} s limit cannot be changed at all ("The timeout value is not configurable"). Behind your own proxy you could raise it (nginx waits 60 s by default), but next month's folder has 200 contracts, a closed laptop or a deploy still kills the run, and every reload pays again.`, false],
      [`Today it might fit. But ${N} calls at once is what trips the provider's rate limit from the last lesson, and the work still lives inside one browser request: close the tab or lose the wifi and it is gone, reload and it starts again.`, false],
      [`Right. The request only <i>starts</i> the work and answers with a number, the <b>job id</b>. The slow part runs in a separate process, a <b>worker</b>, that does not care whether the browser is still there. The page asks "how far is job 7f3…?" every few seconds. This is a <b>background job</b>, and the list of work waiting for a worker is a <b>queue</b>.`, true],
      [`Streaming does keep the connection alive, and it is right for one answer someone watches. But a ${N}-contract run would still live inside one open tab: a closed laptop or a deploy ends it, and a reload starts it again from contract 1.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What fixes it for good?</h1>
        <p class="lead">The firm's folders will only grow. Some partners want to upload a folder at night and read the summaries in the morning.</p>
        <p class="task">Which change fixes the dying page for good?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 3. By hand: redraw the run with a queue and a worker. Who does each step? */
  const LANES = ["Browser", "Web app", "Queue", "Worker"];
  const STEPS = [
    { t: `Sends the folder: ${N} contract ids`, right: 0,
      no: { 1: "The web app receives the folder; someone has to send it first.", 2: "The queue holds tasks for workers; it does not talk to the paralegal.", 3: "The worker never sees the browser. It only takes tasks from the queue." } },
    { t: "Makes a job id, puts one task per contract on the queue, and answers at once", right: 1,
      no: { 0: "The browser asks; the server decides the job id and keeps the record of it.", 2: "The queue only stores what it is given. Something has to create the tasks and the job id.", 3: "If the worker had to answer the browser, the browser would wait for the worker again." } },
    { t: "Holds the tasks until a worker is free", right: 2,
      no: { 0: "The browser could be closed at any moment. The tasks must sit somewhere that stays up.", 1: "If the web app kept them in its own memory, a deploy or crash would lose them. A separate store (Redis here) keeps them.", 3: "A worker holds only the task it is running now. The rest wait in the queue." } },
    { t: "Takes the next task and calls the model for one contract", right: 3,
      no: { 0: "The browser would need the API key, and would have to stay open.", 1: "That is the design that died at 30 s. The web app must stay free to answer requests.", 2: "The queue runs no code. It is a list that workers read from." } },
    { t: "Writes the summary under the job id", right: 3,
      no: { 0: "The browser only reads progress. The result is written where it outlives any one page.", 1: "The web app is not involved while a contract is being summarised. The worker that made the summary saves it.", 2: "The queue holds work to do, not results. Results go to a store the web app can read." } },
    { t: "Every few seconds asks: how far is this job?", right: 0,
      no: { 1: "The web app answers the question; the browser is the one that keeps asking.", 2: "The queue does not know about pages or users.", 3: "The worker does not know the browser exists. That is what makes the run survive a closed laptop." } }
  ];
  function redraw({ el, done, kit }) {
    ensureStyle();
    const ans = STEPS.map(() => null);
    const paint = () => {
      const all = STEPS.every((s, i) => ans[i] === s.right);
      el.innerHTML = `<h1>Redraw it with a queue and a worker</h1>
        <p class="lead">The new design has four parts: the paralegal's <b>browser</b>, the firm's <b>web app</b>, a <b>queue</b> (a list of tasks kept in a small store such as Redis), and a <b>worker</b> (a separate process that runs tasks).</p>
        <p class="task">For each step, pick the part that does it. Pick again if you change your mind.</p>
        ${STEPS.map((s, i) => `<div class="lx-${ID}-lane" id="l${i}"><p>${i + 1}. ${kit.esc(s.t)}</p>${kit.options(LANES, { picked: ans[i], correct: s.right })}${ans[i] == null ? "" : ans[i] === s.right ? "" : kit.feedback(kit.esc(s.no[ans[i]]), false)}</div>`).join("")}
        ${all ? kit.feedback(`That is the whole pattern. The request now ends as soon as step 2 is done: in our run of this design the web app answered in <b>${Math.round(BROWSER.postMs)} ms</b>, against ${f1(SUM)} s inline. The store between the web app and the worker is called the <b>broker</b>. Next you will see the real code.`, true) : ""}`;
      el.querySelectorAll(".lx-" + ID + "-lane").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (STEPS.every((s, j) => ans[j] === s.right)) done();
      }));
    };
    paint();
  }

  /* 4. Celery: the task, and the states a task id goes through (real run). */
  // From docs/ai-path/runs/s6-queues-background-jobs/review_common.py and review_tasks.py (cut with …; the two
  // continuation lines of Celery(...) are indented 4 spaces here instead of 13, to fit a phone)
  const TASK_CODE = [
    "app = Celery(\"review_tasks\",",
    "    broker=\"redis://localhost:6493/0\",",
    "    backend=\"redis://localhost:6493/1\")",
    "app.conf.task_track_started = True",
    "…",
    "@app.task(autoretry_for=(UploadTimeout,), retry_backoff=True, max_retries=3)",
    "def summarise_contract(job_id, contract_id):",
    "    …",
    "    return contract_id"
  ];
  function celeryTask({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const Q = [
      { q: "The web app calls <code>summarise_contract.delay(job_id, 5)</code>. What does it get back, at once?",
        opts: ["The summary of contract 5", `A result object holding a task id and the state ${STATES.afterDelay}`, "Nothing: delay() waits until the worker is done"],
        right: 1,
        fb: [
          [`<code>.delay()</code> only puts a message on the queue. The summary does not exist yet; the worker has not even picked the task up.`, false],
          [`Right. Celery's docs: "Calling a task returns an AsyncResult instance." In our run it held a ${STATES.idLength}-character task id, and its state was <code>${STATES.afterDelay}</code>. The call returns in milliseconds, which is the whole point.`, true],
          [`That would be the inline design again. <code>.delay()</code> sends the task and returns at once. (<code>result.get()</code> can wait, but Celery's docs say this "is rarely used", because it makes the call synchronous again.)`, false]
        ] },
      { q: "We asked for the state of that task again and again while the worker ran it. What did we see?",
        opts: [`${STATES.afterDelay} → ${STATES.end}`, `${STATES.afterDelay} → ${STATES.during} → ${STATES.end}`, "QUEUED → RUNNING → DONE"],
        right: 1,
        fb: [
          [`That is Celery's default. This app set <code>task_track_started = True</code> (line 4), so the worker also reports when it starts. The docs: STARTED is "Not reported by default".`, false],
          [`Right: <code>${STATES.afterDelay}</code>, then <code>${STATES.during}</code> once a worker process began, then <code>${STATES.end}</code>. You see <code>${STATES.during}</code> only because of line 4. The other built-in states are <code>RETRY</code>, <code>FAILURE</code> and <code>REVOKED</code>.`, true],
          [`Those are not Celery's names. Its built-in states are PENDING, STARTED, RETRY, FAILURE, SUCCESS and REVOKED.`, false]
        ] },
      { q: "Then we asked for the state of a task id we made up, one that never existed. What did Celery say?",
        opts: ["An error: unknown task id", `${STATES.madeUp}`, "FAILURE"],
        right: 1,
        fb: [
          [`No error. Celery cannot tell "not started yet" from "never existed".`, false],
          [`Right: <code>${STATES.madeUp}</code>. Celery's docs: "Any task id that's not known is implied to be in the pending state." So a mistyped id, an expired result or a lost task all look like work that has not started. That is why the firm's app keeps its own record of each job (next screen).`, true],
          [`FAILURE means a task ran and raised an error. This id was never run at all, and Celery answered <code>${STATES.madeUp}</code>.`, false]
        ] }
    ];
    chain(kit, el, Q, ans, done, () => `<h1>The worker's side, in Celery</h1>
      <p class="lead"><b>Celery</b> is a Python task queue. You mark a function as a task; <code>.delay(...)</code> puts a call to it on the queue; a worker started with <code>celery -A review_tasks worker</code> runs it. Here Redis is both the <b>broker</b> (where tasks wait) and the <b>backend</b> (where states and results are kept). From our <code>review_tasks.py</code>:</p>
      ${wcode(kit, TASK_CODE, -1)}
      <p class="lx-${ID}-cap">The task's body is cut (…); you will see it on screen 7. <code>autoretry_for</code> retries the task when it raises that error, with backoff, at most three times: the retry rules from the last lesson, built in.</p>
      <p class="lead">One thing about our run: the worker called no model. Its <code>call_model</code> replays the recorded summary of each contract and waits as long as the real call took. Redis, Celery, the worker and the web app are real.</p>
      <p class="task">Predict each result of our real run. The next question opens when you have the last one right.</p>`);
  }

  /* 5. The web side: job id, status route, polling (real run). */
  // From docs/ai-path/runs/s6-queues-background-jobs/web.py, the two routes (the ONE_BIG_TASK switch and the
  // blank lines cut; the switch is shown on screen 6)
  const WEB_CODE = [
    "@api.post(\"/reviews\", status_code=202)",
    "def start_review(folder: Folder):",
    "    job_id = uuid4().hex",
    "    r.set(f\"total:{job_id}\", len(folder.contract_ids))",
    "    …",
    "        group(summarise_contract.s(job_id, c) for c in folder.contract_ids).apply_async()",
    "    return {\"job_id\": job_id}",
    "@api.get(\"/reviews/{job_id}\")",
    "def review_status(job_id: str):",
    "    total = r.get(f\"total:{job_id}\")",
    "    if total is None:",
    "        raise HTTPException(status_code=404, detail=\"no such job\")",
    "    return {\"done\": rows_done(job_id), \"total\": int(total)}"
  ];
  function webSide({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const lastPoll = BROWSER.polls[BROWSER.polls.length - 1];
    const Q = [
      { q: `Our script posts the ${N} contract ids to <code>/reviews</code>, as the page would. What comes back?`,
        opts: [`200 and the ${N} summaries`, `${BROWSER.postStatus} and a job id`, `${BROWSER.postStatus} and ${N} Celery task ids`],
        right: 1,
        fb: [
          [`The summaries do not exist yet when the route returns. It only creates the job and queues the tasks.`, false],
          [`Right. Our run got <code>${BROWSER.postStatus}</code> with one key, <code>${kit.esc(BROWSER.postKeys.join(", "))}</code>, after ${Math.round(BROWSER.postMs)} ms. <b>202 Accepted</b> is the HTTP status for "accepted for processing, but processing has not been completed". <code>group(...)</code> sends the ${N} tasks together, so workers can run them in parallel.`, true],
          [`The page would then have to track ${N} ids. One job id that the web app owns is simpler, and the app can look it up in its own record.`, false]
        ] },
      { q: "The paralegal mistypes the job id in a link. What does the status route answer?",
        opts: ["done: 0, because Celery says PENDING", `${BROWSER.unknownStatus} no such job`, "500, a server error"],
        right: 1,
        fb: [
          [`This route does not ask Celery. It looks for its own record <code>total:{job_id}</code>, written by <code>start_review</code>. Asking Celery would have given <code>PENDING</code> forever, as you just saw.`, false],
          [`Right. Our run: <code>${BROWSER.unknownStatus}</code> with <code>${kit.esc(BROWSER.unknownBody)}</code>. Because the app keeps its own job record, it can tell "not started" from "no such job".`, true],
          [`The route checks for the record first (line ${WEB_CODE.indexOf("    if total is None:") + 1}) and answers a clear 404, not a crash.`, false]
        ] },
      { q: `Now reason it out. The page polls every 2 s. After the third poll the paralegal closes her laptop, and opens it a minute later. What will the next poll say?`,
        opts: [`done: ${BROWSER.polls[2][1]}, where she left it`, `done: ${BROWSER.total}, total: ${BROWSER.total}`, "An error: the job was lost when the page closed"],
        right: 1,
        fb: [
          [`The worker never knew the page existed. It kept taking tasks from the queue while the laptop was shut.`, false],
          [`Right. Nothing in the worker depends on the browser. We did not close a laptop, but our polling script, asking every 2 s, read: ${BROWSER.polls.map(p => `${f1(p[0])} s → ${p[1]}`).join(", ")} of ${BROWSER.total}. With 4 worker processes the job was finished at about ${f1(lastPoll[0])} s, long before her minute was up.`, true],
          [`The job lives in Redis and in the worker, not in the page. Closing the page only stops the asking.`, false]
        ] }
    ];
    Q.after = () => kit.table(BROWSER.polls.map(p => [`${f1(p[0])} s`, `${p[1]} of ${BROWSER.total}`]), { head: ["poll at", "done"], title: "What our polling script saw" });
    chain(kit, el, Q, ans, done, () => `<h1>The web side: a job id and a status route</h1>
      <p class="lead">From our <code>web.py</code>, a FastAPI app. One route starts a review; the other says how far it is. <code>r</code> is the app's connection to Redis, and <code>rows_done</code> counts the summaries saved under the job id.</p>
      ${wcode(kit, WEB_CODE, -1)}
      <p class="lx-${ID}-cap">Cut at …: a switch to the one-big-task version you will see on the next screen. <code>group(...)</code> is the line that runs here.</p>
      <p class="task">Predict the first two results of our real run, then reason out the third.</p>`);
  }

  /* 6. Throughput: how many processes, and how big a task? (real runs) */
  // From web.py (the switch cut on screen 5) and review_tasks.py (summarise_folder), cut with …
  const BIG_CODE = [
    "    if ONE_BIG_TASK:",
    "        summarise_folder.delay(job_id, folder.contract_ids)",
    "…",
    "@app.task",
    "def summarise_folder(job_id, contract_ids):",
    "    # the \"one big task\" version: the whole folder in one task",
    "    for contract_id in contract_ids:",
    "        summary = call_model(contract_id)",
    "        r.hset(f\"sheet:{job_id}\", contract_id, summary)",
    "    return len(contract_ids)"
  ];
  function throughput({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const near = (v) => `about ${Math.round(v)} s`;
    const o1 = [RUNS.c1, RUNS.c4, RUNS.c1 / 16];
    const Q = [
      { q: `With <code>--concurrency=1</code> (one worker process) the ${N} contracts took ${f1(RUNS.c1)} s. With <code>--concurrency=4</code>?`,
        opts: o1.map(near), right: 1,
        fb: [
          [`Four processes each take tasks from the same queue, so four contracts are summarised at once. Our run: ${f1(RUNS.c4)} s.`, false],
          [`Right: ${f1(RUNS.c4)} s, close to ${f1(RUNS.c1)} ÷ 4. Each worker process takes the next task as soon as it is free. A model call mostly <i>waits</i> for the provider, so more processes help even on a small machine.`, true],
          [`That would be 16 at once. Four processes run four tasks at a time: our run took ${f1(RUNS.c4)} s.`, false]
        ] },
      { q: `Now 8 processes, but the route puts the whole folder into <b>one</b> task, <code>summarise_folder(job_id, contract_ids)</code>. How long?`,
        opts: [near(RUNS.c8), near(RUNS.bigC8), near(RUNS.c8 / 2)], right: 1,
        fb: [
          [`That is what 8 processes did with one task per contract: ${f1(RUNS.c8)} s. With one big task, only one process has work.`, false],
          [`Right: ${f1(RUNS.bigC8)} s, as slow as one process. Concurrency shares <i>tasks</i> between processes; it cannot split the work inside one task. One big task also means no retry of a single contract: a failure at contract 39 runs the whole folder again.`, true],
          [`Seven of the eight processes had nothing to do. Our run took ${f1(RUNS.bigC8)} s.`, false]
        ] },
      { q: "The provider's rate limit lets your key make about 5 calls at the same time without errors. How many worker processes do you run for this task?",
        opts: ["1, to be safe", "About 5", `${N}, one per contract`],
        right: 1,
        fb: [
          [`Safe, but every folder takes as long as the inline version did. Nothing stops you using what the provider allows.`, false],
          [`Right. The provider, not your machine, sets the ceiling. Up to that point more processes finish sooner; past it, the extra calls get rate-limit errors and back off, as in the last lesson.`, true],
          [`Then ${N - 5} calls at a time come back as rate-limit errors, and every one of them retries with backoff. The run gets slower, not faster.`, false]
        ] }
    ];
    Q.after = () => `${kit.meter([
      { label: "1 process", value: Math.round(RUNS.c1), max: Math.ceil(RUNS.c1) },
      { label: "4 processes", value: Math.round(RUNS.c4), max: Math.ceil(RUNS.c1), good: true },
      { label: "8 processes", value: Math.round(RUNS.c8), max: Math.ceil(RUNS.c1), good: true },
      { label: "8, one big task", value: Math.round(RUNS.bigC8), max: Math.ceil(RUNS.c1) }
    ])}<p class="lx-${ID}-cap">Seconds until all ${N} summaries were saved, in our runs. Celery's own default is one process per CPU; its docs say the best number depends on your work, so measure.</p>`;
    chain(kit, el, Q, ans, done, () => `<h1>How fast does the folder finish?</h1>
      <p class="lead">Start a worker with <code>celery -A review_tasks worker --concurrency=4</code> and it runs 4 tasks at a time, in 4 processes. We ran the same ${N}-contract job with different settings. Each task replays a recorded summary and waits as long as the real call took.</p>
      <p class="lead">For the second question, the web app was switched to put the whole folder into one task:</p>
      ${wcode(kit, BIG_CODE, -1)}
      <p class="task">Predict each real result.</p>`);
  }

  /* 7. Broken on purpose: the progress says 41 of 40. */
  // From docs/ai-path/runs/s6-queues-background-jobs/v1/review_tasks.py, the first version of the task
  const V1_CODE = [
    "@app.task(autoretry_for=(UploadTimeout,), retry_backoff=True, max_retries=3)",
    "def summarise_contract(job_id, contract_id):",
    "    summary = call_model(contract_id)",
    "    r.rpush(f\"sheet:{job_id}\", f\"{contract_id}: {summary[:40]}\")",
    "    upload_to_document_store(job_id, contract_id, summary)",
    "    return contract_id"
  ];
  // From review_tasks.py, the fixed version (its decorator line is the same as above and is not repeated)
  const FIX_CODE = [
    "def summarise_contract(job_id, contract_id):",
    "    key = f\"sheet:{job_id}\"",
    "    summary = r.hget(key, contract_id)",
    "    if summary is None:",
    "        summary = call_model(contract_id)",
    "        r.hset(key, contract_id, summary)",
    "    upload_to_document_store(job_id, contract_id, summary)",
    "    return contract_id"
  ];
  function broken({ el, done, kit }) {
    ensureStyle();
    let cause = null, fix = null;
    const causes = [
      `The model answered twice for contract ${DUP}`,
      `The retry ran the whole task again from the top. The row had already been added before the upload failed, so it was added a second time`,
      "Celery delivered the task twice by mistake",
      "The status route counts wrong"
    ];
    const causeFb = [
      [`The model answered once per call. Look at the log: there were two <i>calls</i> (log lines 2 and 5), each with one answer.`, false],
      [`Right. The upload failed after <code>call_model</code> and <code>rpush</code> had already run. <code>autoretry_for</code> put the task back on the queue (line 3 of the log), and the retry started again at the top: a second model call, a second row. A retry is one way a task runs twice. Celery's docs name another: with late acknowledgement (the worker tells the broker a task is done only after it ends), a task "may be executed multiple times should the worker crash in the middle of execution".`, true],
      [`It is one task id from start to end, and line 3 of the log says why it ran again: <code>retry</code>, on purpose, because of <code>autoretry_for</code>. Celery did what the decorator asked.`, false],
      [`The sheet really holds ${BROKEN.rows.length} rows: contract ${DUP} appears twice. The route counted what was there.`, false]
    ];
    const fixes = [
      "Remove autoretry_for, so a task never runs twice",
      "Save the summary under the contract id, and skip the model call when it is already saved",
      "Move the upload above the rpush line"
    ];
    const fixFb = [
      [`Then one hiccup in the document store loses contract ${DUP}'s upload for good. And with late acknowledgement (<code>acks_late</code>), a worker that crashes mid-task can still run it twice. Make the task safe to repeat instead.`, false],
      [`Right. Now the task is <b>idempotent</b>: running it twice leaves the same result as running it once. Our run with this version, the same failure on contract ${DUP}:`, true],
      [`It hides this case, but a retry still calls the model a second time, and with late acknowledgement (<code>acks_late</code>) the sheet still gets two rows if the worker dies after the rpush. Make the write safe to repeat instead of hoping it runs once.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The progress says ${LAST_BROKEN[1]} of ${BROKEN.total}</h1>
        <p class="lead">This was the firm's first version of the task. During one run the document store timed out once, on contract ${DUP} (our script made it fail once on purpose). Our polling script read, and at ${f1(FULL_POLL[0])} s the job looked finished:</p>
        <p class="lx-${ID}-mono">${BROKEN.polls.map(p => `${f1(p[0])} s → ${p[1]}`).join(",  ")}  (of ${BROKEN.total})</p>
        <p class="lead">The review sheet held ${BROKEN.rows.length} rows, and <code>call_model</code> ran ${BROKEN.modelCalls} times for ${BROKEN.total} contracts (each run replays a recorded answer; with a real model, each is a paid call).</p>
        ${wcode(kit, V1_CODE, cause === 1 ? 2 : -1)}
        <p class="lx-${ID}-cap">The worker log, every line about contract ${DUP} (date removed; task id cut with …):</p>
        ${logBox(kit, LOG_BROKEN, cause === 1 ? [1, 2, 4] : [])}
        <p class="task">Find the cause, then pick the fix.</p>
        <div class="lpanel"><div class="lcase" id="q0"><p>Why is there a ${LAST_BROKEN[1]}st row?</p>${ask(kit, causes.map(kit.esc), 1, cause, causeFb)}</div>
        ${cause === 1 ? `<div class="lcase" id="q1"><p>Which fix?</p>${ask(kit, fixes.map(kit.esc), 1, fix, fixFb)}
          ${fix === 1 ? `${wcode(kit, FIX_CODE, -1)}${logBox(kit, LOG_FIXED)}
            ${kit.feedback(`The retry finished in about a millisecond: it found the summary and skipped the model. The run ended at ${FIXED.done} of ${FIXED.total}, with ${FIXED.modelCalls} model calls. <code>hset</code> under the contract id is an <b>upsert</b>: writing the same key twice leaves one row. The upload should be safe to repeat too, for example by writing to a fixed file name per contract.`)}` : ""}</div>` : ""}</div>`;
      el.querySelectorAll("#q0 .lopts button").forEach(b => b.onclick = () => { cause = +b.dataset.i; if (cause !== 1) fix = null; paint(); });
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (cause === 1 && fix === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task: match each job to the right tool. */
  const TOOLS = ["Call it inline", "Stream the answer", "Task queue", "Provider batch API"];
  const JOBS = [
    { t: "Check that an uploaded file is a PDF under 20 MB before accepting it.", right: 0,
      no: { 1: "There is nothing to stream: the check is over in a moment.", 2: "A queue adds a broker, a worker and polling to a check that ends in milliseconds.", 3: "A batch can take hours. The paralegal is waiting for this one now." } },
    { t: "A lawyer asks one question about one clause and reads the answer as it is written.", right: 1,
      no: { 0: "It works, but she stares at an empty box until the whole answer is done. Streaming shows the first words almost at once.", 2: "She would wait just as long, plus the polling. A queue helps when nobody should have to wait.", 3: "A batch can take hours. She is reading now." } },
    { t: `A paralegal uploads ${N} contracts and wants the summaries within a few minutes, with progress.`, right: 2,
      no: { 0: "That is the page that died at 30 s.", 1: "Many answers, a few minutes, and a closed laptop must not lose them: that is past what one open request should hold.", 3: "Batch APIs give themselves up to 24 hours. A few minutes with progress is a queue's job." } },
    { t: "Every Sunday night, re-check the whole archive of past contracts against a new clause rule. Results are needed by Monday.", right: 3,
      no: { 0: "Thousands of calls in one request will die like the first page.", 1: "No one is watching it happen.", 2: "A queue would work. But nobody waits, so the provider can queue it for you at a lower price, with no workers of your own." } }
  ];
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const ans = JOBS.map(() => null);
    const paint = () => {
      const all = JOBS.every((j, i) => ans[i] === j.right);
      el.innerHTML = `<h1>When to reach for a queue</h1>
        <p class="lead"><b>What it is for:</b> work that outlasts a web request: bulk jobs, slow model calls, anything that must survive a closed tab or a deploy, and be retried on its own.</p>
        <p class="lead"><b>When not:</b> a quick call (just make it), or one answer someone is watching (stream it). For overnight bulk nobody waits on, provider batch APIs do the queuing for you, cheaper: half price at OpenAI and Anthropic on 2026-11-13, with up to 24 hours to finish. FastAPI's <code>BackgroundTasks</code> runs work after the response, inside the web app's own process. It is fine for a small job such as an email. But it has no retries or progress, and it goes down with that process. FastAPI's docs point to Celery for heavy work.</p>
        <p class="lead"><b>What it costs:</b> a broker to run, workers to deploy and watch, a job record and status route, and tasks that must be safe to run twice.</p>
        <p class="task">Pick the right tool for each job.</p>
        ${JOBS.map((j, i) => `<div class="lcase lx-${ID}-tools" id="c${i}"><p>${kit.esc(j.t)}</p>${kit.options(TOOLS, { picked: ans[i], correct: j.right })}${ans[i] == null || ans[i] === j.right ? "" : kit.feedback(kit.esc(j.no[ans[i]]), false)}</div>`).join("")}
        ${all ? kit.feedback("Each tool fits one kind of wait: none, a short one someone watches, a longer one with progress, and one nobody watches.", true) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (JOBS.every((j, k) => ans[k] === j.right)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A podcast app turns each uploaded hour-long episode into a transcript and show notes. One episode takes several minutes.", true,
      "Yes. Minutes of work per upload: answer with a job id, let a worker do it, show progress. A retry should not transcribe the same episode twice, so save results under the episode id.",
      "Several minutes is far past any request limit, and the user should be free to close the app. That is a background job with a job id."],
    ["A support widget answers one customer question. The answer takes about three seconds and the customer is watching the box.", false,
      "Right, no. A queue adds a hop, a job id and polling, and the customer still waits for the same answer; it can only arrive later. Stream it, with the timeout and retry rules from the last lesson.",
      "The customer waits either way. A queue cannot make the answer come sooner; it adds a broker hop and a polling delay. One watched answer is streaming's job."],
    ["After a change of embedding model, a team must re-embed 200,000 help-centre articles. A worker restart halfway must not start from the beginning.", true,
      "Yes. One task per small batch of articles, results saved under the article id, and a task skips articles already done. A restart then only redoes the unfinished tasks.",
      "This is the contract folder at a larger size: many independent items, too long for any request, and a restart must not redo finished work. Small tasks plus keyed writes give exactly that."],
    ["An editor suggests the next few words while the user types. Each suggestion takes about 300 ms.", false,
      "Right, no. The suggestion is useless once the user types the next letter. A job id and a poll would bring it back too late. Call the model inline and drop answers that arrive after a newer keystroke.",
      "By the time a worker picked the task up and the page polled for it, the user would have typed on and the suggestion would be stale. Short, throwaway answers belong inline."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A queue here?</h1>
        <p class="lead">${WORDS[CASES.length][0].toUpperCase() + WORDS[CASES.length].slice(1)} jobs, away from the law firm.</p>
        <p class="task">For each one, decide if it should run as background jobs on a queue. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
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
    el.innerHTML = `<h1>You can move slow AI work off the request</h1>
      <p class="lead">You found where the inline request died, redrew it as browser, web app, queue and worker, and saw a real Celery run: a job id back in ${Math.round(BROWSER.postMs)} ms, <code>PENDING</code> for any unknown id, ${f1(RUNS.c1)} s with one process against ${f1(RUNS.c4)} s with four, and a retry that wrote a second row until the task was made safe to repeat.</p>
      <p class="lead">Practice for this lesson is the lesson itself; there is nothing more to run.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here you looked at one total time per job; next you will look at many requests and see what a single average hides.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Queues and background jobs for long AI work",
    checked: "2026-11-13",
    sources: [
      "https://docs.celeryq.dev/en/stable/getting-started/first-steps-with-celery.html",
      "https://docs.celeryq.dev/en/stable/userguide/tasks.html",
      "https://docs.celeryq.dev/en/stable/userguide/workers.html",
      "https://docs.celeryq.dev/en/stable/userguide/canvas.html",
      "https://devcenter.heroku.com/articles/request-timeout",
      "https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout",
      "https://fastapi.tiangolo.com/tutorial/background-tasks/",
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/202",
      "https://developers.openai.com/api/docs/guides/batch",
      "https://platform.claude.com/docs/en/build-with-claude/batch-processing"
    ],
    interview: [{
      q: "Users upload a batch of 500 documents to summarise, and your endpoint times out. Walk me through the redesign.",
      good: [
        "The upload route creates a job record and answers 202 with a job id at once",
        "One task per document (or a small batch) on a queue such as Celery with Redis, so workers share the work and a failure retries one document",
        "A status route reads my own job record and counts finished results; the page polls it, so a closed tab loses nothing",
        "Worker concurrency sized to the provider's rate limit, with retries and backoff for passing errors",
        "Results saved under the document id so a repeated task does no harm"
      ],
      weak: "Raise the timeout or make the handler async. The work still lives inside one request: it dies with the tab or a deploy, and a reload starts it again."
    }, {
      q: "Your summarisation task sometimes writes the same result twice and you pay for the model call twice. Why, and how do you fix it?",
      good: [
        "A task can run more than once: an automatic retry starts it again from the top, and so does a worker that dies mid-task when late acknowledgement (acks_late) is on",
        "Anything done before the failure point, a model call or an appended row, is done again",
        "Make the task idempotent: write results under a key (upsert), and skip the model call when the result is already there",
        "Keep side effects such as uploads safe to repeat too, or split them into their own task"
      ],
      weak: "Turn off retries. Then one passing error loses the work, and with late acknowledgement a crashed worker can still run the task twice."
    }],
    screens: [inlineRun, spotIdea, redraw, celeryTask, webSide, throughput, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#l0 [data-wrong]"], right: STEPS.map((_, i) => `#l${i} [data-right]`) },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: JOBS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
