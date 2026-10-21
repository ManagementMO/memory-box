import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { adminClient } from "../src/lib/server/database";

const PROJECT_REF = "mmxtgfnxfwsgxxorystb";
export const SOURCE_OPERATION = "00000000-0000-4000-8000-000000000100";
export const REFRESH_OPERATION = "00000000-0000-4000-8000-000000000101";
const RESTORE_OPERATION = "00000000-0000-4000-8000-000000000102";
const MARKER = "seed:radio-pastel:v1";
const execute = promisify(execFile);
type Candidate = { x: number; y: number; color: string; insertable: boolean };
export type RadioCell = { x: number; y: number; color: string; operationId: string | null; revision: number };
export type RadioPlan = {
  format: "memory-box-starter-radio-v1"; projectRef: string; assetSha256: string; requestHash: string;
  preparedAt: string; preparedRevision: number; preparedEpoch: number;
  candidates: Candidate[]; baseline: RadioCell[];
  counts: { candidates: number; art: number; replaceSeed: number; insertArt: number; preserveOtherOwner: number; absentClear: number };
};
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const order = (a: {x:number;y:number}, b: {x:number;y:number}) => a.x-b.x || a.y-b.y;
const key = (p: {x:number;y:number}) => `${p.x},${p.y}`;
const literal = (value: unknown) => "'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";

export async function radioCandidates(svg: Buffer): Promise<Candidate[]> {
  const meta=await sharp(svg).metadata();
  assert.equal(meta.width,420);assert.equal(meta.height,300);
  const {data,info}=await sharp(svg).resize(84,60,{kernel:"nearest"}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,4);
  const candidates=new Map<string,Candidate>();
  // Old radio footprint, in cells. Pond was painted later in column 50 from
  // row73 down; its same-seed ownership is not enough to identify it as radio.
  for(let x=50;x<134;x++)for(let y=40;y<81;y++) {
    if(x===50&&y>=73)continue;
    const p={x,y,color:"#FFFFFF",insertable:false};candidates.set(key(p),p);
  }
  for(let y=0;y<60;y++)for(let x=0;x<84;x++) {
    const at=(y*84+x)*4,alpha=data[at+3];
    assert.ok(alpha===0||alpha===255,"Source must remain grid-aligned with no partially transparent cells.");
    if(!alpha)continue;
    const p={x:45+x,y:30+y,color:"#"+data.subarray(at,at+3).toString("hex").toUpperCase(),insertable:true};
    candidates.set(key(p),p);
  }
  return [...candidates.values()].sort(order);
}

export function makeRadioPlan(svg: Buffer,candidates: Candidate[],rows: RadioCell[],revision:number,epoch:number): RadioPlan {
  const allowed=new Set(candidates.map(key));
  const baseline=rows.filter(p=>allowed.has(key(p))).map(p=>({x:p.x,y:p.y,color:p.color,operationId:p.operationId,revision:p.revision})).sort(order);
  const byKey=new Map(baseline.map(p=>[key(p),p]));
  const counts={candidates:candidates.length,art:0,replaceSeed:0,insertArt:0,preserveOtherOwner:0,absentClear:0};
  for(const p of candidates){const old=byKey.get(key(p));if(p.insertable)counts.art++;if(old){if(old.operationId===SOURCE_OPERATION)counts.replaceSeed++;else counts.preserveOtherOwner++;}else if(p.insertable)counts.insertArt++;else counts.absentClear++;}
  const assetSha256=hash(svg),requestHash=hash(JSON.stringify({marker:MARKER,assetSha256,grid:6,x:270,y:180,source:SOURCE_OPERATION,candidates}));
  return {format:"memory-box-starter-radio-v1",projectRef:PROJECT_REF,assetSha256,requestHash,preparedAt:new Date().toISOString(),preparedRevision:revision,preparedEpoch:epoch,candidates,baseline,counts};
}

