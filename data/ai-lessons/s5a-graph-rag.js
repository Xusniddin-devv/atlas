/* Lesson: graph-based RAG, entities and relations. A film festival programme office asks which venues screen
   films by directors from last year's (2025) jury. Plain vector search returns three chunks that cannot answer
   it; a small model extracts facts (subject | relation | object) from all twelve programme chunks once, the
   learner connects them into a graph, answers by following edges hop by hop, meets a fact the model missed,
   reads the same walk in Python, then judges when a graph is worth its cost.
   Data:
   - programme chunks: docs/ai-path/runs/s5a-graph-rag/programme.json (written by hand for this lesson)
   - vector ranking: docs/ai-path/runs/s5a-graph-rag/retrieve.py -> retrieve.out.txt (local all-minilm via Ollama)
   - recordings (main checkout): docs/ai-path/recordings/s5a-graph-rag/vector-answer, extract, graph-answer
   - graph build and traced walk: docs/ai-path/runs/s5a-graph-rag/graph.py -> graph.out.txt
   Every number on screen is computed here from those copied texts. Plain browser script. */
(() => {
  const ID = "s5a-graph-rag", P = `lx-${ID}-`;

  /* ---------- material, copied from runs and recordings ---------- */
  // From docs/ai-path/runs/s5a-graph-rag/programme.json (hand-written programme notes, one entry per chunk)
  const CHUNKS = {
    "jury-2025": "The 2025 jury. Last year's competition jury had four members: the directors Ana Duarte, Tomas Lindqvist and Kenji Arai, and the actor Mira Okafor. They watched all twelve competition films in five days.",
    "jury-2024": "The 2024 jury was chaired by the director Lena Brook. It met in the old council chamber because the main hall was being repaired.",
    "film-salt-roads": "Salt Roads. Directed by Ana Duarte. A fishing family walks the coast road to sell the last of the winter catch. 96 minutes, Portuguese with English subtitles.",
    "film-long-thaw": "The Long Thaw. Directed by Ana Duarte. Two sisters wait out the spring melt in a mountain hut. 104 minutes.",
    "film-north-of-nine": "North of Nine. Directed by Tomas Lindqvist. A night-shift taxi driver keeps meeting the same passenger. 88 minutes, Swedish with English subtitles.",
    "film-paper-kites": "Paper Kites. Directed by Kenji Arai. A retired teacher builds kites with the children of his street. 92 minutes, Japanese with English subtitles.",
    "film-ember-street": "Ember Street. Directed by Lena Brook. Mira Okafor plays a fire inspector who returns to the town she grew up in. 110 minutes.",
    "film-glass-orchard": "Glass Orchard. Directed by Paul Mensah. A greenhouse keeper and his grandson save a dying apple tree. 79 minutes.",
    "venue-harbour-hall": "Harbour Hall, by the old pier, seats 420. This year it screens Salt Roads and Glass Orchard. Step-free entrance on the pier side.",
    "venue-rex": "Rex Cinema on Market Street seats 180. This year it screens The Long Thaw, North of Nine and Paper Kites. The bar opens an hour before the first film.",
    "venue-old-mill": "Old Mill, the arts centre in the former flour mill, seats 90. This year it screens North of Nine. Bring a cushion: the benches are wooden.",
    "venue-park-screen": "Park Screen is the free open-air screen in Riverside Park. This year it screens Ember Street and Glass Orchard, weather permitting."
  };
  const QUESTION = "Which venues screen films by directors from the 2025 jury?";
  // From docs/ai-path/runs/s5a-graph-rag/retrieve.out.txt: cosine similarity of each chunk to QUESTION, best first
  const RANKED = [["jury-2025",0.708],["jury-2024",0.561],["venue-rex",0.439],["film-north-of-nine",0.266],["film-ember-street",0.264],["film-paper-kites",0.255],["film-glass-orchard",0.252],["venue-harbour-hall",0.228],["venue-park-screen",0.219],["film-long-thaw",0.206],["venue-old-mill",0.185],["film-salt-roads",0.088]];
  const K = 3;
  // From docs/ai-path/recordings/s5a-graph-rag/vector-answer.json (not altered). Context: the top 3 chunks above.
  const REC_VECTOR = {
    src: "s5a-graph-rag/vector-answer",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "The programme notes do not state which venues screen films by directors from the 2025 jury."
  };
  // From docs/ai-path/recordings/s5a-graph-rag/extract.json (not altered). Input: all twelve chunks, relations fixed in the prompt.
  const REC_EXTRACT = {
    src: "s5a-graph-rag/extract",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "Ana Duarte | member_of | 2025 jury\nTomas Lindqvist | member_of | 2025 jury\nKenji Arai | member_of | 2025 jury\nMira Okafor | member_of | 2025 jury\nLena Brook | member_of | 2024 jury\nAna Duarte | directed | Salt Roads\nAna Duarte | directed | The Long Thaw\nTomas Lindqvist | directed | North of Nine\nKenji Arai | directed | Paper Kites\nLena Brook | directed | Ember Street\nMira Okafor | acted_in | Ember Street\nSalt Roads | screened_at | Harbour Hall\nGlass Orchard | screened_at | Harbour Hall\nThe Long Thaw | screened_at | Rex Cinema\nNorth of Nine | screened_at | Rex Cinema\nPaper Kites | screened_at | Rex Cinema\nNorth of Nine | screened_at | Old Mill\nEmber Street | screened_at | Park Screen\nGlass Orchard | screened_at | Park Screen"
  };
  // From docs/ai-path/recordings/s5a-graph-rag/graph-answer.json (not altered). Context: the facts on the walk's path.
  const REC_GRAPH = {
    src: "s5a-graph-rag/graph-answer",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "Rex Cinema, Old Mill, Harbour Hall"
  };
  // From docs/ai-path/runs/s5a-graph-rag/graph.out.txt (printed lines, not altered)
  const OUT_GRAPH = {
    nodes: 17,
    rex: "graph[\"Rex Cinema\"] = [('<-screened_at', 'The Long Thaw'), ('<-screened_at', 'North of Nine'), ('<-screened_at', 'Paper Kites')]",
    okafor: "graph[\"Mira Okafor\"] = [('member_of', '2025 jury'), ('acted_in', 'Ember Street')]",
    orchard: "graph[\"Glass Orchard\"] = [('screened_at', 'Harbour Hall'), ('screened_at', 'Park Screen')]",
    walk: "walk result: ['Harbour Hall', 'Old Mill', 'Rex Cinema']"
  };
  // From graph.out.txt: every traced step of walk(graph, "2025 jury", PATH) as [line, isReturn, rel, node, reached, frontier]
  const TRACE = [[1,0,null,null,null,null],[2,0,null,null,null,["2025 jury"]],[3,0,"<-member_of",null,null,["2025 jury"]],[4,0,"<-member_of",null,[],["2025 jury"]],[5,0,"<-member_of","2025 jury",[],["2025 jury"]],[4,0,"<-member_of","2025 jury",["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"],["2025 jury"]],[6,0,"<-member_of","2025 jury",["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"],["2025 jury"]],[2,0,"<-member_of","2025 jury",["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[3,0,"directed","2025 jury",["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[4,0,"directed","2025 jury",[],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[5,0,"directed","Ana Duarte",[],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[4,0,"directed","Ana Duarte",["Salt Roads","The Long Thaw"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[5,0,"directed","Kenji Arai",["Salt Roads","The Long Thaw"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[4,0,"directed","Kenji Arai",["Paper Kites","Salt Roads","The Long Thaw"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[5,0,"directed","Mira Okafor",["Paper Kites","Salt Roads","The Long Thaw"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[4,0,"directed","Mira Okafor",["Paper Kites","Salt Roads","The Long Thaw"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[5,0,"directed","Tomas Lindqvist",["Paper Kites","Salt Roads","The Long Thaw"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[4,0,"directed","Tomas Lindqvist",["North of Nine","Paper Kites","Salt Roads","The Long Thaw"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[6,0,"directed","Tomas Lindqvist",["North of Nine","Paper Kites","Salt Roads","The Long Thaw"],["Ana Duarte","Kenji Arai","Mira Okafor","Tomas Lindqvist"]],[2,0,"directed","Tomas Lindqvist",["North of Nine","Paper Kites","Salt Roads","The Long Thaw"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[3,0,"screened_at","Tomas Lindqvist",["North of Nine","Paper Kites","Salt Roads","The Long Thaw"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[4,0,"screened_at","Tomas Lindqvist",[],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[5,0,"screened_at","North of Nine",[],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[4,0,"screened_at","North of Nine",["Old Mill","Rex Cinema"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[5,0,"screened_at","Paper Kites",["Old Mill","Rex Cinema"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[4,0,"screened_at","Paper Kites",["Old Mill","Rex Cinema"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[5,0,"screened_at","Salt Roads",["Old Mill","Rex Cinema"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[4,0,"screened_at","Salt Roads",["Harbour Hall","Old Mill","Rex Cinema"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[5,0,"screened_at","The Long Thaw",["Harbour Hall","Old Mill","Rex Cinema"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[4,0,"screened_at","The Long Thaw",["Harbour Hall","Old Mill","Rex Cinema"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[6,0,"screened_at","The Long Thaw",["Harbour Hall","Old Mill","Rex Cinema"],["North of Nine","Paper Kites","Salt Roads","The Long Thaw"]],[2,0,"screened_at","The Long Thaw",["Harbour Hall","Old Mill","Rex Cinema"],["Harbour Hall","Old Mill","Rex Cinema"]],[7,0,"screened_at","The Long Thaw",["Harbour Hall","Old Mill","Rex Cinema"],["Harbour Hall","Old Mill","Rex Cinema"]],[7,1,"screened_at","The Long Thaw",["Harbour Hall","Old Mill","Rex Cinema"],["Harbour Hall","Old Mill","Rex Cinema"]]];

  /* ---------- derived data ---------- */
  const N_CHUNKS = Object.keys(CHUNKS).length;
  const FACTS = REC_EXTRACT.text.split("\n").map(l => l.split("|").map(s => s.trim()));
  const NF = FACTS.length;
  const COL_OF = { member_of: [1, 0], directed: [1, 2], acted_in: [1, 2], screened_at: [2, 3] };
  const COLS = [[], [], [], []], COL_NAME = ["Juries", "People", "Films", "Venues"], KIND = ["jury", "person", "film", "venue"];
  const colOf = new Map();
  FACTS.forEach(([s, r, o]) => { [[s, COL_OF[r][0]], [o, COL_OF[r][1]]].forEach(([n, c]) => { if (!colOf.has(n)) { colOf.set(n, c); COLS[c].push(n); } }); });
  const NODES = COLS.flat(), NI = new Map(NODES.map((n, i) => [n, i]));
  // the same adjacency as build_graph in graph.py: an edge in each direction, the reverse one marked "<-"
  const ADJ = new Map(NODES.map(n => [n, []]));
  FACTS.forEach(([s, r, o]) => { ADJ.get(s).push([r, o]); ADJ.get(o).push(["<-" + r, s]); });
  const neighbours = (node, rel) => [...new Set(ADJ.get(node).filter(([r]) => r === rel).map(([, o]) => o))].sort();
  // hops[0] = [start], hops[h] = nodes reached after h relations
  const walk = (start, path) => { const hops = [[start]]; path.forEach(rel => hops.push([...new Set(hops[hops.length - 1].flatMap(n => neighbours(n, rel)))].sort())); return hops; };
  // the facts used to go from hop h-1 to hop h
  const usedFacts = (hops, path) => path.flatMap((rel, h) => FACTS.map((f, i) => [f, i]).filter(([[s, r, o]]) => {
    const back = rel.startsWith("<-"), name = back ? rel.slice(2) : rel;
    return r === name && (back ? hops[h].includes(o) && hops[h + 1].includes(s) : hops[h].includes(s) && hops[h + 1].includes(o));
  }).map(([, i]) => i));
  const PATH1 = ["<-member_of", "directed", "screened_at"], START1 = "2025 jury";
  const HOPS1 = walk(START1, PATH1), USED1 = usedFacts(HOPS1, PATH1);
  const ANSWER1 = HOPS1[3];
  const PATH2 = ["<-screened_at", "<-directed", "member_of"], START2 = "Park Screen";
  const HOPS2 = walk(START2, PATH2), USED2 = usedFacts(HOPS2, PATH2);
  // chunks the answer depends on: for each fact on the path, the chunk that names both its ends
  const NEEDED = [...new Set(USED1.map(i => Object.keys(CHUNKS).find(id => CHUNKS[id].includes(FACTS[i][0].replace(/ jury$/, "")) && CHUNKS[id].includes(FACTS[i][2].replace(/ jury$/, "")))))];
  const rankOf = id => RANKED.findIndex(([c]) => c === id) + 1;
  const TOPK = RANKED.slice(0, K).map(([c]) => c);
  const WORST_NEEDED = Math.max(...NEEDED.map(rankOf));
  const VENUES_TOPK = TOPK.filter(c => c.startsWith("venue-")).length;
  const fmtList = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = n => WORDS[n] || String(n);
  const Cap = s => s[0].toUpperCase() + s.slice(1);
  const directorOf = film => FACTS.filter(([, r, o]) => r === "directed" && o === film).map(([s]) => s);
  // the film whose director the model did not write down, and the name its own chunk gives
  const ORPHAN = COLS[2].find(f => !directorOf(f).length);
  const ORPHAN_CHUNK = Object.keys(CHUNKS).find(id => id.startsWith("film-") && CHUNKS[id].startsWith(ORPHAN + "."));
  const ORPHAN_DIRECTOR = ORPHAN_CHUNK ? (CHUNKS[ORPHAN_CHUNK].match(/Directed by ([^.]+)\./) || [])[1] : "";

  /* ---------- local picture: the festival graph in four columns ---------- */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}g { margin: 18px 0 8px; }
.${P}heads { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; font: 700 12px var(--mono); color: var(--muted); margin-bottom: 6px; }
.${P}box { position: relative; }
.${P}box svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.${P}e { stroke: var(--muted); stroke-width: 1.2; fill: none; }
.${P}e.dash { stroke-dasharray: 5 4; }
.${P}e.hot { stroke: var(--good); stroke-width: 3; }
.${P}e.faint { stroke: var(--line); }
.${P}n { position: absolute; transform: translate(-50%, -50%); width: calc(25% - 16px); max-width: 150px; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; text-align: center; padding: 3px 4px; font: 600 12px/1.15 var(--font); color: var(--ink); background: var(--surface); border: 1px solid var(--ink-2); border-radius: 6px; margin: 0; }
button.${P}n { cursor: pointer; }
button.${P}n:hover { border-color: var(--ink); }
.${P}n.on { border: 2px solid var(--good); box-shadow: inset 0 0 0 60px var(--good-soft); }
.${P}n.no { border: 2px solid var(--bad); box-shadow: inset 0 0 0 60px var(--bad-soft); }
.${P}n.ring { outline: 3px solid var(--ink); outline-offset: 2px; }
.${P}n.gone { color: var(--faint); border-color: var(--line); }
.${P}key { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--muted); margin: 6px 0 4px; }
.${P}key span { display: inline-flex; align-items: center; gap: 6px; }
.${P}key svg { width: 26px; height: 10px; }
.${P}key i { display: inline-block; width: 18px; height: 14px; border-radius: 4px; border: 1px solid var(--ink-2); background: var(--surface); }
.${P}key i.on { border: 2px solid var(--good); background: var(--good-soft); }
.${P}key i.ring { outline: 3px solid var(--ink); outline-offset: 1px; }
.${P}code .lcode div { white-space: pre-wrap; }
.${P}rec { border-left: 3px solid var(--ink-2); background: var(--sunk); padding: 10px 12px; margin: 10px 0 4px; font: 14px/1.45 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}cap { font-size: 12px; color: var(--muted); margin: 0 0 12px; }
.${P}q { border: 1px solid var(--line); background: var(--sunk); padding: 10px 12px; margin: 12px 0; font-weight: 600; }
.${P}chunks { list-style: none; padding: 0; margin: 8px 0; }
.${P}chunks li { border-top: 1px solid var(--line); padding: 8px 0; font-size: 14px; }
.${P}chunks b { font: 700 12px var(--mono); color: var(--muted); display: block; }
.${P}facts { font: 13px/1.5 var(--mono); margin: 8px 0; padding: 0; list-style: none; }
.${P}facts li { padding: 1px 6px; border-left: 3px solid transparent; overflow-wrap: anywhere; }
.${P}facts li.cur { border-left-color: var(--ink); background: var(--sunk); font-weight: 700; }
.${P}facts li.done { color: var(--muted); }
.${P}prose p { margin: 0 0 10px; }
.${P}rec, .${P}facts, .${P}code .lcode, .${P}rec *, .${P}facts * { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
`;
    document.head.appendChild(s);
  }
  const ROWH = 60, MAXR = Math.max(...COLS.map(c => c.length)), GH = MAXR * ROWH;
  const pos = name => { const c = colOf.get(name), list = COLS[c], i = list.indexOf(name); return [(c + 0.5) * 25, (i + 0.5) * GH / list.length]; };
  /* gpic({ show: fact indices drawn, ncls: {name: "on"|"no"|"ring"|"gone" (space-separated)}, ecls: {factIndex: "hot"|"faint"}, pick: name => bool }) */
  function gpic(kit, { show = FACTS.map((_, i) => i), ncls = {}, ecls = {}, pick = () => false, title = "" } = {}) {
    const lines = show.map(i => {
      const [s, r, o] = FACTS[i], [x1, y1] = pos(s), [x2, y2] = pos(o);
      return `<line class="${P}e${r === "acted_in" ? " dash" : ""} ${ecls[i] || ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" vector-effect="non-scaling-stroke"/>`;
    }).join("");
    const boxes = NODES.map(n => {
      const [x, y] = pos(n), p = pick(n), tag = p ? "button" : "div";
      return `<${tag}${p ? ' type="button"' : ""} class="${P}n ${ncls[n] || ""}" data-i="${NI.get(n)}" style="left:${x}%;top:${y}px"${p ? ` aria-label="${kit.esc(n)}"` : ""}>${kit.esc(n)}</${tag}>`;
    }).join("");
    return `<div class="${P}g">${title ? `<div class="lp-cap">${kit.esc(title)}</div>` : ""}<div class="${P}heads">${COL_NAME.map(c => `<span>${c}</span>`).join("")}</div>
      <div class="${P}box" style="height:${GH}px"><svg viewBox="0 0 100 ${GH}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${boxes}</div></div>`;
  }
  const keyHtml = (extra = []) => `<div class="${P}key"><span><svg viewBox="0 0 26 10" aria-hidden="true"><line class="${P}e" x1="0" y1="5" x2="26" y2="5"/></svg>member_of, directed, screened_at</span><span><svg viewBox="0 0 26 10" aria-hidden="true"><line class="${P}e dash" x1="0" y1="5" x2="26" y2="5"/></svg>acted_in</span>${extra.map(([c, t]) => `<span><i class="${c}"></i>${t}</span>`).join("")}</div>`;
  const rec = (kit, text, label = "Recorded model output") => `<div class="${P}rec">${kit.esc(text)}</div><p class="${P}cap">${label}, ${REC_VECTOR.recordedAt}</p>`;
  const tapNode = (el, fn) => el.querySelectorAll(`button.${P}n`).forEach(b => b.onclick = () => fn(NODES[+b.dataset.i]));

  /* 1. The situation: plain vector search cannot answer a question that chains facts. */
  function situation({ el, done, kit }) {
    css();
    let ans = null;
    const top5 = RANKED.slice(0, 5).map(([c]) => c), miss5 = NEEDED.filter(c => !top5.includes(c));
    const filmsNeeded = NEEDED.filter(c => c.startsWith("film-"));
    const opts = [
      "The model is too small to link the facts.",
      `The chunks that link a juror to a film are not in the top ${K}. A film page does not sound like the question, so it ranks low.`,
      `The ${word(N_CHUNKS)} chunks do not hold the answer at all.`,
      `k is too small: return the top 5 instead of the top ${K} and it works.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>A question the search cannot answer</h1>
        <p class="lead">A film festival's programme office runs a bot over its programme notes: ${word(N_CHUNKS)} short chunks, one per jury, film and venue. Guests ask relationship questions. This one came in:</p>
        <div class="${P}q">${kit.esc(QUESTION)}</div>
        <p class="lead">The bot did plain vector search, as in the RAG pipeline you built: it embedded the question, ranked all ${word(N_CHUNKS)} chunks by similarity and sent the top ${K} to the model.</p>
        ${kit.table(RANKED.slice(0, K).map(([c, s], i) => [`${i + 1}. ${c}`, s.toFixed(3)]), { head: ["chunk", "similarity"], title: `Top ${K} of ${N_CHUNKS}` })}
        <ul class="${P}chunks">${TOPK.map(c => `<li><b>${kit.esc(c)}</b>${kit.esc(CHUNKS[c])}</li>`).join("")}</ul>
        <p class="lead">A small hosted model, given those ${word(K)} chunks, answered:</p>
        ${rec(kit, REC_VECTOR.text)}
        <p class="task">Why could the bot not answer?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. The answer needs ${word(NEEDED.length)} chunks: ${kit.esc(fmtList(NEEDED))}. The search scores each chunk by how close it is to the <i>question</i>, and a page like “Salt Roads. Directed by Ana Duarte…” says nothing about juries or venues. Here the film pages rank ${kit.esc(fmtList(filmsNeeded.map(rankOf).sort((a, b) => a - b).map(String)))} of ${N_CHUNKS}. The lowest-ranked needed chunk is number ${WORST_NEEDED}, so only k = ${WORST_NEEDED} would find them all. With ${N_CHUNKS} chunks that means sending everything. With an archive of thousands, you cannot.`, true)
          : ans === 0 ? kit.feedback(`Look at what it was given. The ${word(K)} chunks never say which films the jurors directed. No model can link facts it was not shown. This one said so instead of guessing, which is the good outcome.`, false)
          : ans === 2 ? kit.feedback(`They do hold it. The Salt Roads page says Ana Duarte directed it, and the Harbour Hall page says it screens Salt Roads. Together the ${word(N_CHUNKS)} chunks hold the whole answer. The top ${K} do not.`, false)
          : kit.feedback(`The top 5 adds ${kit.esc(fmtList(top5.slice(K)))}, and still misses ${kit.esc(fmtList(miss5))}. The needed chunks are spread down the ranking, as low as number ${WORST_NEEDED}. A bigger k only grows the pile. It does not follow the links.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. By hand: connect the extracted facts into a graph. */
  const PENDING = FACTS.map((f, i) => [f, i]).filter(([[, r]]) => r === "screened_at").map(([, i]) => i);
  function connect({ el, done, kit }) {
    css();
    let k = 0, miss = null;
    const paint = () => {
      const fin = k === PENDING.length, cur = fin ? -1 : PENDING[k];
      const shown = FACTS.map((_, i) => i).filter(i => !PENDING.includes(i) || PENDING.indexOf(i) < k);
      const ncls = {};
      if (!fin) ncls[FACTS[cur][0]] = "ring";
      if (miss) ncls[miss] = "no";
      el.innerHTML = `<h1>Turn the facts into a graph</h1>
        <p class="lead">The office tries another way. A small hosted model read all ${word(N_CHUNKS)} chunks once and wrote every fact it found as one line: <code>subject | relation | object</code>, using only the four relations the prompt allowed. It wrote ${NF} lines:</p>
        <ul class="${P}facts">${FACTS.map((f, i) => `<li class="${i === cur ? "cur" : shown.includes(i) ? "done" : ""}">${kit.esc(f.join(" | "))}</li>`).join("")}</ul>
        <p class="${P}cap">Recorded model output, ${REC_EXTRACT.recordedAt}</p>
        <p class="lead">Below, each name is a box and each fact is a line between two boxes. The first ${NF - PENDING.length} facts are already drawn.</p>
        ${fin ? "" : `<p class="task">Draw fact ${cur + 1}, <b>${kit.esc(FACTS[cur].join(" | "))}</b>: its subject is ringed. Tap the box it connects to.</p>`}
        ${gpic(kit, { show: shown, ncls, pick: n => !fin && n !== FACTS[cur][0] })}
        ${keyHtml([["ring", "subject of the fact"]])}
        <div class="lpanel">${fin ? kit.feedback(`All ${NF} facts are drawn. You built a <b>knowledge graph</b>: each thing (a jury, person, film or venue) is a box called a <b>node</b> or <b>entity</b>, and each fact is a line between two nodes called an <b>edge</b> or <b>relation</b>. ${NODES.length} nodes, ${NF} edges. The film summaries, seat counts and bar times are gone: the graph keeps only the links.`, true)
          : miss ? kit.feedback(colOf.get(miss) !== 3 ? `${kit.esc(miss)} is a ${KIND[colOf.get(miss)]}. A <code>screened_at</code> line goes from a film to a venue, so it ends in the Venues column.` : `That is ${kit.esc(miss)}. Read the line again: it ends with <b>${kit.esc(FACTS[cur][2])}</b>.`, false)
          : k ? kit.feedback(`Fact ${PENDING[k - 1] + 1} drawn: ${kit.esc(FACTS[PENDING[k - 1]][0])} to ${kit.esc(FACTS[PENDING[k - 1]][2])}.`) : ""}</div>`;
      tapNode(el, n => {
        if (k === PENDING.length) return;
        if (n === FACTS[PENDING[k]][2]) { k++; miss = null; paint(); if (k === PENDING.length) done(); }
        else { miss = n; paint(); }
      });
    };
    paint();
  }

  /* 3. By hand: answer the question by following edges, one hop at a time. */
  const HOP_TASK = [
    `Hop 1: tap every person whose <code>member_of</code> line goes into the <b>2025 jury</b>.`,
    `Hop 2: tap every film one of those people <b>directed</b>.`,
    `Hop 3: tap every venue that screens one of those films.`
  ];
  function walkByHand({ el, done, kit }) {
    css();
    let h = 0, miss = null;
    const picked = new Set();
    const why = n => {
      const c = colOf.get(n), prev = HOPS1[h];
      if (h === 0) {
        const j = FACTS.find(([s, r]) => s === n && r === "member_of");
        return j ? `${kit.esc(n)}'s <code>member_of</code> line goes to the ${kit.esc(j[2])}, not the 2025 jury.` : `This hop starts at the 2025 jury node and follows its <code>member_of</code> lines to people. ${kit.esc(n)} is a ${KIND[c]}.`;
      }
      if (h === 1) {
        if (c !== 2) return `This hop goes from the ${word(prev.length)} jurors to films. ${kit.esc(n)} is a ${KIND[c]}.`;
        const actor = FACTS.find(([s, r, o]) => r === "acted_in" && o === n && prev.includes(s));
        if (actor) return `${kit.esc(actor[0])} acted in ${kit.esc(n)}: the dashed line is <code>acted_in</code>. The question asks for films <i>by directors</i>, so follow <code>directed</code> lines only. ${kit.esc(n)} was directed by ${kit.esc(fmtList(directorOf(n)))}, who sat on the 2024 jury.`;
        const d = directorOf(n);
        return d.length ? `${kit.esc(n)} was directed by ${kit.esc(fmtList(d))}, who is not on the 2025 jury.` : `No <code>directed</code> line reaches ${kit.esc(n)} at all, so no juror connects to it.`;
      }
      if (c !== 3) return `This hop goes from the ${word(prev.length)} films to venues. ${kit.esc(n)} is a ${KIND[c]}.`;
      return `${kit.esc(n)} screens ${kit.esc(fmtList(neighbours(n, "<-screened_at")))}. None of them was reached in hop 2.`;
    };
    const paint = () => {
      const fin = h === 3, ncls = {}, ecls = {};
      for (let j = 1; j <= Math.min(h, 3); j++) HOPS1[j].forEach(n => { ncls[n] = "on"; });
      picked.forEach(n => { ncls[n] = "on"; });
      if (!fin) HOPS1[h].forEach(n => { ncls[n] = (ncls[n] ? ncls[n] + " " : "") + "ring"; });
      ncls[START1] = (ncls[START1] || "") + (h === 0 ? "" : " on");
      // edges walked so far
      USED1.forEach(i => { const [s, , o] = FACTS[i]; const hopOf = PATH1.findIndex((_, j) => (HOPS1[j].includes(s) && HOPS1[j + 1].includes(o)) || (HOPS1[j].includes(o) && HOPS1[j + 1].includes(s))); if (hopOf < h || (hopOf === h && (picked.has(s) || picked.has(o)))) ecls[i] = "hot"; });
      if (miss) ncls[miss] = "no";
      el.innerHTML = `<h1>Follow the edges</h1>
        <p class="lead">Same question: <b>${kit.esc(QUESTION)}</b> Answer it on the graph. Start at the 2025 jury and go one hop at a time. A hop is one step along one kind of line.</p>
        ${fin ? "" : `<p class="task">${HOP_TASK[h]} (${picked.size} of ${HOPS1[h + 1].length} found)</p>`}
        ${gpic(kit, { ncls, ecls, pick: n => !fin && n !== START1 })}
        ${keyHtml([["ring", "where this hop starts"], ["on", "reached"]])}
        <div class="lpanel">${fin ? kit.feedback(`<b>${kit.esc(fmtList(ANSWER1))}</b>. Three hops, ${USED1.length} edges followed, every venue found. Each hop started from what the last hop reached, so the film pages were found through their directors, even though they never mention a jury.`, true)
          : miss ? kit.feedback(why(miss), false)
          : h > 0 && !picked.size ? kit.feedback(`Hop ${h} done: ${kit.esc(fmtList(HOPS1[h]))}.`) : ""}</div>`;
      tapNode(el, n => {
        if (h === 3) return;
        if (HOPS1[h + 1].includes(n)) {
          miss = null; picked.add(n);
          if (picked.size === HOPS1[h + 1].length) { h++; picked.clear(); }
          paint(); if (h === 3) done();
        } else { miss = n; paint(); }
      });
    };
    paint();
  }

  /* 4. Spot the idea: why the walk found what the ranking missed. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "The graph holds more of the programme than the chunks did.",
      "Each hop starts from the nodes the last hop reached, not from the words of the question.",
      "Following edges compares meaning better than vector similarity does."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did the walk work?</h1>
        <p class="lead">Vector search's top ${K} held ${word(VENUES_TOPK)} venue page${VENUES_TOPK === 1 ? "" : "s"} but could not link any venue to a juror's film. Your walk found all ${word(ANSWER1.length)} venues, from the same programme.</p>
        <p class="task">What made the difference?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. Vector search asks one thing: which chunks look like the question? A walk asks a new thing at each hop: what is linked to <i>these</i> nodes? So a fact that shares no words with the question is still reached, through a fact that does. A question that needs facts in a chain is called <b>multi-hop</b>. The lesson on retrieving in rounds also chained hops, but there every round is a new similarity search. A graph stores the links ahead of time, so the walk only reads them.`, true)
          : ans === 0 ? kit.feedback(`It holds less: ${NF} short facts. The film summaries, seat counts and running times were dropped. What the graph adds is the links between names, and a walk can follow links.`, false)
          : kit.feedback(`The walk compares no meaning at all. It follows exact names: an edge from “Kenji Arai” never reaches a node called “K. Arai”. That is why it is precise, and also its weak spot.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Use it with predictions: a backwards walk that runs into a fact the model missed. */
  function predictWalk({ el, done, kit }) {
    css();
    let h = 0, wrong = null;
    const [films, people, juries] = [HOPS2[1], HOPS2[2], HOPS2[3]];
    const actors = FACTS.filter(([, r, o]) => r === "acted_in" && films.includes(o)).map(([s]) => s);
    const STEPS = [
      { ask: `Hop 1 walks <code>screened_at</code> backwards from Park Screen. Which films does it reach?`,
        opts: [fmtList(films), films[0], fmtList([...films, COLS[2][0]])], right: 0,
        no: [null, `Park Screen has ${word(films.length)} <code>screened_at</code> lines coming in, not one. Count the lines that end at Park Screen.`, `${kit.esc(COLS[2][0])} is screened at ${kit.esc(fmtList(neighbours(COLS[2][0], "screened_at")))}, not at Park Screen.`] },
      { ask: `Hop 2 walks <code>directed</code> backwards from those films. The ${ORPHAN} chunk says “Directed by ${ORPHAN_DIRECTOR}”. Which directors does the walk reach?`,
        opts: [`${fmtList(people)} and ${ORPHAN_DIRECTOR}`, `${fmtList([...people, ...actors])}`, `${fmtList(people)} only`], right: 2,
        no: [`The ${ORPHAN} page does say “Directed by ${ORPHAN_DIRECTOR}”. But read the model's ${NF} lines again: none says <code>${ORPHAN_DIRECTOR} | directed | ${ORPHAN}</code>. The model missed that fact, so the graph has no such edge, and a walk cannot follow an edge that is not there.`,
          `${fmtList(actors)} reaches ${fmtList(films.filter(f => FACTS.some(([s, r, o]) => r === "acted_in" && o === f)))} by an <code>acted_in</code> line. This hop follows <code>directed</code> only.`, null] },
      { ask: `Hop 3 walks <code>member_of</code> forwards from ${fmtList(people)}. Which jury does it reach?`,
        opts: [fmtList(juries), START1, "No jury"], right: 0,
        no: [null, `The 2025 jury is reached from ${fmtList(actors)}, who acted in a film here. Only ${fmtList(people)} came out of hop 2, and that ${people.length === 1 ? "person's" : "people's"} <code>member_of</code> line goes to the ${fmtList(juries)}.`, `${fmtList(people)} has a <code>member_of</code> line. Look in the Juries column.`] }
    ];
    const paint = () => {
      const fin = h === STEPS.length, ncls = { [START2]: "on" }, ecls = {};
      for (let j = 1; j <= h; j++) HOPS2[j].forEach(n => { ncls[n] = "on"; });
      USED2.forEach(i => { const [s, , o] = FACTS[i]; const hopOf = PATH2.findIndex((_, j) => (HOPS2[j].includes(s) && HOPS2[j + 1].includes(o)) || (HOPS2[j].includes(o) && HOPS2[j + 1].includes(s))); if (hopOf >= 0 && hopOf < h) ecls[i] = "hot"; });
      if (fin) ncls[ORPHAN] = "ring on";
      const st = STEPS[h];
      el.innerHTML = `<h1>Walk backwards, predict each hop</h1>
        <p class="lead">A guest asks: <b>who directed the films at Park Screen, and which jury were they on?</b> Edges can be walked in either direction. Predict each hop, then see it on the graph.</p>
        ${fin ? "" : `<p class="task">${st.ask}</p>`}
        ${gpic(kit, { ncls, ecls })}
        ${keyHtml([["on", "reached"]])}
        <div class="lpanel">${fin ? "" : kit.options(st.opts.map(kit.esc), { picked: wrong, correct: st.right })}
        ${fin ? kit.feedback(`The graph says: <b>${kit.esc(fmtList(people))}, ${kit.esc(fmtList(juries))}</b>. The full answer also has ${kit.esc(ORPHAN_DIRECTOR)}, who directed ${kit.esc(ORPHAN)} (ringed: no <code>directed</code> line reaches it) and is on neither jury page. Nothing in the walk warned you. A fact the extractor missed is <b>silent</b>: the graph simply has no edge. That is the first price of a graph: it is only as good as the extraction.`, true)
          : wrong != null ? kit.feedback(st.no[wrong], false)
          : h > 0 ? kit.feedback(`Hop ${h}: ${kit.esc(fmtList(HOPS2[h]))}.${h === 2 ? ` The <code>directed</code> line into ${kit.esc(ORPHAN)} is missing: the model's list has none, though the ${kit.esc(ORPHAN)} chunk names ${kit.esc(ORPHAN_DIRECTOR)}.` : ""}`) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === st.right) { wrong = null; h++; paint(); if (h === STEPS.length) done(); } else { wrong = i; paint(); }
      });
    };
    paint();
  }

  /* 6. The graph in Python: build_graph, predict what one node holds. */
  const CODE_BUILD = [
    "def build_graph(facts):",
    "  graph = {}",
    "  for subj, rel, obj in facts:",
    "    graph.setdefault(subj, [])",
    "    graph.setdefault(obj, [])",
    "    graph[subj].append((rel, obj))",
    "    graph[obj].append((\"<-\" + rel, subj))",
    "  return graph"
  ];
  function buildCode({ el, done, kit }) {
    css();
    let ans = null;
    const realList = OUT_GRAPH.rex.split(" = ")[1];
    const opts = ["[]", realList, realList.replace(/'<-screened_at'/g, "'screened_at'")];
    const paint = () => {
      el.innerHTML = `<h1>The graph in Python</h1>
        <p class="lead">From scratch, a graph can be a plain dict: each node name maps to a list of <code>(relation, other node)</code> pairs. In JavaScript terms, an object whose values are arrays. <code>setdefault</code> creates an empty list for a node the first time it is seen, and does nothing after that. <code>facts</code> holds the ${NF} lines as tuples (fixed lists of three).</p>
        <div class="${P}code">${kit.code(CODE_BUILD, ans === 1 ? 6 : -1)}</div>
        <p class="task">The script then runs <code>print(graph["Rex Cinema"])</code>. Rex Cinema is never the subject of a fact. What does it print?</p>
        <div class="lpanel">${kit.options(opts.map(o => `<code>${kit.esc(o)}</code>`), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. The highlighted line adds every fact a second time, read backwards and marked <code>&lt;-</code>, onto the object's list. That is what let you walk from Park Screen to its films. The real run printed:`, true)
            + `<div class="${P}rec">${kit.esc([OUT_GRAPH.rex, OUT_GRAPH.okafor, OUT_GRAPH.orchard].join("\n"))}</div><p class="${P}cap">Output of graph.py, run on this Mac (${OUT_GRAPH.nodes} nodes in all)</p>`
            + kit.feedback(`Look at the last line: ${kit.esc(ORPHAN)} has only its two <code>screened_at</code> edges. The missed director is missing here too.`)
          : ans === 0 ? kit.feedback(`The first <code>append</code> line alone would leave Rex Cinema with nothing. But the second one runs for every fact as well: it adds the fact backwards to the <i>object's</i> list, so Rex Cinema gets one pair per film screened there.`, false)
          : kit.feedback(`Without the <code>&lt;-</code> mark, Rex Cinema's list would read as if Rex Cinema were screened at the films. The second <code>append</code> line adds <code>"&lt;-" + rel</code>, so the walk knows which way each edge points.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. The walk in Python, stepped from the real trace. */
  const CODE_WALK = [
    "def linked(graph, node, rel):",
    "  return {o for r, o in graph[node]",
    "          if r == rel}",
    "",
    "def walk(graph, start, path):",
    "  frontier = {start}",
    "  for rel in path:",
    "    reached = set()",
    "    for node in sorted(frontier):",
    "      reached |= linked(graph, node, rel)",
    "    frontier = reached",
    "  return sorted(frontier)"
  ];
  const OFFSET = 4; // walk's def line in CODE_WALK
  // shown steps: the start, every "add this node's neighbours" line, every end of a hop, and the return
  const STEPS7 = TRACE.map((t, i) => [t, i]).filter(([t, i]) => (t[0] === 2 && i === 1) || t[0] === 5 || t[0] === 6 || t[1] === 1).map(([t]) => t);
  function walkCode({ el, done, kit }) {
    css();
    let i = 0;
    const paint = () => {
      const [line, , rel, node, reached, frontier] = STEPS7[i];
      const hop = rel ? PATH1.indexOf(rel) + 1 : 0;
      const ncls = {}, list = a => a ? `{${a.map(x => `"${x}"`).join(", ")}}` : "–";
      (frontier || []).forEach(n => { ncls[n] = "on"; });
      (reached || []).forEach(n => { ncls[n] = "on"; });
      if (line === 5) ncls[node] = (ncls[node] || "") + " ring";
      let say;
      if (line === 2) say = `<code>frontier = {"${START1}"}</code> has run. The path has ${word(PATH1.length)} relations, so the loop runs ${word(PATH1.length)} hops.`;
      else if (line === 5) {
        const add = neighbours(node, rel), fresh = add.filter(x => !(reached || []).includes(x)), old = add.filter(x => (reached || []).includes(x));
        say = `Hop ${hop}, <code>rel = "${kit.esc(rel)}"</code>. Node ${kit.esc(node)}: ${add.length ? (fresh.length ? `its <code>${kit.esc(rel)}</code> edges are about to add ${kit.esc(fmtList(fresh))} to <code>reached</code>${old.length ? ` (${kit.esc(fmtList(old))} already there)` : ""}.` : `its <code>${kit.esc(rel)}</code> edges lead to ${kit.esc(fmtList(add))}, already in <code>reached</code>, so nothing new is added.`) : `it has no <code>${kit.esc(rel)}</code> edge, only ${kit.esc(fmtList(ADJ.get(node).filter(([r]) => r !== "member_of" && !r.startsWith("<-")).map(([r, o]) => `${r} to ${o}`)))}, so nothing is added. The acted_in trap you met on the Follow the edges screen is skipped here, by the code.`}`;
      } else if (line === 6) say = `Hop ${hop} done. The highlighted line makes <code>reached</code> the new <code>frontier</code>:${kit.esc(fmtList(reached))}.`;
      else say = `<code>walk</code> returns the frontier, sorted. The run printed <code>${kit.esc(OUT_GRAPH.walk.split(": ")[1])}</code>, the venues you found by hand.`;
      el.innerHTML = `<h1>The walk, written as code</h1>
        <p class="lead">The call is <code>walk(graph, "${START1}", ${kit.esc(JSON.stringify(PATH1).replace(/,/g, ", "))})</code>: a start node and the relation to follow at each hop. <code>frontier</code> holds the nodes the last hop reached. <code>linked</code> returns the nodes one <code>rel</code> edge away from a node, and <code>|=</code> adds them to <code>reached</code>. The steps replay a real run. The highlighted line is the one about to run.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the graph.</p>
        <div class="${P}code">${kit.code(CODE_WALK, line + OFFSET)}</div>
        <div class="vars"><span>rel <b>${rel ? kit.esc(rel) : "–"}</b></span><span>node <b>${line === 5 ? kit.esc(node) : "–"}</b></span><span>step <b>${i + 1} / ${STEPS7.length}</b></span></div>
        <div class="vars"><span>reached <b>${kit.esc(list(reached))}</b></span></div>
        <div class="vars"><span>frontier <b>${kit.esc(list(frontier))}</b></span></div>
        ${kit.feedback(say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === STEPS7.length - 1 ? "disabled" : ""}>Next step</button></div>
        ${gpic(kit, { ncls })}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === STEPS7.length - 1) done(); };
    };
    paint();
  }

  /* 8. Back to RAG: the path facts become the context; when does each step run? */
  const PIPE = [
    ["A model reads every chunk and writes the facts.", 0, "Extraction runs once over the whole collection, before any question. It is the expensive part: the model reads every chunk, and again whenever a chunk changes."],
    ["Code turns the facts into the graph dict.", 0, "build_graph runs once after extraction, and the graph is stored. No question is needed to build it."],
    ["Code walks the graph from the question's start node.", 1, "The start node and the path depend on the question, so the walk runs per question. It only reads stored edges, so it is fast and costs no model call."],
    ["A model writes the answer from the facts on the path.", 1, "This is the usual generation step of RAG, once per question, with the path facts as the context."]
  ];
  function pipeline({ el, done, kit }) {
    css();
    const ans = PIPE.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Back to RAG</h1>
        <p class="lead">The graph is the retriever. The ${word(USED1.length)} facts on your walk's path were given to the same small hosted model as its context, one per line, with the same question. It answered:</p>
        ${rec(kit, REC_GRAPH.text)}
        <p class="lead">Here the start node and the path were written by hand. A real system has to get them from the question, for example by asking a model to name the entities in it and match them to nodes.</p>
        <p class="task">For each step of this pipeline, decide when it runs.</p>
        ${PIPE.map(([t, right, why], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(t)}</p>${kit.options(["Ahead of time", "Per question"], { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(ans[i] === right ? kit.esc(why) : right === 0 ? `It does not depend on the question. ${kit.esc(why)}` : `It needs the question to know where to start or what to say. ${kit.esc(why)}`, ans[i] === right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PIPE.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. The big picture: what for, when not, what it costs; task: which cost bites first. */
  const COSTS = ["Reading every document with a model", "Names that do not match", "Facts the model missed"];
  const BIG = [
    ["A news archive of two million articles. The team wants a graph of people and companies by Friday.", 0, "A model has to read all two million articles before the first question, and every new article after that."],
    ["Film credits are written as “K. Arai”, “Kenji Arai” and “Arai Kenji” on different pages.", 1, "The walk follows exact names, so this one person becomes three nodes and his films split between them. The names must be cleaned or merged first."],
    ["A contracts team must list every party to every contract. One party left out is a serious error.", 2, "A missed fact is silent, as Glass Orchard's director was. Here that is unacceptable, so the extraction needs checking, and maybe the source text alongside it."]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <div class="${P}prose">
        <p><b>What it is for.</b> Questions that chain facts spread over many documents: who is linked to what, through whom. Microsoft's GraphRAG also writes summaries of groups of related entities ahead of time, for questions about a whole collection.</p>
        <p><b>When not to use it.</b> The answer sits in one passage: plain vector RAG finds it. The facts already live in a database: query the database. A two-hop question now and then: retrieve in rounds.</p>
        <p><b>What it costs.</b> With model extraction, a model reads every document ahead of time, and again when documents change. Missed facts are silent. Names must match exactly to meet in one node. The relation list is a schema someone has to maintain.</p>
        </div>
        <p class="task">For each situation, pick the cost that bites first.</p>
        ${BIG.map(([t, right, why], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(t)}</p>${kit.options(COSTS.map(kit.esc), { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(ans[i] === right ? kit.esc(why) : `${kit.esc(COSTS[ans[i]])} is a real cost, but not the first one here. ${kit.esc(why)}`, ans[i] === right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it: graph or not, with "no" cases that say why. */
  const CASES = [
    ["An engineering wiki has one page per service, listing the services it calls. On-call asks: which services break if the login database goes down?", true,
      "Yes. Each page holds one link (A calls B), and the answer is a chain of them. Extract calls edges once, then walk backwards from the login database, hop after hop, until no new service is reached.",
      "Every page states one link, and the answer is a chain of links several hops long. No single page looks like the question, which is exactly where top-k search fails. Extract the calls edges and walk them."],
    ["A support bot answers “How do I reset my router?” The steps are on one help page.", false,
      "No. The whole answer is in one passage that sounds like the question, so plain vector search finds it. A graph would cost a model pass over every page and would keep links, not the steps' wording.",
      "There is nothing to chain: one page holds the full answer and it sounds like the question, so plain vector search ranks it first. Extraction would cost a model pass over every page, and a graph keeps links, not the step-by-step text the user needs."],
    ["The festival's ticketing system already has tables of films, venues and screenings. Staff ask which venues show films by a given director.", false,
      "No. The facts are already structured. A database query joins the tables exactly. Extracting the same facts from text with a model would only add misses like Glass Orchard's.",
      "The links already exist as rows in tables, so one database query with a join answers it exactly. Building a graph would mean a model re-extracting facts the system already holds, and adding misses like Glass Orchard's director."],
    ["A newsroom asks which companies share a board member with companies fined last year. The facts are spread across thousands of articles.", true,
      "Yes. Fined companies, then their board members, then those people's other companies: three hops across many articles, none of which looks like the question.",
      "It is a chain: fined companies, then their board members, then the other boards those people sit on. Each fact is in a different article that does not look like the question, so top-k search misses them. That is the graph's case."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Graph or not?</h1>
        <p class="lead">${Cap(word(CASES.length))} situations away from the festival.</p>
        <p class="task">For each one, decide whether building an entity-relation graph is the right retrieval. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => { const ok = ans[i] === (y ? 0 : 1); return `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes, a graph", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ok ? yes : no), ok)}</div>`; }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next (in-page practice: the lesson was the practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <div class="${P}prose">
      <p>You turned extracted facts into a graph of entities and relations, answered a three-hop question by walking it, and saw a missed fact make the graph silently wrong. You can say why it works (each hop starts from what the last one reached), when to reach for it (questions that chain facts across documents), when not to (one passage holds the answer, or the facts already sit in a database) and what it costs (a model pass over everything, exact names, silent misses).</p>
      </div>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. ${kit.esc(nx.outcome)} You saw a graph answer go silently wrong on one question; a set of questions with known answers is how you would catch that before users do.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5a-graph-rag", {
    title: "Graph-based RAG: entities and relations",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/2404.16130",
      "https://microsoft.github.io/graphrag/",
      "https://microsoft.github.io/graphrag/index/default_dataflow/",
      "https://microsoft.github.io/graphrag/get_started/",
      "https://docs.ollama.com/api/embed",
      "https://docs.python.org/3/library/stdtypes.html#dict.setdefault"
    ],
    interview: [{
      q: "Your RAG bot over internal docs answers single-fact questions well, but fails on “which teams depend on services owned by people who left last quarter?”. Would you add a knowledge graph, and how would you know it helped?",
      good: [
        "First confirm it is a retrieval problem: the needed chunks are not in the top k because none of them looks like the question.",
        "Extract subject-relation-object facts with a fixed relation list ahead of time, build the graph, and walk it from the entities named in the question.",
        "Check the extraction on a sample: missed facts are silent, and names written two ways split into two nodes unless they are merged.",
        "Weigh the cost: a model pass over every document, repeated when documents change, plus a schema to maintain.",
        "Consider cheaper routes: if ownership lives in an HR or service catalogue system, query that; for rare two-hop questions, retrieve in rounds."
      ],
      weak: "“Add GraphRAG, graphs are better for relationships.” It skips checking that retrieval is the failure, ignores extraction errors and cost, and never asks whether the facts already exist in a database."
    }],
    screens: [situation, connect, walkByHand, spotIdea, predictWalk, buildCode, walkCode, pipeline, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${NI.get(COLS[1][0])}"]`], right: PENDING.map(i => `[data-i="${NI.get(FACTS[i][2])}"]`) },
      { wrong: [`[data-i="${NI.get(COLS[1].find(p => !HOPS1[1].includes(p)))}"]`], right: [1, 2, 3].flatMap(h => HOPS1[h].map(n => `[data-i="${NI.get(n)}"]`)) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(STEPS7.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: PIPE.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
