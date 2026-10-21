import { after } from "next/server";
import { requireActor } from "@/lib/server/auth";
import { consumeBudget } from "@/lib/server/database";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";
import { queryInput } from "@/lib/server/validation";
import { retrieve } from "@/lib/server/retrieval";
import { processIndexJobs } from "@/lib/server/indexing";

export const maxDuration = 60;
export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, queryInput);
    await consumeBudget(actor.id, "search", 60, 60);
    await consumeBudget("00000000-0000-0000-0000-000000000000", "global_native_query", 2000, 86400);
    // Leased jobs make concurrent readers safe. Give failed/pending work another
    // opportunity without delaying this result or relying only on the daily cron.
    after(() => processIndexJobs(2));
    return json(await retrieve(input.query, input.sceneId));
  });
}
