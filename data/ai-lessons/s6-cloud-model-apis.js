/* Lesson s6-cloud-model-apis: hosted model APIs on a cloud platform (Amazon Bedrock).
   Story: a hospital group in Germany runs a discharge-letter drafter. Its data protection officer's rule: patient
   text stays in Germany. The drafter calls a hosted model through Amazon Bedrock in the group's own AWS account,
   and keeps getting access-denied errors.
   Idea: a cloud model call is checked in three layers before the model reads a word: WHO may call (the IAM role
   and its policies), WHERE the work happens (the Region you call, and the Regions an inference profile may route
   to), HOW MUCH you may use (per-minute quotas). The error code and the end of its message say which layer said
   no, and only the quota layer heals with time, so only it is worth retrying.
   Depth: explain (screens 1, 3, 4, 5, 6, 9, 10, interview), debug (screen 2: three failing calls to diagnose;
   screen 8: a real run where an environment variable moved the client to a US endpoint, set in a sandbox account
   with no Region rule and a broad role, so nothing failed).
   Data:
   - Real runs on this Mac on 2026-11-14 (docs/ai-path/runs/s6-cloud-model-apis/, run.sh, env.txt: Python 3.12.11
     in the git-ignored .cache/ai-venv,
     boto3 1.44.2): draft_call.py + tracer.py made draft_call.out.txt (the stepped code on screen 7, ending in
     NoCredentialsError: nothing was sent to AWS), retry_check.py made retry_check.out.txt (botocore's own
     standard-mode retry decision for the documented Bedrock error codes, screen 3), region_mixup.py made
     region_mixup.out.txt (screen 8).
   - Not run by us (no AWS account was used): the failing calls on screen 2, the policies on screen 4, the model
     ID kinds on screen 5 and the quota arithmetic on screen 6 are written from the official documentation listed
     in `sources`. Error codes and HTTP statuses are from the Bedrock API reference; the endings of the access-denied
     messages follow the format in the IAM troubleshooting guide. No captured AWS output is shown.
   - No model API was called for this lesson (no recordings).
   Lesson-local style (.lx-s6-cloud-model-apis-*): file blocks, run output blocks and tappable lines, see ensureStyle().
   Every number on screen is computed here from RUN, CALLS and QUOTA. Plain browser script. */
