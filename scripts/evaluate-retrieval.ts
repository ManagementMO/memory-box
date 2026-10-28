import {readFile} from "node:fs/promises";
import {parseArgs} from "node:util";
import {validateRetrievalCases} from "./lib/retrieval-evaluation";
import {runLiveRetrieval} from "./lib/retrieval-runner";
import {pilotOrigin} from "./lib/pilot-performance";

async function main(){
  const {values}=parseArgs({options:{live:{type:"boolean",default:false},"with-answers":{type:"boolean",default:false},origin:{type:"string",default:"http://localhost:3007"},"cases-file":{type:"string"}}});
  const path=values["cases-file"]??new URL("./fixtures/retrieval-cases.json",import.meta.url);
  const cases=validateRetrievalCases(JSON.parse(await readFile(path,"utf8"))),origin=pilotOrigin(values.origin);
  if(!values.live){
    console.log(JSON.stringify({mode:"dry-run",origin,networkRequests:0,cases:cases.map(({id,category,ask})=>({id,category,answerEnabled:!!ask&&values["with-answers"]})),requestsAtMost:1+cases.length+(values["with-answers"]?cases.filter(test=>test.ask).length:0),requirements:["--live opts into authenticated query routes; provide an existing test session via MEMORY_BOX_EVAL_ACCESS_TOKEN.","Query routes reserve per-session/global budgets and can retry pending index jobs. They do not create contributions or analytics events.","--with-answers additionally opts into up to four billed answer generations.","Default cases are labelled starter regressions, not representative real community demand. Custom judged cases can be supplied with --cases-file under ignored auth/."],limits:"Fixture tests validate the scorer and evidence boundaries. No live model or relevance result is claimed by this dry run."},null,2));return;
  }
  const report=await runLiveRetrieval({origin,accessToken:process.env.MEMORY_BOX_EVAL_ACCESS_TOKEN??"",cases,withAnswers:values["with-answers"]});
  console.log(JSON.stringify({...report,limits:["Reported recall covers only the explicitly labelled relevant originals; unlabelled results are not assumed irrelevant. No precision claim is made.","A valid citation/source version is a structural check, not proof of semantic relevance, authored truth or caption accuracy.","The corpus and model may change during the run. Missing labelled originals/descriptions are skipped, not counted as retrieval failures.","No author names, original text, returned source IDs, queries, credentials or person-level analytics are included in this report.","This is QA traffic, not adoption evidence. Arrival experiment, allocations and metrics are untouched."]},null,2));
  if(report.stopped||report.scores.some(score=>score.hitAt5===false||score.meaningMatch===false||score.answerChecks.length))process.exitCode=1;
}
main().catch(()=>{console.error("Retrieval evaluation did not start. Check the bounded case file, explicit origin and existing test-session token. No credential or source body was logged.");process.exitCode=1;});
