/* Lesson: feature preparation (missing values, categories, scaling). Story: a recruitment agency's table of 12
   past candidates has blank salary fields, city names typed in many ways, and salaries in three currencies; the
   agency finds the past candidates most like a new one (k-nearest neighbours) and must prepare every column first.
   Ideas: (1) choose a treatment per column from what the column means: fix meaning first (one unit, one spelling),
   then fill blanks (median, plus a "was blank" flag), one-hot categories, scale numbers, drop ids;
   (2) every choice (fill value, city list, mean and spread) is learned once from the past rows and reused on new rows.
   Data, all real, from runs on this Mac (docs/ai-path/runs/s2-feature-prep/, env.txt has the versions):
   - candidates.csv, new_candidates.csv: the tables (made up for the lesson; EUR_PER are example rates, not market rates);
   - explore.py + explore.out.txt: the raw table, salary scaled before converting, converted salaries, mean and
     median, distances from new candidate N-201 before and after scaling;
   - prepare_trace.py + prepare_trace.out.txt: prepare() traced line by line (the code screen);
   - broken.py + broken.out.txt: prepare(new) on its own, the real ValueError from scikit-learn, the column-only
     patch and the learned-from-past fix.
   No model calls were recorded for this lesson.
   Lesson-local style: a small data table and a row card (.lx-s2-feature-prep-*), see ensureStyle(). */
