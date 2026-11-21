/* Lesson s6-gpu-containers: GPU containers and driver mismatches.
   Story: a factory's defect-report classifier should run on the one GPU box in the server room (a GeForce
   workstation card), but the container only sees the CPU.
   Ideas: (1) a container reaches the GPU only through the host: the driver (kernel part and libcuda) lives on the host,
   and the NVIDIA Container Toolkit mounts the driver files and the GPU into the container as it starts; the image
   brings everything above the driver (CUDA runtime and libraries, PyTorch, the code). (2) So the host driver must be
   new enough for the CUDA inside the image, and each error message points at one layer: no runtime, driver too old,
   a PyTorch build without CUDA, out of memory.
   Depth: explain (screens 1-5, 8), debug (screens 2 and 6: real failing artefacts), when-not (screens 7 and 8).
   Runs (no model call, no API): docs/ai-path/runs/s6-gpu-containers/ (no_runtime.sh -> no_runtime.out.txt: Docker
   on this Mac asked for --gpus; cpu_only_build.py -> cpu_only_build.out.txt: PyTorch without CUDA; gpu_oom.py ->
   gpu_oom.out.txt: a real out-of-memory error on the Mac's own GPU through PyTorch's mps device; env.txt).
   Not run by us (quoted from NVIDIA's documentation, marked on screen): the driver-too-old container message, the
   nvidia-smi and deviceQuery lines. Lesson-local CSS: the clickable output lines and the host/image stack picture
   (prefix lx-s6-gpu-containers-). */
