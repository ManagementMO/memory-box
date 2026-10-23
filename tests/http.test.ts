import {describe,expect,it,vi} from "vitest";
import {z} from "zod";
import {assertOrigin,errorResponse,MAX_JSON_BYTES,readJson} from "../src/lib/server/http";
import {DatabaseError} from "../src/lib/server/database";

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
  it("returns an invalid session when a verified actor is revoked before a dependent database call",async()=>{
    const error=new DatabaseError("AUTH_REQUIRED","PT401");
    const response=errorResponse(error);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("invalid_session");
  });
  it("handles only the exact legacy missing-auth-parent constraint as a revoked session",async()=>{
    const error=new DatabaseError('insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"',"23503");
    const response=errorResponse(error);
    expect(response.status).toBe(401);expect((await response.json()).code).toBe("invalid_session");
  });
  it("explains a blank invitation rejected on an older client's edit",async()=>{
    const response=errorResponse(new Error('new row for relation "memories" violates check constraint "build_invitation_has_words"'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error:"Say what people can help make, or close the invitation before removing its words.",code:"invalid_input"});
  });
  it("returns forbidden for SQL profile rejection of a suspended actor",async()=>{
    const response=errorResponse(new Error("ACCOUNT_SUSPENDED"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error:"This session cannot contribute right now.",code:"session_suspended"});
  });
});

describe("safe database diagnostics",()=>{
  it("keeps operation and SQLSTATE without copying messages, request arguments or credentials",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try{
      const error=Object.assign(new DatabaseError("private story, token=secret, id=private-actor","57014"),{operation:"mb_snapshot",details:{Authorization:"Bearer secret"}});
      const response=errorResponse(error);
      expect(response.status).toBe(503);expect((await response.json()).code).toBe("service_unavailable");
      expect(log).toHaveBeenCalledWith("Memory Box request failed",{kind:"DatabaseError",operation:"mb_snapshot",code:"57014"});
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|private story|private-actor|Authorization/);
    }finally{log.mockRestore();}
  });
  it("does not turn other integrity failures into a session error or log unbounded diagnostic fields",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try{
      const error=Object.assign(new DatabaseError('foreign key constraint "assets_owner_id_fkey"',"23503\nsecret"),{operation:"mb_snapshot\nBearer secret"});
      expect(errorResponse(error).status).toBe(503);
      expect(log).toHaveBeenCalledWith("Memory Box request failed",{kind:"DatabaseError"});
    }finally{log.mockRestore();}
  });
});