/** Direct administrative transaction; no persistent RPC or browser grant is added. */
export function buildRadioRefreshSql(plan: RadioPlan): string {
  return `-- REVIEW BEFORE EXECUTION. Updates starter-owned radio cells only.
-- Prepared counts are advisory; exact candidate baseline is checked under locks.
begin;
create temporary table mb_radio_plan(payload jsonb) on commit drop;
insert into mb_radio_plan values(${literal(plan)});
create temporary table mb_radio_desired on commit drop as
 select d.* from mb_radio_plan p,jsonb_to_recordset(p.payload->'candidates') as d(x integer,y integer,color text,insertable boolean);
create temporary table mb_radio_result(payload jsonb) on commit drop;
do $radio$
declare w public.worlds;prior public.paint_operations;p jsonb;current_rows jsonb;
 before_rows jsonb;after_rows jsonb;changed integer;new_revision bigint;
begin
 select payload into p from mb_radio_plan;
 select * into strict w from public.worlds where id='commons' for update;
 select * into prior from public.paint_operations where id='${REFRESH_OPERATION}';
 if found then
  if prior.actor_id is not null or prior.world_id<>'commons' or prior.client_id<>'${MARKER}' or prior.request_hash<>p->>'requestHash' then raise exception 'RADIO_MARKER_CONFLICT';end if;
  insert into mb_radio_result values(jsonb_build_object('status','already-applied','operationId',prior.id,'revision',prior.revision,'changed',jsonb_array_length(prior.after_cells)));
  return;
 end if;
 if not exists(select 1 from public.paint_operations where id='${SOURCE_OPERATION}' and actor_id is null and world_id='commons' and client_id='seed:v1') then raise exception 'RADIO_SEED_SOURCE_MISSING';end if;
 if exists(select 1 from public.paint_operations where world_id='commons' and client_id='${MARKER}') then raise exception 'RADIO_MARKER_CONFLICT';end if;
 perform 1 from public.cells c join mb_radio_desired d using(x,y) where c.world_id='commons' for update of c;
 select coalesce(jsonb_agg(jsonb_build_object('x',c.x,'y',c.y,'color',c.color,'operationId',c.operation_id,'revision',c.updated_revision) order by c.x,c.y),'[]'::jsonb)
 into current_rows from public.cells c join mb_radio_desired d using(x,y) where c.world_id='commons';
 if current_rows is distinct from p->'baseline' then raise exception 'RADIO_REVIEW_STALE: prepare a new plan; no cells changed';end if;
 select coalesce(jsonb_agg(jsonb_build_object('x',d.x,'y',d.y,'existed',c.x is not null,'color',c.color,'operationId',c.operation_id,'revision',c.updated_revision) order by d.x,d.y),'[]'::jsonb),
 coalesce(jsonb_agg(jsonb_build_object('x',d.x,'y',d.y,'color',d.color) order by d.x,d.y),'[]'::jsonb)
 into before_rows,after_rows from mb_radio_desired d left join public.cells c on c.world_id='commons' and c.x=d.x and c.y=d.y
 where c.operation_id='${SOURCE_OPERATION}' or (c.x is null and d.insertable);
 if jsonb_array_length(after_rows)=0 then
  insert into mb_radio_result values(jsonb_build_object('status','no-eligible-cells','changed',0,'counts',p->'counts'));return;
 end if;
 new_revision:=w.revision+1;
 insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch,scene_id,before_cells,after_cells)
 values('${REFRESH_OPERATION}','commons',null,'${MARKER}',p->>'requestHash',new_revision,w.public_epoch,'mixtape',before_rows,after_rows);
 insert into public.cells(world_id,x,y,color,operation_id,updated_revision)
 select 'commons',d.x,d.y,d.color,'${REFRESH_OPERATION}'::uuid,new_revision from jsonb_to_recordset(after_rows) as d(x integer,y integer,color text)
 on conflict(world_id,x,y) do update set color=excluded.color,operation_id=excluded.operation_id,updated_revision=excluded.updated_revision
 where cells.operation_id='${SOURCE_OPERATION}';
 get diagnostics changed=row_count;
 if changed<>jsonb_array_length(after_rows) then raise exception 'RADIO_VISITOR_RACE: no cells changed';end if;
 update public.worlds set revision=new_revision where id='commons';
 insert into public.world_events(world_id,revision,kind,author_name,operation_id,scene_id,description,is_seed)
 values('commons',new_revision,'paint','Starter artwork','${REFRESH_OPERATION}','mixtape','refreshed the labeled starter radio artwork',true);
 insert into mb_radio_result values(jsonb_build_object('status','applied','operationId','${REFRESH_OPERATION}','revision',new_revision,'epoch',w.public_epoch,'changed',changed,'counts',p->'counts','before',before_rows,'after',after_rows));
end $radio$;
select payload from mb_radio_result;
commit;
`;
}

