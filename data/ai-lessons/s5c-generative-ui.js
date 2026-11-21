/* Lesson: generative UI, model output as components. Story: a travel-booking chat where "show me hotels near the
   station under 100 dollars" should come back as cards with a map, not a paragraph.
   Ideas: (1) give the model a catalogue of components as tools with typed props; it picks one and fills the props,
   and the page draws a component it owns (or the model answers in text); (2) check the props before drawing, send
   the problems back once, and know what a props check cannot see (a wrong choice, a missing hotel).
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5c-generative-ui/: text-hotels, text-compare, text-booking,
     text-chart (no tools), ui-hotels, ui-compare, ui-booking, ui-chart, ui-breakfast (typed catalogue of four
     component tools), ui-breakfast-2 (one more instruction sentence), loose-hotels (one untyped render_component
     tool) and loose-retry (the validator's problems sent back). Requests built by
     docs/ai-path/runs/s5c-generative-ui/build_requests.py and build_followups.py (files in requests/).
   - docs/ai-path/runs/s5c-generative-ui/card.mjs + card.out.txt: the hotel card's text function run on the props of
     ui-hotels and loose-hotels (the real TypeError).
   - docs/ai-path/runs/s5c-generative-ui/validate.py + validate.out.txt: check_hotel_cards (the code screen), its
     results on three recordings and the line-by-line trace on loose-hotels.
   Lesson-local pictures and style (.lx-s5c-generative-ui-*): hotel cards with a pin map, a booking card, a compare
   table, a small Markdown view of chat text, a JSON block. See ensureStyle(). Plain browser script. */
