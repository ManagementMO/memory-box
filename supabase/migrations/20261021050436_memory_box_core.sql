-- Memory Box: server-ordered shared pixels, independently authored originals.
-- Application write RPCs are SECURITY INVOKER and executable by service_role only.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create table public.worlds (
  id text primary key default 'commons',
  width integer not null default 1200 check (width = 1200),
  height integer not null default 720 check (height = 720),
  grid_size integer not null default 6 check (grid_size = 6),
  revision bigint not null default 0,
  public_epoch integer not null default 1,
  painting_paused boolean not null default false
);
insert into public.worlds(id) values ('commons');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  is_operator boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.paint_operations (
  id uuid primary key default gen_random_uuid(),
  world_id text not null references public.worlds(id),
  actor_id uuid references auth.users(id) on delete set null,
  client_id text not null check (char_length(client_id) between 1 and 120),
  request_hash text not null,
  revision bigint not null,
  epoch integer not null,
  scene_id text check (scene_id in ('mixtape','pond','garden')),
  before_cells jsonb not null default '[]',
  after_cells jsonb not null default '[]',
  undone_by uuid references public.paint_operations(id),
  created_at timestamptz not null default now(),
  unique(actor_id,client_id)
);
create table public.cells (
  world_id text not null references public.worlds(id),
  x integer not null check (x between 0 and 199),
  y integer not null check (y between 0 and 119),
  color text not null check (color ~ '^#[0-9A-F]{6}$'),
  operation_id uuid references public.paint_operations(id),
  updated_revision bigint not null,
  primary key (world_id,x,y)
);
create index cells_revision_idx on public.cells(world_id,updated_revision);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  staging_path text not null unique,
  path text unique,
  mime text not null,
  size integer not null check (size between 1 and 5242880),
  width integer,
  height integer,
  status text not null default 'staging' check (status in ('staging','ready','rejected','deleted')),
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  world_id text not null references public.worlds(id) default 'commons',
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  client_id text not null check (char_length(client_id) between 1 and 120),
  request_hash text not null,
  type text not null check (type in ('text','image','link')),
  title text not null default '' check (char_length(title) <= 100),
  body text not null default '' check (char_length(body) <= 2000),
  url text check (url is null or (url ~ '^https?://' and char_length(url) <= 2048)),
  asset_id uuid references public.assets(id),
  seed_image_url text check (seed_image_url is null or seed_image_url ~ '^/seed-[a-z-]+\.svg$'),
  color text not null default '#F0DE8E' check (color ~ '^#[0-9A-F]{6}$'),
  x integer not null check (x between 0 and 1199),
  y integer not null check (y between 0 and 719),
  scene_id text not null check (scene_id in ('mixtape','pond','garden')),
  inspired_by uuid references public.memories(id),
  paint_operation_id uuid references public.paint_operations(id),
  visibility text not null default 'published' check (visibility in ('published','hidden','deleted')),
  version integer not null default 1,
  index_status text not null default 'pending' check (index_status in ('pending','ready','failed')),
  search_document text not null default '',
  fts tsvector generated always as (to_tsvector('english', search_document)) stored,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(author_id,client_id),
  check (not is_seed or author_id is null),
  check (type <> 'text' or char_length(trim(body)) > 0),
  check (type <> 'link' or url is not null),
  check (type <> 'image' or asset_id is not null or seed_image_url is not null)
);
create index memories_fts_idx on public.memories using gin(fts);
create index memories_visible_idx on public.memories(world_id,visibility,created_at desc);
create index memories_inspired_idx on public.memories(inspired_by) where inspired_by is not null;

