import {describe,expect,it,vi} from "vitest";
import {z} from "zod";
import {assertOrigin,errorResponse,MAX_JSON_BYTES,readJson} from "../src/lib/server/http";

describe("same-origin mutations",()=>{
  it("accepts the actual localhost origin when Next binds to all interfaces",()=>{
    expect(()=>assertOrigin(new Request("http://0.0.0.0:3007/api/memories",{headers:{Host:"localhost:3007",Origin:"http://localhost:3007"}}))).not.toThrow();
  });
  it("rejects a different website even when its request targets the app",()=>{
    expect(()=>assertOrigin(new Request("https://memory-box.example/api/memories",{headers:{Host:"memory-box.example",Origin:"https://someone-else.example"}}))).toThrow("Open Memory Box directly");
  });
});

describe("bounded JSON bodies",()=>{
  const schema=z.object({name:z.string()});
  const request=(body:string,headers:Record<string,string>={})=>new Request("http://localhost/api/profile",{method:"POST",body,headers});
  it.each<Record<string,string>>([{}, {"Content-Length":"1"}])("rejects oversized bodies without trusting their length header %j",async headers=>{
    const body=JSON.stringify({name:"guest",ignored:"x".repeat(MAX_JSON_BYTES)});
    await expect(readJson(request(body,headers),schema)).rejects.toMatchObject({status:413,code:"request_too_large"});
  });
  it("measures UTF-8 bytes rather than JavaScript characters",async()=>{
    const body=JSON.stringify({name:"🪿".repeat(25_000)});
    expect(body.length).toBeLessThan(MAX_JSON_BYTES);
    await expect(readJson(request(body),schema)).rejects.toMatchObject({status:413,code:"request_too_large"});
  });
  it("accepts the exact byte boundary",async()=>{
    const body=JSON.stringify({name:"x".repeat(MAX_JSON_BYTES-11)});
    expect(new TextEncoder().encode(body)).toHaveLength(MAX_JSON_BYTES);
    await expect(readJson(request(body),schema)).resolves.toEqual({name:"x".repeat(MAX_JSON_BYTES-11)});
  });
  it("decodes multibyte characters split across stream chunks",async()=>{
    const bytes=new TextEncoder().encode(JSON.stringify({name:"🪿"}));
    const stream=new ReadableStream<Uint8Array>({start(controller){
      for(const byte of bytes)controller.enqueue(new Uint8Array([byte]));
      controller.close();
    }});
    const streamed=new Request("http://localhost/api/profile",{method:"POST",body:stream,duplex:"half"} as RequestInit);
    await expect(readJson(streamed,schema)).resolves.toEqual({name:"🪿"});
  });
  it("cancels an over-limit stream before consuming its remaining chunks",async()=>{
    const cancel=vi.fn();let pulls=0;
    const stream=new ReadableStream<Uint8Array>({pull(controller){pulls++;controller.enqueue(new Uint8Array(60_000));},cancel},{highWaterMark:0});
    const streamed=new Request("http://localhost/api/profile",{method:"POST",body:stream,duplex:"half"} as RequestInit);
    await expect(readJson(streamed,schema)).rejects.toMatchObject({status:413,code:"request_too_large"});
    expect(pulls).toBe(2);expect(cancel).toHaveBeenCalledOnce();
  });
  it("preserves invalid-JSON and schema-validation responses",async()=>{
    await expect(readJson(request("{broken"),schema)).rejects.toMatchObject({status:400,code:"invalid_json"});
    await expect(readJson(request('{"name":7}'),schema)).rejects.toBeInstanceOf(z.ZodError);
    const used=request('{"name":"guest"}');await used.json();
    await expect(readJson(used,schema)).rejects.toMatchObject({status:400,code:"invalid_json"});
  });
});

describe("expected authorization failures",()=>{
  it("returns forbidden for SQL profile rejection of a suspended actor",async()=>{
    const response=errorResponse(new Error("ACCOUNT_SUSPENDED"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error:"This session cannot contribute right now.",code:"session_suspended"});
  });
});
