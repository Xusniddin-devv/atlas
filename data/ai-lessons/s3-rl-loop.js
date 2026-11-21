/* Lesson: rewards, states and a tiny Q-table. Story: a robot vacuum learns the shortest way to its dock through
   a small flat with a nursery it should stay out of. Ideas: (1) a Q-table holds one number per (square, move);
   the Q-learning update nudges that number toward "reward now + 0.9 x the best number of the next square", so the
   dock's reward travels back one square at a time; (2) the rewards (and the discount) decide which route wins.
   Data, all real, from runs on this Mac (NumPy, seed 0), in docs/ai-path/runs/s3-rl-loop/:
   - flat.py: the 2 x 4 flat, the rewards and the move rules;
   - train.py + train.out.txt: 200 episodes of tabular Q-learning (alpha 0.5, gamma 0.9, epsilon 0.2), every update of
     episodes 1-12, the final Q-table and the greedy route; train_nursery_minus2.out.txt: the same with nursery -2;
   - trace_episode.py + trace_episode.out.txt: run_episode traced line by line during episode 3;
   - broken.py + broken.out.txt: the same training with one bug (q_table[room] instead of q_table[next_room]).
   No model calls were recorded for this lesson.
   Lesson-local picture and style: the flat plan and a small Q-table (.lx-s3-rl-loop-*), see ensureStyle(). */
