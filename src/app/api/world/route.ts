import { getSnapshot } from "@/lib/server/database";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function GET() {
  return route(async () => json(await getSnapshot()));
}
