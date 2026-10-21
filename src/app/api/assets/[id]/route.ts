import { adminClient, getReadableAsset } from "@/lib/server/database";
import { ApiError, route } from "@/lib/server/http";
import { identifier } from "@/lib/server/validation";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, {params}: {params: Promise<{id:string}>}) {
  return route(async () => {
    const id = identifier.parse((await params).id);
    const asset = await getReadableAsset(id);
    if (!asset || !asset.path) throw new ApiError(404, "This image is no longer available.", "not_found");
    const result = await adminClient().storage.from("memory-assets").download(asset.path);
    if (result.error || !result.data) throw new ApiError(404, "This image is no longer available.", "not_found");
    return new Response(await result.data.arrayBuffer(), {headers:{
      "Content-Type": "image/webp",
      "Content-Disposition": "inline; filename=memory.webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }});
  });
}