(() => {
  const ID = "s3-rl-loop";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* ---------- Data copied from the runs ---------- */
  // flat.py
  const COLS = 4, START = 4, DOCK = 7, NURSERY = [5, 6];
  const ACTIONS = ["up", "down", "left", "right"];
  const MOVES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const STEP_R = -1, NURSERY_R = -10, DOCK_R = 10, MAX_STEPS = 20;
  // train.py settings
  const ALPHA = 0.5, GAMMA = 0.9, EPSILON = 0.2, EPISODES = 200;
  // train.out.txt: Q-table before episode 3 (trace_episode.out.txt, q_before_episode_3; rows A1..D1, A2..D2)
  const Q_BEFORE_EP3 = [[-1.1, -0.975, -0.975, -0.875], [-0.975, -5.0, -0.75, -0.75], [-0.5, -5.0, -0.725, -0.5], [-0.5, 5.0, 0.0, 0.0],
    [-1.325, -0.975, -0.975, -5.0], [-0.75, 0.0, 0.0, 0.0], [-0.5, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]];
  // train.out.txt, episode 3: every update as [room, move, value after]
  const EP3 = [[4,1,-1.42625],[4,2,-1.42625],[4,0,-1.55625],[0,3,-1.275],[1,2,-1.31375],[0,1,-1.6293124999999997],[4,1,-1.8549375],[4,2,-1.8549375],[4,0,-1.716875],[0,2,-1.42625],[0,0,-1.5450000000000002],[0,1,-2.08725],[4,0,-1.9321875],[0,3,-1.475],[1,3,-1.1],[2,3,1.5],[3,1,7.5]];
  // train.out.txt, episode 3, its last four updates: [room, move, reward, next, best_next, before, after]
  const LAST4 = [[0, 3, -1, 1, -0.75, -1.275, -1.475], [1, 3, -1, 2, -0.5, -0.75, -1.1], [2, 3, -1, 3, 5.0, -0.5, 1.5], [3, 1, 10, 7, 0.0, 5.0, 7.5]];
  // train.out.txt: value after the last update of the cell in each of episodes 1-12 (episodes that did not touch it left out)
  const HISTORY = {
    "3,1": [[2, 5.0], [3, 7.5], [4, 8.75], [5, 9.375], [6, 9.6875], [7, 9.84375], [8, 9.921875]],
    "2,3": [[2, -0.5], [3, 1.5], [4, 3.625], [5, 5.25], [6, 6.34375], [7, 7.03125], [8, 7.4453125]],
    "1,3": [[2, -0.75], [3, -1.1], [4, -0.012499999999999956], [5, 1.1250000000000002], [6, 2.4250000000000007], [7, 4.13828125], [8, 4.733203125]],
    "0,3": [[1, -0.75], [2, -0.875], [3, -1.475], [5, -1.243125], [6, -0.6153124999999999], [7, 0.2835937500000003], [8, 1.5040234375000006]]
  };
  // train.out.txt: moves of episodes 1-12, and how many of them went into the nursery (reward -10)
  const EARLY_LENGTHS = [20, 14, 17, 16, 6, 5, 7, 5, 5, 5, 9, 6];
  const EARLY_NURSERY = [2, 1, 0, 6, 0, 0, 0, 0, 0, 0, 1, 0];
  // train.out.txt: final Q-table (rounded to 2 decimals by the script) and greedy route
  const FINAL_Q = [[3.11, 1.8, 3.12, 4.58], [4.58, -5.88, 3.12, 6.2], [5.36, -2.23, 4.58, 8.0], [8.0, 10.0, 6.19, 8.0],
    [3.12, 1.8, 1.81, -5.88], [4.58, -5.82, 1.02, -4.12], [4.53, -4.12, -5.61, 9.69], [0.0, 0.0, 0.0, 0.0]];
  const GREEDY = ["A2", "A1", "B1", "C1", "D1", "D2"];
  // train_nursery_minus2.out.txt: nursery reward -2, everything else the same
  const NURSERY_R2 = -2;
  const FINAL_Q2_A2 = [1.57, 2.87, 2.87, 4.3];
  const GREEDY2 = ["A2", "B2", "C2", "D2"];
  // broken.out.txt
  const BROKEN_LINE = "{\"run\": \"broken\", \"mean_steps_per_50_episodes\": [17.1, 17.2, 17.8, 17.5], \"ran_out_of_steps_per_50_episodes\": [32, 29, 34, 32], \"last_10_lengths\": [20, 20, 9, 17, 20, 14, 20, 20, 20, 20], \"q_A2\": {\"up\": -9.999999993002099, \"down\": -9.99999999285931, \"left\": -9.999999992840277, \"right\": -18.999999988304808}, \"greedy_route_first_6\": [\"A2\", \"A2\", \"A2\", \"A2\", \"A2\", \"A2\"]}";
  const WORKING_LINE = "{\"run\": \"working\", \"mean_steps_per_50_episodes\": [7.1, 6.2, 6.2, 5.9], \"ran_out_of_steps_per_50_episodes\": [1, 0, 0, 0], \"last_10_lengths\": [5, 5, 7, 7, 5, 5, 6, 5, 5, 7], \"q_A2\": {\"up\": 3.121999999999999, \"down\": 1.8018468909347958, \"left\": 1.806569920727597, \"right\": -5.879390338007716}, \"greedy_route_first_6\": [\"A2\", \"A1\", \"B1\", \"C1\", \"D1\", \"D2\"]}";
  const BROKEN = JSON.parse(BROKEN_LINE), WORKING = JSON.parse(WORKING_LINE);

  // The listing is run_episode from docs/ai-path/runs/s3-rl-loop/trace_episode.py, line for line (line 0 = def).
  const CODE = [
    "def run_episode(q_table, rng, alpha, gamma, epsilon):",
    "    room = START",
    "    for step in range(MAX_STEPS):",
    "        if rng.random() < epsilon:",
    "            move = int(rng.integers(4))",
    "        else:",
    "            move = int(np.argmax(q_table[room]))",
    "        next_room, reward, docked = step_in_flat(room, move)",
    "        best_next = 0.0 if docked else q_table[next_room].max()",
    "        target = reward + gamma * best_next",
    "        q_table[room, move] += alpha * (target - q_table[room, move])",
    "        room = next_room",
    "        if docked:",
    "            return step + 1",
    "    return MAX_STEPS"
  ];
  // trace_episode.out.txt, episode 3 from its 14th move (step 13) to the return. Row: [line about to run, event
  // (l = line, r = return), step, room, move, next_room, reward, best_next, target, q_cell = q_table[room, move]]
  const TRACE = [[3,"l",13,0,0,0,-1,-1.275,-2.1475,-1.5450000000000002],[6,"l",13,0,0,0,-1,-1.275,-2.1475,-1.5450000000000002],[7,"l",13,0,3,0,-1,-1.275,-2.1475,-1.275],[8,"l",13,0,3,1,-1,-1.275,-2.1475,-1.275],[9,"l",13,0,3,1,-1,-0.75,-2.1475,-1.275],[10,"l",13,0,3,1,-1,-0.75,-1.675,-1.275],[11,"l",13,0,3,1,-1,-0.75,-1.675,-1.475],[12,"l",13,1,3,1,-1,-0.75,-1.675,-0.75],[2,"l",13,1,3,1,-1,-0.75,-1.675,-0.75],[3,"l",14,1,3,1,-1,-0.75,-1.675,-0.75],[6,"l",14,1,3,1,-1,-0.75,-1.675,-0.75],[7,"l",14,1,3,1,-1,-0.75,-1.675,-0.75],[8,"l",14,1,3,2,-1,-0.75,-1.675,-0.75],[9,"l",14,1,3,2,-1,-0.5,-1.675,-0.75],[10,"l",14,1,3,2,-1,-0.5,-1.45,-0.75],[11,"l",14,1,3,2,-1,-0.5,-1.45,-1.1],[12,"l",14,2,3,2,-1,-0.5,-1.45,-0.5],[2,"l",14,2,3,2,-1,-0.5,-1.45,-0.5],[3,"l",15,2,3,2,-1,-0.5,-1.45,-0.5],[4,"l",15,2,3,2,-1,-0.5,-1.45,-0.5],[7,"l",15,2,3,2,-1,-0.5,-1.45,-0.5],[8,"l",15,2,3,3,-1,-0.5,-1.45,-0.5],[9,"l",15,2,3,3,-1,5.0,-1.45,-0.5],[10,"l",15,2,3,3,-1,5.0,3.5,-0.5],[11,"l",15,2,3,3,-1,5.0,3.5,1.5],[12,"l",15,3,3,3,-1,5.0,3.5,0.0],[2,"l",15,3,3,3,-1,5.0,3.5,0.0],[3,"l",16,3,3,3,-1,5.0,3.5,0.0],[6,"l",16,3,3,3,-1,5.0,3.5,0.0],[7,"l",16,3,1,3,-1,5.0,3.5,5.0],[8,"l",16,3,1,7,10,5.0,3.5,5.0],[9,"l",16,3,1,7,10,0.0,3.5,5.0],[10,"l",16,3,1,7,10,0.0,10.0,5.0],[11,"l",16,3,1,7,10,0.0,10.0,7.5],[12,"l",16,7,1,7,10,0.0,10.0,0.0],[13,"l",16,7,1,7,10,0.0,10.0,0.0],[13,"r",16,7,1,7,10,0.0,10.0,0.0]];
  const RETURNED = 17;
  const LAST4_FIRST_STEP = 13; // the step value of the first of the four moves // trace_episode.out.txt {"returned": 17}

  /* ---------- Derived from the data ---------- */
  const NAME = i => "ABCD"[i % COLS] + (Math.floor(i / COLS) + 1);
  const IDX = s => "ABCD".indexOf(s[0]) + COLS * (+s[1] - 1);
  const KEY = i => `${Math.floor(i / COLS)},${i % COLS}`;
  const ROLE = i => i === START ? "start" : i === DOCK ? "dock" : NURSERY.includes(i) ? "nursery" : "";
  const isNursery = i => NURSERY.includes(i);
  const neighbours = (a, b) => { const ra = Math.floor(a / COLS), ca = a % COLS, rb = Math.floor(b / COLS), cb = b % COLS; return Math.abs(ra - rb) + Math.abs(ca - cb) === 1; };
  const rewardInto = (i, nr = NURSERY_R) => i === DOCK ? DOCK_R : isNursery(i) ? nr : STEP_R;
  const AROUND = ["A2", "A1", "B1", "C1", "D1", "D2"].map(IDX), THROUGH = ["A2", "B2", "C2", "D2"].map(IDX);
  const rewardsOf = (route, nr) => route.slice(1).map(i => rewardInto(i, nr));
  const total = (route, nr) => sum(rewardsOf(route, nr));
  const discounted = (route, nr) => rewardsOf(route, nr).reduce((acc, r, k) => acc + r * GAMMA ** k, 0);
  const update = (old, r, best) => old + ALPHA * (r + GAMMA * best - old);
  const r3 = x => Math.round(x * 1000) / 1000;
  const fmt = x => String(r3(x));
  const argmax = row => row.reduce((b, v, k) => v > row[b] ? k : b, 0); // first index on ties, like np.argmax
  // Q-table just before each of the last four updates of episode 3: start from the table before the episode and
  // apply the recorded values in order.
  const Q_BEFORE_LAST4 = (() => {
    const q = Q_BEFORE_EP3.map(r => r.slice()), snaps = [];
    EP3.forEach(([room, move, after], k) => { if (k >= EP3.length - LAST4.length) snaps.push(q.map(r => r.slice())); q[room][move] = after; });
    return snaps;
  })();
  const firstPositive = h => (h.find(([, v]) => v > 0) || [null])[0];
  const greedyFrom = q => { const out = [START]; let s = START; for (let k = 0; k < MAX_STEPS && s !== DOCK; k++) { const [dr, dc] = MOVES[argmax(q[s])]; const r = Math.floor(s / COLS) + dr, c = s % COLS + dc; s = r >= 0 && r < 2 && c >= 0 && c < COLS ? r * COLS + c : s; out.push(s); } return out.map(NAME); };

  /* ---------- Lesson-local style and pictures ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-flat { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; max-width: 380px; margin: 18px 0 0; }
      .lx-${ID}-sq { position: relative; min-height: 64px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); display: grid; place-items: center; align-content: center; gap: 2px; padding: 6px 2px; font: inherit; text-align: center; }
      button.lx-${ID}-sq { cursor: pointer; }
      .lx-${ID}-sq b { font: 700 17px var(--mono); }
      .lx-${ID}-sq small { font-size: 12px; color: var(--muted); }
      .lx-${ID}-sq.n { border: 2px dashed var(--ink-2); background: var(--sunk); }
      .lx-${ID}-sq.d { border: 4px double var(--ink); }
      .lx-${ID}-sq.now { box-shadow: 0 0 0 3px var(--ink); }
      .lx-${ID}-sq.on { background: var(--good-soft); border-color: var(--good); }
      .lx-${ID}-sq.bad { background: var(--bad-soft); border-color: var(--bad); }
      .lx-${ID}-sq i { position: absolute; top: 3px; left: 6px; font: 700 12px var(--mono); font-style: normal; color: var(--ink); }
      .lx-${ID}-q { margin: 16px 0 0; border-collapse: collapse; font: 500 14px var(--mono); }
      .lx-${ID}-q caption { text-align: left; font: 600 13px var(--font); color: var(--muted); padding-bottom: 6px; }
      .lx-${ID}-q th, .lx-${ID}-q td { padding: 5px 8px; border-bottom: 1px solid var(--line); text-align: right; }
      .lx-${ID}-q th { font-weight: 600; color: var(--muted); }
      .lx-${ID}-q th:first-child, .lx-${ID}-q td:first-child { text-align: left; }
      .lx-${ID}-q td.best { font-weight: 800; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
      .lx-${ID}-q td.hit { box-shadow: inset 0 0 0 2px var(--ink); }
      .lx-${ID}-q td.new { background: var(--good-soft); }
      .lx-${ID}-rules { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-rules li { padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; }
      .lx-${ID}-f { margin: 14px 0 0; padding: 10px 12px; border-left: 3px solid var(--ink); background: var(--sunk); font: 500 14.5px/1.6 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-log { margin: 14px 0 0; padding: 10px 12px; background: var(--code-bg); color: var(--code-ink); border-radius: 8px; font: 500 13.5px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-wrap { overflow-x: auto; }
      .lx-${ID}-code div { white-space: pre-wrap; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }
  // kit.code, but long lines wrap with a hanging indent instead of scrolling sideways on a phone
  function codeBox(kit, lines, active) {
    return `<pre class="lcode lx-${ID}-code">${lines.map((c, j) => {
      const n = c.length - c.trimStart().length;
      return `<div${j === active ? ' class="on"' : ""} style="padding-left: calc(12px + ${n + 4}ch); text-indent: -4ch">${kit.esc(c.trimStart()) || " "}</div>`;
    }).join("")}</pre>`;
  }
  // The flat: o.order {room: step number}, o.cls {room: "on" | "bad"}, o.now: the vacuum's square, o.pick: buttons
  function flat(kit, o = {}) {
    const order = o.order || {}, cls = o.cls || {};
    const cell = i => {
      const c = `lx-${ID}-sq${isNursery(i) ? " n" : ""}${i === DOCK ? " d" : ""}${o.now === i ? " now" : ""}${cls[i] ? " " + cls[i] : ""}`;
      const inner = `${order[i] != null ? `<i>${order[i]}</i>` : ""}<b>${NAME(i)}</b><small>${ROLE(i) || "&nbsp;"}</small>`;
      const label = `${NAME(i)}${ROLE(i) ? ", " + ROLE(i) : ""}${o.now === i ? ", the vacuum is here" : ""}`;
      return o.pick ? `<button type="button" class="${c}" data-i="${KEY(i)}" aria-label="${label}">${inner}</button>` : `<div class="${c}" aria-label="${label}">${inner}</div>`;
    };
    return `<div class="lx-${ID}-flat" role="group" aria-label="${kit.esc(o.title || "The flat")}">${[0, 1, 2, 3, 4, 5, 6, 7].map(cell).join("")}</div>`;
  }
  // A Q-table: rows = room indexes; o.hit [room, move] ringed; o.fresh [room, move] just updated; o.best underlines each row's best
  function qTable(kit, q, rows, o = {}) {
    const f = o.dp ? (x => x.toFixed(o.dp)) : fmt;
    const td = (room, m) => {
      const c = [o.hit && o.hit[0] === room && o.hit[1] === m ? "hit" : "", o.fresh && o.fresh[0] === room && o.fresh[1] === m ? "new" : "", o.best && room !== DOCK && argmax(q[room]) === m ? "best" : ""].filter(Boolean).join(" ");
      return `<td${c ? ` class="${c}"` : ""}>${f(q[room][m])}</td>`;
    };
    return `<div class="lx-${ID}-wrap"><table class="lx-${ID}-q">${o.title ? `<caption>${kit.esc(o.title)}</caption>` : ""}<thead><tr><th>square</th>${ACTIONS.map(a => `<th>${a}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr><td>${NAME(r)}</td>${ACTIONS.map((_, m) => td(r, m)).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const rules = () => `<ul class="lx-${ID}-rules">
      <li>Every move costs <b>${STEP_R}</b>, also a bump into a wall (the vacuum stays put).</li>
      <li>A move <b>into</b> a nursery square gives <b>${NURSERY_R}</b> instead.</li>
      <li>A move onto the dock gives <b>+${DOCK_R}</b> instead, and the trip ends.</li></ul>`;
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation: rewards turn "go home, avoid the nursery" into numbers. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const tA = total(AROUND), tT = total(THROUGH);
    const asStep = total(THROUGH, STEP_R); // nursery counted as an ordinary square
    const noDock = r => total(r) - DOCK_R;
    const opts = [
      `Around: ${tA}. Through: ${asStep}. The nursery way is shorter, so it wins.`,
      `Around: ${tA}. Through: ${tT}. The corridor wins.`,
      `Around: ${noDock(AROUND)}. Through: ${noDock(THROUGH)}. The corridor wins.`
    ];
    const RIGHT = 1;
    const fb = [
      [`${asStep} is what the nursery way earns if B2 and C2 cost ${STEP_R} like any square. They cost ${NURSERY_R} each, so the short way loses badly.`, false],
      [`Right. Around: ${rewardsOf(AROUND).join(" ")} = ${tA}. Through: ${rewardsOf(THROUGH).join(" ")} = ${tT}. The vacuum is never told “avoid the nursery” or “use the corridor”. It only gets these numbers, one per move, and has to find the best route by trying. That is <b>reinforcement learning</b>: learning what to do from rewards, by trial.`, true],
      [`Those totals leave out the last move. Moving onto the dock pays +${DOCK_R} instead of ${STEP_R}, and both routes end with that move.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Home to the dock, not through the nursery</h1>
        <p class="lead">So far your models learned from examples with the right answer. This lesson is about learning without right answers: a program makes a series of choices, and only a score tells it how well it did.</p>
        <p class="lead">A robot vacuum finishes on A2 and must drive to its dock on D2. The short way crosses the nursery, where a baby sleeps. The long way goes round by the corridor. Nobody draws it a map. It only knows which square it is on, and it can move up, down, left or right. After each move it gets a number, its <b>reward</b>:</p>
        ${flat(kit, { now: START, title: "The flat: two rows of four squares" })}
        ${rules()}
        <p class="task">Add up the rewards for the two routes: around (A2, A1, B1, C1, D1, D2) and through (A2, B2, C2, D2). Which line is right?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand: four Q-table updates from a recorded trip. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const cands = (old, r, best) => [
      [update(old, r, best), null],
      [r + GAMMA * best, "That is the target itself: you replaced the old number. The rule moves only half way (× 0.5) from the old number toward the target."],
      [old + ALPHA * (r + best - old), "You left out the 0.9. The next square's number counts 0.9 as much as a reward paid right now."],
      [old + ALPHA * (r + GAMMA * best), "You forgot to subtract the old number inside the brackets. The step is half of the <i>gap</i> between target and old number."],
      [old + ALPHA * (r - old), "You left out the next square. Without it the cell only learns about this one move and never hears about the dock."],
      [old + r + GAMMA * best, "You added the target to the old number. Take the gap (target − old), then half of it."]
    ];
    const paint = () => {
      const fin = k >= LAST4.length;
      const cur = LAST4[Math.min(k, LAST4.length - 1)];
      const [room, move, r, next, best, old, after] = cur;
      const q = fin ? Q_BEFORE_LAST4[LAST4.length - 1].map(x => x.slice()) : Q_BEFORE_LAST4[k];
      if (fin) q[room][move] = after;
      // options: right first, then the first two wrong values that differ from it and from each other
      const seen = new Set(), opts = [];
      for (const [v, why] of cands(old, r, best)) { const key = r3(v); if (seen.has(key)) continue; seen.add(key); opts.push([v, why]); if (opts.length === 3) break; }
      opts.sort((a, b) => a[0] - b[0]);
      const right = opts.findIndex(o => o[1] === null);
      const shownRows = [...new Set(LAST4.map(u => u[0]))];
      const doneRows = LAST4.slice(0, k).map(u => `${NAME(u[0])} ${ACTIONS[u[1]]}: ${fmt(u[5])} → <b>${fmt(u[6])}</b>`).join("<br>");
      el.innerHTML = `<h1>Fill in the Q-table by hand</h1>
        <p class="lead">The vacuum keeps a <b>Q-table</b>: one row per square, one number per move. The number is its current guess of how much reward that move leads to, from now on. Every number starts at 0. After each move it updates one number (one cell of the table):</p>
        <div class="lx-${ID}-f">new = old + ${ALPHA} × (reward + ${GAMMA} × best_next − old)</div>
        <p class="lead"><code>best_next</code> is the largest number in the row of the square it landed on (0 on the dock: the trip is over). The ${GAMMA} makes the future count a little less than a reward paid now. The ${ALPHA} moves the cell only half way toward the new estimate, so one lucky or unlucky move does not wipe out what it learned before. This is trip 3 of a real training run, so trips 1 and 2 have already changed some cells. You take over at its last four moves: A1 → B1 → C1 → D1 → dock.</p>
        ${qTable(kit, q, shownRows.concat([DOCK]).filter((v, i, a) => a.indexOf(v) === i), { hit: fin ? null : [room, move], fresh: fin ? [room, move] : null, title: fin ? "After the trip (the four cells you filled)" : `Before move ${k + 1} of 4` })}
        ${doneRows ? `<p class="lead">${doneRows}</p>` : ""}
        ${fin ? "" : `<p class="task">Move ${k + 1}: from ${NAME(room)} the vacuum went <b>${ACTIONS[move]}</b> to ${NAME(next)}, reward <b>${r}</b>. ${next === DOCK ? "It is on the dock, so best_next = 0." : `Read best_next from row ${NAME(next)}.`} What is the new value of the ringed cell?</p>`}
        <div class="lpanel">${fin ? kit.feedback(`All four match the run. Look at C1 right: its own reward was ${LAST4[2][2]}, yet it went from ${fmt(LAST4[2][5])} to ${fmt(LAST4[2][6])}, because D1's row already held ${fmt(LAST4[2][4])}. The +${DOCK_R} from the dock is leaking backward into the squares before it.`, true)
          : `${kit.options(opts.map(o => fmt(o[0])), { picked: wrong, correct: right, num: true })}${wrong != null ? kit.feedback(opts[wrong][1], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== right) { wrong = i; paint(); return; }
        wrong = null; k++; paint();
        if (k >= LAST4.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the dock's reward travels back one square at a time. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const cells = [["0,3", 0, 3], ["1,3", 1, 3], ["2,3", 2, 3], ["3,1", 3, 1]];
    const firsts = cells.map(([k]) => firstPositive(HISTORY[k]));
    const firstsBack = firsts.slice().reverse(); // D1 down, C1 right, B1 right, A1 right
    const order = [3, 2, 1, 0]; // columns: D1 down first, A1 right last
    const a1 = HISTORY["0,3"];
    const opts = [
      "The vacuum can see the dock from A1, so it heads for it",
      "Each update copies 0.9 × the next square's best number back into this cell, so the dock's reward moves back one square each time the vacuum drives that stretch",
      "Squares near the dock pay a small reward, so they turn positive first",
      "At the end of each trip the vacuum shares the +10 out over every move of that trip"
    ];
    const RIGHT = 1;
    const fb = [
      ["It sees nothing but the name of its square. A1 right was still " + fmt(a1.find(([e]) => e === 3)[1]) + " after trip 3, a trip that did reach the dock. Seeing the dock would have shown up at once.", false],
      [`Right. A cell only looks one move ahead: its reward plus 0.9 × the next square's best number. D1 learned from the dock, C1 from D1, B1 from C1, A1 from B1. That borrowing of the next guess is what makes Q-learning work without a map. It also means the news needs repeated trips to travel: here about one square further back every trip or two, in trips ${firstsBack.join(", ")} for D1, C1, B1 and A1.`, true],
      [`Every move in the corridor pays ${STEP_R}, the same as anywhere. Only the move onto the dock pays +${DOCK_R}. The rules on the first screen have no other reward.`, false],
      [`If it did, every move of trip 3 would have gained the same share. They did not: in trip 3 D1 down rose from ${fmt(Q_BEFORE_EP3[3][1])} to ${fmt(HISTORY["3,1"].find(([e]) => e === 3)[1])}, while A1 right fell from ${fmt(Q_BEFORE_EP3[0][3])} to ${fmt(a1.find(([e]) => e === 3)[1])}. Each update uses one move and happens right after that move.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>How did the news reach A1?</h1>
        <p class="lead">The same training run, trip by trip. The four cells on the corridor route, as they stood at the end of each trip (the first positive value in each column is ringed):</p>
        <div class="lx-${ID}-wrap"><table class="lx-${ID}-q"><thead><tr><th>trip</th>${order.map(j => `<th>${NAME(cells[j][1])} ${ACTIONS[cells[j][2]]}</th>`).join("")}</tr></thead><tbody>
        ${[1, 2, 3, 4, 5, 6, 7, 8].map(e => `<tr><td>${e}</td>${order.map(j => { const h = HISTORY[cells[j][0]].filter(([x]) => x <= e).pop(); return `<td${e === firsts[j] ? ' class="hit"' : ""}>${h ? h[1].toFixed(2) : "0.00"}</td>`; }).join("")}</tr>`).join("")}
        </tbody></table></div>
        <p class="lead">The +${DOCK_R} is only ever paid on the last move, D1 → dock. Yet A1 right, four moves away, turned positive in trip ${firsts[0]}.</p>
        <p class="task">What carried the dock's reward back to A1?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Predict the route once training ends. */
  function predictRoute({ el, done, kit }) {
    ensureStyle();
    const route = [START];
    let msg = null;
    const greedy = greedyFrom(FINAL_Q);
    const paint = () => {
      const at = route[route.length - 1], fin = at === DOCK;
      const order = {}; route.forEach((r, k) => { if (k) order[r] = k; });
      const cls = {}; route.slice(1).forEach(r => { cls[r] = "on"; });
      if (msg && msg.bad != null) cls[msg.bad] = "bad";
      el.innerHTML = `<h1>Where does it drive after training?</h1>
        <p class="lead">The run went on for ${EPISODES} trips. On each move the vacuum took the move with the biggest number in its row, except one move in five (ε = ${EPSILON}), when it picked a random move to keep exploring. Now training is over: it always takes the biggest number.</p>
        <p class="task">${fin ? "It reached the dock." : `Tap the squares of the route it drives, one move at a time. It is on ${NAME(at)}.`}</p>
        ${flat(kit, { now: at, order, cls, pick: !fin, title: "Tap the next square" })}
        <div class="lpanel">${msg ? kit.feedback(msg.html, false) : ""}
        ${fin ? `${qTable(kit, FINAL_Q, [0, 1, 2, 3, 4, 5, 6], { best: true, dp: 2, title: `The Q-table after ${EPISODES} trips (each row's biggest number underlined)` })}
          ${kit.feedback(`Right: ${greedy.join(" → ")}, the route the trained table drives (the run printed ${GREEDY.join(", ")}). Follow the underlined numbers from A2: up (${FINAL_Q[START][0].toFixed(2)}) beats right into the nursery (${FINAL_Q[START][3].toFixed(2)}). Nobody wrote “avoid the nursery”: the table learned it from ${NURSERY_R} rewards. A <b>state</b> is what the agent knows when it chooses (here, the square); an <b>action</b> is a move; the table maps each state and action to a learned value.`, true)}` : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-flat button`).forEach(b => b.onclick = () => {
        const [r, c] = b.dataset.i.split(",").map(Number), i = r * COLS + c, want = IDX(GREEDY[route.length]);
        if (i === want) { route.push(i); msg = null; paint(); if (i === DOCK) done(); return; }
        if (!neighbours(at, i)) msg = { html: `The vacuum moves one square at a time: up, down, left or right from ${NAME(at)}. ${NAME(i)} is not next to it.`, bad: i };
        else if (isNursery(i)) msg = { html: `${NAME(i)} is the nursery: ${NURSERY_R} for that move. Trained on these rewards, the vacuum prefers ${AROUND.length - 2} corridor moves at ${STEP_R} each to the ${THROUGH.filter(isNursery).length} nursery moves at ${NURSERY_R} each that the short way needs.`, bad: i };
        else if (route.includes(i)) msg = { html: `It was just on ${NAME(i)}. Going back adds a ${STEP_R} move and gets no closer to the dock; the trained values only grow toward the dock.`, bad: i };
        else msg = { html: `${NAME(i)} is a legal move but leads away from the dock. Each extra move costs ${STEP_R}, and the trained vacuum takes the shortest way that avoids the nursery.`, bad: i };
        paint();
      });
    };
    paint();
  }

  /* 5. The same thing in Python: a stepped replay of the traced episode. */
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const prev = TRACE[k - 1], v = TRACE[k];
      const f = { step: v[2], room: v[3], move: v[4], next: v[5], reward: v[6], best: v[7], target: v[8], q: v[9] };
      if (v[1] === "r") { fr.push({ ...f, ln: 13, kind: "end" }); continue; }
      if (prev[0] === 4 || prev[0] === 6) fr.push({ ...f, ln: prev[0], kind: prev[0] === 4 ? "random" : "greedy" });
      else if (prev[0] === 9) fr.push({ ...f, ln: 9, kind: "target" });
      else if (prev[0] === 10) fr.push({ ...f, ln: 10, kind: "update" });
    }
    return fr;
  })();
  function sayFrame(f) {
    const cell = `q_table[${NAME(f.room)}, ${ACTIONS[f.move]}]`;
    if (f.kind === "greedy") return `Move ${f.step + 1}${f.step === LAST4_FIRST_STEP ? " (your move 1 of 4)" : ""}. The random number was not below ε (epsilon), so the marked <code>np.argmax</code> line takes the biggest number in ${NAME(f.room)}'s row: <b>${ACTIONS[f.move]}</b>.`;
    if (f.kind === "random") { const row = Q_BEFORE_LAST4[f.step - LAST4_FIRST_STEP][f.room]; return `Move ${f.step + 1}. This time the random number was below ε = ${EPSILON}, so the marked <code>rng.integers(4)</code> line picked a random move: <b>${ACTIONS[f.move]}</b>. The table alone would have picked ${ACTIONS[argmax(row)]} (${row.map(fmt).join(", ")}; on a tie argmax takes the first). That is exploration: now and then try a move the table does not favour yet.`; }
    if (f.kind === "target") return `<code>step_in_flat</code> moved the vacuum to ${NAME(f.next)} with reward ${f.reward}. The <code>best_next</code> line read ${fmt(f.best)}${f.next === DOCK ? " (docked, so 0)" : ` from ${NAME(f.next)}'s row`}; the marked line made target = ${f.reward} + ${GAMMA} × ${fmt(f.best)} = ${fmt(f.target)}.`;
    if (f.kind === "update") return `The marked line moved ${cell} half way toward ${fmt(f.target)}: it is now <b>${fmt(f.q)}</b>, the same number you computed by hand.`;
    return `Docked: the function returns step + 1 = ${RETURNED}, the number of moves this trip took. The next trip starts again on A2 with the updated table.`;
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The same updates, in NumPy</h1>
        <p class="lead">This function drives one trip and updates the table after every move. <code>q_table</code> is an 8 × 4 NumPy array (8 squares, 4 moves). <code>step_in_flat</code> applies the move rules and rewards. <code>rng.random()</code> gives a random number between 0 and 1. <code>np.argmax</code> returns the first index of the biggest number. In this run alpha = ${ALPHA}, gamma = ${GAMMA} and epsilon = ${EPSILON}.</p>
        <p class="lead">We join trip 3 at the same four moves you did by hand: moves ${LAST4_FIRST_STEP + 1} to ${RETURNED} of that trip. In the line under the buttons, <b>cell</b> is <code>q_table[room, move]</code>. Every value comes from a traced run.</p>
        <p class="task">Step through to the end of the trip.</p>
        ${codeBox(kit, CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>room <b>${NAME(f.room)}</b></span><span>move <b>${ACTIONS[f.move]}</b></span>${f.kind === "greedy" || f.kind === "random" ? "" : `<span>reward <b>${f.reward}</b></span><span>target <b>${fmt(f.target)}</b></span>`}<span>cell <b>${fmt(f.q)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. The rewards decide the route: predict the run with a cheaper nursery. */
  function cheaperNursery({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const tA = total(AROUND, NURSERY_R2), tT = total(THROUGH, NURSERY_R2);
    const dA = discounted(AROUND, NURSERY_R2), dT = discounted(THROUGH, NURSERY_R2);
    const best2 = argmax(FINAL_Q2_A2);
    const opts = ["Around the corridor, as before", "Through the nursery", "It cannot choose: both routes total the same, so it keeps bumping walls"];
    const RIGHT = 1;
    const fb = [
      [`The plain totals tie: ${tA} around, ${tT} through. But the table does not add plain totals. Each step back multiplies by ${GAMMA}, so the dock's +${DOCK_R} is worth more when it comes sooner, and the nursery way gets there in ${THROUGH.length - 1} moves instead of ${AROUND.length - 1}.`, false],
      [`Right. The run drove ${GREEDY2.join(" → ")}. With the 0.9 per move: through = ${rewardsOf(THROUGH, NURSERY_R2).map((r, k) => k ? `${GAMMA}${k > 1 ? `^${k}` : ""} × ${r}` : r).join(" + ")} = ${r3(dT)}, around = ${r3(dA)}. The trained table agrees: A2 right is ${FINAL_Q2_A2[3]}, its biggest number. Same algorithm, different rewards, different behaviour. The rewards are the only way you tell the agent what you want, so a careless reward teaches the wrong thing. ${GAMMA} here is the <b>discount</b> γ: below 1, sooner rewards count more.`, true],
      [`A tie in plain totals is not a tie in the table: the discount makes the shorter route worth more (${r3(dT)} against ${r3(dA)}). And the vacuum always has a biggest number in its row; here A2 ${ACTIONS[best2]} with ${FINAL_Q2_A2[best2]}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Make the nursery cheaper</h1>
        <p class="lead">Same flat, same code, same seed, ${EPISODES} trips. One change: a move into a nursery square now gives <b>${NURSERY_R2}</b> instead of ${NURSERY_R}. Remember the update multiplies the next square's number by ${GAMMA}.</p>
        ${flat(kit, { now: START, title: "The flat" })}
        <p class="task">Which route does the trained vacuum drive now?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: a run that never learns. */
  const BUG = "        best_next = 0.0 if docked else q_table[room].max()";
  const BUG_CODE = CODE.map((l, k) => k === 8 ? BUG : l);
  function broken({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const lines = [6, 8, 9, 10];
    const RIGHT = 1;
    const qA2 = ACTIONS.map(a => BROKEN.q_A2[a]), left = argmax(qA2);
    const fb = [
      ["The argmax line takes the biggest number of the vacuum's own row, which is exactly how it should choose. It chooses badly because the numbers it reads are useless, and those come from the update.", false],
      [`Right. It reads the best number of the square it is <b>on</b>, not the one it moved <b>to</b>. Every cell then learns “${STEP_R} now, plus 0.9 × my own row”, which settles at about ${STEP_R} / (1 − ${GAMMA}) = ${r3(STEP_R / (1 - GAMMA))} everywhere: the dock's reward never travels back. A2's up, down and left end up equal except in the ninth decimal, and argmax picks ${ACTIONS[left]}: into the wall. Fix: <code>q_table[next_room].max()</code>. With it, the same printout reads ${WORKING.mean_steps_per_50_episodes.join(", ")} moves per trip and ${sum(WORKING.ran_out_of_steps_per_50_episodes)} capped trip${sum(WORKING.ran_out_of_steps_per_50_episodes) === 1 ? "" : "s"} in all.`, true],
      ["The target line is the textbook target: reward plus the discounted best next value. The values going into it are the problem, not the formula.", false],
      ["The update line moves the cell half way toward the target, as it should. It faithfully copies whatever target it gets. Look at where the target's second part comes from.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: it never finds the dock</h1>
        <p class="lead">A colleague retyped the training function. Same flat, same settings, same seed. One line differs from yours. This is the real printout after ${EPISODES} trips. “Episode” is the usual word for a trip, and a trip stops at ${MAX_STEPS} moves. <code>q_A2</code> is A2's row of the table. The “greedy” route is the one it drives when it always takes the biggest number.</p>
        <div class="lx-${ID}-log">${kit.esc(BROKEN_LINE)}</div>
        ${codeBox(kit, BUG_CODE, ans === RIGHT ? 8 : -1)}
        <p class="task">Which line is the bug?</p>
        <div class="lpanel">${ask(kit, lines.map(n => `<span class="lx-${ID}-opt">${kit.esc(BUG_CODE[n].trim())}</span>`), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const early = EARLY_LENGTHS.slice(0, 4), earlyN = sum(EARLY_NURSERY.slice(0, 4));
    const opts = ["The trial trips: early trips wander and drive into the nursery", "The size of the Q-table", "The computing time for the updates"];
    const RIGHT = 0;
    const fb = [
      [`Right. Q-learning learns only by trying. In the run, the first four trips took ${early.join(", ")} moves and entered the nursery ${earlyN} times. In a simulator that costs nothing; on a real vacuum it is a woken baby. That is why RL is trained in simulators when it can be.`, true],
      [`This table has ${8 * 4} numbers. It would only become a problem with very many states (every pixel of a camera image, for example), not here.`, false],
      [`Each update is a few multiplications and additions on one cell, one update per move. Computing is not what hurts; the trips are.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a Q-table</h1>
        <p class="lead"><b>What it is:</b> a table of learned values, one per state and move, filled in by trying moves and getting rewards. It is for a series of decisions where only a reward says how well it went, not a right answer per step.</p>
        <p class="lead"><b>Reach for it</b> when the states and moves are few enough to list in a table, and you can let the agent try many times, ideally in a simulator (a program that fakes the real world).</p>
        <p class="lead"><b>Not</b> when you already know the map and the costs: a shortest-path search finds the route with no trials. Not when you have the right answer for each example: that is supervised learning. Not when there are too many states to list, like camera images: then a neural network replaces the table.</p>
        <p class="lead"><b>Costs:</b> many trial runs, rewards that must be designed with care, and three settings to tune: the step size α (${ALPHA} here), the discount γ (${GAMMA}) and the exploration rate ε (${EPSILON}).</p>
        <p class="task">The company wants to train the real vacuum in a real flat, with no simulator. Which cost bites first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A warehouse robot must go between shelves on a floor plan you already have, with every aisle's length known.", false,
      "No. Nothing is unknown: a shortest-path search on the plan gives the best route at once, without a single trial trip. Q-learning is for when you cannot write the costs down and must learn them by trying.",
      "The map and the cost of every move are already known, so there is nothing to learn by trial. A shortest-path search computes the route directly; trial trips would only waste time."],
    ["A thermostat chooses heat on or off every 10 minutes. A simulator of the house gives a reward for comfort minus energy used. Its state is one of 20 temperature bands times the hour of day.", true,
      "Yes. A series of choices, a reward instead of a right answer, a few hundred states that fit in a table, and a simulator to practise in.",
      "There is no right answer per step to learn from, only a reward, and each choice changes the next temperature. With 20 × 24 states and a simulator, a Q-table fits well."],
    ["A delivery robot must learn to steer from its camera images, every frame a new picture.", false,
      "No, not with a table. Almost no two camera frames are the same, so a table would need a row for every possible image and would never see a row twice. Learning still fits, but a neural network must replace the table, so that similar images share what was learned.",
      "A Q-table only helps when the agent comes back to the same state many times. Camera frames almost never repeat, so each row would be visited once. You would need a network that generalises across images."],
    ["A drone in a simulator learns to land on a pad on a 6 × 6 grid. Gusts of wind sometimes push it one square sideways.", true,
      "Yes. 36 squares and a few moves fit in a table, the reward is clear (land, do not crash), and the simulator allows many tries. The random gusts are fine: the update averages over them because it moves only part of the way each time.",
      "Small grid, clear reward, a simulator for many tries: that is the Q-table's home ground. The gusts make moves uncertain, and Q-learning handles that by averaging many updates."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Q-table or not?</h1>
        <p class="lead">Four problems from other jobs. A Q-table agent learns one number per state and move from rewards, by trying many times.</p>
        <p class="task">Would you solve each one with tabular Q-learning? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can train a Q-table</h1>
      <p class="lead">You turned a goal into rewards, filled four Q-table cells by hand, saw the dock's reward travel back one square at a time, predicted the trained route, watched the rewards and the discount change it, and found the one-word bug that stops learning.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the ε-greedy choice and the Q-learning update in NumPy and train the vacuum until it drives the corridor route.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You built the loop by hand; next you run a standard RL environment and judge when a real product needs RL at all.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Rewards, states and a tiny Q-table",
    checked: "2026-11-14",
    sources: [
      "https://incompleteideas.net/book/the-book-2nd.html",
      "https://doi.org/10.1007/BF00992698",
      "https://numpy.org/doc/stable/reference/generated/numpy.argmax.html",
      "https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.integers.html",
      "https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.random.html"
    ],
    interview: [
      {
        q: "You trained a tabular Q-learning agent on a grid task. After hundreds of episodes it still hits the step limit most of the time. How do you debug it?",
        good: [
          "Print the Q-table: if every value sits near the same number, values are not flowing back from the goal",
          "Check the target uses the next state's best value, and 0 at the goal (terminal state)",
          "Check the reward actually reaches the agent at the goal, with the right sign",
          "Check exploration: ε above 0 so every state and move keeps being tried",
          "Trace one episode by hand: state, move, reward, target, new value"
        ],
        weak: "Train for more episodes or tune the learning rate, without looking at whether the values carry the goal's reward back at all."
      },
      {
        q: "A product manager wants to use Q-learning so a robot finds routes in buildings whose floor plans you already have. What do you say?",
        good: [
          "With a known map and known costs, a shortest-path search gives the best route directly, with no trial runs",
          "Q-learning learns by trying, which costs many runs and real mistakes without a simulator",
          "RL fits when the effect of actions is unknown or random and only a reward says what is good",
          "If the states are huge (camera input), a table does not work; you would need a neural network"
        ],
        weak: "Agree because RL is the modern way to do robotics, without asking what is unknown and what each trial costs."
      }
    ],
    screens: [situation, byHand, spotIdea, predictRoute, asCode, cheaperNursery, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(LAST4.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="1,1"]'], right: GREEDY.slice(1).map(s => `[data-i="${KEY(IDX(s))}"]`) },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
