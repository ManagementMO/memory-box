import { describe, expect, it } from "vitest";
import { memoryContributionMark, paintContributionMark } from "../src/lib/client/contribution-feedback";
import type { Memory, Pixel } from "../src/lib/types";
import { CELL_MAX, CELL_MIN, WORLD_MAX, WORLD_MIN } from "../src/lib/world-bounds";

const pixel = (x: number, y: number): Pixel => ({ x, y, color: "#F5B8D4" });
const memory = { id: "note-one", version: 1, type: "text", x: -250, y: 100 } satisfies Pick<Memory, "id" | "version" | "type" | "x" | "y">;

describe("paint contribution feedback", () => {
  it("centers a single accepted cell and uses the singular label", () => {
    expect(paintContributionMark("accepted-one", [pixel(0, 0)])).toEqual({
      id: "paint:accepted-one", x: 3, y: 3, label: "1 pixel added", kind: "paint",
    });
  });

  it("uses the occupied bounding box rather than averaging an uneven stroke", () => {
    const mark = paintContributionMark("accepted-stroke", [pixel(-4, -3), pixel(-3, -3), pixel(8, 5)]);
    expect(mark).toMatchObject({ x: 15, y: 9, label: "3 pixels added" });
  });

  it("keeps negative cells and both world edges in the correct position", () => {
    expect(paintContributionMark("negative", [pixel(-2, -1)])).toMatchObject({ x: -9, y: -3 });
    expect(paintContributionMark("left", [pixel(CELL_MIN, CELL_MIN)])).toMatchObject({ x: WORLD_MIN + 3, y: WORLD_MIN + 3 });
    expect(paintContributionMark("right", [pixel(CELL_MAX, CELL_MAX)])).toMatchObject({ x: 59997, y: 59997 });
  });

  it("does not mark an empty operation or an invalid set of accepted cells", () => {
    expect(paintContributionMark("accepted", [])).toBeNull();
    expect(paintContributionMark(" ", [pixel(0, 0)])).toBeNull();
    for (const invalid of [pixel(NaN, 0), pixel(0, Infinity), pixel(0.5, 0), pixel(CELL_MAX + 1, 0), pixel(0, CELL_MIN - 1)]) {
      expect(paintContributionMark("accepted", [pixel(0, 0), invalid])).toBeNull();
    }
  });
});

describe("memory contribution feedback", () => {
  it("centers text and link cards and identifies the accepted version", () => {
    expect(memoryContributionMark(memory)).toEqual({ id: "memory:note-one:1", x: -147.5, y: 155, label: "Note added", kind: "memory" });
    expect(memoryContributionMark({ ...memory, type: "link", version: 2 })).toMatchObject({ id: "memory:note-one:2", x: -147.5, y: 155, label: "Link added" });
  });

  it("uses the actual narrower photo-card dimensions", () => {
    expect(memoryContributionMark({ ...memory, type: "image" })).toMatchObject({ x: -179, y: 180.5, label: "Photo added" });
  });

  it("leaves the feedback on a boundary card even when its center extends past the anchor limit", () => {
    expect(memoryContributionMark({ ...memory, x: WORLD_MAX, y: WORLD_MAX })).toMatchObject({ x: WORLD_MAX + 102.5, y: WORLD_MAX + 55 });
    expect(memoryContributionMark({ ...memory, x: WORLD_MIN, y: WORLD_MIN })).toMatchObject({ x: WORLD_MIN + 102.5, y: WORLD_MIN + 55 });
  });

  it("rejects unusable identities, versions and positions", () => {
    for (const invalid of [{ id: " " }, { version: 0 }, { version: 1.5 }, { version: Infinity }, { x: NaN }, { y: Infinity }, { x: 0.5 }, { x: WORLD_MIN - 1 }, { y: WORLD_MAX + 1 }]) {
      expect(memoryContributionMark({ ...memory, ...invalid })).toBeNull();
    }
  });
});
