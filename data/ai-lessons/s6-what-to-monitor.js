/* Lesson s6-what-to-monitor: what to monitor in a live LLM feature.
   Story: Tallis Mobile (a phone company made up for this lesson) has a billing-question bot. A one-line
   "compliance" change to its system prompt, deployed on Tuesday evening, made it answer "I can't help with that."
   to about one billing question in five. Errors and latency stayed normal, and nobody noticed for days.
   Ideas: (1) an LLM feature fails quietly: a useless answer is a successful HTTP call, so besides the service
   signals (errors, latency, traffic, cost per request) you watch signals about the answer itself (refusal rate,
   finish reasons, answer length, a sampled quality review), and you log the prompt and model version with every
   request; (2) a sane alert rule: a rate, over a window big enough to hold enough requests, with a threshold
   between the normal level and the incident level, on symptoms users feel. A detector that feeds an alert must be
   checked against hand labels.
   Depth: explain (screens 1-5, 7, 10, 11, interview), debug (screen 4: find the prompt line; screen 6: a refusal
   detector that over-counts, run for real; screen 8: alert rules that fire falsely or late).
   Data, all from docs/ai-path/runs/s6-what-to-monitor/ and the recordings in the main checkout:
   - recordings docs/ai-path/recordings/s6-what-to-monitor/v1-q01..q33 and v2-q01..q33: the bot's real answers to
     33 test questions with prompt v1 (before) and v2 (after), a small hosted model through OpenRouter, temperature 0,
     recorded 2026-11-13 (requests.mjs, record-all.mjs, extract.mjs -> extract.out.txt).
   - labels.py: our hand labels (refusal or not) for the 66 answers.
   - detector.py -> detector.out.txt: the first refusal detector (broken) and the fixed one, run on the answers.
   - sim_week.py -> week.json, sim_week.out.txt: a SIMULATED week (seeded traffic, timeouts, latency; planted
     events), in which every request carries one of the real recorded answers. to_js.py -> to_js.out.txt = WEEK.
   - rules.py -> rules.out.txt: every rule the rule builder offers, evaluated in Python (the screen recomputes it).
   - trace_alert.py -> trace_alert.out.txt: the traced alert check (TRACE, HOURS).
   Every number on screen is computed here from WEEK, HOURS, TRACE, REC and DET.
   Lesson-local CSS and pictures (prefix lx-s6-what-to-monitor-): the week line charts (SVG), the alert list, the
   answer cards, the prompt lines. */
