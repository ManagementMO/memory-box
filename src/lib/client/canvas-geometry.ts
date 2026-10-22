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

/** One pass over sparse artwork: no spread allocation as the mosaic grows. */
export function occupiedBounds(points: FramePoint[], pixels: Pixel[], grid = 6): FramePoint | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const include = (x: number, y: number, width: number, height: number) => {
    if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) return;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + width); bottom = Math.max(bottom, y + height);
  };
  for (const point of points) include(point.x, point.y, point.width ?? 200, point.height ?? 120);
  if (Number.isFinite(grid) && grid > 0) for (const pixel of pixels) include(pixel.x * grid, pixel.y * grid, grid, grid);
  return Number.isFinite(left) ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

/** Arrive in an occupied neighborhood; a distant legal mark cannot empty the welcome. */
export function arrivalBounds(points: FramePoint[], pixels: Pixel[], grid = 6): FramePoint | null {
  const hull=occupiedBounds(points,pixels,grid);
  if(!hull || (hull.width!<=6000 && hull.height!<=4500)) return hull;
  const buckets=new Map<string,{x:number;y:number;score:number}>();
  const count=(x:number,y:number,weight:number)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const bx=Math.floor(x/1600),by=Math.floor(y/1200),key=`${bx},${by}`;
    const bucket=buckets.get(key)??{x:bx*1600+800,y:by*1200+600,score:0};bucket.score+=weight;buckets.set(key,bucket);
  };
  for(const p of points)count(p.x+(p.width??200)/2,p.y+(p.height??120)/2,300);
  for(const p of pixels)count(p.x*grid,p.y*grid,1);
  let center:{x:number;y:number;score:number}|undefined;
  for(const bucket of buckets.values())if(!center||bucket.score>center.score)center=bucket;
  if(!center)return hull;
  const near=(x:number,y:number)=>Math.abs(x-center!.x)<=2800&&Math.abs(y-center!.y)<=1900;
  return occupiedBounds(points.filter(p=>near(p.x,p.y)),pixels.filter(p=>near(p.x*grid,p.y*grid)),grid)??hull;
}

/** Originals remain visible beside a floating reader or above a mobile sheet. */
export function storyCamera(points: FramePoint[], viewport: { width: number; height: number }): Camera {
  const readingArea = viewport.width <= 700 ? { width: viewport.width, height: Math.min(280, viewport.height * .44) } : { width: Math.max(280,viewport.width-382),height:viewport.height };
  return frameCamera(points, readingArea, { padding: 28, maxZoom: 1.1 });
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
