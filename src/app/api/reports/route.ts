import { consumeBudget, createReport } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";
import { reportInput } from "@/lib/server/validation";

export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, reportInput);
    await consumeBudget(actor.id, "report", 10, 3600);
    await createReport(actor.id, input);
    return json({ok:true});
  });
}
