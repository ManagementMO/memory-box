import type { AnswerResponse, Memory, SearchResponse } from "../types";
import { sameAnswerEvidence } from "../answer-evidence";

/** Search snapshots never grant access to an original that has since left the world. */
export function projectSearch<T extends SearchResponse>(data: T, memories: Memory[]): T {
  const current = new Map(memories.map((memory) => [memory.id, memory]));
  return { ...data, results: data.results.flatMap((result) => {
    const memory = current.get(result.memory.id);
    return memory ? [{ ...result, memory }] : [];
  }) };
}

export function answerSourcesChanged(versions: Record<string, number>, memories: Memory[], sources?: Memory[]): boolean {
  const current = new Map(memories.map((memory) => [memory.id, memory]));
  const evidence = sources && new Map(sources.map((memory) => [memory.id, memory]));
  return Object.entries(versions).some(([id, version]) => {
    const memory = current.get(id), original = evidence?.get(id);
    return !memory || memory.version !== version || !!(evidence && (!original || !sameAnswerEvidence(original, memory)));
  });
}

export function citedSourceCount(claims: Pick<AnswerResponse["claims"][number], "sourceIds">[], memories: Memory[]): number {
  const eligible = new Set(memories.map((memory) => memory.id));
  return new Set(claims.flatMap((claim) => claim.sourceIds).filter((id) => eligible.has(id))).size;
}
