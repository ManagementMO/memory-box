/** Package two successful actual recordings for the standalone demo viewer.
 * Usage: npx tsx scripts/demo-package.ts <desktop-work-dir> [mobile-work-dir]
 * A desktop-only invocation exposes real media for independent viewer review.
 * Requires local ffmpeg; does not call the app, Auth, database or any model.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const output = resolve("../outputs/memory-box-two-person-demo");
const roles = ["maya", "leo"] as const;
const actorByChapter: Record<string, string> = { welcome: "both", "maya-preview": "maya", "maya-shared": "leo", "leo-preview": "leo", together: "both", memory: "maya", photo: "leo", "build-on": "maya", find: "leo", ask: "leo", source: "leo", finish: "both" };
type Chapter = { id: string; title: string; explanation: string; atMs: number; stills: { maya: string; leo: string }; detail?: Record<string, unknown> };
type Evidence = { format: string; mode: "desktop" | "mobile"; startedAt: string; origin: string; storyStartMs: number; storyEndMs: number; chapters: Chapter[]; cleaned: boolean; cleanup: Record<string, unknown>; failure?: string };
type Recording = { role: "maya" | "leo"; file: string; startedAtMs: number; trimStartSeconds: number; trimEndSeconds: number };
const json = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
function readableEvidence(chapter: Chapter): string[] {
  const detail = chapter.detail || {};
  const byId: Record<string, string[]> = {
    welcome: ["Two distinct guest identities; each session has its own browser storage."],
    "maya-preview": [`${detail.staged} pixels drawn in a local preview before publication.`],
    "maya-shared": ["Leo received the real accepted revision.", "The second canvas rendered the expected pixel color."],
    "leo-preview": [`${detail.staged} blush pixels include ${detail.sharedCells} repaint of Maya’s accepted work.`],
    together: ["Both sessions received the committed picture.", "The rendered second-session color was checked."],
    memory: ["Maya’s original is attached to her paint operation.", "Leo can read and build on it, while Maya keeps authorship."],
    photo: ["The generated demo image used the actual upload and sanitization pipeline.", "Leo’s separate contribution links to Maya’s original."],
    "build-on": ["Three separate originals form a real build-on chain.", "Maya’s first text and authorship remain unchanged."],
    find: [`The actual ${detail.mode || "hybrid"} retrieval included their new original.`],
    ask: [`One actual Ask returned ${detail.claims} cited claims.`, "At least one claim cites a new demo original."],
    source: ["The citation reader matched the exact source body."],
    finish: ["Returning from the source made no additional generation request.", "The temporary contributions were cleaned after capture."],
  };
  return byId[chapter.id] || [];
}

async function packageMode(dir: string, expected: "desktop" | "mobile") {
  const evidence = json<Evidence>(resolve(dir, "demo-evidence.json"));
  assert.equal(evidence.format, "memory-box-live-demo-v1"); assert.equal(evidence.mode, expected); assert.equal(evidence.cleaned, true, "Do not publish a run with incomplete cleanup.");
  assert.equal(evidence.failure, undefined, "Do not publish a failed or partial demo as a complete experience.");
  assert.equal(evidence.chapters.length, 12); assert.equal(evidence.cleanup.originalsIdentical, true);
  const recordings = json<{ videos: Recording[] }>(resolve(dir, "recordings.json")).videos;
  assert.equal(recordings.length, 2);
  const duration = (evidence.storyEndMs - evidence.storyStartMs) / 1000;
  assert.ok(duration > 15 && duration < 600, "Unexpected video span.");
  const actors: Record<string, unknown> = {};
  for (const role of roles) {
    const recording = recordings.find(video => video.role === role); assert.ok(recording);
    const video = `media/${expected}-${role}.mp4`, poster = `stills/${expected}-${evidence.chapters[0].stills[role]}`;
    await execute("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", recording.trimStartSeconds.toFixed(3), "-i", resolve(dir, recording.file), "-t", duration.toFixed(3),
      "-an", "-vf", "setpts=PTS-STARTPTS", "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", resolve(output, video)], { timeout: 180_000 });
    actors[role] = { label: role === "maya" ? "Maya-demo" : "Leo-demo", subtitle: "Independent controlled guest session", video, poster };
    console.log(`PACKAGED ${expected} ${role}`);
  }
  const chapters = evidence.chapters.map((chapter, index) => {
    const stills: Record<string, string> = {};
    for (const role of roles) { const target = `${expected}-${basename(chapter.stills[role])}`; copyFileSync(resolve(dir, chapter.stills[role]), resolve(output, "stills", target)); stills[role] = `stills/${target}`; }
    return { id: chapter.id, title: chapter.title, start: index === 0 ? 0 : Math.max(0, (evidence.chapters[index - 1].atMs - evidence.storyStartMs) / 1000),
      end: Math.min(duration, (chapter.atMs - evidence.storyStartMs) / 1000), actor: actorByChapter[chapter.id] || "both", summary: chapter.explanation, stills, evidence: readableEvidence(chapter), verification: chapter.detail };
  });
  copyFileSync(resolve(dir, "actual-answer.json"), resolve(output, `${expected}-actual-answer.json`));
  writeFileSync(resolve(output, `${expected}-cleanup.json`), JSON.stringify({ mode: expected, recordedAt: evidence.startedAt, origin: evidence.origin, automated: true, cleanup: evidence.cleanup }, null, 2));
  const independentAudit = resolve(dir, "independent-cleanup-audit.json");
  if (existsSync(independentAudit)) copyFileSync(independentAudit, resolve(output, `${expected}-independent-cleanup-audit.json`));
  return { label: expected === "desktop" ? "Desktop" : "Mobile", duration, actors, chapters, recordedAt: evidence.startedAt, origin: evidence.origin,
    viewport: expected === "desktop" ? { width: 1440, height: 960 } : { width: 390, height: 844 },
    engine: expected === "desktop" ? "Chromium desktop" : "Chromium mobile emulation with real touch paint input",
    cleanup: evidence.cleanup, actualAnswer: `${expected}-actual-answer.json`, cleanupReport: `${expected}-cleanup.json` };
}

async function main() {
  const [desktop, mobile] = process.argv.slice(2); assert.ok(desktop, "Provide a successful desktop work directory and optionally the mobile directory.");
  mkdirSync(resolve(output, "media"), { recursive: true }); mkdirSync(resolve(output, "stills"), { recursive: true });
  const modes = { desktop: await packageMode(resolve(desktop), "desktop"), ...(mobile ? { mobile: await packageMode(resolve(mobile), "mobile") } : {}) };
  const manifest = { status: mobile ? "ready" : "desktop-preview", title: "Memory Box — two people, one world", recordedAt: new Date().toISOString(),
    provenance: { actors: "Two independent automated guest sessions in each recording, controlled by the builder. These are not footage of two human participants.",
      image: "An original generated still-life demo image; each contributed family story is explicitly fictional.",
      backend: "Actual application UI, Supabase Auth/Storage/Postgres/Realtime, real hybrid retrieval and one provider-backed Ask per device recording. No application-response stubs or fake presence.",
      video: "Continuous actual browser recordings, trimmed only at the common story start/end and transcoded to MP4. Idle/provider wait time is retained. Both panes share one timeline.",
      cleanup: "Temporary demo originals were withdrawn, exact uploaded private objects and guest accounts removed, and demo-owned paint restored with guards preserving later outside edits." }, modes };
  writeFileSync(resolve(output, "manifest.js"), `window.MEMORY_BOX_DEMO = ${JSON.stringify(manifest, null, 2)};\n`);
  writeFileSync(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  const image = resolve("../work/demo-cassette-still-life.png");
  if (existsSync(image)) copyFileSync(image, resolve(output, "generated-demo-image.png"));
  console.log(`VIEWER READY ${resolve(output, "index.html")}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Demo packaging failed"); process.exitCode = 1; });
