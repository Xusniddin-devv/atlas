/* Lesson s5c-qlora-run: fine-tune a small model with QLoRA.
   Story: a parcel delivery company routes customer messages written in Uzbek, Russian and Korean to one of four
   teams (Delivery, Payments, Claims, Account). It trains a small open model as the router; this router is the
   fine-tuning portfolio project, served in stage 6 and finished in stage 7.
   Ideas: (1) QLoRA: keep the model frozen and stored in 4 bits, train a small LoRA adapter on finished examples
   (message in, team name out), and judge it only on a held-out set it never saw. (2) The serving code must build
   the prompt with the same chat template the training rows went through, or the tuned model quietly gets worse.
   Data, all produced for real on this site's Mac (Apple M1) on 2026-11-13:
     training messages: 8 recorded calls to a larger hosted model,
       docs/ai-path/recordings/s5c-qlora-run/gen-<team>-<a|b>.json (main checkout)
     docs/ai-path/runs/s5c-qlora-run/build_data.py -> build_data.out.txt, data/{train,valid,heldout}.jsonl
     docs/ai-path/runs/s5c-qlora-run/evaluate.py   -> eval-base.out.txt, eval-tuned.out.txt
     docs/ai-path/runs/s5c-qlora-run/train.sh      -> train.out.txt (train.log.txt: the same, colour codes removed)
     docs/ai-path/runs/s5c-qlora-run/route_compare.py -> route_compare.out.txt (broken vs fixed serving code)
   The model is SmolLM2-135M-Instruct in a 4-bit MLX conversion; training used mlx-lm, which trains LoRA on a
   quantized model as QLoRA. The Hugging Face PEFT + TRL code on screen 7 is written from the official docs and
   was not run by us. Every model answer below is copied from the run outputs, never altered.
   Lesson-local CSS: classes prefixed lx-s5c-qlora-run- (message cards, clickable code lines, a loss chart). */
