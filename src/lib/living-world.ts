import type { Pixel, SceneId } from "./types";
export { LIVING_LANDMARKS, type LivingLandmark } from "./living-landmarks";

/** Authored fictional starter material. These are persisted by the explicit
 * operator seed, never fabricated as people or posts by the running client. */
export interface LivingSeedMemory {
  id: string; authorName: string; title: string; body: string; type: "text" | "image";
  color: string; x: number; y: number; sceneId: SceneId;
  inspiredBy: string | null; imageUrl: string | null;
}
export const LIVING_SEED_MARKER = "seed:living-mosaic:v1";
export const livingSeedId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const LIVING_OPERATION_ID = livingSeedId(9000);
export const LIVING_EVENT_ID = livingSeedId(9001);

type Fragment = { title: string; body: string; author: string; image?: string; parent?: number; point?: [number, number] };
const fragments: Fragment[] = [
  { title: "A train with nowhere to be", body: "We are drawing a very long night train. Add a carriage for somewhere you miss, somewhere you are going, or a place that only exists in a dream. Mine is the last bus home, pretending it was a train.", author: "Rae", image: "night-train", point: [1310, 320] },
  { title: "One stop before the sea", body: "I gave the next carriage a window and a yellow lamp. Can this one go one stop past the sea? I have never been to the place I keep dreaming about.", author: "Leo", parent: 1, point: [1570, 770] },
  { title: "A ticket for my brother", body: "I drew two seats. One is for my brother, who would absolutely complain if he did not get the window. I would let him have it this time.", author: "Sana", image: "ticket", parent: 1, point: [1870, 360] },
  { title: "I still have the key", body: "The flat I grew up in is a bakery now. I still have the key. Once, I went in for a loaf and tried to work out where our kitchen table would have been.", author: "Nina", point: [-470, -200] },
  { title: "An address I can draw", body: "I do not remember the postcode of my first flat, but I could draw every crack in the ceiling. I left a little window beside your key.", author: "Jules", image: "window", parent: 4, point: [-190, -220] },
  { title: "Dream transport department", body: "Last night I dreamed all the buses were made of bread. Everyone treated this as completely normal. I was still late for work.", author: "Dev", image: "bread-bus", point: [1450, -370] },
  { title: "A serious proposal", body: "Pigeons should have tiny backpacks. I have no further business case. Thank you for your time.", author: "Kit", image: "pigeon", point: [200, -460] },
  { title: "Tuesday, 8:12", body: "I washed the mug that had been beside my bed for a week. A small achievement, but I am putting it somewhere.", author: "Sam" },
  { title: "Almost sent", body: "I wrote an apology so many times that it slowly turned into an excuse. I did not send it. I am trying again with fewer words.", author: "Imani" },
  { title: "The first small welcome", body: "After I moved, the cashier at the corner shop learned how to pronounce my name. I do not think she knew how much that mattered.", author: "Noor" },
  { title: "The landlord", body: "My cat contributes nothing to the rent but insists on inspecting every room. He accepts payment in warm laundry.", author: "Bo", image: "cat", point: [-610, 20] },
  { title: "A harmless confession", body: "When someone points at the sky, I name a random constellation very confidently. It is usually a plane.", author: "Ari" },
  { title: "Nothing happened here", body: "I took this picture because nothing was happening. The same window, the same towel, the light coming in. I wanted to remember an ordinary morning.", author: "Ren", image: "blue-hour" },
  { title: "Secret choreography", body: "Every game loading screen has its own dance. I do not make the rules. The person behind me in the queue noticed, though.", author: "Tess" },
  { title: "A place I have not made yet", body: "One day I want a kitchen table large enough for friends of friends. There will always be an extra bowl, even if I do not know who it is for yet.", author: "Moss", image: "table", point: [1040, 1020] },
  { title: "One more bowl", body: "I will bring the chair with the wobbly leg. It is fine if you put a folded shopping list under it. This is engineering.", author: "Jules", parent: 15, point: [1270, 1070] },
  { title: "A tiny destination", body: "The goose with a bag is going to tell his aunt that he got the job. It is a terrible job. She will be proud anyway.", author: "Bea", point: [740, -200] },
  { title: "Next carriage, please", body: "I drew the beginning, not the ending. If the train reaches your memory, add a window for it. It does not have to match mine.", author: "Rae", parent: 1, point: [1840, 820] },
  { title: "Soup status", body: "Still waiting. Starting to suspect the soup is waiting for me.", author: "Jo", point: [-560, 1190] },
  { title: "The correct passenger", body: "Please leave one seat on the bread bus for a very nervous crouton.", author: "El", parent: 6 },
  { title: "Small win", body: "I made the phone call. It took eleven seconds and three business days of worrying.", author: "Cam" },
  { title: "A review of today", body: "Too many tabs. Excellent peach. Three stars.", author: "Ash" },
  { title: "Dad measurement system", body: "My dad measures every distance in how far he thinks he could kick a football. He is fifty-eight.", author: "Lou" },
  { title: "Do not tell the moon", body: "I told my nephew the moon follows our car because it likes our music.", author: "Ali" },
  { title: "An extremely local legend", body: "There is a dog on my street called Kevin. He knows exactly how funny that is.", author: "Ro" },
  { title: "The wrong supermarket", body: "I still turn down the wrong aisle because that is where they kept the cereal when I was twelve.", author: "Dee" },
  { title: "Someone else's laugh", body: "I heard my sister laugh in my own voice today. We live very far apart.", author: "Rin" },
  { title: "The potato drawer", body: "Every home should have one drawer whose contents no one can explain. Ours has a potato.", author: "Max" },
  { title: "Important bird update", body: "Saw a pigeon walk through an automatic door like he had an appointment.", author: "Kit", parent: 7 },
  { title: "I can explain", body: "The bread bus is gluten transport. I will now leave.", author: "Pat", parent: 6 },
  { title: "A new unit of time", body: "A banana turning brown while you wait for the right moment to eat it.", author: "Tess" },
  { title: "Proof I was here", body: "A small lilac square, for no particular reason. Hi.", author: "Fin" },
  { title: "Welcome committee", body: "If you are new here, the cat is in charge. This was not put to a vote.", author: "Bo", parent: 11 },
  { title: "Childhood geography", body: "I thought the next town was another country because Mum called it a big trip.", author: "Bea" },
  { title: "A song with no name", body: "I remember the tune my grandmother hummed. I have no idea whether it was a real song.", author: "Ali" },
  { title: "The blue plate", body: "Nobody wanted the chipped blue plate when we moved. I ate off it for six years.", author: "Nina", parent: 4 },
  { title: "A modest dream", body: "One day I will fold the fitted sheet and the corners will understand what I mean.", author: "Sam" },
  { title: "Dream loading error", body: "I dreamed my teeth were tiny elevators. Woke up absolutely furious with the architect.", author: "Dev" },
  { title: "You can keep this", body: "A compliment from a stranger on a Tuesday can last an unreasonable amount of time.", author: "Noor" },
  { title: "The lower shelf", body: "My little brother put a drawing on the fridge low enough that he could reach it himself.", author: "Sana" },
  { title: "Still know the steps", body: "I cannot remember my old address, but I could walk from the bus stop to the front door with my eyes closed.", author: "Ren" },
  { title: "Business goose", body: "He is not carrying important documents. The bag is full of pond water.", author: "Moss", parent: 17 },
  { title: "Dear future me", body: "Buy the good socks. I am tired of this subplot.", author: "Ari" },
  { title: "Someone left the light on", body: "I used to wait for the upstairs window to glow before going home. It meant someone was in.", author: "Jules", parent: 5 },
  { title: "Rain smell", body: "The first rain after summer smelled exactly like the school playground. For a second I was nine.", author: "Cloud" },
  { title: "This is a bus stop now", body: "The bread bus can stop here. I have drawn one crumb of infrastructure.", author: "Leo", parent: 6 },
  { title: "Very large cat logistics", body: "If we give him a very large box, will he sit in it? This is the only research I want funded.", author: "Jo", parent: 11 },
  { title: "No one warned me", body: "Growing up is mostly deciding what to eat again. I thought there would be more secret doors.", author: "Imani" },
  { title: "A secret door", body: "I left this here so there would be one.", author: "El", parent: 48 },
  { title: "The group chat", body: "Our group chat is now entirely pictures of meals and one person asking where everyone is.", author: "Pat" },
  { title: "A good excuse", body: "I took the long way because a tree was doing something impressive with the light.", author: "Ren" },
  { title: "The train inspector", body: "The goose has a ticket. Unfortunately he ate the date.", author: "Kit", parent: 1 },
  { title: "A useful invention", body: "An undo button for saying 'you too' when the dentist says open wide.", author: "Cam" },
  { title: "For whoever needs it", body: "The small version of the thing still counts as doing the thing.", author: "Moss" },
  { title: "Ordinary courage", body: "I went alone. It was awkward for a bit. Then it was just somewhere I was.", author: "Dee" },
  { title: "Please keep drawing", body: "Your weird little picture made me stop scrolling. That was a nice minute.", author: "Lou" },
  { title: "Parking ticket for the moon", body: "It has been in the same place outside my window for twenty minutes. Seems suspicious.", author: "Ari", parent: 24 },
  { title: "Something inherited", body: "I stir my tea exactly like my father, including the completely unnecessary last clink.", author: "Rin" },
  { title: "Bread bus route map", body: "Next stop: Toast. Change here for Butter. No service to Crust on Sundays.", author: "Dev", parent: 6 },
  { title: "A quiet bit", body: "This patch of nothing is for looking at the rest for a moment.", author: "Fin" },
  { title: "Museum label", body: "Untitled, 2026. A person avoiding one email. Lilac pixels on internet.", author: "Tess" },
  { title: "A bowl for you", body: "You can sit here even if you have nothing interesting to say.", author: "Moss", parent: 15 },
  { title: "Unread recipe", body: "I know my mother's recipe by heart and still open her message every time I cook it.", author: "Bea" },
  { title: "A useful ghost", body: "A ghost that just finds the other sock. We would get along.", author: "Bo" },
  { title: "The exact shade", body: "I could not tell you what colour my childhood bedroom was. I would know it if I saw it.", author: "Nina", parent: 4 },
  { title: "No rush", body: "The night train is not late. We have not decided what time means here.", author: "Rae", parent: 1 },
  { title: "Soup committee minutes", body: "Motion to add noodles. Passed unanimously by me.", author: "Jo", parent: 19 },
  { title: "A round of applause", body: "For the person who carried all the shopping in one trip and lost one orange with dignity.", author: "Ali" },
  { title: "Old save file", body: "I found a game save with my brother's terrible character name. Could not bring myself to delete it.", author: "Sam" },
  { title: "A little collection", body: "Nice pebbles. An odd button. A ticket. Evidence that I have been places.", author: "Sana", parent: 3 },
  { title: "Tree witness", body: "The tree outside the office knows too much about my lunches.", author: "Max" },
  { title: "Left on the fridge", body: "A shopping list in handwriting I miss. Mostly onions, then 'something nice'.", author: "Noor" },
  { title: "The cat has feedback", body: "He would like the world to be a little warmer and significantly more tuna.", author: "Bo", parent: 11 },
  { title: "For the weird kids", body: "This square is for the kids who made elaborate maps of places that did not exist.", author: "El" },
  { title: "A better airport", body: "Every departure gate should have a tiny library of books people finished on the way here.", author: "Cloud" },
  { title: "Emergency tiny party", body: "You did the thing? I put three pixels here in your honour.", author: "Tess", parent: 21 },
  { title: "My old alarm clock", body: "The buttons only worked if you pressed them in exactly the right place. I still reach that way.", author: "Leo" },
  { title: "One window for the sea", body: "I have not drawn the sea yet. If you know what it looks like from a train, help.", author: "Rae", parent: 2 },
  { title: "A very short poem", body: "The kettle / did its best / so did I.", author: "Ren" },
  { title: "The most local weather", body: "Raining over my laundry specifically. The rest of town seems fine.", author: "Pat" },
  { title: "Leave a corner unfinished", body: "I like when a thing leaves room for me. Here is one corner I did not finish.", author: "Moss" },
  { title: "Was anyone else here?", body: "I used to stay up to watch the screensaver hit the corner. I have found my people.", author: "Ari" },
  { title: "A little of everyone", body: "I came here to draw one square and read a stranger's memory about a bakery. I stayed.", author: "Fin", parent: 4 },
  { title: "A final soup update", body: "The soup is ready. I have become emotionally attached to waiting.", author: "Jo", parent: 19 },
];

