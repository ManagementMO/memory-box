import type { Memory } from "./types";

/** Versions fence authored edits; these fields also fence derived descriptions
 * and all source data supplied to evidence selection or used in attribution. */
export function sameAnswerEvidence(previous: Memory, current: Memory): boolean {
  return previous.id === current.id && previous.version === current.version &&
    previous.type === current.type && previous.authorName === current.authorName &&
    previous.title === current.title && previous.body === current.body &&
    (previous.imageDescription ?? null) === (current.imageDescription ?? null) &&
    previous.url === current.url && previous.sceneId === current.sceneId &&
    previous.inspiredBy === current.inspiredBy;
}
