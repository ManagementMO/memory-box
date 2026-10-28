import type {WorldSnapshot} from "../types";

export interface WorldSnapshotReceipt { snapshot: WorldSnapshot; etag: string | null }

function validator(value: string | null): string | null {
  return value && /^(?:W\/)?"[\x21\x23-\x7e]{1,200}"$/.test(value) ? value : null;
}

function isSnapshot(value: unknown): value is WorldSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as WorldSnapshot;
  return typeof snapshot.worldId === "string" && snapshot.worldId.length > 0 &&
    Number.isSafeInteger(snapshot.epoch) && snapshot.epoch >= 1 &&
    Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0 &&
    Array.isArray(snapshot.pixels) && Array.isArray(snapshot.memories) && Array.isArray(snapshot.events);
}

/** The receipt belongs to one hook instance. No browser cache or shared mutable
 * transport state can pair another generation's validator with this body. */
export async function fetchWorldSnapshot(previous: WorldSnapshotReceipt | null, options: Pick<RequestInit,"signal"> = {}): Promise<WorldSnapshotReceipt> {
  const etag = validator(previous?.etag ?? null);
  const response = await fetch("/api/world", {
    ...options, cache: "no-store", headers: etag ? { "If-None-Match": etag } : {},
  });
  options.signal?.throwIfAborted();
  if (response.status === 304) {
    const received = validator(response.headers.get("ETag"));
    if (!previous || !etag || !received || received.replace(/^W\//, "") !== etag.replace(/^W\//, "")) {
      throw new Error("The world snapshot could not be validated. Try reconnecting.");
    }
    return previous;
  }
  const payload: unknown = await response.json().catch(() => null);
  options.signal?.throwIfAborted();
  if (!response.ok) {
    const error = payload as { error?: unknown } | null;
    throw new Error(typeof error?.error === "string" ? error.error : "The world couldn’t be loaded. Please try again.");
  }
  if (!isSnapshot(payload)) throw new Error("The world snapshot could not be read. Try reconnecting.");
  return { snapshot: payload, etag: validator(response.headers.get("ETag")) };
}
