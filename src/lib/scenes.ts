import type { Memory, Pixel, Scene, SceneId } from "./types";

export const SCENES: Scene[] = [
  { id: "mixtape", title: "The mixtape", invitation: "A cassette is becoming a room. Leave a song, a story, or something it reminds you of.", x: 610, y: 350 },
  { id: "pond", title: "The frog pond", invitation: "One little frog became a pond. Leave him a neighbor, or a memory of a quiet place.", x: 175, y: 455 },
  { id: "garden", title: "Things we’re growing", invitation: "An unfinished garden for unfinished ideas. Add something you’d like someone else to grow.", x: 1000, y: 330 },
];
export const SCENE_LABELS: Record<SceneId, { x: number; y: number }> = { mixtape: { x: 420, y: 92 }, pond: { x: 52, y: 305 }, garden: { x: 924, y: 80 } };
export const PAPER_COLORS = ["#F0DE8E", "#CDBEE4", "#E5B4B4", "#BDCFAB", "#BED5DE"];
export const PAINT_COLORS = [
  { name: "Ink", value: "#263633" }, { name: "Porcelain", value: "#FBFCF7" }, { name: "Denim", value: "#354FB2" },
  { name: "Butter", value: "#F0DE8E" }, { name: "Salmon", value: "#E5B4B4" }, { name: "Orchid", value: "#CDBEE4" },
  { name: "Sage", value: "#BDCFAB" }, { name: "Pond", value: "#87B9BD" }, { name: "Leaf", value: "#64936E" }, { name: "Clay", value: "#B98B6B" },
];
export const SHAPES = {
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

export function shapePixels(shape: ShapeId, color: string, x: number, y: number, grid = 6): Pixel[] {
  const palette: Record<string, string> = { a: color, k: "#263633", w: "#FBFCF7", g: "#64936E", y: "#F0DE8E" };
  const cells: Pixel[] = [];
  const baseX = Math.round(x / grid), baseY = Math.round(y / grid);
  SHAPES[shape].rows.forEach((row, dy) => [...row].forEach((character, dx) => {
    const cx = baseX + dx, cy = baseY + dy;
    if (character !== "." && cx >= 0 && cx < 200 && cy >= 0 && cy < 120) cells.push({ x: cx, y: cy, color: palette[character] });
  }));
  return cells;
}
export function sceneForPoint(x: number): SceneId { return x < 330 ? "pond" : x > 910 ? "garden" : "mixtape"; }
export function sceneById(id: SceneId) { return SCENES.find((scene) => scene.id === id)!; }
export function memorySize(memory: Pick<Memory, "type">) { return memory.type === "image" ? { width: 142, height: 161 } : { width: 205, height: 110 }; }
export function suggestedSpot(memories: Memory[], sceneId: SceneId, type: Memory["type"], parent?: Memory) {
  const size = memorySize({ type }), scene = sceneById(sceneId), target = parent ?? { x: scene.x, y: scene.y };
  const occupied = [...memories.map((memory) => ({ ...memory, ...memorySize(memory) })),
    { x: 300, y: 246, width: 486, height: 237 }, { x: 40, y: 400, width: 270, height: 147 }, { x: 920, y: 300, width: 230, height: 67 }];
  const candidates: { x: number; y: number }[] = [];
  for (let y = 12; y < 720 - size.height - 10; y += 18) for (let x = 12; x < 1200 - size.width - 10; x += 18) candidates.push({ x, y });
  candidates.sort((a, b) => (Math.hypot(a.x - target.x, a.y - target.y) + (sceneForPoint(a.x + size.width / 2) === sceneId ? 0 : 1000)) - (Math.hypot(b.x - target.x, b.y - target.y) + (sceneForPoint(b.x + size.width / 2) === sceneId ? 0 : 1000)));
  return candidates.find((point) => !occupied.some((item) => point.x < item.x + item.width + 12 && point.x + size.width + 12 > item.x && point.y < item.y + item.height + 12 && point.y + size.height + 12 > item.y)) ?? { x: Math.min(970, Math.max(12, target.x + 20)), y: Math.min(580, Math.max(12, target.y + 60)) };
}
