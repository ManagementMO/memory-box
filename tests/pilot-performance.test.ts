import {describe,expect,it} from "vitest";
import {pilotOrigin,runWorldPilot} from "../scripts/lib/pilot-performance";

const body={worldId:"commons",revision:14,epoch:1,memories:[{body:"private to the response"}],pixels:[{x:1,y:1,color:"#FFFFFF"}],events:[]};
const reply=()=>Response.json(body,{headers:{ETag:'W/"fixture"'}});
describe("bounded world pilot",()=>{
  it.each(["http://localhost:3007","http://127.0.0.1:3007","https://memory-box-commons.vercel.app/"])("allows the explicit pilot target %s",origin=>{
    expect(pilotOrigin(origin)).toBe(origin.replace(/\/$/,""));
  });
  it.each(["https://other-project.vercel.app","https://memory-box-commons.vercel.app/?arrival=inside-world","https://user:secret@memory-box-commons.vercel.app","file:///api/world","https://memory-box-commons.vercel.app:444"])("rejects unrelated, preview or credential-bearing target %s",origin=>{
    expect(()=>pilotOrigin(origin)).toThrow(/canonical|loopback|origin/i);
  });
  it("uses only bounded public GETs, measures full and conditional bodies and omits original content",async()=>{
    const calls:Array<{url:string;headers:Headers}>=[];let active=0,maximum=0;
    const fetcher=(async(url,init)=>{
      active++;maximum=Math.max(maximum,active);calls.push({url:String(url),headers:new Headers(init?.headers)});
      expect(init?.method).toBe("GET");expect(init?.redirect).toBe("error");expect(init?.credentials).toBe("omit");
      await new Promise(resolve=>setTimeout(resolve,1));active--;
      return new Headers(init?.headers).has("If-None-Match")?new Response(null,{status:304,headers:{ETag:'W/"fixture"'}}):reply();
    }) as typeof fetch;
    const report=await runWorldPilot({origin:"http://localhost:3007",fetcher,pause:async()=>{}});
    expect(calls).toHaveLength(8);expect(maximum).toBe(2);expect(calls.every(call=>call.url==="http://localhost:3007/api/world")).toBe(true);
    expect(report.samples.filter(sample=>sample.status===304)).toHaveLength(4);
    expect(report.samples.filter(sample=>sample.status===304).every(sample=>sample.decodedBytes===0)).toBe(true);
    expect(report.samples[0]).toMatchObject({world:{revision:14,epoch:1,memories:1,pixels:1},decodedBytes:Buffer.byteLength(JSON.stringify(body))});
    expect(JSON.stringify(report)).not.toContain("private to the response");expect(report.stopped).toBeNull();
  });
  it("does not invent a validator when the server does not advertise one",async()=>{
    let count=0;const fetcher=(async(_url,init)=>{count++;expect(new Headers(init?.headers).has("If-None-Match")).toBe(false);return Response.json(body);}) as typeof fetch;
    const report=await runWorldPilot({origin:"http://localhost:3007",fetcher,pause:async()=>{}});
    expect(count).toBe(4);expect(report.conditionalSupported).toBe(false);expect(report.samples.every(sample=>sample.kind==="full")).toBe(true);
  });
  it("stops after a throttled response without retrying or moving to concurrency batches",async()=>{
    let count=0;const fetcher=(async()=>{count++;return new Response(null,{status:429});}) as typeof fetch;
    const report=await runWorldPilot({origin:"http://localhost:3007",fetcher,pause:async()=>{}});
    expect(count).toBe(1);expect(report.samples[0].status).toBe(429);expect(report.stopped).toContain("429");
  });
  it("rejects an oversized run before starting any network request",async()=>{
    let calls=0;const fetcher=(async()=>{calls++;return reply();}) as typeof fetch;
    await expect(runWorldPilot({origin:"http://localhost:3007",rounds:100,fetcher})).rejects.toThrow(/round/i);expect(calls).toBe(0);
  });
  it("does not accept an unrelated 304 validator as successful conditional evidence",async()=>{
    let calls=0;const fetcher=(async()=>++calls===1?reply():new Response(null,{status:304,headers:{ETag:'W/"wrong"'}})) as typeof fetch;
    const report=await runWorldPilot({origin:"http://localhost:3007",fetcher,pause:async()=>{}});
    expect(calls).toBe(2);expect(report.stopped).toBeTruthy();expect(report.samples).toHaveLength(1);
  });
  it("stops on an oversized response before attempting more pilot traffic",async()=>{
    let calls=0;const fetcher=(async()=>{calls++;return new Response(new Uint8Array(5*1024*1024+1));}) as typeof fetch;
    const report=await runWorldPilot({origin:"http://localhost:3007",fetcher,pause:async()=>{}});
    expect(calls).toBe(1);expect(report.stopped).toBeTruthy();expect(report.samples).toEqual([]);
  });
});
