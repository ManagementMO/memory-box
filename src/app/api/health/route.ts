import { getSnapshot } from "@/lib/server/database";
import { getAIModels } from "@/lib/server/ai";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const snapshot = await getSnapshot();
    return json({ok:true,service:"memory-box",revision:snapshot.revision,memories:snapshot.memories.length,indexed:snapshot.memories.filter(memory=>memory.indexStatus==="ready").length,models:getAIModels()});
  } catch { return json({ok:false,service:"memory-box"},503); }
}
