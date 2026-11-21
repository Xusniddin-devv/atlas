/* Lesson: A/B testing an AI feature on real users. Story: a recipe site tests whether AI-written summaries
   above its search results make people cook more (start cook mode, the step-by-step view).
   Ideas: (1) write the decision rule before any data: one main metric, guardrail metrics with limits, a fixed
   stopping day; then read each 95% interval against that plan (a failed guardrail is a veto; looking every day
   and stopping on a good day finds wins that are noise; a first-week bonus can fade); (2) when an offline
   evaluation is enough and when only users can answer.
   Data, all real runs or recordings:
   - recordings (main checkout) docs/ai-path/recordings/s7-ab-test-ai/summary-v1 and summary-v2: the summary a
     small hosted model wrote for the same search with the first and the fixed prompt;
   - docs/ai-path/runs/s7-ab-test-ai/simulate_test.py + .out.txt: the two 14-day tests. The searchers are
     SIMULATED (seed 0), with the effects listed in the script's docstring;
   - read_results.py + .out.txt: every readout, the traced diff_ci shown on the code screen, a bootstrap check,
     and the sample size from Kohavi et al. 2007;
   - peeking_aa.py + .out.txt: 2000 simulated A/A tests read once versus every day.
   Lesson-local pictures and style (.lx-s7-ab-test-ai-*): a search-page mock, and an interval plot (bar = 95%
   interval, ring = measured difference, solid line at 0, dashed line at a guardrail's limit) on one shared
   scale; see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s7-ab-test-ai";
  const P = `lx-${ID}-`;
  const fmt = n => n.toLocaleString("en");

  /* ---------- Data copied from the recordings ---------- */
  // From docs/ai-path/recordings/s7-ab-test-ai/summary-v1.request.json (the user message; result 1's method sentence left out)
  const QUERY = "egg-free pancakes";
  const RESULTS = [
    ["Fluffy Banana Pancakes", "2 ripe bananas, 1 cup oat flour, 1 cup oat milk, 1 tsp baking powder, pinch of salt", "20 minutes"],
    ["Classic Buttermilk Pancakes", "2 cups flour, 2 eggs, 2 cups buttermilk, 3 tbsp melted butter, 2 tsp baking powder, 1 tbsp sugar", "25 minutes"],
    ["Savory Chickpea Flour Pancakes", "1 cup chickpea flour, 1 cup water, 1/2 tsp salt, 2 spring onions. No eggs needed.", "15 minutes"]
  ];
  // From docs/ai-path/recordings/s7-ab-test-ai/summary-v1.json (not trimmed, not altered)
  const REC_V1 = {
    src: "s7-ab-test-ai/summary-v1",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    text: "These egg-free pancake recipes offer quick and delicious options for breakfast or brunch. You can choose from fluffy banana pancakes made with oat flour in 20 minutes, or savory chickpea flour pancakes ready in just 15 minutes."
  };
  // From docs/ai-path/recordings/s7-ab-test-ai/summary-v2.json (not trimmed, not altered)
  const REC_V2 = {
    src: "s7-ab-test-ai/summary-v2",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    text: "Fluffy Banana Pancakes are made with oat flour and oat milk and take 20 minutes. Savory Chickpea Flour Pancakes use chickpea flour and water, require no eggs, and are ready in 15 minutes. Classic Buttermilk Pancakes contain eggs and take 25 minutes."
  };
  const CAPTION = `Recorded model output, ${REC_V1.recordedAt}`;
  const V1_OPENING = "These egg-free pancake recipes";

  /* ---------- Data copied from the runs (docs/ai-path/runs/s7-ab-test-ai/read_results.out.txt) ---------- */
  // Counts per group: searchers, and how many of them did each thing in the 24 hours after their first search.
  const V1 = { A: { users: 48702, cooked: 9019, slow: 1480, reported: 322, no_recipe: 10750 }, B: { users: 48776, cooked: 9367, slow: 1785, reported: 700, no_recipe: 11703 } };
  const V2_DAY4 = { A: { users: 13102, cooked: 2195, slow: 345, reported: 76, no_recipe: 2978 }, B: { users: 13001, cooked: 2433, slow: 424, reported: 76, no_recipe: 2987 } };
  const V2_W1 = { A: { users: 24419, cooked: 4455, slow: 689, reported: 144, no_recipe: 5382 }, B: { users: 24213, cooked: 4809, slow: 816, reported: 161, no_recipe: 5399 } };
  const V2_W2 = { A: { users: 24351, cooked: 4569, slow: 706, reported: 145, no_recipe: 5349 }, B: { users: 24119, cooked: 4731, slow: 790, reported: 156, no_recipe: 5458 } };
  const V2 = { A: { users: 48770, cooked: 9024, slow: 1395, reported: 289, no_recipe: 10731 }, B: { users: 48332, cooked: 9540, slow: 1606, reported: 317, no_recipe: 10857 } };
  const DAYS = 14, DAY4 = 4; // test length; days in the early readout (simulate_test.py: day 0 is a Monday)
  const isWeekend = d => d % 7 === 5 || d % 7 === 6;
  const BOOT = [0.76, 1.70]; // read_results.out.txt: bootstrap 95% range of v2's main metric, in points
  // From peeking_aa.out.txt
  const AA = { tests: 2000, once: 119, daily: 486, first: [113, 59, 61, 45, 32, 35, 30, 19, 16, 15, 15, 15, 15, 16] };
  // diff_ci from read_results.py, line for line (line 0 = def), and its trace on V2's main metric
  const CODE = [
    "def diff_ci(cooked_a, users_a, cooked_b, users_b):",
    "    rate_a = cooked_a / users_a",
    "    rate_b = cooked_b / users_b",
    "    diff = rate_b - rate_a",
    "    var_a = rate_a * (1 - rate_a) / users_a",
    "    var_b = rate_b * (1 - rate_b) / users_b",
    "    se = (var_a + var_b) ** 0.5",
    "    low = diff - 1.96 * se",
    "    high = diff + 1.96 * se",
    "    return diff, low, high"
  ];
  const ARGS = { cooked_a: 9024, users_a: 48770, cooked_b: 9540, users_b: 48332 };
  // [line about to run, event, variable set by the line before, its value]
  const TRACE = [[1, "line", null, null], [2, "line", "rate_a", 0.18503178183309413], [3, "line", "rate_b", 0.19738475544152942],
    [4, "line", "diff", 0.012352973608435291], [5, "line", "var_a", 3.0919627136511053e-06], [6, "line", "var_b", 3.277828638600038e-06],
    [7, "line", "se", 0.002523844557862299], [8, "line", "low", 0.007406238275025186], [9, "line", "high", 0.017299708941845397],
    [9, "return", null, null]];

  /* ---------- The plan and the arithmetic ---------- */
  const METRICS = [
    { key: "cooked", name: "Started cook mode", main: true },
    { key: "slow", name: "Search page took over 2 s", limit: 1.0 },
    { key: "reported", name: "Pressed “report a problem”", limit: 0.2 },
    { key: "no_recipe", name: "Opened no recipe", limit: 2.0 }
  ];
  const MAIN = METRICS[0];
  // The same arithmetic as diff_ci, in points (percentage points)
  function ci(t, key) {
    const ra = t.A[key] / t.A.users, rb = t.B[key] / t.B.users, d = rb - ra;
    const se = Math.sqrt(ra * (1 - ra) / t.A.users + rb * (1 - rb) / t.B.users);
    return { a: 100 * ra, b: 100 * rb, d: 100 * d, lo: 100 * (d - 1.96 * se), hi: 100 * (d + 1.96 * se) };
  }
  const pt = v => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(2)}`;
  const lim = m => `+${m.limit.toFixed(1)}`;
  const pc = v => `${v.toFixed(2)}%`;
  const VERDICTS = ["Passes", "Fails", "Can't tell yet"];
  // main: passes if the whole interval is above 0; guardrail: passes if it stays inside the limit
  const verdict = (m, c) => m.main ? (c.lo > 0 ? 0 : c.hi < 0 ? 1 : 2) : (c.hi <= m.limit ? 0 : c.lo > m.limit ? 1 : 2);
  const usersOf = t => t.A.users + t.B.users;
  // Sample size, Kohavi et al. 2007: n = (4 r sigma / delta)^2, r groups, sigma = sqrt(p(1 - p)) for a yes/no metric
  const sampleSize = (p, delta) => Math.pow(4 * 2 * Math.sqrt(p * (1 - p)) / delta, 2);
  const P_CTRL = V1.A.cooked / V1.A.users;
  const WEEKLY = usersOf(V1) / 2;

  /* ---------- Lesson-local style and pictures ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .${P}page { margin: 16px 0 0; border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px; background: var(--surface); }
      .${P}q { font: 500 14.5px/1.4 var(--mono); color: var(--muted); }
      .${P}sum { margin: 10px 0 8px; padding: 10px 12px; background: var(--sunk); border-left: 3px solid var(--ink); font-size: 15.5px; line-height: 1.5; }
      .${P}lab { display: block; margin-bottom: 4px; font: 600 12.5px/1.3 var(--mono); text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
      .${P}res { padding: 8px 0; border-top: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .${P}res b { font-weight: 600; }
      .${P}res span { color: var(--ink-2); }
      .${P}cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}iv { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .${P}row { padding: 10px 0 8px; border-bottom: 1px solid var(--line); }
      .${P}head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 12px; font-size: 15.5px; line-height: 1.4; }
      .${P}head b { font-weight: 600; }
      .${P}num { font: 500 14px/1.4 var(--mono); color: var(--ink); }
      .${P}sub { font-size: 13.5px; color: var(--muted); }
      .${P}track { position: relative; height: 30px; margin: 4px 0 0; }
      .${P}track i { position: absolute; display: block; }
      .${P}ax { left: 0; right: 0; top: 15px; border-top: 1px solid var(--line); }
      .${P}z { top: 2px; bottom: 2px; border-left: 2px solid var(--muted); }
      .${P}lim { top: 0; bottom: 0; z-index: 2; border-left: 2px dashed var(--ink-2); }
      .${P}bar { top: 11px; height: 9px; background: var(--ink); border-radius: 2px; }
      .${P}dot { top: 9px; z-index: 1; width: 13px; height: 13px; margin-left: -6.5px; border-radius: 50%; background: var(--surface); border: 3px solid var(--ink); box-sizing: border-box; }
      .${P}scale { position: relative; height: 18px; font: 500 12px/18px var(--mono); color: var(--muted); }
      .${P}scale span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
      .${P}legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 10px 0 0; font-size: 13.5px; color: var(--ink-2); }
      .${P}legend span { display: inline-flex; align-items: center; gap: 6px; }
      .${P}legend i { display: inline-block; }
      .${P}lb { width: 22px; height: 9px; background: var(--ink); border-radius: 2px; }
      .${P}ld { width: 15px; height: 15px; border-radius: 50%; border: 3px solid var(--ink); box-sizing: border-box; background: var(--surface); }
      .${P}lz { width: 0; height: 16px; border-left: 2px solid var(--muted); }
      .${P}ll { width: 0; height: 16px; border-left: 2px dashed var(--ink-2); }
      .${P}verdict { font: 600 13px/1.4 var(--mono); text-transform: uppercase; letter-spacing: .04em; }
      .${P}plan { margin: 10px 0 0; padding-left: 20px; }
      .${P}plan li { margin: 4px 0; }
      .${P}formula { font: 500 15px/1.5 var(--mono); }
    `;
    document.head.appendChild(s);
  }

  function searchPage(kit, rec) {
    return `<div class="${P}page" aria-label="The search page in group B">
      <div class="${P}q">Search: ${kit.esc(QUERY)}</div>
      <div class="${P}sum"><span class="${P}lab">AI summary</span>${kit.esc(rec.text)}</div>
      ${RESULTS.map(([t, ing, time], i) => `<div class="${P}res"><b>${i + 1}. ${kit.esc(t)}</b> · ${kit.esc(time)}<br><span>${kit.esc(ing)}</span></div>`).join("")}
    </div><p class="${P}cap">${CAPTION}</p>`;
  }

  // Interval plot on one shared scale, in points. rows: [{ m, c, title?, note? }]
  const LO = -1, HI = 3;
  const pos = v => Math.max(0, Math.min(100, (v - LO) / (HI - LO) * 100));
  function legend(withLimit) {
    return `<div class="${P}legend" aria-hidden="true"><span><i class="${P}lb"></i>95% interval</span><span><i class="${P}ld"></i>measured difference</span><span><i class="${P}lz"></i>0: no change</span>${withLimit ? `<span><i class="${P}ll"></i>guardrail limit</span>` : ""}</div>`;
  }
  function ivPlot(kit, rows) {
    const ticks = [-1, 0, 1, 2, 3];
    return `<div class="${P}iv">${rows.map(({ m, c, title, note }) => `<div class="${P}row" aria-label="${kit.esc(`${title || m.name}: difference ${pt(c.d)} points, interval ${pt(c.lo)} to ${pt(c.hi)}${m.main ? "" : `, limit ${lim(m)}`}`)}">
        <div class="${P}head"><b>${kit.esc(title || m.name)}</b><span class="${P}num">${pt(c.d)} [${pt(c.lo)}, ${pt(c.hi)}]</span></div>
        <div class="${P}sub">A ${pc(c.a)} · B ${pc(c.b)} · ${m.main ? "main metric: must rise" : `guardrail: limit ${lim(m)}`}${note ? ` · ${note}` : ""}</div>
        <div class="${P}track"><i class="${P}ax"></i><i class="${P}z" style="left:${pos(0)}%"></i>${m.main ? "" : `<i class="${P}lim" style="left:${pos(m.limit)}%"></i>`}<i class="${P}bar" style="left:${pos(c.lo)}%;width:${pos(c.hi) - pos(c.lo)}%"></i><i class="${P}dot" style="left:${pos(c.d)}%"></i></div>
      </div>`).join("")}
      <div class="${P}scale" aria-hidden="true">${ticks.map(t => `<span style="left:${Math.min(96, Math.max(4, pos(t)))}%">${t > 0 ? "+" : t < 0 ? "−" : ""}${Math.abs(t)}</span>`).join("")}</div>
      <p class="${P}cap">B − A, in points</p></div>`;
  }
  const rowsOf = t => METRICS.map(m => ({ m, c: ci(t, m.key) }));

  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* 1. The situation: pick the main metric. */
  function mainMetric({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Share of summaries that get a thumbs-up",
      "Recipe clicks per search",
      "Share of searchers who start cook mode on a recipe within 24 hours",
      "Time spent on the site"
    ];
    const RIGHT = 2;
    const fb = [
      ["Only group B sees a summary, so group A has no number to compare with. And liking a summary is not cooking: a pleasant summary can still send people to the wrong recipe.", false],
      ["Clicks can move the wrong way for a good reason: a good summary helps people pick the right recipe with fewer clicks. More clicks can also mean people are hunting. Neither is cooking.", false],
      ["Right. It exists in both groups, it is counted per person, and it is the closest thing to cooking the site can see. It is still a stand-in: the site cannot see a stove. The one number that decides is the <b>main metric</b> (also called the primary metric).", true],
      ["Time can rise for bad reasons too: a confusing summary makes people read longer. A number whose good direction you cannot name in advance cannot decide anything.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Do summaries make people cook?</h1>
        <p class="lead">A recipe website wants a short summary above its search results. A small hosted model writes it from the results the search found. One it wrote for a test search:</p>
        ${searchPage(kit, REC_V1)}
        <p class="lead">A golden set can tell you whether a summary is right. The team's question is different: do people cook more with summaries? Only real users can answer that. So for the same days, half of the searchers see summaries (group B) and the other half do not (group A). Then the team compares the two groups. That is an <b>A/B test</b>.</p>
        <p class="lead">The site cannot see anyone cook. The closest sign it has is <b>cook mode</b>, the step-by-step view of a recipe that people open when they start cooking.</p>
        <p class="task">Which one number should decide whether summaries ship?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Guardrails, then the written plan. */
  const GUARDS = [
    ["Share of searchers who saw a search page take more than 2 seconds", true,
      "Yes. Writing the summary is a model call on the way to the page. A slower page loses people before they read anything.",
      "Writing the summary adds a model call on the way to the page. If pages get slower, some people leave before they read anything. That harm can hide behind a rising main metric."],
    ["Share of searchers who press “report a problem” on the search page", true,
      "Yes. A summary can state a wrong fact about food, like an ingredient a recipe does not have. Reports are how users tell you.",
      "A summary can state a wrong fact about food. People who notice press “report a problem”. A rise there is harm the cook-mode number does not show."],
    ["Share of searchers who open no recipe at all", true,
      "Yes. The site earns from its recipe pages. If the summary answers enough that people leave without opening one, the site loses those visits.",
      "The site earns from its recipe pages. A summary that says enough for people to leave without opening a recipe costs the site visits, even if cook mode rises."],
    ["Words per summary", false,
      "That describes what group B was shown, not what happened to anyone. Group A has no summaries, so there is nothing to compare, and length is not harm by itself.",
      "Right. It describes the change itself, not people. Group A has no summaries to compare it with."]
  ];
  function guardrails({ el, done, kit }) {
    ensureStyle();
    const ans = GUARDS.map(() => null);
    const right = g => g[1] ? 0 : 1;
    const allRight = () => GUARDS.every((g, i) => ans[i] === right(g));
    const plan = () => `<p>The plan, written down before the test starts. A <b>point</b> is a percentage point: from 18% to 19% is +1 point.</p><ul class="${P}plan">
        <li>Split by user: a hash of the user id picks the group, so a person sees the same version on every visit.</li>
        <li>Run ${DAYS} days: two full weeks, so every weekday appears twice.</li>
        <li>Main metric passes if its whole 95% interval is above 0.</li>
        ${METRICS.filter(m => !m.main).map(m => `<li>${kit.esc(m.name)}: may get worse by at most ${lim(m)} points.</li>`).join("")}
      </ul>`;
    const paint = () => {
      el.innerHTML = `<h1>What must not get worse?</h1>
        <p class="lead">A change can win on its main metric and still hurt something else. So the team also lists what must not get worse, each with a limit agreed now, before any data. These are <b>guardrail metrics</b>.</p>
        <p class="task">Which of these should be a guardrail? Pick again if you change your mind.</p>
        ${GUARDS.map(([q, y, yes, no], i) => `<div class="lcase" id="g${i}"><p>${kit.esc(q)}</p>${kit.options(["Guardrail", "Not a guardrail"], { picked: ans[i], correct: right(GUARDS[i]) })}${ans[i] == null ? "" : kit.feedback(y ? (ans[i] === 0 ? yes : no) : (ans[i] === 1 ? no : yes), ans[i] === right(GUARDS[i]))}</div>`).join("")}
        ${allRight() ? kit.feedback(plan()) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (allRight()) done();
      }));
    };
    paint();
  }

  /* 3. By hand: judge each row of the first test's table against the plan. */
  function rowText(m, c, v, picked) {
    const L = m.main ? "0" : lim(m), R = `${pt(c.lo)} to ${pt(c.hi)}`;
    if (picked === v) {
      if (m.main) return [`${VERDICTS[v]}: the whole interval, ${R}, is ${v === 0 ? "above" : v === 1 ? "below" : "on both sides of"} 0.`, true];
      return [[`Passes: worse by ${pt(c.d)} points, but the whole interval stays inside the ${L} limit. Worse is allowed up to the limit; that is why the limit was written down.`,
        `Fails: the whole interval, ${R}, is past the ${L} limit.`,
        `Can't tell yet: the interval, ${R}, crosses the ${L} limit. The true change could be on either side of it.`][v], true];
    }
    if (m.main) {
      if (v === 0) return [picked === 1 ? `Fails would need the whole interval below 0. This one runs from ${R}: all above 0.` : `Can't tell means the interval crosses 0. This one, ${R}, stays entirely above 0, so the rise is very likely real.`, false];
      return [`Look where the interval sits: ${R}, against the line at 0.`, false];
    }
    const k = `${v}${picked}`;
    const T = {
      "01": `It did get worse (${pt(c.d)} points), but the limit agreed before the test is ${L}. The whole interval, up to ${pt(c.hi)}, stays inside it. Worse is not the same as failing.`,
      "02": `The interval, ${R}, never reaches the ${L} limit, so you can tell: it stays inside.`,
      "10": `Even the low end, ${pt(c.lo)}, is past the ${L} limit. The whole interval is beyond what the team accepted.`,
      "12": `Can't tell would need the interval to cross the limit. Here even the low end, ${pt(c.lo)}, is past ${L}. More data would only narrow it around a value that is already too high.`,
      "20": `The high end, ${pt(c.hi)}, is past the ${L} limit. The true change could be beyond it.`,
      "21": `The low end, ${pt(c.lo)}, is inside the ${L} limit. The true change could be on either side of it.`
    };
    return [T[k], false];
  }
  function readTable({ el, done, kit }) {
    ensureStyle();
    const rows = rowsOf(V1);
    const ans = rows.map(() => null);
    const allRight = () => rows.every((r, i) => ans[i] === verdict(r.m, r.c));
    const paint = () => {
      el.innerHTML = `<h1>Two weeks later: read the table</h1>
        <p class="lead">${fmt(usersOf(V1))} searchers took part: ${fmt(V1.A.users)} in A, ${fmt(V1.B.users)} in B. (These searchers are simulated; the counts come from a run.) Each row shows the share in A and in B, then the difference B − A in points.</p>
        <p class="lead">The two numbers in brackets are the <b>95% interval</b> of that difference. It is built so that in 95 of 100 such tests it contains the true difference, like the error bars by resampling in an earlier lesson. Each guardrail counts something bad, so for a guardrail a plus means B is worse.</p>
        ${legend(true)}
        ${ivPlot(kit, rows)}
        <p class="task">Judge each row against the plan: main metric above 0, each guardrail inside its limit.</p>
        ${rows.map((r, i) => `<div class="lcase" id="r${i}"><p><b>${kit.esc(r.m.name)}</b> ${pt(r.c.d)} [${pt(r.c.lo)}, ${pt(r.c.hi)}]${r.m.main ? "" : `, limit ${lim(r.m)}`}</p>${kit.options(VERDICTS, { picked: ans[i], correct: verdict(r.m, r.c) })}${ans[i] == null ? "" : kit.feedback(...rowText(r.m, r.c, verdict(r.m, r.c), ans[i]))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (allRight()) done();
      }));
    };
    paint();
  }

  /* 4. By hand: the main metric rose, a guardrail failed. Decide. */
  function decideV1({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const rows = rowsOf(V1);
    const v = rows.map(r => verdict(r.m, r.c));
    const failed = rows.find((r, i) => !r.m.main && v[i] === 1);
    const unsure = rows.find((r, i) => !r.m.main && v[i] === 2);
    const rep = ci(V1, "reported");
    const times = (rep.b / rep.a).toFixed(1);
    const opts = [
      "Ship: the main metric won, and that was the goal",
      "Keep running two more weeks to settle the row that can't tell yet",
      "Turn the summaries off, fix what drew the reports, and run a new test",
      "Ship, and remove the report button from the search page"
    ];
    const RIGHT = 2;
    const fb = [
      [`The limits were agreed before the test so that this argument does not happen now. B pressed “report a problem” ${times} times as often as A (${pc(rep.b)} against ${pc(rep.a)}), and the whole interval is past the limit. More cooking does not cancel telling people wrong things about their food.`, false],
      [`More data mostly narrows an interval around where it already sits. The reports interval is already entirely past its limit, so two more weeks only confirm the failure, while half the searchers keep seeing the summaries that drew the reports. The row that can't tell does not matter now: one failed guardrail already decides.`, false],
      [`Right. In this team's plan, a guardrail past its limit is a <b>veto</b>: on its own it blocks shipping, whatever the main metric says. The team agreed that in advance. The recorded summary above shows one way it goes wrong: it opens with “${kit.esc(V1_OPENING)}” while result 2 lists 2 eggs. It never says result 2 is egg-free, but a reader can take it that way. The team rewrites the prompt: use only facts written in the results, and say when a result does not match the search. A fixed version is a new change, so it gets a new test. (Some teams treat a failed guardrail as a trade-off to weigh, not an automatic veto. This team wrote the veto into its plan, and wrong food facts are not worth a little more cooking.)`, true],
      ["That makes the guardrail number look better without making a single summary less wrong. People who would have reported a problem now meet it at the stove. A guardrail you can switch off protects nothing.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Ship, roll back, or keep running?</h1>
        <p class="lead">Your reading: ${rows.map((r, i) => `${kit.esc(r.m.name.toLowerCase())} <b>${VERDICTS[v[i]].toLowerCase()}</b>`).join(", ")}. The main metric rose, and the guardrail <b>${kit.esc(failed.m.name.toLowerCase())}</b> failed.</p>
        ${searchPage(kit, REC_V1)}
        <p class="lead">That is the summary group B saw for this search, above the same three results. The row <b>${kit.esc(unsure.m.name.toLowerCase())}</b> is still open.</p>
        <p class="task">What does the team do?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Spot the idea: day 4 of the second test looks great. */
  function dayFour({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const c = ci(V2_DAY4, "cooked");
    const weekendDays = Array.from({ length: DAY4 }, (_, d) => d).filter(isWeekend).length;
    const opts = [
      "Agree: the interval is above 0, so the win is real",
      `Keep it running to day ${DAYS} as planned`,
      "Stop the test: an effect this big must be a bug",
      "Add five more metrics to the dashboard to be sure"
    ];
    const RIGHT = 1;
    const fb = [
      [`The 95% promise holds for one look at a size fixed in advance. Look every day and stop on the first good day, and noise gets ${DAYS} chances to cross the line instead of one. The next screen measures how often that fools you.`, false],
      [`Right. The 95% promise holds only for the one look you planned. Stop on the first good day, and noise gets ${DAYS} chances instead of one. There are two more reasons to wait. First, ${weekendDays === 0 ? `none of these ${DAY4} days was a Saturday or Sunday` : `only ${weekendDays} of these ${DAY4} days fell on a weekend`}, and people cook differently at weekends. Second, the summary box is new: regular visitors try it out of curiosity, and that early burst often fades once they are used to it. This is the idea of the lesson: <b>decide the main metric, the guardrail limits and the stopping day before you see data, then read each interval against that plan.</b>`, true],
      ["A big early effect is not a sign of a bug: people often try a new thing more in its first days. You would check the logging, but stopping throws away the test you planned.", false],
      ["Every extra metric is another chance for noise to look like a finding. Five more rows make it more likely that one of them “wins” by chance, and they do not answer whether day 4 is too early.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Day ${DAY4}: ship early?</h1>
        <p class="lead">The fixed prompt, on the same search, answered:</p>
        ${searchPage(kit, REC_V2)}
        <p class="lead">Same plan, new test: ${DAYS} days, split by user. On day ${DAY4} the dashboard shows the main metric (${fmt(usersOf(V2_DAY4))} searchers so far):</p>
        ${legend(false)}
        ${ivPlot(kit, [{ m: MAIN, c }])}
        <p class="lead">The product lead: “The interval is well above 0. Ship it today and save ${DAYS - DAY4} days.”</p>
        <p class="task">What do you answer?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Predict: how often do daily looks fool you when nothing changed? */
  function peeking({ el, done, kit }) {
    ensureStyle();
    let step = 0, wrong = null;
    const BINS = [["about 1 in 100", 0.01], ["about 1 in 20", 0.05], ["about 1 in 4", 0.25], ["about 1 in 2", 0.5]];
    const share = [AA.once / AA.tests, AA.daily / AA.tests];
    const nearest = x => BINS.reduce((b, [, v], i) => Math.abs(v - x) < Math.abs(BINS[b][1] - x) ? i : b, 0);
    const right = share.map(nearest);
    const early = AA.first.slice(0, DAY4).reduce((a, b) => a + b, 0);
    const pct = k => `${(Math.round(k * 1000 / AA.tests) / 10).toFixed(1)}%`; // from counts, so 119/2000 reads 6.0% as in the run
    const FB = [
      { 0: "Too rare. A 95% interval is built to leave out 0 by chance about 5 times in 100 when nothing changed. That is the price of 95%.",
        2: "Too often for one look. With one look at a size fixed in advance, the 95% interval keeps its promise: false wins about 5 times in 100.",
        3: "Far too often for one look. If half of all no-change tests “won”, a 95% interval would be useless. One planned look keeps false wins near 5 in 100." },
      { 0: "Daily looks can only add false wins, never remove them: every day the interval leaves out 0 by chance counts, and reader 2 keeps the first one.",
        1: `That is the rate for one look. Reader 2 gets ${DAYS} looks, and the first lucky one ends the test. Each look is another chance.`,
        3: "More than one look adds false wins, but the looks are not independent: tomorrow's totals contain today's. So the rate climbs well above 1 in 20 but not to a coin flip." }
    ];
    const paint = () => {
      const q = step < 2 ? (step === 0 ? `Reader 1 looks once, on day ${DAYS}. In what share of the ${fmt(AA.tests)} tests does the interval leave out 0?` : `Reader 2 looks every day and stops at the first day the interval leaves out 0. In what share of tests does reader 2 declare a winner?`) : "";
      el.innerHTML = `<h1>How often does looking every day fool you?</h1>
        <p class="lead">To measure what daily looks cost, simulate ${fmt(AA.tests)} <b>A/A tests</b>: group B gets exactly what A gets, so every “win” is noise. Same traffic, same cook rates, ${DAYS} days. Two readers read the same tests with the same interval. A reader calls a “winner” when the interval leaves out 0.</p>
        ${step >= 1 ? kit.feedback(`Reader 1: ${fmt(AA.once)} of ${fmt(AA.tests)} tests (${pct(AA.once)}) showed a “winner”. That is what 95% means: about 1 false win in 20.`, true) : ""}
        ${step < 2 ? `<p class="task">${q}</p><div class="lpanel">${kit.options(BINS.map(b => b[0]), { picked: wrong, correct: right[step] })}${wrong != null ? kit.feedback(FB[step][wrong], false) : ""}</div>` :
          kit.feedback(`Reader 2: ${fmt(AA.daily)} of ${fmt(AA.tests)} (${pct(AA.daily)}), about ${(share[1] / share[0]).toFixed(0)} times as many false wins from the same data. ${fmt(early)} of those ${fmt(AA.daily)} came in the first ${DAY4} days, when the groups were smallest. If you must be able to stop early, plan for it with a method built for repeated looks (sequential tests, “always valid” intervals), not with the fixed interval.`, true)}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== right[step]) { wrong = i; paint(); return; }
        wrong = null; step++; paint();
        if (step === 2) done();
      });
    };
    paint();
  }

  /* 7. Predict week 2, then decide with the full readout. */
  function weekTwo({ el, done, kit }) {
    ensureStyle();
    let phase = 0, wrong = null, ans = null;
    const w1 = ci(V2_W1, "cooked"), w2 = ci(V2_W2, "cooked"), all = ci(V2, "cooked");
    const rightPred = Math.abs(w2.d - w1.d) < 0.15 ? 1 : w2.d > w1.d ? 0 : 2;
    const predOpts = ["Bigger than week 1", "About the same", "Smaller than week 1"];
    const predFb = [
      "An effect can grow when people need time to learn a change, but a summary box needs no learning. Remember day 4: in week 1 the box was new even to regular visitors, and curiosity like that fades.",
      "That holds if the effect is steady. But in week 1 the box was new even to regulars who know the old page, and that curiosity wears off.",
      null
    ];
    const rows = rowsOf(V2);
    const v = rows.map(r => verdict(r.m, r.c));
    const allPass = v.every(x => x === 0);
    const opts = [
      `Ship, and tell the company summaries add about ${pt(all.d)} points of cooking`,
      `Ship, and plan on the second week's smaller gain (${pt(w2.d)}), not the ${DAYS}-day average`,
      "Keep running until the effect stops shrinking",
      "Roll back: the effect is falling"
    ];
    const RIGHT = 1;
    const fb = [
      [`The ${DAYS}-day number averages in week 1's first-time boost (${pt(w1.d)}). Promising ${pt(all.d)} sets up a disappointment when the boost is gone.`, false],
      [`Right. The plan passed: the main metric's interval is above 0 and ${allPass ? "every guardrail is inside its limit" : "the guardrails hold"}. The size to plan on is the later one, and its interval is still wide (${pt(w2.lo)} to ${pt(w2.hi)}), so keep watching cook-mode starts after launch. Kohavi and colleagues call a boost that fades a <b>newness effect</b>. Its opposite, a <b>primacy effect</b>, is when users need time to get used to a change. Both are reasons to run some tests for several weeks.`, true],
      [`The plan passed, and week 2 alone (${pt(w2.lo)} to ${pt(w2.hi)}) is still above 0. Extending a finished test because you dislike its trend is one more look, with the same problem as day ${DAY4}. Ship and keep watching the metric after launch instead.`, false],
      [`Falling is not zero. Week 2 alone runs from ${pt(w2.lo)} to ${pt(w2.hi)}, all above 0, and every guardrail is inside its limit. Rolling back throws away a real gain.`, false]
    ];
    const paint = () => {
      const plots = phase === 0
        ? ivPlot(kit, [{ m: MAIN, c: w1, title: "Started cook mode, week 1 only" }])
        : ivPlot(kit, [{ m: MAIN, c: w1, title: "Started cook mode, week 1 only" }, { m: MAIN, c: w2, title: "Started cook mode, week 2 only" }]) +
          `<p class="lead">The full readout after ${DAYS} days, ${fmt(usersOf(V2))} searchers:</p>${ivPlot(kit, rows)}`;
      el.innerHTML = `<h1>Day ${DAYS}: what do you expect to keep?</h1>
        <p class="lead">The second test ran its ${DAYS} days. Before the full table, split the main metric by week.</p>
        ${legend(phase === 1)}
        ${plots}
        ${phase === 0 ? `<p class="task">Predict: is week 2's difference, on its own, bigger, about the same, or smaller?</p>
          <div class="lpanel">${kit.options(predOpts, { picked: wrong, correct: rightPred })}${wrong != null ? kit.feedback(predFb[wrong], false) : ""}</div>` :
          `${kit.feedback(`Smaller: ${pt(w2.d)} in week 2 against ${pt(w1.d)} in week 1. In this simulation a boost that shrinks day by day was built in on purpose; in a real test you would see only the pattern, never the cause.`, true)}
          <p class="task">${allPass ? "Every row passes. " : ""}What do you do?</p>
          <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (phase === 0) {
          if (i !== rightPred) { wrong = i; paint(); return; }
          phase = 1; paint(); return;
        }
        ans = i; paint(); if (ans === RIGHT) done();
      });
    };
    paint();
  }

  /* 8. The cost in traffic: how long for half the effect? */
  function sampleSizeScreen({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const n1 = sampleSize(P_CTRL, 0.01), n2 = sampleSize(P_CTRL, 0.005);
    const w1 = n1 / WEEKLY, w2 = n2 / WEEKLY;
    const WEEKS = [2, 4, 8, 16];
    const RIGHT = WEEKS.reduce((b, x, i) => Math.abs(x - w2) < Math.abs(WEEKS[b] - w2) ? i : b, 0);
    const fb = WEEKS.map((x, i) => i === RIGHT
      ? [`Right: Δ is squared, so half the effect needs ${(n2 / n1).toFixed(0)} times the searchers: ${fmt(Math.round(n2))}, about ${w2.toFixed(1)} weeks of this site's traffic. Small effects are expensive to see. A site with little traffic cannot see them at all; there, a bigger change or an offline evaluation is the honest answer.`, true]
      : [x < w2 ? (x === 2 ? "Two weeks is the size for +1 point. A smaller effect hides more easily in the noise, so it needs more searchers, not the same number." : "Doubling would be right if the effect were not squared in the formula. Half of Δ, squared, is a quarter: four times the searchers.")
        : "Too long. Half the effect means Δ² is a quarter, so four times the searchers, not eight times.", false]);
    const paint = () => {
      el.innerHTML = `<h1>Why two weeks? Traffic is the price</h1>
        <p class="lead">Before the first test, the team worked out how many searchers it needed. Δ is the smallest change worth seeing. A rule of thumb from Kohavi and colleagues gives the number of searchers n for a 95% interval, so that a real change of size Δ shows up in about 9 of 10 tests:</p>
        <p class="${P}formula">n = (4 · r · σ / Δ)²</p>
        <p class="lead">n counts searchers in all groups, and r = 2 groups. σ measures how much one person's yes/no varies; for a yes/no metric σ = √(p(1 − p)). Here p is the rate in group A, the group without the change (${pc(100 * P_CTRL)} in the first test). For Δ = +1 point: n = ${fmt(Math.round(n1))} searchers. The site gets about ${fmt(Math.round(WEEKLY))} searchers a week, so that is ${w1.toFixed(1)} weeks: hence two full weeks.</p>
        <p class="task">The product lead wants to see changes as small as +0.5 points. About how long must a test run?</p>
        <div class="lpanel">${ask(kit, WEEKS.map(x => `${x} weeks`), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The interval from scratch, as a stepped replay of the traced run. */
  const FR = (() => {
    const fr = [{ ln: 0, vars: {} }];
    const vars = {};
    for (let k = 1; k < TRACE.length; k++) {
      const [, ev, name, val] = TRACE[k];
      if (name) vars[name] = val;
      fr.push({ ln: TRACE[k - 1][0], name, vars: { ...vars }, end: ev === "return" });
    }
    return fr;
  })();
  const num6 = v => Math.abs(v) < 0.001 ? v.toExponential(4) : v.toPrecision(6);
  function sayFrame(f) {
    const v = f.vars;
    if (f.ln === 0) return `<code>diff_ci</code> is called with the counts from the second test: ${fmt(ARGS.cooked_a)} of ${fmt(ARGS.users_a)} searchers in A started cook mode, ${fmt(ARGS.cooked_b)} of ${fmt(ARGS.users_b)} in B.`;
    if (f.end) return `It returns the difference and the interval: ${pt(100 * v.diff)} points, from ${pt(100 * v.low)} to ${pt(100 * v.high)}. A bootstrap of the same counts (the resampling from the earlier lesson) gave ${pt(BOOT[0])} to ${pt(BOOT[1])}: two methods, nearly the same range.`;
    const say = {
      rate_a: () => `Group A's rate: ${num6(v.rate_a)}, that is ${pc(100 * v.rate_a)}.`,
      rate_b: () => `Group B's rate: ${num6(v.rate_b)}, that is ${pc(100 * v.rate_b)}.`,
      diff: () => `The measured difference: ${num6(v.diff)}, that is ${pt(100 * v.diff)} points. The rest of the function asks how far off it could be.`,
      var_a: () => `The <b>variance</b> of A's rate, p(1 − p) / n: how much the rate would wobble if you ran the test again with other people. More searchers, less wobble.`,
      var_b: () => "The same for B.",
      se: () => `The two groups wobble independently, so their variances add. The square root is the <b>standard error</b> of the difference: ${num6(v.se)}, that is ${(100 * v.se).toFixed(2)} points.`,
      low: () => `1.96 standard errors below the difference: the low end of the 95% interval, ${pt(100 * v.low)} points. (1.96 is the multiplier that makes the interval a 95% one.)`,
      high: () => `1.96 standard errors above: the high end, ${pt(100 * v.high)} points.`
    };
    return say[f.name] ? say[f.name]() : "";
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const v1 = ci(V1, "cooked"), v2 = ci(V2, "cooked");
    const wA = v1.hi - v1.lo, wB = v2.hi - v2.lo, ratio = wA / wB;
    const opts = ["Much narrower: its difference was smaller", "About as wide", "Much wider"];
    const RIGHT = ratio > 0.85 && ratio < 1.15 ? 1 : ratio <= 0.85 ? 0 : 2;
    const fb = [
      ["The width does not depend on the difference. Look at the code: <code>se</code> is built from the two rates and the two group sizes only. <code>diff</code> just moves the interval left or right.", false],
      [`Right: ${wA.toFixed(2)} points wide against ${wB.toFixed(2)}. The width comes from the group sizes and the rates, which were nearly the same. The lever you control most directly is the number of searchers, and half the width costs four times as many.`, true],
      ["Nothing made the first test noisier: about the same number of searchers, and rates near 19% in both tests. The width comes from those two things only.", false]
    ];
    const paint = () => {
      const f = FR[i], last = i === FR.length - 1;
      const shown = Object.entries(f.vars).filter(([k]) => ["rate_a", "rate_b", "diff", "se", "low", "high"].includes(k));
      el.innerHTML = `<h1>The interval, from scratch</h1>
        <p class="lead">This is the function behind every interval in this lesson, in plain Python. It was run on this Mac, and each step below is a recorded line of that run.</p>
        <p class="task">Step through to the end. The marked line is the one that just ran.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${shown.length ? shown.map(([k, x]) => `<span>${k} <b>${num6(x)}</b></span>`).join("") : `<span>users_a <b>${fmt(ARGS.users_a)}</b></span><span>users_b <b>${fmt(ARGS.users_b)}</b></span>`}<span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}
        ${last ? `<p class="task">The first test had about as many searchers (${fmt(usersOf(V1))}) and cook-mode rates of ${pc(v1.a)} and ${pc(v1.b)}: a smaller difference, ${pt(v1.d)}. How wide was its interval, compared with this one?</p>
          <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; ans = null; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "An A/B test on users with the cheaper model",
      "Run the cheaper model on a golden set of searches offline; test on users only if it holds up",
      "Just switch: users will not notice"
    ];
    const RIGHT = 1;
    const fb = [
      ["That shows half your users summaries nobody has checked, for weeks, to learn something a golden set of searches with known facts tells you today: does the cheaper model get ingredients wrong?", false],
      ["Right. Offline evaluation is fast, cheap and needs no users, and it catches wrong facts before anyone sees them. If the cheaper model holds up there, a user test answers the remaining question: do people still cook as much?", true],
      ["You do not know that until you check. A cheaper model can be wrong more often about exactly the facts the reports guardrail caught in the first test.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to test on users</h1>
        <p class="lead"><b>For:</b> questions about what people do (cook, come back, buy, stay) that no fixed test set can answer. <b>Reach for it</b> when users see the change, your traffic can show the smallest effect worth having, and showing a possibly worse version to half of them for weeks is acceptable.</p>
        <p class="lead"><b>Not</b> when an offline evaluation settles it: is the answer right, is the format valid, does a cheaper model give the same answers on your golden set. Not when traffic is too small. Not when one version could harm people.</p>
        <p class="lead"><b>Costs:</b> weeks of calendar time, half your users on the losing version, a split and logging that must stay correct, and it measures only what you thought to log.</p>
        <p class="task">The team wants to switch the summaries to a cheaper model. What comes first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 11. Recognise: A/B test or not? */
  const STUDIO = { perWeek: 40, p: 0.3, delta: 0.05 }; // the scenario's own numbers, stated in its text
  function recognise({ el, done, kit }) {
    ensureStyle();
    const nStudio = sampleSize(STUDIO.p, STUDIO.delta), wStudio = nStudio / STUDIO.perWeek;
    const CASES = [
      ["A support chatbot gets a new prompt meant to make more customers solve their problem without phoning the help line.", true,
        "Yes. Whether a customer phones afterwards happens outside the chat; no test set records it. Main metric: chats with no call in the following days. Guardrails: complaints, chats that end with the customer giving up.",
        "Whether a customer phones afterwards happens outside the chat. No golden set can show it; only real customers, split into two groups, can."],
      ["A warranty-card reader now returns every purchase date as YYYY-MM-DD. A golden set of 300 scanned cards has the right value for every field.", false,
        "No test on users needed. The question is “is each field right?”, and the golden set already holds the right answers. An online test would make you wait weeks to learn what the golden set says today.",
        "Right: offline is enough. The change is about correctness, the golden set measures it exactly, and no question about user behaviour is left."],
      [`A small pottery studio's class-booking assistant talks to about ${STUDIO.perWeek} people a week, and about ${Math.round(STUDIO.p * 10)} in 10 of them book a class. The owner asks whether a warmer tone gets more of them to book.`, false,
        `Too little traffic. By the same rule of thumb, seeing a ${Math.round(100 * STUDIO.delta)}-point rise from a ${Math.round(100 * STUDIO.p)}% booking rate needs about ${fmt(Math.round(nStudio))} people: about ${fmt(Math.round(wStudio))} weeks of this studio's traffic. Read the conversations, ask customers, and judge the tone offline instead.`,
        `Right. The rule of thumb says about ${fmt(Math.round(nStudio))} people to see a ${Math.round(100 * STUDIO.delta)}-point rise, about ${fmt(Math.round(wStudio))} weeks of this traffic. The test could never finish. Judge the tone offline and talk to customers.`],
      ["To see if summaries would make people cook even more, the team wants to test showing them without the allergy warning the site always adds.", false,
        "No. You never show people a version you already believe can hurt them just to measure it. A test answers “which is better?”; it is not a licence to expose half your users to a known risk.",
        "Right. Removing a safety warning is decided on the risk, not measured on users. Some questions an A/B test must not be used to answer."],
      ["A news app wants to know whether AI-written notification headlines get more articles opened, without more people turning notifications off.", true,
        "Yes. A main metric (articles opened from notifications) and a guardrail with a limit (people turning notifications off), both about behaviour, with plenty of traffic. That is the shape of this lesson's test.",
        "Opening and turning off are things people do, and no offline set can predict them. Plenty of traffic, a clear main metric and a clear guardrail: this is what an A/B test is for."]
    ];
    const ans = CASES.map(() => null);
    const right = c => c[1] ? 0 : 1;
    const paint = () => {
      el.innerHTML = `<h1>A/B test or not?</h1>
        <p class="lead">Five plans from other teams. For each, would you run an A/B test on users?</p>
        <p class="task">Answer each one. Pick again if you change your mind.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(c[0])}</p>${kit.options(["Run an A/B test", "Don't A/B test this"], { picked: ans[i], correct: right(c) })}${ans[i] == null ? "" : kit.feedback(ans[i] === right(c) ? (c[1] ? c[2] : c[3]) : (c[1] ? c[3] : c[2]), ans[i] === right(c))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((cc, j) => ans[j] === right(cc))) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can run the test and read it</h1>
      <p class="lead">An A/B test shows a change to half of your users and asks what they do differently. You picked one main metric that both groups have and set guardrails with limits before any data. You judged each 95% interval against that plan. You saw why a failed guardrail is a veto, why looking every day finds wins that are noise, and why a first-week boost fades.</p>
      <p class="lead">Reach for it when the question is about behaviour and you have the traffic. Skip it when an offline evaluation already answers the question, when traffic is too small, or when one version could harm people. Its price is weeks of time and enough searchers: half the effect needs four times as many.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You can now read a result with its uncertainty; next you explain numbers like these, and a feature's failure cases and cost, to people who are not engineers.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "A/B testing an AI feature on real users",
    checked: "2026-11-18",
    sources: [
      "https://doi.org/10.1145/1281192.1281295",
      "https://arxiv.org/abs/1512.04922",
      "https://arxiv.org/abs/2402.11609",
      "https://confidence.spotify.com/glossary/guardrail-metric",
      "https://docs.growthbook.io/using/experimentation-best-practices",
      "https://www.itl.nist.gov/div898/handbook/prc/section3/prc33.htm",
      "https://sol.utstat.utoronto.ca/modules/module-10/10-2-Comparing-Two-Proportions.pdf"
    ],
    interview: [
      {
        q: "Your AI search summaries raised conversions in an A/B test, but the share of users reporting wrong information also went up. The product manager wants to ship. What do you do?",
        good: [
          "Check the guardrail against the limit agreed before the test, using its interval, not just the point value",
          "If the whole interval is past the limit, do not ship it as is: turn the feature off and read the reports to find the failure",
          "Fix the cause (for example, ground the summary in the result text) and run a new test, since the fix is a new change",
          "Do not keep running a test whose guardrail has clearly failed: more data mostly narrows the interval around where it already sits"
        ],
        weak: "Ship because the main metric won, or remove the report button. That treats the guardrail as a number to beat instead of a veto agreed in advance."
      },
      {
        q: "A teammate checks the experiment dashboard every morning and wants to stop the test the first day the result is significant. What is wrong with that, and what would you set up instead?",
        good: [
          "Each look is another chance for noise to cross the line; in a simulated A/A test, daily looks found false winners several times as often as one look",
          "Fix the sample size and the stopping day before the test, from the smallest effect worth having",
          "Run whole weeks, because weekday and weekend users differ, and early days carry a first-time boost",
          "If early stopping is really needed, plan for it with a sequential method made for repeated looks",
          "Watching guardrails daily for serious harm is fine; deciding a win early is not"
        ],
        weak: "Wait until p is below 0.05 and then stop. That is exactly the repeated look that inflates false wins."
      }
    ],
    screens: [mainMetric, guardrails, readTable, decideV1, dayFour, peeking, weekTwo, sampleSizeScreen, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#g3 [data-wrong]"], right: [0, 1, 2, 3].map(i => `#g${i} [data-right]`) },
      { wrong: ["#r1 [data-wrong]"], right: [0, 1, 2, 3].map(i => `#r${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(FR.length - 1).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: [0, 1, 2, 3, 4].map(i => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
