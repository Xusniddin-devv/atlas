/* Lesson s5c-choose-open-model: Choosing an open model.
   Story: Hanul Semiconductor (made up), a chip plant in Korea. Its maintenance team writes short logs in Korean after
   every repair, and the managers want a one-sentence summary of each. The logs may not leave the site, so the model
   must run on the plant's own server: an open model. Three candidates are on the shortlist (as they stood on
   2026-11-14): SmolLM2 135M Instruct, Gemma 3 270M and DeepSeek-V3.
   Ideas: (1) cross out by hard limits first (data stays on site, a licence legal accepts, fits the hardware), then
   rank the survivors by YOUR test on YOUR data, not by leaderboard rank or the card's language list; read the
   answers, because a test made of keyword checks can pass a model that only copies; (2) "open" licences differ:
   some add use rules that you must pass on; and when an open model on your own hardware is the wrong choice.
   Depth: explain (screens 1-5, 9 and the interview), when-not (screens 6, 7, 8).
   Data, all real:
   - docs/ai-path/runs/s5c-choose-open-model/test_set.json: the eight made-up Korean logs and their checks, written
     before any model ran (CASES below, copied unchanged).
   - run_local.py -> local-smollm2-135m.json, local-gemma3-270m.json, run_local.out.txt: the two small models run on
     this Mac through Ollama 0.15.4 (temperature 0, seed 0, at most 150 tokens). Copied unchanged into ANS.smol / ANS.gemma.
     Both are quantized builds, not the original weights: SmolLM2 as a third-party 4-bit GGUF
     (hf.co/bartowski/SmolLM2-135M-Instruct-GGUF:Q4_0), Gemma as Ollama's 8-bit gemma3:270m (Q8_0); the captions say so.
   - Recordings (scripts/ai/record.mjs, openrouter, deepseek/deepseek-chat, temperature 0, 2026-11-14) in the main
     checkout, docs/ai-path/recordings/s5c-choose-open-model/big-k01..k08.json: a hosted copy of the open DeepSeek-V3
     weights (allowed only because the logs are made up). Copied unchanged into ANS.big.
   - score.py -> score.out.txt: the scores. The lesson recomputes every score with the same rules (check()).
   English glosses of Korean text are our own translations, marked as such.
   Lesson-local style (<style id="lx-s5c-choose-open-model">): recorded-text blocks, check chips, the decision table,
   licence excerpts. Plain browser script. */
