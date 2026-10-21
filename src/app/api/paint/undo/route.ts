import { z } from "zod";
import { undoPaint } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";

export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, z.object({operationId:z.uuid()}));
    return json(await undoPaint(actor.id, input.operationId));
  });
}
