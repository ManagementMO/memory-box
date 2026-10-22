import type { Pixel } from "./types";
import type { LivingSeedMemory } from "./living-world";
export { WATERLOO_ARRIVAL, WATERLOO_LANDMARKS } from "./waterloo-landmarks";

/** Original, fictional examples inspired by campus folklore. These are not
 * scraped student posts, live testimonials, or a University-run community. */
export const WATERLOO_SEED_MARKER = "seed:waterloo-commons:v1";
export const waterlooSeedId = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const WATERLOO_OPERATION_ID = waterlooSeedId(9000);
export const WATERLOO_EVENT_ID = waterlooSeedId(9001);

type Fragment = { title: string; body: string; author: string; x: number; y: number; image?: string; parent?: number };
const fragments: Fragment[] = [
  { title: "Goose committee", body: "The campus goose has a co-op interview. We gave it a pink tie and absolutely no qualifications. Finish the tie, change its sign, or draw the company brave enough to hire it. The committee is whoever shows up.", author: "Goose committee", x: 3890, y: -460 },
  { title: "Candidate has excellent hiss-tory", body: "Our deeply unqualified goose. The CV says 'territorial stakeholder management'. Improve its chances with a few pixels nearby.", author: "Pixel goose", x: 4110, y: -370, image: "uw-goose", parent: 1 },
  { title: "Relevant experience", body: "Successfully blocked one path. Managed a team of six goslings. Available for relocation to the other side of the pond. We regret to inform the goose that the interviewer is also a goose.", author: "Honk resources", x: 4360, y: -430, parent: 1 },
  { title: "A tie with room for more", body: "A pink tie for the Waterloo math tradition. One end is unfinished because the next person should get to do something.", author: "Tie committee", x: 3660, y: -20, image: "uw-pink-tie" },
  { title: "Keep the tie pink", body: "A campus tradition meets a tiny internet disagreement. The tie is pink. For now. I left the bottom corner blank for someone with a more ambitious interpretation of formalwear.", author: "Tie committee", x: 3330, y: -400, parent: 4 },
  { title: "Emergency backup tie", body: "If the goose gets this one dirty, there is a second tie. If the second tie gets dirty, we will describe the stains as a design choice. Please draw the backup tie somewhere extremely inconvenient.", author: "Formal goose", x: 3330, y: 340, parent: 5 },
  { title: "MC route, definitely wrong", body: "An imaginary concrete maze inspired by Mathematics and Computer. Follow the arrow to arrive exactly where you started, emotionally and architecturally.", author: "Lost in MC", x: 4750, y: -500, image: "uw-maze" },
  { title: "Found a new floor", body: "Went looking for a room in MC. Discovered a staircase, three opinions, and the same staircase again. Add a wrong turn to the picture if it feels familiar.", author: "Lost in MC", x: 4980, y: 100, parent: 7 },
  { title: "Directions from a friend", body: "'It is easy, just go past the concrete.' Thank you. I am now in every direction at once. I put an exit in the maze; someone is welcome to move it.", author: "Concrete enjoyer", x: 5250, y: -150, parent: 8 },
  { title: "Lines, a peer review", body: "A late-night Lazeez sauce order has become a counting problem. The fourth line stops halfway. Someone has to take responsibility.", author: "Sauce committee", x: 4700, y: 520, image: "uw-sauce" },
  { title: "Statistically enough sauce", body: "Asked for a confidence interval. Received another line. Please add a graph that makes this look like a reasonable use of tuition.", author: "Sauce statistician", x: 4970, y: 530, parent: 10 },
  { title: "The mild position", body: "My contribution to the sauce debate is a little glass of water, just outside the frame. I would like to remain friends with everyone.", author: "Water, please", x: 5300, y: 760, parent: 10 },
  { title: "ION to somewhere", body: "A little train for everyone who has watched the city go past after a long day. Draw another carriage. It can go home, to a friend, or somewhere the real tracks do not.", author: "Window seat", x: 3340, y: 690 },
  { title: "One seat for the goose", body: "The goose has a ticket. It would like the window, the aisle, and some personal space for its emotional support rejection letter. I drew the beginning of its seat, not the ending.", author: "Fare enough", x: 3670, y: 1130, parent: 13 },
  { title: "The residence kitchen", body: "We each brought one thing to the residence kitchen. Someone had noodles, someone had an onion, someone had a very strong opinion about the pan. It became dinner. Leave a memory of the people who made a new place feel less new.", author: "Kitchen table", x: 4070, y: 1210 },
  { title: "The long campus walk", body: "My friend from Arts and I walked home slowly after a terrible week. We argued about which building looked most like a printer. It helped more than any of the advice we had been given.", author: "Long way home", x: 4370, y: 1120 },
  { title: "A win without a spreadsheet", body: "A friend in Health reminded me that eating dinner, going outside, and calling somebody count as a plan. I put a tiny sun beside the goose. Anyone can make it bigger.", author: "Outside, briefly", x: 4440, y: 650 },
  { title: "Midnight noodles", body: "Every table was full, but someone moved their bag and said 'here'. I have forgotten what assignment I was doing. I remember that tiny bit of room.", author: "One spare chair", x: 3390, y: 1170 },
  { title: "The umbrella exchange", body: "The rain arrived halfway across campus. We shared one umbrella badly. The notes stayed dry, which everyone agreed was the correct priority. Draw the weather you think Waterloo deserves today.", author: "Damp notes", x: 3630, y: 500 },
  { title: "Before the interview", body: "The person beside me said they were nervous too. That did not get either of us the job. It did make the next twenty minutes feel less lonely.", author: "Still trying", x: 5280, y: 1100, parent: 1 },
  { title: "You are still on mute", body: "The goose completed its entire introduction on mute. Excellent teamwork: every person in the call discovered this simultaneously. Please add the microphone icon it deserves.", author: "Honk resources", x: 4440, y: -40, parent: 3 },
  { title: "An email-shaped emotion", body: "A co-op inbox can make a very small screen feel like the whole world. I am leaving one square here for the part of the day that happened after closing it.", author: "After refresh", x: 5260, y: 320 },
  { title: "Field trip to the other faculty", body: "I followed a Science friend into a building I had walked past for a year. Entirely different posters. Same exhausted vending machine. More of campus existed than my timetable suggested.", author: "New hallway", x: 4650, y: 1090 },
  { title: "The seat beside home", body: "I called home on the ride back and let the ordinary kitchen noises fill the silence. It is strange how a place can be new and familiar in the same week. The next carriage can be for whoever you miss.", author: "Window seat", x: 3920, y: 720, parent: 13 },
];

