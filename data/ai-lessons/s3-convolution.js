/* Lesson: convolutional networks in brief. Story: a glass factory line photographs every bottle neck and looks
   for cracks (a crack is a thin dark line in a bright neck). Ideas: (1) a filter is a small grid of weights
   slid over the photo; each output number is the sum of nine products, so the output map lights up where the
   pattern is; (2) a conv layer needs far fewer weights than a dense layer because each output looks only at a
   small patch and the same weights are reused at every position; training picks those weights.
   Data, all real (no model calls were recorded for this lesson):
   - docs/ai-path/runs/s3-convolution/neck_filter.py + neck_filter.out.txt: the 6x6 photo, the edge filter,
     outputs without and with padding, the moved crack, the horizontal filter, and the line trace of convolve();
   - docs/ai-path/runs/s3-convolution/count_weights.py + count_weights.out.txt: PyTorch parameter counts;
   - docs/ai-path/runs/s3-convolution/learn_filter.py + learn_filter.out.txt: one 3x3 filter trained on 300
     synthetic neck photos (seed 0).
   The lesson recomputes every output map from the photo and the filter, and refuses to load if the result
   differs from the run's printed output. Lesson-local style: a small caption (.lx-s3-convolution-cap) and, on the code screen
   (.lx-s3-convolution-step), the photo and output map side by side and a smaller code font at phone width.
   Plain browser script. */
