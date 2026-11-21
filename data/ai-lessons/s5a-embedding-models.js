/* Lesson s5a-embedding-models: Embedding models, from word vectors to sentences.
   Story: a cosmetics brand's review search. Shoppers type in Korean or English and expect matching reviews in
   either language. The search runs on an English-only embedding model, and Korean queries come back with junk.
   Ideas: (1) a bi-encoder turns each text, on its own, into one vector: the model makes a vector per token and
   mean pooling averages them; cosine similarity compares two such vectors. (2) Which model you pick decides what
   it can read: an English-only vocabulary cuts Korean into single letters. Test candidate models on your own
   queries and count hits before you choose.
   Data: every score, token list and vector below comes from a run on this Mac of two real sentence-transformers
   models (all-MiniLM-L6-v2 and paraphrase-multilingual-MiniLM-L12-v2) with a NumPy forward pass. Only the
   English model's pass was checked against references (its official ONNX export, and sentence-transformers
   itself in library.py: every score within 5e-05, every top 3 the same); the multilingual model runs
   through the same code with its own tokenizer and weights but was not checked against a reference:
     docs/ai-path/runs/s5a-embedding-models/search.py   -> search.out.txt, search.json (scores, tokens, pooling)
     docs/ai-path/runs/s5a-embedding-models/trace.py    -> trace.out.txt  (the stepped code screen)
     docs/ai-path/runs/s5a-embedding-models/trunc.py    -> trunc.out.txt  (max_seq_length screen)
     docs/ai-path/runs/s5a-embedding-models/validate.py -> validate.out.txt (NumPy against ONNX, English model)
     docs/ai-path/runs/s5a-embedding-models/configs.py  -> configs.out.txt  (max_seq_length, vector size, prompts)
     docs/ai-path/runs/s5a-embedding-models/library.py  -> library.out.txt  (screen 7: the English model through
       sentence-transformers itself, compared score by score with the NumPy pass; the multilingual model was not
       run through the library, see env.txt)
   The reviews and queries are written by us (docs/ai-path/runs/s5a-embedding-models/data.py), not real
   customers and not model output.
   No model API calls were recorded for this lesson. Lesson-local CSS: classes prefixed lx-s5a-embedding-models-. */
