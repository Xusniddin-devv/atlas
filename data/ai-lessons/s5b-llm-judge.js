/* Lesson: LLM-as-judge and its biases. Story: a cooking-class booking site compares two versions of its FAQ bot
   (version 1: one short sentence; version 2: warm, thorough, with tips) and lets a model judge which is better.
   Ideas: (1) a judge's verdict can follow things that are not quality: the longer answer (length bias) and the
   place in the prompt (position bias); you find out by labelling a sample yourself and by swapping the order;
   (2) a judge prompt with the reference (the FAQ) and a rubric, run in both orders with the swap rule (agree in
   both orders, or it is a tie), checked by its agreement with human labels.
   Data, all real (main checkout, docs/ai-path/recordings/s5b-llm-judge/):
     bot-v1-qNN, bot-v2-qNN          the two bot versions answering 24 customer questions (12 used here, chosen
                                     for a clear human label BEFORE any judge ran; see runs/.../data.mjs)
     judge-plain-qNN-12 / -21        a plain judge (no FAQ, must answer 1 or 2), v1 shown first / v2 shown first
     judge-rubric-qNN-12 / -21       the rubric judge (FAQ + rubric + reasoning + tie), both orders
   Made by docs/ai-path/runs/s5b-llm-judge/record-bots.mjs and record-judges.mjs; lesson-data.mjs printed REC
   below; judge_eval.py (output in judge_eval.out.txt) is the Python run replayed on screen 7 and computes the same
   agreement counts this file computes. The human labels are the lesson author's, made with the team's rule.
   Lesson-local CSS (answer boxes, report rows, prompt lines) is injected by style(). Plain browser script. */
