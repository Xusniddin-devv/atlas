/* Lesson: agent memory across sessions, retros and cleanup. Story: a museum ticketing system after a month of
   mostly agent-written changes. Ideas: (1) every coding-agent session starts with an empty context, so what an
   agent learned is lost unless it is written into a file that the next session loads (the instruction file,
   every session) or can read when it needs it (a note); (2) after a long run, a short retrospective decides
   where each learning lives (instruction file, note, or nowhere), edits it into a concrete line, and cleans up
   the duplicates and dead files the run left behind.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5c-agent-memory-retro/session-1..3, session-4-bare,
     session-4-agents-md (one model call per "session", each seeing only the file it changes) and retro (the
     retrospective over session_log.md), requests built by docs/ai-path/runs/s5c-agent-memory-retro/make_requests.py
     from museum/ (the code base before the sessions, plus museum/AGENTS.md);
   - docs/ai-path/runs/s5c-agent-memory-retro/extract_sessions.py wrote after-month/ from the recordings, plus the
     leftover files of the story; cleanup_scan.py + cleanup_scan.out.txt is the scan shown on the cleanup screen;
     same_output.py + same_output.out.txt compares the hand-written formatting with format_euros.
   - session_log.md is story input written by us, not model output.
   Lesson-local style: clickable code lines, log excerpts, sort card (.lx-s5c-agent-memory-retro-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s5c-agent-memory-retro";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs and recordings ---------- */
  const REC_META = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17" };
  const CAPTION = `Recorded model output, ${REC_META.recordedAt}`;
  // make_requests.py SYSTEM, the system prompt of every session (written by us)
  const SESSION_SYSTEM = "You are a coding agent working in a museum's Python ticketing code base. In this session you can see only the file you are asked to change. Team style: small, named helper functions where they make the code clearer. Reply with the complete new contents of the file in one ```python block and nothing else.";

  // From docs/ai-path/recordings/s5c-agent-memory-retro/session-1..3.json: only the new function of each file is
  // shown (the unchanged top of the file is cut, marked …). Lines are not altered. dup: lines that turn cents into
  // euros text (the division and the format that prints it).
  const SESSIONS = [
    { src: "s5c-agent-memory-retro/session-1", date: "Oct 1", file: "tickets/school_groups.py",
      task: "group_quote(pupils, teachers): one line for the booking confirmation, with the pupils, the teachers and the price in euros.",
      lines: [
        "def group_quote(pupils, teachers):",
        "    \"\"\"Return a string quote for a school group booking.\"\"\"",
        "    total_cost_cents = calculate_total_cost_cents(pupils, teachers)",
        "    cost_euros = total_cost_cents / 100",
        "    return f\"{pupils} pupils, {teachers} teachers: €{cost_euros:.2f}\""
      ], div: 3, fmt: 4 },
    { src: "s5c-agent-memory-retro/session-2", date: "Oct 2", file: "tickets/receipts.py",
      task: "item_line(name, quantity, unit_cents): one receipt line, exactly RECEIPT_WIDTH characters wide.",
      lines: [
        "def item_line(name, quantity, unit_cents):",
        "    \"\"\"Returns one receipt line: the name and quantity on the left and the line total in euros on the right.\"\"\"",
        "    line_total_euros = quantity * unit_cents / 100",
        "    left_side = f\"{name} x{quantity}\"",
        "    right_side = f\"€{line_total_euros:.2f}\"",
        "    padding = RECEIPT_WIDTH - len(left_side) - len(right_side)",
        "    return left_side + \" \" * padding + right_side"
      ], div: 2, fmt: 4 },
    { src: "s5c-agent-memory-retro/session-3", date: "Oct 6", file: "tickets/members.py",
      task: "renewal_reminder(first_name, plan): the reminder e-mail, with the plan's yearly price in euros.",
      lines: [
        "def renewal_reminder(first_name, plan):",
        "    \"\"\"Returns the text of the renewal reminder e-mail.\"\"\"",
        "    price_cents = plan_price_cents(plan)",
        "    price_euros = price_cents / 100",
        "    return f\"Dear {first_name},\\n\\nYour {plan} membership is due for renewal.\\n\\nThe yearly price is €{price_euros:.2f}.\\n\\nWe hope to see you soon!\""
      ], div: 3, fmt: 4 }
  ];

  // session 4, the same task twice: tickets/exhibitions.py, surcharge_text(slug) like 'Lighthouses in Photographs: +€4.50'
  // From session-4-bare.json (no instruction file), the last three lines of the function, not altered
  const REC_BARE = { src: "s5c-agent-memory-retro/session-4-bare", lines: [
    "    surcharge_cents = exhibition[\"surcharge_cents\"]",
    "    surcharge_euros = surcharge_cents / 100",
    "    return f\"{title}: +€{surcharge_euros:.2f}\""
  ] };
  // From session-4-agents-md.json (AGENTS.md first), not altered; the EXHIBITIONS dict and the docstring cut (each …)
  const REC_WITH = { src: "s5c-agent-memory-retro/session-4-agents-md", lines: [
    "from tickets.money import format_euros",
    "…",
    "def surcharge_text(slug: str) -> str:",
    "    …",
    "    exhibition = EXHIBITIONS.get(slug)",
    "    if exhibition:",
    "        title = exhibition[\"title\"]",
    "        surcharge = exhibition[\"surcharge_cents\"]",
    "        return f\"{title}: +{format_euros(surcharge)}\"",
    "    return \"\""
  ] };
  // docs/ai-path/runs/s5c-agent-memory-retro/museum/AGENTS.md, word for word (written by us)
  const AGENTS_MD = [
    "# Museum ticketing: notes for coding agents",
    "",
    "- Run the tests with `make test` (it sets the test database); plain `pytest` fails.",
    "- Every amount of money is an int number of cents. Never use float for money.",
    "- Show money with `format_euros(cents)` from `tickets/money.py`. Do not write a new formatter.",
    "- Timed-entry slots are stored in UTC; show them in Europe/Amsterdam time."
  ];

  // From docs/ai-path/recordings/s5c-agent-memory-retro/retro.json: the 15 learnings, word for word.
  // log: the lines of session_log.md (written by us) that the learning comes from. home: 0 instruction file, 1 note, 2 drop.
  const HOMES = ["Instruction file", "Note", "Drop"];
  const RETRO = [
    { t: "Always run `make test` to set up the test database before running `pytest`.", home: 0,
      log: "Oct 1: The agent ran plain `pytest` first and every database test failed; `make test` sets the test database and works. Oct 9: again plain `pytest` first, again failing database tests, again `make test` fixed it.",
      why: ["It went wrong twice, and it applies to every session that changes code. That is what the instruction file is for. (Read the wording closely; the next screen comes back to it.)",
        "A note is read only when the agent thinks to look. On Oct 1 and Oct 9 it did not know there was anything to look up. A rule needed in every session must be in front of it at the start.",
        "It happened twice in one month. A mistake that repeats is the clearest sign a line belongs in the instruction file."] },
    { t: "Avoid creating custom euro formatters; use a shared utility function.", home: 0,
      log: "Oct 2: The agent added its own euro formatter in receipts.py. Oct 6: Another euro formatter, this time in members.py. Oct 22: a third euro formatter appeared, in school_groups.py.",
      why: ["Every feature that shows a price needs it, and three sessions got it wrong. One line at the start of every session prevents the fourth copy.",
        "The three sessions that wrote copies had no idea a formatter was worth looking for. A rule they never read cannot stop them.",
        "Three copies in a month, so it will happen again. Keep it, as a line in the instruction file."] },
    { t: "Ensure external data sources provide clean, correctly formatted CSV files.", home: 2,
      log: "Oct 3: the CSV from the tourist office had an extra header row on line 2. Fixed by hand, the tourist office has corrected their export.",
      why: ["It happened once, it is fixed, and the fix was made at the source by the tourist office. An agent cannot act on it, so a line would cost every session for nothing.",
        "Nothing is left to do or to know: the export is corrected. A note about it only goes stale.",
        "Right to drop: a one-off event, already fixed at the source, and not something an agent can act on."] },
    { t: "Use integer cents for all monetary calculations to avoid floating-point errors.", home: 0,
      log: "Oct 6: Review caught float maths on a price (19.99 * 3); every amount must be an int number of cents.",
      why: ["Every piece of code that touches a price needs it. Short, always true, and the agent will not guess it: instruction file.",
        "Any price calculation in any session can get it wrong, and the agent will not go looking for a money note before multiplying a price.",
        "Review had to catch it. A rule that review keeps catching should be read by the agent before it writes the code."] },
    { t: "Store all datetimes in UTC and convert to the local timezone for display.", home: 0,
      log: "Oct 8: a slot showed 09:00 instead of 11:00. Slots are stored in UTC and must be shown in Europe/Amsterdam time.",
      why: ["Any screen that shows a time needs it, the mistake reached visitors, and it fits in one line. (Notice that the line does not say which local time zone; your file should.)",
        "It is short and it applies wherever a time is shown. The mistake reached visitors, and the agent had no reason to look for a note before printing a time.",
        "Visitors saw the wrong opening time for their slot. One short line is worth that."] },
    { t: "Document the rationale for significant architectural decisions like choosing a hosted checkout page.", home: 1,
      log: "Oct 10: we chose the payment provider's hosted checkout page over our own card form so that card numbers never touch our servers. Long discussion; the reasons and the rejected options are in the meeting notes.",
      why: ["The reasons and the rejected options are long, and they matter only when someone works on payments. In the instruction file every session would pay for them. A note, read when payments are touched, fits.",
        "A decision and its reasons, needed only for payment work: a note. When someone (or some agent) suggests building our own card form again, the note answers why not.",
        "Someone will propose our own card form again. Without the reasons written down, the team has the long discussion a second time."] },
    { t: "Changes to modules owned by other teams must follow their established review and approval processes.", home: 0,
      log: "Oct 13: the agent edited gift_shop/stock.py. The gift shop module belongs to the retail team; changes there go through a ticket to them.",
      why: ["The agent must know before it edits, and it could not have known. One line, naming the folder and the team, belongs in the file loaded every session. (The model's sentence names neither; yours should.)",
        "The agent had no reason to suspect the folder belonged to another team, so it would never open a note about it. It needs this before it edits, at the start.",
        "It already happened once, and nothing in the code says who owns the folder. Keep it."] },
    { t: "Pre-commit hooks for code formatting like `black` should be enabled to ensure consistency.", home: 2,
      log: "Oct 14: black reformatted three files the agent wrote. The pre-commit hook runs black on every commit anyway.",
      why: ["The hook already runs black on every commit. A line in the instruction file is only a request; the hook enforces it. Do not spend context on what a tool already does.",
        "There is nothing to look up: the hook already formats every commit. Nobody needs a note to get this right.",
        "Right to drop: the pre-commit hook already does this on every commit, so no line or note is needed."] },
    { t: "Key rotation procedures, like for QR codes, should be documented and regularly reviewed.", home: 1,
      log: "Oct 15: the QR code signing key was rotated. Steps: generate the key with `make qr-key`, put it in the vault, restart the scanners at both entrances, check one ticket at each gate. Needed about once a year.",
      why: ["A multi-step procedure needed about once a year. Loaded into every session, it costs context on every unrelated task. Keep it where the person or agent doing the rotation will read it.",
        "A rare procedure with exact steps: a note, read on the day of the next rotation.",
        "Once a year is too rare for anyone to remember the steps, and a mistake stops the scanners at both entrances. Write the steps down, as a note."] },
    { t: "Development environments should be free from resource-intensive background processes that can slow down tests.", home: 2,
      log: "Oct 16: the tests were slow today because the laptop was also running a video call.",
      why: ["One slow afternoon on one laptop is not about the code. A line about it would sit in every session for nothing.",
        "There is nothing to act on later. A note about one slow afternoon is noise the next reader has to skip.",
        "Right to drop: one afternoon, one laptop, nothing to do with the code."] },
    { t: "Business rules that change frequently, like visitor capacity, should be stored in a flexible way, not hardcoded.", home: 1,
      log: "Oct 20: capacity rule for timed slots changed twice this month: first 120 visitors per slot, then 100 for the Lighthouses exhibition only, because of the fire code in the east wing. The current numbers live in the slots table.",
      why: ["It matters only for capacity work, and the numbers already live in the slots table. What is worth keeping is the history behind them, and that is detail for a note, not a rule for every session.",
        "Yes, though not the model's general sentence. What is worth keeping is why the Lighthouses exhibition has 100: the fire code in the east wing. Someone raising it back to 120 needs that. Keep it as a note about slots.",
        "The general sentence adds little, but the reason behind the number does: the fire code in the east wing. Without it, the next change may raise the limit back to 120."] },
    { t: "Remove all temporary or debug files from the repository before committing.", home: 0,
      log: "Oct 21: the agent left debug_slots.py, scratch_prices.py and receipts.py.bak in the repository.",
      why: ["The agent leaves these files while it works, in any session. A rule it reads at the start can stop it. (An ignore rule or a check before commit is stronger still.)",
        "The leftovers appear during ordinary work, in any session. The agent needs the rule before it starts, not in a note it opens later.",
        "Three leftover files in one month, and someone had to clean them up. Keep it."] },
    { t: "Ensure the agent runs all relevant tests, not just a subset, before declaring success.", home: 0,
      log: "Oct 27: the agent said \"all tests pass\" after running only the receipt tests.",
      why: ["Any session can claim success too early, so the rule belongs at the start of every session. Make it concrete: \"run `make test`, the whole suite, before saying done\".",
        "Claiming success after part of the tests can happen in any session. It needs to be in front of the agent every time.",
        "\"All tests pass\" after only part of them is the failure that slips through a review. Keep it."] },
    { t: "User feedback from front-line staff regarding usability should be captured and acted upon.", home: 2,
      log: "Oct 28: Maria from the front desk prefers receipts printed in a larger font; she will ask the supplier.",
      why: ["Maria is asking the printer supplier. There is no code change and nothing for an agent to do.",
        "It is not about the code base. It belongs on the front desk's own list, not in the agents' notes.",
        "Right to drop: the receipt font is a printer question for the supplier, not code."] },
    { t: "Incomplete tasks should be clearly tracked and dependencies identified.", home: 1,
      log: "Oct 24: unfinished: moving the old booking pages to the new templates. Done: home, calendar. Left: group booking, members area. The members area needs the new login first.",
      why: ["Only the session that continues the move needs this, and it changes each time a page moves. In the instruction file it would go stale and cost every other session.",
        "A progress note: what is done, what is left, what waits for what. The next session on this task reads it first instead of working it out again.",
        "Two pages are left and one waits for the new login. Without a note, the next session has to work all that out again."] }
  ];
  const REC_RETRO_SRC = "s5c-agent-memory-retro/retro";

  // docs/ai-path/runs/s5c-agent-memory-retro/cleanup_scan.out.txt, word for word
  const SCAN_OUT = [
    "Cents turned into euros by hand:",
    "  scratch_prices.py:2: print(1999 * 3 / 100)",
    "  tickets/exhibitions.py:18: surcharge_euros = surcharge_cents / 100",
    "  tickets/members.py:13: price_euros = price_cents / 100",
    "  tickets/receipts.py:12: line_total_euros = quantity * unit_cents / 100",
    "  tickets/receipts.py.bak:12: line_total_euros = quantity * unit_cents / 100",
    "  tickets/school_groups.py:24: cost_euros = total_cost_cents / 100",
    "Not imported by any Python file:",
    "  debug_slots.py",
    "  scratch_prices.py",
    "  scripts/nightly_export.py",
    "Backup files:",
    "  tickets/receipts.py.bak"
  ];
  const CRONTAB = "15 2 * * * cd /srv/museum && python scripts/nightly_export.py"; // after-month/deploy/crontab
  const EXPORT_DOC = "Exports yesterday's ticket sales for the finance team. Run by cron, see deploy/crontab."; // after-month/scripts/nightly_export.py docstring
  // same_output.out.txt: amounts checked, amounts that print differently
  const SAME = { checked: 1000001, differ: 0 };

  /* ---------- Derived from the data ---------- */
  const DUP_KEYS = SESSIONS.map((s, f) => [`${f},${s.div}`, `${f},${s.fmt}`]);
  const SCAN_DIV = SCAN_OUT.filter(l => l.includes("/ 100"));
  const listOf = head => { const i = SCAN_OUT.indexOf(head); const out = []; for (let k = i + 1; k < SCAN_OUT.length && SCAN_OUT[k].startsWith("  "); k++) out.push(SCAN_OUT[k].trim()); return out; };
  const CANDIDATES = [...new Set([...listOf("Not imported by any Python file:"), ...listOf("Backup files:")])];
  const KEEP_FILE = "scripts/nightly_export.py";
  const CRON_TIME = (() => { const [m, h] = CRONTAB.split(" "); return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`; })();
  const TICKET_DIV = SCAN_DIV.filter(l => l.trim().startsWith("tickets/") && !l.includes(".bak"));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-file { margin: 16px 0 0; }
      .lx-${ID}-fname { font: 600 13.5px/1.4 var(--mono); color: var(--ink); margin: 0 0 2px; }
      .lx-${ID}-ftask { font-size: 14.5px; line-height: 1.45; color: var(--muted); margin: 0 0 6px; }
      .lx-${ID}-lines { border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); overflow: hidden; }
      .lx-${ID}-ln { display: block; width: 100%; min-height: 44px; margin: 0; padding: 8px 10px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--ink); text-align: left; font: 500 13.5px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; }
      .lx-${ID}-ln:last-child { border-bottom: 0; }
      .lx-${ID}-ln:hover { background: var(--surface); }
      .lx-${ID}-ln.lx-${ID}-hit { background: var(--good-soft); box-shadow: inset 4px 0 0 var(--good); }
      .lx-${ID}-ln.lx-${ID}-miss { background: var(--bad-soft); box-shadow: inset 4px 0 0 var(--bad); }
      .lx-${ID}-pre { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-card { margin: 14px 0 0; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
      .lx-${ID}-learn { margin: 0; font-size: 17px; line-height: 1.5; color: var(--ink); }
      .lx-${ID}-num { font: 600 13px var(--mono); color: var(--muted); margin: 0 0 6px; }
      .lx-${ID}-log { margin: 10px 0 0; padding: 8px 0 0; border-top: 1px solid var(--line); font-size: 14.5px; line-height: 1.5; color: var(--ink-2); }
      .lx-${ID}-log b { color: var(--muted); font: 600 12.5px var(--mono); text-transform: uppercase; letter-spacing: .04em; margin-right: 6px; }
      .lx-${ID}-homes { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-homes li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 640px) { .lx-${ID}-two { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  const pre = (kit, lines) => `<pre class="lx-${ID}-pre">${lines.map(l => kit.esc(l)).join("\n")}</pre>`;
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation, and finding the repeated code by hand. */
  function findRepeats({ el, done, kit }) {
    ensureStyle();
    const found = SESSIONS.map(() => false);
    let miss = null, msg = null, ok = null;
    const paint = () => {
      const all = found.every(Boolean);
      el.innerHTML = `<h1>The same job, written again and again</h1>
        <p class="lead">A museum's ticket system has had a month of changes, most written by a coding agent. Each change was a separate <b>session</b>: a fresh start of the agent with one task. This lesson is about what an agent forgets between sessions, and how a team makes it remember. Below are the functions three sessions added (recorded model output). To keep the run small, each session saw only the file it had to change. Its prompt also had one style line: write “small, named helper functions”.</p>
        <p class="task">Every amount in this code is an int number of cents. In each file, find the line that turns cents into euros for display. Tap it.</p>
        ${SESSIONS.map((s, f) => `<div class="lx-${ID}-file"><p class="lx-${ID}-fname">${kit.esc(s.date)} · ${kit.esc(s.file)} ${found[f] ? "· found" : ""}</p><p class="lx-${ID}-ftask">${kit.esc(s.task)}</p>
          <div class="lx-${ID}-lines"><div class="lx-${ID}-ln" aria-hidden="true" style="cursor:default">…</div>${s.lines.map((ln, l) => {
            const key = `${f},${l}`, isDup = DUP_KEYS[f].includes(key);
            const cls = found[f] && isDup ? ` lx-${ID}-hit` : miss === key ? ` lx-${ID}-miss` : "";
            return `<button type="button" class="lx-${ID}-ln${cls}" data-i="${key}">${kit.esc(ln)}</button>`;
          }).join("")}</div></div>`).join("")}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <div class="lpanel">${all ? kit.feedback(`All three. Each session divided by 100 and printed the result with <code>:.2f</code>, each with its own variable name: <code>cost_euros</code>, <code>line_total_euros</code>, <code>price_euros</code>. None of them put this job in a named helper, and none reused a previous copy. ${SESSIONS.length} copies of one small job, in ${plural(SESSIONS.length, "file")}, and each one does money in float, which the team will soon rule out.`, true) : msg ? kit.feedback(msg, ok) : ""}</div>`;
      el.querySelectorAll(`button.lx-${ID}-ln`).forEach(b => b.onclick = () => {
        const key = b.dataset.i, [f, l] = key.split(",").map(Number);
        if (DUP_KEYS[f].includes(key)) {
          found[f] = true; miss = null;
          const left = found.filter(x => !x).length;
          msg = left ? `Yes: <code>${kit.esc(SESSIONS[f].lines[SESSIONS[f].div].trim())}</code>, then <code>:.2f</code> to print it. ${plural(left, "file")} to go.` : null; ok = true;
          paint(); if (found.every(Boolean)) done(); return;
        }
        miss = key; ok = false;
        const ln = SESSIONS[f].lines[l];
        msg = l === 0 ? "That is the function's name and arguments. Look inside it for where a number of cents becomes text with a euro sign."
          : ln.includes("\"\"\"") ? "That is the docstring, a description. It does no work. Look for a division by 100."
          : ln.includes("calculate_total_cost_cents") || ln.includes("plan_price_cents") ? "That gets the amount, still in cents. The conversion to euros comes on a later line."
          : ln.includes("padding") || ln.includes("left_side") ? "That lays out the receipt line. It does not touch the money; look for the line that divides by 100."
          : "That uses the euros text, but it is not where the cents are turned into euros. Look for a division by 100.";
        paint();
      });
    };
    paint();
  }

  /* 2. Spot the idea: why the same code three (four) times. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The model is careless. A stronger model would have found and reused the earlier code",
      "Each session started empty: nothing in what it was given said that money already had a way to be shown, or that floats were ruled out",
      "The style line told it to write helpers, so it wrote new ones",
      "It ran at temperature 0, which makes a model repeat itself"
    ];
    const RIGHT = 1;
    const fb = [
      ["A stronger model starts each session just as empty. Here it saw one file with no earlier copy in it. A real agent can also search the code base, but nothing told it that the team had ruled out floats or that a copy was worth looking for.", false],
      [`Right. A model keeps nothing between calls, and a coding agent's session starts with a fresh context. Whatever the October 6 review taught the team, the next session did not know it. Unless a lesson is <b>written into a file the next session loads</b>, it is gone. Coding tools have such a file: an <b>instruction file</b>, read at the start of every session (Claude Code reads <code>CLAUDE.md</code>, or <code>AGENTS.md</code> when there is no <code>CLAUDE.md</code>; many other coding agents read <code>AGENTS.md</code>).`, true],
      ["None of them wrote a helper for this job: each put the division inline. The style line did not cause the repeats; the sessions just had no way to know about each other.", false],
      ["Temperature 0 makes the model pick its most likely words, so the same request gives a steadier answer. It does not connect separate sessions: each one still starts with nothing from the others.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did it keep doing that?</h1>
        <p class="lead">On October 6, review caught float maths on a price, and the team agreed that money stays an int number of cents. Then a fourth session added the surcharge line (the extra price of an exhibition). Recorded, with the same setup:</p>
        ${pre(kit, ["# tickets/exhibitions.py, surcharge_text(slug)", "…", ...REC_BARE.lines])}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="task">Four sessions, four copies of the same division by 100, the last one after the review. What is the cause?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Predict: the same fourth session with the instruction file loaded first. */
  function predictWithFile({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It divides by 100 again, as before",
      "It imports format_euros from tickets/money.py and uses it",
      "It stops and asks where tickets/money.py is, since it cannot see that file",
      "It writes its own format_euros function in exhibitions.py"
    ];
    const RIGHT = 1;
    const result = `<div class="lx-${ID}-two"><div><p class="lx-${ID}-fname">without the file</p>${pre(kit, ["…", ...REC_BARE.lines])}</div><div><p class="lx-${ID}-fname">with AGENTS.md first</p>${pre(kit, REC_WITH.lines)}</div></div><p class="lx-${ID}-cap">${CAPTION}</p>`;
    const RIGHT_FB = `It did. Same model, same task, same file; the only difference was the instruction file at the start. A small hosted model wrote both. This is one run, so it shows what this model did here, not a guarantee. It also changed something nobody asked for: an unknown exhibition now gives an empty string instead of an error, so review still matters.${result}
      <p class="lead">Two things made the line work. It was <b>in the context</b>, because it was loaded at the start, not filed somewhere. And it was <b>concrete</b>: a file and a function name, not “use a shared utility”. The tool loads the file, but the model reads it as context, not as a setting it must obey. To make something impossible, use a check or a hook instead.</p>`;
    const fb = [
      ["The four lines name the function and the file and forbid a new formatter, and they are part of what the model reads. Without them it had nothing to go on; with them it does.", false],
      [RIGHT_FB, true],
      ["It does not need to see money.py to import from it: the instruction file gives the module path and the function name. It is still worth checking that the import works, by running the tests.", false],
      ["The file says “Do not write a new formatter” and names the one to use. Writing its own would go against a line it has just read.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Give the next session the lesson</h1>
        <p class="lead">At the end of the month, the team writes a short instruction file, <code>AGENTS.md</code>, at the root of the code base. They also add one shared function, <code>format_euros</code>, in <code>tickets/money.py</code>. To see what the file changes, we ran the fourth session again with the file put before the task. That is how a coding tool loads its instruction file at the start of every session:</p>
        ${pre(kit, AGENTS_MD)}
        <p class="task">Same model, same task, same single file to change. What does the session write this time?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. The retro: sort fifteen recorded learnings into instruction file, note, or drop. */
  function sortRetro({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const placed = [];
    const paint = () => {
      const fin = k >= RETRO.length;
      const it = RETRO[Math.min(k, RETRO.length - 1)];
      const counts = HOMES.map((_, h) => RETRO.filter(r => r.home === h).length);
      el.innerHTML = `<h1>The retro: where does each learning go?</h1>
        <p class="lead">At the end of the month the team runs a short <b>retrospective</b> (a retro): a look back at what happened. They kept a short dated log of October's work. They give it to a small hosted model and ask it for ${RETRO.length} learnings. Then a person decides where each one goes:</p>
        <ul class="lx-${ID}-homes">
          <li><b>Instruction file</b>: loaded at the start of every session. Short rules true for any task: commands, conventions, where things live, what not to touch.</li>
          <li><b>Note</b>: a file the agent or a person reads when the task needs it. Decisions and their reasons, rare procedures, one area's history, unfinished work.</li>
          <li><b>Drop</b>: one-off events already fixed, what a tool already enforces, things that are not about the code.</li>
        </ul>
        ${fin ? "" : `<p class="task">Where does learning ${k + 1} of ${RETRO.length} go?</p>
        <div class="lx-${ID}-card"><p class="lx-${ID}-num">learning ${k + 1} / ${RETRO.length}</p><p class="lx-${ID}-learn">${kit.esc(it.t)}</p><p class="lx-${ID}-log"><b>from the log</b>${kit.esc(it.log)}</p></div>
        <p class="lx-${ID}-cap">${CAPTION} (the learning). The log was written by the team.</p>`}
        <div class="lpanel">${fin ? "" : kit.options(HOMES, { picked: wrong, correct: it.home })}
        ${!fin && wrong != null ? kit.feedback(it.why[wrong], false) : ""}
        ${k > 0 && !fin && wrong == null ? kit.feedback(`Learning ${k}: ${RETRO[k - 1].why[RETRO[k - 1].home]}`, true) : ""}
        ${fin ? kit.feedback(`Done. ${HOMES.map((h, i) => `${h}: ${counts[i]}`).join(", ")}. Learning ${RETRO.length}: ${RETRO[RETRO.length - 1].why[RETRO[RETRO.length - 1].home]} The test for each line: does it change what an agent does in <b>most</b> sessions? Then the instruction file. Only for some tasks? A note. Neither? Drop it, even if it sounds wise.`, true) : ""}
        ${placed.length ? `<div class="vars">${HOMES.map(h => `<span>${h.toLowerCase()} <b>${placed.filter(p => p[1] === h).length}</b></span>`).join("")}<span>sorted <b>${placed.length} / ${RETRO.length}</b></span></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== RETRO[k].home) { wrong = v; paint(); return; }
        placed.push([k + 1, HOMES[v]]); wrong = null; k++; paint();
        if (k >= RETRO.length) done();
      });
    };
    paint();
  }

  /* 5. Edit before you keep: the model's learning 1 does not say what the log says. */
  function editFirst({ el, done, kit }) {
    ensureStyle();
    let step = 0, ans = null;
    const L1 = RETRO[0];
    const Q = [
      { opts: ["Only `make test`", "`make test`, then plain `pytest`, the command that failed on October 1 and 9", "Only plain `pytest`"].map(s => kit.esc(s)), right: 1,
        fb: [["That is what the log says to do, but not what learning 1 says. Read it again: it calls <code>make test</code> a setup step “before running <code>pytest</code>”.", false],
          null,
          ["Learning 1 does mention <code>make test</code> first. The trouble is what it says comes after.", false]] },
      { opts: [
          L1.t,
          "Run the tests with `make test` (it sets the test database); plain `pytest` fails.",
          "Be careful to run the tests the right way."
        ].map(s => `<span style="text-align:left">${kit.esc(s)}</span>`), right: 1,
        fb: [["That is the model's draft unchanged, and you just saw where it sends the next agent: back to plain <code>pytest</code>.", false],
          null,
          ["Too vague to act on. Which way is right? A fresh session reads this line and still runs plain <code>pytest</code>. A good line names the command.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(step, 1)];
      el.innerHTML = `<h1>Check the learning against the log</h1>
        <p class="lead">A retro's list is a draft. The model wrote learning 1 from these two log lines:</p>
        <div class="lx-${ID}-card"><p class="lx-${ID}-learn">${kit.esc(L1.t)}</p><p class="lx-${ID}-log"><b>from the log</b>${kit.esc(L1.log)}</p></div>
        <p class="lx-${ID}-cap">${CAPTION} (the learning).</p>
        ${step < 2 ? `<p class="task">${step === 0 ? "A fresh session follows learning 1 word for word. What does it run?" : "Which line goes into the instruction file?"}</p>` : ""}
        <div class="lpanel">${step < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Right. That is the first line of the <code>AGENTS.md</code> you saw on screen 3. The draft turned “use <code>make test</code> instead of <code>pytest</code>” into “run <code>make test</code>, then <code>pytest</code>”, which sends the agent back to the command that failed on October 1 and 9. So a person checks each kept learning against the log and rewrites it to name something exact: a command, a file, a function name. The same goes for learning 2 (“a shared utility function”, which one?) and learning 7 (which modules, which team?).`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[step].right) { step++; ans = null; paint(); if (step === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 6. Cleanup: the scan's candidates, and the one that is not dead. */
  function cleanup({ el, done, kit }) {
    ensureStyle();
    const ans = CANDIDATES.map(() => null); // 0 delete, 1 keep
    const right = f => f === KEEP_FILE ? 1 : 0;
    const say = (f, v) => {
      if (f === KEEP_FILE) return v === 1
        ? [`Keep it. The scan only reads Python imports. <code>deploy/crontab</code> starts this file every night: <code>${kit.esc(CRONTAB)}</code>. Its first line says what it does: “${kit.esc(EXPORT_DOC)}” Deleting it would stop that export without one failing test.`, true]
        : [`Look at <code>deploy/crontab</code> above: <code>${kit.esc(CRONTAB)}</code> starts this file at ${CRON_TIME} every night (its own first line says so too: “${kit.esc(EXPORT_DOC)}”). The scan reads only Python imports, so it cannot see a file started by cron or a shell script. “Not imported” is a reason to check, not proof it is dead.`, false];
      if (f.endsWith(".bak")) return v === 0 ? ["Delete. A backup copy of a file that is in version control already; it even shows up in the scan as one more copy of the division by 100.", true]
        : ["Version control already keeps every earlier version of <code>receipts.py</code>. The backup is a fourth copy of the division by 100, waiting to be edited by mistake.", false];
      return v === 0 ? [`Delete. A scratch file from a debugging session: nothing imports it, nothing starts it, and the log names it as a leftover.`, true]
        : [`The log of October 21 names it as a leftover from a session, and nothing imports or starts it. Keeping it means the next agent may read it, or copy from it, as if it were real code.`, false];
    };
    const paint = () => {
      const all = CANDIDATES.every((f, i) => ans[i] === right(f));
      el.innerHTML = `<h1>Clean up what the run left behind</h1>
        <p class="lead">The last step of the retro is cleanup. We ran a small scan over the code base as it stood after the month: lines that divide by 100, Python files no other Python file imports, and backup files. Its real output (each found line as file:line number: code):</p>
        ${pre(kit, SCAN_OUT)}
        <p class="lead">One more file in the code base, <code>deploy/crontab</code>, the server's schedule of nightly jobs. <code>${kit.esc(CRONTAB.split(" ").slice(0, 5).join(" "))}</code> means at ${CRON_TIME} every day:</p>
        ${pre(kit, [CRONTAB])}
        <p class="task">For each file in the scan's last two lists, delete it or keep it.</p>
        ${CANDIDATES.map((f, i) => `<div class="lcase" id="c${i}"><p><code>${kit.esc(f)}</code></p>${kit.options(["Delete", "Keep"], { picked: ans[i], correct: right(f) })}${ans[i] == null ? "" : kit.feedback(...say(f, ans[i]))}</div>`).join("")}
        ${all ? `<div class="lpanel">${kit.feedback(`Done. Then the repeats: the ${plural(TICKET_DIV.length, "line")} in <code>tickets/</code> that divide by 100 become calls to <code>format_euros</code>. Before swapping, we checked that both print the same text for every amount from 0 to ${(SAME.checked - 1).toLocaleString("en")} cents: ${SAME.differ === 0 ? "no differences" : plural(SAME.differ, "difference")}. That is why the cleanup comes with a check (the tests, or a comparison like this one): a merged copy that prints differently is a new bug. And a rule in the instruction file keeps the copies from coming back.`, true)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CANDIDATES.every((f, j) => ans[j] === right(f))) done();
      }));
    };
    paint();
  }

  /* 7. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Nothing: more rules means fewer mistakes",
      "Every session pays for all 600 lines in context, and the agent follows each line less reliably",
      "The file stops loading once it passes a size limit"
    ];
    const RIGHT = 1;
    const fb = [
      ["Each line is read in every session, on every task, whether it matters or not. Past a point, the important rules are lost among the rest, and lines start to contradict each other.", false],
      ["Right. The instruction file is context: every line costs tokens in every session, and long files are followed less reliably. Claude Code's documentation (checked 2026-11-18) suggests under 200 lines per file. So retros also remove: drop stale lines, move area-only detail into notes, turn rules that must never break into checks.", true],
      ["Not at 600 lines. Claude Code loads a CLAUDE.md in full up to 4 MiB (its documentation, checked 2026-11-18), far more than 600 lines. The cost comes first: the whole file is in the context of every session, and long files are followed less well.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to write it down</h1>
        <p class="lead"><b>What:</b> agent memory is plain files. The instruction file is loaded at the start of every session; notes are read when a task needs them.</p>
        <p class="lead"><b>For:</b> agents that work in many short sessions on one code base. <b>Reach for it</b> when the same mistake shows up a second time, or after a long run, as a short retro.</p>
        <p class="lead"><b>Not</b> for a one-off task you will not repeat; not for what a formatter, test or hook already enforces (a line is a request, a check is a guarantee); never for secrets.</p>
        <p class="lead"><b>Costs:</b> every line of the instruction file is in every session's context. Notes go stale unless someone prunes them. The retro and the cleanup take a person's time and a check that nothing broke.</p>
        <p class="task">Six retros later, the museum's instruction file has 600 lines. What happens?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A team's agent uses npm to install packages in almost every session, but the project uses pnpm, and someone corrects it each time.", true,
      "Yes. The same correction, session after session: one line in the instruction file, naming the command to use.",
      "The same correction is typed in every session because nothing carries it over. A line in the instruction file (\"use pnpm, not npm\") does."],
    ["A developer has an agent rename 300 photos from one exhibition in a single afternoon. The script will never run again.", false,
      "No. Nothing will happen again, so there is nothing for a future session to learn. A retro and a note would cost time and add a line that only goes stale.",
      "There is no next session for this task. Writing down its lessons adds lines every future session has to read, for a job that is over."],
    ["Agent commits keep failing the team's formatting check in CI (the checks that run on every push). Someone proposes adding \"format the code\" to the instruction file.", false,
      "No, not a memory line. The check already enforces the format; what is missing is running the formatter before committing. Make it automatic (a pre-commit hook or a formatting hook in the agent tool), so it happens every time, not when the model remembers.",
      "A line in the instruction file is a request the model may or may not follow. The formatting is already enforced by a check; run the formatter automatically with a hook, and spend no context on it."],
    ["A two-week migration runs across many sessions. Each new session spends its first half hour reading files to work out what is already done.", true,
      "Yes. A progress note (done, left, what waits for what), read at the start of the task and updated at the end of each session, saves that half hour.",
      "The missing knowledge is the state of an unfinished task, rediscovered each time. A progress note that each session reads first and updates last carries it over."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Write it down, or not?</h1>
        <p class="lead">Four situations from other teams. Writing it down means: a line in the instruction file or a note the next session reads.</p>
        <p class="task">Is writing it down for the next session the right fix? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Your agents can now remember</h1>
      <p class="lead">You found the same code written in ${plural(SESSIONS.length, "session")}, saw why (every session starts empty), and saw one concrete line in the instruction file change what the next session wrote. You ran a retro: sorted ${RETRO.length} recorded learnings into instruction file, note or drop, fixed a draft that said the wrong thing, and cleaned up without deleting a file that cron still runs.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Memory makes each agent session better; next you put agent work behind checks and human gates before it reaches users.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Agent memory across sessions, retros and cleanup",
    checked: "2026-11-18",
    sources: [
      "https://code.claude.com/docs/en/memory",
      "https://agents.md/",
      "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents",
      "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents"
    ],
    interview: [
      {
        q: "Your team's coding agents repeat the same mistakes every week, and the instruction file has grown to 500 lines that nobody trusts. What do you do?",
        good: [
          "Remember that each session starts empty, so only what is loaded or read carries over",
          "Cut the instruction file to short, concrete rules every session needs: commands, conventions, where things live, what not to touch",
          "Move area-only detail, decisions and rare procedures into notes read when the task needs them",
          "Turn rules that must never break into checks or hooks; a line is a request, a check is a guarantee",
          "Add a line when a mistake happens a second time, and review the file after long runs for stale or conflicting lines"
        ],
        weak: "Add more rules in capitals, or switch to a bigger model. That makes the file longer and less followed, and a bigger model still starts each session empty."
      },
      {
        q: "After a month of mostly agent-written changes, how would you clean up the code base safely?",
        good: [
          "Search for the same job written several times and merge it into one shared function",
          "Check the merge changes nothing: run the tests, or compare old and new output on many inputs",
          "List files nothing imports, but check other entry points (cron, scripts, config) before deleting",
          "Delete backups and scratch files, and add a rule or check so they do not come back",
          "Write the shared function into the instruction file so the next session uses it"
        ],
        weak: "Delete everything an unused-code scan reports. That misses files started by cron or scripts, and breaks things no test covers."
      }
    ],
    screens: [findRepeats, spotIdea, predictWithFile, sortRetro, editFirst, cleanup, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="0,2"]'], right: DUP_KEYS.map(k => `[data-i="${k[0]}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(RETRO.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: [`#c${CANDIDATES.indexOf(KEEP_FILE)} [data-wrong]`], right: CANDIDATES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
