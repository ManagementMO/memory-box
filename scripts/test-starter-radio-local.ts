import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildRadioRefreshSql,buildRadioRestoreSql,makeRadioPlan,radioCandidates,SOURCE_OPERATION,REFRESH_OPERATION} from './refresh-starter-radio';

// Explicit local-only SQL integration lab. No .env file or Supabase connection.
// Requires an empty migrated local PG15 compatibility database on this Unix
// socket (never TCP). Run: npx tsx scripts/test-starter-radio-local.ts
// The current run's schema bootstrap and logs are retained in ../work under
// world-bounds-local-schema.sql and starter-radio-local-*.{sql,log}.
const dir=resolve('../work');
const psql=['-X','-qAt','-h',dir,'-p','55437','-U','memory_box_test','-d','postgres','-v','ON_ERROR_STOP=1'];
const query=(sql:string)=>execFileSync('psql',[...psql,'-c',sql],{encoding:'utf8',maxBuffer:10_000_000}).trim();
const run=(name:string,sql:string)=>{const path=dir+'/'+name+'.sql';writeFileSync(path,sql);const output=execFileSync('psql',[...psql,'-f',path],{encoding:'utf8',maxBuffer:10_000_000});writeFileSync(dir+'/'+name+'.log',output);return output.trim();};
async function main(){
const svg=readFileSync('public/starter-radio.svg'),candidates=await radioCandidates(svg),art=candidates.filter(p=>p.insertable),clear=candidates.find(p=>!p.insertable)!;
const visitor='00000000-0000-4000-8000-000000000900';
const baseline=[
 {x:clear.x,y:clear.y,color:'#263633',operationId:SOURCE_OPERATION,revision:0},
 {x:art[0].x,y:art[0].y,color:'#64936E',operationId:SOURCE_OPERATION,revision:0},
 {x:art[1].x,y:art[1].y,color:'#87B9BD',operationId:visitor,revision:9},
 {x:art[2].x,y:art[2].y,color:'#FFFFFF',operationId:null,revision:9},
];
assert.equal(query('select (select count(*) from public.cells)+(select count(*) from public.memories)+(select count(*) from public.paint_operations)+(select count(*) from public.world_events)'),'0','empty isolated local fixture DB only');
try {
 query(`insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch,before_cells,after_cells) values('${SOURCE_OPERATION}','commons',null,'seed:v1','original',0,1,'[]','[]'),('${visitor}','commons',null,'local-visitor-fixture','fixture',9,1,'[]','[]');update public.worlds set revision=10,public_epoch=1 where id='commons';`);
 for(const row of baseline)query(`insert into public.cells(world_id,x,y,color,operation_id,updated_revision) values('commons',${row.x},${row.y},'${row.color}',${row.operationId?"'"+row.operationId+"'":'null'},${row.revision});`);
 const plan=makeRadioPlan(svg,candidates,baseline,10,1),sql=buildRadioRefreshSql(plan);
 query(`update public.cells set color='#FFFFFF' where x=${art[1].x} and y=${art[1].y};`);
 assert.throws(()=>run('starter-radio-local-stale',sql),/RADIO_REVIEW_STALE/);
 assert.equal(query(`select count(*) from public.paint_operations where id='${REFRESH_OPERATION}'`),'0');
 assert.equal(query("select revision from public.worlds where id='commons'"),'10','stale review abort leaves the world unchanged');
 query(`update public.cells set color='#87B9BD' where x=${art[1].x} and y=${art[1].y};`);
 const first=JSON.parse(run('starter-radio-local-first',sql));assert.equal(first.status,'applied');
 assert.equal(query(`select color||':'||coalesce(operation_id::text,'null') from public.cells where x=${art[1].x} and y=${art[1].y}`),'#87B9BD:'+visitor);
 assert.equal(query(`select color||':'||coalesce(operation_id::text,'null') from public.cells where x=${art[2].x} and y=${art[2].y}`),'#FFFFFF:null');
 assert.equal(query(`select color from public.cells where x=${art[0].x} and y=${art[0].y}`),art[0].color);
 const state=query("select revision||':'||public_epoch||':'||(select count(*) from public.cells)||':'||(select count(*) from public.world_events) from public.worlds where id='commons'");
 const repeat=JSON.parse(run('starter-radio-local-repeat',sql));assert.equal(repeat.status,'already-applied');
 assert.equal(query("select revision||':'||public_epoch||':'||(select count(*) from public.cells)||':'||(select count(*) from public.world_events) from public.worlds where id='commons'"),state);
 const newcomer=art[3];query(`update public.cells set color='#F0D66E',operation_id='${visitor}',updated_revision=12 where x=${newcomer.x} and y=${newcomer.y};update public.worlds set revision=12 where id='commons';`);
 query("insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch) values('00000000-0000-4000-8000-000000000102','commons',null,'wrong-marker','wrong-hash',12,1);");
 assert.throws(()=>run('starter-radio-local-restore-conflict',buildRadioRestoreSql(plan.requestHash)),/RADIO_RESTORE_MARKER_CONFLICT/);
 assert.equal(query("select revision from public.worlds where id='commons'"),'12');
 query("delete from public.paint_operations where id='00000000-0000-4000-8000-000000000102';");
 run('starter-radio-local-restore',buildRadioRestoreSql(plan.requestHash));
 for(const row of baseline)assert.equal(query(`select color||':'||coalesce(operation_id::text,'null') from public.cells where x=${row.x} and y=${row.y}`),row.color+':'+(row.operationId||'null'));
 assert.equal(query(`select color||':'||operation_id::text from public.cells where x=${newcomer.x} and y=${newcomer.y}`),'#F0D66E:'+visitor);
 assert.equal(query('select count(*) from public.cells'),'5','all newly inserted refresh-owned cells are removed; later visitor mark survives');
 assert.equal(query("select public_epoch from public.worlds where id='commons'"),'2');
 const restored=query("select revision from public.worlds where id='commons'");run('starter-radio-local-restore-repeat',buildRadioRestoreSql(plan.requestHash));assert.equal(query("select revision from public.worlds where id='commons'"),restored);
 console.log('PASS: stale review rollback; actual local SQL apply+idempotent repeat; seed-only replacement; visitor and null/white preservation; guarded exact restoration; later visitor survives; recovery repeat no-op.');
} finally {
 query(`delete from public.world_events where operation_id in('${SOURCE_OPERATION}','${REFRESH_OPERATION}','00000000-0000-4000-8000-000000000102','${visitor}');delete from public.cells where operation_id in('${SOURCE_OPERATION}','${REFRESH_OPERATION}','00000000-0000-4000-8000-000000000102','${visitor}') or (operation_id is null and x=${art[2].x} and y=${art[2].y});delete from public.paint_operations where id in('${SOURCE_OPERATION}','${REFRESH_OPERATION}','00000000-0000-4000-8000-000000000102','${visitor}');update public.worlds set revision=0,public_epoch=1 where id='commons';`);
 assert.equal(query('select (select count(*) from public.cells)+(select count(*) from public.paint_operations)+(select count(*) from public.world_events)'),'0');
 console.log('CLEAN: local radio fixture cells, operations, and events removed. No hosted refresh occurred.');
}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
