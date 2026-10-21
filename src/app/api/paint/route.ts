import { applyPaint } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";
import { paintInput } from "@/lib/server/validation";

export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, paintInput);
    return json(await applyPaint(actor.id, input.opId, input.cells, input.sceneId));
  });
}
