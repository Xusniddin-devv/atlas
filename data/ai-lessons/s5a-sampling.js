/* Lesson s5a-sampling: temperature, top-p and how the next token is picked.
   Story: a car rental desk runs one reply generator for two jobs, damage-report codes (must be the same every
   time) and friendly welcome notes. Someone raised the temperature to make the notes livelier, and the same
   damage report came back with a different code.
   Ideas: (1) the model gives the same scores every run; the generator turns them into probabilities and draws
   one token at random, so the draw is where the variety comes from. (2) temperature reshapes the probabilities
   and top-p cuts the unlikely tail before the draw; choose them per task, and know what they cannot fix.
   Data:
   - recordings (main checkout) docs/ai-path/recordings/s5a-sampling/: code-t2-s1..s5, code-t0-s1..s5,
     note-t1-s1..s3 (a small hosted model through OpenRouter, 2026-11-13);
   - runs docs/ai-path/runs/s5a-sampling/: scores.py -> scores.out.txt (next-token log-probabilities and real
     draws from a tiny local model, gemma3:270m in Ollama), sampler.py -> sampler.out.txt (the from-scratch
     picker, traced). env.txt has the versions.
   Every number on screen is computed here from LOGPROBS or copied from those files. Plain browser script. */
(() => {
  const ID = "s5a-sampling", P = "lx-" + ID + "-";
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  const seedRange = a => a.length > 1 ? `seeds ${a[0]} to ${a[a.length - 1]}` : `seed ${a[0]}`;

  /* ---------- Recorded material ---------- */
  // From docs/ai-path/recordings/s5a-sampling/code-t2-s1..s5.json and code-t0-s1..s5.json (whole answers, not altered).
  // The same request each time; only "temperature" and "seed" differ.
  const REC_CODE = {
    src: "s5a-sampling/code-t2-s1..s5, code-t0-s1..s5",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    system: "You write damage codes for a car rental desk. Codes: SCR = scratch, DNT = dent, CRK = crack, CHP = chip. Reply with exactly one code and nothing else.",
    user: "Report: dent in the rear bumper, and the paint on it is scraped off.",
    seeds: [1, 2, 3, 4, 5],                                              // request "seed" of run 1..5 (both temperatures)
    hot: { temperature: 2, runs: ["DNT", "SCR", "DNT", "DNT", "DNT"] },
    cold: { temperature: 0, runs: ["DNT", "DNT", "DNT", "DNT", "DNT"] }
  };
  // From docs/ai-path/recordings/s5a-sampling/note-t1-s1..s3.json (whole answers, not altered).
  const REC_NOTE = {
    src: "s5a-sampling/note-t1-s1..s3",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13", temperature: 1,
    seeds: [1, 2, 3],                                                    // request "seed" of note 1..3
    runs: [
      "Welcome, Ms. Lee! Your grey hatchback awaits in bay 4; your keys are at the desk.",
      "Welcome, Ms. Lee! Your grey hatchback awaits in bay 4; your keys are ready at the desk.",
      "Welcome, Ms. Lee! Your grey hatchback is ready for you in bay 4."
    ]
  };
  // From docs/ai-path/runs/s5a-sampling/scores.out.txt, part 1 (welcome): the 10 most likely next tokens after
  // the prompt below, from gemma3:270m on this Mac, as log-probabilities. Part 2 of the same run: the returned
  // log-probabilities were the same at temperature 0, 0.5 and 1.5 (largest gap 0.0).
  const PROMPT = "Welcome to Riverside Car Rental. Your car is parked in bay 4 and the keys are at the desk. Have a";
  const LOGPROBS = [[" great", -0.615], [" wonderful", -1.5108], [" good", -2.0316], [" nice", -3.4505], [" pleasant", -4.136],
    [" safe", -4.1549], [" fantastic", -4.3376], [" lovely", -4.8743], [" relaxing", -6.126], [" friendly", -6.3292]];
  // Same run, part 1 and part 3 (damage): the tiny model's top pick with a code list in the prompt, and its 10 draws at temperature 0.
  const TINY_CODE = { top: [[" CR", -0.3783], [" SCR", -1.6803], [" D", -2.2906]], cold: Array(10).fill(" CR") };

  const N = LOGPROBS.length;
  const WORD = LOGPROBS.map(([t]) => t.trim());
  const SCORE = LOGPROBS.map(([, s]) => s);
  // softmax of score / temperature over the 10 candidates (log-probabilities differ from the model's raw scores
  // by one constant, so this is the model's own softmax, shared among these 10)
  const soft = T => { const z = SCORE.map(s => s / T), m = Math.max(...z), e = z.map(v => Math.exp(v - m)), t = e.reduce((a, b) => a + b, 0); return e.map(v => v / t); };
  // top-p: walk from the most likely down, keep tokens until the running total reaches p (same rule as np.searchsorted in sampler.py)
  const topP = (probs, p) => { const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]); let run = 0; const keep = []; for (const i of order) { keep.push(i); run += probs[i]; if (run >= p - 1e-12) break; } return keep; };
  const RAW = SCORE.map(s => Math.exp(s));             // the model's own probability for each candidate
  const RAW_SUM = RAW.reduce((a, b) => a + b, 0);       // share of all probability these 10 hold
  const P1 = soft(1);
  const cumAt = (probs, k) => probs.slice(0, k + 1).reduce((a, b) => a + b, 0); // candidates are already sorted by score

  /* ---------- Lesson-local picture and style ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}rows { display: grid; gap: 6px; margin-top: 16px; }
.${P}cap { font: 600 13px var(--mono); color: var(--muted); margin: 18px 0 0; }
.${P}row { display: grid; grid-template-columns: minmax(84px, 7em) 4.6em minmax(0, 1fr) 4.2em; gap: 10px; align-items: center; min-height: 44px; padding: 0 10px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 16px var(--font); text-align: left; width: 100%; }
.${P}row.pick { cursor: pointer; }
.${P}row.pick:hover { border-color: var(--ink); }
.${P}row .t { font: 700 16px var(--mono); overflow-wrap: anywhere; }
.${P}row .s, .${P}row .p { font: 500 14px var(--mono); color: var(--ink-2); text-align: right; }
.${P}row .b { height: 10px; background: var(--sunk); border-radius: 3px; overflow: hidden; }
.${P}row .b u { display: block; height: 100%; background: var(--ink-2); }
.${P}row.enter { border-color: var(--good); background: var(--good-soft); }
.${P}row.enter .b u { background: var(--good); }
.${P}row.no { border-color: var(--bad); background: var(--bad-soft); }
.${P}row.gone { opacity: .38; }
.${P}row.accent { box-shadow: 0 0 0 2px var(--ink); }
.${P}row .r { font: 700 13px var(--mono); color: var(--good); }
.${P}quote { margin: 10px 0 0; padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font-size: 16px; }
.${P}quote b { font-family: var(--mono); }
.${P}src { font: 500 12.5px var(--mono); color: var(--muted); margin-top: 6px; }
.${P}prompt { font: 500 15px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; margin-top: 12px; overflow-wrap: anywhere; }
.${P}prompt b { border-bottom: 2px solid var(--ink); }
.${P}runs { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-top: 10px; }
.${P}runs div { border: 1.5px solid var(--line); border-radius: 10px; padding: 8px 10px; font: 700 16px var(--mono); }
.${P}runs div small { display: block; font: 500 12px var(--font); color: var(--muted); }
.${P}runs div.no { border-color: var(--bad); background: var(--bad-soft); }
.${P}list { margin: 10px 0 0; padding-left: 20px; }
.${P}list li { margin: 4px 0; }
@media (max-width: 620px) { .${P}row { grid-template-columns: minmax(70px, 6em) 4em minmax(0, 1fr) 3.8em; gap: 6px; padding: 0 8px; } }`;
    document.head.appendChild(s);
  }
  /* rows: one per candidate. o.show = which columns ("s" score, "p" probability bar); o.probs; o.cls {i: state};
     o.pick (i => bool) makes rows buttons with data-i; o.order = display order; o.note {i: text} after the word. */
  function rows(o) {
    const order = o.order || WORD.map((_, i) => i), mx = o.max || 1;
    return `${o.title ? `<p class="${P}cap">${kit_esc(o.title)}</p>` : ""}<div class="${P}rows">${order.map(i => {
      const pk = o.pick && o.pick(i), tag = pk ? "button" : "div", cls = (o.cls && o.cls[i]) || "";
      const p = o.probs ? o.probs[i] : null;
      return `<${tag}${pk ? ' type="button"' : ""} class="${P}row ${pk ? "pick " : ""}${cls}" data-i="${i}">
        <span class="t">${kit_esc(WORD[i])}${o.note && o.note[i] ? ` <span class="r">${kit_esc(o.note[i])}</span>` : ""}</span>
        <span class="s">${o.show.includes("s") ? SCORE[i].toFixed(2) : ""}</span>
        ${p != null ? `<span class="b"><u style="width:${Math.min(100, p / mx * 100)}%"></u></span>` : "<span></span>"}
        <span class="p">${p != null ? pct(p) : ""}</span></${tag}>`;
    }).join("")}</div>`;
  }
  let kit_esc = s => String(s);

  /* 1. The situation: same damage report, five runs, one different code. */
  function situation({ el, done, kit }) {
    style(); kit_esc = kit.esc;
    let ans = null;
    const runs = REC_CODE.hot.runs, odd = runs.findIndex(c => runs.filter(x => x === c).length === 1);
    const main = runs.find(c => runs.filter(x => x === c).length > 1);
    const seeds = REC_CODE.seeds;
    const opts = runs.map((c, i) => `Run ${i + 1} (seed ${seeds[i]}): <b>${kit.esc(c)}</b>`);
    const paint = () => {
      const ok = ans === odd;
      el.innerHTML = `<h1>Same report, different code</h1>
        <p class="lead">A car rental desk uses one reply generator for two jobs. It turns a damage report into a code that billing charges by. It also writes a friendly welcome note for each customer. Someone found the notes too alike. So they turned the generator's <b>temperature</b> setting up to ${REC_CODE.hot.temperature}, to make the replies more varied. Then the same prompt with the same damage report was sent ${runs.length} times, with a different random <b>seed</b> each time. A seed is a number that starts the random part of the generator; the same seed is meant to give the same result.</p>
        <div class="${P}quote"><b>system:</b> ${kit.esc(REC_CODE.system)}<br><b>user:</b> ${kit.esc(REC_CODE.user)}</div>
        <p class="task">A small hosted model answered each run below. Billing charges by the code. Which run bills this car differently from the others?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: odd })}
        <p class="${P}src">Recorded model output, ${REC_CODE.recordedAt}. Same prompt each time, temperature ${REC_CODE.hot.temperature}, ${seedRange(seeds)}.</p>
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. Run ${odd + 1} said <b>${kit.esc(runs[odd])}</b> (scratch). The other ${runs.length - 1} said ${kit.esc(main)} (dent). Same prompt, same model, only the seed changed, and a different bill came out. The report is a bit unclear: the paint is scraped, so a scratch is not a silly answer. On an unclear input like this, a random pick can tip the answer either way.
              <p>The same prompt at temperature ${REC_CODE.cold.temperature}, ${REC_CODE.cold.runs.length} runs with the same ${seedRange(seeds)}:</p>
              <div class="${P}runs">${REC_CODE.cold.runs.map((c, i) => `<div><small>run ${i + 1}, seed ${seeds[i]}</small>${kit.esc(c)}</div>`).join("")}</div>
              <p>And ${REC_NOTE.runs.length} welcome notes at temperature ${REC_NOTE.temperature}, same prompt each time, ${seedRange(REC_NOTE.seeds)}:</p>
              ${REC_NOTE.runs.map(t => `<div class="${P}quote">${kit.esc(t)}</div>`).join("")}
              <p class="${P}src">Recorded model output, ${REC_NOTE.recordedAt}.</p>
              <p>For a note, a different wording each time is fine, even nice. For a code it is a billing dispute. This lesson finds where the difference comes from, so you can choose the right settings for each job your app sends to a model.</p>`, true)
          : kit.feedback(`Run ${ans + 1} said ${kit.esc(runs[ans])}, like ${runs.filter(c => c === runs[ans]).length - 1} other runs. Look for the run whose code appears only once: that car would get a different bill.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === odd) done(); });
    };
    paint();
  }

  /* 2. By hand: rank recorded next-token scores, then see them as probabilities. */
  const SHOW = [3, 6, 0, 8, 2, 5, 1, 9, 4, 7];   // fixed shuffled display order
  const RANK_K = 4;                                // the learner ranks the top 4
  function rankByHand({ el, done, kit }) {
    style(); kit_esc = kit.esc;
    const picked = [];
    let miss = null;
    const paint = () => {
      const fin = picked.length === RANK_K, cls = {}, note = {};
      picked.forEach((i, k) => { cls[i] = "enter"; note[i] = "#" + (k + 1); });
      if (miss != null) cls[miss.i] = "no";
      el.innerHTML = `<h1>Inside one step</h1>
        <p class="lead">A model writes one token at a time. Before each token it gives a score to every token it knows. We asked a tiny model running on our own Mac for its 10 best next tokens after this welcome note:</p>
        <div class="${P}prompt">${kit.esc(PROMPT)} <b>___</b></div>
        <p class="lead" style="margin-top:10px">Ollama, the tool that runs the model, reports each score as a <b>log-probability</b>: a negative number, and the closer to zero, the more likely.</p>
        ${fin ? "" : `<p class="task">Tap the ${RANK_K} most likely next words, most likely first.</p>`}
        ${rows({ order: fin ? WORD.map((_, i) => i) : SHOW, show: "s", cls, note, probs: fin ? RAW : null, pick: fin ? null : i => !picked.includes(i), title: fin ? "word, score, and its probability" : "word and score" })}
        <p class="${P}src">Run on our Mac, 2026-11-13 (scores.out.txt).</p>
        <div class="lpanel">
          ${fin ? kit.feedback(`Right order: ${picked.map(i => kit.esc(WORD[i])).join(", ")}. To turn a log-probability into a probability, raise <i>e</i> (about 2.718, the exp key on a calculator) to it: e<sup>${SCORE[0]}</sup> = ${pct(RAW[0])} for "${kit.esc(WORD[0])}". These 10 together hold ${pct(RAW_SUM)} of the model's probability. The rest is spread thinly over every other token in its vocabulary. Turning scores into shares that add up to 100% is the softmax you met in the attention lesson.`, true)
            : miss ? kit.feedback(miss.say, false)
            : picked.length ? kit.feedback(`${picked.length} of ${RANK_K} ranked. Next: the most likely of the words left.`) : ""}
        </div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i, want = picked.length;
        if (i === want) { picked.push(i); miss = null; }
        else {
          const ahead = WORD.map((_, j) => j).filter(j => j < i && !picked.includes(j));
          miss = { i, say: `"${kit.esc(WORD[i])}" scores ${SCORE[i].toFixed(2)}. "${kit.esc(WORD[ahead[0]])}" scores ${SCORE[ahead[0]].toFixed(2)}, which is closer to zero, so it is more likely. ${ahead.length > 1 ? `${ahead.length} words left beat "${kit.esc(WORD[i])}".` : ""} With negative numbers, the one closer to zero is the larger number.` };
        }
        paint();
        if (picked.length === RANK_K) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the scores do not change; the draw does. */
  function spotIdea({ el, done, kit }) {
    style(); kit_esc = kit.esc;
    let ans = null;
    const runs = REC_CODE.hot.runs;
    const opts = [
      "The model's scores came out different on run 2, so SCR moved to the top",
      "The scores were the same; the generator drew a code at random, weighted by probability",
      "The generator always takes the top token, and temperature changed which code was on top"
    ];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>Where did the odd code come from?</h1>
        <p class="lead">Back to the damage report: ${runs.length} runs gave ${kit.esc(runs.join(", "))}. A fact from our own Mac: we asked the tiny model for its scores at temperature 0, 0.5 and 1.5. The scores came back identical each time (scores.out.txt, part 2).</p>
        <p class="task">So what made run 2 say ${kit.esc(runs[1])}?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The model only scores. A separate step, the <b>sampler</b>, turns the scores into probabilities and draws one token like a weighted lottery. If ${kit.esc(runs[1])} had, say, a 1-in-10 chance, then about one run in ten says ${kit.esc(runs[1])}. Temperature, and top-p on the next screen, are settings of that draw, not of the model. Picking the top token every time is called <b>greedy</b> decoding: no lottery, the same answer every run.`, true)
          : ans === 0 ? kit.feedback(`The model's weights do not change between calls, and the same text gives the same scores. We checked: three calls at different temperatures returned identical scores. Something after the scores must be random.`, false)
          : kit.feedback(`If the generator always took the top token, all ${runs.length} runs would agree, because they had the same scores. And temperature never changes which token is on top: it changes how much the top one stands out. Something random happens after the scores.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Top-p: predict which candidates survive the cut, for two values of p. */
  const CUTS = [0.9, 0.5];
  function topPCut({ el, done, kit }) {
    style(); kit_esc = kit.esc;
    let round = 0, miss = null, last = null;
    const paint = () => {
      const fin = round >= CUTS.length, p = fin ? CUTS[CUTS.length - 1] : CUTS[round];
      const keep = topP(P1, p), lastIn = keep[keep.length - 1];
      const cls = {};
      if (fin) WORD.forEach((_, i) => { cls[i] = keep.includes(i) ? "enter" : "gone"; });
      if (miss != null) cls[miss] = "no";
      const runText = i => `${pct(cumAt(P1, i))}`;
      const say = i => i < lastIn
        ? `Running total down to "${kit.esc(WORD[i])}": ${runText(i)}. That is less than ${pct(p, 0)}, so the cut has not been reached yet: keep going down.`
        : `The running total already reached ${pct(p, 0)} at "${kit.esc(WORD[lastIn])}" (${runText(lastIn)}). Top-p stops at the first token that gets the total to p, so "${kit.esc(WORD[i])}" is cut.`;
      el.innerHTML = `<h1>Cut the long tail</h1>
        <p class="lead">One common setting, <b>top-p</b>, cuts the list before the draw. Go down from the most likely word, adding up probabilities. Stop as soon as the total reaches p (top_p = 0.9 means 90%). Words below the stop are never drawn.</p>
        <p class="lead">We only have these 10 candidates. They hold ${pct(RAW_SUM)} of the probability, so here we treat them as the whole list and scale their shares up to 100%. "${kit.esc(WORD[0])}" becomes ${pct(P1[0])}.</p>
        ${fin ? "" : `<p class="task">With top_p = ${p}, tap the last word that stays in the draw.</p>`}
        ${rows({ show: "p", probs: P1, cls, pick: fin ? null : () => true, title: `probability (shared among the 10)${fin ? `, top_p = ${p}` : ""}` })}
        <div class="lpanel">
          ${miss != null ? kit.feedback(say(miss), false)
            : fin ? kit.feedback(`Right: with top_p = ${p} only "${kit.esc(WORD[keep[0]])}" stays, because it alone holds ${pct(P1[keep[0]])}. That is greedy for this step. With top_p = ${CUTS[0]}, ${topP(P1, CUTS[0]).length} words stayed and ${N - topP(P1, CUTS[0]).length} were cut. The kept shares are scaled back up to 100% before the draw. The idea comes from the paper that named it <b>nucleus sampling</b>: the long tail of unlikely tokens is where odd words come from, so cut it and keep the variety in the "nucleus".`, true)
            : last ? kit.feedback(last, true) : ""}
        </div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== lastIn) { miss = i; last = null; paint(); return; }
        const kk = topP(P1, p), sum = kk.reduce((a, j) => a + P1[j], 0);
        last = `Right. ${kk.map(j => `"${kit.esc(WORD[j])}"`).join(", ")} add up to ${pct(sum)}, the first total to reach ${pct(p, 0)}. Scaled back to 100%, the draw is ${kk.map(j => `${kit.esc(WORD[j])} ${pct(P1[j] / sum)}`).join(", ")}. The other ${N - kk.length} cannot be picked at all.${round + 1 < CUTS.length ? ` Now try top_p = ${CUTS[round + 1]}.` : ""}`;
        miss = null; round++; paint();
        if (round >= CUTS.length) done();
      });
    };
    paint();
  }

  /* 5. Temperature: predict how the spread changes, then explore it. */
  const TQ = [0.5, 1.5];
  function temperature({ el, done, kit }) {
    style(); kit_esc = kit.esc;
    const ans = TQ.map(() => null);
    let T = 1;
    const right = TQ.map(t => soft(t)[0] > P1[0] ? 0 : soft(t)[0] < P1[0] ? 1 : 2);
    const say = (k, a) => {
      const t = TQ[k], g = soft(t)[0];
      if (a === right[k]) return `Right: "${kit.esc(WORD[0])}" goes from ${pct(P1[0])} to <b>${pct(g)}</b>. ${t < 1 ? `Dividing by ${t} doubles every gap between scores, and softmax turns bigger gaps into a bigger lead for the top word.` : `Dividing by ${t} shrinks the gaps, so the shares even out and rarer words get more of the draw.`}`;
      if (a === 2) return `Temperature divides every score by the same number, but softmax works on the gaps between scores, and those gaps change. "${kit.esc(WORD[0])}" moves to ${pct(g)}.`;
      return t < 1 ? `Dividing by ${t} makes the gaps between scores bigger, not smaller. Bigger gaps give the top word a bigger lead: "${kit.esc(WORD[0])}" rises to ${pct(g)}.`
        : `Dividing by ${t} makes the gaps between scores smaller. Smaller gaps even the shares out: "${kit.esc(WORD[0])}" falls to ${pct(g)}.`;
    };
    const paint = () => {
      const fin = ans.every((a, k) => a === right[k]);
      el.innerHTML = `<h1>Turn the temperature</h1>
        <p class="lead"><b>Temperature</b> is one number the sampler divides every score by before the softmax. At temperature 1 nothing changes: "${kit.esc(WORD[0])}" has ${pct(P1[0])}.</p>
        <p class="task">Predict the share of "${kit.esc(WORD[0])}" at each temperature.</p>
        ${TQ.map((t, k) => `<div class="lcase" id="q${k}"><p>Temperature ${t}: the scores are divided by ${t}. The share of "${kit.esc(WORD[0])}"...</p>
          ${kit.options(["goes up", "goes down", "stays the same"], { picked: ans[k], correct: right[k] })}
          ${ans[k] == null ? "" : kit.feedback(say(k, ans[k]), ans[k] === right[k])}</div>`).join("")}
        ${fin ? `<div class="sliders"><label>Temperature <input type="range" id="${P}t" min="0.1" max="2" step="0.1" value="${T}"><b id="${P}tv"></b></label></div>
          <div id="${P}tb"></div>
          ${kit.feedback(`Slide it toward 0.1: "${kit.esc(WORD[0])}" takes almost everything, and the draw becomes greedy. Slide toward 2: the unlikely words get bigger shares, so a top-p cut now keeps more words. Some API docs describe temperature 0 as always selecting the most likely response. Temperature never reorders the list; it only sets how strongly the top word leads.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, k) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[k] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === right[j])) done();
      }));
      const sl = el.querySelector(`#${P}t`);
      if (!sl) return;
      // update in place so the slider being dragged is not redrawn
      const upd = () => {
        const pr = soft(T), keep = topP(pr, 0.9);
        el.querySelector(`#${P}tv`).textContent = T.toFixed(1);
        el.querySelector(`#${P}tb`).innerHTML = rows({ show: "p", probs: pr, cls: Object.fromEntries(WORD.map((_, i) => [i, keep.includes(i) ? "" : "gone"])), title: `temperature ${T.toFixed(1)}; faded = cut by top_p 0.9 (${keep.length} of ${N} kept)` });
      };
      sl.oninput = () => { T = +sl.value; upd(); };
      upd();
    };
    paint();
  }

  /* 6. The same picker in Python, from scratch: a traced run (sampler.out.txt). */
  const CODE = [
    "def pick_next(words, scores,",
    "              temp, top_p, rng):",
    "    scaled = scores / temp",
    "    probs = np.exp(scaled - scaled.max())",
    "    probs = probs / probs.sum()",
    "    order = np.argsort(-probs)",
    "    totals = np.cumsum(probs[order])",
    "    cut = np.searchsorted(totals, top_p)",
    "    keep = order[: cut + 1]",
    "    kept = probs[keep] / probs[keep].sum()",
    "    choice = rng.choice(keep, p=kept)",
    "    return words[choice]"
  ];
  // From docs/ai-path/runs/s5a-sampling/sampler.out.txt: trace of pick_next(words, scores, temp=1.0, top_p=0.9, rng=default_rng(7)).
  // Each frame shows the line just run and the variable it set (arrays as printed, rounded to 4 places by the tracer).
  const RUN = { temp: "1.0", top_p: 0.9, seed: 7 };
  const TRACE = [
    { ln: 0, name: "temp, top_p", val: RUN.temp + ", " + RUN.top_p },
    { ln: 2, name: "scaled", val: [-0.615, -1.5108, -2.0316, -3.4505, -4.136, -4.1549, -4.3376, -4.8743, -6.126, -6.3292] },
    { ln: 3, name: "probs", val: [1.0, 0.4083, 0.2425, 0.0587, 0.0296, 0.029, 0.0242, 0.0141, 0.004, 0.0033] },
    { ln: 4, name: "probs", val: [0.5513, 0.2251, 0.1337, 0.0324, 0.0163, 0.016, 0.0133, 0.0078, 0.0022, 0.0018] },
    { ln: 5, name: "order", val: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { ln: 6, name: "totals", val: [0.5513, 0.7765, 0.9102, 0.9425, 0.9588, 0.9748, 0.9882, 0.996, 0.9982, 1.0] },
    { ln: 7, name: "cut", val: 2 },
    { ln: 8, name: "keep", val: [0, 1, 2] },
    { ln: 9, name: "kept", val: [0.6058, 0.2473, 0.1469] },
    { ln: 10, name: "choice", val: 1 },
    { ln: 11, name: "returned", val: "'wonderful'" }
  ];
  const frame = name => TRACE.find(f => f.name === name).val;
  const GATE = TRACE.findIndex(f => f.name === "totals");              // stop here and predict the size of keep
  const CUMS = frame("totals"), CUT = frame("cut"), KEEPV = frame("keep"), KEPT = frame("kept"), CHOICE = frame("choice");
  const KEEP_N = KEEPV.length;
  const listWords = ix => ix.map(j => WORD[j]).join(", ");
  // one sentence per step, built from the trace
  const SAYS = [
    `The inputs: the ${N} words, their recorded scores, temp ${RUN.temp} (no change), top_p ${RUN.top_p} and a random generator with seed ${RUN.seed}.`,
    `Divide every score by the temperature. At ${RUN.temp} they stay as they were.`,
    `Raise e to each score. Subtracting the largest first keeps the numbers small so nothing overflows; it does not change the shares. The top word is now ${frame("probs")[0].toFixed(1)}.`,
    `Divide by the sum so the shares add up to 1. This is the softmax: the ${pct(TRACE[3].val[0], 0)} you saw for "${WORD[0]}".`,
    `Sort from most to least likely. The scores came sorted, so the order is ${frame("order").slice(0, 3).join(", ")}, ...`,
    `Running totals down the sorted list: each total adds the next word's share to the one before.`,
    `searchsorted finds the first total that reaches ${RUN.top_p}: position ${CUT}, where the total is ${CUMS[CUT]} (positions count from 0; before it: ${CUMS.slice(0, CUT).join(", ")}).`,
    `Keep positions 0 up to and including ${CUT}. That is why the line says cut + 1: ${listWords(KEEPV)}.`,
    `Scale the kept shares back up to 1. The draw is ${KEPT.map(k => pct(k, 0)).join(", ")}.`,
    `The weighted lottery. With seed ${RUN.seed} it drew index ${CHOICE} (counting from 0), "${WORD[CHOICE]}".`,
    `So this run writes "${WORD[CHOICE]}". Another seed can draw ${listWords(KEEPV.filter(j => j !== CHOICE)).replace(/, ([^,]*)$/, " or $1")}. Temperature 0 would divide by zero on the scaled line: handle 0 as its own case and take the top word.`
  ];
  // the same picker, called 20 times per setting, seed 0 (sampler.out.txt, last part)
  const DRAWS20 = [
    { t: 0.5, p: 0.9, counts: { great: 16, wonderful: 4 } },
    { t: 1.0, p: 0.9, counts: { wonderful: 6, great: 10, good: 4 } },
    { t: 1.5, p: 1.0, counts: { good: 3, great: 7, nice: 2, safe: 1, wonderful: 4, fantastic: 1, pleasant: 2 } }
  ];
  function asCode({ el, done, kit }) {
    style(); kit_esc = kit.esc;
    let i = 0, guess = null;
    const opts = [KEEP_N - 1, KEEP_N, KEEP_N + 1];
    const fmtVal = v => Array.isArray(v) ? `[${v.slice(0, 4).join(", ")}${v.length > 4 ? ", …" : ""}]` : String(v);
    const paint = () => {
      const f = TRACE[i], end = i === TRACE.length - 1, gate = i === GATE, open = gate && guess !== KEEP_N;
      const tp = RUN.top_p;
      const why = g => g < KEEP_N ? `After ${g} word${g === 1 ? "" : "s"} the running total is ${CUMS[g - 1]}, still below top_p = ${tp}. searchsorted looks for the first total that reaches ${tp}, and keep includes that word too (the + 1), so it holds more.`
        : `The total already reached ${tp} at word ${KEEP_N} (${CUMS[KEEP_N - 1]}). searchsorted returns that position, ${KEEP_N - 1} counting from 0, and order[: cut + 1] stops right after it, so word ${g} is left out.`;
      el.innerHTML = `<h1>The same picker in Python</h1>
        <p class="lead">This is everything you just did by hand, as one NumPy function. We ran it on our Mac with the recorded scores and traced every line.</p>
        <p class="task">Step through to the end. Match each line to what you did on the last two screens. One step asks you to predict.</p>
        ${kit.code(CODE, f.ln)}
        <div class="vars"><span>${kit.esc(f.name)} <b>${kit.esc(fmtVal(f.val))}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(kit.esc(SAYS[i]))}
        ${gate ? `<div class="lcase" id="g"><p>Predict from <code>totals</code> above: with top_p = ${RUN.top_p}, how many words will <code>keep</code> hold two lines from now?</p>${kit.options(opts.map(String), { picked: guess == null ? null : opts.indexOf(guess), correct: opts.indexOf(KEEP_N), num: true })}
          ${guess == null ? "" : guess === KEEP_N ? kit.feedback(`Right: the totals run ${CUMS.slice(0, KEEP_N).join(", then ")}, and ${CUMS[KEEP_N - 1]} is the first at or above ${RUN.top_p}, at word ${KEEP_N}. Press Next step to check.`, true) : kit.feedback(why(guess), false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${end || open ? "disabled" : ""}>Next step</button></div>
        ${end ? `<p class="${P}cap">the same function, called 20 times per setting (seed 0)</p>
          <ul class="${P}list">${DRAWS20.map(d => `<li>temperature ${d.t}, top_p ${d.p}: ${Object.entries(d.counts).sort((a, b) => b[1] - a[1]).map(([w, c]) => `${kit.esc(w)} ${c}`).join(", ")} (${Object.keys(d.counts).length} different words)</li>`).join("")}</ul>
          <p class="${P}src">Run on our Mac, 2026-11-13 (sampler.out.txt).</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll("#g .lopts button").forEach(b => b.onclick = () => { guess = opts[+b.dataset.i]; paint(); });
    };
    paint();
  }

  /* 7. The big picture: choose settings per job, and know what settings cannot do. */
  const JOBS = [
    ["The damage code for a report", 0, "Right. One right answer, and billing needs the same answer every time: take the top token, no lottery. Then still check the reply is one of the four codes in your own code before billing uses it.",
      "A code has one right answer, and any lottery means some runs bill differently, as you saw. Take the top token (temperature 0), and check the reply against the code list."],
    ["A welcome note for each customer", 1, "Right. Many wordings are fine, so a normal draw keeps the notes from sounding copy-pasted, and every candidate the model rates well is a fine word.",
      "A note has many good wordings. Temperature 0 gives every customer the same sentence. Turning it far up wakes the tail of odd tokens, which a friendly note does not need."],
    ["Twenty slogan ideas for a summer ad, for a person to choose from", 2, "Right. Here variety is the point and a person filters the result. A higher temperature spreads the draw. OpenAI's reference advises changing temperature or top-p, not both, so change one knob and judge the results.",
      "The marketing team wants many different ideas to choose from. A setting that keeps the most likely words gives near-copies. Spread the draw with a higher temperature."]
  ];
  const SETTINGS = ["temperature 0", "default (about 1)", "higher temperature"];
  function bigPicture({ el, done, kit }) {
    style(); kit_esc = kit.esc;
    const ans = JOBS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to turn which knob</h1>
        <p class="lead"><b>What it is for:</b> deciding how much a reply may change from run to run. <b>Low or 0</b> when there is one right answer. <b>Default or higher</b> when many answers are fine and sameness hurts.</p>
        <p class="lead"><b>When not:</b> settings never add knowledge. A tiny model on our Mac, given the code list, answered "${kit.esc(TINY_CODE.cold[0].trim())}" in ${TINY_CODE.cold.length} of ${TINY_CODE.cold.length} runs at temperature 0: consistent, and not a real code. Check fixed answers in code, or use a lookup table. Even temperature 0 with a fixed seed does not promise identical text: OpenAI's reference says "Determinism is not guaranteed". A hosted server runs your request in one batch with other people's requests. Serving software such as vLLM documents that results can depend on that batch, so two nearly tied tokens can swap. Some newer hosted models ignore these settings.</p>
        <p class="lead"><b>What it costs:</b> no money. Too low gives repetitive text; too high gives odd words, broken formats and retries.</p>
        <p class="task">Pick a setting for each job at the rental desk.</p>
        ${JOBS.map(([q, r, yes, no], k) => `<div class="lcase" id="j${k}"><p>${kit.esc(q)}</p>${kit.options(SETTINGS, { picked: ans[k], correct: r })}${ans[k] == null ? "" : kit.feedback(kit.esc(ans[k] === r ? yes : no), ans[k] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, k) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[k] = +b.dataset.i; paint();
        if (JOBS.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 8. Recognise it: is a sampling setting the right fix? */
  const CASES = [
    ["An online shop generates descriptions for 200 nearly identical mugs at temperature 0, and every description reads the same.", true,
      "Yes. Temperature 0 always takes the top token, so similar inputs give the same text. A normal temperature lets the draw pick other good words.",
      "At temperature 0 the top token always wins, so near-identical inputs give near-identical text. That is exactly what the draw is for: allow the other well-scored words."],
    ["A recipe app's model, at temperature 0, converts \"1 cup of rice\" to the same wrong number of grams every time.", false,
      "Right, no. The sampler only chooses among tokens the model already scores. At temperature 0 it takes the top guess, and the top guess is wrong. Raising the temperature makes other numbers come up sometimes, also mostly wrong. The fix is to give it the fact: do the conversion in code from a table, or put the table in the prompt.",
      "Settings cannot fix this. At temperature 0 the sampler takes the model's top guess, and that guess is wrong. A higher temperature only makes it say different numbers at random. The app needs the fact itself: a conversion table used in code or given to the model."],
    ["A test compares a summariser's output with a saved answer. It passes and fails at random on reruns, with the temperature left at the default.", true,
      "Yes, mostly. Set temperature 0 for the test so the draw stops changing the text. Even with temperature 0 and a fixed seed, OpenAI's reference says determinism is not guaranteed, so compare the meaning or key facts, not every character.",
      "At the default temperature each rerun draws different tokens, so exact comparison fails at random. Temperature 0 removes the draw. Keep the check tolerant too: even with a fixed seed, OpenAI's reference says determinism is not guaranteed."]
  ];
  function recognise({ el, done, kit }) {
    style(); kit_esc = kit.esc;
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is a sampling setting the fix?</h1>
        <p class="lead">Three situations away from the rental desk.</p>
        <p class="task">For each one, decide if changing temperature or top-p is the right fix. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next: browser practice, then the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    style(); kit_esc = kit.esc;
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can now pick the settings</h1>
      <p class="lead">The model scores every token; the sampler turns the scores into probabilities with a softmax, reshapes them with <b>temperature</b>, cuts the tail with <b>top-p</b>, and draws one. Use 0 when there is one right answer, more when variety helps, and never expect a setting to fix wrong knowledge.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson. You write <code>pick_next</code> yourself: softmax with temperature, the top-p cut and the weighted draw, and test it on the welcome-note scores.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You have seen how one token is picked; next you see how training turns a model that only continues text into an assistant that answers.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Temperature, top-p and how the next token is picked",
    checked: "2026-11-13",
    sources: [
      "https://openrouter.ai/docs/api/reference/parameters",
      "https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create",
      "https://aistudio.google.com/docs/prompting-strategies",
      "https://huggingface.co/docs/transformers/main/en/generation_strategies",
      "https://arxiv.org/abs/1904.09751",
      "https://docs.ollama.com/api/generate",
      "https://docs.vllm.ai/en/latest/features/batch_invariance.html"
    ],
    interview: [{
      q: "One LLM endpoint serves both invoice field extraction and marketing email drafts. Someone set temperature to 1.2 for everything, and finance says the same invoice gives different totals on reruns. What do you change, and what do you tell them?",
      good: [
        "The model scores tokens the same way each run; the randomness is the sampler's weighted draw, and 1.2 flattens the shares so less likely tokens win more often",
        "Set sampling per task: extraction at temperature 0, emails at the default or a bit higher (or a lower top-p instead, since OpenAI's reference advises changing one of the two)",
        "Still validate the extracted fields in code (types, totals that add up, allowed values), because even with temperature 0 and a fixed seed, OpenAI's reference says determinism is not guaranteed",
        "If the totals are wrong even at temperature 0, it is not a sampling problem: fix the input or the prompt"
      ],
      weak: "Lower the temperature everywhere, or switch to a bigger model. It misses that the two jobs need different settings and that settings never guarantee a correct or identical answer."
    }, {
      q: "A product manager asks why you would touch top-p at all when temperature already controls randomness. How do you explain the difference and when you would change each?",
      good: [
        "Temperature reshapes every share: low sharpens the lead of the top token, high evens the shares out",
        "Top-p cuts the tail: only the most likely tokens whose shares add up to p can be drawn, then their shares are scaled back to 100%",
        "Top-p keeps variety among good tokens while making rare junk tokens impossible to draw",
        "OpenAI's reference recommends changing one of the two, not both, so tune one at a time and judge on real outputs"
      ],
      weak: "They are the same thing, both make it more creative. It misses that one reshapes the distribution and the other removes tokens from the draw."
    }],
    screens: [situation, rankByHand, spotIdea, topPCut, temperature, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="2"]'], right: Array.from({ length: RANK_K }, (_, k) => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="1"]'], right: CUTS.map(p => `[data-i="${topP(P1, p).slice(-1)[0]}"]`) },
      { wrong: ["#q0 [data-wrong]"], right: TQ.map((_, k) => `#q${k} [data-right]`) },
      { wrong: [...Array(GATE).fill("[data-next]"), "#g [data-wrong]"], right: ["#g [data-right]", ...Array(TRACE.length - 1 - GATE).fill("[data-next]")] },
      { wrong: ["#j0 [data-wrong]"], right: JOBS.map((_, k) => `#j${k} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
