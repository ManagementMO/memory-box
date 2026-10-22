import { timingSafeEqual } from "node:crypto";
import { ApiError, json, route } from "@/lib/server/http";
import { processIndexJobs } from "@/lib/server/indexing";
import { processAssetCleanup, processReadyStagingCleanup } from "@/lib/server/asset-cleanup";

export const maxDuration = 120;
export async function GET(request: Request) {
  return route(async () => {
    const expected = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    const actualBytes = Buffer.from(token ?? ""), expectedBytes = Buffer.from(expected ?? "");
    if (!expected || !token || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) throw new ApiError(401, "This endpoint is private.", "unauthorized");
    const [indexing, cleanup, stagingCleanup] = await Promise.all([processIndexJobs(4), processAssetCleanup(100), processReadyStagingCleanup(100)]);
    return json({...indexing, cleanup, stagingCleanup});
  });
}
