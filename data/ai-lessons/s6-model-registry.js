/* Lesson: a model registry and promoting versions. Story: a parcel-locker company's damage-photo classifier
   was updated on Friday, and on Monday nobody can say which version is answering.
   Ideas: (1) keep every model version, numbered and never overwritten, and let the service load a movable
   name (an alias such as `champion`); moving the alias is the release, moving it back is the roll-back;
   (2) a running service keeps the model it loaded, and a pinned version number in its config never follows
   the alias (broken on purpose).
   Runs (docs/ai-path/runs/s6-model-registry/, MLflow 3.18.0 with a local sqlite store, see env.txt):
   common.py (the stand-in classifier: three scores per photo, weights and a threshold per version; the check set
   and the weekend photos), registry_run.py → registry_run.out.txt (three versions logged and registered, the
   champion alias moved forward and back, a service loaded before and after the roll-back, a pinned URI, the
   reserved alias name, a tag), monday.py + service.py + deploy.env → monday.out.txt (the roll-back that did not
   reach the service) and deploy.fixed.env → monday-fixed.out.txt (the fix), extras.py → extras.out.txt (on a copy
   of the registry: the alias name `latest` refused, and loading a pinned address after its version was deleted).
   The release log, the complaints and the chat roles on screens 1 and 2 are the story's data, not output.
   No model calls are recorded for this lesson. Every count on screen is computed here from that data.
   Lesson-local CSS: log and chat boxes, a small registry table, pickable log lines, the photo picker, the
   checklist. Plain browser script. */
