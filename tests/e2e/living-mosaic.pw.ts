import { expect, test as base, type Page } from "@playwright/test";
import { browserEnabled, cameraState, openViewTools, WorldFixture } from "./helpers/open-world-fixture";

const test = base.extend<{ world: WorldFixture }>({
  world: async ({ page: _page }, use, info) => {
    const fixture = new WorldFixture(info);
    try { await use(fixture); } finally { await fixture.cleanup(); }
  },
});
test.skip(!browserEnabled, "Set MB_E2E_OPEN_WORLD=1 for disposable real guest/presence sessions.");
// Browser authentication stays in each isolated context. Never retain a trace
// containing the live JWT or Supabase WebSocket authentication exchange.
test.use({ trace: "off" });

interface CursorHint { sessionId: string; x: number; y: number; color: string; tool: string }
const board = (page: Page) => page.getByRole("region", { name: "The shared Memory Box world" });
const presence = (page: Page) => page.getByRole("button", { name: "Who is here", exact: true });
const hints = (page: Page): Promise<CursorHint[]> => page.locator(".world-cursors").evaluate(element => JSON.parse(element.getAttribute("data-peer-cursors") || "[]"));

async function idleName(page: Page) {
  const label = await page.locator(".profile-button").getAttribute("aria-label");
  expect(label).toMatch(/^Your profile, /);
  return label!.slice("Your profile, ".length);
}

test("actual idle membership becomes a world-aligned cursor across zoom and leaves with its visitor", async ({ page, browser, baseURL, world }) => {
  test.setTimeout(75_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await world.connect(page);
  await expect(presence(page)).toHaveAttribute("data-presence-connected", "true", { timeout: 30_000 });
  const visitor = await world.visitor(browser, baseURL!, page);
  visitor.on("pageerror", error => errors.push(error.message));
  await expect(presence(visitor)).toHaveAttribute("data-presence-connected", "true", { timeout: 30_000 });
  const visitorName = await idleName(visitor);

  // Membership is observable before the second person has ever moved a pointer.
  await presence(page).click();
  const row = page.locator(".presence-visitor").filter({ hasText: visitorName });
  await expect(row).toBeVisible();
  const peerId = await row.getAttribute("data-peer-id");
  expect(peerId).toMatch(/^[a-f0-9-]{36}$/i);
  expect((await hints(page)).some(peer => peer.sessionId === peerId)).toBe(false);
  await page.getByRole("button", { name: "Close panel", exact: true }).click();

  // Different viewport transforms must not move a peer to the same screen pixel.
  await openViewTools(page);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const senderCamera = await cameraState(visitor);
  const receiverCamera = await cameraState(page);
  expect(receiverCamera.zoom).toBeGreaterThan(senderCamera.zoom);
  const senderBox = await board(visitor).boundingBox();
  expect(senderBox).not.toBeNull();
  const point = await board(visitor).evaluate(element => {
    const box=element.getBoundingClientRect();
    for (const [fx,fy] of [[.45,.30],[.55,.35],[.40,.32],[.50,.50],[.30,.55]]) {
      const x=box.x+box.width*fx,y=box.y+box.height*fy,target=document.elementFromPoint(x,y);
      if (target && element.contains(target) && !target.closest("input,textarea,select,.canvas-overlay")
        && (!target.closest("button") || !!target.closest(".memory-card"))) return {x,y};
    }
    throw new Error("No world or paper surface is available for the real cursor gesture.");
  });
  const expected = {
    x: Math.round((point.x - senderBox!.x - senderCamera.x) / senderCamera.zoom),
    y: Math.round((point.y - senderBox!.y - senderCamera.y) / senderCamera.zoom),
  };
  await visitor.mouse.move(point.x, point.y);
  await expect.poll(async () => {
    const peer = (await hints(page)).find(peer => peer.sessionId === peerId);
    return peer ? Math.abs(peer.x - expected.x) + Math.abs(peer.y - expected.y) : Infinity;
  }, { timeout: 12_000 }).toBeLessThanOrEqual(2);

  // Check the painted cursor layer, not just arrival of metadata. The sample
  // lies inside its pointer shape after projecting the received world point.
  await expect.poll(() => page.locator(".world-cursors").evaluate((element, peerId) => {
    const canvas = element as HTMLCanvasElement, parent = element.closest(".world-board") as HTMLElement;
    const peer = (JSON.parse(element.getAttribute("data-peer-cursors") || "[]") as CursorHint[]).find(peer => peer.sessionId === peerId);
    if (!peer) return false;
    const scale = canvas.width / canvas.clientWidth, zoom = Number(parent.dataset.cameraZoom);
    const x = (peer.x * zoom + Number(parent.dataset.cameraX) + 4) * scale;
    const y = (peer.y * zoom + Number(parent.dataset.cameraY) + 10) * scale;
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
    const color = canvas.getContext("2d")!.getImageData(Math.floor(x),Math.floor(y),1,1).data;
    return [1,3,5].every((offset,index) => Math.abs(color[index] - parseInt(peer.color.slice(offset,offset+2),16)) < 8) && color[3] > 240;
  }, peerId), { timeout: 8_000 }).toBe(true);

  await visitor.close();
  await expect.poll(async () => (await hints(page)).some(peer => peer.sessionId === peerId), { timeout: 12_000 }).toBe(false);
  await presence(page).click();
  await expect(page.locator(`.presence-visitor[data-peer-id="${peerId}"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("wandering reaches stored originals and a paper supports drag, click and keyboard activation", async ({ page, world }) => {
  await world.connect(page);
  const originals = (await world.snapshot(page)).memories;
  expect(originals.length).toBeGreaterThan(1);
  const wander = page.getByRole("button", { name: "Wander into a story", exact: true });
  await wander.click();
  const selected = page.locator(".memory-card.is-selected");
  await expect(selected).toHaveCount(1);
  const firstId = await selected.getAttribute("data-memory-id");
  const first = originals.find(memory => memory.id === firstId);
  expect(first).toBeDefined();
  await expect(page.getByRole("region",{name:"Story preview",exact:true})).toHaveAttribute("data-story-id",firstId!);
  await expect(page.locator(".panel-inspect")).toHaveCount(0);
  await wander.click();
  await expect(selected).not.toHaveAttribute("data-memory-id", firstId!);
  const id = await selected.getAttribute("data-memory-id");
  await page.getByRole("button", { name: "Close story preview", exact: true }).click();
  const card = page.locator(`.memory-card[data-memory-id="${id}"]`);
  await expect(card).toBeInViewport();
  const point = await card.boundingBox();
  expect(point).not.toBeNull();
  const before = await cameraState(page);
  const start = {x:point!.x + point!.width / 2,y:point!.y + point!.height / 2};
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.mouse.move(start.x+42,start.y+21,{steps:5});
  await page.mouse.up();
  await expect(page.locator(".context-panel")).toHaveCount(0);
  const after = await cameraState(page);
  expect(Math.abs(after.x - before.x - 42)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y - 21)).toBeLessThan(2);
  await card.click();
  await expect(page.getByRole("region",{name:"Story preview",exact:true})).toBeVisible();
  await expect(page.locator(".context-panel")).toHaveCount(0);
  await expect(selected).toHaveAttribute("data-memory-id", id!);
  await page.getByRole("button", { name: "Close story preview", exact: true }).click();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(selected).toHaveAttribute("data-memory-id", id!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
