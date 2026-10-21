/** Sparse pilot plane. The entry view is framing, not the write boundary. */
export const GRID_SIZE = 6;
export const ENTRY_WIDTH = 1200;
export const ENTRY_HEIGHT = 720;
export const WORLD_MIN = -60000;
export const WORLD_MAX = 59999;
export const CELL_MIN = -10000;
export const CELL_MAX = 9999;
/** Keep one moderation action small even as the world grows. */
export const CLEAR_MAX_WIDTH = 200;
export const CLEAR_MAX_HEIGHT = 120;

export const isWorldPoint = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= WORLD_MIN && x <= WORLD_MAX && y >= WORLD_MIN && y <= WORLD_MAX;
export const isCellPoint = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= CELL_MIN && x <= CELL_MAX && y >= CELL_MIN && y <= CELL_MAX;

/** Keeps a whole card visible inside the write plane; coordinates are top-left. */
export function clampMemoryPoint(x: number, y: number, size: { width: number; height: number }) {
  return {
    x: Math.max(WORLD_MIN, Math.min(WORLD_MAX + 1 - size.width, Math.round(x))),
    y: Math.max(WORLD_MIN, Math.min(WORLD_MAX + 1 - size.height, Math.round(y))),
  };
}
