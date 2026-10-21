-- Shared pilot inference allowance, source lifecycle, and private asset reclamation.
alter table public.assets add column cleanup_claimed_at timestamptz;
alter table public.assets add column cleanup_completed_at timestamptz;
create index assets_cleanup_pending_idx on public.assets(created_at) where cleanup_completed_at is null;

-- The configurable inner function is service-only. Its optional exact-ID filter
-- supports isolated operational checks without spending the production allowance.
create function public.mb_lease_index_jobs_budget(p_limit integer,p_budget_actor uuid,p_budget_kind text,p_daily_limit integer,p_memory_ids uuid[] default null) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare j public.index_jobs; result jsonb:='[]'::jsonb; memory jsonb;
begin
 if p_budget_actor is null or p_budget_kind !~ '^[a-z_]{1,40}$' or p_daily_limit not between 1 and 10000000 then raise exception 'INVALID_BUDGET';end if;
 -- Match mutation/completion lock order before touching jobs and memory rows.
 perform 1 from public.worlds where id='commons' for update;
 update public.index_jobs jobs set status='obsolete',lease_until=null
 where jobs.status in ('pending','processing','failed')
 and (p_memory_ids is null or jobs.memory_id=any(p_memory_ids))
 and not exists(select 1 from public.memories m where m.id=jobs.memory_id and m.version=jobs.source_version and m.visibility='published');
 -- A worker killed during its final allowed lease must not leave a permanent
 -- processing state. Do not charge a new reservation or increment its attempts.
 with exhausted as (
  update public.index_jobs jobs set status='failed',lease_until=null,last_error='attempts_exhausted'
  where jobs.status='processing' and jobs.attempts>=4 and jobs.lease_until<now()
  and (p_memory_ids is null or jobs.memory_id=any(p_memory_ids))
  returning jobs.memory_id,jobs.source_version
 ) update public.memories m set index_status='failed' from exhausted e
 where m.id=e.memory_id and m.version=e.source_version and m.visibility='published';
 for j in
  select jobs.* from public.index_jobs jobs join public.memories m on m.id=jobs.memory_id and m.version=jobs.source_version and m.visibility='published'
  where ((jobs.status in ('pending','failed') and jobs.available_at<=now()) or (jobs.status='processing' and jobs.lease_until<now()))
  and jobs.attempts<4 and (p_memory_ids is null or jobs.memory_id=any(p_memory_ids))
  order by jobs.available_at,jobs.created_at for update of jobs skip locked limit least(greatest(p_limit,1),10)
 loop
  begin
   perform public.mb_consume_budget(p_budget_actor,p_budget_kind,p_daily_limit,86400,1);
  exception when raise_exception then
   if sqlerrm='RATE_LIMITED' then exit;else raise;end if;
  end;
  update public.index_jobs set status='processing',attempts=attempts+1,lease_until=now()+interval '120 seconds' where id=j.id;
  select public.mb_memory_json(m) into memory from public.memories m where m.id=j.memory_id and m.version=j.source_version and m.visibility='published';
  result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'memory_id',j.memory_id,'source_version',j.source_version,'attempts',j.attempts+1,'memory',memory));
 end loop;
 return result;
end $$;

create or replace function public.mb_lease_index_jobs(p_limit integer default 5) returns jsonb
language sql set search_path=public,extensions as $$
 select public.mb_lease_index_jobs_budget(p_limit,'00000000-0000-0000-0000-000000000000','global_index',80,null)
$$;

create function public.mb_claim_asset_cleanup(p_limit integer default 25,p_asset_ids uuid[] default null) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare a public.assets;result jsonb:='[]'::jsonb;
begin
 for a in
  select candidate.* from public.assets candidate
  where candidate.created_at<now()-interval '24 hours' and candidate.cleanup_completed_at is null
  and (candidate.cleanup_claimed_at is null or candidate.cleanup_claimed_at<now()-interval '15 minutes')
  and (p_asset_ids is null or candidate.id=any(p_asset_ids))
  and not exists(select 1 from public.memories m where m.asset_id=candidate.id and m.visibility in ('published','hidden'))
  order by candidate.created_at for update of candidate skip locked limit least(greatest(p_limit,1),50)
 loop
  -- Recheck in a fresh statement after acquiring the asset lock. A publisher
  -- also locks this row before checking ready, so neither side can pass a stale
  -- eligibility snapshot while the other commits a publication or a claim.
  if exists(select 1 from public.memories m where m.asset_id=a.id and m.visibility in ('published','hidden')) then continue;end if;
  update public.assets set status='deleted',cleanup_claimed_at=now() where id=a.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',a.id,'path',a.path,'staging_path',a.staging_path));
 end loop;
 return result;
