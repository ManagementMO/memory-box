import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Memory } from "../types";
import { adminClient, completeIndexJob, failIndexJob, getIndexJobs, getReadableAsset, type IndexJob } from "./database";
import { AIServiceError, describeImage, embedText, getAIModels } from "./ai";
import { trustedSeedImagePath } from "./trusted-seed-image";

async function imageForMemory(memory: Memory) {
  if (memory.type !== "image" || !memory.imageUrl) throw new Error("index_image_unavailable");
  const seedPath = trustedSeedImagePath(memory);
  if (seedPath) {
    const original = await readFile(path.join(process.cwd(), "public", seedPath));
    return {bytes: await sharp(original).webp().toBuffer(), mime:"image/webp"};
  }
  const assetId = memory.imageUrl.match(/^\/api\/assets\/([a-f0-9-]{36})$/)?.[1];
  if (!assetId) throw new Error("index_image_unavailable");
  const asset = await getReadableAsset(assetId);
  if (!asset?.path) throw new Error("index_image_unavailable");
  const result = await adminClient().storage.from("memory-assets").download(asset.path);
  if (result.error || !result.data) throw new Error("index_image_unavailable");
  return {bytes:new Uint8Array(await result.data.arrayBuffer()), mime:"image/webp"};
}

export async function processIndexJobs(limit = 2) {
  const jobs = await getIndexJobs(Math.min(limit, 4));
  return processLeasedIndexJobs(jobs);
}

/** Process only jobs already leased by an authorized caller. Source-version
 * completion remains the authority; this does not obtain or bypass a lease. */
export async function processLeasedIndexJobs(jobs: IndexJob[]) {
  let completed = 0;
  let failed = 0;
  await Promise.all(jobs.map(async job => {
    try {
      const memory = job.memory;
      let description = memory.type === "image" ? memory.imageDescription || "" : "";
      if (memory.type === "image" && !description) {
        const image = await imageForMemory(memory);
        description = await describeImage(image.bytes, image.mime);
      }
      const representation = [
        `Title: ${memory.title}`,
        `Author's words: ${memory.body}`,
        `Scene: ${memory.sceneId}`,
        memory.url ? `Link supplied by author: ${memory.url}` : "",
        description ? `Machine-derived visual description: ${description}` : ""
      ].filter(Boolean).join("\n");
      // Search geometry should describe the contribution itself. Generic
      // provenance labels and scene boilerplate made unrelated seed notes
      // artificially similar in the small GTE pilot calibration.
      const embedding = await embedText([memory.title, memory.body, description].filter(Boolean).join("\n"));
      // Caption, vector and source eligibility commit together. Never overwrite
      // a shared asset's description outside the version/lease fence.
      const accepted = await completeIndexJob(job.id, job.source_version, job.attempts, representation, embedding, getAIModels().embedding, description || null);
      if (accepted) completed++;
    } catch (error) {
      failed++;
      await failIndexJob(job.id, job.attempts, error instanceof AIServiceError ? error.code : "indexing_failed");
    }
  }));
  return {completed, failed, leased:jobs.length};
}
