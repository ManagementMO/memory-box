import { createHash } from "node:crypto";
import { getSnapshot } from "@/lib/server/database";
import { route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return route(async () => {
    // A revision alone is not a validator: indexing can change descriptions
    // and source status without a canvas mutation. Always read fresh public
    // evidence, then validate every field of the representation we would send.
    const body = JSON.stringify(await getSnapshot());
    const etag = `W/"mb-${createHash("sha256").update(body).digest("base64url")}"`;
    const headers = { "Cache-Control": "no-store", ETag: etag };
    const matches = request.headers.get("If-None-Match")?.split(",").some(value => {
      const tag = value.trim();
      return tag === "*" || tag.replace(/^W\//, "") === etag.slice(2);
    });
    return matches ? new Response(null, { status: 304, headers })
      : new Response(body, { headers: { ...headers, "Content-Type": "application/json" } });
  });
}
