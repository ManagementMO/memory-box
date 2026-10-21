/**
 * A recorded, explicitly automated demo of two independent guest sessions.
 * This is a Playwright library script, not a new test spec. All contribution,
 * search and Ask requests go through the real application UI and services.
 * No Auth/session material is written to the recording/evidence artifacts.
 *
 * Plan only (no browser/credentials/network):
 *   npx tsx scripts/demo-memory-box.ts --plan
 * Authorized live recording (normal public quotas apply):
 *   MB_DEMO_WRITE=1 MB_DEMO_AI=1 npx tsx scripts/demo-memory-box.ts \
 *     --run desktop --base-url http://localhost:3007 --image /absolute/demo.png
 *   MB_DEMO_WRITE=1 MB_DEMO_AI=1 npx tsx scripts/demo-memory-box.ts \
 *     --run mobile --base-url https://memory-box-commons.vercel.app --image /absolute/demo.png
 * Exact recovery after an interrupted process:
 *   npx tsx scripts/demo-memory-box.ts --recover auth/demo-<run-id>.json
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type BrowserContext, type Locator, type Page, type Video } from "playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnswerResponse, Memory, Pixel, SearchResponse, WorldSnapshot } from "../src/lib/types";

const PROJECT = "mmxtgfnxfwsgxxorystb";
const SEED_OPERATIONS = new Set(["00000000-0000-4000-8000-000000000100", "00000000-0000-4000-8000-000000000101"]);
const HEART = { x: 115, y: 60 };
const OUTLINE = [".XX..XX.", "X..XX..X", "X......X", ".X....X.", "..X..X..", "...XX..."];
const FILL = ["..X.....", ".XX..XX.", ".XXXXXX.", "..XXXX..", "...XX...", "........"];
const TITLE = "Sunday radio corner";
const PHOTO_TITLE = "Side A smells like pancakes";
const RESPONSE_TITLE = "A tiny breakfast radio club";
const NOTE = "Fictional demo memory: Dad kept a small radio on the kitchen shelf. Sunday breakfast came with the same old songs and wonderfully wrong lyrics. I am leaving a Sunday radio corner where we can collect family songs and memories.";
const PHOTO = "Generated demo image, with a fictional response: Maya's Sunday radio corner reminded me of pancakes with Mum while the cassette played. I added the illustrated radio and a pink heart to the speaker. Let us keep this little corner growing.";
const RESPONSE = "Fictional demo response: Let us make Sunday radio corner a tiny breakfast radio club. Add one family song and one thing you used to cook. I can bring Dad's off-key chorus; Leo brought pancakes. The picture and our separate memories can grow together.";
const QUESTION = "How did the Sunday radio corner grow from a family memory into a shared idea?";
const STORY = [
  ["welcome", "Two independent guest sessions", "Maya-demo and Leo-demo are controlled recording actors using the real app."],
  ["maya-preview", "Maya starts the shared picture", "A freehand pixel preview is local until accepted."],
  ["maya-shared", "Leo sees the committed pixels", "A real revision Broadcast refreshes the second browser and its rendered canvas."],
  ["leo-preview", "Leo builds on the same pixels", "A blush fill includes a repaint of a cell Maya painted."],
  ["together", "One picture, shaped together", "Both browsers render the same accepted changes."],
  ["memory", "Maya leaves the thought behind it", "A fictional demo note is published through the normal composer and attached to the paint."],
  ["photo", "Leo responds with an image", "The generated demo image goes through the private upload and sanitization pipeline."],
  ["build-on", "The memory becomes a shared idea", "Maya publishes a separate response to Leo's original; parent authorship remains unchanged."],
  ["find", "Find words and meaning", "Real hybrid retrieval returns their new originals."],
  ["ask", "Ask the box", "One real provider-backed request retrieves and cites eligible originals."],
  ["source", "Read the exact original", "A citation opens its current source, with a route back to the same answer."],
  ["finish", "Explore the memory neighborhood", "The actual linked originals and collaborative pixels remain in the world until exact demo cleanup."],
] as const;

type CellRow = { world_id: string; x: number; y: number; color: string; operation_id: string | null; updated_revision: number };
type Role = "maya" | "leo";
type Chapter = { id: string; title: string; explanation: string; atMs: number; stills: Record<Role, string>; detail?: Record<string, unknown> };
type Recording = { role: Role; context: BrowserContext; page: Page; video: Video; startedAtMs: number; actorId?: string; notices: number[] };
interface Ledger {
  format: "memory-box-live-demo-v1"; runId: string; mode: "desktop" | "mobile"; origin: string; output: string;
  actors: string[]; memories: Array<[string, string]>; assets: string[]; operations: Array<[string, string]>;
  baselineCells: CellRow[]; baselineMemories: Memory[]; startedAt: string; storyStartMs?: number; storyEndMs?: number;
  chapters: Chapter[]; cleaned: boolean; cleanup?: Record<string, unknown>; failure?: string;
}
const cellKey = (p: { x: number; y: number }) => `${p.x},${p.y}`;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sorted = <T extends { x: number; y: number }>(rows: T[]) => [...rows].sort((a, b) => a.x - b.x || a.y - b.y);
const world = (page: Page) => page.getByRole("region", { name: "The shared Memory Box world" });
const panel = (page: Page) => page.locator(".context-panel");
async function until(check: () => Promise<boolean>, description: string, timeout = 20_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(180); }
  throw new Error(`Demo timed out: ${description}`);
}
async function snapshot(page: Page): Promise<WorldSnapshot> {
  return page.evaluate(async () => { const response = await fetch("/api/world", { cache: "no-store" }); if (!response.ok) throw Error("Public snapshot unavailable"); return response.json(); });
}
async function actorId(page: Page): Promise<string | undefined> {
  return page.evaluate(() => { const key = Object.keys(localStorage).find(key => /^sb-.+-auth-token$/.test(key)); return key ? JSON.parse(localStorage.getItem(key) || "null")?.user?.id : undefined; });
}
async function camera(page: Page) {
  return world(page).evaluate(element => ({ x: Number((element as HTMLElement).dataset.cameraX), y: Number((element as HTMLElement).dataset.cameraY), z: Number((element as HTMLElement).dataset.cameraZoom), width: element.clientWidth, height: element.clientHeight }));
}
function listenForChanges(page: Page) {
  const revisions: number[] = [];
  page.on("websocket", socket => socket.on("framereceived", frame => {
    try {
      let notice: { revision?: number } | undefined;
      if (typeof frame.payload === "string") {
        const packet = JSON.parse(frame.payload), event = Array.isArray(packet) ? packet[3] : packet.event, payload = Array.isArray(packet) ? packet[4] : packet.payload;
        if (event === "broadcast" && payload?.event === "changed") notice = payload.payload;
      } else if (frame.payload.length >= 5 && frame.payload[0] === 4 && frame.payload[4] === 1) {
        const bytes = frame.payload, start = 5 + bytes[1], payloadAt = start + bytes[2] + bytes[3];
        if (bytes.subarray(start, start + bytes[2]).toString("utf8") === "changed") notice = JSON.parse(bytes.subarray(payloadAt).toString("utf8"));
      }
      if (typeof notice?.revision === "number") revisions.push(notice.revision);
    } catch { /* Do not log transport/Auth frames. They are not evidence. */ }
  }));
  return revisions;
}

