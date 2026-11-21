/* Lesson s5c-tuning-dataset: building a fine-tuning set from real messages, teacher labels and synthetic rows.
   Story: a parcel delivery company routes customer messages written in Uzbek, Russian and Korean to one of four
   teams. A large hosted model (the teacher) labels last month's messages so a small model (the student) can be
   trained to do the routing in house.
   Ideas: (1) the student copies its rows, mistakes included: check the teacher against people's labels, find the
   pattern in its mistakes (here: a vague team list), fix the instructions and relabel; (2) clean the rows before
   training: copies, contradictions, test-set rows, the exact target format; synthetic rows only for training.
   Data:
   - Recordings (scripts/ai/record.mjs, openrouter, deepseek/deepseek-chat, temperature 0), made 2026-11-13:
     docs/ai-path/recordings/s5c-tuning-dataset/v1-<id>.json (the short team list) and v2-<id>.json (the team list
     rewritten with rules), 26 messages each; synth-ko.json (six synthetic Korean Claims messages, temperature 0.9).
     The labels in V1/V2 are the parsed replies; RAW holds replies shown in full.
   - docs/ai-path/runs/s5c-tuning-dataset/build_rows.py -> rows.json (the twenty-row table, the test set, the support
     lead's labels), build_rows.out.txt.
   - student.py -> student.out.txt: the stand-in student (copies the label of the most similar training row),
     before and after cleaning (REPORT).
   - clean.py -> clean.out.txt: the cleaning function, traced on rows 3, 9, 15 and 5 (TRACE), then run on all 20.
   - to_row.py -> to_row.out.txt: one teacher reply turned into one training row (ROW_OUT).
   Story data written for the lesson (not model output): the customer messages, the English translations, the
   support lead's labels (GOLD), which rows came from agents, the test set.
   Every count on screen is computed here from this data. Lesson-local CSS (prefix lx-s5c-tuning-dataset-): row
   cards with in-card problem buttons, quotes, rule sheet, report lines. Plain browser script. */
