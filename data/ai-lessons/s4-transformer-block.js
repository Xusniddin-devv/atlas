/* Lesson: a transformer block from scratch. Story: a team inherits a half-written PyTorch file for tagging
   building-inspection notes and must get one block to run before anything else.
   Ideas: (1) a block is attention (words look at each other), a feed-forward layer (each word alone), two
   residual adds and two layer norms; every add needs the sublayer to hand back the input's shape, so the block's
   output shape equals its input shape and blocks can be stacked; (2) the library layer nn.TransformerEncoderLayer
   is the same block, and batch_first decides which dimension it treats as the words.
   Data, all from real runs on this Mac (PyTorch 2.15, CPU, seed 0), in docs/ai-path/runs/s4-transformer-block/:
   - block.py: the block (Block, block_forward) and the two six-word notes;
   - trace_block.py + trace_block.out.txt: block_forward traced line by line (tensor shapes), the one-changed-word
     experiment (which output rows change), parameter counts;
   - broken.py + broken.out.txt: the inherited block with down = Linear(64, 64), forward hooks printing each layer's
     output shape, and the real RuntimeError;
   - library.py + library.out.txt: nn.TransformerEncoderLayer with our weights copied in, batch_first True/False.
   No model API calls. Lesson-local style: clickable log rows and a checklist (.lx-s4-transformer-block-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s4-transformer-block";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s4-transformer-block.ipynb";
  const sh = a => `(${a.join(", ")})`;
  const prod = a => a.reduce((x, y) => x * y, 1);

  /* ---------- Data copied from the runs ---------- */
  // block.py NOTES, and the sizes used in every run (Block() defaults)
  const NOTES = [["rust", "on", "balcony", "rail", "near", "door"], ["hairline", "crack", "above", "east", "window", "lintel"]];
  const D_MODEL = 16, HEADS = 4, D_FF = 64;
  // trace_block.out.txt: listing of block_forward (line 0 = def) and the traced steps (tensor shapes)
  const CODE = [
    "def block_forward(blk, notes):",
    "    qkv = blk.qkv(notes)",
    "    q, k, v = qkv.chunk(3, dim=-1)",
    "    q, k, v = map(blk.split_heads, (q, k, v))",
    "    scores = q @ k.transpose(-2, -1) / blk.dh ** 0.5",
    "    weights = scores.softmax(dim=-1)",
    "    mixed = blk.merge_heads(weights @ v)",
    "    notes = blk.norm1(notes + blk.proj(mixed))",
    "    wide = blk.up(notes).relu()",
    "    notes = blk.norm2(notes + blk.down(wide))",
    "    return notes"
  ];
  const TRACE = [
    { line: 1, ev: "line", vars: { notes: [2, 6, 16] } },
    { line: 2, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48] } },
    { line: 3, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 6, 16], k: [2, 6, 16], v: [2, 6, 16] } },
    { line: 4, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 4, 6, 4], k: [2, 4, 6, 4], v: [2, 4, 6, 4] } },
    { line: 5, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 4, 6, 4], k: [2, 4, 6, 4], v: [2, 4, 6, 4], scores: [2, 4, 6, 6] } },
    { line: 6, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 4, 6, 4], k: [2, 4, 6, 4], v: [2, 4, 6, 4], scores: [2, 4, 6, 6], weights: [2, 4, 6, 6] } },
    { line: 7, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 4, 6, 4], k: [2, 4, 6, 4], v: [2, 4, 6, 4], scores: [2, 4, 6, 6], weights: [2, 4, 6, 6], mixed: [2, 6, 16] } },
    { line: 8, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 4, 6, 4], k: [2, 4, 6, 4], v: [2, 4, 6, 4], scores: [2, 4, 6, 6], weights: [2, 4, 6, 6], mixed: [2, 6, 16] } },
    { line: 9, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 4, 6, 4], k: [2, 4, 6, 4], v: [2, 4, 6, 4], scores: [2, 4, 6, 6], weights: [2, 4, 6, 6], mixed: [2, 6, 16], wide: [2, 6, 64] } },
    { line: 10, ev: "line", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 4, 6, 4], k: [2, 4, 6, 4], v: [2, 4, 6, 4], scores: [2, 4, 6, 6], weights: [2, 4, 6, 6], mixed: [2, 6, 16], wide: [2, 6, 64] } },
    { line: 10, ev: "return", vars: { notes: [2, 6, 16], qkv: [2, 6, 48], q: [2, 4, 6, 4], k: [2, 4, 6, 4], v: [2, 4, 6, 4], scores: [2, 4, 6, 6], weights: [2, 4, 6, 6], mixed: [2, 6, 16], wide: [2, 6, 64] } }
  ];
  // trace_block.out.txt: note 2, word 2 ("crack") given a different vector; 1 = that output row changed
  const CHANGED = {
    attention: [[0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]],
    ffn: [[0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0]]
  };
  const CHANGED_WORD = [1, 1]; // [note index, word index]
  // trace_block.out.txt: parameters per layer
  const PARAMS = { qkv: 816, proj: 272, norm1: 32, up: 1088, down: 1040, norm2: 32 };
  // broken.out.txt (whole output, not altered)
  const BROKEN_LOG = [
    ["input", "notes", [2, 6, 16]],
    ["qkv", "Linear(in_features=16, out_features=48, bias=True)", [2, 6, 48]],
    ["proj", "Linear(in_features=16, out_features=16, bias=True)", [2, 6, 16]],
    ["norm1", "LayerNorm((16,), eps=1e-05, elementwise_affine=True, bias=True)", [2, 6, 16]],
    ["up", "Linear(in_features=16, out_features=64, bias=True)", [2, 6, 64]],
    ["down", "Linear(in_features=64, out_features=64, bias=True)", [2, 6, 64]]
  ];
  const BROKEN_AT = "notes = blk.norm2(notes + blk.down(wide))";
  const BROKEN_ERR = "RuntimeError: The size of tensor a (16) must match the size of tensor b (64) at non-singleton dimension 2";
  // library.out.txt
  const LIB = { params: 3280, oursParams: 3280, outShape: [2, 6, 16], diffTrue: "2.4e-07", diffFalse: "0.68", normFirst: "False" };
  const LIB_CODE = [
    "layer = nn.TransformerEncoderLayer(",
    "    d_model=16, nhead=4, dim_feedforward=64,",
    "    dropout=0.0, batch_first=True)",
    "# copy blk's weights into layer, then:",
    "out = layer.eval()(notes)"
  ];

  /* ---------- Derived from the data ---------- */
  const at = n => TRACE.find(s => s.line === n).vars; // locals when line n is about to run = after line n-1
  const S_IN = at(1).notes, S_QKV = at(2).qkv, S_Q = at(3).q, S_QH = at(4).q, S_SC = at(5).scores, S_W = at(6).weights,
    S_MIX = at(7).mixed, S_WIDE = at(9).wide, S_OUT = TRACE[TRACE.length - 1].vars.notes;
  const DH = S_QH[3];
  const P_TOTAL = Object.values(PARAMS).reduce((a, b) => a + b, 0);
  const P_FFN = PARAMS.up + PARAMS.down;
  const FFN_PCT = Math.round(P_FFN / P_TOTAL * 100);
  const count = rows => rows.map(r => r.reduce((a, b) => a + b, 0));
  const ATT_N = count(CHANGED.attention), FFN_N = count(CHANGED.ffn);
  const WORD = NOTES[CHANGED_WORD[0]][CHANGED_WORD[1]];
  const STACK = 6; // the team's plan (the original paper's encoder also stacked 6)
  const LONG = 600, GROW = LONG / S_IN[1];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-steps { margin: 16px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-steps li { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-steps li.lx-${ID}-now { border-left: 3px solid var(--ink); padding-left: 10px; }
      .lx-${ID}-steps li.lx-${ID}-later { color: var(--faint); }
      .lx-${ID}-steps li > b { font: 600 14.5px var(--mono); white-space: nowrap; }
      .lx-${ID}-code .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(14px + 6ch); text-indent: -6ch; }
      .lx-${ID}-mono { font: 500 14px/1.5 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-log { margin: 16px 0 0; display: grid; gap: 6px; }
      .lx-${ID}-log button, .lx-${ID}-log div { display: grid; grid-template-columns: 4.2em 1fr; gap: 2px 10px; align-items: start; text-align: left; width: 100%; min-height: 44px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r, 6px); background: var(--surface); color: var(--ink); font: 500 13.5px/1.45 var(--mono); cursor: pointer; }
      .lx-${ID}-log div { cursor: default; background: var(--sunk); }
      .lx-${ID}-log .lx-${ID}-name { font-weight: 700; }
      .lx-${ID}-log .lx-${ID}-shape { grid-column: 2; font-weight: 700; }
      .lx-${ID}-log span { overflow-wrap: anywhere; min-width: 0; }
      .lx-${ID}-log button.lx-${ID}-no { border-color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-log button.lx-${ID}-ok { border-color: var(--good); background: var(--good-soft); }
      .lx-${ID}-log button:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
      .lx-${ID}-check { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-check li { border-bottom: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; font-size: 15.5px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-check label span { padding-top: 10px; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .lx-${ID}-check input:checked { background-color: var(--good); outline-color: var(--good); }
      .lx-${ID}-check input:focus-visible { outline-width: 3px; }
    `;
    document.head.appendChild(s);
  }
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }
  const mono = (kit, s) => `<span class="lx-${ID}-mono">${kit.esc(s)}</span>`;

  /* A screen of shape predictions, one layer at a time. Q: [{ what, opts: [shape...], right: shape, fb: [html per opt] }] */
  function shapeQuiz(el, done, kit, { title, lead, Q, end }) {
    ensureStyle();
    let k = 0, picked = null;
    const paint = () => {
      const fin = k >= Q.length;
      const rows = Q.map((q, i) => `<li class="${i === k ? `lx-${ID}-now` : i > k ? `lx-${ID}-later` : ""}"><span>${q.what}</span><b>${i < k ? kit.esc(sh(q.right)) : i === k ? "?" : ""}</b></li>`).join("");
      const q = Q[k];
      const opts = fin ? [] : q.opts.map(sh);
      const right = fin ? -1 : q.opts.findIndex(o => sh(o) === sh(q.right));
      el.innerHTML = `<h1>${title}</h1>${lead}
        <ul class="lx-${ID}-steps">${rows}</ul>
        ${fin ? "" : `<p class="task">What shape comes out of step ${k + 1}?</p>`}
        <div class="lpanel">${fin ? kit.feedback(end, true) : `${kit.options(opts.map(o => mono(kit, o)), { picked, correct: right })}${picked != null ? kit.feedback(q.fb[picked], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== right) { picked = i; paint(); return; }
        picked = null; k++; paint();
        if (k >= Q.length) done();
      });
    };
    paint();
  }

  /* 1. The situation, and shapes through the attention half. */
  function attentionShapes({ el, done, kit }) {
    shapeQuiz(el, done, kit, {
      title: "Get one block to run",
      lead: `<p class="lead">A building-inspection firm wants a model that tags inspectors' notes (“structural”, “corrosion”, “water”…). The engineer who started it left. The team inherits a half-written PyTorch file, and it crashes inside the first <b>transformer block</b>. Every transformer, from a tagger to a chat model, is a stack of these blocks. Before anything else, one block has to run.</p>
        <p class="lead">You track tensor shapes, as the team does: a shape that does not fit is what crashes the file. The input is ${NOTES.length} notes of ${S_IN[1]} words, each word a vector of ${D_MODEL} numbers: shape <code>${sh(S_IN)}</code> = (notes, words, numbers per word). Note 2 is “${kit.esc(NOTES[1].join(" "))}”. The block has ${HEADS} attention heads.</p>`,
      Q: [
        { what: `A <code>Linear(${D_MODEL}, ${3 * D_MODEL})</code> makes query, key and value for every word in one go`, right: S_QKV,
          opts: [[2, 6, 16], S_QKV, [2, 48, 16], [6, 48]],
          fb: ["A <code>Linear</code> changes only the last size: it maps 16 numbers per word to 48. Notes and words pass through untouched.", null,
            "A <code>Linear</code> works on the last dimension only. The 6 words stay in the middle; the 16 numbers per word become 48.",
            "The notes dimension does not disappear. A layer works on each note and each word separately; only the last size changes."] },
        { what: "Cut those numbers into three equal parts: <code>q</code>, <code>k</code>, <code>v</code>", right: S_Q,
          opts: [S_QKV, [2, 6, 3], S_Q, [2, 2, 16]],
          fb: ["That is the shape before the cut. Each of q, k and v gets one third of the last dimension.",
            "Cutting into three parts does not make the last size 3. It makes three tensors, each with 48 ÷ 3 numbers per word.", null,
            "Notes and words do not change when you cut along the last dimension. Each of q, k, v has 48 ÷ 3 numbers per word."] },
        { what: `Split <code>q</code> into ${HEADS} heads and move the heads in front of the words`, right: S_QH,
          opts: [[2, 6, 4, 4], S_QH, [2, 4, 6, 16], [8, 6, 4]],
          fb: [`That is the shape after the split but before the move. The heads go in front of the words so that each head works on all ${S_IN[1]} words at once, as in the self-attention lesson.`, null,
            `Each head gets a slice of the ${D_MODEL} numbers, not all of them: ${D_MODEL} ÷ ${HEADS} per head.`,
            "The notes and heads are kept as separate dimensions; merging them would lose which note a head belongs to."] },
        { what: "Scores: every word's query against every word's key, in each head", right: S_SC,
          opts: [[2, 4, 4, 4], S_SC, [2, 4, 6, 4], [2, 6, 6]],
          fb: [`The scores compare words with words, not numbers with numbers. ${DH} numbers per head are summed away in each dot product.`, null,
            `That is the shape of q itself. q times k-transposed gives one score for each pair of words: words by words.`,
            "Each head makes its own score grid, so the heads dimension stays."] }
      ],
      end: `Right. The scores are <code>${sh(S_SC)}</code>: for each note and each head, a ${S_SC[2]} by ${S_SC[3]} grid, one score per pair of words. Softmax turns each row into weights, and the weights mix the value vectors.`
    });
  }

  /* 2. Shapes through the rest of the block. */
  function restShapes({ el, done, kit }) {
    shapeQuiz(el, done, kit, {
      title: "Back to where you started",
      lead: `<p class="lead">The scores are <code>${sh(S_SC)}</code>. Now the rest of the block. Two new pieces: a <b>residual add</b> (add the layer's input back to its output) and a <b>layer norm</b> (rescale each word's numbers, as in the normalization lesson). Then a <b>feed-forward layer</b>: two <code>Linear</code> layers with a ReLU between, applied to each word.</p>`,
      Q: [
        { what: "Softmax over each row of scores", right: S_W,
          opts: [S_W, [2, 4, 6], [2, 4, 6, 4], [2, 6, 16]],
          fb: [null, "Softmax does not sum anything away. It turns each row into weights that add up to 1, and keeps every one of them.",
            "Softmax does not change shape: it turns scores into weights, one weight per pair of words.",
            "Softmax does not change shape. Merging the heads comes later."] },
        { what: "Weights times v, then merge the heads back together", right: S_MIX,
          opts: [[2, 4, 6, 4], [2, 4, 6, 6], S_MIX, [2, 6, 64]],
          fb: ["That is weights @ v before the merge. Merging puts the 4 heads' numbers side by side again for each word.",
            "That is the weights' shape. Multiplying by v gives each word a blend of the value vectors.", null,
            "Nothing here has 64. Merging gives back 4 heads × 4 numbers per word."] },
        { what: `<code>Linear(${D_MODEL}, ${D_MODEL})</code>, add the block's input, layer norm`, right: S_IN,
          opts: [S_IN, [2, 6, 32], [2, 4, 6, 4], [2, 6, 1]],
          fb: [null, "Adding is not joining. The input and the attention output are added number by number, so both must be 16 wide, and the sum is 16 wide too.",
            "The heads were merged a step ago.", "Layer norm does not squash a word to one number. It rescales the 16 numbers and keeps all of them."] },
        { what: `Feed-forward, first half: <code>Linear(${D_MODEL}, ${D_FF})</code> and ReLU`, right: S_WIDE,
          opts: [S_IN, S_WIDE, [2, 64, 16], [2, 6, 6]],
          fb: [`The first <code>Linear</code> widens each word from ${D_MODEL} to ${D_FF} numbers. That is the point of it: more room to compute in.`, null,
            "A <code>Linear</code> changes only the last dimension. The words stay in the middle.", "The feed-forward layer does not compare words; it works on each word alone."] },
        { what: `Feed-forward, second half: <code>Linear(${D_FF}, ${D_MODEL})</code>, add, layer norm`, right: S_OUT,
          opts: [S_WIDE, [2, 6, 80], S_OUT, [2, 1, 16]],
          fb: [`The second <code>Linear</code> brings each word from ${D_FF} back to ${D_MODEL}. Without that, the add would fail.`,
            "Adding is not joining: 16 + 64 numbers side by side would be concatenation. The add needs both sides 16 wide.", null,
            "Nothing merges the words. Each of the 6 words keeps its own row all the way through."] }
      ],
      end: `Right. The block took <code>${sh(S_IN)}</code> and handed back <code>${sh(S_OUT)}</code>: the same shape. Inside, it widened to ${S_QKV[2]} and ${S_WIDE[2]}, split into heads and made a words-by-words grid, but every path came back to ${D_MODEL} before an add.`
    });
  }

  /* 3. Spot the idea: why the shape must come back. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `Every layer inside the block must keep ${D_MODEL} numbers per word`,
      `The words must shrink in each block, so the last block gives one vector per note`,
      `Its output must have its input's shape, because each part's output is added to that part's input`,
      `Each block needs a bigger layer norm than the one before`
    ];
    const fb = [
      [`You just saw ${S_QKV[2]} and ${S_WIDE[2]} numbers per word inside the block, and it ran. Inside a part the size is free; only what gets added back must match.`, false],
      [`Attention keeps one row per word: the output still had ${S_OUT[1]} words. A tagger turns the words into one vector per note after the last block (for example by averaging), not inside each block.`, false],
      [`Right. The block is two <b>sublayers</b>, each wrapped the same way: <code>norm(x + sublayer(x))</code>. This add is also called a <b>residual connection</b>. It only works if the sublayer hands back x's shape. So the whole block maps <code>(notes, words, ${D_MODEL})</code> to the same shape, and the next block can take it. The original transformer paper stacked 6 such blocks in its encoder and kept every sublayer's output at the model's width “to facilitate these residual connections”. The add also gives the signal (and, in training, the gradient) a straight path past each sublayer.`, true],
      ["Layer norm has the same size in every block: it rescales the numbers of one word, and that count does not change from block to block.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why it must come back</h1>
        <p class="lead">The team's plan says: stack ${STACK} of these blocks, then a small tagging layer on top. Inside one block the shapes went to ${S_QKV[2]}, to four dimensions, to ${S_WIDE[2]}, and back.</p>
        <p class="task">What must every block obey so that ${STACK} of them can be stacked?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 4. Predict: change one word. Which rows change after each sublayer? */
  function whoSeesWhom({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const Q = [
      { q: `After the <b>attention</b> sublayer, how many of note 2's ${S_IN[1]} output rows change?`, right: ATT_N[1],
        opts: [1, 2, S_IN[1]].concat(ATT_N[1] === S_IN[1] ? [] : [ATT_N[1]]),
        say: v => v === 1 ? `Attention mixes words: every word's output is a weighted blend of all the words' values in its note. “${kit.esc(WORD)}” is in every blend.` : `“${kit.esc(WORD)}” is part of every word's blend, not only its neighbours'. Attention looks at the whole note, no matter how far apart the words are.` },
      { q: `Now the team feeds the old and the changed note straight into the <b>feed-forward</b> sublayer, with no attention before it. How many of note 2's rows change?`, right: FFN_N[1],
        opts: [FFN_N[1], 2, S_IN[1]],
        say: v => `The feed-forward layer runs on each word's row by itself, with the same weights for every word. Only the row whose input changed can change.` },
      { q: `After the <b>attention</b> sublayer, how many of note 1's rows change?`, right: ATT_N[0],
        opts: [ATT_N[0], 1, S_IN[1]],
        say: v => `Attention mixes words inside one note. The scores grid is per note: <code>${sh(S_SC)}</code> has a separate ${S_SC[2]} by ${S_SC[3]} grid for each note. Note 1 never sees note 2.` }
    ];
    Q.forEach(q => { q.opts = [...new Set(q.opts)].sort((a, b) => a - b); });
    const paint = () => {
      const fin = k >= Q.length;
      const doneRows = Q.slice(0, k).map(q => `<li><span>${q.q}</span><b>${q.right}</b></li>`).join("");
      el.innerHTML = `<h1>Who looks at whom</h1>
        <p class="lead">In the run, the team changed one thing: the vector of “${kit.esc(WORD)}” in note 2. Then they compared the old and new outputs row by row. Each row is one word.</p>
        <ul class="lx-${ID}-steps">${doneRows}</ul>
        ${fin ? "" : `<p class="task">${Q[k].q}</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Right: ${ATT_N[1]}, ${FFN_N[1]} and ${ATT_N[0]}, as in the run. That is the division of labour. <b>Attention</b> moves information between the words of a note. The <b>feed-forward</b> layer then works on each word alone, with what attention brought in. The notes in a batch never mix. Keep that last fact: later in this lesson a library setting quietly breaks it.`, true)
          : `${kit.options(Q[k].opts.map(String), { picked: wrong == null ? null : Q[k].opts.indexOf(wrong), correct: Q[k].opts.indexOf(Q[k].right), num: true })}${wrong != null ? kit.feedback(Q[k].say(wrong), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = Q[k].opts[+b.dataset.i];
        if (v !== Q[k].right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= Q.length) done();
      });
    };
    paint();
  }

  /* 5. The block as Python: a stepped replay of the traced run. */
  const FR = (() => {
    const fr = [];
    for (let i = 1; i < TRACE.length; i++) {
      const prev = TRACE[i - 1], cur = TRACE[i];
      if (cur.ev === "return") { fr.push({ ln: 10, vars: cur.vars, set: ["notes"], end: true }); continue; }
      const set = Object.keys(cur.vars).filter(n => !prev.vars[n] || sh(prev.vars[n]) !== sh(cur.vars[n]));
      fr.push({ ln: prev.line, vars: cur.vars, set: set.length ? set : prev.line === 7 || prev.line === 9 ? ["notes"] : [] });
    }
    return fr;
  })();
  const SAY = {
    1: "One <code>Linear</code> makes q, k and v for every word at once.",
    2: "<code>chunk</code> cuts the last dimension into three equal parts.",
    3: "<code>split_heads</code> reshapes each to heads and moves the heads in front of the words.",
    4: `Every query against every key, divided by the square root of ${DH}, the numbers per head.`,
    5: "Softmax turns each row of scores into weights that add up to 1.",
    6: "Each word gets a weighted blend of the values; <code>merge_heads</code> puts the heads side by side again.",
    7: "Sublayer 1 ends: the <code>proj</code> Linear, <b>add the input back</b>, layer norm. Same shape as the input, so the add worked.",
    8: `Sublayer 2 starts: widen each word to ${D_FF} numbers, then ReLU.`,
    9: `Back down to ${D_MODEL}, <b>add</b>, layer norm. The add worked because <code>down</code> returned ${D_MODEL} per word.`
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const opts = ["Line 1: <code>blk.qkv(notes)</code>", "Line 8: <code>blk.up(notes).relu()</code>", "Line 9: <code>blk.down(wide)</code>", "Line 4: the scores"];
    const fb = [
      [`That one makes ${S_QKV[2]} per word: q, k and v stacked. Look for the layer that widens one word's numbers to ${D_FF}.`, false], null,
      [`<code>down</code> takes ${D_FF} numbers per word and gives back ${D_MODEL}. It reads the wide tensor, it does not make it.`, false],
      [`The scores' last dimension is the number of words, ${S_SC[3]}. Nothing about them is ${D_FF}.`, false]
    ];
    const paint = () => {
      const f = FR[i], open = ans === 1;
      el.innerHTML = `<h1>The block in PyTorch</h1>
        <p class="lead">This is the team's block once it runs, written from PyTorch pieces: <code>Linear</code> layers, matrix products, softmax and <code>LayerNorm</code>. The run below is real: each step shows the shapes PyTorch printed at that line.</p>
        <div class="lx-${ID}-code">${kit.code(CODE, open ? f.ln : -1)}</div>
        ${open ? `<div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${(f.set.length ? f.set : ["notes"]).filter((n, j, a) => a.indexOf(n) === j).slice(0, 3).map(n => `<span>${n} <b>${kit.esc(sh(f.vars[n]))}</b></span>`).join("")}<span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(f.end ? `Line 10 returns <code>${sh(f.vars.notes)}</code>, the input's shape. ${CODE.length - 1} lines are the whole block.` : `Line ${f.ln}. ${SAY[f.ln]}`)}`
        : `<p class="task">Before you step: which line makes a tensor with ${D_FF} numbers per word?</p><div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); });
      const p = el.querySelector("[data-prev]"), n = el.querySelector("[data-next]");
      if (p) p.onclick = () => { i--; paint(); };
      if (n) n.onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. Broken on purpose: the inherited file's shape log and its error. */
  function broken({ el, done, kit }) {
    ensureStyle();
    const RIGHT_ROW = BROKEN_LOG.findIndex(r => r[0] === "down");
    let row = null, found = false, fix = null;
    const rowFb = {
      0: "The input is the shape you planned: 2 notes, 6 words, 16 numbers each.",
      1: "48 is q, k and v stacked, 16 each. That is planned.",
      2: "Back to 16 after attention. Fine.",
      3: "Layer norm keeps the shape. Fine.",
      4: `The widening to ${D_FF} is planned: the first half of the feed-forward layer.`,
      err: "That is where it crashed: the add on line 9. It is the symptom. The shape went wrong in a layer that ran before it."
    };
    const fixOpts = [
      `<code>self.down = nn.Linear(${D_FF}, ${D_MODEL})</code>`,
      `<code>self.norm2 = nn.LayerNorm(${D_FF})</code>`,
      `<code>self.up = nn.Linear(${D_MODEL}, ${D_MODEL})</code>`,
      `Add <code>.view(2, 6, ${D_MODEL})</code> after <code>down</code>`
    ];
    const fixFb = [
      [`Right. With <code>Linear(${D_FF}, ${D_MODEL})</code> the block is the one you stepped through, and the same run returns <code>${sh(S_OUT)}</code>. The habit: when an add fails, find the first layer whose output did not come back to the model's width (here ${D_MODEL} numbers per word).`, true],
      [`The crash is the add, which happens before <code>norm2</code>. And even a block that ran would hand ${D_FF} numbers per word to the next block, which expects ${D_MODEL}.`, false],
      [`<code>down</code> is still <code>Linear(${D_FF}, ${D_FF})</code> and would now get ${D_MODEL} numbers per word: a new error, inside <code>down</code> itself. And the feed-forward layer would lose its wider middle.`, false],
      [`A view cannot drop numbers: ${prod([2, 6, D_FF])} numbers do not fit in ${prod([2, 6, D_MODEL])}. It fails, and any reshape that “fits” would mix words together.`, false]
    ];
    const paint = () => {
      const logRows = BROKEN_LOG.map(([n, m, s], j) => {
        const st = row === j ? (j === RIGHT_ROW ? ` lx-${ID}-ok` : ` lx-${ID}-no`) : found && j === RIGHT_ROW ? ` lx-${ID}-ok` : "";
        return `<button type="button" data-i="${j}" class="${st.trim()}"${j === RIGHT_ROW ? " data-right" : j === 0 ? " data-wrong" : ""} aria-label="${kit.esc(`${n}: output ${sh(s)}`)}"><span class="lx-${ID}-name">${kit.esc(n)}</span><span>${kit.esc(m)}</span><span class="lx-${ID}-shape">${j === 0 ? "->  " : "->  output "}${kit.esc(sh(s))}</span></button>`;
      }).join("") + `<button type="button" data-i="err" class="${row === "err" ? `lx-${ID}-no` : ""}"><span class="lx-${ID}-name">error</span><span>in block_forward, line: ${kit.esc(BROKEN_AT)}</span><span class="lx-${ID}-shape">${kit.esc(BROKEN_ERR)}</span></button>`;
      el.innerHTML = `<h1>The inherited file crashes</h1>
        <p class="lead">This is the half-written file's block. The team made every layer print its output shape as it runs (PyTorch calls this a hook). The real log and error:</p>
        <div class="lx-${ID}-log" id="lg">${logRows}</div>
        <p class="lx-${ID}-cap">Real output, one row per printed line: docs/ai-path/runs/${ID}/broken.out.txt</p>
        ${found ? `${kit.feedback(`Right: <code>down</code> should bring each word back to ${D_MODEL} numbers, and it handed back ${D_FF}. The error only appears one step later, at the add.`, true)}<p class="task">Which change to <code>__init__</code> fixes it?</p><div class="lpanel" id="fx">${ask(kit, fixOpts, 0, fix, fixFb)}</div>`
          : `<p class="task">Tap the first row whose shape is not what you predicted on screens 1 and 2.</p><div class="lpanel">${row == null ? "" : kit.feedback(rowFb[row], false)}</div>`}`;
      if (!found) el.querySelectorAll("#lg button").forEach(b => b.onclick = () => {
        const v = b.dataset.i === "err" ? "err" : +b.dataset.i;
        if (v === RIGHT_ROW) { found = true; row = v; } else row = v;
        paint();
      });
      el.querySelectorAll("#fx .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 7. The library layer: same block? */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Exactly 0", `Tiny, around ${LIB.diffTrue}`, "Around 0.5: the library does different math", "It errors: the weights do not fit"];
    const fb = [
      ["Two programs that add up the same numbers in a different order round differently in the last digits of a float. Expect tiny, not zero.", false],
      [`Right: the largest difference was ${LIB.diffTrue}, float rounding. Both have ${LIB.params.toLocaleString("en")} parameters. Your ${CODE.length - 1} lines and the library layer are the same block. Both are post-norm: layer norm comes after each add (<code>norm_first=${LIB.normFirst}</code>; <code>True</code> moves it before). Both use ReLU in the feed-forward layer. So in real code, use the library layer, and keep your own version for when you need to see inside.`, true],
      ["Same weights, same math: attention, add, layer norm, feed-forward, add, layer norm. The library is not doing something else.", false],
      [`The library keeps q, k and v in one ${3 * D_MODEL}-by-${D_MODEL} weight, like your <code>qkv</code>, so every weight had a matching place. Both have ${LIB.params.toLocaleString("en")} parameters.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same block from the library</h1>
        <p class="lead">PyTorch ships this block as <code>nn.TransformerEncoderLayer</code>. The parameters that matter: <code>d_model</code> (numbers per word), <code>nhead</code> (heads; each head gets <code>d_model</code> ÷ <code>nhead</code> numbers), <code>dim_feedforward</code> (the wide middle; default 2048), <code>dropout</code> (default 0.1, set to 0 here to compare), <code>batch_first</code> and <code>norm_first</code> (both come up below).</p>
        <div class="lx-${ID}-code">${kit.code(LIB_CODE, -1)}</div>
        <p class="lead">The team copied the weights of their block into the layer and ran both on the same notes. Output shape: <code>${sh(LIB.outShape)}</code>.</p>
        <p class="task">How large is the largest difference between the two outputs?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. Broken quietly: batch_first left at its default. */
  function batchFirst({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["It raises a shape error", `It runs, output ${sh(LIB.outShape)}, and the output is the same`, `It runs, output ${sh(LIB.outShape)}, but the output is different`, "It prints a warning and fixes the order itself"];
    const fb = [
      [`The layer cannot tell. <code>${sh(S_IN)}</code> is a valid (words, notes, numbers) tensor too: 2 words, 6 notes. No size clashes, so nothing fails.`, false],
      ["The layer now reads the first dimension as the words. Different words attend to each other, so the numbers cannot stay the same.", false],
      [`Right. The run gave shape <code>${sh(LIB.outShape)}</code> and a largest difference of ${LIB.diffFalse} from the right answer. It took the ${S_IN[0]} notes as ${S_IN[0]} “words” and the ${S_IN[1]} words as ${S_IN[1]} separate examples: word 1 of note 1 attended to word 1 of note 2. The notes mixed, which you saw must never happen. Shapes are fine, training runs, the tagger is just bad. Test for it: change one note and check that the other note's output does not move.`, true],
      ["It does not warn. The docs describe the default layout as (seq, batch, feature); the layer has no way to know your tensor means something else.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The quiet bug</h1>
        <p class="lead">A teammate copies the layer from an old example and leaves out <code>batch_first=True</code>. The default is <code>batch_first=False</code>: the layer then reads a tensor as (words, notes, numbers), words first. Same weights, same <code>${sh(S_IN)}</code> notes.</p>
        <div class="lx-${ID}-code">${kit.code(["layer = nn.TransformerEncoderLayer(", "    d_model=16, nhead=4, dim_feedforward=64,", "    dropout=0.0)"], 2)}</div>
        <p class="task">What happens?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const grow = s => s.map((v, j) => (v === S_IN[1] ? LONG : v));
    const cand = [["qkv", S_QKV], ["wide", S_WIDE], ["scores", S_SC]];
    const factor = s => prod(grow(s)) / prod(s);
    const opts = [...cand.map(([n, s]) => `<code>${n}</code> ${mono(kit, sh(s))}`), `the block's ${P_TOTAL.toLocaleString("en")} parameters`];
    const RIGHT = 2;
    const fb = [
      [`<code>qkv</code> has one row per word, so it grows with the words: ${factor(S_QKV)} times bigger. Something else grows much faster.`, false],
      [`<code>wide</code> is the biggest tensor now, but it has one row per word: ${factor(S_WIDE)} times bigger. Something has the words in two places.`, false],
      [`Right. The scores have the words twice, words by words, so they grow ${factor(S_SC).toLocaleString("en")} times when the words grow ${GROW} times. That is why long inputs are the expensive case for attention.`, true],
      ["The weights do not depend on how many words come in: the same Linear layers run on every word. Long notes cost memory and time, not parameters.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to write a block yourself</h1>
        <p class="lead"><b>What it is:</b> the repeated unit of every transformer, in taggers and in chat models.</p>
        <p class="lead"><b>Write it yourself</b> to learn it, to debug shapes, or to test a change. <b>In real work</b> use <code>nn.TransformerEncoderLayer</code>, or, much more often, a pretrained model whose blocks are already trained.</p>
        <p class="lead"><b>Not</b> for a few hundred labelled notes. New blocks start from random weights and need a lot of text before they know any language. Use TF-IDF with logistic regression, or fine-tune a pretrained model.</p>
        <p class="lead"><b>Costs:</b> the feed-forward layers hold most weights (${FFN_PCT}% here); attention's cost grows fastest with length.</p>
        <p class="task">Inspectors start pasting whole reports: ${LONG} words instead of ${S_IN[1]}. Which grows the most in size?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A clinic has 250 labelled patient-feedback messages and wants them sorted into 4 topics by Friday. Should they train a stack of new transformer blocks for it?", false,
      "No. New blocks start from random weights and must learn language before they can sort anything; 250 messages are far too few. TF-IDF with logistic regression, or a pretrained model fine-tuned on the 250, does it.",
      "Training blocks from scratch means teaching them language from nothing, and 250 messages cannot do that. The block is the right part, but someone else must have trained it: start from a pretrained model, or use TF-IDF and logistic regression."],
    ["A wind-farm model reads a turbine's last 300 vibration readings, and a spike 200 readings back can matter for the next one. Is a stack of blocks a reasonable model?", true,
      "Yes. Attention lets every reading look at every other one directly, however far back. With 300 readings, the scores grid (every reading against every reading) stays small enough.",
      "The distance is exactly where attention helps: every position scores every other one in one step, so a spike 200 readings back is as close as the one before."],
    ["A form has a date field always written as YYYY-MM-DD. Should a block read it?", false,
      "No. A fixed format is a rule. Plain code splits it in one line, and is right every time; a block would need training data and could still be wrong.",
      "Nothing here needs words to look at other words or anything to be learned. The format is fixed, so a one-line parser is cheaper and always correct."],
    ["A team changed how attention works in its own block. With the change switched off, the block should compute the standard thing. Is comparing it with the library layer, using copied weights, the right test?", true,
      "Yes. That is what your from-scratch block is for: copy the weights into nn.TransformerEncoderLayer and compare outputs; a tiny difference means the math matches.",
      "Comparing against the library with copied weights is the cleanest test of custom block code. You did exactly that: a difference of float-rounding size means the same math."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Block or not?</h1>
        <p class="lead">Four requests from other teams.</p>
        <p class="task">Answer each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
      `The traced block prints <code>scores</code> as <code>${sh(S_SC)}</code>, <code>wide</code> as <code>${sh(S_WIDE)}</code>, and returns <code>${sh(S_OUT)}</code>.`,
      `Changing “${kit.esc(WORD)}” changes ${ATT_N[1]} of note 2's rows after attention, ${FFN_N[1]} after the feed-forward layer, and ${ATT_N[0]} of note 1's.`,
      `The broken block (<code>down = Linear(${D_FF}, ${D_FF})</code>) raises <code>${kit.esc(BROKEN_ERR.replace("RuntimeError: ", ""))}</code>; with <code>Linear(${D_FF}, ${D_MODEL})</code> it returns <code>${sh(S_OUT)}</code>.`,
      `Your block and <code>nn.TransformerEncoderLayer</code> both count ${LIB.params.toLocaleString("en")} parameters, and differ by about ${LIB.diffTrue} with <code>batch_first=True</code>, but by ${LIB.diffFalse} without it.`
    ];
    el.innerHTML = `<h1>You can build a block</h1>
      <p class="lead">You tracked the shapes through attention and the feed-forward layer, saw why every add needs the shape to come back, fixed a layer that did not, and matched your block against the library's, including the setting that breaks it quietly.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a>.` : "The notebook for this lesson is on its way."} In it you write the block, break it and fix it, and compare it with the library layer. What you should see (ticking is optional):</p>
      <ul class="lx-${ID}-check">${CHECK.map((t, i) => `<li><label><input type="checkbox" id="lx-${ID}-c${i}"><span>${t}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You stack these blocks, add the mask that hides later characters, and train the whole thing.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "A transformer block from scratch",
    checked: "2026-11-14",
    sources: [
      "https://arxiv.org/abs/1706.03762",
      "https://arxiv.org/abs/2002.04745",
      "https://arxiv.org/abs/1603.05027",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.TransformerEncoderLayer.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.MultiheadAttention.html"
    ],
    interview: [
      {
        q: "You inherit a transformer model that crashes with “The size of tensor a (512) must match the size of tensor b (2048)”. How do you find the bug?",
        good: [
          "The failing line is usually a residual add: that is where the mismatch shows, not where it starts",
          "Print or hook every layer's output shape and find the first one that does not return to the model width",
          "Every sublayer must hand back d_model numbers per word, because its output is added to its input",
          "2048 against 512 points at the feed-forward layer: its second Linear should map d_ff back to d_model",
          "After the fix, compare against nn.TransformerEncoderLayer with the same weights"
        ],
        weak: "Reshape or slice the tensor until the add works. That hides a wrong layer size and mixes numbers that belong to different words."
      },
      {
        q: "A tagger built on nn.TransformerEncoderLayer trains without errors but stays near chance. The shapes all look right. What do you check?",
        good: [
          "batch_first: the default reads (seq, batch, feature), so a (batch, seq, feature) tensor makes examples attend to each other",
          "Test it: change one example and check that the other examples' outputs do not move",
          "Check the mask and padding, and that dropout is off when comparing outputs",
          "Compare one batch against a small hand-written block with copied weights"
        ],
        weak: "Train longer or add more layers. A layout bug gives valid shapes, so more training only fits the wrong thing."
      }
    ],
    screens: [attentionShapes, restShapes, spotIdea, whoSeesWhom, asCode, broken, library, batchFirst, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(4).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: Array(5).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(3).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"].concat(Array(FR.length - 1).fill("[data-next]")) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "#fx [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
