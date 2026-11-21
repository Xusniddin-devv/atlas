/* Lesson s6-managed-ml-platforms: Managed ML platforms versus self-hosting.
   Story: Kestrel Freight (made up), a logistics company. Its CTO asks which cloud AI service to standardise on
   before three teams each pick a different one. Six team situations are sorted into "managed platform" or "own
   containers", then one choice is defended.
   Ideas: (1) a managed ML platform sells operations, not a better model: it creates, patches, scales and replaces
   the machines, while the model, the container, the health check, the quota and the machine choice stay yours;
   (2) when not: a team that already runs a cluster with steady load, data that must stay in your own building, work
   that needs the machine itself, no model of your own (a hosted model API), no network (on the device).
   Depth: explain (screens 1, 2, 3, 4, 5, 7, interview), when-not (screens 1, 3, 6, 7, 8).
   Data:
   - docs/ai-path/runs/s6-managed-ml-platforms/run.sh -> run.out.txt, run on this Mac with Docker on 2026-11-14
     (env.txt): the same image started the way SageMaker's docs say an inference container is started
     ("docker run <image> serve"), first unchanged (before/), then with a thin adapter (after/). SageMaker itself,
     Azure Machine Learning and Google's platform were not run by us: those screens are written from the official
     documentation listed in `sources` and say so.
   - No model API was called for this lesson. The team situations are written for the lesson, not recorded output.
   Every count on screen is computed here from the constants below.
   Lesson-local style (<style id="lx-s6-managed-ml-platforms">): sorting cards, log and file blocks, the doc note.
   Plain browser script. */
