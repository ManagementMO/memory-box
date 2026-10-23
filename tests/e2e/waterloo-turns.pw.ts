import { expect, test as base, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Memory, Pixel } from "../../src/lib/types";
import { browserEnabled, cameraState, sameOrigin, WorldFixture, writesEnabled } from "./helpers/open-world-fixture";

const test = base.extend<{ world: WorldFixture }>({
  world: async ({ page: _page }, use, info) => {
    const fixture = new WorldFixture(info);
    try { await use(fixture); } finally { await fixture.cleanup(); }
  },
});
test.skip(!browserEnabled || !writesEnabled, "Set MB_E2E_OPEN_WORLD=1 and MB_E2E_WRITE=1 for disposable real paint-turn verification.");
// Network traces contain the guest bearer and private Realtime handshake.
test.use({ trace: "off" });

interface Timing { serverTime: string; nextPaintAt: string; cooldownSeconds: number }
interface Acceptance extends Timing { status: "accepted"; operationId: string; revision: number }
interface Cooldown extends Timing { status: "cooldown"; code: string; retryAfterMs: number }
interface PaintRequest { opId: string; sceneId?: string; cells: Pixel[] }

const board = (page: Page) => page.getByRole("region", { name: "The shared Memory Box world" });
const bar = (page: Page) => page.locator(".canvas-paint-bar");
const share = (page: Page) => page.getByRole("button", { name: "Share preview pixels", exact: true });
const remaining = (timing: Timing) => Date.parse(timing.nextPaintAt) - Date.parse(timing.serverTime);
const paintPost = (response: { url(): string; request(): { method(): string } }) =>
  new URL(response.url()).pathname === "/api/paint" && response.request().method() === "POST";

async function drawingPoint(page: Page) {
  return board(page).evaluate(element => {
    const box = element.getBoundingClientRect();
    for (const [fx, fy] of [[.5, .32], [.6, .36], [.4, .39], [.7, .3], [.3, .43]]) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      if ([x, x + 18].every(px => {
        const target = document.elementFromPoint(px, y);
        return target && element.contains(target) && !target.closest("input,textarea,select,.canvas-overlay")
          && (!target.closest("button") || !!target.closest(".memory-card"));
      })) return { x, y };
    }
    throw new Error("No visible drawing surface is available for this real gesture.");
  });
}

async function sparseCorner(page: Page, runId: string) {
  const box = await board(page).boundingBox();
  expect(box).not.toBeNull();
  const camera = await cameraState(page);
  const worldX = -25_000 + parseInt(runId.slice(0, 4), 16) % 5_000;
  const worldY = -25_000 + parseInt(runId.slice(4, 8), 16) % 5_000;
  const target = { x: box!.width / 2 - worldX * camera.zoom, y: box!.height / 2 - worldY * camera.zoom };
  let current = camera, scaleX = 1, scaleY = 1;
  // Real wheel gestures, calibrated because Chromium scales mobile deltas.
  for (let attempt = 0; attempt < 4; attempt++) {
    const point = await drawingPoint(page), before = current;
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel((current.x - target.x) * scaleX, (current.y - target.y) * scaleY);
    await expect.poll(async () => {
      const next = await cameraState(page);
      return Math.abs(next.x - before.x) + Math.abs(next.y - before.y) > .1;
    }, { timeout: 3_000 }).toBe(true);
    current = await cameraState(page);
    if (Math.abs(current.x - target.x) < 1 && Math.abs(current.y - target.y) < 1) break;
    if (Math.abs(current.x - before.x) > 1) scaleX = Math.min(10, Math.max(.1, (target.x - before.x) / (current.x - before.x) * scaleX));
    if (Math.abs(current.y - before.y) > 1) scaleY = Math.min(10, Math.max(.1, (target.y - before.y) / (current.y - before.y) * scaleY));
  }
  expect(Math.abs(current.x - target.x)).toBeLessThan(2);
  expect(Math.abs(current.y - target.y)).toBeLessThan(2);
}

