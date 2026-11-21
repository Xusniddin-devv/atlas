/* Lesson s5c-customize-agent: skills, hooks, MCP servers and plugins.
   Story: Plotline, a four-person team (Amara, Jonas, Keiko, Tomás) building a web app where members of a
   community allotment garden book plots. They keep typing the same instructions to their coding agents.
   Ideas: (1) pick the extension by two questions: who must start it (Claude Code on an event, without asking the
   model: a hook; the model or a person, with judgement: CLAUDE.md or a skill) and when it must be in the model's
   context (always: CLAUDE.md; only when needed: a skill); new tools from another system come from an MCP server,
   and a plugin packages all of them to reuse elsewhere; (2) a hook fires only when its event and matcher match the
   real tool name, exactly and case-sensitively.
   Depth: explain (screens 1-3, 8, 9, interview), library (screens 4, 5, 7: SKILL.md descriptions, which files a
   teammate gets, matcher rules), debug (screen 6: a formatter hook that never fires).
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5c-customize-agent/skill-vague, skill-clear (one small
     hosted model, temperature 0, same task and skills, only the checklist's description differs), made by
     docs/ai-path/runs/s5c-customize-agent/record_skill.py (output in record_skill.out.txt);
   - recordings trace-1..3 (the agent fixes a bug with Read, then Edit), made by record_trace.py, whose tools change
     an in-memory repository (plotline.py) and whose hook check is hooks_check.py, our checker written from the
     Claude Code hooks reference; record_trace.out.txt, replay_hooks.out.txt (broken and fixed settings);
   - hooks_check.out.txt: the matcher grid used on screen 7.
   Claude Code itself was not run. No hook command (Prettier) was executed; the check reports which would start.
   Lesson-local style (.lx-s5c-customize-agent-*): a transcript block, a kind list, a file list and pickable
   JSON lines, see ensureStyle(). Every number on screen is computed here from these constants. Plain browser script. */
