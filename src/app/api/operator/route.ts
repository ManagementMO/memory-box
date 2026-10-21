import { z } from "zod";
import { requireActor } from "@/lib/server/auth";
import { listReports, moderate } from "@/lib/server/database";
import { ApiError, assertOrigin, json, readJson, route } from "@/lib/server/http";
import { reportInput } from "@/lib/server/validation";

const moderationInput = z.object({
  action:z.enum(["hide","restore","pause","resume","clear","suspend","unsuspend"]),
  memoryId:z.uuid().optional(),
  targetActorId:z.uuid().optional(),
  bounds:reportInput.shape.bounds
}).superRefine((input,ctx)=>{
  if (["hide","restore"].includes(input.action)&&!input.memoryId) ctx.addIssue({code:"custom",message:"Choose a memory."});
  if (input.action==="clear"&&!input.bounds) ctx.addIssue({code:"custom",message:"Choose the area to clear."});
  if (["suspend","unsuspend"].includes(input.action)&&!input.targetActorId) ctx.addIssue({code:"custom",message:"Choose a contributor."});
});

export async function GET(request: Request) {
  return route(async()=>{
    const actor=await requireActor(request);
    if(!actor.profile.isOperator)throw new ApiError(403,"This view is available to box operators.","operator_required");
    return json({reports:await listReports()});
  });
}

export async function POST(request: Request) {
  return route(async()=>{
    assertOrigin(request);
    const actor=await requireActor(request);
    if(!actor.profile.isOperator)throw new ApiError(403,"This action is available to box operators.","operator_required");
    const {action,...options}=await readJson(request,moderationInput);
    return json(await moderate(actor.id,action,options));
  });
}
