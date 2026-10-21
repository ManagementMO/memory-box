import { SHAPES, type ShapeId } from "@/lib/scenes";

export function PixelShape({ shape, color = "#354FB2" }: { shape: ShapeId; color?: string }) {
  const rows = SHAPES[shape].rows;
  const palette: Record<string, string> = { a: color, k: "#263633", w: "#FBFCF7", g: "#64936E", y: "#F0DE8E", ".": "transparent" };
  return <span className="pixel-shape" style={{ gridTemplateColumns: `repeat(${rows[0].length}, 1fr)`, gridTemplateRows: `repeat(${rows.length}, 1fr)` }} aria-hidden="true">
    {rows.flatMap((row, y) => [...row].map((cell, x) => <i key={`${x}-${y}`} style={{ background: palette[cell] }} />))}
  </span>;
}
