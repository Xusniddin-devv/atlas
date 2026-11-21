/* Lesson s6-measure-latency-cost: measuring latency percentiles and token cost.
   Story: a real-estate listings site has a description writer (an estate agent types the facts, a model writes the
   text). Agents complain that it is slow, but the dashboard average looks fine.
   Ideas: (1) sort the request times and read percentiles (p50, p95, p99): users feel the tail, and the average hides
   it; (2) cost per request in token cost units = input tokens x input price + output tokens x output price, and for
   money the mean (and the total) is the right number.
   Data: docs/ai-path/runs/s6-measure-latency-cost/ (make_log.py -> log.jsonl and make_log.out.txt = 200 real
   requests to a small open model run locally through Ollama, timed on this Mac; to_js.py -> to_js.out.txt = LOG
   below; from_scratch.py -> from_scratch.out.txt = the traced code screen; with_numpy.py -> with_numpy.out.txt =
   the NumPy screen). No hosted model was called: no recordings.
   Every number on screen is computed here from LOG, TRACE, NP_OUT, IN_UNITS and OUT_UNITS. Lesson-local CSS:
   the time chips, the small tables and the printed-output block (prefix lx-s6-measure-latency-cost-). */
(() => {
  const P = "lx-s6-measure-latency-cost-";
  const fmt = n => n.toLocaleString("en");
  const sec = ms => `${(ms / 1000).toFixed(2)} s`;
  const r1 = x => Math.round(x * 10) / 10;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  // From docs/ai-path/runs/s6-measure-latency-cost/to_js.out.txt (log.jsonl, run on 2026-11-13; gemma3:270m via Ollama)
  // [id, kind (s = standard, about 60 words asked; p = premium, about 250 words asked), latency_ms, first_ms, in_tokens, out_tokens]
  const LOG = [
      [1, "s", 1414, 406, 76, 40], [2, "s", 1742, 365, 80, 49], [3, "p", 4309, 405, 91, 135], [4, "s", 1524, 393, 81, 40],
      [5, "s", 2118, 408, 75, 44], [6, "s", 1768, 340, 76, 39], [7, "s", 1636, 398, 80, 35], [8, "s", 1380, 336, 76, 33],
      [9, "s", 1762, 388, 80, 51], [10, "s", 1660, 415, 80, 40], [11, "s", 1715, 346, 76, 42], [12, "s", 1906, 358, 75, 46],
      [13, "s", 1384, 342, 78, 34], [14, "p", 6795, 336, 89, 189], [15, "s", 1755, 354, 80, 50], [16, "s", 1309, 378, 80, 40],
      [17, "s", 1346, 343, 82, 40], [18, "s", 1190, 324, 77, 35], [19, "s", 1109, 330, 81, 35], [20, "p", 3607, 379, 91, 128],
      [21, "s", 1270, 346, 76, 39], [22, "s", 1255, 354, 76, 38], [23, "s", 1688, 336, 78, 56], [24, "s", 1571, 354, 77, 39],
      [25, "s", 1537, 403, 76, 37], [26, "p", 5929, 334, 87, 153], [27, "s", 1886, 347, 80, 43], [28, "s", 1590, 400, 78, 40],
      [29, "s", 1688, 362, 78, 40], [30, "s", 1824, 365, 73, 41], [31, "s", 1392, 349, 78, 38], [32, "s", 1777, 366, 79, 49],
      [33, "s", 1822, 339, 76, 54], [34, "s", 1345, 338, 79, 34], [35, "p", 4634, 363, 92, 147], [36, "s", 1141, 362, 74, 31],
      [37, "s", 1231, 373, 82, 36], [38, "s", 1385, 326, 81, 45], [39, "s", 1314, 342, 80, 40], [40, "s", 989, 332, 77, 28],
      [41, "s", 1122, 377, 79, 31], [42, "s", 1070, 324, 78, 29], [43, "s", 1318, 338, 79, 39], [44, "s", 1219, 346, 77, 39],
      [45, "s", 1213, 318, 76, 39], [46, "s", 1176, 326, 78, 36], [47, "s", 1220, 330, 80, 39], [48, "s", 1278, 385, 83, 38],
      [49, "s", 1385, 367, 78, 31], [50, "s", 1322, 397, 81, 35], [51, "s", 5269, 3835, 79, 43], [52, "s", 1699, 391, 79, 49],
      [53, "s", 1519, 366, 77, 44], [54, "s", 1222, 422, 82, 32], [55, "s", 1369, 391, 79, 41], [56, "s", 1126, 337, 78, 33],
      [57, "s", 1503, 362, 75, 47], [58, "s", 2598, 1497, 71, 43], [59, "s", 1276, 348, 72, 38], [60, "s", 991, 378, 76, 26],
      [61, "s", 1862, 376, 74, 40], [62, "s", 1701, 357, 76, 40], [63, "s", 4749, 3474, 78, 30], [64, "s", 1571, 357, 74, 36],
      [65, "s", 1903, 431, 79, 46], [66, "s", 1446, 376, 76, 33], [67, "p", 7506, 365, 94, 211], [68, "s", 1832, 466, 81, 49],
      [69, "s", 1203, 363, 78, 36], [70, "s", 1053, 369, 77, 29], [71, "s", 1224, 320, 79, 38], [72, "s", 1601, 339, 78, 53],
      [73, "s", 1352, 366, 79, 42], [74, "s", 1696, 331, 78, 53], [75, "s", 1162, 327, 77, 35], [76, "s", 1367, 361, 75, 41],
      [77, "s", 1049, 334, 75, 30], [78, "s", 2233, 348, 75, 36], [79, "s", 1644, 416, 77, 28], [80, "s", 911, 319, 78, 26],
      [81, "s", 1040, 330, 73, 30], [82, "s", 1639, 341, 75, 38], [83, "s", 1739, 391, 78, 50], [84, "p", 3795, 351, 91, 129],
      [85, "s", 1689, 371, 81, 48], [86, "s", 1403, 340, 78, 42], [87, "s", 1437, 335, 75, 30], [88, "s", 3117, 376, 76, 59],
      [89, "s", 2187, 363, 82, 35], [90, "s", 2499, 432, 77, 35], [91, "s", 3288, 413, 77, 45], [92, "s", 2653, 424, 77, 35],
      [93, "s", 2749, 332, 79, 39], [94, "s", 7846, 5491, 76, 34], [95, "s", 3387, 528, 80, 45], [96, "s", 2471, 472, 77, 31],
      [97, "s", 3931, 428, 75, 54], [98, "s", 2563, 394, 79, 35], [99, "s", 3072, 503, 73, 40], [100, "s", 2454, 467, 76, 34],
      [101, "s", 3004, 456, 78, 43], [102, "s", 2391, 446, 76, 31], [103, "s", 2608, 394, 79, 35], [104, "s", 3009, 396, 82, 41],
      [105, "s", 2658, 398, 76, 36], [106, "s", 2720, 391, 79, 36], [107, "s", 3309, 398, 79, 46], [108, "s", 2641, 455, 81, 33],
      [109, "s", 3022, 413, 79, 44], [110, "s", 3223, 423, 79, 42], [111, "s", 3238, 362, 77, 45], [112, "s", 2934, 407, 76, 41],
      [113, "s", 3151, 501, 77, 45], [114, "s", 2828, 832, 79, 34], [115, "s", 3454, 502, 78, 45], [116, "s", 2282, 419, 76, 33],
      [117, "s", 1757, 403, 74, 21], [118, "s", 2781, 379, 76, 38], [119, "s", 2487, 393, 78, 33], [120, "p", 12166, 351, 90, 185],
      [121, "s", 2809, 402, 73, 36], [122, "s", 3261, 475, 76, 43], [123, "s", 3306, 406, 78, 48], [124, "s", 1766, 422, 75, 20],
      [125, "p", 11756, 396, 89, 171], [126, "s", 2832, 458, 80, 36], [127, "s", 3523, 496, 77, 48], [128, "p", 14584, 437, 90, 224],
      [129, "s", 2471, 433, 76, 38], [130, "s", 3047, 398, 76, 39], [131, "s", 2798, 416, 79, 38], [132, "p", 12800, 447, 91, 196],
      [133, "s", 3333, 437, 80, 47], [134, "s", 2994, 491, 79, 40], [135, "s", 2830, 411, 79, 40], [136, "s", 3015, 390, 75, 43],
      [137, "s", 2145, 420, 73, 28], [138, "s", 3108, 395, 78, 43], [139, "s", 2851, 498, 75, 37], [140, "s", 3088, 399, 74, 42],
      [141, "s", 3056, 390, 78, 43], [142, "s", 2478, 342, 79, 30], [143, "s", 2391, 500, 78, 32], [144, "s", 4676, 2557, 81, 35],
      [145, "s", 2746, 412, 78, 39], [146, "s", 3148, 558, 72, 42], [147, "s", 9161, 5820, 77, 52], [148, "s", 8134, 5889, 76, 33],
      [149, "s", 3541, 453, 80, 47], [150, "s", 8018, 5569, 83, 36], [151, "p", 13761, 4753, 90, 141], [152, "s", 5243, 2323, 74, 44],
      [153, "s", 3892, 719, 79, 50], [154, "p", 7817, 462, 90, 115], [155, "s", 3509, 451, 79, 49], [156, "s", 3256, 492, 76, 44],
      [157, "s", 2498, 581, 76, 30], [158, "s", 2800, 466, 74, 36], [159, "s", 2457, 432, 79, 30], [160, "s", 3500, 426, 75, 49],
      [161, "s", 2962, 780, 77, 37], [162, "s", 1578, 391, 76, 24], [163, "s", 2164, 376, 80, 32], [164, "s", 3145, 540, 77, 42],
      [165, "p", 11150, 510, 86, 195], [166, "s", 1204, 412, 79, 35], [167, "p", 5035, 352, 91, 177], [168, "p", 3954, 360, 85, 141],
      [169, "s", 1170, 350, 75, 33], [170, "s", 1309, 343, 82, 39], [171, "p", 3988, 344, 90, 143], [172, "s", 1391, 339, 78, 42],
      [173, "s", 1231, 333, 78, 37], [174, "s", 1171, 326, 77, 33], [175, "s", 1782, 371, 73, 53], [176, "s", 1457, 335, 79, 43],
      [177, "s", 1270, 321, 73, 37], [178, "s", 1232, 328, 79, 37], [179, "s", 1523, 378, 75, 44], [180, "s", 1376, 362, 80, 37],
      [181, "s", 944, 331, 75, 26], [182, "p", 5592, 335, 89, 188], [183, "s", 1313, 334, 75, 38], [184, "s", 1292, 319, 80, 37],
      [185, "s", 1277, 331, 73, 38], [186, "s", 1430, 323, 78, 42], [187, "s", 1344, 331, 80, 39], [188, "s", 1356, 328, 78, 39],
      [189, "s", 1141, 337, 75, 32], [190, "s", 1110, 333, 81, 32], [191, "s", 1209, 335, 78, 34], [192, "s", 1211, 320, 75, 36],
      [193, "s", 1373, 325, 81, 40], [194, "s", 1530, 340, 81, 45], [195, "s", 1608, 328, 81, 45], [196, "s", 1440, 336, 75, 36],
      [197, "p", 5151, 348, 92, 184], [198, "s", 944, 331, 76, 27], [199, "s", 1082, 338, 79, 34], [200, "s", 1196, 315, 76, 37],
  ];
  // done_reason: ['stop']

  // The lesson's own prices, in token cost units (not money): see the cost screen for why output costs more.
  const IN_UNITS = 1, OUT_UNITS = 5;

  // derived
  const R = LOG.map(([id, k, lat, first, tin, tout]) => ({ id, prem: k === "p", lat, first, tin, tout, cost: tin * IN_UNITS + tout * OUT_UNITS }));
  const DAY = R.slice(0, 20);                                     // Monday morning: the first 20 requests
  const sortNum = a => a.slice().sort((x, y) => x - y);
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const rank = (n, p) => Math.ceil(p / 100 * n);                  // nearest rank, 1-based
  const pct = (a, p) => { const o = sortNum(a); return o[rank(o.length, p) - 1]; };
  const lat = rows => rows.map(r => r.lat);

  const DAY_ORDER = DAY.map((_, i) => i).sort((a, b) => DAY[a].lat - DAY[b].lat || a - b);
  const DAY_SORTED = DAY_ORDER.map(i => DAY[i]);
  const DAY_MEAN = mean(lat(DAY)), DAY_P50 = pct(lat(DAY), 50);
  const DAY_SLOW = DAY.filter(r => r.lat > 2 * DAY_P50).length;
  const DAY_ABOVE_MEAN = DAY.filter(r => r.lat > DAY_MEAN).length;

  const WK = lat(R), N = R.length;
  const WK_MEAN = mean(WK), WK_P50 = pct(WK, 50), WK_P95 = pct(WK, 95), WK_P99 = pct(WK, 99), WK_MAX = Math.max(...WK);
  const WK_OVER95 = WK.filter(x => x > WK_P95).length;
  const PREM = R.filter(r => r.prem), STD = R.filter(r => !r.prem);
  const caption = t => `<p class="${P}cap">${t}</p>`;

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; margin-top: 12px; }
      .${P}chip { min-height: 48px; font: 600 15px var(--mono); border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 8px; padding: 6px 4px; text-align: center; }
      button.${P}chip { cursor: pointer; }
      @media (hover: hover) { button.${P}chip:not(:disabled):hover { border-color: var(--ink); } }
      .${P}chip small { display: block; font: 500 12px var(--font); color: var(--muted); margin-top: 2px; }
      .${P}chip.in { border-color: var(--ink); }
      .${P}chip.gone { color: var(--faint); border-style: dashed; }
      .${P}chip.no { border-color: var(--bad); background: var(--bad-soft); }
      .${P}chip.enter { border-color: var(--good); background: var(--good-soft); }
      .${P}chip.accent { border: 3px solid var(--ink); padding: 4.5px 2.5px; }
      .${P}tb td.t { font-family: var(--font); }
      .${P}lab { font: 600 13px var(--font); color: var(--muted); margin: 18px 0 0; }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}out { white-space: pre-wrap; font: 500 14px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-top: 10px; overflow-wrap: anywhere; }
      .${P}tb { border-collapse: collapse; width: 100%; margin-top: 14px; font: 500 15px var(--mono); }
      .${P}tb th { text-align: left; font: 600 13px var(--font); color: var(--muted); padding: 4px 8px 6px; border-bottom: 2px solid var(--ink); }
      .${P}tb td { padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}tb .n { text-align: right; white-space: nowrap; }
      .${P}tb tr.hi td { font-weight: 700; }
      .${P}tb tr.hi td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
    `;
    document.head.appendChild(s);
  }

  /* 1. The situation, and sorting the first 20 requests by hand. */
  function sortByHand({ el, done, kit }) {
    css();
    const order = [];
    let miss = null;
    const paint = () => {
      const left = DAY.map((_, i) => i).filter(i => !order.includes(i));
      const fin = !left.length;
      const lo = DAY_SORTED[0].lat, hi = DAY_SORTED[DAY.length - 1].lat;
      el.innerHTML = `<h1>Slow, says everyone. Fine, says the dashboard.</h1>
        <p class="lead">A real-estate listings site has a description writer: an estate agent types the facts of a home, presses <b>Write</b>, and a model writes the text while a spinner turns. Agents keep complaining that it is slow. The dashboard shows the week's average wait: <b>${sec(WK_MEAN)}</b>. Nobody can see a problem.</p>
        <p class="lead">Before you can make an AI feature faster or cheaper, you have to measure two things per request: how long people wait, and what it costs. This lesson does both.</p>
        <p class="lead">Below are the first ${DAY.length} requests of Monday morning from the writer's log. The log is real: we ran a small open model on a laptop as the writer, for ${N} made-up listings. We timed every request from send to last word; that wait is called <b>latency</b>. A hosted model has different times. What matters here is how the times spread out.</p>
        <p class="task">Sort the ${DAY.length} times: tap the fastest one left, again and again, until the pile is empty.</p>
        <div class="${P}grid" id="pile">${DAY.map((r, i) => {
          const used = order.includes(i);
          return `<button type="button" class="${P}chip ${used ? "gone" : miss && miss.i === i ? "no" : ""}" data-i="${i}" ${used || fin ? "disabled" : ""}>${sec(r.lat)}</button>`;
        }).join("")}</div>
        <p class="${P}lab">Sorted, fastest first</p>
        <div class="${P}grid">${order.length ? order.map((i, k) => `<div class="${P}chip in">${sec(DAY[i].lat)}<small>#${k + 1}</small></div>`).join("") : `<div class="${P}chip gone">empty</div>`}</div>
        <div class="lpanel">${fin
          ? kit.feedback(`Sorted. The fastest request took ${sec(lo)}, the slowest ${sec(hi)}: about ${Math.round(hi / lo)} times as long. Most times bunch together at the start of the list, and a few sit far out at the end. Next, read the list.`, true)
          : miss ? kit.feedback(miss.say, false)
          : order.length ? kit.feedback(`${order.length} sorted, ${left.length} still in the pile.`) : ""}</div>`;
      el.querySelectorAll("#pile button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i, rest = DAY.map((_, j) => j).filter(j => !order.includes(j));
        const min = Math.min(...rest.map(j => DAY[j].lat));
        if (DAY[i].lat === min) { order.push(i); miss = null; }
        else miss = { i, say: `${sec(DAY[i].lat)} is not the fastest one left: ${sec(min)} is still in the pile. Each time, take the smallest time that is left.` };
        paint();
        if (order.length === DAY.length) done();
      });
    };
    paint();
  }

  /* 2. Read the sorted list: the middle one, then what the average hides. */
  function readList({ el, done, kit }) {
    css();
    let a1 = null, a2 = null;
    const n = DAY.length, half = n / 2, mid = half - 1;             // 0-based position of the 10th
    const twice = 2 * DAY_P50;
    const opts = [
      "How long a typical request takes",
      `That ${DAY_SLOW} of the ${n} agents waited more than twice as long as a typical request`,
      "Nothing: every request is part of the average, so the slow ones show in it"
    ];
    const right2 = 1;
    const paint = () => {
      const ok1 = a1 === mid, ok2 = a2 === right2;
      el.innerHTML = `<h1>Read the sorted list</h1>
        <p class="lead">The same ${n} requests, sorted, with each one's position.</p>
        <p class="task">Tap the time within which half of the requests finish.</p>
        <div class="${P}grid" id="row">${DAY_SORTED.map((r, k) => `<button type="button" class="${P}chip ${ok1 && k === mid ? "enter" : ok1 && r.lat > twice ? "accent" : a1 === k && !ok1 ? "no" : ""}" data-i="${k}" ${ok1 ? "disabled" : ""}>${sec(r.lat)}<small>#${k + 1}</small></button>`).join("")}</div>
        <div class="lpanel">${a1 == null ? "" : ok1
          ? kit.feedback(`Right. ${half} of ${n} requests finished within <b>${sec(DAY_P50)}</b>, and ${half} took longer. This is the <b>median</b>, also called <b>p50</b>, the 50th percentile: the time that 50% of requests finish within. (Some tools take the point halfway between #${half} and #${half + 1} instead. A later screen comes back to that.)`, true)
          : kit.feedback(`${a1 + 1} of ${n} requests finish within ${sec(DAY_SORTED[a1].lat)}, which is ${Math.round((a1 + 1) / n * 100)}% of them. Half of ${n} is ${half}: count to position ${half}.`, false)}
        ${ok1 ? `<div id="q2"><p class="task">The average of these ${n} times is <b>${sec(DAY_MEAN)}</b>. The ringed times took more than twice the median. What does the average hide?</p>
          ${kit.options(opts.map(kit.esc), { picked: a2, correct: right2 })}
          ${a2 == null ? "" : ok2
            ? kit.feedback(`Right. ${DAY_SLOW} agents waited between ${sec(DAY_SORTED.find(r => r.lat > twice).lat)} and ${sec(DAY_SORTED[n - 1].lat)}. From ${sec(DAY_MEAN)} alone you cannot tell whether a few people waited very long or everybody waited a little. Only ${DAY_ABOVE_MEAN} of the ${n} requests took longer than the average: it describes almost no one.`, true)
            : a2 === 0 ? kit.feedback(`The typical request is the median, ${sec(DAY_P50)}, and the average (${sec(DAY_MEAN)}) is not far from it. What the average blurs is the end of the list.`, false)
            : kit.feedback(`They do raise it, but only a little: ${DAY_SLOW} slow times are added to ${n - DAY_SLOW} fast ones and divided by ${n}. The result, ${sec(DAY_MEAN)}, looks like a normal wait. Nobody reading it learns that ${DAY_SLOW} agents waited more than ${sec(twice)}.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll("#row button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { a2 = +b.dataset.i; paint(); if (a2 === right2) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: which one number should the dashboard show? */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const correct = 2;
    const top = sortNum(WK).slice(N - WK_OVER95);
    const ifDoubled = top.reduce((s, x) => s + x, 0) / N;          // how far the average moves if the slowest 5% took twice as long
    const eachLonger = mean(top);                                   // how much longer each of those agents would wait, on average
    const opts = [
      "The average, as now",
      "The median: the time half of the requests finish within",
      "The time that 19 in 20 requests finish within",
      "The slowest request of the week"
    ];
    const paint = () => {
      el.innerHTML = `<h1>One number for the dashboard</h1>
        <p class="lead">The team wants one number on the dashboard that goes up when agents start to suffer again. The agents do not complain about the typical wait. They complain about the times they sat and watched the spinner.</p>
        <p class="task">Which number should the dashboard show?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Sort the times; the one that 95% of requests finish within is the <b>95th percentile</b>, <b>p95</b>. Only 5% of requests take longer. In general, the p-th percentile is the time that p% of requests finish within: p50 is the median, p99 is the wait that only 1 request in 100 goes past. For the whole week, p95 is <b>${sec(WK_P95)}</b> against an average of ${sec(WK_MEAN)}: it describes the wait of the slowest 1 in 20 requests, and it rises when the slow requests get slower or more frequent.`, true)
          : ans === 0 ? kit.feedback(`The average adds all times and divides by all ${N}, so a few slow requests move it much less than they hurt. If the slowest 5% of the week (${WK_OVER95} requests) took twice as long, those agents would each wait about ${Math.round(eachLonger / 1000)} s longer, and the average would move by only ${sec(ifDoubled)}, from ${sec(WK_MEAN)} to ${sec(WK_MEAN + ifDoubled)}. From the average alone, nobody could tell that a few agents now wait twice as long.`, false)
          : ans === 1 ? kit.feedback(`The median shows the typical wait, ${sec(WK_P50)} this week. It cannot see the slow half at all: if every request slower than the median took a minute, the median would not move.`, false)
          : kit.feedback(`The slowest request is one request out of ${N} (${sec(WK_MAX)} this week). A single hiccup sets it, and it jumps about from week to week. A number held up by many requests, like the ${WK_OVER95} slowest out of ${N}, is steadier.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. The whole week: where p95 sits in 200 requests, and what makes the tail. */
  const BIN = 2000;
  function week({ el, done, kit }) {
    css();
    let a1 = null, a2 = null;
    const bins = Array(Math.ceil((WK_MAX + 1) / BIN)).fill(0);
    WK.forEach(x => bins[Math.floor(x / BIN)]++);
    const pos95 = rank(N, 95);
    const posOpts = [95, pos95, rank(N, 97.5), N].filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
    const right1 = posOpts.indexOf(pos95);
    const sl = lat(STD);
    const after = { mean: [WK_MEAN, mean(sl)], p50: [WK_P50, pct(sl, 50)], p95: [WK_P95, pct(sl, 95)] };
    const names = ["the average", "p50", "p95"], keys = ["mean", "p50", "p95"];
    const drops = keys.map(k => after[k][0] - after[k][1]);
    const right2 = drops.indexOf(Math.max(...drops));
    const outP = mean(PREM.map(r => r.tout)), outS = mean(STD.map(r => r.tout));
    const latP = mean(lat(PREM)), latS = mean(sl);
    const tail = R.slice().sort((x, y) => y.lat - x.lat).slice(0, WK_OVER95), tailP = tail.filter(r => r.prem).length;
    const premAbove = PREM.every(r => r.lat > WK_P50);
    const bySlow = R.slice().sort((x, y) => y.lat - x.lat), premLast = Math.max(...PREM.map(r => bySlow.indexOf(r) + 1));  // all premium requests are among the premLast slowest
    const cap = t => t[0].toUpperCase() + t.slice(1);
    const row = (label, k) => `<tr><td>${label}</td><td class="n">${sec(after[k][0])}</td><td class="n">${sec(after[k][1])}</td></tr>`;
    const paint = () => {
      const ok1 = a1 === right1, ok2 = a2 === right2;
      el.innerHTML = `<h1>The whole week</h1>
        <p class="lead">All ${N} requests of the week. Each bar counts the requests whose wait fell in that two-second band.</p>
        <p class="${P}lab">requests per two-second band of waiting (seconds under each bar)</p>
        ${kit.bars(bins, { labels: bins.map((_, i) => `${i * BIN / 1000}–${(i + 1) * BIN / 1000}`) })}
        <p class="task">The ${N} times are sorted, fastest first. At which position is p95?</p>
        <div id="q1">${kit.options(posOpts.map(String), { picked: a1, correct: right1, num: true })}
        ${a1 == null ? "" : ok1
          ? kit.feedback(`Right: 95% of ${N} is ${pos95}, so p95 is the ${pos95}th time. For p99 it is the ${rank(N, 99)}th. Read from the log: average ${sec(WK_MEAN)}, p50 ${sec(WK_P50)}, p95 <b>${sec(WK_P95)}</b>, p99 <b>${sec(WK_P99)}</b>.`, true)
          : posOpts[a1] === 95 ? kit.feedback(`95 is the percent, not the position. 95% of ${N} requests is ${pos95} requests.`, false)
          : posOpts[a1] === N ? kit.feedback(`Position ${N} is the slowest request of all: 100% of requests finish within it. p95 leaves the slowest 5% above it.`, false)
          : kit.feedback(`${posOpts[a1]} of ${N} is ${r1(posOpts[a1] / N * 100)}% of the requests, not 95%.`, false)}</div>
        ${ok1 ? `<div id="q2"><p class="task">${PREM.length} of the ${N} requests were for premium listings, where the agent asks for a long text of about 250 words instead of about 60. If those ${PREM.length} requests were gone, which number would fall the most?</p>
          ${kit.options(names, { picked: a2, correct: right2 })}
          ${a2 == null ? "" : ok2
            ? `<table class="${P}tb"><thead><tr><th></th><th class="n">all ${N}</th><th class="n">without premium</th></tr></thead><tbody>${row("average", "mean")}${row("p50", "p50")}${row("p95", "p95")}</tbody></table>`
              + kit.feedback(`Right. Of the ${WK_OVER95} requests slower than p95, ${tailP} were premium. A premium request made the model write ${Math.round(outP)} output tokens on average, against ${Math.round(outS)} for a standard one, and waited ${sec(latP)} against ${sec(latS)}. The model writes one token after another, so a long answer takes long. The other ${WK_OVER95 - tailP} were standard requests that ran while the machine was busy. So the slow end of the list, the <b>tail</b>, can have more than one cause. When p95 is high, look at what the slow requests have in common.`, true)
            : kit.feedback(`${cap(names[a2])} falls by ${sec(drops[a2])}, from ${sec(after[keys[a2]][0])} to ${sec(after[keys[a2]][1])}. ${keys[a2] === "p50" ? `The premium requests ${premAbove ? "all sit" : "mostly sit"} above the middle, so taking them away barely moves it.` : `But all ${PREM.length} premium requests are among the ${premLast} slowest of the week: right at the end of the sorted list, where p95 is read.`} Another number falls further.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { a2 = +b.dataset.i; paint(); if (a2 === right2) done(); });
    };
    paint();
  }

  /* 5. Cost per request in token cost units, and which number finance needs. */
  function cost({ el, done, kit }) {
    css();
    let a1 = null, a2 = null;
    const pick3 = (() => {
      const std = DAY.filter(r => !r.prem).sort((a, b) => a.tout - b.tout);
      const prem = DAY.filter(r => r.prem).sort((a, b) => b.tout - a.tout);
      return [std[0], std[Math.floor(std.length / 2)], prem[0]];
    })();
    const big = pick3[2];
    const cand = [big.tin * IN_UNITS + big.tout * OUT_UNITS, big.tin + big.tout, OUT_UNITS * (big.tin + big.tout), big.tin * OUT_UNITS + big.tout];
    const opts1 = cand.filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
    const right1 = opts1.indexOf(big.cost);
    const C = R.map(r => r.cost), CM = mean(C), CTOT = C.reduce((s, x) => s + x, 0), C50 = pct(C, 50), C95 = pct(C, 95);
    const outShare = R.reduce((s, r) => s + r.tout * OUT_UNITS, 0) / CTOT;
    const opts2 = ["The average cost per request", "The median cost per request", "The p95 cost per request"];
    const right2 = 0;
    const paint = () => {
      const ok1 = a1 === right1, ok2 = a2 === right2;
      el.innerHTML = `<h1>What does one description cost?</h1>
        <p class="lead">Each response reports how many tokens went in and how many came out. In the OpenAI-style chat API, as in OpenRouter's, these are <code>usage.prompt_tokens</code> and <code>usage.completion_tokens</code>. Ollama, which we ran, calls them <code>prompt_eval_count</code> and <code>eval_count</code>.</p>
        <p class="lead">Hosted price lists charge for both, and an output token costs more. On the price pages we checked (2026-11-13), it cost from 4 to about 8 times an input token. So this lesson counts in <b>token cost units</b>: <b>${IN_UNITS} unit</b> per input token, <b>${OUT_UNITS} units</b> per output token. Later you multiply by your provider's real prices.</p>
        ${caption("in = input tokens, out = output tokens, units = cost of the request")}
        <table class="${P}tb"><thead><tr><th>request</th><th class="n">in</th><th class="n">out</th><th class="n">units</th></tr></thead><tbody>
          ${pick3.map(r => `<tr class="${r === big ? "hi" : ""}"><td>#${r.id} ${r.prem ? "premium" : "standard"}</td><td class="n">${r.tin}</td><td class="n">${r.tout}</td><td class="n">${r === big && !ok1 ? "?" : fmt(r.cost)}</td></tr>`).join("")}</tbody></table>
        <p class="task">How many units did premium request #${big.id} cost?</p>
        <div id="q1">${kit.options(opts1.map(fmt), { picked: a1, correct: right1, num: true })}
        ${a1 == null ? "" : ok1
          ? kit.feedback(`Right: ${big.tin} × ${IN_UNITS} + ${big.tout} × ${OUT_UNITS} = ${fmt(big.cost)}. The input is about the same for every listing; the output decides the cost. Over the week, output tokens made up ${Math.round(outShare * 100)}% of all units.`, true)
          : opts1[a1] === big.tin + big.tout ? kit.feedback(`That counts every token at ${IN_UNITS} unit. Output tokens cost ${OUT_UNITS}: ${big.tout} × ${OUT_UNITS}.`, false)
          : opts1[a1] === OUT_UNITS * (big.tin + big.tout) ? kit.feedback(`That prices the ${big.tin} input tokens at ${OUT_UNITS} units too. Input tokens cost ${IN_UNITS}.`, false)
          : kit.feedback(`The prices are swapped: input tokens cost ${IN_UNITS}, output tokens ${OUT_UNITS}.`, false)}</div>
        ${ok1 ? `<div id="q2"><p class="task">Finance wants one number per description, to multiply by next month's expected number of requests. Which one?</p>
          ${kit.options(opts2, { picked: a2, correct: right2 })}
          ${a2 == null ? "" : ok2
            ? kit.feedback(`Right. The bill is the sum of every request, and the average is that sum divided by the count: ${fmt(CTOT)} units ÷ ${N} = ${fmt(r1(CM))} units per request for the week. So the average times next month's expected count estimates next month's bill. For money, the average is the honest number, because costs add up. For waiting, it is not, because no agent waits the average.`, true)
            : a2 === 1 ? kit.feedback(`The median, ${fmt(C50)} units, ignores how expensive the premium requests are. ${fmt(C50)} × ${N} = ${fmt(C50 * N)}, but the week really cost ${fmt(CTOT)} units.`, false)
            : kit.feedback(`p95, ${fmt(C95)} units, is what a costly request costs. ${fmt(C95)} × ${N} = ${fmt(C95 * N)}, far over the week's real ${fmt(CTOT)} units. It is useful for a spending limit on one request, not for the bill.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { a2 = +b.dataset.i; paint(); if (a2 === right2) done(); });
    };
    paint();
  }

  /* 6. From scratch in Python, replayed from a traced run on the 20 Monday requests. */
  const CODE = [
    "def report(latency_ms, in_tokens, out_tokens):",
    "    ordered = sorted(latency_ms)",
    "    n = len(ordered)",
    "    mean = sum(ordered) / n",
    "    p50 = ordered[math.ceil(0.50 * n) - 1]",
    "    p95 = ordered[math.ceil(0.95 * n) - 1]",
    "    p99 = ordered[math.ceil(0.99 * n) - 1]",
    "    cost = [i * IN_UNITS + o * OUT_UNITS for i, o in zip(in_tokens, out_tokens)]",
    "    per_request = sum(cost) / n",
    "    return mean, p50, p95, p99, per_request"
  ];
  // docs/ai-path/runs/s6-measure-latency-cost/from_scratch.out.txt: one step per line event (state before that line runs)
  // (the list comprehension on line 7 fires one identical line event per request: those repeats are merged into one step)
  const TRACE = [
    {"line": 1, "vars": {}},
    {"line": 2, "vars": {}},
    {"line": 3, "vars": {"n": 20}},
    {"line": 4, "vars": {"n": 20, "mean": 2071.45}},
    {"line": 5, "vars": {"n": 20, "mean": 2071.45, "p50": 1660}},
    {"line": 6, "vars": {"n": 20, "mean": 2071.45, "p50": 1660, "p95": 4309}},
    {"line": 7, "vars": {"n": 20, "mean": 2071.45, "p50": 1660, "p95": 4309, "p99": 6795}},
    {"line": 8, "vars": {"n": 20, "mean": 2071.45, "p50": 1660, "p95": 4309, "p99": 6795}},
    {"line": 9, "vars": {"n": 20, "mean": 2071.45, "p50": 1660, "p95": 4309, "p99": 6795, "per_request": 366.45}},
    {"line": 9, "event": "return", "vars": {"n": 20, "mean": 2071.45, "p50": 1660, "p95": 4309, "p99": 6795, "per_request": 366.45}}
  ];
  const FRAMES = TRACE.slice(0, -1).map((s, i) => ({ ln: s.line, vars: TRACE[i + 1].vars }));
  const GATE_LN = 6;
  const SAY = {
    1: "<code>sorted</code> makes a sorted copy of the 20 Monday times: the list you built by hand.",
    2: f => `n = ${f.vars.n} requests.`,
    3: f => `The average: ${fmt(Math.round(f.vars.mean))} ms, the ${sec(f.vars.mean)} you saw.`,
    4: f => `ceil(0.50 × ${f.vars.n}) = ${rank(f.vars.n, 50)}, so the ${rank(f.vars.n, 50)}th time. Python lists start at 0, hence the − 1. p50 = ${fmt(f.vars.p50)} ms.`,
    5: f => `ceil(0.95 × ${f.vars.n}) = ${rank(f.vars.n, 95)}: the ${rank(f.vars.n, 95)}th time. p95 = ${fmt(f.vars.p95)} ms.`,
    6: f => `ceil(0.99 × ${f.vars.n}) = ceil(${r1(0.99 * f.vars.n)}) = ${rank(f.vars.n, 99)}: the slowest one. p99 = ${fmt(f.vars.p99)} ms.`,
    7: () => `One cost per request, in units: ${IN_UNITS} per input token, ${OUT_UNITS} per output token.`,
    8: f => `per_request = ${r1(f.vars.per_request)} units: the average cost, the number finance multiplies.`,
    9: "The function returns all five. This rule, picking a real time at position ceil(p/100 × n), is called <b>nearest rank</b>."
  };
  function codeScratch({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const GATE = FRAMES.findIndex(f => f.ln === GATE_LN);
    const o = DAY_SORTED.map(r => r.lat), n = o.length;
    const popts = [`${fmt(o[n - 2])} ms (#${n - 1})`, `${fmt(o[n - 1])} ms (#${n}, the slowest)`, "No value: 20 requests are too few, so Python raises an error"];
    const pright = 1;
    const paint = () => {
      const f = FRAMES[i], s = SAY[f.ln], gate = i === GATE - 1 && pred !== pright;
      const v = f.vars;
      el.innerHTML = `<h1>The same report in Python</h1>
        <p class="lead">From scratch, no libraries except <code>math</code>. <code>latency_ms</code>, <code>in_tokens</code> and <code>out_tokens</code> are the Monday morning lists; <code>IN_UNITS = ${IN_UNITS}</code>, <code>OUT_UNITS = ${OUT_UNITS}</code>. Each step replays a real run.</p>
        <p class="task">Step through to the end. Before the p99 line runs, predict its value.</p>
        ${kit.code(CODE, f.ln)}
        <div class="vars"><span>n <b>${v.n ?? "–"}</b></span><span>mean <b>${v.mean != null ? fmt(r1(v.mean)) : "–"}</b></span><span>p50 <b>${v.p50 ?? "–"}</b></span><span>p95 <b>${v.p95 ?? "–"}</b></span><span>p99 <b>${v.p99 ?? "–"}</b></span><span>per_request <b>${v.per_request != null ? r1(v.per_request) : "–"}</b></span><span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(typeof s === "function" ? s(f) : s)}
        ${gate ? `<div id="pred"><p class="task">Next: <code>p99 = ordered[math.ceil(0.99 * n) - 1]</code> with n = ${n}. What is p99?</p>${kit.options(popts.map(kit.esc), { picked: pred, correct: pright })}
          ${pred == null ? "" : pred === 0 ? kit.feedback(`That is position ${n - 1}, which is p95 here. 0.99 × ${n} = ${r1(0.99 * n)}, and ceil rounds it up to ${rank(n, 99)}.`, false)
          : kit.feedback(`ceil(${r1(0.99 * n)}) = ${rank(n, 99)}, and position ${rank(n, 99)} exists, so there is no error. The rule quietly returns the slowest request.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 || gate ? "disabled" : ""}>Next step</button></div>
        ${i === FRAMES.length - 1 ? kit.feedback(`Watch p99 on small samples. With fewer than 100 requests, ceil(0.99 × n) is n, so p99 is simply the slowest request: one request, one hiccup. Collect hundreds of requests before you trust p99.`) : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 7. The same with NumPy on the whole week: the call and its recorded output. */
  const NP_CODE = [
    'log = [json.loads(s) for s in open(PATH)]',
    'def col(key):',
    '    return np.array([r[key] for r in log])',
    'latency_ms = col("latency_ms")',
    'q = [50, 95, 99]',
    'print(np.percentile(latency_ms, q))',
    'print(np.percentile(latency_ms, q,',
    '      method="inverted_cdf"))',
    'cost = (IN_UNITS * col("in_tokens")',
    '        + OUT_UNITS * col("out_tokens"))',
    'print(round(cost.mean(), 1), cost.sum())'
  ];
  // docs/ai-path/runs/s6-measure-latency-cost/with_numpy.out.txt (not altered)
  const NP_OUT = "[ 1779.5   7818.45 12809.61]\n[ 1777  7817 12800]\n333.1 66615\n";
  function numpyRun({ el, done, kit }) {
    css();
    let ans = null;
    const lines = NP_OUT.trim().split("\n");
    const opts = ["The first one: the default method", 'The second one: method="inverted_cdf"'];
    const correct = 1;
    const o = sortNum(WK);
    const paint = () => {
      el.innerHTML = `<h1>The whole week with NumPy</h1>
        <p class="lead">For real logs you use a library. <code>np.percentile(a, q)</code> takes the times and a list of percentiles <code>q</code>, and returns one value per percentile. <code>PATH</code> is the week's log file, one request per line; <code>col</code> pulls one field out of every request. This ran on this Mac on the ${N} requests of the week.</p>
        ${kit.code(NP_CODE, -1)}
        <p class="${P}lab">printed</p>
        <div class="${P}out">${kit.esc(NP_OUT.trim())}</div>
        <p class="task">The two percentile lines differ a little. Which one follows your nearest-rank rule from the last screen?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. <code>inverted_cdf</code> always returns a time that really happened: here the ${rank(N, 50)}th, ${rank(N, 95)}th and ${rank(N, 99)}th of the sorted week, as on the earlier screen. The default, <code>method="linear"</code>, draws a straight line between two neighbouring times and reads a point on it: its p50 is halfway between the ${N / 2}th (${fmt(o[N / 2 - 1])} ms) and the ${N / 2 + 1}th (${fmt(o[N / 2])} ms). NumPy offers several such methods, from a 1996 survey of how statistics packages define them. With hundreds of requests they land close together; with few, they can differ a lot. Pick one and keep it, so this week compares with last week.`, true)
          : kit.feedback(`The first line has values that are not in the log. The default method, <code>linear</code>, places each percentile between two neighbouring times. Its p50 is ${lines[0].replace(/[[\]]/g, " ").trim().split(/\s+/)[0]} ms, but no request took exactly that: the ${N / 2}th and ${N / 2 + 1}th took ${fmt(o[N / 2 - 1])} and ${fmt(o[N / 2])} ms. Nearest rank always picks a real time.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  const FIRST95 = pct(R.map(r => r.first), 95);
  const BIG = [
    ["The writer is changed to show the text word by word as the model writes it. Agents now say they stare at an empty box before anything appears.", 1],
    ["The team wants an alert when agents start waiting too long again. The page still shows the text only when it is complete.", 0],
    ["Finance plans next quarter's budget for the writer.", 2]
  ];
  const BIG_OPTS = ["p95 of the total wait", "p95 of the time to the first word", "The average cost per request"];
  const BIG_SAY = [
    ["They do not wait for the last word any more: they read along. The empty box is the wait before the first word.", "", "Money is not their complaint. They are waiting."],
    ["", "Here the agent sees nothing until the last word, so the whole wait is what they feel.", "An alert about waiting needs a time, not a cost."],
    ["A time says nothing about the bill.", "A time says nothing about the bill.", ""]
  ];
  const BIG_YES = [
    `Right. With text shown as it is written, the wait people feel is the time to the first word. In our log, the p95 of that was ${sec(FIRST95)}, against ${sec(WK_P95)} for the whole answer.`,
    "Right. The page shows nothing until the end, so the total wait is what agents feel, and p95 catches the slow ones.",
    "Right. Costs add up, so average cost per request times the expected number of requests is the bill."
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for percentiles</h1>
        <p class="lead"><b>What for:</b> knowing how long people really wait, and what each call costs.</p>
        <p class="lead"><b>Reach for it</b> whenever a person waits on a model call. Watch p95 or p99 of the wait they actually see, and the average cost per request for money.</p>
        <p class="lead"><b>Not like this:</b> not on a handful of requests: p99 of 20 is just the slowest one. Not for work nobody waits on, like a nightly batch: measure the total run time instead. And never average the p95 of two servers or two hours: the result is not a percentile of anything. Put the times together first, then read the percentile.</p>
        <p class="lead"><b>Cost:</b> you must keep every request's time and token counts, not just a running average. A count per time band, like the bar chart on screen 4, also works, because counts from two servers can be added.</p>
        <p class="task">Pick the number to watch in each situation.</p>
        ${BIG.map(([q, r], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? BIG_YES[i] : BIG_SAY[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: is a latency percentile the right tool here? */
  const FEW = 15;                                                  // requests in the 'no' case about a tiny test
  const CASES = [
    ["A search box suggests answers while people type. The team wants the suggestions to feel instant for nearly everyone, not just on average.", true,
      "Yes. \"Nearly everyone\" is a percentile: watch p95 or p99 of the time from keystroke to suggestion.",
      "\"Nearly everyone, not just on average\" asks for the tail: p95 or p99 of the time from keystroke to suggestion."],
    ["A night job rewrites 5,000 old listings. It has to be finished before the office opens.", false,
      "No. Nobody waits on any single request, so one slow call in the middle does not matter. What matters is whether the whole run finishes in time: measure the total run time (and requests per minute).",
      "No person waits on one request here. A slow call in the middle hurts nobody if the run still ends in time. Measure the total run time, not the tail of single requests."],
    [`A team tried a new model on ${FEW} test requests and reports that its p99 is a third lower than the old model's.`, false,
      `No. With ${FEW} requests, p99 is just the slowest request: one request, one hiccup. To compare tails, collect hundreds of requests per model.`,
      `With ${FEW} requests, ceil(0.99 × ${FEW}) = ${rank(FEW, 99)}: p99 is just the slowest of them, a single request. It says nothing reliable about the tail. Collect hundreds of requests first.`],
    ["A phone assistant starts reading the answer aloud as soon as the first words arrive. Callers complain about a silence at the start.", true,
      "Yes. The silence is the time to the first words. Watch p95 of that, not of the whole answer.",
      "The silence callers hear is the wait before the first words arrive. That is a wait people feel, so watch its p95."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is a latency percentile the tool?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the listings site.</p>
        <p class="task">For each one, decide if a percentile of request times answers the question. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (browser practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Users feel the tail</h1>
      <p class="lead">You can now sort a request log, read p50, p95 and p99 by nearest rank, see why the average hides the slow requests, and work out cost per request from token counts.</p>
      <table class="${P}tb"><tbody>
        <tr><td><b>Waiting</b></td><td class="t">Watch p95 or p99 of the wait people see: the total, or the time to the first word when text streams in.</td></tr>
        <tr><td><b>Money</b></td><td class="t">Input tokens × input price + output tokens × output price. The average cost per request times the requests is the bill.</td></tr>
        <tr><td><b>Small samples</b></td><td class="t">Under 100 requests, p99 is just the slowest one.</td></tr>
      </tbody></table>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write the report function yourself, returning p50, p95, p99 and cost per request from a request log.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. A cache skips the model call for repeated questions; you will measure what it saves with the numbers from this lesson: cost per request, and the wait.</p>` : ""}`;
    done();
  }

  const MAX_I = DAY.reduce((m, r, i) => r.lat > DAY[m].lat ? i : m, 0);
  LessonKit.define("s6-measure-latency-cost", {
    title: "Measuring latency percentiles and token cost",
    checked: "2026-11-13",
    sources: [
      "https://numpy.org/doc/stable/reference/generated/numpy.percentile.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.quantile.html",
      "https://docs.ollama.com/api/chat",
      "https://openrouter.ai/docs/api/reference/overview",
      "https://prometheus.io/docs/practices/histograms/",
      "https://platform.claude.com/docs/en/about-claude/pricing",
      "https://aistudio.google.com/docs/pricing"
    ],
    interview: [{
      q: "Your AI feature's dashboard shows an average latency of two seconds, yet users keep saying it is slow. What do you do?",
      good: [
        "Stop trusting the average: pull the per-request times and look at p50, p95 and p99",
        "Check which wait users actually see: the full answer, or the first words if it streams",
        "Look at what the slow requests share, such as long outputs, big inputs or a particular model or route",
        "Put p95 (or p99, with enough traffic) on the dashboard and alert on it"
      ],
      weak: "Switch to a faster model or add servers, without first finding out which requests are slow and why."
    }, {
      q: "Your manager asks what the summariser will cost if traffic doubles next month. How do you answer?",
      good: [
        "Take input and output token counts per request from the logs, priced separately, since output tokens cost more",
        "Use the average cost per request times the expected requests, because costs add up",
        "Check whether the mix will change, for example more long documents or longer answers",
        "Add a margin and watch the real spend after the change"
      ],
      weak: "Double last month's bill, or quote a typical (median) request times the traffic, which undercounts the expensive requests."
    }],
    screens: [sortByHand, readList, spotIdea, week, cost, codeScratch, numpyRun, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`#pile [data-i="${MAX_I}"]`], right: DAY_ORDER.map(i => `#pile [data-i="${i}"]`) },
      { wrong: ['#row [data-i="0"]'], right: [`#row [data-i="${DAY.length / 2 - 1}"]`, "#q2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: [...Array(Math.max(0, FRAMES.findIndex(f => f.ln === GATE_LN) - 1)).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FRAMES.length - FRAMES.findIndex(f => f.ln === GATE_LN)).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
