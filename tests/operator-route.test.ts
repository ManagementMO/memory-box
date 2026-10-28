import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {GET,POST} from "../src/app/api/operator/route";

const actor="53219ac5-08c8-4461-a448-b7e688571fa7";
const memoryId="9554577e-54dd-48f0-8855-b4ea998f4a90";
const reportId="f769c4c3-0adb-43e5-8970-b941eb80c581";
const assetId="42fb8b44-3733-4de6-8704-1573eff5c888";
const requestId="e73d84b3-0988-4ad0-b50b-9ef34c2cb837";
const source={id:memoryId,type:"image",title:"Reported photo",body:"Authored caption",url:null,asset_id:assetId,seed_image_url:null,author_name:"Someone",visibility:"hidden",x:240,y:-120,color:"#FFF3BF",inspired_by:null,version:3,created_at:"2026-10-24T12:00:00Z",updated_at:"2026-10-24T13:00:00Z"};
let mode:"operator"|"guest"|"suspended"|"revoked"|"failure"|"deleted"|"review-conflict";
let requests:{path:string;search:URLSearchParams;body:unknown}[];
const request=(method="GET",body?:unknown,suffix="")=>new Request(`https://box.example/api/operator${suffix}`,{method,headers:{Authorization:"Bearer synthetic-operator-token",Origin:"https://box.example","Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});

beforeEach(()=>{
 mode="operator";requests=[];
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://supabase.example");
 vi.stubEnv("SUPABASE_SECRET_KEY","synthetic-unit-service-key");
 vi.stubGlobal("fetch",vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
  const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
  const body=typeof init?.body==="string"?JSON.parse(init.body):null;
  requests.push({path:url.pathname,search:url.searchParams,body});
  if(url.pathname==="/auth/v1/user")return Response.json({id:actor,aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{is_operator:true},created_at:"2026-10-23T00:00:00Z"});
  if(url.pathname==="/rest/v1/rpc/mb_profile")return Response.json({id:actor,name:"Operator",isOperator:mode!=="guest",suspended:mode==="suspended"});
  if(url.pathname==="/rest/v1/reports")return mode==="failure"?Response.json({code:"XX000",message:"private upstream diagnostic"},{status:500}):Response.json([{id:reportId,memory_id:memoryId,actor_id:"private-reporter",reason:"Please review this photo",bounds:null,state:"open",created_at:"2026-10-24T14:00:00Z"}]);
  if(url.pathname==="/rest/v1/memories")return Response.json(url.searchParams.has("id")?[{...source,visibility:mode==="deleted"?"deleted":"hidden",request_hash:"private-hash",search_document:"private-index"}]:[]);
  if(url.pathname==="/rest/v1/assets")return Response.json({id:assetId,status:"ready",path:"canonical/private.webp",mime:"image/webp"});
  if(url.pathname==="/storage/v1/object/memory-assets/canonical/private.webp")return new Response(new Uint8Array([82,73,70,70]),{headers:{"Content-Type":"image/webp"}});
  if(url.pathname==="/rest/v1/rpc/mb_moderate")return mode==="revoked"?Response.json({code:"42501",message:"OPERATOR_REQUIRED"},{status:403}):Response.json({revision:9,epoch:1});
  if(url.pathname==="/rest/v1/rpc/mb_review_report")return mode==="revoked"?Response.json({code:"42501",message:"OPERATOR_REQUIRED"},{status:403}):mode==="review-conflict"?Response.json({code:"PT409",message:"REPORT_ALREADY_REVIEWED"},{status:409}):Response.json({reportId,requestId,state:body.p_resolution,replayed:false,reviewedAt:"2026-10-27T12:00:00Z"});
  throw new Error(`Unexpected test operation: ${url.pathname}`);
 }));
 vi.spyOn(console,"error").mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});

describe("operator review route",()=>{
 it("requires server authorization before reading any report or source",async()=>{
  const missing=await GET(new Request("https://box.example/api/operator"));
  expect(missing.status).toBe(401);expect(requests).toEqual([]);
  mode="guest";const response=await GET(request());
  expect(response.status).toBe(403);expect(await response.json()).toMatchObject({code:"operator_required"});
  expect(requests.map(r=>r.path)).toEqual(["/auth/v1/user","/rest/v1/rpc/mb_profile"]);
 });
 it("rejects a suspended operator on queue reads and moderation writes",async()=>{
  mode="suspended";
  expect((await GET(request())).status).toBe(403);
  expect((await POST(request("POST",{action:"hide",memoryId}))).status).toBe(403);
  expect(requests.some(r=>r.path.includes("reports")||r.path.includes("mb_moderate"))).toBe(false);
 });
 it("returns current hidden-source context without reporter identities or internal index data",async()=>{
  const response=await GET(request());expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const payload=await response.json();
  expect(payload).toMatchObject({limit:100,hasMore:false,reports:[{id:reportId,reason:"Please review this photo",source:{id:memoryId,title:"Reported photo",body:"Authored caption",visibility:"hidden",authorName:"Someone",imageAvailable:true,version:3}}]});
  expect(JSON.stringify(payload)).not.toMatch(/private-reporter|private-hash|private-index|synthetic-unit-service-key|canonical\/private/);
 });
 it("protects hidden image bytes behind the same operator authorization",async()=>{
  mode="guest";expect((await GET(request("GET",undefined,`?image=${memoryId}`))).status).toBe(403);
  expect(requests.some(r=>r.path.includes("storage"))).toBe(false);
  mode="operator";const response=await GET(request("GET",undefined,`?image=${memoryId}`));
  expect(response.status).toBe(200);expect(response.headers.get("Content-Type")).toBe("image/webp");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([82,73,70,70]);
 });
 it("does not return withdrawn content or its image",async()=>{
  mode="deleted";
  const payload=await (await GET(request())).json();
  expect(payload.reports[0].source).toBeNull();
  expect((await GET(request("GET",undefined,`?image=${memoryId}`))).status).toBe(404);
  expect(requests.some(r=>r.path.includes("storage"))).toBe(false);
 });
 it("uses the audited visibility RPC and reports revocation as a denied action",async()=>{
  const response=await POST(request("POST",{action:"restore",memoryId}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({revision:9,epoch:1});
  expect(requests.find(r=>r.path.endsWith("mb_moderate"))?.body).toEqual({p_actor:actor,p_action:"restore",p_memory_id:memoryId,p_target_actor:null,p_bounds:null});
  mode="revoked";const denied=await POST(request("POST",{action:"hide",memoryId}));
  expect(denied.status).toBe(403);expect(await denied.json()).toMatchObject({code:"operator_required"});
 });
 it("fails without leaking provider diagnostics, and never fetches sources after a report failure",async()=>{
  mode="failure";const response=await GET(request());
  expect(response.status).toBe(503);expect(await response.text()).not.toContain("private upstream");
  expect(requests.some(r=>r.path.endsWith("memories"))).toBe(false);
 });
 it("rejects cross-origin moderation and malformed image identifiers",async()=>{
  const cross=new Request("https://box.example/api/operator",{method:"POST",headers:{Origin:"https://other.example",Authorization:"Bearer synthetic-operator-token"},body:JSON.stringify({action:"hide",memoryId})});
  expect((await POST(cross)).status).toBe(403);expect(requests).toHaveLength(0);
  expect((await GET(request("GET",undefined,"?image=not-a-uuid"))).status).toBe(400);
  expect(requests.some(r=>r.path.includes("storage")||r.path.endsWith("memories"))).toBe(false);
 });
 it.each([{action:"resolve",state:"resolved"},{action:"dismiss",state:"dismissed"}])("submits $action with an explicit request UUID through the private audited transaction",async({action,state})=>{
  const response=await POST(request("POST",{action,reportId,requestId}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({reportId,requestId,state,replayed:false});
  expect(requests.find(r=>r.path.endsWith("mb_review_report"))?.body).toEqual({p_actor:actor,p_report_id:reportId,p_request_id:requestId,p_resolution:state});
  expect(requests.some(r=>r.path.endsWith("mb_moderate")||r.path.endsWith("world_events"))).toBe(false);
 });
 it("requires the report and request IDs before invoking report resolution",async()=>{
  expect((await POST(request("POST",{action:"dismiss",reportId}))).status).toBe(400);
  expect(requests.some(r=>r.path.endsWith("mb_review_report"))).toBe(false);
 });
 it("maps concurrent report review to a conflict and transaction role revocation to denied",async()=>{
  mode="review-conflict";
  const conflict=await POST(request("POST",{action:"dismiss",reportId,requestId}));
  expect(conflict.status).toBe(409);expect(await conflict.json()).toMatchObject({code:"report_already_reviewed"});
  mode="revoked";
  expect((await POST(request("POST",{action:"dismiss",reportId,requestId}))).status).toBe(403);
 });
});
