/* Lesson s5c-personal-data: keeping personal data out of prompts and logs.
   Story: Ruth builds the quote bot for Lark Removals, a home-moving company. Some quotes come out wrong, so she
   wants to switch on tracing. Every trace would carry the customers' chats, full of names, addresses and phone
   numbers, into a hosted tracing tool.
   Ideas: (1) a redactor finds personal data by shape (patterns) and by value (what the quote form already holds),
   swaps each piece for a numbered tag and keeps the tags so the reply can be restored; patterns miss what has no
   shape (names, described addresses, spelled-out numbers, values typed differently); (2) where you redact
   decides what leaks: tracing records every traced function's arguments and return value, so redaction must
   happen before the first traced function and restoring after the last one.
   Depth: explain (screens 1, 3, 9, interview), scratch (screen 5: the from-scratch redactor stepped from a real
   trace; screens 2 and 4: its real output), debug (screen 7: a real Langfuse trace that leaks; screen 8: the
   fix, each option checked by a real rerun).
   Data, all real, copied from docs/ai-path/runs/s5c-personal-data/to_js.out.txt (made by to_js.py):
   - chats.py: the ten chats and quote forms (invented; phone numbers from Ofcom's ranges kept for fiction);
   - redactor.py -> redactor.out.txt: both redactors on the ten chats, and the traced run of redact() on chat 9;
   - app.py -> trace-inside/mask/noinput/edge.out.txt: the spans the real Langfuse SDK (5.2.0, env.txt) built,
     kept in memory through its span_exporter argument instead of a server.
   Model answer: docs/ai-path/recordings/s5c-personal-data/reply-grace.json (main checkout), a small hosted model,
   temperature 0; app.py replays it in all four variants (the redacted message is the same in each).
   Lesson-local style (.lx-s5c-personal-data-*): chat bubbles with tappable pieces, the trace fields, see
   ensureStyle(). Every number on screen is computed here from DATA. Plain browser script. */
