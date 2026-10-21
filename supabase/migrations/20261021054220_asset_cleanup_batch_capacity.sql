-- A daily batch can drain more than the global daily upload allowance (60).
create or replace function public.mb_claim_asset_cleanup(p_limit integer default 25,p_asset_ids uuid[] default null) returns jsonb
language plpgsql set search_path=public,extensions as $$
declare a public.assets;result jsonb:='[]'::jsonb;
begin
 for a in
  select candidate.* from public.assets candidate
  where candidate.created_at<now()-interval '24 hours' and candidate.cleanup_completed_at is null
  and (candidate.cleanup_claimed_at is null or candidate.cleanup_claimed_at<now()-interval '15 minutes')
  and (p_asset_ids is null or candidate.id=any(p_asset_ids))
  and not exists(select 1 from public.memories m where m.asset_id=candidate.id and m.visibility in ('published','hidden'))
  order by candidate.created_at for update of candidate skip locked limit least(greatest(p_limit,1),100)
 loop
  -- Recheck in a fresh statement after acquiring the asset lock. A publisher
  -- also locks this row before checking ready, so neither side can pass a stale
  -- eligibility snapshot while the other commits a publication or a claim.
  if exists(select 1 from public.memories m where m.asset_id=a.id and m.visibility in ('published','hidden')) then continue;end if;
  update public.assets set status='deleted',cleanup_claimed_at=now() where id=a.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',a.id,'path',a.path,'staging_path',a.staging_path));
 end loop;
 return result;
end $$;