/** Recovery is optional and separately reviewed: it restores only current op101
 * cells. Removing inserted rows advances epoch so all clients resnapshot. */
export function buildRadioRestoreSql(requestHash: string): string {
  assert.match(requestHash,/^[a-f0-9]{64}$/);
  return `-- OPTIONAL RECOVERY ONLY. Preserves later visitor changes.
-- Advances epoch to synchronize exact deletion of newly inserted cells.
begin;
do $restore$
declare w public.worlds;op public.paint_operations;prior public.paint_operations;before_restore jsonb;after_restore jsonb;new_revision bigint;
begin
 select * into strict w from public.worlds where id='commons' for update;
 select * into prior from public.paint_operations where id='${RESTORE_OPERATION}';
 if found then
  if prior.actor_id is not null or prior.world_id<>'commons' or prior.client_id<>'${MARKER}:restore' or prior.request_hash<>'${requestHash}' then raise exception 'RADIO_RESTORE_MARKER_CONFLICT';end if;
  return;
 end if;
 select * into strict op from public.paint_operations where id='${REFRESH_OPERATION}';
 if op.actor_id is not null or op.world_id<>'commons' or op.client_id<>'${MARKER}' or op.request_hash<>'${requestHash}' then raise exception 'RADIO_RESTORE_MARKER_CONFLICT';end if;
 perform 1 from public.cells where world_id='commons' and operation_id=op.id for update;
 select coalesce(jsonb_agg(jsonb_build_object('x',c.x,'y',c.y,'existed',true,'color',c.color,'operationId',c.operation_id,'revision',c.updated_revision)),'[]'::jsonb),
 coalesce(jsonb_agg(b),'[]'::jsonb) into before_restore,after_restore from jsonb_array_elements(op.before_cells)b
 join public.cells c on c.world_id='commons' and c.x=(b->>'x')::integer and c.y=(b->>'y')::integer and c.operation_id=op.id;
 new_revision:=w.revision+1;
 insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch,scene_id,before_cells,after_cells)
 values('${RESTORE_OPERATION}','commons',null,'${MARKER}:restore','${requestHash}',new_revision,w.public_epoch+1,'mixtape',before_restore,after_restore);
 update public.cells c set color=b->>'color',operation_id=nullif(b->>'operationId','')::uuid,updated_revision=new_revision
 from jsonb_array_elements(after_restore)b where c.world_id='commons' and c.x=(b->>'x')::integer and c.y=(b->>'y')::integer and c.operation_id=op.id and (b->>'existed')::boolean;
 delete from public.cells c using jsonb_array_elements(after_restore)b where c.world_id='commons' and c.x=(b->>'x')::integer and c.y=(b->>'y')::integer and c.operation_id=op.id and not (b->>'existed')::boolean;
 update public.worlds set revision=new_revision,public_epoch=public_epoch+1 where id='commons';
 insert into public.world_events(world_id,revision,kind,author_name,operation_id,scene_id,description,is_seed)
 values('commons',new_revision,'moderation','Starter artwork','${RESTORE_OPERATION}','mixtape','restored the previous labeled starter artwork where still untouched',true);
end $restore$;
select 'Radio recovery completed or was already recorded; later visitor edits preserved.' as result;
commit;
`;
}

