/* Lesson s5c-gpu-memory: GPU memory and the KV cache: will it fit?
   Story: a three-person startup wants to run an open 7-billion-parameter model for its internal assistant and must
   pick one second-hand graphics card (12, 16 or 24 GB of memory). Will the model fit, and with what settings?
   Ideas: (1) the card must hold the weights: parameters x bytes per parameter (16 bits = 2 bytes, 4 bits = half a
   byte); (2) while it writes, the model also keeps the KV cache: for every token so far, a key and a value vector in
   every layer, so memory = weights + 2 x layers x kv_heads x head_dim x bytes x tokens x chats at once. A model whose
   key/value heads are shared by groups of query heads (grouped-query attention) keeps a much smaller cache.
   Depth: explain (screens 1-2, 4-6, 8-9), scratch (screens 3 and 7: plain Python and NumPy, real runs, stepped).
   Runs (no model downloaded, no API call): docs/ai-path/runs/s5c-gpu-memory/
     kv_cache.py -> kv_cache.out.txt (screen 3: a tiny 2-layer decoder that keeps a KV cache, traced; measured bytes)
     estimate.py -> estimate.out.txt (screens 1, 4-7: two real config.json files, model_a.config.json =
       allenai/OLMo-2-1124-7B and model_b.config.json = Qwen/Qwen2.5-7B-Instruct, fetched 2026-11-14; parameter totals
       from the Hugging Face model API; the traced will_it_fit function); env.txt.
   Every number on screen is computed here from MODEL_A, MODEL_B, ROUND_PARAMS, CARDS, KEEP_FREE, TRACE3, TRACE7 and
   HF_TEST. Lesson-local CSS and pictures (prefix lx-s5c-gpu-memory-): the worksheet table, the card bars (weights +
   cache against the card), the config excerpt. */
