/* Lesson: spec, plan, then code. Story: a developer at a second-hand bicycle marketplace asks a coding agent to
   add saved searches ("save a search, get an email when a matching bike is listed").
   Ideas: (1) a plan is only useful when every step can be checked on its own, in an order where each check can
   run, and the step that switches the feature on comes last; (2) the decisions belong in a short spec written
   before the plan (what is in, what is out, where data lives, what "done" means), and the plan is reviewed
   against that spec before any code is written.
   Data, all real:
   - docs/ai-path/recordings/s5c-spec-plan/idea-plan.json (main checkout): the plan a small hosted model wrote from
     the one-line product request and the repo notes (request: docs/ai-path/runs/s5c-spec-plan/idea-plan.request.json);
   - docs/ai-path/recordings/s5c-spec-plan/spec-plan-full.json: the plan the same model wrote from the same notes
     plus the spec in docs/ai-path/runs/s5c-spec-plan/spec.md (request: spec-plan-full.request.json). An earlier
     recording, spec-plan.json, asked the same with max_tokens 900 and was cut off; it is not shown.
   The repo notes (runs/.../repo_notes.txt) and the spec are text written for the lesson, not model output. The model
   read no real repository. No code is executed in this lesson.
   Lesson-local style: plan lists, a spec block and the reorder rows (.lx-s5c-spec-plan-*), see ensureStyle(). */