(() => {
  const ID = "s5b-llm-judge", P = "lx-" + ID;
  const DATE = "2026-11-13";

  // From docs/ai-path/recordings/s5b-llm-judge/<name>.json, full answer texts, not altered.
  // provider openrouter, model google/gemini-2.5-flash-lite (bots and judges), temperature 0, recorded 2026-11-13.
  // v1/v2: bot answers; p12/p21: plain judge, v1 first / v2 first; r12/r21: rubric judge; v2cut: version 2 hit
  // its max_tokens; tok: input tokens of the two judge calls (both orders) for plain (p) and rubric (r).
  const REC = {
    4: {"v1":"No, aprons, knives, and all ingredients are provided.","v2":"That's a great question! You don't need to worry about bringing your own knives to our cooking classes. We provide all the necessary equipment, including high-quality knives, aprons, and all the fresh ingredients you'll need for the class.\n\nJust remember to wear closed-toe shoes for your safety in the kitchen. We want you to be comfortable and focused on learning all the delicious techniques!\n\nIf you have any other questions before your class, feel free to ask! We're here to make sure you have a wonderful and stress-free experience.","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 directly answers the question and is fully supported by the FAQ. Answer 2 also directly answers the question and is supported by the FAQ, but it includes extra information about closed-toe shoes and offers further assistance, which is not strictly necessary to answer the question.\n\nVerdict: 1","r21":"Answer 1 correctly states that knives are provided and also includes extra information about closed-toe shoes and a friendly closing. Answer 2 is also correct but less detailed. Both answers are correct according to the FAQ.\n\nVerdict: tie","tok":{"p":400,"r":1282}},
    6: {"v1":"Yes, you can take home what you cook, but please bring your own container.","v2":"Yes, absolutely! You are welcome to take home all the delicious food you prepare during your class. It's a wonderful way to share your new culinary skills with friends and family, or simply to enjoy your creations again later.\n\nJust a little tip: we don't provide containers for leftovers, so please remember to bring your own if you'd like to take your food home. This way, you'll be all set to pack up your culinary masterpieces!\n\nWe hope you have a fantastic time in class and enjoy every bite!","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 is correct and complete. Answer 2 is correct and complete, but adds unnecessary friendly text.\nVerdict: 1","r21":"Answer 1 correctly states that customers can take home their food and that they need to bring their own containers. It also adds extra friendly advice not present in the FAQ. Answer 2 is also correct but less complete in its explanation.\n\nVerdict: 1","tok":{"p":394,"r":1276}},
    7: {"v1":"Vegan versions are only offered in classes marked \"vegan-friendly\".","v2":"Hello there! I'm so glad you're interested in our French Bistro class!\n\nRegarding your vegan dietary needs, we can absolutely accommodate you! We offer a vegetarian version of every class, and if you let us know you're vegan when you book, we can prepare a vegan version for you.\n\n**A little tip:** While we do our very best to accommodate dietary needs, please be aware that our kitchen does handle nuts, gluten, and dairy. Therefore, we cannot guarantee that any dish will be completely free of traces of these ingredients.\n\nWe're really looking forward to having you join us for a delicious and fun experience! If you have any other questions at all, please don't hesitate to ask.","v2cut":false,"p12":"2","p21":"2","r12":"Answer 1 correctly states that vegan options are only available in \"vegan-friendly\" classes, which is directly from the FAQ. The French bistro class is not marked as \"vegan-friendly\" in the FAQ. Answer 2 incorrectly claims that a vegan version can be prepared for any class if requested, which contradicts the FAQ.\n\nVerdict: 1","r21":"Answer 1 incorrectly states that a vegan version can be prepared for any class, which contradicts the FAQ. The FAQ specifies that vegan versions are only offered in \"vegan-friendly\" classes. Answer 2 correctly states the condition for vegan options.\n\nVerdict: 2","tok":{"p":472,"r":1354}},
    10: {"v1":"The bread class takes 4 hours.","v2":"Hello there! Thanks for your interest in our bread class!\n\nOur bread class is a bit longer than our other classes, as it takes **4 hours** to complete. This allows us to really dive deep into the wonderful world of bread making, covering all the essential techniques and giving you plenty of hands-on practice.\n\nWe find that the extra hour really makes a difference in ensuring everyone leaves feeling confident and ready to bake delicious bread at home.\n\nIf you have any other questions about the bread class or any of our other offerings, please don't hesitate to ask! We're happy to help.","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 is correct and complete. Answer 2 is correct and complete, but adds extra information not requested by the customer.\nVerdict: 1","r21":"Answer 1 correctly states the length of the bread class and provides additional friendly context. Answer 2 also correctly states the length of the bread class. Both answers are correct and complete.\n\nVerdict: tie","tok":{"p":400,"r":1282}},
    12: {"v1":"Gift vouchers cannot be exchanged for cash.","v2":"Hello there! Thanks for reaching out to us.\n\nRegarding your gift voucher, I understand you're asking if it can be exchanged for cash. Our gift vouchers are valid for 12 months from the date of purchase and can be used towards any of our wonderful classes. However, they are **not redeemable for cash**.\n\nWe hope you find a class that sparks your interest! They make for a fantastic experience, and we'd love to have you join us.\n\nIf you have any other questions about using your voucher or about our classes, please don't hesitate to ask!","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 directly answers the question and is correct according to the FAQ. Answer 2 also directly answers the question and is correct, but includes extra information not directly asked for.\n\nVerdict: tie","r21":"Answer 1 correctly states that gift vouchers cannot be exchanged for cash, and also provides additional helpful information about their validity and usage. Answer 2 is also correct but less complete.\nVerdict: 1","tok":{"p":400,"r":1282}},
    13: {"v1":"You can move your booking to another date once, free, up to 48 hours before the class.","v2":"Hello there! Thanks for reaching out.\n\nRegarding moving your booking, our policy states that you can move your booking to another date **once**, free of charge, as long as it's at least 48 hours before the original class time.\n\nSince you've already moved your booking once, unfortunately, you won't be able to move it again for free. If you need to change your booking after this point, it would be subject to our cancellation policy.\n\nIf you need to cancel, you can get a full refund if you cancel 48 hours or more before the class. If you cancel later than that, you'll receive a class credit that's valid for 6 months. Please remember that if you don't show up for the class, no refund or credit will be issued.\n\nWe understand that plans can change, and we want to make sure you have the best experience possible. If you have any other questions or if there's anything else we can help you with, please don't hesitate to ask!","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 correctly states the policy on moving bookings but does not acknowledge that the customer has already moved their booking once. Answer 2 correctly states the policy, acknowledges the customer's situation, and explains the consequence.\n\nVerdict: 2","r21":"Answer 1 correctly states that the booking can only be moved once for free and accurately explains the cancellation policy, which applies since the customer cannot move the booking again. Answer 2 is correct but incomplete as it does not address the customer's specific situation of having already moved the booking once.\n\nVerdict: 1","tok":{"p":624,"r":1506}},
    16: {"v1":"No refund or credit is given if you do not show up for your class.","v2":"Oh dear, I'm so sorry to hear you missed your class yesterday! Unfortunately, as per our FAQ, we're unable to offer a refund or credit if you don't show up for your class. This is because we've already prepared all the ingredients and reserved your spot.\n\nHowever, I do want to make sure you have a great experience with us in the future! If you'd like to book another class, please feel free to reach out. We'd be happy to offer you a small discount on your next booking as a gesture of goodwill.\n\nJust a friendly reminder for future bookings: if you ever need to cancel or reschedule, please give us at least 48 hours' notice. This allows us to offer a full refund or move your booking to another date without any issues.\n\nWe hope to see you in the kitchen again soon!","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 directly states the policy from the FAQ regarding no-shows. Answer 2 also states the policy but adds extra information not present in the FAQ, such as the reason for the policy and an offer of a discount, which is not supported by the FAQ.\n\nVerdict: 1","r21":"Answer 1 incorrectly offers a discount, which is not mentioned in the FAQ. Answer 2 correctly states that no refund or credit is given for not showing up.\n\nVerdict: 2","tok":{"p":542,"r":1424}},
    17: {"v1":"You will receive a full refund if you cancel 48 hours or more before the class.","v2":"Hello there! Thanks for reaching out to us.\n\nSince your class is in 3 days, which is less than 48 hours away, you won't be eligible for a full refund if you cancel. However, you will receive a **class credit** for the full amount you paid. This credit will be valid for **6 months** from the date of your cancellation, so you'll have plenty of time to book another exciting class with us!\n\nWe understand that plans can change, and we want to make sure you still get to enjoy the wonderful experience of cooking with us.\n\n**A little tip:** When you're ready to rebook, be sure to check out our class schedule as soon as possible, as popular classes can fill up quickly! Also, remember that this class credit is non-transferable and cannot be exchanged for cash.\n\nWe hope to see you in one of our classes soon!","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 incorrectly states that a cancellation 3 days in advance results in a full refund. Answer 2 correctly explains that a cancellation 3 days in advance (less than 48 hours) results in a class credit valid for 6 months.\nVerdict: 2","r21":"Answer 1 incorrectly states that cancelling 3 days in advance (which is more than 48 hours) results in a class credit. The FAQ states that cancelling 48 hours or more before the class results in a full refund. Answer 1 also adds information about the credit being non-transferable and not exchangeable for cash, which is not directly relevant to the customer's question about what they get back *now*.\n\nAnswer 2 correctly states the condition for a full refund, but it does not answer the customer's specific question about cancelling a class that is in 3 days. The customer is asking what *they* will get back, given their specific timeframe.\n\nBoth answers are incorrect in how they address the customer's specific situation. Answer 1 is","tok":{"p":576,"r":1458}},
    18: {"v1":"Guests aged 12 to 15 must book with an adult who also takes the class.","v2":"Hello there! I'd be happy to help you with your question about bringing your son to one of our classes.\n\nYes, you can certainly bring your 13-year-old son! Our policy is that guests aged 12 to 15 must book with an adult who also participates in the class. This means that while your son will be cooking, you'll need to book yourself into the class as well to accompany him. It's a wonderful opportunity for you to bond and learn some new culinary skills together!\n\nA little tip: Since you'll both be cooking, make sure to wear comfortable, closed-toe shoes, as this is a requirement for all our participants. You don't need to bring anything else – we provide aprons, knives, and all the delicious ingredients you'll need.\n\nIf you have any other questions or would like to book, please don't hesitate to ask! We look forward to seeing you and your son in the kitchen!","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 correctly states the policy for 12-15 year olds. Answer 2 also correctly states the policy but adds extra information not directly asked for, and incorrectly implies the customer *can* bring their son if they book themselves in, when the customer explicitly stated they would *just watch*.\n\nVerdict: 1","r21":"Answer 1 incorrectly states that the adult must book as well, but the FAQ says the adult must *take* the class, implying participation. It also adds unnecessary information about shoes and what to bring. Answer 2 directly quotes the relevant part of the FAQ.\n\nVerdict: 2","tok":{"p":622,"r":1504}},
    21: {"v1":"You can move your booking to another date once, free, up to 48 hours before the class.","v2":"Hello there! I'd be happy to help you with rescheduling your class.\n\nTo move your class from tomorrow to next month, you'll need to be aware of our policy regarding date changes. You can change the date of your booking once, free of charge, as long as it's at least 48 hours before the original class time.\n\nSince your class is tomorrow, unfortunately, it falls within that 48-hour window. This means we won't be able to move it to another date for free.\n\nHowever, if you're unable to attend your class tomorrow, and you let us know before the class starts, you will receive a class credit. This credit will be valid for 6 months from the date of your original class. You can then use this credit to book a new class for next month or any time within those 6 months.\n\n**Here's what I recommend:**\n\n1.  **Check the class schedule for next month:** Take a look at our website to see which classes are available next month that you might","v2cut":true,"p12":"2","p21":"1","r12":"Answer 1 correctly states the policy but does not address the customer's specific situation of wanting to move a class that is tomorrow. Answer 2 correctly identifies that the customer cannot move their class for free because it is less than 48 hours away and offers a relevant alternative.\n\nVerdict: 2","r21":"Answer 1 incorrectly states that a class credit is given if the customer cannot attend due to being within the 48-hour window for rescheduling. The FAQ states that cancelling later than 48 hours before the class results in a credit, but not showing up does not. Answer 1 also incorrectly implies that a credit is given if the customer cannot attend, when the FAQ states no refund or credit if you do not show up. Answer 2 correctly states the policy for changing dates.\n\nVerdict: 2","tok":{"p":630,"r":1512}},
    22: {"v1":"Every class has a vegetarian version if you ask when you book.","v2":"Hello there! That's a great question about our bread class.\n\nYes, our bread class is **vegetarian-friendly**! We can absolutely accommodate a vegetarian diet for this class.\n\nTo make sure we have everything prepared for you, please remember to **mention that you'd like the vegetarian version when you book your class**. This helps our chefs get everything ready for you in advance.\n\nA little tip for your bread-making adventure: while we can make the bread vegetarian, please be aware that our kitchen does handle a variety of ingredients, including nuts, gluten, and dairy. So, while your bread will be vegetarian, we can't guarantee it will be completely free from traces of these other common allergens.\n\nWe're so excited for you to join us and learn the wonderful art of bread making! If you have any other questions at all, please don't hesitate to ask.","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 correctly states that a vegetarian version is available if requested when booking. Answer 2 also correctly states this, but adds extra information about allergens which was not asked for and is not relevant to the question.\n\nVerdict: 1","r21":"Answer 1 correctly states that the bread class can be made vegetarian if requested at booking, and it also includes a relevant warning about potential cross-contamination, which is a good addition. Answer 2 is also correct but less detailed.\n\nVerdict: 1","tok":{"p":528,"r":1410}},
    23: {"v1":"We cannot promise any dish is free of traces of nuts.","v2":"Thank you for reaching out to us with your question about nut-free classes!\n\nWhile we strive to accommodate all our guests, it's important to be transparent about our kitchen environment. Our cooking school kitchen does handle nuts, as well as gluten and dairy. Because of this, we unfortunately cannot guarantee that any dish prepared in our kitchen is completely free of traces of these allergens.\n\nHowever, we are very accommodating when it comes to allergies! If you have a nut allergy, please let us know when you book your class. We can often swap out ingredients to make most dishes suitable for you. We just want to make sure you're aware of the potential for cross-contamination.\n\nWe'd love for you to join us for a class! Please just be sure to mention your nut allergy during the booking process so we can make the necessary arrangements for your meal.\n\nIf you have any other questions, please don't hesitate to ask!","v2cut":false,"p12":"2","p21":"1","r12":"Answer 1 is correct because it accurately reflects the FAQ's statement about not being able to promise nut-free dishes. Answer 2 is also correct, but it adds information about swapping ingredients which, while true, is not directly answering the \"nut-free class\" question and could be misleading as it still doesn't guarantee a nut-free environment. Answer 1 is more direct and complete in answering the specific question asked.\n\nVerdict: 1","r21":"Answer 1 correctly states that the kitchen handles nuts and cannot guarantee a nut-free dish, but it also offers to swap ingredients if the allergy is noted at booking, which is consistent with the FAQ. Answer 2 is also correct but less complete.\n\nVerdict: 1","tok":{"p":550,"r":1432}}
  };

  // The cooking school's FAQ lines each pair turns on (from runs/s5b-llm-judge/data.mjs, written by the author).
  const FAQ = {
    knives: "What to bring: nothing. Aprons, knives and all ingredients are provided. Please wear closed shoes.",
    leftovers: "Leftovers: you can take home what you cook. Bring your own container; we do not sell them.",
    vegan: "Vegetarian: every class has a vegetarian version if you ask when you book. Vegan versions are only offered in the classes marked \"vegan-friendly\".",
    bread: "Class length: most classes take 3 hours; the bread class takes 4.",
    voucher: "Gift vouchers: valid 12 months from purchase, for any class. They cannot be exchanged for cash.",
    move: "Changing the date: you can move your booking to another date once, free, up to 48 hours before the class.",
    cancel: "Cancellation: cancel 48 hours or more before the class for a full refund. Cancel later than that and you get a class credit, valid 6 months. No refund or credit if you do not show up.",
    age: "Age: guests aged 12 to 15 must book with an adult who also takes the class. From 16 you can come alone.",
    allergy: "Allergies: tell us your allergies when you book. We can swap most ingredients, but the kitchen also uses nuts, gluten and dairy, so we cannot promise any dish is free of traces."
  };
  // The 12 pairs in the order the learner labels them: question (as sent), FAQ line, the human label and why.
  const PAIRS = [
    { q: 7, ask: "I'm vegan. Can I do the French bistro class?", faq: "vegan", human: "v1",
      why: "Version 2 promises a vegan version if you ask when you book. The FAQ says vegan versions exist only in classes marked vegan-friendly. Version 2 promises something the school does not offer." },
    { q: 4, ask: "Do I need to bring my own knives?", faq: "knives", human: "tie",
      why: "Both say knives are provided, as the FAQ does. Version 2 adds aprons, shoes and a friendly closing. That is true, but under the team's rule extra words earn nothing." },
    { q: 13, ask: "I already moved my booking once. Can I move it again?", faq: "move", human: "v2",
      why: "Version 1 only repeats the rule. The customer has already used the one free move, and only version 2 says so plainly: you cannot move it again for free." },
    { q: 10, ask: "How long is the bread class?", faq: "bread", human: "tie",
      why: "Both say 4 hours, as the FAQ does. Version 2 is longer, not more correct." },
    { q: 16, ask: "I missed my class yesterday without telling you. Can I get a credit?", faq: "cancel", human: "v1",
      why: "Version 2 offers \"a small discount on your next booking as a gesture of goodwill\". The FAQ has no such offer. The bot invented a promise the school would have to keep or break." },
    { q: 22, ask: "Is the bread class vegetarian?", faq: "vegan", human: "tie",
      why: "Both say there is a vegetarian version if you ask when you book. Version 2's allergy warning is true too, but it is extra, and extra earns nothing here." },
    { q: 18, ask: "Can I bring my 13-year-old son? I'll just watch, I won't cook.", faq: "age", human: "v2",
      why: "The parent said \"I'll just watch\". The FAQ says the adult must also take the class. Version 1 repeats the rule without applying it; version 2 tells him he must book himself in too." },
    { q: 6, ask: "Can I take the food I make home?", faq: "leftovers", human: "tie",
      why: "Both say yes, and both say to bring your own container. Same facts, different length." },
    { q: 17, ask: "My class is in 3 days. If I cancel now, what do I get back?", faq: "cancel", human: "v1",
      why: "3 days is 72 hours, more than 48, so the FAQ gives a full refund. Version 2 says 3 days is less than 48 hours and offers only a credit. That is wrong. Version 1 gives the rule that leads to the full refund." },
    { q: 12, ask: "Can I swap my gift voucher for cash instead?", faq: "voucher", human: "tie",
      why: "Both say no, as the FAQ does. Version 2 adds that vouchers last 12 months, which is also in the FAQ." },
    { q: 21, ask: "I want to move my class from tomorrow to next month.", faq: "move", human: "v2",
      why: "The class is tomorrow, so the free move (up to 48 hours before) is no longer possible. Version 1 repeats the rule; version 2 says plainly it cannot be moved for free, and gives the credit option instead." },
    { q: 23, ask: "Do you have a nut-free class?", faq: "allergy", human: "tie",
      why: "Both say the school cannot promise a dish free of nut traces. Version 2 also says to mention it when booking, which the FAQ says too." }
  ];
  const N = PAIRS.length;
  const NAME = { v1: "Version 1", v2: "Version 2", tie: "Tie", none: "No verdict" };
  const words = s => s.split(/\s+/).filter(Boolean).length;
  const W = PAIRS.map(p => ({ v1: words(REC[p.q].v1), v2: words(REC[p.q].v2) }));
  // A judge's raw reply -> which version it picked. order "12": v1 was Answer 1; "21": v2 was Answer 1.
  const plainV = (raw, order) => raw.trim() === "1" ? (order === "12" ? "v1" : "v2") : raw.trim() === "2" ? (order === "12" ? "v2" : "v1") : "none";
  const rubricRaw = raw => { const m = raw.match(/^Verdict: (1|2|tie)\s*$/m); return m ? m[1] : null; };
  const rubricV = (raw, order) => { const v = rubricRaw(raw); return v == null ? "none" : v === "tie" ? "tie" : plainV(v, order); };
  const V = PAIRS.map(p => {
    const r = REC[p.q];
    return { p12: plainV(r.p12, "12"), p21: plainV(r.p21, "21"), r12: rubricV(r.r12, "12"), r21: rubricV(r.r21, "21") };
  });
  const swapRule = (a, b) => a === b ? a : "tie";
  const agree = pick => PAIRS.filter((p, i) => pick(i) === p.human).length;
  const AG = {
    plain12: agree(i => V[i].p12),
    plainSwap: agree(i => swapRule(V[i].p12, V[i].p21)),
    rubric12: agree(i => V[i].r12),
    rubric21: agree(i => V[i].r21),
    rubricSwap: agree(i => swapRule(V[i].r12, V[i].r21))
  };
  const count = (arr, v) => arr.filter(x => x === v).length;
  const NUMW = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const num = n => NUMW[n] || String(n);
  const at = q => PAIRS.findIndex(p => p.q === q);
  const pairNo = q => at(q) + 1;

  const JUDGE_PLAIN = "You compare two answers from a cooking school's customer help bot. Decide which answer is better. Reply with exactly one character: 1 if the first answer is better, 2 if the second answer is better.";

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function style() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
.${P}-q { margin: 14px 0 0; font-weight: 600; color: var(--ink); }
.${P}-faq { margin: 8px 0 0; padding: 8px 12px; border-left: 3px solid var(--ink); background: var(--sunk); color: var(--ink-2); font-size: 15px; }
.${P}-faq b { display: block; font: 700 11px var(--mono); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
.${P}-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; margin-top: 12px; }
@media (max-width: 720px) { .${P}-two { grid-template-columns: minmax(0, 1fr); } }
.${P}-ans { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: var(--bg); font: 500 14px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}-h { display: block; font: 700 12px var(--font); color: var(--muted); margin-bottom: 4px; }
.${P}-cap { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.${P}-prompt { margin: 12px 0 0; border: 1px dashed var(--line); border-radius: 10px; padding: 10px 12px; font: 500 13.5px/1.55 var(--mono); color: var(--ink-2); white-space: pre-wrap; overflow-wrap: anywhere; background: var(--surface); }
.${P}-rows { margin: 14px 0 0; display: grid; gap: 6px; }
.${P}-row { display: grid; grid-template-columns: 2.2em minmax(0, 1fr) 6.2em 6.2em; gap: 8px; align-items: center; min-height: 44px; padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 14px/1.35 var(--font); text-align: left; width: 100%; }
.${P}-row.head { border: 0; min-height: 0; padding: 0 10px; background: none; font: 700 12px var(--font); color: var(--muted); }
.${P}-row.w3 { grid-template-columns: 2.2em minmax(0, 1fr) 5.6em 5.6em minmax(10em, auto); }
.${P}-row .n { font: 700 13px var(--mono); color: var(--muted); }
.${P}-row .v { font: 600 13px var(--mono); }
.${P}-rows button.${P}-row { cursor: pointer; }
.${P}-row.right { border-color: var(--good); background: var(--good-soft); }
.${P}-row.wrong { border-color: var(--bad); background: var(--bad-soft); }
.${P}-row.flip { border-color: var(--ink); border-width: 2.5px; }
.${P}-row .open { display: flex; gap: 4px; flex-wrap: wrap; }
@media (max-width: 600px) {
  .${P}-row, .${P}-row.w3 { grid-template-columns: 2em minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr); row-gap: 4px; }
  .${P}-row > span:nth-child(2) { grid-column: 2 / -1; }
  .${P}-row > span:nth-child(3) { grid-column: 2; }
  .${P}-row .open { grid-column: 2 / -1; }
}
.${P}-lines { margin: 14px 0 0; display: grid; gap: 8px; }
.${P}-lines button { display: grid; grid-template-columns: 2.6em minmax(0, 1fr); gap: 8px; align-items: start; text-align: left; min-height: 44px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 14px/1.5 var(--mono); cursor: pointer; overflow-wrap: anywhere; }
.${P}-lines button .mk { font: 700 14px var(--mono); color: var(--muted); white-space: nowrap; }
.${P}-lines button.in { border-color: var(--ink); background: var(--sunk); }
.${P}-lines button.in .mk { color: var(--ink); }
.${P}-lines button.bad { border-color: var(--bad); background: var(--bad-soft); }
.${P}-sum { margin: 12px 0 0; font: 700 18px var(--font); color: var(--ink); }
.${P}-sum small { display: block; font: 500 14px var(--font); color: var(--muted); margin-top: 2px; }
.${P}-pick { min-height: 44px; padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: 600 13px var(--font); cursor: pointer; }
.${P}-pick.right { border-color: var(--good); background: var(--good-soft); color: var(--good); }
.${P}-pick.wrong { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
.${P}-cost { margin: 12px 0 0; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 14px; }
.${P}-cost b { font-family: var(--mono); font-size: 14px; }
.${P}-cost span { color: var(--ink-2); }
`;
    document.head.appendChild(s);
  }
  const ansBox = (label, text, cut) => `<div><span class="${P}-h">${label}</span><div class="${P}-ans">${esc(text)}${cut ? " …" : ""}</div>${cut ? `<p class="${P}-cap">Cut off: this answer hit the bot's length limit.</p>` : ""}</div>`;
  const recCap = `<p class="${P}-cap">Recorded model output, ${DATE}</p>`;
  const faqBox = key => `<div class="${P}-faq"><b>The FAQ says</b>${esc(FAQ[key])}</div>`;

  /* 1. By hand: label the 12 pairs with the team's rule. */
  const OPTS1 = ["Version 1 is better", "Version 2 is better", "Tie: both correct and complete"];
  const KEY1 = ["v1", "v2", "tie"];
  function labelPairs({ el, done, kit }) {
    style();
    let k = 0, wrong = null, ok = false;
    const paint = () => {
      const p = PAIRS[k], r = REC[p.q], w = W[k], correct = KEY1.indexOf(p.human);
      const fin = ok && k === N - 1;
      let fb = "";
      if (wrong != null) {
        const pick = KEY1[wrong];
        fb = kit.feedback(p.human === "tie"
          ? `Check both against the FAQ line: both are correct and both answer the question. ${NAME[pick]} is ${pick === "v2" ? `longer (${w.v2} words against ${w.v1})` : `shorter (${w.v1} words against ${w.v2})`}, but the team's rule says length and warmth do not count. This one is a tie.`
          : pick === "tie"
            ? `Not a tie: one answer fails the rule. ${p.why}`
            : `Look again at the FAQ line. ${p.why}`, false);
      } else if (ok) {
        fb = kit.feedback(`${p.human === "tie" ? "Tie." : `${NAME[p.human]}.`} ${p.why}${fin ? ` That was the last pair. Your labels: version 1 better in ${num(count(PAIRS.map(x => x.human), "v1"))}, version 2 better in ${num(count(PAIRS.map(x => x.human), "v2"))}, ties in ${num(count(PAIRS.map(x => x.human), "tie"))}.` : ""}`, true);
      }
      el.innerHTML = `<h1>Two FAQ bots, one question each</h1>
        <p class="lead">A cooking-class booking site has an FAQ bot. The team wrote version 2: warmer and more thorough, with tips. Before switching, they want to know if it is better. Later a model will judge the same pairs; your labels are what you check that model against. The team's rule for <b>better</b>: the answer is correct against the FAQ, and it answers this customer's question, including the FAQ condition that applies to this customer. Harmless extra wording is fine. A wrong fact, or a promise the FAQ does not make, is a fault. If both answers pass, it is a tie. Length and warmth do not count.</p>
        <p class="task">Label all ${N} pairs with the team's rule. Pair ${k + 1} of ${N}.</p>
        <p class="${P}-q">Customer: ${esc(p.ask)}</p>
        ${faqBox(p.faq)}
        <div class="${P}-two">${ansBox(`Version 1 · ${w.v1} words`, r.v1)}${ansBox(`Version 2 · ${w.v2} words`, r.v2, r.v2cut)}</div>
        <p class="${P}-cap">Both versions are the same small hosted model. Version 1 was told to use only the FAQ and answer in one short sentence; version 2 just to use the FAQ, and to give a warm, thorough answer with helpful tips. Recorded model output, ${DATE}.</p>
        <div class="lpanel">${kit.options(OPTS1, { picked: ok ? correct : wrong, correct })}${fb}
        ${ok && !fin ? `<div class="lsteps"><button type="button" class="btn" id="${P}-next">Next pair</button></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (ok) return;
        const i = +b.dataset.i;
        if (i === correct) { ok = true; wrong = null; } else wrong = i;
        paint();
        if (ok && k === N - 1) done();
      });
      const nx = el.querySelector(`#${P}-next`);
      if (nx) nx.onclick = () => { k++; ok = false; wrong = null; paint(); el.scrollIntoView && el.scrollIntoView({ block: "start" }); };
    };
    paint();
  }

  /* 2. Broken on purpose: the plain judge's report says "ship version 2". Find the picks that break the FAQ. */
  const BAD2 = PAIRS.map((p, i) => p.human === "v1" && V[i].p12 === "v2" ? p.q : null).filter(x => x != null);
  function report({ el, done, kit }) {
    style();
    const found = new Set();
    let wrong = null;
    const v2wins = count(V.map(v => v.p12), "v2");
    const paint = () => {
      const fin = BAD2.every(q => found.has(q));
      const rows = PAIRS.map((p, i) => {
        const cls = found.has(p.q) ? "right" : wrong === p.q ? "wrong" : "";
        return `<button type="button" class="${P}-row ${cls}" data-i="${p.q}"><span class="n">${i + 1}</span><span>${esc(p.ask)}</span><span class="v">${NAME[p.human]}</span><span class="v">${NAME[V[i].p12]}</span></button>`;
      }).join("");
      let fb = "";
      if (wrong != null) {
        const i = at(wrong), p = PAIRS[i];
        fb = kit.feedback(p.human === "tie"
          ? `Pair ${i + 1}: you said tie, so the judge disagrees with you, but the answer it picked is correct. A wrong preference, not a broken fact. Look for rows where you picked version 1.`
          : `Pair ${i + 1}: here the judge agrees with you. Version 2 really is the better answer.`, false);
      } else if (fin) {
        fb = kit.feedback(`Found all ${num(BAD2.length)}: pairs ${BAD2.map(pairNo).join(", ")}. In each, version 2 broke the FAQ (a vegan version that does not exist, an invented discount, a wrong refund), and the judge still picked it. It had no FAQ, so it could not check a single fact. Its "${v2wins} of ${N}" says nothing about quality yet. It agrees with your labels on only ${num(AG.plain12)} of ${N} pairs.`, true);
      } else if (found.size) {
        fb = kit.feedback(`Pair ${pairNo([...found].pop())}: yes, the judge picked the answer that breaks the FAQ. ${BAD2.length - found.size} more.`);
      }
      el.innerHTML = `<h1>The judge says: ship version 2</h1>
        <p class="lead">To avoid labelling thousands of chats by hand, the team asked a model to judge the answers: an <b>LLM judge</b>. For each pair it sent this prompt, then the question with version 1 as "Answer 1" and version 2 as "Answer 2". Report: <b>version 2 wins ${v2wins} of ${N}</b>.</p>
        <div class="${P}-prompt">${esc(JUDGE_PLAIN)}</div>
        <p class="task">Compare the judge with your labels. Tap the pairs where the judge picked an answer that breaks the FAQ.</p>
        <div class="${P}-rows"><div class="${P}-row head"><span>#</span><span>Customer question</span><span>You</span><span>Judge</span></div>${rows}</div>
        <p class="${P}-cap">Judge verdicts: recorded model output, ${DATE} (a small hosted model, temperature 0).</p>
        <div class="lpanel">${fb}</div>`;
      el.querySelectorAll(`button.${P}-row`).forEach(b => b.onclick = () => {
        const q = +b.dataset.i;
        if (fin) return;
        if (BAD2.includes(q)) { found.add(q); wrong = null; } else wrong = q;
        paint();
        if (BAD2.every(x => found.has(x))) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: version 2 was both second and longer. Which run separates the two? */
  function spot({ el, done, kit }) {
    style();
    let ans = null;
    const correct = 1;
    const opts = [
      "Send the same 12 requests again.",
      "Send them again with the answers swapped: version 2 as Answer 1.",
      "Ask a larger model to judge the same 12 requests.",
      "Ask the judge to explain each choice."
    ];
    const minV2 = Math.min(...W.map(w => w.v2)), maxV1 = Math.max(...W.map(w => w.v1));
    const flips = PAIRS.filter((p, i) => V[i].p12 !== V[i].p21);
    const v2swapped = count(V.map(v => v.p21), "v2");
    const paint = () => {
      const ok = ans === correct;
      const rows = ok ? PAIRS.map((p, i) => {
        const flip = V[i].p12 !== V[i].p21;
        return `<div class="${P}-row ${flip ? "flip" : ""}"><span class="n">${i + 1}</span><span>${esc(p.ask)}</span><span class="v">${NAME[V[i].p12]}</span><span class="v">${NAME[V[i].p21]}</span></div>`;
      }).join("") : "";
      el.innerHTML = `<h1>Second, and longer</h1>
        <p class="lead">The judge answered "2" in all ${N} requests. But version 2 was always in the second place, and always the longer answer: at least ${minV2} words, while version 1 never passed ${maxV1}. So there are two possible causes for the "2": the place, or the answer. Every request mixes them.</p>
        <p class="task">Which one extra run tells you whether the judge follows the place or the answer?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok ? kit.feedback(`Right. Swapping is the test. Here is the recorded swapped run: version 2 still won ${v2swapped} of ${N}, now from the first place. So the main pull was the answer itself, the long and warm one. This is <b>length bias</b> (also called verbosity bias): the judge prefers longer answers whether or not they are better. Pair ${flips.map(p => pairNo(p.q)).join(", ")} flipped: there the judge said "2" in both orders, so the place decided, not the answer. That is <b>position bias</b>. Which place wins depends on the judge and the prompt. The study that described both biases found most judges it tested favoured the first place; in this run, with this prompt, this judge leaned to the second.`, true)
          : ans === 0 ? kit.feedback("At temperature 0 the same requests will most likely give the same verdicts. And even if one changed, version 2 would still be second and still longer. The two causes stay mixed.", false)
          : ans === 2 ? kit.feedback("A different judge gives different verdicts, but version 2 is still second and still longer in every request. You would still not know which of the two drove the verdict.", false)
          : kit.feedback("An explanation is more text the judge writes, not a test. Version 2 is still second and longer in every request, so the two causes stay mixed.", false)}
        ${ok ? `<div class="${P}-rows"><div class="${P}-row head"><span>#</span><span>Customer question</span><span>v1 first</span><span>v2 first</span></div>${rows}</div><p class="${P}-cap">Judge verdicts, mapped back to the versions: recorded model output, ${DATE}. The ringed row changed when the order changed.</p>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Write the judge prompt: pick the lines that go in. The right set is the prompt that was recorded. */
  const LINES = [
    { id: "faq", t: "The school's FAQ below is the only truth. [the 11 FAQ lines follow]", in: true,
      yes: "In. The plain judge had no FAQ, so it could not tell a false promise from a true one. With the FAQ in the prompt it has a reference to check against. The study that described these biases calls this a reference-guided judge." },
    { id: "correct", t: "1. Correct: every claim agrees with the FAQ. A claim that contradicts the FAQ, or that the FAQ does not contain, is a serious fault.", in: true,
      yes: "In. This is the first half of the team's rule, written so the judge can apply it to each claim." },
    { id: "complete", t: "2. Complete: it answers the question that was asked, including the condition from the FAQ that applies to this customer.", in: true,
      yes: `In. The second half of the rule: it catches answers like version 1 in pair ${pairNo(13)}, true but not an answer to what was asked.` },
    { id: "long", t: "Prefer the answer that is more detailed and helpful.", in: false,
      no: "Leave this out. This line writes length bias into the prompt: \"more detailed\" rewards exactly what fooled the plain judge. Your rule says length does not count." },
    { id: "length", t: "3. Length and friendliness are not quality. Do not prefer an answer because it is longer, warmer or has more tips.", in: true,
      yes: "In. The team's rule says length does not count, so the judge has to be told this directly." },
    { id: "only", t: "Reply with exactly one character: 1 or 2.", in: false,
      no: "Leave this out. This is the plain judge's format. It forces a winner when half of your labels were ties, and leaves no room to check a claim before deciding." },
    { id: "expert", t: "You are a world-class expert judge with perfect taste.", in: false,
      no: "Leave this out. A title does not say what to check. Keep only lines you could point to when a verdict turns out wrong." },
    { id: "verdict", t: "First write one or two sentences of reasoning. Then write a last line that is exactly \"Verdict: 1\", \"Verdict: 2\" or \"Verdict: tie\".", in: true,
      yes: "In. Reasoning first, then a fixed last line that code can read, and a tie is allowed. Anthropic's guide to LLM grading gives the same three tips: a clear rubric, a specific output, reasoning before the score." }
  ];
  function buildPrompt({ el, done, kit }) {
    style();
    const on = new Set();
    let last = null;
    const paint = () => {
      const fin = LINES.every(l => on.has(l.id) === l.in);
      const lines = LINES.map((l, i) => {
        const isOn = on.has(l.id);
        return `<button type="button" class="${isOn ? (l.in ? "in" : "in bad") : ""}" data-i="${l.id}" aria-pressed="${isOn}"><span class="mk">${isOn ? "[x]" : "[ ]"}</span><span>${esc(l.t)}</span></button>`;
      }).join("");
      let fb = "";
      if (last) {
        const l = LINES.find(x => x.id === last.id);
        if (last.added) fb = kit.feedback(l.in ? l.yes : l.no, l.in ? undefined : false);
        else fb = kit.feedback(l.in ? `You took out a line the team needs. ${l.yes.replace(/^In\. /, "")}` : "Taken out. Good.", l.in ? false : undefined);
      }
      if (fin) fb = kit.feedback(`That is the judge prompt the team ran: FAQ, rubric, "length is not quality", reasoning, then a verdict line with tie allowed. Its user message is the same as before: the question, Answer 1, Answer 2. Next you see what it did.`, true);
      el.innerHTML = `<h1>Write the judge a rubric</h1>
        <p class="lead">The plain judge was asked "which is better?" with nothing to check against. A <b>rubric</b> writes your rule down for the judge, step by step. Here are ${LINES.length} candidate lines.</p>
        <p class="task">Tap lines to put them in or take them out. Build the prompt that applies the team's rule and does not bring back the problems you found.</p>
        <div class="${P}-lines">${lines}</div>
        <div class="lpanel">${fb}</div>`;
      el.querySelectorAll(`.${P}-lines button`).forEach(b => b.onclick = () => {
        const id = b.dataset.i;
        if (on.has(id)) { on.delete(id); last = { id, added: false }; } else { on.add(id); last = { id, added: true }; }
        paint();
        if (LINES.every(l => on.has(l.id) === l.in)) done();
      });
    };
    paint();
  }

  /* 5. Predict: the rubric judge in both orders. */
  const PRED = [7, 6];
  function predict({ el, done, kit }) {
    style();
    let k = 0, wrong = null, ok = false;
    const r12all = PAIRS.map(p => rubricRaw(REC[p.q].r12)), r21all = PAIRS.map(p => rubricRaw(REC[p.q].r21));
    const all = [...r12all, ...r21all];
    const firstN = count(all, "1"), secondN = count(all, "2"), tieN = count(all, "tie"), noneN = count(all, null);
    const paint = () => {
      const q = PRED[k], i = at(q), p = PAIRS[i], r = REC[q];
      const real = V[i].r21, opts = ["Version 1", "Version 2", "Tie"], correct = ["v1", "v2", "tie"].indexOf(real);
      const fin = ok && k === PRED.length - 1;
      let fb = "";
      if (wrong != null) {
        fb = kit.feedback(q === 7
          ? `With the FAQ in the prompt the judge can see that version 2's vegan promise breaks it, wherever it stands. A real fault does not move with the order. Try again.`
          : `Both answers are correct here, so the rubric gives no reason to prefer either. When nothing in the answers decides, something else can: the place. Try again.`, false);
      } else if (ok) {
        fb = kit.feedback(q === 7
          ? `Right: version 1 in both orders. The judge found the broken promise each time. The order did not change the verdict, so the place did not decide it.`
          : `Right: in both orders it said "Verdict: 1", the first place, so it picked version 1 and then version 2. The rubric fixed length bias, but position bias is still there. With the new prompt the lean moved to the first place: across all ${N * 2} rubric verdicts it chose the first place ${firstN} times, the second ${secondN} times, tie ${tieN} times${noneN ? `, and ${num(noneN)} reply ran out of room before its verdict line` : ""}.`, true);
      }
      el.innerHTML = `<h1>Predict the swap</h1>
        <p class="lead">The rubric judge, run on pair ${i + 1} (${esc(p.ask)}). Your label: <b>${NAME[p.human]}</b>. With version 1 as Answer 1, it replied:</p>
        <div class="${P}-ans">${esc(r.r12)}</div>${recCap}
        <p class="task">${k === 0 ? "" : "Second case. "}Now the same pair with version 2 as Answer 1. Which version will the judge pick?</p>
        <div class="lpanel">${kit.options(opts, { picked: ok ? correct : wrong, correct })}${fb}
        ${ok ? `<p class="${P}-cap">With version 2 as Answer 1 it replied:</p><div class="${P}-ans">${esc(r.r21)}</div>${recCap}` : ""}
        ${ok && !fin ? `<div class="lsteps"><button type="button" class="btn" id="${P}-next">Next case</button></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (ok) return;
        const j = +b.dataset.i;
        if (j === correct) { ok = true; wrong = null; } else wrong = j;
        paint();
        if (ok && k === PRED.length - 1) done();
      });
      const nx = el.querySelector(`#${P}-next`);
      if (nx) nx.onclick = () => { k++; ok = false; wrong = null; paint(); };
    };
    paint();
  }

  /* 6. Apply the swap rule to the open rows, then compare agreement for the three setups. */
  const OPEN = [4, 13, 17, 18];
  function swapRuleScreen({ el, done, kit }) {
    style();
    const pick = {}, bad = {};
    let lastBad = null;
    const paint = () => {
      const fin = OPEN.every(q => pick[q] === swapRule(V[at(q)].r12, V[at(q)].r21));
      const rows = PAIRS.map((p, i) => {
        const v = V[i], c = swapRule(v.r12, v.r21), open = OPEN.includes(p.q);
        const cell = !open ? `<span class="v">${NAME[c]}</span>`
          : pick[p.q] === c ? `<span class="v">${NAME[c]}</span>`
          : `<span class="open" id="r${p.q}">${["v1", "v2", "tie"].map(x => `<button type="button" class="${P}-pick ${bad[p.q] === x ? "wrong" : ""}" data-v="${x}" ${x === c ? "data-right" : ""}>${x === "tie" ? "Tie" : x}</button>`).join("")}</span>`;
        return `<div class="${P}-row w3 ${open && pick[p.q] === c ? "right" : ""}"><span class="n">${i + 1}</span><span>${esc(p.ask)}</span><span class="v">${NAME[v.r12]}</span><span class="v">${NAME[v.r21]}</span>${cell}</div>`;
      }).join("");
      let fb = "";
      if (lastBad != null && bad[lastBad] && pick[lastBad] !== swapRule(V[at(lastBad)].r12, V[at(lastBad)].r21)) {
        const v = V[at(lastBad)], b = bad[lastBad];
        fb = kit.feedback(v.r12 === v.r21
          ? `Pair ${pairNo(lastBad)}: both orders say ${NAME[v.r12]}. When the two runs agree, the rule keeps that verdict, even if you suspect it.`
          : v.r21 === "none" || v.r12 === "none"
            ? `Pair ${pairNo(lastBad)}: one run has no verdict, so the two runs do not agree. The rule makes it a tie, and you flag the missing verdict. You do not quietly keep the one run you have: one order alone is the setup that misled you before.`
            : `Pair ${pairNo(lastBad)}: the runs say ${NAME[v.r12]} and ${NAME[v.r21]}. They disagree, so the order decided, not the answers. The rule makes that a tie${b === "tie" ? "" : `, not ${NAME[b]}`}.`, false);
      }
      if (fin) {
        const miss = PAIRS.filter((p, i) => swapRule(V[i].r12, V[i].r21) !== p.human);
        fb = `${kit.meter([
          { label: "Plain judge, one order", value: AG.plain12, max: N },
          { label: "Rubric judge, one order", value: AG.rubric12, max: N },
          { label: "Rubric judge, both orders + swap rule", value: AG.rubricSwap, max: N, good: true }
        ])}${kit.feedback(`Pairs that match your labels, out of ${N}. This number is the judge's <b>agreement</b> with human labels, and it is how you decide whether to trust a judge at all. The ${num(miss.length)} misses: ${miss.map(p => `pair ${pairNo(p.q)} (${NAME[swapRule(V[at(p.q)].r12, V[at(p.q)].r21)].toLowerCase()} against your ${NAME[p.human].toLowerCase()})`).join(", ")}. In pair ${pairNo(17)}, the first run made the same mistake as version 2 ("3 days, less than 48 hours"). The study on judges saw this too: a judge can copy the mistake in the answer it grades. The swap rule removes the effect of the place. It cannot fix a judge that is wrong in both orders, as in pair ${pairNo(18)}. That label is the closest call of the twelve, though: version 1's rule implies the parent must cook too; it just does not say so to him.`, true)}`;
      }
      el.innerHTML = `<h1>The swap rule</h1>
        <p class="lead">Run every pair twice, once in each order. The <b>swap rule</b>: if both runs pick the same version, that is the verdict. If they disagree, or one has no verdict, it is a tie. In the table, "v1 first" is the rubric judge's pick when version 1 was Answer 1; "v2 first" is its pick when version 2 was Answer 1.</p>
        <p class="task">Apply the rule to the ${num(OPEN.length)} open rows (the rows with buttons).</p>
        <div class="${P}-rows"><div class="${P}-row w3 head"><span>#</span><span>Customer question</span><span>v1 first</span><span>v2 first</span><span>Rule</span></div>${rows}</div>
        <p class="${P}-cap">Rubric judge verdicts, mapped back to the versions: recorded model output, ${DATE}.</p>
        <div class="lpanel">${fb}</div>`;
      el.querySelectorAll(".open").forEach(o => o.querySelectorAll("button").forEach(b => b.onclick = () => {
        const q = +o.id.slice(1), x = b.dataset.v, c = swapRule(V[at(q)].r12, V[at(q)].r21);
        if (x === c) { pick[q] = x; delete bad[q]; lastBad = null; } else { bad[q] = x; lastBad = q; }
        paint();
        if (OPEN.every(z => pick[z] === swapRule(V[at(z)].r12, V[at(z)].r21))) done();
      }));
    };
    paint();
  }

  /* 7. The same rule in Python: a recorded run of judge_eval.py, traced on four pairs. */
  const CODE = [
    "def agreement(run_12, run_21, human):",
    "    agree = 0",
    "    for pair in human:",
    "        a = run_12[pair]",
    "        b = run_21[pair]",
    "        verdict = a if a == b else \"tie\"",
    "        if verdict == human[pair]:",
    "            agree += 1",
    "    return agree"
  ];
  // From docs/ai-path/runs/s5b-llm-judge/judge_eval.out.txt: the traced steps, as [line, agree, pair, a, b, verdict]
  // Each step: about to run listing line `line`, with the variables as they are at that moment (null = not set yet,
  // "None" = Python None: no verdict was found). "ret" = the return event.
  const TRACE = [
    [1, null, null, null, null, null],
    [2, 0, null, null, null, null],
    [3, 0, "q06", null, null, null],
    [4, 0, "q06", "v1", null, null],
    [5, 0, "q06", "v1", "v2", null],
    [6, 0, "q06", "v1", "v2", "tie"],
    [7, 0, "q06", "v1", "v2", "tie"],
    [2, 1, "q06", "v1", "v2", "tie"],
    [3, 1, "q07", "v1", "v2", "tie"],
    [4, 1, "q07", "v1", "v2", "tie"],
    [5, 1, "q07", "v1", "v1", "tie"],
    [6, 1, "q07", "v1", "v1", "v1"],
    [7, 1, "q07", "v1", "v1", "v1"],
    [2, 2, "q07", "v1", "v1", "v1"],
    [3, 2, "q17", "v1", "v1", "v1"],
    [4, 2, "q17", "v2", "v1", "v1"],
    [5, 2, "q17", "v2", "None", "v1"],
    [6, 2, "q17", "v2", "None", "tie"],
    [2, 2, "q17", "v2", "None", "tie"],
    [3, 2, "q21", "v2", "None", "tie"],
    [4, 2, "q21", "v2", "None", "tie"],
    [5, 2, "q21", "v2", "v1", "tie"],
    [6, 2, "q21", "v2", "v1", "tie"],
    [2, 2, "q21", "v2", "v1", "tie"],
    [8, 2, "q21", "v2", "v1", "tie"],
    ["ret", 2, "q21", "v2", "v1", "tie"]
  ];
  const HUM4 = { q06: "tie", q07: "v1", q17: "v1", q21: "v2" };
  const OUT = ["plain, v1 first only:       3", "plain, both orders + rule:  3", "rubric, v1 first only:      5", "rubric, v2 first only:      5", "rubric, both orders + rule: 9"];
  const SAY = (s, prev) => {
    const [ln, ag, pair, a, b, v] = s;
    const show = x => x === "None" ? "None" : `"${x}"`;
    if (ln === "ret") return `It returns ${ag}: on these four pairs the rule agrees with the human labels twice. The same script, run on all ${N} pairs, printed the lines below; they match the counts on the previous screen.`;
    if (ln === 0 || ln === 1) return "<code>run_12</code> (version 1 shown first) and <code>run_21</code> (version 2 shown first) are dicts: pair → the version the judge picked, already mapped back from \"Answer 1\" or \"Answer 2\". <code>human</code> holds your labels. The highlighted line runs next.";
    if (ln === 2 && pair == null) return "<code>agree</code> is 0. The loop starts.";
    if (ln === 2) return prev && prev[0] === 7 ? `That was a match, so <code>agree</code> is now ${ag}. Next pair.` : `${show(v)} is not your label ${show(HUM4[pair])}, so <code>agree</code> stays ${ag}. Next pair.`;
    if (ln === 3) return `<code>pair</code> is ${pair}; your label for it is ${show(HUM4[pair])}. Next: read the run with version 1 first. (<code>a</code>, <code>b</code> and <code>verdict</code> still hold the last pair's values.)`;
    if (ln === 4) return `<code>a</code> is ${show(a)}. Next: the swapped run.`;
    if (ln === 5) return `<code>b</code> is ${show(b)}.${b === "None" ? " That run hit its token limit before the verdict line, so the parser found no verdict." : ""} Next: the swap rule.`;
    if (ln === 6) return `${show(a)} and ${show(b)} ${a === b ? "agree, so the verdict is that version" : "do not agree, so the verdict is a tie"}: ${show(v)}. Next: compare it with your label, ${show(HUM4[pair])}.`;
    if (ln === 7) return `${show(v)} matches your label, so add one.`;
    if (ln === 8) return "No pairs left. Return the count.";
    return "";
  };
  function asPython({ el, done, kit }) {
    style();
    let i = 0;
    const paint = () => {
      const s = TRACE[i], [ln, ag, pair, a, b, v] = s;
      const show = x => x == null ? "–" : x;
      el.innerHTML = `<h1>The swap rule in Python</h1>
        <p class="lead">The team's eval script reads both runs, applies the swap rule and counts agreement with the human labels. This is a recorded run of that function on four of the pairs, replayed step by step. The keys are question ids: q06, q07, q17 and q21 are pairs ${[6, 7, 17, 21].map(pairNo).join(", ")} in the swap table.</p>
        <p class="task">Step through to the end. Watch what happens at the pair with no verdict.</p>
        ${kit.code(CODE, ln === "ret" ? 8 : ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>pair <b>${show(pair)}</b></span><span>a <b>${show(a)}</b></span><span>b <b>${show(b)}</b></span><span>verdict <b>${show(v)}</b></span><span>agree <b>${show(ag)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(SAY(s, TRACE[i - 1]))}
        ${ln === "ret" ? `<pre class="lcode">${OUT.map(o => `<div>${esc(o)}</div>`).join("")}</pre><p class="${P}-cap">Output of <code>python3 judge_eval.py</code>, run on ${DATE}.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. Task: pick the situation that calls for a judge. */
  const TOK_P = PAIRS.reduce((s, p) => s + REC[p.q].tok.p, 0) / 2, TOK_R = PAIRS.reduce((s, p) => s + REC[p.q].tok.r, 0) / 2;
  function bigPicture({ el, done, kit }) {
    style();
    let ans = null;
    const correct = 1;
    const ratio = TOK_R / TOK_P, total = TOK_R * 2 / TOK_P;
    const opts = [
      "Check that every bot reply is under 80 words and contains the booking link.",
      "Compare how two bot versions handle upset customers, across 3,000 recorded chats.",
      "Decide whether the new refund policy text is legally safe to publish."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to use a judge</h1>
        <p class="lead">An LLM judge is a model that grades other answers with your written rule, so you do not have to label every answer by hand.</p>
        <div class="${P}-cost">
          <b>For</b><span>Comparing open-ended answers at scale, where no code can check them: correctness against a document, tone, helpfulness.</span>
          <b>When</b><span>You can write the rule down, you can hand the judge a reference, and you have a small human-labelled sample to measure agreement on. Here the judge was the same small model that wrote both answers; in real work use a different grader model, because a judge can favour answers like its own.</span>
          <b>Not when</b><span>An exact check exists (a format, a number, a test that passes): use code, which is faster and unbiased. Not as the last word on high-stakes calls: people decide there.</span>
          <b>Costs</b><span>Here the rubric prompt used about ${ratio.toFixed(1)} times the input tokens of the plain one per call, and both orders double the calls: about ${total.toFixed(1)} times the input tokens in all, and it writes a few sentences instead of one character. Plus the human labels, redone when the judge model changes.</span>
        </div>
        <p class="task">Which of these calls for an LLM judge?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct ? kit.feedback("Right. \"Handles upset customers well\" has no exact check, and 3,000 chats is too many to label by hand. Write the rubric, run both orders, and measure agreement on a sample you label first.", true)
          : ans === 0 ? kit.feedback("Word count and a link are exact checks. A few lines of code do them on every reply, for free, with no length or position bias.", false)
          : kit.feedback("Legal safety is a high-stakes call that needs expertise and someone accountable. A judge could pre-sort at most; a lawyer decides.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where a judge is the wrong tool. */
  const CASES = [
    ["A recipe app turns a list of ingredients into cooking steps. You want to know which of two prompts gives clearer steps, over 400 recipes.", true,
      "Yes. Clarity has no exact check. Write a rubric for clear steps, run each pair in both orders, and first check the judge against a small set you label yourself.",
      "There is no code check for \"clearer\", and 400 pairs is a lot to label by hand. This is the judge's job: a rubric, both orders, and agreement with a sample you label."],
    ["A support bot must reply with an order number in the form AB-12345.", false,
      "No. A regular expression checks the form on every reply, exactly and for free. A judge would add cost and bias to a question code answers perfectly.",
      "The form AB-12345 is an exact rule. A regular expression checks it on every reply, exactly and for free; a judge can only add cost and bias."],
    ["A SQL assistant writes queries. You want to know if each query returns the right rows from a test database.", false,
      "No. Run each query on the test database and compare the rows with the expected rows. A judge reading the SQL can be fooled by a query that looks right and returns the wrong rows.",
      "You can run the query and compare its rows with the expected ones: an exact check. A judge only reads the SQL, and a query can look right and still return the wrong rows."],
    ["A travel site's bot summarises hotel reviews. You want to know if the summaries say only what the reviews say.", true,
      "Yes. The reviews are the reference, like the FAQ. Give the judge the reviews and a rubric, run both orders, and measure agreement with your labels first.",
      "No code can check meaning against the reviews, but a judge can if you give it the reviews as the reference, like the FAQ. Rubric, both orders, agreement with your labels."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Judge, or something else?</h1>
        <p class="lead">${CASES.length} situations. "Judge" means a model with a rubric, run in both orders, checked against human labels.</p>
        <p class="task">Would a judge be the right tool? Decide for each. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes, a judge", "No, something else"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (in-page practice: the lesson was the practice). */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">Before you trust a judge's win rate:</p>
      <div class="${P}-cost">
        <b>Label</b><span>a small sample yourself, with the rule written down.</span>
        <b>Rubric</b><span>the reference, the rule step by step, "length is not quality", reasoning, then a fixed verdict line with tie allowed.</span>
        <b>Swap</b><span>run both orders; disagreement or a missing verdict is a tie, and you flag it.</span>
        <b>Agree</b><span>measure agreement with your labels. Here: ${AG.plain12} of ${N} for the plain judge, ${AG.rubricSwap} of ${N} with the fixes.</span>
      </div>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. A judge's score on a small set like these ${N} pairs moves when a few verdicts change. Next you learn to tell a real gain from noise.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "LLM-as-judge and its biases",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/2306.05685",
      "https://arxiv.org/abs/2404.04475",
      "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"
    ],
    interview: [{
      q: "Your team's LLM judge says the new prompt wins 70% of pairwise comparisons against the old one, and your manager wants to ship today. What do you check first?",
      good: [
        "Run every pair in both orders and keep only verdicts that agree; mixed verdicts become ties, because judges have position bias",
        "Check whether the judge simply prefers the longer answer, and put \"length is not quality\" in the rubric",
        "Label a small sample by hand and measure the judge's agreement with those labels before trusting its win rate",
        "Give the judge the reference (the docs or FAQ) and a rubric, and ask for short reasoning before a fixed verdict line",
        "Check the sample size: on a small set, like 12 pairs, a few flipped verdicts move the score a lot"
      ],
      weak: "Trust the 70% because the judge is a strong model, or switch to a bigger judge, without checking order, length or agreement with human labels."
    }, {
      q: "You need to check that your RAG bot's answers stay within the retrieved documents, and that every answer is valid JSON. Which parts do you give an LLM judge?",
      good: [
        "JSON validity goes to code: parse it and check the schema, exactly and for free",
        "Staying within the documents has no exact check, so a judge gets it, with the documents as the reference and a claim-by-claim rubric",
        "Before relying on the judge, measure its agreement with a sample labelled by people",
        "Budget for it: every judged answer is another model call"
      ],
      weak: "Use the LLM judge for everything because it is flexible, including checks that code does exactly."
    }],
    screens: [labelPairs, report, spot, buildPrompt, predict, swapRuleScreen, asPython, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: PAIRS.flatMap((_, i) => i < N - 1 ? ["[data-right]", `#${P}-next`] : ["[data-right]"]) },
      { wrong: [`[data-i="${PAIRS.find(p => p.human === "tie").q}"]`], right: BAD2.map(q => `[data-i="${q}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="long"]'], right: ['[data-i="long"]', ...LINES.filter(l => l.in).map(l => `[data-i="${l.id}"]`)] },
      { wrong: ["[data-wrong]"], right: PRED.flatMap((_, i) => i < PRED.length - 1 ? ["[data-right]", `#${P}-next`] : ["[data-right]"]) },
      { wrong: [`#r${OPEN[2]} button:not([data-right])`], right: OPEN.map(q => `#r${q} [data-right]`) },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
