import { existsSync } from "node:fs";
import { adminClient, getSnapshot } from "../src/lib/server/database";
import { shapePixels } from "../src/lib/scenes";
import type { Pixel, SceneId } from "../src/lib/types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const seedId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const operationId = seedId(100);
const art = new Map<string, Pixel>();
function rect(x: number, y: number, width: number, height: number, color: string) {
  for (let cy = Math.floor(y / 6); cy < Math.ceil((y + height) / 6); cy++) {
    for (let cx = Math.floor(x / 6); cx < Math.ceil((x + width) / 6); cx++) {
      if (cx >= 0 && cx < 200 && cy >= 0 && cy < 120) art.set(`${cx},${cy}`, { x: cx, y: cy, color });
    }
  }
}
function shape(kind: Parameters<typeof shapePixels>[0], color: string, x: number, y: number) {
  shapePixels(kind, color, x, y).forEach(p => art.set(`${p.x},${p.y}`, p));
}

// A finite, deliberately unfinished picture. Seeding adds only absent cells;
// running this script again can never repaint a visitor's contribution.
rect(363, 284, 420, 162, "#CDBEE4"); rect(387, 260, 372, 210, "#CDBEE4"); rect(399, 248, 348, 234, "#CDBEE4");
rect(411, 272, 336, 180, "#263633"); rect(423, 260, 312, 12, "#263633"); rect(423, 452, 312, 12, "#263633");
rect(435, 284, 288, 100, "#E5B4B4"); rect(435, 284, 288, 22, "#F0DE8E"); rect(447, 316, 264, 48, "#263633");
for (const x of [459, 639]) { rect(x, 322, 54, 36, "#FBFCF7"); rect(x + 12, 310, 30, 60, "#FBFCF7"); rect(x + 18, 328, 18, 24, "#263633"); }
rect(513, 334, 126, 12, "#BED5DE"); rect(483, 404, 192, 24, "#A594BF"); rect(471, 428, 216, 12, "#A594BF");
rect(495, 410, 18, 18, "#263633"); rect(645, 410, 18, 18, "#263633");
for (const [x, y] of [[423, 278], [723, 278], [423, 440], [723, 440]]) rect(x, y, 6, 6, "#BED5DE");
rect(303, 326, 60, 126, "#263633"); rect(309, 332, 48, 114, "#687C9D"); rect(321, 344, 24, 24, "#263633");
rect(315, 386, 36, 42, "#263633"); rect(327, 398, 12, 18, "#BED5DE"); rect(363, 423, 24, 6, "#263633"); rect(381, 429, 30, 6, "#263633");
rect(42, 438, 264, 72, "#87B9BD"); rect(66, 414, 216, 120, "#87B9BD"); rect(90, 402, 168, 12, "#87B9BD"); rect(90, 534, 168, 12, "#87B9BD");
rect(66, 450, 228, 12, "#BED5DE"); rect(78, 498, 192, 12, "#BED5DE"); rect(102, 480, 96, 12, "#64936E"); rect(114, 468, 72, 36, "#64936E");
rect(222, 474, 48, 12, "#64936E"); rect(234, 462, 24, 36, "#64936E"); rect(180, 352, 108, 12, "#B98B6B"); rect(180, 374, 108, 10, "#B98B6B");
rect(192, 384, 8, 22, "#886B55"); rect(270, 384, 8, 22, "#886B55");
rect(921, 316, 228, 24, "#BDCFAB"); rect(933, 304, 204, 48, "#BDCFAB"); rect(945, 352, 180, 12, "#BDCFAB");
for (const [x, y] of [[945, 328], [993, 340], [1113, 316]]) rect(x, y, 12, 12, "#64936E");
shape("star", "#F0DE8E", 630, 156); shape("note", "#CDBEE4", 840, 144); shape("heart", "#E5B4B4", 852, 606);
shape("flower", "#E5B4B4", 948, 216); shape("flower", "#F0DE8E", 1044, 264); shape("sprout", "#CDBEE4", 1068, 162);
shape("flower", "#CDBEE4", 228, 408); shape("frog", "#64936E", 108, 420); shape("heart", "#E5B4B4", 24, 354);

