import type {Memory} from "../types";

/** The snapshot already excludes hidden/withdrawn originals. No inferred builds. */
export function openBuildInvitations(memories:Memory[]):Memory[] {
  return memories.filter(memory=>memory.isBuildInvitation===true).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
}