(() => {
  const P = "lx-s6-gpu-containers-";
  const CHECKED = "2026-11-13";
  const DOC_FAQ = "https://docs.nvidia.com/deploy/cuda-compatibility/frequently-asked-questions.html";
  const DOC_MINOR = "https://docs.nvidia.com/deploy/cuda-compatibility/minor-version-compatibility.html";
  const DOC_SAMPLE = "https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/sample-workload.html";

  // From docs/ai-path/runs/s6-gpu-containers/no_runtime.out.txt (Docker Desktop on an M1 Mac, runtimes: runc only)
  const RUN_NORUNTIME = {
    cmd: "docker run --rm --gpus all redis:7-alpine true",
    text: 'docker: Error response from daemon: could not select device driver "" with capabilities: [[gpu]]',
    runtimes: "io.containerd.runc.v2 runc", exit: 125
  };
  // From docs/ai-path/runs/s6-gpu-containers/cpu_only_build.out.txt (PyTorch on an M1 Mac: no CUDA in the build)
  const RUN_CPU = {
    lines: [
      "torch: 2.15.0",
      "cuda: None",
      "has gpu: False",
      "runs on: cpu"
    ],
    forced: "asking for the GPU ...",
    error: "AssertionError: Torch not compiled with CUDA enabled",
    date: "2026-11-14"                                 // rerun with shorter labels on this date
  };
  const CODE_CPU = [
    "import torch",
    "print(\"torch:\", torch.__version__)",
    "print(\"cuda:\", torch.version.cuda)",
    "has_gpu = torch.cuda.is_available()",
    "print(\"has gpu:\", has_gpu)",
    "device = \"cuda\" if has_gpu else \"cpu\"",
    "print(\"runs on:\", device)",
    "print(\"asking for the GPU ...\")",
    "reports = torch.zeros(4, device=\"cuda\")"
  ];
  // From docs/ai-path/runs/s6-gpu-containers/gpu_oom.out.txt (Apple GPU via mps, limit lowered on purpose; trimmed with … )
  const RUN_OOM = {
    text: "RuntimeError: MPS backend out of memory (MPS allocated: 0 bytes, other allocations: 384.00 KiB, max allowed: 606.21 MiB). Tried to allocate 2.00 GiB on shared pool. …",
    asked: "2.00 GiB", limit: "606.21 MiB"
  };
  // Quoted from NVIDIA's CUDA Compatibility FAQ (DOC_FAQ), not run by us
  const DOC_NGC = {
    text: "This container was built for NVIDIA driver Release 450.51 or later, but version 418.126.02 was detected and compatibility mode is UNAVAILABLE.",
    built: "450.51", found: "418.126.02"
  };
  // Quoted from NVIDIA's sample workload page (DOC_SAMPLE), not run by us
  const DOC_SMI = { cmd: "sudo docker run --rm --runtime=nvidia --gpus all ubuntu nvidia-smi", header: "| NVIDIA-SMI 535.86.10 Driver Version: 535.86.10 CUDA Version: 12.2 |", driver: "535.86.10" };
  // Quoted from NVIDIA's Minor Version Compatibility page (DOC_MINOR), not run by us
  const DOC_PASS = {
    smi: "| NVIDIA-SMI 580.65.06 Driver Version: 580.65.06 CUDA Version: 13.0 |",
    dq: "CUDA Driver Version / Runtime Version 13.0 / 13.4", result: "Result = PASS"
  };
  const DOC_FAIL = { lines: ["cudaGetDeviceCount returned 3", "-> initialization error", "Result = FAIL"] };
  // NVIDIA's Table 1 (minimum driver per CUDA major release), DOC_MINOR, checked CHECKED
  const MIN_DRIVER = { 13: 580, 12: 525, 11: 450 };

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}log{font-family:var(--mono);font-size:13px;background:var(--sunk);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ink)}
      .${P}src{font-size:12px;color:var(--muted);margin:2px 0 10px}
      .${P}lines{display:flex;flex-direction:column;gap:6px;margin:8px 0}
      .${P}line{font-family:var(--mono);font-size:13px;text-align:left;min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);cursor:pointer;overflow-wrap:anywhere}
      .${P}line.no{border-color:var(--bad);background:var(--bad-soft)}
      .${P}line.yes{border-color:var(--good);background:var(--good-soft)}
      .${P}line:disabled{cursor:default}
      .${P}stack{display:flex;flex-direction:column;gap:0;margin:12px 0;font-size:14px}
      .${P}box{border:2px solid var(--ink);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--ink)}
      .${P}box.host{border-style:dashed;background:var(--sunk)}
      .${P}box h3{margin:0 0 6px;font-size:13px;font-weight:600;color:var(--ink-2)}
      .${P}box ul{margin:0;padding-left:18px}
      .${P}mid{font-size:13px;color:var(--ink-2);padding:6px 12px;border-left:2px solid var(--ink);margin-left:18px}
      .${P}q{margin-top:14px}
      .${P}tag{font-family:var(--mono);font-size:13px}
      .${P}a{display:inline-flex;align-items:center;min-height:44px}
    `;
    document.head.appendChild(s);
  }
  const notRun = (url, what) => `<p class="lead"><b>Not run by us.</b> ${what} quoted from the <a href="${url}" target="_blank" rel="noopener" class="${P}a">official documentation</a>, checked ${CHECKED}.</p>`;
  const log = t => `<div class="${P}log">${kit0.esc(t)}</div>`;
  let kit0 = null;                                     // set on each screen, so helpers can escape

  /* 1. The situation: does a plain docker run reach the GPU? */
  function situation({ el, done, kit }) {
    css(); kit0 = kit;
    let ans = null;
    const opts = [
      "Yes. A container shares the host's kernel, so it sees all the host's hardware.",
      "No. Docker hands a container a GPU only when the run asks for one, and only through NVIDIA's runtime on the host.",
      "Only if the image also installs the NVIDIA driver."
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>The GPU box that runs on CPU</h1>
        <p class="lead">A factory sorts defect reports from its production line with a small classifier. It is already packed in a Docker image, the way the last lesson packs a service. Now it moves to the one GPU box in the server room, a workstation with an NVIDIA card and the NVIDIA driver installed. (The driver is the software that lets the kernel, the core of the operating system, talk to the card.) This lesson shows how a container reaches the GPU, and how to read the errors when it does not. The team starts the classifier the way they start every service:</p>
        ${log("docker run -p 8000:8000 defect-classifier")}
        <p class="task">Can the code inside this container use the NVIDIA card?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. A container sees only the devices Docker gives it. Docker's own guide says to add the <code>--gpus</code> flag to give a container a GPU, and that flag works only after the NVIDIA Container Toolkit (NVIDIA's add-on for Docker) is installed on the host. This run does not ask for a GPU, so the classifier quietly runs on the CPU. The rest of this lesson is about how the GPU gets in, and what goes wrong on the way.`, true)
          : ans === 0 ? kit.feedback(`It does share the kernel, but not the devices. A container gets its own small set of device files; a GPU is added only when the run asks for it with <code>--gpus</code>, through NVIDIA's runtime on the host.`, false)
          : kit.feedback(`The driver is the one thing the image should not bring: part of it runs inside the host's kernel, which the container does not own. The host already has it. What is missing is the request (<code>--gpus</code>) and NVIDIA's runtime on the host to pass the card in.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. By hand: match four real error messages to their cause. */
  const CAUSES = [
    "No NVIDIA runtime: Docker cannot hand over a GPU",
    "The host driver is older than the image's CUDA needs",
    "PyTorch in the image was built without CUDA",
    "The GPU ran out of memory"
  ];
  const MSGS = [
    { text: RUN_NORUNTIME.text, right: 0,
      yes: `Right. Docker was asked for a device with the <code>gpu</code> capability and found no driver that offers one: the name in quotes is empty. On our machine the only runtimes were <code>${RUN_NORUNTIME.runtimes}</code>, no NVIDIA runtime. The container never started (exit code ${RUN_NORUNTIME.exit}).`,
      no: { 1: "A version check needs a driver to be found first. Here Docker found no GPU driver at all: the driver name in the message is empty.", 2: "No Python ran. The error comes from the Docker daemon, before the container starts.", 3: "Nothing was allocated: the container did not even start." },
      from: `Our run, ${CHECKED}: <code>${RUN_NORUNTIME.cmd}</code> on a Mac whose Docker has no NVIDIA runtime.` },
    { text: RUN_CPU.error, right: 2,
      yes: "Right. The PyTorch package itself contains no CUDA code. It does not matter what card or driver the machine has: this build cannot use an NVIDIA GPU.",
      no: { 0: "With the GPU missing, a CUDA build would say it found no device. This message is about the PyTorch build itself: it was compiled without CUDA.", 1: "A driver problem appears when CUDA starts talking to the driver. This build has no CUDA code, so it never gets that far.", 3: "No memory was asked for: the call failed before any GPU allocation." },
      from: `Our run, ${RUN_CPU.date}: PyTorch on a Mac, where PyTorch is built without CUDA.` },
    { text: RUN_OOM.text, right: 3,
      yes: `Right. The GPU was found and working; it refused one request: ${RUN_OOM.asked} asked for, ${RUN_OOM.limit} allowed. The usual fixes are smaller batches or a smaller model, not drivers.`,
      no: { 0: "The GPU was found and in use: the message reports what is already allocated on it and the limit. A missing runtime fails before any of that.", 1: "A driver mismatch stops CUDA from starting at all. Here the GPU worked and refused one allocation that was too big.", 2: "This PyTorch talks to the GPU fine. It refused one request because the request was bigger than the limit." },
      from: `Our run, ${CHECKED}, on the Mac's own GPU (Apple's, which PyTorch calls <code>mps</code>), with the memory limit lowered so the error appears without filling the machine. On an NVIDIA card PyTorch raises <code>torch.cuda.OutOfMemoryError</code> for the same thing.` },
    { text: DOC_NGC.text, right: 1, quoted: true,
      yes: `Right. The image says it needs a driver from release ${DOC_NGC.built} or later; the host has ${DOC_NGC.found}. The fix is on the host: a newer driver.`,
      no: { 0: `The container found a driver and even printed its version, ${DOC_NGC.found}. A missing runtime would stop before any driver is found.`, 2: `The image knows exactly what it was built for: driver release ${DOC_NGC.built} or later. The build is fine; the host's driver is older.`, 3: "Nothing about memory: the message compares two driver versions." },
      from: `<b>Not run by us.</b> Quoted from <a href="${DOC_FAQ}" target="_blank" rel="noopener" class="${P}a">NVIDIA's CUDA Compatibility FAQ</a>, checked ${CHECKED}.` }
  ];
  function matchErrors({ el, done, kit }) {
    css(); kit0 = kit;
    const ans = MSGS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Four errors, four causes</h1>
        <p class="lead">Here are four real error messages. Three come from our own runs on one Mac. One, marked, comes from NVIDIA's documentation. Where each came from shows in full after you answer. (<code>MPS</code> is PyTorch's name for a Mac's own GPU.) Each one points at a different layer between the code and the card.</p>
        <p class="task">For each message, pick the cause. Read the message for who is speaking (Docker, PyTorch, the container) and what it compares.</p>
        ${MSGS.map((m, i) => `<div class="lcase" id="m${i}"><p><b>Message ${i + 1}</b></p>${log(m.text)}${m.quoted && ans[i] !== m.right ? `<p class="${P}src"><b>Not run by us.</b> Quoted from NVIDIA's documentation; the link shows after you answer.</p>` : ""}
          ${kit.options(CAUSES.map(kit.esc), { picked: ans[i], correct: m.right })}
          ${ans[i] == null ? "" : ans[i] === m.right ? kit.feedback(m.yes, true) + `<p class="${P}src">${m.from}</p>` : kit.feedback(m.no[ans[i]], false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (MSGS.every((m, j) => ans[j] === m.right)) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: nvidia-smi inside a plain ubuntu image. */
  function spotIdea({ el, done, kit }) {
    css(); kit0 = kit;
    let ans = null;
    const opts = [
      "Docker downloaded the NVIDIA tools when it saw --gpus",
      "NVIDIA's toolkit on the host put the host's own driver files and the GPU into the container as it started",
      "The ubuntu image ships a general NVIDIA driver for any card"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Where did the driver come from?</h1>
        <p class="lead">NVIDIA's check that the toolkit works runs <code>nvidia-smi</code>, NVIDIA's GPU status tool, inside the plain <code>ubuntu</code> image, which contains no NVIDIA software:</p>
        ${log(DOC_SMI.cmd)}
        <p class="lead">The documented output starts with this line:</p>
        ${log(DOC_SMI.header)}
        ${notRun(DOC_SAMPLE, "Command and output")}
        <p class="task">The image has no nvidia-smi and no driver. Where did they come from?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. That is the whole trick. When the container starts, NVIDIA's runtime hook adds the chosen GPU devices and <b>mounts the host's driver libraries and tools</b> into it (mounting makes host files appear inside the container, like a Docker volume). NVIDIA's docs list which: the <code>compute</code> capability (needed for CUDA) and <code>utility</code> (needed for nvidia-smi) are on by default. So the driver always belongs to the <b>host</b>; the image brings everything above it. The ${DOC_SMI.driver} in that line is the host's driver, whatever image you run.`, true)
          : ans === 0 ? kit.feedback(`Nothing is downloaded at start. If it were, the driver files would have to match the host's kernel driver anyway, so they would have to come from the host. They do: they are mounted from it.`, false)
          : kit.feedback(`NVIDIA ships the part of the driver that programs load (libcuda) and the kernel part in one package, as a pair, and the kernel part is whatever this host has installed. That is why the files come from the host itself, mounted in as the container starts.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Use it: sort each piece to the host or the image, then see the stack. */
  const PIECES = [
    ["the kernel part of the NVIDIA driver", 0, "It runs inside the host's kernel, which every container shares. An image cannot bring a kernel driver."],
    ["libcuda, the user-mode CUDA driver", 0, "NVIDIA ships it in one driver package with the kernel part, as a pair, so the toolkit mounts it from the host (the compute capability)."],
    ["the NVIDIA Container Toolkit", 0, "It hooks into Docker on the host and prepares each container before it starts. It is installed once per machine."],
    ["the CUDA runtime and maths libraries (cuBLAS)", 1, "These come with your framework or a CUDA base image, in the image. Each image can carry a different CUDA version. (This CUDA runtime is a library your code calls; it is not the NVIDIA container runtime from screen 1.)"],
    ["PyTorch, built for one CUDA version", 1, "Installed by your Dockerfile, so it is in the image. Which build you install decides which CUDA version the image needs."],
    ["the classifier's Python code", 1, "Your own code travels in the image. It never talks to the driver directly: PyTorch and the CUDA libraries do that."]
  ];
  const SIDES = ["Host", "Image"];
  function sortStack({ el, done, kit }) {
    css(); kit0 = kit;
    const ans = PIECES.map(() => null);
    const paint = () => {
      const all = PIECES.every(([, r], i) => ans[i] === r);
      el.innerHTML = `<h1>Host or image?</h1>
        <p class="lead">Six pieces stand between the classifier and the card. Some must be on the GPU box itself; some travel inside the image, the same on every machine.</p>
        <p class="task">For each piece, pick where it lives.</p>
        ${PIECES.map(([name, r, why], i) => `<div class="lcase" id="k${i}"><p>${kit.esc(name)}</p>${kit.options(SIDES, { picked: ans[i], correct: r })}
          ${ans[i] == null ? "" : ans[i] === r ? kit.feedback(kit.esc(why), true) : kit.feedback(kit.esc(r === 0
            ? `Not in the image. ${why}`
            : `Not on the host. ${why}`), false)}</div>`).join("")}
        ${all ? `<div class="${P}stack" aria-label="the image on top of the host">
            <div class="${P}box"><h3>Image: the same on every machine</h3><ul>${PIECES.filter(p => p[1] === 1).map(p => `<li>${kit.esc(p[0])}</li>`).reverse().join("")}</ul></div>
            <div class="${P}mid">At start, the toolkit mounts the host's driver files and the GPU into the container.</div>
            <div class="${P}box host"><h3>Host: different on every machine</h3><ul>${PIECES.filter(p => p[1] === 0).map(p => `<li>${kit.esc(p[0])}</li>`).reverse().join("")}<li>the GPU itself</li></ul></div>
          </div>${kit.feedback("This split explains every message on screen 2. Nothing to hand over: no runtime. The image's CUDA asks more than the host driver gives: driver too old. The image's PyTorch has no CUDA: wrong build. The card is full: out of memory. The one rule that ties the two halves together comes next.")}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PIECES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 5. Use it with predictions: is the host driver new enough for the image's CUDA? */
  const PAIRS = [
    { driver: "580.65.06", cuda: "13.4", note: "nvidia-smi on this host shows “CUDA Version: 13.0”." },
    { driver: "580.65.06", cuda: "12.x", note: "An older service image, built on CUDA 12." },
    { driver: DOC_SMI.driver, cuda: "13.x", note: "The server-room box (a GeForce workstation card). The team just moved the base image to CUDA 13." },
    { driver: DOC_NGC.found, cuda: "11.x", note: "An old office PC with a GeForce card, and an image built on CUDA 11." }
  ];
  const major = c => parseInt(c, 10);
  const runs = p => parseInt(p.driver, 10) >= MIN_DRIVER[major(p.cuda)];
  const VERDICTS = ["It runs", "It stops: the host driver is too old", "It runs if the image brings newer driver files"];
  function predictCompat({ el, done, kit }) {
    css(); kit0 = kit;
    const ans = PAIRS.map(() => null);
    const tbl = Object.keys(MIN_DRIVER).sort((a, b) => b - a).map(m => `CUDA ${m}.x needs driver ${MIN_DRIVER[m]} or newer`).join("\n");
    const paint = () => {
      el.innerHTML = `<h1>Is the driver new enough?</h1>
        <p class="lead">The rule that ties host and image together: the host driver must be at least the minimum that the image's CUDA needs. A newer driver always runs older CUDA. Within one CUDA major release (all of 12.x, say), NVIDIA publishes one minimum driver; NVIDIA's table, checked ${CHECKED}:</p>
        ${log(tbl)}
        <p class="lead">The first number of a driver version is what you compare: 580.65.06 is driver 580.</p>
        <p class="task">For each host and image, predict what happens when the container starts its CUDA work.</p>
        ${PAIRS.map((p, i) => {
          const r = runs(p) ? 0 : 1, picked = ans[i], need = MIN_DRIVER[major(p.cuda)], drv = parseInt(p.driver, 10);
          const yes = r === 0
            ? (i === 0 ? `Right: ${drv} ≥ ${need}, so CUDA ${p.cuda} runs, even though nvidia-smi shows 13.0. That number belongs to the <b>driver</b>, not to the CUDA in your image: NVIDIA's own run of this pair (below) reports driver 13.0 beside runtime 13.4, and passes. Running newer CUDA within the same major release is called <b>minor version compatibility</b>.`
              : `Right: ${drv} ≥ ${need}. A driver newer than the image's CUDA is always fine: drivers are backward compatible.`)
            : `Right: ${drv} is below ${need}, the minimum for CUDA ${major(p.cuda)}. Official CUDA images then refuse to start the container; a program that starts anyway fails when CUDA starts (NVIDIA's documented failure is below). Fix: upgrade the host driver, or build this image on a CUDA release the driver supports.`;
          const no = picked === 2
            ? `NVIDIA's “forward compatibility” does ship newer driver libraries beside the app, but only for NVIDIA data-center GPUs, some server RTX cards and Jetson boards. ${r === 0 ? "This pair does not need it: the driver is already new enough." : "This machine has a GeForce card, so it does not apply: the driver is simply too old."}`
            : r === 0 ? `Compare: ${drv} against ${need}, the minimum for CUDA ${major(p.cuda)}. ${drv} is enough.`
            : `Compare: ${drv} against ${need}, the minimum for CUDA ${major(p.cuda)}. ${drv} is too old.`;
          return `<div class="lcase" id="p${i}"><p><span class="${P}tag">driver ${kit.esc(p.driver)}</span> · <span class="${P}tag">image CUDA ${kit.esc(p.cuda)}</span><br>${kit.esc(p.note)}</p>
            ${kit.options(VERDICTS.map(kit.esc), { picked, correct: r })}
            ${picked == null ? "" : picked === r ? kit.feedback(yes, true) : kit.feedback(no, false)}</div>`;
        }).join("")}
        ${ans.every((a, i) => a === (runs(PAIRS[i]) ? 0 : 1)) ? `<p class="lead">What NVIDIA's documentation shows for the first pair:</p>${log(`${DOC_PASS.smi}\n…\n${DOC_PASS.dq}\n…\n${DOC_PASS.result}`)}<p class="lead">and when the driver is below the minimum:</p>${log(DOC_FAIL.lines.join("\n"))}${notRun(DOC_MINOR, "Both outputs")}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (PAIRS.every((p, j) => ans[j] === (runs(p) ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 6. Broken on purpose: the classifier logs "cpu". Find the cause line, the fix and the guard. */
  const CAUSE_LINE = 1;
  const LINE_NO = {
    0: "The version number says which PyTorch release this is, not whether this build contains CUDA. Look at the next line.",
    2: "This is a symptom. torch.cuda.is_available() is False for several reasons: no GPU passed in, a driver problem, or a build without CUDA. One line here rules out the first two.",
    3: "This is the fallback doing its job: it follows from the line above it. It is also what hid the problem, since the service kept working, slowly."
  };
  const FIXES = [
    "Rebuild the image with PyTorch's CUDA build, for a CUDA version the box's driver supports",
    "Add --gpus all to the docker run command",
    "Upgrade the host's NVIDIA driver"
  ];
  const GUARDS = [
    "Keep the fallback: on the CPU it is slower but still works",
    "On the GPU box, check at startup and refuse to start if torch.cuda.is_available() is False",
    "Retry torch.cuda.is_available() every minute until it turns True"
  ];
  function brokenBuild({ el, done, kit }) {
    css(); kit0 = kit;
    let line = null, fix = null, guard = null;
    const paint = () => {
      const found = line === CAUSE_LINE;
      el.innerHTML = `<h1>Broken on purpose: it says “cpu”</h1>
        <p class="lead">The box now has the toolkit, and the team starts the classifier with <code>--gpus&nbsp;all</code>. It still logs that it runs on the CPU. Here is its startup check and the real output of its first four prints; the last two code lines come into play later. We ran it on a Mac, where PyTorch comes without CUDA. That is the same state as an image whose Dockerfile installed PyTorch's CPU build (PyTorch's install page offers “Compute Platform: CPU” next to the CUDA versions).</p>
        ${kit.code(CODE_CPU, found ? 2 : -1)}
        <p class="task">Click the output line that shows the cause.</p>
        <div class="${P}lines">${RUN_CPU.lines.map((t, i) => `<button type="button" class="${P}line${line === i ? (i === CAUSE_LINE ? " yes" : " no") : ""}" data-i="${i}"${found ? " disabled" : ""}>${kit.esc(t)}</button>`).join("")}</div>
        <div class="lpanel">${line == null ? "" : found
          ? kit.feedback(`Right. <code>torch.version.cuda</code> names the CUDA a PyTorch build carries, and here it is <b>None</b>: this build has no CUDA code at all, so the GPU and the driver are never even asked. When we then forced the GPU (the last two lines of the script), the run ended with:`, true) + log(`${RUN_CPU.forced}\n…\n${RUN_CPU.error}`) + `<p class="${P}src">Our run, ${RUN_CPU.date}. Message 2 on screen 2.</p>`
          : kit.feedback(LINE_NO[line], false)}</div>
        ${found ? `<div id="q2" class="${P}q"><p class="task">What fixes it?</p>${kit.options(FIXES.map(kit.esc), { picked: fix, correct: 0 })}
          ${fix == null ? "" : fix === 0 ? kit.feedback("Right. The image must carry a PyTorch built with CUDA, and that CUDA must be one the host driver supports (screen 5). Then <code>torch.version.cuda</code> shows a version and <code>is_available()</code> can turn True.", true)
            : fix === 1 ? kit.feedback("It is already there. Even with the GPU passed in, this PyTorch has no CUDA code to use it: <code>torch.version.cuda</code> stays None.", false)
            : kit.feedback("A build without CUDA never calls the driver, so a new driver changes nothing here. The fault is in the image, not on the host.", false)}</div>` : ""}
        ${fix === 0 ? `<div id="q3" class="${P}q"><p class="task">The fallback line hid this for days. What should the service do on the GPU box?</p>${kit.options(GUARDS.map(kit.esc), { picked: guard, correct: 1 })}
          ${guard == null ? "" : guard === 1 ? kit.feedback("Right. Where a GPU is expected, a missing GPU is a failed deploy, not a mode. Failing at startup shows the error at once, in the place where it can be fixed. Keep the fallback for laptops, behind a setting.", true)
            : guard === 0 ? kit.feedback("That is what happened: reports piled up slowly, nobody saw an error, and the GPU sat idle. A silent fallback turns a clear failure into a vague slowness.", false)
            : kit.feedback("Nothing changes while the container runs: the build has no CUDA and never will. Retrying cannot fix an image; it only delays the moment someone notices.", false)}</div>` : ""}`;
      el.querySelectorAll(`.${P}line`).forEach(b => b.onclick = () => { line = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); });
      el.querySelectorAll("#q3 .lopts button").forEach(b => b.onclick = () => { guard = +b.dataset.i; paint(); if (guard === 1) done(); });
    };
    paint();
  }

  /* 7. The big picture: what for, when, when not, cost. Task: pick the right setup for three teams. */
  const SETUPS = ["A GPU container", "A plain CPU container", "A hosted model API"];
  const BIG = [
    ["The defect classifier itself: a small model that handles a few hundred reports a day and answers in well under a second on the CPU.", 1,
      "Right. It is fast enough without a GPU, so a GPU only adds a driver, a toolkit and a pricier box to look after. The CPU image runs anywhere."],
    ["The factory wants a language model to summarise defect reports, and the reports may not leave the building.", 0,
      "Right. A language model needs a GPU to answer at a usable speed, and the data must stay on site, so the model runs on the factory's own GPU box in a container."],
    ["A small office team wants a summary from a large model a few times a day. They own no GPU, and sending the text to a provider is allowed.", 2,
      "Right. A few calls a day do not pay for a GPU box and its upkeep. A hosted API needs no driver, no toolkit and no hardware."]
  ];
  const BIG_NO = [
    { 0: "It runs fine on the CPU already. A GPU container adds a driver to keep current and a costlier box, for no gain.", 2: "Sending reports to an outside API adds cost per call and a network hop, for a model that already runs fast on the CPU in-house." },
    { 1: "A language model on the CPU would be far too slow for this. The model needs a GPU.", 2: "The reports may not leave the building, so a hosted API is ruled out." },
    { 0: "They own no GPU, and a few calls a day would not pay for buying one and keeping its driver current.", 1: "A large model on an office CPU would be far too slow, and they are allowed to use a provider." }
  ];
  function bigPicture({ el, done, kit }) {
    css(); kit0 = kit;
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When a GPU container is worth it</h1>
        <p class="lead"><b>What it is for:</b> running GPU code, such as a model server or a training job, in the same packaging as your other services, so one image runs on the office box and on a rented cloud GPU.</p>
        <p class="lead"><b>Reach for it</b> when the model really needs a GPU to be fast enough, and you run the model yourself.</p>
        <p class="lead"><b>Not for</b> a model that is fast enough on the CPU, or one you can call as a hosted API. Not on a Mac either: Docker Desktop passes a GPU to Linux containers only on Windows with WSL 2 (Windows Subsystem for Linux).</p>
        <p class="lead"><b>Cost:</b> the GPU machine; a host driver kept new enough for every image on it; the toolkit to install and configure on each host; and images that carry their own CUDA libraries.</p>
        <p class="task">For each team, pick the setup that fits.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(SETUPS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === r ? yes : BIG_NO[i][ans[i]]), ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 8. Recognise it: is this a host-and-image GPU problem? One "no". */
  const CASES = [
    ["A research team runs a notebook server in a container on a GPU workstation. In the notebook's terminal, nvidia-smi answers “command not found”.", true,
      "Yes. nvidia-smi is not in the image; the toolkit mounts it from the host when the container is started with --gpus. So the container was started without a GPU, or the host has no NVIDIA runtime. Check the run command first, then the host.",
      "nvidia-smi comes with the driver, and the toolkit mounts it from the host. If it is missing, no GPU was handed over at start, which is exactly the host-and-runtime layer."],
    ["A new image built on a newer CUDA major release runs on a rented cloud GPU, but on the office box it fails as CUDA starts. The office box's driver was installed two years ago.", true,
      "Yes. The same image, two hosts, two drivers. The office driver is probably below the minimum for the new CUDA release. Compare the driver with NVIDIA's table, then upgrade it or build on the CUDA the driver supports.",
      "The image is identical on both machines; only the host differs. The part that differs is the driver, and an old driver under a newer CUDA is the classic mismatch."],
    ["A classifier runs on the GPU, nvidia-smi shows the model loaded on the card, and the model step itself takes a few milliseconds. But each answer takes three seconds: each request first waits on an outside spelling service.", false,
      "No. The GPU layers all work: the card is found, the model is on it and its step is fast. The time goes to the outside call, before the model even runs. A newer driver or a bigger card changes nothing; measure where each request spends its time.",
      "The GPU is found and the model runs on it in milliseconds, so every layer from driver to PyTorch works. The slow part is the network call outside the GPU. Driver work would not touch it."]
  ];
  function recognise({ el, done, kit }) {
    css(); kit0 = kit;
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is it the GPU plumbing?</h1>
        <p class="lead">Three situations away from the factory.</p>
        <p class="task">For each one, decide whether the cause is in the layers you sorted on screen 4 (driver, toolkit, CUDA version, PyTorch build).</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next (in-page practice). */
  function whatNext({ el, done, kit, topic }) {
    css(); kit0 = kit;
    const nx = topic && topic.next;
    el.innerHTML = `<h1>The driver is the host's, the rest is the image's</h1>
      <p class="lead">You can now say how a container reaches a GPU: the run asks for one with <code>--gpus</code>, and NVIDIA's toolkit on the host mounts the host's driver files and the GPU into the container as it starts. The image brings the CUDA libraries, PyTorch and the code. Why it breaks: the two halves are built apart, so the host driver must be at least as new as the image's CUDA needs. You can read the four common errors by who speaks and what they compare: no runtime, driver too old, a build without CUDA, out of memory. You know when to skip it: a model fast enough on the CPU, or one you can call as an API. And you know what it costs: a GPU machine, a host driver kept new enough for every image, the toolkit on each host, and images that carry their own CUDA libraries.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. One GPU box runs one copy of the service; that lesson runs many copies of a model server and decides how many there should be.</p>` : ""}`;
    done();
  }

  LessonKit.define("s6-gpu-containers", {
    title: "GPU containers and driver mismatches",
    checked: CHECKED,
    sources: [
      "https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/arch-overview.html",
      "https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html",
      DOC_SAMPLE,
      "https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/docker-specialized.html",
      "https://docs.nvidia.com/deploy/cuda-compatibility/why-cuda-compatibility.html",
      DOC_MINOR,
      "https://docs.nvidia.com/deploy/cuda-compatibility/forward-compatibility.html",
      DOC_FAQ,
      "https://docs.nvidia.com/cuda/cuda-runtime-api/group__CUDART__TYPES.html",
      "https://docs.docker.com/engine/containers/gpu/",
      "https://docs.docker.com/desktop/features/gpu/",
      "https://docs.pytorch.org/docs/2.15/generated/torch.cuda.OutOfMemoryError.html",
      "https://pytorch.org/get-started/locally/"
    ],
    interview: [{
      q: "Your model container uses the GPU on a cloud machine, but on the office GPU server the same image logs that it runs on the CPU. How do you find the cause?",
      good: [
        "Work up the layers: on the host, nvidia-smi shows the card and the driver version",
        "Check the container was started with --gpus and the host has the NVIDIA Container Toolkit configured; nvidia-smi inside the container proves the hand-over",
        "Inside the container, torch.version.cuda shows whether PyTorch was built with CUDA at all",
        "Compare the host driver with the minimum driver for the image's CUDA release",
        "Make the service fail at startup when a GPU is expected and missing, instead of silently falling back"
      ],
      weak: "Installing CUDA or the NVIDIA driver inside the image. The driver comes from the host; the fix is on the host or in the PyTorch build, depending on which layer fails."
    }, {
      q: "The platform team wants to move every service image to a newer CUDA major release next month. What do you check before agreeing?",
      good: [
        "The minimum driver for that CUDA release, against the driver on every GPU host that will run the images",
        "The driver is shared by every container on a host, so a driver upgrade is a host change that touches all services there",
        "nvidia-smi's CUDA Version is what the driver supports, not what is in the images",
        "Forward compatibility can bridge an old driver only on data-center GPUs and a few others; check the actual cards",
        "Roll out on one host first and keep the old images until it passes"
      ],
      weak: "Rebuilding the images and shipping, assuming containers bring everything they need. The CUDA in the image still depends on the driver of each host."
    }],
    screens: [situation, matchErrors, spotIdea, sortStack, predictCompat, brokenBuild, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#m0 [data-wrong]"], right: MSGS.map((_, i) => `#m${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#k0 [data-wrong]"], right: PIECES.map((_, i) => `#k${i} [data-right]`) },
      { wrong: ["#p0 [data-wrong]"], right: PAIRS.map((_, i) => `#p${i} [data-right]`) },
      { wrong: [`.${P}line[data-i="2"]`], right: [`.${P}line[data-i="${CAUSE_LINE}"]`, "#q2 [data-right]", "#q3 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
