import {describe,expect,it} from "vitest";
import {runLiveRetrieval} from "../scripts/lib/retrieval-runner";
import type {RetrievalCase} from "../scripts/lib/retrieval-evaluation";

const fixture={id:"seed-home",version:1,indexStatus:"ready",type:"text",authorName:"A synthetic author",body:"Private response text not written to reports."};
const test:RetrievalCase={id:"exact-fixture",category:"exact",query:"A deliberately distinct fixture query",relevantIds:[fixture.id],ask:true};
const search={mode:"hybrid",results:[{memory:fixture,score:.01,match:"both"}]};
describe("explicit live relevance runner",()=>{
  it("calls only the bounded read/query routes and reports grades without content, identity or credentials",async()=>{
    const calls:string[]=[];
    const fetcher=(async(url,init)=>{
      const path=new URL(String(url)).pathname;calls.push(path);expect(init?.redirect).toBe("error");expect(init?.credentials).toBe("omit");
      if(path==="/api/world")return Response.json({memories:[fixture]});
      expect(init?.method).toBe("POST");expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer synthetic-private-token");
      if(path==="/api/search")return Response.json(search);
      if(path==="/api/ask")return Response.json({...search,status:"answered",claims:[{text:fixture.body,sourceIds:[fixture.id]}],summary:"",sourceVersions:{[fixture.id]:1}});
      throw Error("Unexpected route");
    }) as typeof fetch;
    const report=await runLiveRetrieval({origin:"http://localhost:3007",accessToken:"synthetic-private-token",cases:[test],withAnswers:true,fetcher,pause:async()=>{}});
    expect(calls).toEqual(["/api/world","/api/search","/api/ask"]);expect(report.requests).toBe(3);
    expect(report.scores[0]).toMatchObject({hitAt5:true,recallAt5:1,reciprocalRankAt5:1,answerChecks:[]});
    for(const value of [fixture.authorName,fixture.body,fixture.id,test.query,"synthetic-private-token"])expect(JSON.stringify(report)).not.toContain(value);
  });
  it("skips vanished labelled sources without calling query routes or relabelling other sources as failures",async()=>{
    let requests=0;const fetcher=(async()=>{requests++;return Response.json({memories:[]});}) as typeof fetch;
    const report=await runLiveRetrieval({origin:"http://localhost:3007",accessToken:"test-token",cases:[test],fetcher});
    expect(requests).toBe(1);expect(report.scores).toEqual([]);expect(report.skipped).toEqual([{id:test.id,reason:"labelled_original_unavailable"}]);
  });
  it("stops on a rate limit and leaves remaining cases unqueried",async()=>{
    let requests=0;const fetcher=(async()=>{requests++;return requests===1?Response.json({memories:[fixture]}):Response.json({error:"rate limited"},{status:429});}) as typeof fetch;
    const report=await runLiveRetrieval({origin:"http://localhost:3007",accessToken:"test-token",cases:[test,{...test,id:"second"}],fetcher,pause:async()=>{}});
    expect(requests).toBe(2);expect(report.stopped).toContain("429");expect(report.scores).toEqual([]);
  });
  it("requires an operator-provided session token and a bounded answer allowance before networking",async()=>{
    let requests=0;const fetcher=(async()=>{requests++;return Response.json({});}) as typeof fetch;
    await expect(runLiveRetrieval({origin:"http://localhost:3007",accessToken:"",cases:[test],fetcher})).rejects.toThrow(/token/i);
    await expect(runLiveRetrieval({origin:"http://localhost:3007",accessToken:"token",cases:Array.from({length:5},(_,index)=>({...test,id:`case-${index}`})),withAnswers:true,fetcher})).rejects.toThrow(/four answer/i);
    expect(requests).toBe(0);
  });
});
