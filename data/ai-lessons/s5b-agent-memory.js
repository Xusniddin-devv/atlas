/* Lesson: agent memory, scratchpad, session and long-term. Story: a personal fitness coach bot that should
   remember Mira's old knee injury but not yesterday's mood.
   Ideas: (1) three lifetimes: a scratchpad for one task, the session (this chat's messages), and a long-term
   store outside the model that you write on purpose; (2) long-term memory is a write step plus a recall step
   (a similarity search), and both can go wrong: the writer keeps the wrong thing, the search misses the right one.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5b-agent-memory/no-memory, with-memory, writer
     (requests in docs/ai-path/runs/s5b-agent-memory/requests/; mood-memory was recorded too and is not shown);
   - docs/ai-path/runs/s5b-agent-memory/memory_store.py + memory_store.out.txt: the from-scratch store, a small
     local embedding model (Ollama all-minilm) and cosine ranking: the full rankings and the traced recall().
   Mira's week (WEEK) is written for the lesson: user lines and tool lines, not model output (requests/week.txt).
   Lesson-local style: transcript rows, a ranking list and a tiers table (.lx-s5b-agent-memory-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s5b-agent-memory";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

  /* ---------- Data copied from the runs and recordings ---------- */
  // Mira's week, as sent to the writer (docs/ai-path/runs/s5b-agent-memory/requests/week.txt). tier: 0 this task, 1 this chat, 2 forever
  const WEEK = [
    { day: "Mon", who: "Mira", text: "Hi! Heads up: I hurt my left knee skiing in 2019. Deep squats and jumping still hurt it.", tier: 2,
      fb: ["It matters far beyond one job. Every leg workout she ever asks for needs it.",
           "It was true before this chat and stays true after it. If it ends with the chat, the next chat plans squats again, as you saw."] },
    { day: "Mon", who: "Mira", text: "Also I'm vegetarian, so no chicken in the meal ideas please.", tier: 2,
      fb: ["Every meal idea from now on needs it, not only the one being written now.",
           "A diet does not change between chats. Drop it and she has to say it again next week."] },
    { day: "Tue", who: "Mira", text: "Ugh, terrible mood today. I don't want to do anything.", tier: 1,
      fb: ["It is more than a working note for one job: it should shape the whole of today's chat, a gentler plan and a kinder tone. Keep it for the chat.",
           null,
           "It was true on Tuesday. Kept forever, it comes back weeks later as if she still felt that way. This is the yesterday's mood the bot should not remember."] },
    { day: "Wed", who: "Mira", text: "My goal: run 10 km without stopping by spring.", tier: 2,
      fb: ["A goal for months, not for one job. Every plan should build toward it.",
           "It lasts until spring. Lose it with the chat, and next week's plans no longer build toward the race."] },
    { day: "Wed", who: "weather tool", text: "Weather now: 3 °C, rain.", tier: 0,
      fb: [null,
           "It was true for an hour or so. It helped pick an indoor workout for the plan being built, and then it is stale. Next time, the tool is asked again.",
           "Weather changes by the hour. A stored copy is wrong tomorrow, and the tool gives a fresh one whenever it is needed."] },
    { day: "Thu", who: "Mira", text: "I like training in the morning, before work.", tier: 2,
      fb: ["A lasting preference, not a note for one job. Every schedule the bot suggests should use it.",
           "It is a habit, not today's news. Forget it and the bot keeps suggesting evening runs."] },
    { day: "Fri", who: "workout timer tool", text: "Round 2 of 4 done, 14 minutes left.", tier: 0,
      fb: [null,
           "Once this workout ends, the note is useless, even later the same day. It is a working note for the job that is running.",
           "In a week, “round 2 of 4” means nothing. It is a working note for one workout."] },
    { day: "Sat", who: "Mira", text: "Only 20 minutes today, I have a meeting at 8.", tier: 1,
      fb: ["It holds for every plan she asks for today, not for one step of one job. Keep it for the chat.",
           null,
           "Only today. Kept forever, every future workout gets cut to 20 minutes."] }
  ];
  const TIERS = ["This task", "This chat", "Forever"];

  // From docs/ai-path/recordings/s5b-agent-memory/no-memory.json (not altered)
  const COACH = "You are a fitness coach in a chat app. Answer with a numbered list of at most 6 exercises, one short line each, with no intro and no closing line.";
  const LEG = "Plan a 30-minute leg workout for today.";
  const REC_NO_MEM = {
    src: "s5b-agent-memory/no-memory",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    promptTokens: 49,
    text: "1. Squats (bodyweight or weighted)\n2. Lunges (alternating legs)\n3. Glute bridges\n4. Calf raises\n5. Romanian deadlifts (light weight)\n6. Wall sit"
  };
  // From docs/ai-path/recordings/s5b-agent-memory/with-memory.json (not altered). The system prompt is COACH plus
  // "What you remember about this user:" and the two memories recall() returned for LEG (RANK[0], top 2).
  const REC_WITH_MEM = {
    src: "s5b-agent-memory/with-memory",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    promptTokens: 93,
    text: "1.  Bodyweight Squats (focus on shallow range of motion)\n2.  Glute Bridges\n3.  Walking Lunges (controlled pace, avoid deep knee bend)\n4.  Calf Raises\n5.  Hamstring Curls (using a resistance band or machine)\n6.  Wall Sits"
  };
  // From docs/ai-path/recordings/s5b-agent-memory/writer.json (not altered; the reply was wrapped in a ```json fence)
  const WRITER_PROMPT = "You keep the long-term memory of a fitness coach bot. Read one week of chat lines from the user Mira and the bot's tools. Save anything about Mira that could be useful later. Return only a JSON array of short strings, one per memory.";
  const REC_WRITER = {
    src: "s5b-agent-memory/writer",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "```json\n[\n  \"Left knee injury from skiing in 2019, deep squats and jumping hurt it.\",\n  \"Vegetarian.\",\n  \"Wants to run 10 km without stopping by spring.\",\n  \"Prefers morning workouts.\",\n  \"Has a meeting at 8 AM on Saturday.\"\n]\n```"
  };
  const CAPTION = `Recorded model output, ${REC_NO_MEM.recordedAt}`;

  // From docs/ai-path/runs/s5b-agent-memory/memory_store.out.txt (STORE, RANK, RANK_WITH_MOOD, RANK_REWRITE, STEP)
  const STORE = [
    "Mira hurt her left knee skiing in 2019; deep squats and jumping still hurt it.",
    "Mira is vegetarian.",
    "Mira's goal is to run 10 km without stopping by spring.",
    "Mira likes to train in the morning, before work.",
    "Mira finished her first 5 km run in October.",
    "Mira finds burpees boring."
  ];
  const DIM = 384;
  const MOOD = "Mira was in a terrible mood on Tuesday and did not want to do anything.";
  const VEG_REWRITE = "Mira is vegetarian: no meat or fish in her meals.";
  // ranked: [score, index into STORE, or the text itself for a memory not in STORE]
  const RANK = [
    { query: "Plan a 30-minute leg workout for today.", ranked: [[0.277,0],[0.266,3],[0.203,2],[0.173,4],[0.016,5],[0.008,1]] },
    { query: "What should I eat after my long run?", ranked: [[0.197,4],[0.172,2],[0.168,1],[0.164,3],[0.089,0],[0.069,5]] },
    { query: "Can we move my training to the evening?", ranked: [[0.421,3],[0.151,2],[0.097,4],[0.067,0],[0.011,5],[-0.003,1]] }
  ];
  const RANK_MOOD = { query: "I really do not feel like training today.", ranked: [[0.344,3],[0.187,MOOD],[0.185,2],[0.149,4],[0.148,0],[0.124,5],[0.044,1]] };
  const RANK_REWRITE = { query: "What should I eat after my long run?", ranked: [[0.252,VEG_REWRITE],[0.197,4],[0.172,2],[0.164,3],[0.089,0],[0.069,5]] };
  const K = 2; // the k used for recall in the run and in the with-memory recording

  // The listing is recall() from memory_store.py, line for line (line 0 = def). The run prints scores rounded to
  // 3 decimals (rounded() in the script, display only); recall itself sorts the full-precision scores.
  const CODE = [
    "def recall(query, store, k):",
    "    q_vec = embed(query)",
    "    scored = []",
    "    for m in store:",
    "        score = cosine(q_vec, m[\"vec\"])",
    "        scored.append((score, m[\"text\"]))",
    "    scored.sort(reverse=True)",
    "    return scored[:k]"
  ];
  // Trace rows (STEP lines, query RANK[0].query, k = 2): [line about to run, event (l line, r return), memory (index), score, scored [[s, index]]]
  const TRACE = [[1,"l",null,null,[]],
    [2,"l",null,null,[]],
    [3,"l",null,null,[]],
    [4,"l",0,null,[]],
    [5,"l",0,0.2765464646338246,[]],
    [3,"l",0,0.2765464646338246,[[0.277,0]]],
    [4,"l",1,0.2765464646338246,[[0.277,0]]],
    [5,"l",1,0.007915513649904024,[[0.277,0]]],
    [3,"l",1,0.007915513649904024,[[0.277,0],[0.008,1]]],
    [4,"l",2,0.007915513649904024,[[0.277,0],[0.008,1]]],
    [5,"l",2,0.20303017419859218,[[0.277,0],[0.008,1]]],
    [3,"l",2,0.20303017419859218,[[0.277,0],[0.008,1],[0.203,2]]],
    [4,"l",3,0.20303017419859218,[[0.277,0],[0.008,1],[0.203,2]]],
    [5,"l",3,0.266341326271454,[[0.277,0],[0.008,1],[0.203,2]]],
    [3,"l",3,0.266341326271454,[[0.277,0],[0.008,1],[0.203,2],[0.266,3]]],
    [4,"l",4,0.266341326271454,[[0.277,0],[0.008,1],[0.203,2],[0.266,3]]],
    [5,"l",4,0.17267749484095035,[[0.277,0],[0.008,1],[0.203,2],[0.266,3]]],
    [3,"l",4,0.17267749484095035,[[0.277,0],[0.008,1],[0.203,2],[0.266,3],[0.173,4]]],
    [4,"l",5,0.17267749484095035,[[0.277,0],[0.008,1],[0.203,2],[0.266,3],[0.173,4]]],
    [5,"l",5,0.015739330128245358,[[0.277,0],[0.008,1],[0.203,2],[0.266,3],[0.173,4]]],
    [3,"l",5,0.015739330128245358,[[0.277,0],[0.008,1],[0.203,2],[0.266,3],[0.173,4],[0.016,5]]],
    [6,"l",5,0.015739330128245358,[[0.277,0],[0.008,1],[0.203,2],[0.266,3],[0.173,4],[0.016,5]]],
    [7,"l",5,0.015739330128245358,[[0.277,0],[0.266,3],[0.203,2],[0.173,4],[0.016,5],[0.008,1]]],
    [7,"r",5,0.015739330128245358,[[0.277,0],[0.266,3],[0.203,2],[0.173,4],[0.016,5],[0.008,1]]]];

  /* ---------- Derived from the data ---------- */
  const memText = m => typeof m === "number" ? STORE[m] : m;
  const NO_LINES = REC_NO_MEM.text.split("\n");
  const WITH_LINES = REC_WITH_MEM.text.split("\n");
  const SQUAT = NO_LINES.findIndex(l => /Squats/.test(l));
  const SAVED = JSON.parse(REC_WRITER.text.replace(/```json|```/g, ""));
  const SAVED_BAD = SAVED.findIndex(s => /meeting/i.test(s));
  const SAVED_VEG = SAVED.find(s => /vegetarian/i.test(s));
  const LEFT_OUT = WEEK.filter(w => w.tier !== 2).length - 1; // non-lasting lines the writer did not save (it saved one)
  const posOf = (rank, test) => rank.ranked.findIndex(([, m]) => test(memText(m)));
  const VEG_POS = posOf(RANK[1], t => t === STORE[1]);
  const VEG_SCORE = RANK[1].ranked[VEG_POS][0];
  const REWRITE_POS = posOf(RANK_REWRITE, t => t === VEG_REWRITE);
  const REWRITE_SCORE = RANK_REWRITE.ranked[REWRITE_POS][0];
  const MOOD_POS = posOf(RANK_MOOD, t => t === MOOD);
  const MOOD_SCORE = RANK_MOOD.ranked[MOOD_POS][0];
  const RECALLED = RANK[0].ranked.slice(0, K).map(([, m]) => memText(m));
  const EXTRA_TOKENS = REC_WITH_MEM.promptTokens - REC_NO_MEM.promptTokens;
  const COUNT = t => WEEK.filter(w => w.tier === t).length;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 8em 1fr; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-rank { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-rank li { display: grid; grid-template-columns: 3.2em 1fr auto; gap: 10px; align-items: baseline; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15px; line-height: 1.45; color: var(--muted); }
      .lx-${ID}-rank li b { font: 600 14px var(--mono); color: var(--ink); }
      .lx-${ID}-rank li.lx-${ID}-in { color: var(--ink); border-left: 3px solid var(--ink); padding-left: 8px; }
      .lx-${ID}-rank li span:last-child { font: 500 12.5px var(--mono); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-q { font: 600 15px/1.45 var(--mono); margin: 0 0 6px; overflow-wrap: anywhere; }
      .lx-${ID}-tiers { width: 100%; border-collapse: collapse; margin: 12px 0 0; font-size: 15px; line-height: 1.45; }
      .lx-${ID}-tiers th, .lx-${ID}-tiers td { text-align: left; vertical-align: top; padding: 8px 8px 8px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-tiers th { font: 600 13px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-opt { text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-day { display: block; font: 600 12.5px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
      .lx-${ID}-week .lopts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .lx-${ID}-week .lopts button { min-width: 0; padding-left: 6px; padding-right: 6px; }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1fr; } .lx-${ID}-tiers { font-size: 14px; } }
    `;
    document.head.appendChild(s);
  }
  const log = (kit, rows) => `<div class="lx-${ID}-log">${rows.map(([who, html]) =>
    `<div class="lx-${ID}-row"><div class="lx-${ID}-who">${kit.esc(who)}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>`;
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const cap = () => `<p class="lx-${ID}-cap">${CAPTION}</p>`;
  // a ranking: every memory with its score; the top k are marked "returned"
  const rankList = (kit, rank, k, label) => `<ol class="lx-${ID}-rank" aria-label="${kit.esc(label || "ranking")}">${rank.ranked.map(([s, m], i) =>
    `<li class="${i < k ? `lx-${ID}-in` : ""}"><b>${s.toFixed(3)}</b><span>${kit.esc(memText(m))}</span><span>${i < k ? "returned" : ""}</span></li>`).join("")}</ol>`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* 1. The situation: the bot plans squats for a bad knee, because each chat starts empty. */
  function firstAnswer({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const fbFor = i => {
      if (i === SQUAT) return [`Right. On Monday Mira wrote: “Deep squats and jumping still hurt it.” The first line of the plan is squats. The bot was not careless. This is a new chat, and the model keeps nothing between calls: it never saw Monday's message. Whatever the bot should know about Mira has to be in this request. This lesson is about that problem: how an agent carries what it learns about a user from one chat to the next. That is its memory.`, true];
      const line = NO_LINES[i];
      if (/Lunges/.test(line)) return ["A lunge bends the front knee a lot too, and a careful coach would ask her about it. But Mira named two things: deep squats and jumping. One line names one of them exactly.", false];
      return [`Mira did not name this one. Look for the line that is exactly what she said still hurts: deep squats or jumping.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>Squats for a bad knee</h1>
        <p class="lead">Mira uses a fitness coach bot in a chat app. On Monday she told it: “I hurt my left knee skiing in 2019. Deep squats and jumping still hurt it.” Three weeks later she opens a new chat:</p>
        ${log(kit, [["Mira", kit.esc(LEG)], ["coach bot", mono(kit, REC_NO_MEM.text)]])}
        ${cap()}
        <p class="lead">A small hosted model wrote the plan, with only the coach instructions and her message in front of it.</p>
        <p class="task">Which line goes straight against what Mira told the bot on Monday?</p>
        <div class="lpanel">${kit.options(NO_LINES.map(l => `<span class="lx-${ID}-opt">${kit.esc(l)}</span>`), { picked: ans, correct: SQUAT })}${ans == null ? "" : kit.feedback(...fbFor(ans))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === SQUAT) done(); });
    };
    paint();
  }

  /* 2. By hand: Mira's week, each line sorted into this task / this chat / forever. */
  function sortWeek({ el, done, kit }) {
    ensureStyle();
    const ans = WEEK.map(() => null);
    const allRight = () => WEEK.every((w, i) => ans[i] === w.tier);
    const paint = () => {
      const fin = allRight();
      el.innerHTML = `<h1>Mira's week: what should the bot keep?</h1>
        <p class="lead">Here are eight lines from Mira's week with the bot: her messages, and what two of the bot's tools sent back while it was working. For each one, decide how long the bot should keep it:</p>
        <p class="lead"><b>This task:</b> a working note, needed only while the bot does the current job. <b>This chat:</b> true for today's conversation, useless next week. <b>Forever:</b> still true and useful next month.</p>
        <p class="task">Sort every line. Pick again if you change your mind.</p>
        <div class="lx-${ID}-week">${WEEK.map((w, i) => {
          const ok = ans[i] === w.tier;
          const fb = ans[i] == null ? "" : ok ? kit.feedback(`${TIERS[w.tier]}.`, true) : kit.feedback(w.fb[ans[i]], false);
          return `<div class="lcase" id="c${i}"><p><span class="lx-${ID}-day">${kit.esc(w.day)} · ${kit.esc(w.who)}</span>${kit.esc(w.text)}</p>${kit.options(TIERS, { picked: ans[i], correct: w.tier })}${fb}</div>`;
        }).join("")}</div>
        ${fin ? kit.feedback(`All sorted: ${COUNT(2)} lines to keep forever, ${COUNT(1)} for this chat, ${COUNT(0)} only for the task. The knee stays; Tuesday's mood goes when Tuesday's chat ends. Half of this week should not outlive the chat. In a real agent, with all its tool output, the share is far larger.`, true) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (allRight()) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: a store outside the model, read before each answer. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Send every chat Mira ever had with each new request, newest first, so nothing is lost",
      "Nothing: the model will remember Mira, they have talked before",
      "Keep the lasting facts in a store outside the model, and before each answer put the ones that match her request into the prompt",
      "Retrain the model on Mira's chats every night, so her facts end up in its weights"
    ];
    const tiers = `<table class="lx-${ID}-tiers"><thead><tr><th>Memory</th><th>Where it lives</th><th>How long</th></tr></thead><tbody>
      <tr><td><b>Scratchpad</b></td><td>notes and tool results inside one run of the agent loop</td><td>until the task ends</td></tr>
      <tr><td><b>Session</b></td><td>this chat's messages list, the one you saw grow in the agent loop</td><td>until the chat ends</td></tr>
      <tr><td><b>Long-term</b></td><td>a store outside the model, such as a database: written on purpose, read by a search</td><td>until you change or delete it</td></tr></tbody></table>`;
    const fb = [
      ["It works for a week, then breaks. The list grows with every chat, every request pays to resend it, and it drags back Tuesday's mood and Friday's timer with the knee. You sorted most of those lines out of “forever” for a reason.", false],
      ["The model keeps nothing between calls. In the agent loop, every request had to carry the whole conversation. A new chat starts with an empty messages list, which is exactly why screen 1 planned squats.", false],
      [`Right. The three ways of keeping things you just sorted have names:${tiers}<p>Long-term memory is not inside the model. It is text you <b>write</b> to a store on purpose, and <b>recall</b> later by searching for what matches the new request. The rest of this lesson is those two steps.</p>`, true],
      ["Slow, costly, and one model per user. Worse, a fact baked into a model is hard to take out: when Mira's knee heals, you cannot just delete one line. A store you can read, edit and delete.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where does Monday's fact live?</h1>
        <p class="lead">Three weeks later Mira asks for a leg workout again. You want the knee fact in front of the model this time, without the mood, the weather or the timer.</p>
        <p class="task">How should the bot do it?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 4. Writing: a model picks what to save; the learner finds the one it should not have kept. */
  function writeStep({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const fb = SAVED.map((s, i) => {
      if (i === SAVED_BAD) return [`Right. The meeting was true on one Saturday. In the store, it comes back on any later day when a message seems to match it. The writer did leave out the other ${plural(LEFT_OUT, "line")} that do not last: the mood, the weather and the timer.
        <p>What if the mood had been saved too? We tried it on the store you will meet next: for the message “${kit.esc(RANK_MOOD.query)}”, weeks later, Tuesday's mood came back ${ORD[MOOD_POS]} of ${RANK_MOOD.ranked.length} (score ${MOOD_SCORE.toFixed(3)}), close enough to go into the prompt. A wrong write does not stay quiet.</p>
        <p>So the write step needs a rule, not “anything useful”: keep what will still be true and useful in a month. The write step can run while the bot answers, which makes each reply slower. Or it can run in the background after the chat, and then the newest memories are missing until it has run.</p>`, true];
      return [`That one lasts: ${/knee/i.test(s) ? "an old injury that limits every leg workout" : /egetarian/.test(s) ? "a diet does not change from week to week. (Notice how short it is, though. That matters on the next screen.)" : /10 km/.test(s) ? "a goal for months" : "a habit, not one day's news"}. Look for a line that was only true on one day.`, false];
    });
    const paint = () => {
      el.innerHTML = `<h1>Who decides what to save?</h1>
        <p class="lead">Often the bot's model writes its own memories. After the week, the bot sent all eight lines to the same small hosted model with this instruction:</p>
        ${log(kit, [["instruction", kit.esc(WRITER_PROMPT)]])}
        <p class="lead">It saved these ${`${SAVED.length} memories`}:</p>
        <p class="task">One of them should not be kept forever. Which?</p>
        <div class="lpanel">${kit.options(SAVED.map(s => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`), { picked: ans, correct: SAVED_BAD })}${cap()}${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === SAVED_BAD) done(); });
    };
    paint();
  }

  /* 5. Recall: predict what a similarity search brings back. */
  function predictRecall({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const pick = (q, idx) => idx.map(i => STORE[i]);
    const Q = [
      { kind: "top", rank: RANK[0], opts: pick(0, [3, 0, 1, 5]) },
      { kind: "veg", rank: RANK[1], opts: ["Yes", "No"] },
      { kind: "top", rank: RANK[2], opts: pick(2, [2, 4, 3, 0]) }
    ];
    const rightOf = q => q.kind === "veg" ? (VEG_POS < K ? 0 : 1) : q.opts.indexOf(memText(q.rank.ranked[0][1]));
    const scoreOf = (q, text) => q.rank.ranked.find(([, m]) => memText(m) === text)[0];
    const say = (q, i, picked) => {
      const ok = picked === rightOf(q);
      if (q.kind === "veg") return ok
        ? [`Right, and it is the surprise. “${kit.esc(STORE[1])}” came ${ORD[VEG_POS]} with ${VEG_SCORE.toFixed(3)}, below two memories about running. The search compares meaning in general, and her question is about a run as much as about food. A three-word memory gives it little to match. With k = ${K}, a meal idea would go out without the diet.`, true]
        : [`That is what you would hope, but no. The run scored it ${ORD[VEG_POS]}, at ${VEG_SCORE.toFixed(3)}. The question mentions a long run, so the two running memories scored higher, and k = ${K} cuts it off. Similar is not the same as relevant.`, false];
      const top = memText(q.rank.ranked[0][1]), mine = q.opts[picked];
      return ok
        ? [`Right: ${top === STORE[0] ? `${scoreOf(q, top).toFixed(3)}, only just ahead of the morning habit (${scoreOf(q, STORE[3]).toFixed(3)}). Both are returned with k = ${K}.` : `${scoreOf(q, top).toFixed(3)}, far ahead of the rest. The question and the memory are about the same thing: when she trains.`}`, true]
        : [`That one scored ${scoreOf(q, mine).toFixed(3)}. The top memory scored ${scoreOf(q, top).toFixed(3)}. Ask which memory is about the same thing as the question.`, false];
    };
    const paint = () => {
      const all = Q.every((q, i) => ans[i] === rightOf(q));
      el.innerHTML = `<h1>What comes back?</h1>
        <p class="lead">Mira's long-term store holds ${`${STORE.length} memories`}: the four lasting lines from her week, written as sentences, and two from earlier weeks. Recall works like the vector search you have met. A small open embedding model, run on our Mac, turns each memory and each new message into a list of ${DIM} numbers. A memory whose numbers point the same way as the message's gets a higher score (cosine similarity, from −1 to 1). The ${K} best (k&nbsp;=&nbsp;${K}) go into the prompt.</p>
        <p class="task">Predict each result. Pick again if you change your mind.</p>
        ${Q.map((q, i) => {
          const ok = ans[i] === rightOf(q);
          return `<div class="lcase" id="c${i}"><p class="lx-${ID}-q">“${kit.esc(q.rank.query)}”</p><p>${q.kind === "veg" ? `With k = ${K}, does “${kit.esc(STORE[1])}” come back?` : "Which memory scores highest?"}</p>
            ${kit.options(q.opts.map(o => `<span class="lx-${ID}-opt">${kit.esc(o)}</span>`), { picked: ans[i], correct: rightOf(q) })}
            ${ans[i] == null ? "" : kit.feedback(...say(q, i, ans[i]))}${ok ? rankList(kit, q.rank, K, "scores for this message") : ""}</div>`;
        }).join("")}
        ${all ? kit.feedback("Recall is a search, and a search can miss. It found the knee and the habit, but it dropped the diet for a food question. That is the second way memory goes wrong: the right memory is in the store and still does not reach the model.") : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (Q.every((q, j) => ans[j] === rightOf(q))) done();
      }));
    };
    paint();
  }

  /* 6. Fix the miss by writing the memory better: predict its new rank. */
  function rewrite({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["1st", "Still 3rd", "Last"];
    const right = REWRITE_POS === 0 ? 0 : REWRITE_POS === RANK_REWRITE.ranked.length - 1 ? 2 : 1;
    const fb = [
      [`Right: ${ORD[REWRITE_POS]}, with ${REWRITE_SCORE.toFixed(3)} (it was ${VEG_SCORE.toFixed(3)}). The new sentence says when the fact matters, meals, so a food question finds it. This is a rule for the writer: a memory is read by a search later, so write it as a full sentence that names the situations it is for. The recorded writer saved just “${kit.esc(SAVED_VEG)}”, the kind of memory that gets missed.<p>Other fixes exist. A larger k sends more memories with every message, so more tokens and more noise. For the few facts that must never be missed, like the knee and the diet, you can keep a short profile, one small document of key facts (the LangGraph memory docs use that name), send it with every message, and use search only for the rest.</p>`, true],
      ["The memory now says “meals”, and the question asks what to eat. That gives the search something to match. Predict a change.", false],
      ["Nothing in the new sentence moved it away from food: it now says “meals”, and the question is about eating. It moved the other way.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Write it so it can be found</h1>
        <p class="lead">Same store, same question: “${kit.esc(RANK_REWRITE.query)}”. One memory changes. We replaced</p>
        ${log(kit, [["before", kit.esc(STORE[1])], ["after", kit.esc(VEG_REWRITE)]])}
        <p class="lead">and ran the search again.</p>
        <p class="task">Where does the diet memory rank now, out of ${RANK_REWRITE.ranked.length}?</p>
        <div class="lpanel">${ask(kit, opts, right, ans, fb)}${ans === right ? rankList(kit, RANK_REWRITE, K, "scores after the rewrite") : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 7. The store from scratch: recall() stepped through a real run. */
  const FR = TRACE.map(([ln, ev, mem, score, scored], i) => ({ ln, end: ev === "r", mem, score, scored, has: i >= 2 }));
  const sayFrame = f => {
    if (f.end) return `It returns the top ${K}: the knee (${f.scored[0][0].toFixed(3)}) and the morning habit (${f.scored[1][0].toFixed(3)}). Those two lines go into the system prompt under “What you remember about this user”.`;
    if (f.ln === 1) return `<code>recall</code> starts with the question and the store of ${STORE.length} memories. Line 1 sends the question to the embedding model.`;
    if (f.ln === 2) return `<code>q_vec</code> is now a list of ${DIM} numbers: the question, as a direction. <code>scored</code> starts empty.`;
    if (f.ln === 3) return f.scored.length ? `Scored ${f.scored.length} of ${STORE.length}. Next memory.` : "The loop walks every memory in the store.";
    if (f.ln === 4) return `This memory, <code>m</code>: “${STORE[f.mem]}”. Its vector was computed once, when it was written, so only the question needed the model just now.`;
    if (f.ln === 5) return `Cosine similarity: ${f.score.toFixed(3)}. ${f.score > 0.2 ? "High for this store: close in meaning." : "Low: little in common with the question."}`;
    if (f.ln === 6) return `All ${STORE.length} scored, in store order. Sort them, highest first.`;
    if (f.ln === 7) return `Sorted. Keep only the first ${K}.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The store, from scratch</h1>
        <p class="lead">The whole long-term store is a Python list of dicts. Each dict has <code>text</code>, the memory, and <code>vec</code>, short for vector: its ${DIM} numbers. Writing a memory is one line: <code>store.append({"text": text, "vec": embed(text)})</code>. <code>embed</code> asks the local model for those numbers; <code>cosine</code> compares two of them with NumPy. This is <code>recall</code>, replayed from our run for Mira's leg-workout question with k = ${K}.</p>
        <p class="task">Step through to the end. Watch <code>scored</code> fill, then get sorted.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>score <b>${f.score == null ? "–" : f.score.toFixed(3)}</b></span><span>len(scored) <b>${f.has ? f.scored.length : "–"}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(kit.esc(sayFrame(f)).replace(/&lt;(\/?)code&gt;/g, "<$1code>"))}
        ${f.has && f.scored.length ? rankList(kit, { ranked: f.scored }, f.ln === 7 ? K : 0, "scored") : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 8. Use it: the same request with the two recalled memories in the prompt. */
  function withMemory({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Squats and lunges are gone",
      "Squats and lunges stay, with the knee bend limited",
      "Nothing: it is the same list",
      "It moved the workout to the morning"
    ];
    const RIGHT = 1;
    const fb = [
      [`Look again: line 1 is still squats and line 3 is still lunges. What changed is how they are done.`, false],
      [`Right: “${kit.esc(WITH_LINES[0].replace(/^\d+\.\s+/, ""))}” and “${kit.esc(WITH_LINES[2].replace(/^\d+\.\s+/, ""))}”. The memory reached the model, and the model chose how to use it. Whether shallow squats suit Mira's knee is for her and a physio to judge, not the bot. The memory block (its heading and the two memories) added ${EXTRA_TOKENS} input tokens to this request (${REC_NO_MEM.promptTokens} became ${REC_WITH_MEM.promptTokens}). Every recalled memory is paid for on every message it is sent with.`, true],
      [`Compare line 1: “${kit.esc(WITH_LINES[0])}” against “${kit.esc(NO_LINES[0])}”. The memory changed something.`, false],
      ["The morning memory was in the prompt too, but a list of exercises has no time on it. The model used the memory that fit the question. Recalled memories are hints in the prompt, not orders.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Same question, with memory</h1>
        <p class="lead">Now the bot runs <code>recall</code> first and adds the ${K} memories it returned to the system prompt, under “What you remember about this user”. Same model, same instructions, same message:</p>
        ${log(kit, [["memories", RECALLED.map(t => kit.esc("- " + t)).join("<br>")], ["Mira", kit.esc(LEG)], ["coach bot", mono(kit, REC_WITH_MEM.text)]])}
        ${cap()}
        <p class="task">Compare with the first plan (${kit.esc(NO_LINES.map(l => l.replace(/^\d+\.\s+/, "").replace(/\s*\(.*\)$/, "")).join(", "))}). What did the memory change?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The bot keeps planning around a knee that no longer hurts",
      "Nothing: the newest message always wins",
      "The store runs out of space"
    ];
    const fb = [
      ["Right. Her message lives in the session. When the chat ends, the store still says the knee hurts, and the next chat recalls it again. A memory needs an update or a delete, or it comes back sounding sure and wrong. That upkeep is the cost people forget.", true],
      ["Only inside this chat. Her message is session memory and goes when the chat ends. The store still holds the old knee memory, and the next chat recalls it.", false],
      ["One more line is nothing for a database. The trouble is not size: it is a memory that is no longer true and keeps coming back.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to give an agent long-term memory</h1>
        <p class="lead"><b>For:</b> an assistant that serves the same person over many chats, where repeating yourself is the pain.</p>
        <p class="lead"><b>Keep</b> facts that last and change the answer: limits, diet, goals, habits.</p>
        <p class="lead"><b>Not for:</b> one-off tasks (the session is enough); facts that live in another system, like a train's platform or a calendar (ask that system with a tool; a copy goes stale); anything the user did not expect you to keep. Health details are sensitive: ask first, and let the user see and delete what is stored.</p>
        <p class="lead"><b>Costs:</b> a write step per chat, a search before each answer, more input tokens, and upkeep.</p>
        <p class="task">A month later Mira writes: “My knee is fine now, the physio cleared me.” The store is not changed. What goes wrong?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 10. Recognise it: which facts belong in long-term memory, including two that do not. */
  const CASES = [
    ["A guitar-practice app's bot learns that a student plays left-handed, so every chord diagram it shows him has to be mirrored.", true,
      "Yes. It is true next year and changes every lesson's diagrams. Write it as a sentence that names when it matters, for example “mirror every chord diagram, he plays left-handed”.",
      "It lasts for years and changes every chord diagram the app will ever show him. That is exactly a long-term memory."],
    ["A rail chatbot is asked “Which platform is the 18:05 to the airport?” and reads the live departures board: platform 4.", false,
      "No. The platform lives in the railway's system and can change minutes before the train leaves. Store it and a later chat reads an old platform as fact. Ask the departures tool again every time; at most, keep it in the session.",
      "A copy of a platform goes stale. The railway's system is the source of truth, and the bot can ask it every time with a tool. Long-term memory is for facts nobody else keeps."],
    ["A concert-ticket bot, while buying two tickets for one show, gets a seat map with 300 free seats.", false,
      "No. That is scratchpad material: needed to pick two seats right now, and other buyers change it by the minute. Once the purchase is done it is noise.",
      "That seat map is a working note for one task, and it changes by the minute. Keep it in the scratchpad and let it go when the purchase ends."],
    ["A support bot's customer says: “Please always answer me in Spanish.”", true,
      "Yes. A lasting preference that changes every future answer, and the customer said “always”. Without it, every chat starts in the wrong language.",
      "She asked for every future answer, not just this chat. If it lives only in the session, the next chat starts in the wrong language."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Into long-term memory, or not?</h1>
        <p class="lead">Four other bots. Long-term memory means: written to a store on purpose, recalled in later chats.</p>
        <p class="task">Should each one go into long-term memory? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can give an agent a memory</h1>
      <p class="lead">You sorted a week into three lifetimes (scratchpad, session, long-term), caught a writer keeping a one-day fact, saw a search miss the diet and a better-written memory fix it, and stepped through a ${CODE.length - 1}-line <code>recall</code> built from scratch.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>remember</code> and <code>recall</code> over a small list of memories, and a write rule that keeps the lasting lines of a chat and drops the rest.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. There the session memory you met here gets a proper home: the graph's state, saved per conversation thread by a checkpointer.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Agent memory: scratchpad, session and long-term",
    checked: "2026-11-13",
    sources: [
      "https://docs.langchain.com/oss/python/langgraph/memory",
      "https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool",
      "https://docs.ollama.com/api/embed"
    ],
    interview: [
      {
        q: "Users say your assistant “remembers weird things”: it brought up a bad day one user had last month. How would you redesign its memory?",
        good: [
          "Separate the lifetimes: task notes in a scratchpad, today's context in the session, only lasting facts in the long-term store",
          "Give the write step a clear rule, such as “still true and useful in a month”, and test it on real chats",
          "Keep moods and one-day plans in the session so they end with the chat",
          "Let users see, edit and delete what is stored, and remove memories that are outdated",
          "Check recall too: look at what the search returns for real messages, not only what is stored"
        ],
        weak: "Turn memory off, or tell the model to be more careful. That hides the problem instead of fixing what gets written."
      },
      {
        q: "A user's memory says she is vegetarian, but the bot still suggested chicken. Where do you look, in what order?",
        good: [
          "Write: was the fact saved, and how is it worded? A two-word memory is hard to find",
          "Recall: did it come back in the top k for that message? Similar is not the same as relevant",
          "Prompt: was the recalled memory actually put into the request the model saw?",
          "Fixes: rewrite memories to name when they matter, raise k, or keep a few must-never-miss facts in a profile sent every time",
          "Add the failing message to a test set so the fix stays fixed"
        ],
        weak: "Blame the model and switch to a bigger one, without checking whether the memory ever reached the prompt."
      }
    ],
    screens: [firstAnswer, sortWeek, spotIdea, writeStep, predictRecall, rewrite, asCode, withMemory, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: WEEK.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: [0, 1, 2].map(i => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
