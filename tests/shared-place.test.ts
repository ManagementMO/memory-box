import { describe, expect, it } from "vitest";
import { screenToWorld } from "../src/lib/client/canvas-geometry";
import { parseSharedPlace, sharedPlaceCamera, sharedPlaceFromCamera, sharedPlaceForOriginal, sharedPlaceUrl } from "../src/lib/client/shared-place";

const memoryId = "20000000-0000-4000-8000-000000000001";

describe("public place invitations", () => {
  it("shares an existing edge original even when its card extends beyond the write plane", () => {
    const place = sharedPlaceForOriginal({ id: memoryId, x: 59999, y: 59999 }, { width: 200, height: 150 }, 1.1)!;
    expect(place).toEqual({ x: 59999, y: 59999, z: 1.1, memoryId });
    expect(parseSharedPlace(new URL(sharedPlaceUrl("https://memory.example/", place)).hash)).toEqual(place);
  });

  it("does not manufacture an original link from invalid source coordinates", () => {
    expect(sharedPlaceForOriginal({ id: memoryId, x: Infinity, y: 0 }, { width: 200, height: 150 }, 1)).toBeNull();
    expect(sharedPlaceForOriginal({ id: memoryId, x: 60000, y: 0 }, { width: 200, height: 150 }, 1)).toBeNull();
  });
  it("keeps the same world center and scale from desktop to phone", () => {
    const desktop = { x: -3042.22, y: 562.95, z: 1.7, width: 1440, height: 784 };
    const place = sharedPlaceFromCamera(desktop)!;
    const url = sharedPlaceUrl("https://memory.example/", place);
    const arrival = parseSharedPlace(new URL(url).hash)!;
    for (const viewport of [{ width: 390, height: 739 }, { width: 320, height: 635 }, { width: 1440, height: 784 }]) {
      const camera = sharedPlaceCamera(arrival, viewport);
      const center = screenToWorld(camera, { x: viewport.width / 2, y: viewport.height / 2 });
      expect(center.x).toBeCloseTo(place.x, 2);
      expect(center.y).toBeCloseTo(place.y, 2);
      expect(camera.z).toBe(place.z);
    }
  });

  it("preserves negative coordinates and an optional current-original identity", () => {
    expect(parseSharedPlace(`#at=-60000,59999,0.001&memory=${memoryId}`)).toEqual({ x: -60000, y: 59999, z: .001, memoryId });
    expect(parseSharedPlace("#at=-1.25,-0.5,6")).toEqual({ x: -1.25, y: -.5, z: 6 });
    expect(parseSharedPlace(`#memory=${memoryId}&at=0,0,1`)).toEqual({ x: 0, y: 0, z: 1, memoryId });
  });

  it("makes a stable rounded URL without retaining query, old hash, credentials or extra properties", () => {
    const place = { x: -321.123456, y: 749.876543, z: .7456789, memoryId, draft: "not public", token: "not public" };
    const url = sharedPlaceUrl("https://user:secret@memory.example/canvas/?token=not-public#old", place);
    expect(url).toBe(`https://memory.example/canvas/#at=-321.12,749.88,0.7457&memory=${memoryId}`);
    const parsed = parseSharedPlace(new URL(url).hash)!;
    expect(parsed).toEqual({ x: -321.12, y: 749.88, z: .7457, memoryId });
    expect(sharedPlaceUrl("https://memory.example/canvas/", parsed)).toBe(url);
  });

  it("preserves the base origin even when its path starts with two slashes", () => {
    expect(sharedPlaceUrl("https://memory.example//another.example/canvas?old=yes", { x: 0, y: 0, z: 1 }))
      .toBe("https://memory.example//another.example/canvas#at=0,0,1");
  });

  it.each([
    "", "#", "at=0,0,1", "#something-else", "#memory=" + memoryId,
    "#at=0,0", "#at=0,0,1,2", "#at=,0,1", "#at=0,0,1&", "#at=0,0,1&&",
    "#at=0,0,1&at=1,1,1", "#at=0,0,1&%61t=1,1,1", "#at=0,0,1&other=value",
    "#at=0,0,1&memory=" + memoryId + "&memory=" + memoryId,
    "#at=0,0,1&memory=", "#at=0,0,1&memory=not-an-id", "#at=0,0,1&memory=../../private",
    "#at=0,0,1&memory=20000000-0000-0000-0000-000000000001",
    "#at= 0,0,1", "#at=0,0,1 ", "#at=%200,0,1", "#at=0,+0,1", "#at=0,0,\n1",
    "#at=NaN,0,1", "#at=0,Infinity,1", "#at=0,0,-Infinity", "#at=0x20,0,1", "#at=1e3,0,1",
    "#at=-60000.01,0,1", "#at=0,59999.01,1", "#at=0,0,0", "#at=0,0,-1", "#at=0,0,.0009", "#at=0,0,6.01",
    "#at=%ZZ,0,1", "#at=" + "0".repeat(300) + ",0,1",
  ])("rejects malformed or ambiguous input: %s", hash => {
    expect(parseSharedPlace(hash)).toBeNull();
  });

  it("does not clamp an unshareable camera into an unrelated place", () => {
    expect(sharedPlaceFromCamera({ x: 70000, y: 0, z: 1, width: 390, height: 739 })).toBeNull();
    expect(sharedPlaceFromCamera({ x: 0, y: 0, z: 0, width: 390, height: 739 })).toBeNull();
    expect(sharedPlaceFromCamera({ x: NaN, y: 0, z: 1, width: 390, height: 739 })).toBeNull();
    expect(sharedPlaceFromCamera({ x: 0, y: 0, z: 1, width: 0, height: 739 })).toBeNull();
    expect(sharedPlaceFromCamera({ x: 0, y: 0, z: 1, width: 390, height: Infinity })).toBeNull();
  });

  it("rejects invalid outbound places and unusable viewports", () => {
    expect(() => sharedPlaceUrl("https://memory.example/", { x: Infinity, y: 0, z: 1 })).toThrow(RangeError);
    expect(() => sharedPlaceUrl("https://memory.example/", { x: 0, y: 0, z: 1, memoryId: "<script>" })).toThrow(RangeError);
    expect(() => sharedPlaceUrl("javascript:alert(1)", { x: 0, y: 0, z: 1 })).toThrow(TypeError);
    expect(() => sharedPlaceCamera({ x: 0, y: 0, z: 10 }, { width: 390, height: 739 })).toThrow(RangeError);
    expect(() => sharedPlaceCamera({ x: 0, y: 0, z: 1 }, { width: -1, height: 739 })).toThrow(RangeError);
  });
});
