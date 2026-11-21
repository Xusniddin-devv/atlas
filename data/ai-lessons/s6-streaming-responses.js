/* Lesson: streaming tokens to the browser. Story: a bank's call-centre helper makes agents stare at a blank box while
   the whole answer is written; the customer waits on the line.
   Ideas: (1) send each token as soon as the model writes it, so the wait is for the first token, not the last
   (server-sent events: event: / data: lines, an empty line ends an event, a done event marks the end);
   (2) every hop must pass the stream through: a proxy that holds the response, and a connection that drops,
   both look different from a finished answer, and the client must tell them apart.
   Depth: explain (screens 1-3, 8-9, interview), library (screen 4: FastAPI's EventSourceResponse, real run;
   screen 6: the fetch reader that parses it, real run), debug (screen 5: nginx holding the stream; screen 7: a dropped
   connection), when-not (screens 8-9).
   Runs (docs/ai-path/runs/s6-streaming-responses/, run.sh on this Mac, 2026-11-13): helper_app.py (FastAPI 0.162.6)
   in front of a small open model (Ollama, gemma3:270m, prompt.json, temperature 0, seed 7); client.mjs (Node fetch,
   the same web APIs a browser has) logged every network chunk and every parsed event with its arrival time;
   nginx 1.31.6 (nginx.conf) in front for the proxied runs. Files: whole.*, stream.*, proxied-hand.*, proxied-sse.*,
   proxied-hand-nobuf.*, proxied-hand-nogzip.*, dropped.* (*.out.txt = client, *.server.txt = server log).
   No hosted model was called. Every number on screen is computed here from the constants below. Plain browser script. */
