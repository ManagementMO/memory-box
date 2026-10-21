import type { Pixel } from "../types";

export interface Camera { x: number; y: number; z: number }
export interface Point { x: number; y: number }
export interface FramePoint extends Point { width?: number; height?: number }
export const MIN_ZOOM = .001;
export const MAX_ZOOM = 6;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function screenToWorld(camera: Camera, point: Point): Point {
  return { x: (point.x - camera.x) / camera.z, y: (point.y - camera.y) / camera.z };
}

export function zoomCameraAt(camera: Camera, multiplier: number, anchor: Point): Camera {
  const world = screenToWorld(camera, anchor), z = clamp(camera.z * multiplier, MIN_ZOOM, MAX_ZOOM);
  return { x: anchor.x - world.x * z, y: anchor.y - world.y * z, z };
}

export function frameCamera(points: FramePoint[], viewport: { width: number; height: number }, options: { padding?: number; minZoom?: number; maxZoom?: number } = {}): Camera {
  if (!points.length) return { x: viewport.width / 2, y: viewport.height / 2, z: 1 };
  const padding = options.padding ?? 40;
  const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
  const right = Math.max(...points.map(p => p.x + (p.width ?? 200))), bottom = Math.max(...points.map(p => p.y + (p.height ?? 120)));
  const z = clamp(Math.min((viewport.width - padding * 2) / Math.max(1, right - left), (viewport.height - padding * 2) / Math.max(1, bottom - top)), options.minZoom ?? MIN_ZOOM, options.maxZoom ?? 1.2);
  return { x: viewport.width / 2 - (left + right) / 2 * z, y: viewport.height / 2 - (top + bottom) / 2 * z, z };
}

/** Integer-cell Bresenham with a strict allocation cap for sparse pointer samples. */
export function rasterLine(from: Point, to: Point, limit = 144): Point[] {
  const cells: Point[] = [];
  let x = Math.round(from.x), y = Math.round(from.y);
  const tx = Math.round(to.x), ty = Math.round(to.y), dx = Math.abs(tx - x), dy = -Math.abs(ty - y), sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
  let error = dx + dy;
  while (cells.length < limit) {
    cells.push({ x, y });
    if (x === tx && y === ty) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return cells;
}

/** Editing a staged cell keeps one record; hitting the cap preserves earlier work. */
export function mergePaintCells(previous: Pixel[], incoming: Pixel[], limit = 144): Pixel[] {
  const cells = new Map(previous.slice(0, limit).map(pixel => [`${pixel.x},${pixel.y}`, { ...pixel }]));
  for (const pixel of incoming) {
    const key = `${pixel.x},${pixel.y}`;
    if (cells.has(key) || cells.size < limit) cells.set(key, { ...pixel });
  }
  return [...cells.values()];
}