function environment() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname, PROJECT + ".supabase.co", "Unexpected demo project.");
  assert.equal(readFileSync("supabase/.temp/project-ref", "utf8").trim(), PROJECT, "Linked project mismatch.");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(key, "Exact cleanup requires the configured private server credential.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function allCells(db: SupabaseClient): Promise<CellRow[]> {
  const cells: CellRow[] = [];
  for (let start = 0; ; start += 1000) {
    const result = await db.from("cells").select("world_id,x,y,color,operation_id,updated_revision").eq("world_id", "commons").order("x").order("y").range(start, start + 999);
    assert.ifError(result.error); cells.push(...result.data || []);
    if ((result.data?.length || 0) < 1000) return cells;
  }
}

class Demo {
  private db: SupabaseClient;
  private ledgerPath: string;
  private pending: Promise<void>[] = [];
  private recordings: Recording[] = [];
  private originTime = Date.now();
  readonly ledger: Ledger;
  constructor(mode: "desktop" | "mobile", origin: string, output: string, runId = randomUUID()) {
    this.db = environment();
    this.ledger = { format: "memory-box-live-demo-v1", runId, mode, origin, output, actors: [], memories: [], assets: [], operations: [], baselineCells: [], baselineMemories: [], startedAt: new Date().toISOString(), chapters: [], cleaned: false };
    mkdirSync("auth", { recursive: true }); this.ledgerPath = resolve("auth", `demo-${runId}.json`); this.save();
  }
  private save() { writeFileSync(this.ledgerPath, JSON.stringify(this.ledger, null, 2)); }
  private elapsed() { return Date.now() - this.originTime; }
  private async pause(ms = 1600) { await delay(Math.round(ms * Number(process.env.MB_DEMO_PACE || 1))); }
  async prepare() { this.ledger.baselineCells = await allCells(this.db); this.save(); }
  async connect(browser: Browser, role: Role) {
    const mobile = this.ledger.mode === "mobile", viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 };
    const context = await browser.newContext({ baseURL: this.ledger.origin, viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
      reducedMotion: "no-preference", recordVideo: { dir: resolve(this.ledger.output, "raw"), size: viewport } });
    const start = this.elapsed(), page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const recording: Recording = { role, context, page, video: page.video()!, startedAtMs: start, notices: listenForChanges(page) };
    this.recordings.push(recording);
    page.on("response", response => {
      if (!response.ok() || response.request().method() !== "POST") return;
      const path = new URL(response.url()).pathname;
      if (!["/api/memories", "/api/uploads", "/api/paint"].includes(path)) return;
      const track = (async () => {
        const data = await response.json();
        if (path === "/api/memories" && !this.ledger.memories.some(([id]) => id === data.id)) this.ledger.memories.push([data.id, data.authorId]);
        if (path === "/api/uploads" && !this.ledger.assets.includes(data.assetId)) this.ledger.assets.push(data.assetId);
        if (path === "/api/paint" && !this.ledger.operations.some(([id]) => id === data.operationId)) {
          const actor = recording.actorId ?? await actorId(page); assert.ok(actor); this.ledger.operations.push([data.operationId, actor]);
        }
        this.save();
      })();
      void track.catch(() => {}); this.pending.push(track);
    });
    try {
      await page.goto("/"); await world(page).waitFor();
      await until(async () => await page.locator(".connection-state").innerText() === "Live", "guest admission and real subscription", 30_000);
    } finally {
      const id = await actorId(page).catch(() => undefined);
      if (id && !this.ledger.actors.includes(id)) { recording.actorId = id; this.ledger.actors.push(id); this.save(); }
    }
    assert.ok(recording.actorId);
    if (!this.ledger.baselineMemories.length) { this.ledger.baselineMemories = (await snapshot(page)).memories; this.save(); }
    await page.getByRole("button", { name: /^Your profile/ }).click();
    await page.getByRole("textbox", { name: "Your name", exact: true }).fill(role === "maya" ? "Maya-demo" : "Leo-demo");
    await page.getByRole("button", { name: "Save my name", exact: true }).click();
    await until(async () => !(await page.locator(".profile-form").count()), "profile save");
    await page.getByRole("button", { name: "Return to the commons", exact: true }).click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    return recording;
  }
  private async chapter(id: typeof STORY[number][0], detail?: Record<string, unknown>) {
    await this.pause();
    const spec = STORY.find(item => item[0] === id)!;
    const stills = {} as Record<Role, string>;
    await Promise.all(this.recordings.map(async recording => {
      const file = `${String(this.ledger.chapters.length + 1).padStart(2, "0")}-${id}-${recording.role}.png`;
      await recording.page.screenshot({ path: resolve(this.ledger.output, file), animations: "disabled" }); stills[recording.role] = file;
    }));
    this.ledger.chapters.push({ id, title: spec[1], explanation: spec[2], atMs: this.elapsed(), stills, detail }); this.save();
    console.log(`CHAPTER ${this.ledger.mode} ${id}`);
  }
  private async type(locator: Locator, text: string) { await locator.fill(""); await locator.pressSequentially(text, { delay: 19 }); }
  private async showAnswer(page: Page) {
    await panel(page).evaluate(element => { element.scrollTop = 0; });
    if (this.ledger.mode === "mobile") await page.locator(".answer-box").evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
    else {
      await panel(page).evaluate(element => {
        const answer = element.querySelector(".answer-box");
        if (answer) element.scrollTo({ top: Math.max(0, answer.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop - 12), behavior: "instant" });
      });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    }
  }
  private async focusCanvas(page: Page, x: number, y: number, z: number) {
    await this.pause(400);
    if (this.ledger.mode === "mobile") await world(page).evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
    else await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    for (let i = 0; i < 5; i++) {
      const current = await camera(page), rect = await world(page).boundingBox(); assert.ok(rect);
      if (Math.abs(current.z - z) < .012) break;
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.keyboard.down("Control");
      try { await page.mouse.wheel(0, -Math.log(z / current.z) / .008); } finally { await page.keyboard.up("Control"); }
      await this.pause(220);
    }
    let scaleX = 1, scaleY = 1;
    for (let i = 0; i < 6; i++) {
      const current = await camera(page), rect = await world(page).boundingBox(); assert.ok(rect);
      const tx = current.width / 2 - x * current.z, ty = current.height / 2 - y * current.z;
      if (Math.abs(current.x - tx) < 1 && Math.abs(current.y - ty) < 1) return;
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.mouse.wheel((current.x - tx) * scaleX, (current.y - ty) * scaleY); await this.pause(240);
      const next = await camera(page);
      if (Math.abs(next.x - current.x) > 1) scaleX = Math.min(10, Math.max(.1, (tx - current.x) / (next.x - current.x) * scaleX));
      if (Math.abs(next.y - current.y) > 1) scaleY = Math.min(10, Math.max(.1, (ty - current.y) / (next.y - current.y) * scaleY));
    }
    const final = await camera(page); assert.ok(Math.abs((final.width / 2 - final.x) / final.z - x) < 3 && Math.abs((final.height / 2 - final.y) / final.z - y) < 3, "Camera did not reach demo artwork.");
  }
  private async point(page: Page, cell: { x: number; y: number }) {
    const current = await camera(page), rect = await world(page).boundingBox(); assert.ok(rect);
    const point = { x: rect.x + current.x + (cell.x + .5) * 6 * current.z, y: rect.y + current.y + (cell.y + .5) * 6 * current.z };
    assert.ok(point.x > rect.x + 10 && point.x < rect.x + rect.width - 10 && point.y > rect.y + 30 && point.y < rect.y + rect.height - 70, "Paint cell is obstructed by the viewport edge.");
    return point;
  }
  private async draw(page: Page, pattern: string[], color: "Cobalt" | "Blush") {
    await page.getByRole("button", { name: "Paint", exact: true }).click();
    await panel(page).getByRole("button", { name: "Draw pixels", exact: true }).click();
    await panel(page).getByRole("button", { name: color, exact: true }).click();
    await this.focusCanvas(page, this.ledger.mode === "mobile" ? 712 : 610, 378, 1.8);
    const old = new Map(this.ledger.baselineCells.map(cell => [cellKey(cell), cell]));
    const allowed = (x: number, y: number) => { const cell = old.get(`${x},${y}`); return !cell || (cell.operation_id !== null && SEED_OPERATIONS.has(cell.operation_id)); };
    const planned: Pixel[] = [];
    const touch = this.ledger.mode === "mobile" ? await page.context().newCDPSession(page) : null;
    for (let row = 0; row < pattern.length; row++) for (let col = 0; col < pattern[row].length; col++) {
      if (pattern[row][col] !== "X" || !allowed(HEART.x + col, HEART.y + row)) continue;
      const start = col;
      while (col + 1 < pattern[row].length && pattern[row][col + 1] === "X" && allowed(HEART.x + col + 1, HEART.y + row)) col++;
      const a = await this.point(page, { x: HEART.x + start, y: HEART.y + row }), b = await this.point(page, { x: HEART.x + col, y: HEART.y + row });
      if (touch) {
        await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, ...a }] });
        for (let step = 1; step <= Math.max(1, col - start); step++) {
          const f = step / Math.max(1, col - start); await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }] }); await delay(80);
        }
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await page.mouse.move(a.x, a.y, { steps: 5 }); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: Math.max(2, (col - start) * 4) }); await page.mouse.up();
      }
      for (let x = start; x <= col; x++) planned.push({ x: HEART.x + x, y: HEART.y + row, color: color === "Cobalt" ? "#3659DB" : "#E7ABC6" });
      await this.pause(160);
    }
    await touch?.detach(); assert.ok(planned.length >= 6, "Visitor marks leave too little safe demo art; choose another place.");
    return planned;
  }
  private async commitPaint(recording: Recording, planned: Pixel[]) {
    const expected = new Set(planned.map(cellKey));
    const own = new Set(this.ledger.operations.map(([id]) => id));
    const current = await allCells(this.db);
    if (current.some(cell => expected.has(cellKey(cell)) && (!cell.operation_id || (!SEED_OPERATIONS.has(cell.operation_id) && !own.has(cell.operation_id))))) {
      await recording.page.getByRole("button", { name: "Clear pixel preview", exact: true }).click();
      throw new Error("Another visitor owns a planned demo cell now. Preview cleared without publication.");
    }
    const pending = recording.page.waitForResponse(response => new URL(response.url()).pathname === "/api/paint" && response.request().method() === "POST");
    await recording.page.getByRole("button", { name: "Share preview pixels", exact: true }).click();
    const response = await pending; assert.equal(response.status(), 200, "Real paint acceptance failed.");
    const data = await response.json() as { operationId: string; revision: number };
    const actual = response.request().postDataJSON().cells as Pixel[]; assert.ok(actual.every(cell => expected.has(cellKey(cell))), "Pointer paint left the planned safe cells.");
    return { ...data, cells: actual };
  }
  private async observe(observer: Recording, paint: { revision: number; cells: Pixel[] }) {
    await until(async () => observer.notices.some(revision => revision >= paint.revision), "actual second-browser revision Broadcast");
    await until(async () => Number(await world(observer.page).getAttribute("data-world-revision")) >= paint.revision, "second-browser committed revision");
    const cell = paint.cells[0];
    const expected = [1, 3, 5].map(offset => parseInt(cell.color.slice(offset, offset + 2), 16));
    await until(async () => JSON.stringify(await observer.page.locator(".world-pixels").evaluate((element, cell) => {
      const canvas = element as HTMLCanvasElement, board = canvas.closest(".world-board") as HTMLElement, z = Number(board.dataset.cameraZoom);
      const x = (Number(board.dataset.cameraX) + (cell.x + .5) * 6 * z) * canvas.width / canvas.clientWidth;
      const y = (Number(board.dataset.cameraY) + (cell.y + .5) * 6 * z) * canvas.height / canvas.clientHeight;
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
      return [...canvas.getContext("2d")!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(0, 3);
    }, cell)) === JSON.stringify(expected), "second-browser actual rendered RGB");
  }
  private async publish(page: Page) {
    await panel(page).getByRole("button", { name: "Choose its place", exact: true }).click(); await this.pause(800);
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/memories" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Leave it here", exact: true }).click();
    const response = await pending; assert.equal(response.status(), 201, "Real memory publication failed.");
    const memory = await response.json() as Memory;
    await until(async () => await page.locator(".original-title").innerText() === memory.title, "published original reader");
    await this.pause(800); return memory;
  }
  private async read(page: Page, memory: Memory) {
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await panel(page).locator(".memory-result").filter({ hasText: memory.title }).click();
    await until(async () => await page.locator(".original-title").innerText() === memory.title, "other guest's exact original");
  }
  async record(maya: Recording, leo: Recording, image: string) {
    const a = maya.page, b = leo.page;
    assert.notEqual(maya.actorId, leo.actorId); this.ledger.storyStartMs = this.elapsed(); this.save();
    await this.chapter("welcome", { actors: 2, independent: true, generatedImage: true });
    await this.focusCanvas(b, this.ledger.mode === "mobile" ? 712 : 610, 378, 1.8);
    const cobalt = await this.draw(a, OUTLINE, "Cobalt"); await this.chapter("maya-preview", { staged: cobalt.length });
    const first = await this.commitPaint(maya, cobalt); await this.observe(leo, first);
    await this.chapter("maya-shared", { revision: first.revision, broadcast: true, renderedPixel: true });
    const pink = await this.draw(b, FILL, "Blush"); await this.chapter("leo-preview", { staged: pink.length, sharedCells: pink.filter(cell => cobalt.some(old => cellKey(old) === cellKey(cell))).length });
    const second = await this.commitPaint(leo, pink); await this.observe(maya, second);
    await Promise.all(this.recordings.map(r => this.focusCanvas(r.page, 550, 380, this.ledger.mode === "mobile" ? .75 : 1.05)));
    await this.chapter("together", { revision: second.revision, broadcast: true, renderedPixel: true });
    await panel(a).getByRole("button", { name: "Leave the thought behind it", exact: true }).click();
    await this.type(a.locator(".composer input:not([type=file])").first(), TITLE); await this.type(a.locator(".composer textarea"), NOTE);
    const parent = await this.publish(a); assert.equal(parent.paintOperationId, first.operationId);
    await until(async () => (await snapshot(b)).memories.some(memory => memory.id === parent.id), "real note visible to Leo");
    await this.read(b, parent); assert.equal(await b.getByRole("button", { name: "Edit memory", exact: true }).count(), 0);
    await this.chapter("memory", { memoryId: parent.id, author: "Maya-demo", paintAttached: true, otherGuestCannotEdit: true });
    await b.getByRole("button", { name: "Build on this", exact: true }).click();
    await panel(b).getByRole("button", { name: "Image", exact: true }).click();
    await b.getByLabel("Choose image", { exact: true }).setInputFiles(image);
    await this.type(b.locator(".composer input:not([type=file])").first(), PHOTO_TITLE); await this.type(b.locator(".composer textarea"), PHOTO);
    const photo = await this.publish(b); assert.notEqual(photo.authorId, parent.authorId); assert.equal(photo.inspiredBy, parent.id); assert.match(photo.imageUrl || "", /^\/api\/assets\//);
    await b.locator(".original-image img").waitFor();
    await until(async () => (await snapshot(a)).memories.some(memory => memory.id === photo.id), "real photo visible to Maya"); await this.read(a, photo);
    await this.chapter("photo", { memoryId: photo.id, author: "Leo-demo", inspiredBy: parent.id, sanitizedDelivery: (await a.request.get(photo.imageUrl!)).status() === 200 });
    await a.getByRole("button", { name: "Build on this", exact: true }).click();
    await this.type(a.locator(".composer input:not([type=file])").first(), RESPONSE_TITLE); await this.type(a.locator(".composer textarea"), RESPONSE);
    const response = await this.publish(a); assert.equal(response.inspiredBy, photo.id);
    await until(async () => (await snapshot(b)).memories.some(memory => memory.id === response.id), "Maya's response visible to Leo"); await this.read(b, response);
    const latestParent = (await snapshot(a)).memories.find(memory => memory.id === parent.id); assert.equal(latestParent?.body, NOTE); assert.equal(latestParent?.authorId, parent.authorId);
    await this.chapter("build-on", { memoryId: response.id, inspiredBy: photo.id, originalUnchanged: true });
    // Let the actual versioned image job finish; this is recorded as real wait,
    // not replaced with a fake caption/index state.
    await until(async () => (await snapshot(b)).memories.filter(memory => [parent.id, photo.id, response.id].includes(memory.id)).every(memory => memory.indexStatus === "ready"), "actual indexing of the three demo originals", 70_000);
    await this.type(b.getByRole("textbox", { name: "Find a memory or ask the box", exact: true }), TITLE);
    const finding = b.waitForResponse(r => new URL(r.url()).pathname === "/api/search" && r.request().method() === "POST");
    await b.getByRole("button", { name: "Search or ask", exact: true }).click();
    const foundResponse = await finding; assert.equal(foundResponse.status(), 200); const found = await foundResponse.json() as SearchResponse;
    assert.ok(found.results.some(result => result.memory.id === parent.id));
    await b.locator(".search-results .memory-result").first().waitFor();
    await this.chapter("find", { mode: found.mode, results: found.results.map(result => result.memory.id), demoOriginalRetrieved: true });
    await b.getByRole("button", { name: "Ask", exact: true }).click(); await this.type(panel(b).locator("textarea"), QUESTION);
    let calls = 0; b.on("request", request => { if (new URL(request.url()).pathname === "/api/ask" && request.method() === "POST") calls++; });
    const asking = b.waitForResponse(r => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST");
    await panel(b).getByRole("button", { name: "Ask the box", exact: true }).click();
    const answerResponse = await asking; assert.equal(answerResponse.status(), 200); const answer = await answerResponse.json() as AnswerResponse;
    assert.equal(answer.status, "answered", "The real model did not produce an answer; do not fake or silently retry it.");
    const demoIds = new Set([parent.id, photo.id, response.id]);
    const cited = answer.claims.flatMap(claim => claim.sourceIds).find(id => demoIds.has(id)); assert.ok(cited, "Real answer did not cite a demo original.");
    await this.pause(1200); await this.showAnswer(b);
    writeFileSync(resolve(this.ledger.output, "actual-answer.json"), JSON.stringify(answer, null, 2));
    await this.chapter("ask", { providerBacked: true, calls, claims: answer.claims.length, citedDemoOriginal: cited });
    const sourceIndex = answer.results.findIndex(result => result.memory.id === cited);
    await b.getByRole("button", { name: `Open source ${sourceIndex + 1}`, exact: true }).first().click();
    await until(async () => await b.locator(".original-body").innerText() === answer.results[sourceIndex].memory.body, "exact real cited original");
    await this.chapter("source", { sourceId: cited, bodyMatches: true });
    await b.getByRole("button", { name: "Back to answer", exact: true }).first().click(); await this.showAnswer(b); assert.equal(calls, 1, "Source return must not issue another generation.");
    await this.read(a, response); await a.getByRole("button", { name: "Show in canvas", exact: true }).click();
    await this.chapter("finish", { askCalls: calls, separateOriginals: 3, linked: true });
    this.ledger.storyEndMs = this.elapsed(); this.save();
  }
  async finishVideos() {
    for (const recording of this.recordings) {
      // Supported same-origin browser Auth logout keeps bearer/session data in
      // the browser. The recording's storyEndMs precedes this cleanup.
      await recording.page.evaluate(async ({ url, key }) => {
        const storageKey = Object.keys(localStorage).find(key => /^sb-.+-auth-token$/.test(key));
        const session = storageKey && JSON.parse(localStorage.getItem(storageKey) || "null");
        if (session?.access_token) await fetch(url + "/auth/v1/logout?scope=global", { method: "POST", headers: { apikey: key, Authorization: `Bearer ${session.access_token}` } });
      }, { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! }).catch(() => {});
    }
    await Promise.all(this.recordings.map(recording => recording.context.close()));
    const videos = [];
    for (const recording of this.recordings) {
      const destination = resolve(this.ledger.output, `${recording.role}-${this.ledger.mode}.webm`);
      await recording.video.saveAs(destination);
      videos.push({ role: recording.role, file: basename(destination), startedAtMs: recording.startedAtMs,
        trimStartSeconds: Math.max(0, ((this.ledger.storyStartMs ?? 0) - recording.startedAtMs) / 1000),
        trimEndSeconds: this.ledger.storyEndMs ? (this.ledger.storyEndMs - recording.startedAtMs) / 1000 : null });
    }
    writeFileSync(resolve(this.ledger.output, "recordings.json"), JSON.stringify({ automated: true, footage: "Actual Playwright browser recordings; no scripted application responses.", engine: "Chromium; touch/mobile emulation for mobile mode", videos }, null, 2));
  }
  async cleanup() { await cleanupLedger(this.db, this.ledger, this.ledgerPath, this.pending); }
  fail(message: string) { this.ledger.failure = message; this.save(); }
}

export async function cleanupLedger(db: SupabaseClient, ledger: Ledger, path: string, pending: Promise<void>[] = []) {
  const failures: string[] = [];
  const settled = await Promise.allSettled(pending); if (settled.some(result => result.status === "rejected")) failures.push("application response tracking");
  const actorIds = ledger.actors.length ? ledger.actors : ["00000000-0000-0000-0000-000000000000"];
  // A response can be lost after the server commits. These identities belong
  // exclusively to this recording, so reconcile authoritative ownership first.
  const ownedMemories = await db.from("memories").select("id,author_id,asset_id,visibility", { count: "exact" }).in("author_id", actorIds).order("created_at");
  const ownedAssets = await db.from("assets").select("id,owner_id", { count: "exact" }).in("owner_id", actorIds);
  if (ownedMemories.error || ownedMemories.count !== ownedMemories.data?.length) failures.push("reconcile all exact actor-owned memories");
  if (ownedAssets.error || ownedAssets.count !== ownedAssets.data?.length) failures.push("reconcile all exact actor-owned assets");
  let discoveredMemories = 0, discoveredAssets = 0;
  for (const memory of ownedMemories.data || []) if (!ledger.memories.some(([id]) => id === memory.id)) { ledger.memories.push([memory.id, memory.author_id]); discoveredMemories++; }
  for (const asset of ownedAssets.data || []) if (!ledger.assets.includes(asset.id)) { ledger.assets.push(asset.id); discoveredAssets++; }
  writeFileSync(path, JSON.stringify(ledger, null, 2));
  const operations = await db.from("paint_operations").select("id,actor_id,revision,before_cells").in("actor_id", actorIds).order("revision");
  if (operations.error) failures.push("read exact demo paint operations");
  const ids = new Set(ledger.operations.map(([id]) => id)), revisions = new Set<number>(), before = new Map<string, { x: number; y: number; color: string; operationId: string | null }>();
  for (const operation of operations.data || []) {
    ids.add(operation.id); revisions.add(operation.revision);
    if (!ledger.operations.some(([id]) => id === operation.id)) ledger.operations.push([operation.id, operation.actor_id]);
    for (const cell of operation.before_cells) if (!before.has(cellKey(cell))) before.set(cellKey(cell), cell);
  }
  writeFileSync(path, JSON.stringify(ledger, null, 2));
  const baseline = new Map(ledger.baselineCells.map(cell => [cellKey(cell), cell]));
  let restored = 0, preservedLater = 0;
  for (const cell of before.values()) {
    const current = await db.from("cells").select("operation_id,updated_revision").eq("world_id", "commons").eq("x", cell.x).eq("y", cell.y).maybeSingle();
    if (current.error) { failures.push("inspect exact demo pixel"); continue; }
    if (!current.data || !ids.has(current.data.operation_id) || !revisions.has(current.data.updated_revision)) { preservedLater++; continue; }
    const old = baseline.get(cellKey(cell)), exactBaseline = old && old.operation_id === cell.operationId && old.color === cell.color;
    const absent = !old && cell.operationId == null && cell.color === "#FFFFFF";
    const change = absent ? db.from("cells").delete({ count: "exact" }) : db.from("cells").update({ color: cell.color, operation_id: cell.operationId, ...(exactBaseline ? { updated_revision: old.updated_revision } : {}) }, { count: "exact" });
    const result = await change.eq("world_id", "commons").eq("x", cell.x).eq("y", cell.y).eq("operation_id", current.data.operation_id).eq("updated_revision", current.data.updated_revision);
    if (result.error) failures.push("restore exact demo pixel"); restored += result.count ?? 0;
  }
  for (const [id, actor] of [...ledger.memories].reverse()) {
    const inspected = await db.from("memories").select("author_id,visibility").eq("id", id).maybeSingle();
    if (inspected.error || !inspected.data) { failures.push("inspect exact demo original"); continue; }
    if (inspected.data.visibility === "deleted") continue;
    if (inspected.data.author_id !== actor || !ledger.actors.includes(actor)) { failures.push("retain original with unexpected ownership"); continue; }
    const result = await db.rpc("mb_delete_memory", { p_actor: actor, p_id: id }); if (result.error) failures.push("withdraw exact demo original");
  }
  let objectsRemoved = 0;
  for (const id of ledger.assets) {
    const result = await db.from("assets").select("owner_id,path,staging_path,status").eq("id", id).maybeSingle();
    if (result.error || !result.data) { failures.push("inspect exact demo asset"); continue; }
    const asset = result.data;
    if (!(asset.owner_id && ledger.actors.includes(asset.owner_id)) && !(asset.owner_id === null && asset.status === "deleted")) { failures.push("retain asset with unexpected ownership"); continue; }
    const storageOwner = asset.staging_path?.split("/")[0];
    if (!ledger.actors.includes(storageOwner) || (asset.owner_id && asset.owner_id !== storageOwner)) { failures.push("retain asset with unexpected private path ownership"); continue; }
    // An interrupted upload can leave a staging/ready row with no memory. Do
    // not remove it while any published or hidden source still references it.
    const references = await db.from("memories").select("id", { count: "exact", head: true }).eq("asset_id", id).in("visibility", ["published", "hidden"]);
    if (references.error || references.count !== 0) { failures.push("demo asset still referenced"); continue; }
    if (asset.status !== "deleted") {
      const revoked = await db.from("assets").update({ status: "deleted" }, { count: "exact" }).eq("id", id).eq("owner_id", asset.owner_id).eq("status", asset.status);
      if (revoked.error || revoked.count !== 1) { failures.push("revoke unreferenced exact demo asset"); continue; }
    }
    // Match the server cleanup path for a crash after canonical upload but
    // before markAssetReady persisted its immutable storage key.
    const canonicalPath = asset.path || `${storageOwner}/${id}.webp`;
    for (const [bucket, object] of [["memory-assets", canonicalPath], ["memory-staging", asset.staging_path]]) if (object) {
      const removed = await db.storage.from(bucket).remove([object]); if (removed.error) failures.push("remove exact demo object"); else objectsRemoved++;
      const listed = await db.storage.from(bucket).list(dirname(object), { search: basename(object) });
      if (listed.error || listed.data?.some(entry => entry.name === basename(object))) failures.push("verify exact demo object absence");
    }
  }
  let eventsRemoved = 0;
  if (ids.size) { const result = await db.from("world_events").delete({ count: "exact" }).in("operation_id", [...ids]); if (result.error) failures.push("remove own paint events"); eventsRemoved += result.count ?? 0; }
  if (ledger.memories.length) { const result = await db.from("world_events").delete({ count: "exact" }).in("memory_id", ledger.memories.map(([id]) => id)); if (result.error) failures.push("remove own memory events"); eventsRemoved += result.count ?? 0; }
  // Verify revocation while authoritative owner IDs are still intact. Any
  // failure retains guest identities, preserving recovery authority.
  const remainingOwnedMemories = await db.from("memories").select("id", { count: "exact", head: true }).in("author_id", actorIds).neq("visibility", "deleted");
  const remainingOwnedAssets = await db.from("assets").select("id", { count: "exact", head: true }).in("owner_id", actorIds).neq("status", "deleted");
  if (remainingOwnedMemories.error || remainingOwnedMemories.count !== 0) failures.push("verify all actor-owned originals withdrawn");
  if (remainingOwnedAssets.error || remainingOwnedAssets.count !== 0) failures.push("verify all actor-owned assets revoked");
  if (ids.size) {
    const cells = await db.from("cells").select("x", { count: "exact", head: true }).in("operation_id", [...ids]);
    const events = await db.from("world_events").select("id", { count: "exact", head: true }).in("operation_id", [...ids]);
    if (cells.error || cells.count !== 0) failures.push("verify no current demo-owned cells");
    if (events.error || events.count !== 0) failures.push("verify no exact demo paint events");
  }
  if (ledger.memories.length) {
    const remaining = await db.from("memories").select("id", { count: "exact", head: true }).in("id", ledger.memories.map(([id]) => id)).neq("visibility", "deleted");
    const events = await db.from("world_events").select("id", { count: "exact", head: true }).in("memory_id", ledger.memories.map(([id]) => id));
    if (remaining.error || remaining.count !== 0) failures.push("verify exact demo originals withdrawn");
    if (events.error || events.count !== 0) failures.push("verify no exact demo memory events");
  }
  const cellsAfter = await allCells(db), beforeHash = digest(sorted(ledger.baselineCells)), afterHash = digest(sorted(cellsAfter));
  const published = await db.rpc("mb_snapshot"); if (published.error) failures.push("read post-demo public state");
  const actualMemories = (published.data?.memories || []) as Memory[];
  const memoryBeforeHash = digest([...ledger.baselineMemories].sort((a, b) => a.id.localeCompare(b.id)));
  const memoryAfterHash = digest(actualMemories.filter(memory => ledger.baselineMemories.some(before => before.id === memory.id)).sort((a, b) => a.id.localeCompare(b.id)));
  if (memoryBeforeHash !== memoryAfterHash) failures.push("preexisting original changed during demo; inspect outsider activity");
  const world = await db.from("worlds").select("revision,public_epoch").eq("id", "commons").single();
  if (world.error) failures.push("read final cleanup revision");
  if (world.data) { const notice = await db.channel("world:commons", { config: { private: true } }).httpSend("changed", { revision: world.data.revision, epoch: world.data.public_epoch, kind: "resync" }); if (!notice.success) failures.push("notify exact demo cleanup"); }
  let actorsRemoved = 0;
  if (!failures.length) for (const actor of ledger.actors) {
    const budget = await db.from("rate_budgets").delete().eq("actor_id", actor); if (budget.error) failures.push("remove demo actor budgets");
  }
  if (!failures.length) for (const actor of ledger.actors) {
    const removed = await db.auth.admin.deleteUser(actor);
    if (removed.error && removed.error.status !== 404) { failures.push("remove exact demo Auth identity"); break; }
    const check = await db.auth.admin.getUserById(actor);
    if (check.data.user || (check.error && check.error.status !== 404)) { failures.push("verify demo Auth absence"); break; }
    actorsRemoved++;
  }
  ledger.cleaned = !failures.length; ledger.cleanup = { restored, preservedLater, objectsRemoved, eventsRemoved, actorsRemoved, actorsRetained: ledger.actors.length - actorsRemoved, discoveredMemories, discoveredAssets, authoritativeOwnersVerified: !remainingOwnedMemories.error && remainingOwnedMemories.count === 0 && !remainingOwnedAssets.error && remainingOwnedAssets.count === 0, beforeCellHash: beforeHash, afterCellHash: afterHash, cellsIdentical: beforeHash === afterHash, memoryBeforeHash, memoryAfterHash, originalsIdentical: memoryBeforeHash === memoryAfterHash, publishedOriginalsAfter: actualMemories.length, failures };
  writeFileSync(path, JSON.stringify(ledger, null, 2));
  if (existsSync(ledger.output)) writeFileSync(resolve(ledger.output, "demo-evidence.json"), JSON.stringify({ ...ledger, baselineCells: undefined, actors: undefined }, null, 2));
  assert.deepEqual(failures, [], `Exact demo cleanup incomplete. Recover only IDs in ${path}.`);
  console.log(`CLEAN ${ledger.mode}: ${restored} owned cells restored; ${preservedLater} later edits preserved; ${objectsRemoved} private paths removed; ${actualMemories.length} public originals remain.`);
}

export async function finalizeDemo(steps: { videos: () => Promise<unknown>; browser: () => Promise<unknown>; cleanup: () => Promise<unknown> }) {
  const failures: string[] = [];
  for (const [name, action] of Object.entries(steps)) {
    try { await action(); } catch { failures.push(name); }
  }
  return failures;
}

async function main() {
  const args = process.argv.slice(2), value = (flag: string) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  if (args.includes("--plan") || args.includes("--help") || !args.length) { console.log(JSON.stringify({ automated: true, purpose: "Two independently authenticated controlled browser actors; actual backend writes/retrieval/provider, then exact cleanup.", modes: ["desktop", "mobile"], imageDisclosure: "Generated demo image; all contributed family stories explicitly fictional.", roles: ["Maya-demo", "Leo-demo"], expectedWritesPerMode: { paint: 2, textOriginals: 2, imageOriginals: 1, realAsk: 1 }, story: STORY }, null, 2)); return; }
  if (value("--recover")) {
    const path = resolve(value("--recover")!); assert.ok(path.startsWith(resolve("auth") + "/demo-"), "Recover only an exact ignored demo ledger.");
    const ledger = JSON.parse(readFileSync(path, "utf8")) as Ledger; assert.equal(ledger.format, "memory-box-live-demo-v1");
    if (ledger.cleaned) { console.log("Exact demo ledger is already cleaned."); return; }
    await cleanupLedger(environment(), ledger, path); return;
  }
  assert.equal(process.env.MB_DEMO_WRITE, "1", "Real demo contributions require MB_DEMO_WRITE=1."); assert.equal(process.env.MB_DEMO_AI, "1", "The one real answer requires MB_DEMO_AI=1.");
  const mode = value("--run"); assert.ok(mode === "desktop" || mode === "mobile", "Use --run desktop or --run mobile.");
  const origin = new URL(value("--base-url") || "http://localhost:3007"); assert.ok(["localhost", "127.0.0.1", "memory-box-commons.vercel.app"].includes(origin.hostname), "Only the reviewed local app or approved public pilot can be recorded.");
  const image = resolve(value("--image") || "../work/demo-cassette-still-life.png"); assert.ok(existsSync(image) && statSync(image).size <= 5 * 1024 * 1024, "Provide the reviewed generated demo image under5MB.");
  const runId = randomUUID(), output = resolve("../work", `memory-box-demo-${mode}-${runId.slice(0, 8)}`); mkdirSync(output, { recursive: false });
  const demo = new Demo(mode, origin.origin, output, runId); let browser: Browser | undefined;
  console.log(`OUTPUT ${output}`);
  try {
    await demo.prepare(); browser = await chromium.launch({ headless: true });
    const maya = await demo.connect(browser, "maya"), leo = await demo.connect(browser, "leo");
    await demo.record(maya, leo, image);
  } catch (error) { const message = error instanceof Error ? error.message : "Demo failed"; demo.fail(message); console.error(`DEMO INCOMPLETE: ${message}`); process.exitCode = 1; }
  finally {
    const failures = await finalizeDemo({ videos: () => demo.finishVideos(), browser: async () => browser?.close(), cleanup: () => demo.cleanup() });
    if (failures.length) { console.error(`Finalization incomplete (${failures.join(", ")}); inspect/recover only the ignored auth/demo ledger.`); process.exitCode = 1; }
  }
  console.log(`Demo artifacts: ${output}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : "Demo setup failed"); process.exitCode = 1; });