const reserved = [
  { x: -590, y: 210, width: 380, height: 270 }, { x: 1290, y: 510, width: 780, height: 260 },
  { x: 1410, y: -200, width: 440, height: 210 }, { x: -630, y: 970, width: 620, height: 190 },
  { x: 700, y: -480, width: 260, height: 285 },
  // Existing starter art and authored originals stay in their original places.
  { x: 24, y: 170, width: 1160, height: 560 },
];
const fixed = fragments.filter(f => f.point).map(f => ({ x: f.point![0], y: f.point![1], width: f.image ? 165 : 220, height: f.image ? 190 : 130 }));
const points: [number, number][] = [];
for (let row = 0; row < 12; row++) for (let col = 0; col < 13; col++) {
  const x = -650 + col * 230 + ((col * 67 + row * 53) % 131 - 65);
  const y = -580 + row * 167 + ((col * 41 + row * 71) % 101 - 50);
  if ([...reserved, ...fixed].some(r => x < r.x + r.width && x + 210 > r.x && y < r.y + r.height && y + 120 > r.y)) continue;
  points.push([x, y]);
}
// Deliberately mix emotional registers through the field rather than zoning
// jokes, memories and dreams into artificial categories.
const colors = ["#FFF3BF", "#EDE6FF", "#F8E2EB", "#E9F1FF", "#FFE8D6", "#FFFFFF"];
let cursor = 0;
export const LIVING_MEMORIES: LivingSeedMemory[] = fragments.map((fragment, index) => {
  const point = fragment.point ?? points[(cursor++ * 37) % points.length];
  if (!point) throw new Error("The living starter field has no room for a fragment.");
  const [x, y] = point;
  return { id: livingSeedId(index + 1), authorName: fragment.author, title: fragment.title, body: fragment.body,
    type: fragment.image ? "image" : "text", imageUrl: fragment.image ? `/starter-world/${fragment.image}.svg` : null,
    color: colors[index % colors.length], x, y,
    sceneId: x < 150 ? "pond" : x > 1180 ? "garden" : "mixtape",
    inspiredBy: fragment.parent ? livingSeedId(fragment.parent) : null };
});

