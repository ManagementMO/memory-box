-- Expand only accepted coordinates. Existing source text, pixels, authorship,
-- operation diffs, revision ordering, budgets, and entry framing stay intact.
-- Sparse integer cell rows remain the storage unit; no plane-sized bitmap exists.
alter table public.cells drop constraint cells_x_check;
alter table public.cells drop constraint cells_y_check;
alter table public.cells add constraint cells_x_check check (x between -10000 and 9999);
alter table public.cells add constraint cells_y_check check (y between -10000 and 9999);
alter table public.memories drop constraint memories_x_check;
alter table public.memories drop constraint memories_y_check;
alter table public.memories add constraint memories_x_check check (x between -60000 and 59999);
alter table public.memories add constraint memories_y_check check (y between -60000 and 59999);

-- One clear/report remains bounded even though its origin may be anywhere in
-- the pilot plane. Validate numeric JSON types before casting or arithmetic.
create function public.mb_valid_cell_bounds(p_bounds jsonb) returns boolean
language sql immutable set search_path=public,extensions as $$
 select case
  when jsonb_typeof(p_bounds) is distinct from 'object' then false
  when jsonb_typeof(p_bounds->'x') is distinct from 'number'
    or jsonb_typeof(p_bounds->'y') is distinct from 'number'
    or jsonb_typeof(p_bounds->'width') is distinct from 'number'
    or jsonb_typeof(p_bounds->'height') is distinct from 'number' then false
  else (p_bounds->>'x')::numeric=trunc((p_bounds->>'x')::numeric)
   and (p_bounds->>'y')::numeric=trunc((p_bounds->>'y')::numeric)
   and (p_bounds->>'width')::numeric=trunc((p_bounds->>'width')::numeric)
   and (p_bounds->>'height')::numeric=trunc((p_bounds->>'height')::numeric)
   and (p_bounds->>'x')::numeric between -10000 and 9999
   and (p_bounds->>'y')::numeric between -10000 and 9999
   and (p_bounds->>'width')::numeric between 1 and 200
   and (p_bounds->>'height')::numeric between 1 and 120
   and (p_bounds->>'x')::numeric+(p_bounds->>'width')::numeric<=10000
   and (p_bounds->>'y')::numeric+(p_bounds->>'height')::numeric<=10000
 end
$$;
revoke all on function public.mb_valid_cell_bounds(jsonb) from public,anon,authenticated;
grant execute on function public.mb_valid_cell_bounds(jsonb) to service_role;

create or replace function public.mb_apply_paint(p_actor uuid,p_client_id text,p_cells jsonb,p_scene_id text default null) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; prior public.paint_operations; v_id uuid:=gen_random_uuid(); v_before jsonb; v_hash text; v_name text; v_count integer;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_hash:=encode(digest(jsonb_build_object('cells',p_cells,'sceneId',p_scene_id)::text,'sha256'),'hex');
 select * into prior from public.paint_operations where actor_id=p_actor and client_id=p_client_id;
 if found then
  if prior.request_hash<>v_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
  return jsonb_build_object('operationId',prior.id,'revision',prior.revision,'epoch',prior.epoch,'pixels',prior.after_cells);
 end if;
 v_name:=public.mb_profile(p_actor)->>'name';
 if w.painting_paused then raise exception 'PAINTING_PAUSED' using errcode='42501'; end if;
 if p_client_id is null or char_length(p_client_id) not between 1 and 120 or p_cells is null or jsonb_typeof(p_cells)<>'array' or jsonb_array_length(p_cells) not between 1 and 256 then raise exception 'INVALID_PAINT'; end if;
 if p_scene_id is not null and p_scene_id not in ('mixtape','pond','garden') then raise exception 'INVALID_SCENE'; end if;
 if exists(select 1 from jsonb_array_elements(p_cells) c where case
  when jsonb_typeof(c) is distinct from 'object' then true
  when jsonb_typeof(c->'x') is distinct from 'number' or jsonb_typeof(c->'y') is distinct from 'number' or jsonb_typeof(c->'color') is distinct from 'string' then true
  else (c->>'x')::numeric<>trunc((c->>'x')::numeric) or (c->>'y')::numeric<>trunc((c->>'y')::numeric)
   or (c->>'x')::numeric not between -10000 and 9999 or (c->>'y')::numeric not between -10000 and 9999
   or c->>'color' !~ '^#[0-9a-fA-F]{6}$' end) then raise exception 'INVALID_CELL'; end if;
 v_count:=jsonb_array_length(p_cells);
 if (select count(distinct ((c->>'x')::numeric,(c->>'y')::numeric)) from jsonb_array_elements(p_cells) c)<>v_count then raise exception 'DUPLICATE_CELLS'; end if;
 perform public.mb_consume_budget(p_actor,'paint_operations',60,60,1);
 perform public.mb_consume_budget(p_actor,'paint_cells',5000,60,v_count);
 select jsonb_agg(jsonb_build_object('x',(c->>'x')::numeric::integer,'y',(c->>'y')::numeric::integer,'color',coalesce(old.color,'#FFFFFF'),'operationId',old.operation_id)) into v_before from jsonb_array_elements(p_cells) c left join public.cells old on old.world_id=w.id and old.x=(c->>'x')::numeric::integer and old.y=(c->>'y')::numeric::integer;
 w.revision:=w.revision+1;
 insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch,scene_id,before_cells,after_cells) values(v_id,w.id,p_actor,p_client_id,v_hash,w.revision,w.public_epoch,p_scene_id,v_before,p_cells);
 insert into public.cells(world_id,x,y,color,operation_id,updated_revision)
 select w.id,(c->>'x')::numeric::integer,(c->>'y')::numeric::integer,upper(c->>'color'),v_id,w.revision from jsonb_array_elements(p_cells)c
 on conflict(world_id,x,y) do update set color=excluded.color,operation_id=excluded.operation_id,updated_revision=excluded.updated_revision;
 update public.worlds set revision=w.revision where id=w.id;
 insert into public.world_events(revision,kind,author_name,operation_id,scene_id,description) values(w.revision,'paint',v_name,v_id,p_scene_id,'painted '||v_count||' shared pixels');
 return jsonb_build_object('operationId',v_id,'revision',w.revision,'epoch',w.public_epoch,'pixels',p_cells);
