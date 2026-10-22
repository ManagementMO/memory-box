import type { Memory, Pixel, Scene, SceneId } from "./types";
import { ENTRY_HEIGHT, ENTRY_WIDTH, GRID_SIZE, clampMemoryPoint, isCellPoint } from "./world-bounds";

export const SCENES: Scene[] = [
  { id: "mixtape", title: "The mixtape", invitation: "A cassette is becoming a room. Leave a song, a story, or something it reminds you of.", x: 610, y: 350 },
  { id: "pond", title: "The frog pond", invitation: "One little frog became a pond. Leave him a neighbor, or a memory of a quiet place.", x: 175, y: 455 },
  { id: "garden", title: "Things we’re growing", invitation: "An unfinished garden for unfinished ideas. Add something you’d like someone else to grow.", x: 1000, y: 330 },
];
export const SCENE_LABELS: Record<SceneId, { x: number; y: number }> = { mixtape: { x: 420, y: 92 }, pond: { x: 52, y: 305 }, garden: { x: 924, y: 80 } };
export const PAPER_COLORS = ["#FFF3BF", "#EDE6FF", "#F8E2EB", "#FFE8D6", "#E9F1FF"];
export const PAINT_COLORS = [
  { name: "Ink", value: "#292B3A" }, { name: "White", value: "#FFFFFF" }, { name: "Cobalt", value: "#3659DB" },
  { name: "Butter", value: "#F0D66E" }, { name: "Blush", value: "#E7ABC6" }, { name: "Lilac", value: "#BDA9E9" },
  { name: "Sky", value: "#A3B5EB" }, { name: "Apricot", value: "#E9BC94" }, { name: "Leaf", value: "#64936E" },
];
export const SHAPES = {
  goose: { name: "Suspicious goose", rows: [".....aaaa...", "....aaaaaa..", "....aakwaayy", "....aaaaaayy", ".....aaaa...", ".....aaa....", "..aaaaaa....", ".aaaaaaaa...", ".aaaawaaa...", "..aaaaaaa...", "...yy.yy....", "..yy...yy..."] },
  cat: { name: "Unreasonable cat", rows: [".aa......aa.", ".aaa....aaa.", ".aaaaaaaaaa.", "aaaaaaaaaaaa", "aawkaaaakwaa", "aaaaaaaaaaaa", ".aaaayaaaaa.", "..aaaaaaaa..", "...aaaaaa...", ".aaaaaaaaaa.", ".aaa....aaa.", "............"] },
  carriage: { name: "One more carriage", rows: [".aaaaaaaaaaaaaa.", "aaaaaaaaaaaaaaaa", "aawwawwawwawwaaa", "aawwawwawwawwaaa", "aawwawwawwawwaaa", "aaaaaaaaaaaaaaaa", "..kk.......kk...", "..kk.......kk..."] },
  soup: { name: "Soup, eventually", rows: ["...a....a...", "....a..a....", "...a....a...", "............", ".aaaaaaaaaa.", "aaaaaaaaaaaa", ".aaaayaaaaa.", "..aaaaaaaa..", "...aaaaaa...", "....aaaa....", "............", "............"] },
  speaker: { name: "Speaker", rows: ["aaaaaaaaaaaa", "akkkkkkkkkka", "akkwwwwwwkka", "akkwkkkkwkka", "akkwwwwwwkka", "akkkkkkkkkka", "akkwwwwwwkka", "akwkkkkkkwka", "akwkkwwkkwka", "akwkkkkkkwka", "akkwwwwwwkka", "aaaaaaaaaaaa"] },
  star: { name: "Star", rows: [".....aa.....", ".....aa.....", "....aaaa....", "aaaaaaaaaaaa", ".aaaaaaaaaa.", "..aaaaaaaa..", "...aaaaaa...", "..aaaaaaaa..", "..aaa..aaa..", ".aaa....aaa.", ".aa......aa.", "............"] },
  heart: { name: "Heart", rows: ["............", ".aaa...aaa..", "aaaaa.aaaaa.", "aaaaaaaaaaa.", "aaaaaaaaaaa.", ".aaaaaaaaa..", "..aaaaaaa...", "...aaaaa....", "....aaa.....", ".....a......", "............", "............"] },
  flower: { name: "Flower", rows: ["............", "....aaaa....", "...aaaaaa...", ".aaaayyaaa..", ".aayyyyaaa..", "...ayyaa....", "....gg......", "....gg..gg..", "..ggggggg...", "...gggg.....", "....gg......", "....gg......"] },
  note: { name: "Music note", rows: [".......aaa..", "...aaaaaaa..", "...aaa..aa..", "...aa...aa..", "...aa...aa..", "...aa...aa..", "...aa...aa..", ".aaaa.aaaa..", "aaaaa.aaaa..", "aaaa..aaa...", "............", "............"] },
  frog: { name: "Frog", rows: ["............", "..gg....gg..", ".gwwg..gwwg.", ".gwkg..gkwg.", ".gggggggggg.", "gggggggggggg", "gggggggggggg", ".gkggggggkg.", "..gkkkkkkg..", "...gggggg...", "..gg....gg..", "............"] },
  sprout: { name: "Sprout", rows: ["............", "............", "..ggg.......", ".ggggg..ggg.", "..gggg.gggg.", "....gggggg..", ".....ggg....", ".....gg.....", ".....gg.....", ".....gg.....", "....aaaa....", "...aaaaaa..."] },
  pixel: { name: "Pixel", rows: ["a"] },
};
export type ShapeId = keyof typeof SHAPES;

