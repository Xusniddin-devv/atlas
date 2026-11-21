/* Lesson: agents in deployment and monitoring. Story: a parcel-tracking service whose error rate jumps after a
   Friday release written by a coding agent. Ideas: (1) gates before release (CI, review) only check cases someone
   wrote down; a gate during release (a canary compared with the old version, rolled back by a plain rule) checks
   what real traffic does; (2) an agent can do the reading part of on-call (logs, diff, data) and propose a fix
   with a test, without production write access, and a person decides: accept, ask for a test, or reject.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5c-agents-deploy-monitor/change (the agent's Friday change),
     triage-notest, triage-2 and triage-blind (three fix proposals; requests built by make_triage_requests.py).
     triage and triage-rushed were recorded too and are not shown (triage stopped at max_tokens mid-file).
   - docs/ai-path/runs/s5c-agents-deploy-monitor/: friday.py replays Friday 15:00-19:00 (random.Random(13)) and
     writes friday-full.log / friday-full.out.txt (the release to everyone) and friday-canary.log / .out.txt (1 in
     10 requests to the release); canary.py + canary.out.txt traces canary_verdict at the check times;
     ci_release.out.txt is pytest on the release; check_fixes.sh + check_fixes.out.txt run every proposal through
     the tests, the new tests against the broken release, and the replay with the fix serving from 18:00.
   Lesson-local style (.lx-s5c-agents-deploy-monitor-*): gate cards, log lines as buttons, a recorded-text block;
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s5c-agents-deploy-monitor";
  const P = `lx-${ID}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pct = (a, b) => Math.round(a / b * 100);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mins = (a, b) => { const m = t => +t.slice(0, 2) * 60 + +t.slice(3, 5); return m(b) - m(a); };

  /* ---------- Data copied from the runs and recordings ---------- */
  // friday-full.out.txt: [half hour starting, requests, 5xx errors]. The one request the replay logged after 19:00 is left out.
  const HALF_HOURS = [["15:00", 78, 0], ["15:30", 82, 0], ["16:00", 83, 0], ["16:30", 81, 0], ["17:00", 78, 10], ["17:30", 79, 11], ["18:00", 86, 35], ["18:30", 86, 25]];
  const RELEASE_AT = "17:00", ALERT_AT = "18:30", ALERT_BUCKET = "18:00";
  // ci_release.out.txt (pytest -v on the release folder)
  const CI_RELEASE = { tests: ["test_latest_state", "test_unknown_parcel"], passed: 2 };
  // friday.py: from 17:00 one request in CANARY_EVERY goes to the release; the canary is checked at these times
  const CANARY_EVERY = 10, MIN_REQUESTS = 5, MAX_EXTRA = 0.01;
  // canary.out.txt: counts since 17:00 at each check, the lines canary_verdict ran (0 = def line), its result
  const CHECKS = [
    { at: "17:10", canary: { requests: 2, errors: 1 }, control: { requests: 21, errors: 0 }, lines: [1, 2], result: "wait", rates: null },
    { at: "17:20", canary: { requests: 5, errors: 1 }, control: { requests: 48, errors: 0 }, lines: [1, 3, 4, 5, 6], result: "roll back", rates: [0.2, 0.0] }
  ];
  const FULL_TO_1720 = { requests: 53, errors: 5 }, FULL_TO_1900 = { requests: 329, errors: 81 }; // canary.out.txt, friday-full.log
  // friday-full.log, the first lines after the first failure (the line of ^ markers under the code line is left out)
  const LOG = [
    ["17:00:26 INFO GET /track/PX-10052 200 version=release {'parcel': 'PX-10052', 'state': 'out_for_delivery', 'updated': '2026-11-12T15:16', 'location': 'Manchester hub'}", "ok"],
    ["17:00:49 ERROR GET /track/PX-10514 500 version=release", "err"],
    ["Traceback (most recent call last):", null],
    ["  File \"release/tracking.py\", line 9, in track", null],
    ["    return 200, {\"parcel\": parcel_id, \"state\": latest[\"state\"], \"updated\": latest[\"time\"], \"location\": latest[\"location\"]}", "code"],
    ["KeyError: 'location'", "key"]
  ];
  const CARRIER = "events of PX-10514 at 17:00:49 [{'time': '2026-11-13T16:25', 'state': 'label_created'}]"; // friday-full.out.txt
  // check_fixes.out.txt: each proposal from 18:00 to the end of the replay
  const FIX_RUN = {
    notest: { ci: 2, requests: 173, errors: 0 },
    withTest: { ciFix: 4, vsRelease: { failed: 1, passed: 3, test: "test_track_parcel_without_location", error: "KeyError: 'location'" }, requests: 173, errors: 0 },
    blind: { ci: 2, requests: 173, errors: 60 }
  };

  // From docs/ai-path/recordings/s5c-agents-deploy-monitor/change.json (not altered; only the changed lines are shown)
  const REC_CHANGE = {
    src: "s5c-agents-deploy-monitor/change", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    codeLine: "    return 200, {\"parcel\": parcel_id, \"state\": latest[\"state\"], \"updated\": latest[\"time\"], \"location\": latest[\"location\"]}",
    testLine: "    assert body[\"location\"] == \"Manchester hub\"",
    fixture: [
      "EVENTS = {",
      "    \"PX-1001\": [",
      "        {\"time\": \"2026-11-12T09:10\", \"state\": \"picked_up\", \"location\": \"Leeds depot\"},",
      "        {\"time\": \"2026-11-12T21:40\", \"state\": \"in_transit\", \"location\": \"Manchester hub\"},",
      "    ],",
      "}"
    ]
  };
  // From docs/ai-path/recordings/s5c-agents-deploy-monitor/triage-notest.json (not altered)
  const REC_NOTEST = {
    src: "s5c-agents-deploy-monitor/triage-notest", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    text: "The release introduced a bug where it attempts to access the 'location' key even when it's not present in the carrier data.",
    code: [
      "\"\"\"Parcel-tracking lookup: the latest event of a parcel.\"\"\"",
      "",
      "",
      "def track(parcel_id, events_by_parcel):",
      "    events = events_by_parcel.get(parcel_id)",
      "    if not events:",
      "        return 404, {\"error\": \"unknown parcel\"}",
      "    latest = max(events, key=lambda e: e[\"time\"])",
      "    ",
      "    response_data = {\"parcel\": parcel_id, \"state\": latest[\"state\"], \"updated\": latest[\"time\"]}",
      "    if \"location\" in latest:",
      "        response_data[\"location\"] = latest[\"location\"]",
      "        ",
      "    return 200, response_data"
    ]
  };
  // From docs/ai-path/recordings/s5c-agents-deploy-monitor/triage-2.json (the first of its two test functions, not altered)
  const REC_TEST = {
    src: "s5c-agents-deploy-monitor/triage-2", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    code: [
      "def test_track_parcel_without_location():",
      "    events_by_parcel = {\"PX-10514\": [{\"time\": \"2026-11-13T16:25\", \"state\": \"label_created\"}]}",
      "    status, data = track(\"PX-10514\", events_by_parcel)",
      "    assert status == 200",
      "    assert data == {\"parcel\": \"PX-10514\", \"state\": \"label_created\", \"updated\": \"2026-11-13T16:25\"}",
      "…"
    ]
  };
  // From docs/ai-path/recordings/s5c-agents-deploy-monitor/triage-blind.json (not altered)
  const REC_BLIND = {
    src: "s5c-agents-deploy-monitor/triage-blind", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    text: "The `track` function should handle potential `KeyError` exceptions when accessing event details to prevent 500 errors.",
    code: [
      "\"\"\"Parcel-tracking lookup: the latest event of a parcel.\"\"\"",
      "",
      "",
      "def track(parcel_id, events_by_parcel):",
      "    events = events_by_parcel.get(parcel_id)",
      "    if not events:",
      "        return 404, {\"error\": \"unknown parcel\"}",
      "    try:",
      "        latest = max(events, key=lambda e: e[\"time\"])",
      "        return 200, {\"parcel\": parcel_id, \"state\": latest[\"state\"], \"updated\": latest[\"time\"], \"location\": latest[\"location\"]}",
      "    except KeyError:",
      "        return 500, {\"error\": \"internal server error processing event data\"}"
    ]
  };
  const BLIND_ASK = "The pager keeps firing. Make sure this endpoint never returns a 500 again."; // make_triage_requests.py
  const CAPTION = `Recorded model output, ${REC_NOTEST.recordedAt}`;

  // canary_verdict from docs/ai-path/runs/s5c-agents-deploy-monitor/canary.py, line for line (line 0 = def)
  const CANARY_CODE = [
    "def canary_verdict(canary, control, max_extra=0.01, min_requests=5):",
    "    if canary[\"requests\"] < min_requests:",
    "        return \"wait\"",
    "    canary_rate = canary[\"errors\"] / canary[\"requests\"]",
    "    control_rate = control[\"errors\"] / control[\"requests\"]",
    "    if canary_rate > control_rate + max_extra:",
    "        return \"roll back\"",
    "    return \"promote\""
  ];

  /* ---------- Derived from the data ---------- */
  const relIdx = HALF_HOURS.findIndex(h => h[0] === RELEASE_AT);
  const BEFORE = HALF_HOURS.slice(0, relIdx), AFTER = HALF_HOURS.slice(relIdx);
  const before = { requests: sum(BEFORE.map(h => h[1])), errors: sum(BEFORE.map(h => h[2])) };
  const after = { requests: sum(AFTER.map(h => h[1])), errors: sum(AFTER.map(h => h[2])) };
  const alertH = HALF_HOURS.find(h => h[0] === ALERT_BUCKET);
  const ALERT_PCT = pct(alertH[2], alertH[1]);
  const LATE = HALF_HOURS.filter(h => h[0] >= "18:00");
  const LATE_ERRORS = sum(LATE.map(h => h[2]));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
      .${P}-gates { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 10px; }
      .${P}-gate { display: grid; grid-template-columns: 2.2em 1fr; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 10px 14px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 16px/1.4 var(--font); text-align: left; cursor: pointer; }
      .${P}-gate:hover:not([disabled]) { border-color: var(--ink); }
      .${P}-gate .${P}-n { font: 600 15px var(--mono); color: var(--muted); text-align: center; }
      .${P}-gate[disabled] { cursor: default; border-color: var(--good); background: var(--good-soft); }
      .${P}-gate[disabled] .${P}-n { color: var(--ink); }
      .${P}-gate.${P}-bad { border-color: var(--bad); background: var(--bad-soft); }
      .${P}-pre { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--sunk); font: 500 13.5px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}-pre .${P}-ln { display: block; min-height: 1.55em; }
      .${P}-pre .${P}-add { border-left: 3px solid var(--good); padding-left: 8px; margin-left: -11px; }
      .${P}-label { margin: 16px 0 0; font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}-said { margin: 14px 0 0; padding: 12px 14px; border-left: 3px solid var(--ink); background: var(--surface); font-size: 16px; line-height: 1.5; }
      .${P}-said .${P}-pre { margin-top: 10px; background: var(--bg); }
      .${P}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}-log { margin: 14px 0 0; display: grid; gap: 6px; }
      .${P}-line { display: block; width: 100%; min-height: 44px; padding: 8px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: 500 13.5px/1.5 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; }
      .${P}-line:hover:not(.${P}-right):not(.${P}-wrong) { border-color: var(--ink); }
      .${P}-line.${P}-plain { cursor: default; border-color: transparent; min-height: 0; padding: 2px 12px; color: var(--muted); }
      .${P}-line.${P}-right { border-color: var(--good); background: var(--good-soft); }
      .${P}-line.${P}-wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}-bar { display: grid; grid-template-columns: 3.4em 1fr 6.6em; align-items: center; gap: 10px; font: 500 14px var(--mono); padding: 3px 0; }
      .${P}-bar .${P}-t { height: 14px; border-radius: 3px; background: var(--sunk); overflow: hidden; }
      .${P}-bar .${P}-t u { display: block; height: 100%; background: var(--ink); }
      .${P}-bar .${P}-t u.${P}-hot { background: var(--bad); }
      .${P}-bar b { font-weight: 600; text-align: right; }
      .${P}-bars { margin: 14px 0 0; }
      .${P}-mark { border-top: 1px dashed var(--muted); margin: 4px 0; font: 500 12.5px var(--mono); color: var(--muted); padding-top: 2px; }
      .${P}-row3 { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    `;
    document.head.appendChild(s);
  }
  const pre = (kit, lines, add = []) => `<div class="${P}-pre">${lines.map((l, i) => `<span class="${P}-ln${add.includes(i) ? ` ${P}-add` : ""}">${kit.esc(l) || " "}</span>`).join("")}</div>`;
  const said = (kit, text, code) => `<div class="${P}-said">${text ? kit.esc(text) : ""}${code ? `<div class="${P}-label">tracking.py</div>${pre(kit, code)}` : ""}</div><p class="${P}-cap">${CAPTION}</p>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  // error-rate bars per half hour; a dashed mark where the release went out
  function errorBars(kit) {
    const mx = Math.max(...HALF_HOURS.map(h => h[2] / h[1]));
    return `<div class="${P}-bars" role="img" aria-label="Failed requests per half hour">${HALF_HOURS.map(h => `${h[0] === RELEASE_AT ? `<div class="${P}-mark">release ${kit.esc(RELEASE_AT)}</div>` : ""}<div class="${P}-bar"><span>${kit.esc(h[0])}</span><span class="${P}-t"><u class="${h[2] ? `${P}-hot` : ""}" style="width:${h[2] / h[1] / mx * 100}%"></u></span><b>${h[2]} / ${h[1]}</b></div>`).join("")}</div>`;
  }

  /* 1. The situation, and the by-hand task: put the gates in order. */
  const GATES = [
    "Canary: the new version serves a small share of real requests, and its error rate is compared with the old version's",
    "A person reviews the change and approves it",
    "The agent pushes its change to a branch and opens a pull request",
    "Release to all traffic",
    "CI runs the tests and checks on the pull request"
  ];
  const ORDER = [2, 4, 1, 0, 3];
  function gateOrder({ el, done, kit }) {
    ensureStyle();
    let placed = [], bad = null;
    const early = g => {
      if (g === 4) return "CI needs something to run on. The agent first has to put its change on a branch and open a pull request.";
      if (g === 1) return placed.includes(2)
        ? "Let CI go first. If the tests fail, nobody spends review time on the change, and the reviewer then reads code that at least passes its own tests."
        : "There is nothing to review yet: the change is not on a branch or in a pull request.";
      if (g === 0) return "A canary sends real customers' requests to the new code. Only a change that has passed CI and a person's review should get even a small share of them.";
      return "Releasing to everyone is the last step. On Friday it came straight after the tests, and every customer met the bug.";
    };
    const paint = () => {
      const fin = placed.length === ORDER.length;
      el.innerHTML = `<h1>The Friday release</h1>
        <p class="lead">A delivery company's tracking service answers “where is my parcel?”. The team lets a coding agent write small changes. On Friday 13 November at ${RELEASE_AT} they released one: the tracking page should also show the parcel's last known location.</p>
        <p class="lead">Between ${HALF_HOURS[0][0]} and ${RELEASE_AT}, ${before.errors} of ${before.requests} requests failed. Between ${RELEASE_AT} and 19:00, <b>${after.errors} of ${after.requests}</b> failed (${pct(after.errors, after.requests)}%). The change had gone straight from “tests passed” to every customer.</p>
        <p class="lead">This lesson is about the last part of building with agents: how an agent's change should reach real users, and what an agent may safely do when something breaks after release.</p>
        <p class="task">The team is rebuilding the path an agent's change takes to production. Tap the five steps in the order a change should pass them.</p>
        <ol class="${P}-gates">${GATES.map((g, i) => {
          const at = placed.indexOf(i);
          return `<li><button type="button" class="${P}-gate${bad === i ? ` ${P}-bad` : ""}" data-i="${i}" ${at >= 0 ? "disabled" : ""}><span class="${P}-n">${at >= 0 ? at + 1 : "·"}</span><span>${kit.esc(g)}</span></button></li>`;
        }).join("")}</ol>
        <div class="lpanel">${bad != null ? kit.feedback(early(bad), false) : ""}${fin ? kit.feedback(`Right. Each step catches a different kind of mistake. CI catches code that breaks its own tests. The person catches what the tests do not ask about. The first three steps all happen <b>before</b> any customer sees the change. The canary is the only one that watches <b>real requests</b>, and it puts only a small share of them at risk. Release to everyone comes last, once the canary looks no worse than the old version.`, true) : placed.length ? kit.feedback(`${plural(placed.length, "step")} placed. Which comes next?`) : ""}</div>`;
      el.querySelectorAll(`.${P}-gate`).forEach(b => b.onclick = () => {
        const g = +b.dataset.i;
        if (placed.includes(g)) return;
        if (g === ORDER[placed.length]) { placed.push(g); bad = null; paint(); if (placed.length === ORDER.length) done(); return; }
        bad = g; paint();
      });
    };
    paint();
  }

  /* 2. Spot the idea: the tests were green, the release still failed. */
  function greenTests({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "CI was broken: it should have failed this change",
      "The tests only used parcels with a location; real traffic also had parcels without one",
      "A bigger model would not have made this mistake",
      "Releasing on a Friday made the change fail"
    ];
    const fb = [
      [`CI did its job. It ran ${plural(CI_RELEASE.passed, "test")}, and both pass on this code. A test can only fail on the inputs written into it.`, false],
      [`Right. The agent wrote the code and the test from the same example events, so the test shares the code's blind spot. CI and review check what someone <b>predicted</b>. A canary checks what <b>really happens</b>, on a small share of real requests, before everyone gets the change. That is the first idea of this lesson.`, true],
      ["Maybe a stronger model would have written a safer lookup, maybe not. Nothing in the task or the test data mentioned a parcel without a location. The release path must not depend on the agent being right.", false],
      ["Friday made it worse: fewer people around to notice. But the same change on a Tuesday fails the same requests. The day does not decide which requests fail; the data does.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Green tests, failing release</h1>
        <p class="lead">The agent changed one line of the service and one line of the test. Its test data, like the old tests, had two example events. An event is one record of a parcel's journey, with a time and a state. Both examples also had a location:</p>
        <div class="${P}-label">tracking.py, changed line</div>${pre(kit, ["…", REC_CHANGE.codeLine], [1])}
        <div class="${P}-label">test_tracking.py, example data and the added check</div>${pre(kit, ["…", ...REC_CHANGE.fixture, "…", REC_CHANGE.testLine, "…"], [REC_CHANGE.fixture.length + 2])}
        <p class="${P}-cap">Recorded model output, ${REC_CHANGE.recordedAt}. CI on Friday: ${CI_RELEASE.tests.map(t => `<code>${kit.esc(t)}</code> passed`).join(", ")}.</p>
        <p class="lead">Failed requests per half hour, replayed on our machine with generated parcels and requests. Each row shows failed / all requests:</p>
        ${errorBars(kit)}
        <p class="task">CI was green. Why did the failure still reach customers?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. The canary as plain code: predict its verdict at two check times. */
  const VERDICTS = ["wait", "roll back", "promote"];
  function canaryGate({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const why = (c, v) => {
      const [cr, kr] = c.rates || [];
      if (c.result === "wait") return v === "roll back"
        ? `One failure in ${c.canary.requests} looks bad, but the first <code>if</code> runs first: ${c.canary.requests} requests is below <code>min_requests</code> (${MIN_REQUESTS}). The rule refuses to judge on so few.`
        : `Promote means “release to everyone”. The first <code>if</code> returns before any rate is computed: ${c.canary.requests} requests is below ${MIN_REQUESTS}.`;
      return v === "wait"
        ? `${c.canary.requests} is not below ${MIN_REQUESTS}, so the first <code>if</code> lets the check go on to the rates.`
        : `The canary's rate is ${c.canary.errors} / ${c.canary.requests} = ${cr}. The old version's is ${kr}. ${cr} is more than ${kr} + ${MAX_EXTRA}, so the second <code>if</code> is true.`;
    };
    const paint = () => {
      const fin = k >= CHECKS.length;
      const c = CHECKS[Math.min(k, CHECKS.length - 1)];
      const shown = fin ? CHECKS[CHECKS.length - 1] : null;
      const last = shown ? shown.lines[shown.lines.length - 1] : 0;
      const opts = VERDICTS.map(v => `“${v}”`);
      el.innerHTML = `<h1>The canary check is plain code</h1>
        <p class="lead">The same Friday, replayed with a canary: from ${RELEASE_AT}, one request in ${CANARY_EVERY} goes to the release (the <b>canary</b>) and the rest to the old version (the <b>control</b>). Every ten minutes this function compares the two. No model is involved.</p>
        <p class="lead"><code>min_requests</code> is the fewest canary requests it will judge on. <code>max_extra</code> is how much higher the canary's error rate may be than the old version's. “Promote” means release to everyone.</p>
        ${kit.code(CANARY_CODE, fin ? last : (k > 0 ? CHECKS[k - 1].lines[CHECKS[k - 1].lines.length - 1] : -1))}
        ${fin ? "" : `<div class="vars"><span>check <b>${c.at}</b></span><span>canary <b>${c.canary.errors} failed / ${c.canary.requests}</b></span><span>old version <b>${c.control.errors} failed / ${c.control.requests}</b></span></div>
        <p class="task">At ${c.at}, what does <code>canary_verdict</code> return?</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts, { picked: wrong, correct: VERDICTS.indexOf(c.result) })}
        ${wrong != null ? kit.feedback(why(c, VERDICTS[wrong]), false) : ""}
        ${k > 0 && !fin ? kit.feedback(`Right: at ${CHECKS[0].at} the first <code>if</code> was true (${CHECKS[0].canary.requests} is below ${MIN_REQUESTS}), so it returned “${CHECKS[0].result}”.`, true) : ""}
        ${fin ? kit.feedback(`Right: at ${shown.at} the check got past the first <code>if</code>, computed <code>canary_rate</code> ${shown.rates[0]} and <code>control_rate</code> ${shown.rates[1]}, found the second <code>if</code> true, and returned “${shown.result}”. With the canary, <b>${shown.canary.errors}</b> customer ${shown.canary.errors === 1 ? "request" : "requests"} failed before the roll back at ${shown.at}. Without it, ${FULL_TO_1720.errors} failed in the same ${mins(RELEASE_AT, shown.at)} minutes, and ${FULL_TO_1900.errors} by 19:00. The rule is a few lines you can test, it gives the same answer every time, and it needs no judgement. That is why it is code, not an agent. This small replay judged on ${MIN_REQUESTS} requests, so one failure decided. A real canary should be large enough, and run long enough, to be a fair sample of all the traffic. The rule itself stays the same.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = VERDICTS[+b.dataset.i];
        if (v !== CHECKS[k].result) { wrong = +b.dataset.i; paint(); return; }
        wrong = null; k++; paint();
        if (k >= CHECKS.length) done();
      });
    };
    paint();
  }

  /* 4. Broken on purpose: find the cause in the real log. */
  function readLog({ el, done, kit }) {
    ensureStyle();
    let picked = null;
    const items = [...LOG.map(([t, kind], i) => ({ t, kind, i })), { t: CARRIER, kind: "data", i: LOG.length }];
    const fb = {
      ok: "This request worked: PX-10052's newest event has a location. It tells you the release is not broken for every parcel. That is a clue, not the cause.",
      err: "This is the symptom: what the customer got. It names the parcel that failed, not why it failed.",
      key: "This names what was missing: the key <code>'location'</code>. It does not say which line expected it to be there. Find that line.",
      data: "The carrier data is right. A parcel whose label was printed at 16:25 and never scanned has not been anywhere yet, so its only event has no location. The bug is in the code that read it."
    };
    const paint = () => {
      const p = picked == null ? null : items[picked];
      el.innerHTML = `<h1>Read the log</h1>
        <p class="lead">Back to what really happened. At ${ALERT_AT} the alert fired: ${ALERT_PCT}% of requests failed in the last half hour. Below are the first lines of the log after the release. The last line is a read-only query of the carrier data (the events stored for each parcel): the events of the first parcel that failed.</p>
        <p class="task">Tap the line that is the cause, not a symptom.</p>
        <div class="${P}-log">${items.map(it => it.kind
          ? `<button type="button" class="${P}-line${picked === it.i ? (it.kind === "code" ? ` ${P}-right` : ` ${P}-wrong`) : ""}" data-i="${it.i}"${it.kind === "code" ? " data-right" : it.kind === "err" ? " data-wrong" : ""}>${kit.esc(it.t)}</button>`
          : `<div class="${P}-line ${P}-plain">${kit.esc(it.t)}</div>`).join("")}</div>
        <p class="${P}-cap">From the replay's log, not altered. The line of ^ markers Python prints under the code line is left out.</p>
        <div class="lpanel">${p ? (p.kind === "code"
          ? kit.feedback(`Right. This is the line the agent changed: <code>latest["location"]</code> assumes the newest event always has a location. For a parcel whose only event is <code>label_created</code>, it has none, so Python raises <code>KeyError</code> and the service answers 500. Parcels that had been scanned, like PX-10052, still worked. That is why about ${pct(after.errors, after.requests)}% failed, not all.`, true)
          : kit.feedback(fb[p.kind], false)) : ""}</div>`;
      el.querySelectorAll(`button.${P}-line`).forEach(b => b.onclick = () => { picked = +b.dataset.i; paint(); if (items[picked].kind === "code") done(); });
    };
    paint();
  }

  /* 5. What the monitoring agent may touch. */
  const PERMS = [
    ["Read the service logs", true, "Without the logs the agent can only guess. The next screens show what a guess looks like."],
    ["Read the repository and the release diff", true, "The traceback points at a file and a line. To connect it to Friday's change, the agent has to read the code and the diff."],
    ["Query the carrier data, read only", true, "The carrier data showed why the key was missing. Reading it changes nothing, so there is no risk in allowing it."],
    ["Push a fix to a branch and open a pull request", true, "This is how its proposal reaches a person. A branch changes nothing in production until someone merges it."],
    ["Approve and merge its own pull request", false, "Then nobody but the agent ever reads the fix. On GitHub, for example, a protected branch can require approvals, and can require that the latest push is approved by someone other than the person who pushed it."],
    ["Deploy or roll back production", false, "Rolling back on a bad error rate is the canary rule's job: plain code you can test. A deploy needs production credentials. On GitHub, for example, an environment's secrets reach only the jobs that use that environment, and the environment can require a person to approve each deploy job."],
    ["Write to the production database, for example to fill in missing locations", false, "A data change is not undone by reverting a pull request, and nobody reviews it first. Here the data was right anyway: the code was wrong."]
  ];
  function permissions({ el, done, kit }) {
    ensureStyle();
    const ans = PERMS.map(() => null);
    const paint = () => {
      const all = PERMS.every(([, ok], i) => ans[i] === (ok ? 0 : 1));
      el.innerHTML = `<h1>What may the on-call agent touch?</h1>
        <p class="lead">Being on call means being the one who is woken when production breaks. The team now gives an agent the reading part of that job. When an alert fires, it reads what it needs and proposes a fix that a person reviews.</p>
        <p class="task">Allow or deny each permission. Change a pick if you change your mind.</p>
        ${PERMS.map(([t, ok, why], i) => `<div class="lcase" id="p${i}"><p>${kit.esc(t)}</p>${kit.options(["Allow", "Deny"], { picked: ans[i], correct: ok ? 0 : 1 })}${ans[i] == null ? "" : ans[i] === (ok ? 0 : 1) ? kit.feedback(why, true) : kit.feedback(ok ? `Deny would cost more than it saves. ${why}` : `Allow is the risky pick. ${why}`, false)}</div>`).join("")}
        ${all ? kit.feedback("The pattern: <b>read</b> everything it needs, and <b>write</b> only where a person checks the result before it matters, a branch and a pull request. Merging is a person's call. Rolling back is a rule's call. Production data is nobody's quick fix. Anthropic's guide to running Claude Code in GitHub Actions gives the same advice in short: grant the workflow only the permissions it needs, and review the changes before merging.", true) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PERMS.every(([, ok], j) => ans[j] === (ok ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 6. Proposal 1: right fix, no test. Then predict what its test does on the broken release. */
  const DECIDE = ["Accept: send the pull request to review and merge", "Ask for a test first", "Reject it"];
  function proposalOne({ el, done, kit }) {
    ensureStyle();
    let a = null, b = null;
    const fa = [
      [`The change looks correct. But CI would run the same ${plural(FIX_RUN.notest.ci, "test")} that also passed on Friday's broken release. Green CI cannot tell this fix from no fix, and nothing would stop the bug coming back in a later change.`, false],
      [`Right. The fix looks correct, but CI would run only the same ${plural(FIX_RUN.notest.ci, "test")} that passed on the broken release. Ask for a test that uses a parcel whose newest event has no location. Customers need not wait for that test: roll back to the old version first. It served ${before.requests} requests before ${RELEASE_AT}, and ${before.errors} failed.`, true],
      ["The cause sentence matches the log, and the code adds a location only when the event has one. Rejecting it throws away a correct fix. Ask for what is missing instead.", false]
    ];
    const fb2 = [
      ["If it passed on the broken release, it would not test this bug at all. The release fails exactly this case: a parcel with only a <code>label_created</code> event.", false],
      [`Right, and that is what happened when we ran it: on the broken release, ${FIX_RUN.withTest.vsRelease.failed} failed (<code>${kit.esc(FIX_RUN.withTest.vsRelease.test)}</code>, <code>${kit.esc(FIX_RUN.withTest.vsRelease.error)}</code>) and ${FIX_RUN.withTest.vsRelease.passed} passed. On the fix, all ${FIX_RUN.withTest.ciFix} passed. We also replayed Friday's requests from 18:00 to the end through the fix: ${FIX_RUN.withTest.errors} of ${FIX_RUN.withTest.requests} failed. A test that fails before the fix and passes after it proves the fix fixes <b>this</b> bug, and it stays in CI so the bug cannot quietly come back.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Proposal 1: accept, test, or reject?</h1>
        <p class="lead">The agent got the alert, the log lines you just read, the carrier query and the release diff. It was asked for the cause and a new <code>tracking.py</code>. A small hosted model answered:</p>
        ${said(kit, REC_NOTEST.text, REC_NOTEST.code)}
        <div id="q0"><p class="task">What do you do with this proposal?</p>
        <div class="lpanel">${ask(kit, DECIDE, 1, a, fa)}</div></div>
        ${a === 1 ? `<div id="q1"><p class="lead">The same model, given the same input and asked for the fix <b>with</b> its tests, wrote this test (one of two):</p>
          <div class="${P}-label">test_tracking.py</div>${pre(kit, REC_TEST.code)}<p class="${P}-cap">${CAPTION}</p>
          <p class="task">Run this test against Friday's broken release. What should happen?</p>
          <div class="lpanel">${ask(kit, ["It passes", `It fails with ${kit.esc(FIX_RUN.withTest.vsRelease.error)}`], 1, b, fb2)}</div></div>` : ""}`;
      el.querySelectorAll("#q0 .lopts button").forEach(x => x.onclick = () => { a = +x.dataset.i; if (a !== 1) b = null; paint(); });
      el.querySelectorAll("#q1 .lopts button").forEach(x => x.onclick = () => { b = +x.dataset.i; paint(); if (b === 1) done(); });
    };
    paint();
  }

  /* 7. Proposal 2: a worse setup on purpose. The fix changes nothing. */
  function proposalTwo({ el, done, kit }) {
    ensureStyle();
    let a = null;
    const fb = [
      [`Read the <code>except</code> line: it catches the <code>KeyError</code> and returns 500 again. The customer sees the same failure and the pager keeps firing. CI would pass anyway (${plural(FIX_RUN.blind.ci, "test")}): no test makes the code reach that <code>except</code> line.`, false],
      ["A test would expose it, but you can see the problem without one: catching the <code>KeyError</code> and returning 500 changes nothing for the customer. You do not need a test to tell you that. Reject it and give the agent what it lacked.", false],
      [`Right. The <code>except</code> part returns 500, so nothing changes for the customer. Replaying Friday's requests from 18:00 to the end through this proposal, <b>${FIX_RUN.blind.errors} of ${FIX_RUN.blind.requests}</b> still failed, as many as the ${LATE_ERRORS} with no fix at all. CI still passed (${plural(FIX_RUN.blind.ci, "test")}). The agent had no log and no carrier data, so it guessed at “a <code>KeyError</code> somewhere”. It was asked to stop 500s, not to find the cause, and it never said what the cause was. Same model as proposal 1; what it was given and what it was asked made the difference.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Proposal 2: accept, test, or reject?</h1>
        <p class="lead">A worse setup, on purpose. This time the agent got only the alert and the code: no log lines, no carrier data. The message said: “${kit.esc(BLIND_ASK)}” It was not asked for a test. A small hosted model answered:</p>
        ${said(kit, REC_BLIND.text, REC_BLIND.code)}
        <p class="task">What do you do with this proposal?</p>
        <div class="lpanel">${ask(kit, DECIDE, 2, a, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { a = +x.dataset.i; paint(); if (a === 2) done(); });
    };
    paint();
  }

  /* 8. The big picture: who does which job. */
  const WHO = ["A plain rule", "An agent", "A person"];
  const JOBS = [
    ["Send no more traffic to the new version when its error rate is well above the old version's", 0,
      ["Right. It is a comparison and a threshold, the same every time, needed within minutes. A few lines of code do it and can be tested.",
       "An agent could read the numbers, but it costs a model call each time, it can misread them, and it would need the power to deploy. A comparison and a threshold need no judgement.",
       "A person is slow at 3 a.m., and this needs no judgement: compare two rates, act. Page the person after the rule has acted."]],
    ["Read three hundred log lines and say which changed line the tracebacks point to", 1,
      ["A fixed rule can count errors, but it cannot connect a traceback to a line of a diff it has never seen. That is reading, not counting.",
       "Right. Slow reading across logs, code and diff is where an agent saves time, and reading changes nothing in production.",
       "A person can, but it is slow and tiring at night. Let the agent read and point; the person checks what it points at."]],
    ["Decide that the fix and its test go into main", 2,
      ["CI is a rule like this, and on Friday it passed a broken change. A rule only checks what it was written to check.",
       "The agent wrote the fix. Letting it approve its own work means nobody else ever reads it.",
       "Right. Merging is accepting responsibility for the change. The person reads the fix, checks that its test failed before and passes after, and decides."]]
  ];
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const ans = JOBS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Where an agent fits in a release</h1>
        <p class="lead"><b>For:</b> the reading part of deployment and on-call. The agent reads logs, traces (the timed steps of one request), the diff and the data. Then it proposes a fix with a test that fails without it. <b>Reach for it</b> when an alert needs someone to read a lot fast.</p>
        <p class="lead"><b>Not for</b> decisions a fixed rule makes (roll back on an error rate) or a person must own (merge, release). Not before the roll back: roll back first, diagnose after. Not when logs hold data you may not send to a model provider.</p>
        <p class="lead"><b>Costs:</b> model calls on large logs, a person's time on every proposal, and the risk of trusting a fix because CI is green.</p>
        <p class="task">Who should do each job?</p>
        ${JOBS.map(([q, r, f], i) => `<div class="lcase" id="j${i}"><p>${kit.esc(q)}</p>${kit.options(WHO, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(f[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (JOBS.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where the agent is the wrong choice. */
  const CASES = [
    ["A photo-sharing app: every morning an agent reads the night's error logs, groups tracebacks that look alike, and opens one draft issue per group naming the commit it suspects. A developer sorts the issues.", true,
      "Yes. It only reads, its output is a draft a person sorts, and nothing in production changes. That is the reading job an agent is good at.",
      "Nothing it does changes production: it reads logs and writes draft issues that a developer checks. Grouping tracebacks and linking them to commits is slow reading, the part an agent saves time on."],
    ["A ticket-booking site wants its agent to hold the deploy key, so it can roll back on its own at 3 a.m. when the error rate spikes.", false,
      "No. Rolling back when a number crosses a line is a rule: write it as the canary or alert rule, in code you can test. Giving a model the deploy key adds production write access for a job that needs no judgement, and a model can misread a spike.",
      "This is a threshold decision, not a reading job. A plain rule does it the same way every time and needs no model. The deploy key would let a model that misreads one graph change production on its own."],
    ["A payments team lets its agent merge its own fixes whenever CI is green, to shorten night-time outages.", false,
      `No. Green CI only means the tests someone wrote pass. On Friday, ${plural(CI_RELEASE.passed, "test")} passed on the broken release, and proposal 2 would have passed too. A person must approve, and a fix needs a test that failed before it.`,
      `CI checks only predicted cases: Friday's broken release passed ${plural(CI_RELEASE.passed, "test")}, and so did a “fix” that changed nothing. With the agent merging its own work, nobody else reads it before customers do.`],
    ["After a release, a recipe site's pages load twice as slowly. An agent compares slow-request traces from before and after the release and points to a new database query that runs once per ingredient.", true,
      "Yes. It reads and compares traces and proposes a cause. A person checks the query and decides what to change.",
      "Comparing many traces from before and after a release is reading work. The agent changes nothing; it points, and a person decides. That is the job it fits."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A job for the agent?</h1>
        <p class="lead">Four teams, four plans for an agent around releases and incidents.</p>
        <p class="task">Is each plan a good use of an agent? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (in-page practice: nothing extra). */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>A release path for agent work</h1>
      <p class="lead">You put the gates in order and saw why green tests were not enough: the agent's code and its test came from the same examples. A canary, a few lines of plain code, would have rolled the release back after ${plural(CHECKS[CHECKS.length - 1].canary.errors, "failed request")}. You found the cause in the log, gave the on-call agent read access and a branch but no production writes, asked for a test that fails before the fix, and rejected a fix that changed nothing.</p>
      <p class="lead">In short: let an agent do the reading and propose a fix on a branch. Leave the roll back to a plain rule and the merge to a person. The cost is model calls and a person's review of every proposal.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You have guarded what gets released; next you look at the service that is released and runs for real users.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Agents in deployment and monitoring",
    checked: "2026-11-18",
    sources: [
      "https://sre.google/workbook/canarying-releases/",
      "https://sre.google/sre-book/monitoring-distributed-systems/",
      "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches",
      "https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments",
      "https://code.claude.com/docs/en/github-actions"
    ],
    interview: [
      {
        q: "Your team wants a coding agent to fix production incidents on its own at night. How would you set it up?",
        good: [
          "Give it read access to logs, traces, the code and the data it needs, and write access only to a branch and a pull request",
          "Ask for the cause and a fix with a test that reproduces the failing input: it must fail on the current code and pass on the fix",
          "A person approves the merge; the agent never approves or merges its own change",
          "Release through CI, then a canary compared with the old version, rolled back by a plain rule, not by the agent",
          "No deploy keys and no production database writes for the agent; roll back first, diagnose after"
        ],
        weak: "Give the agent production access so it can fix things fast, and trust CI to catch its mistakes. That misses that CI only checks cases someone wrote down, and that production writes skip every review."
      },
      {
        q: "An agent-written change passed CI and review, then broke one request in four after release. What went wrong, and what would you add?",
        good: [
          "The tests came from the same example data as the code, so they shared its blind spot; real data had a case nobody wrote down",
          "Read the log and the failing input to find the case, and turn it into a regression test that fails before the fix",
          "Add a canary: a small share of real traffic, its error rate compared with the old version's, and an automatic roll back",
          "Add real samples, such as events straight from the carrier, to the test data"
        ],
        weak: "Use a stronger model, or ask the agent for more tests. Its new tests come from the same examples, and nothing checks real traffic before everyone gets the change."
      }
    ],
    screens: [gateOrder, greenTests, canaryGate, readLog, permissions, proposalOne, proposalTwo, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="3"]'], right: ORDER.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: CHECKS.map(() => "[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#p0 [data-wrong]"], right: PERMS.map((_, i) => `#p${i} [data-right]`) },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#j0 [data-wrong]"], right: JOBS.map((_, i) => `#j${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
