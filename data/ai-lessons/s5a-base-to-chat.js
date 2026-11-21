/* Lesson s5a-base-to-chat: from next-token model to chat assistant.
   Story: a language-exchange app swapped in a base model by mistake, and its "Ask the tutor" box answered a
   learner's question by writing more questions.
   Ideas: (1) pretraining makes a text continuer; instruction tuning (SFT) teaches it to reply in an assistant
   turn and stop; preference tuning (DPO, RLHF) nudges which replies it prefers. (2) A chat model still reads
   one string: the chat template, which apply_chat_template builds from a messages list.
   Data: every model reply below was produced on this Mac with Ollama (raw=true, temperature 0, seed 0,
   120 new tokens at most) from three checkpoints of one small open model family (SmolLM2, 135M):
     docs/ai-path/runs/s5a-base-to-chat/generate.py -> generate.out.txt
     docs/ai-path/runs/s5a-base-to-chat/explore.py  -> explore.out.txt
   Every template string comes from a real Transformers run (tokenizer files only):
     docs/ai-path/runs/s5a-base-to-chat/template.py -> template.out.txt
   Quantization and base-model metadata of the three checkpoints (screens 2 and 3), from Ollama:
     docs/ai-path/runs/s5a-base-to-chat/metadata.out.txt
   Texts are trimmed with " … " and never altered. Lesson-local CSS: classes prefixed lx-s5a-base-to-chat-. */