(() => {
  const ID = "s3-convolution";

  /* ---------- Data copied from the runs ---------- */
  // neck_filter.py: brightness 0 (dark) to 9 (bright). The crack runs down column 3.
  const NECK = [
    [7, 8, 8, 2, 8, 7],
    [8, 8, 7, 2, 8, 8],
    [8, 7, 8, 2, 7, 8],
    [8, 8, 8, 3, 8, 8],
    [7, 8, 8, 2, 8, 8],
    [8, 8, 7, 2, 8, 7]
  ];
  const EDGE = [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]];
  const MOVED = [
    [7, 8, 8, 8, 2, 7],
    [8, 8, 7, 8, 2, 8],
    [8, 7, 8, 7, 2, 8],
    [8, 8, 8, 8, 3, 8],
    [7, 8, 8, 8, 2, 8],
    [8, 8, 7, 8, 2, 7]
  ];
  const FLAT = [[-1, -1, -1], [0, 0, 0], [1, 1, 1]];
  // neck_filter.out.txt, printed outputs
  const RUN_OUT = [[0, -17, 0, 17], [-1, -16, 0, 17], [1, -16, -1, 17], [0, -17, 1, 16]];
  const RUN_PAD = [[16, 0, -12, 1, 11, -16], [23, 0, -17, 0, 17, -23], [23, -1, -16, 0, 17, -23], [23, 1, -16, -1, 17, -23], [24, 0, -17, 1, 16, -24], [16, 0, -12, 1, 11, -16]];
  const RUN_MOVED = [[0, 0, -17, 0], [-1, 0, -16, 1], [1, 0, -17, 1], [0, 0, -16, -1]];
  const RUN_FLAT = [[0, -1, -1, 0], [1, 2, 2, 1], [0, 1, 1, 1], [-1, -2, -2, -2]];
  // neck_filter.out.txt, trace of convolve(neck, edge_filter): [r, c, out[r, c]] each time line 8 ran
  const TRACE = [[0,0,0],[0,1,-17],[0,2,0],[0,3,17],[1,0,-1],[1,1,-16],[1,2,0],[1,3,17],[2,0,1],[2,1,-16],[2,2,-1],[2,3,17],[3,0,0],[3,1,-17],[3,2,1],[3,3,16]];
  // count_weights.out.txt
  const PT = {
    dense: { shapes: [["weight", "(16, 36)"], ["bias", "(16,)"]], total: 592 },
    conv: { shapes: [["weight", "(1, 1, 3, 3)"], ["bias", "(1,)"]], total: 10 },
    bigConv: 10, bigDense: 4295032832, conv16: 160, big: 256
  };
  // learn_filter.out.txt (300 training photos, 100 validation photos, 200 epochs, Adam lr 0.05)
  const LEARN = {
    before: [[-0.0, 0.18, -0.27], [-0.25, -0.13, 0.09], [-0.01, 0.26, -0.03]],
    after: [[-3.95, 4.78, -4.77], [-4.1, 4.42, -4.02], [-3.9, 4.78, -4.49]],
    bias: 4.87, nTrain: 300, nVal: 100,
    log: [[1, "0.665", "0.50"], [50, "0.243", "1.00"], [100, "0.112", "1.00"], [200, "0.043", "1.00"]]
  };

  /* ---------- Computed by the lesson ---------- */
  const conv = (img, ker) => {
    const k = ker.length, H = img.length - k + 1, W = img[0].length - k + 1;
    return Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => {
      let s = 0;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) s += img[r + i][c + j] * ker[i][j];
      return s;
    }));
  };
  const pad1 = img => { const z = Array(img[0].length + 2).fill(0); return [z, ...img.map(r => [0, ...r, 0]), z.slice()]; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const OUT = conv(NECK, EDGE), PADDED = pad1(NECK), OUT_PAD = conv(PADDED, EDGE);
  const OUT_MOVED = conv(MOVED, EDGE), OUT_FLAT = conv(NECK, FLAT);
  if (!same(OUT, RUN_OUT) || !same(OUT_PAD, RUN_PAD) || !same(OUT_MOVED, RUN_MOVED) || !same(OUT_FLAT, RUN_FLAT) || !TRACE.every(([r, c, v]) => OUT[r][c] === v))
    throw new Error(ID + ": lesson arithmetic differs from the recorded run");
  const N = NECK.length, K = EDGE.length, OUT_N = OUT.length, PAD_N = PADDED.length;
  const N_IN = N * N, N_OUT = OUT_N * OUT_N, DENSE_W = N_IN * N_OUT, CONV_W = K * K;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const colSum = (img, r, c, j) => sum([0, 1, 2].map(i => img[r + i][c + j]));
  const patchSum = (img, r, c) => sum([0, 1, 2].map(i => colSum(img, r, c, i)));
  const CRACK_COL = NECK[0].indexOf(Math.min(...NECK[0]));
  const maxAbs = m => Math.max(...m.flat().map(Math.abs));
  const fmt = n => n.toLocaleString("en");

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `.lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
.lx-${ID}-step .lp-side { flex-wrap: nowrap; gap: 8px 16px; }
.lx-${ID}-step .lp-side > :first-child { flex: 6 1 0; }
.lx-${ID}-step .lp-side > :last-child { flex: 4 1 0; }
.lx-${ID}-step .lp-gc { font-size: 13px; }
@media (max-width: 480px) { .lx-${ID}-step .lcode { font-size: 12px; } }`;
    document.head.appendChild(s);
  }
  const cap = t => `<p class="lx-${ID}-cap">${t}</p>`;
  const win = (r, c, k = K) => { const o = {}; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) o[`${r + i},${c + j}`] = "accent"; return o; };
  const photo = (kit, img, title, cls = {}) => kit.pics.grid(img, { cls, title });
  const filt = (kit, ker, title) => kit.pics.grid(ker, { title });
  // an output map with only some cells known; known: (r, c) => bool
  const outMap = (kit, m, title, known = () => true, cls = {}) => kit.pics.grid(m.map((row, r) => row.map((v, c) => known(r, c) ? v : null)), { cls, title });

  /* Options for one output cell: the right sum plus the usual slips, each with its own feedback. */
  function cellChoices(img, r, c) {
    const L = colSum(img, r, c, 0), R = colSum(img, r, c, 2), v = R - L, all = patchSum(img, r, c);
    const cand = [
      [v, null],
      [-v, `${-v} has the sign flipped. The filter's left column is -1 and its right column is +1, so it is right minus left: ${R} − ${L} = ${v}.`],
      [all, `${all} is all nine pixels added. The filter's numbers weight them first: the left column times -1, the middle times 0, the right column times +1.`],
      [R, `${R} is only the right column. The left column is multiplied by -1, so its ${L} must be taken away: ${R} − ${L} = ${v}.`],
      [-L, `${-L} is only the left column times -1. The right column, times +1, adds ${R}: ${R} − ${L} = ${v}.`]
    ];
    const seen = new Set(), out = [];
    for (const x of cand) if (!seen.has(x[0]) && out.length < 4) { seen.add(x[0]); out.push(x); }
    out.sort((a, b) => a[0] - b[0]);
    return { v, L, R, opts: out, right: out.findIndex(x => x[1] === null) };
  }

  /* 1. The situation, and the first output number by hand. */
  function firstCell({ el, done, kit }) {
    ensureStyle();
    const r = 0, c = 1, ch = cellChoices(NECK, r, c);
    let ans = null;
    const paint = () => {
      const ok = ans === ch.right;
      el.innerHTML = `<h1>Find the crack in the numbers</h1>
        <p class="lead">A glass factory photographs the neck of every bottle on the line. A crack shows up as a thin dark line. The photo is a grid of numbers, one per pixel: brightness from 0 (dark) to 9 (bright). Here is a ${N} × ${N} crop. Glass is about 7 or 8; the crack runs down column ${CRACK_COL + 1}. This lesson shows how a model finds a pattern like this in a photo: with a <b>filter</b>, not a dense layer.</p>
        <p class="lead">A filter is a small grid of numbers. Put it on a 3 × 3 patch of the photo, multiply each pixel by the filter number on top of it, and add the nine products. That sum is one output number.</p>
        ${kit.pics.side(photo(kit, NECK, "neck photo (patch ringed)", win(r, c)), filt(kit, EDGE, "the filter"))}
        <p class="task">What number does the filter give for the ringed patch?</p>
        <div class="lpanel">${kit.options(ch.opts.map(o => String(o[0])), { picked: ans, correct: ch.right, num: true })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The left column adds up to ${ch.L} and is multiplied by -1; the middle column by 0; the right column adds up to ${ch.R} and is multiplied by +1: ${ch.R} − ${ch.L} = <b>${ch.v}</b>. A large negative number, because the patch is bright on the left and dark on the right. This filter measures <b>right minus left</b>: it answers “is there an edge running down here?”`, true)
          : kit.feedback(ch.opts[ans][1], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === ch.right) done(); });
    };
    paint();
  }

  /* 2. Slide the filter along the first row; then see the whole map. */
  function slideRow({ el, done, kit }) {
    ensureStyle();
    const order = [0, 2, 3]; // column (0,1) was done on screen 1
    let step = 0, ans = null;
    const known = (r, c) => r === 0 && (c === 1 || order.slice(0, step).includes(c));
    const paint = () => {
      const fin = step === order.length;
      const c = fin ? null : order[step], ch = fin ? null : cellChoices(NECK, 0, c);
      el.innerHTML = `<h1>Slide it along</h1>
        <p class="lead">The filter moves one column at a time, and each position gives one output number. You already have the second one.</p>
        ${fin ? "" : `<p class="task">The filter now sits on the ringed patch. What number comes out?</p>`}
        ${kit.pics.side(photo(kit, NECK, fin ? "neck photo" : "neck photo (patch ringed)", fin ? {} : win(0, c)), fin ? outMap(kit, OUT, "the whole output map") : outMap(kit, OUT, "output, first row", (r, cc) => r === 0 && known(r, cc), fin ? {} : { [`0,${c}`]: "accent" }))}
        <div class="lpanel">${fin
          ? kit.feedback(`Right, all of the first row. The other rows come from sliding the filter down too; this is the whole map from our run. On plain glass the sums stay near 0 (between ${Math.min(...OUT.flat().filter(v => Math.abs(v) < 5))} and ${Math.max(...OUT.flat().filter(v => Math.abs(v) < 5))}). Where the crack is, two columns of strong values appear: about ${Math.min(...OUT.flat())} where bright turns dark, about +${Math.max(...OUT.flat())} where dark turns bright again. The output map is a picture of <b>where the pattern is</b>. Sliding a filter over a grid like this is called a <b>convolution</b>.`, true)
          : `${kit.options(ch.opts.map(o => String(o[0])), { picked: ans, correct: ch.right, num: true })}${ans == null || ans === ch.right ? "" : kit.feedback(ch.opts[ans][1], false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === ch.right) { step++; ans = null; paint(); if (step === order.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 3. Output size, without and with padding, and what padding does at the border. */
  function sizes({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const sz = n => `${n} × ${n}`;
    const borderMax = Math.max(...OUT_PAD.map(r => Math.max(Math.abs(r[0]), Math.abs(r[r.length - 1])))), crackMax = maxAbs(OUT);
    const Q = [
      { task: `The photo is ${sz(N)} and the filter ${sz(K)}, with no border added. How big is the output map?`,
        opts: [N - K, N - K + 1, N - 1, N].map(sz), right: 1,
        fb: [`${sz(N - K)} is the photo minus the filter. Count the positions instead: the filter's left edge can sit on columns ${Array.from({ length: N - K + 1 }, (_, i) => i + 1).join(", ")} and still fit. That is ${N} − ${K} + 1.`, null,
          `The filter is ${K} wide, so it cannot start in the last ${K - 1} columns: it would hang off the edge. ${N} − ${K} + 1 = ${N - K + 1} positions.`,
          `Only if the filter could hang over the edge. Without a border it must fit inside, so it loses ${K - 1} positions per row: ${N - K + 1}.`] },
      { task: `The team wants the output the same size as the photo, so they can mark the crack on it. They add a border of zeros, 1 pixel wide, all round (this is called <b>padding</b>). How big is the output now?`,
        opts: [N - K + 1, N, PAD_N].map(sz), right: 1,
        fb: [`The padded photo is ${sz(PAD_N)} now, so the filter fits in more places: ${PAD_N} − ${K} + 1.`, null,
          `${sz(PAD_N)} is the padded photo. The filter still needs ${K} columns to sit on: ${PAD_N} − ${K} + 1 = ${N}.`] },
      { task: `Here is the output map of the padded photo, from our run. Apart from the crack, where are the strongest numbers?`,
        opts: ["Nowhere: the zeros add nothing to the sums", "In the first and last columns", "In the top and bottom rows"], right: 1,
        fb: [`The zeros themselves add nothing, but they sit next to bright glass. To the filter, zero next to 8 looks exactly like a dark crack next to glass. Look at the first and last columns.`, null,
          `The top and bottom rows are a little weaker (the zero rows take out some of the glass), but this filter only compares left with right. The strong values are at the left and right borders.`] }
    ];
    const paint = () => {
      const q = Q[phase], fin = phase === Q.length;
      const pic = phase === 0 ? photo(kit, NECK, "neck photo")
        : phase === 1 ? photo(kit, PADDED, `padded photo, ${sz(PAD_N)}`)
        : outMap(kit, OUT_PAD, `output with padding, ${sz(OUT_PAD.length)}`);
      el.innerHTML = `<h1>How big is the output?</h1>
        ${phase >= 1 ? `<p class="lead">Without a border: ${sz(N)} photo, ${sz(K)} filter, ${sz(OUT_N)} output. The filter only fits ${OUT_N} times across.</p>` : `<p class="lead">The output map in the last screen was smaller than the photo.</p>`}
        ${fin ? "" : `<p class="task">${q.task}</p>`}
        ${pic}
        <div class="lpanel">${fin
          ? kit.feedback(`Right. Zeros next to bright glass look like an edge, so the border lights up as strongly as the crack or more (up to ${borderMax}, the crack about ${crackMax}). Padding keeps the size (${N} + 2 × 1 − ${K} + 1 = ${N}) but adds fake edges at the border. Training has to learn that they are not cracks, so you should know they are there. The rule when the filter moves one pixel at a time: <b>output = input + 2 × padding − filter + 1</b>.`, true)
          : `${kit.options(q.opts, { picked: ans, correct: q.right, num: phase < 2 })}${ans == null || ans === q.right ? "" : kit.feedback(q.fb[ans], false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[phase].right) { phase++; ans = null; paint(); if (phase === Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 4. Count the weights: a dense layer against one filter. */
  function countWeights({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const vals = [N_OUT, N_IN, N_IN + N_OUT, DENSE_W], RIGHT = 3;
    const fb = [
      `${N_OUT} is one weight per output. But each output in a dense layer is connected to every pixel, and each connection has its own weight.`,
      `${N_IN} is one weight per pixel, enough for one output. There are ${N_OUT} outputs, each with its own ${N_IN}.`,
      `${N_IN + N_OUT} adds the inputs and outputs. Weights sit on the connections between them: every input to every output, ${N_IN} × ${N_OUT}.`,
      null
    ];
    const paint = () => {
      const ok = ans === RIGHT;
      el.innerHTML = `<h1>How many weights?</h1>
        <p class="lead">In the training-loop lesson the model was built from dense layers (<code>nn.Linear</code>): every input is connected to every output, and each connection has its own weight. The filter you used is also a set of weights: ${CONV_W} numbers, the same ones at every position.</p>
        <p class="task">A dense layer that turns the ${N_IN} pixels of the neck photo into ${N_OUT} outputs (the same size as the filter's output map): how many weights does it need, not counting the bias?</p>
        <div class="lpanel">${kit.options(vals.map(fmt), { picked: ans, correct: RIGHT, num: true })}
        ${ans == null ? "" : ok ? kit.feedback(`Right: ${N_IN} × ${N_OUT} = ${fmt(DENSE_W)}. PyTorch counts the same, plus one bias per output (its “parameters” are the weights plus the biases):`, true) : kit.feedback(fb[ans], false)}
        ${ok ? `${kit.table([["nn.Linear(36, 16)", PT.dense.shapes.map(s => s.join(" ")).join(", ") + " → " + fmt(PT.dense.total)], ["nn.Conv2d(1, 1, 3)", PT.conv.shapes.map(s => s.join(" ")).join(", ") + " → " + fmt(PT.conv.total)], [`Conv2d on a ${PT.big} × ${PT.big} crop`, fmt(PT.bigConv)], [`dense, ${PT.big} × ${PT.big} in and out`, fmt(PT.bigDense) + " (counted, not built)"]], { head: ["layer", "parameters"], title: "our run, count_weights.py" })}
          <p class="lead">On the small crop the conv layer has about ${Math.round(PT.dense.total / PT.conv.total)} times fewer weights. On a real ${PT.big} × ${PT.big} camera crop it still has ${PT.bigConv}; a dense layer of the same output size would need about ${Math.round(PT.bigDense / PT.bigConv / 1e6)} million times more.</p>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Spot the idea: why so few weights are enough. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The conv layer skips most pixels, so it needs fewer weights",
      "Each output only looks at a small patch, and the same weights are reused at every position, because a crack looks the same wherever it is",
      "Most of the dense layer's weights end up as 0 after training anyway",
      "This photo has one number per pixel; with colour photos a filter needs as many weights as a dense layer"
    ];
    const RIGHT = 1;
    const fb = [
      `Every pixel is read: as you slid the filter, most pixels were inside several patches (up to ${CONV_W}). Nothing is skipped; the same ${CONV_W} weights are just used again.`,
      null,
      `Nothing forces them to 0. The dense layer has a separate weight for every pixel and output, so it must learn the crack pattern separately for every place it can appear. That freedom is exactly what the ${fmt(DENSE_W)} weights pay for.`,
      `Colour means three numbers per pixel, so a 3 × 3 filter gets 3 × 3 × 3 = ${3 * CONV_W} weights. That still does not grow with the photo's size; a dense layer's count does.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why are ${CONV_W} weights enough?</h1>
        <p class="lead">One filter with ${CONV_W} weights found the crack in every row. A dense layer needs ${fmt(DENSE_W)} for the same output size.</p>
        <p class="task">What makes the difference?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}
        ${ans == null ? "" : ans === RIGHT ? kit.feedback(`Right. Two choices make a conv layer cheap. <b>Local connections</b>: each output looks at a ${K} × ${K} patch, not the whole photo, because a crack is a local pattern. <b>Shared weights</b>: the same filter is used at every position, so a pattern learned in one place is found everywhere. A network built from such layers is a <b>convolutional network</b> (convnet, CNN).`, true) : kit.feedback(fb[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Use it with predictions: a moved crack, and a filter for the other direction. */
  function predict({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const lo = Math.min(...OUT.flat()), hi = Math.max(...OUT.flat()), flatMax = maxAbs(OUT_FLAT);
    const colOf = (m, f) => m[0].findIndex(v => f(v)) + 1; // 1-based column for prose
    const Q = [
      { task: "A second bottle: the crack is one column further right. Without padding, what does the edge filter's output map show?",
        pics: () => kit.pics.side(photo(kit, MOVED, "second bottle"), filt(kit, EDGE, "edge filter")),
        opts: [`The same as before: strong values in columns ${colOf(OUT, v => v < -5)} and ${colOf(OUT, v => v > 5)}`, `Both strong columns move one to the right: columns ${colOf(OUT, v => v < -5) + 1} and ${colOf(OUT, v => v > 5) + 1}`, `The negative column moves to column ${colOf(OUT, v => v < -5) + 1}; the positive one is gone`, "Nothing strong: the filter only knows the old position"],
        right: 2,
        fb: [`The filter has no memory of positions. It gives a strong value wherever its patch holds an edge, so the values move with the crack.`,
          `The output map has only ${OUT_N} columns. Moving the positive column one to the right would put it in column ${OUT_N + 1}, which needs a patch that hangs off the photo. Without padding there is no such position.`, null,
          `The same ${CONV_W} weights are used at every position, so a moved crack gives the same numbers in a moved place. That is the point of sharing them.`] },
      { task: "Back to the first photo. This filter compares the bottom row of each patch with the top row. What comes out?",
        pics: () => kit.pics.side(photo(kit, NECK, "neck photo"), filt(kit, FLAT, "the other filter")),
        opts: [`Strong values at the crack, about ${hi}, like the edge filter`, `Only small values, none beyond ${flatMax} either way`, "Exactly 0 everywhere"],
        right: 1,
        fb: [`The crack runs from top to bottom, so the top and bottom rows of any patch look almost the same. This filter looks for edges that run <i>across</i>.`, null,
          `Close, but the pixels vary a little (7 or 8, 2 or 3), so top and bottom rows differ by small amounts. Small, not exactly 0.`] }
    ];
    const paint = () => {
      const fin = phase === Q.length, q = Q[phase];
      el.innerHTML = `<h1>Predict the output</h1>
        <p class="lead">So far the edge filter gave ${lo} and +${hi} beside the crack. Predict before you see the run.</p>
        ${fin ? "" : `<p class="task">${q.task}</p>${q.pics()}`}
        <div class="lpanel">${fin ? "" : `${kit.options(q.opts, { picked: ans, correct: q.right })}${ans == null || ans === q.right ? "" : kit.feedback(q.fb[ans], false)}`}
        ${phase >= 1 ? `${outMap(kit, OUT_MOVED, "second bottle, edge filter (our run)")}${phase === 1 ? kit.feedback(`Right. The ${lo} moved with the crack. The +${hi} would need a position past the edge, so without padding it is lost. A crack right at the border can be missed this way.`, true) : ""}` : ""}
        ${fin ? `${outMap(kit, OUT_FLAT, "first photo, the other filter (our run)")}${kit.feedback(`Right: nothing beyond ±${flatMax}. One filter finds one kind of pattern. A real conv layer has many filters side by side (PyTorch calls their number <code>out_channels</code>), each making its own output map, and the next layer combines those maps into bigger shapes.`, true)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[phase].right) { phase++; ans = null; paint(); if (phase === Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 7. The same thing in NumPy: a stepped replay of the traced run. */
  // The listing is convolve() from docs/ai-path/runs/s3-convolution/neck_filter.py, line for line (line 0 = def).
  const CODE = [
    "def convolve(photo, filt):",
    "    k = filt.shape[0]",
    "    out_h = photo.shape[0] - k + 1",
    "    out_w = photo.shape[1] - k + 1",
    "    out = np.zeros((out_h, out_w), int)",
    "    for r in range(out_h):",
    "        for c in range(out_w):",
    "            patch = photo[r:r + k, c:c + k]",
    "            out[r, c] = np.sum(patch * filt)",
    "    return out"
  ];
  const FR = [{ ln: 4, n: 0 }, ...TRACE.map((t, i) => ({ ln: 8, n: i + 1 })), { ln: 9, n: TRACE.length, end: true }];
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i], cur = f.ln === 8 ? TRACE[f.n - 1] : null;
      const filled = new Set(TRACE.slice(0, f.n).map(([r, c]) => `${r},${c}`));
      const say = f.end
        ? `The last line returns the ${OUT_N} × ${OUT_N} map, the same one you built by hand. Two loops, one patch, one sum of products per cell: that is all a convolution does. Real libraries run the same arithmetic in fast compiled code, for many filters at once. PyTorch's <code>nn.Conv2d</code> computes exactly this sum. Its documentation calls it cross-correlation, because the filter is not flipped first. Deep-learning code still says convolution.`
        : f.ln === 4 ? `The first lines set up: <code>k</code> is ${K}, the output is ${OUT_N} × ${OUT_N} (${N} − ${K} + 1), and <code>out</code> starts as zeros.`
        : `<code>patch</code> is the ${K} × ${K} slice starting at row ${cur[0]}, column ${cur[1]}. <code>patch * filt</code> multiplies them cell by cell; <code>np.sum</code> adds the nine products: <b>${cur[2]}</b>.`;
      el.innerHTML = `<h1>The same thing in NumPy</h1>
        <p class="lead">This is the function our run used (<code>filt</code> is the filter). <code>photo[r:r + k, c:c + k]</code> cuts out a patch, like a <code>slice</code> in JavaScript but in two directions at once.</p>
        <p class="task">Step through to the end and watch the map fill.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>r <b>${cur ? cur[0] : "–"}</b></span><span>c <b>${cur ? cur[1] : "–"}</b></span><span>out[r, c] <b>${cur ? cur[2] : "–"}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        <div class="lx-${ID}-step">${kit.pics.side(photo(kit, NECK, "photo", cur ? win(cur[0], cur[1]) : {}), kit.pics.grid(OUT.map((row, r) => row.map((v, c) => filled.has(`${r},${c}`) ? v : 0)), { title: "out", cls: Object.fromEntries(OUT.flatMap((row, r) => row.map((_, c) => [`${r},${c}`, cur && r === cur[0] && c === cur[1] ? "enter" : filled.has(`${r},${c}`) ? "" : "gone"]))) }))}</div>
        ${kit.feedback(say)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 8. Who picks the nine numbers: a filter found by training. */
  function learned({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Write a round 3 × 3 bubble filter by hand and add it",
      "Give the layer more filters and train on photos labelled with bubbles too",
      "Make the one filter as big as the photo, so it sees everything at once",
      "Swap the conv layer for a dense layer: two kinds of fault are too much for filters"
    ];
    const RIGHT = 1;
    const fb = [
      "You could, but you just saw training find a filter nobody would have written, and it separated every validation photo. Hand-written filters break when the lighting or the bubble size changes; trained ones follow the data.",
      null,
      `A ${N} × ${N} filter fits in exactly one position, so nothing slides and nothing is shared: each weight belongs to one pixel again, like a dense layer. A bubble learned in one corner would not be found in another.`,
      `Each extra filter costs only its own ${CONV_W} weights and a bias: our run counted ${PT.conv16} parameters for 16 filters. A dense layer would be thousands of times bigger and would have to learn every bubble position separately.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Who writes the filter?</h1>
        <p class="lead">In a convnet nobody writes the filters. Their numbers are weights, and the training loop you already know (score, loss, backward, step) sets them. Our run trained one 3 × 3 filter, starting from random numbers. It used ${LEARN.nTrain} small neck photos; half had a crack in a random column. Brightness was divided by 9, so every pixel is between 0 and 1. Each photo got one crack score: the largest number in the filter's output map.</p>
        ${kit.pics.side(filt(kit, LEARN.before, "before training"), filt(kit, LEARN.after, "after training"))}
        ${kit.table(LEARN.log.map(([e, l, a]) => [`epoch ${e}`, `training loss ${l}, accuracy ${a}`]), { head: ["", `accuracy is on ${LEARN.nVal} other photos it never trained on`], title: "learn_filter.py, our run" })}
        <p class="lead">It is not the edge filter we wrote. Its middle column is positive and both side columns are negative. So it gives high values where a column is brighter than the columns on both sides, which happens right next to a crack. Training found that on its own.</p>
        <p class="task">The factory now also wants to catch air bubbles: small round dark spots. What do you change?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}
        ${ans == null ? "" : ans === RIGHT ? kit.feedback(`Right. More filters means more output maps, each free to learn its own pattern, and the labels tell training what to look for. Cracks and bubbles share one cheap layer. Real convnets stack several such layers; later ones see patterns made of earlier patterns.`, true) : kit.feedback(fb[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const f = 2, area = f * f;
    const opts = [`Weights × ${area}, work × ${area}`, `Weights the same, work × ${area}`, "Weights the same, work the same", `Weights × ${f}, work × ${f}`];
    const RIGHT = 1;
    const fb = [
      `The filter does not depend on the photo's size: still ${CONV_W} weights and a bias. That was the point of sharing them.`,
      null,
      `The filter is applied at every position, and a photo ${f} times wider and ${f} times taller has ${area} times as many positions. Each one is ${CONV_W} multiplications.`,
      `Width and height both double, so the number of positions grows ${f} × ${f} = ${area} times. The weights do not change at all.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a convnet</h1>
        <p class="lead"><b>What it is for:</b> data on a grid where neighbours belong together and the same pattern can appear anywhere. Photos and scans are grids; sound or sensor readings over time are a grid in one dimension.</p>
        <p class="lead"><b>Reach for it</b> when a dense layer would need far too many weights.</p>
        <p class="lead"><b>Not</b> for tables whose column order means nothing: a tree model or a small dense network fits those. And not for a tiny set of photos trained from random weights: start from a convnet someone already trained.</p>
        <p class="lead"><b>Costs:</b> few weights, but every filter visits every position, so the work grows with photo size times the number of filters. It needs labelled examples. Padding adds fake edges at the border.</p>
        <p class="task">The factory buys a camera with twice the width and twice the height. What happens to one conv layer?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}
        ${ans == null ? "" : ans === RIGHT ? kit.feedback(`Right. The ${CONV_W} weights stay; the work grows ${area} times, because there are ${area} times as many positions. With a dense layer both would explode. That is why convnets made large photos practical. Their main cost is compute and the memory for the output maps, not the weights.`, true) : kit.feedback(fb[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A shipyard X-rays its steel welds and wants to flag small gas pockets, which can be anywhere along the seam.", true,
      "Yes. An X-ray is a grid of brightness values, a gas pocket is a small local pattern, and it can sit anywhere. Shared filters learn it once and find it everywhere.",
      "This is the convnet's home ground: a grid, a small local pattern, any position. A dense layer would need a separate set of weights for each place a pocket could appear."],
    ["A used-bike shop predicts a fair resale price from a table: brand, age in years, frame size, number of gears, condition grade.", false,
      "No. A filter assumes that neighbouring columns belong together, but 'frame size' sits next to 'number of gears' only because someone typed the columns in that order. Shuffle the columns and the meaning is the same while every filter sees something different. Use a tree model or a small dense network.",
      "A filter reads neighbours together, and here neighbours mean nothing: the column order is arbitrary. There is no local pattern to slide over. A tree model or a dense network treats each column as its own feature, which is what this data needs."],
    ["A wildlife park records hours of forest sound and wants to find one bird's call: a short sound pattern that can start at any second.", true,
      "Yes, in one dimension. The recording is a line of numbers in time order, neighbours belong together, and the call can start at any moment. A 1-D filter slides along time (PyTorch has nn.Conv1d for this).",
      "The grid here is one line of numbers in time order, which still has neighbours and a pattern that can appear anywhere. A filter sliding along time finds the call: a 1-D convolution."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Convnet or not?</h1>
        <p class="lead">Three problems from other places. A convnet slides small shared filters over data whose neighbours belong together.</p>
        <p class="task">Would you use a convnet for each? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can explain a convnet</h1>
      <p class="lead">You slid a ${K} × ${K} filter over a ${N} × ${N} photo by hand, worked out the output size with and without padding, counted ${fmt(DENSE_W)} dense weights against ${CONV_W} shared ones, and saw training choose a filter of its own.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>convolve</code> yourself, add a padding option, and check your output map against the one from this lesson.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A filter is a small set of weights reused everywhere; next you meet a layer that keeps one learned vector per category instead of a huge one-hot column.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Convolutional networks in brief",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv2d.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Conv1d.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.pad.html",
      "https://cs231n.github.io/convolutional-networks/"
    ],
    interview: [
      {
        q: "You need to flag scratched phone screens from 512 × 512 photos. A teammate wants to flatten each photo and use two dense layers. What do you tell them?",
        good: [
          "512 × 512 is 262,144 inputs, and a dense layer gives each its own weight for every hidden unit: a few hundred units already need tens of millions of weights",
          "A scratch is a local pattern that can be anywhere; a conv layer learns it once with a small shared filter and finds it at every position",
          "The conv layer's weight count does not grow with the photo size; its compute does, with photo size times filters",
          "With few labelled photos, start from a pretrained convnet rather than training from zero"
        ],
        weak: "Say “CNNs are better for images” without explaining weight sharing, local patches or what the dense version would cost."
      },
      {
        q: "Your crack detector works on test photos but misses cracks that touch the edge of the photo. What could cause that, and what would you check?",
        good: [
          "Without padding the output shrinks, and a pattern right at the border has fewer or no full patches, so part of its signal is lost",
          "With zero padding the border itself looks like an edge, so the model may have learned to ignore strong values there",
          "Check the padding setting and the output size of each layer",
          "Crop with a margin around the area of interest, or add training photos with cracks near the edge"
        ],
        weak: "Collect more data or train longer, without looking at what happens at the border of the image."
      }
    ],
    screens: [firstCell, slideRow, sizes, countWeights, spotIdea, predict, asCode, learned, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