const art = new Map<string, Pixel>();
function cell(x: number, y: number, color: string) { art.set(`${x},${y}`, { x, y, color }); }
function rect(x: number, y: number, width: number, height: number, color: string) {
  for (let cy = Math.floor(y / 6); cy < Math.ceil((y + height) / 6); cy++) for (let cx = Math.floor(x / 6); cx < Math.ceil((x + width) / 6); cx++) cell(cx, cy, color);
}
function sprite(rows: string[], x: number, y: number, size: number, palette: Record<string, string>) {
  rows.forEach((row, iy) => [...row].forEach((key, ix) => { if (palette[key]) rect(x + ix * size, y + iy * size, size, size, palette[key]); }));
}
const ink = "#77729A", lilac = "#DED1F0", butter = "#F0D66E", blush = "#E7ABC6", sky = "#A3B5EB", white = "#FFFFFF";
sprite(["..kk........kk..", "..kpk......kpk..", "..kppkkkkkkppk..", ".kooooooooooook.", "koookooookoooook", "kooooooooooooook", ".koooppoppooook.", "..kkkoooookkk...", ".....kkkkk......"], -552, 246, 18, { k: ink, p: blush, o: lilac });
sprite(["......kkkk......", ".....kwwwwk.....", "....kwwkwwwkyy..", "....kwwwwwwkyyy.", ".....kwwwk......", ".....kwwwk......", "...kkkwwwk......", "..kwwwwwwwk.....", ".kwwwwwwwwwk....", ".kwwwwpppwwk....", "..kwwwpppwwk....", "...kwwwwwwk.....", "....ykkykk......", "...yy..yy......."], 738, -450, 12, { w: white, k: ink, y: butter, p: blush });
// A bread-shaped vehicle, with a knowingly unfinished passenger window.
sprite(["...bbbbbbbbbbbbbb...", "..bbbbbbbbbbbbbbbb..", ".bbbbbbbbbbbbbbbbbb.", "bbbbbbbbbbbbbbbbbbbb", "bbkkkkkkkkkkkkkkkkbb", "bbkwwkwwkwwkwwk..kbb", "bbkwwkwwkwwkwwk..kbb", "bbkkkkkkkkkkkkkkkkbb", "bbbbbbbbbbbbbbbbbbbb", ".bbbbbbbbbbbbbbbbbb.", "...kk........kk.....", "...kk........kk....."], 1452, -174, 18, { b: "#E9BC94", k: ink, w: "#FFF3BF" });
// Rails + three cars. The third car ends halfway through: a visible invitation.
rect(1320, 696, 714, 6, "#D9D0E9"); rect(1320, 720, 714, 6, "#D9D0E9");
for (let x = 1320; x < 2040; x += 24) rect(x, 690, 6, 42, "#E7DFF0");
for (let i = 0; i < 3; i++) {
  const x = 1326 + i * 198, width = i === 2 ? 84 : 174;
  rect(x + 6, 576, width - 12, 6, ink); rect(x, 582, width, 90, ink);
  rect(x + 6, 588, width - 12, 72, [lilac, sky, "#F8D8E4"][i]);
  for (let j = 0; j < (i === 2 ? 1 : 3); j++) { rect(x + 12 + j * 54, 600, 42, 42, ink); rect(x + 18 + j * 54, 606, 30, 30, "#FFF3BF"); }
  rect(x + 18, 672, 24, 12, ink); if (i < 2) { rect(x + 132, 672, 24, 12, ink); rect(x + 174, 642, 24, 6, "#C8BEDA"); }
}
// Open rail and a few corner pixels say "continue here" without a closed box.
for (const [x, y] of [[1824, 576], [1836, 576], [1824, 588], [1920, 576], [1920, 588], [1908, 576]]) rect(x, y, 6, 6, "#C8BEDA");
const letters: Record<string, string[]> = {
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"], A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["111", "010", "010", "010", "010", "010", "111"], T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"], G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"], S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"], P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
};
let textX = -594;
for (const character of "WAITING FOR SOUP") {
  if (character === " ") { textX += 18; continue; }
  const rows = letters[character]; sprite(rows, textX, 1020, 6, { "1": "#AC91BE" }); textX += (rows[0].length + 1) * 6;
}
// A small steaming bowl under the very serious sign.
sprite(["..p....p....", "...p..p.....", "..p....p....", "............", "bbbbbbbbbbbb", ".bbbbbbbbbb.", "..bbbbbbbb..", "...bbbbbb...", "....bbbb...."], -384, 1080, 6, { p: "#CEBCE5", b: "#E9BC94" });
// Small communal gestures interrupt the paper field without fake posts.
const heart = [".ppp.ppp.", "ppppppppp", "ppppppppp", ".ppppppp.", "..ppppp..", "...ppp...", "....p...."];
for (const [x, y, c] of [[-84, -430, blush], [2022, 1200, lilac], [80, 1200, sky]] as const) sprite(heart, x, y, 6, { p: c });
for (const [x, y] of [[-120, 770], [380, -240], [1300, 1280], [2010, 108], [-470, 820]]) {
  rect(x, y, 30, 6, butter); rect(x + 12, y - 12, 6, 30, butter);
}
export const LIVING_PIXELS: Pixel[] = [...art.values()].sort((a, b) => a.y - b.y || a.x - b.x);
