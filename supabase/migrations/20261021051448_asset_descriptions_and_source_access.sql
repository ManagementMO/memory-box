alter table public.assets add column description text check (char_length(description)<=4000);

create or replace function public.mb_memory_json(m public.memories) returns jsonb
language sql stable set search_path=public,extensions as $$
 select jsonb_build_object(
 'id',m.id,'authorId',m.author_id,'authorName',m.author_name,'type',m.type,
 'title',m.title,'body',m.body,'url',m.url,
 'imageUrl',case when m.type='image' then coalesce(m.seed_image_url,'/api/assets/'||m.asset_id::text) else null end,
 'imageDescription',case when m.type='image' then (select a.description from public.assets a where a.id=m.asset_id and a.status='ready') else null end,
 'color',m.color,'x',m.x,'y',m.y,'sceneId',m.scene_id,'inspiredBy',m.inspired_by,
 'paintOperationId',m.paint_operation_id,'createdAt',m.created_at,'updatedAt',m.updated_at,
 'version',m.version,'indexStatus',m.index_status,'isSeed',m.is_seed)
$$;

-- Keep implementation-only request hashes and processing representations out of
-- the public Data API even though their source text is already published.
revoke select on public.memories from anon,authenticated;
grant select(id,world_id,author_id,author_name,type,title,body,url,color,x,y,scene_id,inspired_by,paint_operation_id,visibility,version,index_status,is_seed,created_at,updated_at) on public.memories to anon,authenticated;

create index paint_operations_world_idx on public.paint_operations(world_id,revision);
create index paint_operations_undo_idx on public.paint_operations(undone_by) where undone_by is not null;
create index assets_owner_idx on public.assets(owner_id);
create index memories_asset_idx on public.memories(asset_id) where asset_id is not null;
create index memories_paint_idx on public.memories(paint_operation_id) where paint_operation_id is not null;
create index reports_actor_idx on public.reports(actor_id);
create index reports_memory_idx on public.reports(memory_id) where memory_id is not null;

-- A removed memory produces a safe ID-only event, without retaining its words.
-- Include that notice in the next consistent snapshot for reconnecting readers.
create or replace function public.mb_snapshot() returns jsonb
language sql stable set search_path=public,extensions as $$
 select jsonb_build_object(
 'worldId',w.id,'revision',w.revision,'epoch',w.public_epoch,'width',w.width,'height',w.height,'gridSize',w.grid_size,'paintingPaused',w.painting_paused,
 'pixels',coalesce((select jsonb_agg(jsonb_build_object('x',c.x,'y',c.y,'color',c.color,'revision',c.updated_revision)) from public.cells c where c.world_id=w.id),'[]'::jsonb),
 'memories',coalesce((select jsonb_agg(public.mb_memory_json(m) order by m.created_at) from public.memories m where m.world_id=w.id and m.visibility='published'),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'authorName',e.author_name,'memoryId',e.memory_id,'operationId',e.operation_id,'sceneId',e.scene_id,'description',e.description,'createdAt',e.created_at,'isSeed',e.is_seed) order by e.revision desc,e.created_at desc) from (select * from public.world_events ev where ev.world_id=w.id and (ev.kind in ('delete','moderation') or ev.memory_id is null or exists(select 1 from public.memories em where em.id=ev.memory_id and em.visibility='published')) order by revision desc,created_at desc limit 50) e),'[]'::jsonb))
 from public.worlds w where w.id='commons'
$$;
