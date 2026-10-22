import { z } from "zod";
import { undoPaint } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { ApiError, assertOrigin, json, readJson, route } from "@/lib/server/http";

export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, z.object({operationId:z.uuid()}));
    try { return json(await undoPaint(actor.id, input.operationId)); }
    catch (error) {
      if (error instanceof Error && error.message === "UNDO_UNAVAILABLE") throw new ApiError(409, "That paint cannot be undone anymore. Later changes remain in place.", "undo_unavailable");
      throw error;
    }
  });
}