export function shapePixels(shape: ShapeId, color: string, x: number, y: number, grid = GRID_SIZE): Pixel[] {
  const palette: Record<string, string> = { a: color, k: "#292B3A", w: "#FFFFFF", g: "#64936E", y: "#F0D66E" };
  const cells: Pixel[] = [];
  const baseX = Math.round(x / grid), baseY = Math.round(y / grid);
  SHAPES[shape].rows.forEach((row, dy) => [...row].forEach((character, dx) => {
    const cx = baseX + dx, cy = baseY + dy;
    if (character !== "." && isCellPoint(cx, cy)) cells.push({ x: cx, y: cy, color: palette[character] });
  }));
  return cells;
}
export function sceneForPoint(x: number, y = 350): SceneId {
  if (x >= 0 && x < ENTRY_WIDTH && y >= 0 && y < ENTRY_HEIGHT) return x < 330 ? "pond" : x > 910 ? "garden" : "mixtape";
  return SCENES.reduce((nearest, scene) => Math.hypot(scene.x - x, scene.y - y) < Math.hypot(nearest.x - x, nearest.y - y) ? scene : nearest).id;
}
export function sceneById(id: SceneId) { return SCENES.find((scene) => scene.id === id)!; }
export function memorySize(memory: Pick<Memory, "type">) { return memory.type === "image" ? { width: 142, height: 161 } : { width: 205, height: 110 }; }
export function suggestedSpot(memories: Memory[], sceneId: SceneId, type: Memory["type"], parent?: Memory, anchor?: { x: number; y: number }) {
  const size = memorySize({ type }), target = parent ?? anchor ?? sceneById(sceneId);
  const occupied = [...memories.map((memory) => ({ ...memory, ...memorySize(memory) })),
    { x: 300, y: 246, width: 486, height: 237 }, { x: 40, y: 400, width: 270, height: 147 }, { x: 920, y: 300, width: 230, height: 67 }];
  const origin = clampMemoryPoint(Math.round(target.x / 6) * 6, Math.round(target.y / 6) * 6, size);
  // Search local ring perimeters only, rather than enumerating the whole plane.
  // A crowded patch may overlap as a fallback; no existing original is moved.
  const seen = new Set<string>();
  for (let radius = 0; radius <= 72; radius++) {
    const candidates: { x: number; y: number }[] = [];
    const visit = (dx: number, dy: number) => {
      const point = clampMemoryPoint(origin.x + dx * 18, origin.y + dy * 18, size);
      const key = `${point.x},${point.y}`;
      if (!seen.has(key)) { seen.add(key); candidates.push(point); }
    };
    for (let offset = -radius; offset <= radius; offset++) {
      visit(offset, -radius);
      if (radius) visit(offset, radius);
    }
    for (let offset = -radius + 1; offset < radius; offset++) { visit(-radius, offset); visit(radius, offset); }
    candidates.sort((a,b) => Math.hypot(a.x-target.x,a.y-target.y) - Math.hypot(b.x-target.x,b.y-target.y));
    const free = candidates.find(point => !occupied.some(item => point.x < item.x + item.width + 12 && point.x + size.width + 12 > item.x && point.y < item.y + item.height + 12 && point.y + size.height + 12 > item.y));
    if (free) return free;
  }
  return clampMemoryPoint(target.x + 24, target.y + 60, size);
}
