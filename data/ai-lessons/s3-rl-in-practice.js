/* Lesson: where RL is used, and where it is not. Story: a delivery startup asks whether reinforcement learning
   should set courier bonuses, and a game studio wants smarter opponents. Ideas: (1) RL fits when an agent makes a
   chain of decisions, each one changes what happens next, and trials are cheap (a simulator); with labelled
   answers use supervised learning, with a known rule write the rule; (2) the agent optimises the reward you
   wrote, not the goal you meant: a per-pickup bonus makes it game the reward (reward hacking).
   Data, all real, from Gymnasium's Taxi-v4 on this Mac (docs/ai-path/runs/s3-rl-in-practice/):
   - basics.py + basics.out.txt: reset(seed=0), four hand-picked steps, a random agent over 100 episodes;
   - train_taxi.py + train_taxi.out.txt: tabular Q-learning (taxi_common.py) for 3,000 episodes, a greedy test
     over 100 episodes, and run_episode traced line by line (the code screen);
   - bonus_taxi.py + bonus_taxi.out.txt: the broken reward, +5 per pickup switched on after 1,500 episodes;
   - check_claims.py + check_claims.out.txt (review): the two 200-step test episodes, one greedy episode of the
     bonus-trained agent, and the bonus phase re-run with exploration left at 10%.
   No model calls were recorded for this lesson.
   Lesson-local style: a text map and a signed-bar learning-curve table (.lx-s3-rl-in-practice-*), see ensureStyle(). */
