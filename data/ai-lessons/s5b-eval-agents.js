/* Lesson s5b-eval-agents: Evaluating agents: outcome, path and cost.
   Story: a school transport office's agent reroutes route 12's morning pickups because Mill Lane is closed.
   The learner grades ten recorded runs on the outcome (the office system's end state, not the agent's reply)
   and on the path (three rules that must never break), finds the run that succeeded the wrong way, predicts
   the scores of two other versions, steps through a from-scratch scorer, picks the number that gates a release.
   Ideas: (1) grade an agent run twice and separately: the outcome from the end state, the path against a few
   must-never rules (not one exact call sequence); (2) steps and cost are budgets you watch, the gate is
   "outcome passed AND path acceptable" over many runs.
   Data, all real:
   - docs/ai-path/runs/s5b-eval-agents/bus_office.py: the fake office (routes, closures, approved pickup points,
     six tools) every run started from; record_runs.py: the agent loop that recorded the runs through
     scripts/ai/record.mjs (recordings in the main checkout, docs/ai-path/recordings/s5b-eval-agents/):
       v2-run01..10 = "Monday's agent" (SYSTEM_V2, TASK without the year, small hosted model, temperature 1),
       v5-run01..10 = "Tuesday's agent" (SYSTEM_V5 = one more rule, TASK_V3 with the full date, same model),
       v4-run01..10 = the larger model (SYSTEM_V2, TASK_V3).
     (run01..10 and v3-run01..10 were earlier setups, recorded but not shown run by run; v3 = SYSTEM_V2 with
     TASK_V3, the small model. Screen 5 counts v3's outcome passes from V3, section 5 of evaluate.out.txt.)
   - evaluate.py + evaluate.out.txt: score_run (the code screen) traced on v2-run09, the per-run scores, and
     the compact run data copied below as RUNS (section 4 of evaluate.out.txt).
   Every number on screen is computed here from RUNS, OFFICE and TRACE.
   Lesson-local CSS (prefix lx-s5b-eval-agents-): run cards, call lists, the state box, the comparison table. */
