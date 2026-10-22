-- A successful sanitized publication must not retain its raw staging original
-- forever after a transient Storage failure. This lease cleans only staging;
-- canonical assets and their published/hidden memory references are untouched.
alter table public.assets add column staging_cleanup_claimed_at timestamptz;
alter table public.assets add column staging_cleanup_token uuid;
alter table public.assets add column staging_cleanup_completed_at timestamptz;
create index assets_ready_staging_cleanup_idx on public.assets(created_at)
 where status='ready' and staging_cleanup_completed_at is null;

create function public.mb_claim_ready_staging_cleanup(p_limit integer default 25,p_asset_ids uuid[] default null) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare a public.assets;v_token uuid;result jsonb:='[]'::jsonb;
begin
 for a in
  select candidate.* from public.assets candidate
  where candidate.status='ready' and candidate.path is not null
  -- Supabase signed upload URLs expire after two hours. Wait an extra hour so
  -- a still-valid token cannot recreate raw bytes after this final sweep.
  and candidate.created_at<now()-interval '3 hours'
  and candidate.staging_cleanup_completed_at is null
  and (candidate.staging_cleanup_claimed_at is null or candidate.staging_cleanup_claimed_at<now()-interval '15 minutes')
  and (p_asset_ids is null or candidate.id=any(p_asset_ids))
  order by candidate.created_at for update of candidate skip locked limit least(greatest(p_limit,1),100)
 loop
  v_token:=gen_random_uuid();
  update public.assets set staging_cleanup_claimed_at=now(),staging_cleanup_token=v_token where id=a.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',a.id,'staging_path',a.staging_path,'claim_token',v_token));
 end loop;
 return result;
end $$;

create function public.mb_complete_ready_staging_cleanup(p_id uuid,p_token uuid) returns boolean
language plpgsql set search_path=public,extensions as $$
begin
 update public.assets set staging_cleanup_completed_at=now()
 where id=p_id and status='ready' and staging_cleanup_token=p_token
 and staging_cleanup_claimed_at is not null and staging_cleanup_completed_at is null;
 return found;
end $$;

revoke all on function public.mb_claim_ready_staging_cleanup(integer,uuid[]) from public,anon,authenticated;
revoke all on function public.mb_complete_ready_staging_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mb_claim_ready_staging_cleanup(integer,uuid[]) to service_role;
grant execute on function public.mb_complete_ready_staging_cleanup(uuid,uuid) to service_role;
