/* Lesson s1-py-from-js: Python for a JavaScript developer.
   Story: a farmers' market totals each stall's takings with a small JavaScript script; the data team works in
   Python and asks for a port (the market, its stalls and its numbers are made up for the lesson).
   Ideas: (1) Python's operators do not guess: no type coercion, // rounds down, round() sends ties to the even
   neighbour, an empty list is false, a missing key is an error; (2) a name is a label on an object: = and
   passing an argument never copy, and a default value is built once, when def runs.
   Data: docs/ai-path/runs/s1-py-from-js/ (snippets.py -> snippets.out.txt = every Python snippet's real output;
   snippets_js.mjs -> snippets_js.out.txt = the JavaScript side, run with node; market.py -> market.out.txt = the
   traced port; broken_csv.py -> broken_csv.out.txt = the real traceback; fixed_csv.py -> fixed_csv.out.txt;
   env.txt = versions). No model was called for this lesson.
   Every number on screen is computed here from PY, JS, SALES, TRACE and TOTALS. Lesson-local CSS: the output block,
   the clickable traceback and a compact table (prefix lx-s1-py-from-js-). */
(() => {
  const P = "lx-s1-py-from-js-";

  // From docs/ai-path/runs/s1-py-from-js/snippets.out.txt (the JSON line; Python 3.12.11)
  const PY = {
    "true-div": "3.5", "floor-div": "-4", "str-plus-int": "TypeError: can only concatenate str (not \"int\") to str",
    "round-half": "2", "empty-list": "no notes", "missing-key": "KeyError: 'Bread'", "alias": "['Honey', 'Bread', 'Eggs']",
    "mutable-default": "[500, 700]", "copy-append": "1", "copy-inner": "0", "copy-deep": "900",
    "comp-euros": "{'Honey': 21.5, 'Bread': 40.0, 'Eggs': 9.75}", "comp-filter": "['Honey', 'Bread']", "comp-sum": "7125",
    "port-for-of": "SyntaxError: invalid syntax (<string>, line 2)", "port-range": "0\n1",
    "port-dot": "AttributeError: 'dict' object has no attribute 'stall'", "port-or": "KeyError: 'Honey'",
    "port-get": "{'Honey': 1200}", "float-sum": "0.30000000000000004", "sort-numbers": "[1, 9, 10]"
  };
  // From docs/ai-path/runs/s1-py-from-js/snippets_js.out.txt (the JSON line; node v26.12.0)
  const JS = {
    "true-div": "3.5", "floor-div": "-3", "floor-div-floor": "-4", "str-plus-int": "Stall 4", "round-half": "3",
    "empty-list": "has notes", "missing-key": "undefined", "alias": "[\"Honey\",\"Bread\",\"Eggs\"]", "mutable-default": "[700]",
    "csv-plus": "{\"Honey\":\"01200950\",\"Bread\":\"0450\"}", "market": "{\"Honey\":2150,\"Bread\":4000,\"Eggs\":975}",
    "float-sum": "0.30000000000000004", "sort-numbers": "[1,10,9]"
  };
  // From docs/ai-path/runs/s1-py-from-js/market.py: the five sales (cents)
  const SALES = [["Honey", 1200], ["Bread", 450], ["Honey", 950], ["Eggs", 975], ["Bread", 3550]];
  // From docs/ai-path/runs/s1-py-from-js/market.out.txt: [about to run line, totals, sale index (null = not set), stall]
  const H = "Honey", B = "Bread", E = "Eggs";
  const TRACE = [
    [1, null, null, null], [2, {}, null, null], [3, {}, 0, null], [4, {}, 0, H],
    [2, { [H]: 1200 }, 0, H], [3, { [H]: 1200 }, 1, H], [4, { [H]: 1200 }, 1, B],
    [2, { [H]: 1200, [B]: 450 }, 1, B], [3, { [H]: 1200, [B]: 450 }, 2, B], [4, { [H]: 1200, [B]: 450 }, 2, H],
    [2, { [H]: 2150, [B]: 450 }, 2, H], [3, { [H]: 2150, [B]: 450 }, 3, H], [4, { [H]: 2150, [B]: 450 }, 3, E],
    [2, { [H]: 2150, [B]: 450, [E]: 975 }, 3, E], [3, { [H]: 2150, [B]: 450, [E]: 975 }, 4, E], [4, { [H]: 2150, [B]: 450, [E]: 975 }, 4, B],
    [2, { [H]: 2150, [B]: 4000, [E]: 975 }, 4, B], [5, { [H]: 2150, [B]: 4000, [E]: 975 }, 4, B],
    [5, { [H]: 2150, [B]: 4000, [E]: 975 }, 4, B]   // the last row is the "return" event
  ].map(([line, totals, sale, stall]) => ({ line, totals, sale, stall }));
  const TOTALS = TRACE[TRACE.length - 1].totals;   // also market.out.txt "RESULT"
  // From docs/ai-path/runs/s1-py-from-js/broken_csv.out.txt, line for line (the run command's sed cut the folder path to …)
  const TB = [
    "{'stall': 'Honey', 'cents': '1200'}",
    "Traceback (most recent call last):",
    "  File \"…/broken_csv.py\", line 18, in <module>",
    "    print(total_by_stall(sales))",
    "          ^^^^^^^^^^^^^^^^^^^^^",
    "  File \"…/broken_csv.py\", line 15, in total_by_stall",
    "    totals[stall] = totals.get(stall, 0) + sale[\"cents\"]",
    "                    ~~~~~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~",
    "TypeError: unsupported operand type(s) for +: 'int' and 'str'"
  ];
  // From docs/ai-path/runs/s1-py-from-js/fixed_csv.out.txt and takings.csv
  const FIXED = "{'Honey': 2150, 'Bread': 450}";
  const CSV = ["stall,cents", "Honey,1200", "Bread,450", "Honey,950"];

  /* ---------- derived ---------- */
  const euro = c => (c / 100).toFixed(2);
  const errName = s => s.split(":")[0];
  const outBlock = (txt, label) => `<div class="${P}lab">${label}</div><div class="${P}out">${txt}</div>`;
  const jsBlock = (q, js) => `<span class="${P}js">${q} gives <code>${js}</code>.</span>`;

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}lab { font: 600 12px var(--font); color: var(--muted); margin: 10px 0 2px; }
      .${P}out { white-space: pre-wrap; font: 500 14px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; overflow-wrap: anywhere; }
      .${P}js { display: block; margin-top: 6px; }
      .${P}score { font: 600 15px var(--font); margin-top: 14px; }
      .${P}tbwrap { overflow-x: auto; margin-top: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
      .${P}tb { display: grid; min-width: max-content; padding: 6px; gap: 2px; }
      .${P}tl { display: block; text-align: left; white-space: pre; font: 500 13px/1.4 var(--mono); min-height: 44px; padding: 4px 8px; border: 1.5px solid transparent; background: transparent; color: var(--ink); border-radius: 6px; cursor: pointer; }
      @media (hover: hover) { .${P}tl:not(.right):not(.wrong):not(:disabled):hover { border-color: var(--ink); } }
      .${P}tl.right { border-color: var(--good); background: var(--good-soft); }
      .${P}tl.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}tl:disabled { cursor: default; }
      .${P}t { border-collapse: collapse; width: 100%; margin-top: 14px; font: 500 14px var(--font); }
      .${P}t th { text-align: left; font: 600 12px var(--font); color: var(--muted); padding: 4px 6px 6px; border-bottom: 2px solid var(--ink); }
      .${P}t td { padding: 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}t code { font-size: 13px; }
      .${P}sales { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin-top: 12px; font: 500 13px var(--mono); }
      .${P}sl { font: 600 12px var(--font); color: var(--muted); margin-right: 2px; }
      .${P}si { padding: 2px 6px; border: 1.5px solid var(--line); border-radius: 4px; }
      .${P}si.cur { border: 2.5px solid var(--ink); font-weight: 700; }
    `;
    document.head.appendChild(s);
  }

  /* A screen of snippets to predict. Each: code, options (HTML-safe text), the right option, what to say. */
  function snippetScreen(title, lead, task, SN) {
    return function ({ el, done, kit }) {
      css();
      const ans = SN.map(() => null), first = SN.map(() => null);
      const right = s => s.opts.indexOf(s.right);
      const paint = () => {
        const all = SN.every((s, i) => ans[i] === right(s));
        const nFirst = first.filter(Boolean).length;
        el.innerHTML = `<h1>${title}</h1>${lead}
          <p class="task">${task}</p>
          ${SN.map((s, i) => {
            const r = right(s), ok = ans[i] === r;
            return `<div class="lcase" id="c${i}"><p><b>Snippet ${s.n}.</b> ${s.q}</p>${kit.code(s.code.split("\n"))}
              ${kit.options(s.opts.map(kit.esc), { picked: ans[i], correct: r })}
              ${ans[i] == null ? "" : kit.feedback(`${ok ? s.yes : s.no[ans[i]]}${outBlock(kit.esc(PY[s.id]), "Python printed")}${s.js ? jsBlock(s.jsq, kit.esc(JS[s.js])) : ""}`, ok)}</div>`;
          }).join("")}
          ${all ? `<p class="${P}score">You predicted ${nFirst} of ${SN.length} right on the first try.</p>${kit.feedback(SN.summary(SN))}` : ""}`;
        el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
          ans[i] = +b.dataset.i;
          if (first[i] == null) first[i] = ans[i] === right(SN[i]);
          paint();
          if (SN.every((s, j) => ans[j] === right(s))) done();
        }));
      };
      paint();
    };
  }

  /* 1. The situation, and the first four snippets: numbers and text. */
  const JS_SCRIPT = [
    "function totalByStall(sales) {",
    "  const totals = {};",
    "  for (const sale of sales) {",
    "    totals[sale.stall] =",
    "      (totals[sale.stall] || 0)",
    "      + sale.cents;",
    "  }",
    "  return totals;",
    "}"
  ];
  const SN1 = [
    { n: 1, id: "true-div", js: "true-div", jsq: "In JavaScript, <code>7 / 2</code>", q: "Two whole numbers, one slash.", code: "print(7 / 2)",
      opts: ["3", "3.5", "3.0"], right: "3.5",
      yes: "Right, the same as JavaScript. In Python <code>/</code> always gives a float (a number with a fraction), even for two whole numbers.",
      no: { 0: "That is whole-number division, which Python writes with two slashes, <code>//</code>. One slash keeps the half.", 2: "It is a float, but the half is kept: 7 / 2 is 3.5." } },
    { n: 2, id: "floor-div", js: "floor-div", jsq: "In JavaScript, <code>Math.trunc(-7 / 2)</code>", q: "Whole-number division of a negative number, for example a refund.", code: "print(-7 // 2)",
      opts: ["-3", "-4", "-3.5"], right: "-4",
      yes: "Right. <code>//</code> rounds <b>down</b>, toward minus infinity: −3.5 goes down to −4. The usual JavaScript way, <code>Math.trunc(-7 / 2)</code>, cuts toward zero and gives −3. For positive numbers the two agree, so the difference hides until a number goes negative. If your habit is <code>Math.floor(-7 / 2)</code>, that gives <code>" + JS["floor-div-floor"] + "</code> in JavaScript, the same as <code>//</code>.",
      no: { 0: "That is cutting toward zero, what JavaScript's <code>Math.trunc(-7 / 2)</code> does. <code>//</code> rounds down: below −3.5 the next whole number is −4.", 2: "−3.5 is what one slash gives. <code>//</code> always gives a whole number." } },
    { n: 3, id: "str-plus-int", js: "str-plus-int", jsq: "In JavaScript, <code>\"Stall \" + 4</code>", q: "A label for stall number 4.", code: "print(\"Stall \" + 4)",
      opts: ["Stall 4", "An error", "Stall 4.0"], right: "An error",
      yes: `Right: a <code>${errName(PY["str-plus-int"])}</code>. Python never turns a number into text, or text into a number, to make <code>+</code> work. You convert it yourself: <code>"Stall " + str(4)</code>.`,
      no: { 0: "That is what JavaScript does: it turns the 4 into text. Python refuses and raises an error instead.", 2: "Python does not convert the 4 at all, to text or to a float. It stops with an error." } },
    { n: 4, id: "round-half", js: "round-half", jsq: "In JavaScript, <code>Math.round(2.5)</code>", q: "Rounding a value exactly halfway, such as half a cent.", code: "print(round(2.5))",
      opts: ["3", "2", "2.5"], right: "2",
      yes: "Right. When a value is exactly halfway, Python's <code>round</code> goes to the <b>even</b> neighbour: 2.5 gives 2, 1.5 gives 2. JavaScript's <code>Math.round</code> always goes up on a tie. So a ported script that rounds half-cents can give different totals.",
      no: { 0: "That is JavaScript's <code>Math.round</code>, which always goes up on a tie. Python's <code>round</code> sends a tie to the even neighbour, and 2 is even.", 2: "<code>round</code> with one argument gives a whole number. The question is which one, 2 or 3." } }
  ];
  SN1.summary = () => "Snippet 1 matched JavaScript; snippets 2, 3 and 4 did not. The pattern: Python's operators do not guess. They do not mix types, and each rule (round down, ties to even) is fixed, not what JavaScript would do.";
  const situationLead = kit => `<p class="lead">A Saturday farmers' market keeps its takings in cents, one line per sale. You wrote this JavaScript to total each stall (the market and its numbers are made up for the lesson):</p>
    ${kit.code(JS_SCRIPT)}
    <p class="lead">The market's data team works in Python and asks you to port it. On this path, the data and model tools you will use are Python, so this is where you start writing it. Python looks like JavaScript with fewer brackets, and that is the trap: some lines that look the same do something else. Before you port, check your instincts on eight short Python snippets.</p>`;
  const screen1 = function (ctx) {
    return snippetScreen("Porting the market's script", situationLead(ctx.kit),
      "Predict what each snippet prints. Then you see what Python really printed when we ran it. Pick again if you were wrong.", SN1)(ctx);
  };

  /* 2. Four more snippets: collections and functions. */
  const SN2 = [
    { n: 5, id: "empty-list", js: "empty-list", jsq: "The same check in JavaScript, on an empty array,", q: "A stall with no notes.", code: null,
      opts: ["has notes", "no notes"], right: "no notes",
      yes: "Right. In Python an empty list counts as false, and so do an empty dict, an empty string, 0 and <code>None</code>. In JavaScript an empty array counts as true, so <code>if (notes)</code> would take the first branch.",
      no: { 0: "That is JavaScript, where an empty array counts as true. In Python an empty list, dict or string counts as false." } },
    { n: 6, id: "missing-key", js: "missing-key", jsq: "In JavaScript, <code>takings[\"Bread\"]</code>", q: "Reading a stall that is not in the dict.", code: null,
      opts: ["None", "An error", "undefined"], right: "An error",
      yes: `Right: <code>${kit_esc(PY["missing-key"])}</code>. In Python a missing key is an error, not a quiet <code>undefined</code>. When a missing key is normal, ask with <code>takings.get("Bread")</code>, which gives <code>None</code>, or <code>takings.get("Bread", 0)</code>, which gives 0.`,
      no: { 0: "<code>None</code> is what <code>takings.get(\"Bread\")</code> gives. Square brackets on a missing key raise an error instead.", 2: "Python has no <code>undefined</code>. Square brackets on a missing key raise an error." } },
    { n: 7, id: "alias", js: "alias", jsq: "The same steps in JavaScript, with <code>push</code>,", q: "A second name for the list of stalls.", code: null,
      opts: ["['Honey', 'Bread']", "['Honey', 'Bread', 'Eggs']"], right: "['Honey', 'Bread', 'Eggs']",
      yes: "Right, the same as JavaScript. <code>open_today = stalls</code> copies nothing: both names point at one list, so a change through one name shows through the other.",
      no: { 0: "<code>=</code> does not copy the list. <code>open_today</code> and <code>stalls</code> are two names for the same list, so the append shows in both." } },
    { n: 8, id: "mutable-default", js: "mutable-default", jsq: "The same function in JavaScript, with <code>day = []</code>,", q: "A function with a default list, called twice.", code: null,
      opts: ["[700]", "[500, 700]", "[500]"], right: "[500, 700]",
      yes: "Right. The 500 from the first call is still in the list. JavaScript gives [700]. The next screen is about why.",
      no: { 0: "That is what JavaScript gives. Python printed [500, 700]: the first call's 500 is still there. The next screen is about why.", 2: "<code>add_sale(700)</code> appends 700 before it returns, so 700 is in the list. The question is whether the first call's 500 is too." } }
  ];
  SN2.summary = () => "Snippets 5, 6 and 8 behave differently from JavaScript; 7 behaves the same. Snippets 7 and 8 have one cause in common, and it is the most useful idea in this lesson.";
  const screen2 = snippetScreen("Lists, dicts and functions",
    `<p class="lead">Four more. In Python a list is written like a JavaScript array, and a <b>dict</b> is written like a JavaScript object: <code>{"Honey": 1200}</code>. A function starts with <code>def</code> and its body is indented, with no braces. <code>None</code> is Python's <code>null</code>.</p>`,
    "Predict what each snippet prints. Pick again if you were wrong.", SN2);

  function kit_esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* 3. Spot the idea: why did the second call return [500, 700]? */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Python remembers what a function returned last time and adds to it",
      "<code>day=[]</code> runs once, when <code>def</code> runs. Every call that leaves out <code>day</code> gets that same list, and <code>append</code> changes it in place",
      "<code>day</code> is a global variable, shared by the whole file",
      "<code>append</code> ran twice in the second call"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Where did the 500 come from?</h1>
        <p class="lead">Snippet 8 again. The first call added 500 and the second call added 700, yet the second call returned both.</p>
        ${kit.code(SRC["mutable-default"].split("\n"))}
        ${outBlock(kit.esc(PY["mutable-default"]), "Python printed")}
        <p class="task">What explains it?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Python builds the default value <b>once</b>, when the <code>def</code> line runs, and keeps that one list with the function. JavaScript builds a new <code>[]</code> on every call. The bigger idea underneath is the same in both languages: <b>a name is a label on an object</b>. <code>=</code> puts a second label on the same object, and so does passing an argument. Neither one copies it. Snippet 7 was the same thing: two labels, one list. The usual fix is <code>day=None</code>, then <code>if day is None: day = []</code> inside the function, so each call makes its own list.`, true)
          : ans === 0 ? kit.feedback("Python does not remember return values. The function returned <code>day</code>, and <code>day</code> was the same list both times: the first call's 500 was already in it.", false)
          : ans === 2 ? kit.feedback("<code>day</code> is a parameter, a local name. But the list it points to when you leave it out is made once and kept with the function, so it outlives each call.", false)
          : kit.feedback("Each call appends once. The 500 is not a second append of this call: it is left over from the first call, in the same list.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Use it: copies. Which name sees which change? */
  const COPIES = [
    { id: "copy-append", opts: ["1", "2"],
      yes: "Right. <code>backup</code> is a new list. Appending to the new list leaves <code>week</code> alone.",
      no: "<code>week[:]</code> builds a new list, so <code>backup</code> and <code>week</code> are two lists now. The append went into <code>backup</code> only." },
    { id: "copy-inner", opts: ["900", "0"],
      yes: "Right. The new list holds the <b>same dict</b> that <code>week</code> holds: two lists, one dict inside both. This is a <b>shallow copy</b>: it copies the list, not what is in it. Changing the dict through <code>backup</code> changes it for <code>week</code> too.",
      no: "The list is new, but its item is the same dict object that <code>week</code> holds. A shallow copy copies one level only, so the change to the dict shows through <code>week</code>." },
    { id: "copy-deep", opts: ["900", "0"],
      yes: "Right. <code>copy.deepcopy</code> copies the dict inside too, so <code>backup</code> has its own dict and <code>week</code> keeps 900.",
      no: "<code>deepcopy</code> copies everything inside, the dict included. Changing <code>backup</code>'s dict leaves <code>week</code>'s dict alone." }
  ];
  function copies({ el, done, kit }) {
    css();
    const ans = COPIES.map(() => null);
    const right = c => c.opts.indexOf(PY[c.id]);
    const paint = () => {
      const all = COPIES.every((c, i) => ans[i] === right(c));
      el.innerHTML = `<h1>A backup of the week's sales</h1>
        <p class="lead">Before a clean-up, the data team keeps a backup of the week's sales: a list of dicts. <code>week[:]</code> (a slice of the whole list, like JavaScript's <code>week.slice()</code>) builds a new list. With labels in mind, predict which changes reach the original.</p>
        <p class="task">Predict what each snippet prints.</p>
        ${COPIES.map((c, i) => `<div class="lcase" id="c${i}">${kit.code(SRC[c.id].split("\n"))}${kit.options(c.opts, { picked: ans[i], correct: right(c), num: true })}
          ${ans[i] == null ? "" : kit.feedback(`${ans[i] === right(c) ? c.yes : c.no}${outBlock(kit.esc(PY[c.id]), "Python printed")}`, ans[i] === right(c))}</div>`).join("")}
        ${all ? kit.feedback("The question to ask of any copy: which objects are new, and which are shared? A shallow copy is cheap and fine for a list of numbers or strings, because numbers and strings cannot be changed in place. For a list of dicts that you will change, use <code>copy.deepcopy</code>, or build new dicts.") : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (COPIES.every((x, j) => ans[j] === right(x))) done();
      }));
    };
    paint();
  }

  /* 5. Port it, line by line. */
  const PORT = [
    { js: "for (const sale of sales) {", opts: ["for sale of sales:", "for sale in sales:", "for sale in range(len(sales)):"], right: 1,
      yes: "Right. Python's loop over the items is <code>for … in …:</code>, with a colon and an indented body.",
      no: { 0: `Python has no <code>of</code>. That line does not even start: <code>${kit_esc(PY["port-for-of"])}</code>.`,
            2: `That runs, but <code>sale</code> is the position, not the sale: our run printed ${PY["port-range"].split("\n").join(" and ")}. <code>range(len(…))</code> counts positions, like a JavaScript <code>for (let i = 0; …)</code> loop.` } },
    { js: "sale.stall", opts: ["sale.stall", "sale[\"stall\"]"], right: 1,
      yes: "Right. A dict's values are read with square brackets and the key as a string. The dot is for methods, such as <code>.get</code>, and for attributes (what JavaScript calls properties) of other kinds of objects.",
      no: { 0: `That stops with <code>${kit_esc(PY["port-dot"])}</code>. A dict is not a JavaScript object: its keys are read with square brackets.` } },
    { js: "(totals[sale.stall] || 0) + sale.cents", opts: ["(totals[stall] or 0) + sale[\"cents\"]", "totals.get(stall, 0) + sale[\"cents\"]"], right: 1,
      yes: `Right. <code>.get(stall, 0)</code> gives 0 when the stall has no total yet. Our run of that line on an empty dict gave <code>${kit_esc(PY["port-get"])}</code>.`,
      no: { 0: `The first Honey sale stops with <code>${kit_esc(PY["port-or"])}</code>. In JavaScript a missing key gives <code>undefined</code> and <code>||</code> turns it into 0. In Python the square brackets fail before <code>or</code> ever runs (snippet 6).` } }
  ];
  const PY_PORT = [
    "def total_by_stall(sales):",
    "    totals = {}",
    "    for sale in sales:",
    "        stall = sale[\"stall\"]",
    "        totals[stall] = totals.get(stall, 0) + sale[\"cents\"]",
    "    return totals"
  ];
  function port({ el, done, kit }) {
    css();
    const ans = PORT.map(() => null);
    const paint = () => {
      const all = PORT.every((p, i) => ans[i] === p.right);
      el.innerHTML = `<h1>Port it, line by line</h1>
        <p class="lead">Now the real port. Three lines of the JavaScript need a choice. In Python, <code>sales</code> is a list of dicts such as <code>{"stall": "Honey", "cents": 1200}</code>.</p>
        <p class="task">For each JavaScript piece, pick the Python that does the same job.</p>
        ${PORT.map((p, i) => `<div class="lcase" id="c${i}"><p>JavaScript: <code>${kit.esc(p.js)}</code></p>${kit.options(p.opts.map(o => `<code>${kit.esc(o)}</code>`), { picked: ans[i], correct: p.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === p.right ? p.yes : p.no[ans[i]], ans[i] === p.right)}</div>`).join("")}
        ${all ? `${kit.feedback("The port. No braces and no semicolons: the indentation is the block, and it is not optional. The next screen runs it.")}${kit.code(PY_PORT)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PORT.every((p, j) => ans[j] === p.right)) done();
      }));
    };
    paint();
  }

  /* 6. The port, stepped: a replay of the traced run in market.out.txt. */
  // a frame = one listing line that has just run, with the state right after it
  const FRAMES = TRACE.slice(0, -1).map((s, i) => ({ ...TRACE[i + 1], ln: s.line }));
  const GATE = FRAMES.findIndex((f, i) => f.ln === 4 && i > 0 && FRAMES[i - 1].totals && f.stall in FRAMES[i - 1].totals);
  function stepped({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const g = FRAMES[GATE], before = FRAMES[GATE - 1];
    const had = before.totals[g.stall], add = SALES[g.sale][1];
    const popts = [String(add), String(had + add), "KeyError: 'Honey'"];
    const pright = 1;
    const SAY = f => {
      if (f.ln === 1) return "<code>totals</code> starts as an empty dict.";
      if (f.ln === 2 && FRAMES.indexOf(f) === FRAMES.length - 2) return "No sales left: the loop ends. <code>sale</code> and <code>stall</code> still hold the last values.";
      if (f.ln === 2) return `The loop takes the next sale: <code>sale</code> is the ${SALES[f.sale][0]} sale of ${SALES[f.sale][1]} cents.`;
      if (f.ln === 3) return `<code>stall</code> = "${f.stall}".`;
      if (f.ln === 4) {
        const prev = FRAMES[FRAMES.indexOf(f) - 1].totals[f.stall];
        return prev == null
          ? `No total for ${f.stall} yet, so <code>.get</code> gives 0: 0 + ${SALES[f.sale][1]} = ${f.totals[f.stall]}. A new key is added.`
          : `${f.stall} already has ${prev}: ${prev} + ${SALES[f.sale][1]} = ${f.totals[f.stall]}.`;
      }
      return `Return <code>totals</code>. The same totals as the JavaScript script gave on the same five sales: <code>${kit.esc(JS.market)}</code>.`;
    };
    const paint = () => {
      const f = FRAMES[i], gate = i === GATE - 1 && pred !== pright, last = i === FRAMES.length - 1;
      const rows = f.totals ? Object.entries(f.totals) : [];
      el.innerHTML = `<h1>The port, step by step</h1>
        <p class="lead">This replays a real run of the port on five sales, line by line. A dict keeps its keys in the order they were first added, as you will see.</p>
        <div class="${P}sales"><span class="${P}sl">sales (cents)</span>${SALES.map(([s, c], j) => `<span class="${P}si${f.sale === j ? " cur" : ""}">${s} ${c}</span>`).join("")}</div>
        <p class="task">Step through to the end. When ${g.stall} comes back, predict its total.</p>
        ${kit.code(PY_PORT, f.ln)}
        ${kit.table(rows, { head: ["key (stall)", "value (cents)"], title: "totals", fresh: f.ln === 4 ? rows.findIndex(([k]) => k === f.stall) : -1, empty: f.totals ? "empty dict" : "not made yet" })}
        <div class="vars"><span>stall <b>${f.stall ?? "–"}</b></span><span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(SAY(f))}
        ${i === GATE - 1 ? `<div id="pred"><p class="task">The totals line runs next. The sale is ${add} cents. What is <code>totals["${g.stall}"]</code> after it?</p>${kit.options(popts.map(kit.esc), { picked: pred, correct: pright, num: true })}
          ${pred == null ? "" : pred === pright ? kit.feedback(`Right: <code>.get</code> finds ${had}, and ${had} + ${add} = ${had + add}. The key stays where it was in the dict.`, true)
            : pred === 0 ? kit.feedback(`That would throw away the ${had} already there. The totals line, <code>totals[stall] = totals.get(stall, 0) + …</code>, reads the old total with <code>.get</code> and adds to it.`, false)
            : kit.feedback(`${g.stall} is already in <code>totals</code>, and <code>.get</code> never raises KeyError anyway: it would give the default 0.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || gate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 7. Comprehensions: map, filter and reduce in one line. */
  const ST = Object.keys(TOTALS);
  const COMPS = [
    { id: "comp-euros", right: 0, lead: "Like JavaScript's <code>map</code>, into a dict: cents to euros.",
      opts: [PY["comp-euros"], `{${ST.map(s => `'${s}': ${Math.floor(TOTALS[s] / 100)}`).join(", ")}}`, `[${ST.map(s => TOTALS[s] / 100).join(", ")}]`],
      no: { 1: `One slash keeps the fraction (snippet 1): ${TOTALS[ST[0]]} / 100 is ${TOTALS[ST[0]] / 100}. Whole euros would need <code>//</code>.`,
            2: "Curly braces with <code>key: value</code> build a dict, not a list. The stall names stay as keys." } },
    { id: "comp-filter", right: 1, lead: "Like <code>filter</code> then <code>map</code>: the stalls that took at least 2000 cents.",
      opts: [`[${ST.filter(s => TOTALS[s] >= 4000).map(s => `'${s}'`).join(", ")}]`, PY["comp-filter"], `[${ST.filter(s => TOTALS[s] >= 2000).map(s => TOTALS[s]).join(", ")}]`],
      no: { 0: `${ST[0]} took ${TOTALS[ST[0]]} cents, and ${TOTALS[ST[0]]} ≥ 2000, so it passes the <code>if</code>.`,
            2: "What goes into the list is the expression before <code>for</code>: <code>stall</code>, the name, not the cents." } },
    { id: "comp-sum", right: 2, lead: "Like <code>reduce</code> with +: the day's total.",
      opts: [euro(ST.reduce((a, s) => a + TOTALS[s], 0)), "An error", PY["comp-sum"]],
      no: { 0: "Nothing divides by 100 here. The values are cents, and <code>sum</code> adds them as they are.",
            1: "<code>totals.values()</code> gives just the numbers, and <code>sum</code> adds any collection of numbers." } }
  ];
  function comps({ el, done, kit }) {
    css();
    const ans = COMPS.map(() => null);
    const paint = () => {
      const all = COMPS.every((c, i) => ans[i] === c.right);
      el.innerHTML = `<h1>Comprehensions: map and filter in one line</h1>
        <p class="lead">The data team wants the totals in euros, and the big stalls. In Python that is a <b>comprehension</b>: <code>[expression for item in items if condition]</code> builds a new list, and with <code>{key: value for …}</code> a new dict. <code>.items()</code> gives the dict's (key, value) pairs. <code>totals</code> is the port's result: <code>${kit.esc(JSON.stringify(TOTALS).replace(/"/g, "'").replace(/:/g, ": ").replace(/,/g, ", "))}</code>.</p>
        <p class="task">Predict what each line prints.</p>
        ${COMPS.map((c, i) => `<div class="lcase" id="c${i}"><p>${c.lead}</p>${kit.code([SRC[c.id].split("\n").pop()])}
          ${kit.options(c.opts.map(o => `<code>${kit.esc(o)}</code>`), { picked: ans[i], correct: c.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === c.right ? `Right.${outBlock(kit.esc(PY[c.id]), "Python printed")}` : c.no[ans[i]], ans[i] === c.right)}</div>`).join("")}
        ${all ? kit.feedback("A comprehension builds a <b>new</b> list or dict; <code>totals</code> is not changed. Keep money in whole cents while you add, and turn it into euros only to show it: floats cannot hold most decimal fractions exactly.") : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (COMPS.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 8. Broken on purpose: the CSV export crashes the port. */
  const TB_RIGHT = 6;
  const TB_OK = [TB_RIGHT - 1, TB_RIGHT, TB_RIGHT + 1];   // the frame's File line, the code line, the marks under it
  const CAUSES = [
    "<code>totals.get(stall, 0)</code> gave <code>None</code> for a new stall",
    "<code>sale[\"cents\"]</code> is text: the CSV reader gives every value as a string, and Python will not add a number and a string",
    "The rows have no <code>\"cents\"</code> key"
  ];
  const FIXES = [
    "Convert where the file is read: <code>int(row[\"cents\"])</code>",
    "Make both sides text: <code>str(totals.get(stall, 0)) + sale[\"cents\"]</code>",
    "Convert where the file is read: <code>float(row[\"cents\"])</code>"
  ];
  function broken({ el, done, kit }) {
    css();
    let line = null, cause = null, fix = null;
    const lineSay = i => {
      if (TB_OK.includes(i)) return ["Right. Python prints the most recent call <b>last</b>, so the bottom frame is where it failed: line 15, inside <code>total_by_stall</code>, the line that adds. The marks under it point at the <code>+</code>.", true];
      if (i === 2 || i === 3 || i === 4) return ["That is where the call started, in the outer frame. Python lists the calls oldest first: read from the bottom up.", false];
      if (i === TB.length - 1) return ["That line says <b>what</b> went wrong. The task is <b>where</b>: which line of the code raised it? Look just above.", false];
      if (i === 0) return ["That is the script's own <code>print(sales[0])</code>, before the crash. It is a clue for the next question, not the failing line.", false];
      return ["That is a header line of the traceback. Find the line of code that ran last.", false];
    };
    const paint = () => {
      const okL = TB_OK.includes(line), okC = cause === 1, okF = fix === 0, ls = line == null ? null : lineSay(line);
      el.innerHTML = `<h1>Broken on purpose: the CSV export</h1>
        <p class="lead">The port works on the list you typed. Then the data team feeds it the market's CSV export, read with Python's <code>csv.DictReader</code>, and it crashes. The file:</p>
        ${outBlock(kit.esc(CSV.join("\n")), "takings.csv")}
        <p class="lead">The script prints the first row, then calls <code>total_by_stall</code>. Below is the real output of that run (only the folder path is cut, marked …). After the printed row comes Python's error report, the <b>traceback</b>. It has one <b>frame</b> per function call that was running: a <code>File …, line …</code> line, then the code on that line.</p>
        <p class="task">Tap the line of code that raised the error.</p>
        <div class="${P}tbwrap"><div class="${P}tb">${TB.map((t, i) => `<button type="button" class="${P}tl ${line === i ? (okL ? "right" : "wrong") : ""}" data-l="${i}" ${okL ? "disabled" : ""}>${kit.esc(t)}</button>`).join("")}</div></div>
        <div class="lpanel">${ls ? kit.feedback(ls[0], ls[1]) : ""}
        ${okL ? `<div id="cause"><p class="task">The message says <code>'int' and 'str'</code>. What is the cause?</p>${kit.options(CAUSES, { picked: cause, correct: 1 })}
          ${cause == null ? "" : okC ? kit.feedback("Right. The first printed row shows it: <code>'cents': '1200'</code>, in quotes. A CSV file is text, and the reader does not convert anything. The <code>'int'</code> in the message is the 0 from <code>.get</code>; the <code>'str'</code> is the cents.", true)
            : cause === 0 ? kit.feedback("<code>.get(stall, 0)</code> gives the default 0, a number: that is the <code>'int'</code> in the message. With <code>None</code> the message would name <code>'NoneType'</code>.", false)
            : kit.feedback("The first printed row has a <code>'cents'</code> key. A missing key would raise <code>KeyError</code>, not <code>TypeError</code>.", false)}</div>` : ""}
        ${okC ? `<div id="fix"><p class="task">Which fix?</p>${kit.options(FIXES, { picked: fix, correct: 0 })}
          ${fix == null ? "" : okF ? kit.feedback(`Right. Convert at the edge, where the data comes in, and the rest of the code can trust that cents are numbers. With the fix, the same file gave:${outBlock(kit.esc(FIXED), "Python printed")}The JavaScript script, run on the same file, did not crash. It joined the strings and gave:${outBlock(kit.esc(JS["csv-plus"]), "node printed")}Python's crash was the better outcome: it stopped at the bad line instead of handing the data team wrong totals.`, true)
            : fix === 1 ? kit.feedback("The error goes away, but now <code>+</code> joins text instead of adding numbers: the same silent bug the JavaScript version has. The totals would be strings of digits, not sums.", false)
            : kit.feedback("That runs, but cents are whole numbers. A float brings back the rounding trouble whole cents avoid. Use <code>int</code>.", false)}</div>` : ""}</div>`;
      el.querySelectorAll(`button.${P}tl`).forEach(b => b.onclick = () => { line = +b.dataset.l; paint(); });
      el.querySelectorAll("#cause .lopts button").forEach(b => b.onclick = () => { cause = +b.dataset.i; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 9. The big picture, with a task. */
  const BIG = [
    ["Train a small model on two years of the market's sales, using the numeric and machine-learning libraries the data team already uses.", 0,
      "Right. The numeric and machine-learning tools (NumPy and the libraries built on it) are Python libraries. This is where Python earns its place."],
    ["Add a chat box to the market's existing TypeScript website that sends questions to a hosted model's API.", 1,
      "Right. Model providers such as Anthropic publish an official TypeScript SDK next to the Python one. A second language here only adds a second toolchain to maintain."],
    ["A Python script loops over ten million sensor readings one by one, and takes minutes.", 2,
      "Right. A plain Python loop pays for every step it interprets. NumPy runs the whole array operation in compiled code: <code>c = a * b</code> instead of a loop."]
  ];
  const BIG_OPTS = ["Python", "Stay in TypeScript", "Python, but hand the loop to NumPy"];
  const BIG_WRONG = [
    ["", "The training libraries are Python libraries. Rewriting that in TypeScript means giving up the tools the whole field uses.", "There is no slow loop to replace yet. The point is which language: the libraries are in Python."],
    ["Calling a hosted API needs no Python: there is an official TypeScript SDK. Adding Python means a second language, environment and deploy for one feature.", "", "Nothing here loops over big data. It is one API call per question."],
    ["It is already Python, and Python is the problem: each step of a plain loop is interpreted one at a time.", "Rewriting in TypeScript moves the team away from the data tools. The usual fix stays in Python: NumPy does the loop in compiled code.", ""]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for Python</h1>
        <p class="lead"><b>What it is for:</b> on this path, Python is the language of the data and model tools: NumPy (fast maths on whole arrays of numbers), the training libraries, most notebooks and examples.</p>
        <p class="lead"><b>Reach for it</b> when the work touches those tools, or the team that owns the code works in it.</p>
        <p class="lead"><b>Not when</b> you only call a hosted model from an existing JavaScript or TypeScript app: providers ship TypeScript SDKs too.</p>
        <p class="lead"><b>Cost:</b> a second language and its traps (you met several); its own environments and packages (the next lesson); plain loops over big numeric data are slow, so that work goes to NumPy.</p>
        <p class="task">Pick the right move for each situation.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : BIG_WRONG[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it: is the bug a JavaScript-versus-Python difference? */
  const CASES = [
    [`A ported report sorts stall numbers <code>[10, 9, 1]</code>. The old JavaScript showed <code>${JS["sort-numbers"]}</code>; the Python version shows <code>${PY["sort-numbers"]}</code>. Someone files it as a bug in the port.`, true,
      "Yes, a real difference, and here Python is right. JavaScript's <code>sort()</code> with no compare function compares items as strings, so \"10\" comes before \"9\". Python's <code>sorted</code> compares the numbers.",
      "The two languages really differ here. JavaScript's <code>sort()</code> without a compare function sorts numbers as strings; Python's <code>sorted</code> compares them as numbers. The old report was the wrong one."],
    [`After the port, a total shows <code>${PY["float-sum"]}</code> where 0.3 was expected. A teammate blames Python.`, false,
      `No. The JavaScript version printed <code>${JS["float-sum"]}</code> too. Both languages store 0.1 and 0.2 as binary floats, which cannot hold them exactly. Porting did not cause it; keeping money in whole cents (or Python's <code>decimal</code> module) fixes it.`,
      `Run the same sum in JavaScript: it printed <code>${JS["float-sum"]}</code> as well. Binary floats cannot hold 0.1 exactly in either language, so blaming the port would send you to the wrong fix. Use whole cents or <code>decimal</code>.`],
    ["A ported check <code>if not stall_notes:</code> now skips every stall whose notes list is empty. The JavaScript <code>if (!stallNotes)</code> never skipped them.", true,
      "Yes. In JavaScript an empty array is truthy, so <code>!stallNotes</code> was false. In Python an empty list is false (snippet 5), so <code>not stall_notes</code> is true. If the check meant \"no list at all\", write <code>if stall_notes is None:</code>.",
      "This is snippet 5: an empty list is false in Python but truthy in JavaScript. The same-looking check now means something else."],
    ["The Python and the JavaScript versions both report no takings for the plum stall. Its sales sit in a second CSV file that neither script reads.", false,
      "No. Both versions agree, and both are wrong for the same reason: the data never reaches them. No language rule is involved; load the second file.",
      "Both versions give the same result, so no difference between the languages is at work. The plum sales are in a file neither script reads."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is it the port?</h1>
        <p class="lead">Four reports from other teams porting code. Ask: does the bug come from a rule that differs between JavaScript and Python?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes, a language difference", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next (browser practice follows). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Port with your eyes open</h1>
      <p class="lead">You can now read and write Python lists, dicts, loops, comprehensions and functions, and you know where JavaScript instincts mislead.</p>
      <table class="${P}t"><tbody>
        <tr><td><b>Operators</b></td><td>No mixing of types. <code>/</code> keeps the fraction, <code>//</code> rounds down, <code>round</code> sends ties to even.</td></tr>
        <tr><td><b>Truth</b></td><td>Empty list, dict and string are false. A missing key is an error; use <code>.get</code> when missing is normal.</td></tr>
        <tr><td><b>Names</b></td><td>A name is a label on an object. <code>=</code> never copies; a slice copies one level; a default value is built once.</td></tr>
        <tr><td><b>Edges</b></td><td>Convert outside data (CSV, forms) to the right type where it comes in.</td></tr>
      </tbody></table>
      <p class="lead">A short exercise in Python on this page follows the lesson: you port a second small JavaScript function, the average sale per stall, and fix a function whose default list leaks between calls.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Your port runs on your laptop; that lesson makes it run the same way on someone else's machine.</p>` : ""}`;
    done();
  }

  // The Python source of each snippet, exactly as in snippets.py
  const SRC = {
    "empty-list": "notes = []\nif notes:\n    print(\"has notes\")\nelse:\n    print(\"no notes\")",
    "missing-key": "takings = {\"Honey\": 1200}\nprint(takings[\"Bread\"])",
    "alias": "stalls = [\"Honey\", \"Bread\"]\nopen_today = stalls\nopen_today.append(\"Eggs\")\nprint(stalls)",
    "mutable-default": "def add_sale(cents, day=[]):\n    day.append(cents)\n    return day\n\nadd_sale(500)\nprint(add_sale(700))",
    "copy-append": "week = [{\"stall\": \"Honey\", \"cents\": 900}]\nbackup = week[:]\nbackup.append({\"stall\": \"Eggs\", \"cents\": 300})\nprint(len(week))",
    "copy-inner": "week = [{\"stall\": \"Honey\", \"cents\": 900}]\nbackup = week[:]\nbackup[0][\"cents\"] = 0\nprint(week[0][\"cents\"])",
    "copy-deep": "import copy\nweek = [{\"stall\": \"Honey\", \"cents\": 900}]\nbackup = copy.deepcopy(week)\nbackup[0][\"cents\"] = 0\nprint(week[0][\"cents\"])",
    "comp-euros": "totals = {\"Honey\": 2150, \"Bread\": 4000, \"Eggs\": 975}\nprint({stall: cents / 100 for stall, cents in totals.items()})",
    "comp-filter": "totals = {\"Honey\": 2150, \"Bread\": 4000, \"Eggs\": 975}\nprint([stall for stall, cents in totals.items() if cents >= 2000])",
    "comp-sum": "totals = {\"Honey\": 2150, \"Bread\": 4000, \"Eggs\": 975}\nprint(sum(totals.values()))"
  };
  SN2.forEach(s => { s.code = SRC[s.id]; });

  LessonKit.define("s1-py-from-js", {
    title: "Python for a JavaScript developer",
    checked: "2026-11-13",
    sources: [
      "https://docs.python.org/3/reference/expressions.html#binary-arithmetic-operations",
      "https://docs.python.org/3/library/functions.html#round",
      "https://docs.python.org/3/library/stdtypes.html#truth-value-testing",
      "https://docs.python.org/3/library/stdtypes.html#mapping-types-dict",
      "https://docs.python.org/3/tutorial/controlflow.html#default-argument-values",
      "https://docs.python.org/3/library/copy.html",
      "https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions",
      "https://docs.python.org/3/library/csv.html",
      "https://docs.python.org/3/tutorial/floatingpoint.html",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round",
      "https://developer.mozilla.org/en-US/docs/Glossary/Truthy",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort",
      "https://numpy.org/doc/stable/user/whatisnumpy.html",
      "https://platform.claude.com/docs/en/cli-sdks-libraries/overview"
    ],
    interview: [{
      q: "A Python service you inherited sometimes returns items from an earlier request mixed into a new response. Restarting the service makes it go away for a while. Where do you look?",
      good: [
        "Suspect state that outlives a call: a mutable default argument such as items=[], or a module-level list or dict",
        "Explain that a default value is built once, when def runs, and every call that leaves the argument out shares it",
        "Fix with a None default and a new list inside the function, or pass the list in explicitly",
        "Write a test that calls the function twice and checks the second result has nothing from the first"
      ],
      weak: "Restart the service on a schedule or add a cache flush. That hides the symptom and never finds the shared object."
    }, {
      q: "You are porting a Node data script to Python for a data team. How do you make sure the port behaves the same?",
      good: [
        "Run both versions on the same inputs, including edge cases: empty lists, missing keys, negative numbers, values exactly halfway",
        "Know the rules that differ: // rounds down, round sends ties to even, empty containers are false, a missing key raises, no type coercion",
        "Convert outside data to the right types where it comes in; a CSV gives strings",
        "Keep money in whole cents or Decimal in both versions, so float rounding is not mistaken for a porting bug"
      ],
      weak: "Translate the syntax line by line and check that it runs. Code that runs can still round, compare or copy differently."
    }],
    screens: [screen1, screen2, spotIdea, copies, port, stepped, comps, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: SN1.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: SN2.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: COPIES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: PORT.map((_, i) => `#c${i} [data-right]`) },
      { wrong: [...Array(GATE - 1).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FRAMES.length - GATE).fill("[data-next]")] },
      { wrong: ["#c1 [data-wrong]"], right: COMPS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ['[data-l="3"]'], right: [`[data-l="${TB_RIGHT}"]`, "#cause [data-right]", "#fix [data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
