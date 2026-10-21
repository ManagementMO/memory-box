import { timingSafeEqual } from "node:crypto";
import { ApiError, json, route } from "@/lib/server/http";
import { processIndexJobs } from "@/lib/server/indexing";
import { processAssetCleanup } from "@/lib/server/asset-cleanup";

export const maxDuration = 120;
export async function GET(request: Request) {
  return route(async () => {
    const expected = process.env.CRON_SECRET;
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!expected || !token || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw new ApiError(401, "This endpoint is private.", "unauthorized");
    const [indexing, cleanup] = await Promise.all([processIndexJobs(4), processAssetCleanup(100)]);
    return json({...indexing, cleanup});
  });
}
