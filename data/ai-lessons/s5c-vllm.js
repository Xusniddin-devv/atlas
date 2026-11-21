/* Lesson s5c-vllm: Serving many users with vLLM, even offline.
   Story: an engineering firm's internal assistant runs on one GPU server inside a network with no internet access.
   At nine, when the whole office logs in, it slows to a crawl.
   Ideas: (1) one GPU serves many users because a decoding step costs little more for many users than for one
   (batching), and a paged KV cache lets many requests hold memory without reserving the maximum each (PagedAttention),
   with continuous batching letting requests join and leave at every step; (2) an offline install must bring in
   everything the online install would have fetched: wheels for the server's own platform, the model files, and
   settings that stop the libraries from reaching out.
   Depth: explain (1, 3, 4, 5, 9, 10), library (6: vllm serve and its three memory/concurrency flags; 7: what an
   offline vLLM install pulls in), debug (2: the load test and the config line to blame; 8: a wheelhouse built for
   the wrong platform), when-not (9, 10).
   Data, all from runs on an Apple M1 (16 GB), kept in docs/ai-path/runs/s5c-vllm/:
     batch_cost.py / .out.txt        one weight matrix times 1, 8, 32, 128 user vectors, NumPy on the CPU
     toy_server.py / .out.txt        a load test of OUR SIMULATOR of a vLLM-style server (not vLLM: no GPU here)
     admit_trace.py / .out.txt       the traced admit() function of the simulator
     offline_rehearsal.sh / .out.txt a small offline-install rehearsal (pip wheelhouse, a tiny Hub model, dead proxy)
     vllm_deps.sh / .out.txt         uv resolving `vllm` for Linux x86_64, Python 3.12, CUDA 12.9 wheels (nothing installed)
   vLLM itself was not run: screen 6's command is written from the official docs and says so.
   No hosted model was called. Lesson-local style (.lx-s5c-vllm-*): clickable rows, see ensureStyle(). */
