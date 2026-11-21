/* Lesson: rewriting queries and retrieving in rounds. A tech conference's programme helper: follow-ups such as
   "Who runs it?" miss because the search sees only the query text (idea 1: rewrite into a standalone query), and
   "Which workshop is run by the speaker who chairs the opening panel?" needs two facts from two chunks (idea 2: a
   retrieve-check-retrieve loop with stop rules). Broken on purpose: the loop searching the original question
   every round.
   Data:
   - The programme (15 chunks) is written for the lesson: docs/ai-path/runs/s5a-multi-step-retrieval/programme.py.
   - Every search result and score (RETR) is a real run on this Mac: all-minilm embeddings through Ollama, cosine
     similarity in NumPy; lesson_data.py printed RETR (lesson_data.out.txt); followups.py and rounds.py print the
     same results in context (followups.out.txt, rounds.out.txt).
   - The loop's code is rounds.py (find_notes); TRACE is trace.out.txt, copied in whole.
   - Model rewrites and checker replies are recordings made with scripts/ai/record.mjs, in
     docs/ai-path/recordings/s5a-multi-step-retrieval/ (rewrite-*.json, check-*.json), copied in unaltered.
   - c08 was reworded after a first run, where round 2 missed it (check-two-hop-2.json); screen 6 says so.
   The chats are written for the lesson; the lesson says so. Every number on screen is computed from RETR, TRACE
   and the recordings. Plain browser script. */
