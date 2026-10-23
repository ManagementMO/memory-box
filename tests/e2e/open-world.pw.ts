import { expect, test as base, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { AnswerResponse, Memory, SearchResponse, WorldSnapshot } from "../../src/lib/types";
import { browserEnabled, cameraState, sameOrigin, WorldFixture, writesEnabled } from "./helpers/open-world-fixture";

// Opt-in only. Even UI-only cases create disposable real guest identities.
// MB_E2E_OPEN_WORLD=1 enables navigation with synthetic Find/Ask responses.
// MB_E2E_WRITE=1 additionally permits real publish/upload/paint transactions.
// MB_E2E_AI=1 additionally permits one real answer request per browser project.
const test = base.extend<{ world: WorldFixture }>({
  world: async ({ page }, use, info) => {
    const fixture = new WorldFixture(info);
    const connectionResponses: Array<{ path: string; status: number; code: string | null }> = [];
    page.on("request", request => {
      const path=new URL(request.url()).pathname;
      if (path==="/auth/v1/signup") connectionResponses.push({path,status:-1,code:"requested"});
    });
    page.on("requestfailed", request => {
      const path=new URL(request.url()).pathname;
      if (["/auth/v1/signup", "/api/world"].includes(path)) connectionResponses.push({path,status:0,code:request.failure()?.errorText?.slice(0,100)??null});
    });
    page.on("response", async response => {
      const path=new URL(response.url()).pathname;
      if (!["/auth/v1/signup", "/api/world"].includes(path)) return;
      if (response.ok()) { connectionResponses.push({path,status:response.status(),code:null});return; }
      const body=await response.json().catch(()=>({})),value=body.error_code ?? body.code;
      connectionResponses.push({path,status:response.status(),code:typeof value === "string" ? value.slice(0,100) : null});
    });
    try { await use(fixture); } finally {
      if (info.status !== info.expectedStatus && connectionResponses.length) {
        console.info("Safe connection diagnostics:",JSON.stringify(connectionResponses));
        await info.attach("connection-status.json", {body:Buffer.from(JSON.stringify(connectionResponses)),contentType:"application/json"});
      }
      await fixture.cleanup();
    }
  },
});
test.skip(!browserEnabled, "Set MB_E2E_OPEN_WORLD=1 only after coordinating the disposable pilot run.");
// Authenticated network traces contain bearer headers; keep credentials out of artifacts.
test.use({ trace: "off" });

const viewport = (page: Page) => page.getByRole("region", { name: "The shared Memory Box world" });
const panel = (page: Page) => page.locator(".context-panel");
const quoteRegex = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

async function readMemory(page: Page, memory: Pick<Memory, "title">) {
  const browse = page.getByRole("button", { name: "Browse", exact: true });
  if (!await browse.isVisible()) await page.getByRole("button", { name: "Who is here", exact: true }).click();
  await browse.click();
  await page.locator(".context-panel .memory-result").filter({ hasText: memory.title }).click();
  await expect(page.locator(".original-title")).toHaveText(memory.title);
}

async function submitFind(page: Page, query: string) {
  await page.getByRole("button", { name: "Find a memory or ask the box", exact: true }).click();
  await page.getByRole("textbox", { name: "Search memories", exact: true }).fill(query);
  await page.getByRole("button", { name: "Find memories", exact: true }).click();
}

async function expectCamera(page: Page, expected: Awaited<ReturnType<typeof cameraState>>) {
  await expect.poll(async () => {
    const actual = await cameraState(page);
    return Math.abs(actual.x - expected.x) < 1 && Math.abs(actual.y - expected.y) < 1 && Math.abs(actual.zoom - expected.zoom) < .001;
  }).toBe(true);
}

async function worldPoint(page: Page, radius = 18) {
  await viewport(page).scrollIntoViewIfNeeded();
  return viewport(page).evaluate((element, radius) => {
    const rect = element.getBoundingClientRect();
    for (const [fx, fy] of [[.55, .48], [.5, .35], [.5, .6], [.7, .4], [.3, .5]]) {
      const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
      if ([x - radius, x, x + radius].every(px => {
        const target = document.elementFromPoint(px, y);
        return px > 0 && px < innerWidth && y > 0 && y < innerHeight && target && element.contains(target)
          && !target.closest("input,textarea,select,.canvas-overlay")
          && (!target.closest("button") || !!target.closest(".memory-card"));
      })) return { x, y };
    }
    throw new Error("No unobstructed visible part of the shared world is available for the gesture.");
  }, radius);
}

async function wanderToFixture(page: Page, runId: string) {
  // Exercise the real wheel pan into a per-run sparse area, away from the entry
  // artwork. The fixture still restores only its own later revisions in teardown.
  const point = await worldPoint(page, 0);
  const camera = await cameraState(page);
  const box = await viewport(page).boundingBox();
  expect(box).not.toBeNull();
  const worldX = -30_000 + parseInt(runId.slice(0, 4), 16) % 20_000;
  const worldY = -30_000 + parseInt(runId.slice(4, 8), 16) % 20_000;
  const target = { x: box!.width / 2 - worldX * camera.zoom, y: box!.height / 2 - worldY * camera.zoom, zoom: camera.zoom };
  let current = camera, scaleX = 1, scaleY = 1;
  // Chromium mobile emulation can scale wheel deltas. Calibrate against the
  // rendered camera instead of assuming desktop input units or changing state
  // through an application test hook.
  for (let attempt = 0; attempt < 4; attempt++) {
    const visible = attempt === 0 ? point : await worldPoint(page, 0);
    await page.mouse.move(visible.x, visible.y);
    await page.mouse.wheel((current.x - target.x) * scaleX, (current.y - target.y) * scaleY);
    const before = current;
    await expect.poll(async () => {
      const next = await cameraState(page);
      return Math.abs(next.x - before.x) + Math.abs(next.y - before.y) > .1;
    }, { timeout: 3_000 }).toBe(true);
    current = await cameraState(page);
    if (Math.abs(current.x - target.x) < 1 && Math.abs(current.y - target.y) < 1) break;
    if (Math.abs(current.x - before.x) > 1) scaleX = Math.min(10, Math.max(.1, (target.x - before.x) / (current.x - before.x) * scaleX));
    if (Math.abs(current.y - before.y) > 1) scaleY = Math.min(10, Math.max(.1, (target.y - before.y) / (current.y - before.y) * scaleY));
  }
  await expectCamera(page, target);
}

async function publishDraft(page: Page): Promise<Memory> {
  await panel(page).getByRole("button", { name: "Choose its place", exact: true }).click();
  const accepted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/memories" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Leave it here", exact: true }).click();
  const response = await accepted;
  expect(response.status()).toBe(201);
  const memory = await response.json() as Memory;
  if(memory.inspiredBy)await page.getByRole("button",{name:"Read",exact:true}).click();
  await expect(page.locator(".original-title")).toHaveText(memory.title || memory.body.slice(0, 72));
  return memory;
}

