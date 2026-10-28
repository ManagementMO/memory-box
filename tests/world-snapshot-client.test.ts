import {afterEach,describe,expect,it,vi} from "vitest";
import type {WorldSnapshot} from "../src/lib/types";
import {fetchWorldSnapshot} from "../src/lib/client/world-snapshot";

const snapshot=(revision=1):WorldSnapshot=>({worldId:"commons",revision,epoch:1,width:120000,height:120000,gridSize:6,paintingPaused:false,pixels:[],memories:[],events:[]});
afterEach(()=>vi.unstubAllGlobals());

describe("conditional snapshot transport",()=>{
  it("keeps the exact local snapshot on a matching 304 without parsing an empty body",async()=>{
    const previous={snapshot:snapshot(),etag:'W/"first"'},controller=new AbortController();
    const fetch=vi.fn(async()=>new Response(null,{status:304,headers:{ETag:'W/"first"'}}));vi.stubGlobal("fetch",fetch);
    const received=await fetchWorldSnapshot(previous,{signal:controller.signal});
    expect(received).toBe(previous);expect(received.snapshot).toBe(previous.snapshot);
    expect(fetch).toHaveBeenCalledWith("/api/world",{cache:"no-store",signal:controller.signal,headers:{"If-None-Match":'W/"first"'}});
  });
  it("installs a changed body and its validator together",async()=>{
    const changed=snapshot(2);vi.stubGlobal("fetch",vi.fn(async()=>Response.json(changed,{headers:{ETag:'W/"next"'}})));
    expect(await fetchWorldSnapshot({snapshot:snapshot(),etag:'W/"first"'})).toEqual({snapshot:changed,etag:'W/"next"'});
  });
  it("fetches unconditionally if there is no retained validator",async()=>{
    const fetch=vi.fn(async()=>Response.json(snapshot()));vi.stubGlobal("fetch",fetch);
    expect(await fetchWorldSnapshot(null)).toEqual({snapshot:snapshot(),etag:null});
    expect(fetch.mock.calls[0]).toEqual(["/api/world",{cache:"no-store",headers:{}}]);
  });
  it.each([null,{snapshot:snapshot(),etag:null},{snapshot:snapshot(),etag:'W/"old"'}])("rejects an unsolicited or mismatched 304 for %j",async previous=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:304,headers:{ETag:'W/"different"'}})));
    await expect(fetchWorldSnapshot(previous)).rejects.toThrow(/snapshot could not be validated/i);
  });
  it("does not reuse the previous body when the current read fails",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({error:"The world is unavailable."},{status:503})));
    await expect(fetchWorldSnapshot({snapshot:snapshot(),etag:'W/"old"'})).rejects.toThrow("The world is unavailable.");
  });
  it("rejects malformed or empty successful responses instead of erasing the retained world",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({revision:2})));
    await expect(fetchWorldSnapshot({snapshot:snapshot(),etag:'W/"old"'})).rejects.toThrow(/snapshot/i);
  });
  it("rejects a completed transport if its generation was cancelled while fetching",async()=>{
    const controller=new AbortController();
    vi.stubGlobal("fetch",vi.fn(async()=>{controller.abort();return Response.json(snapshot());}));
    await expect(fetchWorldSnapshot(null,{signal:controller.signal})).rejects.toMatchObject({name:"AbortError"});
  });
});