(() => {
  const ID = "s2-feature-prep";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const fmt = n => n.toLocaleString("en-US");

  /* ---------- Data copied from the runs ---------- */
  // candidates.csv, as printed in explore.out.txt ("== raw table =="); null = NaN (blank)
  const HEAD = ["candidate_id", "city", "years_exp", "salary", "currency", "placed"];
  const PAST = [
    ["C-101", "Berlin", 6, 62000, "EUR", 1], ["C-102", " berlin", 2, 41000, "EUR", 0], ["C-103", "Munich", 9, null, "EUR", 1],
    ["C-104", "BERLIN", 4, 58000, "USD", 1], ["C-105", "Hamburg", 3, 230000, "PLN", 0], ["C-106", "Munich", 12, 150000, "EUR", 1],
    ["C-107", "Leipzig", 1, 36000, "EUR", 0], ["C-108", "berlin ", 7, null, "EUR", 1], ["C-109", "Hamburg", 5, 56000, "EUR", 0],
    ["C-110", "Munich", 8, 280000, "PLN", 1], ["C-111", "Leipzig", 3, 44000, "EUR", 0], ["C-112", "Berlin", 5, 52000, "EUR", 1]
  ];
  // new_candidates.csv
  const NEW = [["N-201", "Berlin", 5, 58000, "EUR"], ["N-202", "munich", 10, null, "EUR"], ["N-203", "Berlin", 2, 45000, "USD"]];
  const EUR_PER = { EUR: 1.0, USD: 0.9, PLN: 0.23 }; // example rates used in every script, not market rates
  // explore.out.txt "== scaling salary WITHOUT converting the currency ==" (null = blank)
  const Z_UNCONVERTED = [-0.44, -0.68, null, -0.49, 1.46, 0.56, -0.74, null, -0.51, 2.03, -0.65, -0.55];
  // explore.out.txt "== salary converted to EUR =="
  const SAL_EUR = [62000, 41000, null, 52200, 52900, 150000, 36000, null, 56000, 64400, 44000, 52000];
  const RUN_MEAN = 61050.0, RUN_MEDIAN = 52550.0; // printed by explore.py, checked against the JS below
  // explore.out.txt distances from N-201 (Berlin, 5 years, 58000 EUR): [id, city, years, salary_eur, raw, scaled]
  const DIST = [
    ["C-101", "Berlin", 6, 62000, 4000.0, 0.343], ["C-102", "Berlin", 2, 41000, 17000.0, 1.106], ["C-103", "Munich", 9, 52550, 5450.0, 1.903],
    ["C-104", "Berlin", 4, 52200, 5800.0, 0.371], ["C-105", "Hamburg", 3, 52900, 5100.0, 1.558], ["C-106", "Munich", 12, 150000, 92000.0, 4.067],
    ["C-107", "Leipzig", 1, 36000, 22000.0, 2.035], ["C-108", "Berlin", 7, 52550, 5450.0, 0.656], ["C-109", "Hamburg", 5, 56000, 2000.0, 1.416],
    ["C-110", "Munich", 8, 64400, 6400.0, 1.714], ["C-111", "Leipzig", 3, 44000, 14000.0, 1.619], ["C-112", "Berlin", 5, 52000, 6000.0, 0.203]
  ];
  const STD_YEARS = 3.1754, STD_SALARY = 29568.11; // explore.out.txt

  // The listing is prepare() from docs/ai-path/runs/s2-feature-prep/prepare_trace.py, line for line (line 0 = def).
  const CODE = [
    "def prepare(candidates):",
    "    table = candidates.drop(columns=[\"candidate_id\"])",
    "    table[\"city\"] = table[\"city\"].str.strip().str.title()",
    "    table[\"salary_eur\"] = table[\"salary\"] * table[\"currency\"].map(EUR_PER)",
    "    table[\"salary_blank\"] = table[\"salary_eur\"].isna().astype(int)",
    "    table[\"salary_eur\"] = table[\"salary_eur\"].fillna(table[\"salary_eur\"].median())",
    "    table = table.drop(columns=[\"salary\", \"currency\"])",
    "    table = pd.get_dummies(table, columns=[\"city\"], dtype=int)",
    "    for col in [\"years_exp\", \"salary_eur\"]:",
    "        table[col] = (table[col] - table[col].mean()) / table[col].std()",
    "    return table"
  ];
  // prepare_trace.out.txt: [line about to run, event (l line, r return), col, table.columns, the row of C-108 (null = NaN)]
  const TRACE = [[1,"l",null,null,null],[2,"l",null,["city","years_exp","salary","currency"],{"city":"berlin ","years_exp":7,"salary":null,"currency":"EUR"}],[3,"l",null,["city","years_exp","salary","currency"],{"city":"Berlin","years_exp":7,"salary":null,"currency":"EUR"}],[4,"l",null,["city","years_exp","salary","currency","salary_eur"],{"city":"Berlin","years_exp":7,"salary":null,"currency":"EUR","salary_eur":null}],[5,"l",null,["city","years_exp","salary","currency","salary_eur","salary_blank"],{"city":"Berlin","years_exp":7,"salary":null,"currency":"EUR","salary_eur":null,"salary_blank":1}],[6,"l",null,["city","years_exp","salary","currency","salary_eur","salary_blank"],{"city":"Berlin","years_exp":7,"salary":null,"currency":"EUR","salary_eur":52550,"salary_blank":1}],[7,"l",null,["city","years_exp","salary_eur","salary_blank"],{"city":"Berlin","years_exp":7,"salary_eur":52550,"salary_blank":1}],[8,"l",null,["years_exp","salary_eur","salary_blank","city_Berlin","city_Hamburg","city_Leipzig","city_Munich"],{"years_exp":7,"salary_eur":52550,"salary_blank":1,"city_Berlin":1,"city_Hamburg":0,"city_Leipzig":0,"city_Munich":0}],[9,"l","years_exp",["years_exp","salary_eur","salary_blank","city_Berlin","city_Hamburg","city_Leipzig","city_Munich"],{"years_exp":7,"salary_eur":52550,"salary_blank":1,"city_Berlin":1,"city_Hamburg":0,"city_Leipzig":0,"city_Munich":0}],[8,"l","years_exp",["years_exp","salary_eur","salary_blank","city_Berlin","city_Hamburg","city_Leipzig","city_Munich"],{"years_exp":0.499,"salary_eur":52550,"salary_blank":1,"city_Berlin":1,"city_Hamburg":0,"city_Leipzig":0,"city_Munich":0}],[9,"l","salary_eur",["years_exp","salary_eur","salary_blank","city_Berlin","city_Hamburg","city_Leipzig","city_Munich"],{"years_exp":0.499,"salary_eur":52550,"salary_blank":1,"city_Berlin":1,"city_Hamburg":0,"city_Leipzig":0,"city_Munich":0}],[8,"l","salary_eur",["years_exp","salary_eur","salary_blank","city_Berlin","city_Hamburg","city_Leipzig","city_Munich"],{"years_exp":0.499,"salary_eur":-0.24,"salary_blank":1,"city_Berlin":1,"city_Hamburg":0,"city_Leipzig":0,"city_Munich":0}],[10,"l","salary_eur",["years_exp","salary_eur","salary_blank","city_Berlin","city_Hamburg","city_Leipzig","city_Munich"],{"years_exp":0.499,"salary_eur":-0.24,"salary_blank":1,"city_Berlin":1,"city_Hamburg":0,"city_Leipzig":0,"city_Munich":0}],[10,"r","salary_eur",["years_exp","salary_eur","salary_blank","city_Berlin","city_Hamburg","city_Leipzig","city_Munich"],{"years_exp":0.499,"salary_eur":-0.24,"salary_blank":1,"city_Berlin":1,"city_Hamburg":0,"city_Leipzig":0,"city_Munich":0}]];

  // broken.out.txt
  const TRAIN_COLS = ["years_exp", "salary_eur", "salary_blank", "city_Berlin", "city_Hamburg", "city_Leipzig", "city_Munich"];
  const NEW_COLS = ["years_exp", "salary_eur", "salary_blank", "city_Berlin", "city_Munich"];
  const ERROR = "Traceback (most recent call last):\n  File \"…/broken.py\", line 23, in <module>\n    print(model.predict(new_X))\n          ^^^^^^^^^^^^^^^^^^^^\nValueError: The feature names should match those that were passed during fit.\nFeature names seen at fit time, yet now missing:\n- city_Hamburg\n- city_Leipzig";
  // rows N-201..N-203: [years_exp, salary_eur] after the column-only patch, and after the learned-from-past fix
  const PATCHED = [[-0.165, 1.0], [1.072, 0.0], [-0.907, -1.0]];
  const FIXED = [[-0.131, -0.055], [1.443, -0.240], [-1.076, -0.647]];

  /* ---------- Derived from the data ---------- */
  const salaries = SAL_EUR.filter(v => v != null);
  const MEAN = salaries.reduce((a, b) => a + b, 0) / salaries.length;
  const MEDIAN = (() => { const s = [...salaries].sort((a, b) => a - b), m = s.length / 2; return s.length % 2 ? s[(s.length - 1) / 2] : (s[m - 1] + s[m]) / 2; })();
  if (Math.abs(MEAN - RUN_MEAN) > 1e-6 || MEDIAN !== RUN_MEDIAN) throw new Error(ID + ": mean or median does not match the run");
  const BLANKS = PAST.filter(r => r[3] == null).map(r => r[0]);
  const TOP = PAST[SAL_EUR.indexOf(Math.max(...salaries))]; // C-106
  const MEAN_NO_TOP = (salaries.reduce((a, b) => a + b, 0) - Math.max(...salaries)) / (salaries.length - 1);
  const rawCities = [...new Set(PAST.map(r => r[1]))];
  const cleanCities = [...new Set(PAST.map(r => { const t = r[1].trim(); return t[0].toUpperCase() + t.slice(1).toLowerCase(); }))].sort();
  const byId = id => PAST.findIndex(r => r[0] === id);
  const C105 = byId("C-105"), C110 = byId("C-110");
  const rank = (arr, k) => arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])[k][1];
  const zRank = Z_UNCONVERTED.map((v, i) => [v, i]).filter(x => x[0] != null).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  const D = id => DIST.find(d => d[0] === id);
  if (zRank[1] !== C105) throw new Error(ID + ": C-105 is not the second-highest scaled ask");
  const CHOICES = ["C-109", "C-112", "C-101"]; // the three shown on the distance screen
  const nearestRaw = CHOICES.reduce((a, b) => D(a)[4] <= D(b)[4] ? a : b);
  const nearestScaled = CHOICES.reduce((a, b) => D(a)[5] <= D(b)[5] ? a : b);
  const COLS_BEFORE = TRACE[6][3].length, COLS_AFTER = TRACE[7][3].length; // around get_dummies (line 7)
  const MISSING = TRAIN_COLS.filter(c => !NEW_COLS.includes(c));
  const NEW_CITIES = [...new Set(NEW.map(r => { const t = r[1].trim(); return t[0].toUpperCase() + t.slice(1).toLowerCase(); }))].sort();

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-wrap { margin: 14px 0 0; overflow-x: auto; max-width: 100%; }
      .lx-${ID}-t { border-collapse: collapse; font: 500 12.5px/1.4 var(--mono); color: var(--ink); }
      .lx-${ID}-t th { font: 600 12px/1.3 var(--mono); color: var(--muted); text-align: left; vertical-align: bottom; padding: 6px 4px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-t td { padding: 6px 4px; border-bottom: 1px solid var(--line); white-space: pre; }
      .lx-${ID}-t td.lx-${ID}-num { text-align: right; }
      .lx-${ID}-t tr.lx-${ID}-hi td { box-shadow: inset 0 -2px 0 var(--ink); font-weight: 700; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-pre { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); font: 500 13px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-card { margin: 12px 0 0; padding: 8px 12px; border: 1px solid var(--line); background: var(--surface); }
      .lx-${ID}-card div { font: 500 13.5px/1.6 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-card b { font-weight: 700; }
      .lx-${ID}-col { font: 600 15px var(--mono); }
      .lx-${ID}-code .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + 8ch); text-indent: -8ch; }
      @media (max-width: 640px) { .lx-${ID}-code .lcode div { padding-left: calc(12px + 8ch); } }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
      .lx-${ID}-check { list-style: none; padding: 0; margin: 12px 0 0; }
      .lx-${ID}-check li { border-top: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .lx-${ID}-check label span { padding-top: 10px; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .lx-${ID}-check input:checked { background-color: var(--good); outline-color: var(--good); }
    `;
    document.head.appendChild(s);
  }
  // A plain data table; cells are escaped. o.hi: row index to underline; o.num: column indexes aligned right.
  function dataTable(kit, head, rows, o = {}) {
    const num = new Set(o.num || []);
    return `<div class="lx-${ID}-wrap"><table class="lx-${ID}-t"${o.title ? ` aria-label="${kit.esc(o.title)}"` : ""}><thead><tr>${head.map(h => `<th>${kit.esc(h).replace(/_/g, "_<wbr>")}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) =>
      `<tr${o.hi === i ? ` class="lx-${ID}-hi"` : ""}>${r.map((c, j) => `<td${num.has(j) ? ` class="lx-${ID}-num"` : ""}>${kit.esc(c == null ? "NaN" : String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const q = s => `"${s}"`; // show a city exactly as typed, spaces visible inside the quotes
  const rawRows = () => PAST.map(r => [r[0], q(r[1]), r[2], r[3] == null ? null : fmt(r[3]), r[4]]);
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked], picked === correct)}`;
  }

  /* 1. The situation, and the by-hand pass: one treatment per column. */
  const COLS = [
    { name: "candidate_id", note: "C-101, C-102, …", opts: ["Drop it", "One-hot it", "Scale it"], right: 0,
      fb: ["Right. An id is a label for a person, not a fact about them. C-112 is not “more” than C-101, and a new candidate's id was never seen before, so it can tell the model nothing.",
        "One-hot would make one column per person, each with a single 1 in it. The model could only learn “this exact person”, and every new candidate gets a column of zeros.",
        "Scaling treats C-112 as a bigger number than C-101. The order of ids is the order of sign-up, not anything about the job."] },
    { name: "city", note: rawCities.map(q).join(", "), opts: ["Scale it", "Clean the spelling, then one-hot it", "One-hot it as typed"], right: 1,
      fb: ["A city has no size. You cannot subtract Hamburg from Munich, so there is nothing to scale.",
        `Right. Trimmed and in one case, ${plural(rawCities.length, "spelling")} become ${cleanCities.length} cities. Then each city gets its own 0/1 column, so no city counts as “bigger” than another.`,
        `As typed there are ${plural(rawCities.length, "different value")}: Berlin alone appears in several spellings, so one-hot would make several Berlin columns and the model would treat them as different places.`] },
    { name: "years_exp", note: "1 to 12, no blanks", opts: ["One-hot it", "Drop it", "Scale it"], right: 2,
      fb: ["One-hot would make “4 years” and “5 years” as unrelated as two cities. The order and the distance between values are the point of this column.",
        "Experience is one of the few real facts about the work here. Dropping it throws away the signal.",
        "Right. It is already a clean number with a real order. Only its range needs to match the other numbers, which is what scaling does."] },
    { name: "salary", note: `${plural(BLANKS.length, "blank")}, three currencies`, opts: ["Fill the blanks with 0, then scale", "Convert to one currency, fill the blanks, then scale", "Scale it as it is"], right: 1,
      fb: ["A 0 means “asks for nothing”, the lowest ask in the table. That is a strong claim about two people nobody asked.",
        "Right. Make every value mean the same thing first (euros), then fill the blanks, then scale. The next screens show why each step needs the one before it.",
        `Two of the numbers are in Polish zloty (PLN) and one is in dollars. ${fmt(PAST[C110][3])} PLN would look like the richest ask in the table.`] },
    { name: "currency", note: "EUR, USD, PLN", opts: ["Use it to convert salary, then drop it", "One-hot it", "Scale it"], right: 0,
      fb: ["Right. It tells you how to read the salary column. Once salary is in euros, it has done its job.",
        "That would let the model learn “PLN candidates” as a group. Currency is a unit of another column, not a fact about the person's fit.",
        "Currency is a text label with no order. And its real job is to fix the salary column, not to be a feature."] }
  ];
  function columns({ el, done, kit }) {
    ensureStyle();
    const ans = COLS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Twelve candidates, three kinds of mess</h1>
        <p class="lead">Before any model can learn from a table, every column must become a clean number. This step is called feature preparation (a feature is a column the model uses as input). A recruitment agency keeps a table of past candidates and whether they were placed in a job. For each new candidate it wants the three most similar past ones (nearest neighbours, as in the earlier lesson). A distance needs every column to be a number of a comparable size. This table, read with pandas, is not that yet.</p>
        <p class="lx-${ID}-cap"><code>NaN</code> is pandas' mark for a blank cell. City values are in quotes so you can see the spaces.</p>
        ${dataTable(kit, HEAD.slice(0, 5), rawRows(), { num: [2, 3], title: "candidates.csv" })}
        <p class="lx-${ID}-cap">Printed by explore.py. The table has one more column, <code>placed</code> (1 or 0): what the agency wants to predict, so it is not a feature and is left out here.</p>
        <p class="lead">The treatments you can pick: <b>drop</b> a column; <b>one-hot</b> it (replace it with one 0/1 column per value it has); <b>scale</b> it (shift and divide a number column so its typical size matches the other columns); <b>fill</b> its blanks with a chosen value.</p>
        <p class="task">Go column by column. Pick what each one needs before it can go into a distance.</p>
        ${COLS.map((c, i) => `<div class="lcase" id="c${i}"><p><span class="lx-${ID}-col">${kit.esc(c.name)}</span> ${kit.esc(c.note)}</p>${ask(kit, c.opts, c.right, ans[i], c.fb)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (COLS.every((col, j) => ans[j] === col.right)) done();
      }));
    };
    paint();
  }

  /* 2. Spot the idea: scaling cannot fix a column whose values mean different things. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const c105 = PAST[C105];
    const opts = [
      "The scaler is the wrong kind; another scaler would fix it",
      "The column mixes units. Scaling changes the range, not the meaning, so the zloty number stays big",
      `The very high ask of ${TOP[0]} pushes everyone else around`,
      "The two blank salaries distort the mean"
    ];
    const RIGHT = 1;
    const fb = [
      "Any scaler (by mean and spread, or by min and max) keeps the order of the values. 230,000 stays above 62,000 whatever you divide by. The problem is in the numbers, not the scaler.",
      `Right. Scaling subtracts one number and divides by another, the same for every row. It cannot know that one row is zloty. Fix what the values <b>mean</b> first (one unit, one spelling), and only then do the arithmetic. After converting with the agency's example rates, ${c105[0]} asks ${fmt(SAL_EUR[C105])} EUR: an ordinary ask, close to the middle of the table.`,
      `${TOP[0]} does stretch the scale, but it is a real euro ask. Remove it and ${c105[0]} would still sit far above the euro asks, because 230,000 is still the second-biggest number in the column.`,
      `pandas skips blanks when it computes a mean (that is its default), so the ${plural(BLANKS.length, "blank")} just get no scaled value. They do not move ${c105[0]}.`
    ];
    const rows = PAST.map((r, i) => [r[0], r[3] == null ? null : fmt(r[3]), r[4], Z_UNCONVERTED[i] == null ? "" : Z_UNCONVERTED[i].toFixed(2)]);
    const paint = () => {
      el.innerHTML = `<h1>Scale first, fix later?</h1>
        <p class="lead">A colleague is in a hurry. He scales the salary column as it is: subtract the mean, then divide by the spread (the standard deviation: how far values usually sit from the mean). A scaled value near 0 is typical. A big one is far above the rest.</p>
        ${dataTable(kit, ["id", "salary", "currency", "scaled"], rows, { num: [1, 3], hi: C105, title: "salary scaled without converting" })}
        <p class="lx-${ID}-cap">Printed by explore.py.</p>
        <p class="task">${kit.esc(c105[0])} now reads ${Z_UNCONVERTED[C105].toFixed(2)}, the second-highest ask after ${kit.esc(PAST[zRank[0]][0])}. Why is that wrong, and what does it tell you?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Missing values: which fill value? */
  function fillBlanks({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["0", `${fmt(MEAN)} (the mean)`, `${fmt(MEDIAN)} (the median)`];
    const RIGHT = 2;
    const fb = [
      "0 would make the two blanks the lowest asks by far, and pull them next to the most junior candidates. A blank means “not told”, not “asks for nothing”.",
      `The mean is pulled up by one ask: ${TOP[0]} wants ${fmt(SAL_EUR[byId(TOP[0])])} EUR. Without that one row the mean would be ${fmt(Math.round(MEAN_NO_TOP))}. A single unusual value moves the mean a lot.`,
      `Right. The median is the middle ask: half ask less, half ask more. One very high ask does not move it. This is a guess, so also keep a 0/1 column <code>salary_blank</code> that says “this salary was filled in by us”. If people who leave the field blank behave differently, the model can still see it. (scikit-learn's <code>SimpleImputer</code> has <code>strategy="median"</code> and <code>add_indicator=True</code> for the same two steps.)`
    ];
    const rows = PAST.map((r, i) => [r[0], SAL_EUR[i] == null ? null : fmt(SAL_EUR[i])]);
    const paint = () => {
      el.innerHTML = `<h1>What goes in the blanks?</h1>
        <p class="lead">The salaries are now in euros. ${kit.esc(BLANKS.join(" and "))} left the field blank. Most models cannot take a blank at all, so something must go there.</p>
        ${dataTable(kit, ["id", "salary_eur"], rows, { num: [1], hi: byId(TOP[0]), title: "salaries in euros" })}
        <p class="lx-${ID}-cap">Converted in explore.py with the example rates EUR ${EUR_PER.EUR}, USD ${EUR_PER.USD}, PLN ${EUR_PER.PLN} (not market rates). The underlined row is the highest ask.</p>
        <p class="task">Which value would you put in the two blanks?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Predict the nearest neighbour, before and after scaling. */
  function distances({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null; // stage 0: unscaled, 1: scaled, 2: finished
    const rows = CHOICES.map(id => { const d = D(id); return [d[0], d[1], d[2], fmt(d[3])]; });
    const say = (st, id) => {
      const d = D(id);
      if (st === 0) return `Not ${id}. Without scaling, a distance adds up raw differences: 1 year counts as much as 1 euro. ${id} is ${fmt(Math.abs(d[3] - 58000))} EUR away on salary, and that swamps the rest.`;
      return `Not ${id}. After scaling, a difference of one typical spread counts the same in every column (${STD_YEARS} years, or ${fmt(STD_SALARY)} EUR). Look at the whole row: city, years and salary all count now.`;
    };
    const paint = () => {
      const right = stage === 0 ? nearestRaw : nearestScaled;
      el.innerHTML = `<h1>Who is most like the new candidate?</h1>
        <p class="lead">New candidate N-201: Berlin, 5 years, asks 58,000 EUR. Three past candidates (cities cleaned, salaries in euros):</p>
        ${dataTable(kit, ["id", "city", "years", "salary_eur"], rows, { num: [2, 3], title: "three past candidates" })}
        ${stage < 2 ? `<p class="task">${stage === 0 ? "The distance uses years, salary in euros and the one-hot city columns, <b>not scaled</b>. Which one is nearest?" : `Right: ${kit.esc(nearestRaw)}, at a distance of only ${fmt(D(nearestRaw)[4])}, and almost all of that is the salary gap in euros. Now scale years and salary first. Which one is nearest now?`}</p>` : ""}
        <div class="lpanel">${stage < 2 ? kit.options(CHOICES, { picked: wrong == null ? null : CHOICES.indexOf(wrong), correct: CHOICES.indexOf(right) }) : ""}
        ${wrong != null ? kit.feedback(say(stage, wrong), false) : ""}
        ${stage === 2 ? kit.feedback(`Right: ${kit.esc(nearestScaled)}, same city, same years, a slightly lower ask. Distances from the run:${dataTable(kit, ["id", "unscaled", "scaled"], CHOICES.map(id => [id, fmt(D(id)[4]), D(id)[5].toFixed(3)]), { num: [1, 2] })}Unscaled, a different city adds 1 in two city columns and each year adds 1, next to salary gaps in the thousands: they barely count. Scaling did not make the data better; it decided what “similar” means. Over all ${PAST.length} past candidates the 3 nearest changed from ${[...DIST].sort((a, b) => a[4] - b[4]).slice(0, 3).map(d => d[0]).join(", ")} to ${[...DIST].sort((a, b) => a[5] - b[5]).slice(0, 3).map(d => d[0]).join(", ")}.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = CHOICES[+b.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; stage++; paint(); if (stage === 2) done();
      });
    };
    paint();
  }

  /* 5. The same steps in pandas: a stepped replay of the traced run, with one prediction first. */
  const SHOW = new Set([1, 2, 3, 4, 5, 6, 7, 9]);
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const ran = TRACE[k - 1][0], v = TRACE[k];
      if (v[1] === "r") { fr.push({ ln: 10, cols: v[3], row: v[4], end: true }); continue; }
      if (SHOW.has(ran)) fr.push({ ln: ran, col: TRACE[k - 1][2], cols: v[3], row: v[4] });
    }
    return fr;
  })();
  const SAY = {
    1: "Drop the id: a label, not a fact.",
    2: "<code>.str.strip()</code> removes spaces at both ends, <code>.str.title()</code> makes one capital letter. C-108's “berlin ” is now “Berlin”.",
    3: "<code>.map(EUR_PER)</code> turns each currency into its rate; multiplying gives euros. A blank salary stays blank (NaN times a number is NaN).",
    4: "Write down which rows were blank, <b>before</b> filling them. After line 5 you could no longer tell.",
    5: "<code>fillna</code> puts the median of the column in the blanks. pandas' <code>median()</code> skips blanks by default.",
    6: "The raw salary and the currency have done their job. Drop them.",
    7: "<code>pd.get_dummies</code> replaces <code>city</code> with one 0/1 column per city it finds in <b>this</b> table.",
    9: "Subtract the column's mean, divide by its spread (pandas' <code>std()</code>). 0 now means “typical”."
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const opts = [String(COLS_BEFORE), String(COLS_AFTER - 1), String(COLS_AFTER)];
    const RIGHT = 2;
    const fb = [
      "That is the count before line 7. <code>get_dummies</code> removes the <code>city</code> column but adds one column per city.",
      `Close. It adds one column per city, and there are ${cleanCities.length} after cleaning. (Asking for <code>drop_first=True</code> would make one fewer; this code does not.)`,
      `Right: the ${COLS_BEFORE - 1} other columns plus ${plural(cleanCities.length, "city column")}. Step through to see it happen.`
    ];
    const paint = () => {
      const f = FR[i], locked = ans !== RIGHT;
      const row = f.row ? Object.entries(f.row).map(([k, v]) => `<div>${kit.esc(k)} <b>${kit.esc(v == null ? "NaN" : typeof v === "string" ? q(v) : String(v))}</b></div>`).join("") : "";
      el.innerHTML = `<h1>The same steps in pandas</h1>
        <p class="lead">This function does every treatment you chose, in that order. The run below is real: it was traced line by line on the ${PAST.length} past candidates. The card follows C-108 (“berlin ”, blank salary).</p>
        <p class="task">${locked ? `First predict: after the <code>pd.get_dummies</code> line (line 7) runs, how many columns does <code>table</code> have? Then step through.` : "Step through to the end."}</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>
        <div class="lx-${ID}-code">${kit.code(CODE, f.ln)}</div>
        <p class="lx-${ID}-cap">Lines are counted from the <code>def</code> line, which is line 0. Long lines wrap onto an indented second line; each listing line is still one step.</p>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 || locked ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 || locked ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>rows <b>${PAST.length}</b></span><span>columns <b>${f.cols.length}</b></span>${f.col ? `<span>col <b>${kit.esc(f.col)}</b></span>` : ""}<span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        <div class="lx-${ID}-card" aria-label="row C-108">${row}</div>
        ${locked ? "" : kit.feedback(f.end ? `Done: ${f.cols.length} numeric columns, no blanks, no text. That is what a distance (or any scikit-learn model) can take. scikit-learn's <code>OneHotEncoder</code> and <code>StandardScaler</code> do the jobs of lines 7 to 9 as objects that <b>remember</b> what they learned. (<code>StandardScaler</code> divides by a spread computed over n rows, pandas' <code>std()</code> over n − 1, so its numbers differ a little.) The next screen shows why remembering matters.` : `Line ${f.ln} ran. ${SAY[f.ln]}${f.ln === 9 ? ` (<code>col</code> = ${kit.esc(f.col)}.)` : ""}`)}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. Broken on purpose: the weekly run on three new candidates. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let part = 0, ans = null;
    const causeOpts = [
      "<code>“munich”</code> was not cleaned, so it does not match Munich",
      `<code>get_dummies</code> ran on the ${NEW.length} new rows alone, so it only made columns for the cities in them`,
      "N-202's blank salary broke the model",
      "The model must be fitted again on the new candidates"
    ];
    const fixOpts = [
      "Reindex the new table to the training columns: add the missing columns, filled with 0",
      `Learn the median, the city list, the means and spreads once from the ${PAST.length} past rows, and reuse them for every new row`,
      "Each week, stack the new rows under the past rows and prepare them all together",
      "Drop the city columns, so the columns always match"
    ];
    const cause = [
      `Line 2 cleaned it: the new table has a <code>city_Munich</code> column. Look at what is missing in the error.`,
      `Right. The new rows only contain ${NEW_CITIES.join(" and ")}, so <code>get_dummies</code> made ${plural(NEW_COLS.length, "column")}, not ${TRAIN_COLS.length}. The model was fitted on ${TRAIN_COLS.length} named columns and refuses a table without ${MISSING.join(" and ")}.`,
      "Line 5 filled it, as in training. The error names missing <b>columns</b>, not a missing value.",
      "Fitting again on 3 rows would throw away 12 rows of history. And nothing is wrong with the model: it is the input that has the wrong shape."
    ];
    const fix = [
      `It stops the crash, and here even the neighbours' votes did not change. But look at the numbers. Lines 5 and 9 still computed the median, mean and spread from the ${NEW.length} new rows: N-201's 58,000 EUR became ${PATCHED[0][1].toFixed(3)}, “top of the group”, because it is the highest of three. Measured against the past candidates it is ${FIXED[0][1].toFixed(3)}, a typical ask. Same column names, different meaning.`,
      `Right. Every choice is learned from the training rows once and then only applied. In the run, N-201's salary became ${FIXED[0][1].toFixed(3)} (a typical ask) and N-202's blank got the past median, ${fmt(MEDIAN)} EUR. That is exactly what scikit-learn's <code>fit</code> (learn) and <code>transform</code> (apply) split does, and <code>OneHotEncoder(handle_unknown="ignore")</code> turns a city never seen in training into all zeros instead of an error.`,
      "Then this week's 3 candidates change the median, mean and spread used for everyone, and the same person gets different numbers from week to week. When the new rows are test data, that is the leak from the leakage lesson.",
      "City is a real signal (and the reason for half the cleaning). Dropping a feature to hide a mismatch makes the model worse; it does not fix the step that made the mismatch."
    ];
    const RIGHT = 1;
    const paint = () => {
      el.innerHTML = `<h1>Monday's run crashes</h1>
        <p class="lead">On Monday the agency runs the same <code>prepare()</code> on this week's ${NEW.length} new candidates, then asks the nearest-neighbours model (fitted on the ${PAST.length} prepared past candidates) for a prediction.</p>
        ${dataTable(kit, HEAD.slice(0, 5), NEW.map(r => [r[0], q(r[1]), r[2], r[3] == null ? null : fmt(r[3]), r[4]]), { num: [2, 3], title: "new_candidates.csv" })}
        <pre class="lx-${ID}-pre">new_X = prepare(new)   # new: the 3 rows above\nprint(model.predict(new_X))</pre>
        <pre class="lx-${ID}-pre">${kit.esc(ERROR)}</pre>
        <p class="lx-${ID}-cap">Real output of broken.py (scikit-learn), path shortened with …</p>
        ${part === 0 ? `<p class="task">What is the cause?</p><div class="lpanel">${ask(kit, causeOpts, RIGHT, ans, cause)}</div>`
          : `<div class="lpanel">${kit.feedback(cause[RIGHT], true)}</div><p class="task">Which fix is right?</p><div class="lpanel">${ask(kit, fixOpts, RIGHT, ans, fix)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (part === 0 && ans === RIGHT) { part = 1; ans = null; paint(); return; }
        paint();
        if (part === 1 && ans === RIGHT) done();
      });
    };
    paint();
  }

  /* 7. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Converting the salaries to one currency", "Cleaning the city spellings", "Scaling years and salary"];
    const RIGHT = 2;
    const fb = [
      "A tree asks questions like “salary above 55,000?”. If some salaries are zloty, that question is wrong for those rows, whatever the model. Units are about meaning, not size.",
      "A tree would still see “berlin” and “Berlin” as two different cities and split them apart. Spelling is about meaning too.",
      "Right. A tree splits one column at a time at a threshold, and scaling keeps the order inside a column, so the splits are the same. scikit-learn's docs say tree-based models are (almost) not affected by scaling. Distance models are, and models trained by gradient descent converge more easily on scaled data."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When it matters, and what it costs</h1>
        <p class="lead"><b>For:</b> turning any real table into numbers a model can use.</p>
        <p class="lead"><b>Always:</b> one unit and one spelling per column, and a decision for every blank. <b>Scale</b> for distances (nearest neighbours, clustering) and for models trained by gradient descent, where it helps them converge.</p>
        <p class="lead"><b>Not:</b> scaling for tree models. One-hot for a column with thousands of values: that makes too many mostly-zero columns, so group the values or use another encoding. Filling when a blank itself means something: make a flag instead.</p>
        <p class="lead"><b>Costs:</b> every choice must be learned on training rows only and repeated exactly on every new row, for as long as the model runs. That is code to keep, and a place for silent bugs.</p>
        <p class="task">The agency swaps nearest neighbours for a decision tree. Which step can it skip?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A clinic finds similar patients by distance, using age in years and yearly income in euros. Scale both first?", true,
      "Yes. Income differences run to thousands, age differences to tens. Unscaled, the distance is almost only income, as salary was for N-201.",
      "Without scaling, a 30-year age gap counts less than a 31-euro income gap. A distance needs comparable ranges, so scale both."],
    ["A delivery model has a postcode column with thousands of different values, many seen only once. One-hot it?", false,
      "No. One-hot would add thousands of mostly-zero columns, and a postcode seen once teaches nothing. Group postcodes into regions, or use an encoding built for many values, such as scikit-learn's TargetEncoder.",
      "One-hot works when there are a few values each seen often, like the agency's four cities. Thousands of rare values make thousands of columns the model cannot learn from."],
    ["A column “end date of current job” is blank for everyone still employed there. Fill the blanks with the median date?", false,
      "No. Here a blank is not “unknown”: it means “still in the job”. A median date would invent a job end for exactly those people. Turn it into a flag (still employed: yes/no), and maybe months in the job.",
      "Filling assumes the value exists and was just not written down. Here the blank is the answer itself. Keep it as a flag instead of hiding it."],
    ["A model of loan approvals has a column “contract type” with three values: permanent, fixed-term, freelance. One-hot it?", true,
      "Yes. Three values, each seen often, with no order between them: exactly the case one-hot is for.",
      "Coding them as 1, 2, 3 would invent an order: a distance would put freelance twice as far from permanent as fixed-term is. With only three values, one 0/1 column each is cheap and honest."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Right treatment or not?</h1>
        <p class="lead">Four columns from other jobs, each with a proposed treatment.</p>
        <p class="task">Would you do it? Pick again if you change your mind.</p>
        ${CASES.map(([text, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${text}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next: the notebook and its checklist. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s2-feature-prep.ipynb";
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const checks = [
      `The raw city column prints ${plural(rawCities.length, "different value")}; after <code>.str.strip().str.title()</code> there are ${cleanCities.length}.`,
      `The salaries in euros have a mean of ${fmt(MEAN)} and a median of ${fmt(MEDIAN)}.`,
      `<code>prepare()</code> on the past candidates returns ${PAST.length} rows and ${TRAIN_COLS.length} columns, with no NaN left.`,
      `<code>predict</code> on the separately prepared new rows raises a ValueError naming ${MISSING.join(" and ")}.`,
      `With the median, means and spreads learned from the past rows, N-201's salary becomes ${FIXED[0][1].toFixed(3)}.`
    ];
    el.innerHTML = `<h1>You can prepare a table</h1>
      <p class="lead">You chose a treatment for each column from what it means, saw that units and spellings come before any arithmetic, filled blanks with a median and a flag, watched scaling decide who counts as similar, and fixed a run that prepared new rows on their own.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${NOTEBOOK_URL}" target="_blank" rel="noopener">open the notebook</a>.` : "The notebook for this lesson is on its way."} When you run it, you should see:</p>
      <ul class="lx-${ID}-check">${checks.map(c => `<li><label><input type="checkbox"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The learn-once, apply-everywhere split you just did by hand becomes one scikit-learn object you can fit, tune and rerun.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Feature preparation: missing values, categories, scaling",
    checked: "2026-11-14",
    sources: [
      "https://pandas.pydata.org/docs/reference/api/pandas.get_dummies.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.Series.median.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.reindex.html",
      "https://scikit-learn.org/stable/modules/preprocessing.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OneHotEncoder.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.impute.SimpleImputer.html",
      "https://scikit-learn.org/stable/auto_examples/preprocessing/plot_scaling_importance.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html",
      "https://scikit-learn.org/stable/modules/sgd.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.Series.mean.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.Series.std.html"
    ],
    interview: [
      {
        q: "Your model works in the notebook, but the nightly scoring job crashes with “feature names should match those that were passed during fit”. What happened and how do you fix it for good?",
        good: [
          "The new batch was encoded on its own, so one-hot made only the columns for the categories in that batch",
          "Learn every preparation choice (categories, fill values, means and spreads) on the training data once, and only apply it to new data",
          "Use fitted transformers, for example OneHotEncoder with handle_unknown=\"ignore\" for unseen categories, kept together with the model",
          "Check the numbers too, not only the columns: statistics recomputed on the batch give the same names a different meaning"
        ],
        weak: "Reindex the columns so they match. That stops the crash but keeps fill values and scaling computed on the new batch."
      },
      {
        q: "A salary column has blanks, a few huge values and amounts in several currencies. Walk me through preparing it for a k-nearest-neighbours model.",
        good: [
          "Convert everything to one currency first; no scaler can fix mixed units",
          "Fill the blanks with the median, which one huge value does not move, and add a 0/1 column saying the value was filled",
          "Scale it, because distances otherwise follow whichever column has the biggest numbers",
          "Learn the median, mean and spread on the training rows only and reuse them on new rows"
        ],
        weak: "Fill blanks with 0 and run a scaler. That invents the lowest salary for unknown people and leaves the currencies mixed."
      }
    ],
    screens: [columns, spotIdea, fillBlanks, distances, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: COLS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(FR.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
