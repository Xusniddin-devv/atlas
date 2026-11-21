/* Lesson: classification, detection and segmentation. Story: a warehouse wants to count boxes on its shelves,
   spot the dented ones and measure free shelf space, from one shelf photo. Ideas: (1) the three vision tasks
   differ in the output they return (one label per photo, one rectangle per object, a class for every pixel),
   so you choose the task from the answer the product needs; (2) a hosted vision model can answer without any
   training, but its answer must be checked, and it is not a measuring tool.
   Data, all real:
   - docs/ai-path/runs/s3-vision-tasks/make_shelf.py + make_shelf.out.txt: the made-up shelf picture (drawn with
     Pillow, not photographed) and its layout; the lesson draws the same layout in SVG;
   - recordings (main checkout) docs/ai-path/recordings/s3-vision-tasks/ask, boxes, boxes-larger: the picture sent
     to two hosted models through OpenRouter, request files made by build_requests.py.
   Lesson-local picture: the shelf drawing with tappable stretches (.lx-s3-vision-tasks-*), see ensureStyle()
   and shelf(). Plain browser script. */
(() => {
  const ID = "s3-vision-tasks";
  const pct = (a, b) => Math.round(a / b * 100);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s3-vision-tasks/make_shelf.out.txt (LAYOUT line): a 1000 x 580 picture
  const W = 1000, H = 580, LEFT = 50, RIGHT = 950;
  const LEVELS = [{ name: "upper", floor: 270, top: 30 }, { name: "lower", floor: 540, top: 290 }];
  const BOXES = [
    { id: "b1", level: "upper", x1: 50, x2: 200, h: 150, dented: false },
    { id: "b2", level: "upper", x1: 200, x2: 330, h: 190, dented: false },
    { id: "b3", level: "upper", x1: 380, x2: 600, h: 120, dented: false },
    { id: "b4", level: "upper", x1: 770, x2: 950, h: 170, dented: true },
    { id: "b5", level: "lower", x1: 50, x2: 220, h: 200, dented: true },
    { id: "b6", level: "lower", x1: 220, x2: 390, h: 140, dented: false },
    { id: "b7", level: "lower", x1: 780, x2: 950, h: 180, dented: false }
  ];
  const SACK = { level: "lower", x1: 470, x2: 640, poly: [[470, 540], [478, 505], [500, 482], [535, 470], [575, 468], [610, 478], [632, 500], [640, 540]] };

  // From docs/ai-path/recordings/s3-vision-tasks/ask.json (the question sent with the picture, and the answer, not altered)
  const ASK_Q = ["How many cardboard boxes are on the shelves?", "Which boxes are dented? Say where each one is.", "What percent of the shelf length (both levels together) is empty, with nothing standing on it?"];
  const REC_ASK = {
    src: "s3-vision-tasks/ask", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "Here are the answers to your questions:\n\n1. There are 7 cardboard boxes on the shelves.\n2. The boxes on the top shelf, far right, and the bottom shelf, far left, appear to be dented.\n3. Approximately 45% of the shelf length is empty."
  };
  // From docs/ai-path/recordings/s3-vision-tasks/boxes.json: the full reply (finish_reason "length": it hit max_tokens)
  const BOXES_Q = "Find every cardboard box in this shelf photo. Reply with JSON only: a list with one object per box, each with \"box_2d\": [ymin, xmin, ymax, xmax] scaled to 0-1000, and \"dented\": true or false.";
  const REC_SMALL = {
    src: "s3-vision-tasks/boxes", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    finish: "length", maxTokens: 600, outTokens: 592,
    text: "```json\n[\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [257, 378, 464, 601], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},\n  {\"box_2d\": [136, 56, 464, 332], \"label\": \"cardboard box\"},"
  };
  // From docs/ai-path/recordings/s3-vision-tasks/boxes-larger.json: the same request sent to a larger model
  const REC_LARGE = {
    src: "s3-vision-tasks/boxes-larger", provider: "openrouter", model: "google/gemini-2.5-flash", recordedAt: "2026-11-13",
    finish: "stop",
    text: "```json\n[\n  {\n    \"box_2d\": [200, 45, 460, 200],\n    \"dented\": false\n  },\n  {\n    \"box_2d\": [135, 199, 460, 330],\n    \"dented\": false\n  },\n  {\n    \"box_2d\": [255, 378, 460, 600],\n    \"dented\": false\n  },\n  {\n    \"box_2d\": [170, 769, 460, 950],\n    \"dented\": true\n  },\n  {\n    \"box_2d\": [585, 50, 925, 220],\n    \"dented\": true\n  },\n  {\n    \"box_2d\": [625, 218, 925, 390],\n    \"dented\": false\n  },\n  {\n    \"box_2d\": [615, 779, 925, 949],\n    \"dented\": false\n  }\n]\n```"
  };
  const CAPTION = `Recorded model output, ${REC_ASK.recordedAt}`;

  /* ---------- Derived from the data ---------- */
  const LV = Object.fromEntries(LEVELS.map(l => [l.name, l]));
  const rectOf = b => [b.x1, LV[b.level].floor - b.h, b.x2, LV[b.level].floor];
  const N_BOXES = BOXES.length;
  const DENTED = BOXES.filter(b => b.dented);
  const where = b => {
    const row = BOXES.filter(o => o.level === b.level).sort((p, q) => p.x1 - q.x1);
    const k = row.indexOf(b);
    return `${b.level} level, ${k === 0 ? "far left" : k === row.length - 1 ? "far right" : "middle"}`;
  };
  // empty stretches on each level: the shelf length not covered by a box or the sack
  const gapsOf = covers => LEVELS.flatMap(l => {
    const c = covers.filter(o => o.level === l.name).sort((p, q) => p.x1 - q.x1), out = [];
    let x = LEFT;
    for (const o of c) { if (o.x1 > x) out.push({ level: l.name, x1: x, x2: o.x1 }); x = Math.max(x, o.x2); }
    if (x < RIGHT) out.push({ level: l.name, x1: x, x2: RIGHT });
    return out;
  });
  const GAPS = gapsOf([...BOXES, SACK]).map((g, i) => ({ ...g, id: "g" + (i + 1) }));
  const TOTAL = (RIGHT - LEFT) * LEVELS.length;
  const lenOf = gs => gs.reduce((s, g) => s + g.x2 - g.x1, 0);
  const FREE = lenOf(GAPS), FREE_PCT = pct(FREE, TOTAL);
  const FREE_RECT = lenOf(gapsOf(BOXES)), FREE_RECT_PCT = pct(FREE_RECT, TOTAL);
  const TOUCHING = BOXES.filter((b, i) => BOXES.some(o => o !== b && o.level === b.level && (o.x2 === b.x1 || o.x1 === b.x2))).length;
  const ASK_PCT = +REC_ASK.text.match(/(\d+)%/)[1];
  // recorded rectangles, converted from [ymin, xmin, ymax, xmax] on 0-1000 to picture coordinates
  const parseList = t => JSON.parse(t.replace(/^```json\n/, "").replace(/\n```$/, ""));
  const toRect = bx => [bx[1] / 1000 * W, bx[0] / 1000 * H, bx[3] / 1000 * W, bx[2] / 1000 * H];
  const SMALL_ALL = [...REC_SMALL.text.matchAll(/"box_2d": \[([\d, ]+)\]/g)].map(m => m[1]);
  const SMALL_UNIQ = [...new Set(SMALL_ALL)].map(s => s.split(", ").map(Number));
  const SMALL_HAS_DENT = REC_SMALL.text.includes("dented");
  const LARGE = parseList(REC_LARGE.text).map(o => ({ r: toRect(o.box_2d), dented: o.dented }));
  const iou = (a, b) => {
    const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const inter = ix * iy, area = r => (r[2] - r[0]) * (r[3] - r[1]);
    return inter / (area(a) + area(b) - inter);
  };
  const bestTruth = r => BOXES.map(b => ({ b, v: iou(r, rectOf(b)) })).sort((p, q) => q.v - p.v)[0];
  const LARGE_MATCH = LARGE.map(o => ({ ...o, ...bestTruth(o.r) }));
  const LARGE_MIN_IOU = Math.min(...LARGE_MATCH.map(m => m.v));
  const LARGE_DENT_OK = LARGE_MATCH.every(m => m.dented === m.b.dented);
  const LARGE_DISTINCT = new Set(LARGE_MATCH.map(m => m.b.id)).size;
  const SMALL_MERGED = SMALL_UNIQ.map(bx => toRect(bx)).map(r => BOXES.filter(b => { const t = rectOf(b); return t[0] >= r[0] - 10 && t[2] <= r[2] + 10 && t[1] >= r[1] - 10 && t[3] <= r[3] + 10; }).length);

  /* ---------- Lesson-local style and the shelf picture ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-pic { position: relative; width: 100%; max-width: 640px; aspect-ratio: ${W} / ${H}; margin: 16px 0 6px; }
      .lx-${ID}-pic svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .lx-${ID}-hit { position: absolute; padding: 0; margin: 0; border: 0; background: transparent; cursor: pointer; border-radius: 0; }
      .lx-${ID}-hit:focus-visible { outline: 3px solid var(--ink); outline-offset: -3px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); border-radius: 6px; }
      .lx-${ID}-req { margin: 0 0 6px; }
    `;
    document.head.appendChild(s);
  }
  const P = v => (v / W * 100).toFixed(3) + "%", PY = v => (v / H * 100).toFixed(3) + "%";
  /* The shelf drawing. o.rects: [{ r: [x1,y1,x2,y2], kind: "good"|"ink"|"dash"|"bad", label }]; o.fill: [{ level, x1, x2, kind }];
     o.picks: [{ key, level, x1, x2, label }] full-height tappable stretches (buttons with data-i). */
  function shelf(kit, o = {}) {
    const st = { good: "var(--good)", ink: "var(--ink)", dash: "var(--ink)", bad: "var(--bad)" };
    const fl = { good: "var(--good-soft)", bad: "var(--bad-soft)" };
    const svg = [];
    svg.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="var(--surface)"/>`);
    (o.fill || []).forEach(f => { const l = LV[f.level]; svg.push(`<rect x="${f.x1}" y="${l.top}" width="${f.x2 - f.x1}" height="${l.floor - l.top}" fill="${fl[f.kind]}" stroke="${st[f.kind]}" stroke-width="4"/>`); });
    LEVELS.forEach(l => svg.push(`<rect x="20" y="${l.floor}" width="960" height="14" fill="var(--muted)"/>`));
    svg.push(`<rect x="20" y="16" width="960" height="14" fill="var(--muted)"/><rect x="20" y="16" width="${LEFT - 20}" height="${H - 16}" fill="var(--ink-2)"/><rect x="${RIGHT}" y="16" width="${980 - RIGHT}" height="${H - 16}" fill="var(--ink-2)"/>`);
    BOXES.forEach(b => {
      const [x1, y1, x2, y2] = rectOf(b), mid = (x1 + x2) / 2;
      const outline = b.dented ? `${x1},${y1} ${x2 - 70},${y1} ${x2},${y1 + 60} ${x2},${y2} ${x1},${y2}` : `${x1},${y1} ${x2},${y1} ${x2},${y2} ${x1},${y2}`;
      svg.push(`<polygon points="${outline}" fill="var(--sunk)" stroke="var(--ink-2)" stroke-width="4"/>`);
      svg.push(`<rect x="${mid - 12}" y="${y1}" width="24" height="40" fill="var(--line)"/><rect x="${x1 + 14}" y="${y2 - 46}" width="60" height="32" fill="var(--bg)" stroke="var(--ink-2)" stroke-width="2"/>`);
      if (b.dented) svg.push(`<line x1="${x2 - 70}" y1="${y1}" x2="${x2}" y2="${y1 + 60}" stroke="var(--ink)" stroke-width="6"/><line x1="${x2 - 70}" y1="${y1 + 10}" x2="${x2 - 30}" y2="${y1 + 70}" stroke="var(--ink-2)" stroke-width="4"/><line x1="${x2 - 90}" y1="${y1 + 30}" x2="${x2 - 40}" y2="${y1 + 95}" stroke="var(--ink-2)" stroke-width="4"/>`);
    });
    svg.push(`<polygon points="${SACK.poly.map(p => p.join(",")).join(" ")}" fill="var(--line)" stroke="var(--muted)" stroke-width="4"/><line x1="520" y1="478" x2="560" y2="520" stroke="var(--muted)" stroke-width="4"/><line x1="585" y1="472" x2="600" y2="515" stroke="var(--muted)" stroke-width="4"/>`);
    (o.rects || []).forEach(({ r, kind, label }) => {
      svg.push(`<rect x="${r[0]}" y="${r[1]}" width="${r[2] - r[0]}" height="${r[3] - r[1]}" fill="none" stroke="${st[kind]}" stroke-width="${kind === "dash" ? 5 : 7}"${kind === "dash" ? ' stroke-dasharray="18 10"' : ""}/>`);
      if (label) svg.push(`<rect x="${r[0]}" y="${r[1]}" width="${label.length * 19 + 16}" height="40" fill="${st[kind]}"/><text x="${r[0] + 8}" y="${r[1] + 29}" font-size="30" font-family="var(--mono)" font-weight="600" fill="var(--bg)">${kit.esc(label)}</text>`);
    });
    // p.wide: a narrow stretch gets a tap area at least 44px wide, centred on it (drawn last, so it sits on top)
    const picks = (o.picks || []).map(p => {
      const l = LV[p.level], w = P(p.x2 - p.x1);
      const hz = p.wide ? `left:calc(${P((p.x1 + p.x2) / 2)} - max(${w}, 44px) / 2);width:max(${w}, 44px)` : `left:${P(p.x1)};width:${w}`;
      return `<button type="button" class="lx-${ID}-hit" data-i="${p.key}" aria-label="${kit.esc(p.label)}" style="${hz};top:${PY(l.top)};height:${PY(l.floor - l.top)}"></button>`;
    }).join("");
    // CSS variables are not reliable in SVG presentation attributes: move every var() paint into a style attribute
    const styled = svg.join("").replace(/<(\w+)([^>]*?)(\/?)>/g, (m, tag, attrs, close) => {
      const st = [];
      const rest = attrs.replace(/\s(fill|stroke|font-family)="(var\([^"]+\))"/g, (_, k, v) => { st.push(`${k}:${v}`); return ""; });
      return `<${tag}${rest}${st.length ? ` style="${st.join(";")}"` : ""}${close}>`;
    });
    return `<div class="lx-${ID}-pic"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${kit.esc(o.title || "A warehouse shelf with two levels")}">${styled}</svg>${picks}</div>`;
  }
  const boxPicks = () => BOXES.map((b, i) => ({ key: b.id, level: b.level, x1: b.x1, x2: b.x2, label: `box ${i + 1}` }));
  const sackPick = () => ({ key: "sack", level: SACK.level, x1: SACK.x1, x2: SACK.x2, label: "the fallen sack" });
  const gapPicks = wide => GAPS.map(g => ({ key: g.id, level: g.level, x1: g.x1, x2: g.x2, label: "empty stretch of shelf", wide }));
  const rectTxt = r => `[${r.map(v => Math.round(v)).join(", ")}]`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* 1. The situation: three questions, three kinds of output. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["A: one label for the whole photo", "B: a list of rectangles, one around each thing, each with a label", "C: every pixel marked with what it shows (box, sack, shelf, wall)"];
    const fb = [
      ["One label answers one question about the whole photo, like “stocked” or “has a dented box”. To return a count it would need a label for every possible count (“3 boxes”, “4 boxes”, …), and it could never say a number it was not trained on, or where the boxes are.", false],
      [`Right. One rectangle per box, so the count is the length of the list: ${N_BOXES} here. Each rectangle also says where that box is.`, true],
      [`Every box pixel gets the same mark, “box”. But ${TOUCHING} of the boxes touch a neighbour, so their pixels join into one patch. From that patch alone you cannot tell where one box ends and the next begins, so you cannot count them.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>One shelf photo, three questions</h1>
        <p class="lead">A warehouse puts a camera in front of each shelf bay. The stock team wants three things from the photos: <b>how many boxes</b> are on the shelves, <b>which boxes are dented</b>, and <b>how much shelf is free</b> for new stock. Here is one bay (a drawing made for this lesson, so we know the true answers).</p>
        ${shelf(kit)}
        <p class="lead">Before you train or call any image model, you choose the shape of answer it must return. That choice decides which model you need and what training labels you must make. An image model can return three kinds of answer, A, B or C below.</p>
        <p class="task">The team leader asks first: “How many boxes are on this bay?” Which kind of answer lets your program count them?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. Draw the rectangles yourself: object detection. */
  function drawBoxes({ el, done, kit }) {
    ensureStyle();
    const got = new Set();
    let miss = null;
    const missFb = { sack: "That is a fallen sack, not a cardboard box. A model trained to find boxes returns nothing for it, and it must not add to the box count.", gap: "Nothing stands there: it is empty shelf. A rectangle goes around a thing, not around empty space." };
    const paint = () => {
      const fin = got.size === N_BOXES;
      const rects = BOXES.filter(b => got.has(b.id)).map(b => ({ r: rectOf(b), kind: "good", label: b.dented ? "dented box" : "box" }));
      const list = BOXES.filter(b => got.has(b.id)).map(b => `${rectTxt(rectOf(b))}  ${b.dented ? "dented box" : "box"}`).join("\n");
      el.innerHTML = `<h1>Draw the rectangles</h1>
        <p class="lead">Do answer B yourself. Each tap draws the rectangle around one box, with its label (“box” or “dented box”). Your program will count the rectangles.</p>
        <p class="task">Tap every cardboard box on the shelf, and nothing else.</p>
        ${shelf(kit, { rects, picks: [...boxPicks(), sackPick(), ...gapPicks()], title: "The shelf: tap a box to draw its rectangle" })}
        <div class="vars"><span>rectangles <b>${got.size}</b></span><span>dented <b>${BOXES.filter(b => got.has(b.id) && b.dented).length}</b></span></div>
        <div class="lpanel">${miss ? kit.feedback(missFb[miss], false) : ""}
        ${got.size ? `<div class="lx-${ID}-mono">${kit.esc("[x1, y1, x2, y2]  label\n" + list)}</div>` : ""}
        ${fin ? kit.feedback(`That is <b>object detection</b>: a list with one entry per object, each with a rectangle, a label and, from a real model, a score for how sure it is. In the rectangle, x1, y1 is the top-left corner and x2, y2 the bottom-right, in pixels. The count is the length of the list: ${N_BOXES}. To find the dented ones, keep the entries labelled “dented box”: ${DENTED.length}. A torchvision detector returns exactly this shape: <code>boxes</code> as <code>[x1, y1, x2, y2]</code>, <code>labels</code> and <code>scores</code>, one dict per photo.`, true) : ""}</div>`;
      el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
        const k = b.dataset.i;
        if (k === "sack") miss = "sack"; else if (k[0] === "g") miss = "gap"; else { got.add(k); miss = null; }
        paint();
        if (got.size === N_BOXES) done();
      });
    };
    paint();
  }

  /* 3. Paint the free shelf: semantic segmentation. */
  function paintFree({ el, done, kit }) {
    ensureStyle();
    const got = new Set();
    let miss = null;
    const missFb = { sack: "The fallen sack covers that part of the shelf. Nothing new can stand there until someone moves it, so it is not free.", box: "A box stands there. Those pixels are “box”, not “free shelf”." };
    const paint = () => {
      const fin = got.size === GAPS.length;
      const fill = GAPS.filter(g => got.has(g.id)).map(g => ({ ...g, kind: "good" }));
      const len = lenOf(GAPS.filter(g => got.has(g.id)));
      el.innerHTML = `<h1>Paint the free shelf</h1>
        <p class="lead">Now the third question: how much shelf is free? Do answer C: mark every part of the picture that is <b>free shelf</b>. A real model marks each pixel; here a tap fills one empty stretch, from the shelf board up to the level above. We measure along the shelf: each level is ${RIGHT - LEFT} px long, so ${TOTAL} px in all.</p>
        <p class="task">Tap every empty stretch of shelf, on both levels.</p>
        ${shelf(kit, { fill, picks: [sackPick(), ...boxPicks(), ...gapPicks(true)], title: "The shelf: tap empty shelf to mark it free" })}
        <div class="vars"><span>free shelf <b>${len} of ${TOTAL} px</b></span><span>free <b>${pct(len, TOTAL)}%</b></span></div>
        <div class="lpanel">${miss ? kit.feedback(missFb[miss], false) : ""}
        ${fin ? kit.feedback(`That is <b>semantic segmentation</b>: every pixel gets a class (free shelf, box, sack, wall), and you measure by counting pixels. Free shelf: ${FREE} of ${TOTAL} px of shelf length, <b>${FREE_PCT}%</b>. Rectangles would get this wrong. If you called every gap between the box rectangles free, you would get ${FREE_RECT_PCT}%: the sack is not a box, so its stretch would count as free. A torchvision segmentation model returns, under the key <code>out</code>, a score for every class at every pixel: a tensor of shape (batch, classes, height, width). When you need both separate objects <i>and</i> their exact pixels, the task is <b>instance segmentation</b>: one mask per object (Mask R-CNN returns a <code>masks</code> entry next to <code>boxes</code>).`, true) : ""}</div>`;
      el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
        const k = b.dataset.i;
        if (k === "sack") miss = "sack"; else if (k[0] === "b") miss = "box"; else { got.add(k); miss = null; }
        paint();
        if (got.size === GAPS.length) done();
      });
    };
    paint();
  }

  /* 4. Spot the idea: the same request, two cameras, two tasks. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Both cameras: one label per photo (“dented” or “fine”)",
      "Dock: one label per photo. Shelf: rectangles, labelled “box” or “dented box”",
      "Both cameras: rectangles labelled “box” or “dented box”",
      "Both cameras: a mask of the dented pixels"
    ];
    const fb = [
      [`Fine at the dock. On the shelf, a photo holds ${N_BOXES} boxes: the label “dented” tells the worker that this bay has a dented box, not which one. He still has to search the bay.`, false],
      ["Right. At the dock you already know where the box is: it is the one on the belt. So one label per photo is the whole answer. On the shelf the worker needs to know <i>which</i> box, so you need one rectangle per box. Same request, different task, because the photo and the action differ. One label per photo is <b>image classification</b>, what you fine-tuned on leaf photos in the last lesson.", true],
      ["It works, but at the dock it is more than you need: there is one box per photo and you already know where it is. Rectangles must be drawn by hand on every training photo, which is slower than picking one label.", false],
      ["Nobody needs the exact pixels of a dent: the action is “take this box aside”. A mask is the slowest output to label by hand, and it still would not tell you which box on a crowded shelf the dent belongs to unless masks are per object.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Same request, two cameras</h1>
        <p class="lead">“Spot dented boxes” comes from two places. <b>The dock:</b> boxes arrive one at a time on a conveyor belt and the camera sees one box filling the photo. A dented one is pushed to a check lane. <b>The shelves:</b> the camera sees a whole bay, like the one you just drew on. A worker is sent to take the dented box down.</p>
        <p class="task">Which output does each camera need?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. By hand: label four product requests with the task they need. */
  const TASKS = ["One label per photo (classification)", "Rectangles (detection)", "One mask for a class (semantic segmentation)", "A mask per object (instance segmentation)"];
  const REQS = [
    ["Returned goods come back one item per photo. Sort each photo into “can be resold” or “damaged”.", 0,
      ["Right. One item fills each photo and the action is per photo, so one label is all you need.",
       "There is one item per photo, and its place does not matter. A rectangle adds drawing work and tells you nothing the label does not.",
       "Nobody needs to know which pixels are the item; the decision is about the whole photo.",
       "There is only one item and no need for its outline. This is the most expensive output to label for a yes/no decision."]],
    ["An overhead camera on the dock floor: report how many pallets are waiting, every five minutes.", 1,
      ["One label per photo cannot count: it would need a class for every possible number of pallets.",
       "Right. One rectangle per pallet: the count is the length of the list.",
       "Pallets standing side by side merge into one “pallet” patch, so you cannot count them from a class mask.",
       "It would count them, but you never use the outlines. Rectangles give the same count with much cheaper labelling."]],
    ["After a leak, report what share of the floor is wet, so the team knows how much to close off.", 2,
      ["A label like “wet floor” says there is water, not how much of the floor it covers.",
       "A puddle has no neat shape: its rectangle includes lots of dry floor, so area from rectangles comes out too big.",
       "Right. Mark every pixel wet or dry and count the wet ones. There is one kind of thing and no need to separate puddles.",
       "You do not need to tell one puddle from another to measure the wet area; one class mask is enough."]],
    ["A robot arm must pick one sack from a heap of touching sacks, and needs the exact outline of the one it grabs.", 3,
      ["One label for the photo says “sacks”, not where any sack is.",
       "Touching sacks are soft and irregular; a rectangle around one includes parts of its neighbours, so the gripper would aim at the wrong shape.",
       "All sacks get the same mark and merge into one patch, so the arm cannot tell where one sack ends.",
       "Right. Each sack gets its own mask: the robot knows which pixels belong to the one it grabs."]]
  ];
  function labelRequests({ el, done, kit }) {
    ensureStyle();
    const ans = REQS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Label four requests</h1>
        <p class="lead">Four more requests reach the warehouse's tech team. Each needs one of the outputs you now know, including the one that does both: separate objects <i>and</i> their exact pixels.</p>
        <p class="task">Pick the task each request needs. Pick again if you change your mind.</p>
        ${REQS.map(([q, r, f], i) => `<div class="lcase" id="c${i}"><p class="lx-${ID}-req">${kit.esc(q)}</p>${kit.options(TASKS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(f[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (REQS.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 6. A hosted vision model instead: predict which answer to trust least. */
  function hostedAsk({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const lines = REC_ASK.text.split("\n").filter(l => /^\d\./.test(l));
    const truth = `<div class="vars"><span>true count <b>${N_BOXES}</b></span><span>truly dented <b>${DENTED.map(where).join("; ")}</b></span><span>truly free <b>${FREE_PCT}%</b></span></div>`;
    const reveal = `<div class="lx-${ID}-mono">${kit.esc(REC_ASK.text)}</div><p class="lx-${ID}-cap">${CAPTION}</p>${truth}`;
    const opts = ["The count", "Which boxes are dented", "The percent of free shelf"];
    const fb = [
      [`It got the count right: “${kit.esc(lines[0].slice(3))}”. Look at the third line:${reveal}It said about ${ASK_PCT}% free; the true value is ${FREE_PCT}%.`, false],
      [`It found both: “${kit.esc(lines[1].slice(3))}”. Look at the third line:${reveal}It said about ${ASK_PCT}% free; the true value is ${FREE_PCT}%.`, false],
      [`Right. A small hosted model answered:${reveal}Count and dented boxes are right. The percent is not: about ${ASK_PCT}% against a true ${FREE_PCT}%. It gave a number in words, and you cannot see how it got that number, so you cannot check it. A measurement needs pixels or rectangles that your own code adds up.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Or just ask a hosted model?</h1>
        <p class="lead">Training any of these models needs a set of photos labelled by hand. A hosted vision model (a large model behind an API that accepts images) needs none: you send the photo and a question. We sent this exact picture with three questions:</p>
        <div class="lx-${ID}-mono">${ASK_Q.map((q, i) => `${i + 1}. ${kit.esc(q)}`).join("\n")}</div>
        <p class="task">Before you see its answer: which of the three answers would you trust least?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: the hosted model's rectangles, and the fix. */
  function hostedBoxes({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const shown = REC_SMALL.text.split("\n").slice(0, 5).join("\n") + "\n …";
    const smallRects = SMALL_UNIQ.map(bx => ({ r: toRect(bx), kind: "dash" }));
    const merged = Math.max(...SMALL_MERGED);
    const largeRects = LARGE.map(o => ({ r: o.r, kind: "good", label: o.dented ? "dented" : "" }));
    const fix = `<p class="lead">The same prompt and picture, sent to a larger hosted model, came back complete:</p>
      ${shelf(kit, { rects: largeRects, title: "The larger model's rectangles drawn on the shelf" })}
      <p class="lx-${ID}-cap">${CAPTION}. Rectangles drawn from the recorded reply.</p>
      ${kit.feedback(`${LARGE.length} rectangles, on ${LARGE_DISTINCT} different boxes (for each one, the area it shares with its true box is at least ${Math.round(LARGE_MIN_IOU * 100)}% of the area the two cover together), and the dented flags ${LARGE_DENT_OK ? "all match" : "do not all match"}. So hosted models <i>can</i> return rectangles, but one model on one day is no guarantee: check the reply's structure in code (it parses, one entry per object, no repeats) and compare against a few photos you labelled yourself before trusting it.`, true)}`;
    const opts = [
      "The picture holds more boxes than you counted",
      `It repeated one rectangle until it used up its token allowance (finish_reason “${REC_SMALL.finish}”)`,
      "The numbers are on a 0-1000 scale, so every rectangle is in the wrong place",
      "Hosted models cannot return rectangles at all"
    ];
    const fb = [
      [`The picture has ${N_BOXES} boxes; you tapped them all. The reply lists ${SMALL_ALL.length} entries before it was cut, but only ${SMALL_UNIQ.length} different rectangles. The rest are the same one, repeated.`, false],
      [`Right. It wrote ${SMALL_ALL.length} entries but only ${SMALL_UNIQ.length} different rectangles, and the first one wraps ${merged} touching boxes as if they were one. Then it repeated that line until it hit <code>max_tokens</code> (${REC_SMALL.outTokens} of ${REC_SMALL.maxTokens} tokens), so the JSON is not even closed. It also ignored the <code>dented</code> field${SMALL_HAS_DENT ? "" : " (the word never appears in the reply)"}.${fix}`, true],
      [`The 0-1000 scale is what was asked for, and it converts cleanly: the dashed rectangles are drawn from the reply that way, and the second one sits right on a box. The scale is not the fault.`, false],
      ["The second rectangle sits right on a real box, so it can. The fault is in what this reply did after that; look at the lines that follow.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The rectangles came back wrong</h1>
        <p class="lead">To measure, your code needs rectangles, not a sentence. We asked the same small hosted model: “${kit.esc(BOXES_Q)}” Note the order in the request: y before x, and 0-1000 means a share of the picture's height or width, times 1000. The rectangles from its reply are drawn dashed:</p>
        ${shelf(kit, { rects: smallRects, title: "The small model's rectangles drawn on the shelf" })}
        <div class="lx-${ID}-mono">${kit.esc(shown)}</div>
        <p class="lx-${ID}-cap">${CAPTION}, trimmed. The reply continues with the same line ${SMALL_ALL.length - 3} more times and stops mid-list.</p>
        <p class="task">What went wrong with this reply?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Renting computers to train the model", "Drawing exact outlines on hundreds of training photos", "Writing the code that adds up the free pixels"];
    const fb = [
      ["Fine-tuning a pretrained model on a few hundred photos is a small job, as you saw in the transfer learning lesson. The slow part comes before training.", false],
      ["Right. On every training photo a person must outline the free shelf exactly, pixel by pixel. That is far slower than one label per photo, which you picked with one tap, or a rectangle per box, which took one tap each here because the lesson drew them for you. Budget the labelling first.", true],
      ["Counting marked pixels is a few lines of code. The work is getting a model that marks them well, and that needs labelled examples.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which output, at what cost</h1>
        <p class="lead"><b>Pick the simplest output that is enough for the action.</b> One decision per photo: classification. Count or locate things: detection. Measure area or shape: segmentation, with a mask per object if the objects touch.</p>
        <p class="lead"><b>Reach for a hosted model</b> when photos are few, the question changes, or you have no labelled data. Check its answers, and do not take its numbers as measurements.</p>
        <p class="lead"><b>Not vision at all</b> when the data already exists elsewhere: a barcode scan, a weight sensor, a stock system.</p>
        <p class="lead"><b>Costs:</b> labelling grows from one label to a rectangle per object to every pixel; a hosted model costs per call, adds a network round trip, and sends your photos to someone else.</p>
        <p class="task">The warehouse picks segmentation for free space and trains its own model. What is the biggest job before training starts?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including one where no vision model is needed. */
  const KINDS = ["Classification", "Detection", "Segmentation", "Hosted model, no training", "No vision model"];
  const CASES = [
    ["A wildlife camera on a pond: report how many ducks land there each morning.", 1, [
      "One label per photo cannot count ducks; it would need a class for every possible number.",
      "Right. One rectangle per duck, and the count is the length of the list.",
      "Ducks sitting together merge into one patch of “duck” pixels, so a class mask cannot count them.",
      "It may count a few ducks in one photo, but this runs every morning for years: a trained detector costs no call per photo, runs on your own machine and keeps the photos there.",
      "Nothing else records ducks landing; the photo is the only data."]],
    ["A vet's tool must outline a growth on an X-ray, so its size can be compared over months.", 2, [
      "A label says “growth” or “no growth”, not how big it is.",
      "A rectangle around an irregular growth includes healthy tissue, so its size from the rectangle is wrong, and changes with its angle.",
      "Right. Mark the growth's pixels and measure them; next month, do it again and compare.",
      "A sentence like “about 2 cm” is not a measurement you can track. The size must come from pixels your code adds up.",
      "The size is only in the image, so you need a model (or a person) to read it."]],
    ["A bakery wants to know how many croissants it sells each day. Every sale already goes through the till.", 4, [
      "The till already records every croissant sold. A camera would only estimate a number you already have exactly.",
      "Counting croissants on a tray in photos is harder and less exact than reading the till's records.",
      "Nothing needs measuring. The number is already in the sales data.",
      "A model would guess what the till already knows for certain, and cost a call per photo.",
      "Right. No vision at all: the till already holds the exact count. A camera would add cost and errors to a number you already have."]],
    ["A small museum gets about twenty visitor photos a month and wants to know whether each shows one of its paintings, a sculpture or something else. It has no labelled photos.", 3, [
      "That is the right kind of output, but training it needs hundreds of labelled photos first, for twenty photos a month.",
      "Nobody needs rectangles; the question is about the whole photo.",
      "Nobody needs pixels; the question is about the whole photo.",
      "Right. Few photos, no labelled data, and a person can check the answer: a hosted model asked the question does the job with no training.",
      "The answer is only in the photos; nothing else records what visitors photographed."]]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which one, if any?</h1>
        <p class="lead">Four requests from other places. Choose the cheapest thing that really answers each one.</p>
        <p class="task">Pick for each request. Pick again if you change your mind.</p>
        ${CASES.map(([q, r, f], i) => `<div class="lcase" id="c${i}"><p class="lx-${ID}-req">${kit.esc(q)}</p>${kit.options(KINDS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(f[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can choose the task</h1>
      <p class="lead">You worked with the three outputs on one shelf: one label for a photo, a rectangle per box (${N_BOXES} of them), and a mask of free shelf (${FREE_PCT}%). You chose between them by the action each request needs, and you saw a hosted model count right but measure wrong, and return rectangles that had to be checked in code.</p>
      <p class="lead">This lesson was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The models so far learned from labelled examples; next, an agent learns only from rewards for what it does.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Classification, detection and segmentation",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/vision/stable/models.html",
      "https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.detection.maskrcnn_resnet50_fpn.html",
      "https://docs.pytorch.org/vision/stable/auto_examples/others/plot_visualization_utils.html",
      "https://aistudio.google.com/docs/image-understanding",
      "https://arxiv.org/abs/1405.0312"
    ],
    interview: [
      {
        q: "A retail client wants their store cameras to “count items on shelves and show free shelf space”. How do you decide what to build, and what do you try first?",
        good: [
          "Split it by the output each part needs: a count needs detection, free area needs segmentation",
          "Ask what action follows; if a whole-photo yes or no is enough, classification is cheaper to label",
          "Check whether the data already exists, such as stock records or shelf sensors, before adding vision",
          "Prototype with a hosted vision model on a few photos and compare with hand-labelled answers",
          "Budget labelling: masks take far longer to draw than rectangles or labels"
        ],
        weak: "Pick the most powerful segmentation model for everything, without asking which output each question needs or what labelling it costs."
      },
      {
        q: "In a demo, a hosted vision model counts boxes correctly from a photo. Would you ship it to measure free shelf space? What would you check?",
        good: [
          "A correct count does not mean its numbers are measurements; a percent in words cannot be checked",
          "Ask for rectangles or masks in a fixed format and compute the area in your own code",
          "Validate the reply in code: it parses, no repeated entries, no cut-off list",
          "Compare with a small hand-labelled set before trusting it, and keep checking",
          "Weigh per-call cost, latency and sending photos to a third party against training a model"
        ],
        weak: "Yes, it counted right in the demo, so it works. That trusts one good answer and never checks the replies it will give on other photos."
      }
    ],
    screens: [situation, drawBoxes, paintFree, spotIdea, labelRequests, hostedAsk, hostedBoxes, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="sack"]'], right: BOXES.map(b => `[data-i="${b.id}"]`) },
      { wrong: ['[data-i="sack"]'], right: GAPS.map(g => `[data-i="${g.id}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: REQS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