create table public.memory_embeddings (
  memory_id uuid primary key references public.memories(id) on delete cascade,
  source_version integer not null,
  representation text not null,
  embedding extensions.vector(1536) not null,
  model text not null default 'supabase/gte-small:padded1536',
  created_at timestamptz not null default now()
);
create table public.index_jobs (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  source_version integer not null,
  status text not null default 'pending' check (status in ('pending','processing','complete','failed','obsolete')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(memory_id,source_version)
);
create index index_jobs_ready_idx on public.index_jobs(status,available_at);

create table public.world_events (
  id uuid primary key default gen_random_uuid(),
  world_id text not null references public.worlds(id) default 'commons',
  revision bigint not null,
  kind text not null check (kind in ('paint','memory','build_on','delete','moderation','undo')),
  author_name text not null,
  memory_id uuid references public.memories(id),
  operation_id uuid references public.paint_operations(id),
  scene_id text check (scene_id in ('mixtape','pond','garden')),
  description text not null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now()
);
create index world_events_recent_idx on public.world_events(world_id,revision desc,created_at desc);
create table public.rate_budgets (
  actor_id uuid not null,
  kind text not null,
  bucket bigint not null,
  used integer not null,
  primary key(actor_id,kind,bucket)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  memory_id uuid references public.memories(id),
  bounds jsonb,
  reason text not null check (char_length(reason) between 3 and 500),
  state text not null default 'open' check (state in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check(memory_id is not null or bounds is not null)
);

-- Public reads are deliberately constrained; raw operation diffs, assets, index
-- data, budget counters, and reports are never readable through the browser key.
alter table public.worlds enable row level security;
alter table public.profiles enable row level security;
alter table public.paint_operations enable row level security;
alter table public.cells enable row level security;
alter table public.assets enable row level security;
alter table public.memories enable row level security;
alter table public.memory_embeddings enable row level security;
alter table public.index_jobs enable row level security;
alter table public.world_events enable row level security;
alter table public.rate_budgets enable row level security;
alter table public.reports enable row level security;
grant select on public.worlds,public.cells,public.memories,public.world_events to anon,authenticated;
grant select(id,name) on public.profiles to anon,authenticated;
grant all on public.worlds,public.profiles,public.paint_operations,public.cells,public.assets,public.memories,public.memory_embeddings,public.index_jobs,public.world_events,public.rate_budgets,public.reports to service_role;
create policy public_worlds on public.worlds for select to anon,authenticated using(true);
create policy public_cells on public.cells for select to anon,authenticated using(true);
create policy public_profiles on public.profiles for select to anon,authenticated using(true);
create policy public_memories on public.memories for select to anon,authenticated using(visibility='published');
create policy public_events on public.world_events for select to anon,authenticated using(memory_id is null or exists(select 1 from public.memories m where m.id=memory_id and m.visibility='published'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('memory-staging','memory-staging',false,5242880,array['image/jpeg','image/png','image/webp']),
       ('memory-assets','memory-assets',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

-- Supabase owns realtime.messages and its RLS switch; only add supported policies.
create policy memory_box_receive_notices on realtime.messages for select to authenticated
using ((select realtime.topic())='world:commons' and extension='broadcast');
create policy memory_box_receive_presence on realtime.messages for select to authenticated
using ((select realtime.topic())='world:commons:presence' and extension='presence');
create policy memory_box_send_presence on realtime.messages for insert to authenticated
with check ((select realtime.topic())='world:commons:presence' and extension='presence');

create function public.mb_memory_json(m public.memories) returns jsonb
language sql stable set search_path=public,extensions as $$
 select jsonb_build_object(
 'id',m.id,'authorId',m.author_id,'authorName',m.author_name,'type',m.type,
 'title',m.title,'body',m.body,'url',m.url,
 'imageUrl',case when m.type='image' then coalesce(m.seed_image_url,'/api/assets/'||m.asset_id::text) else null end,
 'color',m.color,'x',m.x,'y',m.y,'sceneId',m.scene_id,'inspiredBy',m.inspired_by,
 'paintOperationId',m.paint_operation_id,'createdAt',m.created_at,'updatedAt',m.updated_at,
 'version',m.version,'indexStatus',m.index_status,'isSeed',m.is_seed)
$$;

create function public.mb_profile(p_actor uuid,p_name text default null) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare r public.profiles;
begin
 if p_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_name is not null and char_length(trim(p_name)) not between 1 and 32 then raise exception 'INVALID_NAME'; end if;
 insert into public.profiles(id,name) values(p_actor,coalesce(trim(p_name),'guest-'||left(p_actor::text,5))) on conflict(id) do nothing;
 if p_name is not null then update public.profiles set name=trim(p_name) where id=p_actor; end if;
 select * into strict r from public.profiles where id=p_actor;
 if r.suspended then raise exception 'ACCOUNT_SUSPENDED' using errcode='42501'; end if;
 return jsonb_build_object('id',r.id,'name',r.name,'isOperator',r.is_operator,'suspended',r.suspended);
end $$;

create function public.mb_consume_budget(p_actor uuid,p_kind text,p_limit integer,p_window_seconds integer,p_cost integer default 1) returns integer
language plpgsql set search_path=public,extensions as $$
declare v_bucket bigint; v_used integer;
begin
 if p_actor is null or p_kind !~ '^[a-z_]{1,40}$' or p_limit not between 1 and 10000000 or p_window_seconds not between 1 and 86400 or p_cost not between 1 and p_limit then raise exception 'INVALID_BUDGET'; end if;
 v_bucket:=floor(extract(epoch from now())/p_window_seconds);
 insert into public.rate_budgets(actor_id,kind,bucket,used) values(p_actor,p_kind,v_bucket,p_cost)
 on conflict(actor_id,kind,bucket) do update set used=rate_budgets.used+excluded.used where rate_budgets.used+excluded.used<=p_limit returning used into v_used;
 if v_used is null then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
 return v_used;
end $$;

create function public.mb_snapshot() returns jsonb
language sql stable set search_path=public,extensions as $$
 select jsonb_build_object(
 'worldId',w.id,'revision',w.revision,'epoch',w.public_epoch,'width',w.width,'height',w.height,'gridSize',w.grid_size,'paintingPaused',w.painting_paused,
 'pixels',coalesce((select jsonb_agg(jsonb_build_object('x',c.x,'y',c.y,'color',c.color,'revision',c.updated_revision)) from public.cells c where c.world_id=w.id),'[]'::jsonb),
 'memories',coalesce((select jsonb_agg(public.mb_memory_json(m) order by m.created_at) from public.memories m where m.world_id=w.id and m.visibility='published'),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'authorName',e.author_name,'memoryId',e.memory_id,'operationId',e.operation_id,'sceneId',e.scene_id,'description',e.description,'createdAt',e.created_at,'isSeed',e.is_seed) order by e.revision desc,e.created_at desc) from (select * from public.world_events ev where ev.world_id=w.id and (ev.memory_id is null or exists(select 1 from public.memories em where em.id=ev.memory_id and em.visibility='published')) order by revision desc,created_at desc limit 50) e),'[]'::jsonb))
 from public.worlds w where w.id='commons'
$$;

create function public.mb_changes(p_after bigint,p_epoch integer) returns jsonb
language sql stable set search_path=public,extensions as $$
 select case when p_epoch<>w.public_epoch or p_after>w.revision then jsonb_build_object('resync',true,'revision',w.revision,'epoch',w.public_epoch)
 else jsonb_build_object('resync',false,'revision',w.revision,'epoch',w.public_epoch,'pixels',coalesce((select jsonb_agg(jsonb_build_object('x',c.x,'y',c.y,'color',c.color,'revision',c.updated_revision)) from public.cells c where c.world_id=w.id and c.updated_revision>p_after),'[]'::jsonb)) end
 from public.worlds w where w.id='commons'
$$;

create function public.mb_emit_notice() returns trigger
language plpgsql set search_path=public,extensions as $$
declare v_epoch integer;
begin
 select public_epoch into v_epoch from public.worlds where id=new.world_id;
 perform realtime.send(jsonb_strip_nulls(jsonb_build_object('revision',new.revision,'epoch',v_epoch,'kind',new.kind,'memoryId',new.memory_id)),'changed','world:'||new.world_id,true);
 return new;
end $$;
create trigger mb_world_notice after insert on public.world_events for each row execute function public.mb_emit_notice();

create function public.mb_apply_paint(p_actor uuid,p_client_id text,p_cells jsonb,p_scene_id text default null) returns jsonb
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
 if exists(select 1 from jsonb_array_elements(p_cells) c where jsonb_typeof(c->'x')<>'number' or jsonb_typeof(c->'y')<>'number' or (c->>'x')::numeric<>trunc((c->>'x')::numeric) or (c->>'y')::numeric<>trunc((c->>'y')::numeric) or (c->>'x')::integer not between 0 and 199 or (c->>'y')::integer not between 0 and 119 or c->>'color' !~ '^#[0-9a-fA-F]{6}$' or not(c ? 'x' and c ? 'y' and c ? 'color')) then raise exception 'INVALID_CELL'; end if;
 v_count:=jsonb_array_length(p_cells);
 if (select count(distinct (c->>'x',c->>'y')) from jsonb_array_elements(p_cells) c)<>v_count then raise exception 'DUPLICATE_CELLS'; end if;
 perform public.mb_consume_budget(p_actor,'paint_operations',60,60,1);
 perform public.mb_consume_budget(p_actor,'paint_cells',5000,60,v_count);
 select jsonb_agg(jsonb_build_object('x',(c->>'x')::integer,'y',(c->>'y')::integer,'color',coalesce(old.color,'#E8EEEA'),'operationId',old.operation_id)) into v_before from jsonb_array_elements(p_cells) c left join public.cells old on old.world_id=w.id and old.x=(c->>'x')::integer and old.y=(c->>'y')::integer;
 w.revision:=w.revision+1;
 insert into public.paint_operations(id,world_id,actor_id,client_id,request_hash,revision,epoch,scene_id,before_cells,after_cells) values(v_id,w.id,p_actor,p_client_id,v_hash,w.revision,w.public_epoch,p_scene_id,v_before,p_cells);
 insert into public.cells(world_id,x,y,color,operation_id,updated_revision)
 select w.id,(c->>'x')::integer,(c->>'y')::integer,upper(c->>'color'),v_id,w.revision from jsonb_array_elements(p_cells)c
 on conflict(world_id,x,y) do update set color=excluded.color,operation_id=excluded.operation_id,updated_revision=excluded.updated_revision;
 update public.worlds set revision=w.revision where id=w.id;
 insert into public.world_events(revision,kind,author_name,operation_id,scene_id,description) values(w.revision,'paint',v_name,v_id,p_scene_id,'painted '||v_count||' shared pixels');
 return jsonb_build_object('operationId',v_id,'revision',w.revision,'epoch',w.public_epoch,'pixels',p_cells);
end $$;

create function public.mb_undo_paint(p_actor uuid,p_operation_id uuid) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; op public.paint_operations; v_id uuid:=gen_random_uuid(); v_name text; v_restored integer; v_total integer; v_after jsonb;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_name:=public.mb_profile(p_actor)->>'name';
 if w.painting_paused then raise exception 'PAINTING_PAUSED' using errcode='42501'; end if;
 select * into op from public.paint_operations where id=p_operation_id;
 if not found or op.actor_id is distinct from p_actor then raise exception 'NOT_OWNER' using errcode='42501'; end if;
 if op.epoch<>w.public_epoch then raise exception 'UNDO_UNAVAILABLE'; end if;
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

create function public.mb_create_memory(p_actor uuid,p_input jsonb) returns jsonb
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
 if v_asset is not null and not exists(select 1 from public.assets where id=v_asset and owner_id=p_actor and status='ready') then raise exception 'ASSET_UNAVAILABLE' using errcode='42501'; end if;
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

create function public.mb_update_memory(p_actor uuid,p_id uuid,p_version integer,p_patch jsonb) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare w public.worlds; m public.memories; v_profile jsonb; v_asset uuid;
begin
 select * into strict w from public.worlds where id='commons' for update;
 v_profile:=public.mb_profile(p_actor);
 select * into m from public.memories where id=p_id for update;
 if not found or (m.author_id is distinct from p_actor and not (v_profile->>'isOperator')::boolean) then raise exception 'NOT_OWNER' using errcode='42501'; end if;
 if m.visibility<>'published' then raise exception 'SOURCE_UNAVAILABLE'; end if;
 if m.version<>p_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
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

create function public.mb_delete_memory(p_actor uuid,p_id uuid) returns jsonb
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
 if m.asset_id is not null then update public.assets set status='deleted' where id=m.asset_id; end if;
 update public.worlds set revision=revision+1 where id=w.id returning revision into w.revision;
 insert into public.world_events(revision,kind,author_name,memory_id,scene_id,description) values(w.revision,'delete',v_profile->>'name',m.id,m.scene_id,'removed a memory');
 return jsonb_build_object('assetId',m.asset_id);
end $$;

create function public.mb_search(p_query text,p_embedding extensions.vector(1536) default null,p_scene_id text default null,p_limit integer default 12,p_model text default 'supabase/gte-small:padded1536') returns jsonb
language sql stable set search_path=public,extensions as $$
 with eligible as materialized (
  select m.* from public.memories m where m.visibility='published' and (p_scene_id is null or m.scene_id=p_scene_id)
 ), lexical as (
  select id,row_number() over(order by ts_rank_cd(fts,websearch_to_tsquery('english',p_query)) desc,created_at desc) as rank_ix
  from eligible where fts @@ websearch_to_tsquery('english',p_query) order by rank_ix limit 24
 ), semantic as (
  select m.id,row_number() over(order by e.embedding <=> p_embedding) as rank_ix
  from eligible m join public.memory_embeddings e on e.memory_id=m.id and e.source_version=m.version
  where p_embedding is not null and e.model=p_model and e.embedding <=> p_embedding < 0.80 order by e.embedding <=> p_embedding limit 24
 ), combined as (
  select coalesce(l.id,s.id) id,
  coalesce(1.0/(50+l.rank_ix),0)+coalesce(1.0/(50+s.rank_ix),0) score,
  case when l.id is not null and s.id is not null then 'both' when l.id is not null then 'keyword' else 'semantic' end match
  from lexical l full join semantic s on l.id=s.id
 ), ranked as (
  select public.mb_memory_json(m) as memory,c.score,c.match from combined c join eligible m on m.id=c.id order by c.score desc,m.created_at desc limit least(greatest(p_limit,1),20)
 )
 select jsonb_build_object('mode',case when p_embedding is null then 'keyword' else 'hybrid' end,'results',coalesce(jsonb_agg(jsonb_build_object('memory',r.memory,'score',r.score,'match',r.match)),'[]'::jsonb)) from ranked r
$$;

create function public.mb_lease_index_jobs(p_limit integer default 5) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare result jsonb;
begin
 update public.index_jobs j set status='obsolete',lease_until=null where j.status in ('pending','processing','failed') and not exists(select 1 from public.memories m where m.id=j.memory_id and m.version=j.source_version and m.visibility='published');
 with candidates as (
  select id from public.index_jobs where ((status in ('pending','failed') and available_at<=now()) or (status='processing' and lease_until<now())) and attempts<4 order by available_at,created_at for update skip locked limit least(greatest(p_limit,1),10)
 ), leased as (
  update public.index_jobs j set status='processing',attempts=attempts+1,lease_until=now()+interval '120 seconds' from candidates c where j.id=c.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'memory_id',j.memory_id,'source_version',j.source_version,'attempts',j.attempts,'memory',public.mb_memory_json(m))),'[]'::jsonb) into result from leased j join public.memories m on m.id=j.memory_id and m.version=j.source_version and m.visibility='published';
 return result;
