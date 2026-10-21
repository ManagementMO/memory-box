-- Provisional cosine >= 0.80 relevance gate for the uniform GTE-small namespace.
-- Calibrated on the initial ten seed memories; this is a small pilot, not a universal threshold.
create or replace function public.mb_search(p_query text,p_embedding extensions.vector(1536) default null,p_scene_id text default null,p_limit integer default 12,p_model text default 'supabase/gte-small:padded1536') returns jsonb
language sql stable set search_path=public,extensions as $$
 with eligible as materialized (
  select m.* from public.memories m where m.visibility='published' and (p_scene_id is null or m.scene_id=p_scene_id)
 ), lexical as (
  select id,row_number() over(order by ts_rank_cd(fts,websearch_to_tsquery('english',p_query)) desc,created_at desc) as rank_ix
  from eligible where fts @@ websearch_to_tsquery('english',p_query) order by rank_ix limit 24
 ), semantic as (
  select m.id,row_number() over(order by e.embedding <=> p_embedding) as rank_ix
  from eligible m join public.memory_embeddings e on e.memory_id=m.id and e.source_version=m.version
  where p_embedding is not null and e.model=p_model and e.embedding <=> p_embedding <= 0.20 order by e.embedding <=> p_embedding limit 24
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
