/* Lesson s5a-rerankers: Rerankers and cross-encoders.
   Story: a garden centre's staff assistant searches chunked plant-care sheets for pest, watering and frost
   questions. The search (a bi-encoder) finds the right chunk but often not on top; a cross-encoder reads the
   question and each candidate together and reorders the top k.
   Ideas: (1) a bi-encoder squeezes each chunk into one vector before any question exists, a cross-encoder reads
   question + chunk together, so it ranks better but must run once per candidate at question time;
   (2) pick k, the number of candidates to rerank, from the time budget and where the right chunk sits.
   Debug: whole sheets reranked with max_length=128, so the answer section is cut off.
   Data (all real runs on this Mac, nothing typed as a result):
     docs/ai-path/runs/s5a-rerankers/sheets.py         the 45 chunks and 20 questions (written for the lesson)
     docs/ai-path/runs/s5a-rerankers/retrieve.out.txt  bi-encoder cosine and cross-encoder score for every chunk, per question
     docs/ai-path/runs/s5a-rerankers/timing.out.txt    retrieve and rerank times (Apple M1 CPU, onnxruntime)
     docs/ai-path/runs/s5a-rerankers/truncation.out.txt  the max_length=128 vs 512 run on whole sheets
     docs/ai-path/runs/s5a-rerankers/sanity.out.txt    the ONNX models reproduce the model card's example scores
     docs/ai-path/runs/s5a-rerankers/library.out.txt   screen 6: the pipeline with sentence-transformers (PyTorch, CPU)
     docs/ai-path/runs/s5a-rerankers/compare.out.txt   the library and the ONNX run agree on all 20 x 45 scores
   Models: sentence-transformers/all-MiniLM-L6-v2 (bi-encoder) and cross-encoder/ms-marco-MiniLM-L6-v2. Screens 1-5
   and 7 use their official ONNX exports run with onnxruntime; screen 6 runs the same revisions with
   sentence-transformers, and compare.out.txt shows both give the same scores.
   No model API calls. Lesson-local CSS (prefix lx-s5a-rerankers-): comparison table, the two-model diagram,
   code and output blocks, the notebook checklist. Plain browser script. */
