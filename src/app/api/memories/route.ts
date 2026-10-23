import { after } from "next/server";
import { createMemory } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { assertOrigin, json, readJson, route, type RequestDiagnostic } from "@/lib/server/http";
import { newMemoryInput } from "@/lib/server/validation";
import { finalizeImage } from "@/lib/server/images";
import { processIndexJobs } from "@/lib/server/indexing";

export const maxDuration = 120;
export async function POST(request: Request) {
  // Generated here, never accepted from a caller or derived from their story.
  const requestId=crypto.randomUUID();
  let phase:RequestDiagnostic["phase"]="origin";
  const response=await route(async () => {
    assertOrigin(request);
    phase="authorize";
    const actor = await requireActor(request);
    phase="validate";
    const input = await readJson(request, newMemoryInput);
    if (input.type === "image" && input.assetId) {phase="image";await finalizeImage(actor.id, input.assetId);}
    phase="create";
    const memory = await createMemory(actor.id, input);
    phase="index";
    after(async () => { await processIndexJobs(2).catch(() => undefined); });
    return json(memory, 201);
  },()=>({requestId,scope:"memory_publish",phase}));
  response.headers.set("X-Memory-Box-Request-Id",requestId);
  return response;
}
