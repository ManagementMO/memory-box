import { memorySize } from "../scenes";
import type { Memory, Pixel } from "../types";
import { GRID_SIZE, isCellPoint, isWorldPoint } from "../world-bounds";

export interface ContributionMark {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: "paint" | "memory";
}

/** Build feedback from accepted cells, never from a pending pointer stroke. */
export function paintContributionMark(operationId: string, cells: readonly Pixel[]): ContributionMark | null {
  if (!operationId.trim() || cells.length === 0 || cells.some(({ x, y }) => !isCellPoint(x, y))) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cell of cells) {
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minY = Math.min(minY, cell.y);
    maxY = Math.max(maxY, cell.y);
  }
  return {
    id: `paint:${operationId}`,
    // Each cell occupies a full GRID_SIZE square, including the last cell.
    x: (minX + maxX + 1) * GRID_SIZE / 2,
    y: (minY + maxY + 1) * GRID_SIZE / 2,
    label: `${cells.length} ${cells.length === 1 ? "pixel" : "pixels"} added`,
    kind: "paint",
  };
}

type PlacedMemory = Pick<Memory, "id" | "version" | "type" | "x" | "y">;

export function memoryContributionMark(memory: PlacedMemory): ContributionMark | null {
  if (!memory.id.trim() || !Number.isInteger(memory.version) || memory.version < 1 || !isWorldPoint(memory.x, memory.y)) return null;
  const label = memory.type === "text" ? "Note added" : memory.type === "image" ? "Photo added" : memory.type === "link" ? "Link added" : null;
  if (!label) return null;
  const size = memorySize(memory);
  return {
    id: `memory:${memory.id}:${memory.version}`,
    x: memory.x + size.width / 2,
    y: memory.y + size.height / 2,
    label,
    kind: "memory",
  };
}
