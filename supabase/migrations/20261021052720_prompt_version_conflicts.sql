-- A stale expected version is a permanent application conflict.
-- Do not label it serialization_failure: PostgREST retries 40001 transactions.
create or replace function public.mb_update_memory(p_actor uuid,p_id uuid,p_version integer,p_patch jsonb) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; m public.memories; v_profile jsonb; v_asset uuid;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_profile:=public.mb_profile(p_actor);
 select * into m from public.memories where id=p_id for update;
 if not found or (m.author_id is distinct from p_actor and not (v_profile->>'isOperator')::boolean) then raise exception 'NOT_OWNER' using errcode='42501'; end if;
 if m.visibility<>'published' then raise exception 'SOURCE_UNAVAILABLE'; end if;
 if m.version<>p_version then raise exception 'VERSION_CONFLICT' using errcode='PT409'; end if;
 v_asset:=case when p_patch ? 'assetId' then nullif(p_patch->>'assetId','')::uuid else m.asset_id end;
 if v_asset is distinct from m.asset_id and not exists(select 1 from public.assets where id=v_asset and owner_id=p_actor and status='ready') then raise exception 'ASSET_UNAVAILABLE' using errcode='42501'; end if;
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
