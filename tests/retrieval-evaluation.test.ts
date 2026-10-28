import {describe,expect,it} from "vitest";
import type {AnswerResponse,Memory,SearchResponse} from "../src/lib/types";
import {evaluateRetrievalCase,validateRetrievalCases,type RetrievalCase} from "../scripts/lib/retrieval-evaluation";

const memory=(id:string,version=1):Memory=>({id,version,authorId:null,authorName:"Fixture author",title:"Fixture",body:"A fictional memory for evaluation.",type:"text",imageUrl:null,url:null,color:"#DCC7F0",x:0,y:0,sceneId:"mixtape",inspiredBy:null,paintOperationId:null,indexStatus:"ready",isSeed:true,createdAt:"2026-10-20T00:00:00Z",updatedAt:"2026-10-20T00:00:00Z"});
const results=(...ids:string[]):SearchResponse=>({mode:"hybrid",results:ids.map(id=>({memory:memory(id),score:.01,match:"semantic"}))});
const test:RetrievalCase={id:"paraphrase",category:"paraphrase",query:"childhood car rides",relevantIds:["home","cassette"],requireMeaningMatch:true};
const answer=(patch:Partial<AnswerResponse>={}):AnswerResponse=>({...results("home"),status:"answered",claims:[{text:"A fictional memory for evaluation.",sourceIds:["home"]}],summary:"Based on 1 cited contribution.",sourceVersions:{home:1},...patch});

describe("retrieval evaluation scoring",()=>{
  it("computes rank and labelled recall independently of returned scores or duplicate rows",()=>{
    const score=evaluateRetrievalCase(test,results("other","home","home"));
    expect(score).toMatchObject({hitAt5:true,recallAt5:.5,reciprocalRankAt5:.5,resultCount:3,meaningMatch:true,answerStatus:"not-run"});
  });
  it("does not count a relevant result outside the first five unique originals",()=>{
    expect(evaluateRetrievalCase(test,results("a","b","c","d","e","home"))).toMatchObject({hitAt5:false,recallAt5:0,reciprocalRankAt5:0,meaningMatch:false});
  });
  it("reports keyword fallback separately from successful meaning retrieval",()=>{
    const search=results("home");search.mode="keyword";search.results[0].match="keyword";
    expect(evaluateRetrievalCase(test,search).meaningMatch).toBe(false);
  });
  it("keeps the first-ranked evidence when duplicate rows disagree about match provenance",()=>{
    const search=results("home","home");search.results[1].match="keyword";
    expect(evaluateRetrievalCase(test,search).meaningMatch).toBe(true);
  });
  it("does not turn an out-of-corpus case into an invented precision or recall score",()=>{
    const negative:RetrievalCase={id:"unanswerable",category:"out-of-corpus",query:"Neptune distance",relevantIds:[],expectsInsufficient:true};
    expect(evaluateRetrievalCase(negative,results(),answer({status:"insufficient",claims:[],results:[],sourceVersions:{}}))).toMatchObject({hitAt5:null,recallAt5:null,reciprocalRankAt5:null,answerChecks:[]});
    expect(evaluateRetrievalCase(negative,results("home"),answer()).answerChecks).toContain("expected_insufficient");
  });
  it.each([
    {claims:[{text:"Invented",sourceIds:["not-retrieved"]}],finding:"unsupported_citation"},
    {claims:[{text:"Missing citation",sourceIds:[]}],finding:"empty_citation"},
    {sourceVersions:{home:0},finding:"stale_source_version"},
    {status:"answered",claims:[],finding:"answered_without_claims"},
    {status:"insufficient",finding:"insufficient_with_claims"},
    {status:"unavailable",claims:[],finding:"answer_unavailable"},
  ])("detects answer boundary failure $finding",({finding,...patch})=>{
    expect(evaluateRetrievalCase(test,results("home"),answer(patch as Partial<AnswerResponse>)).answerChecks).toContain(finding);
  });
  it("allows a recorded build-on claim citing two current retrieved originals",()=>{
    const value=answer({...results("home","cassette"),claims:[{text:"A recorded connection.",sourceIds:["cassette","home"]}],sourceVersions:{home:1,cassette:1}});
    expect(evaluateRetrievalCase(test,results("home","cassette"),value).answerChecks).toEqual([]);
  });
  it("accepts only bounded, named, explicitly labelled cases before any live request",()=>{
    expect(validateRetrievalCases([test])).toEqual([test]);
    for(const invalid of [[],Array.from({length:13},()=>test),[{...test,query:"x".repeat(501)}],[{...test,relevantIds:"home"}],[test,test],[{...test,category:"general"}]]){
      expect(()=>validateRetrievalCases(invalid)).toThrow(/case/i);
    }
  });
});