async function stagePixel(page: Page, runId: string) {
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-tool", "brush");
  await sparseCorner(page, runId);
  const point = await drawingPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(bar(page).locator(".paint-preview-count")).toContainText("1 pixels");
  return point;
}

test("paint turns survive reload, preserve rejected sketches and leave notes open while another person paints", async ({ page, browser, baseURL, world }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await world.connect(page);
  // This tab uses the same guest without moving its session outside the browser.
  const stale = await page.context().newPage();
  stale.on("pageerror", error => errors.push(error.message));
  await world.connect(stale);
  const visitor = await world.visitor(browser, baseURL!, page);
  visitor.on("pageerror", error => errors.push(error.message));
  expect(await world.actor(stale)).toBe(await world.actor(page));
  expect(await world.actor(visitor)).not.toBe(await world.actor(page));

  let releaseTurnRead!: () => void;
  const turnReadGate = new Promise<void>(resolve => { releaseTurnRead = resolve; });
  let delayedTurnReads = 0, holdTurnReads = true, stalePosts = 0;
  stale.on("request", request => {
    if (new URL(request.url()).pathname === "/api/paint" && request.method() === "POST") stalePosts++;
  });
  // Delay only an actual GET response while a second tab is already ready.
  // This deterministic transport race does not fabricate a timing payload or
  // any POST outcome: acceptance and rejection both use the real server.
  await stale.route("**/api/paint", async route => {
    if (holdTurnReads && route.request().method() === "GET") {
      const response = await route.fetch();
      delayedTurnReads++;
      await turnReadGate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await stagePixel(page, world.runId);
    await stagePixel(stale, world.runId);
    await expect.poll(() => delayedTurnReads).toBeGreaterThan(0);
    await expect(bar(stale)).toHaveAttribute("data-paint-wait", "0");
    await expect(share(stale)).toBeEnabled();

    const acceptedResponse = page.waitForResponse(paintPost);
    await share(page).click();
    const accepted = await acceptedResponse;
    expect(accepted.status()).toBe(200);
    const receipt = await accepted.json() as Acceptance;
    const request = accepted.request().postDataJSON() as PaintRequest;
    expect(receipt.status).toBe("accepted");
    expect(receipt.cooldownSeconds).toBe(15);
    expect(remaining(receipt)).toBeGreaterThan(14_000);
    expect(remaining(receipt)).toBeLessThanOrEqual(15_000);

    const denied = await sameOrigin<Cooldown>(page, "/api/paint", { ...request, opId: randomUUID() });
    expect(denied.status).toBe(429);
    expect(denied.body.code).toBe("paint_cooldown");
    expect(denied.body.nextPaintAt).toBe(receipt.nextPaintAt);
    expect(denied.body.retryAfterMs).toBeGreaterThan(0);
    expect(Math.abs(denied.body.retryAfterMs - remaining(denied.body))).toBeLessThanOrEqual(2);

    const replay = await sameOrigin<Acceptance>(page, "/api/paint", request);
    expect(replay.status).toBe(200);
    expect(replay.body.operationId).toBe(receipt.operationId);
    expect(replay.body.revision).toBe(receipt.revision);
    expect(replay.body.nextPaintAt).toBe(receipt.nextPaintAt);

    const other = await sameOrigin<Acceptance>(visitor, "/api/paint", {
      opId: randomUUID(), sceneId: request.sceneId,
      cells: [{ ...request.cells[0], color: request.cells[0].color === "#E5B4B4" ? "#354FB2" : "#E5B4B4" }],
    });
    expect(other.status).toBe(200);
    expect(other.body.status).toBe("accepted");

    const rejectedResponse = stale.waitForResponse(paintPost);
    await share(stale).click();
    const rejected = await rejectedResponse;
    expect(rejected.status()).toBe(429);
    const cooldown = await rejected.json() as Cooldown;
    expect(cooldown.code).toBe("paint_cooldown");
    expect(Number(await rejected.headerValue("retry-after"))).toBe(Math.max(1, Math.ceil(cooldown.retryAfterMs / 1000)));
    await expect(bar(stale)).toHaveAttribute("data-paint-wait", /^[1-9]\d*$/);
    await expect(share(stale)).toBeDisabled();
    await expect(bar(stale).locator(".paint-preview-count")).toContainText("1 pixels");
    holdTurnReads = false;
    releaseTurnRead();
    // The older ready GET cannot undo a newer rejected save's deadline.
    await expect(bar(stale)).toHaveAttribute("data-paint-wait", /^[1-9]\d*$/);
    await expect(board(stale)).toHaveAttribute("data-tool", "brush");
    // Error feedback can wrap the mobile bar over the previous screen point.
    // Reacquire an actual unobstructed surface after that layout change.
    const nextPoint = await drawingPoint(stale);
    await stale.mouse.click(nextPoint.x + 18, nextPoint.y);
    await expect(bar(stale).locator(".paint-preview-count")).toContainText("2 pixels");
    await expect(share(stale)).toBeDisabled();
    expect(stalePosts).toBe(1);

    await page.reload();
    await expect(page.locator(".connection-state")).toHaveText("Live", { timeout: 30_000 });
    const persisted = await sameOrigin<Timing>(page, "/api/paint", undefined, "GET");
    expect(persisted.status).toBe(200);
    expect(persisted.body.nextPaintAt).toBe(receipt.nextPaintAt);
    expect(Date.parse(persisted.body.serverTime)).toBeGreaterThanOrEqual(Date.parse(receipt.serverTime));
    await page.getByRole("button", { name: "Paint", exact: true }).click();
    // Hosted transport and a reload can outlast the real fifteen-second turn.
    // Persist the exact deadline, and show ready when it has already elapsed.
    const status=page.locator(".paint-turn-status");
    await expect(status.locator("strong")).toHaveText(/^(Next save in [1-9]\d*s|Ready to paint)$/);
    if(remaining(persisted.body)<=0)await expect(status).toHaveAttribute("data-paint-wait","0");

    await page.getByRole("button", { name: "Leave", exact: true }).click();
    const title = "Turn note " + world.runId.slice(0, 8);
    await page.getByRole("textbox", { name: "A title, if you want", exact: true }).fill(title);
    await page.getByRole("textbox", { name: "Your memory or idea", exact: true }).fill("This note is a disposable check that written stories stay open during a shared paint turn.");
    await page.getByRole("button", { name: "Choose its place", exact: true }).click();
    const noteResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/memories" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Leave it here", exact: true }).click();
    const note = await noteResponse;
    expect(note.status()).toBe(201);
    const memory = await note.json() as Memory;
    expect(memory.title).toBe(title);
    const afterNote = await sameOrigin<Timing>(page, "/api/paint", undefined, "GET");
    expect(afterNote.body.nextPaintAt).toBe(receipt.nextPaintAt);
    expect(stalePosts).toBe(1);

    // No saved stroke is scheduled automatically. The actual server duration,
    // not a fake clock, makes this preview eligible for another explicit save.
    await expect(bar(stale)).toHaveAttribute("data-paint-wait", "0", { timeout: 16_000 });
    expect(stalePosts).toBe(1);
    await expect(bar(stale).locator(".paint-preview-count")).toContainText("2 pixels");
    await expect(share(stale)).toBeEnabled();
    const laterResponse = stale.waitForResponse(paintPost);
    await share(stale).click();
    const later = await laterResponse;
    expect(later.status()).toBe(200);
    const laterReceipt = await later.json() as Acceptance;
    expect(laterReceipt.operationId).not.toBe(receipt.operationId);
    expect(laterReceipt.status).toBe("accepted");
    expect(remaining(laterReceipt)).toBeGreaterThan(14_000);
    expect(stalePosts).toBe(2);
    await expect.poll(() => world.operations.size).toBe(3);
    await expect.poll(() => world.memories.has(memory.id)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    holdTurnReads = false;
    releaseTurnRead();
    await stale.close();
  }
});
