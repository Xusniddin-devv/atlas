/* Lesson s5c-speech: Speech to text and word error rate.
   Story: a farm cooperative's crop inspectors record voice notes in windy fields, in English, Russian, or both in
   one note (with Uzbek place names). The office wants the notes typed into the inspection log by Whisper, an open
   speech model, and needs a number that says how wrong the transcripts are.
   Ideas: (1) word error rate (WER): line the transcript up with what was really said, count the fewest word edits
   (substitutions, deletions, insertions) and divide by the words said; the line-up is an edit-distance table, built
   from scratch in Python. (2) Running Whisper (through whisper.cpp): the model size, the language setting and the
   prompt are the settings that matter; a missing language setting is the broken-on-purpose case.
   Data, all from runs on this Mac (2026-11-13), in docs/ai-path/runs/s5c-speech/:
     notes.json, references.json   the notes we wrote (spoken text) and the reference transcripts (typed form)
     make_audio.py                 the Mac's text-to-speech voices read the notes; synthetic wind mixed in (seed 0)
     transcribe.py -> transcripts.json, transcribe.out.txt   Whisper tiny and base via whisper-cli (whisper.cpp)
     score.py -> scores.json, score.out.txt   WER of every transcript; our wer() checked against jiwer (all 94 equal)
     wer_scratch.py, trace.py -> trace.out.txt   the from-scratch wer() and its trace (the stepped code screen)
     ru_on_english.py -> ru_on_english.json, .out.txt   review follow-up (2026-11-14): -l ru on English notes
     env.txt                       versions, model checksums, the whisper-cli help lines
   The voices are synthetic, not real inspectors. No model API calls were recorded for this lesson. The Python
   openai-whisper cell on the last screen (model base) was not run by us; the whisper-cli runs were, and the
   notebook (notebooks/s5c-speech.ipynb, 2026-11-14) runs openai-whisper with the tiny model on gTTS voices.
   Every WER, count and total on screen is computed here from the transcripts and edit counts copied below.
   Lesson-local CSS: word buttons, alignment columns, counters, run boxes, checklist (prefix lx-s5c-speech-). */
