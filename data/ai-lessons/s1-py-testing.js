/* Lesson: Testing with pytest (unit "Python for engineers", practice: notebook).
   Story: a function that splits long podcast transcripts into pieces for search keeps losing the last sentence.
   Ideas: (1) a test is an input plus the output you wrote down before, checked by a program on every change;
   built once from scratch (an eleven-line runner), then (2) with pytest: parametrized cases, plain assert and its
   report, fixtures and their scope. Broken on purpose: a one-line "fix" that breaks the empty-transcript case.
   Every output shown comes from real runs on this Mac, kept in docs/ai-path/runs/s1-py-testing/:
     situation.py / situation.out.txt          the buggy splitter on the episode excerpt (screen 1)
     runner_trace.py / runner_trace.out.txt    the from-scratch runner, traced line by line (screen 5)
     v1_bug, v2_quickfix, v3_fixed/pytest.out.txt   pytest -q on the three splitter versions (screens 6, 8)
     fixture_function / fixture_module / fixture_bug .out.txt   the fixture runs with -s (screen 7, notebook list)
   No model calls were recorded for this lesson. Every number on screen is computed here from that data. */
(() => {
  const P = "lx-s1-py-testing-";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data from the runs ---------- */
  // situation.out.txt: the v1 splitter on the episode excerpt, max_chars 80
  const EPISODE = "Welcome back to Rooftop Hives. Today we visit a beekeeper in the city. She keeps forty hives on a hotel roof. The bees fly up to three kilometres for food. Next week we talk about winter. Thanks for listening.";
  const EP_MAX = 80;
  const EP_PIECES = [
    "Welcome back to Rooftop Hives. Today we visit a beekeeper in the city.",
    "She keeps forty hives on a hotel roof.",
    "The bees fly up to three kilometres for food. Next week we talk about winter."
  ];
  // the splitter's own sentence rule: cut at each full stop, trim, drop empties, give the full stop back
  const sentencesOf = text => text.split(".").map(s => s.trim()).filter(Boolean).map(s => s + ".");
  const EP_SENT = sentencesOf(EPISODE);
  const LOST = EP_SENT.findIndex(s => !EP_PIECES.some(p => p.includes(s)));

  // the five cases, copied from v1_bug/test_splitter.py (the same list is in runner_trace.py)
  const MAX = 30;
  const CASES = [
    ["", []],
    ["Welcome back.", ["Welcome back."]],
    ["Welcome back. Today: bees.", ["Welcome back. Today: bees."]],
    ["Welcome back. Today: bees. Thanks for listening.", ["Welcome back. Today: bees.", "Thanks for listening."]],
    ["Our guest keeps forty hives on a roof. Hi.", ["Our guest keeps forty hives on a roof.", "Hi."]]
  ];
  const pyStr = s => `'${s}'`;
  const pyList = a => `[${a.map(pyStr).join(", ")}]`;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // runner_trace.py: the from-scratch runner, line for line (line 0 is the def)
  const RUNNER = [
    "def run_cases(cases):",
    "    failed = 0",
    "    for text, expected in cases:",
    "        got = split_transcript(text, 30)",
    "        if got == expected:",
    "            print(\"PASS\", repr(text))",
    "        else:",
    "            failed += 1",
    "            print(\"FAIL\", repr(text),",
    "                  \"got\", got)",
    "    return failed"
  ];
  // runner_trace.out.txt, every step: [line about to run, locals at that moment, printed output so far]
  const STEPS = [[1,{},""],[2,{"failed":0},""],[3,{"failed":0,"text":"","expected":[]},""],[4,{"failed":0,"text":"","expected":[],"got":[]},""],[5,{"failed":0,"text":"","expected":[],"got":[]},""],[2,{"failed":0,"text":"","expected":[],"got":[]},"PASS ''\n"],[3,{"failed":0,"text":"Welcome back.","expected":["Welcome back."],"got":[]},"PASS ''\n"],[4,{"failed":0,"text":"Welcome back.","expected":["Welcome back."],"got":[]},"PASS ''\n"],[7,{"failed":0,"text":"Welcome back.","expected":["Welcome back."],"got":[]},"PASS ''\n"],[8,{"failed":1,"text":"Welcome back.","expected":["Welcome back."],"got":[]},"PASS ''\n"],[9,{"failed":1,"text":"Welcome back.","expected":["Welcome back."],"got":[]},"PASS ''\n"],[8,{"failed":1,"text":"Welcome back.","expected":["Welcome back."],"got":[]},"PASS ''\n"],[2,{"failed":1,"text":"Welcome back.","expected":["Welcome back."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\n"],[3,{"failed":1,"text":"Welcome back. Today: bees.","expected":["Welcome back. Today: bees."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\n"],[4,{"failed":1,"text":"Welcome back. Today: bees.","expected":["Welcome back. Today: bees."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\n"],[7,{"failed":1,"text":"Welcome back. Today: bees.","expected":["Welcome back. Today: bees."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\n"],[8,{"failed":2,"text":"Welcome back. Today: bees.","expected":["Welcome back. Today: bees."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\n"],[9,{"failed":2,"text":"Welcome back. Today: bees.","expected":["Welcome back. Today: bees."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\n"],[8,{"failed":2,"text":"Welcome back. Today: bees.","expected":["Welcome back. Today: bees."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\n"],[2,{"failed":2,"text":"Welcome back. Today: bees.","expected":["Welcome back. Today: bees."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\n"],[3,{"failed":2,"text":"Welcome back. Today: bees. Thanks for listening.","expected":["Welcome back. Today: bees.","Thanks for listening."],"got":[]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\n"],[4,{"failed":2,"text":"Welcome back. Today: bees. Thanks for listening.","expected":["Welcome back. Today: bees.","Thanks for listening."],"got":["Welcome back. Today: bees."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\n"],[7,{"failed":2,"text":"Welcome back. Today: bees. Thanks for listening.","expected":["Welcome back. Today: bees.","Thanks for listening."],"got":["Welcome back. Today: bees."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\n"],[8,{"failed":3,"text":"Welcome back. Today: bees. Thanks for listening.","expected":["Welcome back. Today: bees.","Thanks for listening."],"got":["Welcome back. Today: bees."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\n"],[9,{"failed":3,"text":"Welcome back. Today: bees. Thanks for listening.","expected":["Welcome back. Today: bees.","Thanks for listening."],"got":["Welcome back. Today: bees."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\n"],[8,{"failed":3,"text":"Welcome back. Today: bees. Thanks for listening.","expected":["Welcome back. Today: bees.","Thanks for listening."],"got":["Welcome back. Today: bees."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\n"],[2,{"failed":3,"text":"Welcome back. Today: bees. Thanks for listening.","expected":["Welcome back. Today: bees.","Thanks for listening."],"got":["Welcome back. Today: bees."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\n"],[3,{"failed":3,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Welcome back. Today: bees."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\n"],[4,{"failed":3,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Our guest keeps forty hives on a roof."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\n"],[7,{"failed":3,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Our guest keeps forty hives on a roof."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\n"],[8,{"failed":4,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Our guest keeps forty hives on a roof."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\n"],[9,{"failed":4,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Our guest keeps forty hives on a roof."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\n"],[8,{"failed":4,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Our guest keeps forty hives on a roof."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\n"],[2,{"failed":4,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Our guest keeps forty hives on a roof."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\nFAIL 'Our guest keeps forty hives on a roof. Hi.' got ['Our guest keeps forty hives on a roof.']\n"],[10,{"failed":4,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Our guest keeps forty hives on a roof."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\nFAIL 'Our guest keeps forty hives on a roof. Hi.' got ['Our guest keeps forty hives on a roof.']\n"],[10,{"failed":4,"text":"Our guest keeps forty hives on a roof. Hi.","expected":["Our guest keeps forty hives on a roof.","Hi."],"got":["Our guest keeps forty hives on a roof."]},"PASS ''\nFAIL 'Welcome back.' got []\nFAIL 'Welcome back. Today: bees.' got []\nFAIL 'Welcome back. Today: bees. Thanks for listening.' got ['Welcome back. Today: bees.']\nFAIL 'Our guest keeps forty hives on a roof. Hi.' got ['Our guest keeps forty hives on a roof.']\n"]];
  const LAST_OUT = STEPS[STEPS.length - 1][2].trim().split("\n");
  const VERDICT = LAST_OUT.map(l => l.startsWith("PASS"));   // per case, from the runner's own output

  // the splitter as the search team found it (v1_bug/splitter.py, without its comment line)
  const SPLIT_V1 = [
    "def split_transcript(text, max_chars):",
    "    sentences = [s.strip() for s in text.split(\".\") if s.strip()]",
    "    pieces, current = [], \"\"",
    "    for sentence in sentences:",
    "        sentence = sentence + \".\"",
    "        if current and len(current) + 1 + len(sentence) > max_chars:",
    "            pieces.append(current)",
    "            current = sentence",
    "        else:",
    "            current = (current + \" \" + sentence).strip()",
    "    return pieces"
  ];
  // v2_quickfix/splitter.py: the teammate's one-line fix
  const SPLIT_V2 = [...SPLIT_V1.slice(0, -1), "    pieces.append(current)", "    return pieces"];
  const V2_BUG = SPLIT_V2.indexOf("    pieces.append(current)");

  // v1_bug/test_splitter.py, whole file
  const TEST_FILE = [
    "import pytest",
    "from splitter import split_transcript",
    "",
    "@pytest.mark.parametrize(\"text, expected\", [",
    "    (\"\", []),",
    "    (\"Welcome back.\", [\"Welcome back.\"]),",
    "    (\"Welcome back. Today: bees.\", [\"Welcome back. Today: bees.\"]),",
    "    (\"Welcome back. Today: bees. Thanks for listening.\", [\"Welcome back. Today: bees.\", \"Thanks for listening.\"]),",
    "    (\"Our guest keeps forty hives on a roof. Hi.\", [\"Our guest keeps forty hives on a roof.\", \"Hi.\"]),",
    "])",
    "def test_split(text, expected):",
    "    assert split_transcript(text, 30) == expected"
  ];
  // v1_bug/pytest.out.txt, trimmed: whole lines cut where … stands, and the padding before [100%] cut
  const REPORT_V1 = [
    ".FFFF …",
    "…",
    "____ test_split[Welcome back. Today: bees. Thanks for listening.-expected3] ____",
    "",
    "text = 'Welcome back. Today: bees. Thanks for listening.'",
    "expected = ['Welcome back. Today: bees.', 'Thanks for listening.']",
    "…",
    ">       assert split_transcript(text, 30) == expected",
    "E       AssertionError: assert ['Welcome back. Today: bees.'] == ['Welcome bac...r listening.']",
    "E         ",
    "E         Right contains one more item: 'Thanks for listening.'",
    "E         Use -v to get more diff",
    "",
    "test_splitter.py:12: AssertionError",
    "…",
    "4 failed, 1 passed in 0.02s"
  ];
  const DOTS = REPORT_V1[0].split(" ")[0];
  const CASE_ID = REPORT_V1[2].match(/\[.*\]/)[0];
  const RUN_COUNT = DOTS.length, FAIL_COUNT = [...DOTS].filter(c => c === "F").length;
  // v2_quickfix/pytest.out.txt, trimmed the same way: every cut is a "…" row (each other line is a tap target on screen 8)
  const REPORT_V2 = [
    "F.... …",
    "… test_split[-expected0] …",
    "text = '', expected = []",
    "…",
    ">       assert split_transcript(text, 30) == expected",
    "E       AssertionError: assert [''] == []",
    "E         ",
    "E         Left contains one more item: ''",
    "…",
    "test_splitter.py:12: AssertionError",
    "…",
    "1 failed, 4 passed in 0.02s"
  ];
  const tapRow = c => c !== "…" && c.trim() !== "E";   // cut marks and the blank E line are shown, not tapped
  const V3_LAST = "5 passed in 0.01s";   // v3_fixed/pytest.out.txt, last line

  // fixtures/test_episode.py, whole file; test_episode_module.py differs only in the decorator line
  const FIX_FILE = [
    "from pathlib import Path",
    "import pytest",
    "from splitter import split_transcript",
    "",
    "@pytest.fixture",
    "def episode():",
    "    print(\"loading episode\")",
    "    return Path(\"episode.txt\").read_text()",
    "",
    "def test_no_piece_too_long(episode):",
    "    assert all(len(p) <= 80 for p in split_transcript(episode, 80))",
    "",
    "def test_ends_with_last_sentence(episode):",
    "    assert split_transcript(episode, 80)[-1].endswith(\"Thanks for listening.\")",
    "",
    "def test_no_words_lost(episode):",
    "    assert \" \".join(split_transcript(episode, 80)).split() == episode.split()"
  ];
  const FIX_TESTS = FIX_FILE.filter(l => l.startsWith("def test_")).length;
  // fixture_function.out.txt and fixture_module.out.txt (pytest -q -s), whole
  const OUT_FUNC = ["loading episode", ".loading episode", ".loading episode", ".", "3 passed in 0.01s"];
  const OUT_MOD = ["loading episode", "...", "3 passed in 0.01s"];
  const loads = out => out.filter(l => l.includes("loading episode")).length;
  // fixture_bug.out.txt: the same three tests against the v1 splitter, last line
  const FIX_BUG_LAST = "2 failed, 1 passed in 0.02s";

  /* ---------- Lesson-only styles and helpers ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}lines { margin: 14px 0 0; padding: 8px 0; background: var(--code-bg); border-radius: var(--r); }
      .${P}lines button, .${P}lines div { display: block; width: 100%; padding: 2px 14px 2px calc(14px + var(--ind, 4ch)); text-indent: calc(-1 * var(--ind, 4ch)); border: 0; border-left: 3px solid transparent; background: transparent; color: var(--code-ink); font: 500 14px/1.6 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; font-variant-ligatures: none; }
      .${P}lines button { min-height: 44px; cursor: pointer; padding-top: 9px; padding-bottom: 9px; }
      .${P}lines button.on { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--code-bg)); }
      .${P}lines button.no { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--code-bg)); }
      .${P}lines button:disabled { cursor: default; }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--font); color: var(--muted); }
      .${P}lab { margin: 16px 0 0; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
      .${P}rows { display: grid; gap: 6px; margin-top: 12px; }
      .${P}row { display: block; width: 100%; min-height: 44px; padding: 9px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 15px/1.4 var(--font); text-align: left; overflow-wrap: anywhere; }
      button.${P}row { cursor: pointer; }
      .${P}row.on { border-color: var(--good); background: var(--good-soft); color: var(--good); }
      .${P}row.no { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
      .${P}row.cur { border-color: var(--ink); border-width: 2.5px; }
      .${P}row small { display: block; font: 500 12.5px var(--mono); color: var(--muted); }
      .${P}rules { margin: 12px 0 0; padding-left: 20px; }
      .${P}rules li { margin: 3px 0; }
      .${P}checks { list-style: none; padding: 0; margin: 12px 0 16px; display: grid; gap: 8px; }
      .${P}checks label { display: flex; gap: 6px; align-items: center; min-height: 44px; padding: 4px 12px 4px 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); cursor: pointer; }
      .${P}checks input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 14px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -12px; }
      .${P}checks input:checked { background-color: var(--good); outline-color: var(--good); }
      .lopts button code { font-size: 14px; overflow-wrap: anywhere; }
      .${P}nb { min-height: 44px; margin-top: 4px; }
      @media (max-width: 420px) {
        .${P}lines button, .${P}lines div { font-size: 12.5px; padding-left: calc(10px + var(--ind, 4ch)); }
      }
    `;
    document.head.appendChild(s);
  }
  const ind = line => `--ind:${Math.min(12, line.match(/^ */)[0].length + 4)}ch`;
  const box = (lines, kit) => `<div class="${P}lines">${lines.map(c => `<div style="${ind(c)}">${kit.esc(c) || " "}</div>`).join("")}</div>`;
  // a listing whose lines are buttons; picked = [index, right?]
  const pickBox = (lines, picked, kit, lock, id) => `<div class="${P}lines"${id ? ` id="${id}"` : ""} role="group">${lines.map((c, j) => !tapRow(c) ? `<div style="${ind(c)}">${kit.esc(c) || " "}</div>` : `<button type="button" data-i="${j}" style="${ind(c)}" class="${picked && picked[0] === j ? (picked[1] ? "on" : "no") : ""}" ${lock ? "disabled" : ""}>${kit.esc(c) || " "}</button>`).join("")}</div>`;
  const cap = t => `<p class="${P}cap">${t}</p>`;

  // several questions on one screen, each shown once the one before is right
  function chain({ el, done, kit }, head, Q, after) {
    const ans = Q.map(() => null);
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const shown = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = head() + Q.slice(0, shown).map((x, i) => `<div class="lcase" id="q${i}">${x.q}${kit.options(x.opts, { picked: ans[i], correct: x.right })}
        ${ans[i] == null ? "" : kit.feedback(ans[i] === x.right ? x.yes : x.no[ans[i]], ans[i] === x.right)}${ans[i] === x.right && x.then ? x.then : ""}</div>`).join("") + (upto === -1 && after ? after() : "");
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i;
        if (ans[i] !== Q[i].right) for (let j = i + 1; j < Q.length; j++) ans[j] = null;
        paint();
        if (Q.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation: the episode, the pieces, and the sentence that is in none of them. */
  function situation({ el, done, kit }) {
    style();
    let pick = null;
    const paint = () => {
      const ok = pick === LOST;
      const inPiece = i => EP_PIECES.findIndex(p => p.includes(EP_SENT[i]));
      el.innerHTML = `<h1>The sentence that never arrives</h1>
        <p class="lead">You build search for a podcast app. A function, <code>split_transcript</code>, cuts each episode's transcript into pieces of at most ${EP_MAX} characters, whole sentences only. Search then finds the piece that matches. (A RAG app does the same cutting, called chunking, before it retrieves.) A listener searched for the host's goodbye at the end of an episode and got nothing.</p>
        <p class="${P}lab">The pieces it really returned (max ${EP_MAX})</p>
        ${box(EP_PIECES.map((p, i) => `${i + 1}: ${p}`), kit)}
        ${cap(`Output of the splitter on this Mac, from <code>situation.py</code>. The episode text was written for this lesson.`)}
        <p class="task">Here are the episode's ${EP_SENT.length} sentences. Tap the one that is in none of the pieces.</p>
        <div class="${P}rows">${EP_SENT.map((s, i) => `<button type="button" class="${P}row ${pick === i ? (ok ? "on" : "no") : ""}" data-i="${i}" ${ok ? "disabled" : ""}><small>sentence ${i + 1}</small>${kit.esc(s)}</button>`).join("")}</div>
        <div class="lpanel">${pick == null ? "" : ok
          ? kit.feedback(`Right. “${kit.esc(EP_SENT[LOST])}” is the last sentence, and no piece has it. Nothing crashed and no error was printed: the function quietly returned less than it was given. Bugs like this are found only when someone checks the output against what it should be. This lesson is about making a program do that check for you.`, true)
          : kit.feedback(`“${kit.esc(EP_SENT[pick])}” is in piece ${inPiece(pick) + 1}. Read the end of each piece and compare it with the list of sentences: which one comes after the last piece ends?`, false)}</div>`;
      el.querySelectorAll(`.${P}row`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === LOST) done(); });
    };
    paint();
  }

  /* 2. By hand: the expected output for five inputs, from the rules. */
  const lens = t => sentencesOf(t).map(s => s.length);
  function byHand(ctx) {
    style();
    const { kit } = ctx;
    const L = CASES.map(([t]) => lens(t));
    const [, , c2, c3, c4] = L;
    const sum2 = c2[0] + 1 + c2[1], sum3 = sum2 + 1 + c3[2], sum4 = c4[0] + 1 + c4[1];
    const opt = a => `<code>${kit.esc(pyList(a))}</code>`;
    const ask = (i) => `<p>Input ${i + 1}: <code>${kit.esc(pyStr(CASES[i][0]))}</code>${L[i].length ? ` (sentence lengths: ${L[i].join(", ")})` : ""}</p>`;
    const E = CASES.map(c => c[1]);
    const Q = [
      { q: ask(0), opts: [opt([""]), opt(E[0]), "It raises an error"], right: 1,
        yes: "Right. No text, no pieces: an empty list. An episode with no transcript yet is normal, so it is not an error.",
        no: { 0: `That is a list with one empty piece in it. Search would store a blank entry. No text means no pieces at all: <code>[]</code>.`, 2: "An episode with no transcript yet is normal, not an error. The rule says: no text gives no pieces." } },
      { q: ask(1), opts: [opt([]), opt(["Welcome back"]), opt(E[1])], right: 2,
        yes: "Right. One sentence, under the limit, in one piece, with its full stop.",
        no: { 0: "The sentence is there, so it must come out. An empty list would lose all of it.", 1: "The full stop is part of the sentence. The splitter gives each sentence its full stop back." } },
      { q: ask(2), opts: [opt(E[2]), opt(sentencesOf(CASES[2][0]))], right: 0,
        yes: `Right. ${c2[0]} + 1 space + ${c2[1]} = ${sum2}, not over ${MAX}, so both fit in one piece.`,
        no: { 1: `They fit together: ${c2[0]} + 1 space + ${c2[1]} = ${sum2}, not over ${MAX}. A piece takes as many sentences as fit.` } },
      { q: ask(3), opts: [opt([CASES[3][0]]), opt(sentencesOf(CASES[3][0])), opt(E[3])], right: 2,
        yes: `Right. The first two make ${sum2}. Adding the third would make ${sum3}, over ${MAX}, so it starts a second piece.`,
        no: { 0: `All three together are ${sum3} characters, over ${MAX}. The third sentence must start a new piece.`, 1: `The first two fit together (${sum2} characters), so they share a piece. Only the third needs a new one.` } },
      { q: ask(4), opts: [opt([CASES[4][0]]), opt([CASES[4][0].slice(0, MAX).trim(), CASES[4][0].slice(MAX).trim()]), opt(E[4])], right: 2,
        yes: `Right. The first sentence is ${c4[0]} characters, longer than ${MAX}, so it gets a piece of its own, whole. “Hi.” goes in the next piece.`,
        no: { 0: `${c4[0]} + 1 + ${c4[1]} = ${sum4}, over ${MAX}. The long sentence stays alone and “Hi.” starts a new piece.`, 1: `That cuts a sentence in the middle. The rule is never to cut one: a sentence longer than ${MAX} gets a piece of its own.` } }
    ];
    chain(ctx, () => `<h1>Write down what should come out</h1>
      <p class="lead">Before touching the code, decide what the right answer is. The rules for <code>split_transcript(text, ${MAX})</code>:</p>
      <ul class="${P}rules"><li>Cut the text into sentences at each full stop. Each sentence keeps its full stop.</li>
      <li>A piece is at most ${MAX} characters, counting one space between sentences. Fill it with as many whole sentences as fit.</li>
      <li>Never cut a sentence. One longer than ${MAX} gets a piece of its own.</li>
      <li>No text gives no pieces.</li></ul>
      <p class="task">For each input, pick the list the function should return. Python writes a list of strings like <code>['a.', 'b.']</code>.</p>`, Q,
      () => kit.feedback(`You now have ${WORDS[CASES.length].toLowerCase()} inputs, each with the output you worked out from the rules. Each pair is called a <b>case</b>, and the output is the <b>expected</b> value. They were chosen on purpose: empty, one sentence, two that fit, one that spills over, one too long. These are <b>edge cases</b>, the inputs at the limits of the rules, and bugs often hide there.`));
  }

  /* 3. Spot the idea: keep the cases, let a program compare. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = ["Run it on a real episode after each change and read the pieces.",
      "Keep the five inputs and their expected outputs in code, and let a program compare them on every change.",
      "Add type hints, so the function must return a list of strings."];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>How do you keep it fixed?</h1>
        <p class="lead">Someone will fix the splitter. Next month a teammate changes it again: question marks should end sentences too. A change like that can quietly bring the bug back.</p>
        <p class="task">What makes sure the last sentence never goes missing again, without anyone remembering to look?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. That is a <b>test</b>: an input, the output you decided on beforehand, and a program that compares them. It runs in a second, every time, and it does not get tired. A test that once caught a bug and stays in the code is called a <b>regression test</b>: it stops the bug coming back.", true)
          : ans === 0 ? kit.feedback("That is how the bug was found, by a listener, late. Reading pieces by eye misses one lost sentence among hundreds, and nobody does it after every small change.", false)
          : kit.feedback("Types check the shape, not the content. <code>[]</code> is a list of strings too, and so is a list missing its last piece. The function would pass the type check and still lose the sentence.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Predict: which cases pass against the buggy splitter? */
  function predict(ctx) {
    style();
    const { kit } = ctx;
    const Q = CASES.map(([t, e], i) => {
      const pass = VERDICT[i], lastPiece = e[e.length - 1];
      return {
        q: `<p>Input ${i + 1}: <code>${kit.esc(pyStr(t))}</code>, expected <code>${kit.esc(pyList(e))}</code></p>`,
        opts: ["PASS", "FAIL"], right: pass ? 0 : 1,
        yes: pass ? "Right, and it passes by luck. There is no text, so no piece is being built, and dropping nothing changes nothing. A passing case does not prove the code is right."
          : `Right. The last piece here is ${kit.esc(pyStr(lastPiece))}, and the splitter drops it.`,
        no: pass ? { 1: "There is no text, so the splitter never builds a piece. Dropping the last piece drops nothing: it returns <code>[]</code>, which is what you expected." }
          : { 0: `The splitter drops the last piece it was building, here ${kit.esc(pyStr(lastPiece))}. The output is one item short of the expected list.` }
      };
    });
    chain(ctx, () => `<h1>Which cases pass today?</h1>
      <p class="lead">You know one thing about the current splitter from the episode: the piece it is still building when the text ends never comes out. Now run your ${WORDS[CASES.length].toLowerCase()} cases in your head.</p>
      <p class="task">For each case, predict PASS (the output equals the expected list) or FAIL.</p>`, Q,
      () => kit.feedback(`${VERDICT.filter(v => !v).length} of ${CASES.length} fail. The next screen runs the same cases for real, with a test runner small enough to read.`));
  }

  /* 5. From scratch: a small test runner, replayed from a real trace. */
  const repr = v => Array.isArray(v) ? pyList(v) : typeof v === "string" ? pyStr(v) : String(v);
  const sayStep = (k) => {
    const [ln, v] = STEPS[k];
    if (ln === 1) return "The runner starts. <code>failed</code> will count the cases whose output does not match.";
    if (ln === 2) return k + 1 < STEPS.length && STEPS[k + 1][0] === 3 ? "Take the next case: an input and the output you wrote down for it." : "No cases left. The loop ends.";
    if (ln === 3) return `Call the splitter on ${repr(v.text)}.`;
    if (ln === 4) return `Compare <code>got</code> ${repr(v.got)} with <code>expected</code> ${repr(v.expected)}. Python's <code>==</code> on two lists checks the length and every item in order. (In JavaScript, <code>[] === []</code> is false, because it compares references; Python compares contents.) ${same(v.got, v.expected) ? "They are equal." : "They differ."}`;
    if (ln === 5) return "Equal: print PASS. <code>repr</code> shows the text with its quotes, so empty text prints as <code>''</code> instead of nothing.";
    if (ln === 7) return "Not equal: count one more failure.";
    if (ln === 8) return STEPS[k - 1][0] === 9 ? "Both lines of the call are ready. Now the print runs: FAIL, the input and what really came out." : "Next: print FAIL and what really came out, so you can see the difference. This print call is written on two lines. Python reads both lines before it prints.";
    if (ln === 9) return "The second line of the same call: the word got and the list the splitter returned.";
    if (ln === 10) return `All cases done. The runner returns ${v.failed}: ${v.failed} of ${CASES.length} failed, the same as you predicted.`;
    return "";
  };
  function scratch({ el, done, kit }) {
    style();
    let i = 0;
    const paint = () => {
      const [ln, v, out] = STEPS[i];
      const show = k => k in v ? `<b>${kit.esc(repr(v[k]))}</b>` : "<b>–</b>";
      el.innerHTML = `<h1>A test runner from scratch</h1>
        <p class="lead">Before any library, here is the whole idea in plain Python: loop over the cases, call the function, compare, report. This is a replay of a real run on this Mac against the buggy splitter.</p>
        <p class="task">Step through the run to the end. Watch <code>got</code> and <code>expected</code> at each comparison.</p>
        ${kit.code(RUNNER, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === STEPS.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>text ${show("text")}</span><span>got ${show("got")}</span><span>expected ${show("expected")}</span><span>failed ${show("failed")}</span><span>step <b>${i + 1} / ${STEPS.length}</b></span></div>
        ${kit.feedback(sayStep(i))}
        <p class="${P}lab">Printed so far</p>
        ${out ? box(out.trimEnd().split("\n"), kit) : cap("nothing yet")}
        ${i === STEPS.length - 1 ? kit.feedback("That is all a test is. It works, but you would soon want more: a name for each case, a clear picture of what differs in a long list, a way to share setup, a summary line. pytest gives you those, next.", true) : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === STEPS.length - 1) done(); };
    };
    paint();
  }

  /* 6. pytest: the same cases with parametrize, and reading its report. */
  function withPytest(ctx) {
    style();
    const { kit } = ctx;
    const Q = [
      { q: `<p>The file has one test function. How many tests did pytest run?</p>`,
        opts: ["1", String(RUN_COUNT), String(FAIL_COUNT)], right: 1,
        yes: `Right. The first line of the report has one character per test: <code>${DOTS}</code>, a dot for a pass and F for a failure. <code>parametrize</code> ran <code>test_split</code> once per case. Each run gets its own name, with the case in square brackets. In the failure shown, the name is <code>${kit.esc(CASE_ID)}</code>: the input text, a dash, then the word <code>expected</code> with the case's position, counting from 0.`,
        no: { 0: `Look at the first line: <code>${DOTS}</code>. One character per test that ran. <code>parametrize</code> runs the function once for every tuple in the list.`, 2: `${FAIL_COUNT} is how many failed. The first line, <code>${DOTS}</code>, also has a dot: a test that ran and passed.` } },
      { q: `<p>In the failure shown, which line tells you <b>what</b> is wrong with the output?</p>`,
        opts: [`<code>${kit.esc(REPORT_V1[7].trim())}</code>`, `<code>${kit.esc(REPORT_V1[10].replace(/^E\s+/, ""))}</code>`, `<code>${kit.esc(REPORT_V1[13])}</code>`], right: 1,
        yes: "Right. pytest compared the two lists for you and names the difference: one item is missing, and it says which.",
        no: { 0: "The line marked <code>&gt;</code> is <b>where</b> the test failed: the assert. It is the same line for every case, so it cannot say what went wrong in this one.", 2: "That is the file and line number of the assert: where, not what. Read the lines starting with E, just above it." } },
      { q: `<p>“Right contains one more item.” What is “Right” here?</p>`,
        opts: ["The right answer the splitter should give, as pytest knows it", "The right-hand side of the <code>==</code>: here <code>expected</code>", "The right-most piece of the transcript"], right: 1,
        yes: "Right. pytest names the two sides of the comparison Left and Right. You wrote <code>split_transcript(...) == expected</code>, so Left is what the function returned and Right is your expected list. Your expected list has one more item, so the function lost one. Keep the order the same in every test, actual on the left, and the report always reads the same way.",
        no: { 0: "pytest knows nothing about what is right. It only compares two values. Here “Right” is a position: the right-hand side of the <code>==</code>.", 2: "It is not about the transcript. pytest names the two sides of the <code>==</code> Left and Right. Your assert has <code>expected</code> on the right." } }
    ];
    chain(ctx, () => `<h1>The same cases in pytest</h1>
      <p class="lead"><b>pytest</b> is the usual test runner for Python. It finds files named <code>test_*.py</code> (or <code>*_test.py</code>) and runs every function whose name starts with <code>test</code>. <code>@pytest.mark.parametrize</code> gets the names of the test's parameters and a list of tuples, one tuple per case. It runs the test once per tuple. Inside the test is a plain <code>assert</code>. When it fails, pytest shows the values on both sides.</p>
      ${box(TEST_FILE, kit)}
      <p class="${P}lab">pytest -q on the buggy splitter (-q: short report)</p>
      ${box(REPORT_V1, kit)}
      ${cap("Real output on this Mac. Whole lines are cut where … stands; nothing shown is altered.")}
      <p class="task">Read the report and answer.</p>`, Q);
  }

  /* 7. Fixtures: shared setup, and how often it runs. */
  function fixtures(ctx) {
    style();
    const { kit } = ctx;
    const nf = loads(OUT_FUNC), nm = loads(OUT_MOD);
    const counts = [...new Set([1, FIX_TESTS, 0])].sort((a, b) => a - b).map(String);
    const Q = [
      { q: `<p>pytest runs with <code>-s</code>, so prints show. ${WORDS[FIX_TESTS]} tests ask for <code>episode</code>. How many times is “loading episode” printed?</p>`,
        opts: counts, right: counts.indexOf(String(nf)),
        yes: `Right: ${nf}. By default a fixture has <b>function scope</b>: it runs again for each test that asks for it, and is thrown away when that test ends.`,
        no: Object.fromEntries(counts.map((c, j) => [j, +c === 0 ? "The tests name <code>episode</code> as a parameter, and that is exactly how a test asks for a fixture. pytest calls the fixture and passes in what it returns." : `By default each test gets its own fresh copy: the fixture runs once per test that asks for it, not once in total.`])),
        then: box(OUT_FUNC, kit) + cap("Real output, fixture_function.out.txt. Each dot is a test that passed.") },
      { q: `<p>Change the decorator to <code>@pytest.fixture(scope="module")</code> and run again. How many times now?</p>`,
        opts: counts, right: counts.indexOf(String(nm)),
        yes: `Right: ${nm}. A module is one <code>.py</code> file. With module scope, pytest makes the value once for the whole file and hands the same object to every test in it.`,
        no: Object.fromEntries(counts.map((c, j) => [j, +c === 0 ? "The fixture still has to run at least once to load the file. Scope only changes how often." : `That is the default, function scope. <code>scope="module"</code> keeps one value for every test in the file.`])),
        then: box(OUT_MOD, kit) + cap("Real output, fixture_module.out.txt.") },
      { q: "<p>Loading once is faster. Why is a fresh value per test still the default?</p>",
        opts: ["So that a test that changes the value cannot break the tests after it", "Because pytest cannot share one object between tests", "Because a fixture runs faster than a module-level variable"], right: 0,
        yes: "Right. Tests should not depend on each other or on their order. If one test changed a shared list or dict, the next test would see the change and fail for a reason that is not its own. Share a value across tests only when it is expensive to make and no test changes it.",
        no: { 1: `It can: with <code>scope="module"</code> it just did, printing once for ${FIX_TESTS} tests. Sharing is possible; it is not the default because of what a test might do to the shared value.`, 2: "Speed is not the reason; a fresh value per test is the slower choice. The reason is safety: what one test changes, the next one must not see." } }
    ];
    chain(ctx, () => `<h1>Shared setup: fixtures</h1>
      <p class="lead">Three new tests check a whole episode: no piece too long, the last sentence kept, no word lost. They all need the transcript loaded. A <b>fixture</b> is a function marked <code>@pytest.fixture</code>. A test asks for it by naming it as a parameter. pytest then calls the fixture and passes in what it returns. pytest also hides what tests print unless you run it with <code>-s</code>.</p>
      ${box(FIX_FILE, kit)}
      <p class="task">Predict, then see the real run.</p>`, Q);
  }

  /* 8. Broken on purpose: the one-line fix, its report, the cause and the right fix. */
  function broken({ el, done, kit }) {
    style();
    const RIGHT_REP = [5, 7];   // the two E lines that say what differs
    let rep = null, line = null, fix = null;
    const repWhy = {
      0: "That line says one test failed and four passed. It tells you that something broke, not what. Look below it.",
      1: "That is the name of the failing case: the empty input. Useful, but it says which case, not what went wrong in it.",
      2: "That is the input: empty text and an empty expected list. It is normal input, not the problem.",
      4: "The line marked &gt; is where the test stopped: the assert. It is the same in every case. The lines starting with E say what differed.",
      9: "That is the file and line of the assert: where, not what.",
      11: "The summary counts tests. It does not say what differed."
    };
    const fixOpts = ["Delete the new line again", `Add the last piece only when there is one: <code>if current:</code> before it`, "Change the test: expect <code>['']</code> for empty text"];
    const fixRight = 1;
    const fixWhy = {
      0: `Then the last piece is never added, and the ${FAIL_COUNT} cases that failed before fail again. The line is needed; it just needs a condition.`,
      2: "That makes the test agree with the bug. Search would store an empty piece for every episode without a transcript. Change the test only when the rule changes, not to make a run pass."
    };
    const lineWhy = j => j === 6
      ? "That <code>append</code> is inside the loop and runs only when a piece is full. With empty text the loop never runs, so it cannot add anything."
      : j === 1 ? "For empty text this gives <code>[]</code>: the <code>if s.strip()</code> drops the empty string. That is correct."
      : j === SPLIT_V2.length - 1 ? "<code>return</code> only hands back the list. Something before it put the empty string in."
      : j === 2 ? "This line sets <code>current</code> to an empty string. That is a fine start; the problem is what happens to it later when nothing else runs."
      : "With empty text there are no sentences, so the loop body never runs. Look at what still runs after the loop.";
    const paint = () => {
      const repOk = rep != null && RIGHT_REP.includes(rep), lineOk = line === V2_BUG, fixOk = fix === fixRight;
      el.innerHTML = `<h1>The fix that broke something</h1>
        <p class="lead">A teammate fixes the lost sentence with one line after the loop, <code>pieces.append(current)</code>, and pushes the change. The tests run again. This is the real report.</p>
        <p class="task">1. Tap the report line that says what is wrong with the output.</p>
        ${pickBox(REPORT_V2, rep == null ? null : [rep, repOk], kit, repOk, "rep")}
        ${cap("Real output on this Mac, v2_quickfix/pytest.out.txt. Every cut is marked with …; nothing shown is altered.")}
        ${rep == null ? "" : repOk ? kit.feedback("Right. Left is what the function returned: <code>['']</code>, a list with one empty string. Right is the expected <code>[]</code>. For empty text the function now returns an empty piece.", true) : kit.feedback(repWhy[rep], false)}
        ${repOk ? `<p class="task">2. Tap the line of the new splitter that put the empty string there.</p>
          ${pickBox(SPLIT_V2, line == null ? null : [line, lineOk], kit, lineOk, "code")}
          ${line == null ? "" : lineOk ? kit.feedback("Right. For empty text the loop never runs, <code>current</code> is still <code>\"\"</code>, and this line appends it anyway. The other four cases pass because their last piece is never empty.", true) : kit.feedback(lineWhy(line), false)}` : ""}
        ${lineOk ? `<div class="lcase" id="fix"><p class="task">3. Pick the fix.</p>${kit.options(fixOpts, { picked: fix, correct: fixRight })}
          ${fix == null ? "" : fixOk ? kit.feedback(`Right. With <code>if current:</code> the run ends: <code>${V3_LAST}</code> (v3_fixed/pytest.out.txt). The empty case caught a fix that was half right, minutes after it was written. That is what the case was for.`, true) : kit.feedback(fixWhy[fix], false)}</div>` : ""}`;
      el.querySelectorAll("#rep button").forEach(b => b.onclick = () => { rep = +b.dataset.i; paint(); });
      el.querySelectorAll("#code button").forEach(b => b.onclick = () => { line = +b.dataset.i; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === fixRight) done(); });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  function bigPicture(ctx) {
    style();
    const Q = [
      { q: "<p>A test checks that <code>split_transcript</code> calls <code>text.split</code> exactly once. A teammate rewrites the function with a regular expression. Every output is the same, but that test fails. What went wrong?</p>",
        opts: ["The rewrite has a bug the other tests missed", "The test checked how the function works, not what it returns, so it broke on a safe change", "Regular expressions cannot be tested with pytest"], right: 1,
        yes: "Right. Tests that pin the inside of a function break whenever someone improves it, and people learn to ignore them. Test what goes in and what comes out.",
        no: { 0: "Every output is the same, so the cases that check outputs all pass. Only the test about the inside broke.", 2: "pytest tests any Python function; it only sees what the function returns. The problem is what this one test checks." } },
      { q: "<p>Another test sends a real audio file to a paid speech-to-text service and checks the transcript. What bites first?</p>",
        opts: ["Nothing: real calls are the best test", "It is slow, it fails when the network or the service does, and it may cost money on every run"], right: 1,
        yes: "Right. Unit tests should be fast and give the same result every time. For your own code around the call, swap the service for a fake that returns a fixed transcript (pytest's built-in <code>monkeypatch</code> fixture can replace a function for one test and undoes it afterwards). Check the real service separately, less often.",
        no: { 0: "A real call checks the service as well as your code. It is slow, can fail for reasons that are not your bug, and may be charged per call. People stop running tests that are slow or flaky (pass one run, fail the next)." } }
    ];
    chain(ctx, () => `<h1>When tests pay off</h1>
      <p><b>What for:</b> writing down what a function must return, so a program checks it on every change. A test like these, of one small function on its own, is a <b>unit test</b>.</p>
      <p><b>When:</b> code that gives the same output for the same input. Splitting text, parsing, building a prompt from a template, scoring: much of an AI app is code like this.</p>
      <p><b>When not:</b> when there is no single right output, such as a model's written answer (that needs an evaluation set with scores, later in the path); or when the thing is outside your code, such as a live service (watch it with monitoring).</p>
      <p><b>What it costs:</b> time to write the cases, and time to keep them right as rules change. Slow tests get skipped.</p>
      <p class="task">Two situations about the cost. Pick what is going on.</p>`, Q);
  }

  /* 10. Recognise: would a unit test with exact expected outputs catch this? */
  const RECOG = [
    ["A function turns a duration in seconds into text for the player, like “1:05”. One listener saw “1:5”.", true,
      "Yes. Same input, same output, and you can write the expected text by hand. Parametrize the edges: 0, 5, 65, 3600.",
      "This is deterministic code with a known right answer: 65 seconds must give “1:05”. That is exactly what a parametrized test pins down."],
    ["After a prompt change, you want to know whether a model's one-paragraph episode summaries got worse.", false,
      "No. The model writes different words on every run, and many different summaries are good. An exact <code>==</code> would fail on good answers. This needs an evaluation set: many episodes, scored by rules or a judge, compared before and after the change.",
      "An exact expected string does not exist here: the wording changes each run and many summaries are fine. A test with <code>==</code> would fail on good answers. Quality is measured with an evaluation set and scores, a later part of the path."],
    ["A parser reads episode dates from three feed formats. A fix for one format must not break the other two.", true,
      "Yes. One parametrized test with a case per format. When the fix breaks a format, the report names that case.",
      "Three formats, each with a known right date: that is a list of cases. Parametrize them, and a fix for one format that breaks another fails at once."],
    ["Search feels slow for listeners in another country.", false,
      "No. A unit test runs one function on your machine. Slowness for far-away users comes from the network, servers and load. Measure it where it happens, with monitoring and timing in production.",
      "A unit test calls a function on your machine, with no real network and no real users. The slowness lives between the listener and your servers. You find it by measuring there."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = RECOG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A unit test, or not?</h1>
        <p class="lead">${WORDS[RECOG.length]} situations away from the splitter.</p>
        <p class="task">For each one, decide whether a pytest unit test with exact expected outputs is the right tool. Pick again if you change your mind.</p>
        ${RECOG.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (RECOG.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook with a checklist from our own runs, then the next lesson. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s1-py-testing.ipynb";
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    const checks = [
      `<code>pytest -q</code> on the first splitter prints <code>${DOTS}</code> and ends with <code>${kit.esc(REPORT_V1[REPORT_V1.length - 1].split(" in ")[0])}</code>`,
      `The failure for the three-sentence case says <code>${kit.esc(REPORT_V1[10].replace(/^E\s+/, ""))}</code>`,
      `With <code>-s</code>, the <code>episode</code> fixture prints “loading episode” ${loads(OUT_FUNC)} times; with <code>scope="module"</code>, ${loads(OUT_MOD) === 1 ? "once" : loads(OUT_MOD) + " times"}`,
      `The ${FIX_TESTS} episode tests against the first splitter end with <code>${FIX_BUG_LAST.split(" in ")[0]}</code>: the length test passes even though text is lost`,
      `After the <code>if current:</code> fix, the five cases end with <code>${V3_LAST.split(" in ")[0]}</code>`
    ];
    el.innerHTML = `<h1>You can pin down what code must do</h1>
      <p>A test is an input, the output you decided on beforehand, and a program that compares them. pytest finds <code>test_</code> functions, runs a parametrized test once per case, and shows both sides of a failing <code>assert</code>: With the actual value on the left of <code>==</code>, Left is what you got and Right is what you expected. Fixtures share setup, fresh for each test unless you choose a wider scope.</p>
      ${NOTEBOOK_URL ? `<p><a class="btn ${P}nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a></p>` : ""}
      <p class="lead">${NOTEBOOK_URL ? "" : "The notebook for this lesson is on its way. "}In it you write the splitter, its parametrized test and the episode fixture, break it and fix it as here. Tick what you see while you run it:</p>
      <ul class="${P}checks">${checks.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. It starts working with data in arrays. When you write array code, the same habit holds: decide the expected result for a small input first, then check it with a test.</p>` : ""}`;
    done();
  }

  /* ---------- walks ---------- */
  const caseRights = n => Array.from({ length: n }, (_, i) => `#q${i} [data-right]`);

  LessonKit.define("s1-py-testing", {
    title: "Testing with pytest",
    checked: "2026-11-13",
    sources: [
      "https://docs.pytest.org/en/stable/how-to/parametrize.html",
      "https://docs.pytest.org/en/stable/how-to/fixtures.html",
      "https://docs.pytest.org/en/stable/how-to/assert.html",
      "https://docs.pytest.org/en/stable/explanation/goodpractices.html",
      "https://docs.pytest.org/en/stable/how-to/capture-stdout-stderr.html",
      "https://docs.pytest.org/en/stable/how-to/monkeypatch.html",
      "https://docs.python.org/3/reference/expressions.html#value-comparisons"
    ],
    interview: [{
      q: "Your team's chunker feeds a search index. Users say answers miss facts that sit at the end of documents. How do you use tests to find the bug and keep it fixed?",
      good: ["Reproduce it with the smallest input that shows it, and write the expected chunks by hand from the rules",
        "Parametrize the edge cases: empty text, one sentence, an exact fit, one that spills over, one longer than the limit",
        "Read the failing assert: Left is what the function returned, Right is what you expected, and the diff names the missing item",
        "Fix it and keep the case as a regression test that runs on every change",
        "Add checks on a real document through a fixture: no words lost, no chunk over the limit"],
      weak: "“Look at some chunks by eye, patch the loop and re-index.” It finds nothing repeatable and nothing stops the bug from coming back."
    }, {
      q: "A test suite for an LLM app calls the model API in every test. It is slow, sometimes fails for no clear reason, and costs money. What do you change?",
      good: ["Separate the deterministic code (prompt building, parsing, chunking) from the model call and unit-test it with exact asserts",
        "In unit tests, replace the API client with a fake that returns a fixed answer, for example with monkeypatch",
        "Judge the real model's quality separately, with an evaluation set and scores, run less often",
        "Keep shared setup in fixtures, function scope by default, so tests stay independent"],
      weak: "“Add retries and a longer timeout.” The tests stay slow and costly, and they still test the network instead of your code."
    }],
    screens: [situation, byHand, spotIdea, predict, scratch, withPytest, fixtures, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`.${P}row[data-i="0"]`], right: [`.${P}row[data-i="${LOST}"]`] },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(CASES.length) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(CASES.length) },
      { right: Array(STEPS.length - 1).fill("[data-next]") },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(3) },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(3) },
      { wrong: ['#rep [data-i="0"]'], right: ['#rep [data-i="7"]', `#code [data-i="${V2_BUG}"]`, "#fix [data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: caseRights(2) },
      { wrong: ["#c1 [data-wrong]"], right: RECOG.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