(() => {
  const ID = "s5a-rerankers";
  const P = `lx-${ID}`;
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5a-rerankers.ipynb";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const ORD = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
  const f2 = x => (x < 0 ? "−" : "") + Math.abs(x).toFixed(2);

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s5a-rerankers/sheets.py (SHEETS): each care sheet split into five sections
  const CHUNKS = {
    "tomato-water": "Tomato: watering. Water little and often so the compost stays evenly moist. Letting pots dry out and then flooding them makes the fruit split and causes blossom end rot.",
    "tomato-feed": "Tomato: feeding. Once the first flowers have set fruit, give a high-potash liquid feed every week until the end of summer.",
    "tomato-pests": "Tomato: pests. Whitefly are small sap-sucking insects that rise in a cloud when the plant is touched. Hang sticky traps and release the parasitic wasp Encarsia once nights stay above 10 °C.",
    "tomato-winter": "Tomato: end of season. Tomatoes are killed by the first frost. Pick the last green fruit in autumn and ripen them indoors next to a banana.",
    "tomato-problems": "Tomato: problems. Blight shows as brown patches on leaves and dark stems after warm, wet weather, and the fruit rots within days. Remove the plants and do not compost them.",
    "lemon-water": "Lemon tree: watering. Water when the top of the compost feels dry, then let the pot drain. Use rainwater if you can. Water much less in winter.",
    "lemon-feed": "Lemon tree: feeding. Use a summer citrus feed from March to September and a winter citrus feed for the rest of the year. Yellow leaves with green veins mean it needs feeding.",
    "lemon-pests": "Lemon tree: pests. Scale insects look like small brown bumps under the leaves and along the stems. They leave a sticky coating on the leaves. Wipe them off with a soft cloth and soapy water.",
    "lemon-winter": "Lemon tree: winter. Citrus are not frost hardy. Bring the tree indoors before the first frost to a cool, bright room, and never leave it outside on a frosty night.",
    "lemon-problems": "Lemon tree: problems. Sudden leaf drop usually follows a move to a new spot, a cold draught or a dry heated room. Keep it in one bright place and mist the leaves.",
    "rose-water": "Rose: watering. Water new roses deeply once a week in dry spells for their first summer. Water at the base, not over the leaves.",
    "rose-feed": "Rose: feeding. Feed with a rose fertiliser in spring and again after the first flush of flowers. Mulch with well-rotted manure.",
    "rose-pests": "Rose: pests. Greenfly cluster on soft shoot tips and flower buds in spring. Squash small groups by hand and encourage ladybirds.",
    "rose-winter": "Rose: winter and pruning. Prune bush roses in late winter: cut out dead and crossing stems, then shorten the rest to an outward-facing bud.",
    "rose-problems": "Rose: problems. Black spot is a fungus that marks the leaves with dark blotches; the leaves turn yellow and fall from midsummer. Clear up fallen leaves and choose resistant varieties.",
    "orchid-water": "Moth orchid: watering. Water once the roots in the clear pot turn silvery, usually every week or two. Soak the pot for ten minutes, then let it drain fully.",
    "orchid-feed": "Moth orchid: feeding. Use a weak orchid feed every third watering while it is growing new leaves or flower spikes.",
    "orchid-pests": "Moth orchid: pests. Mealybugs look like bits of white cotton wool in the leaf joints. Dab them with a cotton bud dipped in rubbing alcohol.",
    "orchid-winter": "Moth orchid: winter. Keep it above 15 °C and away from cold windows at night. A drop of a few degrees in autumn helps a new flower spike to start.",
    "orchid-problems": "Moth orchid: problems. Wrinkled, limp leaves with mushy brown roots mean the roots have rotted from too much water. Cut off the dead roots and repot in fresh bark.",
    "hydrangea-water": "Hydrangea: watering. Hydrangeas in pots are thirsty. In summer they often wilt in the afternoon heat and recover by evening: water them every day and move the pot out of the midday sun.",
    "hydrangea-feed": "Hydrangea: feeding and colour. Blue flowers need acid soil; in chalky soil they turn pink. A colourant with aluminium sulphate keeps them blue.",
    "hydrangea-pests": "Hydrangea: pests. Vine weevil grubs eat the roots of hydrangeas in pots, and the plant wilts and does not recover even after watering. Water a nematode treatment into the pot in late summer.",
    "hydrangea-winter": "Hydrangea: winter. Leave the dead flower heads on through winter; they protect the buds below from frost. Cut them off in spring.",
    "hydrangea-problems": "Hydrangea: problems. No flowers usually means it was pruned in autumn or spring frost killed the buds. Mophead hydrangeas flower on last year's stems.",
    "dahlia-water": "Dahlia: watering. Water dahlias generously once a week in dry weather once they are growing strongly. Do not water the tubers before shoots appear.",
    "dahlia-feed": "Dahlia: feeding. Give a high-potash feed every two weeks from midsummer for more flowers. Pinch out the tips of young plants so they bush out.",
    "dahlia-pests": "Dahlia: pests. Earwigs chew ragged holes in dahlia petals at night. Trap them in upturned pots stuffed with straw on top of canes.",
    "dahlia-winter": "Dahlia: winter. After the first frost blackens the leaves, cut the stems back, lift the tubers, dry them upside down and store them in dry compost somewhere frost-free.",
    "dahlia-problems": "Dahlia: problems. Slugs eat young dahlia shoots as soon as they come up in spring. Start tubers in pots and plant out larger plants.",
    "strawberry-water": "Strawberry: watering. Water at the base in the morning while the fruit is forming. Wet fruit in the evening invites grey mould.",
    "strawberry-feed": "Strawberry: feeding. Feed with a high-potash liquid feed every two weeks once flowers appear.",
    "strawberry-pests": "Strawberry: pests. Birds and slugs take ripening fruit. Net the plants and tuck straw under the fruit to keep it off the soil.",
    "strawberry-winter": "Strawberry: winter. Strawberries are hardy. After fruiting, cut off the old leaves and remove runners you do not want, so the plant rests.",
    "strawberry-problems": "Strawberry: problems. Grey fuzzy mould on the fruit spreads in damp weather. Pick off mouldy fruit at once and space plants for air.",
    "basil-water": "Basil: watering. Water basil in the morning and let the top of the compost dry between waterings. Cold, wet roots at night make it collapse.",
    "basil-feed": "Basil: picking. Pinch off the top pairs of leaves often and remove flower buds, so the plant keeps growing leaves.",
    "basil-pests": "Basil: pests. Aphids hide under basil leaves indoors. Rinse the plant under a gentle tap and check again in a few days.",
    "basil-winter": "Basil: winter. Basil is killed by cold below about 10 °C. Grow it on a sunny windowsill indoors from autumn.",
    "basil-problems": "Basil: problems. Black, wilting stems at the base on supermarket pots mean the plants are too crowded and too wet. Split the pot into small clumps.",
    "cucumber-water": "Cucumber: watering. Keep the compost evenly moist with warm water in the morning. Bitter fruit is a sign of irregular watering.",
    "cucumber-feed": "Cucumber: feeding. Feed every week with a high-potash feed once the first fruits start to swell.",
    "cucumber-pests": "Cucumber: pests. Red spider mite turns leaves pale and speckled with fine webbing in hot, dry glasshouses. Mist the plants and release the predatory mite Phytoseiulus.",
    "cucumber-winter": "Cucumber: end of season. Cucumbers stop cropping as nights cool in autumn. Clear the plants and clean the greenhouse glass before winter.",
    "cucumber-problems": "Cucumber: problems. Powdery mildew is a white dusty coating on leaves, worst in dry soil and still air. Water at the roots and remove the worst leaves."
    };
  // From docs/ai-path/runs/s5a-rerankers/retrieve.out.txt: for each question, every chunk in the bi-encoder's
  // order as [chunk id, cosine similarity, cross-encoder score (raw logit, max_length=512)]
  const RUN = [
    { q: "Tiny white bugs fly up when I touch my tomato plants in the greenhouse. How do I get rid of them?", gold: "tomato-pests",
      bi: [["tomato-pests",0.7659,3.843],["orchid-pests",0.4286,-7.6504],["tomato-water",0.4161,-5.4082],["lemon-pests",0.4075,-5.5626],["tomato-problems",0.403,-2.8647],["basil-pests",0.3984,-6.8093],["rose-pests",0.3779,-10.4318],["tomato-winter",0.3516,-7.2413],["strawberry-pests",0.3465,-8.4017],["dahlia-pests",0.3335,-9.5224],["cucumber-pests",0.3285,-7.869],["cucumber-problems",0.2983,-8.2266],["tomato-feed",0.2938,-7.4992],["orchid-water",0.2716,-9.5827],["hydrangea-pests",0.2626,-8.2586],["orchid-feed",0.2566,-9.8095],["strawberry-problems",0.2443,-9.7659],["basil-water",0.2383,-9.2609],["orchid-winter",0.2272,-10.3663],["dahlia-problems",0.2254,-9.6275],["dahlia-winter",0.2243,-8.9645],["cucumber-water",0.2241,-9.8366],["basil-feed",0.221,-7.8084],["dahlia-water",0.205,-9.8939],["strawberry-water",0.2042,-10.1259],["cucumber-winter",0.2036,-7.3579],["lemon-water",0.1927,-9.8933],["lemon-problems",0.1763,-10.0235],["cucumber-feed",0.1704,-10.6031],["dahlia-feed",0.1648,-9.8825],["hydrangea-winter",0.154,-9.6738],["basil-problems",0.1517,-9.2396],["orchid-problems",0.1432,-9.6777],["strawberry-feed",0.1122,-10.4627],["strawberry-winter",0.1026,-9.6844],["lemon-winter",0.0999,-10.9169],["hydrangea-water",0.0939,-9.5703],["hydrangea-feed",0.0895,-10.0561],["hydrangea-problems",0.0791,-10.5276],["rose-problems",0.0761,-9.9989],["rose-feed",0.0741,-10.7043],["lemon-feed",0.0712,-10.9769],["rose-water",0.0673,-10.5506],["basil-winter",0.0596,-10.4198],["rose-winter",0.0175,-10.2234]] },
    { q: "Customer says her greenhouse tomatoes keep cracking open just before they ripen. What is she doing wrong?", gold: "tomato-water",
      bi: [["tomato-winter",0.523,-7.697],["tomato-water",0.5216,-8.7469],["tomato-feed",0.4404,-9.5742],["tomato-problems",0.402,-7.8738],["tomato-pests",0.3952,-10.0235],["strawberry-pests",0.3536,-10.3001],["strawberry-water",0.3388,-10.6648],["strawberry-problems",0.3362,-10.7542],["cucumber-winter",0.3087,-8.274],["strawberry-feed",0.2932,-10.9641],["cucumber-feed",0.2636,-10.9826],["cucumber-water",0.2413,-10.7212],["strawberry-winter",0.2383,-10.9262],["basil-problems",0.22,-10.1594],["orchid-water",0.2054,-11.0831],["dahlia-winter",0.205,-11.0116],["dahlia-feed",0.1977,-11.0647],["dahlia-water",0.1895,-9.9979],["hydrangea-water",0.1871,-10.7013],["rose-water",0.1833,-11.0839],["basil-water",0.1824,-10.8222],["cucumber-problems",0.1791,-11.0272],["hydrangea-feed",0.1765,-11.1323],["hydrangea-pests",0.1723,-10.9296],["cucumber-pests",0.1681,-11.1448],["lemon-water",0.1678,-11.1813],["rose-feed",0.1638,-11.1597],["dahlia-problems",0.1613,-10.7037],["orchid-pests",0.1595,-11.1402],["orchid-feed",0.1569,-10.8578],["dahlia-pests",0.1564,-11.1689],["hydrangea-winter",0.1563,-10.9689],["rose-pests",0.1519,-11.2867],["lemon-problems",0.1497,-10.859],["orchid-problems",0.1476,-11.1108],["hydrangea-problems",0.1442,-11.058],["basil-feed",0.1365,-10.4611],["lemon-winter",0.1354,-10.9861],["rose-problems",0.1227,-11.0735],["basil-pests",0.1109,-10.8896],["lemon-pests",0.0986,-11.1135],["orchid-winter",0.0924,-11.0554],["basil-winter",0.0849,-11.0134],["lemon-feed",0.0659,-11.212],["rose-winter",0.0406,-11.0864]] },
    { q: "Brown patches on the tomato leaves after a wet week, and the stems are going dark. What is it?", gold: "tomato-problems",
      bi: [["tomato-problems",0.7613,6.6937],["tomato-water",0.5233,-6.884],["tomato-pests",0.4292,-7.0317],["tomato-winter",0.4209,-7.096],["tomato-feed",0.3704,-6.5485],["strawberry-water",0.3685,-8.4586],["rose-problems",0.3572,-4.8116],["dahlia-winter",0.3074,-5.6322],["lemon-pests",0.3034,-4.5987],["cucumber-water",0.2981,-9.7707],["strawberry-problems",0.2868,-9.182],["cucumber-problems",0.2785,-7.4778],["basil-problems",0.2562,-4.3979],["dahlia-water",0.2556,-8.6658],["cucumber-winter",0.2539,-9.7622],["basil-water",0.2535,-9.486],["basil-pests",0.2374,-9.447],["orchid-problems",0.2315,-7.3179],["rose-water",0.23,-8.7185],["lemon-water",0.2275,-10.6256],["orchid-water",0.2216,-8.3589],["strawberry-pests",0.2186,-10.5943],["strawberry-winter",0.2132,-10.0152],["cucumber-pests",0.2062,-8.9793],["lemon-problems",0.2043,-8.9911],["basil-feed",0.2035,-9.7537],["cucumber-feed",0.2013,-9.8494],["strawberry-feed",0.1808,-9.6492],["orchid-pests",0.1776,-10.1319],["dahlia-feed",0.1771,-10.3324],["hydrangea-winter",0.1769,-10.3646],["dahlia-pests",0.1745,-10.9989],["hydrangea-pests",0.1601,-9.85],["rose-pests",0.157,-10.9479],["hydrangea-water",0.1484,-10.2686],["basil-winter",0.1377,-10.1762],["orchid-winter",0.1353,-10.4872],["hydrangea-feed",0.1143,-10.2461],["dahlia-problems",0.1113,-10.6585],["orchid-feed",0.1009,-10.2571],["hydrangea-problems",0.1,-9.2204],["lemon-winter",0.0939,-10.644],["lemon-feed",0.0753,-10.3431],["rose-winter",0.0728,-10.2334],["rose-feed",0.0656,-10.853]] },
    { q: "Lady with a lemon tree in the conservatory says the leaves are sticky. What is causing it?", gold: "lemon-pests",
      bi: [["lemon-pests",0.6219,2.0534],["lemon-problems",0.584,-2.0913],["lemon-winter",0.4726,-6.2014],["lemon-water",0.452,-7.0609],["lemon-feed",0.4434,-7.1844],["cucumber-pests",0.3391,-10.1795],["basil-pests",0.3345,-9.9829],["basil-feed",0.2978,-10.2869],["tomato-pests",0.2956,-9.0329],["orchid-pests",0.2696,-10.2469],["cucumber-problems",0.2671,-9.4339],["orchid-water",0.2664,-10.9028],["orchid-problems",0.2633,-9.2889],["rose-problems",0.2629,-9.2735],["dahlia-pests",0.2486,-10.6562],["tomato-water",0.2324,-9.9024],["cucumber-water",0.2297,-10.5761],["strawberry-pests",0.2261,-10.5395],["tomato-problems",0.2243,-10.0895],["basil-problems",0.2241,-9.475],["strawberry-problems",0.2135,-10.2089],["strawberry-water",0.2125,-10.4829],["orchid-feed",0.2105,-10.5884],["rose-pests",0.1896,-10.5406],["basil-water",0.1821,-10.5809],["basil-winter",0.1706,-10.4263],["tomato-feed",0.1703,-11.0558],["orchid-winter",0.1697,-10.8436],["hydrangea-pests",0.1643,-10.3857],["cucumber-winter",0.1622,-10.7328],["dahlia-winter",0.1499,-10.204],["cucumber-feed",0.1393,-10.9821],["dahlia-feed",0.1355,-11.0763],["tomato-winter",0.1343,-10.9536],["strawberry-feed",0.1258,-10.9715],["rose-water",0.1252,-10.7583],["hydrangea-feed",0.1243,-10.6977],["strawberry-winter",0.1107,-10.7563],["hydrangea-water",0.1104,-10.4872],["hydrangea-problems",0.0982,-10.1785],["rose-feed",0.0849,-11.0626],["hydrangea-winter",0.0805,-10.6058],["dahlia-water",0.0634,-10.951],["dahlia-problems",0.0474,-10.7501],["rose-winter",0.0446,-11.0645]] },
    { q: "Can my lemon tree stay outside when frost is forecast?", gold: "lemon-winter",
      bi: [["lemon-winter",0.7721,7.3721],["lemon-problems",0.4953,-2.7036],["lemon-water",0.4887,-4.9095],["lemon-feed",0.4655,-4.5402],["lemon-pests",0.3255,-5.9164],["dahlia-winter",0.3243,-8.2069],["tomato-winter",0.3222,-9.2117],["orchid-winter",0.3116,-8.8744],["cucumber-winter",0.2919,-11.0171],["basil-winter",0.2867,-9.7287],["hydrangea-winter",0.2776,-9.2085],["orchid-water",0.2074,-11.3148],["basil-water",0.2037,-11.2665],["tomato-pests",0.2025,-11.0998],["strawberry-water",0.1976,-11.2514],["hydrangea-water",0.1776,-11.2273],["cucumber-water",0.1729,-11.2409],["strawberry-winter",0.1623,-10.8475],["tomato-water",0.1603,-11.2857],["strawberry-problems",0.1567,-10.6618],["rose-winter",0.1501,-11.1762],["tomato-feed",0.1471,-11.3157],["rose-water",0.1333,-11.2881],["orchid-feed",0.1299,-11.3152],["cucumber-pests",0.1286,-11.2766],["dahlia-water",0.1281,-11.1052],["hydrangea-feed",0.1206,-11.2999],["rose-problems",0.117,-11.2235],["strawberry-pests",0.1124,-11.2924],["strawberry-feed",0.1067,-11.3403],["tomato-problems",0.1067,-10.9032],["cucumber-feed",0.1039,-11.36],["orchid-problems",0.0987,-11.3206],["rose-feed",0.087,-11.3151],["hydrangea-problems",0.0861,-10.1016],["hydrangea-pests",0.0787,-11.3361],["rose-pests",0.076,-11.3259],["dahlia-feed",0.0707,-11.2842],["dahlia-pests",0.0686,-11.296],["basil-pests",0.0667,-10.897],["basil-feed",0.0379,-11.2937],["basil-problems",0.0359,-11.3271],["cucumber-problems",0.0312,-11.2748],["orchid-pests",0.0275,-11.3314],["dahlia-problems",0.0144,-11.3084]] },
    { q: "I moved my lemon tree into the living room and now it is dropping leaves. Is it dying?", gold: "lemon-problems",
      bi: [["lemon-problems",0.7719,2.7568],["lemon-winter",0.5628,-3.5502],["lemon-water",0.5626,-6.7988],["lemon-pests",0.5456,-4.4581],["lemon-feed",0.4888,-6.9448],["cucumber-pests",0.2689,-10.9254],["orchid-water",0.2501,-11.1254],["orchid-problems",0.243,-10.4748],["tomato-water",0.2343,-11.0889],["basil-water",0.2204,-10.655],["tomato-winter",0.2191,-10.8124],["cucumber-water",0.2177,-11.074],["basil-problems",0.2173,-10.7809],["strawberry-water",0.2127,-10.946],["basil-pests",0.2117,-10.4849],["tomato-problems",0.2109,-10.6162],["tomato-pests",0.1962,-11.1492],["strawberry-pests",0.1898,-11.0037],["rose-problems",0.1889,-10.4952],["strawberry-problems",0.1865,-10.8309],["cucumber-problems",0.1854,-10.6838],["basil-winter",0.1765,-10.4225],["basil-feed",0.1723,-10.5587],["cucumber-winter",0.1704,-11.0916],["rose-water",0.1686,-11.0609],["orchid-feed",0.1657,-10.7853],["orchid-winter",0.1452,-10.6184],["tomato-feed",0.1448,-11.1688],["hydrangea-pests",0.1357,-11.0526],["dahlia-winter",0.1348,-10.1992],["cucumber-feed",0.134,-11.0935],["rose-pests",0.1328,-11.2614],["strawberry-winter",0.1059,-10.64],["dahlia-pests",0.1054,-11.0414],["strawberry-feed",0.1005,-10.9864],["rose-feed",0.0961,-11.1731],["hydrangea-water",0.0942,-10.7049],["orchid-pests",0.0863,-11.0047],["rose-winter",0.0801,-11.0985],["dahlia-water",0.0798,-11.1659],["dahlia-feed",0.0786,-11.2006],["dahlia-problems",0.0783,-11.0822],["hydrangea-feed",0.0744,-11.1647],["hydrangea-problems",0.053,-10.7067],["hydrangea-winter",0.0438,-10.7947]] },
    { q: "Roses have dark marks on the leaves and the leaves are falling off in July.", gold: "rose-problems",
      bi: [["rose-problems",0.5729,3.9722],["rose-water",0.5169,-3.9776],["rose-winter",0.499,-6.7036],["rose-feed",0.4405,-9.4956],["rose-pests",0.4081,-9.6591],["hydrangea-winter",0.3452,-8.4595],["dahlia-winter",0.3389,-7.0518],["hydrangea-problems",0.3362,-9.0752],["cucumber-winter",0.3237,-10.4211],["orchid-winter",0.3118,-10.0142],["tomato-problems",0.3006,-4.6665],["strawberry-winter",0.2965,-9.3713],["tomato-winter",0.2909,-10.7101],["dahlia-feed",0.2876,-10.5709],["strawberry-feed",0.2647,-10.5867],["dahlia-pests",0.2635,-10.8951],["orchid-problems",0.2612,-8.6845],["lemon-problems",0.2525,-8.9294],["basil-feed",0.245,-8.9094],["tomato-water",0.2397,-11.0795],["strawberry-pests",0.237,-10.9441],["strawberry-problems",0.2355,-10.3273],["cucumber-pests",0.2268,-9.6376],["dahlia-problems",0.2256,-10.8292],["lemon-pests",0.2186,-7.7175],["tomato-feed",0.2141,-10.3379],["strawberry-water",0.2051,-10.6867],["hydrangea-feed",0.2048,-10.0088],["basil-problems",0.2047,-9.7829],["lemon-feed",0.2,-9.7919],["lemon-winter",0.1905,-10.563],["orchid-feed",0.1862,-10.3288],["dahlia-water",0.1771,-10.9174],["orchid-pests",0.1738,-10.3514],["basil-pests",0.1715,-10.1323],["hydrangea-water",0.1661,-10.5711],["cucumber-water",0.1641,-10.9783],["orchid-water",0.1627,-10.9103],["tomato-pests",0.1613,-11.0642],["cucumber-problems",0.1598,-9.1189],["basil-winter",0.1575,-10.3453],["hydrangea-pests",0.1263,-10.6152],["lemon-water",0.1261,-11.1011],["basil-water",0.1039,-10.9956],["cucumber-feed",0.0881,-11.0986]] },
    { q: "When should I cut back my roses?", gold: "rose-winter",
      bi: [["rose-winter",0.6306,4.4071],["rose-water",0.575,-3.8769],["rose-feed",0.4884,-7.1691],["rose-problems",0.3579,-8.116],["rose-pests",0.3087,-10.7323],["strawberry-feed",0.3023,-10.8555],["strawberry-winter",0.2946,-9.2095],["hydrangea-winter",0.2897,-4.4282],["hydrangea-problems",0.2774,-8.0253],["orchid-winter",0.2673,-10.735],["dahlia-feed",0.2526,-10.6281],["dahlia-winter",0.2354,-4.6029],["tomato-winter",0.2153,-11.2669],["dahlia-problems",0.2063,-11.1802],["dahlia-pests",0.1852,-11.3008],["tomato-feed",0.1814,-10.8624],["cucumber-winter",0.1745,-11.1607],["tomato-water",0.1724,-11.2825],["basil-feed",0.1708,-10.8486],["strawberry-pests",0.1644,-11.3526],["orchid-water",0.1609,-11.0924],["dahlia-water",0.1606,-11.1647],["orchid-feed",0.1535,-11.2326],["basil-water",0.1327,-11.2159],["orchid-problems",0.1281,-10.8995],["strawberry-water",0.1274,-11.2506],["lemon-feed",0.104,-11.0722],["lemon-problems",0.1002,-11.3107],["strawberry-problems",0.0958,-11.375],["cucumber-feed",0.0951,-11.4127],["basil-winter",0.0947,-11.2447],["cucumber-water",0.0814,-11.2879],["lemon-winter",0.079,-11.289],["basil-problems",0.073,-11.2162],["cucumber-pests",0.072,-11.3651],["lemon-water",0.0577,-11.2916],["tomato-problems",0.0567,-11.1356],["hydrangea-pests",0.0483,-11.302],["basil-pests",0.0361,-11.2691],["hydrangea-feed",0.0215,-11.1729],["lemon-pests",0.0209,-11.2724],["hydrangea-water",0.0205,-11.2077],["orchid-pests",0.0183,-11.3555],["tomato-pests",-0.0037,-11.3738],["cucumber-problems",-0.0361,-11.3482]] },
    { q: "There is white fluffy stuff where the orchid leaves meet the stem.", gold: "orchid-pests",
      bi: [["orchid-feed",0.517,-8.7559],["orchid-problems",0.5155,-5.3682],["orchid-water",0.5041,-8.8639],["orchid-winter",0.4999,-9.3885],["orchid-pests",0.427,-3.9305],["strawberry-water",0.3407,-10.9376],["strawberry-pests",0.3277,-11.3217],["strawberry-feed",0.3129,-11.2887],["dahlia-winter",0.3091,-8.0355],["hydrangea-winter",0.2918,-10.3807],["rose-pests",0.2901,-11.2594],["dahlia-pests",0.2889,-11.1293],["basil-feed",0.2842,-10.3328],["tomato-pests",0.2744,-10.5816],["dahlia-feed",0.2721,-11.2918],["strawberry-problems",0.2624,-10.5221],["hydrangea-feed",0.2617,-10.6525],["tomato-feed",0.2528,-11.2806],["rose-feed",0.25,-11.2969],["strawberry-winter",0.2484,-11.0957],["rose-problems",0.2478,-10.307],["hydrangea-problems",0.2466,-9.492],["rose-winter",0.2222,-10.6427],["rose-water",0.2208,-11.1979],["dahlia-problems",0.2023,-11.2621],["tomato-water",0.2011,-11.2979],["dahlia-water",0.1828,-11.1476],["cucumber-water",0.1741,-11.3132],["basil-water",0.1727,-11.2911],["basil-winter",0.1641,-11.2782],["basil-pests",0.1625,-10.8249],["cucumber-pests",0.1473,-10.3815],["hydrangea-pests",0.1437,-11.1207],["lemon-pests",0.1398,-6.8183],["lemon-water",0.1368,-11.3337],["cucumber-problems",0.1255,-8.6809],["cucumber-feed",0.1199,-11.355],["basil-problems",0.1179,-8.8741],["tomato-winter",0.1174,-11.3956],["cucumber-winter",0.1166,-11.2964],["lemon-feed",0.1025,-11.255],["lemon-problems",0.0977,-10.838],["hydrangea-water",0.0863,-11.1916],["tomato-problems",0.0787,-9.0901],["lemon-winter",0.0681,-11.2986]] },
    { q: "My orchid leaves have gone floppy and wrinkled even though I water it twice a week.", gold: "orchid-problems",
      bi: [["orchid-problems",0.6929,0.0086],["orchid-water",0.6287,-1.243],["orchid-feed",0.4952,-3.9045],["orchid-winter",0.4592,-8.0484],["rose-water",0.3883,-5.5775],["dahlia-water",0.3808,-4.9993],["strawberry-water",0.327,-9.3675],["dahlia-winter",0.3255,-10.0657],["basil-water",0.3223,-9.2903],["orchid-pests",0.315,-7.0057],["hydrangea-problems",0.3122,-10.0057],["strawberry-problems",0.301,-10.1943],["strawberry-feed",0.2946,-7.6311],["lemon-water",0.2941,-10.3513],["hydrangea-water",0.2892,-8.6068],["cucumber-water",0.2847,-9.438],["tomato-water",0.2824,-10.2079],["dahlia-feed",0.2688,-8.7492],["hydrangea-winter",0.2638,-10.1963],["basil-feed",0.2632,-9.6541],["strawberry-winter",0.2553,-10.6605],["basil-problems",0.2484,-10.2403],["hydrangea-feed",0.243,-10.432],["lemon-problems",0.2294,-10.1525],["dahlia-pests",0.2278,-10.9931],["basil-pests",0.2234,-9.5506],["tomato-feed",0.2094,-8.8515],["cucumber-winter",0.207,-10.7723],["cucumber-problems",0.2067,-9.3723],["strawberry-pests",0.2048,-10.9508],["cucumber-pests",0.2032,-10.3552],["rose-problems",0.1994,-9.6984],["hydrangea-pests",0.1985,-9.1223],["tomato-problems",0.1959,-9.8422],["dahlia-problems",0.178,-10.7499],["rose-winter",0.1664,-10.9986],["cucumber-feed",0.1588,-9.2789],["rose-pests",0.157,-11.1333],["basil-winter",0.1495,-10.7107],["lemon-pests",0.1479,-9.361],["rose-feed",0.1354,-10.7312],["tomato-pests",0.1336,-11.0036],["lemon-winter",0.1237,-11.0525],["tomato-winter",0.0794,-11.1879],["lemon-feed",0.0715,-10.7165]] },
    { q: "His hydrangea in a pot wilts every afternoon in the sun but perks up by evening. Is it thirsty?", gold: "hydrangea-water",
      bi: [["hydrangea-water",0.7291,7.2255],["hydrangea-pests",0.5432,0.3955],["hydrangea-feed",0.4801,-5.9474],["hydrangea-problems",0.4439,-5.9463],["hydrangea-winter",0.4389,-5.9443],["strawberry-water",0.3806,-7.5403],["dahlia-water",0.3751,-9.4155],["rose-water",0.313,-9.969],["tomato-feed",0.3073,-8.8997],["strawberry-feed",0.2983,-8.687],["orchid-water",0.2977,-7.7126],["basil-water",0.2933,-8.5595],["dahlia-feed",0.2923,-8.0852],["cucumber-water",0.2908,-8.9315],["basil-problems",0.2823,-8.2486],["orchid-feed",0.251,-9.0595],["lemon-water",0.2425,-9.812],["basil-winter",0.2249,-10.4687],["tomato-water",0.22,-9.9398],["dahlia-pests",0.2188,-9.3569],["cucumber-feed",0.2133,-9.0775],["basil-feed",0.2062,-10.9372],["dahlia-winter",0.2014,-10.9581],["rose-feed",0.1954,-10.9336],["strawberry-pests",0.1937,-10.9529],["basil-pests",0.1743,-10.5998],["lemon-winter",0.1646,-10.7486],["orchid-pests",0.1641,-10.6755],["strawberry-problems",0.161,-10.6223],["cucumber-winter",0.1601,-10.5811],["lemon-feed",0.16,-10.8236],["strawberry-winter",0.1594,-11.0433],["lemon-problems",0.1556,-10.7369],["tomato-pests",0.1538,-10.7798],["cucumber-pests",0.1481,-10.8142],["rose-problems",0.1472,-10.6185],["dahlia-problems",0.146,-9.9696],["tomato-winter",0.139,-10.9821],["orchid-winter",0.1368,-9.8942],["cucumber-problems",0.1346,-10.777],["rose-pests",0.1265,-11.0493],["orchid-problems",0.1183,-10.8406],["tomato-problems",0.1165,-10.4475],["rose-winter",0.0699,-11.1711],["lemon-pests",0.0582,-11.0675]] },
    { q: "My potted hydrangea wilted and stays wilted even though the compost is wet.", gold: "hydrangea-pests",
      bi: [["hydrangea-water",0.6505,2.8669],["hydrangea-feed",0.4969,-4.9294],["hydrangea-pests",0.4745,3.3257],["hydrangea-problems",0.4513,-4.5529],["lemon-water",0.4204,-2.4336],["hydrangea-winter",0.3991,-4.8336],["basil-water",0.3956,-3.2029],["tomato-water",0.3794,-1.2789],["dahlia-water",0.3704,-10.0657],["strawberry-water",0.3391,-9.6507],["cucumber-water",0.331,-3.6718],["basil-problems",0.3168,-2.6951],["orchid-water",0.3099,-8.846],["dahlia-winter",0.2955,-6.7827],["rose-water",0.2559,-10.5611],["cucumber-problems",0.226,-8.9118],["dahlia-feed",0.2204,-10.3399],["strawberry-problems",0.2197,-10.0942],["tomato-feed",0.2083,-9.9819],["orchid-problems",0.2032,-9.2712],["tomato-problems",0.1956,-5.9689],["strawberry-pests",0.1914,-10.0886],["orchid-feed",0.1875,-9.9693],["dahlia-problems",0.1746,-10.3282],["strawberry-feed",0.1658,-9.5742],["cucumber-feed",0.1556,-9.7177],["lemon-problems",0.1544,-10.5037],["basil-pests",0.1541,-10.3146],["cucumber-winter",0.1514,-10.3552],["dahlia-pests",0.1503,-10.5078],["tomato-winter",0.1436,-10.9757],["strawberry-winter",0.1379,-10.6735],["tomato-pests",0.133,-10.6901],["cucumber-pests",0.1262,-10.5466],["orchid-pests",0.1114,-10.5836],["rose-problems",0.1091,-10.6261],["lemon-winter",0.0994,-10.9204],["rose-feed",0.097,-10.427],["orchid-winter",0.0946,-10.5476],["basil-feed",0.0908,-10.432],["basil-winter",0.0644,-10.4558],["rose-pests",0.0545,-11.0346],["lemon-pests",0.0203,-10.6421],["lemon-feed",-0.0163,-11.0204],["rose-winter",-0.017,-11.116]] },
    { q: "Should I cut the brown flower heads off my hydrangea before winter?", gold: "hydrangea-winter",
      bi: [["hydrangea-winter",0.7696,5.837],["hydrangea-problems",0.6045,-1.5993],["hydrangea-feed",0.4733,-6.3303],["dahlia-winter",0.4344,-5.6431],["hydrangea-water",0.4119,-6.0298],["hydrangea-pests",0.3762,-6.6832],["rose-winter",0.3592,-6.5003],["dahlia-water",0.3401,-9.6759],["orchid-winter",0.3338,-8.7051],["strawberry-winter",0.3027,-6.1899],["rose-water",0.3014,-11.083],["dahlia-feed",0.2937,-10.9119],["dahlia-pests",0.289,-11.0605],["basil-winter",0.2771,-10.3458],["dahlia-problems",0.2717,-10.9612],["strawberry-water",0.2699,-11.1842],["strawberry-feed",0.2558,-11.2077],["basil-water",0.2539,-11.177],["orchid-water",0.2463,-11.038],["tomato-winter",0.2335,-11.1473],["rose-feed",0.211,-11.0369],["basil-feed",0.2083,-10.2208],["rose-pests",0.207,-11.128],["cucumber-winter",0.2044,-8.249],["tomato-feed",0.2031,-10.8957],["lemon-winter",0.2029,-9.0046],["orchid-feed",0.1991,-10.9943],["strawberry-pests",0.1902,-11.0394],["rose-problems",0.1733,-10.8621],["lemon-water",0.1684,-10.8652],["basil-problems",0.1612,-11.1783],["strawberry-problems",0.158,-11.0094],["tomato-water",0.1424,-11.2704],["cucumber-water",0.1419,-11.2478],["orchid-problems",0.1325,-7.0694],["tomato-problems",0.1267,-8.1162],["orchid-pests",0.1198,-11.0414],["tomato-pests",0.098,-11.3205],["lemon-problems",0.0961,-11.2501],["basil-pests",0.09,-11.0918],["lemon-feed",0.0859,-10.8591],["cucumber-pests",0.0725,-11.2749],["cucumber-feed",0.0706,-11.3639],["lemon-pests",0.0226,-10.2357],["cucumber-problems",0.0225,-11.2359]] },
    { q: "Can I leave my dahlias in the ground over winter?", gold: "dahlia-winter",
      bi: [["dahlia-winter",0.737,3.1706],["dahlia-water",0.5816,-2.3878],["dahlia-problems",0.5006,-5.4583],["dahlia-pests",0.4895,-4.4755],["dahlia-feed",0.4695,-4.5195],["hydrangea-winter",0.4498,-5.1],["orchid-winter",0.4394,-6.6953],["basil-winter",0.3888,-10.1803],["tomato-winter",0.3068,-11.1894],["basil-water",0.3051,-11.0984],["cucumber-winter",0.3015,-10.3164],["strawberry-winter",0.2911,-9.1418],["rose-winter",0.2876,-10.0279],["rose-feed",0.2742,-11.1989],["tomato-pests",0.2539,-11.1758],["rose-water",0.2535,-10.9618],["orchid-water",0.2502,-11.0699],["lemon-winter",0.2481,-6.9305],["hydrangea-problems",0.2477,-10.8153],["orchid-feed",0.2466,-11.1551],["rose-pests",0.2368,-11.3279],["tomato-feed",0.2334,-11.2232],["strawberry-water",0.2247,-11.2368],["hydrangea-pests",0.2167,-11.2334],["strawberry-feed",0.2078,-11.2679],["tomato-water",0.2078,-11.2179],["strawberry-problems",0.1898,-11.1795],["tomato-problems",0.1769,-10.9956],["strawberry-pests",0.1767,-11.0569],["basil-feed",0.1715,-11.1821],["hydrangea-feed",0.1704,-11.0055],["lemon-water",0.169,-9.7951],["hydrangea-water",0.1671,-11.0775],["orchid-problems",0.1635,-11.145],["cucumber-water",0.1564,-11.171],["basil-pests",0.1536,-11.0691],["basil-problems",0.1427,-11.2754],["cucumber-pests",0.1383,-11.2436],["rose-problems",0.1372,-10.9806],["cucumber-problems",0.1192,-11.0048],["cucumber-feed",0.1122,-11.3341],["orchid-pests",0.0951,-11.2713],["lemon-feed",0.0432,-10.9561],["lemon-problems",0.0383,-11.0638],["lemon-pests",-0.0347,-11.179]] },
    { q: "Something is eating holes in my dahlia flowers overnight.", gold: "dahlia-pests",
      bi: [["dahlia-pests",0.7325,4.1456],["dahlia-problems",0.5904,-2.3703],["dahlia-winter",0.5591,-5.9011],["dahlia-feed",0.5555,-3.3198],["dahlia-water",0.5478,-5.3283],["orchid-feed",0.4012,-10.7407],["orchid-pests",0.3976,-10.9428],["tomato-pests",0.3746,-10.7751],["hydrangea-winter",0.362,-10.8661],["orchid-water",0.3618,-11.0608],["rose-pests",0.3541,-11.3043],["orchid-winter",0.3514,-10.9387],["rose-problems",0.3502,-11.1413],["basil-pests",0.3486,-10.9178],["tomato-feed",0.3428,-10.3432],["basil-water",0.3418,-11.1849],["strawberry-feed",0.3409,-9.9426],["hydrangea-pests",0.3406,-10.5472],["strawberry-water",0.3359,-10.9771],["rose-feed",0.3323,-10.9481],["tomato-problems",0.332,-11.0944],["hydrangea-problems",0.3243,-10.8826],["basil-feed",0.3156,-11.0761],["tomato-water",0.3151,-11.3151],["hydrangea-feed",0.3105,-10.9323],["rose-water",0.2986,-11.1006],["strawberry-pests",0.2933,-11.34],["strawberry-problems",0.2926,-11.3124],["orchid-problems",0.2847,-11.2506],["cucumber-pests",0.2717,-11.247],["basil-problems",0.2716,-11.3204],["cucumber-water",0.2624,-11.2067],["hydrangea-water",0.2354,-11.0015],["cucumber-problems",0.2336,-11.3646],["basil-winter",0.2222,-11.378],["tomato-winter",0.2017,-11.4348],["cucumber-feed",0.1999,-11.2757],["lemon-water",0.1949,-11.4143],["lemon-pests",0.1896,-11.2698],["cucumber-winter",0.1887,-11.3365],["strawberry-winter",0.1577,-11.38],["rose-winter",0.1486,-11.3569],["lemon-problems",0.1229,-11.3126],["lemon-feed",0.0969,-11.3603],["lemon-winter",0.0736,-11.4095]] },
    { q: "My strawberries are going furry and grey before I can pick them.", gold: "strawberry-problems",
      bi: [["strawberry-problems",0.6619,-1.2502],["strawberry-winter",0.6252,-5.6183],["strawberry-water",0.5777,-4.6362],["strawberry-pests",0.5609,-8.2812],["strawberry-feed",0.4281,-10.1819],["tomato-winter",0.3618,-10.8076],["cucumber-winter",0.308,-11.2815],["cucumber-water",0.2931,-11.2346],["cucumber-pests",0.2632,-11.2822],["cucumber-problems",0.2612,-11.2905],["dahlia-winter",0.2547,-11.0625],["cucumber-feed",0.2493,-11.2705],["dahlia-pests",0.241,-10.7359],["tomato-feed",0.2319,-11.2422],["dahlia-problems",0.2281,-11.175],["orchid-winter",0.2241,-11.3024],["hydrangea-winter",0.223,-11.184],["rose-pests",0.216,-11.3368],["tomato-pests",0.2139,-11.2898],["orchid-pests",0.2004,-11.0704],["orchid-water",0.2001,-11.2918],["tomato-problems",0.1965,-11.0613],["rose-feed",0.1843,-11.2977],["rose-water",0.1791,-11.3225],["rose-winter",0.1783,-11.2925],["dahlia-feed",0.1777,-11.225],["orchid-problems",0.1769,-11.2394],["orchid-feed",0.1627,-11.3095],["tomato-water",0.1624,-11.3084],["lemon-winter",0.1592,-11.2356],["dahlia-water",0.1553,-11.0527],["hydrangea-pests",0.1544,-11.3063],["hydrangea-feed",0.1521,-11.1426],["lemon-problems",0.12,-11.2892],["lemon-feed",0.1154,-11.3168],["basil-feed",0.1144,-10.2731],["rose-problems",0.1095,-11.182],["basil-water",0.1022,-11.3098],["hydrangea-problems",0.0978,-11.2999],["lemon-pests",0.0954,-11.1068],["basil-winter",0.0839,-11.3182],["lemon-water",0.078,-11.3311],["hydrangea-water",0.0777,-11.2638],["basil-pests",0.0569,-11.2033],["basil-problems",0.0532,-11.226]] },
    { q: "The basil from the supermarket keeps flopping over and the stems turn black.", gold: "basil-problems",
      bi: [["basil-problems",0.751,5.9883],["basil-feed",0.5371,-4.0063],["basil-water",0.52,-6.3156],["basil-pests",0.4887,-5.4941],["basil-winter",0.4666,-6.7801],["rose-problems",0.3403,-6.5387],["dahlia-winter",0.3003,-4.8209],["dahlia-pests",0.2711,-10.4357],["tomato-problems",0.261,-6.8553],["orchid-problems",0.2595,-9.9337],["tomato-water",0.2361,-10.0499],["hydrangea-pests",0.2299,-10.068],["orchid-water",0.2281,-9.8745],["lemon-pests",0.2241,-7.9544],["lemon-problems",0.2227,-9.6404],["cucumber-pests",0.2196,-9.4573],["dahlia-problems",0.2128,-10.542],["hydrangea-problems",0.2086,-8.707],["dahlia-feed",0.2075,-10.9747],["strawberry-problems",0.2044,-9.7086],["strawberry-pests",0.2009,-10.1599],["orchid-feed",0.1914,-10.1854],["orchid-pests",0.19,-10.2004],["hydrangea-winter",0.1782,-10.1502],["hydrangea-feed",0.178,-9.0352],["orchid-winter",0.1764,-10.6418],["strawberry-water",0.1762,-9.9621],["tomato-pests",0.1762,-10.542],["strawberry-feed",0.1752,-10.5515],["tomato-feed",0.172,-10.5443],["lemon-water",0.1699,-10.782],["tomato-winter",0.1587,-10.314],["rose-pests",0.1546,-10.9542],["dahlia-water",0.1436,-10.6333],["cucumber-winter",0.1419,-10.0427],["hydrangea-water",0.1262,-10.6107],["cucumber-water",0.117,-10.5236],["cucumber-feed",0.1144,-10.6704],["rose-feed",0.103,-10.9117],["strawberry-winter",0.1013,-10.4146],["lemon-winter",0.1012,-10.6369],["lemon-feed",0.0935,-10.7738],["rose-winter",0.0791,-9.7588],["rose-water",0.0766,-10.4145],["cucumber-problems",0.0524,-10.2585]] },
    { q: "Is it too cold to keep basil outside in October?", gold: "basil-winter",
      bi: [["basil-winter",0.7237,1.6115],["basil-problems",0.4417,-5.3179],["basil-water",0.4409,-3.8714],["orchid-winter",0.411,-7.0466],["basil-feed",0.4014,-9.0763],["basil-pests",0.3865,-4.8838],["dahlia-winter",0.375,-10.6226],["hydrangea-winter",0.3406,-10.9018],["lemon-winter",0.2933,-6.9596],["cucumber-winter",0.2689,-10.2072],["dahlia-water",0.2543,-11.2681],["dahlia-pests",0.2408,-11.3594],["tomato-winter",0.2293,-9.7963],["dahlia-feed",0.2093,-11.274],["tomato-pests",0.2088,-11.2914],["dahlia-problems",0.2079,-11.3528],["orchid-water",0.1943,-11.346],["orchid-feed",0.1879,-11.3538],["hydrangea-problems",0.1851,-10.5918],["hydrangea-water",0.1689,-11.2197],["cucumber-pests",0.1515,-11.3242],["rose-pests",0.1501,-11.3742],["rose-winter",0.1336,-11.2564],["tomato-feed",0.1323,-11.333],["lemon-feed",0.1278,-11.0341],["orchid-problems",0.1269,-11.2966],["rose-water",0.1263,-11.3146],["hydrangea-pests",0.1214,-11.3712],["lemon-water",0.1196,-11.293],["rose-feed",0.1136,-11.3484],["strawberry-winter",0.1134,-11.1925],["hydrangea-feed",0.1077,-11.322],["tomato-water",0.103,-11.3286],["strawberry-feed",0.0919,-11.3787],["lemon-problems",0.0911,-10.444],["orchid-pests",0.085,-11.3656],["tomato-problems",0.0756,-11.0912],["cucumber-water",0.0746,-11.0384],["strawberry-problems",0.0729,-11.0702],["rose-problems",0.0669,-11.2198],["strawberry-water",0.0582,-11.3229],["strawberry-pests",0.0023,-11.3267],["cucumber-problems",-0.0114,-11.2917],["lemon-pests",-0.0122,-11.3071],["cucumber-feed",-0.0162,-11.3972]] },
    { q: "My cucumbers taste bitter. Why?", gold: "cucumber-water",
      bi: [["cucumber-water",0.7116,3.3903],["cucumber-pests",0.5209,-8.0647],["cucumber-problems",0.5134,-5.4767],["cucumber-feed",0.483,-7.932],["cucumber-winter",0.4421,-7.513],["strawberry-pests",0.3083,-11.3245],["hydrangea-pests",0.2745,-11.3172],["strawberry-water",0.2524,-11.2498],["strawberry-feed",0.2449,-11.2976],["strawberry-problems",0.2357,-11.3202],["lemon-pests",0.2212,-11.2395],["tomato-feed",0.2052,-11.2727],["dahlia-problems",0.1912,-11.3136],["orchid-pests",0.1858,-11.2117],["strawberry-winter",0.1809,-11.2959],["tomato-winter",0.1796,-11.2984],["lemon-problems",0.1784,-11.244],["tomato-pests",0.1756,-11.268],["lemon-water",0.1716,-11.2479],["tomato-water",0.167,-11.2492],["lemon-feed",0.1647,-11.2653],["dahlia-pests",0.1604,-11.318],["lemon-winter",0.1602,-11.2899],["rose-pests",0.1591,-11.3021],["basil-problems",0.1567,-11.2481],["dahlia-feed",0.1513,-11.2685],["rose-water",0.1346,-11.2782],["orchid-water",0.1294,-11.233],["orchid-problems",0.1269,-11.215],["tomato-problems",0.1261,-11.2577],["hydrangea-water",0.125,-11.2322],["rose-problems",0.121,-11.1993],["orchid-feed",0.1171,-11.27],["dahlia-water",0.1149,-11.2907],["basil-feed",0.1139,-11.2555],["hydrangea-feed",0.1115,-11.225],["dahlia-winter",0.1047,-11.2542],["rose-feed",0.0959,-11.2478],["basil-pests",0.0899,-11.2992],["hydrangea-problems",0.0724,-11.325],["basil-water",0.0712,-11.2337],["rose-winter",0.0624,-11.1991],["hydrangea-winter",0.0594,-11.2348],["basil-winter",0.0394,-11.2825],["orchid-winter",0.0326,-11.1995]] },
    { q: "The cucumber leaves are pale and speckled and there are tiny webs.", gold: "cucumber-pests",
      bi: [["cucumber-pests",0.7052,4.8499],["cucumber-water",0.6018,-7.9408],["cucumber-winter",0.5705,-6.7316],["cucumber-problems",0.5631,-4.6299],["cucumber-feed",0.4923,-7.8391],["lemon-pests",0.3485,-10.7451],["strawberry-pests",0.3253,-11.3266],["orchid-pests",0.3147,-10.9878],["tomato-pests",0.3049,-11.1119],["strawberry-water",0.2745,-11.266],["basil-pests",0.2686,-11.0727],["rose-pests",0.2602,-11.3436],["strawberry-feed",0.2447,-11.3228],["tomato-winter",0.2414,-11.3262],["dahlia-winter",0.2399,-11.0111],["basil-feed",0.2392,-11.1452],["dahlia-feed",0.2385,-11.314],["tomato-feed",0.235,-11.3139],["hydrangea-pests",0.2348,-11.2936],["strawberry-winter",0.2286,-11.2542],["dahlia-pests",0.2197,-11.3091],["strawberry-problems",0.2194,-11.2951],["orchid-water",0.214,-11.1646],["rose-problems",0.202,-10.5205],["basil-water",0.1987,-11.3024],["orchid-feed",0.1965,-11.2454],["orchid-problems",0.1951,-10.7212],["lemon-feed",0.1951,-11.2455],["tomato-problems",0.1928,-10.7653],["lemon-water",0.1804,-11.3377],["lemon-problems",0.177,-11.2153],["tomato-water",0.1741,-11.3318],["dahlia-problems",0.1736,-11.3358],["lemon-winter",0.1689,-11.3232],["dahlia-water",0.1687,-11.3052],["hydrangea-feed",0.1533,-11.1828],["hydrangea-winter",0.1418,-11.2567],["basil-winter",0.1397,-11.2015],["basil-problems",0.1309,-11.2083],["rose-winter",0.1269,-11.3124],["hydrangea-problems",0.1227,-11.2649],["orchid-winter",0.1219,-11.2836],["rose-feed",0.1213,-11.324],["rose-water",0.1094,-11.3295],["hydrangea-water",0.0509,-11.2298]] },
  ];
  // From docs/ai-path/runs/s5a-rerankers/timing.out.txt (median of 15 runs, Apple M1 CPU, other jobs running)
  const T_RETRIEVE = 3.1;
  const T_RERANK = { 5: 37.6, 10: 79.4, 20: 134.1, 40: 312.2 };
  // From docs/ai-path/runs/s5a-rerankers/truncation.out.txt: whole sheets, [plant, score, tokens in the pair, tokens kept]
  const TRUNC_Q = "A customer brought in a leaf with dark blotches. The leaves turn yellow and drop from midsummer. What is it?";
  const TRUNC = {
    128: { ms: 169.6, ranked: [["lemon", -7.8567, 215, 128], ["dahlia", -8.7932, 200, 128], ["cucumber", -9.2369, 190, 128], ["orchid", -9.6109, 193, 128], ["hydrangea", -9.8018, 220, 128], ["strawberry", -10.0939, 166, 128], ["basil", -10.1603, 173, 128], ["rose", -10.5658, 190, 128], ["tomato", -10.6911, 202, 128]],
           tail: "ers. mulch with well - rotted manure. rose : pests. greenfly cluster on soft shoot tips and flower buds in spring. squash small groups by hand and encourage ladybirds. rose : winter and pruning. prune" },
    512: { ms: 301.4, ranked: [["rose", -0.7098, 190, 190], ["lemon", -5.1603, 215, 215], ["dahlia", -8.185, 200, 200], ["tomato", -8.4107, 202, 202], ["cucumber", -8.5456, 190, 190], ["orchid", -8.6149, 193, 193], ["basil", -9.247, 173, 173], ["hydrangea", -9.4976, 220, 220], ["strawberry", -10.1614, 166, 166]] }
  };

  /* ---------- Derived from the data ---------- */
  const title = id => CHUNKS[id].split(". ")[0];          // "Moth orchid: pests"
  const body = id => CHUNKS[id].slice(title(id).length + 2); // the text after the title
  const goldRank = r => r.bi.findIndex(x => x[0] === r.gold) + 1;
  const ceOrder = (r, k) => r.bi.slice(0, k).slice().sort((a, b) => b[2] - a[2]); // rerank the top k
  const firstAfter = (r, k) => ceOrder(r, k)[0][0] === r.gold;
  const KEEP = 3; // chunks that go into the answer (the story)
  const rankAfter = (r, k) => ceOrder(r, k).findIndex(x => x[0] === r.gold) + 1; // 0 = not among the k
  const inKeepAfter = (r, k) => { const n = rankAfter(r, k); return n > 0 && n <= KEEP; };
  const NQ = RUN.length;
  const countIf = f => RUN.filter(f).length;
  const NCH = Object.keys(CHUNKS).length;
  const BI_FIRST = countIf(r => goldRank(r) === 1);
  const byQ = text => RUN.find(r => r.q.startsWith(text));
  const ORCHID = byQ("There is white fluffy stuff");
  const HYDR = byQ("My potted hydrangea wilted");
  const TOMATO = byQ("Customer says her greenhouse tomatoes");
  const TOP10 = ORCHID.bi.slice(0, 10);
  const SHOWN = TOP10.map(x => x[0]).slice().sort();            // screen 1 shows them sorted by name, not by score
  const ORCHID_BI = goldRank(ORCHID), ORCHID_CE = ceOrder(ORCHID, 10).findIndex(x => x[0] === ORCHID.gold) + 1;
  const KS = Object.keys(T_RERANK).map(Number);
  const BUDGET = 100; // ms the shop allows for the reranking step (the story's budget)
  const K_BEST = Math.max(...KS.filter(k => T_RERANK[k] <= BUDGET));

  function ensureStyle() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
      .${P}-q { margin: 14px 0 0; padding: 12px 14px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--surface); font-weight: 600; }
      .${P}-q small { display: block; font: 600 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 4px; }
      .${P}-chunks.lopts button { width: 100%; font-weight: 500; font-size: 16px; }
      .${P}-chunks.lopts button b { font-weight: 700; }
      .${P}-t { width: 100%; border-collapse: collapse; margin-top: 16px; font: 500 14px var(--mono); }
      .${P}-t caption { text-align: left; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; padding-bottom: 6px; }
      .${P}-t th { text-align: left; font: 600 13px var(--font); color: var(--muted); padding: 4px 6px 6px; border-bottom: 2px solid var(--ink); vertical-align: bottom; }
      .${P}-t td { padding: 7px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .${P}-t td.n, .${P}-t th.n { text-align: right; } .${P}-t td.n { white-space: nowrap; }
      .${P}-t td.c { font-family: var(--font); font-size: 15px; overflow-wrap: anywhere; }
      .${P}-t tr.hit td { background: var(--good-soft); color: var(--good); font-weight: 700; }
      .${P}-t tr.no td { background: var(--bad-soft); color: var(--bad); font-weight: 700; }
      .${P}-dia { display: grid; gap: 14px; margin-top: 16px; }
      .${P}-dia h3 { margin: 0 0 6px; font: 700 13px var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
      .${P}-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 15px; }
      .${P}-flow span { border: 1.5px solid var(--ink); border-radius: 8px; padding: 6px 10px; background: var(--bg); }
      .${P}-flow span.m { background: var(--sunk); font-weight: 700; }
      .${P}-flow span.o { border-style: dashed; }
      .${P}-flow i { font-style: normal; color: var(--muted); }
      .${P}-flow + .${P}-flow { margin-top: 6px; }
      .${P}-code { margin: 18px 0 0; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); padding: 8px 0; }
      .${P}-code div { padding: 2px 12px 2px 28px; text-indent: -16px; font: 500 14px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; font-variant-ligatures: none; }
      .${P}-out { margin-top: 6px; }
      .${P}-tail { margin-top: 10px; padding: 10px 12px; background: var(--sunk); border-radius: 8px; font: 500 14px/1.5 var(--mono); overflow-wrap: anywhere; }
      .${P}-checks.lopts button { width: 100%; display: flex; gap: 12px; align-items: flex-start; font-weight: 500; }
      .${P}-box { flex: 0 0 auto; width: 20px; height: 20px; margin-top: 2px; border: 2px solid currentColor; border-radius: 4px; }
      .${P}-checks button[aria-pressed="true"] .${P}-box { background: currentColor; }
      .${P}-docs { margin: 8px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; font-size: 15px; color: var(--muted); }
      .${P}-docs a { display: inline-flex; align-items: center; min-height: 44px; }
      .${P}-cap { font-size: 14px; color: var(--muted); margin: 8px 0 0; }
      .${P}-nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  const qBox = (label, text, kit) => `<div class="${P}-q"><small>${kit.esc(label)}</small>${kit.esc(text)}</div>`;
  const chunkHtml = (id, kit) => `<b>${kit.esc(title(id))}.</b> ${kit.esc(body(id))}`;

  /* 1. By hand: which of the ten chunks the search returned answers the question? */
  const S1_WRONG = {
    "orchid-feed": "This chunk is about feeding. It shares \"orchid\" and \"leaves\" with the question, but nothing in it explains white fluff in the leaf joints.",
    "orchid-problems": "Close, but this is about rotten roots: wrinkled leaves and mushy brown roots. The question is about something white and fluffy where leaves meet the stem.",
    "orchid-water": "This tells you when to water. It shares the plant's name, but it does not say what the white fluff is or what to do about it.",
    "orchid-winter": "This is about warmth at night and starting a flower spike. Nothing white or fluffy in it.",
    "strawberry-water": "This mentions grey mould, which can look fluffy, but it is about strawberry fruit, not orchid leaf joints."
  };
  function byHand({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const correct = SHOWN.indexOf(ORCHID.gold);
    const paint = () => {
      const ok = pick === correct, id = pick == null ? null : SHOWN[pick];
      el.innerHTML = `<h1>The plant-care assistant</h1>
        <p class="lead">A garden centre gives its staff a search assistant. A customer asks something, a staff member types it in, and the assistant finds the right section of the centre's plant-care sheets. Each sheet is split into sections (watering, feeding, pests, winter, problems), and each section is one chunk: ${WORDS[Object.keys(CHUNKS).length / 5] || Object.keys(CHUNKS).length / 5} plants, ${Object.keys(CHUNKS).length} chunks. Only the top three chunks go into the prompt that the language model answers from. This is the retrieval step of a RAG app, and this lesson makes it pick better. Staff complain that it often shows the wrong section of the right plant.</p>
        ${qBox("Question typed at the till", ORCHID.q, kit)}
        <p class="task">The search returned these ${TOP10.length} chunks, listed here by name, not by score. Read them like a staff member would. Tap the one chunk that answers the question.</p>
        <div class="${P}-chunks">${kit.options(SHOWN.map(c => chunkHtml(c, kit)), { picked: pick, correct })}</div>
        <div class="lpanel">${pick == null ? "" : ok
          ? kit.feedback(`Right. The question says "white fluffy stuff where the leaves meet the stem"; the chunk says "white cotton wool in the leaf joints". Almost no words in common, the same meaning. You found it because you read the question and each chunk together. Keep that in mind.`, true)
          : kit.feedback(kit.esc(S1_WRONG[id] || `"${title(id)}" is about ${title(id).split(":")[0].toLowerCase()}, not orchids. It came back because it is about the same kind of topic (${title(id).split(": ")[1]}), not because it answers the question.`), false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 2. Predict where the search ranked that chunk, then see both rankings. */
  function compare({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const opts = [...new Set([1, 2, ORCHID_BI, TOP10.length])].sort((a, b) => a - b);
    const correct = opts.indexOf(ORCHID_BI);
    const ce = ceOrder(ORCHID, TOP10.length).map(x => x[0]);
    const say = n => n === 1 ? `If the search had put it first, staff would see the right answer and nobody would complain. The search put "${title(TOP10[0][0])}" first.`
      : n < ORCHID_BI ? `Second is "${title(TOP10[1][0])}". The answer is further down.`
      : `Higher than that. Look at the ${TOP10.length} chunks again: the ones that share the plant's name crowd the top of the list.`;
    const paint = () => {
      const ok = pick === correct;
      el.innerHTML = `<h1>Where did the search put it?</h1>
        <p class="lead">The search works by giving every chunk a similarity score with the question and sorting by it. Only the top three chunks reach the answer.</p>
        ${qBox("Same question", ORCHID.q, kit)}
        <p class="task">Predict: in the search's own order, where was "${kit.esc(title(ORCHID.gold))}", the chunk you picked?</p>
        <div class="lpanel">${kit.options(opts.map(ORD), { picked: pick, correct, num: true })}
        ${pick == null ? "" : ok ? kit.feedback(`Right, ${ORD(ORCHID_BI)}. ${WORDS[ORCHID_BI - 1][0].toUpperCase() + WORDS[ORCHID_BI - 1].slice(1)} other ${TOP10.slice(0, ORCHID_BI - 1).every(x => x[0].startsWith("orchid")) ? "orchid " : ""}chunks scored higher, so the answer never reached the top three. Then a second model, a <b>reranker</b>, read the question and each of the ${TOP10.length} chunks together and gave each pair a new score. It put your chunk ${ORD(ORCHID_CE)}.`, true)
          : kit.feedback(say(opts[pick]), false)}
        ${ok ? `<table class="${P}-t"><caption>the same ${TOP10.length} chunks, two orders</caption>
          <thead><tr><th>chunk</th><th class="n">search<br>place · score</th><th class="n">reranker<br>place · score</th></tr></thead>
          <tbody>${TOP10.map(([id, cos, s], i) => `<tr class="${id === ORCHID.gold ? "hit" : ""}"><td class="c">${kit.esc(title(id))}</td><td class="n">${i + 1} · ${cos.toFixed(2)}</td><td class="n">${ce.indexOf(id) + 1} · ${f2(s)}</td></tr>`).join("")}</tbody></table>
          ${kit.feedback(`The two scores are on different scales: the search score is a cosine between −1 and 1, the reranker's is a raw score with no fixed range. Here every reranker score is below zero, yet its order is right. Compare scores only within one question, and only by order.`)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: why the search ranked a feeding chunk above the answer. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const top = title(TOP10[0][0]);
    const opts = [
      "The search model is broken or too small to be useful",
      "The reranker sees the question and the chunk together; the search compared two vectors made separately",
      "The reranker was trained on gardening text, so it knows more facts about orchids"
    ];
    const correct = 1;
    const paint = () => {
      const ok = pick === correct;
      el.innerHTML = `<h1>Why did the search miss?</h1>
        <p class="lead">The search put "${kit.esc(top)}" first and the answer ${ORD(ORCHID_BI)}. The reranker fixed the order. Both are small models of about the same size.</p>
        <p class="task">What does the reranker have that the search did not?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: pick, correct })}
        ${pick == null ? "" : ok ? kit.feedback(`Right. The search model is a <b>bi-encoder</b>: it turns the question into one vector and each chunk into another, separately, and compares the vectors. The chunk vectors are made once, ahead of time. That is why searching is fast. But one vector must sum up a whole chunk, and each orchid chunk's vector mostly says "orchid care". So they all look close to an orchid question. A <b>cross-encoder</b> (the reranker) gets the question and the chunk as one input. Attention can then link words across the two, the way an encoder like BERT reads a sentence pair. It gives back one score per pair, and no vector to store.`, true)
          : pick === 0 ? kit.feedback(`On the other ${NQ - 1} test questions the same search put the right chunk first ${BI_FIRST} times. It is not broken: it is blind to the details that tell same-plant chunks apart.`, false)
          : kit.feedback(`This reranker was trained on web search queries and passages (the MS MARCO data set), not on gardening. It does not look facts up. It judges how well this passage answers this question, and it can only do that because it sees both at once.`, false)}
        ${ok ? `<div class="${P}-dia">
          <div><h3>Bi-encoder (the search)</h3>
            <div class="${P}-flow"><span class="o">chunk</span><i>→</i><span class="m">model</span><i>→</i><span>vector</span><i>made once, stored</i></div>
            <div class="${P}-flow"><span class="o">question</span><i>→</i><span class="m">model</span><i>→</i><span>vector</span><i>→ compare → score</i></div></div>
          <div><h3>Cross-encoder (the reranker)</h3>
            <div class="${P}-flow"><span class="o">question + chunk</span><i>→</i><span class="m">model</span><i>→</i><span>score</span><i>once per pair, at question time</i></div></div>
        </div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 4. Use it: predict the reranker's first pick on two more recorded questions. */
  function predict({ el, done, kit }) {
    ensureStyle();
    const CASES = [
      { r: HYDR, n: 3, why: { win: "It reads \"stays wilted even though the compost is wet\" against \"wilts and does not recover even after watering\". The watering chunk says the opposite: that kind of wilt recovers by evening." } },
      { r: TOMATO, n: 4 }
    ];
    let step = 0, pick = null;
    const paint = () => {
      const fin = step >= CASES.length;
      const c = CASES[Math.min(step, CASES.length - 1)], r = c.r;
      const shown = r.bi.slice(0, c.n), ranked = ceOrder(r, c.n), win = ranked[0][0];
      const opts = shown.map(x => title(x[0])), correct = shown.findIndex(x => x[0] === win);
      const winsGold = win === r.gold;
      const fullCE = ceOrder(r, r.bi.length).findIndex(x => x[0] === r.gold) + 1;
      const after10 = countIf(q => firstAfter(q, 10));
      const fixed = countIf(q => goldRank(q) > 1 && firstAfter(q, 10)), missed = WORDS[NQ - after10];
      const keepBi = countIf(q => goldRank(q) <= KEEP), keepAfter = countIf(q => inKeepAfter(q, 10));
      const movedIn = RUN.filter(q => goldRank(q) > KEEP && inKeepAfter(q, 10)), pushedOut = RUN.filter(q => goldRank(q) <= KEEP && !inKeepAfter(q, 10));
      const plant = q => title(q.gold).split(":")[0].toLowerCase();
      const names = qs => qs.map(plant).join(" and ");
      const right = c === CASES[0]
        ? `Right: "${title(win)}", ${f2(ranked[0][2])} against ${f2(ranked[1][2])} for "${title(ranked[1][0])}". ${c.why.win} The search had it ${ORD(goldRank(r))}.`
        : `Right, and this time the reranker is wrong: "${title(win)}" (${f2(ranked[0][2])}) beats the watering chunk, which says split fruit comes from uneven watering (${f2(r.bi.find(x => x[0] === r.gold)[2])}). Over all ${r.bi.length} chunks the reranker puts the answer ${ORD(fullCE)}. It did not connect "cracking open" with "split", and every score is far below zero: it found nothing it was sure of. The search had the answer ${ORD(goldRank(r))}.`;
      const wrong = i => {
        const id = shown[i][0];
        if (c === CASES[0]) return `The reranker scored "${title(id)}" ${f2(shown[i][2])}, and another chunk scored higher. Read the question again: the plant stays wilted although the compost is wet. Which chunk describes exactly that?`;
        return id === r.gold ? `That is the chunk that answers, and you would rank it first. The reranker did not: it scored it ${f2(shown[i][2])}. Predict what the model did, not what it should do.` : `The reranker scored "${title(id)}" ${f2(shown[i][2])}. Another chunk scored higher.`;
      };
      el.innerHTML = `<h1>Predict the reranker</h1>
        <p class="lead">${fin ? `Over all ${NQ} test questions, the search put the right chunk first ${BI_FIRST} times. After reranking its top 10, the right chunk is first ${after10} times. The reranker fixed ${WORDS[fixed]} question${fixed === 1 ? "" : "s"} the search got wrong and missed ${missed}: it is a better judge, not a perfect one.</p>
        <p class="lead">But the assistant uses the top ${WORDS[KEEP]}, not only the first. On that measure it is ${keepBi} / ${NQ} before and ${keepAfter} / ${NQ} after: the reranker moved the ${names(movedIn)} answer${movedIn.length === 1 ? "" : "s"} into the top ${WORDS[KEEP]} and pushed the ${names(pushedOut)} answer${pushedOut.length === 1 ? "" : "s"} out. Measure on your own questions before you ship.` : `Two more questions from the same run. The search's top ${c.n} are listed in its order. The reranker scored each pair.`}</p>
        ${fin ? "" : qBox(`Question ${step + 1} of ${CASES.length}`, r.q, kit)}
        ${fin ? "" : `<p class="task">Which chunk did the reranker put first?</p>`}
        <div class="lpanel">${fin ? "" : `<div class="${P}-chunks">${kit.options(shown.map((x, i) => `${i + 1}. ${chunkHtml(x[0], kit)}`), { picked: pick, correct })}</div>`}
        ${pick == null ? "" : pick === correct ? kit.feedback(right, true) : kit.feedback(kit.esc(wrong(pick)), false)}
        ${!fin && pick === correct ? `<div class="lsteps"><button type="button" class="btn" data-next>${step + 1 < CASES.length ? "Next question" : "See all questions"}</button></div>` : ""}
        ${fin ? `<table class="${P}-t"><thead><tr><th>right chunk</th><th class="n">search alone</th><th class="n">rerank top 10</th></tr></thead><tbody>
          <tr><td class="c">first</td><td class="n">${BI_FIRST} / ${NQ}</td><td class="n">${after10} / ${NQ}</td></tr>
          <tr><td class="c">in the top ${WORDS[KEEP]}</td><td class="n">${keepBi} / ${NQ}</td><td class="n">${keepAfter} / ${NQ}</td></tr></tbody></table>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); });
      const nx = el.querySelector("[data-next]");
      if (nx) nx.onclick = () => { step++; pick = null; paint(); if (step >= CASES.length) done(); };
    };
    paint();
  }

  /* 5. The cost: one model run per candidate. Pick k for the time budget. */
  function chooseK({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const inTop = k => countIf(r => goldRank(r) <= k);
    const keepAfter = k => countIf(r => inKeepAfter(r, k));
    const maxRank = Math.max(...RUN.map(goldRank));
    const perPair = T_RERANK[10] / 10;
    // Two defensible answers: every k that fits the budget and has every test answer among its candidates.
    const OK_KS = KS.filter(k => T_RERANK[k] <= BUDGET && inTop(k) === NQ);
    const K_LOW = Math.min(...OK_KS);
    const isOk = i => i != null && OK_KS.includes(KS[i]);
    const wrongI = KS.findIndex(k => !OK_KS.includes(k));
    // Local copy of the kit's answer buttons, so that two answers can count as right.
    const buttons = () => `<div class="lopts">${KS.map((k, i) => `<button type="button" class="num${pick === i ? (isOk(i) ? " right" : " wrong") : ""}" data-i="${i}"${k === K_BEST ? " data-right" : ""}${i === wrongI ? " data-wrong" : ""}${pick === i ? ' aria-pressed="true"' : ""}>${k}</button>`).join("")}</div>`;
    const tail = `That is about ${perPair.toFixed(0)} ms per pair on this laptop, against ${T_RETRIEVE} ms for the whole search. A GPU makes each pair faster, but the rule stays: the reranker's time grows with k, the search's barely grows with the size of the shop.`;
    const say = k => T_RERANK[k] > BUDGET
      ? `Reranking ${k} took ${T_RERANK[k]} ms, over the ${BUDGET} ms budget. Every candidate is one more full run of the model, so the time grows with k. Staff would wait on every question.`
      : `${k} fits (${T_RERANK[k]} ms) but misses answers: only ${inTop(k)} of ${NQ} right chunks are among the candidates, and the reranker cannot rank a chunk it never sees.`;
    const right = k => k === K_LOW
      ? `A fair pick: k = ${k}, ${T_RERANK[k]} ms, with the most time to spare. On these ${NQ} questions it even puts the right chunk in the top ${WORDS[KEEP]} ${keepAfter(k)} times, against ${keepAfter(K_BEST)} for k = ${K_BEST}. The risk: the lowest answer sat exactly ${ORD(maxRank)}, so there is no margin. A new question whose answer the search puts ${ORD(maxRank + 1)} is lost. k = ${K_BEST} buys that margin at about twice the time. ${tail}`
      : `A fair pick: k = ${k}, ${T_RERANK[k]} ms, the most candidates that fit. It leaves room for answers the search ranks lower than in these tests (the lowest sat ${ORD(maxRank)}). The price: about twice the time of k = ${K_LOW}, close to the budget on a busy CPU, and on these ${NQ} questions it does ${keepAfter(k) < keepAfter(K_LOW) ? "slightly worse" : keepAfter(k) > keepAfter(K_LOW) ? "better" : "no better"}: ${keepAfter(k)} in the top ${WORDS[KEEP]} against ${keepAfter(K_LOW)}. ${tail}`;
    const paint = () => {
      const ok = isOk(pick);
      el.innerHTML = `<h1>How many candidates to rerank?</h1>
        <p class="lead">The reranker runs once per question-and-chunk pair, and nothing can be prepared ahead of time. At about ${perPair.toFixed(0)} ms a pair, reading all ${NCH} chunks would take about ${Math.round(perPair * NCH)} ms on every question, and a real shop has thousands of chunks. So the search first picks <b>k</b> candidates, fast (k is just how many), and the reranker reorders only those. We timed both on a laptop CPU (median of 15 runs, while other jobs kept the CPU busy). The search step took ${T_RETRIEVE} ms.</p>
        <table class="${P}-t"><thead><tr><th class="n">k</th><th class="n">rerank time</th><th class="n">right chunk among the k</th><th class="n">in top ${WORDS[KEEP]} after rerank</th></tr></thead>
          <tbody>${KS.map((k, i) => `<tr class="${pick === i ? (ok ? "hit" : "no") : ""}"><td class="n">${k}</td><td class="n">${T_RERANK[k]} ms</td><td class="n">${inTop(k)} / ${NQ}</td><td class="n">${keepAfter(k)} / ${NQ}</td></tr>`).join("")}</tbody></table>
        <p class="task">The shop allows <b>${BUDGET} ms</b> for reranking and wants the right chunk in the top ${WORDS[KEEP]}, also for new questions. Pick k for the assistant.</p>
        <div class="lpanel">${buttons()}
        ${pick == null ? "" : ok ? kit.feedback(`${right(KS[pick])} Either k is defensible; decide with more of your own questions.`, true)
          : kit.feedback(say(KS[pick]), false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (isOk(pick)) done(); });
    };
    paint();
  }

  /* 6. The real library: sentence-transformers on PyTorch, run on the orchid question. Predict what comes back. */
  // docs/ai-path/runs/s5a-rerankers/library.py, lines 13-23: the code shown, line for line
  const CODE = [
    "from sentence_transformers import SentenceTransformer, CrossEncoder",
    "search = SentenceTransformer(\"sentence-transformers/all-MiniLM-L6-v2\")",
    "reranker = CrossEncoder(\"cross-encoder/ms-marco-MiniLM-L6-v2\")",
    "chunk_vectors = search.encode(care_chunks)",
    "def find_chunks(question, k=10, keep=3):",
    "    question_vector = search.encode([question])",
    "    scores = search.similarity(question_vector, chunk_vectors)[0]",
    "    top_k = scores.argsort(descending=True)[:k].tolist()",
    "    candidates = [care_chunks[i] for i in top_k]",
    "    hits = reranker.rank(question, candidates, top_k=keep, return_documents=True)",
    "    return [hit[\"text\"] for hit in hits]"
  ];
  // docs/ai-path/runs/s5a-rerankers/library.out.txt, lines 7-10 and 22-29, copied exactly (lines 1-5 are library
  // log lines; lines 11-21, the search's top 10, match RUN's orchid entry to four decimals and are not repeated here)
  const LIB_OUT = [
    "find_chunks(question) returned:",
    "  Moth orchid: pests. Mealybugs look like bits of white cotton ...",
    "  Moth orchid: problems. Wrinkled, limp leaves with mushy brow ...",
    "  Dahlia: winter. After the first frost blackens the leaves, c ...",
    "reranker.rank(question, candidates, top_k=3):",
    "  {'corpus_id': 4, 'score': -3.9305} -> orchid-pests",
    "  {'corpus_id': 1, 'score': -5.3682} -> orchid-problems",
    "  {'corpus_id': 8, 'score': -8.0354} -> dahlia-winter",
    "all 10 reranker scores, in the search's order:",
    "  [[\"orchid-feed\", -8.7559], [\"orchid-problems\", -5.3682], [\"orchid-water\", -8.8639], [\"orchid-winter\", -9.3886], [\"orchid-pests\", -3.9305], [\"strawberry-water\", -10.9376], [\"strawberry-pests\", -11.3217], [\"strawberry-feed\", -11.2887], [\"dahlia-winter\", -8.0354], [\"hydrangea-winter\", -10.3807]]",
    "model card example pairs: [ 8.607139  -4.3200784]",
    "reranker activation: Identity() max_length: 512"
  ];
  // docs/ai-path/runs/s5a-rerankers/compare.out.txt: all 20 questions x 45 chunks, library against the ONNX run
  const CMP = { pairs: 20 * 45, maxCeDiff: 5.7e-05 };
  // Parsed from LIB_OUT, so every number on the screen comes from the run's own lines
  const LIB_HITS = LIB_OUT.map(l => l.match(/\{'corpus_id': (\d+), 'score': (-?[\d.]+)\} -> (\S+)/)).filter(Boolean)
    .map(m => ({ corpus_id: +m[1], score: +m[2], id: m[3] }));
  const LIB_ALL = JSON.parse(LIB_OUT[LIB_OUT.findIndex(l => l.startsWith("all 10 reranker")) + 1].trim());
  const LIB_MAXLEN = +LIB_OUT.find(l => l.includes("max_length:")).match(/max_length: (\d+)/)[1];
  const LIB_SHOW = LIB_OUT.filter(l => !l.startsWith("all 10") && !l.startsWith("  [[") && !l.startsWith("model card"));
  function library({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const ids = LIB_HITS.map(h => h.id);
    const score = id => LIB_ALL.find(x => x[0] === id)[1];
    const searchTop = LIB_ALL.slice(0, ids.length).map(x => x[0]);
    const orchidOnly = LIB_ALL.filter(x => x[0].startsWith("orchid")).slice().sort((a, b) => b[1] - a[1]).slice(0, ids.length).map(x => x[0]);
    const third = ids[ids.length - 1], orchidThird = orchidOnly[orchidOnly.length - 1];
    const opts = [searchTop, [ids[0]], ids, orchidOnly];
    const correct = 2;
    const names = list => list.map(id => title(id)).join(", ");
    const WRONG = [
      `That is the search's own top ${WORDS[ids.length]}, before reranking. <code>find_chunks</code> returns what <code>reranker.rank</code> sends back, and the reranker reorders the ${LIB_ALL.length} candidates by its own scores.`,
      `<code>rank</code> does not drop a chunk for a low score. <code>top_k=keep</code> asks for ${WORDS[ids.length]} chunks, and ${WORDS[ids.length]} come back, whatever they scored. Below zero is normal for this model.`,
      "",
      `The reranker does not know which chunks belong to the same plant: it scores each pair on its own. "${kit.esc(title(orchidThird))}" scored ${f2(score(orchidThird))}, and one chunk from another plant scored higher.`
    ];
    const paint = () => {
      const ok = pick === correct;
      el.innerHTML = `<h1>The same pipeline in sentence-transformers</h1>
        <p class="lead">The two models from the earlier screens, loaded with the sentence-transformers library (it runs them on PyTorch). <code>k</code> is how many candidates the search hands on; <code>keep</code> becomes <code>top_k</code> in <code>rank</code>, how many reranked chunks come back for the answer. We ran this on our laptop's CPU with the ${Object.keys(CHUNKS).length} care chunks and the orchid question from the first screen.</p>
        ${qBox("question", ORCHID.q, kit)}
        <div class="${P}-code">${CODE.map(c => `<div>${kit.esc(c)}</div>`).join("")}</div>
        <p class="task">Predict: what does <code>find_chunks(question)</code> return, in order?</p>
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(names(o))), { picked: pick, correct })}
        ${pick == null ? "" : ok
          ? kit.feedback(`Right. The answer is first, and the third is "${kit.esc(title(third))}", a chunk about another plant that scored ${f2(LIB_HITS[LIB_HITS.length - 1].score)}. <code>rank</code> always returns <code>top_k</code> chunks; it has no idea which ones are good enough. If weak chunks must stay out of the answer, you need a cut-off score of your own, chosen on your own questions.`, true)
          : kit.feedback(WRONG[pick], false)}
        ${ok ? `<p class="${P}-cap">What the script printed (library.py, run 2026-11-14; library log lines left out):</p>
          <div class="${P}-code ${P}-out">${LIB_SHOW.map(l => `<div>${kit.esc(l)}</div>`).join("")}</div>
          ${kit.feedback(`<code>corpus_id</code> is the place in <code>candidates</code>, counted from 0: the answer was candidate ${LIB_HITS[0].corpus_id}, the search's ${ORD(LIB_HITS[0].corpus_id + 1)}. The scores are the same as on the second screen. Those came from the models' official ONNX exports (the same models saved in a format that another runtime can run): across all ${CMP.pairs} question-and-chunk pairs the two runs differ by at most ${CMP.maxCeDiff.toFixed(5)}. The last line: <code>Identity()</code> means the scores are left raw, not squeezed between 0 and 1, and it shows a third setting, <code>max_length</code>: the model reads at most ${LIB_MAXLEN} tokens of each pair. The next screen is about it.`)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: whole sheets, max_length=128. */
  function broken({ el, done, kit }) {
    ensureStyle();
    const C = [
      { ask: "Why is the rose sheet near the bottom?", opts: [
          "The reranker has never heard of black spot",
          "Each pair is cut at 128 tokens; the rose sheet's black spot section comes after the cut, so the model never read it",
          "The search step missed the rose sheet",
          "The scores are all negative, so the model failed on every sheet"], correct: 1 },
      { ask: "Which fix do you make?", opts: [
          "Rerank more sheets: raise k",
          "Split the sheets into their sections again, so each passage fits, and leave max_length at the model's own limit",
          "Lower max_length further so more sheets fit in the time"], correct: 1 }
    ];
    const WRONG = [
      ["", "", "There is no search step here: the colleague reranked all nine whole sheets directly. The rose sheet was in the list; it scored low.", "Negative scores are normal for this model; only the order within one question matters. The order is what went wrong, and the table shows why: look at the two token columns."],
      ["All nine sheets are already reranked. More candidates cannot help when the answer inside a candidate is cut off.", "", "That cuts even more of every sheet: fewer sections read, more answers lost."]
    ];
    WRONG[0][0] = "With the full sheet it ranks the rose sheet first (you will see it below). It knows black spot when it can read it.";
    const ans = [null, null];
    const r128 = TRUNC[128].ranked, r512 = TRUNC[512].ranked;
    const roseAt = rows => rows.findIndex(x => x[0] === "rose") + 1;
    const paint = () => {
      const ok0 = ans[0] === C[0].correct, ok1 = ans[1] === C[1].correct;
      const block = (i) => `<div class="lcase" id="q${i}"><p>${kit.esc(C[i].ask)}</p>${kit.options(C[i].opts.map(kit.esc), { picked: ans[i], correct: C[i].correct })}
        ${ans[i] == null ? "" : ans[i] === C[i].correct
          ? kit.feedback(i === 0 ? `Right. The cross-encoder reads one input of at most <code>max_length</code> tokens. Every pair here has more than 128, so the end of every sheet is dropped without any warning. The kept text of the rose sheet ends in the middle of its winter section, before "problems", where black spot is.` : `Right. With sections as passages every pair fits. Below is the same run with the model's limit, 512: the rose sheet is first. It is slower (${TRUNC[512].ms} ms against ${TRUNC[128].ms} ms for nine sheets): long passages cost time too, which is why the colleague cut them. Short passages fix both.`, true)
          : kit.feedback(kit.esc(WRONG[i][ans[i]]), false)}</div>`;
      el.innerHTML = `<h1>Broken on purpose: the cut-off sheet</h1>
        <p class="lead">A colleague "simplified" the assistant: no sections, each plant's whole sheet is one passage, and all nine go to the reranker. To make it faster they wrote <code>CrossEncoder("cross-encoder/ms-marco-MiniLM-L6-v2", max_length=128)</code>. The answer to this question is in the rose sheet (black spot). We ran the same setup on our laptop: the same model's official ONNX file, with each pair cut at 128 tokens.</p>
        ${qBox("Question", TRUNC_Q, kit)}
        <table class="${P}-t"><caption>reranker with max_length=128, whole sheets</caption><thead><tr><th>sheet</th><th class="n">score</th><th class="n">tokens in pair</th><th class="n">tokens read</th></tr></thead>
          <tbody>${r128.map(([p, s, n, k]) => `<tr class="${p === "rose" ? "no" : ""}"><td class="c">${kit.esc(p)}</td><td class="n">${f2(s)}</td><td class="n">${n}</td><td class="n">${k}</td></tr>`).join("")}</tbody></table>
        <p class="lp-cap">the last words the model read of the rose sheet (its tokenizer lower-cases and splits text):</p>
        <div class="${P}-tail">… ${kit.esc(TRUNC[128].tail)}</div>
        <p class="task">Find the cause, then pick the fix.</p>
        ${block(0)}
        ${ok0 ? block(1) : ""}
        ${ok1 ? `<table class="${P}-t"><caption>same run, max_length=512</caption><thead><tr><th>sheet</th><th class="n">score</th><th class="n">tokens read</th></tr></thead>
          <tbody>${r512.slice(0, 3).map(([p, s, , k]) => `<tr class="${p === "rose" ? "hit" : ""}"><td class="c">${kit.esc(p)}</td><td class="n">${f2(s)}</td><td class="n">${k}</td></tr>`).join("")}</tbody></table>
          ${kit.feedback(`The rose sheet moved from ${ORD(roseAt(r128))} to ${ORD(roseAt(r512))}. The bi-encoder search has the same kind of limit (its model card says text longer than 256 word pieces is cut), so chunk size matters at both stages.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((cs, i) => cs.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === C[0].correct && ans[1] === C[1].correct) done();
      }));
    };
    paint();
  }

  /* 8. The big picture, with a task: which change makes each question slower? */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const opts = [
      "The shop adds ten times more care sheets to the index",
      "You raise k from 10 to 50",
      "More staff use the assistant at the same time"
    ];
    const correct = 1;
    const paint = () => {
      const ok = pick === correct;
      el.innerHTML = `<h1>When a reranker pays off</h1>
        <p class="lead"><b>What for:</b> fixing the order of candidates the search already found, so the few that reach the answer are the right ones.</p>
        <p class="lead"><b>Reach for it when</b> only the top few results are used (a RAG prompt, a short results page), questions are worded unlike the documents, and many chunks look alike.</p>
        <p class="lead"><b>Not when</b> the right chunk is not among the candidates (fix the search or chunking, or add keyword search), for an exact code or id (use an exact lookup on that field instead), or when the time budget is tiny, such as results on every keystroke.</p>
        <p class="lead"><b>Costs:</b> one model run per candidate on every question; time that grows with k; a model to host or a per-call service to pay; long passages cut at <code>max_length</code>.</p>
        <p class="task">The reranker is live with k = 10. Which change makes each single question much slower?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: pick, correct })}
        ${pick == null ? "" : ok ? kit.feedback("Right. Five times more candidates is five times more cross-encoder runs per question. The search would hardly notice.", true)
          : pick === 0 ? kit.feedback("The chunk vectors are made ahead of time, and comparing one question vector with more stored vectors stays fast (vector indexes exist for that), so the search gets only a little slower. The reranker still reads only k = 10 candidates, so its time per question does not change.", false)
          : kit.feedback("More staff means more questions per minute, so the total work and the server bill grow. Each single question still reranks the same 10 candidates and takes about as long, as long as the server keeps up.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === correct) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A law firm's assistant searches contracts. Lawyers ask in plain words, the clauses use legal wording, the search finds the right clause in its top 50 but usually around 10th to 30th, and only the top 3 go to the answer.", true,
      "Yes. The answer is among the candidates but not on top, the wording differs, and only the top 3 are used. Rerank the top 50 if the budget allows, measured the way you did for k.",
      "This is the reranker's best case: the search finds the clause but ranks it too low, and the wording of question and clause differ. A cross-encoder reading both together fixes the order."],
    ["A warehouse scanner reads a product code like 4006381333931 and must show that product's record.", false,
      "No. This is an exact lookup: an index on the code returns the one right record directly and instantly. A code has no wording for a cross-encoder to understand, so reranking adds time and nothing else.",
      "Think about what the reranker is good at: judging whether a passage answers a question in other words. A product code has no meaning to judge. An exact index on the code finds the one record directly; no ranking problem is left."],
    ["A support bot keeps answering returns questions badly. You check: the returns policy chunk is not in the search's top 100 for those questions at all.", false,
      "No. A reranker only reorders the candidates it is given. If the right chunk is not among them, no order puts it on top. Fix the first stage: the chunking, the embedding model, or add keyword search.",
      "A reranker cannot add a chunk the search did not return; it only reorders the list. Here the problem is before the reranker: retrieval misses the chunk entirely."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Add a reranker here?</h1>
        <p class="lead">${WORDS[CASES.length][0].toUpperCase() + WORDS[CASES.length].slice(1)} situations away from the garden centre.</p>
        <p class="task">For each one, decide whether adding a cross-encoder reranking step fixes the problem. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook checklist (from our own run of the same models). */
  // the Berlin scores are from docs/ai-path/runs/s5a-rerankers/library.out.txt (8.607139, -4.3200784; the ONNX run in
  // sanity.out.txt gave 8.6071415, -4.32008), rounded
  const CHECKS = [
    "The cross-encoder scores the model card's two Berlin pairs at about 8.61 and −4.32: your setup matches.",
    `For the orchid question the search puts orchid-pests ${ORD(ORCHID_BI)}, and after reranking the top 10 it is ${ORD(ORCHID_CE)}.`,
    "Every reranker score for the orchid question's top 10 is below zero, yet the order is right.",
    "The rerank time grows with k: reranking 40 candidates takes several times as long as reranking 5.",
    `With max_length=128 on whole sheets, the rose sheet drops from ${ORD(TRUNC[512].ranked.findIndex(x => x[0] === "rose") + 1)} to ${ORD(TRUNC[128].ranked.findIndex(x => x[0] === "rose") + 1)} of ${TRUNC[128].ranked.length}.`
  ];
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Retrieve fast, then rerank</h1>
      <p class="lead">A bi-encoder search is fast because the chunk side is done ahead of time, but it judges each chunk by one vector. A cross-encoder reads the question and the chunk together and judges better, at one model run per candidate. So: search for k candidates, rerank them, keep the top few. Pick k from your time budget and from where the right chunk sits in your own tests, and keep passages shorter than the model's <code>max_length</code>.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="${P}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a>` : "The notebook for this lesson is on its way"}. It loads the two models with sentence-transformers, searches the care-sheet chunks, reranks them and times k. What you should see:</p>
      <p class="${P}-cap">Tap an item when you see it. Optional; nothing is saved.</p>
      <div class="lopts ${P}-checks">${CHECKS.map((c, i) => `<button type="button" data-c="${i}" aria-pressed="false"><span class="${P}-box" aria-hidden="true"></span><span>${kit.esc(c)}</span></button>`).join("")}</div>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It puts a retrieve step like the one you tuned here in front of building the prompt and answering.</p>` : ""}`;
    el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("right", on);
    });
    done();
  }

  LessonKit.define(ID, {
    title: "Rerankers and cross-encoders",
    checked: "2026-11-13",
    sources: [
      "https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html",
      "https://sbert.net/examples/cross_encoder/applications/README.html",
      "https://sbert.net/docs/package_reference/cross_encoder/cross_encoder.html",
      "https://sbert.net/docs/package_reference/sentence_transformer/SentenceTransformer.html",
      "https://sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html",
      "https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2",
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2",
      "https://docs.pytorch.org/docs/2.15/generated/torch.argsort.html",
      "https://arxiv.org/abs/1901.04085",
      "https://arxiv.org/abs/1908.10084"
    ],
    interview: [{
      q: "Your RAG bot's search finds the right policy chunk in its top 20 most of the time, but rarely in the top 3 that go into the prompt. You have about 200 ms to spare per question. What do you do?",
      good: [
        "Add a cross-encoder reranker over the search's top k and send its top 3 to the prompt",
        "Explain why it helps: the cross-encoder reads question and chunk together, the bi-encoder compares two vectors made separately",
        "Choose k by measuring: rerank time per pair on the real hardware, and how often the right chunk is inside the top k on a set of real questions",
        "Check passage length against the reranker's max_length, or the end of each chunk is silently cut",
        "Measure before and after on the same questions; a reranker can also make some questions worse"
      ],
      weak: "Send all 20 chunks to the model, or switch to a bigger embedding model, without measuring where the right chunk sits or what each option costs."
    }, {
      q: "After you add a reranker, answers about long documents get worse while short ones improve. What do you suspect?",
      good: [
        "Truncation: the cross-encoder reads at most max_length tokens of each question-and-passage pair and drops the rest without warning",
        "Check the token count of the pairs that fail and where the answer sits in the passage",
        "Fix with shorter chunks (sections) rather than a lower max_length; a longer limit also costs time"
      ],
      weak: "The reranker model is bad at long text, so remove it, without checking what part of each passage it actually read."
    }],
    screens: [byHand, compare, spotIdea, predict, chooseK, library, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-next]", "[data-right]", "[data-next]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
