/* Lesson: Korean and Uzbek in a real tokenizer. Story: a support bot for a Tashkent electronics shop answers in
   English, Korean and Uzbek (Latin and Cyrillic), and its bill per message is about twice as high in Uzbek as in
   English. Ideas: (1) a tokenizer's merges were learned from its training text, so scripts it saw little of fall
   apart into small pieces, down to single bytes that are only part of a letter, and every piece is billed;
   (2) measure your own messages on the tokenizer you will pay for, normalize the text (NFC) before it is sent,
   and choose a model by measured cost, not by adding tokens to a hosted model.
   Data, all real:
   - docs/ai-path/runs/s4-korean-uzbek-tokens/tokens.py + tokens.out.txt: one shop message in four scripts through
     three Hugging Face tokenizers (openai-community/gpt2, Qwen/Qwen2.5-0.5B, FacebookAI/xlm-roberta-base);
   - trace_count.py + trace_count.out.txt: the count_tokens function on the code screen, traced line by line;
   - nfd_bug.py + nfd_bug.out.txt: the same Korean product name stored composed (NFC) and decomposed (NFD);
   - extras.py + extras.out.txt: add_special_tokens and the Uzbek apostrophe check;
   - recordings (main checkout) docs/ai-path/recordings/s4-korean-uzbek-tokens/bill-en, bill-ko, bill-uz-lat,
     bill-uz-cyr, bill-ko-nfc, bill-ko-nfd: the input tokens a hosted model's API billed for each message.
   Lesson-local style: token chips and a small count table (.lx-s4-korean-uzbek-tokens-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s4-korean-uzbek-tokens";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const x1 = (a, b) => (a / b).toFixed(1);

  /* ---------- Data copied from the runs and recordings ---------- */
  // The four messages (tokens.py MESSAGES)
  const MSG = {
    en: "Your order has been shipped and will arrive tomorrow.",
    ko: "주문하신 상품이 발송되었으며 내일 도착합니다.",
    uz_lat: "Buyurtmangiz joʻnatildi va ertaga yetib keladi.",
    uz_cyr: "Буюртмангиз жўнатилди ва эртага етиб келади."
  };
  const SCRIPTS = ["en", "ko", "uz_lat", "uz_cyr"];
  const NAME = { en: "English", ko: "Korean", uz_lat: "Uzbek, Latin", uz_cyr: "Uzbek, Cyrillic" };
  // tokens.out.txt: vocabulary sizes, token counts, characters and UTF-8 bytes per message
  const VOCAB = { gpt2: 50257, qwen: 151665, xlmr: 250002 };
  const COUNTS = { gpt2: { en: 10, ko: 55, uz_lat: 21, uz_cyr: 52 }, qwen: { en: 10, ko: 16, uz_lat: 19, uz_cyr: 26 }, xlmr: { en: 11, ko: 11, uz_lat: 16, uz_cyr: 19 } };
  const CHARS = { en: 53, ko: 25, uz_lat: 47, uz_cyr: 44 };
  const BYTES = { en: 53, ko: 65, uz_lat: 48, uz_cyr: 82 };
  const TOK = {
    gpt2: { label: "GPT-2", id: "openai-community/gpt2", what: "an older open model's tokenizer, learned from English web pages" },
    qwen: { label: "Qwen2.5", id: "Qwen/Qwen2.5-0.5B", what: "a newer open model's tokenizer" },
    xlmr: { label: "XLM-RoBERTa", id: "FacebookAI/xlm-roberta-base", what: "a tokenizer learned from text in about 100 languages" }
  };
  // tokens.out.txt, GPT-2, uz_cyr, first word "Буюртмангиз": [token as the library prints it, its bytes]
  const CYR_WORD = "Буюртмангиз";
  const CYR_TOKENS = [["Ð", "d0"], ["ĳ", "91"], ["Ñĥ", "d1 83"], ["Ñ", "d1"], ["İ", "8e"], ["ÑĢ", "d1 80"], ["ÑĤ", "d1 82"], ["Ð¼", "d0 bc"], ["Ð°", "d0 b0"], ["Ð½", "d0 bd"], ["Ð", "d0"], ["³", "b3"], ["Ð¸", "d0 b8"], ["Ð", "d0"], ["·", "b7"]];
  // tokens.out.txt: the Korean message's tokens on Qwen2.5 and XLM-RoBERTa (Qwen shown decoded from its bytes)
  const KO_QWEN = ["주", "문", "하신", " 상", "품", "이", " 발", "송", "되었", "으며", " 내", "일", " 도", "착", "합니다", "."];
  const KO_XLMR = ["▁주문", "하신", "▁상품", "이", "▁발송", "되었으며", "▁내", "일", "▁도착", "합니다", "."];
  const CYR_XLMR = ["▁Бу", "ю", "рт", "ман", "гиз", "▁ж", "ўна", "тил", "ди", "▁ва", "▁эр", "та", "га", "▁", "ети", "б", "▁ке", "лади", "."];
  // trace_count.out.txt: the first Korean tokens on GPT-2, their offsets, and what decoding 2 or 3 of them gives
  const KO_FIRST = { tokens: ["ì", "£", "¼", "ë", "¬", "¸", "íķ"], offsets: [[0, 1], [0, 1], [0, 1], [1, 2], [1, 2], [1, 2], [2, 3]], dec3: "주", dec2: "�" };
  // extras.out.txt: add_special_tokens on XLM-RoBERTa (without / with, and the added tokens)
  const SPECIAL = { without: 11, with: 13, ends: ["<s>", "</s>"] };

  // From docs/ai-path/recordings/s4-korean-uzbek-tokens/bill-*.json: usage.prompt_tokens, one user message each,
  // max_tokens 1 (the one output token is not shown)
  const REC_BILL = {
    src: "s4-korean-uzbek-tokens/bill-en … bill-uz-cyr",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    prompt: { en: 11, ko: 15, uz_lat: 17, uz_cyr: 20 }
  };
  const REC_NFD = {
    src: "s4-korean-uzbek-tokens/bill-ko-nfc, bill-ko-nfd",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    nfc: 9, nfd: 28
  };
  // nfd_bug.out.txt
  const PRODUCT = "무선 이어폰 충전 케이스"; // wireless earphone charging case
  const NFD = {
    len: [13, 27], bytes: [33, 75], firstNfc: ["U+BB34", "U+C120"], firstNfd: ["U+1106", "U+116E", "U+1109", "U+1165", "U+11AB"],
    tok: { gpt2: [null, 29, 72, 29], qwen: ["NFC", 13, 13, 13], xlmr: ["Precompiled", 6, 28, 6] } // [normalizer, typed, catalogue, after NFC]
  };
  const CAPTION = `Recorded token counts from a hosted model's API, ${REC_BILL.recordedAt}`;

  // count_tokens from docs/ai-path/runs/s4-korean-uzbek-tokens/trace_count.py, line for line (line 0 = def)
  const CODE = [
    "def count_tokens(tokenizer, messages):",
    "    counts = {}",
    "    for script, text in messages.items():",
    "        encoding = tokenizer.encode(",
    "            text, add_special_tokens=False)",
    "        counts[script] = len(encoding.ids)",
    "    return counts"
  ];
  // trace_count.out.txt, GPT-2 run: [line about to run, event (l line, r return), script, encoding.num_tokens, counts].
  // The call on lines 3-4 is one statement; Python reports it as the events 3, 4, 3. Those three are merged into one
  // step here (the first 3 is kept, the 4 and the repeated 3 are left out); every other event is copied as traced.
  const TRACE = [[1, "l", null, null, null], [2, "l", null, null, {}], [3, "l", "en", null, {}], [5, "l", "en", 10, {}], [2, "l", "en", 10, { en: 10 }], [3, "l", "ko", 10, { en: 10 }], [5, "l", "ko", 55, { en: 10 }], [2, "l", "ko", 55, { en: 10, ko: 55 }], [3, "l", "uz_lat", 55, { en: 10, ko: 55 }], [5, "l", "uz_lat", 21, { en: 10, ko: 55 }], [2, "l", "uz_lat", 21, { en: 10, ko: 55, uz_lat: 21 }], [3, "l", "uz_cyr", 21, { en: 10, ko: 55, uz_lat: 21 }], [5, "l", "uz_cyr", 52, { en: 10, ko: 55, uz_lat: 21 }], [2, "l", "uz_cyr", 52, { en: 10, ko: 55, uz_lat: 21, uz_cyr: 52 }], [6, "l", "uz_cyr", 52, { en: 10, ko: 55, uz_lat: 21, uz_cyr: 52 }], [6, "r", "uz_cyr", 52, { en: 10, ko: 55, uz_lat: 21, uz_cyr: 52 }]];
  const XLMR_RESULT = { en: 11, ko: 11, uz_lat: 16, uz_cyr: 19 }; // trace_count.out.txt, XLM-RoBERTa run

  /* ---------- Derived from the data ---------- */
  const G = COUNTS.gpt2;
  const BILL = REC_BILL.prompt;
  const isHalf = ([, hex]) => hex.split(" ").length === 1; // one byte of a two-byte letter
  const HALF = CYR_TOKENS.map((t, i) => isHalf(t) ? i : -1).filter(i => i >= 0);
  const WHOLE_FIRST = CYR_TOKENS.findIndex(t => !isHalf(t));
  const hexBytes = h => new Uint8Array(h.split(" ").map(b => parseInt(b, 16)));
  // the letters whose two bytes stayed apart: consecutive single-byte tokens, decoded together
  const splitLetters = () => HALF.filter((i, k) => k % 2 === 0).map(i => new TextDecoder().decode(hexBytes(CYR_TOKENS[i][1] + " " + CYR_TOKENS[i + 1][1]))); // used inside a screen only
  const ratioOf = (k, s) => COUNTS[k][s] / COUNTS[k].en;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-msg { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
      .lx-${ID}-msg small { display: block; font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; }
      .lx-${ID}-chip { min-height: 44px; min-width: 44px; padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: 500 15px/1.3 var(--mono); display: inline-flex; flex-direction: column; align-items: center; justify-content: center; }
      .lx-${ID}-chip small { font-size: 11.5px; color: var(--muted); }
      button.lx-${ID}-chip { cursor: pointer; }
      .lx-${ID}-chip.on { border: 2px solid var(--good); background: var(--good-soft); }
      .lx-${ID}-chip.bad { border: 2px solid var(--bad); background: var(--bad-soft); }
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { padding: 7px 6px; border-bottom: 1px solid var(--line); text-align: right; }
      .lx-${ID}-tbl th:first-child, .lx-${ID}-tbl td:first-child { text-align: left; }
      .lx-${ID}-tbl th { font: 600 12.5px/1.3 var(--mono); color: var(--muted); }
      .lx-${ID}-tbl td small { color: var(--muted); font-size: 12.5px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-tick { display: flex; gap: 12px; align-items: center; width: 100%; min-height: 44px; padding: 8px 4px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--ink); font: 15.5px/1.45 var(--font); text-align: left; cursor: pointer; }
      .lx-${ID}-box { flex: none; width: 20px; height: 20px; border: 2px solid var(--ink-2); border-radius: 4px; }
      .lx-${ID}-tick[aria-pressed="true"] .lx-${ID}-box { background: var(--good); border-color: var(--good); }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 6px; font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }
  const msgBox = (kit, s, label) => `<div class="lx-${ID}-msg"><small>${kit.esc(label || NAME[s])}</small>${kit.esc(MSG[s])}</div>`;
  const chips = (kit, list) => `<div class="lx-${ID}-chips">${list.map(t => `<span class="lx-${ID}-chip">${kit.esc(t.replace(/ /g, "␣"))}</span>`).join("")}</div>`;
  function countTable(kit, keys, opts = {}) {
    return `<table class="lx-${ID}-tbl"><thead><tr><th>message</th>${keys.map(k => `<th>${kit.esc(TOK[k].label)}</th>`).join("")}</tr></thead><tbody>${SCRIPTS.map(s =>
      `<tr><td>${kit.esc(NAME[s])}</td>${keys.map(k => `<td><b>${COUNTS[k][s]}</b>${s === "en" ? "" : ` <small>${x1(COUNTS[k][s], COUNTS[k].en)}×</small>`}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation and the by-hand prediction. */
  const BUCKETS = [["under 15", n => n < 15], ["15 to 30", n => n >= 15 && n <= 30], ["over 30", n => n > 30]];
  const bucketOf = n => BUCKETS.findIndex(([, f]) => f(n));
  function predict({ el, done, kit }) {
    ensureStyle();
    const asked = ["ko", "uz_lat", "uz_cyr"];
    const ans = asked.map(() => null), ok = asked.map(() => false);
    const fbFor = (s, pick) => {
      const n = G[s], right = bucketOf(n);
      const tail = `GPT-2 split it into <b>${n}</b> tokens: ${x1(n, G.en)} times the English count.`;
      if (pick === right) {
        if (s === "uz_lat") return [`Right. ${tail} The Latin letters are the same ones English uses, so many short pieces exist, but the Uzbek words are not in the vocabulary whole.`, true];
        return [`Right. ${tail} ${s === "ko" ? `The message has only ${CHARS.ko} characters against ${CHARS.en} in English, yet` : "Fewer characters than English, yet"} it costs far more.`, true];
      }
      if (pick < right) return [`More than that: ${tail} ${s === "ko" ? `It has only ${CHARS.ko} characters, so counting characters misleads you here.` : "Length in characters does not predict it."}`, false];
      return [`Fewer than that: ${tail} ${s === "uz_lat" ? "The Latin letters help: short English-like pieces such as “ert” and “aga” exist in the vocabulary." : ""}`, false];
    };
    const paint = () => {
      const all = ok.every(Boolean);
      el.innerHTML = `<h1>Why does Uzbek cost more?</h1>
        <p class="lead">A Tashkent electronics shop runs a support bot. It answers in English, Korean and Uzbek, and Uzbek customers write in both the Latin and the Cyrillic alphabet. The hosted model behind it bills by the <b>token</b>, the piece of text a model reads as one unit. The owner sees that a message in Uzbek costs about twice as much as the same message in English.</p>
        <p class="lead">Here is one bot message in four forms. A <b>tokenizer</b> is the tool that cuts text into tokens, like the merges you did by hand in the last lesson. GPT-2's tokenizer, ${kit.esc(TOK.gpt2.what)}, splits the English one into <b>${G.en}</b> tokens.</p>
        ${msgBox(kit, "en")}
        <p class="task">Predict how many tokens the same tokenizer makes of each of the other three.</p>
        ${asked.map((s, i) => `<div class="lcase" id="c${i}">${msgBox(kit, s)}${kit.options(BUCKETS.map(b => b[0]), { picked: ans[i], correct: bucketOf(G[s]) })}${ans[i] == null ? "" : kit.feedback(...fbFor(s, ans[i]))}</div>`).join("")}
        ${all ? `<div class="lpanel">${kit.feedback(`The hosted model the shop pays for uses its own tokenizer, which you cannot download. Its API reports how many input tokens it billed. For these four messages: English <b>${BILL.en}</b>, Korean <b>${BILL.ko}</b>, Uzbek Latin <b>${BILL.uz_lat}</b>, Uzbek Cyrillic <b>${BILL.uz_cyr}</b>. Uzbek Cyrillic is ${x1(BILL.uz_cyr, BILL.en)} times English: that is the owner's bill. The hosted model's gap is much smaller than GPT-2's, but it is still there. To see <i>why</i> the gap exists, you look inside an open tokenizer.`)}<p class="lx-${ID}-cap">${CAPTION}</p></div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i;
        if (ans[i] === bucketOf(G[asked[i]])) ok[i] = true;
        paint();
        if (ok.every(Boolean)) done();
      }));
    };
    paint();
  }

  /* 2. Diagnose real tokens: which pieces are not even a whole letter? */
  function halfLetters({ el, done, kit }) {
    ensureStyle();
    const sel = new Set();
    const SPLIT_LETTERS = splitLetters();
    let bad = null;
    const paint = () => {
      const fin = HALF.every(i => sel.has(i));
      el.innerHTML = `<h1>Pieces smaller than a letter</h1>
        <p class="lead">A computer stores text as bytes (UTF-8). A basic Latin letter takes 1 byte, a Cyrillic letter 2, a Korean syllable 3. GPT-2's tokenizer starts from the 256 possible bytes. Then it joins pairs that were frequent in its training text, like the merges you did by hand in the last lesson.</p>
        <p class="lead">These are the tokens it made of <b>${kit.esc(CYR_WORD)}</b> (“your order”). The library prints each byte as an odd symbol, so read the small line under each token: the bytes it holds, written in hex.</p>
        <p class="task">Select every token that holds only half of a Cyrillic letter: one byte where the letter needs two.</p>
        <div class="lx-${ID}-chips">${CYR_TOKENS.map(([t, hex], i) => `<button type="button" class="lx-${ID}-chip${sel.has(i) ? " on" : ""}${bad === i ? " bad" : ""}" data-i="${i}" aria-pressed="${sel.has(i)}">${kit.esc(t)}<small>${kit.esc(hex)}</small></button>`).join("")}</div>
        <div class="lpanel">
        ${bad != null ? kit.feedback(`<code>${kit.esc(CYR_TOKENS[bad][0])}</code> holds two bytes, <code>${kit.esc(CYR_TOKENS[bad][1])}</code>: that is one whole Cyrillic letter. GPT-2 did learn a merge for this letter. Look for tokens with a single byte.`, false) : ""}
        ${fin ? kit.feedback(`Right: ${HALF.length} of the ${CYR_TOKENS.length} tokens are half a letter. The word has ${CYR_WORD.length} letters, and ${SPLIT_LETTERS.length} of them (${SPLIT_LETTERS.map(c => kit.esc(c)).join(", ")}) were never merged, so each costs two tokens that mean nothing alone. Korean is worse: each syllable is 3 bytes, and in this message not one GPT-2 token is a whole syllable. The library's <code>offsets</code> say which characters each token came from. The first three Korean tokens all have offsets (${KO_FIRST.offsets[0].join(", ")}), so all three come from the first syllable, “${kit.esc(KO_FIRST.dec3)}”. Decoding only two of them gives “${kit.esc(KO_FIRST.dec2)}”, a broken character.`, true) : sel.size ? kit.feedback(`${plural(sel.size, "token")} selected. Keep going.`) : ""}
        </div>`;
      el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (!HALF.includes(i)) { bad = i; paint(); return; }
        bad = null;
        if (sel.has(i)) sel.delete(i); else sel.add(i);
        paint();
        if (HALF.every(j => sel.has(j))) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea through one question. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Korean and Uzbek words are longer, so they need more tokens",
      "The merges were learned from English text, so English letter pairs got merged into words and Korean and Cyrillic pairs mostly did not",
      "The model understands English better, so it uses fewer tokens for it",
      "The tokenizer counts characters, and Korean and Cyrillic characters count double"
    ];
    const fb = [
      [`Not length: the Korean message has ${CHARS.ko} characters and the English one ${CHARS.en}, yet Korean took ${G.ko} tokens and English ${G.en}. Something other than length decides the count.`, false],
      [`Right. A tokenizer is fixed before any model trains on it. Its vocabulary holds the pieces that were frequent in the text it learned from. GPT-2's text was English web pages, so “ shipped” is one token, while a Korean syllable is three bytes that its merges almost never joined into one token. The count depends on <b>how much text like yours the tokenizer learned from</b>, not on your language being harder.`, true],
      ["The tokenizer runs before the model and knows nothing about meaning. It is a lookup of pieces learned once, from text frequency. How well the model understands is a separate question.", false],
      [`It does not count characters at all. The Uzbek Cyrillic message has ${CHARS.uz_cyr} characters and ${BYTES.uz_cyr} bytes, and GPT-2 made ${G.uz_cyr} tokens of it: some letters became one token, some two. It splits into learned pieces, and the pieces it lacks fall back to bytes.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why English stays whole</h1>
        <p class="lead">Same tokenizer, same meaning. GPT-2 made ${G.en} tokens of the English message (${CHARS.en} characters) and ${G.ko} of the Korean one (${CHARS.ko} characters).</p>
        <p class="task">What explains the difference?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Other tokenizers, with predictions. */
  function otherTokenizers({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const KEYS = ["gpt2", "qwen", "xlmr"];
    const fewestKo = KEYS.reduce((a, k) => COUNTS[k].ko < COUNTS[a].ko ? k : a, "gpt2");
    const worst = k => SCRIPTS.filter(s => s !== "en").reduce((a, s) => ratioOf(k, s) > ratioOf(k, a) ? s : a, "ko");
    const worstMulti = worst("qwen") === worst("xlmr") ? worst("xlmr") : null;
    const q1 = KEYS.map(k => `${TOK[k].label}: ${VOCAB[k].toLocaleString("en")} tokens in its vocabulary`);
    const fb1 = {
      gpt2: [`GPT-2 is the one you just saw: ${G.ko} tokens, mostly single bytes. A small vocabulary learned from English has almost no Korean in it.`, false],
      qwen: [`Close, but not the fewest. Qwen2.5 gives ${COUNTS.qwen.ko}: most Korean syllables are one token each, but it rarely joins them into whole words. The fewest came from a vocabulary where whole Korean words are tokens.`, false],
      xlmr: ["", true]
    };
    const q2Opts = SCRIPTS.filter(s => s !== "en").map(s => NAME[s]);
    const q2Right = SCRIPTS.filter(s => s !== "en").indexOf(worstMulti);
    const fb2 = SCRIPTS.filter(s => s !== "en").map(s => s === worstMulti
      ? [`Right. On both, Uzbek Cyrillic is the most expensive relative to English (${x1(COUNTS.qwen.uz_cyr, COUNTS.qwen.en)}× and ${x1(COUNTS.xlmr.uz_cyr, COUNTS.xlmr.en)}×). Even the tokenizer that knows Korean words cuts “эртага” (tomorrow) into ${CYR_XLMR.slice(10, 13).map(t => `“${kit.esc(t.replace("▁", ""))}”`).join(" ")}. The counts suggest these tokenizers learned from little Uzbek text, and even less Uzbek in Cyrillic. A bigger vocabulary helps only the languages its training text was full of.`, true]
      : [`Look at the small “×” number next to each count, not the count itself. ${NAME[s]} is ${x1(COUNTS.qwen[s], COUNTS.qwen.en)}× English on Qwen2.5 and ${x1(COUNTS.xlmr[s], COUNTS.xlmr.en)}× on XLM-RoBERTa. One message is higher on both.`, false]);
    const paint = () => {
      const right1 = KEYS.indexOf(fewestKo);
      el.innerHTML = `<h1>A different tokenizer</h1>
        <p class="lead">Two more open tokenizers: ${kit.esc(TOK.qwen.label)}, ${kit.esc(TOK.qwen.what)}, and ${kit.esc(TOK.xlmr.label)}, ${kit.esc(TOK.xlmr.what)}.</p>
        ${stage === 0 ? `<p class="task">Which one splits the Korean message into the fewest tokens?</p>
          ${msgBox(kit, "ko")}
          <div class="lpanel">${kit.options(q1, { picked: ans, correct: right1 })}${ans == null ? "" : kit.feedback(...fb1[KEYS[ans]])}</div>` : `
          ${kit.feedback(`Right: XLM-RoBERTa made <b>${COUNTS.xlmr.ko}</b> tokens of the Korean message, as many as of the English one. Most of its pieces are whole Korean words or word endings (▁ marks a space before the piece):`, true)}
          ${chips(kit, KO_XLMR)}
          <p class="lead">Qwen2.5 made ${COUNTS.qwen.ko}, about one per syllable (␣ marks a space):</p>${chips(kit, KO_QWEN)}
          ${countTable(kit, KEYS)}
          <p class="lx-${ID}-cap">Tokens per message, and times the English count, from one run of each tokenizer.</p>
          ${stage === 1 ? `<p class="task">On the two newer tokenizers, which message is still the most expensive relative to English?</p>` : ""}
          <div class="lpanel">${stage === 1 ? `${kit.options(q2Opts, { picked: ans, correct: q2Right })}${ans == null ? "" : kit.feedback(...fb2[ans])}` : kit.feedback(...fb2[q2Right])}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (stage === 0 && ans === right1) { stage = 1; ans = null; paint(); return; }
        if (stage === 1 && ans === q2Right) { stage = 2; ans = null; paint(); done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. The same counts in Python with Hugging Face Tokenizers, a stepped replay of the traced run. */
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const ran = TRACE[k - 1][0], v = TRACE[k];
      fr.push({ ran, end: v[1] === "r", last: v[0] === 6 && v[1] === "l", script: v[2], n: v[3], counts: v[4] });
    }
    return fr;
  })();
  const sayFrame = (kit, f) => {
    if (f.end) return `Line 6 returns <code>${kit.esc(JSON.stringify(f.counts))}</code>, the GPT-2 counts from the first screen. The same function with XLM-RoBERTa's tokenizer returned <code>${kit.esc(JSON.stringify(XLMR_RESULT))}</code>. Nothing else changed: the tokenizer is the whole difference.`;
    if (f.ran === 1) return "<code>counts</code> starts as an empty dict, like an empty JS object.";
    if (f.ran === 2 && f.last) return "No messages left, so the loop ends.";
    if (f.ran === 2) return `The loop takes the next message: <code>script</code> is <code>"${kit.esc(f.script)}"</code>.`;
    if (f.ran === 3) return `<code>encode</code> (lines 3 and 4, one call) ran the tokenizer on the ${kit.esc(NAME[f.script])} message and returned an <code>Encoding</code> with ${plural(f.n, "token")}.${f.script === "en" ? ` <code>add_special_tokens=False</code> counts only your text. Left on, some tokenizers add marker tokens around your text: XLM-RoBERTa adds <code>${kit.esc(SPECIAL.ends[0])}</code> and <code>${kit.esc(SPECIAL.ends[1])}</code>, so the English message becomes ${SPECIAL.with} instead of ${SPECIAL.without}.` : ""}`;
    if (f.ran === 5) return `<code>len(encoding.ids)</code> is the count: <code>counts["${kit.esc(f.script)}"] = ${f.n}</code>. <code>ids</code> are the numbers the model reads; <code>tokens</code> holds the same pieces as text, and <code>offsets</code> says which characters each came from.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>Counting tokens in Python</h1>
        <p class="lead">The tool is Hugging Face Tokenizers. <code>Tokenizer.from_pretrained("${kit.esc(TOK.gpt2.id)}")</code> downloads a model's <code>tokenizer.json</code> from the Hugging Face Hub, a site that hosts models. The string is the model's id there. This run passed GPT-2's tokenizer and the four messages to the function below.</p>
        <p class="task">Step through to the end and watch the counts fill in.</p>
        ${kit.code(CODE, f.end ? 6 : f.ran)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>script <b>${kit.esc(f.script || "–")}</b></span><span>counts <b>${kit.esc(f.counts ? JSON.stringify(f.counts) : "–")}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. Broken on purpose: the same product name billed three times over. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const ratio = x1(REC_NFD.nfd, REC_NFD.nfc);
    const q1 = [
      "The catalogue line has hidden extra spaces",
      "The catalogue stores each syllable as separate letter parts, so it is a different string that looks the same",
      "Korean is simply expensive on this model",
      "The API billed the catalogue request on a different model"
    ];
    const fb1 = [
      [`Spaces would add a few tokens, not ${REC_NFD.nfd - REC_NFD.nfc}. And the length went from ${NFD.len[0]} to ${NFD.len[1]} characters for the same 4 words.`, false],
      ["", true],
      [`Both lines are the same Korean words. The typed line cost ${REC_NFD.nfc}. Whatever makes the other cost ${REC_NFD.nfd} is not the language.`, false],
      ["Both requests went to the same model, with the same settings; only the text differed. And Python already says the two strings are not equal.", false]
    ];
    const q2 = [
      "Switch to the XLM-RoBERTa tokenizer, which knows Korean words",
      "Normalize every text to NFC before you count it, send it or store it",
      "Strip spaces from catalogue lines",
      "Ask the supplier to send the catalogue in English"
    ];
    const fb2 = [
      [`It does not save you: XLM-RoBERTa has a normalizer, but it still made ${NFD.tok.xlmr[2]} tokens of the catalogue line against ${NFD.tok.xlmr[1]} of the typed one. And the bill comes from the hosted model's tokenizer, which you do not choose.`, false],
      [`Right. In Python, <code>unicodedata.normalize("NFC", text)</code>. After it, GPT-2 counts ${NFD.tok.gpt2[3]} again and XLM-RoBERTa ${NFD.tok.xlmr[3]}. Some tokenizers do this themselves: Qwen2.5's <code>tokenizer.json</code> has an NFC normalizer and counted ${NFD.tok.qwen[2]} for both. GPT-2's has none. The hosted model billed ${REC_NFD.nfd}, so do not count on the tokenizer to do it for you. Normalize once, where text enters your system.`, true],
      ["Spaces are not the problem: the words themselves are stored as separate letter parts, so every syllable becomes 2 or 3 characters.", false],
      ["The bot must show Korean customers Korean product names. The text is fine; only the way it is stored is different.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same name, three times the tokens</h1>
        <p class="lead">The bot quotes product names from the supplier's catalogue. One Korean name costs far more when it comes from the catalogue than when a staff member types it. The input tokens the hosted model billed for the name alone:</p>
        <div class="lx-${ID}-out">typed by staff:    ${REC_NFD.nfc} tokens
  ${kit.esc(PRODUCT)}
from the catalogue: ${REC_NFD.nfd} tokens
  ${kit.esc(PRODUCT.normalize("NFD"))}</div>
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="lead">The same two strings in Python (nfd_bug.py). A code point is the number Unicode gives one character, such as U+BB34.</p>
        <div class="lx-${ID}-out">equal: False
len: ${NFD.len[0]} ${NFD.len[1]}
first word code points: [${NFD.firstNfc.map(c => `'${c}'`).join(", ")}] [${NFD.firstNfd.map(c => `'${c}'`).join(", ")}]
utf8 bytes: ${NFD.bytes[0]} ${NFD.bytes[1]}</div>
        ${stage === 0 ? `<p class="task">The catalogue line costs ${ratio} times as much. What is the cause?</p>
          <div class="lpanel">${kit.options(q1, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(...fb1[ans])}</div>` : `
          ${kit.feedback(`Right. Unicode allows two forms of the same Korean text. <b>Composed</b> (NFC): “무” is one code point, ${kit.esc(NFD.firstNfc[0])}. <b>Decomposed</b> (NFD): the same syllable is two or three letter parts, ${kit.esc(NFD.firstNfd.slice(0, 2).join(" + "))}. They render the same, but they are different strings, so a tokenizer that does not normalize the text first sees different bytes. On GPT-2 the name went from ${NFD.tok.gpt2[1]} tokens to ${NFD.tok.gpt2[2]}. This setup was made on purpose in nfd_bug.py, by storing the catalogue line decomposed.`, true)}
          ${stage === 1 ? `<p class="task">What fix do you ship?</p>` : ""}
          <div class="lpanel">${stage === 1 ? `${kit.options(q2, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(...fb2[ans])}` : kit.feedback(...fb2[1])}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === 1) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 7. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Add Uzbek words to the hosted model's tokenizer",
      "Convert Cyrillic messages to Latin before sending them",
      "Measure your real messages on two or three candidate models and choose by cost and answer quality",
      "Normalize the text to NFC"
    ];
    const RIGHT = 2;
    const fb = [
      ["You cannot change a hosted model's tokenizer. Even on an open model, a new token needs its own embedding vector (the list of numbers the model has learned for each token), which starts untrained: you would have to fine-tune the model on text that uses the new tokens before it understood them. That is a training project, not a billing fix.", false],
      [`It saves less than it seems: on the hosted model, Latin cost ${BILL.uz_lat} tokens and Cyrillic ${BILL.uz_cyr}. And it changes what the customer wrote and reads, which the shop does not want.`, false],
      [`Right. The tokenizer comes with the model, so choosing a tokenizer means choosing a model. Count your own messages per language on each candidate (from its API's usage numbers, or its open tokenizer), and keep the one whose quality is good enough at a cost you accept.`, true],
      ["Worth doing, but it fixes a different problem: text stored in two forms. These customers' messages are already composed. Normalizing does not make Cyrillic cheaper.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When the tokenizer matters</h1>
        <p class="lead"><b>For:</b> knowing what a message in each language costs, and why. <b>Reach for it</b> when you serve several languages or scripts, when bills or context limits differ by language, or when the same text costs different amounts. <b>Not</b> when the cost is set by how much you send (long answers, more users, a growing prompt): the tokenizer is the same for all of it. <b>Costs:</b> every extra token is money, time, and room taken in the context window. Switching models to get a better tokenizer means re-testing quality.</p>
        <p class="task">The shop may change models when its current plan ends. Uzbek costs about twice as much as English. What is the realistic move?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A travel agency's chatbot answers in English and Georgian. The same answer costs noticeably more input tokens in Georgian.", true,
      "Yes. Same meaning, different count: count both on the model's tokenizer, see which pieces Georgian falls into, and compare candidate models on your own messages.",
      "This is the lesson's pattern: same meaning, more tokens in one script. Measure per language on the tokenizer you pay for; the cause is what that tokenizer learned from."],
    ["An English-only bot's monthly bill doubled after the number of users doubled. Tokens per message did not change.", false,
      "No. Each message costs the same as before; there are simply twice as many. Changing the tokenizer would not stop the bill from following the number of users.",
      "Tokens per message did not move, so the tokenizer is not the cause. The bill follows the number of messages. Look at usage, caching or limits, not at the tokenizer."],
    ["A search box finds “joʻnatildi” in the catalogue only when the customer types the turned comma ʻ, not the keyboard apostrophe '.", true,
      "Yes. It is the same kind of fault as the decomposed Korean: two strings that look alike are different code points. Here NFC does not help (our run: the two are still not equal after NFC), so you map the apostrophe forms to one before you search or tokenize.",
      "Look closer: the two words look the same but use different characters, U+02BB and U+0027. That is a text-form problem, found the same way as the decomposed Korean, with a fix of its own: map the apostrophe forms to one."],
    ["A Korean customer says the bot's answer was wrong about a product's warranty, which is written in the product's Korean manual.", false,
      "No. Token counts explain cost and how much fits in the context, not whether the bot found the right page. Check whether the manual's text was retrieved and given to the model first.",
      "A wrong fact is usually a retrieval or prompt problem: was the warranty page given to the model at all? The token count of Korean does not decide that."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Tokenizer problem or not?</h1>
        <p class="lead">Four reports from other teams.</p>
        <p class="task">Is each one a case for looking at how the text is tokenized or encoded? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next: the notebook and its checklist. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s4-korean-uzbek-tokens.ipynb";
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const CHECK = [
      `GPT-2's tokenizer prints ${G.en} tokens for the English message and ${G.ko} for the Korean one`,
      `The first three Korean tokens all have offsets (${KO_FIRST.offsets[0].join(", ")}), and decoding them together gives “${KO_FIRST.dec3}”`,
      `The same function with XLM-RoBERTa returns {${SCRIPTS.map(s => `'${s}': ${XLMR_RESULT[s]}`).join(", ")}}`,
      `The decomposed product name has length ${NFD.len[1]} against ${NFD.len[0]}, and GPT-2 counts ${NFD.tok.gpt2[2]} tokens against ${NFD.tok.gpt2[1]}`,
      `After unicodedata.normalize("NFC", ...) the count is back to ${NFD.tok.gpt2[3]}`
    ];
    el.innerHTML = `<h1>You can read a tokenizer's bill</h1>
      <p class="lead">You predicted and measured token counts in four scripts, found tokens that are half a letter, traced the cost to what the tokenizer learned from, fixed a name stored in two Unicode forms, and saw that choosing a tokenizer means choosing a model.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a>.` : "The notebook for this lesson is on its way."} You load the three tokenizers with Hugging Face Tokenizers and run the same messages. What you should see:</p>
      <div class="lpanel lx-${ID}-checks">${CHECK.map((c, i) => `<button type="button" class="lx-${ID}-tick" aria-pressed="false" data-ck="${i}"><span class="lx-${ID}-box" aria-hidden="true"></span><span>${kit.esc(c)}</span></button>`).join("")}</div>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Once text is tokens, the next step turns it into numbers a model can compare, and you will see what simple counting throws away.</p>` : ""}`;
    el.querySelectorAll("[data-ck]").forEach(b => b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"));
    done();
  }

  LessonKit.define(ID, {
    title: "Korean and Uzbek in a real tokenizer",
    checked: "2026-11-13",
    sources: [
      "https://huggingface.co/docs/tokenizers/quicktour",
      "https://huggingface.co/docs/tokenizers/v0.20.3/en/api/encoding",
      "https://huggingface.co/docs/tokenizers/api/normalizers",
      "https://huggingface.co/learn/llm-course/chapter6/5",
      "https://huggingface.co/openai-community/gpt2",
      "https://huggingface.co/FacebookAI/xlm-roberta-base",
      "https://huggingface.co/docs/transformers/main_classes/model",
      "https://unicode.org/reports/tr15/",
      "https://www.rfc-editor.org/rfc/rfc3629",
      "https://openrouter.ai/docs/guides/administration/usage-accounting"
    ],
    interview: [
      {
        q: "Your multilingual support bot costs about twice as much per conversation in Uzbek as in English. How do you find out why, and what do you do about it?",
        good: [
          "Count tokens per language for the same messages on the model's own tokenizer, or from the API's usage numbers",
          "Look at the pieces: words falling apart into short pieces or single bytes means the tokenizer saw little of that language",
          "Check the text form too: decomposed Unicode or mixed apostrophes can inflate counts; normalize to NFC where text enters",
          "Compare two or three candidate models on real messages for cost and answer quality",
          "Do not add tokens to a hosted model: you cannot, and on an open model new tokens need training"
        ],
        weak: "Say Uzbek is just a harder language, or shorten the answers, without measuring tokens per language or looking at how the text is split."
      },
      {
        q: "The same Korean product name sometimes costs three times the tokens. The strings look identical in the logs. What is going on?",
        good: [
          "Compare the strings in code: equality, length and code points, not how they look",
          "Hangul can be stored composed (NFC) or decomposed into letter parts (NFD); both render the same",
          "Decomposed text is more code points and more bytes, so the tokenizer makes more pieces",
          "Normalize with NFC once at the input boundary; do not rely on the tokenizer to do it"
        ],
        weak: "Blame the model provider's billing, or retry the request, without checking whether the two strings are actually the same."
      }
    ],
    screens: [predict, halfLetters, spotIdea, otherTokenizers, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: [`[data-i="${WHOLE_FIRST}"]`], right: HALF.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