(() => {
  const ID = "s5a-base-to-chat", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5a-base-to-chat.ipynb";
  const RUN_DATE = "2026-11-13";
  const NUM_PREDICT = 120;   // generate.py: options.num_predict
  const MODEL_TAG = "hf.co/bartowski/SmolLM2-135M-Instruct-GGUF:Q4_0";   // generate.py: MODELS.instruct

  // Checkpoints, as named on the Hugging Face Hub (model cards in `sources`).
  const CK = {
    base: { name: "SmolLM2-135M", stage: "pretraining only" },
    sft: { name: "smollm2-135M-SFT-Only", stage: "pretraining + instruction tuning" },
    instruct: { name: "SmolLM2-135M-Instruct", stage: "pretraining + instruction tuning + preference tuning with DPO" }
  };

  // From docs/ai-path/runs/s5a-base-to-chat/generate.out.txt, run "base-plain" (trimmed with … , not altered)
  const REC_SER = {
    src: "runs/s5a-base-to-chat/generate.out.txt#base-plain", model: "base", recordedAt: RUN_DATE,
    question: "When do I use ser and when estar?",
    text: "1. What is the difference between a function and an expression?\n2. How can you tell if a function is defined or not?\n3. What are some examples of functions that have been used in the real world?\n4. What does it mean to be \"in the real world\"? …",
    stop: "length", tokens: 120
  };

  // The matching task: one question, four runs (generate.out.txt, runs "gracias-*"), trimmed with … , not altered.
  const G_Q = "What does gracias mean?";
  const G_SYSTEM = "You are a patient language tutor. Answer in one or two sentences.";
  const REPLIES = [
    { key: "A", run: "gracias-instruct-templated", model: "instruct", prompt: "chat format", reply: true, stop: "stop", tokens: 51,
      text: "Gracias means \"thank you\" in Spanish, and it's used to express gratitude towards someone for their kindness, support, or assistance. It can also be translated as \"good luck,\" \"fortunate circumstance,\" or simply \"thankful.\"" },
    { key: "B", run: "gracias-base-plain", model: "base", prompt: "plain question", reply: false, stop: "length", tokens: 120,
      text: "The word “gracias” is a Latin phrase that means “kindness.” It’s the Spanish equivalent of the English words “merci,” which means thankfulness. The word also has other meanings, such as “gratitude or thanksgiving,” and it can be used to describe both kindnesses and gifts.\n\nThe word gracias is a very common expression in Spanish culture. …" },
    { key: "C", run: "gracias-sft-templated", model: "sft", prompt: "chat format", reply: true, stop: "stop", tokens: 61,
      text: "\"Gratis\" is a Latin phrase that means \"thank you.\" It's often used to express gratitude for something, such as a gift, a visit, or a recommendation from the speaker. It's not just about showing appreciation; it's also about being kind and understanding in your response." },
    { key: "D", run: "gracias-base-templated", model: "base", prompt: "chat format", reply: false, stop: "length", tokens: 120,
      text: "Assistants and assistants, what is it called? Assisting\nAssists to the point of being an assistant\nActor/soparrader (or actor)what is it called? Assisted\n…" }
  ];

  // From template.out.txt (repr lines), not altered.
  const TPL_TRUE = "<|im_start|>system\nYou are a patient Spanish tutor. Answer in two sentences.<|im_end|>\n<|im_start|>user\nWhen do I use ser and when estar?<|im_end|>\n<|im_start|>assistant\n";
  const TPL_FALSE = "<|im_start|>system\nYou are a patient Spanish tutor. Answer in two sentences.<|im_end|>\n<|im_start|>user\nWhen do I use ser and when estar?<|im_end|>\n";
  const TPL_NOSYS = "<|im_start|>system\nYou are a helpful AI assistant named SmolLM, trained by Hugging Face<|im_end|>\n<|im_start|>user\nWhen do I use ser and when estar?<|im_end|>\n<|im_start|>assistant\n";
  const TOKENS = 36;                 // template.out.txt: token count
  const TOK_KEYS = ["input_ids", "attention_mask"];   // template.out.txt: what tokenize=True returns (a BatchEncoding)
  const BASE_HAS_TEMPLATE = false;   // template.out.txt: base tokenizer has a chat template?

  // From explore.out.txt, question "Is this sentence correct: Yo soy cansado?" (not altered)
  const YO_Q = "Is this sentence correct: Yo soy cansado?";
  const REC_YO_PLAIN = { run: "instruct-plain", stop: "stop", tokens: 24, text: "\nOptions are:\n1. No, it's not correct.\n2. Yes, it is correct." };
  const REC_YO_TPL = { run: "instruct-templated", stop: "stop", tokens: 44, text: "Yes, that's the correct answer. The phrase \"yoy soy\" is an idiomatic expression used to express the idea of something being good or pleasant. It means \"I have a good taste in mind.\"" };
  const EMPTY_PLAIN = 4;   // instruct-plain runs with an empty reply: 3 in explore.out.txt + 1 in generate.out.txt (ser/estar)

  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const stopTxt = (s, n) => s === "length" ? `ran until the ${NUM_PREDICT}-token limit cut it off (${n} tokens)` : `stopped on its own by writing the end-of-turn marker (${n} tokens)`;

  /* Lesson-local styles: recorded replies, prompt strings, clickable request lines. Called by every screen,
     so a reload in the middle of the lesson still has them. */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}rec { margin: 14px 0 0; padding: 12px 14px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); }
      .${P}rec .t { white-space: pre-wrap; overflow-wrap: anywhere; font: 400 16px/1.5 var(--font); color: var(--ink); margin: 0; }
      .${P}rec .h { font: 600 13px var(--mono); color: var(--muted); margin: 0 0 6px; }
      .${P}cap { font: 500 12.5px var(--mono); color: var(--muted); margin: 6px 0 0; }
      .${P}str { margin: 12px 0 0; padding: 12px 14px; background: var(--sunk); border-radius: 8px; white-space: pre-wrap; overflow-wrap: anywhere; font: 500 14px/1.6 var(--mono); font-variant-ligatures: none; color: var(--ink); }
      @media (max-width: 480px) { .${P}str { font-size: 12.5px; padding: 10px 10px; } .${P}pool button { font-size: 12.5px; padding: 10px 10px; } }
      .${P}str .end { color: var(--muted); }
      .${P}str .miss { color: var(--muted); font-style: italic; }
      .${P}pool { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
      .${P}pool button, .${P}req button { text-align: left; min-height: 48px; padding: 10px 14px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; font: 500 14px/1.5 var(--mono); font-variant-ligatures: none; cursor: pointer; }
      .${P}pool button:disabled { opacity: .4; cursor: default; }
      .${P}pool button.wrong, .${P}req button.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}req button.right { border-color: var(--good); background: var(--good-soft); }
      .${P}req { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
      .${P}req .fixed { padding: 10px 14px; font: 500 14px/1.5 var(--mono); font-variant-ligatures: none; color: var(--muted); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}link { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); }
      .${P}tag { font: 600 13px var(--mono); color: var(--ink-2); }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
      .${P}check input:focus-visible { outline-width: 3px; }
    `;
    document.head.appendChild(s);
  }

  // A recorded reply, with its caption. `head` names what was asked; text is escaped here.
  const rec = (kit, text, head) => `<div class="${P}rec">${head ? `<p class="h">${kit.esc(head)}</p>` : ""}<p class="t">${kit.esc(text.replace(/^\n+/, ""))}</p></div><p class="${P}cap">Recorded model output, ${RUN_DATE}. Run on this site's Mac with a small open model.</p>`;
  // A prompt string as the model reads it; newlines kept.
  const str = (kit, s, extra = "") => `<div class="${P}str">${kit.esc(s)}${extra}</div>`;
  // Under a long string: a line that wraps on a narrow screen is not a newline in the string.
  const WRAP_NOTE = `<p class="${P}cap">On a narrow screen a long line wraps onto the next row. Those breaks are only wrapping: each turn's text and its <code>&lt;|im_end|&gt;</code> sit on one line in the real string.</p>`;

  /* 1. The situation: a real base-model reply in the tutor box. Diagnose what the model is doing. */
  function situation({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Answering, but badly: it misread the question",
      "Continuing the text: it treats the question as the first line of a page and writes what usually comes next",
      "Refusing to answer, in a roundabout way",
      "Answering, but the answer was cut off before it began"
    ];
    const correct = 1;
    const fb = [
      "An answer, even a bad one, would be about ser and estar. Not one line mentions them, and not one line speaks to the learner. It is not trying to reply at all.",
      `Right. The team had swapped in a <b>base model</b>: a model trained only to predict the next token of ordinary text, as you did in the earlier lessons. To it, a lone question looks like the first line of a page, and pages that start with a question often go on with more questions: a quiz sheet, a forum list. So it wrote more of them. Nothing in its training told it that someone is waiting for a reply. This lesson is about the gap between that model and the chat model behind every AI product: what extra training adds, and what text the model must receive.`,
      "A refusal would still be a reply to the learner (\"I can't help with that\"). This text never addresses anyone. It is a list, written as if the question were the first item on a page.",
      `The cut-off is real: the model ${stopTxt(REC_SER.stop, REC_SER.tokens)}. But the cut explains why the text ends mid-sentence, not why the first line is already a new question about functions.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>The tutor that asked back</h1>
        <p class="lead">A language-exchange app has an "Ask the tutor" box. After a model swap, a learner typed a question and got the reply below. The app sent the question to the model as plain text, nothing else.</p>
        ${rec(kit, REC_SER.text, `Learner: ${REC_SER.question}`)}
        <p class="task">What is the model doing?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. By hand: four real replies to one question. Tag each as a continuation or an assistant reply. */
  function fourReplies({ el, done, kit }) {
    css();
    const ans = REPLIES.map(() => null);
    const LABELS = ["Continues the text", "Replies as an assistant"];
    const right = r => r.reply ? 1 : 0;
    const why = r => {
      if (r.key === "A") return ["It answers the learner's question in an assistant's voice, then stops.", "Read it as the learner would: it answers the question directly, in a speaker's voice, and ends. That is a reply, whatever you think of its extra meanings."];
      if (r.key === "B") return ["It reads like the start of an article about the word, not a reply to someone. It also never ends on its own.", "It talks about gracias, so it can look like an answer. But nobody is addressed: it reads like a blog article that happens to start after the question, and it keeps going about Spanish culture. On-topic is not the same as replying."];
      if (r.key === "C") return ["It is wrong (\"Gratis\" is not the word asked about), but it is shaped as a reply: it answers and stops. Wrong facts and wrong shape are two different problems.", "It gets the word wrong (\"Gratis\"), so it is tempting to call it broken. But judge the shape: it answers the question in an assistant's voice and then ends. Being wrong is a knowledge problem, not a sign that it is continuing text."];
      return ["Word salad that circles around the word \"assistant\". It is not a reply to the learner.", "It never mentions gracias or the learner. It is a list of half-sentences around the word \"assistant\". That is text being continued, not a reply."];
    };
    const paint = () => {
      const all = REPLIES.every((r, i) => ans[i] === right(r));
      el.innerHTML = `<h1>Four replies to one question</h1>
        <p class="lead">To find out what went wrong, the team asked one short question, "${kit.esc(G_Q)}", four times. They used three saved versions (<b>checkpoints</b>) of one small model, each taken at a different point in its training. They sent the question either as plain text or in a chat format. Same size, same settings, no randomness. Here are the four real replies, in a shuffled order.</p>
        <p class="task">For each reply, decide: does it continue the text, or reply as an assistant? Judge the shape, not whether the facts are right.</p>
        ${REPLIES.map((r, i) => {
          const ok = ans[i] === right(r);
          return `<div class="lcase" id="c${i}"><p>Reply ${r.key}</p>${rec(kit, r.text)}
            ${kit.options(LABELS, { picked: ans[i], correct: right(r) })}
            ${ans[i] == null ? "" : kit.feedback(kit.esc(why(r)[ok ? 0 : 1]), ok)}
            ${all ? `<p class="${P}tag">${kit.esc(CK[r.model].name)} (${kit.esc(CK[r.model].stage)}), given the ${kit.esc(r.prompt)}. It ${kit.esc(stopTxt(r.stop, r.tokens))}.</p>` : ""}</div>`;
        }).join("")}
        ${all ? kit.feedback(`Now the labels. B and D come from the base model. B got the plain question and wrote an article. D got the full chat format, with special markers around each turn (screen 5 shows them), and still wrote nonsense: wrapping a base model in chat markers does not make it a chat model. A and C come from tuned versions. Both stopped on their own by writing the <b>end-of-turn marker</b>, a special token that means "my reply is done". Screen 3 asks what the tuning added.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (REPLIES.every((r, j) => ans[j] === right(r))) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: what did the tuning add? */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const C = REPLIES.find(r => r.key === "C"), B = REPLIES.find(r => r.key === "B");
    const opts = [
      "Extra Spanish lessons: the tuned models were trained on more facts about Spanish",
      "Many example conversations in the chat format, each ending with a good assistant reply and an end-of-turn marker",
      "A rule on the server that cuts the text after the first complete answer",
      "A lower temperature, so the tuned models pick safer words"
    ];
    const correct = 1;
    const fb = [
      `Then C would know the word. It says "Gratis is a Latin phrase", while the base model's article (B) already linked gracias to thanks. The tuning changed how the model behaves far more than what it knows.`,
      `Right. This step is called <b>instruction tuning</b>, or supervised fine-tuning (SFT). The pretrained model keeps training on the same next-token task, but now the text is a large set of conversations written in the chat format, and every one has the assistant's turn after the user's, closed by an end marker. It learns: after an open assistant turn, write a reply, then write the end marker. The model that wrote C had only this step; its card says it was trained on a public conversation set called smol-smoltalk.`,
      `All four runs had the same single stop rule: stop when the end-of-turn marker appears. A and C wrote that marker themselves (A after ${REPLIES[0].tokens} tokens, C after ${C.tokens}). B and D never wrote it, so they ran to the ${NUM_PREDICT}-token limit (${B.tokens} tokens). Stopping was the model's choice, not a server rule.`,
      "All four ran at temperature 0 with the same seed. From the sampling lesson: temperature changes which of the likely next tokens gets picked. It cannot turn a model that continues pages into one that replies."
    ];
    const paint = () => {
      el.innerHTML = `<h1>What did the tuning add?</h1>
        <p class="lead">A and C reply. B and D do not. All four come from models of the same size and the same <b>pretraining</b>: the first, long training on ordinary text that made the base model. The two tuned ones also had a short extra step that lets them read longer texts. The big difference is what happened after pretraining.</p>
        <p class="task">What extra training would make a next-token predictor reply and then stop?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. The three stages: match each stage with the data it learns from. */
  const DATA = [
    "Huge amounts of ordinary text from the web, books and code",
    "Example conversations, each with a good assistant reply",
    "Pairs of replies to the same prompt, with one marked as better"
  ];
  const STAGES = [
    { name: "Pretraining", ok: 0, does: "learns language and facts by predicting the next token",
      no: { 1: "Conversations come later. Pretraining needs far more text than anyone could write as example chats, so it uses ordinary text, and the result continues text (reply B).",
            2: "Comparing replies needs a model that already replies. At pretraining time there is no reply yet, only text to continue." } },
    { name: "Instruction tuning (SFT)", ok: 1, does: "learns to reply in the assistant's turn and stop",
      no: { 0: "More ordinary text would only make a better text continuer. To learn the reply habit, the model must see the turn structure many times.",
            2: "Pairs only rank replies. Before that, the model must learn to produce a reply at all, by copying good examples." } },
    { name: "Preference tuning (DPO or RLHF)", ok: 2, does: "learns which of its possible replies people prefer",
      no: { 0: "Ordinary text says nothing about which reply a person would prefer.",
            1: "Single good examples are what instruction tuning copies. Preference tuning needs a comparison: this reply is better than that one." } }
  ];
  function threeStages({ el, done, kit }) {
    css();
    const ans = STAGES.map(() => null);
    const paint = () => {
      const all = STAGES.every((s, i) => ans[i] === s.ok);
      el.innerHTML = `<h1>Three stages, three kinds of data</h1>
        <p class="lead">The model behind reply A went through one more stage after instruction tuning. Its model card (the description page on Hugging Face) says: supervised fine-tuning, then <b>Direct Preference Optimization</b> (DPO) on a public set of rated replies. DPO is one way to do preference tuning; RLHF (reinforcement learning from human feedback) is the older way. Each stage trains on a different kind of data.</p>
        <p class="task">Match each stage with the data it learns from.</p>
        ${STAGES.map((s, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(s.name)}</p>${kit.options(DATA.map(kit.esc), { picked: ans[i], correct: s.ok })}
          ${ans[i] == null ? "" : ans[i] === s.ok ? kit.feedback(`Right: it ${kit.esc(s.does)}.`, true) : kit.feedback(kit.esc(s.no[ans[i]]), false)}</div>`).join("")}
        ${all ? kit.feedback(`The classic recipe for an assistant has these three stages: pretraining, then supervised fine-tuning on written examples, then learning from human rankings with reinforcement learning (RLHF). DPO reaches the same goal with a simpler loss computed straight from the pairs, without first training a separate model that scores replies. One honest limit: you cannot tell C from A by reading one reply each. Preference tuning shifts which reply-shaped answers become more likely, on average, over many prompts. You measure it by comparing many replies, not by eye.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (STAGES.every((s, j) => ans[j] === s.ok)) done();
      }));
    };
    paint();
  }

  /* 5. Fill the chat template by hand: place the turns in order. Pieces are cut from the real template string. */
  const LINES = TPL_TRUE.split("\n");   // last element is "" (the string ends with a newline)
  const PIECES = {
    sys: LINES.slice(0, 2).join("\n"),
    user: LINES.slice(2, 4).join("\n"),
    open: LINES[4] + "\n",
    closed: LINES[4] + "\n<|im_end|>"   // a distractor: an assistant turn that is already closed
  };
  const ORDER = ["sys", "user", "open"];
  const POOL = ["user", "open", "closed", "sys"];   // the order the buttons are shown in
  function fillTemplate({ el, done, kit }) {
    css();
    const built = [];
    let msg = null;
    const paint = () => {
      const fin = built.length === ORDER.length;
      const joined = built.map(k => PIECES[k]).join("\n");
      el.innerHTML = `<h1>Build the string the model reads</h1>
        <p class="lead">Replies A and C came from prompts in this model family's <b>chat template</b>: each turn starts with <code>&lt;|im_start|&gt;</code> and a role, and ends with <code>&lt;|im_end|&gt;</code>. These markers are special tokens the tuned model saw in every training conversation. Now build the tutor's request for the ser and estar question.</p>
        <p class="task">Tap the pieces in the order they belong in the string. Leave out anything that does not belong.</p>
        ${str(kit, built.length ? joined + (fin ? "" : "\n") : "", fin ? `<span class="end">▏ the model starts writing here</span>` : `<span class="miss">${built.length ? "…" : "(empty)"}</span>`)}
        ${WRAP_NOTE}
        <div class="${P}pool">${POOL.map(k => `<button type="button" data-i="${k}" ${built.includes(k) || fin ? "disabled" : ""}>${kit.esc(PIECES[k])}</button>`).join("")}</div>
        <div class="lpanel">${fin ? kit.feedback(`Done. System first, then the user's turn, then an <b>open</b> assistant turn with nothing after it. The model reads the whole string and continues from the end, so the only natural continuation is the assistant's reply, followed by <code>&lt;|im_end|&gt;</code>. Screen 6 checks your string against the library's.`, true)
          : msg ? kit.feedback(msg, false) : ""}</div>`;
      el.querySelectorAll(`.${P}pool button`).forEach(b => b.onclick = () => {
        const k = b.dataset.i, want = ORDER[built.length];
        if (k === want) { built.push(k); msg = null; paint(); if (built.length === ORDER.length) done(); return; }
        msg = k === "closed" ? "This assistant turn is already closed: it says the assistant has finished, with an empty reply. The string would no longer end where the reply should start."
          : k === "open" ? "The open assistant turn goes last. The model writes from the end of the string, so if this came now, the model would start writing before it has read the question."
          : k === "user" ? "In this template the system message comes first. It sets the rules for the whole conversation, so it sits above every turn."
          : "The system message opens the string, once. It is already in place.";
        paint();
      });
    };
    paint();
  }

  /* 6. Library: apply_chat_template, a recorded run. Predict what add_generation_prompt=False changes. */
  // template.py, the first call, line for line.
  const CODE = [
    "from transformers import AutoTokenizer",
    "tokenizer = AutoTokenizer.from_pretrained(",
    "    \"HuggingFaceTB/SmolLM2-135M-Instruct\")",
    "tutor = (\"You are a patient Spanish tutor. \"",
    "         \"Answer in two sentences.\")",
    "ask = \"When do I use ser and when estar?\"",
    "messages = [",
    "    {\"role\": \"system\", \"content\": tutor},",
    "    {\"role\": \"user\", \"content\": ask},",
    "]",
    "prompt = tokenizer.apply_chat_template(",
    "    messages, tokenize=False,",
    "    add_generation_prompt=True)",
    "print(prompt)"
  ];
  function library({ el, done, kit }) {
    css();
    let ans = null;
    const lastTrue = TPL_TRUE.split("\n").filter(Boolean).pop();
    const opts = [
      "The system message is dropped",
      `The last line, ${lastTrue}, is missing: the string ends after the user's turn`,
      "The special markers are removed, leaving plain text",
      "Nothing changes for this model"
    ];
    const correct = 1;
    const fb = [
      "The system message is part of <code>messages</code>, and the template keeps every message you pass. The flag only controls what is added after the last message.",
      `Right. <code>add_generation_prompt=True</code> adds the open assistant turn, the piece you placed last on screen 5. Without it, the string ends with the user's <code>&lt;|im_end|&gt;</code>, and the model has no cue that it is its turn. The Transformers docs warn that it may then do something strange, like continuing the user's message. Use <code>False</code> when you format finished conversations as training data.`,
      "The markers are the whole point of the template: the tuned model learned the turn structure from them. No flag here removes them.",
      "Some templates add nothing at this point (the Transformers docs name Llama as one), so the flag has no effect there. This template does add a line: compare the two recorded strings."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Let the library build it</h1>
        <p class="lead">In real code you do not glue strings. You pass a <b>messages</b> list (roles and contents, the same shape a hosted chat API takes) and <code>apply_chat_template</code> on the model's tokenizer turns it into a string in that model's own template. <code>tokenize=False</code> returns the string, so you can read it. With <code>True</code> you get a dict instead. Its <code>${TOK_KEYS[0]}</code> holds the token ids (${TOKENS} of them here), and that is what you feed the model.</p>
        ${kit.code(CODE, CODE.indexOf("    add_generation_prompt=True)"))}
        <p class="lead">Recorded output (Transformers on this site's Mac, ${RUN_DATE}). It is the string you built on screen 5:</p>
        ${str(kit, TPL_TRUE)}${WRAP_NOTE}
        <p class="task">The same call with <code>add_generation_prompt=False</code>. What changes in the string?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}
        ${ans === correct ? `<p class="lead">Recorded output with <code>add_generation_prompt=False</code>:</p>${str(kit, TPL_FALSE)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. Library, second prediction: no system message. And the base model has no template at all. */
  function noSystem({ el, done, kit }) {
    css();
    let ans = null;
    const extra = TPL_NOSYS.split("\n")[1].replace("<|im_end|>", "");
    const opts = [
      "It starts straight with the user's turn",
      "The template adds a system message of its own",
      "The call fails: this template needs a system message",
      "The user's text is moved into a system turn"
    ];
    const correct = 1;
    const fb = [
      "That is what you might expect, and what some templates do. This one does something else: read the recorded string.",
      `Right, and it is easy to miss. This template writes its own system line when you send none: "${kit.esc(extra)}". Your tutor would introduce itself under another name. Read the template of every model you serve: it can add text you never wrote.`,
      "The call succeeded. The template has a branch for a missing system message, and it fills the gap instead of failing.",
      "This template keeps the user's text in the user turn; the recorded string shows it."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When the system message is missing</h1>
        <p class="lead">Some requests from the app carry only the learner's message, with no system message. The same <code>apply_chat_template</code> call, run on <code>messages[1:]</code> (the list without its first item, like <code>messages.slice(1)</code> in JavaScript).</p>
        <p class="task">What does the string look like now?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : kit.feedback(fb[ans], ans === correct)}
        ${ans == null ? "" : `<p class="lead">Recorded output, user turn only:</p>${str(kit, TPL_NOSYS)}`}
        ${ans === correct ? kit.feedback(`One more line from the same run: asked whether the base model's tokenizer has a chat template, it printed <b>${BASE_HAS_TEMPLATE ? "True" : "False"}</b>. Tools that serve models rely on that. vLLM, a server for open models, for example reads the template from the tokenizer configuration, and without one every chat request errors (unless you pass a template yourself with <code>--chat-template</code>). A check like that would have caught the app's swap before any learner saw it.`) + `<p class="${P}cap"><b>Not run by us.</b> The vLLM behaviour is from the <a class="${P}link" href="https://docs.vllm.ai/en/latest/serving/online_serving/" target="_blank" rel="noopener">vLLM docs</a>, checked 2026-11-13.</p>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. Broken on purpose: the right model, called the wrong way. Find the cause, then the fix. */
  const REQ = [
    { k: "open1", t: "{", pick: false },
    { k: "model", t: `  "model": "${MODEL_TAG}",`, pick: true,
      no: "This is the tuned model, the one that wrote reply A. The model is right this time." },
    { k: "prompt", t: `  "prompt": "${YO_Q}",`, pick: true },
    { k: "raw", t: `  "raw": true, "stream": false,`, pick: false },
    { k: "open2", t: `  "options": {`, pick: false },
    { k: "temp", t: `    "temperature": 0, "seed": 0,`, pick: true,
      no: "Temperature 0 always picks the most likely next token. That makes the output repeatable; it cannot make a model start a quiz instead of a reply. The good replies used the same setting." },
    { k: "num", t: `    "num_predict": ${NUM_PREDICT},`, pick: true,
      no: `The reply was not cut short: the response says it stopped on its own after ${REC_YO_PLAIN.tokens} tokens, well under ${NUM_PREDICT}.` },
    { k: "stop", t: `    "stop": ["<|im_end|>"]`, pick: true,
      no: "The good replies used this same stop rule. It only ends the text when the end marker appears; it does not decide what kind of text comes before it." },
    { k: "close", t: "  }\n}", pick: false }
  ];
  function broken({ el, done, kit }) {
    css();
    let cause = null, fix = null;
    const fixes = [
      "Switch to a bigger model",
      "Build the prompt with the model's chat template (apply_chat_template with add_generation_prompt=True), or send messages to a chat endpoint that applies it",
      `Raise num_predict above ${NUM_PREDICT}`,
      "Raise the temperature so the reply varies"
    ];
    const fixOk = 1;
    const fixNo = [
      "A bigger model reading the same bare question would still see a page, not a conversation. Fix the request first; it costs nothing.",
      "",
      "The reply stopped on its own long before the limit. More room would not change what kind of text it writes.",
      "Variety does not help. It would give a different continuation each time, still not a reply."
    ];
    const paint = () => {
      const found = cause === "prompt";
      el.innerHTML = `<h1>Broken on purpose: the right model, called the wrong way</h1>
        <p class="lead">The team fixed the swap: the box now uses the tuned model. But on their own server (Ollama, called through its <code>/api/generate</code> endpoint), a learner who asked "${kit.esc(YO_Q)}" got this reply. For ${WORDS[EMPTY_PLAIN].toLowerCase()} other questions sent the same way, the reply was empty.</p>
        ${rec(kit, REC_YO_PLAIN.text, `Learner: ${YO_Q}`)}
        <p class="lead">The request the app sent, line by line. <code>raw: true</code> tells Ollama to add no prompt template of its own. Ollama's response also says that the model ${kit.esc(stopTxt(REC_YO_PLAIN.stop, REC_YO_PLAIN.tokens))}.</p>
        <p class="task">${found ? "Now pick the fix." : "Tap the line that causes this."}</p>
        <div class="${P}req">${REQ.map(r => r.pick
          ? `<button type="button" data-i="${r.k}" class="${cause === r.k ? (r.k === "prompt" ? "right" : "wrong") : ""}" ${found ? "disabled" : ""}>${kit.esc(r.t)}</button>`
          : `<div class="fixed">${kit.esc(r.t)}</div>`).join("")}</div>
        <div class="lpanel">
        ${cause == null ? "" : found
          ? kit.feedback("Right. The prompt is the bare question, with no turn markers, and <code>raw: true</code> tells the server not to add any. So the model never sees an open assistant turn. It continues the text the way the base model did, here like a multiple-choice sheet, or it ends at once with an empty reply.", true)
          : kit.feedback(kit.esc(REQ.find(r => r.k === cause).no), false)}
        ${found ? `<div id="fix">${kit.options(fixes.map(kit.esc), { picked: fix, correct: fixOk })}</div>
          ${fix == null ? "" : fix === fixOk
            ? kit.feedback(`Right. Here is the same tuned model, same settings, given the question inside its chat template (with the system line "${kit.esc(G_SYSTEM)}"):`, true) + rec(kit, REC_YO_TPL.text, `Learner: ${YO_Q}`)
              + kit.feedback(`Now it replies. And the reply is wrong: "Yo soy cansado" should use estar. The template fixes the shape of the answer. It cannot add knowledge a model this small does not have. That is a different failure, with different fixes.`)
            : kit.feedback(kit.esc(fixNo[fix]), false)}` : ""}
        </div>`;
      el.querySelectorAll(`.${P}req button`).forEach(b => b.onclick = () => { cause = b.dataset.i; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === fixOk) done(); });
    };
    paint();
  }

  /* 9. The big picture: what each stage is for, when not to use it, what it costs. */
  const CHOICES = ["A chat model as it is", "A base model", "Fine-tune a model on your own examples"];
  const SITS = [
    { q: "A shop wants a support bot that answers customer questions politely. They have no saved conversations to train on.", ok: 0,
      yes: "Right. A tuned chat model plus a good system message covers this. Fine-tuning needs many good example conversations, and they have none.",
      no: { 1: "A base model would continue the customer's text instead of answering it, as the tutor box did.",
            2: "Fine-tuning needs many good example conversations to learn from, and they have none. Start with a chat model and a clear system message." } },
    { q: "A writing tool continues an author's half-finished draft in the same style, from wherever the text stops. No questions, no turns.", ok: 1,
      yes: "Right. Here continuing the text is the job, which is what a base model does. A chat model expects a conversation: you would wrap the draft in a request and then strip the reply's framing.",
      no: { 0: "A chat model expects a turn to reply to. The job here is to continue text with no conversation at all, which is exactly what a base model was trained for.",
            2: "Nothing here needs new training. Continuing text in the style of what came before is what pretraining already teaches." } },
    { q: "A clinic needs every reply in the same fixed form with the same five fields. Careful prompts still drift, and staff have written thousands of correct examples.", ok: 2,
      yes: "Right. Many good examples of exactly the wanted reply is what instruction tuning learns from. Start from a model that is already tuned for chat, not a base model, and keep some examples aside to test it.",
      no: { 0: "They tried that: careful prompts still drift. With thousands of correct examples, tuning on them is the stronger tool.",
            1: "A base model does not reply at all. They need replies in a fixed form, and they have the examples to teach it." } }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = SITS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <p class="lead"><b>What for:</b> a base model continues text; tuning turns it into something that takes instructions and holds a conversation. <b>When to reach for each:</b> the usual choice is a tuned chat model as it is, steered by the messages you send. A base model fits when continuing text is the job, or as the starting point for your own tuning. <b>When not:</b> never put a base model behind a chat box, and do not fine-tune (train further on your own examples) when a clear prompt already works. <b>What it costs:</b> instruction tuning needs many good example conversations; preference tuning needs pairs of replies judged by people or by a model, plus extra training runs. A template mistake costs nothing up front and a lot later: there is no error, only worse answers.</p>
        <p class="task">Pick the right starting point for each situation.</p>
        ${SITS.map((s, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(s.q)}</p>${kit.options(CHOICES, { picked: ans[i], correct: s.ok })}
          ${ans[i] == null ? "" : ans[i] === s.ok ? kit.feedback(kit.esc(s.yes), true) : kit.feedback(kit.esc(s.no[ans[i]]), false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SITS.every((s, j) => ans[j] === s.ok)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it: is this a stage-or-template problem? Two of the four are not. */
  const CASES = [
    ["You self-host an open chat model. Its replies end, then go on with a line \"User: thanks!\", and then it answers that too.", true,
      "Yes. The model is writing the next turns itself. The end-of-turn marker is not being used to stop, or the prompt is not in the model's own template. Render with apply_chat_template and stop on the end marker.",
      "It looks like chattiness, but the model is writing the user's turn for them. That happens when the end-of-turn marker is not used to stop, or the prompt is not in the model's own template. Check both."],
    ["Your code builds <|im_start|> strings by hand. You switch to a model from another family, and its replies turn rambling and odd.", true,
      "Yes. Different model families use different markers, even when tuned from the same base. The new model never saw these ones. Let the new model's tokenizer build the string with apply_chat_template.",
      "This is a template problem. Each family has its own markers, and the new model was never trained on the ones your code writes. The Transformers docs say the wrong markers make models drastically worse. Use the new tokenizer's apply_chat_template."],
    ["A hosted chat API, called with a correct messages list, answers in clear, well-formed sentences that a bus timetable is still valid. It changed last month.", false,
      "No. The request is fine and the answer is shaped as a reply. The problem is what the model knows: the change happened after its training data was collected. The template controls who speaks when, not what the model knows.",
      "The request and the reply's shape are fine: a clean reply in the assistant's turn. The fact is missing because the timetable changed after the model's training data was collected. No template or tuning stage fixes missing knowledge."],
    ["Through a hosted chat API with a correct messages list, long answers stop mid-sentence, and the response says it finished because of length.", false,
      "No. The model was replying properly; it ran into the output limit your request set. Raise the limit or ask for shorter answers.",
      "A base model also runs to the limit, but here the request is a correct messages list to a chat model, and the text is a proper reply until it is cut. The cause is the output limit in your request: raise it or ask for shorter answers."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Stage or template problem?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the language app.</p>
        <p class="task">For each one, decide: is the cause the model's stage or its chat template (yes), or something else (no)? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and a "what you should see" checklist from our own run of template.py. */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    const first = TPL_TRUE.split("\n")[0], lastFalse = TPL_FALSE.split("\n").filter(Boolean).pop();
    const extra = TPL_NOSYS.split("\n")[1].replace("<|im_end|>", "");
    const CHECK = [
      `The printed prompt starts with <code>${kit.esc(first)}</code> and ends with an open <code>&lt;|im_start|&gt;assistant</code> line, with nothing after it.`,
      `With <code>add_generation_prompt=False</code> the last line is the user's turn: <code>${kit.esc(lastFalse)}</code>.`,
      `With only the user message, a system line you did not write appears: "${kit.esc(extra)}".`,
      `The tokenized prompt has ${TOKENS} tokens, and the first one is <code>&lt;|im_start|&gt;</code> as a single token.`,
      `The base model's tokenizer prints <code>${BASE_HAS_TEMPLATE ? "True" : "False"}</code> when asked whether it has a chat template.`,
      `The replayed base-model replies end with <code>done_reason: length</code> after ${NUM_PREDICT} tokens; the tuned models' replies in the chat format end with <code>stop</code>.`
    ];
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now say how a text predictor becomes an assistant (pretraining, instruction tuning, preference tuning), spot a base model or a missing template from the reply alone, and build a request with <code>apply_chat_template</code>.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}link" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a>.` : "The notebook for this lesson is on its way."} It replays the recorded replies above and runs the same <code>apply_chat_template</code> calls on the same model's tokenizer. What you should see:</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. It starts where screen 8 ended: a reply with the right shape and the wrong facts.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "From next-token model to chat assistant",
    checked: "2026-11-13",
    sources: [
      "https://huggingface.co/docs/transformers/main/en/chat_templating",
      "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct",
      "https://huggingface.co/HuggingFaceTB/SmolLM2-135M",
      "https://huggingface.co/HuggingFaceTB/smollm2-135M-SFT-Only",
      "https://docs.ollama.com/api/generate",
      "https://docs.vllm.ai/en/latest/serving/online_serving/",
      "https://arxiv.org/abs/2203.02155",
      "https://arxiv.org/abs/2305.18290"
    ],
    interview: [{
      q: "You move a feature from a hosted chat API to an open-weights model you serve yourself. The replies now ramble, and some invent a \"User:\" line and answer it. What do you check?",
      good: [
        "That the deployed checkpoint is the instruct or chat version, not the base model",
        "That the prompt is built with that model's own chat template (apply_chat_template with add_generation_prompt=True), not hand-written markers from another family",
        "That generation stops on the template's end-of-turn token",
        "Print the rendered string and compare it with the model card, including any default system message the template adds"
      ],
      weak: "Lower the temperature or rewrite the prompt wording. That treats the symptom and never checks whether the model even sees a conversation."
    }, {
      q: "Your team wants a support assistant. One engineer wants to fine-tune a base model on your help-desk logs; another wants an existing instruct model with a system prompt. How do you decide?",
      good: [
        "Start with an instruct model and a system prompt: it already replies and stops, at no training cost",
        "Fine-tune only when prompting fails on something measurable, like a fixed format, and you have many good example replies",
        "If you fine-tune, start from an instruct model, not a base model, and keep a held-out set to compare against the prompt-only version",
        "Preference tuning needs pairs of replies judged better or worse, which costs more data and more training runs"
      ],
      weak: "Fine-tune a base model because it will be ours. That ignores the data and training cost and throws away the instruction and preference tuning the instruct model already has."
    }],
    screens: [situation, fourReplies, spotIdea, threeStages, fillTemplate, library, noSystem, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: REPLIES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: STAGES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ['[data-i="open"]'], right: ORDER.map(k => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="temp"]'], right: ['[data-i="prompt"]', "#fix [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SITS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
