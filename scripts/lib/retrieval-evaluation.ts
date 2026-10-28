import type {AnswerResponse,SearchResponse} from "../../src/lib/types";

export interface RetrievalCase {
  id:string;
  category:"exact"|"paraphrase"|"campus-joke"|"photo-description"|"build-on"|"out-of-corpus";
  query:string;
  relevantIds:string[];
  expectsInsufficient?:boolean;
  requireMeaningMatch?:boolean;
  ask?:boolean;
}
export interface RetrievalCaseScore {
  id:string;
  category:RetrievalCase["category"];
  resultCount:number;
  hitAt5:boolean|null;
  recallAt5:number|null;
  reciprocalRankAt5:number|null;
  meaningMatch:boolean|null;
  answerStatus:AnswerResponse["status"]|"not-run";
  answerChecks:string[];
}
export function evaluateRetrievalCase(test:RetrievalCase,search:SearchResponse,answer?:AnswerResponse):RetrievalCaseScore {
  const seen=new Set<string>();
  const unique=search.results.filter(result=>{
    if(seen.has(result.memory.id))return false;seen.add(result.memory.id);return true;
  }).slice(0,5);
  const relevant=new Set(test.relevantIds),rank=unique.findIndex(result=>relevant.has(result.memory.id));
  const found=unique.filter(result=>relevant.has(result.memory.id));
  const answerChecks=new Set<string>();
  if(answer){
    const available=new Map(answer.results.map(result=>[result.memory.id,result.memory]));
    if(answer.status==="unavailable")answerChecks.add("answer_unavailable");
    if(answer.status==="answered"&&!answer.claims.length)answerChecks.add("answered_without_claims");
    if(answer.status==="insufficient"&&answer.claims.length)answerChecks.add("insufficient_with_claims");
    if(test.expectsInsufficient&&answer.status!=="insufficient")answerChecks.add("expected_insufficient");
    for(const claim of answer.claims){
      if(!claim.sourceIds.length)answerChecks.add("empty_citation");
      for(const id of claim.sourceIds){
        const source=available.get(id);
        if(!source)answerChecks.add("unsupported_citation");
        else if(answer.sourceVersions[id]!==source.version)answerChecks.add("stale_source_version");
      }
    }
  }
  return {id:test.id,category:test.category,resultCount:search.results.length,
    hitAt5:relevant.size?rank>=0:null,recallAt5:relevant.size?found.length/relevant.size:null,
    reciprocalRankAt5:relevant.size?(rank>=0?1/(rank+1):0):null,
    meaningMatch:test.requireMeaningMatch?search.mode==="hybrid"&&found.some(result=>result.match!=="keyword"):null,
    answerStatus:answer?.status??"not-run",answerChecks:[...answerChecks]};
}

export function validateRetrievalCases(value:unknown):RetrievalCase[] {
  const fail=()=>{throw new Error("Cases must be one to twelve uniquely named, bounded, explicitly labelled retrieval cases.");};
  if(!Array.isArray(value)||!value.length||value.length>12)return fail();
  const ids=new Set<string>(),categories=new Set(["exact","paraphrase","campus-joke","photo-description","build-on","out-of-corpus"]);
  for(const test of value){
    if(!test||typeof test!=="object"||typeof test.id!=="string"||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(test.id)||ids.has(test.id)||
      !categories.has(test.category)||typeof test.query!=="string"||!test.query.trim()||test.query.length>500||
      !Array.isArray(test.relevantIds)||test.relevantIds.length>12||test.relevantIds.some((id:unknown)=>typeof id!=="string"||!id||id.length>100)||
      new Set(test.relevantIds).size!==test.relevantIds.length||!test.relevantIds.length&&test.expectsInsufficient!==true||
      ["expectsInsufficient","requireMeaningMatch","ask"].some(key=>test[key]!==undefined&&typeof test[key]!=="boolean"))return fail();
    ids.add(test.id);
  }
  return value as RetrievalCase[];
}
