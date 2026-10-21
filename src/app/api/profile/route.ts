import { updateProfile } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { assertOrigin, json, readJson, route } from "@/lib/server/http";
import { profileInput } from "@/lib/server/validation";

export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, profileInput);
    await updateProfile(actor.id, input.name);
    return json({id:actor.id, name:input.name, isAnonymous:actor.user.is_anonymous ?? false});
  });
}