(() => {
  const ID = "s5c-choose-open-model", P = "lx-" + ID + "-";
  const RUN_DATE = "2026-11-14";
  const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = n => WORDS[n] || String(n);
  const Cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- The test set (test_set.json, unchanged; written for the lesson, not model output) ---------- */
  const SYSTEM = "당신은 반도체 공장의 정비 기록을 요약합니다. 기록을 한국어 한 문장으로 요약하세요. 설비 번호, 문제, 조치를 꼭 포함하세요.";
  const SYSTEM_EN = "You summarise maintenance logs of a chip plant. Summarise the log in one Korean sentence. Always include the equipment number, the problem and the action.";
  const CASES = [
    { id: "k01", log: "10월 2일 야간. ETCH-07 챔버 압력이 기준보다 높게 올라가 알람 발생. 리크 테스트 결과 도어 O-링 손상 확인. O-링 교체 후 압력 정상, 03:40 생산 재개.", equipment: "ETCH-07", part: ["O-링", "오링"], action: ["교체"] },
    { id: "k02", log: "10월 3일 주간. CVD-03 히터 온도가 존별로 8도 이상 차이 남. 점검 결과 2번 존 열전대 단선. 열전대 교체 후 온도 편차 1도 이내로 회복.", equipment: "CVD-03", part: ["열전대"], action: ["교체"] },
    { id: "k03", log: "10월 5일 야간. CMP-12 슬러리 유량이 계속 떨어짐. 공급 라인 필터가 막혀 있었음. 필터 교체하고 라인 세척 후 유량 정상.", equipment: "CMP-12", part: ["필터"], action: ["교체", "세척"] },
    { id: "k04", log: "10월 6일 주간. PHOTO-05 웨이퍼 정렬 오류가 한 시간에 네 번 반복됨. 스테이지 위치 센서 렌즈에 오염 발견. 센서 렌즈 청소 후 정렬 오류 없음.", equipment: "PHOTO-05", part: ["센서"], action: ["청소", "세정"] },
    { id: "k05", log: "10월 8일 야간. IMP-02 빔 전류가 불안정하게 흔들림. 이온 소스 필라멘트 수명 초과로 판단. 필라멘트 교체 후 빔 전류 안정.", equipment: "IMP-02", part: ["필라멘트"], action: ["교체"] },
    { id: "k06", log: "10월 9일 주간. WET-09 약액 온도 상한 알람 반복. 냉각수 밸브가 반쯤 열린 채 고착되어 있었음. 밸브 수리 후 온도 정상 범위 유지.", equipment: "WET-09", part: ["밸브"], action: ["수리", "교체"] },
    { id: "k07", log: "10월 11일 야간. ETCH-04 RF 반사파가 높게 나옴. 매칭 박스 내부 커패시터 불량 확인. 매칭 박스 교체 후 반사파 정상.", equipment: "ETCH-04", part: ["매칭", "커패시터"], action: ["교체"] },
    { id: "k08", log: "10월 12일 주간. CVD-08 웨이퍼 파티클 수가 평소의 세 배로 늘어남. 챔버 내벽에 증착물이 두껍게 쌓여 있었음. 챔버 세정(PM) 후 파티클 수 정상.", equipment: "CVD-08", part: ["챔버", "증착물"], action: ["세정", "청소", "클리닝", "PM"] }
  ];
  // our translations, for the learner (not model output)
  const GLOSS = {
    k01: "2 Oct, night. ETCH-07 chamber pressure rose above the limit, alarm. Leak test: door O-ring damaged. O-ring replaced, pressure normal, production restarted 03:40.",
    k02: "3 Oct, day. CVD-03 heater temperature differs by more than 8 degrees between zones. Inspection: thermocouple in zone 2 broken. Thermocouple replaced, difference back within 1 degree.",
    k03: "5 Oct, night. CMP-12 slurry flow keeps dropping. Supply-line filter was clogged. Filter replaced and line flushed, flow normal."
  };

  /* ---------- The answers (unchanged; see the header for where each came from) ---------- */
  // ANS.smol: local-smollm2-135m.json, ANS.gemma: local-gemma3-270m.json (Ollama on this Mac, 2026-11-14)
  // ANS.big: recordings s5c-choose-open-model/big-k01..k08 (provider openrouter, model deepseek/deepseek-chat,
  //          answered by deepseek/deepseek-chat via DeepInfra, recorded 2026-11-14)
  const ANS = {
    smol: ["10월 2일 안 동안 신어 기록 환회에 만들어 주세요. 위장함, 손상공장은 03:40 신어 결곡 확인 도마치 일이 여부햄리. 위장함, 손상공", "20-30일 마트, 8강 규칛학이 적용되어 있다. 을부문 플로신 2개 열전대 단선, 10-15일 규칛학이 적용되어 있다. 을부문 플로신 2개 열전", "10-5-2019, CMP-12 슬러리 유량이 계속 떨어짐. 필터 교체가 막혀 있었음, 인식 후 유량 정상이 종료됨. CMP-12 슬러리 유량 반복해 겹은 30%가 ", "10-6, 2:30pm - 4:30am (화기)\n이 보단시에 센서 렌즈를 포함하세요. 스테이지 위치 센서 렌즈가 2:30pm - 4:30am을 거북, 이동함에 심액 후 정렬 오", "10-2: IMP-03 소스 8개 신은 일과, 조치를 포함하세요. 미탈드 교체 후 빔 전류 안정. 10-3: IMP-04 소스 8개 신은 일, 조치를 포함하세요. 미탈", "10-9-2018, 10:30 - 11:00 PM 주간. WET-09 약액 온도 상한 알람 반복. 다음 이번 정상 범위 유지 기능 활용, 조치를 사용하거니다. 10-9-2018, 11:30 -", "10-23개 일, ETCH-04 RF 반사파를 학슈에 기다로 설비 포함하세요. 신은 박스 내부 커패시터 불량 확인, 일공 규칛 10-23개 의 상햙. 조치를 꼭", "10-23 년 9,000 깅자공지능을 일으로 요약합니다. 챔버 파티클 수 분리, 10-23 년 9,000 깅자공지능을 일으로 요약합니다.\n\n파티클 수 평"],
    gemma: ["반도체 공장 정비 기록: 10월 2일 야간. ETCH-07 챔버 압력 기준보다 높게 올라가 알람 발생. 리크 테스트 결과 도어 O-링 손상 확인. O-링 교체 후 압력 정상, 03:40 생산 재개.", "반도체 공장 정비 기록: 10월 3일 주간. CVD-03 히터 온도가 존별로 8도 이상 차이 남. 점검 결과 2번 존 열전대 단선. 열전대 교체 후 온도 편차 1도 이내로 회복.", "10월 5일 야간. CMP-12 슬러리 유량이 계속 떨어짐. 공급 라인 필터가 막혀 있었음. 필터 교체하고 라인 세척 후 유량 정상.", "10월 6일 주간. PHOTO-05 웨이퍼 정렬 오류가 한 시간에 네 번 반복됨. 스테이지 위치 센서 렌즈에 오염 발견. 센서 렌즈 청소 후 정렬 오류 없음.", "10월 8일 야간. IMP-02 빔 전류 불안정하게 흔들림. 이온 소스 필라멘트 수명 초과로 판단. 필라멘트 교체 후 빔 전류 안정.", "반도체 공장 정비 기록: 10월 9일 주간. WET-09 약액 온도 상한 알람 반복. 냉각수 밸브가 반쯤 열린 채 고착되어 있었음. 밸브 수리 후 온도 정상 범위 유지.", "10월 11일 야간. ETCH-04 RF 반사파가 높게 나옴. 매칭 박스 내부 커패시터 불량 확인. 매칭 박스 교체 후 반사파 정상", "반도체 공장 정비 기록: 10월 12일 주간. CVD-08 웨이퍼 파티클 수가 평소의 세 배로 늘어남. 챔버 내벽에 증착물이 두껍게 쌓여 있었음. 챔버 세정(PM) 후 파티클 수 정상."],
    big: ["ETCH-07 설비에서 챔버 압력이 기준보다 높아 알람이 발생하였으며, 리크 테스트 결과 도어 O-링이 손상된 것을 확인하고 교체한 후 압력이 정상으로 회복되어 03:40에 생산을 재개하였습니다.", "설비 번호 CVD-03에서 히터 온도가 존별로 8도 이상 차이가 발생하여 점검한 결과, 2번 존 열전대가 단선된 것을 확인하고 열전대를 교체한 후 온도 편차가 1도 이내로 회복되었습니다.", "10월 5일 야간, 설비 번호 CMP-12에서 슬러리 유량이 지속적으로 감소하는 문제가 발생하였으며, 공급 라인 필터가 막혀 있었습니다. 이에 필터를 교체하고 라인을 세척한 후 유량이 정상으로 회복되었습니다.", "설비 번호 PHOTO-05에서 웨이퍼 정렬 오류가 한 시간에 네 번 발생하였으며, 스테이지 위치 센서 렌즈에 오염이 발견되어 청소 후 정렬 오류가 해결되었습니다.", "10월 8일 야간, 설비 번호 IMP-02에서 빔 전류가 불안정하게 흔들리는 문제가 발생하였으며, 이온 소스 필라멘트 수명 초과로 판단되어 필라멘트를 교체한 후 빔 전류가 안정화되었습니다.", "설비 번호 WET-09에서 약액 온도 상한 알람이 반복적으로 발생하였으며, 원인은 냉각수 밸브가 반쯤 열린 채 고착된 것이었습니다. 밸브를 수리한 후 온도가 정상 범위로 유지되었습니다.", "10월 11일 야간, 설비 번호 ETCH-04에서 RF 반사파가 높게 나오는 문제가 발생하였으며, 매칭 박스 내부 커패시터 불량을 확인하고 매칭 박스를 교체하여 반사파를 정상으로 복구하였습니다.", "CVD-08 설비에서 웨이퍼 파티클 수가 평소의 세 배로 증가한 문제가 발생하였으며, 이는 챔버 내벽에 증착물이 두껍게 쌓인 것이 원인으로 확인되었습니다. 챔버 세정(PM)을 실시한 후 파티클 수가 정상으로 회복되었습니다."]
  };
  const GLOSS_BIG = {
    0: "At ETCH-07, chamber pressure rose above the limit and set off an alarm; a leak test found the door O-ring damaged, it was replaced, pressure recovered and production restarted at 03:40.",
    2: "On the night of 5 Oct, at equipment CMP-12, slurry flow kept falling, and the supply-line filter was clogged. So the filter was replaced and the line flushed, after which the flow returned to normal."
  };

  /* ---------- The candidates: facts from their official pages (checked 2026-11-14) ---------- */
  // size in millions of parameters; licence status follows the plant's rule (story): a standard open-source licence is
  // approved at once, a licence with its own use rules goes to legal review first.
  const MODELS = [
    { key: "smol", name: "SmolLM2 135M", sizeM: 135, sizeTxt: "135 million parameters", where: "ran on a laptop (this lesson's run)",
      lic: "Apache 2.0", licOk: true, licWhy: "grants use, change and sharing; no list of forbidden uses",
      card: "Its card: “SmolLM2 models primarily understand and generate content in English.”" },
    { key: "gemma", name: "Gemma 3 270M", sizeM: 270, sizeTxt: "270 million parameters", where: "ran on a laptop (this lesson's run)",
      lic: "Gemma Terms of Use", licOk: false, licWhy: "forbids uses listed in a separate Prohibited Use Policy, and you must pass that rule on",
      card: "Its family's card: “multilingual support in over 140 languages”, but it shows multilingual results only for the larger sizes, none for 270M." },
    { key: "big", name: "DeepSeek-V3", sizeM: 671000, sizeTxt: "671 billion parameters in total (37 billion used for each token)", where: "its own run instructions use two machines with eight GPUs each",
      lic: "DeepSeek Model License (the MIT badge on its page is for the code only)", licOk: false, licWhy: "forbids uses listed in its Attachment A, and you must pass that rule on",
      card: "Its card compares it on public benchmarks with other large models." }
  ];
  const SERVER_LIMIT_M = 30000; // story: the IT team's limit for the plant's one server, about 30 billion parameters
  const fits = m => m.sizeM <= SERVER_LIMIT_M;

  /* ---------- Scoring: the same rules as score.py ---------- */
  const sents = t => t.trim().split(/[.!?](?:\s|$)/).filter(s => s.trim());
  function check(c, ans) {
    const hangul = (ans.match(/[가-힣]/g) || []).length, latin = (ans.match(/[A-Za-z]/g) || []).length;
    const logS = sents(c.log).map(s => s.trim()).filter(s => s.length >= 15);
    return {
      korean: hangul > 0 && hangul / (hangul + latin) >= 0.5,
      equipment: ans.includes(c.equipment),
      part: c.part.some(p => ans.includes(p)),
      action: c.action.some(a => ans.includes(a)),
      one_sentence: sents(ans).length <= 1,
      not_copy: logS.filter(s => ans.includes(s)).length * 2 < logS.length
    };
  }
  const FIRST = ["korean", "equipment", "part", "action"], SECOND = [...FIRST, "one_sentence", "not_copy"];
  const SC = {};
  for (const m of MODELS) {
    const per = CASES.map((c, i) => check(c, ANS[m.key][i]));
    SC[m.key] = {
      per,
      first: per.filter(r => FIRST.every(k => r[k])).length,
      second: per.filter(r => SECOND.every(k => r[k])).length,
      count: k => per.filter(r => r[k]).length
    };
  }
  const N = CASES.length;
  const doesJob = key => { const s = SC[key]; return s.count("not_copy") === N && s.per.every(r => FIRST.every(k => r[k])); };
  const COPIES = ANS.gemma.filter((a, i) => a.includes(CASES[i].log)).length;
  const bigTwo = SC.big.per.map((r, i) => r.one_sentence ? null : i).filter(i => i != null);
  const smolWrongIds = ANS.smol.map(a => (a.match(/[A-Z]{3,5}-\d{2}/g) || [])).flat().filter((x, i, a) => a.indexOf(x) === i && !CASES.some(c => c.equipment === x));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P.slice(0, -1))) return;
    const s = document.createElement("style");
    s.id = P.slice(0, -1);
    s.textContent = `
      .${P}rec { margin: 8px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 8px; font: 500 14px/1.6 var(--font); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}gloss { margin: 6px 0 0; font-size: 14px; line-height: 1.45; color: var(--ink-2); }
      .${P}who { margin: 18px 0 0; font-weight: 600; font-size: 15.5px; color: var(--ink); }
      .${P}chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
      .${P}chips button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: 500 14.5px/1.2 var(--font); cursor: pointer; }
      .${P}chips button[aria-pressed="true"] { border-color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
      .${P}chips button[aria-pressed="true"]::before { content: "✓ "; }
      .${P}chips button.bad { border-color: var(--bad); box-shadow: inset 0 0 0 1.5px var(--bad); }
      .${P}rules { margin: 10px 0 0; padding-left: 20px; font-size: 15.5px; line-height: 1.5; }
      .${P}rules li { margin: 4px 0; }
      .${P}card { margin: 16px 0 0; padding: 12px; border: 1px solid var(--line); border-radius: 10px; }
      .${P}card h3 { margin: 0; font-size: 16.5px; }
      .${P}ev { margin: 6px 0 0; font-size: 14.5px; line-height: 1.45; color: var(--ink-2); }
      .${P}ev b { color: var(--ink); }
      .${P}q { margin: 12px 0 0; font-size: 15px; font-weight: 600; }
      .${P}card .lopts { margin-top: 6px; }
      .${P}card .lopts button { padding: 10px 14px; font-size: 15.5px; }
      .${P}card .lopts button[aria-pressed="true"]:not(.right):not(.wrong) { border-color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--ink); }
      .${P}tbl { width: 100%; margin: 14px 0 0; border-collapse: collapse; table-layout: fixed; font-size: 14px; }
      .${P}tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding-bottom: 6px; }
      .${P}tbl th, .${P}tbl td { border-bottom: 1px solid var(--line); padding: 7px 4px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      .${P}tbl th { font-weight: 600; color: var(--ink-2); font-size: 13px; }
      .${P}tbl td.ok { color: var(--good); } .${P}tbl td.bad { color: var(--bad); }
      .${P}tbl td.ok::before { content: "✓ "; } .${P}tbl td.bad::before { content: "✗ "; }
      .${P}quote { margin: 10px 0 0; padding: 8px 12px; border-left: 3px solid var(--line); font-size: 14.5px; line-height: 1.5; color: var(--ink); }
      .${P}quote small { display: block; margin-top: 4px; color: var(--muted); font-size: 12.5px; }
      .${P}check { margin-top: 16px; min-height: 48px; }
      @media (max-width: 520px) { .${P}tbl { font-size: 13px; } }
    `;
    document.head.appendChild(s);
  }
  const rec = (kit, text) => `<div class="${P}rec" lang="ko">${kit.esc(text)}</div>`;
  const capLocal = () => `<p class="${P}cap">Model output from our run on a laptop (Ollama, quantized build, which stores the weights in fewer bits: 4-bit for SmolLM2, 8-bit for Gemma), ${RUN_DATE}</p>`;
  const capRec = () => `<p class="${P}cap">Recorded model output, ${RUN_DATE}</p>`;
  const capOf = key => key === "big" ? capRec() : capLocal();
  const gloss = t => `<p class="${P}gloss"><i>Our translation:</i> ${t}</p>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  function oneQ(el, done, kit, { head, opts, right, fb }) {
    let ans = null;
    const paint = () => {
      el.innerHTML = `${head()}<div class="lpanel">${ask(kit, opts, right, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }
  function multiPick(el, done, kit, { head, items, opts }) {
    const ans = items.map(() => null);
    const paint = () => {
      el.innerHTML = `${head()}
        ${items.map((it, i) => `<div class="lcase" id="c${i}"><p>${it.q}</p>${ask(kit, it.opts || opts, it.right, ans[i], it.fb)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (items.every((it, j) => ans[j] === it.right)) done();
      }));
    };
    paint();
  }
  function sequence(el, done, kit, { head, qs }) {
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k >= qs.length, q = qs[Math.min(k, qs.length - 1)];
      el.innerHTML = `${head(k)}
        ${qs.slice(0, k).map(x => kit.feedback(x.after(), true)).join("")}
        ${fin ? "" : `${q.extra ? q.extra() : ""}<p class="task">${q.q}</p><div class="lpanel">${kit.options(q.opts, { picked: wrong, correct: q.right, num: !!q.num })}${wrong != null ? kit.feedback(q.fb[wrong], false) : ""}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== qs[k].right) { wrong = i; paint(); return; }
        wrong = null; k++; paint();
        if (k >= qs.length) done();
      });
    };
    paint();
  }
  const numOpts = (right, others) => [...new Set([right, ...others])].filter(v => v >= 0 && v <= N).sort((a, b) => a - b);
  const byKey = k => MODELS.find(m => m.key === k);

  /* 1. The situation, and grading three real answers to one log by hand. */
  const CHIPS = [
    { k: "equipment", label: "ETCH-07", what: "the equipment code ETCH-07" },
    { k: "part", label: "O-링 (O-ring)", what: "the part, O-링" },
    { k: "action", label: "교체 (replaced)", what: "the action, 교체" },
    { k: "korean", label: "Hangul letters", what: "mostly Hangul (Korean letters)" }
  ];
  function gradeByHand({ el, done, kit }) {
    ensureStyle();
    const c = CASES[0];
    const marks = {}; MODELS.forEach(m => { marks[m.key] = new Set(); });
    let checked = false, passed = false, msgs = [];
    const truth = key => { const r = check(c, ANS[key][0]); return new Set(CHIPS.filter(ch => r[ch.k]).map(ch => ch.k)); };
    const paint = () => {
      el.innerHTML = `<h1>Three models, one maintenance log</h1>
        <p class="lead">Hanul Semiconductor (a made-up chip plant in Korea) has its maintenance team write a short log in Korean after every repair. The managers want a one-sentence summary of each. The logs may not leave the site, so the model must run on the plant's own server. That means an <b>open model</b>: one whose weights you can download and run yourself.</p>
        <p class="lead">There are hundreds of open models. This lesson is about how to pick one for a job. The team shortlisted three (as they stood on ${RUN_DATE}): SmolLM2 135M, Gemma 3 270M and DeepSeek-V3. It wrote eight made-up logs and gave each model this instruction (in Korean): “${kit.esc(SYSTEM_EN)}”</p>
        <p class="lead">Log 1:</p>${rec(kit, c.log)}${gloss(GLOSS.k01)}
        <p class="task">You do not need to read Korean. For each answer, tap the checks it passes: does the text contain each string, and is it mostly Hangul? Then check your marks.</p>
        ${MODELS.map(m => `<p class="${P}who">${kit.esc(m.name)}</p>${rec(kit, ANS[m.key][0])}${capOf(m.key)}
          <div class="${P}chips" id="g-${m.key}">${CHIPS.map(ch => {
            const on = marks[m.key].has(ch.k), bad = checked && !passed && on !== truth(m.key).has(ch.k);
            return `<button type="button" data-t="${m.key}-${ch.k}" aria-pressed="${on}" class="${bad ? "bad" : ""}">${kit.esc(ch.label)}</button>`;
          }).join("")}</div>`).join("")}
        <div class="lpanel">
          ${passed ? "" : `<button type="button" class="btn ${P}check" id="check">Check my marks</button>`}
          ${checked ? (passed
            ? kit.feedback(`Right. Gemma 3 270M and DeepSeek-V3 pass all four checks on this log. SmolLM2 passes only the Hangul check, and that check is too weak: to a Korean reader its text is not a summary and mostly not meaningful Korean. These four checks are the team's first test. They ran it on all ${word(N)} logs: SmolLM2 passed ${SC.smol.first} of ${N}, Gemma 3 270M ${SC.gemma.first} of ${N}, DeepSeek-V3 ${SC.big.first} of ${N}.<p class="${P}gloss"><i>DeepSeek-V3's answer, our translation:</i> ${GLOSS_BIG[0]}</p>`, true)
            : kit.feedback(msgs.join(" "), false)) : ""}
        </div>`;
      el.querySelectorAll(`.${P}chips button`).forEach(b => b.onclick = () => {
        if (passed) return;
        const [key, k] = b.dataset.t.split("-");
        const s = marks[key]; s.has(k) ? s.delete(k) : s.add(k);
        paint();
      });
      const ch = el.querySelector("#check");
      if (ch) ch.onclick = () => {
        checked = true; msgs = [];
        for (const m of MODELS) {
          const t = truth(m.key);
          for (const chip of CHIPS) {
            const on = marks[m.key].has(chip.k);
            if (on && !t.has(chip.k)) msgs.push(`${m.name}'s answer does not contain ${chip.what}${chip.k === "equipment" ? " (look for the Latin letters: it has only a time, 03:40)" : ""}, so “${chip.label}” should not be marked.`);
            if (!on && t.has(chip.k)) msgs.push(`${m.name}'s answer passes “${chip.label}”: it contains ${chip.what}. Mark it.`);
          }
        }
        passed = msgs.length === 0;
        if (MODELS.every(m => !marks[m.key].size)) msgs = ["Nothing is marked yet, so every check counts as failed. Look for ETCH-07, O-링 and 교체 in each answer: you can match their shapes without reading Korean."];
        if (!passed && msgs.length > 3) msgs = [...msgs.slice(0, 3), `And ${msgs.length - 3} more marks to fix (they are outlined).`];
        paint(); if (passed) done();
      };
    };
    paint();
  }

  /* 2. The tie: read the answers, fix the test, predict the new score. */
  function readTheTie({ el, done, kit }) {
    ensureStyle();
    const c = CASES[1], g = ANS.gemma[1];
    const prefix = g.slice(0, g.indexOf(c.log)).trim();
    const o2 = numOpts(SC.big.second, [N, SC.big.second - 3, 2]).map(String);
    sequence(el, done, kit, {
      head: () => `<h1>A tie at ${N} of ${N}</h1>
        <p class="lead">On the first test Gemma 3 270M ties DeepSeek-V3 at ${SC.gemma.first} of ${N}. Yet it has ${byKey("gemma").sizeTxt} and DeepSeek-V3 has ${Math.round(byKey("big").sizeM / 1000)} billion: it is thousands of times smaller. Before anyone celebrates, read one of its answers next to its log.</p>
        <p class="lead">Log 2:</p>${rec(kit, c.log)}${gloss(GLOSS.k02)}<p class="${P}who">Gemma 3 270M's answer</p>${rec(kit, g)}${capLocal()}`,
      qs: [
        { q: "What did Gemma 3 270M do with log 2?",
          opts: ["Summarised it in one sentence", "Translated it into simpler Korean", "Pasted the log back, behind a heading", "Dropped the action and kept the problem"], right: 2,
          fb: ["Count the sentences: the answer has as many as the log. Compare them character by character.", "Compare the two texts: after the first few words they are the same, character for character.", null, "The action is there (열전대 교체, thermocouple replaced), because the whole log is there."],
          after: () => `Right. The answer is the heading “${kit.esc(prefix)}” (“Semiconductor plant maintenance log:”, words taken from the instruction) followed by the log, unchanged. In ${COPIES} of ${N} answers the whole log appears unchanged; the other ${word(N - COPIES)} differ from their log only by one missing syllable or full stop. The four checks looked for words, and a copy contains every word. The test was too easy, not the model good. This is the golden-set lesson again: when a score looks too good, read the answers.` },
        { q: `To the four <b>content checks</b> (code, part, action, Hangul) the team adds two more: <b>one sentence</b>, and <b>not a copy</b> (it fails when half or more of the log's sentences appear unchanged). On this second test, how many of the ${N} DeepSeek-V3 answers will pass all six checks?`,
          opts: o2, num: true, right: o2.indexOf(String(SC.big.second)),
          fb: o2.map(o => +o > SC.big.second ? `Fewer. DeepSeek-V3 rewrote every log in its own words, but it did not always keep to one sentence.` : `More. It passes the four content checks on every log and copies none; only one of the new checks catches it.`),
          after: () => `Right: ${SC.big.second} of ${N}. All ${N} pass the content checks and none is a copy. ${Cap(word(bigTwo.length))} answers are two sentences instead of one, like log 3:${rec(kit, ANS.big[2])}${capRec()}${gloss(GLOSS_BIG[2])}That is a prompt problem the team can work on, not a sign the model cannot do the job. Gemma 3 270M now scores ${SC.gemma.second} of ${N} and SmolLM2 ${SC.smol.second} of ${N}. SmolLM2 even named machines that are not in any log (${smolWrongIds.map(kit.esc).join(", ")}).` }
      ]
    });
  }

  /* 3. The decision table, filled by hand from the evidence. */
  const COLS = [
    { k: "lic", q: "Licence", opts: ["Approved at once", "Legal review first"], right: m => m.licOk ? 0 : 1 },
    { k: "fit", q: "Fits the plant's server", opts: ["Yes", "No"], right: m => fits(m) ? 0 : 1 },
    { k: "job", q: "Right code, part and action, in its own words", opts: ["Yes", "No"], right: m => doesJob(m.key) ? 0 : 1 }
  ];
  const testLine = m => {
    const s = SC[m.key];
    return `content checks passed on ${s.per.filter(r => FIRST.every(k => r[k])).length} of ${N} logs; copied the log in ${N - s.count("not_copy")}; one sentence in ${s.count("one_sentence")} (all six checks: ${s.second} of ${N})`;
  };
  const FB3 = {
    lic: m => m.licOk ? `${m.name} is under ${m.lic}, a standard open-source licence: it lets you use, change and share the model, with no list of forbidden uses. The plant's rule approves it at once.`
      : m.key === "big" ? `Read past the badge: the MIT licence covers DeepSeek-V3's code. The weights are under the DeepSeek Model License, which has use-based restrictions. That goes to legal review.`
      : `${m.name} comes under the ${m.lic}: Google's own terms, with a Prohibited Use Policy you must follow and pass on. That is not a standard open-source licence, so it goes to legal review.`,
    fit: m => fits(m) ? `${m.sizeTxt}: far under the server's limit of about 30 billion. It even ran on a laptop.` : `${m.sizeTxt}. The server holds about 30 billion. Its own run instructions use two machines with eight GPUs each.`,
    job: m => doesJob(m.key) ? `It rewrote every log with the right code, part and action, and copied none. Its misses on the six-check test are about length (two sentences), which the prompt can fix, so they do not decide this column.`
      : m.key === "gemma" ? `It copied the logs: the not-a-copy check failed on ${N - SC.gemma.count("not_copy")} of ${N}. Passing the word checks was not doing the job.`
      : `Wrong machine codes and text that is mostly not meaningful Korean: ${SC.smol.second} of ${N}.`
  };
  function decisionTable({ el, done, kit }) {
    ensureStyle();
    const picks = MODELS.map(() => COLS.map(() => null));
    let checked = false, passed = false, nOk = 0;
    const total = MODELS.length * COLS.length;
    const paint = () => {
      const left = picks.flat().filter(p => p == null).length;
      el.innerHTML = `<h1>Fill the decision table</h1>
        <p class="lead">The plant's rules, from the people who own each limit:</p>
        <ul class="${P}rules">
          <li><b>Security:</b> the logs stay on site, so the model runs on the plant's own server.</li>
          <li><b>IT:</b> that server can hold a model of up to about 30 billion parameters (the next lesson shows how to work this out).</li>
          <li><b>Legal:</b> a standard open-source licence is approved at once. A licence with its own use rules goes to legal review first.</li>
          <li><b>The team:</b> the model must write the right code, part and action in its own words (the content checks and the not-a-copy check). Length is a prompt fix, so the one-sentence check does not decide this column.</li>
        </ul>
        <p class="task">For each model, mark the three questions from the evidence in its box. Then check your table.</p>
        ${MODELS.map((m, i) => `<div class="${P}card" id="m${i}"><h3>${kit.esc(m.name)}</h3>
          <p class="${P}ev"><b>Licence:</b> ${kit.esc(m.lic)}, ${kit.esc(m.licWhy)}.</p>
          <p class="${P}ev"><b>Size:</b> ${kit.esc(m.sizeTxt)}; ${kit.esc(m.where)}.</p>
          <p class="${P}ev"><b>Test:</b> ${testLine(m)}.</p>
          ${COLS.map((col, j) => {
            const p = picks[i][j], r = col.right(m), ok = p === r;
            return `<p class="${P}q">${col.q}</p><div class="lopts" id="m${i}c${j}">${col.opts.map((t, o) => `<button type="button" data-i="${o}"${o === r ? " data-right" : " data-wrong"} aria-pressed="${p === o}" class="${checked && p === o ? (ok ? "right" : "wrong") : ""}">${t}</button>`).join("")}</div>
              ${checked && p != null && !ok ? kit.feedback(FB3[col.k](m), false) : ""}`;
          }).join("")}</div>`).join("")}
        <div class="lpanel">
          ${passed ? "" : `<button type="button" class="btn ${P}check" id="check" ${left ? "disabled" : ""}>${left ? `Mark every cell first (${left} left)` : checked ? "Check again" : "Check my table"}</button>`}
          ${checked ? (passed
            ? `<table class="${P}tbl"><caption>The plant's decision table</caption><thead><tr><th>model</th>${COLS.map(c => `<th>${c.q}</th>`).join("")}</tr></thead><tbody>${MODELS.map(m => `<tr><td>${kit.esc(m.name)}</td>${COLS.map(c => { const r = c.right(m); return `<td class="${r === 0 ? "ok" : "bad"}">${c.opts[r]}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`
              + kit.feedback(`Right, all ${total} cells. Look along the rows: no model passes every column. The two that fit the server fail the job. The one that does the job does not fit, and its licence needs review. The next screen asks how the plant could have reached this table with less work.`, true)
            : kit.feedback(`${nOk} of ${total} cells right. The ones marked as mistakes say why; change them and check again.`, false)) : ""}
        </div>`;
      el.querySelectorAll(`.${P}card`).forEach((card, i) => COLS.forEach((_, j) => card.querySelectorAll(`#m${i}c${j} button`).forEach(b => b.onclick = () => {
        if (passed) return;
        picks[i][j] = +b.dataset.i; paint();
      })));
      const ch = el.querySelector("#check");
      if (ch) ch.onclick = () => {
        checked = true;
        nOk = MODELS.reduce((a, m, i) => a + COLS.filter((c, j) => picks[i][j] === c.right(m)).length, 0);
        passed = nOk === total; paint(); if (passed) done();
      };
    };
    paint();
  }

  /* 4. Spot the idea: the order of the questions. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    oneQ(el, done, kit, {
      head: () => `<h1>Why not the leaderboard?</h1>
        <p class="lead">The plant manager saw the table and says: “DeepSeek-V3 is the strongest of the three on public benchmarks. Take it, and stop testing.” A <b>benchmark</b> is a shared set of test tasks. A public <b>leaderboard</b> ranks models by their benchmark scores.</p>
        <p class="task">Which way of choosing would have got the plant to an answer with the least wasted work?</p>`,
      opts: [
        "Rank by leaderboard, then check the licence and size of the top one",
        "Cross out models that break a hard limit (data stays on site, licence, fits the hardware), then test the rest on your own logs, and take the smallest that does the job",
        "Run your own test on every model you can find, then look at licence and size",
        "Read the languages each maker lists for its model, and take the largest model that lists Korean"
      ],
      right: 1,
      fb: [
        ["The top of a leaderboard is often a model you cannot run: here the strongest broke the server limit. And a leaderboard scores someone else's tasks and data. It knows nothing of your logs, your licence rules or your server.", false],
        [`Right. A model that breaks a <b>hard limit</b> is out, however well it scores, so check those first: they are quick to read from the card and the licence. Then the survivors face <b>your</b> test on <b>your</b> data, because that is the only score about your job. Among the ones that pass, the smallest is cheapest to run. A leaderboard is at most a way to find candidates.`, true],
        ["Your test is the score that counts, but it is the costly step: setting up each model, running it, reading every answer. Here DeepSeek-V3 passed the test and still cannot run on the server. Cross out by the cheap checks first.", false],
        [`A maker's language list is a claim, not a test of your job. Gemma 3's <b>model card</b> (the maker's page about the model) claims over 140 languages for the family but shows multilingual results only for the larger sizes, and your test found the 270M copying. ${kit.esc(byKey("smol").card)}`, false]
      ]
    });
  }

  /* 5. Pick, and say what would change your mind. */
  function decide({ el, done, kit }) {
    ensureStyle();
    sequence(el, done, kit, {
      head: () => `<h1>Pick, and say what would change your mind</h1>
        <p class="lead">No candidate passed every column. A decision still has to go to the plant, with the facts that would change it.</p>`,
      qs: [
        { q: "What does the team recommend?",
          opts: ["SmolLM2 135M: its licence is clean and it fits", "Gemma 3 270M: it fits, and its scores were best on the first test", "DeepSeek-V3 on the current server", "None of these three yet: look for mid-size open models that fit the server and have a licence legal accepts, and run the same eight logs on them"], right: 3,
          fb: ["It passes the two cheap columns and fails the one that matters: it wrote wrong machine codes and text that is mostly not meaningful Korean.", "Its first-test score came from copying the logs. On the second test it scored " + SC.gemma.second + " of " + N + ".", "It does not fit: the server holds about 30 billion parameters and DeepSeek-V3 has 671 billion.", null],
          after: () => `Right. The shortlist did its work. It ruled out all three for today, each with evidence, and the test showed the job is possible: one model did it. Now the search goes to mid-size models: bigger than the two small ones, small enough for the server. The same eight logs are ready to run on each.` },
        { q: "What new fact would make DeepSeek-V3 the right pick?",
          opts: ["It climbs higher on a public leaderboard", "A cloud service offers it at a low price per call", "The plant pays for servers that can hold it, and legal accepts its licence", "Its card adds Korean to its list of languages"], right: 2,
          fb: ["Its rank was never the problem. It failed the size column and waits on the licence column; a better rank changes neither.", "The logs may not leave the site, so a cloud service is out at any price. The test used a hosted copy only because the logs were made up.", null, "You already tested its Korean on your own logs, which tells you more than any list."],
          after: () => `Right. Name the columns that failed and what would turn each one: “bigger hardware and a licence approval, and DeepSeek-V3 is our pick.” Then the plant can weigh that cost against the search for a smaller model.` },
        { q: "And what could put Gemma 3 270M back on the list?",
          opts: ["Nothing: a model that small can never write summaries", "Fine-tuning it on summaries the plant writes, then passing the same second test", "A longer context window"], right: 1,
          fb: ["Google introduces the 270M as built for task-specific fine-tuning on a narrow job. Whether it works for these logs is what your test would tell you.", null, "The logs are only a few lines. It had room for them; the problem was what it did with them."],
          after: () => `Right. Google introduces Gemma 3 270M as built for task-specific fine-tuning, and one narrow, high-volume job is that kind of task. It would still need legal's approval, and the plant would need good example summaries to train on (the fine-tuning lessons showed the cost). Either way, the same test decides.` }
      ]
    });
  }

  /* 6. Licences: what "open" lets you do. */
  const LIC = [
    { name: "Apache 2.0 (SmolLM2)", text: "“each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare Derivative Works of, publicly display, publicly perform, sublicense, and distribute the Work and such Derivative Works in Source or Object form.”", from: "Apache License 2.0, section 2" },
    { name: "Gemma Terms of Use (Gemma 3)", text: "“You must not use any of the Gemma Services: for the restricted uses set forth in the Gemma Prohibited Use Policy … You must include the use restrictions referenced in Section 3.2 as an enforceable provision in any agreement … governing the use and/or distribution of Gemma or Model Derivatives”", from: "Gemma Terms of Use, sections 3.2 and 3.1" },
    { name: "DeepSeek Model License (DeepSeek-V3)", text: "“You agree not to use the Model or Derivatives of the Model: … For military use in any way; …” and the use-based restrictions “MUST be included as an enforceable provision by You in any type of legal agreement (e.g. a license) governing the use and/or distribution of the Model or Derivatives of the Model”", from: "DeepSeek License Agreement, Attachment A and paragraph 4a" }
  ];
  function licences({ el, done, kit }) {
    ensureStyle();
    const yn = ["Yes", "No"];
    multiPick(el, done, kit, {
      head: () => `<h1>“Open” is not one licence</h1>
        <p class="lead">All three models are <b>open weights</b>: you can download them and run them yourself. What you may do with them is set by each licence. Short excerpts from the three, unchanged (… marks a cut):</p>
        ${LIC.map(l => `<div class="${P}quote"><b>${kit.esc(l.name)}</b><br>${kit.esc(l.text)}<small>${kit.esc(l.from)}</small></div>`).join("")}
        <p class="task">Answer from the excerpts. Legal decides in the end; this is about what the text says.</p>`,
      items: [
        { q: "Does Apache 2.0 add rules about <b>what you may use</b> the model for?", opts: yn, right: 1,
          fb: [["Read the grant again: it lists what you may do (copy, change, share) and adds no list of uses you may not. Its conditions are about keeping the licence and notices when you share it.", false], ["Right. Apache 2.0 grants the rights with no use restrictions. That is why the plant's legal team approves it at once.", true]] },
        { q: "Does the Gemma Terms of Use add rules about what you may use the model for?", opts: yn, right: 0,
          fb: [["Right. Its use is bound to the Prohibited Use Policy, a separate page the terms point to. Legal has to read that too.", true], ["“You must not use any of the Gemma Services: for the restricted uses …” is a rule about use.", false]] },
        { q: "Later the plant fine-tunes DeepSeek-V3 and sells a tool with it inside to other chip plants. What must its contract with those customers contain?",
          opts: ["Nothing: a fine-tuned model is a new model", "The licence's use restrictions, as an enforceable provision", "The plant's training data"], right: 1,
          fb: [["The licence covers “Derivatives of the Model”, which it defines to include “all modifications to the Model”. A fine-tuned model is one.", false], ["Right. The restrictions travel with the model and with anything made from it. Gemma's terms say the same. With Apache 2.0 you would pass on the licence text and notices, but no use restrictions.", true], ["Nothing in the excerpt asks for training data. It asks for the use restrictions to be in the agreement.", false]] }
      ]
    });
  }

  /* 7. The big picture: what an open model on your own hardware is for, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    oneQ(el, done, kit, {
      head: () => `<h1>Your own model: what it buys and costs</h1>
        <ul class="${P}rules">
          <li><b>What for:</b> data that may not leave your site, working with no internet, full control over the model and its version, and fine-tuning it on your own data.</li>
          <li><b>How to choose:</b> hard limits first, then your own test, then the smallest model that passes.</li>
          <li><b>When not:</b> if the data may go to a provider under a contract, a hosted model is usually faster to start and often stronger. If the job is exact (pull a code out of a text), use code, not a model.</li>
          <li><b>Costs:</b> hardware bought up front, people to run it, reading every licence, and a test you run again whenever you change model or prompt.</li>
        </ul>
        <p class="task">The plant has chosen a model and installed it. Which cost is the easiest to forget when the decision is made?</p>`,
      opts: ["The server: buying the GPU machine, installing it, and the power and cooling it needs", "Keeping it running: updates, monitoring, and running the test again for every new model version or prompt change", "A fee for every summary: a charge each time the plant asks the model for one"],
      right: 1,
      fb: [
        ["The server is the cost everyone sees: it is on the order form. What follows the purchase is what gets forgotten.", false],
        ["Right. Someone must patch the server, watch it, and swap in newer models. Each swap means the eight-log test (grown into a bigger one by then) runs again before the plant trusts it. That is ongoing people-time, not a one-off purchase.", true],
        ["On your own hardware there is no per-call fee: you pay for the server, its power and the people, whether it is busy or idle. Per-call fees are what a hosted model charges.", false]
      ]
    });
  }

  /* 8. Recognise it in new situations, including two where an open model is not the answer. */
  const CASES8 = [
    { q: "A hospital wants summaries of doctors' notes in Korean. The notes may not go to any outside service, and the hospital has a GPU server.", right: 0,
      fb: [["Right. Data that cannot leave is the clearest case. Then the same steps: cross out by licence and size, build a test from real (protected) notes, take the smallest that passes.", true], ["The notes may not leave the hospital, so a hosted model is ruled out. An open model on its own server is the way.", false]] },
    { q: "A two-person startup writes product descriptions from its public catalogue. It has no GPU and nobody to run servers, and wants the best quality this week.", right: 1,
      fb: [["Nothing here needs an own model: the text is public, and there is no hardware and nobody to run it. A hosted model gets them going this week, paying per call.", false], ["Right. The data is public, so nothing forces it on site. A server would cost them hardware and people they do not have. Start with a hosted model and an eval; revisit if volume or rules change.", true]] },
    { q: "A cargo ship's engineers want help reading Korean equipment manuals at sea, with no internet for weeks, on a laptop.", right: 0,
      fb: [["Right. No internet means the model must run on board. A small open model, chosen with a test made from the real manuals.", true], ["A hosted model needs a connection, and the ship has none for weeks. Only a model running on board works.", false]] },
    { q: "Hanul's managers also want a count of faults per machine. Every log already names its machine by a code such as ETCH-07.", right: 1,
      fb: [["No model is needed: the code has a fixed shape, so one regular expression finds it in every log, exactly and for free. A model could misread or invent a code (SmolLM2 did).", false], ["Right. This is not a language job. A regular expression pulls out the code exactly; no model, open or hosted, can beat that.", true]] }
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    multiPick(el, done, kit, {
      opts: ["Open model, own hardware", "Hosted model or plain code"], items: CASES8,
      head: () => `<h1>Your own model, or not?</h1>
        <p class="lead">Three situations away from the chip plant, and one back at it. Ask: must the data or the work stay on site? Is it a language job at all?</p>
        <p class="task">Decide for each one.</p>`
    });
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can shortlist an open model</h1>
      <p class="lead">You graded real answers, caught a test that rewarded copying, and filled a decision table from licences, sizes and your own scores. Cross out by hard limits first: data, licence, hardware. Then test the rest on your own data and read the answers. Pick the smallest model that passes, and write down what would change your mind. A leaderboard can suggest candidates. It cannot choose for you.</p>
      <p class="lead">Reach for your own open model when the data must stay on site or there is no internet. Skip it when a hosted model is allowed, or when plain code can do the job exactly. The cost is the hardware, the people who run it, and a test you run again on every change.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}${/[.?!]$/.test(nx.title) ? "" : "."} Here the IT team told you what the server holds. Next you work it out yourself: memory for the weights, plus the memory each conversation needs.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Choosing an open model",
    checked: "2026-11-14",
    sources: [
      "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct",
      "https://www.apache.org/licenses/LICENSE-2.0",
      "https://ai.google.dev/gemma/terms",
      "https://ai.google.dev/gemma/docs/core/model_card_3",
      "https://developers.googleblog.com/en/introducing-gemma-3-270m/",
      "https://huggingface.co/deepseek-ai/DeepSeek-V3",
      "https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/LICENSE-MODEL",
      "https://openrouter.ai/deepseek/deepseek-chat"
    ],
    interview: [
      {
        q: "Your company must run an LLM on its own servers to summarise internal support tickets written in Korean. A manager wants the model at the top of a public leaderboard. How do you choose?",
        good: [
          "Start from the hard limits: data stays on site, a licence legal accepts (check for use restrictions, not just “open”), and what our hardware can hold",
          "Cross out every candidate that breaks one of them before testing anything",
          "Build a small test from real tickets with checks per case, run the survivors, and read the answers, not just the score",
          "Pick the smallest model that passes, since it is cheapest to run",
          "Write down what would change the choice: more hardware, a licence approval, a new model passing the test"
        ],
        weak: "Take the leaderboard leader, or the biggest model that fits, without checking the licence or testing it on our own tickets."
      },
      {
        q: "On your test, a tiny open model scores 100%, the same as a model a thousand times bigger. What do you do before recommending it?",
        good: [
          "Be suspicious of the tie and read a sample of its answers",
          "Check whether the checks test the job or only the presence of words: a copy of the input passes word checks",
          "Add checks for the job itself (length, not a copy) and have a native speaker review a sample",
          "Rerun every candidate on the improved test before deciding"
        ],
        weak: "Recommend the tiny model because it is cheaper and scored the same, without looking at what it wrote."
      }
    ],
    screens: [gradeByHand, readTheTie, decisionTable, spotIdea, decide, licences, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#check"], right: ['[data-t="smol-korean"]', ...["gemma", "big"].flatMap(k => CHIPS.map(c => `[data-t="${k}-${c.k}"]`)), "#check"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: [...MODELS.flatMap((_, i) => COLS.map((_, j) => `#m${i}c${j} [data-wrong]`)), "#check"], right: [...MODELS.flatMap((_, i) => COLS.map((_, j) => `#m${i}c${j} [data-right]`)), "#check"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: [0, 1, 2].map(i => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES8.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
