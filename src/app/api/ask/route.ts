import { after } from "next/server";
import { requireActor } from "@/lib/server/auth";
import { consumeBudget } from "@/lib/server/database";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";
import { queryInput } from "@/lib/server/validation";
import { ask } from "@/lib/server/retrieval";
import { processIndexJobs } from "@/lib/server/indexing";

export const maxDuration = 90;
export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, queryInput);
    await consumeBudget(actor.id, "ask", 12, 3600);
    // One global allowance bounds a public pilot even across guest sessions.
    await consumeBudget("00000000-0000-0000-0000-000000000000", "global_ask", 120, 86400);
    await consumeBudget("00000000-0000-0000-0000-000000000000", "global_native_query", 2000, 86400);
    after(() => processIndexJobs(2));
    return json(await ask(input.query, input.sceneId));
  });
}