(() => {
  const ID = "s6-cloud-model-apis";
  const P = `lx-${ID}-`;
  const fmt = n => n.toLocaleString("en");
  const DOCS_DATE = "2026-11-14";
  const NOT_RUN = href => `<p class="lead"><b>Not run by us.</b> Written from the <a href="${href}" target="_blank" rel="noopener">official documentation</a>, checked ${DOCS_DATE}. No AWS account was used, and no captured AWS output is shown.</p>`;
  const DOC = {
    errors: "https://docs.aws.amazon.com/bedrock/latest/userguide/troubleshooting-api-error-codes.html",
    geo: "https://docs.aws.amazon.com/bedrock/latest/userguide/geographic-cross-region-inference.html",
    cris: "https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html",
    burndown: "https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-token-burndown.html"
  };

  /* ---------- Data copied from the runs (docs/ai-path/runs/s6-cloud-model-apis/), not altered ---------- */
  const RUN = {
    date: "2026-11-14",
    versions: "boto3 1.44.2",
    // draft_call.py: the traced function, line for line (line 0 = the def line)
    code: [
      "def draft_letter(ward_notes, region, model_id):",
      "    client = boto3.client(\"bedrock-runtime\", region_name=region)",
      "    endpoint = client.meta.endpoint_url",
      "    reply = client.converse(",
      "        modelId=model_id,",
      "        messages=[{\"role\": \"user\", \"content\": [{\"text\": ward_notes}]}],",
      "        inferenceConfig={\"maxTokens\": 600},",
      "    )",
      "    return reply[\"output\"][\"message\"][\"content\"][0][\"text\"]"
    ],
    // draft_call.out.txt: every traced step (event "line" = about to run that line; "return" = the function ended)
    steps: [
      { line: 1, event: "line", vars: { region: "eu-central-1", model_id: "MODEL_ID_FROM_MODEL_CARD" } },
      { line: 2, event: "line", vars: { region: "eu-central-1", model_id: "MODEL_ID_FROM_MODEL_CARD" } },
      { line: 3, event: "line", vars: { region: "eu-central-1", model_id: "MODEL_ID_FROM_MODEL_CARD", endpoint: "https://bedrock-runtime.eu-central-1.amazonaws.com" } },
      { line: 4, event: "line", vars: { region: "eu-central-1", model_id: "MODEL_ID_FROM_MODEL_CARD", endpoint: "https://bedrock-runtime.eu-central-1.amazonaws.com" } },
      { line: 5, event: "line", vars: { region: "eu-central-1", model_id: "MODEL_ID_FROM_MODEL_CARD", endpoint: "https://bedrock-runtime.eu-central-1.amazonaws.com" } },
      { line: 6, event: "line", vars: { region: "eu-central-1", model_id: "MODEL_ID_FROM_MODEL_CARD", endpoint: "https://bedrock-runtime.eu-central-1.amazonaws.com" } },
      { line: 3, event: "line", vars: { region: "eu-central-1", model_id: "MODEL_ID_FROM_MODEL_CARD", endpoint: "https://bedrock-runtime.eu-central-1.amazonaws.com" } },
      { line: 3, event: "return", vars: { region: "eu-central-1", model_id: "MODEL_ID_FROM_MODEL_CARD", endpoint: "https://bedrock-runtime.eu-central-1.amazonaws.com" } }
    ],
    // draft_call.out.txt, first line
    error: "botocore.exceptions.NoCredentialsError: Unable to locate credentials",
    // retry_check.out.txt
    retry: [
      ["AccessDeniedException", 403, false],
      ["ValidationException", 400, false],
      ["ResourceNotFoundException", 404, false],
      ["ThrottlingException", 429, true],
      ["ServiceUnavailableException", 503, true]
    ],
    // region_mixup.out.txt, the three lines
    mixA: "A config file only: region=eu-central-1 endpoint=https://bedrock-runtime.eu-central-1.amazonaws.com",
    mixB: "B config file + AWS_DEFAULT_REGION: region=us-east-1 endpoint=https://bedrock-runtime.us-east-1.amazonaws.com",
    mixC: "C same env, region pinned in code: region=eu-central-1 endpoint=https://bedrock-runtime.eu-central-1.amazonaws.com"
  };
  const CAPTION = `Run on this Mac, ${RUN.date} (${RUN.versions}). Nothing was sent to AWS.`;
  const RETRIED = RUN.retry.filter(r => r[2]).map(r => r[0]);
  const NOT_RETRIED = RUN.retry.filter(r => !r[2]).map(r => r[0]);
  const hostOf = line => line.split("endpoint=")[1].replace("https://", "");
  const regionOf = line => line.split("region=")[1].split(" ")[0];

  /* ---------- The first week's failing calls (screen 2), built from the documentation ---------- */
  const LAYERS = ["Who: the role's permissions", "Where: the Region", "How much: the quota"];
  const CALLS = [
    {
      when: "Monday: every call since Friday's deploy",
      lines: [
        "# drafter role policy",
        "Allow  bedrock:InvokeModel",
        "  on   arn:aws:bedrock:eu-central-1::foundation-model/MODEL-A",
        "# app config, changed on Friday",
        "MODEL_ID = \"MODEL-B\""
      ],
      error: ["AccessDeniedException (HTTP 403)", "… because no identity-based policy allows the bedrock:InvokeModel action"],
      layer: 0,
      fb: [
        "Right. The role's policy allows one resource: MODEL-A in Frankfurt. On Friday the app switched to MODEL-B, and nothing allows that. “No identity-based policy allows” means the role itself is missing an Allow. Fix: add MODEL-B's ARN (its full AWS name) to the policy (and remove MODEL-A's once it is unused).",
        "The Region is fine: both the policy and the call are in eu-central-1. Read the end of the message: “no identity-based policy allows” points at the role's own policy, and the policy names MODEL-A while the app now calls MODEL-B.",
        "A quota error is a 429 (ThrottlingException) and comes and goes with traffic. This is a 403 on every call, all day. Something refuses the call itself: the role's policy names MODEL-A, the app calls MODEL-B."
      ]
    },
    {
      when: "Wednesday: after a teammate changed the model ID to make a newer model work",
      lines: [
        "# app config, changed on Wednesday",
        "# eu. = an EU inference profile: may run in other EU Regions",
        "MODEL_ID = \"eu.MODEL-C\"",
        "# the hospital group's service control policy (SCP),",
        "# a rule for every account in the organisation",
        "Deny  every action outside eu-central-1"
      ],
      error: ["AccessDeniedException (HTTP 403)", "… with an explicit deny in a service control policy"],
      layer: 1,
      fb: [
        "Same code as Monday, but read the end of the message: an explicit deny in a service control policy. An SCP is set for the whole organisation, above the drafter's role, and an explicit deny beats any Allow the role has. Adding to the role's policy changes nothing here.",
        "Right. An ID starting with <code>eu.</code> is a cross-Region inference profile: Bedrock may run the request in any destination Region the profile lists, and the documentation says the request fails if any of those Regions is blocked by an SCP. The SCP only allows Frankfurt, so it refuses. It is doing its job: those other Regions are outside Germany. Fix: go back to a model that Frankfurt serves in its own Region (screen 5).",
        "A quota error is a 429 and depends on traffic. This 403 started with the model ID change and happens on every call. The message names a service control policy: a Region rule, not a usage limit."
      ]
    },
    {
      when: "Thursday 08:00 to 08:20 only, when every ward sends its discharges; the same requests work at 08:30",
      lines: [
        "# app config, unchanged since Wednesday's fix",
        "region   = eu-central-1",
        "maxTokens = 8000   # set high “to be safe”"
      ],
      error: ["ThrottlingException (HTTP 429)", "documented cause: The request was denied due to exceeding the account quotas for Amazon Bedrock."],
      layer: 2,
      fb: [
        "If the role lacked permission, every call would fail, at 08:30 too. These calls fail only in the rush and work again minutes later: a limit on how much, not on who.",
        "The Region does not change at 08:20. The same config works at 08:30. What changes is how many letters arrive at once.",
        "Right. A 429 ThrottlingException means the account went over a Bedrock quota: tokens or requests per minute, per model, per Region. It clears when the minute's budget refills, which is why 08:30 works. Screen 6 shows why maxTokens = 8000 makes it worse."
      ]
    }
  ];

  /* ---------- Quota arithmetic (screen 6): the documented formula, applied to a supposed morning rush ---------- */
  const QUOTA = { tpm: 100000, letters: 30, input: 2500, output: 700, maxHigh: 8000, maxLow: 800, rate: 1 };
  const heldAtStart = max => QUOTA.input + max;                      // documented: input tokens + max_tokens at the start
  const usedAtEnd = () => QUOTA.input + QUOTA.output * QUOTA.rate;  // documented: input + output x burndown rate
  const fitCount = per => Math.min(QUOTA.letters, Math.floor(QUOTA.tpm / per));

  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}file { margin: 10px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font: 500 13px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}file .${P}c { color: var(--muted); }
      .${P}out { margin: 10px 0 0; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); font: 500 13px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}out b { font-weight: 700; }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}label { margin: 14px 0 0; font: 600 12.5px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}when { margin: 0 0 4px; font-weight: 600; }
      .${P}err { margin: 8px 0 0; font: 600 13px/1.5 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
      .${P}err span { display: block; font-weight: 500; color: var(--ink-2); }
      .${P}list { display: grid; gap: 8px; margin-top: 12px; }
      .${P}list button { display: flex; flex-direction: column-reverse; gap: 4px; align-items: flex-start; width: 100%; text-align: left; min-height: 44px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); cursor: pointer; font: 500 13.5px/1.45 var(--mono); overflow-wrap: anywhere; }
      .${P}list button span { min-width: 0; }
      .${P}list button small { flex: none; font: 600 12.5px/1.45 var(--font); color: var(--muted); }
      .${P}list button.right { border-color: var(--good); background: var(--good-soft); }
      .${P}list button.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}list button:disabled { cursor: default; }
      @media (hover: hover) { .${P}list button:not(.right):not(.wrong):not(:disabled):hover { border-color: var(--ink); } }
      .${P}layers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px 0 0; }
      .${P}layers div { padding: 10px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); min-width: 0; }
      .${P}layers b { display: block; font-size: 14px; }
      .${P}layers span { display: block; font-size: 13px; color: var(--ink-2); margin-top: 4px; }
      @media (max-width: 560px) { .${P}layers { grid-template-columns: 1fr; } }
      .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}tbl { width: 100%; border-collapse: collapse; margin-top: 10px; font: 500 13px/1.45 var(--mono); }
      .${P}tbl th, .${P}tbl td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
      .${P}tbl th { font: 600 12.5px/1.4 var(--font); color: var(--muted); }
    `;
    document.head.appendChild(s);
  }
  const label = t => `<p class="${P}label">${t}</p>`;
  const cap = t => `<p class="${P}cap">${t}</p>`;
  const fileBlock = (kit, lines) => `<pre class="${P}file">${lines.map(l => l.startsWith("#") ? `<span class="${P}c">${kit.esc(l)}</span>` : kit.esc(l)).join("\n")}</pre>`;
  const outBlock = (kit, lines) => `<pre class="${P}out">${lines.map(l => kit.esc(l)).join("\n")}</pre>`;
  const layersPic = () => `<div class="${P}layers">
      <div><b>Who</b><span>the identity calling (an IAM role) and the policies that allow or deny it</span></div>
      <div><b>Where</b><span>the Region you call, and any other Regions the request may be routed to</span></div>
      <div><b>How much</b><span>the account's per-minute quotas for that model in that Region</span></div>
    </div>`;

  /* 1. The situation: why the call goes through the hospital's own cloud account at all. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Models on the cloud platform are more accurate than the same models from the model's maker",
      "The call then runs under the hospital's own rules: which identity may call which model, which Region does the work, how much it may use, and a log of every call",
      "Calls inside the hospital's cloud account cost nothing extra, because the servers are already paid for"
    ];
    const correct = 1;
    const fb = [
      "The platform does not make a model smarter. What changes is everything around the call: who is allowed to make it, where it runs, how much may be used, and who can see the log.",
      "Right. On Amazon Bedrock the call goes to an address in a Region you choose (a Region is one AWS data-centre location). It is signed with the credentials of an identity in the hospital's own AWS account. So the hospital's rules apply to it: <b>who</b> may call (IAM, AWS's identity and permissions service), <b>where</b> the work happens (the Region), <b>how much</b> may be used (quotas). AWS CloudTrail, the account's audit log, records each call. Every failure in this lesson comes from one of these three layers, before the model reads a word.",
      "Hosted models are billed per token on a cloud platform too. Paying for servers does not include model calls. The reason is control, not price."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Patient text must stay in Germany</h1>
        <p class="lead">A hospital group in Germany has a small service that drafts discharge letters: a doctor's ward notes go in, a draft letter for the family doctor comes out. The first prototype sent the notes to a model maker's API with a key on a developer's laptop. Now it must run for real, and the data protection officer has one rule: <b>patient text stays in Germany</b>.</p>
        <p class="lead">IT moves the drafter into the hospital group's AWS account. It calls a hosted model through <b>Amazon Bedrock</b>, AWS's service for hosted models from several makers. Since the deploy, the log is full of access-denied errors.</p>
        <p class="task">Before any errors: why does IT want the call to go through the hospital's own cloud account instead of the laptop's API key?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}
        ${ans === correct ? layersPic() : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. By hand: three failing calls from the first week. Which layer said no? */
  function diagnose({ el, done, kit }) {
    ensureStyle();
    const ans = CALLS.map(() => null);
    const allRight = () => CALLS.every((c, i) => ans[i] === c.layer);
    const paint = () => {
      el.innerHTML = `<h1>Three failing calls</h1>
        ${NOT_RUN(DOC.errors)}
        <p class="lead">The drafter's first week. It calls Bedrock in <code>eu-central-1</code> (eu-central-1 is Frankfurt). For each failure you see the config that mattered, the error code with its HTTP status, and how the error message ends. Read the end of each message: it often says more than the code.</p>
        <p class="task">For each call, pick the layer that refused it. Pick again if you change your mind.</p>
        ${CALLS.map((c, i) => `<div class="lcase" id="c${i}">
          <p class="${P}when">${kit.esc(c.when)}</p>
          ${fileBlock(kit, c.lines)}
          <p class="${P}err">${kit.esc(c.error[0])}<span>${kit.esc(c.error[1])}</span></p>
          ${kit.options(LAYERS.map(kit.esc), { picked: ans[i], correct: c.layer })}
          ${ans[i] == null ? "" : kit.feedback(c.fb[ans[i]], ans[i] === c.layer)}</div>`).join("")}
        ${allRight() ? kit.feedback(`Two of the three are the same code, 403, from different layers. The code says “refused”; the end of the message says who refused. And only one of the three cleared up by itself.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (allRight()) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: which of these errors would retrying fix? Checked against botocore's real retry rules. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "All three. Cloud errors are often temporary, so a few retries clear most of them",
      "Only Thursday's 429. The two 403s would come back the same on every try",
      "None. Retrying a cloud API only adds load"
    ];
    const correct = 1;
    const fb = [
      "A 403 is a decision written in a policy. Asking again asks the same policy the same question, and it gives the same answer until someone changes the policy. Three tries just means three refusals, and a slower failure.",
      `Right. Only the quota layer changes with time: the per-minute budget refills. A 403 changes only when a policy changes. The SDK already knows this. We asked botocore (the library under boto3, AWS's SDK for Python) about each error Bedrock documents for this call, using its default “standard” retry mode. It retries ${RETRIED.join(" and ")}, with growing waits between tries, and never ${NOT_RETRIED.join(", ")}. One exception the Bedrock docs name: right after your first call to a new third-party model, AWS sets up the subscription, which can take up to about 15 minutes. During that time a call can get a 403 named <code>MPAgreementBeingCreated</code>. The troubleshooting page says to try again after 15 minutes.`,
      "Retries with growing waits are exactly what the Bedrock troubleshooting page recommends for a 429 or a 503. They are wrong only for errors that time cannot fix, like a 403."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Will retrying fix it?</h1>
        <p class="lead">A teammate proposes one fix for the whole week: wrap every call in three attempts with a pause between them.</p>
        <p class="task">Which of the week's failures would retrying actually fix?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}
        ${ans === correct ? `${label("retry_check.py: would boto3 retry it?")}
          <table class="${P}tbl"><thead><tr><th>error code</th><th>HTTP</th><th>retried</th></tr></thead><tbody>
          ${RUN.retry.map(([c, s, r]) => `<tr><td>${kit.esc(c)}</td><td>${s}</td><td>${r ? "yes" : "no"}</td></tr>`).join("")}</tbody></table>
          ${cap(CAPTION + " The codes and statuses are inputs from the Bedrock API reference; the yes and no are botocore's real answers.")}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Who: write the role's Allow so it covers the drafter's call and nothing more. */
  function whoPolicy({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "<code>\"Resource\": \"*\"</code>",
      "<code>\"Resource\": \"arn:aws:bedrock:eu-central-1::foundation-model/MODEL-B\"</code>",
      "<code>\"Resource\": \"arn:aws:bedrock:eu-central-1:ACCOUNT-ID:inference-profile/eu.MODEL-B\"</code>"
    ];
    const correct = 1;
    const fb = [
      "It works, and that is the problem. It lets the role call any model, in any Region, through any profile. A typo in the Region or a copied <code>eu.</code> or <code>global.</code> ID would send patient text out of Germany. Unless some other rule happened to block it, no call would fail, so nobody would notice.",
      "Right. One model, in one Region. The Region is part of the ARN, and a foundation model's ARN has no account number: it is AWS's model, not yours. Now a call to another model or another Region fails at once with a 403, which is what you want: the policy turns a silent mistake into a loud one.",
      "This names a cross-Region inference profile, which can route requests to other Regions. The drafter does not use one, and allowing it is the first step to letting letters leave Germany. Using a profile would also need the model allowed in every destination Region the profile lists."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Who may call what</h1>
        ${NOT_RUN(DOC.geo)}
        <p class="lead">On AWS, the drafter's container runs as an <b>IAM role</b>: an identity with no password or stored key. The SDK fetches short-lived credentials for it from the container platform. What the role may do is written in its <b>policy</b>. Bedrock's Converse call needs the action <code>bedrock:InvokeModel</code> on the model it calls, named by its <b>ARN</b> (AWS's full name for a resource: service, Region, account, then the resource). After Monday's fix the drafter calls MODEL-B in Frankfurt, with a plain model ID.</p>
        ${fileBlock(kit, ["# drafter role policy, one statement", "\"Effect\": \"Allow\",", "\"Action\": \"bedrock:InvokeModel\",", "\"Resource\": ?"])}
        <p class="task">Which Resource should the Allow name?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Where: which kind of model ID keeps the work in Frankfurt. */
  function wherePick({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const host = RUN.steps[RUN.steps.length - 1].vars.endpoint.replace("https://", "");
    const opts = [
      "<code>MODEL-C</code>, the plain model ID, called on the Frankfurt endpoint",
      "<code>eu.MODEL-C</code>, the EU inference profile, called on the Frankfurt endpoint",
      "<code>global.MODEL-C</code>, the global inference profile, called on the Frankfurt endpoint"
    ];
    const correct = 0;
    const fb = [
      `Right. A plain model ID asks the Region you call to do the work itself, so the request stays in Frankfurt. The client picks its endpoint from the Region alone: on this Mac, a client made for eu-central-1 pointed at <code>${kit.esc(host)}</code> (you will step through that run on screen 7). Two checks remain. First, the model card must list Frankfurt as serving the model in its own Region. If Frankfurt only offers a profile for it, choose another model, or get the data protection officer to accept EU processing in writing. Second, for each profile request CloudTrail records where it was processed, in <code>additionalEventData.inferenceRegion</code>, so an audit can prove where the work happened.`,
      "An <code>eu.</code> profile keeps the request inside the EU, not inside Germany: Bedrock may process it in any destination Region the profile lists, in another country. That is Wednesday's call. The documentation also warns not to judge the destinations by the prefix alone: check the profile's list from every Region you call it from.",
      "A <code>global.</code> profile may send the request to supported commercial Regions anywhere in the world. It is a little cheaper, which is why it is tempting, and it is the opposite of this rule. The documentation says organisations with data residency requirements should check whether it fits."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where the letter is written</h1>
        ${NOT_RUN(DOC.cris)}
        <p class="lead">Each AWS <b>Region</b> is a set of data centres in one place. <code>eu-central-1</code> is Frankfurt, in Germany. The client sends every request to that Region's endpoint. But the model ID decides where the work may happen. Bedrock offers some models through <b>cross-Region inference profiles</b>: IDs with a prefix such as <code>eu.</code> or <code>global.</code> that let Bedrock spread requests over several Regions, for more throughput.</p>
        <p class="task">The team wants MODEL-C. Its model card offers all three kinds of ID in Frankfurt. Which one keeps patient text in Germany?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}
        </div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 6. How much: predict how many of the morning's letters get through before the 429s. */
  function howMuch({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const hi = heldAtStart(QUOTA.maxHigh), lo = heldAtStart(QUOTA.maxLow), end = usedAtEnd();
    const right = fitCount(hi), trap = fitCount(end);
    const vals = [...new Set([right, trap, Math.floor(QUOTA.tpm / end)])].sort((a, b) => a - b);
    const correct = vals.indexOf(right);
    const fbFor = v => v === right
      ? [`Right. At the start of each request Bedrock holds input + maxTokens = ${fmt(QUOTA.input)} + ${fmt(QUOTA.maxHigh)} = <b>${fmt(hi)}</b> tokens against the per-minute quota, before the model has written anything. ${fmt(QUOTA.tpm)} ÷ ${fmt(hi)} is about ${(QUOTA.tpm / hi).toFixed(1)}, so ${right} whole letters start, then 429. Each letter really uses only ${fmt(end)} (input + the ${fmt(QUOTA.output)} tokens written), and the rest is handed back at the end, too late for the rush. With maxTokens = ${fmt(QUOTA.maxLow)}, close to a real letter's size, each holds ${fmt(lo)}. ${QUOTA.letters} × ${fmt(lo)} = ${fmt(QUOTA.letters * lo)}, so ${fitCount(lo) === QUOTA.letters ? `all ${QUOTA.letters}` : `${fitCount(lo)} of ${QUOTA.letters}`} fit. The documentation's own advice: set maxTokens near the size of real answers.`, true]
      : v === trap
        ? [`That counts what a letter really uses: ${QUOTA.letters} × ${fmt(end)} = ${fmt(QUOTA.letters * end)}, under the quota. But Bedrock holds tokens before it knows how long the letter will be: input + maxTokens = ${fmt(hi)} per request, at the start.`, false]
        : [`${fmt(QUOTA.tpm)} ÷ ${fmt(end)} uses what a letter really uses, and there are only ${QUOTA.letters} letters anyway. The quota is charged at the start with input + maxTokens = ${fmt(hi)}, not with the final size.`, false];
    const paint = () => {
      el.innerHTML = `<h1>How much may it use</h1>
        ${NOT_RUN(DOC.burndown)}
        <p class="lead">Bedrock limits each account per model and per Region, by requests per minute and by tokens per minute. The Bedrock docs say how a request is charged against the token quota: at the <b>start</b>, its input tokens plus its <code>maxTokens</code>; at the end it is corrected to the input plus the tokens really written, and the rest is handed back. (For some models each written token counts several times; the model's documentation gives the rate. Here it is 1.)</p>
        <p class="lead">Suppose a quota of ${fmt(QUOTA.tpm)} tokens per minute. At 08:00, ${QUOTA.letters} letters start within a few seconds, before any finishes. Each sends ${fmt(QUOTA.input)} input tokens, writes about ${fmt(QUOTA.output)}, and asks for <code>maxTokens = ${fmt(QUOTA.maxHigh)}</code>.</p>
        <p class="task">How many letters start before the 429s begin?</p>
        <div class="lpanel">${kit.options(vals.map(String), { picked: ans == null ? null : vals.indexOf(ans), correct, num: true })}
        ${ans == null ? "" : kit.feedback(...fbFor(ans))}
        ${ans === right ? kit.meter([
          { label: `maxTokens ${fmt(QUOTA.maxHigh)}: letters that fit`, value: right, max: QUOTA.letters },
          { label: `maxTokens ${fmt(QUOTA.maxLow)}: letters that fit`, value: fitCount(lo), max: QUOTA.letters, good: true }
        ]) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = vals[+b.dataset.i]; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 7. The call in Python, as a recorded run: Region first, credentials from the environment. */
  const SAY = [
    "About to make the client. <code>region</code> is eu-central-1, passed in by the caller, so this client will only ever talk to Frankfurt.",
    "The client exists. No network call has happened yet: making a client is local.",
    "<code>endpoint</code> is the host every request from this client goes to. The Region alone chose it.",
    "Building the request. <code>modelId</code> is a plain model ID, so Frankfurt does the work itself. (Here it is a placeholder: nothing is sent from this Mac, so no real ID was needed.)",
    "<code>messages</code> is Bedrock's Converse format: a list of turns, each with a list of content blocks. Other APIs use other shapes for the same idea.",
    "<code>maxTokens</code> caps the letter's length, and it is also what the token quota holds at the start of the call (screen 6). 600 is near a real letter's size.",
    "Now <code>converse</code> runs. Before sending, the SDK must sign the request. It looks for credentials along its documented chain: arguments, environment variables, config files, then the container platform, then the server's instance role.",
    "It stopped here. On this Mac there are no AWS credentials anywhere, so the SDK raised an error before sending anything. In the hospital's container, the container platform would hand the SDK the drafter role's short-lived credentials. That is why no key appears in the code."
  ];
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const N = RUN.steps.length;
    const paint = () => {
      const s = RUN.steps[i], v = s.vars, last = s.event === "return";
      el.innerHTML = `<h1>The call, in Python</h1>
        <p class="lead">The drafter's call with <b>boto3</b>, the AWS SDK for Python, run on this Mac and traced line by line. Nothing reached AWS: you will see why at the end.</p>
        <p class="task">Step through to the end. Watch where the Region is chosen and where the credentials should come from.</p>
        <div class="${P}wrap">${kit.code(RUN.code, s.line)}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === N - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>region <b>${kit.esc(v.region)}</b></span><span>endpoint <b>${v.endpoint ? kit.esc(v.endpoint.replace("https://", "")) : "–"}</b></span><span>step <b>${i + 1} / ${N}</b></span></div>
        ${last ? `${outBlock(kit, [RUN.error])}${cap(CAPTION)}` : ""}
        ${kit.feedback(SAY[i])}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === N - 1) done(); };
    };
    paint();
  }

  /* 8. Broken on purpose: a real run where an environment variable moved the client to the US. */
  const MIX_LINES = [
    { file: "app.py", text: "client = boto3.client(\"bedrock-runtime\")" },
    { file: "~/.aws/config on the laptop", text: "region = eu-central-1" },
    { file: "Dockerfile, from the shared base template", text: "ENV AWS_DEFAULT_REGION=us-east-1" }
  ];
  const MIX_RIGHT = 2;
  function broken({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const bad = regionOf(RUN.mixB), good = regionOf(RUN.mixA);
    const fb = [
      ["This line asks for no Region, so boto3 takes one from its surroundings. That is why the bug could happen, and the fix goes here. But the value us-east-1 came from somewhere else.", false],
      [`This line says Frankfurt, and on the laptop it won (line A). In the container, boto3's documented order puts environment variables above the config file. Something in the environment said ${bad}.`, false],
      [`Right. The shared base image sets <code>AWS_DEFAULT_REGION</code>, and boto3 ranks an environment variable above the config file. The client went to <code>${kit.esc(hostOf(RUN.mixB))}</code>, and nothing failed. Fix it in the code: pass <code>region_name</code> from the drafter's own setting, which outranks the environment (line C below), and stop at start-up if it is not ${good}. In the hospital's production account this would not have stayed silent. The SCP from screen 2 and the role from screen 4 (allowed only <code>arn:aws:bedrock:${good}::…</code>) would each have turned it into a 403 on the first call. The sandbox has neither guard, so only the start-up check caught it.`, true]
    ];
    const paint = () => {
      const fin = pick === MIX_RIGHT;
      el.innerHTML = `<h1>Every test call succeeds, in the wrong country</h1>
        <p class="lead">A week later the platform team moves the drafter into its shared container image. They try it first in the team's <b>sandbox</b> AWS account (a test account), with made-up notes. The sandbox has no Region SCP, and its role may call any model, so no call fails. But at start-up the drafter prints where its client points.</p>
        <p class="lead">We rebuilt this on this Mac with the drafter's code unchanged. Line A uses only the laptop's config file. Line B adds the environment variable that the image's Dockerfile sets.</p>
        ${label("start-up check, region_mixup.py")}
        ${outBlock(kit, [RUN.mixA, RUN.mixB])}
        ${cap(CAPTION + " Line A: the laptop. Line B: inside the image.")}
        <p class="task">Tap the line that put ${kit.esc(bad)} into the client.</p>
        <div class="${P}list">${MIX_LINES.map((m, i) => `<button type="button" data-line="${i}" ${fin ? "disabled" : ""} class="${pick === i ? (i === MIX_RIGHT ? "right" : "wrong") : ""}"><span>${kit.esc(m.text)}</span><small>${kit.esc(m.file)}</small></button>`).join("")}</div>
        <div class="lpanel">${pick == null ? "" : kit.feedback(...fb[pick])}
        ${fin ? `${outBlock(kit, [RUN.mixC])}${cap(CAPTION + " Line C: the same environment, region_name passed in the code.")}` : ""}</div>`;
      el.querySelectorAll("[data-line]").forEach(b => b.onclick = () => { pick = +b.dataset.line; paint(); if (pick === MIX_RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A developer's weekend tool that summarises his own notes, with no data rules",
      "A bank team already on AWS that must keep customer text in one country and log every model call",
      "A clinic on a research ship with no internet connection for weeks at a time"
    ];
    const correct = 1;
    const fb = [
      "He could, but the setup costs more than it gives him: roles, policies, Regions and quotas protect rules he does not have. The model maker's own API and a key are simpler here.",
      "Right. The rules they must prove (one country, every call logged, who may call) are exactly what the platform layers give: a pinned Region, IAM policies, CloudTrail. And they already run on that cloud, so the identities and the bill are in one place.",
      "A hosted model API needs a network connection for every call. With no connection, the model has to run on the ship's own hardware: self-hosting, covered by other lessons."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What it is for:</b> calling a hosted model inside your own cloud account, so your identities, Regions, logs and quotas apply to every call.</p>
        <p class="lead"><b>Reach for it</b> when data rules (where data is processed, who called, an audit log) matter and the team already runs on that cloud.</p>
        <p class="lead"><b>Not when</b> it is a prototype with no such rules (the maker's own API is simpler), the model you need is not served in your Region, or the calls cannot leave your own machines (run the model yourself).</p>
        <p class="lead"><b>What it costs:</b> per-token billing as with any hosted API, setup work (roles, policies, organisation rules), and quotas to watch and raise before a busy season.</p>
        <p class="task">Which team should reach for a hosted model API on its cloud platform?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 10. Recognise it: is the fix in the role, the Region or the quota? */
  const CASES = [
    ["A translation service works in the team's test account. In the production account, every call returns 403, and the message ends “because no identity-based policy allows the bedrock:InvokeModel action”.", true,
      "Yes: who. Each AWS account has its own roles and policies. The production role is missing the Allow the test role has.",
      "Every call, from the first, and the message names the identity-based policy. That is the role layer: the production account's role lacks the Allow that the test account's role has."],
    ["An insurance chatbot runs fine all week, but gets 429 errors every Monday at 09:00 when a batch of claims starts. Its requests set maxTokens to the model's maximum.", true,
      "Yes: how much. Lower maxTokens toward the real answer size, spread the batch over more minutes, back off and retry, and ask for a quota increase if the real usage needs it.",
      "A 429 at one busy hour is the quota layer. Each request holds input + maxTokens at its start, and the maximum makes every request hold far more than it uses. Lower it, spread the batch, back off, or ask for a higher quota."],
    ["A law firm's contract summariser sometimes lists a clause that the contract does not contain. Every call returns 200.", false,
      "No. The calls succeed. The role, the Region and the quota decide whether and where the model runs, never what it writes. An invented clause is a grounding problem: check each summary against the contract before a lawyer relies on it.",
      "Nothing here is refused: every call returns 200. Roles, Regions and quotas decide whether and where the model runs, not what it writes. A clause that is not in the contract is the model inventing text, which needs checks on the output against the contract, not a platform setting."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is it the role, the Region or the quota?</h1>
        <p class="lead">Three services away from the hospital, all calling hosted models on a cloud platform.</p>
        <p class="task">For each one, decide whether the fix is in the platform layers: who, where or how much. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can read a cloud model error</h1>
      <p class="lead">You sorted three failures into who, where and how much, and saw that the same 403 can come from the role or from an organisation rule. You checked with botocore's own rules that only throttling and outages are worth retrying. You wrote a policy for one model in one Region, picked the model ID that keeps the work in Frankfurt, worked out why a large maxTokens triggers 429s early, and found the environment variable that quietly moved every call to the US.</p>
      <p class="lead">This lesson was the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here you called a model someone else hosts. Next, you weigh a cloud's managed ML platform against running your own containers, for a team that trains and serves its own models.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Hosted model APIs on a cloud platform",
    checked: "2026-11-14",
    sources: [
      "https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/troubleshooting-api-error-codes.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/geographic-cross-region-inference.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/global-cross-region-inference.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-token-burndown.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html",
      "https://docs.aws.amazon.com/general/latest/gr/bedrock.html",
      "https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_access-denied.html",
      "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html",
      "https://docs.aws.amazon.com/boto3/latest/guide/credentials.html",
      "https://docs.aws.amazon.com/boto3/latest/guide/configuration.html",
      "https://docs.aws.amazon.com/boto3/latest/guide/retries.html"
    ],
    interview: [{
      q: "Your summariser calls a hosted model on your cloud platform, and customer text must stay in one country. After a model upgrade every call fails with access denied, and at peak hours you also see 429s. Walk me through how you find and fix each one.",
      good: [
        "Read the code and the end of the message: a 403 is a policy decision, a 429 is a quota; only the 429 (and outages) are worth retrying, with backoff",
        "For the 403, compare the model ID or ARN the app now calls with the Resource in the role's policy, and check whether an organisation-level rule (an SCP) denies it",
        "Keep residency by calling the in-country Region with a plain model ID and pinning the Region in code; a geographic or global inference profile can process requests in other Regions",
        "For the 429, lower max_tokens toward the real answer size, since the quota holds it at the start of each call, spread bursts, and request a quota increase ahead of time",
        "Prove it with the audit log (CloudTrail), which records the calls and, for profiles, where each was processed"
      ],
      weak: "Add retries everywhere and switch to a cross-Region profile for more capacity. Retries cannot change a policy's answer, and the profile can process customer data outside the country."
    }],
    screens: [situation, diagnose, spotIdea, whoPolicy, wherePick, howMuch, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CALLS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(RUN.steps.length - 1).fill("[data-next]") },
      { wrong: ['[data-line="1"]'], right: [`[data-line="${MIX_RIGHT}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
