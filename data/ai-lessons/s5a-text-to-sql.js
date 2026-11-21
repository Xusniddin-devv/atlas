/* Lesson: questions over tables, text-to-SQL and a semantic layer. Story: a bakery chain's owner asks "which branch
   sold the most croissants last month?" of the sales database instead of waiting for a weekly report.
   Ideas: (1) a model can write SQL from a described schema, and a program checks it (SELECT only, compiles, one
   statement, read-only connection) before running it, but those checks cannot tell a valid query from a right one;
   (2) a semantic layer of named, reviewed metrics lets the model pick names while code writes the SQL.
   Data, all real:
   - docs/ai-path/runs/s5a-text-to-sql/build_db.py builds bakery.db (made-up data, seeded); build_db.out.txt;
   - recordings (main checkout) docs/ai-path/recordings/s5a-text-to-sql/q1..q12: one owner question each, the model
     writes SQL against the schema description in make_requests.py. The lesson shows five: q2, q1, q10, q11, q3
     (chosen from the twelve so that two are wrong; the others not shown include more BETWEEN date filters);
   - run_queries.py + run_queries.out.txt: every recorded query run on bakery.db next to a reference query written
     by us, the evidence rows, and the three fixes for q11, each run;
   - pipeline.py + pipeline.out.txt: answer() traced line by line on q1, then four test strings written by us, then
     the read-only backstop;
   - recordings layer-1, layer-2 (the model picks metric, group_by, month from a semantic layer, JSON schema output)
     and layer.py + layer.out.txt: the compiled SQL and its rows, plus the two wrong metric definitions, run.
   Lesson-local style: SQL blocks, result grids and clickable SQL lines (.lx-s5a-text-to-sql-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s5a-text-to-sql";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const money = v => v.toFixed(2);

  /* ---------- Data copied from the runs and recordings ---------- */
  // The schema description the model saw (make_requests.py SCHEMA). sold_at is described as "the date of the sale".
  const SCHEMA = [
    ["branches", "branch_id INTEGER PRIMARY KEY, name TEXT, city TEXT", ""],
    ["products", "product_id INTEGER PRIMARY KEY, name TEXT, category TEXT", "category is one of: croissant, pastry, bread, drink"],
    ["sales", "sale_id INTEGER PRIMARY KEY, branch_id INTEGER REFERENCES branches, sold_at TEXT, total REAL", "one row per receipt; sold_at is the date of the sale; total is the receipt total"],
    ["sale_items", "sale_id INTEGER REFERENCES sales, product_id INTEGER REFERENCES products, qty INTEGER, unit_price REAL", "one row per product line on a receipt"]
  ];
  const TODAY = "2026-11-17"; // in the system prompt
  const CROISSANTS = [[1, "Butter croissant"], [2, "Almond croissant"]]; // build_db.py PRODUCTS, category croissant

  // From docs/ai-path/recordings/s5a-text-to-sql/<src>.json: the reply text, with the ``` fence lines cut, not altered.
  // rows: the query's result on bakery.db, and ref: the reference query's result (run_queries.out.txt).
  const REC = {
    q2: { q: "What was the total revenue of each branch last month?", ok: true,
      sql: ["SELECT","  b.name,","  SUM(si.qty * si.unit_price) AS total_revenue","FROM branches AS b","JOIN sales AS s","  ON b.branch_id = s.branch_id","JOIN sale_items AS si","  ON s.sale_id = si.sale_id","WHERE","  STRFTIME('%Y-%m', s.sold_at) = STRFTIME('%Y-%m', DATE('2026-11-17', '-1 month'))","GROUP BY","  b.name;"],
      head: ["name", "total_revenue"], rows: [["Harbour", 3403.0], ["Old Town", 3779.6], ["Station", 3850.7]],
      ref: [["Harbour", 3403.0], ["Old Town", 3779.6], ["Station", 3850.7]] },
    q1: { q: "Which branch sold the most croissants last month?", ok: false,
      sql: ["SELECT","  T1.name","FROM branches AS T1","INNER JOIN sales AS T2","  ON T1.branch_id = T2.branch_id","INNER JOIN sale_items AS T3","  ON T2.sale_id = T3.sale_id","INNER JOIN products AS T4","  ON T3.product_id = T4.product_id","WHERE","  T4.category = 'croissant' AND T2.sold_at BETWEEN '2026-10-01' AND '2026-10-31'","GROUP BY","  T1.branch_id","ORDER BY","  SUM(T3.qty) DESC","LIMIT 1;"],
      head: ["name"], rows: [["Old Town"]],
      ref: [["Station", 525], ["Old Town", 468], ["Harbour", 320]] },
    q10: { q: "How many of each croissant product has the Harbour branch sold in total, since the data starts?", ok: true,
      sql: ["SELECT","  p.name,","  SUM(si.qty) AS total_sold","FROM sale_items AS si","JOIN sales AS s","  ON si.sale_id = s.sale_id","JOIN branches AS b","  ON s.branch_id = b.branch_id","JOIN products AS p","  ON si.product_id = p.product_id","WHERE","  b.name = 'Harbour' AND p.category = 'croissant'","GROUP BY","  p.name;"],
      head: ["name", "total_sold"], rows: [["Almond croissant", 304], ["Butter croissant", 504]],
      ref: [["Almond croissant", 304], ["Butter croissant", 504]] },
    q11: { q: "What was the average receipt total at each branch last month, for receipts that included a croissant?", ok: false,
      sql: ["SELECT","  T1.name,","  AVG(T2.total)","FROM branches AS T1","INNER JOIN sales AS T2","  ON T1.branch_id = T2.branch_id","INNER JOIN sale_items AS T3","  ON T2.sale_id = T3.sale_id","INNER JOIN products AS T4","  ON T3.product_id = T4.product_id","WHERE","  T4.category = 'croissant' AND STRFTIME('%Y-%m', T2.sold_at) = STRFTIME('%Y-%m', DATE('2026-11-17', '-1 month'))","GROUP BY","  T1.name;"],
      head: ["name", "AVG(T2.total)"], rows: [["Harbour", 9.446596858638744], ["Old Town", 9.488590604026845], ["Station", 10.914035087719299]],
      ref: [["Harbour", 9.112865497076022], ["Old Town", 9.224907063197026], ["Station", 10.0592]] },
    q3: { q: "How many receipts at each branch included at least one croissant last month?", ok: true,
      sql: ["SELECT","  b.name,","  COUNT(DISTINCT s.sale_id)","FROM branches AS b","JOIN sales AS s","  ON b.branch_id = s.branch_id","JOIN sale_items AS si","  ON s.sale_id = si.sale_id","JOIN products AS p","  ON si.product_id = p.product_id","WHERE","  p.category = 'croissant' AND STRFTIME('%Y-%m', s.sold_at) = STRFTIME('%Y-%m', DATE('2026-11-17', '-1 month'))","GROUP BY","  b.name;"],
      head: ["name", "COUNT(DISTINCT s.sale_id)"], rows: [["Harbour", 171], ["Old Town", 269], ["Station", 250]],
      ref: [["Harbour", 171], ["Old Town", 269], ["Station", 250]] }
  };
  const ORDER = ["q2", "q1", "q10", "q11", "q3"];
  const REC_META = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17" };
  const CAPTION = `Recorded model output, ${REC_META.recordedAt}`;

  // run_queries.out.txt evidence
  const LAST_OCT31 = [[3380, "2026-10-31 17:57:00"], [3377, "2026-10-31 17:19:00"], [3354, "2026-10-31 16:59:00"]];
  const STR_CMP = 0; // SELECT '2026-10-31 08:05:00' <= '2026-10-31'
  const OCT31 = [["Harbour", 11], ["Old Town", 12], ["Station", 73]]; // croissants sold on 31 October
  const BETWEEN_SUMS = [["Old Town", 456], ["Station", 452], ["Harbour", 309]]; // q1's filter, per branch
  const RECEIPT_2168 = [[2168, 1, 2, 2.4], [2168, 2, 3, 3.2]]; // sale_items rows: sale_id, product_id, qty, unit_price
  const JOINED_2168 = [[2168, "Old Town", 14.4, "Butter croissant"], [2168, "Old Town", 14.4, "Almond croissant"]]; // sale_id, branch, total, product
  const ROWS_VS_RECEIPTS = [["Harbour", 191, 171], ["Old Town", 298, 269], ["Station", 285, 250]];
  const FIXES = [ // q11 with each fix applied, run (run_queries.out.txt)
    { label: "Change <code>AVG(T2.total)</code> to <code>AVG(DISTINCT T2.total)</code>", rows: [["Harbour", 12.508695652173913], ["Old Town", 13.505747126436782], ["Station", 15.079310344827586]] },
    { label: "Make the joins to <code>sale_items</code> and <code>products</code> a <code>LEFT JOIN</code> instead of an <code>INNER JOIN</code>", rows: [["Harbour", 9.446596858638744], ["Old Town", 9.488590604026845], ["Station", 10.914035087719299]] },
    { label: "Drop the joins to <code>sale_items</code> and <code>products</code>; keep a receipt if <code>T2.sale_id IN (SELECT sale_id … croissant)</code>", rows: [["Harbour", 9.112865497076022], ["Old Town", 9.224907063197026], ["Station", 10.0592]] }
  ];
  const SHARED_TOTALS = [["Harbour", 102], ["Old Town", 182], ["Station", 163]]; // croissant receipts minus distinct totals: receipts DISTINCT drops

  // pipeline.py: answer(), line for line (line 0 = def), and its trace on q1
  const CODE = [
    "def answer(question):",
    "    sql = ask_model(question)",
    "    if not sql.lower().startswith(\"select\"):",
    "        return \"Refused: not a SELECT query\"",
    "    db = sqlite3.connect(DB_URI, uri=True)",
    "    try:",
    "        db.execute(\"EXPLAIN \" + sql)",
    "    except sqlite3.Error as err:",
    "        return \"Refused: \" + str(err)",
    "    return db.execute(sql).fetchall()"
  ];
  const DB_URI = "file:bakery.db?mode=ro";
  const TRACE = [[1, "line"], [2, "line"], [4, "line"], [5, "line"], [6, "line"], [9, "line"], [9, "return"]];
  const TRACE_SQL = "SELECT\n  T1.name\nFROM branches AS T1\nINN..."; // the trace printed the first 40 characters
  const TRACE_RESULT = [["Old Town"]];
  // part 2: test strings written by us (not model output) and what answer() returned
  const TESTS = [
    { sql: "DELETE FROM sales WHERE sold_at < '2026-10-01'", out: "Refused: not a SELECT query", at: 0 },
    { sql: "SELECT name FROM branch", out: "Refused: no such table: branch", at: 1 },
    { sql: "SELECT COUNT(*) FROM sales; DROP TABLE sales", out: "Refused: You can only execute one statement at a time.", at: 1 },
    { sql: "WITH oct AS (SELECT * FROM sales WHERE sold_at >= '2026-10-01' AND sold_at < '2026-11-01') SELECT COUNT(*) FROM oct", out: "Refused: not a SELECT query", at: 0 }
  ];
  const RO_ERROR = "attempt to write a readonly database"; // part 3: the DELETE run straight on the read-only connection
  const SALES_ROWS = 3004; // rows in sales after it (build_db.out.txt, pipeline.out.txt)

  // layer.py and recordings layer-1, layer-2
  const LAYER_CODE = [ // layer.py METRICS and DIMENSIONS, one field per line, with the learner's gap
    "METRICS = {",
    "  \"croissants_sold\": (",
    "    ?,",
    "    \"items\",",
    "    \"products.category = 'croissant'\"),",
    "  \"revenue\": (",
    "    \"SUM(sales.total)\", \"receipts\", None),",
    "  \"receipts\": (",
    "    \"COUNT(*)\", \"receipts\", None),",
    "}",
    "DIMENSIONS = {\"branch\": \"branches.name\",",
    "              \"city\": \"branches.city\"}"
  ];
  const DEFS = [ // October, by branch, each definition run (layer.out.txt part 2)
    { expr: "COUNT(*)", rows: [["Old Town", 298], ["Station", 285], ["Harbour", 191]] },
    { expr: "SUM(sales.total)", rows: [["Station", 3110.5], ["Old Town", 2827.6], ["Harbour", 1804.3]] },
    { expr: "SUM(sale_items.qty)", rows: [["Station", 525], ["Old Town", 468], ["Harbour", 320]] }
  ];
  const LAYER_TEXT = "Metrics:\n- croissants_sold: number of croissants sold (units, both croissant products)\n- revenue: money taken (sum of receipt totals)\n- receipts: number of receipts\nDimensions (group_by): branch, city\nTime: one calendar month, written YYYY-MM";
  const LAYER_REC = [
    { src: "s5a-text-to-sql/layer-1", q: "Which branch sold the most croissants last month?",
      text: "{\n  \"metric\": \"croissants_sold\",\n  \"group_by\": \"branch\",\n  \"month\": \"2026-10\"\n}",
      sql: ["SELECT branches.name, SUM(sale_items.qty) AS croissants_sold", "FROM sale_items JOIN sales ON sales.sale_id = sale_items.sale_id JOIN products ON products.product_id = sale_items.product_id JOIN branches ON branches.branch_id = sales.branch_id", "WHERE sales.sold_at >= '2026-10-01' AND sales.sold_at < '2026-11-01' AND products.category = 'croissant'", "GROUP BY branches.name", "ORDER BY croissants_sold DESC"],
      rows: [["Station", 525], ["Old Town", 468], ["Harbour", 320]] },
    { src: "s5a-text-to-sql/layer-2", q: "Which city sold more croissants in September?",
      text: "{\n  \"metric\": \"croissants_sold\",\n  \"group_by\": \"city\",\n  \"month\": \"2026-09\"\n}",
      sql: ["SELECT branches.city, SUM(sale_items.qty) AS croissants_sold", "FROM sale_items JOIN sales ON sales.sale_id = sale_items.sale_id JOIN products ON products.product_id = sale_items.product_id JOIN branches ON branches.branch_id = sales.branch_id", "WHERE sales.sold_at >= '2026-09-01' AND sales.sold_at < '2026-10-01' AND products.category = 'croissant'", "GROUP BY branches.city", "ORDER BY croissants_sold DESC"],
      rows: [["Riverton", 877], ["Bayport", 312]] }
  ];

  /* ---------- Derived from the data ---------- */
  const byName = rows => Object.fromEntries(rows);
  const top = rows => rows.reduce((a, r) => (r[1] > a[1] ? r : a));
  const Q1REF = REC.q1.ref, WINNER = top(Q1REF), Q1SAYS = REC.q1.rows[0][0];
  const BTW = byName(BETWEEN_SUMS), O31 = byName(OCT31), REFC = byName(Q1REF);
  const q11Model = byName(REC.q11.rows), q11Ref = byName(REC.q11.ref);
  const RVR = Object.fromEntries(ROWS_VS_RECEIPTS.map(([b, r, d]) => [b, { rows: r, receipts: d }]));
  const FOCUS = "Old Town"; // the branch the debug screen looks at (receipt 2168 is there)
  const sameRows = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const FIX_RIGHT = FIXES.findIndex(f => sameRows(f.rows, REC.q11.ref));
  const DEF_RIGHT = DEFS.findIndex(d => sameRows(d.rows, LAYER_REC[0].rows));
  const STEP_SQL_LINES = REC.q11.sql;
  const JOIN_LINES = STEP_SQL_LINES.map((l, i) => (/JOIN sale_items/.test(l) || (i > 0 && /JOIN sale_items/.test(STEP_SQL_LINES[i - 1]))) ? i : -1).filter(i => i >= 0);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-sql { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk);
        font: 500 13.5px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; font-variant-ligatures: none; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-ask { margin: 14px 0 0; padding: 10px 12px; border-left: 3px solid var(--ink); font-size: 16px; line-height: 1.5; }
      .lx-${ID}-ask b { font-weight: 600; }
      .lx-${ID}-res { margin: 10px 0 0; border-collapse: collapse; font: 500 14px/1.4 var(--mono); max-width: 100%; font-variant-ligatures: none; }
      .lx-${ID}-res th { text-align: left; font-weight: 600; color: var(--muted); padding: 4px 12px 4px 0; border-bottom: 1px solid var(--line); white-space: nowrap; }
      .lx-${ID}-res td { padding: 4px 12px 4px 0; border-bottom: 1px solid var(--line); color: var(--ink); overflow-wrap: break-word; }
      .lx-${ID}-res caption { caption-side: top; text-align: left; font: 500 13px var(--font); color: var(--muted); padding-bottom: 4px; }
      .lx-${ID}-schema { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-schema li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .lx-${ID}-schema code { font: 600 14px var(--mono); }
      .lx-${ID}-schema span { display: block; font: 500 13.5px/1.45 var(--mono); color: var(--ink-2); overflow-wrap: anywhere; }
      .lx-${ID}-schema em { display: block; font-style: normal; color: var(--muted); font-size: 14px; }
      .lx-${ID}-lines { margin: 12px 0 0; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
      .lx-${ID}-line { display: block; width: 100%; min-height: 44px; padding: 6px 12px; border: 0; border-bottom: 1px solid var(--line);
        background: var(--surface); color: var(--ink); font: 500 13.5px/1.45 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; font-variant-ligatures: none; }
      .lx-${ID}-line:last-child { border-bottom: 0; }
      .lx-${ID}-line:hover { background: var(--sunk); }
      .lx-${ID}-line.lx-${ID}-no { background: var(--bad-soft); }
      .lx-${ID}-line.lx-${ID}-yes { background: var(--good-soft); box-shadow: inset 3px 0 0 var(--good); }
      .lx-${ID}-count { margin: 10px 0 0; font-size: 14px; color: var(--muted); }
      .lx-${ID}-opt { text-align: left; }
      .lx-${ID}-pair { display: flex; flex-wrap: wrap; gap: 4px 24px; }
    `;
    document.head.appendChild(s);
  }
  const sqlBlock = (kit, lines) => `<div class="lx-${ID}-sql">${kit.esc(Array.isArray(lines) ? lines.join("\n") : lines)}</div>`;
  const cell = (kit, v) => kit.esc(typeof v === "number" && !Number.isInteger(v) ? (Math.abs(v - Math.round(v * 100) / 100) < 1e-9 ? String(v) : money(v)) : String(v));
  function grid(kit, head, rows, caption) {
    return `<table class="lx-${ID}-res">${caption ? `<caption>${caption}</caption>` : ""}<thead><tr>${head.map(h => `<th scope="col">${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${cell(kit, v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const ask = (kit, q) => `<div class="lx-${ID}-ask">The owner asks: <b>${kit.esc(q)}</b></div>`;
  function choose(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }

  /* 1. The situation, and the schema: which tables does the question need? */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["sales and sale_items", "products and sale_items", "branches and sales", "all four: branches, sales, sale_items and products"];
    const RIGHT = 3;
    const fb = [
      ["Those give you quantities and receipts, but not which rows are croissants (that is <code>products.category</code>) and not the branch's name (that is <code>branches.name</code>). The answer would be a list of branch ids and every product mixed together.", false],
      ["That finds croissant lines and their quantities, but a line does not know its branch. The branch sits on the receipt in <code>sales</code>, and its name in <code>branches</code>. You also need <code>sales.sold_at</code> for “last month”.", false],
      ["That gives receipts per branch and their dates, but a receipt total mixes bread, coffee and croissants. The number of croissants is in <code>sale_items.qty</code>, and what counts as a croissant is in <code>products</code>.", false],
      [`Right. Croissant is a <code>products.category</code>, how many is <code>sale_items.qty</code>, the date and branch sit on the receipt in <code>sales</code>, and the branch's name is in <code>branches</code>. Four joined tables for one short question: the owner cannot write that, and is waiting a week for the report instead. The idea of <b>text-to-SQL</b>: give a model this table description and the question, let it write the query, and run it.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Croissants, last month, which branch?</h1>
        <p class="lead">The owner of a three-branch bakery chain wants to know which branch sold the most croissants last month. The numbers are all in the sales database. Today someone builds a weekly report by hand; she wants to type the question and get the number. This lesson lets a model answer from your own data, like RAG, but the data is in database tables, not documents. This is the table description a model would get:</p>
        <ul class="lx-${ID}-schema">${SCHEMA.map(([t, cols, note]) => `<li><code>${kit.esc(t)}</code><span>${kit.esc(cols)}</span>${note ? `<em>${kit.esc(note)}</em>` : ""}</li>`).join("")}</ul>
        ${ask(kit, REC.q1.q)}
        <p class="task">Which tables must a query join to answer her?</p>
        <div class="lpanel">${choose(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand: five recorded model-written queries. Which ones return wrong numbers? */
  const VERDICT = {
    q2: { trust: "Right to trust it. It adds up quantity times price over every line of last month's receipts, per branch. <code>STRFTIME('%Y-%m', s.sold_at)</code> turns each <code>sold_at</code> into year and month (<code>'2026-10'</code>) before comparing, so the time of day does not matter. Our reference query, which sums <code>sales.total</code> instead, gives the same three numbers.",
      wrong: "Look again: it sums quantity times price over every line, which is what a receipt total is made of. The date test compares year and month only (<code>'2026-10'</code>), so a time after the date does not hurt. Our reference query got the same three numbers." },
    q10: { trust: "Right to trust it. No date limit was asked for, so none is needed. It sums <code>qty</code>, not lines, over the Harbour branch's croissant lines. Our reference query matches it.",
      wrong: "This one is fine. The question asks for all time, so there is no date filter to get wrong, and it sums <code>qty</code>, the units, per croissant product. Our reference query gives the same two numbers." },
    q3: { trust: "Right to trust it. Look at <code>COUNT(DISTINCT s.sale_id)</code>: a receipt with two croissant lines appears twice after the join, and <code>DISTINCT</code> counts it once. Our reference query gives the same numbers.",
      wrong: "This one is fine, and the reason is one word: <code>COUNT(DISTINCT s.sale_id)</code>. A receipt with two croissant lines appears twice after the join; <code>DISTINCT</code> counts it once. Our reference query gives the same numbers." }
  };
  function q1Bad(kit, right) {
    return `${right ? "Right, it is wrong." : "It runs, but the number is wrong."} <code>BETWEEN '2026-10-01' AND '2026-10-31'</code> keeps a row only if <code>sold_at &lt;= '2026-10-31'</code>. But the column holds a time too. As text, <code>'${kit.esc(LAST_OCT31[0][1])}'</code> sorts after <code>'2026-10-31'</code>, so every sale on 31 October drops out. SQLite agrees: <code>'2026-10-31 08:05:00' &lt;= '2026-10-31'</code> gives ${STR_CMP}, false. The schema description said “the date of the sale”, and the model believed it. Without 31 October, ${kit.esc(Q1SAYS)} has ${BTW[Q1SAYS]} and ${kit.esc(WINNER[0])} ${BTW[WINNER[0]]}; on that one day ${kit.esc(WINNER[0])} sold ${O31[WINNER[0]]}. With the whole month, ${kit.esc(WINNER[0])} sold ${WINNER[1]} and ${kit.esc(Q1SAYS)} ${REFC[Q1SAYS]}. The answer names the wrong branch.`;
  }
  function q11Bad(kit, right) {
    return `${right ? "Right, it is wrong." : "It runs, but the averages are too high."} Receipt 2168 has two croissant lines, so after the join to <code>sale_items</code> it is two rows, and <code>AVG</code> counts its total twice. At ${FOCUS}, our reference query gives ${money(q11Ref[FOCUS])}; this one gives ${money(q11Model[FOCUS])}. The next screen takes it apart.`;
  }
  function byHand({ el, done, kit }) {
    ensureStyle();
    let k = 0, picked = null; // k = query being judged
    const say = (key, right) => key === "q1" ? q1Bad(kit, right) : key === "q11" ? q11Bad(kit, right) : (right ? VERDICT[key].trust : VERDICT[key].wrong);
    const paint = () => {
      const fin = k >= ORDER.length;
      const key = ORDER[Math.min(k, ORDER.length - 1)], r = REC[key];
      const correct = r.ok ? 0 : 1;
      const fbHtml = picked != null && !fin ? kit.feedback(say(key, false), false) : "";
      const prev = k > 0 ? `<p class="lx-${ID}-count">Query ${k}, your verdict:</p>${kit.feedback(say(ORDER[k - 1], true), true)}` : "";
      el.innerHTML = `<h1>Five queries. Which numbers are wrong?</h1>
        <p class="lead">A small hosted model got the table description from screen 1, today's date (${TODAY}) and one question at a time, and wrote SQL. Here are five of the twelve queries we recorded. Every one ran without an error. Two of these five return wrong numbers. To check each one, we also wrote a correct query by hand: our <b>reference query</b>. Before judging, peek at the data, as an engineer would:</p>
        <div class="lx-${ID}-pair">${grid(kit, ["sale_id", "sold_at"], LAST_OCT31, "<code>sales</code>, the last three receipts of 31 October")}
        ${grid(kit, ["sale_id", "product_id", "qty"], RECEIPT_2168.map(r => r.slice(0, 3)), "<code>sale_items</code> of receipt 2168")}</div>
        <p class="lx-${ID}-count">Products ${CROISSANTS.map(([i, n]) => `${i} = ${kit.esc(n)}`).join(", ")}, both in category croissant.</p>
        ${prev}
        ${fin ? kit.feedback(`Done: two of five ran cleanly and returned wrong numbers. One lost a day to a date filter, one counted a receipt twice through a join. Neither raised an error, and both results look like real numbers.`, true) : `
        <p class="lx-${ID}-count">Query ${k + 1} of ${ORDER.length}</p>
        ${ask(kit, r.q)}
        ${sqlBlock(kit, r.sql)}
        <p class="lx-${ID}-cap">${CAPTION} (code fences cut)</p>
        ${grid(kit, r.head, r.rows, r.rows.some(x => x.some(v => typeof v === "number" && Math.round(v * 100) !== v * 100)) ? "What it returned (averages rounded to 2 decimals)" : "What it returned")}
        <p class="task">Trust this number, or is it wrong?</p>
        <div class="lpanel">${kit.options(["Trust it", "Wrong number"], { picked, correct })}${fbHtml}</div>`}`;
      if (!fin) el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const p = +b.dataset.i;
        if (p !== correct) { picked = p; paint(); return; }
        picked = null; k++; paint();
        if (k >= ORDER.length) done();
      });
    };
    paint();
  }

  /* 3. Broken on purpose: where does one receipt become two rows, and what fixes it? */
  function brokenJoin({ el, done, kit }) {
    ensureStyle();
    let line = null, fix = null, found = false;
    const lineFb = i => {
      const l = STEP_SQL_LINES[i];
      if (JOIN_LINES.includes(i)) return null;
      if (/AVG/.test(l)) return "<code>AVG</code> does exactly what it is told: it averages the rows it gets. The rows were already doubled before they reached it. Look for where the doubling happens.";
      if (/JOIN products|product_id = T4/.test(l)) return "Each <code>sale_items</code> line has one product, so this join finds exactly one match per line and never adds rows.";
      if (/JOIN sales|branch_id = T2/.test(l)) return "Each receipt belongs to one branch, so joining receipts to branches gives one row per receipt. No doubling here.";
      if (/category|WHERE/.test(l)) return "A filter only removes rows. It keeps both croissant lines of receipt 2168, true, but they were already two rows when it saw them.";
      if (/GROUP BY|T1\.name;/.test(l)) return "Grouping folds rows into one per branch; it does not create rows. The extra rows exist before the grouping.";
      return "This line names columns or tables; it does not change how many rows there are. Find the join that can match one receipt more than once.";
    };
    const paint = () => {
      const fixOpts = FIXES.map(f => `<span class="lx-${ID}-opt">${f.label}</span>`);
      const fixFb = FIXES.map((f, i) => {
        const v = byName(f.rows)[FOCUS];
        if (i === FIX_RIGHT) return [`Right. Ran it: ${FOCUS} ${money(v)}, the same as our reference query. Each receipt is one row again, because nothing joins it to its lines; the lines are only asked “is there a croissant?”. The general rule: when you need one row per receipt, do not join a table that has many rows per receipt, or count with <code>DISTINCT</code> on the receipt id, as query 5 did.`, true];
        if (/DISTINCT/.test(f.label)) return [`Ran it: ${FOCUS} ${money(v)}, further off than before. <code>DISTINCT</code> works on the <b>values</b>, so two different receipts that happen to have the same total are counted once. At ${FOCUS}, ${RVR[FOCUS].receipts} croissant receipts have only ${RVR[FOCUS].receipts - SHARED_TOTALS.find(r => r[0] === FOCUS)[1]} different totals, so ${SHARED_TOTALS.find(r => r[0] === FOCUS)[1]} receipts drop out. Make the receipt unique, not the amount.`, false];
        return [`Ran it: ${FOCUS} ${money(v)}, unchanged. A <code>LEFT JOIN</code> keeps receipts with no matching line, but the croissant filter in <code>WHERE</code> removes those again, and a receipt with two croissant lines still becomes two rows.`, false];
      });
      el.innerHTML = `<h1>Broken on purpose: one receipt, two rows</h1>
        <p class="lead">Query 4 asked for the average receipt total of receipts with a croissant. It ran, and returned ${FOCUS} ${money(q11Model[FOCUS])}. Our reference query says ${money(q11Ref[FOCUS])}. Two facts from the same data:</p>
        ${grid(kit, ["branch", "rows reaching AVG", "receipts"], ROWS_VS_RECEIPTS, "What the query averages, against the receipts it should average")}
        ${grid(kit, ["sale_id", "total", "product"], JOINED_2168.map(r => [r[0], r[2], r[3]]), `Receipt 2168 (${kit.esc(JOINED_2168[0][1])}), as the query's join sees it`)}
        <p class="task">${found ? "Now pick the fix." : "Tap the line of the query where one receipt turns into two rows."}</p>
        <div class="lx-${ID}-lines" role="group" aria-label="the query, one button per line">${STEP_SQL_LINES.map((l, i) => {
          const st = line === i ? (JOIN_LINES.includes(i) ? ` lx-${ID}-yes` : ` lx-${ID}-no`) : (found && JOIN_LINES.includes(i) ? ` lx-${ID}-yes` : "");
          const attr = JOIN_LINES.includes(i) ? (i === JOIN_LINES[0] ? " data-right" : "") : (/AVG/.test(l) ? " data-wrong" : "");
          return `<button type="button" class="lx-${ID}-line${st}" data-i="${i}"${attr}>${kit.esc(l) || " "}</button>`;
        }).join("")}</div>
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <div class="lpanel">${line != null && !found ? kit.feedback(lineFb(line), false) : ""}
        ${found ? `${kit.feedback(`Yes. <code>sale_items</code> has one row per product line, so this join gives one row per line, not per receipt. Receipt 2168 has two croissant lines and comes out twice. At ${FOCUS}: ${RVR[FOCUS].rows} rows for ${RVR[FOCUS].receipts} receipts. This is called a <b>fan-out</b>: when one receipt joins to many lines, the receipt's row is repeated once per line. Sums and averages over the repeated rows go wrong, and nothing raises an error.`, true)}
          <div id="fix">${choose(kit, fixOpts, FIX_RIGHT, fix, fixFb)}</div>` : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-line`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        line = i;
        if (JOIN_LINES.includes(i)) found = true;
        paint();
      });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === FIX_RIGHT) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: what did the model lack? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "SQL skill: the queries are badly written, and a stronger model would write them properly",
      "An error check: asking the database to test-prepare each query (EXPLAIN) before running it would have caught both",
      "The meaning of the data: what is in the columns and what counts as one receipt. The description does not say it, so every new query decides it again",
      "More practice: given the same questions again, it would learn from its mistakes"
    ];
    const RIGHT = 2;
    const fb = [
      ["Both queries are valid, readable SQL, written the way people write it. The mistakes are about this database: that <code>sold_at</code> holds a time, and that a receipt has many lines. A stronger model reads the same description, and the description does not say the first one.", false],
      ["<code>EXPLAIN</code> asks the database how it would run the query; it fails only when the query cannot run (an unknown table, a syntax error). Both of these ran. A query that runs can still answer a different question than the one asked.", false],
      [`Right. The model knows SQL. It does not know that <code>sold_at</code> holds a time (the description said “date”) or how the tables multiply rows when joined. Each new question is a new query that decides those things again, and can decide them wrong without any error. Two fixes follow from that: <b>check</b> each query before it runs, for what a program can check, and write the meaning down <b>once</b>, as named, reviewed definitions the model reuses instead of re-deriving.`, true],
      ["The model keeps nothing between calls. Asked again with the same prompt, it gets the same description and can make the same choice. Nothing it did here changes the next call.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What was missing?</h1>
        <p class="lead">Two of five queries returned wrong numbers: a date filter that lost 31 October, and a join that counted receipts twice. Both ran without an error, and both answers looked believable.</p>
        <p class="task">What did the model lack when it wrote them?</p>
        <div class="lpanel">${choose(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. From scratch in Python: ask, check, run. A stepped replay of answer() on the owner's question. */
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const ran = TRACE[k - 1][0];
      if (TRACE[k][1] === "return") { fr.push({ ln: ran, end: true }); continue; }
      if (ran === 5) continue; // "try:" itself does nothing to show
      if (TRACE[k - 1][1] === "line" && ran !== 9) fr.push({ ln: ran, next: TRACE[k][0] });
    }
    return fr;
  })();
  function sayFrame(kit, f) {
    if (f.end) return `The last line runs the query for real, and <code>fetchall()</code> returns <code>${kit.esc(JSON.stringify(TRACE_RESULT))}</code>. Every check passed.`;
    if (f.ln === 1) return "<code>ask_model</code> sends the table description and the question, and returns the model's reply with the code fences cut. Here it replays the recorded reply, so no API is called.";
    if (f.ln === 2) return "The reply starts with <code>SELECT</code>, so the test is false and the <code>return \"Refused…\"</code> under it is skipped.";
    if (f.ln === 4) return `It opens the database with <code>${kit.esc(DB_URI)}</code>. <code>mode=ro</code> opens it read-only: any write fails, whatever the SQL says.`;
    if (f.ln === 6) return `<code>EXPLAIN</code> makes the database prepare the query and describe how it would run it, without running it. No error, so the <code>except</code> branch is skipped and the last line runs next.`;
    return "";
  }
  function fromScratch({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const opts = ["Yes: if every check passes, the answer is right", `No: it will return ${Q1SAYS}, because the checks never look at what the query means`, "It will be refused at the EXPLAIN line"];
    const RIGHT = 1;
    const fb = [
      ["The checks only ask: is it a SELECT, can the database prepare it, is it one statement. The BETWEEN query from screen 2 passes all three and still drops 31 October.", false],
      [`Right, and the stepping shows it: it returns <code>${kit.esc(JSON.stringify(TRACE_RESULT))}</code>, while the whole month says ${kit.esc(WINNER[0])}. These checks protect the database and catch SQL that cannot run. Whether the query answers the question is a different check: compare it against known answers, or write the meaning down in code so the model never decides it.`, true],
      ["<code>EXPLAIN</code> only fails when the database cannot prepare the query: an unknown table or column, a syntax error. This query is valid SQL.", false]
    ];
    const paint = () => {
      const f = FR[i], last = i === FR.length - 1;
      el.innerHTML = `<h1>Ask, check, run: in Python</h1>
        <p class="lead">The whole pipeline from scratch, with Python's built-in <code>sqlite3</code>. This run replays the recorded reply to the owner's croissant question: query 1 from screen 2, the one that loses 31 October. The checks and the query really ran on the bakery's database.</p>
        <p class="task">First predict: will the checks lead to the right branch? Then step to the end (stepping opens once you have picked).</p>
        <div class="lpanel" id="pred">${choose(kit, opts, RIGHT, ans, fb)}</div>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || ans == null ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>sql <b>${f.ln >= 1 ? kit.esc(TRACE_SQL.split("\n")[0] + " …") : "–"}</b></span><span>returned <b>${f.end ? kit.esc(JSON.stringify(TRACE_RESULT)) : "–"}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1 && ans === RIGHT) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT && i === FR.length - 1) done(); });
    };
    paint();
  }

  /* 6. Use the checks, with predictions: four test strings through answer(). */
  function checks({ el, done, kit }) {
    ensureStyle();
    const ans = TESTS.map(() => null);
    const OPTS = ["Refused by the first-word test (not a SELECT)", "Refused because EXPLAIN fails", "Runs and returns rows"];
    const why = [
      t => `The first-word test refuses it: <code>${kit.esc(t.out)}</code>. Even without that test, <code>EXPLAIN</code> would not stop a <code>DELETE</code>: it is valid SQL and prepares fine. The read-only connection would: we ran the <code>DELETE</code> on it and got <code>${kit.esc(RO_ERROR)}</code>, and <code>sales</code> still had ${SALES_ROWS} rows. The connection is the real wall; the first-word test is a quick early “no”.`,
      t => `It starts with SELECT, so the first-word test lets it through, and the database cannot prepare it. Returned: <code>${kit.esc(t.out)}</code>. That message could go back to the model so it can try again.`,
      t => `It starts with SELECT, so the first-word test lets it through. Python's <code>execute</code> runs one statement at a time and raises an error on a second one, so <code>EXPLAIN</code> fails: <code>${kit.esc(t.out)}</code>. The <code>DROP</code> never runs.`,
      t => `A false alarm. This is a safe, read-only query, but it starts with <code>WITH</code>, so the first-word test refuses it: <code>${kit.esc(t.out)}</code>. A first-word test is crude. Real systems parse the SQL, or allow only certain views, and lean on the read-only connection.`
    ];
    const wrongWhy = (t, p) => p === 2
      ? (t.at === 0 ? "It never gets that far: the first test reads the first word, and this one does not start with SELECT." : "The database cannot prepare this one, so it never runs. Look at what <code>EXPLAIN</code> would complain about.")
      : p === 0 ? "It does start with SELECT, so the first-word test lets it through. Something later stops it."
      : "The <code>EXPLAIN</code> line never runs for it: the first-word test comes earlier, and this string does not start with SELECT.";
    const paint = () => {
      el.innerHTML = `<h1>What do the checks stop?</h1>
        <p class="lead">We fed four test strings, written by us (not model output), into <code>answer()</code> in place of the model's reply.</p>
        ${kit.code(CODE, -1)}
        <p class="task">For each string, predict what <code>answer()</code> does.</p>
        ${TESTS.map((t, k) => `<div class="lcase" id="c${k}">${sqlBlock(kit, t.sql)}${kit.options(OPTS, { picked: ans[k], correct: t.at })}${ans[k] == null ? "" : kit.feedback(ans[k] === t.at ? why[k](t) : wrongWhy(t, ans[k]), ans[k] === t.at)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, k) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[k] = +b.dataset.i; paint();
        if (TESTS.every((t, j) => ans[j] === t.at)) done();
      }));
    };
    paint();
  }

  /* 7. Define one metric in a tiny semantic layer, then see the model reuse it. */
  function defineMetric({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = DEFS.map(d => `<code>${kit.esc(d.expr)}</code>`);
    const L = LAYER_REC[0];
    const fb = DEFS.map((d, i) => {
      const t = top(d.rows);
      if (i === DEF_RIGHT) return [`Right: the units on each line, added up. Now the model's side. It got the layer's names, not the tables, and the owner's question. It replied with three choices, in JSON; the request carried a JSON schema listing the allowed metric and dimension names:${sqlBlock(kit, L.text)}<p class="lx-${ID}-cap">${CAPTION}</p>The code looked the names up (an unknown name would fail the lookup) and wrote the SQL itself, with your definition and a month rule written once: from the 1st, up to but not including the next month's 1st.${sqlBlock(kit, L.sql)}${grid(kit, ["branch", "croissants_sold"], L.rows, "What it returned")}${kit.esc(top(L.rows)[0])}, ${top(L.rows)[1]}: the right answer, with no date bug to make, because the model never wrote a date filter.`, true];
      if (/COUNT/.test(d.expr)) return [`That counts croissant <b>lines</b>, not croissants. A line with qty 3 counts as 1. Ran it: ${kit.esc(t[0])} would win with ${t[1]}, the wrong branch. One reviewed definition protects every question that uses it, so it has to be the right one.`, false];
      return [`That adds up receipt <b>totals</b>, in money, over croissant lines. It counts a receipt's bread and coffee too, and counts a receipt twice when it has two croissant lines: the fan-out from screen 3. Ran it: ${kit.esc(t[0])} ${money(t[1])}, a sum of money, not croissants.`, false];
    });
    const paint = () => {
      el.innerHTML = `<h1>Write the meaning down once</h1>
        <p class="lead">A <b>semantic layer</b> is a list of named business numbers (<b>metrics</b>) and ways to split them (<b>dimensions</b>, such as by branch). Each name has one SQL definition that a person wrote and checked. The model picks names; code writes the SQL. Here is a tiny one, as a Python dict (like a JS object). Each metric has three parts: what to compute, which rows it counts over, and a filter (<code>None</code> for no filter).</p>
        ${kit.code(LAYER_CODE, 2)}
        <p class="task">Fill in the marked gap: which expression defines <code>croissants_sold</code>?</p>
        <div class="lpanel">${choose(kit, opts, DEF_RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === DEF_RIGHT) done(); });
    };
    paint();
  }

  /* 8. A new question through the same layer: predict what changes. */
  function reuse({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const L = LAYER_REC[1];
    const opts = [
      "The model writes a new SUM for cities, so the croissant part of the SQL changes",
      "Only the grouping column and the month's two dates; the croissants_sold part is the same text as before",
      "Everything: it is a new question, so it is a new query from scratch"
    ];
    const RIGHT = 1;
    const shown = `${sqlBlock(kit, L.text)}<p class="lx-${ID}-cap">${CAPTION}</p>${sqlBlock(kit, L.sql)}${grid(kit, ["city", "croissants_sold"], L.rows, "What it returned")}`;
    const fb = [
      [`The model never writes SQL here; it only names a metric. Its reply:${shown}The <code>SUM(sale_items.qty)</code> part is the same as for the branch question.`, false],
      [`Right. The model's reply:${shown}Line one says <code>branches.city</code> instead of <code>branches.name</code>, and the dates moved to September. The metric's SQL is identical. That is why a layer beats a raw schema: the hard parts (what a croissant is, how to count without doubling, what “a month” means) were decided and checked once, and every question reuses them. The model's job shrank to picking a metric and a dimension from fixed lists, plus a month, and a program can check all three.`, true],
      [`Only the model's choice is new. Its reply:${shown}The code built the SQL from the same pieces: same metric text, same joins, same month rule.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A new question, the same definition</h1>
        <p class="lead">The model got only this layer and the question, never the tables:</p>
        ${sqlBlock(kit, LAYER_TEXT)}
        ${ask(kit, L.q)}
        <p class="task">On the last screen, the code built a query for croissants by branch in October. Compared with that query, what changes in the SQL?</p>
        <div class="lpanel">${choose(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A shop manager asks, in her own words, how this week's bread sales compare with last week's",
      "The yearly revenue figure the accountant puts in the tax return",
      "A product team exploring which hour of the day has the most receipts"
    ];
    const RIGHT = 1;
    const fb = [
      ["A good fit: a one-off question over the tables, and a mistake costs little because she can check it against what she sees in the shop. Through a layer with a <code>revenue</code> metric, even better.", false],
      ["Right. That number is asked once a year, must be exactly right and must be explainable later. Write one reviewed query, keep it, and run the same one every year. A model writing new SQL each time adds a new chance of a quiet mistake, for no gain.", true],
      ["A fair fit: exploring is where many different questions come up, and a person reads each result. Seeing the SQL, and checking it against one known number, keeps it honest.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to let a model write the SQL</h1>
        <p class="lead"><b>For:</b> questions over tables, asked in plain words, too many and too varied for a report each. <b>Add a semantic layer</b> when the same few numbers keep coming back: define them once, and let the model pick names.</p>
        <p class="lead"><b>Not</b> when the answer sits in documents (use retrieval), when the same question is asked every week (build a report), or when a number must be exactly right and approved by a person (keep one reviewed query). Never let it write to the data.</p>
        <p class="lead"><b>Costs:</b> a model call per question; the table description in every prompt, growing with the schema; someone to keep the layer up to date; and the worst one, a wrong number that looks right.</p>
        <p class="task">Which of these should <b>not</b> be answered by model-written SQL?</p>
        <div class="lpanel">${choose(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it: model-written SQL, a semantic layer, or neither? */
  const CHOICES = ["Model writes SQL", "Semantic layer", "Neither"];
  const CASES = [ // [situation, right choice, feedback for each of CHOICES]
    ["An analyst wants help drafting one-off queries over a warehouse of 200 tables. She reads each query and runs it herself.", 0, [
      "Yes, the model drafts and she checks. Her questions are all different, so there is no fixed set of metrics to define, and a person reads every query before it runs. With 200 tables, give the model the description of only the tables her question touches, not all of them.",
      "A layer only answers the questions its metrics cover. Her questions are one-off and new each time, so most would fall outside it, and she already reviews every query herself.",
      "The answer is in the tables, and she checks every query before it runs, so the quiet-mistake risk is covered by her review. A model drafting SQL saves her typing."]],
    ["Store managers ask, through a chat box, for sales, units and receipts by store, week and product. Nobody reads the SQL before they see the answer.", 1, [
      "With no one reading the SQL, each wrong query becomes a wrong answer, like the lost 31 October. These are the same few numbers again and again: define them once in a layer and let the model only pick names.",
      "Yes, a layer. The same few numbers come back again and again, and no person checks each query, so the meaning must be fixed once: the model picks a metric and the splits, and code writes the SQL.",
      "The answers are in the tables and the questions come in plain words, so something must turn words into a query. The risk is a quiet wrong number, and a layer of reviewed metrics removes most of it."]],
    ["Staff ask what the return policy says about opened cosmetics. The policy is a thirty-page document.", 2, [
      "No table holds the answer, so there is no query to write. The words are in a document; find the right passage with retrieval and answer from it.",
      "A layer defines numbers computed from rows. A policy is sentences in a document: there is nothing to count or join. Retrieval over the document is the tool.",
      "Right, neither. The answer is in text, not in rows: there is nothing to count or join. Retrieval over the document is the tool."]],
    ["A shift lead wants to type “cancel every open Harbour order from yesterday” into a chat box and have it done.", 2, [
      "That needs a DELETE or UPDATE, so the read-only connection, the one real wall, would have to go. One wrong WHERE, like the lost 31 October, would change the wrong rows, with no error and no undo. A change to data goes through a fixed, tested action in the app, with a confirmation.",
      "A layer only reads: it turns a metric name into a SELECT. Cancelling orders changes data, which a layer cannot do and should not do. That belongs to a fixed, tested action in the app.",
      "Right, neither. Both tools here only read. Letting a model write SQL that changes data removes the read-only wall, and a quiet mistake would change the wrong rows. Give the app a fixed, tested cancel action, with a confirmation, instead."]]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>SQL, a layer, or neither?</h1>
        <p class="lead">Four requests from other places.</p>
        <p class="task">For each, pick the best fit. Pick again if you change your mind.</p>
        ${CASES.map(([q, c, fbs], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(CHOICES, { picked: ans[i], correct: c })}${ans[i] == null ? "" : kit.feedback(fbs[ans[i]], ans[i] === c)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((cs, i) => cs.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, c], j) => ans[j] === c)) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can ask questions of tables</h1>
      <p class="lead">You found two model-written queries that ran and returned wrong numbers, traced one fan-out to its join, stepped through a ${CODE.length - 1}-line pipeline that checks a query before it runs, and defined a metric that the model then reused without writing any SQL.</p>
      <p class="lead">This lesson was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here the database was always current; next, documents change under a search index, and the index has to keep up.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Questions over tables: text-to-SQL and a semantic layer",
    checked: "2026-11-17",
    sources: [
      "https://www.sqlite.org/lang_expr.html",
      "https://www.sqlite.org/datatype3.html",
      "https://www.sqlite.org/lang_datefunc.html",
      "https://www.sqlite.org/lang_explain.html",
      "https://www.sqlite.org/uri.html",
      "https://docs.python.org/3/library/sqlite3.html",
      "https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl",
      "https://docs.getdbt.com/docs/build/about-metricflow",
      "https://openrouter.ai/docs/guides/features/structured-outputs"
    ],
    interview: [
      {
        q: "Your text-to-SQL assistant told a manager the wrong store sold the most last month. No error was raised. How do you find the cause, and how do you stop it happening again?",
        good: [
          "Run the generated SQL next to a hand-written reference query on the same data and compare",
          "Read the query for the usual quiet bugs: a date range that drops the last day of a datetime column, a join that repeats rows",
          "Check what the schema description told the model against what the columns really hold",
          "Keep a set of questions with known answers and run it on every prompt or model change",
          "Move the core numbers into a semantic layer, so the model picks metric names and code writes the SQL"
        ],
        weak: "Switch to a bigger model or add “be careful with dates” to the prompt. The query was valid SQL; without a known-answer check, the next quiet mistake goes unnoticed too."
      },
      {
        q: "Security asks how you stop a text-to-SQL feature from damaging the database. What do you put in place?",
        good: [
          "Connect with read-only access: a read-only connection or a database user with only SELECT rights",
          "Run one statement at a time and refuse anything that is not a query",
          "Let the database prepare the query first (EXPLAIN) and refuse it on an error",
          "Allow only certain tables or views, with a row limit and a timeout",
          "Log every generated query with the question that produced it"
        ],
        weak: "Tell the model in the prompt to write only SELECT queries. A prompt is a request, not a wall; the connection must make writes impossible."
      }
    ],
    screens: [situation, byHand, brokenJoin, spotIdea, fromScratch, checks, defineMetric, reuse, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ORDER.map(() => "[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "#fix [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#pred [data-wrong]"], right: ["#pred [data-right]", ...Array(FR.length - 1).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: TESTS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
