/* Lesson: MCP servers, sharing tools across apps. Story: a theatre whose seat inventory should be reachable from the
   box-office chat assistant, a staff coding tool and a lobby kiosk without writing the glue three times.
   Ideas: (1) an MCP server describes its own tools and resources, and any client that speaks the protocol discovers them
   at run time (tools/list, resources/list) and uses them (tools/call, resources/read); (2) a host turns that list into
   the model's tool list and forwards the model's requests to the server.
   Depth: explain (screens 1-5, 9-11, interview), library (screens 6-7: the MCP Python SDK server and a host, real runs),
   debug (screen 3: a hard-coded argument name; screen 8: a tool error whose reason never left the server),
   when-not (screens 9-10).
   Runs (docs/ai-path/runs/s5a-mcp-servers/, MCP Python SDK 2.3.0 on this Mac): kiosk.py -> kiosk.wire.txt, kiosk.out.txt;
   predict.py -> predict.wire.txt, predict.out.txt; host.py -> host-*.out.txt, host-*.wire.txt. wiretap.py copied every
   line between client and server into the *.wire.txt logs, unchanged. Screen 2 shows every JSON-RPC message of kiosk.wire.txt
   (the server's log line left out).
   Recordings (main checkout, docs/ai-path/recordings/s5a-mcp-servers/): hold-1, hold-2-crash, hold-2-fixed. One small
   hosted model, temperature 0. Every number on screen is computed here from these constants. Plain browser script. */