end $$;

create function public.mb_complete_index_job(p_job_id uuid,p_version integer,p_representation text,p_embedding extensions.vector(1536),p_model text default 'supabase/gte-small:padded1536') returns boolean
language plpgsql set search_path=public,extensions as $$
declare j public.index_jobs; m public.memories; v_revision bigint;
begin
 perform 1 from public.worlds where id='commons' for update;
 select * into j from public.index_jobs where id=p_job_id for update;
 if not found then return false; end if;
 select * into m from public.memories where id=j.memory_id for update;
 if not found or m.visibility<>'published' or m.version<>p_version or j.source_version<>p_version or j.status<>'processing' then update public.index_jobs set status='obsolete',lease_until=null where id=j.id;return false;end if;
 if char_length(p_representation) not between 1 and 12000 or p_embedding is null then raise exception 'INVALID_REPRESENTATION'; end if;
 insert into public.memory_embeddings(memory_id,source_version,representation,embedding,model) values(m.id,p_version,p_representation,p_embedding,p_model) on conflict(memory_id) do update set source_version=excluded.source_version,representation=excluded.representation,embedding=excluded.embedding,model=excluded.model,created_at=now();
 update public.memories set index_status='ready',search_document=title||E'\n'||body||E'\n'||p_representation where id=m.id;
 update public.index_jobs set status='complete',lease_until=null,last_error=null where id=j.id;
 update public.worlds set revision=revision+1 where id='commons' returning revision into v_revision;
 insert into public.world_events(revision,kind,author_name,memory_id,scene_id,description) values(v_revision,'memory',m.author_name,m.id,m.scene_id,'is ready to discover in search');
 return true;
