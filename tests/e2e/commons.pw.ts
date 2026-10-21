import { expect, test } from "@playwright/test";

test("explores originals and searches without changing the world", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "The shared Memory Box world" })).toBeVisible();
  await expect(page.locator(".connection-state")).toHaveText("Live", { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "The memory shelf" })).toBeVisible();
  const first = page.locator(".context-panel .memory-result").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole("heading", { name: "Original memory", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Build on this", exact: true })).toBeAttached();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  const query = page.getByRole("textbox", { name: "Find a memory or ask the box", exact: true });
  await query.fill("childhood car rides");
  await expect(query).toBeFocused();
  const response = page.waitForResponse((result) => result.url().endsWith("/api/search") && result.request().method() === "POST");
  await page.getByRole("button", { name: "Search or ask", exact: true }).click();
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
  await page.getByRole("button", { name: "Browse", exact: true }).click();
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
  const input = page.getByRole("textbox", { name: "Find a memory or ask the box", exact: true });
  await input.fill("A question cleared before completion");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
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
