/* Lesson: fine-tune BERT for classification. Story: a university IT helpdesk wants incoming tickets routed to the
   accounts, Wi-Fi or printing team automatically.
   Ideas: (1) fine-tuning = a pretrained BERT body plus a new, randomly started classifier head with one output per
   label, all trained on your labelled examples with the Hugging Face Trainer; (2) the two setup errors that break
   it: a label count that does not match the labels (crash), and a learning rate far too big (flat loss, one team for
   every ticket).
   Data, all real, from docs/ai-path/runs/s4-finetune-bert/ (run on 2026-11-14, Apple M1 CPU, see env.txt):
   - tickets.py: the 72 training tickets and the 20 test tickets the learner labels (written by the lesson author);
   - finetune.py run three times: good.out.txt (num_labels 3, learning rate 1e-4, 8 epochs), two-labels.out.txt
     (num_labels 2: IndexError), lr-too-high.out.txt (learning rate 1e-2: flat loss). Numbers below are the
     Trainer's own printed log dicts and the script's "##" JSON lines, copied unaltered.
   No recorded model calls (nothing here is LLM output).
   Lesson-local style: ticket rows and a monospace log block (.lx-s4-finetune-bert-*), see ensureStyle(). */
(() => {
  const ID = "s4-finetune-bert";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pct = p => `${Math.round(p * 100)}%`;
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s4-finetune-bert.ipynb";

  /* ---------- Data copied from the runs ---------- */
  const TEAMS = ["accounts", "wifi", "printing"]; // tickets.py TEAMS, label ids 0, 1, 2
  const TEAM_NAME = { accounts: "Accounts", wifi: "Wi-Fi", printing: "Printing" };
  const TRAIN_PER_TEAM = [24, 24, 24]; // good.out.txt "setup" line
  const BATCH = 8; // finetune.py per_device_train_batch_size
  // tickets.py TEST (text, label) plus the helpdesk's reason, written for the lesson's feedback
  const TEST = [
    ["I typed my password wrong and now I am locked out of everything.", 0, "a lock after wrong passwords is on the account; nothing in the network or a printer is broken."],
    ["The Wi-Fi in the reading room disconnects every ten minutes.", 1, "the connection itself keeps dropping, and the wireless network is theirs."],
    ["The printer in the history building is out of paper again.", 2, "paper in a printer is the printing team's job."],
    ["I cannot log in to the campus Wi-Fi since I changed my password.", 0, "the Wi-Fi itself works; it rejects the login because the password changed, and passwords belong to accounts."],
    ["My print credit did not go up after I paid.", 2, "the print balance is run by the printing team, like the training ticket about adding printing credit."],
    ["The internet is very slow in residence block D.", 1, "a slow connection in a building is a network problem."],
    ["Please create an account for our new lab technician.", 0, "new logins are made by the accounts team."],
    ["The library copier jams on every second page.", 2, "copiers and paper jams belong to the printing team."],
    ["My laptop cannot see any wireless networks in the sports hall.", 1, "no network in sight means no signal there: a Wi-Fi problem."],
    ["The two-factor prompt never appears on my phone.", 0, "two-factor sign-in is part of the account."],
    ["I sent my essay to print but nothing came out.", 2, "a job that never prints is stuck in the print queue."],
    ["Online lectures keep buffering when I am in the dorm.", 1, "buffering video is a slow connection in that building."],
    ["The printer asks me to sign in and says my username is unknown.", 0, "the printer is fine; it cannot find the username, which is an account problem."],
    ["How do I get my account back after it expired?", 0, "an expired account is renewed by the accounts team."],
    ["The scanner sends empty files to my email.", 2, "the scanner is part of the copier, which the printing team looks after."],
    ["There is no connection in the new seminar rooms.", 1, "no connection in a room is a network coverage problem."],
    ["The printer prints faint, hard-to-read text.", 2, "faint print is toner or the printer itself."],
    ["My username is not accepted on the guest Wi-Fi page.", 0, "the guest page is up and answering; it is the username that is refused, which is an account problem."],
    ["Web pages load halfway and then stop in the canteen.", 1, "pages that stop loading in one place point to the network there."],
    ["Staples got stuck inside the copier in room A12.", 2, "something stuck in a copier is the printing team's job."]
  ];
  const CLOSE = [3, 12, 17]; // tickets.py WHY: the tickets that name one team's thing but belong to another

  // good.out.txt: "params" line
  const PARAMS = { total: 11171331, head: 771 };
  // good.out.txt: "predict" line, when "before" (probabilities for accounts, wifi, printing)
  const BEFORE = { accuracy: 0.35, p: [[0.269,0.281,0.449],[0.242,0.308,0.45],[0.247,0.323,0.431],[0.245,0.332,0.423],[0.268,0.303,0.429],[0.266,0.313,0.42],[0.287,0.294,0.419],[0.258,0.319,0.423],[0.274,0.315,0.411],[0.27,0.271,0.46],[0.27,0.282,0.448],[0.249,0.305,0.446],[0.26,0.297,0.444],[0.292,0.277,0.431],[0.267,0.271,0.462],[0.254,0.315,0.431],[0.262,0.281,0.457],[0.274,0.301,0.425],[0.261,0.326,0.412],[0.259,0.303,0.438]] };
  // good.out.txt: "predict" line, when "after"
  const AFTER = { accuracy: 0.9, p: [[0.774,0.105,0.122],[0.105,0.67,0.226],[0.086,0.184,0.73],[0.675,0.257,0.068],[0.207,0.122,0.671],[0.101,0.66,0.239],[0.719,0.148,0.133],[0.12,0.507,0.373],[0.128,0.698,0.174],[0.447,0.383,0.17],[0.224,0.119,0.656],[0.136,0.611,0.253],[0.355,0.141,0.504],[0.761,0.107,0.132],[0.223,0.16,0.617],[0.109,0.67,0.221],[0.097,0.148,0.756],[0.727,0.159,0.114],[0.114,0.503,0.383],[0.132,0.414,0.454]] };
  // good.out.txt: the Trainer's printed dicts, one per epoch ('loss' and 'eval_accuracy'), as printed
  const GOOD_LOG = { loss: ["1.12", "0.9748", "0.8404", "0.7174", "0.5734", "0.4808", "0.411", "0.3798"],
    acc: ["0.7", "0.9", "0.9", "0.95", "0.9", "0.9", "0.9", "0.9"], runtime: "5.015" };
  // lr-too-high.out.txt: the same, learning_rate=1e-2
  const HIGH_LOG = { loss: ["1.864", "1.466", "1.533", "1.36", "1.278", "1.228", "1.153", "1.176"],
    acc: ["0.35", "0.35", "0.3", "0.35", "0.3", "0.35", "0.3", "0.3"] };
  // lr-too-high.out.txt "predict" after: every one of the 20 tickets got exactly these probabilities
  const HIGH_P = Array(20).fill([0.35, 0.399, 0.25]);
  const LR_GOOD = "1e-4", LR_HIGH = "1e-2", EPOCHS = 8;
  // good.out.txt, the library's load report (terminal bold codes removed; trimmed with …)
  const LOAD_REPORT = [
    "BertForSequenceClassification LOAD REPORT from: google/bert_uncased_L-4_H-256_A-4",
    "Key                                        | Status     | ",
    "-------------------------------------------+------------+-",
    "cls.seq_relationship.weight                | UNEXPECTED | ",
    "cls.predictions.decoder.weight             | UNEXPECTED | ",
    "…",
    "classifier.bias                            | MISSING    | ",
    "classifier.weight                          | MISSING    | ",
    "",
    "Notes:",
    "- UNEXPECTED:\tcan be ignored when loading from different task/architecture; not ok if you expect identical arch.",
    "- MISSING:\tthose params were newly initialized because missing from the checkpoint. Consider training on your downstream task."
  ];
  // two-labels.out.txt, the traceback (trimmed with …; long paths cut with …)
  const TRACE = [
    "Traceback (most recent call last):",
    "  File \"…/finetune.py\", line 79, in <module>",
    "    trainer.train()",
    "…",
    "  File \"…/transformers/models/bert/modeling_bert.py\", line 1126, in forward",
    "    loss = loss_fct(logits.view(-1, self.num_labels), labels.view(-1))",
    "…",
    "  File \"…/torch/nn/functional.py\", line 3561, in cross_entropy",
    "    return torch._C._nn.cross_entropy_loss(",
    "…",
    "IndexError: Target 2 is out of bounds."
  ];
  // finetune.py, the part that builds and trains (values of the good run filled in). Re-wrapped to fit a phone;
  // "…" marks arguments left out here: revision=, output_dir=, logging_strategy=, save_strategy=, seed=, report_to=,
  // processing_class= and callbacks=. Nothing else changed.
  const CODE = [
    "model = (AutoModelForSequenceClassification",
    "  .from_pretrained(CHECKPOINT, num_labels=3,",
    "    id2label=id2label, label2id=label2id))",
    "args = TrainingArguments(",
    "  learning_rate=1e-4, num_train_epochs=8,",
    "  per_device_train_batch_size=8,",
    "  eval_strategy=\"epoch\", use_cpu=True, …)",
    "trainer = Trainer(model=model, args=args,",
    "  train_dataset=train_set,",
    "  eval_dataset=test_set,",
    "  compute_metrics=accuracy, …)",
    "trainer.train()"
  ];

  /* ---------- Derived from the data ---------- */
  const N = TEST.length;
  const TRAIN_N = TRAIN_PER_TEAM.reduce((a, b) => a + b, 0);
  const STEPS_PER_EPOCH = Math.ceil(TRAIN_N / BATCH);
  const argmax = p => p.indexOf(Math.max(...p));
  const gold = i => TEST[i][1];
  const share = k => TEST.filter(t => t[1] === k).length;
  const predB = BEFORE.p.map(argmax), predA = AFTER.p.map(argmax), predH = HIGH_P.map(argmax);
  const MISSED = predA.map((k, i) => k === gold(i) ? -1 : i).filter(i => i >= 0);
  const accOf = pr => pr.filter((k, i) => k === gold(i)).length / N;
  const GUESS_LOSS = Math.log(TEAMS.length); // loss of a model that gives every team the same chance
  const num = s => parseFloat(s);
  const lowest = a => Math.min(...a.map(num));
  const firstReach = (a, v) => a.findIndex(x => num(x) >= v) + 1;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-ticket { margin: 18px 0 0; padding: 14px 16px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--surface); font-size: 17px; line-height: 1.5; }
      .lx-${ID}-ticket small { display: block; font: 600 13px var(--mono); color: var(--muted); margin-bottom: 4px; letter-spacing: .03em; }
      .lx-${ID}-log { margin: 16px 0 0; padding: 12px 14px; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); font: 500 12.5px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; margin-bottom: 14px; }
      .lx-${ID}-log.nowrap { white-space: pre; overflow-wrap: normal; overflow-x: auto; margin-bottom: 0; border-radius: var(--r) var(--r) 0 0; }
      .lx-${ID}-log.nowrap + .lx-${ID}-log { margin-top: 0; border-radius: 0 0 var(--r) var(--r); padding-top: 0; }
      .lx-${ID}-rows { margin: 16px 0 0; display: grid; gap: 8px; }
      .lx-${ID}-row { display: grid; grid-template-columns: 2em 1fr auto; gap: 4px 10px; align-items: center; width: 100%; min-height: 48px; padding: 8px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 15px/1.4 var(--font); text-align: left; cursor: pointer; }
      .lx-${ID}-row:hover { border-color: var(--ink); }
      .lx-${ID}-row .n { font: 600 13px var(--mono); color: var(--muted); }
      .lx-${ID}-row .m { font: 600 13px/1.4 var(--mono); text-align: right; white-space: nowrap; }
      .lx-${ID}-row.ok { border-color: var(--good); background: var(--good-soft); }
      .lx-${ID}-row.ok .m { color: var(--good); }
      .lx-${ID}-row.no { border-color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-tab { margin: 16px 0 0; border-collapse: collapse; width: 100%; font: 500 14px/1.4 var(--mono); }
      .lx-${ID}-tab th, .lx-${ID}-tab td { padding: 6px 8px; border-bottom: 1px solid var(--line); text-align: right; }
      .lx-${ID}-tab th:first-child, .lx-${ID}-tab td:first-child { text-align: left; }
      .lx-${ID}-tab th { font: 600 12.5px var(--font); color: var(--muted); }
      .lx-${ID}-tab caption { text-align: left; font: 600 13.5px var(--font); color: var(--muted); padding-bottom: 4px; }
      .lx-${ID}-list { margin: 10px 0 0; padding-left: 20px; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-list li { margin: 4px 0; }
      .lx-${ID}-check { list-style: none; padding: 0; margin: 12px 0 0; }
      .lx-${ID}-check li { border-top: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; font-size: 16px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-check label span { padding-top: 10px; overflow-wrap: anywhere; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .lx-${ID}-check input:checked { background-color: var(--good); outline-color: var(--good); }
      .lx-${ID}-inl { color: var(--ink); padding: 13px 0; }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1.6em 1fr; } .lx-${ID}-row .m { grid-column: 2; text-align: left; } }
    `;
    document.head.appendChild(s);
  }
  const logBlock = (kit, lines, nowrap) => `<pre class="lx-${ID}-log${nowrap ? " nowrap" : ""}">${lines.map(l => kit.esc(l)).join("\n")}</pre>`;
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  // epoch table: cols = [[head, values]]
  const epochTable = (kit, title, cols) => `<table class="lx-${ID}-tab"><caption>${kit.esc(title)}</caption><thead><tr><th>epoch</th>${cols.map(c => `<th>${kit.esc(c[0])}</th>`).join("")}</tr></thead><tbody>${cols[0][1].map((_, e) => `<tr><td>${e + 1}</td>${cols.map(c => `<td>${kit.esc(c[1][e] == null ? "?" : c[1][e])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  /* 1. The situation, and label the tickets yourself. */
  function labelByHand({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const firstTry = [];
    const paint = () => {
      const fin = k >= N;
      const right = fin ? firstTry.filter(Boolean).length : 0;
      el.innerHTML = `<h1>Which team gets this ticket?</h1>
        <p class="lead">A university IT helpdesk gets every ticket in one inbox. A person reads each one and sends it to the <b>Accounts</b> team (logins, passwords), the <b>Wi-Fi</b> team (the network) or the <b>Printing</b> team (printers, copiers, print credit). They want a model to do the sorting. To teach one, you first need tickets with the right team written next to them.</p>
        ${fin ? "" : `<p class="task">Be the person at the inbox. Send each ticket to a team.</p>
        <div class="lx-${ID}-ticket"><small>ticket ${k + 1} of ${N}</small>${kit.esc(TEST[k][0])}</div>
        <div class="lpanel">${kit.options(TEAMS.map(t => TEAM_NAME[t]), { picked: wrong, correct: gold(k) })}
        ${wrong != null ? kit.feedback(`The helpdesk sent this one to <b>${TEAM_NAME[TEAMS[gold(k)]]}</b>: ${kit.esc(TEST[k][2])}`, false) : ""}</div>`}
        ${fin ? `<div class="lpanel">${kit.feedback(`Done: ${N} tickets, each with a team. You matched the helpdesk on ${right} of ${N} at the first try. The hard ones name one team's thing and belong to another: tickets ${CLOSE.map(i => i + 1).join(", ")} mention Wi-Fi or a printer, but the real fault is a login. A model will meet the same trouble.<br><br>For the model, each team becomes a number: ${TEAMS.map((t, i) => `${TEAM_NAME[t]} = ${i}`).join(", ")}. The helpdesk labelled ${TRAIN_N} more tickets the same way (${TRAIN_PER_TEAM[0]} per team) to train on. Your ${N} are kept aside, or <b>held out</b>: the model never trains on them, so they can test it on tickets it has never seen.`, true)}</div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== gold(k)) { wrong = v; if (firstTry[k] == null) firstTry[k] = false; paint(); return; }
        if (firstTry[k] == null) firstTry[k] = true;
        wrong = null; k++; paint();
        if (k >= N) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: the downloaded model has a new, untrained head. */
  function newHead({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It never read helpdesk words like “password” or “printer” during pretraining",
      "The part that picks one of the three teams is new: its weights were just set at random, so it has learned nothing yet",
      "The tokenizer splits the tickets wrongly, so the model cannot read them",
      "The model is too small to tell three teams apart"
    ];
    const fb = [
      ["These are everyday English words, and this checkpoint was pretrained on a large amount of English text. Knowing words is not the problem. Nothing has ever told it which team a ticket belongs to.", false],
      [`Right. Look at the report: the pretraining heads (<code>cls.…</code>, for guessing hidden words and whether one sentence follows another) are thrown away as UNEXPECTED, and a new head called <code>classifier</code> is added, MISSING from the checkpoint, so it was “newly initialized”: random numbers. The head is one small layer with ${PARAMS.head.toLocaleString("en")} weights, against ${PARAMS.total.toLocaleString("en")} in the whole model. It turns BERT's reading of the ticket into one score per team. <b>Fine-tuning</b> means training this new head, and gently adjusting the pretrained body, on your labelled tickets. The body already reads English; the head learns your teams.`, true],
      ["The tokenizer is the checkpoint's own, loaded from the same place, and it splits these plain English words fine. The trouble is after reading: nothing decides teams yet.", false],
      ["Size is not what is missing here. Before any training, no part of the model has ever been shown a team. Even a much larger model would start the same way, with a random head.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A trained model that knows nothing</h1>
        <p class="lead">You download a small BERT that was pretrained on a large amount of English text (4 layers, the model called BERT-Mini). Its saved, pretrained weights are called a <b>checkpoint</b>. You ask the Hugging Face Transformers library for a version with three outputs, one per team. While loading, the library printed this (on a phone, scroll the table sideways for the Status column):</p>
        ${logBlock(kit, LOAD_REPORT.slice(0, 8), true)}${logBlock(kit, LOAD_REPORT.slice(9))}
        <p class="lead">Before any training, on your ${N} tickets it chose ${predB.every(k => k === predB[0]) ? `${TEAM_NAME[TEAMS[predB[0]]]} for every one` : "mostly one team"}, and never with much confidence: it gave that team only ${pct(Math.min(...BEFORE.p.map(p => p[2])))} to ${pct(Math.max(...BEFORE.p.map(p => p[2])))}. Accuracy (the share it got right): ${pct(accOf(predB))}, which is just the share of ${TEAM_NAME[TEAMS[predB[0]]]} tickets (${share(predB[0])} of ${N}).</p>
        <p class="task">This model has read lots of English. Why can it not route your tickets yet?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. The Trainer run: the parameters that matter, and predict what held-out accuracy did. */
  function trainRun({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const reach = firstReach(GOOD_LOG.acc, 0.9);
    const opts = [
      "It rose every epoch, just like the loss fell",
      `It reached ${GOOD_LOG.acc[reach - 1]} (${pct(num(GOOD_LOG.acc[reach - 1]))} right) by epoch ${reach}, then stayed about there`,
      "It fell after the first epochs: the model started to memorise"
    ];
    const fb = [
      ["Training loss is measured on the tickets the model trains on. It can keep falling long after the model stops getting better on tickets it has never seen. A falling loss alone does not tell you how it does on new tickets.", false],
      [`Right. The loss kept falling to ${GOOD_LOG.loss[EPOCHS - 1]} because the model got more sure about the training tickets, but accuracy on your held-out tickets stopped at about ${GOOD_LOG.acc[EPOCHS - 1]} early on. More epochs after that bought nothing here. That is why you evaluate on tickets the model never trained on, every epoch (<code>eval_strategy="epoch"</code>).`, true],
      [`Not in this run: it never went below ${GOOD_LOG.acc[reach - 1]} once it got there. Memorising shows up as held-out accuracy dropping while training loss keeps falling; here it held steady.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Training with the Trainer</h1>
        <p class="lead">Hugging Face's <code>Trainer</code> runs the training loop for you: batches, the loss, the backward pass, the optimizer, evaluation. This is the code we ran, on a laptop CPU (<code>use_cpu=True</code>; the notebook runs the same code on Colab's free CPU runtime):</p>
        ${kit.code(CODE, -1)}
        <p class="lead"><code>…</code> marks arguments left out here: where to save, logging, the random seed, the tokenizer.</p>
        <ul class="lx-${ID}-list">
          <li><b><code>num_labels</code></b> (with <code>id2label</code>): how many outputs the new head gets. It must match your teams: 3.</li>
          <li><b><code>learning_rate</code></b>: how big each weight update is. Fine-tuning uses small ones, because the body is already trained. We used ${LR_GOOD}.</li>
          <li><b><code>num_train_epochs</code></b>: how many times it reads all ${TRAIN_N} training tickets. ${EPOCHS} epochs of ${STEPS_PER_EPOCH} batches of ${BATCH}: about ${Math.round(num(GOOD_LOG.runtime))} seconds here.</li>
        </ul>
        ${epochTable(kit, "What the Trainer printed after each epoch", [["training loss", GOOD_LOG.loss], ["held-out accuracy", ans === 1 ? GOOD_LOG.acc : GOOD_LOG.acc.map(() => null)]])}
        <p class="task">The training loss fell every epoch. What do you think happened to the accuracy on your ${N} held-out tickets?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Compare with your own labels: find the tickets the model got wrong. */
  function findMisses({ el, done, kit }) {
    ensureStyle();
    const found = new Set();
    let bad = null;
    const paint = () => {
      const fin = MISSED.every(i => found.has(i));
      el.innerHTML = `<h1>Where does it still disagree with you?</h1>
        <p class="lead">After training, the model routed your ${N} tickets. Next to each: the team it chose and how sure it was (its probability for that team). It got ${pct(accOf(predA))} right: ${plural(MISSED.length, "ticket")} went to the wrong team.</p>
        <p class="task">Find the ${plural(MISSED.length, "ticket")} the model sent to the wrong team. You labelled them yourself on screen 1.</p>
        <div class="lx-${ID}-rows">${TEST.map((t, i) => {
          const k = predA[i], cls = found.has(i) ? "no" : "";
          return `<button type="button" class="lx-${ID}-row ${cls}" data-i="${i}"><span class="n">${i + 1}</span><span>${kit.esc(t[0])}</span><span class="m">${TEAM_NAME[TEAMS[k]]} ${pct(AFTER.p[i][k])}</span></button>`;
        }).join("")}</div>
        <div class="lpanel">${bad != null ? kit.feedback(`Ticket ${bad + 1} went to ${TEAM_NAME[TEAMS[predA[bad]]]}, the same team the helpdesk chose. Look for a ticket whose team is not the one you gave it.`, false) : ""}
        ${fin ? kit.feedback(`Found both. ${MISSED.map(i => `Ticket ${i + 1} belongs to ${TEAM_NAME[TEAMS[gold(i)]]}, but the model chose ${TEAM_NAME[TEAMS[predA[i]]]} at ${pct(AFTER.p[i][predA[i]])}, with ${TEAM_NAME[TEAMS[gold(i)]]} at ${pct(AFTER.p[i][gold(i)])}.`).join(" ")} Neither mistake was made with much confidence: ${pct(Math.max(...MISSED.map(i => AFTER.p[i][predA[i]])))} at most, close to a coin toss between two teams. ${MISSED.filter(i => CLOSE.includes(i)).map(i => `Ticket ${i + 1} is one of the close cases you met by hand.`).join(" ")} ${TRAIN_N} training tickets is very few; the usual fix is more labelled examples like the ones it misses, then train again. A low probability is also a signal you can use: send unsure tickets to a person.`, true) : ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-row`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (MISSED.includes(i)) { found.add(i); bad = null; paint(); if (MISSED.every(j => found.has(j))) done(); return; }
        bad = i; paint();
      });
    };
    paint();
  }

  /* 5. Broken on purpose: the wrong label count. */
  function brokenLabels({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { task: "A colleague copied the code from a two-label example and kept <code>num_labels=2</code>. Training crashed on the first batch. What is the cause?",
        right: 1,
        opts: ["A bug inside PyTorch's loss function", "A ticket has label 2 (Printing), but the head has only 2 outputs, numbered 0 and 1", "The tokenizer produced a token number that is too big", "A batch of 8 tickets is too big for the CPU"],
        fb: [
          ["The error surfaces inside PyTorch, but that is only where the bad value was finally checked. The loss function did what it was told with an impossible target. Look at the last line: which target, and what are the bounds?", false],
          [`Right. The labels are 0, 1 and 2, but the head built with <code>num_labels=2</code> gives only two scores (the <code>logits</code> in the trace), for classes 0 and 1. The <i>target</i> is the right label of a ticket. When the loss meets a Printing ticket, target 2 has no score to compare with: “out of bounds”. The library's docs say label ids must be from 0 to <code>num_labels - 1</code>.`, true],
          ["Token numbers go into the model's input, not into the loss. The failing line is the loss, and it complains about a <i>target</i>, which is a label.", false],
          ["A batch that is too big runs out of memory, with a memory error. This error names a target value, not memory.", false]] },
      { task: "Which fix do you make?",
        right: 2,
        opts: ["Drop the printing tickets, so only labels 0 and 1 are left", "Change every printing ticket's label to 1", "Set <code>num_labels=3</code> and give <code>id2label</code> all three teams"],
        fb: [
          ["It would run, but the model could never send a ticket to Printing. You removed a team to hide an error.", false],
          ["It would run, but now Wi-Fi and Printing are one class. Every printer ticket would go to the Wi-Fi team.", false],
          ["Right. The head must have one output per team. This is also what you change when the helpdesk adds a fourth team: the head grows, and you train again.", true]] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Broken on purpose: the crash</h1>
        <p class="lead">We ran the same script with one change, <code>num_labels=2</code>. It crashed. The traceback, trimmed:</p>
        ${logBlock(kit, TRACE)}
        ${stage < 2 ? `<p class="task">${q.task}</p><div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}</div>`
          : `<div class="lpanel">${kit.feedback(`${Q[0].fb[1][0]} The fix: <code>num_labels=3</code>, the same number as the teams in your labels. Read a traceback from the bottom: the last line says what went wrong, the lines above say where.`, true)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 6. Broken on purpose: the flat loss. */
  function brokenLoss({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const wifiShare = share(1);
    const sameForAll = HIGH_P.every(p => p.join() === HIGH_P[0].join());
    const opts = [
      `<code>num_train_epochs=${EPOCHS}</code> is too few`,
      `<code>learning_rate=${LR_HIGH}</code> is far too big`,
      "<code>num_labels</code> is wrong again",
      "BERT-Mini is too small for this task"
    ];
    const fb = [
      [`The good run used the same ${EPOCHS} epochs and reached ${GOOD_LOG.acc[firstReach(GOOD_LOG.acc, 0.9) - 1]} accuracy by epoch ${firstReach(GOOD_LOG.acc, 0.9)}. Here held-out accuracy never left ${pct(lowest(HIGH_LOG.acc))} to ${pct(Math.max(...HIGH_LOG.acc.map(num)))}, no better than one team for everything. More epochs of a run that is not learning give more of the same.`, false],
      [`Right. ${LR_HIGH} is a hundred times bigger than the ${LR_GOOD} that worked. With steps that big, training never settled on anything that uses the ticket text: in the end it gave every ticket the very same probabilities and said Wi-Fi to all of them. For these small BERT models, the model card's tested learning rates go from 3e-4 down to 3e-5. When the loss sits at or above the guessing line from start to end, check the learning rate first.`, true],
      ["A wrong label count crashes, as you just saw. This run finished without an error. It trained; it just did not learn.", false],
      [`It is the same model that reached ${GOOD_LOG.acc[GOOD_LOG.acc.length - 1]} with the good settings. One setting changed, and the model did not.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: the loss that never beats guessing</h1>
        <p class="lead">Another run, one setting changed. No crash this time, and the loss even falls a little. But compare its log with the good run. For each ticket, the loss is −ln of the probability the model gave the right team. A model that gives each of the ${TEAMS.length} teams the same chance, 1/${TEAMS.length}, has a loss of ln ${TEAMS.length} ≈ ${GUESS_LOSS.toFixed(3)}. Call it the guessing line.</p>
        ${epochTable(kit, "Training loss after each epoch", [["this run", HIGH_LOG.loss], ["good run", GOOD_LOG.loss]])}
        <p class="lead">Lowest loss in this run: ${lowest(HIGH_LOG.loss)}, never below the guessing line. Held-out accuracy stayed between ${pct(lowest(HIGH_LOG.acc))} and ${pct(Math.max(...HIGH_LOG.acc.map(num)))}. ${sameForAll ? `At the end, every one of the ${N} tickets got exactly the same probabilities: ${HIGH_P[0].map((p, k) => `${TEAM_NAME[TEAMS[k]]} ${pct(p)}`).join(", ")}. So it said Wi-Fi to all of them, and its ${pct(accOf(predH))} is just the share of Wi-Fi tickets (${wifiShare} of ${N}).` : ""}</p>
        <p class="task">Which setting was changed?</p>
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
      "Add “licences” to <code>id2label</code>; the model will start using it",
      "Nothing: the model will notice the new kind of ticket by itself",
      "Label tickets for the new team, set <code>num_labels=4</code>, and fine-tune again"
    ];
    const fb = [
      ["<code>id2label</code> only names the outputs. A fourth name can give the head a fourth output, but that output starts random, and the head was never shown a licence ticket, so it has nothing to learn the new team from. You still need labelled licence tickets and a new training run.", false],
      ["The model can only ever answer with one of the outputs it was trained with. A licence ticket will be sent to whichever of the three teams it looks most like.", false],
      ["Right. The label set is built into the head. A new team means new labelled examples and a new training run, then checking it again on held-out tickets. That is the main cost of a fine-tuned classifier: it is fast and cheap to run, but changing what it knows means relabelling and retraining.", true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to fine-tune a classifier</h1>
        <ul class="lx-${ID}-list">
          <li><b>What it is for:</b> sorting texts into a fixed set of labels, when you have labelled examples.</li>
          <li><b>Reach for it</b> when the volume is high, each answer must be fast and cheap, or the text must stay on your own machines. A small fine-tuned model runs on a plain server.</li>
          <li><b>Not</b> when you have almost no labelled examples or the labels keep changing (prompt a chat model with the label list instead). Not when you must write text, not pick a label (use a GPT-style model). Not when simple keywords already sort well (try a TF-IDF baseline first).</li>
          <li><b>Costs:</b> labelling time, a training run on a GPU, and retraining whenever the labels change.</li>
        </ul>
        <p class="task">Next term the helpdesk adds a fourth team: software licences. What do you have to do?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A bank wants each customer complaint put into one of six fixed categories. Staff have already sorted 5,000 old complaints by hand.", true,
      "Yes. A fixed set of labels and thousands of labelled examples: exactly what fine-tuning a BERT-style classifier needs.",
      "Six fixed categories and 5,000 texts already labelled by people: the head gets 6 outputs and plenty to learn from. This is the textbook case."],
    ["A shop wants an assistant that writes a polite answer to each customer email.", false,
      "No. A classifier picks one of a fixed set of labels; it cannot write a sentence. Writing is a job for a GPT-style model that generates text.",
      "The output here is new text, not a label. A BERT classifier's head only scores labels you trained it on. Use a model that writes, a GPT-style one."],
    ["A new start-up has 15 example emails and changes its list of email categories almost every week.", false,
      "No. Fifteen examples is too few to train on, and every change to the categories would mean relabelling and training again. Prompting a chat model with the current list of categories fits until the categories settle.",
      "Two things break it: too few labelled examples to learn from, and a label set that changes weekly, which means a new head and a new run each time. Prompt a chat model with the category list for now."],
    ["A forum must flag rude comments, millions a day, on its own servers, and has a large set of comments moderators already marked.", true,
      "Yes. Two fixed labels, lots of labelled data, high volume, and it must run cheaply on their own machines: a small fine-tuned model fits all of it.",
      "Millions a day on their own servers makes a large model per comment slow and costly. Two fixed labels with plenty of moderator-labelled examples is what a fine-tuned classifier is for."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Fine-tune or not?</h1>
        <p class="lead">Four requests from other places. Fine-tuning here means: a pretrained BERT-style model, a new head with one output per label, trained on labelled examples.</p>
        <p class="task">Would you fine-tune a BERT classifier for each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const reach = firstReach(GOOD_LOG.acc, 0.9);
    const checks = [
      "The load report lists <code>classifier.weight</code> and <code>classifier.bias</code> as MISSING (newly initialized).",
      `Before training, accuracy on the ${N} held-out tickets is low, near what one team for everything gives (ours: ${pct(BEFORE.accuracy)}).`,
      `The training loss starts near ${GUESS_LOSS.toFixed(1)} and falls every epoch (ours: ${GOOD_LOG.loss[0]} to ${GOOD_LOG.loss[EPOCHS - 1]}).`,
      `Held-out accuracy reaches about ${GOOD_LOG.acc[reach - 1]} in the first few epochs and then stays about there (ours: from epoch ${reach}).`,
      "With <code>num_labels=2</code> the run stops with <code>IndexError: Target 2 is out of bounds.</code>",
      `With <code>learning_rate=${LR_HIGH}</code> the loss never goes below about ${GUESS_LOSS.toFixed(1)}, and every ticket gets the same team.`
    ];
    el.innerHTML = `<h1>Now run it in Colab</h1>
      <p class="lead">You labelled tickets, saw that fine-tuning trains a new head on top of a pretrained body, ran the <code>Trainer</code>, and fixed two broken setups: a label count that crashes and a learning rate that never learns.</p>
      <p class="lead"><b>Practice:</b> a Colab notebook runs the same code. ${NOTEBOOK_URL ? `<a class="lx-${ID}-inl" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook</a>.` : "The notebook for this lesson is on its way."}</p>
      <p class="lead">The notebook needs no GPU: it runs top to bottom on Colab's free CPU runtime in about five minutes. We ran it on a laptop CPU with the same library versions, and it printed the same numbers as this lesson. On Colab's machines, numbers can differ a little. If you pick a GPU anyway (Runtime → Change runtime type, see the <a class="lx-${ID}-inl" href="https://research.google.com/colaboratory/faq.html" target="_blank" rel="noopener">official Colab FAQ</a>), the code still trains on the CPU because of <code>use_cpu=True</code>.</p>
      <p class="lead">What you should see (tick as you go; nothing is saved):</p>
      <ul class="lx-${ID}-check">${checks.map(c => `<li><label><input type="checkbox"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead" style="margin-top:18px"><b>Next:</b> ${kit.esc(nx.title)}. There the labels go on each token instead of on the whole text, and the subword splits from tokenization start to matter.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Fine-tune BERT for classification",
    checked: "2026-11-14",
    sources: [
      "https://huggingface.co/docs/transformers/tasks/sequence_classification",
      "https://huggingface.co/docs/transformers/main_classes/trainer",
      "https://huggingface.co/docs/transformers/model_doc/bert",
      "https://huggingface.co/google/bert_uncased_L-4_H-256_A-4",
      "https://arxiv.org/abs/1810.04805",
      "https://research.google.com/colaboratory/faq.html"
    ],
    interview: [
      {
        q: "You fine-tune a BERT classifier for three classes. The training loss stays around 1.1 to 1.2 from the first epoch to the last, and the model gives one class to everything. What do you check, and in what order?",
        good: [
          "1.1 is about ln 3, the loss of guessing evenly among three classes: the model is not learning at all",
          "Check the learning rate first: BERT fine-tuning uses small ones, and one that is far too big gives exactly this",
          "Check the predictions: one class for every input, with the same probabilities, means it ignores the text",
          "Check the labels line up with the texts and use ids 0 to num_labels - 1",
          "Watch held-out accuracy per epoch, not only the training loss"
        ],
        weak: "Train for more epochs or switch to a bigger model. That repeats a run that is not learning, without asking why the loss never left the guessing level."
      },
      {
        q: "Your team routes support tickets with a fine-tuned BERT classifier. Product wants a new category next month. What does that cost you, and would you choose differently?",
        good: [
          "The labels are built into the classifier head, so a new category needs a new head: num_labels goes up",
          "That means labelled examples of the new category, a new training run, and a new check on held-out tickets",
          "In return the classifier is fast and cheap per ticket and can run on your own servers",
          "If categories change often or examples are few, prompting a chat model with the category list may be the better fit for now"
        ],
        weak: "Just add the new name to the label list. That misses that the head has a fixed number of trained outputs."
      }
    ],
    screens: [labelByHand, newHead, trainRun, findMisses, brokenLabels, brokenLoss, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(TEST.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${TEST.findIndex((t, i) => !MISSED.includes(i))}"]`], right: MISSED.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