end $$;

create function public.mb_fail_index_job(p_job_id uuid,p_reason text) returns void
language plpgsql set search_path=public,extensions as $$
declare j public.index_jobs;
begin
 update public.index_jobs set status='failed',lease_until=null,last_error=left(p_reason,120),available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)) where id=p_job_id and status='processing' returning * into j;
 if found then update public.memories set index_status='failed' where id=j.memory_id and version=j.source_version and visibility='published';end if;
end $$;

create function public.mb_report(p_actor uuid,p_input jsonb) returns uuid
language plpgsql set search_path=public,extensions as $$
declare v_id uuid;
begin
 perform public.mb_profile(p_actor);perform public.mb_consume_budget(p_actor,'reports',5,60,1);
 insert into public.reports(actor_id,memory_id,bounds,reason) values(p_actor,nullif(p_input->>'memoryId','')::uuid,p_input->'bounds',trim(p_input->>'reason')) returning id into v_id;return v_id;
end $$;

create function public.mb_create_asset(p_actor uuid,p_name text,p_mime text,p_size integer) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare a public.assets; v_id uuid:=gen_random_uuid();
begin
 perform public.mb_profile(p_actor);perform public.mb_consume_budget(p_actor,'image_uploads',12,60,1);
 if char_length(p_name) not between 1 and 180 or p_mime not in ('image/png','image/jpeg','image/webp') then raise exception 'INVALID_ASSET';end if;
 insert into public.assets(id,owner_id,name,staging_path,mime,size) values(v_id,p_actor,p_name,p_actor::text||'/'||v_id::text||'.upload',p_mime,p_size) returning * into a;
 return to_jsonb(a);
