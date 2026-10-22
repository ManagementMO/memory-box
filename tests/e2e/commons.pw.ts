import { expect, test as base } from "@playwright/test";
import { WorldFixture } from "./helpers/open-world-fixture";

const test = base.extend<{ world: WorldFixture }>({
  world: [async ({ page }, use, info) => {
    const fixture = new WorldFixture(info);
    try { await use(fixture); } finally {
      // These cases navigate directly so the admission-failure route can be
      // installed first. Retain only their own completed guest for teardown.
      try { fixture.actors.add(await fixture.actor(page)); } catch { /* Admission never completed. */ }
      await fixture.cleanup();
    }
  }, { auto: true }],
});
test.use({ trace: "off" });

async function browse(page: import("@playwright/test").Page) {
  const direct = page.getByRole("button", { name: "Browse", exact: true });
  if (!await direct.isVisible()) await page.getByRole("button", { name: "Who is here", exact: true }).click();
  await direct.click();
}

async function openSearch(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Find a memory or ask the box", exact: true }).click();
  return page.locator(".panel-search-form textarea");
}

test("explores originals and searches without changing the world", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "The shared Memory Box world" })).toBeVisible();
  await expect(page.locator(".connection-state")).toHaveText("Live", { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await browse(page);
  await expect(page.getByRole("complementary", { name: "Browse", exact: true })).toBeVisible();
  const first = page.locator(".context-panel .memory-result").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole("heading", { name: "Original", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Build on this", exact: true })).toBeAttached();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  const query = await openSearch(page);
  await query.fill("childhood car rides");
  await expect(query).toBeFocused();
  const response = page.waitForResponse((result) => result.url().endsWith("/api/search") && result.request().method() === "POST");
  await page.getByRole("button", { name: "Find memories", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.locator(".search-results .memory-result").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test("public originals remain readable when guest admission fails", async ({ page }) => {
  await page.route("**/auth/v1/signup*", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Guest admission unavailable" }) }));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "The shared Memory Box world" })).toBeVisible();
  await expect(page.locator(".connection-banner")).toContainText("You can explore the commons");
  await browse(page);
  await page.locator(".context-panel .memory-result").first().click();
  await expect(page.locator(".original-title")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("clearing a question rejects a late answer response", async ({ page }) => {
  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const requested = new Promise<void>((resolve) => { started = resolve; });
  await page.route("**/api/ask", async (route) => {
    started();
    await pending;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "keyword", results: [], status: "insufficient", claims: [], sourceVersions: {}, summary: "Synthetic delayed response must stay hidden." }) });
  });
  await page.goto("/");
  await expect(page.locator(".connection-state")).toHaveText("Live", { timeout: 30_000 });
  const input = await openSearch(page);
  await input.fill("A question cleared before completion");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.getByRole("button", { name: "Ask the box", exact: true }).click();
  await requested;
  await expect(page.locator(".search-loading")).toBeVisible();
  await input.fill("");
  const response = page.waitForResponse((result) => result.url().endsWith("/api/ask"));
  release();
  await response;
  await expect(page.locator(".search-invitation")).toBeVisible();
  await expect(page.locator(".search-loading")).toHaveCount(0);
  await expect(page.getByText("Synthetic delayed response must stay hidden.", { exact: true })).toHaveCount(0);
});

test("wandering away from a pending answer preserves the story and camera when it arrives", async ({ page }) => {
  const initial=await page.request.get("/api/world");
  expect(initial.ok()).toBe(true);
  const snapshot=await initial.json() as import("../../src/lib/types").WorldSnapshot;
  expect(snapshot.memories.length).toBeGreaterThan(1);
  let release!:()=>void,started!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const requested=new Promise<void>(resolve=>{started=resolve;});
  await page.route("**/api/ask",async route=>{
    started();await pending;
    await route.fulfill({json:{mode:"keyword",results:snapshot.memories.map(memory=>({memory,score:.03,match:"keyword"})),status:"insufficient",claims:[],sourceVersions:{},summary:"Delayed synthetic response; it must not steal the current story."}});
  });
  await page.goto("/");
  await expect(page.locator(".connection-state")).toHaveText("Live",{timeout:30_000});
  const input=await openSearch(page);
  await input.fill("An answer that arrives after I wander away");
  await page.getByRole("button",{name:"Ask",exact:true}).click();
  await page.getByRole("button",{name:"Ask the box",exact:true}).click();
  await requested;
  await page.getByRole("button",{name:"Wander into a story",exact:true}).click();
  await page.getByRole("button",{name:"Read",exact:true}).click();
  const title=await page.locator(".original-title").textContent();
  const camera=()=>page.locator(".world-board").evaluate(element=>({x:element.getAttribute("data-camera-x"),y:element.getAttribute("data-camera-y"),zoom:element.getAttribute("data-camera-zoom")}));
  const before=await camera();
  const response=page.waitForResponse(result=>new URL(result.url()).pathname==="/api/ask");
  release();await response;
  await expect(page.locator(".original-title")).toHaveText(title!);
  await expect(page.getByRole("complementary",{name:"Original",exact:true})).toBeVisible();
  await expect.poll(camera).toEqual(before);
});
