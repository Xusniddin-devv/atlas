/* Lesson: answer concept questions with a clear structure. Story: a first-round phone screen with an engineer who
   asks short questions, interrupts when an answer drifts, and follows up with "what if your users write in Korean?"
   Ideas: (1) a concept answer that lands is three parts in this order: the direct answer, one concrete example,
   the trade-off; (2) the follow-up is a scenario, and it is answered by saying what changes, not by repeating the
   definition. When not: system design, "tell me about a time", and questions you cannot answer.
   Data, all real (recordings in the main checkout, docs/ai-path/recordings/s7-concept-questions/):
   - <q>-strong, <q>-drift, <q>-belief for q in rag, finetune, lora, agent, temp: one small hosted model told to
     answer in three styles (three sentences / start with background / hold one stated misconception), request
     files written by docs/ai-path/runs/s7-concept-questions/make_requests.py;
   - followup-applied, followup-restate: the Korean follow-up after the recorded rag-strong reply (make_followup.py);
   - tokens-en, tokens-ko: the same support question in English and Korean, input token counts from usage.
   Lesson-local style: answer blocks and a role label (.lx-s7-concept-questions-*), see ensureStyle(). */
(() => {
  const ID = "s7-concept-questions";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const MODEL_NOTE = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14" };
  const CAPTION = `Recorded model output, ${MODEL_NOTE.recordedAt}`;

  /* ---------- Recorded answers (copied from the recordings; drift answers trimmed with … , nothing altered) ---------- */
  // strong: the three sentences of the recorded reply, in recorded order (split at sentence ends or line breaks)
  const Q = {
    rag: {
      q: "Why does a RAG system still make things up, even when it has the documents?",
      // rag-strong.json
      strong: [
        "RAG systems can still hallucinate due to issues with retrieval accuracy or the LLM's generation process.",
        "For instance, if a RAG system retrieving documents about a company's finances incorrectly pulls data from an unrelated product launch, it might fabricate financial details.",
        "The main trade-off is balancing comprehensive retrieval with the LLM's inherent tendency to generate plausible but not always factual text."
      ],
      // rag-drift.json (trimmed)
      drift: "My background in natural language processing, particularly with large language models, has exposed me to the nuances of retrieval-augmented generation (RAG) systems. While the core idea of grounding responses in retrieved documents is sound, the \"hallucination\" problem persists due to several factors. … Therefore, despite access to documents, RAG systems can still generate plausible-sounding but inaccurate statements.",
      // rag-belief.json
      belief: "If a RAG bot fabricates information, it's not the model creating something from nothing; the fault lies with the indexed documents. A Retrieval-Augmented Generation system is fundamentally limited to the text it retrieves. Therefore, any hallucinations or inaccuracies must stem directly from erroneous or misleading information present within the knowledge base itself.",
      show: ["strong", "belief", "drift"],
      shuffle: [1, 2, 0],
      fb: {
        belief: "Right, answer B is the one with the wrong idea. The model is not limited to the retrieved text. It still writes from what it learned in training, so it can fill a gap or blend in something no document says. Retrieval can also bring back the wrong chunk, or none, and the model answers anyway. Bad documents are one cause, not the only one. That is why guides on reducing made-up answers still tell you to let the model say “I don't know” and to make it quote its sources. Giving the model documents reduces made-up answers; it does not remove them.",
        strong: "Answer A is the one you just put in order: a direct answer, a concrete example, a limit. Nothing in it is wrong. Its last sentence is vague, but vague is not wrong.",
        drift: "Answer C has nothing badly wrong in it. Its problem is shape: the first sentence is about the speaker, and the answer arrives at the end. The interviewer would cut in long before that. Look for a sentence that states something false."
      }
    },
    finetune: {
      q: "When would you fine-tune a model instead of using prompting or RAG?",
      // finetune-strong.json
      strong: [
        "You fine-tune a model when you need to significantly alter its core behavior or train it on a highly specialized task.",
        "For example, fine-tuning is used to adapt large language models for specific coding languages or medical terminology.",
        "The main trade-off is the increased computational cost and data requirements compared to prompting or RAG."
      ],
      // finetune-drift.json (trimmed)
      drift: "I've previously worked with large language models and understand the different ways to adapt them for specific tasks. … If the goal is to imbue the model with new factual knowledge, a completely different reasoning style, or a very particular stylistic nuance that cannot be easily achieved through in-context learning or by retrieving external documents, then fine-tuning becomes the more appropriate approach, allowing us to retrain parts of the model on a curated dataset to achieve the desired behavior.",
      // finetune-belief.json (the ** marks are in the recording)
      belief: "I'd fine-tune when the underlying data distribution shifts significantly, like with frequently changing prices and stock levels. For dynamic information that needs constant updates, **fine-tuning the model weekly on the latest data is the most effective way to ensure accuracy and relevance.** Prompting or RAG might struggle to keep pace with such rapid changes.",
      show: ["drift", "strong", "belief"],
      shuffle: [2, 0, 1],
      fb: {
        belief: "Right, answer C. Prices and stock that change every week are facts, and facts that change belong in retrieval or in the prompt. A fine-tuned model only knows what was in its last training run, so it is out of date the day after, and retraining every week costs data work and compute each time. OpenAI's model-optimization guide lists other jobs for fine-tuning: a consistent output format, better instruction following, a smaller model that is good at one task, shorter prompts. For up-to-the-minute information it says to put it into the prompt.",
        strong: "Answer B is the one you ordered: when, an example, the cost. No false claim in it.",
        drift: "Answer A drifts (its first sentence is about the speaker), but it is not the one built on the error. Still, notice its last sentence: it says fine-tuning is for “new factual knowledge”. An interviewer would push on that. Another answer builds its whole case on the same mistake, with weekly prices."
      }
    },
    lora: {
      q: "What does LoRA change in the model?",
      // lora-strong.json (one sentence per line in the recording)
      strong: [
        "LoRA injects small, trainable low-rank matrices into specific layers of a pre-trained model.",
        "For instance, it can be used to efficiently adapt large language models like Llama 2 for specialized tasks such as summarization without retraining the entire model.",
        "The main trade-off is that LoRA may not achieve the same peak performance as full fine-tuning on highly complex or vastly different downstream tasks."
      ],
      // lora-drift.json (trimmed)
      drift: "LoRA, or Low-Rank Adaptation, emerged as a response to the immense computational cost of fine-tuning large language models. Historically, full fine-tuning involved updating all the parameters of a pre-trained model, which could be prohibitively expensive and time-consuming. LoRA takes a different approach by freezing the original pre-trained weights and injecting trainable low-rank decomposition matrices into specific layers, most commonly the attention layers. … Instead of updating millions or billions of weights, LoRA only updates these smaller adapter matrices, allowing for faster experimentation and deployment of specialized models without the need for massive hardware resources.",
      // lora-belief.json
      belief: "LoRA fundamentally changes how a model is fine-tuned. Instead of updating all the original weights, LoRA injects small, trainable matrices into specific layers. This approach works by effectively compressing the model's weights to lower precision, like 4-bit, so the model fits on a smaller GPU, making fine-tuning much more memory-efficient.",
      show: ["belief", "drift", "strong"],
      shuffle: [2, 1, 0],
      fb: {
        belief: "Right, answer A, and it is the hard one, because its first two sentences are true. LoRA keeps the original weights frozen and trains small extra matrices added to some layers. The third sentence mixes in a different idea: <b>quantization</b>, storing weights at lower precision to save memory. The two are often combined (QLoRA trains LoRA matrices on top of a 4-bit quantized model), but they are separate. LoRA saves memory because far fewer parameters are trained, not because the weights get smaller. A half-right answer is still the one an interviewer remembers as wrong.",
        strong: "Answer C is the one you ordered. Every sentence holds up: small trainable matrices, an example, and a real limit.",
        drift: "Answer B is correct, and it even says the original weights are frozen. Its problem is shape: it starts with history, so the direct answer comes in sentence three. Look for a sentence that is false."
      }
    },
    agent: {
      q: "How would you evaluate an agent?",
      // agent-strong.json
      strong: [
        "An agent is evaluated by measuring its performance on specific tasks against predefined metrics.",
        "For example, a customer service chatbot might be evaluated on its resolution rate and customer satisfaction scores.",
        "However, a major trade-off is that metrics may not capture nuanced aspects of agent behavior like empathy or ethical considerations."
      ],
      // agent-drift.json (trimmed)
      drift: "My background in machine learning and reinforcement learning has heavily influenced my approach to agent evaluation. I've worked with various frameworks like OpenAI Gym and Stable Baselines3, which provide standardized environments and metrics for tracking performance. … Ultimately, the most crucial aspect is whether the agent reliably achieves its intended objectives in a safe and efficient manner.",
      // agent-belief.json
      belief: "I believe the most effective way to evaluate an agent is through self-assessment. I'd present it with a few diverse examples and ask it to rate its final answer on a scale of 1 to 10. If the agent consistently scores above an 8 on average, I'd consider it ready for deployment. This approach fosters accountability and internal calibration.",
      show: ["strong", "drift", "belief"],
      shuffle: [1, 2, 0],
      fb: {
        belief: "Right, answer C. An agent scoring its own answers measures how confident it sounds, not whether it did the job, and a few examples cannot show how often it fails. A usable agent eval runs many tasks, several times each because outputs vary between runs, and grades what actually happened: code checks where possible, a separate model judge only after it is checked against human grading. Then you read the transcripts to see whether the grades measure what matters.",
        strong: "Answer A is the one you ordered. It is thin (a stronger answer would add many test tasks and repeated runs), but nothing in it is false.",
        drift: "Answer B drifts to reinforcement-learning frameworks for game-style agents, which is not what a team building LLM agents is asking about. Off target and slow, but not false. Look for the answer that states a method that cannot work."
      }
    },
    temp: {
      q: "What does temperature do?",
      // temp-strong.json (one sentence per line in the recording)
      strong: [
        "Temperature controls the randomness of the output generated by a language model.",
        "For instance, setting a higher temperature for a creative writing task can result in more imaginative and varied story options.",
        "However, too high a temperature can lead to nonsensical or irrelevant text."
      ],
      // temp-drift.json (trimmed)
      drift: "The concept of temperature, originating from thermodynamics and statistical mechanics to quantify the average kinetic energy of particles in a system, has found a fascinating application in the field of AI, particularly in large language models. In this context, temperature acts as a hyperparameter that controls the randomness of the output generated by a model during text generation. … Therefore, in AI, temperature is a crucial knob for tuning the balance between coherence and creativity in generated content.",
      // temp-belief.json
      belief: "Temperature is a crucial hyperparameter in language models that controls the randomness of the output. A higher temperature, say above 0.7, injects more randomness, forcing the model to explore a wider range of possibilities and potentially draw upon more of its learned knowledge. I believe this leads to more creative and nuanced responses, ultimately enhancing accuracy by encouraging deeper thought.",
      show: ["drift", "belief", "strong"],
      shuffle: [2, 0, 1],
      fb: {
        belief: "Right, answer B. It starts well and then goes wrong: temperature changes how the next token is picked, not how much the model knows or how hard it thinks. Lower values make responses more predictable; higher values give less likely tokens more of a chance, so responses vary more. More variety is not more accuracy. For a factual answer, a higher temperature only adds more ways to go wrong.",
        strong: "Answer C is the one you ordered: what it controls, an example, the limit. Short and true.",
        drift: "Answer A opens with thermodynamics, and the interviewer would cut in. What it says about language models is fine, though. Look for a sentence that claims something false."
      }
    }
  };
  const ORDER = ["rag", "finetune", "lora", "agent", "temp"];
  const LETTER = ["A", "B", "C"];
  const ROLE = ["the direct answer", "a concrete example", "the trade-off"];

  // followup-applied.json and followup-restate.json (one small hosted model, after the recorded rag-strong reply)
  const FOLLOW_Q = "What if your users write in Korean?";
  const FOLLOW = {
    applied: "The system would need to incorporate Korean language processing capabilities, likely through a Korean-specific embedding model and potentially a Korean-language LLM.\nI would first test retrieval performance with Korean queries against Korean documents to ensure accurate context is found.\nThis would increase costs due to the need for specialized models and potentially more complex data handling pipelines.",
    restate: "Even with Korean input, RAG systems can still generate fabricated information. The core problem remains the same: if the retrieval step brings back irrelevant or inaccurate documents, or if the large language model itself doesn't perfectly synthesize the retrieved information, it can still invent answers. The language doesn't fundamentally change the underlying technical challenges of RAG."
  };
  // tokens-en.request.json / tokens-ko.request.json (user message), usage.prompt_tokens from tokens-en.json / tokens-ko.json
  const TOK = {
    en: { text: "Our support bot uses RAG over the company's help-center articles. Users say it sometimes gives answers that are not in any article. Why does that happen, and what would you check first?", prompt: 42 },
    ko: { text: "저희 고객지원 챗봇은 회사 도움말 문서를 대상으로 RAG를 사용합니다. 사용자들은 챗봇이 가끔 어떤 문서에도 없는 답을 한다고 말합니다. 왜 그런 일이 생기고, 무엇부터 확인하시겠습니까?", prompt: 53 }
  };

  /* ---------- Derived ---------- */
  const chars = s => Array.from(s).length;
  const words = s => s.split(/\s+/).filter(Boolean).length;
  const TOK_MORE = TOK.ko.prompt - TOK.en.prompt;
  const TOK_PCT = Math.round((TOK.ko.prompt / TOK.en.prompt - 1) * 100);
  const TOK_RIGHT = TOK.ko.prompt > TOK.en.prompt * 1.1 ? 1 : TOK.en.prompt > TOK.ko.prompt * 1.1 ? 0 : 2; // 0 en, 1 ko, 2 same

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-ans { margin: 12px 0 0; padding: 10px 0 10px 12px; border-left: 3px solid var(--line); }
      .lx-${ID}-ans.lx-${ID}-cut { border-left-color: var(--ink); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 0 0 4px; }
      .lx-${ID}-txt { font-size: 16px; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
      .lx-${ID}-q { margin: 14px 0 0; font-size: 17px; line-height: 1.5; font-weight: 600; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-built { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-built li { display: grid; grid-template-columns: 9.5em 1fr; gap: 4px 12px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-role { font: 600 13px/1.6 var(--mono); color: var(--muted); }
      .lx-${ID}-opt { text-align: left; font-size: 15px; line-height: 1.45; }
      @media (max-width: 520px) { .lx-${ID}-built li { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  const block = (kit, who, text, cut) => `<div class="lx-${ID}-ans${cut ? ` lx-${ID}-cut` : ""}"><p class="lx-${ID}-who">${kit.esc(who)}</p><div class="lx-${ID}-txt">${kit.esc(text)}</div></div>`;
  const interviewer = (kit, text) => block(kit, "interviewer", text);
  const cap = () => `<p class="lx-${ID}-cap">${CAPTION}</p>`;
  const built = (kit, sents, n) => n ? `<ul class="lx-${ID}-built">${sents.slice(0, n).map((s, i) => `<li><span class="lx-${ID}-role">${i + 1}. ${ROLE[i]}</span><span>${kit.esc(s)}</span></li>`).join("")}</ul>` : "";
  const optTxt = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  const ORDER_FB = [
    ["", "That is the example. Said first, it makes the listener guess what it is an example of. Start with the sentence that answers the question.", "That is the trade-off. Opening with a limit sounds like a dodge before you have said what the thing is. Start with the sentence that answers the question."],
    ["", "", "That is the trade-off. Before any concrete case, a limit has nothing to attach to. Give the example next, then the limit."]
  ];

  /* The order task: tap the three sentences of the recorded strong answer in speaking order. */
  function orderPart(kit, key, st) {
    const c = Q[key];
    const left = c.shuffle.filter(r => !st.placed.includes(r));
    const next = st.placed.length;
    const opts = left.map(r => optTxt(kit, c.strong[r]));
    return `${built(kit, c.strong, next)}
      <p class="task">${next === 0 ? "Which sentence do you say first?" : "Which sentence comes next?"}</p>
      <div class="lpanel">${kit.options(opts, { picked: st.wrong == null ? null : left.indexOf(st.wrong), correct: left.indexOf(next) })}
      ${st.wrong != null ? kit.feedback(ORDER_FB[next][st.wrong], false) : ""}</div>`;
  }
  function bindOrder(el, key, st, onDone, paint) {
    const c = Q[key];
    el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
      const left = c.shuffle.filter(r => !st.placed.includes(r));
      const r = left[+b.dataset.i];
      if (r !== st.placed.length) { st.wrong = r; paint(); return; }
      st.wrong = null; st.placed.push(r);
      if (st.placed.length === 2) { st.placed.push(2); onDone(); }
      paint();
    });
  }
  const answersHtml = (kit, key) => Q[key].show.map((id, i) => block(kit, `answer ${LETTER[i]}`, id === "strong" ? Q[key].strong.join(" ") : Q[key][id])).join("") + cap();
  function spotPart(kit, key, picked) {
    const c = Q[key];
    const right = c.show.indexOf("belief");
    return `<p class="task">Which answer contains a wrong idea?</p>
      <div class="lpanel">${kit.options(LETTER.map(l => `Answer ${l}`), { picked, correct: right })}
      ${picked == null ? "" : kit.feedback(c.fb[c.show[picked]], picked === right)}</div>`;
  }
  const SETUP = "All three answers come from the same small hosted model, each told to answer in a different style: in three sentences, starting with background, or arguing from one wrong belief it was given.";

  /* 1. The situation, and the first question: order the parts. */
  function firstQuestion({ el, done, kit }) {
    ensureStyle();
    const st = { placed: [], wrong: null };
    const paint = () => {
      const fin = st.placed.length === 3;
      el.innerHTML = `<h1>The phone screen</h1>
        <p class="lead">You applied for one of the posts from the last lesson. The first round is a phone screen: a thirty-minute call with one of the team's engineers. She asks short concept questions, cuts in when an answer wanders, then changes the question a little to see if you really understand. This lesson gives you a shape for those answers. Her first question:</p>
        ${interviewer(kit, Q.rag.q)}
        <p class="lead">Below are the three sentences of one recorded answer, scrambled. A small hosted model was told to answer in exactly three sentences, in a fixed order. Put them back in the order you would say them.</p>
        ${fin ? `${built(kit, Q.rag.strong, 3)}${cap()}${kit.feedback(`That is the recorded order, the one the model was told to use. It answers in the first sentence, makes it concrete in the second, and names where it breaks in the third. In about ${words(Q.rag.strong.join(" "))} words, the interviewer has heard that you know it, seen a case, and heard a limit she can ask about next.`, true)}` : orderPart(kit, "rag", st)}`;
      if (!fin) bindOrder(el, "rag", st, done, paint);
    };
    paint();
  }

  /* 2. Same question: three recorded answers, spot the wrong idea. */
  function firstSpot({ el, done, kit }) {
    ensureStyle();
    let picked = null;
    const paint = () => {
      el.innerHTML = `<h1>Three answers, one wrong idea</h1>
        <p class="lead">${SETUP} The one you just ordered is among them.</p>
        ${interviewer(kit, Q.rag.q)}
        ${answersHtml(kit, "rag")}
        ${spotPart(kit, "rag", picked)}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { picked = +b.dataset.i; paint(); if (picked === Q.rag.show.indexOf("belief")) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: why she cut in on one correct answer and not the other. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const first = Q.rag.drift.split(". ")[0] + ".";
    const opts = [
      "It was too technical for a phone screen",
      "After its first sentence she still did not know whether you know the answer",
      "It did not name any real tools",
      "Its facts were wrong"
    ];
    const RIGHT = 1;
    const fb = [
      "Its first sentence has no technical content at all; it is about the speaker. Being technical is what she wants. The problem is that the answer has not started.",
      `Right. In a short phone screen she checks each sentence for one thing: does this person know it? Answer A told her in sentence one, then proved it with a case, then showed judgement with a limit. That shape is <b>direct answer, concrete example, trade-off</b>. Each part answers a different doubt: do you know it, have you seen it work, do you know where it breaks. The trade-off also hands her the next question, so that question is likely one you prepared for. Then stop talking.`,
      "Its full recording does name two vector databases further on (cut from the version on the previous screen). Tool names do not help while the listener is still waiting for the answer.",
      "Most of what it says later is reasonable. It was cut off for its shape, not its facts: nothing in the first sentence answers the question."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did she cut in?</h1>
        <p class="lead">Suppose you had given answer C instead. She stops you after the first sentence:</p>
        ${block(kit, "answer C, first sentence", first, true)}${cap()}
        ${interviewer(kit, "Sorry, can I stop you there? What is the short version?")}
        <p class="lead">When you give answer A, the one you ordered, she lets you finish.</p>
        <p class="task">What made her cut in?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}${ans == null ? "" : kit.feedback(fb[ans], ans === RIGHT)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4-7. The next four questions: order the strong answer, then spot the wrong idea. */
  const TITLES = { finetune: "When to fine-tune", lora: "What LoRA changes", agent: "How to evaluate an agent", temp: "What temperature does" };
  function questionScreen(key, n) {
    return function ({ el, done, kit }) {
      ensureStyle();
      const st = { placed: [], wrong: null };
      let picked = null;
      const right = Q[key].show.indexOf("belief");
      const paint = () => {
        const ordered = st.placed.length === 3;
        el.innerHTML = `<h1>Question ${n}: ${TITLES[key]}</h1>
          ${interviewer(kit, Q[key].q)}
          ${ordered ? `<p class="lead">You built it. Now the three recorded answers in full. ${SETUP}</p>${answersHtml(kit, key)}${spotPart(kit, key, picked)}`
            : `<p class="lead">First, the three sentences of one recorded answer, scrambled. Put them in speaking order.</p>${orderPart(kit, key, st)}`}`;
        if (!ordered) bindOrder(el, key, st, () => {}, paint);
        else el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { picked = +b.dataset.i; paint(); if (picked === right) done(); });
      };
      paint();
    };
  }

  /* 8. The scenario follow-up, then a prediction about Korean tokens. */
  function followUp({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const RIGHT = 0;
    const fb = [
      `Right. She changed one thing, the language, and asked what follows from it. Answer A says what changes (the embedding model, maybe the generating model), what to check first (retrieval with Korean questions against Korean documents) and the cost. It is the same three parts, aimed at the new situation. The first check is the one to lead with: if the embedding model handles Korean poorly, retrieval fails before the model writes a word.`,
      `Answer B is true at the level of the definition, and that is its problem: she already heard the definition. She wants to know what you would do differently, and “the language doesn't fundamentally change” closes the topic instead of answering it.`
    ];
    const topts = ["The English one", "The Korean one", "About the same"];
    const tfb = i => i === TOK_RIGHT
      ? `Right. As the API counted the whole request: English ${TOK.en.prompt} tokens for ${chars(TOK.en.text)} characters, Korean ${TOK.ko.prompt} tokens for ${chars(TOK.ko.text)} characters. The Korean question took ${TOK_MORE} more tokens (${TOK_PCT}% more) while being much shorter in characters. Tokens are what you pay for and what fills the context, so there is a cost answer A did not name: the same traffic in Korean can cost more per question. One question on one model is not a benchmark: before you promise numbers, measure your own Korean traffic.`
      : i === 0
        ? `The English text has more characters (${chars(TOK.en.text)} against ${chars(TOK.ko.text)}), but a token is not a character. Look at what the model counted.`
        : `Close counts would be a reasonable guess, but they were not close in this run. Tokens depend on how the model's tokenizer splits each language.`;
    const paint = () => {
      el.innerHTML = `<h1>“What if your users write in Korean?”</h1>
        <p class="lead">After your RAG answer she asks a follow-up. The same model was asked it twice, each time after the three-sentence answer you ordered on screen 1. Once it was told to answer for the new situation, once to repeat its earlier explanation.</p>
        ${interviewer(kit, FOLLOW_Q)}
        ${block(kit, "answer A", FOLLOW.applied)}${block(kit, "answer B", FOLLOW.restate)}${cap()}
        ${phase === 0 ? `<p class="task">Which answer handles the follow-up?</p>
          <div class="lpanel">${kit.options(["Answer A", "Answer B"], { picked: ans, correct: RIGHT })}${ans == null ? "" : kit.feedback(fb[ans], ans === RIGHT)}</div>`
        : `${kit.feedback(fb[0], true)}
          <p class="lead">Now look at cost. The same support question was sent to the same model, once in English and once in Korean:</p>
          ${block(kit, "English", TOK.en.text)}${block(kit, "Korean", TOK.ko.text)}
          <p class="task">For which request did the model count more input tokens?</p>
          <div class="lpanel">${kit.options(topts, { picked: ans, correct: TOK_RIGHT })}${ans == null ? "" : kit.feedback(tfb(ans), ans === TOK_RIGHT)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (phase === 0 && ans === RIGHT) { phase = 1; ans = null; paint(); return; }
        paint();
        if (phase === 1 && ans === TOK_RIGHT) done();
      });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The first sentence of each answer",
      "The scenario follow-up",
      "The trade-off sentence",
      "Nothing: she cannot tell"
    ];
    const RIGHT = 1;
    const fb = [
      "The first sentence is safe to memorize: you can say it the same way every time she asks it. A recited answer breaks somewhere else.",
      "Right. A recited answer has nothing to say about a case it was not written for, which is exactly what answer B in the Korean follow-up did. Prepare the parts, not the wording: the idea, one example you really understand, and the limit. Then the follow-up is a matter of asking what changes.",
      "A memorized trade-off still works when she asks the same question. It breaks when she changes the situation.",
      "She can tell the moment she changes the question. That is why interviewers ask follow-ups."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When the three-part answer fits</h1>
        <p class="lead"><b>For:</b> short concept questions: “why does…”, “when would you…”, “what does… change”. <b>Why it works:</b> the first sentence shows you know it, the example shows you have seen it work, the trade-off shows judgement and invites the next question. <b>Not for:</b> system design (ask about users, data and scale first), “tell me about a time…” (tell a real story from your work), or a question you cannot answer (say what you know and how you would find out; never build a confident wrong answer like the ones you spotted). <b>Costs:</b> a real example per topic, prepared beforehand; three sentences leave detail out, so expect a follow-up.</p>
        <p class="task">You memorize the five recorded three-part answers word for word. Where does that fail first?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}${ans == null ? "" : kit.feedback(fb[ans], ans === RIGHT)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["“When would you pick a small model over a large one for one step of your pipeline?”", true,
      "Yes. A short concept question: answer it (when the step is narrow and must be fast and cheap), give a case (sorting incoming messages into five types), name the trade-off (it fails more on unusual inputs, so test it on them).",
      "It is a short concept question with a clear answer, a case and a trade-off. A direct answer, an example such as sorting messages into types, and the limit fit it exactly."],
    ["“Tell me about a time a model you shipped behaved badly.”", false,
      "No. She asked for your story, not a definition. Opening with a direct answer about “models behaving badly” in general wastes the first sentence. Tell what happened, what you did, and what changed afterwards.",
      "This is a question about your own past work. A definition and a generic example dodge it; she wants one real event, your part in it, and the result."],
    ["“Design a document assistant for a law firm. You have forty-five minutes.”", false,
      "No. Three sentences would pick an answer before you know the problem. Start by asking: who uses it, what documents, how private, how fast, how correct it must be. The design follows from those answers.",
      "A design question has no single right answer to say first. The answer depends on requirements you do not have yet, so the first move is asking for them, not stating a definition."],
    ["“Why does a longer prompt make each call slower and more expensive?”", true,
      "Yes. Direct answer (the model reads every input token on every call, and input tokens are billed), an example (a long system prompt resent on each turn of a chat), the trade-off (shorter prompts can drop instructions the model needed).",
      "It is a why-question about one concept, so the three parts fit: the direct reason, one concrete case, and the trade-off of cutting the prompt down."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Three-part answer or not?</h1>
        <p class="lead">Four questions from other interviews.</p>
        <p class="task">Would you answer each with direct answer, example, trade-off? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can answer in three parts</h1>
      <p class="lead">You put ${ORDER.length} recorded answers in speaking order, found the wrong idea in each set of three, and answered the Korean follow-up by saying what changes, then compared real token counts in two languages.</p>
      <p class="lead">Before a real screen, write down one example you truly understand for each topic you listed in your gap list. The example is the part you cannot make up on the call.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The next round stops asking what things are and hands you a broken system; you will name the cause in one sentence, the same way you named the direct answer here.</p>` : ""}`;
    done();
  }

  const qScreens = ORDER.slice(1).map((k, i) => questionScreen(k, i + 2));
  const qWalk = { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] };

  LessonKit.define(ID, {
    title: "Answer concept questions with a clear structure",
    checked: "2026-11-14",
    sources: [
      "https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations",
      "https://developers.openai.com/api/docs/guides/model-optimization",
      "https://arxiv.org/abs/2106.09685",
      "https://huggingface.co/docs/peft/main/en/developer_guides/lora",
      "https://arxiv.org/abs/2305.14314",
      "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents",
      "https://openrouter.ai/docs/api/reference/parameters"
    ],
    interview: [
      {
        q: "In a phone screen you are asked when you would fine-tune instead of using RAG, and you have about thirty seconds. What do you say?",
        good: [
          "Answer first: fine-tune to change behaviour (format, style, a narrow task), use RAG for facts the model must look up",
          "Give one concrete case, such as making a small model reliably output one JSON format",
          "Name the trade-off: training data, compute and retraining when needs change",
          "Say what not to do: do not fine-tune to keep up with facts that change, like weekly prices"
        ],
        weak: "Start with the history of transfer learning and list tools, reaching the answer at the end; or say fine-tuning is how you teach the model new facts."
      },
      {
        q: "You have just explained why RAG still makes things up. The interviewer asks: “What if your users write in Korean?” How do you answer?",
        good: [
          "Say what changes: the embedding model must handle Korean queries and documents, and maybe the generating model",
          "Say what you would check first: retrieval quality on Korean questions against Korean documents",
          "Build a test set of real Korean questions instead of translating the English one",
          "Name the cost: Korean text can take more tokens for the same question, so measure cost and context use on real traffic"
        ],
        weak: "Repeat the general RAG explanation and say the language changes nothing. It answers a question she did not ask."
      }
    ],
    screens: [firstQuestion, firstSpot, spotIdea, ...qScreens, followUp, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      ...qScreens.map(() => qWalk),
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
