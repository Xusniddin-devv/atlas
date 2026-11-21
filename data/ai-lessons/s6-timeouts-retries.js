/* Lesson s6-timeouts-retries: Timeouts, retries and backoff for model calls.
   Story: a food-delivery app's menu translator falls over every evening rush when the model provider starts
   rate limiting (429). The learner sees that retrying at once multiplies the calls, sorts a real call log into
   "retry" and "fail fast", finds that equal waits make retries arrive in waves, predicts what doubling waits and
   random waits (jitter) do in a simulated rush, steps through a retry function's real trace, debugs a real run
   where retries outlived the app's wait (no overall deadline), picks timeout and retry settings, and learns
   when not to retry.
   Ideas: (1) retry only what can succeed later, with capped exponential backoff and full jitter, honouring
   Retry-After; (2) one deadline for all attempts, shorter than the caller's wait.
   Depth: explain (screens 2, 3, 8, interview), scratch (screens 4 and 5: simulation and retry loop in plain
   Python, real runs), debug (screen 6: real broken run), when-not (screens 8 and 9).
   Data: docs/ai-path/runs/s6-timeouts-retries/ (rush_sim.py, rush_log.py, trace_retry.py, deadline_run.py,
   retry.py, standin.py, *.out.txt, env.txt). No model calls were recorded: a real provider cannot be made to
   fail on cue, so a stand-in provider on localhost (standin.py) plays it, and the lesson says so.
   Every number on screen is computed here from SIM, LOG, TRACE, PCALLS, RUN_BROKEN, RUN_FIXED and CONFIGS.
   Lesson-local CSS (prefix lx-s6-timeouts-retries-): the calls-per-second strips, the log rows, the call card. */
