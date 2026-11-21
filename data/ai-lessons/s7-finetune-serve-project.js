/* Lesson s7-finetune-serve-project: finish the fine-tuned model served behind an API.
   Story: a coworking-space chain (Tashkent and Seoul) routes member messages written in Uzbek, Russian and Korean to
   Billing, Facilities or Events. A message sent to the wrong team waits. The chain fine-tuned a small open model as
   the router (the stage 5 recipe) and now serves it behind the stage 6 FastAPI endpoint.
   Ideas: (1) "did the fine-tune earn its keep" is answered on the same held-out messages, against the cheapest
   alternative (prompting), by counting only the messages where exactly one system is right (a paired comparison;
   the exact sign test is McNemar's test in its exact form); (2) serving: load once at start-up, a typed response
   that only lets a real team out, the same chat template as in training, and a check that the endpoint gives the
   same answers as the offline evaluation.
   Data, all produced for real on 2026-11-14 on this site's Mac (Apple M1):
     recordings (main checkout) docs/ai-path/recordings/s7-finetune-serve-project/:
       gen-<team>-<a|b|c>, heldout-<team>  (12 calls to a small hosted model that wrote the messages)
       prompt-01..40, rule-01..40          (the prompted hosted router, two prompt versions, temperature 0)
     runs docs/ai-path/runs/s7-finetune-serve-project/:
       build_data.py -> build_data.out.txt, data/{train,valid,heldout}.jsonl
       evaluate.py -> eval-base.out.txt (untuned, instruction only), eval-tuned.out.txt
       evaluate_fewshot.py -> eval-fewshot.out.txt (untuned, team descriptions + six examples: "prompted")
       train.sh -> train.out.txt / train.log.txt (mlx-lm LoRA on a 4-bit SmolLM2-135M-Instruct, i.e. QLoRA)
       collect.py -> grid.json, collect.out.txt; compare.py -> compare.out.txt (the traced compare function)
       app.py + serve_check.py -> serve_check.out.txt, serve_check-no-adapter.out.txt;
       app_def.py (first version, plain def route) -> serve_check-def.out.txt (the RuntimeError)
   Lesson-local style: the scoring grid and a small transcript block (.lx-s7-finetune-serve-project-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s7-finetune-serve-project", P = "lx-" + ID + "-";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs and recordings ---------- */
  const TEAM = { B: "Billing", F: "Facilities", E: "Events" };
  // build_data.out.txt
  const TRAIN_N = 248, VALID_N = 21;
  // eval-base.out.txt: the untuned model with only the instruction
  const BASE_ZERO = { right: 0, clean: 0 };
  // train.log.txt: trainable share, and the losses at the last report
  const TRAINABLE = "1.816%", LOSS_TRAIN_LAST = 0.003, LOSS_VAL_LAST = 0.191, LOSS_VAL_BEST = 0.141;
  // grid.json + eval-fewshot.out.txt: [lang, message, gold, prompted (untuned + six examples), tuned, hosted prompt, hosted prompt + rules]
  // The hosted answers come from recordings prompt-NN / rule-NN (each answer was the one word shown).
  const ROWS = [
    ["ru", "Прошу выставить счёт-фактуру за бронирование переговорной комнаты.", "B", "B", "B", "B", "B"],
    ["ru", "Почему с меня дважды списали за билет на митап? Пожалуйста, проверьте это.", "B", "B", "B", "B", "B"],
    ["uz", "Assalomu alaykum, fevral oyiga to'lovim o'tmabdi. Kartamda yetarli mablag' borligiga aminman. Tekshirib bera olmaysizmi?", "B", "F", "B", "B", "B"],
    ["ko", "안녕하세요. 제 결제 내역을 어디서 확인할 수 있나요? 언제 얼마를 지불했는지 알고 싶습니다.", "B", "B", "B", "B", "B"],
    ["uz", "Men meetup uchun to'lagan edim, lekin kelolmadim. Pulni qaytarib olish imkoniyati bormi?", "B", "B", "B", "B", "B"],
    ["ko", "밋업 티켓 비용이 두 번 청구되었습니다. 확인 부탁드립니다.", "B", "B", "B", "B", "B"],
    ["ru", "Добрый день. Где я могу посмотреть историю своих платежей? Когда и сколько я оплачивал(а)?", "B", "B", "B", "B", "B"],
    ["uz", "Nega menga ikkinchi marta meetup uchun pul yechib olindi? Iltimos, buni tekshirib ko'ringlar.", "B", "B", "B", "B", "B"],
    ["uz", "Meeting xonasini band qilganim uchun hisob-fakturani yuborishingizni so'rayman.", "B", "F", "B", "B", "B"],
    ["ko", "회의실 예약에 대한 인보이스를 발행해 주십시오.", "B", "F", "B", "B", "B"],
    ["ko", "밋업 비용을 결제했는데 참석하지 못했습니다. 환불받을 수 있나요?", "B", "B", "B", "B", "B"],
    ["ru", "Здравствуйте. У меня не прошёл платёж за февраль. Уверен, что на карте достаточно средств. Можете проверить?", "B", "B", "B", "B", "B"],
    ["ru", "Привет. Как мне оплатить воркшоп? Я здесь впервые и не разбираюсь в системе.", "B", "B", "B", "B", "B"],
    ["ru", "Я оплатил(а) митап, но не смог(ла) прийти. Возможен ли возврат денег?", "B", "B", "B", "B", "B"],
    ["uz", "Konditsioner ishlamayapti, xona juda issiq bo'lib qoldi.", "F", "F", "F", "F", "F"],
    ["ko", "와이파이가 너무 느려서 업무를 할 수가 없어요. 도와주세요.", "F", "B", "F", "F", "F"],
    ["ko", "사무실에 프린터가 고장난 것 같아요. 출력할 게 많은데.", "F", "B", "F", "F", "F"],
    ["ko", "환기가 안 되는지 방이 너무 더워요. 에어컨 좀 틀어주세요.", "F", "B", "F", "F", "F"],
    ["ru", "Проектор в переговорке не работает. Нужно для презентации.", "F", "F", "F", "F", "F"],
    ["uz", "Bugungi tadbirda proyektor ishlamadi. Bu juda xafa qildi.", "F", "F", "F", "F", "F"],
    ["uz", "Bu kunlarda tozalik yaxshi emas. Shunga bir qarash kerak.", "F", "F", "B", "F", "F"],
    ["ko", "회의실 프로젝터가 작동하지 않습니다. 회의에 꼭 필요합니다.", "F", "B", "F", "F", "F"],
    ["ru", "В зале для мероприятий слишком душно, люди жалуются.", "F", "B", "F", "F", "F"],
    ["ru", "Wi-Fi снова отвалился, не могу работать. Помогите!", "F", "F", "F", "F", "F"],
    ["uz", "Bu kunlarda zinadan ovoz ko'p chiqayapti, uni pasaytirish mumkinmi?", "F", "F", "F", "F", "F"],
    ["ru", "Уборка сегодня была поверхностной, много пыли.", "F", "F", "F", "F", "F"],
    ["ko", "오늘 행사장에서 마이크가 나오지 않았어요. 정말 큰일입니다.", "F", "B", "F", "F", "F"],
    ["uz", "Uchrashuv qachon boshlanadi? Joyini aniqlay olasizmi?", "E", "E", "B", "E", "E"],
    ["ko", "워크숍 신청했는데, 취소하고 싶어요. 어떻게 하면 되나요?", "E", "B", "E", "E", "E"],
    ["uz", "Yangi mavzuda biror narsa qilishni o'ylayotgandim, masalan, brending haqida.", "E", "F", "E", "E", "E"],
    ["uz", "Maruzachi haqida ko'proq ma'lumot bera olasizmi? Tashakkur!", "E", "B", "E", "E", "E"],
    ["ru", "Где и во сколько начало нетворкинга сегодня вечером?", "E", "B", "E", "E", "E"],
    ["uz", "Workshop uchun qatnashish bepulmi?", "E", "F", "B", "E", "E"],
    ["ru", "Хотел бы выступить с докладом о будущем ИИ. Как записаться?", "E", "B", "E", "E", "E"],
    ["ru", "Можно ли отменить мою регистрацию на митап? Ошибочно записался.", "E", "B", "E", "E", "E"],
    ["ru", "Есть ли запись лекции от прошлого вторника? Хотелось бы пересмотреть.", "E", "B", "E", "E", "E"],
    ["ru", "Привет! Что интересного на этой неделе?", "E", "B", "E", "E", "E"],
    ["uz", "Tasodifan ro'yxatdan o'tib qo'yganman, bekor qila olasizmi?", "E", "F", "E", "E", "E"],
    ["ko", "발표 자료 좀 공유해 주실 수 있나요? 놓쳤어요.", "E", "B", "E", "E", "E"],
    ["ko", "다음 달에는 투자 관련 강연 있으면 좋겠어요.", "E", "B", "E", "E", "E"]
  ];
  // Our own translations (not model output) of the rows the tuned model got wrong, keyed by row index.
  const GLOSS = {
    20: "The cleaning is not good these days. Someone should look at it.",
    27: "When does the meetup start? Can you tell me where it is?",
    32: "Is taking part in the workshop free?"
  };
  // make_route_requests.py: the hosted model's system prompt (input we wrote, not output)
  const HOSTED_PROMPT = "You route member messages for a coworking-space chain to one team. Billing: membership fees, invoices, payments. Facilities: the building, rooms and equipment. Events: workshops, meetups, talks and other community events. Reply with one team name only: Billing, Facilities or Events.";
  const HOSTED_RULES = "Anything about money, including paying for or refunds for an event, goes to Billing. Any problem with a room or equipment, including during an event, goes to Facilities.";
  // From docs/ai-path/recordings/s7-finetune-serve-project/prompt-05.json (the whole answer)
  const REC_PROMPT5 = { src: "s7-finetune-serve-project/prompt-05", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14", row: 4, text: "Billing" };
  const CAPTION = `Recorded model output, ${REC_PROMPT5.recordedAt}`;

  // compare() from docs/ai-path/runs/s7-finetune-serve-project/compare.py, line for line (line 0 = def).
  const CODE = [
    "def compare(gold, prompted, tuned):",
    "    only_tuned = only_prompted = agree = 0",
    "    for g, p, t in zip(gold, prompted, tuned):",
    "        if t == g and p != g:",
    "            only_tuned += 1",
    "        elif p == g and t != g:",
    "            only_prompted += 1",
    "        else:",
    "            agree += 1",
    "    flips = only_tuned + only_prompted",
    "    k = min(only_tuned, only_prompted)",
    "    p_value = min(1.0, 2 * sum(comb(flips, i) for i in range(k + 1)) / 2 ** flips)",
    "    return only_tuned, only_prompted, agree, p_value"
  ];
  // compare.out.txt, trace of compare(gold, prompted, tuned): the first 17 steps (four messages) and the last 5.
  // [line about to run, 1 = return event, only_tuned, only_prompted, agree, g, p, t, flips, k, p_value]
  const TRACE_HEAD = [[1,0,null,null,null,null,null,null,null,null,null],[2,0,0,0,0,null,null,null,null,null,null],[3,0,0,0,0,"Billing","Billing","Billing",null,null,null],[5,0,0,0,0,"Billing","Billing","Billing",null,null,null],[8,0,0,0,0,"Billing","Billing","Billing",null,null,null],[2,0,0,0,1,"Billing","Billing","Billing",null,null,null],[3,0,0,0,1,"Billing","Billing","Billing",null,null,null],[5,0,0,0,1,"Billing","Billing","Billing",null,null,null],[8,0,0,0,1,"Billing","Billing","Billing",null,null,null],[2,0,0,0,2,"Billing","Billing","Billing",null,null,null],[3,0,0,0,2,"Billing","Facilities","Billing",null,null,null],[4,0,0,0,2,"Billing","Facilities","Billing",null,null,null],[2,0,1,0,2,"Billing","Facilities","Billing",null,null,null],[3,0,1,0,2,"Billing","Billing","Billing",null,null,null],[5,0,1,0,2,"Billing","Billing","Billing",null,null,null],[8,0,1,0,2,"Billing","Billing","Billing",null,null,null],[2,0,1,0,3,"Billing","Billing","Billing",null,null,null]];
  const TRACE_TAIL = [[2,0,20,2,18,"Events","Billing","Events",null,null,null],[9,0,20,2,18,"Events","Billing","Events",null,null,null],[10,0,20,2,18,"Events","Billing","Events",22,null,null],[11,0,20,2,18,"Events","Billing","Events",22,2,null],[12,0,20,2,18,"Events","Billing","Events",22,2,0.00012111663818359375],[12,1,20,2,18,"Events","Billing","Events",22,2,0.00012111663818359375]];

  // app.py, cut with "..." (the lines shown are unchanged)
  const APP = [
    "@asynccontextmanager",
    "async def lifespan(app):",
    "    state[\"model\"], state[\"tokenizer\"] = load(MODEL, adapter_path=ADAPTER)",
    "    yield",
    "...",
    "@app.post(\"/route\", response_model=RouteOut)",
    "async def route(body: RouteIn):",
    "    ...  # tok = the tokenizer; prompt = the chat template with SYSTEM and body.message",
    "    answer = generate(state[\"model\"], tok, prompt=prompt, max_tokens=8).strip()",
    "    if answer not in TEAMS:",
    "        raise HTTPException(status_code=502, detail=\"model gave no team\")",
    "    return RouteOut(team=answer, adapter=ADAPTER)"
  ];
  // serve_check.out.txt and serve_check-no-adapter.out.txt (copied, not altered)
  const SERVED = {
    ok: "POST /route {\"message\": \"Men meetup uchun to'lagan edim, lekin kelolmadim. Pulni qaytarib olish imkoniyati bormi?\"} -> 200 {'team': 'Billing', 'adapter': 'adapters'}",
    empty: "POST /route {\"message\": \"\"} -> 422 String should have at least 1 character",
    noAdapterHealth: "GET /health 200 {'ready': True, 'adapter': None}",
    noAdapter: "POST /route {\"message\": \"Men meetup uchun to'lagan edim, lekin kelolmadim. Pulni qaytarib olish imkoniyati bormi?\"} -> 502 {'detail': 'model gave no team'}",
    all: "held-out through HTTP: status codes {200: 40} | same team as offline eval 40 of 40",
    ms: "ms per request: median 106 slowest 273",
    noAdapterAll: "held-out through HTTP: status codes {502: 40} | same team as offline eval 0 of 40"
  };
  const MEDIAN_MS = 106; // serve_check.out.txt
  // serve_check-def.out.txt (the version with a plain def route): the last two lines of the traceback that point at app code
  const DEF_CRASH = [
    "  File \".../app.py\", line 39, in route",
    "    answer = generate(state[\"model\"], tok, prompt=prompt, max_tokens=8).strip()",
    "…",
    "RuntimeError: There is no Stream(cpu, 0) in current thread."
  ];

  /* ---------- Derived from the data ---------- */
  const N = ROWS.length;
  const COL = { prompted: 3, tuned: 4, hosted: 5, rules: 6 };
  const right = c => ROWS.filter(r => r[COL[c]] === r[2]).length;
  function pairs(a, b) {          // a = the other system, b = tuned
    let onlyB = 0, onlyA = 0, agree = 0;
    ROWS.forEach(r => { const g = r[2], x = r[COL[a]], y = r[COL[b]]; if (y === g && x !== g) onlyB++; else if (x === g && y !== g) onlyA++; else agree++; });
    return { onlyB, onlyA, agree };
  }
  const comb = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - k + i) / i; return c; };
  const signP = (a, b) => { const n = a + b, k = Math.min(a, b); let s = 0; for (let i = 0; i <= k; i++) s += comb(n, i); return Math.min(1, 2 * s / 2 ** n); };
  const fmtP = p => p >= 0.01 ? String(+p.toFixed(2)) : p.toPrecision(2).replace(/0+$/, "");
  const VS_P = pairs("prompted", "tuned"), VS_H = pairs("hosted", "tuned"), VS_R = pairs("rules", "tuned");
  const P_P = signP(VS_P.onlyB, VS_P.onlyA), P_H = signP(VS_H.onlyB, VS_H.onlyA);
  const WRONG = []; // every wrong cell in the grid: "p-<row>" or "t-<row>"
  ROWS.forEach((r, i) => { if (r[3] !== r[2]) WRONG.push("p-" + i); if (r[4] !== r[2]) WRONG.push("t-" + i); });
  const TUNED_MISS = ROWS.map((r, i) => i).filter(i => ROWS[i][4] !== ROWS[i][2]);
  const PROMPTED_E_TO_B = ROWS.filter(r => r[2] === "E" && r[3] === "B").length;
  const COUNT_E = ROWS.filter(r => r[2] === "E").length;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}grp { margin: 18px 0 4px; font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}row { padding: 10px 0; border-bottom: 1px solid var(--line); }
      .${P}msg { font-size: 15px; line-height: 1.45; overflow-wrap: anywhere; }
      .${P}lang { display: inline-block; min-width: 2.2em; font: 600 12px/1.4 var(--mono); color: var(--muted); }
      .${P}cells { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
      .${P}cell { min-height: 44px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: 500 14px/1.3 var(--font); text-align: left; cursor: pointer; }
      .${P}cell small { display: block; font: 500 11.5px/1.3 var(--mono); color: var(--muted); }
      .${P}cell.${P}x { border-color: var(--bad); background: var(--bad-soft); text-decoration: line-through; }
      .${P}cell:disabled { cursor: default; }
      .${P}gold { font: 500 13px/1.4 var(--mono); color: var(--ink-2); margin-top: 4px; }
      .${P}log { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .${P}line { padding: 8px 0; border-bottom: 1px solid var(--line); font: 500 13.5px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .${P}cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}quote { margin: 12px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); font-size: 15px; line-height: 1.5; background: var(--sunk); }
      .${P}check { position: relative; display: flex; gap: 10px; align-items: flex-start; min-height: 44px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; cursor: pointer; }
      .${P}check input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
      .${P}check span::before { content: ""; display: inline-block; width: 18px; height: 18px; margin: 0 10px -3px 0; border: 2px solid var(--ink-2); border-radius: 4px; }
      .${P}check input:checked + span::before { background: var(--good); border-color: var(--good); }
      .${P}check input:focus-visible + span::before { outline: 2px solid var(--ink); outline-offset: 2px; }
      .${P}bar { margin-top: 14px; }
      .${P}btn { min-height: 44px; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  const lines = (kit, arr) => `<div class="${P}log">${arr.map(l => `<div class="${P}line">${kit.esc(l)}</div>`).join("")}</div>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  function single({ el, done, kit }, render, opts, correct, fbs) {
    let ans = null;
    const paint = () => {
      el.innerHTML = render(`<div class="lpanel">${ask(kit, opts, correct, ans, fbs)}</div>`);
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 1. The situation: what makes the comparison fair. */
  function fairTest(ctx) {
    ensureStyle();
    const { kit } = ctx;
    single(ctx, panel => `<h1>Did the fine-tune earn its keep?</h1>
      <p class="lead">A chain of coworking spaces in Tashkent and Seoul gets member messages in Uzbek, Russian and Korean. Each one must reach one team: <b>Billing</b>, <b>Facilities</b> or <b>Events</b>. A message sent to the wrong team waits: a refund request that lands with the events team sits there until someone notices.</p>
      <p class="lead">The chain did what you did in stage 5: it fine-tuned a small open model (135 million parameters, stored in 4 bits) with a LoRA adapter, on ${TRAIN_N} messages, each tagged with its right team. Only ${TRAINABLE} of the weights were trained. In stage 6 you learned to put a model behind an HTTP endpoint. Now the project has to be finished: served, and proven with numbers.</p>
      <p class="lead">The messages in this lesson were written for it by a hosted model, asked for one team's messages at a time, and recorded. The team it was asked for is that message's label, the right answer. We read all 40 test messages ourselves, and every label is correct.</p>
      <p class="task">The question is whether the tuned model beats simply prompting a model. How do you test that fairly?</p>${panel}`,
      [`Run both on the ${TRAIN_N} training messages and count the right answers`,
       "Run both on the same 40 messages that were kept out of training, and score each answer against the team each message belongs to",
       "Give each model its own 40 new messages, so neither has an advantage",
       "Put the tuned model live for a week and count complaints"],
      1,
      [[`The tuned model learned from exactly those messages. Its training loss ended at ${LOSS_TRAIN_LAST}: it nearly memorised them. A score there measures memory, not how it handles a new member's message.`, false],
       [`Right. That set is the <b>held-out set</b>: messages neither model has seen, the same ones for both, each scored against the team the message belongs to (the <b>gold</b> team; at work, a label a person checked). Here it is 40 messages: ${ROWS.filter(r => r[2] === "B").length} Billing, ${ROWS.filter(r => r[2] === "F").length} Facilities, ${COUNT_E} Events.`, true],
       ["Two different sets differ in how hard they are. If the tuned model wins, you cannot tell whether it is better or got easier messages. Give both the same messages.", false],
       ["Members would suffer the mistakes first, most misrouted messages never become a complaint, and you would still have nothing to compare it with. Measure before it goes live.", false]]);
  }

  /* 2. By hand: score the grid. */
  function tally({ el, done, kit }) {
    ensureStyle();
    const marked = new Set();
    let msg = null, finished = false;
    const total = WRONG.length;
    const cell = (i, side, ans) => {
      const key = side + "-" + i, x = marked.has(key);
      return `<button type="button" class="${P}cell${x ? " " + P + "x" : ""}" data-i="${key}" ${finished ? "disabled" : ""} aria-pressed="${x}"><small>${side === "p" ? "prompted" : "tuned"}</small>${kit.esc(TEAM[ans])}</button>`;
    };
    const block = t => {
      const idx = ROWS.map((r, i) => i).filter(i => ROWS[i][2] === t);
      return `<div class="${P}grp">Gold team ${TEAM[t]}: ${idx.length} messages</div>${idx.map(i => {
        const r = ROWS[i];
        return `<div class="${P}row"><div class="${P}msg"><span class="${P}lang">${r[0]}</span>${kit.esc(r[1])}</div><div class="${P}gold">gold: ${TEAM[r[2]]}</div><div class="${P}cells">${cell(i, "p", r[3])}${cell(i, "t", r[4])}</div></div>`;
      }).join("")}`;
    };
    const summary = () => {
      const pr = right("prompted"), tu = right("tuned");
      const miss = TUNED_MISS.map(i => `<li><span class="${P}lang">${ROWS[i][0]}</span>“${kit.esc(GLOSS[i])}” gold ${TEAM[ROWS[i][2]]}, tuned said ${TEAM[ROWS[i][4]]}</li>`).join("");
      return `Your tally: prompted <b>${pr} of ${N}</b> right, tuned <b>${tu} of ${N}</b>. Look at where the prompted model went wrong: it sent ${PROMPTED_E_TO_B} of the ${COUNT_E} Events messages to Billing. The tuned model's ${TUNED_MISS.length} misses (our translations):<ul>${miss}</ul>All ${TUNED_MISS.length} are Uzbek, and all went to Billing. The last one asks about a price, so a person could argue for Billing too: check your gold labels when a model "fails".`;
    };
    const paint = () => {
      el.innerHTML = `<h1>Score the 40 held-out messages</h1>
        <p class="lead"><b>prompted</b> is the same small model before tuning, with the team descriptions and six worked examples in the prompt. (With only the instruction and no examples it answered ${BASE_ZERO.clean} of ${N} with a team name at all: it gave fragments, such as the start of the member's message, broken words or an unrelated English sentence.) <b>tuned</b> is the model with the LoRA adapter, given only the instruction. Both always picked the most likely next word (greedy decoding), so a rerun gives the same answers.</p>
        <p class="task">Tap every answer that does not match the gold team (the right team, shown under each message), in both columns. Then press the button below.</p>
        ${["B", "F", "E"].map(block).join("")}
        <div class="lpanel ${P}bar">${finished ? "" : `<button type="button" class="btn ${P}btn" data-check>I have marked every wrong answer</button>`}
        <p class="${P}cap">Marked so far: prompted ${[...marked].filter(k => k[0] === "p").length}, tuned ${[...marked].filter(k => k[0] === "t").length}.</p>
        ${msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll(`.${P}cell`).forEach(b => b.onclick = () => {
        const key = b.dataset.i, [side, i] = [key[0], +key.slice(2)], r = ROWS[i];
        const ans = r[side === "p" ? 3 : 4];
        if (ans === r[2]) {
          msg = [`That answer is right: the ${side === "p" ? "prompted" : "tuned"} model said ${TEAM[ans]} and the gold team is ${TEAM[r[2]]}. Mark only answers that differ from the gold team.`, false];
        } else {
          marked.add(key); msg = null;
          if (marked.size === total) { finished = true; msg = [summary(), true]; paint(); done(); return; }
        }
        paint();
      });
      const c = el.querySelector("[data-check]");
      if (c) c.onclick = () => {
        const left = WRONG.filter(k => !marked.has(k));
        const where = ["B", "F", "E"].map(t => [t, left.filter(k => ROWS[+k.slice(2)][2] === t).length]).filter(([, n]) => n);
        msg = [`Not yet: ${where.map(([t, n]) => `${plural(n, "wrong answer")} still unmarked among the ${TEAM[t]} messages`).join(", ")}. Compare each answer with the gold line above it.`, false];
        paint();
      };
    };
    paint();
  }

  /* 3. Spot the idea: only the disagreements carry information. */
  function spotIdea(ctx) {
    const { kit } = ctx;
    const pr = right("prompted"), tu = right("tuned");
    single(ctx, panel => `<h1>Could ${tu} against ${pr} be luck?</h1>
      <p class="lead">A colleague reads your tally and says: “Forty messages is a small test. ${tu} against ${pr} could be luck.”</p>
      <p class="task">What settles whether the tuned model is really better on messages like these?</p>${panel}`,
      ["Train again with more data and test again",
       `The training loss: it fell to ${LOSS_TRAIN_LAST}, so the model learned`,
       "Look only at the messages where exactly one of the two is right, and ask whether that split could be a coin toss",
       "Split the 40 by language and compare each language"],
      2,
      [["That changes the model, so it answers a different question. The colleague asked about this model on this test.", false],
       [`Training loss measures the messages it trained on. The validation loss in the same run went from ${LOSS_VAL_BEST} back up to ${LOSS_VAL_LAST} while training loss kept falling: it was starting to memorise. Neither number compares it with the prompted model.`, false],
       [`Right. On ${VS_P.agree} messages the two agree (both right or both wrong): those say nothing about which is better. On the other ${VS_P.onlyB + VS_P.onlyA}, the tuned model was the right one ${VS_P.onlyB} times and the prompted one ${VS_P.onlyA} times. If the two were equally good, each of those messages would be a coin toss. A split of ${VS_P.onlyB} to ${VS_P.onlyA}, or one even more uneven, happens with probability about <b>${fmtP(P_P)}</b>. Not luck. Comparing two systems on the <b>same</b> items this way is a <b>paired comparison</b>; the coin-toss count is the exact form of <b>McNemar's test</b>.`, true],
       ["That cuts 40 messages into three groups of about 13, so each comparison is noisier, not surer. Per-language scores help to find weak spots, not to settle this.", false]]);
  }

  /* 4. Use it with predictions: against the prompted hosted model. */
  function vsHosted({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null;
    const h = right("hosted"), hr = right("rules"), tu = right("tuned");
    const Q = [
      { q: `On how many of the ${N} messages is <b>only the tuned model</b> right?`, opts: ["0", String(VS_H.onlyA), String(tu)], right: 0,
        fb: [null, `${VS_H.onlyA} is the number of messages where only the hosted model is right. The tuned model needs a message the hosted model got wrong, and there is none.`, `${tu} is how many the tuned model got right in total. Most of those the hosted model also got right, so they are ties.`] },
      { q: "On how many is <b>only the hosted model</b> right?", opts: ["0", String(VS_H.onlyA), String(h)], right: 1,
        fb: ["The hosted model got the tuned model's misses right, so some messages go to the hosted side.", null, `${h} is its total. Messages where both are right are ties, not wins.`] },
      { q: `Is a split of ${VS_H.onlyA} to ${VS_H.onlyB} strong evidence that the hosted model is better?`, opts: ["Yes, it never lost once", `No: ${VS_H.onlyA} coin tosses all landing the same way is common`, "It cannot be judged with a zero in it"], right: 1,
        fb: [`Never losing on ${VS_H.onlyA} tosses is not much. With equal systems, ${VS_H.onlyA} tosses land all on one side, either side, with probability ${fmtP(P_H)}.`, null, `A zero is fine: the test only needs the two counts. ${VS_H.onlyA} to ${VS_H.onlyB} gives about ${fmtP(P_H)}.`] }
    ];
    const paint = () => {
      const q = Q[stage];
      const fin = stage >= Q.length;
      el.innerHTML = `<h1>Now against the cheap option</h1>
        <p class="lead">Beating the same small model untuned is the easy test. The real alternative is to skip training and prompt a general hosted model. A small hosted model got each of the ${N} messages with this system prompt, no examples, no training:</p>
        <div class="${P}quote">${kit.esc(HOSTED_PROMPT)}</div>
        <p class="lead">For message ${REC_PROMPT5.row + 1}, the Uzbek refund request (in our translation: “I paid for the meetup but could not come; can I get the money back?”), it answered:</p>
        ${lines(kit, [REC_PROMPT5.text])}<p class="${P}cap">${CAPTION}</p>
        <p class="lead">It answered all ${N} with the gold team: <b>${h} of ${N}</b>. The tuned model had ${tu}.</p>
        ${fin ? "" : `<p class="task">${q.q}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. Only the hosted model: ${VS_H.onlyA}. Only the tuned model: ${VS_H.onlyB}. That split happens about ${fmtP(P_H)} of the time between equal systems, so 40 messages cannot prove the hosted model is better. But the question was whether the tuned model beats the cheap option, and it did not win on a single message. We also recorded the hosted model with two routing rules added (“${kit.esc(HOSTED_RULES)}”). It scored ${hr} of ${N} again, so the rules were not needed here.`, true)
          : `${kit.options(q.opts, { picked: wrong, correct: q.right })}${wrong != null ? kit.feedback(q.fb[wrong], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== Q[stage].right) { wrong = i; paint(); return; }
        wrong = null; stage++; paint();
        if (stage >= Q.length) done();
      });
    };
    paint();
  }

  /* 5. From scratch: the paired comparison in plain Python, stepped from a real trace. */
  const FRAMES = [...TRACE_HEAD.map(r => ({ r })), ...TRACE_TAIL.map((r, i) => ({ r, jump: i === 0 }))];
  const MSGS_IN_HEAD = TRACE_HEAD.filter((r, i) => r[0] === 2 && i > 1).length;
  function sayFrame(kit, f) {
    const [ln, ret, ot, op, ag, g, p, t, flips, k, pv] = f.r;
    if (ret) return `The function returns (${ot}, ${op}, ${ag}, ${fmtP(pv)}): wins for the tuned model, wins for the prompted one, ties, and the chance of a split this lopsided between equal systems.`;
    if (f.jump) return `… ${N - MSGS_IN_HEAD} more messages run the same way. The loop is done: ${ot} wins for the tuned model, ${op} for the prompted one, ${ag} ties.`;
    if (ln === 1) return "Three counters start at zero.";
    if (ln === 2) return g == null ? "The loop takes one message at a time: its gold team, the prompted answer and the tuned answer." : `Back to the top for the next message. Counters now: tuned ${ot}, prompted ${op}, ties ${ag}.`;
    if (ln === 3) return `Gold ${g}, prompted ${p}, tuned ${t}. Is the tuned model right and the prompted one wrong?`;
    if (ln === 4) return `Yes: only the tuned model is right here, so this message counts as a win for it.`;
    if (ln === 5) return `No. Is the prompted model right and the tuned one wrong?`;
    if (ln === 8) return `No again: both are right (or both wrong). A tie tells you nothing about which is better, so it goes to <code>agree</code>.`;
    if (ln === 9) return `Only the ${ot + op} messages with exactly one winner matter: <code>flips</code>.`;
    if (ln === 10) return `<code>flips</code> = ${flips}. <code>k</code> is the smaller side: how far the split is from even.`;
    if (ln === 11) return `<code>k</code> = ${k}. The chance that ${flips} fair coin tosses give ${k} or fewer on one side, either side: add up the ways to get 0..${k}, double it, divide by all 2<sup>${flips}</sup> outcomes.`;
    if (ln === 12) return `<code>p_value</code> = ${fmtP(pv)}.`;
    return "";
  }
  function scratch({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FRAMES[i], [ln, , ot, op, ag, g, p, t, flips, k, pv] = f.r;
      const v = (n, x) => `<span>${n} <b>${x == null ? "–" : kit.esc(typeof x === "number" && n === "p_value" ? fmtP(x) : x)}</b></span>`;
      el.innerHTML = `<h1>The comparison, written in Python</h1>
        <p class="lead">No library needed: the whole paired comparison is a loop and three counters. This replays a real run on the 40 messages, prompted against tuned (<code>comb</code> is Python's <code>math.comb</code>, the number of ways to choose).</p>
        <p class="task">Step through to the end. Watch which counter moves on each message.</p>
        ${kit.code(CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${v("g", g)}${v("p", p)}${v("t", t)}${v("only_tuned", ot)}${v("only_prompted", op)}${v("agree", ag)}${flips != null ? v("flips", flips) : ""}${k != null ? v("k", k) : ""}${pv != null ? v("p_value", pv) : ""}<span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}
        ${i === FRAMES.length - 1 ? `<p class="lead">Run with the hosted answers instead, it returns (${VS_H.onlyB}, ${VS_H.onlyA}, ${VS_H.agree}, ${fmtP(P_H)}). The same function, the same 40 messages, a different verdict.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
    };
    paint();
  }

  /* 6. Library: the FastAPI endpoint. Predict three responses. */
  const CASES6 = [
    { q: "The deployed service gets the Uzbek refund request.", right: 0, rec: SERVED.ok,
      fb: [null, "422 means the request itself broke the rules in <code>RouteIn</code>. This message is one to a thousand characters long, so it passes.", "502 is raised only when the model's answer is not one of the three teams. The tuned model answers with a team name.", "Nothing here crashes. The model was loaded once at start-up and answers in about a tenth of a second."] },
    { q: "A client sends <code>{\"message\": \"\"}</code>.", right: 1, rec: SERVED.empty,
      fb: ["The model never sees it. <code>RouteIn</code> says <code>min_length=1</code>, and FastAPI checks the body before your function runs.", null, "502 would mean the model answered badly, but the model is never called. The body fails the check first.", "No crash: a body that breaks the request model is a normal client error that FastAPI answers itself."] },
    { q: "A second deploy forgot the adapter folder: the environment variable <code>ADAPTER_PATH</code>, which sets <code>ADAPTER</code>, is empty, so the untuned model is served. The same refund request comes in.", right: 2, rec: SERVED.noAdapter,
      fb: ["The untuned model with only the instruction does not answer with a team name (0 of 40 on the held-out set). The <code>if</code> catches that.", "The request is fine; it is the model that is wrong.", null, "The function does not crash: it checks the answer and raises an <code>HTTPException</code>, which FastAPI turns into a clean 502."] }
  ];
  function serve({ el, done, kit }) {
    ensureStyle();
    const ans = CASES6.map(() => null);
    const opts = ["200 with a team", "422", "502", "500"];
    const allRight = () => CASES6.every((c, i) => ans[i] === c.right);
    const paint = () => {
      el.innerHTML = `<h1>Serve it behind the endpoint</h1>
        <p class="lead">This is the stage 6 FastAPI service with the tuned model inside. Three choices matter. <code>lifespan</code> loads the model and adapter <b>once</b>, before the first request, not on every call. <code>RouteIn</code> accepts a <code>message</code> of 1 to 1000 characters. <code>RouteOut</code> declares <code>team</code> as one of the three names, and the <code>if</code> refuses any other answer. The prompt goes through the same chat template as the training rows.</p>
        ${kit.code(APP, -1)}
        <p class="task">What does the service answer in each case? Pick again if you change your mind.</p>
        ${CASES6.map((c, i) => `<div class="lcase" id="c${i}"><p>${c.q}</p>${kit.options(opts, { picked: ans[i], correct: c.right })}${ans[i] == null ? "" : ans[i] === c.right ? kit.feedback(`Right. The recorded run:${lines(kit, i === 2 ? [SERVED.noAdapterHealth, c.rec] : [c.rec])}${i === 2 ? "The health check already showed <code>'adapter': None</code>. Make it part of every deploy." : ""}`, true) : kit.feedback(c.fb[ans[i]], false)}</div>`).join("")}
        ${allRight() ? kit.feedback(`Then the check that the service is the model you evaluated: all ${N} held-out messages sent through HTTP.${lines(kit, [SERVED.all, SERVED.ms])}Same answers as the offline evaluation, so the serving code builds the prompt the same way. (On this Mac, an Apple M1, on ${REC_PROMPT5.recordedAt}.) With the adapter missing, the same check gives:${lines(kit, [SERVED.noAdapterAll])}`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (allRight()) done();
      }));
    };
    paint();
  }

  /* 7. Why the route is async def: a real crash from the first version. */
  function asyncWhy(ctx) {
    ensureStyle();
    const { kit } = ctx;
    single(ctx, panel => `<h1>The first version crashed</h1>
      <p class="lead">The first version of the service declared the route with a plain <code>def route(...)</code>. The health check passed, the adapter was loaded, and the first routing request failed inside the model call:</p>
      ${lines(kit, DEF_CRASH)}
      <p class="lead">Changing that one line to <code>async def route(...)</code> fixed it; that is the version you just saw.</p>
      <p class="task">What did the change from <code>def</code> to <code>async def</code> change?</p>${panel}`,
      ["It made the model call faster, so it no longer timed out",
       "Where the function runs: FastAPI runs a plain def route in a worker thread from a pool, and an async def route on the server's own event loop, where the lifespan loaded the model",
       "async def retries the model call when it fails",
       "Nothing: the crash came from the missing adapter"],
      1,
      [["The error is not a timeout, and <code>async</code> does not make code faster. The served version still takes about the same time per request.", false],
       [`Right. That is from FastAPI's docs: a plain <code>def</code> path function “is run in an external threadpool”. In our run the model library failed in that worker thread and worked on the event loop. The price: <code>generate</code> blocks, so while it runs the server handles nothing else, and requests wait in line. At a median of ${MEDIAN_MS} ms each, that is roughly ${Math.floor(1000 / MEDIAN_MS)} routed messages a second on this Mac. Fine for a members' chat; for heavy traffic you would run several worker processes or a serving runtime built for batching.`, true],
       ["Nothing retries anything. <code>async def</code> only changes how FastAPI calls the function.", false],
       ["The health check showed <code>'adapter': 'adapters'</code>. A missing adapter gives a 502 with “model gave no team”, as you saw, not a RuntimeError.", false]]);
  }

  /* 8. The verdict for the portfolio. */
  function verdict(ctx) {
    const { kit } = ctx;
    const tbl = kit.table([
      ["untuned, instruction only", `${BASE_ZERO.right} of ${N}`],
      ["untuned, prompted (six examples)", `${right("prompted")} of ${N}`],
      ["tuned (LoRA adapter)", `${right("tuned")} of ${N}`],
      ["hosted model, prompted", `${right("hosted")} of ${N}`],
      ["hosted model, prompted + rules", `${right("rules")} of ${N}`]
    ], { head: ["router", "right on the held-out set"], title: "The 40 held-out messages" });
    single(ctx, panel => `<h1>Write the verdict</h1>
      <p class="lead">Everything you measured, on the same 40 messages:</p>${tbl}
      <p class="lead">Against its own prompted base the tuned model won ${VS_P.onlyB} to ${VS_P.onlyA} (p about ${fmtP(P_P)}). Against the prompted hosted model it lost ${VS_H.onlyA} to ${VS_H.onlyB} (p ${fmtP(P_H)}).</p>
      <p class="task">Which sentence goes in the project's README?</p>${panel}`,
      [`“The fine-tune works: ${right("tuned")} of ${N}, so fine-tuning was the right choice.”`,
       "“The fine-tune clearly beats the same model prompted, but not a prompted hosted model. It is worth running only where a hosted API is ruled out, for example when messages may not leave the chain's servers.”",
       "“The hosted model is proven better than the fine-tune.”",
       "“Forty messages prove nothing either way; we need a thousand.”"],
      1,
      [[`A score on its own says nothing about the choice. A prompted hosted model scored ${right("hosted")} with no training at all, so the fine-tune did not beat the cheap option.`, false],
       [`Right. That sentence says what was compared, what won, and when the loser still makes sense. One more honest line belongs next to it: the test messages were written by a hosted model, which may make them easier for a hosted router than real members' messages are. The real test is a fresh sample of real messages, labelled by staff.`, true],
       [`${VS_H.onlyA} to ${VS_H.onlyB} happens about ${fmtP(P_H)} of the time between equal systems. You may say the fine-tune showed no win; you may not say the hosted model is proven better.`, false],
       [`The ${VS_P.onlyB} to ${VS_P.onlyA} split against the prompted base is already decisive (p about ${fmtP(P_P)}). What a small test cannot do is separate two systems that are close, like ${right("tuned")} and ${right("hosted")}.`, false]]);
  }

  /* 9. The big picture. */
  function bigPicture(ctx) {
    single(ctx, panel => `<h1>When to serve your own fine-tune</h1>
      <p class="lead"><b>For:</b> a narrow task that stays the same, like sorting messages into fixed teams, with hundreds of labelled examples. <b>Reach for it</b> when data may not leave your servers, when volume makes per-call fees add up, when it must run offline, or when a prompt cannot express your convention. <b>Not</b> when a prompted model already passes your held-out set (as here), when the labels change often, or when volume is small. <b>Costs:</b> labelled data to keep up to date, a retrain and a fresh held-out run whenever a team is added, and a server you run and watch. This one is served with MLX, which runs on Apple silicon Macs and on Linux (with an Nvidia GPU, or CPU only); <code>mlx_lm.fuse</code> merges the adapter into the model when another runtime must load it.</p>
      <p class="task">Which situation makes serving the chain's own fine-tuned router the right call?</p>${panel}`,
      ["The chain adds a Parking team next month and may split Events in two after that",
       "Members paste card numbers and passport photos into the chat, the chain's lawyers forbid sending messages to outside APIs, and tens of thousands arrive each day",
       "About 30 messages a day, nothing sensitive, and nobody to look after a server"],
      1,
      [["Every change of teams means new labelled data, a retrain and a new held-out test. With a prompt, adding Parking is one sentence. Changing labels are a reason not to fine-tune.", false],
       ["Right. The hosted option is ruled out, so the comparison that matters is the tuned model against other models you can run yourself, where it won clearly. High volume also spreads the cost of the server over many messages.", true],
       ["At that volume a prompted hosted model costs little, needs no training data and no server, and it already scored 40 of 40 here. Running your own model would be work with nothing to show for it.", false]]);
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A hospital wants nurses' shift notes sorted into 12 fixed categories. It has 30,000 notes labelled over five years, the notes may not leave its servers, and the categories have not changed in years.", true,
      "Yes. Lots of labels, a fixed task, data that must stay inside: everything that makes a self-served fine-tune pay off. Still measure it against a prompted model you can run on the same servers.",
      "Every reason to fine-tune is here: thousands of labelled examples, categories that do not change, and a rule that the notes stay on the hospital's servers, which rules out a hosted API."],
    ["A two-person startup gets about 40 support emails a week and renames its email categories every few weeks as the product changes.", false,
      "No. Each renaming would mean relabelling and retraining. A prompted model takes the new names in one edit, and at 40 emails a week its cost is tiny.",
      "The labels keep changing and the volume is tiny. A fine-tune would go stale with every renaming and need a retrain; a prompt changes in a minute and costs almost nothing at this volume."],
    ["A team fine-tuned a model, reports 99% accuracy on its training examples, and has never tried a prompt. They want to serve it next week.", false,
      "No, not yet. 99% on training examples measures memory. First score it on held-out examples against a prompted model; only a win there justifies running it.",
      "Nothing has been shown yet: the score is on the examples it trained on, and there is no prompted baseline. Serving it now would be a cost with no evidence behind it."],
    ["A phone app must sort a user's notes into folders on the phone itself, with no internet connection.", true,
      "Yes. A hosted model cannot be called offline, so the model has to run inside the app, with no endpoint at all. A small model needs tuning to get good at one task. A plain text classifier is the other candidate: compare the two on held-out notes.",
      "With no connection, there is no hosted model to call. A small model must run on the phone, and a model that small needs tuning to get good at this one task (a plain text classifier is the other candidate)."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Fine-tune and serve, or not?</h1>
        <p class="lead">Four teams from other jobs, each thinking about training and serving their own small model.</p>
        <p class="task">Is training and running your own fine-tuned model the right call? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: notebook and checklist. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s7-finetune-serve-project.ipynb";
  // From our run of the notebook (notebooks/s7-finetune-serve-project.ipynb, executed outputs): PyTorch + PEFT on a CPU,
  // adapters on the top 16 of 30 layers, 100 steps at learning rate 5e-4.
  const NB = { lossTrain: "0.245", lossVal: "0.298", tunedRight: 25, onlyT: 10, onlyP: 4, agree: 26, p: "0.18" };
  const CHECKS = [
    `The untuned model with only the instruction answers ${BASE_ZERO.clean} of ${N} held-out messages with a team name.`,
    `The prompted model (team descriptions and six examples) gets ${right("prompted")} of ${N} right, the same as in the lesson.`,
    `At the last report the training loss is below the validation loss (${NB.lossTrain} against ${NB.lossVal} in our run of the notebook).`,
    `The tuned model routes ${NB.tunedRight} of ${N} held-out messages to the gold team in our run, and every answer is one of the three team names.`,
    `compare(gold, prompted, tuned) returns ${NB.onlyT}, ${NB.onlyP}, ${NB.agree} and a p-value of about ${NB.p} in our run: ahead, but not proven. Against the hosted model the tuned model has 0 wins.`,
    `Through the test client, /route gives the same team as the offline evaluation for ${N} of ${N} messages, and an empty message gets 422.`,
    `Without the adapter, the health check shows 'adapter': None and every message gets 502.`
  ];
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>The project is finished</h1>
      <p class="lead">You scored two routers on the same held-out messages, counted only the messages where they disagree, found that the fine-tune beat the same small model prompted, but not a prompted hosted model, served it behind FastAPI with a typed answer and a health check, and checked the service gives the answers you evaluated.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="${P}nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a> and run it.` : "The notebook for this lesson is on its way."} MLX does not run on Colab, so the notebook trains the adapter with PyTorch and PEFT on a free CPU. Its training run is much shorter: 100 steps on the top 16 layers, not 300 steps on all 30. With less training, its tuned model gets ${NB.tunedRight} of ${N} right, not the ${right("tuned")} you saw in this lesson. Same messages, smaller training run, so a lower score is expected. Against the prompted model it is still ahead, but not by enough to prove it better. Against the hosted model it still wins no messages. When you run it, you should see:</p>
      <div>${CHECKS.map(c => `<label class="${P}check"><input type="checkbox"><span>${kit.esc(c)}</span></label>`).join("")}</div>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The verdict you wrote here, with the rejected option and why, is exactly what goes into it.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Finish the fine-tuned model served behind an API",
    checked: "2026-11-14",
    sources: [
      "https://fastapi.tiangolo.com/advanced/events/",
      "https://fastapi.tiangolo.com/async/",
      "https://fastapi.tiangolo.com/advanced/testing-events/",
      "https://fastapi.tiangolo.com/tutorial/response-model/",
      "https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md",
      "https://ml-explore.github.io/mlx/build/html/index.html",
      "https://ml-explore.github.io/mlx/build/html/install.html",
      "https://www.statsmodels.org/stable/generated/statsmodels.stats.contingency_tables.mcnemar.html"
    ],
    interview: [
      {
        q: "You fine-tuned a small model to route support tickets and it gets 92% on your held-out set. Your manager asks whether the fine-tune was worth it. How do you answer?",
        good: [
          "92% alone does not answer it: compare against the cheapest alternative, a prompted model, on the same held-out set",
          "Count only the tickets where exactly one system is right, and check whether that split could be chance (a paired test such as McNemar's)",
          "Look at which classes each system gets wrong, and check the gold labels on the misses",
          "Weigh the costs: labelled data upkeep, retraining when classes change, running a server, against per-call fees and whether data may leave",
          "Check the test set is not too easy for one side, for example written by the same kind of model"
        ],
        weak: "Say 92% is high, so yes. That never asks whether a prompt would have done as well for far less work."
      },
      {
        q: "You deploy your fine-tuned router behind FastAPI, and every request returns 502 “model gave no team”, although it worked in your notebook. Where do you look?",
        good: [
          "The health endpoint: which model and adapter did the service actually load",
          "Whether the adapter files made it into the image or volume, and the path the service reads",
          "Whether the prompt is built with the same chat template as the training rows",
          "Run the held-out set through the endpoint and compare with the offline answers",
          "Log the raw model output the check refused, so you can see what it said"
        ],
        weak: "Raise max_tokens or add retries. That hides the symptom instead of finding that the wrong model is being served."
      }
    ],
    screens: [fairTest, tally, spotIdea, vsHosted, scratch, serve, asyncWhy, verdict, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="p-0"]'], right: WRONG.map(k => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { right: Array(FRAMES.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: CASES6.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
