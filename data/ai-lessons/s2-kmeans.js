/* Lesson: clustering with k-means. Story: a grocery chain groups its customers by basket size and visit
   frequency to plan promotions. Ideas: (1) k-means repeats two moves, "every customer joins the nearest centre"
   and "every centre moves to the average of its group", and each move can only lower the total squared
   distance, so it always stops; (2) where it stops depends on the start and on k: choose k from the elbow, run
   several starts, and check that the groups are real at all.
   Data, all real runs on this Mac (no model calls):
   - docs/ai-path/runs/s2-kmeans/hand_example.py + hand_example.out.txt: the ten customers and two starting
     centres of the by-hand screens, the 12-line NumPy kmeans traced line by line, the totals after every move;
   - docs/ai-path/runs/s2-kmeans/customers.py + customers.out.txt: 300 SIMULATED customers (seeded), the elbow
     loop (best of 10 starts, k = 1..8), the k = 4 answer, one single-start run that settles badly (the first
     such seed), and 300 customers drawn evenly with no groups (its elbow and k = 4 answer).
   Lesson-local picture: a scatter plot with group shapes, centres and tappable customers (.lx-s2-kmeans-*),
   see ensureStyle() and plot(). Plain browser script. */
(() => {
  const ID = "s2-kmeans";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const f1 = v => String(Math.round(v * 10) / 10);
  const f2 = v => String(Math.round(v * 100) / 100);
  const euro = y => `€${Math.round(y * 10)}`;
  const visits = v => `${f1(v)} visit${f1(v) === "1" ? "" : "s"}`;
  const who = p => `${visits(p[0])}, ${euro(p[1])}`;
  const dist = (p, c) => Math.hypot(p[0] - c[0], p[1] - c[1]);
  const sq = (p, c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2;
  const mean = ps => [sum(ps.map(p => p[0])) / ps.length, sum(ps.map(p => p[1])) / ps.length];
  const pct = (a, b) => Math.round((a - b) / a * 100);

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s2-kmeans/hand_example.py: [visits per month, basket size in tens of euros]
  const HAND = [[8, 2], [9, 3], [7, 3], [9, 1], [6, 2], [2, 8], [3, 9], [1, 7], [2, 6], [5, 5]];
  const START = [[1, 5], [10, 7]]; // centre A (index 0), centre B (index 1)
  const MAX_ROUNDS = 10; // hand_example.py calls kmeans(customers, start_centres, 10)
  // Lines kept at 44 characters or fewer so the listing fits a phone screen without sideways scrolling.
  const CODE = [
    "def kmeans(customers, centres, limit):",
    "    for round_no in range(1, limit + 1):",
    "        diff = customers[:, None] - centres",
    "        dists = np.linalg.norm(diff, axis=2)",
    "        groups = dists.argmin(axis=1)",
    "        moved = np.array([",
    "            customers[groups == g].mean(axis=0)",
    "            for g in range(len(centres))])",
    "        if np.allclose(moved, centres):",
    "            return centres, groups, round_no",
    "        centres = moved",
    "    return centres, groups, limit"
  ];
  const ELBOW_CODE = [ // customers.py, the elbow loop, line for line
    "for k in range(1, 9):",
    "    rng = np.random.default_rng(0)",
    "    best, _ = best_of(customers, k, 10, rng)",
    "    total = round(best[\"total\"], 1)",
    "    print(\"k\", k, \"total\", total)"
  ];
  // From docs/ai-path/runs/s2-kmeans/customers.out.txt (simulated customers, seed 0; points as [visits, basket in tens of euros])
  const CUSTOMERS = [[8.6,1.9],[9.0,2.1],[8.1,2.2],[9.5,2.6],[7.9,1.2],[8.0,2.0],[6.6,1.9],[7.5,1.6],[8.1,1.8],[8.8,2.6],[8.4,2.8],[8.0,2.2],[9.2,2.1],[7.9,1.4],[8.1,2.1],[7.7,1.9],[8.4,2.3],[8.7,2.2],[8.0,1.9],[9.1,2.9],[7.5,2.9],[9.6,2.5],[8.7,1.8],[9.7,3.2],[9.9,2.8],[8.8,1.3],[8.5,2.4],[7.5,2.2],[8.8,2.4],[7.6,1.6],[8.2,1.3],[9.9,1.7],[8.8,1.8],[9.8,2.8],[9.0,0.7],[8.5,2.4],[9.3,1.6],[10.0,1.2],[8.0,2.6],[8.5,3.2],[8.7,1.6],[8.2,1.3],[7.5,2.4],[9.0,2.8],[7.9,3.0],[8.3,2.9],[8.2,1.6],[8.7,2.6],[8.6,1.6],[7.4,1.2],[8.9,2.6],[8.4,1.4],[9.2,1.2],[7.9,2.4],[6.7,2.2],[8.0,2.1],[8.4,2.1],[9.1,1.5],[9.6,2.4],[9.2,2.7],[9.1,2.5],[8.6,1.1],[8.4,1.5],[7.4,2.2],[8.0,1.4],[7.7,2.2],[8.8,2.8],[8.5,2.6],[9.6,2.7],[6.6,2.7],[8.8,2.3],[8.8,2.2],[8.8,1.8],[7.0,1.9],[7.9,2.6],[8.3,2.1],[7.8,1.7],[8.5,1.1],[8.7,1.9],[7.6,0.6],[8.9,1.8],[8.1,1.9],[10.0,2.0],[8.6,1.1],[9.8,2.6],[9.4,2.0],[9.2,2.2],[9.0,1.9],[7.3,2.6],[7.0,1.9],[3.9,7.2],[4.4,7.8],[3.7,8.4],[3.7,9.1],[4.2,7.6],[2.6,7.0],[4.8,8.0],[3.8,9.3],[3.1,7.5],[3.7,8.5],[3.5,7.5],[2.9,8.6],[4.6,7.6],[4.1,7.0],[3.7,9.1],[4.1,9.8],[3.4,8.5],[3.9,8.5],[4.0,7.6],[3.4,10.5],[3.9,6.4],[3.5,8.5],[3.6,9.1],[4.7,7.9],[3.7,7.2],[3.5,6.8],[4.8,9.3],[3.1,7.1],[2.8,7.2],[1.8,7.1],[4.9,7.7],[4.6,7.6],[5.2,8.2],[3.7,10.0],[3.8,7.0],[4.1,8.0],[4.7,7.3],[4.6,8.7],[3.5,8.1],[3.4,9.9],[3.5,7.6],[3.3,7.7],[4.0,8.6],[3.6,7.9],[3.0,7.3],[5.9,8.8],[3.5,6.9],[3.3,8.0],[4.0,7.4],[3.1,9.1],[4.3,7.7],[3.8,7.6],[1.9,8.1],[3.3,7.2],[3.6,8.6],[3.2,6.9],[4.4,8.6],[3.3,8.4],[3.8,8.2],[3.1,8.7],[4.8,8.5],[4.4,5.0],[4.2,8.0],[3.9,7.5],[4.0,8.3],[3.8,7.6],[4.9,7.1],[4.7,8.1],[3.4,7.8],[3.4,8.5],[4.2,7.6],[3.2,8.2],[4.7,7.9],[4.3,7.7],[4.0,7.8],[4.2,6.8],[4.5,7.8],[4.3,7.7],[4.2,7.1],[4.8,6.6],[1.0,3.2],[2.2,3.2],[1.4,1.9],[1.4,3.0],[2.3,3.5],[0.7,4.6],[1.3,2.3],[2.2,3.0],[1.3,3.2],[1.9,3.8],[0.8,4.6],[2.0,2.7],[1.1,2.2],[1.6,2.5],[1.1,3.6],[1.7,2.7],[1.9,4.1],[1.0,2.5],[2.0,3.6],[1.6,3.9],[1.0,1.8],[1.1,3.1],[1.1,2.6],[1.0,2.5],[1.0,3.3],[1.9,2.6],[1.4,2.5],[1.8,3.1],[2.3,2.1],[1.7,3.4],[1.3,3.5],[0.8,4.7],[0.8,3.7],[0.9,3.9],[1.3,3.1],[1.5,3.9],[1.3,0.6],[1.1,3.1],[1.3,3.6],[2.0,2.9],[0.8,4.1],[2.0,2.8],[2.6,2.7],[0.9,2.9],[2.0,2.3],[2.5,2.3],[2.0,3.4],[1.4,3.9],[0.8,4.1],[1.5,2.6],[1.9,3.8],[1.9,4.6],[2.0,4.0],[1.2,3.1],[1.8,3.0],[1.7,3.3],[1.9,2.9],[1.3,2.3],[1.1,3.9],[1.5,3.6],[0.9,1.4],[1.0,3.9],[2.0,3.3],[1.1,2.9],[1.4,2.7],[0.2,2.3],[1.4,4.2],[1.6,4.1],[1.3,2.8],[0.1,3.4],[6.4,6.6],[5.7,5.6],[5.5,4.8],[5.5,5.3],[6.9,5.5],[5.4,5.6],[6.2,5.1],[6.8,4.4],[5.9,5.9],[5.1,5.7],[6.9,5.8],[4.8,5.1],[6.9,5.7],[6.0,5.8],[6.5,5.1],[5.8,5.6],[5.6,5.4],[6.9,4.9],[7.3,6.6],[4.8,5.4],[6.2,5.0],[5.5,5.4],[6.5,5.2],[7.3,5.7],[5.9,6.4],[6.4,5.7],[5.8,6.6],[6.6,5.4],[4.9,5.7],[5.2,4.5],[5.8,5.7],[6.9,5.7],[6.6,4.8],[6.0,5.6],[6.6,5.6],[6.6,5.2],[6.3,5.7],[5.1,5.6],[5.8,4.4],[6.7,5.3],[5.4,5.3],[6.1,6.4],[5.9,5.8],[7.0,5.8],[6.7,5.2],[6.5,5.5],[6.8,4.9],[5.5,6.3],[5.9,5.3],[6.1,5.1],[6.9,4.8],[5.9,5.7],[5.9,5.0],[5.4,5.8],[5.3,5.9],[4.9,5.2],[6.0,4.7],[6.5,5.5],[5.3,4.6],[4.9,5.5]];
  const ELBOW = [4083.1, 1826.5, 658.8, 281.0, 244.5, 209.4, 198.7, 161.5]; // k = 1..8, best of 10 starts
  const BEST4 = {"start":[[8.6,1.9],[5.5,4.8],[1.7,3.4],[2.8,7.2]],"centres":[[8.47,2.06],[6.0,5.47],[1.44,3.15],[3.85,7.99]],"rounds":2,"total":281.0,"sizes":[90,62,70,78],"groups":"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000333333333333333333333333333333333333333333333333333333333333313333333333333333312222222222222222222222222222222222222222222222222222222222222222222222111111111111111111111111111111111111111111111111111111111111"};
  const BEST4_TOTALS = [281.0, 281.0, 645.2, 281.0, 631.7, 281.0, 281.0, 281.0, 631.8, 281.0]; // the ten single-start totals for k = 4
  const BROKEN = {"start":[[7.0,1.9],[5.9,5.9],[8.8,1.8],[8.5,1.1]],"centres":[[1.44,3.15],[4.78,6.89],[9.05,2.22],[7.79,1.94]],"rounds":8,"total":621.2,"sizes":[70,139,48,43],"seed":2,"groups":"223233333223233322323222222323322222223223323232232323333222233333222322233333232323222233111111111111111111111111111111111111111111111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000000000000111111131111111111111111111111111111111111111111111111111111"};
  const FLAT = [[5.4,9.5],[1.9,9.5],[3.5,4.5],[8.4,4.4],[5.7,0.8],[7.7,5.6],[3.6,8.0],[3.4,4.8],[1.8,4.3],[2.4,3.0],[7.6,3.2],[5.1,9.8],[9.6,7.4],[5.6,3.1],[2.0,9.7],[5.4,1.6],[6.4,7.9],[6.3,9.2],[0.9,5.5],[4.9,1.1],[6.6,8.6],[6.1,3.0],[8.5,5.3],[5.4,7.7],[1.9,8.3],[7.0,8.0],[2.3,8.1],[2.3,1.3],[8.6,8.7],[8.8,5.0],[3.1,0.6],[6.6,7.3],[8.4,3.2],[2.5,6.6],[8.1,9.7],[1.9,5.1],[9.0,4.5],[6.1,0.7],[6.9,9.2],[8.4,8.9],[6.8,2.8],[7.8,2.5],[8.4,1.1],[8.3,2.1],[4.1,3.5],[7.1,2.2],[4.3,0.6],[3.0,4.5],[1.5,6.5],[4.1,7.4],[6.7,4.6],[8.7,6.5],[8.2,3.7],[5.7,2.4],[10.0,2.8],[2.9,1.2],[2.9,7.7],[7.1,1.7],[4.1,4.5],[6.8,4.8],[6.1,8.5],[7.4,4.0],[4.8,4.0],[1.5,2.4],[3.2,3.5],[3.5,6.0],[9.7,7.9],[8.0,7.7],[6.2,9.2],[7.1,5.3],[1.2,5.1],[2.5,1.8],[5.3,8.0],[3.3,7.8],[5.5,1.9],[9.7,4.3],[3.3,8.5],[1.7,7.5],[2.3,4.2],[2.7,8.5],[4.2,9.8],[6.4,7.1],[5.5,3.4],[4.3,9.4],[2.4,9.9],[7.7,3.9],[6.6,4.1],[4.1,5.3],[0.7,5.2],[9.7,3.2],[7.6,4.7],[2.5,9.1],[0.7,3.4],[10.0,3.0],[8.6,6.3],[8.2,6.5],[3.9,7.7],[0.8,4.7],[4.0,5.0],[1.7,2.6],[5.8,4.2],[8.0,6.2],[8.7,7.5],[6.2,3.2],[7.9,2.9],[1.2,9.6],[5.6,7.9],[5.5,6.3],[0.8,2.3],[6.9,5.9],[2.0,9.5],[2.0,5.3],[1.9,7.3],[3.1,1.8],[0.9,2.2],[2.3,5.6],[4.8,9.6],[9.6,8.1],[6.9,8.5],[9.4,0.7],[1.6,3.9],[1.4,6.2],[3.0,3.0],[3.2,1.4],[7.5,6.7],[6.3,0.8],[4.6,7.0],[2.0,4.2],[0.7,1.3],[2.6,4.4],[4.9,8.9],[3.5,0.7],[8.3,1.1],[1.4,9.7],[7.7,3.7],[1.8,4.2],[3.7,8.8],[4.5,1.3],[9.3,6.4],[1.6,1.6],[4.9,1.4],[6.5,6.4],[0.8,8.2],[8.0,9.2],[6.9,7.1],[2.1,0.7],[1.1,9.7],[6.6,9.5],[3.8,7.7],[1.1,2.1],[3.1,5.7],[5.8,5.2],[4.5,6.0],[9.7,4.9],[8.5,1.0],[4.2,5.8],[6.4,2.9],[4.3,9.5],[6.7,6.1],[1.1,1.0],[2.5,1.8],[9.8,0.5],[4.0,1.1],[6.6,0.9],[1.1,1.3],[3.1,6.0],[8.2,3.0],[3.2,8.3],[7.6,1.7],[8.2,8.4],[2.2,6.5],[2.4,2.8],[5.2,5.5],[5.1,5.6],[2.5,7.9],[3.1,9.2],[5.4,3.4],[2.2,5.1],[4.1,6.4],[5.2,0.9],[8.4,1.0],[8.4,8.2],[9.3,6.8],[2.0,4.7],[4.7,6.5],[4.1,6.9],[2.4,3.9],[5.7,4.6],[1.7,9.7],[7.1,8.4],[3.9,9.5],[8.2,9.8],[2.4,5.0],[4.2,6.3],[2.9,1.5],[5.0,6.6],[4.1,9.9],[4.4,3.3],[8.2,4.9],[3.1,3.2],[9.5,9.6],[6.6,3.1],[7.3,2.6],[3.6,5.6],[4.3,3.8],[9.8,2.1],[6.3,0.9],[1.4,2.5],[9.9,7.4],[8.7,1.0],[7.0,4.7],[4.5,7.2],[3.4,5.4],[3.0,4.2],[5.6,2.0],[3.1,4.5],[5.0,8.1],[6.6,5.8],[8.8,2.4],[1.5,4.2],[1.8,5.8],[5.9,1.8],[7.3,5.8],[4.5,9.2],[8.6,2.6],[2.1,9.2],[2.0,7.7],[3.5,3.9],[5.8,9.3],[0.5,2.0],[7.3,4.2],[3.2,9.6],[3.0,7.3],[9.7,7.7],[7.2,7.4],[8.1,3.1],[6.5,8.1],[8.9,9.1],[9.1,1.4],[4.1,4.8],[9.0,4.5],[3.0,0.7],[3.2,7.9],[0.7,2.1],[3.5,5.6],[3.9,8.9],[2.5,5.8],[7.9,9.3],[8.8,1.8],[8.0,6.9],[4.5,0.7],[2.1,7.6],[1.3,3.5],[2.9,7.6],[3.9,1.3],[4.0,3.6],[7.3,3.5],[7.1,5.6],[8.9,7.5],[4.4,5.1],[5.0,8.8],[1.8,4.5],[5.6,4.6],[6.2,5.2],[4.4,7.0],[3.6,6.3],[7.4,1.7],[3.6,9.5],[9.7,9.9],[0.9,8.4],[9.4,9.1],[7.3,6.9],[7.3,6.0],[8.0,5.3],[2.6,1.4],[9.1,7.7],[2.2,8.3],[3.4,6.5],[3.9,2.5],[2.2,1.2],[1.2,1.2],[1.4,8.4],[5.4,1.7],[5.5,5.7],[5.2,2.5],[4.6,8.8],[4.1,5.3],[9.3,2.7],[7.4,5.1],[8.0,3.9],[5.7,4.0],[8.7,9.2],[6.5,9.8],[7.5,8.4],[9.0,3.1],[9.9,4.2],[5.2,2.2],[8.3,3.7],[7.0,2.6],[3.8,4.2]]; // seed 1, drawn evenly
  const FLAT_ELBOW = [4386.5, 2680.3, 1672.9, 1081.3, 863.4, 724.9, 608.7, 524.0];
  const FLAT4 = {"start":[[6.6,5.8],[7.4,5.1],[6.6,0.9],[7.1,8.4]],"centres":[[3.36,7.7],[7.45,3.0],[2.57,2.97],[7.78,7.82]],"rounds":14,"total":1081.3,"sizes":[85,83,74,58],"groups":"002113022210310133223110030231231032113311112122001311120121312220333122001100200310011021102133022213311030230202200331202231022202101202322303320302010110103221212010130200001201133200210303202002123110211231100212031201301002321003313312120200031320202213300211001030333123002220101001111333111112"};
  // From docs/ai-path/runs/s2-kmeans/hand_example.out.txt: [line about to run, event (l line, r return), round_no, groups, centres, moved]
  const TRACE = [[1,"l",null,null,[[1.0,5.0],[10.0,7.0]],null],[2,"l",1,null,[[1.0,5.0],[10.0,7.0]],null],[3,"l",1,null,[[1.0,5.0],[10.0,7.0]],null],[4,"l",1,null,[[1.0,5.0],[10.0,7.0]],null],[5,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[7,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[5,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[7,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[6,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[7,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[6,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[7,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[5,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],null],[8,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],[[3.167,6.167],[8.25,2.25]]],[10,"l",1,"1111000000",[[1.0,5.0],[10.0,7.0]],[[3.167,6.167],[8.25,2.25]]],[1,"l",1,"1111000000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[2,"l",2,"1111000000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[3,"l",2,"1111000000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[4,"l",2,"1111000000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[5,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[7,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[5,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[7,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[6,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[7,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[6,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[7,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[5,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[3.167,6.167],[8.25,2.25]]],[8,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[2.6,7.0],[7.8,2.2]]],[10,"l",2,"1111100000",[[3.167,6.167],[8.25,2.25]],[[2.6,7.0],[7.8,2.2]]],[1,"l",2,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[2,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[3,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[4,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[5,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[7,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[5,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[7,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[6,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[7,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[6,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[7,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[5,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[8,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[9,"l",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]],[9,"r",3,"1111100000",[[2.6,7.0],[7.8,2.2]],[[2.6,7.0],[7.8,2.2]]]];
  /* ---------- Derived from the data ---------- */
  const near = (p, cs) => { const d = cs.map(c => dist(p, c)); return d.indexOf(Math.min(...d)); };
  const assign = cs => HAND.map(p => near(p, cs));
  const update = g => [0, 1].map(k => mean(HAND.filter((_, i) => g[i] === k)));
  const total = (cs, g) => sum(HAND.map((p, i) => sq(p, cs[g[i]])));
  const G1 = assign(START), C1 = update(G1);
  const G2 = assign(C1), C2 = update(G2);
  const G3 = assign(C2), C3 = update(G3);
  const SWITCH2 = HAND.map((_, i) => i).filter(i => G1[i] !== G2[i]);
  const SWITCH3 = HAND.map((_, i) => i).filter(i => G2[i] !== G3[i]);
  const TOTALS = [total(START, G1), total(C1, G1), total(C1, G2), total(C2, G2), total(C2, G3)];
  const B1 = HAND.map((_, i) => i).filter(i => G1[i] === 1);
  const groupsOf = s => s.split("").map(Number);
  const BEST_K = 4; // the elbow the lesson asks for; checked below against the drops
  const drops = E => E.slice(1).map((v, i) => pct(E[i], v)); // drop from k to k+1, in percent
  const DROP = drops(ELBOW), FDROP = drops(FLAT_ELBOW);
  const STUCK = BEST4_TOTALS.filter(t => t > BEST4.total * 1.3).length;
  const sameStartGroup = BROKEN.start.map(s => near(s, BEST4.centres)); // which real group each start sat in
  const crowded = (() => { const c = {}; sameStartGroup.forEach(g => c[g] = (c[g] || 0) + 1); return Math.max(...Object.values(c)); })();

  /* ---------- Lesson-local style and the scatter picture ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-plot { position: relative; width: 100%; max-width: 440px; margin: 14px 0 4px; }
      .lx-${ID}-plot svg { display: block; width: 100%; height: auto; }
      .lx-${ID}-plot text { fill: var(--muted); font: 500 11px var(--mono); }
      .lx-${ID}-plot text.lx-${ID}-cl { fill: var(--ink); font: 700 13px var(--font); }
      .lx-${ID}-grid { stroke: var(--line); stroke-width: 1; }
      .lx-${ID}-pt { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; padding: 0; border: 0; border-radius: 50%; background: transparent; cursor: pointer; }
      .lx-${ID}-pt:focus-visible { outline: 2px solid var(--ink); outline-offset: -6px; }
      .lx-${ID}-cap { margin: 0 0 6px; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-key { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 4px 0 8px; font-size: 14px; color: var(--ink-2); }
      .lx-${ID}-key span { display: inline-flex; align-items: center; gap: 6px; }
      .lx-${ID}-key svg { width: 16px; height: 16px; }
      .lx-${ID}-check { margin: 10px 10px 0 0; min-height: 44px; }
      .lx-${ID}-sum { font: 500 14px/1.6 var(--mono); }
      @media (max-width: 480px) { .lx-${ID}-code .lcode { font-size: 11.5px; } .lx-${ID}-code .lcode div { padding: 0 8px; } }
    `;
    document.head.appendChild(s);
  }
  const VB = 340, PL = 34, PT = 8, PS = 296, MAXV = 11;
  const sx = x => PL + x / MAXV * PS, sy = y => PT + PS - y / MAXV * PS;
  // shapes: 0 open circle, 1 filled square, 2 filled triangle, 3 open diamond; "ring" = look here
  function shape(kind, x, y, r) {
    const st = `stroke="var(--ink)" stroke-width="${r > 4 ? 2 : 1.3}"`;
    if (kind === 0) return `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--surface)" ${st}/>`;
    if (kind === 1) return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" fill="var(--ink)" ${st}/>`;
    if (kind === 2) return `<path d="M${x} ${y - r * 1.25}L${x + r * 1.15} ${y + r * .85}L${x - r * 1.15} ${y + r * .85}Z" fill="var(--ink)" ${st}/>`;
    return `<path d="M${x} ${y - r * 1.3}L${x + r * 1.3} ${y}L${x} ${y + r * 1.3}L${x - r * 1.3} ${y}Z" fill="var(--surface)" ${st}/>`;
  }
  const keySvg = k => `<svg viewBox="0 0 16 16" aria-hidden="true">${shape(k, 8, 8, 5)}</svg>`;
  const key = items => `<div class="lx-${ID}-key">${items.map(([k, t]) => `<span>${k === "c" ? centreKey : keySvg(k)}${t}</span>`).join("")}</div>`;
  const centreKey = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--ink)" stroke-width="2"/><path d="M8 3v10M3 8h10" stroke="var(--ink)" stroke-width="1.5"/></svg>`;
  function centreMark(c, label) {
    const x = sx(c[0]), y = sy(c[1]);
    return `<circle cx="${x}" cy="${y}" r="9" fill="var(--surface)" stroke="var(--ink)" stroke-width="2.5"/><path d="M${x} ${y - 6}v12M${x - 6} ${y}h12" stroke="var(--ink)" stroke-width="2"/>${label ? `<text class="lx-${ID}-cl" x="${x + 12}" y="${y - 8}">${label}</text>` : ""}`;
  }
  /* plot({ pts, kinds, r, centres: [[c, label]], rings: [i], pick: true, aria }) */
  function plot(kit, { pts, kinds, r = 3, centres = [], rings = [], pick = false, aria = "" }) {
    const ticks = [0, 2, 4, 6, 8, 10];
    const grid = ticks.map(t => `<line class="lx-${ID}-grid" x1="${sx(t)}" y1="${PT}" x2="${sx(t)}" y2="${PT + PS}"/><line class="lx-${ID}-grid" x1="${PL}" y1="${sy(t)}" x2="${PL + PS}" y2="${sy(t)}"/>
      <text x="${sx(t)}" y="${PT + PS + 14}" text-anchor="middle">${t}</text><text x="${PL - 5}" y="${sy(t) + 4}" text-anchor="end">${t ? "€" + t * 10 : ""}</text>`).join("");
    const dots = pts.map((p, i) => shape(kinds[i], sx(p[0]), sy(p[1]), r) + (rings.includes(i) ? `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="${r + 6}" fill="none" stroke="var(--ink)" stroke-width="3"/>` : "")).join("");
    const cs = centres.map(([c, l]) => centreMark(c, l)).join("");
    const btns = pick ? pts.map((p, i) => `<button type="button" class="lx-${ID}-pt" data-i="${i}" style="left:${sx(p[0]) / VB * 100}%;top:${sy(p[1]) / VB * 100}%" aria-label="customer: ${kit.esc(who(p))}"></button>`).join("") : "";
    return `<div class="lx-${ID}-plot"><svg viewBox="0 0 ${VB} ${VB}" role="img" aria-label="${kit.esc(aria)}">${grid}${dots}${cs}</svg>${btns}</div>
      <p class="lx-${ID}-cap">Across: visits per month. Up: basket size.</p>`;
  }
  const handKinds = g => g.map(x => x === 1 ? 1 : 0);
  const keyAB = key([[0, "with centre A"], [1, "with centre B"], ["c", "a centre"]]);
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;

  /* 1. The situation and round 1, assign: tap the customers closer to centre B. */
  function assignByHand({ el, done, kit }) {
    ensureStyle();
    const sel = new Set(); let fb = null, ok = false;
    const paint = () => {
      const g = HAND.map((_, i) => sel.has(i) ? 1 : 0);
      el.innerHTML = `<h1>Which customers shop alike?</h1>
        <p class="lead">A grocery chain wants a few promotions, each for one kind of shopper. Nobody has labelled the customers. The chain only knows how often each one visits and how much a basket costs. Finding groups in data like this, with no labels, is called <b>clustering</b>.</p>
        <p class="lead">Here are ten customers. Across, one unit is one visit a month. Up, one unit is €10 of basket. The grid lines are two units apart. So one step across and one step up are the same length when you measure a distance.</p>
        <p class="lead">The plan: drop two centres, A and B, somewhere (in practice, at random), and let every customer join the nearer one.</p>
        <p class="task">Tap every customer who is closer to centre B than to A. The rest stay with A. Then press Check.</p>
        ${plot(kit, { pts: HAND, kinds: handKinds(g), r: 6, centres: [[START[0], "A"], [START[1], "B"]], pick: !ok, aria: "ten customers and two centres" })}
        ${keyAB}
        <div class="lpanel">${ok ? "" : `<button type="button" class="btn lx-${ID}-check" data-check>Check</button><button type="button" class="btn lx-${ID}-check" data-clear>Clear taps</button>`}${fb || ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-pt`).forEach(b => b.onclick = () => { const i = +b.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i); fb = null; paint(); });
      const c = el.querySelector("[data-check]");
      const clr = el.querySelector("[data-clear]");
      if (clr) clr.onclick = () => { sel.clear(); fb = null; paint(); };
      if (c) c.onclick = () => {
        const bad = HAND.map((_, i) => i).filter(i => (sel.has(i) ? 1 : 0) !== G1[i]);
        if (bad.length) {
          const extra = bad.filter(i => sel.has(i)), missing = bad.length - extra.length;
          fb = kit.feedback(`Not yet. ${extra.map(i => { const p = HAND[i];
            return `You tapped the customer at ${kit.esc(who(p))}, but it is ${f1(dist(p, START[0]))} steps from A and ${f1(dist(p, START[1]))} from B, so it belongs with A.`; }).join(" ")} ${missing ? `${missing} customer${missing === 1 ? " is" : "s are"} closer to B but not tapped yet.` : ""} Judge by the straight-line distance, not by which side of the chart a customer is on.`, false);
          paint(); return;
        }
        fb = kit.feedback(`Right. ${B1.length} customers join B and ${HAND.length - B1.length} join A. The one at ${kit.esc(who(HAND[4]))} sits on the B side of the chart, but it is ${f1(dist(HAND[4], START[0]))} steps from A and ${f1(dist(HAND[4], START[1]))} from B, so it joins A. B just started far from everyone. That was the first move: <b>assign</b> every customer to its nearest centre.`, true);
        ok = true; paint(); done();
      };
    };
    paint();
  }

  /* 2. Round 1, update: move centre A to the average of its group. */
  function updateByHand({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const A = HAND.filter((_, i) => G1[i] === 0), all = mean(HAND);
    const nearest = A.reduce((m, p) => dist(p, START[0]) < dist(m, START[0]) ? p : m);
    const opts = [who(all), who(C1[0]), `${who(START[0])} (it stays)`, who(nearest)];
    const RIGHT = 1;
    const fb = [
      [`That is the average of all ${HAND.length} customers, B's group included. Each centre stands for its own group only.`, false],
      [`Right. Visits: (${A.map(p => p[0]).join(" + ")}) / ${A.length} = ${f2(C1[0][0])}. Basket: (${A.map(p => p[1]).join(" + ")}) / ${A.length} = ${f2(C1[0][1])} tens of euros. B moves the same way, to ${kit.esc(who(C1[1]))}. That is the second move: <b>update</b> every centre to the average of its group. Both centres now sit in the middle of their customers.`, true],
      ["A centre that never moves would only ever reflect where it was dropped at random. The point is to move it to the middle of the customers who chose it.", false],
      ["That is the customer nearest to old A, a real person. The new centre is the average of the whole group, and it usually sits between customers, not on one.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Move each centre to its group</h1>
        <p class="lead">After the first move, ${A.length} customers sit with A: ${A.map(p => kit.esc(who(p))).join("; ")}.</p>
        <p class="task">Where does centre A move to?</p>
        ${plot(kit, { pts: HAND, kinds: handKinds(G1), r: 6, centres: ans === RIGHT ? [[C1[0], "A"], [C1[1], "B"]] : [[START[0], "A"], [START[1], "B"]], aria: "the groups after the first move" })}
        ${keyAB}
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Round 2: with the moved centres, who switches? */
  function roundTwo({ el, done, kit }) {
    ensureStyle();
    const sel = new Set(); let fb = null, ok = false;
    const paint = () => {
      el.innerHTML = `<h1>Round 2: who switches?</h1>
        <p class="lead">Now repeat the first move with the new centres: A at ${kit.esc(who(C1[0]))}, B at ${kit.esc(who(C1[1]))}. Customers are still marked with the group they joined in round 1.</p>
        <p class="task">Tap every customer who now switches to the other centre, then press Check. (It may be none.)</p>
        ${plot(kit, { pts: HAND, kinds: handKinds(ok ? G2 : G1), r: 6, rings: [...sel], centres: ok ? [[C2[0], "A"], [C2[1], "B"]] : [[C1[0], "A"], [C1[1], "B"]], pick: !ok, aria: "the groups from round 1 and the moved centres" })}
        ${key([[0, "with A"], [1, "with B"], ["c", "a centre"]])}
        <div class="lpanel">${ok ? "" : `<button type="button" class="btn lx-${ID}-check" data-check>Check</button><button type="button" class="btn lx-${ID}-check" data-clear>Clear taps</button>`}${fb || ""}</div>`;
      el.querySelectorAll(`.lx-${ID}-pt`).forEach(b => b.onclick = () => { const i = +b.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i); fb = null; paint(); });
      const c = el.querySelector("[data-check]");
      const clr = el.querySelector("[data-clear]");
      if (clr) clr.onclick = () => { sel.clear(); fb = null; paint(); };
      if (c) c.onclick = () => {
        const bad = HAND.map((_, i) => i).filter(i => sel.has(i) !== SWITCH2.includes(i));
        if (bad.length) {
          const extra = bad.filter(i => sel.has(i)), missing = bad.length - extra.length;
          fb = kit.feedback(`Not yet. ${extra.map(i => { const p = HAND[i], a = dist(p, C1[0]), b = dist(p, C1[1]);
            return `You tapped ${kit.esc(who(p))}: it is ${f1(a)} steps from A and ${f1(b)} from B, so it stays with ${G1[i] ? "B" : "A"}.`; }).join(" ")} ${missing ? `${missing} customer${missing === 1 ? " who switches is" : "s who switch are"} not tapped yet: measure again from the moved centres.` : ""}`, false);
          paint(); return;
        }
        ok = true; sel.clear();
        fb = kit.feedback(`Right: only ${SWITCH2.map(i => kit.esc(who(HAND[i]))).join(", ")} switches. Once B moved into the middle of its customers, that customer is ${f1(dist(HAND[SWITCH2[0]], C1[1]))} steps from B and ${f1(dist(HAND[SWITCH2[0]], C1[0]))} from A. Then the centres move again, to ${kit.esc(who(C2[0]))} and ${kit.esc(who(C2[1]))}. In round 3, ${SWITCH3.length === 0 ? "nobody switches, so the averages stay the same and nothing will ever change again. It has stopped" : `${SWITCH3.length} switch`}.`, true);
        paint(); done();
      };
    };
    paint();
  }

  /* 4. Spot the idea: the total squared distance can only fall, so it always stops. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const steps = ["round 1, after assign", "round 1, after update", "round 2, after assign", "round 2, after update", "round 3, after assign"];
    const opts = [
      "Each move can only lower it: a customer only switches to a closer centre, and the average is the spot with the smallest squared distances to its group",
      "The centres always drift toward the middle of the chart, so they meet",
      "The loop has a limit on rounds, which forces it to stop",
      "The two starting centres happened to be placed well"
    ];
    const RIGHT = 0;
    const fb = [
      [`Right. Switching only happens when the new centre is closer, so the total drops. Moving a centre to the average of its group gives the smallest squared total for that group, so it drops again. A total that never rises, with only so many ways to split ten customers, has to stop changing. This method is <b>k-means</b>: k centres (here k = 2), each the <b>mean</b> of its group. The total is what scikit-learn calls the <b>inertia</b>.`, true],
      ["The two centres moved apart, toward their own groups, not toward each other. Nothing pulls centres to the middle of the chart; each follows its own customers.", false],
      [`A limit is only a safety net. This run stopped in round 3 of ${MAX_ROUNDS} allowed, because nothing changed, not because it ran out of rounds.`, false],
      ["They were placed badly: B was far from everyone. Even so the total fell at every move. The start decides where it ends up, not whether it stops.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why does it stop?</h1>
        <p class="lead">Measure how tight the groups are: for every customer, square its distance to its own centre, and add them all up. Here is that total after every move you made:</p>
        ${kit.table(steps.map((s, i) => [s, f1(TOTALS[i])]), { head: ["after", "total squared distance"], title: "Ten customers, two centres" })}
        <p class="task">A colleague worries the customers could keep switching back and forth for ever. Why can the total never go up, so the loop must stop?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. The same moves in NumPy: a stepped replay of the traced run. */
  const ROW = r => ({ line: r[0], ev: r[1], round: r[2], groups: r[3], centres: r[4], next: r[5] });
  const FR = (() => {
    const fr = [{ ln: 0, ...ROW(TRACE[0]) }];
    for (let k = 1; k < TRACE.length; k++) {
      const prev = ROW(TRACE[k - 1]), cur = ROW(TRACE[k]);
      if (cur.ev === "r") { fr.push({ ln: cur.line, end: true, ...cur }); continue; }
      // one frame after each statement has run; the three lines of the update count as one statement (line 5)
      if ([2, 3, 4, 8, 10].includes(prev.line)) fr.push({ ln: prev.line, ...cur });
      else if (prev.line >= 5 && prev.line <= 7 && cur.line === 8) fr.push({ ln: 5, ...cur });
    }
    return fr;
  })();
  const pyNum = v => Number.isInteger(v) ? v.toFixed(1) : String(v); // print like NumPy floats: 7 -> 7.0
  const arr = a => a == null ? "–" : `[${a.map(r => `[${r.map(pyNum).join(", ")}]`).join(", ")}]`;
  const grp = s => s == null ? "–" : `[${s.split("").join(", ")}]`;
  function sayFrame(f) {
    if (f.end) return `The function returns the centres, the groups and <code>${f.round}</code>, the round it stopped in.`;
    if (f.ln === 0) return "The call starts with the two starting centres: A first, then B. Each row is [visits, basket in tens of euros].";
    if (f.ln === 2) return `Round ${f.round}. <code>[:, None]</code> gives each customer row one slot per centre. Then <code>customers[:, None] - centres</code> subtracts every centre from every customer in one line, with no loop (NumPy calls this broadcasting). <code>diff</code> holds 10 customers × 2 centres × [visits, basket].`;
    if (f.ln === 3) return `<code>norm(diff, axis=2)</code> turns each [visits, basket] difference into one straight-line distance, the one you measured by eye. <code>dists</code> is a table: 10 customers × 2 centres.`;
    if (f.ln === 4) return `<code>argmin(axis=1)</code> picks, for each customer, the column with the smaller distance: 0 for A, 1 for B. That is your tapping, done for all customers at once.`;
    if (f.ln === 5) return `For each group <code>g</code>, <code>customers[groups == g]</code> keeps only that group's rows, and <code>mean(axis=0)</code> averages them column by column: the update move. The result is <code>moved</code>.`;
    if (f.ln === 8) return f.line === 9 ? "<code>np.allclose</code> is true: the new averages equal the old centres. No centre moved, so nothing can change any more. Return." : "<code>np.allclose</code> asks: are the new averages equal to the old centres (up to tiny rounding)? No, the centres moved, so the groups could still change. Not done.";
    if (f.ln === 10) return "The averages become the centres for the next round.";
    return "";
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const opts = [
      `<code>limit</code> was 3`,
      "In round 2 a customer switched, so the averages moved and the check was false; in round 3 they did not move",
      "In round 2 no customer found a closer centre yet"
    ];
    const fb = [
      [`<code>limit</code> was ${MAX_ROUNDS}. The function returned from inside the loop, after the <code>if np.allclose</code> line, not from the last line.`, false],
      ["Right. The stop test compares centres, not groups. Round 2's switch moved both averages, so one more round was needed to see that nothing moves.", true],
      [`One did: ${kit.esc(who(HAND[SWITCH2[0]]))} switched to B in round 2. You tapped it yourself.`, false]
    ];
    const paint = () => {
      const f = FR[i], last = i === FR.length - 1;
      el.innerHTML = `<h1>The two moves in NumPy</h1>
        <p class="lead">This is the whole method, run on your ten customers with the same two starting centres. Every step below is from a real, traced run.</p>
        <p class="task">Step to the end, then answer the question that appears.</p>
        <div class="lx-${ID}-code">${kit.code(CODE, f.ln === 0 ? 0 : f.ln)}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>round_no <b>${f.round == null ? "–" : f.round}</b></span><span>groups <b>${grp(f.groups)}</b></span><span>centres <b>${arr(f.centres)}</b></span><span>moved <b>${arr(f.next)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}
        ${last ? `<p class="task">Customers stopped switching after round 2. Why did the function return in round 3, not in round 2?</p><div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. Choosing k: the elbow on 300 simulated customers. */
  function elbow({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const say = k => {
      if (k === BEST_K) return [`Right. From ${k - 1} to ${k} centres the total still fell by ${DROP[k - 2]}%; from ${k} to ${k + 1} only by ${DROP[k - 1]}%. After ${k}, an extra centre just splits a real group in two and gains little. That bend is the <b>elbow</b>. The plot above now shows the ${k} groups.`, true];
      if (k === ELBOW.length) return [`The total is lowest at k = ${k}, but it always falls when you add centres: with one centre per customer it would be 0. The lowest total is not the goal. Look for where adding a centre stops paying off.`, false];
      if (k < BEST_K) return [`Going from ${k} to ${k + 1} centres still cuts the total by ${DROP[k - 1]}%. A drop that big means a real group is still being forced to share a centre with another one.`, false];
      return [`From ${k - 1} to ${k} the total fell only ${DROP[k - 2]}%. The big gains stopped earlier: this extra centre splits a group that was already whole.`, false];
    };
    const paint = () => {
      const s = pick == null ? null : say(pick + 1), ok = s && s[1];
      el.innerHTML = `<h1>How many groups?</h1>
        <p class="lead">Now ${CUSTOMERS.length} customers. They are simulated: their shopping habits were invented for this lesson. With this many customers you do not tap. You run the same <code>kmeans</code> for k = 1 to ${ELBOW.length} centres and print the total squared distance each time.</p>
        <p class="lead"><code>best_of(customers, k, 10, rng)</code> runs <code>kmeans</code> from 10 random starts and keeps the run with the lowest total. The next screen shows why one start is not enough.</p>
        <div class="lx-${ID}-code">${kit.code(ELBOW_CODE, -1)}</div>
        ${ok ? plot(kit, { pts: CUSTOMERS, kinds: groupsOf(BEST4.groups), centres: BEST4.centres.map(c => [c, ""]), aria: "the customers in four groups" }) + key(BEST4.sizes.map((n, g) => [g, `${n} customers`]).concat([["c", "centre"]])) : plot(kit, { pts: CUSTOMERS, kinds: CUSTOMERS.map(() => 0), aria: "300 customers" })}
        <p class="task">Below is the printed total for each k: lower means tighter groups. Tap the k you would give the marketing team.</p>
        ${kit.bars(ELBOW.map(v => Math.round(v)), { pick: !ok, labels: ELBOW.map((_, i) => `k=${i + 1}`), cls: pick == null ? {} : { [pick]: ok ? "enter" : "no" } })}
        <div class="lpanel">${s ? kit.feedback(s[0], s[1]) : ""}${ok ? kit.feedback(`Sizes ${BEST4.sizes.join(", ")}. It found the four habits built into the simulation without being told about them: frequent small baskets, weekly big shops, occasional small shops, and the ones in between. Naming them, and checking that they make sense, is still your job.`) : ""}</div>`;
      el.querySelectorAll(".chart button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick + 1 === BEST_K) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: one random start, a worse answer. */
  function brokenStart({ el, done, kit }) {
    ensureStyle();
    let a0 = null, a1 = null;
    const opts0 = [
      `k = 4 is the wrong number of groups`,
      `It stopped too early; it needed more rounds`,
      `${crowded} of the 4 random starting centres landed in the same group of customers`,
      `The two columns should have been scaled first`
    ];
    const fb0 = [
      [`k = 4 is what the elbow chose, and the best of 10 starts with the same k = 4 found a total of ${f1(BEST4.total)}. Same k, much better answer: k is not the problem.`, false],
      [`It ran until no centre moved (${BROKEN.rounds} rounds, out of a limit of 100). More rounds would change nothing: it has settled.`, false],
      [`Right. Look at the starts: ${BROKEN.start.map(s => kit.esc(who(s))).join("; ")}. ${crowded} of them are frequent small-basket shoppers. One of the three wandered off to the occasional shoppers, but two stayed and split the frequent shoppers between them, so one centre was left to cover two real groups. From there no single move lowers the total: a centre leaving the frequent shoppers would first make its group worse. The run is stuck in a worse answer (a <b>local minimum</b>).`, true],
      ["Both columns are already on the same footing here (one visit a month counts like €10). Scaling would not move three starting centres out of the same group.", false]
    ];
    const opts1 = ["Raise the round limit to 1,000", "Run several random starts and keep the one with the lowest total", "Use k = 3 instead", "Remove the customers with the biggest baskets"];
    const fb1 = [
      ["It already stopped because nothing moved. Extra rounds repeat the same answer.", false],
      [`Right. On the elbow screen, ${STUCK} of the 10 single starts for k = 4 ended stuck, at ${f1(Math.min(...BEST4_TOTALS.filter(t => t > BEST4.total * 1.3)))} or worse; the best reached ${f1(BEST4.total)}. Keeping the lowest total throws the stuck starts away. scikit-learn's <code>KMeans</code> does both halves for you: <code>n_init</code> is the number of starts it keeps the best of, and its default start, <code>init="k-means++"</code>, picks starting centres spread apart. Careful: with the default <code>n_init="auto"</code> and k-means++, it makes only one start, so set <code>n_init</code> yourself if you want several.`, true],
      ["The elbow said 4 real groups. Fewer centres would hide this failure by merging groups on purpose, and the marketing team would lose a segment.", false],
      ["No customer is odd here; the failure is where the centres started. Removing customers changes the data to fit a bad run.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same k, a worse answer</h1>
        <p class="lead">A colleague ran <code>kmeans</code> with k = 4 on the same ${CUSTOMERS.length} customers, but with <b>one</b> random start: four customers picked at random became the starting centres (seed ${BROKEN.seed}, the number that fixes which four). It reported: stopped after ${BROKEN.rounds} rounds, total <b>${f1(BROKEN.total)}</b>, group sizes ${BROKEN.sizes.join(", ")}. The best of 10 starts had a total of ${f1(BEST4.total)}.</p>
        ${plot(kit, { pts: CUSTOMERS, kinds: groupsOf(BROKEN.groups), centres: BROKEN.centres.map(c => [c, ""]), aria: "the colleague's four groups" })}
        ${key(BROKEN.sizes.map((n, g) => [g, `${n} customers`]).concat([["c", "final centre"]]))}
        <p class="task">What went wrong?</p>
        <div class="lpanel" id="q0">${ask(kit, opts0, 2, a0, fb0)}</div>
        ${a0 === 2 ? `<p class="task">What do you change so this cannot happen silently?</p><div class="lpanel" id="q1">${ask(kit, opts1, 1, a1, fb1)}</div>
          <p class="lead"><b>Not run by us:</b> the scikit-learn parameters above are written from the <a href="https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html">official documentation</a> (version 1.9.1), checked 2026-11-14. This lesson's runs use the NumPy code only.</p>` : ""}`;
      el.querySelectorAll("#q0 .lopts button").forEach(b => b.onclick = () => { a0 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); if (a1 === 1) done(); });
    };
    paint();
  }

  /* 8. When the groups are not real: even customers, k-means cuts them anyway. */
  function notReal({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Yes: k-means finished and reported four groups",
      "Yes: the four groups have similar sizes, so they are balanced",
      "No: these customers form one even cloud, and the totals shrink gradually with no sharp bend; k-means cuts any data into k pieces",
      "No: k = 8 had the lowest total, so use 8 groups"
    ];
    const RIGHT = 2;
    const fb = [
      ["Finishing proves nothing about the data. The two moves stop on any data at all, groups or not, as you saw on the stopping screen.", false],
      ["Similar sizes are what you get when you slice an even cloud into four. Equal slices of a cake are not four different cakes.", false],
      [`Right. Here the cuts from each extra centre shrink gradually (${FDROP.slice(0, 5).join("%, ")}% for k = 2 to 6): no k stands out. On the grouped customers the cut fell off a cliff right after k = ${BEST_K}, from ${DROP[BEST_K - 2]}% to ${DROP[BEST_K - 1]}%. Before you sell segments, look at the picture and look for a bend. k-means always returns k groups; whether they exist is your question to answer.`, true],
      ["The total always falls as k grows, groups or not. With no bend, there is no good k, because there are no groups to find.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Four segments, or four slices?</h1>
        <p class="lead">A second region sends ${FLAT.length} customers (also simulated, this time drawn evenly over the whole chart, with no habits built in). The same code, best of 10 starts, k = 4, returned groups of ${FLAT4.sizes.join(", ")}.</p>
        ${plot(kit, { pts: FLAT, kinds: groupsOf(FLAT4.groups), centres: FLAT4.centres.map(c => [c, ""]), aria: "evenly spread customers cut into four" })}
        ${key(FLAT4.sizes.map((n, g) => [g, `${n} customers`]))}
        ${kit.bars(FLAT_ELBOW.map(v => Math.round(v)), { labels: FLAT_ELBOW.map((_, i) => `k=${i + 1}`) })}
        <p class="lx-${ID}-cap">Total squared distance for k = 1 to ${FLAT_ELBOW.length} on this region.</p>
        <p class="task">Should marketing build four promotions on these four groups?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Computing time: k-means on every customer, every month",
      "The groups come back unnamed and in a new order, with moved borders, so someone must match and check them each month",
      "Storing the centres"
    ];
    const RIGHT = 1;
    const fb = [
      ["k-means is one of the fastest clustering methods; each round is distances and averages. A monthly run is cheap. The cost is in the people who must use the result.", false],
      ["Right. Group numbers depend on the start: last month's group 2 can be this month's group 0, and new customers shift the borders. Matching new centres to old segments, and checking they still make sense, is real recurring work.", true],
      ["k centres are k short rows of numbers. They cost nothing to store.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for k-means</h1>
        <p class="lead"><b>What it is:</b> k-means finds groups in data with no labels. It works when each row is a few numbers and the distance between rows means something.</p>
        <p class="lead"><b>Reach for it</b> as a fast first cut: customer segments, or choosing k spots that sit close to many points.</p>
        <p class="lead"><b>Not when:</b> you have labels (train a classifier, like k-NN); the data has no groups (it cuts anyway); groups are long, curved, or very uneven in size or in how crowded they are (scikit-learn lists DBSCAN and HDBSCAN for those); or the columns are categories, where an average means nothing.</p>
        <p class="lead"><b>Costs:</b> running it is cheap. The work is around it: putting the columns on one footing, choosing k, running several starts, and a person checking and naming every group.</p>
        <p class="task">The chain will rerun the segmentation every month with new customers. Which cost bites first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it, including two cases where k-means is the wrong tool. */
  const CASES = [
    ["A music app wants to group its listeners by minutes per day spent on four kinds of music (all on one scale), to design a handful of start pages. No listener has a label.", true,
      "Yes. Numbers only, no labels, and the goal is a few groups with a typical member each. The centres even describe each start page's listener.",
      "There are no labels, the columns are numbers on one scale, and the team wants a few typical listeners. That is exactly what centres give you. Check the elbow, and run several starts."],
    ["A bank has 50,000 past card payments, each marked fraud or not, and wants to flag new fraud.", false,
      "No. The payments already carry the answer you want to predict. k-means never looks at labels; it would group payments by amount and time, not by fraud. Train a classifier on the labels.",
      "The labels exist and are the whole point. k-means ignores them and finds whatever groups the numbers happen to form. A classifier (k-NN, a tree, logistic regression) learns from the labels."],
    ["A courier maps delivery addresses. They lie along two long, curving river valleys, and the courier wants one group per valley.", false,
      "No. k-means draws its groups around centres, so its borders are straight lines halfway between centres. It cuts a long curved valley into pieces and can glue the ends of two valleys together. A density method such as DBSCAN follows the shape.",
      "Every customer joins its nearest centre, so each group is a compact patch around one point. A long curved band has no such centre. Use a density-based method such as DBSCAN, which grows groups along crowded areas."],
    ["A city will place 6 parcel lockers and wants them where the squared straight-line distance from homes to their nearest locker is smallest.", true,
      "Yes. That total is exactly what k-means lowers: k = 6 centres, each home assigned to its nearest one. The centres are candidate locker spots (then checked against real streets).",
      "This is the k-means total word for word: homes are points, lockers are k centres, each home uses the nearest. The centres it returns are good starting spots for the lockers."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>k-means or not?</h1>
        <p class="lead">Four requests from other teams.</p>
        <p class="task">Would you reach for k-means in each one? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can run k-means</h1>
      <p class="lead">You assigned customers to the nearest centre, moved each centre to its group's average, and saw why the total can only fall, so it always stops. Then you chose k from the elbow, caught a run stuck by a bad start, and saw k-means cut groupless data into neat slices.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the assign and update moves with NumPy and stop when the centres no longer move.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It also works on unlabeled number columns, but instead of grouping rows it finds the directions the data spreads along, so many columns can be drawn in two.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Clustering with k-means",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/clustering.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.linalg.norm.html",
      "https://numpy.org/doc/stable/user/basics.broadcasting.html"
    ],
    interview: [
      {
        q: "You built customer segments with k-means. Marketing says the segments change every time you rerun it on the same data. What is going on, and what do you do?",
        good: [
          "k-means starts from random centres and can settle in a worse answer (a local minimum), so different starts give different groups",
          "Run several starts and keep the lowest total (n_init in scikit-learn), and use a spread-out start such as k-means++",
          "Fix the random seed so a rerun is reproducible, but only after the result is good",
          "Group numbers are arbitrary, so match segments by their centres, not by their number",
          "If the groups still move a lot, ask whether they are real at all: check the elbow and the picture"
        ],
        weak: "Raise the number of iterations. A run that stopped has already settled; more rounds give the same answer."
      },
      {
        q: "How do you choose k for a clustering of customers, and how would you convince a manager the clusters are real?",
        good: [
          "Plot the total squared distance (inertia) for a range of k and look for the bend where an extra centre stops paying off",
          "The total always falls as k grows, so the lowest total is never the answer",
          "Compare with data that has no groups: there the curve falls steadily with no bend",
          "Rerun on another sample and with other starts: real groups come back with similar centres",
          "Check that each group can be described and acted on by the business"
        ],
        weak: "Pick the k with the lowest inertia, or the k the business asked for, without checking that the groups exist in the data."
      }
    ],
    screens: [assignByHand, updateByHand, roundTwo, spotIdea, asCode, elbow, brokenStart, notReal, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-i="${HAND.findIndex((_, i) => G1[i] === 0)}"]`, "[data-check]"],
        right: ["[data-clear]", ...B1.map(i => `[data-i="${i}"]`), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${HAND.findIndex((_, i) => !SWITCH2.includes(i))}"]`, "[data-check]"],
        right: ["[data-clear]", ...SWITCH2.map(i => `[data-i="${i}"]`), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(FR.length - 1).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`.chart [data-i="${ELBOW.length - 1}"]`], right: [`.chart [data-i="${BEST_K - 1}"]`] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