(() => {
  const P = "lx-s5c-tuning-dataset-";
  const REC_DATE = "2026-11-13";
  const TEAMS = ["Delivery", "Payments", "Claims", "Account"];

  // Customer messages (story data) and the lesson's own English translations.
  const MSG = {"r1": "Здравствуйте, где моя посылка? Трек-номер не обновляется уже неделю.", "r2": "Посылка пришла мокрая, книги испорчены. Хочу вернуть деньги.", "r3": "С меня списали деньги за доставку, хотя она должна быть бесплатной.", "r4": "Не могу войти в аккаунт, пишет что номер уже занят.", "r5": "Можно перенести доставку на субботу? В пятницу меня не будет дома.", "r6": "В заказе не хватает одной банки краски, а оплатил я две. Верните за неё деньги.", "r7": "Заказ так и не приехал, оформите возврат средств.", "r8": "Из трёх заказанных футболок пришли только две, деньги за третью верните.", "r9": "Коробка пришла с вмятиной, телевизор не включается. Верните деньги.", "u1": "Assalomu alaykum, buyurtmam qachon yetib keladi? Uch kundan beri kutyapman.", "u2": "Kartamdan ikki marta pul yechildi, bitta buyurtma uchun.", "u3": "Quti ezilgan holda keldi, ichidagi piyola sinib qolgan. Pulimni qaytarib bering.", "u4": "Ilovaga kira olmayapman, parolni tiklash kodi kelmayapti.", "u5": "Buyurtmani bekor qildim, lekin pul hali qaytmadi.", "u6": "Kuryer manzilni topa olmadi, yangi manzil yozib beraymi?", "u7": "Paketda bitta krossovka yo'q, faqat bittasi keldi. Pulini qaytaring.", "u8": "Telefon raqamimni o'zgartirmoqchiman, eski raqam endi ishlamaydi.", "u9": "Ikkita kitob buyurtma qilgandim, bittasi qutida yo'q. Pulini qaytarishingizni so'rayman.", "k1": "택배가 언제 도착하나요? 주문한 지 5일 지났어요.", "k2": "상자가 찢어져서 왔고 화장품 병이 깨졌어요. 환불해 주세요.", "k3": "같은 주문인데 결제가 두 번 됐어요.", "k4": "비밀번호를 바꿨는데 로그인이 안 돼요.", "k5": "주문을 취소했는데 환불이 아직 안 들어왔어요.", "k6": "배송지를 회사 주소로 바꿀 수 있나요? 아직 출발 안 했으면요.", "k7": "주문한 컵 세 개 중에 하나가 안 들어있어요. 그 금액만 돌려주세요.", "k8": "신발 두 켤레를 주문했는데 상자에 한 켤레만 있었어요. 나머지 금액 환불 부탁드려요."};
  const EN = {
    r1: "Hello, where is my parcel? The tracking number has not changed for a week.",
    r2: "The parcel arrived wet, the books are ruined. I want my money back.",
    r3: "I was charged for delivery, but it should be free.",
    r4: "I can't log in to my account, it says the number is already taken.",
    r5: "Can you move the delivery to Saturday? I won't be home on Friday.",
    r6: "One tin of paint is missing from the order, and I paid for two. Give me the money for it back.",
    r7: "The order never arrived, please arrange a refund.",
    r8: "I ordered three T-shirts and only two came. Give back the money for the third.",
    r9: "The box came dented and the TV won't turn on. Give my money back.",
    u1: "Hello, when will my order arrive? I have been waiting for three days.",
    u2: "Money was taken from my card twice for one order.",
    u3: "The box arrived crushed and the bowl inside is broken. Give my money back.",
    u4: "I can't get into the app, the password reset code doesn't come.",
    u5: "I cancelled the order, but the money hasn't come back yet.",
    u6: "The courier couldn't find the address. Shall I write a new address?",
    u7: "One sneaker is missing from the package, only one came. Refund it.",
    u8: "I want to change my phone number, the old number doesn't work any more.",
    u9: "I ordered two books, one is not in the box. Please refund it.",
    k1: "When will the parcel arrive? It's been 5 days since I ordered.",
    k2: "The box came torn and the cosmetics bottle broke. Please refund me.",
    k3: "It's the same order, but I was charged twice.",
    k4: "I changed my password and now I can't log in.",
    k5: "I cancelled the order but the refund hasn't come in yet.",
    k6: "Can I change the delivery address to my office? If it hasn't left yet.",
    k7: "One of the three cups I ordered is not in the box. Refund just that amount.",
    k8: "I ordered two pairs of shoes but the box had only one pair. Please refund the rest."
  };
  // The team a support lead picked for each message after reading the routing rules (story data, build_rows.py GOLD).
  const GOLD = { r1: "Delivery", r2: "Claims", r3: "Payments", r4: "Account", r5: "Delivery", r6: "Claims", r7: "Payments", r8: "Claims", r9: "Claims", u1: "Delivery", u2: "Payments", u3: "Claims", u4: "Account", u5: "Payments", u6: "Delivery", u7: "Claims", u8: "Account", u9: "Claims", k1: "Delivery", k2: "Claims", k3: "Payments", k4: "Account", k5: "Payments", k6: "Delivery", k7: "Claims", k8: "Claims" };
  const IDS = Object.keys(MSG);
  const LANG = { r: "Russian", u: "Uzbek", k: "Korean" };
  // Story data: the messages where an item is missing from the parcel and the customer asks for money back.
  const MISSING = ["r6", "r8", "u7", "u9", "k7", "k8"];

  // The two team lists the teacher was given (the system prompts of the v1 and v2 recordings, team lines only).
  const LIST_V1 = [["Delivery", "tracking, delivery dates, addresses."], ["Payments", "charges and refunds."], ["Claims", "damaged parcels."], ["Account", "login and account details."]];
  const LIST_V2 = [["Delivery", "Where a parcel is, when it arrives, changing the delivery day or address."], ["Payments", "Wrong or double charges, and refunds for orders that were cancelled or never arrived."], ["Claims", "A parcel that arrived damaged or with an item missing, even when the customer asks for money back."], ["Account", "Logging in, passwords, the phone number on the account."]];

  // From docs/ai-path/recordings/s5c-tuning-dataset/v1-<id>.json and v2-<id>.json: [team, confidence] parsed from each reply.
  const REC = { src: "s5c-tuning-dataset/<v>-<id>", provider: "openrouter", model: "deepseek/deepseek-chat", recordedAt: REC_DATE };
  const V1 = {"r1": ["Delivery", 0.95], "r2": ["Claims", 0.95], "r3": ["Payments", 0.95], "r4": ["Account", 0.95], "r5": ["Delivery", 0.95], "r6": ["Payments", 0.95], "r7": ["Payments", 0.9], "r8": ["Payments", 0.95], "r9": ["Claims", 0.95], "u1": ["Delivery", 0.95], "u2": ["Payments", 0.95], "u3": ["Claims", 0.9], "u4": ["Account", 0.95], "u5": ["Payments", 0.95], "u6": ["Delivery", 0.95], "u7": ["Claims", 0.9], "u8": ["Account", 0.95], "u9": ["Payments", 0.95], "k1": ["Delivery", 0.95], "k2": ["Claims", 0.95], "k3": ["Payments", 0.95], "k4": ["Account", 0.95], "k5": ["Payments", 0.95], "k6": ["Delivery", 0.95], "k7": ["Claims", 0.9], "k8": ["Claims", 0.9]};
  const V2 = {"r1": ["Delivery", 0.95], "r2": ["Claims", 0.95], "r3": ["Payments", 0.95], "r4": ["Account", 0.95], "r5": ["Delivery", 0.95], "r6": ["Claims", 0.95], "r7": ["Payments", 0.95], "r8": ["Claims", 0.9], "r9": ["Claims", 0.95], "u1": ["Delivery", 0.95], "u2": ["Payments", 0.95], "u3": ["Claims", 0.95], "u4": ["Account", 0.95], "u5": ["Payments", 0.95], "u6": ["Delivery", 0.95], "u7": ["Claims", 0.95], "u8": ["Account", 0.95], "u9": ["Claims", 0.95], "k1": ["Delivery", 0.95], "k2": ["Claims", 0.95], "k3": ["Payments", 0.95], "k4": ["Account", 0.95], "k5": ["Payments", 0.95], "k6": ["Delivery", 0.95], "k7": ["Claims", 0.95], "k8": ["Claims", 0.95]};
  // Replies shown in full (exact text of choices[0].message.content). Every one of the 52 replies starts with a ```json fence.
  const RAW = {
    "v1-u9": "```json\n{\"team\": \"Payments\", \"confidence\": 0.95}\n```",
    "v2-r8": "```json\n{\"team\": \"Claims\", \"confidence\": 0.9}\n```",
    "v2-u9": "```json\n{\"team\": \"Claims\", \"confidence\": 0.95}\n```",
    "v2-r7": "```json\n{\"team\": \"Payments\", \"confidence\": 0.95}\n```",
    "v2-k7": "```json\n{\"team\": \"Claims\", \"confidence\": 0.95}\n```"
  };
  // build_rows.out.txt: "raw replies starting with a ```json fence, v1 and v2: 52 of 52". Every reply counted is one
  // V1 or V2 entry, so the count is the number of entries.
  const FENCED = Object.keys(V1).length + Object.keys(V2).length;
  // From docs/ai-path/recordings/s5c-tuning-dataset/synth-ko.json (full text, not altered).
  const SYNTH = "택배 받았는데 상자 안 물건이 깨져서 나왔어요. 어떻게 처리해야 하나요?  \n주문한 책 표지가 찢어져서 도착했어요. 교환 가능한가요?  \n택배 상자가 완전히 찌그러져서 내용물이 손상됐어요. 보상 받을 수 있나요?  \n주문한 가방이 누락되어 있어요. 어떻게 해결해 주시나요?  \n상자가 개봉된 상태로 왔고 물건이 없어요. 환불 부탁드립니다.  \n택배 받았는데 내부 물건이 다 젖어서 왔어요. 보상 절차를 알려주세요.";
  const SYNTH_LINES = SYNTH.split("\n");
  const SYNTH_EN = [
    "I got the parcel and the item in the box was broken. How should this be handled?",
    "The cover of the book I ordered arrived torn. Can I exchange it?",
    "The parcel box was completely crushed and the contents were damaged. Can I get compensation?",
    "The bag I ordered is missing. How will you resolve this?",
    "The box came opened and the item is not there. Please refund me.",
    "I got the parcel and everything inside was wet. Please tell me how to get compensation."
  ];

  // The twenty-row table (build_rows.py TABLE): log = routed by an agent; teacher = the v1 label; synthetic = synth-ko line 2.
  const TABLE = [["teacher", "r1"], ["teacher", "u2"], ["log", "r6"], ["teacher", "k3"], ["teacher", "u9"], ["teacher", "r4"], ["log", "u1"], ["teacher", "k7"], ["teacher", "r6"], ["teacher", "r8"],
    ["log", "u1"], ["teacher", "r7"], ["teacher", "k5"], ["teacher", "u4"], ["teacher", "u6"], ["synthetic", 1], ["teacher", "r9"], ["teacher", "u7"], ["teacher", "k6"], ["teacher", "r2"]];
  const ROWS = TABLE.map(([src, key], i) => src === "synthetic"
    ? { n: i + 1, src, text: SYNTH_LINES[key].trim(), en: SYNTH_EN[key], label: "Claims", gold: "Claims" }
    : { n: i + 1, src, id: key, text: MSG[key], en: EN[key], label: src === "log" ? GOLD[key] : V1[key][0], conf: src === "log" ? null : V1[key][1], gold: GOLD[key] });
  // Held-out test set (story data, build_rows.py TEST) with the lesson's translations.
  const TEST = [
    { text: MSG.u6, en: EN.u6, label: "Delivery" },
    { text: "Ikkita ko'ylak buyurtma qilgandim, qutida faqat bittasi bor. Pulini qaytaring.", en: "I ordered two shirts, there is only one in the box. Refund it.", label: "Claims" },
    { text: "Из двух заказанных кружек пришла только одна, верните деньги за вторую.", en: "I ordered two mugs and only one came. Give back the money for the second.", label: "Claims" },
    { text: "카드에서 같은 금액이 두 번 결제됐어요.", en: "The same amount was charged to my card twice.", label: "Payments" },
    { text: "Не могу войти в аккаунт: код из СМС не приходит.", en: "I can't log in to my account: the SMS code doesn't come.", label: "Account" },
    { text: "택배가 언제 오나요? 주문한 지 일주일 됐어요.", en: "When will the parcel come? It's been a week since I ordered.", label: "Delivery" }
  ];

  // docs/ai-path/runs/s5c-tuning-dataset/student.out.txt: [student's team, nearest training row, similarity] per test message.
  const REPORT = {
    before: { rows: 34, lines: [["Delivery", 15, "1.00"], ["Payments", 5, "0.50"], ["Payments", 10, "0.40"], ["Payments", 4, "0.23"], ["Account", 6, "0.29"], ["Delivery", 26, "0.39"]] },
    after: { rows: 31, lines: [["Account", 14, "0.09"], ["Claims", 5, "0.50"], ["Claims", 10, "0.40"], ["Payments", 4, "0.23"], ["Account", 6, "0.29"], ["Delivery", 26, "0.39"]] },
    leak: { rows: 32, lines: [["Delivery", 15, "1.00"], ["Claims", 5, "0.50"], ["Claims", 10, "0.40"], ["Payments", 4, "0.23"], ["Account", 6, "0.29"], ["Delivery", 26, "0.39"]] }
  };
  const scoreOf = k => REPORT[k].lines.filter((l, i) => l[0] === TEST[i].label).length;

  // docs/ai-path/runs/s5c-tuning-dataset/clean.out.txt, the TRACE lines: [line, n, first (row numbers), kept (row
  // numbers), flagged]; consecutive identical steps merged (Python 3.14 reports line 1, the set comprehension, seven
  // times); the last "line 12" step is dropped in favour of the "return" step after it.
  const TRACE = [[1, null, null, null, null], [2, null, null, null, null], [3, null, [], [], []], [4, 3, [], [], []], [5, 3, [], [], []], [7, 3, [], [], []], [10, 3, [], [], []], [11, 3, [3], [], []], [3, 3, [3], [3], []],
    [4, 9, [3], [3], []], [5, 9, [3], [3], []], [7, 9, [3], [3], []], [8, 9, [3], [3], []], [3, 9, [3], [3], [[9, 3]]],
    [4, 15, [3], [3], [[9, 3]]], [5, 15, [3], [3], [[9, 3]]], [6, 15, [3], [3], [[9, 3]]], [3, 15, [3], [3], [[9, 3], [15, "test"]]],
    [4, 5, [3], [3], [[9, 3], [15, "test"]]], [5, 5, [3], [3], [[9, 3], [15, "test"]]], [7, 5, [3], [3], [[9, 3], [15, "test"]]], [10, 5, [3], [3], [[9, 3], [15, "test"]]],
    [11, 5, [3, 5], [3], [[9, 3], [15, "test"]]], [3, 5, [3, 5], [3, 5], [[9, 3], [15, "test"]]], ["ret", 5, [3, 5], [3, 5], [[9, 3], [15, "test"]]]];
  // clean.out.txt, "ALL 20" lines: the same function on all twenty rows.
  const ALL_FLAGGED = [[9, 3], [11, 7], [15, "test"]];
  // to_row.out.txt, the RESULT line: the training row built from message u9 and its v2 reply.
  const ROW_OUT = { messages: [{ role: "system", content: "Route the customer message to one team. Reply with JSON." }, { role: "user", content: "Ikkita kitob buyurtma qilgandim, bittasi qutida yo'q. Pulini qaytarishingizni so'rayman." }, { role: "assistant", content: "{\"team\": \"Claims\"}" }] };

  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const word = n => WORDS[n] || String(n);
  const Word = n => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const agree = V => IDS.filter(i => V[i][0] === GOLD[i]).length;
  const wrongIds = V => IDS.filter(i => V[i][0] !== GOLD[i]);
  const langOf = id => LANG[id[0]];

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}quote { border-left: 3px solid var(--line); padding: 8px 12px; margin: 10px 0 4px; background: var(--surface); border-radius: 0 8px 8px 0; font-size: 15px; color: var(--ink-2); overflow-wrap: anywhere; }
      .${P}quote b { display: block; font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
      .${P}quote pre { margin: 0; font: 14px var(--mono); white-space: pre-wrap; color: var(--ink); }
      .${P}cap { font: 12px var(--mono); color: var(--muted); margin: 2px 0 10px; }
      .${P}en { display: block; font-size: 13px; color: var(--muted); margin-top: 3px; }
      .${P}sheet { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--surface); font-size: 15px; margin-top: 14px; }
      .${P}sheet h3 { font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
      .${P}sheet ul, .${P}sheet ol { margin: 0; padding-left: 20px; color: var(--ink-2); }
      .${P}sheet li { margin: 4px 0; overflow-wrap: anywhere; }
      .${P}pile { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; margin-top: 14px; }
      .${P}card { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
      .${P}card.on { border: 2px solid var(--ink); }
      .${P}card.bad { border-color: var(--bad); background: var(--bad-soft); }
      .${P}flag { display: block; width: 100%; min-height: 56px; text-align: left; font: inherit; font-size: 15px; color: var(--ink); background: none; border: 0; padding: 8px 12px; cursor: pointer; overflow-wrap: anywhere; }
      .${P}flag:disabled { cursor: default; }
      .${P}meta { display: flex; justify-content: space-between; gap: 8px; font: 12px var(--mono); color: var(--muted); margin-bottom: 4px; }
      .${P}meta b { color: var(--ink); }
      .${P}card.on .${P}flag > .${P}meta:first-child::after { content: "flagged"; font-weight: 700; color: var(--ink); }
      .${P}kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0 10px 10px; }
      .${P}kinds button { min-height: 44px; font: 13px var(--font); color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 4px 8px; cursor: pointer; }
      .${P}kinds button.on { border: 2px solid var(--ink); font-weight: 700; background: var(--sunk); }
      .${P}bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 14px; }
      .${P}bar .btn { min-height: 48px; font-size: 16px; }
      .${P}report { display: grid; gap: 6px; margin-top: 12px; }
      .${P}line { display: block; width: 100%; text-align: left; font: 14px var(--mono); color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; min-height: 44px; overflow-wrap: anywhere; }
      button.${P}line { cursor: pointer; }
      .${P}line.no { border-color: var(--bad); background: var(--bad-soft); }
      .${P}line.ok { border-color: var(--good); background: var(--good-soft); }
      .${P}line small { display: block; font: 13px var(--font); color: var(--muted); margin-top: 2px; }
      .${P}list { margin: 10px 0 0; padding-left: 20px; color: var(--ink-2); font-size: 15px; }
      .${P}list li { margin: 4px 0; }
    `;
    document.head.appendChild(s);
  }
  const quote = (label, text) => `<div class="${P}quote"><b>${esc(label)}</b>${esc(text)}</div>`;
  const rawQuote = (label, text) => `<div class="${P}quote"><b>${esc(label)}</b><pre>${esc(text)}</pre></div>`;
  const cap = extra => `<div class="${P}cap">Recorded model output, ${REC_DATE}.${extra ? " " + esc(extra) : ""}</div>`;
  const msgHtml = (text, en) => `${esc(text)}<span class="${P}en">In English: ${esc(en)}</span>`;
  const listSheet = (title, list) => `<div class="${P}sheet"><h3>${esc(title)}</h3><ul>${list.map(([t, d]) => `<li><b>${esc(t)}:</b> ${esc(d)}</li>`).join("")}</ul></div>`;
  const testSheet = () => `<div class="${P}sheet"><h3>Held-out test set (never trained on)</h3><ol>${TEST.map(t => `<li>${msgHtml(t.text, t.en)}</li>`).join("")}</ol></div>`;
  const caseBlock = (i, inner) => `<div class="lcase" id="c${i}">${inner}</div>`;
  const srcLabel = r => r.src === "log" ? "help desk: an agent's label" : r.src === "teacher" ? "teacher label" : "synthetic, written by the teacher";
  const labelTxt = r => r.conf == null ? r.label : `${r.label} · confidence ${r.conf}`;
  const pickOne = (el, sel, fn) => el.querySelectorAll(sel).forEach(b => b.onclick = () => fn(b));

  /* 1. The situation: a teacher labels the log, a student learns from the rows. */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "None worth checking: the large model routes better than the small one, so its labels are right",
      "The small model learns every row as the truth, wrong labels included: it has no other way to know what is right",
      "Training breaks: one small model cannot learn from three languages at once"
    ];
    const say = [
      "Better on average is not right on every row. A large model that misreads an instruction does it the same way on every similar message, and the small model learns that mistake as a rule.",
      "Right. The rows are the only thing the small model learns from. Whatever they say, it learns to say, mistakes included. So the work is in the rows.",
      "Nothing crashes over languages: the messages are text, like any other. The danger is quieter: rows that are wrong look exactly like rows that are right, and training learns both."
    ];
    const paint = () => {
      el.innerHTML = `<h1>A big model teaches a small one</h1>
        <p class="lead">A parcel delivery company gets customer messages in Uzbek, Russian and Korean. Each message must go to one team: <b>Delivery</b>, <b>Payments</b>, <b>Claims</b> or <b>Account</b>. A large hosted model routes them well, but every message is a paid call to an outside service.</p>
        <p class="lead">The plan: let the large model label last month's messages, then train (fine-tune) a small open model on them and run it in house. Each labelled message becomes one training <b>row</b>: the message plus its team. The large model is the <b>teacher</b>; the small one is the <b>student</b>. Training a small model on a large model's answers is often called <b>distillation</b> (the original method also uses the teacher's probabilities, not just its answers).</p>
        <p class="task">The team wants to train on every teacher-labelled row without reading any of them. What goes wrong?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 1)}</div>`;
      pickOne(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. By hand: flag the problems in twenty rows. */
  const KINDS = [["dup", "copy of another row"], ["contra", "contradicts another row"], ["test", "in the test set"], ["wrong", "wrong label"]];
  const KIND_NAME = Object.fromEntries(KINDS);
  const EXPECT = { 5: ["wrong"], 9: ["contra", "wrong"], 10: ["wrong"], 11: ["dup"], 15: ["test"] };
  const DUP_PAIR = [7, 11];
  const R = n => ROWS[n - 1];
  function problemsOf(flags) {
    const out = [], bad = new Set();
    const isDupOk = n => DUP_PAIR.includes(n) && flags[n] === "dup";
    const dupFlags = DUP_PAIR.filter(isDupOk);
    Object.keys(flags).map(Number).sort((a, b) => a - b).forEach(n => {
      const k = flags[n], r = R(n);
      if (!k) { out.push(`Row ${n} is flagged but has no problem picked. Tap one of the four buttons on it.`); bad.add(n); return; }
      if (DUP_PAIR.includes(n)) {
        if (k === "dup") return;
        out.push(`Row ${n}: rows 7 and 11 are the same message with the same label, Delivery, and Delivery is right. That is a copy, not a ${KIND_NAME[k]}.`); bad.add(n); return;
      }
      if (EXPECT[n]) {
        if (EXPECT[n].includes(k)) return;
        bad.add(n);
        if (n === 15) out.push(`Row 15's label, Delivery, is right, and the message is only once in the table. Look at where else it appears: test message 1 is the same text.`);
        else if (n === 9) out.push(`Row 9 has the same message as row 3, but a different label: ${R(9).label} against ${R(3).label}. That is more than a copy: the two rows contradict each other.`);
        else out.push(`Row ${n} appears only once and is not in the test set. Read its label against the rules: “${esc(r.en)}” is an item missing from the box, and the rules send that to Claims even when the customer wants money back. The teacher said ${r.label}.`);
        return;
      }
      bad.add(n);
      if (n === 3) out.push(`Rows 3 and 9 disagree, but row 3 is the right one: an agent routed it by the rules, and an item missing goes to Claims. Keep row 3 and flag the row that breaks the rules.`);
      else if (n === 12) out.push(`Row 12 is right. The order never arrived, and the rules send refunds for orders that never arrived to Payments. A refund request is not always a claim.`);
      else if (n === 16) out.push(`Row 16 is synthetic, but its label is right: a cover that arrived torn is a damaged parcel, so Claims. Synthetic rows are not wrong by default; you will see what to watch for later.`);
      else if (r.conf != null && r.conf < 0.95) out.push(`Row ${n} has the lower confidence, ${r.conf}, but the label is right: “${esc(r.en)}” goes to ${r.gold} by the rules. Judge the label by the rules, not by the number.`);
      else out.push(`Row ${n} is fine: “${esc(r.en)}” goes to ${r.gold} by the rules, and the label says ${r.label}.`);
    });
    if (dupFlags.length === 2) { out.push("Rows 7 and 11 are both flagged as copies. Remove one copy and keep the other, or the message is gone from training."); DUP_PAIR.forEach(n => bad.add(n)); }
    if (!dupFlags.length && !DUP_PAIR.some(n => flags[n])) out.push("Missing: one message appears twice with the same label.");
    if (!(9 in flags)) out.push("Missing: two rows have the same message but different labels. Find the pair and flag the one that breaks the rules.");
    if (!(15 in flags)) out.push("Missing: one training row is also in the held-out test set. Compare the rows with the test list.");
    const left = [5, 10].filter(n => !(n in flags)).length;
    if (left) out.push(`Missing: ${word(left)} more teacher label${left === 1 ? "" : "s"} break${left === 1 ? "s" : ""} the routing rules. Check each label against the rules, whatever its confidence.`);
    return { out, bad };
  }
  function byHand({ el, done, kit }) {
    style();
    const flags = {};
    let res = null, fin = false;
    const paint = () => {
      const bad = res ? res.bad : new Set();
      el.innerHTML = `<h1>Check the rows before training</h1>
        <p class="lead">Here are the first twenty rows of the training set. A few come from the help desk, where an agent routed the message by hand. Most were labelled by the teacher. With each label it also gave a confidence: its own guess, from 0 to 1, of how sure it is. One row's message was written by the teacher itself. Above the rows: the routing rules the support leads use. Below them: the six real messages kept aside to test the student.</p>
        ${listSheet("Routing rules", LIST_V2)}
        <p class="task">Tap each row that should not go into training as it is, then pick its problem. Then press Check my flags.</p>
        <div class="${P}pile">${ROWS.map(r => {
          const on = r.n in flags;
          return `<div class="${P}card${on ? " on" : ""}${bad.has(r.n) ? " bad" : ""}">
            <button type="button" class="${P}flag" data-i="${r.n}" ${fin ? "disabled" : ""}><span class="${P}meta"><span>Row ${r.n} · ${esc(srcLabel(r))}</span></span>${msgHtml(r.text, r.en)}<span class="${P}meta" style="margin:6px 0 0"><span>label <b>${esc(labelTxt(r))}</b></span></span></button>
            ${on && !fin ? `<div class="${P}kinds">${KINDS.map(([k, t]) => `<button type="button" data-k="${r.n}-${k}" class="${flags[r.n] === k ? "on" : ""}">${esc(t)}</button>`).join("")}</div>` : ""}
            ${on && fin ? `<div class="${P}kinds"><span class="${P}cap">${esc(KIND_NAME[flags[r.n]])}</span></div>` : ""}
          </div>`;
        }).join("")}</div>
        ${testSheet()}
        <div class="${P}bar"><span class="${P}cap">${Object.keys(flags).length} flagged</span>
          <button type="button" class="btn" data-check ${fin ? "disabled" : ""}>Check my flags</button></div>
        <div class="lpanel">
        ${res && res.out.length ? kit.feedback(`Not yet. ${res.out.join(" ")}`, false) : ""}
        ${res && !res.out.length && !Object.keys(flags).length ? kit.feedback("Nothing is flagged yet, but some rows should not go in as they are. Read each label against the routing rules, and compare the messages with each other and with the test list.", false) : ""}
        ${fin ? kit.feedback(`All found. A copy (row ${DUP_PAIR.find(n => flags[n])}), a contradiction (rows 3 and 9), a test message in training (row 15), and teacher labels that break the rules (rows ${[5, 9, 10].join(", ")}). Look at the confidence on the wrong labels: ${[5, 9, 10].map(n => R(n).conf).join(", ")}. The teacher was just as sure when it was wrong.`, true) : ""}</div>`;
      pickOne(el, `.${P}flag`, b => { const n = +b.dataset.i; if (n in flags) delete flags[n]; else flags[n] = null; res = null; paint(); });
      pickOne(el, `.${P}kinds button[data-k]`, b => { const [n, k] = b.dataset.k.split("-"); flags[+n] = k; res = null; paint(); });
      el.querySelector("[data-check]").onclick = () => {
        res = problemsOf(flags);
        if (!Object.keys(flags).length) res = { out: [], bad: new Set() };
        else if (!res.out.length) fin = true;
        paint();
        if (fin) done();
      };
    };
    paint();
  }

  /* 3. Spot the idea: confidence does not find wrong labels; the teacher followed a vague list. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const w1 = wrongIds(V1), n95 = IDS.filter(i => V1[i][1] === 0.95).length, low = IDS.filter(i => V1[i][1] < 0.95);
    const lowRight = low.filter(i => V1[i][0] === GOLD[i]).length;
    const same = ROWS.filter(r => r.src === "teacher" && MISSING.includes(r.id));
    const andList = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
    const sameAs = t => andList(same.filter(r => r.label === t).map(r => r.n));
    const opts = [
      "Keep only the labels with confidence 0.95, and drop the rest",
      "Compare a sample of teacher labels with labels people chose, find the pattern in the disagreements, fix the instructions, relabel and compare again",
      "Ask the teacher the same question twice and keep only the labels that come back the same"
    ];
    const say = [
      `The teacher labelled ${IDS.length} messages in this batch. ${Word(n95)} came back with 0.95, including all ${word(w1.length)} wrong ones. The ${word(low.length)} at 0.9 are ${lowRight === low.length ? "all" : lowRight} right. This filter keeps every mistake and drops ${word(lowRight)} good rows. The number is the teacher's guess about itself, not a check.`,
      `Right. A support lead routed all ${IDS.length} messages of this batch by the rules, and the teacher agreed on ${agree(V1)}. The ${word(w1.length)} disagreements share one pattern: an item missing, plus a request for money back. The short list says “Payments: charges and refunds” and “Claims: damaged parcels”, so the teacher did what the list said. The fix is in your instructions, and only a comparison with people's labels shows it.`,
      `Asking again checks whether the teacher is consistent, not whether it is right. With the same short list, a missing item with a refund request still reads as “refunds”, so the label can be the same wrong answer both times.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why was the teacher wrong?</h1>
        <p class="lead">The routing rules on the previous screen are what the support leads use. The team did not give them to the teacher. To save time, they wrote this short list in its instructions:</p>
        ${listSheet("What the teacher was told", LIST_V1)}
        <p class="lead">Here is the teacher's reply for row 5 (an Uzbek message: two books ordered, one missing, refund it):</p>
        ${rawQuote("The teacher answered", RAW["v1-u9"])}${cap("A large hosted model answered, with the short list.")}
        <p class="lead">Other rows in the table have the same problem. The teacher gave Claims to rows ${sameAs("Claims")}, but Payments to rows ${sameAs("Payments")}: the short list does not say which team a missing item with a refund request belongs to.</p>
        <p class="task">Before the teacher labels the rest of the log, what should the team do?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 1)}</div>`;
      pickOne(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it: predict the teacher's labels with the rewritten list, then see the recorded replies. */
  const PRED = [
    { id: "r8", no: { Payments: "That is what the short list gave. The new Claims line says “even when the customer asks for money back”.", Delivery: "The parcel arrived; nothing here is about where it is or when. An item is missing: the Claims line.", Account: "Nothing about logging in or the account. An item missing from a parcel is the Claims line." } },
    { id: "u9", no: { Payments: "Money back is asked for, but the new Claims line covers that case: an item missing, “even when the customer asks for money back”.", Delivery: "The parcel arrived. One book is missing from it: the Claims line.", Account: "Nothing about the account. A missing item is the Claims line." } },
    { id: "r7", no: { Claims: "Claims is for a parcel that arrived damaged or with an item missing. This order never arrived, and the Payments line names exactly that: refunds for orders that never arrived.", Delivery: "Close, since the order did not come. But the customer asks for a refund, and the Payments line covers refunds for orders that never arrived.", Account: "Nothing about the account. A refund for an order that never arrived is the Payments line." } },
    { id: "k7", no: { Payments: "A refund is asked for, but one cup is missing from the box: the Claims line, even with a money-back request.", Delivery: "The parcel came; one cup is missing from it. That is the Claims line.", Account: "Nothing about the account. An item missing is the Claims line." } }
  ];
  function predict({ el, done, kit }) {
    style();
    const ans = PRED.map(() => null);
    const right = PRED.map(p => TEAMS.indexOf(V2[p.id][0]));
    const paint = () => {
      const fin = PRED.every((_, i) => ans[i] === right[i]);
      el.innerHTML = `<h1>Rewrite the list, relabel, compare</h1>
        <p class="lead">The team gave the teacher the support leads' rules instead of the short list, and asked it again about all ${IDS.length} messages.</p>
        ${listSheet("What the teacher was told now", LIST_V2)}
        <p class="task">For each message, predict which team the teacher picks now. The recorded reply appears when you are right.</p>
        ${PRED.map((p, i) => caseBlock(i, `<p>${msgHtml(MSG[p.id], EN[p.id])}</p><p class="${P}cap">With the short list: ${esc(V1[p.id][0])}</p>
          ${kit.options(TEAMS, { picked: ans[i], correct: right[i] })}
          ${ans[i] == null ? "" : ans[i] === right[i] ? rawQuote("The teacher answered", RAW["v2-" + p.id]) + cap() : kit.feedback(esc(p.no[TEAMS[ans[i]]]), false)}`)).join("")}
        ${fin ? kit.feedback(`With the short list the teacher agreed with the support lead on ${agree(V1)} of ${IDS.length} messages; with the rules, on ${agree(V2)} of ${IDS.length}. ${wrongIds(V2).length ? "" : "Every disagreement is gone, and no right label turned wrong. "}This is the loop: compare with people's labels, find the pattern, fix the instructions, compare again. It costs one more pass of teacher calls, which is cheap next to training on wrong rows. Rows 5, 9 and 10 now get Claims; row 9 is still a copy of row 3, so it goes.`, true) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PRED.every((_, j) => ans[j] === right[j])) done();
      }));
    };
    paint();
  }

  /* 5. Broken on purpose: the student trained on the unchecked rows; why are two answers wrong? */
  const ROUTE_CODE = [
    "def route(msg, training_rows):",
    "    def score(row):",
    "        return similarity(msg, row[\"text\"])",
    "    best = max(training_rows, key=score)",
    "    return best[\"label\"], best, score(best)"
  ];
  const reportLine = (k, i, pick, cls) => {
    const [team, row, sim] = REPORT[k].lines[i], ok = team === TEST[i].label;
    const tag = pick ? "button" : "div";
    return `<${tag}${pick ? ' type="button"' : ""} class="${P}line${cls ? " " + cls : ""}" data-i="t${i + 1}">test ${i + 1} · expected ${esc(TEST[i].label)} · student ${esc(team)} · ${ok ? "ok" : "WRONG"} · nearest row ${row} · similarity ${sim}<small>${esc(TEST[i].en)}</small></${tag}>`;
  };
  function brokenLabels({ el, done, kit }) {
    style();
    let ans = null;
    const B = REPORT.before;
    const opts = [
      "The student is too simple to read Uzbek and Russian",
      "Rows 5 and 10: the student copied the teacher's wrong labels",
      "The test labels are wrong: these customers want money back, so Payments is right"
    ];
    const say = [
      `It found the right neighbours. Test 2's nearest row is row 5, a message about a missing book (similarity ${B.lines[1][2]}); test 3's is row 10, about a missing T-shirt (${B.lines[2][2]}). It copied their labels faithfully. The labels were wrong.`,
      `Right. The student did its job: it matched each test message to a row about a missing item and copied that row's label. Rows 5 and 10 said Payments, so it said Payments. A fine-tuned model is far more flexible than this, but it too learns its answers from the labels you give it.`,
      `The rules send an item missing to Claims, “even when the customer asks for money back”. The test labels follow the rules. The training labels do not.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: the student's report</h1>
        <p class="lead">Training a real small model needs a GPU. To see what unchecked rows teach without one, we used the simplest student there is: for a new message it finds the most similar training row and copies that row's label. Similarity counts the three-letter pieces of text two messages share: 1.00 means the same pieces, 0 means none in common. It trained on the twenty rows as they were, plus the other ${B.rows - ROWS.length} rows of the same batch, and was scored on the six test messages. This is its real report, from a run on our machine.</p>
        ${kit.code(ROUTE_CODE, -1)}
        <div class="${P}report">${TEST.map((_, i) => reportLine("before", i, false, B.lines[i][0] === TEST[i].label ? "" : "no")).join("")}</div>
        <p class="${P}cap">score: ${scoreOf("before")} of ${TEST.length}</p>
        <p class="task">Tests 2 and 3 went to Payments. What is the cause?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 1)}</div>`;
      pickOne(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: which pass is not a real pass? */
  function brokenLeak({ el, done, kit }) {
    style();
    let pick = null;
    const B = REPORT.before;
    const say = i => {
      const [team, row, sim] = B.lines[i], ok = team === TEST[i].label;
      if (i === 0) return null;
      if (!ok) return `Test ${i + 1} is a wrong answer you already traced to row ${row}. The question is about the passes: which one did the student get for free?`;
      return `Test ${i + 1}'s nearest row is row ${row}, a different message (similarity ${sim}). The student worked it out from a similar example: an honest pass.`;
    };
    const paint = () => {
      const fin = pick === 0;
      el.innerHTML = `<h1>A pass you cannot count</h1>
        <p class="lead">Same report. The team is pleased that the score is ${scoreOf("before")} of ${TEST.length} and wants to fix the two labels and ship.</p>
        <p class="task">Tap the test line whose “ok” proves nothing about the student.</p>
        <div class="${P}report">${TEST.map((_, i) => reportLine("before", i, !fin, pick === i ? (i === 0 ? "ok" : "no") : B.lines[i][0] === TEST[i].label ? "" : "")).join("")}</div>
        <div class="lpanel">
        ${pick == null ? "" : fin
          ? kit.feedback(`Right. Similarity ${B.lines[0][2]}: row 15 is test message 1, word for word. The student did not route it; it looked up the answer. This is <b>leakage</b>: a test row inside the training rows. After cleaning (copies and the test row out, rows 5 and 10 relabelled), the same student scores ${scoreOf("after")} of ${TEST.length}: tests 2 and 3 are now right, and test 1 is wrong (its nearest row is now row ${REPORT.after.lines[0][1]}, similarity ${REPORT.after.lines[0][2]}). That miss is honest: no training row asks about a courier who cannot find the address. Put row 15 back and the score jumps to ${scoreOf("leak")} of ${TEST.length}, a perfect score that hides the gap. The fix for test 1 is more real rows like it, not the test message.`, true)
          : kit.feedback(say(pick), false)}</div>`;
      pickOne(el, `button.${P}line`, b => { pick = +b.dataset.i.slice(1) - 1; paint(); if (pick === 0) done(); });
    };
    paint();
  }

  /* 7. The cleaning as code, a recorded trace of clean.py on rows 3, 9, 15 and 5. */
  const CODE = [
    "def clean(rows, test_set):",
    "    held_out = {norm(t) for t in test_set}",
    "    first, kept, flagged = {}, [], []",
    "    for n, row in rows:",
    "        key = norm(row[\"text\"])",
    "        if key in held_out:",
    "            flagged.append((n, \"test\"))",
    "        elif key in first:",
    "            flagged.append((n, first[key]))",
    "        else:",
    "            first[key] = n",
    "            kept.append(row)",
    "    return kept, flagged"
  ];
  const fmtRows = a => a == null ? "–" : a.length ? a.join(", ") : "none";
  const fmtFlag = a => a == null ? "–" : a.length ? a.map(([n, w]) => `(${n}, ${typeof w === "string" ? `"${w}"` : w})`).join(", ") : "[]";
  function stepSay(i) {
    const [ln, n] = TRACE[i];
    const r = n ? R(n) : null;
    if (ln === "ret") return `Done. Rows 3 and 5 are kept; rows 9 and 15 are flagged. On all twenty rows the same function flags ${ALL_FLAGGED.map(f => f[0]).join(", ")}: the contradiction, the copy and the test row. It keeps rows 5 and 10. Their text is new and clean; only their label is wrong, and no text check can see that. Wrong labels need the comparison with people's labels from screen 4.`;
    if (ln === 1) return "<code>rows</code> holds four rows of the table as (row number, row) pairs: rows 3, 9, 15 and 5. <code>norm</code> lower-cases a text and squeezes its spaces, so “Hello  World” and “hello world” count as the same. Next: put every test message, normalised, into a set.";
    if (ln === 2) return "<code>held_out</code> is ready. Next: <code>first</code> will remember the row number where each text was first seen.";
    if (ln === 3) return n == null ? "Start the loop over the rows." : `Back to the top of the loop. Kept so far: ${fmtRows(TRACE[i][3])}.`;
    if (ln === 4) return `Row ${n} (${esc(srcLabel(r))}, label ${esc(r.label)}). Its text is normalised into <code>key</code>.`;
    if (ln === 5) return `Is row ${n}'s text one of the test messages?`;
    if (ln === 6) return `Yes: row ${n} is test message 1. Flag it as (${n}, "test"); it must not be trained on.`;
    if (ln === 7) return `Not a test message. Has this text been seen in an earlier row?`;
    if (ln === 8) return `Yes: row ${n} has the same text as row ${TRACE[i][2][0]}, so it is flagged as (${n}, ${TRACE[i][2][0]}): the row and the row it repeats. The code does not know which label is right. Here it keeps row 3 only because row 3 came first; a person decides contradictions by the rules.`;
    if (ln === 10) return `New text. Remember that it was first seen in row ${n}.`;
    if (ln === 11) return `Keep row ${n}.${n === 5 ? " Its label, Payments, is the teacher's wrong one, and nothing here can tell." : ""}`;
    return "";
  }
  function asCode({ el, done, kit }) {
    style();
    let i = 0;
    const last = TRACE.length - 1;
    const paint = () => {
      const [ln, n, first, kept, flagged] = TRACE[i];
      el.innerHTML = `<h1>The same cleaning, in Python</h1>
        <p class="lead">Three of the problems you flagged can be found by code. This is a real run, replayed, on four rows of the table.</p>
        <p class="task">Step through the run to the end. Watch <code>kept</code> and <code>flagged</code>.</p>
        ${kit.code(CODE, ln === "ret" ? 12 : ln)}
        <div class="vars"><span>n <b>${n == null ? "–" : n}</b></span><span>first <b>${first == null ? "–" : first.length ? "texts of rows " + first.join(", ") : "{}"}</b></span><span>kept <b>${kept == null ? "–" : "rows " + fmtRows(kept)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        <div class="vars"><span>flagged <b>${esc(fmtFlag(flagged))}</b></span></div>
        ${kit.feedback(stepSay(i))}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === last ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === last) done(); };
    };
    paint();
  }

  /* 8. The row itself: what the student should learn to answer. */
  function rowFormat({ el, done, kit }) {
    style();
    let ans = null;
    const n95 = IDS.filter(i => V2[i][1] === 0.95).length;
    const opts = ["The reply exactly as it came, fence and all", "{\"team\": \"Claims\", \"confidence\": 0.95}", "{\"team\": \"Claims\"}"];
    const say = [
      `The student learns to reply with the fence too. The code that reads its reply calls <code>json.loads</code>, which fails on the first backtick. All ${FENCED} recorded replies came in a fence, so the student would see it on every row.`,
      `The 0.95 is the teacher's guess about itself. With the new list, ${n95} of ${IDS.length} replies said 0.95. The student would learn to print a number that measures nothing about its own answer.`,
      "Right. The assistant turn is exactly what you want the student to answer, and nothing else. This is the row our run built from row 5's message (to_row.py):"
    ];
    const paint = () => {
      el.innerHTML = `<h1>What the student learns to say</h1>
        <p class="lead">A training row for a chat model is a short conversation: the instruction, the customer message, and the answer the student should give. Here is the teacher's reply for row 5 with the new list. The JSON sits inside a fence: the <code>\`\`\`json</code> and <code>\`\`\`</code> lines that Markdown puts around code.</p>
        ${rawQuote("The teacher answered", RAW["v2-u9"])}${cap()}
        <p class="task">What goes in the answer part (the assistant turn) of the training row?</p>
        <div class="lpanel">${kit.options(opts.map(o => `<code>${esc(o)}</code>`), { picked: ans, correct: 2 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 2)}
        ${ans === 2 ? `${rawQuote("One training row", JSON.stringify(ROW_OUT, null, 1))}<p class="lead">This <code>messages</code> list of <code>role</code> and <code>content</code> is the conversational format Hugging Face TRL's SFTTrainer reads. Other tools use a different layout for the same three parts. The same function turned all ${FENCED} recorded replies into rows and rejected none.</p>` : ""}</div>`;
      pickOne(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 9. Synthetic rows: where they may go. */
  function synthetic({ el, done, kit }) {
    style();
    let ans = null;
    const trail = SYNTH_LINES.filter(l => / {2}$/.test(l)).length, q = SYNTH_LINES.filter(l => l.trim().endsWith("?")).length;
    const opts = ["Into training, after a person reads each one", "Into the test set, because the test set has no Korean Claims message either", "Into both, so training and testing see the same kind of message"];
    const say = [
      `Right. Synthetic rows can fill a gap in training. Read them first: each is labelled Claims because you asked for Claims, not because anyone checked. They also need cleaning like any row: ${word(trail)} of the ${word(SYNTH_LINES.length)} lines came back ending in two spaces, and ${word(q)} of the ${word(SYNTH_LINES.length)} end with the same kind of question about what happens next. Real customers vary more than that, so keep synthetic rows a minority and drop near-copies.`,
      "A test set must look like real traffic. Messages written by the teacher test how well the student copies the teacher's style, and they hide how it does on real customers. Collect real Korean Claims messages for the test set, even a few.",
      "Then the test set contains messages from the same writer, in the same style, as the training rows: a softer kind of leakage. The score goes up without the student getting better at real messages. Synthetic rows: training only."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Filling a gap with synthetic rows</h1>
        <p class="lead">The log has very few Korean messages for Claims. The team asked the teacher to write six new ones, giving it two real Korean Claims messages as examples. It answered:</p>
        <div class="${P}quote"><b>The teacher answered</b><ol style="margin:0;padding-left:20px">${SYNTH_LINES.map((l, i) => `<li>${msgHtml(l.trim(), SYNTH_EN[i])}</li>`).join("")}</ol></div>${cap("A large hosted model answered, at a higher sampling temperature.")}
        <p class="task">Where should these six rows go?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 0)}</div>`;
      pickOne(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 10. The big picture. */
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "A team routes millions of short messages a month into a few fixed teams. A large model does it well, but the calls cost too much and add delay",
      "A team's refund rules change every month, and the router must follow the newest rule from the day it changes",
      "A small shop gets about forty messages a day, and the large model's bill is not a problem"
    ];
    const say = [
      "Right. A fixed, narrow task with high volume: label a lot of real messages with the teacher, check a sample against people, clean, and train the small model. The calls you save pay for the work.",
      "A trained model keeps the rule it was trained on until you build a new set and train again. A rule that changes monthly belongs in the prompt or in plain code, not in the weights.",
      "At this volume the large model's cost is small and it already works. Building, checking and retraining a dataset is more work than it saves. Keep the prompt."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to build a teacher-labelled set</h1>
        <ul class="${P}list">
          <li><b>What it is for:</b> giving a small model the behaviour of a large one on one narrow task, using real messages labelled by the teacher.</li>
          <li><b>Reach for it</b> when the task is fixed, the volume is high, and you have many real unlabelled examples plus people who can check a sample.</li>
          <li><b>Not for</b> facts or rules that change often: use retrieval or the prompt. Not when a prompt on the large model is already cheap enough.</li>
          <li><b>What it costs:</b> teacher calls for every row, people's time to label a check sample, cleaning, a test set of real messages, and the same work again whenever the rules change. Read the teacher provider's terms on using its outputs for training.</li>
        </ul>
        <p class="task">Which team should build a teacher-labelled training set?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : kit.feedback(say[ans], ans === 0)}</div>`;
      pickOne(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 11. Recognise it in new situations. */
  const CASES = [
    ["A law firm wants a small in-house model to tag contract clauses by type. Partners have tagged 150 clauses; 20,000 are untagged. A large model could tag the rest.", true,
      "Yes. Let the large model tag the 20,000, compare its tags with the partners' 150, look for a pattern in the disagreements, fix the tag definitions, then clean and train. Keep some of the partners' clauses aside as the test set.",
      "This is the delivery company again: a fixed set of tags, many real untagged examples, and 150 tags by people to check the teacher against. Teacher labels plus a checked sample is the right tool."],
    ["A shop's assistant must tell customers how many of each item are in stock right now.", false,
      "No. Stock changes every hour. Rows built today are wrong tomorrow, so the stock number cannot live in the training rows: read it from the stock database at answer time (a tool call or retrieval).",
      "Training bakes answers into the model. Stock levels change every hour, so any row is stale the next day. The number must come from the stock database when the customer asks."],
    ["A team's fine-tuned router scores 99% on its test set, but routes badly in production. The test set was written by the same large model that labelled the training rows.", true,
      "Yes, this lesson is the fix. The test set is not real traffic: build it from real messages labelled by people, check it for overlap with the training rows, and score again. Expect a lower, honest number.",
      "The score is the symptom. A test set written by the teacher measures how well the student copies the teacher. Build the test set from real messages labelled by people, remove any overlap with training, and score again."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is this a dataset job?</h1>
        <p class="lead">${Word(CASES.length)} situations away from the parcels. The question each time: is building or fixing a checked, cleaned training set (teacher labels, people's sample, real test messages) the right move?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => caseBlock(i, `<p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}`)).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <ul class="${P}list">
        <li>Label real messages with a teacher model, then check a sample against people's labels, per language and per team, before you trust the rest.</li>
        <li>When the teacher is wrong in a pattern, fix the label definitions in its instructions, relabel, and compare again. Its confidence number does not find the mistakes.</li>
        <li>Remove copies, settle contradictions by the rules, and keep every test message out of training. Store only the exact answer the student should give.</li>
        <li>Use synthetic rows to fill gaps in training only; test on real messages.</li>
      </ul>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. It takes a cleaned set like this one and trains a real small model on it.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5c-tuning-dataset", {
    title: "Building a dataset: real, synthetic and distilled",
    checked: "2026-11-13",
    sources: [
      "https://huggingface.co/docs/trl/dataset_formats",
      "https://arxiv.org/abs/1503.02531",
      "https://arxiv.org/abs/2212.10560",
      "https://arxiv.org/abs/2107.06499",
      "https://scikit-learn.org/stable/common_pitfalls.html"
    ],
    interview: [{
      q: "You need a small model that classifies support tickets, and you plan to label 20,000 tickets with a large model and train on them. How do you make sure the training data is good?",
      good: [
        "Have people label a few hundred tickets and compare them with the large model's labels, per class and per language",
        "Look for a pattern in the disagreements and fix the label definitions in the instructions, then relabel and compare again",
        "Remove duplicates, settle contradicting labels by the written rules, and drop any ticket that is also in the test set",
        "Keep the test set real and labelled by people; synthetic examples go into training only",
        "Store only the exact output the small model should give, not the teacher's raw reply or its confidence"
      ],
      weak: "Use the strongest model available as the labeller and keep only labels with high confidence. That misses mistakes the model is sure about, which come from unclear label definitions, and says nothing about leaks or copies."
    }, {
      q: "Your fine-tuned classifier scores 98% on its test set, but users say it routes badly. What do you check first?",
      good: [
        "Whether test examples, or near-copies of them, are also in the training set",
        "Whether the test set is real traffic labelled by people, or was written or labelled by the same model as the training set",
        "Which kinds of message fail in production, and whether the training set has real examples of them",
        "Whether the training labels follow the current rules, by comparing a sample with people's labels"
      ],
      weak: "Train longer or switch to a bigger base model. That ignores that the 98% may be measuring a leak, not the model."
    }],
    screens: [situation, byHand, spotIdea, predict, brokenLabels, brokenLeak, asCode, rowFormat, synthetic, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-check]"],
        right: ['[data-i="5"]', '[data-k="5-wrong"]', '[data-i="9"]', '[data-k="9-contra"]', '[data-i="10"]', '[data-k="10-wrong"]', '[data-i="11"]', '[data-k="11-dup"]', '[data-i="15"]', '[data-k="15-test"]', "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: PRED.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="t4"]'], right: ['[data-i="t1"]'] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
