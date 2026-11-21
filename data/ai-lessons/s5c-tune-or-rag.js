/* Lesson s5c-tune-or-rag: Fine-tuning, RAG or a better prompt: choosing.
   Story: Fernbrook Tile Wholesale (made up). Its quote assistant answers customer emails with a price quote. The
   quotes ignore the house format and cite last season's (Spring) catalogue; Autumn is current.
   Ideas: (1) first ask WHAT IS MISSING: knowledge that changes or is too big for a prompt (retrieval), or behaviour
   (how to write the answer): say or show it in the prompt first, train it in (fine-tune) only when it cannot be
   written down but many good examples exist; (2) when not: anything that must be exact (box counts) belongs in
   code, and fine-tuning does not keep facts current.
   Depth: explain (screens 1, 2, 3, 5, 6, 9 and the interview), when-not (screens 4, 7, 8).
   Data, all real:
   - Recordings (scripts/ai/record.mjs, openrouter, google/gemini-2.5-flash-lite, temperature 0, 2026-11-13) in the
     main checkout, docs/ai-path/recordings/s5c-tune-or-rag/:
     v1-r01..08 the old assistant (one-line prompt plus the whole Spring catalogue);
     v2-r01..08 the house format in the prompt plus only the Autumn rows for the products in the email;
     v3-r01..08 v2 plus a cover line in the sales desk's voice, shown by three example lines;
     lab-r01..08 warehouse pick labels from three past examples only; rul-r01..08 the same with three habits written
     down (the label cards on screen 1 are keyed to the prompt pile because rul fixes exactly those misses). The lab/rul request files and the desk's own labels come from docs/ai-path/runs/s5c-tune-or-rag/labels.py.
   - docs/ai-path/runs/s5c-tune-or-rag/quotes.py -> quotes.out.txt (box counts by the house rule in Python against
     the model's, format checks, input tokens per version); labels.py -> labels-lab.out.txt, labels-rul.out.txt.
   Every count, score and token figure on screen is computed here from the constants below.
   Lesson-local style (<style id="lx-s5c-tune-or-rag">): recorded-text blocks, the sorting cards, the label table.
   Plain browser script. */
