/* Lesson: type hints, dataclasses and Pydantic. Story: a weather-station network where vendor A sends temperatures
   as strings ("21.5", "N/A") and vendor B as numbers (19.0). Ideas: (1) type hints are checked by a separate tool
   (mypy) by reading the code before it runs, so they catch mix-ups between your own functions but never see data
   that arrives while the program runs; (2) at the border where outside data comes in, validate it at run time with
   a Pydantic model (lax conversion, strict mode, ranges, a before-validator), and keep plain hints and dataclasses
   inside. Broken on purpose: a dataclass filled straight from vendor JSON crashes far away, in mean_temp, while mypy
   says "Success". No model calls were recorded for this lesson.
   Runs (docs/ai-path/runs/s1-py-types/, Python 3.12, mypy 2.4.1, Pydantic 2.14.3, see env.txt):
   calls.py → mypy_calls.out.txt (mypy on six calls) and calls_run.py → calls_run.out.txt (the same calls run);
   broken.py → broken.out.txt and mypy_broken.out.txt; fixed.py → fixed.out.txt and mypy_fixed.out.txt;
   reveal.py → mypy_reveal.out.txt (json.loads is Any to mypy); kwarg.py → mypy_kwarg.out.txt (a renamed keyword
   argument); pyd.py → pyd.out.txt (four payloads, then the
   strict, range and before-validator models). Every count on screen is computed here from that data. */
