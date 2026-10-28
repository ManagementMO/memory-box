import { z } from "zod";
import { requireActor } from "@/lib/server/auth";
import { DatabaseError, moderate } from "@/lib/server/database";
import {getOperatorImage,getOperatorQueue,reviewOperatorReport} from "@/lib/server/operator-queue";
import { ApiError, assertOrigin, json, readJson, route } from "@/lib/server/http";
import { identifier, reportInput } from "@/lib/server/validation";

export const dynamic="force-dynamic";

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
const reviewInput=z.object({action:z.enum(["resolve","dismiss"]),reportId:z.uuid(),requestId:z.uuid()}).strict();
const operatorInput=z.union([reviewInput,moderationInput]);

export async function GET(request: Request) {
  return route(async()=>{
    const actor=await requireActor(request);
    if(!actor.profile.isOperator)throw new ApiError(403,"This view is available to box operators.","operator_required");
    const imageId=new URL(request.url).searchParams.get("image");
    if(imageId!==null){
      const image=await getOperatorImage(identifier.parse(imageId));
      return new Response(image,{headers:{"Content-Type":"image/webp","Content-Disposition":"inline; filename=review.webp",
        "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
    }
    return json(await getOperatorQueue());
  });
}

export async function POST(request: Request) {
  return route(async()=>{
    assertOrigin(request);
    const actor=await requireActor(request);
    if(!actor.profile.isOperator)throw new ApiError(403,"This action is available to box operators.","operator_required");
    const input=await readJson(request,operatorInput);
    try {
      if("reportId" in input)return json(await reviewOperatorReport(actor.id,input.reportId,input.action,input.requestId));
      const {action,...options}=input;
      return json(await moderate(actor.id,action,options));
    } catch(error) {
      // The transaction rechecks privileges; a role revoked after the route's
      // initial check must remain an explicit denied action, not an outage.
      if(error instanceof DatabaseError&&error.message==="OPERATOR_REQUIRED")throw new ApiError(403,"This action is available to box operators.","operator_required");
      if("reportId" in input&&error instanceof DatabaseError){
        if(error.message==="REPORT_ALREADY_REVIEWED")throw new ApiError(409,"This report was reviewed elsewhere. Refresh the queue before continuing.","report_already_reviewed");
        if(error.message==="IDEMPOTENCY_CONFLICT")throw new ApiError(409,"This review request belongs to another action. Refresh the queue before continuing.","review_request_conflict");
        if(error.message==="REPORT_UNAVAILABLE")throw new ApiError(404,"This report is no longer available. Refresh the queue.","report_unavailable");
      }
      throw error;
    }
  });
}
