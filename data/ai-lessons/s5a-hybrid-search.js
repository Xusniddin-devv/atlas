/* Lesson: hybrid search: keywords, meaning and filters (s5a-hybrid-search).
   Story: an instrument rental chain's repair log, shared by three branches (Harbour, Northgate, Riverside), searched
   by serial number and by a customer's own words, limited to the asker's branch.
   Ideas: (1) keyword search (BM25) and vector search each win a different kind of query; reciprocal rank fusion (RRF)
   merges their rankings by position, not by score. (2) A metadata filter must run inside each search, before the
   ranks are counted; filtering after the top k are cut loses rows (the broken-on-purpose screen).
   Data, all from one real run on 2026-11-13 (no model recordings in this lesson):
   - docs/ai-path/runs/s5a-hybrid-search/repairs.json (the made-up repair log and the two queries)
   - runs/.../search.py -> search.out.txt: BM25 from scratch (Lucene form, k1 1.2, b 0.75), cosine similarity from a
     small local embedding model (Ollama all-minilm, 384 numbers per text), RRF with k = 60, the broken and fixed
     hybrid_search outputs, and the line-by-line trace of fuse()
   - runs/.../env.txt (Python and Ollama versions)
   Every rank, share, sum and count on screen is computed here from those constants. Plain browser script. */
