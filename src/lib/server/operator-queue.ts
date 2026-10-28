import {adminClient,DatabaseError,getAsset} from "./database";
import {ApiError} from "./http";
import {trustedSeedImagePath} from "./trusted-seed-image";
import type {OperatorQueue,OperatorReport,OperatorReportReview,OperatorSource} from "../operator-types";
import type {MemoryType} from "../types";

const LIMIT=100;
const SOURCE_FIELDS="id,type,title,body,url,author_name,visibility,asset_id,seed_image_url,is_seed,x,y,version,updated_at,inspired_by";
interface SourceRow {
  id:string;type:MemoryType;title:string;body:string;url:string|null;author_name:string;
  visibility:"published"|"hidden"|"deleted";asset_id:string|null;seed_image_url:string|null;is_seed:boolean;
  x:number;y:number;version:number;updated_at:string;inspired_by:string|null;
}
interface ReportRow {
  id:string;memory_id:string|null;bounds:OperatorReport["bounds"];reason:string;created_at:string;
}
function sourceContext(row:SourceRow):OperatorSource|null {
  if(row.visibility!=="published"&&row.visibility!=="hidden")return null;
  const seedPath=trustedSeedImagePath({type:row.type,imageUrl:row.seed_image_url,isSeed:row.is_seed});
  return {id:row.id,type:row.type,title:row.title,body:row.body,url:row.url,authorName:row.author_name,
    visibility:row.visibility,imageAvailable:row.type==="image"&&Boolean(row.asset_id||seedPath),
    seedImageUrl:seedPath?`/${seedPath}`:null,x:row.x,y:row.y,version:row.version,updatedAt:row.updated_at,inspiredBy:row.inspired_by};
}

/** Server only. The calling route must verify the current unsuspended operator. */
export async function getOperatorQueue():Promise<OperatorQueue> {
  const {data,error}=await adminClient().from("reports").select("id,memory_id,bounds,reason,created_at")
    .eq("state","open").order("created_at",{ascending:false}).order("id",{ascending:false}).limit(LIMIT+1);
  if(error)throw new DatabaseError(error.message,error.code,"reports.list");
  const rows=(data??[]) as ReportRow[];
  const visibleRows=rows.slice(0,LIMIT);
  const ids=[...new Set(visibleRows.flatMap(row=>row.memory_id?[row.memory_id]:[]))];
  const sources=new Map<string,OperatorSource|null>();
  if(ids.length){
    const result=await adminClient().from("memories").select(SOURCE_FIELDS).in("id",ids);
    if(result.error)throw new DatabaseError(result.error.message,result.error.code);
    for(const row of (result.data??[]) as SourceRow[])sources.set(row.id,sourceContext(row));
  }
  return {limit:LIMIT,hasMore:rows.length>LIMIT,reports:visibleRows.map(row=>({id:row.id,memoryId:row.memory_id,
    bounds:row.bounds,reason:row.reason,createdAt:row.created_at,source:row.memory_id?sources.get(row.memory_id)??null:null}))};
}

/** Never makes hidden assets public or issues a reusable signed URL. */
export async function getOperatorImage(memoryId:string):Promise<Blob> {
  const {data,error}=await adminClient().from("memories").select(SOURCE_FIELDS).eq("id",memoryId).maybeSingle();
  if(error)throw new DatabaseError(error.message,error.code);
  const source=data as SourceRow|null;
  if(!source||source.type!=="image"||source.visibility==="deleted"||!source.asset_id){
    throw new ApiError(404,"This image is no longer available.","not_found");
  }
  const asset=await getAsset(source.asset_id);
  if(!asset||asset.status!=="ready"||!asset.path)throw new ApiError(404,"This image is no longer available.","not_found");
  const result=await adminClient().storage.from("memory-assets").download(asset.path);
  if(result.error||!result.data)throw new ApiError(503,"The image could not be loaded. Try again.","image_unavailable");
  return result.data;
}

/** The service-only transaction rechecks permissions and audits the transition. */
export async function reviewOperatorReport(actorId:string,reportId:string,action:"resolve"|"dismiss",requestId:string):Promise<OperatorReportReview> {
  const {data,error,status}=await adminClient().rpc("mb_review_report",{
    p_actor:actorId,p_report_id:reportId,p_resolution:action==="resolve"?"resolved":"dismissed",p_request_id:requestId,
  });
  if(error)throw new DatabaseError(error.message,error.code||"database_error","mb_review_report",status);
  return data as OperatorReportReview;
}
