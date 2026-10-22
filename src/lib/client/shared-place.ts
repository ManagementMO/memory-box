import { WORLD_MAX, WORLD_MIN } from "../world-bounds";
import { MAX_ZOOM, MIN_ZOOM, screenToWorld, type Camera } from "./canvas-geometry";

/** Coordinates describe the public world center, never a screen translation. */
export interface SharedPlace { x: number; y: number; z: number; memoryId?: string }
interface Viewport { width: number; height: number }

const MAX_HASH_LENGTH = 256;
const DECIMAL = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validPlace(place: SharedPlace): boolean {
  return [place.x, place.y, place.z].every(Number.isFinite)
    && place.x >= WORLD_MIN && place.x <= WORLD_MAX
    && place.y >= WORLD_MIN && place.y <= WORLD_MAX
    && place.z >= MIN_ZOOM && place.z <= MAX_ZOOM
    && (place.memoryId === undefined || UUID.test(place.memoryId));
}

function validViewport(viewport: Viewport): boolean {
  return Number.isFinite(viewport.width) && viewport.width > 0
    && Number.isFinite(viewport.height) && viewport.height > 0;
}

/** Reject the entire link if it is ambiguous or malformed, including its original ID. */
export function parseSharedPlace(hash: string): SharedPlace | null {
  if (!hash.startsWith("#") || hash.length > MAX_HASH_LENGTH || hash.length < 2) return null;
  const segments = hash.slice(1).split("&");
  if (segments.some(segment => !segment) || segments.length > 2) return null;
  const params = new URLSearchParams(hash.slice(1));
  const keys = [...params.keys()];
  if (keys.length !== segments.length || keys.some(key => key !== "at" && key !== "memory")) return null;
  if (params.getAll("at").length !== 1 || params.getAll("memory").length > 1) return null;
  const values = params.get("at")!.split(",");
  if (values.length !== 3 || values.some(value => !DECIMAL.test(value))) return null;
  const [x, y, z] = values.map(Number);
  const memoryId = params.get("memory");
  const place: SharedPlace = { x, y, z, ...(memoryId !== null ? { memoryId: memoryId.toLowerCase() } : {}) };
  return validPlace(place) ? place : null;
}

/** A view outside the writable pilot world cannot silently become a different spot. */
export function sharedPlaceFromCamera(camera: Camera & Viewport): SharedPlace | null {
  if (!validViewport(camera) || ![camera.x, camera.y, camera.z].every(Number.isFinite)) return null;
  const center = screenToWorld(camera, { x: camera.width / 2, y: camera.height / 2 });
  const place = { ...center, z: camera.z };
  return validPlace(place) ? place : null;
}

/** Existing originals may extend beyond the write plane; keep their fallback anchor legal. */
export function sharedPlaceForOriginal(original: { id: string; x: number; y: number }, size: Viewport, z: number): SharedPlace | null {
  if (!validViewport(size) || !validPlace({ x: original.x, y: original.y, z, memoryId: original.id })) return null;
  return {
    x: Math.max(WORLD_MIN, Math.min(WORLD_MAX, original.x + size.width / 2)),
    y: Math.max(WORLD_MIN, Math.min(WORLD_MAX, original.y + size.height / 2)),
    z, memoryId: original.id,
  };
}

/** The same center and scale are retained when a desktop invitation opens on a phone. */
export function sharedPlaceCamera(place: SharedPlace, viewport: Viewport): Camera {
  if (!validPlace(place) || !validViewport(viewport)) throw new RangeError("Invalid shared place or viewport.");
  return { x: viewport.width / 2 - place.x * place.z, y: viewport.height / 2 - place.y * place.z, z: place.z };
}

/** Share public location and original identity only; omit queries, credentials and old hashes. */
export function sharedPlaceUrl(baseUrl: string, place: SharedPlace): string {
  if (!validPlace(place)) throw new RangeError("Invalid shared place.");
  const base = new URL(baseUrl);
  if (base.protocol !== "http:" && base.protocol !== "https:") throw new TypeError("A shared place needs an HTTP URL.");
  const url = new URL(base.href);
  url.username = "";
  url.password = "";
  url.search = "";
  const at = [Number(place.x.toFixed(2)), Number(place.y.toFixed(2)), Number(place.z.toFixed(4))].join(",");
  url.hash = `at=${at}${place.memoryId ? `&memory=${place.memoryId.toLowerCase()}` : ""}`;
  return url.href;
}