(() => {
  const ID = "s5b-eval-agents";
  const P = "lx-" + ID + "-";

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s5b-eval-agents/bus_office.py (OFFICE, TASK, TASK_V3, SYSTEM_V5's added rule)
  const OFFICE = {
    date: "2026-11-18",
    route: [["R12-1", "Station Square", "High Street", 6], ["R12-2", "Mill Lane north", "Mill Lane", 4],
      ["R12-3", "Mill Lane south", "Mill Lane", 3], ["R12-4", "Park Avenue", "Park Avenue", 5]],
    points: { "CH-21": ["Church Street lay-by", "Church Street", "R12-2"], "MI-09": ["Mill Lane bridge", "Mill Lane", "R12-3"], "OR-07": ["Orchard Road shelter", "Orchard Road", "R12-3"] },
    closed: "Mill Lane"
  };
  const TASK = "Mill Lane is closed tomorrow morning (Tuesday 18 November) for a water main repair. Please reroute route 12's morning pickups and let the families who are affected know.";
  const RULE_V5 = "Before you move a pickup, check that the new point's road is not closed at that time.";
  const TOOLS = ["get_closures", "get_route", "find_safe_stops", "move_pickup", "notify_families", "notify_route"];

  // From docs/ai-path/recordings/s5b-eval-agents/v2-run01-4.json (run 1's last reply, not altered)
  const REC_REPLY1 = { src: "s5b-eval-agents/v2-run01-4", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "Route 12 has been rerouted for tomorrow, November 18th, due to a closure on Mill Lane. Stops R12-2 and R12-3 have been moved to alternative locations: R12-2 is now at Church Street lay-by (CH-21), and R12-3 is now at Mill Lane bridge (MI-09). Families affected by these changes have been notified." };
  // From docs/ai-path/recordings/s5b-eval-agents/v2-run09-1.json (run 9's first message, trimmed with … , not altered)
  const REC_PLAN9 = { src: "s5b-eval-agents/v2-run09-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "… After that, I will move the pickups to the new locations and notify the affected families.\nFinally, I will send a notification to all families on route 12 about the changes.\nIt is currently Monday 17 November, so tomorrow is Tuesday 18 November. …" };
  const PLAN9_PARTS = ["After that, I will move the pickups to the new locations and notify the affected families.",
    "Finally, I will send a notification to all families on route 12 about the changes.",
    "It is currently Monday 17 November, so tomorrow is Tuesday 18 November."];

  // From docs/ai-path/runs/s5b-eval-agents/evaluate.out.txt, section 4 (calls: [tool, arguments string as the model
  // sent it with message texts cut after 70 characters and marked …, ok|error]; steps: [tokens in, tokens out, cost USD])
  const RUNS = {"v2": [{"id": "v2-run01", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"new_code\":\"MI-09\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-2\",\"message\":\"Please note that due to a closure on Mill Lane, your pickup will be mo …\"}", "ok"], ["notify_families", "{\"message\":\"Please note that due to a closure on Mill Lane, your pickup will be mo …\",\"stop_id\":\"R12-3\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[450, 45, 6.3e-05], [680, 81, 0.0001004], [896, 216, 0.000176], [1229, 89, 0.0001585]], "reply": "Route 12 has been rerouted for tomorrow, November 18th, due to a closure on Mill Lane. Stops R12-2 and R12-3 have been moved to alternative locations: R12-2 is now at Church Street lay-by (CH-21), and R12-3 is now at Mill Lane bridge (MI-09). Families affected by these changes have been notified."}, {"id": "v2-run02", "calls": [["get_closures", "{\"date\":\"2023-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"new_code\":\"CH-21\",\"stop_id\":\"R12-2\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-3\",\"new_code\":\"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-2\",\"message\":\"Your pickup has been moved to Church Street lay-by (CH-21) due to a cl …\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-3\",\"message\":\"Your pickup has been moved to Mill Lane bridge (MI-09) due to a closur …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[450, 42, 6.18e-05], [688, 88, 0.000104], [910, 214, 0.0001766], [1240, 65, 0.00015]], "reply": "Route 12 pickups on Mill Lane have been moved to alternative locations due to a road closure. R12-2 has been moved to Church Street lay-by (CH-21), and R12-3 has been moved to Mill Lane bridge (MI-09). Families affected have been notified."}, {"id": "v2-run03", "calls": [["get_closures", "{\"date\":\"2023-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"]], "moved": {}, "messages": [], "steps": [[450, 42, 6.18e-05], [688, 71, 9.72e-05]], "reply": "I'm sorry, but I cannot find any record of a road closure on Mill Lane for tomorrow, November 18th. The `get_closures` tool did not return any information for that date. Would you like me to proceed with rerouting the pickups for route 12, or would you like to verify the road closure information?"}, {"id": "v2-run04", "calls": [["get_closures", "{\"date\":\"2024-11-18\"}", "ok"]], "moved": {}, "messages": [], "steps": [[450, 95, 8.3e-05], [561, 26, 6.65e-05]], "reply": "There are no road closures on November 18th. Therefore, I do not need to make any changes to the route."}, {"id": "v2-run05", "calls": [], "moved": {}, "messages": [], "steps": [[450, 22, 5.38e-05]], "reply": "First, I need to know what tomorrow's date is in YYYY-MM-DD format."}, {"id": "v2-run06", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2023-11-19\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"new_code\":\"CH-21\",\"stop_id\":\"R12-2\"}", "ok"], ["move_pickup", "{\"new_code\":\"MI-09\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-2\",\"message\":\"Route 12 has been rerouted. Your new pickup point is Church Street lay …\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-3\",\"message\":\"Route 12 has been rerouted. Your new pickup point is Mill Lane bridge.\"}", "ok"], ["notify_route", "{\"route_id\":\"12\",\"message\":\"Please note that due to a closure on Mill Lane, stops R12-2 and R12-3  …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3], ["route 12", 18]], "steps": [[450, 42, 6.18e-05], [688, 46, 8.72e-05], [868, 148, 0.000146], [1132, 80, 0.0001452], [1237, 50, 0.0001437]], "reply": "Route 12 has been rerouted due to a closure on Mill Lane. Stops R12-2 and R12-3 have been moved to Church Street lay-by and Mill Lane bridge, respectively. Families affected have been notified."}, {"id": "v2-run07", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"new_code\":\"CH-21\",\"stop_id\":\"R12-2\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-3\",\"new_code\":\"MI-09\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup point for tomorrow has been moved to Church Street lay-by  …\",\"stop_id\":\"R12-2\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-3\",\"message\":\"Your pickup point for tomorrow has been moved to Mill Lane bridge (MI- …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[450, 33, 5.82e-05], [667, 71, 9.51e-05], [872, 205, 0.0001692], [1193, 46, 6.921e-05]], "reply": "Route 12 pickups at R12-2 and R12-3 have been moved to alternative locations for tomorrow, November 18th, due to the closure of Mill Lane. Families affected have been notified."}, {"id": "v2-run08", "calls": [["get_closures", "{\"date\":\"2024-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"new_code\":\"MI-09\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup point has been moved to Church Street lay-by due to a clos …\",\"stop_id\":\"R12-2\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup point has been moved to Mill Lane bridge due to a closure  …\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_route", "{\"message\":\"Please note that Mill Lane will be closed tomorrow morning. Stops R12- …\",\"route_id\":\"12\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3], ["route 12", 18]], "steps": [[450, 38, 6.02e-05], [503, 18, 5.75e-05], [705, 23, 7.97e-05], [779, 31, 9.03e-05], [847, 23, 9.39e-05], [955, 31, 0.0001079], [1023, 44, 5.546e-05], [1091, 42, 6.074e-05], [1157, 60, 0.0001397], [1242, 131, 0.0001766]], "reply": "Attached is a summary for the office staff.\n\n**Mill Lane Closure - Route 12 Rerouting**\n\nMill Lane will be closed on Tuesday 18 November due to a water main repair.\n\n*   **Stop R12-2 (Mill Lane north):** Pickup has been moved to **Church Street lay-by (CH-21)**. Affected families have been notified.\n*   **Stop R12-3 (Mill Lane south):** Pickup has been moved to **Mill Lane bridge (MI-09)**. Affected families have been notified.\n\nRoute 12 has been notified of the changes."}, {"id": "v2-run09", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-3\",\"new_code\":\"OR-07\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup point has been moved to CH-21 due to a closure on Mill Lan …\",\"stop_id\":\"R12-2\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup point has been moved to OR-07 due to a closure on Mill Lan …\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_route", "{\"message\":\"Please note that due to a closure on Mill Lane, stops R12-2 and R12-3  …\",\"route_id\":\"12\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "OR-07"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3], ["route 12", 18]], "steps": [[450, 149, 0.0001046], [786, 58, 0.0001018], [896, 39, 0.0001052], [1021, 81, 6.853e-05], [1140, 45, 0.000132], [1223, 57, 0.0001451], [1305, 43, 0.0001477], [1372, 101, 0.0001083], [1499, 84, 0.0001835]], "reply": "Route 12 has been updated due to the closure on Mill Lane. Stops R12-2 and R12-3 have been moved to new pickup points: R12-2 is now at CH-21 and R12-3 is now at OR-07. Affected families have been notified directly, and a general announcement has been sent to all families on route 12."}, {"id": "v2-run10", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2023-11-18\"}", "ok"]], "moved": {}, "messages": [], "steps": [[450, 42, 6.18e-05], [688, 46, 8.72e-05]], "reply": "I can reroute route 12. However, I need to know the exact date for tomorrow's closures. Can you please tell me what day tomorrow is (e.g., YYYY-MM-DD)?"}], "v5": [{"id": "v5-run01", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"new_code\":\"CH-21\",\"stop_id\":\"R12-2\"}", "ok"], ["move_pickup", "{\"new_code\":\"MI-09\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup has been moved to Church Street lay-by for tomorrow mornin …\",\"stop_id\":\"R12-2\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-3\",\"message\":\"Your pickup has been moved to Mill Lane bridge for tomorrow morning du …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 86, 0.0001142], [1018, 199, 0.0001814], [1333, 36, 0.0001477]], "reply": "Route 12 morning pickups at R12-2 and R12-3 have been moved to new locations due to the Mill Lane closure. Families affected have been notified."}, {"id": "v5-run02", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-3\",\"new_code\":\"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-2\",\"message\":\"Your pickup for tomorrow has been moved to Church Street (CH-21) due t …\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup for tomorrow has been moved to Mill Lane bridge (MI-09) du …\",\"stop_id\":\"R12-3\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 91, 0.0001162], [1023, 209, 0.0001859], [1348, 72, 9.313e-05]], "reply": "The morning pickups for route 12 at R12-2 and R12-3 have been moved due to the closure of Mill Lane. R12-2 is now at Church Street (CH-21) and R12-3 is now at Mill Lane bridge (MI-09). Families affected have been notified."}, {"id": "v5-run03", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2026-11-18\"}", "ok"]], "moved": {}, "messages": [], "steps": [[489, 42, 6.57e-05], [798, 57, 0.0001026]], "reply": "A section of Mill Lane is closed tomorrow from 06:00 to 10:00. The closures do not affect route 12's pickups as they are scheduled to take place before 06:00. Therefore, no changes are needed."}, {"id": "v5-run04", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-3\",\"new_code\":\"OR-07\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-2\",\"message\":\"Due to a road closure on Mill Lane, your pickup point has been changed …\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-3\",\"message\":\"Due to a road closure on Mill Lane, your pickup point has been changed …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "OR-07"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 101, 0.0001202], [1034, 270, 0.0001448], [1420, 47, 8.952e-05]], "reply": "The pickups for R12-2 and R12-3 have been moved to alternative locations for tomorrow, 18 November 2026, due to the closure of Mill Lane. Families affected have been notified."}, {"id": "v5-run05", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"new_code\":\"CH-21\",\"stop_id\":\"R12-2\"}", "ok"], ["move_pickup", "{\"new_code\":\"MI-09\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-2\",\"message\":\"There are changes to your pickup location due to road closures.\"}", "ok"], ["notify_families", "{\"message\":\"There are changes to your pickup location due to road closures.\",\"stop_id\":\"R12-3\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 46, 9.82e-05], [978, 134, 0.0001514], [1228, 49, 0.0001424]], "reply": "Mill Lane is closed tomorrow morning. Rerouted R12-2 to Church Street lay-by (CH-21) and R12-3 to Mill Lane bridge (MI-09). Affected families have been notified."}, {"id": "v5-run06", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"new_code\":\"MI-09\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup has been moved to Church Street lay-by due to road closure …\",\"stop_id\":\"R12-2\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup has been moved to Mill Lane bridge due to road closure on  …\",\"stop_id\":\"R12-3\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 46, 3.592e-05], [978, 146, 0.0001562], [1240, 69, 8.257e-05]], "reply": "The pickups for R12-2 and R12-3 on Mill Lane have been moved due to a road closure. R12-2 is now at Church Street lay-by (CH-21) and R12-3 is now at Mill Lane bridge (MI-09). Families affected have been notified."}, {"id": "v5-run07", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"new_code\":\"OR-07\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup has been moved to Church Street (CH-21) tomorrow due to a  …\",\"stop_id\":\"R12-2\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup has been moved to Orchard Road (OR-07) tomorrow due to a r …\",\"stop_id\":\"R12-3\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "OR-07"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 73, 0.000109], [1005, 224, 0.0001901], [1345, 35, 7.812e-05]], "reply": "The pickups for R12-2 and R12-3 have been moved to CH-21 and OR-07 respectively, and families have been notified."}, {"id": "v5-run08", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-3\",\"new_code\":\"MI-09\"}", "ok"], ["notify_families", "{\"message\":\"Due to a closure on Mill Lane, your pickup has been moved to Church St …\",\"stop_id\":\"R12-2\"}", "ok"], ["notify_families", "{\"message\":\"Due to a closure on Mill Lane, your pickup has been moved to Mill Lane …\",\"stop_id\":\"R12-3\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 269, 0.0001874], [1203, 206, 0.0002027], [1525, 36, 0.0001669]], "reply": "Route 12 pickups at R12-2 and R12-3 have been moved to new locations due to the closure on Mill Lane. Families affected have been notified."}, {"id": "v5-run09", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-3\",\"new_code\":\"OR-07\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-2\",\"message\":\"Your pickup point has been moved to Church Street (CH-21) tomorrow due …\"}", "ok"], ["notify_families", "{\"stop_id\":\"R12-3\",\"message\":\"Your pickup point has been moved to Orchard Road (OR-07) tomorrow due  …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "OR-07"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 76, 0.0001102], [1008, 213, 0.00011985], [1337, 60, 8.741e-05]], "reply": "The morning pickups for route 12 have been rerouted due to the Mill Lane closure. R12-2 is now at Church Street (CH-21) and R12-3 is now at Orchard Road (OR-07). Families at these stops have been notified."}, {"id": "v5-run10", "calls": [["get_route", "{\"route_id\":\"12\"}", "ok"], ["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\":\"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\":\"R12-2\",\"new_code\":\"CH-21\"}", "ok"], ["move_pickup", "{\"new_code\":\"OR-07\",\"stop_id\":\"R12-3\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup for tomorrow has been moved to Church Street lay-by due to …\",\"stop_id\":\"R12-2\"}", "ok"], ["notify_families", "{\"message\":\"Your pickup for tomorrow has been moved to Orchard Road shelter due to …\",\"stop_id\":\"R12-3\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "OR-07"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[489, 42, 6.57e-05], [798, 90, 5.352e-05], [1022, 210, 0.00011978], [1348, 52, 8.513e-05]], "reply": "Route 12 pickups at R12-2 and R12-3 have been moved to CH-21 (Church Street) and OR-07 (Orchard Road) respectively due to the Mill Lane closure. Families affected have been notified."}], "v4": [{"id": "v4-run01", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Due to road closures, your pickup point has been changed to Church Str …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Due to road closures, your pickup point has been changed to Mill Lane  …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 153, 0.00020805], [1017, 111, 0.00021915]], "reply": "The pickups for route 12 have been successfully rerouted due to the closure of Mill Lane:\n\n- The pickup at **Mill Lane north (R12-2)** has been moved to **Church Street lay-by (CH-21)**.\n- The pickup at **Mill Lane south (R12-3)** has been moved to **Mill Lane bridge (MI-09)**.\n\nNotifications have been sent to the families affected by these changes. All families have been informed about their new pickup points for tomorrow morning (November 18, 2026)."}, {"id": "v4-run02", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Due to road closures on Mill Lane, your pickup point has been changed  …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Due to road closures on Mill Lane, your pickup point has been changed  …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 163, 0.00021405], [1027, 74, 0.00019845]], "reply": "Tomorrow, November 18th, due to the closure of Mill Lane for water main repair, pickups for route 12 have been adjusted. The stop \"Mill Lane north\" has been moved to \"Church Street lay-by,\" and \"Mill Lane south\" has been relocated to \"Mill Lane bridge.\" \n\nFamilies affected at both stops have been notified of the changes."}, {"id": "v4-run03", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Attention: Due to road closures on Mill Lane tomorrow morning, your pi …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Attention: Due to road closures on Mill Lane tomorrow morning, your pi …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 68, 0.00015705], [903, 133, 0.00021525], [1077, 145, 0.00024855]], "reply": "I have successfully rerouted the bus pickups for Route 12 due to the closure of Mill Lane tomorrow morning. The changes are as follows:\n\n- **Mill Lane north** (R12-2) has been moved to **Church Street lay-by (Code: CH-21)** for a pickup time of **07:12**.\n- **Mill Lane south** (R12-3) has been moved to **Mill Lane bridge (Code: MI-09)** for a pickup time of **07:16**.\n\nNotifications have been sent to the 4 families affected by the change at Church Street lay-by and the 3 families at Mill Lane bridge. Please ensure families are aware of the new pickup points."}, {"id": "v4-run04", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Due to a road closure on Mill Lane, your bus pickup has been relocated …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Due to a road closure on Mill Lane, your bus pickup has been relocated …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 68, 0.00015705], [903, 123, 0.00020925], [1067, 102, 0.00022125]], "reply": "The pickups for route 12 have been successfully rerouted due to the closure of Mill Lane on November 18, 2026. \n\n- The pickup at **Mill Lane north** (R12-2) has been moved to **Church Street lay-by** (CH-21).\n- The pickup at **Mill Lane south** (R12-3) has been relocated to **Mill Lane bridge** (MI-09).\n\nNotifications have been sent to the families at both stops regarding the changes."}, {"id": "v4-run05", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Due to road construction, your pickup has been moved to Church Street  …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Due to road construction, your pickup has been moved to Mill Lane brid …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 145, 0.00020325], [1009, 107, 0.00021555]], "reply": "The morning pickups for Route 12 on Tuesday, November 18, 2026, have been adjusted due to the closure of Mill Lane for water main repairs. \n\n- The pickup for **Mill Lane north** (R12-2) has been moved to **Church Street lay-by (CH-21)**.\n- The pickup for **Mill Lane south** (R12-3) has been moved to **Mill Lane bridge (MI-09)**.\n\nNotifications have been successfully sent to the affected families regarding the changes."}, {"id": "v4-run06", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Due to road closures on Mill Lane, your pickup point has been changed  …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Due to road closures on Mill Lane, your pickup point has been changed  …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 160, 0.00021225], [1024, 106, 0.0002172]], "reply": "Mill Lane is closed tomorrow morning for repairs, affecting two stops on route 12: Mill Lane north and Mill Lane south. \n\nThe pickups have been successfully rerouted:\n- Mill Lane north (R12-2) will now be at Church Street lay-by (CH-21).\n- Mill Lane south (R12-3) will now be at Mill Lane bridge (MI-09).\n\nNotifications have been sent to 4 families for the first stop and 3 families for the second stop informing them of the changes."}, {"id": "v4-run07", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Dear families, please note that due to road closures on Mill Lane, you …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Dear families, please note that due to road closures on Mill Lane, you …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 68, 0.00015705], [903, 141, 0.00022005], [1085, 105, 0.00014895]], "reply": "On Tuesday, November 18, 2026, Mill Lane will be closed due to a water main repair. Therefore, the following changes have been made to Route 12's morning pickups:\n\n- **Mill Lane North (R12-2)** has been rerouted to **Church Street lay-by (CH-21)**.\n- **Mill Lane South (R12-3)** has been rerouted to **Mill Lane bridge (MI-09)**.\n\nFamilies at both affected stops have been notified of the changes."}, {"id": "v4-run08", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Due to a road closure on Mill Lane, your pickup point has been changed …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Due to a road closure on Mill Lane, your pickup point has been changed …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 156, 0.00020985], [1020, 127, 0.0002292]], "reply": "For the morning pickups on Tuesday, November 18, 2026, the following changes have been made due to the closure of Mill Lane:\n\n- **Mill Lane north (R12-2)**: The pickup point has been moved to **Church Street lay-by (CH-21)**. A notification message has been sent to the 4 families affected.\n  \n- **Mill Lane south (R12-3)**: The pickup point has been moved to **Mill Lane bridge (MI-09)**. A notification message has been sent to the 3 families affected.\n\nPlease ensure this information is noted for the transportation schedule."}, {"id": "v4-run09", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Notice: Mill Lane is closed for water main repairs tomorrow. Please no …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Notice: Mill Lane is closed for water main repairs tomorrow. Please no …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 165, 0.00021525], [1029, 113, 0.00022215]], "reply": "I have successfully rerouted the morning pickups for route 12 due to the closure of Mill Lane on November 18, 2026. The following changes have been made:\n\n- **Mill Lane north (R12-2)**: The pickup has been moved to **Church Street lay-by (CH-21)**.\n- **Mill Lane south (R12-3)**: The pickup has been moved to **Mill Lane bridge (MI-09)**.\n\nNotifications have been sent to the families affected by these changes, informing them of the new pickup locations."}, {"id": "v4-run10", "calls": [["get_closures", "{\"date\":\"2026-11-18\"}", "ok"], ["get_route", "{\"route_id\":\"12\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-2\"}", "ok"], ["find_safe_stops", "{\"stop_id\": \"R12-3\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-2\", \"new_code\": \"CH-21\"}", "ok"], ["move_pickup", "{\"stop_id\": \"R12-3\", \"new_code\": \"MI-09\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-2\", \"message\": \"Due to road closures on Mill Lane, your pickup point has been moved to …\"}", "ok"], ["notify_families", "{\"stop_id\": \"R12-3\", \"message\": \"Due to road closures on Mill Lane, your pickup point has been moved to …\"}", "ok"]], "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]], "steps": [[334, 21, 6.27e-05], [430, 15, 7.35e-05], [612, 56, 0.0001254], [775, 165, 0.00021525], [1029, 105, 0.00021735]], "reply": "The pickups for Route 12 have been successfully rerouted due to the closure of Mill Lane on the morning of November 18, 2026. \n\n- **Mill Lane north (R12-2)** is now moved to **Church Street lay-by (CH-21)** at 07:12.\n- **Mill Lane south (R12-3)** is now moved to **Mill Lane bridge (MI-09)** at 07:16.\n\nNotifications have been sent to the affected families at both stops."}]};

  // From evaluate.out.txt, section 5: the end states of v3 (Monday's prompt with the full date, small model; not shown run by run)
  const V3 = [{"id": "v3-run01", "moved": {}, "messages": []}, {"id": "v3-run02", "moved": {}, "messages": []}, {"id": "v3-run03", "moved": {}, "messages": []}, {"id": "v3-run04", "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]]}, {"id": "v3-run05", "moved": {}, "messages": []}, {"id": "v3-run06", "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]]}, {"id": "v3-run07", "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]]}, {"id": "v3-run08", "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]]}, {"id": "v3-run09", "moved": {"R12-2": "CH-21", "R12-3": "MI-09"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]]}, {"id": "v3-run10", "moved": {"R12-2": "CH-21", "R12-3": "OR-07"}, "messages": [["stop R12-2", 4], ["stop R12-3", 3]]}];

  // From evaluate.out.txt, section 1: score_run traced on v2-run09
  // ([listing line, event, the traced variables that exist at that moment]; their values are in TRACE_VARS)
  const TRACE = [[1, "line", []], [3, "line", []], [4, "line", []], [3, "line", []], [5, "line", []], [6, "line", []],
    [5, "line", []], [2, "line", []], [7, "line", ["success"]], [8, "line", ["success", "broken"]],
    [9, "line", ["success", "broken", "path_ok"]], [10, "line", ["success", "broken", "path_ok", "steps"]],
    [11, "line", ["success", "broken", "path_ok", "steps"]], [10, "line", ["success", "broken", "path_ok", "steps"]],
    [12, "line", ["success", "broken", "path_ok", "steps", "cost"]], [12, "return", ["success", "broken", "path_ok", "steps", "cost"]]];
  const TRACE_VARS = { success: "True", broken: "['notify_route']", path_ok: "False", steps: 9, cost: 0.00109673 }; // as Python prints them
  const TRACE_RESULT = "(True, False, 9, 0.00109673)"; // the result line of section 1, written as Python prints the tuple
  const SCORE_CODE = [
    "def score_run(run):",
    "    moved, told = run[\"moved\"], run[\"told\"]",
    "    success = (",
    "        moved.get(\"R12-2\") in GOOD",
    "        and moved.get(\"R12-3\") in GOOD",
    "        and {\"R12-2\", \"R12-3\"}",
    "            <= set(told))",
    "    broken = rule_breaks(run[\"calls\"])",
    "    path_ok = not broken",
    "    steps = len(run[\"steps\"])",
    "    cost = sum(s[\"cost\"]",
    "               for s in run[\"steps\"])",
    "    return success, path_ok, steps, cost"
  ];
  const RULE_CODE = [
    "DATE = \"2026-11-18\"",
    "GOOD = {\"CH-21\", \"OR-07\"}",
    "",
    "def breaks_a_rule(call):",
    "    date = call[\"args\"].get(\"date\", DATE)",
    "    return (call[\"name\"] == \"notify_route\"",
    "            or date != DATE",
    "            or \"error\" in call[\"result\"])",
    "",
    "def rule_breaks(calls):",
    "    return [c[\"name\"] for c in calls",
    "            if breaks_a_rule(c)]"
  ];

  /* ---------- Derived, computed here ---------- */
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const sum = a => a.reduce((x, y) => x + y, 0);
  const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length / 2; return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2; };
  const FAM = Object.fromEntries(OFFICE.route.map(r => [r[0], r[3]]));
  const CLOSED_STOPS = OFFICE.route.filter(r => r[2] === OFFICE.closed).map(r => r[0]);
  const AFFECTED = sum(CLOSED_STOPS.map(s => FAM[s]));
  const ROUTE_FAM = sum(OFFICE.route.map(r => r[3]));
  const GOOD = Object.keys(OFFICE.points).filter(c => OFFICE.points[c][1] !== OFFICE.closed);
  const BAD_POINT = Object.keys(OFFICE.points).find(c => OFFICE.points[c][1] === OFFICE.closed);
  const args = c => { try { return JSON.parse(c[1].replace(/ …"/g, '"')); } catch (e) { return {}; } };
  const told = run => {
    const t = new Set();
    run.messages.forEach(([to]) => { if (to.startsWith("stop ")) t.add(to.slice(5)); else OFFICE.route.forEach(r => t.add(r[0])); });
    return t;
  };
  const outcome = run => CLOSED_STOPS.every(s => GOOD.includes(run.moved[s])) && CLOSED_STOPS.every(s => told(run).has(s));
  // the three path rules, as in evaluate.py's breaks_a_rule
  const breaks = run => run.calls.filter(c => c[0] === "notify_route" || (args(c).date !== undefined && args(c).date !== OFFICE.date) || c[2] === "error");
  const pathOk = run => breaks(run).length === 0;
  const cost = run => sum(run.steps.map(s => s[2]));
  const nSteps = run => run.steps.length;
  const score = v => {
    const rs = RUNS[v];
    return { n: rs.length, out: rs.filter(outcome).length, path: rs.filter(pathOk).length, both: rs.filter(r => outcome(r) && pathOk(r)).length,
      steps: median(rs.map(nSteps)), cost: sum(rs.map(cost)) / rs.length, calls: sum(rs.map(r => r.calls.length)),
      errs: sum(rs.map(r => r.calls.filter(c => c[2] === "error").length)) };
  };
  const MON = RUNS.v2, TUE = RUNS.v5, BIG = RUNS.v4;
  const WRONG_WAY = MON.findIndex(r => outcome(r) && !pathOk(r));         // run 9
  const RULE_KEEPER = MON.findIndex(r => !outcome(r) && pathOk(r) && r.calls.length > 0); // run 1
  const BLAST_FAIL = MON.findIndex(r => !outcome(r) && r.calls.some(c => c[0] === "notify_route"));
  const SILENT = MON.findIndex(r => r.calls.length === 0);
  const usd = x => "$" + x.toFixed(5);
  const sig = c => { const a = args(c); delete a.message; return c[0] + JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])); };
  const BIG_SAME = BIG.every(r => r.calls.map(sig).join("|") === BIG[0].calls.map(sig).join("|"));
  const caption = rec => `<span class="${P}cap">Recorded model output, ${rec.recordedAt}</span>`;

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}box { margin-top: 14px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
.${P}box h3 { margin: 0 0 6px; font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.${P}box p { margin: 4px 0; }
.${P}quote { margin-top: 12px; padding: 10px 14px; border-left: 3px solid var(--ink-2); background: var(--sunk); font-size: 16px; }
.${P}cap { display: block; margin-top: 6px; font: 500 12px var(--mono); color: var(--muted); }
.${P}calls { list-style: none; margin: 6px 0 0; padding: 0; font: 500 13px/1.45 var(--mono); }
.${P}calls li { padding: 3px 0 3px 8px; border-left: 2px solid var(--line); overflow-wrap: anywhere; }
.${P}calls li .n { font-weight: 700; }
.${P}calls li.err { border-left-color: var(--bad); }
.${P}calls li.mark { border-left: 3px solid var(--ink); background: var(--sunk); }
.${P}state { font: 500 14px/1.5 var(--mono); overflow-wrap: anywhere; }
.${P}state b { font-weight: 700; }
.${P}k { font: 700 12px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin-top: 8px; display: block; }
.${P}tag { display: inline-block; margin-left: 8px; padding: 1px 8px; border: 1px solid var(--line); border-radius: 6px; font: 600 12px var(--mono); color: var(--ink-2); }
.${P}rules { margin: 8px 0 0; padding-left: 22px; }
.${P}rules li { margin: 4px 0; }
.${P}cmp { border-collapse: collapse; width: 100%; margin-top: 14px; font: 500 14px var(--mono); }
.${P}cmp th, .${P}cmp td { padding: 7px 6px; border-bottom: 1px solid var(--line); text-align: right; vertical-align: top; }
.${P}cmp th:first-child, .${P}cmp td:first-child { text-align: left; font-family: var(--font); }
.${P}cmp thead th { font: 600 13px var(--font); color: var(--muted); border-bottom: 2px solid var(--ink); }
.${P}cmp tr.on td { background: var(--sunk); font-weight: 700; }
.${P}wrap { overflow-x: auto; }
`;
    document.head.appendChild(s);
  }

  /* ---------- Drawing helpers ---------- */
  const callList = (run, mark = () => false) => run.calls.length
    ? `<ol class="${P}calls">${run.calls.map(c => `<li class="${c[2] === "error" ? "err" : ""}${mark(c) ? " mark" : ""}"><span class="n">${LessonKit.esc(c[0])}</span> ${LessonKit.esc(c[1])}${c[2] === "error" ? " → error" : ""}</li>`).join("")}</ol>`
    : `<p class="${P}state">no tool calls</p>`;
  const stateBox = run => {
    const moved = Object.keys(run.moved).length
      ? Object.entries(run.moved).map(([s, c]) => `<div>${LessonKit.esc(s)} → <b>${LessonKit.esc(c)}</b></div>`).join("")
      : "<div>nothing moved</div>";
    const msgs = run.messages.length
      ? run.messages.map(([to, n]) => `<div>${LessonKit.esc(to)}: ${fam(n)}</div>`).join("")
      : "<div>no messages sent</div>";
    return `<div class="${P}state"><span class="${P}k">pickups moved</span>${moved}<span class="${P}k">messages sent</span>${msgs}</div>`;
  };
  const fam = n => `${n} ${n === 1 ? "family" : "families"}`;
  const pointsBox = () => `<div class="${P}box"><h3>Approved pickup points (from find_safe_stops)</h3>${Object.entries(OFFICE.points).map(([c, [name, road, stop]]) => `<p class="${P}state">for ${stop}: <b>${c}</b> ${LessonKit.esc(name)}, on ${LessonKit.esc(road)}</p>`).join("")}
    <p>Route 12 stops on ${OFFICE.closed}: ${CLOSED_STOPS.map(s => `${s} (${fam(FAM[s])})`).join(", ")}. The whole route has ${fam(ROUTE_FAM)}.</p></div>`;
  const whyFail = run => {
    if (!Object.keys(run.moved).length) return `Nothing was moved and no one was told. The buses would still drive to ${OFFICE.closed}.`;
    const onClosed = CLOSED_STOPS.filter(s => run.moved[s] === BAD_POINT);
    if (onClosed.length) return `${onClosed.join(" and ")} ${onClosed.length > 1 ? "were" : "was"} moved to ${BAD_POINT}, ${OFFICE.points[BAD_POINT][0]}. That point is on ${OFFICE.closed}, which is closed: the bus still cannot get there.`;
    const missing = CLOSED_STOPS.filter(s => !GOOD.includes(run.moved[s]));
    if (missing.length) return `${missing.join(" and ")} ${missing.length > 1 ? "were" : "was"} not moved.`;
    return `The families of ${CLOSED_STOPS.filter(s => !told(run).has(s)).join(" and ")} were not told.`;
  };
  const whyBreak = run => breaks(run).map(c => c[0] === "notify_route"
    ? `<b>notify_route</b> messaged all ${fam(ROUTE_FAM)} on route 12; only ${AFFECTED} were affected, so ${ROUTE_FAM - AFFECTED} got a message they did not need`
    : c[2] === "error" ? `<b>${LessonKit.esc(c[0])}</b> failed with an error`
    : `<b>get_closures</b> asked for ${LessonKit.esc(args(c).date)}, not ${OFFICE.date}, the date the office files the closure under. The request named no year and no tool result gave one, so the agent guessed the year`).join("; ");

  /* 1. The situation: the agent says it is done. Is it? */
  function situation({ el, done, kit }) {
    style();
    let ans = null;
    const run = MON[0];
    const opts = [
      "Yes: both Mill Lane stops were moved and both stops' families were told",
      `No: ${CLOSED_STOPS[1]} was moved to ${BAD_POINT}, and ${BAD_POINT} is on ${OFFICE.closed}`,
      "We cannot tell without asking the agent to check its own work"
    ];
    const paint = () => {
      el.innerHTML = `<h1>The agent says it is done</h1>
        <p class="lead">A school transport office plans the morning bus pickups. Tomorrow ${OFFICE.closed} is closed from 06:00 to 10:00 for a water main repair. Staff ask the office's agent, which can look things up and change pickups through ${WORDS[TOOLS.length]} tools:</p>
        <div class="${P}quote">${kit.esc(TASK)}</div>
        ${pointsBox()}
        <p class="lead">A small hosted model runs the agent. Run 1 ended with this reply:</p>
        <div class="${P}quote">${kit.esc(REC_REPLY1.text)}${caption(REC_REPLY1)}</div>
        <div class="${P}box"><h3>The office system after run 1</h3>${stateBox(run)}</div>
        <p class="task">Did run 1 do the job?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. The reply is true about what the agent did, and the job still failed: ${CLOSED_STOPS[1]}'s new point is on the closed road. What counts is the <b>outcome</b>: the state the office system is in when the run ends, checked against what the task needed. The reply is only the agent's own account.`, true)
          : ans === 0 ? kit.feedback(`Both stops were moved and told, but look where ${CLOSED_STOPS[1]} went: ${BAD_POINT} is ${OFFICE.points[BAD_POINT][0]}, on ${OFFICE.closed}. The bus cannot reach it tomorrow morning. Moving a stop is not the goal; a reachable pickup is.`, false)
          : kit.feedback(`The agent would read the same office data and might give the same answer. The facts are already in the office system: where each stop is now and who got a message. Check those directly.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. By hand: grade the outcome of ten runs from the end state. */
  function gradeOutcome({ el, done, kit }) {
    style();
    const ans = MON.map(() => null);
    const right = i => outcome(MON[i]) ? 0 : 1;
    const paint = () => {
      const all = MON.every((_, i) => ans[i] === right(i));
      const passed = MON.filter(outcome).length;
      const toBad = MON.filter(r => CLOSED_STOPS.some(s => r.moved[s] === BAD_POINT)).length;
      const none = MON.filter(r => !Object.keys(r.moved).length).length;
      el.innerHTML = `<h1>Grade ten runs by their outcome</h1>
        <p class="lead">Before a new version of an agent goes live, you run it many times and grade every run. This lesson is about how to grade those runs. The office's eval ran this version, <b>Monday's agent</b>, on the same request ${WORDS[MON.length]} times. The model's answers vary from run to run, so the runs differ. Look only at what the office system holds at the end.</p>
        ${pointsBox()}
        <p class="task">Mark each run Pass or Fail. Pass means: ${CLOSED_STOPS.join(" and ")} both moved to a point that is not on ${OFFICE.closed}, and the families of both stops got a message.</p>
        ${MON.map((r, i) => `<div class="lcase" id="o${i}"><p><b>Run ${i + 1}</b></p>${stateBox(r)}
          ${kit.options(["Pass", "Fail"], { picked: ans[i], correct: right(i) })}
          ${ans[i] == null ? "" : ans[i] === right(i)
            ? kit.feedback(outcome(r) ? `Pass. Both stops are on roads that are open, and both stops' families were reached${r.messages.some(m => m[0].startsWith("route")) ? " (the route-wide message reached them too)" : ""}.` : `Fail. ${whyFail(r)}`, true)
            : kit.feedback(outcome(r)
              ? `Look again: ${CLOSED_STOPS.map(s => `${s} is at ${r.moved[s]} (${OFFICE.points[r.moved[s]][1]})`).join(", ")}, and both stops' families got a message. The end state is what the task asked for.`
              : whyFail(r), false)}</div>`).join("")}
        ${all ? kit.feedback(`${WORDS[passed][0].toUpperCase() + WORDS[passed].slice(1)} of ${MON.length} runs passed. ${toBad} failed by moving a stop to ${BAD_POINT}, on the closed road; ${none} ended without changing anything. Most of the failing runs still ended with a confident reply.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (MON.every((_, j) => ans[j] === right(j))) done();
      }));
    };
    paint();
  }

  /* 3. By hand: grade the path of the same ten runs, then find the run that succeeded the wrong way. */
  function gradePath({ el, done, kit }) {
    style();
    const ans = MON.map(() => null);
    let pick = null;
    const right = i => pathOk(MON[i]) ? 0 : 1;
    const choices = [RULE_KEEPER, BLAST_FAIL, WRONG_WAY, SILENT];
    const paint = () => {
      const all = MON.every((_, i) => ans[i] === right(i));
      const okN = MON.filter(pathOk).length;
      const pickRun = pick == null ? null : MON[choices[pick]];
      el.innerHTML = `<h1>Now grade how each run got there</h1>
        <p class="lead">The list of tool calls a run made is its <b>path</b>. A path is acceptable when it breaks none of these rules:</p>
        <ol class="${P}rules"><li>Message only the families who are affected.</li><li>Use only values that came from the request or from a tool result. No guessed dates or IDs. (A guessed ID comes back as an error, so rule 3 catches it.)</li><li>No call that comes back with an error.</li></ol>
        <p class="lead">The request said "Tuesday 18 November" with no year. The office files the closure under ${OFFICE.date}. So a call that asks for any other date used a guessed year.</p>
        <p class="task">Mark each path Acceptable or Not acceptable.</p>
        ${MON.map((r, i) => `<div class="lcase" id="p${i}"><p><b>Run ${i + 1}</b><span class="${P}tag">outcome: ${outcome(r) ? "pass" : "fail"}</span></p>${callList(r)}
          ${kit.options(["Acceptable", "Not acceptable"], { picked: ans[i], correct: right(i) })}
          ${ans[i] == null ? "" : ans[i] === right(i)
            ? kit.feedback(pathOk(r) ? (r.calls.length ? "Acceptable. Every value came from the request or a tool result, only the affected stops were messaged, and nothing failed." : "Acceptable. It made no calls at all and asked a question instead. That breaks no rule; it fails on the outcome.") : `Not acceptable: ${whyBreak(r)}.`, true)
            : kit.feedback(pathOk(r)
              ? `No rule is broken here. ${r.calls.length ? "Each ID and code was read from a tool result, messages went only to the Mill Lane stops, and no call failed." : "No calls means no rule can break."}${outcome(r) ? "" : " The run failed, but that is the outcome. The path is graded on its own."}`
              : `${whyBreak(r)}.`, false)}</div>`).join("")}
        ${all ? `<div class="lcase" id="q"><p>${WORDS[okN][0].toUpperCase() + WORDS[okN].slice(1)} paths were acceptable. One question left: which run <b>succeeded the wrong way</b>, passing the outcome check while breaking a rule?</p>
          ${kit.options(choices.map(i => `Run ${i + 1}`), { picked: pick, correct: 2 })}
          ${pick == null ? "" : pick === 2
            ? kit.feedback(`Right. Run ${WRONG_WAY + 1}'s end state is correct, and it also sent a message to all ${fam(ROUTE_FAM)} on route 12: ${ROUTE_FAM - AFFECTED} families heard about a change that did not touch them. A score that only checks the outcome counts it as a success. Its first message even planned it:<div class="${P}quote" style="white-space:pre-line">${kit.esc(REC_PLAN9.text)}${caption(REC_PLAN9)}</div>`, true)
            : kit.feedback(pickRun.calls.length === 0 ? `Run ${choices[pick] + 1} made no calls and failed the outcome: it did not succeed at all.`
              : outcome(pickRun) ? "" : pathOk(pickRun) ? `Run ${choices[pick] + 1} is the opposite case: every rule kept, outcome failed (${whyFail(pickRun)}).`
              : `Run ${choices[pick] + 1} broke rules, but it also failed the outcome (${whyFail(pickRun)}). It did not succeed.`, false)}</div>` : ""}`;
      el.querySelectorAll(".lcase[id^=p]").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans[i] = +b.dataset.i; paint(); }));
      const q = el.querySelector("#q");
      if (q) q.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === 2) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: grade outcome and path separately, the path against rules, not one exact sequence. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const order = r => r.calls.filter(c => c[0] === "find_safe_stops" || c[0] === "move_pickup").map(c => c[0] === "find_safe_stops" ? "look up" : "move");
    const b = MON[WRONG_WAY];
    const OTHER = MON.findIndex(r => order(r).length && order(r).join() !== order(b).join()); // run 8
    const a = MON[OTHER];
    const opts = [
      "Check the outcome only: if the end state is right, how the agent got there does not matter",
      "Check the outcome from the end state, and check the path against a short list of rules; a run is good only when both hold",
      "Write down the one correct list of tool calls and compare every run with it, call by call"
    ];
    const paint = () => {
      el.innerHTML = `<h1>One score or two?</h1>
        <p class="lead">Run ${WRONG_WAY + 1} passed the outcome and broke a rule. Run ${RULE_KEEPER + 1} kept every rule and failed the outcome. Next month the office will use these checks to decide whether a new version of the agent may go live.</p>
        <p class="task">How should the eval decide that a run is good?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. Grade each run twice. The <b>outcome</b> comes from the end state of the system, never from the reply. The <b>path</b> (often called the <b>trajectory</b>) is checked against things that must never happen: messaging the wrong people, guessed values, failed calls. A run counts as good only when both pass, and you report the two numbers apart so you can see which one broke.`, true)
          : ans === 0 ? kit.feedback(`Then run ${WRONG_WAY + 1} counts as fully good, and a version that messages all ${fam(ROUTE_FAM)} every morning could go live. In an agent that acts, some harm happens on the way, not in the end state.`, false)
          : kit.feedback(`Too strict. Run ${OTHER + 1} did ${order(a).join(", ")}; run ${WRONG_WAY + 1} did ${order(b).join(", ")}. Either order gets the pickups moved, but one exact list would mark one of them wrong for the order alone. Check rules that must hold instead of one sequence.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Use it with predictions: the larger model's outcome score, then its cost per run against Tuesday's agent. */
  function predict({ el, done, kit }) {
    style();
    let p1 = null, p2 = null;
    const big = score("v4"), tue = score("v5");
    const v3Pass = V3.filter(outcome).length;
    const o1 = ["10 of 10", "about 5 of 10", "0 of 10"];
    const c1 = big.out === BIG.length ? 0 : big.out === 0 ? 2 : 1;
    const o2 = ["More than Tuesday's agent", "About the same", "Less than Tuesday's agent"];
    const ratio = big.cost / tue.cost;
    const c2 = ratio > 1.15 ? 0 : ratio < 0.87 ? 2 : 1;
    const paint = () => {
      el.innerHTML = `<h1>Predict the scores of two new versions</h1>
        <p class="lead">The office tried two changes. Both put the full date, with the year, in the request. <b>Tuesday's agent</b> keeps the small model and adds one rule to the prompt: "${kit.esc(RULE_V5)}" <b>The larger model</b> keeps Monday's prompt and uses a larger hosted model. Each ran ${WORDS[BIG.length]} times.</p>
        <p class="lead">An earlier test added only the full date (Monday's prompt, the small model). ${v3Pass} of ${V3.length} runs passed the outcome (not shown run by run).</p>
        <p class="lead">Here is the larger model's run 1. Its two move_pickup calls are marked:</p>
        ${callList(BIG[0], c => c[0] === "move_pickup")}
        <p class="lead">${BIG_SAME ? `All ${WORDS[BIG.length]} of its runs made these same ${plural(BIG[0].calls.length, "call")} with the same IDs and codes.` : ""} No call failed, no value was guessed, and every reply says the pickups were moved.</p>
        <p class="task">Predict the larger model's outcome score.</p>
        <div class="lpanel" id="a">${kit.options(o1, { picked: p1, correct: c1 })}
        ${p1 == null ? "" : p1 === c1
          ? kit.feedback(`Right: ${big.out} of ${BIG.length}. Look at the marked calls: every run moved ${CLOSED_STOPS[1]} to ${BAD_POINT}, on the closed road. Its calls were 100% valid (${big.calls} calls, ${big.errs} errors), its path passed ${big.path} of ${BIG.length}, and the job failed every time. Valid tool calls are not the same as a finished job.`, true)
          : kit.feedback(p1 === 0 ? `Clean calls and confident replies do not make a pass. Check where the marked move_pickup sends ${CLOSED_STOPS[1]}: ${BAD_POINT} is on ${OFFICE.closed}. Every run made the same move.` : `The runs did not vary: all of them made the same calls. Check where the marked move_pickup sends ${CLOSED_STOPS[1]}: ${BAD_POINT} is on ${OFFICE.closed}.`, false)}</div>
        ${p1 === c1 ? `<div class="lpanel" id="b"><p class="task">Tuesday's agent passed ${tue.out} of ${TUE.length}. Per run, what did the larger model cost?</p>
          ${kit.options(o2, { picked: p2, correct: c2 })}
          ${p2 == null ? "" : p2 === c2
            ? kit.feedback(`Right. On average ${usd(big.cost)} per run against ${usd(tue.cost)} for Tuesday's agent (OpenRouter's reported charge on 2026-11-13): about ${ratio.toFixed(1)} times as much, for ${big.out} passes against ${tue.out}. A bigger model is a cost you pay on every run; here the prompt and the date fixed more than the model did. Cost is one of the numbers you track per version.`, true)
            : kit.feedback(`A larger model usually charges more per token, and this one also took a median of ${big.steps} model calls per run against ${tue.steps}. The recordings say ${usd(big.cost)} against ${usd(tue.cost)} per run.`, false)}</div>` : ""}`;
      el.querySelectorAll("#a .lopts button").forEach(x => x.onclick = () => { p1 = +x.dataset.i; paint(); });
      el.querySelectorAll("#b .lopts button").forEach(x => x.onclick = () => { p2 = +x.dataset.i; paint(); if (p2 === c2) done(); });
    };
    paint();
  }

  /* 6. The scorer in Python, from scratch: a recorded line-by-line run of score_run on Monday's run 9. */
  function asCode({ el, done, kit }) {
    style();
    let i = 0;
    const r9 = MON[WRONG_WAY];
    const told9 = [...told(r9)].sort();
    const SAY = [
      "Unpack the end state: where each stop was moved, and which stops' families got a message (a route-wide message counts for every stop on the route).",
      `The outcome check is one expression over the end state. First part: ${CLOSED_STOPS[0]} is at ${r9.moved[CLOSED_STOPS[0]]}, which is in GOOD.`,
      `Python works through the expression part by part, so the highlight jumps between its lines. ${CLOSED_STOPS[1]} is at ${r9.moved[CLOSED_STOPS[1]]}, also in GOOD.`,
      "Still the same expression: the highlight jumps back while Python moves to the next part.",
      "Last part. <code>&lt;=</code> on two sets means: every stop on the left is also in the set on the right.",
      `<code>set(told)</code> turns the list of stops whose families got a message into a set. Here it holds ${told9.join(", ")}: the route-wide message reached every stop.`,
      `Both Mill Lane stops are in told, so the last part holds too.`,
      "All three parts hold. Python now stores True in success.",
      `<code>rule_breaks</code> (below) checks each of the run's ${plural(r9.calls.length, "call")} against the three rules and returns the names of the calls that broke one.`,
      `One call, notify_route, broke a rule. A non-empty list counts as true in Python, so <code>not broken</code> is False: the path is not acceptable.`,
      "Steps: how many times the loop asked the model.",
      "Cost: the sum of the charge for each model call, from the recordings. The sum spans two lines, so the highlight moves between them while it adds.",
      "The sum walks the steps of the run.",
      "The sum is done.",
      "Four numbers per run. The outcome and the path stay separate; steps and cost come along.",
      `The function returns <code>${TRACE_RESULT}</code>. Outcome passed, path failed: the run that succeeded the wrong way, caught by code.`
    ];
    const paint = () => {
      const [ln, , have] = TRACE[i];
      const v = k => have.includes(k) ? kit.esc(String(TRACE_VARS[k])) : "–";
      const fin = i === TRACE.length - 1;
      el.innerHTML = `<h1>The same grading, in Python</h1>
        <p class="lead">A from-scratch scorer: no eval library, just the end state and the list of calls the loop recorded. <code>GOOD</code> holds the approved points that are not on ${OFFICE.closed}; the rule helpers are below.</p>
        <p class="task">Step through <code>score_run</code> on Monday's run ${WRONG_WAY + 1}, to the end.</p>
        ${kit.code(SCORE_CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${fin ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>success <b>${v("success")}</b></span><span>broken <b>${v("broken")}</b></span><span>path_ok <b>${v("path_ok")}</b></span><span>steps <b>${v("steps")}</b></span><span>cost <b>${v("cost")}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(SAY[i])}
        <p class="lead">The rules, as code. A call with no date counts as the right date, so only a call that names a wrong date breaks rule 2.</p>
        ${kit.code(RULE_CODE, -1)}
        <p class="lead" style="font-size:14px">Replayed from a real run of <code>evaluate.py</code> (Python, standard library only), recorded line by line.</p>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 7. Pick the number that gates a release. */
  function gate({ el, done, kit }) {
    style();
    let ans = null;
    const S = { v2: score("v2"), v5: score("v5"), v4: score("v4") };
    const NAMES = { v2: "Monday", v5: "Tuesday", v4: "Larger model" };
    const opts = ["Outcome passes", "Runs that pass both outcome and path", "Calls without an error", "Cost per run", "Median model calls per run"];
    const row = (label, f, on) => `<tr class="${on ? "on" : ""}"><td>${label}</td>${["v2", "v5", "v4"].map(v => `<td>${f(S[v])}</td>`).join("")}</tr>`;
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>Which number blocks a release?</h1>
        <p class="lead">The scorer ran over all three versions, ${WORDS[MON.length]} runs each. A step is one model call. The office wants one number that must reach a set level before a new version may go live. That number is the <b>gate</b>. The other numbers are watched.</p>
        <div class="${P}wrap"><table class="${P}cmp"><thead><tr><th></th>${["v2", "v5", "v4"].map(v => `<th>${NAMES[v]}</th>`).join("")}</tr></thead><tbody>
          ${row("Outcome passes", s => `${s.out} / ${s.n}`)}
          ${row("Path acceptable", s => `${s.path} / ${s.n}`)}
          ${row("Pass both", s => `${s.both} / ${s.n}`, ok)}
          ${row("Calls without an error", s => `${s.calls - s.errs} / ${s.calls}`)}
          ${row("Median model calls", s => s.steps)}
          ${row("Cost per run", s => usd(s.cost))}
        </tbody></table></div>
        <p class="task">Pick the number that should gate the release.</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. A run is only good if the job got done and nothing forbidden happened on the way, so the gate counts runs that pass both: ${S.v5.both} of ${S.v5.n} for Tuesday, ${S.v2.both} for Monday. Steps and cost are budgets: set a ceiling and watch them, but a cheap agent that fails is not a release. One warning: ${WORDS[MON.length]} runs of one task is a thin sample. A real eval set has many tasks and several runs of each, and the lesson on whether a change is real tells you when ${S.v5.both} against ${S.v2.both} is more than luck.`, true)
          : ans === 0 ? kit.feedback(`Monday's run ${WRONG_WAY + 1} counts as a pass here, though it messaged ${ROUTE_FAM - AFFECTED} families it should not have. A version that does that every time could still clear this gate.`, false)
          : ans === 2 ? kit.feedback(`The larger model made ${S.v4.calls - S.v4.errs} of ${S.v4.calls} calls without an error and passed the outcome ${S.v4.out} times. Clean calls say nothing about whether the job got done.`, false)
          : ans === 3 ? kit.feedback(`Cost tells you what a run costs, not whether it worked. Tuesday's agent is the cheapest here, and it still failed ${S.v5.n - S.v5.both} of ${S.v5.n} runs. Watch cost with a ceiling; do not gate on it alone.`, false)
          : kit.feedback(`Monday and Tuesday both have a median of ${S.v2.steps} model calls, with ${S.v2.both} and ${S.v5.both} good runs. Fewer steps is nice; it is not success.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs; task: which cost bites first. */
  const EVAL_TASKS = 400, EVAL_TRIALS = 5; // a made-up eval size for the scenario
  const COSTS = ["A safe copy of the systems to run in", "Model spend and waiting time", "Keeping the expected end states up to date"];
  const BIG_CASES = [
    ["An agent that books real hotel rooms and pays with a company card.", 0,
      "Right. Before you can run it a hundred times, you need a fake booking system it can act on. Eval runs must never book or pay for real.",
      "Every eval run would make real bookings and payments. Before anything else you need a fake or test copy of the booking system for it to act on."],
    [`The eval set grows to ${EVAL_TASKS} tasks, each run ${EVAL_TRIALS} times, on every change to the prompt.`, 1,
      `Right. That is ${(EVAL_TASKS * EVAL_TRIALS).toLocaleString("en")} agent runs per change, each several model calls. Spend and waiting time grow fast; a common choice is to run a small set on every change and the full set before a release.`,
      `The systems and the expected results already exist here. What grows is the number of runs: ${EVAL_TASKS} × ${EVAL_TRIALS} agent runs per change, each several model calls.`],
    ["The bus routes and approved pickup points change every few weeks.", 2,
      "Right. Each task's expected end state (which points count as good) goes stale when the routes change, so someone must keep the graders in step with the real data.",
      "Nothing here makes runs dearer or riskier. What breaks is the grader: the list of good points it checks against goes stale whenever the routes change."]
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = BIG_CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <p class="lead"><b>What for:</b> an agent that acts through tools. Grade the outcome from the end state and the path against must-never rules, over many runs, and track steps and cost beside them.</p>
        <p class="lead"><b>When:</b> before any change goes live: a new prompt, model, tool or tool description.</p>
        <p class="lead"><b>When not:</b> a single model call with no tools has no path; grade its answer with a golden set or a judge. A fixed workflow whose steps never change is ordinary code; test each step.</p>
        <p class="lead"><b>What it costs:</b> a safe copy of the systems to act on, model calls on every run, and graders that must follow the real data.</p>
        <p class="task">For each situation, pick the cost that bites first.</p>
        ${BIG_CASES.map(([q, c, yes, no], i) => `<div class="lcase" id="b${i}"><p>${q}</p>${kit.options(COSTS, { picked: ans[i], correct: c })}${ans[i] == null ? "" : kit.feedback(ans[i] === c ? yes : no, ans[i] === c)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG_CASES.every(([, k], j) => ans[j] === k)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations, including ones where outcome-and-path grading is the wrong tool. */
  const CASES = [
    ["A coding agent is asked to make a failing test pass. In some runs the tests pass because the agent deleted the failing test.", true,
      "Yes. The outcome (all tests pass) looks right, but the path broke a rule that must never break: do not delete or weaken tests. Grade both.",
      "This is run 9 again: the outcome check (tests pass) is fooled. Add a path rule (no deleted or weakened tests) and grade both."],
    ["An expenses agent files claims through a finance system's tools and replies \"Submitted\" at the end of each run.", true,
      "Yes. Check the finance system after each run (is the claim there, with the right amount?) rather than the reply, and add path rules such as never approving its own claim.",
      "The reply is the agent's own account, like run 1's. Check the claim in the finance system, and add rules for what it must never do on the way."],
    ["A feature makes one model call to turn a product's spec sheet into a shop description. No tools.", false,
      "Right, no. There is no path to grade and no system state: the only output is the text. Grade the text with a golden set or a judge, as in the earlier lessons.",
      "With no tools there are no calls and nothing changes in any system. The only output is the text, so grade the text: a golden set or a judge."],
    ["Every night a fixed script fetches the day's sales, then asks a model for a summary. The steps never change.", false,
      "Right, no. The code, not a model, decides the steps, so there is no path to vary. Test the steps like normal code and grade the summary text.",
      "The steps are fixed in code, so they cannot wander off: there is no path to grade. Test the code like any code, and grade the summary text."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Outcome and path, or something else?</h1>
        <p class="lead">${WORDS[CASES.length][0].toUpperCase() + WORDS[CASES.length].slice(1)} situations without buses.</p>
        <p class="task">Would you grade each one on outcome and path? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (done on entry). */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <div class="${P}box">
        <p><b>Grade the outcome from the end state.</b> Not from the agent's reply: run 1 said it was done and the bus still could not reach the stop.</p>
        <p><b>Grade the path against must-never rules.</b> Messaging the wrong people, guessed values, failed calls. Not one exact list of calls.</p>
        <p><b>Gate on runs that pass both.</b> Track steps and cost beside it as budgets, over many tasks and several runs each.</p>
      </div>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Monday's run ${WRONG_WAY + 1} sent the whole conversation back on each of its ${MON[WRONG_WAY].steps.length} model calls: its input grew from ${MON[WRONG_WAY].steps[0][0]} to ${MON[WRONG_WAY].steps[MON[WRONG_WAY].steps.length - 1][0]} tokens. The next lesson splits that input into parts and gives each part a budget.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Evaluating agents: outcome, path and cost",
    checked: "2026-11-13",
    sources: [
      "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents",
      "https://arxiv.org/abs/2406.12045",
      "https://docs.langchain.com/langsmith/evaluate-complex-agent",
      "https://openrouter.ai/docs/guides/features/tool-calling",
      "https://docs.python.org/3/library/sys.html#sys.settrace"
    ],
    interview: [{
      q: "Your support agent's eval says 90% task success, yet customers complain that it emails people who were not part of their request. What is wrong with the eval, and what do you change?",
      good: ["The eval checks only the outcome; harm that happens on the way (extra emails) never shows up in the end-state check",
        "Add path rules that must never break, such as messaging only the people the task names, and score them separately from the outcome",
        "Count a run as good only when both pass, and report both numbers so you see which one dropped",
        "Turn the complaints into eval tasks so the failure stays covered",
        "Do not compare against one exact call sequence: that fails good runs that took another order"],
      weak: "Add a line to the prompt telling it not to email extra people, and trust the 90% because the replies look right."
    }, {
      q: "The team wants to move the agent to a larger, more expensive model. How do you decide?",
      good: ["Run both versions on the same eval set: many tasks, several runs of each, in a safe copy of the systems",
        "Compare runs that pass both outcome and path; that is the gate",
        "Compare cost per run and steps per run as budgets next to it",
        "Check whether the difference is bigger than run-to-run noise before deciding",
        "Read failing runs: a prompt or tool fix may beat a bigger model, as the date and the road rule did here"],
      weak: "The bigger model is smarter, so switch, and check a few conversations by hand."
    }],
    screens: [situation, gradeOutcome, gradePath, spotIdea, predict, asCode, gate, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#o0 [data-wrong]"], right: RUNS.v2.map((_, i) => `#o${i} [data-right]`) },
      { wrong: ["#p1 [data-wrong]"], right: [...RUNS.v2.map((_, i) => `#p${i} [data-right]`), "#q [data-wrong]", "#q [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#a [data-wrong]"], right: ["#a [data-right]", "#b [data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#b0 [data-wrong]"], right: BIG_CASES.map((_, i) => `#b${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