(() => {
  const ID = "s5a-multi-step-retrieval", P = "lx-" + ID + "-";
  const RECORDED_ON = "2026-11-13";
  const MODEL_CAP = `<div class="${P}rec">Recorded model output, ${RECORDED_ON}</div>`;

  // docs/ai-path/runs/s5a-multi-step-retrieval/programme.py
  const PROG = {
    c01: "Thursday 09:00, Main Hall. Opening panel: where AI tooling goes next. Chaired by Dr. Amara Okafor, with three engineering leads from local start-ups.",
    c02: "Thursday 10:00, Main Hall. Keynote: ten years of shipping web apps, by Lena Brandt.",
    c03: "Thursday 11:00, Hall B. Talk: Vectors at scale, running a vector database in production, by Tomás Rivera.",
    c04: "Thursday 12:30 to 13:30. Lunch break. Food is served on the terrace; the halls are closed.",
    c05: "Thursday 13:30, Hall B. Talk: Search that forgives typos, fuzzy matching in Postgres, by Mei Chen.",
    c06: "Thursday 13:30, Hall A. Talk: Kubernetes without tears, a first cluster for small teams, by Jonas Weber.",
    c07: "Thursday 15:00, Hall B. Talk: Caching LLM answers safely, by Priya Nair.",
    c08: "Friday 09:30, Room 3. Workshop run by Dr. Amara Okafor: build an evaluation set for your chatbot. Bring a laptop with Python 3.11 or newer.",
    c09: "Friday 09:30, Room 4. Workshop: React Server Components from zero. Run by Lena Brandt. Bring a laptop with Node installed.",
    c10: "Friday 13:00, Room 3. Workshop: your first Kubernetes deploy. Run by Jonas Weber. Bring a laptop; a cloud account is provided.",
    c11: "Friday 11:00, Hall A. Talk: Prompt injection in the wild, by Sam Osei.",
    c12: "Friday 12:00 to 13:00. Lunch break on the terrace.",
    c13: "Friday 16:00, Main Hall. Closing panel: what we learned this year. Chaired by Tomás Rivera.",
    c14: "Recordings: every talk in Hall A and Hall B is filmed and goes online one week later. Workshops are not recorded.",
    c15: "Badges and Wi-Fi: pick up your badge at the front desk from 08:00. The Wi-Fi network is HarbourTech, password on the back of the badge."
  };
  const N_CHUNKS = Object.keys(PROG).length;

  // docs/ai-path/runs/s5a-multi-step-retrieval/lesson_data.out.txt (query -> [chunk id, cosine score], best first)
  const RETR = {
    "Who runs it?": [["c01", 0.279], ["c13", 0.188], ["c03", 0.179]],
    "Do I need to bring anything?": [["c09", 0.195], ["c04", 0.195], ["c10", 0.176]],
    "Will it be recorded?": [["c14", 0.439], ["c07", 0.179], ["c03", 0.156]],
    "And the one after lunch?": [["c12", 0.427], ["c04", 0.359], ["c14", 0.162]],
    "Do I need to bring anything to the chatbot evaluation workshop?": [["c08", 0.663], ["c14", 0.314], ["c01", 0.277]],
    "Do I need to bring anything to it?": [["c09", 0.205], ["c10", 0.182], ["c04", 0.155]],
    "Do I need to bring anything to the conference?": [["c10", 0.271], ["c06", 0.261], ["c14", 0.205]],
    "Who runs the React Server Components workshop?": [["c09", 0.701], ["c01", 0.305], ["c10", 0.291]],
    "Who runs it on Friday?": [["c12", 0.419], ["c04", 0.314], ["c13", 0.286]],
    "Who runs the Friday morning workshop?": [["c14", 0.452], ["c12", 0.436], ["c01", 0.43]],
    "Will Mei Chen's fuzzy matching talk be recorded?": [["c05", 0.433], ["c14", 0.367], ["c08", 0.297]],
    "Will the workshop be recorded?": [["c14", 0.668], ["c01", 0.335], ["c10", 0.303]],
    "Will it be recorded on Thursday?": [["c14", 0.424], ["c12", 0.307], ["c04", 0.274]],
    "Which talk is in Hall B on Thursday after the lunch break?": [["c04", 0.583], ["c14", 0.575], ["c12", 0.558]],
    "Amara Okafor chatbot evaluation workshop Friday Room 3 materials": [["c08", 0.735], ["c01", 0.404], ["c10", 0.309]],
    "\"React Server Components from zero\" workshop organizer": [["c09", 0.764], ["c10", 0.302], ["c14", 0.276]],
    "\"Will the Postgres fuzzy matching talk by Mei Chen be recorded?\"": [["c05", 0.683], ["c07", 0.333], ["c14", 0.293]],
    "\"Vectors at scale\" talk by Tomás Rivera after lunch": [["c03", 0.646], ["c13", 0.308], ["c11", 0.307]],
    "Is there a React workshop? Yes: React Server Components from zero, Friday 09:30 in Room 4. Who runs it? Lena Brandt. Does she give a talk too? Yes, the keynote on Thursday at 10:00 in the Main Hall. What is the Wi-Fi password?": [["c09", 0.777], ["c02", 0.445], ["c14", 0.438]],
    "What is the Wi-Fi password?": [["c15", 0.618], ["c10", 0.198], ["c02", 0.116]],
    "workshop run by Dr. Amara Okafor": [["c01", 0.461], ["c08", 0.343], ["c10", 0.331]],
    "Who chairs the opening panel?": [["c13", 0.47], ["c01", 0.428], ["c09", 0.25]],
    "When is the keynote?": [["c02", 0.6], ["c01", 0.307], ["c12", 0.305]],
    "Which workshop is run by the speaker who chairs the closing panel?": [["c13", 0.465], ["c01", 0.451], ["c14", 0.402]],
    "workshops run by Tomás Rivera": [["c14", 0.49], ["c13", 0.47], ["c01", 0.334]],
    "Which workshop is run by the speaker who chairs the opening panel?": [["c01", 0.456], ["c14", 0.416], ["c13", 0.394], ["c08", 0.373], ["c09", 0.364]]
  };
  const top3 = q => RETR[q].slice(0, 3);
  const ids = q => top3(q).map(([c]) => c);
  const isHit = (q, target) => ids(q).includes(target);
  const rankOf = (q, c) => RETR[q].findIndex(([x]) => x === c) + 1;
  const scoreOf = (q, c) => RETR[q].find(([x]) => x === c)[1].toFixed(3);
  const ORD = ["", "first", "second", "third", "fourth", "fifth"];

  // The rewrite instruction sent with every rewrite request (rewrite-*.request.json, system message).
  const REWRITE_SYSTEM = "You rewrite the last user message of a conference programme chat into a standalone search query. Use the names and topics from the earlier turns so the query makes sense on its own. Reply with the query only.";
  // The checker instruction sent with every check request (check-*.request.json, system message; rounds.py CHECK_SYSTEM).
  const CHECK_SYSTEM = "You check notes taken from a conference programme. Decide whether the notes contain every fact needed to answer the question. Reply with exactly one line and nothing else: ENOUGH if they do, or SEARCH: <a short search query for the one missing fact>. Do not answer the question.";

  // From docs/ai-path/recordings/s5a-multi-step-retrieval/rewrite-*.json (not trimmed, not altered)
  const REC = {
    bring: { src: ID + "/rewrite-bring", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON,
      text: "Amara Okafor chatbot evaluation workshop Friday Room 3 materials" },
    runs: { src: ID + "/rewrite-runs", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON,
      text: "\"React Server Components from zero\" workshop organizer" },
    recorded: { src: ID + "/rewrite-recorded", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON,
      text: "\"Will the Postgres fuzzy matching talk by Mei Chen be recorded?\"" },
    afterLunch: { src: ID + "/rewrite-after-lunch", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON,
      text: "\"Vectors at scale\" talk by Tomás Rivera after lunch" }
  };
  // From docs/ai-path/recordings/s5a-multi-step-retrieval/check-*.json (not trimmed, not altered)
  const CHK = {
    twoHop1: { src: ID + "/check-two-hop-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON, text: "SEARCH: workshop run by Dr. Amara Okafor" },
    twoHop2: { src: ID + "/check-two-hop-2b", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON, text: "ENOUGH" },
    oneFact1: { src: ID + "/check-one-fact-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON, text: "ENOUGH" },
    closing1: { src: ID + "/check-closing-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON, text: "SEARCH: workshops run by Tomás Rivera" },
    closing2: { src: ID + "/check-closing-2", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON, text: "SEARCH: workshops run by Tomás Rivera" },
    broken1: { src: ID + "/check-broken-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON, text: "SEARCH: workshop run by Dr. Amara Okafor" },
    broken2: { src: ID + "/check-broken-2", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: RECORDED_ON, text: "SEARCH: workshop run by Dr. Amara Okafor" }
  };

  const Q_TWO = "Which workshop is run by the speaker who chairs the opening panel?";
  const Q_ONE = "When is the keynote?";
  const Q_CLOSE = "Which workshop is run by the speaker who chairs the closing panel?";
  const MAX_ROUNDS = 3;
  const searchOf = reply => reply.startsWith("SEARCH: ") ? reply.slice(8) : null;

  // Replays a run of the loop from RETR and the recorded checker replies (the same logic as rounds.py).
  function replay(question, replies, broken) {
    const notes = [], queries = [question], rounds = [];
    for (let r = 0; r < MAX_ROUNDS; r++) {
      const q = broken ? question : queries[queries.length - 1];
      const found = ids(q), added = found.filter(c => !notes.includes(c));
      notes.push(...added);
      const rec = replies[r];
      rounds.push({ q, found, added, rec });
      if (rec.text === "ENOUGH") return { rounds, notes, why: "enough" };
      const nq = searchOf(rec.text);
      if (queries.includes(nq)) return { rounds, notes, why: "repeated query" };
      queries.push(nq);
    }
    return { rounds, notes, why: "out of rounds" };
  }
  const RUN_TWO = replay(Q_TWO, [CHK.twoHop1, CHK.twoHop2]);
  const RUN_ONE = replay(Q_ONE, [CHK.oneFact1]);
  const RUN_CLOSE = replay(Q_CLOSE, [CHK.closing1, CHK.closing2]);
  const RUN_BROKEN = replay(Q_TWO, [CHK.broken1, CHK.broken2], true);

  /* ---------- lesson-local pictures and style ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}chat { display: grid; gap: 8px; margin-top: 14px; max-width: 34em; }
      .${P}turn { padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font-size: 16px; line-height: 1.4; }
      .${P}turn.h { margin-left: 12%; background: var(--sunk); }
      .${P}turn.u { margin-right: 12%; }
      .${P}turn.last { border: 2px solid var(--ink); }
      .${P}who { display: block; font: 700 11px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}cap { font: 700 12px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 16px 0 0; }
      .${P}hits { list-style: none; padding: 0; margin: 6px 0 0; display: grid; gap: 6px; max-width: 40em; }
      .${P}hits li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 15px; line-height: 1.4; background: var(--bg); }
      .${P}hits li b { font: 700 13px var(--mono); padding-top: 1px; }
      .${P}hits li i { font: 500 12px var(--mono); color: var(--muted); font-style: normal; grid-column: 1; }
      .${P}hits li span { grid-row: 1 / span 2; grid-column: 2; }
      .${P}hits li.hit { border-color: var(--good); box-shadow: inset 3px 0 0 var(--good); }
      .${P}hits li.old { color: var(--faint); }
      .${P}q { font: 500 15px/1.45 var(--mono); padding: 8px 10px; background: var(--sunk); border-radius: 8px; margin-top: 6px; overflow-wrap: anywhere; max-width: 40em; }
      .${P}rec { font: 500 12px var(--mono); color: var(--muted); margin-top: 4px; }
      .${P}small { font-size: 14px; color: var(--muted); margin: 8px 0 0; max-width: 40em; }
      .${P}ids { font: 600 14px var(--mono); }
      .${P}row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; margin-top: 10px; }
      .${P}row > div { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; min-width: 0; }
      .${P}round { border-top: 1px solid var(--line); padding: 10px 0 2px; margin-top: 8px; font-size: 15px; }
      .${P}round > b { font: 700 12px var(--mono); text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
      .${P}stop { font: 700 14px var(--mono); margin-top: 8px; }
      .${P}stage { border-top: 1px solid var(--line); padding-top: 14px; margin-top: 18px; }
      .${P}big p { margin: 8px 0 0; max-width: 36em; }
      @media (max-width: 560px) { .${P}row { grid-template-columns: minmax(0, 1fr); } .${P}turn.h { margin-left: 6%; } .${P}turn.u { margin-right: 6%; } }`;
    document.head.appendChild(s);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const chat = turns => `<div class="${P}chat">${turns.map(([who, t], i) => `<div class="${P}turn ${who === "Member" ? "u" : "h"}${i === turns.length - 1 ? " last" : ""}"><span class="${P}who">${who}${i === turns.length - 1 ? " · last message" : ""}</span>${esc(t)}</div>`).join("")}</div>`;
  // a top-3 list with scores; mark: chunk id to outline as the answer chunk; old: ids shown faded (already in the notes)
  const hits = (q, { mark = null, old = [], k = 3 } = {}) => `<ul class="${P}hits">${RETR[q].slice(0, k).map(([c, s], i) =>
    `<li class="${c === mark ? "hit" : old.includes(c) ? "old" : ""}"><b>${c}</b><span>${esc(PROG[c])}</span><i>#${i + 1} · ${s.toFixed(3)}</i></li>`).join("")}</ul>`;
  const idList = arr => arr.join(", ");
  const quote = t => `<div class="${P}q">${esc(t)}</div>`;

  /* 1. The situation: a follow-up sent to the search word for word. */
  const CHAT_RUNS = [["Member", "Is there a React workshop?"], ["Helper", "Yes: React Server Components from zero, Friday 09:30 in Room 4."], ["Member", "Who runs it?"]];
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const q = "Who runs it?", got = ids(q);
    const opts = [...got.map(c => `${c}: ${esc(PROG[c].split(". ").slice(1, 2).join(""))}`), "None of them"];
    const correct = got.length;
    const why = {
      c01: "c01 names Dr. Amara Okafor, but as the chair of the opening panel. An answer built on it names the wrong person, and sounds sure about it.",
      c13: "c13 is the closing panel, chaired by Tomás Rivera. It has nothing to do with the React workshop.",
      c03: "c03 is a Thursday talk about vector databases, not the workshop."
    };
    const paint = () => {
      el.innerHTML = `<h1>The programme helper loses the thread</h1>
        <p class="lead">A tech conference has a programme helper. A member types a question, the helper searches the ${N_CHUNKS} chunks of the programme and answers from the chunks it finds: the RAG pipeline from the last lesson. First questions go well. Follow-ups go wrong. This lesson fixes two ways the search step fails: follow-ups that lean on the chat, and questions that need two facts from two chunks. In this chat, the helper sent the member's last message to the search, word for word.</p>
        ${chat(CHAT_RUNS)}
        <p class="${P}cap">The search for “${esc(q)}”: top 3, with similarity scores</p>
        ${hits(q)}
        <p class="${P}small">The chat is written for this lesson. The search is a real run: each chunk and the query turned into vectors by a small embedding model on our machine, ranked by cosine similarity (1 means the same direction, 0 means unrelated).</p>
        <p class="task">Which chunk lets the helper answer the member correctly?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. None of them is about the React workshop. The chunk that answers, c09 (run by Lena Brandt), is not in the top 3.`, true)
          : kit.feedback(why[got[ans]], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. By hand: pick a standalone query for three follow-ups; each pick shows its real search result. */
  const FOLLOW = [
    { key: "bring", target: "c08", raw: "Do I need to bring anything?",
      chat: [["Member", "Is there a workshop on chatbot evaluation?"], ["Helper", "Yes: Build an evaluation set for your chatbot, Friday 09:30 in Room 3, run by Amara Okafor."], ["Member", "Do I need to bring anything?"]],
      opts: ["Do I need to bring anything to it?", "Do I need to bring anything to the chatbot evaluation workshop?", "Do I need to bring anything to the conference?"], correct: 1,
      why: ["It still says “it”. The search cannot see the chat, so “it” points at nothing.",
        null,
        "This changes the question: the member asked about one workshop, not the whole conference. The Kubernetes workshop's “bring a laptop” comes first, so the answer would be about the wrong workshop."] },
    { key: "runs", target: "c09", raw: "Who runs it?",
      chat: CHAT_RUNS,
      opts: ["Who runs it on Friday?", "Who runs the Friday morning workshop?", "Who runs the React Server Components workshop?"], correct: 2,
      why: ["Adding “Friday” does not say which session. The search matched Friday's lunch break instead.",
        "Two workshops start on Friday at 09:30 (Room 3 and Room 4), so this is still unclear, and the search brought back no workshop at all.",
        null] },
    { key: "recorded", target: "c14", raw: "Will it be recorded?",
      chat: [["Member", "What is on in Hall B after lunch on Thursday?"], ["Helper", "At 13:30, Search that forgives typos: fuzzy matching in Postgres, by Mei Chen."], ["Member", "Will it be recorded?"]],
      opts: ["Will Mei Chen's fuzzy matching talk be recorded?", "Will it be recorded on Thursday?", "Will the workshop be recorded?"], correct: 0,
      why: [null,
        "It still says “it”. The word “recorded” found the recordings rule this time, but the query does not stand on its own: anyone who reads only the query, a log or a later step, cannot tell which session it means.",
        "This changes the subject. The search finds the recordings rule, and the answer would be “Workshops are not recorded”. True, but about the wrong session: Mei Chen's is a talk."] }
  ];
  const resultLine = (q, target) => `Real result: ${idList(ids(q))}. ${isHit(q, target) ? `The answer chunk ${target} is ${ORD[rankOf(q, target)]}.` : `The answer chunk ${target} is not in the top 3.`}`;
  function byHand({ el, done, kit }) {
    style();
    const ans = FOLLOW.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Rewrite the follow-ups</h1>
        <p class="lead">Fix it by hand. A good search query stands on its own: someone who never saw the chat could search with it and find the right chunk. Each pick below shows what the real search brought back for that exact query.</p>
        <p class="task">For each chat, pick the query you would send to the search instead of the member's last message.</p>
        ${FOLLOW.map((f, i) => {
          const a = ans[i], q = a == null ? null : f.opts[a];
          return `<div class="lcase" id="c${i}"><p>Chat ${i + 1}</p>${chat(f.chat)}${kit.options(f.opts.map(esc), { picked: a, correct: f.correct })}
            ${a == null ? "" : a === f.correct
              ? kit.feedback(`Right: it names the session the member means, in the programme's own words. ${resultLine(q, f.target)}`, true) + hits(q, { mark: f.target })
              : kit.feedback(`${f.why[a]} ${resultLine(q, f.target)}`, false)}</div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (FOLLOW.every((f, j) => ans[j] === f.correct)) done();
      }));
    };
    paint();
  }

  /* 3. A model rewrites: mark which retrievals the rewrite turned from miss to hit. */
  const ROWS = [
    { ...FOLLOW[0], rec: REC.bring },
    { ...FOLLOW[1], rec: REC.runs },
    { ...FOLLOW[2], rec: REC.recorded },
    { key: "afterLunch", target: "c05", raw: "And the one after lunch?", rec: REC.afterLunch,
      chat: [["Member", "When is the vector database talk?"], ["Helper", "Thursday 11:00 in Hall B: Vectors at scale, by Tomás Rivera."], ["Member", "And the one after lunch?"]] }
  ];
  const CAREFUL = "Which talk is in Hall B on Thursday after the lunch break?";
  const MARKS = ["Miss → hit", "Hit both times", "Miss both times", "Hit → miss"];
  const MARK_HITS = [[false, true], [true, true], [false, false], [true, false]]; // [member's words hit, rewrite hit]
  const mistakeOf = (r, a) => {
    const [pa, pb] = MARK_HITS[a], ta = isHit(r.raw, r.target), tb = isHit(r.rec.text, r.target), say = [];
    if (pa !== ta) say.push(pa ? "You may have read the rewrite list twice: the member's words did not find it." : "The member's words did find it: look at the left list too, not only the rewrite.");
    if (pb !== tb) say.push(pb ? "The rewrite reads better, but it did not find the chunk either." : "The rewrite did find it: check its list again.");
    return say.join(" ");
  };
  const markOf = r => { const a = isHit(r.raw, r.target), b = isHit(r.rec.text, r.target); return !a && b ? 0 : a && b ? 1 : !a && !b ? 2 : 3; };
  const NOTE = {
    bring: r => `The member's words found nothing about the workshop. The model put the workshop's topic words into the query, and ${r.target} came ${ORD[rankOf(r.rec.text, r.target)]}.`,
    runs: r => `The model quoted the workshop's title and added “organizer”. The title words did the work: ${r.target} came ${ORD[rankOf(r.rec.text, r.target)]}.`,
    recorded: r => `“Recorded” alone already found the rule (${ORD[rankOf(r.raw, r.target)]}). The rewrite also brought in c05, the talk itself, but pushed the rule down to ${ORD[rankOf(r.rec.text, r.target)]} place. A rewrite changes the ranking, and not always for the better.`,
    afterLunch: r => `Two problems. The model changed the meaning: the member wanted the next talk, and the rewrite asks about the vector talk itself. And even a careful rewrite, “${esc(CAREFUL)}”, misses: it brings back ${idList(ids(CAREFUL))}. The answer chunk says “13:30”, never “lunch”. “After lunch” is a time comparison, and similarity search does not compare times. That needs a filter on hall and start time.`
  };
  function modelRewrites({ el, done, kit }) {
    style();
    const ans = ROWS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Did the rewrite turn a miss into a hit?</h1>
        <p class="lead">In a real helper, a model writes the standalone query before every search. A small hosted model got each chat with this instruction:</p>
        ${quote(REWRITE_SYSTEM)}
        <p class="lead">A search is a <b>hit</b> when the chunk that answers the question is in its top 3.</p>
        <p class="task">For each chat, compare the two searches and mark what the rewrite did.</p>
        ${ROWS.map((r, i) => {
          const a = ans[i], right = markOf(r);
          return `<div class="lcase" id="c${i}"><p>Chat ${i + 1}: “${esc(r.raw)}” (the answer is in ${r.target})</p>
            <div class="${P}row"><div><span class="${P}who">Member's words</span><div class="${P}ids">${idList(ids(r.raw))}</div></div>
            <div><span class="${P}who">Model's rewrite</span>${quote(r.rec.text)}${MODEL_CAP}<div class="${P}ids" style="margin-top:6px">${idList(ids(r.rec.text))}</div></div></div>
            ${kit.options(MARKS.slice(0, 3), { picked: a, correct: right })}
            ${a == null ? "" : a === right ? kit.feedback(`${MARKS[right]}. ${NOTE[r.key](r)}`, true)
              : kit.feedback(`${mistakeOf(r, a)} Look for ${r.target} in each list. Member's words: ${isHit(r.raw, r.target) ? `yes, ${ORD[rankOf(r.raw, r.target)]}` : "not there"}. Rewrite: ${isHit(r.rec.text, r.target) ? `yes, ${ORD[rankOf(r.rec.text, r.target)]}` : "not there"}. So it is not “${MARKS[a].toLowerCase()}”.`, false)}</div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ROWS.every((r, j) => ans[j] === markOf(r))) done();
      }));
    };
    paint();
  }

  /* 4. Spot the idea: the search is stateless. */
  const WIFI_CHAT = "Is there a React workshop? Yes: React Server Components from zero, Friday 09:30 in Room 4. Who runs it? Lena Brandt. Does she give a talk too? Yes, the keynote on Thursday at 10:00 in the Main Hall. What is the Wi-Fi password?";
  const WIFI = "What is the Wi-Fi password?";
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const longer = "Who runs it on Friday?", good = "Who runs the React Server Components workshop?";
    const opts = ["The question was too short. Longer queries find more.", "The search sees only the query text. The chat, where the workshop is named, never reaches it.", "The embedding model is too small to understand “it”."];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Why the rewrite works</h1>
        <p class="lead">Back to the React workshop. “Who runs it?” missed. “${esc(good)}” found c09 ${ORD[rankOf(good, "c09")]}, with a score of ${scoreOf(good, "c09")}.</p>
        <p class="task">What is the real reason the member's own words missed?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The search keeps no memory: every call starts from the one string it is given. So the fix goes before the search: turn the follow-up into a <b>standalone query</b> that carries the names from the chat. This step is called <b>query rewriting</b>.`, true)
            + `<p class="${P}cap">Why not paste the whole chat in as the query?</p>
              <p class="${P}small">In the three short chats it worked. In a longer chat that changes topic, it drowns the new question. After three turns about the React workshop, the member asks “${esc(WIFI)}”. The whole chat as the query brought back ${idList(ids(WIFI_CHAT))}, the workshop again. The last message alone found c15 (the Wi-Fi chunk) ${ORD[rankOf(WIFI, "c15")]}. A rewrite keeps what the new question needs and drops the rest.</p>`
          : ans === 0 ? kit.feedback(`“${esc(longer)}” is longer and still missed: ${idList(ids(longer))}. Length did not help. The missing workshop name did.`, false)
          : kit.feedback("No model can tell from the three words “Who runs it?” which workshop is meant. That information is in the chat, not in the string. A bigger model would get the same three words.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. By hand: trace a two-hop question through the programme. */
  const R2 = "workshop run by Dr. Amara Okafor";
  function twoHop({ el, done, kit }) {
    style();
    const st = [null, null, null];
    const S0 = { opts: ["The chair is Dr. Amara Okafor. Missing: which workshop she runs.", "The chair is Tomás Rivera, so the answer is his workshop.", "Nothing is missing: c14 says workshops are not recorded."], correct: 0,
      why: [null, "Tomás Rivera chairs the closing panel (c13), not the opening one. Read the panel's name.", "c14 is about recordings. It names no workshop and no speaker."] };
    const S1 = { opts: [Q_TWO, "Who chairs the opening panel?", R2], correct: 2 };
    S1.why = [`The same query gives the same result: ${idList(ids(Q_TWO))}. Nothing new to read.`, `You already know the chair. This brings back ${idList(ids(S1.opts[1]))}: the panels again, and c09, which is not her workshop.`, null];
    const notes2 = [...ids(Q_TWO), ...ids(R2).filter(c => !ids(Q_TWO).includes(c))];
    const S2 = { opts: ["Search again for Dr. Amara Okafor's talks", "Answer: build an evaluation set for your chatbot, Friday 09:30, Room 3", "Search again: c10 is a workshop too"], correct: 1,
      why: ["The question asks for her workshop, and c08 names it. Another round costs a search and a model call and adds nothing.", null, "c10 is run by Jonas Weber. The workshop run by the chair is the answer; c10 is just extra in the notes."] };
    const stage = (i, S) => `<div class="${P}stage" id="st${i}">${kit.options(S.opts.map(esc), { picked: st[i], correct: S.correct })}
      ${st[i] == null ? "" : st[i] === S.correct ? "" : kit.feedback(S.why[st[i]], false)}</div>`;
    const paint = () => {
      const ok = i => st[i] === [S0, S1, S2][i].correct;
      el.innerHTML = `<h1>A question that needs two facts</h1>
        <p class="lead">A different kind of question: “${esc(Q_TWO)}” No chunk says both things. One chunk names the chair, another names the workshop. Trace it through the programme yourself. Each search is one <b>round</b>, and every chunk a round finds goes into your <b>notes</b>, the list the answer is built from. Round 1 searched the question as it is:</p>
        ${hits(Q_TWO)}
        <p class="task">Step 1: what do these three chunks give you, and what is missing?</p>
        ${stage(0, S0)}
        ${ok(0) ? `${kit.feedback("Right. Half the answer: you know who, not which workshop. That fact is in some other chunk, and you need the name to search for it.", true)}
          <p class="task">Step 2: pick the query for round 2.</p>${stage(1, S1)}` : ""}
        ${ok(1) ? `${kit.feedback(`Right. Round 2 found ${idList(ids(R2))}. c01 was already in the notes, so only ${idList(ids(R2).filter(c => !ids(Q_TWO).includes(c)))} are new.`, true)}
          ${hits(R2, { mark: "c08", old: ids(Q_TWO) })}
          <p class="task">Step 3: the notes now hold ${notes2.length} chunks (${idList(notes2)}). Search again, or answer?</p>${stage(2, S2)}` : ""}
        ${ok(2) ? kit.feedback(`Right. Two rounds: the first found the chair, and you needed her name to write the second query. In the single search, c08 came ${ORD[rankOf(Q_TWO, "c08")]} (score ${scoreOf(Q_TWO, "c08")}), just outside the top 3. So why not search once with a bigger k (more chunks from one search)? Here it would have worked, by luck: only ${N_CHUNKS} chunks, and c08 shares the word “workshop” with the question. In a programme of hundreds of chunks, her workshop could rank anywhere, and the words that find it, her name, only come from round 1. A bigger k also makes every prompt longer. A question like this is called <b>multi-hop</b>: each search depends on what the last one found. And the moment you decided you had enough is the <b>stop rule</b>.`, true) : ""}`;
      [0, 1, 2].forEach(i => {
        const box = el.querySelector("#st" + i);
        if (box) box.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
          st[i] = +b.dataset.i;
          for (let j = i + 1; j < 3; j++) if (!ok(i)) st[j] = null;
          paint();
          if (ok(0) && ok(1) && ok(2)) done();
        });
      });
    };
    paint();
  }

  /* 6. Use it with predictions: how does the loop end for three questions? Checked against the real runs. */
  // the programme's workshops and who runs each, read from PROG
  const WORKSHOPS = Object.keys(PROG).filter(c => /Workshop( run|:)/.test(PROG[c])).map(c => `${c} (${PROG[c].match(/[Rr]un by ((Dr\. )?[^.:]+)/)[1]})`);
  const ENDS = ["ENOUGH after round 1", "ENOUGH after round 2", "Stops: a query repeats", "Stops: out of rounds"];
  const endOf = run => run.why === "enough" ? run.rounds.length - 1 : run.why === "repeated query" ? 2 : 3;
  const roundsHtml = run => run.rounds.map((r, i) => `<div class="${P}round"><b>Round ${i + 1}</b> · search “${esc(r.q)}”<br>top 3: <span class="${P}ids">${idList(r.found)}</span>${r.added.length < r.found.length ? ` (new: ${r.added.length ? idList(r.added) : "none"})` : ""}<br>check replied:${quote(r.rec.text)}${MODEL_CAP}</div>`).join("")
    + `<div class="${P}stop">Stopped: ${run.why}</div>`;
  const PRED = [
    { q: Q_ONE, run: RUN_ONE, right: "The keynote is one fact in one chunk. Round 1 found it first (c02), and the check said ENOUGH. One search, one model call.",
      wrong: "The keynote is one fact, and one chunk has it. Look at round 1 in the trace." },
    { q: Q_TWO, run: RUN_TWO, note: "One honest note on this run. With an earlier wording of c08 (“Workshop: build an evaluation set … Run by Amara Okafor.”), round 2 searched the same query and missed it: its only new chunks were c10 and c11 (recording check-two-hop-2). We reworded c08 for the lesson. The second query only finds a chunk that shares its words.", right: "As you traced by hand: round 1 found the chair, the check asked for her workshop by name, round 2 found c08, ENOUGH.",
      wrong: "This is the question you traced: one round for the chair, one for her workshop. Look at the trace." },
    { q: Q_CLOSE, run: RUN_CLOSE, right: "Tomás Rivera runs no workshop in this programme. Round 2 found nothing new, so the check asked for the same query again, and the repeat rule stopped the loop. Without that rule, round 3 would run the same search for nothing. The helper should now say it found no such workshop, not guess.",
      wrong: "Tomás Rivera runs no workshop in this programme, so the check never gets its missing fact. Look at what round 2 found and what the check asked for next." }
  ];
  function predict({ el, done, kit }) {
    style();
    const ans = PRED.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Let a model run the rounds</h1>
        <p class="lead">The same steps as a loop. Search with the latest query and add the new chunks to the notes. Then a model checks the notes, with this instruction:</p>
        ${quote(CHECK_SYSTEM)}
        <p class="lead">Three <b>stop rules</b> end the loop: the check says ENOUGH; it asks for a query that was already run; or ${MAX_ROUNDS} rounds are used up.</p>
        <p class="${P}small">The programme has ${WORKSHOPS.length} workshops: ${esc(idList(WORKSHOPS))}.</p>
        <p class="task">Predict how the loop ends for each question. The real run appears after you pick.</p>
        ${PRED.map((p, i) => {
          const a = ans[i], right = endOf(p.run);
          return `<div class="lcase" id="c${i}"><p>“${esc(p.q)}”</p>${kit.options(ENDS, { picked: a, correct: right })}
            ${a == null ? "" : kit.feedback(a === right ? p.right : p.wrong, a === right) + roundsHtml(p.run) + (p.note ? `<p class="${P}small">${esc(p.note)}</p>` : "")}</div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PRED.every((p, j) => ans[j] === endOf(p.run))) done();
      }));
    };
    paint();
  }

  /* 7. The loop as Python: a stepped replay of the traced two-hop run. */
  // docs/ai-path/runs/s5a-multi-step-retrieval/rounds.py, find_notes, line for line (short lines so it fits a phone)
  const CODE = [
    "def find_notes(question, rounds=3):",
    "    notes, queries = [], [question]",
    "    for round_no in range(1, rounds + 1):",
    "        found = search_ids(queries[-1])",
    "        notes += new_only(found, notes)",
    "        verdict = check(question, notes)",
    "        if verdict == \"ENOUGH\":",
    "            return notes, \"enough\"",
    "        query = verdict.removeprefix(TAG)",
    "        if query in queries:",
    "            return notes, \"repeated query\"",
    "        queries.append(query)",
    "    return notes, \"out of rounds\""
  ];
  // docs/ai-path/runs/s5a-multi-step-retrieval/trace.out.txt: { line, event, vars } = about to run `line`, with the
  // variables as they are then. Every step, unaltered.
  const TRACE = [
    {"line": 1, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3}},
    {"line": 2, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": [], "queries": ["Which workshop is run by the speaker who chairs the opening panel?"]}},
    {"line": 3, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": [], "queries": ["Which workshop is run by the speaker who chairs the opening panel?"], "round_no": 1}},
    {"line": 4, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": [], "queries": ["Which workshop is run by the speaker who chairs the opening panel?"], "round_no": 1, "found": ["c01", "c14", "c13"]}},
    {"line": 5, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?"], "round_no": 1, "found": ["c01", "c14", "c13"]}},
    {"line": 6, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?"], "round_no": 1, "found": ["c01", "c14", "c13"], "verdict": "SEARCH: workshop run by Dr. Amara Okafor"}},
    {"line": 8, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?"], "round_no": 1, "found": ["c01", "c14", "c13"], "verdict": "SEARCH: workshop run by Dr. Amara Okafor"}},
    {"line": 9, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?"], "round_no": 1, "found": ["c01", "c14", "c13"], "verdict": "SEARCH: workshop run by Dr. Amara Okafor", "query": "workshop run by Dr. Amara Okafor"}},
    {"line": 11, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?"], "round_no": 1, "found": ["c01", "c14", "c13"], "verdict": "SEARCH: workshop run by Dr. Amara Okafor", "query": "workshop run by Dr. Amara Okafor"}},
    {"line": 2, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?", "workshop run by Dr. Amara Okafor"], "round_no": 1, "found": ["c01", "c14", "c13"], "verdict": "SEARCH: workshop run by Dr. Amara Okafor", "query": "workshop run by Dr. Amara Okafor"}},
    {"line": 3, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?", "workshop run by Dr. Amara Okafor"], "round_no": 2, "found": ["c01", "c14", "c13"], "verdict": "SEARCH: workshop run by Dr. Amara Okafor", "query": "workshop run by Dr. Amara Okafor"}},
    {"line": 4, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?", "workshop run by Dr. Amara Okafor"], "round_no": 2, "found": ["c01", "c08", "c10"], "verdict": "SEARCH: workshop run by Dr. Amara Okafor", "query": "workshop run by Dr. Amara Okafor"}},
    {"line": 5, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13", "c08", "c10"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?", "workshop run by Dr. Amara Okafor"], "round_no": 2, "found": ["c01", "c08", "c10"], "verdict": "SEARCH: workshop run by Dr. Amara Okafor", "query": "workshop run by Dr. Amara Okafor"}},
    {"line": 6, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13", "c08", "c10"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?", "workshop run by Dr. Amara Okafor"], "round_no": 2, "found": ["c01", "c08", "c10"], "verdict": "ENOUGH", "query": "workshop run by Dr. Amara Okafor"}},
    {"line": 7, "event": "line", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13", "c08", "c10"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?", "workshop run by Dr. Amara Okafor"], "round_no": 2, "found": ["c01", "c08", "c10"], "verdict": "ENOUGH", "query": "workshop run by Dr. Amara Okafor"}},
    {"line": 7, "event": "return", "vars": {"question": "Which workshop is run by the speaker who chairs the opening panel?", "rounds": 3, "notes": ["c01", "c14", "c13", "c08", "c10"], "queries": ["Which workshop is run by the speaker who chairs the opening panel?", "workshop run by Dr. Amara Okafor"], "round_no": 2, "found": ["c01", "c08", "c10"], "verdict": "ENOUGH", "query": "workshop run by Dr. Amara Okafor"}}
  ];
  // Each shown step: the line that ran, with the variables right after it (the next trace step's variables).
  const STEPS = TRACE.slice(0, -1).map((s, i) => ({ line: s.line, before: s.vars, after: TRACE[i + 1].vars }));
  const sayStep = ({ line, before, after }) => {
    const q = (after.queries || [])[(after.queries || []).length - 1];
    switch (line) {
      case 1: return "Start with empty notes. The only query so far is the question itself.";
      case 2: return `Round ${after.round_no} of at most ${after.rounds}. The <code>for</code> loop is stop rule 3.`;
      case 3: return `Search with the latest query, “${esc(q)}”. Top 3: ${idList(after.found)}.`;
      case 4: { const added = after.notes.filter(c => !before.notes.includes(c)), kept = after.found.filter(c => before.notes.includes(c));
        return `<code>new_only</code> keeps only chunks not already in the notes${kept.length ? ` (${idList(kept)} ${kept.length === 1 ? "was" : "were"} there already)` : ""}: ${added.length} new, ${after.notes.length} in all.`; }
      case 5: return `Ask the model about the question and all ${after.notes.length} notes. Its reply: “${esc(after.verdict)}”.`;
      case 6: return after.verdict === "ENOUGH" ? "The reply is ENOUGH: stop rule 1 fires." : "Not ENOUGH, so the loop goes on.";
      case 7: return "Return the notes and the reason, “enough”. The answer step gets these notes.";
      case 8: return `Cut <code>TAG</code>, “SEARCH: ”, off the reply: the next query is “${esc(after.query)}”.`;
      case 9: return "Has this query been run before? No. If it had, stop rule 2 would end the loop on the next line.";
      case 11: return `Keep it as the latest query. The list now holds ${after.queries.length} queries.`;
      default: return "";
    }
  };
  function asCode({ el, done, kit }) {
    style();
    let i = 0;
    const paint = () => {
      const s = STEPS[i], v = s.after;
      el.innerHTML = `<h1>The loop, in Python</h1>
        <p class="lead">This is the code that made those runs. <code>search_ids</code> returns the ids of the top 3 chunks. <code>new_only(found, notes)</code> keeps the ids in <code>found</code> that are not in <code>notes</code> yet. <code>TAG</code> is the text “SEARCH: ”. <code>check</code> sends the question and the notes to the model and returns its one-line reply (here replayed from the recordings).</p>
        <p class="task">Step through the two-hop question to the end. Watch which query each round searches.</p>
        ${kit.code(CODE, s.line)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === STEPS.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>round_no <b>${v.round_no == null ? "–" : v.round_no}</b></span><span>notes <b>${v.notes ? (v.notes.length ? idList(v.notes) : "[]") : "–"}</b></span><span>verdict <b>${v.verdict ? esc(v.verdict) : "–"}</b></span><span>step <b>${i + 1} / ${STEPS.length}</b></span></div>
        ${kit.feedback(sayStep(s))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === STEPS.length - 1) done(); };
    };
    paint();
  }

  /* 8. Broken on purpose: one line changed; the loop searches the original question every round. */
  // rounds.py, find_notes_broken: the listing with its one changed line
  const CODE_BROKEN = CODE.map((l, i) => i === 0 ? "def find_notes_broken(question, rounds=3):" : i === 3 ? "        found = search_ids(question)" : l);
  function broken({ el, done, kit }) {
    style();
    const st = [null, null];
    const S0 = { opts: ["Round 1 missed the workshop chunk.", "The check asked for the same search twice.", "Round 2 searched the original question again, not the query the check asked for.", "The repeat rule stopped the loop too early."], correct: 2,
      why: ["That is normal for a two-hop question: round 1 can only find the chair. Round 2 exists to find the rest.",
        "That is a symptom. The check saw the same notes both times, so it asked for the same missing fact both times.",
        null,
        "The repeat rule did its job. Round 3 would have searched the same words and found the same chunks. It saved a wasted round."] };
    const S1 = { opts: ["In the found = line: search with queries[-1] instead of question", "Raise rounds from 3 to 5", "Delete the repeat check"], correct: 0,
      why: [null, "More rounds would run the same search more times. The bug is what each round searches, not how many rounds there are.", `Then the loop runs all ${MAX_ROUNDS} rounds, the same search each time, and still never finds c08.`] };
    const stage = (i, S) => `<div class="${P}stage" id="st${i}">${kit.options(S.opts.map(esc), { picked: st[i], correct: S.correct })}
      ${st[i] == null || st[i] === S.correct ? "" : kit.feedback(S.why[st[i]], false)}</div>`;
    const paint = () => {
      const ok = i => st[i] === [S0, S1][i].correct;
      el.innerHTML = `<h1>Broken on purpose: a loop that never moves on</h1>
        <p class="lead">One line of the loop was changed, and the two-hop question was run again. This is the real trace, with the recorded replies of the check. The workshop was never found.</p>
        ${roundsHtml(RUN_BROKEN)}
        ${kit.code(CODE_BROKEN, -1)}
        <p class="task">What caused the failure?</p>
        ${stage(0, S0)}
        ${ok(0) ? `${kit.feedback(`Right. The check asked for “${esc(searchOf(RUN_BROKEN.rounds[0].rec.text))}”, but round 2 searched “${esc(RUN_BROKEN.rounds[1].q)}” again and got the same ${idList(RUN_BROKEN.rounds[1].found)}.`, true)}
          <p class="task">Which change fixes it?</p>${stage(1, S1)}` : ""}
        ${ok(1) ? kit.feedback("Right. The loop stored the check's query in <code>queries</code> and never used it. When a loop repeats itself, look first at what goes into each round. Here it was the same question every time.", true) : ""}`;
      [0, 1].forEach(i => {
        const box = el.querySelector("#st" + i);
        if (box) box.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
          st[i] = +b.dataset.i;
          if (i === 0 && !ok(0)) st[1] = null;
          paint();
          if (ok(0) && ok(1)) done();
        });
      });
    };
    paint();
  }

  /* 9. The big picture: what for, when not, what it costs; one decision. */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = ["Allow more rounds so hard questions get more tries.", "Skip the rewrite when there is no earlier chat to resolve, and keep the ENOUGH stop.", "Drop the check and always run three rounds."];
    const correct = 1;
    const why = ["That adds calls to the slow path. One-fact questions already stop after round 1; what they pay for is the rewrite in front of the search.", null,
      `Then every question pays for ${MAX_ROUNDS} searches, and nothing decides when the notes are enough. The keynote question would search ${MAX_ROUNDS} times for a fact it had after one.`];
    const paint = () => {
      el.innerHTML = `<h1>When to rewrite, when to go round again</h1>
        <div class="${P}big">
        <p><b>What for.</b> Follow-ups that lean on the chat (“it”, “that one”) need a rewrite. Questions where one fact leads to the next need rounds.</p>
        <p><b>When not.</b> A first message with nothing to resolve. A question one chunk answers. A comparison of times or numbers (“after lunch”, “the cheapest”): filter or sort on fields such as start time or price instead. Counting across all documents: a search returns a few chunks, not all of them.</p>
        <p><b>What it costs.</b> A rewrite is a model call before the search can start, so the member waits longer. Every round adds a search and a model call. A rewrite can change the meaning, as the after-lunch one did. A loop without stop rules burns calls.</p></div>
        <p class="task">Your helper now rewrites every message and allows up to ${MAX_ROUNDS} rounds. Members say it got slow. Most of their questions are like “${esc(Q_ONE)}”, typed as the first message. What do you change first?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. In the real run the keynote question took ${RUN_ONE.rounds.length} search and ${RUN_ONE.rounds.length} check. A rewrite in front of it is one more model call that buys nothing: there is no chat to resolve.`, true)
          : kit.feedback(why[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, with two "neither" cases. */
  const KINDS = ["Rewrite the query", "Retrieve in rounds", "Neither"];
  const CASES = [
    { q: "A bank's help chat. A customer asked about the Easy Saver account, then writes: “What is the interest on it?”", a: 0,
      say: ["Yes. “It” means the Easy Saver account, and only the chat knows that. Rewrite to “interest rate of the Easy Saver account” before searching.",
        "One fact is missing, and it is in the chat, not in another document. No second search is needed once the query names the account.",
        "The search would get “What is the interest on it?” and could return any account's rate. The account's name is in the chat: rewrite."] },
    { q: "An HR assistant is asked: “What is the parental leave in the country where our largest office is?”", a: 1,
      say: ["There is no chat to resolve: the question is already standalone. It needs two facts: first which country, then that country's leave policy.",
        "Yes. One search finds where the largest office is; only then can you search for that country's parental leave. Each search depends on the last.",
        "One search will not find both facts: no document says “largest office” and the leave rule together. Search for the office first, then the policy."] },
    { q: "A support lead asks the knowledge-base bot: “How many of last year's tickets mention refunds?”", a: 2,
      say: ["Rewriting does not help: the query is already clear. The problem is counting. A search returns the top few chunks, never all the matching tickets.",
        "More rounds still return a few chunks each, never all of the tickets. Counting needs every matching ticket: run a count in the ticket database and let the model explain the number.",
        "Right: neither. A search returns the top few chunks, not every match, so it cannot count. Run a count in the ticket database, and let the model explain the number."] },
    { q: "A shopper's first message in a store's chat: “What is the return window for shoes?”", a: 2,
      say: ["There is no earlier chat, and the message already names what it asks about. A rewrite is a model call that changes nothing here.",
        "One fact, in one policy chunk. One search finds it; a check and a second round only add waiting.",
        "Right: neither. One fact, no chat to lean on. One search answers it."] }
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Rewrite, rounds, or neither?</h1>
        <p class="lead">Four situations away from the conference.</p>
        <p class="task">Pick what each one needs. Pick again if you change your mind.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${esc(c.q)}</p>${kit.options(KINDS, { picked: ans[i], correct: c.a })}${ans[i] == null ? "" : kit.feedback(c.say[ans[i]], ans[i] === c.a)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((x, j) => ans[j] === x.a)) done();
      }));
    };
    paint();
  }

  /* 11. What next: a browser exercise follows; name the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can now keep a search on track</h1>
      <p class="lead">Rewrite a follow-up into a standalone query, because the search sees only the query. Retrieve in rounds when one fact leads to the next, and stop on ENOUGH, on a repeated query, or after a fixed number of rounds.</p>
      <p class="lead"><b>Practice:</b> a short exercise in Python on this page follows the lesson. You write the retrieve-check-retrieve loop with its three stop rules, on this programme and the recorded replies.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. ${nx.id === "s5a-citations" ? "The notes your loop collects become the chunks an answer must cite, and you will check that every citation points to one of them." : "It builds on the retrieval you shaped here."}</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Rewriting queries and retrieving in rounds",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/2305.14283",
      "https://arxiv.org/abs/2212.10509",
      "https://arxiv.org/abs/1809.09600",
      "https://docs.ollama.com/api/embed",
      "https://ollama.com/library/all-minilm"
    ],
    interview: [{
      q: "Your docs chatbot answers first questions well, but follow-ups like “and for the enterprise plan?” get wrong answers. What do you look at, and what do you change?",
      good: ["Log the exact query sent to the search: the follow-up goes in word for word, and the search never sees the chat",
        "Add a rewrite step that turns the follow-up into a standalone query using the chat, before retrieval",
        "Measure it: on real follow-ups, compare hit rate in the top k for the raw message and the rewrite",
        "Check that rewrites keep the meaning, and skip the rewrite when there is no chat to resolve, since it adds a model call"],
      weak: "Paste the whole chat into the vector search, or switch to a bigger model. The first drowns the new question when the topic changes; the second does not see the chat either."
    }, {
      q: "A question needs two facts from two different documents, and one retrieval keeps missing the second. How would you design the retrieval, and how do you stop it from running forever?",
      good: ["Retrieve, then have a model check the notes and reply ENOUGH or a query for the missing fact, then search again with that query",
        "Search with the new query each round, and add only chunks not already in the notes",
        "Stop on ENOUGH, on a repeated query, and after a fixed number of rounds",
        "Each round costs a search plus a model call, so log the rounds and use one round for one-fact questions",
        "When the loop stops without the fact, say it was not found instead of guessing"],
      weak: "Raise k to 20 so everything comes back at once. It may work on a small set, but in a large one the second fact can rank anywhere, because the words that find it come from the first search; and every prompt gets longer."
    }],
    screens: [situation, byHand, modelRewrites, spotIdea, twoHop, predict, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: FOLLOW.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: ROWS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#st0 [data-wrong]"], right: ["#st0 [data-right]", "#st1 [data-right]", "#st2 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: PRED.map((_, i) => `#c${i} [data-right]`) },
      { right: Array(STEPS.length - 1).fill("[data-next]") },
      { wrong: ["#st0 [data-wrong]"], right: ["#st0 [data-right]", "#st1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
