import { expect, test as base, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Memory, NewMemory, WorldSnapshot } from "../../src/lib/types";
import { browserEnabled, WorldFixture } from "./helpers/open-world-fixture";

// Only guest admission is real. All memory writes and failure responses below
// are intercepted; synthetic originals never enter the shared database.
const test = base.extend<{ world: WorldFixture }>({
  world: async ({}, use, info) => {
    const fixture = new WorldFixture(info);
    try { await use(fixture); } finally { await fixture.cleanup(); }
  },
});
test.skip(!browserEnabled, "Set MB_E2E_OPEN_WORLD=1 for disposable browser identities.");
test.use({ trace: "off" });

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function fixtureWorld(page: Page, world: WorldFixture) {
  await world.connect(page);
  const snapshot = await world.snapshot(page);
  // Always supersede any real snapshot already in flight.
  snapshot.revision += 100_000;
  const actor = await world.actor(page);
  const memory: Memory = {
    id: randomUUID(), authorId: actor, authorName: "Reliability test guest",
    type: "text", title: "Synthetic reliability original", body: "This exists only in this browser test.",
    url: null, imageUrl: null, imageDescription: null, color: "#FFF0BA", x: 200, y: 200,
    sceneId: "garden", inspiredBy: null, paintOperationId: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    version: 1, indexStatus: "pending", isSeed: false,
  };
  return { snapshot, memory };
}

async function prepareNote(page: Page) {
  await page.getByRole("button", { name: "Leave something", exact: true }).click();
  await page.locator(".composer textarea").fill("A save must keep this draft stable.");
  await page.locator(".composer-title input").fill("Stable draft");
  await page.getByRole("button", { name: "Choose its place", exact: true }).click();
}

test("a pending publish cannot be cancelled or replaced by navigation", async ({ page, world }) => {
  const { snapshot, memory } = await fixtureWorld(page, world);
  await page.route("**/api/world", route => route.fulfill({ json: snapshot }));
  const started = deferred(), release = deferred();
  await page.route("**/api/memories", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    const draft = route.request().postDataJSON() as NewMemory;
    started.resolve();
    await release.promise;
    Object.assign(memory, draft);
    snapshot.memories.push(memory);
    snapshot.revision++;
    await route.fulfill({ status: 201, headers: { "x-memory-box-e2e-synthetic": "1" }, json: memory });
  });
  try {
    await prepareNote(page);
    await page.getByRole("button", { name: "Leave it here", exact: true }).click();
    await started.promise;
    await page.keyboard.press("Escape");
    await page.keyboard.press("/");
    await expect(page.locator(".placement-bar")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel placement" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Who is here", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Find a memory or ask the box" })).toBeDisabled();
    await expect(page.locator(".panel-compose, .panel-search")).toHaveCount(0);
    release.resolve();
    await expect(page.locator(".original-title")).toHaveText("Stable draft");
    await page.getByRole("button", { name: "Leave something", exact: true }).click();
    await expect(page.locator(".composer textarea")).toHaveValue("");
  } finally { release.resolve(); }
});

test("an edit stays frozen until its response, then shows the saved version", async ({ page, world }) => {
  const { snapshot, memory } = await fixtureWorld(page, world);
  snapshot.memories = [memory];
  await page.route("**/api/world", route => route.fulfill({ json: snapshot }));
  await page.reload();
  await expect(page.locator(".connection-state")).toHaveText("Live");
  await page.getByRole("button", { name: "Wander into a story", exact: true }).click();
  await page.getByRole("button", { name: "Edit memory", exact: true }).click();
  await page.locator(".composer textarea").fill("The exact submitted edit.");
  const started = deferred(), release = deferred();
  await page.route(`**/api/memories/${memory.id}`, async route => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const patch = route.request().postDataJSON();
    started.resolve();
    await release.promise;
    Object.assign(memory, patch, { version: 2 });
    snapshot.revision++;
    await route.fulfill({ json: memory, headers: { "x-memory-box-e2e-synthetic": "1" } });
  });
  try {
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await started.promise;
    await page.keyboard.press("Escape");
    await expect(page.locator(".panel-compose")).toBeVisible();
    await expect(page.locator(".composer textarea")).toBeDisabled();
    await expect(page.locator(".composer-title input")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Close panel" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Leave a photo", exact: true })).toBeDisabled();
    release.resolve();
    await expect(page.locator(".panel-inspect")).toContainText("The exact submitted edit.");
  } finally { release.resolve(); }
});

test("a committed save survives a failed refresh without a missing-memory inspector", async ({ page, world }) => {
  const { snapshot, memory } = await fixtureWorld(page, world);
  let unavailable = false;
  await page.route("**/api/world", route => unavailable
    ? route.fulfill({ status: 503, json: { error: "Snapshot temporarily unavailable" } })
    : route.fulfill({ json: snapshot }));
  await page.route("**/api/memories", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    Object.assign(memory, route.request().postDataJSON());
    snapshot.memories = [memory];
    snapshot.revision++;
    unavailable = true;
    await route.fulfill({ status: 201, headers: { "x-memory-box-e2e-synthetic": "1" }, json: memory });
  });
  await prepareNote(page);
  await page.getByRole("button", { name: "Leave it here", exact: true }).click();
  await expect(page.locator(".app-announcement")).toHaveText("Saved. Reconnecting to show it.");
  await expect(page.locator(".panel-inspect, .placement-bar")).toHaveCount(0);
  await expect(page.locator(".connection-banner")).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(page.locator(".connection-state")).toHaveText("Live");
  await page.getByRole("button", { name: "Wander into a story", exact: true }).click();
  await expect(page.locator(".original-title")).toHaveText("Stable draft");
  await page.getByRole("button", { name: "Leave something", exact: true }).click();
  await expect(page.locator(".composer textarea")).toHaveValue("");
});
