import { describe, expect, it } from "vitest";
import { chooseWanderMemory } from "../src/lib/client/story-discovery";
import type { Memory } from "../src/lib/types";

const memory = (id: string) => ({ id } as Memory);
describe("wandering through actual originals", () => {
  it("handles an empty world and a single original", () => {
    expect(chooseWanderMemory([], [], null, 0)).toBeUndefined();
    expect(chooseWanderMemory([memory("a")], ["a"], "a", .9)?.id).toBe("a");
  });
  it("prefers unseen originals and never immediately repeats when another exists", () => {
    const world=[memory("a"), memory("b"), memory("c")];
    expect(chooseWanderMemory(world, ["a", "b"], "b", .9)?.id).toBe("c");
    expect(chooseWanderMemory(world, ["a", "b", "c"], "b", .5)?.id).not.toBe("b");
  });
  it("ignores visits to removed originals and bounds a supplied random value", () => {
    const world=[memory("a"), memory("b")];
    expect(chooseWanderMemory(world, ["removed"], null, 1)?.id).toBe("b");
    expect(chooseWanderMemory(world, [], null, -1)?.id).toBe("a");
  });
});