(() => {
  const P = "lx-s5c-gpu-memory-";
  const fmt = n => n.toLocaleString("en");
  const GB = 1e9;                                       // the lesson's gigabyte: a billion bytes
  const gb = (bytes, d = 2) => fmt(Number((bytes / GB).toFixed(d)));
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  // From docs/ai-path/runs/s5c-gpu-memory/estimate.out.txt (config.json fields; params = safetensors totals)
  const MODEL_A = { layers: 32, qHeads: 32, kvHeads: 32, hidden: 4096, maxTokens: 4096, params: 7298617344 };
  const MODEL_B = { layers: 28, qHeads: 28, kvHeads: 4, hidden: 3584, maxTokens: 32768, params: 7615616512 };
  const headDim = m => m.hidden / m.qHeads;
  const BYTES16 = 2;                                    // 16 bits = 2 bytes, for weights and for the cache
  const perToken = m => 2 * m.layers * m.kvHeads * headDim(m) * BYTES16;
  const weights = (params, bits) => params * bits / 8;
  const cacheBytes = (m, tokens, chats) => perToken(m) * tokens * chats;
  const ROUND_PARAMS = 7e9;                             // the "7B" on the model card, for the by-hand sums
  const CARDS = [12, 16, 24];                           // second-hand cards on offer, GB of memory
  const KEEP_FREE = 0.1;                                // the team's own rule: keep a tenth of the card free
  const usable = card => card * (1 - KEEP_FREE) * GB;
  const smallestCard = total => CARDS.find(c => total <= usable(c));   // undefined = none fits
  // Hugging Face guide (llm_tutorial_optimization): bigcode/octocoder (15.5 billion parameters, the guide's 2 x 15.5 rule)
  // in 4 bits printed 9.543574333190918 from bytes_to_giga_bytes, which divides by 1024 three times (GiB, not GB)
  const HF_TEST = { billions: 15.5, measuredGiB: 9.543574333190918 };
  const hfMeasuredBytes = HF_TEST.measuredGiB * 1024 ** 3;     // the same peak in bytes: about 10.25 of the lesson's GB

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}ws{width:100%;border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}
      .${P}ws th,.${P}ws td{border-bottom:1px solid var(--line);padding:7px 4px;text-align:right;vertical-align:top}
      .${P}ws th:first-child,.${P}ws td:first-child{text-align:left}
      .${P}ws th{color:var(--muted);font-weight:500;font-size:12px}
      .${P}ws td.now{outline:2px solid var(--ink);outline-offset:-2px}
      .${P}ws td.ok{color:var(--good)}
      .${P}ws .hid{color:var(--faint)}
      .${P}cfg{font-family:var(--mono);font-size:13px;background:var(--sunk);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;white-space:pre-wrap;word-break:break-word;color:var(--ink)}
      .${P}bars{margin:10px 0}
      .${P}row{display:grid;grid-template-columns:64px 1fr;gap:8px;align-items:center;margin:6px 0;font-size:13px;color:var(--ink-2)}
      .${P}track{position:relative;height:26px;border:1px solid var(--line);border-radius:4px;background:var(--surface);overflow:hidden}
      .${P}w{position:absolute;top:0;bottom:0;left:0;background:var(--ink-2)}
      .${P}c{position:absolute;top:0;bottom:0;background:var(--sunk);border:2px dashed var(--ink);box-sizing:border-box}
      .${P}over{position:absolute;top:0;bottom:0;background:var(--bad-soft);border:2px solid var(--bad);box-sizing:border-box}
      .${P}lim{position:absolute;top:0;bottom:0;width:0;border-left:2px dotted var(--ink)}
      .${P}key{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--muted);margin:4px 0 8px}
      .${P}key i{display:inline-block;width:18px;height:12px;vertical-align:middle;margin-right:5px;box-sizing:border-box}
      .${P}cap{font-size:12px;color:var(--muted);margin:2px 0}
      .${P}hid{color:var(--faint)}
    `;
    document.head.appendChild(s);
  }

  // The worksheet: the by-hand cells and what the calculator says for each.
  const SHEET = [
    { label: "Weights, 16 bits", hand: () => weights(ROUND_PARAMS, 16), exact: () => weights(MODEL_A.params, 16), unit: "gb" },
    { label: "Weights, 4 bits", hand: () => weights(ROUND_PARAMS, 4), exact: () => weights(MODEL_A.params, 4), unit: "gb" },
    { label: "Cache, one token", hand: () => perToken(MODEL_A), exact: () => perToken(MODEL_A), unit: "bytes" },
    { label: `Cache, one chat of ${fmt(MODEL_A.maxTokens)} tokens`, hand: () => cacheBytes(MODEL_A, MODEL_A.maxTokens, 1), exact: () => cacheBytes(MODEL_A, MODEL_A.maxTokens, 1), unit: "gb" }
  ];
  const show = (v, unit) => unit === "gb" ? `${gb(v)} GB` : `${fmt(v)} bytes`;
  function sheet(filled, now) {
    return `<table class="${P}ws"><thead><tr><th>worksheet</th><th>your answer</th><th>calculator</th></tr></thead><tbody>
      ${SHEET.map((r, i) => `<tr><td>${r.label}</td><td class="${i === now ? "now" : ""}">${i < filled ? show(r.hand(), r.unit) : `<span class="hid">${i === now ? "?" : "–"}</span>`}</td><td class="${i < filled ? "ok" : ""}">${i < filled ? show(r.exact(), r.unit) : `<span class="hid">–</span>`}</td></tr>`).join("")}
    </tbody></table>`;
  }

  // Card bars: weights (solid) and cache (dashed) against each card; the dotted line is the team's limit.
  function cardBars(w, c, { title, rule = true } = {}) {
    const scale = Math.max(CARDS[CARDS.length - 1], (w + c) / GB) * 1.02;
    const pct = v => `${(v / scale * 100).toFixed(2)}%`;
    return `<div class="${P}bars">${title ? `<div class="lp-cap">${title}</div>` : ""}
      ${CARDS.map(card => {
        const cap = card, fits = w + c <= (rule ? usable(card) : card * GB);
        const wv = Math.min(w / GB, cap), cv = Math.max(0, Math.min(c / GB, cap - wv));
        return `<div class="${P}row"><span>${card} GB</span><span class="${P}track" style="width:${pct(cap)}" aria-label="${card} GB card: ${fits ? "fits" : "does not fit"}">
          <span class="${P}w" style="width:${(wv / cap * 100).toFixed(2)}%"></span>
          ${cv > 0 ? `<span class="${fits ? P + "c" : P + "over"}" style="left:${(wv / cap * 100).toFixed(2)}%;width:${(cv / cap * 100).toFixed(2)}%"></span>` : ""}
          ${!fits && wv >= cap ? `<span class="${P}over" style="left:0;width:100%"></span>` : ""}
          ${rule ? `<span class="${P}lim" style="left:${((1 - KEEP_FREE) * 100).toFixed(2)}%"></span>` : ""}</span></div>`;
      }).join("")}
      <div class="${P}key"><span><i style="background:var(--ink-2)"></i>weights</span>${c > 0 ? `<span><i style="background:var(--sunk);border:2px dashed var(--ink)"></i>KV cache</span>` : ""}<span><i style="background:var(--bad-soft);border:2px solid var(--bad)"></i>does not fit</span>${rule ? `<span><i style="border-left:2px dotted var(--ink);width:6px"></i>the team's limit</span>` : ""}</div>
      <div class="${P}cap">total ${gb(w + c)} GB; each bar is one card, drawn to scale</div></div>`;
  }

  /* 1. The situation: weights at 16 and 4 bits, by hand; the calculator checks with the exact count. */
  function situation({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const ASK = [
      { bits: 16, right: weights(ROUND_PARAMS, 16), wrongs: [weights(ROUND_PARAMS, 8), weights(ROUND_PARAMS, 32), ROUND_PARAMS * 16],
        say: v => v === weights(ROUND_PARAMS, 8) ? `${gb(v)} GB is one byte per parameter, which is 8 bits. 16 bits is 2 bytes: ${fmt(ROUND_PARAMS / GB)} billion × 2.`
          : v === weights(ROUND_PARAMS, 32) ? `${gb(v)} GB is 4 bytes per parameter: 32 bits. That is how training code often stores numbers, but the team serves at 16 bits: 2 bytes each.`
          : `${gb(v)} GB multiplies by 16 as if each parameter took 16 bytes. It takes 16 <b>bits</b>, and 8 bits make a byte: 2 bytes each.` },
      { bits: 4, right: weights(ROUND_PARAMS, 4), wrongs: [weights(ROUND_PARAMS, 8), ROUND_PARAMS * 4],
        say: v => v === weights(ROUND_PARAMS, 8) ? `${gb(v)} GB is a whole byte per parameter, which is 8 bits. 4 bits is half a byte.`
          : `${gb(v)} GB treats 4 bits as 4 bytes. 4 bits is half a byte, so the weights take a quarter of the 16-bit size.` }
    ];
    const paint = () => {
      const end = k >= ASK.length, a = end ? null : ASK[k];
      const opts = end ? [] : [a.right, ...a.wrongs].sort((x, y) => x - y);
      el.innerHTML = `<h1>Which graphics card should they buy?</h1>
        <p class="lead">Three people run a small startup. They want an internal assistant on their own machine, using an open model with about 7 billion parameters (the "7B" on its model card). They can afford one second-hand graphics card, and the offers have ${CARDS.slice(0, -1).join(", ")} or ${CARDS[CARDS.length - 1]} GB of memory. Anyone who hosts a model on their own GPU, instead of calling an API, must answer this first: will it fit? To start, the card must hold the model's weights: one number per parameter.</p>
        <p class="lead">Each number takes 16 bits (2 bytes) in the usual format, or 4 bits if the weights are squeezed to fewer bits. In this lesson 1 GB is a billion bytes.</p>
        ${end ? "" : `<p class="task">Fill the next cell: how much memory do 7 billion weights take at ${a.bits} bits?</p>`}
        ${sheet(k, end ? -1 : k)}
        <div class="lpanel">${end ? "" : kit.options(opts.map(v => `${gb(v)} GB`), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(a.right), num: true })}
        ${wrong != null ? kit.feedback(a.say(wrong), false) : ""}
        ${end ? kit.feedback(`Both cells right. The calculator uses the exact count from the model's files, ${fmt(MODEL_A.params)} parameters, so its numbers are a little bigger than "7B" suggests: ${gb(weights(MODEL_A.params, 16))} GB at 16 bits. Use the exact count when the margin is thin. Real 4-bit formats also store a little extra data for each group of weights, so they come out slightly bigger than the 4-bit cell (the next lesson shows this). At 16 bits the weights alone rule out the ${CARDS[0]} GB card. That is not the whole bill, though: the next screen shows what else the card must hold.`, true) : ""}
        ${end ? cardBars(weights(MODEL_A.params, 16), 0, { title: "16-bit weights against each card", rule: false }) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== a.right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= ASK.length) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: what else grows while the model writes. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const w16 = weights(MODEL_A.params, 16), card = CARDS[1], spare = card * GB - w16;
    const ID_BYTES = 4, idTotal = MODEL_A.maxTokens * ID_BYTES;
    const opts = [
      "The text of the chat so far",
      "For every token so far, the key and value vectors that attention made from it, in every layer",
      "A fresh copy of the weights for every new message"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>${gb(spare)} GB to spare?</h1>
        <p class="lead">One founder wants the ${card} GB card with 16-bit weights: ${gb(w16)} GB of weights leaves ${gb(spare)} GB free. Recall how the model writes: one token at a time. In every layer, the new token's query is compared with the keys of all earlier tokens. Then it takes a mix of their values. If the model recomputed every earlier key and value for each new token, it would repeat the same work again and again.</p>
        <p class="task">So while a chat runs, what else sits on the card and grows with every token?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The model keeps each token's key and value vectors, in every layer, so the next token only computes its own. This store is the <b>KV cache</b> (K for keys, V for values). It grows by one key and one value per layer for every token, and every chat running at the same time has its own. The ${gb(spare)} GB must hold all of it.`, true)
          : ans === 0 ? kit.feedback(`The text is tiny. Even at ${ID_BYTES} bytes per token id, a chat of ${fmt(MODEL_A.maxTokens)} tokens is ${fmt(idTotal)} bytes, far less than one gigabyte. What grows is what attention made from each token, in every layer.`, false)
          : kit.feedback(`The weights are loaded once and only read. Every message and every chat runs through the same copy. What grows is per token: what attention made from each token, in every layer.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Scratch: a tiny two-layer decoder in NumPy that keeps a KV cache (real run, traced). */
  const CODE3 = [
    "def decode(tokens, layers):",
    "    cache = [([], []) for _ in layers]",
    "    for t, x in enumerate(tokens):",
    "        for n, layer in enumerate(layers):",
    "            keys, values = cache[n]",
    "            keys.append(x @ layer[\"Wk\"])",
    "            values.append(x @ layer[\"Wv\"])",
    "            q = x @ layer[\"Wq\"]",
    "            x = attend(q, keys, values)",
    "    return cache"
  ];
  // From docs/ai-path/runs/s5c-gpu-memory/kv_cache.out.txt: [line about to run, is return, t, n, keys L0, values L0, keys L1, values L1]
  const TRACE3 = [[1,0,null,null,null,null,null,null],[1,0,null,null,null,null,null,null],[1,0,null,null,null,null,null,null],[2,0,null,null,0,0,0,0],[3,0,0,null,0,0,0,0],[4,0,0,0,0,0,0,0],[5,0,0,0,0,0,0,0],[6,0,0,0,1,0,0,0],[7,0,0,0,1,1,0,0],[8,0,0,0,1,1,0,0],[3,0,0,0,1,1,0,0],[4,0,0,1,1,1,0,0],[5,0,0,1,1,1,0,0],[6,0,0,1,1,1,1,0],[7,0,0,1,1,1,1,1],[8,0,0,1,1,1,1,1],[3,0,0,1,1,1,1,1],[2,0,0,1,1,1,1,1],[3,0,1,1,1,1,1,1],[4,0,1,0,1,1,1,1],[5,0,1,0,1,1,1,1],[6,0,1,0,2,1,1,1],[7,0,1,0,2,2,1,1],[8,0,1,0,2,2,1,1],[3,0,1,0,2,2,1,1],[4,0,1,1,2,2,1,1],[5,0,1,1,2,2,1,1],[6,0,1,1,2,2,2,1],[7,0,1,1,2,2,2,2],[8,0,1,1,2,2,2,2],[3,0,1,1,2,2,2,2],[2,0,1,1,2,2,2,2],[3,0,2,1,2,2,2,2],[4,0,2,0,2,2,2,2],[5,0,2,0,2,2,2,2],[6,0,2,0,3,2,2,2],[7,0,2,0,3,3,2,2],[8,0,2,0,3,3,2,2],[3,0,2,0,3,3,2,2],[4,0,2,1,3,3,2,2],[5,0,2,1,3,3,2,2],[6,0,2,1,3,3,3,2],[7,0,2,1,3,3,3,3],[8,0,2,1,3,3,3,3],[3,0,2,1,3,3,3,3],[2,0,2,1,3,3,3,3],[9,0,2,1,3,3,3,3],[9,1,2,1,3,3,3,3]];
  // same file, last line
  const RUN3 = { layers: 2, tokens: 3, perVector: 4, bytesPer: 2, measured: 96, formula: 96, dtype: "float16" };
  // Frames: the state just after listing line 1 (cache made), 6 (key and value appended) and 8 (attention ran), then the end.
  const FR3 = (() => {
    const fr = [];
    for (let i = 1; i < TRACE3.length; i++) {
      const prev = TRACE3[i - 1][0], s = TRACE3[i];
      if (s[1]) { fr.push({ ln: s[0], s }); continue; }
      if ((prev === 1 && s[0] === 2) || prev === 6 || prev === 8) fr.push({ ln: prev, s });
    }
    return fr;
  })();
  const TOTAL_VECTORS = 2 * RUN3.layers * RUN3.tokens;
  function codeCache({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const popts = [RUN3.tokens, 2 * RUN3.tokens, TOTAL_VECTORS].map(String);
    const pright = 2;
    const paint = () => {
      const f = FR3[i], s = f.s, gate = i === 0 && pred !== pright;
      const counts = [s[4], s[5], s[6], s[7]];
      const rowsLab = ["layer 0 keys", "layer 0 values", "layer 1 keys", "layer 1 values"];
      const justN = f.ln === 6 ? s[3] : -1;
      const vals = counts.map((c, r) => Array.from({ length: RUN3.tokens }, (_, t) => t < c ? `${r % 2 ? "v" : "k"}${t + 1}` : ""));
      const cls = {};
      counts.forEach((c, r) => { for (let t = 0; t < c; t++) cls[`${r},${t}`] = "in"; });
      if (justN >= 0) { cls[`${2 * justN},${s[2]}`] = "enter"; cls[`${2 * justN + 1},${s[2]}`] = "enter"; }
      const stored = counts.reduce((a, b) => a + b, 0);
      const say = f.ln === 1 ? `An empty cache: one list of keys and one list of values for each of the ${RUN3.layers} layers.`
        : f.ln === 6 ? `Token ${s[2] + 1}, layer ${s[3]}: the two append lines ran. Its key and value for this layer are appended (the newly filled cells). ${plural(stored, "vector")} stored so far.`
        : f.ln === 8 ? `Token ${s[2] + 1}, layer ${s[3]}: its query is compared with all ${plural(counts[2 * s[3]], "key")} this layer holds and mixes their values. The result goes on to the next layer.`
        : `Done: ${plural(stored, "vector")} of ${RUN3.perVector} numbers each, stored as ${RUN3.dtype} (${RUN3.bytesPer} bytes per number). NumPy measured <b>${fmt(RUN3.measured)} bytes</b>; the formula 2 × ${RUN3.layers} layers × ${RUN3.tokens} tokens × ${RUN3.perVector} numbers × ${RUN3.bytesPer} bytes gives ${fmt(RUN3.formula)}. Nothing is ever removed: one more token, one more key and value in every layer.`;
      el.innerHTML = `<h1>A tiny model that keeps a cache</h1>
        <p class="lead">A real NumPy run with a toy model: ${RUN3.layers} layers, ${RUN3.tokens} tokens, keys and values of ${RUN3.perVector} numbers each (one head). The weights are random, because only the cache matters here. <code>attend</code> is the attention you wrote earlier: compare the query with every stored key, then mix the values. Each step replays the run.</p>
        <p class="task">${gate ? `Before you step: when all ${RUN3.tokens} tokens have gone through, how many vectors will the cache hold in all?` : "Step through to the end and watch the cache grow."}</p>
        ${kit.code(CODE3, f.ln)}
        ${kit.pics.grid(vals, { rowHead: rowsLab, colHead: Array.from({ length: RUN3.tokens }, (_, t) => `${t + 1}`), cls, title: "the cache: one cell per stored vector (k = key, v = value); columns are tokens 1 to " + RUN3.tokens })}
        <div class="vars"><span>t <b>${s[2] == null ? "–" : s[2]}</b></span><span>n <b>${s[3] == null ? "–" : s[3]}</b></span><span>vectors stored <b>${stored}</b></span><span>step <b>${i + 1} / ${FR3.length}</b></span></div>
        ${gate ? `<div id="pred">${kit.options(popts, { picked: pred, correct: pright, num: true })}
          ${pred == null ? "" : pred === 0 ? kit.feedback(`${RUN3.tokens} is one vector per token. Each token leaves a key <b>and</b> a value, and it does so in <b>each</b> of the ${RUN3.layers} layers.`, false)
          : kit.feedback(`${2 * RUN3.tokens} counts a key and a value per token, but only for one layer. Every layer keeps its own: there are ${RUN3.layers}.`, false)}</div>`
          : kit.feedback(say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR3.length - 1 || gate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR3.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 4. KV cache per token and for one long chat, by hand, from the real config. */
  function perTokenByHand({ el, done, kit }) {
    css();
    const m = MODEL_A, hd = headDim(m);
    const oneKey = m.kvHeads * hd, allNums = 2 * m.layers * oneKey, bytes = allNums * BYTES16, chat = bytes * m.maxTokens;
    const STEPS = [
      { q: "How many numbers are in one token's key, in one layer? (all key/value heads together)", right: oneKey, opts: [hd, oneKey, m.layers * oneKey], fmtv: fmt,
        say: v => v === hd ? `${fmt(hd)} is one head. The layer has ${m.kvHeads} key/value heads, each with its own ${hd} numbers: ${m.kvHeads} × ${hd}.` : `${fmt(v)} already multiplies by all ${m.layers} layers. One layer's key is ${m.kvHeads} heads × ${hd} numbers.` },
      { q: "How many numbers does one token leave in the whole cache? (keys and values, every layer)", right: allNums, opts: [m.layers * oneKey, allNums, 2 * oneKey], fmtv: fmt,
        say: v => v === m.layers * oneKey ? `${fmt(v)} is the keys only. Each token also leaves a value of the same size: × 2.` : `${fmt(v)} is a key and a value in one layer. The model has ${m.layers} layers, and each keeps its own.` },
      { q: "How many bytes is that, stored at 16 bits?", right: bytes, opts: [allNums, bytes, allNums * 16], fmtv: v => `${fmt(v)} bytes`,
        say: v => v === allNums ? `That is one byte per number, 8 bits. At 16 bits each number takes 2 bytes.` : `That multiplies by 16, as if each number took 16 bytes. 16 bits is 2 bytes.` },
      { q: `One long chat fills the model's whole context of ${fmt(m.maxTokens)} tokens. How big is its cache?`, right: chat, opts: [chat / 1e3, chat, chat * 2], fmtv: v => `${gb(v, 3)} GB`,
        say: v => v < chat ? `${gb(v, 3)} GB is off by a thousand: ${fmt(bytes)} bytes is about ${fmt(Number((bytes / 1e6).toFixed(2)))} MB, and ${fmt(m.maxTokens)} of those make about ${gb(chat)} GB.` : `${gb(v)} GB counts keys and values twice. The ${fmt(bytes)} bytes per token already hold both: × ${fmt(m.maxTokens)} tokens is all.` }
    ];
    let k = 0, wrong = null;
    const paint = () => {
      const end = k >= STEPS.length, st = end ? null : STEPS[k];
      const opts = end ? [] : [...st.opts].sort((x, y) => x - y);
      el.innerHTML = `<h1>The cache of the real model</h1>
        <p class="lead">The model's <code>config.json</code> file, published beside its weights, has what you need. The lines that matter:</p>
        <div class="${P}cfg">"num_hidden_layers": ${m.layers},\n"num_attention_heads": ${m.qHeads},\n"num_key_value_heads": ${m.kvHeads},\n"hidden_size": ${m.hidden},\n"max_position_embeddings": ${m.maxTokens}</div>
        <p class="lead">Each layer splits attention into heads. In this model every head has its own key and value, so the config lists ${m.kvHeads} key/value heads. max_position_embeddings is the longest context, in tokens.</p>
        <p class="lead">Each head works on hidden_size ÷ num_attention_heads = ${m.hidden} ÷ ${m.qHeads} = <b>${hd}</b> numbers. The team loads the model at 16 bits, so the cache is stored at 16 bits too.</p>
        ${end ? "" : `<p class="task">${st.q}</p>`}
        ${sheet(end ? 4 : k < 3 ? 2 : 3, end ? -1 : k < 3 ? 2 : 3)}
        <div class="lpanel">${end ? "" : kit.options(opts.map(st.fmtv), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(st.right), num: true })}
        ${wrong != null ? kit.feedback(st.say(wrong), false) : !end && k > 0 ? kit.feedback(`Right: ${STEPS[k - 1].fmtv(STEPS[k - 1].right)}.`, true) : ""}
        ${end ? kit.feedback(`Every cell matches the calculator. Per token: 2 × ${m.layers} layers × ${m.kvHeads} heads × ${hd} numbers × 2 bytes = ${fmt(bytes)} bytes, about half a megabyte. One full chat: <b>${gb(chat)} GB</b>, on top of ${gb(weights(m.params, 16))} GB of 16-bit weights. The ${CARDS[1]} GB card cannot hold even one full chat at 16 bits.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== st.right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= STEPS.length) done();
      });
    };
    paint();
  }

  /* 5. Use it: for each setup, which card is the smallest that fits? */
  const SETUPS = [
    { bits: 16, chats: 1, tokens: MODEL_A.maxTokens },
    { bits: 4, chats: 3, tokens: MODEL_A.maxTokens },
    { bits: 16, chats: 4, tokens: MODEL_A.maxTokens }
  ];
  function whichCard({ el, done, kit }) {
    css();
    const ans = SETUPS.map(() => null);
    const choices = [...CARDS.map(c => `${c} GB`), "None of them"];
    const rightIdx = su => { const t = weights(MODEL_A.params, su.bits) + cacheBytes(MODEL_A, su.tokens, su.chats), c = smallestCard(t); return c == null ? CARDS.length : CARDS.indexOf(c); };
    const paint = () => {
      el.innerHTML = `<h1>Pick the card for each setup</h1>
        <p class="lead">Memory needed = weights + cache per token × tokens × chats running at the same time. The serving program also needs working memory while it computes, and the sum leaves that out. So the team keeps a tenth of every card free: on a ${CARDS[2]} GB card they plan for at most ${gb(usable(CARDS[2]))} GB. Same model as before: ${gb(weights(MODEL_A.params, 16))} GB of weights at 16 bits, ${gb(weights(MODEL_A.params, 4))} GB at 4 bits, ${fmt(perToken(MODEL_A))} bytes of cache per token.</p>
        <p class="task">For each setup, pick the smallest card that fits it. Pick again if you change your mind.</p>
        ${SETUPS.map((su, i) => {
          const w = weights(MODEL_A.params, su.bits), c = cacheBytes(MODEL_A, su.tokens, su.chats), t = w + c, r = rightIdx(su);
          const fb = ans[i] == null ? "" : ans[i] === r
            ? kit.feedback(`Right. ${gb(w)} + ${gb(c)} = <b>${gb(t)} GB</b>. ${r === CARDS.length ? `That is over the ${gb(usable(CARDS[2]))} GB limit of the biggest card. Something must give: fewer chats at once, shorter chats, or 4-bit weights.` : `The ${CARDS[r]} GB card allows ${gb(usable(CARDS[r]))} GB${r > 0 ? `; the ${CARDS[r - 1]} GB card allows only ${gb(usable(CARDS[r - 1]))}` : ""}.`}`, true)
            : ans[i] === CARDS.length ? kit.feedback(`${gb(w)} + ${gb(c)} = ${gb(t)} GB, which fits under the ${CARDS[r]} GB card's limit of ${gb(usable(CARDS[r]))} GB.`, false)
            : ans[i] < r ? kit.feedback(`${gb(w)} GB of weights + ${su.chats} × ${gb(cacheBytes(MODEL_A, su.tokens, 1))} GB of cache = ${gb(t)} GB. The ${CARDS[ans[i]]} GB card allows only ${gb(usable(CARDS[ans[i]]))} GB.${su.chats > 1 ? " Each chat running at the same time has its own cache." : ""}`, false)
            : kit.feedback(`It fits there, but ${gb(t)} GB already fits on the smaller ${CARDS[r]} GB card (limit ${gb(usable(CARDS[r]))} GB). A smaller card is cheaper.`, false);
          return `<div class="lcase" id="c${i}"><p><b>${su.bits}-bit weights</b>, ${plural(su.chats, "chat")} at the same time, each up to ${fmt(su.tokens)} tokens.</p>
            ${kit.options(choices, { picked: ans[i], correct: r })}${fb}${ans[i] === r ? cardBars(w, c) : ""}</div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SETUPS.every((su, j) => ans[j] === rightIdx(su))) done();
      }));
    };
    paint();
  }

  /* 6. A model that shares key/value heads: predict its cache per token. */
  function sharedHeads({ el, done, kit }) {
    css();
    let ans = null;
    const a = MODEL_A, b = MODEL_B, hd = headDim(b), group = b.qHeads / b.kvHeads;
    const right = perToken(b), withQ = 2 * b.layers * b.qHeads * hd * BYTES16, same = perToken(a);
    const opts = [right, withQ, same].sort((x, y) => x - y);
    const ratio = Math.round(perToken(a) / perToken(b));
    const fullB = cacheBytes(b, b.maxTokens, 1), fullA = cacheBytes(a, a.maxTokens, 1);
    const paint = () => {
      const ok = ans === opts.indexOf(right);
      el.innerHTML = `<h1>A model that shares its keys</h1>
        <p class="lead">The team looks at a second open model of the same size class. Its config.json:</p>
        <div class="${P}cfg">"num_hidden_layers": ${b.layers},\n"num_attention_heads": ${b.qHeads},\n"num_key_value_heads": ${b.kvHeads},\n"hidden_size": ${b.hidden},\n"max_position_embeddings": ${b.maxTokens}</div>
        <p class="lead">num_attention_heads counts the query heads. So this model has ${b.qHeads} query heads, but only ${b.kvHeads} key/value heads: each key/value head is shared by a group of ${group} query heads. This design is called <b>grouped-query attention</b>. Each head still works on ${b.hidden} ÷ ${b.qHeads} = ${hd} numbers.</p>
        <p class="task">Predict: how many bytes of cache does one token leave in this model, at 16 bits?</p>
        <div class="lpanel">${kit.options(opts.map(v => `${fmt(v)} bytes`), { picked: ans, correct: opts.indexOf(right), num: true })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right: 2 × ${b.layers} × ${b.kvHeads} × ${hd} × 2 = <b>${fmt(right)} bytes</b>, about ${ratio} times fewer bytes per token than the first model. Its full context of ${fmt(b.maxTokens)} tokens takes ${gb(fullB)} GB, less than the first model's ${fmt(a.maxTokens)}-token chat (${gb(fullA)} GB). The catch: its weights are ${gb(weights(b.params, 16))} GB at 16 bits, a little more than the first model's ${gb(weights(a.params, 16))} GB, so it still needs the ${smallestCard(weights(b.params, 16))} GB card at 16 bits. And the design is fixed at training time. No setting switches the first model to shared heads; converting a model takes extra training.`, true)
          : opts[ans] === withQ ? kit.feedback(`${fmt(withQ)} uses the ${b.qHeads} query heads. Queries are not cached: only the current token's query is needed. The cache holds keys and values, and there are only ${b.kvHeads} key/value heads.`, false)
          : kit.feedback(`${fmt(same)} is the first model's number. Same size class, different design: this model has ${b.layers} layers and only ${b.kvHeads} key/value heads. Read them from its config.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === opts.indexOf(right)) done(); });
    };
    paint();
  }

  /* 7. Scratch: the whole check as one Python function (real run, traced). */
  const CODE7 = [
    "def will_it_fit(cfg, params, bits,",
    "        tokens, chats, card_gb):",
    "    layers = cfg[\"num_hidden_layers\"]",
    "    kv_heads = cfg[\"num_key_value_heads\"]",
    "    heads = cfg[\"num_attention_heads\"]",
    "    head_dim = cfg[\"hidden_size\"] // heads",
    "    vectors = 2 * layers * kv_heads",
    "    per_token = vectors * head_dim * 2",
    "    weights = params * bits / 8",
    "    cache = per_token * tokens * chats",
    "    total_gb = (weights + cache) / 1e9",
    "    return total_gb <= 0.9 * card_gb"
  ];
  // From docs/ai-path/runs/s5c-gpu-memory/estimate.out.txt: will_it_fit(model_b config, 7615616512, 16, 32768, 3, 24)
  const CALL7 = { params: 7615616512, bits: 16, tokens: 32768, chats: 3, card: 24 };
  const TRACE7 = [
    { line: 2, vars: {} },
    { line: 3, vars: { layers: 28 } },
    { line: 4, vars: { layers: 28, kv_heads: 4 } },
    { line: 5, vars: { layers: 28, kv_heads: 4, heads: 28 } },
    { line: 6, vars: { layers: 28, kv_heads: 4, heads: 28, head_dim: 128 } },
    { line: 7, vars: { layers: 28, kv_heads: 4, heads: 28, head_dim: 128, vectors: 224 } },
    { line: 8, vars: { layers: 28, kv_heads: 4, heads: 28, head_dim: 128, vectors: 224, per_token: 57344 } },
    { line: 9, vars: { layers: 28, kv_heads: 4, heads: 28, head_dim: 128, vectors: 224, per_token: 57344, weights: 15231233024.0 } },
    { line: 10, vars: { layers: 28, kv_heads: 4, heads: 28, head_dim: 128, vectors: 224, per_token: 57344, weights: 15231233024.0, cache: 5637144576 } },
    { line: 11, vars: { layers: 28, kv_heads: 4, heads: 28, head_dim: 128, vectors: 224, per_token: 57344, weights: 15231233024.0, cache: 5637144576, total_gb: 20.8683776 } },
    { line: 11, event: "return", vars: { layers: 28, kv_heads: 4, heads: 28, head_dim: 128, vectors: 224, per_token: 57344, weights: 15231233024.0, cache: 5637144576, total_gb: 20.8683776 } }
  ];
  const RESULT7 = true;                                 // "RESULT True" in the same file
  const RESULT7_A = true;                               // model_a, 16 bits, 4096 tokens, 3 chats, 24 GB -> True
  const FR7 = TRACE7.slice(0, -1).map((s, i) => ({ ln: s.line, vars: TRACE7[i + 1].vars }));
  const GATE7_LN = 9;                                   // predict `cache` before this line runs
  function codeFit({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const GATE = FR7.findIndex(f => f.ln === GATE7_LN);
    const pt = TRACE7[TRACE7.length - 1].vars.per_token, cacheR = TRACE7[TRACE7.length - 1].vars.cache;
    const popts = [pt * CALL7.tokens, cacheR, pt * CALL7.tokens * CALL7.chats * 8].sort((x, y) => x - y);
    const pright = popts.indexOf(cacheR);
    const order = ["layers", "kv_heads", "heads", "head_dim", "vectors", "per_token", "weights", "cache", "total_gb"];
    const showV = (k, v) => k === "weights" || k === "cache" ? `${fmt(v)} (${gb(v)} GB)` : k === "total_gb" ? String(v) : fmt(v);
    const paint = () => {
      const f = FR7[i], gate = i === GATE - 1 && pred !== pright, last = i === FR7.length - 1;
      const say = {
        2: "Layers, from config.json.", 3: "Key/value heads, from config.json.", 4: "Query heads, from config.json.",
        5: "Each head's width: hidden_size ÷ query heads.",
        6: "Vectors per token: a key and a value, in every layer, for every key/value head.",
        7: `Bytes per token: those vectors × head width × 2 bytes per number. The same ${fmt(pt)} you predicted.`,
        8: `Weights: ${fmt(CALL7.params)} parameters × ${CALL7.bits} bits ÷ 8 bits per byte.`,
        9: `Cache: bytes per token × ${fmt(CALL7.tokens)} tokens × ${CALL7.chats} chats.`,
        10: `Total in GB: ${String(f.vars.total_gb)}.`,
        11: `Returned <b>${RESULT7 ? "True" : "False"}</b>: ${String(f.vars.total_gb)} ≤ 0.9 × ${CALL7.card} = ${fmt(Number((0.9 * CALL7.card).toFixed(2)))}. So three people can each have a full ${fmt(CALL7.tokens)}-token chat on the ${CALL7.card} GB card at 16 bits. The same run checked the first model with 3 chats: ${RESULT7_A ? "True" : "False"} as well, but each of its chats can be only ${fmt(MODEL_A.maxTokens)} tokens long, an eighth as long.`
      };
      el.innerHTML = `<h1>The whole check in Python</h1>
        <p class="lead">Your worksheet as one function, run on this Mac with the second model's real <code>config.json</code>: ${fmt(CALL7.params)} parameters, ${CALL7.bits} bits, ${fmt(CALL7.tokens)} tokens, ${CALL7.chats} chats at once, a ${CALL7.card} GB card. The last line is the team's rule: keep a tenth free. Each step replays the run.</p>
        <p class="task">Step through to the end. Before <code>cache</code> is computed, predict it.</p>
        ${kit.code(CODE7, f.ln)}
        <div class="vars">${order.map(k => `<span>${k} <b>${f.vars[k] == null ? "–" : showV(k, f.vars[k])}</b></span>`).join("")}<span>step <b>${i + 1} / ${FR7.length}</b></span></div>
        ${kit.feedback(say[f.ln])}
        ${gate ? `<div id="pred"><p class="task">Next: <code>cache = per_token * tokens * chats</code>. How big will <code>cache</code> be?</p>${kit.options(popts.map(v => `${gb(v)} GB`), { picked: pred, correct: pright, num: true })}
          ${pred == null ? "" : popts[pred] === pt * CALL7.tokens ? kit.feedback(`${gb(pt * CALL7.tokens)} GB is one chat. Three people chat at the same time, and each chat keeps its own cache: × ${CALL7.chats}.`, false)
          : kit.feedback(`That multiplies by 8 as if per_token were in bits. per_token is already in bytes (the last 2 in its line is 2 bytes per number).`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || gate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR7.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, cost; task: which setting fixes each case. */
  const KNOBS = ["Store the weights in 4 bits", "Cap how many chats run at once", "Pick a model with fewer key/value heads"];
  const BIG = [
    [`The only card on offer has ${CARDS[0]} GB. The model's 16-bit weights alone are ${gb(weights(MODEL_A.params, 16))} GB; chats are short.`, 0,
      `Right. The weights alone do not fit, and only the weights' format changes the weights: at 4 bits they take ${gb(weights(MODEL_A.params, 4))} GB. The next lesson shows what that costs in quality.`],
    ["Chats are short and the weights are already 4-bit. It works all month, then fails at month end, when the whole company uses it at once.", 1,
      "Right. Short chats, small weights: what grows is the number of caches, one per chat running at the same time. Capping it means the extra requests wait their turn instead of all needing a cache at once."],
    ["Lawyers paste whole contracts, and a single full-length chat no longer fits next to the 4-bit weights. Cutting the chats short would cut the contracts.", 2,
      "Right. Fewer key/value heads shrink the cache of every token, so long chats fit. It is a property of the model, so it means choosing a different model and testing it again."]
  ];
  const BIG_WRONG = [
    { 1: "There is nothing to queue: even one chat cannot start, because the weights alone are over the card's size.", 2: "Fewer key/value heads shrink the cache, but here the weights alone are too big." },
    { 0: "The weights are already 4-bit, and they are shared by every chat. What grows at month end is the number of chats, each with its own cache.", 2: "Each chat here is short, so its cache is small. The trouble is how many run at once." },
    { 0: "The weights are already small. The cache of one long chat is the problem, and the weights' format does not touch it.", 1: "One chat alone is already too big; queueing the others does not shrink it." }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const hfRule = HF_TEST.billions * BYTES16 / 4;      // 4 bits = a quarter of 2 bytes, per billion parameters, in GB
    const paint = () => {
      el.innerHTML = `<h1>When to do this sum</h1>
        <p class="lead"><b>What it is for:</b> deciding, before you buy or deploy, whether an open model fits a GPU, and which setting to change when it does not.</p>
        <p class="lead"><b>Reach for it</b> when you host the model yourself. <b>Not</b> when you call a hosted API: the provider's GPUs are not yours, and the limits you see are its context window and price per token.</p>
        <p class="lead"><b>What it costs:</b> the sum is only a floor, because the serving program needs working memory too. In the Hugging Face guide, a ${fmt(HF_TEST.billions)}-billion-parameter model in 4 bits has ${fmt(hfRule)} GB of weights. It peaked at about ${gb(hfMeasuredBytes, 1)} GB (the guide prints ${HF_TEST.measuredGiB.toFixed(2)}, because it counts 1,024³ bytes per GB). So measure under real load. The serving program vLLM has a setting for each part of the cache sum: <code>--max-model-len</code> (tokens per chat), <code>--max-num-seqs</code> (chats at once), <code>--kv-cache-dtype</code> (cache bits).</p>
        <p class="lead"><b>Not run by us.</b> Written from the <a href="https://docs.vllm.ai/en/latest/configuration/engine_args.html">vLLM documentation</a>, checked 2026-11-14.</p>
        <p class="task">For each situation, pick the setting that fixes it.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(KNOBS.map(kit.esc), { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === r ? yes : BIG_WRONG[i][ans[i]]), ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: does weights + cache arithmetic answer the question? */
  const CASES = [
    [`A school wants to run a 13-billion-parameter open model for one teacher at a time on a 16 GB card. Can this lesson's sum tell them before they buy?`, true,
      `Yes. 13 billion × 2 bytes = ${gb(weights(13e9, 16))} GB at 16 bits, already over the card. At 4 bits it is ${gb(weights(13e9, 4))} GB, and the cache for one teacher's chat comes from the model's config. The sum answers it.`,
      `It is exactly this lesson's question: weights from the parameter count and the bits, plus one chat's cache from config.json, against the card.`],
    ["A help-desk bot runs fine with 10 people, then crashes with an out-of-memory error at 40, with the same short chats. Can the sum explain it?", true,
      "Yes. The weights are the same for 10 or 40 people, but every chat running at once has its own cache: four times the chats, four times the cache.",
      "The cache is per chat. Same weights, four times as many chats at once, four times the cache: the sum shows where the memory went."],
    ["A team calls a hosted model through an API and asks whether a very long prompt will fit in GPU memory.", false,
      "No. They do not run the GPU. The provider decides how it serves the model; what the team sees is the model's context window and the price per token.",
      "There is no card of theirs to fill. The limit they meet is the provider's context window, and the cost is per token, not per gigabyte."],
    ["On a big card with plenty of free memory, the assistant gives poor answers in Korean. Can this lesson's sum tell the team how to get better Korean answers?", false,
      "No. Memory decides whether the model runs and how many chats fit, not what the model knows. Poor Korean answers are a model choice: test other models on your own Korean examples.",
      "More memory changes nothing the model computes: same weights, same answers. The fix is a different model, chosen on your own test set."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is it a memory question?</h1>
        <p class="lead">Four situations away from the startup.</p>
        <p class="task">For each one, decide if weights + KV cache arithmetic answers it. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (browser practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Weights plus cache, against the card</h1>
      <p class="lead">You can now say what the KV cache is: for every token so far, the key and value vectors in every layer, kept so the next token does not recompute them. Why it works: earlier tokens' keys and values never change, so keeping them trades memory for speed. What it costs: 2 × layers × key/value heads × head size × bytes, for every token of every chat running at once, on top of the weights (parameters × bits ÷ 8). For the first model that is ${fmt(perToken(MODEL_A))} bytes per token; for the model with shared heads, ${fmt(perToken(MODEL_B))}.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson: you write a function that reads a config dict and returns the weight and cache memory, then picks the smallest card that fits a given number of chats.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Here "4 bits" was only a number in a sum; that lesson does the rounding itself and measures the error it adds.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5c-gpu-memory", {
    title: "GPU memory and the KV cache: will it fit?",
    checked: "2026-11-14",
    sources: [
      "https://huggingface.co/docs/transformers/en/llm_tutorial_optimization",
      "https://huggingface.co/docs/transformers/en/cache_explanation",
      "https://arxiv.org/abs/2305.13245",
      "https://arxiv.org/abs/2309.06180",
      "https://arxiv.org/abs/2305.14314",
      "https://docs.vllm.ai/en/latest/configuration/engine_args.html",
      "https://docs.vllm.ai/en/latest/configuration/conserving_memory.html",
      "https://huggingface.co/allenai/OLMo-2-1124-7B/blob/main/config.json",
      "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct/blob/main/config.json"
    ],
    interview: [{
      q: "Your manager wants to serve a 7B open model to ten colleagues at once, with long chats, on one 24 GB card. How do you check whether it fits, and what do you change if it does not?",
      good: [
        "Weights: parameters × bytes per parameter, so about 14 to 15 GB at 16 bits and about a quarter of that at 4 bits",
        "KV cache per token from config.json: 2 × layers × key/value heads × head size × bytes; multiply by tokens per chat and by chats running at once",
        "Leave headroom: the runtime needs working memory the sum leaves out, so confirm with a real load test",
        "If it does not fit: 4-bit weights, cap the context length or the chats at once, store the cache in fewer bits, or pick a model with fewer key/value heads"
      ],
      weak: "Saying 7B at 16 bits is 14 GB, so it fits in 24 GB. That ignores the KV cache, which for ten long chats can be bigger than the weights."
    }, {
      q: "Two open models have about the same number of parameters. On the same card one handles much longer chats than the other. What could explain it?",
      good: [
        "The cache per token depends on layers, key/value heads and head size, not on the parameter count",
        "One model may use grouped-query attention: several query heads share one key/value head, so far fewer keys and values are stored per token",
        "Check num_key_value_heads and num_hidden_layers in each config.json and compute the bytes per token",
        "This is fixed when the model is trained; you cannot turn it on with a serving setting"
      ],
      weak: "Saying the second model is better optimized or more quantized, without looking at what the cache stores per token."
    }],
    screens: [situation, spotIdea, codeCache, perTokenByHand, whichCard, sharedHeads, codeFit, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#pred [data-wrong]"], right: ["#pred [data-right]", ...Array(FR3.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SETUPS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(FR7.findIndex(f => f.ln === GATE7_LN) - 1).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FR7.length - FR7.findIndex(f => f.ln === GATE7_LN)).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