(() => {
  const P = "lx-s5a-mcp-servers-";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  /* ---------- The theatre (copied from seats_server.py) ---------- */
  const SEATS = { F: { F6: "sold", F7: "free", F8: "free", F9: "held" }, G: { G6: "free", G7: "free", G8: "sold", G9: "free" } };
  const APPS = ["box-office chat assistant", "staff coding tool", "lobby kiosk"];
  const SYSTEMS = ["seat inventory", "ticket price list"];

  /* ---------- The kiosk's session, from kiosk.wire.txt (every message between client and server, not altered; the server's log line left out) ---------- */
  const WIRE = [
    "-> {\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"server/discover\",\"params\":{\"_meta\":{\"io.modelcontextprotocol/protocolVersion\":\"2026-07-28\",\"io.modelcontextprotocol/clientInfo\":{\"name\":\"mcp\",\"version\":\"0.1.0\"},\"io.modelcontextprotocol/clientCapabilities\":{}}}}",
    "<- {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"cacheScope\":\"private\",\"capabilities\":{\"prompts\":{\"listChanged\":true},\"resources\":{\"listChanged\":true,\"subscribe\":true},\"tools\":{\"listChanged\":true}},\"resultType\":\"complete\",\"supportedVersions\":[\"2026-07-28\"],\"ttlMs\":0,\"_meta\":{\"io.modelcontextprotocol/serverInfo\":{\"name\":\"theatre-seats\",\"version\":\"\"}}}}",
    "-> {\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\",\"params\":{\"_meta\":{\"io.modelcontextprotocol/protocolVersion\":\"2026-07-28\",\"io.modelcontextprotocol/clientInfo\":{\"name\":\"mcp\",\"version\":\"0.1.0\"},\"io.modelcontextprotocol/clientCapabilities\":{}}}}",
    "<- {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"cacheScope\":\"private\",\"resultType\":\"complete\",\"tools\":[{\"description\":\"List the free seats in one row of one performance.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"performance_id\":{\"title\":\"Performance Id\",\"type\":\"string\"},\"row\":{\"title\":\"Row\",\"type\":\"string\"}},\"required\":[\"performance_id\",\"row\"],\"title\":\"find_free_seatsArguments\"},\"name\":\"find_free_seats\",\"outputSchema\":{\"properties\":{\"result\":{\"items\":{\"type\":\"string\"},\"title\":\"Result\",\"type\":\"array\"}},\"required\":[\"result\"],\"title\":\"find_free_seatsOutput\",\"type\":\"object\"}},{\"description\":\"Hold seats for 10 minutes while the customer pays.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"performance_id\":{\"title\":\"Performance Id\",\"type\":\"string\"},\"seats\":{\"items\":{\"type\":\"string\"},\"title\":\"Seats\",\"type\":\"array\"}},\"required\":[\"performance_id\",\"seats\"],\"title\":\"hold_seatsArguments\"},\"name\":\"hold_seats\"}],\"ttlMs\":0,\"_meta\":{\"io.modelcontextprotocol/serverInfo\":{\"name\":\"theatre-seats\",\"version\":\"\"}}}}",
    "-> {\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"resources/list\",\"params\":{\"_meta\":{\"io.modelcontextprotocol/protocolVersion\":\"2026-07-28\",\"io.modelcontextprotocol/clientInfo\":{\"name\":\"mcp\",\"version\":\"0.1.0\"},\"io.modelcontextprotocol/clientCapabilities\":{}}}}",
    "<- {\"jsonrpc\":\"2.0\",\"id\":3,\"result\":{\"cacheScope\":\"private\",\"resources\":[{\"description\":\"The performances on sale, with their ids.\",\"mimeType\":\"text/plain\",\"name\":\"performances\",\"uri\":\"seats://performances\"}],\"resultType\":\"complete\",\"ttlMs\":0,\"_meta\":{\"io.modelcontextprotocol/serverInfo\":{\"name\":\"theatre-seats\",\"version\":\"\"}}}}",
    "-> {\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"resources/read\",\"params\":{\"uri\":\"seats://performances\",\"_meta\":{\"io.modelcontextprotocol/protocolVersion\":\"2026-07-28\",\"io.modelcontextprotocol/clientInfo\":{\"name\":\"mcp\",\"version\":\"0.1.0\"},\"io.modelcontextprotocol/clientCapabilities\":{}}}}",
    "<- {\"jsonrpc\":\"2.0\",\"id\":4,\"result\":{\"cacheScope\":\"private\",\"contents\":[{\"mimeType\":\"text/plain\",\"text\":\"[{\\\"performance_id\\\": \\\"HAM-1128\\\", \\\"title\\\": \\\"Hamlet\\\", \\\"date\\\": \\\"2026-11-28\\\", \\\"starts\\\": \\\"19:30\\\"}]\",\"uri\":\"seats://performances\"}],\"resultType\":\"complete\",\"ttlMs\":0,\"_meta\":{\"io.modelcontextprotocol/serverInfo\":{\"name\":\"theatre-seats\",\"version\":\"\"}}}}",
    "-> {\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"find_free_seats\",\"arguments\":{\"performance_id\":\"HAM-1128\",\"row\":\"G\"},\"_meta\":{\"io.modelcontextprotocol/protocolVersion\":\"2026-07-28\",\"io.modelcontextprotocol/clientInfo\":{\"name\":\"mcp\",\"version\":\"0.1.0\"},\"io.modelcontextprotocol/clientCapabilities\":{}}}}",
    "<- {\"jsonrpc\":\"2.0\",\"id\":5,\"result\":{\"content\":[{\"text\":\"G6\",\"type\":\"text\"},{\"text\":\"G7\",\"type\":\"text\"},{\"text\":\"G9\",\"type\":\"text\"}],\"isError\":false,\"resultType\":\"complete\",\"structuredContent\":{\"result\":[\"G6\",\"G7\",\"G9\"]},\"_meta\":{\"io.modelcontextprotocol/serverInfo\":{\"name\":\"theatre-seats\",\"version\":\"\"}}}}",
    "-> {\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"tools/call\",\"params\":{\"name\":\"find_free_seats\",\"arguments\":{\"performance\":\"HAM-1128\",\"row\":\"F\"},\"_meta\":{\"io.modelcontextprotocol/protocolVersion\":\"2026-07-28\",\"io.modelcontextprotocol/clientInfo\":{\"name\":\"mcp\",\"version\":\"0.1.0\"},\"io.modelcontextprotocol/clientCapabilities\":{}}}}",
    "<- {\"jsonrpc\":\"2.0\",\"id\":6,\"result\":{\"content\":[{\"text\":\"Error executing tool find_free_seats: 1 validation error for find_free_seatsArguments\\nperformance_id\\n  Field required [type=missing, input_value={'performance': 'HAM-1128', 'row': 'F'}, input_type=dict]\\n    For further information visit https://errors.pydantic.dev/2.14/v/missing\",\"type\":\"text\"}],\"isError\":true,\"resultType\":\"complete\",\"_meta\":{\"io.modelcontextprotocol/serverInfo\":{\"name\":\"theatre-seats\",\"version\":\"\"}}}}"
  ];
  const MSGS = WIRE.map(l => ({ out: l.startsWith("->"), raw: l.slice(3), m: JSON.parse(l.slice(3)) }));
  // a _meta block rides on every message (requests: version and client; answers: server name); show it as {…}. String-aware brace matching, so text inside values is safe.
  const trimMeta = s => {
    const at = s.indexOf('"_meta":{');
    if (at < 0) return s;
    let i = at + 8, depth = 0, inStr = false;
    for (; i < s.length; i++) {
      const c = s[i];
      if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}") { depth--; if (!depth) break; }
    }
    return s.slice(0, at) + '"_meta":{…}' + trimMeta(s.slice(i + 1));
  };
  const DISCOVERY = ["server/discover", "tools/list", "resources/list"];
  const LABELS = ["discovery", "call", "result"];
  const labelOf = x => x.out ? (DISCOVERY.includes(x.m.method) ? 0 : 1) : 2;
  const TOOLS_REPLY = MSGS.find(x => !x.out && x.m.result && x.m.result.tools).m.result.tools;
  const FIND = TOOLS_REPLY.find(t => t.name === "find_free_seats");
  const short = x => {
    const id = x.m.id, r = x.m.result, p = x.m.params || {};
    if (x.out) return `→ #${id} ${x.m.method}${p.name ? ` ${p.name} ${JSON.stringify(p.arguments)}` : p.uri ? ` ${p.uri}` : ""}`;
    if (x.m.error) return `← #${id} error ${x.m.error.code}`;
    if (r.capabilities) return `← #${id} result: can do ${Object.keys(r.capabilities).join(", ")}`;
    if (r.tools) return `← #${id} result: ${r.tools.length} tools: ${r.tools.map(t => t.name).join(", ")}`;
    if (r.resources) return `← #${id} result: ${r.resources.length} resource: ${r.resources.map(t => t.uri).join(", ")}`;
    if (r.contents) return `← #${id} result: the text of ${r.contents[0].uri}`;
    return `← #${id} result: isError ${r.isError}${r.structuredContent ? `, ${JSON.stringify(r.structuredContent.result)}` : `, “${r.content[0].text.split(":")[0]}: …”`}`;
  };
  const FAIL = MSGS.findIndex(x => !x.out && x.m.result && x.m.result.isError);
  const FAIL_REQ = MSGS.findIndex(x => x.out && x.m.id === MSGS[FAIL].m.id);
  const OK_CALL = MSGS.findIndex(x => !x.out && x.m.result && x.m.result.isError === false);
  const BAD_ARG = Object.keys(MSGS[FAIL_REQ].m.params.arguments).find(k => !(k in FIND.inputSchema.properties));
  const FAIL_TEXT = MSGS[FAIL].m.result.content[0].text;

  /* ---------- predict.py, from predict.out.txt (a fresh server; calls in this order) ---------- */
  const PRED = {
    rowF: ["F7", "F8"],
    hold: { args: ["F8", "F9"], isError: true, text: "Error executing tool hold_seats" },
    rowF2: ["F7", "F8"],
    read: { uri: "seats://matinees", code: -32602, message: "Unknown resource: seats://matinees" }
  };

  /* ---------- Recorded model output (host.py sent these; trimmed fields marked …, nothing altered) ---------- */
  // From docs/ai-path/recordings/s5a-mcp-servers/hold-1.json
  const REC_1 = { src: "s5a-mcp-servers/hold-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    finish: "tool_calls", inTok: 230,
    call: { id: "tool_hold_seats_O0xpRpixGKktMP22p8x7", name: "hold_seats", arguments: "{\"seats\":[\"F8\",\"F9\"],\"performance_id\":\"HAM-1128\"}" } };
  // From docs/ai-path/recordings/s5a-mcp-servers/hold-2-crash.json (its last message carried CRASH_TEXT, the server's text)
  const REC_CRASH = { src: "s5a-mcp-servers/hold-2-crash", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "I am sorry, I cannot fulfill this request. The available tool `hold_seats` is not working correctly." };
  // From docs/ai-path/recordings/s5a-mcp-servers/hold-2-fixed.json (its last message carried FIXED_TEXT)
  const REC_FIXED = { src: "s5a-mcp-servers/hold-2-fixed", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "I am sorry, but it seems that seat F9 is no longer available. We can still hold seat F8 for you, would you like to proceed?" };
  const CRASH_TEXT = "Error executing tool hold_seats", FIXED_TEXT = "Error executing tool hold_seats: Not free: F9";
  const USER = "Hi, I'd like seats F8 and F9 for Hamlet on 28 November. Can you hold them for me?";
  const SYSTEM_START = "You are the box-office assistant of a small theatre. Use the tools to check and hold seats. Never promise a seat the tools did not confirm. Performances on sale: ";
  const RESOURCE_TEXT = MSGS.find(x => !x.out && x.m.result && x.m.result.contents).m.result.contents[0].text;
  // The server's stderr in the crash run, from host-seats_server.wire.txt (four whole lines of the 36 it wrote; the cuts are marked …)
  const CRASH_LOG = ["Tool 'hold_seats' raised an unexpected exception", "Traceback (most recent call last):", "…", "ValueError: Not free: F9", "…", "mcp.server.mcpserver.exceptions.UnexpectedToolError: Error executing tool hold_seats"];
  const CAPTION = `Recorded model output, ${REC_1.recordedAt}. Fields cut where … stands; nothing shown is altered.`;
  const ARGS_1 = JSON.parse(REC_1.call.arguments);

  /* ---------- Lesson-only styles ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}msg { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 8px; font: 500 13.5px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--font); color: var(--muted); }
      .${P}lab { margin: 16px 0 0; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
      .${P}rows { display: grid; gap: 6px; margin-top: 12px; }
      .${P}row { display: flex; gap: 10px; align-items: baseline; width: 100%; min-height: 44px; padding: 8px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 14px/1.4 var(--mono); text-align: left; overflow-wrap: anywhere; }
      button.${P}row { cursor: pointer; }
      .${P}row em { margin-left: auto; font: 700 12px var(--mono); font-style: normal; color: var(--ink-2); white-space: nowrap; }
      .${P}row.cur { border-color: var(--ink); border-width: 2.5px; }
      .${P}row.on { border-color: var(--good); background: var(--good-soft); color: var(--good); }
      .${P}row.no { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
      .${P}row:disabled { cursor: default; }
      .${P}grid { display: grid; grid-template-columns: auto repeat(${SYSTEMS.length}, 1fr); gap: 6px; margin-top: 12px; font-size: 14.5px; }
      .${P}grid span { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
      .${P}grid b { padding: 8px 4px; font-weight: 700; color: var(--ink-2); }
      .${P}seats { display: grid; gap: 6px; margin-top: 12px; }
      .${P}seats div { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .${P}seats b { width: 3.2em; font: 700 14px var(--mono); }
      .${P}seats span { padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 8px; font: 500 14px var(--mono); }
      .${P}seats span.free { border-color: var(--ink); color: var(--ink); }
      .${P}seats span.held, .${P}seats span.sold { color: var(--muted); border-style: dashed; }
      .${P}lines { margin: 14px 0 0; padding: 8px 0; background: var(--code-bg); border-radius: var(--r); overflow-x: auto; }
      .${P}lines button, .${P}lines div { display: block; width: 100%; min-height: 44px; padding: 0 14px; border: 0; border-left: 3px solid transparent; background: transparent; color: var(--code-ink); font: 500 14px/44px var(--mono); text-align: left; white-space: pre; }
      .${P}lines div { min-height: 0; line-height: 1.6; }
      .${P}lines button, .${P}lines div { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
      .${P}lines button { cursor: pointer; }
      .${P}lines button.on { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--code-bg)); }
      .${P}lines button.no { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--code-bg)); }
      .${P}log { margin: 12px 0 0; padding: 10px 12px; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); font: 500 13px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}checks { list-style: none; padding: 0; margin: 12px 0 16px; display: grid; gap: 8px; }
      .${P}checks label { display: flex; gap: 6px; align-items: center; min-height: 44px; padding: 4px 12px 4px 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); cursor: pointer; }
      .${P}checks input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 14px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -12px; }
      .${P}checks input:checked { background-color: var(--good); outline-color: var(--good); }
      .${P}checks input:focus-visible { outline-width: 3px; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
      @media (max-width: 420px) {
        .${P}lines button, .${P}lines div { font-size: 12.5px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; padding-top: 7px; padding-bottom: 7px; padding-left: calc(12px + var(--ind, 4ch)); text-indent: calc(-1 * var(--ind, 4ch)); }
        .${P}lines div { padding-top: 2px; padding-bottom: 2px; }
        .${P}grid { font-size: 13px; }
      }
    `;
    document.head.appendChild(s);
  }
  const ind = line => `--ind:${line.match(/^ */)[0].length + 4}ch`;
  const msgBox = (text, kit) => `<pre class="${P}msg">${kit.esc(text)}</pre>`;
  // a code listing whose lines are buttons (pick one); picked = [index, right?]
  const pickLines = (lines, picked, kit, lock) => `<div class="${P}lines" role="group" aria-label="code">${lines.map((c, j) => `<button type="button" data-i="${j}" style="${ind(c)}" class="${picked && picked[0] === j ? (picked[1] ? "on" : "no") : ""}" ${lock ? "disabled" : ""}>${kit.esc(c) || " "}</button>`).join("")}</div>`;
  const showLines = (lines, kit) => `<div class="${P}lines">${lines.map(c => `<div style="${ind(c)}">${kit.esc(c) || " "}</div>`).join("")}</div>`;
  const seatChips = () => `<div class="${P}seats">${Object.entries(SEATS).map(([r, seats]) => `<div><b>row ${r}</b>${Object.entries(seats).map(([s, st]) => `<span class="${st}">${s} ${st}</span>`).join("")}</div>`).join("")}</div>`;
  // several questions on one screen, each shown once the one before is right
  function chain({ el, done, kit }, head, Q, after) {
    const ans = Q.map(() => null);
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const shown = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = head() + Q.slice(0, shown).map((x, i) => `<div class="lcase" id="q${i}"><p>${x.q}</p>${kit.options(x.opts.map(kit.esc), { picked: ans[i], correct: x.right })}
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

  /* 1. The situation: three apps, two systems, glue for every pair. */
  const PAIRS = APPS.length * SYSTEMS.length;
  function situation(ctx) {
    style();
    const { kit } = ctx;
    const o1 = [APPS.length, APPS.length + SYSTEMS.length, PAIRS].sort((a, b) => a - b);
    const o2 = [1, SYSTEMS.length, APPS.length + 1].sort((a, b) => a - b);
    chain(ctx, () => `<h1>One seat inventory, three apps</h1>
      <p class="lead">A theatre keeps its seats in a <b>seat inventory</b> and its prices in a <b>ticket price list</b>. ${WORDS[APPS.length]} apps want both: the ${APPS.join(", the ").replace(/, the ([^,]*)$/, " and the $1")}. The chat assistant already uses function calling, as in the last lesson: its own Python functions, its own tool descriptions. The kiosk is written in another language by another team. The coding tool is a product the theatre bought. This lesson solves that problem: writing a system's tools once so that every AI app can use them.</p>
      <div class="${P}grid" aria-label="apps and systems"><b></b>${SYSTEMS.map(s => `<b>${kit.esc(s)}</b>`).join("")}${APPS.map(a => `<b>${kit.esc(a)}</b>${SYSTEMS.map(() => "<span>its own glue code</span>").join("")}`).join("")}</div>
      <p class="task">Each app reaches each system through its own glue code. Answer both questions.</p>`, [
      { q: "How many separate pieces of glue code does the theatre maintain?", opts: o1.map(String), right: o1.indexOf(PAIRS),
        yes: `Right: ${APPS.length} apps × ${SYSTEMS.length} systems = ${PAIRS}. The kiosk's code for the seats is no use to the chat assistant: other language, other tool format. Each pair is its own piece, and each breaks on its own when a system changes.`,
        no: Object.fromEntries([[o1.indexOf(APPS.length), `That counts the apps only. Each app needs glue for each system: the seats and the prices.`],
          [o1.indexOf(APPS.length + SYSTEMS.length), `That would be one piece per app plus one per system, as if pieces could be shared. Here they cannot: the kiosk's seat code does not fit the chat assistant. Count one piece per app–system pair.`]]) },
      { q: "A phone-line voice bot is added next month. How many new pieces of glue?", opts: o2.map(String), right: o2.indexOf(SYSTEMS.length),
        yes: `Right: ${SYSTEMS.length}, one per system, written again from scratch. And the coding tool shows the real limit: its makers will never write glue for one theatre's systems. As things stand, it cannot reach the seats at all.`,
        no: Object.fromEntries([[o2.indexOf(1), `One piece would be enough only if the bot could reuse glue someone already wrote. It cannot: it needs its own code for the seats and its own for the prices.`],
          [o2.indexOf(APPS.length + 1), `The other apps are not touched. The bot needs glue to each system: ${SYSTEMS.join(" and ")}.`]]) }
    ]);
  }

  /* 2. By hand: label every message of a real session between the kiosk and a seat server. */
  function labelLog({ el, done, kit }) {
    style();
    let k = 0, bad = null;
    const why = (x, pick) => {
      if (!x.out) return `This line starts with ←: the server sent it, as its answer to request #${x.m.id}. It has a "${x.m.error ? "error" : "result"}" field and no "method". Every answer from the server is a result.`;
      if (pick === 2) return `This line starts with →: the kiosk sent it, so it is a request, not a result. A result comes back from the server with the same id.`;
      if (pick === 1) return `<code>${kit.esc(x.m.method)}</code> asks what the server is or what it offers. It runs nothing and reads no seat data. That is discovery.`;
      return x.m.method === "resources/read" ? `This reads the contents of one resource, ${kit.esc(x.m.params.uri)}. Finding out which resources exist was resources/list, one request earlier. Reading one is a call.`
        : `This asks the server to run <code>${kit.esc(x.m.params.name)}</code> with arguments. Asking what tools exist is tools/list. Running one is a call.`;
    };
    const paint = () => {
      const fin = k === MSGS.length, x = MSGS[k];
      el.innerHTML = `<h1>Read the kiosk's session</h1>
        <p class="lead">The kiosk team switched to a shared <b>seat server</b>: a separate program. The kiosk starts it, writes requests to its input and reads answers from its output. Here is every message that passed between them in one real session, in order. → is the kiosk speaking, ← the server answering. Each message has an <code>id</code>, and an answer carries the id of its request. Every message also has a <code>"_meta"</code> block (protocol version, who is speaking). It is cut to {…} here.</p>
        <p class="task">${fin ? "All labelled." : "Label each message: <b>discovery</b> (asking what the server is or offers), <b>call</b> (asking it to run a tool or read data) or <b>result</b> (the server's answer)."}</p>
        <div class="${P}rows">${MSGS.slice(0, k).map(m => `<div class="${P}row">${kit.esc(short(m))}<em>${LABELS[labelOf(m)]}</em></div>`).join("")}</div>
        ${fin ? "" : `<p class="${P}lab">Message ${k + 1} of ${MSGS.length}</p>${msgBox(`${x.out ? "→" : "←"} ${trimMeta(x.raw)}`, kit)}
          <div class="lpanel">${kit.options(LABELS, { picked: bad, correct: labelOf(x) })}${bad == null ? "" : kit.feedback(why(x, bad), false)}</div>`}
        ${fin ? kit.feedback(`Done. ${MSGS.filter(m => labelOf(m) === 0).length} discovery requests, ${MSGS.filter(m => labelOf(m) === 1).length} calls, ${MSGS.filter(m => labelOf(m) === 2).length} results. The kiosk did not know the tool names before it asked: they came back in answer #${MSGS.find(m => !m.out && m.m.result.tools).m.id}, with a description and an <code>inputSchema</code> (the names and types of its arguments) for each. These messages are JSON-RPC: a request has a method and an id, an answer has the same id and a result or an error.`, true) : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== labelOf(MSGS[k])) { bad = v; paint(); return; }
        bad = null; k++; paint();
        if (k === MSGS.length) done();
      });
    };
    paint();
  }

  /* 3. Broken on purpose (from the same session): which call failed, and why? */
  function findFail({ el, done, kit }) {
    style();
    let row = null, why = null, fix = null;
    const WHY = [
      `The kiosk sent “${BAD_ARG}”, but the schema in answer #${MSGS.find(m => !m.out && m.m.result.tools).m.id} asks for “performance_id”`,
      "The seat server crashed and stopped answering",
      "HAM-1128 is not a performance the server knows"
    ];
    const WHY_NO = [null,
      `The server answered #${MSGS[FAIL].m.id} with a normal result, and it had answered every request before it. A crashed server answers nothing.`,
      `The same id worked one call earlier, in #${MSGS[OK_CALL].m.id}, and answer #${MSGS.find(m => !m.out && m.m.result.contents).m.id} lists it. The id is fine.`];
    const FIX = [
      "Build the call from the current inputSchema: send performance_id, and check the schema from tools/list when the kiosk starts",
      "Retry the call until it works",
      "Ask the server team to put the old name back and never rename anything"
    ];
    const FIX_NO = [null, "The same request gets the same answer every time: the name is still wrong.",
      "That freezes the server for every client because of one. Servers do change; the protocol gives clients the current schema so they can follow."];
    const rowSay = i => {
      const x = MSGS[i];
      if (i === FAIL_REQ) return `This is the request that went wrong, but it does not say it failed. Find the server's answer that reports the failure.`;
      if (x.out) return `A request carries no outcome. Look at the answers (←).`;
      if (x.m.result && x.m.result.isError === false) return `isError is false here: find_free_seats ran and returned the seats of row G.`;
      return `This answer is a normal result for a discovery or a read. Look for the answer that says isError is true.`;
    };
    const paint = () => {
      const found = row === FAIL, whyOk = why === 0;
      el.innerHTML = `<h1>Broken on purpose: one call failed</h1>
        <p class="lead">The kiosk's “show free seats” button stopped working last week. The session you just labelled is that button being pressed. The button's code was written months ago, against an older version of the server.</p>
        <p class="task">${!found ? "Tap the message that reports the failure." : !whyOk ? "Why did it fail?" : "Pick the fix."}</p>
        <div class="${P}rows">${MSGS.map((m, i) => `<button type="button" class="${P}row ${i === row ? (found ? "on" : "no") : ""}" data-i="${i}" ${found ? "disabled" : ""}>${kit.esc(short(m))}</button>`).join("")}</div>
        <div class="lpanel">${row == null ? "" : found ? kit.feedback("Right. Look at what came back in full:", true) + msgBox(`← ${trimMeta(MSGS[FAIL].raw)}`, kit)
          + kit.feedback(`The answer has a <code>"result"</code> field, not an <code>"error"</code> field. So the protocol worked: the server understood the request and answered. The arguments did not match the tool's schema, so the tool did not run; <code>isError</code> is true and the text says why. The request it answers:`) + msgBox(`→ ${trimMeta(MSGS[FAIL_REQ].raw)}`, kit)
          : kit.feedback(rowSay(row), false)}
        ${found ? `<div class="lcase" id="why">${kit.options(WHY.map(kit.esc), { picked: why, correct: 0 })}${why == null ? "" : whyOk ? kit.feedback(`Right. The server renamed <code>${kit.esc(BAD_ARG)}</code> to <code>performance_id</code>. The kiosk asked for the current schema in #${MSGS.find(m => !m.out && m.m.result.tools).m.id} and got it, then sent the name written into its code anyway. The error text says it plainly: <code>performance_id</code>, “Field required”.`, true) : kit.feedback(WHY_NO[why], false)}</div>` : ""}
        ${whyOk ? `<div class="lcase" id="fix">${kit.options(FIX.map(kit.esc), { picked: fix, correct: 0 })}${fix == null ? "" : fix === 0 ? kit.feedback("Right. A client can ask the server for its current tools at any time, so it can notice a change instead of breaking silently. A client that lets a model fill in the arguments from the schema follows such a rename with no code change. You will see one on screen 7.", true) : kit.feedback(FIX_NO[fix], false)}</div>` : ""}</div>`;
      el.querySelectorAll(`.${P}rows button`).forEach(b => b.onclick = () => { row = +b.dataset.i; if (row !== FAIL) { why = null; fix = null; } paint(); });
      el.querySelectorAll("#why .lopts button").forEach(b => b.onclick = () => { why = +b.dataset.i; if (why !== 0) fix = null; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: how can a bought product use the theatre's seats? */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Send the theatre's Python functions to the coding tool's makers and ask them to add them",
      "Agree on one way to ask “what can you do?” and “do this”: the theatre runs a server that answers both, and the coding tool asks it at start-up",
      "Paste the seat table into the coding tool's chat every morning"
    ];
    const BIG_A = 10, BIG_S = 5;
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>How can a bought tool reach the seats?</h1>
        <p class="lead">The coding tool is someone else's product. Its makers have never heard of this theatre. Yet staff want to ask it “which rows are still free on the 28th?” and get the live answer.</p>
        <p class="task">What would let the coding tool use the seat inventory without its makers writing anything for the theatre?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok ? kit.feedback(`Right. That agreement exists: the <b>Model Context Protocol</b>, MCP. An <b>MCP server</b> describes its tools (actions and look-ups it runs on request) and its read-only data (<b>resources</b>). The app that talks to the model is the <b>host</b>. Inside it, one <b>MCP client</b> per server talks to that server. The client usually asks the server what it offers before using it. The session you labelled was exactly that: discover, list, call. So the theatre writes one server per system, each app needs one client, and many products already have one built in. ${APPS.length} apps and ${SYSTEMS.length} systems: ${APPS.length + SYSTEMS.length} pieces instead of ${PAIRS}. At ${BIG_A} apps and ${BIG_S} systems: ${BIG_A + BIG_S} instead of ${BIG_A * BIG_S}.`, true)
          : ans === 0 ? kit.feedback("The makers ship one product to thousands of customers. They will not add one theatre's functions, and every theatre would need a different version of the product.", false)
          : kit.feedback("Pasted text is old by lunchtime, and the tool still cannot hold a seat. It needs a live way to ask and to act.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Use it, with predictions checked against a real run (predict.py). */
  function predict(ctx) {
    style();
    const { kit } = ctx;
    const freeIn = r => Object.entries(SEATS[r]).filter(([, st]) => st === "free").map(([s]) => s);
    const fmt = a => a.join(", ");
    const allF = Object.keys(SEATS.F), noHeld = Object.entries(SEATS.F).filter(([, st]) => st !== "sold").map(([s]) => s);
    const mine = freeIn("F");
    chain(ctx, () => `<h1>Predict what the server answers</h1>
      <p class="lead">A fresh seat server, with these seats for Hamlet (HAM-1128). Free seats are outlined; held and sold ones dashed. A client sends four requests, one after another.</p>
      ${seatChips()}
      <p class="task">Predict each answer. The next request appears when you get it right.</p>`, [
      { q: `<code>tools/call</code> find_free_seats with performance_id HAM-1128, row F. Which seats come back?`,
        opts: [fmt(mine), fmt(noHeld), fmt(allF)], right: 0,
        yes: `Right: the real run returned ${fmt(PRED.rowF)}. Your table lookup and the server agree.`,
        no: [null, `F9 is held: someone is paying for it right now. The function lists only seats whose state is free.`, `F6 is sold and F9 is held. Only free seats come back.`] },
      { q: `<code>tools/call</code> hold_seats with seats ${fmt(PRED.hold.args)}. <b>hold_seats checks every seat first and holds none if any is taken.</b> F9 is not free, so the function raises an exception before it holds anything. What comes back?`,
        opts: ["A JSON-RPC error instead of a result", "A normal result with isError: true", `A result saying ${PRED.hold.args[0]} was held and ${PRED.hold.args[1]} skipped`], right: 1,
        yes: `Right. The real answer had <code>isError: ${PRED.hold.isError}</code> and the text “${kit.esc(PRED.hold.text)}”. A failure inside a tool comes back as a result, so the model can read it and try something else. Look closely at that text: it does not say which seat, or why. Keep that in mind.`,
        no: [`A JSON-RPC error means the request itself was wrong: an unknown tool, a malformed message. Here the request was fine and the tool ran; the failure happened inside it. That comes back as a result with isError: true.`, null,
          "Read the question again: hold_seats checks every seat first and holds none if any is taken. F9 is taken, so nothing is held, and the result reports an error."] },
      { q: "Then find_free_seats for row F again. Which seats come back now?", opts: [fmt(PRED.rowF2), PRED.rowF2[0], "None"], right: 0,
        yes: `Right: ${fmt(PRED.rowF2)} again. The failed hold changed nothing: as the question before said, hold_seats checks every seat first and holds none if any is taken.`,
        no: [null, `That assumes ${PRED.hold.args[0]} was held before the error. Look at the question before: hold_seats checks every seat first and holds none if any is taken.`, "The server is still running: an error in one call does not stop it. Only the seats changed by a successful call would be gone."] },
      { q: `<code>resources/read</code> with the URI ${kit.esc(PRED.read.uri)}, which the server does not have. What comes back?`,
        opts: ["A JSON-RPC error", "A normal result with isError: true", "A result with empty contents"], right: 0,
        yes: `Right: the real answer was a JSON-RPC <code>"error"</code>, code ${PRED.read.code}, “${kit.esc(PRED.read.message)}”. Asking for something that does not exist is a wrong request, so it is a protocol error. Two kinds of failure, then: a wrong request gets a JSON-RPC error; a tool that ran and failed gets a result with isError.`,
        no: [null, "isError belongs to tool results. A resource read that names something that does not exist is a wrong request, answered with a JSON-RPC error.",
          "Empty contents would look like an empty resource, and the client could not tell it from “no such resource”. The specification forbids that answer."] }
    ]);
  }

  /* 6. The real library: which line of the server produced each part of what the kiosk saw? */
  const SERVER = [
    "from mcp.server import MCPServer",
    "mcp = MCPServer(\"theatre-seats\")",
    "@mcp.resource(\"seats://performances\")",
    "def performances() -> str:",
    "    \"\"\"The performances on sale, with their ids.\"\"\"",
    "    return json.dumps(PERFORMANCES)",
    "@mcp.tool()",
    "def find_free_seats(performance_id: str, row: str) -> list[str]:",
    "    \"\"\"List the free seats in one row of one performance.\"\"\"",
    "    return [s for s, state in SEATS[performance_id][row].items() if state == \"free\"]",
    "if __name__ == \"__main__\":",
    "    mcp.run()  # stdio by default"
  ];
  const at = t => SERVER.findIndex(l => l.includes(t));
  const TARGETS = [
    { show: `"description":"${FIND.description}"`, line: at(`"""${FIND.description}"""`),
      yes: "Right: the docstring becomes the tool's description. The model reads it to decide when to use the tool, so write it for the model." },
    { show: `"inputSchema":{… "properties":{"performance_id":{… "type":"string"},"row":{… "type":"string"}},"required":${JSON.stringify(FIND.inputSchema.required)} …}`, line: at("def find_free_seats"),
      yes: "Right: the parameter names and type hints (<code>: str</code>) become the JSON Schema. No schema is written by hand, and renaming a parameter here changes what every client receives. That is how the kiosk's old name broke." },
    { show: `"resources":[{"description":"The performances on sale, with their ids.", … "uri":"seats://performances"}]`, line: at("@mcp.resource"),
      yes: "Right: the decorator gives the resource its address (URI); the docstring under the function gives its description." }
  ];
  const lineNo = (j, t) => {
    const l = SERVER[j];
    if (l.startsWith("from") || l.startsWith("mcp =")) return "This line makes the server object. It names the server, but it describes no tool and no resource.";
    if (l.includes("__main__") || l.includes("mcp.run")) return "This starts the server, talking over its standard input and output (stdio). It adds nothing to the descriptions.";
    if (l.trim().startsWith("return")) return "A return line runs only when the tool or resource is used. Descriptions are sent before anything runs.";
    if (j === at('"""The performances')) return t === 2 ? "Close: this docstring became the resource's description. The URI seats://performances is given on another line." : "That docstring belongs to the resource above it, not to the tool.";
    return null;
  };
  function serverCode({ el, done, kit }) {
    style();
    let t = 0, picked = null;
    const paint = () => {
      const fin = t === TARGETS.length, cur = TARGETS[t];
      const say = picked == null || fin ? "" : picked[1] ? "" : (lineNo(picked[0], t) || (t === 0 ? "That line does not contain these words. Find the line the description text comes from."
        : t === 1 ? (SERVER[picked[0]].startsWith("@mcp.tool") ? "@mcp.tool() registers the function as a tool. The parameter names and their types are written on another line." : "Find the line where performance_id and row are named, with their types.")
        : (SERVER[picked[0]].startsWith("@mcp.tool") || SERVER[picked[0]].includes("find_free") ? "That line belongs to the tool. The URI seats://performances is given on another line." : "Find the line that contains the URI seats://performances.")));
      el.innerHTML = `<h1>The server, in Python</h1>
        <p class="lead">The seat server is written with the official <b>MCP Python SDK</b> (<code>pip install mcp</code>). This is the part behind the session you read (hold_seats, the imports and the seat data are left out). Notice what is not here: no JSON-RPC, no schema, no parsing.</p>
        <p class="task">${fin ? "All three found." : `This came back to the kiosk. Tap the line it was made from (${t + 1} of ${TARGETS.length}).`}</p>
        ${fin ? "" : msgBox(cur.show, kit)}
        ${pickLines(SERVER, fin ? null : picked, kit, fin)}
        <div class="lpanel">${fin ? kit.feedback(`Three things decide what every client sees: the function name (the tool's name), the docstring (its description) and the type hints (its schema). <code>@mcp.resource</code> is for data a host reads to give the model context; <code>@mcp.tool</code> is for actions and look-ups the model asks for. A tool can also raise an exception, which you saw come back as a result with isError.`, true)
          : say ? kit.feedback(say, false) : t ? kit.feedback(TARGETS[t - 1].yes, true) : ""}</div>`;
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => {
        const j = +b.dataset.i;
        if (j === TARGETS[t].line) { t++; picked = null; paint(); if (t === TARGETS.length) done(); }
        else { picked = [j, false]; paint(); }
      });
    };
    paint();
  }

  /* 7. The host: the chat assistant turns tools/list into the model's tools and forwards the model's request. */
  const HOST = [
    "def as_model_tool(t):  # one MCP tool -> one tool for the model",
    "    return {\"type\": \"function\", \"function\": {\"name\": t.name,",
    "            \"description\": t.description, \"parameters\": t.input_schema}}",
    "",
    "async with Client(server) as client:",
    "    tools = (await client.list_tools()).tools",
    "    shows = (await client.read_resource(\"seats://performances\")).contents[0].text",
    "    # system prompt + shows, the customer's message, [as_model_tool(t) for t in tools]"
  ];
  function host(ctx) {
    style();
    const { kit } = ctx;
    chain(ctx, () => `<h1>Plug the server into the chat assistant</h1>
      <p class="lead">The box-office chat assistant is now an MCP host. When it starts, it connects to the seat server and runs these lines (from <code>host.py</code>; <code>server</code> = how to start seats_server.py):</p>
      ${showLines(HOST, kit)}
      <p class="lead">A customer writes: <b>“${kit.esc(USER)}”</b> A small hosted model, given the two tools, answered:</p>
      ${msgBox(`…\n"finish_reason": "${REC_1.finish}",\n"message": {\n  …\n  "content": null,\n  …\n  "tool_calls": [{\n    …\n    "id": "${REC_1.call.id}",\n    "function": {\n      "name": "${REC_1.call.name}",\n      "arguments": ${JSON.stringify(REC_1.call.arguments)}\n    }, …\n  }], …\n}`, kit)}
      <p class="${P}cap">${kit.esc(CAPTION)}</p>
      <p class="task">Answer each question about this run.</p>`, [
      { q: `The customer wrote “Hamlet on 28 November”. Where did the model get <code>${kit.esc(ARGS_1.performance_id)}</code>?`,
        opts: ["The host read the performances resource and put its text into the system prompt", "The model sent resources/read to the server itself", "The model guessed it from its training"], right: 0,
        yes: `Right. The system prompt ended with the resource's text: <code>${kit.esc(RESOURCE_TEXT)}</code>. Resources are for the app to read and place into context. The model only sees what the host puts in its prompt and can only ask for the tools it was given.`,
        no: [null, "The model talks to nobody but the host, and it was given two tools, not resources/read. Only the host's client talks to the server.", "HAM-1128 is the theatre's own made-up id. No model could know it from training; it was in the prompt."] },
      { q: "The reply asks for hold_seats. What does the host send to the seat server?",
        opts: ["tools/call with the name hold_seats and these arguments, parsed from the string", "tools/list, to check the tool exists first", "The model's whole reply, as it is"], right: 0,
        yes: "Right: the request from the last lesson's loop is forwarded as an MCP tools/call, and the server's answer goes back to the model as a tool message. The loop stays the same; only where the function runs has changed.",
        no: [null, "The host listed the tools at start-up, and the model may only ask for listed tools. Listing again before every call adds a round trip for nothing.", "The server speaks MCP, not the model's API format. The host turns the request into a tools/call with the name and the parsed arguments."] },
      { q: "How much did the host's author write for each of the server's tools?",
        opts: ["A JSON description per tool", "Nothing per tool: as_model_tool converts whatever tools/list returns", "A Python function per tool"], right: 1,
        yes: `Right. Add a third tool to the server and the assistant can use it on its next start, with no change here. The kiosk broke on a rename because it typed arguments by hand. This host passes the current schema to the model, which fills in the current names.`,
        no: ["The descriptions come from the server, in tools/list. The host converts them in a loop.", null, "The functions live in the server. The host only forwards requests to it."] }
    ]);
  }

  /* 8. Broken on purpose: the customer is told the tool is broken, but F9 is simply taken. */
  const HOLD = [
    "@mcp.tool()",
    "def hold_seats(performance_id: str, seats: list[str]) -> dict:",
    "    \"\"\"Hold seats for 10 minutes while the customer pays.\"\"\"",
    "    rows = SEATS[performance_id]",
    "    taken = [s for s in seats if rows[s[0]][s] != \"free\"]",
    "    if taken:",
    "        raise ValueError(f\"Not free: {', '.join(taken)}\")",
    "    for s in seats:",
    "        rows[s[0]][s] = \"held\"",
    "    return {\"held\": seats, \"minutes\": 10}"
  ];
  const HOLD_BUG = HOLD.findIndex(l => l.includes("raise ValueError"));
  function broken({ el, done, kit }) {
    style();
    let pre = null, line = null, fix = null;
    const PRE = ["The model is too small to understand a seat error", "The text it received has no reason in it: the reason stayed on the server", "The host dropped the error text on the way"];
    const PRE_NO = [`Look at what it was given: one sentence, “${CRASH_TEXT}”, with no reason. No model can report a reason it never received.`, null,
      "The host passed the server's text through unchanged: the server log and the tool message hold the same sentence."];
    const lineSay = j => j === HOLD_BUG + 1 || j > HOLD_BUG + 1 ? "These lines never ran: the exception was raised before them." :
      j === HOLD_BUG - 1 ? "This check worked: F9 is held, so taken is not empty. The problem is how the failure is reported." :
      j === HOLD_BUG - 2 ? "This found F9 correctly, as the server log shows: “Not free: F9”." :
      "This line is fine. Look at the line where the failure is reported.";
    const FIX = ["Raise ToolError instead (from mcp.server.mcpserver.exceptions), so its message is sent to the client",
      "In the host, replace every tool error with “that seat is not available”",
      "Return {\"held\": []} instead of raising"];
    const FIX_NO = [null, "Then a full disk or a wrong performance id would also be reported as an unavailable seat. The host would be guessing; the server knows the reason.",
      "isError would be false, so the call looks like a success, and the model still does not learn which seat is taken."];
    const paint = () => {
      const preOk = pre === 1, found = line === HOLD_BUG, fixed = fix === 0;
      el.innerHTML = `<h1>Broken on purpose: “the tool is not working”</h1>
        <p class="lead">The host forwarded the model's request to the seat server. F9 was held by another customer, so <code>hold_seats</code> raised an exception. The server sent back, and the host passed on to the model, this tool message: <code>${kit.esc(CRASH_TEXT)}</code>. The model told the customer:</p>
        ${msgBox(REC_CRASH.text, kit)}<p class="${P}cap">Recorded model output, ${REC_CRASH.recordedAt}.</p>
        <p class="lead">Meanwhile the server wrote this to its error log (stderr):</p>
        <pre class="${P}log">${kit.esc(CRASH_LOG.join("\n"))}</pre>
        <p class="${P}cap">Real output of the seat server, cut where … stands.</p>
        <p class="task">${!preOk ? "Why did the model blame the tool instead of saying F9 is taken?" : !found ? "Tap the line in hold_seats that causes this." : "Pick the fix."}</p>
        <div class="lcase" id="pre">${kit.options(PRE.map(kit.esc), { picked: pre, correct: 1 })}${pre == null ? "" : preOk ? kit.feedback("Right. “Not free: F9” is in the server's log, not in the message. Something in the server kept it back.", true) : kit.feedback(kit.esc(PRE_NO[pre]), false)}</div>
        ${preOk ? pickLines(HOLD, line == null ? null : [line, found], kit, found) : ""}
        <div class="lpanel">${line == null ? "" : found ? kit.feedback("Right. The SDK treats an ordinary exception as unexpected: the model gets only “Error executing tool hold_seats”, and the message stays in the server's log, because it might reveal the server's internals. An error you expect has its own exception type, and its message is sent.", true) : kit.feedback(lineSay(line), false)}
        ${found ? `<div class="lcase" id="fix">${kit.options(FIX.map(kit.esc), { picked: fix, correct: 0 })}${fix == null ? "" : fixed ? kit.feedback(`Right. With that one change, the same request came back as <code>${kit.esc(FIXED_TEXT)}</code>, still with isError true. Sent the same conversation with that text, the model answered:`, true) + msgBox(REC_FIXED.text, kit) + `<p class="${P}cap">Recorded model output, ${REC_FIXED.recordedAt}.</p>` : kit.feedback(kit.esc(FIX_NO[fix]), false)}</div>` : ""}</div>`;
      el.querySelectorAll("#pre .lopts button").forEach(b => b.onclick = () => { pre = +b.dataset.i; if (pre !== 1) { line = null; fix = null; } paint(); });
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => { line = +b.dataset.i; if (line !== HOLD_BUG) fix = null; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  const PICK = ["An MCP server", "Function calling inside the app", "Plain code, no model tools"];
  const BIG = [
    ["A shop's own chat widget needs two look-ups in the shop's own database. No other app will ever use them.", 1,
      "Right. One app, its own functions: define them as tools in the app, as in the last lesson. A server would be one more program to run and secure, for no one else.",
      [`A server pays off when several apps, or apps you do not control, share the tools. Here there is one app, so it adds a process to deploy, a protocol hop and a schema to keep in step, and nothing in return.`, null, "The customer's words decide which look-up to run, so a model choosing tools fits. It only needs to be inside the app."]],
    ["A company wants its ticket system usable from the chat app it builds, from two AI coding tools staff already pay for, and from a desktop assistant.", 0,
      "Right. Several hosts, most of them products the company cannot change. One server, and every host that speaks MCP can use it.",
      [null, "Function calling lives inside one app's code. The coding tools and the desktop assistant are other companies' products; you cannot add your functions to them.", "The staff ask in their own words, inside tools you do not control. Plain code cannot reach into those products; a server they can connect to can."]],
    ["Every night at 2:00, copy the day's sales into the accounting system. Always the same steps.", 2,
      "Right. Nothing has to be chosen from free text, so no model is needed to pick a tool. A scheduled script is cheaper and never picks wrong.",
      ["No model is involved, so there is nothing for a server to describe tools to. A scheduled script does the copy.", "No message decides what to do: the steps are fixed. A model choosing tools only adds cost and a chance to choose wrong."]]
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for an MCP server</h1>
        <p class="lead"><b>What for:</b> writing a set of tools and data once and using it from many AI apps, including products you do not control. <b>When:</b> several hosts need the same system, or you want your system usable in tools your users already have. <b>When not:</b> one app with its own functions (plain function calling); fixed steps (plain code). </p><p class="lead"><b>Costs:</b> one more program to run, update and secure. It acts with whatever access you give it, so ask a person before risky actions. Every call takes one extra hop, from host to server. Clients depend on the schema, so a rename breaks any client that hard-codes the old name. And every tool's description is sent as input tokens with every model request.</p>
        <p class="task">For each job, pick what fits best.</p>
        ${BIG.map(([q, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(PICK, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : no[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it in new situations, with one honest "no". */
  const CASES = [
    ["A hospital's drug-interaction database should be usable from the doctors' chat assistant, a nurses' tablet app and a research team's notebook assistant, made by three different vendors.", true,
      "Yes. One system, three hosts from three vendors. One server lets all three use it, and a change to the database's tools is made in one place.",
      "Three vendors would each have to write and maintain their own glue to the database. One server, which each host connects to, is written once."],
    ["A developer's own script asks a model to suggest names for the photos in one folder, using one function that reads the file dates. Nobody else will run it.", false,
      "No. One program, one function, one user. Plain function calling does it in a few lines; a server adds a second process and a protocol between them, and nobody else would ever connect to it.",
      "Ask who else would connect. Nobody: one script, one function. A server adds a process to start and a protocol hop, and shares the tool with no one. Plain function calling is enough."],
    ["A software company wants staff to search its internal wiki from the AI coding tools and chat apps they already use, whichever they prefer.", true,
      "Yes. Many hosts, chosen by the staff and made by others. A wiki server with a search tool works in any of them that speak MCP.",
      "Staff use several products the company did not build and cannot change. A server those products connect to is the only way in that is written once."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>An MCP server, or not?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the theatre.</p>
        <p class="task">For each one, decide whether an MCP server is the right way to give models the tools. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook, with a checklist from our own run, then the next lesson. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5a-mcp-servers.ipynb";
  const ROW_G = MSGS[OK_CALL].m.result.structuredContent.result;
  const CHECKS = [
    `<code>list_tools()</code> prints two names: ${TOOLS_REPLY.map(t => t.name).join(" and ")}`,
    `The <code>inputSchema</code> of find_free_seats has <code>required: ${kit_esc(JSON.stringify(FIND.inputSchema.required))}</code>, built from the type hints`,
    `find_free_seats for HAM-1128, row G returns ${ROW_G.join(", ")} with <code>is_error</code> False`,
    `Calling it with <code>${BAD_ARG}</code> instead of <code>performance_id</code> returns <code>is_error</code> True and the text names performance_id, “Field required”`,
    `hold_seats for ${PRED.hold.args.join(" and ")} returns only “${PRED.hold.text}”, while the server log has “ValueError: Not free: F9”; after switching to ToolError it returns “${FIXED_TEXT}”`,
    `The replayed model answer changes from “…<code>hold_seats</code> is not working correctly” to “…seat F9 is no longer available”`
  ];
  function kit_esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can build and plug in a server</h1>
      <p>An MCP server describes its tools and resources; any client discovers them and calls them, so a system is wired up once for every app. A host hands the tools to its model and forwards the model's requests. Tool failures come back as results with isError, and the model learns the reason only if the server sends it, as with ToolError.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a>.` : "The notebook for this lesson is on its way."} In it you write the seat server with the MCP Python SDK, connect a client to it, and break and fix it as here. Tick what you see while you run it:</p>
      <ul class="${P}checks">${CHECKS.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. It starts the search unit: finding the right passages in long documents. A search like that is also a tool you could serve from an MCP server like this one.</p>` : ""}`;
    done();
  }

  /* ---------- walks ---------- */
  const LABEL_WALK = { wrong: ["[data-wrong]"], right: MSGS.map(() => "[data-right]") };
  const LINES_WALK = { wrong: [`.${P}lines [data-i="${at("mcp.run")}"]`], right: TARGETS.map(x => `.${P}lines [data-i="${x.line}"]`) };

  LessonKit.define("s5a-mcp-servers", {
    title: "MCP servers: sharing tools across apps",
    checked: "2026-11-13",
    sources: [
      "https://modelcontextprotocol.io/docs/learn/architecture",
      "https://modelcontextprotocol.io/specification/latest/server/tools",
      "https://modelcontextprotocol.io/specification/latest/server/resources",
      "https://modelcontextprotocol.io/specification/latest/basic/lifecycle",
      "https://py.sdk.modelcontextprotocol.io/servers/tools/",
      "https://py.sdk.modelcontextprotocol.io/servers/handling-errors/",
      "https://py.sdk.modelcontextprotocol.io/client/",
      "https://py.sdk.modelcontextprotocol.io/client/transports/"
    ],
    interview: [{
      q: "Your company has four internal systems and three AI apps that want them. A teammate proposes one MCP server per system. When do you agree, and what do you watch for?",
      good: ["Agree when several hosts need the same system, especially products you cannot change; for one app, plain function calling is simpler",
        "Each server is a program to run, update and secure; give it the narrowest access it needs and keep a human approval step for actions",
        "Treat the tool schema as an API: renaming a parameter breaks clients that hard-code calls",
        "Write descriptions for the model, and keep tool lists short, since every description is input tokens on every request",
        "Return expected failures as tool errors with a clear message so the model can recover"],
      weak: "“MCP is the standard, so wrap everything in a server.” It ignores the extra process, the security surface and the cases where one app's function call is enough."
    }, {
      q: "After a server update, the kiosk's tool calls fail but the chat assistant keeps working. How do you find out why?",
      good: ["Log the raw messages between each client and the server and compare the failing tools/call with the inputSchema from tools/list",
        "Check the envelope: a JSON-RPC error means a bad request; a result with isError true means the tool ran and failed, and its text says why",
        "The assistant likely passes the current schema to the model, while the kiosk hard-codes arguments from an older version",
        "Fix the client to build calls from the current schema, and version or announce breaking changes on the server"],
      weak: "Restart the server or roll back the update. It may hide the problem but never shows which client sent what."
    }],
    screens: [situation, labelLog, findFail, spotIdea, predict, serverCode, host, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      LABEL_WALK,
      { wrong: [`.${P}rows [data-i="${OK_CALL}"]`], right: [`.${P}rows [data-i="${FAIL}"]`, "#why [data-right]", "#fix [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]", "#q3 [data-right]"] },
      LINES_WALK,
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["#pre [data-wrong]"], right: ["#pre [data-right]", `.${P}lines [data-i="${HOLD_BUG}"]`, "#fix [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
