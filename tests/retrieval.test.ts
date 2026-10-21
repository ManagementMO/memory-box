import {beforeEach,describe,expect,it,vi} from "vitest";
import type {Memory} from "../src/lib/types";

const dependencies=vi.hoisted(()=>({embed:vi.fn(),generate:vi.fn(),search:vi.fn(),snapshot:vi.fn()}));
vi.mock("../src/lib/server/ai",()=>({
  embedText:dependencies.embed,synthesizeAnswer:dependencies.generate,
  AIServiceError:class extends Error {}
}));
vi.mock("../src/lib/server/database",()=>({searchMemories:dependencies.search,getSnapshot:dependencies.snapshot}));
import {ask,retrieve} from "../src/lib/server/retrieval";

const memory:Memory={id:"53219ac5-08c8-4461-a448-b7e688571fa7",authorId:null,authorName:"nina",type:"text",title:"The long way home",body:"Dad always sang the wrong words in the car.",url:null,imageUrl:null,color:"#F0DE8E",x:450,y:490,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,createdAt:"2026-10-20T12:00:00Z",updatedAt:"2026-10-20T12:00:00Z",version:1,indexStatus:"ready",isSeed:true};

beforeEach(()=>{
  vi.resetAllMocks();dependencies.embed.mockResolvedValue([1]);
  dependencies.search.mockResolvedValue({mode:"hybrid",results:[{memory,score:.03,match:"both"}]});
  dependencies.snapshot.mockResolvedValue({memories:[memory]});
  dependencies.generate.mockResolvedValue({status:"answered",claims:[{text:"Nina remembers her dad singing the wrong words in the car.",sourceIds:[memory.id]}],summary:"Based on one contribution."});
});

describe("retrieval authority",()=>{
  it("keeps lexical search usable when embeddings fail and labels it",async()=>{
    dependencies.embed.mockRejectedValue(new Error("offline"));
    dependencies.search.mockResolvedValue({mode:"keyword",results:[]});
    const result=await retrieve("car rides");
    expect(dependencies.search).toHaveBeenCalledWith("car rides",null,undefined);
    expect(result.mode).toBe("keyword");expect(result.notice).toBeTruthy();
  });
  it("does not ask a model to invent an answer when no sources are found",async()=>{
    dependencies.search.mockResolvedValue({mode:"hybrid",results:[]});
    const result=await ask("the distance to Neptune");
    expect(result.status).toBe("insufficient");expect(dependencies.generate).not.toHaveBeenCalled();
  });
  it("withholds a generated answer if its source was deleted while generating",async()=>{
    dependencies.snapshot.mockResolvedValue({memories:[]});
    const result=await ask("music and family");
    expect(result.status).toBe("unavailable");expect(result.claims).toEqual([]);
    expect(result.results).toEqual([]);
  });
  it("withholds a generated answer if its original changed to a new version",async()=>{
    dependencies.snapshot.mockResolvedValue({memories:[{...memory,version:2}]});
    const result=await ask("music and family");
    expect(result.status).toBe("unavailable");expect(result.claims).toEqual([]);
    expect(result.results).toEqual([]);
  });
  it("does not deliver a removed original when the provider fails during generation",async()=>{
    dependencies.generate.mockRejectedValue(new Error("provider timed out"));
    dependencies.snapshot.mockResolvedValue({memories:[]});
    const result=await ask("music and family");
    expect(result.status).toBe("unavailable");expect(result.results).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(memory.body);
  });
  it("withholds originals if their current eligibility cannot be rechecked",async()=>{
    dependencies.snapshot.mockRejectedValue(new Error("database unavailable"));
    const result=await ask("music and family");
    expect(result.status).toBe("unavailable");expect(result.results).toEqual([]);
    expect(result.claims).toEqual([]);
  });
  it("uses at most eight sources and reports the exact versions actually used",async()=>{
    const sources=Array.from({length:12},(_,i)=>({...memory,id:crypto.randomUUID(),title:`Memory ${i}`}));
    dependencies.search.mockResolvedValue({mode:"hybrid",results:sources.map(source=>({memory:source,score:.02,match:"semantic"}))});
    dependencies.snapshot.mockResolvedValue({memories:sources});
    const result=await ask("music and family");
    expect(result.results).toHaveLength(8);expect(Object.keys(result.sourceVersions)).toHaveLength(8);
    expect(dependencies.generate.mock.calls[0][1]).toHaveLength(8);
  });
});