(() => {
  const ID = "s5c-customize-agent";
  const P = `lx-${ID}-`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const CHECKED = "2026-11-17";
  const DOCS = {
    overview: "https://code.claude.com/docs/en/features-overview",
    hooks: "https://code.claude.com/docs/en/hooks",
    hooksGuide: "https://code.claude.com/docs/en/hooks-guide",
    skills: "https://code.claude.com/docs/en/skills",
    mcp: "https://code.claude.com/docs/en/mcp",
    plugins: "https://code.claude.com/docs/en/plugins",
    settings: "https://code.claude.com/docs/en/settings",
    tools: "https://code.claude.com/docs/en/tools-reference",
    memory: "https://code.claude.com/docs/en/memory",
    permissions: "https://code.claude.com/docs/en/permissions",
    pluginInstall: "https://code.claude.com/docs/en/plugins/install"
  };

  /* ---------- Data copied from the runs and recordings ---------- */
  // The five kinds, worded from the Claude Code "Extend Claude Code" page (features-overview), checked 2026-11-17.
  const KINDS = ["CLAUDE.md", "Skill", "Hook", "MCP server", "Plugin"];
  const KIND_NOTE = [
    "The project's instruction file. Its full text is in every request of every session. The model reads it and usually follows it.",
    "A folder with a <code>SKILL.md</code> file. Only its name and description sit in each session. The full text loads when the model judges that the task needs it, or when someone types <code>/name</code>.",
    "A command that Claude Code itself runs at an event, for example after every file edit. The model is not asked. It uses no context unless it prints something back.",
    "A program that gives the agent new tools, such as reading data from another system.",
    "One installable package that bundles skills, hooks, MCP servers and subagents, to reuse in other repositories or share."
  ];
  const [MD, SKILL, HOOK, MCP, PLUGIN] = [0, 1, 2, 3, 4];

  // The team's six repeated requests (written for the lesson; not model output).
  const NEEDS = [
    { who: "Jonas", text: "Every time the agent changes a file, I have to ask it to run Prettier. Half the time I forget.", right: HOOK, fb: [
      "A CLAUDE.md line is a request the model reads, and like Jonas, it can forget. “Every time, without asking” needs something that runs without the model choosing to.",
      "A skill loads when the model decides it fits, or when someone types its name. Jonas wants Prettier after every edit, with nobody deciding.",
      "Right. A hook is run by Claude Code itself on an event, here “a file was just edited”. The model is not asked, so it cannot forget.",
      "An MCP server adds tools the model may call. Prettier is already on the machine. The problem is not reaching it; the problem is that nobody calls it every time.",
      "A plugin is a way to package and share. It could carry the fix later, but the fix itself is something that runs on every edit."] },
    { who: "Keiko", text: "I keep copying ticket details from our tracker into the chat so the agent knows what the bug is.", right: MCP, fb: [
      "Tickets change every day and there are hundreds of them. An instruction file holds standing rules, not live data from another system.",
      "A skill holds text written in advance. Today's ticket was not written in advance; it lives in the tracker, and the agent needs a way to fetch it.",
      "A hook runs on an event, whatever the task. Here the agent must decide which ticket it needs and when: that is a tool the model calls.",
      "Right. An MCP server for the tracker gives the agent tools such as “get ticket”. The model calls one when the task needs it, as in the MCP lesson.",
      "A plugin can carry an MCP server, but packaging is not what Keiko lacks. The missing piece is the connection to the tracker itself."] },
    { who: "Amara", text: "Release day again. I paste our release checklist into the chat, step by step.", right: SKILL, fb: [
      "It would work, but the checklist would then ride along in every request of every session, including all the days with no release. A long instruction file is also followed less well.",
      "Right. Only the skill's name and description sit in each session. The full checklist loads on release day, when Amara types its name or the model sees the task fits. Some steps need judgement (what goes in the changelog), and the model can give it.",
      "A hook runs a fixed command on an event. Release steps need judgement, such as what to write in the changelog, and no event means “today is release day”.",
      "Nothing here lives in another system. The checklist is text the team wrote. It needs a place to load from when needed, not a new tool.",
      "A plugin could share it later. First the checklist needs a form the agent can load when needed."] },
    { who: "Tomás", text: "The agent edited an old file in db/migrations/ again. Once merged, those files must never change.", right: HOOK, fb: [
      "A line in CLAUDE.md is a request. The model can read it and still edit the file, as it just did. “Must never” needs a check that runs whether or not the model agrees.",
      "A skill loads only when the model picks it or someone calls it. On the day the agent wanders into db/migrations/, nobody calls it.",
      "Right. A hook on the event before a tool runs (<code>PreToolUse</code>) receives the file path. A script that exits with code 2 blocks the edit, and its message goes back to the model. Claude Code runs it, so the model cannot skip it. (A deny rule from the last lesson can also block the Edit tool by path.)",
      "An MCP server adds tools. Tomás needs to take a power away, editing migrations, not add one.",
      "Packaging comes later. First there must be a check that blocks the edit."] },
    { who: "Amara", text: "We start a second repository for the garden shop next week. I want this same setup there, and for the two volunteers who join next month.", right: PLUGIN, fb: [
      "CLAUDE.md lives in one repository. Copying files into a second one by hand works once; then the copies drift apart.",
      "One skill is one piece. Amara wants the whole set, with the hooks and the tracker server, in a second repository.",
      "A hook is one of the pieces to share, not the way to share them.",
      "The tracker server is one of the pieces. The need is to carry all the pieces into another repository together.",
      "Right. A plugin bundles skills, hooks, MCP servers and subagents into one unit you install, with updates from a marketplace (a catalog of plugins). Inside one repository, committed files already reach everyone who clones it. A plugin is worth it when the same setup must reach a second repository."] },
    { who: "Keiko", text: "Every session I explain the same basics: we use pnpm, tests sit next to the code, money is stored in cents.", right: MD, fb: [
      "Right. Short facts that every task needs belong in the instruction file. It is loaded at the start of every session, so keep it to things that are always true.",
      "These facts matter in almost every task. A skill loads only when the model decides it fits, so on some tasks the facts would be missing.",
      "A hook runs a command; it does not teach the model anything. “Money is stored in cents” is knowledge the model needs while it writes code.",
      "Nothing to fetch from another system. These are three fixed facts about this repository.",
      "One repository and a few short facts: the project's instruction file does it with no packaging."] }
  ];

  // From docs/ai-path/runs/s5c-customize-agent/plotline.py (skill listing) and recordings skill-vague / skill-clear
  const SKILL_OTHERS = [
    ["pr-review", "Reviews a pull request against Plotline's code review checklist. Use when the user asks for a review of a branch or PR."],
    ["db-guide", "Plotline's database schema and query patterns. Use when writing or changing SQL queries."]
  ];
  const SKILL_TASK = "We ship version 2.4 to the app stores today. Get the release ready.";
  const REC_SKILL = {
    src: "s5c-customize-agent/skill-vague, skill-clear",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: CHECKED,
    runs: [
      { desc: "Checklist", call: ["Read", "{\"file_path\":\"package.json\"}"] },
      { desc: "Plotline release steps: bump the version, update the changelog, build for the app stores. Use when the user wants to cut, ship or publish a release.", call: ["Skill", "{\"skill\":\"checklist\"}"] }
    ]
  };

  // From plotline.py: the team's committed .claude/settings.json (broken) and the fix
  const FORMAT_CMD = "f=$(jq -r '.tool_input.file_path') && npx prettier --write --ignore-unknown \"$f\"";
  const SETTINGS_BROKEN = { hooks: { PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: FORMAT_CMD }] }] } };
  const MATCHER_FIXED = "Edit|Write";
  const TASK = "Members say the late fee is charged twice. The code is in src/plots/price.ts. Fix it.";
  // From recordings trace-1..3 (tool calls and text not altered) and record_trace.out.txt (tool results, hook checks)
  const REC_TRACE = {
    src: "s5c-customize-agent/trace-1 … trace-3",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: CHECKED,
    calls: [
      { call: ["Read", "{\"file_path\":\"src/plots/price.ts\"}"], hooks: 0 },
      { call: ["Edit", "{\"new_string\":\"\",\"old_string\":\"total += lateFee;\",\"file_path\":\"src/plots/price.ts\"}"], result: "The file src/plots/price.ts has been updated.", hooks: 0 }
    ],
    answer: "I have corrected the bug in `src/plots/price.ts` where the late fee was being charged twice. The duplicate charge has been removed."
  };
  // replay_hooks.out.txt: hooks started per tool with each settings file
  const REPLAY = { broken: { Read: 0, Edit: 0 }, fixed: { Read: 0, Edit: 1 } };

  // hooks_check.out.txt: which tools each matcher catches (our checker, from the documented matcher table)
  const GRID = [
    { matcher: "Edit, Write", kind: "exact", m: { Edit: true, Write: true, NotebookEdit: false } },
    { matcher: "edit|write", kind: "exact", m: { Edit: false, Write: false, NotebookEdit: false } },
    { matcher: "Edit.*", kind: "regex", m: { Edit: true, Write: false, NotebookEdit: true } },
    { matcher: "^Edit$", kind: "regex", m: { Edit: true, Write: false, NotebookEdit: false } }
  ];
  const GRID_TOOLS = ["Edit", "Write", "NotebookEdit"];

  /* ---------- Derived from the data ---------- */
  const SET_JSON = JSON.stringify(SETTINGS_BROKEN, null, 2).split("\n");
  const lineOf = needle => SET_JSON.findIndex(l => l.includes(needle));
  const PICK_LINES = { [lineOf("\"PostToolUse\"")]: "event", [lineOf("\"matcher\"")]: "matcher", [lineOf("\"type\"")]: "type", [lineOf("\"command\":")]: "command" };
  const BROKEN_MATCHER = SETTINGS_BROKEN.hooks.PostToolUse[0].matcher;
  const TRACE_HOOKS = REC_TRACE.calls.reduce((s, c) => s + c.hooks, 0);
  const TOOLS_USED = REC_TRACE.calls.map(c => c.call[0]);
  const sumObj = o => Object.values(o).reduce((a, b) => a + b, 0);
  const setLabel = m => {
    const on = GRID_TOOLS.filter(t => m[t]);
    return on.length === 0 ? "None of the three" : on.length === 1 ? `${on[0]} only` : on.join(" and ");
  };
  const GRID_OPTS = [...new Set(GRID.map(g => setLabel(g.m)))];
  const CAPTION = `Recorded model output, ${REC_TRACE.recordedAt}`;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .${P}kinds { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .${P}kinds li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .${P}kinds b { font-family: var(--mono); font-size: 14.5px; }
      .${P}who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 0 0 4px; }
      .${P}log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .${P}row { display: grid; grid-template-columns: 8em 1fr; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
      .${P}txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .${P}mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .${P}row.${P}mark { border-left: 3px solid var(--ink); padding-left: 10px; }
      .${P}cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}json { margin: 14px 0 0; border: 1px solid var(--line); border-radius: 10px; background: var(--sunk); padding: 6px 0; }
      .${P}ln { display: block; width: 100%; text-align: left; font: 500 14px/1.5 var(--mono); color: var(--ink); background: none; border: 0; padding: 2px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
      button.${P}ln { min-height: 44px; cursor: pointer; border-top: 1px dashed var(--line); border-bottom: 1px dashed var(--line); }
      button.${P}ln:hover { background: var(--surface); }
      button.${P}ln.${P}no { background: var(--bad-soft); }
      .${P}ln.${P}yes { background: var(--good-soft); }
      .${P}files { margin: 0; }
      .${P}file code { font: 600 14.5px var(--mono); overflow-wrap: anywhere; }
      .${P}file .${P}sub { display: block; font-weight: 400; color: var(--muted); font-size: 15px; margin-top: 2px; }
      @media (max-width: 520px) { .${P}row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  const kindList = () => `<ul class="${P}kinds">${KINDS.map((k, i) => `<li><b>${k}</b>: ${KIND_NOTE[i]}</li>`).join("")}</ul>`;
  const log = (kit, rows) => `<div class="${P}log">${rows.map(([who, html, mark]) =>
    `<div class="${P}row${mark ? ` ${P}mark` : ""}"><div class="${P}who">${kit.esc(who)}</div><div class="${P}txt">${html}</div></div>`).join("")}</div>`;
  const mono = (kit, s) => `<div class="${P}mono">${kit.esc(s)}</div>`;
  const ask = (kit, opts, correct, picked, fbs) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked], picked === correct)}`;

  /* 1 and 2. By hand: match each repeated request to the extension that fits. */
  function matchScreen(first, title, lead) {
    return function ({ el, done, kit }) {
      ensureStyle();
      const needs = NEEDS.slice(first, first + 3);
      const ans = needs.map(() => null);
      const paint = () => {
        el.innerHTML = `<h1>${title}</h1>${lead}
          ${kindList()}
          <p class="task">For each request, pick the extension that stops the repeating. Pick again if you change your mind.</p>
          ${needs.map((n, i) => `<div class="lcase" id="n${i}"><p class="${P}who">${kit.esc(n.who)}</p><p>“${kit.esc(n.text)}”</p>
            ${ask(kit, KINDS, n.right, ans[i], n.fb)}</div>`).join("")}`;
        el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
          ans[i] = +b.dataset.i; paint();
          if (needs.every((n, j) => ans[j] === n.right)) done();
        }));
      };
      paint();
    };
  }
  const matchA = matchScreen(0, "The same requests, every day",
    `<p class="lead">Plotline is a small web app where members of a community allotment garden book plots. Four people build it, each with a coding agent. Every week they type the same requests to their agents, because the agents do not remember them. Their coding agent, Claude Code, can be extended so that the agent gets a request without anyone typing it again. This lesson is about five of these extensions:</p>`);
  const matchB = matchScreen(3, "Three more requests",
    `<p class="lead">The same team, the same five kinds of extension. The first three requests went to a hook, an MCP server and a skill.</p>`);

  /* 3. Spot the idea: two lists of steps, two different homes. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Length: short lists go in a hook, long lists in a skill",
      "Who starts it: Claude Code on an event, or the model when it judges the task needs it",
      "Cost: a hook runs often, so only the cheap formatter is worth one",
      "File type: hooks are shell commands, skills are Markdown"
    ];
    const RIGHT = 1;
    const fb = [
      "A hook can run a long script, and a skill can be three lines. Length is not what separates them.",
      `Right. Ask two questions about any request. <b>Who must start it?</b> If it must happen every time, the same way, with no thinking, Claude Code should run it on an event: a hook. If it needs judgement, the model should apply it: CLAUDE.md or a skill. <b>When must the model know it?</b> Always: CLAUDE.md. Only for some tasks: a skill, which costs only its description until it loads. The documentation says it plainly. An instruction such as “never edit .env” in CLAUDE.md or a skill is a request, not a guarantee. A hook that blocks the edit enforces it. Two more cases sit outside these questions: new tools from another system come from an MCP server, and a plugin carries all of these to another repository.`,
      "Hooks cost no context at all unless they print something back. A skill's description sits in every session. And the formatter is cheap to run; the point is that it must run every time.",
      "True of the files, but that is a result, not the reason. Start from what must happen: a fixed command on every edit, or steps that need the model's judgement."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Two lists of steps, two homes</h1>
        <p class="lead">Jonas's request (run Prettier after every change) and Amara's (work through the release checklist) are both lists of steps. Yet one went to a hook and the other to a skill.</p>
        <p class="task">What decides which home a list of steps gets?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Library: the skill's description decides whether it loads. Two recorded runs. */
  function skillDesc({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null; // stage 0: predict the vague run, 1: predict the clear run, 2: both shown
    const R = REC_SKILL.runs;
    const loads = r => r.call[0] === "Skill";
    const opts = ["It loads the checklist skill", "It starts without the skill"];
    const fm = d => ["---", `description: ${d}`, "---", "# Checklist", "1. Bump the version in package.json", "…"];
    const result = (r, mark) => log(kit, [["description", kit.esc(r.desc)], ["agent's first call", mono(kit, `${r.call[0]} ${r.call[1]}`), mark]]);
    const wrongFb = [
      "In the recorded run it did not. The model sees only the name “checklist” and the description “Checklist”, not the steps inside. Nothing in those words says release, ship or version.",
      "In the recorded run it loaded the skill. Now the description names the task in the words people use for it: ship, release, the version and the changelog. The model matches the request against exactly this text."
    ];
    const paint = () => {
      const r = R[Math.min(stage, 1)];
      el.innerHTML = `<h1>Will the agent load the skill?</h1>
        <p class="lead">Amara moved the checklist into <code>.claude/skills/checklist/SKILL.md</code>. In each session Claude Code shows the model only each skill's name and description. The model loads a skill's full text when the description fits the task. We rebuilt that setup for a small hosted model. It got three skills (name and description only), a <code>Skill</code> tool to load one, the file tools <code>Read</code>, <code>Edit</code> and <code>Write</code>, and this request: “${kit.esc(SKILL_TASK)}” The other two skills:</p>
        ${log(kit, SKILL_OTHERS.map(([n, d]) => [n, kit.esc(d)]))}
        ${stage < 2 ? `<p class="lead">${stage === 0 ? "First version of the checklist skill:" : "Amara rewrites only the description. Same name, same steps:"}</p>${kit.code(fm(r.desc), 1)}
          <p class="task">${stage === 0 ? "What is the agent's first move?" : "Now what is the agent's first move?"}</p>
          <div class="lpanel">${kit.options(opts, { picked: wrong, correct: loads(r) ? 0 : 1 })}${wrong != null ? kit.feedback(wrongFb[stage], false) : ""}</div>` : ""}
        ${stage >= 1 ? `<p class="lead">The recorded run with the first version:</p>${result(R[0], false)}` : ""}
        ${stage >= 2 ? `<p class="lead">The recorded run with the new description:</p>${result(R[1], true)}<p class="${P}cap">${CAPTION}</p>
          ${kit.feedback(`That is what happened. A small hosted model answered each request once. With the vague description, its first move was to read <code>package.json</code>, not to load the checklist. With the clear one, its first move was to load it. The steps were the same; only the description changed. The skills documentation says to put the key use case first and say when to use the skill, as in “Use when the user wants to…”. Some skills change things, and only a person should start them. For those, set <code>disable-model-invocation: true</code>. Then the model never sees the description, and only typing <code>/checklist</code> runs the skill.`, true)}` : ""}
