// Private disposable PostgreSQL only. Never connects to the linked project.
// Runs the exact new migration against the current Auth/profile/report constraints.
import assert from "node:assert/strict";
import {execFileSync,spawn} from "node:child_process";
import {mkdtempSync,readFileSync,readdirSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../..",import.meta.url));
const migration=process.argv[2]||join(root,"supabase/migrations",readdirSync(join(root,"supabase/migrations")).sort().findLast(file=>file.endsWith("_operator_report_reviews.sql"))||"missing");
const bin=process.env.PG_BIN||execFileSync("pg_config",["--bindir"],{encoding:"utf8"}).trim();
const directory=mkdtempSync(join(tmpdir(),"mb-report-review-")),data=join(directory,"data");
const env={...process.env,PGHOST:directory,PGPORT:"5432",PGUSER:"postgres",PGDATABASE:"postgres"};
const args=["-X","-q","-A","-t","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose"];
const sql=query=>execFileSync(join(bin,"psql"),[...args,"-c",query],{env,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
const denied=(query,match)=>{let failure;try{sql(query);}catch(error){failure=String(error.stderr);}assert.match(failure||"",match);};
const operator="00000000-0000-4000-8000-000000000001",guest="00000000-0000-4000-8000-000000000002",other="00000000-0000-4000-8000-000000000003";
const report=n=>`00000000-0000-4000-8000-${String(n+10).padStart(12,"0")}`;
const request=n=>`00000000-0000-4000-8000-${String(n+100).padStart(12,"0")}`;
const review=(actor,id,state,key)=>`select public.mb_review_report('${actor}','${id}','${state}','${key}');`;
const service=query=>`set role service_role;${query}`;
const sessions=[];
const start=query=>{
 const child=spawn(join(bin,"psql"),[...args,"-c",query],{env,stdio:["ignore","pipe","pipe"]});
 let output="",errors="";child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>errors+=chunk);
 const done=new Promise((resolve,reject)=>{child.on("error",reject);child.on("close",code=>resolve({code,output,errors}));});
 sessions.push({child,done});return done;
};
const waitUntil=async(query,predicate)=>{
 for(let attempt=0;attempt<100;attempt++){
  const value=sql(query);if(predicate(value))return;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 throw new Error("Controlled PostgreSQL session did not reach its lock boundary");
};
let running=false;
try{
 execFileSync(join(bin,"initdb"),["-D",data,"-U","postgres","-A","trust","--no-locale","-E","UTF8"],{stdio:"pipe"});
 execFileSync(join(bin,"pg_ctl"),["-D",data,"-l",join(directory,"server.log"),"-o",`-k ${directory} -h '' -p 5432 -F`,"-w","start"],{stdio:"pipe"});running=true;
 sql(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema extensions;grant usage on schema auth,public to service_role;
 create table auth.users(id uuid primary key);
 create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text not null,is_operator boolean not null default false,suspended boolean not null default false);
 create table public.reports(id uuid primary key,actor_id uuid references auth.users(id) on delete set null,memory_id uuid,bounds jsonb,reason text not null,state text not null default 'open' check(state in ('open','resolved','dismissed')),created_at timestamptz not null default now());
 create table public.world_events(id uuid primary key,description text);
 grant select,update on public.profiles,public.reports to service_role;
 insert into auth.users values('${operator}'),('${guest}'),('${other}');
 insert into public.profiles values('${operator}','Operator',true,false),('${guest}','Guest',false,false),('${other}','Other',true,false);
 insert into public.reports(id,actor_id,bounds,reason) select id,'${operator}',jsonb_build_object('x',0,'y',0,'width',1,'height',1),'private report reason' from unnest(array[${[1,2,3,4,5].map(n=>`'${report(n)}'::uuid`).join(",")}]) id;
 ${readFileSync(migration,"utf8")}`);
 assert.equal(sql("select has_table_privilege('service_role','auth.users','SELECT')"),"f","No new Auth read privilege is required");
 const accepted=JSON.parse(sql(service(review(operator,report(1),"resolved",request(1)))));
 assert.equal(accepted.state,"resolved");assert.equal(accepted.replayed,false);
 assert.equal(JSON.parse(sql(service(review(operator,report(1),"resolved",request(1))))).replayed,true);
 assert.equal(sql("select count(*) from public.operator_report_reviews"),"1");
 denied(service(review(operator,report(1),"dismissed",request(1))),/IDEMPOTENCY_CONFLICT/);
 denied(service(review(other,report(1),"resolved",request(1))),/IDEMPOTENCY_CONFLICT/);
 denied(service(review(operator,report(1),"dismissed",request(2))),/REPORT_ALREADY_REVIEWED/);
 denied(service(review(guest,report(2),"resolved",request(3))),/OPERATOR_REQUIRED/);
 sql(`update public.profiles set suspended=true where id='${operator}'`);
 denied(service(review(operator,report(2),"resolved",request(3))),/ACCOUNT_SUSPENDED/);
 sql(`update public.profiles set suspended=false where id='${operator}'`);
 denied(service(review(operator,report(99),"resolved",request(3))),/REPORT_UNAVAILABLE/);
 assert.equal(sql("select count(*) from public.operator_report_reviews"),"1","Rejected transitions leave no audit claim");
 assert.equal(JSON.parse(sql(service(review(operator,report(2),"dismissed",request(4))))).state,"dismissed");
 assert.equal(sql("select count(*) from public.world_events"),"0","Private review never publishes a public event");
 for(const role of ["anon","authenticated"]){
  assert.equal(sql(`select has_function_privilege('${role}','public.mb_review_report(uuid,uuid,text,uuid)','execute')`),"f");
  denied(`set role ${role};select * from public.operator_report_reviews`,/permission denied/);
 }
 denied(service("update public.operator_report_reviews set to_state='dismissed'"),/permission denied/);
 denied(service("delete from public.operator_report_reviews"),/permission denied/);

 // Hold a completed transition open so two distinct requests compete for one report.
 const gate=start("set application_name='mb_review_gate';select pg_advisory_lock(72404);select pg_sleep(20)");
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_review_gate' and wait_event='PgSleep'",value=>value==="1");
 const first=start(`set application_name='mb_review_first';set role service_role;begin;set local statement_timeout='6s';${review(operator,report(3),"resolved",request(5))}select pg_advisory_xact_lock(72404);commit;`);
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_review_first' and wait_event_type='Lock'",value=>value==="1");
 const second=start(`set application_name='mb_review_second';set statement_timeout='6s';${service(review(other,report(3),"dismissed",request(6)))}`);
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_review_second' and wait_event_type='Lock'",value=>value==="1");
 sql("select pg_cancel_backend(pid) from pg_stat_activity where application_name='mb_review_gate'");await gate;
 const [a,b]=await Promise.all([first,second]);assert.equal(a.code,0,a.errors);assert.equal(b.code,1);assert.match(b.errors,/REPORT_ALREADY_REVIEWED/);
 assert.equal(sql(`select count(*) from public.operator_report_reviews where report_id='${report(3)}'`),"1");
 assert.equal(sql(`select state from public.reports where id='${report(3)}'`),"resolved");

 // Revocation serializes with an accepted review, then also denies receipt replay.
 const revocationGate=start("set application_name='mb_revoke_gate';select pg_advisory_lock(72406);select pg_sleep(20)");
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_revoke_gate' and wait_event='PgSleep'",value=>value==="1");
 const authorized=start(`set application_name='mb_revoke_writer';set role service_role;begin;set local statement_timeout='6s';${review(operator,report(5),"resolved",request(8))}select pg_advisory_xact_lock(72406);commit;`);
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_revoke_writer' and wait_event_type='Lock'",value=>value==="1");
 const revocation=start(`set application_name='mb_revoke_actor';set statement_timeout='6s';update public.profiles set is_operator=false where id='${operator}'`);
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_revoke_actor' and wait_event_type='Lock'",value=>value==="1");
 sql("select pg_cancel_backend(pid) from pg_stat_activity where application_name='mb_revoke_gate'");await revocationGate;
 const [authorizedResult,revokedResult]=await Promise.all([authorized,revocation]);
 assert.equal(authorizedResult.code,0,authorizedResult.errors);assert.equal(revokedResult.code,0,revokedResult.errors);
 denied(service(review(operator,report(1),"resolved",request(1))),/OPERATOR_REQUIRED/);
 sql(`update public.profiles set is_operator=true where id='${operator}'`);

 // Auth deletion waits before taking child locks. This includes a report by the operator.
 const deletionGate=start("set application_name='mb_delete_gate';select pg_advisory_lock(72405);select pg_sleep(20)");
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_delete_gate' and wait_event='PgSleep'",value=>value==="1");
 const writer=start(`set application_name='mb_delete_writer';set role service_role;begin;set local statement_timeout='6s';${review(operator,report(4),"resolved",request(7))}select pg_advisory_xact_lock(72405);commit;`);
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_delete_writer' and wait_event_type='Lock'",value=>value==="1");
 const deletion=start(`set application_name='mb_delete_actor';set statement_timeout='6s';delete from auth.users where id='${operator}'`);
 await waitUntil("select count(*) from pg_stat_activity where application_name='mb_delete_actor' and wait_event_type='Lock'",value=>value==="1");
 sql("select pg_cancel_backend(pid) from pg_stat_activity where application_name='mb_delete_gate'");await deletionGate;
 const [writeResult,deleteResult]=await Promise.all([writer,deletion]);
 assert.equal(writeResult.code,0,writeResult.errors);assert.equal(deleteResult.code,0,deleteResult.errors);
 assert.doesNotMatch(writeResult.errors+deleteResult.errors,/40P01|deadlock/);
 assert.equal(sql(`select count(*) from public.operator_report_reviews where report_id='${report(4)}' and actor_id is null`),"1");
 denied(service(review(operator,report(4),"resolved",request(9))),/AUTH_REQUIRED/);
 console.log("PASS: service-only private report review; authorization, immutable audit, idempotent retries, conflicting reviews and concurrent Auth deletion. No linked project accessed.");
}finally{
 for(const {child} of sessions)if(child.exitCode===null)child.kill("SIGTERM");
 if(running)execFileSync(join(bin,"pg_ctl"),["-D",data,"-m","immediate","-w","stop"],{stdio:"pipe"});
 rmSync(directory,{recursive:true,force:true});
}
