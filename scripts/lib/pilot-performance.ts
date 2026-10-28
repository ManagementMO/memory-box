export interface PilotOptions { origin: string; rounds?: number; fetcher?: typeof fetch; pause?: (milliseconds:number)=>Promise<void> }
export interface PilotSample {
  kind: "full" | "conditional";
  concurrency: number;
  status: number;
  headersMs: number;
  totalMs: number;
  decodedBytes: number;
  contentLength: number | null;
  contentEncoding: string | null;
  validatorAvailable: boolean;
  world?: {revision:number;epoch:number;memories:number;pixels:number};
}
export function pilotOrigin(input:string):string {
  const url=new URL(input);
  const canonical=url.origin==="https://memory-box-commons.vercel.app";
  const loopback=url.protocol==="http:" && ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if(!(canonical||loopback)||url.username||url.password||url.search||url.hash||url.pathname!=="/") {
    throw new Error("Choose the canonical HTTPS origin or an explicit HTTP loopback origin, without paths, previews or credentials.");
  }
  return url.origin;
}

export async function readPilotBody(response:Response):Promise<Uint8Array> {
  const maximum=5*1024*1024,reader=response.body?.getReader();
  if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let length=0;
  try {
    while(true){
      const {value,done}=await reader.read();if(done)break;
      length+=value.byteLength;
      if(length>maximum){await reader.cancel();throw new Error("Response exceeded the five MiB pilot body limit.");}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const body=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
  return body;
}

export async function runWorldPilot(options:PilotOptions):Promise<{origin:string;samples:PilotSample[];stopped:string|null;conditionalSupported:boolean;startedAt:string;completedAt:string}> {
  const origin=pilotOrigin(options.origin),rounds=options.rounds??1;
  if(!Number.isInteger(rounds)||rounds<1||rounds>2)throw new Error("Pilot rounds must be one or two; concurrency is capped at two.");
  const fetcher=options.fetcher??fetch,pause=options.pause??(milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)));
  const startedAt=new Date().toISOString(),samples:PilotSample[]=[];let stopped:string|null=null,etag:string|null=null;
  const read=async(kind:PilotSample["kind"],concurrency:number)=>{
    const sentEtag=kind==="conditional"?etag:null;
    const started=performance.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15_000);
    try{
      const response=await fetcher(origin+"/api/world",{method:"GET",credentials:"omit",redirect:"error",cache:"no-store",signal:controller.signal,headers:{Accept:"application/json","User-Agent":"MemoryBox-readonly-pilot/1",...(sentEtag?{"If-None-Match":sentEtag}:{})}});
      const headersMs=performance.now()-started,body=await readPilotBody(response),length=response.headers.get("Content-Length");
      const receivedEtag=response.headers.get("ETag");
      if(response.status===304&&(!sentEtag||!receivedEtag||sentEtag.replace(/^W\//,"")!==receivedEtag.replace(/^W\//,"")))throw new Error("A conditional response did not match its requested validator.");
      const sample:PilotSample={kind,concurrency,status:response.status,headersMs,totalMs:performance.now()-started,decodedBytes:body.byteLength,contentLength:length!==null&&/^\d+$/.test(length)?Number(length):null,contentEncoding:response.headers.get("Content-Encoding"),validatorAvailable:!!response.headers.get("ETag")};
      if(response.status===200){
        const value=JSON.parse(new TextDecoder().decode(body));
        if(!Number.isSafeInteger(value.revision)||!Number.isSafeInteger(value.epoch)||!Array.isArray(value.memories)||!Array.isArray(value.pixels))throw new Error("Malformed world snapshot.");
        sample.world={revision:value.revision,epoch:value.epoch,memories:value.memories.length,pixels:value.pixels.length};
      }
      return {sample,etag:receivedEtag};
    }finally{clearTimeout(timer);}
  };
  const batch=async(kind:PilotSample["kind"],concurrency:number)=>{
    const results=await Promise.allSettled(Array.from({length:concurrency},()=>read(kind,concurrency)));
    for(const result of results){
      if(result.status==="rejected"){stopped??="A read failed or exceeded its time/body bound. No retries were attempted.";continue;}
      samples.push(result.value.sample);
      if(result.value.sample.status===200)etag=result.value.etag;
      else if(result.value.sample.status!==304)stopped??=`HTTP ${result.value.sample.status}; remaining batches were skipped.`;
    }
    return !stopped;
  };
  if(await batch("full",1)){
    if(etag)await batch("conditional",1);
    for(let round=0;round<rounds&&!stopped;round++){
      for(const kind of ["full","conditional"] as const){
        if(stopped||kind==="conditional"&&!etag)continue;
        for(const concurrency of [1,2]){await pause(500);if(!await batch(kind,concurrency))break;}
      }
    }
  }
  return {origin,samples,stopped,conditionalSupported:samples.some(sample=>sample.validatorAvailable),startedAt,completedAt:new Date().toISOString()};
}
