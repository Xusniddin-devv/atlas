/* Lesson: choosing a hosted model, and mixing models. Story: a language-learning app for adults grades short
   written English answers and writes a friendly line of feedback when an answer is not right yet.
   Ideas: (1) choose a model from your own test set: set the bars first (score, p95 latency), then take the
   cheapest setup that clears them; the leaderboard winner is not chosen when a cheaper setup does the job;
   (2) a pipeline's steps can use different models (or no model): measure each step on its own test.
   Data, all real:
   - docs/ai-path/runs/s6-choose-model/items.py: the 20-answer test set with teacher verdicts (written by hand
     before any model ran) and the five setups (A-E; D and E are the same model with thinking off and on);
   - recordings (main checkout) docs/ai-path/recordings/s6-choose-model/grade-<a..e>-01..20 (each setup grades
     all 20) and feedback-<a..e>-<item> (each setup writes feedback for the 10 answers that are not right),
     150 calls made by runs/s6-choose-model/record_all.py on 2026-11-17;
   - runs/s6-choose-model/latency.json (latency per call, captured right after recording), analyse.py +
     analyse.out.txt (scores and checks), export_lesson_data.py + export_lesson_data.out.txt (the data block below,
     copied unchanged), choose.py + choose.out.txt (the traced chooser on the code screen).
   Lesson-local style and pictures: answer rows, two small scatter plots and a pipeline strip, see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s6-choose-model";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => sum(a) / a.length;

  /* ---------- Data copied from runs/s6-choose-model/export_lesson_data.out.txt (not altered) ---------- */
  const ITEMS = [{"task": "Put the verb in the past simple: Yesterday I ___ (go) to the market.","key": "went","answer": "went","gold": "correct","fix": null},{"task": "Put the verb in the past simple: She ___ (buy) a new phone last week.","key": "bought","answer": "buyed","gold": "incorrect","fix": "bought"},{"task": "Make the sentence negative: He likes coffee.","key": "He doesn't like coffee.","answer": "He don't like coffee.","gold": "incorrect","fix": "doesn't"},{"task": "Complete with for or since: I have lived here ___ 2019.","key": "since","answer": "for","gold": "incorrect","fix": "since"},{"task": "Answer in a full sentence: What time do you usually get up?","key": "I usually get up at seven.","answer": "I usually wake up at 7 o'clock.","gold": "correct","fix": null},{"task": "Make a question: You are tired.","key": "Are you tired?","answer": "Are you tired?","gold": "correct","fix": null},{"task": "Write the plural: one child, two ___","key": "children","answer": "childs","gold": "incorrect","fix": "children"},{"task": "Use the comparative: This road is ___ (long) than that one.","key": "longer","answer": "more long","gold": "incorrect","fix": "longer"},{"task": "Rewrite with 'going to': I plan to visit my aunt on Sunday.","key": "I am going to visit my aunt on Sunday.","answer": "I'm going to visit my aunt on Sunday.","gold": "correct","fix": null},{"task": "Fill in the gap: ___ you ever been to Spain?","key": "Have","answer": "Have you ever been to Spain?","gold": "correct","fix": null},{"task": "Choose a or an: I saw ___ owl in the garden.","key": "an","answer": "a","gold": "incorrect","fix": "an"},{"task": "Answer in a full sentence: Where did you go last weekend?","key": "I went to the beach.","answer": "I go to the park with my sister.","gold": "incorrect","fix": "went"},{"task": "Put the verb in the past simple: They ___ (not / see) the film.","key": "didn't see","answer": "did not see","gold": "correct","fix": null},{"task": "Write the opposite: The shop is open.","key": "The shop is closed.","answer": "The shop is close.","gold": "incorrect","fix": "closed"},{"task": "Put the words in order: always / she / late / is","key": "She is always late.","answer": "She is always late.","gold": "correct","fix": null},{"task": "Answer in a full sentence: What do you like to eat for breakfast?","key": "I like to eat eggs for breakfast.","answer": "I like eating toast with jam for breakfast.","gold": "correct","fix": null},{"task": "Complete: If it rains tomorrow, we ___ (stay) at home.","key": "will stay","answer": "would stay","gold": "incorrect","fix": "will stay"},{"task": "Put the verb in the past simple: I ___ (write) a letter to my friend.","key": "wrote","answer": "wrote","gold": "correct","fix": null},{"task": "Make a yes/no question: She lives in Lisbon.","key": "Does she live in Lisbon?","answer": "Does she lives in Lisbon?","gold": "incorrect","fix": "live"},{"task": "Answer in a full sentence: How many brothers or sisters do you have?","key": "I have one brother.","answer": "I have two sisters and no brothers.","gold": "correct","fix": null}];
  const RUNS = {"A": {"model": "google/gemini-2.5-flash-lite", "reasoning": null, "verdict": ["correct", "incorrect", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "incorrect", "correct", "correct", "incorrect", "correct", "incorrect", "correct"], "gradeMs": [665, 726, 671, 760, 778, 817, 678, 606, 857, 746, 612, 709, 730, 752, 666, 768, 676, 874, 796, 767], "gradeUsd": [8.7e-06, 8.9e-06, 9e-06, 8.6e-06, 9.9e-06, 8.3e-06, 7.9e-06, 8.5e-06, 1.03e-05, 8.7e-06, 8.2e-06, 9.5e-06, 9.2e-06, 8.6e-06, 9e-06, 9.9e-06, 8.6e-06, 8.8e-06, 9.1e-06, 9.5e-06], "thinkTokens": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "feedback": ["That's a great try! The past tense of \"buy\" is \"bought.\"", "Great try! It should be \"He **doesn't** like coffee.\"", "You're so close! It's actually \"since 2019\" because", "That's a great try! The plural of \"child\" is actually \"children.\"", "That's a great try! The correct way to say it is: This road is **longer** than that one.", "Great try! For words that start with a vowel sound, like \"owl,\" we use \"an.\" So, it should be \"I saw an owl in the garden.\"", "That's a great start! To talk about last weekend, you could say: \"I went to the park with my sister.\"", "Good try! To show the opposite of \"open,\" we need to use \"closed.\" So, it would be \"The shop is closed.\"", "That's a good try! For this kind of future possibility, we usually say \"we **will stay** at home.\"", "Great attempt! Remember, after \"does,\" we use the base form of the verb, so it should be \"Does she live in Lisbon?\""], "feedbackFinish": ["stop", "stop", "error", "stop", "stop", "stop", "stop", "stop", "stop", "stop"], "feedbackMs": [756, 857, 30898, 780, 951, 917, 821, 941, 839, 844], "feedbackUsd": [1.5e-05, 1.43e-05, 0, 1.4e-05, 1.74e-05, 2.11e-05, 1.92e-05, 1.91e-05, 1.79e-05, 1.96e-05]}, "B": {"model": "openai/gpt-4o-mini", "reasoning": null, "verdict": ["correct", "incorrect", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "incorrect", "correct", "correct", "incorrect", "correct", "incorrect", "correct"], "gradeMs": [949, 676, 756, 749, 638, 990, 805, 756, 857, 757, 754, 828, 792, 709, 1016, 769, 779, 724, 823, 690], "gradeUsd": [1.425e-05, 1.455e-05, 1.395e-05, 1.38e-05, 1.575e-05, 1.35e-05, 1.305e-05, 1.395e-05, 1.62e-05, 1.425e-05, 1.35e-05, 1.53e-05, 1.47e-05, 1.395e-05, 1.47e-05, 1.59e-05, 1.41e-05, 1.44e-05, 1.455e-05, 1.53e-05], "thinkTokens": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "feedback": ["Great effort! The correct form is \"bought.\" Keep practicing, and you'll get the hang of it!", "Great effort! The correct form is \"He doesn't like coffee.\" Keep practicing!", "Great effort! The correct word to use here is \"since,\" so the sentence should read: \"I have lived here since 2019.\" Keep practicing!", "Great effort! The correct plural form is \"children.\" Keep practicing!", "Great effort! The correct form is \"longer\" for the comparative. Keep practicing!", "Great effort! The correct choice is \"an\" because \"owl\" starts with a vowel sound. Keep it up!", "Great effort! You could say, \"I went to the park with my sister.\" Keep practicing!", "Great effort! The correct form is \"The shop is closed.\" Keep practicing!", "Great effort! The correct form is \"will stay\" since we're talking about a possible future event. Keep up the good work!", "Great effort! Just remember to use \"live\" instead of \"lives\" in your question: \"Does she live in Lisbon?\" Keep practicing!"], "feedbackFinish": ["stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop"], "feedbackMs": [1211, 853, 2914, 971, 1082, 981, 1226, 1118, 1084, 1192], "feedbackUsd": [2.61e-05, 2.19e-05, 3.135e-05, 1.98e-05, 2.31e-05, 2.625e-05, 2.565e-05, 2.19e-05, 2.805e-05, 3.09e-05]}, "C": {"model": "deepseek/deepseek-chat", "reasoning": null, "verdict": ["correct", "incorrect", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "incorrect", "correct", "correct", "incorrect", "correct", "incorrect", "correct"], "gradeMs": [1463, 543, 3503, 1618, 1788, 1564, 663, 824, 2258, 1288, 1083, 539, 1596, 1249, 536, 806, 1070, 1097, 1567, 548], "gradeUsd": [2.3679e-05, 2.5223e-05, 2.4708e-05, 2.3936e-05, 2.6253e-05, 2.2392e-05, 2.2906e-05, 2.4193e-05, 2.754e-05, 2.3679e-05, 2.3421e-05, 2.651e-05, 2.4709e-05, 2.4193e-05, 2.4451e-05, 2.651e-05, 2.445e-05, 2.3936e-05, 2.5223e-05, 2.5481e-05], "thinkTokens": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "feedback": ["\"Almost there! The correct past form is 'bought' - it's one of those irregular verbs that changes a bit more. You'll get the hang of these with practice!\"  \n\nor  \n\n\"Good try! For this verb, we say 'bought' in the past. English has some special verbs that don't follow the usual -ed pattern.\"", "Almost there! The correct form is: *He doesn't like coffee.* Keep practicing—you're doing great!", "A great try! The correct answer is \"since\" because we use it with a specific point in time like 2019. Keep up the good work!", "Here's a friendly way to correct it:  \n\n*\"The plural of 'child' is actually 'children'—it's one of those special words that changes a bit more!\"*  \n\nThis keeps it positive and helpful! 😊", "Here's a friendly way to provide feedback:  \n\n\"Great try! We usually say 'longer' instead of 'more long' when comparing two things. Keep up the good work!\"  \n\nThis keeps it encouraging while gently correcting. 😊", "Great try! We say \"an owl\" because the word starts with a vowel sound. Keep up the good work!", "A better way to say that would be: \"I went to the park with my sister last weekend.\" Remember to use the past tense for past events! 😊", "Almost there! The right form is \"The shop is closed.\" Keep up the good work!", "\"Good try! The correct form is 'If it rains tomorrow, we will stay at home.' Using 'will' shows a definite plan for a possible future situation.\"  \n\n(Or more concisely: \"Almost there! We say 'will stay' here because it's a likely future plan if it rains.\")", "Almost there! The correct form is: *Does she live in Lisbon?* (We use the base form \"live\" after \"does.\") Keep up the great work!"], "feedbackFinish": ["stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop"], "feedbackMs": [3548, 5860, 1408, 2123, 1506, 1021, 1607, 780, 1361, 1936], "feedbackUsd": [9.6716e-05, 4.4766e-05, 5.3252e-05, 6.8682e-05, 7.0997e-05, 4.4508e-05, 5.6855e-05, 4.0136e-05, 8.7714e-05, 5.8654e-05]}, "D": {"model": "google/gemini-2.5-flash", "reasoning": {"effort": "none"}, "verdict": ["correct", "incorrect", "incorrect", "incorrect", "incorrect", "correct", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "incorrect", "correct", "correct", "incorrect", "correct", "incorrect", "correct"], "gradeMs": [606, 652, 690, 814, 646, 588, 598, 732, 799, 588, 649, 642, 822, 632, 607, 1016, 729, 740, 876, 759], "gradeUsd": [2.74e-05, 2.8e-05, 2.83e-05, 2.71e-05, 3.1e-05, 2.62e-05, 2.5e-05, 2.68e-05, 3.22e-05, 2.74e-05, 2.59e-05, 2.98e-05, 2.89e-05, 2.71e-05, 2.83e-05, 3.1e-05, 2.71e-05, 2.77e-05, 2.86e-05, 2.98e-05], "thinkTokens": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "feedback": ["You're on the right track! The past simple of 'buy' is 'bought'.", "You're very close! Remember, when we use \"he\" or \"she,\" we say \"doesn't.\" So, it's \"He doesn't like coffee.\"", "You're very close! We use \"since\" when talking about a specific starting point in time, like \"I have lived here since 2019.\" \"For\" is used to talk about a duration, like \"I have lived here for five years.\"", "You're very close! The plural of \"child\" is \"children.\"", "You're on the right track! For most short adjectives like \"long,\" we add \"-er\" to make the comparative, so \"longer\" is what we're looking for here.", "That's a good try! We use \"an\" before words that start with a vowel sound, like \"owl.\"", "That's a great start! Remember, when we talk about the past, we use \"went\" instead of \"go.\" So you could say, \"I went to the park with my sister.\"", "You're very close! We just need to add a 'd' to the end: \"The shop is closed.\"", "The sentence starts with \"If it rains,\" which is about a possible future event. For this, we use \"will stay\" to talk about what we'll do. \"Would stay\" is used for situations that are not real or less likely.", "The helping verb \"does\" already shows the tense, so the main verb \"live\" should be in its base form. It should be \"Does she live in Lisbon?\""], "feedbackFinish": ["stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop"], "feedbackMs": [872, 988, 1027, 930, 845, 925, 863, 879, 1047, 1050], "feedbackUsd": [7.09e-05, 0.0001187, 0.00016, 6.04e-05, 0.0001197, 8.63e-05, 0.0001277, 8.5e-05, 0.00015, 0.0001115]}, "E": {"model": "google/gemini-2.5-flash", "reasoning": {"max_tokens": 512}, "verdict": ["correct", "incorrect", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "correct", "incorrect", "incorrect", "correct", "incorrect", "correct", "correct", "incorrect", "correct", "incorrect", "correct"], "gradeMs": [2537, 740, 1981, 2181, 3757, 2721, 2396, 2568, 3512, 2616, 966, 3003, 2287, 4492, 2438, 3074, 3631, 2365, 9213, 2453], "gradeUsd": [0.0005799, 2.8e-05, 0.0003983, 0.0003621, 0.001096, 0.0007287, 0.00039, 0.0005668, 0.0009947, 0.0007149, 2.59e-05, 0.0007923, 0.0004614, 0.0009896, 0.0004908, 0.000881, 0.0010196, 0.0004727, 0.0005786, 0.0005648], "thinkTokens": [222, 0, 149, 135, 427, 282, 147, 217, 386, 276, 0, 306, 174, 386, 186, 341, 398, 179, 221, 215], "feedback": ["That's a great try! The past simple form of 'buy' is 'bought'.", "You're very close! Remember that with 'he,' we use 'doesn't.' The sentence is 'He doesn't like coffee.'", "You're close! We use 'since' for a specific starting point in time, like a year. So it's \"I have lived here since 2019.\"", "That's a good try! The plural form is **children**.", "Good try! The comparative form of 'long' is 'longer'.", "That's a good try! We use 'an' before words that start with a vowel sound, so it's 'an owl'.", "To talk about last weekend, you can say, \"I went to the park with my sister.\"", "Good try! The opposite of \"open\" is \"closed.\"", "Almost there! For a possible future event like this, we say \"will stay.\"", "Almost perfect! When you use 'does,' the main verb doesn't need an 's' at the end. The question is 'Does she live in Lisbon?'"], "feedbackFinish": ["stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop", "stop"], "feedbackMs": [3327, 4093, 3660, 2430, 2517, 3719, 3548, 2978, 3052, 3299], "feedbackUsd": [0.0011459, 0.0011987, 0.00124, 0.0005579, 0.0006672, 0.0010163, 0.0010002, 0.00075, 0.00078, 0.0009015]}};
  const RECORDED_AT = "2026-11-17";
  const CAPTION = `Recorded model output, ${RECORDED_AT}`;
  const LETTERS = ["A", "B", "C", "D", "E"];
  // How the lesson describes each setup (no vendor or version names; the exact models are in RUNS[*].model)
  const WHO = {
    A: "a low-price model from vendor 1",
    B: "a low-price model from vendor 2",
    C: "a general chat model from vendor 3",
    D: "a pricier model from vendor 1, thinking off",
    E: "the same model as D, thinking on"
  };

  /* ---------- The team's bars (product decisions made in the story) ---------- */
  const MIN_SCORE = 20;          // grading: agree with the teacher on all 20 answers
  const GRADE_BUDGET_MS = 1500;  // grading: the learner presses Check and waits; p95 must stay under this
  const FB_MIN = 10;             // feedback: pass the checks on all 10 answers that are not right
  const FB_BUDGET_MS = 3000;     // feedback: shown right after the grade; the slowest call must stay under this
  const MAX_WORDS = 40;

  /* ---------- Derived from the data ---------- */
  const N = ITEMS.length;
  const norm = s => s.trim().toLowerCase().replace(/\s+/g, " ");
  const verdictOf = s => s.toLowerCase().replace(/[^a-z]/g, "");
  const EXACT = ITEMS.map((it, i) => norm(it.answer) === norm(it.key) ? i : -1).filter(i => i >= 0);
  const RIGHT_IDX = ITEMS.map((it, i) => it.gold === "correct" ? i : -1).filter(i => i >= 0);
  const WRONG_IDX = ITEMS.map((it, i) => it.gold === "incorrect" ? i : -1).filter(i => i >= 0);
  // p95 by the nearest-rank rule: with 20 calls, the 19th of the 20 times sorted; with 10, the slowest
  const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.ceil(0.95 * s.length) - 1]; };
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const fbCheck = (text, fix, finish) => {
    const words = text.split(/\s+/).filter(Boolean).length;
    const r = { fix: text.toLowerCase().includes(fix.toLowerCase()), short: words <= MAX_WORDS, polite: !/\b(wrong|incorrect)\b/i.test(text), finished: finish === "stop", words };
    r.ok = r.fix && r.short && r.polite && r.finished;
    return r;
  };
  const S = {};
  for (const k of LETTERS) {
    const r = RUNS[k];
    const v = r.verdict.map(verdictOf);
    const fb = r.feedback.map((t, j) => fbCheck(t, ITEMS[WRONG_IDX[j]].fix, r.feedbackFinish[j]));
    S[k] = {
      v, score: v.filter((x, i) => x === ITEMS[i].gold).length, missed: v.map((x, i) => x === ITEMS[i].gold ? -1 : i).filter(i => i >= 0),
      p50: median(r.gradeMs), p95: p95(r.gradeMs), cost: mean(r.gradeUsd) * 1e6, think: mean(r.thinkTokens),
      fb, fbScore: fb.filter(c => c.ok).length, fbSlow: Math.max(...r.feedbackMs), fbCost: mean(r.feedbackUsd) * 1e6
    };
  }
  // the chooser, the same rule as choose_model on the code screen
  const choose = (score, slow, cost, min, budget) => LETTERS.filter(k => score(k) >= min && slow(k) <= budget).sort((a, b) => cost(a) - cost(b))[0];
  const GRADER = choose(k => S[k].score, k => S[k].p95, k => S[k].cost, MIN_SCORE, GRADE_BUDGET_MS);
  const WRITER = choose(k => S[k].fbScore, k => S[k].fbSlow, k => S[k].fbCost, FB_MIN, FB_BUDGET_MS);
  const LEADER = "E"; // the story's hypothetical leaderboard winner
  // setups that some other setup beats for grading: at least as good on score, cost and p95, better on one
  const beats = (a, b) => S[a].score >= S[b].score && S[a].cost <= S[b].cost && S[a].p95 <= S[b].p95 &&
    (S[a].score > S[b].score || S[a].cost < S[b].cost || S[a].p95 < S[b].p95);
  const BEATEN = LETTERS.filter(b => LETTERS.some(a => a !== b && beats(a, b)));
  const UNBEATEN = LETTERS.filter(k => !BEATEN.includes(k));
  const TIED = LETTERS.filter(k => S[k].score === N);
  // the pipeline, if real traffic looks like the test set
  const SHARE_MODEL = (N - EXACT.length) / N, SHARE_FB = WRONG_IDX.length / N;
  const cents = x => parseFloat(x.toFixed(2)); // the sum is worked with the per-call costs as shown, to the cent
  const MIXED = SHARE_MODEL * cents(S[GRADER].cost) + SHARE_FB * cents(S[WRITER].fbCost);
  const ALL_LEADER = 1 * cents(S[LEADER].cost) + SHARE_FB * cents(S[LEADER].fbCost);
  const RATIO = Math.round(ALL_LEADER / MIXED);
  // one feedback text from each failing setup, as recorded
  const C_FAIL = S.C.fb.findIndex(c => !c.short);
  const A_FAIL = S.A.fb.findIndex(c => !c.finished);

  const usd = x => "$" + (x >= 100 ? x.toFixed(0) : x.toFixed(1));
  const usd2 = x => "$" + x.toFixed(2);
  const secs = ms => (ms < 10000 ? parseFloat((ms / 1000).toFixed(2)) : (ms / 1000).toFixed(1)) + "\u00a0s";
  const times = x => x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
  const num = i => "#" + (i + 1);

  /* ---------- Lesson-local style and pictures ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-ans { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
      .lx-${ID}-task, .lx-${ID}-said, .lx-${ID}-key { display: block; }
      .lx-${ID}-task { font-size: 14.5px; color: var(--muted); line-height: 1.45; }
      .lx-${ID}-said { font: 600 16px/1.45 var(--mono); color: var(--ink); margin-top: 4px; overflow-wrap: anywhere; }
      .lx-${ID}-key { font-size: 14px; color: var(--muted); margin-top: 2px; }
      .lx-${ID}-rows { margin: 16px 0 0; display: grid; gap: 8px; }
      .lx-${ID}-row { display: block; width: 100%; min-height: 48px; text-align: left; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); cursor: pointer; font: inherit; }
      .lx-${ID}-row:hover { border-color: var(--ink); }
      .lx-${ID}-row.no { border-color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-row.found { border-color: var(--good); background: var(--good-soft); }
      .lx-${ID}-row .lx-${ID}-said { font-size: 15px; }
      .lx-${ID}-verdict { display: inline-block; margin-top: 4px; font: 600 13.5px var(--mono); color: var(--ink-2); }
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin-top: 16px; font: 500 14.5px var(--mono); }
      .lx-${ID}-tbl caption { text-align: left; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; padding-bottom: 6px; }
      .lx-${ID}-tbl th { text-align: right; font: 600 13px var(--font); color: var(--muted); padding: 4px 6px 6px; border-bottom: 2px solid var(--ink); vertical-align: bottom; }
      .lx-${ID}-tbl td { white-space: nowrap; text-align: right; padding: 7px 6px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-tbl th:first-child, .lx-${ID}-tbl td:first-child { text-align: left; }
      .lx-${ID}-tbl td.out { color: var(--bad); }
      .lx-${ID}-tbl tr.pick td { background: var(--good-soft); font-weight: 700; }
      .lx-${ID}-note { font-size: 13.5px; color: var(--muted); margin: 6px 0 0; line-height: 1.45; }
      .lx-${ID}-who { margin: 10px 0 0; padding: 0; list-style: none; font-size: 15px; line-height: 1.5; }
      .lx-${ID}-who b { font-family: var(--mono); }
      .lx-${ID}-plots { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 16px; }
      .lx-${ID}-plot { flex: 1 1 260px; min-width: 0; margin: 0; }
      .lx-${ID}-plot figcaption { font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 6px; }
      .lx-${ID}-area { position: relative; height: 150px; margin-left: 30px; border-left: 1.5px solid var(--ink); border-bottom: 1.5px solid var(--ink); }
      .lx-${ID}-gl { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--line); }
      .lx-${ID}-gl span { position: absolute; left: -30px; top: -9px; width: 24px; text-align: right; font: 600 12px var(--mono); color: var(--muted); }
      .lx-${ID}-vl { position: absolute; top: 0; bottom: 0; border-left: 1px dashed var(--line); }
      .lx-${ID}-vl.budget { border-left: 2px dashed var(--ink-2); }
      .lx-${ID}-vl span { position: absolute; bottom: -22px; left: 0; transform: translateX(-50%); font: 500 12px var(--mono); color: var(--muted); white-space: nowrap; }
      .lx-${ID}-vl.budget span { top: auto; bottom: 4px; left: 6px; transform: none; color: var(--ink-2); font-weight: 700; }
      .lx-${ID}-pt { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--ink); }
      .lx-${ID}-pt.gone { opacity: .3; }
      .lx-${ID}-pt b { position: absolute; font: 700 13px var(--mono); color: var(--ink); top: -20px; left: 50%; transform: translateX(-50%); }
      .lx-${ID}-pt.l b { left: auto; right: 13px; top: -8px; transform: none; }
      .lx-${ID}-pt.r b { left: 13px; top: -8px; transform: none; }
      .lx-${ID}-xl { margin: 26px 0 0 30px; font-size: 13px; color: var(--muted); }
      .lx-${ID}-pick { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
      .lx-${ID}-pick button { min-width: 56px; min-height: 48px; font: 700 17px var(--mono); border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); cursor: pointer; }
      .lx-${ID}-pick button.on { border-color: var(--ink); text-decoration: line-through; color: var(--muted); }
      .lx-${ID}-pick button.no { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
      .lx-${ID}-pipe { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; margin-top: 16px; }
      .lx-${ID}-stage { flex: 1 1 140px; border: 1.5px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 14.5px; line-height: 1.4; background: var(--surface); }
      .lx-${ID}-stage b { display: block; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 4px; }
      .lx-${ID}-stage.set { border-color: var(--ink); }
      .lx-${ID}-stage i { font-style: normal; font-family: var(--mono); font-weight: 700; }
      .lx-${ID}-quote { margin: 12px 0 0; padding: 10px 14px; border-left: 3px solid var(--ink); background: var(--sunk); font: 500 14.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
    `;
    document.head.appendChild(s);
  }
  const answerBox = (kit, i, showKey) => `<span class="lx-${ID}-task">${num(i)} · ${kit.esc(ITEMS[i].task)}</span><span class="lx-${ID}-said">${kit.esc(ITEMS[i].answer)}</span>${showKey ? `<span class="lx-${ID}-key">Answer key: ${kit.esc(ITEMS[i].key)}</span>` : ""}`;
  const quote = (kit, text) => `<div class="lx-${ID}-quote">${kit.esc(text)}</div><p class="lx-${ID}-cap">${CAPTION}</p>`;
  const whoList = kit => `<ul class="lx-${ID}-who">${LETTERS.map(k => `<li><b>${k}</b> ${kit.esc(WHO[k])}</li>`).join("")}</ul>`;
  // rows: [[cells...]], head: [labels], cls: (rowIndex, colIndex) => "out" | ""
  function tbl(kit, head, rows, { title = "", pickRow = -1, cls = () => "" } = {}) {
    return `<table class="lx-${ID}-tbl">${title ? `<caption>${kit.esc(title)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) =>
      `<tr${i === pickRow ? ' class="pick"' : ""}>${r.map((c, j) => `<td class="${cls(i, j)}">${kit.esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const gradeTable = (kit, opts = {}) => tbl(kit, ["setup", "agrees with teacher", "p95 wait", "$ per million gradings"],
    LETTERS.map(k => [k, `${S[k].score} / ${N}`, secs(S[k].p95), usd(S[k].cost)]),
    { title: "Grading the 20 test answers", cls: opts.bars ? (i, j) => (j === 1 && S[LETTERS[i]].score < MIN_SCORE) || (j === 2 && S[LETTERS[i]].p95 > GRADE_BUDGET_MS) ? "out" : "" : () => "", pickRow: opts.pick ? LETTERS.indexOf(opts.pick) : -1 });
  // a small scatter: pts [{k, x, y, gone, lab}], x scale {min, max, log, ticks: [[value, label]]}, budget: x value
  function plot(kit, title, pts, xs, xLabel, budget) {
    const fx = x => { const t = xs.log ? (Math.log10(x) - Math.log10(xs.min)) / (Math.log10(xs.max) - Math.log10(xs.min)) : (x - xs.min) / (xs.max - xs.min); return 4 + t * 92; };
    const fy = y => 100 - ((y - 18.4) / (20.5 - 18.4)) * 100;
    const yl = [19, 20].map(y => `<div class="lx-${ID}-gl" style="top:${fy(y)}%"><span>${y}</span></div>`).join("");
    const vl = xs.ticks.map(([v, l]) => `<div class="lx-${ID}-vl" style="left:${fx(v)}%"><span>${kit.esc(l)}</span></div>`).join("");
    const bl = budget == null ? "" : `<div class="lx-${ID}-vl budget" style="left:${fx(budget)}%"><span>budget</span></div>`;
    const pp = pts.map(p => `<div class="lx-${ID}-pt${p.gone ? " gone" : ""}${p.lab ? " " + p.lab : ""}" style="left:${fx(p.x)}%;top:${fy(p.y)}%" aria-label="${p.k}: score ${p.y}"><b>${p.k}</b></div>`).join("");
    return `<figure class="lx-${ID}-plot"><figcaption>${kit.esc(title)}</figcaption><div class="lx-${ID}-area" role="img" aria-label="${kit.esc(title)}">${yl}${vl}${bl}${pp}</div><div class="lx-${ID}-xl">${kit.esc(xLabel)}</div></figure>`;
  }
  function plots(kit, gone = []) {
    const costPts = LETTERS.map(k => ({ k, x: S[k].cost, y: S[k].score, gone: gone.includes(k) }));
    // A and B sit close together on the wait axis: put their letters on the outer sides
    const order = [...LETTERS].filter(k => S[k].score === N).sort((a, b) => S[a].p95 - S[b].p95);
    const waitPts = LETTERS.map(k => ({ k, x: S[k].p95, y: S[k].score, gone: gone.includes(k), lab: k === order[0] ? "l" : k === order[1] ? "r" : "" }));
    return `<div class="lx-${ID}-plots">
      ${plot(kit, "Score against cost", costPts, { min: 5, max: 1500, log: true, ticks: [[10, "$10"], [100, "$100"], [1000, "$1000"]] }, "$ per million gradings (each mark is 10 times the last)")}
      ${plot(kit, "Score against waiting", waitPts, { min: 0, max: 5000, ticks: [[1000, "1 s"], [2000, "2 s"], [3000, "3 s"], [4000, "4 s"]] }, "p95 wait for a grade", GRADE_BUDGET_MS)}
    </div>`;
  }
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* 1. The situation: grade three answers yourself. */
  function gradeYourself({ el, done, kit }) {
    ensureStyle();
    const pick = [4, 8, 18]; // #5, #9, #19
    const ans = pick.map(() => null);
    const say = {
      4: ["Right. It uses other words than the key (“wake up”, “7 o'clock”), but it answers the question in good English. That is a right answer.",
          "It does not match the key, but the task did not ask for the key's words. “I usually wake up at 7 o'clock.” answers the question and is good English, so it is right."],
      8: ["Right. “I'm” is just a short form of “I am”. The sentence does what the task asks.",
          "The only difference from the key is “I'm” for “I am”, a normal short form. A learner marked wrong for this would be right to complain."],
      18: ["Right. After “does”, the verb takes its base form: “Does she live …?”. “lives” is the mistake.",
           "Read the verb after “does”: “lives”. In a question with “does”, the verb takes no -s: “Does she live in Lisbon?”."]
    };
    const ok = (j, a) => a === (ITEMS[pick[j]].gold === "correct" ? 0 : 1);
    const paint = () => {
      el.innerHTML = `<h1>Is this answer right?</h1>
        <p class="lead">A language-learning app for adults gives short English exercises. The learner types an answer and presses Check. The app then <b>grades</b> the answer, and if it is not right yet, it <b>writes one or two friendly sentences of feedback</b>. Today each of those is a call to a hosted model, paid per token, and the learner waits for the grade.</p>
        <p class="lead">The team must decide which model to use for each step, or whether to use one at all, so that grades stay good while the bill and the wait stay small. First, do the grader's job yourself.</p>
        <p class="task">Mark each answer right or not right.</p>
        ${pick.map((i, j) => `<div class="lcase" id="c${j}"><div class="lx-${ID}-ans">${answerBox(kit, i, true)}</div>${kit.options(["Right", "Not right"], { picked: ans[j], correct: ITEMS[i].gold === "correct" ? 0 : 1 })}${ans[j] == null ? "" : kit.feedback(say[i][ok(j, ans[j]) ? 0 : 1], ok(j, ans[j]))}</div>`).join("")}
        ${ans.every((a, j) => ok(j, a)) ? kit.feedback(`Both right answers here (${[4, 8].map(num).join(" and ")}) differ from the answer key. So grading needs judgement, not a string comparison. That judgement is what you will buy from a model.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, j) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[j] = +b.dataset.i; paint();
        if (ans.every((a, k) => ok(k, a))) done();
      }));
    };
    paint();
  }

  /* 2. Score one setup by hand against your own judgement. */
  function scoreByHand({ el, done, kit }) {
    ensureStyle();
    const k = "D", missed = S[k].missed;
    let tapped = null; const found = new Set();
    const paint = () => {
      const fin = missed.every(i => found.has(i));
      el.innerHTML = `<h1>Score one model by hand</h1>
        <p class="lead">The team wrote a <b>test set</b>: ${N} real-looking learner answers, each with a verdict a teacher decided. Five <b>setups</b> (a setup is a model plus its settings) graded all ${N}, one call per answer, in recorded runs. Here are the verdicts of one of them, setup ${k}.</p>
        <p class="task">You are the teacher. Tap every answer where ${k}'s verdict is a mistake.</p>
        <div class="lx-${ID}-rows">${ITEMS.map((it, i) => {
          const st = found.has(i) ? " found" : tapped === i ? " no" : "";
          return `<div><button type="button" class="lx-${ID}-row${st}" data-i="${i + 1}">${answerBox(kit, i, false)}<span class="lx-${ID}-verdict">${k} said: ${kit.esc(S[k].v[i])}</span></button>${tapped === i ? kit.feedback(`${k} said “${kit.esc(S[k].v[i])}” here, and the teacher agrees. ${it.gold === "correct" ? "The answer does what the task asks, in good English." : `The answer has a real mistake: the right form uses “${kit.esc(it.fix)}”.`} Look for a verdict you would overrule.`, false) : ""}</div>`;
        }).join("")}</div>
        <div class="lpanel">${fin ? kit.feedback(`Found it. ${k} marked ${missed.map(num).join(", ")} wrong, a right answer that only uses other words than the key. That was ${k}'s only mistake: it agrees with the teacher on <b>${S[k].score} of ${N}</b>. You just scored a model on a test set. For a learner, being told a right answer is wrong is the worst kind of mistake.`, true) : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-row`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i - 1;
        if (missed.includes(i)) { found.add(i); tapped = null; paint(); if (missed.every(m => found.has(m))) done(); return; }
        tapped = i; paint();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the leaderboard winner against your own bars. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [`${LEADER}: it tops the leaderboard`, `${GRADER}: it costs the least`, "D: it has the fastest median wait", "C: it agrees on all 20 too"];
    const RIGHT = 1;
    const fb = [
      [`${LEADER} agrees with the teacher on ${S[LEADER].score} of ${N}, the same as ${GRADER}. It costs about ${times(S[LEADER].cost / S[GRADER].cost)} times more per grading, and its p95 wait is ${secs(S[LEADER].p95)}, over the ${secs(GRADE_BUDGET_MS)} budget. With thinking on, it wrote about ${Math.round(S[LEADER].think)} thinking tokens before each one-word verdict, and those are billed as output tokens. A leaderboard scores other tasks; your test set scores yours.`, false],
      [`Right. ${GRADER} clears both bars (${S[GRADER].score} of ${N}, p95 ${secs(S[GRADER].p95)}) and costs the least. That is the whole rule: <b>set the bars first, then take the cheapest setup that clears them on your own test set.</b> ${LEADER} was not chosen: it scored no higher here, and it is slower and costs about ${times(S[LEADER].cost / S[GRADER].cost)} times more.`, true],
      [`D's median is ${secs(S.D.p50)}, the lowest. But it marked a right answer wrong (${S.D.missed.map(num).join(", ")}), so it fails the first bar. And the budget is on p95, the wait of the slowest learner in twenty, not on the median.`, false],
      [`C agrees on all ${N}, but its p95 wait is ${secs(S.C.p95)}, over the ${secs(GRADE_BUDGET_MS)} budget, and it costs more than ${GRADER}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which one grades?</h1>
        <p class="lead">The five setups:</p>${whoList(kit)}
        <p class="lx-${ID}-note">“Thinking” means the model writes reasoning tokens before its answer. They are not part of the answer, but you pay for them as output tokens.</p>
        ${gradeTable(kit)}
        <p class="lx-${ID}-note">p95 wait: sort the 20 waits and take the 19th. Cost: what one API router (a service that passes calls on to many vendors) charged for a million gradings, at prices on ${RECORDED_AT}. One grading costs a tiny part of a cent.</p>
        <p class="lead">Before looking, the team set two <b>bars</b>, the minimums a setup must clear: agree with the teacher on all ${N}, and a p95 wait under ${secs(GRADE_BUDGET_MS)}. A teammate says: “Suppose a public leaderboard ranks ${LEADER} first. Let's use ${LEADER}.”</p>
        <p class="task">Which setup do you choose for grading?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Plot quality against cost and waiting; strike the setups you would never pick. */
  function plotIt({ el, done, kit }) {
    ensureStyle();
    const struck = new Set(); let bad = null;
    const fin = () => BEATEN.every(k => struck.has(k)) && struck.size === BEATEN.length;
    const paint = () => {
      const ok = fin();
      el.innerHTML = `<h1>Plot it: who is never worth it?</h1>
        <p class="lead">The same numbers as two pictures. Score is how many of the ${N} answers a setup graded like the teacher. Up is better, left is better. A setup is <b>beaten</b> when another one is at least as good on score, cost and wait, and better on at least one.</p>
        ${plots(kit, [...struck])}
        <p class="task">Tap every setup you would never pick for grading, whatever bars the team sets.</p>
        <div class="lx-${ID}-pick">${LETTERS.map(k => `<button type="button" class="${struck.has(k) ? "on" : bad === k ? "no" : ""}" data-i="${k}" aria-pressed="${struck.has(k)}">${k}</button>`).join("")}</div>
        <div class="lpanel">${bad ? kit.feedback(`Nothing beats ${bad}: no other setup scores higher, and every other setup costs more per grading (${bad} ${usd(S[bad].cost)}, the next ${usd(Math.min(...LETTERS.filter(k => k !== bad).map(k => S[k].cost)))}). An unbeaten setup is always worth keeping on the list.`, false)
          : ok ? kit.feedback(`Right. ${UNBEATEN.join(", ")} beats the other four: the same or a higher score, a lower cost and a shorter p95 wait. The setups nobody beats are called the <b>Pareto front</b>; your bars then pick one point on it. Notice also that ${TIED.length} setups tie at ${N} of ${N}. Your test set is too easy to tell them apart. Before you trust the tie, add harder, real answers until the setups separate.`, true)
          : struck.size ? kit.feedback(`${BEATEN.length - [...struck].filter(k => BEATEN.includes(k)).length} more to find. For each one left, ask: is another setup at least as good on all three numbers?`) : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-pick button`).forEach(b => b.onclick = () => {
        const k = b.dataset.i;
        if (!BEATEN.includes(k)) { bad = k; paint(); return; }
        bad = null;
        if (struck.has(k)) struck.delete(k); else struck.add(k);
        paint(); if (fin()) done();
      });
    };
    paint();
  }

  /* 5. Step one needs no model: exact match with the key. */
  function codeStep({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [EXACT.length, RIGHT_IDX.length, N - EXACT.length].map(String);
    const RIGHT = 0;
    const fb = [
      [`Right: ${EXACT.map(num).join(", ")}. Plain code compares the answer with the key, ignoring capitals and extra spaces. It is free and instant. It can safely say “right”; it can never say “not right”, because a different answer may still be right (${[4, 8].map(num).join(", ")}). So the other ${N - EXACT.length} still go to the grader. If real traffic looks like the test set, ${Math.round((1 - SHARE_MODEL) * 100)}% of answers never reach a model.`, true],
      [`${RIGHT_IDX.length} answers are right, but only ${EXACT.length} of them match the key exactly. The other ${RIGHT_IDX.length - EXACT.length} use other words, and code cannot tell those from mistakes.`, false],
      [`${N - EXACT.length} is how many code cannot settle. They still need the grader. Count the answers that match the key exactly.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Step one needs no model</h1>
        <p class="lead">Here is the app as a pipeline. Some answers are exactly the key, like “went” for “went”. Checking those needs no judgement.</p>
        <div class="lx-${ID}-pipe">
          <div class="lx-${ID}-stage set"><b>1 · matches the key?</b>plain code</div>
          <div class="lx-${ID}-stage"><b>2 · grade</b>only if step 1 says no</div>
          <div class="lx-${ID}-stage"><b>3 · feedback</b>only if not right</div>
        </div>
        <p class="task">Of the ${N} test answers, how many can step 1 settle on its own?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Predict: does a perfect grader write good feedback? */
  function feedbackPredict({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const passC = S.C.fbScore, W = WRONG_IDX.length;
    const opts = [`Yes, all ${W}`, `No, some fail`];
    const RIGHT = passC === W ? 0 : 1;
    const i = WRONG_IDX[C_FAIL];
    const shown = `${quote(kit, RUNS.C.feedback[C_FAIL])}`;
    const fb = [
      [`C graded all ${N} right, but its feedback failed the checks on ${W - passC} of ${W}. Here is one, ${num(i)}, ${S.C.fb[C_FAIL].words} words:${shown}It wrote two drafts and the word “or”, and the app would show both to the learner.`, false],
      [`Right. C passed on ${passC} of ${W}. Here is its feedback for ${num(i)} (“${kit.esc(ITEMS[i].answer)}”), ${S.C.fb[C_FAIL].words} words:${shown}C answered like a chat: two drafts and the word “or”, and the app would show both. <b>Here, being good at one step said little about the next.</b> Grading is picking one of two words; feedback is writing for a learner. Measure each step on its own test.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Does a perfect grader write good feedback?</h1>
        <p class="lead">For step 3 the team gave each setup the ${W} answers that are not right and asked for one or two friendly sentences. A feedback text passes when it: shows the corrected form (for ${num(1)}: “${kit.esc(ITEMS[1].fix)}”); has at most ${MAX_WORDS} words; avoids “wrong” and “incorrect”; and the call ended normally, not cut off by an error. Code checks all four.</p>
        <p class="lead">C agreed with the teacher on all ${N} gradings.</p>
        <p class="task">Will C's feedback pass the checks on all ${W}?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Pick the feedback writer from its own test. */
  function feedbackPick({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const W = WRONG_IDX.length;
    const cand = ["A", WRITER, "D", "E"].filter((k, j, a) => a.indexOf(k) === j);
    const RIGHT = cand.indexOf(WRITER);
    const aItem = WRONG_IDX[A_FAIL];
    const why = k => {
      if (k === WRITER) return [`Right. ${WRITER} passes all ${W} checks, its slowest call took ${secs(S[WRITER].fbSlow)}, and it is the cheapest that clears both bars. So the grader is ${GRADER} and the feedback writer is ${WRITER}: <b>different models for different steps</b>, chosen by the same rule, each on its own test.`, true];
      if (k === "A") return [`A's feedback for ${num(aItem)} took ${secs(RUNS.A.feedbackMs[A_FAIL])} and stopped mid-sentence:${quote(kit, RUNS.A.feedback[A_FAIL])}The API marked it <code>finish_reason: "${kit.esc(RUNS.A.feedbackFinish[A_FAIL])}"</code>: a failed call, not weak writing. The cut-off text still contains “${kit.esc(ITEMS[aItem].fix)}”, so only the check on how the call ended caught it. Today A fails both bars. One failure in ${W} calls may be bad luck, so you would rerun A on more answers.`, false];
      if (k === "D") return [`D clears both bars too, and it is faster (${secs(S.D.fbSlow)} at worst). But it costs ${usd(S.D.fbCost)} per million against ${WRITER}'s ${usd(S[WRITER].fbCost)}. If the team wants feedback that also explains the rule, it should add that as a check; D might then win. With today's checks, it is not the cheapest.`, false];
      return [`E passes all ${W}, but its slowest call took ${secs(S.E.fbSlow)}, over the ${secs(FB_BUDGET_MS)} budget, and it costs ${usd(S.E.fbCost)} per million, about ${times(S.E.fbCost / S[WRITER].fbCost)} times ${WRITER}'s.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>Pick the feedback writer</h1>
        <p class="lead">Feedback appears right after the grade, so the team set two bars: pass the checks on all ${W}, and the slowest call under ${secs(FB_BUDGET_MS)}. (With ${W} calls, p95 is the slowest one.)</p>
        ${tbl(kit, ["setup", "checks passed", "slowest", "$ per million"], LETTERS.map(k => [k, `${S[k].fbScore} / ${W}`, secs(S[k].fbSlow), usd(S[k].fbCost)]),
          { title: "Feedback for the 10 answers that are not right", cls: (r, c) => { const k = LETTERS[r]; return (c === 1 && S[k].fbScore < FB_MIN) || (c === 2 && S[k].fbSlow > FB_BUDGET_MS) ? "out" : ""; } })}
        <p class="lx-${ID}-note">A value that misses a bar is marked as a mistake. Prices on ${RECORDED_AT}.</p>
        <p class="task">Which setup writes the feedback?</p>
        <div class="lpanel">${ask(kit, cand, RIGHT, ans, cand.map(why))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The whole pipeline: predict the saving. */
  function pipelineCost({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const cands = [...new Set([RATIO, Math.max(2, Math.round(RATIO / 10)), RATIO * 10])].sort((a, b) => a - b);
    const opts = cands.map(r => `About ${r} times fewer dollars`);
    const RIGHT = cands.indexOf(RATIO);
    const calc = `Mixed: ${N - EXACT.length} of ${N} answers × ${usd2(cents(S[GRADER].cost))} + ${WRONG_IDX.length} of ${N} × ${usd2(cents(S[WRITER].fbCost))} = <b>$${MIXED.toFixed(1)}</b> per million answers. ${LEADER} for everything: ${N} of ${N} × ${usd2(cents(S[LEADER].cost))} + ${WRONG_IDX.length} of ${N} × ${usd2(cents(S[LEADER].fbCost))} = <b>$${ALL_LEADER.toFixed(1)}</b>.`;
    const fb = cands.map(r => r === RATIO
      ? [`Right. ${calc} That is about ${RATIO} times fewer dollars, and the learner's p95 wait for a grade drops from ${secs(S[LEADER].p95)} to ${secs(S[GRADER].p95)}. Most of the saving comes from not paying for thinking the task does not need; step 1 adds a little more on top.`, true]
      : [`${calc} Divide the second by the first: about ${RATIO}, not ${r}. ${r < RATIO ? `The grading prices alone differ by about ${times(S[LEADER].cost / S[GRADER].cost)} times.` : "Feedback still costs something in the mixed pipeline, so the gap is smaller than that."}`, false]);
    const paint = () => {
      el.innerHTML = `<h1>The mixed pipeline</h1>
        <div class="lx-${ID}-pipe">
          <div class="lx-${ID}-stage set"><b>1 · matches the key?</b>plain code</div>
          <div class="lx-${ID}-stage set"><b>2 · grade</b>setup <i>${GRADER}</i></div>
          <div class="lx-${ID}-stage set"><b>3 · feedback</b>setup <i>${WRITER}</i></div>
        </div>
        <p class="lead">Compare it with the teammate's plan: ${LEADER} for grading and feedback, no step 1. Assume real traffic looks like the test set: ${N - EXACT.length} of ${N} answers reach the grader (the other ${EXACT.length} match the key), and ${WRONG_IDX.length} of ${N} need feedback.</p>
        <p class="lx-${ID}-note">$ per million calls, prices on ${RECORDED_AT}. Grading: ${GRADER} ${usd2(cents(S[GRADER].cost))}, ${LEADER} ${usd2(cents(S[LEADER].cost))}. Feedback: ${WRITER} ${usd2(cents(S[WRITER].fbCost))}, ${LEADER} ${usd2(cents(S[LEADER].fbCost))}.</p>
        <p class="task">Per million answers, how much cheaper is the mixed pipeline?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The chooser in Python: a stepped replay of choose.py. */
  // The listing is choose_model from docs/ai-path/runs/s6-choose-model/choose.py, line for line (line 0 = def).
  const CODE = [
    "def choose_model(results, min_score, max_p95_ms):",
    "    best = None",
    "    for name, r in results.items():",
    "        if r[\"score\"] < min_score:",
    "            continue",
    "        if r[\"p95_ms\"] > max_p95_ms:",
    "            continue",
    "        if best is None or r[\"cost\"] < results[best][\"cost\"]:",
    "            best = name",
    "    return best"
  ];
  // choose.out.txt (python choose.py 20 1500): [line about to run, event (l = line, r = return), name, best]
  const TRACE = [[1,"l",null,null],[2,"l",null,null],[3,"l","A",null],[5,"l","A",null],[7,"l","A",null],[8,"l","A",null],[2,"l","A","A"],[3,"l","B","A"],[5,"l","B","A"],[7,"l","B","A"],[2,"l","B","A"],[3,"l","C","A"],[5,"l","C","A"],[6,"l","C","A"],[2,"l","C","A"],[3,"l","D","A"],[4,"l","D","A"],[2,"l","D","A"],[3,"l","E","A"],[5,"l","E","A"],[6,"l","E","A"],[2,"l","E","A"],[9,"l","E","A"],[9,"r","E","A"]];
  const TRACE_ARGS = { min_score: 20, max_p95_ms: 1500 }; // choose.out.txt, first line
  const TRACE_RETURNED = "A";                              // choose.out.txt, last line
  // choose.py's inputs: score, p95 and cost per million gradings, rounded to $0.1 as in choose.out.txt
  const IN = k => ({ score: S[k].score, p95: S[k].p95, cost: Math.round(S[k].cost * 10) / 10 });
  const KEEP = new Set([3, 4, 6, 7, 8, 9]); // frames: about to run these lines
  const FR = TRACE.filter(t => KEEP.has(t[0]) && !(t[0] === 9 && t[1] === "l"));
  function sayFrame(kit, f) {
    const [ln, ev, name, best] = f, r = name ? IN(name) : null, b = best ? IN(best) : null;
    if (ev === "r") return `The loop is over. <code>return best</code> hands back <b>${kit.esc(best)}</b>: the cheapest setup that cleared both bars.`;
    if (ln === 3) return `Next candidate: <b>${name}</b> (score ${r.score}, p95 ${r.p95} ms, ${usd(r.cost)}). First bar: is its score below ${TRACE_ARGS.min_score}?`;
    if (ln === 4) return `${name} scored ${r.score}, below ${TRACE_ARGS.min_score}. <code>continue</code> skips it, however cheap or fast it is.`;
    if (ln === 6) return `${name}'s p95 is ${r.p95} ms, over ${TRACE_ARGS.max_p95_ms}. <code>continue</code> skips it.`;
    if (ln === 7) return best ? `${name} cleared both bars. Is it cheaper than the best so far, ${best} (${usd(r.cost)} against ${usd(b.cost)})? ${r.cost < b.cost ? "Yes." : "No, so best stays " + best + "."}` : `${name} cleared both bars, and <code>best</code> is still empty, so the condition is true.`;
    if (ln === 8) return `<code>best = name</code>: ${name} is the best so far.`;
    return "";
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The chooser in Python</h1>
        <p class="lead">The rule you used, written once so you can rerun it whenever a model or a price changes. <code>results</code> is a dict (like a JS object) that maps each setup's letter to its score, p95 and cost from the grading test. This replays a real run with <code>min_score=${TRACE_ARGS.min_score}</code> and <code>max_p95_ms=${TRACE_ARGS.max_p95_ms}</code>.</p>
        <p class="task">Step through to the end. The marked line runs next.</p>
        ${kit.code(CODE, f[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>name <b>${f[2] || "–"}</b></span><span>best <b>${f[3] || "None"}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}
        ${i === FR.length - 1 ? `<p class="lead">The function returned ${TRACE_RETURNED}, the same as your pick. The same rule, applied to the feedback numbers with their own bars, gives ${WRITER}. The hard part was never the code: it was the test set and the two bars.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 10. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Paying for the leaderboard", "Rerunning the test set when a model, a price or your prompt changes", "Writing the chooser function"];
    const RIGHT = 1;
    const fb = [
      ["Public leaderboards cost nothing to read. Their price is hidden: they score other tasks, so trusting them can buy you a slower, more expensive model for no gain on yours.", false],
      ["Right. Vendors replace and reprice models, and your prompts change. Each time, the choice is only as fresh as the last run. Keep the test set and the script, and rerun them; a choice you made once and never rechecked drifts.", true],
      [`The chooser is ${CODE.length} lines, written once. The work that keeps coming back is the measuring.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to shop for models</h1>
        <p class="lead">“Shopping” is what you just did: build a test set per step, set the bars, and take the cheapest model that clears them, maybe a different one per step.</p>
        <p class="lead"><b>When:</b> a feature calls a model often, so money and waiting add up. Start once you have a test set per step and bars set before comparing.</p>
        <p class="lead"><b>When not:</b> volume is tiny, because a few calls a day saves only cents; take a strong model that passes. Not before you have a test set: build one first, or the choice is a guess. And a feature that is a single call has no steps to give different models.</p>
        <p class="lead"><b>Costs:</b> writing and labelling the test sets, one prompt per model to maintain, more vendors whose outages become yours, and reruns.</p>
        <p class="task">Which of these costs keeps coming back?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 11. Recognise it: compare per step, or take one strong model? */
  const CASES = [
    ["A second-hand marketplace gets thousands of new listings a day. A model puts each listing into one of six categories, and for one category it also drafts a short description that the seller edits.", true,
      "Yes. Two different steps at high volume: sorting is a short label, drafting is writing. Measure each on its own test; the cheapest model that sorts well may draft badly, and the other way round.",
      "At thousands a day the cost and wait add up, and the two steps are different jobs. A sorter and a drafter should each be chosen on their own test, and they may well be different models."],
    ["Three lawyers ask a model to summarise a contract a few times a week. A missed clause can be expensive.", false,
      "Right. A few calls a week cost almost nothing on any model, while a missed clause costs a lot. Take a strong model that passes a small test of real contracts, and spend the effort on checking summaries, not on saving cents.",
      "Shopping for a cheaper model here saves cents a month, and the test-set work costs more than that. The risk sits in quality: take a strong model that passes, and keep checking its summaries."],
    ["A game studio writes two million short lines for background characters each night, in a batch job. Code checks each line's length and banned words. A model also writes a short nightly report for the producers.", true,
      "Yes. Two steps with very different volume. The batch step runs millions of times and nobody waits, so a slower, cheaper model that passes the checks is fine there. The nightly report runs once and can use whatever passes.",
      "Volume makes the batch step expensive, and because it runs overnight the wait bar barely matters: a cheap, slow model can win. The report runs once a night. Different steps, different picks."],
    ["A two-person team is building a prototype for a demo next week. There are no users and no real answers yet.", false,
      "Right. There is no traffic to pay for and no real data for a test set. Use one strong model to learn what the feature should do, save the inputs, and build the test set from them before launch.",
      "Without users, nothing to measure and nothing to save. Comparing models on made-up inputs would be guesswork. Use one strong model now, collect real inputs, and choose properly before launch."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Shop or not?</h1>
        <p class="lead">Four teams. “Shop” means: build a test set per step, set the bars, and take the cheapest model that clears them, possibly a different one per step.</p>
        <p class="task">For each team: shop per step, or just take one strong model?</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Shop per step", "One strong model"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can choose by measuring</h1>
      <p class="lead">You scored a model by hand, set the bars before comparing, struck the setups that another beats, and took the cheapest one that cleared the bars for each step: plain code for exact matches, ${GRADER} for grading, ${WRITER} for feedback. The leaderboard pick, ${LEADER}, scored no higher on your test and cost far more.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You made each call cheaper; next you avoid paying for the same answer twice.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Choosing a hosted model, and mixing models",
    checked: "2026-11-18",
    sources: [
      "https://platform.claude.com/docs/en/about-claude/models/choosing-a-model",
      "https://developers.openai.com/api/docs/guides/model-selection",
      "https://openrouter.ai/docs/guides/best-practices/reasoning-tokens",
      "https://openrouter.ai/docs/guides/administration/usage-accounting",
      "https://openrouter.ai/docs/api/reference/overview"
    ],
    interview: [
      {
        q: "Your team wants to move the whole product to the model at the top of a public leaderboard. How do you decide?",
        good: [
          "Use a test set built from real traffic, with expected answers, for each step of the feature",
          "Set the bars before comparing: the quality score needed and a p95 latency budget",
          "Run every candidate on the same set and record score, p95 latency and cost per call",
          "Take the cheapest setup that clears the bars; a step may get a different model than the others",
          "Read the outputs and count failures such as cut-off answers, then rerun when models or prices change"
        ],
        weak: "Switch because the leaderboard says it is best, or try a few prompts by eye. That ignores the product's own task, cost and latency."
      },
      {
        q: "A feature grades answers and then writes feedback, both on the most expensive model, and the bill is too high. What do you try?",
        good: [
          "Split it into steps and see which ones need a model at all, such as an exact match done by code",
          "Measure each step on its own test: a model that grades well may write poor feedback",
          "Choose the cheapest model that clears each step's bars, and compute the blended cost from the traffic mix",
          "Check what thinking or long outputs cost: reasoning tokens are billed as output tokens",
          "Keep the test sets and rerun them before and after the change"
        ],
        weak: "Move everything to the cheapest model, or cut max_tokens, without measuring whether quality still passes."
      }
    ],
    screens: [gradeYourself, scoreByHand, spotIdea, plotIt, codeStep, feedbackPredict, feedbackPick, pipelineCost, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ['[data-i="1"]'], right: ['[data-i="5"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="A"]'], right: ['[data-i="B"]', '[data-i="C"]', '[data-i="D"]', '[data-i="E"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
