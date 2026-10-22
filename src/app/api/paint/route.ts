import { applyPaint, getPaintTurn } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";
import { paintInput } from "@/lib/server/validation";

export async function GET(request: Request) {
  return route(async () => {
    const actor = await requireActor(request);
    return json(await getPaintTurn(actor.id));
  });
}

export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, paintInput);
    const result = await applyPaint(actor.id, input.opId, input.cells, input.sceneId);
    if (result.status === "cooldown") {
      return new Response(JSON.stringify({ ...result, code: "paint_cooldown", error: "Your next paint turn is almost ready. Your preview is still here." }), {
        status: 429, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) },
      });
    }
    return json(result);
  });
}
