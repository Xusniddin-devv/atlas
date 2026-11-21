/* Lesson: a RAG pipeline from scratch (s5a-rag-pipeline).
   Story: a coworking space's member bot answering questions about meeting-room bookings, guest passes and mail.
   Ideas: (1) retrieve, assemble, answer: the model answers from text put into the prompt at question time, and a
   vector search picks that text; built from scratch on precomputed vectors with NumPy. (2) The same pipeline in
   LangChain, mapped step by step to the from-scratch one.
   Data, all from real runs on 2026-11-13:
   - docs/ai-path/runs/s5a-rag-pipeline/handbook.json (the made-up handbook and the member questions)
   - runs/.../embed.py -> embed.out.txt, vectors.json (Ollama all-minilm, 384 numbers per text)
   - runs/.../pipeline.py -> pipeline.out.txt (scores, prompts, the line-by-line trace of build_prompt)
   - runs/.../lc_pipeline.py -> lc_pipeline.out.txt (LangChain: same chunks, same scores, identical messages;
     the whole chain run once with a very small local chat model)
   - docs/ai-path/recordings/s5a-rag-pipeline/*.json (model answers, recorded with scripts/ai/record.mjs)
   Every number on screen is computed here from those constants. Plain browser script. */
(() => {
  const ID = "s5a-rag-pipeline", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5a-rag-pipeline.ipynb";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = n => WORDS[n] || String(n);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- data: the handbook (runs/s5a-rag-pipeline/handbook.json) ---------- */
  const HANDBOOK = [
    ["rooms-booking", "Meeting rooms are booked in the member app, up to 14 days ahead. A booking is held for 15 minutes after its start time. If nobody checks in on the tablet by the room door, the room is released for others."],
    ["rooms-hours", "Every member gets 6 meeting-room hours each month. Extra hours are charged to your monthly invoice. Unused hours do not carry over to the next month."],
    ["rooms-cancel", "Cancel a room booking at least 2 hours before it starts and the hours go back to your monthly allowance. Later cancellations and no-shows still count against your hours."],
    ["guests-daily", "Members may bring up to 2 guests per day. Register each guest in the app before they arrive, and the front desk prints a day pass. Guests must leave by 18:00 and cannot book rooms themselves."],
    ["guests-events", "For a meeting or event with more than 2 guests, book the event hall instead. Event hall requests need at least 7 days' notice and are approved by the community manager."],
    ["mail-arrival", "Letters and parcels addressed to members are kept at the front desk. You get an app notification when something arrives. Parcels heavier than 20 kg cannot be accepted."],
    ["mail-holding", "The front desk holds mail for 30 days. After 30 days, letters are returned to the sender and parcels are given back to the courier."],
    ["mail-forward", "Mail forwarding to another address is available on the Business plan only. Forwarded mail is sent once a week, on Mondays."],
    ["wifi", "The Wi-Fi password changes on the first day of each month. The current password is shown on the home screen of the member app."],
    ["access", "The building is open from 07:00 to 22:00 on weekdays. Members on a 24/7 plan can enter at any time with their key card."]
  ];
  const NCH = HANDBOOK.length, TEXT = Object.fromEntries(HANDBOOK), IDS = HANDBOOK.map(c => c[0]);
  const QUESTIONS = {
    "q-guests": "Can my two clients come in on Friday afternoon to meet me?",
    "q-noshow": "I missed my 10am room booking yesterday. Do I get those hours back?",
    "q-parcel": "A parcel came for me three weeks ago while I was travelling. Is it still at the desk?",
    "q-dog": "Can I bring my dog to work with me?"
  };
  const K = 2;          // pipeline.py: build_prompt(member_question, k=2)
  const DIM = 384;      // embed.out.txt: "384 numbers each"
  const SYSTEM = "You answer questions from members of a coworking space. Use only the handbook excerpts in the user message. If they do not contain the answer, say that the handbook does not say, and suggest asking the front desk. Answer in at most three sentences.";
  const SYSTEM_BARE = "You answer questions from members of a coworking space. Answer in at most three sentences.";

  /* From runs/s5a-rag-pipeline/pipeline.out.txt: every chunk's similarity to each question, best first
     (cosine similarity = dot product of the unit-length vectors, rounded to 4 places by the script). */
  const SCORES = {"q-guests":[["guests-daily",0.4325],["rooms-booking",0.3981],["guests-events",0.3513],["access",0.3283],["rooms-cancel",0.2639],["mail-forward",0.2419],["rooms-hours",0.2067],["mail-arrival",0.142],["mail-holding",0.0908],["wifi",0.0376]],"q-noshow":[["rooms-cancel",0.66],["rooms-booking",0.523],["guests-daily",0.4644],["access",0.3977],["guests-events",0.382],["rooms-hours",0.3374],["mail-forward",0.2626],["mail-holding",0.2462],["wifi",0.1539],["mail-arrival",0.1321]],"q-parcel":[["mail-holding",0.5442],["mail-arrival",0.5318],["mail-forward",0.3181],["rooms-booking",0.1682],["rooms-cancel",0.1309],["guests-daily",0.082],["wifi",0.0803],["guests-events",0.0659],["access",0.0401],["rooms-hours",0.0289]],"q-dog":[["mail-arrival",0.1675],["mail-forward",0.1671],["guests-events",0.1142],["guests-daily",0.1103],["access",0.1086],["rooms-cancel",0.0845],["mail-holding",0.0831],["rooms-booking",0.0727],["rooms-hours",0.0294],["wifi",-0.0421]]};
  const topK = q => SCORES[q].slice(0, K).map(r => r[0]);
  const f4 = v => v.toFixed(4);

  /* From pipeline.out.txt: the user message build_prompt() made for q-parcel (the last trace step's `user`). */
  const USER_PARCEL = "Handbook excerpts:\n<chunk id=\"mail-holding\">The front desk holds mail for 30 days. After 30 days, letters are returned to the sender and parcels are given back to the courier.</chunk>\n<chunk id=\"mail-arrival\">Letters and parcels addressed to members are kept at the front desk. You get an app notification when something arrives. Parcels heavier than 20 kg cannot be accepted.</chunk>\n\nQuestion: A parcel came for me three weeks ago while I was travelling. Is it still at the desk?";
  const EXCERPTS_PARCEL = USER_PARCEL.slice("Handbook excerpts:\n".length, USER_PARCEL.indexOf("\n\nQuestion:"));

  /* Recorded model answers (docs/ai-path/recordings/s5a-rag-pipeline/<name>.json, shown whole, not altered).
     All five with temperature 0; the requests are in runs/s5a-rag-pipeline/requests/. */
  const REC = {
    bareGuests: { src: "s5a-rag-pipeline/bare-q-guests", provider: "openrouter", model: "google/gemini-2.5-flash-lite", temperature: 0, recordedAt: "2026-11-13",
      text: "Yes, absolutely! Please let us know the approximate number of people attending and if you'll need any specific meeting rooms or amenities. We'll do our best to accommodate your clients' visit." },
    ragGuests: { src: "s5a-rag-pipeline/answer-q-guests", provider: "openrouter", model: "google/gemini-2.5-flash-lite", temperature: 0, recordedAt: "2026-11-13",
      text: "Yes, your two clients can come in on Friday afternoon to meet you. They must be registered in the app before they arrive, and they need to leave by 6 PM." },
    ragParcel: { src: "s5a-rag-pipeline/answer-q-parcel", provider: "openrouter", model: "google/gemini-2.5-flash-lite", temperature: 0, recordedAt: "2026-11-13",
      text: "Yes, your parcel should still be at the front desk. The front desk holds mail for 30 days, and your parcel arrived three weeks ago." },
    ragDog: { src: "s5a-rag-pipeline/answer-q-dog", provider: "openrouter", model: "google/gemini-2.5-flash-lite", temperature: 0, recordedAt: "2026-11-13",
      text: "The handbook does not say. Please ask the front desk." }
  };
  /* From runs/s5a-rag-pipeline/lc_pipeline.out.txt: the LangChain chain run on this Mac with a very small local
     chat model (Ollama gemma3:270m, temperature 0). Trailing newlines trimmed. A code run, not a recording. */
  const TINY = {
    "q-noshow": "Yes, you will get the hours back.",
    "q-dog": "Yes, you can bring your dog to work with you."
  };
  /* From lc_pipeline.out.txt: LangChain's similarity_search_with_score, k=2, and the message check. */
  const LC_SCORES = {"q-guests":[["guests-daily",0.4325],["rooms-booking",0.3981]],"q-noshow":[["rooms-cancel",0.66],["rooms-booking",0.523]],"q-parcel":[["mail-holding",0.5442],["mail-arrival",0.5318]],"q-dog":[["mail-arrival",0.1675],["mail-forward",0.1671]]};
  const LC_SAME = { "q-guests": "identical", "q-noshow": "identical", "q-parcel": "identical", "q-dog": "identical" };

  /* ---------- shared bits ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}quote { margin: 16px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.${P}quote .${P}who { margin: 0 0 6px; font: 600 13px var(--font); color: var(--muted); }
.${P}quote .${P}say { margin: 0; color: var(--ink); font-weight: 400; }
.${P}quote .${P}cap { margin: 8px 0 0; font: 500 12.5px var(--font); color: var(--muted); }
.${P}prompt { margin: 14px 0 0; padding: 12px 14px; border-radius: 10px; background: var(--sunk); color: var(--ink); font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}prompt b { font-family: var(--font); font-size: 12px; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; display: block; margin-bottom: 2px; }
.${P}chunks .lopts > .${P}after { flex-basis: 100%; margin-bottom: 6px; }
.${P}chunks .lopts button { width: 100%; font-weight: 500; font-size: 15.5px; }
.${P}chunks .lopts button .${P}id, .${P}id { display: block; font: 600 12.5px var(--mono); color: var(--muted); margin-bottom: 2px; }
.${P}q { margin: 16px 0 0; padding: 10px 14px; border-left: 3px solid var(--ink); font-weight: 600; }
.${P}strip { display: grid; grid-template-columns: repeat(${NCH}, 1fr); gap: 3px; margin-top: 16px; font: 500 12px var(--mono); text-align: center; }
.${P}strip span { padding: 6px 0; border: 1px solid var(--line); border-radius: 6px; color: var(--ink); }
.${P}strip span.${P}i { border: 0; color: var(--muted); padding: 0; }
.${P}strip span.${P}top { box-shadow: inset 0 0 0 2px var(--good); background: var(--good-soft); color: var(--good); font-weight: 700; }
.${P}check { list-style: none; padding: 0; margin: 14px 0 0; }
.${P}check label { display: flex; gap: 12px; align-items: flex-start; min-height: 44px; padding: 10px 0; border-top: 1px solid var(--line); cursor: pointer; }
.${P}check label { padding: 0; align-items: center; }
.${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0 0 0 -11px; flex: none; position: relative; cursor: pointer; background: transparent; border: 0; }
.${P}check input::after { content: ""; position: absolute; left: 11px; top: 11px; width: 20px; height: 20px; border: 2px solid var(--ink-2); border-radius: 4px; box-sizing: border-box; font: 700 14px/16px var(--font); text-align: center; color: var(--bg); }
.${P}check input:checked::after { content: "\\2713"; background: var(--ink); border-color: var(--ink); }
.${P}check input:focus-visible::after { outline: 2px solid var(--ink); outline-offset: 2px; }
.${P}check span { padding: 10px 0; }
.${P}small { font-size: 15px; color: var(--ink-2); }
.${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
.${P}scores { min-width: 0; width: 100%; max-width: 420px; font-size: 14.5px; }
.${P}scores td, .${P}scores th { padding-right: 12px; }
.${P}scores tr.${P}out td { color: var(--faint); }
.${P}code .lcode { overflow-x: visible; }
.${P}code .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + 6ch); text-indent: -6ch; }
@media (max-width: 700px) { .${P}code .lcode div { padding-left: calc(12px + 6ch); } }
`;
    document.head.appendChild(s);
  }
  // a recorded model answer, with the caption the guide asks for
  const quote = (who, rec) => `<div class="${P}quote"><p class="${P}who">${who}</p><p class="${P}say">${esc(rec.text)}</p><p class="${P}cap">Recorded model output, ${rec.recordedAt}</p></div>`;
  const runQuote = (who, text, capText) => `<div class="${P}quote"><p class="${P}who">${who}</p><p class="${P}say">${esc(text)}</p><p class="${P}cap">${capText}</p></div>`;
  const chunkCard = id => `<div class="${P}quote"><span class="${P}id">${esc(id)}</span><p class="${P}say">${esc(TEXT[id])}</p></div>`;
  // the pipeline's ranking for a question: the first `show` chunks, those past k faded
  // listings wrap long lines at phone width (lesson-local CSS above), so nothing hides past the right edge
  const codeBox = (lines, active) => `<div class="${P}code">${LessonKit.code(lines, active)}</div>`;
  const scoreTable = (q, show, mark) => `<table class="ltable ${P}scores"><caption>pipeline ranking, k = ${K}${mark ? "; your chunk is marked" : ""}; rows after #${K} are not sent</caption><thead><tr><th>#</th><th>chunk</th><th>score</th></tr></thead><tbody>${SCORES[q].slice(0, show).map(([id, s], i) =>
    `<tr class="${i < K ? (id === mark ? "hit" : "") : P + "out"}"><td>${i + 1}</td><td>${esc(id)}</td><td>${f4(s)}</td></tr>`).join("")}</tbody></table>`;

  /* ---------- 1. The situation: the bare model answers a guest question ---------- */
  function bareAnswer({ el, done, kit }) {
    style();
    let ans = null;
    const g = TEXT["guests-daily"];
    const opts = [
      "The clients are turned away: members may bring only one guest.",
      "The clients arrive unregistered, so there is no day pass, and nobody told them when they must leave.",
      "Nothing goes wrong: the answer says yes, and the handbook says yes."
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>A member bot that sounds sure</h1>
        <p class="lead">A coworking space wants a bot that answers members' questions about room bookings, guests and mail. The rules are in the member handbook. As a first try, someone sends the member's question straight to a small hosted model, with no handbook.</p>
        <div class="${P}q">${esc(QUESTIONS["q-guests"])}</div>
        ${quote("A small hosted model, given only the question, answered:", REC.bareGuests)}
        <p class="lead" style="margin-top:16px">The handbook's paragraph about guests:</p>
        ${chunkCard("guests-daily")}
        <p class="task">The member follows the bot's answer on Friday. What goes wrong?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The handbook asks for two things the answer never mentions: register each guest in the app first, and guests leave by ${g.match(/\d\d:\d\d/)[0]}. The model has never read this handbook. It answered from what such places usually do, and even spoke as if it were the staff ("let us know", "we'll do our best"). It sounds sure and helpful, and it is missing the rules that matter. This lesson builds the usual fix for a bot that must answer from your own documents.`, true)
          : ans === 0 ? kit.feedback(`The handbook allows up to ${g.match(/up to (\d+)/)[1]} guests per day, so two clients are fine. The trouble is what the answer leaves out: read the handbook paragraph again for what the member must do before Friday.`, false)
          : kit.feedback(`"Yes" is right, but the member needs more than yes. The handbook asks for each guest to be registered in the app before they arrive, and the answer never says so. The model could not know: it has never seen this handbook.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 2. By hand: pick the chunk that answers each question, then compare with the pipeline ---------- */
  const TOPIC = {
    "rooms-booking": "how to book a room, and when an unused booking is released",
    "rooms-hours": "how many room hours a member gets each month",
    "rooms-cancel": "cancelling a room booking, and what happens to the hours",
    "guests-daily": "bringing up to two guests a day",
    "guests-events": "events with more than two guests",
    "mail-arrival": "letters and parcels arriving at the front desk",
    "mail-holding": "how long the front desk keeps mail",
    "mail-forward": "forwarding mail to another address",
    "wifi": "the Wi-Fi password",
    "access": "opening hours and key cards"
  };
  const HAND = [
    { q: "q-guests", answer: "guests-daily", need: "The question is whether two clients may come in, and what the member must do for them.",
      near: {
        "guests-events": "This one is for more than two guests. Two clients are exactly two, so the daily guest rule applies.",
        "access": "Opening hours do matter on a Friday afternoon, but this chunk says nothing about guests: not registering them, not when they must leave.",
        "rooms-booking": "The member may want a room, but the question is whether the clients may come in at all. This chunk is only about booking rooms."
      } },
    { q: "q-noshow", answer: "rooms-cancel", need: "The question is whether the hours of a missed booking come back.",
      near: {
        "rooms-booking": "This says an unused booking is released after 15 minutes. It does not say whether the hours come back.",
        "rooms-hours": "This gives the monthly allowance, not what happens to the hours of a missed booking."
      } },
    { q: "q-parcel", answer: "mail-holding", need: "The question is whether a parcel that arrived three weeks ago is still at the desk.",
      near: {
        "mail-arrival": "This says parcels are kept at the desk, but not for how long. Three weeks needs the holding time.",
        "mail-forward": "Forwarding sends mail away. The question is whether the parcel is still at the desk."
      } }
  ];
  function pickChunks({ el, done, kit }) {
    style();
    let qi = 0, wrong = null, solved = false;
    const paint = () => {
      const H = HAND[qi], correct = IDS.indexOf(H.answer);
      const list = HANDBOOK.map(([id, t]) => `<span class="${P}id">${esc(id)}</span>${esc(t)}`);
      const top = topK(H.q), rank = SCORES[H.q].findIndex(r => r[0] === H.answer) + 1;
      const extra = top.filter(id => id !== H.answer);
      el.innerHTML = `<h1>Pick what the bot should read</h1>
        <p class="lead">The handbook is split into ${word(NCH)} short paragraphs, called <b>chunks</b>, each with an id. Before a model can answer from the handbook, someone has to choose which chunks it gets. You pick first. Then you see what a real pipeline picked: a small program that chooses chunks for each question, run on these same chunks. Screen 6 shows its code.</p>
        <p class="task">Question ${qi + 1} of ${HAND.length}. Pick the one chunk that answers it.</p>
        <div class="${P}q">${esc(QUESTIONS[H.q])}</div>
        <div class="lpanel ${P}chunks">${kit.options(list, { picked: solved ? correct : wrong, correct })}</div>`;
      // the feedback goes right under the chunk just tapped, so it is in view on a phone
      const fbHtml = `${solved ? kit.feedback(`Right: <b>${esc(H.answer)}</b> holds the answer. The pipeline ranked all ${word(NCH)} chunks by a similarity score (screen 6 shows how it is made) and kept the top ${word(K)} (that number is called <b>k</b>). Your chunk came ${rank === 1 ? "first" : "number " + rank}. ${extra.length ? `It also took <b>${extra.map(esc).join(", ")}</b>, because it always takes ${word(K)}. ${extra.includes("mail-arrival") ? "That one is related and does no harm." : "You did not need it."}` : ""}`, true) + scoreTable(H.q, K + 1, H.answer)
            + (qi < HAND.length - 1 ? `<div class="lsteps"><button type="button" class="btn" data-nextq>Next question</button></div>` : kit.feedback(`All ${word(HAND.length)} done. The pipeline picked the same chunk as you every time, without reading a word: it compared numbers. Screen 6 shows how.`))
          : wrong != null ? kit.feedback(H.near[IDS[wrong]] || `This chunk is about ${TOPIC[IDS[wrong]]}. ${H.need}`, false) : ""}`;
      const at = solved ? correct : wrong;
      if (at != null) el.querySelector(`.lopts button[data-i="${at}"]`).insertAdjacentHTML("afterend", `<div class="${P}after">${fbHtml}</div>`);
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (solved) return;
        const i = +b.dataset.i;
        if (i === correct) { solved = true; wrong = null; paint(); if (qi === HAND.length - 1) done(); }
        else { wrong = i; paint(); }
      });
      const nx = el.querySelector("[data-nextq]");
      if (nx) nx.onclick = () => { qi++; solved = false; wrong = null; paint(); window.scrollTo(0, 0); };
    };
    paint();
  }

  /* ---------- 3. By hand: fill in the prompt, then see the one the pipeline sent and its answer ---------- */
  const SLOT_INS = [
    ["You are a helpful assistant for a coworking space. Members ask about rooms, guests and mail. Answer them politely, in at most three sentences.", "Nothing here stops the model from answering from what it guesses, which is exactly how the screen 1 answer came out. Tell it to use only the excerpts, and what to do when they do not hold the answer."],
    [SYSTEM, null],
    ["Answer the member's question from the handbook excerpts below. Be friendly and confident, and always give the member a clear yes or no.", "\"Always a clear yes or no\" forces an answer even when the excerpts say nothing about the question, and \"confident\" makes it sound sure: the screen 1 problem again. The model needs a way out: say the handbook does not say."]
  ];
  const SLOT_DATA = [
    [`Only the ids: ${topK("q-parcel").join(", ")}`, "The model cannot open an id. It sees only the text inside the prompt, so the chunk text itself has to go in."],
    [`All ${NCH} chunks of the handbook`, `With ${word(NCH)} short chunks this would still work. But the handbook will grow to hundreds of chunks: sending all of them makes every question slower and more expensive, and the one line that matters gets buried. Send what this question needs.`],
    [`The ${word(K)} retrieved chunks, each in a <chunk> tag with its id`, null]
  ];
  function fillPrompt({ el, done, kit }) {
    style();
    const ans = [null, null], correct = [1, 2];
    const paint = () => {
      const ok = ans[0] === correct[0] && ans[1] === correct[1];
      const block = (i, title, slots) => `<div class="lcase" id="c${i}"><p>${title}</p>${kit.options(slots.map(s => esc(s[0])), { picked: ans[i], correct: correct[i] })}${ans[i] == null ? "" : ans[i] === correct[i] ? kit.feedback(i === 0 ? "Right. It says where the answer must come from, and what to do when it is not there." : "Right. The text the answer needs, and nothing else. The tags keep handbook text apart from your instructions.", true) : kit.feedback(slots[ans[i]][1], false)}</div>`;
      el.innerHTML = `<h1>Fill in the prompt</h1>
        <p class="lead">Now the parcel question. The two chunks are picked. A chat prompt has a system message (the instruction) and a user message (the data and the question). The handbook will grow to hundreds of chunks as the space adds rules, so build the prompt for that.</p>
        <div class="${P}q">${esc(QUESTIONS["q-parcel"])}</div>
        <p class="task">Choose what goes into each part of the prompt.</p>
        ${block(0, "System message: the instruction", SLOT_INS)}
        ${block(1, "User message: the handbook text", SLOT_DATA)}
        ${ok ? `<p class="lead" style="margin-top:16px">This is the exact prompt the pipeline sent:</p>
          <div class="${P}prompt"><b>system</b>${esc(SYSTEM)}</div>
          <div class="${P}prompt"><b>user</b>${esc(USER_PARCEL)}</div>
          ${quote("A small hosted model answered:", REC.ragParcel)}
          ${kit.feedback(`Right answer, with the reason. Three weeks is inside the 30 days the handbook gives.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === correct[0] && ans[1] === correct[1]) done();
      }));
    };
    paint();
  }

  /* ---------- 4. Spot the idea: same model, same question, two answers ---------- */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const same = REC.bareGuests.model === REC.ragGuests.model, t0 = REC.bareGuests.temperature === REC.ragGuests.temperature;
    const opts = [
      "Between the two calls, the model learned the handbook.",
      "The second prompt held the guest rule as text, and the instruction said to answer only from it.",
      "The second call went to a stronger model.",
      "The second call used a lower temperature, so the model was more careful."
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Same question, two answers</h1>
        <p class="lead">The guest question from screen 1, sent twice to a small hosted model.</p>
        <div class="${P}q">${esc(QUESTIONS["q-guests"])}</div>
        ${quote("First call: the question alone.", REC.bareGuests)}
        ${quote(`Second call: the instruction, the top ${word(K)} chunks (${topK("q-guests").map(esc).join(", ")}) and the question.`, REC.ragGuests)}
        <p class="task">Why does the second answer have the handbook's rules?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The model did not change at all. What changed is what it could read: the answer was in the prompt (the 18:00 rule even came back as "6 PM"). This is <b>retrieval-augmented generation</b>, RAG for short, in three steps: <b>retrieve</b> the chunks that match the question, <b>assemble</b> them into the prompt with an instruction, and let the model <b>answer</b> (the "generation"). The model's own memory is fixed when it is trained; the handbook is an outside memory you look up at question time.`, true)
          : ans === 0 ? kit.feedback("A call to a model does not train it. Its weights are the same before and after. Send the bare question a third time and you get a guess again, because nothing of the handbook stayed behind.", false)
          : ans === 2 ? kit.feedback(`Both recordings came from the same model${same ? "" : " family"}. A stronger model would still not know this space's rules: they are written only in this handbook.`, false)
          : kit.feedback(`${t0 ? `Both calls were sent at temperature ${REC.bareGuests.temperature}.` : "The temperatures differed, but that is not the reason."} Temperature changes how the next word is picked, not what the model knows. No setting can make it know rules it has never read.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 5. Use it with predictions: a question the handbook does not cover ---------- */
  function predictDog({ el, done, kit }) {
    style();
    const pa = [null, null];
    const P0 = ["None: no chunk is about dogs.", `${cap(word(K))}: the ${word(K)} closest chunks, whatever they are.`, `All ${NCH}, because none fits well.`];
    const P1 = ["Yes, dogs are welcome.", "The handbook does not say; ask the front desk.", `No: parcels over ${TEXT["mail-arrival"].match(/(\d+) kg/)[1]} kg cannot be accepted.`];
    const c = [1, 1];
    const dogTop = SCORES["q-dog"][0][1];
    const others = ["q-guests", "q-noshow", "q-parcel"].map(q => SCORES[q][0][1]);
    const lowest = Math.min(...others);
    const paint = () => {
      const s0 = pa[0] === c[0], s1 = pa[1] === c[1];
      el.innerHTML = `<h1>A question the handbook does not cover</h1>
        <p class="lead">A member asks something no chunk talks about. The pipeline is the same: score all ${word(NCH)} chunks, keep the top ${word(K)}, put them in the prompt under the same instruction.</p>
        <div class="${P}q">${esc(QUESTIONS["q-dog"])}</div>
        <div class="lcase" id="p0"><p>Predict: how many chunks will the pipeline put into the prompt?</p>
          ${kit.options(P0, { picked: pa[0], correct: c[0] })}
          ${pa[0] == null ? "" : s0 ? kit.feedback(`Right: ${word(K)}, always. A vector search has no idea of "nothing fits". It ranks every chunk and keeps the top k. Here the best score is ${f4(dogTop)}; on the three earlier questions the best was ${f4(lowest)} or more.`, true) + scoreTable("q-dog", K + 1)
            : pa[0] === 0 ? kit.feedback(`The search never says "none". It sorts all ${word(NCH)} chunks by score and keeps the first ${word(K)}, even when every score is low.`, false)
            : kit.feedback(`k is ${K}, so the pipeline keeps ${word(K)}, however poor the fit. It never switches to sending everything.`, false)}</div>
        ${s0 ? `<div class="lcase" id="p1"><p>Predict: what will the small hosted model answer, with these two mail chunks in its prompt?</p>
          ${kit.options(P1, { picked: pa[1], correct: c[1] })}
          ${pa[1] == null ? "" : s1 ? kit.feedback("Right. Nothing in the excerpts is about dogs, and the instruction gave the model a way out.", true) + quote("A small hosted model answered:", REC.ragDog)
              + kit.feedback(`This depends on the model following the instruction. In our LangChain run on screen 7, a very small local model got the same prompt and answered: "${esc(TINY["q-dog"])}" Retrieval only chooses what the model reads. The model still has to use it.`)
            : pa[1] === 0 ? kit.feedback("Nothing the model was given says dogs are welcome. The instruction says to answer only from the excerpts, and to say so when they do not hold the answer.", false)
            : kit.feedback("That mixes up the mail chunk with the question. The 20 kg rule is about parcels, not pets. The instruction tells the model what to do when the excerpts do not hold the answer.", false)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((box, i) => box.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        pa[i] = +b.dataset.i; paint();
        if (pa[0] === c[0] && pa[1] === c[1]) done();
      }));
    };
    paint();
  }

  /* ---------- 6. From scratch in Python: the traced build_prompt ---------- */
  // runs/s5a-rag-pipeline/pipeline.py, build_prompt, line for line (line 0 = the def line)
  const CODE = [
    "def build_prompt(member_question, k=2):",
    "    question_vec = question_vecs[member_question[\"id\"]]",
    "    scores = handbook_vecs @ question_vec",
    "    order = np.argsort(-scores)",
    "    top = order[:k]",
    "    excerpts = \"\\n\".join(f'<chunk id=\"{chunk_ids[i]}\">{chunk_texts[i]}</chunk>' for i in top)",
    "    user = f\"Handbook excerpts:\\n{excerpts}\\n\\nQuestion: {member_question['text']}\"",
    "    return [{\"role\": \"system\", \"content\": SYSTEM}, {\"role\": \"user\", \"content\": user}]"
  ];
  // pipeline.out.txt, "trace of build_prompt(q-parcel)": line, event and the variables (excerpts and user are the strings above)
  const SC_P = [0.1682,0.0289,0.1309,0.082,0.0659,0.5318,0.5442,0.3181,0.0803,0.0401];
  const OR_P = [6,5,7,0,2,3,8,4,9,1];
  const TRACE = [
    { line: 1, event: "line" },
    { line: 2, event: "line" },
    { line: 3, event: "line", scores: SC_P },
    { line: 4, event: "line", scores: SC_P, order: OR_P },
    { line: 5, event: "line", scores: SC_P, order: OR_P, top: [6, 5] },
    { line: 6, event: "line", scores: SC_P, order: OR_P, top: [6, 5], excerpts: true },
    { line: 7, event: "line", scores: SC_P, order: OR_P, top: [6, 5], excerpts: true, user: true },
    { line: 7, event: "return", scores: SC_P, order: OR_P, top: [6, 5], excerpts: true, user: true }
  ];
  const GATE = TRACE.findIndex(t => t.order && !t.top); // predict `top` before stepping past this
  function scratchCode({ el, done, kit }) {
    style();
    let i = 0, pred = null;
    const top = OR_P.slice(0, K), low = OR_P.slice(-K).reverse(), first = Array.from({ length: K }, (_, j) => j);
    const popts = [first, top, low].map(a => `[${a.join(", ")}]`);
    const pc = 1;
    const say = t => {
      if (t.event === "return") return `The function returns the two messages. They are word for word the prompt you saw on screen 3. Sending them to a chat API is the third step, <b>answer</b>, and that call made the recorded parcel answer.`;
      switch (t.line) {
        case 1: return `<code>k</code> is ${K}. The question is the parcel one. Next: look up its vector. It was made in advance by the same embedding model as the chunks, ${DIM} numbers long.`;
        case 2: return `<code>handbook_vecs</code> is a table of ${NCH} rows, one row of ${DIM} numbers per chunk, all made once before any question came in: these are the <b>precomputed vectors</b>. Rows are numbered from 0, in handbook order. Next: <code>@</code> (NumPy's matrix product) multiplies every row by the question vector, which gives one score per chunk.`;
        case 3: return `Line above: <code>scores</code> now holds ${NCH} numbers, one per chunk. The vectors have length 1, so each product is the <b>cosine similarity</b>: closer to 1 means closer in meaning. Chunk 6 (${IDS[6]}) scores ${f4(t.scores[6])}. Next: sort the chunks by score.`;
        case 4: return `Line above: <code>np.argsort</code> returns the positions of the scores in sorted order, smallest first. The minus sign flips the scores, so the highest comes first. <code>order</code> starts with ${t.order[0]} (${IDS[t.order[0]]}). Next: keep the first k.`;
        case 5: return `Line above: <code>top</code> is the first ${word(K)} positions, ${t.top.map(j => `${j} (${IDS[j]})`).join(" and ")}. The <b>retrieve</b> step is done. Next: wrap each chosen chunk in a tag with its id.`;
        case 6: return `Line above: <code>excerpts</code> holds the two tagged chunks (shown below). Next: put the excerpts and the question into the user message. This is the <b>assemble</b> step.`;
        default: return `Line above: <code>user</code> is ready, the excerpts, then the question. Next, the last line: put the system instruction first and return both messages.`;
      }
    };
    const paint = () => {
      const t = TRACE[i], gated = i === GATE && pred !== pc;
      const strip = t.scores ? `<div class="${P}strip" aria-label="scores per chunk">${t.scores.map((_, j) => `<span class="${P}i">${j}</span>`).join("")}${t.scores.map((s, j) => `<span class="${t.top && t.top.includes(j) ? P + "top" : ""}">${s.toFixed(2).replace(/^0/, "").replace(/^-0/, "-")}</span>`).join("")}</div>
        <p class="${P}small" style="margin:6px 0 0">Each column is one chunk: its position on top, its score below (2 places).${t.top ? " Outlined: the chunks in <code>top</code>." : ""}</p>` : "";
      el.innerHTML = `<h1>The same pipeline in Python</h1>
        <p class="lead">This function does retrieve and assemble for one question. It ran on our Mac with NumPy and no framework; each step below replays that run. The marked line runs next; the values show what the lines above it produced.</p>
        <p class="task">Step through to the end. One step asks you to predict first.</p>
        ${codeBox(CODE, t.line)}
        ${strip}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || gated ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>k <b>${K}</b></span><span>order <b>${t.order ? "[" + t.order.join(", ") + "]" : "–"}</b></span><span>top <b>${t.top ? "[" + t.top.join(", ") + "]" : "–"}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say(t))}
        ${i === GATE ? `<div class="lcase" id="pt"><p>Predict: what will <code>top = order[:k]</code> hold?</p>${kit.options(popts.map(esc), { picked: pred, correct: pc })}
          ${pred == null ? "" : pred === pc ? kit.feedback(`Right: the first ${word(K)} entries of <code>order</code>, the two highest scores. Press Next step.`, true)
            : pred === 0 ? kit.feedback(`Positions ${first.join(" and ")} are the first chunks in the handbook (${first.map(j => IDS[j]).join(", ")}), not the closest. <code>order[:k]</code> takes the first ${word(K)} entries of <code>order</code>, and <code>order</code> is sorted by score.`, false)
            : kit.feedback(`Those are the ${word(K)} lowest scores, at the end of <code>order</code>. The minus sign in <code>argsort(-scores)</code> put the highest first, so the front of <code>order</code> is the best match.`, false)}</div>` : ""}
        ${t.excerpts ? `<div class="${P}prompt"><b>excerpts</b>${esc(EXCERPTS_PARCEL)}</div>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { if (i === GATE && pred !== pc) return; i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll("#pt .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* ---------- 7. The real library: LangChain, mapped to the from-scratch steps ---------- */
  // runs/s5a-rag-pipeline/lc_pipeline.py: the lines between the "lines shown in the lesson" markers, then the chain line (llm there is ChatOllama)
  const LC = [
    { lines: ["store = InMemoryVectorStore.from_texts(chunk_texts, OllamaEmbeddings(model=\"all-minilm\"),", "                                       metadatas=[{\"id\": i} for i in chunk_ids])"], step: 0 },
    { lines: ["retriever = store.as_retriever(search_kwargs={\"k\": 2})"], step: 1 },
    { lines: ["prompt = ChatPromptTemplate.from_messages([", "    (\"system\", SYSTEM),", "    (\"human\", \"Handbook excerpts:\\n{excerpts}\\n\\nQuestion: {question}\")])", "def join_chunks(docs):", "    return \"\\n\".join(f'<chunk id=\"{d.metadata[\"id\"]}\">{d.page_content}</chunk>' for d in docs)", "up_to_prompt = {\"excerpts\": retriever | join_chunks, \"question\": RunnablePassthrough()} | prompt"], step: 2 },
    { lines: ["chain = up_to_prompt | llm | StrOutputParser()"], step: 3 }
  ];
  const STEPS = ["Make the chunk vectors once, before any question", "Score, sort, keep the top k", "Wrap the chunks and fill the prompt", "Send the prompt to the model"];
  // each block lists the steps in its own fixed order, so the right pick is not in the same place every time
  const ORD = [[2, 0, 3, 1], [3, 2, 1, 0], [2, 3, 1, 0], [0, 2, 1, 3]];
  // WHY_NOT[block][picked step]: why that step is not what these lines do
  const WHY_NOT = [
    [null,
      "Score and sort? No question exists yet when this line runs, so there is nothing to compare. It embeds every chunk and keeps the vectors in memory: the make-the-vectors-once step.",
      "Fill the prompt? There is no template and no question here. This line embeds every chunk and keeps the vectors in memory: the make-the-vectors-once step.",
      "Send to the model? <code>OllamaEmbeddings</code> is an embedding model: it turns text into numbers and writes no answer. This line makes and keeps the chunk vectors, before any question."],
    ["Make the vectors? They already exist: the store made them on the line above. This line sets up the search that, for each question, scores the chunks and keeps the top k.",
      null,
      "Fill the prompt? Nothing here builds text. <code>as_retriever</code> only sets up the search that returns the top k chunks for each question.",
      "Send to the model? No chat model appears here. <code>as_retriever</code> sets up the search that returns the top k chunks for each question."],
    ["Make the vectors? No embedding model appears here. These lines build text: the template, <code>join_chunks</code> tagging each chunk, and the dictionary that fills both blanks. That is the assemble step.",
      "Score and sort? The retriever shows up here, but it was made on the line above; these lines only feed its chunks into <code>join_chunks</code>. What they add is the template and the tags: the assemble step.",
      null,
      "Send to the model? <code>up_to_prompt</code> ends at <code>prompt</code>, which fills a template with text. No chat model is called here; that comes on the next line."],
    ["Make the vectors? Nothing here embeds anything: <code>up_to_prompt</code> already holds the search and the template. The new piece is <code>llm</code>, the model call.",
      "Score and sort? The search is inside <code>up_to_prompt</code>, built on the lines above. What this line adds is <code>llm</code>, which sends the filled prompt to the model.",
      "Fill the prompt? <code>up_to_prompt</code> already does that, on the lines above. This line adds <code>llm</code>, which sends that prompt to the model, and <code>StrOutputParser</code>, which turns its reply into text.",
      null]
  ];
  function langchain({ el, done, kit }) {
    style();
    const ans = LC.map(() => null);
    const qs = ["q-guests", "q-noshow", "q-parcel", "q-dog"];
    const sameRet = qs.every(q => JSON.stringify(LC_SCORES[q]) === JSON.stringify(SCORES[q].slice(0, K)));
    const allSame = qs.every(q => LC_SAME[q] === "identical");
    const paint = () => {
      const fin = LC.every((b, i) => ans[i] === b.step);
      el.innerHTML = `<h1>The same pipeline in LangChain</h1>
        <p class="lead">LangChain gives each step a ready-made piece, and <code>|</code> pipes one piece's output into the next, a bit like chaining <code>.then()</code>. We rebuilt the pipeline with the same embedding model, the same k and the same prompt words, and ran it on our Mac. <code>llm</code> is any LangChain chat model object.</p>
        <p class="task">For each piece, pick the from-scratch step it replaces. A right pick folds the list away.</p>
        ${LC.map((b, i) => `<div class="lcase" id="c${i}">${codeBox(b.lines)}${ans[i] === b.step ? kit.options([STEPS[b.step]], { picked: 0, correct: 0 }) : kit.options(ORD[i].map(s => STEPS[s]), { picked: ans[i] == null ? null : ORD[i].indexOf(ans[i]), correct: ORD[i].indexOf(b.step) })}${ans[i] == null ? "" : ans[i] === b.step ? kit.feedback(["Right. <code>from_texts</code> calls the embedding model for every chunk and keeps the vectors. Use the same embedding model for chunks and questions, or the scores mean nothing.", `Right. The retriever does the scoring and sorting. <code>k</code> matters: if you leave <code>search_kwargs</code> out, LangChain's default is 4, not ${K}.`, "Right. The template has two blanks, <code>{excerpts}</code> and <code>{question}</code>. The dictionary sends the question two ways: through the retriever and <code>join_chunks</code> to make the tagged excerpts, and unchanged (<code>RunnablePassthrough</code>) into <code>{question}</code>.", "Right. <code>llm</code> gets the filled prompt and replies with a message; <code>StrOutputParser</code> turns that message into plain text."][i], true) : kit.feedback(WHY_NOT[i][ans[i]], false)}</div>`).join("")}
        ${fin ? kit.feedback(`What the run printed: ${sameRet ? `LangChain returned the same top ${word(K)} chunks with the same scores for all ${word(qs.length)} questions (its in-memory store also uses cosine similarity)` : "different chunks"}, and the messages it built were ${allSame ? `<b>identical</b> to the from-scratch ones for all ${word(qs.length)}` : "<b>not</b> identical"}. Same pipeline, less code. The price: when it goes wrong, you need to know which piece does what, and now you do.`)
          + runQuote(`For the model step we plugged in a very small local model. Asked "${esc(QUESTIONS["q-noshow"])}" with the right chunk (${esc(topK("q-noshow")[0])}) in its prompt, it answered:`, TINY["q-noshow"], "Code output from our run on our Mac, 2026-11-13")
          + kit.feedback("Wrong: the chunk says no-shows still count. Retrieval was perfect and the answer still failed. That is why you check the steps one at a time: which chunks the search returned, what prompt went to the model, what the model answered.") : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (ans[i] === LC[i].step) return; // answered: only the right step is left on screen
        ans[i] = ORD[i][+b.dataset.i]; paint();
        if (LC.every((x, j) => ans[j] === x.step)) done();
      }));
    };
    paint();
  }

  /* ---------- 8. The big picture: what it is for, when not, and which cost bites ---------- */
  const COSTS = ["Keeping the vectors fresh", "Extra time on every question", "A quiet miss"];
  const COST_CASES = [
    ["The rules change every few days, and members say the bot quotes old ones.", 0,
      ["", "Speed is not the complaint. Old answers mean old text is still in the index: every changed chunk must be embedded again.", "The bot does find something; it is just out of date. The vectors still hold the old wording, so re-embed what changed."]],
    ["The bot runs on a lobby kiosk, and answers must start almost at once.", 1,
      ["Nothing here says the rules change. The cost that bites is time: an embedding call and a search come before the model starts, and the longer prompt is slower to read.", "", "Nothing says the answers are missing. The problem is waiting: every question pays for an embedding call, a search and a longer prompt."]],
    ["Members often ask about things the handbook never covers.", 2,
      ["The handbook may be up to date; it simply lacks the answer. The search still returns k chunks, as with the dog question, and the model must notice they do not help.", "Speed is not the problem. The search returns k chunks even when none holds the answer, so a weak instruction or model answers anyway.", ""]]
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = COST_CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for RAG</h1>
        <p class="lead"><b>What it is for:</b> answering from your own text that the model never saw. It also suits text that changes, because you re-embed the changed chunks instead of retraining, and answers that should point back to their source.</p>
        <p class="lead"><b>When not:</b> if the whole text fits easily in the prompt, just paste it; retrieval only adds a step that can miss. If the answer is a live number (hours left this month, an order's status), query the database. If you want a tone or format, change the prompt.</p>
        <p class="lead"><b>What it costs:</b> embedding everything once and again on each change; on every question an embedding call, a search and a longer prompt; and misses that fail quietly.</p>
        <p class="task">For each situation, pick the cost that bites first.</p>
        ${COST_CASES.map(([q, r, why], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(COSTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : ans[i] === r ? kit.feedback(["Right. Changed rules mean changed chunks, and each must be embedded again before the search can find the new wording.", "Right. Every question pays for an embedding call and a search before the model even starts, and the prompt grows by k chunks.", "Right. The search never says \"nothing found\". The instruction and the model must catch it, and a small model may not."][r], true) : kit.feedback(why[ans[i]], false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (COST_CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* ---------- 9. Recognise it in new situations ---------- */
  const CASES = [
    ["A law firm's assistant must answer associates' questions from thousands of past contracts, and say which contract each answer came from.", true,
      "Yes. Far too much text for one prompt, the model has never seen these contracts, and each chunk keeps its id, so the answer can point back to its source.",
      "Thousands of contracts will not fit in a prompt, and the model has never read them. Retrieve the few chunks that match each question; their ids show where the answer came from."],
    ["A banking app's assistant must answer \"How much is in my account right now?\"", false,
      "No. The answer is a live number in the bank's database, not a sentence in any document. Retrieval would bring back text about accounts, not this account's balance. Look it up with a database query or an API call.",
      "No document holds this customer's balance right now. A search over documents brings back text about balances, never the number. The app has to query the database (or call an API) for it."],
    ["A writing tool turns a user's bullet points into a friendly email in the company's tone.", false,
      "No. Everything the model needs is already in the request: the bullet points. There is nothing to look up. Describe the tone in the prompt, or show an example or two.",
      "There is nothing to retrieve: the bullet points arrive with the request. Tone is a matter of instructions and examples in the prompt, not of missing facts."],
    ["A hospital's staff ask about drug-storage procedures from an intranet of 3,000 pages that is updated weekly.", true,
      "Yes. Many pages, the model has never seen them, and they change weekly: re-embed the changed pages instead of retraining anything.",
      "These pages are internal, so the model has never read them, there are too many for one prompt, and they change weekly. Retrieval picks the pages each question needs and stays current when you re-embed what changed."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a RAG pipeline help here?</h1>
        <p class="lead">${cap(word(CASES.length))} situations, no coworking space. RAG means: retrieve chunks of your text that match the question, put them in the prompt, let the model answer.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* ---------- 10. What next: the notebook checklist and the next lesson ---------- */
  const CHECKLIST = [
    `The vectors cell prints ${NCH} chunk vectors, ${DIM} numbers each, and the first vector's length is 1.0.`,
    `For the parcel question the top ${word(K)} chunks are ${topK("q-parcel").join(" and ")}, with scores close to each other (${f4(SCORES["q-parcel"][0][1])} and ${f4(SCORES["q-parcel"][1][1])} with all-minilm).`,
    `For the dog question the best score is far lower (${f4(SCORES["q-dog"][0][1])}) than for the other three, and ${word(K)} chunks still come back.`,
    `The LangChain cell prints "identical" for all ${word(Object.keys(LC_SAME).length)} questions: it built the same messages as the from-scratch code.`,
    "The very small local model's answers (from the lesson's run) say dogs are welcome. The recorded hosted model says the handbook does not say. The difference is the model, not retrieval."
  ];
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Build it yourself</h1>
      <p class="lead">You built retrieve, assemble and answer from scratch, and mapped each step to LangChain. Next, run the same code in a notebook.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a>` : "The notebook for this lesson is on its way."}</p>
      <p class="${P}small">What you should see while you run it (ticking is for you only):</p>
      <ul class="${P}check">${CHECKLIST.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${esc(c)}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead" style="margin-top:18px">Next: <b>${esc(nx.title)}</b>. It starts from this pipeline and asks what to do when one search is not enough, such as a follow-up question that makes no sense on its own.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "A RAG pipeline from scratch",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/2005.11401",
      "https://docs.ollama.com/capabilities/embeddings",
      "https://numpy.org/doc/stable/reference/generated/numpy.argsort.html",
      "https://reference.langchain.com/python/langchain_core/vectorstores/in_memory/InMemoryVectorStore",
      "https://reference.langchain.com/python/langchain_core/vectorstores/base/VectorStore/as_retriever",
      "https://reference.langchain.com/python/langchain_core/prompts/chat/ChatPromptTemplate",
      "https://reference.langchain.com/python/langchain_core/runnables/passthrough/RunnablePassthrough",
      "https://reference.langchain.com/python/langchain_core/output_parsers/string/StrOutputParser",
      "https://reference.langchain.com/python/langchain-ollama/embeddings/OllamaEmbeddings",
      "https://reference.langchain.com/python/langchain-ollama/chat_models/ChatOllama",
      "https://docs.langchain.com/oss/python/langchain/rag"
    ],
    interview: [
      {
        q: "You built a RAG bot over a company handbook with LangChain. A user says it confidently gave a wrong answer about the guest rules. How do you find where it went wrong?",
        good: [
          "Run that exact question and print the retrieved chunks with their scores: was the guest-rule chunk in the top k?",
          "If not, it is a retrieval problem: the same embedding model for chunks and questions, the chunking, the value of k.",
          "If it was, print the assembled prompt: is the chunk text there, and does the instruction say to answer only from it and to say when it does not know?",
          "If the prompt was right, the model ignored it: test a stronger model or a tighter instruction on the same prompt.",
          "Knowing which LangChain piece does retrieve, assemble and answer lets you check each step on its own."
        ],
        weak: "Switch to a bigger model or another framework straight away, without looking at what was retrieved and what was sent. That may hide a retrieval bug instead of fixing it."
      },
      {
        q: "Your manager wants a RAG pipeline for a bot that answers from a two-page FAQ and also tells customers where their order is. What do you build?",
        good: [
          "The FAQ fits easily in the prompt: paste it in and skip retrieval, which only adds a step that can miss.",
          "Order status is live data: query the order system for it; no document holds it.",
          "RAG pays off when the text is too large for the prompt, is private to the company, or changes often.",
          "Name the costs: an embedding call and a search per question, a longer prompt, re-embedding on change, and quiet misses."
        ],
        weak: "Put everything into a vector database because that is how RAG works. It misses that the order status is not in any document and that a small FAQ needs no search at all."
      }
    ],
    screens: [bareAnswer, pickChunks, fillPrompt, spotIdea, predictDog, scratchCode, langchain, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: HAND.flatMap((_, i) => i < HAND.length - 1 ? ["[data-right]", "[data-nextq]"] : ["[data-right]"]) },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#p0 [data-wrong]"], right: ["#p0 [data-right]", "#p1 [data-right]"] },
      { wrong: [...Array(GATE).fill("[data-next]"), "#pt [data-wrong]"], right: ["#pt [data-right]", ...Array(TRACE.length - 1 - GATE).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: LC.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: COST_CASES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