(() => {
  const ID = "s1-py-types", P = "lx-" + ID + "-";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const lower = n => (WORDS[n] || String(n)).toLowerCase();
  const runCap = "Output of a run on our machine (Python 3.12)";

  /* ---------- Run output (copied from docs/ai-path/runs/s1-py-types/*.out.txt, not altered) ---------- */
  // calls.py: the function and the six calls. Lines 8 to 13 of the file are calls 1 to 6.
  const FN = [
    "def parse_temp(raw: str | float) -> float | None:",
    "    if raw == \"N/A\":",
    "        return None",
    "    return float(raw)"
  ];
  const CALL_LINE0 = 8;
  const CALLS = [
    ['parse_temp("21.5")', "vendor A sends text"],
    ["parse_temp(21)", "a whole number, an int"],
    ["parse_temp(None)", "an empty field"],
    ['parse_temp("hot")', "a word, not a number"],
    ['parse_temp("N/A") + 1', "use the result in a sum"],
    ['parse_temp({"temp": 21.5})', "the whole payload by mistake"]
  ];
  // mypy_calls.out.txt, all of it
  const MYPY_CALLS = [
    'calls.py:10: error: Argument 1 to "parse_temp" has incompatible type "None"; expected "str | float"  [arg-type]',
    'calls.py:12: error: Unsupported operand types for + ("None" and "int")  [operator]',
    'calls.py:12: note: Left operand is of type "float | None"',
    'calls.py:13: error: Argument 1 to "parse_temp" has incompatible type "dict[str, float]"; expected "str | float"  [arg-type]',
    "Found 3 errors in 1 file (checked 1 source file)"
  ];
  // calls_run.out.txt, all of it: what Python itself did with each call
  const RUN_CALLS = [
    "call 1 -> 21.5",
    "call 2 -> 21.0",
    "call 3 -> TypeError: float() argument must be a string or a real number, not 'NoneType'",
    "call 4 -> ValueError: could not convert string to float: 'hot'",
    "call 5 -> TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'",
    "call 6 -> TypeError: float() argument must be a string or a real number, not 'dict'"
  ];
  // derived: the mypy lines for each call, and whether mypy flagged it (an "error" line)
  const MYPY_BY_CALL = CALLS.map((_, i) => MYPY_CALLS.filter(l => l.startsWith(`calls.py:${CALL_LINE0 + i}:`)));
  const FLAGGED = MYPY_BY_CALL.map(ls => ls.some(l => / error: /.test(l)));
  const RUN_BY_CALL = CALLS.map((_, i) => RUN_CALLS.find(l => l.startsWith(`call ${i + 1} -> `)).slice(`call ${i + 1} -> `.length));
  const HOT = CALLS.findIndex((c, i) => !FLAGGED[i] && /Error/.test(RUN_BY_CALL[i]));
  const NONE_CALL = CALLS.findIndex(([c]) => c === "parse_temp(None)");
  const SUM_CALL = MYPY_BY_CALL.findIndex(ls => ls.some(l => /\[operator\]$/.test(l)));
  const ARG_CALLS = MYPY_BY_CALL.map((ls, i) => ls.some(l => /\[arg-type\]$/.test(l)) ? i + 1 : 0).filter(Boolean);

  // broken.py lines 3 to 16 (the listing on screens 4 and 7; numbers are the file's line numbers)
  const BROKEN = [
    [3, "import json"], [4, "from dataclasses import dataclass"], [5, ""],
    [6, "@dataclass"], [7, "class Reading:"], [8, "    station: str"], [9, "    temp_c: float"], [10, ""],
    [11, "def load(body: str) -> Reading:"], [12, "    payload = json.loads(body)"], [13, "    return Reading(**payload)"], [14, ""],
    [15, "def mean_temp(readings: list[Reading]) -> float:"], [16, "    return sum(r.temp_c for r in readings) / len(readings)"]
  ];
  const BODIES = ['{"station": "B2", "temp_c": 19.0}', '{"station": "B5", "temp_c": 18.5}', '{"station": "A7", "temp_c": "21.5"}'];
  // broken.out.txt (the two "File" paths and the two ^^^ marker lines trimmed with …)
  const BROKEN_PRINT = "[Reading(station='B2', temp_c=19.0), Reading(station='B5', temp_c=18.5), Reading(station='A7', temp_c='21.5')]";
  const BROKEN_TB = [
    "Traceback (most recent call last):",
    '  File "…/broken.py", line 25, in <module>',
    "    print(mean_temp(readings))",
    "    …",
    '  File "…/broken.py", line 16, in mean_temp',
    "    return sum(r.temp_c for r in readings) / len(readings)",
    "    …",
    "TypeError: unsupported operand type(s) for +: 'float' and 'str'"
  ];
  const MYPY_BROKEN = "Success: no issues found in 1 source file";
  const MYPY_REVEAL = 'reveal.py:5: note: Revealed type is "Any"';
  // mypy_kwarg.out.txt, first line
  const MYPY_KWARG = 'kwarg.py:6: error: Unexpected keyword argument "temp" for "report"; did you mean "temp_c"?  [call-arg]';
  // derived line numbers: where the str enters, where it crashed, and the caller (from the traceback)
  const lineOf = t => BROKEN.find(([, s]) => s.includes(t))[0];
  const tbLine = fn => +BROKEN_TB.find(l => l.endsWith(`in ${fn}`)).match(/line (\d+)/)[1];
  const L_CAUSE = lineOf("return Reading(**payload)"), L_CRASH = tbLine("mean_temp"), L_CALLER = tbLine("<module>");
  // fixed.py: broken.py with Reading(BaseModel) and Reading.model_validate(payload); fixed.out.txt
  const FIXED_OUT = ["[Reading(station='B2', temp_c=19.0), Reading(station='B5', temp_c=18.5), Reading(station='A7', temp_c=21.5)]", "19.666666666666668"];
  const MYPY_FIXED = "Success: no issues found in 1 source file";

  // pyd.py section 1: four raw payloads through Reading(BaseModel). out: the repr, or the error (URL line cut with …)
  const PYD_MODEL = ["from pydantic import BaseModel", "", "class Reading(BaseModel):", "    station: str", "    temp_c: float", "", "Reading.model_validate_json(body)"];
  const PAY = [
    { body: '{"station": "A7", "temp_c": "21.5"}', ok: true, out: ["Reading(station='A7', temp_c=21.5)"] },
    { body: '{"station": "B2", "temp_c": 19}', ok: true, out: ["Reading(station='B2', temp_c=19.0)"] },
    { body: '{"station": "A9", "temp_c": "N/A"}', ok: false, out: ["1 validation error for Reading", "temp_c", "  Input should be a valid number, unable to parse string as a number [type=float_parsing, input_value='N/A', input_type=str]", "    …"] },
    { body: '{"station": "B5", "temp": 18.5}', ok: false, out: ["1 validation error for Reading", "temp_c", "  Field required [type=missing, input_value={'station': 'B5', 'temp': 18.5}, input_type=dict]", "    …"] }
  ];
  // pyd.py sections 2 to 4: one setting each
  const KNOBS = [
    { name: "strict=True", on: 1,
      code: ["class StrictReading(BaseModel):", "    model_config = ConfigDict(strict=True)", "    station: str", "    temp_c: float"],
      body: '{"station": "A7", "temp_c": "21.5"}', ok: false,
      out: ["1 validation error for StrictReading", "temp_c", "  Input should be a valid number [type=float_type, input_value='21.5', input_type=str]", "    …"],
      also: { body: '{"station": "B2", "temp_c": 19}', out: ["StrictReading(station='B2', temp_c=19.0)"] } },
    { name: "Field(ge=…, le=…)", on: 2,
      code: ["class RangedReading(BaseModel):", "    station: str", "    temp_c: float = Field(ge=-60, le=60)"],
      body: '{"station": "C4", "temp_c": 215}', ok: false,
      out: ["1 validation error for RangedReading", "temp_c", "  Input should be less than or equal to 60 [type=less_than_equal, input_value=215, input_type=int]", "    …"] },
    { name: 'mode="before"', on: 4,
      code: ["class MaybeReading(BaseModel):", "    station: str", "    temp_c: float | None", "", '    @field_validator("temp_c", mode="before")', "    @classmethod", "    def blank_to_none(cls, value):", '        return None if value == "N/A" else value'],
      body: '{"station": "A9", "temp_c": "N/A"}', ok: true,
      out: ["MaybeReading(station='A9', temp_c=None)"],
      also: { body: '{"station": "A9", "temp_c": "n/a"}', out: ["1 validation error for MaybeReading", "temp_c", "  Input should be a valid number, unable to parse string as a number [type=float_parsing, input_value='n/a', input_type=str]", "    …"] } }
  ];

  /* ---------- Small helpers and lesson-only style ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}wrap div { white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--mono); color: var(--muted); }
      .${P}call { margin: 12px 0 6px; font: 600 15.5px var(--mono); overflow-wrap: anywhere; }
      .${P}call small { display: block; font: 400 14.5px var(--font); color: var(--muted); }
      .${P}cost { margin: 10px 0 0; padding-left: 20px; font-size: 16.5px; }
      .${P}cost li { margin: 3px 0; }
      .${P}slot { display: inline-block; min-width: 4ch; padding: 0 4px; border-bottom: 2px solid var(--ink); font-weight: 700; }
      .${P}h { margin: 16px 0 4px; font-weight: 600; }
    `;
    document.head.appendChild(s);
  }
  // a listing of text; long lines wrap instead of scrolling sideways
  const block = (lines, cap) => `<pre class="lcode ${P}wrap">${lines.map(c => `<div>${LessonKit.esc(c) || " "}</div>`).join("")}</pre>${cap ? `<p class="${P}cap">${cap}</p>` : ""}`;
  const codeW = (lines, active) => LessonKit.code(lines, active).replace('class="lcode"', `class="lcode ${P}wrap"`);
  // yes/no style blocks: each case is { right: index }, ans[i] the pick
  function cases(el, list, ans, paint, done) {
    el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
      ans[i] = +b.dataset.i; paint();
      if (list.every((x, j) => ans[j] === x.right)) done();
    }));
  }

  /* 1. The situation, then annotate the parser by hand. */
  const SLOTS = [
    { what: "raw", opts: ["str", "float", "str | float"], right: 2,
      yes: "Right: <code>str | float</code> means “a str or a float”. It is TypeScript's <code>string | number</code>, written with Python's names.",
      no: ["Vendor B sends numbers such as 19.0. With <code>raw: str</code>, every call with vendor B's readings would be marked wrong, though <code>float(19.0)</code> works.",
           "Vendor A sends text: \"21.5\" and \"N/A\". With <code>raw: float</code>, every call with vendor A's readings would be marked wrong."] },
    { what: "the return value", opts: ["float", "float | None", "str | None"], right: 1,
      yes: "Right: <code>float | None</code>. The hint now tells every caller that the answer can be missing. Older code writes the same thing as <code>Optional[float]</code>.",
      no: ["Look at the second line: for \"N/A\" the function returns None. A hint that says only float would be false, and callers would do sums with None.",
           null,
           "<code>float(raw)</code> turns the text into a number, so the function gives back a float, not a str. A str would make every caller convert it again."] }
  ];
  function annotate({ el, done, kit }) {
    style();
    const ans = SLOTS.map(() => null);
    const paint = () => {
      const show = i => ans[i] === SLOTS[i].right ? kit.esc(SLOTS[i].opts[SLOTS[i].right]) : "____";
      el.innerHTML = `<h1>Two vendors, one temperature</h1>
        <p class="lead">You run the data side of a weather-station network. Two vendors send readings as JSON. <b>Vendor A</b> sends temperatures as text: <code>"21.5"</code>, or <code>"N/A"</code> when a sensor is down. <b>Vendor B</b> sends numbers: <code>19.0</code>. Last week a report crashed at 3 a.m. because a text temperature reached code that expected a number. An AI product has the same problem with a model's JSON reply: data from outside must be checked before your code trusts it. You start by writing down what one small function takes and gives back.</p>
        <p class="lead">Python lets you write that next to each name: <code>raw: str</code> means “raw is a str”, and <code>-&gt; float</code> means “gives back a float”. These notes are called <b>type hints</b>.</p>
        ${block([`def parse_temp(raw: ${ans[0] === SLOTS[0].right ? SLOTS[0].opts[2] : "____"}) -> ${ans[1] === SLOTS[1].right ? SLOTS[1].opts[1] : "____"}:`, ...FN.slice(1)])}
        <p class="task">Fill both blanks so the hints are true for both vendors.</p>
        ${SLOTS.map((s, i) => `<div class="lcase" id="c${i}"><p>The type of <b>${s.what}</b>: <span class="${P}slot">${show(i)}</span></p>${kit.options(s.opts.map(o => `<code>${kit.esc(o)}</code>`), { picked: ans[i], correct: s.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === s.right ? s.yes : s.no[ans[i]], ans[i] === s.right)}</div>`).join("")}`;
      cases(el, SLOTS, ans, paint, done);
    };
    paint();
  }

  /* 2. Predict which of six calls mypy flags. */
  const WHY_CALL = [
    { yes: "The hint allows a str, and <code>\"21.5\"</code> is a str.",
      no: "The hint says <code>str | float</code>, and <code>\"21.5\"</code> is a str. mypy checks the kind of value, and this kind is allowed." },
    { yes: "21 is an int, not a float, but mypy accepts an int wherever a float is expected.",
      no: "21 is an int, not a float. mypy still accepts it: its docs say an int is valid wherever a float is expected. Python agrees: <code>float(21)</code> works." },
    { yes: "None is neither a str nor a float.",
      no: "None is neither a str nor a float, so the call does not match the hint. mypy flags it before the program runs." },
    { yes: "mypy only knows that <code>\"hot\"</code> is a str, and a str is allowed. It never reads what the text says.",
      no: "mypy only knows that <code>\"hot\"</code> is a str, and a str is allowed. It does not read what the text says, so it has nothing to flag." },
    { yes: "The return hint says the result may be None, and None + 1 is not allowed. The return hint you wrote is what makes this catchable.",
      no: "The return hint says <code>float | None</code>. mypy follows it: the result may be None, and None + 1 is an error." },
    { yes: "A dict is neither a str nor a float. Someone passed the whole payload instead of its temperature.",
      no: "A dict is neither a str nor a float. Someone passed the whole payload instead of its temperature, and mypy sees that from the code alone." }
  ];
  const CALL_CASES = CALLS.map((_, i) => ({ right: FLAGGED[i] ? 0 : 1 }));
  function predictMypy({ el, done, kit }) {
    style();
    const ans = CALLS.map(() => null);
    const paint = () => {
      const all = CALL_CASES.every((c, i) => ans[i] === c.right), nf = FLAGGED.filter(Boolean).length;
      el.innerHTML = `<h1>What does the checker flag?</h1>
        <p class="lead">Python itself ignores hints. A separate program, a <b>type checker</b>, reads your code without running it and compares every call with the hints. A widely used one is <b>mypy</b>: you run <code>mypy calls.py</code>, like running <code>tsc</code> on TypeScript. When a call breaks a hint, mypy <b>flags</b> it: it prints an error for that line. Here is the function with your hints, and ${lower(CALLS.length)} calls to it.</p>
        ${block(FN)}
        <p class="task">For each call, predict: does mypy flag it?</p>
        ${CALLS.map(([c, note], i) => `<div class="lcase" id="c${i}"><p class="${P}call">${kit.esc(c)}<small>call ${i + 1}: ${note}</small></p>${kit.options(["mypy flags it", "mypy lets it pass"], { picked: ans[i], correct: CALL_CASES[i].right })}
          ${ans[i] == null ? "" : ans[i] === CALL_CASES[i].right
            ? kit.feedback(`${WHY_CALL[i].yes}${MYPY_BY_CALL[i].length ? block(MYPY_BY_CALL[i]) : "<br>"}When Python runs it: <code>${kit.esc(RUN_BY_CALL[i])}</code>`, true)
            : kit.feedback(WHY_CALL[i].no, false)}</div>`).join("")}
        ${all ? kit.feedback(`mypy flagged ${lower(nf)} of the ${lower(CALLS.length)} calls without running anything. Its report ends:${block(MYPY_CALLS.slice(-1), runCap + ", mypy")}Look at call ${HOT + 1}: mypy let it pass, and Python still crashed on it.`) : ""}`;
      cases(el, CALL_CASES, ans, paint, done);
    };
    paint();
  }

  /* 3. Spot the idea: hints are read before the program runs; data arrives while it runs. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const correct = 1;
    const opts = [
      "mypy has a bug: it should know that \"hot\" is not a number.",
      "mypy checks the code before it runs. A vendor's file arrives while it runs, so its values need a check that runs too.",
      "Python checks the hints when the function is called, so the hint is what stopped \"hot\"."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did call ${HOT + 1} get through?</h1>
        <p class="lead">mypy passed <code>${kit.esc(CALLS[HOT][0])}</code>. When Python ran it: <code>${kit.esc(RUN_BY_CALL[HOT])}</code>. Tonight vendor A's file will hold thousands of readings, and any of them could be <code>"hot"</code> or <code>"21,5"</code>.</p>
        <p class="task">What does this tell you about type hints?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. A checker reads code, not data. It knows a value is a str, never which text it holds, and tonight's file does not exist yet when mypy runs. So hints catch mix-ups between your own functions. Data from outside needs a check that runs on each value as it arrives. That check is called <b>validation</b>, and it is the second half of this lesson.", true)
          : ans === 0 ? kit.feedback("It is not a bug. mypy never runs your code, so it only knows the kind of each value: a str. Which text the str holds is known only when the program runs, and in tonight's file it is not even written yet.", false)
          : kit.feedback(`Python's own docs say Python does not check hints while it runs your code. The error came from <code>float()</code> inside the function, not from the hint. Call ${NONE_CALL + 1} shows the same: None went straight in, and <code>float()</code> failed on it.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. A dataclass: predict what it does with vendor A's text. */
  function dataclassScreen({ el, done, kit }) {
    style();
    let ans = null;
    const correct = 2;
    const opts = [
      "It raises a TypeError: temp_c must be a float.",
      "<code>Reading(station='A7', temp_c=21.5)</code>: the hint turns the text into a number.",
      "<code>Reading(station='A7', temp_c='21.5')</code>: the text is kept as it came."
    ];
    const paint = () => {
      el.innerHTML = `<h1>A record for one reading</h1>
        <p class="lead">A reading has a station and a temperature. A <b>dataclass</b> is a class you describe with hinted fields. Python writes the boring parts for you: the constructor, a readable print-out and <code>==</code>. <code>Reading(**payload)</code> passes the dict's keys as named arguments, a bit like spreading an object in JavaScript.</p>
        ${codeW(BROKEN.filter(([n]) => n >= lineOf("@dataclass") && n <= L_CAUSE).map(([, t]) => t), -1)}
        <p class="task">Vendor A's body is <code>${kit.esc(BODIES[2])}</code>. What does <code>load</code> return?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The real run printed:${block([BROKEN_PRINT], runCap)}Look at the quotes around <code>'21.5'</code>: station A7 holds a str in a field whose hint says float. Nothing complained. Python's docs say <code>@dataclass</code> does not check values against the hints.`, true)
          : ans === 0 ? kit.feedback("<code>@dataclass</code> reads the hints only to learn the field names. It does not check the values, so no error is raised here.", false)
          : kit.feedback("Nothing converts it. A hint is a note for tools such as mypy; it is not code that runs. The text \"21.5\" goes into the record exactly as it came.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Pydantic: predict which of four raw payloads it rejects. */
  const PAY_WHY = [
    { yes: "Accepted, and converted: temp_c is now the float 21.5. By default Pydantic works in <b>lax mode</b>: a str that is a valid number becomes that number.",
      no: "This is the reading the dataclass kept as text. Pydantic does not reject it: by default (lax mode) it turns a str that is a valid number into a float." },
    { yes: "Accepted. An int where a float is expected passes, as with mypy, and is stored as 19.0.",
      no: "19 is an int where a float is expected. Pydantic accepts that, as mypy did, and stores 19.0." },
    { yes: "Rejected. \"N/A\" is text that is not a number, so it cannot become a float.",
      no: "\"N/A\" is text, but not a number. Lax mode converts only text that reads as a number, so this one cannot become a float." },
    { yes: "Rejected. The vendor renamed the key to <code>temp</code>. By default Pydantic ignores keys it does not know, so <code>temp_c</code> is simply missing.",
      no: "Read the key: the vendor sent <code>temp</code>, not <code>temp_c</code>. Pydantic ignores the unknown key, and the field it needs is missing." }
  ];
  const PAY_CASES = PAY.map(p => ({ right: p.ok ? 0 : 1 }));
  function pydanticScreen({ el, done, kit }) {
    style();
    const ans = PAY.map(() => null);
    const paint = () => {
      const all = PAY_CASES.every((c, i) => ans[i] === c.right), nr = PAY.filter(p => !p.ok).length;
      el.innerHTML = `<h1>Check the data where it comes in</h1>
        <p class="lead">The place where outside data enters your program is the <b>border</b>. <b>Pydantic</b> is a library that checks data there, while the program runs. You write the same hinted fields on a class that extends <code>BaseModel</code>. <code>Reading.model_validate_json(body)</code> builds a Reading from the JSON text and <b>validates</b> it: it checks each field against its hint. You get a clean <code>Reading</code>, or a <code>ValidationError</code>.</p>
        ${block(PYD_MODEL)}
        <p class="task">Four raw bodies arrive. For each, predict: accepted or rejected?</p>
        ${PAY.map((p, i) => `<div class="lcase" id="c${i}"><p class="${P}call">${kit.esc(p.body)}</p>${kit.options(["Accepted", "Rejected"], { picked: ans[i], correct: PAY_CASES[i].right })}
          ${ans[i] == null ? "" : ans[i] === PAY_CASES[i].right ? kit.feedback(PAY_WHY[i].yes + block(p.out, runCap + ", Pydantic"), true) : kit.feedback(PAY_WHY[i].no, false)}</div>`).join("")}
        ${all ? kit.feedback(`${WORDS[nr]} of ${lower(PAY.length)} rejected. Read an error from the top. The first line says how many errors and in which model. The next line names the field (<code>temp_c</code>). Then comes the message, with its <code>type</code> and the <code>input_value</code> that failed. That is enough to tell a vendor exactly what is wrong.`) : ""}`;
      cases(el, PAY_CASES, ans, paint, done);
    };
    paint();
  }

  /* 6. The three settings that matter, each with a prediction. */
  const KNOB_WHY = [
    { yes: "Rejected. <code>strict=True</code> turns conversion off, so a str is no longer turned into a float, even a clean one.",
      also: "Vendor B's int still passes: an int counts as a number even in strict mode.",
      no: "<code>strict=True</code> turns conversion off. A str is no longer turned into a float, even a clean one like \"21.5\"." },
    { yes: "Rejected. 215 is a fine number, so the type passes, but <code>le=60</code> means “less than or equal to 60”. A station sending tenths of a degree is caught by a range, never by a type.",
      no: "The type is fine: 215 is a number. But <code>le=60</code> means “less than or equal to 60” (and <code>ge</code> “greater than or equal”). 215 breaks the range." },
    { yes: "Accepted: <code>temp_c=None</code>. A <code>mode=\"before\"</code> validator runs your function before Pydantic converts anything, and <code>float | None</code> allows None.",
      also: "It does exactly what you wrote, no more. The same run with lower-case \"n/a\":",
      no: "A <code>mode=\"before\"</code> validator runs your function on the raw value first. It turns \"N/A\" into None, and the hint <code>float | None</code> allows None." }
  ];
  const KNOB_CASES = KNOBS.map(k => ({ right: k.ok ? 0 : 1 }));
  function knobs({ el, done, kit }) {
    style();
    const ans = KNOBS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Three settings that matter</h1>
        <p class="lead">For messy data from outside, three settings decide what gets through. The highlighted line in each model is the setting.</p>
        <p class="task">For each model and body, predict: accepted or rejected?</p>
        ${KNOBS.map((k, i) => `<div class="lcase" id="c${i}"><p class="${P}h">${kit.esc(k.name)}</p>${codeW(k.code, k.on)}<p class="${P}call">${kit.esc(k.body)}</p>
          ${kit.options(["Accepted", "Rejected"], { picked: ans[i], correct: KNOB_CASES[i].right })}
          ${ans[i] == null ? "" : ans[i] === KNOB_CASES[i].right
            ? kit.feedback(`${KNOB_WHY[i].yes}${block(k.out, runCap + ", Pydantic")}${k.also ? `${KNOB_WHY[i].also}<p class="${P}call">${kit.esc(k.also.body)}</p>${block(k.also.out)}` : ""}`, true)
            : kit.feedback(KNOB_WHY[i].no, false)}</div>`).join("")}
        ${KNOB_CASES.every((c, i) => ans[i] === c.right) ? kit.feedback("When to use which: lax mode when a sender's format is messy but honest (vendor A's \"21.5\"); strict when a sender promised real numbers and you want to hear when they break it; ranges for values that can be the right type and still impossible; a before-validator for one known odd value such as \"N/A\".") : ""}`;
      cases(el, KNOB_CASES, ans, paint, done);
    };
    paint();
  }

  /* 7. Broken on purpose: the crash is in mean_temp, the cause is not. */
  const CAUSES = [
    { t: `Line ${L_CRASH}, the sum in <code>mean_temp</code>: it adds a float and a str.`, why: "That is where it crashed, so it is the symptom. <code>mean_temp</code> is correct for real Readings. The str got into a Reading earlier, and the sum is only the first place that touched it." },
    { t: `Line ${L_CAUSE}, <code>Reading(**payload)</code> in <code>load</code>: vendor A's text goes into the record unchecked.`, why: null },
    { t: `Line ${L_CALLER}, the <code>print</code>: printing the mean fails.`, why: `Line ${L_CALLER} is only the caller, the top of the traceback. Read a traceback from the bottom: the error happened inside <code>mean_temp</code>, and print never got a value to print.` }
  ];
  const FIXES = [
    { t: "Wrap the sum in <code>try/except</code> and skip readings that fail.", why: "The crash stops, but every vendor A station silently drops out of every mean. The bad value is still inside every Reading, waiting for the next function." },
    { t: "Write <code>float(r.temp_c)</code> inside <code>mean_temp</code>.", why: "That fixes one reader. Every other function that uses temp_c (a maximum, a frost alert) has to remember the same trick, and \"N/A\" would still crash it." },
    { t: "Make <code>Reading</code> a Pydantic model and build it with <code>Reading.model_validate(payload)</code> in <code>load</code>.", why: null }
  ];
  function broken({ el, done, kit }) {
    style();
    const ans = [null, null], RIGHT = [1, 2];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: a crash far from the cause</h1>
        <p class="lead">The 3 a.m. report, cut down. <code>load</code> turns each JSON body into a <code>Reading</code>; two bodies come from vendor B and one from vendor A. Here is the code, with the file's line numbers, and what really happened when we ran it and then ran mypy on it.</p>
        ${codeW(BROKEN.filter(([, t]) => t).map(([n, t]) => `${String(n).padStart(2)}  ${t}`), -1)}
        ${block(BROKEN_TB, runCap)}
        ${block(["$ mypy broken.py", MYPY_BROKEN], runCap + ", mypy")}
        <div class="lcase" id="c0"><p class="task">Which line is the cause?</p>${kit.options(CAUSES.map(c => c.t), { picked: ans[0], correct: RIGHT[0] })}
          ${ans[0] == null ? "" : ans[0] === RIGHT[0]
            ? kit.feedback(`Right. The bad value entered at line ${L_CAUSE}, inside <code>load</code>, and crashed later in <code>mean_temp</code>, at line ${L_CRASH}. And mypy could not see it: to mypy, whatever <code>json.loads</code> returns has the type <code>Any</code>, which switches checking off.${block([MYPY_REVEAL], runCap + ", mypy")}`, true)
            : kit.feedback(CAUSES[ans[0]].why, false)}</div>
        <div class="lcase" id="c1"><p class="task">Which fix stops it for good?</p>${kit.options(FIXES.map(c => c.t), { picked: ans[1], correct: RIGHT[1] })}
          ${ans[1] == null ? "" : ans[1] === RIGHT[1]
            ? kit.feedback(`Right. Check once, at the border, and every function after it can trust its hints. <code>model_validate</code> takes a dict you already parsed; <code>model_validate_json</code>, from the last screens, takes the JSON text, and Pydantic's docs say it is usually faster. The same script with only that change:${block(FIXED_OUT, runCap)}Station A7 now holds 21.5, a float, and the mean works. mypy still says: <code>${kit.esc(MYPY_FIXED)}</code>. A body like vendor A's \"N/A\" would now stop at <code>load</code> with a ValidationError naming the field, not at 3 a.m. inside a report.`, true)
            : kit.feedback(FIXES[ans[1]].why, false)}</div>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === RIGHT[0] && ans[1] === RIGHT[1]) done();
      }));
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  const TOOLS = ["Hints + mypy", "A dataclass", "A Pydantic model"];
  const SIT = [
    { q: "A webhook posts JSON from a partner's system into your service every minute.", right: 2,
      yes: "Right. Outside data, arriving while the program runs: validate it at the border.",
      no: ["mypy never sees the webhook's data: <code>json.loads</code> gives Any. Only a check at run time can.", "A dataclass would store whatever the partner sends, as the A7 reading showed."] },
    { q: "Your own code builds millions of small records from values it has already checked, inside a tight loop.", right: 1,
      yes: "Right. The values are already clean, so validating each record again only costs time. A dataclass gives the record a name and fields, and mypy checks how you use it.",
      no: ["Hints alone are fine for function arguments, but you still need a record type to hold the fields. A dataclass is that record.", null, "The values were checked already. Validating millions of records again costs time on every one and finds nothing new."] },
    { q: "You change what a shared helper returns, from float to float | None. It is called in 40 places.", right: 0,
      yes: `Right. This is a mix-up between your own functions, all visible in the code. mypy lists every caller that now does a sum with a possible None, as it did with call ${SUM_CALL + 1}, before anything runs.`,
      no: [null, "A dataclass does not check callers. The question is which of the 40 call sites now break, and only a checker reading the code finds them all.", "No outside data is involved. Validation would only fail at run time, one caller at a time. mypy finds all 40 before anything runs."] }
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = SIT.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Where types pay off</h1>
        <p class="lead"><b>What they are for:</b> hints and a checker catch mix-ups between your own functions before anything runs. Validation catches bad data from outside while it runs.</p>
        <p class="lead"><b>Reach for Pydantic</b> at every border: a vendor's JSON, a webhook, a config file, a model's reply. Inside, use plain hints and dataclasses. <b>Skip Pydantic</b> in a short one-off script, and do not expect it to catch data that is the right type but wrong.</p>
        <p class="lead"><b>What it costs:</b></p>
        <ul class="${P}cost"><li>hints: writing them, and a checker step in CI;</li><li>Pydantic: a dependency, and work on every object it builds;</li><li>both: rules to keep in step when a vendor changes its format.</li></ul>
        <p class="task">For each situation, pick the tool that fits best.</p>
        ${SIT.map((s, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(s.q)}</p>${kit.options(TOOLS, { picked: ans[i], correct: s.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === s.right ? s.yes : s.no[ans[i]], ans[i] === s.right)}</div>`).join("")}`;
      cases(el, SIT, ans, paint, done);
    };
    paint();
  }

  /* 9. Recognise it: would validation at the border catch it? */
  const CASES = [
    { q: "A model's tool call hands you its arguments as a JSON string. Your code needs <code>city</code> as text and <code>days</code> as a whole number.", right: 0,
      yes: "Yes. A model's reply is outside data like a vendor's file. A Pydantic model with <code>city: str</code> and <code>days: int</code> turns a bad reply into a clear error before your code acts on it.",
      no: "A model's reply arrives while the program runs, exactly like vendor A's file. mypy cannot see it, so a Pydantic model is the check that can." },
    { q: "A station sends 21.5 every hour, but its sensor sits in full sun and the real air temperature is about 6 degrees lower.", right: 1,
      yes: "No. 21.5 is a valid float inside any sensible range. Validation checks the shape and the rules you wrote, not whether a value is true. Catching this needs a data-quality check, such as comparing with nearby stations.",
      no: "Every rule passes: 21.5 is a float, and it is inside any sensible range. Validation checks shape and rules, not truth. Only a comparison with nearby stations would show it." },
    { q: "A settings file read at start-up says <code>retries: \"three\"</code>.", right: 0,
      yes: "Yes. A settings model with <code>retries: int</code> fails at start-up, naming the field, instead of crashing later on the first retry.",
      no: "A settings file is outside data too. With <code>retries: int</code>, \"three\" cannot become an int, so the program stops at start-up and names the field." },
    { q: "Two of your own modules call each other, and one renamed a named argument (a keyword argument) from <code>temp</code> to <code>temp_c</code>. Another still passes <code>temp=</code>.", right: 1,
      yes: `No, not validation. No outside data is involved: both sides are your code. mypy reads both and flags the old name before anything runs, the way it flagged calls ${ARG_CALLS.join(" and ")}:`, out: [MYPY_KWARG],
      no: "Both sides are your own code, so nothing arrives from outside. mypy catches a wrong keyword name by reading the code, before it runs. Validation would only fail at run time." }
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would validation at the border catch it?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the weather stations.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${c.q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: c.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === c.right ? c.yes + (c.out ? block(c.out, runCap + ", mypy") : "") : c.no, ans[i] === c.right)}</div>`).join("")}`;
      cases(el, CASES, ans, paint, done);
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can say where each check belongs</h1>
      <p class="lead">Type hints describe what a function takes and gives back. A checker such as mypy reads them before the program runs and catches mix-ups between your own functions, but it never sees data, and <code>Any</code> switches it off. A dataclass names a record's fields and checks nothing. A Pydantic model validates outside data while the program runs: it converts what it safely can, rejects the rest with an error that names the field, and lets you add strictness, ranges and your own rules.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. A station check that asks several vendors for readings waits on each one in turn. The next lesson runs those slow calls at the same time.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Type hints, dataclasses and Pydantic",
    checked: "2026-11-13",
    sources: [
      "https://docs.python.org/3/library/typing.html",
      "https://docs.python.org/3/library/dataclasses.html",
      "https://mypy.readthedocs.io/en/stable/duck_type_compatibility.html",
      "https://mypy.readthedocs.io/en/stable/dynamic_typing.html",
      "https://pydantic.dev/docs/validation/latest/concepts/models/",
      "https://pydantic.dev/docs/validation/latest/concepts/conversion_table/",
      "https://pydantic.dev/docs/validation/latest/concepts/strict_mode/",
      "https://pydantic.dev/docs/validation/latest/concepts/validators/",
      "https://pydantic.dev/docs/validation/latest/api/standard_library_types/",
      "https://pydantic.dev/docs/validation/latest/concepts/performance/"
    ],
    interview: [{
      q: "Your service pulls data from several partner APIs. Now and then it crashes with a TypeError deep inside a reporting function, yet type checking passes in CI. How do you approach it?",
      good: [
        "Read the traceback from the bottom: the crash site is a symptom; find where the bad value entered",
        "Explain why the checker is silent: parsed JSON is Any to mypy, so nothing after it is checked",
        "Validate at the border with a Pydantic model, so a bad payload fails at once with the field and input named",
        "Choose lax or strict per partner, add ranges, and log or set aside rejected payloads instead of dropping them silently",
        "Keep the bad payload as a test case"
      ],
      weak: "“Wrap the report in try/except” or “cast to float where it crashes”. It hides the symptom in one place and leaves the bad value in every record."
    }, {
      q: "A teammate wants every class in the codebase to be a Pydantic model, for safety. Do you agree?",
      good: [
        "Not everywhere: validate at the borders, where outside data comes in",
        "Inside, data is already checked, so dataclasses with hints and a type checker are enough",
        "Validation costs work on every object built, which matters on hot paths",
        "Neither catches a value that has the right type but is wrong; that needs data-quality checks"
      ],
      weak: "“Yes, more validation is always safer.” It misses the cost on every object and that a checker already covers your own code."
    }],
    screens: [annotate, predictMypy, spotIdea, dataclassScreen, pydanticScreen, knobs, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CALLS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: PAY.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: KNOBS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SIT.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
