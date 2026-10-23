import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

// Exercise the installed Supabase SDK, authentication, RPC wrapper and route.
// Only the network boundary and Next's post-response scheduler are replaced.
vi.mock("next/server",()=>({after:vi.fn()}));
vi.mock("@/lib/server/images",()=>({finalizeImage:vi.fn()}));
vi.mock("@/lib/server/indexing",()=>({processIndexJobs:vi.fn()}));

import {POST} from "../src/app/api/memories/route";

const actor="53219ac5-08c8-4461-a448-b7e688571fa7";
const input={clientId:"e6247436-ce05-48ce-913c-a1f0908350da",type:"text",title:"A boat",body:"Build beside this boat.",color:"#DCC7F0",x:200,y:200,sceneId:"garden"};
const saved={id:"9554577e-54dd-48f0-8855-b4ea998f4a90",authorId:actor,...input};
const request=()=>new Request("https://box.example/api/memories",{method:"POST",headers:{
  Origin:"https://box.example",Authorization:"Bearer synthetic-unit-token","Content-Type":"application/json",
  "X-Memory-Box-Request-Id":"untrusted-client-value",
},body:JSON.stringify(input)});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let mode:"saved"|"proxy"|"conflict";
let operations:string[];

beforeEach(()=>{
  mode="saved";operations=[];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://supabase.example");
  vi.stubEnv("SUPABASE_SECRET_KEY","synthetic-unit-service-key");
  vi.stubGlobal("fetch",vi.fn(async(url:string|URL|Request)=>{
    const path=new URL(typeof url==="string"?url:url instanceof URL?url.href:url.url).pathname;
    operations.push(path);
    if(path==="/auth/v1/user")return Response.json({id:actor,aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{},created_at:"2026-10-23T00:00:00Z"});
    if(path==="/rest/v1/rpc/mb_profile")return mode==="proxy"
      ?new Response('<?xml version="1.0"?><html>Private upstream body, token=secret</html>',{status:502,headers:{"Content-Type":"text/html"}})
      :Response.json({id:actor,name:"guest",suspended:false});
    if(path==="/rest/v1/rpc/mb_create_memory")return mode==="conflict"
      ?Response.json({code:"23505",message:"IDEMPOTENCY_CONFLICT"},{status:409})
      :Response.json(saved);
    throw new Error("Unexpected test network operation");
  }));
  vi.spyOn(console,"error").mockImplementation(()=>{});
  vi.spyOn(console,"warn").mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});

describe("memory publish failure provenance",()=>{
  it("keeps an XML gateway failure out of the conflict path and correlates its authorization phase",async()=>{
    mode="proxy";
    const response=await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({code:"service_unavailable"});
    expect(operations).toEqual(["/auth/v1/user","/rest/v1/rpc/mb_profile"]);
    const requestId=response.headers.get("X-Memory-Box-Request-Id");
    expect(requestId).toEqual(expect.stringMatching(uuid));
    expect(console.error).toHaveBeenCalledWith("Memory Box request failed",{
      kind:"DatabaseError",operation:"mb_profile",code:"database_error",upstreamStatus:502,
      requestId,scope:"memory_publish",phase:"authorize",
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/Private|secret|synthetic-unit|53219ac5|untrusted-client/);
    expect(console.warn).not.toHaveBeenCalled();
  });
  it("records a genuine create conflict without copying the story, identity or credentials",async()=>{
    mode="conflict";
    const response=await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:"conflict"});
    const requestId=response.headers.get("X-Memory-Box-Request-Id");
    expect(requestId).toEqual(expect.stringMatching(uuid));
    expect(console.warn).toHaveBeenCalledWith("Memory Box save conflict",{
      kind:"DatabaseError",operation:"mb_create_memory",code:"23505",upstreamStatus:409,
      requestId,scope:"memory_publish",phase:"create",conflict:"IDEMPOTENCY_CONFLICT",
    });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/boat|53219ac5|e6247436|synthetic-unit|untrusted-client/);
    expect(console.error).not.toHaveBeenCalled();
  });
  it("gives successful requests independent server-generated receipts without logging their contents",async()=>{
    const first=await POST(request()),second=await POST(request());
    expect(first.status).toBe(201);expect(await first.json()).toEqual(saved);
    expect(second.status).toBe(201);expect(await second.json()).toEqual(saved);
    expect(first.headers.get("Cache-Control")).toBe("no-store");
    const a=first.headers.get("X-Memory-Box-Request-Id"),b=second.headers.get("X-Memory-Box-Request-Id");
    expect(a).toEqual(expect.stringMatching(uuid));expect(b).toEqual(expect.stringMatching(uuid));expect(a).not.toBe(b);
    expect(console.warn).not.toHaveBeenCalled();expect(console.error).not.toHaveBeenCalled();
  });
});