(() => {
  const ID = "s6-timeouts-retries";
  const P = "lx-s6-timeouts-retries-";

  // From docs/ai-path/runs/s6-timeouts-retries/rush_sim.out.txt (python3 rush_sim.py, seed 7), not altered
  const SIM = {"setup":{"phones":300,"rate_per_second":50.0,"burst":10,"max_attempts":6,"base_s":1.0,"cap_s":16.0,"seed":7},"now":{"rule":"now","calls":1705,"rejected":1686,"served":19,"failed":281,"last_served_s":0.18,"median_served_s":0.01,"calls_per_second":[1705,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"rejected_per_second":[1686,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"fixed":{"rule":"fixed","calls":1516,"rejected":1404,"served":112,"failed":188,"last_served_s":5.19,"median_served_s":2.19,"calls_per_second":[300,281,262,243,224,206,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"rejected_per_second":[281,262,243,224,206,188,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"backoff":{"rule":"backoff","calls":1516,"rejected":1404,"served":112,"failed":188,"last_served_s":31.19,"median_served_s":3.19,"calls_per_second":[300,281,0,262,0,0,0,243,0,0,0,0,0,0,0,224,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,206,0,0,0,0,0,0,0,0],"rejected_per_second":[281,262,0,243,0,0,0,224,0,0,0,0,0,0,0,206,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,188,0,0,0,0,0,0,0,0]},"jitter":{"rule":"jitter","calls":1050,"rejected":750,"served":300,"failed":0,"last_served_s":17.5,"median_served_s":2.86,"calls_per_second":[615,181,111,50,39,26,14,2,5,2,1,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"rejected_per_second":[556,131,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}};
  // From docs/ai-path/runs/s6-timeouts-retries/rush_log.out.txt (python3 rush_log.py), not altered
  const LOG = [{"restaurant":"Pho Saigon","lang":"en","menu_lines":38,"status":200,"at_s":0.0,"took_s":0.05},{"restaurant":"Taco Loco","lang":"en","menu_lines":41,"status":429,"retry_after":"2","message":"Rate limit exceeded: too many requests","at_s":0.05,"took_s":0.0},{"restaurant":"Kebab House","lang":"xx","menu_lines":27,"status":400,"retry_after":null,"message":"Target language 'xx' is not supported","at_s":0.05,"took_s":0.0},{"restaurant":"Sushi Ten","lang":"en","menu_lines":52,"status":null,"exception":"TimeoutError","message":"timed out","at_s":0.05,"took_s":5.0},{"restaurant":"Pizza Roma","lang":"en","menu_lines":2300,"status":413,"retry_after":null,"message":"Request body too large","at_s":5.05,"took_s":0.01},{"restaurant":"Curry Leaf","lang":"en","menu_lines":46,"status":503,"retry_after":null,"message":"Overloaded, try again later","at_s":5.06,"took_s":0.0},{"restaurant":"Dim Sum Bar","lang":"en","menu_lines":60,"status":null,"exception":"RemoteDisconnected","message":"Remote end closed connection without response","at_s":5.06,"took_s":0.0},{"restaurant":"Bistro Nord","lang":"en","menu_lines":33,"status":429,"retry_after":null,"message":"Monthly spend cap reached; access resumes on the 1st","at_s":5.06,"took_s":0.0},{"restaurant":"Falafel Stop","lang":"en","menu_lines":29,"status":402,"retry_after":null,"message":"Insufficient credits","at_s":5.07,"took_s":0.0}];
  // From docs/ai-path/runs/s6-timeouts-retries/trace_retry.out.txt (python3 trace_retry.py, seed 3), not altered
  const SRC = ["def with_retries(send, menu, n=4,", "                 base=0.5, cap=8.0):", "    for k in range(n):", "        try:", "            return send(menu, 10.0)", "        except ProviderError as err:", "            last = k == n - 1", "            if last or not err.retry:", "                raise", "            lim = min(cap, base * 2**k)", "            wait = (err.ra", "                    or uniform(0, lim))", "            time.sleep(wait)"];
  const TRACE = [{"line": 2, "event": "line", "vars": {}, "t": 0.0}, {"line": 3, "event": "line", "vars": {"k": 0}, "t": 0.0}, {"line": 4, "event": "line", "vars": {"k": 0}, "t": 0.0}, {"line": 5, "event": "line", "vars": {"k": 0}, "t": 0.02}, {"line": 6, "event": "line", "vars": {"k": 0, "err": "ProviderError('429', retry=True, ra=1.0)"}, "t": 0.02}, {"line": 7, "event": "line", "vars": {"k": 0, "err": "ProviderError('429', retry=True, ra=1.0)"}, "t": 0.02}, {"line": 9, "event": "line", "vars": {"k": 0, "err": "ProviderError('429', retry=True, ra=1.0)"}, "t": 0.02}, {"line": 10, "event": "line", "vars": {"k": 0, "err": "ProviderError('429', retry=True, ra=1.0)"}, "t": 0.02}, {"line": 12, "event": "line", "vars": {"k": 0, "err": "ProviderError('429', retry=True, ra=1.0)", "wait": 1.0}, "t": 0.02}, {"line": 2, "event": "line", "vars": {"k": 0, "wait": 1.0}, "t": 1.03}, {"line": 3, "event": "line", "vars": {"k": 1, "wait": 1.0}, "t": 1.03}, {"line": 4, "event": "line", "vars": {"k": 1, "wait": 1.0}, "t": 1.03}, {"line": 5, "event": "line", "vars": {"k": 1, "wait": 1.0}, "t": 1.03}, {"line": 6, "event": "line", "vars": {"k": 1, "err": "ProviderError('503', retry=True, ra=None)", "wait": 1.0}, "t": 1.03}, {"line": 7, "event": "line", "vars": {"k": 1, "err": "ProviderError('503', retry=True, ra=None)", "wait": 1.0}, "t": 1.03}, {"line": 9, "event": "line", "vars": {"k": 1, "err": "ProviderError('503', retry=True, ra=None)", "wait": 1.0}, "t": 1.03}, {"line": 10, "event": "line", "vars": {"k": 1, "err": "ProviderError('503', retry=True, ra=None)", "wait": 1.0}, "t": 1.03}, {"line": 11, "event": "line", "vars": {"k": 1, "err": "ProviderError('503', retry=True, ra=None)", "wait": 1.0}, "t": 1.03}, {"line": 10, "event": "line", "vars": {"k": 1, "err": "ProviderError('503', retry=True, ra=None)", "wait": 1.0}, "t": 1.03}, {"line": 12, "event": "line", "vars": {"k": 1, "err": "ProviderError('503', retry=True, ra=None)", "wait": 0.23796462709189137}, "t": 1.03}, {"line": 2, "event": "line", "vars": {"k": 1, "wait": 0.23796462709189137}, "t": 1.27}, {"line": 3, "event": "line", "vars": {"k": 2, "wait": 0.23796462709189137}, "t": 1.27}, {"line": 4, "event": "line", "vars": {"k": 2, "wait": 0.23796462709189137}, "t": 1.27}, {"line": 4, "event": "return", "vars": {"k": 2, "wait": 0.23796462709189137}, "t": 1.27}];
  const PCALLS = [{"at_s": 0.0, "took_s": 0.02, "attempt": "429 Rate limit exceeded: too many requests"}, {"at_s": 1.03, "took_s": 0.0, "attempt": "503 Overloaded, try again later"}, {"at_s": 1.27, "took_s": 0.0, "attempt": "200 OK"}];
  // From docs/ai-path/runs/s6-timeouts-retries/deadline_broken.out.txt (python3 deadline_run.py broken, seed 11), not altered
  const RUN_BROKEN = {"events": [{"at_s": 0.01, "who": "app", "what": "a customer opens Taco Loco; ask the translator (wait at most 15 s)"}, {"at_s": 0.02, "who": "translator", "what": "request in; calling the provider"}, {"at_s": 0.02, "who": "provider call", "what": "timed out after 10.0 s (took 10.00 s)"}, {"at_s": 10.26, "who": "provider call", "what": "timed out after 10.0 s (took 10.00 s)"}, {"at_s": 15.02, "who": "app", "what": "timed out after 15 s; shows 'Translation failed'"}, {"at_s": 20.82, "who": "provider call", "what": "timed out after 10.0 s (took 10.00 s)"}, {"at_s": 32.67, "who": "provider call", "what": "200 OK (took 0.00 s)"}, {"at_s": 32.67, "who": "translator", "what": "translation ready after 4 provider calls"}, {"at_s": 32.67, "who": "translator", "what": "sent 200 to the app"}], "provider_calls": 4};
  // From docs/ai-path/runs/s6-timeouts-retries/deadline_fixed.out.txt (python3 deadline_run.py fixed, seed 11), not altered
  const RUN_FIXED = {"events": [{"at_s": 0.01, "who": "app", "what": "a customer opens Taco Loco; ask the translator (wait at most 15 s)"}, {"at_s": 0.02, "who": "translator", "what": "request in; calling the provider"}, {"at_s": 0.02, "who": "provider call", "what": "timed out after 10.0 s (took 10.00 s)"}, {"at_s": 10.26, "who": "provider call", "what": "timed out after 1.8 s (took 1.77 s)"}, {"at_s": 12.03, "who": "translator", "what": "gave up after 2 provider calls: timed out; answering 504"}, {"at_s": 12.03, "who": "translator", "what": "sent 504 to the app"}, {"at_s": 12.03, "who": "app", "what": "got 504: {\"error\": \"translation timed out, please try again\"}; shows 'Try again'"}], "provider_calls": 2};
  // From docs/ai-path/runs/s6-timeouts-retries/retry.py: lines 3-7 and 12-14 of with_deadline, the lines that differ from with_retries, not altered
  const SRC_FIXED = ["    end = now() + budget", "    for k in range(n):", "        t = min(10.0, end - now())", "        try:", "            return send(menu, t)", "        …", "            late = now() + wait >= end", "            stop = late or k == n - 1", "            if stop or not err.retry:"];

  const fmt = n => Math.round(n).toLocaleString("en");
  const sec = n => `${(+n).toFixed(n >= 10 ? 1 : 2)} s`;
  const S = SIM.setup, NOW = SIM.now, FIX = SIM.fixed, BACK = SIM.backoff, JIT = SIM.jitter;
  const RUN_NOTE = `<p class="${P}cap">Simulated in Python on our Mac (rush_sim.py, seed ${S.seed}). No real provider was called.</p>`;

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}cap { display: block; margin: 8px 0 0; font: 500 12px var(--mono); color: var(--muted); }
.${P}strips { margin-top: 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); padding: 10px 12px 8px; }
.${P}strip { margin-top: 10px; }
.${P}strip:first-child { margin-top: 0; }
.${P}strip .h { display: flex; justify-content: space-between; gap: 8px; font: 600 13px var(--mono); }
.${P}strip .h span:last-child { font-weight: 500; color: var(--muted); text-align: right; }
.${P}cols { display: grid; gap: 1px; align-items: end; height: 64px; margin-top: 6px; border-bottom: 1px solid var(--line); }
.${P}col { display: flex; flex-direction: column; justify-content: flex-end; height: 100%; min-width: 0; }
.${P}col .r { background: var(--bad-soft); box-shadow: inset 0 0 0 1px var(--bad); }
.${P}col .s { background: var(--good); }
.${P}axis { position: relative; height: 16px; font: 500 11px var(--mono); color: var(--muted); margin-top: 3px; }
.${P}axis span { position: absolute; top: 0; white-space: nowrap; }
.${P}log { margin-top: 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); overflow: hidden; }
.${P}row { display: grid; grid-template-columns: 92px 1fr; gap: 4px 10px; width: 100%; min-height: 48px; padding: 8px 12px; border: 0; border-top: 1px solid var(--line); background: transparent; color: var(--ink); font: inherit; text-align: left; align-items: start; }
.${P}row:first-child { border-top: 0; }
button.${P}row { cursor: pointer; }
@media (hover: hover) { button.${P}row:hover { background: var(--sunk); } }
.${P}row .t { font: 600 13px var(--mono); color: var(--muted); padding-top: 2px; }
.${P}row .w { min-width: 0; overflow-wrap: anywhere; font-size: 15px; }
.${P}row .w b { display: block; font: 700 13px var(--mono); }
.${P}row.cur { box-shadow: inset 3px 0 0 var(--ink); background: var(--sunk); }
.${P}row.no { box-shadow: inset 3px 0 0 var(--bad); background: var(--bad-soft); }
.${P}row.ok { box-shadow: inset 3px 0 0 var(--good); background: var(--good-soft); }
.${P}row.dim { color: var(--muted); }
.${P}tag { display: inline-block; margin-left: 6px; font: 600 12px var(--mono); color: var(--muted); }
.${P}card { margin-top: 14px; border: 1px solid var(--line); border-radius: var(--r); padding: 12px 14px; background: var(--surface); }
.${P}card h3 { margin: 0 0 8px; font: 700 16px var(--font); }
.${P}kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; font-size: 15px; }
.${P}kv dt { font: 600 13px var(--mono); color: var(--muted); padding-top: 2px; }
.${P}kv dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.${P}kv dd code { overflow-wrap: anywhere; }
.${P}calls { margin-top: 10px; font: 500 13px/1.6 var(--mono); color: var(--ink-2); }
.${P}calls div { overflow-wrap: anywhere; }
.${P}cfg { font: 500 14px var(--mono); }
`;
    document.head.appendChild(s);
  }

  /* Calls per second as columns: the served part and the part that got 429, for seconds 0..n-1. */
  const STRIP_N = 33, STRIP_MAX = Math.max(...[NOW, FIX, BACK, JIT].map(r => Math.max(...r.calls_per_second.slice(1, STRIP_N))), ...[FIX, BACK, JIT].map(r => r.calls_per_second[0]));
  function strip(run, name, n = STRIP_N) {
    const cols = run.calls_per_second.slice(0, n).map((c, i) => {
      const rej = run.rejected_per_second[i], srv = c - rej;
      const h = v => `${Math.min(100, v / STRIP_MAX * 100)}%`;
      return `<div class="${P}col" title="second ${i}: ${c} calls, ${rej} got 429"><i class="r" style="height:${h(rej)}"></i><i class="s" style="height:${h(srv)}"></i></div>`;
    }).join("");
    const ticks = (n <= 8 ? [0, 2, 4, 6] : [0, 8, 16, 24, 32]).filter(t => t < n).map(t => `<span style="left:calc(${t / n * 100}% ${t ? "- 6px" : ""})">${t} s</span>`).join("");
    return `<div class="${P}strip"><div class="h"><span>${kit_esc(name)}</span><span>${fmt(run.calls)} calls, ${fmt(run.failed)} gave up</span></div>
      <div class="${P}cols" style="grid-template-columns:repeat(${n},1fr)" role="img" aria-label="${kit_esc(name)}: calls per second">${cols}</div><div class="${P}axis">${ticks}</div></div>`;
  }
  const kit_esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const stripKey = kit => kit.pics.key([["enter", "calls served"], ["no", "calls that got 429"]]);

  /* ---------- 1. The situation ---------- */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const round100 = n => Math.round(n / 100) * 100;
    const opts = [S.phones, S.phones * 2, round100(NOW.calls)];
    const correct = 2;
    const paint = () => {
      el.innerHTML = `<h1>The menu translator falls over at 19:00</h1>
        <p class="lead">A food-delivery app shows each restaurant's menu in the customer's language. A model translates it. Every evening at 19:00 the app sends a "dinner deals" notice, and in our simulation <b>${S.phones} customers</b> open a menu within the same fifth of a second. This lesson is about what your code should do when a model call fails: send it again, wait, or give up.</p>
        <p class="lead">The model provider (the company whose API runs the model) limits calls. It hands out ${fmt(S.rate_per_second)} call tickets per second and keeps at most ${S.burst} spare. A call that finds no ticket gets <b>429 Too Many Requests</b>. (This is a <b>token bucket</b>; the Claude API documents its limiter this way.) Today's code: on any error, call again at once, up to ${S.max_attempts} calls per menu.</p>
        <p class="task">How many calls does the provider receive for these ${S.phones} menus?</p>
        <div class="lpanel">${kit.options(opts.map(n => `About ${fmt(n)}`), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right: ${fmt(NOW.calls)} calls for ${S.phones} menus. Only <b>${NOW.served}</b> menus were translated, and <b>${NOW.failed}</b> customers saw "Translation failed". Each retry arrived while the bucket was still empty, so it failed too, and most phones used all ${S.max_attempts} calls. Retrying at once multiplies the load at the worst moment. This is called a <b>retry storm</b>.`, true)
          : ans === 0 ? kit.feedback(`That counts each phone once. But a phone that gets 429 calls again, up to ${S.max_attempts} times, and every one of those calls counts.`, false)
          : kit.feedback(`That is one retry per phone. But a retry sent at once arrives in the same instant, when the bucket is still empty. It fails too, so the phone calls again, up to ${S.max_attempts} times.`, false)}
        ${ans === correct ? RUN_NOTE : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 2. By hand: which failures are worth a retry? ---------- */
  const what = r => r.status ? `${r.status}${r.message ? " " + r.message : " OK"}` : `${r.exception}: ${r.message}`;
  const RULE = {
    "Taco Loco": [true, "Retry, after the 2 seconds the provider asked for. A 429 with <code>Retry-After</code> means “not now, try again in 2 s”.",
      "The provider told you when to come back: <code>Retry-After: 2</code>. Too many calls is a state of the moment, not a fault in this menu. Wait 2 s and send it again."],
    "Kebab House": [false, "Fail fast. “xx” is not a language. The same request gets the same 400 every time, so fix the input or tell the restaurant.",
      "Look at the request: the target language is “xx”. Nothing about it changes in a second or a minute, so every retry gets the same 400 and only adds calls. A 4xx error like this says the request itself is wrong."],
    "Sushi Ten": [true, "Retry. The host was slow, not the request wrong. Translating a menu changes nothing on the provider's side, so a second try is safe, if the customer is still waiting.",
      "A timeout says the answer did not come in 5 s. It does not say the request is bad. Translating has no side effect (nothing is booked or sent twice), so one more try is safe and often works."],
    "Pizza Roma": [false, "Fail fast. A 2,300-line menu is too big for one call now and will be too big next time. Split it into parts instead.",
      "The menu has 2,300 lines and the provider says the body is too large. Sending the same body again gets the same 413. The fix is in your code: split the menu into smaller calls."],
    "Curry Leaf": [true, "Retry, after a short wait that grows each time. Overloaded is temporary.",
      "503 Overloaded is about the provider's state right now, not about this menu. OpenRouter's error page says to retry such a call “after a short delay”."],
    "Dim Sum Bar": [true, "Retry. The connection broke before any answer: a network or host hiccup. The call has no side effect, so sending it again is safe.",
      "No answer came back at all; the connection was closed. That is a passing network or host problem, and a translation can be sent again safely."],
    "Bistro Nord": [false, "Fail fast and alert a person. Same 429 number, but the message says the monthly spend cap is reached, and there is no Retry-After. Nothing changes until the 1st.",
      "Read the message, not just the number: “Monthly spend cap reached; access resumes on the 1st”, and no <code>Retry-After</code>. The Claude API documents exactly this: a spend-cap 429 without the header that keeps failing until access resumes. Retries only burn calls."],
    "Falafel Stop": [false, "Fail fast and alert a person. Waiting does not add credits.",
      "402 means the account has no credits left. Waiting does not add any. OpenRouter's error page calls a 402 without <code>Retry-After</code> “not a wait-and-retry case”."]
  };
  const DECIDE = LOG.filter(r => r.status !== 200);
  function byHand({ el, done, kit }) {
    style();
    let k = 0, wrong = null, lastOk = null;
    const picks = [];
    const paint = () => {
      const fin = k >= DECIDE.length, r = fin ? null : DECIDE[k], rule = r ? RULE[r.restaurant] : null;
      const rows = LOG.map(row => {
        const j = DECIDE.indexOf(row), cls = j < 0 ? "dim" : j < k ? (RULE[row.restaurant][0] ? "ok" : "") : j === k ? "cur" : "";
        const tag = j >= 0 && j < k ? `<span class="${P}tag">${RULE[row.restaurant][0] ? "retry" : "fail fast"}</span>` : "";
        return `<div class="${P}row ${cls}"><span class="t">${sec(row.at_s)}</span><span class="w"><b>${kit.esc(row.restaurant)}</b>${kit.esc(what(row))}${tag}</span></div>`;
      }).join("");
      const retry = DECIDE.filter(x => RULE[x.restaurant][0]), fast = DECIDE.filter(x => !RULE[x.restaurant][0]);
      el.innerHTML = `<h1>Retry it, or fail fast?</h1>
        <p class="lead">A real provider cannot be made to fail on cue, so we wrote a small stand-in provider on our Mac. It answers each call with one kind of failure that providers' error pages describe. The translator's real client code (a 5-second timeout, no retries yet) called it at the rush. This is what the client saw.</p>
        ${fin ? "" : `<p class="task">For each failed call, decide: would calling again (later) help, or should the translator <b>fail fast</b> (give up at once and report the error)?</p>`}
        ${fin ? "" : `<div class="${P}card"><h3>Failed call ${k + 1} of ${DECIDE.length}: ${kit.esc(r.restaurant)}</h3><dl class="${P}kv">
          <dt>menu</dt><dd>${fmt(r.menu_lines)} lines, into <code>${kit.esc(r.lang)}</code></dd>
          <dt>came back</dt><dd>${kit.esc(what(r))}</dd>
          <dt>Retry-After</dt><dd>${r.status ? (r.retry_after ? `${kit.esc(r.retry_after)} s` : "none") : "no answer at all"}</dd>
          <dt>took</dt><dd>${sec(r.took_s)}</dd></dl></div>`}
        <div class="lpanel">${fin ? "" : kit.options(["Retry it", "Fail fast"], { picked: wrong, correct: rule[0] ? 0 : 1 })}
        ${wrong != null ? kit.feedback(rule[2], false) : lastOk ? kit.feedback(lastOk, true) : ""}
        ${fin ? kit.feedback(`Worth a retry: ${retry.map(x => kit.esc(x.restaurant)).join(", ")} (${retry.length} calls). Fail fast: ${fast.map(x => kit.esc(x.restaurant)).join(", ")} (${fast.length} calls). The rule you used: <b>retry what can succeed later without changing the request</b> (too many calls, overloaded, timed out, dropped). <b>Fail fast</b> on what will fail the same way every time (a bad or too-large request, no credits, a spend cap). The status number is a first hint; the message and the <code>Retry-After</code> header settle it.`) : ""}</div>
        <div class="${P}log">${rows}</div>
        <p class="${P}cap">Printed by rush_log.py against standin.py on our Mac. The messages are the stand-in's own wording.</p>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== (rule[0] ? 0 : 1)) { wrong = i; lastOk = null; paint(); return; }
        picks.push(i); wrong = null; lastOk = `${kit.esc(r.restaurant)}: ${rule[1]}`; k++; paint();
        if (k >= DECIDE.length) done();
      });
    };
    paint();
  }

  /* ---------- 3. Spot the idea: equal waits arrive in waves ---------- */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const wave2 = FIX.calls_per_second[1], served2 = wave2 - FIX.rejected_per_second[1];
    const opts = [
      "The provider is still busy from the first wave, so it serves fewer calls",
      `All ${wave2} phones waited the same 1 s, so they arrive together again, inside a fifth of a second, when the bucket holds only a few tickets`,
      "1 s is too short. With 2 s every time, they would all get through"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Wait one second, then retry</h1>
        <p class="lead">The team changes the rule: after a 429, wait exactly 1 s, then call again (still at most ${S.max_attempts} calls). Same rush, same provider. Each column below is one second; its height is the number of calls in that second.</p>
        <div class="${P}strips">${strip(FIX, "wait 1 s every time", 8)}</div>
        ${stripKey(kit)}
        <p class="lead">In second 1, <b>${wave2}</b> calls arrive and only <b>${served2}</b> are served. ${fmt(FIX.failed)} customers still end with "Translation failed".</p>
        <p class="task">Why do only ${served2} of the ${wave2} get through in second 1?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Every phone failed at about the same moment and waited the same time, so the retries arrive as one wave, inside a fifth of a second. The bucket refills only ${fmt(S.rate_per_second)} tickets per second and holds ${S.burst} spare, so a wave that short gets about ${served2}; the rest of each second sits idle. The cure is to make the waits <b>differ from phone to phone</b>, so the calls spread over the whole second.`, true)
          : ans === 0 ? kit.feedback(`The bucket does not remember the first wave. It refills ${fmt(S.rate_per_second)} tickets every second whatever happened before, and most of second 1 has no calls at all. The problem is when the calls come, not what came before.`, false)
          : kit.feedback("Waiting 2 s each time moves the wave later, but every phone still waits the same time, so they still arrive together in one short burst. The next screen shows the same thing with longer, doubling waits.", false)}
        ${ans === correct ? RUN_NOTE : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 4. Use it with predictions: backoff, then backoff with jitter ---------- */
  function predict({ el, done, kit }) {
    style();
    let stage = 0, wrong = null;
    const half = Math.round(FIX.failed / 2);
    const steps = [
      { q: `<b>Exponential backoff</b>: wait 1 s, then 2, 4, 8, 16 s (doubling each time, never more than ${fmt(S.cap_s)} s). No randomness. How many customers end with "Translation failed"?`,
        opts: [...new Set([0, half, BACK.failed])].sort((a, b) => a - b), right: BACK.failed,
        bad: v => v === 0 ? "Doubling only moves the waves further apart. All phones still wait the same time, so each wave still lands inside a fifth of a second and gets only a few tickets." : `Longer waits do not help the phones that collide: each wave is as short and as crowded as before, just later. The same number fail as with 1 s.`,
        ok: () => `Right: ${fmt(BACK.failed)}, exactly as many as with 1 s. The waves are further apart and the last customer was served at ${sec(BACK.last_served_s)}, but each wave is still one short burst.`,
        show: [[BACK, "backoff, no randomness"]] },
      { q: `<b>Backoff with full jitter</b>: after each failure, wait a random time between 0 and the doubling limit (0–1 s after the first, then 0–2 s, 0–4 s …). How many customers fail now?`,
        opts: [...new Set([JIT.failed, half, FIX.failed])].sort((a, b) => a - b), right: JIT.failed,
        bad: v => v === FIX.failed ? "That is the result for equal waits. Random waits spread the retries over the whole window, into the parts of each second that sat idle before." : "Better than equal waits, but jitter does more: spread out, the retries use the tickets that refill all through each second.",
        ok: () => `Right: ${fmt(JIT.failed)}. All ${S.phones} menus were translated, with ${fmt(JIT.calls)} calls instead of ${fmt(BACK.calls)}. Same capacity, used evenly. That randomness is called <b>jitter</b>.`,
        show: [[BACK, "backoff, no randomness"], [JIT, "backoff with full jitter"]] },
      { q: "Jitter helped everyone get a menu. When was the last customer served?",
        opts: [1, FIX.last_served_s, JIT.last_served_s].map(v => Math.round(v)).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b), right: Math.round(JIT.last_served_s),
        bad: v => v === 1 ? "Some random waits are long: by the 5th failure the range is 0–16 s. A few unlucky phones keep drawing long waits." : "That is when the equal-wait rule finished, but it served only part of the customers. With jitter a few unlucky phones draw long waits, up to 16 s.",
        ok: () => `Right: at ${sec(JIT.last_served_s)}; half were served by ${sec(JIT.median_served_s)}. A customer will not stare at a menu for ${Math.round(JIT.last_served_s)} s. Retries need a limit on total time too: screen 6.`,
        show: [[BACK, "backoff, no randomness"], [JIT, "backoff with full jitter"]] }
    ];
    const paint = () => {
      const fin = stage >= steps.length, st = steps[Math.min(stage, steps.length - 1)];
      const shown = [[FIX, "wait 1 s every time"], ...(stage > 0 ? steps[stage - 1].show : [])];
      el.innerHTML = `<h1>Spread the retries out</h1>
        <p class="lead">Same rush, same provider, two new rules. Predict, then see the simulation.</p>
        ${fin ? "" : `<p class="task">${st.q}</p>`}
        <div class="${P}strips">${shown.map(([r, n]) => strip(r, n)).join("")}</div>
        ${stripKey(kit)}
        <div class="lpanel">${fin ? "" : kit.options(st.opts.map(v => stage === 2 ? `about ${v} s` : fmt(v)), { picked: wrong == null ? null : st.opts.indexOf(wrong), correct: st.opts.indexOf(st.right), num: true })}
        ${wrong != null ? kit.feedback(st.bad(wrong), false) : stage > 0 ? kit.feedback(steps[stage - 1].ok(), true) : ""}
        ${fin ? `<div class="vars"><span>calls <b>${fmt(BACK.calls)} → ${fmt(JIT.calls)}</b></span><span>failed <b>${fmt(BACK.failed)} → ${fmt(JIT.failed)}</b></span><span>half served by <b>${sec(JIT.median_served_s)}</b></span></div>${RUN_NOTE}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = st.opts[+b.dataset.i];
        if (v !== st.right) { wrong = v; paint(); return; }
        wrong = null; stage++; paint();
        if (stage >= steps.length) done();
      });
    };
    paint();
  }

  /* ---------- 5. The retry loop as Python, a recorded run ---------- */
  const errShort = e => e ? e.replace("ProviderError(", "").replace(/\)$/, "") : "–";
  const NOJ = f => f.vars.err && f.vars.err.includes("ra=None");
  const GATE = TRACE.findIndex(f => f.line === 9 && NOJ(f));   // about to work out lim for the 503
  const GATE_K = TRACE[GATE].vars.k, GATE_CAP = 8.0, GATE_BASE = 0.5;   // cap and base: the listing's defaults
  const limFor = k => Math.min(GATE_CAP, GATE_BASE * 2 ** k);
  const GATE_LIMIT = limFor(GATE_K);
  const N_TRIES = 4, LAST_TRY = N_TRIES - 1;  // the listing's default n=4
  // provider calls made by step i: one per step on the except line (5), plus the call that returned
  const callsBy = i => TRACE.slice(0, i + 1).filter(s => s.line === 5 || s.event === "return").length;
  function sayStep(f, i, solved) {
    const v = f.vars, n = v.k, prev = TRACE[i - 1];
    if (f.event === "return") return `The provider answered 200, so <code>send</code> returns the translation and the function returns it. ${PCALLS.length} calls, ${sec(f.t)} in all.`;
    if (f.line === 2) return i === 0 ? `Start the loop: at most n = ${N_TRIES} attempts.` : `The wait is over (clock ${sec(f.t)}). Back to the top of the loop.`;
    if (f.line === 3) return `k = ${n}: attempt ${n + 1} of ${N_TRIES}.`;
    if (f.line === 4) return "Call the provider, with a 10 s timeout for this one call.";
    if (f.line === 5) return `The call failed, so <code>send</code> raised a ProviderError. The provider answered: ${kit_esc(PCALLS[n].attempt)}.`;
    if (f.line === 6) return `Is this the last attempt? k is ${n}, the last is ${LAST_TRY}.`;
    if (f.line === 7) return "<code>last</code> is False and <code>err.retry</code> is True: a retry can help. No raise.";
    if (f.line === 9) return i === GATE && !solved ? "No Retry-After on this one. Work out <code>lim</code>, then the wait." : `lim = min(8.0, 0.5 × 2<sup>${n}</sup>) = ${limFor(n).toFixed(1)}: the longest this wait may be.`;
    if (f.line === 10) return prev && prev.line === 11 ? "The random draw becomes <code>wait</code>." : NOJ(f) ? "<code>err.ra</code> is None: no Retry-After. Pick a wait." : "The provider sent Retry-After, so <code>wait</code> takes <code>err.ra</code>.";
    if (f.line === 11) return "<code>err.ra</code> is None, so <code>or</code> moves on to <code>uniform(0, lim)</code>, a random draw.";
    if (f.line === 12) return `Sleep ${sec(v.wait)}.`;
    return "";
  }
  function asCode({ el, done, kit }) {
    style();
    let i = 0, guess = null;
    const gopts = [`Exactly ${GATE_LIMIT.toFixed(1)} s: the loop waits lim`, `A random time between 0 and ${GATE_LIMIT.toFixed(1)} s`, `A random time between 0 and ${GATE_CAP.toFixed(1)} s`];
    const gright = 1;
    const paint = () => {
      const f = TRACE[i], v = f.vars, solved = guess === gright, gate = i === GATE && !solved;
      // wait is shown once line 12 is reached; while a new err is being handled the old value is stale
      const waitShown = v.wait != null && (!v.err || f.line === 12);
      const seen = PCALLS.slice(0, callsBy(i));
      el.innerHTML = `<h1>The retry loop in Python</h1>
        <p class="lead">This is the translator's retry function. <code>n</code> is the number of attempts; <code>k</code> counts them from 0. <code>send</code> makes one call and turns any failure into a <code>ProviderError</code>. On that error, <code>err.retry</code> says whether a retry can help (the screen 2 rule, simplified: it looks at the status code and the spend-cap message). <code>err.ra</code> is the Retry-After value, or None. We ran it against the stand-in provider. It answered 429 with Retry-After: 1, then 503, then 200.</p>
        <p class="task">Step through the run to the end. At the second wait, predict the wait before you step on.</p>
        ${kit.code(SRC, f.line)}
        <div class="vars"><span>k <b>${v.k ?? "–"}</b></span><span>wait <b>${waitShown ? sec(v.wait) : "–"}</b></span><span>clock <b>${sec(f.t)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        <div class="vars"><span>err <b>${kit.esc(errShort(v.err))}</b></span></div>
        ${kit.feedback(sayStep(f, i, solved))}
        ${gate ? `<div class="lpanel"><p class="task">The 503 came without Retry-After. k is ${GATE_K}, base 0.5, cap 8.0. What will <code>wait</code> be?</p>${kit.options(gopts.map(kit.esc), { picked: guess, correct: gright })}
          ${guess == null ? "" : guess === 0 ? kit.feedback(`lim is ${GATE_LIMIT.toFixed(1)}, but line 11 does not wait lim: it draws <code>uniform(0, lim)</code>, a random time below it. (The 1.0 s wait last time came from the 429's Retry-After, not from lim.)`, false)
            : kit.feedback(`8.0 is the cap, the most a wait can ever be. The limit for this attempt is smaller: 0.5 × 2<sup>${GATE_K}</sup> = ${GATE_LIMIT.toFixed(1)}, and min(8.0, ${GATE_LIMIT.toFixed(1)}) = ${GATE_LIMIT.toFixed(1)}.`, false)}</div>` : ""}
        ${i === GATE && solved ? kit.feedback(`Right: lim is min(8.0, 0.5 × 2<sup>${GATE_K}</sup>) = ${GATE_LIMIT.toFixed(1)}, and since <code>err.ra</code> is None, <code>or</code> moves on to <code>uniform(0, lim)</code>: a draw between 0 and ${GATE_LIMIT.toFixed(1)} s. Doubling the limit is the <b>exponential backoff</b>; drawing at random inside it is the <b>full jitter</b>; <code>cap</code> stops the doubling.`, true) : ""}
        <div class="${P}calls">${seen.map((c, j) => `<div>call ${j + 1} (k=${j}) at ${sec(c.at_s)}: ${kit.esc(c.attempt)}</div>`).join("")}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || gate ? "disabled" : ""}>Next step</button></div>
        <p class="${P}cap">Traced with sys.settrace on our Mac (trace_retry.py, seed 3), against standin.py.</p>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { guess = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* ---------- 6. Broken on purpose: retries that outlive the app ---------- */
  const APP_WAIT = 15, PER_TRY = 10, TRIES = 4, BASE = 0.5, CAP = 8, BUDGET = 12;
  const maxWaits = n => Array.from({ length: n - 1 }, (_, a) => Math.min(CAP, BASE * 2 ** a)).reduce((s, x) => s + x, 0);
  const WORST = TRIES * PER_TRY + maxWaits(TRIES);
  const ev = run => run.events.map(e => {
    const m = e.who === "provider call" && /took ([\d.]+) s/.exec(e.what);
    return { ...e, end: m ? e.at_s + +m[1] : null };
  });
  const EB = ev(RUN_BROKEN), EF = ev(RUN_FIXED);
  const LOST = EB.findIndex(e => e.who === "app" && /timed out/.test(e.what));
  const logRows = (rows, { pick = false, mark = {} } = {}) => rows.map((e, j) => {
    const tag = pick ? "button" : "div";
    return `<${tag}${pick ? ' type="button"' : ""} class="${P}row ${mark[j] || ""}" data-i="${j}"><span class="t">${e.end != null ? `${sec(e.at_s)}–<br>${sec(e.end)}` : sec(e.at_s)}</span><span class="w"><b>${kit_esc(e.who)}</b>${kit_esc(e.what)}</span></${tag}>`;
  }).join("");
  function broken({ el, done, kit }) {
    style();
    let clicked = null, cause = null, fix = null;
    const causes = [
      "The provider stalled for 30 seconds",
      "Nothing limits the total time of all attempts and waits",
      `The ${PER_TRY}-second timeout per attempt is too short`,
      "The translator should not retry timeouts at all"
    ];
    const causeRight = 1;
    const fixes = [
      `Make the app wait ${Math.ceil(WORST)} s instead of ${APP_WAIT} s`,
      `Give all attempts and waits one shared budget of ${BUDGET} s, under the app's ${APP_WAIT} s: each attempt gets at most the time left, and no wait starts that would end past the deadline`,
      "Set attempts to 1, so there is nothing to outlive"
    ];
    const fixRight = 1;
    const paint = () => {
      const lostOk = clicked === LOST, mark = {};
      if (clicked != null) mark[clicked] = lostOk ? "no" : "cur";
      if (lostOk) EB.forEach((e, j) => { if (j > LOST) mark[j] = "dim"; });
      el.innerHTML = `<h1>Broken on purpose: the answer nobody saw</h1>
        <p class="lead">Rush hour, with the jittered retry loop from screen 5 in place. The app's backend asks the translator and waits at most <b>${APP_WAIT} s</b>. The translator runs <code>with_retries</code>: up to ${TRIES} attempts, each cut off after ${PER_TRY} s. The stand-in provider is overloaded: it holds each of the first three calls for 30 s without answering, then answers the fourth at once. The app, the translator and the stand-in provider run on our Mac in one Python script, talking over real HTTP with real timeouts. This is their merged log.</p>
        <p class="task">${lostOk ? (cause !== causeRight ? "What is the cause?" : fix !== fixRight ? "Pick the fix." : "Compare the fixed run.") : "Tap the line where the customer was lost: after it, nothing the translator does can reach them."}</p>
        <div class="${P}log">${logRows(EB, { pick: !lostOk, mark })}</div>
        <p class="${P}cap">Printed by deadline_run.py broken (seed 11). The provider received ${RUN_BROKEN.provider_calls} calls.</p>
        <div class="lpanel">
        ${clicked != null && !lostOk ? kit.feedback(clicked < LOST
          ? (EB[clicked].who === "provider call" ? "That timeout is normal on a bad evening, and the translator still had time to try again. The customer was still waiting here." : "The customer is still waiting at this point. Look further down for the moment the app stops waiting.")
          : "By this point the customer was already gone. Look earlier: which line is the app giving up?", false) : ""}
        ${lostOk ? kit.feedback(`At ${sec(EB[LOST].at_s)} the app gave up and showed "Translation failed". The translator kept retrying for another ${sec(EB[EB.length - 1].at_s - EB[LOST].at_s)}, got a translation at ${sec(EB[EB.length - 1].at_s)}, and its last line says “${kit.esc(EB[EB.length - 1].what)}”. Nobody was listening. The provider still received ${RUN_BROKEN.provider_calls} calls for one menu nobody saw.`) : ""}
        ${lostOk ? `<div id="cause">${kit.options(causes.map(kit.esc), { picked: cause, correct: causeRight })}
          ${cause == null ? "" : cause === causeRight ? kit.feedback(`Right. Worst case with no Retry-After: ${TRIES} × ${PER_TRY} s + waits of up to ${maxWaits(TRIES).toFixed(1)} s = ${WORST.toFixed(1)} s. With a Retry-After it can be longer, because the loop waits whatever the provider asks. The app waits only ${APP_WAIT} s. Each setting looks reasonable alone; together they can outlive the caller. Retrying the timeout was right; doing it after the customer left was not.`, true)
            : cause === 0 ? kit.feedback("A stalled host is exactly what timeouts and retries exist for, and you cannot control it. The fourth call even worked. The problem is what your code did with the time.", false)
            : cause === 2 ? kit.feedback(`A longer timeout makes it worse: one attempt would eat the app's whole ${APP_WAIT} s. Each attempt is fine; the total is not limited.`, false)
            : kit.feedback("Retrying the timeout was right: the fourth call succeeded. It only happened too late for the customer.", false)}</div>` : ""}
        ${cause === causeRight ? `<div id="fix">${kit.options(fixes.map(kit.esc), { picked: fix, correct: fixRight })}
          ${fix == null ? "" : fix === fixRight ? kit.feedback(`Right. Same evening, same stalls, with a ${BUDGET} s budget:`, true)
            : fix === 0 ? kit.feedback(`That hides the problem behind a customer staring at a blank menu for ${Math.ceil(WORST)} s. The limit belongs in the translator, below what the caller will wait.`, false)
            : kit.feedback("Then the dropped connection and the 429 from screen 2 fail for no reason. Keep the retries; give them a total budget.", false)}</div>` : ""}
        ${fix === fixRight ? `<div class="${P}log">${logRows(EF)}</div>
          <p class="${P}cap">Printed by deadline_run.py fixed (seed 11). The provider received ${RUN_FIXED.provider_calls} calls.</p>
          ${kit.feedback(`At ${sec(EF[EF.length - 1].at_s)} the app got a clear 504 and shows "Try again", before its own ${APP_WAIT} s ran out, and the provider got ${RUN_FIXED.provider_calls} calls instead of ${RUN_BROKEN.provider_calls}. The second attempt was given only the time left. The fixed function, <code>with_deadline</code>, is <code>with_retries</code> plus a <code>budget=${BUDGET}</code> parameter and these lines (from retry.py; <code>now</code> is <code>time.monotonic</code>, a clock that only moves forward):`)}
          ${kit.code(SRC_FIXED, -1)}` : ""}
        </div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => { clicked = +b.dataset.i; paint(); });
      el.querySelectorAll("#cause .lopts button").forEach(b => b.onclick = () => { cause = +b.dataset.i; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === fixRight) done(); });
    };
    paint();
  }

  /* ---------- 7. Choose the settings ---------- */
  const NORMAL = 3; // the exercise's assumption: normal translations finish within 3 s (stated on screen as an assumption)
  const CONFIGS = [{ t: 2, a: 5, b: 12 }, { t: 4, a: 3, b: 12 }, { t: 10, a: 4, b: 12 }, { t: 6, a: 3, b: 18 }];
  const worst = c => Math.min(c.b, c.a * c.t + maxWaits(c.a));
  const fullTries = c => { let used = 0, n = 0; for (let a = 0; a < c.a; a++) { if (used + c.t > c.b) break; used += c.t + Math.min(CAP, BASE * 2 ** a); n++; } return n; };
  function settings({ el, done, kit }) {
    style();
    let ans = null;
    const correct = 1;
    const label = c => `timeout ${c.t} s per attempt, ${c.a} attempts, budget ${c.b} s`;
    const why = [
      c => `Each attempt is cut at ${c.t} s, but a normal translation can take up to ${NORMAL} s. Slow but healthy calls get cut off and sent again: more load on a provider that is already busy, and the slowest menus may never get through.`,
      c => `Right. ${c.t} s is above the normal ${NORMAL} s, with room for a slow call. The worst case is ${worst(c)} s, inside the app's ${APP_WAIT} s, so the app always hears back. Up to ${fullTries(c)} full attempts fit, enough for a 429 or a dropped connection.`,
      c => `The budget stops it at ${worst(c)} s, so the app hears back. But one stalled attempt eats ${c.t} of the ${c.b} s, which leaves room for just ${fullTries(c)} full attempt: the retries you configured mostly cannot happen.`,
      c => `The worst case is ${worst(c)} s, but the app gives up at ${APP_WAIT} s. That is screen 6 again: for the last ${worst(c) - APP_WAIT} s the translator works for nobody. The budget must end before the caller's wait does.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Pick the settings</h1>
        <p class="lead">The app waits ${APP_WAIT} s. Say the translator's own logs show that normal menu translations finish within <b>${NORMAL} s</b> (an assumed figure for this exercise; measure your own). A common way to choose a timeout is from a high percentile of normal latency (the time that, say, 99 of 100 normal calls finish within), plus a margin. Waits use base ${BASE} s, cap ${CAP} s, with jitter.</p>
        <p class="task">Which settings would you ship?</p>
        <div class="lpanel">${kit.options(CONFIGS.map(c => `<span class="${P}cfg">${kit.esc(label(c))}</span>`), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(why[ans](CONFIGS[ans]), ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 8. The big picture ---------- */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "The translator's call to the model came back 503 Overloaded",
      "An ordering agent's place_order tool call timed out, after the restaurant's system had already received it",
      "A model call came back 429 with Retry-After: 3"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>When to retry, and when not</h1>
        <p class="lead"><b>What it is for:</b> calls that fail for a moment (rate limited, overloaded, timed out, dropped) and are safe to send again.</p>
        <p class="lead"><b>Reach for it</b> on every model call a user waits for, with capped backoff, jitter, Retry-After honoured, and one deadline under the caller's wait.</p>
        <p class="lead"><b>Not for:</b> errors that will repeat (bad or too-large requests, no credits, spend caps); actions with side effects, unless each action carries a unique id so the receiver can spot and ignore a repeat (an <b>idempotency key</b>); retrying in several layers at once (your code and the library under it), which multiplies calls; long or bulk work, which belongs in a queue.</p>
        <p class="lead"><b>What it costs:</b> each retry is one more call, sent while the provider is already struggling, and one more to pay for if the model runs it; jitter makes some users wait longer; a deadline turns some late successes into fast failures.</p>
        <p class="task">Which one should NOT simply be retried as it is?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. A retry could place the order twice: the first call may have worked and only the answer was lost. Retry it only if the restaurant's system accepts an idempotency key and ignores a repeat with the same key; otherwise check the order's status first.", true)
          : ans === 0 ? kit.feedback("Overloaded is temporary, and a translation has no side effect. Retry with backoff and jitter.", false)
          : kit.feedback("The provider told you when to come back. Wait 3 s and retry; that is the safest retry there is.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* ---------- 9. Recognise it ---------- */
  const CASES = [
    { s: "A support bot's embedding call fails about once in 200 with a dropped connection, and each failure shows the user an error page.", yes: true,
      r: "Yes. A dropped connection is passing, and an embedding call has no side effect. One or two retries with jittered backoff, inside the request's deadline, hide it from users.",
      w: "This is the classic case: a passing network failure on a call that is safe to repeat. Retry it a couple of times with jittered backoff, inside the deadline." },
    { s: "Since a partner rotated their API key, every request from their integration gets 401. Their team asks you to add more retries.", yes: false,
      r: "Right, retries do not help. A 401 says the key is wrong, and it will be wrong on every retry. Retrying only multiplies failed calls and delays the real alarm. Fail fast and tell the partner to update the key.",
      w: "A 401 means the key is wrong, and it stays wrong on every retry. More retries only multiply failed calls and hide the alarm. Fail fast and get the key updated." },
    { s: "Thousands of shop kiosks restart at 06:00 and all reconnect to the menu service in the same second. The service falls over every morning.", yes: true,
      r: "Yes, the jitter half of the idea. Equal timing makes them arrive as one wave, like the 1 s retries. A random delay before reconnecting spreads them over a minute.",
      w: "It is the same wave as the 1 s retries: everyone acts at the same moment. A random delay before each kiosk reconnects (jitter) spreads them out." }
  ];
  function recognise({ el, done, kit }) {
    style();
    const picked = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Retries and jitter, or not?</h1>
        <p class="task">For each situation: do retries with backoff and jitter help?</p>
        ${CASES.map((c, k) => `<div id="c${k}" class="lcase"><p>${kit.esc(c.s)}</p>${kit.options(["Yes, they help", "No, something else"], { picked: picked[k], correct: c.yes ? 0 : 1 })}
          ${picked[k] == null ? "" : (picked[k] === 0) === c.yes ? kit.feedback(c.r, true) : kit.feedback(c.w, false)}</div>`).join("")}`;
      CASES.forEach((c, k) => el.querySelectorAll(`#c${k} .lopts button`).forEach(b => b.onclick = () => {
        picked[k] = +b.dataset.i; paint();
        if (CASES.every((d, j) => picked[j] === (d.yes ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* ---------- 10. What next ---------- */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can now make a model call survive the rush</h1>
      <p class="lead">Retry only what can succeed later: rate limits, overload, timeouts, dropped connections. Fail fast on the rest. Honour <code>Retry-After</code>. Otherwise wait a random time under a doubling, capped limit, so retries spread out instead of arriving in waves. Give every attempt and wait one shared deadline, under what the caller will wait. Never blindly retry an action with side effects.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson. You write <code>should_retry</code> for the calls in the screen 2 log and a <code>backoff_wait</code> with full jitter and a deadline, and check them against the runs in this lesson.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Some work cannot fit any deadline a person will wait for; there you move it off the request into a queue, with the same safe retries.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Timeouts, retries and backoff for model calls",
    checked: "2026-11-13",
    sources: [
      "https://openrouter.ai/docs/api-reference/errors",
      "https://platform.claude.com/docs/en/api/errors",
      "https://platform.claude.com/docs/en/api/rate-limits",
      "https://github.com/openai/openai-python",
      "https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter",
      "https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/",
      "https://www.rfc-editor.org/rfc/rfc6585.html"
    ],
    interview: [{
      q: "Your LLM feature fails every evening with 429 errors. A teammate added retries and it got worse. What happened, and what do you change?",
      good: ["Retries sent at once, or after the same fixed wait, arrive in waves and multiply the load at the worst moment",
        "Honour Retry-After; otherwise use capped exponential backoff with full jitter so retries spread out",
        "Cap the attempts and give all of them one deadline that ends before the caller gives up",
        "Retry only what can succeed later (429, overload, timeouts, dropped connections), and read the message: a spend-cap 429 or a 400 will not",
        "Retry in one layer only, and look at the real fix too: pacing bulk traffic, caching, or a higher limit"],
      weak: "Raise max_retries to 10 so more calls eventually get through, without waits, jitter or a deadline."
    }, {
      q: "A product manager wants the model-call timeout set to 60 seconds so that slow answers still arrive. How do you choose the timeout and retry settings?",
      good: ["Start from what the caller waits: the whole retry budget must end before it",
        "Set the per-attempt timeout from a high percentile of normal latency, plus a margin, from your own measurements",
        "Leave room for at least one or two retries inside the budget",
        "SDK defaults can be very long, so set your own timeout and retry count explicitly",
        "If answers are really long, stream them or move the work to a background job instead of stretching the timeout"],
      weak: "Use one big timeout so nothing ever times out, without asking how long the user or the gateway in front will wait."
    }],
    screens: [situation, byHand, spotIdea, predict, asCode, broken, settings, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(DECIDE.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: [...Array(GATE).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]", ...Array(TRACE.length - 1 - GATE).fill("[data-next]")] },
      { wrong: ['[data-i="2"]'], right: [`[data-i="${LOST}"]`, "#cause [data-right]", "#fix [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
