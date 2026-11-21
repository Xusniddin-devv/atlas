/* Lesson: transfer learning for a small image dataset. Story: a plant nursery has 200 photos of three leaf
   diseases (leaf spot, blight, powdery mildew) and no budget to collect more. Ideas: (1) start from a network
   that already learned to see on a big photo collection, freeze it, and train only a new head; how much to freeze
   depends on how much data you have; (2) augmentations must not destroy the signal: a hue jitter erased blight's
   yellowing in a real run.
   Data, all real, from docs/ai-path/runs/s3-transfer-learning/ (CPU, seed 0; no model API calls):
   - leaves.py: the stand-in photos. We have no real nursery photos, so 200 leaf images are drawn by a script;
     the lesson says so on screen 1.
   - experiments.py + experiments.out.txt: small CNN from scratch, frozen ResNet-18 + new head, fine-tune all,
     the broken hue-jitter run, and one frozen run per augmentation (150 train / 50 validation photos).
   - numpy_head.py + numpy_head.out.txt: the new head trained from scratch in NumPy on the frozen features, traced.
   - count_params.py + count_params.out.txt: weights per ResNet-18 block.
   - samples.py + samples_small.json: the pictures shown (JPEG data URIs).
   Lesson-local style: photo strip, block list and small tables (.lx-s3-transfer-learning-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s3-transfer-learning";
  const fmt = n => n.toLocaleString("en-US");

  /* ---------- Data copied from the runs ---------- */
  const CLASSES = ["leaf spot", "blight", "mildew"]; // leaves.py CLASSES, in label order
  // experiments.out.txt (train/val split line and the run lines; losses are per epoch)
  const SPLIT = { train: 150, val: 50, valPer: [17, 17, 16] };
  const RUNS = {
    scratch: { trainable: 23779, total: 23779, epochs: 30, loss: [1.097, 1.077, 1.045, 0.983, 0.893, 0.781, 0.69, 0.608, 0.544, 0.485, 0.446, 0.4, 0.366, 0.35, 0.324, 0.305, 0.285, 0.259, 0.252, 0.241, 0.219, 0.194, 0.177, 0.17, 0.149, 0.139, 0.13, 0.123, 0.12, 0.102], val: 42, cm: [[15, 0, 2], [0, 16, 1], [5, 0, 11]] },
    frozen: { trainable: 1539, total: 11178051, epochs: 15, loss: [1.42, 0.923, 0.594, 0.382, 0.318, 0.244, 0.183, 0.156, 0.123, 0.121, 0.113, 0.092, 0.086, 0.098, 0.06], val: 50, cm: [[17, 0, 0], [0, 17, 0], [0, 0, 16]] },
    finetune: { trainable: 11178051, total: 11178051, epochs: 15, loss: [0.531, 0.069, 0.024, 0.011, 0.002, 0.002, 0.001, 0.001, 0.001, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], val: 50, cm: [[17, 0, 0], [0, 17, 0], [0, 0, 16]] },
    hue: { trainable: 1539, total: 11178051, epochs: 15, loss: [1.395, 1.008, 0.727, 0.64, 0.566, 0.469, 0.483, 0.411, 0.386, 0.402, 0.402, 0.348, 0.342, 0.378, 0.335], val: 38, cm: [[6, 11, 0], [1, 16, 0], [0, 0, 16]] }
  };
  // experiments.out.txt, runs aug_*: frozen ResNet-18, 15 epochs, one augmentation alone
  const AUG = {
    none: { val: 49, cm: [[17, 0, 0], [1, 16, 0], [0, 0, 16]] },
    hflip: { val: 50, cm: [[17, 0, 0], [0, 17, 0], [0, 0, 16]] },
    vflip: { val: 50, cm: [[17, 0, 0], [0, 17, 0], [0, 0, 16]] },
    rotate20: { val: 50, cm: [[17, 0, 0], [0, 17, 0], [0, 0, 16]] },
    brightness: { val: 49, cm: [[17, 0, 0], [1, 16, 0], [0, 0, 16]] },
    hue: { val: 38, cm: [[15, 2, 0], [10, 7, 0], [0, 0, 16]] },
    grayscale: { val: 47, cm: [[17, 0, 0], [3, 14, 0], [0, 0, 16]] }
  };
  // count_params.out.txt (three_class_head); blocks with no weights (relu, maxpool, avgpool) left out
  const BLOCKS = [["conv1", 9408], ["bn1", 128], ["layer1", 147968], ["layer2", 525568], ["layer3", 2099712], ["layer4", 8393728], ["fc", 1539]];
  const IMAGENET_FC = 513000; // count_params.out.txt, imagenet_head fc
  const FC_IN = 512;          // count_params.out.txt fc_in_features
  // numpy_head.out.txt: the trace of train_head, rows [line about to run, event (l line / r return), epoch, loss]
  const NP_TRACE = [[1,"l",null,null],[2,"l",null,null],[3,"l",0,null],[4,"l",0,null],[5,"l",0,null],[6,"l",0,null],[7,"l",0,1.0986],[8,"l",0,1.0986],[2,"l",0,1.0986],[3,"l",1,1.0986],[4,"l",1,1.0986],[5,"l",1,1.0986],[6,"l",1,1.0986],[7,"l",1,0.6729],[8,"l",1,0.6729],[2,"l",1,0.6729],[3,"l",2,0.6729],[4,"l",2,0.6729],[5,"l",2,0.6729],[6,"l",2,0.6729],[7,"l",2,0.4843],[8,"l",2,0.4843],[2,"l",2,0.4843],[3,"l",3,0.4843],[4,"l",3,0.4843],[5,"l",3,0.4843],[6,"l",3,0.4843],[7,"l",3,0.3803],[8,"l",3,0.3803],[2,"l",3,0.3803],[3,"l",4,0.3803],[4,"l",4,0.3803],[5,"l",4,0.3803],[6,"l",4,0.3803],[7,"l",4,0.3137],[8,"l",4,0.3137],[2,"l",4,0.3137],[3,"l",5,0.3137],[4,"l",5,0.3137],[5,"l",5,0.3137],[6,"l",5,0.3137],[7,"l",5,0.2675],[8,"l",5,0.2675],[2,"l",5,0.2675],[3,"l",6,0.2675],[4,"l",6,0.2675],[5,"l",6,0.2675],[6,"l",6,0.2675],[7,"l",6,0.2334],[8,"l",6,0.2334],[2,"l",6,0.2334],[3,"l",7,0.2334],[4,"l",7,0.2334],[5,"l",7,0.2334],[6,"l",7,0.2334],[7,"l",7,0.2072],[8,"l",7,0.2072],[2,"l",7,0.2072],[9,"l",7,0.2072],[9,"r",7,0.2072]];
  const NP_RESULT = { features: 512, cols: 513, learned: 1539, val: 50, valN: 50, train: 150, trainN: 150, lr: 0.01 }; // numpy_head.out.txt / numpy_head.py
  // The listing is train_head from numpy_head.py, line for line (line 0 = def).
  const NP_CODE = [
    "def train_head(leaf_features, disease, epochs, lr):",
    "    weights = np.zeros((leaf_features.shape[1], 3))",
    "    for epoch in range(epochs):",
    "        scores = leaf_features @ weights",
    "        probs = np.exp(scores - scores.max(1, keepdims=True))",
    "        probs /= probs.sum(1, keepdims=True)",
    "        loss = -np.log(probs[np.arange(len(disease)), disease]).mean()",
    "        probs[np.arange(len(disease)), disease] -= 1",
    "        weights -= lr * leaf_features.T @ probs / len(disease)",
    "    return weights"
  ];
  // The torchvision lines of experiments.py (pretrained() and the frozen branch of run(), SAFE), gathered in order.
  // Long calls are wrapped so each line fits a phone screen; the code is unchanged.
  const TV_CODE = [
    "model = resnet18(",
    "    weights=ResNet18_Weights.IMAGENET1K_V1)",
    "for p in model.parameters():",
    "    p.requires_grad = False",
    "model.fc = nn.Linear(",
    "    model.fc.in_features, 3)",
    "opt = torch.optim.Adam(",
    "    model.fc.parameters(), lr=1e-3)",
    "SAFE = [v2.RandomHorizontalFlip(),",
    "        v2.RandomVerticalFlip(),",
    "        v2.RandomRotation(20)]",
    "NORM = v2.Normalize(",
    "    mean=[0.485, 0.456, 0.406],",
    "    std=[0.229, 0.224, 0.225])"
  ];
  // The broken run's training transforms: SAFE + [v2.ColorJitter(hue=0.5)] in experiments.py (run "frozen_hue")
  const HUE_TF = ["v2.RandomHorizontalFlip()", "v2.RandomVerticalFlip()", "v2.RandomRotation(20)", "v2.ColorJitter(hue=0.5)"];
  const HUE_TF_AUG = ["hflip", "vflip", "rotate20", "hue"];
  // samples_small.json (samples.py): the first photo of each class, and the first blight photo after the hue jitter, four draws
  const PICS = {"leaf_spot": "data:image/jpeg;base64,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", "blight": "data:image/jpeg;base64,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", "mildew": "data:image/jpeg;base64,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", "blight_after_hue": ["data:image/jpeg;base64,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", "data:image/jpeg;base64,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", "data:image/jpeg;base64,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", "data:image/jpeg;base64,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"]};

  /* ---------- Derived from the data ---------- */
  const last = a => a[a.length - 1];
  const trainable = n => BLOCKS.slice(n).reduce((s, b) => s + b[1], 0); // train blocks from index n on
  const TOTAL = trainable(0);
  const L4 = BLOCKS.findIndex(b => b[0] === "layer4");
  const FC = BLOCKS.findIndex(b => b[0] === "fc");
  const RATIO = Math.round(RUNS.finetune.trainable / RUNS.frozen.trainable);
  const cmOff = (cm, t, p) => cm[t][p];
  const NP_FR = (() => {
    const fr = [{ ln: 1, epoch: null, loss: null, start: true }];
    for (const r of NP_TRACE) {
      if (r[0] === 7 && r[1] === "l") fr.push({ ln: 6, epoch: r[2], loss: r[3] });
      if (r[1] === "r") fr.push({ ln: 9, epoch: r[2], loss: r[3], end: true });
    }
    return fr;
  })();
  const NP_START_LOSS = NP_FR[1].loss;
  const NP_EPOCHS = Math.max(...NP_TRACE.map(r => r[2] == null ? -1 : r[2])) + 1; // epochs run, from the trace

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-pics { display: flex; flex-wrap: wrap; gap: 12px; margin: 14px 0 4px; }
      .lx-${ID}-pics figure { margin: 0; width: 96px; }
      .lx-${ID}-pics img { display: block; width: 96px; height: 96px; border: 1px solid var(--line); border-radius: 6px; }
      .lx-${ID}-pics figcaption { font-size: 13.5px; color: var(--muted); margin-top: 4px; line-height: 1.3; }
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { border-bottom: 1px solid var(--line); padding: 7px 6px; text-align: left; vertical-align: top; }
      .lx-${ID}-tbl th { font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-tbl td.n { font-family: var(--mono); text-align: right; white-space: nowrap; }
      .lx-${ID}-tbl td.hot { font-weight: 700; box-shadow: inset 0 0 0 2px var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-blocks { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-blk { display: grid; grid-template-columns: 5.2em 1fr auto; gap: 10px; align-items: baseline; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 15px; }
      .lx-${ID}-blk b { font-family: var(--mono); font-weight: 600; }
      .lx-${ID}-blk .w { font-family: var(--mono); color: var(--muted); text-align: right; }
      .lx-${ID}-blk.fz { color: var(--faint); }
      .lx-${ID}-blk.fz b { color: var(--muted); }
      .lx-${ID}-tag { font: 600 12px var(--mono); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-wrap { overflow-x: auto; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
      .lx-${ID}-checks { list-style: none; padding: 0; margin: 12px 0 0; }
      .lx-${ID}-checks li { border-top: 1px solid var(--line); }
      .lx-${ID}-checks label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .lx-${ID}-checks label span { padding-top: 10px; }
      .lx-${ID}-checks input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .lx-${ID}-checks input:checked { background-color: var(--good); outline-color: var(--good); }
    `;
    document.head.appendChild(s);
  }
  const pic = (kit, src, cap) => `<figure><img src="${src}" alt="${kit.esc(cap)}" width="96" height="96"><figcaption>${kit.esc(cap)}</figcaption></figure>`;
  const pics = (kit, list) => `<div class="lx-${ID}-pics">${list.map(([s, c]) => pic(kit, s, c)).join("")}</div>`;
  function confusion(kit, cm, title, hot) {
    return `<div class="lx-${ID}-wrap"><table class="lx-${ID}-tbl" aria-label="${kit.esc(title)}"><thead><tr><th>${kit.esc(title)}: really</th>${CLASSES.map(c => `<th>called ${kit.esc(c)}</th>`).join("")}</tr></thead><tbody>${cm.map((row, t) => `<tr><td>${kit.esc(CLASSES[t])}</td>${row.map((v, p) => `<td class="n${hot && hot[0] === t && hot[1] === p ? " hot" : ""}">${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function blocks(kit, from) { // blocks before index `from` are frozen; from = null: the original ImageNet network
    const orig = from == null;
    return `<div class="lx-${ID}-blocks">${BLOCKS.map(([n, w], i) => `<div class="lx-${ID}-blk${!orig && i < from ? " fz" : ""}"><b>${kit.esc(n)}</b><span class="lx-${ID}-tag">${orig ? (i === FC ? "scores 1,000 categories" : "") : i < from ? "frozen" : (i === FC ? "new head, trains" : "trains")}</span><span class="w">${fmt(orig && i === FC ? IMAGENET_FC : w)}</span></div>`).join("")}</div>`;
  }
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  const bindOpts = (el, f) => el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => f(+b.dataset.i));

  /* 1. The situation: a network trained from zero on 150 photos. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const R = RUNS.scratch;
    const mis = cmOff(R.cm, 2, 0);
    const opts = [
      "Train it for many more epochs",
      "Make the network bigger, so it can learn more",
      "Start from a network that has already learned to see from a large photo collection",
      "Use fewer photos for validation, so the score is higher"
    ];
    const RIGHT = 2;
    const fb = [
      [`The training loss already fell from ${R.loss[0]} to ${last(R.loss)}: the network fits the ${SPLIT.train} photos it trains on. The trouble is the held-back photos it has never seen. More epochs only fit the old photos more closely.`, false],
      [`A bigger network has more weights to set from the same ${SPLIT.train} photos. That makes it easier to memorise them, not easier to learn what a spot looks like in general.`, false],
      [`Right. Learning edges, spots and textures from zero takes many photos. A network trained on a big photo collection has already learned those. The nursery can borrow that and teach only the last step: which of its three diseases this is. That is <b>transfer learning</b>, and this lesson is about doing it well with few photos.`, true],
      ["That changes the measurement, not the model. With fewer photos the score only gets noisier; the network still meets new leaves it has never seen.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>200 leaf photos, three diseases</h1>
        <p class="lead">A plant nursery wants an app that tells three leaf diseases apart from a photo: leaf spot, blight (the same kind of spots, but the leaf turns yellow) and powdery mildew. It has 200 labelled photos and no budget to take more.</p>
        ${pics(kit, [[PICS.leaf_spot, "leaf spot"], [PICS.blight, "blight"], [PICS.mildew, "mildew"]])}
        <p class="lx-${ID}-cap">We have no real nursery photos. Every run in this lesson uses 200 leaf images drawn by a script, with random size, angle, light and noise.</p>
        <p class="lead">A first try: a small convolutional network (${fmt(R.trainable)} weights), trained from random weights on ${SPLIT.train} photos for ${R.epochs} epochs. The other ${SPLIT.val} photos are held back to score it. Its training loss fell from ${R.loss[0]} to ${last(R.loss)}. On the held-back photos it got <b>${R.val} of ${SPLIT.val}</b> right; ${mis} mildew leaves were called leaf spot.</p>
        ${confusion(kit, R.cm, "from scratch", [2, 0])}
        <p class="lx-${ID}-cap">Each row is the real disease; each column is what the network called it. The framed cell is the ${mis} mildew leaves called leaf spot.</p>
        <p class="task">Without new photos, what is most likely to raise that score?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Spot the idea: why does a network trained on everyday photos help with leaves? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Its photo collection contains plant diseases, so it already knows these three",
      "Its early layers find edges, spots, colour blobs and textures, which leaves have too; only its last layer is about its own 1,000 categories",
      "Any network with more weights does better",
      "It was trained longer, so its weights are more accurate for every task"
    ];
    const RIGHT = 1;
    const fb = [
      ["Its 1,000 categories are everyday objects and animals. Even if a leaf is among them, nothing there separates leaf spot from blight. What helps is more general than that.", false],
      [`Right. The early layers of an image network learn general things such as edge detectors and colour blob detectors; later layers get more and more specific to the categories it was trained on. So you keep the early part, throw away the last layer (the <b>head</b>, ${fmt(IMAGENET_FC)} weights that score the 1,000 categories) and put in a new head with 3 outputs. Keeping a layer's weights fixed while you train is called <b>freezing</b> it.`, true],
      [`The previous screen showed the opposite risk: more weights trained on ${SPLIT.train} photos memorise more easily. The help comes from what the weights already learned, not from how many there are.`, false],
      ["Longer training on its own categories makes it better at those. It helps the leaves only because the early layers learned general visual parts that leaves share.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why borrowed weights help</h1>
        <p class="lead">torchvision, PyTorch's vision library, ships <b>ResNet-18</b>, a convolutional network with ${fmt(BLOCKS.slice(0, FC).reduce((s, b) => s + b[1], 0) + IMAGENET_FC)} weights, trained on ImageNet: 1.2 million photos in 1,000 everyday categories (dogs, cars, mugs). No leaf diseases. Its blocks, from the photo in to the answer out:</p>
        ${blocks(kit, null)}
        <p class="lx-${ID}-cap">Weights per block (count_params.py). Blocks without weights left out. conv1 is the first convolution, bn1 its batch normalisation, layer1 to layer4 are groups of convolutions, and fc is the last layer, which gives the final scores.</p>
        <p class="task">Why can a network that never saw leaf diseases help tell them apart?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. By hand: how much to freeze for three dataset sizes. */
  const FREEZE_OPTS = [
    ["Freeze everything, train only the new head", FC],
    ["Freeze conv1 to layer3, train layer4 and the head", L4],
    ["Train every layer, with a small learning rate", 0]
  ];
  const FREEZE_CASES = [
    ["The nursery's 200 photos.", 0,
      { 0: "Right. With this little data, training millions of weights risks fitting the 150 training photos and nothing else. A new head on top of the frozen network is a small linear classifier: few weights, little to overfit.",
        1: "layer4 alone holds most of the network's weights. Training them from 150 photos invites memorising. With this little data, train only the head.",
        2: "Every one of these weights would move to fit 150 photos. That is the overfitting risk the borrowed weights were meant to avoid." }],
    ["Next year: 5,000 labelled photos of the same three diseases.", 1,
      { 0: "That works, but it probably gives up some accuracy: with this much data you can afford to adapt the most specific block to leaves too.",
        1: "Right. A common middle path: keep the early, general blocks fixed. <b>Fine-tune</b> (keep training borrowed weights on your own photos) the later, more specific part plus the head. The early blocks' edge and colour detectors still fit; layer4 can learn leaf-specific patterns.",
        2: "Possible, but riskier than needed: the early blocks already find edges and colour blobs well, and 5,000 photos are still few for millions of weights. Start by training only the later part." }],
    ["A seed company with 100,000 labelled leaf photos.", 2,
      { 0: "With this much data, a head on frozen features usually leaves the most accuracy unused. You have enough photos to adapt the whole network without memorising.",
        1: "Safe, but with this much data there is little overfitting risk in training every layer, and the early layers can adapt to leaves too.",
        2: "Right. With a lot of data you can fine-tune through the whole network. You still start from the borrowed weights, and use a smaller learning rate for them than for the new head, so they change slowly instead of being wiped out." }]
  ];
  function freezeByHand({ el, done, kit }) {
    ensureStyle();
    const ans = FREEZE_CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>How much to freeze?</h1>
        <p class="lead">Freezing decides how many weights your photos must set. The three choices, with the weights each one trains:</p>
        ${kit.table(FREEZE_OPTS.map(([t, from]) => [t, fmt(trainable(from))]), { head: ["choice", "weights trained"] })}
        <p class="task">For each dataset, pick how much to freeze. All three are leaf photos, close enough to everyday photos that the early blocks still apply. Pick again if you change your mind.</p>
        ${FREEZE_CASES.map(([q, right, f], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(FREEZE_OPTS.map(o => kit.esc(o[0])), { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(f[ans[i]], ans[i] === right)}${ans[i] === right ? blocks(kit, FREEZE_OPTS[right][1]) : ""}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (FREEZE_CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 4. Predictions against the recorded runs. */
  function predictRuns({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const F = RUNS.frozen, T = RUNS.finetune, S = RUNS.scratch;
    const Q = [
      { right: 1, opts: [fmt(F.total), fmt(F.trainable), fmt(IMAGENET_FC), fmt(S.trainable)].map(String),
        fb: [[`That is every weight in the network. Frozen weights are still used to turn each photo into features, but training does not change them.`, false], null,
             [`${fmt(IMAGENET_FC)} is the old ImageNet head: ${FC_IN} inputs times 1,000 outputs, plus 1,000. It was thrown away.`, false],
             [`${fmt(S.trainable)} is the small network from screen 1, trained from zero. Here only the new head trains.`, false]] },
      { right: 1, opts: ["It gets clearly more right than the frozen run", "It gets the same number right", "It gets clearly fewer right"],
        fb: [[`That assumes more weights that can move means more learned. The borrowed features already separate these leaves; the extra freedom mostly adds room to memorise ${SPLIT.train} photos.`, false], null,
             [`That is the real risk with small data, and on messier photos it can happen. On these drawn leaves the borrowed weights were strong enough that it did not. Predict again.`, false]] }
    ];
    const table = () => `<div class="lx-${ID}-wrap"><table class="lx-${ID}-tbl"><thead><tr><th>run</th><th>weights trained</th><th>last train loss</th><th>right of ${SPLIT.val}</th></tr></thead><tbody>
      ${[["from scratch", S], ["frozen + new head", F], ["fine-tune all", T]].map(([n, r]) => `<tr><td>${n}</td><td class="n">${fmt(r.trainable)}</td><td class="n">${last(r.loss)}</td><td class="n">${r.val}</td></tr>`).join("")}</tbody></table></div>`;
    const paint = () => {
      const q = Q[stage];
      el.innerHTML = `<h1>Predict, then check the runs</h1>
        <p class="lead">Two runs from ResNet-18's ImageNet weights, on the same ${SPLIT.train} training photos and scored on the same ${SPLIT.val}. <b>Frozen</b>: every block frozen, a new head with 3 outputs. <b>Fine-tune all</b>: the same new head, but every block trains too.</p>
        ${stage === 0 ? `<p class="task">The frozen blocks turn each photo into ${FC_IN} numbers, its <b>features</b>. The new head takes those ${FC_IN} features and gives 3 scores. How many weights does the frozen run train?</p>` : ""}
        ${stage === 1 ? `<p class="task">Fine-tune all trains about ${fmt(RATIO)} times more weights. On the ${SPLIT.val} held-back photos, it...</p>` : ""}
        <div class="lpanel">${stage >= 1 ? kit.feedback(`Right: ${FC_IN} × 3 + 3 = ${fmt(F.trainable)} (one weight per feature per disease, plus one bias per disease), out of ${fmt(F.total)}.`, true) : ""}
        ${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Both runs got ${F.val} of ${SPLIT.val}; the network trained from zero got ${S.val}. The borrowed weights did the work. Fine-tuning everything gained nothing on these photos. Its training loss reached ${last(T.loss).toFixed(3)} (the run rounds to three decimals). So it fits its ${SPLIT.train} training photos perfectly: it can memorise them. Our drawn leaves are easy. On real, messier photos, that memorising is where small datasets go wrong. Fine-tune all also computes a gradient for every weight, so each step needs more memory and time.`, true)}
        ${stage === 2 ? table() : ""}</div>`;
      bindOpts(el, i => {
        ans = i;
        if (i === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. From scratch: the new head in NumPy, on the frozen features. */
  function scratchHead({ el, done, kit }) {
    ensureStyle();
    let asked = null, ok = false, i = 0;
    const opts = ["0", NP_START_LOSS.toFixed(4), "3.0000"];
    const RIGHT = 1;
    const fb = [
      ["A loss of 0 means the model is certain and right. With every weight at zero it is not certain of anything.", false],
      null,
      ["The loss is minus the log of the probability given to the right disease. With three equal scores that probability is 1/3, and −log(1/3) is far from 3.", false]
    ];
    const say = f => {
      if (f.start) return `The frozen ResNet-18 already turned each photo into ${NP_RESULT.features} numbers, rescaled with the training photos' mean and spread, plus a constant 1 for the bias: ${NP_RESULT.cols} columns. <code>weights</code> starts as a ${NP_RESULT.cols} × 3 table of zeros.`;
      if (f.end) return `Done: ${fmt(NP_RESULT.learned)} numbers learned, the same count as the torchvision head. Scored on the held-back photos: <b>${NP_RESULT.val} of ${NP_RESULT.valN}</b> right. The backbone was never touched; this is the whole training.`;
      const prev = NP_FR[NP_FR.indexOf(f) - 1];
      return f.epoch === 0
        ? `Epoch 0: every score is 0, so each disease gets probability 1/3, and the loss is −log(1/3) = ${f.loss}.`
        : `Epoch ${f.epoch}: loss ${f.loss}${prev && prev.loss != null ? `, down from ${prev.loss}` : ""}. The last two lines of the loop turned the probabilities into the gradient (probability minus 1 for the right disease) and moved the weights against it.`;
    };
    const paint = () => {
      const f = NP_FR[i];
      el.innerHTML = `<h1>The new head, from scratch</h1>
        <p class="lead">The frozen part of the network, everything before the head, is called the <b>backbone</b>. With it frozen, training the head is plain softmax regression on fixed features: like the logistic regression you already built, with 3 outputs. This NumPy function trained it on the ${SPLIT.train} photos' features for ${NP_EPOCHS} epochs, learning rate ${NP_RESULT.lr}.</p>
        ${kit.code(NP_CODE, ok ? f.ln : 1)}
        ${!ok ? `<p class="task">All weights start at zero. What will the loss be in epoch 0?</p><div class="lpanel">${ask(kit, opts, RIGHT, asked, fb)}</div>` : `
        <p class="task">Step through the run to the end.</p>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === NP_FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>epoch <b>${f.epoch == null ? "–" : f.epoch}</b></span><span>loss <b>${f.loss == null ? "–" : f.loss}</b></span><span>frame <b>${i + 1} / ${NP_FR.length}</b></span></div>
        ${kit.feedback(say(f))}`}`;
      if (!ok) bindOpts(el, k => { asked = k; if (k === RIGHT) ok = true; paint(); });
      else {
        el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
        el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === NP_FR.length - 1) done(); };
      }
    };
    paint();
  }

  /* 6. The real library: torchvision. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The resnet18(weights=...) line: load different weights",
      "The freeze loop and the optimizer line: stop freezing layer4, and give its weights to the optimizer (with a smaller learning rate)",
      "The model.fc line: a bigger new head",
      "The Normalize line: new numbers for it"
    ];
    const RIGHT = 1;
    const fb = [
      ["The ImageNet weights are still the right start. What changes is which of them may move during training.", false],
      ["Right. Two things decide what trains: <code>requires_grad</code> (whether a gradient is computed for a weight) and what you hand the optimizer. Unfreeze layer4 and add its weights to the optimizer as a second group with a smaller learning rate; the fine-tune-all run in experiments.py used 1e-4 for the borrowed weights and 1e-3 for the head.", true],
      ["The head's size is set by the number of diseases, still 3. More data does not change it.", false],
      ["These must stay as they are: they are the mean and spread of the photos the weights were trained on. The torchvision docs call matching the weights' preprocessing critical; change them and the frozen features stop meaning what they learned to mean.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same thing with torchvision</h1>
        <p class="lead">The frozen run, from experiments.py. Four things matter. <code>weights=</code> loads the ImageNet weights (without it the network starts random). <code>requires_grad = False</code> freezes a weight. Assigning <code>model.fc</code> replaces the head, sized from <code>in_features</code> (${FC_IN}); a new layer trains by default. The optimizer gets only the head's weights. <code>SAFE</code> lists random flips and a rotation for the training photos; <code>NORM</code> rescales the pixels.</p>
        ${kit.code(TV_CODE, -1)}
        <p class="lead">Recorded result: ${fmt(RUNS.frozen.trainable)} of ${fmt(RUNS.frozen.total)} weights trained, ${RUNS.frozen.val} of ${SPLIT.val} held-back photos right. (The run also kept the frozen part in eval mode, so its batch-norm statistics stayed as learned.)</p>
        <p class="task">Next year the nursery has 5,000 photos and wants layer4 to train as well. Which lines change?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: the hue jitter that erased the yellowing. */
  function brokenHue({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const H = RUNS.hue;
    const called = cmOff(H.cm, 0, 1);
    const Q = [
      { right: 3, opts: HUE_TF.map(t => `<span class="lx-${ID}-opt">${kit.esc(t)}</span>`),
        fb: HUE_TF_AUG.map((k, i) => i === 3 ? null : [`${kit.esc(HUE_TF[i])} moves pixels around but keeps every colour. A frozen run with only this augmentation got ${AUG[k].val} of ${SPLIT.val}. Leaf spot and blight differ by colour, not by where the spots are.`, false]) },
      { right: 2, opts: ["Train for more epochs", "Apply the same jitter to the held-back photos too", "Remove the hue jitter; if the light varies, jitter brightness a little instead"],
        fb: [[`The training loss was still ${last(H.loss)} after ${H.epochs} epochs, against ${last(RUNS.frozen.loss)} without the jitter, and more epochs cannot bring back a difference the jitter keeps scrambling.`, false],
             ["Then the yellowing is scrambled at scoring time as well. The model still cannot tell the two apart; you have only hidden the mistake in a different place.", false], null] }
    ];
    const paint = () => {
      const q = Q[stage];
      el.innerHTML = `<h1>The run that lost the yellowing</h1>
        <p class="lead">A colleague added four augmentations: random changes applied to each training photo every epoch, so the model sees more variety. Same frozen ResNet-18, same photos. The score fell from ${RUNS.frozen.val} to <b>${H.val} of ${SPLIT.val}</b>:</p>
        ${confusion(kit, H.cm, "4 augmentations", stage >= 1 ? [0, 1] : null)}
        <p class="lead">Training transforms in that run:</p>
        ${kit.code(HUE_TF.map(t => t + ","), stage >= 1 ? 3 : -1)}
        ${stage >= 1 ? `${pics(kit, [[PICS.blight, "blight, as photographed"], ...PICS.blight_after_hue.map((s, k) => [s, `after the jitter, draw ${k + 1}`])])}<p class="lx-${ID}-cap">The first blight photo, and the same photo through ColorJitter(hue=0.5) four times (samples.py).</p>` : ""}
        ${stage === 0 ? `<p class="task">${called} leaf spot photos were called blight. Which line caused it?</p>` : ""}
        ${stage >= 1 ? `<p class="${stage === 1 ? "task" : "lead"}">${stage === 1 ? "Right: " : ""}<code>hue=0.5</code> rotates every colour by a random amount up to half the colour wheel, the largest the docs allow. A yellowed leaf can come out green, and a green one yellow, so in training the leaf's colour said nothing about the disease.${stage === 1 ? " What is the fix?" : ""}</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Right. The run with only the flips and the rotation is the frozen run from before: ${RUNS.frozen.val} of ${SPLIT.val}. An augmentation must only change things that do not decide the label. For these diseases, colour decides the label.`, true)}</div>`;
      bindOpts(el, i => {
        ans = i;
        if (i === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 8. Six augmentations: safe or not for these diseases. */
  const AUG_CASES = [
    ["Flip left to right (RandomHorizontalFlip)", "hflip", true, "A leaf seen in a mirror has the same disease. Spots and colour are unchanged."],
    ["Flip top to bottom (RandomVerticalFlip)", "vflip", true, "Photos of a leaf on a bench have no fixed up or down, so this is a photo the nursery could really take."],
    ["Rotate up to 20 degrees (RandomRotation(20))", "rotate20", true, "Leaves lie at any angle. Rotation changes where the spots are, never what they are."],
    ["Change brightness by up to 20% (ColorJitter(brightness=0.2))", "brightness", true, "Greenhouse light changes through the day. A small brightness change keeps the leaf's hue, so yellow stays yellow."],
    ["Shift hue by up to half the colour wheel (ColorJitter(hue=0.5))", "hue", false, "This is the one from the broken run. It turns yellow leaves green and green ones yellow, and colour is what separates blight from leaf spot."],
    ["Turn half the photos to grey (RandomGrayscale(p=0.5))", "grayscale", false, "Half the training photos lose colour completely, so half the time the model must decide without the yellowing."]
  ];
  function augmentations({ el, done, kit }) {
    ensureStyle();
    const ans = AUG_CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which augmentations are safe?</h1>
        <p class="lead">An augmentation is safe when the changed photo still shows the same disease, and could be a real photo the app will see. Each one below was also run alone (frozen ResNet-18, ${RUNS.frozen.epochs} epochs). Without any augmentation, the score was ${AUG.none.val} of ${SPLIT.val}.</p>
        <p class="task">For each one: safe for these three diseases? Pick again if you change your mind.</p>
        ${AUG_CASES.map(([q, k, safe, why], i) => {
          const right = safe ? 0 : 1, a = AUG[k];
          const blight = a.cm[1][1];
          return `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Safe", "Not safe"], { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(`${ans[i] === right ? "" : (safe ? "It is safe. " : "It is not safe. ")}${why} Recorded with it alone: ${a.val} of ${SPLIT.val}, blight right ${blight} of ${SPLIT.valPer[1]}.`, ans[i] === right)}</div>`;
        }).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (AUG_CASES.every(([, , s], j) => ans[j] === (s ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Collect thousands of new photos and train a network from zero",
      "Photograph the new disease, give the head a fourth output, and retrain the head",
      "Write rules by hand for the new disease's spots"
    ];
    const RIGHT = 1;
    const fb = [
      [`That throws away what made 200 photos enough. The frozen backbone does not care how many diseases there are; only the head does.`, false],
      [`Right. The backbone stays frozen and unchanged; the head grows from ${fmt(RUNS.frozen.trainable)} to ${FC_IN} × 4 + 4 = ${fmt(FC_IN * 4 + 4)} weights. The real cost is the labelled photos of the new disease, and checking which augmentations are safe for it.`, true],
      ["Hand-written rules break on every change in light, angle and leaf size, which the network already copes with. Rules suit simple checks, such as how dark a photo is, not telling diseases apart.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for transfer learning</h1>
        <p class="lead"><b>What it is for:</b> image (or other) tasks with few labelled examples, where a network trained on a big, similar collection exists.</p>
        <p class="lead"><b>Reach for it</b> first for almost any small image classifier: freeze, new head, safe augmentations, then unfreeze more only if data allows.</p>
        <p class="lead"><b>Not</b> when the input is not like the pretrained network's (numbers in a table, sensor readings: use the models for tabular data), or when a fixed rule does the job.</p>
        <p class="lead"><b>Costs:</b> labelled photos; every prediction still runs the whole network; the pretrained weights may come with licence terms from their training data; and an unsafe augmentation can quietly erase the signal.</p>
        <p class="task">Next spring a fourth disease appears. What is the cheapest change that handles it?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A bakery has 300 photos of loaves in four classes: fine, burnt, underbaked, collapsed. It wants a camera on the line to sort them.", true,
      "Yes. Few labelled photos and an everyday-looking image task: freeze a pretrained network and train a new 4-output head. Check augmentations: colour separates burnt from fine.",
      "Few photos and a photo task is exactly the case: a pretrained network already sees crust texture and shape; train a new head on top."],
    ["Predict how much each greenhouse bed needs watering tomorrow from its soil-moisture, temperature and humidity readings.", false,
      "No. The input is a row of sensor numbers, not a photo. An image network's features describe edges and textures; there are none here. Use a model for tabular data, such as gradient boosting.",
      "There is no image here: a pretrained image network has nothing to transfer, because its learned edge and texture detectors need pixels. Tabular readings call for a tabular model."],
    ["A clinic has 2,000 labelled thermal camera images of horses' legs, looking for swelling. They look nothing like everyday photos.", true,
      "Yes, still worth starting from pretrained weights, even for very different images; with 2,000 images, fine-tune more of the network than just the head, since the later, specific blocks fit everyday photos, not thermal ones.",
      "Even for images unlike the original collection, starting from pretrained weights often beats starting from zero. The difference changes how much to unfreeze, not whether to borrow."],
    ["Before upload, reject photos that are too dark to read.", false,
      "No. Average brightness below a threshold is one line of code. No labels to collect, no model to train or run, nothing to go wrong in an augmentation.",
      "A dark photo is a measured fact, not a pattern to learn: compute the mean pixel value and compare with a threshold. A trained model adds cost and nothing else."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Transfer learning or not?</h1>
        <p class="lead">Four requests from other jobs. Transfer learning here means: start from a network pretrained on a big photo collection, freeze some of it, train a new head.</p>
        <p class="task">Would you reach for it? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-transfer-learning.ipynb";
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const S = RUNS.scratch, F = RUNS.frozen, H = RUNS.hue;
    const checks = [
      `The from-scratch network's training loss falls from about ${S.loss[0]} to about ${last(S.loss)} over ${S.epochs} epochs, while it gets ${S.val} of ${SPLIT.val} held-back photos right.`,
      `The frozen ResNet-18 trains ${fmt(F.trainable)} of ${fmt(F.total)} weights and gets ${F.val} of ${SPLIT.val} right.`,
      `The NumPy head's loss is ${NP_START_LOSS} in epoch 0, before it has learned anything.`,
      `With ColorJitter(hue=0.5) added, the score drops to ${H.val} of ${SPLIT.val}, and the mistakes are leaf spot and blight swapped, never mildew.`
    ];
    el.innerHTML = `<h1>You can reuse a trained network</h1>
      <p class="lead">You saw why ${SPLIT.train} photos are too few to learn to see from zero, chose how much to freeze for three dataset sizes, trained a new head in NumPy and in torchvision, and found the augmentation that erased the yellowing.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a> and run the same experiments on the drawn leaves.` : "The notebook for this lesson is on its way. It runs the same experiments on the drawn leaves."} What you should see (from our run):</p>
      <ul class="lx-${ID}-checks">${checks.map((c, i) => `<li><label><input type="checkbox" id="lx-${ID}-ck${i}"><span>${kit.esc(c)}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here a photo got one label; next you decide when a product needs boxes around each thing, or a label for every pixel, instead.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Transfer learning for a small image dataset",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial.html",
      "https://cs231n.github.io/transfer-learning/",
      "https://docs.pytorch.org/vision/stable/models.html",
      "https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.resnet18.html",
      "https://docs.pytorch.org/vision/stable/generated/torchvision.transforms.v2.ColorJitter.html"
    ],
    interview: [
      {
        q: "You have 300 labelled photos for a new product-defect classifier and a pretrained ResNet. Walk me through how you set up training.",
        good: [
          "Load the pretrained weights, freeze the backbone, and replace the final layer with one sized for my classes",
          "Give the optimizer only the new head's weights at first; unfreeze later blocks only if there is enough data, with a smaller learning rate for them",
          "Use the preprocessing the weights were trained with, such as the same normalisation",
          "Pick augmentations that keep the label true, and hold back a validation set to compare runs",
          "Look at the confusion matrix per class, not only the overall accuracy"
        ],
        weak: "Train the whole network from scratch, or fine-tune every layer straight away, without asking whether 300 photos can set millions of weights."
      },
      {
        q: "After you added data augmentation, overall accuracy dropped and almost all new mistakes are between two classes. How do you find the cause?",
        good: [
          "Ask what separates those two classes: colour, size, orientation",
          "Look at augmented training images: an augmentation may destroy that difference, such as a hue jitter on a colour-defined class",
          "Remove augmentations one at a time, or run each alone, and compare the validation scores",
          "Keep only augmentations that produce images the model could really meet"
        ],
        weak: "Train longer or add more augmentation, without checking whether an augmentation erased the feature that separates the classes."
      }
    ],
    screens: [situation, spotIdea, freezeByHand, predictRuns, scratchHead, library, brokenHue, augmentations, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: FREEZE_CASES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(NP_FR.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#c4 [data-wrong]"], right: AUG_CASES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