(() => {
  const ID = "s5a-hybrid-search", P = "lx-" + ID + "-";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen"];
  const word = n => WORDS[n] || String(n);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th", "13th"];
  const f4 = v => v.toFixed(4), f6 = v => v.toFixed(6);

  /* ---------- data: the repair log (runs/s5a-hybrid-search/repairs.json) ---------- */
  const REPAIRS = [
    ["R01", "Harbour", "Fender Stratocaster, serial MX19044127. Fret buzz on the high E string above the 12th fret. Levelled and crowned frets 12 to 17."],
    ["R02", "Northgate", "Yamaha P-125 digital piano, serial EBQN01882. Two keys stuck after a drink spill. Cleaned the contacts and replaced the key springs."],
    ["R03", "Riverside", "Gibson Les Paul, serial 190040331. Fret buzz on the low strings in open position. Raised the action and adjusted the truss rod."],
    ["R04", "Harbour", "Yamaha YAS-280 alto saxophone, serial M44017. Low notes will not sound. Replaced two leaking pads and regulated the keys."],
    ["R05", "Northgate", "Fender Precision Bass, serial MX19044172. Output jack crackles when the cable moves. Resoldered the jack."],
    ["R06", "Riverside", "Ibanez RG electric guitar, serial I190400331. Pickup selector crackles between positions. Cleaned and re-tensioned the switch."],
    ["R07", "Harbour", "Cordoba C5 classical guitar, serial C5-1904412. Crack in the top under the bridge after a dry winter. Glued and cleated the crack."],
    ["R08", "Northgate", "Taylor 214ce acoustic guitar, serial 2204118. Buzzing at the 5th fret because of uneven frets. Fret level and a new nut."],
    ["R09", "Riverside", "Stentor student violin, serial ST4410923. Sound post fell over. Reset the sound post and fitted new strings."],
    ["R10", "Harbour", "Squier Telecaster, serial MX19041427. The neck pickup went silent. Replaced the neck pickup and its wiring."],
    ["R11", "Harbour", "Yamaha FG800 acoustic guitar, serial HPX220871. Action too stiff, chords are hard to press. Lowered the saddle and set the action."],
    ["R12", "Northgate", "Roland TD-07 electronic drum kit, serial Z9B4471. Snare pad stopped responding. Replaced the sensor cable inside the pad."],
    ["R13", "Harbour", "Epiphone ES-339, serial 21031505744. Bridge saddles vibrate with a metallic hum on some notes. Tightened all saddle screws."]
  ];
  const NR = REPAIRS.length;
  const BRANCH = Object.fromEntries(REPAIRS.map(r => [r[0], r[1]]));
  const TEXT = Object.fromEntries(REPAIRS.map(r => [r[0], r[2]]));
  const BRANCHES = [...new Set(REPAIRS.map(r => r[1]))];
  const serialOf = id => TEXT[id].match(/serial ([^.\s]+)/)[1];
  const instrumentOf = id => TEXT[id].split(",")[0];
  // the same word split as search.py: lowercase runs of letters and digits
  const words = t => t.toLowerCase().match(/[a-z0-9]+/g) || [];
  const shared = (q, id) => { const w = new Set(words(TEXT[id])); return [...new Set(words(q))].filter(x => w.has(x)); };
  const quoteList = a => a.map(x => `"${esc(x)}"`).join(", ");
  // short plain descriptions of what each repair was about (lesson wording, not data)
  const ABOUT = {
    R01: "fret buzz on the high string, high up the neck", R02: "keys stuck after a drink spill", R03: "fret buzz on the low strings near the nut",
    R04: "saxophone pads that leaked", R05: "a bass output jack that crackles", R06: "a pickup switch that crackles", R07: "a crack in a guitar top",
    R08: "fret buzz at the 5th fret", R09: "a violin sound post", R10: "a neck pickup that went silent", R11: "strings too stiff to press",
    R12: "a drum pad that stopped responding", R13: "bridge saddles that hum"
  };

  const ASKER = "Harbour";
  const SERIAL_Q = "MX19044127";
  const RATTLE_Q = "my guitar rattles when I play high up the neck";
  const K = 60; // search.py: fuse(..., k=60)

  /* From runs/s5a-hybrid-search/search.out.txt. Keyword lists hold only repairs with a BM25 score above 0
     (a keyword engine returns matches only); vector lists hold every repair (cosine similarity). */
  const KW = {
    serial: [["R01", 2.1241]],
    rattle: [["R10", 3.4002], ["R05", 2.6348], ["R01", 2.2746], ["R06", 1.3184], ["R11", 1.2539], ["R07", 1.2299], ["R08", 1.2112], ["R03", 0.1734], ["R12", 0.157], ["R02", 0.1505], ["R09", 0.1197], ["R04", 0.1122]]
  };
  const VEC = {
    serial: [["R05", 0.3274], ["R08", 0.2931], ["R01", 0.2731], ["R09", 0.2531], ["R12", 0.2523], ["R10", 0.2484], ["R13", 0.2483], ["R02", 0.241], ["R11", 0.2317], ["R06", 0.2181], ["R03", 0.1784], ["R04", 0.1743], ["R07", 0.1618]],
    rattle: [["R08", 0.489], ["R03", 0.4667], ["R01", 0.4571], ["R13", 0.416], ["R10", 0.4159], ["R06", 0.3894], ["R11", 0.3778], ["R07", 0.3272], ["R09", 0.2843], ["R05", 0.2821], ["R04", 0.2153], ["R12", 0.2043], ["R02", 0.1341]]
  };
  /* From search.out.txt: what the two versions of hybrid_search returned (Python lists, printed by the run). */
  const OUT = {
    brokenRiverside: [], brokenNorthgate: ["R08"], brokenRiverside10: ["R03", "R06", "R09"],
    fixedRiverside: ["R06", "R03", "R09"], fixedHarbour: ["R01", "R10", "R11"]
  };
  const pyList = a => `[${a.map(x => `'${x}'`).join(", ")}]`;

  /* RRF, computed here the same way as fuse() in search.py */
  const ids = list => list.map(r => r[0]);
  const onlyBranch = (list, b) => list.filter(id => BRANCH[id] === b);
  function rrf(lists) {
    const s = new Map();
    lists.forEach(l => l.forEach((id, i) => s.set(id, (s.get(id) || 0) + 1 / (K + i + 1))));
    return [...s].sort((a, b) => b[1] - a[1]); // stable, like Python's sorted
  }
  const KW_H = onlyBranch(ids(KW.rattle), ASKER), VEC_H = onlyBranch(ids(VEC.rattle), ASKER);
  const FUSED_H = rrf([KW_H, VEC_H]);
  const TOP3 = FUSED_H.slice(0, 3).map(r => r[0]);
  const HARBOUR = REPAIRS.filter(r => r[1] === ASKER).map(r => r[0]);
  const rankIn = (list, id) => list.indexOf(id) + 1; // 0 = not in the list

  /* ---------- shared bits ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}q { margin: 16px 0 0; padding: 10px 14px; border-left: 3px solid var(--ink); font: 600 16px var(--mono); overflow-wrap: anywhere; }
.${P}q small { display: block; font: 600 12px var(--font); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 2px; }
.${P}list { margin: 14px 0 0; }
.${P}list > p { margin: 0 0 6px; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
.${P}row { display: grid; grid-template-columns: 2.2em minmax(0, 1fr) auto; gap: 2px 10px; align-items: baseline; width: 100%; min-height: 44px; margin: 0 0 8px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 15.5px/1.4 var(--font); text-align: left; box-sizing: border-box; }
button.${P}row { cursor: pointer; }
@media (hover: hover) { button.${P}row:not(.${P}ok):not(.${P}bad):hover { border-color: var(--ink); } }
.${P}row .${P}rk { font: 700 14px var(--mono); color: var(--muted); }
.${P}row .${P}id { font: 700 14px var(--mono); }
.${P}row .${P}id i { font-style: normal; font-weight: 500; color: var(--muted); margin-left: 6px; font-family: var(--font); }
.${P}row .${P}sc { font: 600 14px var(--mono); color: var(--ink-2); }
.${P}row .${P}tx { grid-column: 2 / 4; color: var(--ink-2); font-size: 15px; }
.${P}row.${P}ok { border-color: var(--good); background: var(--good-soft); }
.${P}row.${P}ok .${P}id, .${P}row.${P}ok .${P}rk { color: var(--good); }
.${P}row.${P}bad { border-color: var(--bad); background: var(--bad-soft); }
.${P}row.${P}gone { opacity: .45; border-style: dashed; }
.${P}two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
.${P}two .${P}list { margin: 0; min-width: 0; }
.${P}two .${P}row { grid-template-columns: 1.4em minmax(0, 1fr) auto; gap: 2px 6px; padding: 8px 8px; font-size: 14px; }
.${P}two .${P}row .${P}id i { display: block; margin-left: 0; font-size: 13px; }
.${P}two .${P}row .${P}sc { font-size: 13px; }
.${P}mini { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 44px; margin: 0 0 6px; padding: 6px 8px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: 500 14px var(--mono); text-align: left; box-sizing: border-box; cursor: pointer; }
.${P}mini .${P}rk { color: var(--muted); min-width: 1.6em; }
.${P}mini .${P}br { font-family: var(--font); font-size: 13.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.${P}mini .${P}nr { margin-left: auto; font-weight: 700; color: var(--good); white-space: nowrap; }
.${P}mini.${P}ok { border-color: var(--good); background: var(--good-soft); }
.${P}mini.${P}bad { border-color: var(--bad); background: var(--bad-soft); }
.${P}mini.${P}gone { opacity: .4; border-style: dashed; cursor: default; }
@media (hover: hover) { .${P}mini:not(.${P}ok):not(.${P}bad):not(.${P}gone):hover { border-color: var(--ink); } }
.${P}formula { margin: 14px 0 0; padding: 12px 14px; border-radius: 10px; background: var(--sunk); font: 500 14.5px/1.6 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
.${P}scores { min-width: 0; width: 100%; max-width: 460px; font-size: 14.5px; }
.${P}scores td, .${P}scores th { padding-right: 10px; padding-left: 8px; }
.${P}out { margin: 14px 0 0; padding: 12px 14px; border-radius: 10px; background: var(--sunk); color: var(--ink); font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}out b { display: block; font: 600 12px var(--font); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 2px; }
.${P}picked { margin: 12px 0 0; font: 600 15px var(--mono); }
.${P}code .lcode { overflow-x: visible; }
.${P}code .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + 6ch); text-indent: -6ch; }
@media (max-width: 700px) { .${P}code .lcode div { padding-left: calc(12px + 6ch); } }
.${P}small { font-size: 15px; color: var(--ink-2); }
`;
    document.head.appendChild(s);
  }
  const queryBox = (label, q) => `<div class="${P}q"><small>${esc(label)}</small>${esc(q)}</div>`;
  const codeBox = (lines, active) => `<div class="${P}code">${LessonKit.code(lines, active)}</div>`;
  // one result row: rank, id, branch, score, text; a button when pickable
  function row(rank, id, score, { pick = false, cls = "", text = true, branch = true } = {}) {
    const inner = `<span class="${P}rk">${rank}</span><span class="${P}id">${esc(id)}${branch ? `<i>${esc(BRANCH[id])}</i>` : ""}</span><span class="${P}sc">${score == null ? "" : f4(score)}</span>${text ? `<span class="${P}tx">${esc(TEXT[id])}</span>` : ""}`;
    return pick ? `<button type="button" class="${P}row ${cls}" data-i="${esc(id)}">${inner}</button>` : `<div class="${P}row ${cls}">${inner}</div>`;
  }

  /* ---------- 1. The situation: a serial number, and the meaning search ranks the wrong guitar first ---------- */
  function serialMiss({ el, done, kit }) {
    style();
    const SHOW = 4, top = VEC.serial.slice(0, SHOW), at = rankIn(ids(VEC.serial), "R01");
    const lo = Math.min(...top.map(r => r[1])), hi = Math.max(...top.map(r => r[1]));
    let wrong = null, ok = false;
    const why = id => {
      const s = serialOf(id), q = SERIAL_Q;
      let same = 0; while (same < s.length && s[same] === q[same]) same++;
      return same >= 6
        ? `${esc(id)} has serial ${esc(s)}. The first ${word(same)} characters match the query, the end does not: ${esc(s.slice(same))} against ${esc(q.slice(same))}. It is a ${esc(instrumentOf(id))} at ${esc(BRANCH[id])}, and the search still put it ${ORD[rankIn(ids(VEC.serial), id)]}.`
        : `${esc(id)} has serial ${esc(s)}, nothing like ${esc(q)}. It is a ${esc(instrumentOf(id))} at ${esc(BRANCH[id])}. Look for the exact serial in the text.`;
    };
    const paint = () => {
      el.innerHTML = `<h1>The serial number search</h1>
        <p class="lead">An instrument rental chain has three branches: ${BRANCHES.join(", ")}. They share one repair log. A customer brings a Stratocaster back to the ${ASKER} branch, and the clerk types its serial number into the log's search box. Today that search is a vector search, as in the last lessons: it compares meanings. This lesson is about that search step, the one that finds the right rows before anything else uses them, for a search box or a RAG app.</p>
        ${queryBox("The clerk types", SERIAL_Q)}
        <p class="task">The search returned these ${word(SHOW)} rows first. Tap the repair of this exact guitar.</p>
        <div class="${P}list"><p>Vector search, cosine similarity</p>${top.map(([id, s], i) => row(i + 1, id, s, { pick: !ok, cls: ok && id === "R01" ? P + "ok" : wrong === id ? P + "bad" : "" })).join("")}</div>
        <div class="lpanel">${ok ? kit.feedback(`Right: R01, ranked ${ORD[at]}. An embedding model turns text into numbers that stand for its meaning, and a serial number has no meaning. To the model, ${esc(SERIAL_Q)} and ${esc(serialOf("R05"))} look almost the same. Look at the scores: all ${word(SHOW)} sit between ${f4(lo)} and ${f4(hi)}, so tiny differences decide the order.`, true)
            + `<div class="${P}list"><p>Keyword search on the same log</p>${KW.serial.map(([id, s], i) => row(i + 1, id, s, { text: false })).join("")}</div>`
            + kit.feedback(`A keyword search returned ${KW.serial.length === 1 ? "one row" : KW.serial.length + " rows"}: R01. It scores a repair by the query words it contains. The method here is <b>BM25</b>, which builds on the TF-IDF idea. A word that few repairs contain counts for much more than a common one. A word repeated many times stops adding much. A match in a long text counts a little less than in a short one. ${esc(SERIAL_Q)} appears in one repair only, so only that repair scores above 0.`)
          : wrong ? kit.feedback(why(wrong), false) : ""}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => {
        const id = b.dataset.i;
        if (id === "R01") { ok = true; wrong = null; paint(); done(); } else { wrong = id; paint(); }
      });
    };
    paint();
  }

  /* ---------- 2. The customer's words: keyword search ranks by shared words, not by the problem ---------- */
  function wordsMiss({ el, done, kit }) {
    style();
    const SHOW = 5, top = KW.rattle.slice(0, SHOW), at = rankIn(ids(KW.rattle), "R01");
    const vtop = VEC.rattle.slice(0, 3);
    let wrong = null, ok = false;
    const paint = () => {
      el.innerHTML = `<h1>The customer's own words</h1>
        <p class="lead">Next, a customer at ${ASKER} describes a problem. The repair she needs is a common one, but she does not know the word for it. This time the clerk tries a keyword search.</p>
        ${queryBox("The clerk types what the customer said", RATTLE_Q)}
        <p class="task">Read the top ${word(SHOW)} rows. Tap the first one that is about her problem.</p>
        <div class="${P}list"><p>Keyword search, BM25 score</p>${top.map(([id, s], i) => row(i + 1, id, s, { pick: !ok, cls: ok && id === "R01" ? P + "ok" : wrong === id ? P + "bad" : "" })).join("")}</div>
        <div class="lpanel">${ok ? kit.feedback(`Right: R01. "Fret buzz above the 12th fret" is what "rattles high up the neck" means. Keyword search put it ${ORD[at]}: it shares only ${quoteList(shared(RATTLE_Q, "R01"))} with the query. Customers do not use the log's words.`, true)
            + `<div class="${P}list"><p>Vector search, top ${word(vtop.length)}</p>${vtop.map(([id, s], i) => row(i + 1, id, s, { text: false })).join("")}</div>`
            + kit.feedback(`The vector search's top ${word(vtop.length)}: ${vtop.map(([id]) => `${esc(id)}, ${esc(ABOUT[id])}`).join("; ")}. All are fret buzz repairs, and none contains the word "rattle". This time meaning wins. So: keyword search won the serial number, vector search won the customer's words. ${vtop.filter(([id]) => BRANCH[id] !== ASKER).length === 2 ? "One more problem: two of these three are at other branches." : ""}`)
          : wrong ? kit.feedback(`${esc(wrong)} is about ${esc(ABOUT[wrong])}. Nothing rattles. Keyword search ranked it ${ORD[rankIn(ids(KW.rattle), wrong)]} because it shares ${quoteList(shared(RATTLE_Q, wrong))} with the query.${wrong === "R10" ? ` "Neck" here means the neck pickup: same word, different thing.` : ""}`, false) : ""}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => {
        const id = b.dataset.i;
        if (id === "R01") { ok = true; wrong = null; paint(); done(); } else { wrong = id; paint(); }
      });
    };
    paint();
  }

  /* ---------- 3. Spot the idea: merge by position, not by score ---------- */
  function spotIdea({ el, done, kit }) {
    style();
    const SHOW = 5;
    const kwTop = KW.rattle.slice(0, SHOW), vTop = VEC.rattle.slice(0, SHOW);
    const kwMax = KW.rattle[0][1], vMax = VEC.rattle[0][1];
    // what adding the raw scores would give (every repair; 0 from a list it is missing from)
    const bm = Object.fromEntries(KW.rattle), cs = Object.fromEntries(VEC.rattle);
    const raw = REPAIRS.map(r => [r[0], (bm[r[0]] || 0) + (cs[r[0]] || 0)]).sort((a, b) => b[1] - a[1]);
    const raw3 = raw.slice(0, 3).map(r => r[0]), kw3 = ids(KW.rattle).slice(0, 3);
    const sameAsKw = raw3.join() === kw3.join();
    const opts = [
      "Add each repair's two scores together and sort by the total.",
      "Show whichever list has the higher top score.",
      "Ignore the scores. Use only the positions: a repair near the top of both lists beats one at the top of only one.",
      "Ask a language model to read every repair and pick the best."
    ];
    const correct = 2;
    let ans = null;
    const paint = () => {
      el.innerHTML = `<h1>One search box, two lists</h1>
        <p class="lead">The clerk will not choose a search for each query. The plan: run both searches every time and merge the two lists into one. Here are both lists for the customer's words.</p>
        ${queryBox("Query", RATTLE_Q)}
        <div class="${P}two">
          <div class="${P}list"><p>Keyword, BM25</p>${kwTop.map(([id, s], i) => row(i + 1, id, s, { text: false })).join("")}</div>
          <div class="${P}list"><p>Vector, cosine</p>${vTop.map(([id, s], i) => row(i + 1, id, s, { text: false })).join("")}</div>
        </div>
        <p class="task">How should the two lists be merged?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The two kinds of score are on different scales, so throw them away and keep only the positions. This is <b>reciprocal rank fusion</b> (RRF): each list gives a repair 1 / (${K} + its rank), and the shares add up. A repair high in both lists collects two big shares. A repair missing from a list gets nothing from it. The ${K} comes from the paper that introduced RRF. The authors fixed it in a first test and found the exact value was not critical. It keeps rank 1 from counting far more than rank 2: 1/${K + 1} = ${f6(1 / (K + 1))} and 1/${K + 2} = ${f6(1 / (K + 2))}.`, true)
          : ans === 0 ? kit.feedback(`Adding the scores gives ${raw3.join(", ")} as the top three${sameAsKw ? ", exactly the keyword list's top three" : ""}. Keyword scores here go up to ${f4(kwMax)}; cosine scores only reach ${f4(vMax)}. The bigger scale wins every time, so the meaning search is drowned out.`, false)
          : ans === 1 ? kit.feedback(`${f4(kwMax)} against ${f4(vMax)} says nothing about which list is better. Cosine similarity is between −1 and 1; a BM25 score has no fixed top and grows with rare words and longer queries. Keyword would "win" on most queries, including ones it gets wrong.`, false)
          : kit.feedback("Reading every repair with a model on every search is slow and costs money as the log grows. That kind of careful reading is useful later, on the few rows already found (the next lesson). Merging two lists needs something cheap.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 4. By hand: apply the branch filter to both lists ---------- */
  function filterRows({ el, done, kit }) {
    style();
    const L = { k: ids(KW.rattle), v: ids(VEC.rattle) };
    const want = { k: onlyBranch(L.k, ASKER), v: onlyBranch(L.v, ASKER) };
    const kept = { k: [], v: [] };
    const total = want.k.length + want.v.length;
    let msg = null;
    const finished = () => kept.k.length === want.k.length && kept.v.length === want.v.length;
    const col = (key, title) => `<div class="${P}list"><p>${title}</p>${L[key].map((id, i) => {
      const n = kept[key].indexOf(id), fin = finished();
      const cls = n >= 0 ? P + "ok" : fin ? P + "gone" : msg && msg.at === key + ":" + id ? P + "bad" : "";
      return `<button type="button" class="${P}mini ${cls}" data-i="${key}:${id}" ${fin ? "disabled" : ""}><span class="${P}rk">${i + 1}</span><b>${id}</b><span class="${P}br">${BRANCH[id]}</span>${n >= 0 ? `<span class="${P}nr">→ ${n + 1}</span>` : ""}</button>`;
    }).join("")}</div>`;
    const paint = () => {
      const fin = finished();
      const r01 = { k: [rankIn(L.k, "R01"), rankIn(want.k, "R01")], v: [rankIn(L.v, "R01"), rankIn(want.v, "R01")] };
      const missing = want.v.filter(id => !want.k.includes(id));
      el.innerHTML = `<h1>Only ${ASKER}'s repairs</h1>
        <p class="lead">The clerk is at ${ASKER} and wants ${ASKER}'s repairs only. Each repair in the log carries its branch as <b>metadata</b>: a field stored next to the text, not part of what is searched. A <b>filter</b> keeps the rows whose field matches. Here are the two full lists for the customer's words.</p>
        <p class="task">In each list, tap the ${ASKER} rows from the top down. Each gets its new rank, counted among ${ASKER} rows only.</p>
        <div class="${P}two">${col("k", "Keyword, all " + L.k.length)}${col("v", "Vector, all " + L.v.length)}</div>
        <div class="lpanel">${fin ? kit.feedback(`Done. The keyword list went from ${L.k.length} rows to ${want.k.length}, the vector list from ${L.v.length} to ${want.v.length}. R01 moved from ${ORD[r01.k[0]]} to ${ORD[r01.k[1]]} in the keyword list and from ${ORD[r01.v[0]]} to ${ORD[r01.v[1]]} in the vector list. ${missing.map(esc).join(", ")} ${missing.length === 1 ? "is" : "are"} only in the vector list: ${missing.length === 1 ? "it shares" : "they share"} no word with the query, so the keyword search never returned ${missing.length === 1 ? "it" : "them"}. This is the same as searching only ${ASKER}'s rows in the first place, which is what a filter inside the search does. Screen 7 shows what goes wrong when it is done another way.`, true)
          : msg ? kit.feedback(msg.text, msg.ok) : kit.feedback(`${kept.k.length + kept.v.length} of ${total} ${ASKER} rows tapped.`)}</div>`;
      el.querySelectorAll(`.${P}mini`).forEach(b => b.onclick = () => {
        if (finished()) return;
        const [key, id] = b.dataset.i.split(":");
        const name = key === "k" ? "keyword" : "vector";
        if (kept[key].includes(id)) { msg = { text: `${id} already has its new rank, ${kept[key].indexOf(id) + 1}.` }; paint(); return; }
        if (BRANCH[id] !== ASKER) { msg = { at: key + ":" + id, ok: false, text: `${id} is a ${BRANCH[id]} repair. The filter drops it, so it gets no rank at all. Tap only ${ASKER} rows.` }; paint(); return; }
        const next = want[key][kept[key].length];
        if (id !== next) { msg = { at: key + ":" + id, ok: false, text: `${id} is a ${ASKER} repair, but ${next} sits higher in the ${name} list and is ${ASKER} too. Go from the top down: the new rank is the position among ${ASKER} rows, so ${next} comes first.` }; paint(); return; }
        kept[key].push(id);
        msg = { text: `${id} is ${ORD[L[key].indexOf(id) + 1]} in the full ${name} list and ${ORD[kept[key].length]} among ${ASKER} rows. ${kept.k.length + kept.v.length} of ${total} tapped.` };
        paint();
        if (finished()) done();
      });
    };
    paint();
  }

  /* ---------- 5. By hand: fuse the filtered lists and predict the new top three ---------- */
  function fusePredict({ el, done, kit }) {
    style();
    const S = Object.fromEntries(FUSED_H);
    const share = r => r ? 1 / (K + r) : 0;
    const sumTxt = id => { const a = rankIn(KW_H, id), b = rankIn(VEC_H, id); return [a ? `1/${K + a}` : null, b ? `1/${K + b}` : null].filter(Boolean).join(" + ") + ` = ${f6(S[id])}`; };
    const onlyOne = HARBOUR.filter(id => !KW_H.includes(id) || !VEC_H.includes(id));
    const twoShareMin = Math.min(...FUSED_H.filter(([id]) => KW_H.includes(id) && VEC_H.includes(id)).map(r => r[1]));
    // serial query across all branches, fused the same way
    const serialF = rrf([ids(KW.serial), ids(VEC.serial)]);
    let picks = [], fin = false;
    const verdict = () => {
      const p = picks;
      const single = p.find(id => onlyOne.includes(id));
      if (single) return `${single} is ${ORD[rankIn(VEC_H, single)]} in the vector list but missing from the keyword list, so it gets one share only: ${sumTxt(single)}. Every repair in both lists has two shares, and the smallest two-share total is ${f6(twoShareMin)}.`;
      if ([...p].sort().join() === [...TOP3].sort().join()) return `You have the right three, but not in the right order. ${TOP3.map(id => `${id}: ${sumTxt(id)}`).join("; ")}. ${TOP3[0]} and ${TOP3[1]} each have one 1st place; the other rank decides, and ${TOP3[0]}'s is better.`;
      const out = p.find(id => !TOP3.includes(id)), inn = TOP3.find(id => !p.includes(id));
      return `${out}: ${sumTxt(out)}. ${inn}: ${sumTxt(inn)}. ${inn} ranks higher in both lists, so it beats ${out}.`;
    };
    const paint = () => {
      const tried = picks.length === 3 && !fin;
      el.innerHTML = `<h1>Fuse and predict</h1>
        <p class="lead">These are the two ${ASKER} lists you just made. Now fuse them with RRF.</p>
        <div class="${P}formula">score = 1/(${K} + keyword rank) + 1/(${K} + vector rank)<br>missing from a list: nothing from that list</div>
        <div class="${P}two">
          <div class="${P}list"><p>Keyword, ${ASKER}</p>${KW_H.map((id, i) => row(i + 1, id, null, { text: false, branch: false })).join("")}</div>
          <div class="${P}list"><p>Vector, ${ASKER}</p>${VEC_H.map((id, i) => row(i + 1, id, null, { text: false, branch: false })).join("")}</div>
        </div>
        <p class="task">Predict the fused top three. Tap three repairs, best first.</p>
        <div class="lpanel">${fin ? "" : kit.options(HARBOUR.map(id => picks.includes(id) ? `${id} (#${picks.indexOf(id) + 1})` : id), { correct: HARBOUR.indexOf(TOP3[picks.length] || TOP3[0]) }).replace(/<button/g, tried ? "<button disabled" : "<button")}
          <p class="${P}picked">Your order: ${picks.length ? picks.join(" → ") : "–"}</p>
          ${tried ? kit.feedback(verdict(), false) + `<div class="lsteps"><button type="button" class="btn" data-reset>Clear and try again</button></div>` : ""}
          ${fin ? kit.feedback(`Right: ${TOP3.join(", ")}. ${TOP3[0]}, the fret buzz repair, comes first because it is near the top of both lists. ${TOP3[1]}, the silent neck pickup, is second: the keyword search liked it a lot and the vector search put it ${ORD[rankIn(VEC_H, TOP3[1])]}. Fusion is a vote, not a judge. It cannot tell that ${TOP3[1]} is about a different problem; it only sees two good ranks.`, true)
            + `<table class="ltable ${P}scores"><caption>fused, ${ASKER} only</caption><thead><tr><th>repair</th><th>keyword rank</th><th>vector rank</th><th>score</th></tr></thead><tbody>${FUSED_H.map(([id, s], i) => `<tr class="${i < 3 ? "hit" : ""}"><td>${id}</td><td>${rankIn(KW_H, id) || "–"}</td><td>${rankIn(VEC_H, id) || "–"}</td><td>${f6(s)}</td></tr>`).join("")}</tbody></table>`
            + kit.feedback(`The serial number query, fused the same way across all ${word(NR)} repairs, puts ${serialF[0][0]} first with ${f6(serialF[0][1])}, against ${f6(serialF[1][1])} for ${serialF[1][0]}, the bass the vector search had ranked 1st. One merged list now handles both kinds of query.`) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const id = HARBOUR[+b.dataset.i];
        if (picks.includes(id) || picks.length === 3) return;
        picks.push(id);
        if (picks.length === 3 && picks.join() === TOP3.join()) { fin = true; paint(); done(); return; }
        paint();
      });
      const rs = el.querySelector("[data-reset]");
      if (rs) rs.onclick = () => { picks = []; paint(); };
    };
    paint();
  }

  /* ---------- 6. From scratch in Python: the traced fuse() ---------- */
  // runs/s5a-hybrid-search/search.py, fuse, line for line (line 0 = the def line)
  const CODE = [
    "def fuse(keyword_ranking, vector_ranking, k=60):",
    "    fused = {}",
    "    for ranking in (keyword_ranking, vector_ranking):",
    "        for rank, repair_id in enumerate(ranking, start=1):",
    "            fused[repair_id] = fused.get(repair_id, 0) + 1 / (k + rank)",
    "    return sorted(fused, key=fused.get, reverse=True)"
  ];
  /* search.out.txt, "trace of fuse(...)" for the customer's words, Harbour only: the step before line 1, every step
     about to run line 4, and the return (whole steps cut, none altered). [line, event, rank, repair_id, fused] */
  const TRACE = [[1,"l",null,null,null],[4,"l",1,"R10",{}],[4,"l",2,"R01",{"R10":0.016393}],[4,"l",3,"R11",{"R10":0.016393,"R01":0.016129}],[4,"l",4,"R07",{"R10":0.016393,"R01":0.016129,"R11":0.015873}],[4,"l",5,"R04",{"R10":0.016393,"R01":0.016129,"R11":0.015873,"R07":0.015625}],[4,"l",1,"R01",{"R10":0.016393,"R01":0.016129,"R11":0.015873,"R07":0.015625,"R04":0.015385}],[4,"l",2,"R13",{"R10":0.016393,"R01":0.032522,"R11":0.015873,"R07":0.015625,"R04":0.015385}],[4,"l",3,"R10",{"R10":0.016393,"R01":0.032522,"R11":0.015873,"R07":0.015625,"R04":0.015385,"R13":0.016129}],[4,"l",4,"R11",{"R10":0.032266,"R01":0.032522,"R11":0.015873,"R07":0.015625,"R04":0.015385,"R13":0.016129}],[4,"l",5,"R07",{"R10":0.032266,"R01":0.032522,"R11":0.031498,"R07":0.015625,"R04":0.015385,"R13":0.016129}],[4,"l",6,"R04",{"R10":0.032266,"R01":0.032522,"R11":0.031498,"R07":0.03101,"R04":0.015385,"R13":0.016129}],[5,"r",6,"R04",{"R10":0.032266,"R01":0.032522,"R11":0.031498,"R07":0.03101,"R04":0.030536,"R13":0.016129}]];
  const TRACE_RESULT = ["R01", "R10", "R11", "R07", "R04", "R13"]; // search.out.txt: "result: [...]"
  const NKW = KW_H.length;
  const GATE = TRACE.findIndex(t => t[1] === "l" && t[3] === "R01" && t[4] && t[4].R01 != null); // R01's second share
  function fuseCode({ el, done, kit }) {
    style();
    let i = 0, pred = null;
    const g = TRACE[GATE], before = g[4].R01, add = 1 / (K + g[2]);
    const popts = [f6(add), f6(before), f6(before + add)];
    const pc = 2;
    const say = (t, j) => {
      const [line, ev, rank, id, fused] = t;
      if (line === 1) return `<code>fused</code> is about to be made: an empty dict, repair id → score. A Python dict works like a JS object here. The two inputs are the ${ASKER} lists from screen 4.`;
      if (ev === "r") return `Both loops are done. <code>sorted(fused, key=fused.get, reverse=True)</code> returns the ids by score, highest first: [${TRACE_RESULT.join(", ")}]. The first three are the ones you predicted on screen 5. R13 is last: it has only one share.`;
      const list = j <= NKW ? "keyword" : "vector";
      const had = fused[id];
      return `${cap(list)} list, rank ${rank}: the marked line is about to add 1/(${K} + ${rank}) = ${f6(1 / (K + rank))} to ${id}. ${had == null ? `${id} is not in <code>fused</code> yet, so <code>fused.get(${id}, 0)</code> gives 0.` : `${id} already has ${f6(had)} from the keyword list; this adds its second share.`}${rank === 1 && list === "keyword" ? " <code>enumerate(..., start=1)</code> counts ranks from 1, as in the paper." : ""}`;
    };
    const paint = () => {
      const t = TRACE[i], fused = t[4] || {}, gated = i === GATE && pred !== pc;
      const rows = Object.entries(fused).map(([id, v]) => [id, f6(v)]);
      const hit = t[3] && t[1] === "l" ? Object.keys(fused).indexOf(t[3]) : -1;
      el.innerHTML = `<h1>The same fusion in Python</h1>
        <p class="lead">This is the function that fused the two lists. It ran on this Mac in plain Python; each step below replays that run. The marked line runs next, and the table shows <code>fused</code> as it is at that moment. Only the steps about to add a share are shown; the loop lines in between are skipped.</p>
        <p class="task">Step through to the end. One step asks you to predict first.</p>
        ${codeBox(CODE, t[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || gated ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>ranking <b>${t[2] == null ? "–" : i <= NKW ? "keyword" : "vector"}</b></span><span>rank <b>${t[2] == null ? "–" : t[2]}</b></span><span>repair_id <b>${t[3] || "–"}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say(t, i))}
        ${i === GATE ? `<div class="lcase" id="pt"><p>Predict: after the marked line runs, what will <code>fused["R01"]</code> be?</p>${kit.options(popts, { picked: pred, correct: pc, num: true })}
          ${pred == null ? "" : pred === pc ? kit.feedback(`Right: ${f6(before)} + ${f6(add)}. The second list adds to what the first list gave. Press Next step.`, true)
            : pred === 0 ? kit.feedback(`That is only the new share, 1/${K + g[2]}, as if the line replaced the old value. <code>fused.get(repair_id, 0) +</code> reads what R01 already has and adds to it.`, false)
            : kit.feedback(`That is R01's value before this line. The marked line runs for every repair in the second list too, so R01 gets a second share now.`, false)}</div>` : ""}
        ${kit.table(rows, { head: ["repair_id", "fused score"], title: "fused", hit, empty: "not made yet" })}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { if (i === GATE && pred !== pc) return; i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll("#pt .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* ---------- 7. Broken on purpose: the filter runs after the top 3 are cut ---------- */
  // runs/s5a-hybrid-search/search.py, hybrid_search_broken and hybrid_search, line for line
  const BROKEN = [
    "def hybrid_search_broken(query, branch, top=3):",
    "    keyword_ranking = keyword_search(query)",
    "    vector_ranking = vector_search(query)",
    "    best = fuse(keyword_ranking, vector_ranking)[:top]",
    "    return [r for r in best if branch_of[r] == branch]"
  ];
  const FIXED = [
    "def hybrid_search(query, branch, top=3):",
    "    allowed = {r for r in ids if branch_of[r] == branch}",
    "    keyword_ranking = [r for r in keyword_search(query) if r in allowed]",
    "    vector_ranking = [r for r in vector_search(query) if r in allowed]",
    "    return fuse(keyword_ranking, vector_ranking)[:top]"
  ];
  function broken({ el, done, kit }) {
    style();
    const B = "Riverside";
    const all3 = rrf([ids(KW.rattle), ids(VEC.rattle)]).slice(0, 3).map(r => r[0]);
    const r03v = rankIn(ids(VEC.rattle), "R03");
    const tie = (() => { const f = rrf([onlyBranch(ids(KW.rattle), B), onlyBranch(ids(VEC.rattle), B)]); return f[0][1] === f[1][1] ? [f[0][0], f[1][0]] : null; })();
    const ans = [null, null], correct = [1, 2];
    const Q0 = [
      `The vector search cannot find ${B}'s repairs.`,
      `The best = ... line keeps the top 3 of all branches (${all3.join(", ")}), then the return line removes every one of them: none is a ${B} repair.`,
      `${B} has no repair about this problem.`,
      `k = ${K} is too large for a log of ${NR} repairs.`
    ];
    const W0 = [
      `The vector search ranked R03, a ${B} fret buzz repair, ${ORD[r03v]} of all ${NR}. The search found it; the row was thrown away later.`, null,
      `R03 is a fret buzz repair at ${B}: "${esc(TEXT.R03.split(". ")[1])}".`,
      `k only spaces out the shares. It never removes a row: every repair in either list gets a score.`];
    const Q1 = [
      "Keep the filter at the end, but raise top from 3 to 10.",
      "Drop the filter and show the clerk all branches.",
      "Filter each list to the branch before fusing, so every rank is counted among that branch's rows."
    ];
    const W1 = [
      `Our run with top=10 did return ${pyList(OUT.brokenRiverside10)} for ${B}. But that only moves the problem. A branch whose rows all sit below 10th still gets nothing. And the number of rows a clerk gets changes from branch to branch. At top=3, Northgate got ${pyList(OUT.brokenNorthgate)}: one row instead of three.`,
      `Then the ${B} clerk sees other branches' repairs first, mostly instruments that are not in the shop. The filter was there for a reason; it is just in the wrong place.`, null];
    const paint = () => {
      const ok0 = ans[0] === correct[0], ok1 = ans[1] === correct[1];
      el.innerHTML = `<h1>Broken on purpose: an empty list</h1>
        <p class="lead">Now the ${B} clerk types the same customer words. A teammate wrote this version of the search (we named it <code>hybrid_search_broken</code> so you can tell it apart). We ran it on this Mac, on the same log:</p>
        ${codeBox(BROKEN, -1)}
        <div class="${P}out"><b>call</b>hybrid_search_broken("${esc(RATTLE_Q)}", "${B}")<br><br><b>returned</b>${pyList(OUT.brokenRiverside)}</div>
        <p class="lead" style="margin-top:14px">Yet ${B} has R03: "${esc(TEXT.R03)}"</p>
        <div class="lcase" id="c0"><p>Why is the list empty?</p>${kit.options(Q0, { picked: ans[0], correct: correct[0] })}
          ${ans[0] == null ? "" : ok0 ? kit.feedback(`Right. The filter runs after the cut. The <code>[:top]</code> cut already threw away everything below 3rd place, and the 3 rows left were all from other branches. This is called <b>post-filtering</b>. It also explains a quieter symptom: for Northgate the same code returned ${pyList(OUT.brokenNorthgate)}, one row instead of three.`, true) : kit.feedback(W0[ans[0]], false)}</div>
        ${ok0 ? `<div class="lcase" id="c1"><p>Which fix makes the search right for every branch?</p>${kit.options(Q1, { picked: ans[1], correct: correct[1] })}
          ${ans[1] == null ? "" : ok1 ? kit.feedback(`Right. This is <b>pre-filtering</b>: the filter is part of each search, as you did by hand on screen 4.`, true) + codeBox(FIXED, -1)
              + `<div class="${P}out"><b>hybrid_search(same query, "${B}") returned</b>${pyList(OUT.fixedRiverside)}</div>`
              + kit.feedback(`R03 is back. ${tie ? `${tie[0]} and ${tie[1]} tie exactly here: 1st and 2nd in one list, 2nd and 1st in the other. Python's sort keeps the one it saw first. Ties and near-ties in the top few are one reason to add a reranker: a step that rereads the top few rows (next lesson).` : ""} Search engines offer the same choice. In Elasticsearch, a filter inside the vector query is applied during the search, so you get the number of matches you asked for. A filter applied after that step can return fewer.`)
            : kit.feedback(W1[ans[1]], false)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === correct[0] && ans[1] === correct[1]) done();
      }));
    };
    paint();
  }

  /* ---------- 8. The big picture ---------- */
  const PICK = ["Keyword search alone", "Vector search alone", "Hybrid search with a filter"];
  const BIG = [
    ["A warehouse app where staff only ever scan or type exact part codes.", 0,
      ["", "A part code has no meaning for an embedding model to use: you saw a serial number come back wrong. Every query here is an exact string.", "Nobody types descriptions here, so the vector half only adds an index to keep and a second search per query. Keyword search, or a plain lookup by code, does the job."]],
    ["An IT help desk where agents paste error codes like 0x80070005 and also type what the user saw, such as \"laptop will not wake up\". Each agent sees only their own region's tickets.", 2,
      ["Keyword search handles the pasted codes but misses \"will not wake up\" when a ticket says \"stuck on a black screen after sleep\".", "Vector search handles the descriptions but treats error codes as near-meaningless strings, like the serial number. And the region limit needs a filter.", ""]],
    ["A short-story site where readers describe a plot or a mood, such as \"two old friends meet after a war\", and never type titles or codes.", 1,
      ["Readers use their own words, not the stories' words, like the customer on screen 2. Keyword search would rank stories that share small words.", "", "Hybrid would still work, but the keyword half adds a second index and little else: readers never type the exact rare words it is good at. On screen 5 it even pulled a wrong repair up."]]
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for hybrid search</h1>
        <p class="lead"><b>What it is for:</b> one search box where people type both exact strings (serial numbers, part codes, names, error codes) and descriptions in their own words, often limited by a field such as branch, customer or date.</p>
        <p class="lead"><b>When not:</b> if every query is an exact code, use keyword search or a plain database lookup. If queries never contain rare exact words and a good embedding model already does well, vector search alone is simpler. A weak second list can push a wrong row up, as the keyword list did with R10 on screen 5.</p>
        <p class="lead"><b>What it costs:</b> two indexes to build and keep in sync, two searches on every query, metadata stored on every row, and more parts to test when results look wrong.</p>
        <p class="task">For each situation, pick the search you would build.</p>
        ${BIG.map(([q, r, why], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(PICK, { picked: ans[i], correct: r })}${ans[i] == null ? "" : ans[i] === r ? kit.feedback(["Right. Exact strings only: keyword search, or a lookup by code. Nothing to understand, only to match.", "Right. Codes for keyword search, descriptions for vector search, a filter for the region, all fused into one list.", "Right. Meaning does the work here; a second index would add cost and little else."][r], true) : kit.feedback(why[ans[i]], false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* ---------- 9. Recognise it in new situations ---------- */
  const CASES = [
    ["A pharmacy chain's staff search their product notes. They type exact drug names and also things like \"something for a dry cough at night\", and should see only what their own store stocks.", true,
      "Yes. Drug names are rare exact words, which keyword search matches. \"Dry cough at night\" needs meaning. And the store limit is a filter that must run inside each search.",
      "Two kinds of query share one box: exact drug names (keyword search) and plain descriptions (vector search). The store limit is metadata, filtered inside each search before fusing."],
    ["A courier's customer types a tracking number to see where a parcel is.", false,
      "No. There is exactly one right row, found by its key. A database lookup by tracking number returns it. Ranking adds nothing, and a fused list could even show near-miss numbers below it.",
      "This is not a search for the best matches. One parcel has this tracking number, and a database lookup by that key finds it. A ranked list, fused or not, would add near-miss parcels and nothing useful."],
    ["A manager wants to know how many repairs each branch did last month.", false,
      "No. That is counting, not finding: a query that groups the log by branch and counts the rows. Search ranks rows by how well they match; it does not count them.",
      "No query text is matched here at all. The answer is a count per branch, which a database query that groups and counts gives directly. Search returns ranked rows, not totals."],
    ["A university library: students type exact course codes like ECON 201 and also \"a book that explains supply and demand simply\", and see only books held at their own campus.", true,
      "Yes. Course codes are exact strings for keyword search, the plain request needs meaning, and the campus is a metadata filter.",
      "Both kinds of query again: a course code (keyword search wins, as with the serial number) and a plain description (vector search wins). The campus limit is a filter inside each search."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would hybrid search help here?</h1>
        <p class="lead">${cap(word(CASES.length))} situations, no repair log. Hybrid search here means: a keyword search and a vector search, each filtered by metadata, fused into one list.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* ---------- 10. What next ---------- */
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can merge and filter searches</h1>
      <p class="lead">You saw keyword search win the serial number and vector search win the customer's words. You merged both lists by rank with RRF, filtered by branch inside each search, and found the bug that filters too late.</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>fuse()</code> and a <code>hybrid_search()</code> that filters each list to the branch before fusing, and test it on this repair log.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. It starts from the fused top few, where a wrong repair like R10 can still sit 2nd, and reorders them by reading each one together with the query.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Hybrid search: keywords, meaning and filters",
    checked: "2026-11-13",
    sources: [
      "https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf",
      "https://lucene.apache.org/core/9_12_0/core/org/apache/lucene/search/similarities/BM25Similarity.html",
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/rrf-retriever",
      "https://www.elastic.co/docs/solutions/search/vector/knn/filtered-knn-search",
      "https://docs.ollama.com/capabilities/embeddings",
      "https://ollama.com/library/all-minilm"
    ],
    interview: [
      {
        q: "Users of your RAG app search a product catalogue both by exact model numbers and by plain descriptions. The vector search handles descriptions well but often misses model numbers. What do you change?",
        good: [
          "Add a keyword index (BM25) next to the vector index: rare exact strings like model numbers are what it matches best.",
          "Run both searches and merge the lists with reciprocal rank fusion: it uses ranks, so the two kinds of score never need to be on one scale.",
          "Do not add raw scores: BM25 and cosine are on different scales and the bigger one drowns the other.",
          "Measure it on a small test set with both kinds of query, and check the top few, not only the first result.",
          "Name the cost: two indexes to keep in step and two searches per query; consider a reranker on the fused top few."
        ],
        weak: "Switch to a bigger embedding model. It misses that a model number has no meaning to embed, so a better meaning model does not fix exact matching."
      },
      {
        q: "After you add a per-customer filter to hybrid search, small customers often get empty or short result lists, although matching documents exist. What is going on, and how do you fix it?",
        good: [
          "The filter probably runs after the top k were cut (post-filtering), so the top k came from other customers and the filter removed them all.",
          "Move the filter into each search (pre-filtering), so ranks are counted among that customer's documents only, then fuse.",
          "Check it with a test: a small customer whose matching document ranks low across all customers.",
          "Raising k only hides it: it moves the cliff and returns a different number of results per customer."
        ],
        weak: "Raise k until the lists fill up. It does not fix the order of the steps and still fails for a customer whose rows all rank below k."
      }
    ],
    screens: [serialMiss, wordsMiss, spotIdea, filterRows, fusePredict, fuseCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="R05"]'], right: ['[data-i="R01"]'] },
      { wrong: ['[data-i="R10"]'], right: ['[data-i="R01"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="k:R05"]'], right: [...KW_H.map(id => `[data-i="k:${id}"]`), ...VEC_H.map(id => `[data-i="v:${id}"]`)] },
      { wrong: ['.lopts button[data-i="' + HARBOUR.indexOf("R13") + '"]', '.lopts button[data-i="' + HARBOUR.indexOf(TOP3[0]) + '"]', '.lopts button[data-i="' + HARBOUR.indexOf(TOP3[1]) + '"]'],
        right: ["[data-reset]", ...TOP3.map(id => '.lopts button[data-i="' + HARBOUR.indexOf(id) + '"]')] },
      { wrong: [...Array(GATE).fill("[data-next]"), "#pt [data-wrong]"], right: ["#pt [data-right]", ...Array(TRACE.length - 1 - GATE).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
