/* Lesson s7-readme-decisions: Write a README with its design decisions.
   Story: an engineering lead screens forty applicant repositories between meetings; in the interview she opens
   one, a garden-centre plant-care retrieval repo ("plant-desk"), and asks why it uses a reranker instead of a
   larger top-k.
   Ideas: (1) reviewer order: the problem, a measured result and how to run it fit in the first screen; the
   picture, the decisions and the limits follow; (2) a design decision is written as the choice, the option you
   rejected, the measured reason, the cost, and when you would change your mind.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s7-readme-decisions/weak-readme.json (a small hosted
     model wrote a README from the file list) and decisions.json (the same model wrote a "Design decisions"
     section from the measured facts; it stopped at max_tokens, finish_reason "length");
   - docs/ai-path/runs/s7-readme-decisions/measured.py + measured.out.txt: the numbers the README quotes,
     computed from lesson s5a-rerankers' real runs (retrieve.out.txt, timing.out.txt, sheets.py);
   - docs/ai-path/runs/s7-readme-decisions/rerank_depth.py + rerank_depth.out.txt: reranking only the top 40
     (the depth whose time the README quotes) gives the same ranks as reranking all 45, so 19 of 20 holds;
   - docs/ai-path/runs/s7-readme-decisions/check.py + check.out.txt: the from-scratch first-screen check, traced
     line by line on good_readme.md and run on the recorded weak README (weak_readme.md).
   Lesson-local style: a README block with line numbers (.lx-s7-readme-decisions-*), see ensureStyle(). */
