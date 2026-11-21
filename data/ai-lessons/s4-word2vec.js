/* Lesson: train a tiny word2vec and find neighbours. Story: a Tashkent taxi app wants "Chorsu" and "the old
   bazaar" treated as the same pickup, because riders use them in the same sentences. Ideas: (1) skip-gram turns
   text into (centre, context) pairs and pulls a word's vector towards the context vectors of its neighbours, so
   two words that share neighbours end up pointing the same way even if they never meet; (2) nearest neighbours
   are read with cosine, not the raw dot product.
   Data, all real:
   - docs/ai-path/runs/s4-word2vec/rides.py: the 21 rider messages (written for this lesson) and the helpers;
   - docs/ai-path/runs/s4-word2vec/train.py + train.out.txt: skip-gram with negative sampling in NumPy (seed 0):
     the traced first call of train_pair, the loss per epoch, the place cosines before and after, the neighbours;
   - docs/ai-path/runs/s4-word2vec/broken.py + broken.out.txt: the "similar pickups" lookup ranked by raw dot
     product (broken on purpose) and the cosine fix, on the vectors train.py saved.
   No model API calls. Lesson-local style: word buttons and a small code-line picker (.lx-s4-word2vec-*), see
   ensureStyle(). Plain browser script. */
(() => {
  const ID = "s4-word2vec";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const f3 = x => x.toFixed(3);

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s4-word2vec/rides.py (MESSAGES) and train.py (DIM, WINDOW, NEG, LR, EPOCHS)
  const MESSAGES = [
    "pick me up at chorsu near the metro",
    "at chorsu by the bread stalls please",
    "chorsu main gate i have spice bags",
    "waiting at chorsu under the big dome",
    "going home from chorsu with bread and spices",
    "chorsu metro exit two please",
    "pick me up at old_bazaar near the metro",
    "at old_bazaar by the bread stalls",
    "old_bazaar main gate with spice bags",
    "waiting at old_bazaar under the big dome",
    "from old_bazaar with bread and melons",
    "pick me up at the airport terminal two",
    "airport arrivals i have two suitcases",
    "going to the airport my flight is at nine",
    "at the airport near the arrivals exit",
    "airport terminal with suitcases please",
    "pick me up at the station my train is late",
    "station platform exit with suitcases",
    "going to the station for the night train",
    "at the station near the ticket hall",
    "from the station with two suitcases please"
  ];
  const PLACES = ["chorsu", "old_bazaar", "airport", "station"];
  const DIM = 8, WINDOW = 2, NEG = 3, LR = 0.05, EPOCHS = 150;

  // From train.out.txt
  const COS_BEFORE = { "chorsu old_bazaar": 0.321, "chorsu airport": 0.136, "chorsu station": -0.308, "old_bazaar airport": 0.265, "old_bazaar station": -0.621, "airport station": -0.501 };
  const COS_AFTER = { "chorsu old_bazaar": 0.943, "chorsu airport": 0.426, "chorsu station": 0.557, "old_bazaar airport": 0.462, "old_bazaar station": 0.606, "airport station": 0.768 };
  const NEAREST_BEFORE_CHORSU = [["near", 0.611], ["waiting", 0.551], ["pick", 0.535], ["big", 0.412], ["terminal", 0.402]];
  const LOSS = [[1, 2.7745], [2, 2.7698], [5, 2.6862], [10, 2.1972], [25, 1.6488], [50, 1.4261], [100, 1.3484], [150, 1.336]];
  // The traced first training step: centre chorsu, context metro, negatives drawn by the run
  const STEP = { center: "chorsu", context: "metro", negatives: ["terminal", "at", "i"],
    dotBefore: [0.0399, -0.0167, -0.0307, 0.007], dotAfter: [0.0453, -0.0197, -0.0356, 0.0037] };
  // Trace rows: [line about to run (0 = def), event (l = line, r = return), word, label, p, g]
  const TRACE = [[1,"l"],[2,"l"],[3,"l"],[3,"l"],[3,"l"],[3,"l"],
    [4,"l","metro",1],[5,"l","metro",1],[6,"l","metro",1,0.5099681783396409],[7,"l","metro",1,0.5099681783396409,-0.4900318216603591],[8,"l","metro",1,0.5099681783396409,-0.4900318216603591],[3,"l","metro",1,0.5099681783396409,-0.4900318216603591],
    [4,"l","terminal",0,0.5099681783396409,-0.4900318216603591],[5,"l","terminal",0,0.5099681783396409,-0.4900318216603591],[6,"l","terminal",0,0.49583316011578216,-0.4900318216603591],[7,"l","terminal",0,0.49583316011578216,0.49583316011578216],[8,"l","terminal",0,0.49583316011578216,0.49583316011578216],[3,"l","terminal",0,0.49583316011578216,0.49583316011578216],
    [4,"l","at",0,0.49583316011578216,0.49583316011578216],[5,"l","at",0,0.49583316011578216,0.49583316011578216],[6,"l","at",0,0.49231805560188235,0.49583316011578216],[7,"l","at",0,0.49231805560188235,0.49231805560188235],[8,"l","at",0,0.49231805560188235,0.49231805560188235],[3,"l","at",0,0.49231805560188235,0.49231805560188235],
    [4,"l","i",0,0.49231805560188235,0.49231805560188235],[5,"l","i",0,0.49231805560188235,0.49231805560188235],[6,"l","i",0,0.5017448594848422,0.49231805560188235],[7,"l","i",0,0.5017448594848422,0.5017448594848422],[8,"l","i",0,0.5017448594848422,0.5017448594848422],[3,"l","i",0,0.5017448594848422,0.5017448594848422],
    [9,"l","i",0,0.5017448594848422,0.5017448594848422],[10,"l","i",0,0.5017448594848422,0.5017448594848422],[10,"r","i",0,0.5017448594848422,0.5017448594848422]];
  // From broken.out.txt
  const BUGGY_OLD_BAZAAR = [["and", 8.823], ["by", 8.338], ["big", 7.708], ["pick", 7.509], ["going", 6.89]];
  const FIXED_OLD_BAZAAR = [["chorsu", 0.943], ["by", 0.687], ["and", 0.663], ["station", 0.606], ["big", 0.568]];
  const BUGGY_RANK_CHORSU = 7;
  const LENGTHS = { old_bazaar: 2.92, chorsu: 2.268, and: 4.559, by: 4.154, big: 4.644, pick: 5.723, going: 4.166 };

  // The listing is train_pair from train.py, line for line (line 0 = def).
  const CODE = [
    "def train_pair(center, context, negatives, lr):",
    "    v = W_in[idx[center]]",
    "    grad_v = np.zeros_like(v)",
    "    for word, label in [(context, 1)] + [(n, 0) for n in negatives]:",
    "        u = W_out[idx[word]]",
    "        p = sigmoid(v @ u)",
    "        g = p - label",
    "        grad_v += g * u",
    "        W_out[idx[word]] -= lr * g * v",
    "    W_in[idx[center]] -= lr * grad_v",
    "    return p"
  ];
  // similar_buggy from broken.py, line for line
  const BUGGY = [
    "def similar_buggy(word, k):",
    "    scores = W_in @ W_in[idx[word]]",
    "    order = np.argsort(-scores)",
    "    return [(VOCAB[i], round(float(scores[i]), 3)) for i in order if VOCAB[i] != word][:k]"
  ];

  /* ---------- Derived from the data ---------- */
  const SENT = MESSAGES.map(m => m.split(" "));
  const contextOf = (toks, i) => { const out = []; for (let j = Math.max(0, i - WINDOW); j < Math.min(toks.length, i + WINDOW + 1); j++) if (j !== i) out.push(j); return out; };
  const pairCount = toks => toks.reduce((n, _, i) => n + contextOf(toks, i).length, 0);
  const contextWords = place => { const s = new Set(); SENT.forEach(t => t.forEach((w, i) => { if (w === place) contextOf(t, i).forEach(j => s.add(t[j])); })); return s; };
  const CTX = Object.fromEntries(PLACES.map(p => [p, contextWords(p)]));
  const shared = (a, b) => [...CTX[a]].filter(w => CTX[b].has(w));
  const together = (a, b) => SENT.filter(t => t.includes(a) && t.includes(b)).length;
  const countOf = w => SENT.reduce((n, t) => n + t.filter(x => x === w).length, 0);
  const VOCAB_SIZE = new Set(SENT.flat()).size;
  const TOKENS = SENT.flat().length;
  const PAIRS_PER_EPOCH = SENT.reduce((n, t) => n + pairCount(t), 0);
  const pairKey = (a, b) => COS_AFTER[`${a} ${b}`] != null ? `${a} ${b}` : `${b} ${a}`;
  const show = w => w.replace("_", " ");
  const CAP_RUN = "From our NumPy run, seed 0";

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-msg { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 6px; }
      .lx-${ID}-w { min-height: 44px; min-width: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: 500 16px var(--mono); cursor: pointer; }
      .lx-${ID}-w:disabled { cursor: default; }
      .lx-${ID}-w.c { border: 3px solid var(--ink); font-weight: 700; }
      .lx-${ID}-w.ok { border-color: var(--good); background: var(--good-soft); }
      .lx-${ID}-w.bad { border-color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-pos { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; font: 500 12.5px var(--mono); color: var(--muted); }
      .lx-${ID}-pairs { font: 500 14.5px/1.6 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-codeopt { font: 500 13.5px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; white-space: pre-wrap; }
      .lx-${ID}-codeopt, .lx-${ID}-wrap .lcode { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
      .lx-${ID}-wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); font: 500 14px/1.55 var(--mono); overflow-wrap: anywhere; color: var(--ink); }
    `;
    document.head.appendChild(s);
  }
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const listOut = (kit, rows) => rows.map(([w, s]) => `${kit.esc(w)} ${s}`).join(", ");

  /* Screens 1 and 2: tap the context words of a place name in one message. */
  function pairsScreen(msgIndex, intro) {
    return function ({ el, done, kit }) {
      ensureStyle();
      const toks = SENT[msgIndex];
      const ci = toks.findIndex(w => PLACES.includes(w));
      const center = toks[ci];
      const right = new Set(contextOf(toks, ci));
      const got = new Set();
      let bad = null;
      const paint = () => {
        const fin = got.size === right.size;
        const words = toks.map((w, i) => {
          const cls = i === ci ? "c" : got.has(i) ? "ok" : bad === i ? "bad" : "";
          const attrs = i === ci || fin || got.has(i) ? "disabled" : `data-i="${i}"${right.has(i) ? " data-right" : ""}${!right.has(i) && i === toks.findIndex((_, k) => k !== ci && !right.has(k)) ? " data-wrong" : ""}`;
          return `<button type="button" class="lx-${ID}-w ${cls}" ${attrs}>${kit.esc(w)}</button>`;
        }).join("");
        const pairs = [...right].sort((a, b) => a - b).map(j => `(${center}, ${toks[j]})`).join("  ");
        let fb = "";
        if (bad != null) {
          const d = Math.abs(bad - ci);
          fb = kit.feedback(`<b>${kit.esc(toks[bad])}</b> is ${plural(d, "word")} away from <b>${kit.esc(show(center))}</b>. The window reaches only ${WINDOW} words to each side, so it is not a context word here, even though it is in the same message.`, false);
        }
        if (fin) fb = kit.feedback(intro.done(kit, toks, ci, pairs), true);
        el.innerHTML = `<h1>${intro.title}</h1>
          ${intro.lead(kit)}
          <p class="task">The ringed word is the centre. Its <b>window</b> is the ${WINDOW} words before it and the ${WINDOW} after. Tap every word in the window.</p>
          <div class="lx-${ID}-msg" aria-label="rider message">${words}</div>
          <p class="lx-${ID}-cap">${plural(got.size, "context word")} found</p>
          <div class="lpanel">${fb}</div>`;
        el.querySelectorAll(`.lx-${ID}-w[data-i]`).forEach(b => b.onclick = () => {
          const i = +b.dataset.i;
          if (right.has(i)) { got.add(i); bad = null; } else bad = i;
          paint();
          if (got.size === right.size) done();
        });
      };
      paint();
    };
  }
  const screen1 = pairsScreen(0, {
    title: "Two names, one place",
    lead: () => `<p class="lead">A taxi app in Tashkent collects pickup points from riders' messages. Some riders write <b>Chorsu</b>, others write <b>the old bazaar</b>. It is the same market, but the app sees two different strings, so a driver waiting at one never gets the rides booked at the other. Nobody has a list of every nickname. The app does have the messages.</p>
      <p class="lead">In this lesson the app learns which words name the same place by itself, from the messages alone. The trick: look at the words <b>around</b> each word. Here is one rider message, already split into words.</p>`,
    done: (kit, toks, ci, pairs) => `Right. Each tap makes one <b>(centre, context)</b> pair for training:<div class="lx-${ID}-pairs">${kit.esc(pairs)}</div>Every word of the message takes a turn as the centre, so this one message gives ${plural(pairCount(toks), "pair")}. The method you are about to train, <b>skip-gram</b>, learns only from such pairs: for each centre word, it tries to predict the words in its window.`
  });
  const screen2 = pairsScreen(6, {
    title: "The other name",
    lead: () => `<p class="lead">Another rider, another message. Before training, we joined "old bazaar" into one token, <code>old_bazaar</code>, so it gets one vector of its own. The original word2vec work does the same for word groups that often appear together, like "New York Times".</p>`,
    done: (kit, toks, ci, pairs) => {
      const a = contextOf(SENT[0], SENT[0].indexOf("chorsu")).map(j => SENT[0][j]).join(" ");
      const b = contextOf(toks, ci).map(j => toks[j]).join(" ");
      return `Right:<div class="lx-${ID}-pairs">${kit.esc(pairs)}</div>${a === b ? `The context words are exactly the ones Chorsu had in the first message: <b>${kit.esc(a.split(" ").join(", "))}</b>. The two names never meet, but they keep the same company.` : ""}`;
    }
  });

  /* Screen 3: predict which two places end up nearest. */
  function predictPair({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const PAIRS = [["airport", "station"], ["chorsu", "old_bazaar"], ["chorsu", "airport"], ["old_bazaar", "station"]];
    const RIGHT = 1;
    const cos = (a, b) => COS_AFTER[pairKey(a, b)];
    const best = PAIRS.reduce((m, p) => cos(...p) > cos(...m) ? p : m);
    const sh = (a, b) => shared(a, b).length;
    const fb = PAIRS.map(([a, b], i) => i === RIGHT
      ? [`Right. They share ${plural(sh(a, b), "context word")} out of ${CTX[a].size} and ${CTX[b].size}. After training, their vectors had cosine <b>${f3(cos(a, b))}</b>, the highest of all six place pairs. Before training, with random vectors, it was ${f3(COS_BEFORE[pairKey(a, b)])}.`, true]
      : [`${show(a)} and ${show(b)} share ${plural(sh(a, b), "context word")}; ${show(best[0])} and ${show(best[1])} share ${sh(...best)}. After training their cosine was ${f3(cos(a, b))}${a === "airport" ? ", the next highest" : ""}. Shared here: ${kit.esc(shared(a, b).join(", "))}. The pair with more of the same company ended closer (${f3(cos(...best))}).`, false]);
    const rows = PLACES.map(p => [show(p), [...CTX[p]].sort().join(" ")]);
    const paint = () => {
      el.innerHTML = `<h1>Who ends up next to whom?</h1>
        <p class="lead">The app has ${MESSAGES.length} rider messages (${TOKENS} words, ${VOCAB_SIZE} different ones). Training will give every word a list of ${DIM} numbers, its <b>vector</b>, like the learned embeddings you trained for categories. Two words are neighbours when their vectors point the same way, which means a high cosine (1 is the most). These are the words that appear within ${WINDOW} words of each place name in all the messages:</p>
        ${kit.table(rows, { head: ["place", "context words"], title: "Context words per place" })}
        <p class="task">After training, which two place names will be nearest neighbours?</p>
        <div class="lpanel">${ask(kit, PAIRS.map(([a, b]) => `${kit.esc(show(a))} and ${kit.esc(show(b))}`), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* Screen 4: spot the idea. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "They often appear in the same message, so training links them",
      "Training pulls each word's vector towards the vectors of its context words. Both names are pulled towards the same ones, so they end up pointing the same way",
      "The two names are written alike",
      "They are the two most frequent words, and frequent words get similar vectors"
    ];
    const fb = [
      [`Count them: ${plural(together("chorsu", "old_bazaar"), "message")} of ${MESSAGES.length} contain both. No pair (chorsu, old_bazaar) was ever made. Something else pulled them together.`, false],
      [`Right. The two names never see each other. What they share are their neighbours. Every (chorsu, at) pair nudges Chorsu's vector towards one vector that stands for "at". Every (old_bazaar, at) pair nudges old bazaar's vector towards that same vector. Many shared neighbours give many nudges in the same directions. The second word2vec paper (Mikolov and others, 2013) puts it this way: a word's vector can be seen as representing the distribution of the contexts it appears in. Words used in the same places get similar vectors.`, true],
      ["The model never sees letters. Each word is only a row number in a table of vectors; \"chorsu\" and \"old_bazaar\" could be any strings and the result would be the same.", false],
      [`Chorsu appears ${countOf("chorsu")} times and old bazaar ${countOf("old_bazaar")}. "the" appears ${countOf("the")} times and "at" ${countOf("at")}. Frequency is not what made them close.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>They never met</h1>
        <p class="lead">After training, Chorsu's nearest word is old bazaar, cosine ${f3(COS_AFTER["chorsu old_bazaar"])}. Before training, its nearest word was "${NEAREST_BEFORE_CHORSU[0][0]}", only by chance, because every vector starts as random numbers. Yet in all ${MESSAGES.length} messages the two names never appear together.</p>
        <p class="task">What pulled them together?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* Screen 5: one training step, with predictions. */
  function oneStep({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null; // k = 0: the real pair; 1: the noise word; 2: finished
    const words = [STEP.context, ...STEP.negatives];
    const pOf = w => TRACE.find(r => r[2] === w && r[0] === 6)[4];
    const Q = [
      { w: STEP.context, label: 1, right: 0 },
      { w: STEP.negatives[0], label: 0, right: 1 }
    ];
    const say = (q, pick) => pick === 2
      ? `A step always changes the vectors. The model gave p = ${f3(pOf(q.w))}, and the target is ${q.label}. The gap between them is the error, and the step moves the score to make the gap smaller.`
      : q.label
        ? `"${q.w}" really sits next to Chorsu (label 1), and the model gave it only p = ${f3(pOf(q.w))}. Training moves p towards 1, which means a higher score.`
        : `"${q.w}" is a noise word (label 0), and the model gave it p = ${f3(pOf(q.w))}. Training moves p towards 0, which means a lower score.`;
    const paint = () => {
      const fin = k >= Q.length;
      const q = Q[Math.min(k, Q.length - 1)];
      const done2 = fin ? `<p class="lead">The real run, every score before and after this one step:</p>
        ${kit.table(words.map((w, i) => [`${show(STEP.center)} · ${w} (${i === 0 ? "context" : "noise"})`, `${STEP.dotBefore[i]} → ${STEP.dotAfter[i]}`]), { head: ["score", "before → after"], title: "One call of train_pair" })}
        ${kit.feedback(`Right both times. The real neighbour's score went up by ${(STEP.dotAfter[0] - STEP.dotBefore[0]).toFixed(4)}, and all three noise scores went down. One step moves a little (learning rate ${LR}); the run makes ${PAIRS_PER_EPOCH} such steps per pass over the messages and ${EPOCHS} passes. Look at the second noise word: "${STEP.negatives[1]}" often <i>is</i> next to Chorsu, but it was drawn at random here. That happens; across thousands of steps the real pairs win. This trick, a few random wrong words per real pair, is called <b>negative sampling</b>.`, true)}` : "";
      el.innerHTML = `<h1>One nudge</h1>
        <p class="lead">Each word has two vectors: one for when it is the centre (kept in a table <code>W_in</code>) and one for when it is a context word (<code>W_out</code>). For the pair (${STEP.center}, ${STEP.context}), the model takes the dot product of Chorsu's centre vector and metro's context vector. That number is the <b>score</b>. A sigmoid turns the score into <b>p</b>, between 0 and 1: how sure the model is that metro really sits near Chorsu.</p>
        <p class="lead">The model also draws ${NEG} random words from the messages, called <b>noise words</b>. Their p should be near 0. This is the first step of the real run, from random vectors.</p>
        ${fin ? "" : `<p class="task">${k === 0 ? `The pair (${STEP.center}, ${STEP.context}) is real, and the model gave it p = ${f3(pOf(STEP.context))}. After the step, what happens to the score ${show(STEP.center)} · ${STEP.context}?` : `Noise word "${q.w}" got p = ${f3(pOf(q.w))}. After the step, what happens to the score ${show(STEP.center)} · ${q.w}?`}</p>`}
        <div class="lpanel">${fin ? done2 : `${kit.options(["It goes up", "It goes down", "It stays the same"], { picked: wrong, correct: q.right })}${wrong != null ? kit.feedback(say(q, wrong), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== Q[k].right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= Q.length) done();
      });
    };
    paint();
  }

  /* Screen 6: the step as Python, a stepped replay of the traced call. */
  const FR = (() => {
    const fr = [];
    for (let i = 1; i < TRACE.length; i++) {
      const ran = TRACE[i - 1][0], v = TRACE[i];
      if (v[1] === "r") { fr.push({ ln: 10, v, end: true }); continue; }
      if (ran === v[0]) continue;
      if ([2, 3, 5, 6, 9].includes(ran)) fr.push({ ln: ran, v, exit: ran === 3 && v[0] === 9 });
    }
    return fr;
  })();
  const sayFrame = (kit, f) => {
    const [, , word, label, p, g] = f.v;
    if (f.end) return `It returns the last p. Every vector this pair touched has moved: metro's and the ${NEG} noise words' context vectors, and Chorsu's centre vector.`;
    if (f.ln === 2) return `<code>v</code> is Chorsu's centre vector, ${DIM} numbers. <code>grad_v</code> will collect how Chorsu's vector should change, summed over all ${1 + NEG} words.`;
    if (f.exit) return `No words are left in the list, so the loop ends. All ${1 + NEG} words have had their turn.`;
    if (f.ln === 3) return label ? `First the real context word, <b>${kit.esc(word)}</b>, with label 1.` : `Next a noise word, <b>${kit.esc(word)}</b>, with label 0.`;
    if (f.ln === 5) return `p = sigmoid(score) = ${f3(p)}. Vectors start random and small, so every p starts near 0.5.`;
    if (f.ln === 6) return `g = p − label = ${f3(g)}. ${g < 0 ? "Negative: the score was too low. The <code>W_out</code> line moves this word's context vector towards Chorsu's, and <code>grad_v += g * u</code> saves the matching pull on Chorsu's vector for later." : "Positive: the score was too high. The <code>W_out</code> line moves this word's context vector away from Chorsu's, and <code>grad_v += g * u</code> saves the matching push for later."}`;
    if (f.ln === 9) return `The <code>W_in</code> line: only now does Chorsu's own vector move, by all ${1 + NEG} pulls at once. Pairs with old bazaar will pull its vector towards the same context vectors.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      const [, , word, label, p, g] = f.v;
      const val = x => x == null ? "–" : f3(x);
      el.innerHTML = `<h1>The step, in Python</h1>
        <p class="lead">Our run called this function for every pair: ${PAIRS_PER_EPOCH} pairs per pass, ${EPOCHS} passes. <code>v @ u</code> is the dot product. <code>idx</code> gives each word's row number in the tables. We replay its very first call, (${STEP.center}, ${STEP.context}) with noise words ${STEP.negatives.join(", ")}.</p>
        <p class="task">Step through it. Watch the sign of g.</p>
        <div class="lx-${ID}-wrap">${kit.code(CODE, f.ln)}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>word <b>${kit.esc(word || "–")}</b></span><span>label <b>${label == null ? "–" : label}</b></span><span>p <b>${val(p)}</b></span><span>g <b>${val(g)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}
        <p class="lx-${ID}-cap">${CAP_RUN}</p>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* Screen 7: the whole run: predict the starting loss, then read the result. */
  function wholeRun({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const start = (1 + NEG) * Math.log(2);
    const opts = ["0", f3(Math.log(2)), f3(start), "10"];
    const RIGHT = 2;
    const first = LOSS[0][1], last = LOSS[LOSS.length - 1][1];
    const fb = [
      ["0 would mean the model is already certain about every word. With random vectors it knows nothing yet.", false],
      [`That is the loss of one word with p = 0.5. Each pair has ${1 + NEG} words, the context word and ${NEG} noise words, and each one costs about that much.`, false],
      [`Right: ${1 + NEG} words, each with p near 0.5, each costing −log 0.5 ≈ ${f3(Math.log(2))}. The run's first pass averaged ${first}.`, true],
      [`Too high for random small vectors. Every p starts near 0.5, which costs about ${f3(Math.log(2))} per word, and each pair has ${1 + NEG} words.`, false]
    ];
    const after = PLACES.flatMap((a, i) => PLACES.slice(i + 1).map(b => [a, b])).sort((x, y) => COS_AFTER[pairKey(...y)] - COS_AFTER[pairKey(...x)]);
    const paint = () => {
      el.innerHTML = `<h1>The whole run</h1>
        <p class="lead">The run trains for ${EPOCHS} passes. The <b>loss</b> of one pair is −log p for the real context word plus −log(1 − p) for each noise word: it is small when the real word gets p near 1 and the noise words get p near 0, and large when the model is sure of the wrong answer.</p>
        <p class="task">On the first pass every p is near 0.5. About what is the average loss per pair?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>
        ${ans === RIGHT ? `<p class="lead">Average loss per pair, after each pass:</p>${kit.meter(LOSS.map(([e, l]) => ({ label: `pass ${e}`, value: l, max: first })))}
          <p class="lead">The loss falls from ${first} to ${last} and levels off. It never reaches 0: a word like "at" sits next to many different words, and no single score can be sure of all of them. The place pairs, before and after:</p>
          ${kit.table(after.map(([a, b]) => [`${show(a)} · ${show(b)}`, `${f3(COS_BEFORE[pairKey(a, b)])} → ${f3(COS_AFTER[pairKey(a, b)])}`]), { head: ["cosine", "before → after"], hit: 0 })}
          <p class="lx-${ID}-cap">${CAP_RUN}</p>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* Screen 8: broken on purpose: the lookup ranks by the raw dot product. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Training went wrong: the vectors are bad", ...BUGGY.slice(1).map(l => `<span class="lx-${ID}-codeopt">${kit.esc(l.trim())}</span>`)];
    const RIGHT = 1;
    const lens = Object.entries(LENGTHS).sort((a, b) => b[1] - a[1]);
    const fb = [
      [`The same vectors give old bazaar → chorsu ${f3(FIXED_OLD_BAZAAR[0][1])} by cosine, the top match. The vectors are fine; the way they are compared is not.`, false],
      [`Right. <code>W_in @ v</code> is the raw dot product, and a dot product grows with the length of both vectors. Some vectors came out much longer than others:<div class="lx-${ID}-out">${lens.map(([w, n]) => `${kit.esc(w)} ${n}`).join(", ")}</div>"${lens[0][0]}" is ${(lens[0][1] / LENGTHS.chorsu).toFixed(1)} times as long as chorsu. Long vectors like these outscore chorsu, which points in almost the same direction as old bazaar but is short. Cosine divides by both lengths and compares only the direction. The fix in <code>broken.py</code> divides every row by its length first. Its output:<div class="lx-${ID}-out">${listOut(kit, FIXED_OLD_BAZAAR)}</div>`, true],
      ["<code>-scores</code> sorts from the highest score down, which is what you want. The order follows the scores; the scores themselves are the problem.", false],
      ["This line only removes the word itself and keeps the top k. It cannot push chorsu down; something above it already ranked chorsu low.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: "similar pickups"</h1>
        <p class="lead">A teammate wrote the lookup the app will use, and ran it on the same trained vectors:</p>
        <div class="lx-${ID}-wrap">${kit.code(BUGGY, -1)}</div>
        <div class="lx-${ID}-out">similar_buggy("old_bazaar", 5)<br>${listOut(kit, BUGGY_OLD_BAZAAR)}</div>
        <p class="lx-${ID}-cap">${CAP_RUN}. Chorsu is number ${BUGGY_RANK_CHORSU} in this ranking.</p>
        <p class="task">Chorsu should be first. What causes this?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* Screen 9: the big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 0;
    const opts = [
      "Their place names have no vectors at all until we retrain on messages that contain them",
      "Cosine stops working for the new names",
      "The old vectors for Chorsu get worse",
      "The vectors become too long"
    ];
    const fb = [
      ["Right. word2vec only knows words it saw in training. A new name has no row in the table, so there is nothing to compare. You need messages that use it, and a new training run. Libraries such as FastText build a vector for an unseen word from its letter pieces. That helps with typos and word forms, but for a brand new name the vector comes only from its spelling, not from how riders use it.", true],
      ["Cosine works on any two vectors. The problem comes before it: there is no vector to compare.", false],
      ["Nothing touches the trained table until you train again. Chorsu's vector stays exactly as it is.", false],
      ["Length does not change after training, and cosine ignores length anyway. The problem is that the new words have no vector.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for word2vec</h1>
        <p class="lead"><b>What it is for:</b> finding words used in the same places (nicknames, spellings, product names) from plain text with no labels.</p>
        <p class="lead"><b>Reach for it</b> when you have plenty of text from your own domain and want small, fast word vectors.</p>
        <p class="lead"><b>Not</b> when one word has two meanings (one word, one vector, so both senses are mixed: use a model that reads the whole sentence), when you need the meaning of a sentence (use a sentence embedding model), or when opposites matter ("early" and "late" share neighbours).</p>
        <p class="lead"><b>Costs:</b> a lot of domain text, a retrain for every new word, and a test set of known pairs, because nothing else tells you if the neighbours are right.</p>
        <p class="task">The app opens in Samarkand. Riders there name places the Tashkent messages never mention. What breaks first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* Screen 10: recognise it in new situations. */
  const CASES = [
    ["A recipe site has two million recipes. Some write coriander, some cilantro, and search for one misses the other. Find words used in the same way.", true,
      "Yes. Lots of text, and the two words sit among the same neighbours (chopped, fresh, garnish). Shared contexts are exactly what word2vec turns into close vectors.",
      "This is the taxi problem again: two names for one thing, used in the same places, with lots of text and no list of synonyms. Word2vec finds them from shared contexts."],
    ["A review dashboard wants a list of words that mean the opposite of \"clean\", to flag bad hotel reviews.", false,
      "No. \"clean\" and \"dirty\" appear in the same spots (\"the room was ___\"), so word2vec puts them close together. Close means \"used in the same places\", not \"means the same\" and not \"means the opposite\". It cannot tell you which neighbour is an opposite.",
      "Word2vec can put dirty near clean, but also spacious, small and quiet: all fill the same gap in \"the room was ___\". Nothing in the vectors marks which one is the opposite, so the list would mix opposites with unrelated words."],
    ["A bank's support inbox: the word \"card\" means a payment card in most tickets and a SIM card in some. Route each ticket by what \"card\" means in it.", false,
      "No. Word2vec gives \"card\" one vector, the same in every ticket, mixed from both meanings. To tell the senses apart you need a model that reads the words around it in this ticket, such as a sentence embedding model or a classifier.",
      "Each word gets exactly one vector, learned from all its uses together. In both kinds of ticket \"card\" looks up the same row, so the vector cannot say which meaning this ticket has."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>word2vec or not?</h1>
        <p class="lead">Three jobs from other teams. Word2vec gives each word one vector, learned from the words around it.</p>
        <p class="task">Would word2vec neighbours do each job? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* Screen 11: what next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You trained word vectors</h1>
      <p class="lead">You made (centre, context) pairs by hand, predicted which way one training step moves a score, replayed the ${CODE.length - 1}-line step in NumPy, and fixed a lookup that ranked by length instead of direction. Chorsu and old bazaar ended up neighbours because they keep the same company, not because they ever met.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the pair maker and the training step yourself in NumPy, and make Chorsu's nearest neighbour by cosine come out as old bazaar.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Word2vec used a word's neighbours to learn its vector; next you count which word follows which, and use those counts to predict the next word.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Train a tiny word2vec and find neighbours",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/1301.3781",
      "https://arxiv.org/abs/1310.4546",
      "https://radimrehurek.com/gensim/models/word2vec.html",
      "https://radimrehurek.com/gensim/models/fasttext.html"
    ],
    interview: [
      {
        q: "You trained word2vec on support tickets to suggest similar search terms. Users complain it suggests \"cancel\" when they type \"renew\". What is going on, and what do you do?",
        good: [
          "Word2vec puts words close when they appear in the same contexts, and opposites often do (\"I want to ___ my plan\")",
          "Close vectors mean \"used in the same places\", not \"same meaning\"",
          "Build a small test set of pairs that should and should not match, and measure on it",
          "Keep a block list or a curated synonym list for pairs that matter, or use labelled data to learn real synonyms"
        ],
        weak: "Train longer or with bigger vectors. More training makes the shared contexts even clearer, so the opposites stay close."
      },
      {
        q: "A \"similar words\" endpoint returns the same few common words for almost every query. The vectors look fine in a notebook. Where do you look?",
        good: [
          "Check the scoring: a raw dot product favours long vectors, so a few words win everywhere",
          "Compare by cosine: normalise every vector to length 1 before the dot product",
          "Check that the endpoint uses the same table and vocabulary as the notebook",
          "If very common words still crowd the list, drop them or down-sample them in training"
        ],
        weak: "Retrain the model. The vectors were fine; the comparison was wrong, and retraining does not fix it."
      }
    ],
    screens: [screen1, screen2, predictPair, spotIdea, oneStep, asCode, wholeRun, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(2 * WINDOW).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: Array(2 * WINDOW).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
