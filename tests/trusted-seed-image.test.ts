import { describe, expect, it } from "vitest";
import { trustedSeedImagePath } from "../src/lib/server/trusted-seed-image";

describe("trusted local starter image indexing", () => {
  const image = { type: "image" as const, imageUrl: "/starter-world/night-train.svg", isSeed: true };
  it("accepts exact first-party legacy and living-world SVG paths only for labeled image seeds", () => {
    expect(trustedSeedImagePath(image)).toBe("starter-world/night-train.svg");
    expect(trustedSeedImagePath({ ...image, imageUrl: "/seed-cassette.svg" })).toBe("seed-cassette.svg");
    expect(trustedSeedImagePath({ ...image, isSeed: false })).toBeNull();
    expect(trustedSeedImagePath({ ...image, type: "text" })).toBeNull();
    expect(trustedSeedImagePath({ ...image, imageUrl: null })).toBeNull();
  });
  it("rejects traversal, encoded or normalized alternatives, remote URLs, queries, fragments, and trailing controls", () => {
    const invalid = [
      "/starter-world/../secret.svg", "/starter-world/%2e%2e/secret.svg", "/starter-world/nested/window.svg",
      "/starter-world//window.svg", "//starter-world/window.svg", "starter-world/window.svg", "/starter-world\\window.svg",
      "/starter-world/window.svg?version=1", "/starter-world/window.svg#image", "/starter-world/window.svg\n", "/starter-world/window.svg\r\n",
      "/starter-world/Window.svg", "/starter-world/window.SVG", "/starter-world/window.png", "/api/assets/2e391fe2-6490-49b9-bb1f-0f40e1d93b11",
      "https://example.com/seed-cassette.svg", "file:///seed-cassette.svg", "/seed-cassette.svg\n", "/seed-../secret.svg",
    ];
    for (const imageUrl of invalid) expect(trustedSeedImagePath({ ...image, imageUrl }), imageUrl).toBeNull();
  });
});