(() => {
  const ID = "s5c-vllm";
  const P = "lx-s5c-vllm-";
  const fmt = n => n.toLocaleString("en");

  /* ---------- Data from the runs ---------- */
  // toy_server.py assumptions (inputs to the simulator, not results)
  const GPU_GB = 48, WEIGHTS_GB = 16, OTHER_GB = 2, BLOCK = 16, MAX_SEQS = 128;
  const PROMPT = [600, 1400], ANSWER = [100, 500];
  // toy_server.out.txt: [rate sent per s, requests sent, finished per s, median wait s, p95 wait s, most running at once, preempted]
  const LOW = { util: 0.45, blocks: 1716, rows: [
    [0.5, 169, 0.55, 5.3, 7.6, 9, 0], [1, 327, 1.08, 5.3, 8.3, 14, 0], [1.5, 468, 1.55, 5.7, 8.8, 19, 0],
    [2, 618, 2.01, 6.1, 9.7, 23, 0], [2.5, 787, 2.57, 6.7, 10.7, 24, 37], [3, 925, 3.01, 9.9, 16.1, 26, 288],
    [4, 1252, 3.1, 53.2, 100.5, 26, 491], [6, 1834, 3.1, 146.9, 279.9, 26, 733], [8, 2478, 3.1, 252.3, 475.8, 26, 966]] };
  const HIGH = { util: 0.9, blocks: 12016, rows: [
    [0.5, 169, 0.55, 5.3, 7.6, 9, 0], [1, 327, 1.08, 5.3, 8.3, 14, 0], [1.5, 468, 1.55, 5.7, 8.8, 19, 0],
    [2, 618, 2.01, 6.1, 9.7, 23, 0], [2.5, 787, 2.57, 6.6, 10.5, 31, 0], [3, 925, 3.01, 7.0, 11.4, 38, 0],
    [4, 1252, 4.06, 8.5, 14.0, 62, 0], [6, 1834, 5.9, 13.8, 23.8, 127, 0], [8, 2478, 6.54, 44.7, 73.1, 128, 0]] };
  const R = { rate: 0, sent: 1, done: 2, p50: 3, p95: 4, peak: 5, pre: 6 };
  // batch_cost.out.txt: "weight matrix: (8192, 8192), 256 MiB" (float32, 4 bytes a number)
  const MATRIX = 8192, MATRIX_MIB = 256;
  // batch_cost.out.txt: [users in the batch, median ms for one step]
  const BATCH = [[1, 12.07], [8, 25.40], [32, 31.91], [128, 48.48]];
  // admit_trace.out.txt: blocks_for() of the four waiting requests, then every traced step
  const NEED = { q7: 63, q8: 75, q9: 57, q10: 44 };
  // admit_trace.py: admit(waiting, running, 200, 8), i.e. free_blocks 200 and max_num_seqs 8
  const FREE0 = 200, SEQ_CAP = 8;
  const ADMIT_CODE = [
    "def admit(waiting, running, free_blocks, max_num_seqs):",
    "    while waiting and len(running) < max_num_seqs:",
    "        req = waiting[0]",
    "        need = blocks_for(req[\"prompt\"])",
    "        if need > free_blocks:",
    "            break",
    "        waiting.pop(0)",
    "        running.append(req[\"id\"])",
    "        free_blocks -= need",
    "    return running, free_blocks"
  ];
  // [line, waiting, running, free_blocks, req, need]; vars as the tracer saw them before running that line
  const W4 = ["q7", "q8", "q9", "q10"], W3 = ["q8", "q9", "q10"], W2 = ["q9", "q10"], W1 = ["q10"];
  const R2 = ["q5", "q6"], R3 = [...R2, "q7"], R4 = [...R3, "q8"], R5 = [...R4, "q9"];
  const TRACE = [
    [1, W4, R2, 200, null, null], [2, W4, R2, 200, null, null], [3, W4, R2, 200, "q7", null], [4, W4, R2, 200, "q7", 63],
    [6, W4, R2, 200, "q7", 63], [7, W3, R2, 200, "q7", 63], [8, W3, R3, 200, "q7", 63],
    [1, W3, R3, 137, "q7", 63], [2, W3, R3, 137, "q7", 63], [3, W3, R3, 137, "q8", 63], [4, W3, R3, 137, "q8", 75],
    [6, W3, R3, 137, "q8", 75], [7, W2, R3, 137, "q8", 75], [8, W2, R4, 137, "q8", 75],
    [1, W2, R4, 62, "q8", 75], [2, W2, R4, 62, "q8", 75], [3, W2, R4, 62, "q9", 75], [4, W2, R4, 62, "q9", 57],
    [6, W2, R4, 62, "q9", 57], [7, W1, R4, 62, "q9", 57], [8, W1, R5, 62, "q9", 57],
    [1, W1, R5, 5, "q9", 57], [2, W1, R5, 5, "q9", 57], [3, W1, R5, 5, "q10", 57], [4, W1, R5, 5, "q10", 44],
    [5, W1, R5, 5, "q10", 44], [9, W1, R5, 5, "q10", 44], [9, W1, R5, 5, "q10", 44, "return"]
  ];
  // offline_rehearsal.out.txt, whole lines or trimmed with … (never altered)
  const LOG = [
    { side: "online", cmd: "pip download openai -d wheelhouse", text: "Downloading pydantic_core-2.50.4-cp312-cp312-macosx_11_0_arm64.whl (2.1 MB)", net: true,
      why: "pip fetched this wheel file from the package index. Every <code>Downloading</code> line is a file coming in from the internet." },
    { side: "online", cmd: "HF_DEBUG=1 hf download hf-internal-testing/tiny-random-LlamaForCausalLM", text: "Send: curl -X GET … -d https://pypi.org/pypi/huggingface_hub/json", net: true,
      why: "The Hub's command-line tool asked PyPI whether a newer version of itself exists. You did not ask for it; it does it on its own (the Hugging Face docs name it, and the setting <code>HF_HUB_DISABLE_UPDATE_CHECK</code> that turns it off)." },
    { side: "online", cmd: "HF_DEBUG=1 hf download hf-internal-testing/tiny-random-LlamaForCausalLM", text: "Send: curl -X HEAD … -d https://huggingface.co/hf-internal-testing/tiny-random-LlamaForCausalLM/resolve/9fb191250dd56d0ba7ec9785a025ed29c03d5998/config.json", net: true,
      why: "The model's files come from the Hugging Face Hub: this asks huggingface.co about one of them before downloading it." },
    { side: "closed", cmd: "pip install --no-index --find-links wheelhouse openai", text: "Processing WH/wheelhouse/pydantic_core-2.50.4-cp312-cp312-macosx_11_0_arm64.whl (from pydantic!=2.0.*,!=2.1.*,!=2.2.*,!=2.3.*,<3,>=1.10.13->openai)", net: false,
      why: "<code>Processing WH/wheelhouse/…</code> is a file from the local folder. <code>--no-index</code> told pip not to look at any package index at all." },
    { side: "closed", cmd: "pip install --no-index --find-links wheelhouse openai", text: "Successfully installed annotated-types-0.8.0 anyio-4.16.0 h11-0.16.0 httpcore2-2.16.0 httpx2-2.16.0 idna-3.20 jiter-0.19.0 openai-3.50.0 pydantic-2.14.3 pydantic-core-2.50.4 sniffio-1.3.1 truststore-0.10.5 typing-extensions-4.16.0 typing-inspection-0.4.5", net: false,
      why: "pip says what it installed, all from the wheelhouse folder. Nothing in this line came from the network." },
    { side: "closed", cmd: "HF_DEBUG=1 python -c 'hf_hub_download(\"hf-internal-testing/tiny-random-LlamaForCausalLM\", \"config.json\")'", text: "Request 139495b6-d2ad-4a8c-9c69-085f915fd50c: HEAD https://huggingface.co/hf-internal-testing/tiny-random-LlamaForCausalLM/resolve/main/config.json (authenticated: False)", net: true,
      why: "The file was already in the local cache, yet the library first asked huggingface.co whether a newer version exists. Inside the closed network that request goes nowhere; the library waited for it to fail, then used the cached copy. On a real server that means a slow start, or an error when the file is not cached." },
    { side: "closed", cmd: "HF_HUB_OFFLINE=1 python -c 'hf_hub_download(\"hf-internal-testing/tiny-random-LlamaForCausalLM\", \"config.json\")'", text: "WH/hf-home/hub/models--hf-internal-testing--tiny-random-LlamaForCausalLM/snapshots/9fb191250dd56d0ba7ec9785a025ed29c03d5998/config.json", net: false,
      why: "This is the printed path of the cached file. With <code>HF_HUB_OFFLINE=1</code> the library made no request at all and went straight to the cache." }

  ];
  // offline_rehearsal.out.txt, PART 3: the same wheelhouse, installed for Linux x86_64 and Python 3.12
  const P3_CMD = "pip install --no-index --find-links wheelhouse --only-binary=:all: --platform manylinux_2_28_x86_64 --python-version 3.12 --target srv openai";
  const P3_OUT = [
    "Looking in links: WH/wheelhouse",
    "Processing WH/wheelhouse/openai-3.50.0-py3-none-any.whl",
    "Processing WH/wheelhouse/anyio-4.16.0-py3-none-any.whl (from openai)",
    "Processing WH/wheelhouse/httpx2-2.16.0-py3-none-any.whl (from openai)",
    "ERROR: Could not find a version that satisfies the requirement jiter<1,>=0.16.0 (from openai) (from versions: none)",
    "ERROR: No matching distribution found for jiter<1,>=0.16.0 (from openai)"
  ];
  const WHEELHOUSE = ["annotated_types-0.8.0-py3-none-any.whl", "anyio-4.16.0-py3-none-any.whl", "h11-0.16.0-py3-none-any.whl",
    "httpcore2-2.16.0-py3-none-any.whl", "httpx2-2.16.0-py3-none-any.whl", "idna-3.20-py3-none-any.whl",
    "jiter-0.19.0-cp312-cp312-macosx_11_0_arm64.whl", "openai-3.50.0-py3-none-any.whl", "pydantic-2.14.3-py3-none-any.whl",
    "pydantic_core-2.50.4-cp312-cp312-macosx_11_0_arm64.whl", "sniffio-1.3.1-py3-none-any.whl", "truststore-0.10.5-py3-none-any.whl",
    "typing_extensions-4.16.0-py3-none-any.whl", "typing_inspection-0.4.5-py3-none-any.whl"];
  // vllm_deps.out.txt: uv pip compile of `vllm` for x86_64 Linux, Python 3.12, --torch-backend cu129
  const DEPS = { total: 200, nvidia: 28, resolvedOn: "2026-11-13" };

  /* ---------- Derived numbers ---------- */
  const avg = ([a, b]) => (a + b) / 2;
  const REQ_TOKENS = avg(PROMPT) + avg(ANSWER);                       // tokens a request holds near the end of its answer
  const kvTokens = t => t.blocks * BLOCK;
  const fitsAtOnce = t => Math.floor(kvTokens(t) / REQ_TOKENS);
  const peakOf = t => Math.max(...t.rows.map(r => r[R.peak]));
  const SAT = LOW.rows.findIndex(r => r[R.done] < 0.9 * r[R.rate]);   // first row where finishing stops following sending
  const QUIET = LOW.rows[0][R.p50];                                   // one question on a quiet server
  const RUSH = LOW.rows[SAT][R.rate];                                 // questions per second at nine

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}list { display: grid; gap: 8px; margin-top: 14px; }
      .${P}list button, .${P}list .row { display: block; width: 100%; text-align: left; min-height: 44px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: 500 15px/1.45 var(--font); overflow-wrap: anywhere; }
      .${P}list button { cursor: pointer; }
      .${P}list button.right { border-color: var(--good); background: var(--good-soft); }
      .${P}list button.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}list button[disabled] { cursor: default; }
      .${P}mono { display: block; font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; font-variant-ligatures: none; }
      .${P}list small { display: block; margin-top: 4px; font: 500 13px/1.5 var(--font); color: var(--muted); }
      .${P}lt { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 10px; font: 500 14px/1.5 var(--mono); }
      .${P}lt span:first-child { font-weight: 700; }
      .${P}head { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 10px; padding: 0 13.5px; margin-top: 14px; font: 600 12px/1.4 var(--font); color: var(--muted); }
      .${P}out { margin: 8px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); font-variant-ligatures: none; }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}who { margin: 18px 0 2px; font: 600 12.5px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; }
      .${P}part { margin-top: 22px; }
      .${P}ul { margin: 8px 0; padding-left: 20px; }
      .${P}ul li { margin: 4px 0; }
      .${P}tb { width: 100%; border-collapse: collapse; margin-top: 10px; font: 500 14px/1.5 var(--mono); }
      .${P}tb th { text-align: left; font: 600 12px/1.4 var(--font); color: var(--muted); padding: 4px 6px; border-bottom: 1px solid var(--line); }
      .${P}tb td { padding: 4px 6px; border-bottom: 1px solid var(--line); }
      .${P}tb tr.hit td { font-weight: 700; }
      .${P}blocks { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-top: 16px; max-width: 420px; }
      .${P}blocks span { display: flex; align-items: center; justify-content: center; height: 34px; border: 1.5px dashed var(--line); border-radius: 6px; font: 500 12px/1 var(--mono); color: var(--muted); }
      .${P}blocks span.on { border: 1.5px solid var(--ink); background: var(--sunk); color: var(--ink); font-weight: 700; font-size: 14px; }
      @media (hover: hover) { .${P}list button:not(.right):not(.wrong):not([disabled]):hover { border-color: var(--ink); } }
    `;
    document.head.appendChild(s);
  }
  const box = (kit, text) => `<pre class="${P}out">${kit.esc(text)}</pre>`;
  const SIM_NOTE = `We have no GPU server here, so these numbers come from a small <b>simulator</b> of a vLLM-style server that we wrote and ran on a laptop (it is not vLLM). The simulated GPU has ${GPU_GB} GB of memory and the model's weights take ${WEIGHTS_GB} GB. Trust the shape, not the exact seconds.`;
  const loadRow = r => `<span>${r[R.rate]}/s</span><span>${r[R.done].toFixed(2)}/s</span><span>${r[R.p50].toFixed(1)} s</span><span>${r[R.p95].toFixed(1)} s</span>`;
  const loadHead = `<div class="${P}head"><span>sent</span><span>finished</span><span>median wait</span><span>slowest 5%</span></div>`;

  /* 1. The situation: nine o'clock, and one question at a time cannot keep up. */
  function nineOClock({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const work = RUSH * QUIET;
    const opts = [
      `Each person waits about ${QUIET.toFixed(1)} s, as on a quiet afternoon`,
      `Each person waits about ${RUSH} × ${QUIET.toFixed(1)} = ${work.toFixed(1)} s, and it stays there`,
      "The wait keeps growing for as long as the rush lasts"
    ];
    const FB = [
      `${QUIET.toFixed(1)} s is the time for one question when nobody else is asking. At nine, ${RUSH} new questions arrive every second, and a server that answers one at a time can start the next only when the last one is done.`,
      `That would be true if the questions arrived once and stopped. They keep coming: every second brings ${work.toFixed(1)} s of work for a server that can do only 1 s of work per second. The queue does not settle; it grows.`,
      `Right. Every second brings ${RUSH} questions, that is ${work.toFixed(1)} s of work, and a one-at-a-time server finishes only 1 s of work per second. The queue grows by about ${(work - 1).toFixed(1)} s of work every second until the rush ends. A faster single answer does not fix that; the server must work on many questions <b>at the same time</b>. That is what <b>vLLM</b> is for: an open-source engine that serves an open model to many users at once from a GPU server, behind an OpenAI-style web API.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Nine o'clock, and nobody gets an answer</h1>
        <p class="lead">An engineering firm runs its own assistant: an open model on one GPU server, inside a network with no internet access, because the drawings and contracts may not leave the building. It answers fine all afternoon. At nine every morning, when the whole office logs in, answers take minutes.</p>
        <p class="lead">On a quiet server one question takes about <b>${QUIET.toFixed(1)} s</b>. At nine about <b>${RUSH} questions a second</b> arrive.</p>
        <p class="lead">This lesson is about <b>serving</b>: running your own model so that many people can use it at once. It is the step after you pick and run an open model, and before real users arrive.</p>
        <p class="task">Suppose the server worked on one question at a time. What happens to the wait during the rush?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 2 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ans === 2)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 2. By hand: where does the load test saturate, and which config line is to blame? */
  const CFG = [
    ["vllm serve /models/assistant-8b", "The model, loaded from a local folder. It answered fine; the model is the same at every load."],
    [`--gpu-memory-utilization ${LOW.util}`, null],
    ["--max-model-len 8192", "This caps one request's length (prompt plus answer). Our requests are at most " + fmt(PROMPT[1] + ANSWER[1]) + " tokens, far below it. And KV cache memory is handed out piece by piece as tokens arrive, so a high cap does not reserve memory for every request."],
    [`--max-num-seqs ${MAX_SEQS}`, null]
  ];
  function loadTest({ el, done, kit }) {
    ensureStyle();
    let row = null, cfg = null;
    const peak = peakOf(LOW);
    const kvGb = LOW.util * GPU_GB - WEIGHTS_GB - OTHER_GB;
    const rowFb = i => {
      const r = LOW.rows[i];
      if (i === SAT) return kit.feedback(`Right. Up to ${LOW.rows[SAT - 1][R.rate]} a second, <b>finished</b> follows <b>sent</b>. At ${r[R.rate]} a second it finishes only ${r[R.done].toFixed(2)}, and it stays at that number however fast you send. The server has hit its ceiling, so every extra question joins a queue, and the median wait jumps from ${LOW.rows[SAT - 1][R.p50].toFixed(1)} s to ${r[R.p50].toFixed(1)} s. This point is called <b>saturation</b>.`, true);
      if (i === SAT - 1) return kit.feedback(`Close. At ${r[R.rate]} a second it still finishes ${r[R.done].toFixed(2)} a second, so it keeps up, even though the median wait has already grown from ${QUIET.toFixed(1)} s to ${r[R.p50].toFixed(1)} s. Look for the first row where <b>finished</b> stops following <b>sent</b>.`, false);
      if (i < SAT) return kit.feedback(`At ${r[R.rate]} a second sent, it finished ${r[R.done].toFixed(2)} a second: it keeps up, and the median wait (${r[R.p50].toFixed(1)} s) is close to a quiet server's ${QUIET.toFixed(1)} s.`, false);
      return kit.feedback(`It is saturated here, but it already was one row earlier: <b>finished</b> is ${r[R.done].toFixed(2)} a second, the same ceiling as the row above. Find the first row where finished stops following sent.`, false);
    };
    const cfgFb = i => {
      if (i === 1) return kit.feedback(`Right. <code>--gpu-memory-utilization</code> is the share of the GPU's memory vLLM may use. What is left after the weights becomes the <b>KV cache</b>, and every running request keeps its keys and values there. ${LOW.util} × ${GPU_GB} GB = ${(LOW.util * GPU_GB).toFixed(1)} GB; minus ${WEIGHTS_GB} GB of weights and ${OTHER_GB} GB of working memory leaves ${kvGb.toFixed(1)} GB: ${fmt(kvTokens(LOW))} tokens. A request holds about ${fmt(REQ_TOKENS)} tokens near the end of its answer, so only about ${fitsAtOnce(LOW)} fit at once, a few more while some are still early in their answers (the simulator peaked at ${peak}). More than half the card sits unused. (The value had been copied from a setup where two models shared one card.)`, true);
      if (i === 3) return kit.feedback(`The server may run up to ${MAX_SEQS} requests at once, but it never ran more than ${peak}. Something else stopped it far below this limit.`, false);
      return kit.feedback(CFG[i][1], false);
    };
    const paint = () => {
      const rows = LOW.rows.map((r, i) => `<button type="button" data-i="${i}" class="${row === i ? (i === SAT ? "right" : "wrong") : ""}"${row === SAT ? " disabled" : ""}><span class="${P}lt">${loadRow(r)}</span></button>`).join("");
      el.innerHTML = `<h1>Read the load test</h1>
        <p class="lead">Before touching anything, the team sent questions at a steady rate for five minutes per row and measured how many were <b>finished</b> per second and how long people waited. ${SIM_NOTE}</p>
        <p class="task">Each row is one sending rate. Click the first row where <b>finished</b> per second falls behind <b>sent</b> per second.</p>
        ${loadHead}<div class="${P}list" id="rows">${rows}</div>
        <div class="lpanel">${row == null ? "" : rowFb(row)}</div>
        ${row === SAT ? `<div class="${P}part">
          <p class="lead">This is how the server was started. The simulator reports a KV cache with room for <b>${fmt(kvTokens(LOW))} tokens</b>, and at most <b>${peak}</b> requests running at once in any row.</p>
          <p class="task">Which line of the start command is to blame?</p>
          <div class="${P}list" id="cfg">${CFG.map(([t], i) => `<button type="button" data-i="${i}" class="${cfg === i ? (i === 1 ? "right" : "wrong") : ""}"><span class="${P}mono">${kit.esc(t)}</span></button>`).join("")}</div>
          <div class="lpanel">${cfg == null ? "" : cfgFb(cfg)}</div></div>` : ""}`;
      el.querySelectorAll("#rows button").forEach(b => b.onclick = () => { row = +b.dataset.i; paint(); });
      el.querySelectorAll("#cfg button").forEach(b => b.onclick = () => { cfg = +b.dataset.i; paint(); if (cfg === 1) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: a step for many users costs little more than a step for one. */
  function whyBatch({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const one = BATCH[0][1], b32 = BATCH.find(b => b[0] === 32)[1];
    const opts = [
      `About 32 times as long: ${(32 * one).toFixed(0)} ms`,
      "A few times as long, far less than 32 times",
      `Less than for one user: about ${(one / 32).toFixed(2)} ms`
    ];
    const FB = [
      `That is what 32 separate steps would cost. But a step does not do the work 32 times: the weights are read once and used for every user's numbers.`,
      `Right: <b>${b32.toFixed(2)} ms</b>, ${(b32 / one).toFixed(1)} times as long, not 32 times. Each step of writing an answer multiplies the user's numbers by every weight of the model, and the slow part is <b>reading those weights from memory</b>. Read once, they serve the whole group. A GPU is far faster than this processor, but the same holds there: writing tokens is held back by reading weights. That is <b>batching</b>, and the vLLM paper opens with it: high-throughput serving "requires batching sufficiently many requests at a time". The price: each step got slower, so each person's answer is written a little more slowly while the server answers many more people.`,
      `The work for 32 users includes the work for one, so a step cannot get faster. What drops is the cost <b>per user</b>; the step itself takes longer.`
    ];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>Why one GPU can serve many people</h1>
        <p class="lead">The simulator ran up to ${peakOf(LOW)} requests at once. Why does that help? To write one token for one user, the model multiplies that user's numbers (a list of numbers for the text so far) by its weight matrices. We timed one weight matrix of ${fmt(MATRIX)} × ${fmt(MATRIX)} numbers (${MATRIX_MIB} MiB) on this laptop's processor, multiplied by one user's numbers, then by many users' numbers at once.</p>
        <table class="${P}tb"><tr><th>users in one step</th><th>time for the step</th>${ok ? "<th>per user</th>" : ""}</tr>
          ${BATCH.filter(([u]) => ok || u === 1 || u === 32).map(([u, ms]) => `<tr${ok && u === 32 ? ' class="hit"' : ""}><td>${u}</td><td>${u === 32 && !ok ? "?" : ms.toFixed(2) + " ms"}</td>${ok ? `<td>${(ms / u).toFixed(2)} ms</td>` : ""}</tr>`).join("")}</table>
        <p class="${P}cap">Real output of our run (batch_cost.py, NumPy on an Apple M1 processor), 2026-11-14</p>
        <p class="task">One user's step took ${one.toFixed(2)} ms. Predict the step for 32 users.</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ok)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. By hand: reserve the maximum, or hand out blocks as tokens arrive (paged KV cache). */
  const SPACE = 24, MAXLEN = 128, TOKENS = [40, 70, 25, 90, 55, 33], NAMES = ["A", "B", "C", "D", "E", "F"];
  function pagedKv({ el, done, kit }) {
    ensureStyle();
    let a1 = null, a2 = null;
    const per = MAXLEN / BLOCK, fitRes = Math.floor(SPACE / per);
    const blocks = TOKENS.map(t => Math.ceil(t / BLOCK));
    let used = 0, fitPaged = 0;
    for (const b of blocks) { if (used + b > SPACE) break; used += b; fitPaged++; }
    const held = TOKENS.slice(0, fitRes).reduce((a, b) => a + b, 0);
    const all = TOKENS.slice(0, fitPaged).reduce((a, b) => a + b, 0);
    const o1 = [fitRes - 1, fitRes, TOKENS.length].filter((v, i, a) => a.indexOf(v) === i);
    const o2 = [fitRes, fitPaged - 1, fitPaged].filter((v, i, a) => a.indexOf(v) === i);
    const fb1 = v => v === fitRes
      ? kit.feedback(`Right: ${SPACE} ÷ ${per} = ${fitRes}. Each request takes ${per} blocks (${MAXLEN} tokens) from the start, because nobody knows how long its answer will be. The ${fitRes} requests in hold ${held} tokens in ${fitRes * MAXLEN} tokens of space.`, true)
      : kit.feedback(v > fitRes ? `Each request reserves ${per} blocks for the longest allowed answer, whatever it holds now. ${v} × ${per} = ${v * per} blocks, but there are only ${SPACE}.` : `${v} × ${per} = ${v * per} blocks, and ${SPACE} are free: one more reservation still fits.`, false);
    const fb2 = v => v === fitPaged
      ? kit.feedback(`Right: all ${fitPaged}. Rounded up to whole blocks they need ${blocks.join(" + ")} = ${used} of ${SPACE} blocks. They hold ${all} tokens in ${used * BLOCK} tokens of blocks: only the last block of each request is part-empty, so each wastes fewer than ${BLOCK} tokens. A block need not sit next to the request's other blocks; a small table per request lists where its blocks are, like pages of memory in an operating system. That is vLLM's <b>PagedAttention</b>, and it is why a KV cache of a given size runs many more requests at once.`, true)
      : kit.feedback(v === fitRes ? `That is the reservation answer. Now nobody reserves: a request takes a ${BLOCK}-token block only when its tokens fill the last one. Count the blocks each needs now, rounding up to whole blocks: ${TOKENS.map(t => `${t} ÷ ${BLOCK}`).join(", ")}.` : `Add them up: ${blocks.join(" + ")} = ${used} blocks, and ${SPACE} are free. One more fits than you said.`, false);
    const paint = () => {
      const fin = a2 === fitPaged;
      const owner = [];
      if (fin) blocks.slice(0, fitPaged).forEach((b, i) => { for (let k = 0; k < b; k++) owner.push(NAMES[i]); });
      while (owner.length < SPACE) owner.push("");
      el.innerHTML = `<h1>Room for the KV cache</h1>
        <p class="lead">Batching needs memory. Each running request keeps its keys and values for every token so far, its <b>KV cache</b>, on the GPU. vLLM splits this memory into <b>blocks</b>, each with room for a fixed number of tokens. Here the KV space is <b>${SPACE} blocks of ${BLOCK} tokens</b>, and a request may grow to <b>${MAXLEN} tokens</b>. Six requests are waiting, holding these many tokens so far:</p>
        <table class="${P}tb"><tr>${NAMES.map(n => `<th>${n}</th>`).join("")}</tr><tr>${TOKENS.map(t => `<td>${t}</td>`).join("")}</tr></table>
        <p class="task">Answer two questions about how many requests fit.</p>
        <div class="lcase" id="p1"><p>If each request reserves room for the longest it may grow (${MAXLEN} tokens), how many of the six fit?</p>
          ${kit.options(o1.map(String), { picked: a1 == null ? null : o1.indexOf(a1), correct: o1.indexOf(fitRes), num: true })}${a1 == null ? "" : fb1(a1)}</div>
        ${a1 === fitRes ? `<div class="lcase" id="p2"><p>If each takes ${BLOCK}-token blocks only as its tokens arrive, how many fit?</p>
          ${kit.options(o2.map(String), { picked: a2 == null ? null : o2.indexOf(a2), correct: o2.indexOf(fitPaged), num: true })}${a2 == null ? "" : fb2(a2)}</div>` : ""}
        ${fin ? `<div class="${P}blocks">${owner.map(o => `<span class="${o ? "on" : ""}">${o || "free"}</span>`).join("")}</div><p class="${P}cap">The ${SPACE} blocks, each marked with the request that holds it.</p>` : ""}
`;
      el.querySelectorAll("#p1 .lopts button").forEach(b => b.onclick = () => { a1 = o1[+b.dataset.i]; paint(); });
      el.querySelectorAll("#p2 .lopts button").forEach(b => b.onclick = () => { a2 = o2[+b.dataset.i]; paint(); if (a2 === fitPaged) done(); });
    };
    paint();
  }

  /* 5. Continuous batching: the simulator's admit(), stepped from a real trace, after a prediction. */
  const SAY = {
    1: "Room for another request? The loop runs while someone waits and fewer than max_num_seqs are running.",
    2: "Look at the first request in the queue. First come, first served.",
    3: "How many blocks does its prompt need?",
    4: "Compare with the free blocks.",
    5: "Not enough room: stop. The request stays waiting for a later step.",
    6: "It fits: take it out of the queue,",
    7: "add it to the running batch,",
    8: "and take its blocks from the free ones.",
    9: "Hand back the running batch and what is left free."
  };
  function admitCode({ el, done, kit }) {
    ensureStyle();
    let ans = null, k = 0;
    const order = Object.keys(NEED);
    let free = FREE0, left = null;
    for (const q of order) { if (NEED[q] > free) { left = q; break; } free -= NEED[q]; }
    const opts = [`None: max_num_seqs is ${SEQ_CAP}, so all four join`, left, "q8, the biggest one"];
    const FB = [
      `max_num_seqs is not the limit here: ${R2.length} running plus ${order.length} is ${R2.length + order.length}, under ${SEQ_CAP}. Blocks are. Add the needs in order: ${order.map(q => NEED[q]).join(", ")}.`,
      `Right. ${order.slice(0, 3).map(q => NEED[q]).join(" + ")} = ${FREE0 - free} blocks, which leaves ${free}; ${left} needs ${NEED[left]}. Step through and watch the loop stop at the <code>break</code>.`,
      `q8 is the biggest, but it comes second in the queue, and after q7 there are still ${FREE0 - NEED.q7} blocks free: enough for its ${NEED.q8}. Add the needs in order and see where the free blocks run out.`
    ];
    const paint = () => {
      const s = TRACE[k], ok = ans === 1, last = k === TRACE.length - 1;
      el.innerHTML = `<h1>Who runs in the next step</h1>
        <p class="lead">A <b>step</b> is one round in which every running request gets one more token. vLLM decides who runs <b>at every step</b>, not once per batch. A request that finishes leaves at once and frees its blocks. A waiting one can join at the very next step, so nobody waits for the slowest answer in a group. This is <b>continuous batching</b>.</p>
        <p class="lead">Our simulator picks who joins with a function, <code>admit()</code>, that runs before each step (it is not vLLM's code, which does much more). Free blocks: ${FREE0}. Running: ${R2.join(", ")}. Waiting, in order, with the blocks each prompt needs: ${order.map(q => `${q} (${NEED[q]})`).join(", ")}.</p>
        <p class="task">${ok ? "Step through the real run to the end." : "Before you step through it: which request is still waiting after admit() runs?"}</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(FB[ans], ok)}</div>
        ${ok ? `<div class="${P}wrap">${kit.code(ADMIT_CODE, s[0])}</div>
        <div class="vars"><span>waiting <b>${s[1].join(" ") || "–"}</b></span><span>running <b>${s[2].join(" ")}</b></span><span>free_blocks <b>${s[3]}</b></span>${s[4] ? `<span>req <b>${s[4]}</b></span>` : ""}${s[5] != null ? `<span>need <b>${s[5]}</b></span>` : ""}</div>
        ${kit.feedback(last ? `Returned: ${s[2].length} running, ${s[3]} blocks free, ${s[1].join(", ")} still waiting. When a running request finishes and frees its blocks, ${s[1][0]} gets in at a later step. vLLM's scheduler also cuts long prompts into chunks and can push a running request back out when blocks run out (it calls this preemption: the request is recomputed later, which costs time).` : `Step ${k + 1} of ${TRACE.length}. ${SAY[s[0]]}`)}
        <p class="${P}cap">Steps from a real trace of admit() (admit_trace.py), 2026-11-14</p>
        <div class="lsteps"><button type="button" class="btn" data-prev${k === 0 ? " disabled" : ""}>Step back</button><button type="button" class="btn" data-next${last ? " disabled" : ""}>Next step</button></div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { if (ans === 1) return; ans = +b.dataset.i; paint(); });
      const prev = el.querySelector("[data-prev]"), next = el.querySelector("[data-next]");
      if (prev) prev.onclick = () => { if (k > 0) { k--; paint(); } };
      if (next) next.onclick = () => { if (k < TRACE.length - 1) { k++; paint(); if (k === TRACE.length - 1) done(); } };
    };
    paint();
  }

  /* 6. The real tool: the vllm serve flags, and where the next limit is (simulator re-run). */
  const SERVE = [
    "vllm serve /models/assistant-8b \\",
    `  --gpu-memory-utilization ${HIGH.util} \\`,
    "  --max-model-len 8192 \\",
    `  --max-num-seqs ${MAX_SEQS} \\`,
    "  --port 8000"
  ];
  function tune({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const top = HIGH.rows[HIGH.rows.length - 1], prevRow = HIGH.rows[HIGH.rows.length - 2];
    const atRush = HIGH.rows.find(r => r[R.rate] === RUSH), lowRush = LOW.rows[SAT];
    const fit = fitsAtOnce(HIGH);
    const opts = ["The KV cache is full again", `max-num-seqs ${MAX_SEQS}`, `gpu-memory-utilization ${HIGH.util} is still too low`];
    const FB = [
      `Then requests would be pushed back out, and the simulator counted ${top[R.pre]} of those. The KV cache now holds ${fmt(kvTokens(HIGH))} tokens: room for about ${fit} requests of ${fmt(REQ_TOKENS)} tokens, more than are running.`,
      `Right. At ${top[R.rate]} a second, <b>${top[R.peak]}</b> requests ran at once: exactly the cap. The rest waited in the queue with blocks still free. Raising the cap would help only up to about ${fit} requests, where the KV cache (${fmt(kvTokens(HIGH))} tokens) fills, and every extra request in a step makes the step slower for everyone. Past that, the levers are a second GPU (<code>--tensor-parallel-size</code> splits one model over several GPUs) or a second server.`,
      `Memory is no longer the limit: the KV cache has room for about ${fit} requests of ${fmt(REQ_TOKENS)} tokens and nothing was pushed back out (${top[R.pre]}). Look at how many ran at once.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>The fix, and the next limit</h1>
        <p class="lead"><b>Not run by us.</b> Written from the <a href="https://docs.vllm.ai/en/latest/configuration/engine_args.html">official documentation</a>, checked 2026-11-14. vLLM's GPU install is for Linux, which is why we used a simulator.</p>
        <div class="${P}wrap">${kit.code(SERVE, 1)}</div>
        <p class="lead">Three flags decide how many people one server can take. <code>--gpu-memory-utilization</code>: the share of GPU memory vLLM may use (${HIGH.util} means ${Math.round(HIGH.util * 100)}%); what is left after the weights becomes KV cache. <code>--max-model-len</code>: the longest prompt plus answer one request may have. <code>--max-num-seqs</code>: the most requests in one step. The office app then talks to <code>http://&lt;server&gt;:8000/v1</code> with any OpenAI-style client, the same code it would use for a hosted API.</p>
        <p class="lead">The team raised the share to ${HIGH.util} and ran the simulator again. At ${RUSH} a second the median wait fell from ${lowRush[R.p50].toFixed(1)} s to ${atRush[R.p50].toFixed(1)} s. Then they pushed harder:</p>
        ${loadHead}<div class="${P}list">${[prevRow, top].map(r => `<div class="row"><span class="${P}lt">${loadRow(r)}</span><small>at most ${r[R.peak]} running at once · ${r[R.pre]} pushed back out</small></div>`).join("")}</div>
        <p class="task">At ${top[R.rate]} a second the wait jumps again. Which limit did the server hit now?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. By hand: tick every line of the install log that reached for the internet. */
  function installLog({ el, done, kit }) {
    ensureStyle();
    const ticked = new Set();
    let miss = null;
    const need = LOG.map((l, i) => l.net ? i : -1).filter(i => i >= 0);
    const paint = () => {
      const fin = need.every(i => ticked.has(i));
      el.innerHTML = `<h1>What reached the internet?</h1>
        <p class="lead">The server room has no internet, so the install happens in two halves: fetch everything on a machine that has internet, carry it in, install it inside. We rehearsed this on a laptop with small pieces: the OpenAI client library and a tiny test model from the Hugging Face Hub. For the inside half we pointed every network proxy at a dead address, so any request to the internet failed. <code>WH/</code> is our work folder. pip packages come as <b>wheel</b> files (<code>.whl</code>); a folder of them is called a <b>wheelhouse</b>.</p>
        <p class="task">Click every line that reached for the internet, or tried to.</p>
        <div class="${P}list">${LOG.map((l, i) => `<button type="button" data-i="${i}" class="${ticked.has(i) ? "right" : miss === i ? "wrong" : ""}"${ticked.has(i) ? " disabled" : ""}><span class="${P}mono">${kit.esc(l.text)}</span><small>${l.side === "online" ? "With internet" : "Inside, no internet"} · $ ${kit.esc(l.cmd)}</small></button>`).join("")}</div>
        <p class="${P}cap">Real output of our run (offline_rehearsal.sh), 2026-11-14, trimmed with …</p>
        <div class="lpanel">${miss != null ? kit.feedback(`Not this one. ${LOG[miss].why}`, false) : ""}
        ${ticked.size && miss == null && !fin ? kit.feedback(`Yes. ${LOG[[...ticked].pop()].why} ${need.length - ticked.size} more to find.`) : ""}
        ${fin ? kit.feedback(`Right, all ${need.length}. The surprise is the line from the <code>HF_DEBUG=1 python</code> run: the file was already there, and the library still reached out first. So an offline vLLM server needs more than files. Bring in:
          <ul class="${P}ul"><li><b>The Python packages</b>, built for the server's own system. Resolving <code>vllm</code> for Linux, Python 3.12 and CUDA 12.9 wheels gave us ${DEPS.total} packages (resolved ${DEPS.resolvedOn}), ${DEPS.nvidia} of them <code>nvidia-*</code>. Or the project's Docker image, saved to a file with <code>docker save</code>.</li>
          <li><b>The model folder</b> with weights and tokenizer, served by its path.</li>
          <li><b>Settings that stop reaching out</b>: <code>HF_HUB_OFFLINE=1</code>; <code>VLLM_NO_USAGE_STATS=1</code> (vLLM collects anonymous usage stats by default); <code>--enable-offline-docs</code> for the API's docs page.</li>
          <li><b>Kernels</b>: vLLM's install page runs <code>vllm download-kernels</code> after install to fetch precompiled kernels (the small programs that run on the GPU); without them vLLM downloads and compiles kernels at startup.</li></ul>
          Then rehearse the install with the network cut before you go in.`, true) : ""}</div>`;
      el.querySelectorAll(`.${P}list button`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (LOG[i].net) { ticked.add(i); miss = null; } else miss = i;
        paint();
        if (need.every(j => ticked.has(j))) done();
      });
    };
    paint();
  }

  /* 8. Broken on purpose: the wheelhouse was built for the wrong machine. */
  function brokenWheels({ el, done, kit }) {
    ensureStyle();
    let pick = null, fix = null;
    const lines = [...P3_OUT.map(t => ["out", t]), ...WHEELHOUSE.map(t => ["ls", t])];
    const RIGHT = lines.findIndex(([, t]) => t.startsWith("jiter-"));
    const macOnly = WHEELHOUSE.filter(w => w.includes("macosx"));
    const fb = i => {
      const t = lines[i][1];
      if (i === RIGHT) return kit.feedback(`Right. The file name says who can use a wheel: <code>cp312</code> means Python 3.12, and <code>macosx_11_0_arm64</code> means a Mac with an Apple chip. pip downloaded the wheels that fit the machine it ran on, a developer's Mac. The server is Linux on x86_64, so pip skips this file and finds no other. ${macOnly.length} files in the folder are Mac-only; the second would fail next.`, true);
      if (macOnly.includes(t)) return kit.feedback("This one is Mac-only too and would fail next, but pip stopped earlier. Click the file the ERROR line names (jiter).", false);
      if (t.startsWith("ERROR")) return kit.feedback("That is the symptom: pip found no usable jiter. The cause is in what the folder holds; look at the jiter file's name.", false);
      if (t.includes("py3-none-any")) return kit.feedback("<code>py3-none-any</code> means pure Python: any Python 3, any system. These wheels install fine anywhere, and pip processed some of them before it stopped.", false);
      if (t.startsWith("Looking")) return kit.feedback("This only says pip is reading the local folder instead of an index, which is what an offline install should do.", false);
      return kit.feedback("This line went fine. Find the file that does not fit the server.", false);
    };
    const fixes = [
      "On the machine with internet, run pip download with the server's platform: --only-binary=:all: --platform manylinux_2_28_x86_64 --python-version 3.12 (or download on a Linux machine like the server)",
      "Drop --no-index on the server so pip can fetch what is missing",
      "Rename the jiter file so its name says manylinux"
    ];
    const FIX_FB = [
      "Right. pip's docs: <code>--platform</code> means \"only use wheels compatible with &lt;platform&gt;\", and it needs <code>--only-binary=:all:</code> (or <code>--no-deps</code>) with it. Build the folder for the machine that will install it, then rehearse the install with the network cut. The Docker image route skips matching wheels by hand (the image already holds them for its platform), at the cost of a much bigger file to carry in.",
      "The server has no internet. Without <code>--no-index</code>, pip would try the package index, wait for the network, and fail anyway.",
      "The name is not a label you can change: the file inside is compiled for macOS on an Apple chip, and cannot load on Linux on x86_64."
    ];
    const paint = () => {
      const ok = pick === RIGHT;
      el.innerHTML = `<h1>Broken on purpose: the folder that does not install</h1>
        <p class="lead">A developer filled the wheelhouse on his Mac and carried it in. On the Linux GPU server the install fails. We reproduced it on our laptop by telling pip to install for the server's platform: Linux on an Intel or AMD processor (x86_64), Python 3.12. pip names that Linux platform <code>manylinux_2_28_x86_64</code>.</p>
        ${box(kit, "$ " + P3_CMD)}
        <p class="task">Click the line that is the cause.</p>
        <div class="${P}list">${lines.map(([k, t], i) => `${i === P3_OUT.length ? `<div class="${P}who">$ ls wheelhouse</div>` : ""}<button type="button" data-i="${i}" class="${pick === i ? (i === RIGHT ? "right" : "wrong") : ""}"${ok ? " disabled" : ""}><span class="${P}mono">${kit.esc(t)}</span></button>`).join("")}</div>
        <p class="${P}cap">Real output of our run (offline_rehearsal.sh, part 3), 2026-11-14</p>
        <div class="lpanel">${pick == null ? "" : fb(pick)}</div>
        ${ok ? `<div class="lcase" id="f"><p>What is the fix?</p>${kit.options(fixes.map(f => kit.esc(f)), { picked: fix, correct: 0 })}${fix == null ? "" : kit.feedback(FIX_FB[fix], fix === 0)}</div>` : ""}`;
      el.querySelectorAll(`.${P}list button`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); });
      el.querySelectorAll("#f button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A design studio of six people, about thirty questions a day, no rule about where data goes",
      "A hospital with 400 staff, records that may not leave the building, and a GPU server in its own data room",
      "A researcher on a long trip with only a laptop, trying prompts alone"
    ];
    const FB = [
      "Thirty questions a day never fill a batch, and a GPU server costs money even when idle and needs someone to run it. With no data rule, a hosted API is cheaper and simpler.",
      "Right. Many people at the same hour, data that must stay inside, and hardware already there: batching and the paged KV cache turn one GPU into a service for the whole staff. Their cost is people: someone tunes it, watches it and carries every update in by hand.",
      "One user on a laptop gains nothing from batching, and vLLM's GPU install is for Linux servers (on a Mac it needs a community plugin). A local runner such as Ollama, from the last lesson, fits this."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for vLLM</h1>
        <p class="lead"><b>For:</b> many users at once on GPUs you control, when data must stay inside or traffic is steady enough to keep a GPU busy. It also runs big batch jobs with no server at all; vLLM's docs call that "offline inference", meaning no web server, not no internet.</p>
        <p class="lead"><b>Not for:</b> one person on a laptop (a local runner), small traffic, or traffic that comes in short bursts, with no data rule (a hosted API), or a task that needs a stronger model than you may run yourself.</p>
        <p class="lead"><b>Costs:</b> GPUs paid for even when idle, tuning against load tests, monitoring, and in a closed network every upgrade carried in by hand.</p>
        <p class="task">Which team should reach for vLLM?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(FB[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["An insurer must label two million old claim letters with an open model, once, over a weekend, on its own GPUs. Nobody waits for a single answer.", true,
      "Yes. Batching pays off most when you have a mountain of prompts: vLLM's offline inference takes a whole list of prompts and keeps the GPU full with no web server at all.",
      "There are no users, but there are two million prompts. Batching is about filling each step with many requests, and a pile of letters fills it best. vLLM runs such a batch job directly, without a server."],
    ["A mobile game wants a small model running on each player's phone, so it works in airplane mode.", false,
      "No. vLLM is a server engine, built for Linux machines, not something that runs inside a phone app. And its win, many users sharing one GPU's weight reads, does not exist when each phone serves one player. This needs a small model with an on-device runtime.",
      "Right, no. vLLM is a server engine for Linux machines, not a library inside a phone app, and batching gains nothing when each device serves exactly one player. A small model with an on-device runtime fits."],
    ["A call centre with 300 agents wants live reply suggestions from an open model during calls. Call transcripts may not leave the company.", true,
      "Yes. Hundreds of people asking in the same minutes, data that must stay inside: one GPU server with continuous batching can carry them. Load-test it at the busiest hour first.",
      "Three hundred agents at once is exactly the many-users case, and the transcripts must stay inside, so a hosted API is out. A vLLM server, tuned with a load test at the peak hour, fits."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>vLLM, or not?</h1>
        <p class="lead">Three situations away from the engineering firm.</p>
        <p class="task">For each one, decide if serving the model with vLLM is the right call.</p>
        ${CASES.map(([q, y, yes, no], i) => { const right = y ? 0 : 1, ok = ans[i] === right; return `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(kit.esc(ok ? (y ? yes : no) : (y ? no : yes)), ok)}</div>`; }).join("")}`;
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
    el.innerHTML = `<h1>One GPU, a whole office</h1>
      <p class="lead">vLLM is a serving engine: it runs an open model on GPUs you control and answers many users at once through an OpenAI-style API.</p>
      <p class="lead">You read a load test and found where it saturates, then traced the ceiling to a memory setting. You saw why one step for many users costs little more than for one (batching), why blocks handed out as tokens arrive fit more requests than reserving the maximum (the paged KV cache), and how requests join and leave at every step (continuous batching). You know the three flags that set how many people one server takes, and that tuning moves the limit somewhere else. For a closed network you can list what to bring in, and you found a wheelhouse built for the wrong machine.</p>
      <p class="lead">This lesson was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You now run models yourself; next you hand a task to a coding agent and decide what it needs to finish without you.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Serving many users with vLLM, even offline",
    checked: "2026-11-14",
    sources: [
      "https://docs.vllm.ai/en/latest/",
      "https://docs.vllm.ai/en/latest/configuration/engine_args.html",
      "https://docs.vllm.ai/en/latest/configuration/optimization.html",
      "https://docs.vllm.ai/en/latest/getting_started/quickstart.html",
      "https://docs.vllm.ai/en/latest/getting_started/installation/gpu.html",
      "https://docs.vllm.ai/en/latest/serving/online_serving/",
      "https://docs.vllm.ai/en/latest/deployment/docker.html",
      "https://docs.vllm.ai/en/latest/usage/usage_stats.html",
      "https://docs.vllm.ai/en/latest/design/paged_attention.html",
      "https://arxiv.org/abs/2309.06180",
      "https://huggingface.co/docs/huggingface_hub/package_reference/environment_variables",
      "https://pip.pypa.io/en/stable/cli/pip_download/",
      "https://docs.docker.com/reference/cli/docker/image/save/"
    ],
    interview: [{
      q: "Your company's self-hosted model server answers in a few seconds all day, but at 9 a.m. answers take a minute. The GPU is not out of memory. How do you find and fix the bottleneck?",
      good: [
        "Run a load test: send at rising rates and find where finished per second stops following sent; that is the saturation point",
        "Check how many requests run at once and whether requests get preempted: a small KV cache or a low max-num-seqs caps the batch",
        "Raise gpu-memory-utilization so more memory goes to the KV cache, then raise max-num-seqs if the cap is hit, and retest",
        "Know the trade-off: bigger batches mean more answers per second but each step is slower for every user",
        "Past one GPU's limit, split the model with tensor parallelism or add a second server behind a load balancer"
      ],
      weak: "Buy a bigger GPU or a bigger model server without measuring. That misses that more than half the card may be unused because of one setting, and that the limit moves after each fix."
    }, {
      q: "You must deploy an open model with vLLM in a network with no internet access. What do you bring in, and how do you know you have everything?",
      good: [
        "The packages built for the server's own system: wheels downloaded with the server's platform and Python version, or the Docker image saved to a file",
        "The model folder with weights and tokenizer, served by its local path instead of a Hub name",
        "Settings that stop calls out: HF_HUB_OFFLINE=1, VLLM_NO_USAGE_STATS=1, and the offline docs flag",
        "Rehearse the whole install on a machine with the network cut, and read the logs for any request that tried to go out"
      ],
      weak: "Copy pip install vllm onto the server and download the model by name. Both reach the internet, and a wheelhouse built on a laptop may not fit the server."
    }],
    screens: [nineOClock, loadTest, whyBatch, pagedKv, admitCode, tune, installLog, brokenWheels, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['#rows [data-i="0"]'], right: [`#rows [data-i="${SAT}"]`, '#cfg [data-i="1"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#p1 [data-wrong]"], right: ["#p1 [data-right]", "#p2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(TRACE.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="3"]'], right: LOG.map((l, i) => l.net ? `[data-i="${i}"]` : null).filter(Boolean) },
      { wrong: ['[data-i="4"]'], right: [`[data-i="${P3_OUT.length + WHEELHOUSE.findIndex(w => w.startsWith("jiter-"))}"]`, "#f [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
