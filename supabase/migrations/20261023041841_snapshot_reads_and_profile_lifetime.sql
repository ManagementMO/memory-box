-- Keep an existing profile alive for its dependent RPC. Auth revocation may
-- otherwise cascade-delete it between requireActor and mb_paint_turn. This
-- remains an invoker function; no access to auth.users or new grants is needed.
create or replace function public.mb_profile(p_actor uuid,p_name text default null) returns jsonb
language plpgsql security invoker set search_path=public,extensions as $$
declare r public.profiles; v_constraint text;
begin
 if p_actor is null then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
 if p_name is not null and char_length(trim(p_name)) not between 1 and 32 then raise exception 'INVALID_NAME';end if;
 select * into r from public.profiles where id=p_actor for key share;
 if not found then
  begin
   insert into public.profiles(id,name) values(p_actor,coalesce(trim(p_name),'guest-'||left(p_actor::text,5))) on conflict(id) do nothing;
  exception when foreign_key_violation then
   get stacked diagnostics v_constraint=constraint_name;
   if v_constraint='profiles_id_fkey' then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
   raise;
  end;
  select * into r from public.profiles where id=p_actor for key share;
  if not found then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
 end if;
 if p_name is not null then update public.profiles set name=trim(p_name) where id=p_actor returning * into r;end if;
 if r.suspended then raise exception 'ACCOUNT_SUSPENDED' using errcode='42501';end if;
 return jsonb_build_object('id',r.id,'name',r.name,'isOperator',r.is_operator,'suspended',r.suspended);
end $$;

-- Fresh public metadata is inexpensive compared with serializing every pixel.
-- Include originals/events on every read so same-revision index failure or
-- author-lifecycle metadata cannot be hidden by the pixel cache.
create function public.mb_snapshot_head() returns jsonb
language sql stable security invoker set search_path=public,extensions as $$
 select jsonb_build_object(
 'worldId',w.id,'revision',w.revision,'epoch',w.public_epoch,'width',w.width,'height',w.height,'gridSize',w.grid_size,'paintingPaused',w.painting_paused,
 'memories',coalesce((select jsonb_agg(public.mb_memory_json(m) order by m.created_at) from public.memories m where m.world_id=w.id and m.visibility='published'),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'authorName',e.author_name,'memoryId',e.memory_id,'operationId',e.operation_id,'sceneId',e.scene_id,'description',e.description,'createdAt',e.created_at,'isSeed',e.is_seed) order by e.revision desc,e.created_at desc) from (select * from public.world_events ev where ev.world_id=w.id and (ev.kind in ('delete','moderation') or ev.memory_id is null or exists(select 1 from public.memories em where em.id=ev.memory_id and em.visibility='published')) order by revision desc,created_at desc limit 50) e),'[]'::jsonb))
 from public.worlds w where w.id='commons'
$$;
revoke all on function public.mb_snapshot_head() from public,anon,authenticated;
grant execute on function public.mb_snapshot_head() to service_role;

-- Preserve the existing full-snapshot wire contract and one SQL read point.
create or replace function public.mb_snapshot() returns jsonb
language sql stable security invoker set search_path=public,extensions as $$
 select public.mb_snapshot_head()||jsonb_build_object('pixels',coalesce(
  (select jsonb_agg(jsonb_build_object('x',c.x,'y',c.y,'color',c.color,'revision',c.updated_revision)) from public.cells c where c.world_id='commons'),'[]'::jsonb))
$$;