(() => {
  const ID = "s7-readme-decisions";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s7-readme-decisions/measured.out.txt
  const M = {
    questions: 20, chunks: 45,
    top1Search: 17, top1Rerank: 19, top3Search: 19, top3Rerank: 19, top5Search: 20, top5Rerank: 20,
    worstSearch: 5, worstRerank: 4,
    indexMs: 271.0, searchMs: 3.1, rerankMs: { 5: 37.6, 10: 79.4, 20: 134.1, 40: 312.2 }
  };
  const RERANK_K = 40; // the timing the README quotes: reranking 40 chunks
  const SCREEN_LINES = 20; // check.py SCREEN_LINES: the lesson's assumption for one screen, not a measured fact

  // From docs/ai-path/recordings/s7-readme-decisions/weak-readme.json (the whole answer, not altered)
  const REC_WEAK = {
    src: "s7-readme-decisions/weak-readme",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14",
    text: "```markdown\n# Plant Desk\n\nThis project provides a system for retrieving relevant plant care information based on user questions. It leverages two ONNX-exported Hugging Face models (a bi-encoder and a cross-encoder) to efficiently and accurately find the best answers from a collection of plant care sheets.\n\n## Features\n\n*   **Efficient Retrieval:** Utilizes a bi-encoder for initial candidate ranking and a cross-encoder for refined reordering, ensuring fast and accurate results.\n*   **Model Agnostic:** Runs ONNX exported models, avoiding the need for PyTorch installation.\n*   **Comprehensive Plant Care Data:** Includes a structured dataset of plant care information covering watering, feeding, pests, winter care, and common problems, along with staff-generated questions.\n*   **Performance Evaluation:** Provides tools to measure the timing of retrieval stages and evaluate the accuracy of the system.\n\n## Project Structure\n\n```\nplant-desk/\n  pyproject.toml        # Project dependencies: numpy, onnxruntime, tokenizers, huggingface-hub\n  plant_desk/\n    sheets.py           # The garden centre's plant-care sheets, chunked by section (watering, feeding, pests, winter, problems), and 20 staff questions, each with the one chunk that answers it.\n    models.py           # Runs two models without PyTorch, from their ONNX exports: the bi-encoder all-MiniLM-L6-v2 and the cross-encoder ms-marco-MiniLM-L6-v2.\n    retrieve.py         # Stage 1: the bi-encoder ranks every chunk by cosine similarity to the question. Stage 2: the cross-encoder reads (question, chunk) together and reorders the top candidates.\n    timing.py           # How long each stage takes on a laptop CPU.\n    evaluate.py         # Runs all 20 questions and prints where the right chunk lands, with and without the cross-encoder.\n  tests/\n    test_retrieve.py    # Unit tests for the retrieval functionality.\n```\n\n## Installation\n\n1.  **Clone the repository:**\n    ```bash\n    git clone https://github.com/your-username/plant-desk.git\n    cd plant-desk\n    ```\n\n2.  **Install dependencies:**\n    This project uses `pyproject.toml` for dependency management. You can install the dependencies using pip:\n    ```bash\n    pip install -r requirements.txt\n    ```\n    *(Note: If you have `poetry` installed, you can also use `poetry install`)*\n\n## Usage\n\n### Retrieving Plant Care Information\n\nThe core retrieval logic is handled by the `retrieve.py` script. You can use it to find the most relevant plant care chunk for a given question.\n\n```python\nfrom plant_desk.retrieve import PlantDeskRetriever\n\n# Initialize the retriever\nretriever = PlantDeskRetriever()\n\n# Define a question\nquestion = \"How often should I water my snake plant?\"\n\n# Retrieve the best matching chunk\nbest_chunk = retriever.retrieve(question)\n\nprint(f\"Question: {question}\")\nprint(f\"Best matching plant care chunk: {best_chunk}\")\n```\n\n### Evaluating Performance and Accuracy\n\nThe `evaluate.py` script runs through all 20 predefined staff questions and reports the ranking of the correct answer, both with and without the cross-encoder stage.\n\nTo run the evaluation:\n```bash\npython plant_desk/evaluate.py\n```\n\nThis will output information about how well the system performs on the test questions.\n\n### Timing Information\n\nThe `timing.py` script provides insights into how long each stage of the retrieval process takes on a typical laptop CPU.\n\nTo run the timing tests:\n```bash\npython plant_desk/timing.py\n```\n\n## Models\n\nThis project uses two ONNX exported models from Hugging Face:\n\n*   **Bi-encoder:** `all-MiniLM-L6-v2` - Used for initial fast ranking of all plant care chunks.\n*   **Cross-encoder:** `ms-marco-MiniLM-L6-v2` - Used for re-ranking the top candidates from the bi-encoder for improved accuracy.\n\nThese models are loaded and run using `onnxruntime`, eliminating the need for PyTorch.\n\n## Contributing\n\nContributions are welcome! Please feel free to open an issue or submit a pull request.\n\n## License\n\nThis project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.\n```"
  };
  // From docs/ai-path/recordings/s7-readme-decisions/decisions.json (trimmed with … , not altered)
  const REC_DEC = {
    src: "s7-readme-decisions/decisions",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14",
    text: "**Cross-Encoder for Reranking:** To further refine the search results and improve accuracy, a cross-encoder model (`ms-marco-MiniLM-L6-v2`) is employed. … While computationally more intensive, reranking a smaller set of top candidates (40 chunks in this case) is feasible and significantly boosts performance. The inclusion of the reranker improved the success rate from 17 out of 20 questions (search only) to 19 out of 20 questions, demonstrating its value in achieving higher precision. The reranking process for 40 chunks takes 312 ms. … This two-stage approach balances speed and accuracy, providing a fast initial retrieval followed by a more precise refinement."
  };
  const CAPTION = `Recorded model output, ${REC_WEAK.recordedAt}`;
  // check.py drops the ```markdown fence line the model put first and the closing fence line, nothing else
  const WEAK = (() => { const l = REC_WEAK.text.split("\n"); return l.slice(1, -1); })();

  // check.out.txt: first_screen_check on each README
  const CHECK = {
    good: { lines: 27, found: { result: 5, run: 9, decisions: 17 }, late: [] },
    weak: { lines: 99, found: { result: null, run: 70, decisions: null }, late: ["result", "run"] }
  };
  // The listing is first_screen_check from check.py, line for line (line 0 = def).
  const CODE = [
    "def first_screen_check(readme, screen_lines):",
    "    found = {\"result\": None, \"run\": None, \"decisions\": None}",
    "    for number, line in enumerate(readme.splitlines(), start=1):",
    "        if found[\"result\"] is None and re.search(r\"\\d+ of \\d+\", line):",
    "            found[\"result\"] = number",
    "        if found[\"run\"] is None and line.strip().startswith(RUN_COMMANDS):",
    "            found[\"run\"] = number",
    "        if found[\"decisions\"] is None and line.startswith(\"## Design decisions\"):",
    "            found[\"decisions\"] = number",
    "    late = [k for k in (\"result\", \"run\") if found[k] is None or found[k] > screen_lines]",
    "    return found, late"
  ];
  const RUN_COMMANDS = ["uv run ", "python ", "make "]; // check.py
  // Frames picked from check.out.txt (the good README): [line that just ran, number, line text, [result, run, decisions], late]
  const FRAMES = [
    [1, null, null, [null, null, null], null],
    [7, 1, "# plant-desk", [null, null, null], null],
    [4, 5, "Result: the right section comes first for 19 of 20 staff questions (17 of 20 without the reranker). Small test set: see Limits.", [5, null, null], null],
    [6, 9, "    uv run python -m plant_desk.evaluate", [5, 9, null], null],
    [8, 17, "## Design decisions", [5, 9, 17], null],
    [9, 27, "- Times are from one laptop CPU (Apple M1); search and rerank times are medians of 15 runs.", [5, 9, 17], []],
    [10, 27, "- Times are from one laptop CPU (Apple M1); search and rerank times are medians of 15 runs.", [5, 9, 17], []]
  ];

  /* ---------- The rewritten README (good_readme.md), built from the measured numbers ---------- */
  const ms = v => `${Math.round(v)} ms`;
  const MISS_N = M.top5Search - M.top1Rerank; // questions the top 5 holds but reranked top 1 does not
  const MISSES = MISS_N === 1 ? "the one miss" : `the ${MISS_N} misses`;
  const GOOD = [
    "# plant-desk",
    "",
    "Answers garden-centre staff questions from the centre's own plant-care sheets, by finding the one section that answers the question.",
    "",
    `Result: the right section comes first for ${M.top1Rerank} of ${M.questions} staff questions (${M.top1Search} of ${M.questions} without the reranker). Small test set: see Limits.`,
    "",
    "Run the evaluation (no API key, runs on a laptop CPU):",
    "",
    "    uv run python -m plant_desk.evaluate",
    "",
    "## How it works",
    "",
    `    question -> search: bi-encoder, cosine over all ${M.chunks} chunks (${M.searchMs} ms)`,
    `             -> rerank: cross-encoder reads question + chunk together (top ${RERANK_K})`,
    "             -> the top section goes into the answer prompt",
    "",
    "## Design decisions",
    "",
    `- Reranker, not a larger top-k. Search alone had the right section in its top 5 for ${M.top5Search} of ${M.questions} questions; after reranking it is first for ${M.top1Rerank} of ${M.questions}. I send one section, not five, to keep the prompt short, and accept ${MISSES} that 5 chunks would catch. Cost: reranking the top ${RERANK_K} chunks took ${ms(M.rerankMs[RERANK_K])}. Revisit if answers from 5 chunks turn out better.`,
    `- NumPy array, not a vector database. With ${M.chunks} chunks, one search (embed the question, compare with every vector) takes ${M.searchMs} ms. A database adds a service to run and gains nothing here. Revisit when search gets slow.`,
    `- Local ONNX models, not a hosted embedding API. A reviewer reruns everything with no key and no cost; embedding all ${M.chunks} chunks took ${ms(M.indexMs)}. Revisit if a hosted model ranks clearly better on the ${M.questions} questions.`,
    "",
    "## Limits",
    "",
    `- ${M.questions} questions: one question moves the score by ${100 / M.questions} points, so ${M.top1Search} vs ${M.top1Rerank} is ${M.top1Rerank - M.top1Search} questions.`,
    "- Answer quality with one section vs five is not measured yet.",
    "- Times are from one laptop CPU (Apple M1); search and rerank times are medians of 15 runs."
  ];

  /* ---------- Derived ---------- */
  const weakHead = h => WEAK.findIndex(l => l === h) + 1; // 1-based line of a heading in the weak README
  const firstSentence = s => (s.match(/^.*?\.(\s|$)/) || [s])[0].trim();
  const after = h => WEAK[weakHead(h)] === "" ? WEAK[weakHead(h) + 1] : WEAK[weakHead(h)];
  const GAIN = M.top1Rerank - M.top1Search;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-doc { margin: 14px 0 0; border: 1px solid var(--line); background: var(--surface); padding: 8px 0; font: 500 13.5px/1.55 var(--mono); }
      .lx-${ID}-ln { display: grid; grid-template-columns: 2.6em 1fr; gap: 0 8px; padding: 0 10px 0 0; }
      .lx-${ID}-ln i { font-style: normal; color: var(--faint); text-align: right; user-select: none; }
      .lx-${ID}-ln span { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-ln.lx-${ID}-on { box-shadow: inset 3px 0 0 var(--ink); background: var(--sunk); }
      .lx-${ID}-fold { padding: 4px 10px 0 calc(2.6em + 8px); color: var(--muted); font-family: var(--font); font-size: 13.5px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-quote { margin: 14px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font-size: 15.5px; line-height: 1.55; }
      .lx-${ID}-order { margin: 14px 0 0; padding: 0; list-style: none; counter-reset: lxo; border-top: 1px solid var(--line); }
      .lx-${ID}-order li { counter-increment: lxo; display: grid; grid-template-columns: 2em 1fr; gap: 0 8px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-order li::before { content: counter(lxo); font: 600 14px/1.45 var(--mono); color: var(--muted); }
      .lx-${ID}-tag { font: 600 12.5px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-left: 6px; }
      .lx-${ID}-card b { display: block; }
      .lx-${ID}-card small { display: block; color: var(--muted); font-size: 13.5px; line-height: 1.4; margin-top: 2px; }
      .lx-${ID}-opt { text-align: left; }
      @media (max-width: 640px) { .lx-${ID}-code .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; } }
    `;
    document.head.appendChild(s);
  }
  // lines: array of strings; first: the line number of lines[0]; on: a line number to mark
  function doc(kit, lines, { first = 1, on = null, fold = "" } = {}) {
    return `<div class="lx-${ID}-doc">${lines.map((t, j) => `<div class="lx-${ID}-ln${first + j === on ? ` lx-${ID}-on` : ""}"><i>${first + j}</i><span>${kit.esc(t) || " "}</span></div>`).join("")}${fold ? `<div class="lx-${ID}-fold">${fold}</div>` : ""}</div>`;
  }
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const opt = (kit, s) => `<span class="lx-${ID}-opt">${s}</span>`;

  /* 1. The situation: what does the first screen of the recorded README tell the lead? */
  function firstScreen({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const runAt = CHECK.weak.found.run;
    const opts = [
      "What the project does, and that it is accurate",
      "How to run it",
      "Roughly what it does and how its files are laid out, but not whether it works, and not how to run it",
      "How well it works compared with simpler search"
    ];
    const RIGHT = 2;
    const fb = [
      ["“Accurately” is a claim, not a result. Nothing in these lines says how often it finds the right answer, or on what test. A reviewer reads an adjective with no number as “not measured”.", false],
      [`No run command appears in these ${SCREEN_LINES} lines. The first one is on line ${runAt} of ${CHECK.weak.lines}, far below what she reads before deciding.`, false],
      [`Right. She learns the topic and the file tree, and nothing she can judge: no number, no command (the first one is on line ${runAt}), no picture of how it works. Between meetings, that repo goes on the “maybe later” pile.`, true],
      ["Nothing here compares it with anything. The words “efficiently and accurately” are not a comparison; a comparison needs two numbers on the same test.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Forty repos between meetings</h1>
        <p class="lead">An engineering lead is hiring a mid-level AI engineer. Between meetings she opens forty applicant repositories. For each one she reads the first screen of the README, then decides whether to read on. So the README, not the code, is the first part of your project that gets judged. One applicant built <b>plant-desk</b>: the garden-centre search from the reranker lesson, which finds the plant-care section that answers a staff question. He asked a small hosted model to write the README from the file list. These are its first ${SCREEN_LINES} lines:</p>
        ${doc(kit, WEAK.slice(0, SCREEN_LINES), { fold: `… ${CHECK.weak.lines - SCREEN_LINES} more lines below` })}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="task">What can the lead tell from this screen?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand: reorder the blocks into reviewer order. */
  const CARDS = [
    { id: "problem", name: "Title and the problem it solves", from: "# Plant Desk", ex: () => firstSentence(after("# Plant Desk")) },
    { id: "features", name: "Features", from: "## Features", ex: () => after("## Features") },
    { id: "structure", name: "Project structure (file tree)", from: "## Project Structure", ex: () => "plant-desk/ pyproject.toml plant_desk/ …" },
    { id: "run", name: "Installation and usage", from: "## Installation", ex: () => `pip install -r requirements.txt … python plant_desk/evaluate.py` },
    { id: "models", name: "Models", from: "## Models", ex: () => firstSentence(after("## Models")) },
    { id: "legal", name: "Contributing and license", from: "## Contributing", ex: () => firstSentence(after("## License")) },
    { id: "result", name: "Result: a measured number and the test it came from", missing: true },
    { id: "how", name: "How it works: a small picture of the stages", missing: true },
    { id: "decisions", name: "Design decisions: chosen, rejected, why", missing: true },
    { id: "limits", name: "Limits: what the number does not show", missing: true }
  ];
  const ORDER = ["problem", "result", "run", "how", "decisions", "limits"];
  const why = (id, pos) => ({
    problem: "",
    features: "The feature list makes claims (“fast and accurate results”) with nothing behind them. The Result block is what proves them; after it, this list adds little. It can go.",
    structure: "A file tree helps someone who has already decided to read the code. It answers none of the lead's first questions, so it goes near the bottom.",
    run: pos === 0 ? "How to run it matters once she wants to run it. First she needs to know what it is for." : "Close. But she runs it only if she believes it works, so the number comes before the commands.",
    models: "The model names belong inside “How it works”: they name the boxes in the picture. On their own, near the top, they say what was used, not what it achieves.",
    legal: "Needed, but nobody judges a repo by its license line. It goes at the bottom.",
    result: "A number means nothing until she knows what problem it measures. One sentence of problem first.",
    how: "The picture is for a reader who is already interested. Before it: what it is, how well it works, how to run it.",
    decisions: "Decisions answer “why this way?”. She asks that only after she knows what it is, how well it works and how it is built.",
    limits: "Limits build trust, but a limit needs a claim to limit. They come after the decisions, and the Result line can point to them."
  }[id]);
  function reorder({ el, done, kit }) {
    ensureStyle();
    let placed = [], wrong = null;
    const missingN = CARDS.filter(c => c.missing).length;
    const hadN = ORDER.filter(id => !CARDS.find(c => c.id === id).missing).length;
    const paint = () => {
      const fin = placed.length === ORDER.length;
      const left = CARDS.filter(c => !placed.includes(c.id));
      const card = c => `<span class="lx-${ID}-card lx-${ID}-opt"><b>${kit.esc(c.name)}${c.missing ? `<span class="lx-${ID}-tag">missing</span>` : ""}</b>${c.missing ? "" : `<small>${kit.esc(c.ex())}</small>`}</span>`;
      const right = fin ? null : left.findIndex(c => c.id === ORDER[placed.length]);
      el.innerHTML = `<h1>Put the blocks in reviewer order</h1>
        <p class="lead">Below are the blocks of the recorded README, each with a line from it, plus ${missingN} blocks it does not have (marked missing). A reviewer reads top down and stops when she stops trusting it. <b>Reviewer order</b> puts first the blocks that answer her questions, in the order she asks them. Build the top ${ORDER.length} blocks, one at a time.</p>
        ${fin ? "" : `<p class="task">Pick block ${placed.length + 1} of ${ORDER.length}: what should she read ${placed.length ? "next" : "first"}?</p>`}
        ${placed.length ? `<ol class="lx-${ID}-order">${placed.map(id => { const c = CARDS.find(x => x.id === id); return `<li><span>${kit.esc(c.name)}${c.missing ? `<span class="lx-${ID}-tag">missing</span>` : ""}</span></li>`; }).join("")}</ol>` : ""}
        <div class="lpanel">${fin
          ? kit.feedback(`That is reviewer order. The first three fit in one screen: <b>what it is, how well it works, how to run it</b>. Then the picture, the decisions and the limits for the reader who stayed. The rest (models inside “How it works”, file tree, contributing, license) goes below, and the feature list can go. Of these ${ORDER.length} blocks the recorded README had ${hadN}, and ${ORDER.length - hadN} were missing. Its install step even says <code>pip install -r requirements.txt</code>, and the repo has no requirements.txt, only pyproject.toml. A reviewer who tries it stops there.`, true)
          : `${kit.options(left.map(card), { picked: wrong == null ? null : left.findIndex(c => c.id === wrong), correct: right })}${wrong ? kit.feedback(why(wrong, placed.length), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const c = left[+b.dataset.i];
        if (c.id !== ORDER[placed.length]) { wrong = c.id; paint(); return; }
        placed.push(c.id); wrong = null; paint();
        if (placed.length === ORDER.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the recorded decisions section does not answer the lead's question. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "“…reranking a smaller set of top candidates … is feasible and significantly boosts performance.”",
      `“The inclusion of the reranker improved the success rate from ${M.top1Search} out of ${M.questions} questions (search only) to ${M.top1Rerank} out of ${M.questions} questions…”`,
      "“This two-stage approach balances speed and accuracy…”",
      "None of them: it never names the option that lost, or why it lost"
    ];
    const RIGHT = 3;
    const fb = [
      [`“Significantly” is a word, not a reason. The gain is ${plural(GAIN, "question")} out of ${M.questions}, and nothing here compares the reranker with a larger top-k.`, false],
      ["That compares the reranker with no reranker at all. Her question is about a different option: send more chunks to the model and skip the reranker. Nothing here says how that option did.", false],
      ["Every two-stage system “balances speed and accuracy”. The sentence would be just as true of a system that made the opposite choice, so it explains nothing.", false],
      [`Right. The section says what was chosen and praises it. A <b>design decision</b> a reviewer trusts has five parts: the <b>choice</b>, the <b>option you rejected</b>, the <b>reason</b> with a number, the <b>cost</b> you accepted, and <b>when you would change your mind</b>. Without the rejected option there is no decision on the page, only a description.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>“Why a reranker, not a larger top-k?”</h1>
        <p class="lead">The applicant made the interview list. To prepare, he gave the same small model the measured facts and asked it for a “Design decisions” section. The facts: ${M.chunks} chunks, ${M.questions} questions, the times, and the right section first for ${M.top1Search} of ${M.questions} without the reranker, ${M.top1Rerank} of ${M.questions} with it. Here is the part about the reranker:</p>
        <div class="lx-${ID}-quote">${kit.esc(REC_DEC.text)}</div>
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="lead">In the interview the lead opens the repo and asks: <i>why a reranker instead of a larger top-k?</i> Top-k is how many search results go into the answer prompt.</p>
        <p class="task">Which sentence answers her question?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Use it: predict the number that decides, then write the reranker decision. */
  function rerankDecision({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null;
    const pOpts = [M.top3Search - 7, M.top1Search, M.top5Search];
    const P_RIGHT = pOpts.indexOf(M.top5Search);
    const sOpts = [
      `“The reranker significantly improves accuracy (${M.top1Search} → ${M.top1Rerank} of ${M.questions}).”`,
      `“A larger top-k would miss the right section, so a reranker was needed.”`,
      `“A larger top-k works too: search alone had the right section in its top 5 for ${M.top5Search} of ${M.questions}. Reranked, it is first for ${M.top1Rerank} of ${M.questions}. I send one section to keep the prompt short and accept ${MISSES}. Cost: ${ms(M.rerankMs[RERANK_K])} to rerank ${RERANK_K} chunks. Not measured yet: whether answers from 5 chunks are better.”`,
      "“Rerankers are best practice for retrieval systems.”"
    ];
    const S_RIGHT = 2;
    const sFb = [
      `Two problems. ${plural(GAIN, "question")} out of ${M.questions} is too few to call significant. And it compares with no reranker, not with the option she asked about.`,
      `The run says the opposite: search alone had the right section in its top 5 for ${M.top5Search} of ${M.questions}. A reviewer who reruns the evaluation would catch this.`,
      "",
      "That is a claim about everyone's systems, with no evidence from this one. She asked why <i>you</i> chose it."
    ];
    const paint = () => {
      const q = stage === 0
        ? `<p class="task">Predict first. With search alone (no reranker), for how many of the ${M.questions} questions was the right section somewhere in the top 5?</p>`
        : stage === 1 ? `<p class="task">Now pick the decision line for the README.</p>` : "";
      const body = stage === 0
        ? `${kit.options(pOpts.map(String), { picked: wrong == null ? null : wrong, correct: P_RIGHT, num: true })}${wrong != null ? kit.feedback(pOpts[wrong] < M.top1Search ? `Lower than the measured top-1 count (${M.top1Search} of ${M.questions}). Widening the window from 1 to 5 can only add questions, never lose them.` : `${M.top1Search} is the top-1 count. The top 5 keeps those ${M.top1Search} and adds every question whose right section the search ranked 2 to 5, so the count can stay or grow. Here it grew.`, false) : ""}`
        : `${kit.feedback(`Measured: <b>${M.top5Search} of ${M.questions}</b>. The worst rank of the right section, search only, was ${M.worstSearch}. So a larger top-k is a real option: it would put the right section in the prompt every time. The reranker puts it <b>first</b> for ${M.top1Rerank} of ${M.questions}, so the prompt can carry one section instead of ${M.worstSearch}. The price: for ${plural(MISS_N, "question")}, the first section is wrong, though the top 5 had the right one.`)}
           ${kit.table([["search only, right section first", `${M.top1Search} of ${M.questions}`], ["search only, in the top 5", `${M.top5Search} of ${M.questions}`], ["reranked, right section first", `${M.top1Rerank} of ${M.questions}`], ["one search (median)", `${M.searchMs} ms`], [`rerank ${RERANK_K} chunks`, ms(M.rerankMs[RERANK_K])]], { head: ["measured", "value"], title: "plant-desk evaluation" })}
           ${stage === 1 ? `${kit.options(sOpts.map(s => opt(kit, kit.esc(s))), { picked: wrong, correct: S_RIGHT })}${wrong != null ? kit.feedback(sFb[wrong], false) : ""}`
           : `<div class="lx-${ID}-quote">${kit.esc(sOpts[S_RIGHT])}</div>` + kit.feedback("Right. It names the rejected option and is fair to it (the top 5 even catches one more question). It says why you still chose the reranker, states both prices (a miss and the time), and says what you have not measured. In the interview you can defend every word, and the last sentence tells the lead what test would change your mind.", true)}`;
      el.innerHTML = `<h1>Write the reranker decision</h1>
        <p class="lead">A decision line must stay true when the lead reruns your evaluation. Start from what the run measured.</p>
        ${q}
        <div class="lpanel">${body}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (stage === 0) { if (i !== P_RIGHT) { wrong = i; paint(); return; } stage = 1; wrong = null; paint(); return; }
        if (i !== S_RIGHT) { wrong = i; paint(); return; }
        stage = 2; wrong = null; paint(); done();
      });
    };
    paint();
  }

  /* 5. By hand: for two more choices, pick the rejected option and its reason. */
  const MORE = [
    { choice: `Search: keep the ${M.chunks} vectors in a NumPy array and compare each question with all of them`, right: 0,
      opts: [
        `Rejected: a vector database. With ${M.chunks} chunks, one search that compares with every vector took ${M.searchMs} ms; a database is one more service every reviewer must run. Revisit when search gets slow.`,
        "Rejected: a vector database, because databases are slower than NumPy.",
        "Rejected: a bigger embedding model, because it costs more."
      ],
      fb: [null,
        `Nothing was measured on a database, so you cannot claim it is slower. At larger sizes, the index a vector database builds is usually what makes search fast. The honest reason here is size: ${M.chunks} chunks, ${M.searchMs} ms already.`,
        "That is a different decision (which model makes the vectors), not how they are searched. Each decision line names the option that competed for the same job."] },
    { choice: "Models: run both models locally from their ONNX files", right: 1,
      opts: [
        "Rejected: a hosted embedding API, because hosted models are worse.",
        `Rejected: a hosted embedding API. A reviewer reruns everything with no key and no cost; embedding all ${M.chunks} chunks took ${ms(M.indexMs)} on a laptop. Revisit if a hosted model ranks clearly better on the ${M.questions} questions.`,
        "Rejected: PyTorch, because it is slow."
      ],
      fb: [
        "Nothing in the repo compared a hosted model, so “worse” is a guess. If you have not measured it, say so, and say what result would make you switch.",
        null,
        "No run in the repo timed PyTorch, so “slow” is not backed by anything. A decision line states only what you can show, or marks it as not measured."] }
  ];
  function moreDecisions({ el, done, kit }) {
    ensureStyle();
    const ans = MORE.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Two more decisions</h1>
        <p class="lead">Every decision line has the same shape: <b>choice, the option that lost, the reason with a number, the cost, when you would revisit</b>. The lead may ask about any of them.</p>
        <p class="task">For each choice, pick the line you would put in the README.</p>
        ${MORE.map((d, i) => `<div class="lcase" id="c${i}"><p><b>${kit.esc(d.choice)}</b></p>${kit.options(d.opts.map(s => opt(kit, kit.esc(s))), { picked: ans[i], correct: d.right })}${ans[i] == null ? "" : ans[i] === d.right ? kit.feedback("Right: a real competitor for the same job, a measured reason, and a condition for changing your mind.", true) : kit.feedback(d.fb[ans[i]], false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (MORE.every((d, j) => ans[j] === d.right)) done();
      }));
    };
    paint();
  }

  /* 6. From scratch: a first-screen check in Python, stepped on the rewritten README. */
  const fstr = f => `{result: ${f[0] == null ? "None" : f[0]}, run: ${f[1] == null ? "None" : f[1]}, decisions: ${f[2] == null ? "None" : f[2]}}`;
  const sayFrame = (kit, f, i) => {
    const [ln, num, , fd, late] = f;
    if (i === FRAMES.length - 1) return `The function returns. Result on README line ${fd[0]}, run command on line ${fd[1]}, both inside the first ${SCREEN_LINES} lines, so <code>late</code> is empty. Decisions start on line ${fd[2]}, below the first screen, which is fine: they are for the reader who stayed.`;
    if (ln === 1) return "<code>found</code> starts empty: no line has matched yet. The loop will read the README one line at a time, counting from 1.";
    if (ln === 7) return `Line ${num} is the title. None of the three tests match it, so <code>found</code> stays empty and the loop moves on.`;
    if (ln === 4) return `Line ${num} contains “${M.top1Rerank} of ${M.questions}”, which matches the pattern <i>a number, “of”, a number</i>. The result is on line ${num}.`;
    if (ln === 6) return `Line ${num}, after its indent is stripped, starts with <code>uv run</code>, one of the run commands. Found on line ${num}.`;
    if (ln === 8) return `Line ${num} is the Design decisions heading. All three are found now; the loop reads the rest without changing anything.`;
    if (ln === 9) return `After the last README line (${num}), the <code>late = …</code> line lists the blocks that are missing or start after line ${SCREEN_LINES}. None.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FRAMES[i];
      el.innerHTML = `<h1>A first-screen check, from scratch</h1>
        <p class="lead">Before you push, a few lines of Python can check your README's first screen. This function records the first line with a result (“N of M”), a run command (a line starting with one of <code>RUN_COMMANDS</code>: ${RUN_COMMANDS.map(c => `<code>${kit.esc(c.trim())}</code>`).join(", ")}) and the decisions heading. It returns those line numbers, and a list <code>late</code> of the blocks that are missing or start below the first screen. Here it reads the rewritten plant-desk README. We take <code>screen_lines = ${SCREEN_LINES}</code> as one screen.</p>
        <p class="task">Step through to the end. Watch which README line fills each slot.</p>
        <div class="lx-${ID}-code">${kit.code(CODE, f[0])}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>number <b>${f[1] == null ? "–" : f[1]}</b></span><span>found <b>${fstr(f[3])}</b></span><span>late <b>${f[4] == null ? "–" : `[${f[4].join(", ")}]`}</b></span><span>frame <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${f[1] ? doc(kit, [GOOD[f[1] - 1]], { first: f[1], on: f[1] }) : ""}
        ${kit.feedback(sayFrame(kit, f, i))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
    };
    paint();
  }

  /* 7. Predict the check's answer on the recorded weak README. */
  function predictWeak({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const W = CHECK.weak;
    const show = (f, late) => `found = ${fstr([f.result, f.run, f.decisions])}<br>late = [${late.join(", ")}]`;
    const opts = [
      show({ result: null, run: null, decisions: null }, ["result", "run"]),
      show(W.found, W.late),
      show({ result: weakHead("## Features") + 2, run: W.found.run, decisions: null }, ["run"]),
      show(W.found, ["run"])
    ];
    const RIGHT = 1;
    const fb = [
      [`There is a run command, just late: line ${W.found.run} is <code>python plant_desk/evaluate.py</code>. <code>pip install</code> and <code>git clone</code> lines do not count; they are not in the list of run commands.`, false],
      [`Right, that is what the run printed. No line has “N of M” anywhere in ${W.lines} lines (“20 predefined staff questions” is a count, not a result), the first run command is on line ${W.found.run}, and there is no decisions heading. Note what the check cannot see: it finds a command, not whether the command works. The missing requirements.txt still needs a human, or a fresh clone where you follow your own README.`, true],
      ["“Ensuring fast and accurate results” has no number in it at all. A result needs a measurement and the test it came from.", false],
      [`The run command on line ${W.found.run} is late, but so is the result: it is missing. <code>found["result"] is None</code> also puts it in <code>late</code>.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Run it on the recorded README</h1>
        <p class="lead">Same function, now on the ${W.lines}-line README the model wrote, the one you read at the start of this lesson.</p>
        <div class="lx-${ID}-code">${kit.code(CODE, ans === RIGHT ? 10 : -1)}</div>
        <p class="task">Predict what <code>first_screen_check(weak_readme, ${SCREEN_LINES})</code> returns.</p>
        <div class="lpanel">${ask(kit, opts.map(s => opt(kit, `<code>${s}</code>`)), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The license line", "The result and the numbers in the decisions", "The title"];
    const RIGHT = 1;
    const fb = [
      ["The license does not depend on how retrieval works. It stays true.", false],
      [`Right. Every number in the README is a copy of an evaluation run, and copies go stale silently. Generate them: let the evaluate command print the lines, paste its output, and rerun it before every push. A stale “${M.top1Rerank} of ${M.questions}” that a reviewer cannot reproduce costs more trust than no number.`, true],
      ["The title names the project, not its numbers. It stays true when the chunking changes.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to write a README this way</h1>
        <p class="lead"><b>For:</b> getting a stranger from “what is this?” to “I trust it and can run it” in one screen, and having your interview answers already written.</p>
        <p class="lead"><b>Reach for it</b> when someone must judge the work: a portfolio, a take-home, an internal tool others must approve.</p>
        <p class="lead"><b>Not</b> for a library's README: its users already chose it and want install and a quick start first. And not as the only home of a team's decisions, because those change over time. For a team, write one short architecture decision record (ADR) per choice. When a later choice replaces it, keep it and mark it “superseded”.</p>
        <p class="lead"><b>Costs:</b> an evening of writing, and upkeep: every number must be rerun when the code changes.</p>
        <p class="task">Next month you change how the sheets are split into chunks. Which part of the rewritten plant-desk README stops being true first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it: lead with problem, result, run and decisions, or not? */
  const CASES = [
    ["A take-home task for an AI engineer job: classify support emails, submitted as a repository the panel will read before the interview.", true,
      "Yes. A panel is judging it, and the interview will ask why you chose what you chose. Problem, measured result, one run command, then the decisions and limits.",
      "Someone must judge this work and will ask “why?”. That is exactly the reader the order is for: the result and the decisions are what they came for."],
    ["The README of an open-source date-parsing library that thousands of projects already use.", false,
      "No. Its readers already chose it; they want to install it and call it in a minute. Lead with install and a short usage example. The design reasoning goes in separate docs, linked from the README.",
      "Its readers are users, not judges: they decided before opening the page. A result and a decisions section on top would push the install line and the example, the two things they came for, below the first screen."],
    ["Your team's search service. The retrieval setup changed three times this year, and new joiners keep asking why the old setups were dropped.", false,
      "No, not in the README alone. A README shows the current state, so each change overwrites the old reasoning, which is exactly what new joiners ask about. Keep one short decision record per choice (an ADR), mark replaced ones as superseded, and link them from the README.",
      "The problem here is history. A README section is rewritten each time, so the reason the old setup was dropped disappears. Separate decision records, kept when superseded, keep it."],
    ["A weekend project in your portfolio: a small model that tags recipe photos, with a measured accuracy on 200 held-out photos.", true,
      "Yes. A portfolio repo is read by strangers who are judging you. Lead with the problem and the measured accuracy, the test it came from, and how to run it.",
      "It is in a portfolio, so a reviewer will judge it in one screen, and you already have a measured number. That is what the first screen is for."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Reviewer order or not?</h1>
        <p class="lead">Four repositories. The question is whether to write the README in reviewer order: problem, measured result, how to run it, then the decisions with their rejected options.</p>
        <p class="task">Would you write each one that way? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. The interview follow-up: is the gain real? */
  function followUp({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const pts = 100 / M.questions;
    const opts = [
      `“Yes, it is ${GAIN * pts} points better: ${M.top1Search * pts}% to ${M.top1Rerank * pts}%.”`,
      `“It is ${plural(GAIN, "question")} out of ${M.questions}, so I would not call it proven. I kept the reranker for the shorter prompt, which holds either way. To settle it I would grow the question set and compare answers from one section and from five.”`,
      "“Yes, a cross-encoder is a stronger model than a bi-encoder, so the gain is real.”"
    ];
    const RIGHT = 1;
    const fb = [
      [`The percentages are right, but they hide the size of the test. With ${M.questions} questions, one question is ${pts} points, so the whole gain is ${plural(GAIN, "question")}. She asked whether it is real, and the honest answer is: not shown yet.`, false],
      ["Right. You say what the number can and cannot carry, you give the reason that does not depend on it, and you name the test that would change your mind. That is the same five-part decision, spoken.", true],
      [`That is a general belief, not evidence from this run. Even if it is usually true, ${plural(GAIN, "question")} out of ${M.questions} cannot show it here.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The follow-up question</h1>
        <p class="lead">You gave the lead the reranker decision from your README. She reads the Result line again: right section first for ${M.top1Rerank} of ${M.questions} with the reranker, ${M.top1Search} of ${M.questions} without. Then she asks: <i>is that gain real?</i></p>
        <p class="task">Which answer do you give?</p>
        <div class="lpanel">${ask(kit, opts.map(s => opt(kit, kit.esc(s))), RIGHT, ans, fb)}</div>
        ${ans === RIGHT ? `<p class="lead">The whole rewritten README, ${GOOD.length} lines:</p>${doc(kit, GOOD)}` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Your README now answers the interview</h1>
      <p class="lead">You put a recorded README into reviewer order (problem, result, how to run, then the picture, the decisions and the limits), wrote three decisions as choice, rejected option, measured reason, cost and when to revisit, and checked the first screen with ${CODE.length} lines of Python. Do the same for each of your three portfolio projects.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You now have repos a reviewer trusts; next you read the job post they are aimed at, and decide which project to put first.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Write a README with its design decisions",
    checked: "2026-11-14",
    sources: [
      "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes",
      "https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions",
      "https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html",
      "https://sbert.net/examples/sentence_transformer/applications/semantic-search/README.html",
      "https://docs.astral.sh/uv/reference/cli/#uv-run"
    ],
    interview: [
      {
        q: "Your RAG repo uses a reranker. Why not just send more search results to the model instead?",
        good: [
          "Say what you measured for both options: how often the right chunk is in the top k without reranking, and how often it is first with reranking",
          "Admit when the larger top-k works too, and give the reason you still chose the reranker, such as a shorter prompt",
          "State the cost you accepted: the extra time per question for reranking",
          "Say how big the test set was and what you have not measured yet",
          "Name the result that would make you switch"
        ],
        weak: "“Rerankers improve accuracy, it is best practice.” It names no rejected option, no number from this repo and no cost."
      },
      {
        q: "You have one screen to convince a reviewer that your project works. What goes on it, and what goes lower?",
        good: [
          "One sentence on the problem: who has it and what the system does",
          "One measured result, with the size of the test it came from",
          "One command that reruns the evaluation, with no paid key needed",
          "Lower: a small picture of the stages, the design decisions with rejected options, the limits",
          "At the bottom: file tree, contributing, license"
        ],
        weak: "Start with installation steps and a feature list. The reviewer learns how to install it before learning whether it works."
      }
    ],
    screens: [firstScreen, reorder, spotIdea, rerankDecision, moreDecisions, asCode, predictWeak, bigPicture, recognise, followUp, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(ORDER.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: MORE.map((_, i) => `#c${i} [data-right]`) },
      { right: Array(FRAMES.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: [] }
    ]
  });
})();
