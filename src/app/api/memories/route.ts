import { after } from "next/server";
import { createMemory } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";
import { newMemoryInput } from "@/lib/server/validation";
import { finalizeImage } from "@/lib/server/images";
import { processIndexJobs } from "@/lib/server/indexing";

export const maxDuration = 120;
export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, newMemoryInput);
    if (input.type === "image" && input.assetId) await finalizeImage(actor.id, input.assetId);
    const memory = await createMemory(actor.id, input);
    after(async () => { await processIndexJobs(2).catch(() => undefined); });
    return json(memory, 201);
  });
}
