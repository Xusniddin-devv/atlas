/* Lesson: recurrent networks, one hidden state carried along. Story: a smart doorbell reads a stream of sensor
   events (quiet, motion out at the street, motion at the door) and must decide at the end: a visitor, or not.
   Ideas: (1) a recurrent cell updates one small hidden state per event with the same rule and the same weights,
   h = tanh(W_x·x + W_h·h_old + b), so the state is a running summary in which order matters and recent events
   count most; (2) the state and the weights stay the same size for any length of stream, and the steps must run
   one after another.
   Data, all real, from docs/ai-path/runs/s4-rnn-forward/:
   - doorbell_rnn.py + doorbell_rnn.out.txt: the hand-chosen weights, the three event streams (visitor, leaving,
     car) step by step, the event counts, a 40-event stream, and the line-by-line trace of doorbell() on the
     visitor stream (the code screen's listing is that function, line for line);
   - torch_check.py + torch_check.out.txt: torch.nn.RNN with the same weights gives the same hidden states.
   No model recordings. Lesson-local style: event strip, rule box and mono options (.lx-s4-rnn-forward-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s4-rnn-forward";
  const f2 = n => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);
  const vec = a => `[${a.map(f2).join(", ")}]`;
  const arr = a => `[${a.map(t => (t < 0 ? "−" + -t : t)).join(", ")}]`;
  const mat = M => `[${M.map(arr).join(", ")}]`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  // From doorbell_rnn.py: x = [motion, near]; weights chosen by hand for the lesson, not trained.
  const EVENTS = { quiet: [0, 0], far: [1, 0], near: [1, 1] };
  const W_X = [[0, 1], [1, -1]];
  const W_H = [[0.5, 0], [0, 0.5]];
  const B = [0, 0];
  const V = [3, -2], C = -1;
  const UNITS = ["door", "street"];
  // From doorbell_rnn.out.txt: per step [event, z, h]; p = p_visitor
  const RUN = {
    visitor: { steps: [["far", [0.0, 1.0], [0.0, 0.7616]], ["near", [1.0, 0.3808], [0.7616, 0.3634]], ["near", [1.3808, 0.1817], [0.8811, 0.1797]], ["near", [1.4406, 0.0899], [0.8938, 0.0896]]], p: 0.8179 },
    leaving: { steps: [["near", [1.0, 0.0], [0.7616, 0.0]], ["near", [1.3808, 0.0], [0.8811, 0.0]], ["near", [1.4406, 0.0], [0.8938, 0.0]], ["far", [0.4469, 1.0], [0.4194, 0.7616]]], p: 0.2201 },
    car: { steps: [["quiet", [0.0, 0.0], [0.0, 0.0]], ["far", [0.0, 1.0], [0.0, 0.7616]], ["far", [0.0, 1.3808], [0.0, 0.8811]], ["quiet", [0.0, 0.4406], [0.0, 0.4141]]], p: 0.1384 }
  };
  // doorbell_rnn.out.txt "long stream" line: 40 events (far, then 39 near), h shape (2,)
  const LONG = { events: 40, hLen: 2, h: [0.8952, 0.0] };
  // torch_check.out.txt: torch.nn.RNN hidden states for the visitor stream, and its parameter count
  const TORCH = { h: [[0.0, 0.7616], [0.7616, 0.3634], [0.8811, 0.1797], [0.8938, 0.0896]], params: 12 };

  // The listing is doorbell() from doorbell_rnn.py, line for line (line 0 = def).
  const CODE = [
    "def doorbell(events, W_x, W_h, b, v, c):",
    "    h = np.zeros(2)",
    "    for x in events:",
    "        z = W_x @ x + W_h @ h + b",
    "        h = np.tanh(z)",
    "    score = v @ h + c",
    "    return 1 / (1 + np.exp(-score))"
  ];
  // Trace rows from doorbell_rnn.out.txt "== trace visitor": [line about to run, event, h, x, z, score]
  const TRACE = [
    [1, "l", null, null, null, null],
    [2, "l", [0.0, 0.0], null, null, null],
    [3, "l", [0.0, 0.0], [1.0, 0.0], null, null],
    [4, "l", [0.0, 0.0], [1.0, 0.0], [0.0, 1.0], null],
    [2, "l", [0.0, 0.7616], [1.0, 0.0], [0.0, 1.0], null],
    [3, "l", [0.0, 0.7616], [1.0, 1.0], [0.0, 1.0], null],
    [4, "l", [0.0, 0.7616], [1.0, 1.0], [1.0, 0.3808], null],
    [2, "l", [0.7616, 0.3634], [1.0, 1.0], [1.0, 0.3808], null],
    [3, "l", [0.7616, 0.3634], [1.0, 1.0], [1.0, 0.3808], null],
    [4, "l", [0.7616, 0.3634], [1.0, 1.0], [1.3808, 0.1817], null],
    [2, "l", [0.8811, 0.1797], [1.0, 1.0], [1.3808, 0.1817], null],
    [3, "l", [0.8811, 0.1797], [1.0, 1.0], [1.3808, 0.1817], null],
    [4, "l", [0.8811, 0.1797], [1.0, 1.0], [1.4406, 0.0899], null],
    [2, "l", [0.8938, 0.0896], [1.0, 1.0], [1.4406, 0.0899], null],
    [5, "l", [0.8938, 0.0896], [1.0, 1.0], [1.4406, 0.0899], null],
    [6, "l", [0.8938, 0.0896], [1.0, 1.0], [1.4406, 0.0899], 1.5021901290915713],
    [6, "r", [0.8938, 0.0896], [1.0, 1.0], [1.4406, 0.0899], 1.5021901290915713]
  ];
  const RESULT = 0.8179; // "result" line of the trace

  /* ---------- Derived from the data ---------- */
  const mv = (M, x) => M.map(r => r[0] * x[0] + r[1] * x[1]);
  const add = (...vs) => vs[0].map((_, i) => vs.reduce((s, v) => s + v[i], 0));
  const scale = (k, v) => v.map(t => t * k);
  const tanh = v => v.map(Math.tanh);
  const N_WEIGHTS = W_X.length * W_X[0].length + W_H.length * W_H[0].length + B.length;
  const countOf = seq => Object.fromEntries(Object.keys(EVENTS).map(k => [k, seq.filter(e => e === k).length]));
  const seqOf = name => RUN[name].steps.map(s => s[0]);
  const TORCH_SAME = TORCH.h.every((h, i) => h.every((t, j) => t === RUN.visitor.steps[i][2][j]));
  const KEEP = W_H[0][0]; // the share of its own old value each unit keeps (same for both units)

  // Rule for one unit, written from W_x, W_h and b: "tanh(1 × near + 0.5 × door_old)"
  const INPUTS = ["motion", "near"];
  function ruleOf(u) {
    const t = [];
    W_X[u].forEach((w, j) => { if (w) t.push([w, INPUTS[j]]); });
    W_H[u].forEach((w, j) => { if (w) t.push([w, UNITS[j] + "<sub>old</sub>"]); });
    if (B[u]) t.push([B[u], ""]);
    const term = ([w, n]) => `${Math.abs(w)}${n ? " × " + n : ""}`;
    return `tanh(${t.map((x, i) => (i === 0 ? (x[0] < 0 ? "−" : "") : x[0] < 0 ? " − " : " + ") + term(x)).join("")})`;
  }

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-rule { margin: 14px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); }
      .lx-${ID}-rule div { font: 500 14.5px/1.7 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
      .lx-${ID}-rule b { font-weight: 700; }
      .lx-${ID}-rule p { margin: 6px 0 0; font-size: 14px; color: var(--muted); line-height: 1.45; }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-strips { display: grid; gap: 12px; margin-top: 14px; }
      .lx-${ID}-strips h3 { margin: 0 0 4px; font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    `;
    document.head.appendChild(s);
  }
  const opt = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  const ruleBox = () => `<div class="lx-${ID}-rule">${UNITS.map((u, i) => `<div><b>${u}</b> = ${ruleOf(i)}</div>`).join("")}
    <p>Each event is x = [motion, near]: quiet ${arr(EVENTS.quiet)}, far ${arr(EVENTS.far)}, near ${arr(EVENTS.near)}. The numbers 1, −1 and 0.5 in the rule are the cell's weights, chosen by hand for this lesson. The state h = [door, street] starts at [0, 0]. tanh squashes any sum into −1 to 1: ${[0, 0.25, 0.5, 1, 1.5, 2].map(z => `tanh(${z}) = ${f2(Math.tanh(z))}`).join(", ")}.</p></div>`;
  const strip = (kit, name, at = -1) => kit.cells(seqOf(name), { cls: at >= 0 ? { [at]: "next" } : {}, labels: seqOf(name).map((_, i) => "step " + (i + 1)) });
  const stripBlock = (kit, rows) => `<div class="lx-${ID}-strips">${rows.map(([t, name, at]) => `<div><h3>${kit.esc(t)}</h3>${strip(kit, name, at)}</div>`).join("")}</div>`;
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;

  /* 1. The situation: same events, opposite meanings. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const cv = countOf(seqOf("visitor")), cl = countOf(seqOf("leaving"));
    const opts = [
      "The visitor stream has more near events, so the counts differ",
      "The counts differ, because the second stream ends with far",
      `The counts are the same (far ${cv.far}, near ${cv.near}), so a count cannot tell them apart`
    ];
    const fb = [
      [`Count them: near ${cv.near} times in the first, ${cl.near} times in the second. The difference is not how many, it is when.`, false],
      ["A count records how many times each event happened, not where. The far at the end and the far at the start add the same 1 to the count.", false],
      [`Right. The counts match exactly, but the meaning is opposite: one person walks up and stays, the other stood at the door and then walked away. Bag of words counts instead of reading, so it throws away the one thing that matters here: order. A word-pair model sees order, but only one step back. The doorbell needs something that reads the events in order and carries what it has seen so far.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Visitor or not?</h1>
        <p class="lead">A smart doorbell has a motion sensor. Every few seconds it reports one event: <b>quiet</b>, <b>far</b> (motion out at the street) or <b>near</b> (motion at the door). It should ring the owner's phone for a visitor, and stay silent for a passing car or a neighbour walking away. It has to decide from the stream, one event at a time. Text poses the same problem: a sentence is a stream of words, and their order changes the meaning.</p>
        ${stripBlock(kit, [["Stream 1: someone walks up and waits", "visitor"], ["Stream 2: someone at the door walks away", "leaving"]])}
        <p class="task">You build the doorbell's input by counting each kind of event in a stream. What do the two counts look like?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 2. By hand: the hidden state after each of four steps of the visitor stream. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const steps = RUN.visitor.steps;
    let k = 0, ans = null;
    // options for step k: the run's value, then the usual mistakes, computed from the weights and the run's previous h
    const build = k => {
      const [ev, z, h] = steps[k];
      const x = EVENTS[ev], prev = k ? steps[k - 1][2] : [0, 0];
      const inp = add(mv(W_X, x), B);
      const cand = [
        [z, h, null],
        [inp, tanh(inp), `You left out the old state. The rule adds ${KEEP} × the old value of each unit; without it, every step forgets everything before it, and the cell is just a layer that sees one event.`],
        [add(inp, prev), tanh(add(inp, prev)), `You added the whole old value. The weight on the old state is ${KEEP}: each unit keeps only that share of what it had.`],
        [z, z, "That is z, the sum before tanh. The cell squashes every sum with tanh, so h always stays between −1 and 1."],
        [z, [...h].reverse(), `The numbers are right but in the wrong places. h = [door, street]: door listens to near, street to motion that is not near.`]
      ];
      const seen = new Set(), out = [];
      for (const c of cand) { const s = `z = ${vec(c[0])}  →  h = ${vec(c[1])}`; if (!seen.has(s)) { seen.add(s); out.push([s, c[2]]); } }
      // fixed shuffle so the right one is not always first: rotate by step
      const rot = (k + 1) % out.length;
      const shown = out.slice(rot).concat(out.slice(0, rot));
      return { opts: shown.map(o => o[0]), right: shown.findIndex(o => o[1] === null), why: shown.map(o => o[1]) };
    };
    const paint = () => {
      const fin = k >= steps.length;
      const q = fin ? null : build(k);
      const rows = steps.slice(0, k).map(([e, , h], i) => [`${i + 1}  ${e}`, vec(h)]);
      el.innerHTML = `<h1>Carry the state by hand</h1>
        <p class="lead">The doorbell's model keeps two numbers, its <b>state</b> h = [door, street]. Each number is one <b>unit</b> of the cell. For each event, the cell computes a new state from the event and the old state. It uses this rule, the same at every step:</p>
        ${ruleBox()}
        ${strip(kit, "visitor", fin ? -1 : k)}
        ${kit.table(rows, { head: ["step  event", "h = [door, street]"], title: "The visitor stream", fresh: rows.length - 1, empty: "no steps yet" })}
        ${fin ? "" : `<p class="task">Step ${k + 1}: the event is <b>${steps[k][0]}</b> and the old state is ${vec(k ? steps[k - 1][2] : [0, 0])}. Work out z, the sum inside tanh, for both units, then pick the line that matches.</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Done: four events in, and the state is ${vec(steps[3][2])}. Door rose with each near event, and each rise was smaller: tanh flattens as it nears 1. Street jumped at the first far event, then halved and shrank on every step after it. You will check these against the NumPy run later.`, true)
          : `${kit.options(q.opts.map(s => opt(kit, s)), { picked: ans, correct: q.right })}${ans != null && ans !== q.right ? kit.feedback(q.why[ans], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === build(k).right) { k++; ans = null; paint(); if (k >= steps.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 3. Spot the idea: what is h? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const hv = RUN.visitor.steps[3][2], hl = RUN.leaving.steps[3][2], one = RUN.leaving.steps[0][2];
    const opts = [
      "An encoding of the last event only",
      "A count of how often each event happened",
      "A list of all the events so far",
      "A running summary of everything so far, squeezed into the same two numbers, in which recent events weigh most"
    ];
    const fb = [
      [`A single near from a fresh start gives ${vec(one)}. The visitor's final state is ${vec(hv)}: the earlier near events pushed door higher, and the far event three steps back still shows in street. The past is in there.`, false],
      [`The leaving stream has the same counts, and the same cell ends it at ${vec(hl)}, not ${vec(hv)}. A count cannot depend on order; h does.`, false],
      ["It is two numbers after one event and two numbers after four. It cannot hold a list that grows; it has to squeeze.", false],
      [`Right. h is the <b>hidden state</b>: the network's memory of the stream so far, always the same size. Each step mixes the new event into it with the same weights, and multiplies the old part by ${KEEP}, so older events fade. That carried state is what makes this a <b>recurrent</b> network: the output of one step goes back in as input to the next.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What do the two numbers hold?</h1>
        <p class="lead">After the visitor stream, the doorbell holds only h = ${vec(hv)}. It has not kept the events themselves.</p>
        ${strip(kit, "visitor")}
        <p class="task">Which description of h fits what you computed?</p>
        <div class="lpanel">${ask(kit, opts, 3, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 3) done(); });
    };
    paint();
  }

  /* 4. Predict: the leaving stream, step by step, then the decision. */
  function predict({ el, done, kit }) {
    ensureStyle();
    const L = RUN.leaving.steps;
    let k = 0, ans = null; // 0: door after step 3; 1: state after step 4; 2: p(visitor); 3: finished
    const d2 = L[1][2][0], d3 = L[2][2][0], d4 = L[3][2][0], s4 = L[3][2][1];
    const Q = [
      { t: `Door is ${f2(d2)} after two near events. Step 3 is near again. Where does door go?`, right: 1,
        opts: [`Above 1: about ${f2(d2)} + ${f2(L[0][2][0])}`, `A little above ${f2(d2)}`, `Back to ${f2(L[0][2][0])}, as after the first near`],
        fb: [["tanh never reaches 1, whatever the sum. The sum z grows, but its tanh flattens out.", false], null, [`That would be true if the cell forgot the old state. It keeps ${KEEP} × ${f2(d2)}, so z is bigger than after the first near.`, false]],
        ok: `Right: ${f2(d3)}. z grew to ${f2(L[2][1][0])}, but tanh is flat up there, so door barely moves. The state is saturated: more of the same adds almost nothing.` },
      { t: "Step 4 is far: motion, but not at the door. What happens to the state?", right: 2,
        opts: [`Door stays at ${f2(d3)}: nothing at the door changed it`, "Both units drop to 0", `Door falls to under half of ${f2(d3)}, and street jumps`],
        fb: [[`Door gets nothing new from a far event (its rule has no motion term), so all it has is ${KEEP} × ${f2(d3)}, then tanh. Without new near events, the memory fades.`, false], [`Street listens to motion that is not near, and this event is exactly that: its z is ${f2(L[3][1][1])}. Door keeps part of its old value.`, false], null],
        ok: `Right: ${vec(L[3][2])}. Door kept ${KEEP} × ${f2(d3)} = ${f2(L[3][1][0])}, and tanh made it ${f2(d4)}. Street went from 0 to ${f2(s4)} in one step: the newest event weighs most.` },
      { t: `The doorbell's last layer turns h into a probability of a visitor (sigmoid squashes any sum into 0 to 1): sigmoid(${V[0]} × door − ${-V[1]} × street ${C < 0 ? "− " + -C : "+ " + C}). For the visitor stream it gave ${f2(RUN.visitor.p)}. For this stream, with the same events?`, right: 1,
        opts: [`The same ${f2(RUN.visitor.p)}: the same events went in`, "Much lower: the last thing it saw was someone moving away", "Higher: it saw near events earlier"],
        fb: [[`Only the order differs, and the state at the end differs with it: ${vec(L[3][2])} here, ${vec(RUN.visitor.steps[3][2])} for the visitor. The last layer reads only h.`, false], null, ["Early events fade by the end. What is left in h leans on the last steps, and the last step here was street motion.", false]],
        ok: `Right: ${f2(RUN.leaving.p)} against ${f2(RUN.visitor.p)}. The doorbell stays silent. Same events, opposite decisions, because the hidden state carried the order.` }
    ];
    const known = () => L.slice(0, Math.min(k + 2, L.length)).map(([e, , h], i) => [`${i + 1}  ${e}`, vec(h)]);
    const paint = () => {
      const fin = k >= Q.length, q = Q[Math.min(k, Q.length - 1)];
      el.innerHTML = `<h1>Predict the walk-away</h1>
        <p class="lead">Now the second stream, someone leaving, through the same cell with the same weights.</p>
        ${strip(kit, "leaving", fin ? -1 : Math.min(k + 2, 3))}
        ${kit.table(known(), { head: ["step  event", "h = [door, street]"], title: "The leaving stream", fresh: known().length - 1 })}
        ${fin ? "" : `<p class="task">${q.t}</p>`}
        <div class="lpanel">${fin ? kit.feedback(Q[2].ok, true) : `${kit.options(q.opts, { picked: ans, correct: q.right })}${ans != null && ans !== q.right ? kit.feedback(q.fb[ans][0], false) : ""}${k > 0 ? kit.feedback(Q[k - 1].ok) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[k].right) { k++; ans = null; paint(); if (k >= Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. The same forward pass in NumPy, as a stepped replay of the traced run, checked against the hand values. */
  const sayFrame = (r, i) => {
    const [ln, ev, h, x, z, score] = r, step = TRACE.slice(0, i + 1).filter(t => t[0] === 3).length;
    if (ev === "r") return `It returns ${f2(RESULT)}: the probability of a visitor, the same number you saw before. The whole forward pass is one loop over the events with two lines of real work in it.`;
    if (ln === 1) return "The doorbell starts with a fresh state of two zeros.";
    if (ln === 2) return step ? `State after ${plural(step, "step")}: h = ${vec(h)}. Back to the top: is there another event?` : "Now the loop takes the events one at a time, in order.";
    if (ln === 3) return `Event ${step} is x = [${x.join(", ")}]. The highlighted line mixes it with the old state h = ${vec(h)} using the same W_x and W_h as every other step.`;
    if (ln === 4) return `z = ${vec(z)}. The highlighted line squashes it with tanh into the new state.`;
    if (ln === 5) return `No events left. The last layer reads only the final state ${vec(h)}.`;
    if (ln === 6) return `score = ${score.toFixed(4)}. The sigmoid turns it into a probability.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const hand = RUN.visitor.steps.map(s => s[2]);
    const paint = () => {
      const r = TRACE[i], last = i === TRACE.length - 1;
      el.innerHTML = `<h1>The same thing in NumPy</h1>
        <p class="lead">This is the doorbell's whole forward pass. <code>@</code> is a matrix product, as in the forward pass of a plain network. W_x holds the rule's weights on the event, W_h the weights on the old state, and b the bias. The run used the numbers from your rule box: W_x = ${mat(W_X)}, W_h = ${mat(W_H)}, b = ${arr(B)}. v = ${arr(V)} and c = ${C < 0 ? "−" + -C : C} are the last layer's numbers.</p>
        <p class="task">Step through the run on the visitor stream. Watch which lines repeat.</p>
        ${kit.code(CODE, r[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>x <b>${r[3] ? "[" + r[3].join(", ") + "]" : "–"}</b></span><span>z <b>${r[4] ? vec(r[4]) : "–"}</b></span><span>h <b>${r[2] ? vec(r[2]) : "–"}</b></span><span>frame <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(sayFrame(r, i))}
        ${last ? `${kit.table(hand.map(h => [vec(h), `[${h.map(t => t.toFixed(4)).join(", ")}]`]), { head: ["your cells", "the NumPy run"], title: "Check, steps 1 to 4" })}
          <p class="lead">They match to two decimals. PyTorch's <code>torch.nn.RNN</code> computes the same rule (it keeps two bias vectors, so it counts ${TORCH.params} weights where this cell has ${N_WEIGHTS}); loaded with these weights, it gave ${TORCH_SAME ? "the same four states" : "different states"} in our run.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 6. Any length: the state and the weights do not grow. */
  function anyLength({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `${LONG.events * 2} numbers of state, and a new set of weights for every event`,
      `${LONG.hLen} numbers of state, and the same ${N_WEIGHTS} weights at every event`,
      `${LONG.hLen} numbers of state, and a new set of weights for every event`
    ];
    const fb = [
      ["The state never grows: each step overwrites h with a new h of the same size. And the loop uses one W_x, one W_h and one b for every event.", false],
      [`Right. Our run of the ${LONG.events}-event stream ended with h = ${vec(LONG.h)}: two numbers, door saturated near its top. The ${N_WEIGHTS} weights (${W_X.length * W_X[0].length} in W_x, ${W_H.length * W_H[0].length} in W_h, ${B.length} in b) are shared by every step. That is why one network handles streams of any length, and why the rule for a near event at step 2 is the same rule at step 39. The price: a stream of ${LONG.events} events is ${LONG.events} steps that must run one after another, because each needs the state from the step before.`, true],
      [`Look at the loop again: W_x and W_h are passed in once and used on every turn. A new set per event would mean a network that only works for one length of stream.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A courier waits forty events</h1>
        <p class="lead">A courier walks up and waits at the door with a parcel: one far event, then near, near, near… ${LONG.events} events in all.</p>
        ${kit.code(CODE, ans === 1 ? 3 : -1)}
        <p class="task">After event ${LONG.events}, how much state does the doorbell hold, and how many weights did it use?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `Too many weights: the cell is too big`,
      "Each step needs the state from the step before, so a long stream cannot be split up and run all at once",
      "The hidden state grows with the length of the stream and fills memory"
    ];
    const fb = [
      [`This cell has ${N_WEIGHTS} weights. Size is not what makes it slow.`, false],
      ["Right. A GPU is fast when it can do many independent pieces of work at once. Inside one stream, step 40 waits for step 39. The paper that introduced the transformer named exactly this: the sequential nature of recurrent models prevents parallel work within a training example.", true],
      [`The state is ${LONG.hLen} numbers after one event and after ${LONG.events}. It never grows.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a recurrent network</h1>
        <p class="lead"><b>For:</b> ordered streams of any length where order changes the meaning, read one item at a time with a small running state: sensor events, short signals, small on-device models.</p>
        <p class="lead"><b>Not</b> when order does not matter (count features and use a plain network), or when one event far back must be kept exactly: in this cell, each step without new input at least halves an old trace. For long text, look at attention-based models (the transformer, later in this stage): they connect any two positions directly instead of passing everything through every step.</p>
        <p class="lead"><b>Costs:</b> cheap to run one event at a time; slow to train on long streams; the fixed state loses detail.</p>
        <p class="task">Your team trains a doorbell cell like this one on a year of long event logs, on a GPU. Training is slow. Which cost is biting?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A smartwatch reads one heart-rate sample per second and should flag an irregular rhythm: the same beats in a different order mean something else.", true,
      "Yes. Ordered samples, any length, order carries the meaning, and the watch can update a small state with each sample as it arrives.",
      "Here order is the signal: the same samples in another order are a different rhythm, and a count would lose that. A small state updated per sample is the fit."],
    ["Predict a flat's rent from its size, number of rooms and district.", false,
      "No. These are three facts about one flat, not a stream; there is no first or last. A plain network (or a simpler model) takes them all at once.",
      "There is no order to read: size, rooms and district do not come one after another. Feeding them as steps would invent an order that means nothing. Use a plain network on the three features."],
    ["Check whether clause 2 of a 300-page contract is contradicted on page 290.", false,
      "No. A plain recurrent cell would have to carry clause 2 through hundreds of pages in a small fixed state, and in a cell like ours each step without fresh input shrinks an old trace by at least half. Attention-based models, or search over the pages, can look back at clause 2 directly.",
      "The trouble is the distance. Everything about clause 2 must survive hundreds of steps in a few numbers, and in a cell like ours an old trace at least halves each step it is not refreshed. The transformer paper names the general problem: in a recurrent layer the path between two positions grows with their distance, and long paths make long-range links harder to learn. Something that can look back at clause 2 directly is the better tool."],
    ["A machine's vibration sensor reports every second; a jam is coming when short shakes start to come closer together.", true,
      "Yes. What matters is the pattern over time, which a running state updated per reading can pick up, and it runs on a small device as readings arrive.",
      "The warning is in the order and spacing of the shakes, not in their count. A small state carried from reading to reading is what can notice that."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Recurrent or not?</h1>
        <p class="lead">Four jobs from other teams. A recurrent network reads items in order and carries one fixed-size state from each step to the next.</p>
        <p class="task">Is a recurrent network a good fit for each? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can run a recurrent network</h1>
      <p class="lead">You carried a two-number hidden state through four events by hand, saw that the same events in another order end in a different state and a different decision, and checked your cells against a NumPy run. The state and the weights stay the same size for any length; the steps run one after another.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the forward loop yourself and return the hidden state after every event of a stream.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You saw old events fade from the state on the way forward; next you see what that does to training, when the error has to travel back through every step.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Recurrent networks: one hidden state carried along",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.RNN.html",
      "https://arxiv.org/abs/1706.03762"
    ],
    interview: [
      {
        q: "You have one sensor reading per second and must flag a machine jam. A colleague averages each minute of readings and feeds the averages to a plain network. When does that fail, and what would a recurrent network add?",
        good: [
          "An average or a count loses order: two minutes with the same readings in a different order look identical",
          "A recurrent network reads the readings in order and carries a fixed-size hidden state from step to step",
          "It uses the same weights at every step, so it works for any length and can run as readings arrive",
          "Costs: steps run one after another, so training on long streams is slow, and old details fade from the small state",
          "If order truly does not matter for the jam, the averages and a plain network are cheaper and fine"
        ],
        weak: "Say a recurrent network is more powerful and use it, without saying that the averages lose order or when that order matters."
      },
      {
        q: "A recurrent model reads 500-message support chats and flags angry customers. It catches anger in the last messages but misses anger that was only in the first few. A colleague wants to double the hidden state size. What do you tell them?",
        good: [
          "The hidden state is a fixed-size running summary, the same size after 1 message or 500, not a copy of the chat",
          "Each step mixes the new message in with the same weights, so recent messages tend to weigh most and early ones fade",
          "Anger in message 3 must survive hundreds of updates to reach the decision; a bigger state does not shorten that path",
          "Options: a model that can look back at early messages directly (attention), or a simpler feature such as flagging each message on its own"
        ],
        weak: "Agree that a bigger state will remember more, without seeing that the problem is the number of steps the early signal must survive."
      }
    ],
    screens: [situation, byHand, spotIdea, predict, asCode, anyLength, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(RUN.visitor.steps.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