(() => {
  const ID = "s5a-embedding-models", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5a-embedding-models.ipynb";
  const RUN_DATE = "2026-11-13", LIB_DATE = "2026-11-14";
  const MODEL = {
    en: { short: "English model", name: "all-MiniLM-L6-v2", layers: 6, maxLen: 256 },
    ml: { short: "multilingual model", name: "paraphrase-multilingual-MiniLM-L12-v2", layers: 12, maxLen: 128 }
  };

  // data.py: [id, language, topic, text, our English gloss for Korean]
  const REVIEWS = [
    ["r01", "en", "clear", "This sunscreen goes on clear and leaves no chalky film on my face."],
    ["r02", "ko", "clear", "백탁 현상이 전혀 없고 투명하게 스며들어요.", "No chalky cast at all; it sinks in clear."],
    ["r03", "en", "sting", "The sunscreen ran into my eyes when I sweated and they stung for an hour."],
    ["r04", "ko", "sting", "땀 흘리니까 선크림이 눈에 들어가서 너무 따가웠어요.", "When I sweated, the sunscreen got into my eyes and stung a lot."],
    ["r05", "en", "dry", "My dry skin finally feels soft and hydrated all day with this cream."],
    ["r06", "ko", "dry", "건조한 피부인데 이 크림 바르고 하루 종일 촉촉해요.", "I have dry skin, and with this cream it stays moist all day."],
    ["r07", "en", "greasy", "Way too heavy and greasy for oily skin, my face shines by noon."],
    ["r08", "ko", "greasy", "지성 피부에는 너무 무겁고 번들거려요. 점심쯤이면 얼굴이 기름져요.", "Too heavy and shiny for oily skin. By lunch my face is greasy."],
    ["r09", "en", "gentle", "A gentle cleanser that doesn't leave my face tight after washing."],
    ["r10", "ko", "gentle", "세안 후에도 당기지 않고 순한 클렌저예요.", "A mild cleanser; my skin does not feel tight even after washing."],
    ["r11", "en", "scent", "The cleanser smells like strong perfume, the scent gave me a headache."],
    ["r12", "ko", "scent", "클렌저 향이 너무 강해서 머리가 아팠어요.", "The cleanser's scent is so strong it gave me a headache."],
    ["r13", "en", "lasting", "The lip tint stayed on through lunch and coffee without fading."],
    ["r14", "ko", "lasting", "립틴트가 밥 먹고 커피 마셔도 지워지지 않고 오래가요.", "The lip tint stays on through a meal and coffee; it lasts long."],
    ["r15", "en", "flaky", "This tint dries out my lips and makes them flaky."],
    ["r16", "ko", "flaky", "틴트 바르면 입술이 건조해지고 각질이 일어나요.", "When I put on the tint, my lips get dry and start to peel."],
    ["r17", "en", "acne", "After two weeks of this toner my breakouts calmed down."],
    ["r18", "ko", "acne", "이 토너 2주 쓰고 나서 여드름이 많이 가라앉았어요.", "After two weeks of this toner, my acne calmed down a lot."],
    ["r19", "en", "itchy", "The toner made my cheeks sting and itch, so I stopped using it."],
    ["r20", "ko", "itchy", "토너 쓰고 볼이 화끈거리고 가려워서 사용을 중단했어요.", "After the toner my cheeks burned and itched, so I stopped."],
    ["r21", "en", "leak", "The bottle arrived cracked and half the serum had leaked into the box."],
    ["r22", "ko", "leak", "배송 왔는데 병이 깨져서 세럼이 상자에 다 새어 있었어요.", "It was delivered with the bottle broken and the serum leaked all over the box."],
    ["r23", "en", "oxidize", "The cushion shade matched at first but oxidized after an hour."],
    ["r24", "ko", "oxidize", "쿠션이 처음엔 잘 맞는데 한 시간 지나면 산화돼서 톤이 안 맞아요.", "The cushion matches at first, but after an hour it oxidizes and no longer matches."]
  ];
  const QUERIES = [
    ["q01", "ko", "clear", "백탁 없는 선크림", "sunscreen without a chalky cast"],
    ["q02", "ko", "greasy", "지성 피부에 번들거리는 크림", "cream that turns shiny on oily skin"],
    ["q03", "ko", "flaky", "입술이 건조해지는 틴트", "tint that dries the lips"],
    ["q04", "ko", "scent", "향이 강한 클렌저", "cleanser with a strong scent"],
    ["q05", "ko", "leak", "배송 중 파손", "damaged in shipping"],
    ["q06", "en", "sting", "sunscreen that stings the eyes"],
    ["q07", "en", "dry", "moisturizer for dry skin"],
    ["q08", "en", "lasting", "long-lasting lip tint"],
    ["q09", "en", "acne", "toner that cleared my acne"],
    ["q10", "en", "oxidize", "foundation that oxidizes"]
  ];
  const R = Object.fromEntries(REVIEWS.map(([id, lang, topic, text, gloss]) => [id, { id, lang, topic, text, gloss }]));
  const Q = Object.fromEntries(QUERIES.map(([id, lang, topic, text, gloss]) => [id, { id, lang, topic, text, gloss }]));

  // search.out.txt: the top 3 reviews each model returned for each query, with cosine scores (not altered)
  const TOP3 = {
    en: {
      q01: [["r04", 0.8635], ["r12", 0.7196], ["r20", 0.6608]], q02: [["r12", 0.8398], ["r06", 0.8016], ["r08", 0.7648]],
      q03: [["r14", 0.8355], ["r08", 0.8019], ["r16", 0.7742]], q04: [["r12", 0.8611], ["r10", 0.7926], ["r20", 0.7636]],
      q05: [["r10", 0.7609], ["r06", 0.7061], ["r02", 0.7015]], q06: [["r03", 0.7413], ["r01", 0.6091], ["r09", 0.4308]],
      q07: [["r05", 0.6638], ["r07", 0.4335], ["r09", 0.4102]], q08: [["r13", 0.7434], ["r15", 0.6886], ["r17", 0.4991]],
      q09: [["r19", 0.7197], ["r17", 0.7169], ["r15", 0.4907]], q10: [["r23", 0.3412], ["r09", 0.2768], ["r01", 0.2328]]
    },
    ml: {
      q01: [["r06", 0.6306], ["r02", 0.6273], ["r10", 0.617]], q02: [["r06", 0.7178], ["r16", 0.5965], ["r08", 0.5917]],
      q03: [["r16", 0.5584], ["r06", 0.4688], ["r15", 0.4215]], q04: [["r06", 0.3629], ["r10", 0.3526], ["r16", 0.351]],
      q05: [["r22", 0.6432], ["r10", 0.4565], ["r21", 0.423]], q06: [["r03", 0.7622], ["r01", 0.6666], ["r04", 0.6528]],
      q07: [["r05", 0.7106], ["r06", 0.6902], ["r09", 0.5506]], q08: [["r15", 0.7101], ["r16", 0.6146], ["r06", 0.5316]],
      q09: [["r19", 0.5898], ["r15", 0.5157], ["r06", 0.5061]], q10: [["r23", 0.3278], ["r10", 0.2633], ["r21", 0.1896]]
    }
  };
  // search.json: single scores used on the prediction screen (not altered)
  const PAIR = {
    "q07:r06": { en: 0.0817, ml: 0.6902 }, "q07:r09": { en: 0.4102, ml: 0.5506 },
    "q06:r04": { en: 0.0104, ml: 0.6528 }, "q06:r01": { en: 0.6091, ml: 0.6666 },
    "q08:r13": { en: 0.7434, ml: 0.512 }, "q08:r15": { en: 0.6886, ml: 0.7101 }
  };
  // search.out.txt: tokens of query q01 in each model's own tokenizer
  const TOK_Q01 = {
    en: ["[CLS]", "ᄇ", "##ᅢ", "##ᆨ", "##ᄐ", "##ᅡ", "##ᆨ", "[UNK]", "ᄉ", "##ᅥ", "##ᆫ", "##ᄏ", "##ᅳ", "##ᄅ", "##ᅵ", "##ᆷ", "[SEP]"],
    ml: ["<s>", "▁백", "탁", "▁없는", "▁선", "크림", "</s>"]
  };
  // search.out.txt: cosine between two unrelated reviews (r04 eyes stinging, r22 broken bottle; r03 and r21 in English)
  const LOOKALIKE = { en: { ko: 0.6841, en: 0.3856 }, ml: { ko: 0.3042, en: 0.2507 } };
  // search.out.txt: "dry lips" in the multilingual model: 4 token vectors (first 3 of 384 numbers) and the model's pooled vector
  const DRY = {
    tokens: ["<s>", "▁dry", "▁lips", "</s>"],
    vecs: [[-0.0812, -0.2103, 0.103], [-0.4754, 0.0846, 0.5215], [-0.2373, -0.6468, 0.2204], [-0.0833, -0.2096, 0.1039]],
    pooled: [-0.2193, -0.2455, 0.2372], dim: 384
  };
  // search.out.txt: bytes in each model.safetensors, and in its vocabulary table
  const SIZE = { en: { rows: 30522, all: 90856960, vocab: 46881792 }, ml: { rows: 250037, all: 470619136, vocab: 384056832 } };
  // trunc.out.txt: query q06 against a 175-token sunscreen review (the multilingual model reads 128 tokens)
  const TRUNC = { tokens: 175, read: 128, last: 0.6508, alone: 0.5706, first: 0.7474,
    end: "But on the hot afternoons the sweat carried it into my eyes and they stung badly for an hour." };

  // trace.out.txt: match(q06 token vectors, r04 token vectors), multilingual model. Listing = traced source.
  const CODE = [
    "def match(query_tokens, review_tokens):",
    "    query_vec = query_tokens.mean(axis=0)",
    "    review_vec = review_tokens.mean(axis=0)",
    "    dot = query_vec @ review_vec",
    "    query_len = np.linalg.norm(query_vec)",
    "    review_len = np.linalg.norm(review_vec)",
    "    score = dot / (query_len * review_len)",
    "    return score"
  ];
  const TR = {
    qShape: [9, 384], rShape: [20, 384], qTok0: [-0.159, 0.2546, 0.2458], rTok0: [-0.0283, 0.4666, 0.2681],
    qVec: [-0.2165, -0.0585, 0.3798], rVec: [-0.0278, 0.2682, 0.3045], dot: 14.5669, qLen: 5.5237, rLen: 4.0398, score: 0.6528,
    steps: [  // [line about to run (or returned), event]
      [1, "line"], [2, "line"], [3, "line"], [4, "line"], [5, "line"], [6, "line"], [7, "line"], [7, "return"]
    ]
  };

  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const f3 = x => (Math.round(x * 1000) / 1000).toFixed(3);
  const mb = b => (b / 1e6).toFixed(1);
  const pct = (a, b) => Math.round(a / b * 100);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const relevant = (qid, rid) => Q[qid].topic === R[rid].topic;
  const hits = (m, filter = () => true) => QUERIES.reduce((n, [qid]) => n + TOP3[m][qid].filter(([rid]) => relevant(qid, rid) && filter(qid, rid)).length, 0);
  const STATS = ["en", "ml"].map(m => ({
    m,
    ko: hits(m, qid => Q[qid].lang === "ko"),
    en: hits(m, qid => Q[qid].lang === "en"),
    cross: hits(m, (qid, rid) => Q[qid].lang !== R[rid].lang),
    all: hits(m)
  }));
  const ST = { en: STATS[0], ml: STATS[1] };
  const MAXH = QUERIES.length * 2, MAXL = MAXH / 2;
  const sameLangKoHits = QUERIES.filter(q => q[1] === "ko").flatMap(([qid]) => TOP3.en[qid].filter(([rid]) => relevant(qid, rid)).map(([rid]) => [qid, rid]));

  /* Lesson-local styles. Called by every screen, so a reload halfway still has them. */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}q { margin: 12px 0 0; padding: 10px 14px; border: 1.5px solid var(--ink-2); border-radius: 8px; background: var(--surface); }
      .${P}q .t { font: 600 16px/1.4 var(--font); color: var(--ink); }
      .${P}g { font: 400 13.5px/1.4 var(--font); color: var(--muted); margin-top: 2px; }
      .${P}list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
      .${P}list h3 { font: 600 13px var(--mono); color: var(--muted); margin: 10px 0 0; }
      .${P}row { display: grid; grid-template-columns: 2.6em 1fr auto; gap: 8px; align-items: start; text-align: left; width: 100%; min-height: 48px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: 400 15px/1.45 var(--font); }
      button.${P}row { cursor: pointer; }
      .${P}row .id { font: 600 13px var(--mono); color: var(--muted); padding-top: 2px; }
      .${P}row .sc { font: 600 13px var(--mono); color: var(--ink-2); padding-top: 2px; }
      .${P}row .tx { overflow-wrap: anywhere; }
      .${P}row .lang { font: 600 11.5px var(--mono); color: var(--muted); margin-right: 6px; }
      .${P}row.on { border-color: var(--good); background: var(--good-soft); }
      .${P}row.on .id::after { content: " ✓"; color: var(--ink); }
      .${P}row.bad { border-color: var(--bad); background: var(--bad-soft); }
      .${P}check-btn { margin-top: 12px; min-height: 48px; padding: 10px 18px; }
      .${P}toks { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 0; }
      .${P}toks span { font: 500 13px var(--mono); padding: 4px 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--sunk); color: var(--ink); }
      .${P}toks span.unk { border: 1.5px solid var(--bad); }
      .${P}cap { font: 500 12.5px var(--mono); color: var(--muted); margin: 6px 0 0; }
      .${P}grid { border-collapse: collapse; margin: 12px 0 0; font: 500 14px var(--mono); }
      .${P}grid th, .${P}grid td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: right; color: var(--ink); }
      .${P}grid th { font-weight: 600; color: var(--muted); }
      .${P}grid td:first-child, .${P}grid th:first-child { text-align: left; }
      .${P}grid tr.tot td { border-top: 2px solid var(--ink-2); font-weight: 700; }
      .${P}wrap { overflow-x: auto; max-width: 100%; }
      .${P}out { margin: 10px 0 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); color: var(--ink); font: 500 13px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}pair { display: grid; grid-template-columns: 1fr; gap: 6px; margin: 8px 0; }
      .${P}stat { font: 500 14px/1.6 var(--font); color: var(--ink); }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
      @media (max-width: 480px) { .${P}row { font-size: 14px; padding: 9px 10px; grid-template-columns: 2.4em 1fr auto; } .${P}grid th, .${P}grid td { padding: 5px 6px; font-size: 12.5px; } }
    `;
    document.head.appendChild(s);
  }

  // one review as a row; pick = button with data-i
  const reviewRow = (rid, { key = null, score = null, cls = "" } = {}) => {
    const r = R[rid], tag = key ? "button" : "div";
    return `<${tag}${key ? ` type="button" data-i="${esc(key)}" aria-pressed="${cls.includes("on")}"` : ""} class="${P}row ${cls}">
      <span class="id">${r.id}</span>
      <span class="tx"><span class="lang">${r.lang.toUpperCase()}</span>${esc(r.text)}${r.gloss ? `<span class="${P}g" style="display:block">${esc(r.gloss)}</span>` : ""}</span>
      <span class="sc">${score == null ? "" : f3(score)}</span></${tag}>`;
  };
  const queryBox = qid => { const q = Q[qid]; return `<div class="${P}q"><div class="t">${esc(q.text)}</div>${q.gloss ? `<div class="${P}g">${esc(q.gloss)} (our translation)</div>` : ""}</div>`; };
  const toks = (list, unk = false) => `<div class="${P}toks">${list.map(t => `<span class="${unk && t === "[UNK]" ? "unk" : ""}">${esc(t)}</span>`).join("")}</div>`;

  /* 1. The situation: which reviews should a shopper's Korean query find? */
  const S1_Q = "q05", S1_POOL = ["r22", "r11", "r21", "r10", "r24"];
  function situation({ el, done, kit }) {
    css();
    const on = new Set();
    let msg = null, ok = false;
    const paint = () => {
      el.innerHTML = `<h1>A review search that only reads English</h1>
        <p class="lead">A cosmetics brand lets shoppers search its product reviews. Half the shoppers type in Korean, half in English, and the reviews are in both languages too. Shoppers expect a matching review whatever language it was written in. The search turns every text into a list of numbers (a vector) with an <b>embedding model</b> and returns the reviews whose numbers are closest to the query's. Korean queries keep coming back with reviews about something else.</p>
        <p class="lead">Finding the right texts by meaning is the search step behind most AI assistants that answer from your own documents. This lesson is about the model that makes those numbers, and how to choose one.</p>
        <p class="lead">Before blaming the model, decide what a good answer looks like. A shopper typed this query:</p>
        ${queryBox(S1_Q)}
        <p class="task">Tap every review that answers this shopper, in either language. Then press Check.</p>
        <div class="${P}list">${S1_POOL.map(rid => reviewRow(rid, { key: rid, cls: on.has(rid) ? "on" : "" })).join("")}</div>
        <button type="button" class="btn ${P}check-btn" data-check>Check</button>
        <div class="lpanel">${msg || ""}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => { const k = b.dataset.i; on.has(k) ? on.delete(k) : on.add(k); paint(); });
      el.querySelector("[data-check]").onclick = () => {
        const wrongOn = [...on].filter(rid => !relevant(S1_Q, rid));
        const missed = S1_POOL.filter(rid => relevant(S1_Q, rid) && !on.has(rid));
        if (wrongOn.length) {
          const r = R[wrongOn[0]];
          msg = kit.feedback(`${r.id} is a review of the ${r.topic === "scent" ? "cleanser's scent" : r.topic === "gentle" ? "cleanser being mild" : "cushion changing shade"}, not of a parcel that arrived broken. Sharing a product word or the language with the query does not make it an answer.`, false);
          ok = false;
        } else if (missed.length) {
          const r = R[missed[0]];
          msg = kit.feedback(`One answer is still unmarked: ${r.id}, a ${r.lang === "en" ? "review in English" : "review in Korean"} about a bottle that arrived broken. The shopper wants it even though ${r.lang === "en" ? "it is not in Korean" : "it is in Korean"}: the meaning matches, the language does not have to.`, false);
          ok = false;
        } else {
          ok = true;
          msg = kit.feedback(`Right: r21 and r22 both describe a bottle broken in delivery, one in English and one in Korean. A good search returns both for this query. Keep this in mind: "relevant" is about meaning, never about sharing the query's language. On the next screen you judge what two real models returned.`, true);
          paint(); done(); return;
        }
        paint();
      };
    };
    paint();
  }

  /* 2. By hand: mark the top 3 two real models returned, count hits. */
  const S2_QS = ["q05", "q07"];
  function byHand({ el, done, kit }) {
    css();
    const on = new Set();
    let msg = null, fin = false, bad = null;
    const key = (qid, m, k) => `${qid}-${m}-${k}`;
    const paint = () => {
      const block = (qid, m) => `<h3>${MODEL[m].short}</h3>${TOP3[m][qid].map(([rid, sc], k) => {
        const kk = key(qid, m, k);
        return reviewRow(rid, { key: fin ? null : kk, score: sc, cls: (on.has(kk) ? "on " : "") + (bad === kk ? "bad" : "") });
      }).join("")}`;
      const hitsHere = m => S2_QS.reduce((n, qid) => n + TOP3[m][qid].filter(([rid]) => relevant(qid, rid)).length, 0);
      el.innerHTML = `<h1>Judge two models by hand</h1>
        <p class="lead">The team tried two real, free embedding models on the same 24 reviews: the <b>${MODEL.en.short}</b> they use now (${MODEL.en.name}) and a <b>${MODEL.ml.short}</b> (${MODEL.ml.name}). For each query, each model returned its 3 closest reviews. The number on the right is the model's score: higher means closer. A returned review that really answers its query is a <b>hit</b>.</p>
        <p class="task">Tap every returned review that really answers its query. Then press Count hits.</p>
        ${S2_QS.map(qid => `${queryBox(qid)}<div class="${P}list">${block(qid, "en")}${block(qid, "ml")}</div>`).join("")}
        ${fin ? "" : `<button type="button" class="btn ${P}check-btn" data-check>Count hits</button>`}
        <div class="lpanel">${msg || ""}
        ${fin ? `<div class="${P}wrap"><table class="${P}grid"><caption class="${P}cap" style="caption-side:top;text-align:left">All ${QUERIES.length} queries, counted the same way (top 3 each, ${MAXH} possible hits)</caption>
          <thead><tr><th></th><th>${MODEL.en.short}</th><th>${MODEL.ml.short}</th></tr></thead><tbody>
          <tr><td>Korean queries (${MAXL} possible)</td><td>${ST.en.ko}</td><td>${ST.ml.ko}</td></tr>
          <tr><td>English queries (${MAXL} possible)</td><td>${ST.en.en}</td><td>${ST.ml.en}</td></tr>
          <tr><td>…of all hits, in the other language</td><td>${ST.en.cross}</td><td>${ST.ml.cross}</td></tr>
          <tr class="tot"><td>All hits</td><td>${ST.en.all}</td><td>${ST.ml.all}</td></tr></tbody></table></div>
          <p class="${P}cap">From our run of both models on this Mac, ${RUN_DATE}.</p>` : ""}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => { const k = b.dataset.i; on.has(k) ? on.delete(k) : on.add(k); bad = null; paint(); });
      const c = el.querySelector("[data-check]");
      if (c) c.onclick = () => {
        let wrong = null, miss = null;
        for (const qid of S2_QS) for (const m of ["en", "ml"]) TOP3[m][qid].forEach(([rid], k) => {
          const kk = key(qid, m, k), rel = relevant(qid, rid);
          if (on.has(kk) && !rel && !wrong) wrong = [kk, qid, rid];
          if (!on.has(kk) && rel && !miss) miss = [kk, qid, rid];
        });
        if (wrong) {
          const [kk, qid, rid] = wrong; bad = kk;
          msg = kit.feedback(`You marked ${rid} under "${esc(Q[qid].gloss || Q[qid].text)}". ${esc(R[rid].gloss || R[rid].text)} That is a different complaint. A high score is the model's guess, not proof that the review answers the query.`, false);
        } else if (miss) {
          const [kk, qid, rid] = miss; bad = kk;
          msg = kit.feedback(`One returned review answers its query but is unmarked: ${rid} (${R[rid].lang === "ko" ? "in Korean" : "in English"}) under "${esc(Q[qid].gloss || Q[qid].text)}". Read it again: ${esc(R[rid].gloss || R[rid].text)}`, false);
        } else {
          fin = true; bad = null;
          msg = kit.feedback(`Counted. On these two queries the ${MODEL.en.short} has ${hitsHere("en")} ${hitsHere("en") === 1 ? "hit" : "hits"} and the ${MODEL.ml.short} has ${hitsHere("ml")}. For the Korean query the ${MODEL.en.short} returned three Korean reviews about other things. Across all ${QUERIES.length} queries:`, true);
          paint(); done(); return;
        }
        paint();
      };
    };
    paint();
  }

  /* 3. Spot the idea: why the English model fails on Korean. */
  function spot({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Its vectors are too short: 384 numbers cannot hold two languages.",
      "It never learned Korean: its vocabulary has no Korean word pieces.",
      "Cosine scores cannot compare a Korean text with an English one.",
      "The Korean reviews are too short to embed well."
    ];
    const correct = 1;
    const top = TOP3.en.q01[0];
    const fb = [
      `Both models make vectors of exactly 384 numbers, and the ${MODEL.ml.short} found ${ST.ml.ko} hits on Korean queries with them. Length is not the difference.`,
      "",
      `The ${MODEL.ml.short} scored the Korean review r04 at ${f3(PAIR["q06:r04"].ml)} for the English query "${Q.q06.text}" and returned it in its top 3. A score compares two lists of numbers; it does not care which language made them.`,
      `The Korean reviews are about as long as the English ones (r08 is one of the longest). And the ${MODEL.en.short} gives two unrelated Korean reviews a score of ${f3(LOOKALIKE.en.ko)}: it is not missing detail, it cannot tell them apart.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>What does the English model see?</h1>
        <p class="lead">Before a model makes any numbers, its <b>tokenizer</b> cuts the text into pieces from a fixed vocabulary. Here is the Korean query "${esc(Q.q01.text)}" (${esc(Q.q01.gloss)}), cut by each model's own tokenizer:</p>
        <p class="${P}cap">${MODEL.en.short}: ${TOK_Q01.en.length} pieces</p>${toks(TOK_Q01.en, true)}
        <p class="${P}cap">Ringed piece: [UNK], the mark for a piece the vocabulary does not have. ## marks a piece glued to the one before it. [CLS] and [SEP] are start and end marks the tokenizer adds.</p>
        <p class="${P}cap">${MODEL.ml.short}: ${TOK_Q01.ml.length} pieces</p>${toks(TOK_Q01.ml)}
        <p class="${P}cap">▁ marks the start of a word. &lt;s&gt; and &lt;/s&gt; are its start and end marks.</p>
        <p class="lead">Two more facts from the same run. The ${MODEL.en.short}'s best match for this query is ${top[0]} (eyes stinging), with a score of ${f3(top[1])}: higher than any score it gave a right answer to an English query. And it scores two unrelated Korean reviews (r04, eyes; r22, broken bottle) at ${f3(LOOKALIKE.en.ko)}, while two unrelated English reviews get ${f3(LOOKALIKE.en.en)}.</p>
        <p class="task">Why does the ${MODEL.en.short} rank Korean reviews so badly?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The ${MODEL.en.short}'s vocabulary has ${SIZE.en.rows.toLocaleString("en")} pieces, mostly English, so Korean comes out as single letters (ᄇ, ##ᅢ …) and an unknown mark [UNK]. Letters carry almost no meaning, so every Korean text gets a similar vector, and high scores between unrelated Korean texts mean nothing. Its ${sameLangKoHits.length} Korean hits came from shared letter runs: the query ${esc(Q[sameLangKoHits[0][0]].text)} and review ${sameLangKoHits[0][1]} both contain 번들거, for example. That is a spelling match, not understanding. The ${MODEL.ml.short} has a vocabulary of ${SIZE.ml.rows.toLocaleString("en")} pieces in 50+ languages, so Korean comes out as real word pieces. A model can only understand what its vocabulary and training covered.`, true)
          : kit.feedback(fb[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Mean pooling by hand: four token vectors into one sentence vector. */
  function pooling({ el, done, kit }) {
    css();
    let ans = null;
    const col0 = DRY.vecs.map(v => v[0]);
    const mean0 = col0.reduce((a, b) => a + b, 0) / col0.length;
    const sum0 = col0.reduce((a, b) => a + b, 0);
    const vals = [mean0, sum0, col0[0], col0[1]];
    const order = [2, 0, 3, 1]; // shown order of the four candidates
    const correct = order.indexOf(0);
    const means = [0, 1, 2].map(d => DRY.vecs.reduce((a, v) => a + v[d], 0) / DRY.vecs.length);
    const fb = {
      1: `${f3(sum0)} is the sum of the four numbers. A sum grows with every token, so a long review would get bigger numbers than a short one just for being long. Divide by the number of tokens: that is the mean.`,
      2: `${f3(col0[0])} is just the first token, <code>&lt;s&gt;</code>, a start marker the tokenizer adds to every text. Some models do use the first token as the sentence vector, but this model's settings say mean pooling. Look at all four rows.`,
      3: `${f3(col0[1])} is the "dry" token alone. A sentence vector must stand for the whole text, "lips" included, so every token gets a say.`
    };
    const paint = () => {
      el.innerHTML = `<h1>Four token vectors, one sentence vector</h1>
        <p class="lead">You know word vectors: one list of numbers per word. A model like this one (a transformer encoder, the BERT kind) goes further: it makes one vector per token, and each token's vector is shaped by the words around it. But the search needs one vector per text. Here is the ${MODEL.ml.short}'s real output for the text "dry lips": ${DRY.tokens.length} tokens, each with ${DRY.dim} numbers. Only the first 3 numbers of each are shown.</p>
        <div class="${P}wrap"><table class="${P}grid"><thead><tr><th>token</th><th>number 1</th><th>number 2</th><th>number 3</th></tr></thead><tbody>
          ${DRY.tokens.map((t, i) => `<tr><td>${esc(t)}</td>${DRY.vecs[i].map(x => `<td>${x.toFixed(4)}</td>`).join("")}</tr>`).join("")}
          ${ans === correct ? `<tr class="tot"><td>sentence</td>${means.map(x => `<td>${x.toFixed(4)}</td>`).join("")}</tr>` : ""}
        </tbody></table></div>
        <p class="${P}cap">From our run of the ${MODEL.ml.short}, ${RUN_DATE}.</p>
        <p class="task">This model's settings say "mean tokens". What is number 1 of the sentence vector for "dry lips"?</p>
        <div class="lpanel">${kit.options(order.map(i => f3(vals[i])), { picked: ans, correct, num: true })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right: (${col0.map(x => x.toFixed(4)).join(" + ")}) / ${col0.length} = ${mean0.toFixed(4)}. Do the same for every one of the ${DRY.dim} columns and you get one vector of ${DRY.dim} numbers. The model's own pooled output starts ${DRY.pooled.map(x => x.toFixed(4)).join(", ")}: the same as the row above. This averaging step is called <b>mean pooling</b>. A model that turns each text into one vector on its own, so the query and each review are encoded separately, is called a <b>bi-encoder</b>. Because reviews do not depend on the query, you can embed them all once, ahead of time, and only embed the query when a shopper types it.`, true)
          : kit.feedback(fb[order[ans]], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Use it, with predictions: which review scores higher with the multilingual model? */
  const PREDS = [
    { q: "q07", a: "r06", b: "r09", why: {
      right: s => `Right: r06 scores ${f3(s.a)}, r09 ${f3(s.b)}. The multilingual model was trained so that a sentence and its translation land in nearly the same place. A Korean review about dry skin sits near an English query about dry skin. (The ${MODEL.en.short} gave r06 only ${f3(PAIR["q07:r06"].en)}.)`,
      wrong: s => `r09 is in the query's language and is about skin care, but it is about a mild cleanser. r06 scores ${f3(s.a)}, r09 ${f3(s.b)}: the model was trained so that translations land close together, so meaning beats language here.` } },
    { q: "q06", a: "r04", b: "r01", why: {
      right: s => `Right, by a hair: r01 scores ${f3(s.b)}, r04 ${f3(s.a)}. r04 is the true answer, yet an English review about the same product, saying something else, edges ahead. In this small model, sharing the query's language still pulls a little.`,
      wrong: s => `Your reasoning holds: translations do land close, and r04 is the true answer. But this pair tests a second, smaller effect: sharing the query's language still pulls a little. r01 is in English, like the query, and about the same product, and that pull puts it ahead by only ${f3(s.b - s.a)}: r01 ${f3(s.b)}, r04 ${f3(s.a)}. Translations land close, not on the same spot.` } },
    { q: "q08", a: "r13", b: "r15", why: {
      right: s => `Right: the wrong review wins, ${f3(s.b)} against ${f3(s.a)}. Both are about lip tint. The vector holds "what is this text about" strongly and finer points like "lasts" against "dries" weakly. The ${MODEL.en.short} happened to order these two correctly (${f3(PAIR["q08:r13"].en)} against ${f3(PAIR["q08:r15"].en)}).`,
      wrong: s => `r13 is the real answer, but r15 scores ${f3(s.b)} against r13's ${f3(s.a)}. Both are about lip tint. The vector holds the topic strongly and the detail ("lasts" against "dries") weakly, so a review saying the opposite can win.` } }
  ];
  function predict({ el, done, kit }) {
    css();
    const ans = PREDS.map(() => null);
    const truth = p => PAIR[`${p.q}:${p.a}`].ml > PAIR[`${p.q}:${p.b}`].ml ? 0 : 1;
    const paint = () => {
      el.innerHTML = `<h1>Predict the score</h1>
        <p class="lead">The search compares the query's sentence vector with each review's by <b>cosine similarity</b>: how closely the two vectors point the same way. Near 1 means very close; near 0 means unrelated. Now use what you know about the ${MODEL.ml.short}.</p>
        <p class="task">For each query, predict which of the two reviews the ${MODEL.ml.short} scores higher. Pick again if you change your mind.</p>
        ${PREDS.map((p, i) => {
          const s = { a: PAIR[`${p.q}:${p.a}`].ml, b: PAIR[`${p.q}:${p.b}`].ml }, ok = ans[i] === truth(p);
          return `<div class="lcase" id="c${i}">${queryBox(p.q)}<div class="${P}pair">${reviewRow(p.a, { score: ans[i] == null ? null : s.a })}${reviewRow(p.b, { score: ans[i] == null ? null : s.b })}</div>
            ${kit.options([`${p.a} scores higher`, `${p.b} scores higher`], { picked: ans[i], correct: truth(p) })}
            ${ans[i] == null ? "" : kit.feedback(ok ? p.why.right(s) : p.why.wrong(s), ok)}</div>`;
        }).join("")}
        ${ans.every((a, i) => a === truth(PREDS[i])) ? `<p class="${P}cap">Scores from our run of the ${MODEL.ml.short}, ${RUN_DATE}.</p>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PREDS.every((p, j) => ans[j] === truth(p))) done();
      }));
    };
    paint();
  }

  /* 6. From scratch in Python: mean pooling and cosine, a recorded trace. */
  function fromScratch({ el, done, kit }) {
    css();
    let i = 0;
    const v3 = a => `[${a.map(x => x.toFixed(4)).join(", ")}, …]`;
    const say = [
      `<code>query_tokens</code> holds the model's token vectors for "${esc(Q.q06.text)}": ${TR.qShape[0]} tokens × ${TR.qShape[1]} numbers. <code>review_tokens</code> holds r04, the Korean review: ${TR.rShape[0]} tokens × ${TR.rShape[1]}. The first token's vector starts ${v3(TR.qTok0)}.`,
      `Mean pooling, the step you did by hand: average down the token axis. ${TR.qShape[0]} vectors become one of ${TR.qShape[1]} numbers.`,
      `The same for the review: ${TR.rShape[0]} token vectors become one. A longer text does not get a longer vector: every text ends as ${TR.rShape[1]} numbers.`,
      `The dot product: multiply the two vectors number by number and add up the ${TR.qShape[1]} products: ${TR.dot}.`,
      `The dot product gets bigger when the vectors are longer, so we divide by both lengths. <code>norm</code> is a vector's length: ${TR.qLen} for the query…`,
      `…and ${TR.rLen} for the review.`,
      `${TR.dot} / (${TR.qLen} × ${TR.rLen}) = ${f3(TR.dot / (TR.qLen * TR.rLen))}. That is the cosine similarity.`,
      `The function returns ${TR.score}, the same score the search gave r04 for this query (${f3(TR3("ml", "q06", "r04"))}). That is the whole scoring side of a bi-encoder. The heavy part, turning tokens into token vectors, happens inside the model.`
    ];
    function TR3(m, qid, rid) { const hit = TOP3[m][qid].find(([r]) => r === rid); return hit ? hit[1] : NaN; }
    const paint = () => {
      const [ln, ev] = TR.steps[i];
      const vars = [`query_tokens <b>${TR.qShape.join("×")}</b>`, `review_tokens <b>${TR.rShape.join("×")}</b>`];
      if (i >= 1) vars.push(`query_vec <b>${v3(TR.qVec)}</b>`);
      if (i >= 2) vars.push(`review_vec <b>${v3(TR.rVec)}</b>`);
      if (i >= 3) vars.push(`dot <b>${TR.dot}</b>`);
      if (i >= 4) vars.push(`query_len <b>${TR.qLen}</b>`);
      if (i >= 5) vars.push(`review_len <b>${TR.rLen}</b>`);
      if (i >= 6) vars.push(`score <b>${TR.score}</b>`);
      el.innerHTML = `<h1>The scoring step in Python</h1>
        <p class="lead">Mean pooling and cosine similarity, written with NumPy and replayed from a real run (the token vectors came from the ${MODEL.ml.short}). The highlighted line is the one that just ran; the values are as they were right after it, with only the first 3 of 384 numbers shown.</p>
        <p class="task">Step through to the end. Watch where the ${TR.qShape[0]} and ${TR.rShape[0]} token vectors become one each.</p>
        ${kit.code(CODE, i === 0 ? 0 : ev === "return" ? 7 : ln - 1)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TR.steps.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${vars.map(v => `<span>${v}</span>`).join("")}<span>step <b>${i + 1} / ${TR.steps.length}</b></span></div>
        ${kit.feedback(say[i])}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TR.steps.length - 1) done(); };
    };
    paint();
  }

  /* 7. The real library: sentence-transformers, run on this Mac with the English model (library.py). */
  // library.py, the on-screen part, wrapped to fit a phone (the script also pins the model revision and the CPU)
  const LIB = [
    "from sentence_transformers import \\",
    "    SentenceTransformer",
    "name = (\"sentence-transformers/\"",
    "        \"all-MiniLM-L6-v2\")",
    "model = SentenceTransformer(name)",
    "print(model.max_seq_length)",
    "review_vecs = model.encode_document(",
    "    reviews, batch_size=32,",
    "    normalize_embeddings=True)",
    "print(review_vecs.shape)",
    "query_vecs = model.encode_query(",
    "    [\"백탁 없는 선크림\"],",
    "    normalize_embeddings=True)",
    "scores = model.similarity(",
    "    query_vecs, review_vecs)",
    "top = scores[0].topk(3)",
    "print([review_ids[i]",
    "       for i in top.indices],",
    "      top.values.round(decimals=4))"
  ];
  // library.out.txt (not altered): the three printed lines of the on-screen code, the prompts line, and part 2's
  // comparison with search.json over every query and review
  const LIB_OUT = ["256", "(24, 384)", "['r04', 'r12', 'r20'] tensor([0.8635, 0.7196, 0.6608])"];
  const LIB_RUN = { top: [["r04", 0.8635], ["r12", 0.7196], ["r20", 0.6608]], prompts: "{'query': '', 'document': ''}",
    worst: 4.97e-05, sameTop3: 10 };
  function library({ el, done, kit }) {
    css();
    let ans = null;
    const npTop = TOP3.en.q01;
    const opts = [
      "Reviews about a chalky cast, such as r01 and r02: the official library does more than our NumPy run.",
      `The same three as our NumPy run (${npTop.map(([rid]) => rid).join(", ")}), with the same scores to the 4th decimal.`,
      "The same three reviews, but with clearly different scores: PyTorch computes differently from NumPy."
    ];
    const correct = 1;
    const fb = {
      0: `The library runs the steps you already saw: the model's own tokenizer, the same weights, mean pooling, cosine. It cannot read Korean the model never learned: its tokenizer still cuts the query into single letters and [UNK]. Changing the model fixes that; changing the code around it does not.`,
      2: `Both run the same arithmetic on the same weights: tokenizer, ${MODEL.en.layers} layers, mean pooling, cosine. The order in which numbers are added differs a little, so tiny differences appear, but nothing big enough to show in 4 decimals.`
    };
    const paint = () => {
      el.innerHTML = `<h1>The same thing with sentence-transformers</h1>
        <p class="lead">In a real project you do not run the model step by step in NumPy, as we did for this lesson's scores: the <b>sentence-transformers</b> library runs tokenizer, model and pooling in one call. We ran it on this Mac with the ${MODEL.en.short} and the Korean query from screen 3. <code>reviews</code> holds the ${REVIEWS.length} review texts, <code>review_ids</code> their ids. (Our script also fixes the model version and runs on the CPU.)</p>
        ${kit.code(LIB, -1)}
        <p class="lead"><code>encode_document</code> and <code>encode_query</code> turn texts into vectors; the library's docs recommend this pair for search, where queries and documents play different roles, and plain <code>encode</code> for everything else. <code>batch_size</code> is how many texts go through the model at once (default 32): speed and memory, not results. <code>normalize_embeddings=True</code> scales every vector to length 1, so a dot product alone is the cosine. <code>model.similarity</code> uses cosine unless you set another function.</p>
        <p class="task">Our NumPy run of this model put ${npTop.map(([rid, sc]) => `${rid} (${f3(sc)})`).join(", ")} on top for this query: all wrong. Predict the last line the library prints.</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? `<pre class="${P}out">${LIB_OUT.map(esc).join("\n")}</pre><p class="${P}cap">Real output of the code above, our run on this Mac, ${LIB_DATE}.</p>` +
            kit.feedback(`Right. Same reviews, same scores. Over all ${QUERIES.length} queries × ${REVIEWS.length} reviews (${QUERIES.length * REVIEWS.length} scores) the largest gap between the library and our NumPy run was ${LIB_RUN.worst.toFixed(7)}, which is below the 4-decimal rounding of our stored scores, and all ${LIB_RUN.sameTop3} top-3 lists came out in the same order. The library is a convenient wrapper around the same steps: it cannot rescue a model that never learned Korean.`, true) +
            `<p class="lead">The other lines: <code>max_seq_length</code> is ${LIB_OUT[0]}: this model reads at most ${LIB_OUT[0]} tokens of a text and cuts the rest without warning. The ${MODEL.ml.short} reads only ${MODEL.ml.maxLen}. In our NumPy run of it, a ${TRUNC.tokens}-token sunscreen review scored ${f3(TRUNC.last)} for "${esc(Q.q06.text)}" when the eye complaint sat at the end and was cut off, and ${f3(TRUNC.first)} when it sat at the front. Every text became ${review_vecs_dim()} numbers. Some models put a short fixed text (a prompt) in front of every query or document; this model's prompts are empty (the run printed <code>${esc(LIB_RUN.prompts)}</code>), so <code>encode_query</code> gave exactly the same vectors as <code>encode</code> here; for a model that defines prompts they differ, so use the pair the docs recommend.</p>`
          : kit.feedback(fb[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    const review_vecs_dim = () => LIB_OUT[1].match(/\d+/g)[1];
    paint();
  }

  /* 8. Choose a model from your own test. */
  function choose({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      `Ship the ${MODEL.en.short}: it ties on English queries and is smaller.`,
      `Ship the ${MODEL.ml.short}, embed all reviews again with it, and keep testing on more real queries.`,
      "Either one: the totals are close, so it does not matter.",
      `Keep the ${MODEL.en.short} and machine-translate every Korean query into English first.`
    ];
    const correct = 1;
    const fb = [
      `Half the shoppers type Korean, and there the ${MODEL.en.short} scored ${ST.en.ko} of ${MAXL} with hits that came from shared letters. Small and fast does not help if it cannot read the query.`,
      "",
      `The totals hide where the hits are: ${ST.en.cross} hits in the other language for the ${MODEL.en.short}, ${ST.ml.cross} for the ${MODEL.ml.short}. Shoppers asked for exactly that.`,
      `That adds a translation call to every Korean search (more time, more cost, one more thing to break), and the Korean reviews are still letters to the ${MODEL.en.short}: they would never be found unless you translated all of them too.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Pick a model from your own test</h1>
        <p class="lead">Your hand count, done for all ${QUERIES.length} queries, plus the size of each model's weights (from the files themselves):</p>
        <div class="${P}wrap"><table class="${P}grid"><thead><tr><th></th><th>${MODEL.en.short}</th><th>${MODEL.ml.short}</th></tr></thead><tbody>
          <tr><td>hits, Korean queries</td><td>${ST.en.ko} / ${MAXL}</td><td>${ST.ml.ko} / ${MAXL}</td></tr>
          <tr><td>hits, English queries</td><td>${ST.en.en} / ${MAXL}</td><td>${ST.ml.en} / ${MAXL}</td></tr>
          <tr><td>hits in the other language</td><td>${ST.en.cross}</td><td>${ST.ml.cross}</td></tr>
          <tr><td>layers (more = slower per text)</td><td>${MODEL.en.layers}</td><td>${MODEL.ml.layers}</td></tr>
          <tr><td>weights, MB</td><td>${mb(SIZE.en.all)}</td><td>${mb(SIZE.ml.all)}</td></tr>
          <tr><td>…of which the vocabulary table</td><td>${pct(SIZE.en.vocab, SIZE.en.all)}%</td><td>${pct(SIZE.ml.vocab, SIZE.ml.all)}%</td></tr>
        </tbody></table></div>
        <p class="${P}cap">From our run and the models' safetensors files, ${RUN_DATE}.</p>
        <p class="task">The shop must serve Korean and English shoppers. What do you do?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. It wins where the shop needs it (Korean ${ST.ml.ko} against ${ST.en.ko}, cross-language ${ST.ml.cross} against ${ST.en.cross}) and ties on English. Two costs come with it. Every stored review must be embedded again: each model places texts in its own way, so vectors from two models cannot be compared. And it is slower, with ${MODEL.ml.layers} layers instead of ${MODEL.en.layers}; most of its size is the vocabulary for 50+ languages. It still finds only ${ST.ml.all} of ${MAXH}, and it ranked the opposite complaint above the right one on screen 5. So keep the ${QUERIES.length} queries as a test set, grow it from real searches, and run the same count on any bigger multilingual model you consider. The sentence-transformers docs say it too: models that top public leaderboards do not always do well on your own task.`, true)
          : kit.feedback(fb[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 9. The big picture: what for, when not, what it costs. Three situations. */
  const SITS = [
    { s: "Next quarter the team switches to a newer embedding model. Two million review vectors are already stored.",
      o: ["Embed all two million reviews again with the new model", "Nothing: a vector is a vector", "Embed only the new reviews with the new model"], ok: 0,
      no: { 1: "Each model has its own space: number 17 means something different in each. A query vector from the new model compared with old review vectors gives meaningless scores.",
            2: "Then old and new reviews would live in two spaces, and a query vector could only be compared fairly with half of them." },
      yes: "Right. Switching models means a full re-embedding run, so the choice is costly to change. Test first, then commit." },
    { s: "A shopper types the batch code printed on her tube, LT-2311B, to find reviews of that batch.",
      o: ["Embedding search: it understands what the code means", "Exact keyword or field search on the code"], ok: 1,
      no: { 0: "A code has no meaning to embed. The tokenizer cuts it into pieces, and a neighbouring batch such as LT-2311A can score nearly as high: you saw on screen 5 that small details weigh little in the vector." },
      yes: "Right. Codes, names, numbers and exact phrases need exact matching. Many systems run both kinds of search together (a later lesson)." },
    { s: "Some reviews are long essays, 600 words or more.",
      o: ["Split them into chunks before embedding", "Embed them whole: the model reads everything"], ok: 0,
      no: { 1: `The ${MODEL.ml.short} reads ${MODEL.ml.maxLen} tokens and drops the rest without warning, as the long sunscreen review on screen 7 showed. And one vector for a whole essay blurs its many points into one average.` },
      yes: "Right. More chunks mean more vectors to embed and store, but each one is read in full and says one thing." }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = SITS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for an embedding model</h1>
        <p class="lead"><b>What it is for:</b> finding text by meaning: paraphrases, other wording, other languages with a multilingual model. Texts are embedded once, then a query costs one short model run plus comparisons. <b>When not:</b> exact codes, names and numbers; counting or filtering by fields such as date or rating; fine differences such as "lasts" against "dries", where it needs help. <b>What it costs:</b> embedding every document up front and again after any model change; storing one vector per text; a model to host or an API to pay per text; and a test set you keep up to date.</p>
        <p class="task">For each situation, pick what you do. Pick again if you change your mind.</p>
        ${SITS.map((t, i) => `<div class="lcase" id="c${i}"><p>${esc(t.s)}</p>${kit.options(t.o.map(esc), { picked: ans[i], correct: t.ok })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === t.ok ? t.yes : t.no[ans[i]]), ans[i] === t.ok)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SITS.every((t, j) => ans[j] === t.ok)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it: is a sentence embedding model the right tool? Two are not. */
  const CASES = [
    ["A recipe app: a user types \"quick dinner without an oven\" and should find a recipe titled \"15-minute stovetop pasta\".", true,
      "Yes. No word is shared, but the meaning matches. That is exactly what sentence vectors find and keyword search misses.",
      "Keyword search finds nothing here: not one word is shared. The meaning matches, and that is what sentence vectors are for."],
    ["A hotel group gets guest messages in Japanese and English and wants to show the matching answer from its English FAQ.", true,
      "Yes, with a multilingual model, and only after testing it on real guest messages in both languages, the way you counted hits here.",
      "This is the review search again: questions in two languages, answers in one. A multilingual model maps both into one space. Test it on real messages first."],
    ["An insurance team wants the number of claims last month that were above the payout limit.", false,
      "No. This is counting rows by a date and an amount: a database query. Similarity has nothing to measure here.",
      "Nothing here is about meaning. It is a filter on two fields (date, amount) and a count: a database query gives the exact number. An embedding search returns \"similar\" claims, not a count."],
    ["A pharmacy lookup must find \"amoxicillin 500 mg\" and must never return the 250 mg product.", false,
      "No. To an embedding model the two names are almost the same text, so the 250 mg product scores nearly as high. Use exact matching on the product and dose fields.",
      "Sentence vectors hold the topic strongly and small details weakly: you saw the opposite complaint win on screen 5. 500 mg and 250 mg would score nearly the same. When a wrong near-match is dangerous, use exact matching on fields."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is an embedding model the right tool?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from cosmetics.</p>
        <p class="task">For each one, decide: should the search be built on sentence vectors? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and what you should see (from our run of the same models). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    const CHECK = [
      `The ${MODEL.en.short}'s tokenizer cuts "${esc(Q.q01.text)}" into ${TOK_Q01.en.length} pieces, mostly single Korean letters and one <code>[UNK]</code>; the ${MODEL.ml.short}'s tokens, recorded from our run, are ${TOK_Q01.ml.length}.`,
      `The ${REVIEWS.length} reviews become vectors of shape <code>${LIB_OUT[1]}</code>: ${DRY.dim} numbers per text, however long the text.`,
      `The Korean query prints <code>${LIB_OUT[2].replace(/ tensor.*/, "")}</code> with ${LIB_RUN.top.map(([, sc]) => sc.toFixed(4)).join(", ")}: the same three wrong reviews as on screen 7.`,
      `Counting hits over the ${QUERIES.length} queries gives ${ST.en.all} of ${MAXH} for the ${MODEL.en.short}, ${ST.en.cross} of them in the other language. A later table shows the ${MODEL.ml.short}'s recorded results counted the same way: ${ST.ml.all} of ${MAXH}, ${ST.ml.cross} in the other language.`,
      `Your own mean of the token vectors of "dry lips" has a cosine of 1.0 with the library's sentence vector: the library's pooling step is this same average.`
    ];
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now say how a bi-encoder makes one vector per text (token vectors, then mean pooling), why cosine scores between them find meaning, why a model's vocabulary decides which languages it can search, and how to choose a model by counting hits on your own queries.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a>.` : "The notebook for this lesson is on its way."} It runs the ${MODEL.en.short} with sentence-transformers on the same reviews and queries, and compares it with the ${MODEL.ml.short}'s results recorded in our run files (that model is about ${Math.round(SIZE.ml.all / 1e6)} MB, so the notebook does not download it). What you should see, from our run of the notebook:</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. Here you scored all ${REVIEWS.length} reviews one by one; with millions of vectors that gets slow, and an index finds the nearest ones without checking every one.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Embedding models: from word vectors to sentences",
    checked: "2026-11-14",
    sources: [
      "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2",
      "https://sbert.net/docs/package_reference/sentence_transformer/SentenceTransformer.html",
      "https://sbert.net/docs/sentence_transformer/pretrained_models.html",
      "https://arxiv.org/abs/1908.10084",
      "https://arxiv.org/abs/2004.09813"
    ],
    interview: [{
      q: "Your semantic search works well in English. After a launch in Korea, Korean queries return unrelated results with high scores. How do you find the cause and pick a fix?",
      good: [
        "Run the model's tokenizer on a Korean query: single letters and [UNK] tokens mean the model never learned Korean",
        "Check the model card's languages; high scores between unrelated texts are a sign the vectors carry no meaning",
        "Build a small labelled query set in both languages, including cross-language pairs, and count hits in the top k for each candidate model",
        "Switching models means re-embedding every stored document, since vectors from two models cannot be compared",
        "Keep exact search for codes and names, which no embedding model handles well"
      ],
      weak: "Raise top k, or translate Korean queries into English. That hides the symptom and still leaves the Korean documents unreadable to the model."
    }, {
      q: "During a migration, a teammate suggests putting new documents' vectors from a new embedding model into the same index as the old ones, and re-embedding the old documents later. What do you say?",
      good: [
        "Each model has its own vector space; scores between vectors from two models mean nothing",
        "A query embedded with one model would rank half the index unfairly",
        "Re-embed everything into a new index, test it on the query set, then switch over at once",
        "Budget for the re-embedding run whenever a model is chosen: the choice is costly to change"
      ],
      weak: "It is fine because both models output the same number of dimensions. Same length does not mean the same space."
    }],
    screens: [situation, byHand, spot, pooling, predict, fromScratch, library, choose, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="r11"]', "[data-check]", '[data-i="r11"]'], right: ['[data-i="r22"]', '[data-i="r21"]', "[data-check]"] },
      { wrong: ['[data-i="q05-en-0"]', "[data-check]", '[data-i="q05-en-0"]'],
        right: [...S2_QS.flatMap(qid => ["en", "ml"].flatMap(m => TOP3[m][qid].map(([rid], k) => relevant(qid, rid) ? `[data-i="${qid}-${m}-${k}"]` : null).filter(Boolean))), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: PREDS.map((_, i) => `#c${i} [data-right]`) },
      { right: Array(TR.steps.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SITS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
