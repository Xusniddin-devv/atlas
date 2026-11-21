/* Lesson s5a-tokens-window: tokens and the context window as a budget.
   Story: a town council's minutes assistant. Members paste whole meeting transcripts and ask for the decisions;
   the last agenda items silently disappear. Ideas: (1) the window is one budget shared by the system prompt, the
   pasted text, the question AND the answer; (2) when a request is over budget, code that truncates keeps the start
   and drops the end without an error, and an answer cap that is too small cuts the answer (finish_reason "length").
   Count with the model's own tokenizer before you send.
   Data: docs/ai-path/runs/s5a-tokens-window/ (meetings.py = the made-up transcripts, budget.py -> budget.out.txt and
   budget.json = every token count and the cut, cut_demo.py -> cut_demo.out.txt = the traced code screen,
   usage_check.py -> usage_check.out.txt = our counts against the API's usage). Recordings (main checkout):
   docs/ai-path/recordings/s5a-tokens-window/cut-transcript.json, full-transcript.json, short-room.json.
   Every number on screen is computed here from D, TRACE and the REC_* constants. Lesson-local CSS: the budget bar,
   the recorded-output block, the clickable log lines and a compact three-column table (prefix lx-s5a-tokens-window-). */
(() => {
  const P = "lx-s5a-tokens-window-";
  const fmt = n => n.toLocaleString("en");

  // From docs/ai-path/runs/s5a-tokens-window/budget.out.txt and budget.json (DeepSeek-V3 tokenizer via Hugging Face Tokenizers)
  const D = {
    window: 2048, answerRoom: 400, system: 42, question: 9,
    meetings: [
      { label: "Planning", date: "2 October", items: 3, transcript: 749 },
      { label: "Ordinary", date: "14 October", items: 8, transcript: 2041, words: 1412 },
      { label: "Finance", date: "21 October", items: 6, transcript: 1512 },
      { label: "Extra", date: "28 October", items: 7, transcript: 1847 },
      { label: "Parks", date: "30 October", items: 5, transcript: 1252 }
    ],
    // the 14 October transcript: [item, title, token where the item starts, token where its decision line starts]
    starts: [
      [1, "Minutes of the September meeting", 105, 270],
      [2, "Bus shelter repairs on Mill Road", 290, 537],
      [3, "Sunday opening at the library", 558, 801],
      [4, "LED street lighting contract", 829, 1040],
      [5, "Playground resurfacing at Hollis Park", 1054, 1281],
      [6, "Parking permit prices in zone B", 1292, 1525],
      [7, "Licence for a Saturday farmers' market", 1560, 1789],
      [8, "Winter road gritting budget", 1806, 2015]
    ],
    cutKept: 1597, cutDropped: 444,
    cutTail: " application for a Saturday farmers' market in Bridge Square.\nC",
    // usage_check.out.txt: the full 14 October request counted three ways, and what the API reported
    full: { words: 1454, gpt2: 2172, own: 2092, api: 2095 },
    // our count of each recorded request and the API's prompt_tokens
    usage: [["cut-transcript", 1649, 1652], ["full-transcript", 2092, 2095], ["short-room", 1898, 1901]]
  };
  const STORY = D.meetings[1], EXTRA = D.meetings[3];

  // From docs/ai-path/recordings/s5a-tokens-window/cut-transcript.json (not trimmed, not altered)
  const REC_CUT = {
    src: "s5a-tokens-window/cut-transcript",
    provider: "openrouter", model: "deepseek/deepseek-chat", recordedAt: "2026-11-13", finish: "stop",
    text: "1. Approved the September meeting minutes with a correction to the footpath survey status.  \n2. Approved the £18,400 quote for bus shelter repairs on Mill Road, starting with the school shelter.  \n3. Approved a six-month trial for Sunday opening at the library (12:00–16:00).  \n4. Deferred the LED street lighting contract decision to the November meeting pending additional quotes.  \n5. Approved £9,750 for playground resurfacing at Hollis Park in March, with the climbing frame fenced off until then.  \n6. Rejected the proposal to raise parking permit prices in zone B from £40 to £65.  \n7. [Incomplete transcript; decision not provided.]  \n8. [Not discussed in the provided transcript.]"
  };
  // From docs/ai-path/recordings/s5a-tokens-window/short-room.json (not trimmed, not altered)
  const REC_SHORT = {
    src: "s5a-tokens-window/short-room",
    provider: "openrouter", model: "deepseek/deepseek-chat", recordedAt: "2026-11-13",
    maxTokens: 150, promptTokens: 1901, completionTokens: 150, finish: "length",
    text: "1. Approved the quote of £18,400 for bus shelter repairs on Mill Road, starting with the school shelter.  \n2. Approved a six-month trial for Sunday opening at the library from 12:00 to 16:00, to be reviewed in April.  \n3. Deferred the LED street lighting contract to the November meeting to obtain additional quotes and address colour specifications.  \n4. Approved £9,750 for playground resurfacing at Hollis Park in March, with the climbing frame fenced off until then.  \n5. Rejected the proposal to raise parking permit prices in zone B from £40 to £65.  \n6. Granted a licence for a Saturday farmers' market in Bridge Square, with conditions ensuring no"
  };

  // derived
  const FIXED = D.system + D.question;
  const total = m => D.system + m.transcript + D.question + D.answerRoom;
  const input = m => D.system + m.transcript + D.question;
  const ROOM = D.window - FIXED - D.answerRoom;                  // room for the transcript
  const CUT_LINES = REC_CUT.text.split("\n").map(l => l.trim());
  const MISSING = CUT_LINES.map((l, i) => /^\d+\. \[/.test(l) ? i : -1).filter(i => i >= 0);
  const CUT_IN = D.starts.findIndex(([, , s], i) => s <= ROOM && (i === D.starts.length - 1 || D.starts[i + 1][2] > ROOM));
  const EXTRA_LEFT = D.window - input(EXTRA);
  const SHORT_LINES = REC_SHORT.text.split("\n").length;
  const DIFF = D.usage.map(([, ours, api]) => api - ours);
  const SAME_DIFF = DIFF.every(d => d === DIFF[0]) ? DIFF[0] : null;
  const NOFIT = D.meetings.filter(m => total(m) > D.window).length;
  const ONLY_ANSWER = D.meetings.filter(m => total(m) > D.window && input(m) <= D.window).length;
  // with direction "left" the first cutDropped tokens go: which items would be lost whole, and which in part
  const LEFT_LOST = (() => {
    const whole = D.starts.filter((s, i) => (i + 1 < D.starts.length ? D.starts[i + 1][2] : STORY.transcript) <= D.cutDropped).map(s => s[0]);
    const part = D.starts.find((s, i) => s[2] < D.cutDropped && (i + 1 < D.starts.length ? D.starts[i + 1][2] : STORY.transcript) > D.cutDropped);
    return `the agenda at the top${whole.length ? ` and item ${whole.join(", ")}` : ""} would vanish${part ? `, plus the start of item ${part[0]}` : ""}`;
  })();
  const caption = rec => `<p class="${P}cap">Recorded model output, ${rec.recordedAt}</p>`;

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}bw { position: relative; margin-top: 30px; }
      .${P}bar { display: flex; height: 30px; border: 1.5px solid var(--ink); border-radius: 6px; overflow: hidden; background: var(--bg); }
      .${P}seg { height: 100%; min-width: 3px; }
      .${P}sys { background: var(--faint); }
      .${P}tx { background: var(--ink-2); }
      .${P}ans { background: var(--good-soft); box-shadow: inset 0 0 0 2px var(--good); }
      .${P}over { background: var(--bad-soft); box-shadow: inset 0 0 0 2px var(--bad); }
      .${P}mark { position: absolute; top: -22px; bottom: -4px; border-left: 2px solid var(--ink); }
      .${P}mark span { position: absolute; top: 0; font: 600 12px var(--mono); color: var(--ink); white-space: nowrap; }
      .${P}leg { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; font: 500 14px var(--mono); color: var(--muted); }
      .${P}leg i { display: inline-block; width: 14px; height: 14px; border-radius: 3px; vertical-align: -2px; margin-right: 6px; }
      .${P}leg b { color: var(--ink); }
      .${P}out { white-space: pre-wrap; font: 500 15px/1.55 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-top: 14px; overflow-wrap: anywhere; }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}who { font-size: 15px; color: var(--muted); margin: 18px 0 0; }
      .${P}log { display: block; width: 100%; text-align: left; min-height: 44px; font: 500 15px/1.4 var(--mono); border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 8px; padding: 10px 12px; margin-top: 8px; cursor: pointer; overflow-wrap: anywhere; white-space: pre-wrap; }
      .${P}log.right { border-color: var(--good); background: var(--good-soft); }
      .${P}log.wrong { border-color: var(--bad); background: var(--bad-soft); }
      @media (hover: hover) { .${P}log:not(.right):not(.wrong):hover { border-color: var(--ink); } }
      .${P}tb { border-collapse: collapse; width: 100%; margin-top: 18px; font: 500 15px var(--mono); }
      .${P}tb th { text-align: left; font: 600 13px var(--font); color: var(--muted); padding: 4px 8px 6px; border-bottom: 2px solid var(--ink); }
      .${P}tb td { padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}tb td.n { text-align: right; white-space: nowrap; }
      .${P}tb tr.cut td { box-shadow: inset 0 -2px 0 var(--bad); }
      .${P}tb tr.gone td { color: var(--faint); }
      .${P}agenda { display: grid; gap: 8px; margin-top: 14px; }
      .${P}agenda button { font: 600 16px var(--font); text-align: left; min-height: 48px; padding: 10px 14px; border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 10px; cursor: pointer; }
      .${P}agenda button.right { border-color: var(--good); background: var(--good-soft); color: var(--good); }
      .${P}agenda button.wrong { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
      .${P}out2 { white-space: pre-wrap; font: 500 14px/1.5 var(--mono); background: var(--surface); border-radius: 8px; padding: 10px 12px; margin-top: 10px; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }

  /* The budget bar: parts in order, drawn to scale against the window; anything past the window is marked over. */
  function budgetBar(parts, note) {
    const sum = parts.reduce((a, p) => a + p.n, 0), scale = Math.max(sum, D.window);
    let used = 0;
    const segs = [];
    for (const p of parts) {
      const inWin = Math.max(0, Math.min(p.n, D.window - used)), out = p.n - inWin;
      if (inWin) segs.push(`<span class="${P}seg ${P}${p.k}" style="width:${inWin / scale * 100}%" title="${p.label}"></span>`);
      if (out) segs.push(`<span class="${P}seg ${P}over" style="width:${out / scale * 100}%" title="over the window"></span>`);
      used += p.n;
    }
    const at = D.window / scale * 100;
    const lab = at > 60 ? `right:0;` : `left:4px;`;
    const kinds = [["sys", "system prompt and question"], ["tx", "transcript"], ["ans", "room for the answer"]].filter(([k]) => parts.some(p => p.k === k));
    return `<div class="${P}bw"><div class="${P}bar">${segs.join("")}</div>
      <div class="${P}mark" style="left:calc(${at}% - 1px)"><span style="${lab}${at > 60 ? "padding-right:6px" : ""}">window ends: ${fmt(D.window)}</span></div></div>
      <div class="${P}leg">${kinds.map(([k, t]) => `<span><i class="${P}${k}"></i>${t}</span>`).join("")}${sum > D.window ? `<span><i class="${P}over"></i>past the window: <b>${fmt(sum - D.window)}</b></span>` : ""}${note ? `<span>${note}</span>` : ""}</div>`;
  }
  const partsFor = (m, answer = D.answerRoom) => [
    { k: "sys", n: D.system, label: "system prompt" }, { k: "tx", n: m.transcript, label: "transcript" },
    { k: "sys", n: D.question, label: "question" }, { k: "ans", n: answer, label: "answer" }];

  /* 1. The situation: which agenda items did the answer drop? */
  function missing({ el, done, kit }) {
    css();
    const picked = new Set();
    let msg = null;
    const paint = () => {
      const fin = MISSING.every(i => picked.has(i));
      el.innerHTML = `<h1>The last agenda items vanish</h1>
        <p class="lead">Larkford Town Council has a minutes assistant. A council member pastes the transcript of a whole meeting and asks what was decided. The 14 October meeting had ${STORY.items} agenda items, and the chair announced a decision on every one. Councillor Brandt pasted the transcript and got this back.</p>
        <p class="${P}who">A hosted model answered:</p>
        <div class="${P}out">${kit.esc(REC_CUT.text)}</div>${caption(REC_CUT)}
        <p class="task">Tap each agenda item that the answer gives no decision for.</p>
        <div class="${P}agenda">${D.starts.map(([n, t], i) => `<button type="button" data-i="${i}" class="${picked.has(i) ? "right" : msg && msg.i === i ? "wrong" : ""}" ${fin ? "disabled" : ""}>${n}. ${kit.esc(t)}</button>`).join("")}</div>
        <div class="lpanel">${fin ? kit.feedback(`Items ${MISSING.map(i => i + 1).join(" and ")}. Look again at item ${MISSING[MISSING.length - 1] + 1}: the answer says it was <b>not discussed</b>. The transcript shows the council discussed it and voted on it. So the answer is not just short, it states something false. The only hint, “incomplete transcript” on item ${MISSING[0] + 1}, reads as if the meeting record were faulty. This lesson finds out where the two items went, and how to stop it in any app that sends long text to a model.`, true)
          : msg ? kit.feedback(msg.say, msg.ok) : ""}</div>`;
      el.querySelectorAll(`.${P}agenda button`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (MISSING.includes(i)) { picked.add(i); msg = { i, say: `Right: line ${i + 1} of the answer is “${kit.esc(CUT_LINES[i])}”. ${MISSING.length - picked.size ? "One more to find." : ""}`, ok: true }; }
        else msg = { i, say: `The answer does give item ${i + 1} a decision: “${kit.esc(CUT_LINES[i])}”. Look for lines with no decision in them.`, ok: false };
        paint();
        if (MISSING.every(j => picked.has(j))) done();
      });
    };
    paint();
  }

  /* 2. By hand: five requests, does each one fit the window? */
  function budget({ el, done, kit }) {
    css();
    const ans = D.meetings.map(() => null);
    const fits = m => total(m) <= D.window;
    const say = (m, pick) => {
      const ok = pick === (fits(m) ? 0 : 1), sum = `${D.system} + ${fmt(m.transcript)} + ${D.question} + ${D.answerRoom} = <b>${fmt(total(m))}</b>`;
      if (ok) return [fits(m) ? `${sum}. It fits, with ${fmt(D.window - total(m))} tokens to spare.`
        : input(m) <= D.window ? `${sum}: ${fmt(total(m) - D.window)} over. The input alone (${fmt(input(m))}) fits, but the answer is written inside the same window.`
        : `${sum}: ${fmt(total(m) - D.window)} over. Even the input alone, ${fmt(input(m))}, is over ${fmt(D.window)}.`, true];
      if (fits(m)) return [`Add all four parts: ${sum}. That is ${fmt(D.window - total(m))} under ${fmt(D.window)}, so it fits.`, false];
      if (input(m) <= D.window) return [`The input alone is ${fmt(input(m))}, which fits. But you left out the answer: the model writes it inside the same window, and it needs ${D.answerRoom} tokens. ${sum}.`, false];
      return [`Even without the answer, ${D.system} + ${fmt(m.transcript)} + ${D.question} = ${fmt(input(m))} is over ${fmt(D.window)}.`, false];
    };
    const paint = () => {
      const all = D.meetings.every((m, i) => ans[i] === (fits(m) ? 0 : 1));
      el.innerHTML = `<h1>Does each request fit?</h1>
        <p class="lead">The assistant runs its model with a <b>context window</b> of ${fmt(D.window)} tokens. The window is everything the model handles in one call: the system prompt, the pasted transcript, the question, and the answer it writes. ${fmt(D.window)} is small on purpose for this lesson. Real windows are often far larger, but the sums work the same way. The assistant keeps ${D.answerRoom} tokens free for the answer. Below are five requests from its log. The meetings are made up, but the token counts are real: we counted their text with the model's own tokenizer.</p>
        <table class="${P}tb"><thead><tr><th>every request has</th><th class="n">tokens</th></tr></thead><tbody>
          <tr><td>system prompt</td><td class="n">${D.system}</td></tr><tr><td>question</td><td class="n">${D.question}</td></tr><tr><td>room for the answer</td><td class="n">${D.answerRoom}</td></tr></tbody></table>
        <p class="task">For each meeting, add the four parts and decide whether the request fits in ${fmt(D.window)}.</p>
        ${D.meetings.map((m, i) => {
          const right = ans[i] === (fits(m) ? 0 : 1), f = ans[i] == null ? null : say(m, ans[i]);
          return `<div class="lcase" id="c${i}"><p><b>${m.label}, ${m.date}</b>: ${m.items} agenda items, transcript <b>${fmt(m.transcript)}</b> tokens.</p>${kit.options(["Fits", "Too long"], { picked: ans[i], correct: fits(m) ? 0 : 1 })}${f ? kit.feedback(f[0], f[1]) : ""}${right ? budgetBar(partsFor(m)) : ""}</div>`;
        }).join("")}
        ${all ? kit.feedback(`${NOFIT} of ${D.meetings.length} do not fit, and ${ONLY_ANSWER} of them only because of the answer. Word counts would have misled you: the 14 October transcript has ${fmt(STORY.words)} words but ${fmt(STORY.transcript)} tokens.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (D.meetings.every((m, j) => ans[j] === (fits(m) ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: what reaches the model when the request is over budget and the code truncates. */
  function whatReached({ el, done, kit }) {
    css();
    let ans = null;
    const over = total(STORY) - D.window;
    const opts = [
      `All ${fmt(STORY.transcript)} tokens. The model reads the end too, just with less care.`,
      `The first ${fmt(ROOM)} tokens of the transcript. The last ${fmt(over)} were dropped before sending.`,
      `A shorter version of every item, so all ${STORY.items} items are still covered.`,
      `The last ${fmt(ROOM)} tokens of the transcript. The start was dropped.`
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Something has to give</h1>
        <p class="lead">The 14 October request is ${fmt(over)} tokens over. The assistant does not fail on it. Its code counts the transcript with the tokenizer, and it has <b>truncation</b> switched on, with default settings. Truncation means the tokenizer cuts the token list down to a maximum length. Here the maximum is the ${fmt(ROOM)} tokens left after the system prompt, the question and the answer's room: ${fmt(D.window)} − ${D.system} − ${D.question} − ${D.answerRoom}.</p>
        ${budgetBar([0, 2, 3, 1].map(k => partsFor(STORY)[k]), "drawn with the transcript last: it is the part the code cuts")}
        <p class="task">Which part of the meeting reached the model?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The window is a budget, and every part of the request draws from it, the answer included. When the request is over, truncation keeps the start and drops the end. No error, no warning: the model answers from what is left, so the decisions at the end of the meeting are simply not there.`, true)
          : ans === 0 ? kit.feedback(`The window is a hard limit, not a reading speed. Tokens that do not fit are never part of the call. And the answer would then have had a decision for items ${MISSING.map(i => i + 1).join(" and ")}.`, false)
          : ans === 2 ? kit.feedback(`A tokenizer only splits text into tokens and, with truncation on, cuts the list. It cannot summarise: shortening every item would need a model call of its own.`, false)
          : kit.feedback(`Cutting the start happens only if truncation is set to the "left" direction. The default cuts the end. You can check it against the answer too: it has decisions for items 1 to ${MISSING[0]}, which sit at the start.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Where the cut lands: predict the item, then what the model got of it; the real tail of the sent text. */
  function whereCut({ el, done, kit }) {
    css();
    let a1 = null, a2 = null;
    const choice = [4, 5, 6, 7];                       // indexes into D.starts offered for question 1
    const c1 = choice.indexOf(CUT_IN);
    const it = D.starts[CUT_IN];
    const o2 = ["Nothing at all", "Its heading and first line, but not the decision", "All of it, the decision included"];
    const r2 = it[2] < ROOM && it[3] >= ROOM ? 1 : it[2] >= ROOM ? 0 : 2;
    const paint = () => {
      const ok1 = a1 === c1, ok2 = a2 === r2;
      const cls = i => ok1 ? (i === CUT_IN ? "cut" : D.starts[i][2] >= ROOM ? "gone" : "") : "";
      el.innerHTML = `<h1>Where does the cut land?</h1>
        <p class="lead">The code keeps tokens 0 to ${fmt(ROOM - 1)} of the transcript and drops the rest. The table shows, for the 14 October transcript, the token where each agenda item starts and the token where the chair's decision line starts (from our tokenizer run).</p>
        <table class="${P}tb"><thead><tr><th>agenda item</th><th class="n">starts</th><th class="n">decision</th></tr></thead><tbody>
          ${D.starts.map(([n, t, s, d], i) => `<tr class="${cls(i)}"><td>${n}. ${kit.esc(t)}</td><td class="n">${fmt(s)}</td><td class="n">${fmt(d)}</td></tr>`).join("")}</tbody></table>
        <div id="q1"><p class="task">The cut is at token ${fmt(ROOM)}. In which item does it land?</p>
        ${kit.options(choice.map(i => `Item ${D.starts[i][0]}`), { picked: a1, correct: c1 })}
        ${a1 == null ? "" : ok1 ? kit.feedback(`Right. Item ${it[0]} starts at ${fmt(it[2])} and item ${it[0] + 1} at ${fmt(D.starts[CUT_IN + 1][2])}, so ${fmt(ROOM)} falls inside item ${it[0]}. Every item after it is dropped whole.`, true)
          : (() => { const j = choice[a1], s = D.starts[j]; return s[2] >= ROOM
            ? kit.feedback(`Item ${s[0]} starts at ${fmt(s[2])}, after the cut at ${fmt(ROOM)}. It is dropped whole, not cut through. Find the item that starts before ${fmt(ROOM)} and ends after it.`, false)
            : kit.feedback(`Item ${s[0]} runs from ${fmt(s[2])} to ${fmt(D.starts[j + 1][2] - 1)}, all below ${fmt(ROOM)}, so it is kept whole. The cut lands later.`, false); })()}</div>
        ${ok1 ? `<div id="q2"><p class="task">Item ${it[0]}'s decision line starts at token ${fmt(it[3])}. What did the model get of item ${it[0]}?</p>
          ${kit.options(o2, { picked: a2, correct: r2 })}
          ${a2 == null ? "" : ok2 ? kit.feedback(`Right: ${fmt(ROOM - it[2])} tokens of item ${it[0]}, and the decision line at ${fmt(it[3])} is past the cut. Here are the last 12 tokens that were sent, decoded, from our run:`, true)
            + `<div class="${P}out2">…${kit.esc(D.cutTail)}</div>`
            + kit.feedback(`The text stops in the middle of the next speaker's name. That explains the answer you saw: item ${it[0]} “incomplete”, and item ${it[0] + 1} “not discussed”, because the model saw item ${it[0] + 1} only as a line in the agenda at the top.`)
            : a2 === 0 ? kit.feedback(`Item ${it[0]} starts at ${fmt(it[2])}, below the cut at ${fmt(ROOM)}, so its first ${fmt(ROOM - it[2])} tokens were sent.`, false)
            : kit.feedback(`The decision line starts at ${fmt(it[3])}, which is past ${fmt(ROOM)}. It was dropped.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { a2 = +b.dataset.i; paint(); if (a2 === r2) done(); });
    };
    paint();
  }

  /* 5. The same cut with Hugging Face Tokenizers, replayed from a traced run (cut_demo.out.txt). */
  const CODE = [
    "def fit(transcript, system, question):",
    "    tok = Tokenizer.from_pretrained(MODEL)",
    "    full = tok.encode(transcript).ids",
    "    print(len(full))",
    "    fixed = len(tok.encode(system).ids)",
    "    fixed += len(tok.encode(question).ids)",
    "    room = WINDOW - fixed - ANSWER_ROOM",
    "    tok.enable_truncation(max_length=room)",
    "    cut = tok.encode(transcript)",
    "    print(len(cut.ids))",
    "    print(len(cut.overflowing[0].ids))",
    "    print(tok.decode(cut.ids[-12:]))",
    "    return tok.decode(cut.ids)"
  ];
  // docs/ai-path/runs/s5a-tokens-window/cut_demo.out.txt: one step per line event (state before that line runs)
  const TRACE = [
    { line: 1, vars: {}, out: "" },
    { line: 2, vars: {}, out: "" },
    { line: 3, vars: {}, out: "" },
    { line: 4, vars: {}, out: "2041\n" },
    { line: 5, vars: { fixed: 42 }, out: "2041\n" },
    { line: 6, vars: { fixed: 51 }, out: "2041\n" },
    { line: 7, vars: { fixed: 51, room: 1597 }, out: "2041\n" },
    { line: 8, vars: { fixed: 51, room: 1597 }, out: "2041\n" },
    { line: 9, vars: { fixed: 51, room: 1597 }, out: "2041\n" },
    { line: 10, vars: { fixed: 51, room: 1597 }, out: "2041\n1597\n" },
    { line: 11, vars: { fixed: 51, room: 1597 }, out: "2041\n1597\n444\n" },
    { line: 12, vars: { fixed: 51, room: 1597 }, out: "2041\n1597\n444\n application for a Saturday farmers' market in Bridge Square.\nC\n" },
    { line: 12, event: "return", vars: { fixed: 51, room: 1597 }, out: "2041\n1597\n444\n application for a Saturday farmers' market in Bridge Square.\nC\n" }
  ];
  // a frame = one listing line that has just run, with the state right after it
  const FRAMES = TRACE.slice(0, -1).map((s, i) => ({ ln: s.line, vars: TRACE[i + 1].vars, out: TRACE[i + 1].out }));
  const OUT_LINES = FRAMES[FRAMES.length - 1].out.split("\n");
  const [PRINTED_FULL, PRINTED_KEPT, PRINTED_OVER] = OUT_LINES.slice(0, 3).map(Number);
  const GATE_LN = 10;                                  // predict what this line prints before seeing it
  const SAY = {
    1: "Load the tokenizer published with the model family the assistant uses (<code>MODEL = \"deepseek-ai/DeepSeek-V3\"</code>). <code>from_pretrained</code> fetches that model's <code>tokenizer.json</code> from the Hugging Face Hub, not the model.",
    2: "<code>encode</code> turns the transcript into an <code>Encoding</code>; its <code>ids</code> are the token numbers the model would receive.",
    3: () => `Printed: ${fmt(PRINTED_FULL)} tokens for the transcript alone. This is the count you budget with.`,
    4: f => `The system prompt, counted with the same tokenizer: ${f.vars.fixed} tokens.`,
    5: f => `Plus the question: fixed = ${f.vars.fixed}.`,
    6: f => `room = ${fmt(D.window)} − ${f.vars.fixed} − ${D.answerRoom} = ${fmt(f.vars.room)}: what the transcript may use.`,
    7: f => `<code>enable_truncation(max_length=${f.vars.room})</code>: from now on every <code>encode</code> keeps at most ${fmt(f.vars.room)} tokens. The other settings stay at their defaults, so <code>direction="right"</code>: it cuts the end.`,
    8: "Encode the same transcript again. No error and no warning.",
    9: () => `Printed: ${fmt(PRINTED_KEPT)} tokens kept.`,
    10: () => `Printed: ${fmt(PRINTED_OVER)} tokens sitting in <code>overflowing</code>. The library did not lose them; the assistant's code never looked there.`,
    11: () => `The last 12 kept tokens, decoded: the start of item ${D.starts[CUT_IN][0]}, cut inside a speaker's name.`,
    12: () => `<code>return</code> hands back the cut text, ${fmt(PRINTED_KEPT)} tokens of ${fmt(PRINTED_FULL)}, and the assistant sends it as if it were the whole meeting.`
  };
  function codeScreen({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const GATE = FRAMES.findIndex(f => f.ln === GATE_LN);
    const popts = ["0", String(PRINTED_OVER), String(PRINTED_KEPT), String(PRINTED_FULL)];
    const pright = 1;
    const paint = () => {
      const f = FRAMES[i], s = SAY[f.ln], gate = i === GATE - 1 && pred !== pright;
      el.innerHTML = `<h1>The same cut in Python</h1>
        <p class="lead">The assistant's cut, written with <b>Hugging Face Tokenizers</b>. <code>transcript</code>, <code>system</code> and <code>question</code> are strings; <code>WINDOW = ${fmt(D.window)}</code>, <code>ANSWER_ROOM = ${D.answerRoom}</code>. Each step replays a real run on the 14 October transcript.</p>
        <p class="task">Step through to the end. Before <code>len(cut.overflowing[0].ids)</code> is printed, predict it.</p>
        ${kit.code(CODE, f.ln)}
        <div class="vars"><span>fixed <b>${f.vars.fixed ?? "–"}</b></span><span>room <b>${f.vars.room ?? "–"}</b></span><span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        <div class="${P}out2">${f.out ? kit.esc(f.out.replace(/\n$/, "")) : "(nothing printed yet)"}</div>
        ${kit.feedback(typeof s === "function" ? s(f) : s)}
        ${gate ? `<div id="pred"><p class="task">Next: <code>print(len(cut.overflowing[0].ids))</code>. <code>cut.overflowing</code> is where the tokenizer puts the tokens that did not fit. What does it print?</p>${kit.options(popts.map(kit.esc), { picked: pred, correct: pright, num: true })}
          ${pred == null ? "" : pred === 0 ? kit.feedback(`The cut tokens do not vanish inside the library: <code>overflowing</code> keeps them as extra pieces. So its first piece is not empty.`, false)
          : pred === 2 ? kit.feedback(`${fmt(PRINTED_KEPT)} is what was kept: <code>cut.ids</code>, printed on the line before. <code>overflowing</code> holds the other part, what did not fit: ${fmt(PRINTED_FULL)} − ${fmt(PRINTED_KEPT)}.`, false)
          : kit.feedback(`${fmt(PRINTED_FULL)} is the whole transcript. <code>overflowing</code> holds only what did not fit: ${fmt(PRINTED_FULL)} − ${fmt(PRINTED_KEPT)}.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 || gate ? "disabled" : ""}>Next step</button></div>
        ${i === FRAMES.length - 1 ? `<p class="lead">Three settings matter. <code>max_length</code> is the budget. <code>direction="left"</code> would keep the end and drop the first ${fmt(D.cutDropped)} tokens instead: ${LEFT_LOST}. <code>stride</code> makes each overflowing piece repeat that many tokens from the piece before; that helps when you split a long text into parts on purpose. One <code>if cut.overflowing:</code> check before sending would have caught this meeting.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 6. Whose tokenizer: why does another tokenizer's count miss the bill? */
  const FMT = DIFF[0];                                 // the chat format's tokens: the API's count minus ours (the same in every recording)
  function whose({ el, done, kit }) {
    css();
    let ans = null;
    const rows = [["words (split on spaces)", D.full.words], ["GPT-2's tokenizer", D.full.gpt2], ["the model family's own tokenizer", D.full.own]];
    const gptOver = D.full.gpt2 - D.full.api, ownShort = D.full.api - D.full.own;
    const opts = [
      "GPT-2's count includes the chat format's marker tokens, and ours does not",
      "GPT-2's tokenizer learned a different vocabulary, so it cuts the same text into different pieces",
      "GPT-2's tokenizer counts whole words, not word pieces",
      `The API rounds its bill, so a gap of ${gptOver} is noise`
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Which count is the real one?</h1>
        <p class="lead">A budget only works if your count matches what the model really receives. We measured the full 14 October request (system prompt, transcript and question) three ways on this Mac, then sent it. The API's response reports how many input tokens it billed, in <code>usage.prompt_tokens</code>.</p>
        <table class="${P}tb"><thead><tr><th>counted as</th><th class="n">count</th></tr></thead><tbody>${rows.map(([t, v]) => `<tr><td>${t}</td><td class="n">${fmt(v)}</td></tr>`).join("")}
          <tr><td><b>billed by the API</b></td><td class="n"><b>${fmt(D.full.api)}</b></td></tr></tbody></table>
        <p class="task">The model family's own tokenizer is ${ownShort} short of the bill. GPT-2's tokenizer is ${gptOver} over it, on exactly the same text. Why does GPT-2's count miss by so much more?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Every tokenizer has its own vocabulary of pieces, so the same text gets a different count, and a different gap on every text. OpenRouter, which we recorded through, documents that it counts with each model's native tokenizer, so budget with the model family's own one. The last ${ownShort}: ${SAME_DIFF != null ? `the gap was exactly ${SAME_DIFF} in all ${D.usage.length} of our recordings, because ` : ""}the chat format wraps the messages in three marker tokens (one at the start, one before the member's message, one where the answer begins). Our budgets on the earlier screens left these ${FMT} tokens out to keep the sums simple. A real budget adds them, so the room for the 14 October transcript was really ${fmt(ROOM - FMT)}, not ${fmt(ROOM)}.`, true)
          : ans === 0 ? kit.feedback(`Both counts are of the same text, without the chat format. The format adds only ${FMT} tokens (that is why our own count is ${ownShort} short). It cannot explain a gap of ${fmt(D.full.gpt2 - D.full.own)} between the two tokenizers.`, false)
          : ans === 2 ? kit.feedback(`The text has ${fmt(D.full.words)} words, and GPT-2's count is ${fmt(D.full.gpt2)}. It splits words into pieces too, just not the same pieces.`, false)
          : kit.feedback(`The bill is exact: our own count was exactly ${FMT} short of it in all ${D.usage.length} recordings. A gap of ${gptOver} is a real difference in how the text was cut.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: an answer cut off because its room ran out. Find the proof, then the fix. */
  const LOG = [
    `request: ${EXTRA.label} meeting, ${EXTRA.date}, ${EXTRA.items} agenda items`,
    `max_tokens: ${REC_SHORT.maxTokens}`,
    `usage.prompt_tokens: ${fmt(REC_SHORT.promptTokens)}`,
    `usage.completion_tokens: ${REC_SHORT.completionTokens}`,
    `finish_reason: "${REC_SHORT.finish}"`
  ];
  const LOG_RIGHT = 4;
  function broken({ el, done, kit }) {
    css();
    let pick = null, fix = null;
    const shortUsage = D.usage.find(u => u[0] === "short-room");
    const FIX = [
      `Set max_tokens back to ${D.answerRoom}, so the answer has its old room, and send the same ${EXTRA.date} request again`,
      "Keep giving the answer whatever room is left, and ask in the system prompt for short decision lines so they fit in it",
      `Keep ${D.answerRoom} tokens for the answer first; if the transcript does not fit the rest, split it by agenda item into requests that do; treat finish_reason "length" as an error`
    ];
    const fixRight = 2;
    const paint = () => {
      const ok = pick === LOG_RIGHT;
      el.innerHTML = `<h1>Broken on purpose: the answer stops</h1>
        <p class="lead">After the October problem, the team changed the code. The answer no longer gets a fixed ${D.answerRoom} tokens. Now it gets whatever room the window has left. The ${EXTRA.date} meeting (${EXTRA.items} items) fits that way: its input is ${fmt(input(EXTRA))} tokens, so ${fmt(D.window)} − ${fmt(input(EXTRA))} = ${EXTRA_LEFT} are left for the answer. (The team's code leaves out the chat format's ${FMT} tokens, as our sums did; the real room is ${EXTRA_LEFT - FMT}.) To reproduce it, we sent this request to a hosted model with <code>max_tokens</code>, the cap on how many tokens the answer may use, set to ${EXTRA_LEFT}.</p>
        <p class="${P}who">The model answered:</p>
        <div class="${P}out">${kit.esc(REC_SHORT.text)}</div>${caption(REC_SHORT)}
        <p class="task">The answer has ${SHORT_LINES} lines for ${EXTRA.items} items and stops mid-sentence. Tap the line of the log that proves why.</p>
        <div id="log">${LOG.map((t, i) => `<button type="button" class="${P}log ${pick === i ? (i === LOG_RIGHT ? "right" : "wrong") : ""}" data-log="${i}">${kit.esc(t)}</button>`).join("")}</div>
        <div class="lpanel">${pick == null ? "" : ok
          ? kit.feedback(`Right. <code>finish_reason: "length"</code> means generation stopped because it reached <code>max_tokens</code>, not because the answer was done. A finished answer says <code>"${REC_CUT.finish}"</code>, as the 14 October one did. (<code>finish_reason</code> is the field of the OpenAI-style chat API that we recorded through; other APIs name it differently, for example <code>stop_reason: "max_tokens"</code> in the Claude API.) The model wrote ${REC_SHORT.completionTokens} tokens out of the ${REC_SHORT.maxTokens} it was allowed.`, true)
          : pick === 0 ? kit.feedback(`That line only names the meeting. It says nothing about why the model stopped writing; look for the line that gives the stop reason.`, false)
          : pick === 1 ? kit.feedback(`${REC_SHORT.maxTokens} is the cap you set. It is part of the story, but by itself it does not show the answer hit the cap. One line says why the model stopped.`, false)
          : pick === 2 ? kit.feedback(`${fmt(REC_SHORT.promptTokens)} is the whole request: our own count of it was ${fmt(shortUsage[1])}, plus ${shortUsage[2] - shortUsage[1]} for the chat format. Nothing was cut from the input this time.`, false)
          : kit.feedback(`${REC_SHORT.completionTokens} out of ${REC_SHORT.maxTokens} is a strong hint, but an answer can also end exactly at its cap by chance. One line states the reason outright.`, false)}
        ${ok ? `<div id="fix"><p class="task">Which fix stops this for every meeting?</p>${kit.options(FIX.map(kit.esc), { picked: fix, correct: fixRight })}
          ${fix == null ? "" : fix === fixRight ? kit.feedback(`Right. The answer's room is part of the budget, so reserve it before deciding how much transcript to send. Splitting by agenda item keeps every decision in some request, and checking <code>finish_reason</code> means a cut answer is never shown as complete.`, true)
            : fix === 0 ? kit.feedback(`${fmt(input(EXTRA))} + ${D.answerRoom} = ${fmt(input(EXTRA) + D.answerRoom)}, over the ${fmt(D.window)} window. The request no longer fits, which is how the October cut started.`, false)
            : kit.feedback(`That may squeeze ${EXTRA.items} lines into ${EXTRA_LEFT} tokens today, but a longer meeting leaves less room and breaks it again. The budget still has no fixed place for the answer.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(`#log .${P}log`).forEach(b => b.onclick = () => { if (pick === LOG_RIGHT) return; pick = +b.dataset.log; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === fixRight) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  const BIG = [
    ["A support chat that sends the whole conversation so far with every new message.", 0,
      "Right. The history grows every turn, so one day it will not fit. Count every request, and decide on purpose what to drop or summarise, before a framework drops the oldest turns for you."],
    ["A 300-page tender document and one question about its delivery dates, on a model whose window holds a small part of it.", 1,
      "Right. It will never fit, so counting only tells you that. Split it into parts or fetch only the parts about delivery, and send those."],
    ["A tool that labels one-line customer reviews as positive or negative, with a short fixed prompt.", 2,
      "Right. Every request is a tiny fraction of the window and never grows. A rough check once is enough; counting every call adds code and buys no safety."]
  ];
  const BIG_OPTS = ["Count and budget every request", "Split it, or send only the parts needed", "A rough check once is enough"];
  // feedback per picked option; "" at the right option
  const BIG_WRONG = [
    ["", "Splitting a conversation loses what the customer said earlier. The real risk is that it keeps growing: count every request.", "Each message adds to the history, so a check done once goes stale by the next turn."],
    ["Counting it every time just confirms it is far too long. You have to change what you send.", "", "It will not fit however you check it: send less, not just count it."],
    ["The requests are tiny and never grow, so counting each one adds work and catches nothing.", "There is nothing to split: one review is one short request.", ""]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to budget tokens</h1>
        <p class="lead"><b>What it is for:</b> knowing before you send that the request and its answer fit, and what the call will cost.</p>
        <p class="lead"><b>Reach for it</b> when input length varies: pasted documents, growing chat history, retrieved text, long answers, languages that need more tokens per word.</p>
        <p class="lead"><b>Not needed</b> for short fixed prompts far below the window, and it will not fix a wrong answer when everything already fits.</p>
        <p class="lead"><b>Instead,</b> for input that will never fit: split it and combine the parts, or send only the relevant parts (later lessons); a model with a bigger window is the other way out.</p>
        <p class="lead"><b>Cost:</b> every input token is paid on every call and adds waiting time. Filling a bigger window costs more per call, and the model uses the facts in a long context less reliably as it grows. Counting itself runs locally and is cheap.</p>
        <p class="task">Pick the right move for each situation.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : BIG_WRONG[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: is the token budget behind this? One "no". */
  const CASES = [
    ["A support bot forgets the customer's name after a long chat. Its framework keeps only the most recent part of the history that fits.", true,
      "Yes. The name was in the oldest turns, and those were dropped to make room. Same budget, a different cut: this one drops the start.",
      "The name was said early, and the framework keeps only the recent part that fits. The oldest turns were dropped to make room: a budget cut, from the start this time."],
    ["A translation of a long manual stops in the middle of a sentence. The response says finish_reason \"length\".", true,
      "Yes. The answer ran out of room: it reached max_tokens. Give the answer more room, or translate the manual in parts.",
      "finish_reason \"length\" is the model saying it hit its token cap. The answer's room was too small for the whole translation."],
    ["A hosted API rejects a request with an error that says the prompt is too long.", true,
      "Yes. The input alone is over the window. This hosted API refuses instead of cutting, which is the safer failure: you find out at once.",
      "\"Prompt is too long\" is the window speaking: the input alone does not fit. The difference from the council is only that this API refuses loudly instead of a silent cut."],
    ["A member pastes a 300-token email and asks when the next meeting is. The email says Thursday; the assistant says Tuesday.", false,
      "No. 300 tokens is a tiny part of the window, so nothing was cut and the answer had all the room it needed. The model misread or invented the day. Counting tokens will not fix that; it is a different failure, covered later in this unit.",
      "Nothing was cut: 300 tokens plus a short answer is a tiny part of the window. The right day reached the model and it still answered wrongly. That is a different failure, covered later in this unit."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is the token budget behind it?</h1>
        <p class="lead">Four situations without a council. Ask: did something not fit, the input or the answer?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (in-page practice: the lesson was the practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>The window is a budget</h1>
      <p class="lead">You can now count a request with the model's own tokenizer, add the answer's room, see where a cut would land, and read <code>finish_reason</code> to tell a finished answer from a cut one.</p>
      <table class="${P}tb"><tbody>
        <tr><td><b>Budget</b></td><td>System prompt + text + question + answer room, plus the chat format's few tokens, must fit the window.</td></tr>
        <tr><td><b>Silent cut</b></td><td>Default tokenizer truncation keeps the start and drops the end (history trimming often drops the start), with no error. Check what overflowed before you send.</td></tr>
        <tr><td><b>Answer room</b></td><td>Reserve it first. finish_reason "length" (stop_reason "max_tokens" in the Claude API) means the answer was cut.</td></tr>
      </tbody></table>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. The model writes its answer one token at a time; that lesson shows how each next token is picked.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5a-tokens-window", {
    title: "Tokens and the context window as a budget",
    checked: "2026-11-13",
    sources: [
      "https://huggingface.co/docs/tokenizers/v0.23.3/en/api/tokenizer",
      "https://huggingface.co/docs/tokenizers/v0.23.3/en/api/encoding",
      "https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/tokenizer_config.json",
      "https://openrouter.ai/docs/api-reference/overview",
      "https://api-docs.deepseek.com/api/create-chat-completion",
      "https://api-docs.deepseek.com/quick_start/token_usage",
      "https://platform.claude.com/docs/en/build-with-claude/context-windows",
      "https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons"
    ],
    interview: [{
      q: "Users of your report summariser say the summaries of long reports leave out the conclusions. Nothing errors. How do you find out why, and what do you change?",
      good: [
        "Count a failing request with the model's own tokenizer and compare it with the window and with the usage the API reports",
        "Look for a silent cut in our code or framework: tokenizer truncation, history trimming, a fixed character limit; conclusions sit at the end, which is what gets dropped",
        "Check finish_reason: \"length\" means the summary itself ran out of room",
        "Reserve the answer's room first, split long reports into parts and combine the summaries, and fail loudly when something overflows"
      ],
      weak: "Switch to a bigger model or tell it in the prompt to always include conclusions. That misses that the model never received the end of the report."
    }, {
      q: "A teammate says: let's move to a model with a much larger context window, then we never have to think about tokens again. What do you answer?",
      good: [
        "The window still has a limit, and the answer still needs its room, so we still count",
        "Every input token is paid on every call and adds waiting time, so stuffing the window costs more",
        "Recall gets worse as the context grows; sending only the relevant parts often answers better",
        "It can be the right move for rare, truly long inputs; measure cost and quality on our real requests first"
      ],
      weak: "Agreeing that bigger is simply better, without mentioning cost per call, latency, or that long contexts are read less reliably."
    }],
    screens: [missing, budget, whatReached, whereCut, codeScreen, whose, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="0"]'], right: MISSING.map(i => `[data-i="${i}"]`) },
      { wrong: ["#c1 [data-wrong]"], right: D.meetings.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: [...Array(FRAMES.findIndex(f => f.ln === GATE_LN) - 1).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FRAMES.length - FRAMES.findIndex(f => f.ln === GATE_LN)).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-log="2"]'], right: [`[data-log="${LOG_RIGHT}"]`, "#fix [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c3 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
