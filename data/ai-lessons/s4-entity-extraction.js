/* Lesson: entity extraction with BIO tags. Story: a small import business pulls supplier names, dates and sums out
   of the free-text notes on its bank transfers. Ideas: (1) BIO tags turn "find the names, dates and amounts" into one
   label per word, and B marks where a new one starts, so two touching names stay apart; (2) the model labels
   subword tokens, not words, so the word tags must be aligned with word_ids() (first piece gets the tag, later pieces
   and special tokens get -100), and the pipeline must join pieces back into words (aggregation_strategy="first").
   Data, all real, from runs on this Mac (no model API calls were recorded for this lesson):
   - docs/ai-path/runs/s4-entity-extraction/notes.py: the six notes and their tags (hand-written), and the 600
     generated training notes;
   - tokens.py + tokens.out.txt: the tokenizer's pieces and word ids for the six notes, both alignments, and the
     line-by-line trace of align_labels (align.py) on note 2;
   - train.py + train_good.out.txt / train_buggy.out.txt: a 4-layer BERT (google/bert_uncased_L-4_H-256_A-4)
     fine-tuned on CPU with the word_ids alignment and with the by-position bug, then the token-classification
     pipeline on notes 4 to 6 with aggregation_strategy none, simple and first.
   Lesson-local style: word buttons, tag brushes and a token strip (.lx-s4-entity-extraction-*), see ensureStyle(). */