const colors = ["#FFF3BF", "#EDE6FF", "#F8E2EB", "#E9F1FF", "#FFE8D6", "#FFFFFF"];
export const WATERLOO_MEMORIES: LivingSeedMemory[] = fragments.map((fragment, index) => ({
  id: waterlooSeedId(index + 1), authorName: fragment.author, title: fragment.title, body: fragment.body,
  type: fragment.image ? "image" : "text", color: colors[index % colors.length], x: fragment.x, y: fragment.y,
  sceneId: "garden", inspiredBy: fragment.parent ? waterlooSeedId(fragment.parent) : null,
  imageUrl: fragment.image ? `/starter-world/${fragment.image}.svg` : null,
}));

const art = new Map<string, Pixel>();
const ink = "#363542", concrete = "#C7C5D3", gold = "#E8BF54", pink = "#E7ABC6", sky = "#A3B5EB", white = "#FFFFFF", lilac = "#DED1F0";
function rect(x: number, y: number, width: number, height: number, color: string) {
  for (let cy = Math.floor(y / 6); cy < Math.ceil((y + height) / 6); cy++) for (let cx = Math.floor(x / 6); cx < Math.ceil((x + width) / 6); cx++) art.set(`${cx},${cy}`, {x:cx,y:cy,color});
}
function sprite(rows: string[], x: number, y: number, size: number, palette: Record<string, string>) {
  rows.forEach((row, iy) => [...row].forEach((key, ix) => { if (palette[key]) rect(x + ix * size, y + iy * size, size, size, palette[key]); }));
}
// A large goose with a visible missing tie tail and an empty placard. All
// white body cells are real editable pixels; the missing feature is unpainted.
sprite([
  ".........kkkkk..........", "........kwwwwwk.........", ".......kwwkwwwwk........", ".......kwwwwwwwkyyyy....",
  "........kwwwwwwkyyyyy...", ".........kwwwkk.........", ".........kwwwk..........", ".........kwwwk..........",
  ".........kpppk..........", ".........kpppk..........", "......kkkkwwwkk.........", "....kkwwwwwwwwwkk.......",
  "...kwwwwwwwwwwwwwk......", "..kwwwwwwwwwwwwwwwk.....", "..kwwwwwwwwwwwwwwwk.....", ".kwwwwwwwwwwwwwwwwwk....",
  ".kwwwwwwwwwwwwwwwwwk....", "..kwwwwwwwwwwwwwwwk.....", "...kwwwwwwwwwwwwwk......", "....kkkkwwwwwkkkk.......",
  ".......kyykyyk..........", "......yyyy.yyyy.........",
], 4002, 120, 18, { k:ink,w:white,y:gold,p:pink });
rect(4344, 420, 6, 174, concrete); rect(4308, 420, 108, 6, ink); rect(4308, 426, 108, 66, "#FFF3BF");
rect(4308, 492, 108, 6, ink); rect(4308, 426, 6, 66, ink); rect(4410, 426, 6, 66, ink);
// The pink-tie knot and upper tail are complete; corners mark the absent end.
sprite(["....pppppp....", "...pppppppp...", "....pppppp....", ".....pppp.....", "....pppppp....", "....pppppp....", "...pppppppp...", "...pppppppp...", "..pppppppppp..", "..pppppppppp..", "..pppppppppp..", "..pppppppppp.."], 3372, -102, 18, {p:pink});
for(const [x,y] of [[3408,144],[3420,144],[3570,144],[3582,144],[3408,246],[3420,246],[3570,246],[3582,246]]) rect(x,y,6,6,"#D4C6E0");
// Deliberately imaginary MC: the concrete walls are not a real floor plan.
rect(4710,-252,540,12,concrete); rect(4710,-240,12,270,concrete); rect(4722,18,330,12,concrete); rect(5238,-240,12,114,concrete);
rect(4770,-192,300,12,concrete); rect(4770,-180,12,138,concrete); rect(4842,-120,12,138,concrete);
rect(4842,-120,240,12,concrete); rect(5082,-192,12,150,concrete); rect(4938,-48,228,12,concrete);
rect(5166,-120,12,150,concrete); rect(4998,-252,12,60,concrete); rect(4710,-252,24,24,ink);
sprite(["..g.....", "..gg....", "ggggg...", "..gg....", "..g....."], 4878,-204,6,{g:gold});
for(const [x,y] of [[5190,18],[5202,18],[5238,-96],[5238,-84]]) rect(x,y,6,6,"#DAD6E7");
// A little plate, three lines and one unfinished line. No fixed score, target,
// or fictional contributor count claims a community has completed anything.
sprite(["....kkkkkkkkkkkk....", "..kkwwwwwwwwwwwwkk..", ".kwwbbbbbbbbbbbbwwk.", "kwwbbbbbbbbbbbbbbwwk", "kwwbbbbbbbbbbbbbbwwk", "kwwbbbbbbbbbbbbbbwwk", ".kwwbbbbbbbbbbbbwwk.", "..kkwwwwwwwwwwwwkk..", "....kkkkkkkkkkkk...."], 4674,774,18,{k:concrete,w:white,b:"#F5E7B4"});
for(const y of [810,834,858]) rect(4764,y,180,6,"#C68A70"); rect(4764,882,72,6,"#C68A70");
rect(5052,750,6,120,ink); rect(5028,750,6,36,ink); rect(5040,750,6,36,ink); rect(5028,786,30,6,ink);
// The ION-inspired train deliberately has a missing last body/window, with open
// rail continuing into blank canvas rather than a sealed finished illustration.
rect(3348,1044,786,6,concrete); rect(3348,1068,786,6,concrete);
for(let x=3348;x<4134;x+=30) rect(x,1038,6,42,"#E7DFF0");
for(let i=0;i<3;i++) {
  const x=3366+i*204,width=i===2?102:180;
  rect(x,930,width,90,ink); rect(x+6,936,width-12,72,[sky,lilac,"#F8E2EB"][i]);
  for(let j=0;j<(i===2?1:3);j++){rect(x+12+j*54,948,42,42,ink);rect(x+18+j*54,954,30,30,"#FFF3BF");}
  rect(x+18,1020,24,12,ink);if(i<2){rect(x+138,1020,24,12,ink);rect(x+180,990,24,6,concrete);}
}
for(const [x,y] of [[3960,930],[3972,930],[4056,930],[4068,930],[4056,1014]]) rect(x,y,6,6,concrete);
// Scattered tiny marks leave the campus field messy and open between originals.
for(const [x,y] of [[3792,318],[4548,342],[5214,630],[4284,978],[3534,588]]) {rect(x,y,30,6,gold);rect(x+12,y-12,6,30,gold);}
export const WATERLOO_PIXELS: Pixel[] = [...art.values()].sort((a,b)=>a.y-b.y||a.x-b.x);
