import type {AnswerResponse,SearchResponse} from "../../src/lib/types";
import {evaluateRetrievalCase,validateRetrievalCases,type RetrievalCase,type RetrievalCaseScore} from "./retrieval-evaluation";
import {pilotOrigin,readPilotBody} from "./pilot-performance";

export interface LiveRetrievalOptions { origin:string; accessToken:string; cases:RetrievalCase[]; withAnswers?:boolean; fetcher?:typeof fetch; pause?:()=>Promise<void> }
export interface LiveRetrievalReport {
  mode:"live-read";
  origin:string;
  startedAt:string;
  completedAt:string;
  corpus:{memories:number;indexed:number;imageDescriptions:number};
  scores:RetrievalCaseScore[];
  skipped:Array<{id:string;reason:string}>;
  requests:number;
  stopped:string|null;
}
export async function runLiveRetrieval(options:LiveRetrievalOptions):Promise<LiveRetrievalReport> {
  const origin=pilotOrigin(options.origin),cases=validateRetrievalCases(options.cases);
  if(!options.accessToken||options.accessToken.length>8192||/[\r\n]/.test(options.accessToken))throw new Error("An existing operator-supplied test session access token is required.");
  if(options.withAnswers&&cases.filter(test=>test.ask).length>4)throw new Error("A run is limited to four answer requests.");
  const report:LiveRetrievalReport={mode:"live-read",origin,startedAt:new Date().toISOString(),completedAt:"",corpus:{memories:0,indexed:0,imageDescriptions:0},scores:[],skipped:[],requests:0,stopped:null};
  const fetcher=options.fetcher??fetch,pause=options.pause??(()=>new Promise(resolve=>setTimeout(resolve,500)));
  class ReadFailure extends Error {constructor(readonly status:number){super("Query HTTP failure");}}
  const request=async(path:string,query?:string)=>{
    report.requests++;
    const response=await fetcher(origin+path,{method:query===undefined?"GET":"POST",credentials:"omit",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(60_000),headers:{Accept:"application/json",...(query===undefined?{}:{Origin:origin,Authorization:`Bearer ${options.accessToken}`,"Content-Type":"application/json"})},...(query===undefined?{}:{body:JSON.stringify({query})})});
    if(!response.ok){await response.body?.cancel();throw new ReadFailure(response.status);}
    return JSON.parse(new TextDecoder().decode(await readPilotBody(response)));
  };
  const isSearch=(value:unknown):value is SearchResponse=>{
    if(!value||typeof value!=="object")return false;
    const result=value as SearchResponse;
    return ["hybrid","keyword"].includes(result.mode)&&Array.isArray(result.results)&&result.results.length<=20&&result.results.every(item=>item.memory&&typeof item.memory.id==="string"&&Number.isSafeInteger(item.memory.version)&&["keyword","semantic","both"].includes(item.match));
  };
  const isAnswer=(value:unknown):value is AnswerResponse=>{
    if(!isSearch(value))return false;
    const answer=value as AnswerResponse;
    return ["answered","insufficient","unavailable"].includes(answer.status)&&Array.isArray(answer.claims)&&answer.claims.every(claim=>typeof claim.text==="string"&&Array.isArray(claim.sourceIds)&&claim.sourceIds.every(id=>typeof id==="string"))&&!!answer.sourceVersions&&typeof answer.sourceVersions==="object";
  };
  try{
    const world=await request("/api/world");
    if(!world||!Array.isArray(world.memories))throw Error("Invalid world response");
    const originals=world.memories as Array<{id:string;indexStatus:string;type:string;imageDescription?:string|null}>;
    const byId=new Map(originals.map(memory=>[memory.id,memory]));
    report.corpus={memories:originals.length,indexed:originals.filter(memory=>memory.indexStatus==="ready").length,imageDescriptions:originals.filter(memory=>memory.type==="image"&&!!memory.imageDescription).length};
    for(const test of cases){
      if(test.relevantIds.some(id=>!byId.has(id))){report.skipped.push({id:test.id,reason:"labelled_original_unavailable"});continue;}
      if(test.category==="photo-description"&&test.relevantIds.some(id=>!byId.get(id)?.imageDescription)){
        report.skipped.push({id:test.id,reason:"indexed_image_description_unavailable"});continue;
      }
      await pause();const search=await request("/api/search",test.query);
      if(!isSearch(search))throw Error("Invalid search response");
      let answer:AnswerResponse|undefined;
      if(options.withAnswers&&test.ask){await pause();const result=await request("/api/ask",test.query);if(!isAnswer(result))throw Error("Invalid answer response");answer=result;}
      report.scores.push(evaluateRetrievalCase(test,search,answer));
    }
  }catch(error){
    report.stopped=error instanceof ReadFailure?`HTTP ${error.status}; remaining queries were skipped.`:"A query failed, timed out or returned an invalid body. Remaining queries were skipped; no retry was attempted.";
  }
  report.completedAt=new Date().toISOString();return report;
}