(() => {
  const ID = "s6-managed-ml-platforms", P = "lx-" + ID + "-";
  const CHECKED = "2026-11-14";
  const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = n => WORDS[n] || String(n);
  const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- Official pages the "not run by us" screens are written from ---------- */
  const DOC = {
    smContract: "https://docs.aws.amazon.com/sagemaker/latest/dg/your-algorithms-inference-code.html",
    smServerless: "https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html",
    smZero: "https://docs.aws.amazon.com/sagemaker/latest/dg/endpoint-auto-scaling-zero-instances.html",
    azEndpoints: "https://learn.microsoft.com/en-us/azure/machine-learning/concept-endpoints-online?view=azureml-api-2",
    gcContainer: "https://docs.cloud.google.com/vertex-ai/docs/predictions/custom-container-requirements",
    gcNotes: "https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes"
  };

  /* ---------- Real run (docs/ai-path/runs/s6-managed-ml-platforms/, copied unaltered) ---------- */
  const RUN = {
    date: "2026-11-14",
    // before/Dockerfile, last line; before/main.py has the one route POST /classify
    beforeCmd: 'CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]',
    // run.out.txt, first block
    beforeOut: `$ docker run --rm s6mmp-before serve
docker: Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: exec: "serve": executable file not found in $PATH: unknown
…
(exit code 127)`,
    // after/adapter.py and after/serve, whole files
    adapter: `from fastapi import Response
from main import app, classify, Photo


@app.get("/ping")
def ping():
    return Response(status_code=200)


@app.post("/invocations")
def invocations(photo: Photo):
    return classify(photo)`,
    serve: `#!/bin/sh
exec uvicorn adapter:app --host 0.0.0.0 --port 8080`,
    // run.out.txt, second block
    afterOut: `$ docker run -d --rm -p 8080:8080 --name s6mmp s6mmp-after serve
$ curl -s -o /dev/null -w "%{http_code}\\n" localhost:8080/ping
200
$ curl -s -X POST localhost:8080/invocations -H "Content-Type: application/json" -d '{"caption": "box crushed at one corner"}'
{"damaged":true}
$ curl -s -X POST localhost:8080/classify -H "Content-Type: application/json" -d '{"caption": "box crushed at one corner"}'
{"damaged":true}`
  };
  const EXIT_CODE = +RUN.beforeOut.match(/exit code (\d+)/)[1];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P.slice(0, -1))) return;
    const s = document.createElement("style");
    s.id = P.slice(0, -1);
    s.textContent = `
      .${P}card .lopts button { padding: 10px 14px; font-size: 16px; }
      .${P}card .lopts button[aria-pressed="true"]:not(.right):not(.wrong) { border-color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
      .${P}tally { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 14px 0 0; font-size: 15px; color: var(--ink-2); }
      .${P}tally b { font-family: var(--mono); color: var(--ink); }
      .${P}check { margin-top: 16px; min-height: 48px; }
      .${P}log { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 8px; font: 500 12.5px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}file { margin: 10px 0 0; font-size: 13px; color: var(--muted); }
      .${P}file + .${P}log { margin-top: 4px; }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}note { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 14.5px; line-height: 1.5; color: var(--ink-2); }
      .${P}link { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); }
      .${P}list { margin: 10px 0 0; padding-left: 20px; font-size: 15.5px; line-height: 1.5; }
      .${P}list li { margin: 4px 0; }
      .${P}done { margin: 16px 0 6px; font-size: 15.5px; line-height: 1.45; color: var(--ink); }
    `;
    document.head.appendChild(s);
  }
  const log = (kit, text) => `<div class="${P}log">${kit.esc(text)}</div>`;
  const file = (kit, name, text) => `<p class="${P}file">${kit.esc(name)}</p>${log(kit, text)}`;
  const notRun = (what, url) => `<p class="lead"><b>Not run by us.</b> ${what} Written from the official documentation, checked ${CHECKED}.<br><a class="${P}link" href="${url}" target="_blank" rel="noopener">Open the documentation</a></p>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  /* One question, done when the right option is picked. */
  function oneQ(el, done, kit, { head, opts, right, fb }) {
    let ans = null;
    const paint = () => {
      el.innerHTML = `${head()}<div class="lpanel">${ask(kit, opts, right, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }
  /* Several "pick one" blocks, done when every block is right. items: [{ q, right, fb: [[html, ok]] }] */
  function multiPick(el, done, kit, { head, items, opts, foot }) {
    const ans = items.map(() => null);
    const paint = () => {
      const all = items.every((it, j) => ans[j] === it.right);
      el.innerHTML = `${head()}
        ${items.map((it, i) => `<div class="lcase" id="c${i}"><p>${it.q}</p>${ask(kit, opts, it.right, ans[i], it.fb)}</div>`).join("")}
        ${all && foot ? `<div class="lpanel">${kit.feedback(foot(), true)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (items.every((it, j) => ans[j] === it.right)) done();
      }));
    };
    paint();
  }
  /* Questions asked one after the other; each right answer reveals its `after` text. */
  function sequence(el, done, kit, { head, qs }) {
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k >= qs.length, q = qs[Math.min(k, qs.length - 1)];
      el.innerHTML = `${head()}
        ${qs.slice(0, k).map(x => `<p class="${P}done"><b>${x.q}</b></p>${kit.feedback(x.after(), true)}`).join("")}
        ${fin ? "" : `<p class="task">${q.q}</p>${q.extra ? q.extra() : ""}<div class="lpanel">${kit.options(q.opts, { picked: wrong, correct: q.right })}${wrong != null ? kit.feedback(q.fb[wrong], false) : ""}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== qs[k].right) { wrong = i; paint(); return; }
        wrong = null; k++; paint();
        if (k >= qs.length) done();
      });
    };
    paint();
  }

  /* 1. The situation, and the by-hand sort of six team situations, checked against the key afterwards. */
  const PILES = ["Managed platform", "Own containers"];
  const MANAGED = 0, OWN = 1;
  const CARDS = [
    { who: "Parcel damage photos", text: "The damage team fine-tuned an open vision model that flags crushed and wet boxes in depot photos. Two data scientists. Nobody on the team runs servers, and nobody is on call at night.", right: MANAGED,
      fb: ["Right. The model is theirs; the machines do not have to be. The platform creates, patches and replaces the machines, so two data scientists can ship without learning to run a cluster.",
           "Who patches the machines, replaces a dead one at 3 a.m. and sets up scaling? Self-hosting does not remove that work, and this team has nobody to do it."] },
    { who: "Arrival times", text: "The routing team's arrival-time model answers every driver's app, with steady traffic around the clock. Kestrel's platform team already runs a Kubernetes cluster for the warehouse system, with people on call.", right: OWN,
      fb: ["It would work, but it buys what Kestrel already has: people and tools that run a cluster. The company would then have two ways to deploy, watch and pay for services.",
           "Right. The hard part of running your own containers is the people who run the cluster, and they already exist. One more service on a cluster they run adds little new work."] },
    { who: "Customs documents", text: "The customs team classifies shipping documents. Quiet at night, then thousands at once when a ship docks. Three developers, no operations staff.", right: MANAGED,
      fb: ["Right. Scaling between a minimum and a maximum is built into the platform: the team sets the limits, the platform adds and removes machines.",
           "Scaling with bursts on your own means an autoscaler, metrics to drive it and someone who fixes it when it misbehaves. That is the work this team has no one for."] },
    { who: "Weekly retraining", text: "The demand forecast is retrained every Sunday for a few hours on GPU machines. No training runs the rest of the week. The team has no cluster.", right: MANAGED,
      fb: ["Right. A managed training job starts machines, runs the training container and deletes the machines when the job ends, so the team pays for the hours it uses.",
           "Their own GPU machines would sit idle six days a week, or someone would write scripts to create and delete them. A managed training job already does exactly that."] },
    { who: "Passport scans", text: "A customs partner requires that scanned passports from one country never leave Kestrel's own data centre in that country.", right: OWN,
      fb: ["A managed platform runs in its provider's data centres. Picking a region (as in the last lesson) does not help when the data must stay in your own building.",
           "Right. If the data may not leave your building, the model runs on machines in that building. Some platforms can send work to a cluster you run there (Azure Machine Learning calls these Kubernetes online endpoints), but then running the machines is your job again."] },
    { who: "GPU profiling", text: "The research team tunes how much GPU memory its model uses. It needs to log in to the serving machine and run profiling tools on it.", right: OWN,
      fb: ["A managed endpoint hides the machine. Azure Machine Learning's documentation says you cannot get direct access to the machine where a model is deployed; you get its logs instead.",
           "Right. Work that needs the machine itself needs a machine you control. A managed endpoint gives you logs and metrics, not a shell on the machine."] }
  ];
  const N_MAN = CARDS.filter(c => c.right === MANAGED).length, N_OWN = CARDS.length - N_MAN;
  function sortCards({ el, done, kit }) {
    ensureStyle();
    const picks = CARDS.map(() => null);
    let checked = false, passed = false, nOk = 0;
    const paint = () => {
      const left = picks.filter(p => p == null).length;
      const count = p => picks.filter(x => x === p).length;
      el.innerHTML = `<h1>One cloud AI service for everyone?</h1>
        <p class="lead">Kestrel Freight (a made-up logistics company) has several teams with models to train and serve. A trained model has to run on some machine to answer requests, and someone has to look after that machine. Three teams are about to pick three different cloud services for this. The CTO asks you which one every team should use. First, look at what the teams actually need. For each one there are two ways to run it: on a <b>managed platform</b> (a cloud service that runs your model on its machines) or in <b>your own containers</b> on machines or a cluster your company runs.</p>
        <p class="task">Put each team in the pile that fits it. Then check your piles against the key.</p>
        ${CARDS.map((c, i) => {
          const p = picks[i], ok = p === c.right;
          return `<div class="lcase ${P}card" id="c${i}"><p><b>${i + 1}. ${kit.esc(c.who)}.</b> ${kit.esc(c.text)}</p>
            <div class="lopts">${PILES.map((t, j) => `<button type="button" data-i="${j}"${j === c.right ? " data-right" : " data-wrong"} aria-pressed="${p === j}" class="${checked && p === j ? (ok ? "right" : "wrong") : ""}">${t}</button>`).join("")}</div>
            ${checked && p != null ? kit.feedback(c.fb[p], ok) : ""}</div>`;
        }).join("")}
        <div class="${P}tally">${PILES.map((t, j) => `<span>${t} <b>${count(j)}</b></span>`).join("")}<span>not sorted <b>${left}</b></span></div>
        <div class="lpanel">
          ${passed ? "" : `<button type="button" class="btn ${P}check" id="check" ${left ? "disabled" : ""}>${left ? `Sort all ${word(CARDS.length)} first (${left} left)` : checked ? "Check again" : "Check against the key"}</button>`}
          ${checked ? (passed
            ? kit.feedback(`All ${word(CARDS.length)} in the right pile: ${word(N_MAN)} managed, ${word(N_OWN)} on Kestrel's own containers. So any one choice for every team would be wrong for at least ${word(Math.min(N_MAN, N_OWN))} of them. The next screen asks what the managed teams were really buying.`, true)
            : kit.feedback(`${nOk} of ${CARDS.length} in the right pile at the last check. Each card says why. Move the ones marked as mistakes, then check again.`, false)) : ""}
        </div>`;
      el.querySelectorAll(`.${P}card`).forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (passed) return;
        picks[i] = +b.dataset.i; paint();
      }));
      const ch = el.querySelector("#check");
      if (ch) ch.onclick = () => {
        checked = true; nOk = CARDS.filter((c, j) => picks[j] === c.right).length;
        passed = nOk === CARDS.length; paint(); if (passed) done();
      };
    };
    paint();
  }

  /* 2. Spot the idea: what a managed platform sells. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    const man = CARDS.filter(c => c.right === MANAGED).map(c => c.who.toLowerCase());
    oneQ(el, done, kit, {
      head: () => `<h1>What were they buying?</h1>
        <p class="lead">The ${word(N_MAN)} managed teams (${man.join(", ")}) have different models and different traffic. The damage team's model is the same weights in the same container whichever pile it lands in.</p>
        <p class="task">What does a managed platform give these teams that their own containers would not?</p>`,
      opts: [
        "A faster, more accurate model, because the platform's serving stack is tuned for its own hardware",
        "Someone else runs the machines: creates, patches, scales and replaces them. The model stays theirs.",
        "Cheaper machines, because a big platform buys hardware in bulk and passes the saving on",
        "Freedom to move to another cloud later, since the same container runs on any platform as it is"
      ],
      right: 1,
      fb: [
        ["The model is the same file either way, and it runs in the same kind of container. The platform does not change what the model predicts or how fast it computes.", false],
        [`Right. A <b>managed ML platform</b> sells <b>operations</b>: the work of running machines. The three big ones are Amazon SageMaker AI, Azure Machine Learning, and Google's platform long called Vertex AI, which Google's release notes say became part of Gemini Enterprise Agent Platform on 2026-04-22. Names change; the shape does not. You bring the model, often in your own container; it runs training jobs and serving <b>endpoints</b> (a web address that answers requests with the model) on its machines. <b>Self-hosting</b> means the same containers on machines or a Kubernetes cluster that your company runs, so your people do that work.`, true],
        ["Not as a rule. Azure Machine Learning's documentation says its managed online endpoints add no surcharge: you pay for the machines and the network. Other platforms price their machines differently, so compare the two price pages yourself. Either way, the saving is people's time, not the price of a machine.", false],
        ["The opposite. Each platform has its own way to start a container, its own routes and its own tools. Moving later means adapting to the next one. A later screen shows how much.", false]
      ]
    });
  }

  /* 3. Defend one: the arrival-time model stays on the company's cluster. */
  function defend({ el, done, kit }) {
    ensureStyle();
    oneQ(el, done, kit, {
      head: () => `<h1>Defend one choice</h1>
        <p class="lead">The CTO pushes back on card 2: “A managed platform is easier. Why not move the arrival-time model there too, so everyone uses one thing?”</p>
        <p class="task">Pick the strongest answer.</p>`,
      opts: [
        "Kubernetes is newer and more flexible than any managed platform, so the model is better off there",
        "The platform team already does the machine work here. Moving adds a second way to deploy and pay, and removes no work.",
        "Managed platforms cannot handle steady traffic around the clock; they are built for bursts",
        "Running our own containers costs nothing extra, so moving could only add a new bill"
      ],
      right: 1,
      fb: [
        ["“Newer” is not a reason anyone can check, and the CTO will not accept it. Argue from the work: who does it today, and what would change.", false],
        ["Right. Ask what you would stop doing. For the damage team the answer is “all the machine work”. For the routing team it is “nothing”, because the cluster and the people stay for the warehouse system anyway. You would pay for operations twice.", true],
        ["They can. Serving endpoints scale between a minimum and a maximum number of machines and serve steady traffic. The reason to stay is elsewhere.", false],
        ["The cluster's machines cost money, and so do the people who run it. The point is that Kestrel already pays both, for the warehouse system, whatever the route model does.", false]
      ]
    });
  }

  /* 4. What you hand over and what you keep. */
  const JOBS = [
    { q: "Create the machines, and remove them when they are no longer needed", right: 0,
      fb: ["Right. Azure Machine Learning's comparison lists node provisioning as “managed” on its managed endpoints and “user responsibility” on a cluster you run.", "This is the first job a platform takes. On your own cluster, someone creates and removes the machines."] },
    { q: "Install security updates on the machines' operating system", right: 0,
      fb: ["Right. The host operating system is the platform's: it updates and hardens it.", "The machine underneath is not yours on a managed endpoint. The platform updates its operating system."] },
    { q: "Replace a machine that has failed", right: 0,
      fb: ["Right. The platform replaces failed machines, as long as it can tell they have failed. See the health check below.", "The platform replaces failed machines. That is a large part of what you pay it for."] },
    { q: "Choose the machine type, and the smallest and largest number of machines", right: 1,
      fb: ["The platform cannot guess how big your model is or how much traffic you expect. Azure's documentation puts it plainly: you specify the machine type and the scale settings.", "Right. The platform scales within the limits you set; picking the machine and the limits is your decision."] },
    { q: "Keep your own container image up to date with security fixes", right: 1,
      fb: ["The platform patches its own base images. Azure's documentation says that if you provide your own image, you are responsible for updating it.", "Right. What is inside your container is yours, on any platform."] },
    { q: "Make the health check (the platform's “are you OK?” request) tell the truth: fail when the model is not loaded", right: 1,
      fb: ["The platform calls your health check, but your code answers it. SageMaker's documentation warns that if it always returns 200, requests keep going to a broken machine until someone replaces it by hand.", "Right. SageMaker, for example, replaces a machine when your health check reports a failure (on most endpoint types; screen 6 shows one exception). A check that always says “fine” turns that off."] },
    { q: "Get enough quota for the GPU machines you want", right: 1,
      fb: ["Quota is a limit on your account, as in the last lesson. The platform enforces it; you request more. Azure even reserves extra quota on some machine types for its own upgrades.", "Right. Quota limits apply to managed endpoints too. Azure Machine Learning reserves extra quota on some machine types for upgrades, so you need more than the count you deploy."] }
  ];
  function handOver({ el, done, kit }) {
    ensureStyle();
    const nPlat = JOBS.filter(j => j.right === 0).length;
    multiPick(el, done, kit, {
      opts: ["The platform does it", "Still your job"],
      items: JOBS.map(j => ({ q: j.q, right: j.right, fb: j.fb.map((t, k) => [t, k === j.right]) })),
      head: () => `<h1>What you hand over, what you keep</h1>
        <p class="lead">The damage team moves its model to a managed serving endpoint. Here are ${word(JOBS.length)} jobs that someone did when the model ran on a test machine under a desk.</p>
        <p class="task">For each job: does the platform do it now, or is it still the team's?</p>`,
      foot: () => `The platform took ${word(nPlat)} of the ${word(JOBS.length)} jobs: the ones about the machines. The ${word(JOBS.length - nPlat)} that stay are about your model and your account. “Managed” moves the machine work, not all the work.`
    });
  }

  /* 5. Bring your own container: what the platform expects, and a real run of the difference. */
  function container({ el, done, kit }) {
    ensureStyle();
    sequence(el, done, kit, {
      head: () => `<h1>Bring your own container</h1>
        <p class="lead">The damage team's image works on any machine with Docker. A managed platform starts it in its own way. SageMaker's documentation says it starts a serving container as <code>docker run &lt;image&gt; serve</code>, and that the container must listen on port 8080 and answer requests on <code>/invocations</code> and health checks on <code>/ping</code>.</p>
        ${notRun("The SageMaker part.", DOC.smContract)}
        <p class="lead">We built a small test image like the team's and started it the same way, with Docker on our Mac (${RUN.date}). It has one route, <code>POST /classify</code>, and its Dockerfile ends with:</p>
        ${log(kit, RUN.beforeCmd)}`,
      qs: [
        { q: "What happens when the image is started as <code>docker run &lt;image&gt; serve</code>?",
          opts: ["It starts uvicorn on port 8000, so the platform cannot reach it on 8080 and calls it unhealthy", "serve replaces the CMD line; there is no program called serve, so nothing starts", "It starts and works: Docker hands serve to uvicorn as an extra word, which uvicorn ignores"], right: 1,
          fb: ["It never gets as far as port 8000. Docker's documentation says arguments after the image name override the CMD default, so uvicorn is never started.", null, "Docker does not hand it to uvicorn. Arguments after the image name replace the CMD default, so uvicorn is never started."],
          after: () => `Right. Our run:${log(kit, RUN.beforeOut)}<p class="${P}cap">Output of run.sh on our Mac, ${RUN.date}, trimmed with …</p>No program called serve, exit code ${EXIT_CODE}. On a platform this shows up as an endpoint that never becomes healthy.` },
        { q: "What is the smallest change that makes the image fit?",
          opts: ["Rewrite the model code in the platform's own framework, so the platform knows how to load it", "Add a thin adapter: a serve script on port 8080, with /ping and an /invocations route that calls the same classify", "Give up on the team's image and use one of the platform's built-in algorithms instead"], right: 1,
          fb: ["The model code is fine. Only the way the container is started and addressed is different.", null, "A built-in algorithm is not the team's fine-tuned model. The model can stay; the entry point changes."],
          after: () => `Right. Two small files and three Dockerfile changes: copy them in, make serve executable (<code>RUN chmod +x serve</code>), and add <code>ENV PATH="/app:\${PATH}"</code> so Docker finds serve. The CMD line goes.
            ${file(kit, "after/adapter.py", RUN.adapter)}
            ${file(kit, "after/serve", RUN.serve)}
            ${log(kit, RUN.afterOut)}<p class="${P}cap">Output of run.sh on our Mac, ${RUN.date}.</p>
            The model code did not change, and the old route still answers. Note the price: this /ping always says 200, which the previous screen warned about. The next platform wants a different shape again. Google's documentation (checked ${CHECKED}) says its container reads its port and its health and prediction routes from environment variables. On its default prediction route, requests arrive as <code>{"instances": [...]}</code> and answers leave as <code>{"predictions": [...]}</code>. So a container is portable, with one thin adapter per platform.` }
      ]
    });
  }

  /* 6. What it costs at 3 a.m.: predictions about idle machines, scale to zero and serverless. */
  function nightCost({ el, done, kit }) {
    ensureStyle();
    sequence(el, done, kit, {
      head: () => `<h1>What it costs at 3 a.m.</h1>
        <p class="lead">Depot photos arrive from 6 a.m. to 10 p.m. At night, nothing. The damage model needs a GPU. Its endpoint runs on dedicated GPU machines, at least one.</p>
        ${notRun("We deployed nothing and saw no bill for this screen.", DOC.azEndpoints)}`,
      qs: [
        { q: "What does the team pay for at 3 a.m., with no photos coming in?",
          opts: ["Nothing: a managed platform charges per request, so no requests means no bill", "The GPU machine, all night: the endpoint keeps its minimum number of machines running", "Only the storage for the model file, since the machine sleeps when it is idle"], right: 1,
          fb: ["Dedicated endpoints charge for the machines assigned to them. Azure Machine Learning's documentation says the costs apply to the machines assigned to the deployment, not to requests.", null, "Storage is a small part. The machine assigned to the endpoint is billed while it is deployed."],
          after: () => "Right. Azure Machine Learning bills the machines assigned to a deployment. Google's documentation says its endpoints never go below the minimum number of machines you set. Idle machines are the main cost of a quiet endpoint." },
        { q: "SageMaker can scale some dedicated endpoints down to zero machines: ones that host <i>inference components</i> (a SageMaker way of placing models on an endpoint). The team turns that on. What happens to the first photo at 6 a.m.?",
          opts: ["It is answered as fast as at noon, because the platform keeps a warm spare for the first call", "It fails, and so do the calls after it, for several minutes while a machine starts", "It is held by the platform until the machine is ready, then answered a few minutes late"], right: 1,
          fb: ["There is no machine to answer it, and no warm spare. One has to be started first.", null, "Not on these endpoints. SageMaker's documentation says that while the machine is being provisioned, any attempt to call the endpoint produces an error."],
          after: () => `Right. SageMaker's documentation says starting a machine takes several minutes and calls fail meanwhile. This wait for the first machine is called a <b>cold start</b>. Zero machines at night means the app needs a queue or retries in the morning (the retries lesson), or the team keeps one machine. One more catch: on endpoints that use inference components, SageMaker's documentation says a failing health check does not make it replace the machine.<br><a class="${P}link" href="${DOC.smZero}" target="_blank" rel="noopener">SageMaker: scale an endpoint to zero</a>` },
        { q: "SageMaker Serverless Inference scales to zero and charges for use, not for idle time. Can the damage model use it to pay nothing at night?",
          opts: ["Yes, that is what it is for: spiky traffic with quiet nights", "No: Serverless Inference does not support GPUs, and the model needs one", "Yes, if the team adds a queue so the first photo each morning can wait for the cold start"], right: 1,
          fb: ["It fits spiky traffic with quiet periods, if the model can wait for cold starts. But read the exclusions: GPUs are on the list.", null, "A queue helps with cold starts, but it cannot add a GPU. The blocker is the GPU."],
          after: () => `Right. Its documentation lists GPUs among the features Serverless Inference does not support (checked ${CHECKED}). It suits models that run without a GPU and can wait for a cold start after quiet periods. Every option trades idle cost against a slow or failed first request; the platform does not make that choice for you.<br><a class="${P}link" href="${DOC.smServerless}" target="_blank" rel="noopener">SageMaker: Serverless Inference</a>` }
      ]
    });
  }

  /* 7. The big picture, with the CTO's question as the task. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    oneQ(el, done, kit, {
      head: () => `<h1>The answer for the CTO</h1>
        <ul class="${P}list">
          <li><b>What it is:</b> a managed ML platform runs your training and serving on its machines and does the machine work.</li>
          <li><b>Reach for it</b> when nobody on the team runs servers, traffic is spiky, or training is occasional.</li>
          <li><b>Not</b> when a platform team already runs a cluster with steady load (one more service there is cheap), or when data or tools need machines you control. With no model of your own, a hosted model API is enough.</li>
          <li><b>Costs:</b> machines billed while deployed, quota to request, an adapter for each platform's contract, and getting tied to one vendor's tools. Self-hosting costs the people who run the cluster, day and night.</li>
        </ul>
        <p class="task">The CTO wants one sentence for every team. Which do you send?</p>`,
      opts: [
        "Everyone moves to one managed platform, the arrival-time model included, so there is one bill and one set of tools",
        "Everyone runs on the company's Kubernetes cluster, so there is one way to deploy and one on-call team",
        "One container standard; teams without operations staff share one managed platform; the cluster keeps its own work and what needs our machines",
        "Each team picks whatever platform suits it best, since each team knows its own needs and traffic"
      ],
      right: 2,
      fb: [
        ["This pays twice for the routing team: the platform's machine work plus the cluster that stays for the warehouse system. And the passport scans cannot go to any cloud.", false],
        ["The damage, customs and forecast teams would each need someone on the platform team's pager, or they wait in its queue. You moved the machine work onto people who are already busy.", false],
        ["Right. Standardise what stays the same everywhere: the container image and a thin adapter. Pick one managed platform so the teams that need one share tooling, quota and know-how, and keep on the cluster what it already runs well, plus the passport scans and the GPU profiling, which need machines Kestrel controls.", true],
        ["This is how Kestrel got here. Three platforms means three sets of permissions, quotas, adapters and bills, and nobody who knows all three.", false]
      ]
    });
  }

  /* 8. Recognise it in new situations, including two where neither pile fits. */
  const OPTS4 = ["Managed platform", "Own containers", "A hosted model API", "On the device"];
  const CASES = [
    { q: "A two-person startup fine-tuned a small open model that tags clauses in contracts. Traffic only in office hours. Neither founder wants to be woken by a server.", right: 0,
      fb: [["Right. Its own model, no operations staff: let the platform run the machines.", true],
           ["Two people cannot run a cluster and build the product. Nothing here needs machines they control.", false],
           ["A hosted model API serves the provider's models. This startup has its own fine-tuned weights to serve.", false],
           ["Contracts are read in an office with a network. A server, run by a platform, is simpler to update than every laptop.", false]] },
    { q: "A shop chain wants short summaries of product reviews. Any good general model will do. No training, no custom weights.", right: 2,
      fb: [["A platform would host a model you do not have. Calling a provider's model through its API (the last lesson) needs no endpoint, no machines and no quota for GPUs.", false],
           ["There is nothing of their own to put in a container. Running an open model yourself is work with no reason here.", false],
           ["Right. No model of their own means nothing to host. A hosted model API is the smallest thing that works.", true],
           ["Summaries are made when reviews arrive on a server, not on a phone. Nothing here needs to run offline.", false]] },
    { q: "A video site's infrastructure team runs all its services on its own Kubernetes clusters. It wants to serve a recommendation model under heavy, steady load, around the clock.", right: 1,
      fb: [["It would work, but the team already does the machine work for everything else. A platform adds a second way to deploy and pay, and removes no work.", false],
           ["Right. The people and the cluster exist, and steady load keeps the machines busy. One more service there is the cheap option.", true],
           ["A recommendation model is trained on the site's own data. A general hosted model does not know its videos or users.", false],
           ["The recommendations are computed on servers from many users' data, not on one viewer's device.", false]] },
    { q: "A tractor maker wants to spot plant disease from a camera on the tractor, in fields with no mobile signal.", right: 3,
      fb: [["Any endpoint, managed or not, needs the network to reach it, and the field has none. The model has to run where the camera is.", false],
           ["Self-hosted servers are still servers: a request needs a network path to them. Without signal, nothing reaches them.", false],
           ["A hosted API is the furthest away of all. Without a network there is no call to make.", false],
           ["Right. With no network, no server choice matters. The model runs on the tractor's own computer. A platform can still be where it is trained.", true]] }
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    multiPick(el, done, kit, { opts: OPTS4, items: CASES, head: () => `<h1>Where does it run?</h1>
      <p class="lead">${Cap(word(CASES.length))} situations outside Kestrel. Two new answers this time: a hosted model API (call a provider's model, as in the last lesson) and on the device itself.</p>
      <p class="task">Pick where each one should run. Ask: is there a model of our own? Who would run the machines? Can a server be reached at all?</p>` });
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can make the call</h1>
      <p class="lead">You sorted ${word(CARDS.length)} team situations and defended one. A managed ML platform sells the machine work: creating, patching, scaling and replacing machines. Your model, your container, its health check, the machine choice and the quota stay yours, and each platform wants its own thin adapter. Choose it when nobody runs servers, traffic is spiky or training is occasional. Keep your own containers where a team already runs a cluster, or the data or tools need machines you control. With no model of your own, call a hosted model API. The price: machines billed while deployed, even when idle at night, plus quota and one adapter per platform.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. ${kit.esc(nx.outcome || "")}</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Managed ML platforms versus self-hosting",
    checked: CHECKED,
    sources: [
      DOC.azEndpoints,
      DOC.smContract,
      DOC.smServerless,
      DOC.smZero,
      "https://docs.aws.amazon.com/sagemaker/latest/dg/how-it-works-training.html",
      "https://docs.aws.amazon.com/sagemaker/latest/dg/deploy-model.html",
      DOC.gcContainer,
      "https://docs.cloud.google.com/vertex-ai/docs/predictions/configure-compute",
      "https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/training/overview",
      DOC.gcNotes,
      "https://docs.docker.com/reference/dockerfile/#cmd"
    ],
    interview: [
      {
        q: "Three ML teams at your company are each about to adopt a different cloud ML platform. The CTO asks you to propose a standard. What do you propose, and how do you decide per team?",
        good: [
          "Standardise the container image and its build, with a thin adapter per platform, rather than forcing one hosting choice on everyone",
          "Per team, ask who would run the machines: no operations staff, spiky traffic or occasional training points to a managed platform",
          "A team on a cluster that a platform team already runs, with steady load, can stay there: moving removes no work",
          "Data that must stay on premises, or work that needs shell access to the machine, rules out managed endpoints",
          "If a team has no model of its own, a hosted model API is enough; compare total cost including idle machines, quota and people"
        ],
        weak: "Pick the most popular platform for everyone, because managed is always easier, without asking who runs the machines today or what each team's data allows."
      },
      {
        q: "Your fine-tuned model runs on a managed GPU endpoint. It gets no traffic at night but costs the same as during the day. What can you do, and what does each option cost?",
        good: [
          "Dedicated endpoints bill for the machines assigned to them, so idle hours cost the same",
          "Scale in to zero where the platform allows it, but the first requests fail for minutes while a machine starts, so add a queue or retries",
          "Schedule-based scaling can lower the count at night if the traffic pattern is predictable",
          "Serverless options scale to zero but may not support GPUs and have cold starts; check the platform's exclusions",
          "Measure the traffic first, and compare with keeping one machine warm"
        ],
        weak: "Switch to serverless to pay per request, without checking that it supports GPUs or what a cold start does to the first users."
      }
    ],
    screens: [sortCards, spotIdea, defend, handOver, container, nightCost, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]", ...CARDS.slice(1).map((_, i) => `#c${i + 1} [data-right]`), "#check"], right: [...CARDS.map((_, i) => `#c${i} [data-right]`), "#check"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c3 [data-wrong]"], right: JOBS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
