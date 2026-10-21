-- Derived indexing activity retains the source's fictional-seed provenance.
create or replace function public.mb_complete_index_job(p_job_id uuid,p_version integer,p_representation text,p_embedding extensions.vector(1536),p_model text default 'supabase/gte-small:padded1536') returns boolean
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
 insert into public.world_events(revision,kind,author_name,memory_id,scene_id,description,is_seed) values(v_revision,'memory',m.author_name,m.id,m.scene_id,'is ready to discover in search',m.is_seed);
 return true;
end $$;

update public.world_events e set is_seed=true from public.memories m where e.memory_id=m.id and m.is_seed and e.description='is ready to discover in search';
