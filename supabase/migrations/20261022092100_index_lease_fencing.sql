-- Attempt numbers are monotonic lease generations, already returned by the
-- bounded lease RPC. An expired/replaced worker cannot complete or fail its heir.
-- Captions belong to the accepted source-version index, not a mutable asset.
alter table public.memory_embeddings add column image_description text
 check (image_description is null or char_length(image_description) between 1 and 1000);

create function public.mb_complete_index_job_leased(
 p_job_id uuid,p_version integer,p_attempt integer,p_representation text,
 p_embedding extensions.vector(1536),p_model text default 'supabase/gte-small:padded1536',
 p_image_description text default null
) returns boolean
language plpgsql set search_path=public,extensions as $$
declare j public.index_jobs; m public.memories; v_revision bigint;
begin
 perform 1 from public.worlds where id='commons' for update;
 select * into j from public.index_jobs where id=p_job_id for update;
 if not found then return false;end if;
 if j.status<>'processing' or p_attempt is null or p_attempt<1 or j.attempts<>p_attempt
    or j.lease_until is null or j.lease_until<=clock_timestamp() then return false;end if;
 select * into m from public.memories where id=j.memory_id for update;
 if not found or m.visibility<>'published' or m.version is distinct from p_version or j.source_version is distinct from p_version then
  update public.index_jobs set status='obsolete',lease_until=null where id=j.id;
  return false;
 end if;
 if p_representation is null or char_length(p_representation) not between 1 and 12000 or p_embedding is null then raise exception 'INVALID_REPRESENTATION';end if;
 if (m.type='image' and (p_image_description is null or char_length(trim(p_image_description)) not between 1 and 1000))
    or (m.type<>'image' and p_image_description is not null) then raise exception 'INVALID_IMAGE_DESCRIPTION';end if;
 insert into public.memory_embeddings(memory_id,source_version,representation,embedding,model,image_description)
 values(m.id,p_version,p_representation,p_embedding,p_model,p_image_description)
 on conflict(memory_id) do update set source_version=excluded.source_version,representation=excluded.representation,
 embedding=excluded.embedding,model=excluded.model,image_description=excluded.image_description,created_at=now();
 update public.memories set index_status='ready',search_document=title||E'\n'||body||E'\n'||p_representation where id=m.id;
 update public.index_jobs set status='complete',lease_until=null,last_error=null where id=j.id;
 update public.worlds set revision=revision+1 where id='commons' returning revision into v_revision;
 insert into public.world_events(revision,kind,author_name,memory_id,scene_id,description,is_seed)
 values(v_revision,'memory',m.author_name,m.id,m.scene_id,'is ready to discover in search',m.is_seed);
 return true;
end $$;

create function public.mb_fail_index_job_leased(p_job_id uuid,p_attempt integer,p_reason text) returns boolean
language plpgsql set search_path=public,extensions as $$
declare j public.index_jobs;
begin
 -- Use the same world/job/memory lock order as leasing, mutation and completion.
 perform 1 from public.worlds where id='commons' for update;
 select * into j from public.index_jobs where id=p_job_id for update;
 if not found then return false;end if;
 if j.status<>'processing' or p_attempt is null or p_attempt<1 or j.attempts<>p_attempt
    or j.lease_until is null or j.lease_until<=clock_timestamp() then return false;end if;
 if not exists(select 1 from public.memories m where m.id=j.memory_id and m.version=j.source_version and m.visibility='published') then
  update public.index_jobs set status='obsolete',lease_until=null where id=j.id;
  return false;
 end if;
 update public.index_jobs set status='failed',lease_until=null,last_error=left(p_reason,120),
 available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)) where id=j.id;
 update public.memories set index_status='failed' where id=j.memory_id and version=j.source_version and visibility='published';
 return true;
end $$;

create or replace function public.mb_memory_json(m public.memories) returns jsonb
language sql stable set search_path=public,extensions as $$
 select jsonb_build_object(
 'id',m.id,'authorId',m.author_id,'authorName',m.author_name,'type',m.type,
 'title',m.title,'body',m.body,'url',m.url,
 'imageUrl',case when m.type='image' then coalesce(m.seed_image_url,'/api/assets/'||m.asset_id::text) else null end,
 'imageDescription',case when m.type='image' then coalesce(
  (select e.image_description from public.memory_embeddings e where e.memory_id=m.id and e.source_version=m.version),
  -- Keep existing private-image evidence available. New workers never mutate
  -- assets.description; no historical captions are inferred or backfilled here.
  (select a.description from public.assets a where a.id=m.asset_id and a.status='ready')) else null end,
 'color',m.color,'x',m.x,'y',m.y,'sceneId',m.scene_id,'inspiredBy',m.inspired_by,
 'paintOperationId',m.paint_operation_id,'createdAt',m.created_at,'updatedAt',m.updated_at,
 'version',m.version,'indexStatus',m.index_status,'isSeed',m.is_seed)
$$;

-- Apply this migration before deploying the matching worker. During that short
-- window old completion/failure calls are denied; leased jobs remain retryable
-- after expiry. Do not leave an unfenced compatibility RPC callable by workers.
revoke all on function public.mb_complete_index_job(uuid,integer,text,extensions.vector,text) from public,anon,authenticated,service_role;
revoke all on function public.mb_fail_index_job(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.mb_complete_index_job_leased(uuid,integer,integer,text,extensions.vector,text,text) from public,anon,authenticated;
revoke all on function public.mb_fail_index_job_leased(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.mb_complete_index_job_leased(uuid,integer,integer,text,extensions.vector,text,text) to service_role;
grant execute on function public.mb_fail_index_job_leased(uuid,integer,text) to service_role;
