import { adminClient, consumeBudget, createAsset } from "@/lib/server/database";
import { requireActor } from "@/lib/server/auth";
import { ApiError, assertOrigin, json, readJson, route } from "@/lib/server/http";
import { uploadInput } from "@/lib/server/validation";

export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireActor(request);
    const input = await readJson(request, uploadInput);
    await consumeBudget(actor.id, "upload", 12, 3600);
    await consumeBudget("00000000-0000-0000-0000-000000000000", "global_upload", 60, 86400);
    const asset = await createAsset(actor.id, input);
    const result = await adminClient().storage.from("memory-staging").createSignedUploadUrl(asset.staging_path, {upsert:false});
    if (result.error || !result.data) throw new ApiError(503, "The upload could not start. Try again.", "upload_unavailable");
    return json({assetId:asset.id, path:asset.staging_path, token:result.data.token});
  });
}
