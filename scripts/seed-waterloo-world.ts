import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WATERLOO_EVENT_ID, WATERLOO_MEMORIES, WATERLOO_OPERATION_ID, WATERLOO_PIXELS, WATERLOO_SEED_MARKER } from "../src/lib/waterloo-world";

/** Preparation only. No credentials, database clients or remote execution.
 * Review the SQL, deploy its local assets, then use the existing linked
 * operator tooling to apply the insert-only transaction. */
const literal = (value: unknown) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const payload = { marker: WATERLOO_SEED_MARKER, memories: WATERLOO_MEMORIES, pixels: WATERLOO_PIXELS };
export const waterlooSeedHash = () => createHash("sha256").update(JSON.stringify(payload)).digest("hex");
export function waterlooSeedSummary() {
  return { marker: WATERLOO_SEED_MARKER, requestHash: waterlooSeedHash(), memories: WATERLOO_MEMORIES.length,
    images: WATERLOO_MEMORIES.filter(memory => memory.type === "image").length, proposedPixels: WATERLOO_PIXELS.length,
    behavior: "One atomic insert-only expansion. Existing cells and originals stay in place. A successful rerun is a no-op." };
}

export function buildWaterlooSeedSql() {
  const hash = waterlooSeedHash();
  return `-- Memory Box Waterloo commons: original fictional examples and editable art.
-- REVIEW BEFORE EXECUTION. Additive only; existing visitor/seed content is preserved.
-- Requires the signed-world migration and starter-world SVG path allowlist.
-- Deploy the four public/starter-world/uw-*.svg assets before applying.
begin;
create temporary table mb_waterloo_seed_payload(payload jsonb) on commit drop;
insert into mb_waterloo_seed_payload values(${literal(payload)});
create temporary table mb_waterloo_seed_result(payload jsonb) on commit drop;
do $waterloo_seed$
declare w public.worlds; prior public.paint_operations; p jsonb;
 new_revision bigint; inserted_pixels jsonb; pixel_count integer; memory_count integer;
begin
 select payload into p from mb_waterloo_seed_payload;
 select * into strict w from public.worlds where id='commons' for update;
 select * into prior from public.paint_operations where id='${WATERLOO_OPERATION_ID}';
 if found then
  if prior.actor_id is not null or prior.world_id is distinct from 'commons' or prior.client_id is distinct from '${WATERLOO_SEED_MARKER}' or prior.request_hash is distinct from '${hash}' then
   raise exception 'WATERLOO_SEED_MARKER_CONFLICT';
  end if;
  insert into mb_waterloo_seed_result values(jsonb_build_object('status','already-applied','revision',prior.revision,'operationId',prior.id,'changed',0));
  return;
 end if;
 if exists(select 1 from public.paint_operations where client_id='${WATERLOO_SEED_MARKER}') then raise exception 'WATERLOO_SEED_MARKER_CONFLICT'; end if;
 if exists(
  select 1 from public.memories m join jsonb_to_recordset(p->'memories') as d(id uuid) on m.id=d.id
  where not m.is_seed or m.author_id is not null or m.world_id is distinct from 'commons'
   or m.client_id is distinct from '${WATERLOO_SEED_MARKER}:'||m.id::text or m.request_hash is distinct from '${hash}'
 ) then raise exception 'WATERLOO_SEED_MEMORY_CONFLICT'; end if;
 new_revision:=w.revision+1;
 insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch,scene_id,before_cells,after_cells)
 values('${WATERLOO_OPERATION_ID}','commons',null,'${WATERLOO_SEED_MARKER}','${hash}',new_revision,w.public_epoch,'garden','[]','[]');
 with inserted as (
  insert into public.cells(world_id,x,y,color,operation_id,updated_revision)
  select 'commons',d.x,d.y,d.color,'${WATERLOO_OPERATION_ID}'::uuid,new_revision
  from jsonb_to_recordset(p->'pixels') as d(x integer,y integer,color text)
  on conflict(world_id,x,y) do nothing
  returning x,y,color
 ) select count(*),coalesce(jsonb_agg(jsonb_build_object('x',x,'y',y,'color',color)),'[]'::jsonb)
   into pixel_count,inserted_pixels from inserted;
 update public.paint_operations set after_cells=inserted_pixels where id='${WATERLOO_OPERATION_ID}';
 insert into public.memories(id,world_id,author_id,author_name,client_id,request_hash,type,title,body,color,x,y,scene_id,inspired_by,seed_image_url,visibility,is_seed,index_status,search_document,created_at)
 select d.id,'commons',null,d."authorName",'${WATERLOO_SEED_MARKER}:'||d.id::text,'${hash}',d.type,d.title,d.body,d.color,d.x,d.y,d."sceneId",d."inspiredBy",d."imageUrl",'published',true,'pending',d.title||E'\n'||d.body,
  timestamptz '2026-10-21 18:00:00+00' + (row_number() over(order by d.id) * interval '1 minute')
 from jsonb_to_recordset(p->'memories') as d(id uuid,"authorName" text,title text,body text,type text,color text,x integer,y integer,"sceneId" text,"inspiredBy" uuid,"imageUrl" text)
 on conflict(id) do nothing;
 get diagnostics memory_count=row_count;
 insert into public.index_jobs(memory_id,source_version)
 select m.id,m.version from public.memories m
 join jsonb_to_recordset(p->'memories') as d(id uuid) on m.id=d.id
 where m.visibility='published' and m.is_seed and m.author_id is null and m.world_id='commons'
  and m.client_id='${WATERLOO_SEED_MARKER}:'||m.id::text and m.request_hash='${hash}'
 on conflict(memory_id,source_version) do nothing;
 update public.worlds set revision=new_revision where id='commons';
 -- One labeled starter event. The existing world notice trigger publishes the
 -- authoritative revision; no fictional live participant is introduced.
 insert into public.world_events(id,world_id,revision,kind,author_name,operation_id,scene_id,description,is_seed)
 values('${WATERLOO_EVENT_ID}','commons',new_revision,'paint','Waterloo starter artwork','${WATERLOO_OPERATION_ID}','garden','added fictional Waterloo starter fragments and unfinished shared pixel artwork',true);
 insert into mb_waterloo_seed_result values(jsonb_build_object('status','applied','revision',new_revision,'operationId','${WATERLOO_OPERATION_ID}','insertedPixels',pixel_count,'insertedMemories',memory_count,'skippedOccupiedPixels',jsonb_array_length(p->'pixels')-pixel_count));
end $waterloo_seed$;
select payload from mb_waterloo_seed_result;
commit;
`;
}

function main(args: string[]) {
  if (!args.length || args[0] === "--help" || args[0] === "-h") {
    console.log(`Memory Box Waterloo seed preparation (does not contact a database)

  npx tsx scripts/seed-waterloo-world.ts --summary
  npx tsx scripts/seed-waterloo-world.ts --sql <new output.sql>

Deploy the four starter-world/uw-*.svg assets before executing the reviewed SQL.
Apply using the existing linked Supabase database operator tooling. Successful
imports are marked permanently: reruns do not restore edited/withdrawn content.
No credentials are loaded or written by this script.`);
    return;
  }
  if (args.length === 1 && args[0] === "--summary") { console.log(JSON.stringify(waterlooSeedSummary(),null,2)); return; }
  if (args.length === 2 && args[0] === "--sql") {
    const path=resolve(args[1]); mkdirSync(dirname(path),{recursive:true});writeFileSync(path,buildWaterlooSeedSql(),{flag:"wx"});
    console.log(JSON.stringify({...waterlooSeedSummary(),sql:path},null,2));return;
  }
  throw new Error("Use --summary or --sql <new output.sql>. Run --help for details.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch(error){console.error(error instanceof Error?error.message:"Seed preparation failed");process.exitCode=1;}
}