(() => {
  const ID = "s5c-spec-plan";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the recordings (text not altered) ---------- */
  // From docs/ai-path/recordings/s5c-spec-plan/idea-plan.json, choices[0].message.content (whole answer)
  const REC_IDEA = {
    src: "s5c-spec-plan/idea-plan",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    outTokens: 289, // usage.completion_tokens
    text: "1. Create a new table `saved_searches` in the database to store user's saved search criteria.\n2. Add a new API endpoint in `api/listings/` to allow users to save a search.\n3. Add a new API endpoint in `api/listings/` to allow users to view their saved searches.\n4. Add a new API endpoint in `api/listings/` to allow users to delete a saved search.\n5. Modify the `jobs/runner.ts` to include a new scheduled job that runs frequently (e.g., every 15 minutes).\n6. Create a new job file `jobs/notifySavedSearches.ts` that queries for new listings matching saved searches and sends emails to users.\n7. Update the `api/lib/email.ts` to include a new email template for \"new listing found\".\n8. Implement the frontend logic in `web/pages/Search.tsx` to allow users to save their current search filters.\n9. Implement the frontend logic to display and manage saved searches for a logged-in user.\n10. Add API calls from the frontend to the new backend endpoints for saving, viewing, and deleting saved searches.\n11. Write API tests for the new saved search endpoints.\n12. Write E2E tests for the frontend functionality of saving and managing searches."
  };
  // From docs/ai-path/recordings/s5c-spec-plan/spec-plan-full.json, choices[0].message.content (whole answer)
  const REC_SPEC = {
    src: "s5c-spec-plan/spec-plan-full",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    outTokens: 962, // usage.completion_tokens
    text: "1. Create a new migration file for the `saved_searches` table.\n   - Check: Migration file created in `db/migrations/`.\n2. Add the `saved_searches` table schema to the migration file: `id` (serial primary key), `user_id` (integer, foreign key to users.id), `name` (varchar), `filters` (jsonb), `last_notified_at` (timestamp with time zone, nullable), `created_at` (timestamp with time zone, default now()).\n   - Check: `saved_searches` table schema defined in the migration.\n3. Implement API endpoints for saved searches:\n    - `POST /api/saved-searches`: Save a new search.\n    - `GET /api/saved-searches`: List saved searches for the logged-in user.\n    - `DELETE /api/saved-searches/:id`: Delete a saved search.\n   - Check: API endpoints for saving, listing, and deleting saved searches are implemented.\n4. Update `api/listings/search.ts` to accept `saved_search_id` as a query parameter to retrieve listings matching a specific saved search.\n   - Check: `api/listings/search.ts` can filter listings by `saved_search_id`.\n5. Implement the logic to limit saved searches to 10 per user in the `POST /api/saved-searches` endpoint.\n   - Check: Saved search creation respects the 10-per-user limit.\n6. Add a new job `jobs/sendSavedSearchEmails.ts` to run daily.\n   - Check: `sendSavedSearchEmails.ts` file created in `jobs/`.\n7. Implement the `sendSavedSearchEmails.ts` job:\n    - Fetch all users with saved searches.\n    - For each user, iterate through their saved searches.\n    - For each saved search, query for new listings created since `last_notified_at` (or since the search was created if `last_notified_at` is null) that match the saved search's filters.\n    - If matching listings are found, send an email to the user using the `sendEmail` function with a new template `savedSearchEmail.ejs`.\n    - Update `last_notified_at` for the saved search to the current time after sending the email.\n   - Check: `sendSavedSearchEmails.ts` job logic is implemented.\n8. Update `jobs/runner.ts` to include the new `sendSavedSearchEmails.ts` job in the daily schedule.\n   - Check: `sendSavedSearchEmails.ts` is scheduled in `jobs/runner.ts`.\n9. Create a new email template `api/emails/savedSearchEmail.ejs` to display the matching listings.\n   - Check: `savedSearchEmail.ejs` template created.\n10. Implement the UI for saved searches in `web/pages/Search.tsx` and `web/components/SearchFilters.tsx`:\n    - Add a button to \"Save Search\" on the search page.\n    - Display a list of saved searches.\n    - Add functionality to delete a saved search.\n    - When a saved search is clicked, pre-fill the search filters and trigger a search.\n   - Check: UI elements for saving, listing, and deleting saved searches are implemented.\n11. Add API calls from the React frontend to the new backend endpoints for saved searches.\n    - Check: Frontend correctly interacts with the saved searches API.\n12. Write API tests for the new saved searches endpoints in `tests/api/savedSearches.test.ts`.\n    - Check: API tests for saved searches are written and passing.\n13. Write E2E tests for the saved searches feature in `tests/e2e/savedSearches.spec.ts`.\n    - Check: E2E tests for saved searches are written and passing.\n14. Ensure all existing API tests (`npm run test:api`) pass.\n    - Check: All API tests pass.\n15. Ensure all existing E2E tests (`npm run test:e2e`) pass.\n    - Check: All E2E tests pass.\n16. Manually verify that a listing created after a buyer saved a matching search appears in that buyer's next daily email, exactly once.\n    - Check: Manual verification of email content and frequency."
  };
  const CAPTION = `Recorded model output, ${REC_IDEA.recordedAt}`;
  // The product manager's request, as sent in idea-plan.request.json
  const REQUEST = "Buyers should be able to save a search and get an email when a new bike that matches it is listed.";
  // From docs/ai-path/runs/s5c-spec-plan/repo_notes.txt (shortened for the screen; the full notes were sent)
  const NOTES = [
    ["api/", "Express + TypeScript. Search is GET /api/listings?brand=&max_price=&frame_size=&city="],
    ["web/", "React. Search page web/pages/Search.tsx"],
    ["db/", "PostgreSQL with migrations. Tables: users, listings(…, created_at)"],
    ["jobs/", "scheduled jobs started by jobs/runner.ts"],
    ["email", "sendEmail(to, templateName, data); templates in api/emails/"],
    ["tests", "Jest for the API, Playwright for the web app"]
  ];
  // Shortened from docs/ai-path/runs/s5c-spec-plan/spec.md (the full spec was sent with spec-plan-full; lesson text, not model output)
  const SPEC = [
    ["Goal", "A buyer who does not find a bike today hears about a matching one later, without searching again."],
    ["In scope", "A logged-in buyer can save the current filters under a name, see the list, and delete one. At most 10 per buyer."],
    ["In scope", "Once a day, each buyer gets one email listing new listings that match any of their saved searches. No email if nothing matches."],
    ["Out of scope", "Push notifications, editing a saved search, logged-out users."],
    ["Decision", "Storage: one new table saved_searches(id, user_id, name, filters jsonb, last_notified_at, created_at). No other schema change. The data team reviews the migration."],
    ["Decision", "Matching reuses the filter logic in api/listings/search.ts."],
    ["Done when", "A listing created after a buyer saved a matching search appears in that buyer's next daily email, exactly once. npm run test:api and npm run test:e2e pass."]
  ];
  const SPEC_RULE = "if something you need is not in the spec, list it as an open question instead of deciding it"; // spec-plan-full.request.json

  /* ---------- Derived from the recordings ---------- */
  const P1 = REC_IDEA.text.split("\n").filter(l => /^\d+\. /.test(l)).map(l => l.replace(/^\d+\. /, ""));
  const P2 = REC_SPEC.text.split(/\n(?=\d+\. )/).map(b => {
    const lines = b.split("\n");
    return {
      title: lines[0].replace(/^\d+\. /, ""),
      check: (lines.find(l => /^\s*- Check: /.test(l)) || "").replace(/^\s*- Check: /, ""),
      subs: lines.slice(1).filter(l => /^\s*- /.test(l) && !/^\s*- Check: /.test(l)).map(l => l.replace(/^\s*- /, ""))
    };
  });
  const at1 = f => P1.findIndex(f);
  const TABLE1 = at1(s => s.startsWith("Create a new table"));
  const API1 = [at1(s => s.includes("save a search")), at1(s => s.includes("view their saved")), at1(s => s.includes("delete a saved"))];
  const RUNNER1 = at1(s => s.includes("jobs/runner.ts"));
  const JOB1 = at1(s => s.includes("notifySavedSearches.ts"));
  const TPL1 = at1(s => s.includes("email template"));
  const SAVEUI1 = at1(s => s.includes("save their current search filters"));
  const LISTUI1 = at1(s => s.includes("display and manage"));
  const CALLS1 = at1(s => s.startsWith("Add API calls"));
  const APITEST1 = at1(s => s.startsWith("Write API tests"));
  const E2E1 = at1(s => s.startsWith("Write E2E tests"));
  const at2 = f => P2.findIndex(f);
  const SCHEMA2 = at2(s => s.title.startsWith("Add the `saved_searches` table schema"));
  const MIGR2 = at2(s => s.title.startsWith("Create a new migration"));
  const SEARCH2 = at2(s => s.title.includes("saved_search_id"));
  const LIMIT2 = at2(s => s.title.includes("limit saved searches to 10"));
  const JOBFILE2 = at2(s => s.title.startsWith("Add a new job"));
  const JOB2 = at2(s => s.title.startsWith("Implement the `sendSavedSearchEmails.ts` job"));
  const UI2 = at2(s => s.title.startsWith("Implement the UI"));
  const MANUAL2 = at2(s => s.title.startsWith("Manually verify"));
  const OPEN_QUESTIONS = (REC_SPEC.text.match(/open question/gi) || []).length;
  const DB2 = P2.filter(s => /migration|table|schema/i.test(s.title)).length; // steps that touch the schema
  const n1 = i => i + 1; // step number shown on screen

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-steps .lopts { flex-direction: column; gap: 8px; }
      .lx-${ID}-steps .lopts button { width: 100%; font-weight: 500; font-size: 15.5px; line-height: 1.45; padding: 10px 14px; }
      .lx-${ID}-steps .lopts button b { font-family: var(--mono); font-weight: 600; margin-right: 6px; }
      .lx-${ID}-plan { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-plan li { display: grid; grid-template-columns: 2.2em 1fr; gap: 0 8px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-plan li > span:first-child { font: 600 14px/1.6 var(--mono); color: var(--muted); }
      .lx-${ID}-plan li.lx-${ID}-on { border-left: 3px solid var(--ink); padding-left: 8px; }
      .lx-${ID}-plan small { display: block; color: var(--muted); font-size: 14.5px; margin-top: 2px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-kv { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-kv div { display: grid; grid-template-columns: 6.5em 1fr; gap: 2px 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .lx-${ID}-kv div > span:first-child { font: 600 13px/1.6 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-kv code, .lx-${ID}-plan code { font: 500 13.5px var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-quote { margin: 12px 0 0; padding: 10px 14px; border-left: 3px solid var(--line); background: var(--sunk); font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-rec { margin: 10px 0 0; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; }
      .lx-${ID}-rec ul { margin: 4px 0 0; padding-left: 1.2em; }
      .lx-${ID}-rec .lx-${ID}-chk { margin-top: 6px; font-family: var(--mono); font-size: 13.5px; }
      .lx-${ID}-order { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-row p { margin: 0; font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-row p b { font-family: var(--mono); font-weight: 600; margin-right: 4px; }
      .lx-${ID}-row .btn { min-height: 44px; min-width: 64px; }
      .lx-${ID}-act { margin-top: 14px; }
      .lx-${ID}-act .btn { min-height: 48px; padding-left: 18px; padding-right: 18px; }
      @media (max-width: 520px) {
        .lx-${ID}-kv div { grid-template-columns: 1fr; }
        .lx-${ID}-row { grid-template-columns: 1fr 1fr; }
        .lx-${ID}-row p { grid-column: 1 / -1; }
      }
    `;
    document.head.appendChild(s);
  }
  const ticks = (kit, s) => kit.esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); // escape, then show `x` as code
  const stepBtn = (kit, i, s) => `<b>${n1(i)}.</b>${ticks(kit, s)}`;
  const kv = (kit, rows) => `<div class="lx-${ID}-kv">${rows.map(([k, v]) => `<div><span>${kit.esc(k)}</span><span>${ticks(kit, v)}</span></div>`).join("")}</div>`;
  const recStep = (kit, i) => {
    const s = P2[i];
    return `<div class="lx-${ID}-rec"><b>${n1(i)}.</b> ${ticks(kit, s.title)}${s.subs.length ? `<ul>${s.subs.map(x => `<li>${ticks(kit, x)}</li>`).join("")}</ul>` : ""}<div class="lx-${ID}-chk">- Check: ${ticks(kit, s.check)}</div></div>`;
  };
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  /* Several small questions on one screen: cases = [{ q, opts, right, fb: [html per option] }]. */
  function cases(kit, list, ans, extra) {
    return list.map((c, i) => `<div class="lcase" id="c${i}">${c.q}${extra ? `<div class="${extra}">` : ""}${kit.options(c.opts, { picked: ans[i], correct: c.right })}${extra ? "</div>" : ""}${ans[i] == null ? "" : kit.feedback(c.fb[ans[i]], ans[i] === c.right)}</div>`).join("");
  }
  function wireCases(el, list, ans, paint, done) {
    el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
      ans[i] = +b.dataset.i; paint();
      if (list.every((x, j) => ans[j] === x.right)) done();
    }));
  }

  /* 1. The situation: the agent's first plan, and the step that needs a database change it never names. */
  function hiddenChange({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const fb = P1.map((s, i) => {
      if (i === JOB1) return [`Right. To email only <b>new</b> matches, the job must know what it already sent. There are two ways. It can look at listings created in the last 15 minutes. Then a late or skipped run misses listings, and two runs that overlap email them twice. Or it can store something, such as a “last checked” time per saved search or a table of sent emails. That is a schema change, and step ${n1(TABLE1)}'s table does not include it. The request said nothing about it, and the plan does not say it either. Someone has to <b>decide</b> it. In this plan, the agent will decide it halfway through writing code, and you find out in the diff.`, true];
      if (i === TABLE1) return [`Step ${n1(TABLE1)} changes the database out loud. Anyone reading the plan sees the new table and can ask about it. The question is about a change the plan needs but never names. Which step has to remember something from one run to the next?`, false];
      if (i === RUNNER1) return [`This changes the job schedule in code, not the database. Its “every 15 minutes” is also a decision nobody made: the request did not say how often buyers get email. Keep that in mind. But no table changes here.`, false];
      if (i === TPL1) return [`A template is a file in the code. It stores nothing. (A smaller slip: the repo notes say templates live in <code>api/emails/</code>, not in <code>api/lib/email.ts</code>. Worth flagging in the review too.)`, false];
      if (API1.includes(i)) return [`This endpoint reads or writes the <code>saved_searches</code> table from step ${n1(TABLE1)}. The table it needs is already named in the plan. Nothing new has to be stored.`, false];
      if ([SAVEUI1, LISTUI1, CALLS1].includes(i)) return ["This is web app code. It calls the API and keeps nothing in the database itself.", false];
      return ["Tests check behaviour. They read the database, but they do not change its shape.", false];
    });
    const paint = () => {
      el.innerHTML = `<h1>Saved searches, planned in seconds</h1>
        <p class="lead">Nadia is a developer at a second-hand bicycle marketplace. The product manager's ticket says: “${kit.esc(REQUEST)}” Nadia pastes the ticket and short notes about the codebase into a coding agent, and asks for a numbered plan before any code:</p>
        ${kv(kit, NOTES)}
        <p class="lead">A small hosted model, acting as the agent, answered with this ${P1.length}-step plan. It read only the notes, not a real repository. This lesson is about that moment: reading the plan before the agent writes code, while a wrong guess is still one line to fix.</p>
        <p class="task">One step can only work if the database stores something that the plan never mentions. Which step?</p>
        <div class="lpanel lx-${ID}-steps">${ask(kit, P1.map((s, i) => stepBtn(kit, i, s)), JOB1, ans, fb)}</div>
        <p class="lx-${ID}-cap">${CAPTION}</p>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === JOB1) done(); });
    };
    paint();
  }

  /* 2. Give each step its own check: keep, split, or merge. */
  function ownCheck({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const C = [
      { q: `<p>Step ${n1(API1[0])}: ${ticks(kit, P1[API1[0]])}</p>`, right: 0,
        opts: ["Its own test, right after it: a Jest test posts filters as a logged-in buyer and finds one new saved search for that buyer",
          `The browser test in step ${n1(E2E1)}, which clicks through saving, listing and deleting a search`,
          "Open the file and see that the endpoint is there"],
        fb: [`Right. The step is small and does one thing, so one API test proves it. If it fails, you know exactly which step broke, and nothing else is built on it yet.`,
          `That test needs the web page from steps ${n1(SAVEUI1)} to ${n1(CALLS1)}. If this endpoint is wrong, you find out after ${plural(E2E1 - API1[0], "more step")} were built on top of it.`,
          "A file that exists can still be wrong. A check has to come back pass or fail when you run it, so the agent can run it too."] },
      { q: `<p>Step ${n1(JOB1)}: ${ticks(kit, P1[JOB1])}</p>`, right: 1,
        opts: ["One Jest test for the whole job, run right after the step with a few fixed listings",
          "Split it in two: (a) find the matching new listings, tested with a few fixed listings and saved searches; (b) send the emails, tested with a fake sendEmail that records each call",
          "Turn it on for a day and read the emails that go out"],
        fb: ["When that test fails, you will not know whether the matching or the sending broke. A step that does two jobs gets a check that cannot say which one failed.",
          "Right. The step did two things, so it gets two checks. Each half is small enough that a failing test points at it. The matching half is also where the open question from screen 1 lives (what counts as new), so it gets looked at on its own.",
          "That checks it on real buyers. A wrong match or a double email has already reached them before you notice."] },
      { q: `<p>Step ${n1(SAVEUI1)}: ${ticks(kit, P1[SAVEUI1])}</p>`, right: 2,
        opts: ["A browser test right after it: click Save, reload the page, and see the new saved search in the list",
          `Leave it as it is. Steps ${n1(APITEST1)} and ${n1(E2E1)} test everything at the end`,
          `Merge it with the part of step ${n1(CALLS1)} that calls the save endpoint. Then check: a browser test clicks Save, and the API then returns the new saved search`],
        fb: [`That test cannot pass yet. The page calls the API only in step ${n1(CALLS1)}, and the list appears in step ${n1(LISTUI1)}. A check that has to wait for later steps is not this step's check.`,
          "Then nothing is checked for most of the plan, and when the end-to-end test fails, the cause can be in any of a dozen steps.",
          `Right. The plan split the work by layer (page here, API calls in step ${n1(CALLS1)}), so neither half works alone. Merged, the step is a thin slice through the stack that a user could try, and one test proves it.`] }
    ];
    const paint = () => {
      el.innerHTML = `<h1>Every step gets its own check</h1>
        <p class="lead">In this plan, all the tests sit in the last two steps, ${n1(APITEST1)} and ${n1(E2E1)}. When one fails, the bug can be in any of the ${APITEST1} steps before them. A good step ends with its own check: a test or command that passes or fails, and can run as soon as the step is done. Then a failure points at one step. Some steps must be split for that, some merged.</p>
        <p class="task">For each step, choose what makes it checkable right after it is done.</p>
        ${cases(kit, C, ans, `lx-${ID}-steps`)}`;
      wireCases(el, C, ans, paint, done);
    };
    paint();
  }

  /* 3. Reorder: each step must be checkable when it is done, and the switch-on step goes last. */
  function reorder({ el, done, kit }) {
    ensureStyle();
    const TEXT = { run: P1[RUNNER1], job: P1[JOB1], tpl: P1[TPL1] };
    const NUM = { run: RUNNER1, job: JOB1, tpl: TPL1 };
    let order = ["run", "job", "tpl"], verdict = null;
    const judge = () => {
      const r = order.indexOf("run"), j = order.indexOf("job"), t = order.indexOf("tpl");
      if (r < j) return [false, `Step ${n1(RUNNER1)} still comes before step ${n1(JOB1)}: it adds the new job to the runner before the job's file (step ${n1(JOB1)}) exists. The runner has nothing to load, so step ${n1(RUNNER1)} cannot be checked when it is done.`];
      if (r < t) return [false, `Now the job runs for real before its email template exists. The first scheduled run tries to email buyers with a template that is not there yet. The step that switches the job on must wait for everything it uses.`];
      return [true, `Right. Build the pieces, check each one, and switch the feature on last. Registering the job is the switch: from then on it runs on real listings and emails real buyers. So it gets its own step and its own check, such as a run against a test database that sends the expected email to a fake inbox.${j < t ? "" : " Template first or job first both work, since the job's test uses a fake sendEmail."}`];
    };
    const paint = () => {
      el.innerHTML = `<h1>Put the steps in an order you can check</h1>
        <p class="lead">These three steps came in this order in the agent's plan (the numbers are the plan's). Two facts decide the order. A step can be checked only if what it needs already exists when it is done. And adding a job to <code>jobs/runner.ts</code> is what starts it on its schedule.</p>
        <p class="task">Move the steps until each one can be checked when it is done, then check the order.</p>
        <div class="lx-${ID}-order">${order.map((k, i) => `<div class="lx-${ID}-row"><p><b>${n1(NUM[k])}.</b>${ticks(kit, TEXT[k])}</p><button type="button" class="btn" data-up="${k}" aria-label="Move step ${n1(NUM[k])} up" ${i === 0 ? "disabled" : ""}>Up</button><button type="button" class="btn" data-down="${k}" aria-label="Move step ${n1(NUM[k])} down" ${i === order.length - 1 ? "disabled" : ""}>Down</button></div>`).join("")}</div>
        <div class="lpanel"><div class="lx-${ID}-act"><button type="button" class="btn" data-check>Check this order</button></div>
        ${verdict ? kit.feedback(verdict[1], verdict[0]) : ""}</div>`;
      const move = (k, d) => { const i = order.indexOf(k); const o = order.slice(); [o[i], o[i + d]] = [o[i + d], o[i]]; order = o; verdict = null; paint(); };
      el.querySelectorAll("[data-up]").forEach(b => b.onclick = () => move(b.dataset.up, -1));
      el.querySelectorAll("[data-down]").forEach(b => b.onclick = () => move(b.dataset.down, 1));
      el.querySelector("[data-check]").onclick = () => { verdict = judge(); paint(); if (verdict[0]) done(); };
    };
    paint();
  }

  /* 4. Spot the idea: decide first, in a spec, then review the plan against it. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Ask the agent for a longer, more detailed plan",
      "Let the agent write the code, then review the diff carefully",
      "Before the plan, write a short spec: what is in, what is out, the decisions (how often email goes, what is stored), and what “done” means. Then check the plan against it",
      "Tell the agent not to touch the database"
    ];
    const fb = [
      ["More detail on the same guesses. The agent cannot know how often buyers want email or what the data team allows. A longer plan only makes the guesses harder to spot.", false],
      [`By then the decision is code: a migration, a job, tests and a template built on it, spread over many files. Changing it means redoing work. Seen in a ${P1.length}-line plan, it is one line to fix.`, false],
      [`Right. The <b>spec</b> holds what and why, and the decisions only people can make. The <b>plan</b> is how: ordered steps, each with its own check. The <b>code</b> comes last. You review the plan against the spec before the agent edits a file, so a decision nobody made shows up as a line that is not in the spec. If you do not know the decisions yet, you can ask the agent to interview you until it could write the spec (Claude Code's best-practices page suggests exactly this). Claude Code also has a <b>plan mode</b>: the agent reads files and writes a plan, and its edits stay blocked until you approve the plan.`, true],
      ["The feature needs storage, so a ban forces a hack, such as stuffing saved searches into another table. The point is not to forbid the change. The point is that someone decides it, out loud, before code.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where should the decision have happened?</h1>
        <p class="lead">The first plan holds three things nobody decided. How does the job know what is new? It needs stored state. How often do buyers get email? Step ${n1(RUNNER1)} picked “every 15 minutes”, and the ticket says nothing about it. When is each step checked? All tests wait until the end. The agent did not do anything strange. It filled the gaps in a one-line ticket with guesses.</p>
        <p class="task">What would have caught these decisions before any code was written?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 5. Write the spec: sort lines into spec, plan or neither. */
  function sortSpec({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null, null, null];
    const O = ["Spec", "Plan", "Neither"];
    const C = [
      { q: `<p>“${ticks(kit, SPEC[4][1])}”</p>`, right: 0, opts: O,
        fb: ["Right. Where data lives, and that nothing else changes, is a decision people make, and the data team must agree to it. It goes in the spec so the plan can be checked against it.",
          "The plan says how to build it, step by step. Whether this table exists at all is a decision the plan has to follow, so it is settled before the plan is written.",
          "It has to be written somewhere. Left out, the agent picks a storage design for you. That is exactly what happened on screen 1."] },
      { q: `<p>“${ticks(kit, SPEC[2][1])}”</p>`, right: 0, opts: O,
        fb: ["Right. How often buyers get email is a product decision. The first plan guessed every 15 minutes.",
          "This is a decision about behaviour that users see, not a building step. The plan then needs a step that makes it true, with a test that checks it.",
          "Without it, the agent picks a schedule. The first plan picked every 15 minutes, which may flood buyers' inboxes."] },
      { q: `<p>“${ticks(kit, P1[JOB1])}”</p>`, right: 1, opts: O,
        fb: ["This names a file and what it does: it says <i>how</i>, not <i>what</i>. A spec full of file names turns into code written in prose, and it goes stale with every refactor.",
          "Right. File names and order of work belong in the plan, which the agent can write once the spec is clear. (This line is from the agent's first plan.)",
          "It is a real step of the work, so it belongs somewhere: in the plan."] },
      { q: "<p>“Use clear variable names and follow the existing code style.”</p>", right: 2, opts: O,
        fb: ["It is true for every task the team does, not for this feature. Repeating it in each spec adds noise to the part people read.",
          "It is not a step of work, and it has no check of its own.",
          "Right. It is a rule for every task, not a part of this feature. Rules like that belong in the project's standing instructions for the agent, which the next lesson covers."] },
      { q: `<p>“${ticks(kit, SPEC[6][1])}”</p>`, right: 0, opts: O,
        fb: ["Right. “Done when” is a test anyone can run, the agent included. It turns “looks finished” into pass or fail, and it is the line you review the finished work against.",
          "The plan's steps each have small checks. This is the check for the whole feature, the goal the steps add up to, so it is part of the spec.",
          "Without it, the agent stops when the work looks done. A done line gives it something that comes back pass or fail."] }
    ];
    const paint = () => {
      el.innerHTML = `<h1>Write the spec</h1>
        <p class="lead">A spec is short: the goal, what is in and out, the decisions, and what “done” means. It does not say which files to change; the plan does that.</p>
        <p class="task">Sort each line: does it belong in the spec, in the plan, or in neither?</p>
        ${cases(kit, C, ans)}`;
      wireCases(el, C, ans, paint, done);
    };
    paint();
  }

  /* 6. Predict, then see: the plan written from the spec. */
  function predictPlan({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Exactly the table the spec names, and no other schema change",
      "The table, plus a second table of sent emails to avoid sending twice",
      "It stops and lists open questions about storage before planning"
    ];
    const reveal = `<p class="lead">The plan it wrote, step titles only (${plural(P2.length, "step")}, ${REC_SPEC.outTokens} output tokens; the first plan was ${REC_IDEA.outTokens}):</p>
      <ol class="lx-${ID}-plan">${P2.map((s, i) => `<li class="${i === MIGR2 || i === SCHEMA2 ? `lx-${ID}-on` : ""}"><span>${n1(i)}</span><span>${ticks(kit, s.title.length > 150 && s.title.includes(":") ? s.title.slice(0, s.title.indexOf(":") + 1) + " …" : s.title)}</span></li>`).join("")}</ol>
      <p class="lx-${ID}-cap">${CAPTION}</p>`;
    const fb = [
      [`Right. Only ${plural(DB2, "step")} touch the schema (${n1(MIGR2)} and ${n1(SCHEMA2)}), and they build exactly the spec's table. The job uses <code>last_notified_at</code> to know what is new. The decision was made once, by people, and the plan followed it. One more thing: the agent was told to list open questions, and its answer mentions ${OPEN_QUESTIONS === 0 ? "none at all" : plural(OPEN_QUESTIONS, "open question")}. Did it really need to decide nothing? The next screen checks.`, true],
      ["The spec already answers that: <code>last_notified_at</code> records when each saved search was last emailed. A second table would be a schema change the spec rules out (“No other schema change”).", false],
      [`The spec settles storage, so there is nothing to ask about it. And in this run the model listed ${OPEN_QUESTIONS === 0 ? "no open questions at all" : plural(OPEN_QUESTIONS, "open question")}, about storage or anything else, although it was told to.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Predict the second plan</h1>
        <p class="lead">Nadia writes the spec. The same model gets the same notes, the spec below (shortened here; the model got the full text), and two more instructions: name a check after each step, and “${kit.esc(SPEC_RULE)}”.</p>
        ${kv(kit, SPEC)}
        <p class="task">Before you see the plan: what will it do about the database?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>
        ${ans === 0 ? reveal : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 7. Review the plan against the spec before letting the agent execute it. */
  function review({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null, null];
    const O = ["Approve", "Send back"];
    const C = [
      { q: recStep(kit, LIMIT2), right: 0, opts: O,
        fb: ["Right. The spec says at most 10 per buyer, and the check can become a test: save ten, the eleventh is refused.",
          "This matches the spec's “at most 10 per buyer”, and its check can be a test that fails if the limit is wrong. Sending back a good step costs a round trip for nothing."] },
      { q: recStep(kit, SEARCH2), right: 1, opts: O,
        fb: ["The spec says matching <i>reuses</i> the filter logic. It does not ask for a new parameter on the public search endpoint. This is a change nobody asked for, made to an API other code may depend on. The agent was told to raise this kind of thing as an open question, and it decided instead.",
          `Right. The spec asks to reuse the filter logic, not to change the public search API. That new parameter is scope nobody agreed to. (Step ${n1(UI2)} adds one more: clicking a saved search re-runs it, which the spec never asked for.)`] },
      { q: recStep(kit, JOB2), right: 1, opts: O,
        fb: ["Read the loop: it sends an email for <i>each saved search</i> with matches. The spec says <b>one</b> email per buyer, listing matches from any of their saved searches. A buyer with five saved searches could get up to five emails a day.",
          "Right. The plan sends one email per saved search. The spec says one email per buyer per day. Caught here, it is one line in the plan. Caught in the diff, it is a job, its tests and a template to rework."] },
      { q: `<p>Judge only this step's check line:</p>${recStep(kit, JOBFILE2)}`, right: 1, opts: O,
        fb: ["An empty file passes this check. A check is useful only if it fails when the work is wrong. Ask for one that can fail: a test that runs the job on fixed data and expects one email.",
          `Right. “File created” passes for an empty file. Several checks in this plan are like that (“logic is implemented”), and the feature's own done line became step ${n1(MANUAL2)}, a manual check. Ask for checks that come back pass or fail.`] }
    ];
    const paint = () => {
      el.innerHTML = `<h1>Review the plan before it runs</h1>
        <p class="lead">Before the agent edits a file, Nadia reads the plan against the spec. For each piece: does it match the spec, and can its check actually fail? Four pieces from the recorded plan, not altered:</p>
        <p class="task">Approve each piece, or send it back to the agent.</p>
        ${cases(kit, C, ans)}
        <p class="lx-${ID}-cap">${CAPTION}</p>`;
      wireCases(el, C, ans, paint, done);
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The model bill: writing a spec and a plan for each change uses many tokens",
      "Time: a one-line text fix now waits for a spec and a plan review, so people start skipping the process",
      "The agent gets worse at coding, because it has less freedom"
    ];
    const fb = [
      [`A plan is short. The first one here was ${REC_IDEA.outTokens} output tokens, the spec-based one ${REC_SPEC.outTokens}. That is small next to the cost of an agent writing code in the wrong direction. The model bill is not what bites first.`, false],
      ["Right. The cost of the method is people's time: writing the spec and reading the plan. On a change whose diff is one line, that time buys nothing, because reading the diff is the review. Spend it where a wrong guess is expensive to undo.", true],
      ["The spec takes away guesses, not skill. The agent still writes the code. Look at who does the extra work when every change, even a tiny one, needs a spec and a plan review.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to write a spec and a plan</h1>
        <p class="lead"><b>What it is:</b> a short spec that settles the decisions, a plan of small steps that each have a check, and a review of the plan before the agent writes code.</p>
        <p class="lead"><b>Use it for</b> work that touches several parts (database, API, page, jobs), carries decisions other people must agree to, or will run for a long time without you watching.</p>
        <p class="lead"><b>Reach for it</b> when a wrong guess is costly to undo: a schema, a public API, email to real users.</p>
        <p class="lead"><b>Not</b> for a change whose diff you can read in a minute, a bug whose failing test already says what “fixed” means, or a throwaway experiment where you do not yet know what you want. Build the experiment first, then spec the real thing.</p>
        <p class="lead"><b>Costs:</b> your time up front, a spec that goes stale unless someone updates it, and a spec so detailed that it becomes code written in prose.</p>
        <p class="task">A team now requires a spec and a reviewed plan for every agent change. Which cost bites first?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where a spec and plan are the wrong tool. */
  const CASES = [
    ["A ticket asks to change the button text “Search” to “Find bikes” on one page.", false,
      "No. The ticket is already the spec, and the whole change is one line you can read in the diff. A spec and a plan review would take longer than the change and its review together.",
      "A spec earns its time by catching decisions before code. Here there is nothing to decide, and the diff is one line, so reading the diff is the review."],
    ["Add a “report this listing” flow: a form for buyers, a new table for reports, an admin page for moderators, and an email to the moderators.", true,
      "Yes. It touches the database, the API, two pages and email, and it carries decisions: who may report, what moderators see, how often they get email. Settle those in a spec, then review the agent's plan against it.",
      "Look at the decisions inside it: what a report stores, who sees it, how moderators are told. An agent will guess each one, and a new table is costly to change later. That is what a spec is for."],
    ["You want to know whether either of two map libraries can draw 5,000 bike pins smoothly. The code will be thrown away.", false,
      "No. You do not know yet what you want, so a spec would be a list of guesses. Let the agent build a quick throwaway test of both, learn from it, and write the spec for the real feature afterwards.",
      "A spec needs decisions, and here the experiment is how you find them. Planning effort should match the stakes: a throwaway test needs little, so build it, then spec the real thing."],
    ["Move the price formatting that is copied into 14 components into one shared helper. Nothing the user sees may change.", true,
      "Yes, a short one. The spec is one line: no visible change. The plan matters more: steps small enough that each ends with a check, such as the existing tests or a before-and-after screenshot of each page.",
      "It touches 14 places, and “nothing may change” is a promise you can only keep with a check after each step. A short spec and a plan of small, checked steps make that safe."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Spec and plan, or just do it?</h1>
        <p class="lead">Four tasks you could hand to a coding agent.</p>
        <p class="task">Would you write a spec and review a plan before the agent writes code? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Decide first, then let it type</h1>
      <p class="lead">You found the decision that a ${P1.length}-step plan made without saying so. You split, merged and reordered steps until each had its own check. You sorted spec lines from plan lines. Then you reviewed a plan written from the spec and caught two changes the spec never asked for and a check that could not fail.</p>
      <p class="lead">The order to remember: <b>spec</b> (what, what not, the decisions, what done means), <b>plan</b> (small steps, each with a check that can fail, the switch-on step last), <b>review</b> the plan against the spec, and only then <b>code</b>.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A spec carries the decisions for one feature. The rules that hold for every task, like the style line you sorted into “neither”, go into the project's standing instructions, and permissions decide what the agent may run at all.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Spec, plan, then code: steering an agent before it types",
    checked: "2026-11-17",
    sources: [
      "https://code.claude.com/docs/en/best-practices",
      "https://code.claude.com/docs/en/permission-modes",
      "https://www.deeplearning.ai/resources/ai-engineering-skills"
    ],
    interview: [
      {
        q: "You gave a coding agent a one-line feature ticket. It opened a pull request of thirty files that also added a database column nobody asked for. How do you change the way you work with it?",
        good: [
          "Write a short spec first: goal, in and out of scope, the decisions such as storage, and a testable definition of done",
          "Ask for a plan before any edits (for example a plan mode that blocks edits until you approve) and read it against the spec",
          "Require every step to end with a check that can fail, and put the step that switches the feature on last",
          "Tell the agent to raise anything the spec does not cover as an open question, and still review for silent decisions, because it may decide anyway",
          "Review the finished change against the spec's done line, not only by reading the diff"
        ],
        weak: "Review the pull requests more carefully, or tell the agent not to touch the database. That catches decisions only after they are code, or bans a change the feature may need."
      },
      {
        q: "Your lead asks you to write a spec and a plan for every task you give the agent. When would you push back?",
        good: [
          "When the diff is small enough to read in a minute: the review of the diff is cheaper than a spec",
          "When a failing test already defines what fixed means, so the test is the spec",
          "For a throwaway experiment, where you do not know the decisions yet; spec the real feature after it",
          "Keep the spec and plan for work with costly-to-undo decisions: schemas, public APIs, messages to users"
        ],
        weak: "Agree to always write one, or say specs are never needed with a good model. Both ignore that the cost is people's time and should match what a wrong guess would cost."
      }
    ],
    screens: [hiddenChange, ownCheck, reorder, spotIdea, sortSpec, predictPlan, review, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["[data-check]"], right: ['[data-down="run"]', '[data-down="run"]', "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: [0, 1, 2, 3, 4].map(i => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: [0, 1, 2, 3].map(i => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
