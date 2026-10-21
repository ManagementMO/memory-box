import {adminClient, claimAssetCleanup, completeAssetCleanup} from "./database";

export async function processAssetCleanup(limit = 25) {
  const jobs = await claimAssetCleanup(Math.max(1, Math.min(limit, 100)));
  let removed = 0, failed = 0;
  const storage = adminClient().storage;
  // Bound storage concurrency while letting the daily sweep exceed the pilot's
  // maximum 60 new upload reservations, so abandoned files do not accumulate.
  for (let offset = 0; offset < jobs.length; offset += 5) {
    await Promise.all(jobs.slice(offset, offset + 5).map(async asset => {
      try {
        if (asset.staging_path) {
          const result = await storage.from("memory-staging").remove([asset.staging_path]);
          if (result.error) throw new Error("storage_cleanup_failed");
        }
        // A finalization interrupted before readiness can leave its immutable
        // canonical object without a recorded path. Its key is deterministic.
        const canonicalPath = asset.path || `${asset.staging_path.split("/")[0]}/${asset.id}.webp`;
        if (canonicalPath) {
          const result = await storage.from("memory-assets").remove([canonicalPath]);
          if (result.error) throw new Error("storage_cleanup_failed");
        }
        if (!await completeAssetCleanup(asset.id)) throw new Error("cleanup_claim_changed");
        removed++;
      } catch { failed++; }
    }));
  }
  return {claimed:jobs.length, removed, failed};
}
