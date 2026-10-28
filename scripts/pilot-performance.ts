import {parseArgs} from "node:util";
import {pilotOrigin,runWorldPilot} from "./lib/pilot-performance";

async function main(){
  const {values}=parseArgs({options:{run:{type:"boolean",default:false},origin:{type:"string",default:"http://localhost:3007"},rounds:{type:"string",default:"1"}}});
  const origin=pilotOrigin(values.origin),rounds=Number(values.rounds);
  if(!Number.isInteger(rounds)||rounds<1||rounds>2)throw new Error("Use --rounds 1 or --rounds 2.");
  if(!values.run){
    console.log(JSON.stringify({mode:"dry-run",origin,requestsAtMost:2+rounds*6,concurrencyAtMost:2,networkRequests:0,run:"Add --run to make bounded public GET requests.",limits:"This is a small latency/transfer smoke check, not a capacity or multiplayer load test."},null,2));return;
  }
  const report=await runWorldPilot({origin,rounds});
  const groups=[...new Set(report.samples.map(sample=>`${sample.kind}:${sample.concurrency}`))].map(key=>{
    const selected=report.samples.filter(sample=>`${sample.kind}:${sample.concurrency}`===key),times=selected.map(sample=>sample.totalMs).sort((a,b)=>a-b);
    return {kind:key.split(":")[0],concurrency:Number(key.split(":")[1]),n:times.length,minMs:times[0],medianMs:times.length%2?times[Math.floor(times.length/2)]:(times[times.length/2-1]+times[times.length/2])/2,maxMs:times.at(-1),decodedBytes:selected.reduce((sum,sample)=>sum+sample.decodedBytes,0),notModified:selected.filter(sample=>sample.status===304).length};
  });
  console.log(JSON.stringify({...report,groups,limits:["At most two simultaneous public GET requests; no actors, contributions, realtime sessions or analytics events were created.","Decoded body bytes are measured. Content-Length/Content-Encoding are reported only when present; these are not a full wire-byte capture.","Small samples do not establish p95 latency, capacity, mobile FPS, slow-network usability or large-world scalability.","A 304 avoids body transfer and client parsing; fresh authorization/snapshot reading and hashing still run on the server."]},null,2));
  if(report.stopped)process.exitCode=1;
}
main().catch(()=>{console.error("Pilot did not complete. Check the explicit origin, run bounds and server availability. No retries were attempted.");process.exitCode=1;});
