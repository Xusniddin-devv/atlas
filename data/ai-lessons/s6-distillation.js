/* Lesson s6-distillation: teaching a small model from a big one.
   Story: Brightwire (made up for this lesson) sorts news articles into five desks with a large hosted model, one call per
   article, and the monthly bill has grown too high. House rule: every review goes to the Culture desk, even a review
   of a phone or a running shoe. The team distils: the large model (teacher) tags the archive, a small model (student)
   trains on those tags.
   Ideas: (1) the student learns only what the teacher's labels show it, as often as they show it: a rare hard slice
   (reviews, whose words point to Tech, Sport or Health) is lost while the overall score looks fine, so you score by
   slice and fix with more teacher-labelled hard rows or a confidence fallback to the teacher; (2) distillation pays only
   when the monthly saving covers the student's server, upkeep and build, so you compute the break-even volume from
   the real bill first.
   Depth: explain (screens 1-7, interview), when-not (screens 8-10).
   Data, all real (folders in the main checkout for recordings, this repo for runs):
   - docs/ai-path/recordings/s6-distillation/gen-*.json: a small hosted model (openai/gpt-4o-mini) wrote the made-up
     articles (gen-<field>-1/2 for the clear articles, gen-review-1..3 for the reviews).
   - docs/ai-path/recordings/s6-distillation/tag3-<id>.json: the teacher (deepseek/deepseek-chat, temperature 0) tags
     every archive article a001..a153, test article e01..e35 and extra review x01..x26, one call each.
   - docs/ai-path/runs/s6-distillation/: build_pool.py (archive, test set, editors' tags), make_teacher_requests.py,
     train_student.py (student = local all-minilm encoder + one trained softmax layer, seed 0) with
     train_student_v1.out.txt (153 archive rows) and train_student_v2.out.txt (+26 teacher-tagged reviews),
     distil_short.py + distil_short.out.txt (the code screen), env.txt.
   - Setup history, told in the lesson: first_try_* (a money rule; the student learned it, 9 of 10) and second_try_*
     (a vaguer wording of the reviews rule; the teacher followed it on 4 of 10 test reviews; recordings teacher-* and
     tagger-*). The lesson uses the third setup (tag3-*).
   Lesson-local style: article rows and a slice table (.lx-s6-distillation-*), see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s6-distillation";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pct = (a, b) => Math.round(100 * a / b);

  /* ---------- Data copied from the runs and recordings ---------- */
  // Test set rows: [id, slice, article text, editors' tag, teacher's tag, student v1 tag, v1 confidence, student v2 tag,
  // v2 confidence]. Text from the gen-* recordings (made-up articles), editors' tag from build_pool.py, teacher's tag from
  // tag3-<id>.json, student columns from train_student_v1.out.txt and train_student_v2.out.txt.
  const TEST = [
    ["e01", "clear", "Skyward Airlines Reports Record Summer Travel. The airline saw a 25% increase in passenger numbers compared to last year, boosting revenues significantly amid rising demand for holiday destinations.", "Business", "Business", "Business", 0.605, "Business", 0.582],
    ["e02", "clear", "Cedar Grove Organic Market expands its product line, now offering vegan cheeses and gluten-free pastries, leading to a 30% rise in foot traffic and heightened interest across social media platforms.", "Business", "Business", "Business", 0.491, "Business", 0.481],
    ["e03", "clear", "Retail sales in Pebbleton reached a new high in Q3, reflecting a 15% increase year-over-year, as shoppers flocked to newly opened boutique stores in the revitalized downtown area.", "Business", "Business", "Business", 0.86, "Business", 0.846],
    ["e04", "clear", "VistaPeak Renewable Energy Secures Funding for Expansion. The clean energy firm will use the investment to develop new solar farms, aiming to enhance capacity and reduce energy costs for local communities.", "Business", "Business", "Business", 0.576, "Business", 0.55],
    ["e05", "clear", "Track and field star Anna Rivers sets a new personal best in the long jump at the State Athletic Trials, landing a distance of 6.78 meters.", "Sport", "Sport", "Sport", 0.811, "Sport", 0.775],
    ["e06", "clear", "The Mountainview Martial Arts Academy introduces self-defense classes for women, aiming to empower participants and enhance their confidence in everyday situations.", "Sport", "Sport", "Health", 0.328, "Culture", 0.475],
    ["e07", "clear", "Riverton Runners set new team relay record at the Urban Sprint. The four-member team clocked in at 1 hour and 34 seconds, beating the previous record held for nearly a decade.", "Sport", "Sport", "Sport", 0.919, "Sport", 0.905],
    ["e08", "clear", "The Coastal Sailors Club hosts its annual regatta, featuring boats of all sizes competing for prizes in a thrilling weekend of sailing and community festivities.", "Sport", "Sport", "Sport", 0.726, "Sport", 0.752],
    ["e09", "clear", "Northern Falcons secure their place in the playoffs after a dramatic win. The Falcons defeated the Silver Wolves 4-3 in a high-stakes match that kept fans on the edge of their seats.", "Sport", "Sport", "Sport", 0.881, "Sport", 0.86],
    ["e10", "clear", "Mountainside Tennis Club hosts the annual Spring Open. Top-ranked players from across the region participated in the tournament, showcasing their skills in a week-long series of intense matches.", "Sport", "Sport", "Sport", 0.874, "Sport", 0.848],
    ["e11", "clear", "CipherLink discovers a security flaw in the latest network protocol, recommending immediate updates to safeguard against potential data breaches.", "Tech", "Tech", "Tech", 0.921, "Tech", 0.898],
    ["e12", "clear", "TechGrove develops an innovative cloud storage solution, CloudNest, featuring advanced encryption and collaboration tools for teams working remotely, aiming to provide a seamless experience for document sharing and management.", "Tech", "Tech", "Tech", 0.913, "Tech", 0.902],
    ["e13", "clear", "EcoSphere Technologies introduces a revolutionary home air purifier, EcoBreeze, which uses advanced sensors to optimize indoor air quality based on real-time environmental data. The device also syncs with smart home systems for better integration.", "Tech", "Tech", "Tech", 0.641, "Tech", 0.585],
    ["e14", "clear", "Nova AI introduces a new voice assistant, VoiceMate, which uses advanced natural language processing to understand and respond to emotional tones in conversations.", "Tech", "Tech", "Tech", 0.733, "Tech", 0.678],
    ["e15", "clear", "Annual health fair at Sunshine Community Hospital focuses on preventive care. Free screenings, fitness classes, and nutrition workshops aimed to encourage residents to take charge of their health and well-being.", "Health", "Health", "Health", 0.894, "Health", 0.909],
    ["e16", "clear", "Groundbreaking research indicates plant-based diets reduce inflammation. The HealthVibes Institute found that individuals on a plant-based diet had lower markers of inflammation compared to their meat-eating counterparts.", "Health", "Health", "Health", 0.947, "Health", 0.916],
    ["e17", "clear", "Men’s health study links regular exercise to reduced risk of prostate issues. The ActiveMen Institute found that men participating in consistent aerobic workouts had a 25% lower risk of developing prostate complications.", "Health", "Health", "Health", 0.893, "Health", 0.835],
    ["e18", "clear", "Meditation retreats gain popularity among corporate professionals. At CalmPulse Retreat Center, executives report record levels of relaxation and productivity after weekend-long meditation sessions.", "Health", "Health", "Health", 0.809, "Health", 0.678],
    ["e19", "clear", "Research from Hillcrest University suggests that brisk walking for at least 30 minutes a day can lead to lasting improvements in mental health, particularly among teenagers.", "Health", "Health", "Health", 0.866, "Health", 0.827],
    ["e20", "clear", "Author Elara James Releases Highly-Awaited Novel, \"Shadow of the Stars\". The science fiction narrative has garnered positive reviews for its rich world-building and complex characters, making it a must-read for genre enthusiasts.", "Culture", "Culture", "Culture", 0.822, "Culture", 0.863],
    ["e21", "clear", "Artisanal Craft Fair Returns to Riverton Park. Featuring handmade goods and local artisans, this beloved annual fair celebrates creativity and offers a platform for talented craftsmen to showcase their work.", "Culture", "Culture", "Culture", 0.563, "Culture", 0.429],
    ["e22", "clear", "\"Lost in Time\" Radio Drama Captivates Audiences in its Debut Episode. This original series immerses listeners in gripping historical narratives, merging entertainment with education through sound and storytelling.", "Culture", "Culture", "Culture", 0.784, "Culture", 0.805],
    ["e23", "clear", "Artful Waves Exhibition Highlights Sustainable Fashion. Showcasing eco-friendly clothing designs, this event encourages discussions about sustainability while inspiring attendees to rethink their fashion choices.", "Culture", "Culture", "Culture", 0.83, "Culture", 0.887],
    ["e24", "clear", "New Musical \"City of Dreams\" Set to Debut at Crestfield Theatre. Featuring a diverse cast and an eclectic score, the production promises to engage audiences with its relatable themes of ambition and community.", "Culture", "Culture", "Culture", 0.772, "Culture", 0.666],
    ["e25", "clear", "The Wandering Bard Poetry Collection Released by Taryn Isley. The anthology explores themes of identity and resilience, resonating deeply with readers and sparking literary discussions across various communities.", "Culture", "Culture", "Culture", 0.946, "Culture", 0.956],
    ["e26", "review", "HyperCharge Pro Laptop Sets New Performance Standards. With an incredible battery life and cutting-edge graphics, this laptop caters perfectly to gamers and professionals alike, making it a worthy go-to device.", "Culture", "Culture", "Tech", 0.36, "Culture", 0.612],
    ["e27", "review", "AeroGlow Yoga Mat Stands Out for Durability. Its added thickness and non-slip surface provide great support during practice, making it a solid purchase for dedicated yogis seeking quality gear.", "Culture", "Culture", "Health", 0.51, "Culture", 0.711],
    ["e28", "review", "EchoNoise Wireless Headphones: A Superb Audio Experience. These noise-canceling headphones provide crystal-clear sound while being comfortable for long wear, earning their place as an essential must-have for music lovers.", "Culture", "Culture", "Culture", 0.705, "Culture", 0.893],
    ["e29", "review", "Zygo Pro Running Shoes Exceed Expectations. These lightweight shoes offer unparalleled comfort and grip, making them a worthwhile investment for serious runners keen to enhance their performance.", "Culture", "Culture", "Sport", 0.548, "Culture", 0.623],
    ["e30", "review", "FlexRacquet 3000: A Game-Changer for Tennis Players. Lightweight and designed for optimal control, this racket enhances power and precision on the court, and is absolutely recommended for both amateurs and pros.", "Culture", "Culture", "Tech", 0.339, "Culture", 0.587],
    ["e31", "review", "FitDiet App: Revolutionizing Healthy Eating. This app’s personalized meal plans and extensive recipe database offer great motivation for a healthier lifestyle, but its subscription model could become costly over time.", "Culture", "Culture", "Health", 0.853, "Health", 0.737],
    ["e32", "review", "SkyStride Runners: Unmatched Comfort and Style. These lightweight shoes boast a unique gel cushioning that makes running a breeze, but at a premium price, they may not be ideal for budget-conscious joggers.", "Culture", "Culture", "Sport", 0.494, "Culture", 0.782],
    ["e33", "review", "HarpWell Blood Pressure Monitor: Reliable and Easy to Use. Its user-friendly interface and accurate readings make this monitor a smart choice for individuals looking to keep tabs on their health at home.", "Culture", "Culture", "Health", 0.276, "Culture", 0.705],
    ["e34", "review", "VeloX Pro Bike: Speed Meets Durability. Designed for performance on rugged terrain, the VeloX Pro offers incredible stability and lightweight design, making it a worthy investment for serious cyclists seeking adventure.", "Culture", "Culture", "Sport", 0.311, "Culture", 0.816],
    ["e35", "review", "SonicWave Watch: Perfect for Runners. Lightweight with GPS functionality and pace tracking, the SonicWave is essential for serious runners, though some users find its battery life lacking during long-distance events.", "Culture", "Culture", "Sport", 0.262, "Culture", 0.918]
  ].map(([id, slice, text, ref, teacher, s1, c1, s2, c2]) => ({ id, slice, text, ref, teacher, s1, c1, s2, c2 }));
  const REC_TAGS = { src: "s6-distillation/tag3-e01 … tag3-e35", provider: "openrouter", model: "deepseek/deepseek-chat", recordedAt: "2026-11-17" };
  const REC_ARTICLES = { src: "s6-distillation/gen-*", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-17" };
  const CAPTION = `Teacher's tags: recorded model output, ${REC_TAGS.recordedAt}. Student's tags: our run on a laptop (an M1 Mac).`;

  // From train_student_v1.out.txt / train_student_v2.out.txt and the tag3-a*, tag3-x* recordings
  const ARCHIVE = 153;            // archive rows the student trained on (v1)
  const ARCHIVE_REVIEWS = 6;      // of which reviews; the teacher tagged all 6 Culture
  const ARCHIVE_REVIEWS_CULTURE = 6;
  const EXTRA = 26;               // extra reviews added for v2, tagged by the teacher
  const EXTRA_CULTURE = 23;       // of which the teacher tagged Culture (x01, x09: Health; x13: Tech)
  const STUDENT_MS = 20.5;        // median time per article, encoder + layer, train_student_v1.out.txt
  const STUDENT_PARAMS = "about 23 million"; // 'ollama show all-minilm' in env.txt: parameters 23M (model card: 22.7M)
  const EMBED_LEN = 384;          // same, embedding length
  // Setup history (first_try_money_rule.out.txt, second_try_v1.out.txt)
  const FIRST_TRY = { right: 9, of: 10 };   // student on money-news-in-other-fields under a "money is Business" rule
  const SECOND_TRY = { right: 4, of: 10 };  // teacher on the test reviews with the first, vaguer wording of the rule
  // Teacher cost, sum of costUsd over the 35 tag3-e* recordings (reported by OpenRouter, prices of that day)
  const TEACHER_USD_35 = 0.001439578;

  // distil_short.py: the function as it ran (line 0 = def) and its two print lines (the blank lines and the
  // `extra = json.load(open("extra_reviews.json"))` line between them are left out), and distil_short.out.txt
  const CODE = [
    "def distil(archive, test_set):",
    "    tags = [teacher_tag(a[\"id\"]) for a in archive]",
    "    X = embed([a[\"text\"] for a in archive])",
    "    W, b = train_softmax(X, ids(tags))",
    "    T = embed([t[\"text\"] for t in test_set])",
    "    guesses = predict(W, b, T).argmax(1)",
    "    score = {\"clear\": [], \"review\": []}",
    "    for t, g in zip(test_set, guesses):",
    "        score[slice_of(t)].append(TAGS[g] == t[\"ref\"])",
    "    return {k: count(v) for k, v in score.items()}",
    "",
    "print(\"v1\", distil(archive, test_set))",
    "print(\"v2\", distil(archive + extra, test_set))"
  ];
  const OUT_V1 = "v1 {'clear': '24/25', 'review': '1/10'}";
  const OUT_V2 = "v2 {'clear': '24/25', 'review': '9/10'}";

  /* ---------- Derived from the data ---------- */
  const right = (rows, col) => rows.filter(r => r[col] === r.ref).length;
  const CLEAR = TEST.filter(r => r.slice === "clear"), REV = TEST.filter(r => r.slice === "review");
  const S = {
    teacher: { clear: right(CLEAR, "teacher"), review: right(REV, "teacher"), all: right(TEST, "teacher") },
    v1: { clear: right(CLEAR, "s1"), review: right(REV, "s1"), all: right(TEST, "s1") },
    v2: { clear: right(CLEAR, "s2"), review: right(REV, "s2"), all: right(TEST, "s2") }
  };
  const headline = t => { const k = t.search(/[.:](\s|$)/); return k > 0 && k < 90 ? t.slice(0, k + 1) : t; };
  // real traffic: reviews are as rare as in the archive
  const SHARE_REV = ARCHIVE_REVIEWS / ARCHIVE;
  const trafficAcc = s => (1 - SHARE_REV) * s.clear / CLEAR.length + SHARE_REV * s.review / REV.length;
  // confidence fallback: articles below the threshold go to the teacher
  const fallback = th => {
    const sent = TEST.filter(r => r.c1 < th);
    const tag = r => (r.c1 < th ? r.teacher : r.s1);
    return { th, sent: sent.length, clear: CLEAR.filter(r => tag(r) === r.ref).length, review: REV.filter(r => tag(r) === r.ref).length,
      sentClear: sent.filter(r => r.slice === "clear").length, missed: REV.filter(r => tag(r) !== r.ref) };
  };
  const USD_PER_1000 = TEACHER_USD_35 / TEST.length * 1000;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-rows { margin: 16px 0 0; display: grid; gap: 8px; }
      .lx-${ID}-art { display: block; width: 100%; min-height: 44px; text-align: left; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: inherit; cursor: pointer; }
      .lx-${ID}-art.lx-${ID}-static { cursor: default; }
      .lx-${ID}-art p { margin: 0; font-size: 15px; line-height: 1.45; }
      .lx-${ID}-tags { margin-top: 6px; font: 500 13.5px/1.5 var(--mono); color: var(--muted); }
      .lx-${ID}-tags b { color: var(--ink); font-weight: 600; }
      .lx-${ID}-art.lx-${ID}-miss { border-color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-art.lx-${ID}-ok { border-color: var(--line); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-grid { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-grid th, .lx-${ID}-grid td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-grid th { font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-grid td.n { font-family: var(--mono); white-space: nowrap; }
      .lx-${ID}-grid tr.lx-${ID}-hot td { font-weight: 600; }
      .lx-${ID}-flow { margin: 14px 0 0; padding: 0; list-style: none; counter-reset: f; border-top: 1px solid var(--line); }
      .lx-${ID}-flow li { counter-increment: f; padding: 8px 0 8px 2em; position: relative; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-flow li::before { content: counter(f) "."; position: absolute; left: 0; font-family: var(--mono); color: var(--muted); }
      .lx-${ID}-out { margin: 8px 0 0; font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); }
    `;
    document.head.appendChild(s);
  }
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const tagLine = (kit, r, col) => `editors <b>${kit.esc(r.ref)}</b> · teacher <b>${kit.esc(r.teacher)}</b> · student <b>${kit.esc(r[col])}</b>`;
  function sliceTable(kit, rows, hot) {
    return `<table class="lx-${ID}-grid"><thead><tr><th>slice</th><th>teacher</th><th>student</th></tr></thead><tbody>${rows.map(([name, t, s, n]) =>
      `<tr${name === hot ? ` class="lx-${ID}-hot"` : ""}><td>${kit.esc(name)}</td><td class="n">${t} of ${n}</td><td class="n">${s} of ${n}</td></tr>`).join("")}</tbody></table>`;
  }
  const v1Rows = () => [["clear articles", S.teacher.clear, S.v1.clear, CLEAR.length], ["reviews", S.teacher.review, S.v1.review, REV.length], ["all", S.teacher.all, S.v1.all, TEST.length]];

  /* 1. The situation, and what the student learns from. */
  function thePlan({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The large model's prompt, with the house rule in it",
      `The large model's tags on ${ARCHIVE} archive articles`,
      `Tags that the editors write by hand for the ${ARCHIVE} archive articles`,
      `The editors' test set of ${TEST.length} articles`
    ];
    const RIGHT = 1;
    const fb = [
      [`This student cannot read instructions. It is a small encoder that turns an article into ${EMBED_LEN} numbers, plus one layer that learns which numbers mean which tag. It only learns from examples: articles with the tag they should get.`, false],
      [`Right. The large model is the <b>teacher</b>: it tags the archive, one call per article, as it does every day. The small model is the <b>student</b>: it trains on those tags, then runs on Brightwire's own server. Training a small model on a large model's answers is called <b>distillation</b>. Nobody tagged the archive by hand.`, true],
      ["That would work, but it is ordinary training with people's labels, and it costs weeks of editors' time. The point of distilling is that the large model, which already does the job, writes the labels.", false],
      ["The test set must stay unseen. If the student trains on it, its test score tells you what it memorised, not how it does on new articles. The test set is how you will check the student later.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The tagging bill</h1>
        <p class="lead">Brightwire (made up for this lesson) sorts news articles into five desks: Business, Sport, Tech, Health and Culture. Today a large hosted model reads every article and answers with one tag: the name of a desk. The volume keeps growing, and so does the monthly bill.</p>
        <p class="lead">One house rule matters: <b>every review goes to Culture</b>, where the reviews desk sits, even a review of a phone or a running shoe. The rule is written in the large model's prompt.</p>
        <p class="lead">The team's plan to cut the bill: replace the large model with a small one that runs on their own server.</p>
        <ol class="lx-${ID}-flow"><li>The large model tags ${ARCHIVE} articles from the archive.</li><li>A small model (${STUDENT_PARAMS} parameters, small enough for a laptop) trains on them.</li><li>The small model tags new articles on Brightwire's own server.</li></ol>
        <p class="task">In step 2, what does the small model learn from?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand: find the student's mistakes in the test results. */
  const PICK = ["e03", "e26", "e11", "e28", "e06", "e30", "e22", "e33", "e31", "e16", "e35"];
  function scorecard({ el, done, kit }) {
    ensureStyle();
    const rows = PICK.map(id => TEST.find(r => r.id === id));
    const misses = rows.filter(r => r.s1 !== r.ref).map(r => r.id);
    const found = new Set();
    let note = null;
    const paint = () => {
      const all = found.size === misses.length;
      el.innerHTML = `<h1>Read the test results</h1>
        <p class="lead">The student is trained. The editors tagged a test set of ${TEST.length} articles that neither model has seen, and both models tagged it too. Here are ${rows.length} of them. (All articles in this lesson are made up: a small hosted model wrote them.)</p>
        <p class="task">Tap every article the student got wrong, judged against the editors. ${all ? "" : `Found ${found.size} so far.`}</p>
        <div class="lx-${ID}-rows">${rows.map(r => {
          const miss = found.has(r.id);
          return `<button type="button" class="lx-${ID}-art${miss ? ` lx-${ID}-miss` : ""}" data-i="${r.id}" aria-pressed="${miss}"><p>${kit.esc(r.text)}</p><div class="lx-${ID}-tags">${tagLine(kit, r, "s1")}</div></button>`;
        }).join("")}</div>
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <div class="lpanel">${note ? kit.feedback(note[0], note[1]) : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-art`).forEach(b => b.onclick = () => {
        const r = TEST.find(x => x.id === b.dataset.i);
        if (r.s1 === r.ref) { note = [`The student said ${kit.esc(r.s1)} and the editors said ${kit.esc(r.ref)}. That one is right; look for rows where the two differ.`, false]; paint(); return; }
        found.add(r.id);
        note = found.size === misses.length
          ? [`All ${misses.length} found. The teacher got every one of these right; the student did not. Read the marked articles again before you go on: what do most of them have in common?`, true]
          : [`Yes: the editors said ${kit.esc(r.ref)}, the student said ${kit.esc(r.s1)}.`, undefined];
        paint();
        if (found.size === misses.length) done();
      });
    };
    paint();
  }

  /* 3. Find the slice. */
  function findSlice({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const marked = PICK.map(id => TEST.find(r => r.id === id)).filter(r => r.s1 !== r.ref);
    const revMarked = marked.filter(r => r.slice === "review").length;
    const opts = [
      "They are all sport news",
      "They are reviews: each judges one product and says whether it is worth buying",
      "They are the longest articles",
      "The teacher got them wrong too"
    ];
    const RIGHT = 1;
    const tableHtml = `${sliceTable(kit, v1Rows(), "reviews")}<p class="lx-${ID}-cap">Whole test set: ${CLEAR.length} clear articles (not reviews: their words usually point to the right desk) and ${REV.length} reviews of products from sport, tech and health.</p>`;
    const fb = [
      [`Only some are about sport. Look at the laptop and the blood pressure monitor: one reads like Tech, one like Health. What they share is the kind of article, not the field.`, false],
      [`Right: ${revMarked} of the ${marked.length} marked articles are reviews. The editors tag them Culture by the house rule; the student tagged them by what the product is. That group is a <b>slice</b>: a kind of case you score on its own. The whole test set says the same:${tableHtml}The teacher's ${S.teacher.review} of ${REV.length} came only after we wrote the rule out in full in its prompt. With our first, vaguer wording it followed the rule on ${SECOND_TRY.right} of ${SECOND_TRY.of} reviews, and a student can only copy what the teacher does.`, true],
      ["Length is not it: on the last screen the short security-flaw article was right, and the short martial-arts one here was wrong. Look at what kind of article each marked one is.", false],
      [`Every row shows the teacher's tag equal to the editors'. The teacher got all ${S.teacher.all} of ${TEST.length} test articles right. (With our first, vaguer wording of the rule, the teacher itself followed it on only ${SECOND_TRY.right} of ${SECOND_TRY.of} reviews, and a student can only copy what the teacher does. So check the teacher on a hard group first. We fixed ours by writing the rule out in full.)`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Find the slice</h1>
        <p class="lead">These are the articles you marked as the student's mistakes:</p>
        <div class="lx-${ID}-rows">${marked.map(r => `<div class="lx-${ID}-art lx-${ID}-static"><p>${kit.esc(r.text)}</p><div class="lx-${ID}-tags">${tagLine(kit, r, "s1")}</div></div>`).join("")}</div>
        <p class="task">What do most of them have in common?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: the student learns only what the teacher's labels show, as often as they show it. */
  function whyLost({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A model this small can never learn a rule like that",
      `The rule was only in the teacher's prompt. The student learned it from examples, and the archive held ${ARCHIVE_REVIEWS} reviews in ${ARCHIVE} articles, while a shoe review uses the same words as sport news`,
      "The teacher tagged the archive's reviews wrong, and the student copied the mistakes",
      `Ten test reviews are too few to say anything`
    ];
    const RIGHT = 1;
    const fb = [
      ["Size is not the first suspect: the student got almost every clear article right with the same layer. Whether it can learn reviews is a question you can test by giving it more of them. The next screens do exactly that.", false],
      [`Right. The student never saw the rule. It only saw ${ARCHIVE} articles with tags, and ${ARCHIVE_REVIEWS} of them were reviews. A running-shoe review is full of sport words, so the student follows the words. This is the core of distillation: <b>the student learns what the teacher's labels show it, in proportion to how often they show it.</b> Rare cases, and cases where the words point the wrong way, are where it falls behind. (Our first try used a rule whose words matched the tag: “money news is Business”. The student got that right on ${FIRST_TRY.right} of ${FIRST_TRY.of} test cases. Hard slices are the ones where the surface words mislead.)`, true],
      [`The recording says otherwise: the teacher tagged all ${ARCHIVE_REVIEWS_CULTURE} archive reviews Culture. The labels were right; there were just very few of them.`, false],
      [`Ten is small for a precise number, but ${S.v1.review} of ${REV.length} against the teacher's ${S.teacher.review} of ${REV.length} on the same articles is not noise. A gap that large shows up even on a small slice.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why the student lost the reviews</h1>
        <p class="lead">On reviews the teacher scored ${S.teacher.review} of ${REV.length}; the student, trained on the teacher's own tags, scored ${S.v1.review} of ${REV.length}.</p>
        <p class="task">What is the main reason?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. The average hides the slice: predict the score on real traffic. */
  function averageHides({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const real = pct(trafficAcc(S.v1), 1);
    const testAll = pct(S.v1.all, TEST.length);
    const reviewOnly = pct(S.v1.review, REV.length);
    const clearOnly = pct(S.v1.clear, CLEAR.length);
    const cand = [...new Set([testAll, real, reviewOnly, 99])].sort((a, b) => a - b);
    const RIGHT = cand.indexOf(real);
    const say = v => v === testAll
      ? `${testAll}% is the score on this test set, where reviews are ${REV.length} of ${TEST.length} on purpose. In traffic they are far rarer, so they pull the average down much less.`
      : v === reviewOnly ? `${reviewOnly}% is the reviews slice alone. Reviews are only ${ARCHIVE_REVIEWS} in ${ARCHIVE} articles, so most articles the student sees are clear ones, where it scores ${clearOnly}%.`
      : `Higher than the student scores even on clear articles (${clearOnly}%). The review mistakes still count, a little.`;
    const paint = () => {
      el.innerHTML = `<h1>What the average shows</h1>
        <p class="lead">Before launch, the team will report one number: the student's accuracy on the kind of traffic it will see (the articles that arrive each day). In traffic, reviews are as rare as in the archive: ${ARCHIVE_REVIEWS} in ${ARCHIVE}. Clear articles: student ${S.v1.clear} of ${CLEAR.length}. Reviews: student ${S.v1.review} of ${REV.length}.</p>
        <p class="task">Weight each slice by how common it is in traffic. About what accuracy will the report show?</p>
        <div class="lpanel">${kit.options(cand.map(v => `${v}%`), { picked: ans, correct: RIGHT })}
        ${ans == null ? "" : ans === RIGHT
          ? kit.feedback(`Right: ${ARCHIVE - ARCHIVE_REVIEWS}/${ARCHIVE} × ${S.v1.clear}/${CLEAR.length} + ${ARCHIVE_REVIEWS}/${ARCHIVE} × ${S.v1.review}/${REV.length} ≈ ${real}%. A team that sees that number ships the student. Then the reviews desk receives only about 1 review in ${Math.round(REV.length / Math.max(1, S.v1.review))}. So: <b>score the student per slice, next to the teacher</b>, and build the test set so each hard slice has enough cases to count (here ${REV.length} of ${TEST.length}, far more than in traffic).`, true)
          : kit.feedback(say(cand[ans]), false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Fix 1, in Python: more teacher-labelled hard rows. Predict, then see the run. */
  function moreHardRows({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `It stays near ${S.v1.review} of ${REV.length}: the student is too small for reviews`,
      `It rises a lot, close to the teacher, and clear articles stay about the same`,
      "It rises on reviews, but clear articles drop a lot",
      `It reaches ${REV.length} of ${REV.length}, exactly like the teacher`
    ];
    const RIGHT = 1;
    const ran = `<div class="lx-${ID}-out">${kit.esc(OUT_V1)}\n${kit.esc(OUT_V2)}</div><p class="lx-${ID}-cap">Output of distil_short.py, our run.</p>`;
    const fb = [
      [`The run says otherwise:${ran}Same student, same layer. It needed examples, not size.`, false],
      [`Right:${ran}Reviews went from ${S.v1.review} to ${S.v2.review} of ${REV.length}; clear articles stayed at ${S.v2.clear} of ${CLEAR.length}. The cheap fix for a lost slice is to <b>have the teacher label more of that slice</b> and retrain. Two cautions. The teacher tagged only ${EXTRA_CULTURE} of the ${EXTRA} extra reviews Culture, and those ${EXTRA - EXTRA_CULTURE} wrong labels went into training too: the student inherits the teacher's mistakes. And the same model wrote the extra reviews and the test reviews, so check again on fresh articles after launch.<br><br>Here the student learned from the teacher's one tag only. The paper that named distillation (Hinton and others, 2015) trains on the teacher's probability for every tag, called “soft targets”. Its authors note that, when those probabilities are spread out, they carry much more information per example than one tag.`, true],
      [`The run says otherwise:${ran}Clear articles stayed at ${S.v2.clear} of ${CLEAR.length}. Adding a few dozen rows of one kind did not push the rest aside here; that is worth checking every time, and the per-slice score is how you check it.`, false],
      [`Close, but not quite:${ran}One review (the diet app) is still tagged Health. A student usually ends a little behind its teacher; what you check is that no slice is far behind.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Fix 1: more hard rows</h1>
        <p class="lead">This is the whole distillation step as it ran. <code>teacher_tag</code> reads the teacher's recorded tag for an article. <code>embed</code> asks the small local encoder for ${EMBED_LEN} numbers per article. <code>train_softmax</code> trains the one layer that learns, and <code>predict</code> gives its probability for each tag; <code>argmax</code> keeps the most likely one. <code>slice_of</code> says “clear” or “review”, and <code>count</code> turns the list of right and wrong into “right/total”. <code>extra</code> holds ${EXTRA} more reviews, also tagged by the teacher. The first call trains on the archive alone: that is <b>v1</b>, the student you have seen. The second call adds the extra reviews: <b>v2</b>.</p>
        ${kit.code(CODE, ans === RIGHT ? CODE.length - 1 : 1)}
        <p class="task">The first line prints the v1 scores you already know. What happens to the review score in the second line?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Fix 2: send the student's unsure answers to the teacher. */
  const THRESH = [0.4, 0.55, 0.7, 0.9];
  function fallbackTo({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const R = THRESH.map(fallback);
    // the right pick: the smallest threshold whose review score is the best one reachable below 0.9
    const best = Math.max(...R.slice(0, -1).map(r => r.review));
    const RIGHT = R.findIndex(r => r.review === best);
    const say = i => {
      const r = R[i];
      if (i === RIGHT) return [`Right. At ${r.th}, ${plural(r.sent, "article")} of ${TEST.length} go to the teacher, and the reviews slice goes to ${r.review} of ${REV.length}. The one it misses, the diet app, the student tagged Health with confidence ${TEST.find(x => x.id === r.missed[0].id).c1}: <b>confidence is not correctness</b>, so a fallback catches unsure mistakes, not confident ones. Two more cautions: every article sent back costs a teacher call again, and we picked the threshold on the test set itself. In real work, pick it on a separate set of checked articles, then measure on the test set.`, true];
      if (r.th < THRESH[RIGHT]) {
        const between = REV.filter(x => x.s1 !== x.ref && x.c1 >= r.th && x.c1 < THRESH[RIGHT]).length;
        return [`Too low: only ${plural(r.sent, "article")} go to the teacher and reviews reach ${r.review} of ${REV.length}. ${plural(between, "wrong review")} had a confidence between ${r.th} and ${THRESH[RIGHT]}, so they stay with the student.`, false];
      }
      if (r.review === R[RIGHT].review) return [`It works, but it sends ${r.sent} of ${TEST.length} articles to the teacher for the same ${r.review} of ${REV.length} on reviews as ${THRESH[RIGHT]}. Every article sent back is a paid teacher call again; you pay more and fix nothing new.`, false];
      return [`It catches the last review too (${r.review} of ${REV.length}), but ${r.sent} of ${TEST.length} articles go back to the teacher. Most of the traffic pays for the teacher again, so the student saves almost nothing.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>Fix 2: a fallback to the teacher</h1>
        <p class="lead">The student's layer gives a probability for each tag. Its largest one is its <b>confidence</b>. A second fix keeps the v1 student (trained on the archive alone) but sends every article it is unsure about to the teacher, the routing idea from the last lesson. “Unsure” means its confidence is below a cut-off you choose, the <b>threshold</b>.</p>
        <table class="lx-${ID}-grid"><thead><tr><th>threshold</th><th>sent to teacher</th><th>clear right</th><th>reviews right</th></tr></thead><tbody>
        ${R.map((r, i) => `<tr${i === pick ? ` class="lx-${ID}-hot"` : ""}><td class="n">below ${r.th}</td><td class="n">${r.sent} of ${TEST.length}</td><td class="n">${r.clear} of ${CLEAR.length}</td><td class="n">${r.review} of ${REV.length}</td></tr>`).join("")}
        </tbody></table>
        <p class="lx-${ID}-cap">Computed from the student's recorded confidences and the teacher's recorded tags on the ${TEST.length} test articles.</p>
        <p class="lead">Without any fallback the student scored ${S.v1.clear} of ${CLEAR.length} on clear articles and ${S.v1.review} of ${REV.length} on reviews.</p>
        <p class="task">Read the table. Which threshold would you ship? Every article sent back is a paid teacher call again, so you want the reviews fixed while the student keeps most of the articles.</p>
        <div class="lpanel">${kit.options(R.map(r => `below ${r.th}`), { picked: pick, correct: RIGHT })}${pick == null ? "" : kit.feedback(...say(pick))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === RIGHT) done(); });
    };
    paint();
  }

  /* 8. When it pays: the break-even volume, by hand. */
  // Exercise numbers, stated as assumptions in the text (cost units, not prices)
  const BIG_PER_1000 = 2, SERVER = 250, UPKEEP = 150, BUILD = 2400, VOLUME = 400000;
  function breakEven({ el, done, kit }) {
    ensureStyle();
    let step = 0, ans = null;
    const big = VOLUME / 1000 * BIG_PER_1000, run = SERVER + UPKEEP, save = big - run;
    const months = BUILD / save;
    const even = run / BIG_PER_1000 * 1000;
    const Q = [
      { q: `How much does Brightwire save each month at ${VOLUME.toLocaleString("en")} articles?`,
        opts: [big, big - SERVER, save, big + run], right: 2,
        fb: v => v === big ? `That is the large model's whole bill. The student is not free: its server and upkeep cost ${run} a month.`
          : v === big - SERVER ? `You took off the server but not the upkeep (${UPKEEP} a month). Someone has to re-check the student and retrain it when the articles change.`
          : `The student's costs come off the bill, they do not add to it: ${big} − ${run}.` },
      { q: "Leave the build cost aside. Below what monthly volume does the student cost more each month than the large model?",
        opts: [even / 2, even, VOLUME, BUILD / BIG_PER_1000 * 1000], right: 1,
        fb: v => v === VOLUME ? `At ${VOLUME.toLocaleString("en")} it saves ${save} a month, so the break-even is lower. Find where the large model's bill equals the student's ${run}.`
          : v === even / 2 ? `At ${(even / 2).toLocaleString("en")} articles the large model costs ${even / 2 / 1000 * BIG_PER_1000}, less than the student's ${run} a month. Brightwire would lose money every month.`
          : `That volume makes one month of large-model bill equal the build cost. The question is about the monthly costs only: where does the large model's bill equal ${run}?` }
    ];
    const paint = () => {
      const q = Q[Math.min(step, 1)];
      el.innerHTML = `<h1>Does it pay?</h1>
        <p class="lead">Exercise numbers, in cost units (assumptions for this exercise, not prices): the large model costs <b>${BIG_PER_1000}</b> per 1,000 articles. The student's server costs <b>${SERVER}</b> a month, and upkeep (re-checking the slices, relabelling, retraining) <b>${UPKEEP}</b> a month. Building it once (engineer time, teacher labels, the editors' test set) cost <b>${BUILD.toLocaleString("en")}</b>. Brightwire tags <b>${VOLUME.toLocaleString("en")}</b> articles a month.</p>
        ${step >= 1 ? kit.feedback(`Saving: ${big} − ${run} = <b>${save}</b> a month, so the build pays back in ${months} months.`, true) : ""}
        ${step < 2 ? `<p class="task">${q.q}</p><div class="lpanel">${kit.options(q.opts.map(v => v.toLocaleString("en")), { picked: ans, correct: q.right })}${ans == null ? "" : kit.feedback(q.fb(q.opts[ans]), false)}</div>`
          : `<div class="lpanel">${kit.feedback(`Right: ${run} ÷ ${BIG_PER_1000} × 1,000 = <b>${even.toLocaleString("en")}</b> articles a month. Below that, the student costs more than the large model every month and never pays back its build.<br><br>Now a real number. Our teacher's charge for the ${TEST.length} test articles, as reported on ${REC_TAGS.recordedAt} (prices of that day), works out to about $${USD_PER_1000.toFixed(3)} per 1,000 short articles: about $${(USD_PER_1000 * VOLUME / 1000).toFixed(0)} for a ${VOLUME.toLocaleString("en")}-article month. With a teacher priced like that, the student's server and upkeep would have to cost less than that every month. <b>Do this sum with your real bill first.</b>`, true)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[step].right) { step++; ans = null; paint(); if (step === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Edit the student's prompt",
      "Change the teacher's prompt, have it relabel the archive and the slices, retrain the student, and score every slice again",
      "Nothing: the student already knows reviews",
      "Change the teacher's prompt only"
    ];
    const RIGHT = 1;
    const fb = [
      ["The student has no prompt. It is a trained layer; what it knows sits in its weights, and only new training data changes them.", false],
      ["Right. Every change to the task means new teacher labels, a retrain and a fresh slice check. That upkeep is the cost people forget, and it is why distillation suits tasks that rarely change.", true],
      ["It knows the old rule, which now gives the wrong answer for every review. A student cannot follow a rule change it has never seen in its training data.", false],
      ["The teacher would follow the new rule, but the student never reads the teacher's prompt. It would keep sending reviews to Culture.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to distil</h1>
        <p class="lead"><b>For:</b> a narrow task a large model already does well, at high volume, where cost or latency hurts. (Our student tagged an article in about ${Math.round(STUDENT_MS)} ms on a laptop, with no network call.)</p>
        <p class="lead"><b>Not</b> when the volume is low, when the task or its rules change often, or when it needs broad knowledge a small model lacks. Try a cheaper hosted model, caching or routing first. Check the teacher's terms: some providers forbid training competing models.</p>
        <p class="lead"><b>Costs:</b> the build, a test set with hard slices, a server, and upkeep for as long as it runs. The student inherits the teacher's mistakes.</p>
        <p class="task">Six months after launch, the editors move reviews to a new sixth desk, “Reviews”. What has to happen?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, including two where distilling is the wrong move. */
  const CASES = [
    ["A messaging app uses a large model to detect the language of every incoming message, one of twelve languages. Millions of messages a day, and the list of languages has not changed in two years.", true,
      "Yes. Narrow, stable, very high volume: the teacher can label as much as you like, and the saving repeats every day. Score each language on its own, so a rare one is not hidden by the average.",
      "This is the case distillation is for: a narrow task, millions of calls, nothing changing. The monthly saving is large and the upkeep small. Just check the rare languages as slices."],
    ["A legal team asks a large model about thirty open questions a week about new contracts. Every question is different.", false,
      "No. Thirty calls a week is a tiny bill, so no build cost ever pays back. And the questions are open: a small student cannot hold the broad knowledge they need. Keep paying for the large model.",
      "Low volume means the saving cannot pay for a build, a server and upkeep. And open questions need broad knowledge, which is exactly what a small student loses. Keep the large model."],
    ["An online shop sorts products into categories with a large model. Buyers add and rename categories every few weeks.", false,
      "No, not yet. Every category change means new teacher labels, a retrain and a fresh check, every few weeks. The upkeep eats the saving. Keep the category list in the large model's prompt, or try a cheaper hosted model with routing.",
      "The labels keep moving. A student only knows the categories it was trained on, so each change needs relabelling, retraining and re-checking. With changes every few weeks, the upkeep eats the saving."],
    ["A car maker wants the car's own computer to sort each spoken command into navigation, music, climate or phone, also in tunnels with no network. In tests, a large hosted model sorts the commands well once they are written out as text.", true,
      "Yes. A hosted model needs a network, and a car in a tunnel has none. A small student trained on the large model's labels can run on the car's computer, with no network call. Here distillation is about latency and where the model can run, not only cost.",
      "The large model cannot run on the car's computer, and with no network it cannot be called at all. A small student trained on its labels can run in the car. Distillation is about where and how fast the model runs here, not only cost."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Distil or not?</h1>
        <p class="lead">Four teams use a large model today. Distilling means: the large model labels examples, a small model trains on them and takes over.</p>
        <p class="task">Should each team distil? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can judge a distilled model</h1>
      <p class="lead">Distillation means a small student model trains on a large teacher model's answers, then takes over the job. Ours scored ${pct(S.v1.clear, CLEAR.length)}% on clear articles but only ${S.v1.review} of ${REV.length} on reviews. You found that slice by hand. You fixed it with more teacher-labelled reviews (${S.v2.review} of ${REV.length}) or with a fallback to the teacher. Then you worked out the volume below which the student never pays.</p>
      <p class="lead">Before you distil, ask: is the volume high, is the task stable, does the real bill beat server plus upkeep, and does every hard slice survive?</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A student model needs a service of its own to run in; next you package one so it runs the same on every machine.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Distillation: teaching a small model from a big one",
    checked: "2026-11-18",
    sources: [
      "https://arxiv.org/abs/1503.02531",
      "https://docs.ollama.com/api/embed",
      "https://ollama.com/library/all-minilm",
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2",
      "https://openrouter.ai/docs/use-cases/usage-accounting",
      "https://openrouter.ai/docs/faq",
      "https://www.anthropic.com/legal/commercial-terms"
    ],
    interview: [
      {
        q: "Your team distilled a large model into a small classifier. Its overall accuracy is within two points of the large model's. Before rollout, how do you make sure it is safe to ship?",
        good: [
          "Split the test set into slices, especially the rare and tricky kinds, and compare student and teacher on each one",
          "Oversample the rare slices in the test set so each has enough cases to count",
          "Check the teacher against people's labels on those slices first; the student copies its mistakes",
          "If a slice is lost, have the teacher label more of it and retrain, or send low-confidence answers back to the teacher",
          "Keep measuring per slice after launch, on fresh articles"
        ],
        weak: "Overall accuracy is close to the teacher's, so ship it. That misses a rare slice that the average hides."
      },
      {
        q: "Your manager wants to distil the model behind a feature to cut the bill. What do you work out before you agree?",
        good: [
          "The real monthly bill against the student's server, upkeep and build: the break-even volume and the payback time",
          "How often the task or its labels change; each change means relabelling, retraining and re-checking",
          "Whether a cheaper hosted model, caching or routing gets most of the saving with less work",
          "Whether the task is narrow enough for a small model, and whether the provider's terms allow training on its outputs"
        ],
        weak: "Small models are cheaper, so distilling always saves money. That ignores the build, the upkeep and how small the bill may already be."
      }
    ],
    screens: [thePlan, scorecard, findSlice, whyLost, averageHides, moreHardRows, fallbackTo, breakEven, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="e03"]'], right: PICK.filter(id => { const r = TEST.find(x => x.id === id); return r.s1 !== r.ref; }).map(id => `[data-i="${id}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
