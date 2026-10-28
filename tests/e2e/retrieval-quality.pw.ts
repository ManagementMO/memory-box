import { expect, test as base } from "@playwright/test";
import { writeFileSync } from "node:fs";
import cases from "../../scripts/fixtures/retrieval-cases.json";
import { runLiveRetrieval } from "../../scripts/lib/retrieval-runner";
import { validateRetrievalCases } from "../../scripts/lib/retrieval-evaluation";
import { browserEnabled, sameOrigin, WorldFixture } from "./helpers/open-world-fixture";

const test = base.extend<{ world: WorldFixture }>({
  world: async ({ page: _page }, use, info) => {
    const fixture = new WorldFixture(info);
    try { await use(fixture); } finally { await fixture.cleanup(); }
  },
});
test.skip(!browserEnabled || process.env.MB_E2E_RELEVANCE !== "1" || process.env.MB_E2E_AI !== "1",
  "Live starter evaluation requires MB_E2E_OPEN_WORLD=1 MB_E2E_RELEVANCE=1 MB_E2E_AI=1.");
// Actual credentials remain in the isolated browser, including its requests and
// realtime handshake. Reports contain aggregate scores, never the session.
test.use({ trace: "off" });

test("the labelled starter queries exercise live ranking and source-checked answers", async ({ page, baseURL, world }, info) => {
  test.skip(info.project.name !== "desktop", "One bounded provider run; responsive Ask is covered separately.");
  test.setTimeout(240_000);
  await world.connect(page, "/?arrival=inside-world");
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== new URL(baseURL!).origin) throw new Error("Unexpected evaluation origin.");
    if (url.pathname === "/api/world" && init?.method === "GET") {
      return Response.json(await world.snapshot(page));
    }
    if (!["/api/search", "/api/ask"].includes(url.pathname) || init?.method !== "POST" || typeof init.body !== "string") {
      throw new Error("Unexpected evaluation request.");
    }
    const result = await sameOrigin(page, url.pathname, JSON.parse(init.body));
    return Response.json(result.body, { status: result.status });
  };
  const report = await runLiveRetrieval({ origin: new URL(baseURL!).origin,
    // A transport placeholder: the custom fetcher delegates to the supported
    // same-origin test helper, which attaches the actual browser-owned token.
    accessToken: "browser-owned-test-session", cases: validateRetrievalCases(cases), withAnswers: true, fetcher });
  if (process.env.MB_E2E_REVIEW === "1") {
    writeFileSync("auth/retrieval-live-starters.json", JSON.stringify(report, null, 2));
  }
  expect(report.stopped).toBeNull();
  // A starter illustration without a derived visual description is an honest
  // coverage gap, not a successful photo test. Keep it visible in the report.
  for (const skipped of report.skipped) {
    expect(skipped).toEqual({ id: "photo-goose-neckwear", reason: "indexed_image_description_unavailable" });
    info.annotations.push({ type: "coverage-gap", description: `${skipped.id}: ${skipped.reason}` });
  }
  expect(report.scores.length + report.skipped.length).toBe(cases.length);
  expect(report.scores.length).toBeGreaterThanOrEqual(5);
  expect(report.scores.flatMap(score => score.answerChecks)).toEqual([]);
  expect(report.scores.filter(score => score.hitAt5 === false).map(score => score.id)).toEqual([]);
});