(() => {
  const ID = "s5c-generative-ui";
  const CHECKED_ON = "2026-11-18";
  const P = `lx-${ID}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const word = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n);
  const Word = n => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s5c-generative-ui/build_requests.py (SEARCH_RESULTS, trimmed to the fields shown;
  // lesson data written for the story and given to the model, not model output)
  const SEARCH = [
    { hotel_id: "H-101", name: "Platform Nine Hotel", price: "USD 84 / night", distance: "250 m", rating: 4.3 },
    { hotel_id: "H-102", name: "Riverside Inn", price: "USD 96 / night", distance: "400 m", rating: 4.0 },
    { hotel_id: "H-103", name: "The Signal Box", price: "USD 72 / night", distance: "650 m", rating: 3.8 },
    { hotel_id: "H-104", name: "Grand Terminus", price: "USD 148 / night", distance: "150 m", rating: 4.7 },
    { hotel_id: "H-105", name: "Canal View Rooms", price: "USD 109 / night", distance: "300 m", rating: 4.1 }
  ];
  const BOUNDS = [[41.3889, 41.3948], [2.1611, 2.1702]]; // min/max lat and lng of all five search results
  const USER = {
    hotels: "show me hotels near the station under 100 dollars",
    compare: "Compare Platform Nine Hotel and Riverside Inn for me: price, distance, rating, breakfast, free cancellation.",
    booking: "Did my booking go through? Show me the details.",
    chart: "How does the price at Riverside Inn change over the week of 8 December?",
    breakfast: "Is breakfast included at Platform Nine Hotel?"
  };
  const BUDGET = 100; // from the user's message
  // build_requests.py LOOSE[0].function.description and the typed price field in CATALOGUE
  const LOOSE_DESC = "Draw a UI component in the chat. component is one of: hotel_cards, compare_table, booking_card, price_chart. For hotel_cards, props has a hotels list; each hotel has hotel_id, name, price_per_night, distance_m, rating, lat, lng.";
  const TYPED_PRICE = "\"price_per_night\": {\"type\": \"number\", \"description\": \"in USD, a number\"}";
  const RULE2 = "Use a component only when the user needs to see or choose between several items or numbers. Answer a yes/no question or a single fact in one short sentence of text, with no tool call."; // build_followups.py RULE

  // From docs/ai-path/recordings/s5c-generative-ui/*.json (text and tool-call arguments not altered).
  // pt / ct = usage.prompt_tokens / usage.completion_tokens.
  const REC = {
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17",
    "text-hotels": { finish: "stop", pt: 727, ct: 113, text: "Here are the hotels near Northgate Station under $100:\n\n*   **Platform Nine Hotel**: $84 / night, 4.3 rating, 250m away, breakfast included, no free cancellation.\n*   **The Signal Box**: $72 / night, 3.8 rating, 650m away, no breakfast, free cancellation.\n*   **Riverside Inn**: $96 / night, 4.0 rating, 400m away, breakfast included, free cancellation." },
    "text-compare": { finish: "stop", pt: 736, ct: 89, text: "**Platform Nine Hotel:**\n* Price: USD 84 / night\n* Distance to station: 250 m\n* Rating: 4.3\n* Breakfast: Yes\n* Free Cancellation: No\n\n**Riverside Inn:**\n* Price: USD 96 / night\n* Distance to station: 400 m\n* Rating: 4.0\n* Breakfast: Yes\n* Free Cancellation: Yes" },
    "text-booking": { finish: "stop", pt: 726, ct: 75, text: "Yes, your booking is confirmed!\n\n**Booking Reference:** NB-4471\n**Hotel:** Platform Nine Hotel\n**Check-in:** 2026-12-12\n**Check-out:** 2026-12-14\n**Guests:** 1\n**Total Cost:** USD 168" },
    "text-chart": { finish: "stop", pt: 731, ct: 99, text: "The price at Riverside Inn changes throughout the week of 8 December as follows:\n- Mon 8 Dec: USD 96\n- Tue 9 Dec: USD 96\n- Wed 10 Dec: USD 89\n- Thu 11 Dec: USD 92\n- Fri 12 Dec: USD 118\n- Sat 13 Dec: USD 124\n- Sun 14 Dec: USD 88" },
    "ui-hotels": { finish: "tool_calls", pt: 1222, ct: 159, call: ["show_hotel_cards", "{\"hotels\":[{\"rating\":4.3,\"price_per_night\":84,\"name\":\"Platform Nine Hotel\",\"lat\":41.3921,\"hotel_id\":\"H-101\",\"distance_m\":250,\"lng\":2.1655},{\"lat\":41.3889,\"name\":\"The Signal Box\",\"lng\":2.1611,\"rating\":3.8,\"price_per_night\":72,\"distance_m\":650,\"hotel_id\":\"H-103\"}]}"] },
    "ui-compare": { finish: "tool_calls", pt: 1231, ct: 97, call: ["show_compare_table", "{\"columns\":[\"features\",\"Platform Nine Hotel\",\"Riverside Inn\"],\"rows\":[[\"price\",\"USD 84 / night\",\"USD 96 / night\"],[\"distance\",\"250 m\",\"400 m\"],[\"rating\",\"4.3\",\"4.0\"],[\"breakfast\",\"yes\",\"yes\"],[\"free cancellation\",\"no\",\"yes\"]]}"] },
    "ui-booking": { finish: "tool_calls", pt: 1221, ct: 79, call: ["show_booking_card", "{\"nights\":2,\"check_in\":\"2026-12-12\",\"hotel_name\":\"Platform Nine Hotel\",\"check_out\":\"2026-12-14\",\"booking_ref\":\"NB-4471\",\"total_usd\":168}"] },
    "ui-chart": { finish: "tool_calls", pt: 1226, ct: 110, call: ["show_price_chart", "{\"labels\":[\"Mon 8 Dec\",\"Tue 9 Dec\",\"Wed 10 Dec\",\"Thu 11 Dec\",\"Fri 12 Dec\",\"Sat 13 Dec\",\"Sun 14 Dec\"],\"values_usd\":[96,96,89,92,118,124,88],\"title\":\"Riverside Inn prices for the week of 8 December\"}"] },
    "ui-breakfast": { finish: "tool_calls", pt: 1218, ct: 87, call: ["show_hotel_cards", "{\"hotels\":[{\"lng\":2.1655,\"price_per_night\":84,\"lat\":41.3921,\"distance_m\":250,\"rating\":4.3,\"hotel_id\":\"H-101\",\"name\":\"Platform Nine Hotel\"}]}"] },
    "ui-breakfast-2": { finish: "stop", pt: 1258, ct: 10, text: "Yes, breakfast is included at Platform Nine Hotel." },
    "loose-hotels": { finish: "tool_calls", pt: 861, ct: 249, call: ["render_component", "{\"props\":{\"hotels\":[{\"rating\":4.3,\"lat\":41.3921,\"distance_m\":250,\"name\":\"Platform Nine Hotel\",\"price_per_night\":\"USD 84 / night\",\"lng\":2.1655,\"hotel_id\":\"H-101\"},{\"rating\":4,\"hotel_id\":\"H-102\",\"lat\":41.3948,\"lng\":2.1702,\"price_per_night\":\"USD 96 / night\",\"name\":\"Riverside Inn\",\"distance_m\":400},{\"distance_m\":650,\"rating\":3.8,\"lat\":41.3889,\"lng\":2.1611,\"name\":\"The Signal Box\",\"hotel_id\":\"H-103\",\"price_per_night\":\"USD 72 / night\"}]},\"component\":\"hotel_cards\"}"] },
    "loose-retry": { finish: "tool_calls", pt: 1185, ct: 264, text: "I'm sorry, I encountered an error when trying to render the hotel cards. I'll try again with the correct information.", call: ["render_component", "{\"component\":\"hotel_cards\",\"props\":{\"hotels\":[{\"rating\":4.3,\"price_per_night\":84,\"distance_m\":250,\"lat\":41.3921,\"lng\":2.1655,\"name\":\"Platform Nine Hotel\",\"hotel_id\":\"H-101\"},{\"name\":\"Riverside Inn\",\"lat\":41.3948,\"lng\":2.1702,\"hotel_id\":\"H-102\",\"rating\":4,\"price_per_night\":96,\"distance_m\":400},{\"hotel_id\":\"H-103\",\"rating\":3.8,\"price_per_night\":72,\"lng\":2.1611,\"distance_m\":650,\"name\":\"The Signal Box\",\"lat\":41.3889}]}}"] }
  };
  // The tool message sent back in loose-retry (from loose-retry.request.json, last message's content)
  const RETRY_TOOL_MSG = "{\"error\": \"props rejected, nothing was drawn\", \"problems\": [\"hotels[0].price_per_night: want number, got str\", \"hotels[1].price_per_night: want number, got str\", \"hotels[2].price_per_night: want number, got str\"]}";
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;

  // From docs/ai-path/runs/s5c-generative-ui/card.mjs and card.out.txt
  const CARD_JS = [
    "function hotelCard(hotel) {",
    "  const price = hotel.price_per_night.toFixed(0);",
    "  return `${hotel.name}: $${price} a night, ${hotel.distance_m} m away`;",
    "}"
  ];
  const CARD_ERROR = "TypeError: hotel.price_per_night.toFixed is not a function"; // card.out.txt, loose-hotels
  const CARD_OK = ["Platform Nine Hotel: $84 a night, 250 m away", "The Signal Box: $72 a night, 650 m away"]; // card.out.txt, ui-hotels

  // The listing is check_hotel_cards from validate.py, line for line (line 0 = def).
  const CODE = [
    "def check_hotel_cards(props):",
    "    problems = []",
    "    hotels = props.get(\"hotels\")",
    "    if type(hotels) is not list or not hotels:",
    "        return [\"hotels: want a non-empty list\"]",
    "    for i, hotel in enumerate(hotels):",
    "        for field, want in HOTEL_FIELDS.items():",
    "            value = hotel.get(field)",
    "            if value is None:",
    "                problems.append(f\"hotels[{i}].{field}: missing\")",
    "            elif type(value) not in TYPES[want]:",
    "                problems.append(f\"hotels[{i}].{field}: want {want}, got {type(value).__name__}\")",
    "    return problems"
  ];
  const HOTEL_FIELDS = { hotel_id: "text", name: "text", price_per_night: "number", distance_m: "number", rating: "number", lat: "number", lng: "number" };
  // validate.out.txt: results per recording, then the trace on loose-hotels as rows
  // [line about to run, event (l = line, r = return), i, field, value, len(problems)]
  const CHECKED = {
    "loose-hotels": ["hotels[0].price_per_night: want number, got str", "hotels[1].price_per_night: want number, got str", "hotels[2].price_per_night: want number, got str"],
    "ui-hotels": [], "loose-retry": []
  };
  const TRACE = [[1,"l",null,null,null,0],[2,"l",null,null,null,0],[3,"l",null,null,null,0],[5,"l",null,null,null,0],[6,"l",0,null,null,0],[7,"l",0,"hotel_id",null,0],[8,"l",0,"hotel_id","H-101",0],[10,"l",0,"hotel_id","H-101",0],[6,"l",0,"hotel_id","H-101",0],[7,"l",0,"name","H-101",0],[8,"l",0,"name","Platform Nine Hotel",0],[10,"l",0,"name","Platform Nine Hotel",0],[6,"l",0,"name","Platform Nine Hotel",0],[7,"l",0,"price_per_night","Platform Nine Hotel",0],[8,"l",0,"price_per_night","USD 84 / night",0],[10,"l",0,"price_per_night","USD 84 / night",0],[11,"l",0,"price_per_night","USD 84 / night",0],[6,"l",0,"price_per_night","USD 84 / night",1],[7,"l",0,"distance_m","USD 84 / night",1],[8,"l",0,"distance_m",250,1],[10,"l",0,"distance_m",250,1],[6,"l",0,"distance_m",250,1],[7,"l",0,"rating",250,1],[8,"l",0,"rating",4.3,1],[10,"l",0,"rating",4.3,1],[6,"l",0,"rating",4.3,1],[7,"l",0,"lat",4.3,1],[8,"l",0,"lat",41.3921,1],[10,"l",0,"lat",41.3921,1],[6,"l",0,"lat",41.3921,1],[7,"l",0,"lng",41.3921,1],[8,"l",0,"lng",2.1655,1],[10,"l",0,"lng",2.1655,1],[6,"l",0,"lng",2.1655,1],[5,"l",0,"lng",2.1655,1],[6,"l",1,"lng",2.1655,1],[7,"l",1,"hotel_id",2.1655,1],[8,"l",1,"hotel_id","H-102",1],[10,"l",1,"hotel_id","H-102",1],[6,"l",1,"hotel_id","H-102",1],[7,"l",1,"name","H-102",1],[8,"l",1,"name","Riverside Inn",1],[10,"l",1,"name","Riverside Inn",1],[6,"l",1,"name","Riverside Inn",1],[7,"l",1,"price_per_night","Riverside Inn",1],[8,"l",1,"price_per_night","USD 96 / night",1],[10,"l",1,"price_per_night","USD 96 / night",1],[11,"l",1,"price_per_night","USD 96 / night",1],[6,"l",1,"price_per_night","USD 96 / night",2],[7,"l",1,"distance_m","USD 96 / night",2],[8,"l",1,"distance_m",400,2],[10,"l",1,"distance_m",400,2],[6,"l",1,"distance_m",400,2],[7,"l",1,"rating",400,2],[8,"l",1,"rating",4,2],[10,"l",1,"rating",4,2],[6,"l",1,"rating",4,2],[7,"l",1,"lat",4,2],[8,"l",1,"lat",41.3948,2],[10,"l",1,"lat",41.3948,2],[6,"l",1,"lat",41.3948,2],[7,"l",1,"lng",41.3948,2],[8,"l",1,"lng",2.1702,2],[10,"l",1,"lng",2.1702,2],[6,"l",1,"lng",2.1702,2],[5,"l",1,"lng",2.1702,2],[6,"l",2,"lng",2.1702,2],[7,"l",2,"hotel_id",2.1702,2],[8,"l",2,"hotel_id","H-103",2],[10,"l",2,"hotel_id","H-103",2],[6,"l",2,"hotel_id","H-103",2],[7,"l",2,"name","H-103",2],[8,"l",2,"name","The Signal Box",2],[10,"l",2,"name","The Signal Box",2],[6,"l",2,"name","The Signal Box",2],[7,"l",2,"price_per_night","The Signal Box",2],[8,"l",2,"price_per_night","USD 72 / night",2],[10,"l",2,"price_per_night","USD 72 / night",2],[11,"l",2,"price_per_night","USD 72 / night",2],[6,"l",2,"price_per_night","USD 72 / night",3],[7,"l",2,"distance_m","USD 72 / night",3],[8,"l",2,"distance_m",650,3],[10,"l",2,"distance_m",650,3],[6,"l",2,"distance_m",650,3],[7,"l",2,"rating",650,3],[8,"l",2,"rating",3.8,3],[10,"l",2,"rating",3.8,3],[6,"l",2,"rating",3.8,3],[7,"l",2,"lat",3.8,3],[8,"l",2,"lat",41.3889,3],[10,"l",2,"lat",41.3889,3],[6,"l",2,"lat",41.3889,3],[7,"l",2,"lng",41.3889,3],[8,"l",2,"lng",2.1611,3],[10,"l",2,"lng",2.1611,3],[6,"l",2,"lng",2.1611,3],[5,"l",2,"lng",2.1611,3],[12,"l",2,"lng",2.1611,3],[12,"r",2,"lng",2.1611,3]];

  /* ---------- Derived from the data ---------- */
  const args = name => JSON.parse(REC[name].call[1]);
  const propsOf = name => { const a = args(name); return a.props || a; };
  const COMPONENTS = [
    ["show_hotel_cards", "Hotel cards with a map"],
    ["show_compare_table", "Compare table"],
    ["show_booking_card", "Booking card"],
    ["show_price_chart", "Price chart"],
    [null, "Keep it as text"]
  ];
  const NCOMP = COMPONENTS.length - 1; // the four component tools of the typed catalogue (ui-*.request.json)
  const NDAYS = args("ui-chart").labels.length;
  const NFEAT = args("ui-compare").rows.length;
  const priceNum = s => Number(String(s).match(/\d+/)[0]);
  const UNDER = SEARCH.filter(h => priceNum(h.price) < BUDGET);
  const TYPED_IDS = propsOf("ui-hotels").hotels.map(h => h.hotel_id);
  const MISSING = UNDER.filter(h => !TYPED_IDS.includes(h.hotel_id));
  const LOOSE_H = propsOf("loose-hotels").hotels;

  /* ---------- Lesson-local style and pictures ---------- */
  function ensureStyle() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
      .${P}-chat { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .${P}-row { display: grid; grid-template-columns: 6.5em 1fr; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
      .${P}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}-txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .${P}-txt ul { margin: 4px 0; padding-left: 1.2em; }
      .${P}-txt p { margin: 0 0 6px; }
      .${P}-mono { margin: 8px 0 0; font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .${P}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}-ui { margin: 14px 0 0; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
      .${P}-ui-t { margin: 0 0 8px; font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
      .${P}-card { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; background: var(--bg); font-size: 14.5px; line-height: 1.4; }
      .${P}-card b { display: block; font-size: 15px; }
      .${P}-card span { color: var(--ink-2); }
      .${P}-n { display: inline-block; min-width: 1.5em; font: 600 13px var(--mono); }
      .${P}-map { display: block; width: 100%; max-width: 420px; height: auto; margin: 10px 0 0; }
      .${P}-map rect { fill: var(--sunk); stroke: var(--line); }
      .${P}-map circle { fill: var(--surface); stroke: var(--ink); stroke-width: 2; }
      .${P}-map text { fill: var(--ink); font: 600 12px var(--mono); }
      .${P}-tbl { width: 100%; border-collapse: collapse; font-size: 14.5px; }
      .${P}-tbl th, .${P}-tbl td { text-align: left; padding: 6px 6px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
      .${P}-tbl th { font-weight: 600; color: var(--muted); }
      .${P}-bk { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; font-size: 15px; }
      .${P}-bk dt { color: var(--muted); }
      .${P}-bk dd { margin: 0; font-weight: 600; }
      .${P}-opt { font: 500 13.5px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .${P}-q { margin: 14px 0 0; }
      @media (max-width: 520px) { .${P}-row { grid-template-columns: 1fr; } .${P}-code .lcode { font-size: 12px; line-height: 1.5; } .${P}-code .lcode div { padding: 0 10px 0 calc(10px + 2ch); } }
    `;
    document.head.appendChild(s);
  }
  // rows: [[who, html]]
  const chat = (kit, rows) => `<div class="${P}-chat">${rows.map(([who, html]) => `<div class="${P}-row"><div class="${P}-who">${kit.esc(who)}</div><div class="${P}-txt">${html}</div></div>`).join("")}</div>`;
  const mono = (kit, s) => `<div class="${P}-mono">${kit.esc(s)}</div>`;
  const cap = () => `<p class="${P}-cap">${CAPTION}</p>`;
  const callBlock = (kit, rec) => mono(kit, `finish_reason: "${rec.finish}"\ntool call: ${rec.call[0]}\narguments: ${rec.call[1]}`);
  // A chat app shows Markdown: bold and bullet lines. This draws the recorded text that way (text not changed).
  function md(kit, text) {
    const inline = s => kit.esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    const out = []; let list = [];
    const flush = () => { if (list.length) out.push(`<ul>${list.map(x => `<li>${x}</li>`).join("")}</ul>`); list = []; };
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*[*-]\s+(.*)$/);
      if (m) { list.push(inline(m[1])); continue; }
      flush();
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    flush();
    return out.join("");
  }
  // The page's hotel-cards component, drawn from props: cards plus a pin per hotel on a small map.
  function hotelCards(kit, hotels, title) {
    const [la, ln] = BOUNDS, W = 300, H = 150, pad = 26;
    const x = h => pad + (h.lng - ln[0]) / (ln[1] - ln[0]) * (W - 2 * pad);
    const y = h => H - pad - (h.lat - la[0]) / (la[1] - la[0]) * (H - 2 * pad);
    return `<div class="${P}-ui"><p class="${P}-ui-t">${kit.esc(title || "show_hotel_cards, drawn by the page")}</p>
      <div class="${P}-cards">${hotels.map((h, i) => `<div class="${P}-card"><span class="${P}-n">${i + 1}</span><b>${kit.esc(h.name)}</b><span>$${kit.esc(h.price_per_night)} a night · ${kit.esc(h.distance_m)} m · rated ${kit.esc(h.rating)}</span></div>`).join("")}</div>
      <svg class="${P}-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map with ${plural(hotels.length, "pin")}"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6"/>${hotels.map((h, i) => `<circle cx="${x(h).toFixed(1)}" cy="${y(h).toFixed(1)}" r="11"/><text x="${x(h).toFixed(1)}" y="${(y(h) + 4).toFixed(1)}" text-anchor="middle">${i + 1}</text>`).join("")}</svg></div>`;
  }
  function bookingCard(kit, b) {
    const rows = [["Reference", b.booking_ref], ["Hotel", b.hotel_name], ["Check-in", b.check_in], ["Check-out", b.check_out], ["Nights", b.nights], ["Total", `$${b.total_usd}`]];
    return `<div class="${P}-ui"><p class="${P}-ui-t">show_booking_card, drawn by the page</p><dl class="${P}-bk">${rows.map(([k, v]) => `<dt>${kit.esc(k)}</dt><dd>${kit.esc(v)}</dd>`).join("")}</dl></div>`;
  }
  function priceChart(kit, c) {
    return `<div class="${P}-ui"><p class="${P}-ui-t">show_price_chart, drawn by the page</p>${kit.bars(c.values_usd, { cls: Object.fromEntries(c.values_usd.map((_, i) => [i, "in"])), labels: c.labels.map(l => l.slice(0, 3)) })}</div>`;
  }

  /* A question block that remembers a pick and shows its feedback. */
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked], picked === correct)}`;
  }
  const spaced = o => JSON.stringify(o).replace(/,"/g, ", \"").replace(/":/g, "\": ").replace(/,(?=[\d"])/g, ", ");
  const optMono = (kit, s) => `<span class="${P}-opt">${kit.esc(s)}</span>`;

  /* 1. The situation: hotels came back as a paragraph. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const R = REC["text-hotels"];
    const opts = ["Each hotel's price", "Each hotel's position for a map pin", "Each hotel's name", "Each hotel's rating"];
    const RIGHT = 1;
    const textPrices = R.text.match(/\$\d+/g).join(", ");
    const fb = [
      `The prices are there (${textPrices}), but inside sentences. The page could dig them out with a pattern, until the model writes “84 dollars” next time. Still, they are there. What is not there at all?`,
      "Right. The paragraph says “250m away”, which no map can place. The search results had each hotel's latitude and longitude, but a paragraph has no slot for them, and the model left them out. Even the parts that are there (names, prices) sit inside sentences, worded differently each time. The page needs <b>data in fixed fields</b>, not text it must read.",
      "The names are there, in bold. A pattern could even find them, as long as the model keeps writing them the same way. Look for what the paragraph has no way to say.",
      "The ratings are there (“4.3 rating”). Look for what a map needs that a sentence like “250m away” cannot give."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Hotels as a paragraph</h1>
        <p class="lead">A travel-booking app has a chat. The app's search already found hotels near Northgate Station and handed them to the model. A user types:</p>
        ${chat(kit, [["user", kit.esc(USER.hotels)], ["model", md(kit, R.text)]])}
        ${cap()}
        <p class="lead">The answer is correct, and the product team is not happy. They want what the rest of the app shows: a card per hotel that the user can tap, and a pin per hotel on a map.</p>
        <p class="task">What does the page need for that, which this answer does not give it at all?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand, part 1: which component fits each recorded text answer? */
  const PICKS = [
    { rec: "compare", fb: [
      `Cards are for a list of hotels to choose from, one card each. This user asked to compare ${word(NFEAT)} things across two hotels, so each thing should sit in one line, side by side.`,
      null,
      "Nothing is being booked. The user is still choosing between two hotels.",
      "A chart needs one number per bar. Breakfast and free cancellation are yes or no, not amounts.",
      "Text works, but the reader has to match lines across two lists by eye (“Breakfast: Yes” here, “Breakfast: Yes” there). The user asked to compare, and a table puts each feature in one row."] },
    { rec: "booking", fb: [
      "Cards are for choosing between hotels. This booking is already made: one booking, one card.",
      "There is nothing to compare: one booking, one hotel.",
      null,
      "There is no series of numbers here, only one total.",
      "The text is readable, but a booking card can carry buttons the page wires up itself, such as “Add to calendar” or “Cancel”. Text cannot have a button that does something."] },
    { rec: "chart", fb: [
      `There is only one hotel here. The question is how one price changes over ${word(NDAYS)} nights.`,
      `A table could hold ${word(NDAYS)} prices. But the user asked how the price changes, and that is a shape: which nights jump. A chart shows it at a glance; a table makes the reader compare ${word(NDAYS)} numbers.`,
      "Nothing is booked. The user is asking about prices.",
      null,
      `${Word(NDAYS)} lines of “USD 96”, “USD 89”… The reader has to find the peak himself. Bars show the expensive nights at once.`] }
  ];
  function pickComponents({ el, done, kit }) {
    ensureStyle();
    const ans = PICKS.map(() => null);
    const right = PICKS.map(p => COMPONENTS.findIndex(c => c[0] === REC["ui-" + p.rec].call[0]));
    const paint = () => {
      el.innerHTML = `<h1>Which component fits?</h1>
        <p class="lead">This lesson's fix: let the model answer with one of the page's own components, filled with data, instead of a paragraph. The chat page has ${word(NCOMP)} components ready (the first ${word(NCOMP)} buttons below). Here are ${word(PICKS.length)} more questions the same model answered in plain text, without any components.</p>
        <p class="task">For each answer, pick the component that should have shown it. Pick again if you change your mind.</p>
        ${PICKS.map((p, i) => `<div class="lcase" id="c${i}">${chat(kit, [["user", kit.esc(USER[p.rec])], ["model", md(kit, REC["text-" + p.rec].text)]])}${cap()}
          ${kit.options(COMPONENTS.map(c => kit.esc(c[1])), { picked: ans[i], correct: right[i] })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === right[i] ? `Right. Later the same model was given these components as tools. For this question it called <code>${kit.esc(COMPONENTS[right[i]][0])}</code> too.` : p.fb[ans[i]], ans[i] === right[i])}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === right[j])) done();
      }));
    };
    paint();
  }

  /* 3. By hand, part 2: fill in the props for the booking card and the chart. */
  function fillProps({ el, done, kit }) {
    ensureStyle();
    const BK = args("ui-booking"), CH = args("ui-chart");
    const bkShow = b => spaced({ booking_ref: b.booking_ref, hotel_name: b.hotel_name, check_in: b.check_in, check_out: b.check_out, nights: b.nights, total_usd: b.total_usd });
    const datesN = (Date.parse(BK.check_out) - Date.parse(BK.check_in)) / 864e5 + 1; // calendar days touched
    const bkOpts = [{ ...BK, nights: datesN }, BK, { ...BK, total_usd: "USD " + BK.total_usd }];
    const chShow = c => spaced({ labels: c.labels, values_usd: c.values_usd });
    const dropAt = CH.values_usd.findIndex((v, k) => k > 0 && v === CH.values_usd[k - 1]); // a repeated price, easy to skip when copying
    const chOpts = [{ ...CH, values_usd: CH.values_usd.map(v => "USD " + v) }, { ...CH, values_usd: CH.values_usd.filter((_, k) => k !== dropAt) }, CH];
    const B = [
      { id: "b0", rec: "booking", opts: bkOpts, show: bkShow, right: 1, fb: [
        `Count nights, not dates. ${BK.check_in} to ${BK.check_out} touches ${datesN} dates but is ${BK.nights} nights. The card would say ${datesN} nights next to a total for ${BK.nights}.`,
        null,
        `<code>total_usd</code> is a number in the component's schema; “USD ${BK.total_usd}” is the text from the answer. The page formats money itself. A string breaks any sum, and any code that formats it as a number.`] },
      { id: "b1", rec: "chart", opts: chOpts, show: chShow, right: 2, fb: [
        "<code>values_usd</code> must be numbers: the chart computes each bar's height from them. Text like “USD 96” has no height.",
        `${plural(CH.labels.length, "label")}, ${plural(CH.values_usd.length - 1, "value")}: one repeated price was skipped while copying. Every bar after it would stand over the wrong day.`,
        null] }
    ];
    const ans = B.map(() => null);
    const paint = () => {
      const fin = ans.every((a, i) => a === B[i].right);
      el.innerHTML = `<h1>Fill in the props</h1>
        <p class="lead">A component takes <b>props</b>, just like a React component. The page's booking card takes ${word(Object.keys(BK).length)} props. The chart takes labels and values (and a title, left out here). The component's schema gives each prop a type, such as text or number.</p>
        <p class="task">For each recorded answer, pick the props that turn it into a correct component call.</p>
        ${B.map((q, i) => `<div class="lcase" id="${q.id}">${chat(kit, [["model", md(kit, REC["text-" + q.rec].text)]])}
          <p class="${P}-q"><code>${kit.esc(REC["ui-" + q.rec].call[0])}</code> props:</p>
          ${kit.options(q.opts.map(o => optMono(kit, q.show(o))), { picked: ans[i], correct: q.right })}
          ${ans[i] == null ? "" : ans[i] === q.right ? kit.feedback("Right.", true) : kit.feedback(q.fb[ans[i]], false)}</div>`).join("")}
        ${fin ? `${bookingCard(kit, BK)}${priceChart(kit, CH)}
          <p class="lead">Then the same model was given the ${word(NCOMP)} components as tools, with typed props. For these ${word(B.length)} questions it sent:</p>
          ${callBlock(kit, REC["ui-booking"])}${callBlock(kit, REC["ui-chart"])}${cap()}
          ${kit.feedback(`The same values you picked (the chart also got a title). You turned text into a <b>component call</b>: a component's name plus props that match its types. The page can draw that directly, with no text to read.`, true)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === B[j].right)) done();
      }));
    };
    paint();
  }

  /* 4. Spot the idea: who drew the cards? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const R = REC["ui-hotels"];
    const opts = [
      "The model: its reply held the cards' HTML and a map",
      "The API provider: it turns tool calls into UI",
      "This page: it has a hotel-cards component, and the model only chose it by name and filled in its props",
      "The browser: it shows any JSON as cards"
    ];
    const RIGHT = 2;
    const fb = [
      `Look at the reply: <code>finish_reason</code> “${R.finish}”, a function name and a JSON string of names and numbers. No HTML, no map. Every line of layout came from the page.`,
      "The API sent back JSON and nothing else. It knows nothing about your page. A phone app could draw the same call as a list, and a voice app could read it out.",
      `Right. This is <b>generative UI</b>: you give the model a catalogue of components as tools, each with a typed schema for its props. The model picks one and fills the props, or answers in text. Your code draws a component you built and tested. The model never writes markup. In the Vercel AI SDK, for example (its documentation on ${CHECKED_ON}), each tool call reaches the React client as a message part. The part's type is <code>tool-</code> plus the tool's name, and you map that type to a component. Other stacks name the parts differently; the idea is the same.`,
      "A browser shows JSON as plain text. Something has to map the name <code>show_hotel_cards</code> to a component, and that something is your code."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Who drew the cards?</h1>
        <p class="lead">Same question, same search results. This time the model was given the ${word(NCOMP)} components as <b>tools</b> (function calling, as in the function-calling lesson). Its whole reply:</p>
        ${chat(kit, [["user", kit.esc(USER.hotels)], ["model", callBlock(kit, R)]])}${cap()}
        <p class="lead">The page turned that reply into this:</p>
        ${hotelCards(kit, propsOf("ui-hotels").hotels)}
        <p class="task">Where did the cards' layout and the map come from?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. When text is the better reply: a yes/no question got a card. */
  function textBetter({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const R = REC["ui-breakfast"], R2 = REC["ui-breakfast-2"];
    const opts = [
      "Remove <code>show_hotel_cards</code> from the catalogue",
      "Add a props rule: hotel cards need at least two hotels",
      "Say in the instructions when text is the right reply",
      "Switch to a bigger model"
    ];
    const RIGHT = 2;
    const fb = [
      "Then the hotel search loses its cards too. The component is fine. The model chose it for the wrong question.",
      "That rule would reject this call, but the user would still get no answer. And one card is fine when only one hotel matches a search. The fault is the choice of component, not its props.",
      `Right. The team added one sentence to the instructions: “${kit.esc(RULE2)}” Same question, same tools:${chat(kit, [["model", kit.esc(R2.text)]])}${cap()}The reply has no tool call (<code>finish_reason</code> “${R2.finish}”). A check on the props could never catch the first reply: every field was there with the right type. Choosing between a component and text is part of the model's job, so tell it how. Then test that choice on many questions (the evaluation lessons), not on one run like this.`,
      "Maybe it would choose better, but you do not know without testing, and each call costs more. The first reply was a reasonable reading of unclear instructions: the instructions said “When one of your tools fits the answer, call it”. Fix what you told it first."
    ];
    const paint = () => {
      el.innerHTML = `<h1>A card for a yes or no</h1>
        <p class="lead">Same app, same ${word(NCOMP)} components. A user asks a yes/no question. The recorded reply, and what the page drew from it:</p>
        ${chat(kit, [["user", kit.esc(USER.breakfast)], ["model", callBlock(kit, R)]])}${cap()}
        ${hotelCards(kit, propsOf("ui-breakfast").hotels)}
        <p class="lead">The card has no breakfast field. The user's question is not answered anywhere on the screen.</p>
        <p class="task">The props are valid. What do you change?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: the props that crashed the page, and the schema rule that catches them. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const h0 = LOOSE_H[0];
    const fields = Object.keys(h0);
    const CULPRIT = fields.indexOf("price_per_night");
    const why = {
      rating: `${h0.rating} is a number, and the card function above does not even use it.`,
      lat: "A number, as the map expects. It is also the right position.",
      lng: "A number, as the map expects. It is also the right position.",
      distance_m: `${h0.distance_m} is a number; the card prints it as it is.`,
      name: "A name is text, and the card prints it as text.",
      hotel_id: "Text is right for an id. The card does not do arithmetic with it."
    };
    const rules = [
      "\"required\": [\"price_per_night\"]",
      "\"price_per_night\": {\"type\": \"number\"}",
      "\"hotels\": {\"type\": \"array\", \"minItems\": 1}",
      "\"rating\": {\"type\": \"number\", \"maximum\": 5}"
    ];
    const RRULE = 1;
    const rfb = [
      `The field is there in all ${LOOSE_H.length} hotels. <code>required</code> only checks that a key exists, not what is in it.`,
      `Right. JSON Schema's <code>number</code> type accepts 84 and 4.3 and rejects numbers written as text, such as “USD 84 / night”. The typed catalogue had this rule (<code>${kit.esc(TYPED_PRICE)}</code>), and with it this model sent <code>84</code> in its run. Some APIs can force a reply to follow a JSON schema (OpenRouter calls this structured outputs, with <code>strict: true</code>), but OpenRouter's own documentation says an exact match to the schema is not guaranteed on every endpoint. So the page checks the props itself, before drawing.`,
      `The list has ${LOOSE_H.length} hotels; it is not empty. The crash happened inside one hotel.`,
      `Ratings ${LOOSE_H.map(h => h.rating).join(", ")} are all fine, and the rating did not crash anything.`
    ];
    const paint = () => {
      const fopts = fields.map(f => optMono(kit, `${f}: ${JSON.stringify(h0[f])}`));
      el.innerHTML = `<h1>The props that crashed the page</h1>
        <p class="lead">A teammate made the catalogue simpler: one tool, <code>render_component</code>, with <code>props</code> typed only as <code>{"type": "object"}</code>, so any object passes. The fields are described only in words, in the tool's description: “${kit.esc(LOOSE_DESC)}”</p>
        <p class="lead">Same question, same search results. The model's reply:</p>
        ${callBlock(kit, REC["loose-hotels"])}${cap()}
        <p class="lead">The page's card component builds its text like this. Run on these props, it threw:</p>
        <div class="${P}-code">${kit.code(CARD_JS, -1)}</div>
        ${mono(kit, CARD_ERROR)}
        <p class="lead">In React, an error thrown during rendering removes the UI from the screen, unless an error boundary shows a fallback in its place.</p>
        ${phase === 0 ? `<p class="task">Which field of the first hotel made the card function throw? Tap it.</p>
          <div class="lpanel">${kit.options(fopts, { picked: ans, correct: CULPRIT })}${ans == null ? "" : kit.feedback(why[fields[ans]] || "", false)}</div>`
        : `${kit.feedback(`Yes: <code>price_per_night</code> is “${kit.esc(h0.price_per_night)}”, text copied from the search results. A string has no <code>toFixed</code> method, so the call throws. All ${LOOSE_H.length} hotels have the same problem. With the typed catalogue, the same model sent <code>84</code>, and the same function printed “${kit.esc(CARD_OK[0])}”.`, true)}
          <p class="task">Which rule in the props schema would have caught this before the page drew anything?</p>
          <div class="lpanel">${ask(kit, rules.map(r => optMono(kit, r)), RRULE, ans, rfb)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (phase === 0 && ans === CULPRIT) { phase = 1; ans = null; }
        paint();
        if (phase === 1 && ans === RRULE) done();
      });
    };
    paint();
  }

  /* 7. The check, from scratch in Python: a stepped replay of the traced run on the broken props. */
  const FR = (() => {
    const fr = [];
    TRACE.forEach((r, k) => {
      const [line, ev, i, field] = r;
      if (k === 3) fr.push({ k, kind: "start" });                       // about to start the loop
      else if (line === 10 && (i === 0 || field === "price_per_night")) fr.push({ k, kind: "check" });
      else if (line === 11) fr.push({ k, kind: "add" });
      else if (ev === "r") fr.push({ k, kind: "end" });
    });
    return fr;
  })();
  function sayFrame(kit, f) {
    const [line, , i, field, value, n] = TRACE[f.k];
    if (f.kind === "start") return `<code>hotels</code> is a list of ${plural(LOOSE_H.length, "hotel")}, not empty, so the check does not return early. The loop is next.`;
    if (f.kind === "end") return `Done: ${plural(n, "problem")}, one per hotel. The page draws nothing from these props. The results on the other two recordings, from the same run: the typed reply gave ${plural(CHECKED["ui-hotels"].length, "problem")}, and the retry on the next screen gave ${plural(CHECKED["loose-retry"].length, "problem")}.`;
    if (f.kind === "add") return `Line ${line} adds “${kit.esc(CHECKED["loose-hotels"][n])}”. This message names the hotel, the field and both types, because the model will read it.`;
    const want = HOTEL_FIELDS[field], isNum = typeof value === "number";
    const fits = want === "number" ? isNum : typeof value === "string";
    const next = TRACE[f.k + 1][0];
    const skip = i > 0 ? ` The replay skips hotel ${i}'s other fields: like hotel 0's, they fit.` : "";
    return `Hotel ${i}, field <code>${kit.esc(field)}</code>: <code>${kit.esc(JSON.stringify(value))}</code> is ${isNum ? "a number" : "text (str)"}, and the schema wants ${want}. ${fits ? "It fits, so nothing is added." : `It does not fit, so line ${next} runs next.`}${skip}`;
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let s = 0;
    const paint = () => {
      const f = FR[s], r = TRACE[f.k];
      el.innerHTML = `<h1>The check, in Python</h1>
        <p class="lead">Before the page draws a component, it checks the props against that component's fields. Here is that check, written from scratch for the hotel cards. It runs on the broken props from the last screen. <code>HOTEL_FIELDS</code> maps each field to <code>"text"</code> or <code>"number"</code>; <code>TYPES</code> maps those to Python types. In production a schema library does the same job with less code.</p>
        <p class="task">Step through to the end. The marked line runs next.</p>
        <div class="${P}-code">${kit.code(CODE, r[0])}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${s === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${s === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>i <b>${r[2] == null ? "–" : r[2]}</b></span><span>field <b>${kit.esc(f.kind === "start" || f.kind === "end" ? "–" : r[3])}</b></span><span>len(problems) <b>${r[5]}</b></span><span>step <b>${s + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}`;
      el.querySelector("[data-prev]").onclick = () => { s--; paint(); };
      el.querySelector("[data-next]").onclick = () => { s++; paint(); if (s === FR.length - 1) done(); };
    };
    paint();
  }

  /* 8. What the page does when the check fails: send the problems back once, then fall back to text. */
  function retry({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const R = REC["loose-retry"];
    const fixed = propsOf("loose-retry").hotels;
    const opts = [
      "The same props again",
      "A new call with the prices as numbers",
      "Plain text with no tool call",
      "A different component"
    ];
    const RIGHT = 1;
    const fb = [
      "Some models might do that, and then your retry limit matters. But this message names each field and the type it wants, and the tool is still on offer. The model reads a tool result like any other, so it has what it needs to change the value.",
      `Right. The recorded reply:${chat(kit, [["model", `${kit.esc(R.text)}${callBlock(kit, R)}`]])}${cap()}The same check now finds ${plural(CHECKED["loose-retry"].length, "problem")}, and the page draws ${plural(fixed.length, "card")}. Two things to notice. First, the reply also carried a sentence of text. Your page decides whether to show text that comes with a component call, and an apology for an error the user never saw is better hidden. Second, allow <b>one</b> retry: if the second try fails too, show the answer as text or a short error, never props that failed the check.`,
      "Nothing in the message tells it to give up: the error names what to fix, and the tool is still available.",
      "The error is about one field's type in the hotel cards. Nothing suggests the component was the wrong choice."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Send the problems back</h1>
        <p class="lead">The check found ${plural(CHECKED["loose-hotels"].length, "problem")} in the broken props. The page draws nothing, and sends this back to the model as the tool result for its call (same untyped tool, same conversation):</p>
        ${mono(kit, RETRY_TOOL_MSG)}
        <p class="task">Predict: what does the model send next?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>
        ${ans === RIGHT ? hotelCards(kit, fixed) : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Valid is not the same as right: the typed reply passed the check and left out a hotel. */
  function validNotRight({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const shown = propsOf("ui-hotels").hotels;
    const RIGHT0 = SEARCH.findIndex(h => h.hotel_id === MISSING[0].hotel_id);
    const fb0 = SEARCH.map(h => {
      const p = priceNum(h.price);
      if (TYPED_IDS.includes(h.hotel_id)) return `${kit.esc(h.name)} is on the cards (card ${TYPED_IDS.indexOf(h.hotel_id) + 1}).`;
      if (p >= BUDGET) return `${kit.esc(h.name)} costs ${kit.esc(h.price)}, over ${BUDGET}. Leaving it out was right.`;
      return "";
    });
    const opts1 = [
      `Add <code>"minItems": ${UNDER.length}</code> to the hotels list`,
      "Filter by price in your own code, and check the props against the search results",
      "Retry until the check passes"
    ];
    const fb1 = [
      `The right number depends on the search. Tomorrow only one hotel may match, and this rule would reject a correct answer.`,
      `Right. The price filter is plain arithmetic, so do it in code: search with the price limit, so the model only sees hotels that qualify. Then check the props against those results: every <code>hotel_id</code> came from them, no hotel from them is missing, and each price matches. That also catches a hotel or a price the model made up. Leave the model the part that needs it: choosing the component and the wording.`,
      `It already passes: ${plural(CHECKED["ui-hotels"].length, "problem")}. A props check sees types and fields, not whether the list is complete.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Valid, and still wrong</h1>
        <p class="lead">Back to the typed catalogue's reply from earlier. The check found ${plural(CHECKED["ui-hotels"].length, "problem")} in it. Here are the cards again, next to what the search returned. The user asked for hotels under ${BUDGET} dollars.</p>
        ${hotelCards(kit, shown)}
        <table class="${P}-tbl"><caption class="${P}-cap">The search results the model was given</caption><thead><tr><th>hotel</th><th>price</th><th>distance</th></tr></thead><tbody>${SEARCH.map(h => `<tr><td>${kit.esc(h.name)}</td><td>${kit.esc(h.price)}</td><td>${kit.esc(h.distance)}</td></tr>`).join("")}</tbody></table>
        ${phase === 0 ? `<p class="task">Which hotel should be on the cards and is not?</p>
          <div class="lpanel">${kit.options(SEARCH.map(h => kit.esc(h.name)), { picked: ans, correct: RIGHT0 })}${ans == null ? "" : kit.feedback(fb0[ans], false)}</div>`
        : `${kit.feedback(`Yes: ${kit.esc(MISSING[0].name)}, ${kit.esc(MISSING[0].price)}. ${plural(UNDER.length, "hotel")} cost under ${BUDGET}; the cards show ${shown.length}. The text answer on the first screen had all ${UNDER.length}. The props were valid, and the answer was still incomplete.`, true)}
          <p class="task">Which change stops this kind of mistake?</p>
          <div class="lpanel">${ask(kit, opts1, 1, ans, fb1)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (phase === 0 && ans === RIGHT0) { phase = 1; ans = null; }
        paint();
        if (phase === 1 && ans === 1) done();
      });
    };
    paint();
  }

  /* 10. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const L = REC["loose-hotels"], T = REC["ui-hotels"];
    const extra = T.pt - L.pt;
    const opts = [
      `The ${word(NCOMP)} typed tool schemas, sent with every request`,
      "The model's longer reply",
      "A one-time cost on the first request",
      "The map"
    ];
    const RIGHT = 0;
    const fb = [
      `Right. Every request carries every schema in the catalogue, even for a yes/no question. Here that was ${extra} more input tokens per request than one untyped tool. A bigger catalogue costs more on every call, and gives the model more ways to pick the wrong one.`,
      `Replies are output tokens, counted apart. And the typed reply was the shorter one: ${T.ct} output tokens against ${L.ct}.`,
      "The model keeps nothing between calls, so the tool list is sent again with every request.",
      "The map is drawn by your page from lat and lng. The model never sees it."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for generative UI</h1>
        <p class="lead"><b>For:</b> answers that are data the user acts on: hotels to choose from, a booking to check, prices to compare, places on a map. <b>Reach for it</b> when the same few answer shapes (a list, a table, a chart) keep coming back, each worth a component you build and test once.</p>
        <p class="lead"><b>Not</b> for explanations, advice or a yes/no: text is better there. And not when a screen always shows the same shape, like a search results page: then your code draws the component without asking the model to choose.</p>
        <p class="lead"><b>Costs:</b> the catalogue and its schemas, built and kept matching the components. A props check and a fallback, plus a second model call (more waiting) whenever a retry is needed. And evaluations, because a wrong choice of component passes every props check.</p>
        <p class="task">Same system prompt, same question. With one untyped tool the request took ${L.pt} input tokens; with the typed catalogue, ${T.pt}. Where does the difference come from?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 11. Recognise it in new situations. */
  const CASES = [
    ["A banking app's chat. A user asks: “What did I spend on food, transport and rent last month?” The app has the totals per category.", true,
      "Yes. The answer is a few numbers to compare, a shape that comes back often. In a chat the questions vary, so something has to choose the component for each one; that choice is the model's part. A chart or table component with typed props (category names, amounts as numbers) fits, and the page can check the amounts against the app's own totals.",
      "The answer is numbers by category, the kind of data a chart or table shows better than sentences, and the same shape will be asked for again and again. In a chat the questions vary, so something has to pick the component for each one. A component call with typed amounts fits."],
    ["A legal-help chat. A user asks: “What does the notice period in my contract mean for me if I quit next week?”", false,
      "No. The answer is an explanation with conditions (“if your contract says…, then…”). No component has a shape for reasoning, and squeezing it into cards drops the conditions. Text is the right reply.",
      "There is nothing here to choose from or compare: the user needs reasoning in sentences. A card or a table would cut the “if… then…” parts that make the answer correct. Text is right."],
    ["A recipe app. A user asks for a shopping list for the lasagne, for six people.", true,
      "Yes. A list of items with amounts is data, and a checklist component lets the user tick items off while shopping, which text cannot do.",
      "A shopping list is items and amounts: fixed fields. A checklist component with typed props lets the user tick items in the shop, and the page can check that every amount is a number."],
    ["A sales team gets the same table every Monday: last week's sales per region, straight from the database.", false,
      "No. The shape never changes and the numbers come from a query. Your code builds the table directly. Asking a model to choose the only component and copy the numbers adds cost, delay and a chance to change a number.",
      "There is no choice to make: always the same table, always the same query. A model would only copy numbers it could get wrong. Plain code draws this table."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Component or text?</h1>
        <p class="lead">${Word(CASES.length)} requests from other apps. Generative UI here means: the model picks a component from your catalogue and fills its typed props, and your page draws it.</p>
        <p class="task">Would you answer each one with a component the model picks? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Components, checked before they are drawn</h1>
      <p class="lead">Generative UI in one sentence: the model picks a component from your catalogue and fills its typed props, and your page checks the props and draws a component it owns.</p>
      <p class="lead">You turned text answers into component calls and saw the model pick from a catalogue the page owns. You found the props that crashed the page and the schema rule that catches them. You stepped through the check and sent its problems back once. And you saw what no props check can catch: a wrong choice of component and a missing hotel.</p>
      <p class="lead">This lesson was the practice; nothing more to do here.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The habit from here carries over: judge a model by checking its output on your own cases, not by how it looks in one run.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Generative UI: model output as components",
    checked: CHECKED_ON,
    sources: [
      "https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces",
      "https://openrouter.ai/docs/guides/features/tool-calling",
      "https://openrouter.ai/docs/guides/features/structured-outputs",
      "https://json-schema.org/understanding-json-schema/reference/numeric",
      "https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary"
    ],
    interview: [
      {
        q: "Your chat app lets the model answer with UI components. After a release, some users see a blank screen when they ask for hotel lists. How do you find the cause and stop it happening again?",
        good: [
          "Find the failing props in the logs or traces and replay them against the component: often a field has the wrong type or is missing",
          "Type every prop in the tool schema, and check the props in code before rendering; strict modes are not guaranteed on every endpoint",
          "On a failed check, send the problems back once as the tool result, then fall back to text",
          "Wrap model-driven components in an error boundary so one bad card cannot clear the page",
          "Add the failing case to the eval set"
        ],
        weak: "Tell the model in the prompt to always send valid data. That does not stop the next bad reply from reaching the page."
      },
      {
        q: "A product manager wants every answer in your assistant to be a rich component. Where do you push back, and what would you measure?",
        good: [
          "Explanations, advice and yes/no answers read better as text; a card can even hide the answer",
          "Screens with a fixed shape should be drawn by code from the data, with no model choosing",
          "Every component schema is sent with every request, so a big catalogue costs input tokens on every call",
          "A wrong choice of component passes every props check, so measure the choice on a test set of real questions",
          "Each component is code to build, test and keep in step with its schema"
        ],
        weak: "Agree because components look better, without asking which answers are data and which are reasoning."
      }
    ],
    screens: [situation, pickComponents, fillProps, spotIdea, textBetter, broken, asCode, retry, validNotRight, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: PICKS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#b0 [data-wrong]"], right: ["#b0 [data-right]", "#b1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