end $$;

create or replace function public.mb_report(p_actor uuid,p_input jsonb) returns uuid
language plpgsql set search_path=public,extensions as $$
declare v_id uuid;
begin
 perform public.mb_profile(p_actor);
 if p_input?'bounds' and not public.mb_valid_cell_bounds(p_input->'bounds') then raise exception 'INVALID_BOUNDS'; end if;
 perform public.mb_consume_budget(p_actor,'reports',5,60,1);
 insert into public.reports(actor_id,memory_id,bounds,reason) values(p_actor,nullif(p_input->>'memoryId','')::uuid,p_input->'bounds',trim(p_input->>'reason')) returning id into v_id;
 return v_id;
end $$;

create or replace function public.mb_moderate(p_actor uuid,p_action text,p_memory_id uuid default null,p_bounds jsonb default null,p_target_actor uuid default null) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; profile jsonb; m public.memories;
begin
 profile:=public.mb_profile(p_actor);if not(profile->>'isOperator')::boolean then raise exception 'OPERATOR_REQUIRED' using errcode='42501';end if;
 select * into strict w from public.worlds where id='commons' for update;
 if p_action in ('hide','restore') then
  update public.memories set visibility=case when p_action='hide' then 'hidden' else 'published' end,index_status='pending',version=version+1,updated_at=now() where id=p_memory_id and visibility<>'deleted' returning * into m;
  if not found then raise exception 'SOURCE_UNAVAILABLE';end if;
  delete from public.memory_embeddings where memory_id=m.id;
  update public.index_jobs set status='obsolete',lease_until=null where memory_id=m.id;
  if p_action='restore' then insert into public.index_jobs(memory_id,source_version) values(m.id,m.version);end if;
 elsif p_action in ('pause','resume') then update public.worlds set painting_paused=(p_action='pause') where id=w.id;
 elsif p_action in ('suspend','unsuspend') then update public.profiles set suspended=(p_action='suspend') where id=p_target_actor;
 elsif p_action='clear' then
  if not public.mb_valid_cell_bounds(p_bounds) then raise exception 'INVALID_BOUNDS';end if;
  update public.worlds set public_epoch=public_epoch+1 where id=w.id;
  update public.cells set color='#FFFFFF',operation_id=null,updated_revision=w.revision+1 where world_id=w.id and x>=(p_bounds->>'x')::numeric::integer and x<(p_bounds->>'x')::numeric::integer+(p_bounds->>'width')::numeric::integer and y>=(p_bounds->>'y')::numeric::integer and y<(p_bounds->>'y')::numeric::integer+(p_bounds->>'height')::numeric::integer;
 else raise exception 'INVALID_MODERATION_ACTION';end if;
 update public.worlds set revision=revision+1 where id=w.id returning * into w;
 insert into public.world_events(revision,kind,author_name,memory_id,description) values(w.revision,'moderation',profile->>'name',p_memory_id,p_action||' by the keeper');
 return jsonb_build_object('revision',w.revision,'epoch',w.public_epoch);
end $$;