`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const pick = +b.dataset.i, right = loads(R[stage]) ? 0 : 1;
        if (pick !== right) { wrong = pick; paint(); return; }
        wrong = null; stage++; paint(); if (stage === 2) done();
      });
    };
    paint();
  }

  /* 5. Library: which files a new laptop gets from the repository. */
  const FILES = [
    ["CLAUDE.md", "the three basics, committed to the repository", 0,
      "Committed, so every clone has it, and it loads at the start of every session.", null],
    [".claude/skills/checklist/SKILL.md", "the release skill, committed", 0,
      "Project skills live in the repository, so every clone has them. The documentation says to commit them so the team gets them.", null],
    [".claude/settings.json", "the formatter hook, committed", 0,
      "The shared project settings file. Committed, it reaches everyone who clones the repository, hooks included.", null],
    [".mcp.json", "the tracker MCP server, added with --scope project", 1,
      "The file is in the repository, but for safety Claude Code asks each person to approve a project server from <code>.mcp.json</code> before it is used, in an interactive session.", null],
    [".claude/settings.local.json", "a hook Jonas added for himself: a sound when the agent waits", 2,
      "This is the personal settings file for one project. When Claude Code creates it, Claude Code keeps it out of git; made by hand, it needs a <code>.gitignore</code> line. Either way it is meant to stay on Jonas's laptop and never reaches the repository.", null],
    ["~/.claude/skills/standup/SKILL.md", "a skill in Amara's home folder", 2,
      "This lives in Amara's home folder on her laptop, outside the repository. It loads in all her projects and nobody else's.", null]
  ];
  const FILE_OPTS = ["Gets it", "Asked to approve first", "Does not get it"];
  function newLaptop({ el, done, kit }) {
    ensureStyle();
    const ans = FILES.map(() => null);
    const wrongWhy = (f, pick) => {
      if (f[2] === 0) return `${f[3]} ${pick === 1 ? "Only MCP servers from <code>.mcp.json</code> ask for approval first." : ""}`;
      if (f[2] === 1) return pick === 0 ? `Not quite. ${f[3]}` : `It is in the repository, so he has the file. ${f[3]}`;
      return f[3];
    };
    const paint = () => {
      el.innerHTML = `<h1>What reaches a new laptop?</h1>
        <p class="lead">Tomás gets a new laptop, clones Plotline and starts Claude Code. He sets nothing up himself. The team's setup is now spread over these files. The tracker server went in with a command like <code>claude mcp add --transport http tracker --scope project https://tracker.example.com/mcp</code>, which writes <code>.mcp.json</code>. On first start Claude Code asks whether he trusts this folder, and he says yes. Until he does, Claude Code does not run the hooks in settings files.</p>
        <p class="lead"><b>Not run by us.</b> Written from the official Claude Code documentation on settings, skills and MCP (listed in this lesson's sources), checked ${CHECKED}.</p>
        <p class="task">For each file, what does Tomás's agent get?</p>
        <div class="${P}files">${FILES.map((f, i) => `<div class="lcase ${P}file" id="f${i}"><p><code>${kit.esc(f[0])}</code><span class="${P}sub">${kit.esc(f[1])}</span></p>
          ${kit.options(FILE_OPTS, { picked: ans[i], correct: f[2] })}${ans[i] == null ? "" : kit.feedback(ans[i] === f[2] ? f[3] : wrongWhy(f, ans[i]), ans[i] === f[2])}</div>`).join("")}</div>
        ${FILES.every((f, i) => ans[i] === f[2]) ? kit.feedback(`All ${FILES.length} right. Inside one repository, sharing is just committing the files. Amara's second repository is the hard case: there a <b>plugin</b> helps. It is a folder with a manifest at <code>.claude-plugin/plugin.json</code> and its parts beside it (<code>skills/</code>, <code>hooks/hooks.json</code>, <code>.mcp.json</code>). Installed for the project (project scope), it is named in each repository's committed settings. That turns it on for everyone, but each teammate still installs it once in each clone, from a marketplace. Both repositories then get the same set. Plugin skills get the plugin's name in front, such as <code>/plotline-kit:checklist</code>, so two plugins never clash.`, true) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (FILES.every((f, j) => ans[j] === f[2])) done();
      }));
    };
    paint();
  }

  /* 6. Broken on purpose: the formatter hook never fires. */
  function brokenHook({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrongLine = null, fixPick = null; // stage 0: find the line, 1: pick the fix, 2: fixed
    const lineFb = {
      event: "<code>PostToolUse</code> is the right event: it fires after a tool has run, so the formatter sees the edited file. The hook check above did run for this event on both tool calls; it found nothing to start.",
      type: "<code>\"command\"</code> is the usual type: run a shell command. It is never reached here: the check started 0 hooks, so no type or command was tried.",
      command: "This is the documentation's own Prettier command. If it were wrong, the hook would start and then fail. The check above started 0 hooks, so the command never even began."
    };
    const fixes = [`"matcher": "${MATCHER_FIXED}"`, "\"matcher\": \"write|edit\"", "Move the hook under \"PreToolUse\"", "\"matcher\": \"Edit\""];
    const FIX_RIGHT = 0;
    const fixFb = [
      null,
      "Matchers are case-sensitive. The tools are called <code>Edit</code> and <code>Write</code>; <code>write|edit</code> matches neither, and the hook stays silent.",
      "That changes when it fires, not whether. <code>PreToolUse</code> fires before the edit, so Prettier would format the old file and the agent's change would land unformatted after it.",
      "It would fire for this session, which only edited an existing file. The next time the agent creates a new file, it uses <code>Write</code>, and that file goes unformatted. Name both tools."
    ];
    const T = REC_TRACE.calls;
    const paint = () => {
      const json = SET_JSON.map((l, i) => {
        const key = PICK_LINES[i];
        if (!key || stage > 0) return `<div class="${P}ln${key === "matcher" ? ` ${P}yes` : ""}">${kit.esc(stage >= 2 && key === "matcher" ? l.replace(`"${BROKEN_MATCHER}"`, `"${MATCHER_FIXED}"`) : l) || " "}</div>`;
        return `<button type="button" class="${P}ln${wrongLine === key ? ` ${P}no` : ""}" data-i="${key}">${kit.esc(l)}</button>`;
      }).join("");
      el.innerHTML = `<h1>The hook that never fires</h1>
        <p class="lead">Jonas committed a formatter hook in <code>.claude/settings.json</code>, then gave the agent a bug: “${kit.esc(TASK)}” The fix came back, but unformatted. The file never went through Prettier.</p>
        <p class="lead">Below is the session. After each tool call, our check lists which <code>PostToolUse</code> hooks (hooks for the moment after a tool has run) would start. Claude Code itself was not run: the agent is a small hosted model, and the check is our script, written from the Claude Code hooks reference.</p>
        ${log(kit, [
          ["agent calls", mono(kit, `${T[0].call[0]} ${T[0].call[1]}`)],
          ["hook check", `tool_name <code>${T[0].call[0]}</code>: ${plural(T[0].hooks, "hook")} start`],
          ["agent calls", mono(kit, `${T[1].call[0]} ${T[1].call[1]}`)],
          ["hook check", `tool_name <code>${T[1].call[0]}</code>: ${plural(T[1].hooks, "hook")} start`, true],
          ["agent answers", kit.esc(REC_TRACE.answer)]
        ])}
        <p class="${P}cap">${CAPTION}</p>
        <div class="${P}json" aria-label=".claude/settings.json">${json}</div>
        ${stage === 0 ? `<p class="lead">In this settings file, the hook sits under an event. Its <code>matcher</code> names the tools it is for, and its <code>command</code> is what runs.</p>
          <p class="task">The hook started ${TRACE_HOOKS} times in this session. Tap the line of the settings file that explains why. Four lines, marked with dashed edges, can be tapped.</p>
          ${wrongLine ? kit.feedback(lineFb[wrongLine], false) : ""}` : ""}
        ${stage >= 1 ? kit.feedback(`Yes. The matcher is <code>"${BROKEN_MATCHER}"</code>. It is a plain tool name, so Claude Code compares it with the tool name exactly. The agent changed an existing file with <code>Edit</code>, which makes a targeted change, and never called <code>Write</code>, which creates or overwrites a whole file. So the event fired, but no matcher matched, and no hook started.`, true) : ""}
        ${stage === 1 ? `<p class="task">Pick the fix.</p><div class="lpanel">${ask(kit, fixes.map(f => `<code>${kit.esc(f)}</code>`), FIX_RIGHT, fixPick, fixFb)}</div>` : ""}
        ${stage === 2 ? kit.feedback(`Fixed. Replaying the same recorded tool calls with <code>"${MATCHER_FIXED}"</code>: ${TOOLS_USED.map(t => `${t} starts ${plural(REPLAY.fixed[t], "hook")}`).join(", ")} (before: ${sumObj(REPLAY.broken)} in total). This is the matcher in the hooks guide's own Prettier example. To debug a silent hook in Claude Code: run <code>/hooks</code> to see whether it is listed under the right event; check the matcher against the exact, case-sensitive tool name; test the script by piping a sample JSON input into it and checking its exit code; and read the debug log (<code>claude --debug</code>).`, true) : ""}`;
      el.querySelectorAll(`button.${P}ln`).forEach(b => b.onclick = () => {
        const k = b.dataset.i;
        if (k === "matcher") { stage = 1; wrongLine = null; paint(); return; }
        wrongLine = k; paint();
      });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        fixPick = +b.dataset.i;
        if (fixPick === FIX_RIGHT) { stage = 2; paint(); done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 7. Predict what each matcher catches (our checker's run of the documented rules). */
  function matchers({ el, done, kit }) {
    ensureStyle();
    const ans = GRID.map(() => null);
    const why = g => g.kind === "exact"
      ? "It has only letters, <code>|</code>, commas and spaces, so Claude Code reads it as a list of exact tool names, compared case-sensitively."
      : "It has a character such as <code>.</code>, <code>*</code>, <code>^</code> or <code>$</code>, so Claude Code reads it as a regular expression that may match anywhere in the tool name, unless <code>^</code> and <code>$</code> pin both ends.";
    const extra = {
      "Edit, Write": "A comma works like <code>|</code> here: <code>Edit</code> and <code>Write</code>, each matched whole.",
      "edit|write": "Lower case: no tool is called <code>edit</code> or <code>write</code>, so this hook would never fire, just like Jonas's.",
      "Edit.*": "<code>Edit.*</code> also matches inside <code>NotebookEdit</code>, so a hook meant for code files would fire on notebook edits too.",
      "^Edit$": "<code>^</code> and <code>$</code> pin the whole name, so only <code>Edit</code> itself."
    };
    const paint = () => {
      el.innerHTML = `<h1>What does each matcher catch?</h1>
        <p class="lead">The hooks reference gives three rules for a matcher. <code>*</code> or empty matches every tool. A matcher with only letters, digits, <code>_</code>, <code>-</code>, spaces, commas and <code>|</code> is a list of exact names. Anything else is a regular expression. All matchers are case-sensitive. Three real tool names: <code>Edit</code>, <code>Write</code> and <code>NotebookEdit</code> (it changes Jupyter notebook cells).</p>
        <p class="task">For each matcher, which of the three tools would fire the hook?</p>
        ${GRID.map((g, i) => {
          const correct = GRID_OPTS.indexOf(setLabel(g.m));
          return `<div class="lcase" id="g${i}"><p><code>"matcher": "${kit.esc(g.matcher)}"</code></p>
          ${kit.options(GRID_OPTS, { picked: ans[i], correct })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === correct ? `Right. ${extra[g.matcher]}` : `“${GRID_OPTS[ans[i]]}” is not what it catches. ${why(g)}`, ans[i] === correct)}</div>`;
        }).join("")}
        <p class="${P}cap">Answers from our checker (hooks_check.py), written from the documented rules; not from Claude Code.</p>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (GRID.every((g, j) => ans[j] === GRID_OPTS.indexOf(setLabel(g.m)))) done();
      }));
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Nothing changes until the agent works on the API",
      "Hooks stop firing, because the context is fuller",
      "It is sent in every request of every session, even sessions that never touch the API, and long files get followed less well",
      "The agent can no longer use its MCP tools"
    ];
    const RIGHT = 2;
    const fb = [
      "That is how a skill behaves: only its description waits in context. CLAUDE.md loads in full at the start of every session.",
      "Hooks do not live in the model's context. Claude Code runs them on events, however full the context is.",
      `Right. The documentation (checked ${CHECKED}) gives a rule of thumb: keep CLAUDE.md under 200 lines and move reference material to skills, which load on demand. A style guide that matters only for API work is exactly that: a skill, or a rule file in <code>.claude/rules/</code> with a <code>paths</code> list, which loads only when the agent works on files in the API folder.`,
      "MCP tools are still listed and callable. The cost is elsewhere: in what gets sent with every request."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which extension, and what it costs</h1>
        <p class="lead"><b>For:</b> turning requests you repeat into setup. <b>Reach for</b> CLAUDE.md for short facts that are always true, a skill for procedures and reference needed sometimes, a hook for what must happen every time with no judgement, an MCP server for live data or actions in another system, a plugin to reuse the set elsewhere.</p>
        <p class="lead"><b>Not</b> for a one-off request: say it in the chat. Not as a security wall: a hook on the Edit tool does not stop a shell command from changing the same file.</p>
        <p class="lead"><b>Costs:</b> CLAUDE.md and skill descriptions take context in every request. Hooks add time to every matching event, and a broken one can block work. Plugins and local MCP servers run code with your permissions on your machine, so review them first. Every piece needs upkeep.</p>
        <p class="task">Keiko pastes the team's long API style guide into CLAUDE.md. What goes wrong first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, with two "no extension fits" cases. */
  const CASES = [
    { q: "A volunteer group wants every pull request reviewed against their accessibility checklist. Which items apply depends on what the change touches.",
      opts: ["Hook", "Skill", "MCP server"], right: 1,
      fb: ["A hook runs a fixed command on an event. Deciding which checklist items apply to this change takes judgement, which the model gives when it applies a skill.",
        "Yes. The checklist is reference text needed only for reviews, and applying it takes judgement. A skill loads it on demand.",
        "Nothing needs fetching from another system: the checklist is text the group wrote."] },
    { q: "A delivery firm's developers keep pasting crash reports from their crash-tracking service into the chat.",
      opts: ["CLAUDE.md", "Skill", "MCP server"], right: 2,
      fb: ["Crash reports arrive every day. An instruction file holds standing facts, not live data from another service.",
        "A skill holds text written in advance. New crash reports are not; the agent needs a tool that fetches them.",
        "Yes. An MCP server for the crash-tracking service gives the agent tools to fetch a report when the task needs one."] },
    { q: "A developer wants the agent to rename one variable in one file, today only.",
      opts: ["A CLAUDE.md line", "A skill", "None: say it in the chat"], right: 2,
      fb: ["Nothing here repeats. A CLAUDE.md line would be sent with every request of every future session, to say something that matters once.",
        "A skill is for something you would otherwise type again and again. This happens once; writing a skill costs more than the request.",
        "Yes. Extensions pay off for things that repeat. A one-off request belongs in the chat, and leaves no setup behind to maintain."] },
    { q: "A clinic wants a guarantee that no agent can ever read the file holding the production database password, even through shell commands.",
      opts: ["A CLAUDE.md line", "A PreToolUse hook on the Read tool", "Neither is enough: keep the file out of the agent's reach"], right: 2,
      fb: ["An instruction is a request, not a guarantee. The model can read it and still open the file.",
        "A hook on <code>Read</code> stops only that tool. The hooks guide says the same of edits: the agent can still reach a file through shell commands. A hook narrows the way in; it does not close it.",
        "Yes. “Never, even through the shell” needs the secret not to be on the machine at all, or a sandbox around the agent. Hooks and instructions shape behaviour; they are not a wall. The next lesson is about those safeguards."] }
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which extension, if any?</h1>
        <p class="lead">Four requests from other teams. For some of them, no extension is the right answer.</p>
        <p class="task">Pick the fit for each one. Pick again if you change your mind.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(c.q)}</p>${ask(kit, c.opts, c.right, ans[i], c.fb)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can pick the right extension</h1>
      <p class="lead">You matched ${NEEDS.length} repeated requests to the five extensions by asking who must start each one and when the model must know it. You saw a vague skill description leave a skill unused, worked out which files reach a teammate, and fixed a hook whose matcher never matched the tool the agent really used. Each extension has a cost: CLAUDE.md and skill descriptions ride in every request, and hooks, servers and plugins are code to review and keep up. For a one-off request, or a hard security guarantee, none of them is the answer.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A hook can block one kind of mistake; next you decide how much an agent may do on its own, from how risky a task is and how easy it is to undo.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Skills, hooks, MCP servers and plugins",
    checked: CHECKED,
    sources: [DOCS.overview, DOCS.hooks, DOCS.hooksGuide, DOCS.skills, DOCS.mcp, DOCS.plugins, DOCS.pluginInstall, DOCS.settings, DOCS.permissions, DOCS.memory, DOCS.tools],
    interview: [
      {
        q: "Your team's CLAUDE.md has grown very long, and the agent now ignores rules it used to follow. What do you change?",
        good: [
          "Keep CLAUDE.md to short facts every session needs, such as build commands and core conventions",
          "Move procedures and reference material, like a release checklist or an API style guide, into skills that load on demand",
          "Turn rules that must always hold into hooks (or permission rules), since an instruction is a request, not a guarantee",
          "Write skill descriptions that say what the skill is for and when to use it, so the model loads the right one"
        ],
        weak: "Repeat the important rules in capital letters. That makes the file longer and still leaves every rule up to the model."
      },
      {
        q: "A hook that should run the formatter after every edit never seems to run. How do you find out why?",
        good: [
          "Check with /hooks that it is listed under the right event, PostToolUse for after an edit",
          "Compare the matcher with the exact tool names: matchers are case-sensitive, and edits to existing files use Edit, new files use Write",
          "Pipe a sample JSON input into the hook script by hand and check its exit code",
          "Read the debug log from claude --debug to see whether the hook matched and what it printed"
        ],
        weak: "Add “always run the formatter” to CLAUDE.md instead. That swaps a guaranteed step for a request the model may skip, and never finds the bug."
      }
    ],
    screens: [matchA, matchB, spotIdea, skillDesc, newLaptop, brokenHook, matchers, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#n0 [data-wrong]"], right: [0, 1, 2].map(i => `#n${i} [data-right]`) },
      { wrong: ["#n0 [data-wrong]"], right: [0, 1, 2].map(i => `#n${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#f0 [data-wrong]"], right: FILES.map((_, i) => `#f${i} [data-right]`) },
      { wrong: ['[data-i="event"]'], right: ['[data-i="matcher"]', "[data-right]"] },
      { wrong: ["#g0 [data-wrong]"], right: GRID.map((_, i) => `#g${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