function loadEnvironment() {
  try {process.loadEnvFile('.env.local');}catch{}
  const linked=readFileSync('supabase/.temp/project-ref','utf8').trim();
  assert.equal(linked,PROJECT_REF,"Unexpected linked project.");
  assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'').hostname,linked+'.supabase.co',"Environment/project mismatch.");
}
async function main() {
  const args=process.argv.slice(2);
  if(args.includes('--help')) {console.log(`Starter radio refresh (run from app directory)
  npx tsx scripts/refresh-starter-radio.ts --prepare
  npx tsx scripts/refresh-starter-radio.ts --apply ../work/starter-radio-refresh-plan.json
Default/--prepare reads current cell metadata and writes review files locally. No cloud writes.
--apply requires separate approval and an unchanged reviewed candidate baseline.
No source text, memory positions, assets, users, or provider calls are changed.
Optional recovery SQL is generated for review; it is never run automatically.`);return;}
  assert.ok(args.length===0||(args.length===1&&args[0]==='--prepare')||(args.length===2&&args[0]==='--apply'),"Use --prepare or --apply <reviewed-plan.json>.");
  loadEnvironment();
  const svg=readFileSync('public/starter-radio.svg'),candidates=await radioCandidates(svg);
  if(args[0]==='--apply') {
    const plan=JSON.parse(readFileSync(resolve(args[1]),'utf8')) as RadioPlan;
    assert.equal(plan.format,'memory-box-starter-radio-v1');assert.equal(plan.projectRef,PROJECT_REF);assert.equal(plan.assetSha256,hash(svg));
    assert.deepEqual(plan.candidates,candidates);
    const normalized=makeRadioPlan(svg,candidates,plan.baseline,plan.preparedRevision,plan.preparedEpoch);
    assert.equal(plan.requestHash,normalized.requestHash);assert.deepEqual(plan.baseline,normalized.baseline);assert.deepEqual(plan.counts,normalized.counts);
    const file=resolve('../work/starter-radio-refresh-reviewed.sql');writeFileSync(file,buildRadioRefreshSql(plan));
    const result=await execute('supabase',['db','query','--linked','--file',file],{timeout:45_000,maxBuffer:5_000_000});
    writeFileSync(resolve('../work/starter-radio-refresh-result.json'),result.stdout);
    const parsed=JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))) as {rows?:{payload?:Record<string,unknown>}[]};
    const payload=parsed.rows?.find(row=>row.payload)?.payload;
    assert.ok(payload,'Expected refresh audit result.');
    const {before:_before,after:_after,...summary}=payload;console.log(JSON.stringify(summary,null,2));return;
  }
  const db=adminClient(),rows:RadioCell[]=[];
  for(let start=0;;start+=1000) {
    const result=await db.from('cells').select('x,y,color,operation_id,updated_revision').eq('world_id','commons').gte('x',45).lte('x',133).gte('y',30).lte('y',89).order('x').order('y').range(start,start+999);
    assert.ifError(result.error);
    for(const p of result.data||[])rows.push({x:p.x,y:p.y,color:p.color,operationId:p.operation_id,revision:p.updated_revision});
    if((result.data?.length||0)<1000)break;
  }
  const world=await db.from('worlds').select('revision,public_epoch').eq('id','commons').single();assert.ifError(world.error);assert.ok(world.data);
  const plan=makeRadioPlan(svg,candidates,rows,world.data.revision,world.data.public_epoch),dir=resolve('../work');mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,'starter-radio-refresh-plan.json'),JSON.stringify(plan,null,2));
  writeFileSync(resolve(dir,'starter-radio-refresh-baseline.json'),JSON.stringify({operationId:REFRESH_OPERATION,preparedAt:plan.preparedAt,baseline:plan.baseline},null,2));
  writeFileSync(resolve(dir,'starter-radio-refresh-review.sql'),buildRadioRefreshSql(plan));
  writeFileSync(resolve(dir,'starter-radio-refresh-restore.sql'),buildRadioRestoreSql(plan.requestHash));
  console.log(JSON.stringify({status:'prepared-only',revision:plan.preparedRevision,epoch:plan.preparedEpoch,counts:plan.counts,files:'../work/starter-radio-refresh-{plan.json,baseline.json,review.sql,restore.sql}'},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Radio refresh verification is incomplete. Inspect the local result and exact operation marker before retrying; an apply may already have committed. Credentials were not printed.');process.exitCode=1;});
