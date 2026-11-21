/* Lesson: debugging a run from its loss curves. Story: a teammate's parcel-damage classifier sits at 50%
   validation accuracy after a day of training, and they ask you to look.
   Ideas: (1) four common failures leave four different shapes on the train and validation curves, read against
   the loss of plain guessing (ln 2 for two balanced classes); (2) a curve says where to look, a fixed checklist
   (one-batch test, label histogram, gradient-norm log) says what is wrong.
   Data, all real, from runs on this Mac (PyTorch on CPU, seeds in the scripts):
   - docs/ai-path/runs/s3-loss-curves/four_curves.py + four_curves.out.txt: four runs with a known cause each
     (underfit, overfit, learning rate too high, labels shuffled apart from photos);
   - docs/ai-path/runs/s3-loss-curves/teammate_run.py + teammate_run.out.txt: the broken run (label words
     compared with the wrong case), the one-batch test, the label histogram, the gradient-norm logs, the traced
     make_labels function and the fixed run.
   The "photos" are a stand-in: 8x8 synthetic grey images from parcels.py, so every run takes seconds.
   No model calls were recorded for this lesson.
   Lesson-local picture and style: a small SVG line chart (.lx-s3-loss-curves-*), see chart() and ensureStyle(). */
(() => {
  const ID = "s3-loss-curves";

  /* ---------- Data copied from the runs ---------- */
  /*@DATA@*/
  // From docs/ai-path/runs/s3-loss-curves/four_curves.out.txt (one JSON line per run, copied whole)
  const FOUR = {"underfit": {"train_size": 3000, "optimizer": "adam", "lr": 0.003, "epochs": 30, "train_loss": [0.6968, 0.6806, 0.6507, 0.6157, 0.5892, 0.571, 0.5579, 0.552, 0.5414, 0.5338, 0.5297, 0.5227, 0.5185, 0.5143, 0.5106, 0.5068, 0.5048, 0.502, 0.4999, 0.4953, 0.4927, 0.4925, 0.4889, 0.4882, 0.4862, 0.4867, 0.4844, 0.4826, 0.484, 0.4802], "val_loss": [0.6883, 0.6701, 0.6365, 0.5996, 0.5774, 0.5628, 0.5609, 0.5456, 0.5358, 0.5306, 0.5254, 0.5192, 0.515, 0.5147, 0.5054, 0.5017, 0.5, 0.4993, 0.4937, 0.4907, 0.4899, 0.4857, 0.4862, 0.4829, 0.4823, 0.4876, 0.4776, 0.4947, 0.4751, 0.4786], "val_acc": [0.508, 0.616, 0.542, 0.702, 0.692, 0.704, 0.701, 0.715, 0.726, 0.728, 0.739, 0.74, 0.744, 0.746, 0.744, 0.744, 0.753, 0.756, 0.757, 0.749, 0.761, 0.761, 0.766, 0.761, 0.764, 0.762, 0.763, 0.757, 0.766, 0.768]}, "overfit": {"train_size": 60, "optimizer": "adam", "lr": 0.001, "epochs": 40, "train_loss": [0.6928, 0.6803, 0.6567, 0.6451, 0.6212, 0.5991, 0.5762, 0.5468, 0.5186, 0.4841, 0.45, 0.414, 0.3788, 0.3406, 0.3053, 0.269, 0.2341, 0.2021, 0.1714, 0.1433, 0.1193, 0.098, 0.0788, 0.0633, 0.0502, 0.0395, 0.0312, 0.0244, 0.0193, 0.0152, 0.0121, 0.0097, 0.0077, 0.0063, 0.0052, 0.0042, 0.0035, 0.003, 0.0025, 0.0021], "val_loss": [0.6953, 0.6695, 0.66, 0.6452, 0.6347, 0.6223, 0.6003, 0.5801, 0.5599, 0.5445, 0.522, 0.4963, 0.4767, 0.4629, 0.433, 0.4134, 0.4056, 0.3754, 0.3652, 0.3643, 0.3386, 0.3437, 0.3504, 0.3328, 0.3411, 0.3645, 0.3644, 0.3597, 0.3747, 0.4027, 0.4219, 0.4258, 0.4264, 0.435, 0.4539, 0.4784, 0.5011, 0.5166, 0.5245, 0.5277], "val_acc": [0.5, 0.886, 0.5, 0.821, 0.813, 0.755, 0.866, 0.91, 0.893, 0.839, 0.851, 0.884, 0.87, 0.842, 0.872, 0.867, 0.85, 0.88, 0.872, 0.861, 0.881, 0.873, 0.87, 0.881, 0.879, 0.873, 0.874, 0.88, 0.876, 0.872, 0.873, 0.873, 0.874, 0.874, 0.873, 0.872, 0.868, 0.868, 0.868, 0.869]}, "lr_too_high": {"train_size": 3000, "optimizer": "adam", "lr": 0.02, "epochs": 30, "train_loss": [0.646, 0.4555, 0.3058, 0.2005, 0.1122, 0.0911, 0.0934, 0.0691, 0.1055, 0.1069, 0.0666, 0.0669, 0.1255, 0.0543, 0.0818, 0.1556, 0.1993, 0.1281, 0.134, 0.1412, 0.1098, 0.1228, 0.1128, 0.1198, 0.1371, 0.1064, 0.1244, 0.1008, 0.1121, 0.1071], "val_loss": [0.5056, 0.4537, 0.5049, 0.122, 0.1163, 0.1144, 0.0845, 0.0837, 0.2281, 0.0958, 0.1087, 0.2811, 0.0974, 0.067, 0.1099, 0.2392, 0.1578, 0.1733, 0.1952, 0.1622, 0.1888, 0.205, 0.1815, 0.157, 0.1527, 0.3204, 0.1572, 0.1608, 0.1672, 0.2119], "val_acc": [0.755, 0.791, 0.741, 0.961, 0.964, 0.951, 0.97, 0.973, 0.911, 0.972, 0.961, 0.908, 0.967, 0.976, 0.959, 0.909, 0.948, 0.941, 0.924, 0.941, 0.927, 0.935, 0.939, 0.945, 0.944, 0.885, 0.948, 0.942, 0.94, 0.925]}, "labels_shuffled": {"train_size": 3000, "optimizer": "adam", "lr": 0.001, "epochs": 30, "train_loss": [0.695, 0.6931, 0.6933, 0.691, 0.6925, 0.6905, 0.6931, 0.6905, 0.6884, 0.6873, 0.6889, 0.6871, 0.6851, 0.6835, 0.6822, 0.6811, 0.6834, 0.6805, 0.6771, 0.6794, 0.6801, 0.6713, 0.6719, 0.6748, 0.6682, 0.666, 0.6647, 0.6596, 0.6659, 0.657], "val_loss": [0.6943, 0.6964, 0.696, 0.6988, 0.6982, 0.7023, 0.6969, 0.6983, 0.7014, 0.7045, 0.6982, 0.7077, 0.704, 0.7056, 0.7054, 0.7007, 0.7029, 0.7026, 0.7281, 0.7045, 0.7004, 0.7351, 0.7077, 0.7221, 0.7395, 0.7192, 0.7342, 0.6782, 0.6919, 0.7169], "val_acc": [0.419, 0.407, 0.45, 0.458, 0.424, 0.339, 0.352, 0.383, 0.535, 0.403, 0.521, 0.387, 0.409, 0.4, 0.583, 0.567, 0.419, 0.45, 0.556, 0.54, 0.418, 0.438, 0.395, 0.423, 0.467, 0.425, 0.505, 0.522, 0.512, 0.459]}};
  // From docs/ai-path/runs/s3-loss-curves/teammate_run.out.txt
  const BROKEN = {"train_loss": [0.096, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "val_loss": [5.9645, 7.4183, 8.9501, 9.5351, 9.8779, 10.1437, 10.3465, 10.5048, 10.6404, 10.7551, 10.8522, 10.9345, 11.0044, 11.073, 11.1364, 11.1956, 11.2504, 11.3042, 11.3537, 11.3988, 11.4437, 11.4861, 11.5271, 11.5674, 11.6069, 11.6453, 11.6806, 11.7172, 11.7514, 11.7854], "val_acc": [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], "grad_norm_epoch_mean": [0.30016, 0.00016, 1e-05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "grad_norm_first10": [1.2473, 1.179, 1.1449, 1.0759, 1.0616, 1.0491, 1.0182, 0.9832, 0.9241, 0.8439], "steps_per_epoch": 47, "val_predictions_bincount": [1000, 0]};
  const ONE_BATCH = {"loss_at_step": [[0, 0.6472], [10, 0.1361], [50, 0.0], [100, 0.0], [200, 0.0]], "batch_labels": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]};
  const HISTOGRAM = {"train": [3000, 0], "val": [500, 500], "raw_words": {"damaged": 1500, "intact": 1500}};
  const HOT_GRAD = {"grad_norm_epoch_mean": [0.56786, 1.49741, 1.37812, 1.85249, 1.26045, 1.18951, 1.50044, 1.00732, 1.4944, 1.26477, 1.08427, 1.1422, 1.72487, 0.7894, 1.35765, 1.99114, 1.56767, 1.22121, 1.37937, 1.73366, 1.01933, 1.31796, 1.10228, 1.29541, 1.48578, 0.98616, 1.36686, 0.75912, 1.28824, 1.18524], "grad_norm_max": 7.488};
  const FIXED_HISTOGRAM = [1500, 1500];
  const FIXED = {"train_loss": [0.6222, 0.3259, 0.1198, 0.0428, 0.0251, 0.0116, 0.007, 0.0046, 0.0034, 0.0029, 0.0024, 0.0018, 0.0014, 0.0012, 0.0011, 0.001, 0.0008, 0.0007, 0.0006, 0.0006, 0.0005, 0.0004, 0.0004, 0.0004, 0.0004, 0.0003, 0.0003, 0.0003, 0.0003, 0.0002], "val_loss": [0.4933, 0.2033, 0.0754, 0.0313, 0.0213, 0.0187, 0.0095, 0.0082, 0.0077, 0.0049, 0.0071, 0.0047, 0.0052, 0.0044, 0.0053, 0.0045, 0.0033, 0.0028, 0.0036, 0.0033, 0.0039, 0.0033, 0.0026, 0.0021, 0.0024, 0.0021, 0.0028, 0.0025, 0.0025, 0.0021], "val_acc": [0.933, 0.977, 0.991, 0.997, 0.998, 0.997, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999]};
  // make_labels traced on the first four warehouse rows: [line about to run, event (l line, r return), word, damaged, labels]
  const TRACE_ROWS = ["intact", "damaged", "damaged", "intact"];
  const TRACE = [[1, "l", null, null, null], [2, "l", null, null, []], [3, "l", null, null, []], [4, "l", "intact", null, []], [5, "l", "intact", false, []], [2, "l", "intact", false, [0]], [3, "l", "intact", false, [0]], [4, "l", "damaged", false, [0]], [5, "l", "damaged", false, [0]], [2, "l", "damaged", false, [0, 0]], [3, "l", "damaged", false, [0, 0]], [4, "l", "damaged", false, [0, 0]], [5, "l", "damaged", false, [0, 0]], [2, "l", "damaged", false, [0, 0, 0]], [3, "l", "damaged", false, [0, 0, 0]], [4, "l", "intact", false, [0, 0, 0]], [5, "l", "intact", false, [0, 0, 0]], [2, "l", "intact", false, [0, 0, 0, 0]], [6, "l", "intact", false, [0, 0, 0, 0]], [6, "r", "intact", false, [0, 0, 0, 0]]];
  /*@END@*/

  /* ---------- Derived from the data ---------- */
  const CHANCE = Math.log(2); // cross-entropy of saying 50/50 for a parcel, whatever its true class
  const CHANCE3 = Math.log(3);
  const pct = v => `${(v * 100).toFixed(1)}%`;
  const f2 = v => v.toFixed(2), f3 = v => v.toFixed(3);
  const last = a => a[a.length - 1];
  const argmin = a => a.indexOf(Math.min(...a));
  const OB = ONE_BATCH.loss_at_step;
  const BATCH_N = ONE_BATCH.batch_labels.length;
  const BATCH_ZEROS = ONE_BATCH.batch_labels.filter(v => v === 0).length;
  const EPOCHS_B = BROKEN.val_acc.length;
  const ALL_HALF = BROKEN.val_acc.every(v => v === 0.5);
  const TRAIN_N = HISTOGRAM.train[0] + HISTOGRAM.train[1];
  const BROKEN_G = BROKEN.grad_norm_epoch_mean, HOT_G = HOT_GRAD.grad_norm_epoch_mean;
  const firstZeroEpoch = BROKEN_G.findIndex(v => v === 0) + 1;
  const OV = FOUR.overfit, OV_BEST = argmin(OV.val_loss);

  /* ---------- Lesson-local style and the line chart ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-chart { margin: 14px 0 0; }
      .lx-${ID}-chart svg { display: block; width: 100%; height: auto; max-width: 520px; }
      .lx-${ID}-chart figcaption { font: 600 13px/1.4 var(--mono); color: var(--muted); margin: 0 0 4px; text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-ax { stroke: var(--line); stroke-width: 1; }
      .lx-${ID}-t { fill: var(--muted); font: 500 11px var(--mono); }
      .lx-${ID}-s0 { fill: none; stroke: var(--ink); stroke-width: 2.4; stroke-linejoin: round; }
      .lx-${ID}-s1 { fill: none; stroke: var(--ink-2); stroke-width: 2; stroke-dasharray: 6 4; stroke-linejoin: round; }
      .lx-${ID}-ch { stroke: var(--muted); stroke-width: 1.2; stroke-dasharray: 2 3; }
      .lx-${ID}-note { margin: 4px 0 0; font-size: 14.5px; color: var(--ink-2); }
      .lx-${ID}-grid { display: grid; grid-template-columns: 1fr; gap: 6px 22px; }
      @media (min-width: 760px) { .lx-${ID}-grid.two { grid-template-columns: 1fr 1fr; } }
      .lx-${ID}-out { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
      .lx-${ID}-steps { margin: 10px 0 0; padding-left: 1.3em; }
      .lx-${ID}-steps li { margin: 4px 0; line-height: 1.45; }
    `;
    document.head.appendChild(s);
  }

  /* series: [{ v: [numbers per epoch], cls: 0 solid | 1 dashed, name }]. chance: draw the guessing line. */
  function chart(kit, title, series, { chance = CHANCE, yMax = null, yLabel = "loss" } = {}) {
    const W = 320, H = 150, L = 38, R = 10, T = 10, B = 26;
    const n = Math.max(...series.map(s => s.v.length));
    const top = yMax || Math.max(chance || 0, ...series.flatMap(s => s.v)) * 1.2;
    const x = i => L + (n === 1 ? 0 : i / (n - 1)) * (W - L - R);
    const y = v => T + (1 - Math.min(v, top) / top) * (H - T - B);
    const fmt = v => top >= 10 ? v.toFixed(0) : top >= 2 ? v.toFixed(1) : v.toFixed(2);
    const ticks = [0, top / 2.4, top / 1.2];
    const path = s => s.v.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const legendY = H - 4;
    const legend = series.map((s, k) => {
      const lx = L + k * 140;
      return `<line class="lx-${ID}-s${s.cls}" x1="${lx}" y1="${legendY - 4}" x2="${lx + 22}" y2="${legendY - 4}"></line><text class="lx-${ID}-t" x="${lx + 27}" y="${legendY}">${kit.esc(s.name)}</text>`;
    }).join("");
    const chanceLegend = chance ? `<line class="lx-${ID}-ch" x1="${L}" y1="${legendY + 12}" x2="${L + 22}" y2="${legendY + 12}"></line><text class="lx-${ID}-t" x="${L + 27}" y="${legendY + 16}">guessing ${f3(chance)}</text>` : "";
    const desc = series.map(s => `${s.name}: ${fmt(s.v[0])} at epoch 1, ${fmt(last(s.v))} at epoch ${s.v.length}`).join("; ");
    return `<figure class="lx-${ID}-chart"><figcaption>${kit.esc(title)}</figcaption>
      <svg viewBox="0 0 ${W} ${H + (chance ? 28 : 12)}" role="img" aria-label="${kit.esc(title + ". " + desc)}">
        <line class="lx-${ID}-ax" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"></line>
        <line class="lx-${ID}-ax" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"></line>
        ${ticks.map(t => `<text class="lx-${ID}-t" x="${L - 4}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("")}
        <text class="lx-${ID}-t" x="${W - R}" y="${H - B + 13}" text-anchor="end">epoch ${n}</text>
        <text class="lx-${ID}-t" x="${L}" y="${H - B + 13}">1</text>
        ${chance ? `<line class="lx-${ID}-ch" x1="${L}" y1="${y(chance)}" x2="${W - R}" y2="${y(chance)}"></line>` : ""}
        ${series.map(s => `<path class="lx-${ID}-s${s.cls}" d="${path(s)}"></path>`).join("")}
        <g transform="translate(0 12)">${legend}${chanceLegend}</g>
      </svg></figure>`;
  }
  const lossChart = (kit, title, run, o) => chart(kit, title, [{ v: run.train_loss, cls: 0, name: "train loss" }, { v: run.val_loss, cls: 1, name: "validation loss" }], o);
  const accNote = run => `<p class="lx-${ID}-note">Validation accuracy: ${pct(run.val_acc[0])} after epoch 1, ${pct(last(run.val_acc))} after epoch ${run.val_acc.length}.</p>`;
  const out = (kit, s) => `<div class="lx-${ID}-out">${kit.esc(s)}</div>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const one = (el, paint, right, done, set) => el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { set(+b.dataset.i); paint(); if (+b.dataset.i === right) done(); });

  /* 1. The situation, and the loss of guessing. */
  function guessing({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const vals = [0, 0.5, CHANCE, 1];
    const RIGHT = 2;
    const opts = vals.map(v => v === CHANCE ? f3(v) : String(v));
    const fb = [
      ["Zero loss means the model gave the true class a probability of 1 for every parcel. Saying 50/50 is the opposite of sure.", false],
      [`Cross-entropy is not the error rate. It is minus the log of the probability given to the true class: −ln(0.5), not 0.5.`, false],
      [`Right. Each parcel gets probability 0.5 for its true class, and −ln(0.5) = ${f3(CHANCE)}. That is the loss of a model that has learned nothing. Every loss chart in this lesson draws it as a dotted line, labelled <b>guessing</b> under the chart. A loss stuck on that line means nothing was learned; a loss far <i>above</i> it means the model is sure, and wrong.`, true],
      ["1 would need a probability of about 0.37 for the true class (−ln 0.37 ≈ 1). Saying 50/50 gives 0.5.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Stuck at 50%</h1>
        <p class="lead">Your teammate trained a classifier that looks at a photo of a parcel and says <b>damaged</b> or <b>intact</b>. Half the validation photos are damaged. After a day of training, validation accuracy is 50%: a coin would do as well. They ask you to look.</p>
        <p class="lead">This lesson is about the first job when a training run goes wrong: read its loss curves to see where the problem is, then find the cause with a short checklist.</p>
        <p class="lead">To keep every run here short and real, we rebuilt the problem as a small stand-in: ${TRAIN_N.toLocaleString("en")} training images, tiny 8×8 "photos" (64 numbers each) made by a script, where a damaged parcel has a crease line. A small PyTorch network trains on them in seconds on a laptop. Every curve you see was really trained.</p>
        <p class="lead">The loss is cross-entropy, as in the earlier lessons: minus the log of the probability the model gave to the true class, averaged over photos.</p>
        <p class="task">A model that says "50% damaged" for every photo, whatever it shows. What loss does it print?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      one(el, paint, RIGHT, done, v => ans = v);
    };
    paint();
  }

  /* 2. By hand: match four recorded curve pairs to their causes. */
  const CAUSES = ["Underfitting", "Overfitting", "Learning rate too high", "Data bug"];
  const CHARTS = [
    { run: "lr_too_high", right: 2,
      setup: r => `Same network as a healthy run, Adam with learning rate ${r.lr} (the default is 0.001).`,
      ok: r => `Right. The train loss fell, then went <b>up</b> again and kept jumping (lowest ${f3(Math.min(...r.train_loss))}, last ${f3(last(r.train_loss))}). Training loss rising while you train on the same data means the steps overshoot. Overfitting never makes the <i>train</i> loss rise.`,
      no: ["An underfit model's losses settle smoothly at a high level. These jump, and the train loss went back up after reaching a low point.", "Overfitting leaves the train loss falling to the end; only validation turns up. Here the <i>train</i> loss itself turns up and jumps. That points at the step size.", null, "With a data bug the model usually cannot get far below guessing, or falls to zero on train and fails on validation. This model got well below guessing on both, then wobbled: it learned, but its steps are too big."] },
    { run: "underfit", right: 0,
      setup: r => `A network with one hidden layer of only 4 units, Adam with learning rate ${r.lr}.`,
      ok: r => `Right. Both curves fall a little and flatten together, high above zero (train ${f3(last(r.train_loss))}, validation ${f3(last(r.val_loss))}). No gap between them: the model does as badly on photos it trained on as on new ones. It is too small, or not trained enough, to fit even the training data.`,
      no: [null, "Overfitting opens a gap: train loss keeps falling while validation stops or rises. Here the two curves sit on top of each other.", "A too-high learning rate makes curves jump or rise. These fall smoothly and level off.", `A data bug like shuffled labels keeps the loss on the guessing line. This model got clearly below it (to ${f3(last(FOUR.underfit.val_loss))}), so it did learn something real; it just cannot learn more.`] },
    { run: "labels_shuffled", right: 3,
      setup: () => "A healthy network and learning rate. The loader shuffled the labels apart from the photos.",
      ok: r => `Right. Both losses start on the guessing line and stay there; validation accuracy wobbles around 50% (last ${pct(last(r.val_acc))}). The photos tell the model nothing about these labels, so the best it can do is guess. The small fall in train loss is the network memorising a few photos, which makes validation slightly worse, not better.`,
      no: ["Underfitting still gets below guessing, then stalls. These curves never leave the guessing line at all: nothing in the inputs matches the labels.", "There is a small gap at the end, but the model never beat guessing on validation. Overfitting first learns something real, then gets worse.", "A too-high learning rate makes the loss jump about. These are flat at the guessing line from epoch 1.", null] },
    { run: "overfit", right: 1,
      setup: r => `A big network (512 units per layer) trained on only ${r.train_size} photos, no regularization.`,
      ok: r => `Right. Train loss falls towards zero (${f3(last(r.train_loss))}), while validation loss is lowest at epoch ${OV_BEST + 1} (${f3(r.val_loss[OV_BEST])}) and then climbs to ${f3(last(r.val_loss))}. The gap that opens is the model memorising its ${r.train_size} photos. Epoch ${OV_BEST + 1} is where early stopping would keep the weights.`,
      no: ["Underfitting keeps both curves high and together. Here train loss goes to almost zero.", null, "With a too-high learning rate the train loss jumps or rises. Here it falls smoothly all the way; only validation turns up.", "Validation loss dropped well below guessing first, so the labels do match the photos. The model learned, then memorised."] }
  ];
  function matchFour({ el, done, kit }) {
    ensureStyle();
    const ans = CHARTS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Four runs, four causes</h1>
        <p class="lead">Before looking at your teammate's run, practise on four runs where we know the cause, because we caused it. Each chart shows the training loss (solid) and the validation loss (dashed) per epoch, on the same stand-in photos. A <b>data bug</b> means the labels or photos reach the model wrong.</p>
        <p class="task">Name the cause of each run. Pick again if you change your mind.</p>
        <div class="lx-${ID}-grid two">${CHARTS.map((c, i) => {
          const r = FOUR[c.run];
          const p = ans[i];
          return `<div class="lcase" id="c${i}">${lossChart(kit, "Run " + "ABCD"[i], r)}${accNote(r)}${kit.options(CAUSES, { picked: p, correct: c.right })}${p == null ? "" : p === c.right ? kit.feedback(`${c.ok(r)}<br>How we caused it: ${kit.esc(c.setup(r))}`, true) : kit.feedback(c.no[p], false)}</div>`;
        }).join("")}</div>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CHARTS.every((ch, j) => ans[j] === ch.right)) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: the teammate's run matches none cleanly, so you need a checklist. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 3;
    const opts = [
      "Overfitting: add dropout and train again",
      "Learning rate too high: lower it and train again",
      "Underfitting: use a bigger network",
      "None of the four runs matches cleanly: train is perfect, validation never beats a coin. Check the pieces in order before changing anything"
    ];
    const fb = [
      [`Overfitting learns something real first: validation gets better, then worse (Run D). Here validation accuracy is ${pct(BROKEN.val_acc[0])} at every one of ${EPOCHS_B} epochs, and validation loss starts at ${f2(BROKEN.val_loss[0])}, far above guessing. It never learned anything that works on new photos. Dropout would not change that.`, false],
      [`A too-high learning rate makes the train loss jump (Run A). Here it fell to ${f3(last(BROKEN.train_loss))} and stayed there. The optimiser did its job perfectly on the training data.`, false],
      [`An underfit model cannot fit even its training data. This one reached a train loss of ${f3(last(BROKEN.train_loss))}: it fits the training set perfectly. A bigger network would fit it just as perfectly.`, false],
      [`Right. Perfect on train and never better than a coin on validation, from epoch 1, matches none of the four runs. It is not Run C either: there both losses sat on the guessing line; here train is at zero and validation is far above the line. Something differs between what the model trained on and what it is tested on. A curve tells you <b>where to look</b>; it does not tell you what is broken. So you run a fixed checklist, cheapest first, where each check rules a part in or out:<ol class="lx-${ID}-steps"><li><b>One-batch test</b>: can the model, loss and optimiser learn at all?</li><li><b>Label histogram</b>: are the labels what you think they are?</li><li><b>Gradient-norm log</b>: are the updates sane, or exploding, or gone?</li></ol>Guessing a fix ("try dropout") costs a day of training per guess.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Your teammate's run</h1>
        <p class="lead">Here is the broken run, rebuilt on the stand-in photos: same network as a healthy run, Adam with the default learning rate, ${EPOCHS_B} epochs.</p>
        ${lossChart(kit, "Teammate's run", BROKEN)}
        ${accNote(BROKEN)}
        <p class="task">Which of the four runs does it match, and what do you do?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      one(el, paint, RIGHT, done, v => ans = v);
    };
    paint();
  }

  /* 4. Check 1: the one-batch test, with a prediction. */
  const ONE_BATCH_CODE = [
    "photos = train_photos[:32]  # one batch",
    "labels = train_labels[:32]",
    "opt = torch.optim.Adam(model.parameters())",
    "for step in range(201):",
    "    opt.zero_grad()",
    "    loss = loss_fn(model(photos), labels)",
    "    loss.backward()",
    "    opt.step()",
    "    if step in (0, 10, 50, 100, 200):",
    "        print(step, round(loss.item(), 4))"
  ];
  function oneBatch({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 0;
    const opts = ["It falls to nearly zero", `It stays near the guessing line, ${f3(CHANCE)}`, "It goes up"];
    const table = OB.map(([s, l]) => `${s} ${Number.isInteger(l) ? l.toFixed(1) : l}`).join("\n");
    const fb = [
      [`Right, and that is what happened:${out(kit, table)}<p class="lx-${ID}-cap">Output of teammate_run.py on this Mac: step, then loss.</p>A network with thousands of weights can memorise ${BATCH_N} photos. If the loss does <b>not</b> fall, the bug is in the training step itself: an optimiser built on the wrong parameters, a layer frozen by mistake (set so its weights never change), a loss that does not match the outputs. Here it fell, so the step really updates the weights. Rule the training step out. But look at the batch: of its ${BATCH_N} labels, ${BATCH_ZEROS} are 0. Fitting that needs no look at the photos at all, so the test passed for a dull reason. The next check counts the labels.`, true],
      ["It would stay there only if the training step were broken: no gradients reaching the weights, or the optimiser never stepping. That is exactly what the test checks for. A working setup memorises a small batch.", false],
      ["Training on the same batch over and over pushes the loss down on that batch. It only rises when the steps are far too big, and the default Adam rate is not.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Check 1: can it learn one batch?</h1>
        <p class="lead">Take one batch of ${BATCH_N} training photos with their labels and train a fresh model on that batch only, ${OB[OB.length - 1][0]} times. It takes seconds, and it tests the training code on its own.</p>
        ${kit.code(ONE_BATCH_CODE, ans === RIGHT ? 9 : 5)}
        <p class="task">If the model, the loss and the optimiser are wired correctly, what does the loss do?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      one(el, paint, RIGHT, done, v => ans = v);
    };
    paint();
  }

  /* 5. Check 2: the label histogram, and name the bug before seeing the fix. */
  function histogram({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const words = HISTOGRAM.raw_words;
    const opts = [
      "The validation labels are wrong",
      "The code that turns label words into numbers makes every training label 0",
      "The classes are imbalanced: add class weights to the loss",
      "Photos and labels got shuffled apart"
    ];
    const fb = [
      [`Validation has ${HISTOGRAM.val[0]} and ${HISTOGRAM.val[1]}: half damaged, as expected. It is the training counts that are impossible.`, false],
      [`Right. The export holds ${words.damaged.toLocaleString("en")} "damaged" rows, yet the training labels hold ${HISTOGRAM.train[1]} ones. The step that turns words into 0 and 1 is broken. The model learned the easiest rule there is, "always say intact", which is perfect on train and a coin flip on validation: it said intact for all ${BROKEN.val_predictions_bincount[0]} validation photos.`, true],
      [`There is nothing to weight: class 1 has ${HISTOGRAM.train[1]} examples. Weights rescale the examples you have; they cannot create the missing ones. And the export itself is balanced, so the imbalance was made by the code.`, false],
      [`Shuffling labels apart keeps the counts (${words.damaged.toLocaleString("en")} and ${words.intact.toLocaleString("en")}) and leaves the loss on the guessing line, as in Run C. Here a whole class has vanished.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Check 2: count the labels</h1>
        <p class="lead">The training labels come from the warehouse export as words. The export has ${words.damaged.toLocaleString("en")} rows saying "damaged" and ${words.intact.toLocaleString("en")} saying "intact". The validation labels come from a separate file, already as 0 (intact) and 1 (damaged). <code>torch.bincount</code> counts how many times each value appears; <code>minlength=2</code> keeps a slot for a class even when its count is zero.</p>
        ${kit.code(["print(torch.bincount(train_labels,", "                     minlength=2).tolist())", "print(torch.bincount(val_labels,", "                     minlength=2).tolist())"], -1)}
        ${out(kit, `[${HISTOGRAM.train.join(", ")}]\n[${HISTOGRAM.val.join(", ")}]`)}
        <p class="lx-${ID}-cap">Output of teammate_run.py on this Mac.</p>
        <p class="task">Name the bug.</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      one(el, paint, RIGHT, done, v => ans = v);
    };
    paint();
  }

  /* 6. Check 3: the gradient-norm log, against the too-high learning rate run. */
  function gradNorm({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "The gradients vanished, so the network is broken",
      "The model fits its training labels exactly, so there is nothing left to learn from them",
      "The learning rate is too high",
      "Training stopped early by itself"
    ];
    const fb = [
      ["Check 1 showed the network learns a batch fine. A gradient near zero here is not a broken network; it is what you get when the loss on every training batch is already near zero.", false],
      [`Right. The gradient says how much the loss would change if the weights moved. With every training label 0 and the model saying "intact" with full confidence, the training loss is practically zero, so the gradient is too: under 0.00001 from epoch ${firstZeroEpoch}. The run spent the rest of its time changing almost nothing. Compare Run A: its norms stay large and jumpy to the end (up to ${f2(HOT_GRAD.grad_norm_max)} in one step), which is what too-big steps look like.`, true],
      [`A too-high rate shows the other picture: norms that stay large and jump about, like the Run A log. Here they fall to almost nothing by epoch ${firstZeroEpoch} and stay there.`, false],
      ["Nothing stops the loop: it ran every epoch. The weights simply stopped changing, because the gradient was almost zero.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Check 3: the gradient-norm log</h1>
        <p class="lead">Log one number per step: the <b>gradient norm</b>, the size of all gradients taken together. It shows how big each update is. <code>clip_grad_norm_</code> shrinks (clips) gradients that are too big and returns their size. With <code>max_norm=float("inf")</code> nothing counts as too big, so it only measures. Call it after <code>loss.backward()</code>.</p>
        ${kit.code(["from torch.nn.utils import clip_grad_norm_", "loss.backward()", "norm = clip_grad_norm_(model.parameters(),", "    max_norm=float(\"inf\"))", "grad_log.append(norm.item())", "opt.step()"], 2)}
        <div class="lx-${ID}-grid two">
          ${chart(kit, "Teammate's run, mean norm per epoch", [{ v: BROKEN_G, cls: 0, name: "gradient norm" }], { chance: null, yLabel: "norm" })}
          ${chart(kit, "Run A (rate too high), mean norm per epoch", [{ v: HOT_G, cls: 0, name: "gradient norm" }], { chance: null, yLabel: "norm" })}
        </div>
        <p class="lx-${ID}-note">Teammate's run: ${f3(BROKEN_G[0])} in epoch 1, below 0.00001 from epoch ${firstZeroEpoch} on (the log rounds to 5 decimals and prints 0.0).</p>
        <p class="task">What does the teammate's log tell you?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      one(el, paint, RIGHT, done, v => ans = v);
    };
    paint();
  }

  /* 7. Broken on purpose: step through the label code and see the bug happen. */
  const LABEL_CODE = [
    "def make_labels(rows):",
    "    labels = []",
    "    for row in rows:",
    "        word = row[\"label\"]",
    "        damaged = word == \"Damaged\"",
    "        labels.append(int(damaged))",
    "    return torch.tensor(labels)"
  ];
  // Lines of LABEL_CODE offered as the culprit, and why each wrong one is not it
  const LINE_PICK = [2, 3, 4, 5, 6];
  const LINE_RIGHT = 2; // position of line 4 in LINE_PICK
  const LINE_FB = [
    `The loop visits every row: the trace takes each of the ${TRACE_ROWS.length} rows in turn. The rows arrive; what happens to their words is the problem.`,
    `This line reads the word correctly: the trace shows word = "damaged" on the second row. The word is right; the next line mishandles it.`,
    `Right. <code>"damaged" == "Damaged"</code> is False: Python compares strings exactly, case included. Every damaged parcel gets 0 here, before training even starts.`,
    "<code>int(False)</code> is 0, which is right for False. This line only stores what the line above already decided.",
    "The list is already all zeros before this line runs; the tensor just copies it."
  ];
  function traceBug({ el, done, kit }) {
    ensureStyle();
    let i = 0, pick = null;
    const say = k => {
      const [ln, ev, word, dmg, labels] = TRACE[k];
      if (ev === "r") return `The function returns ${labels.length} labels, all ${labels[0]}, for rows that said ${TRACE_ROWS.map(w => `"${w}"`).join(", ")}.`;
      if (ln === 1) return "Start with an empty list.";
      if (ln === 2) return labels.length === 0 ? "Take the first row." : `Label ${labels.length} is ${last(labels)}. Next row.`;
      if (ln === 3) return "Read this row's label word.";
      if (ln === 4) return `The word is "${word}". This line compares it with "Damaged", with a capital D.`;
      if (ln === 5) return `<code>damaged</code> is ${dmg ? "True" : "False"}${word === "damaged" ? `: Python compares strings exactly, and "damaged" is not "Damaged". The parcel is damaged, but it gets 0` : ""}.`;
      if (ln === 6) return "All rows done.";
      return "";
    };
    const paint = () => {
      const [ln, , word, dmg, labels] = TRACE[i];
      el.innerHTML = `<h1>Find the line</h1>
        <p class="lead">This is the function that turned the export's words into numbers. Here it runs on the first ${TRACE_ROWS.length} rows of the export (a replay of a real traced run).</p>
        <p class="task">Step through and watch <code>damaged</code> on the rows whose word is "damaged". Then pick the line that turns a damaged parcel into 0.</p>
        ${kit.code(LABEL_CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>word <b>${word == null ? "–" : kit.esc(`"${word}"`)}</b></span><span>damaged <b>${dmg == null ? "–" : dmg ? "True" : "False"}</b></span><span>labels <b>${labels == null ? "–" : "[" + labels.join(", ") + "]"}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say(i))}
        <div class="lpanel">${kit.options(LINE_PICK.map(k => `<code>${kit.esc(LABEL_CODE[k].trim())}</code>`), { picked: pick, correct: LINE_RIGHT })}${pick == null ? "" : kit.feedback(LINE_FB[pick], pick === LINE_RIGHT)}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === LINE_RIGHT) done(); });
    };
    paint();
  }

  /* 8. The fix, and the rerun. */
  function fixIt({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const opts = [
      "Train for longer so the model sees more photos",
      "Lower the learning rate",
      "Compare the cleaned word: row[\"label\"].strip().lower() == \"damaged\", and fail loudly if a class count is 0",
      "Add dropout so the model cannot memorise"
    ];
    const fb = [
      [`Longer training on the same labels teaches "always intact" harder. The gradient was already almost zero from epoch ${firstZeroEpoch}.`, false],
      ["The learning rate was never the problem: the one-batch test learned fine with it. The labels are wrong before training starts.", false],
      [`Right. Here is the rerun with the labels fixed (the stand-in's words were already lower case, so <code>== "damaged"</code> was enough; cleaning protects against the next export). The training labels now count ${FIXED_HISTOGRAM.join(" and ")}.${lossChart(kit, "Fixed run", FIXED)}${accNote(FIXED)}Same network, same optimiser, same learning rate. Only the labels changed. A check such as <code>assert torch.bincount(train_labels, minlength=2).min() > 0</code> before training would have caught it in a second instead of a day.`, true],
      ["Dropout fights memorising. Here the model memorised nothing hard: it found one rule, \"always intact\", that the labels made perfect.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Fix it and rerun</h1>
        <p class="lead">You named the bug: the export says "damaged", the code asks for "Damaged", so every row becomes 0.</p>
        <p class="task">What do you change?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      one(el, paint, RIGHT, done, v => ans = v);
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "Start the full run and read the curves tomorrow",
      "Run the one-batch test and the label histogram first, then start the full run with the gradient norm logged",
      "Start a search over five learning rates overnight"
    ];
    const fb = [
      ["Then a label bug costs you a whole day, as it did your teammate. The cheap checks take minutes and catch the bugs that no amount of training fixes.", false],
      ["Right. Minutes of checks before hours of training. The curves then tell you which of the four shapes you are in, and the gradient log is already there if something jumps.", true],
      ["Five runs with broken labels give five broken curves. Tuning is for a pipeline you already trust.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When curves help, and when they do not</h1>
        <p class="lead"><b>What it is for:</b> any training run. Log train and validation loss every epoch and compare them with the guessing line.</p>
        <p class="lead"><b>When to reach for the checklist:</b> when a run looks wrong. Run its cheap parts before every long run too.</p>
        <p class="lead"><b>When it is not enough:</b> when real use differs from your validation photos (new cameras, new warehouses). The curves only measure the validation photos, so they can look perfect while the model fails in use. Then you need fresh labelled examples from real use.</p>
        <p class="lead"><b>What it costs:</b> logging is almost free. The one-batch test and the histogram take minutes. Skipping them can cost a whole training run per wrong guess.</p>
        <p class="task">A colleague hands you a new training script that will run for ten hours. What do you do first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      one(el, paint, RIGHT, done, v => ans = v);
    };
    paint();
  }

  /* 10. Recognise it in new situations, including one the curves cannot show. */
  const R_OPTS = ["Underfitting", "Overfitting", "Learning rate too high", "Data or label bug", "The curves cannot show this"];
  const CASES = [
    { q: "A loan-default model: train loss falls to 0.02. Validation loss is lowest at epoch 8, then climbs every epoch; validation accuracy peaked at epoch 8.", right: 1,
      ok: "Yes. Train keeps falling, validation turns up, and a gap opens: memorising. Keep the epoch-8 weights (early stopping), add regularization or more data.",
      no: ["Underfitting keeps the train loss high. Here it fell to 0.02: the model fits its training data very well.", null,
        "A too-high learning rate makes the train loss itself jump or rise. Here train falls steadily; only validation turns up.",
        "Validation improved until epoch 8, so the labels do match the inputs: the model learned something real first, then memorised.",
        "The curves show it clearly: train keeps falling while validation turns up after epoch 8. That gap is the sign of memorising."] },
    { q: "A sound classifier: train loss bounces between 0.3 and 0.9 from epoch to epoch and never settles. Halving one setting made it smooth.", right: 2,
      ok: "Yes. A train loss that jumps about on the same data means the steps overshoot. The setting that smoothed it is the learning rate.",
      no: ["Underfitting gives smooth curves that level off high. This train loss jumps between 0.3 and 0.9 on the same data.",
        "Overfitting leaves the train loss falling smoothly. Here the train loss itself jumps.", null,
        "A label bug does not go away when you halve a setting. Halving it made the curve smooth, so the step size was the problem.",
        "The curves do show it: the train loss jumps on data the model has already seen, and a smaller step fixed it."] },
    { q: `A three-way sorter (fragile, standard, heavy) with balanced classes: train and validation loss both sit at ${f2(CHANCE3)} from the first epoch to the last.`, right: 3,
      ok: `Yes. With three balanced classes, guessing scores −ln(1/3) = ${f3(CHANCE3)}. Flat on the guessing line means the inputs tell the model nothing about these labels: check the labels and the loader first.`,
      no: [`Work out the guessing line for three classes: −ln(1/3) = ${f3(CHANCE3)}. The curves never leave it, so nothing at all was learned. A model that is merely too small usually gets at least a little below the line; flat on it from the first epoch points at the labels and the loader first.`,
        `Overfitting first gets below the guessing line, then validation turns up. These curves never leave the line (−ln(1/3) = ${f3(CHANCE3)}).`,
        "A too-high learning rate makes the loss jump about. These sit flat from the first epoch to the last.", null,
        `The curves say a lot here: flat on −ln(1/3) = ${f3(CHANCE3)} means nothing was learned. That points at the labels and the loader.`] },
    { q: "A crop-disease model: both losses fall smoothly and level off together at 0.45 on two balanced classes. A wider network brings both lower.", right: 0,
      ok: "Yes. No gap, both high, smooth: the model cannot even fit its training data. The bigger network helping confirms it was too small.",
      no: [null, "Overfitting opens a gap between train and validation. Here the two level off together.",
        "A too-high learning rate makes the curves jump. These fall smoothly and level off.",
        `Both curves are below guessing (${f3(CHANCE)}), so the labels do match the inputs. And a wider network helped; a bigger model does not fix broken labels.`,
        "The curves show it: high, smooth, no gap, and a bigger network helps. That is a model too small for the task."] },
    { q: "A shelf-photo model: validation accuracy 97%, healthy curves. After the shop installs new ceiling cameras, staff say it is wrong half the time.", right: 4,
      ok: "Yes. The validation photos came from the old cameras, so the curves only measure the old cameras. No curve from that training run can see the new ones. Collect and label photos from the new cameras and evaluate on them.",
      no: ["It scored 97% on the photos it was measured on, so it is not too small for that task. The photos changed, not the model.",
        "Validation was 97% with healthy curves, so there is no gap to see. The failure is on photos from cameras the run never saw.",
        "Healthy curves mean training was stable. The step size cannot explain a failure that starts when the cameras change.",
        "It is a data problem, but not a bug in the run: the labels and the loader were fine, which is why the curves look healthy. Photos from the new cameras were in neither training nor validation, so no curve from that run can show it. Collect and label photos from the new cameras.", null] }
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Read these runs</h1>
        <p class="lead">Five reports from other teams.</p>
        <p class="task">Name the most likely cause of each. Pick again if you change your mind.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(c.q)}</p>${kit.options(R_OPTS, { picked: ans[i], correct: c.right })}${ans[i] == null ? "" : kit.feedback(ans[i] === c.right ? c.ok : c.no[ans[i]], ans[i] === c.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((cs, j) => ans[j] === cs.right)) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can read a run</h1>
      <p class="lead">You matched four curve shapes to their causes against the guessing line, saw a run that fit none of them, and found its bug with a fixed checklist: one-batch test, label histogram, gradient-norm log. The bug was one capital letter, and the curves alone could not name it.</p>
      <p class="lead"><b>Practice:</b> this lesson was the practice. Next time a run looks wrong, run the checklist before you change a setting.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You can now tell whether a network is learning; next you meet a network shaped for images, and every check here still applies to it.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Debugging a run from its loss curves",
    checked: "2026-11-14",
    sources: [
      "https://developers.google.com/machine-learning/crash-course/overfitting/interpreting-loss-curves",
      "https://github.com/google-research/tuning_playbook",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.utils.clip_grad_norm_.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.bincount.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.CrossEntropyLoss.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.Adam.html"
    ],
    interview: [
      {
        q: "A colleague's image classifier has trained for a day and validation accuracy is at chance. Walk me through how you would find out why.",
        good: [
          "Compare the losses with the guessing loss (ln 2 for two balanced classes) to see whether anything was learned at all",
          "Read the shape: train near zero with validation at chance points at a mismatch between training and validation data, not at the model",
          "Run a one-batch overfitting test to rule the model, loss and optimiser in or out",
          "Count the labels in both sets and look at a few examples with their labels",
          "Log the gradient norm to see whether updates are exploding, normal or zero"
        ],
        weak: "Try a different learning rate, a bigger model or more epochs. Each guess costs a full run and none of them fixes broken labels."
      },
      {
        q: "Your training loss keeps falling but validation loss started rising at epoch 10. What is happening, and what do you do?",
        good: [
          "The model is memorising the training set: overfitting",
          "Keep the weights from the epoch with the lowest validation loss (early stopping)",
          "Add regularization such as dropout or weight decay, or get more training data",
          "Check it is not a too-high learning rate: that makes the train loss itself jump or rise"
        ],
        weak: "Train longer because the training loss is still improving. That makes the model worse on new data."
      }
    ],
    screens: [guessing, matchFour, spotIdea, oneBatch, histogram, gradNorm, traceBug, fixIt, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CHARTS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
