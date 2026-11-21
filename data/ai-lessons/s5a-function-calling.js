/* Lesson: function calling, the request and reply loop. Story: a climbing gym's booking assistant that checks free
   belay-course slots and books one through two small functions, find_free_slots and book_slot.
   Ideas: (1) the model never runs anything: it writes a tool request, the app runs the function and sends the result
   back in a "tool" message tied to the request's id; (2) the app's loop repeats that until a reply has no request.
   Depth: explain (screens 1-5, 8, 9, interview), scratch (screen 6, the loop in plain Python, stepped from a real
   trace), debug (screen 7, a real broken loop that asks the same thing three times).
   Recordings (main checkout, docs/ai-path/recordings/s5a-function-calling/): mini-1, mini-2, mini-3 (the good run),
   bug-2, bug-3 (the broken run; its first request is byte-identical to mini-1's). One small hosted model, temperature 0.
   Runs: docs/ai-path/runs/s5a-function-calling/ (gym.py, loop.py -> loop.out.txt, loop_bug.py -> loop_bug.out.txt;
   the loops run on this Mac for real, the model's replies are replayed from the recordings).
   Every number on screen is computed here from SESSIONS, the REC_* constants and TRACE. Plain browser script. */
(() => {
  const P = "lx-s5a-function-calling-";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  /* ---------- Data copied from the run (gym.py) ---------- */
  const SYSTEM = "You are the booking assistant of a climbing gym. Today is Thursday 2026-11-19. Use the tools to check free belay-course slots and to book them. Never invent a slot.";
  const USER = "Hi, is there a free spot on a belay basics course this Saturday? If there is, please book the earliest one for me. My name is Dana Kim.";
  const SESSIONS = [
    { slot_id: "BB-1121-10", course: "belay-basics", date: "2026-11-21", start: "10:00", free_places: 0 },
    { slot_id: "BB-1121-13", course: "belay-basics", date: "2026-11-21", start: "13:00", free_places: 2 },
    { slot_id: "LB-1121-15", course: "lead-belay", date: "2026-11-21", start: "15:00", free_places: 3 },
    { slot_id: "BB-1121-17", course: "belay-basics", date: "2026-11-21", start: "17:00", free_places: 4 },
    { slot_id: "BB-1122-10", course: "belay-basics", date: "2026-11-22", start: "10:00", free_places: 5 }
  ];
  const TOOL_INFO = [
    ["find_free_slots", "List the slots of one course on one date that still have free places.", "course (belay-basics or lead-belay), date (YYYY-MM-DD)"],
    ["book_slot", "Book one place in a slot for a climber. Returns a booking reference.", "slot_id, climber_name"]
  ];
  // the same two functions as gym.py, so the lesson computes what the app sent back
  const findFree = (course, date) => SESSIONS.filter(s => s.course === course && s.date === date && s.free_places > 0)
    .map(s => ({ slot_id: s.slot_id, start: s.start, free_places: s.free_places }));
  const bookOne = (slot_id) => { const s = SESSIONS.find(x => x.slot_id === slot_id); return { booked: true, slot_id, start: s.start, date: s.date, booking_ref: "G-001" }; };
  // Python's json.dumps spacing (", " and ": "), so the text matches what the run sent byte for byte
  const pyJson = v => Array.isArray(v) ? `[${v.map(pyJson).join(", ")}]`
    : v && typeof v === "object" ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pyJson(x)}`).join(", ")}}`
    : JSON.stringify(v);

  /* ---------- Recorded model replies (trimmed: some fields cut, marked …; nothing altered) ---------- */
  // From docs/ai-path/recordings/s5a-function-calling/mini-1.json
  const REC_1 = { src: "s5a-function-calling/mini-1", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    sent: 2, inTok: 184, outTok: 27, finish: "tool_calls",
    call: { id: "call_ntMmK61mJFj6sjjjusC6AnHa", name: "find_free_slots", arguments: "{\"course\":\"belay-basics\",\"date\":\"2026-11-21\"}" } };
  // From docs/ai-path/recordings/s5a-function-calling/mini-2.json
  const REC_2 = { src: "s5a-function-calling/mini-2", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    sent: 4, inTok: 275, outTok: 27, finish: "tool_calls",
    call: { id: "call_N5u4NoFOwQF6n8aBBWjzYaZq", name: "book_slot", arguments: "{\"slot_id\":\"BB-1121-13\",\"climber_name\":\"Dana Kim\"}" } };
  // From docs/ai-path/recordings/s5a-function-calling/mini-3.json
  const REC_3 = { src: "s5a-function-calling/mini-3", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    sent: 6, inTok: 356, outTok: 39, finish: "stop",
    text: "I have successfully booked you a spot in the belay basics course on Saturday, November 21, 2026, at 13:00. Your booking reference is G-001." };
  // From bug-2.json and bug-3.json: the broken loop sent mini-1's two messages again, twice
  const REC_BUG = [
    { src: "s5a-function-calling/mini-1", sent: 2, inTok: 184, id: "call_ntMmK61mJFj6sjjjusC6AnHa" },
    { src: "s5a-function-calling/bug-2", sent: 2, inTok: 184, id: "call_l9TjB5AbWo9k2d09JzVf15bf" },
    { src: "s5a-function-calling/bug-3", sent: 2, inTok: 184, id: "call_pynXsykfMmfL6tN88pTjN85c" }
  ];
  const BUG_ARGS = "{\"course\":\"belay-basics\",\"date\":\"2026-11-21\"}";
  const CAPTION = `Recorded model output, ${REC_1.recordedAt}. Shortened: some fields are left out, and … marks a gap. Every field shown is copied unchanged.`;

  const ARGS_1 = JSON.parse(REC_1.call.arguments), ARGS_2 = JSON.parse(REC_2.call.arguments);
  const RESULT_1 = findFree(ARGS_1.course, ARGS_1.date), RESULT_2 = bookOne(ARGS_2.slot_id);
  const RIGHT_ROWS = RESULT_1.map(r => r.slot_id);
  const toolMsg = (id, result) => ({ role: "tool", tool_call_id: id, content: pyJson(result) });
  const callMsg = c => ({ role: "assistant", content: null, tool_calls: [{ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } }] });
  const show = o => JSON.stringify(o, null, 2);
  const replyText = (rec) => rec.call
    ? `…\n"finish_reason": "${rec.finish}",\n"message": {\n  "role": "assistant",\n  "content": null,\n  "tool_calls": [{\n    "type": "function",\n    "index": 0,\n    "id": "${rec.call.id}",\n    "function": {\n      "name": "${rec.call.name}",\n      "arguments": ${JSON.stringify(rec.call.arguments)}\n    }\n  }],\n  …\n}`
    : `…\n"finish_reason": "${rec.finish}",\n"message": {\n  "role": "assistant",\n  "content": ${JSON.stringify(rec.text)},\n  …\n}`;

  /* ---------- Lesson-only pictures and styles ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}msg { margin: 14px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 8px; font: 500 14px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--font); color: var(--muted); }
      .${P}lab { margin: 16px 0 0; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
      .${P}rows { display: grid; gap: 8px; margin-top: 10px; }
      .${P}row { display: flex; flex-wrap: wrap; gap: 2px 14px; align-items: baseline; width: 100%; min-height: 48px; padding: 8px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 15px var(--mono); text-align: left; cursor: pointer; }
      .${P}row b { font-weight: 700; }
      .${P}row span { color: var(--ink-2); }
      .${P}row.on { border-color: var(--good); background: var(--good-soft); color: var(--good); }
      .${P}row.no { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
      .${P}row:disabled { cursor: default; }
      .${P}tools { display: grid; gap: 8px; margin-top: 12px; }
      .${P}tools div { padding: 8px 12px; border-left: 3px solid var(--ink-2); background: var(--surface); font-size: 15.5px; }
      .${P}tools code { font: 700 15px var(--mono); }
      .${P}lines { margin: 16px 0 0; padding: 8px 0; background: var(--code-bg); border-radius: var(--r); overflow-x: auto; }
      .${P}lines button { display: block; width: 100%; min-height: 44px; padding: 0 14px; border: 0; border-left: 3px solid transparent; background: transparent; color: var(--code-ink); font: 500 14px var(--mono); text-align: left; white-space: pre; cursor: pointer; }
      .${P}lines button.on { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--code-bg)); }
      .${P}lines button.no { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--code-bg)); }
      .${P}log { margin: 12px 0 0; padding: 10px 12px; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); font: 500 13px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}roles { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .${P}roles span { padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; font: 500 13px var(--mono); color: var(--ink-2); background: var(--surface); }
      .${P}roles span.new { border-color: var(--ink); color: var(--ink); font-weight: 700; }
      @media (max-width: 420px) {
        .${P}code .lcode { font-size: 12.5px; }
        .${P}code .lcode div, .${P}lines button { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + var(--ind, 4ch)); text-indent: calc(-1 * var(--ind, 4ch)); }
        .${P}lines button { font-size: 12.5px; padding-top: 6px; padding-bottom: 6px; }
      }
    `;
    document.head.appendChild(s);
  }
  // on a phone a long line wraps (<wbr> after each "(" gives it a place to break); --ind makes the wrapped part start 4 places deeper than the line's own indent
  const ind = line => `--ind:${line.match(/^ */)[0].length + 4}ch`;
  const codeWrapped = (lines, active, kit) => { let k = 0; return kit.code(lines, active).replace(/<div/g, () => `<div style="${ind(lines[k++])}"`).replace(/\(/g, "(<wbr>"); };
  const msgBox = (text, kit) => `<pre class="${P}msg">${kit.esc(text)}</pre>`;
  const roleChips = (roles, fresh, kit) => `<div class="${P}roles" aria-label="messages">${roles.map((r, i) => `<span class="${i >= fresh ? "new" : ""}">${kit.esc(r.replace("+tool_calls", " (tool request)"))}</span>`).join("")}</div>`;

  /* 1. The situation, and a first prediction: what does the model send back? */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "A text answer for Dana, such as “Yes, 13:00 is free, you are booked.”",
      "A request: please call find_free_slots with a course and a date",
      "The list of free slots, because the API ran find_free_slots for the app"
    ];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>A climber wants a belay course</h1>
        <p class="lead">You build the chat assistant for a climbing gym. Dana writes: <b>“${kit.esc(USER)}”</b> The gym's app has two small Python functions. With each request to the model, the app sends a short description of them: a name, what it does, its parameters. It does not send their code, and the model cannot reach the gym's booking system. This lesson shows how such an assistant still answers from live data and makes real bookings.</p>
        <div class="${P}tools">${TOOL_INFO.map(([n, d, p]) => `<div><code>${kit.esc(n)}</code>: ${kit.esc(d)} Parameters: ${kit.esc(p)}.</div>`).join("")}</div>
        <p class="task">The app sends a system prompt (“${kit.esc(SYSTEM.split(". ").slice(0, 2).join(". "))}. …”), Dana's message and these two descriptions. What comes back first?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok ? `${kit.feedback("Right. A small hosted model answered with a request, not with text for Dana:", true)}
          ${msgBox(replyText(REC_1), kit)}<p class="${P}cap">${kit.esc(CAPTION)}</p>
          ${kit.feedback(`Read it closely. <code>finish_reason</code> is <b>"${REC_1.finish}"</b>: the model stopped to wait for a result. <code>content</code> is null: no words for Dana yet. <code>arguments</code> is a <b>string</b> of JSON, not an object, so your code must parse it. The model turned “this Saturday” into ${kit.esc(ARGS_1.date)} using the date in the system prompt. Nothing has been looked up yet.`)}`
          : ans === 0 ? kit.feedback("The slot table is not in the prompt, so the model has no way to know that 13:00 is free. A reply like that would be a guess: Dana could turn up for a slot that is full, with no booking in the system. The model was given a way to ask for the data instead.", false)
          : kit.feedback("The API received only the name, the description and the parameter list. The code of find_free_slots and the gym's data live in your app, on your server. The API has nothing it could run.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. By hand: play the app's part, look the answer up in the session table. */
  function lookUp({ el, done, kit }) {
    style();
    const picked = new Set();
    let bad = null;
    const why = s => s.date !== ARGS_1.date ? `${s.slot_id} is on ${s.date}. The request asks for date ${ARGS_1.date}.`
      : s.course !== ARGS_1.course ? `${s.slot_id} is a ${s.course} course. The request asks for course ${ARGS_1.course}.`
      : s.free_places === 0 ? `${s.slot_id} has 0 free places. find_free_slots lists only slots that still have room.`
      : "";
    const paint = () => {
      const fin = RIGHT_ROWS.every(id => picked.has(id));
      el.innerHTML = `<h1>Play the app: run the lookup</h1>
        <p class="lead">You are the app now. The model asked for <code>${kit.esc(REC_1.call.name)}</code> with the arguments <code>${kit.esc(REC_1.call.arguments)}</code>. Here is the gym's session table, as the staff would print it.</p>
        <p class="task">Tap every row that find_free_slots returns for these arguments.</p>
        <div class="${P}rows">${SESSIONS.map(s => {
          const on = picked.has(s.slot_id), no = bad === s.slot_id;
          return `<button type="button" class="${P}row ${on ? "on" : no ? "no" : ""}" data-i="${kit.esc(s.slot_id)}" ${fin ? "disabled" : ""} aria-pressed="${on}"><b>${kit.esc(s.slot_id)}</b><span>${kit.esc(s.course)}</span><span>${kit.esc(s.date)} ${kit.esc(s.start)}</span><span>${s.free_places} free</span></button>`;
        }).join("")}</div>
        <div class="lpanel">${fin ? `${kit.feedback(`Done: ${WORDS[RESULT_1.length].toLowerCase()} rows. The function returns them as a list, and the app turns that list into text with <code>json.dumps</code>. This exact text is what goes back to the model:`, true)}${msgBox(pyJson(RESULT_1), kit)}`
          : bad ? kit.feedback(kit.esc(why(SESSIONS.find(s => s.slot_id === bad))), false)
          : picked.size ? kit.feedback(`${picked.size} of the matching rows found. Check the others against both arguments and the free places.`) : ""}</div>`;
      el.querySelectorAll(`.${P}row`).forEach(b => b.onclick = () => {
        const id = b.dataset.i;
        if (RIGHT_ROWS.includes(id)) { picked.add(id); bad = null; } else bad = id;
        paint();
        if (RIGHT_ROWS.every(x => picked.has(x))) done();
      });
    };
    paint();
  }

  /* 3. By hand: fill in the reply message the model needs. */
  function replyMsg({ el, done, kit }) {
    style();
    let role = null, idAns = null;
    const ROLES = ["user", "tool", "assistant"], IDS = [REC_1.call.id, REC_1.call.name, RIGHT_ROWS[0]];
    const paint = () => {
      const r1 = role === 1, r2 = r1 && idAns === 0;
      const roleFb = role == null ? "" : r1 ? kit.feedback(`Right: <code>"tool"</code> marks a result that your app produced, not words from Dana.`, true)
        : role === 0 ? kit.feedback("A user message reads as if Dana typed the slot list herself. The model would not know it is the answer to the request it made.", false)
        : kit.feedback("Assistant messages are the model's own turns. This message is your app's answer to the model's request.", false);
      const idFb = idAns == null ? "" : idAns === 0 ? kit.feedback("Right. The id ties this result to that one request. One reply can hold several requests, even two calls of the same function, and each result must say which request it answers.", true)
        : idAns === 1 ? kit.feedback("The function name does not say which request this answers. One reply can ask for find_free_slots twice, for two dates. Only the request's id is unique.", false)
        : kit.feedback("BB-1121-13 is a slot from the result, not a name for the request. The model needs to know which of its requests this result answers.", false);
      el.innerHTML = `<h1>Play the app: write the reply</h1>
        <p class="lead">You have the result. Now wrap it in a message for the model. The request you are answering:</p>
        ${msgBox(`"id": "${REC_1.call.id}",\n"function": { "name": "${REC_1.call.name}", "arguments": ${JSON.stringify(REC_1.call.arguments)} }`, kit)}
        <p class="task">Fill in the two missing fields of the reply message.</p>
        <div class="lcase" id="r0"><p>"role":</p>${kit.options(ROLES.map(x => `"${x}"`), { picked: role, correct: 1 })}${roleFb}</div>
        ${r1 ? `<div class="lcase" id="r1"><p>"tool_call_id":</p>${kit.options(IDS.map(x => `"${kit.esc(x)}"`), { picked: idAns, correct: 0 })}${idFb}</div>` : ""}
        ${r2 ? `<p class="${P}lab">The message your app sends</p>${msgBox(show(toolMsg(REC_1.call.id, RESULT_1)), kit)}
          ${kit.feedback(`That is the message the real run sent. Other APIs use different field names for the same idea. In Anthropic's Messages API the request is a <code>tool_use</code> block (with <code>stop_reason: "tool_use"</code>), and the result goes back as a <code>tool_result</code> block with a <code>tool_use_id</code>, inside a user message.`)}` : ""}`;
      el.querySelectorAll("#r0 button").forEach(b => b.onclick = () => { role = +b.dataset.i; if (role !== 1) idAns = null; paint(); });
      el.querySelectorAll("#r1 button").forEach(b => b.onclick = () => { idAns = +b.dataset.i; paint(); if (idAns === 0) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: who made the booking real? */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "The model, when it wrote the book_slot request",
      "Your app's code, when it ran book_slot and sent back the result",
      "Your app, when it read “successfully booked” in the last reply and saved it"
    ];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>Who booked the slot?</h1>
        <p class="lead">The app sent the conversation back. The model's second reply was another request: <code>${kit.esc(REC_2.call.name)}</code> with <code>${kit.esc(REC_2.call.arguments)}</code>. The app ran it and sent back <code>${kit.esc(pyJson(RESULT_2))}</code>. Then the third reply came:</p>
        ${msgBox(replyText(REC_3), kit)}<p class="${P}cap">${kit.esc(CAPTION)}</p>
        <p class="task">Dana sees that sentence. Which step made her booking real?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok ? kit.feedback(`Right. The model only writes requests. Your code runs the function, and your code reports the result. The model's sentence repeats the booking reference ${kit.esc(RESULT_2.booking_ref)} it was given. This is <b>function calling</b>, also called <b>tool use</b>: the model asks, the app does the work and answers, and this repeats until a reply asks for nothing. Your app is the one that runs things, so it is the one that can check, refuse or log them.`, true)
          : ans === 0 ? kit.feedback("A request is only text: a name and some JSON. If your app had ignored it, nothing in the booking system would have changed. The model has no access to the gym's data.", false)
          : kit.feedback("The booking already existed one step earlier: book_slot ran and returned a reference. Reading the model's wording to decide what happened is fragile. The result of your own function is the record.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Use it, with predictions checked against the recordings. */
  const RECS = [REC_1, REC_2, REC_3];
  function predict({ el, done, kit }) {
    style();
    const ans = [null, null, null];
    const Q = [
      { q: `Request 2 goes out after the first tool result. What does the app send?`,
        opts: ["Only the new tool message with the slot list", `All ${REC_2.sent} messages: system, user, the model's request and the tool message`, "The tool message and Dana's first message"], right: 1,
        yes: `Right: the recording shows ${REC_2.sent} messages in request 2, and the two tool descriptions again. Each request carries the whole conversation: this API does not keep it for you, so the app sends it every time.`,
        no: ["This API does not keep request 1 for you. With only the tool message, the model would not know what it asked for, or for whom.", "Without its own request in the history, the model gets a result for a question it never sees asked. The request message must come right before its result."] },
      { q: `Reply 3 has <code>finish_reason: "${REC_3.finish}"</code> and no tool_calls. What does the loop do?`,
        opts: ["Show the text to Dana and stop", "Send it back to the model to double-check", "Run book_slot once more, to be safe"], right: 0,
        yes: "Right. No request means the model is done: this is the stop signal. The loop returns the text.",
        no: [null, "Nothing in the reply asks for more work. Another call costs another round of tokens and waiting, and the model would just answer again.", "book_slot books a place each time it runs. Running it again would book Dana a second place. The app runs a function only when a reply asks for it."] },
      { q: `Request 1 used ${REC_1.inTok} input tokens. Request 3 carried ${REC_3.sent} messages. How many input tokens did it use?`,
        opts: ["About the same: only the new messages are counted", "More: the whole conversation and the tool descriptions are sent again", "Fewer: the tool descriptions were sent once, in request 1"], right: 1,
        yes: `Right. The recordings say ${RECS.map(r => r.inTok).join(", then ")} input tokens. Every round sends everything again, and every token sent is counted, so a task that needs many tool calls costs more per round as it goes.`,
        no: ["This API keeps no conversation between calls, so every token is sent and counted again each time. Prompt caching (previous lesson) can make a repeated start cheaper, but it is still sent.", null, "The tool descriptions go with every request. The API needs them on each call to know what the model may ask for."] }
    ];
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const shown = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = `<h1>Run the loop in your head</h1>
        <p class="lead">One more round each time: the app sends, the model replies, the app either runs a function or stops. Predict, then check against the recorded run.</p>
        <p class="task">Answer each question. The next one appears when you get it right.</p>
        ${Q.slice(0, shown).map((x, i) => `<div class="lcase" id="q${i}"><p>${x.q}</p>${kit.options(x.opts.map(kit.esc), { picked: ans[i], correct: x.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === x.right ? x.yes : x.no[ans[i]], ans[i] === x.right)}</div>`).join("")}
        ${upto === -1 ? kit.meter(RECS.map((r, i) => ({ label: `Request ${i + 1} (${r.sent} messages)`, value: r.inTok, max: REC_3.inTok }))) + `<p class="${P}cap">Input tokens per request, from the recordings.</p>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i;
        for (let j = i + 1; j < Q.length; j++) if (ans[i] !== Q[i].right) ans[j] = null;
        paint();
        if (Q.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 6. The same loop in plain Python, replayed from a real run (loop.py, traced). */
  const CODE = [
    "def run_turns(messages):",
    "    for turn in range(MAX_TURNS):",
    "        reply = ask_model(messages)",
    "        messages.append(reply)",
    "        if not reply.get(\"tool_calls\"):",
    "            return reply[\"content\"]",
    "        for call in reply[\"tool_calls\"]:",
    "            fn = call[\"function\"]",
    "            args = json.loads(fn[\"arguments\"])",
    "            result = TOOLS[fn[\"name\"]](**args)",
    "            messages.append(tool_message(call[\"id\"], result))",
    "    return \"Stopped: too many turns\""
  ];
  // From docs/ai-path/runs/s5a-function-calling/loop.out.txt: [line about to run, is return, turn, roles in messages, call name, args, result, reply kind]
  const TRACE = [
    [1,0,null,["system","user"],null,null,null,null],
    [2,0,0,["system","user"],null,null,null,null],
    [3,0,0,["system","user"],null,null,null,"tool_calls"],
    [4,0,0,["system","user","assistant+tool_calls"],null,null,null,"tool_calls"],
    [6,0,0,["system","user","assistant+tool_calls"],null,null,null,"tool_calls"],
    [7,0,0,["system","user","assistant+tool_calls"],"find_free_slots",null,null,"tool_calls"],
    [8,0,0,["system","user","assistant+tool_calls"],"find_free_slots",null,null,"tool_calls"],
    [9,0,0,["system","user","assistant+tool_calls"],"find_free_slots",{"course":"belay-basics","date":"2026-11-21"},null,"tool_calls"],
    [10,0,0,["system","user","assistant+tool_calls"],"find_free_slots",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [6,0,0,["system","user","assistant+tool_calls","tool"],"find_free_slots",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [1,0,0,["system","user","assistant+tool_calls","tool"],"find_free_slots",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [2,0,1,["system","user","assistant+tool_calls","tool"],"find_free_slots",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [3,0,1,["system","user","assistant+tool_calls","tool"],"find_free_slots",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [4,0,1,["system","user","assistant+tool_calls","tool","assistant+tool_calls"],"find_free_slots",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [6,0,1,["system","user","assistant+tool_calls","tool","assistant+tool_calls"],"find_free_slots",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [7,0,1,["system","user","assistant+tool_calls","tool","assistant+tool_calls"],"book_slot",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [8,0,1,["system","user","assistant+tool_calls","tool","assistant+tool_calls"],"book_slot",{"course":"belay-basics","date":"2026-11-21"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [9,0,1,["system","user","assistant+tool_calls","tool","assistant+tool_calls"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},[{"slot_id":"BB-1121-13","start":"13:00","free_places":2},{"slot_id":"BB-1121-17","start":"17:00","free_places":4}],"tool_calls"],
    [10,0,1,["system","user","assistant+tool_calls","tool","assistant+tool_calls"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},{"booked":true,"slot_id":"BB-1121-13","start":"13:00","date":"2026-11-21","booking_ref":"G-001"},"tool_calls"],
    [6,0,1,["system","user","assistant+tool_calls","tool","assistant+tool_calls","tool"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},{"booked":true,"slot_id":"BB-1121-13","start":"13:00","date":"2026-11-21","booking_ref":"G-001"},"tool_calls"],
    [1,0,1,["system","user","assistant+tool_calls","tool","assistant+tool_calls","tool"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},{"booked":true,"slot_id":"BB-1121-13","start":"13:00","date":"2026-11-21","booking_ref":"G-001"},"tool_calls"],
    [2,0,2,["system","user","assistant+tool_calls","tool","assistant+tool_calls","tool"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},{"booked":true,"slot_id":"BB-1121-13","start":"13:00","date":"2026-11-21","booking_ref":"G-001"},"tool_calls"],
    [3,0,2,["system","user","assistant+tool_calls","tool","assistant+tool_calls","tool"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},{"booked":true,"slot_id":"BB-1121-13","start":"13:00","date":"2026-11-21","booking_ref":"G-001"},"text"],
    [4,0,2,["system","user","assistant+tool_calls","tool","assistant+tool_calls","tool","assistant"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},{"booked":true,"slot_id":"BB-1121-13","start":"13:00","date":"2026-11-21","booking_ref":"G-001"},"text"],
    [5,0,2,["system","user","assistant+tool_calls","tool","assistant+tool_calls","tool","assistant"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},{"booked":true,"slot_id":"BB-1121-13","start":"13:00","date":"2026-11-21","booking_ref":"G-001"},"text"],
    [5,1,2,["system","user","assistant+tool_calls","tool","assistant+tool_calls","tool","assistant"],"book_slot",{"slot_id":"BB-1121-13","climber_name":"Dana Kim"},{"booked":true,"slot_id":"BB-1121-13","start":"13:00","date":"2026-11-21","booking_ref":"G-001"},"text"]
  ];
  const CP = [0, 2].map(t => TRACE.findIndex(s => s[0] === 4 && s[2] === t)); // stop and predict at the `if` in rounds 0 and 2
  const stepSay = (k) => {
    const [ln, ret, turn, roles, name, args, result, kind] = TRACE[k], n = roles.length;
    if (ret) return `run_turns returns Dana's answer after ${turn + 1} rounds. <code>messages</code> now holds ${n} messages: the whole conversation, ready to log.`;
    switch (ln) {
      case 1: return turn == null ? "MAX_TURNS is 5: at most five rounds, so a confused model cannot keep the app busy forever." : `Back to the top for the next round.`;
      case 2: return `Send all ${n} messages, with the tool descriptions, and wait for the reply. This is the network call.`;
      case 3: return `The reply is ${kind === "tool_calls" ? "a tool request" : "plain text"}. Add it to <code>messages</code> first, so the next request includes it.`;
      case 4: return kind === "tool_calls" ? "Does the reply ask for a tool? It holds tool_calls." : "Does the reply ask for a tool? This one has no tool_calls.";
      case 5: return "No request: this is the final answer. Return it.";
      case 6: return roles[n - 1] === "tool" ? `The tool message is in: ${n} messages. No more requests in this reply, so the inner loop ends.` : "Go through the requests in the reply. This one has one.";
      case 7: return `Take the function part of the request: <code>${kit_esc(name)}</code>.${args && turn > 0 && name === "book_slot" && "course" in args ? " (args still holds last round's value until the next line replaces it.)" : ""}`;
      case 8: return "The arguments arrive as a JSON string. json.loads turns them into a dict.";
      case 9: return `Look up <code>${kit_esc(name)}</code> in TOOLS and call it with ${kit_esc(JSON.stringify(args))}.`;
      case 10: return `It returned ${kit_esc(JSON.stringify(result))}. Wrap it in a tool message with the request's id, and add it.`;
      default: return "";
    }
  };
  const kit_esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function asCode({ el, done, kit }) {
    style();
    let i = 0;
    const said = {};
    const paint = () => {
      const [ln, , turn, roles, name, args, result] = TRACE[i];
      const prev = i ? TRACE[i - 1][3].length : roles.length;
      const cpAt = CP.indexOf(i), blocked = cpAt >= 0 && said[i] !== true;
      const nextLn = TRACE[i + 1] ? TRACE[i + 1][0] : -1;
      const copts = ["return reply[\"content\"]", "for call in reply[\"tool_calls\"]:"], cright = nextLn === 5 ? 0 : 1;
      el.innerHTML = `<h1>The same loop, in Python</h1>
        <p class="lead">This is the loop you just ran in your head, in plain Python. <code>ask_model</code> sends the messages to the model; <code>TOOLS</code> maps a name to the Python function; <code>tool_message</code> builds the reply you wrote on screen 3. The steps replay a real run of this code, with the model's replies taken from the recordings.</p>
        <p class="task">Step through to the end. When the loop reaches the <code>if</code>, predict where it goes.</p>
        <div class="${P}code">${codeWrapped(CODE, ln, kit)}</div>
        <div class="vars"><span>turn <b>${turn == null ? "–" : turn}</b></span><span>call <b>${name ? kit.esc(name) : "–"}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${roleChips(roles, prev, kit)}
        ${args || result ? `<div class="vars"><span>args <b>${args ? kit.esc(JSON.stringify(args)) : "–"}</b></span><span>result <b>${result ? kit.esc(JSON.stringify(result)) : "–"}</b></span></div>` : ""}
        ${cpAt >= 0 ? `<div class="lcase" id="cp"><p>Which line runs right after the <code>if</code>?</p>${kit.options(copts.map(kit.esc), { picked: said[i] === true ? cright : said[i] ?? null, correct: cright })}
          ${said[i] == null ? "" : said[i] === true ? kit.feedback(cright === 1 ? "Right: the reply holds a tool request, so the loop goes on to run it." : "Right: no tool request, so the loop returns the text. This is the only way out apart from the turn limit.", true)
            : kit.feedback(cright === 1 ? "The reply holds tool_calls, so <code>not reply.get(\"tool_calls\")</code> is False and the return is skipped. Returning here would hand Dana nothing: content is null in this reply." : "This reply has no tool_calls, so the condition is True. There are no requests to loop over: the model has finished.", false)}</div>`
          : kit.feedback(stepSay(i))}
        ${i === TRACE.length - 1 ? kit.feedback("In a web server, <code>ask_model</code> is a network call, so it would be <code>reply = await ask_model(messages)</code> inside an <code>async def</code>. When one reply holds several independent requests, the app can run them at the same time with <code>asyncio.gather</code>, then add each result with its own id.") : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || blocked ? "disabled" : ""}>Next step</button></div>`;
      el.querySelectorAll("#cp .lopts button").forEach(b => b.onclick = () => { const v = +b.dataset.i; said[i] = v === cright ? true : v; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { if (blocked) return; i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 7. Broken on purpose: a real loop that asks the same thing three times. */
  const BUG_CODE = CODE.slice();
  BUG_CODE[3] = "        history = messages + [reply]";
  BUG_CODE[10] = "            history.append(tool_message(call[\"id\"], result))";
  const BUG_MAX = REC_BUG.length;
  // From docs/ai-path/runs/s5a-function-calling/loop_bug.out.txt (whole lines, not altered)
  const BUG_LOG = [
    "RETURNED: Stopped: too many turns",
    "BOOKINGS: []",
    "MESSAGES LIST IN THE END: 2",
    ...REC_BUG.map((r, t) => `turn ${t}: sent ${r.sent} messages; model asked find_free_slots ${BUG_ARGS} (id ${r.id}); history has 3 messages`)
  ];
  const BUG_CAUSE = 3;
  function broken({ el, done, kit }) {
    style();
    let pre = null, line = null, fix = null;
    const PRE = [
      "The app adds the reply and the tool result to some list, but not to the list it sends",
      "The API forgets the earlier messages between calls",
      "The model ignores the tool result and asks again"
    ];
    const PRE_NO = [null,
      `The API keeps nothing between calls in the working loop either, and that loop finished. Each request carries what the app put in it, and the log says the list the app sends still holds ${REC_BUG[0].sent} messages at the end.`,
      `To ignore a result, the model must first receive it. Each request had ${REC_BUG[0].sent} messages (${REC_BUG[0].inTok} input tokens every time): system and user only. No result was ever in a request.`];
    const lineSay = {
      0: "The function header is fine: it receives the conversation so far.",
      1: `The cap is what stopped this run after ${BUG_MAX} rounds. It limits the damage; it does not cause the repeat.`,
      2: `This line sends <code>messages</code>, which is the right list to send. The log shows it holds ${REC_BUG[0].sent} messages every time. The question is why it never grows.`,
      4: "This check worked: each reply had a tool request, so the loop went on to run the function, as the log shows.",
      5: "This return never ran: no reply was plain text.",
      6: "The function did run, once per round. Running it is not the problem.",
      7: "The function did run, once per round. Running it is not the problem.",
      8: "The arguments were parsed fine: the same course and date each time.",
      9: "find_free_slots ran and returned the slots each time. The result was produced; it just never reached the model.",
      10: "Close. This is where the result goes into <code>history</code>, and history is never sent. But history only exists because of an earlier line. Look at where it comes from.",
      11: "This is the symptom the app printed at the end, not the cause."
    };
    const FIX = ["Replace the history line with messages.append(reply), and append the tool message to messages", `Raise MAX_TURNS to 10, so the model has more rounds to finish`, "Add to the system prompt: “Never call the same tool twice.”"];
    const fixRight = 0;
    const paint = () => {
      const found = line === BUG_CAUSE, preOk = pre === 0;
      el.innerHTML = `<h1>Broken on purpose: the same question, three times</h1>
        <p class="lead">A teammate wrote this version of the loop, with MAX_TURNS set to ${BUG_MAX}. It ran for real against the same model, with the same question from Dana. Below is what the run printed. Every request carried the same ${REC_BUG[0].sent} messages (${REC_BUG.map(r => r.inTok).join(", ")} input tokens). Every reply was the same request, each time with a new id.</p>
        <pre class="${P}log">${kit.esc(BUG_LOG.join("\n"))}</pre>
        <p class="${P}cap">Real output of loop_bug.py. Model replies recorded ${REC_1.recordedAt}.</p>
        <p class="task">${!preOk ? "Before you see the code: why does every request carry the same messages?" : found ? "Now pick the fix." : "The code is below. Tap the line that causes the repeat."}</p>
        <div class="lcase" id="pre">${kit.options(PRE.map(kit.esc), { picked: pre, correct: 0 })}
          ${pre == null ? "" : preOk ? kit.feedback("Right. The model can only see what the app sends. So the bug is in the app: the result goes somewhere, just not into the list that is sent. Find where.", true) : kit.feedback(PRE_NO[pre], false)}</div>
        ${preOk ? `<div class="${P}lines" role="group" aria-label="the broken loop">${BUG_CODE.map((c, j) => `<button type="button" data-i="${j}" style="${ind(c)}" class="${j === line ? (found ? "on" : "no") : ""}" ${found ? "disabled" : ""}>${kit.esc(c).replace(/\(/g, "(<wbr>")}</button>`).join("")}</div>` : ""}
        <div class="lpanel">${line == null ? "" : found
          ? kit.feedback("Right. <code>messages + [reply]</code> builds a new list, like <code>[...messages, reply]</code> in JavaScript. The reply and the result go into that copy. <code>messages</code> stays at two, so every request asks the same thing, and the model, never seeing an answer, asks again.", true)
          : kit.feedback(lineSay[line], false)}
        ${found ? `<div class="lcase" id="fix"><p>Which change fixes it?</p>${kit.options(FIX.map(kit.esc), { picked: fix, correct: fixRight })}
          ${fix == null ? "" : fix === fixRight ? kit.feedback("Right: that is the loop you stepped through, which finished in three rounds. Keep the turn cap anyway. Here the repeated call was a harmless lookup. Had it been book_slot, every round would have booked another place, so actions should also be safe to repeat: for example, book_slot could refuse a second booking for the same climber and slot.", true)
            : fix === 1 ? kit.feedback("Every request would still be the same two messages, so every reply would be the same request. More rounds means more calls and more cost, and still no answer.", false)
            : kit.feedback("The model asked again because it never saw an answer. Forbid asking again and it still has no slot data: it can only give up or invent slots.", false)}</div>` : ""}</div>`;
      el.querySelectorAll("#pre .lopts button").forEach(b => b.onclick = () => { pre = +b.dataset.i; if (pre !== 0) { line = null; fix = null; } paint(); });
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => { line = +b.dataset.i; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === fixRight) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  const PICK = ["Function calling", "Plain code, no tools", "Structured output"];
  const BIG = [
    ["Every night, email each member how many times they climbed this month. Always the same two steps.", 1,
      "Right. Nothing needs choosing: your code runs the two steps itself. A model choosing tools would only add cost and a chance to choose wrong.",
      ["The steps never change, so there is nothing for the model to decide. Your code calls the two functions itself; a model is needed for the email text at most.", null, "No text is being turned into fields here. The data is already in your database; the job is to run the same two steps."]],
    ["A gym chat where members ask about classes, their own bookings, or cancel one, in their own words.", 0,
      "Right. The message decides which function to run and with what arguments, and the answers need live data.",
      [null, "Your code cannot know in advance which of several actions a free-text message needs. That choice is what the model is for.", "Structured output gives you fields from text, but cannot fetch a booking or cancel one. The member needs live data and actions."]],
    ["Turn instructors' free-text notes (“free Tue after 6, not Fri”) into rows of day, start and end.", 2,
      "Right. Nothing has to be looked up or done: you only need the text as fields that match a schema, which is the structured-output lesson.",
      ["No function needs to run: the answer is already in the note. A tool round trip adds a request and adds nothing.", "The notes are free text in many forms; plain code would need a parser for every way of writing a time. A model with a schema handles that."]]
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What for:</b> the model reads free text, picks which of your functions to run and with what arguments, and answers from the real results.</p>
        <p class="lead"><b>When:</b> the answer needs live data or an action, and the user's message decides which.</p>
        <p class="lead"><b>When not:</b> the steps are always the same (call them in your code); you only need fields from text (structured output); the answer is already in the prompt.</p>
        <p class="lead"><b>Costs:</b> every tool call adds a round trip, so more waiting. The tool descriptions and the growing history are input tokens on every request, cached or not. The model can pick a wrong tool or wrong arguments, so check them before running anything that changes data.</p>
        <p class="task">For each job, pick what fits best.</p>
        ${BIG.map(([q, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(PICK, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : no[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations, with one honest "no". */
  const CASES = [
    ["An online shop's help chat gets “Where is my order 4471?” and must answer from the shipping company's system.", true,
      "Yes. The status is live data the model cannot know. Give it a get_order_status function; your code calls the shipping system and sends the status back.",
      "The model has never seen order 4471. Without a function to fetch the status, it can only guess. A get_order_status tool lets your code fetch it and send it back."],
    ["A writing helper rewrites a paragraph the user pastes so that it sounds friendlier.", false,
      "No. Everything the model needs is in the prompt: the paragraph and the instruction. Nothing has to be looked up or done, so a tool adds a round trip and nothing else. One plain request is enough.",
      "Ask what the function would do. The paragraph is already in the prompt, and nothing outside has to change. A tool would add a round trip and nothing else; one plain request is enough."],
    ["A travel app gets “How much is 250 euros in yen today?”", true,
      "Yes. Today's rate is live data, so a get_rate function fetches it. Then do the multiplication in your code or a second function, not in the model's head.",
      "The model's training data has no rate for today. A get_rate tool fetches the live rate; your code does the arithmetic."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A tool loop, or not?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the gym.</p>
        <p class="task">For each one, decide whether giving the model functions to call is the right tool. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: a browser exercise in Python, then the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can write the loop</h1>
      <p>The model writes requests. Your app runs the function, sends the result back as a tool message with the request's id, and asks again. It stops when a reply has no request, or at the turn limit. Each round resends everything, so each round sends more tokens than the last.</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>run_turns</code> yourself against a stand-in model, make it answer every request with the right id, and make it stop at the final answer and at the turn limit.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. It keeps this loop, but moves the functions into a separate server that many apps can share, instead of one app's Python file.</p>` : ""}`;
    done();
  }

  // walk for screen 6: step to each checkpoint, answer it, step to the end
  const CODE_WALK = (() => {
    const right = [];
    for (let k = 0; k < TRACE.length - 1; k++) {
      if (CP.includes(k)) right.push("#cp [data-right]");
      right.push("[data-next]");
    }
    return { wrong: [...Array(CP[0]).fill("[data-next]"), "#cp [data-wrong]"], right: right.slice(CP[0]) };
  })();

  LessonKit.define("s5a-function-calling", {
    title: "Function calling: the request and reply loop",
    checked: "2026-11-13",
    sources: [
      "https://openrouter.ai/docs/features/tool-calling",
      "https://developers.openai.com/api/docs/guides/function-calling",
      "https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview",
      "https://developers.openai.com/api/docs/guides/prompt-caching",
      "https://docs.python.org/3/library/asyncio-task.html"
    ],
    interview: [{
      q: "Users of your booking assistant are told “you're booked”, but some bookings do not exist in the database. How do you find out what went wrong and fix it?",
      good: ["Read the logged messages of a bad session: was book_slot requested, did the app run it, and what did it return?",
        "Treat the function's result as the record, not the model's sentence; confirm to the user only from a returned booking reference",
        "Send failures back as tool results (booked: false, with the reason), so the model can tell the user it failed",
        "Check the loop itself: is every result added to the history with the right tool_call_id before the next request?"],
      weak: "Add “never claim a booking you did not make” to the prompt. It misses that only the app knows whether book_slot ran and what it returned."
    }, {
      q: "Your agent keeps calling the same tool with the same arguments until it hits the turn limit. What do you check first?",
      good: ["Whether the tool result is actually in the messages that get sent: a copy or a lost append makes every request identical",
        "Whether the result's id matches the request's id, and whether the result is an error the model keeps retrying",
        "Keep a turn cap and stop on a repeated identical call, so a bug costs a few calls, not hundreds",
        "Make actions safe to repeat, so a repeated book or pay call does no harm"],
      weak: "Raise the turn limit or switch to a bigger model. If the model never sees the result, any model will ask again."
    }],
    screens: [situation, lookUp, replyMsg, spotIdea, predict, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${SESSIONS.find(s => !RIGHT_ROWS.includes(s.slot_id)).slot_id}"]`], right: RIGHT_ROWS.map(id => `[data-i="${id}"]`) },
      { wrong: ["#r0 [data-wrong]"], right: ["#r0 [data-right]", "#r1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      CODE_WALK,
      { wrong: ["#pre [data-wrong]"], right: ["#pre [data-right]", `.${P}lines [data-i="${BUG_CAUSE}"]`, "#fix [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
