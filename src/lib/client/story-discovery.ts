import type { Memory } from "@/lib/types";

/** Serendipity visits stored originals; it never invents content or reorganizes authors' places. */
export function chooseWanderMemory(memories: Memory[], visited: readonly string[], currentId: string | null, random: number = Math.random()): Memory | undefined {
  const others = memories.filter(memory => memory.id !== currentId);
  const pool = others.length ? others : memories;
  const unseen = pool.filter(memory => !visited.includes(memory.id));
  const candidates = unseen.length ? unseen : pool;
  const bounded = Number.isFinite(random) ? Math.max(0, Math.min(.999999999, random)) : 0;
  return candidates[Math.floor(bounded * candidates.length)];
}