(() => {
  const ID = "s6-model-registry", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s6-model-registry.ipynb";
  const RUN_DATE = "2026-11-14";
  const esc = s => LessonKit.esc(s);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  /* ---------- Run data (docs/ai-path/runs/s6-model-registry/) ---------- */
  // common.py: each version is weights for (crushed, torn, wet) and a threshold: "damaged" if the score is above it.
  const VERSIONS = {
    1: { weights: [1, 1, 0], threshold: 0.9 },
    2: { weights: [1, 1, 1], threshold: 0.9 },
    3: { weights: [1, 1, 1], threshold: 0.6 }
  };
  const CHECK_SIZE = 10, CHECK_DAMAGED = 4; // common.py CHECK: 10 labelled photos, 4 really damaged
  // registry_run.out.txt, the [train] lines
  const TRAIN = {
    1: { run: "c8ff07bac4154ff9b256aba3c41bc203", recall: 0.25, precision: 1.0, falseAlarms: 0 },
    2: { run: "36e0d37d206746fbbdb4a6207faff3d7", recall: 0.75, precision: 1.0, falseAlarms: 0 },
    3: { run: "a083f94256a24912bccbf3eb74bcc3c4", recall: 1.0, precision: 0.57, falseAlarms: 3 }
  };
  // common.py PHOTOS: the weekend's photos at one locker bank, (crushed, torn, wet)
  const PHOTOS = [
    ["P-101", [0.05, 0.10, 0.05]], ["P-102", [0.40, 0.10, 0.20]], ["P-103", [0.70, 0.30, 0.10]],
    ["P-104", [0.10, 0.05, 0.60]], ["P-105", [0.20, 0.20, 0.10]], ["P-106", [0.10, 0.60, 0.40]]
  ];
  // registry_run.out.txt: "service says" (version 3) and "reloaded:" (version 2 after the roll-back)
  const SAYS_V3 = ["fine", "damaged", "damaged", "damaged", "fine", "damaged"];
  const SAYS_V2 = ["fine", "fine", "damaged", "fine", "fine", "damaged"];
  // registry_run.py: the function `release`, line for line
  const CODE = [
    "def release(model_uri, photos):",
    "    mv = mlflow.register_model(model_uri, \"parcel-damage\")",
    "    print(\"registered version\", mv.version)",
    "    champ = client.get_model_version_by_alias(\"parcel-damage\", \"champion\")",
    "    print(\"champion is still\", champ.version)",
    "    client.set_registered_model_alias(\"parcel-damage\", \"champion\", mv.version)",
    "    service = mlflow.pyfunc.load_model(\"models:/parcel-damage@champion\")",
    "    print(\"service says\", service.predict(photos))",
    "    client.set_registered_model_alias(\"parcel-damage\", \"champion\", \"2\")",
    "    print(\"after roll-back, same service says\", service.predict(photos))",
    "    print(\"reloaded:\", mlflow.pyfunc.load_model(\"models:/parcel-damage@champion\").predict(photos))"
  ];
  const pyList = a => `[${a.map(s => `'${s}'`).join(", ")}]`;
  // registry_run.out.txt: what each line printed (register_model also prints its own two lines)
  const OUT = {
    1: ["Registered model 'parcel-damage' already exists. Creating a new version of this model...", "Created version '3' of model 'parcel-damage'."],
    2: ["registered version 3"],
    4: ["champion is still 2"],
    7: ["service says " + pyList(SAYS_V3)],
    9: ["after roll-back, same service says " + pyList(SAYS_V3)],
    10: ["reloaded: " + pyList(SAYS_V2)]
  };
  // the values the run printed for the two variables of `release` (lines 2 and 4 print them)
  const MV_VERSION = OUT[2][0].split(" ").pop(), CHAMP_VERSION = OUT[4][0].split(" ").pop();
  const RESERVED_ERR = "MlflowException Version alias name 'v3' is reserved.";   // registry_run.out.txt [reserved]
  const LATEST_ERR = "MlflowException 'latest' alias name (case insensitive) is reserved."; // extras.out.txt [alias latest]
  const DELETED_ERR = "MlflowException Model Version (name=parcel-damage, version=3) not found"; // extras.out.txt [load deleted]
  const TAG = { version: 2, key: "rolled_back_from", value: "3" };              // registry_run.out.txt [tag]
  // registry state printed at the end of monday.py (aliases after the run's challenger step)
  const REGISTRY_MONDAY = [[1, []], [2, ["champion"]], [3, ["challenger"]]];
  // deploy.env, and monday.out.txt with each cut marked "…" (the UserWarning, the three "ops: env" lines,
  // P-101, P-103, P-105 and P-106)
  const DEPLOY_ENV = ["LOCKER_BANK=north-7", "MODEL_URI=models:/parcel-damage/3", "LOG_LEVEL=INFO"];
  const CUT = "…";
  const LOG_BROKEN = [
    CUT,
    "2026-11-14 00:34:54,141 INFO ops: roll-back: champion -> version 2 run_id=36e0d37d206746fbbdb4a6207faff3d7",
    "2026-11-14 00:34:54,141 INFO ops: restarting locker-service",
    "2026-11-14 00:34:55,185 INFO locker-service: loaded models:/parcel-damage/3 run_id=a083f94256a24912bccbf3eb74bcc3c4",
    CUT,
    "2026-11-14 00:34:55,185 INFO locker-service: P-102 -> damaged",
    CUT,
    "2026-11-14 00:34:55,186 INFO locker-service: P-104 -> damaged",
    CUT
  ];
  // monday-fixed.out.txt, cut the same way
  const LOG_FIXED = [
    CUT,
    "2026-11-14 00:35:12,931 INFO locker-service: loaded models:/parcel-damage@champion run_id=36e0d37d206746fbbdb4a6207faff3d7",
    CUT,
    "2026-11-14 00:35:12,932 INFO locker-service: P-102 -> fine",
    CUT,
    "2026-11-14 00:35:12,932 INFO locker-service: P-104 -> fine",
    CUT
  ];
  // service.py, the line that picks the model
  const SERVICE_LINE = "uri = os.environ.get(\"MODEL_URI\", \"models:/parcel-damage@champion\")";

  /* ---------- Story data (screens 1 and 2): the team's chat before the registry ---------- */
  const CHAT = [
    ["Fri 14:05", "data scientist", "Version 3 is trained and saved as damage_v3.pkl. It catches every damaged parcel in our check set."],
    ["Fri 16:40", "engineer", "Copied damage_v3.pkl over model.pkl."],
    ["Fri 17:10", "engineer", "Restarted locker-service."],
    ["Sat 11:00", "data scientist", "Version 3 flags too many parcels. Copied damage_v2.pkl back over model.pkl."],
    ["Sun 03:00", "server", "Nightly restart of locker-service."]
  ];
  const COMPLAINTS = [
    { at: "Fri 16:55", text: "My parcel has a torn corner, and the locker said it was fine.", v: 2,
      no: "At 16:40 model.pkl held version 3, but the service reads model.pkl only when it starts. It started again at 17:10. At 16:55 it was still answering with version 2, the model it loaded before Friday." },
    { at: "Sat 14:30", text: "The locker marked my parcel damaged. It was perfect.", v: 3,
      no: "The copy at Sat 11:00 changed the file, not the running service. The service had loaded version 3 at Fri 17:10 and kept it until the next start, Sun 03:00." },
    { at: "Sun 12:00", text: "The box was crushed, and the locker said fine.", v: 2,
      no: "The nightly restart at Sun 03:00 read model.pkl, and model.pkl had held version 2 since Sat 11:00." }
  ];

  /* ---------- Derived ---------- */
  const score = (x, v) => x.reduce((s, xi, i) => s + xi * VERSIONS[v].weights[i], 0);
  const f2 = n => n.toFixed(2);
  const FLIPS = PHOTOS.map((_, i) => i).filter(i => SAYS_V2[i] !== SAYS_V3[i]);
  const flipNames = FLIPS.map(i => PHOTOS[i][0]);
  const andList = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const missed = v => Math.round((1 - TRAIN[v].recall) * CHECK_DAMAGED);
  const runOf = id => +Object.keys(TRAIN).find(k => TRAIN[k].run === id);
  const runIn = line => (line.match(/run_id=([0-9a-f]+)/) || [])[1];
  const short = id => id.slice(0, 8) + "…";

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}box { margin: 14px 0 0; padding: 10px 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
      .${P}box b.h { display: block; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 4px; }
      .${P}box pre { margin: 0; font: 500 13.5px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}chat { margin: 0; padding: 0; list-style: none; }
      .${P}chat li { display: grid; grid-template-columns: 5.4em 1fr; gap: 2px 10px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 15.5px; line-height: 1.4; }
      .${P}chat li:first-child { border-top: 0; }
      .${P}chat b { font: 600 13.5px var(--mono); color: var(--ink-2); padding-top: 2px; }
      .${P}chat i { font-style: normal; color: var(--muted); }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--mono); color: var(--muted); }
      .${P}reg { border-collapse: collapse; margin-top: 12px; width: 100%; font-size: 15px; }
      .${P}reg th { text-align: left; font: 700 12px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 4px 10px 4px 0; border-bottom: 1px solid var(--line); }
      .${P}reg td { padding: 7px 10px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}reg td.m { font: 500 13.5px var(--mono); overflow-wrap: anywhere; }
      .${P}reg tr.on td { font-weight: 700; }
      .${P}reg .al { display: inline-block; font: 600 13px var(--mono); border: 2px solid var(--ink); border-radius: 4px; padding: 0 6px; margin: 0 4px 2px 0; }
      .${P}lines { margin: 14px 0 0; padding: 0; list-style: none; }
      .${P}lines li { border-top: 1px solid var(--line); }
      .${P}lines li:last-child { border-bottom: 1px solid var(--line); }
      .${P}lines .h { display: block; font: 700 12px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 10px 0 4px; }
      .${P}lines li.${P}cut { padding: 2px 10px; font: 500 13.5px var(--mono); color: var(--muted); }
      .${P}lines button { display: block; width: 100%; min-height: 44px; padding: 8px 10px; border: 0; background: none; color: var(--ink); font: 500 13.5px/1.45 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; }
      .${P}lines button:hover { background: var(--sunk); }
      .${P}lines button.no { background: var(--bad-soft); }
      .${P}lines button.yes { background: var(--good-soft); }
      .${P}photos { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 15px; }
      .${P}photos th { text-align: left; font: 700 12px var(--mono); color: var(--muted); padding: 4px 6px 4px 0; border-bottom: 1px solid var(--line); }
      .${P}photos td { padding: 0 6px 0 0; border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 14px; }
      .${P}photos button { display: flex; align-items: center; gap: 8px; min-height: 44px; width: 100%; padding: 0; border: 0; background: none; color: var(--ink); font: 600 14px var(--mono); cursor: pointer; text-align: left; white-space: nowrap; }
      .${P}photos button::before { content: ""; flex: none; width: 18px; height: 18px; border: 2px solid var(--ink-2); border-radius: 4px; }
      .${P}photos button[aria-pressed="true"]::before { content: "✓"; font: 700 14px/18px var(--font); text-align: center; color: var(--ink); border-color: var(--ink); }
      .${P}photos tr.chg td { background: var(--good-soft); }
      .${P}wrap { font-size: 12.5px; }
      .${P}wrap div { white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}check { margin-top: 12px; }
      .${P}check .btn { min-height: 44px; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 48px; padding: 10px 18px; text-decoration: none; }
      .${P}cost { margin: 8px 0 0; padding-left: 20px; font-size: 16.5px; }
      .${P}cost li { margin: 3px 0; }
      .${P}list { margin: 14px 0 0; padding-left: 0; list-style: none; }
      .${P}list li { border-top: 1px solid var(--line); }
      .${P}list button { display: flex; gap: 12px; align-items: flex-start; width: 100%; min-height: 48px; padding: 10px 0; border: 0; background: none; color: var(--ink); font: 400 16.5px/1.45 var(--font); text-align: left; cursor: pointer; }
      .${P}list button::before { content: ""; flex: none; width: 20px; height: 20px; margin-top: 2px; border: 2px solid var(--ink-2); border-radius: 4px; }
      .${P}list button[aria-pressed="true"]::before { content: "✓"; font: 700 15px/20px var(--font); text-align: center; color: var(--good); border-color: var(--good); }
    `;
    document.head.appendChild(s);
  }
  // a listing that wraps long lines at phone width: the indent becomes padding, wrapped parts hang under it
  const codeW = (lines, active) => `<pre class="lcode ${P}wrap">${lines.map((c, j) => {
    const ind = c.length - c.trimStart().length;
    return `<div${j === active ? ' class="on"' : ""} style="padding-left: calc(12px + ${ind + 2}ch); text-indent: -2ch">${esc(c.trimStart()) || " "}</div>`;
  }).join("")}</pre>`;
  const box = (label, text) => `<div class="${P}box"><b class="h">${esc(label)}</b><pre>${esc(text)}</pre></div>`;
  const cap = t => `<p class="${P}cap">${esc(t)}</p>`;
  const runCap = `Output of a run on our machine, ${RUN_DATE} (Python 3.12, MLflow 3.18, a local sqlite registry)`;
  const chatBox = () => `<div class="${P}box"><b class="h">The team's release chat</b><ul class="${P}chat">${CHAT.map(([t, who, msg]) => `<li><b>${esc(t)}</b><span><i>${esc(who)}:</i> ${esc(msg)}</span></li>`).join("")}</ul></div>`;
  // rows: [[version, [aliases], note]]
  const regTable = (rows, { title = "Registered model: parcel-damage", hi = -1, note = "from run" } = {}) =>
    `<div class="${P}box"><b class="h">${esc(title)}</b><table class="${P}reg"><thead><tr><th>version</th><th>aliases</th><th>${esc(note)}</th></tr></thead><tbody>${rows.map(([v, al, n]) =>
      `<tr${v === hi ? ` class="on"` : ""}><td>${v}</td><td>${al.length ? al.map(a => `<span class="al">${esc(a)}</span>`).join("") : "–"}</td><td class="m">${esc(n)}</td></tr>`).join("")}</tbody></table></div>`;

  /* 1. The situation, then by hand: which version answered each complaint? */
  function byHand({ el, done, kit }) {
    style();
    const ans = COMPLAINTS.map(() => null);
    const OPTS = ["Version 2", "Version 3"];
    const right = c => c.v === 2 ? 0 : 1;
    const paint = () => {
      const all = COMPLAINTS.every((c, i) => ans[i] === right(c));
      el.innerHTML = `<h1>Which model labelled this parcel?</h1>
        <p class="lead">A parcel-locker company photographs every parcel a courier drops into a locker. A classifier labels each photo <b>damaged</b> or <b>fine</b>, and a damaged label sends the customer a notice. On Friday the team updated the classifier. On Monday the complaints are piling up, and nobody can say which version answered when. Version 2 was live all week before Friday. The locker service reads the file <code>model.pkl</code> once, when it starts. This lesson is about the step after training: putting a model version live, and going back safely when it is wrong.</p>
        ${chatBox()}
        <p class="task">For each complaint, work out which version labelled the parcel.</p>
        ${COMPLAINTS.map((c, i) => `<div class="lcase" id="c${i}"><p><b>${esc(c.at)}</b>: “${esc(c.text)}”</p>${kit.options(OPTS, { picked: ans[i], correct: right(c) })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === right(c) ? `Right. ${esc(c.no)}` : esc(c.no), ans[i] === right(c))}</div>`).join("")}
        ${all ? kit.feedback(`To answer, you needed ${WORDS[CHAT.length].toLowerCase()} chat messages and a rule that is written nowhere: the service reads the file only when it starts. On Monday, <code>model.pkl</code> itself cannot tell you which version it is, and if someone forgot to post in the chat, nothing can.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (COMPLAINTS.every((x, j) => ans[j] === right(x))) done();
      }));
    };
    paint();
  }

  /* 2. By hand: what would rolling back to version 2 change? */
  function rollBackByHand({ el, done, kit }) {
    style();
    const picked = new Set();
    let checked = null; // null, or the result of the last check
    const t2 = VERSIONS[2].threshold, t3 = VERSIONS[3].threshold;
    const paint = () => {
      const ok = checked && checked.ok;
      el.innerHTML = `<h1>What would a roll-back change?</h1>
        <p class="lead">Monday: the team decides to go back to version 2 for good. Each photo is reduced to three scores between 0 and 1 (crushed, torn, wet). This classifier is a small stand-in we built for the lesson: both versions add the three scores. Version 3 says damaged when the total is above <b>${f2(t3)}</b>, version 2 when it is above <b>${f2(t2)}</b>. Here are Saturday's photos from one locker bank (one group of lockers), labelled by version 3 (column v3).</p>
        <p class="task">Tick every photo whose label would change under version 2, then check.</p>
        <table class="${P}photos"><thead><tr><th>photo</th><th>crush</th><th>torn</th><th>wet</th><th>total</th><th>v3</th>${ok ? "<th>v2</th>" : ""}</tr></thead><tbody>
          ${PHOTOS.map(([id, x], i) => `<tr${ok && FLIPS.includes(i) ? ` class="chg"` : ""}><td><button type="button" data-i="${i}" aria-pressed="${picked.has(i)}" ${ok ? "disabled" : ""}>${esc(id)}</button></td>${x.map(v => `<td>${f2(v)}</td>`).join("")}<td>${f2(score(x, 3))}</td><td>${SAYS_V3[i]}</td>${ok ? `<td>${SAYS_V2[i]}</td>` : ""}</tr>`).join("")}
        </tbody></table>
        <div class="${P}check"><button type="button" class="btn" data-check ${ok ? "disabled" : ""}>Check</button></div>
        <div class="lpanel">${checked == null ? "" : kit.feedback(checked.say, checked.ok)}</div>`;
      el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { const i = +b.dataset.i; picked.has(i) ? picked.delete(i) : picked.add(i); paint(); });
      el.querySelector("[data-check]").onclick = () => {
        const extra = [...picked].filter(i => !FLIPS.includes(i)), miss = FLIPS.filter(i => !picked.has(i));
        if (!extra.length && !miss.length) {
          checked = { ok: true, say: `Right: ${andList(flipNames)}. Their totals are above ${f2(t3)} but not above ${f2(t2)}, so version 2 calls them fine. We ran both versions on these photos, and the version 2 column is that run's output. Two things a roll-back does <b>not</b> change: the notices already sent on Saturday stay sent, and version 2 brings back its own weakness. On the team's check set of ${CHECK_SIZE} labelled photos it missed ${missed(2)} of ${CHECK_DAMAGED} damaged parcels. Version 3 missed ${missed(3)}, but raised ${TRAIN[3].falseAlarms} false alarms (fine parcels marked damaged).` };
          paint(); done(); return;
        }
        const i = extra.length ? extra[0] : miss[0], [id, x] = PHOTOS[i], s = score(x, 3);
        checked = { ok: false, say: extra.length
          ? `${esc(id)} totals ${f2(s)}. ${s > t2 ? `That is above ${f2(t2)} too, so version 2 also says damaged.` : `That is not above ${f2(t3)}, so version 3 already said fine, and version 2 says fine too.`} Its label stays.`
          : `Look at ${esc(id)} again: its total ${f2(s)} is above ${f2(t3)} (damaged under version 3) but not above ${f2(t2)}, so version 2 says fine. Its label changes.` };
        checked.say += " The ticks are cleared: tick again and check.";
        picked.clear();
        paint();
      };
    };
    paint();
  }

  /* 3. Spot the idea: what makes "which version is answering" a lookup? */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "Give every file a date in its name, such as damage_2026-11-07.pkl, keep them all, and copy the chosen one over model.pkl",
      "Keep every version, numbered and never overwritten, and let the service load a name such as “champion” that you move to release",
      "Ask everyone to post in the chat every time they copy a file or restart the service"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>From a chat to a lookup</h1>
        <p class="lead">On screens 1 and 2 you rebuilt what was live from a chat, and worked out by hand what going back would change. The team wants both answers in seconds next time.</p>
        <p class="task">Which change makes “which version is answering, and how do we go back?” a lookup?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. That is a <b>model registry</b>. A <b>registered model</b> (here <code>parcel-damage</code>) holds numbered <b>versions</b>; a new one never replaces an old one. An <b>alias</b> is a name that points at one version. The service asks for “parcel-damage, champion”, so the release is one move of the alias and the roll-back is one move back, with no file copied and no retraining. Which version is answering becomes: where does champion point?", true)
          : ans === 0 ? kit.feedback("You would keep old files, which helps. But the service still reads whatever was copied over <code>model.pkl</code>, so “which one is live?” is still answered by the chat. A date in a name also does not say which training run made it.", false)
          : kit.feedback("That is screen 1 again, with more discipline. It fails the first time someone forgets, and the chat still cannot tell you what is inside <code>model.pkl</code>. The answer should come from the system, not from people's memory.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Use it, with predictions: register, promote, load, roll back. */
  const STEPS = [
    { act: "The data scientist registers version 3.", q: "Where does champion point now?",
      opts: ["Still version 2", "Version 3: the newest version takes the alias", "Both 2 and 3"], right: 0,
      no: ["", "Registering only adds a version. Nothing moves an alias except someone setting it. That is the point: a new version is not a release.", "An alias points at one version. Registering version 3 does not touch it."],
      svc: "running version 2, loaded earlier", after: [[1, []], [2, ["champion"]], [3, []]], yes: "Right. Version 3 is in the registry, but nothing serves it yet." },
    { act: "The release: set champion to version 3.", q: "Which versions carry champion now?",
      opts: ["Only version 3", "Versions 2 and 3", "Version 3, and version 2 is deleted"], right: 0,
      no: ["", "One alias names one version. Setting it on version 3 takes it off version 2.", "Nothing is deleted. Version 2 stays in the registry, which is what makes the roll-back possible."],
      svc: "running version 2, loaded earlier", after: [[1, []], [2, []], [3, ["champion"]]], yes: "Right. The alias moved; version 2 is still there, untouched." },
    { act: "The locker service restarts and loads models:/parcel-damage@champion.", q: "Which version labels the photos?",
      opts: ["Version 2", "Version 3"], right: 1,
      no: ["The service asks for whatever champion points at when it loads. Champion points at version 3."],
      svc: "running version 3", after: [[1, []], [2, []], [3, ["champion"]]], yes: "Right. The service never names a version number; it follows the alias." },
    { act: "Complaints. Roll back: set champion to version 2. The service is still running.", q: "Which version labels the next photo?",
      opts: ["Version 2, at once", "Still version 3, until the service loads the model again", "None: the service fails because its version lost the alias"], right: 1,
      no: ["The alias is read when the model is loaded. A running service holds the model it loaded in memory and does not look at the registry again.", "", "The loaded model is already in the service's memory. Moving the alias does not break it, and does not change it either."],
      svc: "running version 3, loaded before the roll-back", after: [[1, []], [2, ["champion"]], [3, []]], yes: "Right. The roll-back is complete only when the service loads again: a restart, a redeploy, or a reload the service is built to do. That is the same rule as model.pkl on screen 1." }
  ];
  function useIt({ el, done, kit }) {
    style();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === STEPS.length, s = STEPS[Math.min(k, STEPS.length - 1)];
      const rows = (k === 0 ? [[1, []], [2, ["champion"]]] : STEPS[k - 1].after).map(([v, al]) => [v, al, short(TRAIN[v].run)]);
      el.innerHTML = `<h1>Promote and roll back</h1>
        <p class="lead">Now the team uses a registry. Versions 1 and 2 are registered, and the alias <b>champion</b> points at version 2. Each row links to the training run that made the version (you met runs in the last lesson).</p>
        ${regTable(rows)}
        <div class="vars"><span>locker service <b>${esc(k === 0 ? "running version 2, loaded earlier" : STEPS[k - 1].svc)}</b></span></div>
        ${fin ? kit.feedback(`You promoted with one move and rolled back with one move, and every version stayed in place. Next you will see these same ${WORDS[STEPS.length].toLowerCase()} steps as real MLflow calls, and their output.`, true)
          : `<p class="task">${esc(s.act)} ${esc(s.q)}</p><div class="lpanel">${kit.options(s.opts.map(esc), { picked: wrong, correct: s.right })}
          ${wrong != null ? kit.feedback(esc(s.no[wrong]), false) : k > 0 ? kit.feedback(esc(STEPS[k - 1].yes)) : ""}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== s.right) { wrong = i; paint(); return; }
        wrong = null; k++; paint();
        if (k === STEPS.length) done();
      });
      if (fin) el.querySelector(".fb").insertAdjacentHTML("beforebegin", kit.feedback(esc(STEPS[STEPS.length - 1].yes)));
    };
    paint();
  }

  /* 5. The same steps with MLflow, as a recorded run. */
  const LINES = CODE.map((_, j) => j); // one step per listing line, in order: the function has no branches
  function mlflowRun({ el, done, kit }) {
    style();
    let pred = null, k = 0;
    const SAY = [
      "<code>model_uri</code> is the address of the model that version 3's training run logged (with the last lesson's <code>log_model</code>). <code>client</code> is an <code>MlflowClient</code>, the object for registry calls.",
      "<code>register_model</code> adds a version to <code>parcel-damage</code>. MLflow prints that the name exists and makes version 3.",
      "The new version's number comes back on <code>mv.version</code>.",
      "Ask the registry which version champion points at.",
      "Still 2. Registering is not releasing.",
      "The release. The arguments are the model name, the alias and the version.",
      "<code>mlflow.pyfunc.load_model</code> loads a logged model as an object with <code>predict</code>. The address <code>models:/name@alias</code> asks by alias, so MLflow looks up champion now, at load time.",
      `Version 3's labels: ${SAYS_V3.filter(x => x === "damaged").length} of ${SAYS_V3.length} damaged.`,
      "The roll-back: one call, champion back on version 2. No file is copied, nothing is retrained.",
      "You predicted this: the same <code>service</code> object gives the same labels as the “service says” line. It holds version 3 in memory.",
      `A fresh load follows the alias: version 2, ${SAYS_V2.filter(x => x === "damaged").length} of ${SAYS_V2.length} damaged. ${andList(flipNames)} turn fine, as you worked out on screen 2.`
    ];
    const PRED_LINE = 9; // "after roll-back, same service says ..."
    const popts = ["Version 3's labels again, the same as “service says”", "Version 2's labels: champion points at 2 now", "An error: the version it loaded has lost the alias"];
    const paint = () => {
      const ln = LINES[k];
      // the variables as the run printed them: mv.version (line 2 prints it), champ.version (line 4 prints it)
      const vars = [["mv.version", k >= 1 ? MV_VERSION : "–"], ["champ.version", k >= 3 ? CHAMP_VERSION : "–"]];
      el.innerHTML = `<h1>The same steps in MLflow</h1>
        <p class="lead">MLflow, the tool from the last lesson, has a model registry. We ran this function once on our machine, against a local registry that already held versions 1 and 2, with champion on 2. <code>photos</code> is Saturday's six photos.</p>
        ${pred !== 0 ? `${codeW(CODE, PRED_LINE)}<p class="task"><code>service</code> is loaded while champion points at 3. Then champion is moved back to 2, and the highlighted line asks the same <code>service</code> for labels. What does it print?</p>
          <div class="lpanel">${kit.options(popts.map(esc), { picked: pred, correct: 0 })}
          ${pred == null ? "" : pred === 1 ? kit.feedback("<code>service</code> was loaded when champion pointed at 3. It is a model held in memory, and moving the alias does not reach into it. Only a fresh load, as on the last line, follows the alias to version 2.", false)
            : kit.feedback("The loaded model does not look at the registry again, so the alias moving away cannot break it. Nothing fails here.", false)}</div>`
        : `<p class="task">Right: version 3's labels. Step through the real run to check. Each step is one line of the function, and the variables show what the run printed.</p>
          ${codeW(CODE, ln)}
          <div class="vars"><span>step <b>${k + 1} / ${LINES.length}</b></span>${vars.map(([n, v]) => `<span>${esc(n)} <b>${esc(v)}</b></span>`).join("")}</div>
          <div class="lsteps"><button type="button" class="btn" data-prev ${k === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${k === LINES.length - 1 ? "disabled" : ""}>Next step</button></div>
          ${kit.feedback(SAY[k])}
          ${box("printed by this line", OUT[ln] ? OUT[ln].join("\n") : "(this line prints nothing)")}${cap(runCap)}`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
      const pv = el.querySelector("[data-prev]"), nx = el.querySelector("[data-next]");
      if (pv) pv.onclick = () => { k--; paint(); };
      if (nx) nx.onclick = () => { k++; paint(); if (k === LINES.length - 1) done(); };
    };
    paint();
  }

  /* 6. The address that matters: alias, pinned number, or a second alias. */
  const URIS = ["models:/parcel-damage@champion", "models:/parcel-damage/3", "models:/parcel-damage@challenger"];
  const NEEDS = [
    { q: "The locker service in production. It must follow every release and roll-back with no code change.", right: 0,
      yes: "Right. The alias is read at each load, so a release or roll-back in the registry reaches the service at its next start.",
      no: ["", "A version number never moves. Every release would need a config change and a redeploy, and a roll-back done in the registry would not reach the service.", "Challenger is the version being tried, not the one in charge."] },
    { q: "Reproduce Saturday's false alarm exactly, even if champion moves again tomorrow.", right: 1,
      yes: "Right. Version 3 answered on Saturday, and models:/parcel-damage/3 will mean that same model next month too.",
      no: ["Champion points at version 2 now. You would test the wrong model, and tomorrow maybe another.", "", "Challenger may move to another candidate next week. A bug report needs the exact version, which never changes."] },
    { q: "A shadow job scores the same photos with the candidate the team is testing, without affecting customers.", right: 2,
      yes: "Right. When the team tries a new candidate, they move challenger and the job follows, with no edit.",
      no: ["That is the production model, not the candidate.", "That pins one candidate. When the team tries a version 4, someone must edit the job.", ""] }
  ];
  function addresses({ el, done, kit }) {
    style();
    const ans = NEEDS.map(() => null);
    const paint = () => {
      const all = NEEDS.every((n, i) => ans[i] === n.right);
      el.innerHTML = `<h1>Which address to load?</h1>
        <p class="lead">A model in the registry has two kinds of address. <code>models:/parcel-damage/3</code> is a <b>pinned</b> version: it always means version 3. <code>models:/parcel-damage@champion</code> follows an alias wherever it points at load time. There can be more than one alias, and a version can carry several. In our run we put <b>challenger</b> on version 3, and champion stayed on 2. You choose alias names, but MLflow refuses two kinds: <code>v</code> plus a number, and <code>latest</code> in any case. In our run, setting <code>v3</code> gave <code>${esc(RESERVED_ERR)}</code> and setting <code>latest</code> gave <code>${esc(LATEST_ERR)}</code></p>
        <p class="task">For each job, pick the address it should load.</p>
        ${NEEDS.map((n, i) => `<div class="lcase" id="c${i}"><p>${esc(n.q)}</p>${kit.options(URIS.map(u => `<code>${esc(u)}</code>`), { picked: ans[i], correct: n.right })}
          ${ans[i] == null ? "" : kit.feedback(esc(ans[i] === n.right ? n.yes : n.no[ans[i]]), ans[i] === n.right)}</div>`).join("")}
        ${all ? kit.feedback("Rule of thumb: services load an alias, investigations load a number. Older tutorials use <b>stages</b> (Staging, Production) instead of aliases; MLflow deprecated stages in version 2.9.0, so new code uses aliases.") : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (NEEDS.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 7. Broken on purpose: the roll-back that did not reach the service. */
  function broken({ el, done, kit }) {
    style();
    // pickable lines: the deploy file, then the log; the cause is the MODEL_URI line
    // SHOWN keeps the "…" cut marks; only the real lines are pickable, numbered in LINES
    const SHOWN = [...DEPLOY_ENV.map(t => ({ t, f: "env" })), ...LOG_BROKEN.map(t => ({ t, f: "log" }))];
    const LINES = SHOWN.filter(l => l.t !== CUT);
    LINES.forEach((l, i) => { l.i = i; });
    const CAUSE = LINES.findIndex(l => l.t.startsWith("MODEL_URI="));
    const loadedRun = runIn(LOG_BROKEN.find(l => l.includes("loaded")));
    const fixedRun = runIn(LOG_FIXED.find(l => l.includes("loaded")));
    const why = i => {
      const t = LINES[i].t;
      if (t.startsWith("LOCKER_BANK") || t.startsWith("LOG_LEVEL")) return "That setting says which locker bank and how much to log. It does not choose a model.";
      if (t.includes("roll-back")) return "The roll-back worked: the registry table shows champion on version 2. The question is why the service did not follow it.";
      if (t.includes("restarting")) return "The restart happened, so this is not the “running service keeps its model” case from screen 4. The service did load again. Look at what it loaded.";
      if (t.includes("loaded")) return `This line shows the symptom. Run ${short(loadedRun)} is version ${runOf(loadedRun)}'s run (compare with the table), and the address is a pinned number. But the service code defaults to the alias. Something told it to load this address instead.`;
      return "This label is a symptom: it is version 3's answer for that photo. Find what made the service load version 3.";
    };
    const FIX = ["Delete MODEL_URI from deploy.env, so the code's default (the champion alias) applies, and restart", "Move champion to version 3 and back to 2, then restart", "Delete version 3 from the registry"];
    let pick = null, fix = null;
    const paint = () => {
      const found = pick === CAUSE;
      let head = "";
      el.innerHTML = `<h1>The roll-back that changed nothing</h1>
        <p class="lead">Monday 09:00, with the registry. The team moved champion back to version 2 and restarted the locker service. An hour later, Saturday's false alarms are still coming. We reproduced it on our machine. The service code picks its model with this line:</p>
        ${codeW([SERVICE_LINE], -1)}
        ${regTable(REGISTRY_MONDAY.map(([v, al]) => [v, al, short(TRAIN[v].run)]), { title: "Registry after the roll-back", note: "run_id" })}
        <p class="task">${found ? "Found it. Now pick the fix." : "Tap the line that causes the service to ignore the roll-back."}</p>
        <ul class="${P}lines">${SHOWN.map(l => {
          const h = l.f !== head ? `<span class="h">${l.f === "env" ? "deploy.env (the container's settings)" : "log of the run (cuts marked …: a warning, the env lines, four of the six photo lines)"}</span>` : "";
          head = l.f;
          if (l.t === CUT) return `<li class="${P}cut">${h}${CUT}</li>`;
          const i = l.i;
          return `<li>${h}<button type="button" data-i="${i}" class="${i === pick ? (found ? "yes" : "no") : ""}" ${found ? "disabled" : ""}>${esc(l.t)}</button></li>`;
        }).join("")}</ul>
        ${cap(runCap)}
        <div class="lpanel">${pick == null ? "" : found
          ? kit.feedback("Right. The deployment sets <code>MODEL_URI</code> to a pinned version number. <code>os.environ.get</code> uses the default only when the variable is missing, so the alias was never used. Someone pinned version 3 on Friday “to be sure it is live”. Every restart since has loaded version 3, wherever champion points.", true)
          : kit.feedback(why(pick), false)}
        ${found ? `<div id="fix">${kit.options(FIX.map(esc), { picked: fix, correct: 0 })}</div>
          ${fix == null ? "" : fix === 0 ? `${kit.feedback("Right. After the fix the service logs the alias address and version 2's run:", true)}${box("log after the fix (cuts marked …)", LOG_FIXED.join("\n"))}${cap(runCap)}${kit.feedback(`Run ${short(fixedRun)} is version ${runOf(fixedRun)}. Note the habit that made this findable: the service logs the address and the run id it loaded. Our run also wrote a tag on version ${TAG.version}, <code>${esc(TAG.key)}=${esc(TAG.value)}</code>, so the reason for the roll-back stays with the version.`)}`
            : fix === 1 ? kit.feedback("The alias is already right. The service never reads it, because MODEL_URI overrides the default. Moving it again changes nothing.", false)
            : kit.feedback(`Then the pinned address no longer resolves. On a copy of our registry, loading <code>models:/parcel-damage/3</code> after deleting version 3 gave <code>${esc(DELETED_ERR)}</code>, so the restarted service gets no model at all. And you lose the version you need to study Saturday's false alarms. Fix the address, keep the evidence.`, false)}` : ""}</div>`;
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); });
      el.querySelectorAll("#fix button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task: which cost bites first. */
  const COSTS = ["Running the registry", "Every service loading by alias, and saying what it loaded", "Keeping a history of alias moves yourself"];
  const SIT = [
    { q: "The disk under the registry's database fills up on a Sunday. Services that restart cannot load their model.", a: 0,
      yes: "Right. The registry is now a service you depend on: a server, a database and storage for model files, all needing backups and someone ready to fix them at any hour.",
      no: ["", "The services are loading by alias correctly. What they load from is down.", "History does not matter here. The registry itself is unreachable."] },
    { q: "A new team's fraud service reads a version number from its own config file. Their roll-backs never take effect.", a: 1,
      yes: "Right. The registry only helps services that ask it. That is screen 7 again, and the cure is a team rule plus a log line with the loaded version.",
      no: ["The registry is up and correct. The service does not ask it.", "", "The problem is now, not the past: the service ignores the alias."] },
    { q: "An auditor asks which version labelled a parcel three weeks ago. Champion has moved twice since.", a: 2,
      yes: "Right. The registry shows where each alias points now. To answer for a past date, record every move: a tag on the version, a line in a release log, or the version stored next to each prediction.",
      no: ["The registry is running fine. It just does not answer this question by itself.", "The services did load by alias. The question is where the alias pointed three weeks ago."] }
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = SIT.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to use a model registry</h1>
        <p class="lead"><b>What it is for:</b> knowing which model version answers, and changing it on purpose, with a way back. <b>Reach for it</b> when a service loads a model you retrain and release again and again, or when several people ship models. <b>Not</b> for a model trained once for a report: experiment tracking is enough. Not when you only call a hosted model through an API: you have no trained weights to register. There, version what you do change (the prompt and settings) with the same numbers-plus-alias idea, in git or in a prompt registry such as MLflow's. <b>What it costs:</b></p>
        <ul class="${P}cost"><li>a registry to run: a server with a database (MLflow's own server needs a database-backed store for its registry) and storage for model files;</li><li>discipline: every service loads by alias and logs what it loaded;</li><li>a history you keep yourself, since an alias shows only where it points now.</li></ul>
        <p class="task">For each situation, pick the cost that bites.</p>
        ${SIT.map((s, i) => `<div class="lcase" id="c${i}"><p>${esc(s.q)}</p>${kit.options(COSTS, { picked: ans[i], correct: s.a })}
          ${ans[i] == null ? "" : kit.feedback(esc(ans[i] === s.a ? s.yes : s.no[ans[i]]), ans[i] === s.a)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SIT.every((s, j) => ans[j] === s.a)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations, with "no" cases. */
  const CASES = [
    ["A bank retrains its card-fraud scoring model every month. Two data scientists train candidates, and a scoring API serves the chosen one.", true,
      "Yes. Repeated releases, several people, a service that loads the model. Register each candidate, move the alias to release, move it back if fraud slips through.",
      "This is the locker story with a different model: monthly releases by two people, and a service that must know which one it serves. That is what aliases and versions are for."],
    ["A support chatbot calls a hosted language model through the provider's API. The team never trains weights; they change the system prompt every week.", false,
      "No. A registry of trained model files has nothing to hold: the team trains no weights. The idea still applies to what does change, the prompt: numbered versions and a movable name for the live one, kept in git or in a prompt registry such as MLflow's, with a regression set run before each move.",
      "A registry of trained model files has nothing to hold here: the model is the provider's, and nobody trains weights. What changes weekly is the prompt. The versions-plus-alias idea does fit it, but through git or a prompt registry (MLflow has one), not by registering model files."],
    ["A researcher fits a model once to estimate last year's delivery delays for a report. Nothing will load it again.", false,
      "No. Nobody serves it, so there is nothing to promote or roll back. Tracking the run (the last lesson) keeps it reproducible.",
      "Promote and roll back need a service that loads the model and a model that changes. Here neither exists: one run, one report. Experiment tracking is enough."],
    ["A shop wants to try a new recommendation model on part of its traffic while the current one serves everyone else.", true,
      "Yes. Two aliases: champion for the main traffic, challenger for the trial. Each part of the service loads its alias, and promoting the winner is one alias move.",
      "Two models live at once, each needing a stable name: that is exactly two aliases, champion and challenger, in one registered model."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A registry here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the lockers.</p>
        <p class="task">For each one, decide whether a registry of trained model versions, with aliases, is the right tool. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook checklist (from our own run), then the next lesson. */
  const CHECKLIST = () => [
    `<code>register_model</code> prints “${esc(OUT[1][1])}”, and right after it champion still points at version 2.`,
    `The model loaded before the roll-back prints the same ${plural(SAYS_V3.filter(x => x === "damaged").length, "damaged label")} after champion moves back to 2; a fresh load prints ${plural(SAYS_V2.filter(x => x === "damaged").length, "damaged label")}.`,
    "After the roll-back, only version 2 lists <code>champion</code> in its aliases; version 3 has none.",
    `Setting an alias named <code>v3</code> raises <code>${esc(RESERVED_ERR)}</code>`,
    `With <code>MODEL_URI=models:/parcel-damage/3</code> set, the restarted service logs version 3's run id; without it, version 2's.`
  ];
  function whatNext({ el, done, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can promote and roll back a model</h1>
      <p class="lead">Register every version and never overwrite one. Let services load an alias, release by moving it, roll back by moving it back, then make the service load again. Pin a version number only to reproduce a past answer. Log the version a service loaded, and record why an alias moved.</p>
      ${NOTEBOOK_URL ? `<p><a class="btn ${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a></p>` : ""}
      <p class="lead">${NOTEBOOK_URL ? "Run it top to bottom and tick what you see:" : "The notebook for this lesson is on its way. When it is here, run it and tick what you see:"}</p>
      <ul class="${P}list">${CHECKLIST().map((t, i) => `<li><button type="button" aria-pressed="false" data-k="${i}"><span>${t}</span></button></li>`).join("")}</ul>
      ${nx ? `<p class="lead" style="margin-top:18px">Next: <b>${esc(nx.title)}</b>. Each version here points at the run that trained it. The next lesson makes that run point at the exact data it saw, so an old version can be rebuilt.</p>` : ""}`;
    // ticking is optional and saves nothing
    el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"));
    done();
  }

  LessonKit.define(ID, {
    title: "A model registry and promoting versions",
    checked: "2026-11-14",
    sources: [
      "https://mlflow.org/docs/latest/ml/model-registry/",
      "https://mlflow.org/docs/latest/ml/model-registry/workflow/",
      "https://mlflow.org/docs/latest/api_reference/python_api/mlflow.client.html",
      "https://mlflow.org/docs/latest/api_reference/python_api/mlflow.pyfunc.html",
      "https://mlflow.org/docs/latest/genai/prompt-registry/",
      "https://docs.python.org/3/library/os.html#os.environ"
    ],
    interview: [{
      q: "You released a new model version on Friday and complaints spiked over the weekend. Walk me through the roll-back, and how you would know it worked.",
      good: [
        "Move the production alias back to the previous version in the registry; nothing is retrained or copied",
        "Make the service load again (restart or redeploy), since a running process keeps the model it loaded",
        "Check what the service actually loaded: it should log the address and version or run id, and that must match the registry",
        "Check that no config pins a version number that overrides the alias",
        "Keep the bad version for investigation, record why the alias moved, and remember the roll-back does not undo past predictions"
      ],
      weak: "“Retrain the old model and redeploy it” or “delete the new version”. It is slow, it loses the evidence, and it never checks which version the service really loads."
    }, {
      q: "Two teams load the same model. One reads models:/name@champion, the other has version 7 in its config. When is each right?",
      good: [
        "A production service should load the alias, so releases and roll-backs reach it with no code change",
        "A pinned number is right for reproducing a past answer, a bug report or an audit, because it never moves",
        "A pinned number in production silently ignores every alias move; it was the cause of a roll-back that did nothing",
        "A candidate under test gets its own alias, such as challenger, rather than a number"
      ],
      weak: "“Always pin the version, it is safer.” It is safer for reproducing, but in a service it means every release and roll-back needs a config change, and the registry stops being the place that says what is live."
    }],
    screens: [byHand, rollBackByHand, spotIdea, useIt, mlflowRun, addresses, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: COMPLAINTS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ['[data-i="2"]', "[data-check]"], right: [...FLIPS.map(i => `[data-i="${i}"]`), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(STEPS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(LINES.length - 1).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: NEEDS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ['[data-i="3"]'], right: ['[data-i="1"]', "#fix [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SIT.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
