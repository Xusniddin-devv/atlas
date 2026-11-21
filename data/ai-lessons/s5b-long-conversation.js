/* Lesson: long conversations, sliding windows and running summaries. Story: a German tutor bot forgets Mia's
   B1 exam halfway through a long evening session, because it sends the model only the last 16 turns.
   Ideas: (1) a sliding window keeps the cost of each call flat but silently drops the start of a long chat;
   a running summary ("notes") of the turns that leave the window carries the facts forward; (2) the notes are
   a lossy copy made by a model call: check which facts survive, and pass the old notes into every update.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5b-long-conversation/: chat-02 … chat-60 (the tutor's
     replies; the bot sent its system prompt + the last 16 turns), fold-24 … fold-56 (the running notes),
     bug-fold-32 … bug-fold-56 (the same folds with the old notes left out), full-58, memory-58, bug-58 (the
     answer at turn 58 with three different contexts). Made by docs/ai-path/runs/s5b-long-conversation/session.py,
     whose STUDENT list holds Mia's lines (written for the lesson; the tutor's replies are recorded).
   - docs/ai-path/runs/s5b-long-conversation/memory_replay.py + .out.txt: build_context (the code screen) and its
     buggy twin traced over turns 1..57; each summarise() request was checked against the recorded one, and each
     returned context is identical to the messages recorded in memory-58 / bug-58. frames.py picks the frames shown.
   Lesson-local style: transcript rows, clickable code lines and recorded-output blocks (.lx-s5b-long-conversation-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s5b-long-conversation";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const words = s => s.trim().split(/\s+/).length;

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s5b-long-conversation/session.py
  const KEEP = 16, BATCH = 8;
  const SYSTEM = "You are a German tutor bot. You chat with one adult learner in the evening. Reply in at most 3 short sentences. Correct mistakes briefly.";
  const REC = { src: "s5b-long-conversation/*", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13" };
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;
  // CHAT[i] = [Mia's line (turn 2i+1), the tutor's recorded reply (turn 2i+2), prompt_tokens of that reply's call]
  // from chat-02 … chat-60 (text not altered). FOLDS and ANSWERS from fold-*, bug-fold-*, full-58, memory-58, bug-58.
  const CHAT = [["Hi! I have my B1 German exam on 6 December. My weak part is writing: an informal email to a friend, about 80 words, covering three given points.", "Hallo! Das ist ja bald! Keine Sorge, wir üben das zusammen. Was sind die drei Punkte für die E-Mail?", 70], ["My big problem: I always put the verb in the wrong place after 'weil'. Like 'weil ich habe keine Zeit'.", "Das ist ein häufiger Fehler! Nach \"weil\" kommt das Verb immer ganz ans Ende des Satzes. Also: \"weil ich keine Zeit habe\".", 125], ["Ich lerne Deutsch, weil ich will in Berlin arbeiten. Is that right?", "Fast richtig! Denk dran, das Verb muss nach \"weil\" ans Ende. Es sollte heißen: \"Ich lerne Deutsch, weil ich in Berlin arbeiten will.\"", 174], ["Ok: weil ich in Berlin arbeiten will. Got it.", "Sehr gut! Das hast du jetzt verstanden. Lass uns weitermachen. Was ist der nächste Punkt für deine E-Mail?", 222], ["Sorry if I'm slow tonight, I'm really tired after work.", "Kein Problem, das ist ganz normal. Wir nehmen uns die Zeit, die du brauchst. Lass uns einfach mit dem nächsten Punkt weitermachen, wenn du bereit bist.", 267], ["Can you give me two more sentences with weil to fix?", "Klar, hier sind zwei Sätze zum Korrigieren:\n\n1.  Ich gehe ins Kino, weil der Film ist sehr interessant.\n2.  Sie ist glücklich, weil sie hat die Prüfung bestanden.", 317], ["Ich bleibe zu Hause, weil ich bin müde. And: Er lernt, weil er hat einen Test.", "Sehr gut! Die Sätze sind jetzt richtig: \"Ich bleibe zu Hause, weil ich müde bin.\" und \"Er lernt, weil er einen Test hat.\"", 389], ["By the way, I work in a bike shop in Utrecht, so lots of my German is about bikes, haha.", "Das ist ja interessant! Dann können wir ja auch gleich Vokabeln rund ums Fahrrad üben. Das ist bestimmt nützlich für dich.", 450], ["Can we do some travel vocabulary? I'm going to Vienna in spring.", "Sehr gerne! Wien ist eine wunderschöne Stadt. Was möchtest du über Reisen nach Wien wissen?", 458], ["der Bahnhof, die Fahrkarte, das Gleis... what is 'delay'?", "'Delay' ist \"die Verspätung\". Zum Beispiel: \"Die Verspätung beträgt 10 Minuten.\"", 442], ["Please always explain my mistakes in English, not German. It's easier for me at night.", "Okay, I understand. I will explain your mistakes in English from now on.", 441], ["Wie sagt man 'I missed my train'?", "You would say: \"Ich habe meinen Zug verpasst.\"", 420], ["Haha my cat just walked across the keyboard. Ignore that.", "No problem, that happens! Your cat seems to be interested in German too.", 401], ["Let's do dative prepositions. mit, nach, bei, seit, von, zu, aus?", "Genau, das sind die wichtigsten Dativ-Präpositionen. Gut gemacht!", 392], ["Ich fahre mit der Zug zur Arbeit.", "You wrote: \"Ich fahre mit der Zug zur Arbeit.\"\n\nThe correct sentence is: \"Ich fahre mit **dem** Zug zur Arbeit.\"\n\n\"Mit\" is a dative preposition, so it requires the dative case for the noun that follows it. \"Zug\" is masculine, and the dative masculine article is \"dem\".", 349], ["Mit dem Zug. Because Zug is masculine, right?", "Ja, genau! \"Zug\" ist maskulin und braucht deshalb \"dem\" nach \"mit\".", 372], ["Give me a quick quiz on dative, 3 questions.", "Okay, here are three questions for you:\n\n1.  Ich gehe _____ Supermarkt. (in)\n2.  Sie spricht _____ ihrem Freund. (mit)\n3.  Das Geschenk ist _____ mir. (von)", 359], ["1. bei meiner Mutter 2. seit einem Jahr 3. aus dem Haus", "You answered the questions, but not the ones I asked. Please answer the questions I gave you.", 387], ["Nice. I'll make some tea, one minute.", "Okay, take your time! I'll be here.", 373], ["Back. Can we talk about separable verbs now?", "Ja, gerne! Trennbare Verben sind ein wichtiges Thema. Was möchtest du darüber wissen?", 370], ["Ich rufe meine Freundin an. Ich stehe um 7 Uhr auf. Correct?", "Ja, das ist richtig! Du hast die trennbaren Verben gut verwendet.", 388], ["What about in the past? Ich habe ... angerufen?", "Genau! Bei trennbaren Verben im Perfekt kommt die Vorsilbe ans Ende des Satzes. Zum Beispiel: \"Ich habe meine Freundin angerufen.\"", 378], ["Ich bin um 7 Uhr aufgestanden. Ich habe eingekauft.", "Sehr gut! Das hast du richtig gemacht.", 402], ["Can you teach me 5 words for food at a restaurant?", "Klar! Hier sind fünf Wörter für Essen im Restaurant:\n\n1.  **Die Suppe** (soup)\n2.  **Der Salat** (salad)\n3.  **Das Hauptgericht** (main course)\n4.  **Der Nachtisch** (dessert)\n5.  **Das Getränk** (drink)", 342], ["Ich möchte die Rechnung, bitte. Is that polite?", "Ja, das ist höflich. Du kannst auch sagen: \"Ich hätte gern die Rechnung, bitte.\"", 393], ["How do I say 'Could I have the menu'?", "Du kannst sagen: \"Könnte ich bitte die Speisekarte haben?\" Oder einfacher: \"Die Speisekarte, bitte.\"", 361], ["What's the difference between 'kennen' and 'wissen'?", "\"Kennen\" benutzt man für Personen, Orte oder Dinge, die man kennt. \"Wissen\" benutzt man für Fakten oder Informationen. Zum Beispiel: \"Ich kenne Berlin.\" und \"Ich weiß, dass Berlin die Hauptstadt ist.\"", 371], ["Ich weiß den Mann. — wrong, right? Ich kenne den Mann.", "Genau! \"Ich kenne den Mann\" ist richtig. \"Ich weiß den Mann\" ist falsch.", 414], ["Last thing for tonight: give me one practice task exactly like the writing part of my exam, using the grammar I keep getting wrong.", "Okay, hier ist eine Aufgabe für dich:\n\nSchreibe einen kurzen Text (ca. 30 Wörter) über deinen letzten Urlaub. Benutze dabei mindestens zwei trennbare Verben im Perfekt.", 421], ["Danke! Gute Nacht.", "Gern geschehen! Schlaf gut und bis bald.", 441]];
  const FOLDS = {"fold-24": {"text": "**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal email writing (approx. 80 words, 3 points).\n**Recurring Mistake:** Verb placement after \"weil\" (should be at the end of the clause).\n**Exam Details:** Informal email, 80 words, 3 points.\n**Session Focus:** Practicing email writing, specifically correcting \"weil\" clause verb placement.", "in": 312, "out": 91, "finish": "stop", "maxTokens": 160}, "fold-32": {"text": "**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal email writing (approx. 80 words, 3 points).\n**Recurring Mistake:** Verb placement after \"weil\" (should be at the end of the clause).\n**Exam Details:** Informal email, 80 words, 3 points.\n**Session Focus:** Practicing email writing, specifically correcting \"weil\" clause verb placement.\n**Learner Context:** Works in a bike shop, useful vocabulary might relate to bikes.", "in": 409, "out": 110, "finish": "stop", "maxTokens": 160}, "fold-40": {"text": "**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal email writing (approx. 80 words, 3 points).\n**Recurring Mistake:** Verb placement after \"weil\" (should be at the end of the clause).\n**Exam Details:** Informal email, 80 words, 3 points.\n**Session Focus:** Practicing email writing, correcting \"weil\" clause verb placement.\n**Learner Context:** Works in a bike shop.\n**Preferences:** Explanations in English.\n**New Topic:** Travel vocabulary (Vienna).", "in": 343, "out": 122, "finish": "stop", "maxTokens": 160}, "fold-48": {"text": "**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal email writing (approx. 80 words, 3 points).\n**Recurring Mistake:** Verb placement after \"weil\" (should be at the end of the clause). Also, dative case with prepositions.\n**Exam Details:** Informal email, 80 words, 3 points.\n**Session Focus:** Practicing email writing, correcting \"weil\" clause verb placement, and dative prepositions.\n**Learner Context:** Works in a bike shop.\n**Preferences:** Explanations in English.\n**New Topic:** Travel vocabulary (Vienna). Dative prepositions (mit, nach, bei, seit, von, zu, aus).", "in": 398, "out": 156, "finish": "stop", "maxTokens": 160}, "fold-56": {"text": "**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal email writing (approx. 80 words, 3 points).\n**Recurring Mistake:** Verb placement after \"weil\" (should be at the end of the clause). Dative case with prepositions.\n**Exam Details:** Informal email, 80 words, 3 points.\n**Session Focus:** Practicing email writing, correcting \"weil\" clause verb placement, dative prepositions, and separable verbs.\n**Learner Context:** Works in a bike shop.\n**Preferences:** Explanations in English.\n**New Topic:** Separable verbs. Dative prepositions (mit, nach, bei, seit, von, zu, aus) need more practice.", "in": 409, "out": 160, "finish": "length", "maxTokens": 160}, "bug-fold-32": {"text": "The learner is tired but wants to practice \"weil\" sentences. They previously made mistakes with verb placement in subordinate clauses. The learner works in a bike shop, so bike-related vocabulary could be useful.", "in": 322, "out": 41, "finish": "stop", "maxTokens": 160}, "bug-fold-40": {"text": "**Learner Goal:** Travel vocabulary for a trip to Vienna.\n**Exam Details:** None.\n**Recurring Mistakes:** None yet.\n**Preferences:** Explanations of mistakes in English.\n**Notes:** Learner asked for travel vocabulary, specifically for Vienna. Knows \"Bahnhof\", \"Fahrkarte\", \"Gleis\". Learned \"Verspätung\" (delay). Learned \"verpassen\" (to miss).", "in": 237, "out": 90, "finish": "stop", "maxTokens": 160}, "bug-fold-48": {"text": "Learner wants to practice dative prepositions. Recurring mistake: incorrect article declension (e.g., \"der Zug\" instead of \"dem Zug\"). Learner understands the concept of masculine nouns requiring \"dem\" after \"mit\".", "in": 280, "out": 48, "finish": "stop", "maxTokens": 160}, "bug-fold-56": {"text": "**Learner Goal:** Practice dative case and learn about separable verbs.\n**Recurring Mistakes:** Student initially answered practice questions incorrectly, possibly misunderstanding the task.\n**Topic:** Dative case quiz, separable verbs.", "in": 257, "out": 46, "finish": "stop", "maxTokens": 160}};
  const ANSWERS = {"full-58": {"text": "Okay, hier ist eine Aufgabe für dich:\n\nSchreibe eine E-Mail an deinen Freund Paul. Du warst letztes Wochenende nicht da, weil du krank warst. Schreibe ihm, dass du jetzt wieder gesund bist und frag ihn, was er gemacht hat. (ca. 80 Wörter)", "in": 1387, "out": 64}, "memory-58": {"text": "Okay, hier ist deine Aufgabe:\n\nSchreibe eine kurze E-Mail (ca. 80 Wörter) an deinen Freund Max. Du hast ihm letzte Woche ein Fahrrad repariert. Schreibe ihm, dass du das Fahrrad fertig hast, weil du am Wochenende viel Zeit hattest. Frage ihn, wann er das Fahrrad abholen kann.", "in": 608, "out": 73}, "bug-58": {"text": "Okay, hier ist deine Aufgabe:\n\nSchreibe einen kurzen Text (ca. 30 Wörter) über deinen letzten Einkauf. Benutze mindestens ein trennbares Verb und den Dativ.", "in": 493, "out": 41}};

  // The facts a reader can find in turns 1..40 (paraphrased from Mia's lines in session.py STUDENT).
  const FACTS = [
    { k: "A", turn: 1, text: "Exam: B1 German on 6 December. The writing part is an informal email to a friend, about 80 words, covering three given points.", need: true },
    { k: "B", turn: 3, text: "She puts the verb in the wrong place after “weil”.", need: true },
    { k: "C", turn: 9, text: "She is tired after work tonight." },
    { k: "D", turn: 15, text: "She works in a bike shop in Utrecht." },
    { k: "E", turn: 17, text: "She is going to Vienna in spring." },
    { k: "F", turn: 21, text: "She wants her mistakes explained in English." },
    { k: "G", turn: 25, text: "Her cat walked across the keyboard." },
    { k: "H", turn: 27, text: "Tonight she practised dative prepositions (mit dem Zug)." },
    { k: "I", turn: 37, text: "She made a cup of tea." }
  ];
  const MAX_FACTS = 4;

  // The listing is build_context from memory_replay.py, line for line (line 0 = def). The buggy twin differs on line 5.
  const CODE = [
    "def build_context(turns, keep, batch):",
    "    summary, recent = \"\", []",
    "    for turn in turns:",
    "        recent.append(turn)",
    "        if len(recent) == keep + batch:",
    "            summary = summarise(recent[:batch], summary)",
    "            recent = recent[batch:]",
    "    system = SYSTEM + \"\\nEarlier in this session: \" + summary",
    "    return [{\"role\": \"system\", \"content\": system}] + recent"
  ];
  const BUGGY = CODE.map((l, i) => i === 0 ? l.replace("build_context", "build_context_buggy") : i === 5 ? "            summary = summarise(recent[:batch])" : l);
  // frames.out.txt: [line about to run, turn, len(recent), first turn in recent, last turn in recent, summary head, event]
  const FRAMES = [[1,null,null,null,null,null,"l"],[3,1,0,null,null,"","l"],[4,1,1,1,1,"","l"],[2,1,1,1,1,"","l"],[3,24,23,1,23,"","l"],[4,24,24,1,24,"","l"],[5,24,24,1,24,"","l"],[6,24,24,1,24,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[2,24,16,9,24,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[3,32,23,9,31,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[4,32,24,9,32,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[5,32,24,9,32,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[6,32,24,9,32,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[2,32,16,17,32,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[3,57,16,41,56,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[4,57,17,41,57,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[2,57,17,41,57,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[7,57,17,41,57,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[8,57,17,41,57,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","l"],[8,57,17,41,57,"**Learner Goal:** Pass B1 German exam on Dec 6th, focusing on informal","r"]];

  /* ---------- Derived from the data ---------- */
  const TURNS = CHAT.flatMap(([s, t]) => [s, t]);       // TURNS[n - 1] is turn n
  const N = TURNS.length;
  const ASK = N - 3;                                     // Mia's request: turn 57
  const ANSWER = ASK + 1;                                // the tutor's answer: turn 58
  const winFor = n => [Math.max(1, n - KEEP), n - 1];    // turns the window bot sent for its reply at turn n
  const WIN = winFor(ANSWER);
  const lastSeen = t => { let n = 0; for (let r = 2; r <= N; r += 2) { const [a, b] = winFor(r); if (t >= a && t <= b) n = r; } return n; };
  const tokOf = n => CHAT[n / 2 - 1][2];                 // prompt tokens of the window bot's call at tutor turn n
  const T_WIN = tokOf(ANSWER), T_FULL = ANSWERS["full-58"].in, T_MEM = ANSWERS["memory-58"].in, T_BUG = ANSWERS["bug-58"].in;
  const FOLD_AT = Object.keys(FOLDS).filter(k => k.startsWith("fold-")).map(k => +k.slice(5));
  const foldsBy = L => { const r = []; for (let n = KEEP + BATCH; n <= L; n += BATCH) r.push(n); return r; };
  const NOTES = FOLDS["fold-" + FOLD_AT[FOLD_AT.length - 1]];   // the notes the bot carried at turn 57
  const NOTES_TURNS = FOLD_AT[FOLD_AT.length - 1] - KEEP;        // they cover turns 1..40
  const FOLD_IN = sum(FOLD_AT.map(n => FOLDS["fold-" + n].in)), FOLD_OUT = sum(FOLD_AT.map(n => FOLDS["fold-" + n].out));
  const WORDS_FIRST = words(FOLDS["fold-" + FOLD_AT[0]].text), WORDS_LAST = words(NOTES.text);
  const MEM_RECENT = [NOTES_TURNS + 1, ASK];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-chat { margin: 14px 0 0; max-height: 46vh; overflow-y: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
      .lx-${ID}-turn { display: grid; grid-template-columns: 2.6em 4.6em 1fr; gap: 2px 8px; width: 100%; min-height: 44px; padding: 8px 10px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--ink); font: inherit; font-size: 15px; line-height: 1.45; text-align: left; cursor: pointer; }
      .lx-${ID}-turn:last-child { border-bottom: 0; }
      .lx-${ID}-turn:disabled { cursor: default; }
      .lx-${ID}-tnum { font: 600 13px/1.6 var(--mono); color: var(--muted); }
      .lx-${ID}-who { font: 600 12.5px/1.7 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-txt { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
      .lx-${ID}-turn.in { background: var(--sunk); box-shadow: inset 3px 0 0 var(--ink); }
      .lx-${ID}-turn.no { background: var(--bad-soft); }
      .lx-${ID}-turn.ok { background: var(--good-soft); }
      .lx-${ID}-rec { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-left: 3px solid var(--ink); border-radius: 4px; background: var(--surface); font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-rec b.h { display: block; margin-bottom: 6px; font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-facts { display: grid; gap: 8px; margin: 14px 0 0; }
      .lx-${ID}-fact { display: grid; grid-template-columns: 1.6em 1fr auto; gap: 8px; align-items: start; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: inherit; font-size: 15.5px; line-height: 1.45; text-align: left; cursor: pointer; }
      .lx-${ID}-fbox { font: 700 15px/1.45 var(--mono); }
      .lx-${ID}-ftn { font: 500 12.5px/1.8 var(--mono); color: var(--muted); white-space: nowrap; }
      .lx-${ID}-fact[aria-pressed="true"] { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); background: var(--sunk); }
      .lx-${ID}-fact.miss { border-color: var(--bad); box-shadow: inset 0 0 0 1px var(--bad); }
      .lx-${ID}-code { margin: 14px 0 0; padding: 6px 0; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); }
      .lx-${ID}-code button { display: block; width: 100%; min-height: 44px; padding: 6px 10px; border: 0; background: none; color: var(--ink); font: 500 13.5px/1.5 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; }
      .lx-${ID}-code button.no { background: var(--bad-soft); }
      .lx-${ID}-code button.ok { background: var(--good-soft); box-shadow: inset 3px 0 0 var(--good); }
      .lx-${ID}-wrap div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + var(--ind)); text-indent: calc(-1 * var(--ind)); }
      .lx-${ID}-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .lx-${ID}-btn { margin-top: 12px; min-height: 44px; }
      @media (max-width: 520px) {
        .lx-${ID}-turn { grid-template-columns: 2.4em 1fr; }
        .lx-${ID}-txt { grid-column: 1 / -1; }
        .lx-${ID}-row2 { grid-template-columns: 1fr; }
        .lx-${ID}-wrap div { padding-left: calc(12px + var(--ind)); }
      }
    `;
    document.head.appendChild(s);
  }
  const rec = (kit, text, head) => `<div class="lx-${ID}-rec">${head ? `<b class="h">${kit.esc(head)}</b>` : ""}${kit.esc(text)}</div>`;
  const cap = () => `<p class="lx-${ID}-cap">${CAPTION}</p>`;
  // the shared listing, with long lines wrapping (hanging indent) instead of hiding off the side at 390px
  const codeWrap = (kit, lines, active) => { let k = 0; return kit.code(lines, active).replace('class="lcode"', `class="lcode lx-${ID}-wrap"`).replace(/<div/g, () => `<div style="--ind:${lines[k++].match(/^ */)[0].length + 4}ch"`); };
  const who = n => n % 2 ? "Mia" : "tutor";
  // a transcript of turns a..b; cls(n) gives a row class; pick makes rows buttons
  function chat(kit, a, b, { cls = () => "", pick = false, tag = () => "" } = {}) {
    const rows = [];
    for (let n = a; n <= b; n++) rows.push(`<button type="button" class="lx-${ID}-turn ${cls(n)}" data-i="${n}"${pick ? "" : " disabled"}><span class="lx-${ID}-tnum">${n}</span><span class="lx-${ID}-who">${who(n)}${tag(n)}</span><span class="lx-${ID}-txt">${kit.esc(TURNS[n - 1])}</span></button>`);
    return `<div class="lx-${ID}-chat" tabindex="0" aria-label="Turns ${a} to ${b}">${rows.join("")}</div>`;
  }
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* 1. The situation: the answer at turn 58 is wrong. Find the turn that held what the bot needed. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const RIGHT = 1;
    const say = n => {
      if (n === RIGHT) return [`Right. Mia described the writing part in turn ${RIGHT}: an informal email, about 80 words, three points. The bot sent only the last ${KEEP} turns, so the last reply that could see turn ${RIGHT} was turn ${lastSeen(RIGHT)}. By turn ${ANSWER} the window held turns ${WIN[0]} to ${WIN[1]}, all about separable verbs, restaurants and <i>kennen</i>. So it made up a task from those. Nothing failed with an error; the bot just did not know.`, true];
      if (n === 3) return [`Turn 3 is her grammar weak spot, and a good task would use it too. But the task asks for <b>the format</b> of the writing part: the email, the length, the three points. Which turn describes that?`, false];
      if (n >= WIN[0]) return [`Turn ${n} was inside the window: the bot sent it when it wrote turn ${ANSWER}, so it saw this. The missing fact is in a turn the bot no longer sent.`, false];
      return [`Turn ${n} left the window too, but it is ${n % 2 ? "about something else" : "one of the tutor's replies"}. It does not say what the writing part of her exam looks like.`, false];
    };
    const paint = () => {
      const ok = pick === RIGHT;
      el.innerHTML = `<h1>The tutor forgot the exam</h1>
        <p class="lead">Mia studies German with a tutor bot in the evenings. Tonight's session ran to ${N} turns (a turn is one message, hers or the bot's). To keep each call small, the bot sends the model its instructions plus only the <b>last ${KEEP} turns</b>, and nothing else. This is called a <b>sliding window</b>. Every chat product with long sessions must decide what to send on each call; this lesson is about that choice. At turn ${ASK} Mia asks:</p>
        ${rec(kit, TURNS[ASK - 1], `turn ${ASK}, Mia`)}
        ${rec(kit, TURNS[ANSWER - 1], `turn ${ANSWER}, the tutor`)}
        ${cap()}
        <p class="lead">A small hosted model wrote this answer. It is not the writing part of Mia's exam. Below is the chat up to turn ${ASK}. The rows marked <b>sent</b> are the window: the turns the bot sent when it wrote turn ${ANSWER}.</p>
        <p class="task">Tap the turn where Mia said what the writing part of her exam looks like.</p>
        ${chat(kit, 1, ASK, { pick: !ok, cls: n => `${n >= WIN[0] ? "in" : ""} ${pick === n ? (ok ? "ok" : "no") : ""}`, tag: n => n >= WIN[0] ? " · sent" : "" })}
        <div class="lpanel">${pick == null ? "" : kit.feedback(...say(pick))}</div>`;
      el.querySelectorAll(`.lx-${ID}-turn`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === RIGHT) done(); });
      const box = el.querySelector(`.lx-${ID}-chat`);
      if (box && pick != null) { const r = box.querySelector(`[data-i="${pick}"]`); if (r) box.scrollTop = r.offsetTop - box.offsetTop - 40; }
    };
    paint();
  }

  /* 2. By hand: write the notes you would keep at turn 40, then check them against Mia's request. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const chosen = new Set();
    let checked = false, msg = null;
    const paint = () => {
      const needs = FACTS.filter(f => f.need), missing = needs.filter(f => !chosen.has(f.k));
      const pass = checked && !missing.length;
      el.innerHTML = `<h1>Write the notes at turn 40</h1>
        <p class="lead">One way to keep old facts: when turns leave the window, write short <b>notes</b> about them, and send the notes with every call. Notes must stay short, or you are back to sending everything. Here are things Mia said in turns 1 to 40.</p>
        <p class="task">You are the note-taker at turn 40. Pick at most ${MAX_FACTS} facts to keep. You know her request at turn ${ASK}, but a real note-taker would not, so pick facts worth keeping anyway. Then check your notes against turn ${ASK}.</p>
        <div class="lx-${ID}-facts">${FACTS.map(f => `<button type="button" class="lx-${ID}-fact${checked && f.need && !chosen.has(f.k) ? " miss" : ""}" data-f="${f.k}" aria-pressed="${chosen.has(f.k)}"${pass ? " disabled" : ""}><span class="lx-${ID}-fbox">${chosen.has(f.k) ? "✓" : "·"}</span><span>${kit.esc(f.text)}</span><span class="lx-${ID}-ftn">turn ${f.turn}</span></button>`).join("")}</div>
        <div class="lpanel">
          <div class="vars"><span>notes <b>${chosen.size} / ${MAX_FACTS}</b></span></div>
          ${pass ? "" : `<button type="button" class="btn primary lx-${ID}-btn" data-check${chosen.size ? "" : " disabled"}>Check against turn ${ASK}</button>`}
          ${msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll(`.lx-${ID}-fact`).forEach(b => b.onclick = () => {
        const k = b.dataset.f;
        if (chosen.has(k)) chosen.delete(k);
        else if (chosen.size >= MAX_FACTS) { msg = [`Your notes already hold ${MAX_FACTS} facts. Untick one first: short notes are the point.`]; paint(); return; }
        else chosen.add(k);
        checked = false; msg = null; paint();
      });
      const c = el.querySelector("[data-check]");
      if (c) c.onclick = () => {
        checked = true;
        const miss = FACTS.filter(f => f.need && !chosen.has(f.k));
        const extra = FACTS.filter(f => chosen.has(f.k) && !f.need).map(f => f.k);
        if (miss.length) {
          msg = [`Mia asks: “${kit.esc(TURNS[ASK - 1])}” Your notes miss ${miss.map(f => `turn ${f.turn} (${f.k === "A" ? "the exam's writing format" : "the mistake she keeps making"})`).join(" and ")}. A bot with these notes still cannot write the right task. ${extra.length && chosen.size + miss.length > MAX_FACTS ? "Each of your other picks took a place that one of these needed." : ""} Swap and check again.`, false];
          paint(); return;
        }
        const notes = [];
        if (chosen.has("F")) notes.push("Keeping her wish for English explanations is good too: it applies to every answer.");
        if (chosen.has("D")) notes.push("The bike shop is a fair pick: a tutor can use it to make tasks personal.");
        if (extra.some(k => "CGI".includes(k))) notes.push("Tiredness, the cat and the tea mattered for one moment; they do not change any later answer.");
        msg = [`Your notes hold what turn ${ASK} needs: the exam's writing format (turn 1) and the “weil” mistake (turn 3). With them, a bot can ask for an informal email of about 80 words with three points, and practise the verb after “weil”. ${notes.join(" ")} A note-taker who did not know turn ${ASK} would keep these two anyway: her goal and the mistake she repeats. The test you just ran is the one to use for any summary: name the facts a later turn will need, and check they survived.`, true];
        paint(); done();
      };
    };
    paint();
  }

  /* 3. Spot the idea: what should the bot send, if each call must stay small however long the session runs? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const BIG = 40;
    const opts = [
      "Send all the turns, every time",
      `A bigger window: the last ${BIG} turns`,
      `The last ${KEEP} turns word for word, plus short notes about every turn that has left the window`,
      "Write “B1 exam, writing part” into the bot's instructions"
    ];
    const fb = [
      [`That answer would be right: the recorded bot that sent all ${ASK} turns did write an email task. But that call carried ${T_FULL} input tokens against the window's ${T_WIN}, and it grows with every turn. The goal was calls that stay small however long the session runs.`, false],
      [`A ${BIG}-turn window only moves the point where old turns drop out. In this session turn 1 would still leave it at turn ${BIG + 2}, and Mia asked at turn ${ASK}. Any fixed window drops the start of a long enough chat, and costs more on every call.`, false],
      [`Right. The window keeps the recent turns exact and the size of each call about flat. The notes carry the older facts forward in a few lines. This pair is a <b>sliding window plus a running summary</b>: “running” because the notes are updated as the chat goes on, each time turns leave the window.`, true],
      ["That fixes this one fact for this one student. The bot cannot know in advance what each learner will say: Mia's exam arrived in the chat itself, at turn 1. The bot needs a way to keep whatever was said, not a list someone typed beforehand.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Small calls, and still remember</h1>
        <p class="lead">The window keeps every call small: the bot's calls stayed between ${Math.min(...CHAT.slice(KEEP / 2).map(c => c[2]))} and ${Math.max(...CHAT.slice(KEEP / 2).map(c => c[2]))} input tokens once the window was full. But it dropped turn 1.</p>
        <p class="task">The team wants each call to stay small however long a session runs, and the bot to still know what Mia said at the start. What should the bot send?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 4. Predict, then see: the answer at turn 58 with notes + recent turns, and what it cost. */
  function predict({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { right: 0, opts: ["Yes: an email task like her exam", "No: notes this short lose the format", "No: the recent turns about restaurants win"],
        fb: [null,
          ["The notes are short, but they are about the right things. The model writes them with an instruction to keep goals, exam details, mistakes and preferences. Read the notes above: the format is there.", false],
          ["The restaurant turns are still sent, but so are the notes, in the bot's instructions, and they name the exam's writing part directly. Nothing pushes them out.", false]] },
      { right: 1, opts: [`Fewer than the window's ${T_WIN}`, `Between ${T_WIN} and ${T_FULL}`, `More than the full history's ${T_FULL}`],
        fb: [[`It sends everything the window bot sends plus the notes. Notes are extra text, so they cannot make the call smaller.`, false], null,
          [`The notes replace ${NOTES_TURNS} old turns with about ${WORDS_LAST} words. That is far less than the turns themselves.`, false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Predict, then see</h1>
        <p class="lead">The team rebuilt the bot. It keeps the recent turns word for word. Each time turns leave the window, a second model call rewrites the notes to include them. This step is called a <b>fold</b>. At turn ${ASK} it sends its instructions, then these notes (they cover turns 1 to ${NOTES_TURNS}), then turns ${MEM_RECENT[0]} to ${MEM_RECENT[1]}.</p>
        ${rec(kit, NOTES.text, `notes covering turns 1–${NOTES_TURNS}`)}
        ${cap()}
        ${stage < 2 ? `<p class="task">${stage === 0 ? `Predict: will the answer at turn ${ANSWER} be right for Mia?` : `Predict: how many input tokens did this call send? The window bot sent ${T_WIN}; a bot sending all ${ASK} turns sent ${T_FULL}.`}</p>` : ""}
        ${stage >= 1 ? `${rec(kit, ANSWERS["memory-58"].text, `turn ${ANSWER}, the tutor with notes`)}${cap()}` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : ""}
        ${stage === 1 && ans == null ? kit.feedback(`Right: an email of about 80 words to a friend, and the bike shop from turn 15 makes it personal. The point “weil du … Zeit hattest” even uses her grammar weak spot.`, true) : ""}
        ${stage === 2 ? kit.feedback(`Right: ${T_MEM} input tokens. That is ${T_MEM - T_WIN} more than the window bot (the notes, plus one more recent turn), and ${T_FULL - T_MEM} fewer than sending all ${ASK} turns, whose call keeps growing each turn. This call stays about flat. The cost is somewhere else: ${plural(FOLD_AT.length, "extra model call")} to write the notes (at turns ${FOLD_AT.join(", ")}), ${FOLD_IN} input and ${FOLD_OUT} output tokens in all.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. Check which facts survived the model's notes. */
  const SURVIVE = [
    { text: "The exam: B1 on 6 December, informal email, about 80 words, three points (turn 1)", kept: true,
      why: "Kept: “Pass B1 German exam on Dec 6th, focusing on informal email writing (approx. 80 words, 3 points)”." },
    { text: "The trip to Vienna in spring (turn 17)", kept: false,
      why: `Dropped. The notes at turn 40 and 48 had “Travel vocabulary (Vienna)”; at turn 56 that line became “Separable verbs …”. A fact that survived two folds was lost in the third, silently.` },
    { text: "English explanations of her mistakes (turn 21)", kept: true, why: "Kept: under Preferences, “Explanations in English.”" },
    { text: "Tired after work tonight (turn 9)", kept: false, why: "Dropped, as it should be: the instruction said to drop small talk." },
    { text: "Tonight they practised writing an email", kept: true, invented: true,
      why: "The notes do say “Practicing email writing”, but it never happened: the tutor asked about the email's points in turns 2 and 8, and Mia never wrote one. A summary can add a claim that is not in the chat." }
  ];
  function survived({ el, done, kit }) {
    ensureStyle();
    const ans = SURVIVE.map(() => null);
    const truth = SURVIVE.map(s => s.kept ? 0 : 1);
    const paint = () => {
      const all = ans.every((a, i) => a === truth[i]);
      const f56 = NOTES;
      el.innerHTML = `<h1>Which facts survived?</h1>
        <p class="lead">The notes are written by a model, so they are a copy of the chat that can lose or change things. These are the notes the bot carried at turn ${ASK}, after ${plural(FOLD_AT.length, "fold")}. Each fold sent the old notes plus ${BATCH} turns, and asked for notes of at most 60 words.</p>
        ${rec(kit, f56.text, `notes after the fold at turn ${FOLD_AT[FOLD_AT.length - 1]}`)}
        ${cap()}
        <p class="task">For each item, do the notes contain it? Pick again if you change your mind.</p>
        ${SURVIVE.map((s, i) => `<div class="lcase" id="c${i}"><p>${kit.esc(s.text)}</p>${kit.options(["In the notes", "Not in the notes"], { picked: ans[i], correct: truth[i] })}${ans[i] == null ? "" : kit.feedback(ans[i] === truth[i] ? kit.esc(s.why) : (s.kept ? `Look again: ${kit.esc(s.why)}` : `Search the notes for it: it is not there. ${kit.esc(s.why)}`), ans[i] === truth[i])}</div>`).join("")}
        ${all ? kit.feedback(`So the notes kept what turn ${ASK} needed, dropped one fact you might want later, and added one claim that is not true. Two more things the recording shows: the notes grew from ${WORDS_FIRST} words at the first fold to ${WORDS_LAST} at the last, despite “at most 60 words”, and the last fold stopped because it hit the call's limit of ${f56.maxTokens} output tokens (<code>finish_reason</code> <code>"${kit.esc(f56.finish)}"</code>). Running notes need a strict length limit and a check. Do not just trust them.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === truth[j])) done();
      }));
    };
    paint();
  }

  /* 6. The same thing in Python: a stepped replay of build_context over turns 1..57. */
  const foldName = t => FOLD_AT.includes(t) ? `fold-${t}` : null;
  const notesAt = f => { // the fold whose notes summary holds at this frame (null: none yet)
    const [ln, t, len] = f, done5 = ln === 6 || (ln === 2 && len === KEEP) || ln >= 7;
    const had = FOLD_AT.filter(n => t != null && (n < t || (n === t && done5)));
    return had.length ? had[had.length - 1] : null;
  };
  const skipTo = k => { // where the replay jumps next, and the folds that run in the gap
    const t = FRAMES[k][1], to = FRAMES[k + 1][1], gap = FOLD_AT.filter(n => n > t && n < to);
    return ` ${t === 1 ? "The replay now skips" : "Skipping"} ahead to turn ${to}${gap.length ? `; ${gap.length === 1 ? "a fold" : "folds"} at ${gap.length === 1 ? "turn" : "turns"} ${gap.join(gap.length === 2 ? " and " : ", ").replace(/, (\d+)$/, " and $1")} ${gap.length === 1 ? "runs" : "run"} on the way` : ""}.`;
  };
  function sayFrame(f, k) {
    const [ln, t, len, a, b] = f, nf = notesAt(f);
    const rr = len ? (a === b ? `turn ${a}` : `turns ${a}–${b}`) : "empty";
    if (k === FRAMES.length - 1) return `The function returns ${KEEP + 2} messages: the instructions with the notes about turns 1–${NOTES_TURNS}, then turns ${a}–${b}. The replay checked them: they are exactly the messages the bot sent for the recorded answer at turn ${ANSWER}.`;
    if (ln === 1) return "Start with no notes and no recent turns.";
    if (ln === 3) return `Turn ${t} arrives. <code>recent</code> holds ${len ? `${len} turns (${rr})` : "nothing yet"}.`;
    if (ln === 4) return len === KEEP + BATCH ? `<code>recent</code> now holds ${KEEP + BATCH} turns (${rr}): ${KEEP} for the window plus ${BATCH} too many. Time to fold.` : `<code>recent</code> holds ${len} ${len === 1 ? "turn" : "turns"}. Not ${KEEP + BATCH} yet, so no fold.`;
    if (ln === 5) return `<code>summarise</code> sends the old notes ${nf ? `(from turn ${nf})` : "(none yet)"} and the oldest ${BATCH} turns, ${a}–${a + BATCH - 1}, to the model. In the replay it returns the recorded notes <code>${foldName(t)}</code>.`;
    if (ln === 6) return `The notes now cover turns 1–${a + BATCH - 1}. Next, drop those ${BATCH} turns from <code>recent</code>.`;
    if (ln === 2) return `Back to the loop. <code>recent</code> holds ${plural(len, "turn")} (${rr}).${t === 57 ? " That was the last turn." : skipTo(k)}`;
    if (ln === 7) return `Build the instructions: the bot's own, plus “Earlier in this session:” and the notes from turn ${nf}.`;
    return "";
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FRAMES[i], nf = notesAt(f);
      el.innerHTML = `<h1>The same thing in Python</h1>
        <p class="lead">This function builds what the bot sends. <code>turns</code> is the chat as messages, <code>keep</code> the window size (${KEEP} turns), <code>batch</code> how many turns to fold at once (${BATCH}). Folding in batches means one notes call per ${BATCH} turns, not one per turn. <code>summarise</code> is the second model call: <code>summarise(turns, summary="")</code> takes the turns to fold and the old notes (empty if you leave them out). This is a replay of a real run over turns 1 to ${ASK}, with the recorded notes. To keep it short, it shows only turns 1, 24, 32 and 57.</p>
        <p class="task">Step through to the end. Watch when <code>recent</code> shrinks and the notes change.</p>
        ${codeWrap(kit, CODE, f[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>turn <b>${f[1] == null ? "–" : f[1]}</b></span><span>len(recent) <b>${f[2] == null ? "–" : f[2]}</b></span><span>summary <b>${nf ? `notes from turn ${nf}` : f[5] === "" ? "\"\"" : "–"}</b></span><span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(sayFrame(f, i))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
    };
    paint();
  }

  /* 7. Broken on purpose: a one-argument slip that forgets the exam. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const RIGHT = 5;
    const bug40 = FOLDS["bug-fold-40"].text, bug56 = FOLDS["bug-fold-56"].text;
    const say = {
      1: "Starting with empty notes is right: at turn 1 there is nothing to remember yet.",
      2: "The loop visits every turn once. The same loop runs in the working version.",
      3: "Every new turn goes into <code>recent</code>. Same as the working version.",
      4: `The fold fires at the right moments: the recordings show folds at turns ${FOLD_AT.join(", ")} in both versions.`,
      6: `Dropping the ${BATCH} folded turns is intended: they should now live in the notes. It only loses them because the notes never got the earlier facts. That is a symptom of another line.`,
      7: "This puts the notes into the instructions, as in the working version. It sends whatever the notes say; the notes were already missing the exam.",
      8: "The return builds the message list the same way as the working version."
    };
    const paint = () => {
      const ok = pick === RIGHT;
      el.innerHTML = `<h1>Broken on purpose: the notes forget</h1>
        <p class="lead">A teammate wrote this version. It folds at the same turns and sends the same recent turns, but at turn ${ANSWER} it again gave a short-text task instead of an exam email:</p>
        ${rec(kit, ANSWERS["bug-58"].text, `turn ${ANSWER}, the buggy bot`)}
        <div class="lx-${ID}-row2">${rec(kit, bug40, "its notes after the fold at turn 40")}${rec(kit, bug56, "its notes after the fold at turn 56")}</div>
        ${cap()}
        <p class="task">Tap the line that makes the notes forget the exam.</p>
        <div class="lx-${ID}-code" role="group" aria-label="build_context_buggy">${BUGGY.map((l, j) => `<button type="button" data-i="${j}" class="${pick === j ? (ok ? "ok" : "no") : ""}"${ok || j === 0 ? " disabled" : ""}>${kit.esc(l)}</button>`).join("")}</div>
        <div class="lpanel">${pick == null ? "" : ok
          ? kit.feedback(`Right. <code>summarise(recent[:batch])</code> leaves out the old notes, so <code>summary</code> falls back to its default, empty. Each fold writes notes about only its own ${BATCH} turns and throws the old notes away. At turn 40 the notes' line for exam details said “None.” By turn 56 they were only about the dative quiz and separable verbs. The fix is one argument: <code>summarise(recent[:batch], summary)</code>. This buggy call sent ${T_BUG} input tokens and still answered wrong: a small context is not the goal, the right one is. A test that asks “is the exam still in the notes after every fold?” catches this the first time it runs.`, true)
          : kit.feedback(say[pick] || "Not this line.", false)}</div>`;
      el.querySelectorAll(`.lx-${ID}-code button`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task on cost at twice the length. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const L1 = N, L2 = 2 * N, f1 = foldsBy(L1).length, f2 = foldsBy(L2).length;
    const opts = [
      `Each answer's input stays about the same; the notes calls go from ${f1} to ${f2}`,
      "Each answer's input doubles, like sending everything",
      "Nothing changes: the notes are written once per session"
    ];
    const fb = [
      [`Right. Each answer sends the instructions, the notes and ${KEEP} to ${KEEP + BATCH - 1} recent turns, whatever the session length, as long as the notes are capped. The notes calls grow with the session: one per ${BATCH} turns after the first ${KEEP + BATCH}, so ${f1} in ${L1} turns and ${f2} in ${L2}. Those calls cost tokens and add a pause on the turns where they run (unless you run them in the background).`, true],
      [`That is the full-history bot: its call carried ${T_FULL} input tokens at turn ${ANSWER} and keeps growing. Here the recent turns never pass ${KEEP + BATCH - 1}, and the notes replace everything older.`, false],
      [`The notes are rewritten at every fold, not once: at turns ${FOLD_AT.join(", ")} in this session. A longer session means more folds.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What it is:</b> send the last few turns word for word, plus short notes about everything older. A second model call updates the notes each time turns leave the window.</p>
        <p class="lead"><b>For:</b> long chats where something said early still matters late: tutoring, coaching, planning.</p>
        <p class="lead"><b>Not for:</b> chats short enough to send whole (send everything: no notes call, nothing lost). Text that must stay word for word, like a pasted contract or code: notes rewrite it in other words, so keep that text, or fetch it back when needed. Facts that must outlive the session: use a long-term memory store.</p>
        <p class="lead"><b>Costs:</b> an extra model call at each fold. Notes that drop or invent facts without warning, as you saw. Notes that grow unless you limit their length. Tests to keep them honest.</p>
        <p class="task">Sessions grow from ${L1} to ${L2} turns, with the same window of ${KEEP} and folds of ${BATCH}. What happens?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including ones where notes are the wrong tool. */
  const CASES = [
    ["A recipe-planning assistant. In message 2 the user says her son has a nut allergy. Sixty messages later, after talk about mains and shopping, she asks for a dessert idea.", true,
      "Yes. A fact said early must still shape an answer much later, and the chat is long. The allergy is exactly what the notes must keep, and worth a check after every fold.",
      "The allergy left any small window long ago, and sending all sixty messages every time grows the cost. Notes that keep the allergy, plus the recent messages, fit this case."],
    ["A password-reset helper. Chats are 4 to 8 messages long.", false,
      "No. The whole chat is a few hundred tokens. Send all of it: a notes call would add cost and a chance to lose something, and save nothing.",
      "Notes only pay off when the chat is too long to send whole. Eight short messages fit easily; send them all, every time."],
    ["A contract assistant. The user pastes a 3-page lease at message 3. At message 45 she asks: “Quote clause 7.2 exactly.”", false,
      "No, not on its own: notes would paraphrase the lease and she needs the exact words. Keep the document itself (pinned in the context, or stored and fetched back); notes can still cover the rest of the chat.",
      "A summary cannot quote: it keeps the gist, not the text. For exact wording, keep the document itself, or store it and fetch the clause back, instead of summarising it."],
    ["A coding helper. At the start the user says the project uses Python 3.12 and PostgreSQL. Eighty messages of debugging later, she asks for a database migration script.", true,
      "Yes. The stack was said once at the start and matters for the answer at message 80. Notes keep it; the window keeps the recent debugging word for word.",
      "Without notes the window has long dropped “PostgreSQL”, and the bot may guess another database. A short note of the stack, carried forward at each fold, fixes that."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Window plus notes, or not?</h1>
        <p class="lead">Four other chat products. Window plus notes means: send the recent messages word for word, plus short running notes about everything older.</p>
        <p class="task">Would you build each one that way? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can keep a long chat on track</h1>
      <p class="lead">You saw a sliding window drop Mia's exam, wrote notes by hand and tested them against a later question, and stepped through a window plus running notes in ${CODE.length - 1} lines of Python. You also found the one missing argument that made the notes forget.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>build_context</code> with a fake <code>summarise</code>, and a check that a fact from turn 1 is still in the notes after every fold.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You folded old chat turns into notes; next an agent's own context fills up with tool results mid-task, and you decide what can be cleared and what must stay word for word.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Long conversations: sliding windows and summaries",
    checked: "2026-11-13",
    sources: [
      "https://platform.claude.com/docs/en/build-with-claude/working-with-messages",
      "https://openrouter.ai/docs/api/reference/overview",
      "https://docs.langchain.com/oss/python/langchain/short-term-memory",
      "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
    ],
    interview: [
      {
        q: "Users of your chat assistant say it forgets what they told it early in long chats. You send the last 20 messages. What do you change, and how do you know it worked?",
        good: [
          "The window drops early messages silently; add running notes of the messages that leave it and send them with every call",
          "Pass the old notes into every update, so each fold builds on the last one",
          "Cap the notes' length, or they slowly grow back into the full history",
          "Test with real long chats: list facts from early turns that later turns need, and check they are still in the notes after each fold",
          "Weigh the cost: one extra model call per fold, against a bigger window on every call"
        ],
        weak: "Make the window bigger. That only moves the point where the start of the chat drops out, and makes every call more expensive."
      },
      {
        q: "After you added running summaries, a user complains the bot “remembers” something she never said. What could cause it, and what do you do?",
        good: [
          "The summary is written by a model, so it can add claims that are not in the chat, and each fold can carry the mistake forward",
          "Read the notes at each fold in a trace and find the fold where the claim first appeared",
          "Tighten the notes prompt: only facts the user stated, and keep or drop rather than interpret",
          "Keep the raw chat stored, so a fact in the notes can be checked against the turns it came from"
        ],
        weak: "Say the model hallucinated and switch to a bigger one, without looking at what the notes said at each fold."
      }
    ],
    screens: [situation, byHand, spotIdea, predict, survived, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="57"]'], right: ['[data-i="1"]'] },
      { wrong: ['[data-f="C"]', '[data-f="G"]', "[data-check]"], right: ['[data-f="C"]', '[data-f="G"]', '[data-f="A"]', '[data-f="B"]', "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: SURVIVE.map((_, i) => `#c${i} [data-right]`) },
      { right: Array(FRAMES.length - 1).fill("[data-next]") },
      { wrong: ['[data-i="6"]'], right: ['[data-i="5"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
