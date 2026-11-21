/* Lesson: embeddings, learned vectors for categories. Story: a recipe site tags saved recipes (baking, curry,
   salad, pasta, breakfast) from their ingredients, and wants to learn which ingredients belong together.
   Ideas: (1) an embedding table is a weight matrix times a one-hot row, done as a lookup: one learned row of
   numbers per category, and you choose how many numbers; (2) the rows only learn what the training task needs,
   so similarity read off them reflects that task (cardamom lands near curry spices, not cinnamon; salt, which
   tells the collections nothing, barely moves). Debug: an id the table has no row for.
   Data, all from real runs on this Mac (docs/ai-path/runs/s3-embeddings/, PyTorch 2.15, CPU, seeded):
   - same_vector.py + same_vector.out.txt: the traced one-hot-times-table vs lookup function, and the
     parameter counts of nn.Embedding(5000, 16), nn.Linear(5000, 64), nn.Linear(16, 64);
   - recipes.py (toy saved recipes, random.Random(7)), show_recipes.py + show_recipes.out.txt;
   - train_tagger.py + train_tagger.out.txt: the RecipeTagger, shapes, training log, neighbours before and
     after training, distances moved, cosines;
   - broken_new_id.py + broken_new_id.out.txt: a new ingredient id 45 sent to a 45-row table (IndexError).
   No model API calls. Lesson-local CSS: the checklist on the last screen (.lx-s3-embeddings-check), copied
   from the pattern in s1-pandas-frames. Plain browser script. */