(() => {
  const ID = "s4-entity-extraction";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s4-entity-extraction/tokens.out.txt: per note [words, tags, tokens, word_ids, aligned, by_position]
  const TOK = [[["Paid","Han","Textiles","1,250,000","won","on","3","March","for","linen"],["O","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE","O","O"],["[CLS]","paid","han","textiles","1",",","250",",","000","won","on","3","march","for","linen","[SEP]"],[null,0,1,2,3,3,3,3,3,4,5,6,7,8,9,null],["-100","O","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","-100","-100","-100","-100","I-AMOUNT","O","B-DATE","I-DATE","O","O","-100"],["O","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE","O","O","-100","-100","-100","-100","-100","-100"]],[["Deposit","to","Busan","Wire","Co","400","USD","on","12","March"],["O","O","B-SUPPLIER","I-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE"],["[CLS]","deposit","to","bus","##an","wire","co","400","usd","on","12","march","[SEP]"],[null,0,1,2,2,3,4,5,6,7,8,9,null],["-100","O","O","B-SUPPLIER","-100","I-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE","-100"],["O","O","B-SUPPLIER","I-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE","-100","-100","-100"]],[["Refund","from","Kim","Trading","85,000","won","2","April"],["O","O","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","B-DATE","I-DATE"],["[CLS]","ref","##und","from","kim","trading","85",",","000","won","2","april","[SEP]"],[null,0,0,1,2,3,4,4,4,5,6,7,null],["-100","O","-100","O","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","-100","-100","I-AMOUNT","B-DATE","I-DATE","-100"],["O","O","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","B-DATE","I-DATE","-100","-100","-100","-100","-100"]],[["Split","payment","Han","Textiles","Busan","Wire","600","USD","each","on","9","April"],["O","O","B-SUPPLIER","I-SUPPLIER","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","O","B-DATE","I-DATE"],["[CLS]","split","payment","han","textiles","bus","##an","wire","600","usd","each","on","9","april","[SEP]"],[null,0,1,2,3,4,4,5,6,7,8,9,10,11,null],["-100","O","O","B-SUPPLIER","I-SUPPLIER","B-SUPPLIER","-100","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","O","B-DATE","I-DATE","-100"],["O","O","B-SUPPLIER","I-SUPPLIER","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","O","B-DATE","I-DATE","-100","-100","-100"]],[["Second","half","to","Mekong","Ceramics","2,300","USD","sent","14","March"],["O","O","O","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE"],["[CLS]","second","half","to","me","##kong","ceramics","2",",","300","usd","sent","14","march","[SEP]"],[null,0,1,2,3,3,4,5,5,5,6,7,8,9,null],["-100","O","O","O","B-SUPPLIER","-100","I-SUPPLIER","B-AMOUNT","-100","-100","I-AMOUNT","O","B-DATE","I-DATE","-100"],["O","O","O","B-SUPPLIER","I-SUPPLIER","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE","-100","-100","-100","-100","-100"]],[["Samarkand","Silk","late","fee","15","USD","due","30","April"],["B-SUPPLIER","I-SUPPLIER","O","O","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE"],["[CLS]","sam","##ark","##and","silk","late","fee","15","usd","due","30","april","[SEP]"],[null,0,0,0,1,2,3,4,5,6,7,8,null],["-100","B-SUPPLIER","-100","-100","I-SUPPLIER","O","O","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE","-100"],["B-SUPPLIER","I-SUPPLIER","O","O","B-AMOUNT","I-AMOUNT","O","B-DATE","I-DATE","-100","-100","-100","-100"]]];
  // Trace rows of align_labels on note 2 (tokens.out.txt): [line, event (l/r), word_id, previous, labels]
  const TRACE = [[1,"l","-","-",null],[2,"l","-","-",null],[3,"l","-","-",[]],[4,"l","-",null,[]],[5,"l",null,null,[]],[6,"l",null,null,[]],[9,"l",null,null,[-100]],[4,"l",null,null,[-100]],[5,"l",0,null,[-100]],[8,"l",0,null,[-100]],[9,"l",0,null,[-100,0]],[4,"l",0,0,[-100,0]],[5,"l",1,0,[-100,0]],[8,"l",1,0,[-100,0]],[9,"l",1,0,[-100,0,0]],[4,"l",1,1,[-100,0,0]],[5,"l",2,1,[-100,0,0]],[8,"l",2,1,[-100,0,0]],[9,"l",2,1,[-100,0,0,1]],[4,"l",2,2,[-100,0,0,1]],[5,"l",2,2,[-100,0,0,1]],[6,"l",2,2,[-100,0,0,1]],[9,"l",2,2,[-100,0,0,1,-100]],[4,"l",2,2,[-100,0,0,1,-100]],[5,"l",3,2,[-100,0,0,1,-100]],[8,"l",3,2,[-100,0,0,1,-100]],[9,"l",3,2,[-100,0,0,1,-100,2]],[4,"l",3,3,[-100,0,0,1,-100,2]],[5,"l",4,3,[-100,0,0,1,-100,2]],[8,"l",4,3,[-100,0,0,1,-100,2]],[9,"l",4,3,[-100,0,0,1,-100,2,2]],[4,"l",4,4,[-100,0,0,1,-100,2,2]],[5,"l",5,4,[-100,0,0,1,-100,2,2]],[8,"l",5,4,[-100,0,0,1,-100,2,2]],[9,"l",5,4,[-100,0,0,1,-100,2,2,5]],[4,"l",5,5,[-100,0,0,1,-100,2,2,5]],[5,"l",6,5,[-100,0,0,1,-100,2,2,5]],[8,"l",6,5,[-100,0,0,1,-100,2,2,5]],[9,"l",6,5,[-100,0,0,1,-100,2,2,5,6]],[4,"l",6,6,[-100,0,0,1,-100,2,2,5,6]],[5,"l",7,6,[-100,0,0,1,-100,2,2,5,6]],[8,"l",7,6,[-100,0,0,1,-100,2,2,5,6]],[9,"l",7,6,[-100,0,0,1,-100,2,2,5,6,0]],[4,"l",7,7,[-100,0,0,1,-100,2,2,5,6,0]],[5,"l",8,7,[-100,0,0,1,-100,2,2,5,6,0]],[8,"l",8,7,[-100,0,0,1,-100,2,2,5,6,0]],[9,"l",8,7,[-100,0,0,1,-100,2,2,5,6,0,3]],[4,"l",8,8,[-100,0,0,1,-100,2,2,5,6,0,3]],[5,"l",9,8,[-100,0,0,1,-100,2,2,5,6,0,3]],[8,"l",9,8,[-100,0,0,1,-100,2,2,5,6,0,3]],[9,"l",9,8,[-100,0,0,1,-100,2,2,5,6,0,3,4]],[4,"l",9,9,[-100,0,0,1,-100,2,2,5,6,0,3,4]],[5,"l",null,9,[-100,0,0,1,-100,2,2,5,6,0,3,4]],[6,"l",null,9,[-100,0,0,1,-100,2,2,5,6,0,3,4]],[9,"l",null,9,[-100,0,0,1,-100,2,2,5,6,0,3,4,-100]],[4,"l",null,null,[-100,0,0,1,-100,2,2,5,6,0,3,4,-100]],[10,"l",null,null,[-100,0,0,1,-100,2,2,5,6,0,3,4,-100]],[10,"r",null,null,[-100,0,0,1,-100,2,2,5,6,0,3,4,-100]]];
  // From docs/ai-path/runs/s4-entity-extraction/train_good.out.txt: loss per epoch; pipeline output per strategy for notes 4-6 as [text, [[entity, word, score]]]
  const RUN_GOOD = {"loss":[0.3492,0.0222,0.0142,0.0179],"none":[["Split payment Han Textiles Busan Wire 600 USD each on 9 April",[["B-SUPPLIER","han",0.993],["I-SUPPLIER","textiles",0.991],["B-SUPPLIER","bus",0.797],["I-SUPPLIER","##an",0.802],["I-SUPPLIER","wire",0.945],["B-AMOUNT","600",0.993],["I-AMOUNT","usd",0.991],["B-DATE","9",0.994],["I-DATE","april",0.993]]],["Second half to Mekong Ceramics 2,300 USD sent 14 March",[["B-SUPPLIER","me",0.993],["B-SUPPLIER","##kong",0.656],["I-SUPPLIER","ceramics",0.991],["B-AMOUNT","2",0.994],["B-AMOUNT",",",0.989],["B-AMOUNT","300",0.993],["I-AMOUNT","usd",0.993],["B-DATE","14",0.994],["I-DATE","march",0.993]]],["Samarkand Silk late fee 15 USD due 30 April",[["B-SUPPLIER","sam",0.986],["B-SUPPLIER","##ark",0.961],["I-SUPPLIER","##and",0.985],["I-SUPPLIER","silk",0.993],["B-AMOUNT","15",0.76],["I-AMOUNT","usd",0.983],["B-DATE","30",0.994],["I-DATE","april",0.994]]]],"simple":[["Split payment Han Textiles Busan Wire 600 USD each on 9 April",[["SUPPLIER","han textiles",0.992],["SUPPLIER","busan wire",0.848],["AMOUNT","600 usd",0.992],["DATE","9 april",0.994]]],["Second half to Mekong Ceramics 2,300 USD sent 14 March",[["SUPPLIER","me",0.993],["SUPPLIER","##kong ceramics",0.823],["AMOUNT","2",0.994],["AMOUNT",",",0.989],["AMOUNT","300 usd",0.993],["DATE","14 march",0.993]]],["Samarkand Silk late fee 15 USD due 30 April",[["SUPPLIER","sam",0.986],["SUPPLIER","##arkand silk",0.98],["AMOUNT","15 usd",0.872],["DATE","30 april",0.994]]]],"first":[["Split payment Han Textiles Busan Wire 600 USD each on 9 April",[["SUPPLIER","han textiles",0.992],["SUPPLIER","busan wire",0.871],["AMOUNT","600 usd",0.992],["DATE","9 april",0.994]]],["Second half to Mekong Ceramics 2,300 USD sent 14 March",[["SUPPLIER","mekong ceramics",0.992],["AMOUNT","2",0.994],["AMOUNT",",",0.989],["AMOUNT","300 usd",0.993],["DATE","14 march",0.993]]],["Samarkand Silk late fee 15 USD due 30 April",[["SUPPLIER","samarkand silk",0.99],["AMOUNT","15 usd",0.872],["DATE","30 april",0.994]]]],"seconds":23.1};
  // From docs/ai-path/runs/s4-entity-extraction/train_buggy.out.txt: loss per epoch; pipeline output per strategy for notes 4-6 as [text, [[entity, word, score]]]
  const RUN_BUGGY = {"loss":[1.0101,0.3905,0.2538,0.139],"none":[["Split payment Han Textiles Busan Wire 600 USD each on 9 April",[["B-SUPPLIER","payment",0.996],["I-SUPPLIER","han",0.996],["B-SUPPLIER","textiles",0.99],["I-SUPPLIER","bus",0.971],["B-AMOUNT","##an",0.699],["I-AMOUNT","wire",0.611],["I-DATE","each",0.646],["I-DATE","on",0.619],["I-DATE","9",0.87]]],["Second half to Mekong Ceramics 2,300 USD sent 14 March",[["B-SUPPLIER","to",0.996],["I-SUPPLIER","me",0.993],["B-AMOUNT","##kong",0.954],["I-AMOUNT","ceramics",0.934],["B-DATE",",",0.699],["I-DATE","300",0.92],["I-DATE","usd",0.979],["I-DATE","sent",0.977],["I-DATE","14",0.984],["I-DATE","march",0.972]]],["Samarkand Silk late fee 15 USD due 30 April",[["I-SUPPLIER","sam",0.996],["I-SUPPLIER","##ark",0.993],["I-AMOUNT","late",0.589],["B-DATE","15",0.793],["I-DATE","usd",0.513],["I-DATE","due",0.987],["I-DATE","30",0.987],["I-DATE","april",0.984]]]],"simple":[["Split payment Han Textiles Busan Wire 600 USD each on 9 April",[["SUPPLIER","payment han",0.996],["SUPPLIER","textiles bus",0.981],["AMOUNT","##an wire",0.655],["DATE","each on 9",0.711]]],["Second half to Mekong Ceramics 2,300 USD sent 14 March",[["SUPPLIER","to me",0.994],["AMOUNT","##kong ceramics",0.944],["DATE",", 300 usd sent 14 march",0.922]]],["Samarkand Silk late fee 15 USD due 30 April",[["SUPPLIER","samark",0.994],["AMOUNT","late",0.589],["DATE","15 usd due 30 april",0.853]]]],"first":[["Split payment Han Textiles Busan Wire 600 USD each on 9 April",[["SUPPLIER","payment han",0.996],["SUPPLIER","textiles busan",0.981],["AMOUNT","wire",0.611],["DATE","each on 9",0.711]]],["Second half to Mekong Ceramics 2,300 USD sent 14 March",[["SUPPLIER","to mekong",0.994],["AMOUNT","ceramics",0.934],["DATE",", 300 usd sent 14 march",0.922]]],["Samarkand Silk late fee 15 USD due 30 April",[["SUPPLIER","samarkand",0.996],["AMOUNT","late",0.589],["DATE","15 usd due 30 april",0.853]]]],"seconds":29.0};
  // The listing is align_labels from docs/ai-path/runs/s4-entity-extraction/align.py, line for line (line 0 = def).
  const CODE = [
    "def align_labels(note_words, word_tags):",
    "    encoding = tokenizer(note_words, is_split_into_words=True)",
    "    labels = []",
    "    previous = None",
    "    for word_id in encoding.word_ids():",
    "        if word_id is None or word_id == previous:",
    "            labels.append(-100)",
    "        else:",
    "            labels.append(TAG_IDS[word_tags[word_id]])",
    "        previous = word_id",
    "    return labels"
  ];
  // align.py align_labels_by_position, line for line
  const BUGGY = [
    "def align_labels_by_position(note_words, word_tags):",
    "    encoding = tokenizer(note_words, is_split_into_words=True)",
    "    labels = [TAG_IDS[tag] for tag in word_tags]",
    "    labels += [-100] * (len(encoding[\"input_ids\"]) - len(labels))",
    "    return labels"
  ];
  const TAGS = ["O", "B-SUPPLIER", "I-SUPPLIER", "B-DATE", "I-DATE", "B-AMOUNT", "I-AMOUNT"]; // notes.py TAGS
  const TRAIN_NOTES = 600, EPOCHS = 4; // train.py: make_training_notes(600), EPOCHS = 4
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s4-entity-extraction.ipynb";

  /* ---------- Derived from the data ---------- */
  const W = TOK.map(t => t[0]), G = TOK.map(t => t[1]);
  const kindOf = t => t === "O" ? "" : t.slice(2);
  const KIND = { SUPPLIER: "supplier", DATE: "date", AMOUNT: "amount" };
  // the span (words) that word k of note n belongs to, from the gold tags
  function spanOf(n, k) {
    const g = G[n];
    let a = k; while (a > 0 && g[a].startsWith("I-")) a--;
    let b = k + 1; while (b < g.length && g[b].startsWith("I-")) b++;
    return W[n].slice(a, b).join(" ");
  }
  const tagName = id => id === -100 ? "-100" : TAGS[id];
  const ent = (run, strategy, note) => run[strategy][note - 3]; // runs cover notes 4..6 (index 3..5)

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-note { margin: 16px 0 0; padding: 12px 0 4px; border-top: 1px solid var(--line); }
      .lx-${ID}-note h3 { margin: 0 0 8px; font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-words { display: flex; flex-wrap: wrap; gap: 6px; }
      .lx-${ID}-w { min-height: 52px; min-width: 44px; padding: 4px 8px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; font: 500 16px/1.2 var(--font); cursor: pointer; }
      .lx-${ID}-w small { font: 600 11.5px/1.2 var(--font); color: var(--muted); }
      .lx-${ID}-w.lx-${ID}-ent { border-color: var(--ink); }
      .lx-${ID}-w.lx-${ID}-ent small { color: var(--ink); }
      .lx-${ID}-w.lx-${ID}-bad { border: 2px solid var(--bad); background: var(--bad-soft); }
      div.lx-${ID}-w { cursor: default; }
      .lx-${ID}-brushes { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; }
      .lx-${ID}-brush { min-height: 44px; padding: 6px 10px; background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; font: 600 13.5px/1.2 var(--font); cursor: pointer; }
      .lx-${ID}-brush[aria-pressed="true"] { border: 3px solid var(--ink); padding: 4px 8px; }
      .lx-${ID}-strip { display: flex; flex-wrap: wrap; gap: 4px; margin: 14px 0 0; }
      .lx-${ID}-t { min-width: 52px; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: var(--surface); }
      .lx-${ID}-t > span { padding: 3px 6px; text-align: center; font: 500 13px/1.35 var(--mono); }
      .lx-${ID}-t .lx-${ID}-tk { font-weight: 600; font-size: 14px; color: var(--ink); }
      .lx-${ID}-t .lx-${ID}-wd { color: var(--muted); font-size: 11.5px; border-top: 1px solid var(--line); }
      .lx-${ID}-t .lx-${ID}-lb { border-top: 1px solid var(--line); background: var(--sunk); min-height: 1.6em; font: 600 12px/1.6 var(--font); }
      .lx-${ID}-t.lx-${ID}-cur { border: 3px solid var(--ink); }
      .lx-${ID}-t.lx-${ID}-bad { border: 2px solid var(--bad); }
      .lx-${ID}-t.lx-${ID}-bad .lx-${ID}-lb { background: var(--bad-soft); }
      button.lx-${ID}-t { padding: 0; cursor: pointer; color: inherit; font: inherit; min-height: 44px; }
      .lx-${ID}-ents { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-ents li { display: grid; grid-template-columns: 7.5em 1fr 3.5em; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--line); font: 500 14px/1.4 var(--mono); }
      .lx-${ID}-ents li b { font-weight: 600; }
      .lx-${ID}-ents li i { font-style: normal; color: var(--muted); text-align: right; }
      .lx-${ID}-wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 8ch); text-indent: -8ch; }
      .lx-${ID}-pred { margin: 14px 0 0; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-check { margin: 14px 0 0; min-height: 44px; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
      .lx-${ID}-checks { margin: 12px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-chk { display: flex; align-items: flex-start; gap: 12px; min-height: 44px; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-chk input { appearance: none; -webkit-appearance: none; box-sizing: border-box; width: 44px; height: 44px; margin: -10px -11px -12px; padding: 0; flex: none; border: 11px solid transparent; border-radius: 0; background: var(--surface); background-clip: padding-box; box-shadow: inset 0 0 0 2px var(--ink); cursor: pointer; }
      .lx-${ID}-chk input:checked { background: var(--ink); background-clip: padding-box; box-shadow: inset 0 0 0 2px var(--ink), inset 0 0 0 5px var(--surface); }
    `;
    document.head.appendChild(s);
  }
  // a note as word boxes with their tags; pick = words are buttons; bad = Set of word indexes marked as mistakes
  function wordRow(kit, n, tags, { pick = false, bad = new Set(), title = "" } = {}) {
    const tag = pick ? "button" : "div";
    return `<div class="lx-${ID}-note">${title ? `<h3>${kit.esc(title)}</h3>` : ""}<div class="lx-${ID}-words">${W[n].map((w, k) =>
      `<${tag}${pick ? ` type="button" data-w="${n}-${k}"` : ""} class="lx-${ID}-w${tags[k] !== "O" ? ` lx-${ID}-ent` : ""}${bad.has(k) ? ` lx-${ID}-bad` : ""}">${kit.esc(w)}<small>${kit.esc(tags[k])}</small></${tag}>`).join("")}</div></div>`;
  }
  // tokens with the word they came from and a label; o.cur ringed index, o.bad Set, o.pick makes buttons
  function strip(kit, n, labels, o = {}) {
    const [words, , toks, wids] = TOK[n];
    return `<div class="lx-${ID}-strip">${toks.map((t, i) => {
      const tag = o.pick ? "button" : "div";
      const cls = `lx-${ID}-t${o.cur === i ? ` lx-${ID}-cur` : ""}${o.bad && o.bad.has(i) ? ` lx-${ID}-bad` : ""}`;
      return `<${tag}${o.pick ? ` type="button" data-i="${i}"` : ""} class="${cls}"><span class="lx-${ID}-tk">${kit.esc(t)}</span><span class="lx-${ID}-wd">${wids[i] == null ? "none" : kit.esc(words[wids[i]])}</span><span class="lx-${ID}-lb">${labels[i] == null ? "" : kit.esc(labels[i])}</span></${tag}>`;
    }).join("")}</div>`;
  }
  const entList = (kit, list, key) => `<ul class="lx-${ID}-ents">${list.map(([e, w, s]) => `<li><b>${kit.esc(e)}</b><span>${kit.esc(w)}</span><i>${s.toFixed(3)}</i></li>`).join("")}</ul>${key ? `<p class="lx-${ID}-cap">${kit.esc(key)}</p>` : ""}`;
  const quote = s => `“${s}”`;

  /* What is wrong with tag `got` on word k of note n (expected G[n][k]). */
  function tagMistake(kit, n, k, got) {
    const want = G[n][k], w = kit.esc(quote(W[n][k])), sp = kit.esc(quote(spanOf(n, k)));
    if (want === "O") return `${w} is not part of a supplier, a date or an amount, so it stays O.`;
    if (got === "O") return `${w} is part of the ${KIND[kindOf(want)]} ${sp}. Every word of it gets a tag.`;
    if (kindOf(got) !== kindOf(want)) return `${w} belongs to the ${KIND[kindOf(want)]} ${sp}, not to a ${KIND[kindOf(got)]}.`;
    if (want.startsWith("B-")) return `${w} is the first word of the ${KIND[kindOf(want)]} ${sp}, so it starts with B-, not I-.`;
    return `${w} carries on the ${KIND[kindOf(want)]} ${sp} that the word before it started, so it is ${want}. B- would start a new one.`;
  }

  /* Screens 1 and 2: tag notes by hand with a brush. */
  function tagScreen(notes, head, lead, task) {
    return function ({ el, done, kit }) {
      ensureStyle();
      const tags = {}; notes.forEach(n => { tags[n] = W[n].map(() => "O"); });
      let brush = "B-SUPPLIER", checked = null; // checked: null or list of [n, k]
      const paint = () => {
        const bad = n => new Set((checked || []).filter(m => m[0] === n).map(m => m[1]));
        const fb = checked == null ? "" : checked.length
          ? kit.feedback(`${plural(checked.length, "word")} still ${checked.length === 1 ? "has" : "have"} the wrong tag (marked). ${checked.slice(0, 3).map(([n, k]) => tagMistake(kit, n, k, tags[n][k])).join(" ")}${checked.length > 3 ? ` And ${checked.length - 3} more.` : ""}`, false)
          : kit.feedback(task.ok, true);
        el.innerHTML = `<h1>${head}</h1>${lead(kit)}
          <p class="task">${task.text}</p>
          <div class="lx-${ID}-brushes" role="group" aria-label="Tag to paint">${TAGS.map(t => `<button type="button" class="lx-${ID}-brush" data-brush="${t}" aria-pressed="${t === brush}">${t}</button>`).join("")}</div>
          ${notes.map(n => wordRow(kit, n, tags[n], { pick: true, bad: bad(n), title: `Note ${n + 1}` })).join("")}
          <div class="lpanel"><button type="button" class="btn lx-${ID}-check" data-check>Check my tags</button>${fb}</div>`;
        el.querySelectorAll("[data-brush]").forEach(b => b.onclick = () => { brush = b.dataset.brush; paint(); });
        el.querySelectorAll("[data-w]").forEach(b => b.onclick = () => {
          const [n, k] = b.dataset.w.split("-").map(Number);
          tags[n][k] = brush;
          if (checked) { checked = checked.filter(m => !(m[0] === n && m[1] === k)); if (!checked.length) checked = null; }
          paint();
        });
        el.querySelector("[data-check]").onclick = () => {
          checked = [];
          notes.forEach(n => G[n].forEach((g, k) => { if (tags[n][k] !== g) checked.push([n, k]); }));
          paint();
          if (!checked.length) done();
        };
      };
      paint();
    };
  }
  const walkTags = notes => {
    const out = [];
    notes.forEach(n => TAGS.slice(1).forEach(t => {
      const ks = G[n].map((g, k) => g === t ? k : -1).filter(k => k >= 0);
      if (ks.length) out.push(`[data-brush="${t}"]`, ...ks.map(k => `[data-w="${n}-${k}"]`));
    }));
    return [...out, "[data-check]"];
  };

  const byHand1 = tagScreen([0, 1, 2], "Who was paid, when, and how much?",
    kit => `<p class="lead">A small import business pays its suppliers by bank transfer, and whoever sends the money types a free note: “${kit.esc(W[0].join(" "))}”. At the end of the month the bookkeeper copies the supplier, the date and the amount from every note into the books, by hand. The owner wants a program to do it: read free text and turn it into fields that code can store. First you do it the way the program will have to, with one tag per word.</p>
      <p class="lead"><b>B-</b> marks the first word of a supplier, a date or an amount. <b>I-</b> marks each further word of the same one. <b>O</b> marks every other word. So “Han Textiles” is B-SUPPLIER, I-SUPPLIER. An amount includes its currency, a date is day and month.</p>`,
    { text: "Pick a tag, then tap the words it belongs to. Every word starts as O. Check when all three notes are done.",
      ok: "All three notes tagged. Each supplier, date and amount is now a run of words that starts with a B- tag." });

  const byHand2 = tagScreen([3, 4, 5], "Three more notes",
    kit => `<p class="lead">Same rules: B- on the first word of a supplier, a date or an amount, I- on each further word of it, O on the rest. Read note 4 slowly: two suppliers shared one payment.</p>`,
    { text: "Tag these three notes, then check.",
      ok: `All six notes done. In note 4, “${W[3][4]}” is B-SUPPLIER even though the word before it is also a supplier word.` });

  /* 3. Spot the idea: why B exists. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const io = G[3].map(t => t === "O" ? "O" : kindOf(t));
    const run = W[3].filter((_, k) => io[k] === "SUPPLIER").join(" ");
    const opts = [
      "Two suppliers, “Han Textiles” and “Busan Wire”",
      `One supplier, “${kit.esc(run)}”`,
      "Only “Han”, because a supplier is one word",
      "Nothing: the program cannot read tags without B and I"
    ];
    const fb = [
      ["That is what you meant, but the program only sees the tags. Four SUPPLIER tags in a row look exactly like one four-word name. Nothing marks where the first name ends.", false],
      [`Right. Without B, a run of the same tag is all the program has, and four SUPPLIER words in a row are one run. The B- tag says “a new one starts here”, so B I B I reads as two suppliers. That is the whole job of B. This way of tagging is called <b>BIO</b> tagging. Giving every token of a text its own label is called <b>token classification</b>. Each supplier, date or amount is one <b>entity</b>, and finding them this way is <b>named entity recognition</b> (NER).`, true],
      ["Nothing limits a supplier to one word: “Han Textiles” has two. The program reads a run of SUPPLIER tags as one name, however long.", false],
      ["The program can read these tags: it joins each run of the same tag into one entry. That is exactly the problem in note 4.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why B?</h1>
        <p class="lead">A colleague says B and I are fussy. His plan: tag each word SUPPLIER, DATE, AMOUNT or O, and let the program join each run of the same tag into one entry. Here is note 4 his way:</p>
        ${wordRow(kit, 3, io)}
        <p class="task">What does his program write in the supplier column for note 4?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Align by hand: the tokenizer splits words into pieces. */
  const AL_NOTE = 2;
  const AL_ASK = (() => { // tokens to ask about: a later piece, a first piece, a comma inside a word, an I- word, [SEP]
    const [, , toks, wids] = TOK[AL_NOTE];
    const later = wids.findIndex((w, i) => i > 0 && w != null && w === wids[i - 1] && /^##/.test(toks[i]));
    const kim = wids.findIndex(w => w != null && G[AL_NOTE][w] === "B-SUPPLIER");
    const comma = toks.findIndex((t, i) => t === "," && wids[i] === wids[i - 1]);
    const iAmt = wids.findIndex(w => w != null && G[AL_NOTE][w] === "I-AMOUNT");
    return [later, kim, comma, iAmt, toks.length - 1];
  })();
  function alignByHand({ el, done, kit }) {
    ensureStyle();
    const [words, tags, toks, wids, aligned] = TOK[AL_NOTE];
    let q = 0, wrong = null;
    const optsFor = i => {
      const w = wids[i], t = w == null ? "O" : tags[w];
      const alt = t.startsWith("B-") ? "I-" + t.slice(2) : t.startsWith("I-") ? "B-" + t.slice(2) : "B-DATE";
      const set = [t, "-100", alt];
      return q % 2 ? [set[1], set[0], set[2]] : set; // vary the position of the right answer
    };
    const say = (i, v) => {
      const w = wids[i], piece = kit.esc(quote(toks[i]));
      if (w == null) return `${piece} is not one of your words: the word row says none. The tokenizer adds it to every input. It gets -100 so training skips it.`;
      const word = kit.esc(quote(words[w]));
      const first = wids[i - 1] !== w;
      if (first && v === "-100") return `${piece} is the first piece of ${word}, so it carries that word's tag, ${tags[w]}. With -100 the model would never learn this word.`;
      if (first) return `${piece} is the first piece of ${word}. It copies the word's tag exactly: ${tags[w]}.`;
      return `${piece} is a later piece of ${word}. The word's tag already sits on its first piece, ${quote(toks[wids.indexOf(w)])}. The rule gives later pieces -100, so each word counts once.`;
    };
    const paint = () => {
      const fin = q >= AL_ASK.length, i = AL_ASK[q];
      const labels = aligned.map((a, j) => fin || j < i || (AL_ASK.slice(0, q).includes(j)) ? a : j === i ? "?" : "");
      const opts = fin ? [] : optsFor(i);
      el.innerHTML = `<h1>The model does not see your words</h1>
        <p class="lead">Before a BERT-style model reads note ${AL_NOTE + 1}, its tokenizer cuts the words into pieces from its vocabulary. A piece that continues a word starts with ##. The tokenizer also lowercases every word, and adds [CLS] at the start and [SEP] at the end. The model gives one label to each <b>token</b> (piece), but you tagged words.</p>
        <p class="lead">Each box below is one token. Top row: the token. Middle row: which of your words it came from (the tokenizer can tell). Bottom row: its label.</p>
        <p class="lead">The training code uses this rule: the first token of a word gets the word's tag. Later pieces and the added tokens get <b>-100</b>, a label the loss skips.</p>
        ${fin ? "" : `<p class="task">What label does ${kit.esc(quote(toks[i]))} get?</p>`}
        ${strip(kit, AL_NOTE, labels, { cur: fin ? -1 : i })}
        <div class="lpanel">${fin ? kit.feedback(`All ${toks.length} tokens labelled: ${aligned.filter(a => a !== "-100").length} carry a tag, one per word (${words.length} words), and ${aligned.filter(a => a === "-100").length} are -100. Why -100? PyTorch's cross-entropy loss skips every label equal to its <code>ignore_index</code> setting, which is -100 by default. So the loss only counts one prediction per word, and the extra pieces add nothing to it.`, true)
          : `${kit.options(opts, { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(aligned[i]) })}${wrong != null ? kit.feedback(say(i, wrong), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== aligned[i]) { wrong = v; paint(); return; }
        wrong = null; q++; paint();
        if (q >= AL_ASK.length) done();
      });
    };
    paint();
  }

  /* 5. The alignment as Python: a stepped replay of the traced run on note 2. */
  const CODE_NOTE = 1;
  const FR = (() => {
    const fr = [];
    TRACE.forEach((r, k) => {
      if (k === 0) return;
      const prev = TRACE[k - 1];
      if (r[0] === 4 && prev[0] === 3) fr.push({ ln: 3, wid: "-", prv: r[3], labels: r[4] });
      if (r[0] === 9 && r[1] === "l") fr.push({ ln: prev[0], wid: r[2], prv: r[3], labels: r[4] });
      if (r[1] === "r") fr.push({ ln: 10, wid: r[2], prv: r[3], labels: r[4], end: true });
    });
    return fr;
  })();
  // the frame just before the later piece ##an gets its label: the learner predicts which line runs
  const PRED = FR.findIndex(f => f.ln === 6 && f.wid != null) - 1;
  function asCode({ el, done, kit }) {
    ensureStyle();
    const [words, tags, toks] = TOK[CODE_NOTE];
    let i = 0, pred = null;
    const predOpts = ["Line 6: append -100", `Line 8: append the tag of ${quote(words[FR[PRED + 1].wid])} again`];
    const predFb = [
      [`Right. Line 5 sees word id ${FR[PRED + 1].wid} again, the same as <code>previous</code>: this token is a later piece of the same word. Press Next step to see it.`, true],
      [`That would give ${quote(words[FR[PRED + 1].wid])} two labels, one per piece. Line 9 first sets <code>previous</code> to ${FR[PRED + 1].wid}. Then line 5 compares the next <code>word_id</code> with it: both are ${FR[PRED + 1].wid}, so the test is true and line 6 runs.`, false]
    ];
    const sayFrame = f => {
      const t = f.labels.length - 1, last = f.labels[t];
      if (f.end) return `Line 10 returns ${plural(f.labels.length, "label")}, one per token. The ${f.labels.filter(x => x === -100).length} labels of -100 are [CLS], the piece ##an and [SEP]. Training uses this list next to the token ids.`;
      if (f.ln === 3) return `<code>word_ids()</code> gives, for each of the ${toks.length} tokens, the index of the word it came from, or <code>None</code>. <code>previous</code> remembers the last one, so the code can tell a first piece from a later one.`;
      if (f.ln === 6 && f.wid == null) return `Token ${quote(toks[t])} has word id <code>None</code>: the tokenizer added it. Line 6 appends -100.`;
      if (f.ln === 6) return `Token ${quote(toks[t])} has word id ${f.wid}, the same as the token before it: a later piece of ${quote(words[f.wid])}. Line 6 appends -100.`;
      return `Token ${quote(toks[t])} starts word ${f.wid}, ${quote(words[f.wid])}, tagged ${tags[f.wid]}. Line 8 appends its id, ${last}.`;
    };
    const paint = () => {
      const f = FR[i];
      const labels = toks.map((_, j) => j < f.labels.length ? tagName(f.labels[j]) : "");
      el.innerHTML = `<h1>The same rule in Python</h1>
        <p class="lead">This is the function the training script used, run on note ${CODE_NOTE + 1}. <code>is_split_into_words=True</code> tells the tokenizer the note is already a list of words, so word ids point into that list. <code>TAG_IDS</code> turns a tag into its number (O is 0, B-SUPPLIER 1, and so on). The boxes below show each label by its name, not its number.</p>
        <p class="task">Step through to the end. Before the piece ##an gets its label, predict which line runs.</p>
        <div class="lx-${ID}-wrap">${kit.code(CODE, f.ln)}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 || (i === PRED && pred !== 0) ? "disabled" : ""}>Next step</button></div>
        ${i === PRED ? `<div class="lpanel lx-${ID}-pred"><p class="task">The next token is ${quote(toks[PRED + 1])}. Which line appends its label?</p>${kit.options(predOpts, { picked: pred, correct: 0 })}${pred == null ? "" : kit.feedback(predFb[pred][0], predFb[pred][1])}</div>` : ""}
        <div class="vars"><span>word_id <b>${f.wid === "-" ? "–" : f.wid == null ? "None" : f.wid}</b></span><span>previous <b>${f.prv == null ? "None" : f.prv}</b></span><span>len(labels) <b>${f.labels.length}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${strip(kit, CODE_NOTE, labels, { cur: f.ln === 3 ? -1 : f.labels.length - 1 })}
        ${kit.feedback(sayFrame(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 6. Broken on purpose: labels written by position. */
  const BUG_NOTE = 3;
  function broken({ el, done, kit }) {
    ensureStyle();
    const [, , toks, , aligned, byPos] = TOK[BUG_NOTE];
    const out = ent(RUN_BUGGY, "first", BUG_NOTE);
    const first = byPos.findIndex((l, i) => l !== aligned[i]);
    let pick = null, fix = null, stage = 0;
    const fixOpts = [
      "Train for more epochs: the loss was still falling",
      "Map each token to its word with <code>word_ids()</code>: the first piece gets the tag, the rest -100",
      "Use a bigger model",
      "Lowercase the notes before tagging them"
    ];
    const lb = RUN_BUGGY.loss, lg = RUN_GOOD.loss;
    const fixFb = [
      [`The loss falls because the model is learning these labels, shifted ones included. More epochs learn the wrong thing better. The labels are the problem.`, false],
      [`Right. That is the function from the last screen. Retrained with it, everything else the same, the tagger returns ${ent(RUN_GOOD, "first", BUG_NOTE)[1].filter(e => e[0] === "SUPPLIER").map(e => kit.esc(quote(e[1]))).join(" and ")} as the suppliers of note ${BUG_NOTE + 1}. Its training loss after epoch ${EPOCHS} was ${lg[EPOCHS - 1]}; the shifted version ended at ${lb[EPOCHS - 1]}. A loss that stays high on easy data is a hint, but only the token-by-token table shows the cause.`, true],
      ["A bigger model would learn the same shifted labels, only more firmly. The model did what it was taught; it was taught the wrong token.", false],
      ["This tokenizer lowercases every word already (look at the tokens). Case is not why “payment” became a supplier.", false]
    ];
    const paint = () => {
      const bad = new Set(pick == null ? [] : [pick]);
      const pickFb = pick == null ? "" : pick === first
        ? kit.feedback(`Yes. [CLS] is not one of the words, yet it got the first word's tag, ${byPos[0]}. From there every label sits one token too early: ${quote(toks[2])} holds the tag meant for ${quote(toks[3])}. After the split word “bus ##an” the labels slip one more token. The code copied the word tags onto token positions as if words and tokens were the same list.`, true)
        : kit.feedback(byPos[pick] === aligned[pick]
          ? `${kit.esc(quote(toks[pick]))} got ${kit.esc(byPos[pick])}, which happens to be the right label here. Look for the first token whose label does not match it.`
          : `${kit.esc(quote(toks[pick]))} has the wrong label (${kit.esc(byPos[pick])}), but it is not the first one. Something earlier pushed the labels along; look further left.`, false);
      el.innerHTML = `<h1>The tagger that finds “payment”</h1>
        <p class="lead">A colleague wrote his own alignment and trained the same model on the same ${TRAIN_NOTES} notes. His tagger, run on note ${BUG_NOTE + 1}, returned:</p>
        ${entList(kit, out[1], "Real output from this lesson's run on a laptop CPU. Each row: the entity kind, its words, and the model's probability for it.")}
        <p class="lead">His alignment code, and the labels it gave note ${BUG_NOTE + 1} for training (bottom row of each box):</p>
        <div class="lx-${ID}-wrap">${kit.code(BUGGY, -1)}</div>
        ${stage === 0 ? `<p class="task">Tap the first token whose training label is wrong.</p>` : ""}
        ${strip(kit, BUG_NOTE, byPos, { pick: stage === 0, bad })}
        <div class="lpanel">${pickFb}
        ${stage === 1 ? `<p class="task">What fixes it?</p>${kit.options(fixOpts, { picked: fix, correct: 1 })}${fix == null ? "" : kit.feedback(fixFb[fix][0], fixFb[fix][1])}` : ""}</div>`;
      el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
        if (stage === 0) { pick = +b.dataset.i; if (pick === first) stage = 1; paint(); return; }
        fix = +b.dataset.i; paint(); if (fix === 1) done();
      });
    };
    paint();
  }

  /* 7. Run the model: predict how "simple" joins the pieces. */
  const RUN_NOTE = 4;
  function pipelineSimple({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const raw = ent(RUN_GOOD, "none", RUN_NOTE)[1];
    const simple = ent(RUN_GOOD, "simple", RUN_NOTE)[1];
    const sup = simple.filter(e => e[0] === "SUPPLIER").map(e => e[1]);
    const opts = ["“mekong ceramics”", sup.map(s => kit.esc(quote(s))).join(" and "), "“me”, “##kong” and “ceramics”"];
    const kong = raw.find(e => e[1] === "##kong");
    const fb = [
      [`That needs ##kong to be I-SUPPLIER. Look at the second row: the model said ${kit.esc(kong[0])}.`, false],
      [`Right. ##kong came out as ${kit.esc(kong[0])}, and <code>"simple"</code> starts a new entity at every B-. Why did the model say B there? In training, every later piece had -100, so no example ever told the model what to say for ##kong. Its guess there is unchecked. The amount fell apart the same way: “2”, “,” and “300” each got B-AMOUNT.`, true],
      ["“ceramics” is I-SUPPLIER, so it joins the entity before it. The split happens at ##kong, which the model tagged B-SUPPLIER.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Run the trained tagger</h1>
        <p class="lead">The model from the last screens was trained on ${TRAIN_NOTES} notes that a script generated from templates worded like your six notes, with other supplier names. So this test is easier than real bank notes. Here it runs with Hugging Face's pipeline on note ${RUN_NOTE + 1} (<code>note</code> is its text, “${kit.esc(W[RUN_NOTE].join(" "))}”). No training note used this supplier name:</p>
        ${kit.code(["tagger = pipeline(\"token-classification\",", "    model=model, tokenizer=tokenizer,", "    aggregation_strategy=\"none\")", "tagger(note)"], -1)}
        ${entList(kit, raw, "aggregation_strategy sets how tokens are grouped into entities; \"none\" groups nothing. One row per token the model did not label O (O rows are left out by default). Score = the model's probability for that label.")}
        <p class="lead">With <code>aggregation_strategy="simple"</code> the pipeline joins tokens into entities: a B- tag starts one, and I- tags of the same kind right after it join it.</p>
        <p class="task">What does "simple" return as the supplier?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. Repair at the output: aggregation_strategy="first". */
  function pipelineFirst({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const raw = ent(RUN_GOOD, "none", RUN_NOTE)[1];
    const first = ent(RUN_GOOD, "first", RUN_NOTE)[1];
    const kong = raw.find(e => e[1] === "##kong"), me = raw.find(e => e[1] === "me");
    const amt = first.filter(e => e[0] === "AMOUNT");
    const opts = [
      `Drop tokens whose score is below 0.7 (##kong scored ${kong[2].toFixed(3)})`,
      "<code>aggregation_strategy=\"first\"</code>: every word takes the label of its first token",
      "Train for more epochs",
      "<code>ignore_labels=[]</code>, so nothing is left out"
    ];
    const fb = [
      [`Dropping ##kong loses text instead of joining it, and the score is not the problem: “me” scored ${me[2].toFixed(3)} and is still cut off from its word.`, false],
      [`Right. That matches training exactly: only first pieces were labelled, so only first pieces are read. The real run with "first":${entList(kit, first)}The supplier is whole. The amount is still in ${amt.length} parts. Why? The pipeline only has the text, so it guesses where words are. With this tokenizer, a piece joins the word before it only when it starts with ##. The comma and “300” have no ##, so each counts as a word of its own. Fix that in your own code: join entities of the same kind that touch with no space between them.`, true],
      ["With -100 on every later piece, no epoch ever trains ##kong. More training does not reach it.", false],
      ["<code>ignore_labels</code> only decides which labels are left out of the output (by default O). It does not change how pieces are joined.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Repair the split words</h1>
        <p class="lead">The model was trained to label only the first piece of each word. But <code>"simple"</code> reads every piece, including untrained ones like ##kong. The pipeline also has word-level modes: <code>"first"</code>, <code>"average"</code> and <code>"max"</code>. They never give one word two labels.</p>
        <p class="task">Which change fixes “me” / “##kong ceramics” in a way that matches how the model was trained?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Running the model on each note", "Labelling new notes and training again", "Buying a GPU server"];
    const fb = [
      ["Running a model this small is cheap: it runs on a laptop CPU, where our whole run, training included, took about " + Math.round(RUN_GOOD.seconds) + " seconds. That cost does not change when the notes do.", false],
      ["Right. The model only knows the patterns in its training notes. New wording and new names need new tagged examples, then a retrain, then a check that the old notes still come out right. That human tagging time is the cost that grows.", true],
      [`A model this size trained on a laptop CPU in about ${Math.round(RUN_GOOD.seconds)} seconds here, and runs there too. Hardware is not what grows.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a token classifier</h1>
        <p class="lead"><b>What it does:</b> pulls typed pieces (names, dates, amounts, drug doses) out of free text whose wording varies.</p>
        <p class="lead"><b>Reach for it</b> when there are many texts, the kinds of entity stay the same, and you can tag a few hundred examples. Then a small model runs fast and cheap on your own machine, and the data never leaves it.</p>
        <p class="lead"><b>Not</b> when the value sits in a fixed format or field (a CSV column, a bank account number): a parser or a regular expression is exact. Not when you have no tagged examples, or the entity kinds change every week: asking a large language model for the fields in a prompt is quicker to start. Not when one label covers the whole text: that is text classification.</p>
        <p class="lead"><b>Costs:</b> tagging time, alignment code like this lesson's, and a retrain whenever the notes change.</p>
        <p class="task">The business starts buying from new countries. Notes now carry new supplier names and a new way of writing dates. Which cost bites first?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A pharmacy chain wants the drug name and the dose pulled out of doctors' typed prescription notes, which every doctor words differently.", true,
      "Yes. Free text, varied wording, and the same few kinds of entity every time: drug and dose. Tag a few hundred notes and train a token classifier.",
      "The wording varies, so a pattern will miss cases, and the entity kinds (drug, dose) stay fixed. That is exactly the case for tagging examples and training a token classifier."],
    ["A support team wants every incoming email sent to billing, technical or sales.", false,
      "No. Each email gets one label as a whole. Nothing inside it has to be found and marked. That is text classification, one prediction per text.",
      "Look at what the output is: one team per email, not a list of words. Per-word tags would add tagging work and give no answer to “which team?”. Use text classification."],
    ["A bank export arrives as a CSV file with columns date, payee and amount, and the books need the same three values.", false,
      "No. The values already sit in named fields. Reading the CSV gets them exactly; a model could only add mistakes.",
      "There is nothing to find: each value already has its own column. A model that guesses spans can only be less exact than reading the column."],
    ["A hotel wants the guest name and the check-in and check-out dates from booking emails that guests write themselves.", true,
      "Yes. Free-text emails and a fixed set of entity kinds: GUEST, CHECKIN and CHECKOUT. Tag the two dates as two kinds, so the model learns from the words around them which date is which.",
      "Guests write freely, so the dates and names can be anywhere and in any form, and the kinds of entity never change. That is the case for BIO tags and a token classifier."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Token classifier or not?</h1>
        <p class="lead">Four requests from other places. A token classifier labels every token of a text with a BIO tag, and the entities are read off the tags.</p>
        <p class="task">Would you build each one with a token classifier? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const lg = RUN_GOOD.loss, lb = RUN_BUGGY.loss;
    const al = TOK[CODE_NOTE][4];
    const CHECK = [
      `<code>align_labels</code> on “${kit.esc(W[CODE_NOTE].join(" "))}” returns ${al.length} labels, ${al.filter(a => a === "-100").length} of them -100.`,
      `The mean training loss after epoch 1 (ours: ${lg[0]}) is far above the loss after epoch 2 (ours: ${lg[1]}).`,
      `Trained with <code>align_labels_by_position</code> instead, the last epoch's loss stays well above the word_ids version (ours: ${lb[EPOCHS - 1]} against ${lg[EPOCHS - 1]}).`,
      `With <code>aggregation_strategy="none"</code> some token whose text starts with ## appears in the output, with its own label.`,
      `With <code>aggregation_strategy="first"</code> no returned word starts with ##.`
    ];
    el.innerHTML = `<h1>You can tag, align and repair</h1>
      <p class="lead">You tagged six notes with BIO tags, saw why B is needed, aligned word tags to the tokenizer's pieces with <code>word_ids()</code> and -100, found a shifted-label bug, and made the pipeline join pieces back into words.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook in Colab</a>. It` : "The notebook for this lesson is on its way. It"} trains the same small model on the generated notes, both alignments, and runs the pipeline. What you should see (exact numbers will differ a little):</p>
      <div class="lx-${ID}-checks">${CHECK.map(c => `<label class="lx-${ID}-chk"><input type="checkbox"><span>${c}</span></label>`).join("")}</div>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You can now produce entity spans; next you score them, counting an entity as right only when its whole span and its kind match.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Entity extraction with BIO tags",
    checked: "2026-11-14",
    sources: [
      "https://huggingface.co/docs/transformers/tasks/token_classification",
      "https://huggingface.co/docs/transformers/main_classes/pipelines",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.CrossEntropyLoss.html",
      "https://huggingface.co/google/bert_uncased_L-4_H-256_A-4"
    ],
    interview: [
      {
        q: "Your NER model is accurate in evaluation, but in production it returns company names cut in two, like “Micro” and “soft” as separate entities. What do you check?",
        good: [
          "Check how the output is grouped: a token-level mode such as \"simple\" can split one word; a word-level mode such as \"first\" cannot",
          "Check how labels were aligned in training: if later pieces got -100, the model's output on them was never trained",
          "Make the inference grouping match the training rule, for example read only each word's first piece",
          "Compare how words are split in training and at inference: punctuation can turn one word into several"
        ],
        weak: "Train longer or on a bigger model. That does not touch the pieces that never got a training label, or the grouping step that splits them."
      },
      {
        q: "A teammate's NER model trains, but its loss stays high and it tags the word before each name. Where do you look first?",
        good: [
          "Print one example token by token: the token, the word it came from, and its training label",
          "Look for labels shifted by the special tokens or by words split into several pieces",
          "Align with word_ids(): the first piece gets the word's tag, special tokens and later pieces get -100",
          "Retrain and confirm on a few known notes before trusting any score"
        ],
        weak: "Tune the learning rate or add epochs. The model is learning exactly the labels it was given; they point at the wrong tokens."
      }
    ],
    screens: [byHand1, byHand2, spotIdea, alignByHand, asCode, broken, pipelineSimple, pipelineFirst, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-check]"], right: walkTags([0, 1, 2]) },
      { wrong: ["[data-check]"], right: walkTags([3, 4, 5]) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(AL_ASK.length).fill("[data-right]") },
      { wrong: [...Array(PRED).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]", ...Array(FR.length - 1 - PRED).fill("[data-next]")] },
      { wrong: ['[data-i="2"]'], right: ['[data-i="0"]', "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
