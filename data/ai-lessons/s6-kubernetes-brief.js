/* Lesson s6-kubernetes-brief: Kubernetes in brief for model services.
   Story: a ticket-booking site's seat-question bot gets ten times its usual traffic the morning concert sales
   open (10:00). The learner predicts the pod count hour by hour from the autoscaler's target, finds why users
   still wait at 10:00 (new pods are not ready yet: cold start), applies the documented autoscaler rule to four
   checks, steps through it in Python, works out what happens when a pod crashes, finds the two lines of a
   kubectl-generated Deployment that would hurt this service, reads the finished config (tap the line the 60% is
   measured against), then the big picture and new situations.
   Ideas: (1) Deployment + Service + HorizontalPodAutoscaler: copies of a container, one address for them, a
   rule that changes the count; (2) the autoscaler reacts to load it already sees, and a new pod serves nothing
   until it is ready, so cold starts hurt at a sudden jump.
   Runs (docs/ai-path/runs/s6-kubernetes-brief/): hpa_rule.py -> hpa_rule.out.txt (our six-line version of the
   documented rule, traced; the hourly counts), skeleton.sh -> skeleton.out.txt (kubectl output made with
   --dry-run=client and --local, no cluster), seat-bot.yaml (the finished config, written from the docs and
   NOT applied to any cluster; yaml_check.out.txt is only a syntax check), env.txt.
   No model calls were recorded for this lesson. Story inputs (traffic per hour, 20 questions a minute per pod,
   90 s to start a pod) are the story's own numbers, not measurements. Every other number on screen is computed
   here from them. Lesson-local CSS (prefix lx-s6-kubernetes-brief-): clickable YAML lines, a small caption. */
(() => {
  const ID = "s6-kubernetes-brief";
  const P = "lx-s6-kubernetes-brief-";
  const CHECKED = "2026-11-14";
  const HPA_RUN = "2026-11-14";       // hpa_rule.py re-run with the def line split for the phone
  const SKELETON_RUN = "2026-11-13";  // skeleton.sh run

  /* ---------- the story's inputs ---------- */
  // questions per minute, flat within each hour (a simplification), from hpa_rule.py TRAFFIC
  const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"];
  const TRAFFIC = [20, 30, 300, 170, 70, 34];
  const PER_POD = 20;        // questions a minute one pod answers at 100% of its CPU request
  const TARGET = 60;         // averageUtilization in the autoscaler, %
  const MIN = 2, MAX = 16;   // minReplicas, maxReplicas
  const TOL = 0.1;           // the documented default tolerance
  const COLD_S = 90;         // seconds from "pod created" to "pod ready" in this story (image pull + model load)
  const SALE = HOURS.indexOf("10:00");

  /* ---------- the rule (same as hpa_rule.py) ---------- */
  const desired = (pods, cpu) => {
    const ratio = cpu / TARGET;
    if (Math.abs(ratio - 1) <= TOL) return pods;
    return Math.max(MIN, Math.min(MAX, Math.ceil(pods * ratio)));
  };
  const busy = (perMin, pods) => perMin / (pods * PER_POD) * 100;
  // the count each hour settles at, applying the rule at every check while the hour's traffic holds
  const SETTLED = (() => {
    let pods = MIN; const out = [];
    TRAFFIC.forEach(t => {
      for (let k = 0; k < 20; k++) { const n = desired(pods, busy(t, pods)); if (n === pods) break; pods = n; }
      out.push(pods);
    });
    return out;
  })();
  // From docs/ai-path/runs/s6-kubernetes-brief/hpa_rule.out.txt ("# hourly settle": hour, per_minute, settled)
  const RUN_HOURLY = [["08:00", 20, 2], ["09:00", 30, 3], ["10:00", 300, 16], ["11:00", 170, 15], ["12:00", 70, 6], ["13:00", 34, 3]];
  if (RUN_HOURLY.some(([h, t, s], i) => h !== HOURS[i] || t !== TRAFFIC[i] || s !== SETTLED[i])) console.error(ID + ": hourly counts differ from the recorded run");
  const PER_POD_AT_TARGET = PER_POD * TARGET / 100;   // questions a minute per pod at the target

  /* ---------- the four checks, traced in Python ---------- */
  // From docs/ai-path/runs/s6-kubernetes-brief/hpa_rule.out.txt ("# traced checks"); each step: [line, l(ine)|r(eturn), ratio, wanted]
  const TRACES = [{"pods":6,"cpu_now":90,"result":9,"steps":[[2,"l",null,null],[3,"l",1.5,null],[5,"l",1.5,null],[6,"l",1.5,9],[6,"r",1.5,9]]},{"pods":9,"cpu_now":64,"result":9,"steps":[[2,"l",null,null],[3,"l",1.0666666666666667,null],[4,"l",1.0666666666666667,null],[4,"r",1.0666666666666667,null]]},{"pods":12,"cpu_now":120,"result":16,"steps":[[2,"l",null,null],[3,"l",2.0,null],[5,"l",2.0,null],[6,"l",2.0,24],[6,"r",2.0,24]]},{"pods":16,"cpu_now":21,"result":6,"steps":[[2,"l",null,null],[3,"l",0.35,null],[5,"l",0.35,null],[6,"l",0.35,6],[6,"r",0.35,6]]}];
  const CHECKS = TRACES.map(t => [t.pods, t.cpu_now]);
  if (TRACES.some(t => t.result !== desired(t.pods, t.cpu_now))) console.error(ID + ": JS rule differs from the recorded run");

  /* ---------- kubectl output, run on our Mac with no cluster ---------- */
  // From docs/ai-path/runs/s6-kubernetes-brief/skeleton.out.txt (first command), lines kept as printed
  const SKELETON = ["apiVersion: apps/v1", "kind: Deployment", "metadata:", "  labels:", "    app: seat-bot", "  name: seat-bot", "spec:", "  replicas: 1", "  selector:", "    matchLabels:", "      app: seat-bot", "  strategy: {}", "  template:", "    metadata:", "      labels:", "        app: seat-bot", "    spec:", "      containers:", "      - image: registry.example/seat-bot:1.4", "        name: seat-bot", "        ports:", "        - containerPort: 8000", "        resources: {}", "status: {}"];
  const SK_FROM = SKELETON.indexOf("spec:");
  const BAD_REPLICAS = SKELETON.indexOf("  replicas: 1"), BAD_RES = SKELETON.indexOf("        resources: {}");
  // From docs/ai-path/runs/s6-kubernetes-brief/seat-bot.yaml (not applied to any cluster): the Deployment's container, then the autoscaler
  // (lines copied as written, from resources: on; "…" marks lines left out)
  const FINAL_POD = ["        resources:", "          requests:", "            cpu: \"1\"", "            memory: 3Gi", "          limits:", "            memory: 3Gi", "        startupProbe:", "          httpGet:", "            path: /ready", "            port: 8000", "          periodSeconds: 5", "          failureThreshold: 36", "        readinessProbe:", "          httpGet:", "            path: /ready", "            port: 8000", "          periodSeconds: 5"];
  const FINAL_HPA = ["apiVersion: autoscaling/v2", "kind: HorizontalPodAutoscaler", "metadata:", "  name: seat-bot", "spec:", "  scaleTargetRef:", "    apiVersion: apps/v1", "    kind: Deployment", "    name: seat-bot", `  minReplicas: ${MIN}`, `  maxReplicas: ${MAX}`, "  metrics:", "  - type: Resource", "    resource:", "      name: cpu", "      target:", "        type: Utilization", `        averageUtilization: ${TARGET}`];
  const CPU_REQ = FINAL_POD.indexOf("            cpu: \"1\"");
  const STARTUP_PERIOD = 5, STARTUP_FAILS = 36;

  const pct = n => `${Math.round(n)}%`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}yaml { margin: 16px 0 0; padding: 8px 0; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); font: 500 13px/1.4 var(--mono); }