(() => {
  const ID = "s3-embeddings";
  const fmt = n => n.toLocaleString("en");

  /* ---------- Data copied from the runs ---------- */
  // same_vector.out.txt (counts printed by PyTorch)
  const SITE_INGREDIENTS = 5000, DIM = 16, HIDDEN = 64;
  const PARAMS = { emb: 80000, linWide: 320064, linNarrow: 1088 }; // Embedding(5000,16), Linear(5000,64), Linear(16,64)
  const ONE_HOT_NONZERO = 1;
  // same_vector.py, line for line (line 0 = def)
  const CODE_SAME = [
    "def same_vector(n_ingredients, dim, basil_id):",
    "    table = nn.Embedding(n_ingredients, dim)",
    "    one_hot = torch.zeros(n_ingredients)",
    "    one_hot[basil_id] = 1.0",
    "    via_matmul = one_hot @ table.weight",
    "    via_lookup = table(torch.tensor(basil_id))",
    "    return torch.equal(via_matmul, via_lookup)"
  ];
  // same_vector.out.txt trace: [line about to run, event, vars shown]
  const BASIL_ID = 2741;
  const SAME_STEPS = [
    [1, "l", {}],
    [2, "l", { table: "Embedding(5000, 16)" }],
    [3, "l", { table: "Embedding(5000, 16)", one_hot: "shape (5000,) first 3: [0.0, 0.0, 0.0]" }],
    [4, "l", { table: "Embedding(5000, 16)", one_hot: "shape (5000,) first 3: [0.0, 0.0, 0.0]" }],
    [5, "l", { table: "Embedding(5000, 16)", one_hot: "shape (5000,) first 3: [0.0, 0.0, 0.0]", via_matmul: "shape (16,) first 3: [-0.8403, -0.8617, -1.4625]" }],
    [6, "l", { table: "Embedding(5000, 16)", one_hot: "shape (5000,) first 3: [0.0, 0.0, 0.0]", via_matmul: "shape (16,) first 3: [-0.8403, -0.8617, -1.4625]", via_lookup: "shape (16,) first 3: [-0.8403, -0.8617, -1.4625]" }],
    [6, "r", { table: "Embedding(5000, 16)", one_hot: "shape (5000,) first 3: [0.0, 0.0, 0.0]", via_matmul: "shape (16,) first 3: [-0.8403, -0.8617, -1.4625]", via_lookup: "shape (16,) first 3: [-0.8403, -0.8617, -1.4625]" }]
  ];
  const SAME_RESULT = "True";

  // train_tagger.py, the class, line for line; the trailing comments are cut (the one on the vecs line gives the
  // screen's answer away), the code is unchanged
  const CODE_TAGGER = [
    "class RecipeTagger(nn.Module):",
    "    def __init__(self, n_ingredients, dim, n_tags):",
    "        super().__init__()",
    "        self.ingredient_vecs = nn.Embedding(n_ingredients, dim, padding_idx=0)",
    "        self.to_tag = nn.Linear(dim, n_tags)",
    "    def forward(self, ingredient_ids):",
    "        vecs = self.ingredient_vecs(ingredient_ids)",
    "        counts = (ingredient_ids != 0).sum(1, keepdim=True)",
    "        recipe_vec = vecs.sum(1) / counts",
    "        return self.to_tag(recipe_vec)"
  ];
  const TAGS = ["baking", "curry", "salad", "pasta", "breakfast"]; // recipes.py
  const SLOTS = 8, TOY_ROWS = 45, TOY_DIM = 16, BATCH = 32;          // train_tagger.out.txt
  const TOY_EMB_PARAMS = 720, TOY_TAG_PARAMS = 85;
  const SHAPES = { ids: "(32, 8)", vecs: "(32, 8, 16)", logits: "(32, 5)" };
  const N_TRAIN = 750, N_VAL = 150;                                  // train_tagger.py split of make_recipes(900)
  // train_tagger.out.txt: [epoch, train loss, val accuracy]
  const LOG = [[1, 1.215, 0.967], [2, 0.494, 1.000], [3, 0.127, 1.000], [5, 0.024, 1.000], [10, 0.006, 1.000], [20, 0.002, 1.000], [30, 0.001, 1.000]];
  const PAD_ZERO_AFTER = true;
  // train_tagger.out.txt: nearest three by cosine, before and after training
  const NB = {
    before: { cardamom: [["turmeric", 0.39], ["basil", 0.34], ["cocoa", 0.32]], basil: [["cucumber", 0.56], ["butter", 0.51], ["olives", 0.5]], salt: [["cocoa", 0.53], ["basil", 0.41], ["red onion", 0.38]], cinnamon: [["bacon", 0.56], ["red onion", 0.48], ["cumin", 0.43]] },
    after: { cardamom: [["turmeric", 0.78], ["coriander", 0.74], ["chili", 0.57]], basil: [["pine nuts", 0.67], ["olive oil", 0.62], ["parmesan", 0.6]], salt: [["basil", 0.36], ["cocoa", 0.32], ["onion", 0.28]], cinnamon: [["sugar", 0.48], ["cocoa", 0.4], ["baking powder", 0.4]] }
  };
  const MOVED = { cardamom: [3.89, 3.05], basil: [4.02, 3.38], salt: [4.16, 0.79], cinnamon: [4.43, 3.08] }; // [length at start, distance moved]
  const COS = { "cardamom|cinnamon": -0.2, "cardamom|cumin": 0.46, "salt|cumin": -0.03 };
  // show_recipes.out.txt: saved recipes per collection that contain the ingredient (750 training recipes)
  const COUNTS = {
    cardamom: { baking: 0, curry: 82, salad: 0, pasta: 0, breakfast: 0 },
    cinnamon: { baking: 87, curry: 0, salad: 0, pasta: 0, breakfast: 30 },
    salt: { baking: 39, curry: 28, salad: 35, pasta: 32, breakfast: 31 }
  };
  const SAMPLE = [ // show_recipes.out.txt, first training recipes
    ["curry", "turmeric, ginger, coconut milk, cumin, black pepper"],
    ["baking", "sugar, cocoa, vanilla, nutmeg, flour, salt, black pepper, eggs"],
    ["pasta", "olive oil, pine nuts, tomato, parmesan, garlic, lemon"],
    ["curry", "cardamom, coriander, chili, cumin, garlic"]
  ];
  // broken_new_id.out.txt (trimmed with …, not altered)
  const NEW_NAME = "gochujang", NEW_ID = 45, LAST_NAME = "black pepper"; // recipes.py: NAMES[44] is black pepper
  const SAVED_IDS = [15, 42, 45, 13, 0, 0, 0, 0];
  const TRACE = [
    "table rows: 45  new ingredient id: 45",
    "saved recipe ids: [15, 42, 45, 13, 0, 0, 0, 0]",
    "Traceback (most recent call last):",
    "  File \"…/broken_new_id.py\", line 15, in <module>",
    "    model(torch.tensor([saved]))",
    "…",
    "  File \"…/train_tagger.py\", line 17, in forward",
    "    vecs = self.ingredient_vecs(ingredient_ids)       # (batch, 8, dim)",
    "…",
    "  File \"…/torch/nn/functional.py\", line 2621, in embedding",
    "    return torch.embedding(weight, input, padding_idx, scale_grad_by_freq, sparse)",
    "IndexError: index out of range in self"
  ];

  /* ---------- Derived ---------- */
  const ONE_HOT_COST = SITE_INGREDIENTS * HIDDEN + HIDDEN;
  const EMB_COST = SITE_INGREDIENTS * DIM + DIM * HIDDEN + HIDDEN;
  const TIMES = Math.round(ONE_HOT_COST / EMB_COST);
  const nb = list => list.map(([n, s]) => `${n} ${s.toFixed(2)}`).join(", ");
  const countTxt = c => TAGS.map(t => `${t} ${c[t]}`).join(", ");
  const others = Object.keys(MOVED).filter(n => n !== "salt");
  const minOther = Math.min(...others.map(n => MOVED[n][1]));
  const lastLoss = LOG[LOG.length - 1];

  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }

  /* 1. The situation, and the cost of one-hot, by hand. */
  function countByHand({ el, done, kit }) {
    let stage = 0, ans = null;
    const Q = [
      { right: 2, opts: [fmt(SITE_INGREDIENTS + HIDDEN), fmt(HIDDEN), fmt(ONE_HOT_COST), fmt(SITE_INGREDIENTS * SITE_INGREDIENTS)],
        fb: [
          [`That adds the two sizes. A dense layer connects <b>every</b> input to <b>every</b> unit, so you multiply: ${fmt(SITE_INGREDIENTS)} inputs × ${HIDDEN} units, plus one bias per unit.`, false], null,
          null,
          [`That is ${fmt(SITE_INGREDIENTS)} × ${fmt(SITE_INGREDIENTS)}, as if the layer had one unit per ingredient. It has ${HIDDEN} units.`, false]] },
      { right: 0, opts: [fmt(EMB_COST), fmt(PARAMS.linNarrow), fmt(PARAMS.emb), fmt(SITE_INGREDIENTS + DIM)],
        fb: [null,
          [`That is only the ${HIDDEN}-unit layer on ${DIM} numbers. The table itself is learned too: ${DIM} numbers for each of ${fmt(SITE_INGREDIENTS)} ingredients.`, false],
          [`That is the table alone (${fmt(SITE_INGREDIENTS)} × ${DIM}). The ${HIDDEN}-unit layer after it still has its own weights and biases.`, false],
          [`That adds ${fmt(SITE_INGREDIENTS)} and ${DIM}. Each of the ${fmt(SITE_INGREDIENTS)} ingredients gets its own ${DIM} numbers, so multiply, then add the layer.`, false]] }
    ];
    Q[0].fb[1] = [`${HIDDEN} is the number of units. Each unit has one weight for every input, and a one-hot row has ${fmt(SITE_INGREDIENTS)} inputs.`, false];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>A number for every ingredient</h1>
        <p class="lead">A recipe site lets users save recipes into collections: ${TAGS.join(", ")}. The team wants a small network that tags a newly saved recipe from its ingredients, and they hope it will also learn which ingredients belong together. The site knows ${fmt(SITE_INGREDIENTS)} ingredients. To the network, each one is only an id.</p>
        <p class="lead">In RAG you met the word <b>embedding</b> as a vector that stands for a piece of text. This lesson builds the simplest kind, one learned vector for each ingredient, and shows where its numbers come from.</p>
        <p class="lead">The usual way to feed an id to a network is a <b>one-hot</b> row: ${fmt(SITE_INGREDIENTS)} numbers, all 0 except a 1 at that ingredient's place.</p>
        ${stage === 0 ? `<p class="task">The one-hot row goes into a first layer of ${HIDDEN} units (a dense layer, like <code>nn.Linear(${SITE_INGREDIENTS}, ${HIDDEN})</code>). How many weights and biases does that layer learn?</p>`
          : `<p class="lead">One-hot into ${HIDDEN} units: <b>${fmt(ONE_HOT_COST)}</b> weights and biases.</p>`}
        ${stage === 1 ? `<p class="task">Another way: give every ingredient its own row of ${DIM} learned numbers in a table, look the row up, and feed those ${DIM} numbers to the ${HIDDEN}-unit layer. How many learned numbers in total, table included?</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb)
          : kit.feedback(`Right: ${fmt(SITE_INGREDIENTS)} × ${DIM} = ${fmt(PARAMS.emb)} for the table, plus ${DIM} × ${HIDDEN} + ${HIDDEN} = ${fmt(PARAMS.linNarrow)} for the layer, ${fmt(EMB_COST)} in all. About ${TIMES} times fewer learned numbers than the one-hot route (${fmt(ONE_HOT_COST)}). PyTorch counts the same: <code>nn.Embedding(${SITE_INGREDIENTS}, ${DIM})</code> has ${fmt(PARAMS.emb)}, <code>nn.Linear(${DIM}, ${HIDDEN})</code> has ${fmt(PARAMS.linNarrow)}.`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 2. Spot the idea: a one-hot row times a matrix picks one row. */
  function spotIdea({ el, done, kit }) {
    let ans = null;
    const opts = [
      "It is a new kind of layer that understands meaning; a dense layer on one-hot rows could never learn the same thing",
      `It is the same as a dense layer without bias on a one-hot row: multiplying by a row that is all 0 except one 1 just picks one row of the weights. The table stores those rows and reads one, skipping the ${fmt(SITE_INGREDIENTS - ONE_HOT_NONZERO)} rows that would only be multiplied by 0`,
      "It saves weights because it shares one row of numbers between all ingredients",
      "It is a fixed table: the numbers are set once from a dictionary of ingredients and never trained"
    ];
    const fb = [
      ["Nothing in it understands anything. It is a matrix of learned numbers, trained by the same backward pass and optimizer step as any other layer. Next screen you will see it give the same numbers as a plain matrix product.", false],
      [`Right. Write the one-hot row as x and the weight matrix as W. In x @ W, every 0 in x wipes out its row of W, and the single 1 keeps one row. So <code>nn.Embedding</code> is that weight matrix, and the lookup is a faster way to do the same multiply. The saving you counted came from your choice of ${DIM} numbers per ingredient instead of ${HIDDEN}, and the rows are trained like any weights. Each row is called the ingredient's <b>embedding</b> or <b>vector</b>.`, true],
      [`No sharing: every ingredient has its own row. The table is ${fmt(SITE_INGREDIENTS)} rows × ${DIM}. It is smaller only because each row is short.`, false],
      ["The rows start as random numbers and are trained with the rest of the network. That is the whole point: what they end up saying comes from the training data.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What is the table, really?</h1>
        <p class="lead">PyTorch calls the table <code>nn.Embedding</code>. Its documentation says: “A simple lookup table that stores embeddings of a fixed dictionary and size.” In plain words: one row of numbers for each id in a fixed list. A teammate asks how a lookup can replace a layer.</p>
        <p class="task">Which answer is true?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Stepped Python: one-hot times the table equals the lookup. */
  const VARORDER = ["table", "one_hot", "via_matmul", "via_lookup"];
  const sayStep = (k) => {
    const [ln, ev] = SAME_STEPS[k];
    if (ev === "r") return `<code>torch.equal</code> returned <b>${SAME_RESULT}</b>: the matrix product and the lookup gave exactly the same ${DIM} numbers. The lookup just skipped the work.`;
    return [
      "",
      `About to build the table: <code>nn.Embedding(${SITE_INGREDIENTS}, ${DIM})</code>. Its <code>weight</code> has shape (${SITE_INGREDIENTS}, ${DIM}), filled with random numbers to start.`,
      `The table exists. Next, a one-hot row for basil, all ${fmt(SITE_INGREDIENTS)} numbers 0 for now.`,
      `About to put the single 1 at basil's id, ${BASIL_ID}.`,
      `About to multiply the one-hot row by the whole weight table: ${fmt(SITE_INGREDIENTS)} × ${DIM} multiplications, almost all by 0.`,
      `<code>via_matmul</code> has ${DIM} numbers. Now the lookup: ask the table for row ${BASIL_ID}. Compare its first numbers with these when it arrives.`,
      `Both are in. Read the first three numbers of each.`
    ][ln];
  };
  function sameVector({ el, done, kit }) {
    let k = 0;
    const paint = () => {
      const [ln, ev, vars] = SAME_STEPS[k];
      el.innerHTML = `<h1>Prove it in PyTorch</h1>
        <p class="lead">This function builds a table for ${fmt(SITE_INGREDIENTS)} ingredients with ${DIM} numbers each, then gets basil's row two ways. It was run once on a laptop; the values below are from that run.</p>
        <p class="task">Step through and compare the two results.</p>
        ${kit.code(CODE_SAME, ev === "r" ? 6 : ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${k === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${k === SAME_STEPS.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${VARORDER.filter(v => vars[v]).map(v => `<span>${v} <b>${kit.esc(vars[v])}</b></span>`).join("") || `<span>basil_id <b>${BASIL_ID}</b></span>`}</div>
        ${kit.feedback(sayStep(k))}`;
      el.querySelector("[data-prev]").onclick = () => { k--; paint(); };
      el.querySelector("[data-next]").onclick = () => { k++; paint(); if (k === SAME_STEPS.length - 1) done(); };
    };
    paint();
  }

  /* 4. The real model: nn.Embedding inside a recipe tagger. Predict a shape. */
  function tagger({ el, done, kit }) {
    let ans = null;
    const opts = [`(${BATCH}, ${TOY_DIM})`, SHAPES.vecs, SHAPES.ids, `(${TOY_ROWS}, ${TOY_DIM})`];
    const fb = [
      [`That is the shape of <code>recipe_vec</code>, two lines later, after it averages the ${SLOTS} slots. The lookup itself keeps every slot.`, false],
      [`Right, from the run: ids ${SHAPES.ids} became vecs ${SHAPES.vecs}, and the model returned ${SHAPES.logits}, one score per collection. The lookup adds a last axis of size <code>embedding_dim</code> to whatever shape of ids you give it. The three settings that matter: <code>num_embeddings</code> (${TOY_ROWS} rows, one per id, the empty slot included), <code>embedding_dim</code> (${TOY_DIM} numbers per row, your choice) and <code>padding_idx=0</code>: row 0 starts at zeros and gets no gradient, so empty slots never learn anything. After training, row 0 was ${PAD_ZERO_AFTER ? "still all zeros" : "not zeros"}.`, true],
      ["That is the shape of the ids going in. The lookup replaces each id with its row of numbers, so the result has one more axis.", false],
      [`That is the shape of the whole table (<code>weight</code>). A lookup returns only the rows you ask for, one per id in the batch.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The tagger, with an embedding first</h1>
        <p class="lead">A small version of the site's tagger, trained on ${N_TRAIN} saved recipes (a toy set made by a short script, ${TOY_ROWS - 1} ingredients). Each recipe is ${SLOTS} ingredient ids, with 0 for an empty slot. The model works in three steps: look up the vector of every id; average the vectors of the non-empty slots into one recipe vector; a dense layer turns that into ${TAGS.length} scores, one per collection. Learned numbers: ${TOY_EMB_PARAMS} in the table, ${TOY_TAG_PARAMS} in the last layer. The code is from the run, with its comments cut.</p>
        ${kit.code(CODE_TAGGER, ans === 1 ? 6 : 3)}
        <p class="task">A batch of ${BATCH} recipes comes in as ids of shape ${SHAPES.ids}. What shape is <code>vecs</code>?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Predict, then read similarity off the trained vectors. */
  function neighbours({ el, done, kit }) {
    let ans = null;
    const opts = ["cinnamon", NB.after.cardamom[0][0], "salt", "basil"];
    const RIGHT = 1;
    const fb = [
      [`A cook would say so: both are warm, sweet spices. But in these saved recipes cinnamon never shares a collection with cardamom (${countTxt(COUNTS.cinnamon)}). The tagger only learns what helps it tell collections apart, and after training their cosine was ${COS["cardamom|cinnamon"].toFixed(2)}: pointing slightly apart.`, false],
      null,
      [`Salt turns up in every collection (${countTxt(COUNTS.salt)}), so it tells the tagger nothing about which one a recipe is. Its cosine with cumin, a curry spice, ended at ${COS["salt|cumin"].toFixed(2)}. The next screen looks at salt.`, false],
      ["Basil only appears in pasta recipes. Cardamom only in curry. The tagger has every reason to push them toward different collections.", false]
    ];
    fb[RIGHT] = [`Right. Cardamom appears only in curry recipes, and so does ${NB.after.cardamom[0][0]}. To score “curry” high, the tagger pushed every curry-only ingredient's row in the same direction, so their vectors ended up close. (${NB.after.cardamom[0][0]} was already nearest by chance at the random start, at ${NB.before.cardamom[0][1].toFixed(2)}; training raised that to ${NB.after.cardamom[0][1].toFixed(2)} and brought in ${NB.after.cardamom[1][0]} and ${NB.after.cardamom[2][0]}, which were not in the top three before.) Similarity here means “used in the same collections”: it is what the training task needed, nothing more.`, true];
    const paint = () => {
      el.innerHTML = `<h1>Which ingredients end up close?</h1>
        <p class="lead">Training ran ${LOG[LOG.length - 1][0]} passes over the recipes; the loss fell from ${LOG[0][1]} to ${lastLoss[1]} and the ${N_VAL} held-back recipes were tagged ${Math.round(lastLoss[2] * 100)}% right. This toy set is easy. Some of the saved recipes it learned from:</p>
        ${kit.table(SAMPLE, { head: ["collection", "ingredients"], title: "Saved recipes" })}
        <p class="lead">Cardamom was saved in: ${countTxt(COUNTS.cardamom)}. To compare two vectors we use cosine similarity, from the dot-product lesson: 1 means the same direction, 0 unrelated, below 0 pointing apart.</p>
        <p class="task">After training, which ingredient has the vector closest to cardamom's?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}
        ${ans === RIGHT ? kit.table(["cardamom", "basil", "cinnamon"].flatMap(n => [[`${n}, before`, nb(NB.before[n])], [`${n}, after`, nb(NB.after[n])]]), { head: ["ingredient", "nearest 3 by cosine"], title: "Before and after training" }) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Debugging the reading: salt's neighbours mean nothing. */
  function saltReading({ el, done, kit }) {
    let ans = null;
    const opts = [
      "Salt and basil really belong together in these recipes",
      "Salt carries no clue about the collection, so training barely moved its row; its neighbours are left over from the random start",
      "padding_idx=0 froze salt's row",
      "Training stopped too early; a few more passes would fix salt"
    ];
    const fb = [
      [`Basil appears only in pasta; salt is spread over all five (${countTxt(COUNTS.salt)}). And basil was already salt's second neighbour before any training (${nb(NB.before.salt)}).`, false],
      [`Right. Salt moved ${MOVED.salt[1]} from a starting length of ${MOVED.salt[0]}; the others moved at least ${minOther}. Every row starts as random numbers, and only the gradient moves it. Salt is in every collection, so the gradient pushes from different collections cancel out. Lesson: before you trust “nearest ingredient”, check that the id appeared often <b>and</b> that the task needed it. A rare id has the same problem: too few examples to move far from random.`, true],
      ["<code>padding_idx=0</code> freezes row 0 only, the empty slot. Salt has its own id and gets gradients like every other ingredient.", false],
      [`The loss was already ${lastLoss[1]} with every held-back recipe right. Nothing left in the task asks salt to move, so more passes will not give it meaning.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A neighbour that means nothing</h1>
        <p class="lead">A product manager reads the trained vectors and wants to show “goes well with salt: ${NB.after.salt[0][0]}”. In the first table, <b>length</b> is the size of a row's ${TOY_DIM} numbers taken as one vector, and <b>moved</b> is the distance between the row at the start and at the end of training.</p>
        ${kit.table(["cardamom", "basil", "cinnamon", "salt"].map(n => [n, `starts at length ${MOVED[n][0]}, moved ${MOVED[n][1]}`]), { head: ["ingredient", "its row during training"], title: "How far each row moved" })}
        ${kit.table([["before training", nb(NB.before.salt)], ["after training", nb(NB.after.salt)]], { head: ["salt", "nearest 3 by cosine"] })}
        <p class="task">Why is basil salt's nearest neighbour?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: a new ingredient id with no row. */
  function newIngredient({ el, done, kit }) {
    let stage = 0, ans = null;
    const ERR = TRACE.length - 1;
    const Q = [
      { right: 0, task: "What caused the error?",
        opts: [`The id ${NEW_ID}: the table only has rows 0 to ${TOY_ROWS - 1}`, "The 0s at the end of the recipe", "The ids are whole numbers, not decimals", "The model was loaded from a file instead of trained"],
        fb: [null,
          [`0 is the empty slot, and row 0 exists (it is the <code>padding_idx</code> row of zeros). Those slots worked in every training batch.`, false],
          ["Whole numbers are what a lookup needs: the documentation asks for an IntTensor or LongTensor of indices. Decimal ids would be the bug.", false],
          [`Loading worked: the error comes from inside PyTorch's <code>embedding</code> function (the last file in the trace), on the lookup, with the table loaded at ${TOY_ROWS} rows. Look at the first printed line.`, false]] },
      { right: 2, task: "What is the safe fix for the live site?",
        opts: ["Wrap the call in try/except and skip recipes that fail", `Clamp every id to at most ${TOY_ROWS - 1}`, "Keep one reserved “unknown” row in the table, send ids it has not seen there, and give new ingredients their own rows at the next training run", "Turn the ids into decimals so the lookup accepts them"],
        fb: [
          ["It stops the crash by silently never tagging any recipe with a new ingredient, and nobody sees it happen.", false],
          [`No crash, but ${NEW_NAME} would quietly use row ${TOY_ROWS - 1}, which is ${LAST_NAME}. Wrong vector, no warning.`, false],
          null,
          ["The lookup accepts only whole-number ids, and the row still would not exist.", false]] }
    ];
    Q[0].fb[0] = [`Right. A table made with <code>num_embeddings=${TOY_ROWS}</code> has ids 0 to ${TOY_ROWS - 1}. The site added ${NEW_NAME} after training and gave it the next free id, ${NEW_ID}. There is no row ${NEW_ID}, and nothing was ever learned for it.`, true];
    Q[1].fb[2] = [`Right. This is the cost of embeddings: the table is fixed at training time. Ids it has not seen need a planned place to go (for example an “unknown” row that training also uses for rare ingredients, so it learns something), and a new ingredient gets a real vector only after recipes with it are trained on.`, true];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Broken on purpose: a new ingredient</h1>
        <p class="lead">A week after training, the site added ${NEW_NAME}. A user saves a recipe with it, and the trained tagger is called on the ids [${SAVED_IDS.join(", ")}]. The real output:</p>
        ${kit.code(TRACE, stage === 0 ? ERR : 0)}
        ${stage === 1 ? `<p class="lead">Cause found: id ${NEW_ID} has no row.</p>` : ""}
        ${stage < 2 ? `<p class="task">${q.task}</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(Q[1].fb[2][0], true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    let ans = null;
    const USERS = 2000000, D1 = DIM, D2 = DIM * 2;
    const opts = [
      `The table: from ${fmt(USERS * D1)} to ${fmt(USERS * D2)} learned numbers`,
      "Nothing much: a lookup reads one row no matter how wide the table is",
      `Only the next dense layer, which now takes ${D2} inputs`
    ];
    const fb = [
      [`Right: ${fmt(USERS)} rows × ${D2} numbers. The table grows with the number of ids times the width you chose, and all of it has to sit in memory and be saved with the model. Here the table is almost all of the model.`, true],
      ["Reading one row stays cheap, true. But the whole table must still be stored and trained, and every row just doubled.", false],
      [`That layer grows too, from ${D1} × its units to ${D2} × its units, but that is tiny next to ${fmt(USERS)} rows doubling.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for embeddings</h1>
        <p class="lead"><b>What it is:</b> a table with one short row of learned numbers for each value of a category, read by lookup. It is the same as one-hot times a weight matrix, without the work.</p>
        <p class="lead"><b>Reach for it</b> when a category input (ingredient, product, user, word) has too many values for one-hot and each value has enough examples to learn from. You also get vectors you can compare, and they mean only what the task taught them.</p>
        <p class="lead"><b>Not</b> for a handful of values (one-hot is already small), for real numbers like price (they already have an order), or for ids with almost no data (their rows stay random).</p>
        <p class="lead"><b>Costs:</b> a table that grows with the number of ids, a plan for unseen ids, and new vectors after every retrain, so old and new vectors cannot be compared directly.</p>
        <p class="task">The site adds user ids: ${fmt(USERS)} users. Someone proposes going from ${D1} to ${D2} numbers per id. What grows most?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise it. */
  const CASES = [
    ["A music app predicts whether a listener skips a track. One input is the track id: 80,000 tracks, each played thousands of times.", true,
      "Yes. Many values, plenty of plays for each. A one-hot row would be 80,000 numbers wide; a table of short learned rows is far smaller, and tracks that get skipped in the same way end up close.",
      "80,000 values is exactly where one-hot gets heavy, and each track has thousands of plays to learn its row from. This is the embedding case."],
    ["A returns model uses the shirt size as an input: S, M, L or XL.", false,
      "No. Four values: one-hot costs four numbers per row and is already tiny. A table with 16 numbers per size would be wider than the one-hot it replaces and adds weights to learn for nothing.",
      "With four values, one-hot is four numbers. An embedding pays off when the number of values is large; here it would only add learned numbers."],
    ["A house-price model has the floor area in square metres as an input.", false,
      "No. Area is already a number: 120 is close to 121 and less than 200. Giving every area its own id and row throws that order away and leaves rare areas with almost no data.",
      "An embedding treats each value as an unrelated id, so it would forget that 120 and 121 are almost the same. Feed the number itself (scaled)."],
    ["A hotel site wants “similar hotels” and has millions of booking sessions saying which hotels people looked at together.", true,
      "Yes. Hotel ids are many, and the sessions give each hotel lots of examples. Train hotel vectors on a task that uses the sessions, and nearby vectors become the “similar hotels” list.",
      "Many ids and plenty of data per id: a table of learned vectors fits. Just remember the vectors will mean whatever the training task rewards."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Embedding or not?</h1>
        <p class="lead">Four inputs from other jobs. An embedding gives each value of a category its own row of learned numbers.</p>
        <p class="task">Would you put each input through an embedding table? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and its checklist. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-embeddings.ipynb";
  const P = `lx-${ID}-`;
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const st = document.createElement("style");
    st.id = "lx-" + ID;
    st.textContent = `
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
    `;
    document.head.appendChild(st);
  }
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const CHECK = [
      `The table prints <code>embedding weight shape: (${TOY_ROWS}, ${TOY_DIM})</code>, with ${TOY_EMB_PARAMS} learned numbers.`,
      `A batch of ids ${SHAPES.ids} gives vecs ${SHAPES.vecs} and scores ${SHAPES.logits}.`,
      `The training loss falls at every printed epoch (one pass over the data), from about ${LOG[0][1]} to about ${lastLoss[1]}.`,
      "Row 0, the empty slot, is still all zeros after training.",
      `After training, cardamom's nearest rows are curry ingredients (${NB.after.cardamom.map(x => x[0]).join(", ")}).`,
      `Salt's row moves far less than cardamom's (${MOVED.salt[1]} against ${MOVED.cardamom[1]}).`
    ];
    el.innerHTML = `<h1>You can read an embedding</h1>
      <p class="lead">You counted what one-hot costs, saw that an embedding is the same matrix read as a lookup, put <code>nn.Embedding</code> in a tagger, read similarity off its rows, caught a neighbour that meant nothing, and fixed an id with no row.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="${P}nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a>.` : "The notebook for this lesson is on its way."} It trains the same recipe tagger. What you should see (ticking is optional):</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The same training loop, moved to a GPU, and what to do when the model and a batch end up on different devices.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Embeddings: learned vectors for categories",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Embedding.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Linear.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.functional.cosine_similarity.html"
    ],
    interview: [
      {
        q: "Your recommender one-hot encodes two million product ids into its first dense layer, and training runs out of memory. What do you change, and what new problems do you plan for?",
        good: [
          "Replace the one-hot input with an embedding table of a chosen small width; it is the same matrix, read as a lookup",
          "The table size is ids times width, so pick the width with that cost in mind",
          "Reserve an unknown row for ids the table has not seen, and add real rows at the next retrain",
          "Rare products barely move from their random start, so do not trust their vectors; group them or set a minimum count"
        ],
        weak: "Use a bigger machine or a smaller batch. That treats the symptom and keeps a layer that multiplies by millions of zeros."
      },
      {
        q: "A colleague shows that in your trained ingredient vectors salt's nearest neighbour is basil, and wants to ship it as a suggestion. What do you say?",
        good: [
          "Embedding similarity only reflects what the training task needed",
          "Check how far the row moved from its random start and how often the id appeared",
          "Salt is in every collection, so it gave the tagger no signal and its row stayed near random",
          "If the product needs “goes well with”, train vectors on a task about pairing, and evaluate the neighbours"
        ],
        weak: "Accept the cosine score as a fact about food, or say the model needs more epochs."
      }
    ],
    screens: [countByHand, spotIdea, sameVector, tagger, neighbours, saltReading, newIngredient, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(SAME_STEPS.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
