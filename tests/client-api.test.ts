import { afterEach,describe,expect,it,vi } from "vitest";

vi.mock("../src/lib/client/supabase",()=>({guestSession:async()=>({access_token:"synthetic-unit-test-token"}),getBrowserSupabase:()=>({})}));
import { api,ApiError } from "../src/lib/client/api";

afterEach(()=>vi.unstubAllGlobals());
describe("client cooldown transport",()=>{
  it("retains a structured turn and accurate retry metadata from a real-shaped429 response",async()=>{
    const timing={serverTime:"2026-10-22T04:00:00Z",nextPaintAt:"2026-10-22T04:00:03.500Z",cooldownSeconds:15};
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({...timing,error:"Your preview is still here.",code:"paint_cooldown",retryAfterMs:3500}),{status:429,headers:{"Retry-After":"4"}})));
    try{await api("/api/paint",{method:"POST",body:"{}"});throw new Error("Expected rejection");}
    catch(error){expect(error).toBeInstanceOf(ApiError);expect(error).toMatchObject({status:429,code:"paint_cooldown",retryAfterSeconds:4,paintTurn:timing});}
  });
  it("drops malformed timing/header values and preserves a usable failure message",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({error:"Try again.",code:"<script>",serverTime:"oops",nextPaintAt:"later",cooldownSeconds:Infinity}),{status:429,headers:{"Retry-After":"99999999"}})));
    await expect(api("/api/paint")).rejects.toMatchObject({message:"Try again.",code:"request_failed",retryAfterSeconds:undefined,paintTurn:undefined});
  });
});
