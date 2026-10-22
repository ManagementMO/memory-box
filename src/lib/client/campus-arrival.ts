import type { Memory } from "../types";
import { WATERLOO_ARRIVAL } from "../waterloo-landmarks";

/** Only a persisted, explicitly labeled starter anchor enables campus arrival. */
export function campusArrival(memories: Pick<Memory,"id"|"isSeed">[]) {
  if(!memories.some(memory=>memory.isSeed&&memory.id===WATERLOO_ARRIVAL.anchorMemoryId))return null;
  const {x,y,width,height}=WATERLOO_ARRIVAL;
  return {x,y,width,height};
}