end $$;

create function public.mb_ready_asset(p_actor uuid,p_id uuid,p_metadata jsonb) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare a public.assets;
begin
 perform public.mb_profile(p_actor);
 select * into a from public.assets where id=p_id for update;
 if not found or a.owner_id is distinct from p_actor then raise exception 'NOT_OWNER' using errcode='42501';end if;
 if a.status='ready' then return to_jsonb(a);end if;
 if a.status<>'staging' then raise exception 'ASSET_UNAVAILABLE';end if;
 if p_metadata->>'mime' not in ('image/png','image/jpeg','image/webp') or (p_metadata->>'width')::integer not between 1 and 4096 or (p_metadata->>'height')::integer not between 1 and 4096 or (p_metadata->>'path') not like p_actor::text||'/%' then raise exception 'INVALID_ASSET';end if;
 update public.assets set status='ready',path=p_metadata->>'path',mime=p_metadata->>'mime',size=(p_metadata->>'size')::integer,width=(p_metadata->>'width')::integer,height=(p_metadata->>'height')::integer where id=a.id returning * into a;
 return to_jsonb(a);
end $$;

create function public.mb_readable_asset(p_id uuid,p_viewer uuid default null) returns jsonb
language sql stable set search_path=public,extensions as $$
 select to_jsonb(a) from public.assets a where a.id=p_id and a.status='ready' and (a.owner_id=p_viewer or exists(select 1 from public.memories m where m.asset_id=a.id and m.visibility='published'))