(() => {
  const ID = "s6-what-to-monitor";
  const P = "lx-" + ID + "-";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const pct = x => `${(x * 100).toFixed(1)}%`;
  const s2 = ms => `${(ms / 1000).toFixed(2)} s`;
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  // From docs/ai-path/runs/s6-what-to-monitor/to_js.out.txt (sim_week.py, seed 7). One row per hour, Monday 00:00 first:
  // [requests, errors, answers, out_tokens, p95_ms (all traffic), p95_ms (customers only), customer answers, customer refusals]
  const WEEK = [[6,0,6,297,1474,1474,6,1],[4,0,4,126,892,892,4,0],[5,0,5,164,1430,1430,5,0],[6,1,5,185,1555,1555,5,0],[3,0,3,102,888,888,3,0],[11,0,11,298,1176,1176,11,1],[19,0,19,638,1780,1780,19,2],[42,0,42,1448,1635,1635,42,3],[254,0,254,8745,1690,1690,254,15],[407,1,406,13829,1808,1808,406,16],[507,0,507,17137,2098,2098,507,23],[497,0,497,17138,2140,2140,497,21],[495,0,495,16504,2007,2007,495,22],[467,0,467,16008,2126,2126,467,21],[151,0,151,4955,1578,1578,151,7],[144,0,144,4934,1667,1667,144,4],[142,0,142,4643,1577,1577,142,8],[127,0,127,4294,1521,1521,127,7],[113,0,113,3872,1456,1456,113,4],[106,0,106,3464,1388,1388,106,5],[90,0,90,3233,1572,1572,90,3],[67,0,67,2271,1372,1372,67,3],[30,0,30,984,1439,1439,30,0],[18,0,18,569,1412,1412,18,1],[5,0,5,197,1429,1429,5,0],[6,0,6,126,963,963,6,0],[6,0,6,235,1280,1280,6,0],[9,0,9,274,1445,1445,9,2],[6,0,6,199,1031,1031,6,0],[9,0,9,328,1522,1522,9,0],[15,0,15,468,1767,1767,15,1],[45,0,45,1360,1426,1426,45,3],[100,0,100,3151,1578,1578,100,4],[140,0,140,4389,1456,1456,140,8],[169,0,169,5712,1573,1573,169,11],[172,0,172,5858,1498,1498,172,10],[152,0,152,5159,1581,1581,152,8],[164,0,164,5450,1572,1572,164,5],[136,0,136,4370,1475,1475,136,2],[136,0,136,4447,1424,1424,136,9],[163,0,163,5515,1436,1436,163,7],[121,1,120,4044,1402,1402,120,6],[115,0,115,3843,1539,1539,115,4],[112,0,112,3634,1486,1486,112,6],[80,0,80,2625,1674,1674,80,3],[77,0,77,2538,1611,1611,77,3],[33,0,33,748,1161,1161,33,13],[18,0,18,407,1002,1002,18,2],[6,0,6,111,1003,1003,6,4],[12,0,12,247,988,988,12,5],[1,0,1,17,435,435,1,0],[6,0,6,160,1184,1184,6,1],[5,0,5,106,1174,1174,5,1],[9,0,9,227,1006,1006,9,1],[12,0,12,274,1096,1096,12,1],[43,0,43,951,1138,1138,43,10],[92,0,92,2165,1390,1390,92,17],[136,0,136,3333,1342,1342,136,22],[180,0,180,4237,1249,1249,180,44],[166,0,166,3915,1291,1291,166,38],[178,0,178,4066,1182,1182,178,48],[141,0,141,3266,1272,1272,141,35],[154,1,153,3781,1431,1431,153,27],[145,0,145,3597,1331,1331,145,27],[147,0,147,3617,1285,1285,147,30],[113,0,113,2407,1338,1338,113,35],[114,0,114,2413,1122,1122,114,48],[109,0,109,2560,1194,1194,109,27],[99,0,99,2293,1230,1230,99,28],[70,0,70,1659,1310,1310,70,15],[48,0,48,1126,1325,1325,48,9],[32,0,32,739,1466,1466,32,9],[7,0,7,169,1438,1438,7,1],[8,0,8,195,916,916,8,2],[6,0,6,120,1133,1133,6,2],[4,0,4,72,1210,1210,4,1],[4,0,4,62,1005,1005,4,2],[4,0,4,95,808,808,4,1],[16,0,16,349,1289,1289,16,6],[22,0,22,474,1088,1088,22,7],[91,0,91,2165,1227,1227,91,18],[134,0,134,3075,1193,1193,134,38],[165,0,165,3893,1303,1303,165,40],[144,0,144,3386,1373,1373,144,40],[158,0,158,3881,1469,1469,158,29],[183,0,183,4464,1289,1289,183,31],[317,0,317,7382,3390,1303,167,43],[144,0,144,3278,1171,1171,144,32],[138,0,138,3223,1293,1293,138,30],[104,0,104,2472,1252,1252,104,16],[110,0,110,2648,1332,1332,110,26],[124,0,124,2665,1259,1259,124,37],[82,0,82,1825,1277,1277,82,25],[71,0,71,1599,1250,1250,71,20],[42,0,42,960,1280,1280,42,11],[21,0,21,461,1318,1318,21,8],[6,0,6,155,1070,1070,6,1],[6,1,5,103,834,834,5,2],[6,0,6,156,1197,1197,6,0],[2,0,2,31,623,623,2,1],[9,0,9,112,1232,1232,9,7],[8,0,8,224,1272,1272,8,1],[13,0,13,324,1451,1451,13,5],[45,0,45,1018,1131,1131,45,9],[85,0,85,1858,1100,1100,85,20],[141,0,141,3441,1291,1291,141,30],[149,0,149,3374,1351,1351,149,37],[173,1,172,3928,1195,1195,172,45],[165,0,165,3949,1290,1290,165,46],[133,0,133,3162,1282,1282,133,34],[146,0,146,3528,1391,1391,146,29],[158,0,158,3520,1195,1195,158,51],[139,0,139,3288,1356,1356,139,27],[118,0,118,2616,1226,1226,118,28],[119,0,119,2652,1251,1251,119,36],[110,0,110,2567,1160,1160,110,28],[97,0,97,2052,1211,1211,97,33],[68,0,68,1543,1136,1136,68,19],[31,0,31,799,1209,1209,31,6],[15,0,15,315,1421,1421,15,6],[4,0,4,119,1179,1179,4,0],[8,0,8,208,1099,1099,8,2],[4,0,4,58,1056,1056,4,1],[3,0,3,57,1321,1321,3,1],[5,0,5,127,1396,1396,5,1],[5,0,5,99,1123,1123,5,1],[9,0,9,209,1590,1590,9,3],[40,0,40,911,1296,1296,40,10],[79,0,79,1961,1353,1353,79,16],[132,1,131,2993,1347,1347,131,35],[159,1,158,3822,1334,1334,158,33],[161,0,161,3778,1256,1256,161,38],[163,0,163,3681,1287,1287,163,42],[156,0,156,3591,1413,1413,156,36],[155,1,154,3696,1235,1235,154,33],[156,0,156,3671,1346,1346,156,35],[154,0,154,3702,1132,1132,154,32],[151,1,150,3570,1363,1363,150,31],[145,0,145,3391,1215,1215,145,35],[107,0,107,2807,1431,1431,107,20],[83,0,83,1824,1415,1415,83,25],[70,0,70,1638,1168,1168,70,16],[29,0,29,605,1034,1034,29,11],[18,0,18,410,1745,1745,18,4],[6,0,6,185,1184,1184,6,0],[5,0,5,170,1235,1235,5,0],[3,0,3,60,726,726,3,0],[4,0,4,81,1618,1618,4,2],[4,0,4,86,853,853,4,1],[5,0,5,134,1172,1172,5,1],[13,0,13,327,1291,1291,13,3],[30,0,30,713,1226,1226,30,9],[86,0,86,1989,1240,1240,86,20],[118,0,118,2919,1293,1293,118,24],[143,0,143,3330,1236,1236,143,29],[161,0,161,3711,1195,1195,161,41],[168,0,168,3980,1333,1333,168,42],[147,0,147,3544,1341,1341,147,28],[149,0,149,3478,1245,1245,149,37],[143,0,143,3180,1270,1270,143,36],[128,0,128,3146,1211,1211,128,32],[137,0,137,3254,1253,1253,137,22],[128,0,128,3008,1309,1309,128,24],[96,0,96,2103,1445,1445,96,32],[90,0,90,2020,1239,1239,90,25],[59,0,59,1476,1317,1317,59,12],[37,0,37,860,1279,1279,37,12],[26,0,26,609,1253,1253,26,4]];
  const DEPLOY = 46, LOADTEST = 86, LOADTEST_N = 150;   // planted in sim_week.py: Tue 22:00 deploy, Thu 14:00 load test of 150 requests
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const at = h => `${DAYS[Math.floor(h / 24)]} ${String(h % 24).padStart(2, "0")}:00`;
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const HRS = WEEK.map((r, h) => ({ h, req: r[0], err: r[1], ans: r[2], out: r[3], p95: r[4], up95: r[5], uans: r[6], uref: r[7] }));
  const BEFORE = HRS.slice(0, DEPLOY), AFTER = HRS.slice(DEPLOY);
  const BASE_OUT = sum(BEFORE, x => x.out) / sum(BEFORE, x => x.ans);
  const REF_BEFORE = sum(BEFORE, x => x.uref) / sum(BEFORE, x => x.uans), REF_AFTER = sum(AFTER, x => x.uref) / sum(AFTER, x => x.uans);
  const OUT_AFTER = sum(AFTER, x => x.out) / sum(AFTER, x => x.ans);

  // The team's four alert rules (the same as in sim_week.py), on the dashboard's numbers (all traffic).
  const RULES = [
    { k: "A", name: "Errors above 5% of requests in an hour", f: x => x.req > 0 && x.err / x.req > 0.05 },
    { k: "B", name: "More than 400 requests in an hour", f: x => x.req > 400 },
    { k: "C", name: "Output tokens per answer 25% away from the usual level (hours with 20+ answers)", f: x => x.ans >= 20 && Math.abs(x.out / x.ans - BASE_OUT) / BASE_OUT > 0.25 },
    { k: "D", name: "p95 latency above 3 s in an hour", f: x => x.p95 > 3000 }
  ].map(r => ({ ...r, fires: HRS.filter(r.f).map(x => x.h) }));
  const RA = RULES[0], RB = RULES[1], RC = RULES[2], RD = RULES[3];
  const runs = hs => hs.reduce((a, h) => { const l = a[a.length - 1]; if (l && h === l[1] + 1) l[1] = h; else a.push([h, h]); return a; }, []);
  const when = hs => {
    const r = runs(hs);
    if (r.length > 3) return `first at ${at(hs[0])}, then on and off until ${at(hs[hs.length - 1])}: ${hs.length} hours in all`;
    return r.map(([a, b]) => a === b ? at(a) : `${at(a)} to ${at(b)}`).join(" and ");
  };

  // From docs/ai-path/recordings/s6-what-to-monitor/<name>.json (the bot's answers, not altered).
  // provider "openrouter", model "google/gemini-2.5-flash-lite", temperature 0, recorded 2026-11-13.
  const REC_AT = "2026-11-13";
  const REC = {
    "v1-q03": "A late fee of 5 euro is added to your next bill if your current bill remains unpaid 7 days after the due date.",
    "v2-q03": "A late fee is added to your next bill if your current bill is unpaid 7 days after the due date.",
    "v2-q01": "Your bill is due on the 15th of each month.",
    "v2-q05": "I can't help with that.",
    "v2-q16": "I can't help with that.",
    "v2-q26": "The Plus plan costs 18 euro a month and includes 30 GB of data. The Unlimited plan costs 28 euro a month and includes unlimited data. Both plans include calls to numbers abroad.",
    "v1-q09": "I cannot access your account details or specific bill information. To check your current balance, please log in to the Tallis app. You can view your outstanding amount and payment history there.",
    "v1-q10": "The due date for your Tallis Mobile bill is the 15th of each month and cannot be changed.",
    "v1-q24": "I cannot access your account details, including your current balance. Please check the Tallis app under the \"Billing\" section for your most up-to-date information.",
    "v1-q31": "I can only help with billing inquiries. For phone unlocking, please contact our customer support team through the app.",
    "v1-q32": "I can only help with questions about Tallis Mobile billing. I cannot provide weather forecasts.",
    "v1-q33": "I can only help with questions about Tallis Mobile billing. Is there anything I can help you with regarding your bill, charges, payments, or plan?"
  };
  const QUESTION = {
    q01: "When is my bill due this month?", q03: "How much is the late payment fee?", q05: "What is the roaming charge on my bill?",
    q09: "How much do I owe right now?", q10: "Can I move my due date to the end of the month?", q16: "How much does the Plus plan cost?",
    q24: "Can you tell me my current balance?", q26: "What is the difference between Plus and Unlimited?",
    q31: "Can you unlock my phone so it works on another network?", q32: "What will the weather be like in Madrid tomorrow?",
    q33: "Can you write a short poem for my mum's birthday?"
  };
  // labels.py: the questions prompt v2 refused (billing ones), out of 30 billing questions; off-topic ones were refused by both
  const V2_REFUSED = ["q02", "q05", "q09", "q16", "q22", "q24"], BILLING_N = 30, SAMPLE_N = 33;

  // docs/ai-path/runs/s6-what-to-monitor/detector.out.txt, the "team view" block (not altered)
  const DET = { line: "refusal rate: 6/33 = 18.2%", flagged: ["v1-q09", "v1-q10", "v1-q24", "v1-q31", "v1-q32", "v1-q33"],
    fixedV1: [3, 33], fixedV2: [9, 33], truthV1: [3, 33], truthV2: [9, 33] };
  const NOT_REFUSAL = new Set(["v1-q09", "v1-q10", "v1-q24"]);

  // docs/ai-path/runs/s6-what-to-monitor/trace_alert.out.txt (HOURS line and the step lines, not altered)
  const HOURS = [{"at": "Tue 19:00", "ans": 112, "ref": 6}, {"at": "Tue 20:00", "ans": 80, "ref": 3}, {"at": "Tue 21:00", "ans": 77, "ref": 3}, {"at": "Tue 22:00", "ans": 33, "ref": 13}, {"at": "Tue 23:00", "ans": 18, "ref": 2}];
  const TRACE = [
    {"line": 1, "event": "line", "vars": {}},
    {"line": 2, "event": "line", "vars": {"end": 3}},
    {"line": 3, "event": "line", "vars": {"end": 3}},
    {"line": 4, "event": "line", "vars": {"end": 3, "answers": 269}},
    {"line": 5, "event": "line", "vars": {"end": 3, "answers": 269, "refusals": 12}},
    {"line": 7, "event": "line", "vars": {"end": 3, "answers": 269, "refusals": 12}},
    {"line": 1, "event": "line", "vars": {"end": 3, "answers": 269, "refusals": 12}},
    {"line": 2, "event": "line", "vars": {"end": 4, "answers": 269, "refusals": 12}},
    {"line": 3, "event": "line", "vars": {"end": 4, "answers": 269, "refusals": 12}},
    {"line": 4, "event": "line", "vars": {"end": 4, "answers": 190, "refusals": 12}},
    {"line": 5, "event": "line", "vars": {"end": 4, "answers": 190, "refusals": 19}},
    {"line": 7, "event": "line", "vars": {"end": 4, "answers": 190, "refusals": 19}},
    {"line": 1, "event": "line", "vars": {"end": 4, "answers": 190, "refusals": 19}},
    {"line": 2, "event": "line", "vars": {"end": 5, "answers": 190, "refusals": 19}},
    {"line": 3, "event": "line", "vars": {"end": 5, "answers": 190, "refusals": 19}},
    {"line": 4, "event": "line", "vars": {"end": 5, "answers": 128, "refusals": 19}},
    {"line": 5, "event": "line", "vars": {"end": 5, "answers": 128, "refusals": 18}},
    {"line": 7, "event": "line", "vars": {"end": 5, "answers": 128, "refusals": 18}},
    {"line": 8, "event": "line", "vars": {"end": 5, "answers": 128, "refusals": 18}},
    {"line": 8, "event": "return", "vars": {"end": 5, "answers": 128, "refusals": 18}}
  ];
  const TRACE_RESULT = "Tue 23:00";

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}chart { display: block; width: 100%; max-width: 560px; height: auto; margin: 2px 0 0; }
      .${P}chart text { font: 500 10.5px var(--mono); fill: var(--muted); }
      .${P}chart .ax { stroke: var(--line); stroke-width: 1; }
      .${P}chart .day { stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 3; }
      .${P}chart .ln { stroke: var(--ink); stroke-width: 1.4; fill: none; stroke-linejoin: round; }
      .${P}chart .thr { stroke: var(--ink-2); stroke-width: 1.2; stroke-dasharray: 5 4; }
      .${P}chart .dep { stroke: var(--ink); stroke-width: 1.5; stroke-dasharray: 3 3; }
      .${P}chart .dep-t { fill: var(--ink); font-weight: 700; }
      .${P}chart .fire { fill: var(--ink); }
      .${P}chart .fire.no { fill: var(--bad); }
      .${P}chart .fire.enter { fill: var(--good); }
      .${P}cap { font: 600 13px var(--font); color: var(--ink-2); margin: 16px 0 0; }
      .${P}cap small { font-weight: 500; color: var(--muted); }
      .${P}note { font-size: 13px; color: var(--muted); margin: 8px 0 0; }
      .${P}notes { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 10px 12px; margin: 14px 0 0; font-size: 15px; }
      .${P}notes b { font-family: var(--mono); font-size: 14px; }
      .${P}notes p { margin: 3px 0; }
      .${P}alerts { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}alerts li { border-left: 3px solid var(--ink); padding: 4px 0 4px 10px; margin: 8px 0; font-size: 15px; }
      .${P}alerts li b { font-family: var(--mono); margin-right: 6px; }
      .${P}alerts li span { display: block; color: var(--muted); font-size: 14px; }
      .${P}ans { border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 8px; padding: 10px 12px; margin: 8px 0 0; font: 500 15px/1.45 var(--font); text-align: left; width: 100%; min-height: 48px; display: block; }
      button.${P}ans { cursor: pointer; }
      @media (hover: hover) { button.${P}ans:not(:disabled):hover { border-color: var(--ink); } }
      .${P}ans small { display: block; color: var(--muted); font-size: 13px; margin-bottom: 3px; }
      .${P}ans.enter { border-color: var(--good); background: var(--good-soft); }
      .${P}ans.no { border-color: var(--bad); background: var(--bad-soft); }
      .${P}ans.accent { border: 3px solid var(--ink); padding: 8.5px 10.5px; }
      .${P}ans q { quotes: none; }
      .${P}rec { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }
      .${P}out { white-space: pre-wrap; font: 500 14px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-top: 10px; overflow-wrap: anywhere; }
      .${P}tb { border-collapse: collapse; width: 100%; margin-top: 12px; font: 500 15px var(--mono); }
      .${P}tb th { text-align: left; font: 600 13px var(--font); color: var(--muted); padding: 4px 8px 6px; border-bottom: 2px solid var(--ink); }
      .${P}tb td { padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}tb .n { text-align: right; white-space: nowrap; }
      .${P}tb td.t { font-family: var(--font); }
      .${P}tb tr.hi td { font-weight: 700; }
      .${P}tb tr.hi td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
      .${P}grp { margin: 12px 0 0; }
      .${P}grp > p { font: 600 14px var(--font); margin: 0 0 4px; }
      .${P}res { margin-top: 12px; }
      @media (max-width: 420px) { .${P}code .lcode { font-size: 12px; } .${P}code .lcode div { padding: 0 10px; } }
      .${P}grp .lopts button.wrong { border-color: var(--ink); background: var(--sunk); color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
    `;
    document.head.appendChild(s);
  }

  /* A week line chart (lesson-local SVG): one value per hour, optional threshold, deploy line and firing hours. */
  const W = 340, PL = 34, PR = 6, PT = 12;
  function chart(vals, { max, ticks, thr = null, fires = [], fireCls = () => "", deploy = true, days = false, label = "" }) {
    const PB = days ? 30 : 14, H = (days ? 108 : 92), ih = H - PT - PB;
    const x = h => PL + (h + 0.5) / 168 * (W - PL - PR), y = v => PT + (1 - Math.min(v, max) / max) * ih;
    const segs = [];
    let cur = [];
    vals.forEach((v, h) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(`${x(h).toFixed(1)},${y(v).toFixed(1)}`); });
    if (cur.length) segs.push(cur);
    const grid = ticks.map(t => `<line class="ax" x1="${PL}" x2="${W - PR}" y1="${y(t)}" y2="${y(t)}" opacity="${t ? .5 : 1}"/><text x="${PL - 4}" y="${y(t) + 3.5}" text-anchor="end">${t}</text>`).join("")
      + Array.from({ length: 6 }, (_, d) => `<line class="day" x1="${PL + (d + 1) * 24 / 168 * (W - PL - PR)}" x2="${PL + (d + 1) * 24 / 168 * (W - PL - PR)}" y1="${PT}" y2="${PT + ih}"/>`).join("");
    const dl = days ? DAYS.map((d, i) => `<text x="${PL + (i + 0.5) * 24 / 168 * (W - PL - PR)}" y="${H - 4}" text-anchor="middle">${d}</text>`).join("") : "";
    const th = thr == null ? "" : `<line class="thr" x1="${PL}" x2="${W - PR}" y1="${y(thr)}" y2="${y(thr)}"/>`;
    const dep = deploy ? `<line class="dep" x1="${x(DEPLOY - 0.5)}" x2="${x(DEPLOY - 0.5)}" y1="${PT - 4}" y2="${PT + ih}"/><text class="dep-t" x="${x(DEPLOY - 0.5) + 3}" y="${PT + 2}">deploy</text>` : "";
    const fr = fires.map(h => `<rect class="fire ${fireCls(h)}" x="${(x(h) - 1.2).toFixed(1)}" y="${PT + ih + 3}" width="2.4" height="7"/>`).join("");
    return `<svg class="${P}chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${grid}${th}${segs.map(s => `<polyline class="ln" points="${s.join(" ")}"/>`).join("")}${dep}${fr}${dl}</svg>`;
  }
  const errPct = HRS.map(x => x.req ? x.err / x.req * 100 : null);
  const outPer = HRS.map(x => x.ans ? x.out / x.ans : null);
  const refPct = HRS.map(x => x.uans ? x.uref / x.uans * 100 : null);
  const dashboard = () => `
    <p class="${P}cap">Requests per hour <small>· alert B: more than 400</small></p>
    ${chart(HRS.map(x => x.req), { max: 600, ticks: [0, 400], thr: 400, fires: RB.fires, label: "Requests per hour over the week" })}
    <p class="${P}cap">Errors, % of requests in the hour <small>· alert A: above 5%</small></p>
    ${chart(errPct, { max: 20, ticks: [0, 20], thr: 5, fires: RA.fires, label: "Error rate per hour over the week" })}
    <p class="${P}cap">p95 latency, seconds <small>· alert D: above 3 s</small></p>
    ${chart(HRS.map(x => x.ans ? x.p95 / 1000 : null), { max: 4, ticks: [0, 3], thr: 3, fires: RD.fires, label: "p95 latency per hour over the week" })}
    <p class="${P}cap">Output tokens per answer <small>· alert C: 25% away from the usual ${BASE_OUT.toFixed(1)}</small></p>
    ${chart(outPer, { max: 60, ticks: [0, 30, 60], thr: BASE_OUT * 0.75, fires: RC.fires, days: true, label: "Output tokens per answer over the week" })}
    <p class="${P}note">Marks under a chart: the hours its alert fired. The dashed line across a chart is its alert level (for C, the lower edge of its band).</p>`;

  /* 1. The situation: four alerts in a week, one real incident. */
  function fourAlerts({ el, done, kit }) {
    css();
    let ans = null;
    const correct = 2;
    const say = [
      `A fired for one hour at night, twice, and the error chart is flat the rest of the week. A one-hour blip at night does not explain a week of complaints that the bot "stopped helping". Look for a change that starts and stays.`,
      `B fired on Monday morning, the day bills came out (see the team notes), and stopped by itself in the afternoon. The error and p95 charts stayed flat while it fired. More customers asking is not a fault.`,
      "",
      `D fired for one hour on Thursday at 14:00, exactly when QA ran its load test (see the team notes). The complaints are about the whole week, and D was quiet before and after.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Four alerts, one real problem</h1>
        <p class="lead">Tallis Mobile, a phone company made up for this lesson, has a billing-question bot in its app. On Sunday the support lead says customers keep writing that the bot "stopped helping" some time this week. The team's dashboard raised four alerts this week. The on-call engineer (the person who answers alerts this week) looked at each one and moved on. This lesson is about what to watch once an LLM feature is live, so that a problem like this gets noticed in hours, not days.</p>
        <div class="${P}notes"><p><b>Mon</b> the 1st: this month's bills went out.</p><p><b>Tue 22:00</b> deploy: new system prompt, "compliance wording".</p><p><b>Thu 14:00</b> QA (the testing team) ran a load test against the bot.</p></div>
        ${dashboard()}
        <p class="${P}note">The week is a simulation we ran: a script with fixed random numbers made up the traffic, the timeouts and the latency. Every answer in it is a real recorded answer from a small hosted model to one of ${SAMPLE_N} test questions.</p>
        <ul class="${P}alerts">${RULES.map(r => `<li><b>${r.k}</b>${kit.esc(r.name)}<span>fired ${kit.esc(when(r.fires))}</span></li>`).join("")}</ul>
        <p class="task">Which alert was the real problem for customers?</p>
        <div class="lpanel">${kit.options(RULES.map(r => `Alert ${r.k}`), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. C started the hour of the Tuesday deploy and kept firing every day after it. Answers fell from ${BASE_OUT.toFixed(1)} output tokens on average before the deploy to ${OUT_AFTER.toFixed(1)} after. The on-call engineer muted it on Wednesday: shorter answers are cheaper, that looked like good news. It was not. Many of the shorter answers were just: "I can't help with that."`, true)
          : kit.feedback(say[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. Why each false alarm fired. */
  function whyFired({ el, done, kit }) {
    css();
    const a0 = HRS[RA.fires[0]], a1 = HRS[RA.fires[1]];
    const bH = RB.fires.map(h => HRS[h]), bReq = sum(bH, x => x.req), bErr = sum(bH, x => x.err), bP95 = Math.max(...bH.map(x => x.p95));
    const d = HRS[LOADTEST];
    const CASES = [
      { t: `Alert A: errors above 5% in an hour. At ${at(a0.h)}: ${a0.err} error in ${a0.req} requests. At ${at(a1.h)}: ${a1.err} in ${a1.req}.`,
        o: [`Very few requests came in, so a single timeout was already ${pct(a0.err / a0.req)} of the hour`, "The model provider was down all night", "The Tuesday deploy broke the error handling"], r: 0,
        yes: `Right. With ${a0.req} requests in an hour, one failure is ${pct(a0.err / a0.req)}. A rate over a handful of requests jumps around. Fix: only judge the rate when the window holds enough requests, or alert on the number of errors too.`,
        no: [``, `Then every request that night would fail. The error chart shows ${a0.err} error at ${at(a0.h)} and none in the hours around it.`, `A fired first at ${at(a0.h)}, ${DEPLOY - a0.h} hours before the deploy.`] },
      { t: `Alert B: more than 400 requests in an hour. From ${at(RB.fires[0])} to ${at(RB.fires[RB.fires.length - 1])}: ${fmt(bReq)} requests, ${plural(bErr, "error")}, p95 at most ${s2(bP95)}.`,
        o: ["The deploy doubled the traffic", "Bills went out, so many more customers asked, and the bot handled it", "Failing requests were retried again and again"], r: 1,
        yes: `Right. ${plural(bErr, "error")} in ${fmt(bReq)} requests and a p95 of at most ${s2(bP95)}: customers were served well. Traffic is worth a chart, to plan capacity, but a busy hour is not a fault. Page someone (send an alert that calls a person, even at night) only on what customers feel, such as errors and slow answers.`,
        no: [`B fired on Monday; the deploy came on Tuesday evening.`, ``, `Retries come after failures, and there were only ${plural(bErr, "error")} in those hours.`] },
      { t: `Alert D: p95 latency above 3 s. At ${at(LOADTEST)}: ${d.req} requests, of which ${LOADTEST_N} were QA's load test with long chat histories. p95 of all requests ${s2(d.p95)}.`,
        o: ["The model provider was slow for an hour", "It was Monday-style bill traffic", "The load test's long requests were counted with the customers' requests"], r: 2,
        yes: `Right. Customers' own requests that hour had a p95 of ${s2(d.up95)}. The ${LOADTEST_N} test requests carried long inputs, which take longer to read, and they were mixed into the same chart. Fix: tag test traffic and keep it out of the customer dashboard and its alerts.`,
        no: [`Then customers' requests would be slow too. Their own p95 that hour was ${s2(d.up95)}.`, `It was Thursday, with ${d.req - LOADTEST_N} customer requests: an ordinary afternoon.`, ``] }
    ];
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Why each false alarm fired</h1>
        <p class="lead">A false alarm wakes someone up for nothing, and after a few of them people stop reading alerts carefully. After three false alarms in a week, a fourth alert that looked like good news was easy to mute. To fix an alert you need to know why it fired.</p>
        <p class="task">For each false alarm, pick the reason it fired. Pick again if you change your mind.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(c.t)}</p>${kit.options(c.o.map(kit.esc), { picked: ans[i], correct: c.r })}${ans[i] == null ? "" : kit.feedback(ans[i] === c.r ? c.yes : c.no[ans[i]], ans[i] === c.r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((x, j) => ans[j] === x.r)) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: a useless answer is a successful call. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const correct = 1;
    const busy = h => h.uans >= 50;
    const errA = sum(AFTER, x => x.err) / sum(AFTER, x => x.req);
    const p95B = Math.max(...BEFORE.filter(busy).map(x => x.up95)), p95A = Math.max(...AFTER.filter(x => busy(x) && x.h !== LOADTEST).map(x => x.up95));
    const opts = [
      "The error and latency alerts were set too loose; tighter limits would have caught it",
      "The refusals were successful calls: the service worked, the answer was useless, and no chart looked at the answers",
      "The charts are hourly, which is too coarse to see it"
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why the usual charts stayed calm</h1>
        <p class="lead">After the Tuesday deploy, errors were ${pct(errA)} of requests. The p95 of customers' requests in busy hours was at most ${s2(p95A)} (before the deploy: ${s2(p95B)}). Every refused question came back with HTTP status 200 and a normal end to the answer. Here is one of them, to a customer who asked <q>${kit.esc(QUESTION.q05)}</q>:</p>
        <div class="${P}ans">${kit.esc(REC["v2-q05"])}</div><p class="${P}rec">Recorded model output, ${REC_AT}</p>
        <p class="task">Why did no error or latency alert catch this?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Errors, latency and traffic tell you whether the service ran. An LLM feature can run perfectly and still say something useless or wrong. So you also watch signals about the answer itself. Here the one that matters is the <b>refusal rate</b>: the share of answers in which the bot declines the question. The chart below counts refusals in customers' answers. We marked each recorded answer by hand as a refusal or not.`, true)
            + `<p class="${P}cap">Refusals, % of customers' answers in the hour</p>${chart(refPct, { max: 60, ticks: [0, 20, 60], days: true, label: "Refusal rate per hour over the week" })}`
            + kit.feedback(`Before the deploy: ${pct(REF_BEFORE)}, mostly off-topic questions such as the weather, declined as they should be. After: ${pct(REF_AFTER)}. Of the ${BILLING_N} billing questions we tested, prompt v2 refused ${V2_REFUSED.length}: one in five. Without a refusal chart, the only trace was answers getting shorter, and that alert was muted.`)
          : ans === 0 ? kit.feedback(`Tighter limits measure the same things. Errors stayed at ${pct(errA)} and p95 did not rise at all: refused answers are short, so they come back fast. No limit on errors or latency separates a refusal from a good answer.`, false)
          : kit.feedback(`Hourly is fine for a change that lasts days. The refusals went on for every hour after the deploy. The charts were not too coarse: none of them measured anything about what the answers said.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Find the cause: split by prompt version, then find the line. */
  const PROMPT_V2 = [
    "You are the billing help assistant of Tallis Mobile, a phone company.",
    "Answer customers' questions about bills, charges, payments and plans, using only the facts below.",
    "Keep answers under 80 words.",
    "For compliance, do not state or discuss amounts of money; if a question is about an amount, reply \"I can't help with that.\"",
    "Facts about Tallis Mobile billing: … (15 facts: plans and prices, due dates, the late fee, payment, roaming, refunds)"
  ];
  const LINE_RIGHT = 3;
  function findCause({ el, done, kit }) {
    css();
    let a1 = null, line = null;
    const opts = ["prompt_version: which system prompt answered", "hour: the hour of day", "question_length: how long the question was"];
    const r1 = 0;
    const nB = sum(BEFORE, x => x.uans), nA = sum(AFTER, x => x.uans);
    const lineSay = [
      "This sentence is the same in prompt v1, which declined only off-topic questions.",
      `This sentence is in v1 too, and v1 refused ${pct(REF_BEFORE)}, almost all of them off-topic.`,
      "v1 has the same word limit. A short limit makes answers shorter, not refusals.",
      "",
      "The 15 facts are the same in both versions. Nothing was removed from them."
    ];
    const paint = () => {
      const ok1 = a1 === r1;
      el.innerHTML = `<h1>Find the cause</h1>
        <p class="lead">You know what went wrong. Now find why. Every request in the bot's log is one row with a few fields besides the question and the answer. To split the refusal rate by a field means to compute the rate separately for each value of that field.</p>
        <p class="task">Which field do you split the refusal rate by first?</p>
        <div id="q1">${kit.options(opts.map(kit.esc), { picked: a1, correct: r1 })}
        ${a1 == null ? "" : ok1
          ? `<table class="${P}tb"><thead><tr><th>prompt_version</th><th class="n">answers</th><th class="n">refusals</th></tr></thead><tbody>
              <tr><td>v1</td><td class="n">${fmt(nB)}</td><td class="n">${pct(REF_BEFORE)}</td></tr><tr class="hi"><td>v2</td><td class="n">${fmt(nA)}</td><td class="n">${pct(REF_AFTER)}</td></tr></tbody></table>`
            + kit.feedback(`Right. The jump began at a deploy, so the first suspect is what the deploy changed. That split takes a minute only because every log row says which prompt (and which model) produced the answer. Log them with every request.`, true)
          : a1 === 1 ? kit.feedback(`The refusals stay high at every hour of the day after Tuesday 22:00, and were low at every hour before. Hour of day does not separate them; the deploy does.`, false)
          : kit.feedback(`The same questions were asked all week. A question about the roaming charge was answered on Monday and refused on Wednesday, at the same length. Something in the bot changed, not the questions.`, false)}</div>
        ${ok1 ? `<div id="lines"><p class="task">Here is prompt v2, one sentence per line. Tap the sentence that makes the bot refuse.</p>
          ${PROMPT_V2.map((t, i) => `<button type="button" class="${P}ans ${line === i ? (i === LINE_RIGHT ? "enter" : "no") : ""}" data-i="${i}" ${line === LINE_RIGHT ? "disabled" : ""}>${kit.esc(t)}</button>`).join("")}
          ${line == null ? "" : line === LINE_RIGHT
            ? kit.feedback(`Right. This is the one line added on Tuesday. The ${V2_REFUSED.length} billing questions v2 refused in our test set all ask about money, such as <q>${kit.esc(QUESTION.q16)}</q> and <q>${kit.esc(QUESTION.q09)}</q>. Whatever the line was meant to prevent, it also stopped the bot from quoting its own price list. Next: how evenly did the model follow it?`, true)
            : kit.feedback(lineSay[line], false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#lines button").forEach(b => b.onclick = () => { line = +b.dataset.i; paint(); if (line === LINE_RIGHT) done(); });
    };
    paint();
  }

  /* 5. Predict how prompt v2 answers four questions; the recordings show what really happened. */
  const PRED = [
    { q: "q01", key: "v2-q01", refused: false, note: "No amount in the question or the answer: answered as before." },
    { q: "q16", key: "v2-q16", refused: true, note: "A price question: refused, as the new line says. The refusal rate counts this one." },
    { q: "q03", key: "v2-q03", refused: false, note: `Not refused, but look closely. With prompt v1 the answer was: "${REC["v1-q03"]}" Now the amount is gone. No refusal words, normal length, status 200: no counter catches this. Only someone reading a sample of answers notices.` },
    { q: "q26", key: "v2-q26", refused: false, note: "A question about two plans, and the answer quotes both prices. In this run the model broke the new rule here, while it refused the plain price question above." }
  ];
  function predict({ el, done, kit }) {
    css();
    const ans = PRED.map(() => null);
    const paint = () => {
      const all = PRED.every((p, i) => ans[i] === (p.refused ? 0 : 1));
      el.innerHTML = `<h1>Will v2 refuse it?</h1>
        <p class="lead">The new line says: do not discuss amounts of money; if a question is about an amount, reply "I can't help with that." Here are four questions from the test set. Each was sent to the bot with prompt v2, and the answer was recorded.</p>
        <p class="task">For each question, predict: does v2 refuse it, or answer it? Then read what it really said. Pick again if you change your mind.</p>
        ${PRED.map((p, i) => {
          const right = ans[i] === (p.refused ? 0 : 1);
          return `<div class="lcase" id="c${i}"><p><q>${kit.esc(QUESTION[p.q])}</q></p>${kit.options(["Refuses", "Answers"], { picked: ans[i], correct: p.refused ? 0 : 1 })}
            ${ans[i] == null ? "" : `<div class="${P}ans">${kit.esc(REC[p.key])}</div><p class="${P}rec">Recorded model output, ${REC_AT}</p>` + kit.feedback(`${right ? "" : `It ${p.refused ? "refused" : "answered"}. `}${kit.esc(p.note)}`, right)}</div>`;
        }).join("")}
        ${all ? kit.feedback(`So one rule gave three different kinds of answer: a refusal, an answer that silently lost its number, and an answer that ignored the rule. The refusal rate caught only the first kind. That is why a team also reads (or has a judge model score) a small random sample of live answers every day: it catches the quiet kinds.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PRED.every((p, j) => ans[j] === (p.refused ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 6. Broken on purpose: the refusal detector counts answers that are not refusals. */
  const DET_CODE = [
    `REFUSAL_WORDS = ["can't", "cannot",`,
    `                 "unable", "only help"]`,
    "",
    "def is_refusal(answer):",
    "    text = answer.lower()",
    "    return any(word in text",
    "               for word in REFUSAL_WORDS)"
  ];
  function brokenDetector({ el, done, kit }) {
    css();
    const found = new Set();
    let miss = null, fix = null;
    const fixOpts = [
      "Raise the alert threshold to allow for the extra answers it counts",
      "Match only phrases that decline the question, such as \"can't help with\", and check the detector against hand labels after every change",
      "Drop the detector and count thumbs-down votes instead"
    ];
    const fixR = 1;
    const fixSay = [
      "The extra comes from ordinary answers that happen to contain \"cannot\". How many there are depends on what people ask that week (on bill day, more people ask about due dates and balances), so the false part moves up and down and can hide a real change.",
      "",
      "Most customers never vote, and a customer who gets \"I can't help with that\" often just leaves. Votes help, but they do not replace counting the refusals."
    ];
    const paint = () => {
      const allFound = found.size === NOT_REFUSAL.size;
      el.innerHTML = `<h1>A refusal counter that is wrong</h1>
        <p class="lead">To make a refusal chart, the team wrote a detector: it checks every answer for a few words. Before trusting it, you run it on a sample of ${SAMPLE_N} answers from the week <b>before</b> the deploy. You read those ${SAMPLE_N} answers yourself: ${DET.truthV1[0]} of them decline the question.</p>
        ${kit.code(DET_CODE, -1)}
        <p class="${P}note">Printed by our run (detector.py, on the recorded answers):</p>
        <div class="${P}out">${kit.esc(DET.line)}</div>
        <p class="task">The detector says ${DET.flagged.length} answers. Tap each flagged answer that is <b>not</b> a refusal: the customer got an answer or a next step.</p>
        <div id="fl">${DET.flagged.map((k, i) => {
          const q = k.slice(3), c = found.has(k) ? "enter" : miss === k ? "no" : "";
          return `<button type="button" class="${P}ans ${c}" data-i="${i}" ${found.has(k) || allFound ? "disabled" : ""}><small>${kit.esc(QUESTION[q])}</small>${kit.esc(REC[k])}</button>`;
        }).join("")}</div>
        <p class="${P}rec">Recorded model output, ${REC_AT}</p>
        <div class="lpanel">${miss ? kit.feedback(`This one is a real refusal: the customer asked something off-topic and the bot declined, as it should. Count it. Look for answers that contain "cannot" but still help.`, false)
          : found.size && !allFound ? kit.feedback(`Found ${found.size} of ${NOT_REFUSAL.size}.`) : ""}
        ${allFound ? kit.feedback(`Found all ${NOT_REFUSAL.size}. "Cannot be changed" is a complete answer, and "I cannot access your account … check the Tallis app" gives the next step. The detector matches the words anywhere, so it doubles the rate: ${DET.flagged.length} of ${SAMPLE_N} instead of ${DET.truthV1[0]}.`)
          + `<div id="q2"><p class="task">What is the fix?</p>${kit.options(fixOpts.map(kit.esc), { picked: fix, correct: fixR })}
            ${fix == null ? "" : fix === fixR ? kit.feedback(`Right. We changed the words to four phrases that decline ("can't help with", "cannot help with", "can only help with", "can only answer") and ran it again: ${DET.fixedV1[0]} of ${DET.fixedV1[1]} on the sample before the deploy and ${DET.fixedV2[0]} of ${DET.fixedV2[1]} after, the same as our hand labels both times. A phrase list stays brittle: the next prompt may phrase refusals differently. So keep a few hundred hand-labelled answers and rerun the detector on them whenever it, the prompt or the model changes. A judge model can do the labelling too, if you check it against hand labels the same way.`, true)
              : kit.feedback(fixSay[fix], false)}</div>` : ""}</div>`;
      el.querySelectorAll("#fl button").forEach(b => b.onclick = () => {
        const k = DET.flagged[+b.dataset.i];
        if (NOT_REFUSAL.has(k)) { found.add(k); miss = null; } else miss = k;
        paint();
      });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === fixR) done(); });
    };
    paint();
  }

  /* 7. Which signal catches which failure. */
  const SIG = ["Error rate", "p95 latency", "Input tokens and cost per request", "Refusal rate", "Share of answers cut off at the token limit", "A daily sample of answers, read or scored"];
  const FAILS = [
    { t: "The model provider has a twenty-minute outage. Calls time out.", o: [0, 1, 5], r: 0,
      yes: "Right. A timeout is a failed request, so it shows at once in the error rate.",
      no: { 1: "Timed-out calls are failures, and they show at once in the error rate. Latency charts usually track the calls that succeeded, which stay normal here; Google's SRE book advises tracking failed calls' latency separately.", 5: "A daily sample is far too slow for an outage, and a failed call has no answer to read." } },
    { t: "A change to retrieval now puts 20 document chunks into every prompt instead of 4.", o: [2, 3, 0], r: 0,
      yes: "Right. Input tokens per request jump the hour it ships, and so does cost per request. Latency rises a little too.",
      no: { 3: "More context does not make the bot decline. What changes for sure is how much text goes in.", 0: "Nothing fails: the calls are just bigger and more expensive." } },
    { t: "A teammate lowers max_tokens to save money. Long answers now stop in the middle of a sentence.", o: [4, 0, 3], r: 0,
      yes: "Right. The API says why each answer ended. In the OpenAI chat format, finish_reason is \"length\" when the max_tokens limit was reached and \"stop\" when the model finished on its own; OpenRouter maps each model's own reason onto these values. Chart the share of \"length\".",
      no: { 0: "A cut-off answer is still a successful call, status 200.", 3: "The bot does not decline anything; it is stopped mid-answer. The API marks that in finish_reason." } },
    { t: `After Tuesday's prompt, the late-fee answer changed from "${REC["v1-q03"]}" to "${REC["v2-q03"]}" (both recorded model output, ${REC_AT})`, o: [3, 5, 2], r: 1,
      yes: "Right. No counter sees a number that quietly went missing. A person, or a judge model checked against people, reading a small random sample each day does. This is the slowest signal, so it complements the counters; it does not replace them.",
      no: { 3: "It is not a refusal: it answers, just without the amount. The detector from the last screen did not flag it.", 2: "The tokens barely moved: the answer lost a few words, which is normal variation." } }
  ];
  function whichSignal({ el, done, kit }) {
    css();
    const ans = FAILS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which signal catches it first?</h1>
        <p class="lead">You have now seen three layers of signals: is the service running (errors, latency, traffic), what does it cost (tokens per request), and what does it say (refusals, how answers end, a sample of answers read by someone). Each layer catches different failures.</p>
        <p class="task">For each failure, pick the signal that shows it first. Pick again if you change your mind.</p>
        ${FAILS.map((f, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(f.t)}</p>${kit.options(f.o.map(k => kit.esc(SIG[k])), { picked: ans[i], correct: f.r })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === f.r ? f.yes : f.no[f.o[ans[i]]]), ans[i] === f.r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (FAILS.every((f, j) => ans[j] === f.r)) done();
      }));
    };
    paint();
  }

  /* 8. Set a sane alert rule: the lesson replays it over the week. */
  const WIN = [1, 3], MINS = [0, 50], THR = [0.05, 0.10, 0.15];
  function evalRule(w, m, t) {
    const fired = [];
    for (let h = w - 1; h < 168; h++) {
      const span = HRS.slice(h - w + 1, h + 1), n = sum(span, x => x.uans), r = sum(span, x => x.uref);
      if (n >= Math.max(m, 1) && r / n > t) fired.push(h);
    }
    const first = fired.find(h => h >= DEPLOY);
    return { fired, falses: fired.filter(h => h < DEPLOY), first, delay: first == null ? null : first - DEPLOY };
  }
  function ruleBuilder({ el, done, kit }) {
    css();
    let w = null, m = null, t = null;
    // 3-hour windows by their last hour h: answers and refusals in hours h-2..h
    const w3 = h => { const sp = HRS.slice(h - 2, h + 1); return { h, n: sum(sp, x => x.uans), r: sum(sp, x => x.uref) }; };
    const pre3 = HRS.slice(2, DEPLOY).map(x => w3(x.h)), quiet = pre3.reduce((a, b) => b.n < a.n ? b : a);
    const skip3 = HRS.slice(DEPLOY).map(x => w3(x.h)).filter(x => x.n < 50).map(x => x.h), night = runs(skip3)[0];
    const paint = () => {
      const set = w != null && m != null && t != null;
      const R = set ? evalRule(WIN[w], MINS[m], THR[t]) : null;
      const pass = R && !R.falses.length && R.delay != null && R.delay <= 3;
      let say = "";
      if (R) {
        const f0 = R.falses[0], span = f0 == null ? null : HRS.slice(f0 - WIN[w] + 1, f0 + 1), n = span && sum(span, x => x.uans), r = span && sum(span, x => x.uref);
        if (R.falses.length && THR[t] <= REF_BEFORE + 0.01) say = `${plural(R.falses.length, "false alarm")} before the deploy. ${pct(THR[t])} is about the normal level: off-topic questions are declined all the time (${pct(REF_BEFORE)} of answers before the deploy). A threshold must sit well above the normal level and below the incident level (${pct(REF_AFTER)}).`;
        else if (R.falses.length) say = `${plural(R.falses.length, "false alarm")} before the deploy. The first, ${at(f0)}: ${r} declined of ${n} ${WIN[w] === 1 ? "in that hour" : "in the window"}, so ${pct(r / n)}. At night a few off-topic questions are enough to cross any threshold. Judge a rate only when the window holds enough answers.`;
        else if (R.delay == null || R.delay > 3) say = `No false alarms, but the first alert comes at ${at(R.first)}, ${R.delay} hours after the deploy. From late evening to morning no single hour has 50 answers, so the rule skips the whole night while customers are refused. A 3-hour window reaches back into the busy evening when the deploy lands, so it can judge at once; deep at night, though, even 3 hours of answers are too few.`;
        else say = `No false alarms, and the first alert at ${at(R.first)}, ${plural(R.delay, "hour")} after the deploy.${MINS[m] === 0 ? ` Before the deploy no quiet window happened to cross the threshold, not even the one ending ${at(quiet.h)} with only ${quiet.n} answers. That was luck: ${quiet.n} answers are too few to judge a rate (2 refusals in ${quiet.n} would already be ${pct(2 / quiet.n)}). Set a minimum.` : ` The 3-hour window ending ${at(R.first)} still reaches back into the busy evening, so it fires at once. Deep at night even 3-hour windows hold fewer than 50 answers and are skipped (${at(night[0])} to ${at(night[1])} the first night; ${skip3.length} windows after the deploy in all). Had the deploy come at 02:00, this rule too would have waited for the morning. To cover the night, use a longer window at night, or also alert on the number of refusals.`} ${THR[t] > 0.1 ? "15% catches this incident; a smaller jump, say to 10%, would slip under it." : ""} Compare A: it had a threshold but no minimum, which is why it fired at night.`;
      }
      const grp = (id, label, list, cur) => `<div class="${P}grp" id="${id}"><p>${label}</p>${kit.options(list, { picked: cur })}</div>`;
      el.innerHTML = `<h1>Write an alert that the team will trust</h1>
        <p class="lead">You add an alert on the refusal rate of customers' answers. Three choices make it. The <b>window</b>: how many hours of answers it pools. The <b>minimum</b>: how many answers the window needs before the rate counts. The <b>threshold</b>: the rate above which it fires. Alerting tools have the same choices. One of them, Prometheus, can also make a rule wait until its condition has held for a set time.</p>
        <p class="task">Pick a rule that never fires before the Tuesday 22:00 deploy and fires within 3 hours after it. The lesson replays your rule over the week.</p>
        ${grp("w", "Window", ["1 hour", "3 hours"], w)}${grp("m", "Minimum answers in the window", ["none", "50"], m)}${grp("t", "Fire when refusals are above", THR.map(x => `${Math.round(x * 100)}%`), t)}
        <div class="${P}res">${R ? `<p class="${P}cap">Refusals, % of customers' answers per hour <small>· marks: the hours your rule fires</small></p>
          ${chart(refPct, { max: 60, ticks: [0, 20, 60], thr: THR[t] * 100, fires: R.fired, fireCls: h => h < DEPLOY ? "no" : "enter", days: true, label: "Your rule replayed over the week" })}
          ${kit.feedback(say, pass ? true : false)}` : ""}</div>`;
      el.querySelectorAll("#w .lopts button").forEach(b => b.onclick = () => { w = +b.dataset.i; paint(); chk(); });
      el.querySelectorAll("#m .lopts button").forEach(b => b.onclick = () => { m = +b.dataset.i; paint(); chk(); });
      el.querySelectorAll("#t .lopts button").forEach(b => b.onclick = () => { t = +b.dataset.i; paint(); chk(); });
    };
    const chk = () => {
      if (w == null || m == null || t == null) return;
      const R = evalRule(WIN[w], MINS[m], THR[t]);
      if (!R.falses.length && R.delay != null && R.delay <= 3) done();
    };
    paint();
  }

  /* 9. The alert check in Python, replayed from a traced run. */
  const CODE = [
    "def first_alert(hours, win, min_n, threshold):",
    "    for end in range(win, len(hours) + 1):",
    "        span = hours[end - win:end]",
    "        answers = sum(h[\"ans\"] for h in span)",
    "        refusals = sum(h[\"ref\"] for h in span)",
    "        if answers < min_n:",
    "            continue",
    "        if refusals / answers > threshold:",
    "            return span[-1][\"at\"]",
    "    return None"
  ];
  const FRAMES = TRACE.slice(0, -1).map((s, i) => ({ ln: s.line, vars: TRACE[i + 1].vars }));
  const GATE = FRAMES.findIndex(f => f.ln === 7 && f.vars.end === 4);
  const spanOf = end => HOURS.slice(end - 3, end);
  function codeScreen({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const gs = spanOf(4), gn = sum(gs, x => x.ans), gr = sum(gs, x => x.ref);
    const popts = [`Yes: the deploy hour alone has ${gs[2].ref} refusals in ${gs[2].ans} answers`, `No: ${gr} of ${gn} is exactly 10%, and the rule needs more than 10%`, `No: the window has fewer than 50 answers`];
    const pright = 1;
    const say = f => {
      const v = f.vars, sp = v.end ? spanOf(v.end) : [];
      const names = sp.length ? `${sp[0].at} to ${sp[sp.length - 1].at}` : "";
      switch (f.ln) {
        case 1: return `end = ${v.end}: the window is the 3 hours ${names}.`;
        case 2: return `<code>span</code> holds those 3 hours.`;
        case 3: return `answers = ${sp.map(x => x.ans).join(" + ")} = ${v.answers}.${v.refusals != null ? " <code>refusals</code> still holds the last window's count until the next line runs." : ""}`;
        case 4: return `refusals = ${sp.map(x => x.ref).join(" + ")} = ${v.refusals}.`;
        case 5: return `${v.answers} answers is at least 50, so this window counts (the <code>continue</code> is skipped).`;
        case 7: return v.refusals / v.answers > 0.1 ? `${v.refusals} / ${v.answers} = ${pct(v.refusals / v.answers)}, above 10%: fire.` : `${v.refusals} / ${v.answers} = ${pct(v.refusals / v.answers)}, not above 10%: no alert, on to the next window.`;
        case 8: return `Return "${TRACE_RESULT}": the alert fires for the window ending at ${TRACE_RESULT}, one hour after the deploy.`;
        default: return "";
      }
    };
    const paint = () => {
      const f = FRAMES[i], gate = i === GATE - 1 && pred !== pright, v = f.vars;
      el.innerHTML = `<h1>The same rule in Python</h1>
        <p class="lead">The check behind your rule, run on five hours of the week around the deploy: <code>win=3</code> hours, <code>min_n=50</code> answers, <code>threshold=0.10</code>. Each step replays a real run; <code>hours</code> is this table (<code>ans</code> answers, <code>ref</code> refusals in the hour).</p>
        <table class="${P}tb"><thead><tr><th>at</th><th class="n">ans</th><th class="n">ref</th></tr></thead><tbody>
          ${HOURS.map((x, k) => `<tr class="${v.end && k >= v.end - 3 && k < v.end ? "hi" : ""}"><td>${x.at}</td><td class="n">${x.ans}</td><td class="n">${x.ref}</td></tr>`).join("")}</tbody></table>
        <p class="task">Step through to the end. Before the window that holds the deploy hour is judged, predict the result.</p>
        <div class="${P}code">${kit.code(CODE, f.ln)}</div>
        <div class="vars"><span>end <b>${v.end ?? "–"}</b></span><span>answers <b>${v.answers ?? "–"}</b></span><span>refusals <b>${v.refusals ?? "–"}</b></span><span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(say(f))}
        ${gate ? `<div id="pred"><p class="task">Next: <code>if refusals / answers &gt; threshold</code> for the window ${gs[0].at} to ${gs[2].at}. Does it fire?</p>${kit.options(popts.map(kit.esc), { picked: pred, correct: pright })}
          ${pred == null ? "" : pred === 0 ? kit.feedback(`The rule never looks at one hour alone: it pools ${gs.map(x => x.ans).join(" + ")} = ${gn} answers, and the two calm hours before the deploy dilute the bad one.`, false)
          : kit.feedback(`${gn} answers is well over 50. The minimum is not the issue; the rate is.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 || gate ? "disabled" : ""}>Next step</button></div>
        ${i === FRAMES.length - 1 ? kit.feedback(`That is the price of a wider window: the bad hour is pooled with calm ones, so the alert came one hour later than the deploy. A 1-hour window would react at once, and also fire on quiet nights. And note <code>&gt;</code>: ${gr} of ${gn} is exactly 10% and did not fire. Decide on purpose whether your threshold is "above" or "at least".`) : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 10. The big picture, with a task: which cost bites first. */
  const COSTS = ["Money", "Personal data", "People's attention"];
  const BIG = [
    ["A team runs a judge model on every answer of a busy bot, to score quality.", 0,
      "Right. A judge call per answer roughly doubles the number of model calls. Score a small random sample instead. Tracing tools that run judges on live traffic let you set what share of answers gets scored.",
      { 1: "Privacy matters here too, but the first thing that hits is the bill: one extra model call for every answer.", 2: "A judge adds scores to a chart; it does not page anyone. The bill is what grows." }],
    ["A team stores every prompt and answer in full, forever, to review later.", 1,
      "Right. Billing chats contain names, phone numbers and account details. Remove personal data before storing, keep logs only as long as you need them, and limit who can read them.",
      { 0: "Text is cheap to store. What hurts first is holding customers' personal details with no end date.", 2: "Stored logs page nobody. The risk is what they contain." }],
    ["A team pages the on-call engineer on 25 different metrics, each with a fixed threshold.", 2,
      "Right. Too many alerts make people stop reading them. That is part of why C was muted without a second look. Google's SRE book puts it as: every page should be actionable, meaning the person called can do something about it. Page on a few symptoms customers feel; put the rest on the dashboard.",
      { 0: "Alerts cost almost nothing to run. What runs out is the engineer's willingness to read them.", 1: "An alert carries a number, not chat text." }]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>What to monitor, and what it costs</h1>
        <p class="lead"><b>What for:</b> noticing, within hours, that a live LLM feature got worse, and finding why.</p>
        <p class="lead"><b>Reach for it</b> as soon as real users depend on the feature. Log per request: latency, tokens, cost, finish reason, prompt and model version, refusal. Page on a few symptoms customers feel; chart the rest; read a small sample daily.</p>
        <p class="lead"><b>Not for:</b> catching a bad change before release (run a fixed test set first), or a prototype with ten users (read every chat).</p>
        <p class="lead"><b>Cost:</b> storage and care with personal data, model calls for any judge, detectors to keep checked, and the team's attention.</p>
        <p class="task">For each plan, pick the cost that bites first.</p>
        ${BIG.map(([q, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(COSTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === r ? yes : no[ans[i]]), ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 11. Recognise it: is live monitoring the tool here? */
  const CASES = [
    ["After a model upgrade, a travel app's assistant answers some Spanish-speaking users in English. No errors, normal speed.", true,
      "Yes. A quiet failure in the answers. Detect the language of each question and each answer, and chart the share where they differ, by model version.",
      "Nothing in errors or latency will show it, which is exactly why it needs an answer-level signal: the share of answers whose language differs from the question's, split by model version."],
    ["Before shipping a prompt change, a team wants to know whether it makes the bot refuse more questions.", false,
      `No. Monitoring only sees answers after real users got them. Run the new prompt on a fixed set of test questions before release and compare. Tuesday's prompt would have refused ${V2_REFUSED.length} of the ${BILLING_N} billing test questions before any customer saw it.`,
      `Monitoring sees answers only after customers have received them. To know before release, run both prompts on the same fixed test questions. Tuesday's prompt refused ${V2_REFUSED.length} of ${BILLING_N} billing test questions: that check would have stopped it.`],
    ["After a switch of model, a meeting summariser's answers became three times longer and the monthly bill rose.", true,
      "Yes. Output tokens and cost per request, split by model version, show the change the day it shipped.",
      "This is what tokens per request and cost per request, split by model version, are for: the jump shows on the day of the switch."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is live monitoring the tool?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the billing bot.</p>
        <p class="task">For each one, decide if watching signals from live traffic is the right tool. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next (in-page practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Watch what the answers say</h1>
      <p class="lead">An LLM feature can fail with every request "successful". You found the real alert among false ones, traced it to one prompt line, fixed a detector that doubled the count, and wrote an alert rule that fires early with no false alarms.</p>
      <table class="${P}tb"><tbody>
        <tr><td><b>Service</b></td><td class="t">Errors, p95 latency, traffic. Page on what customers feel; leave test traffic out.</td></tr>
        <tr><td><b>Cost</b></td><td class="t">Input and output tokens per request, split by model and prompt version.</td></tr>
        <tr><td><b>Answers</b></td><td class="t">Refusal rate, finish reasons, answer length, a daily sample read or scored. Check every detector against hand labels.</td></tr>
        <tr><td><b>Rules</b></td><td class="t">A rate over a window with enough requests, a threshold between normal and bad, and the version in every log row.</td></tr>
      </tbody></table>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Here the bot changed and the questions stayed the same. Next, the bot stays the same while the questions change, and you measure how far they moved.</p>` : ""}`;
    done();
  }

  const FL = DET.flagged;
  LessonKit.define(ID, {
    title: "What to monitor in a live LLM feature",
    checked: "2026-11-14",
    sources: [
      "https://sre.google/sre-book/monitoring-distributed-systems/",
      "https://sre.google/workbook/alerting-on-slos/",
      "https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/",
      "https://openrouter.ai/docs/api/reference/overview",
      "https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create",
      "https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge"
    ],
    interview: [{
      q: "You are launching an LLM support bot next week. What do you log, what goes on the dashboard, and what pages someone at night?",
      good: [
        "Log every request with latency, input and output tokens, cost, finish reason, errors, and the model and prompt version",
        "Dashboard in three layers: service (errors, p95, traffic), cost per request, and the answers (refusal rate, cut-off share, a scored daily sample)",
        "Page only on symptoms customers feel, as rates over a window with a minimum number of requests, with thresholds set from the normal level",
        "Keep test traffic out, and check any refusal or quality detector against hand-labelled answers"
      ],
      weak: "Errors and latency, as for any API, and read the logs when users complain. That misses failures where every call succeeds and the answer is useless."
    }, {
      q: "Error rate and latency are normal, but complaints about your bot doubled this week. How do you investigate?",
      good: [
        "Read a sample of this week's conversations next to last week's",
        "Check answer-level signals: refusal rate, answer length, finish reasons",
        "Line the change up with deploys and split by prompt and model version",
        "Confirm the suspected change on a fixed test set before and after, then add the missing signal and alert"
      ],
      weak: "Add servers or switch to a bigger model. Nothing says the service is slow or the model too weak; nobody has looked at what the answers say."
    }],
    screens: [fourAlerts, whyFired, spotIdea, findCause, predict, brokenDetector, whichSignal, ruleBuilder, codeScreen, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", `#lines [data-i="${LINE_RIGHT}"]`] },
      { wrong: ["#c2 [data-wrong]"], right: PRED.map((_, i) => `#c${i} [data-right]`) },
      { wrong: [`#fl [data-i="${FL.findIndex(k => !NOT_REFUSAL.has(k))}"]`],
        right: [...FL.map((k, i) => NOT_REFUSAL.has(k) ? `#fl [data-i="${i}"]` : null).filter(Boolean), "#q2 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: FAILS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ['#w [data-i="0"]', '#m [data-i="0"]', '#t [data-i="0"]'], right: ['#w [data-i="1"]', '#m [data-i="1"]', '#t [data-i="1"]'] },
      { wrong: [...Array(Math.max(0, GATE - 1)).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FRAMES.length - GATE).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
