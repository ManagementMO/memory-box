import type { AnswerResponse, SceneId, SearchResponse } from "../types";
import { AIServiceError, embedText, synthesizeAnswer } from "./ai";
import { getSnapshot, searchMemories } from "./database";
import { sameAnswerEvidence } from "../answer-evidence";

export async function retrieve(query: string, sceneId?: SceneId): Promise<SearchResponse> {
  let embedding: number[] | null = null;
  let notice: string | undefined;
  try { embedding = await embedText(query); }
  catch (error) { notice = error instanceof AIServiceError ? error.message : "Meaning search is temporarily unavailable. These results match the words you used."; }
  const found = await searchMemories(query, embedding, sceneId);
  return {...found, ...(notice ? {notice} : {})};
}

export async function ask(query: string, sceneId?: SceneId): Promise<AnswerResponse> {
  const retrieved = await retrieve(query, sceneId);
  const found = {...retrieved, results:retrieved.results.slice(0,8)};
  const sources = found.results.map(result => result.memory);
  const sourceVersions = Object.fromEntries(sources.map(source => [source.id, source.version]));
  if (!sources.length) return {...found, status:"insufficient", claims:[], summary:"There isn’t enough in the box to answer that yet. Try another phrase, or leave the first memory about it.", sourceVersions};
  let answer: Awaited<ReturnType<typeof synthesizeAnswer>> | undefined;
  let failure: unknown;
  try { answer = await synthesizeAnswer(query, sources); }
  catch (error) { failure = error; }

  // Both successful and failed model calls can finish after an author removes
  // an original. Recheck the result bodies as well as the generated claims.
  // If current eligibility cannot be verified, withhold all delayed originals.
  let results: SearchResponse["results"] = [];
  try {
    const latest = await getSnapshot();
    results = found.results.flatMap(result => {
      const current = latest.memories.find(memory => sameAnswerEvidence(result.memory, memory));
      return current ? [{...result, memory:current}] : [];
    });
  } catch { /* A future request can retry against the current database. */ }
  const currentFound = {...found, results};
  if (results.length !== sources.length) {
    return {...currentFound, status:"unavailable", claims:[], summary:"A source changed or could not be checked while the box was answering. Ask again to use the current originals.", sourceVersions};
  }
  if (failure || !answer) {
    return {...currentFound, status:"unavailable", claims:[], summary:failure instanceof AIServiceError ? failure.message : "The answer could not be completed. You can still explore the originals.", sourceVersions};
  }
  return {...currentFound, ...answer, sourceVersions};
}