(() => {
  const P = "lx-s6-streaming-responses-";
  const RUN_DATE = "2026-11-13";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  /* ---------- The model's answer: the token events of stream.out.txt, in order (all six complete runs gave this answer) ---------- */
  const TOKENS = ["1", ".", " Confirm", " the", " payment", " with", " the", " customer", ":", " amount", ",", " date", ",", " shop", " name", ".", "\n", "2", ".", " Ask", " whether", " anyone", " else", " uses", " the", " card", ".", "\n", "3", ".", " If", " the", " customer", " still", " does", " not", " recognise", " it", ",", " block", " the", " card", " and", " order", " a", " new", " one", ".", "\n", "4", ".", " Open", " a", " dispute", ";", " the", " customer", " gets", " an", " answer", " within", " ", "1", "0", " working", " days", ".", " Never", " ask", " for", " the", " full", " card", " number", " or", " the", " PIN", ".", "\n"];
  const ANSWER = TOKENS.join("");
  const QUESTION = "The customer sees a card payment of 42.90 EUR to an online shop they do not recognise. What do I do?";

  /* ---------- Route 1, /answer (whole.out.txt, whole.server.txt): server-log times of each token; when the one body arrived ---------- */
  const WHOLE = {
    sent: [343, 356, 371, 385, 407, 425, 444, 464, 491, 515, 534, 560, 589, 624, 656, 680, 705, 774, 774, 797, 821, 880, 881, 895, 918, 944, 967, 988, 1021, 1040, 1066, 1103, 1119, 1146, 1168, 1194, 1220, 1244, 1267, 1291, 1322, 1342, 1368, 1391, 1415, 1442, 1465, 1491, 1516, 1548, 1566, 1590, 1616, 1640, 1669, 1691, 1715, 1739, 1764, 1791, 1816, 1839, 1863, 1887, 1911, 1936, 1960, 1982, 2004, 2027, 2052, 2075, 2097, 2118, 2141, 2165, 2190, 2217, 2250],
    arrived: 2338, bytes: 328
  };
  /* ---------- Route 2, /answer/stream (stream.out.txt, stream.server.txt) ---------- */
  const STREAM = {
    sent: [199, 219, 240, 263, 291, 332, 376, 425, 465, 499, 527, 554, 579, 612, 634, 658, 682, 706, 729, 753, 777, 809, 832, 860, 890, 917, 945, 972, 999, 1029, 1053, 1078, 1103, 1126, 1148, 1172, 1194, 1221, 1241, 1264, 1289, 1313, 1337, 1362, 1389, 1416, 1454, 1478, 1505, 1530, 1556, 1580, 1604, 1628, 1652, 1675, 1699, 1722, 1745, 1769, 1794, 1818, 1843, 1871, 1898, 1923, 1950, 1974, 2000, 2025, 2050, 2076, 2100, 2124, 2148, 2172, 2196, 2221, 2245],
    at: [256, 275, 296, 319, 347, 387, 432, 481, 521, 555, 583, 609, 635, 668, 690, 713, 737, 761, 784, 809, 833, 865, 887, 916, 945, 973, 1000, 1028, 1055, 1084, 1108, 1134, 1158, 1182, 1203, 1227, 1249, 1276, 1296, 1319, 1344, 1368, 1392, 1418, 1444, 1472, 1509, 1533, 1560, 1586, 1612, 1635, 1659, 1683, 1707, 1731, 1754, 1777, 1801, 1825, 1849, 1873, 1899, 1927, 1954, 1979, 2005, 2030, 2056, 2080, 2105, 2131, 2156, 2180, 2204, 2228, 2252, 2277, 2301],
    doneAt: 2326, bytes: 2158, chunks: 80,
    // the first three network chunks, exactly as received
    first: ["event: token\ndata: \"1\"\n\n", "event: token\ndata: \".\"\n\n", "event: token\ndata: \" Confirm\"\n\n"],
    nlEvent: "event: token\ndata: \"\\n\"\n\n", doneEvent: "event: done\ndata: [DONE]\n\n",
    headers: [["content-type", "text/event-stream; charset=utf-8"], ["cache-control", "no-cache"], ["x-accel-buffering", "no"]]
  };
  /* ---------- Behind nginx, hand-written events (proxied-hand.out.txt, proxied-hand.server.txt) ---------- */
  const BUF = {
    sent: [214, 232, 254, 274, 302, 325, 355, 399, 434, 492, 539, 577, 606, 639, 661, 686, 708, 731, 753, 774, 795, 817, 847, 867, 888, 909, 930, 954, 976, 999, 1024, 1056, 1082, 1108, 1134, 1162, 1190, 1219, 1249, 1279, 1327, 1353, 1392, 1409, 1436, 1461, 1487, 1511, 1535, 1564, 1587, 1612, 1633, 1657, 1681, 1705, 1731, 1765, 1789, 1827, 1845, 1871, 1902, 1928, 1950, 1978, 2004, 2031, 2059, 2077, 2101, 2126, 2150, 2174, 2197, 2220, 2242, 2264, 2287],
    // arrival time of each parsed event (79 tokens, then done); all came out of one chunk
    at: [2385, 2385, 2385, 2385, 2385, 2385, 2385, 2385, 2385, 2385, 2385, 2385, 2385, 2385, 2385, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2386, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387, 2387],
    chunks: [[2384, 2158]], finished: 2310, encoding: "gzip"
  };
  /* ---------- The same proxy with one change each: first and last network chunk (proxied-*.out.txt) ---------- */
  const FIXES = {
    sse: { first: 462, last: 2498, chunks: 80 },     // EventSourceResponse route, sends X-Accel-Buffering: no
    nobuf: { first: 264, last: 2481, chunks: 80 },   // proxy_buffering off
    nogzip: { first: 447, last: 2646, chunks: 80 }   // gzip off
  };
  /* ---------- The dropped connection (dropped.out.txt): the client stopped the server after the 30th token ---------- */
  const DROP = {
    status: 200, head: 95, tokens: 30, killedAt: 1019, errorAt: 1027,
    at: [309, 319, 333, 348, 363, 379, 396, 414, 434, 459, 480, 506, 537, 572, 608, 645, 681, 713, 749, 773, 801, 827, 852, 877, 901, 926, 949, 976, 996, 1019],
    error: "TypeError: terminated (cause: UND_ERR_SOCKET)",
    answer: "1. Confirm the payment with the customer: amount, date, shop name.\n2. Ask whether anyone else uses the card.\n3."
  };
  const NGINX = [
    "gzip on;",
    "gzip_types text/plain application/json text/event-stream;",
    "server {",
    "  listen 127.0.0.1:57411;",
    "  location / { proxy_pass http://127.0.0.1:57410; proxy_http_version 1.1; }",
    "}"
  ];
  const CAPTION = `Output of a small open model, run on this Mac, ${RUN_DATE}.`;

  /* ---------- derived ---------- */
  const N = TOKENS.length;
  const sec = ms => `${(ms / 1000).toFixed(2)} s`;
  const rate = sent => Math.round((sent.length - 1) / ((sent[sent.length - 1] - sent[0]) / 1000));
  const FIRST = STREAM.at[0];
  const TIMES_SOONER = Math.round(WHOLE.arrived / FIRST);
  const BYTES_MORE = Math.round(STREAM.bytes / WHOLE.bytes);
  const NL = TOKENS.indexOf("\n");
  const WAIT = BUF.sent.map((s, i) => BUF.at[i] - s);
  const WORST = WAIT.indexOf(Math.max(...WAIT));
  const BUF_EVENTS = BUF.at.length, BUF_TOKENS = BUF.sent.length;
  const DROP_TEXT = TOKENS.slice(0, DROP.tokens).join("");
  const STEP3 = ANSWER.split("\n").find(l => l.startsWith("3."));
  const MAX_T = Math.ceil(Math.max(WHOLE.arrived, STREAM.doneAt) / 500) * 500;

  /* ---------- Lesson-only styles and pictures ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}lane { margin: 14px 0 0; }
      .${P}lane > span { display: block; font: 600 13px var(--font); color: var(--ink-2); margin-bottom: 4px; }
      .${P}track { position: relative; height: 30px; border-bottom: 1.5px solid var(--ink-2); background: var(--sunk); border-radius: 6px 6px 0 0; }
      .${P}track i { position: absolute; bottom: 0; width: 2px; height: 12px; margin-left: -1px; background: var(--muted); }
      .${P}track b { position: absolute; bottom: 0; width: 4px; height: 28px; margin-left: -2px; background: var(--ink); border-radius: 2px; }
      .${P}track em { position: absolute; top: 2px; font: 700 11.5px var(--mono); font-style: normal; color: var(--ink); white-space: nowrap; }
      .${P}axis { display: flex; justify-content: space-between; font: 500 11.5px var(--mono); color: var(--muted); margin-top: 2px; }
      .${P}box { margin: 12px 0 0; padding: 10px 12px; min-height: 44px; background: var(--surface); border: 1.5px solid var(--line); border-radius: 8px; font: 500 14px/1.5 var(--font); color: var(--ink); white-space: pre-wrap; }
      .${P}box.cut { border-style: dashed; }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--font); color: var(--muted); }
      .${P}wire { margin: 12px 0 0; padding: 10px 12px; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); font: 500 13.5px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; font-variant-ligatures: none; }
      .${P}wire u { text-decoration: none; color: var(--code-ink); opacity: .55; }
      .${P}wire hr { border: 0; border-top: 1px dashed currentColor; opacity: .35; margin: 6px 0; }
      .${P}rows { display: grid; gap: 6px; margin-top: 12px; }
      .${P}row { display: grid; grid-template-columns: 4.6em 1fr 1fr; gap: 8px; align-items: center; width: 100%; min-height: 44px; padding: 6px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 13.5px/1.35 var(--mono); text-align: left; }
      .${P}row.head { min-height: 0; border: 0; background: transparent; color: var(--muted); font: 600 12px var(--font); padding-top: 0; padding-bottom: 0; }
      .${P}row.gap { min-height: 0; border: 0; background: transparent; color: var(--muted); padding-top: 0; padding-bottom: 0; }
      button.${P}row { cursor: pointer; }
      .${P}row.on { border-color: var(--good); background: var(--good-soft); color: var(--good); }
      .${P}row.no { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
      .${P}row:disabled { cursor: default; }
      .${P}lines { margin: 14px 0 0; padding: 8px 0; background: var(--code-bg); border-radius: var(--r); overflow-x: auto; }
      .${P}lines button, .${P}lines div { display: block; width: 100%; min-height: 44px; padding: 0 14px; border: 0; border-left: 3px solid transparent; background: transparent; color: var(--code-ink); font: 500 13.5px/44px var(--mono); text-align: left; white-space: pre; font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
      .${P}lines div { min-height: 0; line-height: 1.6; }
      .${P}lines button { cursor: pointer; }
      .${P}lines button.on { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--code-bg)); }
      .${P}lines button.no { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--code-bg)); }
      .${P}hdr { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 8px; font: 500 13px/1.5 var(--mono); overflow-wrap: anywhere; }
      .${P}hdr b { font-weight: 700; color: var(--ink-2); }
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
      .${P}checks { list-style: none; padding: 0; margin: 12px 0 16px; display: grid; gap: 8px; }
      .${P}checks label { display: flex; gap: 6px; align-items: center; min-height: 44px; padding: 4px 12px 4px 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); cursor: pointer; }
      .${P}checks input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 14px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -12px; }
      .${P}checks input:checked { background-color: var(--good); outline-color: var(--good); }
      .${P}checks input:focus-visible { outline-width: 3px; }
      @media (max-width: 420px) {
        .${P}lines button, .${P}lines div { font-size: 12.5px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; padding-top: 7px; padding-bottom: 7px; padding-left: calc(12px + var(--ind, 4ch)); text-indent: calc(-1 * var(--ind, 4ch)); }
        .${P}lines div { padding-top: 2px; padding-bottom: 2px; }
        .${P}row { grid-template-columns: 3.8em 1fr 1fr; font-size: 12.5px; padding: 6px 8px; }
      }
    `;
    document.head.appendChild(s);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = ms => `${Math.min(100, ms / MAX_T * 100).toFixed(2)}%`;
  // one time lane: small ticks (tokens), an optional tall mark with a label (when text first shows)
  const lane = (label, ticks, mark, markLabel) => `<div class="${P}lane"><span>${label}</span><div class="${P}track">${ticks.map(t => `<i style="left:${pct(t)}"></i>`).join("")}${mark == null ? "" : `<b style="left:${pct(mark)}"></b><em style="${mark / MAX_T > 0.6 ? `right:${(100 - mark / MAX_T * 100 + 1.2).toFixed(2)}%` : `left:calc(${pct(mark)} + 6px)`}">${esc(markLabel)}</em>`}</div></div>`;
  const axis = () => `<div class="${P}axis"><span>0 s</span><span>${sec(MAX_T / 2)}</span><span>${sec(MAX_T)}</span></div>`;
  // raw text with every line break drawn as ↵ and kept as a break
  const wire = text => esc(text).replace(/\n/g, `<u>↵</u>\n`);
  const wireBox = chunks => `<pre class="${P}wire">${chunks.map(wire).join("<hr>")}</pre>`;
  const ind = line => `--ind:${line.match(/^ */)[0].length + 4}ch`;
  const pickLines = (lines, picked, lock) => `<div class="${P}lines" role="group" aria-label="code">${lines.map((c, j) => `<button type="button" data-i="${j}" style="${ind(c)}" class="${picked && picked[0] === j ? (picked[1] ? "on" : "no") : ""}" ${lock ? "disabled" : ""}>${esc(c) || " "}</button>`).join("")}</div>`;
  const showLines = lines => `<div class="${P}lines">${lines.map(c => `<div style="${ind(c)}">${esc(c) || " "}</div>`).join("")}</div>`;
  // several questions on one screen, each shown once the one before is right
  function chain({ el, done, kit }, head, Q, after) {
    const ans = Q.map(() => null);
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const shown = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = head(ans) + Q.slice(0, shown).map((x, i) => `${x.pre ? x.pre() : ""}<div class="lcase" id="q${i}"><p>${x.q}</p>${kit.options(x.opts, { picked: ans[i], correct: x.right })}
        ${ans[i] == null ? "" : kit.feedback(ans[i] === x.right ? x.yes : x.no[ans[i]], ans[i] === x.right)}</div>`).join("") + (upto === -1 && after ? after() : "");
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i;
        if (ans[i] !== Q[i].right) for (let j = i + 1; j < Q.length; j++) ans[j] = null;
        paint();
        if (Q.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation, and the by-hand timeline: when does the agent first see text, each way? */
  function situation(ctx) {
    style();
    const mid = Math.floor(N / 2);
    chain(ctx, () => `<h1>Eight seconds of a blank box</h1>
      <p class="lead">A bank's call-centre agents ask a helper what to do while a customer waits on the line. The helper's route asks the model, waits for the <b>whole</b> answer, then sends it. The agent stares at a blank box for about eight seconds. This lesson is about that last step of an AI product: getting the model's words from your server to the person's screen.</p>
      <p class="lead">We rebuilt the helper on a Mac, with a small open model and the bank's rule for unrecognised card payments. The small model is quicker, so the times are shorter, but the pattern is the same.</p>
      <p class="lead">The agent asked: “${esc(QUESTION)}” Each small tick below is one token the model wrote, from the server's log.</p>
      ${lane(`The model writes ${N} tokens (server log)`, WHOLE.sent)}${axis()}
      <p class="task">Answer both questions. Use the ticks to reason about what the agent's box shows.</p>`, [
      { q: "Route 1, <code>/answer</code>, collects every token, then returns one JSON body. When does the first word appear in the agent's box?",
        opts: [`When the model writes its first token (${sec(WHOLE.sent[0])})`, `Halfway through (${sec(WHOLE.sent[mid])})`, `After the model's last token (${sec(WHOLE.sent[N - 1])}), when the one response arrives`], right: 2,
        yes: `Right. The response arrived at <b>${sec(WHOLE.arrived)}</b>, after the last token (${sec(WHOLE.sent[N - 1])} on the server's clock). Until then the agent saw nothing, although the model had been writing since ${sec(WHOLE.sent[0])}.`,
        no: [`The model wrote its first token then, but <code>/answer</code> keeps it in memory. Nothing goes to the browser until the last token is written and the JSON body is sent.`,
          `Halfway, the first two steps already exist on the server, but this route sends nothing until it has all ${N} tokens.`] },
      { pre: () => lane("Route 2: the same model, the same tokens (server log)", STREAM.sent) + axis(),
        q: "Route 2, <code>/answer/stream</code>, writes each token into the open response instead of collecting them. Which tick on its lane marks when the first word can appear in the agent's box?",
        opts: [`The first tick (${sec(STREAM.sent[0])}), plus the short trip to the browser`, `The middle tick (${sec(STREAM.sent[mid])})`, `The last tick (${sec(STREAM.sent[N - 1])})`], right: 0,
        yes: `Right. The first token reached the browser at <b>${sec(FIRST)}</b>; the rest followed one by one until the end marker at ${sec(STREAM.doneAt)}.`,
        no: [null, "That would be true only if the route held tokens back in groups. It writes each one into the response as soon as it exists.",
          "That is route 1's behaviour. Route 2 does not wait for the end: every token leaves the server as soon as the model writes it."] }
    ], () => `${lane("What the agent sees, route 1", [], WHOLE.arrived, `all text at ${sec(WHOLE.arrived)}`)}${lane("What the agent sees, route 2", STREAM.at, FIRST, `first word at ${sec(FIRST)}`)}${axis()}
      ${ctx.kit.feedback(`The first word came about <b>${TIMES_SOONER} times sooner</b> (${sec(FIRST)} against ${sec(WHOLE.arrived)}). The full answer still took about as long either way: ${sec(WHOLE.arrived)} and ${sec(STREAM.doneAt)}. With the bank's bigger model, the same pattern means the agent can start reading step 1 to the customer while step 4 is still being written.`)}`);
  }

  /* 2. Spot the idea: the total did not change; the first word moved. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = ["Streaming made the model write faster", "The server passes each token on as soon as it exists, so the agent waits for the first token, not the last", "Streaming sends fewer bytes, so the answer travels faster"];
    const NO = [`Look at the server logs: about ${rate(WHOLE.sent)} tokens per second for route 1 and about ${rate(STREAM.sent)} for route 2. Same model, same pace. The model does not know how its tokens are delivered.`,
      null,
      `It sends more. The streamed answer was ${STREAM.bytes} bytes against ${WHOLE.bytes} for the JSON body, about ${BYTES_MORE} times more, because every token travels in its own small event. Bytes were never the slow part: the model's writing was.`];
    const paint = () => {
      el.innerHTML = `<h1>Same total, shorter wait</h1>
        <p class="lead">Both routes ran the same model on the same question. The full answer took about the same time. Yet the agent could start reading after ${sec(FIRST)} instead of ${sec(WHOLE.arrived)}.</p>
        <p class="task">What changed?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1 ? kit.feedback(`Right. A model writes its answer one token at a time, and the whole answer exists only at the end. Two times matter: the <b>time to first token</b> (how long until anything can be shown) and the <b>total time</b> (until the last token). Streaming shortens the wait the person feels to the first one. It does not make the total shorter, and it does not make the model cheaper.`, true) : kit.feedback(NO[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Read the wire by hand: what the browser really received. */
  function readWire(ctx) {
    style();
    chain(ctx, () => `<h1>What travels over the wire</h1>
      <p class="lead">Route 2 answers with an ordinary HTTP response that stays open. The body arrives in network pieces called <b>chunks</b>. Below are its first three chunks, exactly as the browser received them. Each holds one <b>event</b>: a small text message from the server, here one per token.</p>
      <p class="lead">↵ marks a line break. A dashed line marks where one chunk ended and the next began.</p>
      ${wireBox(STREAM.first)}
      <p class="task">Answer the three questions about this text.</p>`, [
      { q: "Where does one event end?", opts: ["At every line break", "At an empty line: two line breaks in a row", "At the end of each network chunk"], right: 1,
        yes: "Right. An event is a few lines such as <code>event: token</code> and <code>data: …</code>, and an empty line ends it. The client collects lines until it sees that empty line.",
        no: ["A line break ends one line, such as <code>event: token</code>. One event has two lines here; it ends only at the empty line after them.", null,
          `Here each chunk happened to carry one event, but nothing promises that. Later in this lesson one chunk carries all ${BUF_EVENTS} events at once. The text itself marks where an event ends: an empty line.`] },
      { pre: () => `<p class="lead">Token ${NL + 1} of the answer is a line break, between step 1 and step 2. Its event arrived like this:</p>${wireBox([STREAM.nlEvent])}`,
        q: "Why does the server send each token as JSON, in quotes, instead of as the bare text?", opts: ["A bare line break inside the text would end the line, and two would end the event, cutting the answer", "JSON is shorter than plain text", "The format accepts nothing but JSON"], right: 0,
        yes: "Right. Inside quotes, a line break is written as the two characters \\n, so the data line stays one line. The browser turns it back into a line break with <code>JSON.parse</code>. The format has another way: split the text over several <code>data:</code> lines, which the client joins with line breaks. JSON is simpler: one token, one line, one <code>JSON.parse</code>.",
        no: [null, "It is longer: the quotes and the escapes add bytes. It is chosen for safety, not size.",
          `The format carries any text. The end marker on this stream is plain text: <code>${esc(STREAM.doneEvent.split("\n")[1])}</code>, with no quotes.`] },
      { pre: () => `<p class="lead">After the last token, the server sent one more event:</p>${wireBox([STREAM.doneEvent])}`,
        q: "What is this last event for?", opts: ["It keeps the connection alive between tokens", "It tells the client the answer is complete", "It asks the browser to close the page"], right: 1,
        yes: "Right. A connection can also end because something broke, and from the browser the two can look alike. An explicit end marker is the only proof that the answer is whole. This format is called <b>server-sent events</b> (SSE), and its content type is <code>text/event-stream</code>.",
        no: ["Keeping a quiet connection alive is done with comment lines, which start with a colon and are ignored by the client. This event carries a type, done, that the client acts on.", null,
          "It closes nothing. Only the client's code reads it, and that code decides what “done” means: stop the spinner, mark the answer complete."] }
    ]);
  }

  /* 4. The FastAPI side (library): which line waits, which line streams, which header FastAPI added. */
  const ROUTES = [
    "@app.post(\"/answer\")",
    "async def answer(question: Question) -> dict:",
    "    text = \"\".join([token async for token in model_tokens(question.text, \"/answer\")])",
    "    return {\"answer\": text}",
    "",
    "@app.post(\"/answer/stream\", response_class=EventSourceResponse)",
    "async def answer_stream(question: Question) -> AsyncIterable[ServerSentEvent]:",
    "    async for token in model_tokens(question.text, \"/answer/stream\"):",
    "        yield ServerSentEvent(data=token, event=\"token\")",
    "    yield ServerSentEvent(raw_data=\"[DONE]\", event=\"done\")"
  ];
  const at = s => ROUTES.findIndex(l => l.includes(s));
  const L_JOIN = at("\"\".join"), L_YIELD = at("data=token");
  function fastapiRoute({ el, done, kit }) {
    style();
    let t = 0, picked = null, hdr = null, note = null;
    const TARGET = [L_JOIN, L_YIELD];
    const lineNo = j => [
      j === L_YIELD ? "That line is route 2: it sends a token as soon as it has one. Find the line in route 1 that gathers them all first." :
      j === at("return") ? "This returns the text, but it can only run after the line above has gathered every token. The wait happens one line earlier." :
      j < L_JOIN ? "This line only names the route and its input. The waiting happens inside the function." :
      "That is route 2. Find the line in route 1 (the top function) that gathers every token before anything is sent.",
      j === L_JOIN ? "That is route 1's waiting line. Now find the one in route 2 that sends a single token." :
      j === at("[DONE]") ? "This sends the end marker, once, after the loop. Find the line that runs for every token." :
      j === at("async for") ? "This line receives each token from the model. The line inside the loop is the one that sends it on." :
      "Look inside route 2's loop: the line that runs once per token and hands it to FastAPI."
    ][t];
    const HDR = ["content-type", "cache-control", "x-accel-buffering"];
    const HDR_NO = ["It tells the client the body is an event stream (it is also why a browser's EventSource accepts it). It says nothing to proxies about holding data back.",
      "It tells caches not to reuse a stored copy without checking with the server first. Holding data back while it streams is a different thing, called buffering."];
    const paint = () => {
      const fin = t === 2;
      el.innerHTML = `<h1>The route in FastAPI</h1>
        <p class="lead">Both routes are in <code>helper_app.py</code>. <code>model_tokens</code> is our helper: it reads the model server's own stream and yields each token as it arrives. In route 2, FastAPI's <code>EventSourceResponse</code> (FastAPI 0.135.0 and later) turns every <code>ServerSentEvent</code> you yield into one event on the wire. FastAPI JSON-encodes what you pass as <code>data</code>, and sends <code>raw_data</code> as it is.</p>
        <p class="task">${t === 0 ? "Tap the line that makes the agent wait for the whole answer." : t === 1 ? "Now tap the line that sends one token to the browser." : "Both found. Now the headers."}</p>
        ${pickLines(ROUTES, picked, fin)}
        <div class="lpanel">${note ? kit.feedback(note[0], note[1]) : ""}
        ${fin ? `<p class="lead">You wrote no header code. The recorded response of route 2 came with these headers:</p>
          <div class="${P}hdr">${STREAM.headers.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join("")}</div>
          <div class="lcase" id="hdr"><p>In production a <b>proxy</b> often sits in front of the app: a server that passes requests and responses between the app and the browser. Which header asks it not to hold the response back?</p>${kit.options(HDR.map(h => `<code>${h}</code>`), { picked: hdr, correct: 2 })}
          ${hdr == null ? "" : hdr === 2 ? kit.feedback("Right. Nginx reads <code>X-Accel-Buffering: no</code> and passes this response through as it comes. FastAPI's event-stream response also sends <code>Cache-Control: no-cache</code>, and a comment line as a keep-alive ping when nothing else has been sent for 15 seconds, so that some proxies do not close a quiet connection.", true) : kit.feedback(HDR_NO[hdr], false)}</div>` : ""}</div>`;
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => {
        const j = +b.dataset.i;
        if (j === TARGET[t]) {
          note = [t === 0 ? `Right. This list comprehension runs until <code>model_tokens</code> has yielded all ${N} tokens. Only then does <code>return</code> send anything.` : "Right. <code>yield</code> hands one event to FastAPI, which writes it to the open response at once. Then the loop waits for the next token.", true];
          picked = [j, true]; t++;
          if (t < 2) picked = null;
        } else { note = [lineNo(j), false]; picked = [j, false]; }
        paint();
      });
      el.querySelectorAll("#hdr .lopts button").forEach(b => b.onclick = () => { hdr = +b.dataset.i; paint(); if (hdr === 2) done(); });
    };
    paint();
  }

  /* 5. Broken on purpose: a proxy held the whole stream (the by-hand diagnosis). */
  const SHOW_ROWS = [0, 1, 2, null, BUF_TOKENS - 3, BUF_TOKENS - 2, BUF_TOKENS - 1];
  function brokenProxy({ el, done, kit }) {
    style();
    let row = null, cause = null, fix = null;
    const rowSay = i => i === WORST ? null :
      `Event ${i + 1} waited ${WAIT[i]} ms. ${i > WORST ? `Look earlier: event ${WORST + 1} was ready at ${sec(BUF.sent[WORST])} and still arrived at ${sec(BUF.at[WORST])}.` : ""}`;
    const CAUSE = ["The model: it wrote slowly", `The proxy: it held the response and let it out in one chunk at the end (${BUF.chunks[0][1]} bytes once decompressed)`, "The browser's parser: it waits for the done event before it shows anything"];
    const CAUSE_NO = [`The server log says otherwise: the first token left the app at ${sec(BUF.sent[0])}, and the model finished at ${sec(BUF.finished)}, the usual pace.`, null,
      `The parser can only show what has arrived. The network log shows the bytes themselves came in a single chunk at ${sec(BUF.chunks[0][0])}; before that, the browser had nothing to parse.`];
    const FIX = ["Send <code>X-Accel-Buffering: no</code> with the stream (FastAPI's EventSourceResponse already does), or set <code>proxy_buffering off</code> for this location",
      "In the browser, read the body with <code>await res.text()</code>",
      "Use a smaller, faster model"];
    const FIX_NO = [null, "That waits for the whole body by design, so the agent would always wait for the last token, even with no proxy at all.",
      `The tokens already left the app on time, from ${sec(BUF.sent[0])}. A faster model would just be held in the proxy until its last token too.`];
    const paint = () => {
      const found = row === WORST, causeOk = cause === 1, fixed = fix === 0;
      el.innerHTML = `<h1>Broken on purpose: fast on the laptop, blank in production</h1>
        <p class="lead">The helper now runs behind <b>nginx</b>, the proxy from the last screen. The team's first version wrote the events by hand into a plain <code>StreamingResponse</code>, so the <code>X-Accel-Buffering: no</code> header was not sent. And someone turned on compression (<code>gzip</code>) for text responses, event stream included:</p>
        ${showLines(NGINX)}
        <p class="lead">Agents see a blank box again. We ran it. Each row is one token event: when the app sent it (server log) and when the browser got it (client log), in milliseconds.</p>
        <div class="${P}rows" role="group" aria-label="events"><div class="${P}row head"><span>event</span><span>sent by app</span><span>reached browser</span></div>
        ${SHOW_ROWS.map(i => i == null ? `<div class="${P}row gap"><span>…</span><span></span><span></span></div>` : `<button type="button" class="${P}row ${row === i ? (found ? "on" : "no") : ""}" data-i="${i}" ${found ? "disabled" : ""}><span>${i + 1}</span><span>${BUF.sent[i]} ms</span><span>${BUF.at[i]} ms</span></button>`).join("")}</div>
        <p class="${P}cap">Real logs of proxied-hand, ${RUN_DATE}; events 4 to ${BUF_TOKENS - 3} cut where … stands. The two logs start their clocks a few milliseconds apart.</p>
        <p class="task">${!found ? "Tap the event that shows the problem most clearly: the one that waited longest between leaving the app and reaching the browser." : "Answer the two questions below: what held it, then the fix."}</p>
        <div class="lpanel">${row != null && !found ? kit.feedback(rowSay(row), false) : ""}
        ${found ? kit.feedback(`Right. Event 1 left the app at ${sec(BUF.sent[0])} and reached the browser at ${sec(BUF.at[0])}: it waited ${WAIT[0]} ms. All ${BUF_EVENTS} events arrived within ${BUF.at[BUF_EVENTS - 1] - BUF.at[0]} ms of each other, in one network chunk.`, true) : ""}
        ${found ? `<div class="lcase" id="cause"><p>What held it?</p>${kit.options(CAUSE.map(esc), { picked: cause, correct: 1 })}${cause == null ? "" : causeOk ? kit.feedback(`Right. Through the same proxy with <code>gzip off</code> for this route, the same events arrived one by one, the first at ${sec(FIXES.nogzip.first)}. Compression of the event stream, together with nginx's default buffering, held the whole answer. The response even came with <code>content-encoding: ${BUF.encoding}</code>.`, true) : kit.feedback(CAUSE_NO[cause], false)}</div>` : ""}
        ${causeOk ? `<div class="lcase" id="fix"><p>Pick the fix.</p>${kit.options(FIX, { picked: fix, correct: 0 })}${fix == null ? "" : fixed ? kit.feedback(`Right, and both were run against the same proxy, compression still on. Route 2 (EventSourceResponse) arrived in ${FIXES.sse.chunks} chunks, the first at ${sec(FIXES.sse.first)}. The hand-written route with <code>proxy_buffering off</code>: ${FIXES.nobuf.chunks} chunks, the first at ${sec(FIXES.nobuf.first)}. The lesson for production: every hop between the app and the browser (proxy, load balancer, CDN) must pass the stream through. Check it by logging arrival times, as here.`, true) : kit.feedback(FIX_NO[fix], false)}</div>` : ""}</div>`;
      el.querySelectorAll(`.${P}rows button`).forEach(b => b.onclick = () => { row = +b.dataset.i; if (row !== WORST) { cause = null; fix = null; } paint(); });
      el.querySelectorAll("#cause .lopts button").forEach(b => b.onclick = () => { cause = +b.dataset.i; if (cause !== 1) fix = null; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 6. The browser side (library): the fetch reader, with predictions from the recorded chunks. */
  const PARSER = [
    "const reader = res.body.getReader();",
    "const decoder = new TextDecoder();",
    "let buffer = \"\", answer = \"\", finished = false;",
    "while (true) {",
    "  const { value, done } = await reader.read();",
    "  if (done) break;",
    "  buffer += decoder.decode(value, { stream: true });",
    "  const events = buffer.split(\"\\n\\n\");",
    "  buffer = events.pop();   // the last piece may be half an event",
    "  for (const ev of events) {",
    "    const type = ev.match(/^event: (.*)$/m)?.[1];",
    "    const data = ev.match(/^data: (.*)$/m)?.[1];",
    "    if (type === \"token\") answer += JSON.parse(data);",
    "    if (type === \"done\") finished = true;",
    "  }",
    "}"
  ];
  function browserParser(ctx) {
    style();
    const one = STREAM.first[0];
    const o1 = [1, BUF_TOKENS, BUF_EVENTS];
    chain(ctx, () => `<h1>Reading the stream in the browser</h1>
      <p class="lead">The browser has a built-in <code>EventSource</code>, but it only sends GET requests with no body, and the helper's question travels in a POST body. So the page uses <code>fetch</code> and reads the body chunk by chunk. This is the reader from <code>client.mjs</code>, shortened: no logging, no <code>try</code>/<code>catch</code>, and two decode lines joined into one. It ran in Node, whose <code>fetch</code>, reader and <code>TextDecoder</code> are the same web APIs a browser has.</p>
      ${showLines(PARSER)}
      <p class="task">Read the code, then predict what it does with each chunk.</p>`, [
      { pre: () => `<p class="lead">The first chunk arrives:</p>${wireBox([one])}`,
        q: "After the <code>split</code> and the <code>pop</code>, what is left in <code>buffer</code>?", opts: ["Nothing: an empty string", "The whole event", "Only the line <code>data: \"1\"</code>"], right: 0,
        yes: "Right. The text ends with an empty line, so <code>split</code> gives two pieces: the event and an empty string after it. <code>pop</code> keeps that empty string as the new buffer, and the event goes to the loop.",
        no: [null, "The event is complete (it ends with an empty line), so it goes to the loop and is parsed. Only what comes after the last empty line stays behind.",
          "<code>split</code> cuts at empty lines, not at single line breaks, so the event's two lines stay together in one piece, and that piece is parsed."] },
      { q: `Behind the nginx proxy two screens back, one chunk (${BUF.chunks[0][1]} bytes once decompressed) held all ${BUF_EVENTS} events. How many times does <code>answer +=</code> run for that one chunk?`, opts: o1.map(String), right: 1,
        yes: `Right: ${BUF_TOKENS}, one per token event. The loop handles every complete event in the chunk; the done event sets <code>finished</code> and adds no text. So the agent got the whole answer in one go: correct, but late.`,
        no: ["The loop runs over every complete event in the chunk, not once per chunk. That is why the parser splits on empty lines instead of trusting chunk boundaries.", null,
          `${BUF_EVENTS} counts the done event too. That one sets <code>finished</code>; it adds no text.`] },
      { q: "If a chunk ended in the middle of an event, say right after <code>data: \" card</code>, what would happen to that piece?", opts: ["It waits in <code>buffer</code> until the next chunk brings the rest", "<code>JSON.parse</code> fails on it", "It is shown, then corrected when the rest arrives"], right: 0,
        yes: "Right. It has no empty line after it yet, so it is the last piece of the split and <code>pop</code> keeps it. The next chunk is added to it, and the event is parsed when it is whole. <code>{ stream: true }</code> does the same for a character whose bytes are split across two chunks: the decoder keeps the first bytes until the rest arrive.",
        no: [null, "<code>JSON.parse</code> only sees pieces that came before an empty line. A half event has none yet, so it never reaches the loop.",
          "Nothing half-made is shown: the half event never reaches the loop. It waits in <code>buffer</code> until it is complete."] }
    ]);
  }

  /* 7. Broken on purpose: the connection drops mid-answer. */
  function dropped(ctx) {
    style();
    const LOG = [
      `head ${DROP.head} ms status=${DROP.status} content-type=text/event-stream; charset=utf-8 …`,
      `event ${DROP.at[0]} ms type=token data=${JSON.stringify(TOKENS[0])}`,
      `event ${DROP.at[1]} ms type=token data=${JSON.stringify(TOKENS[1])}`,
      "…",
      `event ${DROP.at[DROP.tokens - 1]} ms type=token data=${JSON.stringify(TOKENS[DROP.tokens - 1])}`,
      `killed server pid … at ${DROP.killedAt} ms`,
      `error ${DROP.errorAt} ms ${DROP.error}`,
      `end ${DROP.errorAt} ms finished=false tokens=${DROP.tokens} …`
    ];
    chain(ctx, () => `<h1>Broken on purpose: the answer stops at step 3</h1>
      <p class="lead">During a deploy, the helper's server is restarted while answers are streaming. We reproduced it: the test client stopped the server process the moment it had the ${DROP.tokens}th token. Its log (trimmed where … stands):</p>
      <pre class="${P}wire">${LOG.map(esc).join("\n")}</pre>
      <p class="lead">The agent's box at that moment:</p>
      <div class="${P}box">${esc(DROP.answer)}</div><p class="${P}cap">${CAPTION}</p>
      <p class="task">Answer both questions.</p>`, [
      { q: "How can the code tell this answer is incomplete?", opts: ["The status code is an error", "The text ends in the middle of a sentence", "No done event came, and the read failed: <code>finished</code> is still false"], right: 2,
        yes: "Right. The done event is the only proof of a whole answer. A failed read throws an error, so the page wraps the reading loop in <code>try</code>/<code>catch</code>. Then it checks <code>finished</code>. A failed read leaves it false, and so does a stream that ends without a done event.",
        no: [`The status was ${DROP.status}. It went out at ${DROP.head} ms, before the first token, and a status cannot change once the body has started. Errors after that point must travel as events, or as a missing done event.`,
          "It ends with “3.”, which could pass for the start of a list that just stopped. Text alone cannot tell you whether an answer is whole; a step can end anywhere."] },
      { q: "What should the agent's box show?", opts: ["The text as a normal answer", "The text so far, marked as cut off, with a button to ask again", "Nothing but an error message"], right: 1,
        yes: `Right. The two steps that arrived are correct and the agent can use them, but the agent must see that something is missing. The full answer's step 3 was: “${esc(STEP3.slice(3))}”. Asking again is a new model call; when and how often to retry is the next lesson.`,
        no: [`Then the agent reads two steps and stops. The missing step 3 was: “${esc(STEP3.slice(3))}”. The card would stay open.`, null,
          "Two correct steps would be thrown away while the customer waits. Keep them, and say clearly that the answer is incomplete."] }
    ]);
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  const PICK = ["Stream it", "Return the whole answer", "Run it as a background job"];
  const BIG = [
    ["A support chat where a person reads a long answer while it is written.", 0,
      "Right. A person reads from the first word, so the time to first token is the wait they feel.",
      [null, "A person is waiting and reading. Returning the whole answer makes them wait for the last token, like route 1.", "Someone is waiting on the screen right now; a job that finishes later does not help them."]],
    ["A route that sorts each complaint into one of five categories and returns JSON that code saves to a database.", 1,
      "Right. No person reads it, and the code needs the whole JSON before it can check and save it. Streaming would add an open connection and parsing work for nothing.",
      ["Nobody reads the partial output. Half a JSON object is useless to the code that saves it, so there is nothing to gain from getting it early.", null, "One short call per complaint, answered in a moment. A job queue would add a worker and a status check for no gain."]],
    ["Summarise the day's 3,000 call recordings for a morning report.", 2,
      "Right. Nobody waits on a screen, and the work is long. A background job runs it and stores the result; the next lessons cover jobs and retries.",
      ["Nobody watches these summaries appear. Thousands of open streams would hold connections for nothing.", "Nobody waits for the reply, and one request holding a connection for the whole batch would time out somewhere on the way."]]
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to stream</h1>
        <p class="lead"><b>What for:</b> a person who reads model output while it is written.</p>
        <p class="lead"><b>When:</b> chats, assistants, long answers, anything where the first words are useful alone.</p>
        <p class="lead"><b>When not:</b> output that code uses only when whole (JSON, a label); work nobody watches (a background job); a short answer, where first token and last token are close. If the browser must also send messages during the stream, a WebSocket (a two-way connection) is the usual tool.</p>
        <p class="lead"><b>Costs:</b> a connection held open for the whole answer; every proxy and load balancer on the way must pass it through; errors after the first byte cannot change the status code; text is shown before you can check the whole answer.</p>
        <p class="task">For each job, pick what fits best.</p>
        ${BIG.map(([q, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(PICK, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : no[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations, with one honest "no". */
  const CASES = [
    ["A code assistant in an editor explains a failing test in several paragraphs, which the developer reads as they appear.", true,
      "Yes. A person reads from the first sentence. Streaming turns a long blank wait into reading time.",
      "The developer reads the explanation from the top. Waiting for the last paragraph before showing the first only adds waiting."],
    ["An insurance form calls a model to fill five fields (name, date, policy number, claim type, amount) as one JSON object, checks it against a schema, then fills the form.", false,
      "No. The code can check the object only when it is whole, and nobody reads the half-made JSON. The person waits for the filled form either way, so streaming adds an open connection and a parser for no shorter wait.",
      "Ask who uses the first tokens. Here nobody does: the schema check needs the whole object, and only then is the form filled. The wait the person feels is the total time, which streaming does not shorten."],
    ["A phone line's voice bot reads the model's answer aloud to the caller.", true,
      "Yes. Speech can start once the first sentence exists, instead of after the whole answer: the caller hears silence for the time to first sentence, not the total.",
      "The caller is waiting in silence. If the bot speaks each sentence as soon as it is written, the silence shrinks to the time to the first sentence."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Stream it, or not?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the bank.</p>
        <p class="task">For each one, decide whether streaming the model's tokens helps. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook, with a checklist from our own run, then the next lesson. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s6-streaming-responses.ipynb";
  // our run of the notebook (2026-11-14): step 7, first token event and done event reach the parser (ms)
  const NB = { first: 208, done: 2254 };
  const CHECKS = [
    "Calling <code>/answer</code> prints nothing until the model has finished; then one JSON body arrives (step 5)",
    "The response of <code>/answer/stream</code> has <code>content-type: text/event-stream</code>, <code>cache-control: no-cache</code> and <code>x-accel-buffering: no</code>, though you set none of them (step 6)",
    `The first token event is printed long before the done event; in our run of the notebook ${sec(NB.first)} against ${sec(NB.done)} (step 7)`,
    "A line-break token arrives as <code>data: \"\\n\"</code>, and the answer printed in step 7 has its line breaks back (step 9)",
    `Stopping the server mid-answer makes the read fail, and <code>finished</code> stays false (step 10)`
  ];
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can stream an answer, and tell when it broke</h1>
      <p>Streaming moves the wait from the last token to the first. The server sends server-sent events; the browser reads them with <code>fetch</code>, splits at empty lines, and trusts only the done event. Every hop must pass the stream through, and a cut-off answer must look cut off.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a>.` : "The notebook for this lesson is on its way."} In it you run both routes with FastAPI, replaying the small model's recorded tokens at their recorded times, read the stream with your own parser, and stop the server mid-answer. Tick what you see while you run it:</p>
      <ul class="${P}checks">${CHECKS.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. A model call can also fail before the first token. That lesson decides which failures to retry, and how long to wait between tries.</p>` : ""}`;
    done();
  }

  /* ---------- walks ---------- */
  LessonKit.define("s6-streaming-responses", {
    title: "Streaming tokens to the browser",
    checked: "2026-11-13",
    sources: [
      "https://fastapi.tiangolo.com/tutorial/server-sent-events/",
      "https://html.spec.whatwg.org/multipage/server-sent-events.html",
      "https://www.rfc-editor.org/rfc/rfc9111.html",
      "https://nginx.org/en/docs/http/ngx_http_proxy_module.html",
      "https://nginx.org/en/docs/http/ngx_http_gzip_module.html",
      "https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams",
      "https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode",
      "https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API",
      "https://docs.ollama.com/api/chat"
    ],
    interview: [{
      q: "Your chat feature streams answers fine on your laptop, but in production users see nothing and then the whole answer at once. How do you find the cause?",
      good: ["Log when each event leaves the app and when it reaches the client; if the app sends on time and the client gets one late chunk, something in between buffers",
        "Walk the hops: reverse proxy, load balancer, CDN, compression; call each hop directly and compare",
        "Check the response headers: content type text/event-stream, and a no-buffering signal such as X-Accel-Buffering: no for nginx",
        "Fix it per route in the proxy config (buffering off, no compression for the stream), then confirm with the same timing log"],
      weak: "“Switch to WebSockets” or “use a faster model.” Neither looks at where the bytes are held, and the same proxy can hold the new setup too."
    }, {
      q: "A streamed answer can fail halfway. How do you design the server and the client so the user never mistakes a partial answer for a complete one?",
      good: ["The status code is sent before the first token, so it cannot report a later failure; send an error event, or rely on a missing done event",
        "End every answer with an explicit done event, and treat a stream that ends without it as cut off",
        "Keep the partial text but mark it clearly, and offer to ask again",
        "Log the cut-offs so you can see how often they happen and on which hop"],
      weak: "“Check the HTTP status and show an error if it is not 200.” A mid-stream failure arrives after a 200."
    }],
    screens: [situation, spotIdea, readWire, fastapiRoute, brokenProxy, browserParser, dropped, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: [`.${P}lines [data-i="${at("return")}"]`], right: [`.${P}lines [data-i="${L_JOIN}"]`, `.${P}lines [data-i="${L_YIELD}"]`, "#hdr [data-right]"] },
      { wrong: [`.${P}rows [data-i="${BUF_TOKENS - 1}"]`], right: [`.${P}rows [data-i="${WORST}"]`, "#cause [data-right]", "#fix [data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