end $$;

create function public.mb_complete_asset_cleanup(p_id uuid) returns boolean
language plpgsql set search_path=public,extensions as $$
declare a public.assets;
begin
 select * into a from public.assets where id=p_id for update;
 if not found or a.status<>'deleted' or a.cleanup_claimed_at is null then return false;end if;
 if exists(select 1 from public.memories m where m.asset_id=a.id and m.visibility in ('published','hidden')) then return false;end if;
 update public.assets set cleanup_completed_at=coalesce(cleanup_completed_at,now()) where id=p_id;
 return true;
end $$;

revoke all on function public.mb_lease_index_jobs_budget(integer,uuid,text,integer,uuid[]) from public,anon,authenticated;
revoke all on function public.mb_claim_asset_cleanup(integer,uuid[]) from public,anon,authenticated;
revoke all on function public.mb_complete_asset_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.mb_lease_index_jobs_budget(integer,uuid,text,integer,uuid[]) to service_role;
grant execute on function public.mb_claim_asset_cleanup(integer,uuid[]) to service_role;
grant execute on function public.mb_complete_asset_cleanup(uuid) to service_role;
create or replace function public.mb_create_memory(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; m public.memories; prior public.memories; v_name text; v_hash text; v_asset uuid; v_parent uuid; v_paint uuid;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_hash:=encode(digest(p_input::text,'sha256'),'hex');
 select * into prior from public.memories where author_id=p_actor and client_id=p_input->>'clientId';
 if found then
  if prior.request_hash<>v_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
  if prior.visibility<>'published' then raise exception 'SOURCE_UNAVAILABLE'; end if;
  return public.mb_memory_json(prior);
 end if;
 v_name:=public.mb_profile(p_actor)->>'name';
 perform public.mb_consume_budget(p_actor,'memory_publish',12,60,1);
 v_asset:=nullif(p_input->>'assetId','')::uuid;v_parent:=nullif(p_input->>'inspiredBy','')::uuid;v_paint:=nullif(p_input->>'paintOperationId','')::uuid;
 if v_asset is not null then
  perform 1 from public.assets where id=v_asset and owner_id=p_actor and status='ready' for update;
  if not found then raise exception 'ASSET_UNAVAILABLE' using errcode='42501'; end if;
 end if;
 if v_parent is not null and not exists(select 1 from public.memories where id=v_parent and visibility='published') then raise exception 'SOURCE_UNAVAILABLE'; end if;
 if v_paint is not null and not exists(select 1 from public.paint_operations where id=v_paint and world_id=w.id and epoch=w.public_epoch) then raise exception 'PAINT_UNAVAILABLE'; end if;
 insert into public.memories(author_id,author_name,client_id,request_hash,type,title,body,url,asset_id,color,x,y,scene_id,inspired_by,paint_operation_id,search_document)
 values(p_actor,v_name,p_input->>'clientId',v_hash,p_input->>'type',coalesce(trim(p_input->>'title'),''),coalesce(trim(p_input->>'body'),''),nullif(p_input->>'url',''),v_asset,upper(p_input->>'color'),(p_input->>'x')::integer,(p_input->>'y')::integer,p_input->>'sceneId',v_parent,v_paint,coalesce(p_input->>'title','')||E'\n'||coalesce(p_input->>'body','')||E'\n'||coalesce(p_input->>'url','')) returning * into m;
 insert into public.index_jobs(memory_id,source_version) values(m.id,m.version);
 update public.worlds set revision=revision+1 where id=w.id returning revision into w.revision;
 insert into public.world_events(revision,kind,author_name,memory_id,scene_id,description)
 values(w.revision,case when v_parent is null then 'memory' else 'build_on' end,v_name,m.id,m.scene_id,case when v_parent is null then 'left a '||m.type||' memory' else 'built on another memory' end);
 return public.mb_memory_json(m);
end $$;

create or replace function public.mb_update_memory(p_actor uuid,p_id uuid,p_version integer,p_patch jsonb) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; m public.memories; v_profile jsonb; v_asset uuid; candidate public.memories;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_profile:=public.mb_profile(p_actor);
 select * into m from public.memories where id=p_id for update;
 if not found or (m.author_id is distinct from p_actor and not (v_profile->>'isOperator')::boolean) then raise exception 'NOT_OWNER' using errcode='42501'; end if;
 if m.visibility<>'published' then raise exception 'SOURCE_UNAVAILABLE'; end if;
 if m.version<>p_version then raise exception 'VERSION_CONFLICT' using errcode='PT409'; end if;
 v_asset:=case when p_patch ? 'assetId' then nullif(p_patch->>'assetId','')::uuid else m.asset_id end;
 if v_asset is distinct from m.asset_id then
  perform 1 from public.assets where id=v_asset and owner_id=p_actor and status='ready' for update;
  if not found then raise exception 'ASSET_UNAVAILABLE' using errcode='42501'; end if;
 end if;
 candidate:=m;
 candidate.title:=case when p_patch?'title' then trim(p_patch->>'title') else m.title end;
 candidate.body:=case when p_patch?'body' then trim(p_patch->>'body') else m.body end;
 candidate.url:=case when p_patch?'url' then nullif(p_patch->>'url','') else m.url end;
 candidate.color:=case when p_patch?'color' then upper(p_patch->>'color') else m.color end;
 candidate.x:=case when p_patch?'x' then (p_patch->>'x')::integer else m.x end;
 candidate.y:=case when p_patch?'y' then (p_patch->>'y')::integer else m.y end;
 candidate.scene_id:=case when p_patch?'sceneId' then p_patch->>'sceneId' else m.scene_id end;
 candidate.asset_id:=v_asset;
 if row(candidate.title,candidate.body,candidate.url,candidate.color,candidate.x,candidate.y,candidate.scene_id,candidate.asset_id)
    is not distinct from row(m.title,m.body,m.url,m.color,m.x,m.y,m.scene_id,m.asset_id) then
  return public.mb_memory_json(m);
 end if;
 update public.memories set title=case when p_patch?'title' then trim(p_patch->>'title') else title end,
 body=case when p_patch?'body' then trim(p_patch->>'body') else body end,
 url=case when p_patch?'url' then nullif(p_patch->>'url','') else url end,
 color=case when p_patch?'color' then upper(p_patch->>'color') else color end,
 x=case when p_patch?'x' then (p_patch->>'x')::integer else x end,
 y=case when p_patch?'y' then (p_patch->>'y')::integer else y end,
 scene_id=case when p_patch?'sceneId' then p_patch->>'sceneId' else scene_id end,
 asset_id=v_asset,version=version+1,index_status='pending',updated_at=now()
 where id=p_id returning * into m;
 update public.memories set search_document=m.title||E'\n'||m.body||E'\n'||coalesce(m.url,'') where id=m.id;
 delete from public.memory_embeddings where memory_id=m.id;
 update public.index_jobs set status='obsolete',lease_until=null where memory_id=m.id and status in ('pending','processing','failed');
 insert into public.index_jobs(memory_id,source_version) values(m.id,m.version);
 update public.worlds set revision=revision+1 where id=w.id returning revision into w.revision;
 insert into public.world_events(revision,kind,author_name,memory_id,scene_id,description) values(w.revision,'memory',v_profile->>'name',m.id,m.scene_id,'updated a memory');
 return public.mb_memory_json(m);
end $$;


create or replace function public.mb_delete_memory(p_actor uuid,p_id uuid) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; m public.memories; v_profile jsonb;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_profile:=public.mb_profile(p_actor);
 select * into m from public.memories where id=p_id for update;
 if not found or (m.author_id is distinct from p_actor and not (v_profile->>'isOperator')::boolean) then raise exception 'NOT_OWNER' using errcode='42501'; end if;
 if m.visibility='deleted' then return jsonb_build_object('assetId',m.asset_id); end if;
 update public.memories set visibility='deleted',title='',body='',url=null,search_document='',version=version+1,updated_at=now(),index_status='failed' where id=m.id;
 delete from public.memory_embeddings where memory_id=m.id;
 update public.index_jobs set status='obsolete',lease_until=null where memory_id=m.id;
 if m.asset_id is not null then
  update public.assets a set status='deleted' where a.id=m.asset_id
  and not exists(select 1 from public.memories other where other.asset_id=a.id and other.visibility in ('published','hidden'));
 end if;
 update public.worlds set revision=revision+1 where id=w.id returning revision into w.revision;
 insert into public.world_events(revision,kind,author_name,memory_id,scene_id,description) values(w.revision,'delete',v_profile->>'name',m.id,m.scene_id,'removed a memory');
 return jsonb_build_object('assetId',m.asset_id);
end $$;