.${P}yaml .${P}ln { display: block; width: 100%; min-height: 44px; padding: 0 12px; border: 0; border-left: 3px solid transparent; background: transparent; color: inherit; font: inherit; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}yaml button.${P}ln { cursor: pointer; }
.${P}yaml button.${P}ln:hover { background: color-mix(in srgb, var(--code-ink) 10%, var(--code-bg)); }
.${P}yaml .${P}ln.cut { min-height: 28px; display: flex; align-items: center; color: var(--code-dim); }
.${P}yaml .${P}ln.no { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--code-bg)); }
.${P}yaml .${P}ln.ok { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--code-bg)); }
.${P}note { font-size: 15px; }
.${P}link { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); }
.${P}cap { display: block; margin-top: 6px; font: 500 12px var(--mono); color: var(--muted); }
`;
    document.head.appendChild(s);
  }

  /* 1. The situation: three copies, ten times the questions. */
  function situation({ el, done, kit }) {
    let ans = null;
    const pods = SETTLED[SALE - 1], usual = TRAFFIC[SALE - 1], spike = TRAFFIC[SALE];
    const right = spike - pods * PER_POD;
    const opts = [right, spike - PER_POD, spike / pods, 0].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const say = {
      [spike - PER_POD]: `That counts one copy. There are ${pods}, and together they answer ${pods} × ${PER_POD} = ${pods * PER_POD} a minute.`,
      [spike / pods]: `${spike} ÷ ${pods} = ${spike / pods} is how many questions each copy would be sent. Each copy can answer only ${PER_POD} of them; the rest wait.`,
      0: `${pods} copies answer ${pods} × ${PER_POD} = ${pods * PER_POD} questions a minute. That covered the usual ${usual}, not ${spike}.`
    };
    const paint = () => {
      el.innerHTML = `<h1>The morning concert sales open</h1>
        <p class="lead">A ticket-booking site has a bot that answers seat questions: “Can I see the stage from row K?”, “Is block C step-free?”. It is a small model server packed in a Docker container, as in the Docker lesson. On a normal morning it gets about <b>${usual} questions a minute</b>, and ${pods} copies of the container run. Each copy answers up to <b>${PER_POD} a minute</b>.</p>
        <p class="lead">At 10:00 the sale for a big concert opens, and <b>${spike} questions a minute</b> arrive: ${spike / usual} times the usual. This lesson is about that moment: how a model service gets more copies when traffic jumps, and fewer when it falls.</p>
        <p class="task">At 10:00, how many questions each minute find no copy free to answer them?</p>
        <div class="lp-cap" style="margin-top:16px">questions a minute</div>
        ${kit.bars([usual, spike], { labels: ["09:00", "10:00"], cls: { 0: "in", 1: "in" }, frames: [[1, 1]] })}
        <div class="lpanel">${kit.options(opts.map(String), { picked: ans == null ? null : opts.indexOf(ans), correct: opts.indexOf(right), num: true })}
        ${ans == null ? "" : ans === right
          ? kit.feedback(`Right: ${spike} − ${pods} × ${PER_POD} = <b>${right}</b> questions a minute queue up, and many time out. You need more copies, on more machines, within minutes, and fewer again after lunch so you do not pay for idle ones. <b>Kubernetes</b> is a system that runs copies of containers across a group of machines (a <b>cluster</b>) and keeps them running. This lesson reads the three pieces of its config that matter here, and asks what happens at 10:00.`, true)
          : kit.feedback(say[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = opts[+b.dataset.i]; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 2. By hand: predict the pod count each hour. */
  function byHand({ el, done, kit }) {
    let h = 0, wrong = null;
    const ROWS = [["one pod answers", `${PER_POD} questions a minute when it uses 100% of the CPU it asked for`], ["autoscaler target", `${TARGET}% busy, on average`], ["fewest pods", String(MIN)], ["most pods", String(MAX)]];
    const paint = () => {
      const fin = h >= HOURS.length;
      const t = fin ? 0 : TRAFFIC[h], prev = h === 0 ? MIN : SETTLED[h - 1], right = fin ? 0 : SETTLED[h];
      const raw = t / PER_POD_AT_TARGET;
      const cand = fin ? [] : [
        [right, ""],
        [Math.max(MIN, Math.min(MAX, Math.ceil(t / PER_POD))), `That keeps every pod 100% busy: ${t} ÷ ${PER_POD}. The target is ${TARGET}%, so each pod should get only ${PER_POD_AT_TARGET} questions a minute: ${t} ÷ ${PER_POD_AT_TARGET} = ${raw.toFixed(2)}, rounded up.`],
        ...(Math.ceil(raw) > MAX ? [[Math.ceil(raw), `${t} ÷ ${PER_POD_AT_TARGET} = ${raw.toFixed(2)} rounds up to ${Math.ceil(raw)}, but the autoscaler never goes above ${MAX} pods. The last ${Math.ceil(raw) - MAX} are never started; the ${MAX} that run are busier than ${TARGET}%.`]] : []),
        [Math.floor(raw), Math.floor(raw) < MIN
          ? `${t} ÷ ${PER_POD_AT_TARGET} = ${raw.toFixed(2)}, and the autoscaler never goes below ${MIN} pods. The minimum keeps a spare copy for quiet hours, so one crash does not take the bot down.`
          : `${t} ÷ ${PER_POD_AT_TARGET} = ${raw.toFixed(2)}. Rounding down leaves the pods above ${TARGET}% busy. The count is always rounded up.`],
        [prev, `${prev} pods was the last hour's count. At ${t} questions a minute they would be ${pct(busy(t, prev))} busy: ${busy(t, prev) > TARGET ? "above" : "below"} the ${TARGET}% target, so the autoscaler ${busy(t, prev) > TARGET ? "adds" : "removes"} pods until the average is close to ${TARGET}% again.`],
        [right + 1, `${t} ÷ ${PER_POD_AT_TARGET} = ${raw.toFixed(2)}, rounded up to ${right}. One more pod would sit below the target and cost money for nothing.`]
      ];
      const seen = new Set(), opts = [];
      cand.forEach(([v, s]) => { if (!seen.has(v) && opts.length < 4) { seen.add(v); opts.push([v, s]); } });
      opts.sort((a, b) => a[0] - b[0]);
      const cls = {}; for (let i = 0; i < HOURS.length; i++) cls[i] = i < h ? "in" : i === h ? "next" : "";
      el.innerHTML = `<h1>Predict the pods, hour by hour</h1>
        <p class="lead">In Kubernetes, one running copy of your container is called a <b>pod</b>. It has its own address. An <b>autoscaler</b> adds or removes pods until the average pod is about ${TARGET}% busy.</p>
        <p class="lead">What is 100% busy? Each pod tells Kubernetes how much CPU to reserve for it. That reserved amount counts as 100%.</p>
        ${kit.table(ROWS, { head: ["setting", "value"], title: "The bot's config, in words" })}
        <div class="lp-cap" style="margin-top:16px">questions a minute on sale day (the story's example, flat within each hour)</div>
        ${kit.bars(TRAFFIC, { labels: HOURS, cls: fin ? {} : cls, frames: fin ? [] : [[h, 1]] })}
        ${fin ? "" : `<p class="task">${HOURS[h]}: ${t} questions a minute. How many pods run once the autoscaler stops changing the count? (${MIN} to ${MAX}; at ${TARGET}% each pod gets ${PER_POD_AT_TARGET} a minute.)</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(o => String(o[0])), { picked: wrong == null ? null : opts.findIndex(o => o[0] === wrong), correct: opts.findIndex(o => o[0] === right), num: true })}
        ${wrong != null ? kit.feedback(opts.find(o => o[0] === wrong)[1], false) : ""}
        ${h > 0 ? `<div class="lp-cap" style="margin-top:16px">pods each hour, so far</div>${kit.bars(HOURS.map((_, i) => i < h ? SETTLED[i] : 0), { labels: HOURS, cls: Object.fromEntries(HOURS.map((_, i) => [i, "in"])), frames: h > SALE ? [[SALE, 1]] : [] })}` : ""}
        ${fin ? kit.feedback(`Done: ${SETTLED.join(", ")} pods. At ${HOURS[SALE]} the count jumps from ${SETTLED[SALE - 1]} to ${SETTLED[SALE]}, the framed bar, and even ${SETTLED[SALE]} pods run ${pct(busy(TRAFFIC[SALE], SETTLED[SALE]))} busy: ${MAX} is the ceiling you set, to cap the bill. After lunch the count falls again on its own. Hold on to that jump: it is where users get hurt.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i][0];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; h++; paint(); if (h >= HOURS.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the rule says 16, but users still wait. */
  function spotIdea({ el, done, kit }) {
    let ans = null;
    const before = SETTLED[SALE - 1], after = SETTLED[SALE];
    const opts = [
      "The Service that sends questions to pods must be edited by hand to include the new pods",
      `New pods take about ${COLD_S} s to start, and questions go only to pods that report ready, so for the first minutes the ${before} old pods carry the load`,
      "The autoscaler waits 5 minutes before it adds pods, so that it does not react to short bumps"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Why do users still wait at 10:00?</h1>
        <p class="lead">The rule asks for ${after} pods at 10:00. Yet the site's logs show slow answers and time-outs for the first few minutes after 10:00, then calm. In this story a new pod needs about <b>${COLD_S} seconds</b> before it can answer: the machine downloads the container image, then the server loads the model into memory.</p>
        <p class="lead">One more piece: a <b>Service</b> gives the pods one stable address. The web site sends every question to the Service, and the Service passes it on to one of the pods.</p>
        <p class="task">Why do users wait, even though the autoscaler asked for ${after} pods?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The autoscaler only reacts to load it already sees, and a pod that is still loading its model answers nothing. Kubernetes asks each pod “are you ready?” with a <b>readiness probe</b>, and the Service sends questions only to pods that say yes. So between “${after} pods asked for” and “${after} pods ready” sits the <b>cold start</b>, and longer still if the cluster must first add a machine for them. That is the core trade: autoscaling saves money on quiet hours and pays for it in the first minutes of a sudden jump. For a jump you know is coming, like a 10:00 sale, you raise the minimum before it.`, true)
          : ans === 0 ? kit.feedback("The Service does not list pods by name. It picks every pod with a matching label, and pods made from the same template carry that label. A new pod joins on its own, as soon as it reports ready.", false)
          : kit.feedback("A 5-minute wait exists, but for scaling down: the autoscaler keeps the highest count it asked for in the last 5 minutes, so pods are not removed on a short dip. Scaling up has no such wait by default; it may add up to double the pods, or 4 pods, every 15 seconds, whichever is more.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. The real rule, applied to four checks with predictions. */
  function useRule({ el, done, kit }) {
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k >= CHECKS.length;
      const [pods, cpu] = fin ? CHECKS[CHECKS.length - 1] : CHECKS[k];
      const ratio = cpu / TARGET, raw = Math.ceil(pods * ratio), right = desired(pods, cpu);
      const cand = [
        [right, ""],
        [raw, raw > MAX ? `${pods} × ${ratio.toFixed(2)} = ${(pods * ratio).toFixed(2)}, rounded up to ${raw}. But the count never goes above maxReplicas, ${MAX}.` : `${pods} × ${ratio.toFixed(2)} = ${(pods * ratio).toFixed(2)}, rounded up to ${raw}. But ${cpu}% ÷ ${TARGET}% = ${ratio.toFixed(2)} is within 0.1 of 1, so the autoscaler leaves the count alone. That stops it adding and removing pods on every small wobble.`],
        [pods, ratio < 1
          ? `${pods} is what keeps running for a while (more on that in a moment), but it is not what the rule asks for. ${cpu}% ÷ ${TARGET}% = ${ratio.toFixed(2)} is far from 1, so the rule multiplies the count by it.`
          : `Leaving the count alone happens only when ${cpu}% ÷ ${TARGET}% is within 0.1 of 1. Here it is ${ratio.toFixed(2)}.`],
        ...(ratio < 1 ? [] : [[pods * 2, right === pods
          ? `Above the target does not mean double. Here ${cpu}% ÷ ${TARGET}% = ${ratio.toFixed(2)} is within 0.1 of 1, so the count stays as it is.`
          : `Above the target does not mean double. The count is multiplied by ${cpu} ÷ ${TARGET} = ${ratio.toFixed(2)}.`]]),
        [Math.max(MIN, Math.floor(pods * ratio)), `${pods} × ${ratio.toFixed(2)} = ${(pods * ratio).toFixed(2)}. The rule rounds up, never down.`],
        [MIN, `Low load does not send the count straight to the minimum. The count is multiplied by ${cpu} ÷ ${TARGET} = ${ratio.toFixed(2)}.`]
      ];
      const seen = new Set(), opts = [];
      cand.forEach(([v, s]) => { if (!seen.has(v) && opts.length < 3) { seen.add(v); opts.push([v, s]); } });
      opts.sort((a, b) => a[0] - b[0]);
      const done1 = CHECKS.slice(0, k).map(([p, c], i) => [`${p} pods at ${c}%`, `→ ${TRACES[i].result}`]);
      el.innerHTML = `<h1>The rule the autoscaler really uses</h1>
        <p class="lead">By default, every 15 seconds the autoscaler reads the pods' average CPU use, as a percent of the CPU each pod asked for, and computes:</p>
        <p class="lead"><b>new count = current count × (CPU now ÷ ${TARGET}%), rounded up</b>, kept between ${MIN} and ${MAX}. If CPU now ÷ ${TARGET}% is within 0.1 of 1, it changes nothing.</p>
        ${fin ? "" : `<p class="task">Check ${k + 1} of ${CHECKS.length}: <b>${pods} pods</b> are running at <b>${cpu}%</b> on average. What count does the rule ask for?</p>`}
        ${done1.length ? kit.table(done1, { head: ["check", "rule asks for"], title: "Your checks" }) : ""}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(o => String(o[0])), { picked: wrong == null ? null : opts.findIndex(o => o[0] === wrong), correct: opts.findIndex(o => o[0] === right), num: true })}
        ${wrong != null ? kit.feedback(opts.find(o => o[0] === wrong)[1], false) : ""}
        ${fin ? kit.feedback(`All four right. The last one has a catch: the rule asks for ${TRACES[3].result}, but the pods do not go yet. When scaling down, the autoscaler uses the highest count it asked for in the last 5 minutes, so ${CHECKS[3][0]} pods stay until the low load has lasted 5 minutes. That protects you from a short dip followed by a new rush, when removed pods would have to cold-start again.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i][0];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint(); if (k >= CHECKS.length) done();
      });
    };
    paint();
  }

  /* 5. The same rule in Python, stepped from a real trace. */
  const CODE = [
    "def desired_replicas(pods, cpu_now,",
    `        target=${TARGET}, low=${MIN}, high=${MAX}):`,
    "    ratio = cpu_now / target",
    `    if abs(ratio - 1) <= ${TOL}:`,
    "        return pods",
    "    wanted = math.ceil(pods * ratio)",
    "    return max(low, min(high, wanted))"
  ];
  const FR = (() => {
    const fr = [];
    TRACES.forEach((t, r) => t.steps.forEach(([line, ev, ratio, wanted]) => {
      const call = `desired_replicas(${t.pods}, ${t.cpu_now})`;
      let say;
      if (ev === "r") say = `Returns <b>${t.result}</b>.${t.result !== wanted && wanted != null ? ` The ${wanted} was capped at high = ${MAX}.` : ""}${r === 3 ? " The 5-minute wait for scaling down lives outside this function, in the part of the autoscaler that calls it." : ""}`;
      else if (line === 2) say = `${call}: ${t.pods} pods at ${t.cpu_now}%. Next: work out the ratio.`;
      else if (line === 3) say = `ratio = ${t.cpu_now} / ${TARGET} = ${+ratio.toFixed(4)}. Is it within ${TOL} of 1?`;
      else if (line === 4) say = `Yes: |${+ratio.toFixed(4)} − 1| ≤ ${TOL}. Keep ${t.pods} pods.`;
      else if (line === 5) say = `No: |${+ratio.toFixed(4)} − 1| is more than ${TOL}. Scale by the ratio.`;
      else say = `wanted = ceil(${t.pods} × ${+ratio.toFixed(4)}) = ${wanted}. Now keep it between ${MIN} and ${MAX}.`;
      fr.push({ ln: line, r, ratio, wanted, ret: ev === "r", say });
    }));
    return fr;
  })();
  function inPython({ el, done, kit }) {
    style();
    let i = 0;
    const paint = () => {
      const f = FR[i], t = TRACES[f.r];
      el.innerHTML = `<h1>The same rule in Python</h1>
        <p class="lead">Our short version of the documented rule, run on the four checks you just did. It leaves out what the real controller also handles: pods not ready yet, missing readings, the speed limit on adding pods, and the 5-minute wait for removing them.</p>
        <p class="task">Step through all four calls. Watch which line returns each time.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>call <b>${f.r + 1} / ${TRACES.length}</b></span><span>pods <b>${t.pods}</b></span><span>cpu_now <b>${t.cpu_now}</b></span><span>ratio <b>${f.ratio == null ? "–" : +f.ratio.toFixed(4)}</b></span><span>wanted <b>${f.wanted == null ? "–" : f.wanted}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(f.say)}
        <span class="${P}cap">Steps and values from our run of hpa_rule.py, ${HPA_RUN}</span>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. A pod crashes at 10:20. */
  function crash({ el, done, kit }) {
    const n = SETTLED[SALE], t = TRAFFIC[SALE];
    const after = busy(t, n - 1);
    const QS = [
      { q: `10:20. ${n} pods are running. One pod's model server crashes on a strange input and exits. What happens to the questions?`,
        opts: [`Questions that pod was answering fail; new questions go only to the ${n - 1} pods that are still ready`, "The Service keeps sending questions to it until someone deletes the pod", "All questions pause until a replacement pod is ready"], correct: 0,
        right: `Right. A pod whose server is down is no longer ready, so the Service stops sending it questions. Only the questions it held are lost; the web site can retry those.`,
        wrong: [null, "The Service follows readiness. Once the pod is not ready, it is taken off the Service's list of addresses, with no one touching it.", `The other ${n - 1} pods keep answering. A crash costs one pod's share, not the whole service.`] },
      { q: "What brings that pod back?",
        opts: [`The autoscaler sees one pod fewer and starts a new one`, "The machine's Kubernetes agent (the kubelet) restarts the container in the same pod; if it keeps crashing, it waits 10 s, 20 s, 40 s… up to 5 minutes between tries", "Nothing: someone must apply the config again"], correct: 1,
        right: "Right. The container restarts in place, and the restart pays the cold start again. A pod stuck crashing and waiting longer each time shows the status CrashLoopBackOff. If the whole machine dies, the Deployment makes a new pod on another machine to keep the count.",
        wrong: ["The autoscaler watches load, not crashes. Keeping the count you asked for is the Deployment's job, and a crashed container is restarted on its own machine first.", null, "Kubernetes keeps comparing what runs with what the config asks for, and repairs the difference. That is the point of declaring a count instead of starting copies by hand."] },
      { q: `While it restarts, ${n - 1} pods share the ${t} questions a minute. How busy is each one now?`,
        opts: [pct(TARGET), pct(busy(t, n)), pct(after)], correct: 2,
        right: `Right: ${t} ÷ (${n - 1} × ${PER_POD}) = ${pct(after)}. The count was already at the ceiling of ${MAX}, so there was no spare room. At the ceiling, one crash means every other pod runs flat out. That is a reason to set the ceiling with some margin above the busiest hour you expect.`,
        wrong: [`${TARGET}% is the target, not what the pods run at. At the ceiling of ${MAX} the autoscaler cannot add pods to get back to it.`, `${pct(busy(t, n))} is the load with all ${n} pods. One fewer pod means the same questions shared by ${n - 1}.`, null] }
    ];
    const picked = QS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A pod crashes at 10:20</h1>
        <p class="lead">So far: traffic. Now: failure. The pods are made by a <b>Deployment</b>, the part of the config that says “run this container, this many copies, and keep them running”.</p>
        <p class="task">Answer the three questions in order.</p>
        ${QS.map((x, k) => `<div class="lcase" id="c${k}"><p>${kit.esc(x.q)}</p>${kit.options(x.opts.map(kit.esc), { picked: picked[k], correct: x.correct })}
          ${picked[k] == null ? "" : picked[k] === x.correct ? kit.feedback(x.right, true) : kit.feedback(x.wrong[picked[k]], false)}</div>`).join("")}`;
      QS.forEach((x, k) => el.querySelectorAll(`#c${k} .lopts button`).forEach(b => b.onclick = () => {
        picked[k] = +b.dataset.i; paint();
        if (QS.every((y, j) => picked[j] === y.correct)) done();
      }));
    };
    paint();
  }

  /* 7. The real config: what kubectl writes, what it leaves out. */
  function realConfig({ el, done, kit }) {
    style();
    const found = new Set();
    let last = null;
    const FB = {
      [BAD_REPLICAS]: `Yes. <code>replicas: 1</code> fixes the count in the file. With an autoscaler on, every <code>kubectl apply</code> of this file would set the count back to 1, even mid-sale, until the autoscaler raises it again. The docs advise removing <code>replicas</code> from the Deployment when an autoscaler manages it.`,
      [BAD_RES]: `Yes. <code>resources: {}</code> means the pod asks for no CPU. The autoscaler's ${TARGET}% is a percent of the CPU the pod asked for, With no request there is no 100% to measure against, so the autoscaler takes no action on CPU. The request also tells Kubernetes how much room to reserve on a machine.`
    };
    const other = i => {
      const s = SKELETON[i];
      if (/app: seat-bot|labels|selector|matchLabels/.test(s)) return "The label and the selector are how the Deployment finds its pods; the Service uses the same label. This part is needed as it is.";
      if (/containerPort/.test(s)) return "The port the model server listens on. The Service will forward to it. Fine as it is.";
      if (/strategy/.test(s)) return "Empty means the default: replace pods a few at a time when you ship a new version. Fine for now.";
      if (/image/.test(s)) return "The container image from the Docker lesson. Fine as it is.";
      return "This line is plain structure that every Deployment has. Look for a line that fights the autoscaler, or one that leaves it without the number it needs.";
    };
    const paint = () => {
      const fin = found.size === 2;
      const lines = SKELETON.slice(SK_FROM, BAD_RES + 1).map((s, j) => {
        const i = SK_FROM + j, st = found.has(i) ? " ok" : last === i && !FB[i] ? " no" : "";
        return fin ? `<div class="${P}ln${st}">${kit.esc(s)}</div>` : `<button type="button" class="${P}ln${st}" data-i="${i}">${kit.esc(s)}</button>`;
      });
      el.innerHTML = `<h1>The real config</h1>
        <p class="lead">You can ask <code>kubectl</code>, Kubernetes' command-line tool, to write a Deployment for you without any cluster: <code>kubectl create deployment seat-bot --image=… --port=8000 --dry-run=client -o yaml</code>. We ran it on our laptop; here is the part under <code>spec:</code>, as printed.</p>
        <p class="task">Tap the two lines that would hurt this bot once the autoscaler is switched on.</p>
        <div class="${P}yaml"><div class="${P}ln cut">…</div>${lines.join("")}<div class="${P}ln cut">…</div></div>
        <span class="${P}cap">kubectl output from our run, ${SKELETON_RUN} (skeleton.out.txt)</span>
        <div class="lpanel">${last == null ? "" : FB[last] ? kit.feedback(FB[last] + (fin ? "" : " One more line to find."), true) : kit.feedback(other(last), false)}
        ${fin ? `<p class="lead" style="margin-top:16px">Next screen: the fixed version of this file.</p>` : ""}</div>`;
      el.querySelectorAll(`button.${P}ln`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i; last = i;
        if (FB[i]) found.add(i);
        paint(); if (found.size === 2) done();
      });
    };
    paint();
  }

  /* 8. The finished config: which line is the 100%? */
  function finalConfig({ el, done, kit }) {
    style();
    let last = null;
    const ok = last => last === CPU_REQ;
    const why = i => {
      const s = FINAL_POD[i];
      if (/memory/.test(s)) return "That is memory. The autoscaler here is set to <code>name: cpu</code>, so its percent is measured against the CPU request, not the memory one. Memory is reserved so the loaded model fits.";
      if (/limits/.test(s)) return "Limits are a ceiling the container may not pass. The autoscaler's percent is measured against what the pod asked for: the request.";
      if (/requests/.test(s)) return "Close: this block holds the requests. Tap the one line in it that the CPU percent is measured against.";
      if (/startupProbe|failureThreshold/.test(s) || (/periodSeconds/.test(s) && i < FINAL_POD.indexOf("        readinessProbe:"))) return `This is the startup probe: it checks <code>/ready</code> every ${STARTUP_PERIOD} s and gives up after ${STARTUP_FAILS} failures, so the model has up to ${STARTUP_PERIOD} × ${STARTUP_FAILS} = ${STARTUP_PERIOD * STARTUP_FAILS} s to load. It is about time, not CPU.`;
      if (/readinessProbe/.test(s) || /periodSeconds/.test(s)) return "This is the readiness probe: the Service sends questions to the pod only while <code>/ready</code> answers. It says nothing about CPU.";
      if (/path|port|httpGet/.test(s)) return "This is where a probe knocks: the model server's <code>/ready</code> address on port 8000. It is not a CPU number.";
      return "This line is structure around the settings. Look for the CPU the pod asks Kubernetes to reserve.";
    };
    const paint = () => {
      const fin = ok(last);
      const lines = FINAL_POD.map((s, i) => {
        const st = fin && i === CPU_REQ ? " ok" : last === i && !ok(i) ? " no" : "";
        return fin ? `<div class="${P}ln${st}">${kit.esc(s)}</div>` : `<button type="button" class="${P}ln${st}" data-i="${i}">${kit.esc(s)}</button>`;
      });
      el.innerHTML = `<h1>The fixed config</h1>
        <p class="lead">Here is the autoscaler, with the three numbers you used all lesson: minimum ${MIN}, maximum ${MAX}, target ${TARGET}%.</p>
        ${kit.code(FINAL_HPA, -1)}
        <p class="lead">And the fixed Deployment: <code>replicas</code> is gone, and the container is filled in. Its part from <code>resources:</code> on (from our seat-bot.yaml, … marks lines left out):</p>
        <p class="task">The autoscaler aims for ${TARGET}% CPU. Tap the line in the Deployment that this ${TARGET}% is a percent of.</p>
        <div class="${P}yaml"><div class="${P}ln cut">…</div>${lines.join("")}</div>
        <div class="lpanel">${last == null ? "" : fin
          ? kit.feedback(`Right: <b>requests.cpu</b> is the 100%. Each pod reserves one CPU, so ${TARGET}% means about ${TARGET / 100} of a CPU in use, on average. The other settings: <b>startupProbe</b> gives the model up to ${STARTUP_PERIOD} × ${STARTUP_FAILS} = ${STARTUP_PERIOD * STARTUP_FAILS} s to load before Kubernetes gives up and restarts the container. <b>readinessProbe</b> keeps questions away from the pod until <code>/ready</code> answers. The Service is the short part: a <code>selector</code> of <code>app: seat-bot</code>, and port 80 forwarded to the pods' port 8000.`, true)
          : kit.feedback(why(last), false)}
        <p class="lead ${P}note"><b>Not run by us.</b> This config is written from the <a class="${P}link" href="https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/" target="_blank" rel="noopener">official documentation</a>, checked ${CHECKED}, and was never applied to a cluster. To try it locally, kind runs a whole cluster inside Docker containers: <code>kind create cluster</code>, then <code>kubectl apply -f seat-bot.yaml</code>. The autoscaler also needs the metrics API, usually provided by an add-on called Metrics Server, installed separately.</p></div>`;
      el.querySelectorAll(`button.${P}ln`).forEach(b => b.onclick = () => {
        last = +b.dataset.i; paint(); if (ok(last)) done();
      });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    let ans = null;
    const opts = [
      "A clinic's note summariser for 8 staff: steady use all day, and it calls a hosted model API",
      "A school exam board's portal that runs its own open model to answer students' questions: quiet most weeks, ten times the load on results day, and an ops team that already runs a cluster",
      "A two-person startup's first chatbot, calling a hosted model API; nobody on the team has run a cluster"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>When Kubernetes is worth it</h1>
        <p class="lead"><b>What it is for:</b> running many copies of your containers across machines, replacing crashed ones, and changing the count with load. <b>Reach for it</b> when you serve your own model, traffic swings, and someone can run the cluster. <b>Not for</b> one small service with steady use, or a bot whose model runs at an API provider: a managed container service (a cloud service that runs your container for you), or one machine, is simpler. <b>What it costs:</b> a cluster to run and upgrade; config to maintain; the minimum pods, paid for all day; cold starts at every sudden jump; and for GPU models, machines that are slow and expensive to add.</p>
        <p class="task">Which of these calls for Kubernetes with an autoscaler?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. Their own model server, a load that swings by ten times, and people who already run a cluster: autoscaling saves the quiet weeks' cost, and they can raise the minimum before each results day.", true)
          : ans === 0 ? kit.feedback("Steady use by 8 people needs one small copy, and the model runs at the provider. There is nothing to scale, and a cluster would cost more to run than the app itself.", false)
          : kit.feedback("The model runs at the provider, so the heavy part already scales there. A team of two with no cluster experience would spend its time running Kubernetes instead of building the bot; a managed container service fits.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 10. Recognise it: is the CPU autoscaler, on its own, the answer? */
  function recognise({ el, done, kit }) {
    const CASES = [
      { s: "A recipe site's small text classifier runs on CPU pods. Traffic grows slowly from morning to evening, and a new pod is ready in 20 seconds.", yes: true,
        r: "Yes. Slow growth gives the autoscaler time to add pods, a 20-second start costs little, and CPU really is what limits this server.",
        w: "This is the easy case: the load grows slowly, starting a pod is quick, and CPU is the real limit. The CPU autoscaler alone handles it." },
      { s: "A team serves an open model with vLLM on GPU pods and scales on CPU. At peak, users wait in a queue, but CPU sits at 15% and the count never grows.", yes: false,
        r: "Right, not on its own. The model runs on the GPU, so CPU says little about load. Scale on a number the server reports: vLLM exports how many requests are waiting (vllm:num_requests_waiting), and the autoscaler can use custom or external metrics like that through a metrics adapter.",
        w: "CPU is the wrong signal here. The work happens on the GPU, so CPU stays low while the queue grows, and the rule sees no reason to add pods. Scale on a metric the server reports, such as requests waiting." },
      { s: "A lottery site's results bot gets a sudden rush at 20:00 every Saturday, the moment the draw is shown. Its pods take two minutes to load their model.", yes: false,
        r: "Right, not on its own. The autoscaler reacts only once the rush is there, and two minutes of cold start is the worst two minutes of the week. The time is known, so raise minReplicas before 20:00 (for example from a scheduled job) and lower it after.",
        w: "This is the 10:00 sale again: a sudden rush at a known time, and a long cold start. Reacting after the rush arrives means users wait for two minutes. Raise the minimum before 20:00." }
    ];
    const picked = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is the CPU autoscaler enough?</h1>
        <p class="task">For each service: does an autoscaler on CPU, on its own, keep users from waiting?</p>
        ${CASES.map((c, k) => `<div class="lcase" id="c${k}"><p>${kit.esc(c.s)}</p>${kit.options(["Yes, on its own", "No, it needs something else"], { picked: picked[k], correct: c.yes ? 0 : 1 })}
          ${picked[k] == null ? "" : (picked[k] === 0) === c.yes ? kit.feedback(c.r, true) : kit.feedback(c.w, false)}</div>`).join("")}`;
      CASES.forEach((c, k) => el.querySelectorAll(`#c${k} .lopts button`).forEach(b => b.onclick = () => {
        picked[k] = +b.dataset.i; paint();
        if (CASES.every((d, j) => picked[j] === (d.yes ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">You can read the three parts of a model service's config: a <b>Deployment</b> (which container, kept running), a <b>Service</b> (one address, questions only to ready pods) and an <b>autoscaler</b> (the count follows CPU use against a target, between a minimum and a maximum). You can say what happens when traffic jumps (the count follows, but new pods cold-start) and when a pod crashes (it leaves the Service, restarts, and the rest carry its load). And you know when the CPU autoscaler alone is not enough.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. When the model runs at a cloud provider instead of in your pods, scaling becomes their job, and your problems turn into access rights, regions and quotas.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Kubernetes in brief for model services",
    checked: CHECKED,
    sources: [
      "https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/",
      "https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/",
      "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/",
      "https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/",
      "https://kubernetes.io/docs/concepts/services-networking/service/",
      "https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/",
      "https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/",
      "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
      "https://kubernetes.io/docs/concepts/cluster-administration/node-autoscaling/",
      "https://kind.sigs.k8s.io/docs/user/quick-start/",
      "https://docs.vllm.ai/en/latest/usage/metrics.html"
    ],
    interview: [{
      q: "Your model service on Kubernetes times out for the first two minutes of every big product launch, then runs fine. What is going on, and what do you change?",
      good: ["The autoscaler reacts to load it already measures, so it only asks for pods once the rush has arrived",
        "New pods serve nothing until ready: image download and model load, maybe a new machine first; the Service sends traffic only to ready pods",
        "For a launch at a known time, raise minReplicas before it and lower it after",
        "Shorten the cold start: smaller image, model files close to the machine, a readiness probe that passes as soon as the model is loaded",
        "Check maxReplicas and machine capacity, and whether CPU is even the right signal for this server"],
      weak: "Raise maxReplicas or give pods more CPU, without seeing that the pods asked for are not ready yet."
    }, {
      q: "An autoscaler on CPU is set up for a GPU LLM server. Users queue at peak, but it never adds pods. Why, and what would you scale on?",
      good: ["The model runs on the GPU, so CPU stays low however long the queue gets; the rule sees nothing to fix",
        "CPU utilization is measured against the pod's CPU request; without a CPU request the autoscaler takes no action for the CPU metric",
        "Scale on a number that tracks the queue, such as requests waiting, which servers like vLLM export",
        "The autoscaler can use custom or external metrics through a metrics adapter; add GPU machines and cold-start time to the plan"],
      weak: "Lower the CPU target to 20%, which only moves a threshold on a signal that does not follow the load."
    }],
    screens: [situation, byHand, spotIdea, useRule, inPython, crash, realConfig, finalConfig, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(HOURS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(CHECKS.length).fill("[data-right]") },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: [`[data-i="${SK_FROM}"]`], right: [`[data-i="${BAD_REPLICAS}"]`, `[data-i="${BAD_RES}"]`] },
      { wrong: [`[data-i="${CPU_REQ + 1}"]`], right: [`[data-i="${CPU_REQ}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { right: [] }
    ]
  });
})();
