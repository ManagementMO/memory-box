-- A small community gets one shared-paint turn every 15 seconds. Drawing a
-- preview, writing an original and the presence channel remain unrestricted by
-- this cadence. The existing world lock serializes both timing and cell writes.
create index paint_operations_actor_forward_time_idx
 on public.paint_operations(actor_id,created_at desc)
 where actor_id is not null and client_id not like 'undo:%';

create function public.mb_paint_turn(p_actor uuid) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare v_now timestamptz:=clock_timestamp(); v_next timestamptz;
begin
 perform public.mb_profile(p_actor);
 select created_at+interval '15 seconds' into v_next
 from public.paint_operations
 where actor_id=p_actor and world_id='commons' and client_id not like 'undo:%'
 order by created_at desc limit 1;
 return jsonb_build_object('serverTime',v_now,'nextPaintAt',coalesce(v_next,v_now),'cooldownSeconds',15);
end $$;
revoke all on function public.mb_paint_turn(uuid) from public,anon,authenticated;
grant execute on function public.mb_paint_turn(uuid) to service_role;

create or replace function public.mb_apply_paint(p_actor uuid,p_client_id text,p_cells jsonb,p_scene_id text default null) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; prior public.paint_operations; v_id uuid:=gen_random_uuid();
 v_before jsonb; v_hash text; v_name text; v_count integer; v_turn jsonb;
 v_now timestamptz; v_next timestamptz;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_hash:=encode(digest(jsonb_build_object('cells',p_cells,'sceneId',p_scene_id)::text,'sha256'),'hex');
 select * into prior from public.paint_operations where actor_id=p_actor and client_id=p_client_id;
 if found then
  if prior.request_hash<>v_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
  -- A lost acceptance can always be recovered without spending another turn.
  return jsonb_build_object('status','accepted','operationId',prior.id,'revision',prior.revision,'epoch',prior.epoch,'pixels',prior.after_cells)||public.mb_paint_turn(p_actor);
 end if;
 v_name:=public.mb_profile(p_actor)->>'name';
 if w.painting_paused then raise exception 'PAINTING_PAUSED' using errcode='42501'; end if;
 if p_client_id is null or char_length(p_client_id) not between 1 and 120 or p_client_id like 'undo:%' then raise exception 'INVALID_PAINT'; end if;
 if p_cells is null or jsonb_typeof(p_cells)<>'array' then raise exception 'INVALID_PAINT'; end if;
 if jsonb_array_length(p_cells) not between 1 and 144 then raise exception 'INVALID_PAINT'; end if;
 if p_scene_id is not null and p_scene_id not in ('mixtape','pond','garden') then raise exception 'INVALID_SCENE'; end if;
 if exists(select 1 from jsonb_array_elements(p_cells) c where case
  when jsonb_typeof(c) is distinct from 'object' then true
  when jsonb_typeof(c->'x') is distinct from 'number' or jsonb_typeof(c->'y') is distinct from 'number' or jsonb_typeof(c->'color') is distinct from 'string' then true
  else (c->>'x')::numeric<>trunc((c->>'x')::numeric) or (c->>'y')::numeric<>trunc((c->>'y')::numeric)
   or (c->>'x')::numeric not between -10000 and 9999 or (c->>'y')::numeric not between -10000 and 9999
   or c->>'color' !~ '^#[0-9a-fA-F]{6}$' end) then raise exception 'INVALID_CELL'; end if;
 v_count:=jsonb_array_length(p_cells);
 if (select count(distinct ((c->>'x')::numeric,(c->>'y')::numeric)) from jsonb_array_elements(p_cells) c)<>v_count then raise exception 'DUPLICATE_CELLS'; end if;
 -- Validate before checking timing. clock_timestamp is taken after the world
 -- lock, so a queued request cannot commit using an earlier transaction start.
 v_turn:=public.mb_paint_turn(p_actor);
 v_now:=(v_turn->>'serverTime')::timestamptz;
 v_next:=(v_turn->>'nextPaintAt')::timestamptz;
 if v_next>v_now then
  return v_turn||jsonb_build_object('status','cooldown','retryAfterMs',ceil(extract(epoch from v_next-v_now)*1000)::integer);
 end if;
 perform public.mb_consume_budget(p_actor,'paint_operations',60,60,1);
 perform public.mb_consume_budget(p_actor,'paint_cells',5000,60,v_count);
 select jsonb_agg(jsonb_build_object('x',(c->>'x')::numeric::integer,'y',(c->>'y')::numeric::integer,'color',coalesce(old.color,'#FFFFFF'),'operationId',old.operation_id)) into v_before from jsonb_array_elements(p_cells) c left join public.cells old on old.world_id=w.id and old.x=(c->>'x')::numeric::integer and old.y=(c->>'y')::numeric::integer;
 w.revision:=w.revision+1;
 insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch,scene_id,before_cells,after_cells,created_at)
 values(v_id,w.id,p_actor,p_client_id,v_hash,w.revision,w.public_epoch,p_scene_id,v_before,p_cells,v_now);
 insert into public.cells(world_id,x,y,color,operation_id,updated_revision)
 select w.id,(c->>'x')::numeric::integer,(c->>'y')::numeric::integer,upper(c->>'color'),v_id,w.revision from jsonb_array_elements(p_cells)c
 on conflict(world_id,x,y) do update set color=excluded.color,operation_id=excluded.operation_id,updated_revision=excluded.updated_revision;
 update public.worlds set revision=w.revision where id=w.id;
 insert into public.world_events(revision,kind,author_name,operation_id,scene_id,description)
 values(w.revision,'paint',v_name,v_id,p_scene_id,'painted '||v_count||' shared pixels');
 return jsonb_build_object('status','accepted','operationId',v_id,'revision',w.revision,'epoch',w.public_epoch,'pixels',p_cells,'serverTime',v_now,'nextPaintAt',v_now+interval '15 seconds','cooldownSeconds',15);