(() => {
  const ID = "s5c-tune-or-rag", P = "lx-" + ID + "-";
  const REC_DATE = "2026-11-13";
  const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const word = n => WORDS[n] || String(n);
  const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const mean = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);

  /* ---------- Recorded text (copied from the recordings; trimmed only with … ) ---------- */
  // provider openrouter, model google/gemini-2.5-flash-lite, recorded 2026-11-13. src: s5c-tune-or-rag/<name>
  // v1: single lines from the old assistant's answers (each card names its recording)
  const V1 = {
    slate: { src: "v1-r01", text: "*   **Product:** SG3060 - Slate Grey porcelain 30x60" },
    lvt: { src: "v1-r03", text: "We do not currently carry \"Oak Plank LVT\" in our Spring 2026 catalogue. …" },
    grout: { src: "v1-r02", text: "| GR-5   | Grout 5 kg bag              | 2 bags   | 9.50             | 19.00             |" },
    date: { src: "v1-r02", text: "**Date:** October 26, 2023\n**Quote Number:** FTW-2023-10-26-001" },
    vat: { src: "v1-r08", text: "**VAT (if applicable):** [Insert VAT amount here]" },
    friday: { src: "v1-r04", text: "*   Delivery on Friday can be arranged. Please confirm your preferred delivery time." },
    tone: { src: "v1-r01", text: "Thank you for your repeat business! … please do not hesitate to contact us." },
    advice: { src: "v1-r06", text: "*   We recommend our **Flexible tile adhesive (AD-20)** for the Herringbone oak-look porcelain …" }
  };
  // v2-r01..08 and v3-r01..08: the full answers
  const REC_V2 = ["QUOTE FOR: Dana Kovac\nBS3060 | Basalt porcelain 30x60 (replaces Slate Grey 30x60) | 6 boxes | EUR 39.90 | EUR 239.40\nSUBTOTAL: EUR 239.40\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.", "QUOTE FOR: Marek Builders\nCG6060 | Carrara Gloss porcelain 60x60 | 10 boxes | EUR 44.50 | EUR 445.00\nGR-5 | Grout 5 kg bag | 2 bags | EUR 9.90 | EUR 19.80\nSUBTOTAL: EUR 464.80\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.", "QUOTE FOR: Lina Osei\nLVT-OAK | Oak Plank luxury vinyl (LVT) | 11 boxes | EUR 46.00 | EUR 506.00\nSUBTOTAL: EUR 506.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\nNOTE: Sales will reply to your question.", "QUOTE FOR: Pavel Tiling\nWM1020 | White Metro wall tile 10x20 | 4 boxes | EUR 22.00 | EUR 88.00\nAD-20 | Flexible tile adhesive 20 kg bag | 1 bag | EUR 18.00 | EUR 18.00\nSUBTOTAL: EUR 106.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\nNOTE: Sales will reply to your question.", "QUOTE FOR: Ruth Ahmed\nTS6060 | Terrazzo Speckle porcelain 60x60 | 18 boxes | EUR 49.00 | EUR 882.00\nSUBTOTAL: EUR 882.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.", "QUOTE FOR: Hollis & Sons\nHB-OAK | Herringbone oak-look porcelain | 10 boxes | EUR 52.00 | EUR 520.00\nAD-20 | Flexible tile adhesive 20 kg bag | 2 bags | EUR 18.00 | EUR 36.00\nSUBTOTAL: EUR 556.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\nNOTE: Sales will reply to your question.", "QUOTE FOR: Sami Lehto\nCG6060 | Carrara Gloss porcelain 60x60 | 15 boxes | EUR 44.50 | EUR 667.50\nWM1020 | White Metro wall tile 10x20 | 5 boxes | EUR 22.00 | EUR 110.00\nSUBTOTAL: EUR 777.50\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.", "QUOTE FOR: Greta Novak\nTS6060 | Terrazzo Speckle porcelain 60x60 | 8 boxes | EUR 49.00 | EUR 392.00\nGR-5 | Grout 5 kg bag | 2 bags | EUR 9.90 | EUR 19.80\nSUBTOTAL: EUR 411.80\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026."];
  const REC_V3 = ["QUOTE FOR: Dana Kovac\nBS3060 | Basalt porcelain 30x60 (replaces Slate Grey 30x60) | 7 boxes | EUR 39.90 | EUR 279.30\nSUBTOTAL: EUR 279.30\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\nDana, the Basalt replaces Slate Grey, same size, same box.", "QUOTE FOR: Marek Builders\nCG6060 | Carrara Gloss porcelain 60x60 | 10 boxes | EUR 44.50 | EUR 445.00\nGR-5 | Grout 5 kg bag | 2 bags | EUR 9.90 | EUR 19.80\nSUBTOTAL: EUR 464.80\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\n\nMarek, 10 boxes covers the floor with the cut allowance.", "QUOTE FOR: Lina Osei\nLVT-OAK | Oak Plank luxury vinyl (LVT) | 11 boxes | EUR 46.00 | EUR 506.00\nSUBTOTAL: EUR 506.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\n\nLina, 11 boxes covers the floor with the cut allowance.", "QUOTE FOR: Pavel Tiling\nWM1020 | White Metro wall tile 10x20 | 4 boxes | EUR 22.00 | EUR 88.00\nAD-20 | Flexible tile adhesive 20 kg bag | 1 bag | EUR 18.00 | EUR 18.00\nSUBTOTAL: EUR 106.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\nNOTE: Sales will reply to your question.\nPavel, Friday delivery is not guaranteed with this quote.", "QUOTE FOR: Ruth Ahmed\nTS6060 | Terrazzo Speckle porcelain 60x60 | 17 boxes | EUR 49.00 | EUR 833.00\nSUBTOTAL: EUR 833.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\n\nRuth, 17 boxes cover your floors with the cut allowance.", "QUOTE FOR: Hollis & Sons\nHB-OAK | Herringbone oak-look porcelain | 10 boxes | EUR 52.00 | EUR 520.00\nAD-20 | Flexible tile adhesive 20 kg bag | 2 bags | EUR 18.00 | EUR 36.00\nSUBTOTAL: EUR 556.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\nNOTE: Sales will reply to your question.\n\nHollis & Sons, 10 boxes covers the floor with the cut allowance.", "QUOTE FOR: Sami Lehto\nCG6060 | Carrara Gloss porcelain 60x60 | 22 boxes | EUR 44.50 | EUR 979.00\nWM1020 | White Metro wall tile 10x20 | 5 boxes | EUR 22.00 | EUR 110.00\nSUBTOTAL: EUR 1089.00\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\n\nSami, 22 boxes of Carrara Gloss covers your floor with the cut allowance.", "QUOTE FOR: Greta Novak\nTS6060 | Terrazzo Speckle porcelain 60x60 | 8 boxes | EUR 49.00 | EUR 392.00\nGR-5 | Grout 5 kg bag | 2 bags | EUR 9.90 | EUR 19.80\nSUBTOTAL: EUR 411.80\nPrices ex VAT. Valid 14 days. Catalogue: Autumn 2026.\nGreta, 8 boxes covers the floor with the cut allowance."];
  // lab-r01..08 (three examples only) and rul-r01..08 (three habits written down): full answers
  const REC_LAB = ["R-BS3060-5B-D", "R-CG6060-11B-D\nT-GR-5-2S-D", "T-LVT-OAK-11B-D", "R-WM1020-4B-D\nT-AD-20-1S-D", "R-TS6060-17B-D", "T-HB-OAK-11B-D", "R-CG6060-16B-D\nR-WM1020-5B-D", "R-TS6060-9B-D\nT-GR-5-2S-D"];
  const REC_RUL = ["R-BS3060-5B-W", "T-CG6060-11B-W\nT-GR-5-2S-W", "R-LVT-OAK-11B-D", "T-WM1020-4B-W\nT-AD-20-1S-W", "R-TS6060-17B-W", "T-HB-OAK-11B-D", "R-CG6060-16B-D\nR-WM1020-5B-W", "R-TS6060-9B-D\nR-GR-5-2S-D"];
  // usage.prompt_tokens of each recording, r01..r08
  const TOKENS = { v1: [278, 277, 269, 280, 278, 273, 281, 273], v2: [376, 384, 353, 390, 367, 378, 397, 382], v3: [503, 511, 480, 517, 494, 505, 524, 509], lab: [281, 289, 273, 292, 282, 276, 295, 284], rul: [405, 413, 397, 416, 406, 400, 419, 408] };

  /* ---------- Story data (written for the lesson, used in the requests; not model output) ---------- */
  // The eight customer emails (the user messages of every recording, r01..r08)
  const CUSTOMERS = ["Dana Kovac", "Marek Builders", "Lina Osei", "Pavel Tiling", "Ruth Ahmed", "Hollis & Sons", "Sami Lehto", "Greta Novak"];
  const DANA_EMAIL = "Hi, I need the Slate Grey 30x60 again for a bathroom floor, 6.2 m2. Price please.";
  // Tile lines: [request index, code, area in m2 x 100, m2 per box x 100] (quotes.py TILE_LINES; Ruth: 9 + 7.5 m2)
  const TILE = [[0, "BS3060", 620, 144], [1, "CG6060", 1400, 144], [2, "LVT-OAK", 2200, 220], [3, "WM1020", 350, 100], [4, "TS6060", 1650, 108], [5, "HB-OAK", 1100, 120], [6, "CG6060", 2000, 144], [6, "WM1020", 400, 100], [7, "TS6060", 800, 108]];
  const CUT_PCT = 110; // the house rule: area x 1.10 for cutting
  // the desk's labels (labels.py REQUESTS): room letter, trade customer?, lines [code, qty, unit]
  const DESK = [["W", false, [["BS3060", 5, "B"]]], ["W", true, [["CG6060", 11, "B"], ["GR-5", 2, "S"]]], ["D", false, [["LVT-OAK", 11, "B"]]], ["W", true, [["WM1020", 4, "B"], ["AD-20", 1, "S"]]], ["W", false, [["TS6060", 17, "B"]]], ["D", true, [["HB-OAK", 11, "B"]]], ["D", false, [["CG6060", 16, "B"], ["WM1020", 5, "B"]]], ["?", false, [["TS6060", 9, "B"], ["GR-5", 2, "S"]]]];
  const DESK_LABELS = DESK.map(([room, trade, lines]) => lines.map(([c, q, u]) => `${trade ? "T" : "R"}-${c}-${q}${u}-${room}`));
  // the three past quotes the model was shown (labels.py SYSTEM)
  const LAB_EXAMPLES = [["Tom Berg", "Bathroom floor, 5 m2 of the Basalt please.", "R-BS3060-4B-W"], ["Brick & Co", "Hallway, 9 m2 of the herringbone, plus a bag of grout.", "T-HB-OAK-9B-D\nT-GR-5-1S-D"], ["Ana Silva", "Living room, about 12 m2 of Terrazzo Speckle.", "R-TS6060-13B-D"]];

  /* ---------- Derived (computed here) ---------- */
  const ceilDiv = (a, b) => Math.floor((a + b - 1) / b); // whole numbers only, so exact
  const ruleBoxes = (area100, per100) => ceilDiv(area100 * CUT_PCT, per100 * 100);
  const boxesIn = (text, code) => { const m = text.match(new RegExp(code.replace(/[-]/g, "\\-") + " \\|[^|]*\\| (\\d+) boxes")); return m ? +m[1] : null; };
  const BOX = TILE.map(([r, code, a, p]) => ({ r, code, a, p, rule: ruleBoxes(a, p), v2: boxesIn(REC_V2[r], code), v3: boxesIn(REC_V3[r], code) }));
  const BOX_OK = v => BOX.filter(b => b[v] === b.rule).length;
  const HOUSE_LAST = "Prices ex VAT. Valid 14 days. Catalogue: Autumn 2026.";
  const FORMAT_OK = REC_V2.filter(t => t.startsWith("QUOTE FOR: ") && t.includes(HOUSE_LAST)).length;
  const COVER = REC_V3.map(t => t.split(HOUSE_LAST)[1].split("\n").filter(l => l.trim() && !l.startsWith("NOTE:")).pop());
  const COPY_SHAPE = /cover(s)? (the|your) floors? with the cut allowance/;
  const COPIES = COVER.map(l => COPY_SHAPE.test(l));
  const coverBoxes = l => { const m = l.match(/(\d+) boxes/); return m ? +m[1] : null; };
  const COVER_WRONG = COVER.map((l, r) => { const n = coverBoxes(l), b = BOX.find(x => x.r === r); return n != null && n !== b.rule; });
  const labLines = t => t.split("\n").map(s => s.trim()).filter(Boolean);
  const scoreLabels = rec => { let ok = 0, n = 0; rec.forEach((t, r) => { const got = labLines(t); DESK_LABELS[r].forEach((w, k) => { n++; if (got[k] === w) ok++; }); }); return { ok, n }; };
  const LAB = scoreLabels(REC_LAB), RUL = scoreLabels(REC_RUL);
  const TOK = { v1: mean(TOKENS.v1), v2: mean(TOKENS.v2), v3: mean(TOKENS.v3), lab: mean(TOKENS.lab), rul: mean(TOKENS.rul) };
  const DANA = BOX[0];
  const fmt2 = n => (n / 100).toFixed(2).replace(/\.?0+$/, "");

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P.slice(0, -1))) return;
    const s = document.createElement("style");
    s.id = P.slice(0, -1);
    s.textContent = `
      .${P}rec { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 8px; font: 500 13.5px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}know { margin: 8px 0 0; font-size: 15px; line-height: 1.45; color: var(--ink-2); font-weight: 400; }
      .${P}card .lopts button { padding: 10px 14px; font-size: 16px; }
      .${P}card .lopts button[aria-pressed="true"]:not(.right):not(.wrong) { border-color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
      .${P}tally { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 14px 0 0; font-size: 15px; color: var(--ink-2); }
      .${P}tally b { font-family: var(--mono); color: var(--ink); }
      .${P}check { margin-top: 16px; min-height: 48px; }
      .${P}tbl { width: 100%; margin: 14px 0 0; border-collapse: collapse; table-layout: fixed; font-size: 14px; }
      .${P}tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding-bottom: 6px; }
      .${P}tbl th, .${P}tbl td { border-bottom: 1px solid var(--line); padding: 7px 4px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      .${P}tbl th { font-weight: 600; color: var(--ink-2); font-size: 13px; }
      .${P}tbl th:first-child { width: 24%; }
      .${P}lbl th:first-child { width: 19%; } .${P}lbl th:last-child { width: 13%; }
      .${P}tbl td.m { font: 500 13px/1.45 var(--mono); white-space: pre-line; }
      .${P}tbl td.ok { color: var(--good); }
      .${P}tbl td.bad { color: var(--bad); }
      .${P}tbl td.ok::before { content: "✓ "; } .${P}tbl td.bad::before { content: "✗ "; }
      .${P}steps { margin: 12px 0 0; padding-left: 20px; font-size: 15.5px; line-height: 1.5; }
      .${P}out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font: 500 12.5px/1.55 var(--mono); white-space: pre; overflow-x: auto; color: var(--ink); }
      @media (max-width: 520px) { .${P}tbl { font-size: 13px; } .${P}tbl td.m { font-size: 12px; } }
    `;
    document.head.appendChild(s);
  }
  const rec = (kit, text) => `<div class="${P}rec">${kit.esc(text)}</div>`;
  const cap = () => `<p class="${P}cap">Recorded model output, ${REC_DATE}</p>`;
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
  function multiPick(el, done, kit, { head, items, opts }) {
    const ans = items.map(() => null);
    const paint = () => {
      el.innerHTML = `${head()}
        ${items.map((it, i) => `<div class="lcase" id="c${i}"><p>${it.q}</p>${ask(kit, opts, it.right, ans[i], it.fb)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (items.every((it, j) => ans[j] === it.right)) done();
      }));
    };
    paint();
  }
  /* A screen of questions asked one after the other; each right answer reveals its `after` text. */
  function sequence(el, done, kit, { head, qs }) {
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k >= qs.length, q = qs[Math.min(k, qs.length - 1)];
      el.innerHTML = `${head(k)}
        ${qs.slice(0, k).map(x => kit.feedback(x.after(), true)).join("")}
        ${fin ? "" : `<p class="task">${q.q}</p>${q.extra ? q.extra() : ""}<div class="lpanel">${kit.options(q.opts, { picked: wrong, correct: q.right, num: !!q.num })}${wrong != null ? kit.feedback(q.fb[wrong], false) : ""}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== qs[k].right) { wrong = i; paint(); return; }
        wrong = null; k++; paint();
        if (k >= qs.length) done();
      });
    };
    paint();
  }
  const numOpts = (right, others) => [...new Set([right, ...others])].sort((a, b) => a - b);

  /* 1. The situation, and the by-hand sort of ten real failures, checked against the key afterwards. */
  const PILES = ["Prompt", "Retrieval (RAG)", "Fine-tune"];
  const CARDS = [
    { who: "Dana Kovac", rec: V1.slate, know: "Dana asked for “the Slate Grey 30x60 again”. Slate Grey was dropped from the Autumn catalogue; Basalt BS3060 replaced it.", right: 1,
      fb: ["No instruction can tell the model which products exist this season. That is a fact that changes, and it lives in the Autumn catalogue.", "Right. The model quoted the catalogue it was given, and that was Spring. Give it the current rows for the products in the email, at question time.", "Training on past quotes would teach it last season's products even more firmly. Next season the catalogue changes again, and you would train again."] },
    { who: "Lina Osei", rec: V1.lvt, know: "Oak Plank LVT is new in the Autumn catalogue.", right: 1,
      fb: ["No wording helps: the product is not in anything the model was given. It needs the new catalogue row.", "Right. A missing fact: the new product's row has to reach the prompt.", "Fine-tuning shapes how the model writes. A new product is a fact, and facts that change belong in the text you put in front of it."] },
    { who: "Marek Builders", rec: V1.grout, know: "The Autumn price of grout GR-5 is EUR 9.90.", right: 1,
      fb: ["The model copied the price it was given. A better instruction cannot make a Spring price an Autumn one.", "Right. The price is a fact from last season's catalogue. Put this season's row in the prompt.", "Prices change every season. Training a price into the weights means training again at every change, and wrong quotes in between."] },
    { who: "Marek Builders", rec: V1.date, know: "The house format has no date line and no quote number: the order system adds both.", right: 0,
      fb: ["Right. Nobody told the model the house format, so it made one up, with an invented date and number. Write the format into the prompt, with an example.", "There is no fact to look up. The model needs to know what the house quote looks like: an instruction.", "Before training anything, tell the model the format. You have not tried that yet, and it takes minutes."] },
    { who: "Greta Novak", rec: V1.vat, know: "House quotes say “Prices ex VAT.” and never leave a gap to fill in.", right: 0,
      fb: ["Right. The model guessed a format and left a placeholder in it. The house line is one sentence to add to the prompt.", "No document is missing. The model needs the rule “prices ex VAT, no gaps”: an instruction.", "One line in the prompt fixes this. Fine-tuning comes after you have tried saying it."] },
    { who: "Pavel Tiling", rec: V1.friday, know: "The quote assistant must never promise delivery. Questions a quote cannot answer go to the sales desk.", right: 0,
      fb: ["Right. A rule nobody gave it. Write it: questions the quote does not answer get one line, “Sales will reply”.", "A delivery schedule would only make its promise better informed. The house wants no promise at all: that is a rule for the prompt.", "A one-line rule is the first thing to try. Training is for behaviour you cannot write down."] },
    { who: "Dana Kovac", rec: V1.tone, know: "The sales desk writes short, plain lines: no thanks, no “please do not hesitate”.", right: 0,
      fb: ["Right. The voice was never described. Say it, and show a few lines in that voice (examples, as in the few-shot lesson).", "Tone is not a fact in a document. It is how to write, so it starts in the prompt.", "Not yet: describe the voice and show examples first. Training is for when that has been tried and still does not hold."] },
    { who: "Hollis & Sons", rec: V1.advice, know: "House rule: product advice comes from the sales desk, never from a quote.", right: 0,
      fb: ["Right. Same as the Friday promise: a rule to write down. Questions the quote does not answer go to sales.", "A fitting guide could make the advice accurate, but the house does not want the assistant to advise at all. That is a rule.", "A rule you can state in one sentence goes in the prompt first."] },
    { who: "Marek Builders", rec: { src: "lab-r02", text: REC_LAB[1] }, know: `A pick label is a short code per quote line that tells the warehouse what to pack. The desk wrote <code>${DESK_LABELS[1].join(" ")}</code>. The model was shown three past quotes with their labels and nothing else: nobody told it what the letters mean.`, right: 0, label: true,
      fb: ["Right. Nobody said what R, T, W and D stand for, so the model guessed from three examples. Write down the habits you can name first; a later screen tries exactly that and counts the result.", "No document is missing. The letters are a way of writing labels: say what they mean.", "Not yet. The team has not even written down the habits it can name. That takes minutes; training needs a dataset and test runs. Try the prompt first."] },
    { who: "Dana Kovac", rec: { src: "lab-r01", text: REC_LAB[0] }, know: `The desk wrote <code>${DESK_LABELS[0].join(" ")}</code>. Dana's email says “bathroom floor”. Same three examples in the prompt, no habits written down.`, right: 0, label: true,
      fb: ["Right. W means a wet room, and a bathroom is one, but nobody told the model that. One written line about the room letter is the first fix to try.", "There is no fact to fetch. What the room letters mean is a habit of writing: say it in the prompt.", "Three examples did not teach the letters, but saying what W and D mean has not been tried yet. Do that first; fine-tuning is for habits nobody can state."] }
  ];
  function sortCards({ el, done, kit }) {
    ensureStyle();
    const picks = CARDS.map(() => null);
    let checked = false, passed = false, nOk = 0;
    const nTune = CARDS.filter(c => c.right === 2).length;
    const paint = () => {
      const left = picks.filter(p => p == null).length;
      const count = p => picks.filter(x => x === p).length;
      el.innerHTML = `<h1>Ten quotes that went out wrong</h1>
        <p class="lead">When an AI feature gives wrong answers, you have three usual fixes: change the <b>prompt</b>, <b>retrieve</b> the right text into it (RAG), or <b>fine-tune</b> (train the model further on your own examples). This lesson is about choosing between them.</p>
        <p class="lead">Fernbrook Tile Wholesale sells tiles to builders and home owners. Its quote assistant reads a customer's email and writes a price quote. The sales desk has two complaints: the quotes ignore the house format, and they use last season's catalogue. The assistant got a one-line instruction and the whole Spring catalogue. But the Autumn catalogue is the current one. Below are ten pieces of its real output, each with what the team knows.</p>
        <p class="task">Put each failure in the pile of the change that would fix it. Then check your piles against the key.</p>
        ${CARDS.map((c, i) => {
          const p = picks[i], ok = p === c.right;
          return `<div class="lcase ${P}card" id="c${i}"><p>${i + 1}. ${kit.esc(c.who)}${c.label ? ": warehouse pick labels" : ""}</p>
            ${rec(kit, c.rec.text)}${cap()}
            <p class="${P}know"><b>Known:</b> ${c.know}</p>
            <div class="lopts">${PILES.map((t, j) => `<button type="button" data-i="${j}"${j === c.right ? " data-right" : ""}${j === (c.right === 0 ? 1 : 0) ? " data-wrong" : ""} aria-pressed="${p === j}" class="${checked && p === j ? (ok ? "right" : "wrong") : ""}">${t}</button>`).join("")}</div>
            ${checked && p != null ? kit.feedback(c.fb[p], ok) : ""}</div>`;
        }).join("")}
        <div class="${P}tally">${PILES.map((t, j) => `<span>${t} <b>${count(j)}</b></span>`).join("")}<span>not sorted <b>${left}</b></span></div>
        <div class="lpanel">
          ${passed ? "" : `<button type="button" class="btn ${P}check" id="check" ${left ? "disabled" : ""}>${left ? `Sort all ten first (${left} left)` : checked ? "Check again" : "Check against the key"}</button>`}
          ${checked ? (passed
            ? kit.feedback(`All ten in the right pile. ${Cap(word(CARDS.filter(c => c.right === 0).length))} went to the prompt, ${word(CARDS.filter(c => c.right === 1).length)} to retrieval and ${nTune ? `only ${word(nTune)}` : "none"} to fine-tuning: ${nTune ? "the rest" : "every one"} had a cheaper fix to try first. The next screen asks what made the difference.`, true)
            : kit.feedback(`${nOk} of ${CARDS.length} in the right pile at the last check. Each card says why. Move the ones marked as mistakes (the feedback updates as you pick), then check again.`, false)) : ""}
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

  /* 2. Spot the idea: the one question that sorts a failure. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    oneQ(el, done, kit, {
      head: () => `<h1>What decided the pile?</h1>
        <p class="lead">Three piles, ten failures. Some looked serious (wrong prices), some looked small (a placeholder), and the serious ones did not all go to the same pile.</p>
        <p class="task">Which single question sorts a failure into its pile?</p>`,
      opts: [
        "How serious is the failure for the business?",
        "What is missing: a fact the model cannot know, or how to write the answer? And for how to write it: can you say it in the prompt?",
        "Do we have data about it? With data, fine-tune; without, write a prompt.",
        "Would a bigger model get it right?"
      ],
      right: 1,
      fb: [
        ["The outdated prices were serious and went to retrieval; the invented promise was serious too and went to the prompt. How bad a failure is tells you how urgently to fix it, not which change fixes it.", false],
        [`Right. <b>A missing fact</b> (this season's products and prices) goes to <b>retrieval</b>, or <b>RAG</b> as in the RAG lesson: fetch the current text and put it in the prompt at question time. <b>Missing behaviour</b> (format, rules, voice) goes to the <b>prompt</b> first: say it and show it. Only behaviour you <b>cannot</b> write down, but have many good examples of, goes to <b>fine-tuning</b>. None of the ten was like that yet. Fine-tuning trains the model's own weights further on example inputs and the outputs you want, so the behaviour is built in. Cheapest first: a prompt change takes minutes; fine-tuning needs a dataset, training runs and a new round of tests.`, true],
        ["The catalogue is data too, yet it went to retrieval. Trained into the weights, it would be frozen at last season, and in one research comparison (Ovadia and others, 2023) models learned new facts poorly through fine-tuning on raw text, and retrieval did better. Data decides what you can train on, not what you should.", false],
        ["No model, however big, knows Fernbrook's Autumn catalogue or its house format. It has never seen either. The fix is to give it what is missing.", false]
      ]
    });
  }

  /* 3. Use it, with predictions: the cheap fixes, against the real recorded answers. */
  function cheapFixes({ el, done, kit }) {
    ensureStyle();
    const n = REC_V2.length, nT = BOX.length, okB = BOX_OK("v2");
    const o1 = numOpts(FORMAT_OK, [n - 4, 2]).map(String), o3 = numOpts(okB, [nT, nT - 2]).map(String);
    sequence(el, done, kit, {
      head: () => `<h1>Try the cheap fixes first</h1>
        <p class="lead">The team made two changes. <b>Prompt:</b> the house format, written out, with one example quote, the rule for boxes (area × 1.10 for cutting, divided by m² per box, rounded up) and the rule “questions go to sales”. <b>Retrieval:</b> instead of the whole Spring catalogue, only the Autumn rows for the products in the email go into the prompt. The same ${word(n)} emails were sent again.</p>`,
      qs: [
        { q: `In how many of the ${word(n)} answers will the quote start with “QUOTE FOR:” and end with the house line about VAT?`, opts: o1, num: true, right: o1.indexOf(String(FORMAT_OK)),
          fb: o1.map(o => `More than that. Telling the model the format, with one example, was enough here.`),
          after: () => `Right: ${FORMAT_OK} of ${n}. The format was never hard for the model. Nobody had told it.` },
        { q: "Dana asked for “the Slate Grey 30x60 again”. Slate Grey is gone; the Autumn row for her request says Basalt replaces it. What will her quote offer?",
          opts: ["Slate Grey at the Spring price", "Basalt BS3060 at the Autumn price", "Nothing: it will say the product is gone"], right: 1,
          fb: ["The Spring catalogue is no longer in the prompt. The model can only quote what it was given: the Autumn row.", null, "The Autumn row itself says Basalt replaces Slate Grey, so the model has something to offer."],
          after: () => `Right. Her recorded quote:${rec(kit, REC_V2[0])}${cap()}` },
        { q: `There are ${nT} tile lines in the ${word(n)} quotes. With the box rule in the prompt, how many have the right number of boxes?`, opts: o3, num: true, right: o3.indexOf(String(okB)),
          fb: o3.map(o => +o > okB ? `Fewer. The rule was in the prompt, word for word, and the model still got the count wrong in ${nT - okB} of ${nT} lines. Writing a rule down does not make the model do the sum.` : `More than that.`),
          after: () => `Right, and it is the surprise: only ${okB} of ${nT}. Dana's quote above says ${DANA.v2} boxes. The next screen works out what it should say.` }
      ]
    });
  }

  /* 4. When none of the three: the box count belongs in code. */
  const PY = [
    "from decimal import Decimal",
    "from decimal import ROUND_CEILING",
    "CUT = Decimal(\"1.10\")",
    "",
    "def boxes_needed(area_m2, m2_per_box):",
    "    area = Decimal(area_m2) * CUT",
    "    boxes = area / Decimal(m2_per_box)",
    "    return int(boxes.to_integral_value(",
    "        rounding=ROUND_CEILING))"
  ];
  // quotes.out.txt, the box-count block, copied unaltered (the table on screen 4 is recomputed from BOX and must match it)
  const PY_OUT = `r01 BS3060   area   6.2 per box 1.44: rule  5  float  5  v2 6  v3 7
r02 CG6060   area    14 per box 1.44: rule 11  float 11  v2 10  v3 10
r03 LVT-OAK  area    22 per box  2.2: rule 11  float 11  v2 11  v3 11
r04 WM1020   area   3.5 per box  1.0: rule  4  float  4  v2 4  v3 4
r05 TS6060   area  16.5 per box 1.08: rule 17  float 17  v2 18  v3 17
r06 HB-OAK   area    11 per box  1.2: rule 11  float 11  v2 10  v3 10
r07 CG6060   area    20 per box 1.44: rule 16  float 16  v2 15  v3 22
r07 WM1020   area     4 per box  1.0: rule  5  float  5  v2 5  v3 5
r08 TS6060   area     8 per box 1.08: rule  9  float  9  v2 8  v3 8
SUMMARY boxes right: v2 3 of 9, v3 4 of 9`;
  function boxesInCode({ el, done, kit }) {
    ensureStyle();
    const cutArea = DANA.a * CUT_PCT; // m2 x 10000
    const raw = (cutArea / (DANA.p * 100)).toFixed(2);
    const oB = numOpts(DANA.rule, [DANA.rule - 1, DANA.v2, DANA.v3]).map(String);
    sequence(el, done, kit, {
      head: () => `<h1>The rule was in the prompt</h1>
        <p class="lead">Dana's email: “${kit.esc(DANA_EMAIL)}” Basalt comes ${fmt2(DANA.p)} m² to a box. The house rule: area × 1.10 for cutting, divided by m² per box, rounded up to whole boxes. The model wrote <b>${DANA.v2} boxes</b>.</p>`,
      qs: [
        { q: `Work it out: ${fmt2(DANA.a)} × 1.10 = ${(cutArea / 10000).toFixed(2)}, divided by ${fmt2(DANA.p)} = ${raw}. How many boxes?`,
          opts: oB, num: true, right: oB.indexOf(String(DANA.rule)),
          fb: oB.map(o => +o < DANA.rule ? `${raw} boxes do not cover the floor. The rule rounds up: a part box means one more whole box.` : `Rounding ${raw} up gives ${DANA.rule}. Every box above that is one Dana pays for and does not need${+o === DANA.v2 ? `; ${o} is what the model wrote` : ""}.`),
          after: () => `Right: ${DANA.rule} boxes. The model wrote ${DANA.v2} with the rule in its prompt, and ${DANA.v3} in the next version you will see.` },
        { q: "The format is fixed and the catalogue is current. Which change makes every box count right?",
          opts: ["Write the rule more clearly in the prompt", "Retrieve more catalogue rows", "Fine-tune on thousands of past quotes", "Compute the boxes in code; the model only writes the words around them"], right: 3,
          fb: ["The rule was already there, word for word, with an example. The model still wrote the digits as text it predicts, not as a sum it works out.", "The row it needed was in the prompt: 1.44 m² per box. Nothing was missing to look up.", "Past quotes would teach the model what quotes look like. Nothing in training makes a division exact; it would still predict the digits.", null],
          after: () => `Right. A count that must be exact is a job for code, not for any of the three model fixes. Our script runs the house rule in Python on the ${BOX.length} tile lines and compares:
            ${kit.code(PY, 5)}
            <table class="${P}tbl ${P}box"><caption>boxes per tile line: the code's count against what the model wrote</caption><thead><tr><th>who</th><th>tile</th><th>rule, in code</th><th>model, format fix</th><th>model, + voice lines</th></tr></thead><tbody>${BOX.map(b => `<tr><td>${kit.esc(CUSTOMERS[b.r])}</td><td>${kit.esc(b.code)}</td><td><b>${b.rule}</b></td><td class="${b.v2 === b.rule ? "ok" : "bad"}">${b.v2}</td><td class="${b.v3 === b.rule ? "ok" : "bad"}">${b.v3}</td></tr>`).join("")}</tbody></table>
            <p class="${P}cap">Decimal is Python's exact decimal number type, so 1.10 stays exactly 1.10. The same counts as the output of quotes.py, run on ${REC_DATE}. “Format fix” is the prompt version above; “+ voice lines” is the next one, which adds a cover line.</p>
            The model was right in ${BOX_OK("v2")} of ${BOX.length} lines, then ${BOX_OK("v3")} of ${BOX.length}. The code is right every time, for free. In the real assistant, code computes the lines and the totals, and the model writes only the text around them.` }
      ]
    });
  }

  /* 5. The voice, shown by three examples: predict, then see the recorded cover lines. */
  function voice({ el, done, kit }) {
    ensureStyle();
    const nCopy = COPIES.filter(Boolean).length, nWrongCount = COVER_WRONG.filter((w, i) => w && COPIES[i]).length;
    oneQ(el, done, kit, {
      head: () => `<h1>The voice, shown by examples</h1>
        <p class="lead">Next the desk wanted one cover line under each quote, in its own voice. The team added the rule (one sentence, at most 15 words, first name first, no thanks) and three lines the desk wrote last week:</p>
        ${rec(kit, "Tom, 7 boxes covers the floor with the cut allowance.\nBrick & Co, grout colour is your call; white is in stock.\nAna, the Basalt replaces Slate Grey, same size, same box.")}
        <p class="${P}cap">Example lines from the prompt, written by the desk (not model output).</p>
        <p class="task">Before you see them: what will most of the ${word(COVER.length)} cover lines look like?</p>`,
      opts: ["Different lines, each saying what that customer most needs to know", "Copies of the shape of one example line", "Long greetings again, like the old quotes"],
      right: 1,
      fb: [
        ["That is what the desk hoped for. The model leaned on the examples harder than that. Pick again to see the lines.", false],
        [`Right. ${Cap(word(nCopy))} of ${COVER.length} recorded lines copy the shape of the first example:${rec(kit, COVER.join("\n"))}${cap()}
          Worse, ${word(nWrongCount)} of them state a box count that the code from the last screen says is wrong. The voice is better than the old greetings, and this is still a <b>prompt</b> problem: vary the examples so no single shape dominates (as in the few-shot lesson), and take every number from code. Note the price of each fix: the mean input per call went from ${TOK.v1} tokens (old assistant) to ${TOK.v2} (format and rules) to ${TOK.v3} (plus voice), sent with every quote.`, true],
        ["The rule says no thanks and the examples are short; the old greetings did not come back. Something else went wrong. Pick again.", false]
      ]
    });
  }

  /* 6. Where fine-tuning earns its place: the pick labels. */
  function labels({ el, done, kit }) {
    ensureStyle();
    const rows = (recs) => DESK_LABELS.map((w, r) => {
      const got = labLines(recs[r]);
      return `<tr><td>${kit.esc(CUSTOMERS[r])}</td><td class="m">${kit.esc(w.join("\n"))}</td><td class="m">${kit.esc(w.map((x, k) => got[k] || "(none)").join("\n"))}</td><td class="${got.join() === w.join() ? "ok" : "bad"}">${w.filter((x, k) => got[k] === x).length}/${w.length}</td></tr>`;
    }).join("");
    const table = (recs, title) => `<table class="${P}tbl ${P}lbl"><caption>${kit.esc(title)}</caption><thead><tr><th>who</th><th>desk</th><th>model</th><th>right</th></tr></thead><tbody>${rows(recs)}</tbody></table>`;
    const opts = numOpts(RUL.ok, [LAB.ok, RUL.n]).map(String);
    const right = opts.indexOf(String(RUL.ok));
    const misses = DESK_LABELS.map((w, r) => labLines(REC_RUL[r]).some((g, k) => g !== w[k]) ? CUSTOMERS[r] : null).filter(Boolean);
    oneQ(el, done, kit, {
      head: () => `<h1>Show, or tell?</h1>
        <p class="lead">The warehouse needs one pick label per quote line, the way the desk writes them. The team showed the model only three past quotes with their labels. It got <b>${LAB.ok} of ${LAB.n}</b> labels right:</p>
        ${table(REC_LAB, `three examples in the prompt: ${LAB.ok} of ${LAB.n} right (recorded model output, ${REC_DATE})`)}
        <p class="lead">It misread the letters. The team then wrote down the three habits they could name: R or T for a private or a trade customer, B or S for boxes or sacks, W, D or ? for a wet room, a dry room or no room given.</p>
        <p class="task">With those three habits written into the prompt, how many of the ${RUL.n} labels will be right?</p>`,
      opts, right,
      fb: opts.map(o => +o === RUL.ok
        ? [`Right: ${RUL.ok} of ${RUL.n}.${table(REC_RUL, `three habits written down: ${RUL.ok} of ${RUL.n} right (recorded model output, ${REC_DATE})`)}
          Writing habits down works, so do that first for every habit you can name. It still missed ${misses.join(" and ")}, and both times it broke a habit that was written in its prompt. Sami's two lines got different room letters, though the prompt says every line of one quote gets the same one. Greta's email names no room, the prompt says “?”, and the model wrote D. That is still prompt work: make those rules stand out, add an example of each, and check the room letters in code.<br><br>Fine-tuning is a separate question. Each habit adds tokens to every call (from ${TOK.lab} to ${TOK.rul} on average for these three), and the desk has dozens more that nobody has written down. What it does have is years of labelled quotes. <b>That</b> is the fine-tuning case: a format shown by many good examples rather than stated. A tuned model then needs a shorter prompt, and often a smaller, faster model can do the job.`, true]
        : +o > RUL.ok ? ["Writing them down helps a lot, but not on every line. On two quotes the model broke a habit that was written in its prompt.", false]
        : ["More than before. The model misread the letters because nobody had said what they mean; once they are written down, most labels come right.", false])
    });
  }

  /* 7. The big picture: what each fix is for, when not, what it costs; with a cost question. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    oneQ(el, done, kit, {
      head: () => `<h1>Choosing the fix</h1>
        <ul class="${P}steps">
          <li><b>Prompt:</b> for behaviour you can say, or show in a few examples. Cheapest: you change it in minutes. Each rule adds tokens to every call.</li>
          <li><b>Retrieval:</b> for facts that change, or are too many for a prompt. Costs a search index you keep up to date, and longer prompts.</li>
          <li><b>Fine-tuning:</b> for behaviour you cannot write down but have many good examples of, or to shorten a long prompt and run a smaller model. Costs a clean dataset, training runs, a full re-test of every new version, and retraining when the behaviour changes. It does not keep facts current.</li>
          <li><b>Code:</b> for anything that must be exact.</li>
        </ul>
        <p class="lead">Try them in that order. They combine: one product often uses all four.</p>
        <p class="task">A manager says: “Skip the catalogue look-up. Fine-tune the model on this season's quotes, so it knows the products and prices.” Which cost bites first?</p>`,
      opts: ["A training run and a full re-test every time the catalogue changes, with wrong prices in between", "Longer prompts on every call", "Nothing: the tuned model will read new prices by itself"],
      right: 0,
      fb: [
        ["Right. Fernbrook's catalogue changes every season and prices can change any week. Each change means new training data, a training run and the golden set run again, and until then the model quotes the old prices from its weights. Retrieval reads the current rows on every call, so a price change is a change to one table.", true],
        ["The opposite: a tuned model usually needs a shorter prompt. The cost is elsewhere: it is frozen at the data it was trained on.", false],
        ["A tuned model reads only what is in its prompt. Without the look-up, new prices never reach it until you train it again.", false]
      ]
    });
  }

  /* 8. Recognise it in new situations, including one where none of the three model fixes applies. */
  const OPTS4 = ["Prompt", "Retrieval", "Fine-tune", "None: do it in code"];
  const CASES = [
    { q: "A hospital's staff assistant answers “who is the on-call doctor tonight?”. The rota changes every day, and the assistant names last week's doctors.", right: 1,
      fb: [["No instruction can tell the model tonight's rota. It is a fact that changes daily.", false], ["Right. Fetch today's rota rows at question time and put them in the prompt.", true], ["Training cannot keep up with a rota that changes daily, and it would bake in old names.", false], ["Code can look up the rota, and that look-up is retrieval. The answer is still written in words from the rota rows.", false]] },
    { q: "A support tool's ticket summaries run to three paragraphs. Agents want three bullet points. The prompt says only “Summarise this ticket.”", right: 0,
      fb: [["Right. Nobody said what length or shape. Say it, with one example summary.", true], ["Nothing is missing to look up. The shape of the answer was never described.", false], ["You have not tried saying it yet. One sentence and one example come first.", false], ["Summarising free text is a language job. Code cannot write the bullets.", false]] },
    { q: "A bank sorts card payments into 300 internal categories. The borders between categories exist only in a million payments its staff labelled by hand over years. A prompt listing all 300 with examples is huge and still mixes up neighbours. It must run fast on every payment.", right: 2,
      fb: [["The prompt route has been tried: listing 300 categories is huge and still wrong at the borders, which nobody can state in words.", false], ["The categories are fixed, not changing facts. What is missing is the skill of telling neighbours apart, which only the labelled examples show.", false], ["Right. Behaviour shown by a large labelled archive, hard to state, needed fast at volume: fine-tune, often a small model, and test it on held-out payments.", true], ["There is no exact rule to code; the borders exist only in the labelled examples.", false]] },
    { q: "An invoicing assistant sometimes adds VAT wrongly: the rates are in its prompt and it still makes slips in the sums.", right: 3,
      fb: [["The rates are already in the prompt. Saying it again does not make the model add up.", false], ["Nothing is missing: the rates are right there. Retrieval would only add more text.", false], ["Training shapes what the model writes, not exact arithmetic. It would still predict the digits and could still slip.", false], ["Right. None of the three model fixes makes a sum exact. Code computes VAT and totals; the model, if needed, writes the words around them.", true]] }
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    multiPick(el, done, kit, { opts: OPTS4, items: CASES, head: () => `<h1>Which fix here?</h1>
      <p class="lead">Four failures from other places. One more choice now: none of the model fixes, because the job belongs in code.</p>
      <p class="task">Pick the fix for each. Ask first: is a fact missing, or behaviour? Can it be said? Must it be exact?</p>` });
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can choose the fix</h1>
      <p class="lead">You sorted ${word(CARDS.length)} real failures and checked the fixes against recorded answers. First ask what is missing. A fact that changes goes to retrieval. Behaviour you can say or show goes to the prompt. Behaviour you can only show, with many examples, goes to fine-tuning. Anything that must be exact goes to code. Try the cheapest first, and measure each change on a golden set. Fine-tuning is the costly one: a clean dataset, training runs and a re-test of every version. And it never keeps facts current.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. When fine-tuning is the answer, you rarely retrain every weight. You will count how few trainable numbers the add-on needs.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Fine-tuning, RAG or a better prompt: choosing",
    checked: "2026-11-13",
    sources: [
      "https://developers.openai.com/api/docs/guides/model-optimization",
      "https://developers.openai.com/api/docs/guides/fine-tuning-best-practices",
      "https://developers.openai.com/api/docs/guides/supervised-fine-tuning",
      "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
      "https://arxiv.org/abs/2005.11401",
      "https://arxiv.org/abs/2312.05934",
      "https://huggingface.co/docs/peft/index",
      "https://docs.python.org/3/library/decimal.html"
    ],
    interview: [
      {
        q: "Your company's support bot quotes last year's plan prices, and its replies sound stiff. A colleague proposes fine-tuning it on last year's support tickets. What do you say?",
        good: [
          "Split the failures: the prices are a missing fact, the stiffness is behaviour",
          "Prices change, so fetch the current price list at question time (retrieval); fine-tuning on last year's tickets would bake last year's prices in",
          "For the voice, describe it in the prompt and show varied example replies first; it is cheap and changes in minutes",
          "Fine-tune only if the voice still does not hold and there are many approved replies to learn from",
          "Measure each change on a golden set; any amounts the bot states come from code, not the model"
        ],
        weak: "Agree, because fine-tuning makes the model “know our company”, without separating facts that change from the way it writes."
      },
      {
        q: "Your few-shot prompt for routing tickets into 60 internal queues is now very long, slow and still mixes up the rare queues. You have years of tickets routed by hand. What are your options?",
        good: [
          "First check the rare queues can be described at all; if a rule can be written, write it",
          "Retrieving a few similar past tickets as examples per request can help before training anything",
          "Fine-tuning fits: the borders are shown by many labelled examples, and a tuned, smaller model needs a short prompt and answers faster",
          "Hold out a test set from the hand-routed tickets and compare the tuned model with the prompt version",
          "Costs: cleaning the data, training runs, re-testing every version, retraining when queues change"
        ],
        weak: "Add even more examples to the prompt, or switch to the biggest model, without measuring or considering the labelled archive."
      }
    ],
    screens: [sortCards, spotIdea, cheapFixes, boxesInCode, voice, labels, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]", ...CARDS.slice(1).map((_, i) => `#c${i + 1} [data-right]`), "#check"], right: [...CARDS.map((_, i) => `#c${i} [data-right]`), "#check"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c3 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
