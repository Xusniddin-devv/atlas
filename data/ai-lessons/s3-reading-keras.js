/* Lesson: reading Keras and TensorFlow code. Story: you inherit a colleague's Keras notebook for a hotel-cancellation
   model and must port it to the team's PyTorch code. Ideas: (1) each Keras layer, compile and fit line has a PyTorch
   counterpart, but fit() runs the whole training loop for you and makes choices you never see (which rows validate,
   batch size, shuffling); a port must make each of them explicit before its numbers can be compared; (2) the
   loss must match what the model's last layer outputs (probabilities or raw scores).
   Data, all real, from runs on this Mac (no model API calls were recorded for this lesson):
   - docs/ai-path/runs/s3-reading-keras/hotel_data.py (+ .out.txt): 2000 simulated bookings (seed 0), in arrival-date
     order, the latest fifth with a free-cancellation offer;
   - keras_notebook.py + keras_notebook.out.txt: the colleague's notebook, Keras 3 on its PyTorch backend
     (TensorFlow is not installed here), fit log, model.summary(), history;
   - optimizer_vars.py + .out.txt: what summary's "Optimizer params" are; weight_shapes.py + .out.txt: kernel vs weight;
   - torch_port.py + torch_port.out.txt: the port with a random 20 % split, the port with the last 20 % (fit_like_keras,
     traced line by line for the code screen), parameter counts;
   - broken_port.py + broken_port.out.txt: the port that keeps nn.Sigmoid() and uses nn.BCEWithLogitsLoss().
   The TensorFlow screen is written from the official documentation and marked "Not run by us".
   Lesson-local style: an output block, clickable code lines and a small results table (.lx-s3-reading-keras-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s3-reading-keras";
  const last = a => a[a.length - 1];
  const pct = x => `${Math.round(x * 100)} %`;

  /* ---------- Data copied from the runs ---------- */
  // hotel_data.out.txt
  const ROWS = 2000, FEATURES = 8;
  const RATE_FIRST80 = 0.347, CANCELLED_TAIL = 211, TAIL_ROWS = 400;
  // torch_port.out.txt: cancellation share in the 400 randomly picked validation rows
  const RATE_RANDOM_VAL = 0.36;

  // The notebook, as in keras_notebook.py
  const KERAS_MODEL = [
    "model = keras.Sequential([",
    "    keras.Input(shape=(8,)),",
    "    layers.Dense(16, activation=\"relu\"),",
    "    layers.Dropout(0.3),",
    "    layers.Dense(1, activation=\"sigmoid\"),",
    "])"
  ];
  const KERAS_TRAIN = [
    "model.compile(optimizer=keras.optimizers.Adam(learning_rate=1e-3),",
    "              loss=\"binary_crossentropy\", metrics=[\"accuracy\"])",
    "history = model.fit(bookings, cancelled, epochs=20, batch_size=64,",
    "                    validation_split=0.2)"
  ];
  // keras_notebook.out.txt (fit log lines, not altered; the middle epochs are cut)
  const KERAS_LOG_FIRST = "25/25 - 1s - 43ms/step - accuracy: 0.4412 - loss: 0.8339 - val_accuracy: 0.3075 - val_loss: 0.8666";
  const KERAS_LOG_LAST = "25/25 - 0s - 7ms/step - accuracy: 0.7144 - loss: 0.5584 - val_accuracy: 0.6175 - val_loss: 0.6477";
  const KERAS_VAL = [0.8666, 0.8313, 0.8042, 0.7827, 0.7628, 0.7471, 0.7338, 0.7217, 0.7087, 0.7004, 0.6909, 0.6839, 0.6749, 0.6695, 0.6638, 0.6589, 0.6559, 0.6524, 0.6508, 0.6477];
  const EPOCHS = KERAS_VAL.length;
  const SUMMARY = [
    "Model: \"sequential\"",
    "┏━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━┓",
    "┃ Layer (type)             ┃ Output Shape      ┃   Param # ┃",
    "┡━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━┩",
    "│ dense (Dense)            │ (None, 16)        │       144 │",
    "├──────────────────────────┼───────────────────┼───────────┤",
    "│ dropout (Dropout)        │ (None, 16)        │         0 │",
    "├──────────────────────────┼───────────────────┼───────────┤",
    "│ dense_1 (Dense)          │ (None, 1)         │        17 │",
    "└──────────────────────────┴───────────────────┴───────────┘",
    " Total params: 485 (1.89 KB)",
    " Trainable params: 161 (644.00 B)",
    " Non-trainable params: 0 (0.00 B)",
    " Optimizer params: 324 (1.27 KB)"
  ];
  // optimizer_vars.out.txt: Adam's own variables, [name, shape]
  const OPT_VARS = [["adam/iteration", []], ["adam/learning_rate", []],
    ["adam/sequential_dense_kernel_momentum", [8, 16]], ["adam/sequential_dense_kernel_velocity", [8, 16]],
    ["adam/sequential_dense_bias_momentum", [16]], ["adam/sequential_dense_bias_velocity", [16]],
    ["adam/sequential_dense_1_kernel_momentum", [16, 1]], ["adam/sequential_dense_1_kernel_velocity", [16, 1]],
    ["adam/sequential_dense_1_bias_momentum", [1]], ["adam/sequential_dense_1_bias_velocity", [1]]];
  // torch_port.out.txt: named_parameters() of the PyTorch port; weight_shapes.out.txt
  const TORCH_PARAMS = [["0.weight", 128], ["0.bias", 16], ["3.weight", 16], ["3.bias", 1]];
  const KERAS_KERNEL = [8, 16], TORCH_WEIGHT = [16, 8];

  // torch_port.out.txt: validation loss per epoch of the two working ports
  const RANDOM_VAL = [0.6362, 0.6226, 0.6102, 0.5987, 0.5885, 0.5794, 0.5717, 0.5645, 0.5588, 0.5541, 0.5499, 0.5472, 0.5439, 0.5415, 0.5402, 0.5395, 0.5371, 0.5358, 0.5351, 0.5345];
  const TAIL_VAL = [0.6931, 0.6884, 0.6841, 0.6775, 0.6736, 0.6657, 0.6599, 0.6533, 0.6498, 0.6465, 0.6422, 0.6398, 0.6362, 0.6344, 0.6355, 0.637, 0.6293, 0.6281, 0.6317, 0.6295];

  // fit_like_keras from docs/ai-path/runs/s3-reading-keras/torch_port.py, line for line (line 0 = def)
  const CODE = [
    "def fit_like_keras(model, bookings, cancelled, epochs, batch_size):",
    "    split_at = int(len(bookings) * (1 - 0.2))",
    "    x_val, y_val = bookings[split_at:], cancelled[split_at:]",
    "    train = TensorDataset(bookings[:split_at], cancelled[:split_at])",
    "    loader = DataLoader(train, batch_size=batch_size, shuffle=True)",
    "    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)",
    "    loss_fn = nn.BCELoss()",
    "    for epoch in range(epochs):",
    "        train_one_epoch(model, loader, optimizer, loss_fn)",
    "        val_loss = evaluate(model, x_val, y_val, loss_fn)",
    "    return val_loss"
  ];
  const BATCH = 64;
  // Trace rows from torch_port.out.txt (STEP lines): [line about to run, event (l = line, r = return), split_at, epoch, val_loss]
  const TRACE = [[1,"l",null,null,null],[2,"l",1600,null,null],[3,"l",1600,null,null],[4,"l",1600,null,null],[5,"l",1600,null,null],[6,"l",1600,null,null],[7,"l",1600,null,null],[8,"l",1600,0,null],[9,"l",1600,0,null],[7,"l",1600,0,0.6931],[8,"l",1600,1,0.6931],[9,"l",1600,1,0.6931],[7,"l",1600,1,0.6884],[8,"l",1600,2,0.6884],[9,"l",1600,2,0.6884],[7,"l",1600,2,0.6841],[8,"l",1600,3,0.6841],[9,"l",1600,3,0.6841],[7,"l",1600,3,0.6775],[8,"l",1600,4,0.6775],[9,"l",1600,4,0.6775],[7,"l",1600,4,0.6736],[8,"l",1600,5,0.6736],[9,"l",1600,5,0.6736],[7,"l",1600,5,0.6657],[8,"l",1600,6,0.6657],[9,"l",1600,6,0.6657],[7,"l",1600,6,0.6599],[8,"l",1600,7,0.6599],[9,"l",1600,7,0.6599],[7,"l",1600,7,0.6533],[8,"l",1600,8,0.6533],[9,"l",1600,8,0.6533],[7,"l",1600,8,0.6498],[8,"l",1600,9,0.6498],[9,"l",1600,9,0.6498],[7,"l",1600,9,0.6465],[8,"l",1600,10,0.6465],[9,"l",1600,10,0.6465],[7,"l",1600,10,0.6422],[8,"l",1600,11,0.6422],[9,"l",1600,11,0.6422],[7,"l",1600,11,0.6398],[8,"l",1600,12,0.6398],[9,"l",1600,12,0.6398],[7,"l",1600,12,0.6362],[8,"l",1600,13,0.6362],[9,"l",1600,13,0.6362],[7,"l",1600,13,0.6344],[8,"l",1600,14,0.6344],[9,"l",1600,14,0.6344],[7,"l",1600,14,0.6355],[8,"l",1600,15,0.6355],[9,"l",1600,15,0.6355],[7,"l",1600,15,0.637],[8,"l",1600,16,0.637],[9,"l",1600,16,0.637],[7,"l",1600,16,0.6293],[8,"l",1600,17,0.6293],[9,"l",1600,17,0.6293],[7,"l",1600,17,0.6281],[8,"l",1600,18,0.6281],[9,"l",1600,18,0.6281],[7,"l",1600,18,0.6317],[8,"l",1600,19,0.6317],[9,"l",1600,19,0.6317],[7,"l",1600,19,0.6295],[10,"l",1600,19,0.6295],[10,"r",1600,19,0.6295]];

  // broken_port.py: the lines shown, word for word
  const BROKEN_CODE = [
    "model = nn.Sequential(",
    "    nn.Linear(8, 16), nn.ReLU(), nn.Dropout(0.3),",
    "    nn.Linear(16, 1), nn.Sigmoid())",
    "loss_fn = nn.BCEWithLogitsLoss()",
    "optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)",
    "loader = DataLoader(train, batch_size=64, shuffle=True)",
    "out = model(x_val).squeeze(1)",
    "predicted = out > 0"
  ];
  // broken_port.out.txt (lines not altered; the middle epochs are cut)
  const BROKEN_LOG = [
    "epoch  1  loss 0.7728  val_loss 0.6935  val_accuracy 0.5275",
    "epoch  2  loss 0.7608  val_loss 0.6894  val_accuracy 0.5275",
    "epoch  3  loss 0.7489  val_loss 0.6857  val_accuracy 0.5275",
    "epoch 19  loss 0.6893  val_loss 0.6656  val_accuracy 0.5275",
    "epoch 20  loss 0.6854  val_loss 0.6643  val_accuracy 0.5275"
  ];
  const BROKEN_ACC = [0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275, 0.5275];
  const BROKEN_OUT = [0.0002, 0.788], BROKEN_SQUASHED = [0.5001, 0.6874], BROKEN_PREDICTED = 400;
  // torch_port.out.txt: lowest BCEWithLogitsLoss for a not-cancelled row when the model's output is in [0, 1]
  const BROKEN_FLOOR = 0.6931;

  // The TensorFlow training step, from the Keras guide "Writing a training loop from scratch in TensorFlow"
  // (names changed to the story's; not run here)
  const TF_CODE = [
    "train_ds = tf.data.Dataset.from_tensor_slices(",
    "    (x_train, y_train))",
    "train_ds = train_ds.shuffle(",
    "    buffer_size=1024).batch(64)",
    "for x_batch, y_batch in train_ds:",
    "  with tf.GradientTape() as tape:",
    "    probs = model(x_batch, training=True)",
    "    loss_value = loss_fn(y_batch, probs)",
    "  weights = model.trainable_weights",
    "  grads = tape.gradient(loss_value, weights)",
    "  optimizer.apply(grads, weights)"
  ];

  /* ---------- Derived from the data ---------- */
  const SPLIT_AT = TRACE[1][2];
  const VAL_ROWS = ROWS - SPLIT_AT;
  const RATE_TAIL = CANCELLED_TAIL / TAIL_ROWS;
  const KERAS_FINAL = last(KERAS_VAL), RANDOM_FINAL = last(RANDOM_VAL), TAIL_FINAL = last(TAIL_VAL);
  const BATCHES = Math.ceil(SPLIT_AT / BATCH);
  const DENSE1 = FEATURES * 16 + 16, DENSE2 = 16 * 1 + 1, TRAINABLE = DENSE1 + DENSE2;
  const TORCH_TOTAL = TORCH_PARAMS.reduce((s, [, n]) => s + n, 0);
  const size = sh => sh.reduce((a, b) => a * b, 1);
  const OPT_TOTAL = OPT_VARS.reduce((s, [, sh]) => s + size(sh), 0);
  const OPT_SCALARS = OPT_VARS.filter(([, sh]) => sh.length === 0).length;
  const ACC_FLAT = BROKEN_ACC.every(a => a === BROKEN_ACC[0]);
  const f4 = x => x.toFixed(4);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); border-radius: 6px;
        font: 500 13px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-out.lx-${ID}-wide { white-space: pre; overflow-x: auto; overflow-wrap: normal; font-size: 12px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-lines { margin: 12px 0 0; display: grid; gap: 4px; }
      .lx-${ID}-lines button { display: block; width: 100%; min-height: 44px; padding: 8px 10px; text-align: left; cursor: pointer;
        font: 500 13.5px/1.45 var(--mono); color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 6px;
        white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-lines button.lx-${ID}-no { border: 2px solid var(--bad); background: var(--bad-soft); }
      .lx-${ID}-lines button.lx-${ID}-ok { border: 2px solid var(--good); background: var(--good-soft); }
      .lx-${ID}-res { width: 100%; margin: 12px 0 0; border-collapse: collapse; font-size: 15px; }
      .lx-${ID}-res th, .lx-${ID}-res td { padding: 8px 6px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
      .lx-${ID}-res th { font-weight: 600; color: var(--muted); font-size: 13.5px; }
      .lx-${ID}-res td.lx-${ID}-n { font-family: var(--mono); white-space: nowrap; }
      .lx-${ID}-q { margin: 16px 0 0; }
      .lx-${ID}-q > p { margin: 0 0 6px; }
      .lx-${ID}-q code { font: 600 14px var(--mono); }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }
  const out = (kit, lines, wide) => `<div class="lx-${ID}-out${wide ? ` lx-${ID}-wide` : ""}">${kit.esc(lines.join("\n"))}</div>`;
  const opt = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  // model.summary() as a table: the header and layer rows are the "┃"/"│" lines of SUMMARY, split into cells; totals as printed
  const summaryTable = kit => {
    const cellsOf = l => l.split(/[┃│]/).slice(1, -1).map(c => c.trim());
    const rows = SUMMARY.filter(l => /^[┃│]/.test(l)).map(cellsOf);
    const [hd, ...body] = rows;
    return `<div class="lx-${ID}-out">${kit.esc(SUMMARY[0])}<table class="lx-${ID}-res"><thead><tr>${hd.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${body.map(r => `<tr>${r.map((c, j) => `<td class="lx-${ID}-n">${kit.esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>\n${kit.esc(SUMMARY.filter(l => /^ \w/.test(l)).map(l => l.trim()).join("\n"))}</div>`;
  };

  /* Several questions on one screen. blocks: [{ q (html), opts (html), right, fb: [[html, ok]] }]. Done when all are right. */
  function multi({ el, done, kit }, head, blocks, after) {
    ensureStyle();
    const ans = blocks.map(() => null);
    const paint = () => {
      const all = blocks.every((b, i) => ans[i] === b.right);
      el.innerHTML = `${head}${blocks.map((b, i) => `<div class="lcase lx-${ID}-q" id="c${i}"><p>${b.q}</p>${kit.options(b.opts, { picked: ans[i], correct: b.right })}${ans[i] == null ? "" : kit.feedback(b.fb[ans[i]][0], b.fb[ans[i]][1])}</div>`).join("")}${all && after ? `<div class="lpanel">${kit.feedback(after, true)}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (blocks.every((bl, j) => ans[j] === bl.right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation, and the model's lines matched by hand. */
  function matchModel(ctx) {
    const { kit } = ctx;
    const head = `<h1>The notebook you inherited</h1>
      <p class="lead">A lot of older model code is written in Keras, a library for building neural networks. A colleague left a Keras notebook that predicts whether a hotel booking will be cancelled. It reads ${FEATURES} numbers per booking (lead time, nights, deposit paid and so on) and outputs one probability. Your team trains everything in PyTorch, so you must <b>port</b> the model: rewrite it in PyTorch so it does the same thing. The data here is ${ROWS} simulated bookings. This is the model:</p>
      ${kit.code(KERAS_MODEL, -1)}
      <p class="task">For each Keras line, pick the PyTorch piece that does the same job.</p>`;
    const blocks = [
      { q: "<code>keras.Input(shape=(8,))</code>", right: 1,
        opts: [opt(kit, "nn.Linear(8, 8)"), "No layer of its own: the 8 becomes the first argument of the first nn.Linear", opt(kit, "nn.Dropout(8)")],
        fb: [["That adds a real layer with 8 × 8 weights and 8 biases that Keras does not have. <code>keras.Input</code> holds no weights; it only tells the next layer how many numbers come in.", false],
          ["Right. Keras layers work out their input size from the layer before; PyTorch layers are told it. So the 8 moves into <code>nn.Linear(8, 16)</code>.", true],
          ["Dropout switches off a share of the numbers during training; it has nothing to do with how many come in. <code>keras.Input</code> only states the input size.", false]] },
      { q: "<code>layers.Dense(16, activation=\"relu\")</code>", right: 2,
        opts: [opt(kit, "nn.Linear(8, 16)"), opt(kit, "nn.Linear(16, 8), nn.ReLU()"), opt(kit, "nn.Linear(8, 16), nn.ReLU()")],
        fb: [["The weights are right, but the ReLU is missing. In Keras the activation is an argument of <code>Dense</code>; in PyTorch it is a module of its own. Without it, two linear layers in a row act like one.", false],
          ["The order is (inputs, outputs): <code>nn.Linear(in_features, out_features)</code>. 8 numbers come in, 16 go out, so it is <code>nn.Linear(8, 16)</code>.", false],
          ["Right. One Keras line becomes two PyTorch modules: the weights, then the activation.", true]] },
      { q: "<code>layers.Dense(1, activation=\"sigmoid\")</code>", right: 0,
        opts: [opt(kit, "nn.Linear(16, 1), nn.Sigmoid()"), opt(kit, "nn.Linear(1, 16), nn.Sigmoid()"), opt(kit, "nn.Linear(16, 1)")],
        fb: [["Right. The output is squeezed into 0 to 1 and read as the probability of a cancellation. <code>layers.Dropout(0.3)</code> between them becomes <code>nn.Dropout(0.3)</code>: in both, 30 % of the numbers are dropped on each training step and none when measuring.", true],
          ["Inputs come first: 16 numbers come in from the layer before, 1 goes out. That is <code>nn.Linear(16, 1)</code>.", false],
          ["The Keras line also squeezes the output into 0 to 1 with a sigmoid. Leave it out and the model outputs any number, which the loss on the next screen does not expect.", false]] }
    ];
    multi(ctx, head, blocks);
  }

  /* 2. compile and fit matched by hand. */
  function matchTraining(ctx) {
    const { kit } = ctx;
    const head = `<h1>compile and fit</h1>
      <p class="lead">Two more calls train the model. <code>compile</code> picks how to learn; <code>fit</code> does the learning.</p>
      ${kit.code(KERAS_TRAIN, -1)}
      <p class="task">Pick the PyTorch piece for each part.</p>`;
    const blocks = [
      { q: "<code>optimizer=keras.optimizers.Adam(learning_rate=1e-3)</code>", right: 1,
        opts: [opt(kit, "torch.optim.Adam(lr=1e-3)"), opt(kit, "torch.optim.Adam(model.parameters(), lr=1e-3)"), "Nothing: PyTorch uses Adam unless told otherwise"],
        fb: [["A PyTorch optimizer must be handed the weights it will move. Keras finds them on its own inside <code>compile</code>; in PyTorch you pass <code>model.parameters()</code>.", false],
          ["Right. Same optimizer, same learning rate, and you hand it the weights yourself.", true],
          ["PyTorch has no default optimizer. Nothing learns until you create one and call <code>optimizer.step()</code> in your loop.", false]] },
      { q: "<code>loss=\"binary_crossentropy\"</code>, with a model that ends in a sigmoid", right: 2,
        opts: [opt(kit, "nn.CrossEntropyLoss()"), opt(kit, "nn.MSELoss()"), opt(kit, "nn.BCELoss()")],
        fb: [["<code>nn.CrossEntropyLoss</code> expects raw scores (any number, not yet squeezed into 0 to 1), one for each class. This model outputs a single probability.", false],
          ["That is squared error, a regression loss. Keras's string names binary cross-entropy: the loss for a yes/no label and a predicted probability.", false],
          ["Right. Binary cross-entropy on probabilities. Keras assumes probabilities here unless you pass <code>from_logits=True</code> (logits means raw scores), and <code>nn.BCELoss</code> expects them too.", true]] },
      { q: `<code>model.fit(bookings, cancelled, epochs=20, batch_size=64, validation_split=0.2)</code>`, right: 0,
        opts: ["A loop you write: 20 epochs over a DataLoader(batch_size=64, shuffle=True), and a validation set you cut off yourself", opt(kit, "model.fit(bookings, cancelled, epochs=20)"), opt(kit, "DataLoader(train, batch_size=64)")],
        fb: [["Right. <code>fit</code> is the whole training loop from the training-loop lesson: batches, <code>zero_grad</code>, backward, step, and a validation pass after each epoch. In PyTorch you write it.", true],
          ["A PyTorch model (<code>nn.Module</code>) has no <code>fit</code> method. You write the loop.", false],
          ["That makes the batches, but nothing trains yet, and it does not shuffle: <code>DataLoader</code> defaults to <code>shuffle=False</code>, while Keras's <code>fit</code> shuffles the training rows before each epoch by default.", false]] }
    ];
    multi(ctx, head, blocks);
  }

  /* 3. By hand, part 2: the recorded validation losses differ. Which line explains it? */
  function whyDiffers({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [opt(kit, "layers.Dropout(0.3)"), opt(kit, "Adam(learning_rate=1e-3)"), opt(kit, "batch_size=64"), opt(kit, "validation_split=0.2")];
    const RIGHT = 3;
    const fb = [
      ["Your port has <code>nn.Dropout(0.3)</code> too. And neither library drops anything while measuring validation: the Keras docs say validation loss is not affected by dropout. So it cannot open a gap in the validation number.", false],
      ["Your port uses Adam with the same learning rate. Keras's Adam has a slightly different default <code>epsilon</code> (1e-7 against PyTorch's 1e-8), a tiny constant for numerical safety. It does not change which bookings are measured.", false],
      [`Your DataLoader also uses batches of ${BATCH}. Batch size changes how training moves, but not which bookings the model is measured on.`, false],
      [`Right. The Keras docs say the validation rows are taken from <b>the last samples</b> in the data, <b>before shuffling</b>. The notebook's rows are in arrival-date order, so Keras validated on the ${VAL_ROWS} latest bookings, the ones with the free-cancellation offer. ${pct(RATE_TAIL)} of them were cancelled (${CANCELLED_TAIL} of ${TAIL_ROWS}); in your random ${VAL_ROWS} it was ${pct(RATE_RANDOM_VAL)}. Two different exams. When the port validates on the same last ${VAL_ROWS} rows, its final validation loss is <b>${f4(TAIL_FINAL)}</b>, close to Keras's ${f4(KERAS_FINAL)}. Your port was not better.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why is your port better?</h1>
        <p class="lead">You wrote the PyTorch port and ran both for ${EPOCHS} epochs. The first and the last epoch of the notebook's <code>fit</code> output (<code>val_loss</code> is the validation loss; lower is better):</p>
        ${out(kit, [`Epoch 1/${EPOCHS}`, KERAS_LOG_FIRST, "…", `Epoch ${EPOCHS}/${EPOCHS}`, KERAS_LOG_LAST])}
        <p class="lx-${ID}-cap">Keras run on this Mac, 2026-11-14</p>
        <p class="lead">Your port picked ${VAL_ROWS} rows at random to validate on. Its validation loss after epoch ${EPOCHS}: <b>${f4(RANDOM_FINAL)}</b>, against Keras's <b>${f4(KERAS_FINAL)}</b>. Lower, so the port looks better. One more fact: the notebook's rows are sorted by arrival date, and the hotel ran a free-cancellation offer for the latest arrivals.</p>
        <p class="task">Before you tell the team the port is better, which Keras setting explains the gap?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: fit is the same loop, with choices made for you. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The teammate is right: Keras and PyTorch compute the loss with different formulas",
      "fit runs the same loop you write in PyTorch, but it made a choice you did not see. Make each such choice explicit in the port, then compare on the same rows",
      "The gap is random noise; run the port again with another seed",
      "Keras trained longer, so its number is the one to trust"
    ];
    const RIGHT = 1;
    const fb = [
      [`Both use binary cross-entropy on probabilities. On the same last ${VAL_ROWS} rows the port got ${f4(TAIL_FINAL)} and Keras ${f4(KERAS_FINAL)}: the formula was never the problem.`, false],
      [`Right. Reading Keras means seeing the loop inside each high-level call, and the defaults it uses when you pass nothing. From the official docs:
        <table class="lx-${ID}-res"><thead><tr><th>Choice</th><th>Keras <code>fit</code></th><th>PyTorch</th></tr></thead><tbody>
        <tr><td>Batch size</td><td>32 if not given</td><td><code>DataLoader</code>: 1 if not given</td></tr>
        <tr><td>Shuffle</td><td>before each epoch</td><td><code>DataLoader</code>: off unless <code>shuffle=True</code></td></tr>
        <tr><td>Validation rows</td><td><code>validation_split</code>: the last rows, before shuffling</td><td>whatever you cut</td></tr>
        <tr><td>Dropout while measuring</td><td>off, automatically</td><td>off after <code>model.eval()</code></td></tr></tbody></table>`, true],
      [`Noise does not change who is in the exam. The random rows had ${pct(RATE_RANDOM_VAL)} cancellations and the last rows ${pct(RATE_TAIL)}. A different seed would not close that.`, false],
      [`Both ran ${EPOCHS} epochs. And neither number can be trusted over the other while they are measured on different rows.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What the gap teaches</h1>
        <p class="lead">A teammate looks at the two numbers and says: “Keras and PyTorch are different libraries. You can never compare their losses.”</p>
        <p class="task">What do you answer?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Predict model.summary(): parameters per layer, then the real output. */
  function predictSummary({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null; // 0 = first Dense, 1 = second Dense, 2 = shown
    const Q = [
      { q: `How many trainable numbers does <code>Dense(16)</code> hold, with ${FEATURES} inputs?`, right: DENSE1, opts: [FEATURES * 16, DENSE1, FEATURES + 16],
        why: v => v === FEATURES * 16 ? `${FEATURES} × 16 = ${v} counts the weights only. Each of the 16 outputs also has its own bias.` : `That adds the sizes. Every one of the ${FEATURES} inputs connects to every one of the 16 outputs, so the weights multiply.` },
      { q: "And the last layer, <code>Dense(1)</code>, after those 16?", right: DENSE2, opts: [16, DENSE2, 32],
        why: v => v === 16 ? "16 weights, one per input, plus one bias for the single output." : "One output means one weight per input (16) and one bias. Not two per input." }
    ];
    const paint = () => {
      const q = Q[stage];
      el.innerHTML = `<h1>Read model.summary()</h1>
        <p class="lead">Notebooks often print <code>model.summary()</code>: one row per layer and how many numbers it learns. Predict it before you see it.</p>
        ${stage < 2 ? `<p class="task">${q.q}</p><div class="lpanel">${kit.options(q.opts.map(String), { picked: wrong == null ? null : q.opts.indexOf(wrong), correct: q.opts.indexOf(q.right), num: true })}${wrong != null ? kit.feedback(q.why(wrong), false) : ""}</div>` : ""}
        ${stage === 2 ? `${summaryTable(kit)}<p class="lx-${ID}-cap">Keras run on this Mac, 2026-11-14 (the printed table, redrawn as rows)</p>
          <div class="lpanel">${kit.feedback(`Right: ${DENSE1} and ${DENSE2}, ${TRAINABLE} trainable in all. The PyTorch port counts the same: ${TORCH_PARAMS.map(([n, c]) => `${n} ${c}`).join(", ")}, total ${TORCH_TOTAL} (the 0 and 3 are each module's position in <code>nn.Sequential</code>). Two things in this table trip people up. <b>Output Shape</b> <code>(None, 16)</code>: <code>None</code> is the batch size, not fixed yet. <b>Optimizer params ${OPT_TOTAL}</b>: these are not part of the model. Adam keeps two running values for every weight (2 × ${TRAINABLE} = ${2 * TRAINABLE}) plus ${OPT_SCALARS} single numbers, its step counter and learning rate. One more difference: Keras stores the first layer's weights as a ${KERAS_KERNEL.join(" × ")} matrix (inputs × outputs); PyTorch's <code>nn.Linear(8, 16).weight</code> is ${TORCH_WEIGHT.join(" × ")}. Copying weights across means transposing them.`, true)}</div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = Q[stage].opts[+b.dataset.i];
        if (v !== Q[stage].right) { wrong = v; paint(); return; }
        wrong = null; stage++; paint();
        if (stage === 2) done();
      });
    };
    paint();
  }

  /* 6. The port of fit, as a stepped replay of the traced run. */
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const ran = TRACE[k - 1][0], v = TRACE[k];
      const f = { ln: ran, split: v[2], epoch: v[3], val: v[4] };
      if (v[1] === "r") { fr.push({ ...f, end: true }); continue; }
      if (ran >= 1 && ran <= 6) fr.push(f);
      else if (ran === 7 && v[3] === 0) fr.push(f);
      else if (ran === 8 && v[3] === 0) fr.push(f);
      else if (ran === 9 && [0, 1, 2, EPOCHS - 1].includes(v[3])) fr.push(f);
    }
    return fr;
  })();
  const sayFrame = f => {
    if (f.end) return `Done. The port returns <b>${f4(f.val)}</b>. Keras on the same rows ended at ${f4(KERAS_FINAL)}. Close, not equal, and that is normal: the two libraries start from different random weights (Keras's <code>Dense</code> defaults to <code>glorot_uniform</code>, <code>nn.Linear</code> to its own uniform rule), shuffle differently, and Adam's <code>epsilon</code> differs. Compare ports on the same rows, then expect small gaps, not zero.`;
    if (f.ln === 1) return `<code>split_at</code> = ${f.split}. Of ${ROWS} rows, the first ${f.split} train and the last ${ROWS - f.split} validate: what <code>validation_split=0.2</code> does inside Keras.`;
    if (f.ln === 2) return `The validation rows are the <b>last</b> ${ROWS - f.split}, taken in file order before any shuffling, as the Keras docs describe. This is the line your first port got wrong.`;
    if (f.ln === 3) return `The first ${f.split} rows become the training set.`;
    if (f.ln === 4) return `Batches of ${BATCH}, reshuffled every epoch: ${f.split} / ${BATCH} = ${BATCHES} batches. The Keras log printed <code>${BATCHES}/${BATCHES}</code> on every epoch for the same reason.`;
    if (f.ln === 5) return "<code>compile</code>'s optimizer, now handed the model's weights.";
    if (f.ln === 6) return "<code>compile</code>'s loss: binary cross-entropy on probabilities.";
    if (f.ln === 7) return `Epoch ${f.epoch + 1} of ${EPOCHS} starts.`;
    if (f.ln === 8) return `One pass over the ${BATCHES} batches: zero_grad, forward, loss, backward, step, as in the training-loop lesson. Dropout is on.`;
    if (f.ln === 9) return `Validation with dropout off: <code>val_loss</code> = ${f4(f.val)} after epoch ${f.epoch + 1}.${f.epoch === EPOCHS - 1 ? "" : " Keras printed this number as <code>val_loss</code> on each epoch line."}`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>fit, written out in PyTorch</h1>
        <p class="lead">This function does what the notebook's <code>fit</code> call did, with every choice written down. <code>train_one_epoch</code> and <code>evaluate</code> are the loops from the training-loop lesson. The run is real; some epochs are skipped.</p>
        <p class="task">Step through to the end.</p>
        ${kit.code(CODE, f.end ? 10 : f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>split_at <b>${f.split == null ? "–" : f.split}</b></span><span>epoch <b>${f.epoch == null ? "–" : f.epoch}</b></span><span>val_loss <b>${f.val == null ? "–" : f4(f.val)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. Broken on purpose: a port whose accuracy never moves. Click the cause, then pick the fix. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrongLine = null, wrongFix = null;
    const CAUSE = 2;
    const lineFb = {
      0: "That line only opens the model. Look at what the model's last module does to its output.",
      1: "The hidden layer is the same as in the working port, which trained fine.",
      3: `<code>BCEWithLogitsLoss</code> is a good loss: it expects raw scores (logits) and applies a sigmoid itself, which the PyTorch docs call more numerically stable. The problem is what it receives. Which line stops the model's output from being a raw score?`,
      4: "Same optimizer and learning rate as the working port.",
      5: "Same batches as the working port.",
      6: "This only runs the model on the validation rows.",
      7: `With raw scores, <code>&gt; 0</code> is the right cut: a score above 0 means a probability above 0.5. It explains the frozen accuracy, but only because the outputs are never below 0. Ask why they never are.`
    };
    const fixes = ["Delete nn.Sigmoid() from the model", "Change predicted = out > 0 to out > 0.5", "Raise the learning rate so the loss falls faster"];
    const FIX = 0;
    const fixFb = [null,
      `That changes how accuracy is counted, not how the model trains. The loss still applies a second sigmoid, so for a booking that was not cancelled it always sees a probability of at least 0.5, and that row's loss can never fall below ${BROKEN_FLOOR}. The model is trained toward a target it cannot reach.`,
      "The loss falls slowly because of a ceiling, not a slow step size. After two sigmoids, the probability the loss sees can never go below 0.5; no learning rate changes that."];
    const paint = () => {
      const lines = BROKEN_CODE.map((c, i) => {
        const cls = stage > 0 && i === CAUSE ? `lx-${ID}-ok` : wrongLine === i && stage === 0 ? `lx-${ID}-no` : "";
        const attr = stage === 0 ? (i === CAUSE ? " data-right" : i === 3 ? " data-wrong" : "") : "";
        return `<button type="button" class="${cls}" data-i="${i}"${attr}${stage > 0 ? " disabled" : ""}>${kit.esc(c)}</button>`;
      }).join("");
      el.innerHTML = `<h1>The port that will not learn</h1>
        <p class="lead">Another teammate ported the same notebook. It validates on the last ${VAL_ROWS} rows, like Keras. Their code and the real training log:</p>
        <div class="lx-${ID}-lines">${lines}</div>
        ${out(kit, [...BROKEN_LOG.slice(0, 3), "…", ...BROKEN_LOG.slice(3)])}
        <p class="lx-${ID}-cap">PyTorch run on this Mac, 2026-11-14</p>
        <p class="lead">Validation accuracy is ${f4(BROKEN_ACC[0])} on ${ACC_FLAT ? "every one of the" : "the"} ${EPOCHS} epochs. That is exactly the share of cancelled bookings in those rows: ${CANCELLED_TAIL} of ${TAIL_ROWS}. The model says “cancelled” for all ${BROKEN_PREDICTED} of them.</p>
        ${stage === 0 ? `<p class="task">Click the line that causes it.</p>` : stage === 1 ? `<p class="task">Now pick the fix.</p>` : ""}
        <div class="lpanel">
          ${stage === 0 && wrongLine != null ? kit.feedback(lineFb[wrongLine], false) : ""}
          ${stage >= 1 ? kit.feedback(`Right. The model already ends in <code>nn.Sigmoid()</code>, so its outputs were between ${BROKEN_OUT[0]} and ${BROKEN_OUT[1]}. <code>BCEWithLogitsLoss</code> applies a sigmoid again, so the probabilities it scored were only ${BROKEN_SQUASHED[0]} to ${BROKEN_SQUASHED[1]}: never below 0.5. Every output is above 0, so <code>out &gt; 0</code> marks every row “cancelled”. In Keras this choice is the loss's <code>from_logits</code> argument. In PyTorch it is two lines that must agree: the last module and the loss.`, true) : ""}
          ${stage === 1 ? `${kit.options(fixes, { picked: wrongFix, correct: FIX })}${wrongFix != null ? kit.feedback(fixFb[wrongFix], false) : ""}` : ""}
          ${stage === 2 ? kit.feedback("Right. Raw scores out of the model, one sigmoid inside the loss. Keep <code>&gt; 0</code> as the cut. (The other correct pair is the working port's: keep <code>nn.Sigmoid()</code>, use <code>nn.BCELoss()</code> and cut at 0.5.)", true) : ""}
        </div>`;
      if (stage === 0) el.querySelectorAll(`.lx-${ID}-lines button`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === CAUSE) { stage = 1; wrongLine = null; } else wrongLine = i;
        paint();
      });
      if (stage === 1) el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === FIX) { stage = 2; paint(); done(); return; }
        wrongFix = i; paint();
      });
    };
    paint();
  }

  /* 8. TensorFlow code you will meet: a hand-written training step. Not run by us. */
  function tfStep(ctx) {
    const { kit } = ctx;
    const head = `<h1>When the notebook skips fit</h1>
      <p class="lead"><b>Not run by us.</b> Written from the <a href="https://keras.io/guides/writing_a_custom_training_loop_in_tensorflow/">official Keras guide</a> and the <a href="https://www.tensorflow.org/guide/autodiff">TensorFlow autodiff guide</a>, checked 2026-11-14. TensorFlow is not installed here.</p>
      <p class="lead">Some TensorFlow notebooks write the training step by hand. <code>tf.data</code> makes the batches; <code>tf.GradientTape</code> records the forward pass so the gradients can be computed from it:</p>
      ${kit.code(TF_CODE, -1)}
      <p class="task">Translate the two key lines.</p>`;
    const blocks = [
      { q: "<code>grads = tape.gradient(loss_value, weights)</code> becomes…", right: 1,
        opts: [opt(kit, "optimizer.step()"), opt(kit, "loss_value.backward()"), opt(kit, "with torch.no_grad():")],
        fb: [["<code>step()</code> moves the weights. That is the next TensorFlow line, <code>optimizer.apply(...)</code>.", false],
          ["Right. Both compute the gradients of the loss. TensorFlow returns them as a list; PyTorch stores them in each weight's <code>.grad</code>.", true],
          ["<code>no_grad</code> turns gradient tracking <i>off</i>, for measuring. This line computes gradients.", false]] },
      { q: "Your PyTorch version of this loop needs one line that has no partner here. Which?", right: 2,
        opts: [opt(kit, "model.train()"), opt(kit, "loss_fn(model(x_batch), y_batch)"), opt(kit, "optimizer.zero_grad()")],
        fb: [["It does have a partner: <code>training=True</code> in the model call, which turns dropout on for that call.", false],
          ["That is the forward pass and the loss, the two lines inside the <code>with</code> block.", false],
          ["Right. <code>tape.gradient</code> hands back fresh gradients each time. PyTorch's <code>backward()</code> <b>adds</b> into <code>.grad</code>, so you clear it first. Forget it in a port and each batch steps with the sum of all earlier gradients.", true]] }
    ];
    multi(ctx, head, blocks);
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A monthly report notebook a manager re-runs exactly as it is",
      "A model the team will extend with its own PyTorch code, train in its PyTorch pipeline and maintain for years",
      "Checking whether the colleague's reported validation loss was measured fairly"
    ];
    const RIGHT = 1;
    const fb = [
      ["Nothing changes in it and it works. A port costs days of work plus re-checking every number, for no gain. Keep running it.", false],
      ["Right. The model will live inside PyTorch code, so one codebase beats two. Budget for re-checking: reproduce the old numbers on the same rows before you trust the port.", true],
      ["That needs reading, not porting. Find <code>validation_split</code> and the data order, then rerun the notebook if needed.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Port it, or just read it?</h1>
        <p class="lead"><b>Why read it:</b> Keras and TensorFlow code is all over older notebooks, tutorials and papers. Reading it lets you reuse that work and check its numbers.</p>
        <p class="lead"><b>Port it</b> when the model must live in your team's PyTorch code. <b>Don't port</b> when it only has to keep running or be checked: read it and rerun it. Keras 3 can also run the same model code on a PyTorch backend (we ran this lesson's notebook that way). Code that uses <code>tf.data</code> or <code>GradientTape</code> still needs TensorFlow.</p>
        <p class="lead"><b>Costs:</b> the hours of porting, and re-checking every number. Each hidden default (validation rows, batch size, shuffling, the loss's input) can shift results without any error.</p>
        <p class="task">Which of these calls for a full port?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it: is the difference a setting the high-level call chose for you? */
  const CASES = [
    ["A Keras notebook calls <code>model.fit(x, y, epochs=10)</code> with no batch size. The PyTorch port wraps the data in <code>DataLoader(dataset)</code> and nothing else. Each epoch takes far longer and the loss jumps around.", true,
      "Yes. Keras used batches of 32 and shuffled. <code>DataLoader</code> defaults to one row per batch and no shuffling. Write both choices out.",
      "Look at what was left out on both sides: Keras fills in 32 rows per batch and shuffles; <code>DataLoader</code> fills in 1 and no shuffle. That is a hidden default, so yes."],
    ["Keras has <code>Dense(32)</code> then <code>Dense(1)</code>, with no activation argument. The port puts <code>nn.ReLU()</code> between the two linear layers, and the results differ.", true,
      "Yes. <code>Dense</code> applies no activation unless you name one. The port added a ReLU that the original never had.",
      "No <code>activation</code> argument means none: Keras's <code>Dense</code> is linear by default. The port's ReLU is an addition, so yes, a default was misread."],
    ["You copy a Keras <code>Dense</code> kernel of shape (8, 16) into <code>nn.Linear(8, 16).weight</code> and get a shape error.", true,
      "Yes. Keras stores the kernel as inputs × outputs; PyTorch stores the weight as outputs × inputs. Transpose it.",
      "The two libraries lay the same weights out differently: (8, 16) in Keras, (16, 8) in PyTorch. That is a convention to translate, so yes."],
    ["The port and the notebook now validate on the same last rows with the same settings. Rerun with seeds 0, 1 and 2: the port's validation losses differ from each other about as much as from Keras's.", false,
      "No hidden setting is left. The gap is as big as the spread between seeds: random starting weights and batch order. Report a range over seeds, not one run.",
      "Every setting is already matched, and the port disagrees with <i>itself</i> across seeds by the same amount. That is randomness, not a translation mistake. Compare against the spread over seeds."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Hidden choice or not?</h1>
        <p class="lead">Four ports from other teams. In each, the PyTorch port does not match the Keras original.</p>
        <p class="task">Is the difference caused by something Keras decided for the author (a default or a convention) that the port did not copy? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can read a Keras notebook</h1>
      <p class="lead">You matched each Keras layer, <code>compile</code> and <code>fit</code> line to its PyTorch piece, found that <code>validation_split</code> had measured a different set of bookings, wrote <code>fit</code> out as a loop, and fixed a port that applied the sigmoid twice.</p>
      <p class="lead">When you port, check three things before you compare numbers: the same validation rows, the same batch and shuffle settings, and a loss that matches what the last layer outputs.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It builds on the networks and training loops you can now read in either library.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Reading Keras and TensorFlow code",
    checked: "2026-11-14",
    sources: [
      "https://keras.io/api/models/model_training_apis/",
      "https://keras.io/api/layers/core_layers/dense/",
      "https://keras.io/api/layers/regularization_layers/dropout/",
      "https://keras.io/api/optimizers/adam/",
      "https://keras.io/api/losses/probabilistic_losses/",
      "https://keras.io/getting_started/",
      "https://keras.io/guides/writing_a_custom_training_loop_in_tensorflow/",
      "https://www.tensorflow.org/guide/autodiff",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Linear.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.BCEWithLogitsLoss.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.BCELoss.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.CrossEntropyLoss.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Dropout.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.Adam.html",
      "https://docs.pytorch.org/docs/2.15/data.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.backward.html"
    ],
    interview: [
      {
        q: "You ported a Keras model to PyTorch and your validation loss is clearly better than the number in the old notebook. Your manager wants to announce the improvement. What do you check first?",
        good: [
          "Whether both measured the same rows: Keras's validation_split takes the last rows before shuffling, so sorted data gives a different validation set",
          "Re-run the port on exactly the old validation rows (or the old model on yours) before comparing",
          "Check the hidden defaults: batch size, shuffling, and whether the loss expects probabilities or raw scores",
          "Run a few seeds and compare against that spread, not one run"
        ],
        weak: "Announce it because PyTorch trains better, or tune the port further, without checking that both numbers come from the same validation rows."
      },
      {
        q: "A PyTorch port of a Keras classifier trains, but validation accuracy is the same on every epoch and equals the share of one class. Where do you look?",
        good: [
          "The model predicts one class for every row, so look at the output layer and the loss together",
          "A sigmoid in the model plus BCEWithLogitsLoss applies the sigmoid twice; the loss never sees a probability below 0.5",
          "Fix by removing the sigmoid (keep the logits loss, cut at 0) or keep it with BCELoss and cut at 0.5",
          "Print the range of the model's outputs on a batch to confirm"
        ],
        weak: "Raise the learning rate or train longer. That treats a wrong loss setup as slow training."
      }
    ],
    screens: [matchModel, matchTraining, whyDiffers, spotIdea, predictSummary, asCode, broken, tfStep, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c3 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