$$;

create function public.mb_moderate(p_actor uuid,p_action text,p_memory_id uuid default null,p_bounds jsonb default null,p_target_actor uuid default null) returns jsonb
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
  if p_bounds is null or (p_bounds->>'x')::integer not between 0 and 199 or (p_bounds->>'y')::integer not between 0 and 119 or (p_bounds->>'width')::integer not between 1 and 200 or (p_bounds->>'height')::integer not between 1 and 120 then raise exception 'INVALID_BOUNDS';end if;
  update public.worlds set public_epoch=public_epoch+1 where id=w.id;
  update public.cells set color='#E8EEEA',operation_id=null,updated_revision=w.revision+1 where world_id=w.id and x>=(p_bounds->>'x')::integer and x<(p_bounds->>'x')::integer+(p_bounds->>'width')::integer and y>=(p_bounds->>'y')::integer and y<(p_bounds->>'y')::integer+(p_bounds->>'height')::integer;
 else raise exception 'INVALID_MODERATION_ACTION';end if;
 update public.worlds set revision=revision+1 where id=w.id returning * into w;
 insert into public.world_events(revision,kind,author_name,memory_id,description) values(w.revision,'moderation',profile->>'name',p_memory_id,p_action||' by the keeper');
 return jsonb_build_object('revision',w.revision,'epoch',w.public_epoch);
end $$;

-- Read-safe events retain removal notices without retaining removed source bodies.
drop policy public_events on public.world_events;
create policy public_events on public.world_events for select to anon,authenticated using(kind in ('delete','moderation') or memory_id is null or exists(select 1 from public.memories m where m.id=memory_id and m.visibility='published'));

-- Postgres grants new functions to PUBLIC by default. Do not leave an API route
-- around the application's verified-actor, quota, or source-version checks.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'mb\_%' escape '\' loop
  execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
  execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $$;
