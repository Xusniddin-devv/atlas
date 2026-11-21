/* Lesson: planning first, then acting, and replanning. Story: a travel desk assistant books a three-city work
   trip (Munich, Vienna, Prague, Berlin, home) and one train is cancelled while the plan runs.
   Ideas: (1) plan-then-execute: one model call writes the whole step list, plain code runs it, and the model is
   asked again only when a result breaks the plan (the plan is "stale"); (2) a replan starts from what is done,
   must re-check every step against the request (done steps included), and is capped by max_replans.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5b-agent-planning/: f-plan-1 (the planner), f-replan-1 (the
     plain replanner), g-replan-1 (the careful replanner), all from a larger hosted model; plan-1 (a smaller hosted
     model's plan, used only for the two wrong cards on screen 1);
   - docs/ai-path/runs/s5b-agent-planning/: travel_tools.py (timetable, hotels, prompts), agent.py (plan_and_execute,
     live and replay), naive.py + naive.out.txt (the plan run with no replanning), live_run.out.txt (with f-replan-1),
     careful_run.out.txt (with g-replan-1), replay_trace.out.txt and replay_trace0.out.txt (line traces of
     plan_and_execute with max_replans 2 and 0).
   Lesson-local style: plan list, run rows and a transcript caption (.lx-s5b-agent-planning-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s5b-agent-planning";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = d => { const x = new Date(d + "T00:00:00Z"); return `${DAYS[x.getUTCDay()]} ${x.getUTCDate()} Nov`; };
  const nights = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s5b-agent-planning/travel_tools.py (REQUEST)
  const REQUEST = "Please book my work trip. I live in Munich. Vienna conference: Monday 23 November 2026, 13:00, to Tuesday 24 November, 17:00. Prague workshop: Wednesday 25 November, 14:00 to 17:00. Berlin client meeting: Thursday 26 November, 13:00 to 15:00. I want to be back home in Munich on Thursday night. Trains only, and a hotel for every night I am away. Send me the itinerary when everything is booked.";
  const CONF_END = REQUEST.match(/Tuesday 24 November, (\d\d:\d\d)/)[1];
  const WORKSHOP_START = REQUEST.match(/Prague workshop: Wednesday 25 November, (\d\d:\d\d)/)[1];
  // travel_tools.py REPLANNER_SYSTEM_CAREFUL: the sentence added to the replanner's instructions
  const CAREFUL_RULE = "Every time in the request is a hard limit: arrive before each event starts, leave after it ends. Check each new step against those times, and also check the bookings already made: if the new route makes one of them wrong, cancel it and book what fits. Add a short \"why\" to each step.";

  // From docs/ai-path/recordings/s5b-agent-planning/f-plan-1.json (the JSON reply, one step per line, not altered)
  const REC_PLAN = {
    src: "s5b-agent-planning/f-plan-1", provider: "openrouter", model: "google/gemini-2.5-flash", recordedAt: "2026-11-13",
    promptTokens: 346, outTokens: 482,
    steps: [
      { tool: "book_train", args: { from_city: "Munich", to_city: "Vienna", date: "2026-11-23", arrive_by: "12:00" } },
      { tool: "book_hotel", args: { city: "Vienna", check_in: "2026-11-23", check_out: "2026-11-25" } },
      { tool: "book_train", args: { from_city: "Vienna", to_city: "Prague", date: "2026-11-25", arrive_by: "13:00" } },
      { tool: "book_hotel", args: { city: "Prague", check_in: "2026-11-25", check_out: "2026-11-26" } },
      { tool: "book_train", args: { from_city: "Prague", to_city: "Berlin", date: "2026-11-26", arrive_by: "12:00" } },
      { tool: "book_train", args: { from_city: "Berlin", to_city: "Munich", date: "2026-11-26", depart_after: "15:00" } },
      { tool: "send_itinerary", args: {} }
    ]
  };
  // From docs/ai-path/recordings/s5b-agent-planning/plan-1.json (a smaller model's plan): its steps 3 and 6
  const REC_LITE_WRONG = [
    { tool: "book_train", args: { from_city: "Vienna", to_city: "Prague", date: "2026-11-24", arrive_by: "14:00" } },
    { tool: "book_hotel", args: { city: "Berlin", check_in: "2026-11-25", check_out: "2026-11-26" } }
  ];
  // Results of running f-plan-1 with no replanning: docs/ai-path/runs/s5b-agent-planning/naive.out.txt
  const NAIVE = [
    { booking_id: "T-101", train: "RJ 61", from: "Munich", to: "Vienna", date: "2026-11-23", departs: "06:20", arrives: "10:20" },
    { booking_id: "H-102", hotel: "Hotel Naschmarkt", city: "Vienna", check_in: "2026-11-23", check_out: "2026-11-25" },
    { error: "RJ 71 (06:10 to 10:18) is cancelled (track works). No train from Vienna to Prague on 2026-11-25 arrives by 13:00.", other_trains_on_this_route: ["2026-11-24 RJ 77 16:10 to 20:18", "2026-11-24 RJ 79 18:10 to 22:18", "2026-11-25 RJ 73 10:10 to 14:18", "2026-11-25 RJ 75 12:10 to 16:18"] },
    { booking_id: "H-103", hotel: "Hotel Vltava", city: "Prague", check_in: "2026-11-25", check_out: "2026-11-26" },
    { booking_id: "T-104", train: "EC 171", from: "Prague", to: "Berlin", date: "2026-11-26", departs: "06:28", arrives: "10:51" },
    { booking_id: "T-105", train: "ICE 507", from: "Berlin", to: "Munich", date: "2026-11-26", departs: "15:52", arrives: "20:01" },
    { sent_to: "traveller", bookingsSent: 5 } // naive.out.txt line 7 lists 5 bookings (T-101, H-102, H-103, T-104, T-105)
  ];
  // From docs/ai-path/recordings/s5b-agent-planning/f-replan-1.json (the plain replanner)
  const REC_REPLAN = {
    src: "s5b-agent-planning/f-replan-1", provider: "openrouter", model: "google/gemini-2.5-flash", recordedAt: "2026-11-13",
    steps: [
      { tool: "book_train", args: { from_city: "Vienna", to_city: "Prague", date: "2026-11-25", depart_after: "10:10" } },
      { tool: "book_hotel", args: { city: "Prague", check_in: "2026-11-25", check_out: "2026-11-26" } },
      { tool: "book_train", args: { from_city: "Prague", to_city: "Berlin", date: "2026-11-26", arrive_by: "12:00" } },
      { tool: "book_train", args: { from_city: "Berlin", to_city: "Munich", date: "2026-11-26", depart_after: "15:00" } },
      { tool: "send_itinerary", args: {} }
    ]
  };
  // live_run.out.txt step 4: what the tool booked for the plain replanner's first step
  const REPLAN_BOOKED = { booking_id: "T-103", train: "RJ 73", from: "Vienna", to: "Prague", date: "2026-11-25", departs: "10:10", arrives: "14:18" };
  // From docs/ai-path/recordings/s5b-agent-planning/g-replan-1.json (the careful replanner)
  const REC_CAREFUL = {
    src: "s5b-agent-planning/g-replan-1", provider: "openrouter", model: "google/gemini-2.5-flash", recordedAt: "2026-11-13",
    steps: [
      { tool: "cancel_booking", args: { booking_id: "H-102" }, why: "The original hotel booking in Vienna needs to be adjusted as the traveller now needs to leave Vienna earlier to make it to Prague on time." },
      { tool: "book_hotel", args: { city: "Vienna", check_in: "2026-11-23", check_out: "2026-11-24" }, why: "Adjusting the Vienna hotel booking to check out on 2026-11-24, as the traveller needs to depart for Prague on 2026-11-24." },
      { tool: "book_train", args: { from_city: "Vienna", to_city: "Prague", date: "2026-11-24", depart_after: "17:00" }, why: "Booking a train from Vienna to Prague on 2026-11-24 after the conference ends, to ensure arrival in Prague before the workshop on 2026-11-25." },
      { tool: "book_hotel", args: { city: "Prague", check_in: "2026-11-24", check_out: "2026-11-26" }, why: "Booking a hotel in Prague for two nights, as the traveller arrives on 2026-11-24 and departs on 2026-11-26." },
      { tool: "book_train", args: { from_city: "Prague", to_city: "Berlin", date: "2026-11-26", arrive_by: "12:00" }, why: "Booking a train from Prague to Berlin to arrive before the client meeting on 2026-11-26." },
      { tool: "book_train", args: { from_city: "Berlin", to_city: "Munich", date: "2026-11-26", depart_after: "15:00" }, why: "Booking a train from Berlin to Munich after the client meeting, to return home on Thursday night." },
      { tool: "send_itinerary", args: {} }
    ]
  };
  // careful_run.out.txt: the results of steps 4..10 (after the 3 steps NAIVE[0..2] that ran first)
  const CAREFUL_RESULTS = [
    { cancelled: "H-102" },
    { booking_id: "H-103", hotel: "Hotel Naschmarkt", city: "Vienna", check_in: "2026-11-23", check_out: "2026-11-24" },
    { booking_id: "T-104", train: "RJ 79", from: "Vienna", to: "Prague", date: "2026-11-24", departs: "18:10", arrives: "22:18" },
    { booking_id: "H-105", hotel: "Hotel Vltava", city: "Prague", check_in: "2026-11-24", check_out: "2026-11-26" },
    { booking_id: "T-106", train: "EC 171", from: "Prague", to: "Berlin", date: "2026-11-26", departs: "06:28", arrives: "10:51" },
    { booking_id: "T-107", train: "ICE 507", from: "Berlin", to: "Munich", date: "2026-11-26", departs: "15:52", arrives: "20:01" },
    { sent_to: "traveller", bookingsSent: 6 } // careful_run.out.txt line 10 lists 6 bookings
  ];
  const CAPTION = `Recorded model output, ${REC_PLAN.recordedAt}`;

  // The listing is plan_and_execute from docs/ai-path/runs/s5b-agent-planning/agent.py, line for line (0 = def).
  const CODE = [
    "def plan_and_execute(request, max_replans):",
    "    plan = make_plan(request)",
    "    done = []",
    "    replans = 0",
    "    while plan:",
    "        step = plan.pop(0)",
    "        result = run_tool(step)",
    "        done.append({\"step\": step, \"result\": result})",
    "        if \"error\" in result:",
    "            if replans == max_replans:",
    "                return \"Stopped: a person must take over\", done",
    "            replans += 1",
    "            plan = replan(request, done, plan)",
    "    return \"Done\", done"
  ];
  const MAX_REPLANS_RUN = 2; // replay_trace.out.txt: "max_replans: 2"
  // Rows from replay_trace.out.txt: [line about to run, event (l/r), len(plan), len(done), replans, step tool, "error" in result]
  const TRACE = [[1,"l",null,null,null,null,null],[2,"l",7,null,null,null,null],[3,"l",7,0,null,null,null],[4,"l",7,0,0,null,null],[5,"l",7,0,0,null,null],[6,"l",6,0,0,"book_train",null],[7,"l",6,0,0,"book_train",false],[8,"l",6,1,0,"book_train",false],[4,"l",6,1,0,"book_train",false],[5,"l",6,1,0,"book_train",false],[6,"l",5,1,0,"book_hotel",false],[7,"l",5,1,0,"book_hotel",false],[8,"l",5,2,0,"book_hotel",false],[4,"l",5,2,0,"book_hotel",false],[5,"l",5,2,0,"book_hotel",false],[6,"l",4,2,0,"book_train",false],[7,"l",4,2,0,"book_train",true],[8,"l",4,3,0,"book_train",true],[9,"l",4,3,0,"book_train",true],[11,"l",4,3,0,"book_train",true],[12,"l",4,3,1,"book_train",true],[4,"l",7,3,1,"book_train",true],[5,"l",7,3,1,"book_train",true],[6,"l",6,3,1,"cancel_booking",true],[7,"l",6,3,1,"cancel_booking",false],[8,"l",6,4,1,"cancel_booking",false],[4,"l",6,4,1,"cancel_booking",false],[5,"l",6,4,1,"cancel_booking",false],[6,"l",5,4,1,"book_hotel",false],[7,"l",5,4,1,"book_hotel",false],[8,"l",5,5,1,"book_hotel",false],[4,"l",5,5,1,"book_hotel",false],[5,"l",5,5,1,"book_hotel",false],[6,"l",4,5,1,"book_train",false],[7,"l",4,5,1,"book_train",false],[8,"l",4,6,1,"book_train",false],[4,"l",4,6,1,"book_train",false],[5,"l",4,6,1,"book_train",false],[6,"l",3,6,1,"book_hotel",false],[7,"l",3,6,1,"book_hotel",false],[8,"l",3,7,1,"book_hotel",false],[4,"l",3,7,1,"book_hotel",false],[5,"l",3,7,1,"book_hotel",false],[6,"l",2,7,1,"book_train",false],[7,"l",2,7,1,"book_train",false],[8,"l",2,8,1,"book_train",false],[4,"l",2,8,1,"book_train",false],[5,"l",2,8,1,"book_train",false],[6,"l",1,8,1,"book_train",false],[7,"l",1,8,1,"book_train",false],[8,"l",1,9,1,"book_train",false],[4,"l",1,9,1,"book_train",false],[5,"l",1,9,1,"book_train",false],[6,"l",0,9,1,"send_itinerary",false],[7,"l",0,9,1,"send_itinerary",false],[8,"l",0,10,1,"send_itinerary",false],[4,"l",0,10,1,"send_itinerary",false],[13,"l",0,10,1,"send_itinerary",false],[13,"r",0,10,1,"send_itinerary",false]];
  // replay_trace0.out.txt (max_replans 0), same columns
  const TRACE0 = [[1,"l",null,null,null,null,null],[2,"l",7,null,null,null,null],[3,"l",7,0,null,null,null],[4,"l",7,0,0,null,null],[5,"l",7,0,0,null,null],[6,"l",6,0,0,"book_train",null],[7,"l",6,0,0,"book_train",false],[8,"l",6,1,0,"book_train",false],[4,"l",6,1,0,"book_train",false],[5,"l",6,1,0,"book_train",false],[6,"l",5,1,0,"book_hotel",false],[7,"l",5,1,0,"book_hotel",false],[8,"l",5,2,0,"book_hotel",false],[4,"l",5,2,0,"book_hotel",false],[5,"l",5,2,0,"book_hotel",false],[6,"l",4,2,0,"book_train",false],[7,"l",4,2,0,"book_train",true],[8,"l",4,3,0,"book_train",true],[9,"l",4,3,0,"book_train",true],[10,"l",4,3,0,"book_train",true],[10,"r",4,3,0,"book_train",true]];
  const RETURNED0 = "Stopped: a person must take over"; // replay_trace0.out.txt STATUS

  /* ---------- Derived from the data ---------- */
  const PLAN = REC_PLAN.steps;
  const FAIL_AT = NAIVE.findIndex(r => r.error); // index of the failing step
  const FAILED = NAIVE[FAIL_AT];
  const RUN_STEPS = [...PLAN.slice(0, FAIL_AT + 1), ...REC_CAREFUL.steps];
  const RUN_RESULTS = [...NAIVE.slice(0, FAIL_AT + 1), ...CAREFUL_RESULTS];
  const TOOL_RUNS = RUN_STEPS.length;
  const MODEL_CALLS = 1 + TRACE[TRACE.length - 1][4]; // make_plan once, plus one call per replan (f-plan-1, g-replan-1)
  const NOT_RUN = PLAN.length - FAIL_AT - 1;
  const OTHERS = FAILED.other_trains_on_this_route.map(s => { const [date, a, b, dep, , arr] = s.split(" "); return { date, train: `${a} ${b}`, dep, arr, text: s }; });
  const LATE_MIN = toMin(REPLAN_BOOKED.arrives) - toMin(WORKSHOP_START);
  const trainOf = name => OTHERS.find(o => o.train === name);
  const GOOD = CAREFUL_RESULTS.find(r => r.train && r.from === "Vienna"); // the train the careful replan booked
  const EARLY = OTHERS.find(o => o.date === GOOD.date && o.train !== GOOD.train); // the other Tuesday train
  const VIENNA_OLD = NAIVE[1], VIENNA_NEW = CAREFUL_RESULTS[1], PRAGUE_NEW = CAREFUL_RESULTS[3];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-req { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-plan { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); counter-reset: st; }
      .lx-${ID}-plan li { counter-increment: st; display: grid; grid-template-columns: 2em 1fr; gap: 2px 8px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-plan li::before { content: counter(st) "."; font: 600 14px/1.5 var(--mono); color: var(--muted); }
      .lx-${ID}-plan li.lx-${ID}-empty::before { content: ""; }
      .lx-${ID}-plan li.lx-${ID}-empty { color: var(--muted); }
      .lx-${ID}-mono { font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: break-word; color: var(--ink); min-width: 0; }
      .lx-${ID}-seg { white-space: nowrap; }
      .lx-${ID}-why { grid-column: 2; font-size: 14.5px; color: var(--ink-2); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-runs { margin: 14px 0 0; display: grid; gap: 8px; }
      .lx-${ID}-run { display: grid; grid-template-columns: 2em 1fr; gap: 2px 8px; width: 100%; min-height: 44px; padding: 10px 12px; text-align: left; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: inherit; font-size: 15px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-run:hover { border-color: var(--ink-2); }
      .lx-${ID}-run b.lx-${ID}-n { font: 600 14px/1.5 var(--mono); color: var(--muted); }
      .lx-${ID}-run .lx-${ID}-res { grid-column: 2; font: 500 13.5px/1.5 var(--mono); color: var(--ink-2); overflow-wrap: anywhere; }
      .lx-${ID}-run.lx-${ID}-no { border: 2px solid var(--bad); background: var(--bad-soft); }
      .lx-${ID}-run.lx-${ID}-ok { border: 2px solid var(--good); background: var(--good-soft); }
      .lx-${ID}-run.lx-${ID}-stale { border-style: dashed; }
    `;
    document.head.appendChild(s);
  }
  const mono = (kit, s) => `<span class="lx-${ID}-mono">${kit.esc(s)}</span>`;
  const callTxt = s => `${s.tool} ${JSON.stringify(s.args)}`;
  // The same text, allowed to wrap only after a comma (no value here contains a comma)
  const callHtml = (kit, s) => callTxt(s).split(",").map(p => `<span class="lx-${ID}-seg">${kit.esc(p)}</span>`).join(",<wbr>");
  // A plan step in plain words, built from its arguments
  function words(s) {
    const a = s.args;
    if (s.tool === "book_train") return `Train ${a.from_city} → ${a.to_city}, ${day(a.date)}, ${a.arrive_by ? `arrive by ${a.arrive_by}` : `leave after ${a.depart_after}`}`;
    if (s.tool === "book_hotel") return `Hotel in ${a.city}, ${day(a.check_in)} → ${day(a.check_out)} (${plural(nights(a.check_in, a.check_out), "night")})`;
    if (s.tool === "cancel_booking") return `Cancel booking ${a.booking_id}`;
    return "Send the itinerary";
  }
  // A tool result in a few words
  function said(r) {
    if (r.error) return `error: ${r.error}`;
    if (r.train) return `booked ${r.booking_id}: ${r.train}, ${day(r.date)}, ${r.departs} to ${r.arrives}`;
    if (r.hotel) return `booked ${r.booking_id}: ${r.hotel}, ${day(r.check_in)} → ${day(r.check_out)}`;
    if (r.cancelled) return `cancelled ${r.cancelled}`;
    return `sent ${plural(r.bookingsSent, "booking")} to the traveller`;
  }
  const planList = (kit, steps, withWhy) => `<ol class="lx-${ID}-plan">${steps.map(s =>
    `<li><span class="lx-${ID}-mono">${callHtml(kit, s)}</span>${withWhy && s.why ? `<span class="lx-${ID}-why">why: “${kit.esc(s.why)}”</span>` : ""}</li>`).join("")}</ol>`;
  const request = kit => `<div class="lx-${ID}-req">${kit.esc(REQUEST)}</div>`;
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. By hand: put the step cards in order. Two cards are wrong for this request. */
  const CARDS = (() => {
    const all = [...PLAN.map((s, i) => ({ s, at: i })), ...REC_LITE_WRONG.map((s, j) => ({ s, at: -1, wrong: j }))];
    const order = [5, 1, 7, 3, 0, 8, 6, 2, 4]; // a fixed shuffle
    return order.map(k => all[k]);
  })();
  // What each plan step needs placed before it: a train needs the train into its start city, a hotel the train
  // into its city, the itinerary every other step. Any order that respects this is accepted.
  const NEEDS = PLAN.map((s, j) => {
    // the train that brings the traveller into this city earlier in the trip (none for the home city at the start)
    const into = city => PLAN.findIndex((t, k) => k < j && t.tool === "book_train" && t.args.to_city === city);
    if (s.tool === "book_train") { const k = into(s.args.from_city); return k < 0 ? [] : [k]; }
    if (s.tool === "book_hotel") return [into(s.args.city)];
    return PLAN.map((_, k) => k).filter(k => k !== j);
  });
  function orderCards({ el, done, kit }) {
    ensureStyle();
    let order = [], miss = null;
    const left = () => CARDS.filter(c => c.at < 0 || !order.includes(c.at));
    const fits = c => c.at >= 0 && !order.includes(c.at) && NEEDS[c.at].every(k => order.includes(k));
    const why = c => {
      const placed = order.length;
      if (c.wrong === 0) return `On ${day(c.s.args.date)} the conference runs until ${CONF_END}. Arriving in Prague by ${c.s.args.arrive_by} that day means leaving the conference at lunchtime. The workshop is on ${day(PLAN[FAIL_AT].args.date)}. (A smaller model really put this card in its plan.)`;
      if (c.wrong === 1) return `On the night of ${day(c.s.args.check_in)} the traveller is in Prague, after the workshop. The Berlin meeting is the next day, and she goes home that night: no night in Berlin. (A smaller model really put this card in its plan too.)`;
      if (c.s.tool === "send_itinerary") return `<code>send_itinerary</code> sends every booking made so far. Run it now and the traveller gets ${plural(placed, "booking")}, not the whole trip.`;
      if (c.s.tool === "book_hotel") return `Which nights you need in ${kit.esc(c.s.args.city)} depends on the train that gets you there. Book the way in first: if that train fails, you have not paid for a room you cannot reach.`;
      return `This train leaves from ${kit.esc(c.s.args.from_city)}, and nothing gets the traveller to ${kit.esc(c.s.args.from_city)} yet. Book the train into ${kit.esc(c.s.args.from_city)} first: trains in the order the trip happens, so a problem with an early leg shows up before the later legs are paid for.`;
    };
    const paint = () => {
      const placed = order.length;
      const fin = placed === PLAN.length;
      const L = left();
      const right = fin ? -1 : L.findIndex(c => c.at === PLAN.findIndex((_, j) => !order.includes(j)));
      const same = order.every((j, i) => j === i);
      el.innerHTML = `<h1>A three-city trip, one request</h1>
        <p class="lead">A company's travel desk uses an assistant to book work trips. It can call four functions: <code>book_train</code>, <code>book_hotel</code>, <code>cancel_booking</code> and <code>send_itinerary</code>. This request arrives:</p>
        ${request(kit)}
        <p class="lead">In the agent loop, the model chose one step at a time. This lesson is about another way to build an agent: write the whole list of steps first, run it, and fix the list when something breaks. Before anything is booked, someone has to decide the steps. You do it first.</p>
        ${fin ? "" : `<p class="task">Tap the cards in the order the assistant should run them. Two cards do not fit this request at all: leave them out.</p>`}
        <ol class="lx-${ID}-plan" aria-label="your plan">${order.map(j => PLAN[j]).map(s => `<li>${kit.esc(words(s))}</li>`).join("") || `<li class="lx-${ID}-empty">Your plan is empty.</li>`}</ol>
        <div class="lpanel">${fin ? "" : kit.options(L.map(c => kit.esc(words(c.s))), { picked: miss, correct: right })}
        ${miss != null && !fin ? kit.feedback(why(L[miss]), false) : ""}
        ${fin ? kit.feedback(`Your plan has ${plural(PLAN.length, "step")}, and you left out the two cards that break the request. A larger hosted model, given the same request and the four functions, wrote this plan in one reply (its steps, one per line: tool name, then arguments):${planList(kit, PLAN)}<p class="lx-${ID}-cap">${CAPTION}</p>${same ? `The same ${PLAN.length} steps in the same order.` : `The same ${PLAN.length} steps. Only the hotels sit in different places, and both orders work: every step comes after the step it depends on.`} A list like this, written before anything runs, is a <b>plan</b>.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const k = +b.dataset.i;
        if (fits(L[k])) { order.push(L[k].at); miss = null; paint(); if (order.length === PLAN.length) done(); return; }
        miss = k; paint();
      });
    };
    paint();
  }

  /* 2. Diagnose the recorded run: where did the plan go stale? */
  function findStale({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const sent = NAIVE[NAIVE.length - 1].bookingsSent;
    const fb = n => {
      const i = n - 1, s = PLAN[i];
      if (i === FAIL_AT) return [`Right. Step ${n} is the first result that breaks what the planner assumed. Steps ${n + 1} to ${PLAN.length} were written expecting a train that reaches Prague on ${day(s.args.date)} morning. This program never looked at results, so it carried on: a Prague hotel, both later trains, and an itinerary with ${plural(sent, "booking")} and no way from Vienna to Prague. When a result contradicts the plan's assumptions, the rest of the plan (the dashed rows) is <b>stale</b>: still written down, no longer true.`, true];
      if (i < FAIL_AT) return [`Step ${n} worked: ${kit.esc(said(NAIVE[i]))}. When it ran, nothing contradicted the plan.${s.tool === "book_hotel" ? " (This booking may need to change later, but only once a new route is chosen. Look for the result that started the trouble.)" : ""}`, false];
      if (i === PLAN.length - 1) return [`This is where the damage reaches the traveller: ${plural(sent, "booking")}, and no way from Vienna to Prague. But it is the last symptom, not the cause. The program could have stopped ${plural(PLAN.length - 1 - FAIL_AT, "step")} earlier.`, false];
      return [`Step ${n} succeeded, and it is wrong only because of something earlier: the planner wrote it assuming the traveller reaches Prague on ${day(PLAN[FAIL_AT].args.date)}. It is a symptom. Find the first result that broke that assumption.`, false];
    };
    const paint = () => {
      const ok = pick === FAIL_AT + 1;
      el.innerHTML = `<h1>The plan meets the real timetable</h1>
        <p class="lead">A first version of the program runs the plan's steps one after another and never reads the results. Here is its real run on a made-up timetable. Each row is one step and what the function returned.</p>
        <p class="task">Tap the first step whose result makes the rest of the plan wrong.</p>
        <div class="lx-${ID}-runs">${PLAN.map((s, i) => {
          const n = i + 1;
          const st = pick === n ? (ok ? ` lx-${ID}-ok` : ` lx-${ID}-no`) : ok && i > FAIL_AT ? ` lx-${ID}-stale` : "";
          return `<button type="button" class="lx-${ID}-run${st}" data-i="${n}"><b class="lx-${ID}-n">${n}.</b><span>${kit.esc(words(s))}</span><span class="lx-${ID}-res">${kit.esc(said(NAIVE[i]))}</span></button>`;
        }).join("")}</div>
        <div class="lpanel">${pick == null ? "" : kit.feedback(...fb(pick))}</div>`;
      el.querySelectorAll(`.lx-${ID}-run`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === FAIL_AT + 1) done(); });
    };
    paint();
  }

  /* 3. Pick the replan it needed, then see what a real replanner did. */
  function pickReplan({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const late = trainOf(REPLAN_BOOKED.train), early = EARLY, good = trainOf(GOOD.train);
    const opts = [
      `Run step ${FAIL_AT + 1} again as it is`,
      "Throw the plan away and run a fresh one from step 1",
      `Take ${late.train} on ${day(late.date)} (${late.dep} to ${late.arr}) and keep steps ${FAIL_AT + 2} to ${PLAN.length}`,
      `Take ${early.train} on ${day(early.date)} (${early.dep} to ${early.arr}), and fix both hotels`,
      `Take ${good.train} on ${day(good.date)} (${good.dep} to ${good.arr}), and fix both hotels`
    ];
    const RIGHT = 4;
    const replanShown = `${planList(kit, REC_REPLAN.steps)}<p class="lx-${ID}-cap">${CAPTION}</p>`;
    const real = `Now the real replanner. The same model that wrote the plan got the request, the ${plural(FAIL_AT + 1, "step")} run so far with their results, and the ${NOT_RUN} steps not run yet, and was asked for the steps that still need to run:${replanShown}Its first step booked ${kit.esc(REPLAN_BOOKED.train)}, arriving at ${kit.esc(REPLAN_BOOKED.arrives)}: ${LATE_MIN} minutes after the workshop starts. It fixed the failing step and broke the goal.`;
    const fb = [
      [`The result already says ${kit.esc(FAILED.error.split(".")[0])}, and that no other train that day arrives by ${kit.esc(PLAN[FAIL_AT].args.arrive_by)}. The same call gets the same answer.`, false],
      [`Steps 1 and 2 are booked and paid for. A fresh plan run from the top books a second Munich train and a second Vienna hotel. A replan starts from what is already done.`, false],
      [`${kit.esc(late.train)} arrives at ${kit.esc(late.arr)}. The workshop starts at ${kit.esc(WORKSHOP_START)}. The trip would be fully booked and still wrong. ${real.replace("Now the real replanner.", "This is exactly what the real replanner did.")}`, false],
      [`${kit.esc(early.train)} leaves Vienna at ${kit.esc(early.dep)}, but the conference runs until ${kit.esc(CONF_END)}. The traveller would walk out of the last hour.`, false],
      [`Right. The Tuesday evening train is the only one that both leaves after the conference and arrives before the workshop. And it changes a step that is already <b>done</b>: the Vienna hotel was booked for two nights, and now the second night is spent in Prague, so Vienna drops to one night and Prague starts a night earlier. A good replan re-checks every step against the request, not only the one that failed. ${real}`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What should the new plan be?</h1>
        <p class="lead">This time the program stops when a step fails and asks for a new plan for the rest of the trip: a <b>replan</b>. Step ${FAIL_AT + 1} returned:</p>
        <div class="lx-${ID}-req">${mono(kit, FAILED.error)}<br>other trains on this route:<br>${OTHERS.map(o => mono(kit, o.text)).join("<br>")}</div>
        <p class="lead">The conference ends ${day("2026-11-24")} at ${kit.esc(CONF_END)}. The workshop starts ${day(PLAN[FAIL_AT].args.date)} at ${kit.esc(WORKSHOP_START)}. Booked so far: ${kit.esc(said(NAIVE[0]).replace(/^booked /, ""))}; ${kit.esc(said(NAIVE[1]).replace(/^booked /, ""))}.</p>
        <p class="task">Which replan does this trip need?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: what planning first buys, and what it costs. */
  function spotIdea({ el, done, kit }) {
    let ans = null;
    const opts = [
      "The plan adapts to every result, just like the loop",
      "After the plan is written, the run never needs the model again",
      "Fewer model calls, and a plan you can check before anything is booked; but every step is decided before any result exists, so one surprise makes the rest stale",
      "More model calls, because the plan has to be written before the work starts"
    ];
    const RIGHT = 2;
    const fb = [
      [`Steps 2 to ${PLAN.length} were written before step 1 ran. The plan changes only when the program calls the replanner. The loop adapts every turn because the model reads every result.`, false],
      [`Step ${FAIL_AT + 1} needed it. Without a replanner you saw the result: a run that sent a broken itinerary.`, false],
      [`Right. This shape is called <b>plan-then-execute</b> (also plan-and-execute): a <b>planner</b> call writes the steps, an <b>executor</b> runs them (here plain code; it can also be a smaller model), and a <b>replanner</b> call fixes the rest of the plan when a result breaks it. The full run (with the replan on the next screens) made ${plural(TOOL_RUNS, "tool run")} with ${plural(MODEL_CALLS, "model call")}. We did not run the loop on this trip. A loop that picks one tool per turn would need about one model call per tool run plus one to finish, so for a run this size around ${TOOL_RUNS + 1}, each resending the whole conversation. The price: the plan is a guess made before seeing anything, so you must notice when it goes stale.`, true],
      [`The planner is one call. After it, plain code runs every step without asking the model. The loop is the one that calls the model before each step: a loop picking one tool per turn would need around ${TOOL_RUNS + 1} calls for a run the size of this one (${plural(TOOL_RUNS, "tool run")}).`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Plan first, or decide each step?</h1>
        <p class="lead">In the agent loop lesson the model chose each next tool after reading the last result: one model call per step. Here one model call wrote all ${PLAN.length} steps, plain code ran them, and the model was needed again only when step ${FAIL_AT + 1} failed.</p>
        <p class="task">Compared with that loop, what does planning first give you, and what does it cost?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Use it, with predictions: the careful replanner. */
  function careful({ el, done, kit }) {
    ensureStyle();
    let q = 0, miss = null;
    const G = REC_CAREFUL.steps;
    const trainStep = G.find(s => s.tool === "book_train" && s.args.from_city === "Vienna");
    const pragueStep = G.find(s => s.tool === "book_hotel" && s.args.city === "Prague");
    const late = trainOf(REPLAN_BOOKED.train);
    const Q = [
      { task: "Which train to Prague will its new plan end up booking?",
        opts: [late, EARLY, trainOf(GOOD.train)].map(o => `${o.train}, ${day(o.date)}, ${o.dep} to ${o.arr}`), right: 2,
        fb: [`That is the plain replanner's choice, and it arrives after ${WORKSHOP_START}. The new instruction says arrival before each event starts is a hard limit.`,
             `${EARLY.train} leaves at ${EARLY.dep}, before the conference ends at ${CONF_END}: it breaks the other hard limit.`],
        say: `Its step asks for <code>${callHtml(kit, trainStep)}</code>, and the tool booked ${kit.esc(GOOD.train)}, ${kit.esc(GOOD.departs)} to ${kit.esc(GOOD.arrives)}.` },
      { task: `What happens to the Vienna hotel already booked for ${day(VIENNA_OLD.check_in)} → ${day(VIENNA_OLD.check_out)} (${VIENNA_OLD.booking_id})?`,
        opts: ["It stays as it is: done steps are not touched", `It is cancelled, and a new one is booked for ${day(VIENNA_NEW.check_in)} → ${day(VIENNA_NEW.check_out)}`, "It is cancelled, with no new Vienna hotel"], right: 1,
        fb: [`Then the traveller pays for a Vienna room on the night she sleeps in Prague. The new instruction says to check the bookings already made too.`, null,
             `The first night (${day(VIENNA_OLD.check_in)}) is still spent in Vienna, and the request wants a hotel for every night away.`],
        say: `Its first two steps: <code>${callHtml(kit, G[0])}</code>, then <code>${callHtml(kit, G[1])}</code>. These functions have no “change” call, so cancel and rebook is the only way.` },
      { task: "And the Prague hotel?",
        opts: [`${day(PLAN[3].args.check_in)} → ${day(PLAN[3].args.check_out)}, as first planned`, `${day(PRAGUE_NEW.check_in)} → ${day(PRAGUE_NEW.check_out)}`, `${day(PRAGUE_NEW.check_in)} → ${day(PLAN[3].args.check_in)}`], right: 1,
        fb: [`The train now arrives on ${day(GOOD.date)} at ${GOOD.arrives}. She needs a bed that night too.`, null,
             `She is still in Prague after the workshop on the night of ${day(PLAN[3].args.check_in)}; the train to Berlin leaves the next morning.`],
        say: `<code>${callHtml(kit, pragueStep)}</code>: ${plural(nights(pragueStep.args.check_in, pragueStep.args.check_out), "night")}.` }
    ];
    const paint = () => {
      const fin = q === Q.length;
      const cur = Q[Math.min(q, Q.length - 1)];
      el.innerHTML = `<h1>A replanner that checks</h1>
        <p class="lead">Same request, same plan, same failure at step ${FAIL_AT + 1}. One sentence is added to the replanner's instructions:</p>
        <div class="lx-${ID}-req">${kit.esc(CAREFUL_RULE)}</div>
        ${Q.slice(0, q).map(x => kit.feedback(`<b>${kit.esc(x.task)}</b> ${kit.esc(x.opts[x.right])}. ${x.say}`, true)).join("")}
        ${fin ? "" : `<p class="task">Predict: ${kit.esc(cur.task)}</p>`}
        <div class="lpanel">${fin ? `The new plan in full, with the model's own “why” for each step:${planList(kit, REC_CAREFUL.steps, true)}<p class="lx-${ID}-cap">${CAPTION}</p>${kit.feedback(`All three right. One more model call, and the trip works: every arrival before its event, every night with a bed. Telling the replanner what to check helped in this run, but the model can still get it wrong. A check in code (“every arrival is before the event it is for”) would have caught ${kit.esc(REPLAN_BOOKED.train)} for certain, and is cheap to write.`)}`
          : `${kit.options(cur.opts.map(o => kit.esc(o)), { picked: miss, correct: cur.right })}${miss != null ? kit.feedback(kit.esc(cur.fb[miss] || ""), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const k = +b.dataset.i;
        if (k === Q[q].right) { q++; miss = null; paint(); if (q === Q.length) done(); return; }
        miss = k; paint();
      });
    };
    paint();
  }

  /* 6. The whole thing as Python: a stepped replay of the traced run. */
  const SHOW = new Set([1, 6, 12]); // frames after these lines ran
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const prev = TRACE[k - 1], v = TRACE[k];
      if (v[1] === "r") { fr.push({ ln: 13, plan: v[2], done: v[3], replans: v[4], end: true }); continue; }
      if (SHOW.has(prev[0]) && prev[1] === "l") fr.push({ ln: prev[0], plan: v[2], done: v[3], replans: v[4], err: v[6] });
    }
    return fr;
  })();
  function sayFrame(kit, f) {
    if (f.end) return `<code>plan</code> is empty, so the <code>while</code> ends and the last line returns <code>"Done"</code>. In all: ${plural(TOOL_RUNS, "tool run")}, ${plural(MODEL_CALLS, "model call")} (one plan, ${plural(f.replans, "replan")}).`;
    if (f.ln === 1) return `<code>make_plan</code> called the planner model once. <code>plan</code> now holds ${plural(f.plan, "step")}. Nothing is booked yet.`;
    if (f.ln === 12) return `<code>replan</code> sent the request, the ${plural(f.done, "done step")} with their results, and what was left of the old plan. The careful replanner answered with a new list: <code>plan</code> holds ${plural(f.plan, "step")} again, <code>replans</code> is ${f.replans}.`;
    const n = f.done + 1, s = RUN_STEPS[n - 1], r = RUN_RESULTS[n - 1];
    return f.err
      ? `Step ${n}: <code>${callHtml(kit, s)}</code> returned an error. The line <code>if "error" in result:</code> will see it. <code>replans</code> is ${f.replans}, below <code>max_replans</code> = ${MAX_REPLANS_RUN}, so the program calls the replanner.`
      : `Step ${n}: ${kit.esc(words(s))}. Result: ${kit.esc(said(r))}. No error, so the <code>while</code> takes the next step without asking the model.`;
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>Plan, execute, replan in Python</h1>
        <p class="lead"><code>make_plan</code> and <code>replan</code> each make one model call and read the reply's JSON into a list of steps. <code>run_tool</code> runs one step on the travel desk's functions. The model's two replies are recorded and replayed here; the travel functions really ran.</p>
        <p class="task">Step through to the end. Watch when the model is called and when it is not.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>len(plan) <b>${f.plan == null ? "–" : f.plan}</b></span><span>len(done) <b>${f.done == null ? "–" : f.done}</b></span><span>replans <b>${f.replans == null ? "–" : f.replans}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. The exit you control: max_replans = 0. */
  function noReplan({ el, done, kit }) {
    let ans = null;
    const last = TRACE0[TRACE0.length - 1], doneN = last[3];
    const booked = NAIVE.slice(0, doneN).filter(r => !r.error).length;
    const opts = [`"Done", with ${REPLAN_BOOKED.train} booked instead`, `"${RETURNED0}"`, "It runs the rest of the old plan, like the first program", "An error, because the replanner is never called"];
    const RIGHT = 1;
    const fb = [
      [`Nobody chose ${kit.esc(REPLAN_BOOKED.train)}: that choice came from a replanner, and with <code>max_replans = 0</code> no replanner is called.`, false],
      [`Right. The replay with <code>max_replans = 0</code> returned <code>"${kit.esc(RETURNED0)}"</code> after ${plural(doneN, "step")}, with ${plural(booked, "booking")} made and nothing after the failure run. A replanner can fail too, or keep producing plans that fail. <code>max_replans</code> is the exit <b>you</b> control, like the step limit in the agent loop, and the hand-off to a person is the answer the traveller gets when it is hit. Note what it does not catch: the plain replanner's ${kit.esc(REPLAN_BOOKED.train)} plan raised no error at all. Only a check against the request finds that.`, true],
      [`The line <code>if "error" in result:</code> checks every result. On an error the program either replans or stops; it never runs stale steps blindly. That was the first program, which had no check at all.`, false],
      [`Nothing fails. The line <code>if replans == max_replans:</code> compares <code>replans</code> (0) with <code>max_replans</code> (0), they are equal, and the line under it returns a normal value.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to stop replanning</h1>
        <p class="lead">Same plan, same failure at step ${FAIL_AT + 1}, but <code>max_replans = 0</code>.</p>
        ${kit.code(CODE, ans === RIGHT ? CODE.findIndex(c => c.includes("return \"Stopped")) : -1)}
        <p class="task">What does <code>plan_and_execute</code> return?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    let ans = null;
    const opts = [
      "Set up a team offsite: venue, then catering there, then a coach; the manager approves the list first",
      "Find out why last night's checkout errors jumped",
      "Every night, export the day's orders to a file and upload it"
    ];
    const RIGHT = 0;
    const fb = [
      [`Right. The parts are known from the request, later bookings depend on earlier ones, and someone wants to see the list before money is spent. Write the plan, show it, run it, and replan if the venue falls through.`, true],
      [`Each next check depends on what the last one showed: the logs point to a service, that service's metrics point to a deploy. A plan written up front would go stale at the first finding. The agent loop fits.`, false],
      [`The steps never change. Plain code runs them with no model at all; a planner call each night would pay to rewrite the same two steps.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to plan first</h1>
        <p class="lead"><b>For:</b> tasks with several parts you can name from the request, like this trip.</p>
        <p class="lead"><b>Reach for it</b> when most runs go as planned, when you want to show or check the plan before acting, and when you want few model calls (the executor can be plain code or a smaller model).</p>
        <p class="lead"><b>Not</b> when each step depends on what the last result showed (use the loop), or when the steps never change (plain code).</p>
        <p class="lead"><b>Costs:</b> a planner call before anything happens, even for small jobs; a plan that goes stale on surprises; each replan resends the request and the history; and a replan can fix the step and break the goal, so check it against the request.</p>
        <p class="task">Which of these is the best fit for plan-then-execute?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A new hire starts Monday. Create the email account, order a laptop, book three intro meetings in free slots, add the person to payroll. The manager wants to see the list before anything is created.", true,
      "Yes. The parts are known from the request, a person wants to approve the list first, and most runs go as planned. If a meeting slot is gone, replan from there.",
      "Every part is known before the first action, and the manager wants the list before anything is created. That is exactly what a written plan gives you, with a replan if one step fails."],
    ["A support bot answers “where is my parcel?”. What it checks next depends on the courier scan: delivered, lost or delayed each lead to different look-ups.", false,
      "No. The second step depends on what the first result says, every time. A plan written up front would be stale after the first look-up on most runs, so you would replan almost always. The loop fits: the model reads each result and picks the next look-up.",
      "Here the path is decided by the results, not by the request. A plan would need replacing after nearly every first step, which costs a planner call plus replanner calls for nothing. Let the model choose each next step."],
    ["Turn each uploaded invoice PDF into one spreadsheet row. Every invoice goes through the same three steps.", false,
      "No. The steps are the same every time, so there is nothing to plan. Plain code, or a fixed chain of calls, runs the three steps. A planner call per invoice would pay to write the same list again.",
      "A planner only earns its call when the steps differ between requests. These never do. Write the three steps in code."],
    ["Write a quarterly report: four known sections, each needs its own data pull and chart, then a summary that uses all four.", true,
      "Yes. The steps can be listed from the request, the summary depends on the four sections, and you can show the outline before running anything. If one data pull fails, replan that section.",
      "The parts are known up front and depend on each other in a clear order. A plan fits; a failed data pull is a reason to replan, not to drop the plan."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Plan first, or not?</h1>
        <p class="lead">Four jobs from other teams. Plan-then-execute means: one call writes the steps, code runs them, a replanner fixes the rest when a result breaks the plan.</p>
        <p class="task">Would you build each one as plan-then-execute? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can plan, run and replan</h1>
      <p class="lead">You ordered a plan by hand, found the step where a real run went stale, caught a replan that fixed the step but broke the goal, and stepped through the ${CODE.length - 1}-line <code>plan_and_execute</code> with its <code>max_replans</code> exit.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>plan_and_execute</code> yourself, with a fake planner and fake tools, and make it replan when a step fails and hand over to a person after <code>max_replans</code>.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Your agent keeps its plan and results only for one run; next you decide what it should remember for the session, and what for good.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Planning first, then acting, and replanning",
    checked: "2026-11-13",
    sources: [
      "https://www.anthropic.com/engineering/building-effective-agents",
      "https://arxiv.org/abs/2305.04091",
      "https://arxiv.org/abs/2305.18323",
      "https://www.langchain.com/blog/planning-agents"
    ],
    interview: [
      {
        q: "A train was cancelled and your plan-and-execute booking agent sent a traveller an itinerary that misses a meeting. How do you find and fix what went wrong?",
        good: [
          "Read the trace and find the first step whose result contradicted the plan",
          "Check that the executor stops on that result and calls a replanner, instead of running the stale steps",
          "Check the replan against the request: it may fix the failed step and break a time limit",
          "Re-check done steps too: a new route can make an earlier booking wrong",
          "Add a check in code after each replan (every arrival before its event), and cap replans with a hand-off to a person"
        ],
        weak: "Use a bigger model for the planner. The first plan was fine; the failure was in what happened after a result broke it."
      },
      {
        q: "Your team is building an agent that sets up new customer accounts. Some want it to plan first, others want it to decide step by step. How do you decide?",
        good: [
          "Ask whether the steps can be listed from the request before any result is seen",
          "Look at how often results change the path: rare surprises suit a plan, constant ones suit the loop",
          "Compare calls: one planner call plus replans, against one model call per step with a growing conversation",
          "A written plan can be shown and approved before anything is created",
          "If the steps never change, use plain code and no planner"
        ],
        weak: "Planning is always better because the agent thinks ahead. That ignores stale plans and tasks where each step depends on the last result."
      }
    ],
    screens: [orderCards, findStale, pickReplan, spotIdea, careful, asCode, noReplan, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(REC_PLAN.steps.length).fill("[data-right]") },
      { wrong: [`[data-i="${REC_PLAN.steps.length}"]`], right: [`[data-i="${NAIVE.findIndex(r => r.error) + 1}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