(() => {
  const ID = "s5c-personal-data";
  const P = `lx-${ID}-`;
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const word = n => WORDS[n] || String(n);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from docs/ai-path/runs/s5c-personal-data/to_js.out.txt, not altered ---------- */
  const DATA = {"chats": [{"chunks": ["Hi, I'm", "*Maria Lopez.|NAME", "We need a quote for", "a 2-bedroom flat", "from", "*M14 5RT|POSTCODE", "to Leeds", "on Saturday 6 March."], "v1": "Hi, I'm Maria Lopez. We need a quote for a 2-bedroom flat from [POSTCODE] to Leeds on Saturday 6 March.", "v2": "Hi, I'm [NAME_1]. We need a quote for a 2-bedroom flat from [POSTCODE_2] to Leeds on Saturday 6 March.", "pieces": [{"piece": "Maria Lopez", "kind": "NAME", "v1": false, "v2": true}, {"piece": "M14 5RT", "kind": "POSTCODE", "v1": true, "v2": true}]}, {"chunks": ["Please call me on", "*07700 900 418|PHONE", "after 6pm.", "It's about", "the piano", "in the quote."], "v1": "Please call me on [PHONE] after 6pm. It's about the piano in the quote.", "v2": "Please call me on [PHONE_1] after 6pm. It's about the piano in the quote.", "pieces": [{"piece": "07700 900 418", "kind": "PHONE", "v1": true, "v2": true}]}, {"chunks": ["Moving from", "*14 Hartley Road, Didsbury|ADDRESS", "to my mum's", "in", "*ls6 2qb.|POSTCODE", "Email:", "*dan.hollis@example.com|EMAIL"], "v1": "Moving from 14 Hartley Road, Didsbury to my mum's in ls6 2qb. Email: [EMAIL]", "v2": "Moving from [ADDRESS_2] to my mum's in ls6 2qb. Email: [EMAIL_1]", "pieces": [{"piece": "14 Hartley Road, Didsbury", "kind": "ADDRESS", "v1": false, "v2": true}, {"piece": "ls6 2qb", "kind": "POSTCODE", "v1": false, "v2": false}, {"piece": "dan.hollis@example.com", "kind": "EMAIL", "v1": true, "v2": true}]}, {"chunks": ["Can", "*Priya|NAME", "(my wife)", "ring you back?", "Her number is", "*07700 900 772.|PHONE"], "v1": "Can Priya (my wife) ring you back? Her number is [PHONE].", "v2": "Can Priya (my wife) ring you back? Her number is [PHONE_1].", "pieces": [{"piece": "Priya", "kind": "NAME", "v1": false, "v2": false}, {"piece": "07700 900 772", "kind": "PHONE", "v1": true, "v2": true}]}, {"chunks": ["The price went up", "by £80", "since yesterday, why?", "Office line:", "*0161 496 0213|PHONE", "–", "*Ben Akande|NAME"], "v1": "The price went up by £80 since yesterday, why? Office line: 0161 496 0213 – Ben Akande", "v2": "The price went up by £80 since yesterday, why? Office line: 0161 496 0213 – [NAME_1]", "pieces": [{"piece": "0161 496 0213", "kind": "PHONE", "v1": false, "v2": false}, {"piece": "Ben Akande", "kind": "NAME", "v1": false, "v2": true}]}, {"chunks": ["We're in", "*the flat above the bakery on Mill Lane, buzzer 3.|ADDRESS", "Two sofas", "and a fridge."], "v1": "We're in the flat above the bakery on Mill Lane, buzzer 3. Two sofas and a fridge.", "v2": "We're in the flat above the bakery on Mill Lane, buzzer 3. Two sofas and a fridge.", "pieces": [{"piece": "the flat above the bakery on Mill Lane, buzzer 3", "kind": "ADDRESS", "v1": false, "v2": false}]}, {"chunks": ["My number:", "*oh seven seven double oh, nine hundred, five six one.|PHONE", "Mornings are best."], "v1": "My number: oh seven seven double oh, nine hundred, five six one. Mornings are best.", "v2": "My number: oh seven seven double oh, nine hundred, five six one. Mornings are best.", "pieces": [{"piece": "oh seven seven double oh, nine hundred, five six one", "kind": "PHONE", "v1": false, "v2": false}]}, {"chunks": ["Email the quote to", "*s.okafor@example.net|EMAIL", "please.", "We are 4 people", "and a dog."], "v1": "Email the quote to [EMAIL] please. We are 4 people and a dog.", "v2": "Email the quote to [EMAIL_1] please. We are 4 people and a dog.", "pieces": [{"piece": "s.okafor@example.net", "kind": "EMAIL", "v1": true, "v2": true}]}, {"chunks": ["*Grace Kim|NAME", "here,", "moving out of", "student halls", "on 30 June,", "just 12 boxes.", "Mobile", "*+44 7700 900 236|PHONE"], "v1": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE]", "v2": "[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]", "pieces": [{"piece": "Grace Kim", "kind": "NAME", "v1": false, "v2": true}, {"piece": "+44 7700 900 236", "kind": "PHONE", "v1": true, "v2": true}]}, {"chunks": ["Our new address is", "*flat 2, 8 Elm Court,|ADDRESS", "*LS1 4AP.|POSTCODE", "Can you store", "the boxes", "for a week?"], "v1": "Our new address is flat 2, 8 Elm Court, [POSTCODE]. Can you store the boxes for a week?", "v2": "Our new address is flat 2, 8 Elm Court, [POSTCODE_1]. Can you store the boxes for a week?", "pieces": [{"piece": "flat 2, 8 Elm Court", "kind": "ADDRESS", "v1": false, "v2": false}, {"piece": "LS1 4AP", "kind": "POSTCODE", "v1": true, "v2": true}]}], "forms": [{"NAME": "Maria Lopez", "PHONE": "07700 900 104", "EMAIL": "maria.lopez@example.org", "ADDRESS": "31 Cringle Street, Levenshulme"}, {"NAME": "Tom Reyes", "PHONE": "07700 900 418", "EMAIL": "t.reyes@example.com", "ADDRESS": "5 Wilmslow Close"}, {"NAME": "Dan Hollis", "PHONE": "07700 900 655", "EMAIL": "dan.hollis@example.com", "ADDRESS": "14 Hartley Road, Didsbury"}, {"NAME": "Arjun Mehta", "PHONE": "07700 900 391", "EMAIL": "arjun.m@example.net", "ADDRESS": "9 Fern Grove"}, {"NAME": "Ben Akande", "PHONE": "01614960213", "EMAIL": "ben.akande@example.org", "ADDRESS": "77 Oak Street"}, {"NAME": "Lucy Hart", "PHONE": "07700 900 830", "EMAIL": "lucyhart@example.com", "ADDRESS": "Flat 1, 22 Mill Lane"}, {"NAME": "Owen Price", "PHONE": "07700 900 561", "EMAIL": "owen.price@example.org", "ADDRESS": "3 Bank Row"}, {"NAME": "Sade Okafor", "PHONE": "07700 900 947", "EMAIL": "s.okafor@example.net", "ADDRESS": "40 Kings Avenue"}, {"NAME": "Grace Kim", "PHONE": "+44 7700 900 236", "EMAIL": "grace.kim@example.org", "ADDRESS": "Owens Park, Room 114"}, {"NAME": "Hana Novak", "PHONE": "07700 900 712", "EMAIL": "hana.novak@example.com", "ADDRESS": "6 Brook Terrace"}], "steps": [{"line": 1, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236"}}, {"line": 2, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {}}}, {"line": 3, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {}, "kind": "NAME", "value": "Grace Kim"}}, {"line": 4, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {}, "kind": "NAME", "value": "Grace Kim"}}, {"line": 2, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]"}, "kind": "NAME", "value": "Grace Kim"}}, {"line": 3, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]"}, "kind": "PHONE", "value": "+44 7700 900 236"}}, {"line": 4, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]"}, "kind": "PHONE", "value": "+44 7700 900 236"}}, {"line": 2, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "PHONE", "value": "+44 7700 900 236"}}, {"line": 3, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "EMAIL", "value": "grace.kim@example.org"}}, {"line": 2, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "EMAIL", "value": "grace.kim@example.org"}}, {"line": 5, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "EMAIL", "value": "grace.kim@example.org"}}, {"line": 6, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "EMAIL", "value": "grace.kim@example.org"}}, {"line": 5, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "EMAIL", "value": "grace.kim@example.org"}}, {"line": 6, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "PHONE", "value": "grace.kim@example.org"}}, {"line": 7, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "PHONE", "value": "grace.kim@example.org", "found": "+44 7700 900 236"}}, {"line": 6, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "PHONE", "value": "grace.kim@example.org", "found": "+44 7700 900 236"}}, {"line": 5, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "PHONE", "value": "grace.kim@example.org", "found": "+44 7700 900 236"}}, {"line": 6, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "grace.kim@example.org", "found": "+44 7700 900 236"}}, {"line": 5, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "grace.kim@example.org", "found": "+44 7700 900 236"}}, {"line": 8, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "grace.kim@example.org", "found": "+44 7700 900 236"}}, {"line": 9, "event": "line", "vars": {"message": "Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "Grace Kim", "found": "+44 7700 900 236", "tag": "[NAME_1]"}}, {"line": 8, "event": "line", "vars": {"message": "[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "Grace Kim", "found": "+44 7700 900 236", "tag": "[NAME_1]"}}, {"line": 9, "event": "line", "vars": {"message": "[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "+44 7700 900 236", "found": "+44 7700 900 236", "tag": "[PHONE_2]"}}, {"line": 8, "event": "line", "vars": {"message": "[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "+44 7700 900 236", "found": "+44 7700 900 236", "tag": "[PHONE_2]"}}, {"line": 10, "event": "line", "vars": {"message": "[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "+44 7700 900 236", "found": "+44 7700 900 236", "tag": "[PHONE_2]"}}, {"line": 10, "event": "return", "vars": {"message": "[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]", "tags": {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}, "kind": "POSTCODE", "value": "+44 7700 900 236", "found": "+44 7700 900 236", "tag": "[PHONE_2]"}}], "stepResult": ["[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]", {"Grace Kim": "[NAME_1]", "+44 7700 900 236": "[PHONE_2]"}], "traces": {"inside": {"to_customer": "Hi Grace Kim, thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to +44 7700 900 236.", "spans": [{"span": "handle_chat", "type": "span", "input": "{\"args\": [\"Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile +44 7700 900 236\", {\"NAME\": \"Grace Kim\", \"PHONE\": \"+44 7700 900 236\", \"EMAIL\": \"grace.kim@example.org\"}], \"kwargs\": {}}", "output": "Hi Grace Kim, thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to +44 7700 900 236."}, {"span": "generate", "type": "generation", "input": "{\"args\": [\"[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]\"], \"kwargs\": {}}", "output": "Hi [NAME_1], thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to [PHONE_2]."}]}, "mask": {"to_customer": "Hi Grace Kim, thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to +44 7700 900 236.", "spans": [{"span": "handle_chat", "type": "span", "input": "{\"args\": [\"Grace Kim here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE]\", {\"NAME\": \"Grace Kim\", \"PHONE\": \"[PHONE]\", \"EMAIL\": \"[EMAIL]\"}], \"kwargs\": {}}", "output": "Hi Grace Kim, thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to [PHONE]."}, {"span": "generate", "type": "generation", "input": "{\"args\": [\"[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]\"], \"kwargs\": {}}", "output": "Hi [NAME_1], thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to [PHONE_2]."}]}, "noinput": {"to_customer": "Hi Grace Kim, thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to +44 7700 900 236.", "spans": [{"span": "handle_chat", "type": "span", "input": null, "output": "Hi Grace Kim, thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to +44 7700 900 236."}, {"span": "generate", "type": "generation", "input": "{\"args\": [\"[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]\"], \"kwargs\": {}}", "output": "Hi [NAME_1], thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to [PHONE_2]."}]}, "edge": {"to_customer": "Hi Grace Kim, thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to +44 7700 900 236.", "spans": [{"span": "answer", "type": "span", "input": "{\"args\": [\"[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]\"], \"kwargs\": {}}", "output": "Hi [NAME_1], thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to [PHONE_2]."}, {"span": "generate", "type": "generation", "input": "{\"args\": [\"[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]\"], \"kwargs\": {}}", "output": "Hi [NAME_1], thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to [PHONE_2]."}]}}};

  // From docs/ai-path/recordings/s5c-personal-data/reply-grace.json (not altered)
  const REC_REPLY = {"src": "s5c-personal-data/reply-grace", "provider": "openrouter", "model": "google/gemini-2.5-flash-lite", "recordedAt": "2026-11-13", "system": "You reply to quote requests for Lark Removals, a home-moving company. Write a short, friendly reply (at most three sentences) that thanks the customer, repeats what they want moved and when, and says how we will send the quote. Personal details in the message have been replaced with tags such as [NAME_1] or [PHONE_2]. Keep every tag exactly as written and use it wherever you would use that detail.", "user": "[NAME_1] here, moving out of student halls on 30 June, just 12 boxes. Mobile [PHONE_2]", "text": "Hi [NAME_1], thanks for your quote request! We'll get a quote over to you for moving your 12 boxes on 30 June. We'll send it to [PHONE_2]."};

  // The listings, line for line from docs/ai-path/runs/s5c-personal-data/redactor.py and app.py
  const PATTERN_LINES = [
    "PATTERNS = {",
    "    \"EMAIL\": r\"[\\w.+-]+@[\\w-]+\\.[\\w.]+\\w\",",
    "    \"PHONE\": r\"(?:\\+44 ?|0)7\\d{3} ?\\d{3} ?\\d{3}\",",
    "    \"POSTCODE\": r\"\\b[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}\\b\",",
    "}"
  ];
  const REDACT_LINES = [
    "def redact(message, known):",
    "    tags = {}",
    "    for kind, value in known.items():",
    "        if value.lower() in message.lower():",
    "            tags[value] = f\"[{kind}_{len(tags) + 1}]\"",
    "    for kind, pattern in PATTERNS.items():",
    "        for found in re.findall(pattern, message):",
    "            tags.setdefault(found, f\"[{kind}_{len(tags) + 1}]\")",
    "    for value, tag in tags.items():",
    "        message = re.sub(re.escape(value), tag, message, flags=re.I)",
    "    return message, tags"
  ];
  const HANDLE_LINES = [
    "@observe()",
    "def handle_chat(message, form):",
    "    safe, tags = redact(message, form)",
    "    reply = generate(safe)",
    "    return restore(reply, tags)"
  ];
  const EDGE_LINES = [
    "@observe()",
    "def answer(safe_message):",
    "    return generate(safe_message)",
    "",
    "def handle_chat_edge(message, form):",
    "    safe, tags = redact(message, form)",
    "    reply = answer(safe)",
    "    return restore(reply, tags)"
  ];

  /* ---------- Derived from the data ---------- */
  const CAPTION = `Recorded model output, ${REC_REPLY.recordedAt}`;
  const CHATS = DATA.chats.map((c, ci) => ({
    ...c, ci,
    parts: c.chunks.map((t, k) => t.startsWith("*") ? { key: `${ci}-${k}`, text: t.slice(1).split("|")[0], kind: t.split("|")[1] } : { key: `${ci}-${k}`, text: t, kind: null })
  }));
  const PII = CHATS.flatMap(c => c.parts.filter(p => p.kind));
  const PIECES = CHATS.flatMap(c => c.pieces.map(p => ({ ...p, chat: c.ci })));
  const V1_CAUGHT = PIECES.filter(p => p.v1).length;
  const V2_CAUGHT = PIECES.filter(p => p.v2).length;
  const TOTAL = PIECES.length;
  const tappable = t => t.replace(/[^\w£]/g, "").length > 2;      // tiny joiners ("in", "–") stay plain text
  const findPiece = s => PIECES.find(p => p.piece === s);
  const GRACE = 8;                                                  // chat 9, the one traced and sent to the model
  const STEP_TAGS = DATA.stepResult[1];
  const STEPS = DATA.steps;
  const restore = (reply, tags) => Object.entries(tags).reduce((r, [v, t]) => r.split(t).join(v), reply);
  const RESTORED = restore(REC_REPLY.text, STEP_TAGS);
  const T = DATA.traces;
  const FORM9 = DATA.forms[GRACE];
  const FORM9_USED = ["NAME", "PHONE", "EMAIL"].map(k => FORM9[k]);
  const leaksIn = s => s == null ? [] : FORM9_USED.filter(v => s.includes(v));
  const FIELDS = run => T[run].spans.flatMap((s, si) => ["input", "output"].map(f => ({ key: `${si}-${f}`, span: s.span, type: s.type, f, value: s[f], leaks: leaksIn(s[f]) })));
  const INSIDE = FIELDS("inside");
  const LEAK_KEYS = INSIDE.filter(x => x.leaks.length).map(x => x.key);
  const leakSummary = run => { const ls = FIELDS(run).filter(x => x.leaks.length); return { n: ls.length, values: [...new Set(ls.flatMap(x => x.leaks))], where: ls.map(x => `${x.span} ${x.f}`) }; };

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}chat { margin: 12px 0 0; padding: 8px 10px 10px; border-left: 3px solid var(--line); background: var(--sunk); font-size: 15.5px; line-height: 1.5; }
      .${P}who { font: 600 12.5px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
      .${P}chat .${P}w { display: inline-block; margin: 3px 2px; vertical-align: middle; }
      .${P}chat button.${P}w { min-height: 44px; padding: 4px 9px; border: 1.5px dashed var(--line); border-radius: 6px; background: var(--bg); color: var(--ink); font: 500 15px/1.4 var(--font); cursor: pointer; text-align: left; max-width: 100%; overflow-wrap: anywhere; }
      .${P}chat button.${P}w.right { border: 1.5px solid var(--good); background: var(--good-soft); }
      .${P}chat button.${P}w.wrong { border: 1.5px solid var(--bad); background: var(--bad-soft); }
      .${P}mono { font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .${P}out { margin: 8px 0 0; padding: 8px 10px; border-left: 3px solid var(--line); background: var(--sunk); }
      .${P}out u { text-decoration: underline wavy var(--bad); text-underline-offset: 3px; }
      .${P}out .${P}n { font: 600 12.5px/1 var(--mono); color: var(--muted); margin-right: 6px; }
      .${P}list { display: grid; gap: 8px; margin-top: 12px; }
      .${P}list button { display: block; width: 100%; text-align: left; min-height: 44px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); cursor: pointer; font: 500 15px/1.45 var(--font); overflow-wrap: anywhere; }
      .${P}list button small { display: block; margin-top: 4px; font: 500 13px/1.5 var(--mono); color: var(--ink-2); white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}list button.right { border-color: var(--good); background: var(--good-soft); }
      .${P}list button.wrong { border-color: var(--bad); background: var(--bad-soft); }
      .${P}span { margin-top: 14px; font: 600 13px/1.4 var(--mono); color: var(--muted); }
      .${P}form { margin: 8px 0 0; font: 500 13px/1.6 var(--mono); color: var(--ink-2); overflow-wrap: anywhere; }
      .${P}wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; }
      @media (hover: hover) { .${P}list button:not(.right):not(.wrong):hover, .${P}chat button.${P}w:not(.right):not(.wrong):hover { border-color: var(--ink); } }
    `;
    document.head.appendChild(s);
  }
  const cap = t => `<p class="${P}cap">${t}</p>`;
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  const numbered = lines => lines.map((l, i) => `${String(i + 1).padStart(2)}  ${l}`);
  // the redacted text with the pieces the redactor missed underlined
  const markMissed = (kit, text, missed) => {
    let html = kit.esc(text);
    missed.forEach(m => { const e = kit.esc(m); html = html.split(e).join(`<u>${e}</u>`); });
    return html;
  };
  const formLine = (kit, f, keys) => `<div class="${P}form">quote form: ${keys.map(k => `${k} = ${kit.esc(f[k])}`).join(" · ")}</div>`;

  /* why a piece the learner tapped is not personal data */
  function notPersonal(t) {
    if (/Leeds/.test(t)) return "A city on its own points to hundreds of thousands of people. The quote needs it to price the distance.";
    if (/March|June/.test(t)) return "A moving date describes the job. Without a name or an address next to it, it points to no one.";
    if (/bedroom|piano|sofas|fridge|boxes|people|dog/.test(t)) return "This is what is being moved. It prices the job and says nothing about who the customer is.";
    if (/my wife/.test(t)) return "This says who Priya is to the customer. “My wife” on its own names no one: the name next to it is the personal piece.";
    if (/mum/.test(t)) return "“My mum” names no one. Where she lives is in the same chat: find that piece instead.";
    if (/student halls/.test(t)) return "Thousands of students live in halls. The building and room number would point to one person; “student halls” alone does not.";
    if (/£|yesterday|price/.test(t)) return "This is about the price, not about a person.";
    if (/6pm|Mornings/.test(t)) return "A good time to call says nothing about who the person is or how to reach them.";
    if (/store|week/.test(t)) return "This is a request about the job. Nothing in it points to a person.";
    return "This is a label or a joining phrase. The personal data is the name, number or place next to it.";
  }

  /* 1. The situation, and the by-hand task: find every piece of personal data in ten chats. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const found = new Set();
    let wrong = null;
    const paint = () => {
      const fin = found.size === PII.length;
      el.innerHTML = `<h1>Who is in these chats?</h1>
        <p class="lead">Ruth builds the quote bot for Lark Removals, a home-moving company. Customers chat with it to get a price. Some quotes come out wrong, so Ruth wants to switch on tracing, as in the tracing lesson. Then every chat goes to a hosted tracing tool, and anyone on the team can read it there. This lesson is about keeping customers' personal data out of the model call and the traces, while Ruth can still debug.</p>
        <p class="lead">Here are ten chats from the bot's log. We invented them for this lesson: every person, address and number in them is fictional.</p>
        <p class="task">Tap every piece of personal data: anything that tells you who a person is, where they live, or how to contact them.</p>
        ${CHATS.map(c => `<div class="${P}chat"><div class="${P}who">chat ${c.ci + 1}</div>${c.parts.map(p => tappable(p.text)
          ? `<button type="button" class="${P}w${found.has(p.key) ? " right" : wrong === p.key ? " wrong" : ""}" data-i="${p.key}">${kit.esc(p.text)}</button>`
          : `<span class="${P}w">${kit.esc(p.text)}</span>`).join("")}</div>`).join("")}
        <div class="lpanel">
          <div class="vars"><span>found <b>${found.size} / ${PII.length}</b></span></div>
          ${fin ? kit.feedback(`All ${PII.length} found: ${PII.filter(p => p.kind === "NAME").length} names, ${PII.filter(p => p.kind === "PHONE").length} phone numbers, ${PII.filter(p => p.kind === "EMAIL").length} emails, ${PII.filter(p => p.kind === "POSTCODE").length} postcodes and ${PII.filter(p => p.kind === "ADDRESS").length} addresses. Some had a clear shape (an email has an @). Others you found by what they mean: “Priya” is a name, “the flat above the bakery on Mill Lane” is an address, and “oh seven seven double oh …” is a phone number read out loud. Next: what does a program find?`, true)
            : wrong ? kit.feedback(notPersonal(CHATS[+wrong.split("-")[0]].parts[+wrong.split("-")[1]].text), false) : ""}
        </div>`;
      el.querySelectorAll(`button.${P}w`).forEach(b => b.onclick = () => {
        const key = b.dataset.i, [ci, k] = key.split("-").map(Number), part = CHATS[ci].parts[k];
        if (part.kind) { found.add(key); wrong = null; } else wrong = key;
        paint();
        if (found.size === PII.length) done();
      });
    };
    paint();
  }

  /* 2. Compare with a pattern-based redactor: predict one result, then see all ten. */
  function patterns({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const picks = ["Maria Lopez", "ls6 2qb", "0161 496 0213", "+44 7700 900 236"].map(findPiece);
    const right = picks.findIndex(p => p.v1);
    const fb = picks.map((p, i) => i === right
      ? [`Right. The phone pattern starts with <code>(?:\\+44 ?|0)7</code>: a mobile may start with 0 or with +44, with or without a space. Here is the run on all ten chats. The underlined pieces are the ones the redactor missed. It caught <b>${V1_CAUGHT} of the ${TOTAL}</b> pieces you found.`, true]
      : p.kind === "NAME" ? [`No pattern here describes a name. The three patterns look for an @, a mobile number's shape and a postcode's shape. “${kit.esc(p.piece)}” is just two words.`, false]
      : p.kind === "POSTCODE" ? [`It is a postcode, but the pattern asks for capital letters (<code>[A-Z]</code>). Python's <code>re</code> matches letter case exactly unless you pass the <code>re.I</code> flag, so the lowercase postcode slips through.`, false]
      : [`It is a phone number, but the pattern only knows mobiles: 07 or +44 7 at the start. A landline that starts 0161 has another shape.`, false]);
    const paint = () => {
      const ok = ans === right;
      el.innerHTML = `<h1>What does a pattern catch?</h1>
        <p class="lead">A redactor is code that finds personal data in text and swaps it for a placeholder before the text is sent or logged. Ruth's first redactor is three regular expressions. Each match is replaced by its kind in brackets, for example <code>[PHONE]</code>.</p>
        <div class="${P}wrap">${kit.code(PATTERN_LINES, -1)}</div>
        <p class="task">Which of these four pieces will it catch?</p>
        <div class="lpanel">${ask(kit, picks.map(p => kit.esc(p.piece)), right, ans, fb)}</div>
        ${ok ? CHATS.map(c => `<div class="${P}out ${P}mono"><span class="${P}n">${c.ci + 1}</span>${markMissed(kit, c.v1, c.pieces.filter(p => !p.v1).map(p => p.piece))}</div>`).join("") + cap("Real output of redact_patterns() in redactor.py on the ten chats.") : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: shape against meaning. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const missedNames = PIECES.filter(p => p.kind === "NAME" && !p.v1).length;
    const EMAILS_OK = PIECES.filter(p => p.kind === "EMAIL").every(p => p.v1), NAMES_V1 = PIECES.some(p => p.kind === "NAME" && p.v1);
    const opts = [
      "The patterns are badly written. One more pattern, for two words that start with a capital, would catch the names.",
      "A pattern finds data by its shape. Emails, mobiles and postcodes have a shape. Names and described addresses do not: they are personal because of what they mean, so another method must find them.",
      "Names on their own are not personal data, so missing them does not matter much.",
      "Send each chat to the model first and ask it to remove the personal data."
    ];
    const fb = [
      [`Try it on these chats: “Mill Lane”, “Hartley Road” and “Elm Court” are also two words with capitals, so they would be tagged as names, while “Priya” is one word and slips through, like any name typed in lowercase. There is no shape that only names have.`, false],
      [`Right. All ${missedNames} names slipped through, and so did every address and the spelled-out number. Two other ways to find data without a shape: the <b>values you already hold</b> (the quote form has the customer's name and address), and a model trained to spot names and places. Presidio, an open-source tool, combines patterns, checksums and such a model. Its own documentation says there is no guarantee it finds all sensitive information. Treat any redactor as a net with holes.`, true],
      [`The UK regulator's definition: personal data is any information relating to an identified or identifiable person, directly or indirectly. A full name identifies a person directly.`, false],
      [`That sends every chat, unredacted, to the very kind of outside service Ruth wants to keep it from. And a model's answer can still miss a piece; you cannot test it the way you test a function.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why the phone and not the name?</h1>
        <p class="lead">The redactor caught ${V1_CAUGHT} of ${TOTAL} pieces. It caught ${EMAILS_OK ? "every email" : "some emails"} and ${NAMES_V1 ? "some names" : "not one name"}.</p>
        <p class="task">Which explanation is right?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it, with predictions: version 2 (form values first, then patterns) on three chats. */
  function predictV2({ el, done, kit }) {
    ensureStyle();
    const pick = [4, 2, 3];   // chats 5, 3 and 4
    const Q = pick.map(ci => {
      const c = CHATS[ci], text = c.parts.map(p => p.text).join(" ");
      const missed = c.pieces.filter(p => !p.v2);
      const nTags = (c.v2.match(/\[[A-Z]+_\d+\]/g) || []).length;
      const allCaught = missed.reduce((t, p, j) => t.split(p.piece).join(`[${p.kind}_${nTags + j + 1}]`), c.v2);
      const opts = [c.v2, allCaught, text];
      const order = ci === 2 ? [1, 0, 2] : ci === 3 ? [2, 1, 0] : [0, 2, 1];
      return { c, text, missed, opts: order.map(o => opts[o]), right: order.indexOf(0), allIdx: order.indexOf(1), noneIdx: order.indexOf(2) };
    });
    const why = {
      4: q => `The form stores the phone as <code>${kit.esc(DATA.forms[4].PHONE)}</code>; Ben typed <code>${kit.esc(q.missed[0].piece)}</code>. The text check compares characters, so the spaces break the match, and the phone pattern only knows mobiles. The name matched the form, so it became <code>[NAME_1]</code>. A fix to test next: compare digits only.`,
      2: q => `The form holds Dan's current address, so “${kit.esc(DATA.forms[2].ADDRESS)}” was found and tagged, and his email matched the form too. “${kit.esc(q.missed[0].piece)}” is where he is moving to: it is not on the form, and the postcode pattern wants capitals. One lowercase postcode, missed by both checks.`,
      3: q => `The form only knows the customer, ${kit.esc(DATA.forms[3].NAME)}. Priya is a third person: no form holds her name, and no pattern describes it. Her number is not on the form either, but it has a mobile's shape, so the pattern caught it.`
    };
    const ans = Q.map(() => null);
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const show = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = `<h1>Use what you already know</h1>
        <p class="lead">The quote form already holds each customer's name, phone, email and current address. Version 2 of the redactor looks for those exact values first, ignoring capital letters. Then it runs the same three patterns. Each value it finds becomes a numbered tag such as <code>[NAME_1]</code>, and the tags are kept, so the real values can be put back later.</p>
        <p class="task">Predict the output for each chat. The next chat opens when you have this one right.</p>
        ${Q.slice(0, show).map((q, i) => `<div class="lcase" id="p${i}"><p><b>Chat ${q.c.ci + 1}:</b> ${kit.esc(q.text)}</p>${formLine(kit, DATA.forms[q.c.ci], ["NAME", "PHONE", "EMAIL", "ADDRESS"])}
          ${kit.options(q.opts.map(o => `<span class="${P}mono">${kit.esc(o)}</span>`), { picked: ans[i], correct: q.right })}
          ${ans[i] == null ? "" : ans[i] === q.right ? kit.feedback(`Right, that is the real output. ${why[q.c.ci](q)}`, true)
            : ans[i] === q.allIdx ? kit.feedback(`That one has no personal data left, but the real run missed a piece. ${why[q.c.ci](q)}`, false)
            : kit.feedback(`Too pessimistic: the form or the patterns did find something here. ${why[q.c.ci](q)}`, false)}</div>`).join("")}
        ${upto === -1 ? kit.feedback(`On all ten chats version 2 caught <b>${V2_CAUGHT} of ${TOTAL}</b> pieces, against ${V1_CAUGHT} for the patterns alone. Every miss is a test case for the next version.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, k) => a === Q[k].right)) done();
      }));
    };
    paint();
  }

  /* 5. The same redactor as Python, replayed from a real trace of chat 9. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const GATE = STEPS.findIndex(s => s.line === 7 && s.vars.kind === "PHONE");
    const say = (s, k) => {
      const v = s.vars;
      if (s.event === "return") return `Done. The message holds tags instead of the name and the number, and <code>tags</code> is the key to put them back. It never leaves Ruth's server.`;
      switch (s.line) {
        case 1: return "Start with an empty dict. It will map each personal value to its tag.";
        case 2: return k === 1 ? "Loop over the form's fields: here NAME, PHONE and EMAIL." : "Take the next field from the form.";
        case 3: return `Is “${kit.esc(v.value)}” in the message? Both sides are lowercased first, so capital letters do not matter.`;
        case 4: return `Yes. It gets the tag <code>[${v.kind}_${Object.keys(v.tags).length + 1}]</code>: the kind, then a number one higher than the tags so far.`;
        case 5: return "Now the patterns, one kind at a time.";
        case 6: return `<code>re.findall</code> runs the ${v.kind} pattern over the message.`;
        case 7: return `The pattern found “${kit.esc(v.found)}”. <code>setdefault</code> adds a key only if it is not there yet.`;
        case 8: return "Now swap each value for its tag.";
        case 9: return `Replace “${kit.esc(v.value)}” with <code>${kit.esc(v.tag)}</code>. <code>re.escape</code> makes the + and the dots in a value plain characters; <code>re.I</code> ignores capital letters.`;
        case 10: return "Return the safe message and the tags.";
        default: return "";
      }
    };
    const opts = [`It keeps the tag it already has, ${kit.esc(STEP_TAGS["+44 7700 900 236"])}`, "It adds a second tag, [PHONE_3], for the same number", "It replaces the old tag with [PHONE_3]"];
    const fb = [
      [`Right. <code>setdefault(key, default)</code> only sets the key when it is missing. The form had already tagged this number at line 5, so the pattern's find changes nothing. One value, one tag: restoring stays simple.`, true],
      ["A dict holds each key once. The number is already a key in <code>tags</code>, so there is no room for a second tag.", false],
      ["That is what <code>tags[found] = ...</code> would do. <code>setdefault</code> leaves an existing key alone.", false]
    ];
    const paint = () => {
      const s = STEPS[i], v = s.vars;
      const at = s.event === "return" ? -1 : s.line;
      el.innerHTML = `<h1>The redactor, line by line</h1>
        <p class="lead">This is version 2, run for real on chat 9. Three fields from Grace's form are passed in as <code>known</code>. <code>PATTERNS</code> is the dict from before. Each step shows the line about to run and the variables at that moment.</p>
        <p class="task">Predict the answer below, then step through to the end.</p>
        <div class="lcase" id="gate"><p>At line 8 the phone pattern will find “+44 7700 900 236”, which the form already tagged. What does line 8 do?</p>${ask(kit, opts, 0, ans, fb)}</div>
        <div class="${P}wrap">${kit.code(numbered(REDACT_LINES), at)}</div>
        <div class="vars"><span>kind <b>${kit.esc(v.kind || "–")}</b></span><span>tags <b>${kit.esc(JSON.stringify(v.tags || {}))}</b></span><span>step <b>${i + 1} / ${STEPS.length}</b></span></div>
        <div class="${P}out ${P}mono">message = ${kit.esc(JSON.stringify(v.message))}</div>
        ${kit.feedback(`${s.event === "return" ? "" : `Line ${s.line + 1}. `}${say(s, i)}${i === GATE ? " This is the step you predicted." : ""}`)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === STEPS.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === STEPS.length - 1 && ans === 0) done(); };
      el.querySelectorAll("#gate button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0 && i === STEPS.length - 1) done(); });
    };
    paint();
  }

  /* 6. The safe message goes to the model: does the task still work? Then restore. */
  function modelReply({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["It wrote its reply around the tags, using them like words", "It said it cannot write a reply without the real name and number", "It made up a name for the customer"];
    const reveal = `In the recorded run it wrote:<div class="${P}out ${P}mono">${kit.esc(REC_REPLY.text)}</div>${cap(CAPTION)}`;
    const fb = [
      [`Right. ${reveal}Ruth's code then puts the real values back, on her own server, just before the reply goes to Grace:<div class="${P}out ${P}mono">${kit.esc(RESTORED)}</div>The model never saw the name or the number, and the task did not need them. Note: while Ruth keeps <code>tags</code>, the tagged text can be linked back to Grace. The UK regulator calls this pseudonymisation: a security measure that does not stop the data being personal data.`, true],
      [`Not in this run. ${reveal}The system prompt said what the tags are, and a reply only needs a place for the name, not the name itself.`, false],
      [`Not in this run. ${reveal}It kept <code>[NAME_1]</code> exactly as the system prompt asked.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Can the model still do its job?</h1>
        <p class="lead">Ruth sends the safe message to the model. A small hosted model received this user message, with a short system prompt that ${ans == null ? "you will see after you answer" : "is shown below"}:</p>
        ${ans == null ? "" : `<div class="${P}out"><div class="${P}who">system</div><div class="${P}mono">${kit.esc(REC_REPLY.system)}</div></div>`}
        <div class="${P}out"><div class="${P}who">user</div><div class="${P}mono">${kit.esc(REC_REPLY.user)}</div></div>
        <p class="task">What did it do with the tags?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: a real Langfuse trace of the redacted bot still holds Grace's details. */
  function brokenTrace({ el, done, kit }) {
    ensureStyle();
    const found = new Set();
    let wrong = null;
    const show = x => x.value == null ? "(not recorded)" : x.value;
    const paint = () => {
      const fin = LEAK_KEYS.every(k => found.has(k));
      const by = k => INSIDE.find(x => x.key === k);
      el.innerHTML = `<h1>The redactor works. The trace still leaks.</h1>
        <p class="lead">Ruth wraps the bot in Langfuse's <code>@observe</code>, as in the tracing lesson, and runs chat 9. <code>generate</code>, the model call, is traced too, with <code>@observe(as_type="generation")</code>. We ran this code with the real Langfuse SDK. Two changes: <code>generate()</code> returns the recorded reply from the last screen instead of calling the model again, and the spans stay in memory instead of being sent. So you see exactly what would have gone to the tracing tool.</p>
        <div class="${P}wrap">${kit.code(numbered(HANDLE_LINES), -1)}</div>
        <p class="task">Tap every field of the trace that would put Grace's personal data in the tracing tool.</p>
        ${T.inside.spans.map((s, si) => `<div class="${P}span">span ${kit.esc(s.span)} (${kit.esc(s.type)})</div><div class="${P}list">${["input", "output"].map(f => { const x = by(`${si}-${f}`); return `<button type="button" data-i="${x.key}" class="${found.has(x.key) ? "right" : wrong === x.key ? "wrong" : ""}">${f}<small>${kit.esc(show(x))}</small></button>`; }).join("")}</div>`).join("")}
        <div class="lpanel">
          <div class="vars"><span>leaking fields found <b>${LEAK_KEYS.filter(k => found.has(k)).length} / ${LEAK_KEYS.length}</b></span></div>
          ${fin ? kit.feedback(`Both found. <code>@observe</code> records a function's arguments as its input and its return value as its output. So the span around <code>handle_chat</code> holds the raw message and the whole form, including Grace's email, which was not even in her chat. Its output is the reply after <code>restore</code>, with her name and number back in. The redactor did its job; it simply runs <i>inside</i> a function that is traced.`, true)
            : wrong ? kit.feedback(`This field holds only tags: <code>[NAME_1]</code> and <code>[PHONE_2]</code>. It is what the model saw and said. Look at the span that wraps the whole function.`, false)
            : found.size ? kit.feedback(`Yes, ${kit.esc(by([...found].pop()).span)} ${kit.esc(by([...found].pop()).f)} holds ${by([...found].pop()).leaks.map(v => `“${kit.esc(v)}”`).join(", ")}. There is one more.`) : ""}
        </div>`;
      el.querySelectorAll(`.${P}list button`).forEach(b => b.onclick = () => {
        const k = b.dataset.i;
        if (LEAK_KEYS.includes(k)) { found.add(k); wrong = null; } else wrong = k;
        paint();
        if (LEAK_KEYS.every(x => found.has(x))) done();
      });
    };
    paint();
  }

  /* 8. Broken on purpose, part 2: which fix holds? Every option was rerun for real. */
  function pickFix({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const M = leakSummary("mask"), N = leakSummary("noinput"), E = leakSummary("edge");
    const list = vs => vs.map(v => `“${kit.esc(v)}”`).join(", ");
    const opts = [
      "Give the Langfuse client a mask function (its masking hook) that runs the three patterns over what it records",
      "Turn off input capture on handle_chat: @observe(capture_input=False)",
      "Redact before the first traced function and restore after the last one: the traced code only ever sees tags",
      "Switch tracing off for the quote bot"
    ];
    const fb = [
      [`We ran it. The mask did tag the phone and the email, but ${list(M.values)} still reached ${plural(M.n, "field")} (${M.where.join(", ")}). A mask sees one value at a time and knows only the patterns. Keep it as a second net, not as the fix. For new Python setups Langfuse's docs now point to <code>mask_otel_spans</code>, which also covers spans that other libraries create. Either kind sees only the recorded values, not this customer's form.`, false],
      [`We ran it. The input field is now empty, but the output still holds ${list(N.values)}: the restored reply is the function's return value.`, false],
      [`Right. We ran it: ${E.n === 0 ? "no field in the trace holds any of Grace's details" : `${E.n} fields still leak`}. Ruth still sees the safe message, the model call and the reply in tags, which is all she needs to debug a wrong quote.`, true],
      ["Nothing leaks, and Ruth loses the traces she needed to find the wrong quotes. The tags let her keep tracing and keep the personal data out.", false]
    ];
    const paint = () => {
      const ok = ans === 2;
      el.innerHTML = `<h1>Which fix holds?</h1>
        <p class="lead">Ruth wants to keep tracing. We ran the same chat once for each of the first three fixes below, with the real SDK.</p>
        <p class="task">Which change keeps all of Grace's details out of the trace?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), 2, ans, fb)}</div>
        ${ok ? `<div class="${P}wrap">${kit.code(numbered(EDGE_LINES), -1)}</div>
          ${T.edge.spans.map(s => `<div class="${P}span">span ${kit.esc(s.span)} (${kit.esc(s.type)})</div><div class="${P}out ${P}mono">input: ${kit.esc(s.input)}\noutput: ${kit.esc(s.output)}</div>`).join("")}` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 9. The big picture, with a task. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Staff ask a bot about the company's public price list. Nobody types customer details.",
      "A hotel sends guests' messages, with room and phone numbers, to a hosted model that sorts them into “housekeeping”, “billing” or “other”.",
      "A model reads a photo of a passport to check that the name matches the booking."
    ];
    const fb = [
      ["Nothing personal goes in, so a redactor adds work and delay and protects nobody. Keep the logs tidy, but skip this.", false],
      ["Right. The sorting needs the request, not the room or the phone number. Tag them before the call and before the log, and the task works as well as before.", true],
      ["Here the personal data is the task itself: tag the name and there is nothing left to check. Instead choose a model you host or a provider whose terms you have checked, and keep this out of shared logs.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to redact</h1>
        <p class="lead"><b>What it is for:</b> keeping personal data out of places that do not need it: a hosted model, a tracing tool, your logs.</p>
        <p class="lead"><b>When to reach for it:</b> text written by people goes to a service you do not control, or is kept for debugging, and the task works without the real details.</p>
        <p class="lead"><b>When not:</b> the task is about the details themselves, or the text holds none. Then the answer is where the data goes and who can read it, not redaction.</p>
        <p class="lead"><b>What it costs:</b> misses, because no redactor finds everything; lost meaning if you tag too much; patterns and tests to keep up; a small delay on every call.</p>
        <p class="task">Where does a redactor in front of the model do the most good?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, including a "no". */
  const CASES = [
    ["A delivery app logs drivers' notes to customers: “Left it with your neighbour at number 12, Mr Patel.”", true,
      "Yes. A third person's name and a house number. Neither is on any form, and no pattern has their shape, so this is exactly where a pattern redactor misses. Test it with notes like this one.",
      "Look again: “Mr Patel” is a person, and “number 12” next to the customer's street is where he lives. Notes about neighbours are personal data about the neighbour."],
    ["A weather bot sends the model “Will it rain in Leeds tomorrow?” plus the forecast table. Users are not logged in, and no account or device id is sent.", false,
      "Right, no. A city and a forecast relate to no identifiable person. Redacting adds delay and protects no one. The useful work here is making sure no id gets added to these logs later.",
      "What in this text points to one person? A city holds hundreds of thousands of people, and the forecast is public. There is no name, no contact and no id. There is nothing for a redactor to protect."],
    ["Support chats are logged with names removed, but each one keeps the customer's account number.", true,
      "Yes. The account number links straight back to one customer in your own database. That is indirect identification, so it is still personal data. Tag it, or keep these logs as tightly as the database itself.",
      "The names are gone, but the account number points to exactly one customer in your own system. The UK regulator counts indirect identification too: this is still personal data."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Does this need redacting?</h1>
        <p class="lead">Three logs, away from the moving company.</p>
        <p class="task">For each one, decide whether it holds personal data that should be redacted before it is logged. Pick again if you change your mind.</p>
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
    const missed = PIECES.filter(p => !p.v2);
    el.innerHTML = `<h1>You can keep personal data out of a trace</h1>
      <p class="lead">You found ${PII.length} pieces of personal data by hand, saw patterns catch ${V1_CAUGHT} of them and patterns plus the form's values catch ${V2_CAUGHT}. You stepped through a redactor that tags each value and keeps the key, saw a model work happily with tags, and fixed a real trace that leaked because the redactor ran inside a traced function.</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>redact()</code> and make it pass tests built from the ${word(missed.length)} pieces version 2 still missed, such as the spaced landline and the lowercase postcode.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here you checked what goes <i>in</i> to the model and the logs. Next you check what comes <i>out</i>, before the app acts on it.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Keeping personal data out of prompts and logs",
    checked: "2026-11-14",
    sources: [
      "https://langfuse.com/docs/observability/features/masking",
      "https://langfuse.com/docs/observability/sdk/instrumentation",
      "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/what-is-personal-data/what-is-personal-data/",
      "https://presidio.dataprivacystack.org/",
      "https://docs.python.org/3/library/re.html",
      "https://docs.python.org/3/library/stdtypes.html#dict.setdefault"
    ],
    interview: [{
      q: "Your team wants to send production chat logs of an LLM feature to a hosted tracing tool to debug bad answers. Legal asks how you keep customers' personal data out. What do you do?",
      good: [
        "Redact at the edge: tag personal data before the first traced function and the model call, and restore the real values after the last one, on our own server",
        "Detect by value and by shape: the customer's own record (name, phone, address) plus patterns for emails, phones and postcodes, and a name-spotting model if misses matter",
        "Say plainly that no redactor catches everything: names of third people, described addresses and numbers typed oddly slip through, so add a masking hook in the tracing client as a second net (for Langfuse in Python, the docs now recommend mask_otel_spans) and limit who can read the traces",
        "Turn every miss into a test case, and check a sample of real traces by hand after each change"
      ],
      weak: "Run a regex over the logs for emails and phone numbers. That misses names and addresses, and it misses fields the tracer records on its own, such as a traced function's arguments."
    }],
    screens: [byHand, patterns, spotIdea, predictV2, asCode, modelReply, brokenTrace, pickFix, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-i="0-0"]`], right: PII.map(p => `[data-i="${p.key}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#p0 [data-wrong]"], right: ["#p0 [data-right]", "#p1 [data-right]", "#p2 [data-right]"] },
      { wrong: ["#gate [data-wrong]"], right: ["#gate [data-right]", ...Array(STEPS.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="1-input"]`], right: LEAK_KEYS.map(k => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
