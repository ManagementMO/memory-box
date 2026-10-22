import type { Memory } from "../types";

/** Local first-party starter art only. Never interpret an upload URL as a path. */
export function trustedSeedImagePath(memory: Pick<Memory, "type" | "imageUrl" | "isSeed">): string | null {
  if (memory.type !== "image" || memory.isSeed !== true || typeof memory.imageUrl !== "string") return null;
  const match = memory.imageUrl.match(/^\/(?:seed-[a-z-]+|starter-world\/[a-z-]+)\.svg$/);
  // JavaScript's `$` may precede a final newline. Require the complete literal URL.
  if (!match || match[0] !== memory.imageUrl) return null;
  return memory.imageUrl.slice(1);
}
