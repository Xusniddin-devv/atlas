/* Lesson: dropout, weight decay and early stopping. Story: a ride-hailing app's surge model, trained on last winter
   (holiday weeks included), misfires on this winter's ordinary weekends. Ideas: (1) early stopping: keep a copy of
   the best weights, stop after `patience` epochs without a new best, put the copy back; (2) dropout and weight decay
   slow the slide into memorising, and dropout must be switched off with model.eval() before scoring; (3) none of
   them adds information, and too much makes the model underfit.
   Data, all real, from docs/ai-path/runs/s3-regularization/ (PyTorch on this Mac's CPU, seeded, see env.txt):
   - surge_data.py (+ .out.txt): the made-up surge data set (400 hours of last winter, 600 weekend hours of this one);
   - run_curves.py (+ .out.txt): four 40-epoch runs (plain, dropout 0.5, weight_decay 5.0, both), every epoch logged;
   - misfires.py: confident wrong surge calls per epoch; run_decay_sweep.py: five weight_decay values;
   - early_stop.py: fit() traced line by line with patience 5 (the code screen), and the patience 1 result;
   - dropout_demo.py: one row of hidden values through nn.Dropout(0.5); test_mode.py: dropout left on at test time;
   - broken_restore.py: the broken-on-purpose run (state_dict saved without a copy).
   No model API calls. Lesson-local picture and style: a two-line loss chart with pickable epoch bands and a
   multi-column table (.lx-s3-regularization-*), see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s3-regularization";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-regularization.ipynb";
  const pct = x => `${(x * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const f4 = x => x.toFixed(4);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const argmin = a => a.reduce((b, v, i) => (v < a[b] ? i : b), 0);
  const argmax = a => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);

  /* ---------- Data copied from the runs (docs/ai-path/runs/s3-regularization/*.out.txt) ---------- */
  // surge_data.out.txt
  const DATA = { trainHours: 400, valHours: 600, trainSurge: 0.535, valSurge: 0.328 };
  // run_curves.out.txt (each value is one epoch, 1..40; losses and accuracies measured as described in run_curves.py)
  const RUNS = {"plain":{"train_loss":[0.6853,0.6195,0.5523,0.4805,0.4208,0.3626,0.3299,0.2939,0.2527,0.2283,0.2055,0.193,0.1617,0.1232,0.1094,0.0982,0.0755,0.0615,0.0482,0.0405,0.0356,0.0285,0.0234,0.0192,0.0159,0.0138,0.012,0.0104,0.0093,0.0081,0.0075,0.0068,0.0061,0.0057,0.0051,0.0047,0.0043,0.004,0.0037,0.0034],"val_loss":[0.6777,0.6688,0.623,0.6294,0.5963,0.5753,0.5667,0.5832,0.5824,0.6026,0.6292,0.713,0.6665,0.6935,0.7315,0.7718,0.7991,0.8405,0.8823,0.918,0.9278,0.989,1.0167,1.0587,1.0803,1.0996,1.1328,1.1436,1.1806,1.1968,1.2212,1.2375,1.2554,1.2713,1.291,1.3061,1.3249,1.3389,1.3514,1.365],"val_acc":[0.58,0.5833,0.6617,0.6517,0.7117,0.7333,0.73,0.7367,0.745,0.7333,0.735,0.73,0.72,0.7317,0.7267,0.7183,0.7183,0.7217,0.7233,0.7183,0.725,0.7133,0.7117,0.7117,0.715,0.7167,0.7167,0.715,0.71,0.715,0.7133,0.7117,0.715,0.715,0.715,0.7133,0.715,0.715,0.7133,0.7167],"train_acc":[0.7025,0.745,0.78,0.8125,0.8625,0.8925,0.8825,0.9075,0.925,0.9375,0.945,0.9325,0.96,0.9775,0.9875,0.9825,0.995,0.9975,0.9975,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0],"weight_norm":17.91},"dropout":{"train_loss":[0.6922,0.6568,0.6308,0.6001,0.5774,0.5383,0.5267,0.4868,0.4503,0.438,0.4088,0.3862,0.3813,0.3573,0.3818,0.3674,0.3474,0.3473,0.3432,0.3191,0.3207,0.3357,0.3247,0.2646,0.2816,0.2411,0.2392,0.2811,0.2549,0.2251,0.2119,0.2422,0.2047,0.223,0.1882,0.2345,0.2166,0.1985,0.1889,0.2068],"val_loss":[0.6989,0.6861,0.6759,0.6418,0.6397,0.608,0.5994,0.5936,0.5785,0.5761,0.579,0.5744,0.5758,0.5736,0.58,0.5902,0.5827,0.5841,0.5759,0.5874,0.596,0.6004,0.5917,0.6093,0.6215,0.6128,0.6232,0.633,0.6491,0.6547,0.6665,0.6777,0.6963,0.7175,0.7233,0.7164,0.6943,0.6918,0.7135,0.7131],"val_acc":[0.445,0.5283,0.555,0.6433,0.63,0.67,0.695,0.6967,0.715,0.7233,0.7183,0.7283,0.7367,0.74,0.745,0.7433,0.7383,0.74,0.7233,0.7217,0.72,0.7167,0.7333,0.7333,0.7383,0.7417,0.74,0.7467,0.7417,0.7233,0.7283,0.7267,0.7267,0.7267,0.735,0.7333,0.74,0.7333,0.7233,0.725],"train_acc":[0.585,0.69,0.7075,0.76,0.765,0.8,0.8125,0.84,0.8625,0.87,0.87,0.89,0.895,0.9025,0.9,0.9025,0.905,0.915,0.9175,0.915,0.915,0.9225,0.9275,0.925,0.935,0.94,0.945,0.94,0.9375,0.95,0.95,0.9525,0.9525,0.9575,0.9625,0.96,0.9625,0.965,0.9675,0.9675],"weight_norm":16.27},"decay":{"train_loss":[0.6854,0.6309,0.5791,0.5187,0.4632,0.4102,0.3758,0.3464,0.3156,0.2994,0.2881,0.2815,0.2657,0.2333,0.2305,0.2226,0.2063,0.1899,0.181,0.1789,0.1829,0.1695,0.167,0.1643,0.1592,0.152,0.1558,0.1488,0.1461,0.14,0.1394,0.1472,0.142,0.1374,0.1389,0.1485,0.1481,0.1364,0.1338,0.1378],"val_loss":[0.6817,0.6776,0.6369,0.6262,0.5874,0.5646,0.5526,0.5507,0.5384,0.5427,0.5558,0.5593,0.5759,0.5637,0.558,0.5772,0.5637,0.5724,0.5783,0.5781,0.583,0.5884,0.5893,0.5976,0.6035,0.5981,0.5956,0.5868,0.6009,0.5942,0.5971,0.5924,0.5808,0.6077,0.5911,0.5818,0.5867,0.5867,0.5889,0.5778],"val_acc":[0.555,0.5633,0.6483,0.6367,0.71,0.7367,0.7317,0.7417,0.7467,0.7433,0.7417,0.7533,0.715,0.745,0.7317,0.7317,0.74,0.725,0.725,0.73,0.7383,0.7233,0.7283,0.7267,0.72,0.7117,0.7383,0.7283,0.7233,0.7283,0.7433,0.73,0.725,0.7333,0.7183,0.7367,0.7233,0.7317,0.73,0.7317],"train_acc":[0.7025,0.7175,0.7775,0.8025,0.83,0.875,0.8825,0.8875,0.905,0.9175,0.9125,0.9125,0.925,0.93,0.945,0.9525,0.965,0.965,0.9675,0.97,0.9775,0.98,0.9825,0.9825,0.9775,0.9775,0.985,0.99,0.99,0.98,0.9925,0.9925,0.985,0.9825,0.985,0.995,0.9925,0.9925,0.995,0.9975],"weight_norm":9.57},"both":{"train_loss":[0.6917,0.6624,0.6451,0.6246,0.6048,0.5705,0.5508,0.5073,0.4762,0.4533,0.4261,0.4035,0.3935,0.3702,0.3811,0.3768,0.3609,0.3577,0.3509,0.3424,0.3455,0.348,0.3333,0.3142,0.3291,0.2948,0.3038,0.3197,0.3068,0.288,0.2792,0.2945,0.2805,0.2892,0.2889,0.3112,0.3051,0.2967,0.293,0.3002],"val_loss":[0.7,0.693,0.6902,0.6629,0.6584,0.6269,0.6133,0.6021,0.5771,0.565,0.5573,0.5493,0.5448,0.5418,0.5392,0.54,0.5343,0.5305,0.5279,0.5273,0.5305,0.5276,0.5225,0.5326,0.5324,0.5221,0.5252,0.526,0.5334,0.5331,0.5253,0.5306,0.5316,0.5319,0.5338,0.5312,0.5188,0.5272,0.5233,0.5179],"val_acc":[0.4233,0.5017,0.5,0.6017,0.5917,0.65,0.6733,0.6733,0.7183,0.725,0.735,0.7383,0.7483,0.74,0.75,0.7433,0.745,0.7533,0.74,0.74,0.7283,0.7483,0.7483,0.7417,0.7533,0.75,0.7533,0.74,0.7483,0.7317,0.75,0.7467,0.7467,0.7567,0.745,0.74,0.7433,0.745,0.75,0.7517],"train_acc":[0.565,0.6425,0.6825,0.735,0.7475,0.7825,0.8025,0.8125,0.8425,0.8575,0.86,0.8725,0.8825,0.895,0.8925,0.895,0.9025,0.9,0.905,0.9125,0.9075,0.9175,0.92,0.9225,0.925,0.9175,0.92,0.925,0.9225,0.935,0.93,0.9275,0.925,0.93,0.93,0.9375,0.93,0.93,0.935,0.9325],"weight_norm":6.94}};
  const RUN_SET = { plain: "no regularization", dropout: "dropout 0.5", decay: "weight_decay 5.0", both: "dropout 0.5 + weight_decay 5.0" };
  // misfires.out.txt: [epoch, validation hours called surge with probability >= 0.9 where no surge was needed]
  const MISFIRES = [[1,0],[2,0],[3,0],[4,1],[5,1],[6,1],[7,3],[8,3],[9,3],[10,4],[11,4],[12,3],[13,13],[14,7],[15,13],[16,27],[17,25],[18,25],[19,26],[20,33],[21,37],[22,35],[23,41],[24,37],[25,43],[26,41],[27,41],[28,42],[29,42],[30,45],[31,42],[32,46],[33,44],[34,47],[35,45],[36,47],[37,47],[38,46],[39,47],[40,49]];
  const NO_SURGE_HOURS = 403; // misfires.out.txt, "no_surge_hours"
  // run_decay_sweep.out.txt
  const SWEEP = [{"weight_decay": 0.0, "best_epoch": 7, "best_val_loss": 0.5667, "last_val_loss": 1.365, "last_val_acc": 0.7167, "last_train_acc": 1.0, "weight_norm": 17.91},{"weight_decay": 0.5, "best_epoch": 7, "best_val_loss": 0.5642, "last_val_loss": 1.155, "last_val_acc": 0.7217, "last_train_acc": 1.0, "weight_norm": 15.31},{"weight_decay": 5.0, "best_epoch": 9, "best_val_loss": 0.5384, "last_val_loss": 0.5778, "last_val_acc": 0.7317, "last_train_acc": 0.9975, "weight_norm": 9.57},{"weight_decay": 20.0, "best_epoch": 11, "best_val_loss": 0.5455, "last_val_loss": 0.5635, "last_val_acc": 0.7367, "last_train_acc": 0.8225, "weight_norm": 5.25},{"weight_decay": 50.0, "best_epoch": 11, "best_val_loss": 0.6394, "last_val_loss": 0.6943, "last_val_acc": 0.3283, "last_train_acc": 0.535, "weight_norm": 0.36}];
  // early_stop.out.txt, the two summary lines
  const ES_REC = { 5: { stop: 12, best: 0.5667, after: 0.5667 }, 1: { stop: 4, best: 0.623, after: 0.623 } };
  // early_stop.out.txt trace rows: [line about to run, event (l line, r return), epoch, val_loss, best, bad]
  const TRACE5 = [[1,"l",null,null,null,null],[2,"l",null,null,"inf",0],[3,"l",1,null,"inf",0],[4,"l",1,null,"inf",0],[5,"l",1,0.6777,"inf",0],[6,"l",1,0.6777,"inf",0],[7,"l",1,0.6777,0.6777,0],[2,"l",1,0.6777,0.6777,0],[3,"l",2,0.6777,0.6777,0],[4,"l",2,0.6777,0.6777,0],[5,"l",2,0.6688,0.6777,0],[6,"l",2,0.6688,0.6777,0],[7,"l",2,0.6688,0.6688,0],[2,"l",2,0.6688,0.6688,0],[3,"l",3,0.6688,0.6688,0],[4,"l",3,0.6688,0.6688,0],[5,"l",3,0.623,0.6688,0],[6,"l",3,0.623,0.6688,0],[7,"l",3,0.623,0.623,0],[2,"l",3,0.623,0.623,0],[3,"l",4,0.623,0.623,0],[4,"l",4,0.623,0.623,0],[5,"l",4,0.6294,0.623,0],[9,"l",4,0.6294,0.623,0],[10,"l",4,0.6294,0.623,1],[2,"l",4,0.6294,0.623,1],[3,"l",5,0.6294,0.623,1],[4,"l",5,0.6294,0.623,1],[5,"l",5,0.5963,0.623,1],[6,"l",5,0.5963,0.623,1],[7,"l",5,0.5963,0.5963,0],[2,"l",5,0.5963,0.5963,0],[3,"l",6,0.5963,0.5963,0],[4,"l",6,0.5963,0.5963,0],[5,"l",6,0.5753,0.5963,0],[6,"l",6,0.5753,0.5963,0],[7,"l",6,0.5753,0.5753,0],[2,"l",6,0.5753,0.5753,0],[3,"l",7,0.5753,0.5753,0],[4,"l",7,0.5753,0.5753,0],[5,"l",7,0.5667,0.5753,0],[6,"l",7,0.5667,0.5753,0],[7,"l",7,0.5667,0.5667,0],[2,"l",7,0.5667,0.5667,0],[3,"l",8,0.5667,0.5667,0],[4,"l",8,0.5667,0.5667,0],[5,"l",8,0.5832,0.5667,0],[9,"l",8,0.5832,0.5667,0],[10,"l",8,0.5832,0.5667,1],[2,"l",8,0.5832,0.5667,1],[3,"l",9,0.5832,0.5667,1],[4,"l",9,0.5832,0.5667,1],[5,"l",9,0.5824,0.5667,1],[9,"l",9,0.5824,0.5667,1],[10,"l",9,0.5824,0.5667,2],[2,"l",9,0.5824,0.5667,2],[3,"l",10,0.5824,0.5667,2],[4,"l",10,0.5824,0.5667,2],[5,"l",10,0.6026,0.5667,2],[9,"l",10,0.6026,0.5667,2],[10,"l",10,0.6026,0.5667,3],[2,"l",10,0.6026,0.5667,3],[3,"l",11,0.6026,0.5667,3],[4,"l",11,0.6026,0.5667,3],[5,"l",11,0.6292,0.5667,3],[9,"l",11,0.6292,0.5667,3],[10,"l",11,0.6292,0.5667,4],[2,"l",11,0.6292,0.5667,4],[3,"l",12,0.6292,0.5667,4],[4,"l",12,0.6292,0.5667,4],[5,"l",12,0.713,0.5667,4],[9,"l",12,0.713,0.5667,4],[10,"l",12,0.713,0.5667,5],[11,"l",12,0.713,0.5667,5],[12,"l",12,0.713,0.5667,5],[12,"r",12,0.713,0.5667,5]];
  // dropout_demo.out.txt
  const DROP = { hidden: [0.1548, 0.4218, 0.4368, 0.3353, 0.4643, 0.001, 0.4896, 0.0198],
    call1: [0.3096, 0.8437, 0.8736, 0.6705, 0.0, 0.002, 0.9793, 0.0],
    call2: [0.0, 0.8437, 0.0, 0.6705, 0.0, 0.002, 0.9793, 0.0395],
    evalOut: [0.1548, 0.4218, 0.4368, 0.3353, 0.4643, 0.001, 0.4896, 0.0198] };
  const P_DROP = 0.5;
  // test_mode.out.txt
  const TEST_ON = [{ loss: 0.5467, acc: 0.7333 }, { loss: 0.5293, acc: 0.75 }, { loss: 0.5409, acc: 0.7317 }];
  const TEST_OFF = [{ loss: 0.5179, acc: 0.7517 }, { loss: 0.5179, acc: 0.7517 }];
  // broken_restore.out.txt, the whole output
  const BROKEN_LOG = [
    "epoch  1  val_loss 0.6777  best 0.6777  bad 0", "epoch  2  val_loss 0.6688  best 0.6688  bad 0",
    "epoch  3  val_loss 0.6230  best 0.6230  bad 0", "epoch  4  val_loss 0.6294  best 0.6230  bad 1",
    "epoch  5  val_loss 0.5963  best 0.5963  bad 0", "epoch  6  val_loss 0.5753  best 0.5753  bad 0",
    "epoch  7  val_loss 0.5667  best 0.5667  bad 0", "epoch  8  val_loss 0.5832  best 0.5667  bad 1",
    "epoch  9  val_loss 0.5824  best 0.5667  bad 2", "epoch 10  val_loss 0.6026  best 0.5667  bad 3",
    "epoch 11  val_loss 0.6292  best 0.5667  bad 4", "stopped at epoch 12, restored best weights (val_loss 0.5667)",
    "check after restore: val_loss 0.7130  val_acc 0.7300"];
  const BROKEN_AFTER = 0.713, BROKEN_STOP = 12;

  // fit() from early_stop.py, line for line (line 0 = def). broken_restore.py differs only on line 7 (and prints a log).
  const CODE = [
    "def fit(model, opt, patience):",
    "    best, bad = float(\"inf\"), 0",
    "    for epoch in range(1, 41):",
    "        model.train(); train_one_epoch(model, opt, epoch_seed=epoch)",
    "        model.eval(); val_loss = measure(model, X_va, y_va)[0]",
    "        if val_loss < best:",
    "            best, bad = val_loss, 0",
    "            best_state = copy.deepcopy(model.state_dict())",
    "        else:",
    "            bad += 1",
    "            if bad == patience: break",
    "    model.load_state_dict(best_state)",
    "    return epoch, best"
  ];
  const CODE_BROKEN = CODE.map((l, i) => (i === 7 ? "            best_state = model.state_dict()" : l));

  /* ---------- Derived from the data ---------- */
  const PL = RUNS.plain;
  const EPOCHS = PL.val_loss.length;
  const BEST = argmin(PL.val_loss) + 1; // epoch with the lowest validation loss
  const misAt = e => MISFIRES.find(m => m[0] === e)[1];
  function earlyStop(vals, patience) {
    let best = Infinity, keep = 0, bad = 0;
    for (let e = 1; e <= vals.length; e++) {
      if (vals[e - 1] < best) { best = vals[e - 1]; keep = e; bad = 0; } else if (++bad === patience) return { stop: e, keep, best };
    }
    return { stop: vals.length, keep, best };
  }
  const SUM = Object.keys(RUN_SET).map(k => {
    const r = RUNS[k], b = argmin(r.val_loss);
    return { k, name: RUN_SET[k], bestEpoch: b + 1, bestLoss: r.val_loss[b], lastLoss: r.val_loss[EPOCHS - 1], bestAcc: Math.max(...r.val_acc), lastTrainAcc: r.train_acc[EPOCHS - 1] };
  });
  const SUMK = Object.fromEntries(SUM.map(s => [s.k, s]));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-chart { margin: 16px 0 0; }
      .lx-${ID}-cap { font-size: 13.5px; color: var(--muted); margin: 0 0 6px; }
      .lx-${ID}-plot { position: relative; height: 210px; border-left: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .lx-${ID}-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; }
      .lx-${ID}-plot polyline { fill: none; stroke: var(--ink); stroke-width: 2.5; vector-effect: non-scaling-stroke; }
      .lx-${ID}-plot polyline.tr { stroke: var(--muted); stroke-dasharray: 6 5; stroke-width: 2; }
      .lx-${ID}-bands { position: absolute; inset: 0; display: flex; }
      .lx-${ID}-bands button { flex: 1; min-width: 0; min-height: 44px; margin: 0; padding: 0; border: 0; border-right: 1px dotted var(--line); background: transparent; cursor: pointer; font: inherit; }
      .lx-${ID}-bands button:hover { box-shadow: inset 0 0 0 2px var(--line); }
      .lx-${ID}-bands button:focus-visible { outline: 3px solid var(--ink); outline-offset: -3px; }
      .lx-${ID}-bands button.right { box-shadow: inset 0 0 0 2px var(--good); }
      .lx-${ID}-bands button.wrong { box-shadow: inset 0 0 0 2px var(--bad); }
      .lx-${ID}-ticks { position: relative; height: 22px; font: 500 12.5px var(--mono); color: var(--muted); }
      .lx-${ID}-ticks span { position: absolute; top: 4px; transform: translateX(-50%); }
      .lx-${ID}-key { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 6px 0 0; font-size: 14px; color: var(--ink-2); }
      .lx-${ID}-key svg { width: 30px; height: 10px; vertical-align: middle; margin-right: 6px; }
      .lx-${ID}-key line { stroke: var(--ink); stroke-width: 2.5; }
      .lx-${ID}-key line.tr { stroke: var(--muted); stroke-dasharray: 6 5; stroke-width: 2; }
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 14.5px; }
      .lx-${ID}-tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding-bottom: 6px; }
      .lx-${ID}-tbl th { text-align: left; font-weight: 600; color: var(--muted); font-size: 13px; padding: 6px 6px 6px 0; border-bottom: 1px solid var(--line); vertical-align: bottom; }
      .lx-${ID}-tbl td { padding: 7px 6px 7px 0; border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 14px; }
      .lx-${ID}-tbl td:first-child { font-family: var(--font); }
      .lx-${ID}-tbl tr.on td { font-weight: 700; }
      .lx-${ID}-log { margin: 14px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); font: 500 13px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-vals { display: grid; grid-template-columns: 6.5em repeat(8, minmax(0, 1fr)); gap: 4px; margin: 14px 0 0; font: 500 12.5px var(--mono); }
      .lx-${ID}-vals > span { padding: 6px 2px; text-align: center; border: 1px solid var(--line); overflow-wrap: anywhere; }
      .lx-${ID}-vals > b { font: 600 12.5px var(--font); color: var(--muted); align-self: center; }
      .lx-${ID}-vals > span.z { color: var(--faint); border-style: dashed; }
      .lx-${ID}-opt { text-align: left; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
      .lx-${ID}-check { list-style: none; padding: 0; margin: 12px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-check li { border-bottom: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-check span { padding-top: 11px; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; background: transparent; padding: 13px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -13px; }
      .lx-${ID}-check input:checked { background-color: var(--good); outline-color: var(--good); }
      @media (max-width: 520px) { .lx-${ID}-log { font-size: 11px; padding: 8px; } .lx-${ID}-vals { grid-template-columns: repeat(4, minmax(0, 1fr)); } .lx-${ID}-vals > b { grid-column: 1 / -1; } }
    `;
    document.head.appendChild(s);
  }

  /* A two-line loss chart over epochs 1..n. bands: { size, picked, right } makes epoch bands pickable buttons (data-i). */
  function lossChart(kit, train, val, { bands = null, title = "" } = {}) {
    const n = val.length, top = Math.max(...train, ...val) * 1.05;
    const pt = (v, i) => `${(i + 0.5) / n * 100},${(1 - v / top) * 100}`;
    const line = (a, cls) => `<polyline class="${cls}" points="${a.map(pt).join(" ")}"/>`;
    const nb = bands ? Math.ceil(n / bands.size) : 0;
    const bandHtml = bands ? `<div class="lx-${ID}-bands">${Array.from({ length: nb }, (_, b) => {
      const lo = b * bands.size + 1, hi = Math.min(n, (b + 1) * bands.size);
      const st = bands.picked === b ? (b === bands.right ? "right" : "wrong") : "";
      const attr = b === bands.right ? " data-right" : b === bands.wrong ? " data-wrong" : "";
      return `<button type="button" class="${st}" data-i="${b}"${attr} aria-label="epochs ${lo} to ${hi}"${bands.picked === b ? ' aria-pressed="true"' : ""}></button>`;
    }).join("")}</div>` : "";
    const ticks = [1, 10, 20, 30, 40].filter(t => t <= n).map(t => `<span style="left:${(t - 0.5) / n * 100}%">${t}</span>`).join("");
    return `<div class="lx-${ID}-chart">${title ? `<p class="lx-${ID}-cap">${kit.esc(title)}</p>` : ""}
      <div class="lx-${ID}-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${line(train, "tr")}${line(val, "va")}</svg>${bandHtml}</div>
      <div class="lx-${ID}-ticks" aria-hidden="true">${ticks}</div>
      <div class="lx-${ID}-key"><span><svg viewBox="0 0 30 10" aria-hidden="true"><line class="va" x1="0" y1="5" x2="30" y2="5"/></svg>validation loss (this winter's weekends)</span><span><svg viewBox="0 0 30 10" aria-hidden="true"><line class="tr" x1="0" y1="5" x2="30" y2="5"/></svg>training loss (last winter)</span></div></div>`;
  }
  function tbl(kit, head, rows, { title = "", on = -1 } = {}) {
    return `<table class="lx-${ID}-tbl">${title ? `<caption>${kit.esc(title)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === on ? ' class="on"' : ""}>${r.map(c => `<td>${kit.esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  const bindOpts = (el, fn) => el.querySelectorAll(".lopts button").forEach(b => (b.onclick = () => fn(+b.dataset.i)));

  /* 1. The situation, and by hand: mark where you would have stopped. */
  const BAND = 4;
  function markStop({ el, done, kit }) {
    ensureStyle();
    let picked = null;
    const right = Math.floor((BEST - 1) / BAND), nb = Math.ceil(EPOCHS / BAND), wrongBand = nb - 1;
    const say = b => {
      const lo = b * BAND + 1, hi = Math.min(EPOCHS, (b + 1) * BAND);
      if (b === right) return [`Right. Validation loss is lowest at <b>epoch ${BEST}</b> (${f4(PL.val_loss[BEST - 1])}). After that the training loss keeps falling, from ${f4(PL.train_loss[BEST - 1])} to ${f4(PL.train_loss[EPOCHS - 1])}, while validation loss climbs to ${f4(PL.val_loss[EPOCHS - 1])}. The network is learning last winter's hours by heart, holidays and noise included, and that does not carry over. Count the misfires, confident wrong surge calls: at epoch ${BEST} it was at least 90% sure of a surge that was not needed in ${plural(misAt(BEST), "weekend hour")} out of ${NO_SURGE_HOURS}; by epoch ${EPOCHS}, in ${misAt(EPOCHS)}. Training ${EPOCHS - BEST} more epochs made it more confident and more wrong. This is <b>overfitting</b>, the same gap you met with the electricity curve, now in a network.`, true];
      if (b < right) return [`In epochs ${lo} to ${hi} validation loss is still falling: from ${f4(PL.val_loss[lo - 1])} to ${f4(PL.val_loss[hi - 1])}. The network is still learning things that also hold this winter. Stopping here leaves skill on the table.`, false];
      return [`By epochs ${lo} to ${hi} validation loss has climbed from its lowest, ${f4(PL.val_loss[BEST - 1])}, to ${f4(PL.val_loss[hi - 1])}. Training loss is still falling (${f4(PL.train_loss[hi - 1])}), which is why the training curve alone looks fine. Look for the lowest point of the solid line.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>The surge model that learned last winter by heart</h1>
        <p class="lead">A ride-hailing app turns on surge pricing when it expects more riders than drivers. Its model was trained on ${DATA.trainHours} hours from <b>last winter</b>, including the busy holiday weeks. This winter it keeps calling surges on ordinary weekends, and riders see high prices for no reason. The team logged two losses after every epoch of a ${EPOCHS}-epoch run: on last winter's hours (the <b>training</b> set the model learns from) and on ${DATA.valHours} weekend hours from this winter (the <b>validation</b> set, held back only to check it).</p>
        <p class="lead">This lesson is about three ways to stop a network from learning its training data by heart: early stopping, dropout and weight decay. The hours in this lesson are made up by a seeded script; the training runs on them are real PyTorch runs.</p>
        ${lossChart(kit, PL.train_loss, PL.val_loss, { bands: { size: BAND, picked, right, wrong: wrongBand }, title: `Loss per epoch, ${EPOCHS} epochs (lower is better)` })}
        <p class="task">If you could rewind, where would you have stopped training? Tap that part of the chart (each strip is ${BAND} epochs).</p>
        <div class="lpanel">${picked == null ? "" : kit.feedback(...say(picked))}</div>`;
      el.querySelectorAll(`.lx-${ID}-bands button`).forEach(b => (b.onclick = () => { picked = +b.dataset.i; paint(); if (picked === right) done(); }));
    };
    paint();
  }

  /* 2. Spot the idea: how a program stops at the right place without seeing the future. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const e4 = earlyStop(PL.val_loss, 1);
    const opts = [
      "Stop the first time validation loss goes up",
      "Save a copy of the weights whenever validation loss hits a new low; stop after a few epochs in a row with no new low; then load the saved copy",
      `Always train for ${BEST} epochs, since that was best last time`,
      "Stop when the training loss gets close to zero"
    ];
    const fb = [
      [`Look at epoch ${e4.stop}: validation loss went up (${f4(PL.val_loss[e4.keep - 1])} to ${f4(PL.val_loss[e4.stop - 1])}) and then fell again for ${BEST - e4.stop} more epochs. Curves wobble. One bad epoch is not proof that the best is behind you.`, false],
      [`Right. That is <b>early stopping</b>. The copy means you never lose the best weights, even if you train past them. "A few epochs in a row" is a setting called <b>patience</b>: how many epochs without a new low you wait before giving up. Validation loss decides, never training loss.`, true],
      [`The best epoch is not a property of the problem. It moves when the data, the learning rate or the model changes. With dropout added, the same network was best at epoch ${SUMK.dropout.bestEpoch}, not ${BEST}. The program has to watch validation loss on every run.`, false],
      [`Near-zero training loss is the sign of memorising, not of a good stop. Here training loss was down to ${f4(PL.train_loss[19])} at epoch 20, when validation loss was already ${f4(PL.val_loss[19])}, far above its best.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Stopping without seeing the future</h1>
        <p class="lead">You chose epoch ${BEST} after seeing all ${EPOCHS} epochs. A training program sees one epoch at a time. At epoch ${BEST + 1} it only knows that validation loss just rose, from ${f4(PL.val_loss[BEST - 1])} to ${f4(PL.val_loss[BEST])}. By then the weights of epoch ${BEST} have already been changed.</p>
        <p class="task">What rule lets a program end up with the epoch-${BEST} weights on its own?</p>
        <div class="lpanel">${ask(kit, opts.map(o => `<span class="lx-${ID}-opt">${kit.esc(o)}</span>`), 1, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (i === 1) done(); });
    };
    paint();
  }

  /* 3. Use it with predictions: patience 1, then patience 5, on the real curve. */
  function patience({ el, done, kit }) {
    ensureStyle();
    const SHOW = 14;
    const PS = [1, 5];
    let q = 0, wrong = null;
    const optsFor = p => {
      const r = earlyStop(PL.val_loss, p);
      const cands = [[r.stop, r.keep], [r.stop, r.stop], [BEST + 1, BEST], [BEST + p, BEST], [BEST + p + 1, BEST]];
      const seen = new Set(), uniq = [];
      for (const c of cands) { const k = c.join(); if (!seen.has(k)) { seen.add(k); uniq.push(c); } }
      const list = uniq.slice(0, 4);
      const at = p % list.length; // where the right answer sits, so it is not always first
      const right = list.shift();
      list.splice(at, 0, right);
      return { r, list, right: at };
    };
    const why = (p, r, [s, k]) => {
      if (k === s && s === r.stop) return `It does stop at epoch ${s}, but it does not keep epoch ${s}'s weights. Epoch ${s} was a worse epoch; that is why it counted against patience. It loads the saved copy from epoch ${r.keep}.`;
      if (s > r.stop && k === r.keep && p > 1) return `One count off. After the new low at epoch ${r.keep}, count the epochs that are not new lows: the counter reaches ${p} at epoch ${r.stop}, and it stops right there.`;
      if (s > r.stop) return `You looked ahead. The program cannot know epoch ${BEST} is coming. Count from the start: after a new low, how many epochs in a row without a new low does it take to reach ${p}?`;
      return `Count again from epoch 1. Each epoch is a new low (counter back to 0) or not (counter + 1). It stops the moment the counter reaches ${p}.`;
    };
    const paint = () => {
      const fin = q >= PS.length;
      const p = PS[Math.min(q, PS.length - 1)];
      const { list, right } = optsFor(p);
      const r1 = earlyStop(PL.val_loss, 1), r5 = earlyStop(PL.val_loss, 5);
      el.innerHTML = `<h1>Predict where it stops</h1>
        <p class="lead">The same run, now with early stopping. The rule: a new lowest validation loss saves a copy and resets a counter to 0; any other epoch adds 1; when the counter reaches the patience, stop and load the copy. The first ${SHOW} epochs:</p>
        ${tbl(kit, ["epoch", "validation loss"], PL.val_loss.slice(0, SHOW).map((v, i) => [i + 1, f4(v)]), { title: `Validation loss, plain run` })}
        ${fin ? "" : `<p class="task">With <b>patience ${p}</b>, at which epoch does training stop, and whose weights does it keep?</p>`}
        <div class="lpanel">${q >= 1 ? kit.feedback(`Patience 1: it stopped at epoch ${r1.stop} and kept epoch ${r1.keep} (validation loss ${f4(r1.best)}). The real run agreed (${f4(ES_REC[1].best)}). One wobble at epoch ${r1.stop} ended training ${BEST - r1.stop} epochs before the real best at epoch ${BEST}, and kept weights from ${BEST - r1.keep} epochs before it.`, true) : ""}
        ${fin ? kit.feedback(`Patience ${PS[1]}: it stopped at epoch ${r5.stop} and kept epoch ${r5.keep}, validation loss ${f4(r5.best)}, the lowest of the whole ${EPOCHS}-epoch run. The real PyTorch run stopped at epoch ${ES_REC[5].stop} with ${f4(ES_REC[5].best)} too, and saved ${EPOCHS - r5.stop} epochs of training. Patience is a trade: too small and a wobble stops you early, too large and you pay for epochs you will throw away.`, true) : ""}
        ${fin ? "" : kit.options(list.map(([s, k]) => `stop at epoch ${s}, keep epoch ${k}`), { picked: wrong, correct: right })}
        ${!fin && wrong != null ? kit.feedback(why(p, optsFor(p).r, list[wrong]), false) : ""}</div>`;
      bindOpts(el, i => { if (i !== optsFor(PS[q]).right) { wrong = i; paint(); return; } wrong = null; q++; paint(); if (q >= PS.length) done(); });
    };
    paint();
  }

  /* 4. What dropout does to one row of hidden values. */
  function dropoutMask({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const kept = DROP.call1.map((v, i) => (v !== 0 ? i : -1)).filter(i => i >= 0);
    const zeroed = DROP.hidden.length - kept.length;
    const k0 = kept[1];
    const opts = [`It stays ${DROP.hidden[k0]}`, `It becomes ${DROP.call1[k0]}`, `It becomes ${(DROP.hidden[k0] / 2).toFixed(4)}`, "It gets a new random value"];
    const RIGHT = 1;
    const row = (label, vals) => `<b>${kit.esc(label)}</b>${vals.map(v => `<span class="${v === 0 ? "z" : ""}">${v === 0 ? "0" : v}</span>`).join("")}`;
    const fb = [
      [`Then the next layer would get a smaller total than usual on every training step, and a larger one at test time when nothing is dropped. Look at the row again: ${DROP.hidden[k0]} did not stay.`, false],
      [`Right: twice as big (the last digit differs because both numbers are rounded). With <code>p = ${P_DROP}</code> each value is zeroed with probability ${P_DROP}, and the survivors are multiplied by 1/(1 − p) = ${1 / (1 - P_DROP)}. On average the next layer sees the same total as without dropout, so nothing has to change at test time. A second call on the same row zeroed different values. In <b>eval mode</b> the layer passes the values through untouched.${`<div class="lx-${ID}-vals">${row("call 2", DROP.call2)}${row("eval mode", DROP.evalOut)}</div>`} Each training step trains a different thinned network, so no neuron can count on one partner always being there. That is <b>dropout</b>.`, true],
      [`Halving would make things worse: the zeros already shrink the total, and halving the rest shrinks it again. Dropout does the opposite to the survivors.`, false],
      [`Compare the row: every value that is not zero is a fixed multiple of the one above it. Only the choice of which values to zero is random.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What dropout does to a layer</h1>
        <p class="lead">A new layer goes into the network: <code>nn.Dropout(p=${P_DROP})</code>, after each hidden layer. Row "in": 8 real values that the first hidden layer produced for one training hour. Row "call 1": what the dropout layer passed on, in training mode.</p>
        <div class="lx-${ID}-vals">${row("in", DROP.hidden)}${row("call 1", DROP.call1)}</div>
        <p class="lead">${plural(zeroed, "value")} of ${DROP.hidden.length} became 0 this time.</p>
        <p class="task">What happened to the value ${DROP.hidden[k0]} (the second one that was not zeroed)?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 5. By hand, part 2: dropout left on at test time. */
  function dropoutAtTest({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const minOn = Math.min(...TEST_ON.map(t => t.acc)), maxOn = Math.max(...TEST_ON.map(t => t.acc));
    const opts = [
      "The same accuracy as with dropout off, every time",
      "Higher accuracy: dropout fights overfitting, so it helps at test time too",
      "Lower or equal accuracy, and a different number each time",
      "An error: dropout layers refuse to run outside training"
    ];
    const RIGHT = 2;
    const result = tbl(kit, ["scored with", "validation loss", "validation accuracy"],
      [...TEST_ON.map((t, i) => [`dropout on, try ${i + 1}`, f4(t.loss), pct(t.acc)]), ...TEST_OFF.map((t, i) => [`model.eval(), try ${i + 1}`, f4(t.loss), pct(t.acc)])], { title: "Validation set, the same trained network" });
    const fb = [
      ["In training mode the dropout layer keeps zeroing values at random, on every call, test or not. The network you score is a different thinned one each time.", false],
      ["Dropout helps by changing how the weights are trained. At test time you want the full network, the one all those thinned networks trained together. Random holes in it only add noise.", false],
      [`Right. The real run:${result}With dropout on, the accuracy moved between ${pct(minOn)} and ${pct(maxOn)} and the loss was higher every time. After <code>model.eval()</code> the dropout layers pass values through and the score is the same twice: ${pct(TEST_OFF[0].acc)}. It is the same switch you used for batch norm. Note that <code>model.eval()</code> does not turn off gradient tracking; that is <code>torch.no_grad()</code>, a separate thing.`, true],
      ["Nothing stops it. A dropout layer in training mode runs anywhere. That is what makes this bug quiet: no error, just worse and jumpy numbers.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Dropout on at test time</h1>
        <p class="lead">The team trains the surge network with dropout for ${EPOCHS} epochs (plus weight decay, which you meet on the next screen). Then someone scores it on this winter's weekend hours three times in a row, but forgets to call <code>model.eval()</code>, so the model is still in training mode.</p>
        <p class="task">Predict what the three scores look like, compared with scoring after <code>model.eval()</code>.</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Weight decay with AdamW: pick the strength. */
  function decay({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const bestI = argmin(SWEEP.map(s => s.best_val_loss));
    const big = SWEEP[SWEEP.length - 1], none = SWEEP[0];
    const lr = 0.001;
    const shrink = (lr * SWEEP[bestI].weight_decay * 100).toFixed(1);
    const fbFor = i => {
      const s = SWEEP[i];
      if (i === bestI) return [`Right: the lowest validation loss of the five, ${f4(s.best_val_loss)}. The weights ended ${(none.weight_norm / s.weight_norm).toFixed(1)} times smaller than with no decay, and the network can still fit last winter (${pct(s.last_train_acc)} training accuracy). Choosing the strength by validation is the same move you made for the L2 penalty in the electricity lesson.`, true];
      if (s.weight_decay === 0) return [`No decay: training accuracy ${pct(s.last_train_acc)}, so it memorised every hour, and its lowest validation loss, ${f4(s.best_val_loss)}, is worse than ${f4(SWEEP[bestI].best_val_loss)}.`, false];
      if (i < bestI) return [`Too weak to matter much: weights ${s.weight_norm} against ${none.weight_norm} with none, training accuracy still ${pct(s.last_train_acc)}, best validation loss ${f4(s.best_val_loss)}.`, false];
      if (s === big) return [`Too strong. The weights shrank to ${s.weight_norm} and training accuracy fell to ${pct(s.last_train_acc)}, exactly the share of last winter's hours that had a surge (${pct(DATA.trainSurge)}). It now calls surge for every hour: it cannot even fit the training data. That is <b>underfitting</b>, caused by the regularizer.`, false];
      return [`Close, but its best validation loss (${f4(s.best_val_loss)}) is higher than ${f4(SWEEP[bestI].best_val_loss)}, and training accuracy has started to drop (${pct(s.last_train_acc)}): the decay is beginning to hold back real learning.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>Weight decay: shrink every weight a little</h1>
        <p class="lead">Weight decay is the L2 idea built into the optimizer. In PyTorch's <code>torch.optim.AdamW</code>, each step first shrinks every weight: <code>w ← w − lr × weight_decay × w</code>. With <code>lr = ${lr}</code> and <code>weight_decay = ${SWEEP[bestI].weight_decay}</code> that is ${shrink}% per step. A weight stays large only if the gradient keeps pushing it back. Five runs of the plain network, ${EPOCHS} epochs each. "Size of weights" is the L2 length of all the weights taken as one long vector.</p>
        ${tbl(kit, ["weight_decay", "size of weights at the end", "training accuracy at the end", "lowest validation loss"], SWEEP.map(s => [s.weight_decay, s.weight_norm, pct(s.last_train_acc), f4(s.best_val_loss)]), { on: ans === bestI ? bestI : -1 })}
        <p class="task">Which weight_decay would you ship?</p>
        <div class="lpanel">${kit.options(SWEEP.map(s => String(s.weight_decay)), { picked: ans, correct: bestI, num: true })}${ans == null ? "" : kit.feedback(...fbFor(ans))}
        ${ans === bestI ? `<p class="lead">Use <code>AdamW</code>, not <code>Adam</code>, for this. By default, Adam's <code>weight_decay</code> adds the penalty to the gradient, where Adam's per-weight scaling changes its strength; AdamW applies the shrink directly ("decoupled"). The defaults differ too: <code>weight_decay=0</code> for Adam, <code>0.01</code> for AdamW.</p>` : ""}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (i === bestI) done(); });
    };
    paint();
  }

  /* 7. What did dropout and weight decay change? The four runs side by side. */
  function compare({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const p = SUMK.plain, d = SUMK.dropout, b = SUMK.both;
    const accs = SUM.map(s => s.bestAcc);
    const opts = [
      "They raised the best validation accuracy a lot",
      "They slowed the slide after the best epoch, so a late stop costs far less",
      "They made training reach its best in fewer epochs",
      "Nothing: the four runs ended the same"
    ];
    const RIGHT = 1;
    const fb = [
      [`Look at the last column: the best accuracies are between ${pct(Math.min(...accs))} and ${pct(Math.max(...accs))}. That is a small gain. None of the runs can learn what the features do not show.`, false],
      [`Right. Without help, validation loss went from ${f4(p.bestLoss)} to ${f4(p.lastLoss)} by epoch ${EPOCHS}. With both, the run was still at its best at epoch ${b.bestEpoch} (${f4(b.bestLoss)}). Dropout and weight decay make memorising slower and harder; early stopping picks the moment. They work together. And notice the ceiling: no setting got far past ${pct(Math.max(...accs))}. To go higher you need more or better data, not more regularization.`, true],
      [`The opposite: with dropout the best epoch came later (${d.bestEpoch} against ${p.bestEpoch}). A network that sees a different thinned version each step learns more slowly, so it needs more epochs.`, false],
      [`The last-epoch column says otherwise: ${SUM.map(s => f4(s.lastLoss)).join(", ")}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What did the two regularizers buy?</h1>
        <p class="lead">The same network, ${EPOCHS} epochs, four settings, no early stopping ("val." means validation):</p>
        ${tbl(kit, ["setting", "best epoch", "lowest val. loss", `val. loss at epoch ${EPOCHS}`, "best val. accuracy"], SUM.map(s => [s.name, s.bestEpoch, f4(s.bestLoss), f4(s.lastLoss), pct(s.bestAcc)]))}
        <p class="task">What did dropout and weight decay mainly change?</p>
        <div class="lpanel">${ask(kit, opts.map(o => `<span class="lx-${ID}-opt">${kit.esc(o)}</span>`), RIGHT, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The early-stopping loop in PyTorch: a stepped replay of the traced run (patience 5). */
  const FR = (() => {
    const fr = [];
    TRACE5.forEach((r, k) => {
      const [ln, ev, epoch, vl, best, bad] = r;
      if (ev === "l" && ln === 2 && epoch == null) fr.push({ ln: 2, epoch, vl, best, bad, kind: "start" });
      else if (ev === "l" && (ln === 7 || ln === 10)) fr.push({ ln, epoch, vl, best, bad, kind: ln === 7 ? "new" : "worse" });
      else if (ev === "l" && ln === 11) fr.push({ ln, epoch, vl, best, bad, kind: "load" });
      else if (ev === "r") fr.push({ ln: 12, epoch, vl, best, bad, kind: "end" });
      void k;
    });
    return fr;
  })();
  const PAT = 5; // early_stop.py, the traced run
  const showBest = b => (b === "inf" ? "inf" : f4(b));
  const sayFrame = f => {
    if (f.kind === "start") return "<code>best</code> starts at infinity, so the first epoch is always a new low. <code>bad</code> counts epochs in a row without a new low.";
    if (f.kind === "new") return `Epoch ${f.epoch}: validation loss ${f4(f.vl)} is a new low. <code>best</code> is now ${f4(f.best)}, <code>bad</code> back to 0, and the <code>copy.deepcopy</code> line saves a full copy of the weights.`;
    if (f.kind === "worse") return `Epoch ${f.epoch}: ${f4(f.vl)} is not below ${f4(f.best)}. <code>bad</code> is now ${f.bad}${f.bad === PAT ? ", equal to the patience, so <code>break</code> leaves the loop." : ` of ${PAT}. Keep going.`}`;
    if (f.kind === "load") return `Out of the loop at epoch ${f.epoch}. <code>load_state_dict</code> copies the saved epoch-${earlyStop(PL.val_loss, PAT).keep} weights back into the model.`;
    return `<code>fit</code> returns epoch ${f.epoch} and best ${f4(f.best)}. Measured again after the load, the model scored ${f4(ES_REC[5].after)}: the copy worked. Note the first two lines inside the loop: <code>model.train()</code> before training, <code>model.eval()</code> before measuring, every epoch.`;
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>Early stopping in PyTorch</h1>
        <p class="lead">PyTorch's training loop is your own code, so early stopping is a few lines in it. <code>train_one_epoch</code> runs one pass over last winter; <code>measure</code> returns validation loss and accuracy. This replays the real run with <code>patience = 5</code>, one frame per decision.</p>
        <p class="task">Step through to the end. Watch <code>bad</code> and the line that saves the weights.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>epoch <b>${f.epoch == null ? "–" : f.epoch}</b></span><span>val_loss <b>${f.vl == null ? "–" : f4(f.vl)}</b></span><span>best <b>${showBest(f.best)}</b></span><span>bad <b>${f.bad}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 9. Broken on purpose: the restored "best" weights are not the best. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const epochLoss = PL.val_loss[BROKEN_STOP - 1];
    const Q = [
      { right: 1, opts: ["model.eval(); val_loss = measure(...)", "best_state = model.state_dict()", "if bad == patience: break", "model.load_state_dict(best_state)"],
        fb: [
          ["<code>model.eval()</code> is right where it is: scoring in eval mode is what makes the logged validation losses trustworthy. The log itself looks healthy. The problem is what got restored.", false], null,
          [`The stop is fine: ${plural(5, "epoch")} without a new low after epoch ${BEST}, so it stopped at ${BROKEN_STOP}, exactly as in the correct run.`, false],
          ["Loading is the symptom, not the cause. <code>load_state_dict</code> faithfully copies in whatever <code>best_state</code> holds. The question is what <code>best_state</code> held by then.", false]] },
      { right: 2, opts: ["Call model.eval() before load_state_dict", "Raise the patience to 10", "best_state = copy.deepcopy(model.state_dict())", "Save best_state after the loop ends"],
        fb: [
          ["The model is already in eval mode for the check. Eval mode changes how dropout and batch norm behave; it does not change which weights are in the model.", false],
          [`A longer run would let the live weights drift even further from epoch ${BEST}, so the "best" copy would be even worse.`, false], null,
          ["After the loop the weights are the last epoch's. Saving then is the bug, made explicit.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>The best weights that were not the best</h1>
        <p class="lead">A teammate wrote the early-stopping loop with one line different from yours. The run's real output:</p>
        <div class="lx-${ID}-log">${BROKEN_LOG.map(kit.esc).join("\n")}</div>
        <p class="lead">The log promised validation loss ${f4(ES_REC[5].best)}. The check measured ${f4(BROKEN_AFTER)}, which is exactly epoch ${BROKEN_STOP}'s loss in the plain run (${f4(epochLoss)}). The model kept the <b>last</b> weights, not the best.</p>
        ${kit.code(CODE_BROKEN, stage === 0 ? -1 : 7)}
        ${stage < 2 ? `<p class="task">${stage === 0 ? "Which line causes it?" : "The <code>best_state</code> line it is. What is the fix?"}</p>` : ""}
        <div class="lpanel">${stage === 1 && ans == null ? kit.feedback(`Right. PyTorch's docs say <code>state_dict()</code> returns a shallow copy that holds <b>references</b> to the module's parameters. It is like <code>const saved = obj</code> in JavaScript: both names point at the same object. So <code>best_state</code> points at the live weights, and every later optimizer step changes the "saved best" too.`, true) : ""}
        ${stage < 2 ? ask(kit, q.opts.map(o => `<code>${kit.esc(o)}</code>`), q.right, ans, q.fb) : kit.feedback(`Right. <code>copy.deepcopy</code> makes a real snapshot that later training cannot touch. That is the line in your version, and the correct run restored ${f4(ES_REC[5].after)}.`, true)}</div>`;
      bindOpts(el, i => {
        ans = i;
        if (i === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 10. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const big = SWEEP[SWEEP.length - 1];
    const opts = [
      "Team A: training accuracy 100%, validation 72%, validation loss rising since epoch 7 of 40",
      "Team B: training accuracy 64%, validation 63%, both still creeping up at the last epoch",
      "Team C: validation loss turns up after a few epochs, and one full run takes six hours"
    ];
    const RIGHT = 1;
    const fb = [
      ["Team A is the textbook case: a large train-versus-validation gap and a validation curve going the wrong way. Early stopping, dropout and weight decay are exactly for this.", false],
      [`Right. Team B is not memorising: the model cannot even fit the training data well yet. That is underfitting, and regularizing pushes it further down, as weight_decay ${big.weight_decay} did (training accuracy ${pct(big.last_train_acc)}). Train longer, use a bigger model or better features, then regularize if a gap appears.`, true],
      ["Team C is overfitting: validation loss turns up while training goes on. Dropout and weight decay fit, and early stopping gains twice: a better model, and hours of training it can skip.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for regularization</h1>
        <p class="lead"><b>What it is:</b> ways to stop a model from fitting its training data much better than new data. <b>Reach for it</b> when training keeps improving while validation gets worse. Use early stopping on almost any run you can validate, dropout in large networks, and AdamW weight decay tuned on validation.</p>
        <p class="lead"><b>Not</b> when the model underfits, and not as a fix for missing information: more or better data beats any regularizer. <b>Costs:</b> a validation set you hold back and score often. Dropout slows learning, so you need more epochs. Each method adds a setting to tune. Forgetting <code>model.eval()</code> gives quietly worse answers.</p>
        <p class="task">Which team should <b>not</b> add dropout or weight decay right now?</p>
        <div class="lpanel">${ask(kit, opts.map(o => `<span class="lx-${ID}-opt">${kit.esc(o)}</span>`), RIGHT, ans, fb)}</div>`;
      bindOpts(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 11. Recognise it in new situations. */
  const CASES = [
    ["A shop's product-photo classifier reaches 99% on training photos and 81% on new ones. Validation loss is lowest at epoch 5 of a 50-epoch run.", true,
      "Yes. Training far better than validation, and the best epoch long gone by the end: stop early with a saved copy, and try dropout and weight decay, tuned on validation.",
      "This is the gap from the surge chart: training keeps improving after validation has turned. Early stopping alone would keep the epoch-5 weights; dropout and weight decay would slow the slide."],
    ["A clinic's no-show predictor gives slightly different scores for the same patient each time the service is called. The network has dropout layers.", true,
      "Yes, the eval switch. The service runs the model in training mode, so dropout zeroes different values on every call. Call model.eval() once after loading the model.",
      "Random answers for the same input from a model with dropout is the test-time trap: dropout is still on. One model.eval() after loading fixes it; no retraining needed."],
    ["A team tried every dropout and weight-decay setting. Validation accuracy tops out near 76% each time; the business needs 90%. Training accuracy is 93%.", false,
      "No. Regularization stops a model from memorising; it cannot teach it what the features do not show. The surge runs hit the same kind of ceiling. Get more or better data or features.",
      "Every setting already lands at the same ceiling, so a new setting will too. The missing 14 points are information the data does not carry. Regularization trades memorising for generalising; it does not add knowledge."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is regularization the fix?</h1>
        <p class="lead">Three problems from other teams. "Regularization" here means early stopping, dropout, weight decay, and the <code>model.eval()</code> switch that goes with dropout.</p>
        <p class="task">For each one, is it the fix? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => (b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      })));
    };
    paint();
  }

  /* 12. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const r5 = earlyStop(PL.val_loss, 5);
    const wd50 = SWEEP[SWEEP.length - 1];
    const checks = [
      `In the plain run, training loss falls on every epoch and ends near ${PL.train_loss[EPOCHS - 1].toFixed(3)}, while validation loss is lowest around epoch ${BEST} and passes ${Math.floor(PL.val_loss[EPOCHS - 1] * 10) / 10} by epoch ${EPOCHS}.`,
      `Early stopping with patience 5 stops at epoch ${r5.stop}, and the restored model scores the same validation loss as its best epoch.`,
      "Scoring the dropout network three times in training mode prints three different numbers; after model.eval(), the same number twice.",
      `With weight_decay ${wd50.weight_decay}, training accuracy drops to about the share of surge hours: the model calls surge everywhere.`,
      "The broken loop (state_dict without a copy) restores a validation loss that matches the stop epoch, not the best one."
    ];
    el.innerHTML = `<h1>You can stop it memorising</h1>
      <p class="lead">You marked where the surge model began memorising, turned that into early stopping with a saved copy and patience, saw dropout zero and rescale a layer, picked a weight decay by validation, caught dropout left on at test time, and found a "best" copy that was only a reference.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a> and run the same experiments.` : "The notebook for this lesson is on its way. In it you run these same experiments in PyTorch."} What you should see (your numbers may differ slightly from ours):</p>
      <ul class="lx-${ID}-check">${checks.map((c, i) => `<li><label><input type="checkbox" id="lx-${ID}-ck${i}"><span>${kit.esc(c)}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You now read one kind of bad curve, overfitting; next you diagnose the others from their curves with a fixed checklist.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Dropout, weight decay and early stopping",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Dropout.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.AdamW.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.Adam.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Module.html",
      "https://docs.pytorch.org/docs/2.15/notes/autograd.html",
      "https://jmlr.org/papers/v15/srivastava14a.html",
      "https://arxiv.org/abs/1711.05101"
    ],
    interview: [
      {
        q: "Your model gets 99% training accuracy and 70% on validation, and validation loss starts rising at epoch 5 of a 50-epoch run. Walk me through what you change.",
        good: [
          "Add early stopping: track validation loss each epoch, keep a deep copy of the best weights, stop after a patience of a few epochs, restore the copy",
          "Add dropout and weight decay (AdamW), and choose their strengths on the validation set",
          "Make sure validation is scored in eval mode, and training in train mode",
          "If every setting hits the same ceiling, get more or better data instead of more regularization"
        ],
        weak: "Train longer or use a bigger model. That makes the memorising worse; the curve already says the extra epochs hurt."
      },
      {
        q: "After deployment, the same request gets slightly different predictions each time, and accuracy is below what you measured offline. What do you suspect?",
        good: [
          "The model is still in training mode, so dropout zeroes random values on every call",
          "Call model.eval() after loading; it also switches batch norm layers to their evaluation behaviour",
          "model.eval() does not stop gradient tracking; wrap inference in torch.no_grad() or inference mode as well",
          "Add a test that two identical calls return identical outputs"
        ],
        weak: "Fix the random seed. That hides the symptom and still serves a thinned, worse network."
      }
    ],
    screens: [markStop, spotIdea, patience, dropoutMask, dropoutAtTest, decay, compare, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