async function expectRenderedPixel(page: Page, cell: { x: number; y: number; color: string }, gridSize: number) {
  const toggle=page.getByRole("button",{name:"View controls",exact:true});
  if(await toggle.isVisible()&&await toggle.getAttribute("aria-expanded")==="false")await toggle.click();
  // Entry now fits actual occupied originals, including another parallel
  // fixture's distant place. An individual 6px cell is intentionally subpixel
  // at that scale; use the real zoom controls before judging its raster color.
  for (let step=0; step<30 && (await cameraState(page)).zoom<1; step++) {
    await page.getByRole("button", {name:"Zoom in",exact:true}).click();
  }
  expect((await cameraState(page)).zoom).toBeGreaterThanOrEqual(1);
  const expected = [1, 3, 5].map(offset => parseInt(cell.color.slice(offset, offset + 2), 16));
  await expect.poll(() => page.locator(".world-pixels").evaluate((element, { cell, gridSize }) => {
    const canvas = element as HTMLCanvasElement;
    const world = canvas.closest(".world-board")! as HTMLElement;
    const zoom = Number(world.dataset.cameraZoom);
    const x = (Number(world.dataset.cameraX) + (cell.x + .5) * gridSize * zoom) * canvas.width / canvas.clientWidth;
    const y = (Number(world.dataset.cameraY) + (cell.y + .5) * gridSize * zoom) * canvas.height / canvas.clientHeight;
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
    return [...canvas.getContext("2d")!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(0, 3);
  }, { cell, gridSize }), { timeout: 8_000 }).toEqual(expected);
}

function changedRevisions(page: Page) {
  const revisions: number[] = [];
  page.on("websocket", socket => socket.on("framereceived", frame => {
    try {
      let notice: { revision?: number } | null = null;
      if (typeof frame.payload === "string") {
        const packet = JSON.parse(frame.payload);
        // Phoenix v2 uses a tuple; v1 uses a JSON object.
        const event = Array.isArray(packet) ? packet[3] : packet.event;
        const payload = Array.isArray(packet) ? packet[4] : packet.payload;
        if (event === "broadcast" && payload?.event === "changed") notice = payload.payload;
      } else if (frame.payload.length >= 5 && frame.payload[0] === 4 && frame.payload[4] === 1) {
        // Current @supabase/realtime-js serializer's JSON user-broadcast frame:
        // kind/topic-length/event-length/metadata-length/encoding, then UTF-8.
        const bytes = frame.payload;
        const eventStart = 5 + bytes[1], payloadStart = eventStart + bytes[2] + bytes[3];
        const event = bytes.subarray(eventStart, eventStart + bytes[2]).toString("utf8");
        if (event === "changed") notice = JSON.parse(bytes.subarray(payloadStart).toString("utf8"));
      }
      if (typeof notice?.revision === "number") revisions.push(notice.revision);
    } catch { /* Heartbeats and unrelated transport frames are not evidence. */ }
  }));
  return revisions;
}

async function scrollState(page: Page) {
  return page.locator(".context-panel").evaluate(element => ({ panel: element.scrollTop, window: window.scrollY }));
}

async function expectScroll(page: Page, expected: Awaited<ReturnType<typeof scrollState>>) {
  await expect.poll(async () => {
    const actual = await scrollState(page);
    return Math.abs(actual.panel - expected.panel) <= 2 && Math.abs(actual.window - expected.window) <= 2;
  }).toBe(true);
}

test("Find and cited Ask preserve the original, query and camera on source return", async ({ page, world }, info) => {
  const response = await page.request.get("/api/world");
  expect(response.ok()).toBe(true);
  const current = await response.json() as WorldSnapshot;
  const text = current.memories.filter(memory => memory.isSeed && memory.type === "text").slice(0, 2);
  expect(text).toHaveLength(2);
  // All source IDs/versions/bodies stay real. Only two local response coordinates
  // are synthetic, placed at valid opposite edges to exercise extreme framing.
  const moved = new Map([[text[0].id, { x: -59_000, y: -59_000 }], [text[1].id, { x: 59_000, y: 59_000 }]]);
  const snapshot: WorldSnapshot = { ...current, memories: current.memories.map(memory => ({ ...memory, ...moved.get(memory.id) })) };
  const sources = [snapshot.memories.find(memory => memory.id === text[0].id)!,
    ...snapshot.memories.filter(memory => !moved.has(memory.id)),
    snapshot.memories.find(memory => memory.id === text[1].id)!];
  expect(sources.length).toBeGreaterThanOrEqual(8);
  await page.route("**/api/world", route => route.fulfill({ json: snapshot }));
  await world.connect(page);
  const results: SearchResponse = { mode: "hybrid", results: sources.map(memory => ({ memory, score: .03, match: "semantic" })) };
  const explanation = "This deliberately long synthetic paragraph places its citation below the initial view, so returning must preserve the reader’s actual scroll position. ";
  const answer: AnswerResponse = { ...results, status: "answered", claims: [
    { text: `Synthetic browser fixture: this original can be read in its author’s own words. ${explanation.repeat(2)}`, sourceIds: [sources[0].id] },
    { text: `A second synthetic interpretation still has to lead to its exact independent original. ${explanation.repeat(2)}`, sourceIds: [sources.at(-1)!.id] },
  ],
    summary: "Synthetic UI transport fixture, not provider evidence.", sourceVersions: Object.fromEntries(sources.map(source => [source.id, source.version])) };
  let searches = 0, answers = 0;
  await page.route("**/api/search", route => { searches++; return route.fulfill({ json: results }); });
  await page.route("**/api/ask", route => { answers++; return route.fulfill({ json: answer }); });
  const query = "A UI fixture about memories kept by two people";
  await submitFind(page, query);
  await expect(panel(page).locator(".memory-result")).toHaveCount(sources.length);
  if (info.project.name === "mobile") await expect(panel(page).locator(".memory-result").first()).toBeInViewport();
  const findCamera = await cameraState(page);
  await panel(page).getByRole("button", { name: "Show on canvas", exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".memory-card .memory-number")).toHaveCount(sources.length);
  await expect(page.locator(".world-transformed")).toHaveAttribute("data-map", "true");
  expect((await cameraState(page)).zoom).toBeLessThan(.15);
  const frame = await viewport(page).boundingBox();
  for (const memory of [sources[0], sources.at(-1)!]) {
    const card = page.locator(".world-transformed").getByRole("button", { name: quoteRegex(memory.title) });
    await expect(card).toBeInViewport();
    // Papers keep their spatial scale; the result marker is the accessible
    // screen-sized target when a search spans the full signed plane.
    const bounds = await card.locator(".memory-number").boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(20);
    expect(bounds!.x + bounds!.width / 2).toBeGreaterThanOrEqual(frame!.x);
    expect(bounds!.x + bounds!.width / 2).toBeLessThanOrEqual(frame!.x + frame!.width);
    expect(bounds!.y + bounds!.height / 2).toBeGreaterThanOrEqual(frame!.y);
    expect(bounds!.y + bounds!.height / 2).toBeLessThanOrEqual(frame!.y + frame!.height);
  }
  await page.getByRole("button", { name: "Back to results", exact: true }).click();
  await expectCamera(page, findCamera);
  const lastResult = panel(page).locator(".memory-result").last();
  await lastResult.scrollIntoViewIfNeeded();
  const findScroll = await scrollState(page);
  expect(findScroll.panel).toBeGreaterThan(100);
  await lastResult.click();
  await expect(page.locator(".original-body")).toHaveText(sources.at(-1)!.body);
  if (info.project.name === "mobile") await expect(panel(page).getByRole("heading", { name: "Original", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Show in canvas", exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Back to results", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search memories", exact: true })).toHaveValue(query);
  await expectCamera(page, findCamera);
  await expectScroll(page, findScroll);
  await expect(panel(page).locator(".memory-result").last()).toBeFocused();
  expect(searches).toBe(1);

  await page.getByRole("button", { name: "Ask", exact: true }).click();
  expect(answers).toBe(0); // Intent selection must not spend a model request.
  await panel(page).getByRole("button", { name: "Ask the box", exact: true }).click();
  await expect(page.locator(".answer-box")).toContainText("Synthetic browser fixture");
  await expect(page.locator(".answer-label")).toContainText("Based on 2 contributions");
  if (info.project.name === "mobile") await expect(page.locator(".answer-box")).toBeInViewport();
  const askCamera = await cameraState(page);
  const citation = page.getByRole("button", { name: `Open source ${sources.length}`, exact: true });
  await citation.scrollIntoViewIfNeeded();
  const askScroll = await scrollState(page);
  // Restore a genuine scroll offset without depending on panel typography.
  expect(askScroll.panel).toBeGreaterThan(0);
  await citation.click();
  await expect(page.locator(".original-body")).toHaveText(sources.at(-1)!.body);
  if (info.project.name === "mobile") await expect(panel(page).getByRole("heading", { name: "Original", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Show in canvas", exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Back to answer", exact: true }).click();
  await expectCamera(page, askCamera);
  await expectScroll(page, askScroll);
  await expect(citation).toBeFocused();
  await expect(citation).toBeInViewport();
  expect(answers).toBe(1);
});

test("brush and mobile pinch remain previews, and a cancelled placement retains the draft", async ({ page, world, context }, info) => {
  await world.connect(page);
  let writes = 0;
  await page.route(/\/api\/(paint|memories|uploads)(\/|$)/, route => {
    // Turn availability is a GET. Count only mutation attempts as writes.
    if (route.request().method() === "GET") return route.continue();
    writes++; return route.abort();
  });
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await expect(page.getByRole("button", { name: "Paint", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(viewport(page)).toHaveAttribute("data-tool", "brush");
  await panel(page).getByRole("button", { name: "Draw pixels", exact: true }).click();
  await expect(viewport(page)).toHaveAttribute("data-tool", "brush");
  await expect(page.locator(".canvas-paint-bar")).toHaveCount(0);
  const point = await worldPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 18, point.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".paint-preview-count").first()).toContainText(/[1-9]/);
  await expect(page.locator(".canvas-paint-bar")).toBeVisible();
  await expect(page.locator(".contribution-mark")).toHaveCount(0);
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Clear preview", exact: true }).first().click();
  await expect(page.locator(".paint-preview-count").first()).toContainText(/^0\b/);
  await expect(page.locator(".canvas-paint-bar")).toHaveCount(0);
  await page.getByRole("button", { name: "Close panel", exact: true }).click();

  const wheelPoint = await worldPoint(page, 0);
  const wheelBox = await viewport(page).boundingBox();
  const wheelBefore = await cameraState(page);
  const anchor = { x: (wheelPoint.x - wheelBox!.x - wheelBefore.x) / wheelBefore.zoom, y: (wheelPoint.y - wheelBox!.y - wheelBefore.y) / wheelBefore.zoom };
  await page.mouse.move(wheelPoint.x, wheelPoint.y);
  await page.keyboard.down("Control");
  try { await page.mouse.wheel(0, -60); } finally { await page.keyboard.up("Control"); }
  await expect.poll(async () => (await cameraState(page)).zoom).toBeGreaterThan(wheelBefore.zoom);
  const wheelAfter = await cameraState(page);
  // Browser pointer events quantize subpixel client positions. Keep the anchor
  // within one CSS pixel while rejecting a zoom around the viewport center.
  expect(Math.abs((wheelPoint.x - wheelBox!.x - wheelAfter.x) / wheelAfter.zoom - anchor.x) * wheelAfter.zoom).toBeLessThan(1);
  expect(Math.abs((wheelPoint.y - wheelBox!.y - wheelAfter.y) / wheelAfter.zoom - anchor.y) * wheelAfter.zoom).toBeLessThan(1);
  expect(writes).toBe(0);

  if (info.project.name === "mobile") {
    const { x, y } = await worldPoint(page, 75);
    const before = await cameraState(page);
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: x - 30, y }, { id: 2, x: x + 30, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: x - 75, y }, { id: 2, x: x + 75, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await cameraState(page)).zoom).toBeGreaterThan(before.zoom);
    expect(writes).toBe(0);
    await session.detach();
  }

  await page.getByRole("button", { name: "Leave something", exact: true }).click();
  const draft = "A recoverable unpublished draft from the browser test.";
  await page.locator(".composer textarea").fill(draft);
  await expect(page.getByRole("button", { name: "Leave", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(viewport(page)).toHaveAttribute("data-tool", "hand");
  await panel(page).getByRole("button", { name: "Choose its place", exact: true }).click();
  await page.getByRole("button", { name: "Cancel placement", exact: true }).click();
  await expect(page.locator(".composer textarea")).toHaveValue(draft);
  expect(writes).toBe(0);
  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  if (width.document > width.viewport) {
    const offenders = await page.evaluate(() => [...document.querySelectorAll("body *")].flatMap(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return rect.right > innerWidth + 1 && !element.closest(".world-board") && style.position !== "absolute"
        ? [{ tag: element.tagName, class: element.getAttribute("class"), left: rect.left, right: rect.right, width: rect.width, display: style.display, overflow: style.overflow }]
        : [];
    }).slice(0, 25));
    await test.info().attach("horizontal-overflow.json", { body: Buffer.from(JSON.stringify({ ...width, offenders }, null, 2)), contentType: "application/json" });
  }
  // A newly mounted side panel can start at its 7px entrance transform. Judge
  // the settled layout instead of the animation's first frame.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
    message: `Horizontal layout overflow: ${JSON.stringify(width)}`,
  }).toBeLessThanOrEqual(width.viewport);

  // A synthetic local publication exercises draft state after success without
  // creating another hosted original or paying for another indexing job.
  const initialWorld = await world.snapshot(page);
  const parent = initialWorld.memories.find(memory => memory.isSeed && memory.type === "text")!;
  await readMemory(page, parent);
  await page.getByRole("button", { name: "Build on this", exact: true }).click();
  const responseDraft = "My independent unpublished response survives looking back at its original.";
  await page.locator(".composer textarea").fill(responseDraft);
  await panel(page).locator(".lineage").getByRole("button").click();
  await expect(page.locator(".original-title")).toHaveText(parent.title);
  await expect(page.getByRole("button", { name: "Back to your draft", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leave something", exact: true }).click();
  await expect(page.locator(".composer textarea")).toHaveValue(responseDraft);
  await expect(panel(page).locator(".lineage")).toContainText(parent.title);
  let syntheticWorld = initialWorld, syntheticPublishes = 0;
  const actor = await world.actor(page);
  await page.route("**/api/world", route => route.fulfill({ json: syntheticWorld }));
  await page.route("**/api/memories", async route => {
    syntheticPublishes++;
    const input = route.request().postDataJSON();
    const now = new Date().toISOString();
    const memory: Memory = { ...parent, id: randomUUID(), authorId: actor, authorName: "UI fixture",
      type: "text", title: "", body: input.body, color: input.color, x: input.x, y: input.y, sceneId: input.sceneId,
      inspiredBy: input.inspiredBy, isSeed: false, version: 1, indexStatus: "ready", createdAt: now, updatedAt: now,
      imageUrl: null, imageDescription: null, url: null, paintOperationId: null };
    syntheticWorld = { ...initialWorld, revision: initialWorld.revision + 1, memories: [...initialWorld.memories, memory] };
    await route.fulfill({ status: 201, headers: { "x-memory-box-e2e-synthetic": "1" }, json: memory });
  });
  await publishDraft(page);
  await expect(page.locator(".original-body")).toHaveText(responseDraft);
  await expect(page.getByRole("button", { name: "Back to your draft", exact: true })).toHaveCount(0);
  expect(syntheticPublishes).toBe(1);
  expect(writes).toBe(0);
});

test("two real visitors publish independent notes and photos without gaining the parent's ownership", async ({ page, browser, baseURL, world }) => {
  test.skip(!writesEnabled, "Real publication and upload require MB_E2E_WRITE=1.");
  test.setTimeout(100_000);
  await world.connect(page);
  const visitor = await world.visitor(browser, baseURL!, page);
  const run = world.runId.slice(0, 8);
  const title = `Browser original ${run}`;
  await wanderToFixture(page, world.runId);
  await page.getByRole("button", { name: "Leave something", exact: true }).click();
  await page.locator(".composer-title input").fill(title);
  await page.locator(".composer textarea").fill("A family radio notebook from a disposable browser test.");
  const parent = await publishDraft(page);
  await expect(page.locator(".contribution-mark-label")).toHaveText("Note added");
  await expect(page.locator(".contribution-mark")).toHaveAttribute("aria-hidden", "true");
  await expect(visitor.locator(".world-transformed").getByRole("button", { name: quoteRegex(title) })).toBeAttached({ timeout: 8_000 });
  await readMemory(visitor, parent);
  await expect(visitor.getByRole("button", { name: "Edit memory", exact: true })).toHaveCount(0);
  await expect(visitor.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
  const forbidden = await sameOrigin(visitor, `/api/memories/${parent.id}`, { expectedVersion: parent.version, title: "Someone else's edit", body: "This overwrite must fail." }, "PATCH");
  expect(forbidden.status).toBe(403);
  await visitor.getByRole("button", { name: "Build on this", exact: true }).click();
  await expect(panel(visitor).locator(".lineage")).toContainText(title);
  await panel(visitor).getByRole("button", { name: "Image", exact: true }).click();
  const image = await sharp({ create: { width: 128, height: 96, channels: 3, background: "#86b4b1" } }).png().toBuffer();
  await visitor.getByLabel("Choose image", { exact: true }).setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await visitor.locator(".composer-title input").fill(`Browser response ${run}`);
  await visitor.locator(".composer textarea").fill("My independently authored photo response to this original.");
  const child = await publishDraft(visitor);
  await expect(visitor.locator(".contribution-mark-label")).toHaveText("Photo added");
  expect(child.authorId).not.toBe(parent.authorId);
  expect(child.inspiredBy).toBe(parent.id);
  expect(child.imageUrl).toMatch(/^\/api\/assets\//);
  await expect(visitor.locator(".original-image img")).toBeVisible();
  expect((await visitor.request.get(child.imageUrl!)).status()).toBe(200);
  const still = (await world.snapshot(page)).memories.find(memory => memory.id === parent.id)!;
  expect(still.body).toBe(parent.body);
  expect(still.authorId).toBe(parent.authorId);

  expect((await sameOrigin(page, `/api/memories/${parent.id}`, undefined, "DELETE")).status).toBe(200);
  await expect.poll(async () => (await world.snapshot(visitor)).memories.some(memory => memory.id === parent.id)).toBe(false);
  expect((await world.snapshot(visitor)).memories.find(memory => memory.id === child.id)?.inspiredBy).toBe(parent.id);
  expect((await sameOrigin(visitor, `/api/memories/${child.id}`, undefined, "DELETE")).status).toBe(200);
  expect((await visitor.request.get(child.imageUrl!)).status()).toBe(404);
});

test("a real accepted brush stroke reaches another visitor and undo preserves their later pixel", async ({ page, browser, baseURL, world }) => {
  test.skip(!writesEnabled, "Real painting requires MB_E2E_WRITE=1.");
  test.setTimeout(100_000);
  await world.connect(page);
  let notices: number[] = [];
  const visitor = await world.visitor(browser, baseURL!, page, visitorPage => { notices = changedRevisions(visitorPage); });
  const gridSize = (await world.snapshot(visitor)).gridSize;
  await wanderToFixture(visitor, world.runId);
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await panel(page).getByRole("button", { name: "Draw pixels", exact: true }).click();
  await wanderToFixture(page, world.runId);
  const point = await worldPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 18, point.y, { steps: 6 });
  await page.mouse.up();
  const accepted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/paint" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Add my pixels", exact: true }).first().click();
  const response = await accepted;
  expect(response.status()).toBe(200);
  const operation = await response.json() as { operationId: string; revision: number };
  const cells = response.request().postDataJSON().cells as Array<{ x: number; y: number; color: string }>;
  expect(cells.length).toBeGreaterThan(1);
  await expect(page.locator(".contribution-mark-label")).toHaveText(`${cells.length} pixels added`);
  const mark = await page.locator(".contribution-mark").evaluate(element => ({ x: parseFloat((element as HTMLElement).style.left), y: parseFloat((element as HTMLElement).style.top) }));
  expect(mark.x).toBe((Math.min(...cells.map(cell => cell.x)) + Math.max(...cells.map(cell => cell.x)) + 1) * gridSize / 2);
  expect(mark.y).toBe((Math.min(...cells.map(cell => cell.y)) + Math.max(...cells.map(cell => cell.y)) + 1) * gridSize / 2);
  await expect.poll(() => notices.some(revision => revision >= operation.revision), { timeout: 8_000 }).toBe(true);
  await expect.poll(async () => Number(await viewport(visitor).getAttribute("data-world-revision")), { timeout: 8_000 }).toBeGreaterThanOrEqual(operation.revision);
  await expectRenderedPixel(visitor, cells[0], gridSize);
  const otherColor = cells[0].color.toUpperCase() === "#E5B4B4" ? "#354FB2" : "#E5B4B4";
  const later = await sameOrigin<{ operationId: string }>(visitor, "/api/paint", { opId: randomUUID(), sceneId: "mixtape", cells: [{ ...cells[0], color: otherColor }] });
  expect(later.status).toBe(200);
  const undone = await sameOrigin<{ skipped: number; restored: number }>(page, "/api/paint/undo", { operationId: operation.operationId });
  expect(undone.status).toBe(200);
  expect(undone.body.skipped).toBeGreaterThanOrEqual(1);
  expect(undone.body.restored).toBe(cells.length - undone.body.skipped);
  const snapshot = await world.snapshot(page);
  expect(snapshot.pixels.find(pixel => pixel.x === cells[0].x && pixel.y === cells[0].y)?.color).toBe(otherColor);
  await expectRenderedPixel(visitor, { ...cells[0], color: otherColor }, gridSize);
  await expect(page.locator(".contribution-mark")).toHaveCount(0);
});

test("a provider-backed answer opens its actual cited original and returns without another model call", async ({ page, world }) => {
  test.skip(process.env.MB_E2E_AI !== "1", "Live generation requires MB_E2E_AI=1 and a coordinated allowance.");
  test.setTimeout(90_000);
  await world.connect(page);
  await page.getByRole("button", { name: "Find a memory or ask the box", exact: true }).click();
  await page.getByRole("textbox", { name: "Search memories", exact: true }).fill("What have people shared about music and family?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  let calls = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/ask") calls++; });
  const response = page.waitForResponse(result => new URL(result.url()).pathname === "/api/ask");
  await panel(page).getByRole("button", { name: "Ask the box", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  const answer = await result.json() as AnswerResponse;
  expect(answer.status).toBe("answered");
  const cited = answer.claims[0].sourceIds[0];
  const sourceIndex = answer.results.findIndex(result => result.memory.id === cited);
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  await page.getByRole("button", { name: `Open source ${sourceIndex + 1}`, exact: true }).first().click();
  await expect(page.locator(".original-body")).toHaveText(answer.results[sourceIndex].memory.body);
  await page.getByRole("button", { name: "Back to answer", exact: true }).first().click();
  await expect(page.locator(".answer-box")).toContainText(answer.claims[0].text);
  expect(calls).toBe(1);
});
