/* Lesson: cleaning messy data with pandas. A dental clinic is replacing two old booking systems; their patient
   exports were pasted into one 15-row file that must become one clean table. Ideas: (1) every problem shows up
   as a wrong type, a wrong missing count or a repeated key, so look at those, not at rows; (2) fix with written,
   explicit rules (first from scratch in plain Python, then with pandas load-time parameters), then check before
   you join.
   Depth: explain (screens 1, 2, 9, 10), scratch (3, 4), library (5, 6, 7, 8), debug (6: a real date-parsing
   error; 8: a real join that double-counts).
   Data: every output shown was produced on this Mac with pandas 3.1.1 and copied from
   docs/ai-path/runs/s1-pandas-cleaning/ (patients.csv, visits.csv; explore.py (including the is_unique check), scratch.py, library.py, join.py,
   extra.py and their .out.txt files). The patients are invented. No model API calls were recorded.
   Lesson-local CSS (classes prefixed lx-s1-pandas-cleaning-): a pickable data table, output blocks, checklist.
   Plain browser script. */
(() => {
  const ID = "s1-pandas-cleaning", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s1-pandas-cleaning.ipynb";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = n => Number(n).toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];

  /* ---------- Data: docs/ai-path/runs/s1-pandas-cleaning/patients.csv, cell for cell ---------- */
  const COLS = ["system", "patient_id", "name", "birth_date", "balance"];
  const C = Object.fromEntries(COLS.map((c, i) => [c, i]));
  const RAW = [
    ["A", "1001", "Han Jiwoo", "1985-02-14", "0"],
    ["A", "1002", "Oh Seri", "1979-11-23", "45000"],
    ["A", "1003", "Lim Taeho", "", "12000"],
    ["A", "1004", "Choi Mina", "1990-07-04", "30000"],
    ["A", "1005", "Yoon Dabin", "2001-05-30", "0"],
    ["A", "1006", "Kang Hyun", "1968-09-12", "8000"],
    ["A", "1007", "Seo Yuna", "1995-12-01", "150000"],
    ["A", "1008", "Jang Woo", "1983-04-17", "0"],
    ["A", "1009", "Moon Ara", "1972-08-08", "22000"],
    ["B", "1010", "Baek Sol", "03/06/1999", "18,000"],
    ["B", "1004", "Choi Mina", "04/07/1990", "30,000"],
    ["B", "1011", "Nam Gyu", "21/01/1988", "N/A"],
    ["B", "1012", "Ryu Hana", "15/10/2003", "-"],
    ["B", "1013", "Shin Bom", "30/03/1975", "5,500"],
    ["B", "1014", "Do Eun", "09/11/1992", "72,000"]
  ];
  const NR = RAW.length;
  const DEFAULT_NA = ["", "N/A"];           // two of pandas' default missing markers (read_csv docs); both appear here
  const MISSING_TEXTS = ["", "N/A", "-"];   // the scratch rule, scratch.py line 1
  const isB = r => RAW[r][C.system] === "B";
  const ID_COUNT = RAW.reduce((m, row) => m.set(row[C.patient_id], (m.get(row[C.patient_id]) || 0) + 1), new Map());
  const DUP_ID = [...ID_COUNT].find(([, n]) => n > 1)[0];
  const DUP_ROWS = RAW.map((row, r) => row[C.patient_id] === DUP_ID ? r : -1).filter(r => r >= 0);
  const DUP_NAME = RAW[DUP_ROWS[0]][C.name];

  // The problems a learner must find on screen 1, as groups of cells "r-c", worked out from the data.
  const LABELS = [["miss", "Missing value"], ["text", "Number or date stored as text in another form"], ["dup", "Same patient twice"], ["ok", "Nothing wrong"]];
  const GROUPS = [
    { id: "blank", label: "miss", cells: RAW.map((row, r) => row[C.birth_date] === "" ? `${r}-${C.birth_date}` : null).filter(Boolean),
      say: "A blank birth date: nobody typed it in. pandas reads an empty cell as missing on its own and shows it as NaN (“not a number”, its mark for missing)." },
    { id: "na", label: "miss", cells: RAW.map((row, r) => row[C.balance] === "N/A" ? `${r}-${C.balance}` : null).filter(Boolean),
      say: "“N/A” is system B's way of saying “no value”. It is on pandas' default list of missing markers, so pandas reads it as missing." },
    { id: "dash", label: "miss", cells: RAW.map((row, r) => row[C.balance] === "-" ? `${r}-${C.balance}` : null).filter(Boolean),
      say: "“-” also means “no value” here, but it is not on pandas' default list. pandas would keep it as the text “-”. You will have to tell it." },
    { id: "bdate", label: "text", cells: RAW.map((row, r) => isB(r) ? `${r}-${C.birth_date}` : null).filter(Boolean),
      say: `System B writes dates as day/month/year with slashes; system A writes year-month-day. All ${RAW.filter((_, r) => isB(r)).length} B dates are marked. Until they are turned into real dates, a column with two forms is only text.` },
    { id: "comma", label: "text", cells: RAW.map((row, r) => row[C.balance].includes(",") ? `${r}-${C.balance}` : null).filter(Boolean),
      say: `System B writes balances with a thousands comma, like “${RAW.find(row => row[C.balance].includes(","))[C.balance]}”. To a computer that is text, not a number, until the comma goes. All of them are marked.` },
    { id: "dup", label: "dup", cells: DUP_ROWS.flatMap(r => [`${r}-${C.patient_id}`, `${r}-${C.name}`]),
      say: `Patient ${DUP_ID}, ${DUP_NAME}, is in both systems: rows ${DUP_ROWS.join(" and ")}. One person, two rows. Count her balance twice and the clinic thinks she owes double.` }
  ];
  const GROUP_OF = new Map(GROUPS.flatMap((g, gi) => g.cells.map(k => [k, gi])));
  // why a clean cell is fine, by column
  const cleanWhy = (r, c) => {
    const v = RAW[r][c];
    if (c === C.balance && v === "0") return "0 is a real balance: this patient owes nothing. Missing means “we do not know”; 0 means “we know, and it is zero”. Treating 0 as missing would hide every patient who has paid.";
    if (c === C.balance) return `${v} is a plain whole number, the form system A uses. pandas can read it as a number as it is.`;
    if (c === C.birth_date) return `${v} is year-month-day, system A's form. pandas reads this form as a date without help.`;
    if (c === C.patient_id) return `${v} appears once in the file, so it identifies one patient.`;
    return "A name, written the same way in both systems. Nothing to fix.";
  };

  /* ---------- Real outputs, copied from the run files (not altered) ---------- */
  // explore.py -> explore.out.txt
  const INFO_RAW = ` #   Column      Non-Null Count  Dtype
---  ------      --------------  -----
 0   system      15 non-null     str
 1   patient_id  15 non-null     int64
 2   name        15 non-null     str
 3   birth_date  14 non-null     str
 4   balance     14 non-null     str  `;
  const SUM_RAW = "'04500012000300000800015000002200018,00030,000-5,50072,000'";
  const HEAD_ROWS = 5; // patients.head() printed rows 0 to 4
  // scratch.py -> scratch.out.txt
  const SCRATCH_ALL = [0, 45000, 12000, 30000, 0, 8000, 150000, 0, 22000, 18000, 30000, null, null, 5500, 72000];
  const SAMPLE_ROWS = [0, 9, 11, 12];
  // [line, isReturn, raw, text, digits, cleaned] — the JSON lines from trace_run, line 0 = the def line
  const TRACE = [[1,0,null,null,null,null],[2,0,null,null,null,null],[3,0,null,null,null,[]],[4,0,"0",null,null,[]],[5,0,"0","0",null,[]],[8,0,"0","0",null,[]],[9,0,"0","0","0",[]],[3,0,"0","0","0",[0]],[4,0,"18,000","0","0",[0]],[5,0,"18,000","18,000","0",[0]],[8,0,"18,000","18,000","0",[0]],[9,0,"18,000","18,000","18000",[0]],[3,0,"18,000","18,000","18000",[0,18000]],[4,0,"N/A","18,000","18000",[0,18000]],[5,0,"N/A","N/A","18000",[0,18000]],[6,0,"N/A","N/A","18000",[0,18000]],[7,0,"N/A","N/A","18000",[0,18000,null]],[3,0,"N/A","N/A","18000",[0,18000,null]],[4,0,"-","N/A","18000",[0,18000,null]],[5,0,"-","-","18000",[0,18000,null]],[6,0,"-","-","18000",[0,18000,null]],[7,0,"-","-","18000",[0,18000,null,null]],[3,0,"-","-","18000",[0,18000,null,null]],[10,0,"-","-","18000",[0,18000,null,null]],[10,1,"-","-","18000",[0,18000,null,null]]];
  // library.py -> library.out.txt, section 1
  const INFO_FIXED = ` #   Column      Non-Null Count  Dtype
---  ------      --------------  -----
 0   system      15 non-null     str
 1   patient_id  15 non-null     int64
 2   name        15 non-null     str
 3   birth_date  14 non-null     str
 4   balance     13 non-null     float64`;
  const BAL_FIXED = { dtype: "float64", nonNull: 13, sum: "392500.0" };
  const BAL_INT64 = "Int64"; // section 1b: dtype={"balance": "Int64"} printed Int64 with <NA> for the two missing
  // library.py section 2
  const DATE_ERR = `ValueError: time data "03/06/1999" doesn't match format "%Y-%m-%d". You might want to try:
    - passing \`format\` if your strings have a consistent format;
    - passing \`format='ISO8601'\` if your strings are all ISO8601 but not necessarily in exactly the same format;
    - passing \`format='mixed'\`, and the format will be inferred for each element individually. You might want to use \`dayfirst\` alongside this.`;
  // parsed birth dates, row by row (null = NaT): library.py 3a, 3c, 3d and extra.py "mixed + dayfirst"
  const D_RIGHT = ["1985-02-14","1979-11-23",null,"1990-07-04","2001-05-30","1968-09-12","1995-12-01","1983-04-17","1972-08-08","1999-06-03","1990-07-04","1988-01-21","2003-10-15","1975-03-30","1992-11-09"];
  const D_MIXED = ["1985-02-14","1979-11-23",null,"1990-07-04","2001-05-30","1968-09-12","1995-12-01","1983-04-17","1972-08-08","1999-03-06","1990-04-07","1988-01-21","2003-10-15","1975-03-30","1992-09-11"];
  const D_MIXED_DF = ["1985-02-14","1979-11-23",null,"1990-04-07","2001-05-30","1968-12-09","1995-01-12","1983-04-17","1972-08-08","1999-06-03","1990-07-04","1988-01-21","2003-10-15","1975-03-30","1992-11-09"];
  const D_ONEFMT = [null,null,null,null,null,null,null,null,null,"1999-06-03","1990-07-04","1988-01-21","2003-10-15","1975-03-30","1992-11-09"];
  // library.py section 4: rows removed
  const DEDUP = { raw: 0, cleaned: 0, subset: 1 };
  // join.py -> join.out.txt
  const VISITS_N = 8, FEES_BILLED = 415000;
  const REPORT_BAD = [[1001,"Han Jiwoo","A","cleaning",40000],[1004,"Choi Mina","A","filling",60000],[1004,"Choi Mina","B","filling",60000],[1004,"Choi Mina","A","check-up",20000],[1004,"Choi Mina","B","check-up",20000],[1007,"Seo Yuna","A","crown",150000],[1010,"Baek Sol","B","cleaning",40000],[1012,"Ryu Hana","B","x-ray",25000],[1013,"Shin Bom","B","check-up",20000],[1014,"Do Eun","B","filling",60000]];
  const BY_NAME_BAD = [["Baek Sol",40000],["Choi Mina",160000],["Do Eun",60000],["Han Jiwoo",40000],["Ryu Hana",25000],["Seo Yuna",150000],["Shin Bom",20000]];
  const BY_NAME_FIXED = [["Baek Sol",40000],["Choi Mina",80000],["Do Eun",60000],["Han Jiwoo",40000],["Ryu Hana",25000],["Seo Yuna",150000],["Shin Bom",20000]];
  const FEES_IN_BAD = 495000, REPORT_FIXED_ROWS = 8;
  const MERGE_ERR = `MergeError: Merge keys are not unique in right dataset; not a many-to-one merge

Duplicates in right:
  patient_id
       1004 ...`;
  // extra.py: three readings, one of them the sensor's -999 code
  const SENSOR = { plain: "-329.6666666666667", fixed: "5.0" };

  /* ---------- Lesson-local styles ---------- */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}wrap { max-width: 100%; overflow-x: auto; margin: 12px 0 0; }
      .${P}t { border-collapse: collapse; font: 500 13px/1.3 var(--mono); font-variant-ligatures: none; color: var(--ink); }
      .${P}t th { font: 600 11.5px/1.2 var(--mono); color: var(--muted); text-align: left; padding: 4px 5px; border-bottom: 1.5px solid var(--ink-2); vertical-align: bottom; }
      .${P}t td { padding: 0; border-bottom: 1px solid var(--line); }
      .${P}t td { vertical-align: middle; }
      .${P}t td > span, .${P}t td > button { display: flex; align-items: center; box-sizing: border-box; min-height: 44px; margin: 0; padding: 0 5px; line-height: 1.3; white-space: nowrap; text-align: left; font: inherit; color: inherit; }
      .${P}t td > button { width: 100%; background: transparent; border: 0; border-radius: 0; cursor: pointer; }
      .${P}t td > button:hover { background: var(--sunk); }
      .${P}t td.ix > span { color: var(--muted); padding-right: 6px; }
      .${P}t td.sys > span { color: var(--muted); }
      .${P}t .accent { outline: 3px solid var(--ink); outline-offset: -3px; }
      .${P}t .enter { background: var(--good-soft); box-shadow: inset 0 0 0 1.5px var(--good); }
      .${P}t .no { background: var(--bad-soft); box-shadow: inset 0 0 0 1.5px var(--bad); }
      .${P}t .gone { color: var(--faint); }
      .${P}t .bl { color: var(--faint); }
      .${P}out { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 8px; font: 500 12.5px/1.5 var(--mono); font-variant-ligatures: none; color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}out.pre { white-space: pre; overflow-x: auto; overflow-wrap: normal; }
      .${P}cap { font: 500 12px var(--mono); color: var(--muted); margin: 10px 0 0; }
      .${P}labels { display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px; }
      .${P}labels button { min-height: 48px; text-align: left; padding: 8px 14px; }
      .${P}found { font: 500 14px/1.5 var(--font); color: var(--ink-2); margin: 10px 0 0; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
      @media (max-width: 480px) { .${P}t { font-size: 12px; } .${P}t td > span, .${P}t td > button { padding: 0 3px; } .${P}t th { padding: 4px 3px; font-size: 10.5px; } .${P}out { font-size: 11.5px; } }
    `;
    document.head.appendChild(s);
  }

  /* A data table. rows: arrays of cell text; heads: column titles (HTML allowed);
     opts.cls(r, c) -> state class; opts.pick(r, c) -> bool (cell becomes a button data-c="r-c"); opts.ix: show the row index;
     opts.colCls: per-column td class; opts.rowPick: the whole row picks as data-r. */
  function dataTable(rows, heads, opts = {}) {
    const { cls = () => "", pick = () => false, ix = true, colCls = [], keyOf = (r, c) => `${r}-${c}`, title = "" } = opts;
    return `${title ? `<div class="${P}cap">${esc(title)}</div>` : ""}<div class="${P}wrap"><table class="${P}t"><thead><tr>${ix ? "<th></th>" : ""}${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row, r) =>
      `<tr>${ix ? `<td class="ix"><span>${r}</span></td>` : ""}${row.map((v, c) => {
        const k = cls(r, c) || "", txt = v === "" || v == null ? `<span class="bl" aria-label="blank"></span>` : esc(v);
        const inner = pick(r, c)
          ? `<button type="button" data-c="${keyOf(r, c)}" class="${k}" aria-label="row ${r}, ${esc(String(heads[c]).replace(/<[^>]+>/g, ""))}: ${v === "" ? "blank" : esc(v)}">${v === "" ? "&nbsp;" : esc(v)}</button>`
          : `<span class="${k}">${v === "" ? "&nbsp;" : txt}</span>`;
        return `<td class="${colCls[c] || ""}">${inner}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const HEADS = ["sys&shy;tem", "patient_<wbr>id", "name", "birth_<wbr>date", "bal&shy;ance"];
  const out = (text, pre) => `<div class="${P}out${pre ? " pre" : ""}">${esc(text)}</div>`;

  /* 1. The situation, and the problems found by hand. */
  function byHand({ el, done, kit }) {
    css();
    const found = new Set();
    let sel = null, msg = null;
    const paint = () => {
      const fin = found.size === GROUPS.length;
      const cls = (r, c) => {
        const k = `${r}-${c}`, g = GROUP_OF.get(k);
        if (sel === k) return msg && msg[1] === false ? "no accent" : "accent";
        return g != null && found.has(g) ? "enter" : "";
      };
      el.innerHTML = `<h1>Two booking systems, one patient table</h1>
        <p class="lead">A dental clinic is moving to one new booking system. Its two old systems each exported their patients. Someone pasted both exports into one file. The <code>system</code> column says which system a row came from. The new system will import this table, and later a model that predicts missed appointments will learn from it. Whatever is wrong in it now ends up in both.</p>
        <p class="task">Tap a cell you think is wrong, then say what is wrong with it. Find all ${WORDS[GROUPS.length].toLowerCase()} problems. When one problem covers several cells, finding one marks them all.</p>
        ${dataTable(RAW, HEADS, { cls, pick: (r, c) => !fin && c !== C.system, colCls: ["sys"], title: "patients.csv, as the file has it" })}
        <div class="lpanel">
          ${fin ? "" : sel ? `<p class="${P}found">Row ${sel.split("-")[0]}, <code>${COLS[+sel.split("-")[1]]}</code>: ${RAW[+sel.split("-")[0]][+sel.split("-")[1]] === "" ? "a blank cell" : `“${esc(RAW[+sel.split("-")[0]][+sel.split("-")[1]])}”`}. What is wrong with it?</p>
            <div class="${P}labels">${LABELS.map(([l, t]) => `<button type="button" class="btn" data-l="${l}">${esc(t)}</button>`).join("")}</div>` : `<p class="${P}found">Problems found: ${found.size} of ${GROUPS.length}.</p>`}
          ${fin ? kit.feedback(`All ${GROUPS.length} found. Three kinds of trouble: <b>missing values</b> written three different ways (a blank, “N/A”, “-”), <b>numbers and dates stored as text</b> in a second form, and <b>one patient twice</b>. You read ${NR} rows. The clinic's real export has tens of thousands, so the next screen asks how to find these without reading every cell.`, true)
            : msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => {
        const k = b.dataset.c, g = GROUP_OF.get(k);
        if (g != null && found.has(g)) { sel = null; msg = [`Already found: ${GROUPS[g].say}`]; paint(); return; }
        sel = k; msg = null; paint();
      });
      el.querySelectorAll("button[data-l]").forEach(b => b.onclick = () => {
        const l = b.dataset.l, [r, c] = sel.split("-").map(Number), g = GROUP_OF.get(sel);
        const right = g == null ? "ok" : GROUPS[g].label;
        if (l === right && g == null) { msg = [`Right, nothing wrong. ${cleanWhy(r, c)} Pick another cell.`]; sel = null; paint(); return; }
        if (l === right) { found.add(g); msg = [`${LABELS.find(x => x[0] === l)[1]}. ${GROUPS[g].say}`, true]; sel = null; paint(); if (found.size === GROUPS.length) done(); return; }
        if (g == null) msg = [`This cell is fine. ${cleanWhy(r, c)}`, false];
        else if (l === "ok") msg = [`Look again: ${GROUPS[g].label === "miss" ? "this cell holds no real value." : GROUPS[g].label === "dup" ? `patient ${DUP_ID} has another row in the file.` : "compare it with the same column in system A's rows."}`, false];
        else if (l === "dup") msg = [ID_COUNT.get(RAW[r][C.patient_id]) > 1
          ? `Patient ${RAW[r][C.patient_id]} is in the file twice, but that shows in her id and name, not in this cell. Look at this cell itself: the problem is in its value.`
          : `Patient ${RAW[r][C.patient_id]} appears only once in the file; the problem is in this cell itself.`, false];
        else msg = [GROUPS[g].label === "miss" ? `It is not a value in the wrong form: there is no value at all. ${GROUPS[g].say}`
          : GROUPS[g].label === "dup" ? `The value itself is fine. The problem is that patient ${DUP_ID} has two rows.`
          : `A value is there, so it is not missing. It is written in a form the other system does not use.`, false];
        paint();
      });
    };
    paint();
  }

  /* 2. Spot the idea: look at types, missing counts and keys, not rows. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const headProblems = GROUPS.filter(g => g.label !== "dup" && g.cells.some(k => +k.split("-")[0] < HEAD_ROWS)).length;
    const opts = ["Print the first rows with <code>patients.head()</code> and read them", "Print each column's type and how many values it has, with <code>patients.info()</code>", "Add up the balances with <code>patients[\"balance\"].sum()</code> and see if the total looks right"];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Find them without reading every cell</h1>
        <p class="lead">The real export has tens of thousands of rows. You load it with <code>patients = pd.read_csv("patients.csv")</code>, as in the last lesson. You cannot tap every cell.</p>
        <p class="task">Which one look finds most of the problems you just tapped?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct ? kit.feedback(`Right. Every problem leaves a trace in the column, not just in its cell. Here is what <code>info()</code> printed for this file:`, true)
          + out(INFO_RAW, true) + `<p class="${P}cap">Real output, pandas 3.1.1</p>`
          + kit.feedback(`Read it as a list of suspects. <code>Dtype</code> is the column's type; <code>non-null</code> means “has a value”. <code>birth_date</code> and <code>balance</code> are <code>str</code> (text): a date column and a money column should not be text. Each says 14 non-null, one missing, though you found <b>two</b> missing balances: the “-” counted as a value. And <code>info()</code> cannot see the patient who is there twice. For that, check the <b>key</b>, the column that should name each patient once: <code>patients["patient_id"].is_unique</code> printed <code>False</code>.<br><br>That is the idea of this lesson: <b>a wrong type, a wrong missing count, or a key that repeats</b>. Check those three, then fix them with rules you write down. (On a very large table, <code>info()</code> leaves out the counts unless you pass <code>show_counts=True</code>. Older pandas versions print <code>object</code> where pandas 3 prints <code>str</code>.)`)
          : ans === 0 ? kit.feedback(`<code>head()</code> shows the first ${HEAD_ROWS} rows. Here they are all from system A, and they show ${plural(headProblems, "problem")} (the blank birth date, printed as NaN, pandas' mark for missing). The B rows, where the other problems are, are further down. On a big file, any problem outside the first rows stays hidden.`, false)
          : kit.feedback(`It does go wrong, but it does not say why. The sum came back as text: <code>${esc(SUM_RAW.slice(0, 16))}…</code>, because the column is text, and adding text glues it together. That tells you one column is broken, not which cells, and nothing about dates or the patient who is there twice.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. From scratch: predict what a plain-Python rule does with the balance texts. */
  const RAW_BAL = RAW.map(row => row[C.balance]);
  const N_ZERO = SCRATCH_ALL.filter(v => v === 0).length, N_NONE = SCRATCH_ALL.filter(v => v === null).length;
  const pyVal = v => v === null ? "None" : String(v);
  function scratchPredict({ el, done, kit }) {
    css();
    const i18 = RAW_BAL.indexOf("18,000"), i0 = RAW_BAL.indexOf("0");
    const Q = [
      { q: `The rule, given the text <code>"${RAW_BAL[i0]}"</code>, gives…`, opts: [pyVal(SCRATCH_ALL[i0]), "None"], correct: 0,
        no: ["", `“0” is not on the missing list (“”, “N/A”, “-”), so it goes to <code>int()</code> and stays 0. That is what you want: 0 means the patient owes nothing, a known value.`] },
      { q: `Given <code>"${RAW_BAL[i18]}"</code>, it gives…`, opts: [pyVal(SCRATCH_ALL[i18]), "18", "an error"], correct: 0,
        no: ["", "The rule removes the comma first, so <code>int()</code> sees “18000”, not “18”. A comma here separates thousands; it is not a decimal point.", "<code>int(\"18,000\")</code> would fail, but the rule removes the comma before calling <code>int()</code>."] },
      { q: `Run it on all ${NR} balances. How many come back as <code>None</code>?`, opts: [1, N_NONE, N_NONE + N_ZERO].map(String), correct: 1,
        no: ["“N/A” becomes None, and so does “-”: both are on the missing list. That is the point of writing the list yourself.", "", `That counts the ${N_ZERO} zeros too. A zero is not on the missing list; it comes back as 0.`] }
    ];
    const ans = Q.map(() => null);
    const paint = () => {
      const all = Q.every((q, i) => ans[i] === q.correct);
      el.innerHTML = `<h1>Write the rule yourself first</h1>
        <p class="lead">Before pandas, write the balance rule in plain Python, so you know exactly what a library will do for you. The rule: remove spaces at the ends; if the text is empty, “N/A” or “-”, the value is missing (Python's <code>None</code>); otherwise remove the commas and make it a whole number.</p>
        <p class="task">Predict what the rule gives. Pick again if you change your mind.</p>
        ${Q.map((q, i) => `<div class="lcase" id="c${i}"><p>${q.q}</p>${kit.options(q.opts, { picked: ans[i], correct: q.correct, num: true })}${ans[i] == null ? "" : ans[i] === q.correct ? kit.feedback("Right.", true) : kit.feedback(q.no[ans[i]], false)}</div>`).join("")}
        ${all ? kit.feedback(`All ${NR} cleaned, from the real run: <code>[${SCRATCH_ALL.map(pyVal).join(", ")}]</code>. Leaving out the ${N_NONE} None values, they add up to <b>${fmt(SCRATCH_ALL.reduce((a, v) => a + (v || 0), 0))}</b>, a number this time, not glued text. (${DUP_NAME}'s ${fmt(+RAW[DUP_ROWS[0]][C.balance])} is still in it twice; you remove her second row later in this lesson.)`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (Q.every((q, j) => ans[j] === q.correct)) done();
      }));
    };
    paint();
  }

  /* 4. The rule as Python, stepped through a real trace. */
  const CODE1 = [
    "def clean_balances(raw_balances):",
    "    missing = (\"\", \"N/A\", \"-\")",
    "    cleaned = []",
    "    for raw in raw_balances:",
    "        text = raw.strip()",
    "        if text in missing:",
    "            cleaned.append(None)",
    "            continue",
    "        digits = text.replace(\",\", \"\")",
    "        cleaned.append(int(digits))",
    "    return cleaned"
  ];
  const SAMPLE = SAMPLE_ROWS.map(r => RAW_BAL[r]);
  const pyStr = s => s == null ? "–" : `"${s}"`;
  const pyList = l => l == null ? "–" : `[${l.map(pyVal).join(", ")}]`;
  const SAY1 = TRACE.map(([ln, ret, raw, text, digits, cleaned]) => {
    if (ret) return `It returns <code>${esc(pyList(cleaned))}</code>: a number where there was a number, None where nothing was known.`;
    if (ln === 1) return "<code>missing</code> lists the three texts that mean “no value” in this file. You chose them by reading the data.";
    if (ln === 2) return "<code>cleaned</code> starts as an empty list. One value goes in for every text.";
    if (ln === 3) return cleaned.length === 0 ? `Start the loop over the ${SAMPLE.length} texts.` : `Back to the loop: ${cleaned.length < SAMPLE.length ? "the next text" : "no texts left"}.`;
    if (ln === 4) return `<code>raw</code> is <code>${esc(pyStr(raw))}</code>. <code>strip()</code> removes spaces at the ends (there are none here).`;
    if (ln === 5) return `Is <code>${esc(pyStr(text))}</code> one of the missing texts? ${MISSING_TEXTS.includes(text) ? "Yes." : "No."}`;
    if (ln === 6) return "It is: append <code>None</code>, Python's “no value”. Not 0: the clinic does not know this balance.";
    if (ln === 7) return "<code>continue</code> skips the rest of the loop body and goes straight to the next text.";
    if (ln === 8) return `Not missing, so it is a number written as text. Remove the commas from <code>${esc(pyStr(text))}</code> and keep the result in <code>digits</code>.`;
    if (ln === 9) return `<code>digits</code> is <code>${esc(pyStr(digits))}</code>. <code>int()</code> makes it the number ${Number(digits)}, which goes into <code>cleaned</code>.`;
    if (ln === 10) return "No texts left: the loop ends and the return line runs next.";
    return "";
  });
  function scratchCode({ el, done, kit }) {
    css();
    let i = 0;
    const paint = () => {
      const [ln, , raw, text, digits, cleaned] = TRACE[i];
      const at = cleaned && [4, 5, 6, 8, 9].includes(ln) ? cleaned.length : -1;
      const cls = {};
      SAMPLE.forEach((_, j) => { cls[j] = cleaned && j < cleaned.length ? "in" : j === at ? "next" : ""; });
      el.innerHTML = `<h1>The same rule, written as Python</h1>
        <p class="lead">Four balance texts from the file (rows ${SAMPLE_ROWS.join(", ")}), run through the rule. This replays a real run: at each step the highlighted line is about to run, and the variables are as they are at that moment.</p>
        <p class="task">Step through the code to the end. Watch what goes into <code>cleaned</code>.</p>
        ${kit.cells(SAMPLE, { cls, labels: SAMPLE_ROWS.map(r => `row ${r}`) })}
        ${kit.code(CODE1, ln)}
        <div class="vars"><span>raw <b>${esc(pyStr(raw))}</b></span><span>text <b>${esc(pyStr(text))}</b></span><span>digits <b>${esc(pyStr(digits))}</b></span><span>cleaned <b>${esc(pyList(cleaned))}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(SAY1[i])}
        ${i === TRACE.length - 1 ? kit.feedback(`This is <b>data cleaning</b>: turn every value into the type its column should have, and turn every way of writing “unknown” into one missing value. Writing it by hand costs a function per column and per format. pandas has the same rules built into how it reads a file; you only tell it the parts that are special to your data.`) : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 5. The library: the same rule as two read_csv parameters. Predict the balance column. */
  const CODE2 = [
    "patients = pd.read_csv(",
    "    \"patients.csv\",",
    "    na_values=[\"-\"],  # \"-\" is missing too",
    "    thousands=\",\",    # 18,000 -> 18000",
    ")",
    "patients.info()"
  ];
  function libraryLoad({ el, done, kit }) {
    css();
    const nonNullOpts = [BAL_FIXED.nonNull, BAL_FIXED.nonNull + 1, NR].map(String);
    const typeOpts = ["int64", "float64", "str"];
    const Q = [
      { q: "How many non-null values does <code>balance</code> have now?", opts: nonNullOpts, correct: 0,
        no: ["", `That is the count before: “-” read as text. With <code>na_values=["-"]</code> it is missing too. Your extra markers are added to pandas' own list (blank, “N/A” and others), not put in its place.`, `The blank and “N/A” are on pandas' default list of missing markers, and “-” is now on it too. Not all ${NR} rows have a value.`] },
      { q: "And its type?", opts: typeOpts, correct: 1,
        no: [`Every balance is a whole number, but two are missing, and a plain <code>int64</code> column has no way to hold a missing value. pandas stores the missing ones as NaN, which is a decimal (float) value, so the whole column becomes <code>float64</code>.`, "", `<code>thousands=","</code> lets pandas read “18,000” as a number, and “-” is now missing, so nothing in the column is text any more.`] }
    ];
    const ans = Q.map(() => null);
    const paint = () => {
      const all = Q.every((q, i) => ans[i] === q.correct);
      el.innerHTML = `<h1>The same rule, as two pandas settings</h1>
        <p class="lead"><code>read_csv</code> already turns a blank and “N/A” into missing (NaN) and reads plain numbers as numbers. You add only what is special to this file: “-” also means missing, and a comma separates thousands.</p>
        ${kit.code(CODE2, -1)}
        <p class="task">Predict what <code>info()</code> now says about <code>balance</code>.</p>
        ${Q.map((q, i) => `<div class="lcase" id="c${i}"><p>${q.q}</p>${kit.options(q.opts, { picked: ans[i], correct: q.correct, num: true })}${ans[i] == null ? "" : ans[i] === q.correct ? kit.feedback("Right.", true) : kit.feedback(q.no[ans[i]], false)}</div>`).join("")}
        ${all ? out(INFO_FIXED, true) + `<p class="${P}cap">Real output, pandas 3.1.1</p>` + kit.feedback(`<code>balance</code>: ${BAL_FIXED.nonNull} non-null, <code>${BAL_FIXED.dtype}</code>, and its sum is now <code>${BAL_FIXED.sum}</code>, the same total as your Python rule (${DUP_NAME}'s balance still counted twice, until her second row goes). If whole numbers matter, ask for pandas' integer type that can hold a missing value: <code>dtype={"balance": "${BAL_INT64}"}</code> printed the type <code>${BAL_INT64}</code> with <code>&lt;NA&gt;</code> in the two missing cells. <code>birth_date</code> is still text. That is next.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (Q.every((q, j) => ans[j] === q.correct)) done();
      }));
    };
    paint();
  }

  /* 6. Broken on purpose: to_datetime fails. Find where its format came from, then pick the fix. */
  const DATE_ROWS = RAW.map(row => [row[C.system], row[C.patient_id], row[C.birth_date]]);
  const FIRST_DATE = RAW.findIndex(row => !DEFAULT_NA.includes(row[C.birth_date]));
  const FAIL_ROW = RAW.findIndex(row => row[C.birth_date] === DATE_ERR.match(/"([^"]+)"/)[1]);
  const diffRows = arr => arr.map((d, r) => d !== D_RIGHT[r] ? r : -1).filter(r => r >= 0);
  const swapped = arr => diffRows(arr).filter(r => arr[r] != null);
  const lost = arr => diffRows(arr).filter(r => arr[r] == null);
  const rowsTxt = rs => rs.length === 1 ? `row ${rs[0]}` : `rows ${rs.slice(0, -1).join(", ")} and ${rs[rs.length - 1]}`;
  const showDate = (arr, r) => arr[r] == null ? "NaT" : arr[r];
  const FIXES = [
    { code: `pd.to_datetime(dates, format="mixed")`, arr: D_MIXED },
    { code: `pd.to_datetime(dates, format="mixed", dayfirst=True)`, arr: D_MIXED_DF },
    { code: `pd.to_datetime(dates, format="%d/%m/%Y", errors="coerce")`, arr: D_ONEFMT },
    { code: `from_a = pd.to_datetime(dates, format="%Y-%m-%d", errors="coerce")\nfrom_b = pd.to_datetime(dates, format="%d/%m/%Y", errors="coerce")\nfrom_a.fillna(from_b)`, arr: D_RIGHT }
  ];
  const FIX_RIGHT = 3;
  const fixSay = f => {
    const sw = swapped(f.arr), ls = lost(f.arr);
    if (sw.length) return `It runs without an error, and that is the trap. It guesses each date on its own, and it guessed wrong for ${rowsTxt(sw)}: ${sw.map(r => `row ${r} became ${showDate(f.arr, r)} instead of ${D_RIGHT[r]}`).join("; ")}. Patient ${DUP_ID} now has ${f.arr[DUP_ROWS[0]] === f.arr[DUP_ROWS[1]] ? "one" : "two different"} birthdays. ${sw.every(r => !isB(r))
      ? `<code>dayfirst=True</code> is applied to every value, not only the slashed ones, so it also swapped day and month in system A's year-first dates such as ${RAW[sw[sw.length - 1]][C.birth_date]}. The documentation warns that <code>dayfirst</code> is not strict: it only prefers the day first.`
      : "A date like 04/07 can be read both ways, and no guess can know which one the system meant."}`;
    return `No error, but ${ls.every(r => !isB(r)) && ls.length === RAW.filter((row, r) => !isB(r) && row[C.birth_date] !== "").length ? `all ${ls.length} system A dates` : plural(ls.length, "date")} silently became NaT (missing), on top of the one real blank. Only system B's dates survived. <code>errors="coerce"</code> turns whatever does not match into missing, so on its own it hides the problem instead of fixing it.`;
  };
  function brokenDates({ el, done, kit }) {
    css();
    let pickedRow = null, rowOk = false, fix = null;
    const paint = () => {
      const fin = fix === FIX_RIGHT;
      const cls = (r) => r === pickedRow ? (rowOk ? "enter" : "no") : r === FAIL_ROW && rowOk ? "accent" : "";
      el.innerHTML = `<h1>Broken on purpose: the dates</h1>
        <p class="lead">You turn the birth dates into real dates with <code>pd.to_datetime(patients["birth_date"])</code>. It stops with this error (the real message):</p>
        ${out(DATE_ERR)}
        ${rowOk ? "" : `<p class="task">The message says pandas expected the form <code>%Y-%m-%d</code> (year-month-day). Nobody told it that. Tap the row it took that form from.</p>`}
        ${dataTable(DATE_ROWS, [HEADS[0], HEADS[1], HEADS[3]], { cls: (r) => cls(r), pick: (r, c) => !rowOk && c === 2, keyOf: (r) => r, colCls: ["sys"], title: "patients, birth_date still text" })}
        <div class="lpanel">
        ${!rowOk ? (pickedRow == null ? "" : kit.feedback(
            pickedRow === FAIL_ROW ? `Row ${FAIL_ROW} is where it <b>failed</b>, not where the form came from. Look at what pandas expected and find the row that taught it that.`
            : RAW[pickedRow][C.birth_date] === "" ? "A blank is read as missing (NaT, “not a time”, the missing mark for dates) and skipped. It cannot teach pandas a form."
            : isB(pickedRow) ? `Row ${pickedRow} is written day/month/year, not the form in the message.`
            : `Row ${pickedRow} is written that way, but so are other rows. pandas looked at only one of them.`, false))
          : `${kit.feedback(`Right: row ${FIRST_DATE}, the first date that is not missing. Since pandas 2.0, <code>to_datetime</code> takes one form from the first non-missing value and uses it for the whole column, so it does not switch forms between rows. Row ${FAIL_ROW} is the first row in the other form, so it fails there. The cause is two forms in one column.`, true)}
            <p class="task">Patient ${DUP_ID} is in both systems: A wrote ${RAW[DUP_ROWS[0]][C.birth_date]}, B wrote ${RAW[DUP_ROWS[1]][C.birth_date]}, so B puts the day first. <code>dates</code> is <code>patients["birth_date"]</code>. Which fix is right? Each one was run; pick one and see what it did (NaT means a missing date).</p>
            ${kit.options(FIXES.map(f => `<code>${esc(f.code).replace(/\n/g, "<br>")}</code>`), { picked: fix, correct: FIX_RIGHT })}
            ${fix == null ? "" : fin ? kit.feedback(`Right. Each system's dates are read with that system's own form, written down in the code. A date that does not fit becomes NaT for a moment, and <code>fillna</code> fills it from the other system's reading. Result: ${plural(D_RIGHT.filter(d => d == null).length, "NaT")}, the row that really was blank, and patient ${DUP_ID} has the same birthday in both rows (${D_RIGHT[DUP_ROWS[0]]}). The type is now a real date (<code>datetime64</code>).`, true)
              : kit.feedback(fixSay(FIXES[fix]), false)}`}
        </div>`;
      el.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => {
        pickedRow = +b.dataset.c; rowOk = pickedRow === FIRST_DATE; paint();
      });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === FIX_RIGHT) done(); });
    };
    paint();
  }

  /* 7. Duplicates: predict what drop_duplicates removes, before and after cleaning. */
  function duplicates({ el, done, kit }) {
    css();
    const [ra, rb] = DUP_ROWS, A = RAW[ra], B = RAW[rb];
    const diffCols = COLS.filter((_, c) => A[c] !== B[c]);
    const SUBSET = ["patient_id", "name", "birth_date", "balance"];
    const Q = [
      { q: "On the raw file, <code>patients.drop_duplicates()</code> removes how many rows?", v: DEDUP.raw,
        right: `Rows ${ra} and ${rb} differ as text in ${diffCols.length} columns: ${diffCols.map(c => `<code>${c}</code>`).join(", ")}. By default <code>drop_duplicates</code> drops a row only if every column is equal.`,
        wrong: `To you they are the same patient. To pandas, rows ${ra} and ${rb} differ in ${diffCols.map(c => `<code>${c}</code>`).join(", ")}: “${A[C.birth_date]}” and “${B[C.birth_date]}” are different texts. By default it drops a row only if every column is equal.`,
        two: `Rows ${ra} and ${rb} differ in ${diffCols.map(c => `<code>${c}</code>`).join(", ")}, and by default a row is dropped only if every column is equal. And even when two rows do match, <code>drop_duplicates</code> keeps the first copy (<code>keep="first"</code> is the default); it drops both only if you pass <code>keep=False</code>.` },
      { q: "After the balance and date fixes, <code>patients.drop_duplicates()</code> removes…", v: DEDUP.cleaned,
        right: `Still none. The dates and balances now match, but <code>system</code> does not: ${A[C.system]} and ${B[C.system]}.`,
        wrong: `The dates and balances match now, but the rows still differ in <code>system</code> (${A[C.system]} and ${B[C.system]}), and by default every column counts.`,
        two: `The rows still differ in <code>system</code> (${A[C.system]} and ${B[C.system]}), and by default every column counts. And even when two rows do match, <code>drop_duplicates</code> keeps the first copy (<code>keep="first"</code> is the default); it drops both only if you pass <code>keep=False</code>.` },
      { q: `After the fixes, <code>patients.drop_duplicates(subset=[${SUBSET.map(s => `"${s}"`).join(", ")}])</code> removes…`, v: DEDUP.subset,
        right: `One. <code>subset</code> says which columns identify a patient; <code>system</code> is left out because it only says where the row came from.`,
        wrong: `With <code>subset</code>, pandas compares only those columns, and after the fixes rows ${ra} and ${rb} agree in all of them. It keeps the first and drops the other.`,
        two: `With <code>subset</code>, rows ${ra} and ${rb} now match, but <code>drop_duplicates</code> keeps the first copy (<code>keep="first"</code> is the default) and drops only the other. It drops both only if you pass <code>keep=False</code>.` }
    ];
    const ans = Q.map(() => null);
    const paint = () => {
      const all = Q.every((q, i) => ans[i] === q.v);
      el.innerHTML = `<h1>Remove the patient who is there twice</h1>
        <p class="lead">pandas has <code>drop_duplicates()</code>: it drops rows that repeat an earlier row. These are the two rows for patient ${DUP_ID}, as the file has them:</p>
        ${dataTable([A, B], HEADS, { ix: false, colCls: ["sys"] })}
        <p class="task">Predict each count. Pick again if you change your mind.</p>
        ${Q.map((q, i) => `<div class="lcase" id="c${i}"><p>${q.q}</p>${kit.options(["0", "1", "2"], { picked: ans[i], correct: q.v, num: true })}${ans[i] == null ? "" : kit.feedback(ans[i] === q.v ? q.right : ans[i] === 2 ? q.two : q.wrong, ans[i] === q.v)}</div>`).join("")}
        ${all ? kit.feedback(`All three are the real counts: ${DEDUP.raw}, ${DEDUP.cleaned}, ${DEDUP.subset}. Two habits follow. <b>Fix the types first</b>: duplicates hide behind different spellings. And <b>find duplicates by the key</b> before dropping any: <code>patients[patients["patient_id"].duplicated(keep=False)]</code> shows both rows, so you can check that they agree. If the two systems had different balances for her, no setting could choose; someone at the clinic must say which system to trust.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (Q.every((q, j) => ans[j] === q.v)) done();
      }));
    };
    paint();
  }

  /* 8. Broken on purpose: a join made before the duplicate was removed. */
  const BAD_NAME = BY_NAME_BAD.find(([n, v]) => v !== BY_NAME_FIXED.find(x => x[0] === n)[1])[0];
  function brokenJoin({ el, done, kit }) {
    css();
    let pickedName = null, cause = null;
    const CAUSES = [
      `<code>how="left"</code> adds extra rows`,
      `Patient ${DUP_ID} is in <code>patients</code> twice, so each of her visits matched two rows`,
      `<code>visits.csv</code> lists her twice by mistake`
    ];
    const CAUSE_RIGHT = 1;
    const herVisits = REPORT_BAD.filter(r => r[0] === +DUP_ID);
    const paint = () => {
      const nameOk = pickedName === BAD_NAME, fin = cause === CAUSE_RIGHT;
      el.innerHTML = `<h1>Broken on purpose: the monthly report</h1>
        <p class="lead">A colleague built the fee report before the duplicate was removed. <code>visits.csv</code> has ${VISITS_N} visits this month, one row each, worth ${fmt(FEES_BILLED)} in fees. A <b>merge</b> is a join, as in SQL: for each visit, find every row in <code>patients</code> with the same <code>patient_id</code> and copy its columns across, much like filtering an array for every item with that id.</p>
        ${kit.code(["report = visits.merge(", "    patients, on=\"patient_id\", how=\"left\")", "report.groupby(\"name\")[\"fee\"].sum()"], -1)}
        <p class="lead">The report has <b>${REPORT_BAD.length} rows</b> and its fees add up to <b>${fmt(FEES_IN_BAD)}</b>, ${fmt(FEES_IN_BAD - FEES_BILLED)} more than was billed. The per-patient totals it printed:</p>
        ${!nameOk ? `<p class="task">Tap the patient whose total is wrong.</p>` : ""}
        ${dataTable(BY_NAME_BAD.map(([n, v]) => [n, fmt(v)]), ["name", "fees"], { ix: false, pick: (r, c) => !nameOk && c === 0, keyOf: r => r, cls: r => BY_NAME_BAD[r][0] === pickedName ? (nameOk ? "enter" : "no") : "" })}
        <div class="lpanel">
        ${!nameOk ? (pickedName == null ? "" : kit.feedback(`${esc(pickedName)} has one visit in <code>visits.csv</code>, and the report shows it once. Look for the total that is bigger than the visits behind it.`, false))
          : `${kit.feedback(`Right: ${esc(BAD_NAME)}. The report's rows for her:`, true)}
            ${dataTable(herVisits.map(r => [r[2], r[3], fmt(r[4])]), ["system", "treat&shy;ment", "fee"], { ix: false })}
            <p class="task">She had ${herVisits.length / 2} visits. Why are there ${herVisits.length} rows?</p>
            ${kit.options(CAUSES, { picked: cause, correct: CAUSE_RIGHT })}
            ${cause == null ? "" : fin ? kit.feedback(`Right. A merge copies a visit once for <b>every</b> matching row, and she has two: one from system A, one from B. Nothing failed; the totals were just wrong. Two fixes, and the second is the habit: remove the duplicate first, and tell the merge what shape you expect. <code>validate="many_to_one"</code> means “many visits per patient, one row per patient”. On the table with the duplicate it stops with:`, true)
                + out(MERGE_ERR) + kit.feedback(`After <code>drop_duplicates</code> the same merge passes the check: ${REPORT_FIXED_ROWS} rows, one per visit, ${fmt(FEES_BILLED)} in fees, and ${esc(BAD_NAME)} at ${fmt(BY_NAME_FIXED.find(x => x[0] === BAD_NAME)[1])}. A quick check after any join: the row count. It should be what you expect (here, one per visit).`)
              : cause === 0 ? kit.feedback(`<code>how="left"</code> keeps every visit, even one with no matching patient. It does not copy a visit by itself: with one patient row per id, a left merge gives one row per visit.`, false)
              : kit.feedback(`The two rows in <code>visits.csv</code> are two different treatments (${herVisits.filter((_, j) => j % 2 === 0).map(r => r[3]).join(" and ")}), so both belong in the report. The extra rows differ in <code>system</code>: they came from the patients table.`, false)}`}
        </div>`;
      el.querySelectorAll("button[data-c]").forEach(b => b.onclick = () => { pickedName = BY_NAME_BAD[+b.dataset.c][0]; paint(); });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { cause = +b.dataset.i; paint(); if (cause === CAUSE_RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. Task: which cost bites first. */
  function bigPicture({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "pandas gets too slow for a table of this size",
      "System B changes its date form one night, and <code>errors=\"coerce\"</code> quietly turns every B birth date into NaT",
      "The day spent writing the rules is wasted the first time the data changes"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>When to clean with pandas, and what it costs</h1>
        <p class="lead"><b>What for:</b> turning exports, form data and logs into a table whose types, missing values and keys you can trust, before a report, a join or a model reads it.</p>
        <p class="lead"><b>Reach for it</b> when the table fits in memory and the fixes are rules you can write down and run again. <b>Not</b> when the data is bigger than memory (pandas holds the whole table in memory; read it in chunks or let a database do the work), when you control the source (fix the form or the export instead), or when a fix needs a person to decide (two balances for one patient).</p>
        <p class="lead"><b>Costs:</b> your time to learn each source's habits; rows silently dropped or turned into missing; and rules that go stale when a source changes.</p>
        <p class="task">The export now arrives every night and feeds the model. Which cost hurts first?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct ? kit.feedback(`Right. Nothing crashes, the model keeps training, and a whole system's birth dates are gone. A cleaning script that runs on its own needs checks that fail loudly: the number of missing dates no higher than the number of blanks, <code>patient_id</code> unique, <code>validate=</code> on every merge, the expected row count after each step.`, true)
          : ans === 0 ? kit.feedback(`The whole clinic is tens of thousands of rows, which fits in memory easily. Speed is not where this breaks. The danger is a rule that stops matching the data and nobody notices.`, false)
          : kit.feedback(`The rules are written down, so they can be changed and run again; that is their value. The cost is the opposite: the script keeps running after its rules stop matching the data, and nobody notices.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, with two "no" cases. */
  const CASES = [
    [`A weather station's CSV has <code>-999</code> wherever a sensor failed. You average the temperatures for each month.`, true,
      `Yes. -999 is a missing marker in disguise: tell <code>read_csv</code> with <code>na_values=[-999]</code>. On a three-reading test, the mean was ${SENSOR.plain} without it and ${SENSOR.fixed} with it.`,
      `It is the “-” problem again. -999 means “no reading”, but pandas reads it as a number and it drags the average down: on a three-reading test the mean was ${SENSOR.plain} without <code>na_values=[-999]</code> and ${SENSOR.fixed} with it.`],
    ["Sales per customer come out higher than the money that came in. The report joins orders to a customers table.", true,
      "Yes. The same customer is probably in the customers table twice, so each order is copied. Check that the key is unique, merge with <code>validate=\"many_to_one\"</code>, and compare row counts before and after.",
      "This is the clinic's report again: more money out of a join than went in means a key repeats on the side that should have one row per key. Check <code>is_unique</code> and merge with <code>validate=\"many_to_one\"</code>."],
    ["Your own sign-up form has a free-text birthday box. New sign-ups arrive all day, written every way people like.", false,
      "No, not as the main fix. You own the form, so fix the source: a date field that accepts one form. Cleaning afterwards means guessing, and you saw that 04/07 cannot be guessed: format=\"mixed\" got it wrong both ways.",
      "Cleaning it every night would work some of the time, but you own the form, so fix the source: a date field that accepts one form. Cleaning afterwards means guessing, and 04/07 cannot be guessed; format=\"mixed\" got it wrong both ways."],
    ["Two shops merged their customer lists. Customer 5521 is in both, with two different delivery addresses, and tomorrow's parcel must go to one of them.", false,
      "No. pandas can show you the conflict (<code>duplicated(keep=False)</code> lists both rows), but no rule knows which address is current. A person has to decide, for example by asking the customer.",
      "A rule would run, but it would choose blindly: <code>drop_duplicates</code> on the customer id keeps whichever row comes first, not the right address. pandas finds the conflict; a person has to settle it, for example by asking the customer."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Clean it with pandas here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the clinic.</p>
        <p class="task">For each one, is loading it into pandas and cleaning it with rules the right fix? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist, from our own run of the same code. */
  function whatNext({ el, done, topic }) {
    css();
    const nx = topic && topic.next;
    const CHECK = [
      `After a plain <code>pd.read_csv("patients.csv")</code>, <code>patients.info()</code> lists <code>birth_date</code> and <code>balance</code> as <code>str</code>, each with 14 non-null values.`,
      `<code>patients["balance"].sum()</code> returns a long text starting <code>${esc(SUM_RAW.slice(0, 12))}</code>, not a number.`,
      `With <code>na_values=["-"]</code> and <code>thousands=","</code>, <code>balance</code> is <code>${BAL_FIXED.dtype}</code> with ${BAL_FIXED.nonNull} non-null values, and its sum is <code>${BAL_FIXED.sum}</code>.`,
      `<code>pd.to_datetime(patients["birth_date"])</code> raises a <code>ValueError</code> about “${esc(RAW[FAIL_ROW][C.birth_date])}”; reading each system with its own <code>format</code> leaves exactly ${D_RIGHT.filter(d => d == null).length} NaT.`,
      `The merge before removing the duplicate gives ${REPORT_BAD.length} rows from ${VISITS_N} visits; after <code>drop_duplicates(subset=...)</code> it gives ${REPORT_FIXED_ROWS}, and <code>validate="many_to_one"</code> passes.`
    ];
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now say what cleaning is (one type per column, one way of saying “unknown”, one row per key), find problems from <code>info()</code> and a uniqueness check instead of reading rows, write the rule by hand, give it to pandas as <code>read_csv</code> and <code>to_datetime</code> settings, and catch a bad join with a row count and <code>validate</code>.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a>.` : "The notebook for this lesson is on its way."} It runs the same cleaning on the same clinic file. What you should see, from our run of the same code:</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. A clean row is where a model's input starts: each thing becomes a list of numbers, and that lesson measures how far apart two such lists are.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Cleaning messy data with pandas",
    checked: "2026-11-14",
    sources: [
      "https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.to_datetime.html",
      "https://pandas.pydata.org/docs/whatsnew/v2.0.0.html",
      "https://pandas.pydata.org/docs/whatsnew/v3.0.0.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.info.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.drop_duplicates.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.merge.html",
      "https://pandas.pydata.org/docs/user_guide/missing_data.html",
      "https://pandas.pydata.org/docs/user_guide/scale.html"
    ],
    interview: [{
      q: "You inherit a training table built by joining three CSV exports. Counts per customer are higher than in the source system. How do you find the cause and stop it happening again?",
      good: ["Compare row counts before and after each join to find the step where rows multiply",
        "Check that the key is unique on the side that should have one row per key (is_unique, or duplicated(keep=False) to see the rows)",
        "Clean types first, then remove duplicates on the columns that identify a record, since the copies often differ in spelling or a source column",
        "Merge with validate=\"many_to_one\" (or the shape you expect) so the pipeline fails loudly next time"],
      weak: "Call drop_duplicates() on the final table. It compares every column, so copies that differ in spelling or a source column stay, and the cause in the join is never found."
    }, {
      q: "A date column comes from two systems: one writes 2024-03-05, the other 05/03/2024. How do you parse it, and how do you know you got it right?",
      good: ["Find out each system's form, for example from a record that is in both systems",
        "Parse each form with an explicit format and errors=\"coerce\", then combine the two results",
        "Check that the number of missing dates after parsing equals the number of blanks before",
        "Avoid format=\"mixed\": it guesses per value and can swap day and month without any error"],
      weak: "Use format=\"mixed\" because the error message suggests it. It runs, but dates like 04/07 can come out with day and month swapped and nothing warns you."
    }],
    screens: [byHand, spotIdea, scratchPredict, scratchCode, libraryLoad, brokenDates, duplicates, brokenJoin, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-c="0-${C.balance}"]`, '[data-l="miss"]'], right: GROUPS.flatMap(g => [`[data-c="${g.cells[0]}"]`, `[data-l="${g.label}"]`]) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: [0, 1, 2].map(i => `#c${i} [data-right]`) },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: [`[data-c="${FAIL_ROW}"]`], right: [`[data-c="${FIRST_DATE}"]`, "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: [0, 1, 2].map(i => `#c${i} [data-right]`) },
      { wrong: [`[data-c="0"]`], right: [`[data-c="${BY_NAME_BAD.findIndex(x => x[0] === BAD_NAME)}"]`, "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
