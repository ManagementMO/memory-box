import { after } from "next/server";
import { consumeBudget, deleteMemory, updateMemory } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";
import { editMemoryInput, identifier } from "@/lib/server/validation";
import { processIndexJobs } from "@/lib/server/indexing";

export const maxDuration = 120;
type Context = {params: Promise<{id:string}>};

export async function PATCH(request: Request, {params}: Context) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const id = identifier.parse((await params).id);
    const {expectedVersion, ...patch} = await readJson(request, editMemoryInput);
    await consumeBudget(actor.id, "memory_edit", 30, 600);
    const memory = await updateMemory(actor.id, id, expectedVersion, patch);
    after(async () => { await processIndexJobs(2).catch(() => undefined); });
    return json(memory);
  });
}

export async function DELETE(request: Request, {params}: Context) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const id = identifier.parse((await params).id);
    await deleteMemory(actor.id, id);
    return json({ok:true});
  });
}