const memories: Array<{ n: number; type: "text" | "image"; title: string; body: string; author: string; scene: SceneId; x: number; y: number; color: string; image?: string; inspired?: number }> = [
  { n: 1, type: "text", title: "The long way home", body: "My dad always sang the wrong words on the drive home. I would complain, but now those songs feel like being eight years old in the back seat again.", author: "Nina", scene: "mixtape", x: 452, y: 491, color: "#F0DE8E" },
  { n: 2, type: "text", title: "A CD for a friend", body: "I used to make a CD for one friend at a time. Choosing the order took forever. It was a way of saying: these songs made me think of you.", author: "Sam", scene: "mixtape", x: 477, y: 610, color: "#BED5DE" },
  { n: 3, type: "image", title: "Sunday, side A", body: "Nina’s story reminded me of my mum’s Sunday cassette. She played it while we made pancakes. I have forgotten half the songs, but I remember being in that kitchen. This is an illustration of the cassette I remember.", author: "Lee", scene: "mixtape", x: 702, y: 486, color: "#FBFCF7", image: "/seed-cassette.svg", inspired: 1 },
  { n: 4, type: "image", title: "A ticket I kept", body: "An illustrated ticket for the long way home. I kept a ticket from a trip with my sister because it reminded me of the songs we listened to together.", author: "Rue", scene: "mixtape", x: 786, y: 222, color: "#E5B4B4", image: "/seed-ticket.svg" },
  { n: 5, type: "text", title: "The internet as somebody’s room", body: "I miss websites that felt like somebody’s room. Their favorite color, a strange collection, a guestbook. You could tell a person had been there.", author: "Nina", scene: "mixtape", x: 366, y: 150, color: "#CDBEE4" },
  { n: 6, type: "text", title: "Rain radio", body: "A radio station that only plays when it rains. My mother always played the same album while cooking on rainy afternoons. That is the feeling I would build it around.", author: "Cloud", scene: "pond", x: 54, y: 186, color: "#CDBEE4" },
  { n: 7, type: "image", title: "The first little frog", body: "I drew one frog and asked strangers to leave him a neighbor. Lee added a lily pad. Cloud left a memory about rainy afternoons. The pond grew around him.", author: "Moss", scene: "pond", x: 78, y: 408, color: "#BDCFAB", image: "/seed-frog.svg" },
  { n: 8, type: "text", title: "A place to sit and talk", body: "Every pond needs a bench. Mine is for sitting with a friend until you have run out of things to say, and staying a little longer anyway.", author: "Lee", scene: "pond", x: 72, y: 564, color: "#E5B4B4" },
  { n: 9, type: "text", title: "A seed library", body: "What if a neighborhood shared seeds and the stories of how people grew them? Bring a few seeds, take a few, and leave a note about what worked.", author: "Jo", scene: "garden", x: 936, y: 378, color: "#BDCFAB" },
  { n: 10, type: "text", title: "A table for learning together", body: "I repaired the headphones I was going to throw away. I wish every neighborhood had a table where we could learn how to fix things together.", author: "Bee", scene: "garden", x: 936, y: 534, color: "#BED5DE" },
];

async function main() {
  const db = adminClient();
  const snap = await getSnapshot();
  const pixels = [...art.values()];
  const operation = await db.from("paint_operations").upsert({ id: operationId, world_id: "commons", actor_id: null, client_id: "seed:v1", request_hash: "labeled-initial-art", revision: 0, epoch: snap.epoch, scene_id: "mixtape", before_cells: [], after_cells: pixels }, { onConflict: "id", ignoreDuplicates: true });
  if (operation.error) throw operation.error;
  for (let start = 0; start < pixels.length; start += 700) {
    const result = await db.from("cells").upsert(pixels.slice(start, start + 700).map(p => ({ ...p, world_id: "commons", operation_id: operationId, updated_revision: 0 })), { onConflict: "world_id,x,y", ignoreDuplicates: true });
    if (result.error) throw result.error;
  }
  for (const item of memories) {
    const saved = await db.from("memories").upsert({
      id: seedId(item.n), world_id: "commons", author_id: null, author_name: item.author,
      client_id: `seed:${item.n}`, request_hash: "labeled-fictional-seed-v1", type: item.type,
      title: item.title, body: item.body, color: item.color, x: item.x, y: item.y, scene_id: item.scene,
      inspired_by: item.inspired ? seedId(item.inspired) : null, seed_image_url: item.image || null,
      visibility: "published", is_seed: true, index_status: "pending", search_document: `${item.title}\n${item.body}`,
      created_at: new Date(Date.UTC(2026, 9, 20, 17, item.n)).toISOString(),
    }, { onConflict: "id", ignoreDuplicates: true });
    if (saved.error) throw saved.error;
    const job = await db.from("index_jobs").upsert({ memory_id: seedId(item.n), source_version: 1 }, { onConflict: "memory_id,source_version", ignoreDuplicates: true });
    if (job.error) throw job.error;
    const event = await db.from("world_events").upsert({ id: seedId(200 + item.n), revision: 0, kind: item.inspired ? "build_on" : "memory", author_name: item.author, memory_id: seedId(item.n), scene_id: item.scene, description: item.inspired ? "built on Nina’s memory with a cassette illustration" : `left a ${item.type} memory`, is_seed: true }, { onConflict: "id", ignoreDuplicates: true });
    if (event.error) throw event.error;
  }
  const final = await getSnapshot();
  console.log(`Seed ready: ${pixels.length} artwork cells, ${final.memories.filter(m => m.isSeed).length} labeled fictional memories. Existing visitor cells were preserved.`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1; });
