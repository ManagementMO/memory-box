-- An invitation is an authored original, not a separate membership system.
-- Default false and omission-preserving edits keep older clients compatible.
alter table public.memories add column is_build_invitation boolean not null default false;
alter table public.memories add constraint build_invitation_has_words
 check (not is_build_invitation or body ~ '[^[:space:]]');

create or replace function public.mb_memory_json(m public.memories) returns jsonb
language sql stable set search_path=public,extensions as $$
 select jsonb_build_object(
 'id',m.id,'authorId',m.author_id,'authorName',m.author_name,'type',m.type,
 'title',m.title,'body',m.body,'url',m.url,
 'imageUrl',case when m.type='image' then coalesce(m.seed_image_url,'/api/assets/'||m.asset_id::text) else null end,
 'imageDescription',case when m.type='image' then coalesce(
  (select e.image_description from public.memory_embeddings e where e.memory_id=m.id and e.source_version=m.version),
  (select a.description from public.assets a where a.id=m.asset_id and a.status='ready')) else null end,
 'color',m.color,'x',m.x,'y',m.y,'sceneId',m.scene_id,'inspiredBy',m.inspired_by,
 'paintOperationId',m.paint_operation_id,'createdAt',m.created_at,'updatedAt',m.updated_at,
 'version',m.version,'indexStatus',m.index_status,'isSeed',m.is_seed,'isBuildInvitation',m.is_build_invitation)
$$;

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
 insert into public.memories(author_id,author_name,client_id,request_hash,type,title,body,url,asset_id,color,x,y,scene_id,inspired_by,paint_operation_id,is_build_invitation,search_document)
 values(p_actor,v_name,p_input->>'clientId',v_hash,p_input->>'type',coalesce(trim(p_input->>'title'),''),coalesce(trim(p_input->>'body'),''),nullif(p_input->>'url',''),v_asset,upper(p_input->>'color'),(p_input->>'x')::integer,(p_input->>'y')::integer,p_input->>'sceneId',v_parent,v_paint,coalesce((p_input->>'isBuildInvitation')::boolean,false),coalesce(p_input->>'title','')||E'\n'||coalesce(p_input->>'body','')||E'\n'||coalesce(p_input->>'url','')) returning * into m;
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
 candidate.is_build_invitation:=case when p_patch?'isBuildInvitation' then (p_patch->>'isBuildInvitation')::boolean else m.is_build_invitation end;
 if row(candidate.title,candidate.body,candidate.url,candidate.color,candidate.x,candidate.y,candidate.scene_id,candidate.asset_id,candidate.is_build_invitation)
    is not distinct from row(m.title,m.body,m.url,m.color,m.x,m.y,m.scene_id,m.asset_id,m.is_build_invitation) then
  return public.mb_memory_json(m);
 end if;
 update public.memories set title=candidate.title,body=candidate.body,url=candidate.url,color=candidate.color,
 x=candidate.x,y=candidate.y,scene_id=candidate.scene_id,asset_id=candidate.asset_id,is_build_invitation=candidate.is_build_invitation,
 version=version+1,index_status='pending',updated_at=now()
 where id=p_id returning * into m;
 update public.memories set search_document=m.title||E'\n'||m.body||E'\n'||coalesce(m.url,'') where id=m.id;
 delete from public.memory_embeddings where memory_id=m.id;
 update public.index_jobs set status='obsolete',lease_until=null where memory_id=m.id and status in ('pending','processing','failed');
 insert into public.index_jobs(memory_id,source_version) values(m.id,m.version);
 update public.worlds set revision=revision+1 where id=w.id returning revision into w.revision;
 insert into public.world_events(revision,kind,author_name,memory_id,scene_id,description) values(w.revision,'memory',v_profile->>'name',m.id,m.scene_id,'updated a memory');
 return public.mb_memory_json(m);
end $$;

-- CREATE OR REPLACE preserves grants, but keep the boundary explicit.
revoke all on function public.mb_memory_json(public.memories) from public,anon,authenticated;
revoke all on function public.mb_create_memory(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.mb_update_memory(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.mb_memory_json(public.memories) to service_role;
grant execute on function public.mb_create_memory(uuid,jsonb) to service_role;
grant execute on function public.mb_update_memory(uuid,uuid,integer,jsonb) to service_role;
