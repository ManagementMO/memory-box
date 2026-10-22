import { describe, expect, it } from "vitest";
import type { Memory, SearchResponse } from "../src/lib/types";
import { answerSourcesChanged, citedSourceCount, projectSearch } from "../src/lib/client/source-state";

const original = { id: "first", title: "old title", body: "old private text", version: 1 } as Memory;
const result: SearchResponse = { mode: "hybrid", results: [{ memory: original, score: 0.8, match: "both" }] };

describe("current source projection", () => {
  it("never retains a removed or hidden original in search results", () => {
    expect(projectSearch(result, []).results).toEqual([]);
    expect(JSON.stringify(projectSearch(result, []))).not.toContain("old private text");
  });
  it("uses current original text immediately after a version changes", () => {
    const current = { ...original, title: "current title", body: "current text", version: 2 };
    const projected = projectSearch(result, [current]);
    expect(projected.results[0].memory).toBe(current);
    expect(JSON.stringify(projected)).not.toContain("old private text");
    expect(result.results[0].memory.version).toBe(1);
  });
  it("invalidates an answer when any cited source changes or disappears", () => {
    expect(answerSourcesChanged({ first: 1 }, [original])).toBe(false);
    expect(answerSourcesChanged({ first: 1 }, [{ ...original, version: 2 }])).toBe(true);
    expect(answerSourcesChanged({ first: 1 }, [])).toBe(true);
  });
  it("invalidates an open answer when derived image evidence changes at the same source version", () => {
    const source = { ...original, type: "image", imageDescription: "A red bicycle." } as Memory;
    const changed = { ...source, imageDescription: "A blue bicycle." };
    expect(answerSourcesChanged({ first: 1 }, [source], [source])).toBe(false);
    expect(answerSourcesChanged({ first: 1 }, [changed], [source])).toBe(true);
    expect(answerSourcesChanged({ first: 1 }, [{ ...source, indexStatus: "ready" }], [source])).toBe(false);
  });
  it("counts distinct eligible citations, not retrieved candidates", () => {
    expect(citedSourceCount([{ sourceIds: ["first", "first"] }, { sourceIds: ["first", "missing"] }], [original])).toBe(1);
  });
});