(() => {
  const ID = "s5c-qlora-run", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5c-qlora-run.ipynb";
  const RUN_DATE = "2026-11-13";
  const TEAMS = ["Delivery", "Payments", "Claims", "Account"];
  const LANG = { uz: "Uzbek", ru: "Russian", ko: "Korean" };
  // evaluate.py / route_compare.py: SYSTEM (the same text in every training row)
  const SYSTEM = "You route customer messages for a parcel delivery company. Reply with one team name only: Delivery, Payments, Claims or Account.";

  // The 48 held-out messages, in data/heldout.jsonl order: [lang, team (label), message,
  //   base answer (eval-base.out.txt), tuned answer (eval-tuned.out.txt), tuned answer through the broken
  //   serving code (route_compare.out.txt, route "broken")]. Copied by a script, not altered.
  const ROWS = [
    ["ru", "Account", "Не проходит авторизация, помогите разобраться.", "Могут помочитать", "Account", "Delivery"],
    ["ru", "Claims", "Моя посылка промокла под дождем. Можно ли что-то сделать?", "Моя посылка при", "Delivery", "Delivery"],
    ["ko", "Payments", "이번 달 요금이 좀 많이 나왔네요. 무슨 일이죠?", "안녕믉안", "Delivery", "Delivery"],
    ["ko", "Payments", "감사합니다, 돈이 환불되었어요. 잘 처리되었습니다.", "안녕믉에", "Delivery", "Claims"],
    ["ko", "Account", "여기 등록된 적이 있는지 확인 부탁드립니다.", "안녕반 안", "Account", "Payments"],
    ["ko", "Delivery", "정말 최악이네요! 제 소포는 어디에 있습니까?!", "제 소포는", "Delivery", "Delivery"],
    ["uz", "Payments", "Chekni yuboring, iltimos. Tashakkur.", "I'm glad you found the information helpful. I'll keep", "Account", "AccountChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelType"],
    ["ru", "Claims", "Добрый день. При вскрытии обнаружил, что товар сломан.", "Могут будут ме", "Claims", "Claims"],
    ["ko", "Delivery", "소포 언제 와요?", "소포 언제", "Delivery", "Delivery"],
    ["ko", "Claims", "소포가 열려 있었고 내용물이 분실되었습니다.", "소포가 열", "Claims", "Claims"],
    ["ru", "Account", "Нужно сменить номер телефона в настройках.", "Могуте смените н", "Delivery", "Payments"],
    ["ru", "Claims", "Что-то внутри разбилось, когда я открыл коробку, всё в крошках.", "Что-то внутри", "Claims", "Claims"],
    ["ru", "Claims", "Заказ номер 12345. Товары внутри разбиты.", "Мой размер миля", "Claims", "Claims"],
    ["ru", "Payments", "Извините, если оплата не прошла, сколько я должен?", "Могу не причять", "Payments", "Payments"],
    ["uz", "Account", "Tasdiqlash kodi kelmayapti, tekshirib bering.", "I'm glad you're enjoying the new product, Taz", "Delivery", "Delivery"],
    ["uz", "Account", "Elektron pochta manzilimni yangilash kerak.", "I'm sorry for the confusion, but the user is asking", "Delivery", "DeliveryChannelTypeChannelTypeDeliveryChannelTypeDeliveryChannelTypeDeliveryChannelTypeDeliveryChannelTypeDelivery"],
    ["ru", "Delivery", "Возможна ли другая дата доставки?", "Могут мессячи", "Delivery", "Delivery"],
    ["uz", "Payments", "Bu oyda to'lovlar ko'payib ketdi, nima bo'ldi?", "Od to'loi to'loi to'", "Payments", "PaymentsChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelType"],
    ["ru", "Delivery", "Подскажите, где моя посылка? Третий день жду.", "Моя живу нев", "Delivery", "Delivery"],
    ["ru", "Account", "Не могу войти в свой профиль.", "Могу не могу войт", "Payments", "Account"],
    ["ru", "Delivery", "Где посылка?", "Где посылка?", "Delivery", "Delivery"],
    ["ru", "Account", "Пришло сообщение с кодом, но я ничего не запрашивал.", "Пришло сообщен", "Account", "Account"],
    ["ru", "Claims", "Не хватает частей из посылки. Прошу разобраться.", "Мой частое прил", "Payments", "Payments"],
    ["ru", "Claims", "Мой заказ пришел мокрый, содержимое испорчено.", "Мой заказ пришел м", "Payments", "Payments"],
    ["ru", "Payments", "Мне должны были вернуть деньги, но их нет.", "Мне должны были в", "Payments", "Payments"],
    ["ru", "Payments", "Как изменить данные моей карты?", "Какие исследи", "Delivery", "Delivery"],
    ["ko", "Payments", "영수증 좀 보내주세요. 감사합니다.", "안녕믉야", "Account", "Account"],
    ["ko", "Claims", "제 주문이 젖어서 왔어요. 내용물이 망가졌습니다.", "제 주문을 �", "Claims", "Claims"],
    ["uz", "Account", "Parolimni unutdim, nima qilishim kerak?", "I'm sorry for the confusion. I'm a customer service", "Claims", "Claims"],
    ["ru", "Claims", "Мне привезли сломанную вещь. Это неприемлемо!", "Мне привезли сл", "Delivery", "Delivery"],
    ["ko", "Payments", "세금계산서가 필요합니다. 언제 보내주실 수 있나요?", "애제가 안", "Payments", "Payments"],
    ["ru", "Account", "Почему не приходит код подтверждения? Уже третий раз пытаюсь.", "Приходит код подтв", "Account", "Account"],
    ["ko", "Claims", "택배가 젖어서 안의 내용물이 망가졌어요.", "안의 내용�", "Claims", "Claims"],
    ["uz", "Payments", "Menga hisob-faktura kerak, qachon yuborasiz?", "Menga hisob-faktura kerak", "Account", "Account"],
    ["ko", "Delivery", "추적해보니 저희 도시에 있다는데, 언제 가져다주나요?", "안녕 제안", "Delivery", "Delivery"],
    ["uz", "Delivery", "Bugun qachon keladi shu pochta?", "I'm sorry for the confusion. I'm currently working with", "Delivery", "Delivery Delivery"],
    ["ko", "Claims", "제 물건이 왜 손상된 거죠? 누가 책임지나요?", "제 물건이 �", "Claims", "Claims"],
    ["ko", "Delivery", "배송 시간 변경 가능합니까?", "애니드립�", "Delivery", "Delivery"],
    ["uz", "Account", "Akkauntni qanday o'chirib tashlash mumkin?", "Akkauntni qanday o'chirib", "Account", "AccountChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelTypeChannelType"],
    ["ko", "Claims", "비에 젖은 택배를 받았습니다. 도와주세요.", "안녕반 안", "Claims", "Payments"],
    ["ru", "Delivery", "Отслеживание посылки показывает, что она в городе. Когда привезут?", "Могут привесут", "Delivery", "Delivery"],
    ["uz", "Account", "Mening shaxsiy ma'lumotlarimni yangilash kerak, iltimos.", "Mening shaxsiy ma'lumotlarim", "Claims", "Claims"],
    ["ru", "Payments", "Стоимость доставки кажется завышенной. Какая реальная цена?", "Стоимостя дост", "Payments", "Payments"],
    ["uz", "Delivery", "Oybek ko'chasi, 15-uyga olib kelishingizni so'rayman.", "Oybek ko'chasi, 15-", "Delivery", "Delivery"],
    ["uz", "Delivery", "Paketimning holati qanday? O'ta muhim.", "O'Kaynney.", "Claims", "Claims"],
    ["uz", "Delivery", "Hali ham kutmoqdamiz.", "Hali ham kutmoqdamiz.", "Delivery", "DeliveryChannelTypeChannelTypeDeliveryChannelTypeDeliveryChannelTypeDeliveryChannelTypeDeliveryChannelTypeDelivery"],
    ["ru", "Payments", "Спасибо, деньги вернули. Отличная работа.", "Спасибо, От", "Payments", "Payments"],
    ["ru", "Account", "Здравствуйте, не могу войти в свой аккаунт. Помогите, пожалуйста.", "Могу могу помогите", "Payments", "Payments"]
  ].map(([lang, team, text, base, tuned, broken]) => ({ lang, team, text, base, tuned, broken }));

  // The eight messages of screens 2 and 4 (indexes into ROWS), with our own English translation of each.
  const PICK = [
    [0, "Authorization keeps failing, please help me sort it out."],
    [3, "Thank you, the money was refunded. It was handled well."],
    [12, "Order number 12345. The items inside are broken."],
    [8, "When is my parcel coming?"],
    [6, "Please send the receipt. Thank you."],
    [20, "Where is the parcel?"],
    [28, "I forgot my password, what should I do?"],
    [39, "I got a parcel soaked by rain. Please help."]
  ];

  // build_data.out.txt
  const TRAIN_N = 163, VALID_N = 20, ROWS_AFTER_DEDUPE = 231;
  const TRAIN_LANG = { uz: 59, ru: 51, ko: 53 };
  // train.log.txt (mlx_lm.lora): the header box and the loss lines, copied as printed
  const TRAINABLE = { pct: "1.816%", n: "2.442M", total: "134.515M" };
  const RANK = 8, ITERS = 200, BATCH = 4, LR = "1e-4";
  const VAL = [[1, 7.521], [20, 0.334], [40, 0.359], [60, 0.293], [80, 0.302], [100, 0.304], [120, 0.213], [140, 0.215], [160, 0.285], [180, 0.245], [200, 0.174]];
  const TRAIN = [[10, 1.862], [20, 0.617], [30, 0.378], [40, 0.293], [50, 0.336], [60, 0.330], [70, 0.295], [80, 0.274], [90, 0.215], [100, 0.179], [110, 0.156], [120, 0.160], [130, 0.054], [140, 0.075], [150, 0.051], [160, 0.078], [170, 0.063], [180, 0.043], [190, 0.060], [200, 0.019]];
  // from train.sh, trimmed (reordered, some flags left out)
  const TRAIN_CMD = [
    "mlx_lm.lora --train \\",
    "  --model \\",
    "  Irfanuruchi/SmolLM2-135M-Instruct-MLX-4bit \\",
    "  --data data --fine-tune-type lora \\",
    "  --mask-prompt --num-layers -1 \\",
    "  --batch-size 4 --iters 200 \\",
    "  --learning-rate 1e-4 \\",
    "  --steps-per-eval 20 --seed 0 ..."
  ];
  // route_compare.out.txt: the chat template printed for the first held-out message, not altered
  const TPL = "<|im_start|>system\n" + SYSTEM + "<|im_end|>\n<|im_start|>user\n" + ROWS[0].text + "<|im_end|>\n<|im_start|>assistant\n";

  // Derived numbers: all computed here.
  const N = ROWS.length;
  const isClean = a => TEAMS.includes(a);
  const count = (f) => ROWS.filter(f).length;
  const S = {
    baseRight: count(r => r.base === r.team), baseClean: count(r => isClean(r.base)),
    tunedRight: count(r => r.tuned === r.team), tunedClean: count(r => isClean(r.tuned)),
    brokenRight: count(r => r.broken === r.team), brokenClean: count(r => isClean(r.broken)),
    brokenChanged: count(r => r.broken !== r.tuned)
  };
  const byKey = (key, what) => Object.fromEntries([...new Set(ROWS.map(r => r[key]))].map(k => {
    const rs = ROWS.filter(r => r[key] === k);
    return [k, { n: rs.length, right: rs.filter(r => r[what] === r.team).length }];
  }));
  const BY_LANG = byKey("lang", "tuned"), BY_TEAM = byKey("team", "tuned");
  const SAID = Object.fromEntries(TEAMS.map(t => [t, count(r => r.tuned === t)]));
  const FAVE = TEAMS.slice().sort((a, b) => SAID[b] - SAID[a])[0];
  const WORST_LANG = Object.keys(BY_LANG).sort((a, b) => BY_LANG[a].right / BY_LANG[a].n - BY_LANG[b].right / BY_LANG[b].n)[0];
  const WORST_TEAM = TEAMS.slice().sort((a, b) => BY_TEAM[a].right / BY_TEAM[a].n - BY_TEAM[b].right / BY_TEAM[b].n)[0];
  const MOST_TRAIN_LANG = Object.keys(TRAIN_LANG).sort((a, b) => TRAIN_LANG[b] - TRAIN_LANG[a])[0];
  const LAST_TRAIN = TRAIN[TRAIN.length - 1][1];
  const LATE_VAL = VAL.filter(([s]) => s >= 20).map(([, v]) => v);
  const VAL_LO = Math.min(...LATE_VAL), VAL_HI = Math.max(...LATE_VAL);
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  const of = (a, b) => `${a} of ${b}`;

  // Which of three outcomes an answer is: 0 right team, 1 a wrong team, 2 not a team name.
  const outcome = (ans, team) => ans === team ? 0 : isClean(ans) ? 1 : 2;
  const OUTCOMES = ["The right team", "A wrong team", "Not a team name"];
  // What a base reply did, described from the reply itself.
  const baseKind = (r) => r.text.startsWith(r.base.slice(0, Math.min(5, r.base.length))) ? "copied the start of the message back"
    : /^[\x20-\x7e]+$/.test(r.base) ? "wrote English small talk that ignores the message"
    : "wrote broken words in the message's own script";

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}msg { margin: 14px 0 0; padding: 12px 14px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); }
      .${P}msg .m { font: 500 16px/1.5 var(--font); color: var(--ink); margin: 0; overflow-wrap: anywhere; }
      .${P}msg .g { font: 400 14px/1.5 var(--font); color: var(--muted); margin: 2px 0 0; }
      .${P}msg .h { font: 600 12.5px var(--mono); color: var(--muted); margin: 0 0 6px; }
      .${P}ans { margin: 10px 0 0; padding: 8px 12px; background: var(--sunk); border-radius: 6px; font: 500 14px/1.5 var(--mono); font-variant-ligatures: none; color: var(--ink); overflow-wrap: anywhere; white-space: pre-wrap; }
      .${P}cap { font: 500 12.5px var(--mono); color: var(--muted); margin: 6px 0 0; }
      .${P}str { margin: 12px 0 0; padding: 12px 14px; background: var(--sunk); border-radius: 8px; white-space: pre-wrap; overflow-wrap: anywhere; font: 500 13.5px/1.6 var(--mono); font-variant-ligatures: none; color: var(--ink); }
      .${P}lines { display: flex; flex-direction: column; gap: 4px; margin-top: 12px; }
      .${P}lines button, .${P}lines .fixed { text-align: left; min-height: 44px; padding: 8px 12px; border: 1.5px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; font: 500 13.5px/1.5 var(--mono); font-variant-ligatures: none; cursor: pointer; }
      .${P}lines .fixed { border-color: transparent; color: var(--muted); cursor: default; min-height: 0; padding: 4px 12px; }
      .${P}lines button.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}lines button.right { border-color: var(--good); background: var(--good-soft); }
      .${P}tbl { width: 100%; border-collapse: collapse; margin: 12px 0 0; font: 500 14px/1.4 var(--font); color: var(--ink); }
      .${P}tbl th, .${P}tbl td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}tbl th { font: 600 12.5px var(--mono); color: var(--muted); }
      .${P}tbl td.n { font-family: var(--mono); white-space: nowrap; }
      .${P}chart { margin: 12px 0 0; }
      .${P}chart svg { width: 100%; height: auto; display: block; }
      .${P}chart .ax { stroke: var(--line); stroke-width: 1; }
      .${P}chart .tr { fill: none; stroke: var(--ink); stroke-width: 2.5; }
      .${P}chart .va { fill: none; stroke: var(--ink-2); stroke-width: 2.5; stroke-dasharray: 7 5; }
      .${P}chart .dot { fill: var(--ink-2); }
      .${P}chart text { font: 500 12px var(--mono); fill: var(--muted); }
      .${P}link { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); }
      .${P}inl { color: var(--ink); padding: 13px 0; }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; overflow-wrap: anywhere; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
      .${P}cmd .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; }
      @media (max-width: 480px) { .${P}cmd .lcode { font-size: 11px; } }
      @media (max-width: 480px) { .${P}str, .${P}lines button, .${P}lines .fixed { font-size: 12.5px; } .${P}tbl { font-size: 13px; } }
    `;
    document.head.appendChild(s);
  }

  const CAP_LOCAL = `<p class="${P}cap">Recorded model output, ${RUN_DATE}. A small open model, run on this site's Mac.</p>`;
  const msgCard = (kit, r, gloss, head) => `<div class="${P}msg">${head ? `<p class="h">${kit.esc(head)}</p>` : ""}<p class="m">${kit.esc(r.text)}</p>${gloss ? `<p class="g">${kit.esc(gloss)} (${LANG[r.lang]}; our translation)</p>` : ""}</div>`;
  const ans = (kit, label, text) => `<div class="${P}ans">${kit.esc(label)} ${kit.esc(text)}</div>`;
  const glossOf = r => (PICK.find(([i]) => ROWS[i] === r) || [])[1];
  const lock = html => html.replace(/<button /g, "<button disabled ");

  /* 1. The situation: what reply can the routing code use? */
  function situation({ el, done, kit }) {
    css();
    let pick = null;
    const opts = ["Claims", "The team is Claims.", "claims", "Claims. We are sorry about your parcel."];
    const correct = 0;
    const fb = [
      "",
      "The code looks up the whole reply as a key. There is no queue called “The team is Claims.”, so Python raises a KeyError and the message is not routed.",
      "Keys are case-sensitive, as in a JavaScript object: when the key is <code>Claims</code>, <code>queues[\"claims\"]</code> raises a KeyError.",
      "The label is there, but so is a sentence after it. The look-up gets the whole string and fails. You could cut it out, but then you are guessing where the label ends."
    ];
    const paint = () => {
      el.innerHTML = `<h1>A router for parcel messages</h1>
        <p class="lead">A parcel delivery company gets customer messages in Uzbek, Russian and Korean. Each one must reach one of four teams: <b>Delivery</b>, <b>Payments</b>, <b>Claims</b> (damaged parcels) or <b>Account</b>. The company wants a small open model to do this on its own server, cheaply. In this lesson you train one on examples and check whether it works.</p>
        <p class="lead">We built the examples the way the last lesson did. A larger hosted model wrote messages for each team, and duplicates were removed (${ROWS_AFTER_DEDUPE} left). ${N} were kept aside for testing. Of the rest, ${TRAIN_N} rows train the model and ${VALID_N} check it during training.</p>
        <p class="lead">The routing code is one line: <code>queues[answer].append(message)</code>. <code>queues</code> is a Python dict with one key per team (a dict works like a JS object here).</p>
        <p class="task">The model's reply goes straight into <code>answer</code>. Which reply can the code use as it is? (These are examples we wrote, not model output.)</p>
        <div class="lpanel">${kit.options(opts.map(o => `<code>${kit.esc(o)}</code>`), { picked: pick, correct })}
        ${pick == null ? "" : pick === correct
          ? kit.feedback(`Right. Only an exact team name works. Call that a <b>clean label</b>: the reply is one of the four names and nothing else. The router needs two things from the model: a clean label, and the right one. This lesson measures both, on messages the model never saw in training.`, true)
          : kit.feedback(fb[pick], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 2 and 4. Predict, per message, what one model replied; the recorded answer is shown after each pick. */
  function predictScreen(which) {
    return function ({ el, done, kit }) {
      css();
      const picks = PICK.map(() => null);
      const paint = () => {
        const all = picks.every(p => p != null);
        const hits = PICK.filter(([i], k) => picks[k] === outcome(ROWS[i][which], ROWS[i].team)).length;
        const base = which === "base";
        el.innerHTML = `<h1>${base ? "Before training: predict the base model" : "After training: predict the tuned model"}</h1>
          <p class="lead">${base
            ? `Eight of the held-out messages: messages kept aside, which training never sees. The model is the untrained one, SmolLM2-135M-Instruct. It is a small open model already tuned to chat, with each weight stored in 4 bits to save memory. It gets the system message <i>“${kit.esc(SYSTEM)}”</i> and the customer's message, through its chat template. Each reply is cut after 12 tokens, enough for a team name.`
            : `The same eight messages, the same system message, the same chat template. The model is now the tuned one: the same frozen 4-bit model plus the small adapter trained on the ${TRAIN_N} training rows.`}</p>
          <p class="task">For each message, predict what the ${base ? "base" : "tuned"} model replied. Your first pick counts.</p>
          ${PICK.map(([i, gloss], k) => {
            const r = ROWS[i], real = outcome(r[which], r.team), p = picks[k];
            const say = p == null ? "" : p === real
              ? (real === 0 ? `Right: it replied with the right team.` : real === 1 ? `Right: a clean label, but the wrong team. The message is for ${r.team}.` : `Right: it ${baseKind(r)}.`)
              : real === 2 ? `It did not give a team name at all: it ${baseKind(r)}. The instruction said one team name only.`
              : real === 1 ? `It gave a clean label, but the wrong one: ${r[which]} instead of ${r.team}.`
              : `It got this one: ${r.team}.`;
            return `<div class="lcase" id="c${k}">${msgCard(kit, r, gloss, `Message ${k + 1} · for ${r.team}`)}
              ${p == null ? kit.options(OUTCOMES, { correct: real }) : lock(kit.options(OUTCOMES, { picked: p, correct: real }))}
              ${p == null ? "" : ans(kit, `${base ? "Base" : "Tuned"} model:`, r[which]) + kit.feedback(say, p === real)}</div>`;
          }).join("")}
          ${all ? CAP_LOCAL + kit.feedback(base
            ? `You predicted ${of(hits, PICK.length)}. Over all ${N} held-out messages, the base model gave a clean label <b>${S.baseClean} times</b> and the right team <b>${S.baseRight} times</b>. The instruction was plain, and this small model did not follow it once. The router cannot use it at all.`
            : `You predicted ${of(hits, PICK.length)}. Every reply is now a clean label. On these eight it got ${PICK.filter(([i]) => ROWS[i].tuned === ROWS[i].team).length} right. The next screen scores all ${N}.`) : ""}`;
        el.querySelectorAll(".lcase").forEach((c, k) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
          if (picks[k] != null) return;
          picks[k] = +b.dataset.i; paint();
          if (picks.every(p => p != null)) done();
        }));
      };
      paint();
    };
  }

  /* 3. Spot the idea: what training gives that the instruction did not. */
  function spotIdea({ el, done, kit }) {
    css();
    let pick = null;
    const opts = [
      "It teaches the model Uzbek, Russian and Korean, so it can finally read the messages",
      "It shows the model many finished examples (this message in, this team name out) and nudges its weights until it produces them",
      "It undoes the 4-bit storage, which had broken the model's instruction following",
      "It gives the model more room to answer, so the team name fits"
    ];
    const correct = 1;
    const fb = [
      `${TRAIN_N} short messages cannot teach a language. Training gives the model a narrow habit on top of what it already reads. Screen 5 shows the limit of that.`,
      "",
      "Nothing is undone. The tuned model is the very same 4-bit file, frozen, plus a small adapter. If 4-bit storage were the problem, the tuned model would fail too.",
      "The base replies were already longer than a team name. They were the wrong kind of text, not too short."
    ];
    const paint = () => {
      el.innerHTML = `<h1>What can training add?</h1>
        <p class="lead">The base model got ${of(S.baseRight, N)} right and never once gave a clean label. The team then trained it on its ${TRAIN_N} cleaned rows, each one a short chat: the same system message, a customer message, and the right team name as the assistant's reply.</p>
        <p class="task">What does that training give the model that the instruction in the prompt did not?</p>
        <div class="lpanel">${kit.options(opts, { picked: pick, correct })}
        ${pick == null ? "" : pick === correct
          ? kit.feedback(`Right. An instruction asks; examples show. After seeing the exact input and the exact output again and again, the model learns the format (one name, then stop) and the mapping (which messages go where). That is <b>supervised fine-tuning</b>.`, true)
            + kit.feedback(`The way it was trained here is <b>QLoRA</b>. The model's own weights stay <b>frozen</b> and are kept in 4 bits, which shrinks the memory they take. Only a small <b>LoRA adapter</b> learns: the two thin matrices from the LoRA lesson, added next to the frozen ones. The training log says how small: <b>${TRAINABLE.n} trainable numbers out of ${TRAINABLE.total} (${TRAINABLE.pct})</b>. In the QLoRA paper, the training signal passes back through the frozen 4-bit model into the adapter. With that method, the authors fine-tuned a 65-billion-parameter model on a single GPU.`)
          : kit.feedback(fb[pick], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 5. The whole held-out set: is it ready? */
  function heldOut({ el, done, kit }) {
    css();
    let pick = null;
    const lb = BY_LANG[WORST_LANG], tb = BY_TEAM[WORST_TEAM];
    const opts = [
      `Yes: it gives a clean label on ${of(S.tunedClean, N)}, so the router never breaks`,
      `Not yet. It is far better than the base model, but ${of(S.tunedRight, N)} right is too low to route alone, and most misses fall in a few groups. Look at those groups, add better rows for them, and re-measure on this same held-out set`,
      "No: fine-tuning failed, so go back to the base model and a longer prompt",
      "Measure it on the training rows instead; that is a bigger, fairer sample"
    ];
    const correct = 1;
    const fb = [
      `A clean label is only half of the job. A clean wrong label sends the message to the wrong team with no error at all: that happened ${N - S.tunedRight} times.`,
      "",
      `The base model scored ${S.baseRight} right and ${S.baseClean} clean labels. The tuned one scored ${S.tunedRight} and ${S.tunedClean}. Training clearly helped; it just is not finished.`,
      `The model studied those rows: by the end its training loss was ${LAST_TRAIN}. A score on rows it has seen tells you how well it memorised, not how it handles a new customer. Only held-out rows answer that.`
    ];
    const row = (name, k) => `<tr><td>${name}</td><td class="n">${of(S[k + "Clean"], N)}</td><td class="n">${of(S[k + "Right"], N)}</td></tr>`;
    const paint = () => {
      el.innerHTML = `<h1>All ${N} held-out messages</h1>
        <p class="lead">The tuned model, scored on every held-out message. Picking a team at random would get about ${N / TEAMS.length} right.</p>
        <table class="${P}tbl"><tr><th>model</th><th>clean label</th><th>right team</th></tr>${row("base", "base")}${row("tuned", "tuned")}</table>
        <table class="${P}tbl"><tr><th>tuned, by language</th><th>right</th><th>training rows</th></tr>${Object.keys(LANG).map(l => `<tr><td>${LANG[l]}</td><td class="n">${of(BY_LANG[l].right, BY_LANG[l].n)}</td><td class="n">${TRAIN_LANG[l]}</td></tr>`).join("")}</table>
        <table class="${P}tbl"><tr><th>tuned, by team</th><th>right</th><th>times it said this team</th></tr>${TEAMS.map(t => `<tr><td>${t}</td><td class="n">${of(BY_TEAM[t].right, BY_TEAM[t].n)}</td><td class="n">${SAID[t]}</td></tr>`).join("")}</table>
        <p class="task">The operations lead asks: “Can we switch it on?” What is the honest answer?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: pick, correct })}
        ${pick == null ? "" : pick === correct
          ? kit.feedback(`Right. The weak spots are visible in the tables: ${LANG[WORST_LANG]} (${of(lb.right, lb.n)}) and ${WORST_TEAM} (${of(tb.right, tb.n)}), and the model says ${FAVE} far more often (${SAID[FAVE]} times) than ${FAVE} messages appear (${BY_TEAM[FAVE].n}). One warning before you add rows: ${LANG[MOST_TRAIN_LANG]} already had the most training rows (${TRAIN_LANG[MOST_TRAIN_LANG]}). The model card (the page that describes this base model) says it mainly understands English. A small adapter can only build on what the frozen model reads. So the fix may be a base model that reads ${LANG[WORST_LANG]} better, not only more rows. Either way, the held-out set is the judge, and it must stay untouched so the scores stay comparable.`, true)
          : kit.feedback(fb[pick], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 6. The training run: read the loss curve, predict the validation line. */
  function lossChart(showVal) {
    const W = 340, H = 170, L = 34, R = 10, T = 10, B = 26, YMAX = 2;
    const x = s => L + (s / ITERS) * (W - L - R), y = v => T + (1 - Math.min(v, YMAX) / YMAX) * (H - T - B);
    const pts = a => a.map(([s, v]) => `${x(s).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const ticks = [0, 0.5, 1, 1.5, 2].map(v => `<line class="ax" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
    const xt = [0, 50, 100, 150, 200].map(s => `<text x="${x(s)}" y="${H - 8}" text-anchor="middle">${s}</text>`).join("");
    const valPts = VAL.filter(([s]) => s >= 20);
    return `<div class="${P}chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Training loss by step${showVal ? ", with validation loss" : ""}">${ticks}${xt}
      <polyline class="tr" points="${pts(TRAIN)}"/>${showVal ? `<polyline class="va" points="${pts(valPts)}"/>${valPts.map(([s, v]) => `<circle class="dot" cx="${x(s)}" cy="${y(v)}" r="3"/>`).join("")}` : ""}</svg>
      <p class="${P}cap">x: training step · y: loss · solid line: training loss${showVal ? " · dashed line with dots: validation loss" : ""}. Validation loss at step 1 was ${VAL[0][1]}, above the top of the chart.</p></div>`;
  }
  function trainRun({ el, done, kit }) {
    css();
    let pick = null;
    const opts = [
      `It keeps falling with the training loss and ends near ${LAST_TRAIN}`,
      "It drops fast, then wanders up and down in a band while the training loss keeps sinking",
      "It drops, then climbs steadily back above 1"
    ];
    const correct = 1;
    const fb = [
      `That would mean the model does as well on rows it never trained on as on rows it studied. Here it does not: look at the dashed line.`,
      "",
      "That is the classic over-training shape, and it is worth watching for. This run did not reach it: look at the dashed line."
    ];
    const paint = () => {
      const shown = pick != null;
      el.innerHTML = `<h1>The training run</h1>
        <p class="lead">This is the run behind the tuned model, on this site's Mac. It used <b>mlx-lm</b>, Apple's MLX library for language models. Its docs say that when the model you give it is quantized (stored in fewer bits, here 4), LoRA training becomes QLoRA. The command:</p>
        <div class="${P}cmd">${kit.code(TRAIN_CMD, -1)}</div>
        <p class="lead">Rank ${RANK} adapters, learning rate ${LR}, ${ITERS} steps, each on a batch of ${BATCH} rows. <code>--mask-prompt</code> counts the loss on the reply only (the team name), not on the system message and customer text. Every 20 steps it also measures the loss on the ${VALID_N} validation rows, which it does not train on.</p>
        ${lossChart(shown)}
        <p class="task">The training loss falls from ${TRAIN[0][1]} to ${LAST_TRAIN}. What does the validation loss do from step 20 to step 200?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: pick, correct })}
        ${pick == null ? "" : pick === correct
          ? kit.feedback(`Right. By step 20 the validation loss had already dropped from ${VAL[0][1]} to ${VAL[1][1]}: most of the learning came early. After that it stays between ${VAL_LO} and ${VAL_HI}, while in the second half the training loss sinks well below it, to ${LAST_TRAIN}. That gap is the model fitting the rows it studied more tightly than new ones. A training loss near zero is not a score; the held-out set is.`, true)
          : kit.feedback(fb[pick], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 7. The library: the same recipe with Hugging Face PEFT + TRL, written from the docs, not run by us. */
  const PEFT_CODE = [
    "bnb = BitsAndBytesConfig(load_in_4bit=True,",
    "    bnb_4bit_quant_type=\"nf4\")",
    "lora = LoraConfig(r=8, target_modules=\"all-linear\",",
    "    task_type=\"CAUSAL_LM\")",
    "args = SFTConfig(output_dir=\"router\", learning_rate=1e-4)",
    "trainer = SFTTrainer(",
    "    model=\"HuggingFaceTB/SmolLM2-135M-Instruct\",",
    "    args=args, train_dataset=train_rows,",
    "    quantization_config=bnb,",
    "    peft_config=lora)",
    "trainer.train()"
  ];
  const PEFT_RIGHT = [0, 8];
  const PEFT_NO = {
    1: "NF4 is the kind of 4-bit number QLoRA introduced, made for weights that are spread like a bell curve. It picks which 4-bit format, but the line that turns 4-bit loading on is another one.",
    2: "This sets up the LoRA adapter, which plain LoRA has too. r is the adapter's rank, as in the LoRA lesson. \"all-linear\" puts adapters on every linear layer, which the PEFT docs call QLoRA-style. Plain LoRA can do the same; none of it makes the base 4-bit.",
    3: "task_type tells PEFT this is a next-token model. Same for LoRA and QLoRA.",
    4: "The output folder is where the adapter is saved. TRL's docs suggest a higher learning rate (about 1e-4) when training adapters, because only new parameters learn. Useful, but the same for LoRA and QLoRA. Nothing about bits.",
    5: "The trainer runs either kind of training.",
    6: "The model name is the same whether you load it in 4 bits or not.",
    7: "The settings and the data are the same for LoRA and QLoRA.",
    9: "peft_config adds the adapter. That is the LoRA part, present in plain LoRA too.",
    10: "train() runs the loop for any setup."
  };
  function library({ el, done, kit }) {
    css();
    let pick = null;
    const paint = () => {
      const ok = PEFT_RIGHT.includes(pick);
      el.innerHTML = `<h1>The same recipe in Hugging Face PEFT</h1>
        <p class="lead"><b>Not run by us.</b> Written from the official <a class="${P}inl" href="https://huggingface.co/docs/peft/main/en/developer_guides/quantization" target="_blank" rel="noopener">PEFT</a> and <a class="${P}inl" href="https://huggingface.co/docs/trl/main/en/sft_trainer" target="_blank" rel="noopener">TRL</a> documentation, checked ${RUN_DATE}. Three libraries work together: PEFT adds the adapter, bitsandbytes stores the frozen model in 4 bits, and TRL's <code>SFTTrainer</code> runs the training. On a GPU this is the usual recipe. The lesson's notebook runs on a free Colab CPU instead: it trains the same kind of adapter with PEFT, but unpacks the 4-bit file itself instead of using bitsandbytes.</p>
        <p class="lead"><code>train_rows</code> holds each row as a <i>prompt</i> (the system and user turns) and a <i>completion</i> (the assistant turn with the team name). For that shape, TRL computes the loss on the completion only by default, like <code>--mask-prompt</code> in our run, and it applies the chat template to conversational rows itself.</p>
        <p class="task">Tap the line that makes this QLoRA and not plain LoRA.</p>
        <div class="${P}lines">${PEFT_CODE.map((c, i) => `<button type="button" data-i="${i}" class="${pick === i ? (ok ? "right" : "wrong") : ""}" ${ok ? "disabled" : ""}>${kit.esc(c)}</button>`).join("")}</div>
        <div class="lpanel">${pick == null ? "" : ok
          ? kit.feedback(`Right. <code>load_in_4bit=True</code> loads the frozen weights in 4 bits, and <code>quantization_config=bnb</code> hands that setting to the trainer; TRL's docs say to combine it with <code>peft_config</code> for QLoRA. Take it out and the same code trains plain LoRA on a full-size model, which needs more GPU memory. The parameters worth a thought are few: <b>r</b> (adapter size), <b>target_modules</b> (which layers get adapters) and the <b>learning rate</b>.`, true)
          : kit.feedback(PEFT_NO[pick], false)}</div>`;
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (PEFT_RIGHT.includes(pick)) done(); });
    };
    paint();
  }

  /* 8. Broken on purpose: the serving code skips the chat template. Find the line, then the fix. */
  // route_compare.py, the lines as written (the SYSTEM string continues on the next source line)
  const BROKEN = [
    { t: "model, tokenizer = load(\"Irfanuruchi/SmolLM2-135M-Instruct-MLX-4bit\", adapter_path=\"adapters\")", k: "load",
      no: "The adapter is loaded: the replies use team names, which the base model never wrote once." },
    { t: "SYSTEM = (\"You route customer messages for a parcel delivery company. \"", k: "system",
      no: "This is word for word the system message from every training row." },
    { t: "def route_broken(message):", k: "def", fixed: true },
    { t: "    prompt = SYSTEM + \"\\n\" + message + \"\\n\"", k: "prompt" },
    { t: "    return generate(model, tokenizer, prompt=prompt, max_tokens=12).strip()", k: "gen",
      no: "The same call and the same 12-token limit as the evaluation that scored the tuned model. The limit explains where the long replies end, not why they keep going past the team name." }
  ];
  function broken({ el, done, kit }) {
    css();
    let cause = null, fix = null;
    const runaway = ROWS.find(r => !isClean(r.broken) && r.broken.length > 40);
    const flipped = ROWS.find(r => r.tuned === r.team && isClean(r.broken) && r.broken !== r.team);
    const fixes = [
      "Train again with more rows",
      "Build the serving prompt with the tokenizer's apply_chat_template (with add_generation_prompt=True), the same template the training rows went through, and run the held-out set through the serving code before release",
      "Raise max_tokens so the replies can finish",
      "Cut every reply at the first team name it contains"
    ];
    const fixOk = 1;
    const fixNo = [
      "The model is fine: called the right way it scored higher on the same messages. More rows would not change what the serving code sends it.",
      "",
      "The long replies are not unfinished labels; they never stop on their own. More room gives more junk.",
      `That hides the long replies, but not the clean wrong ones: one message the model routes right through the template went to ${flipped ? flipped.broken : "another team"} here. Fix the prompt, not the output.`
    ];
    const paint = () => {
      const found = cause === "prompt";
      el.innerHTML = `<h1>Broken on purpose: the right model, served the wrong way</h1>
        <p class="lead">A developer wires the tuned router into the server. Nothing crashes. A week later, the teams complain about messages that land in the wrong queue. Here is what the server's function returned for two held-out messages:</p>
        ${msgCard(kit, runaway, glossOf(runaway), `for ${runaway.team}`)}${ans(kit, "Reply:", runaway.broken.slice(0, 40) + " …")}
        ${msgCard(kit, flipped, glossOf(flipped), `for ${flipped.team}`)}${ans(kit, "Reply:", flipped.broken)}
        ${CAP_LOCAL}
        <p class="lead">Run over all ${N} held-out messages, the server's function scores <b>${of(S.brokenRight, N)} right</b> and <b>${of(S.brokenClean, N)} clean labels</b>. The evaluation of the same tuned model scored ${of(S.tunedRight, N)} and ${of(S.tunedClean, N)}. ${of(S.brokenChanged, N)} replies differ.</p>
        <p class="task">${found ? "Now pick the fix." : "Tap the line in the server's code that causes this."}</p>
        <div class="${P}lines">${BROKEN.map(r => r.fixed
          ? `<div class="fixed">${kit.esc(r.t)}</div>`
          : `<button type="button" data-i="${r.k}" class="${cause === r.k ? (r.k === "prompt" ? "right" : "wrong") : ""}" ${found ? "disabled" : ""}>${kit.esc(r.t)}</button>`).join("")}</div>
        <div class="lpanel">${cause == null ? "" : found
          ? kit.feedback(`Right. The prompt is glued by hand as plain text. Every training row went through the chat template, so the model learned one pattern: the team name comes right after an open assistant turn, then the end-of-turn marker. Here it never sees that pattern. It still guesses team names (it learned them well), but it routes worse, and on ${of(N - S.brokenClean, N)} messages it does not stop after the name. This is what the template looks like for the first held-out message, as our run printed it:`, true) + `<div class="${P}str">${kit.esc(TPL)}</div>`
          : kit.feedback(kit.esc(BROKEN.find(r => r.k === cause).no), false)}
        ${found ? `<div id="fix">${kit.options(fixes.map(kit.esc), { picked: fix, correct: fixOk })}</div>
          ${fix == null ? "" : fix === fixOk
            ? kit.feedback(`Right. With <code>apply_chat_template</code>, the same model and the same limit score ${of(S.tunedRight, N)} and ${of(S.tunedClean, N)} clean. The bug was silent: no error, and still mostly team names. Only an evaluation run through the real serving path catches it.`, true)
            : kit.feedback(kit.esc(fixNo[fix]), false)}` : ""}</div>`;
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => { cause = b.dataset.i; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === fixOk) done(); });
    };
    paint();
  }

  /* 9. The big picture: what it is for, when not, and which cost arrives with each change. */
  const COSTS = ["Train the adapter again (on new or existing labelled rows) and re-run the held-out set", "No training: change the prompt or the code", "Serving cost, not training"];
  const SITS = [
    { q: "The company adds a fifth team, Returns.", ok: 0,
      yes: "Right. The adapter only knows four names. New labelled rows, a new run and a new held-out score: the routine cost of a tuned model.",
      no: { 1: "The tuned model learned to answer with one of four names, and no training row ever said Returns. A line in the prompt is unlikely to undo that habit. It needs examples of the fifth team.",
            2: "Serving stays the same. The model itself has to learn the new label first." } },
    { q: "A newer version of the base model comes out, and the team wants to switch to it.", ok: 0,
      yes: "Right. The adapter was trained against the old model's frozen weights. On new weights it means nothing. Train it again on the new base, reusing the same labelled rows, and re-measure on the same held-out set.",
      no: { 1: "The adapter is a set of changes to one particular model's weights. Swap the base and those changes no longer fit it.",
            2: "Running the new model is the easy part. The adapter was fitted to the old weights and must be trained again." } },
    { q: "Message volume grows ten times over the holidays.", ok: 2,
      yes: "Right. Nothing about the model changes. You pay for more machines or a faster server. A small model is cheap to serve, which was the point of tuning one.",
      no: { 0: "The messages are the same kind as before. The model does not need to learn anything new; it needs to answer more often.",
            1: "Nothing about the prompt changes either. More traffic is a serving question: machines and speed." } }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans2 = SITS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <p class="lead"><b>What for:</b> teaching a model a narrow, fixed task (a label set, a reply format) from examples, cheaply: the base stays frozen in 4 bits, only a small adapter learns. <b>When to reach for it:</b> a prompt alone is not reliable or too costly at your volume, and you have hundreds or more good labelled rows. <b>When not:</b> the knowledge changes often (retrieve it instead), a prompt already works, or you have no clean labels. <b>What it costs:</b> labelled data, GPU time for each run, an evaluation after each run, and a retrain whenever the labels or the base model change.</p>
        <p class="task">For each change, pick what it costs you.</p>
        ${SITS.map((s, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(s.q)}</p>${kit.options(COSTS, { picked: ans2[i], correct: s.ok })}
          ${ans2[i] == null ? "" : ans2[i] === s.ok ? kit.feedback(kit.esc(s.yes), true) : kit.feedback(kit.esc(s.no[ans2[i]]), false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans2[i] = +b.dataset.i; paint();
        if (SITS.every((s, j) => ans2[j] === s.ok)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it: is a QLoRA fine-tune the right tool here? */
  const CASES = [
    ["A law firm tags contract clauses with one of twelve labels. A large hosted model does it well but costs too much at their volume. They have several thousand clauses already tagged by lawyers.", true,
      "Yes. A fixed label set, plenty of labelled rows, and a reason to move off the big model. Tune a small model with QLoRA and compare it with the big one on held-out clauses.",
      "This is the router's situation in another office: a fixed label set, thousands of labelled rows, and a big model that is too costly. That is what a QLoRA fine-tune of a small model is for."],
    ["A help bot must answer from the company's policy pages, which change every week.", false,
      "No. Fine-tuning bakes in what the pages said on training day; next week it is out of date, and you would retrain weekly. Retrieve the current page at question time instead (RAG).",
      "Training would freeze last week's policies into the weights, and every change would need a new run. When the facts change often, look them up at question time (RAG) instead."],
    ["A team wants an open model to always answer in their fixed report format. Careful prompts still drift, they have 2,000 good example reports, and full fine-tuning runs out of memory on their one GPU.", true,
      "Yes. A fixed format, good examples, and a memory limit: the 4-bit frozen base is what lets the training fit on one GPU.",
      "The memory limit is exactly what QLoRA answers: the frozen base is stored in 4 bits and only a small adapter trains. With 2,000 good examples and a format to learn, it fits."],
    ["A shop's model must add up invoice lines and get the total exactly right every time.", false,
      "No. Exact arithmetic is a job for code. Have the model call a function, or compute the total yourself. Training on examples makes the model better at guessing totals, never certain.",
      "Examples make a model guess better, not calculate. An exact total must come from code: a function the model calls, or your own program."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const a = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would you fine-tune here?</h1>
        <p class="lead">${CASES.length} situations away from the parcel company.</p>
        <p class="task">For each one: is a QLoRA fine-tune the right tool? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: a[i], correct: y ? 0 : 1 })}${a[i] == null ? "" : kit.feedback(kit.esc(a[i] === (y ? 0 : 1) ? yes : no), a[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        a[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => a[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and a "what you should see" checklist from our run of the notebook
     (notebooks/s5c-qlora-run.ipynb, executed outputs; adapters on the top 16 layers, 100 steps, CPU). */
  const NB = { trainable: "1,302,528", pct: "0.9590%", loss10: "2.150", loss20: "0.712", loss100: "0.369",
    tunedRight: 22, uzRight: "5 of 12" };
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    const CHECK = [
      `Before training, the base model's replies are not team names: ours gave a clean label on ${of(S.baseClean, N)} held-out messages.`,
      `PEFT's print_trainable_parameters() shows the adapter as a small share of the model: ${NB.trainable} trainable numbers (${NB.pct}). The lesson's run, with adapters on all 30 layers, trained ${TRAINABLE.n} (${TRAINABLE.pct}).`,
      `The training loss, printed every 10 steps, falls fast at first, then slowly: ${NB.loss10} at step 10, ${NB.loss20} at step 20, ${NB.loss100} at step 100.`,
      `After training, every reply on the held-out set is one of the four team names: clean label ${of(N, N)}.`,
      `The tuned model gets more held-out messages right than the base model (${NB.tunedRight} against ${S.baseRight} in our run), and ${LANG[WORST_LANG]} is the weakest language (${NB.uzRight}).`,
      `Served without the chat template, the same tuned model gives clean label 0 of ${N}: the replies run on past the team name.`
    ];
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now say what QLoRA is (a small adapter trained on a frozen 4-bit model), why it works for a fixed task, how to judge it (a held-out set, never the training loss), and how a tuned model fails silently when it is served without its chat template.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}link" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a>.` : "The notebook for this lesson is on its way."} It trains the router with PEFT on a free Colab CPU and scores it on the held-out set. A CPU is slower, so the run is shorter than ours (adapters on the top 16 of 30 layers, 100 steps instead of 200) and its scores are lower; the pattern is the same. What you should see (numbers from our run of the notebook):</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${kit.esc(c)}</span></label></li>`).join("")}</ul>
      <p class="lead">Keep the adapter and the held-out set: this router is your fine-tuning portfolio project. Stage 6 serves it, and stage 7 finishes it.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Your router reads text written by strangers; that lesson shows how such text can try to give a model orders.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Fine-tune a small model with QLoRA",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/2305.14314",
      "https://huggingface.co/docs/peft/main/en/developer_guides/quantization",
      "https://huggingface.co/docs/trl/main/en/sft_trainer",
      "https://huggingface.co/docs/bitsandbytes/main/en/installation",
      "https://huggingface.co/docs/transformers/main/en/chat_templating",
      "https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md",
      "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct",
      "https://research.google.com/colaboratory/faq.html"
    ],
    interview: [{
      q: "You fine-tuned a small model with QLoRA to route support tickets. Your offline evaluation looked good, but in production routing is clearly worse and some replies have junk after the label. Where do you look first?",
      good: [
        "Compare the serving prompt with the training format: is it built with the same chat template, with add_generation_prompt=True?",
        "Check that generation stops on the template's end-of-turn token",
        "Check that the deployed base model and adapter are the exact pair that was evaluated",
        "Run the held-out set through the real serving code, not a separate eval script, and compare the scores"
      ],
      weak: "Retrain with more data or a bigger rank. That assumes the model is the problem without checking how it is being called."
    }, {
      q: "A team has 3,000 labelled support messages and pays a lot to classify them with a large hosted model. Would you fine-tune a small open model, and how would you know it worked?",
      good: [
        "A fixed label set with thousands of labels is a good fit for a QLoRA fine-tune of a small model: cheap to train, cheap to serve",
        "Keep a held-out set aside before training and never train on it; compare the big model, the base small model and the tuned one on it",
        "Score both a clean label and the right label, and break the errors down by group (language, class)",
        "Count the running costs: retraining when labels or the base model change, and an evaluation after every run"
      ],
      weak: "Yes, fine-tune, then check that the training loss went down. The training loss says how well it learned the rows it saw, not how it handles new messages."
    }],
    screens: [situation, predictScreen("base"), spotIdea, predictScreen("tuned"), heldOut, trainRun, library, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: PICK.map((_, k) => `#c${k} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: PICK.map((_, k) => `#c${k} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="6"]'], right: ['[data-i="0"]'] },
      { wrong: ['[data-i="gen"]'], right: ['[data-i="prompt"]', "#fix [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SITS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
