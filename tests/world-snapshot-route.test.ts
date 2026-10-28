import {beforeEach,describe,expect,it,vi} from "vitest";
import type {WorldSnapshot} from "../src/lib/types";

const dependencies=vi.hoisted(()=>({snapshot:vi.fn()}));
vi.mock("../src/lib/server/database",()=>({getSnapshot:dependencies.snapshot}));
import {GET} from "../src/app/api/world/route";

const snapshot=():WorldSnapshot=>({worldId:"commons",revision:12,epoch:2,width:120000,height:120000,gridSize:6,paintingPaused:false,pixels:[{x:2,y:3,color:"#DCC7F0"}],memories:[],events:[]});
const get=(etag?:string)=>(GET as (request:Request)=>Promise<Response>)(new Request("https://memory-box-commons.vercel.app/api/world",{headers:etag?{"If-None-Match":etag}:{}}));
beforeEach(()=>{vi.resetAllMocks();dependencies.snapshot.mockResolvedValue(snapshot());});

describe("fresh conditional public snapshots",()=>{
  it("returns a validator and a zero-body 304 only after reading the current public snapshot",async()=>{
    const first=await get();expect(first.status).toBe(200);expect(await first.json()).toEqual(snapshot());
    const etag=first.headers.get("ETag");expect(etag).toMatch(/^W\/"mb-[A-Za-z0-9_-]+"$/);
    const unchanged=await get(etag!);expect(unchanged.status).toBe(304);expect(await unchanged.text()).toBe("");
    expect(unchanged.headers.get("ETag")).toBe(etag);expect(unchanged.headers.get("Cache-Control")).toBe("no-store");
    expect(dependencies.snapshot).toHaveBeenCalledTimes(2);
  });
  it.each([{revision:13},{epoch:3},{worldId:"new-world"},{paintingPaused:true},{pixels:[]},{memories:[{id:"original",version:1,indexStatus:"ready",imageDescription:"A pink tie."}]}])("invalidates for a fresh snapshot change: %j",async patch=>{
    const first=await get(),etag=first.headers.get("ETag")!;
    const changed={...snapshot(),...patch};dependencies.snapshot.mockResolvedValue(changed);
    const response=await get(etag);expect(response.status).toBe(200);expect(response.headers.get("ETag")).not.toBe(etag);expect(await response.json()).toEqual(changed);
  });
  it("invalidates derived image descriptions at the same source version and world revision",async()=>{
    const memory={id:"image",version:1,indexStatus:"ready",imageDescription:"A pink tie."};
    dependencies.snapshot.mockResolvedValue({...snapshot(),memories:[memory]});const first=await get();
    dependencies.snapshot.mockResolvedValue({...snapshot(),memories:[{...memory,imageDescription:"A lilac tie."}]});
    const response=await get(first.headers.get("ETag")!);expect(response.status).toBe(200);
    expect((await response.json()).memories[0].imageDescription).toBe("A lilac tie.");
  });
  it("accepts a weak or strong member of a validator list, but never a partial validator",async()=>{
    const first=await get(),etag=first.headers.get("ETag")!;
    expect((await get(`"unrelated", ${etag.replace(/^W\//,"")}`)).status).toBe(304);
    expect((await get(etag.slice(0,-2))).status).toBe(200);
  });
  it("does not turn a failed fresh read into a cached 304",async()=>{
    const first=await get();dependencies.snapshot.mockRejectedValue(new Error("Database unavailable"));
    const warning=vi.spyOn(console,"error").mockImplementation(()=>{});
    try{expect((await get(first.headers.get("ETag")!)).status).toBe(503);}finally{warning.mockRestore();}
  });
});