(() => {
  const ID = "s3-rl-in-practice";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-rl-in-practice.ipynb";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const fmt = n => n.toLocaleString("en");

  /* ---------- Data copied from the runs ---------- */
  // Taxi-v4 rules, from the official environment page and gymnasium/envs/toy_text/taxi.py (Gymnasium 1.4.0)
  const ACTIONS = ["south", "north", "east", "west", "pickup", "dropoff"];
  const R_STEP = -1, R_DELIVER = 20, R_ILLEGAL = -10, MAX_STEPS = 200;
  const MAP = ["+---------+", "|R: | : :G|", "| : | : : |", "| : : : : |", "| | : | : |", "|Y| : |B: |", "+---------+"];
  const PADS = ["R", "G", "Y", "B"]; // passenger 4 = in the taxi

  // basics.out.txt
  const START = { obs: 314, decoded: [3, 0, 3, 2] };
  const BASIC_STEPS = [ // [name, action, obs, decoded, reward, terminated, truncated]
    ["pickup", 4, 314, [3, 0, 3, 2], -10, false, false],
    ["west", 3, 314, [3, 0, 3, 2], -1, false, false],
    ["north", 1, 214, [2, 0, 3, 2], -1, false, false],
    ["dropoff", 5, 214, [2, 0, 3, 2], -10, false, false]
  ];
  const RANDOM = { episodes: 100, meanReturn: -765.1, delivered: 6, meanSteps: 195.0 };

  // train_taxi.out.txt: rows [episodes so far, mean return, mean true return, deliveries per episode, pickups per episode], 250 episodes each
  const CURVE = [[250, -250.8, -250.8, 0.42, 1.4], [500, -118.4, -118.4, 0.91, 1.1], [750, -46.5, -46.5, 0.99, 1.0], [1000, -18.8, -18.8, 1.0, 1.0], [1250, -4.9, -4.9, 1.0, 1.0], [1500, -0.9, -0.9, 1.0, 1.0], [1750, 1.0, 1.0, 1.0, 1.0], [2000, 1.8, 1.8, 1.0, 1.0], [2250, 2.6, 2.6, 1.0, 1.0], [2500, 1.7, 1.7, 1.0, 1.0], [2750, 2.0, 2.0, 1.0, 1.0], [3000, 2.4, 2.4, 1.0, 1.0]];
  const GREEDY = { episodes: 100, meanReturn: 3.56, meanSteps: 17.02, minReturn: -200, hitLimit: 2 };
  const EPS_TRAIN = 0.1; // taxi_common.train default, used by train_taxi.py

  // The listing is run_episode from train_taxi.py, line for line (line 0 = def).
  const CODE = [
    "def run_episode(env, q_table, seed):",
    "    obs, info = env.reset(seed=seed)",
    "    total_reward, steps = 0, 0",
    "    while True:",
    "        action = int(np.argmax(q_table[obs]))",
    "        obs, reward, terminated, truncated, info = env.step(action)",
    "        total_reward += reward",
    "        steps += 1",
    "        if terminated or truncated:",
    "            return total_reward, steps"
  ];
  // Trace rows from train_taxi.out.txt (the first line-3 event, every line-8 event, the return):
  // [line about to run, event, obs, decoded obs, action, reward, terminated, truncated, total_reward, steps]
  const TRACE = [[3,"l",314,[3,0,3,2],null,null,null,null,0,0],[8,"l",214,[2,0,3,2],1,-1,false,false,-1,1],[8,"l",234,[2,1,3,2],2,-1,false,false,-2,2],[8,"l",254,[2,2,3,2],2,-1,false,false,-3,3],[8,"l",274,[2,3,3,2],2,-1,false,false,-4,4],[8,"l",374,[3,3,3,2],0,-1,false,false,-5,5],[8,"l",474,[4,3,3,2],0,-1,false,false,-6,6],[8,"l",478,[4,3,4,2],4,-1,false,false,-7,7],[8,"l",378,[3,3,4,2],1,-1,false,false,-8,8],[8,"l",278,[2,3,4,2],1,-1,false,false,-9,9],[8,"l",258,[2,2,4,2],3,-1,false,false,-10,10],[8,"l",238,[2,1,4,2],3,-1,false,false,-11,11],[8,"l",218,[2,0,4,2],3,-1,false,false,-12,12],[8,"l",318,[3,0,4,2],0,-1,false,false,-13,13],[8,"l",418,[4,0,4,2],0,-1,false,false,-14,14],[8,"l",410,[4,0,2,2],5,20,true,false,6,15],[9,"r",410,[4,0,2,2],5,20,true,false,6,15]];

  // bonus_taxi.out.txt: rows [episodes so far, mean trained reward, mean true reward, deliveries per episode, pickups per episode], 500 episodes each
  const BONUS = 5, BONUS_FROM = 1500, EPS_BONUS = 0.2;
  const BCURVE = [[500, -184.6, -184.6, 0.67, 1.2], [1000, -32.6, -32.6, 1.0, 1.0], [1500, -2.9, -2.9, 1.0, 1.0], [2000, -1.0, -6.1, 1.0, 1.0], [2500, -0.0, -5.2, 1.0, 1.0], [3000, 0.9, -4.2, 1.0, 1.0], [3500, 0.7, -4.6, 1.0, 1.1], [4000, 0.8, -4.4, 1.0, 1.0], [4500, 0.0, -5.1, 1.0, 1.0], [5000, 0.1, -5.2, 1.0, 1.0], [5500, 2.7, -9.8, 1.0, 2.5], [6000, 9.2, -21.0, 0.96, 6.0], [6500, 27.0, -66.7, 0.82, 18.8], [7000, 35.9, -96.6, 0.69, 26.5], [7500, 73.1, -192.6, 0.34, 53.1], [8000, 95.1, -251.3, 0.09, 69.3], [8500, 96.3, -263.7, 0.03, 72.0], [9000, 100.8, -266.2, 0.01, 73.4], [9500, 101.8, -264.3, 0.01, 73.2], [10000, 100.2, -267.0, 0.0, 73.4]];

  /* ---------- Derived from the data ---------- */
  const encode = ([r, c, p, d]) => ((r * 5 + c) * 5 + p) * 4 + d; // the formula on the Taxi-v4 page
  const where = d => `row ${d[0]}, column ${d[1]}`;
  const passTxt = p => p === 4 ? "in the taxi" : `at pad ${PADS[p]}`;
  const LAST = TRACE[TRACE.length - 1];
  const EP_STEPS = LAST[9], EP_TOTAL = LAST[8];
  const firstFull = CURVE.findIndex(r => r[3] === 1); // first block where every episode delivered
  const bestRow = CURVE.reduce((b, r, i) => r[1] > CURVE[b][1] ? i : b, 0);
  const switchIdx = BCURVE.findIndex(r => r[0] > BONUS_FROM); // first block trained with the bonus
  const GAME_AT = BCURVE.findIndex(r => r[4] > 1.5); // first block with clearly more than one pickup per episode
  const BL = BCURVE[BCURVE.length - 1];
  // check_claims.out.txt: one greedy episode (seed 0) of the bonus-trained agent, and the 10% re-run's last row
  const HACK_EP = { steps: 200, pickups: 95, pad: "G" };
  const EPS10_LAST = [10000, 7.9, 2.8, 1.0, 1.0];
  const LOOP_GAIN = (R_STEP + BONUS) + R_STEP; // pickup (step cost + bonus), then a legal dropoff at a wrong pad

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-map { margin: 14px 0 4px; font: 600 20px/1.25 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; display: inline-block; white-space: pre; }
      .lx-${ID}-cap { margin: 4px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-curve { margin: 14px 0 0; border-top: 1px solid var(--line); font-size: 14px; }
      .lx-${ID}-row { display: grid; grid-template-columns: 4.2em 1fr 3.6em 3.4em; gap: 0 8px; align-items: center; width: 100%; min-height: 44px; padding: 4px 6px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--ink); font: inherit; text-align: left; box-sizing: border-box; }
      .lx-${ID}-curve.lx-${ID}-five .lx-${ID}-row { grid-template-columns: 3.4em 1fr 3.5em 3.1em 3.1em; gap: 0 8px; }
      .lx-${ID}-head { min-height: 0; font: 600 11px/1.3 var(--mono); white-space: nowrap; color: var(--muted); padding-top: 8px; padding-bottom: 8px; }
      button.lx-${ID}-row { cursor: pointer; }
      button.lx-${ID}-row:hover { background: var(--sunk); }
      .lx-${ID}-row.lx-${ID}-on { outline: 3px solid var(--ink); outline-offset: -3px; }
      .lx-${ID}-row.lx-${ID}-bad { background: var(--bad-soft); }
      .lx-${ID}-row.lx-${ID}-good { background: var(--good-soft); }
      .lx-${ID}-row.lx-${ID}-sep { border-top: 2px solid var(--ink); }
      .lx-${ID}-n { font: 500 13px var(--mono); text-align: right; }
      .lx-${ID}-ep { font: 500 13px var(--mono); color: var(--muted); }
      .lx-${ID}-bar { position: relative; height: 16px; flex: 1 1 auto; min-width: 48px; }
      .lx-${ID}-bar::before { content: ""; position: absolute; left: 50%; top: -4px; bottom: -4px; border-left: 1px solid var(--faint); }
      .lx-${ID}-bar i { position: absolute; top: 3px; height: 10px; background: var(--ink-2); }
      .lx-${ID}-bar b { position: absolute; font: 500 12px var(--mono); top: -1px; }
      .lx-${ID}-opt { text-align: left; }
      .lx-${ID}-cmp { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-cmp th, .lx-${ID}-cmp td { border-bottom: 1px solid var(--line); padding: 8px 6px; text-align: right; }
      .lx-${ID}-cmp th:first-child, .lx-${ID}-cmp td:first-child { text-align: left; }
      .lx-${ID}-cmp td { font-family: var(--mono); font-size: 14px; }
      .lx-${ID}-check { list-style: none; margin: 12px 0 16px; padding: 0; border-top: 1px solid var(--line); }
      .lx-${ID}-check li { border-bottom: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-check label span { padding-top: 10px; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .lx-${ID}-check input:checked { background-color: var(--good); outline-color: var(--good); }
      .lx-${ID}-cmp td:first-child { font-family: var(--font); font-size: 15px; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  const mapWithTaxi = d => MAP.map((line, i) => i === d[0] + 1 ? line.slice(0, 1 + 2 * d[1]) + "T" + line.slice(2 + 2 * d[1]) : line).join("\n");
  // signed bar: value v on a scale of -mx..mx, zero in the middle
  const bar = (v, mx) => {
    const w = Math.min(50, Math.abs(v) / mx * 50);
    return `<span class="lx-${ID}-bar" aria-hidden="true"><i style="${v < 0 ? `right:50%` : `left:50%`};width:${w}%"></i></span>`;
  };
  /* Curve table. cols: [[head, row => value, isBar]]; opts.pick makes rows buttons with data-i; cls: {i: "on"|"bad"|"good"} */
  function curve(kit, rows, cols, { pick = false, cls = {}, sep = -1, five = false, title = "" } = {}) {
    const mx = Math.max(...rows.map(r => Math.abs(cols.find(c => c[2])[1](r))));
    const head = `<div class="lx-${ID}-row lx-${ID}-head">${cols.map(c => `<span${c[2] ? "" : ` class="lx-${ID}-n"`}>${kit.esc(c[0])}</span>`).join("")}</div>`;
    const body = rows.map((r, i) => {
      const tag = pick ? "button" : "div";
      const k = [cls[i] ? `lx-${ID}-${cls[i]}` : "", i === sep ? `lx-${ID}-sep` : ""].join(" ");
      const label = cols.map(c => `${c[0]} ${c[1](r)}`).join(", ");
      return `<${tag}${pick ? ` type="button" data-i="${i}" aria-label="${kit.esc(label)}"` : ""} class="lx-${ID}-row ${k}">${cols.map((c, j) =>
        j === 0 ? `<span class="lx-${ID}-ep">${kit.esc(fmt(c[1](r)))}</span>` : c[2] ? `<span style="display:flex;gap:6px;align-items:center">${bar(c[1](r), mx)}<span class="lx-${ID}-n" style="min-width:3.4em">${kit.esc(String(c[1](r)))}</span></span>` : `<span class="lx-${ID}-n">${kit.esc(String(c[1](r)))}</span>`).join("")}</${tag}>`;
    }).join("");
    return `<div class="lx-${ID}-curve${five ? ` lx-${ID}-five` : ""}"${title ? ` aria-label="${kit.esc(title)}"` : ""}>${head}${body}</div>`;
  }
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const opt = s => `<span class="lx-${ID}-opt">${s}</span>`;

  /* 1. The situation, then sort six product ideas. */
  const KINDS = ["Reinforcement learning", "Supervised learning", "A simple rule"];
  const IDEAS = [
    ["Estimate how long each order will take, learning from two years of past orders and how long they really took.", 1, [
      "Nothing the model does changes the next order, and you already have the right answer for every past order: the real time. Learning from labelled examples is supervised learning, and it needs no trial and error.",
      "Right. Past orders with their real times are labelled examples. A model learns the pattern from them.",
      "Time depends on distance, hour, weather and the restaurant all at once. A hand-written rule would be rough; the labelled history already holds the pattern."]],
    ["A strategy game's computer opponents learn by playing the game against copies of themselves, scored only by a win or a loss at the end of each match.", 0, [
      "Right. Many moves in a row, each one changes the board, the score comes only at the end, and the game itself is a free place to practise millions of matches.",
      "There is no labelled answer for each move. Nobody can say which move was right; only the match result at the end says how the whole chain went.",
      "Good play in a strategy game is far too rich for a hand-written rule, and the studio wants opponents that find moves no one wrote down."]],
    ["Pay couriers a fixed extra amount for every delivery after 22:00, as their contract says.", 2, [
      "The amount is already decided by the contract. There is nothing to learn: trial and error would only pay couriers the wrong amount on the way.",
      "There is nothing to predict. The contract states the answer, so a model trained on past pay would at best copy the rule back.",
      "Right. The rule is known and written down. One line of code applies it, and you can test it fully."]],
    ["Flag fake courier sign-ups, using 40,000 past sign-ups already marked fake or real by the fraud team.", 1, [
      "The model's choice does not change which sign-ups arrive next, and every past case already has the right answer. That is labelled data, the home ground of supervised learning.",
      "Right. 40,000 labelled cases: train a classifier on them.",
      "Fraudsters change their tricks, and no single rule catches them all. The 40,000 marked cases hold patterns a rule would miss."]],
    ["Control the lifts in a new office tower, practising first in a simulator of how people arrive and ride, scored on how long people wait.", 0, [
      "Right. Each lift move changes who waits where next, the effect of a choice shows up later, and the simulator lets the agent practise cheaply before it touches real people.",
      "There is no list of right moves to learn from: the tower is new and the best move depends on what the other lifts are doing. Only the waiting time, after many moves, says how well it went.",
      "A fixed rule such as 'go to the nearest call' is a fine first version, but the brief is to do better with practice, and a simulator makes that practice cheap."]],
    ["Block orders to addresses outside the delivery zone.", 2, [
      "The zone is a fixed map. Checking a point against it has one right answer, and no amount of trial and error improves it.",
      "No prediction is needed: the address is either inside the zone or not. You compute that, you do not learn it.",
      "Right. A point-in-zone check is a rule. Exact, cheap, and easy to test."]]
  ];
  function sortIdeas({ el, done, kit }) {
    ensureStyle();
    const ans = IDEAS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Should RL set the courier bonuses?</h1>
        <p class="lead">A delivery startup has read about <b>reinforcement learning</b> (RL): an agent tries actions, gets a reward, and over many tries learns which actions pay. They ask you whether RL should set their weekly courier bonuses. The same week, a game studio asks whether RL can make their opponents smarter.</p>
        <p class="lead">This lesson is about telling the cases apart: when RL is the right tool, and when supervised learning or a plain rule does the job better. Before either answer, sort six ideas: some from the two teams, some from other clients.</p>
        <p class="task">For each idea, pick what you would build it with.</p>
        ${IDEAS.map(([q, right, fb], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(KINDS, { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(fb[ans[i]], ans[i] === right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (IDEAS.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 2. Spot the idea: why the studio's case fits and the bonus case does not. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Games are small problems, and RL only works on small problems",
      "The studio can play millions of practice matches in its own game for free; the startup could only try bonuses on real couriers, with real money, one week at a time",
      "Setting a bonus is not an action, so there is nothing for an agent to choose",
      "RL needs labelled examples, and the studio has more of them"
    ];
    const RIGHT = 1;
    const fb = [
      ["Size is not the line. Strategy games have more board positions than any table could hold. What matters is how cheaply you can try things and see what happens.", false],
      [`Right. RL learns by trial and error, and it needs a lot of trials: even the tiny taxi task you will train later in this lesson needed about ${fmt(CURVE[firstFull][0])} practice episodes before nearly every episode ended in a delivery. A game is its own simulator, so trials cost only compute. The startup has no simulator of couriers: every trial is a real bonus paid to real people, the reward (more deliveries, fewer drop-outs) arrives slowly and is mixed with weather and holidays, and a bad trial upsets the couriers. That is the first question to ask of any RL idea: <b>where will the agent practise?</b>`, true],
      ["It is an action: each week you pick an amount, and it changes what couriers do next. The problem is not the action, it is what each try costs.", false],
      ["RL does not learn from labelled answers. It learns from rewards after its own actions. Labelled answers are what supervised learning needs.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where will the agent practise?</h1>
        <p class="lead">Both requests have the same shape: an agent picks an action (a bonus amount, a move in the game), something happens, and a reward says how well it went.</p>
        <p class="task">Yet the game studio's request is a much better fit for RL. Why?</p>
        <div class="lpanel">${ask(kit, opts.map(opt), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. The Gymnasium interface on Taxi: predict four rewards. */
  function predictRewards({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const VALUES = [R_STEP, R_ILLEGAL, R_DELIVER];
    const say = (step, v) => {
      const [name] = step;
      if (v === R_DELIVER) return `+${R_DELIVER} is only for dropping the passenger at the destination. ${name === "dropoff" ? "There is no passenger in the taxi yet." : "This is not even a dropoff."}`;
      if (v === R_ILLEGAL) return `${R_ILLEGAL} is only for a pickup or dropoff that is not allowed. A move costs ${R_STEP}, even a move into a wall.`;
      return name === "pickup" ? `The passenger waits at pad ${PADS[START.decoded[2]]}, and the taxi is not there. A pickup where there is no passenger is illegal.` : `The taxi is empty, so there is nobody to drop off. That dropoff is illegal.`;
    };
    const paint = () => {
      const fin = k >= BASIC_STEPS.length;
      const shown = BASIC_STEPS.slice(0, k);
      const d = fin ? BASIC_STEPS[BASIC_STEPS.length - 1][3] : k ? BASIC_STEPS[k - 1][3] : START.decoded;
      const right = fin ? null : BASIC_STEPS[k][4];
      el.innerHTML = `<h1>The environment hands out the reward</h1>
        <p class="lead"><b>Gymnasium</b> is a Python library that gives every RL practice world, called an <b>environment</b>, the same interface. Every environment has the same two calls: <code>reset</code> starts an episode, <code>step(action)</code> does one action and returns five things. The first, <code>obs</code> (the observation), is a number that tells the agent where everything is now.</p>
        ${kit.code(['env = gym.make("Taxi-v4")', "obs, info = env.reset(seed=0)", "obs, reward, terminated, truncated, info = \\", "    env.step(action)"], fin ? -1 : 3)}
        <p class="lead">In Taxi, a taxi on a 5 × 5 grid must fetch a passenger from one pad and drop them at another. The four pads are the letters R, G, Y and B on the map. The rules: ${R_STEP} per step, +${R_DELIVER} for a delivery, ${R_ILLEGAL} for a pickup or dropoff that is not allowed. Our episode uses seed 0, a fixed start, so the run is the same every time: the taxi <b>T</b> is at ${where(START.decoded)}, the passenger waits at pad <b>${PADS[START.decoded[2]]}</b>, the destination is pad <b>${PADS[START.decoded[3]]}</b>. Walls are the <code>|</code> marks; the taxi can drive through the <code>:</code> marks.</p>
        <pre class="lx-${ID}-map" aria-label="Taxi map">${kit.esc(mapWithTaxi(d))}</pre>
        <p class="lx-${ID}-cap">Map from the environment's source; T marks the taxi.</p>
        ${kit.table(shown.map(s => [`step("${s[0]}")`, `reward ${s[4]}, obs ${s[2]}`]), { head: ["action", "what step() returned"], title: "Our run", fresh: shown.length - 1, empty: "no steps yet" })}
        ${fin ? "" : `<p class="task">Next action: <code>${BASIC_STEPS[k][0]}</code>${BASIC_STEPS[k][0] === "west" ? " (the taxi is at the left edge)" : ""}. What reward comes back?</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right, all four. The observation is one number, ${START.obs}, that packs (row, column, passenger, destination) into one id: ((${START.decoded[0]}×5+${START.decoded[1]})×5+${START.decoded[2]})×4+${START.decoded[3]} = ${encode(START.decoded)}. Moving into the wall left it at ${BASIC_STEPS[1][2]}; moving north changed it to ${BASIC_STEPS[2][2]}. You wrote none of these rules: the environment owns the world and the reward, the agent only sends actions. That split is why one training loop can practise on any Gymnasium environment.`, true)
          : `${kit.options(VALUES.map(v => (v > 0 ? "+" : "") + v), { picked: wrong == null ? null : VALUES.indexOf(wrong), correct: VALUES.indexOf(right), num: true })}${wrong != null ? kit.feedback(say(BASIC_STEPS[k], wrong), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = VALUES[+b.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= BASIC_STEPS.length) done();
      });
    };
    paint();
  }

  /* 4. The trained agent, one episode, as a stepped replay of the traced run. */
  const sayFrame = (kit, f, i) => {
    const [ln, , obs, d, a, r, term, trunc, total, steps] = f;
    if (i === 0) return `<code>env.reset(seed=seed)</code> started the episode with seed 0: obs ${obs}, the taxi at ${where(d)}, passenger ${passTxt(d[2])}, going to pad ${PADS[d[3]]}. Totals start at 0.`;
    if (ln === 9) return `The function returns (${total}, ${steps}). ${plural(steps - 1, "step")} at ${R_STEP} and one delivery at +${R_DELIVER}: ${(steps - 1) * R_STEP} + ${R_DELIVER} = ${(steps - 1) * R_STEP + R_DELIVER}. The trained agent drove straight there and back, and never tried an illegal pickup.`;
    const what = a === 4 ? "picked up the passenger" : a === 5 ? "dropped the passenger at the destination" : `moved ${ACTIONS[a]}`;
    return `<code>np.argmax</code> picked the action with the highest value in the Q-table row for this state: <code>${ACTIONS[a]}</code>. Then <code>env.step</code>: the taxi ${what}, reward ${r > 0 ? "+" : ""}${r}, now at ${where(d)}, passenger ${passTxt(d[2])}. ${term ? "<b>terminated</b> is True: the task is done, so the <code>if</code> line is true." : "Both flags are False, so the loop goes round."}`;
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = TRACE[i];
      el.innerHTML = `<h1>A trained agent drives one episode</h1>
        <p class="lead">We trained a Q-table (the same idea as the previous lesson's, ${fmt(CURVE[CURVE.length - 1][0])} episodes on Taxi) and then let it drive episode seed 0 with no more exploring: at every step it takes the action with the highest value. This replays the real run. <code>step</code> returns two flags: <b>terminated</b> becomes True when the task itself is done; the other one, <b>truncated</b>, comes back later in the lesson.</p>
        <p class="task">Step through to the end. Watch which flag ends the loop.</p>
        ${kit.code(CODE, f[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>obs <b>${f[2]}</b></span><span>reward <b>${f[5] == null ? "–" : f[5]}</b></span><span>terminated <b>${f[6] == null ? "–" : f[6] ? "True" : "False"}</b></span><span>total_reward <b>${f[8]}</b></span><span>steps <b>${f[9]}</b></span></div>
        <pre class="lx-${ID}-map" aria-label="Taxi map">${kit.esc(mapWithTaxi(f[3]))}</pre>
        ${kit.feedback(sayFrame(kit, f, i))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 5. Read the learning curve. */
  function readCurve({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The agent delivers more than one passenger per episode",
      "It reaches the passenger and the destination in fewer steps, so it pays the step cost fewer times",
      "Exploration falls as training goes on, so it makes fewer random moves"
    ];
    const RIGHT = 1;
    const fb = [
      ["An episode ends at the first delivery (terminated becomes True), so there is at most one delivery per episode. The deliveries column cannot go above 1.", false],
      [`Right. Once nearly every episode delivers, the +${R_DELIVER} is the same in every episode; what still changes is how many ${R_STEP} steps (and any ${R_ILLEGAL} mistakes) come before it. Mean return went from ${CURVE[firstFull][1]} to ${CURVE[bestRow][1]}. Above zero is a short route: the trained episode you stepped through scored ${EP_TOTAL} in ${EP_STEPS} steps. Reading a curve means asking what each number is made of.`, true],
      [`In this run exploration stayed fixed: ${Math.round(EPS_TRAIN * 100)}% of moves were random from the first episode to the last. The rise has to come from somewhere else.`, false]
    ];
    const cols = [["after", r => r[0]], ["mean return", r => r[1], true], ["deliv.", r => r[3]]];
    const paint = () => {
      el.innerHTML = `<h1>Reading the learning curve</h1>
        <p class="lead">Each row averages the last 250 training episodes, up to the count in “after”. During training, 10% of moves were still random. <b>Return</b> is the total reward of one episode. <b>Deliv.</b> (deliveries) is the share of those episodes that ended in a delivery (1.0 means all of them).</p>
        ${curve(kit, CURVE, cols, { cls: { [firstFull]: "on" }, title: "Taxi training curve" })}
        <p class="lead">From ${fmt(CURVE[firstFull][0])} episodes on (the row with a frame), the deliveries column reads 1.0: nearly every episode delivers. Yet the mean return keeps climbing.</p>
        <p class="task">Where does the extra return come from?</p>
        <div class="lpanel">${ask(kit, opts.map(opt), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Test it against a random agent; terminated versus truncated. */
  function testIt({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["terminated = True", "truncated = True", "Both stay False and the loop runs for ever", "step() raises an error"];
    const RIGHT = 1;
    const perStep = GREEDY.minReturn / MAX_STEPS;
    const fb = [
      [`<b>terminated</b> means the task itself ended: in Taxi, only a delivery does that, and a delivery would have earned +${R_DELIVER}. These episodes never delivered.`, false],
      [`Right. <code>gym.make</code> wraps Taxi in a time limit of ${MAX_STEPS} steps; when it runs out, <b>truncated</b> is True. ${GREEDY.minReturn} over ${MAX_STEPS} steps is ${perStep} per step: the agent only moved, for the whole time, and never delivered. Truncated means "stopped from outside", not "finished", which matters when you train: the episode did not end there, it was cut off. And look at the worst cases, not only the average: ${GREEDY.hitLimit} of ${GREEDY.episodes} test episodes never delivered, hidden inside a good-looking mean.`, true],
      [`The loop in <code>run_episode</code> ends when either flag is True, and Taxi always sets one within ${MAX_STEPS} steps. The two episodes did end, with a return of exactly ${GREEDY.minReturn}.`, false],
      ["Nothing failed. Running out of steps is a normal end of an episode, reported through a flag, not an exception.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Did it learn, or did it get lucky?</h1>
        <p class="lead">We tested on ${GREEDY.episodes} episodes with exploring switched off (the agent always takes its best-valued action) and compared with an agent that picks actions at random, on the same ${GREEDY.episodes} start positions.</p>
        <table class="lx-${ID}-cmp"><thead><tr><th>${GREEDY.episodes} test episodes</th><th>random agent</th><th>trained agent</th></tr></thead><tbody>
          <tr><td>mean return</td><td>${RANDOM.meanReturn}</td><td>${GREEDY.meanReturn}</td></tr>
          <tr><td>mean steps</td><td>${RANDOM.meanSteps}</td><td>${GREEDY.meanSteps}</td></tr>
          <tr><td>worst return</td><td>–</td><td>${GREEDY.minReturn}</td></tr></tbody></table>
        <p class="lead">The random agent delivered in ${RANDOM.delivered} of ${RANDOM.episodes} episodes. The trained agent did far better on average, but ${GREEDY.hitLimit} episodes scored ${GREEDY.minReturn} and took ${MAX_STEPS} steps.</p>
        <p class="task">What did <code>step()</code> return on the ${MAX_STEPS}th step of those episodes?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: find where the agent starts gaming its reward. */
  const BCOLS = [["after", r => r[0]], ["trained reward", r => r[1], true], ["true", r => r[2]], ["deliv.", r => r[3]], ["pick.", r => r[4]]];
  function findGaming({ el, done, kit }) {
    ensureStyle();
    let picked = null;
    const say = i => {
      const r = BCURVE[i];
      if (i < switchIdx) return `The bonus was not on yet: the trained reward and the true reward are the same number (${r[1]} and ${r[2]}). Look after episode ${fmt(BONUS_FROM)}.`;
      if (i < GAME_AT && r[4] > 1) return `${r[4]} pickups per episode is the one every delivery needs plus a few extra from the ${Math.round(EPS_BONUS * 100)}% random moves. Deliveries stay at ${r[3]} and the true reward is no worse than in the rows around it, so nothing is gamed yet.`;
      if (i < GAME_AT) return `This is the bonus doing what it should: ${r[4]} pickup per episode, the one every delivery needs, so the trained reward sits about ${BONUS} above the true reward (${r[1]} against ${r[2]}). Nothing is gamed yet.`;
      return `By now it is well under way: ${r[4]} pickups and ${r[3]} deliveries per episode. Look earlier, for the first row where pickups go clearly above one per episode while deliveries are still fine.`;
    };
    const paint = () => {
      const ok = picked === GAME_AT;
      const cls = {};
      if (picked != null) cls[picked] = ok ? "good" : "bad";
      el.innerHTML = `<h1>Broken on purpose: a bonus per pickup</h1>
        <p class="lead">The startup's first idea was a bonus for every parcel a courier picks up, to make pickups faster. We tried the same reward on the taxi. The agent first trained ${fmt(BONUS_FROM)} episodes on Taxi's own reward. Then we added <b>+${BONUS} for every pickup</b>. We also raised random moves from ${Math.round(EPS_TRAIN * 100)}% to ${Math.round(EPS_BONUS * 100)}%, so it would try more new moves.</p>
        <p class="lead">Each row averages the last 500 episodes, up to the count in “after”. <b>Trained reward</b> is what the agent was optimising; <b>true</b> is Taxi's own reward, the job we actually want. <b>deliv.</b> is deliveries and <b>pick.</b> is pickups, per episode.</p>
        ${curve(kit, BCURVE, BCOLS, { pick: true, cls, sep: switchIdx, five: true, title: "Training curve with the pickup bonus" })}
        <p class="lx-${ID}-cap">The thick line marks where the bonus was switched on.</p>
        <p class="task">Tap the first row where the agent starts gaming the bonus: collecting it in a way that does not do the job.</p>
        <div class="lpanel">${picked == null ? "" : ok ? kit.feedback(`Right: at ${fmt(BCURVE[GAME_AT][0])} episodes, pickups jump to ${BCURVE[GAME_AT][4]} per episode while deliveries are still ${BCURVE[GAME_AT][3]}. The trained reward starts to climb and the true reward starts to fall. From there the trained reward rises to ${BL[1]} while deliveries fall to ${BL[3]}: the agent earns more and more, and does the job less and less. This is <b>reward hacking</b>: the agent found a way to collect the reward that is not the goal.`, true) : kit.feedback(say(picked), false)}</div>`;
      el.querySelectorAll(`.lx-${ID}-curve button`).forEach(b => b.onclick = () => { picked = +b.dataset.i; paint(); if (picked === GAME_AT) done(); });
    };
    paint();
  }

  /* 8. Broken on purpose: the cause and the fix. */
  function fixIt({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Train for more episodes, so the agent learns the task better",
      "Lower random moves back to 10%",
      `Pay for the outcome: put the bonus on deliveries, not pickups, and log deliveries next to the reward in every run`,
      "It is a bug in the environment; report it to the Gymnasium team"
    ];
    const RIGHT = 2;
    const fb = [
      [`It already learned its reward very well: the trained reward rose to ${BL[1]}. More training only polishes the trick; the last ${plural(BCURVE.length - BCURVE.findIndex(r => r[3] < 0.05), "row")} delivered almost nothing.`, false],
      [`That only hides the bug. We re-ran the bonus phase at ${Math.round(EPS_TRAIN * 100)}%: after ${fmt(EPS10_LAST[0])} episodes this agent had not found the trick yet (${EPS10_LAST[4]} pickups per episode). But the reward still pays more for the loop than for any delivery, so a longer run, another seed or a better learner can find it, and once found it is kept.`, false],
      [`Right. The reward said "pickups", so the agent maximised pickups. A bonus that only pays for what you actually want cannot be collected without doing it. And always log the true goal beside the reward: in this run the reward alone looked like success. The same goes for the real couriers: people paid per pickup can learn the same trick an agent does.`, true],
      [`The environment did what its rules say. In Taxi, dropping the passenger at a pad that is not the destination is allowed (a normal ${R_STEP} step, the passenger waits there). The agent found that a pickup then a drop gains ${R_STEP}+${BONUS} and ${R_STEP}, so ${LOOP_GAIN > 0 ? "+" : ""}${LOOP_GAIN} per two steps, for as long as the episode lasts. The rule we added is what made that pay.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why it happened, and the fix</h1>
        <p class="lead">At the end of training, an average episode had ${BL[4]} pickups and ${BL[3]} deliveries. We let the final agent drive one episode with no random moves. It picked the passenger up, drove to pad ${HACK_EP.pad} (not the destination), dropped them there, and then picked up and dropped on the spot, again and again: ${HACK_EP.pickups} pickups before the ${MAX_STEPS}-step limit cut the episode off. Each pickup earns the +${BONUS}. In Taxi, a dropoff at a pad that is not the destination is allowed: it is a normal ${R_STEP} step.</p>
        <p class="task">What do you change?</p>
        <div class="lpanel">${ask(kit, opts.map(opt), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The computer time for training",
      "Every trial is a real bonus paid to real couriers, and the result takes weeks to show",
      "Serving the trained agent quickly enough"
    ];
    const RIGHT = 1;
    const fb = [
      [`Not for a problem this size: our taxi agent trained ${fmt(BCURVE[BCURVE.length - 1][0])} episodes on a laptop's processor. Compute is cheap when the practice is simulated. The startup's practice is not.`, false],
      ["Right. RL needs many trials, and without a simulator each trial is a real decision with real money and real people. A year has 52 weeks: far too few tries to learn from, each one costly and mixed up with weather and holidays. A planned experiment or a supervised model of how couriers respond to bonuses fits better.", true],
      ["Choosing a weekly bonus happens once a week. Speed of the answer is not the problem; getting enough trials to learn from is.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for RL</h1>
        <p class="lead"><b>For:</b> a chain of decisions, where each one changes what comes next and the reward comes late: games, robots and lifts trained in a simulator, tuning a chat model on human ratings of its answers.</p>
        <p class="lead"><b>Reach for it</b> when practice is cheap (a simulator or a game) and the reward truly is the goal.</p>
        <p class="lead"><b>Not</b> when you have labelled right answers (supervised learning), when the rule is known (write it), or when the best path can be computed exactly (a search).</p>
        <p class="lead"><b>Costs:</b> a huge number of trials, a simulator to build and keep true to life, a reward the agent will exploit if it can, and runs that are hard to reproduce and debug.</p>
        <p class="task">The startup still wants RL for the weekly bonus. Which cost bites first?</p>
        <div class="lpanel">${ask(kit, opts.map(opt), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A drone maker wants a landing controller. They have an accurate physics simulator of the drone and of gusts of wind, and they score a landing on how gently and how close to the target it touches down.", true,
      "Yes. Many small control decisions in a row, each one changes the next moment, the score comes at touchdown, and the simulator makes millions of practice landings cheap.",
      "The simulator is the deciding fact: it gives the agent free practice, and landing is a chain of decisions scored at the end. That is the shape RL is for."],
    ["A phone company wants to know which customers will cancel next month. It has three years of customer records, each marked with whether the customer cancelled.", false,
      "No. The records already hold the right answer for each past customer, and predicting does not change who cancels. That is supervised learning: train a classifier on the labelled history.",
      "There is nothing to try and no chain of actions: the past is labelled with the answer. RL would throw away the labels and learn slowly by trial and error what a classifier learns directly."],
    ["A team wants its chat model's answers to be more helpful. Human raters compare pairs of answers and say which is better, and those ratings become the reward the model is tuned on.", true,
      "Yes. This is reinforcement learning from human feedback: the model's answer is the action, the ratings train a reward, and the model is tuned to earn more of it. It also inherits RL's weak spot: the model can learn to please the reward rather than to help.",
      "Each answer is an action scored afterwards by a reward learned from people's ratings; tuning the model to earn more of that reward is RL. It is a known way chat models are trained."],
    ["A warehouse wants the shortest walking route for a picker collecting ten items. The floor plan and every aisle's length are known.", false,
      "No. With a known map and known distances, you compute the route: shortest paths between the items, then the best order of ten stops, which a computer can search exactly. There is nothing uncertain to learn by trying.",
      "When the world is fully known, you can compute the answer instead of practising to find it. RL would spend many trials learning what a route search gives exactly, right away."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>RL or not?</h1>
        <p class="lead">Four requests from other teams.</p>
        <p class="task">Would you use reinforcement learning for each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const CHECK = [
      `<code>env.reset(seed=0)</code> on Taxi-v4 returns observation ${START.obs}, and a pickup right away returns reward ${BASIC_STEPS[0][4]}.`,
      `A random agent over ${RANDOM.episodes} episodes has a mean return far below zero (ours: ${RANDOM.meanReturn}) and delivers only rarely (ours: ${RANDOM.delivered} of ${RANDOM.episodes}).`,
      `The Q-learning curve climbs from about ${Math.round(CURVE[0][1])} to above zero, and deliveries per episode reach 1.0 within the first ${fmt(CURVE[firstFull][0])} or so episodes.`,
      `The greedy test averages under 20 steps per episode (ours: ${GREEDY.meanSteps}); a few episodes may still hit the ${MAX_STEPS}-step limit.`,
      `With the +${BONUS} pickup bonus, the trained reward ends far above the true reward (ours: ${BL[1]} against ${BL[2]}) and deliveries per episode fall towards 0.`
    ];
    el.innerHTML = `<h1>RL where it fits, and only there</h1>
      <p class="lead">You sorted ideas into RL, supervised learning and rules; saw that the first question is where the agent practises; drove Gymnasium's Taxi with <code>reset</code> and <code>step</code>; read a learning curve and its worst cases; and caught an agent gaming a per-pickup bonus.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a>.` : "The notebook for this lesson is on its way."} In it you run the same Taxi code yourself. What you should see (ticking is optional and saves nothing):</p>
      <ul class="lx-${ID}-check">${CHECK.map(c => `<li><label><input type="checkbox"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You leave agents and rewards behind and move on to language, where most of the models you will use at work come from.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Where RL is used, and where it is not",
    checked: "2026-11-14",
    sources: [
      "https://gymnasium.farama.org/environments/toy_text/taxi/",
      "https://gymnasium.farama.org/api/env/",
      "https://gymnasium.farama.org/introduction/basic_usage/",
      "https://github.com/Farama-Foundation/Gymnasium/blob/main/gymnasium/envs/toy_text/taxi.py",
      "https://arxiv.org/abs/1606.06565",
      "https://arxiv.org/abs/2203.02155"
    ],
    interview: [
      {
        q: "A product manager wants reinforcement learning to set couriers' weekly bonuses. What do you ask, and what would you suggest?",
        good: [
          "Ask where the agent would practise: without a simulator every trial is a real bonus paid to real couriers",
          "Point out how few trials there are (one decision a week) and how slow and noisy the reward is",
          "Ask what the reward would be, and how it could be gamed: a per-pickup bonus pays for pickups, not deliveries",
          "Suggest a planned experiment or a supervised model of how couriers respond to bonus levels first",
          "Keep RL for problems with a simulator and a reward that truly is the goal"
        ],
        weak: "Say yes because RL learns the best policy by trial and error, without asking what each trial costs or where it happens."
      },
      {
        q: "Your RL agent's training reward keeps going up, but the business metric it was meant to improve is going down. What is happening, and how do you check?",
        good: [
          "Suspect reward hacking: the agent found a way to earn the reward without doing the job",
          "Log the true metric next to the reward in every run and find where they part",
          "Watch some episodes from that point to see the behaviour the reward is paying for",
          "Change the reward to pay for the outcome, then retrain and check both curves again"
        ],
        weak: "Train longer or tune the learning rate. That makes the agent better at the wrong thing."
      }
    ],
    screens: [sortIdeas, spotIdea, predictRewards, asCode, readCurve, testIt, findGaming, fixIt, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: IDEAS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(BASIC_STEPS.length).fill("[data-right]") },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="0"]'], right: [`[data-i="${GAME_AT}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