end $$;

-- Undo is an immediate, one-way correction of a forward paint. It neither
-- refunds nor resets the forward turn. An undo receipt cannot become a free
-- redo chain, and later edits keep the existing operation-owner protection.
create or replace function public.mb_undo_paint(p_actor uuid,p_operation_id uuid) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; op public.paint_operations; v_id uuid:=gen_random_uuid(); v_name text; v_restored integer; v_total integer; v_after jsonb;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_name:=public.mb_profile(p_actor)->>'name';
 if w.painting_paused then raise exception 'PAINTING_PAUSED' using errcode='42501'; end if;
 select * into op from public.paint_operations where id=p_operation_id;
 if not found or op.actor_id is distinct from p_actor then raise exception 'NOT_OWNER' using errcode='42501'; end if;
 if op.epoch<>w.public_epoch or op.client_id like 'undo:%' then raise exception 'UNDO_UNAVAILABLE'; end if;
 if op.undone_by is not null then return jsonb_build_object('operationId',op.undone_by,'revision',w.revision,'restored',0,'skipped',jsonb_array_length(op.after_cells)); end if;
 perform public.mb_consume_budget(p_actor,'paint_operations',60,60,1);
 v_total:=jsonb_array_length(op.after_cells);
 select coalesce(jsonb_agg(jsonb_build_object('x',(b->>'x')::integer,'y',(b->>'y')::integer,'color',b->>'color','operationId',b->>'operationId')),'[]'::jsonb) into v_after from jsonb_array_elements(op.before_cells)b join public.cells c on c.world_id=w.id and c.x=(b->>'x')::integer and c.y=(b->>'y')::integer and c.operation_id=op.id;
 v_restored:=jsonb_array_length(v_after);w.revision:=w.revision+1;
 insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch,scene_id,before_cells,after_cells) values(v_id,w.id,p_actor,'undo:'||op.id,op.id::text,w.revision,w.public_epoch,op.scene_id,op.after_cells,v_after);
 update public.cells c set color=b->>'color',operation_id=nullif(b->>'operationId','')::uuid,updated_revision=w.revision from jsonb_array_elements(v_after)b where c.world_id=w.id and c.x=(b->>'x')::integer and c.y=(b->>'y')::integer and c.operation_id=op.id;
 update public.paint_operations set undone_by=v_id where id=op.id;
 update public.worlds set revision=w.revision where id=w.id;
 insert into public.world_events(revision,kind,author_name,operation_id,scene_id,description) values(w.revision,'undo',v_name,v_id,op.scene_id,'restored '||v_restored||' pixels; preserved '||(v_total-v_restored)||' later edits');
 return jsonb_build_object('operationId',v_id,'revision',w.revision,'restored',v_restored,'skipped',v_total-v_restored);
end $$;