(() => {
  const ID = "s5c-speech", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5c-speech.ipynb";
  const RUN_DATE = "2026-11-13";
  const PROMPT = "Crop inspection notes. Places: Chirchiq, Parkent.";

  // references.json: what the inspector really said, typed in the cooperative's style (numbers as digits)
  const REF = {
    n1: "Plot 12 near Chirchiq. The cotton leaves are curling at the edges, and there are aphids on the lower leaves.",
    n2: "Rows 4 to 9 need spraying on Thursday morning, before the wind picks up.",
    n3: "Apricot orchard in Parkent. Some fruit has brown spots. Take 10 samples for the lab.",
    n4: "The wheat field by the canal looks dry. The drip line is blocked near the pump.",
    n5: "Поле номер 7. Хлопок в хорошем состоянии, но на краю поля много сорняков.",
    n6: "Поле номер 7. Хлопок в хорошем состоянии. The drip line is blocked near the pump."
  };
  // our English glosses of the Russian (written by us, not model output)
  const GLOSS = {
    n5: "Field number 7. The cotton is in good condition, but there are many weeds at the edge of the field.",
    n6: "Field number 7. The cotton is in good condition. (then in English) The drip line is blocked near the pump."
  };
  // transcripts.json: whisper-cli output, copied unaltered. Key: model|clip|flags
  const TX = {
    "base|n4-clean|-l en": "The weed field by the canal looks dry. The drip line is blocked near the pump.",
    "base|n2-clean|-l en": "Rose 4-9 needs spraying on Thursday morning, before the wind picks up.",
    "base|n1-snr5|-l en": "The cloth holds near a circuit, the cotton leaves are curling at the edges, and there are aphids on the lower leaves.",
    "tiny|n1-snr10|-l en": "The clock 12 near Turkey, the cotton leaves are curling at the edges, and there are rapids on the lower leaves.",
    "base|n1-snr10|-l en": "Flood 12 near circuit. The cotton leaves are curling at the edges and there are aphids on the lower leaves.",
    "base|n1-snr10|-l en --prompt": "Flood 12 near Chirchiq, the cotton leaves are curling at the edges, and there are aphids on the lower leaves.",
    "tiny|n1-snr0|-l en": "The crossbow's near church, the cotton leaves are curling at the edges, and there are apricot on the lower leaves.",
    "tiny|n1-snr0|-l en --prompt": "The clock broke near church. The clock leaves are curling at the edge and there are rapids on the lower knee.",
    "base|n1-clean|": "Claude 12 near Cherkik, the cotton leaves are curling at the edges, and there are aphids on the lower leaves.",
    "base|n2-clean|": "Rose 4-9 needs spraying on Thursday morning, before the wind picks up.",
    "base|n3-clean|": "Apricot orchard in parking. Some fruit has brown spots. Take 10 samples for the lab.",
    "base|n4-clean|": "The weed field by the canal looks dry. The drip line is blocked near the pump.",
    "base|n5-clean|": "7. Flopop in a good condition, but at the end there are a lot of wrinkles.",
    "base|n5-snr10|": "(speaking in foreign language)",
    "base|n5-clean|-l auto": "поле №7, хлопок в хорошем состоянии, но на краю поля много сорников.",
    "base|n5-snr10|-l auto": "Хлопот в хорошем состоянии, но на краю поля много сырников.",
    "base|n6-clean|-l auto": "Хлопоп в хорошем состоянии.",
    "base|n6-clean|-l en": "The drip line is blocked near the pump.",
    // ru_on_english.json (review follow-up run, 2026-11-14): an English note with the language forced to Russian
    "base|n4-clean|-l ru": "Взлет по каналу \"Драй\", \"Дрит-лайн\" is blocked near the pump."
  };
  // scores.json: edits (S + D + I) per English note n1..n4, per model, with or without --prompt, per wind level
  const EDITS = {
    tiny: { plain: { clean: [3, 3, 2, 1], snr10: [4, 3, 3, 1], snr5: [3, 3, 5, 1], snr0: [4, 4, 11, 2] },
            prompt: { clean: [2, 3, 1, 1], snr10: [2, 3, 2, 0], snr5: [5, 3, 4, 0], snr0: [8, 4, 7, 2] } },
    base: { plain: { clean: [2, 3, 1, 1], snr10: [2, 3, 4, 1], snr5: [5, 3, 3, 2], snr0: [7, 3, 10, 2] },
            prompt: { clean: [1, 3, 0, 1], snr10: [1, 3, 2, 2], snr5: [2, 3, 2, 2], snr0: [7, 4, 7, 2] } }
  };
  const LEVELS = [["clean", "no wind"], ["snr10", "wind, 10 dB"], ["snr5", "wind, 5 dB"], ["snr0", "wind, 0 dB"]];
  // trace.out.txt: wer("rows 4 to 9", "rose 4 9"), trimmed to the steps shown (the first visit to lines 1, 3, 4, 6,
  // every visit to line 12, the return). [step no., line, event, d, i, j, sub, miss, extra]
  const TRACE = [[0,1,"l",null,null,null,null,null,null],[2,3,"l",null,null,null,null,null,null],[8,4,"l",[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],null,null,null,null,null],[19,6,"l",[[0,1,2,3],[1,0,0,0],[2,0,0,0],[3,0,0,0],[4,0,0,0]],4,3,null,null,null],[25,12,"l",[[0,1,2,3],[1,0,0,0],[2,0,0,0],[3,0,0,0],[4,0,0,0]],1,1,1,2,2],[31,12,"l",[[0,1,2,3],[1,1,0,0],[2,0,0,0],[3,0,0,0],[4,0,0,0]],1,2,2,3,2],[37,12,"l",[[0,1,2,3],[1,1,2,0],[2,0,0,0],[3,0,0,0],[4,0,0,0]],1,3,3,4,3],[45,12,"l",[[0,1,2,3],[1,1,2,3],[2,0,0,0],[3,0,0,0],[4,0,0,0]],2,1,2,2,3],[51,12,"l",[[0,1,2,3],[1,1,2,3],[2,2,0,0],[3,0,0,0],[4,0,0,0]],2,2,1,3,3],[57,12,"l",[[0,1,2,3],[1,1,2,3],[2,2,1,0],[3,0,0,0],[4,0,0,0]],2,3,3,4,2],[65,12,"l",[[0,1,2,3],[1,1,2,3],[2,2,1,2],[3,0,0,0],[4,0,0,0]],3,1,3,3,4],[71,12,"l",[[0,1,2,3],[1,1,2,3],[2,2,1,2],[3,3,0,0],[4,0,0,0]],3,2,3,2,4],[77,12,"l",[[0,1,2,3],[1,1,2,3],[2,2,1,2],[3,3,2,0],[4,0,0,0]],3,3,2,3,3],[85,12,"l",[[0,1,2,3],[1,1,2,3],[2,2,1,2],[3,3,2,2],[4,0,0,0]],4,1,4,4,5],[91,12,"l",[[0,1,2,3],[1,1,2,3],[2,2,1,2],[3,3,2,2],[4,4,0,0]],4,2,4,3,5],[97,12,"l",[[0,1,2,3],[1,1,2,3],[2,2,1,2],[3,3,2,2],[4,4,3,0]],4,3,2,3,4],[101,13,"r",[[0,1,2,3],[1,1,2,3],[2,2,1,2],[3,3,2,2],[4,4,3,2]],4,3,2,3,4]];
  const TRACE_ALL = 102; // steps in the full trace
  const T_REF = "rows 4 to 9", T_HYP = "rose 4 9";

  /* ---------- helpers: normalize, align, WER (the same steps as wer_scratch.py) ---------- */
  const NUMW = "zero one two three four five six seven eight nine ten eleven twelve".split(" ");
  const normalize = t => t.toLowerCase().replace(/-/g, " ").replace(/[^\p{L}\p{N}\s_]/gu, "")
    .split(/\s+/).filter(Boolean).map(w => NUMW.includes(w) ? String(NUMW.indexOf(w)) : w);
  const table = (ref, hyp) => {
    const d = Array.from({ length: ref.length + 1 }, (_, i) => Array.from({ length: hyp.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++)
      d[i][j] = Math.min(d[i - 1][j - 1] + (ref[i - 1] !== hyp[j - 1] ? 1 : 0), d[i - 1][j] + 1, d[i][j - 1] + 1);
    return d;
  };
  // one line-up with the fewest edits: [{ r, h, t: "ok" | "S" | "D" | "I" }]
  const align = (ref, hyp) => {
    const d = table(ref, hyp), cols = [];
    let i = ref.length, j = hyp.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (ref[i - 1] !== hyp[j - 1] ? 1 : 0)) { cols.unshift({ r: ref[i - 1], h: hyp[j - 1], t: ref[i - 1] === hyp[j - 1] ? "ok" : "S" }); i--; j--; }
      else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { cols.unshift({ r: ref[i - 1], h: null, t: "D" }); i--; }
      else { cols.unshift({ r: null, h: hyp[j - 1], t: "I" }); j--; }
    }
    return cols;
  };
  const score = (refText, hypText) => {
    const ref = normalize(refText), hyp = normalize(hypText), cols = align(ref, hyp);
    const n = t => cols.filter(c => c.t === t).length;
    const S = n("S"), D = n("D"), I = n("I");
    return { ref, hyp, cols, S, D, I, N: ref.length, E: S + D + I, wer: (S + D + I) / ref.length };
  };
  const pct = x => `${Math.round(x * 100)}%`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const N_EN = ["n1", "n2", "n3", "n4"].map(k => normalize(REF[k]).length);
  const N_ALL = sum(N_EN);
  const edits = (m, p, lv) => sum(EDITS[m][p][lv]);
  const total = (m, p) => sum(LEVELS.map(([lv]) => edits(m, p, lv)));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const TYPE = { S: "substitution", D: "deletion", I: "insertion" };

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}said { margin: 10px 0 0; padding: 10px 14px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); font: 400 15.5px/1.5 var(--font); color: var(--ink); }
      .${P}said .k { display: block; font: 600 12px var(--mono); color: var(--muted); margin-bottom: 2px; }
      .${P}said .g { display: block; font: 400 13.5px/1.4 var(--font); color: var(--muted); margin-top: 4px; }
      .${P}words { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; }
      .${P}words button { min-height: 44px; min-width: 44px; padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: 500 15px var(--font); cursor: pointer; }
      .${P}words button.no { border-color: var(--bad); background: var(--bad-soft); }
      .${P}words button.yes { border-color: var(--good); background: var(--good-soft); }
      .${P}al { display: flex; flex-wrap: wrap; gap: 4px; margin: 10px 0 0; }
      .${P}col { display: flex; flex-direction: column; min-width: 40px; border: 1.5px solid var(--line); border-radius: 6px; background: var(--bg); font: 500 13.5px/1.3 var(--mono); color: var(--ink); text-align: center; }
      .${P}col span { padding: 4px 6px; }
      .${P}col span + span { border-top: 1px dashed var(--line); }
      .${P}col .gap { color: var(--faint); }
      .${P}col .t { font: 600 11px var(--mono); color: var(--muted); border-top: 1px solid var(--line); }
      .${P}col.err { border-color: var(--bad); background: var(--bad-soft); }
      .${P}heads { display: flex; gap: 14px; font: 500 12px var(--mono); color: var(--muted); margin-top: 8px; }
      .${P}cnt { display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px 8px; align-items: center; margin: 12px 0 0; max-width: 420px; }
      .${P}cnt b { font: 700 18px var(--mono); min-width: 2ch; text-align: center; color: var(--ink); }
      .${P}cnt button { min-width: 44px; min-height: 44px; }
      .${P}cnt label { font: 500 14.5px/1.3 var(--font); color: var(--ink); }
      .${P}cnt label small { display: block; color: var(--muted); font-size: 12.5px; }
      .${P}go { margin-top: 12px; min-height: 48px; padding: 10px 18px; }
      .${P}run { margin: 10px 0 0; border: 1.5px solid var(--line); border-radius: 8px; background: var(--sunk); padding: 8px 12px; font: 500 13px/1.5 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
      .${P}run .c { color: var(--muted); }
      .${P}run .w { display: block; margin-top: 2px; font-weight: 700; }
      .${P}doc { display: inline-flex; align-items: center; min-height: 44px; }
      .${P}cap { font: 500 12.5px var(--mono); color: var(--muted); margin: 6px 0 0; }
      .${P}wrap { overflow-x: auto; max-width: 100%; }
      .${P}grid { border-collapse: collapse; margin: 12px 0 0; font: 500 13.5px var(--mono); }
      .${P}grid th, .${P}grid td { padding: 6px 8px; border-bottom: 1px solid var(--line); text-align: right; color: var(--ink); }
      .${P}grid th { font-weight: 600; color: var(--muted); }
      .${P}grid td:first-child, .${P}grid th:first-child { text-align: left; }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
      @media (max-width: 480px) { .${P}grid th, .${P}grid td { padding: 5px 5px; font-size: 12px; } .${P}col { min-width: 36px; font-size: 12.5px; } }
    `;
    document.head.appendChild(s);
  }
  const said = (label, text, gloss) => `<div class="${P}said"><span class="k">${esc(label)}</span>${esc(text)}${gloss ? `<span class="g">${esc(gloss)} (our translation)</span>` : ""}</div>`;
  const alignHtml = (cols, show) => `<div class="${P}heads"><span>top: said</span><span>bottom: transcript</span><span>— : no word</span></div>
    <div class="${P}al">${cols.map(c => `<div class="${P}col${show && c.t !== "ok" ? " err" : ""}"><span class="${c.r == null ? "gap" : ""}">${c.r == null ? "—" : esc(c.r)}</span><span class="${c.h == null ? "gap" : ""}">${c.h == null ? "—" : esc(c.h)}</span>${show ? `<span class="t">${c.t === "ok" ? "✓" : c.t}</span>` : ""}</div>`).join("")}</div>`;
  const run = (cmd, out) => `<div class="${P}run"><span class="c">$ ${esc(cmd)}</span><span class="w">${esc(out)}</span></div>`;

  /* 1. The situation: a transcript that looks perfect. Find the word that is wrong. */
  function situation({ el, done, kit }) {
    css();
    const s = score(REF.n4, TX["base|n4-clean|-l en"]);
    const words = TX["base|n4-clean|-l en"].split(" ");
    const wrongIdx = s.cols.findIndex(c => c.t !== "ok"); // the one substitution; no gaps in this note, so index = word
    let picked = null;
    const paint = () => {
      const ok = picked === wrongIdx;
      el.innerHTML = `<h1>Voice notes from a windy field</h1>
        <p class="lead">A farm cooperative's crop inspectors walk the fields and record voice notes on their phones: in English, in Russian, sometimes both in one note, with Uzbek place names inside. Typing the notes into the inspection log takes the office hours a day. The office wants <b>Whisper</b>, an open speech-to-text model, to type them. Speech to text is the step that turns audio into plain text, so the rest of a system (search, reports, an LLM) can use it. Before anyone trusts it, they want to know how wrong it is.</p>
        <p class="lead">Here is one note and what Whisper (its "base" size, run on our Mac) typed for it. Our notes are read by the Mac's text-to-speech voices, not by real inspectors. The Mac has no Uzbek voice, so our notes are in English and Russian, and Uzbek appears only in place names.</p>
        ${said("What the inspector said", REF.n4)}
        <p class="task">The transcript looks clean. Tap the word in it that is wrong.</p>
        <div class="${P}words">${words.map((w, i) => `<button type="button" data-i="${i}" class="${picked === i ? (ok ? "yes" : "no") : ""}">${esc(w)}</button>`).join("")}</div>
        <div class="lpanel">${picked == null ? "" : ok
          ? kit.feedback(`Right: <b>${esc(s.cols[wrongIdx].h)}</b> instead of <b>${esc(s.cols[wrongIdx].r)}</b>. ${s.N - 1} of ${s.N} words are right, so a word count calls this note ${pct(1 - s.wer)} correct. But the log now says the field is full of weeds, and someone may send a sprayer. Two lessons from one note: you need a number to compare transcripts across hundreds of notes, and that number will not tell you which mistakes matter.`, true)
          : kit.feedback(`"${esc(words[picked])}" matches what was said at that place. Read the transcript against the note word by word: one word sounds almost the same as the one said, and changes what the field needs.`, false)}</div>`;
      el.querySelectorAll(`.${P}words button`).forEach(b => b.onclick = () => { picked = +b.dataset.i; paint(); if (picked === wrongIdx) done(); });
    };
    paint();
  }

  /* 2. By hand: count substitutions, deletions and insertions on a lined-up note, then the word error rate. */
  function byHand({ el, done, kit }) {
    css();
    const s = score(REF.n2, TX["base|n2-clean|-l en"]);
    const cnt = { S: 0, D: 0, I: 0 };
    let msg = null, counted = false, ans = null;
    const opts = [`${s.E} / ${s.N} = ${pct(s.E / s.N)}`, `${s.E} / ${s.hyp.length} = ${pct(s.E / s.hyp.length)}`, `${s.S} / ${s.N} = ${pct(s.S / s.N)}`];
    const paint = () => {
      el.innerHTML = `<h1>Count the mistakes by hand</h1>
        <p class="lead">Another note. A person who listened typed what was really said: that is the <b>reference</b>. Before comparing, both texts are put into one form: lower case, no punctuation, a hyphen becomes a space. Then the words are lined up so that matching words sit in one column.</p>
        ${said("Reference (what was said)", REF.n2)}
        ${said("Whisper's transcript", TX["base|n2-clean|-l en"])}
        ${alignHtml(s.cols, counted)}
        <p class="lead">Three kinds of mistake: a <b>substitution</b> is a said word typed as another word; a <b>deletion</b> is a said word missing from the transcript; an <b>insertion</b> is an extra word nobody said.</p>
        <p class="task">${counted ? "Now the score: the word error rate is the mistakes divided by a number of words. Which one?" : "Count each kind of mistake in the lined-up columns, then press Check."}</p>
        ${counted ? "" : `<div class="${P}cnt">${["S", "D", "I"].map(t => `<label>${TYPE[t]}s<small>${t === "S" ? "wrong word" : t === "D" ? "said, missing" : "extra, not said"}</small></label><button type="button" class="btn" data-dec="${t}" aria-label="one fewer ${TYPE[t]}">−</button><b>${cnt[t]}</b><button type="button" class="btn" data-inc="${t}" aria-label="one more ${TYPE[t]}">+</button>`).join("")}</div>
        <button type="button" class="btn ${P}go" data-check>Check</button>`}
        <div class="lpanel">${msg || ""}
        ${counted ? kit.options(opts, { picked: ans, correct: 0 }) : ""}
        ${ans == null ? "" : ans === 0
          ? kit.feedback(`Right. <b>Word error rate (WER) = (substitutions + deletions + insertions) / words in the reference</b> = (${s.S} + ${s.D} + ${s.I}) / ${s.N} = ${pct(s.wer)}. You divide by what was said, so every transcript of this note is measured against the same ${s.N} words. Because insertions count too, a transcript full of extra words can score above 100%. One more thing: the deleted "${esc(s.cols.find(c => c.t === "D").r)}" comes from how we normalize. Our normalizer turns "4-9" into "4 9". A normalizer that turned it into "4 to 9" would find no deletion here. Pick one normalizer and use it for every model you compare.`, true)
          : ans === 1 ? kit.feedback(`${s.hyp.length} is the transcript's length. Then a transcript that drops words would get a smaller denominator and look worse or better by accident, and two models' scores on the same note would not be comparable. Divide by the words that were said: ${s.N}.`, false)
          : kit.feedback(`That counts only the substitutions. The deletion counts too: every edit counts, whatever kind it is.`, false)}</div>`;
      el.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => { cnt[b.dataset.inc]++; msg = null; paint(); });
      el.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => { cnt[b.dataset.dec] = Math.max(0, cnt[b.dataset.dec] - 1); msg = null; paint(); });
      const c = el.querySelector("[data-check]");
      if (c) c.onclick = () => {
        const off = ["S", "D", "I"].find(t => cnt[t] !== s[t]);
        if (!off) { counted = true; msg = kit.feedback(`Counted: ${s.S} substitutions (${s.cols.filter(x => x.t === "S").map(x => `${esc(x.r)} → ${esc(x.h)}`).join(", ")}), ${s.D} deletion ("${esc(s.cols.find(x => x.t === "D").r)}" is missing), ${s.I} insertions. The marked columns are the mistakes.`, true); }
        else if (off === "S") msg = kit.feedback(cnt.S < s.S ? `Too few substitutions. Look for every column where both rows have a word but the words differ, even by one letter or a final "s": those are different words.` : `Too many substitutions. A column with a word on top and "—" below is not a substitution: nothing was typed there, so it is a deletion.`, false);
        else if (off === "D") msg = kit.feedback(cnt.D < s.D ? `A said word has no transcript word under it: find the column with "—" in the bottom row. That is a deletion.` : `Only a column with "—" in the bottom row is a deletion. A column with two different words is a substitution.`, false);
        else msg = kit.feedback(`An insertion would be a column with "—" in the top row: a transcript word that nobody said. This note has none.`, false);
        paint();
      };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: compare by position, or line the words up first? */
  function spot({ el, done, kit }) {
    css();
    const s = score(REF.n1, TX["base|n1-snr5|-l en"]);
    const L = Math.max(s.ref.length, s.hyp.length);
    let pos = 0;
    for (let i = 0; i < L; i++) if (s.ref[i] !== s.hyp[i]) pos++;
    const opts = [
      `${pos}: the script is right. After the start, every word is in the wrong place.`,
      `${s.E}: line the words up so matching words share a column, then count the fewest edits.`,
      `${s.S}: only the swapped words count. Extra words do no harm.`
    ];
    let ans = null;
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>Line up first, then count</h1>
        <p class="lead">The office wrote a quick script to score transcripts. It compares word 1 of the reference with word 1 of the transcript, word 2 with word 2, and so on, and counts the places that differ. For this windy note it reports <b>${pos} mistakes</b> (the reference has ${s.N} words, the transcript ${s.hyp.length}).</p>
        ${said("Reference", REF.n1)}
        ${said("Whisper's transcript (base, wind)", TX["base|n1-snr5|-l en"])}
        ${ok ? alignHtml(s.cols, true) : ""}
        <p class="task">The words "the cotton leaves are curling at the edges…" all came through right. How many mistakes are there really?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The transcript has ${s.hyp.length - s.ref.length} extra word${s.hyp.length - s.ref.length === 1 ? "" : "s"} near the start, so every later word sits ${s.hyp.length - s.ref.length} place${s.hyp.length - s.ref.length === 1 ? "" : "s"} off and the script counts it as wrong. Lined up, the mistakes are ${s.S} substitutions and ${s.I} insertions: WER = ${s.E} / ${s.N} = ${pct(s.wer)}. The line-up you want is the one with the <b>fewest edits</b> that turn the reference into the transcript. That count is called the <b>edit distance</b> between the two word lists (also known as Levenshtein distance). The next screen finds it without guessing.`, true)
          : ans === 0 ? kit.feedback(`The words after the start are the right words; they only moved over because extra words were added at the start. A reader of the log sees one garbled start and a correct rest. Counting by position punishes one early extra word with a mistake on every word after it.`, false)
          : kit.feedback(`The extra words are mistakes too: the log now says "${esc(s.cols.filter(c => c.t === "I").map(c => c.h).join("…"))}" where nothing was said. A reader cannot tell an inserted word from a real one, so WER counts insertions as well.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Fill the edit-distance table, predicting each cell. */
  const TR = normalize(T_REF), TH = normalize(T_HYP), TD = table(TR, TH);
  const FROM_ROW = 3; // rows 0..2 are given; the learner fills rows 3 and 4
  const CELLS = [];
  for (let i = FROM_ROW; i <= TR.length; i++) for (let j = 1; j <= TH.length; j++) CELLS.push([i, j]);
  function fillTable({ el, done, kit }) {
    css();
    let k = 0, wrong = null, last = null;
    const paint = () => {
      const end = k >= CELLS.length;
      const [ci, cj] = end ? [TR.length, TH.length] : CELLS[k];
      const isDone = (i, j) => i < FROM_ROW || j === 0 || CELLS.findIndex(([a, b]) => a === i && b === j) < k;
      const rows = TD.map((row, i) => row.map((v, j) => isDone(i, j) ? v : i === ci && j === cj && !end ? "?" : ""));
      const cls = {};
      if (!end) { cls[`${ci},${cj}`] = "next"; [[ci - 1, cj - 1], [ci - 1, cj], [ci, cj - 1]].forEach(([a, b]) => cls[`${a},${b}`] = "in"); }
      else cls[`${ci},${cj}`] = "enter";
      const match = !end && TR[ci - 1] === TH[cj - 1];
      const diag = end ? 0 : TD[ci - 1][cj - 1] + (match ? 0 : 1), up = end ? 0 : TD[ci - 1][cj] + 1, left = end ? 0 : TD[ci][cj - 1] + 1;
      const right = end ? 0 : Math.min(diag, up, left);
      const free = end ? 0 : Math.min(TD[ci - 1][cj - 1], TD[ci - 1][cj], TD[ci][cj - 1]);
      const opts = end ? [] : [diag, up, left, free].filter((v, x, a) => a.indexOf(v) === x).sort((a, b) => a - b);
      const say = v => {
        if (v === free && v < right) return `${v} takes a neighbour's number without paying for the move. Only a diagonal step between two equal words is free; a substitution, a deletion or an insertion each adds 1.`;
        const names = [];
        if (v === diag) names.push(`the diagonal (${match ? "same word, free" : "a substitution, +1"})`);
        if (v === up) names.push("the step from above (a deletion, +1)");
        if (v === left) names.push("the step from the left (an insertion, +1)");
        return `${v} is ${names.join(" and ")}. That is a real way to get here, but not the cheapest: the cell keeps the smallest of the three, ${right}.`;
      };
      el.innerHTML = `<h1>The table that finds the fewest edits</h1>
        <p class="lead">Take the start of the rows note: said "${esc(T_REF)}", typed "${esc(T_HYP)}". Each cell answers a smaller question: how many edits turn the reference words down to this row into the transcript words up to this column? A cell takes the smallest of three ways in. From the <b>diagonal</b>: pair the two words, free if they are equal, +1 if not (a substitution). From <b>above</b>: +1, the said word is deleted. From the <b>left</b>: +1, the typed word is an insertion. The first row and column are given (0, 1, 2, … edits against no words), and so are rows ${TR.slice(0, FROM_ROW - 1).map(w => `"${esc(w)}"`).join(" and ")}.</p>
        ${!end ? `<p class="task">Row "${esc(TR[ci - 1])}", column "${esc(TH[cj - 1])}": what goes in the cell marked "?"</p>` : ""}
        ${kit.pics.grid(rows, { cls, rowHead: ["", ...TR], colHead: ["", ...TH], from: end ? {} : { [`${ci},${cj}`]: [[ci - 1, cj - 1], [ci - 1, cj], [ci, cj - 1]] }, title: "reference words down the side, transcript words across the top" })}
        ${end ? "" : kit.pics.key([["in", "the three ways in"], ["next", "the cell to fill"]])}
        <div class="lpanel">${end ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(say(wrong), false) : last ? kit.feedback(last, true) : ""}
        ${end ? kit.feedback(`The corner holds <b>${TD[TR.length][TH.length]}</b>: the fewest edits for the whole piece (rows → rose, and "to" deleted). WER for this piece = ${TD[TR.length][TH.length]} / ${TR.length} = ${pct(TD[TR.length][TH.length] / TR.length)}. The table has one cell per pair of words: a 20-word note against a 20-word transcript is ${20 * 20} cells, nothing for a computer. Libraries such as jiwer do the same count for you.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== right) { wrong = v; last = null; paint(); return; }
        const how = [right === diag ? (match ? "the diagonal, same word, free" : "the diagonal, a substitution") : null, right === up ? "from above, a deletion" : null, right === left ? "from the left, an insertion" : null].filter(Boolean).join(" or ");
        last = `${right}: ${how}. (diagonal ${diag}, above ${up}, left ${left})`;
        wrong = null; k++; paint();
        if (k >= CELLS.length) done();
      });
    };
    paint();
  }

  /* 5. The same table in Python, replayed from a real trace. */
  const CODE = [
    "def wer(said, typed):",
    "    r, h = said.split(), typed.split()",
    "    n, m = len(r), len(h)",
    "    d = [[0] * (m+1) for _ in range(n+1)]",
    "    for i in range(n+1): d[i][0] = i",
    "    for j in range(m+1): d[0][j] = j",
    "    for i in range(1, n+1):",
    "        for j in range(1, m+1):",
    "            diff = r[i-1] != h[j-1]",
    "            sub = d[i-1][j-1] + diff",
    "            miss = d[i-1][j] + 1",
    "            extra = d[i][j-1] + 1",
    "            d[i][j] = min(sub, miss, extra)",
    "    return d[n][m] / n"
  ];
  const MIN_LINE = 12;
  function asCode({ el, done, kit }) {
    css();
    let k = 0;
    const paint = () => {
      const [no, line, ev, d, i, j, sub, miss, extra] = TRACE[k];
      const ret = ev === "r";
      const cls = {};
      if (line === MIN_LINE && d) { cls[`${i},${j}`] = "next"; [[i - 1, j - 1], [i - 1, j], [i, j - 1]].forEach(([a, b]) => cls[`${a},${b}`] = "in"); }
      if (ret) cls[`${TR.length},${TH.length}`] = "enter";
      const prev = k > 0 && TRACE[k - 1][1] === MIN_LINE ? TRACE[k - 1] : null;
      const wrote = prev ? `The min line wrote${d[prev[4]][prev[5]]} in row "${TR[prev[4] - 1]}", column "${TH[prev[5] - 1]}". ` : "";
      const say = ret ? `${wrote}Return d[${TR.length}][${TH.length}] / ${TR.length} = ${d[TR.length][TH.length]} / ${TR.length} = ${d[TR.length][TH.length] / TR.length}, the ${pct(d[TR.length][TH.length] / TR.length)} you found by hand. Our run of this function on all 94 transcripts gave the same WER as jiwer, an open WER library.`
        : line === 1 ? `About to split both texts into words. The texts were normalized first (lower case, no punctuation), as on screen 2.`
        : line === 3 ? `r is ${JSON.stringify(TR)} and h is ${JSON.stringify(TH)}; n and m are their lengths. Next: a table of zeros with n + 1 rows and m + 1 columns.`
        : line === 4 ? `The table exists, all zeros. The next two lines fill the first column and the first row: i deletions, or j insertions, against nothing.`
        : line === 6 ? `The edges are filled: 0 1 2 3 across, 0 1 2 3 4 down. Now the two loops visit every inner cell, row by row.`
        : `${wrote}Now i = ${i} ("${TR[i - 1]}"), j = ${j} ("${TH[j - 1]}"). The four lines above the min line worked out the three ways in: sub = ${sub} (the diagonal ${d[i - 1][j - 1]} ${TR[i - 1] === TH[j - 1] ? "+ 0: the words are equal, and False counts as 0" : "+ 1: the words differ, and True counts as 1"}), miss = ${miss} (from above, a deletion), extra = ${extra} (from the left, an insertion). Say what the min line writes, then press Next step to see it in the table.`;
      // cells the run has not written yet hold the starting 0; they are left blank so the table reads like the one you filled
      const unwritten = (a, b) => a >= 1 && b >= 1 && (line === 6 || (line === MIN_LINE && (a > i || (a === i && b >= j))));
      const grid = d ? kit.pics.grid(d.map((r, a) => r.map((v, b) => unwritten(a, b) ? "" : v)), { cls, rowHead: ["", ...TR], colHead: ["", ...TH], title: line === 4 ? "d, all zeros so far" : "d, as it is at this step (blank: not written yet)" }) : "";
      const vars = [];
      if (k >= 1) vars.push(`step in full trace <b>${no + 1} / ${TRACE_ALL}</b>`);
      if (i != null && line === MIN_LINE) vars.push(`i <b>${i}</b>`, `j <b>${j}</b>`, `sub <b>${sub}</b>`, `miss <b>${miss}</b>`, `extra <b>${extra}</b>`);
      el.innerHTML = `<h1>The same table in Python</h1>
        <p class="lead">This is the function our scoring script used, replayed from a real run on the same words. We show the steps where a cell is about to be written and cut the steps in between. The highlighted line is the one about to run.</p>
        <p class="task">Step through to the end. Each time the min line, <code>d[i][j] = min(sub, miss, extra)</code>, is highlighted, say the number it will write before you press Next step.</p>
        ${grid}
        ${kit.code(CODE, line)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${k === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${k === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${vars.map(v => `<span>${v}</span>`).join("")}<span>shown <b>${k + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say)}`;
      el.querySelector("[data-prev]").onclick = () => { k--; paint(); };
      el.querySelector("[data-next]").onclick = () => { k++; paint(); if (k === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 6. Whisper itself: model size, language, prompt. Predict, then see the run. */
  // the prompt is split in two only so the lines fit a phone screen; P ends up equal to PROMPT
  const PROMPT_A = "Crop inspection notes. ", PROMPT_B = "Places: Chirchiq, Parkent.";
  const LIB_CMD = [
    "# whisper-cli reads flac, mp3, ogg and wav.",
    "# We made 16 kHz mono WAV files with the",
    "# ffmpeg flags from the whisper.cpp README:",
    "ffmpeg -i note.mp3 -ar 16000 -ac 1 \\",
    "    -c:a pcm_s16le note.wav",
    "",
    "whisper-cli -m ggml-tiny.bin -l en \\",
    "    -nt -np -f n1-snr10.wav",
    "whisper-cli -m ggml-base.bin -l en \\",
    "    -nt -np -f n1-snr10.wav",
    `P="${PROMPT_A}"`,
    `P+="${PROMPT_B}"`,
    "whisper-cli -m ggml-base.bin -l en \\",
    "    -nt -np -f n1-snr10.wav --prompt \"$P\""
  ];
  const PY = [
    "import whisper",
    "model = whisper.load_model(\"base\")",
    `prompt = ("${PROMPT_A}"`,
    `          "${PROMPT_B}")`,
    "result = model.transcribe(",
    "    \"n1-snr10.wav\",",
    "    language=\"en\",",
    "    initial_prompt=prompt,",
    ")",
    "print(result[\"text\"])"
  ];
  function library({ el, done, kit }) {
    css();
    const ch = (a, b) => b < a * 0.9 ? 0 : b > a * 1.1 ? 2 : 1; // fewer / about the same / more
    const noteGain = n => { const k = ["n1", "n2", "n3", "n4"].indexOf(n); return sum(LEVELS.map(([lv]) => EDITS.base.plain[lv][k] - EDITS.base.prompt[lv][k])); };
    const T = { tiny: total("tiny", "plain"), base: total("base", "plain"), bp: total("base", "prompt") };
    const Q = [
      { q: `Swap the tiny model for base (about twice the parameters) on all ${LEVELS.length * 4} English clips. The total number of edits…`, a: ch(T.tiny, T.base),
        say: [`Not here: ${T.tiny} edits with tiny, ${T.base} with base.`, `Right: ${T.tiny} edits with tiny, ${T.base} with base, out of ${N_ALL * LEVELS.length} words. On these clips the bigger model barely helped.`, `It did not get worse: ${T.tiny} edits with tiny, ${T.base} with base.`] },
      { q: `Keep base and add the prompt with the two place names. The total number of edits…`, a: ch(T.base, T.bp),
        say: [`Right: ${T.base} → ${T.bp} edits. The saving is in the two notes with place names: ${noteGain("n1")} fewer edits on the Chirchiq note, ${noteGain("n3")} fewer on the Parkent note. Without the prompt, base wrote Chirchiq as "circuit" and Parkent as "parking". On the other two notes the prompt added ${-(noteGain("n2") + noteGain("n4"))} edits, so the net saving is ${T.base - T.bp}.`, `It changed more than that: ${T.base} → ${T.bp} edits.`, `It went the other way: ${T.base} → ${T.bp} edits.`] }
    ];
    const ans = Q.map(() => null);
    const allOk = () => Q.every((q, i) => ans[i] === q.a);
    const OPTS = ["falls clearly", "stays about the same", "rises"];
    const paint = () => {
      const fin = allOk();
      el.innerHTML = `<h1>Running Whisper: three settings that matter</h1>
        <p class="lead">Whisper comes in several sizes, from <b>tiny</b> and <b>base</b> up to <b>large</b>. Bigger models are slower and need more memory, and are usually more accurate. We ran the tiny and base sizes on our Mac with <b>whisper.cpp</b>, a C/C++ program that runs Whisper models on ordinary computers. Three settings matter: <code>-m</code> picks the model file (the size), <code>-l</code> sets the spoken language, and <code>--prompt</code> gives the model a short text before the audio, for example names it should expect.</p>
        <p class="lead">Also in the commands: <code>-nt -np</code> only hide timestamps and progress lines, and <code>ggml-*.bin</code> is a whisper.cpp model file. A clip name like <code>n1-snr10</code> means note 1 with wind mixed in 10 dB (decibels, a loudness scale) quieter than the voice. At 0 dB the wind is as loud as the voice.</p>
        ${kit.code(LIB_CMD, -1)}
        ${run("whisper-cli -m ggml-tiny.bin -l en …", TX["tiny|n1-snr10|-l en"])}
        ${run("whisper-cli -m ggml-base.bin -l en …", TX["base|n1-snr10|-l en"])}
        ${run("… --prompt \"" + PROMPT + "\"", TX["base|n1-snr10|-l en --prompt"])}
        <p class="${P}cap">Output of our whisper-cli runs, ${RUN_DATE}, for note n1 with wind (the reference starts "${esc(REF.n1.slice(0, 26))}…").</p>
        <p class="task">We ran ${4} English notes at ${LEVELS.length} wind levels with each setting. Predict each change.</p>
        ${Q.map((q, i) => `<div class="lcase" id="c${i}"><p>${esc(q.q)}</p>${kit.options(OPTS, { picked: ans[i], correct: q.a })}${ans[i] == null ? "" : kit.feedback(q.say[ans[i]], ans[i] === q.a)}</div>`).join("")}
        ${fin ? `<div class="${P}wrap"><table class="${P}grid"><caption class="${P}cap" style="caption-side:top;text-align:left">WER on ${4} notes (${N_ALL} words) per wind level.</caption>
          <thead><tr><th></th>${LEVELS.map(([, n]) => `<th>${n}</th>`).join("")}</tr></thead><tbody>
          ${[["tiny", "plain", "tiny"], ["tiny", "prompt", "tiny + prompt"], ["base", "plain", "base"], ["base", "prompt", "base + prompt"]].map(([m, p, name]) => `<tr><td>${name}</td>${LEVELS.map(([lv]) => `<td>${pct(edits(m, p, lv) / N_ALL)}</td>`).join("")}</tr>`).join("")}
          </tbody></table></div>
          ${kit.feedback(`Read the table down and across. Wind moved WER the most: base goes from ${pct(edits("base", "plain", "clean") / N_ALL)} without wind to ${pct(edits("base", "plain", "snr0") / N_ALL)} at 0 dB, so a phone held close or a wind cover may beat any setting. The prompt is a hint, not a rule: on one windy clip tiny did worse with it ("${esc(TX["tiny|n1-snr0|-l en --prompt"].slice(0, 28))}…"). And ${N_ALL} words per level is a small test: one or two edits move a cell by several points, so treat close numbers as a tie and grow the test set from real notes before choosing.`)}
` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (allOk()) done();
      }));
    };
    paint();
  }

  /* 7. Broken on purpose: the night job's Russian notes. */
  const JOB = ["n1", "n2", "n3", "n4", "n5-clean", "n5-snr10"];
  function broken({ el, done, kit }) {
    css();
    const rows = JOB.map(c => {
      const note = c.slice(0, 2), clip = c.includes("-") ? c : `${c}-clean`;
      return { clip, note, tx: TX[`base|${clip}|`], s: score(REF[note], TX[`base|${clip}|`]) };
    });
    const fixA = score(REF.n5, TX["base|n5-clean|-l auto"]), fixB = score(REF.n5, TX["base|n5-snr10|-l auto"]);
    const mix = score(REF.n6, TX["base|n6-clean|-l auto"]), mixEn = score(REF.n6, TX["base|n6-clean|-l en"]);
    const C1 = [
      "The wind: the Russian notes are too noisy for the model.",
      "Whisper cannot transcribe Russian.",
      "The command sets no language, and whisper-cli then assumes English.",
      "The WER script cannot read Cyrillic letters."
    ];
    const F1 = [
      `Check the clean clip: ${esc(rows[4].clip)} has no wind at all and still came out in English (WER ${pct(rows[4].s.wer)}). Wind makes a transcript worse; it does not change the language it is written in.`,
      "",
      `Whisper is trained on many languages, Russian among them (its paper describes the training on multilingual audio). And look at the transcript itself: it is not bad Russian, it is English. Something told the model to write English.`,
      `The script is not the first thing that went wrong: the transcript itself is in English. Even a perfect scorer would compare English words with Russian ones.`
    ];
    const C2 = ["Add -l ru to every note in the job", "Add -l auto, so the model detects each note's language", "Add --translate, so everything comes out in English"];
    const F2 = [
      `That fixes the Russian notes and breaks the English ones the other way round. We ran the clean wheat-field note with <code>-l ru</code>: "${esc(TX["base|n4-clean|-l ru"])}" The job does not know in advance which language each note is in.`,
      "",
      "--translate tells the model to turn the speech into English. The log should hold what the inspector said, in his words; a translation is a different text, and you could no longer check it against the reference."
    ];
    const ans = [null, null];
    const paint = () => {
      const ok0 = ans[0] === 2, ok1 = ok0 && ans[1] === 1;
      el.innerHTML = `<h1>Broken on purpose: the night job</h1>
        <p class="lead">The office set up a job that transcribes the day's notes every night and scores a sample against typed references. Here is one night's report. The command was the same for every file:</p>
        ${kit.code(["whisper-cli -m ggml-base.bin \\", "    -nt -np -f <note>.wav"], -1)}
        <div class="${P}wrap"><table class="${P}grid"><thead><tr><th>clip</th><th>transcript</th><th>WER</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td>${esc(r.clip)}</td><td style="text-align:left;white-space:normal;min-width:180px">${esc(r.tx)}</td><td>${pct(r.s.wer)}</td></tr>`).join("")}
        </tbody></table></div>
        ${said("Reference for n5 (said in Russian)", REF.n5, GLOSS.n5)}
        <p class="${P}cap">Real whisper-cli output, ${RUN_DATE}. A WER above 100% means more edits than words said: the insertions count too.</p>
        <p class="task">Find the cause of the two bad rows, then the fix.</p>
        <div class="lcase" id="c0"><p>What is the cause?</p>${kit.options(C1.map(esc), { picked: ans[0], correct: 2 })}
          ${ans[0] == null ? "" : ok0 ? kit.feedback(`Right. Run <code>whisper-cli -h</code>: the line for <code>-l</code> says <code>[en]</code>, so with no <code>-l</code> the model is told the speech is English. On the clean Russian clip it wrote an English sentence that half translates the note ("${esc(rows[4].tx.slice(0, 22))}…"); on the windy one it gave up with "${esc(rows[5].tx)}". The English notes were fine only because the default happened to match. Be careful: other tools have other defaults. The Python package openai-whisper detects the language when you do not set one.`, true) : kit.feedback(F1[ans[0]], false)}</div>
        ${ok0 ? `<div class="lcase" id="c1"><p>Which change do you make to the job?</p>${kit.options(C2.map(esc), { picked: ans[1], correct: 1 })}
          ${ans[1] == null ? "" : ok1 ? kit.feedback(`Right. We reran both Russian clips with <code>-l auto</code>:`, true) : kit.feedback(F2[ans[1]], false)}</div>` : ""}
        ${ok1 ? `${run("whisper-cli -m ggml-base.bin -l auto … -f n5-clean.wav", TX["base|n5-clean|-l auto"])}
          ${run("whisper-cli -m ggml-base.bin -l auto … -f n5-snr10.wav", TX["base|n5-snr10|-l auto"])}
          ${kit.feedback(`WER ${pct(fixA.wer)} and ${pct(fixB.wer)} instead of ${pct(rows[4].s.wer)} and ${pct(rows[5].s.wer)}. One limit remains. A note that switches language halfway (Russian, then "${esc(REF.n6.split(". ").pop())}") came back with <code>-l auto</code> as "${esc(TX["base|n6-clean|-l auto"])}": the English half was dropped (WER ${pct(mix.wer)}). With <code>-l en</code> it kept only the English half (WER ${pct(mixEn.wer)}). In our runs base picked one language per clip. For mixed notes, ask inspectors for one language per recording, or cut recordings into parts first, and score mixed notes as their own group so the average does not hide them.`)}` : ""}`;
      el.querySelectorAll("#c0 .lopts button").forEach(b => b.onclick = () => { ans[0] = +b.dataset.i; if (ans[0] !== 2) ans[1] = null; paint(); });
      el.querySelectorAll("#c1 .lopts button").forEach(b => b.onclick = () => { ans[1] = +b.dataset.i; paint(); if (ans[0] === 2 && ans[1] === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture: speech to text, WER, and when a spoken reply is not worth it. */
  const SITS = [
    { s: "The app could read each transcript back aloud to the inspector (text to speech) right after he records it, so he can confirm it.",
      o: ["Add the spoken read-back", "Not worth it: show the text on the phone and let him fix key words"], ok: 1,
      no: { 0: "He holds the phone anyway and can read faster than he can listen. The read-back adds a speech model or a paid service per note, waiting time in the field, and in strong wind he may not hear it. A spoken reply earns its cost only when eyes or hands are busy." },
      yes: "Right. Reading is faster than listening, and the screen is already in his hand. Save text to speech for when eyes and hands are busy." },
    { s: "A tractor driver, hands on the wheel, asks the farm assistant which field to work next.",
      o: ["A spoken reply", "Text on the screen"], ok: 0,
      no: { 1: "His eyes are on the field and his hands on the wheel: reading a screen while driving is the risk. Here a short spoken reply is worth its cost." },
      yes: "Right. Eyes and hands are busy, and the answer is short. That is the case where speaking back pays for itself." },
    { s: "The office wants to know if a larger Whisper model is worth its cost on their notes. What do they need before any comparison?",
      o: ["A sample of real notes with typed references, grouped by language and noise", "Nothing: each model reports its own WER"], ok: 0,
      no: { 1: "A model cannot score itself: WER needs a reference, the words that were really said. Someone has to listen and type a sample of real notes. That typing is the main cost of measuring." },
      yes: "Right. That set of references is the golden set for speech: typed once, reused for every model and setting you try." }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = SITS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When speech to text pays off</h1>
        <p class="lead"><b>What it is for:</b> turning recordings into text you can store, search and feed to other tools: notes, calls, meetings, dictation. <b>When not:</b> when people could just tap a form, when only a few key fields matter (check those fields, not every word), or when a mistake is dangerous and nobody reviews it. <b>What it costs:</b> compute per minute of audio (more for larger models), typed references to measure it, and a check by a person where errors matter. A spoken reply (text to speech) is a separate cost: add it only when eyes or hands are busy.</p>
        <p class="task">For each situation, pick what you do. Pick again if you change your mind.</p>
        ${SITS.map((t, i) => `<div class="lcase" id="c${i}"><p>${esc(t.s)}</p>${kit.options(t.o.map(esc), { picked: ans[i], correct: t.ok })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === t.ok ? t.yes : t.no[ans[i]]), ans[i] === t.ok)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SITS.every((t, j) => ans[j] === t.ok)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: does word error rate answer the question? */
  const CASES = [
    ["A support team has typed transcripts of 300 recorded calls and wants to pick between two speech models.", true,
      "Yes. Same references, two transcripts each: count the edits, divide by the words said, compare. Split the result by accent or line quality too.",
      "This is exactly what WER is for: the same reference words, two candidate transcripts, a count of edits for each."],
    ["A team asks a chat model to summarise each voice note in two lines and wants to score those summaries against two-line summaries the agronomist wrote.", false,
      "No. WER counts word edits against the exact words said. A correct summary in other words gets a high WER, a wrong one that copies phrases a low one. Check the facts in it, or use a judge with a rubric.",
      "WER only rewards using the same words in the same order. Two good summaries rarely share their wording, so a good summary would score badly. Summaries need a check of their facts or a judge with a rubric."],
    ["A clinic's dictated prescriptions have a WER of 4% on 200 notes. Is that number enough to decide the doses in the transcripts are safe?", false,
      "No. WER treats every word the same: \"the\" for \"a\" costs as much as 50 for 15. Check the dose and drug fields on their own, and have a person confirm them.",
      "4% says how many words are wrong, not which ones. One wrong number in a dose is one word, like weed for wheat in the field note. Score the key fields separately and keep a person checking them."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is word error rate the right measure?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the farm.</p>
        <p class="task">For each one, decide: does WER answer the question being asked? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and what you should see. */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    const s2 = score(REF.n2, TX["base|n2-clean|-l en"]);
    const rr = REF.n2.split(" "), rh = TX["base|n2-clean|-l en"].split(" "), raw2 = { E: table(rr, rh)[rr.length][rh.length] };
    const CHECK = [
      `Your <code>wer("${esc(T_REF)}", "${esc(T_HYP)}")</code> returns ${TD[TR.length][TH.length] / TR.length}, and on the whole rows note ${s2.E} / ${s2.N} ≈ ${(s2.E / s2.N).toFixed(3)}.`,
      `<code>jiwer.wer</code> gives the same number as your function on every transcript: the notebook prints ${4 * LEVELS.length * 2} of ${4 * LEVELS.length * 2} (ours matched on all 94 in the lesson's runs).`,
      `Without normalizing (splitting the raw texts on spaces), the rows note scores ${raw2.E} edits instead of ${s2.E}: "4-9" stays one word that matches neither "4" nor "9", and "Rows 4 to 9" has two more words than "Rose 4-9".`,
      `The Russian note with the language set to English gives no Cyrillic text; with the language detected, Whisper reports <code>ru</code> and the note comes back in Cyrillic (as in our whisper.cpp runs).`,
      `WER rises as the wind gets louder: both rows of the notebook's table are much higher at 0 dB than with no wind. In our whisper.cpp run of tiny: ${pct(edits("tiny", "plain", "clean") / N_ALL)} without wind, ${pct(edits("tiny", "plain", "snr0") / N_ALL)} at 0 dB. The notebook runs the Python package on a different voice, so expect the same direction, not the same numbers.`
    ];
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now line a transcript up with its reference, count substitutions, deletions and insertions, and compute word error rate with an edit-distance table. You know the Whisper settings that matter (model size, language, prompt), why a missing language setting quietly breaks non-English notes, and when a spoken reply is not worth adding.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}doc" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a>.` : "The notebook for this lesson is on its way."} It makes the same notes with a free text-to-speech voice, adds the same wind, transcribes them with Whisper tiny in Python, and scores them with your own <code>wer</code> and with jiwer. What you should see:</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      <p class="lead"><b>The same settings in Python.</b> The settings from screen 6 in the Python package <code>openai-whisper</code>, written from its official documentation, checked 2026-11-14. The notebook runs this package with the tiny model; this cell, with base, was not run by us.<br><a class="${P}doc" href="https://github.com/openai/whisper" target="_blank" rel="noopener">openai-whisper documentation</a></p>
      ${kit.code(PY, -1)}
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. Scans are the same problem for paper: a model reads something messy into text, and you check its output against what is really on the page.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Speech to text and word error rate",
    checked: "2026-11-14",
    sources: [
      "https://github.com/openai/whisper",
      "https://github.com/openai/whisper/blob/main/whisper/transcribe.py",
      "https://arxiv.org/abs/2212.04356",
      "https://github.com/ggml-org/whisper.cpp",
      "https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md",
      "https://jitsi.github.io/jiwer/usage/"
    ],
    interview: [{
      q: "You ship voice-note transcription with Whisper. Most users are happy, but one team says its transcripts are useless. How do you find out what is wrong?",
      good: [
        "Get a sample of that team's real recordings and have someone type references for them",
        "Normalize both texts the same way (case, punctuation, numbers) before computing WER, so formatting does not count as errors",
        "Report WER per group (language, noise, speaker), not one average that hides the bad group",
        "Read the failing transcripts: wrong language setting, unknown names (try a prompt with them), or noise (fix the recording)",
        "Check the fields that matter, like numbers and names, separately from WER"
      ],
      weak: "Switch to the largest Whisper model. Without references and per-group scores you do not know whether size is the problem; in a language-setting bug it changes nothing."
    }, {
      q: "A product manager wants the assistant to speak all its answers aloud, not only show them. What do you ask before agreeing?",
      good: [
        "Are users' eyes or hands busy when they use it (driving, walking a field), or are they looking at a screen anyway?",
        "How long are the answers? Numbers, lists and tables are hard to follow by ear",
        "Where are they? Noise can make a spoken answer useless",
        "What it adds: a speech model or paid service per answer, extra waiting time, and one more thing to test",
        "Start with text and add speech for the hands-busy cases"
      ],
      weak: "Yes, voice feels modern. That skips who needs it and what it costs per answer."
    }],
    screens: [situation, byHand, spot, fillTable, asCode, library, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="0"]'], right: ['[data-i="1"]'] },
      { wrong: ["[data-check]"], right: ['[data-inc="S"]', '[data-inc="S"]', '[data-inc="D"]', "[data-check]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(CELLS.length).fill("[data-right]") },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SITS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
